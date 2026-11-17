'use strict';
const { ipKeyGenerator } = require('express-rate-limit');
const { createHash } = require('node:crypto');
const WINDOW_MS = 5 * 60 * 1000;
function createLoginFailureLimiter(now = Date.now) {
    const attempts = new Map();
    const cleanup = setInterval(() => {
        for (const [key, row] of attempts) {
            if (!row.pending && now() >= (row.blockedUntil || row.expiresAt)) attempts.delete(key);
        }
    }, 60000);
    cleanup.unref();
    return (req, res, next) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const key = createHash('sha256').update(JSON.stringify([ipKeyGenerator(req.ip || req.socket?.remoteAddress || 'unknown'), email])).digest('hex');
        let row = attempts.get(key);
        if (row && !row.pending && now() >= (row.blockedUntil || row.expiresAt)) {
            attempts.delete(key);
            row = null;
        }
        if (row?.blockedUntil > now()) {
            const retryAfter = Math.max(1, Math.ceil((row.blockedUntil - now()) / 1000));
            res.setHeader('Retry-After', retryAfter);
            return res.status(429).json({error:'TOO_MANY_REQUESTS', retryAfter});
        }
        if (!row) {
            row = {failures:0, pending:0, expiresAt:now()+WINDOW_MS, blockedUntil:0};
            attempts.set(key, row);
        }
        // Bound parallel password checks without treating in-flight work as a failure.
        if (row.pending + row.failures >= 10) {
            res.setHeader('Retry-After', 1);
            return res.status(429).json({error:'TOO_MANY_REQUESTS', retryAfter:1});
        }
        row.pending++;
        let settled = false;
        const finish = (completed) => {
            if (settled) return;
            settled = true;
            row.pending--;
            if (attempts.get(key) !== row) return;
            if (completed && res.statusCode >= 200 && res.statusCode < 300) {
                attempts.delete(key);
            } else if (completed && res.statusCode === 401) {
                row.failures++;
                row.expiresAt = now()+WINDOW_MS;
                if (row.failures >= 10 && !row.blockedUntil) row.blockedUntil=now()+WINDOW_MS;
            } else if (!row.failures && !row.pending) attempts.delete(key);
        };
        res.once('finish', () => finish(true));
        res.once('close', () => finish(false));
        next();
    };
}
module.exports = { createLoginFailureLimiter };
