require('dotenv').config();

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const Module = require('node:module');
const express = require('express');
const cookieParser = require('cookie-parser');
const { after, before, test } = require('node:test');

const adminConfigPath = require.resolve('../routes/admin/config');
const adminConfigStub = new Module(adminConfigPath, module);
adminConfigStub.filename = adminConfigPath;
adminConfigStub.loaded = true;
adminConfigStub.exports = {
    bannedUsers: new Set(),
    lastLogouts: {}
};
require.cache[adminConfigPath] = adminConfigStub;

const { sql } = require('../database');
const { validateJwtToken } = require('../routes/auth/functions');
const authRouter = require('../routes/auth');

const app = express();
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json());
app.use('/auth', authRouter);

const createdEmails = new Set();
let server;
let baseUrl;
let requestIp = 1;

function randomEmail() {
    const email = `test-${randomBytes(8).toString('hex')}@example.test`;
    createdEmails.add(email);
    return email;
}

function randomUsername() {
    return `test${randomBytes(8).toString('hex')}`;
}

async function postJson(route, body, extraHeaders = {}) {
    const response = await fetch(`${baseUrl}${route}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-forwarded-for': `192.0.2.${requestIp++}`,
            ...extraHeaders
        },
        body: JSON.stringify(body)
    });

    return {
        response,
        body: await response.json()
    };
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
        const emails = [...createdEmails];
        if (emails.length) {
            const [users] = await sql.query(
                'SELECT id FROM users WHERE email IN (?)',
                [emails]
            );
            const userIds = users.map(user => user.id);
            if (userIds.length) {
                await sql.query('DELETE FROM serverSeeds WHERE userId IN (?)', [userIds]);
                await sql.query('DELETE FROM clientSeeds WHERE userId IN (?)', [userIds]);
                await sql.query('DELETE FROM users WHERE id IN (?)', [userIds]);
            }
        }
    } finally {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close(error => error ? reject(error) : resolve());
            });
        }
        await sql.end();
    }
});

test('auth registration, login, and logout use real database state', async t => {
    const email = randomEmail();
    const username = randomUsername();
    const password = `GoodPass!${randomBytes(6).toString('hex')}`;

    let userId;
    let loginToken;

    await t.test('registers a user and returns a session', async () => {
        const { response, body } = await postJson('/auth/register', {
            username,
            email,
            password,
            confirm18: true
        });

        assert.equal(response.status, 200);
        assert.ok(typeof body.token === 'string' && body.token.length > 0);
        assert.ok(Number.isInteger(body.expiresIn) && body.expiresIn > 0);
        const cookieHeader = response.headers.get('set-cookie') || '';
        assert.ok(/(?:^|,\s*)jwt=[^;]+/.test(cookieHeader)
            && /SameSite=Lax/.test(cookieHeader));

        userId = body.userId;
        const [[user]] = await sql.query(
            'SELECT id, passwordHash FROM users WHERE email = ?',
            [email]
        );
        assert.ok(user);
        assert.equal(String(user.id), userId);
        assert.ok(typeof user.passwordHash === 'string'
            && user.passwordHash.startsWith('$2')
            && user.passwordHash !== password);
    });

    await t.test('rejects duplicate email with EMAIL_TAKEN', async () => {
        const { response, body } = await postJson('/auth/register', {
            username: randomUsername(),
            email,
            password,
            confirm18: true
        });
        assert.equal(response.status, 409);
        assert.equal(body.error, 'EMAIL_TAKEN');
    });

    await t.test('rejects username duplicates regardless of letter case', async () => {
        const { response, body } = await postJson('/auth/register', {
            username: username.toUpperCase(),
            email: randomEmail(),
            password,
            confirm18: true
        });
        assert.equal(response.status, 409);
        assert.equal(body.error, 'USERNAME_TAKEN');
    });

    await t.test('rejects a 9-character password', async () => {
        const { response } = await postJson('/auth/register', {
            username: randomUsername(),
            email: randomEmail(),
            password: `Aa1!${randomBytes(3).toString('hex')}`.slice(0, 9),
            confirm18: true
        });
        assert.equal(response.status, 400);
    });

    await t.test('rejects passwords over 72 bytes', async () => {
        const { response } = await postJson('/auth/register', {
            username: randomUsername(),
            email: randomEmail(),
            password: 'é'.repeat(37),
            confirm18: true
        });
        assert.equal(response.status, 400);
    });

    await t.test('requires confirm18', async () => {
        const { response } = await postJson('/auth/register', {
            username: randomUsername(),
            email: randomEmail(),
            password,
            confirm18: false
        });
        assert.equal(response.status, 400);
    });

    await t.test('logs in with the correct password and issues a valid token', async () => {
        const { response, body } = await postJson('/auth/login', { email, password });
        assert.equal(response.status, 200);
        assert.ok(typeof body.token === 'string' && body.token.length > 0);
        assert.ok(Number.isInteger(body.expiresIn) && body.expiresIn > 0);
        assert.ok(validateJwtToken(body.token));
        loginToken = body.token;
    });

    await t.test('returns identical errors for wrong passwords and unknown emails', async () => {
        const wrongPassword = await postJson('/auth/login', {
            email,
            password: `WrongPass!${randomBytes(5).toString('hex')}`
        });
        const unknownEmail = await postJson('/auth/login', {
            email: randomEmail(),
            password
        });

        assert.equal(wrongPassword.response.status, 401);
        assert.equal(unknownEmail.response.status, wrongPassword.response.status);
        assert.deepEqual(unknownEmail.body, wrongPassword.body);
    });

    await t.test('logout invalidates the previously issued token', async () => {
        const { response } = await postJson(
            '/auth/logout',
            {},
            { authorization: loginToken }
        );
        assert.equal(response.status, 200);
        assert.equal(validateJwtToken(loginToken), null);
    });
});
