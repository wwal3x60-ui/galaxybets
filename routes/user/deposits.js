const express = require('express');
const router = express.Router();

const { sql } = require('../../database');
const { isAuthed, apiLimiter } = require('../auth/functions');
const { depositCryptoLimiter } = require('./limiters');

const allowedCoins = ['SOL', 'USDT', 'TRX', 'TRX (Tron)', 'LTC', 'DOGE', 'ETH', 'BNB', 'USDC'];

router.post('/crypto', depositCryptoLimiter, isAuthed, apiLimiter, async (req, res) => {
    console.log("DEPOSIT ROUTE HIT:", req.body);
    console.log("DEPOSIT REQUEST:", req.body, "USER:", req.userId);
    const { amount, coin, txHash } = req.body || {};
    const normalizedCoin = coin === 'TRX (Tron)' ? 'TRX' : coin;

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
        return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }
    if (!allowedCoins.includes(coin)) return res.status(400).json({ error: 'INVALID_COIN' });
    if (typeof txHash !== 'string' || !txHash.trim() || txHash.length > 255) {
        return res.status(400).json({ error: 'INVALID_TX_HASH' });
    }

    try {
        const [[existingTransaction]] = await sql.query(
            'SELECT id FROM transactions WHERE txHash = ? LIMIT 1',
            [txHash.trim()]
        );
        if (existingTransaction) return res.status(409).json({ error: 'TX_HASH_ALREADY_CLAIMED' });

        const [result] = await sql.query(
            'INSERT INTO transactions (userId, amount, type, method, coin, txHash, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.userId, amount, 'crypto_deposit', 'crypto_manual', normalizedCoin, txHash.trim(), 'pending']
        );

        return res.json({ success: true, transactionId: result.insertId });
    } catch (error) {
        console.error("DEPOSIT ERROR:", error);
        return res.status(500).json({ error: 'DEPOSIT_FAILED' });
    }
});

// List of the logged-in user's crypto deposits (for the Deposits history page)
router.get('/', isAuthed, async (req, res) => {
    try {
        const [rows] = await sql.query(
            "SELECT id, amount, coin, txHash, status, createdAt FROM transactions WHERE userId = ? AND type = 'crypto_deposit' ORDER BY id DESC LIMIT 200",
            [req.userId]
        );
        return res.json(rows);
    } catch (error) {
        console.error('DEPOSIT LIST ERROR:', error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
});

module.exports = router;
