const express = require('express');
const router = express.Router();

const { doTransaction } = require('../../database');
const { isAuthed, apiLimiter } = require('../auth/functions');
const { withdrawalCryptoLimiter } = require('./limiters');

const allowedCoins = ['SOL', 'USDT'];

router.post('/crypto', withdrawalCryptoLimiter, isAuthed, apiLimiter, async (req, res) => {
    const { amount, coin, address } = req.body || {};

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
        return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }
    if (!allowedCoins.includes(coin)) return res.status(400).json({ error: 'INVALID_COIN' });
    if (typeof address !== 'string' || !address.trim() || address.length > 255) {
        return res.status(400).json({ error: 'INVALID_ADDRESS' });
    }

    try {
        let transactionId;
        const hasBalance = await doTransaction(async (connection, commit) => {
            const [updateResult] = await connection.query(
                'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
                [amount, req.userId, amount]
            );
            if (updateResult.affectedRows !== 1) return false;

            const [insertResult] = await connection.query(
                'INSERT INTO transactions (userId, amount, type, method, coin, txHash, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.userId, amount, 'crypto_withdraw', 'crypto_manual', coin, address.trim(), 'pending']
            );
            transactionId = insertResult.insertId;
            await commit();
            return true;
        });

        if (!hasBalance) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
        return res.json({ success: true, transactionId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'TX_HASH_ALREADY_CLAIMED' });
        }
        console.error(error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
});

module.exports = router;
