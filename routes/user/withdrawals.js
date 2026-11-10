const express = require('express');
const router = express.Router();

const { sql, doTransaction } = require('../../database');
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
        const [[u]]=await sql.query('SELECT role,banned,accountLock FROM users WHERE id=?',[req.userId]);if(!u||String(u.role).trim().toUpperCase()==='BOT'||u.banned||u.accountLock)return res.status(403).json({error:'WITHDRAWAL_RESTRICTED'});
        let transactionId;
        const hasBalance = await doTransaction(async (connection, commit) => {
            const [updateResult] = await connection.query(
                "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ? AND role <> 'BOT' AND banned=0 AND accountLock=0",
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

// List of the logged-in user's crypto withdrawals (for the Withdrawals history page)
router.get('/', isAuthed, async (req, res) => {
    try {
        let limit = parseInt(req.query.limit);
        limit = !isNaN(limit) && limit > 0 ? Math.min(limit, 50) : 10;
        let offset = parseInt(req.query.offset);
        offset = !isNaN(offset) && offset >= 0 ? offset : 0;

        const [[{ total }]] = await sql.query(
            "SELECT COUNT(*) AS total FROM transactions WHERE userId = ? AND type = 'crypto_withdraw'",
            [req.userId]
        );
        const [items] = await sql.query(
            "SELECT id, amount, coin, txHash AS address, status, createdAt FROM transactions WHERE userId = ? AND type = 'crypto_withdraw' ORDER BY id DESC LIMIT ? OFFSET ?",
            [req.userId, limit, offset]
        );
        return res.json({ items, total, hasMore: offset + items.length < total });
    } catch (error) {
        console.error('WITHDRAWAL LIST ERROR:', error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
});

module.exports = router;
