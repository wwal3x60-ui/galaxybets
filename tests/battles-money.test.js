require('dotenv').config();

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { after, test } = require('node:test');

const { sql, doTransaction } = require('../database');
const { toCents } = require('../utils/money');

const createdUserIds = [];

async function createUser(balance, role = 'USER') {
    const suffix = randomBytes(8).toString('hex');
    const [result] = await sql.query(
        'INSERT INTO users (username, email, passwordHash, role, balance) VALUES (?, ?, ?, ?, ?)',
        [`moneytest${suffix}`, `moneytest-${suffix}@example.test`, 'test-placeholder', role, balance]
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

test('Exact-balance join succeeds', async () => {
    const userId = await createUser('10.00');
    const [result] = await sql.query(
        'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
        ['10.00', userId, '10.00']
    );

    assert.equal(result.affectedRows, 1);
    assert.equal(await getBalanceCents(userId), 0);
});

test('Below-balance join is rejected', async () => {
    const userId = await createUser('9.99');
    const [result] = await sql.query(
        'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
        ['10.00', userId, '10.00']
    );

    assert.equal(result.affectedRows, 0);
    assert.equal(await getBalanceCents(userId), 999);
});

test('Strict-greater bug is documented', async () => {
    const userId = await createUser('10.00');
    const [result] = await sql.query(
        'UPDATE users SET balance = balance - ? WHERE id = ? AND balance > ?',
        ['10.00', userId, '10.00']
    );

    assert.equal(result.affectedRows, 0);
    assert.equal(await getBalanceCents(userId), 1000);
});

test('Bot FOR UPDATE runs cleanly', async () => {
    const [existingBots] = await sql.query(
        'SELECT id FROM users WHERE role = ?',
        ['BOT']
    );
    const excludedIds = existingBots.map(bot => bot.id);
    if (!excludedIds.length) excludedIds.push(0);

    const botIds = [
        await createUser('0.00', 'BOT'),
        await createUser('0.00', 'BOT')
    ];

    const bot = await doTransaction(async connection => {
        const [[selectedBot]] = await connection.query(
            'SELECT id, username, xp, role, anon FROM users WHERE id NOT IN(?) AND role = ? LIMIT 1 FOR UPDATE',
            [excludedIds, 'BOT']
        );
        return selectedBot;
    });

    assert.ok(bot);
    assert.ok(botIds.some(id => String(id) === String(bot.id)));
});
