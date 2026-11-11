const {MAX_BET_USD}=require('../../../utils/bet-limits');
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
    windowMs: 100, max: 1, message: { error: 'SLOW_DOWN' },
    standardHeaders: false, legacyHeaders: false,
    keyGenerator: (req, res) => req.userId
});
const { newBets } = require('../../../socketio/bets');
const { isAuthed } = require('../../auth/functions');
const { enabledFeatures, xpMultiplier } = require('../../admin/config');
const { generateMinePositions, calculateMultiplier, totalTiles, houseEdge } = require('./functions');
const io = require('../../../socketio/server');
const { sql, doTransaction } = require('../../../database');
const { roundDecimal, xpChanged } = require('../../../utils');
const { creditAffiliateGameBets, emitAffiliateCredits, withAffiliateSettlement } = require('../../../utils/affiliate-commission');

function parseJsonArray(value) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) throw new TypeError('Expected a JSON array from a Mines record');
    return parsed;
}
function publishBet(user, amount, payout) {
    void newBets([{ user, amount, edge: roundDecimal(amount * houseEdge), payout, game: 'mines' }])
        .catch(error => console.error('Mines bet broadcast failed:', error));
}

router.use(isAuthed);
router.get('/', async (req, res) => {
    const [[game]] = await sql.query(
        'SELECT minesCount, revealedTiles, amount FROM mines WHERE endedAt IS NULL AND userId = ?', [req.userId]
    );
    if (!game) return res.json({ activeGame: false });
    game.revealedTiles = parseJsonArray(game.revealedTiles);
    game.multiplier = calculateMultiplier(game.minesCount, game.revealedTiles.length);
    game.currentPayout = roundDecimal(game.amount * game.multiplier);
    res.json({ activeGame: game });
});

router.post('/start', apiLimiter, async (req, res) => {
    if (!enabledFeatures.mines) return res.status(400).json({ error: 'DISABLED' });
    let { amount, minesCount } = req.body;
    if (!Number.isInteger(minesCount) || minesCount < 1 || minesCount > totalTiles - 1) {
        return res.status(400).json({ error: 'INVALID_MINES_COUNT' });
    }
    if (!Number.isFinite(Number(amount))) return res.status(400).json({ error: 'MINES_MIN_BET' });
    amount = roundDecimal(amount);
    if (amount < 0.2) return res.status(400).json({ error: 'MINES_MIN_BET' });
    if (amount > MAX_BET_USD) return res.status(400).json({ error: 'MINES_MAX_BET' });
    try {
        await doTransaction(async (connection, commit) => {
            const [[user]] = await connection.query(
                `SELECT u.id, u.balance, u.xp, ss.seed AS serverSeed, ss.id AS ssId,
                        ss.nonce, cs.seed AS clientSeed, cs.id AS csId
                 FROM users u
                 JOIN serverSeeds ss ON ss.userId = u.id AND ss.endedAt IS NULL
                 JOIN clientSeeds cs ON cs.userId = u.id AND cs.endedAt IS NULL
                 WHERE u.id = ? FOR UPDATE`, [req.userId]
            );
            if (!user) return res.status(404).json({ error: 'UNKNOWN_ERROR' });
            const [[active]] = await connection.query(
                'SELECT id FROM mines WHERE userId = ? AND endedAt IS NULL FOR UPDATE', [req.userId]
            );
            if (active) return res.status(400).json({ error: 'MINES_GAME_ACTIVE' });
            if (amount > user.balance) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
            const nonce = user.nonce + 1;
            const positions = generateMinePositions(user.serverSeed, user.clientSeed, nonce, minesCount);
            const [nonceUpdate] = await connection.query('UPDATE serverSeeds SET nonce = nonce + 1 WHERE id = ?', [user.ssId]);
            if (nonceUpdate.affectedRows !== 1) throw new Error('Mines nonce update failed');
            const xp = roundDecimal(amount * xpMultiplier);
            await connection.query('UPDATE users SET balance = balance - ?, xp = xp + ? WHERE id = ?', [amount, xp, user.id]);
            const [game] = await connection.query(
                'INSERT INTO mines (userId, amount, clientSeedId, serverSeedId, nonce, minesCount, mines, revealedTiles) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [user.id, amount, user.csId, user.ssId, nonce, minesCount, JSON.stringify(positions), '[]']
            );
            await connection.query(
                'INSERT INTO bets (userId, amount, winnings, edge, game, gameId, completed) VALUES (?, ?, 0, ?, ?, ?, 0)',
                [user.id, amount, roundDecimal(amount * houseEdge), 'mines', game.insertId]
            );
            await xpChanged(user.id, user.xp, roundDecimal(user.xp + xp), connection);
            await commit();
            io.to(String(user.id)).emit('balance', 'set', roundDecimal(user.balance - amount));
            res.json({ success: true });
        });
    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

router.post('/reveal', apiLimiter, async (req, res) => {
    if (!enabledFeatures.mines) return res.status(400).json({ error: 'DISABLED' });
    const { field } = req.body;
    if (!Number.isInteger(field) || field < 0 || field >= totalTiles) return res.status(400).json({ error: 'INVALID_FIELD' });
    try {
        await withAffiliateSettlement(async (connection, commit) => {
            const [[game]] = await connection.query(
                'SELECT id, mines, revealedTiles, amount, minesCount FROM mines WHERE endedAt IS NULL AND userId = ? FOR UPDATE',
                [req.userId]
            );
            if (!game) return res.status(400).json({ error: 'NO_MINES_GAME_ACTIVE' });
            const tiles = parseJsonArray(game.revealedTiles);
            if (tiles.includes(field)) return res.status(400).json({ error: 'ALREADY_REVEALED' });
            const positions = parseJsonArray(game.mines);
            const isMine = positions.includes(field);
            tiles.push(field);
            if (isMine) {
                await connection.query('UPDATE mines SET endedAt = NOW(), payout = 0, revealedTiles = ? WHERE id = ?', [JSON.stringify(tiles), game.id]);
                await connection.query('UPDATE bets SET winnings = 0, completed = 1 WHERE game = ? AND gameId = ?', ['mines', game.id]);
                const [[user]] = await connection.query('SELECT id, username, role, xp, anon FROM users WHERE id = ?', [req.userId]);
                const credits = await creditAffiliateGameBets(connection, 'mines', [game.id]);
                await commit();
                emitAffiliateCredits(credits);
                publishBet(user, game.amount, 0);
                return res.json({ success: true, isMine, minePositions: positions, revealedTiles: tiles });
            }
            const multiplier = calculateMultiplier(game.minesCount, tiles.length);
            const payout = roundDecimal(game.amount * multiplier);
            if (tiles.length === totalTiles - game.minesCount) {
                return doPayout(connection, commit, game, multiplier, payout, req, res, tiles);
            }
            await connection.query('UPDATE mines SET revealedTiles = ? WHERE id = ?', [JSON.stringify(tiles), game.id]);
            await commit();
            res.json({ success: true, isMine, revealedTiles: tiles, multiplier, currentPayout: payout });
        });
    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

router.post('/cashout', apiLimiter, async (req, res) => {
    try {
        await withAffiliateSettlement(async (connection, commit) => {
            const [[game]] = await connection.query(
                'SELECT id, mines, revealedTiles, minesCount, amount FROM mines WHERE endedAt IS NULL AND userId = ? FOR UPDATE', [req.userId]
            );
            if (!game) return res.status(400).json({ error: 'NO_MINES_GAME_ACTIVE' });
            const tiles = parseJsonArray(game.revealedTiles);
            if (!tiles.length) return res.status(400).json({ error: 'NO_REVEALED_TILES' });
            const multiplier = calculateMultiplier(game.minesCount, tiles.length);
            return doPayout(connection, commit, game, multiplier, roundDecimal(game.amount * multiplier), req, res);
        });
    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

async function doPayout(connection, commit, game, multiplier, payout, req, res, tiles) {
    if (tiles) {
        await connection.query('UPDATE mines SET endedAt = NOW(), payout = ?, revealedTiles = ? WHERE id = ?', [payout, JSON.stringify(tiles), game.id]);
    } else {
        await connection.query('UPDATE mines SET endedAt = NOW(), payout = ? WHERE id = ?', [payout, game.id]);
    }
    await connection.query('UPDATE bets SET winnings = ?, completed = 1 WHERE game = ? AND gameId = ?', [payout, 'mines', game.id]);
    const [[user]] = await connection.query('SELECT id, username, balance, role, xp, anon FROM users WHERE id = ? FOR UPDATE', [req.userId]);
    const balance = roundDecimal(user.balance + payout);
    await connection.query('UPDATE users SET balance = ? WHERE id = ?', [balance, user.id]);
    const credits = await creditAffiliateGameBets(connection, 'mines', [game.id]);
    await commit();
    io.to(String(user.id)).emit('balance', 'set', balance);
    emitAffiliateCredits(credits);
    publishBet(user, game.amount, payout);
    res.json({ success: true, payout, multiplier, minePositions: parseJsonArray(game.mines) });
}

module.exports = router;