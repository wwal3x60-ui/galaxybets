'use strict';

const DAY = 86400000;
const definitions = Object.freeze({
    weekly: Object.freeze({ title: 'Weekly Race', pool: '500.00', prizes: ['300.00', '150.00', '50.00'] }),
    monthly: Object.freeze({ title: 'Monthly Race', pool: '10000.00', prizes: ['6000.00', '3000.00', '1000.00'] })
});
const dateFormat = '%Y-%m-%d %H:%i:%s.%f';
const sqlDate = ms => new Date(ms).toISOString().slice(0, 23).replace('T', ' ');
function millis(value) {
    const result = Date.parse(String(value).replace(' ', 'T').replace(/Z$/, '') + 'Z');
    if (!Number.isFinite(result)) throw new Error('Invalid persisted race date');
    return result;
}
function addMonth(start, anchorDay = new Date(start).getUTCDate()) {
    const result = new Date(start);
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(anchorDay, lastDay));
    return result.valueOf();
}
function endOfRound(type, start, roundNumber, anchorDay) {
    if (type === 'weekly') return start + (roundNumber === 1 ? 7.5 : 7) * DAY;
    if (type === 'monthly') return addMonth(start, anchorDay);
    throw new Error('Invalid race type');
}
function typeCheck(type) { if (!Object.hasOwn(definitions, type)) throw new Error('Invalid race type'); }
async function clock(connection) {
    const [[row]] = await connection.query(`SELECT DATE_FORMAT(UTC_TIMESTAMP(3), '${dateFormat}') AS now`);
    return millis(row.now);
}
async function readRound(connection, id) {
    const [[row]] = await connection.query(
        `SELECT CAST(id AS CHAR) AS id, type, roundNumber,
                DATE_FORMAT(startsAt, '${dateFormat}') AS startsAt,
                DATE_FORMAT(endsAt, '${dateFormat}') AS endsAt,
                settledAt, CAST(firstPrize AS CHAR) AS firstPrize,
                CAST(secondPrize AS CHAR) AS secondPrize, CAST(thirdPrize AS CHAR) AS thirdPrize
         FROM gbRaceRounds WHERE id = ? FOR UPDATE`, [id]
    );
    if (!row) throw new Error('Race round not found');
    return row;
}
async function createRound(connection, type, start, number, anchorDay) {
    const d = definitions[type];
    const endsAt = endOfRound(type, start, number, anchorDay);
    await connection.query(
        `INSERT INTO gbRaceRounds (type, roundNumber, startsAt, endsAt, firstPrize, secondPrize, thirdPrize)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [type, number, sqlDate(start), sqlDate(endsAt), ...d.prizes]
    );
    // Match the immutable type/number key; never round a bigint insertId.
    const [[round]] = await connection.query('SELECT CAST(id AS CHAR) AS id FROM gbRaceRounds WHERE type = ? AND roundNumber = ?', [type, number]);
    await connection.query('UPDATE gbRaceSeries SET currentRoundId = ? WHERE type = ?', [round.id, type]);
    return readRound(connection, round.id);
}
async function ranking(connection, round, limit = 50) {
    const [rows] = await connection.query(
        `SELECT CAST(u.id AS CHAR) AS id, u.username, u.anon,
                CAST(SUM(b.amount) AS CHAR) AS wagered, MIN(b.id) AS firstBetId
         FROM bets b JOIN users u ON u.id = b.userId
         WHERE b.completed = 1 AND b.amount > 0
           AND b.createdAt >= FROM_UNIXTIME(?) AND b.createdAt < FROM_UNIXTIME(?)
           AND u.role = 'USER' AND u.leaderboardBan = 0 AND u.banned = 0
         GROUP BY u.id, u.username, u.anon
         ORDER BY SUM(b.amount) DESC, MIN(b.id) ASC, u.id ASC LIMIT ?`,
        [millis(round.startsAt) / 1000, millis(round.endsAt) / 1000, limit]
    );
    return rows;
}
async function finalize(connection, round) {
    const winners = await ranking(connection, round, 3);
    const prizes = [round.firstPrize, round.secondPrize, round.thirdPrize];
    const credits = [];
    for (let i = 0; i < winners.length; i++) {
        const winner = winners[i], amount = prizes[i];
        await connection.query(
            `INSERT INTO gbRacePrizes (roundId, userId, position, wagered, amount)
             VALUES (?, ?, ?, ?, ?)`, [round.id, winner.id, i + 1, winner.wagered, amount]
        );
        const [credit] = await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, winner.id]);
        if (credit.affectedRows !== 1) throw new Error('Race winner no longer exists');
        await connection.query(
            `INSERT INTO transactions (userId, amount, type, method, methodId)
             VALUES (?, ?, 'in', 'race_prize', ?)`, [winner.id, amount, `${round.id}:${i + 1}`]
        );
        credits.push({userId: String(winner.id), amount});
    }
    await connection.query('UPDATE gbRaceRounds SET settledAt = UTC_TIMESTAMP(3) WHERE id = ? AND settledAt IS NULL', [round.id]);
    return credits;
}
function publicRows(rows, prizes) {
    return rows.map((row, index) => ({
        id: String(row.id), username: row.anon ? 'Anonymous' : row.username,
        position: index + 1, wagered: String(row.wagered), reward: prizes[index] || '0.00'
    }));
}

function makeRaceService({ sql, doTransaction, io, logger = console }) {
    const snapshots = {}, pending = new Map();
    function notify(credits) {
        for (const credit of credits) {
            try { io.to(credit.userId).emit('balance', 'add', Number(credit.amount)); }
            catch (error) { logger.error('Race prize committed, balance notification failed:', error.message); }
        }
    }
    async function update(type) {
        typeCheck(type);
        if (pending.has(type)) return pending.get(type);
        const work = (async () => {
            // Only the process owning this locked series can settle and advance it.
            const result = await doTransaction(async (connection, commit) => {
                const [[series]] = await connection.query(
                    'SELECT CAST(currentRoundId AS CHAR) AS currentRoundId, anchorDay FROM gbRaceSeries WHERE type = ? FOR UPDATE', [type]
                );
                if (!series?.currentRoundId) throw new Error('Races are not installed. Run scripts/races-migrate.js --apply with the backend stopped.');
                let round = await readRound(connection, series.currentRoundId);
                const now = await clock(connection), credits = [];
                let caughtUp = 0;
                while (millis(round.endsAt) <= now && caughtUp < 24) {
                    if (!round.settledAt) credits.push(...await finalize(connection, round));
                    round = await createRound(connection, type, millis(round.endsAt), Number(round.roundNumber) + 1, series.anchorDay);
                    caughtUp++;
                }
                const rows = await ranking(connection, round);
                const [last] = await connection.query(
                    `SELECT CAST(p.userId AS CHAR) AS id, u.username, u.anon, p.position,
                            CAST(p.wagered AS CHAR) AS wagered, CAST(p.amount AS CHAR) AS reward,
                            r.roundNumber, DATE_FORMAT(r.endsAt, '${dateFormat}') AS endsAt
                     FROM gbRacePrizes p JOIN gbRaceRounds r ON r.id = p.roundId
                     JOIN users u ON u.id = p.userId
                     WHERE r.type = ? AND r.roundNumber = ? ORDER BY p.position`, [type, Number(round.roundNumber) - 1]
                );
                const prizes = [round.firstPrize, round.secondPrize, round.thirdPrize];
                const data = {
                    id: round.id, type, title: definitions[type].title, roundNumber: Number(round.roundNumber),
                    createdAt: new Date(millis(round.startsAt)).toISOString(),
                    startsAt: new Date(millis(round.startsAt)).toISOString(), endsAt: new Date(millis(round.endsAt)).toISOString(),
                    serverNow: new Date(now).toISOString(), endsIn: Math.max(0, millis(round.endsAt) - now),
                    status: millis(round.endsAt) > now ? 'active' : 'catching_up',
                    prizePool: definitions[type].pool, prizes,
                    users: publicRows(rows, prizes),
                    previousWinners: last.map(row => ({...row, username: row.anon ? 'Anonymous' : row.username, anon: undefined})),
                };
                await commit();
                return {data, credits};
            });
            snapshots[type] = result.data;
            notify(result.credits);
            return result.data;
        })();
        pending.set(type, work);
        try { return await work; } finally { pending.delete(type); }
    }
    async function seed(connection) {
        const now = Math.floor(await clock(connection) / 1000) * 1000;
        for (const type of Object.keys(definitions)) {
            await connection.query(
                'INSERT IGNORE INTO gbRaceSeries (type, anchorDay) VALUES (?, ?)', [type, new Date(now).getUTCDate()]
            );
            const [[series]] = await connection.query('SELECT CAST(currentRoundId AS CHAR) AS currentRoundId, anchorDay FROM gbRaceSeries WHERE type = ? FOR UPDATE', [type]);
            if (!series.currentRoundId) await createRound(connection, type, now, 1, series.anchorDay);
        }
    }
    return { update, seed, snapshots };
}
module.exports = { makeRaceService, definitions, endOfRound, addMonth, ranking, finalize, sqlDate, millis };
