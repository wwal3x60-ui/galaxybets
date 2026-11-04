require('dotenv').config();

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { after, test } = require('node:test');

const { sql } = require('../database');
const { toCents } = require('../utils/money');

const createdUserIds = [];
const CASE_RTP = 0.9;
const CASE_PRICE_CENTS = 1000;
const COMPOSITIONS = [
    { name: '1v1', playersPerTeam: 1, humanCounts: [1, 1] },
    { name: '2v2', playersPerTeam: 2, humanCounts: [2, 2] },
    { name: '4v4', playersPerTeam: 4, humanCounts: [4, 4] },
    { name: '3v3', playersPerTeam: 3, humanCounts: [3, 3] },
    { name: '2 humans vs (1 human + 1 bot)', playersPerTeam: 2, humanCounts: [2, 1] }
];

function expectedRtp(composition, casePrice) {
    const humanCount = composition.humanCounts.reduce((sum, count) => sum + count, 0);
    const expectedTotal = composition.playersPerTeam * 2 * CASE_RTP * casePrice;
    const expectedAmount = expectedTotal / composition.playersPerTeam;
    const expectedHumanPayout =
        ((composition.humanCounts[0] + composition.humanCounts[1]) / 2) * expectedAmount;
    const totalHumanEntry = humanCount * casePrice;

    return expectedHumanPayout / totalHumanEntry;
}

function mulberry32(seed) {
    return function random() {
        let value = seed += 0x6D2B79F5;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

async function createUser(role) {
    const suffix = randomBytes(8).toString('hex');
    const [result] = await sql.query(
        'INSERT INTO users (username, email, passwordHash, role, balance) VALUES (?, ?, ?, ?, ?)',
        [`rtptest${suffix}`, `rtptest-${suffix}@example.test`, 'test-placeholder', role, '0.00']
    );
    createdUserIds.push(result.insertId);
    return result.insertId;
}

async function getBalanceCents(userId) {
    const [[user]] = await sql.query('SELECT balance FROM users WHERE id = ?', [userId]);
    assert.ok(user);
    return toCents(String(user.balance));
}

after(async () => {
    try {
        if (createdUserIds.length) {
            await sql.query('DELETE FROM battlePlayers WHERE userId IN (?)', [createdUserIds]);
            await sql.query('DELETE FROM bets WHERE userId IN (?)', [createdUserIds]);
            await sql.query('DELETE FROM battles WHERE ownerId IN (?)', [createdUserIds]);
            await sql.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
        }
    } finally {
        await sql.end();
    }
});

test('Expected RTP is 90% for each team composition', () => {
    const results = COMPOSITIONS.map(composition => {
        const rtp = expectedRtp(composition, CASE_PRICE_CENTS);
        assert.ok(Math.abs(rtp - CASE_RTP) < 1e-9, `${composition.name} expected RTP was ${rtp}`);
        return { composition: composition.name, rtp };
    });

    console.log('\nExpected RTP by composition:');
    console.table(results.map(result => ({
        composition: result.composition,
        RTP: `${(result.rtp * 100).toFixed(6)}%`
    })));
});

test('Simulated RTP stays within 2 percentage points for each team composition', () => {
    const random = mulberry32(42);
    const maxItemPrice = 1.8 * CASE_PRICE_CENTS;
    const trials = 20_000;
    const results = COMPOSITIONS.map(composition => {
        const humanCount = composition.humanCounts.reduce((sum, count) => sum + count, 0);
        let totalHumanEntry = 0;
        let totalHumanPayout = 0;

        for (let trial = 0; trial < trials; trial++) {
            let total = 0;
            for (let player = 0; player < composition.playersPerTeam * 2; player++) {
                total += Math.floor(random() * (maxItemPrice + 1));
            }

            const winningTeam = random() < 0.5 ? 0 : 1;
            const amount = Math.floor(total / composition.playersPerTeam);
            totalHumanEntry += humanCount * CASE_PRICE_CENTS;
            totalHumanPayout += composition.humanCounts[winningTeam] * amount;
        }

        const rtp = totalHumanPayout / totalHumanEntry;
        assert.ok(
            Math.abs(rtp - CASE_RTP) < 0.02,
            `${composition.name} simulated RTP was ${(rtp * 100).toFixed(4)}%`
        );
        return { composition: composition.name, rtp };
    });

    console.log('\nSimulated RTP by composition (20,000 trials each):');
    console.table(results.map(result => ({
        composition: result.composition,
        RTP: `${(result.rtp * 100).toFixed(4)}%`
    })));
});

test('Payout SQL excludes bots from mixed and bot-only winning teams', async () => {
    const humanId = await createUser('USER');
    const botId = await createUser('bot');

    const [mixedTeamResult] = await sql.query(
        'UPDATE users SET balance = balance + ? WHERE id IN(?) AND role <> ?',
        ['5.00', [humanId, botId], 'bot']
    );
    const humanBalanceAfterMixedWin = await getBalanceCents(humanId);
    const botBalanceAfterMixedWin = await getBalanceCents(botId);

    assert.equal(mixedTeamResult.affectedRows, 1);
    assert.equal(humanBalanceAfterMixedWin, 500);
    assert.equal(botBalanceAfterMixedWin, 0);
    console.log(
        `Mixed winning team: human=${humanBalanceAfterMixedWin} cents, ` +
        `bot=${botBalanceAfterMixedWin} cents, affectedRows=${mixedTeamResult.affectedRows}`
    );

    const [botOnlyTeamResult] = await sql.query(
        'UPDATE users SET balance = balance + ? WHERE id IN(?) AND role <> ?',
        ['5.00', [botId], 'bot']
    );
    const botBalanceAfterBotWin = await getBalanceCents(botId);

    assert.equal(botOnlyTeamResult.affectedRows, 0);
    assert.equal(botBalanceAfterBotWin, 0);
    console.log(
        `Bot-only winning team: bot=${botBalanceAfterBotWin} cents, ` +
        `affectedRows=${botOnlyTeamResult.affectedRows}`
    );
});

test('A $10.00 human-versus-bot battle has an expected $1.00 human loss', () => {
    const entry = 10;
    const humanVsBot = { playersPerTeam: 1, humanCounts: [1, 0] };
    const rtp = expectedRtp(humanVsBot, entry);
    const expectedLoss = entry * (1 - rtp);
    const expectedLossCents = toCents(String(expectedLoss));

    assert.equal(rtp, CASE_RTP);
    assert.equal(expectedLossCents, 100);
    console.log(`Test 4 expected human loss: $${(expectedLossCents / 100).toFixed(2)} per battle`);
});
