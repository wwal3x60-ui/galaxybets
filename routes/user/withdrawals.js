const express = require('express');
const router = express.Router();

const { sql, doTransaction } = require('../../database');
const { isAuthed, apiLimiter } = require('../auth/functions');
const { withdrawalCryptoLimiter } = require('./limiters');

const { coins, validAddress } = require('../../utils/withdrawal-coins');
const crypto = require('crypto');

router.post('/crypto', withdrawalCryptoLimiter, isAuthed, apiLimiter, async (req, res) => {
    const { amount, coin: rawCoin, address: rawAddress, requestId } = req.body || {};
    const coin = String(rawCoin || "").trim().toUpperCase();
    const address = typeof rawAddress === "string" ? rawAddress.trim() : "";

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
        return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }
    if (!Object.hasOwn(coins, coin)) return res.status(400).json({ error: 'INVALID_COIN' });
    if (!validAddress(coin, address)) {
        return res.status(400).json({ error: 'INVALID_ADDRESS' });
    }

    if (requestId !== undefined && !/^[A-Za-z0-9_-]{16,64}$/.test(String(requestId))) {
        return res.status(400).json({ error: 'INVALID_REQUEST_ID' });
    }
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify([amount,coin,address])).digest('hex');
    try {
        const [[u]]=await sql.query('SELECT role,banned,accountLock FROM users WHERE id=?',[req.userId]);if(!u||String(u.role).trim().toUpperCase()==='BOT'||u.banned||u.accountLock)return res.status(403).json({error:'WITHDRAWAL_RESTRICTED'});
        let transactionId;
        const hasBalance = await doTransaction(async (connection, commit) => {
            if (requestId) {
                await connection.query("INSERT INTO communityRequests(userId,requestId,kind,payloadHash) VALUES (?,?,'withdrawal',?) ON DUPLICATE KEY UPDATE requestId=requestId",[req.userId,requestId,payloadHash]);
                const [[saved]] = await connection.query('SELECT kind,payloadHash,result FROM communityRequests WHERE userId=? AND requestId=? FOR UPDATE',[req.userId,requestId]);
                if (saved.kind !== 'withdrawal' || saved.payloadHash !== payloadHash) throw Object.assign(new Error('REQUEST_ID_REUSED'),{status:409});
                if (saved.result) {
                    const result = typeof saved.result === 'string' ? JSON.parse(saved.result) : saved.result;
                    transactionId = result.transactionId;
                    await commit();
                    return true;
                }
            }
            const [[account]] = await connection.query('SELECT role,banned,accountLock,wagerRequirement,wagerProgress FROM users WHERE id=? FOR UPDATE',[req.userId]);
            if (!account || String(account.role).trim().toUpperCase()==='BOT' || account.banned || account.accountLock) throw Object.assign(new Error('WITHDRAWAL_RESTRICTED'),{status:403});
            if (Number(account.wagerProgress)<Number(account.wagerRequirement)) throw Object.assign(new Error('WAGER_REQUIREMENT_NOT_MET'),{status:403});

            const [updateResult] = await connection.query(
                "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ? AND role <> 'BOT' AND banned=0 AND accountLock=0",
                [amount, req.userId, amount]
            );
            if (updateResult.affectedRows !== 1) return false;

            const [insertResult] = await connection.query(
                'INSERT INTO transactions (userId, amount, type, method, coin, methodId, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.userId, amount, 'crypto_withdraw', 'crypto_manual', coin, address.trim(), 'pending']
            );
            transactionId = insertResult.insertId;
            if (requestId) await connection.query('UPDATE communityRequests SET result=? WHERE userId=? AND requestId=?',[JSON.stringify({transactionId:String(transactionId)}),req.userId,requestId]);
            await commit();
            return true;
        });

        if (!hasBalance) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
        return res.json({ success: true, transactionId });
    } catch (error) {
        if (error.status) return res.status(error.status).json({error:error.message});
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
            "SELECT id, amount, coin, COALESCE(methodId, txHash) AS address, status, createdAt FROM transactions WHERE userId = ? AND type = 'crypto_withdraw' ORDER BY id DESC LIMIT ? OFFSET ?",
            [req.userId, limit, offset]
        );
        return res.json({ items, total, hasMore: offset + items.length < total });
    } catch (error) {
        console.error('WITHDRAWAL LIST ERROR:', error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
});

module.exports = router;
