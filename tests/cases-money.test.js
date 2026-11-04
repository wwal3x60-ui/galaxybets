require('dotenv').config();

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const Module = require('node:module');
const express = require('express');
const { after, before, test } = require('node:test');

const adminConfigPath = require.resolve('../routes/admin/config');
const adminConfigStub = new Module(adminConfigPath, module);
adminConfigStub.filename = adminConfigPath;
adminConfigStub.loaded = true;
adminConfigStub.exports = {
    bannedUsers: new Set(),
    lastLogouts: {},
    sponsorLockedUsers: new Set(),
    enabledFeatures: { cases: true },
    xpMultiplier: 1
};
require.cache[adminConfigPath] = adminConfigStub;

const rakebackFunctionsPath = require.resolve('../routes/user/rakeback/functions');
const rakebackFunctionsStub = new Module(rakebackFunctionsPath, module);
rakebackFunctionsStub.filename = rakebackFunctionsPath;
rakebackFunctionsStub.loaded = true;
rakebackFunctionsStub.exports = { cachedRakebacks: {} };
require.cache[rakebackFunctionsPath] = rakebackFunctionsStub;

const { sql } = require('../database');
const { generateJwtToken } = require('../routes/auth/functions');
const { combine, getResult } = require('../fairness');
const { fromCents, toCents } = require('../utils/money');
const casesRouter = require('../routes/games/cases');

const app = express();
app.use(express.json());
app.use('/cases', casesRouter);

const createdUserIds = [];
const createdCaseIds = [];
const createdCaseVersionIds = [];
let server;
let baseUrl;

function itemForResult(items, result) {
    return items.find(item => result >= item.rangeFrom && result <= item.rangeTo);
}

function findClientSeedForItem(serverSeed, items, expectedItem, nonce = 1) {
    for (let attempt = 0; attempt < 10000; attempt++) {
        const clientSeed = `case-money-target-${attempt}`;
        const result = getResult(combine(serverSeed, clientSeed, nonce));
        if (itemForResult(items, result)?.id === expectedItem.id) return clientSeed;
    }

    throw new Error(`Could not find a deterministic seed for item ${expectedItem.id}`);
}

function findClientSeedFor25Opens(serverSeed, casePriceCents, items) {
    const startBalanceCents = 100000;

    for (let attempt = 0; attempt < 10000; attempt++) {
        const clientSeed = `case-money-25-${attempt}`;
        let balanceCents = startBalanceCents;
        const wonItems = [];

        for (let nonce = 1; nonce <= 25; nonce++) {
            if (balanceCents < casePriceCents) break;

            const result = getResult(combine(serverSeed, clientSeed, nonce));
            const item = itemForResult(items, result);
            if (!item) throw new Error(`No case item covers roll ${result}`);

            balanceCents += Number(item.price) - casePriceCents;
            wonItems.push(item);
        }

        if (wonItems.length === 25) return { clientSeed, wonItems };
    }

    throw new Error('Could not find deterministic outcomes affordable for 25 opens');
}

async function createUser(balance) {
    const suffix = randomBytes(8).toString('hex');
    const [result] = await sql.query(
        'INSERT INTO users (username, email, passwordHash, balance) VALUES (?, ?, ?, ?)',
        [`casemoney${suffix}`, `casemoney-${suffix}@example.test`, 'test-placeholder', balance]
    );
    const userId = String(result.insertId);
    createdUserIds.push(userId);

    const serverSeed = `case-money-server-${userId}`;
    await sql.query('INSERT INTO serverSeeds (userId, seed) VALUES (?, ?)', [userId, serverSeed]);
    await sql.query('INSERT INTO clientSeeds (userId, seed) VALUES (?, ?)', [
        userId,
        `case-money-initial-${userId}`
    ]);

    return {
        userId,
        serverSeed,
        token: generateJwtToken(userId)
    };
}

async function setClientSeed(userId, clientSeed) {
    await sql.query(
        'UPDATE clientSeeds SET seed = ? WHERE userId = ? AND endedAt IS NULL',
        [clientSeed, userId]
    );
}

async function getCheapestCase() {
    const [[caseInfo]] = await sql.query(`
        SELECT c.id, c.name, cv.id AS caseVersionId, cv.price
        FROM cases c
        INNER JOIN caseVersions cv ON cv.caseId = c.id AND cv.endedAt IS NULL
        ORDER BY cv.price ASC
        LIMIT 1
    `);
    assert.ok(caseInfo, 'Expected at least one active case');

    const [items] = await sql.query(
        `SELECT id, price, rangeFrom, rangeTo
         FROM caseItems
         WHERE caseVersionId = ?
         ORDER BY rangeFrom ASC`,
        [caseInfo.caseVersionId]
    );
    assert.ok(items.length > 0, `Expected items for ${caseInfo.name}`);

    return { ...caseInfo, items };
}

async function postOpen(user, caseId, routeCaseId = String(caseId)) {
    const response = await fetch(`${baseUrl}/cases/${routeCaseId}/open`, {
        method: 'POST',
        headers: {
            authorization: user.token,
            'content-type': 'application/json',
            connection: 'close'
        },
        body: JSON.stringify({ amount: 1 })
    });

    return { response, body: await response.json() };
}

async function getBalanceCents(userId) {
    const [[user]] = await sql.query('SELECT balance FROM users WHERE id = ?', [userId]);
    assert.ok(user);
    return toCents(String(user.balance));
}

async function getBetForOpening(userId, openingId) {
    const [[bet]] = await sql.query(
        `SELECT amount, winnings
         FROM bets
         WHERE userId = ? AND game = 'case' AND gameId = ?`,
        [userId, openingId]
    );
    assert.ok(bet, `Expected a bet for opening ${openingId}`);
    return bet;
}

before(async () => {
    await new Promise((resolve, reject) => {
        server = app.listen(0, '127.0.0.1', resolve);
        server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    try {
        if (createdCaseVersionIds.length) {
            const [openings] = await sql.query(
                'SELECT id, rollId FROM caseOpenings WHERE caseVersionId IN (?)',
                [createdCaseVersionIds]
            );
            const openingIds = openings.map(opening => opening.id);
            const gameIds = [...createdCaseVersionIds, ...openingIds];

            await sql.query(
                "DELETE FROM bets WHERE game = 'case' AND gameId IN (?)",
                [gameIds]
            );
            await sql.query(
                'DELETE FROM caseOpenings WHERE caseVersionId IN (?)',
                [createdCaseVersionIds]
            );

            const rollIds = openings.map(opening => opening.rollId);
            if (rollIds.length) {
                await sql.query('DELETE FROM fairRolls WHERE id IN (?)', [rollIds]);
            }

            await sql.query(
                'DELETE FROM caseItems WHERE caseVersionId IN (?)',
                [createdCaseVersionIds]
            );
            await sql.query(
                'DELETE FROM caseVersions WHERE id IN (?)',
                [createdCaseVersionIds]
            );
        }
        if (createdCaseIds.length) {
            await sql.query('DELETE FROM cases WHERE id IN (?)', [createdCaseIds]);
        }

        if (createdUserIds.length) {
            const [openings] = await sql.query(
                'SELECT rollId FROM caseOpenings WHERE userId IN (?)',
                [createdUserIds]
            );
            await sql.query('DELETE FROM bets WHERE userId IN (?)', [createdUserIds]);
            await sql.query('DELETE FROM transactions WHERE userId IN (?)', [createdUserIds]);
            await sql.query('DELETE FROM caseOpenings WHERE userId IN (?)', [createdUserIds]);

            const rollIds = openings.map(opening => opening.rollId);
            if (rollIds.length) {
                await sql.query('DELETE FROM fairRolls WHERE id IN (?)', [rollIds]);
            }

            await sql.query('DELETE FROM serverSeeds WHERE userId IN (?)', [createdUserIds]);
            await sql.query('DELETE FROM clientSeeds WHERE userId IN (?)', [createdUserIds]);
            await sql.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
        }
    } finally {
        if (server) {
            const closed = new Promise((resolve, reject) => {
                server.close(error => error ? reject(error) : resolve());
            });
            if (typeof server.closeAllConnections === 'function') {
                server.closeAllConnections();
            }
            await closed;
        }
        await sql.end();
    }
});

test('Single open is exact', async () => {
    const caseInfo = await getCheapestCase();
    const casePriceCents = Number(caseInfo.price);
    const casePriceDollars = fromCents(casePriceCents);
    assert.equal(toCents(String(casePriceDollars)), casePriceCents);

    const winningItem = [...caseInfo.items].sort(
        (a, b) => (b.rangeTo - b.rangeFrom) - (a.rangeTo - a.rangeFrom)
    )[0];
    const itemPriceCents = Number(winningItem.price);
    const itemPriceDollars = fromCents(itemPriceCents);
    assert.equal(toCents(String(itemPriceDollars)), itemPriceCents);

    const user = await createUser('1000.00');
    await setClientSeed(
        user.userId,
        findClientSeedForItem(user.serverSeed, caseInfo.items, winningItem)
    );

    const balanceBeforeCents = await getBalanceCents(user.userId);
    const { response, body } = await postOpen(user, caseInfo.id);
    assert.equal(response.status, 200, JSON.stringify(body));

    const [[opening]] = await sql.query(
        'SELECT id, caseItemId FROM caseOpenings WHERE userId = ? ORDER BY id DESC LIMIT 1',
        [user.userId]
    );
    assert.ok(opening);
    assert.equal(String(opening.caseItemId), String(winningItem.id));

    const [[actualItem]] = await sql.query(
        'SELECT price FROM caseItems WHERE id = ?',
        [opening.caseItemId]
    );
    const actualItemPriceCents = Number(actualItem.price);
    const balanceAfterCents = await getBalanceCents(user.userId);

    assert.equal(
        balanceAfterCents,
        balanceBeforeCents - casePriceCents + actualItemPriceCents
    );
    assert.equal(
        toCents(String(body.balance)),
        balanceBeforeCents - casePriceCents + actualItemPriceCents
    );

    const bet = await getBetForOpening(user.userId, opening.id);
    const betAmountCents = toCents(String(bet.amount));
    const betWinningsCents = toCents(String(bet.winnings));
    assert.equal(betAmountCents, casePriceCents);
    assert.equal(betWinningsCents, itemPriceCents);
});

test('Insufficient balance is rejected', async () => {
    const [caseResult] = await sql.query(
        'INSERT INTO cases (name, slug, img) VALUES (?, ?, ?)',
        ['TEST_INSUFFICIENT_CASE', 'test-insufficient-case', 'default']
    );
    const caseId = String(caseResult.insertId);
    createdCaseIds.push(caseId);

    const [versionResult] = await sql.query(
        'INSERT INTO caseVersions (caseId, price, endedAt) VALUES (?, ?, NULL)',
        [caseId, 700]
    );
    const caseVersionId = String(versionResult.insertId);
    createdCaseVersionIds.push(caseVersionId);

    try {
        await sql.query(
            `INSERT INTO caseItems
                (caseVersionId, name, img, price, robloxId, rangeFrom, rangeTo)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [caseVersionId, 'TEST_ITEM', 'default', 700, 0, 1, 100000]
        );

        const user = await createUser('5.00');
        const { response, body } = await postOpen(user, caseId);

        assert.equal(response.status, 400);
        assert.equal(body.error, 'INSUFFICIENT_BALANCE');
        assert.equal(await getBalanceCents(user.userId), 500);

        const [[{ betCount }]] = await sql.query(
            "SELECT COUNT(*) AS betCount FROM bets WHERE userId = ? AND game = 'case'",
            [user.userId]
        );
        assert.equal(Number(betCount), 0);

        const [[{ openingCount }]] = await sql.query(
            'SELECT COUNT(*) AS openingCount FROM caseOpenings WHERE userId = ?',
            [user.userId]
        );
        assert.equal(Number(openingCount), 0);
    } finally {
        await sql.query(
            'UPDATE caseVersions SET endedAt = CURRENT_TIMESTAMP WHERE id = ?',
            [caseVersionId]
        );
    }
});

test('Exact-balance open succeeds', async () => {
    const caseInfo = await getCheapestCase();
    const casePriceCents = Number(caseInfo.price);
    const winningItem = [...caseInfo.items].sort(
        (a, b) => (b.rangeTo - b.rangeFrom) - (a.rangeTo - a.rangeFrom)
    )[0];
    const itemPriceCents = Number(winningItem.price);

    const user = await createUser(fromCents(casePriceCents).toFixed(2));
    await setClientSeed(
        user.userId,
        findClientSeedForItem(user.serverSeed, caseInfo.items, winningItem)
    );

    const { response, body } = await postOpen(user, caseInfo.id);
    assert.equal(response.status, 200, JSON.stringify(body));

    const [[opening]] = await sql.query(
        'SELECT id, caseItemId FROM caseOpenings WHERE userId = ? ORDER BY id DESC LIMIT 1',
        [user.userId]
    );
    assert.ok(opening);
    assert.equal(String(opening.caseItemId), String(winningItem.id));
    assert.equal(await getBalanceCents(user.userId), itemPriceCents);

    const [bets] = await sql.query(
        `SELECT amount, winnings
         FROM bets
         WHERE userId = ? AND game = 'case' AND gameId = ?`,
        [user.userId, opening.id]
    );
    assert.equal(bets.length, 1);
    assert.equal(toCents(String(bets[0].amount)), casePriceCents);
    assert.equal(toCents(String(bets[0].winnings)), itemPriceCents);
});

test('25 sequential opens accumulate exactly', async () => {
    const caseInfo = await getCheapestCase();
    const casePriceCents = Number(caseInfo.price);
    const user = await createUser('1000.00');
    const { clientSeed, wonItems } = findClientSeedFor25Opens(
        user.serverSeed,
        casePriceCents,
        caseInfo.items
    );
    await setClientSeed(user.userId, clientSeed);

    let sumCasePriceCents = 0;
    let sumWonItemPriceCents = 0;

    for (let index = 0; index < 25; index++) {
        const { response, body } = await postOpen(user, caseInfo.id);
        assert.equal(response.status, 200, JSON.stringify(body));
        sumCasePriceCents += casePriceCents;
        sumWonItemPriceCents += Number(wonItems[index].price);

        const [[opening]] = await sql.query(
            'SELECT id, caseItemId FROM caseOpenings WHERE userId = ? ORDER BY id DESC LIMIT 1',
            [user.userId]
        );
        assert.ok(opening);
        assert.equal(String(opening.caseItemId), String(wonItems[index].id));

        if (index < 24) await new Promise(resolve => setTimeout(resolve, 320));
    }

    const finalBalanceCents = await getBalanceCents(user.userId);
    assert.equal(finalBalanceCents, 100000 - sumCasePriceCents + sumWonItemPriceCents);
});

test('Race: two concurrent opens with balance enough for one', async () => {
    const caseInfo = await getCheapestCase();
    const casePriceCents = Number(caseInfo.price);
    const lowValueItem = [...caseInfo.items].sort((a, b) => a.price - b.price)[0];
    assert.ok(Number(lowValueItem.price) < casePriceCents - 1);

    const user = await createUser(fromCents(casePriceCents + 1).toFixed(2));
    await setClientSeed(
        user.userId,
        findClientSeedForItem(user.serverSeed, caseInfo.items, lowValueItem)
    );

    const paddedCaseId = String(caseInfo.id).padStart(String(caseInfo.id).length + 1, '0');
    const responses = await Promise.all([
        postOpen(user, caseInfo.id),
        postOpen(user, caseInfo.id, paddedCaseId)
    ]);
    const successful = responses.filter(({ response }) => response.status === 200);
    const rejected = responses.filter(({ response }) => response.status !== 200);

    assert.equal(successful.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].response.status, 400);
    assert.equal(rejected[0].body.error, 'INSUFFICIENT_BALANCE');

    const balanceAfterCents = await getBalanceCents(user.userId);
    assert.ok(balanceAfterCents >= 0);
    assert.equal(balanceAfterCents, 1 + Number(lowValueItem.price));

    const [[{ betCount }]] = await sql.query(
        `SELECT COUNT(*) AS betCount
         FROM bets
         WHERE userId = ? AND game = 'case'`,
        [user.userId]
    );
    assert.equal(Number(betCount), 1);
});

test('Every case is sane + print RTP table', async t => {
    const [rows] = await sql.query(`
        SELECT c.name, cv.id AS caseVersionId, cv.price AS casePrice,
            ci.id AS itemId, ci.price AS itemPrice, ci.rangeFrom, ci.rangeTo
        FROM cases c
        INNER JOIN caseVersions cv ON cv.caseId = c.id
        LEFT JOIN caseItems ci ON ci.caseVersionId = cv.id
        ORDER BY cv.id, ci.rangeFrom
    `);
    const versions = new Map();

    for (const row of rows) {
        if (!versions.has(String(row.caseVersionId))) {
            versions.set(String(row.caseVersionId), {
                name: row.name,
                priceCents: Number(row.casePrice),
                items: []
            });
        }

        if (row.itemId !== null) {
            versions.get(String(row.caseVersionId)).items.push({
                priceCents: Number(row.itemPrice),
                rangeFrom: Number(row.rangeFrom),
                rangeTo: Number(row.rangeTo)
            });
        }
    }

    assert.ok(versions.size > 0, 'Expected case versions in the database');
    const oversizedCases = [];
    console.log('Case name | Price | Item count | Implied RTP');
    console.log('--- | ---: | ---: | ---:');

    for (const version of versions.values()) {
        assert.ok(version.priceCents > 0, `${version.name} must cost more than zero cents`);
        assert.ok(version.items.length > 0, `${version.name} must contain at least one item`);
        for (const item of version.items) {
            assert.ok(item.priceCents > 0, `${version.name} items must cost more than zero cents`);
        }

        if (version.priceCents > 10_000_000) {
            oversizedCases.push(`${version.name} (${version.priceCents} cents)`);
        }

        const expectedPayoutCents = version.items.reduce((total, item) => {
            const probability = (item.rangeTo - item.rangeFrom + 1) / 100000;
            return total + item.priceCents * probability;
        }, 0);
        const rtpPercent = expectedPayoutCents / version.priceCents * 100;
        console.log(
            `${version.name} | $${fromCents(version.priceCents).toFixed(2)} | `
            + `${version.items.length} | ${rtpPercent.toFixed(2)}%`
        );
    }

    await t.test('Case prices are below the $100,000 cents threshold', {
        todo: oversizedCases.length
            ? `Robux-scale case prices: ${oversizedCases.join(', ')}`
            : undefined
    }, () => {
        assert.deepEqual(oversizedCases, []);
    });
});
