const {MAX_BET_USD}=require('../../../utils/bet-limits');
const express = require('express');
const router = express.Router();
const { doTransaction } = require('../../../database');
const { isAuthed, apiLimiter } = require('../../auth/functions');
const { roundDecimal, xpChanged } = require('../../../utils');
const io = require('../../../socketio/server');
const { crash, settleCrashCashout } = require('./functions');
const { enabledFeatures, xpMultiplier } = require('../../admin/config');

router.use((req, res, next) => {
    if (!enabledFeatures.crash) return res.status(400).json({ error: 'DISABLED' });
    next();
});

router.post('/bet', isAuthed, apiLimiter, async (req, res) => {
    const amount = roundDecimal(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0.2 || amount > MAX_BET_USD) return res.json({ error: 'INVALID_AMOUNT' });
    const point = req.body.autoCashoutPoint ? roundDecimal(req.body.autoCashoutPoint) : null;
    if (point !== null && (!Number.isFinite(point) || point < 1.01 || point > 100000)) {
        return res.json({ error: 'INVALID_CASHOUT' });
    }
    try {
        const roundId = crash.round.id;
        await doTransaction(async (connection, commit) => {
            const [[round]] = await connection.query(
                'SELECT startedAt, endedAt FROM crash WHERE id = ? FOR UPDATE', [roundId]
            );
            if (!round || round.startedAt || round.endedAt) return res.json({ error: 'ALREADY_STARTED' });
            const [[user]] = await connection.query(
                'SELECT id, username, role, balance, xp, anon FROM users WHERE id = ? FOR UPDATE', [req.userId]
            );
            if (!user) return res.status(404).json({ error: 'UNKNOWN_ERROR' });
            const [[joined]] = await connection.query(
                'SELECT id FROM crashBets WHERE roundId = ? AND userId = ? FOR UPDATE', [roundId, user.id]
            );
            if (joined) return res.json({ error: 'ALREADY_JOINED' });
            if (Number(user.balance) < amount) return res.json({ error: 'INSUFFICIENT_BALANCE' });
            const xp = roundDecimal(amount * xpMultiplier);
            await connection.query('UPDATE users SET balance = balance - ?, xp = xp + ? WHERE id = ?', [amount, xp, user.id]);
            const [result] = await connection.query(
                'INSERT INTO crashBets (userId, roundId, amount, autoCashoutPoint) VALUES (?, ?, ?, ?)',
                [user.id, roundId, amount, point]
            );
            await connection.query(
                'INSERT INTO bets (userId, amount, edge, game, gameId, completed) VALUES (?, ?, ?, ?, ?, 0)',
                [user.id, amount, roundDecimal(amount * 0.075), 'crash', result.insertId]
            );
            await xpChanged(user.id, user.xp, roundDecimal(user.xp + xp), connection);
            await commit();
            const bet = {
                id: result.insertId, amount, cashoutPoint: null, autoCashoutPoint: point,
                user: { id: user.id, username: user.username, role: user.role, xp: user.xp, anon: user.anon }
            };
            crash.bets.push(bet);
            io.to(String(user.id)).emit('balance', 'set', roundDecimal(user.balance - amount));
            io.to('crash').emit('crash:bets', [bet]);
            res.json({ success: true });
        });
    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

router.post('/cashout', isAuthed, apiLimiter, async (req, res) => {
    if (!crash.round.startedAt) return res.json({ error: 'NOT_STARTED' });
    if (crash.round.endedAt) return res.json({ error: 'ALREADY_ENDED' });
    const bet = crash.bets.find(row => String(row.user.id) === String(req.userId));
    if (!bet) return res.json({ error: 'NOT_JOINED' });
    const point = Number(crash.round.currentMultiplier);
    if (!point || point < 1.01) return res.json({ error: 'INVALID_CASHOUT' });
    if (Number(bet.cashoutPoint) > 0 || (bet.autoCashoutPoint && point >= Number(bet.autoCashoutPoint))) {
        return res.json({ error: 'ALREADY_CASHED_OUT' });
    }
    try {
        res.json(await settleCrashCashout(bet, point));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

module.exports = router;
