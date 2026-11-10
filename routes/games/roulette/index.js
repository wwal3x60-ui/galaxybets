const {MAX_BET_USD}=require('../../../utils/bet-limits');
const express = require('express');
const router = express.Router();

const { doTransaction } = require('../../../database');
const { isAuthed, apiLimiter } = require('../../auth/functions');
const { roundDecimal, xpChanged } = require('../../../utils');
const io = require('../../../socketio/server');
const { roulette } = require('./functions');
const { enabledFeatures, xpMultiplier } = require('../../admin/config');

router.use((req, res, next) => {
    if (!enabledFeatures.roulette) {
        return res.status(400).json({ error: 'DISABLED' });
    }

    next();
});

router.post('/bet', isAuthed, apiLimiter, async (req, res) => {
    if (
        roulette.spinning ||
        roulette.timeLeft < 1 ||
        roulette.round.rolledAt
    ) {
        return res.json({ error: 'ALREADY_STARTED' });
    }

    const color = req.body.color;

    if (![0, 1, 2, 3].includes(color)) {
        return res.json({ error: 'INVALID_COLOR' });
    }

    const maxBet = MAX_BET_USD;

    const amount = roundDecimal(req.body.amount);

    if (!Number.isFinite(amount) || amount < 0.2) {
        return res.json({ error: 'INVALID_AMOUNT' });
    }

    if (amount > maxBet) {
        return res.json({ error: 'MAX_BET_ROULETTE' });
    }

    try {
        await doTransaction(async (connection, commit) => {
            const [[currentRound]] = await connection.query(
                'SELECT rolledAt FROM roulette WHERE id = ? FOR UPDATE',
                [roulette.round.id]
            );

            if (
                !currentRound ||
                currentRound.rolledAt ||
                roulette.spinning ||
                roulette.timeLeft < 1
            ) {
                return res.json({ error: 'ALREADY_STARTED' });
            }

            const [[user]] = await connection.query(
                `SELECT id, username, balance, xp, perms, sponsorLock, anon
                 FROM users
                 WHERE id = ?
                 FOR UPDATE`,
                [req.userId]
            );

            if (user.balance < amount) {
                return res.json({ error: 'INSUFFICIENT_BALANCE' });
            }

            const [[stake]]=await connection.query('SELECT COALESCE(SUM(amount),0) AS total FROM rouletteBets WHERE roundId=? AND userId=?',[roulette.round.id,user.id]);
            if(Math.round(Number(stake.total)*100)+Math.round(amount*100)>MAX_BET_USD*100)return res.json({error:'MAX_BET_ROULETTE'});
            const xp = roundDecimal(amount * xpMultiplier);

            await connection.query(
                'UPDATE users SET balance = balance - ?, xp = xp + ? WHERE id = ?',
                [amount, xp, user.id]
            );

            await xpChanged(
                user.id,
                user.xp,
                roundDecimal(user.xp + xp),
                connection
            );

            // Green and red remain mutually exclusive.
            // Gold and comet can accompany either color.
            if (color === 1 || color === 2) {
                const oppositeExists = roulette.bets.find(
                    bet =>
                        bet.user.id === user.id &&
                        bet.color === (color == 1 ? 2 : 1)
                );

                if (oppositeExists) {
                    return res.json({
                        error: 'ALREADY_BET_ON_OTHER_COLOR'
                    });
                }
            }

            const existing = roulette.bets.find(
                bet => bet.user.id === user.id && bet.color === color
            );

            if (existing) {
                {
                    if (existing.amount + amount > maxBet) {
                        return res.json({
                            error: 'MAX_BET_ROULETTE'
                        });
                    }
                }

                await connection.query(
                    'UPDATE rouletteBets SET amount = amount + ? WHERE id = ?',
                    [amount, existing.id]
                );

                await connection.query(
                    `UPDATE bets
                     SET amount = amount + ?
                     WHERE userId = ? AND game = ? AND gameId = ?`,
                    [amount, user.id, 'roulette', existing.id]
                );

                await commit();

                existing.amount += amount;

                io.to('roulette').emit('roulette:bet:update', {
                    id: existing.id,
                    amount: existing.amount
                });
            } else {
                const [rouletteBetResult] = await connection.query(
                    `INSERT INTO rouletteBets
                     (userId, roundId, color, amount)
                     VALUES (?, ?, ?, ?)`,
                    [user.id, roulette.round.id, color, amount]
                );

                await connection.query(
                    `INSERT INTO bets
                     (userId, amount, edge, game, gameId, completed)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        user.id,
                        amount,
                        roundDecimal(amount * 0.05),
                        'roulette',
                        rouletteBetResult.insertId,
                        false
                    ]
                );

                await commit();

                const bet = {
                    id: rouletteBetResult.insertId,
                    user: {
                        id: user.id,
                        username: user.username,
                        xp: user.xp,
                        anon: user.anon
                    },
                    color,
                    amount
                };

                roulette.bets.push(bet);
                io.to('roulette').emit('roulette:bets', [bet]);
            }

            io.to(user.id).emit(
                'balance',
                'set',
                roundDecimal(user.balance - amount)
            );

            res.json({ success: true });
        });
    } catch (error) {
        console.error(error);
        res.json({ error: 'INTERNAL_ERROR' });
    }
});

module.exports = router;