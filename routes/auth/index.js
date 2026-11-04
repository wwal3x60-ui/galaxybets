const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const router = express.Router();

const { sql, doTransaction } = require('../../database');
const { createUserSeeds } = require('../../fairness');
const { bannedUsers, lastLogouts } = require('../admin/config');
const { expiresIn, generateJwtToken, isAuthed } = require('./functions');
const { registerLimiter, loginLimiter } = require('./limiters');

const reservedUsernames = new Set([
    'admin',
    'administrator',
    'support',
    'mod',
    'moderator',
    'staff',
    'galaxybets',
    'system',
    'owner',
    'root',
    'null',
    'undefined',
    'bot'
]);

const commonPasswords = new Set([
    '123456',
    'password',
    '123456789',
    '12345678',
    '12345',
    'qwerty',
    '1234567',
    '111111',
    '123123',
    'abc123',
    'password1',
    '1234567890',
    '1234',
    '000000',
    'iloveyou',
    '1q2w3e4r',
    'qwerty123',
    'monkey',
    'dragon',
    'sunshine',
    'princess',
    'letmein',
    'welcome',
    'football',
    'admin'
]);

const dummyPasswordHash = '$2b$12$JVYEkrn6akHPT/ewBYDBt.vjNopkpvUp8yp9lijt1SAzmxsX./fSG';

function respondWithValidationError(req, res) {
    const errors = validationResult(req);
    if (errors.isEmpty()) return false;

    res.status(400).json({ error: errors.array()[0].msg });
    return true;
}

function issueSession(res, user) {
    const userId = String(user.id);
    const token = generateJwtToken(userId);

    res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
    });

    return res.status(200).json({
        expiresIn,
        userId,
        username: user.username
    });
}

router.post('/register', registerLimiter, [
    body('username')
        .isString().withMessage('INVALID_USERNAME').bail()
        .isLength({ min: 3, max: 20 }).withMessage('INVALID_USERNAME').bail()
        .matches(/^[A-Za-z0-9_]+$/).withMessage('INVALID_USERNAME').bail()
        .custom(username => !reservedUsernames.has(username.toLowerCase()))
        .withMessage('INVALID_USERNAME'),
    body('email')
        .isString().withMessage('INVALID_EMAIL').bail()
        .customSanitizer(email => email.trim().toLowerCase())
        .isLength({ min: 1, max: 254 }).withMessage('INVALID_EMAIL').bail()
        .isEmail().withMessage('INVALID_EMAIL'),
    body('password')
        .isString().withMessage('INVALID_PASSWORD').bail()
        .custom((password, { req }) => {
            const byteLength = Buffer.byteLength(password, 'utf8');
            if (byteLength < 10 || byteLength > 72) return false;

            const normalizedPassword = password.toLowerCase();
            if (commonPasswords.has(normalizedPassword)) return false;

            const username = req.body.username;
            const email = req.body.email;
            return typeof username === 'string'
                && typeof email === 'string'
                && normalizedPassword !== username.toLowerCase()
                && normalizedPassword !== email;
        })
        .withMessage('INVALID_PASSWORD'),
    body('confirm18')
        .custom(value => value === true)
        .withMessage('CONFIRM_18_REQUIRED')
], async (req, res) => {
    if (respondWithValidationError(req, res)) return;

    const { username, email, password } = req.body;
    const ip = req.ip;
    const country = req.headers['cf-ipcountry'] || null;

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await doTransaction(async (connection, commit) => {
            const [result] = await connection.query(
                'INSERT INTO users (username, email, passwordHash, ip, country) VALUES (?, ?, ?, ?, ?)',
                [username, email, passwordHash, ip, country]
            );
            const newUserId = String(result.insertId);

            await createUserSeeds(newUserId, connection);
            await commit();

            return { id: newUserId, username };
        });

        return issueSession(res, user);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            const message = String(error.message || '').toLowerCase();
            if (message.includes('uq_users_username')) {
                return res.status(409).json({ error: 'USERNAME_TAKEN' });
            }
            if (message.includes('uq_users_email')) {
                return res.status(409).json({ error: 'EMAIL_TAKEN' });
            }
        }

        console.error('Registration failed:', error);
        return res.status(500).json({ error: 'UNKNOWN_ERROR' });
    }
});

router.post('/login', loginLimiter, async (req, res) => {
    const body = req.body || {};
    const email = typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';
    const password = typeof body.password === 'string' ? body.password : '';

    try {
        const [[user]] = await sql.query(
            'SELECT id, username, passwordHash FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            await bcrypt.compare(password, dummyPasswordHash);
            return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
        }

        if (!await bcrypt.compare(password, user.passwordHash)) {
            return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
        }

        if (bannedUsers.has(String(user.id))) {
            return res.status(401).json({ error: 'UNAUTHORIZED' });
        }

        const ip = req.ip;
        const country = req.headers['cf-ipcountry'] || null;
        await sql.query('UPDATE users SET ip = ?, country = ? WHERE id = ?', [ip, country, user.id]);

        return issueSession(res, user);
    } catch (error) {
        console.error('Login failed:', error);
        return res.status(500).json({ error: 'UNKNOWN_ERROR' });
    }
});

router.post('/logout', isAuthed, async (req, res) => {

    // await sql.query("DELETE FROM sessions WHERE token = ?", [req.headers.authorization]);
    
    await sql.query('UPDATE users SET lastLogout = NOW() WHERE id = ?', [req.userId]);
    lastLogouts[req.userId] = Date.now();

    res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    res.json({ success: true });

});

module.exports = router;
