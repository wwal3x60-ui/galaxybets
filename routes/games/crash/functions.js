const { sql, doTransaction } = require('../../../database');
const { newBets } = require('../../../socketio/bets');
const { sleep, roundDecimal } = require('../../../utils');
const { sha256 } = require('../../../fairness');
const { creditAffiliateGameBets, emitAffiliateCredits, withAffiliateSettlement } = require('../../../utils/affiliate-commission');
const io = require('../../../socketio/server');

const crash = {
    round: {}, bets: [], last: [],
    config: { betTime: 10000, tick: 150, maxProfit: 1000000 }
};
const growthFunc = ms => Math.floor(100 * Math.pow(Math.E, 0.00006 * ms)) / 100;
const lastResults = 10;
let loopStarted = false;

async function updateCrash() {
    const [[round]] = await sql.query(
        'SELECT * FROM crash WHERE endedAt IS NULL ORDER BY id ASC LIMIT 1'
    );
    if (!round) { crash.round = {}; crash.bets = []; return; }
    if (!round.createdAt) {
        round.createdAt = new Date();
        await sql.query('UPDATE crash SET createdAt = ? WHERE id = ?', [round.createdAt, round.id]);
    }
    round.serverSeed = sha256(round.serverSeed);
    crash.round = round;
    const [bets] = await sql.query(
        `SELECT cb.id, cb.userId, cb.amount, cb.cashoutPoint, cb.autoCashoutPoint,
                u.username, u.xp, u.role, u.anon
         FROM crashBets cb JOIN users u ON u.id = cb.userId WHERE cb.roundId = ?`,
        [round.id]
    );
    crash.bets = bets.map(bet => ({
        id: bet.id, amount: Number(bet.amount), cashoutPoint: bet.cashoutPoint,
        autoCashoutPoint: bet.autoCashoutPoint,
        user: { id: bet.userId, username: bet.username, xp: bet.xp, role: bet.role, anon: bet.anon }
    }));
    io.to('crash').emit('crash:new', {
        id: round.id, serverSeed: round.serverSeed, createdAt: round.createdAt
    });
    if (crash.bets.length) io.to('crash').emit('crash:bets', crash.bets);
}

async function cacheCrash() {
    const [last] = await sql.query(
        'SELECT crashPoint FROM crash WHERE endedAt IS NOT NULL ORDER BY id DESC LIMIT ?',
        [lastResults]
    );
    crash.last = last.map(row => row.crashPoint);
    await updateCrash();
    if (!loopStarted) { loopStarted = true; void crashInterval(); }
}

// Manual and automatic cashouts share the same round/bet locks.
async function settleCrashCashout(bet, point, automatic = false) {
    const roundId = crash.round.id;
    const result = await withAffiliateSettlement(async (connection, commit) => {
        const [[round]] = await connection.query(
            'SELECT startedAt, endedAt, crashPoint FROM crash WHERE id = ? FOR UPDATE', [roundId]
        );
        if (!round || !round.startedAt || round.endedAt) return { error: 'ALREADY_ENDED' };
        if (!Number.isFinite(point) || point < 1.01 || point > Number(round.crashPoint)) {
            return { error: 'INVALID_CASHOUT' };
        }
        if (!automatic && growthFunc(Date.now() - new Date(round.startedAt).getTime()) > Number(round.crashPoint)) {
            return { error: 'ALREADY_ENDED' };
        }
        const [[saved]] = await connection.query(
            'SELECT amount, cashoutPoint, autoCashoutPoint FROM crashBets WHERE id = ? AND roundId = ? AND userId = ? FOR UPDATE',
            [bet.id, roundId, bet.user.id]
        );
        if (!saved) return { error: 'NOT_JOINED' };
        if (Number(saved.cashoutPoint) > 0) return { error: 'ALREADY_CASHED_OUT' };
        if (automatic && Number(saved.autoCashoutPoint) !== point) return { error: 'INVALID_CASHOUT' };
        const [betRows] = await connection.query(
            `SELECT id, completed FROM bets WHERE game = 'crash' AND gameId = ? FOR UPDATE`, [bet.id]
        );
        if (!betRows.length) throw new Error('Crash wager row is missing');
        if (betRows.some(row => Number(row.completed) === 1)) return { error: 'ALREADY_CASHED_OUT' };
        const winnings = Math.min(roundDecimal(Number(saved.amount) * point), crash.config.maxProfit);
        await connection.query('UPDATE crashBets SET cashoutPoint = ? WHERE id = ?', [point, bet.id]);
        await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [winnings, bet.user.id]);
        await connection.query(
            'UPDATE bets SET completed = 1, winnings = ? WHERE game = ? AND gameId = ?',
            [winnings, 'crash', bet.id]
        );
        const credits = await creditAffiliateGameBets(connection, 'crash', [bet.id]);
        await commit();
        return { winnings, credits };
    });
    if (result.error) return result;
    bet.cashoutPoint = point;
    bet.winnings = result.winnings;
    io.to(String(bet.user.id)).emit('balance', 'add', result.winnings);
    emitAffiliateCredits(result.credits);
    io.to('crash').emit('crash:cashout', { id: bet.id, cashoutPoint: point, winnings: result.winnings });
    void newBets([{
        user: bet.user, amount: bet.amount, edge: roundDecimal(bet.amount * 0.075),
        payout: result.winnings, game: 'crash'
    }]).catch(error => console.error('Crash bet broadcast failed:', error));
    return { success: true };
}

async function processCashoutsBelow(multiplier) {
    for (const bet of crash.bets) {
        if (Number(bet.cashoutPoint) > 0 || !bet.autoCashoutPoint) continue;
        const point = Number(bet.autoCashoutPoint);
        if (point <= multiplier) {
            const result = await settleCrashCashout(bet, point, true);
            if (result.error && result.error !== 'ALREADY_CASHED_OUT') {
                throw new Error('Automatic cashout failed: ' + result.error);
            }
        }
    }
}

async function crashInterval() {
    try {
        if (!crash.round.id) { await sleep(1000); await updateCrash(); return; }
        if (!crash.round.startedAt) {
            await sleep(crash.config.betTime);
            const startedAt = new Date();
            await doTransaction(async (connection, commit) => {
                const [[round]] = await connection.query(
                    'SELECT startedAt FROM crash WHERE id = ? FOR UPDATE', [crash.round.id]
                );
                if (!round) throw new Error('Crash round is missing');
                if (!round.startedAt) await connection.query(
                    'UPDATE crash SET startedAt = ? WHERE id = ?', [startedAt, crash.round.id]
                );
                await commit();
                crash.round.startedAt = round.startedAt || startedAt;
            });
            io.to('crash').emit('crash:start', { id: crash.round.id });
        }
        while (!crash.round.endedAt) {
            const elapsed = Date.now() - new Date(crash.round.startedAt).getTime();
            const multiplier = Math.min(growthFunc(elapsed), Number(crash.round.crashPoint));
            await processCashoutsBelow(multiplier);
            crash.round.currentMultiplier = multiplier;
            io.to('crash').emit('crash:tick', multiplier);
            if (multiplier >= Number(crash.round.crashPoint)) break;
            await sleep(crash.config.tick);
        }
        const endedAt = new Date();
        const settled = await withAffiliateSettlement(async (connection, commit) => {
            const [[saved]] = await connection.query(
                'SELECT endedAt FROM crash WHERE id = ? FOR UPDATE', [crash.round.id]
            );
            if (!saved) throw new Error('Crash round is missing');
            if (saved.endedAt) { await commit(); return false; }
            const [storedBets] = await connection.query(
                'SELECT id FROM crashBets WHERE roundId = ? ORDER BY id ASC FOR UPDATE',
                [crash.round.id]
            );
            const ids = storedBets.map(bet => bet.id);
            if (ids.length) await connection.query(
                'UPDATE bets SET completed = 1, winnings = 0 WHERE game = ? AND gameId IN (?) AND completed = 0',
                ['crash', ids]
            );
            const credits = await creditAffiliateGameBets(connection, 'crash', ids);
            await connection.query('UPDATE crash SET endedAt = ? WHERE id = ?', [endedAt, crash.round.id]);
            await commit();
            emitAffiliateCredits(credits);
            return true;
        });
        crash.round.endedAt = endedAt;
        if (settled) {
            io.to('crash').emit('crash:end', { id: crash.round.id, crashPoint: crash.round.crashPoint });
            const losers = crash.bets.filter(bet => !Number(bet.cashoutPoint)).map(bet => ({
                user: bet.user, amount: bet.amount, edge: roundDecimal(bet.amount * 0.075), payout: 0, game: 'crash'
            }));
            if (losers.length) void newBets(losers).catch(console.error);
            crash.last.unshift(crash.round.crashPoint);
            if (crash.last.length > lastResults) crash.last.pop();
        }
        await sleep(4000);
        await updateCrash();
    } catch (error) {
        console.error('Crash settlement retry:', error);
        await sleep(1000);
        try { await updateCrash(); } catch (reloadError) { console.error(reloadError); }
    } finally {
        setTimeout(() => { void crashInterval(); }, 0);
    }
}

module.exports = { cacheCrash, crash, settleCrashCashout };
