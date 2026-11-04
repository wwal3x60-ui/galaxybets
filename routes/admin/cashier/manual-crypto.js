const express = require('express');
const router = express.Router();

const { sql, doTransaction } = require('../../../database');

router.get('/pending', async (req, res) => {
    try {
        const [transactions] = await sql.query(
            `SELECT transactions.id, transactions.userId, users.username, transactions.type,
                    transactions.amount, transactions.coin, transactions.txHash, transactions.status,
                    transactions.createdAt
             FROM transactions
             JOIN users ON users.id = transactions.userId
             WHERE transactions.status = ?
               AND transactions.type IN (?, ?)
             ORDER BY transactions.createdAt ASC, transactions.id ASC`,
            ['pending', 'crypto_deposit', 'crypto_withdraw']
        );
        return res.json({ data: transactions });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
});

router.post('/approve-deposit', async (req, res) => {
    const transactionId = Number((req.body || {}).transactionId);
    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
        return res.status(400).json({ error: 'INVALID_TRANSACTION_ID' });
    }

    try {
        const result = await doTransaction(async (connection, commit) => {
            const [[transaction]] = await connection.query(
                'SELECT id, userId, amount, type, status FROM transactions WHERE id = ? FOR UPDATE',
                [transactionId]
            );
            if (!transaction) return 'NOT_FOUND';
            if (transaction.status !== 'pending') return 'NOT_PENDING';
            if (transaction.type !== 'crypto_deposit') return 'INVALID_TYPE';

            const [creditResult] = await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [
                transaction.amount,
                transaction.userId
            ]);
            if (creditResult.affectedRows !== 1) throw new Error('Deposit user not found');
            await connection.query(
                'UPDATE transactions SET status = ? WHERE id = ?',
                ['approved', transaction.id]
            );
            await commit();
            return 'APPROVED';
        });

        if (result === 'NOT_FOUND') return res.status(404).json({ error: 'TRANSACTION_NOT_FOUND' });
        if (result === 'NOT_PENDING') return res.status(409).json({ error: 'TRANSACTION_NOT_PENDING' });
        if (result === 'INVALID_TYPE') return res.status(400).json({ error: 'INVALID_TRANSACTION_TYPE' });
        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
});

router.post('/approve-withdraw', async (req, res) => {
    const transactionId = Number((req.body || {}).transactionId);
    const txHash = (req.body || {}).txHash;
    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
        return res.status(400).json({ error: 'INVALID_TRANSACTION_ID' });
    }
    if (txHash !== undefined && (typeof txHash !== 'string' || !txHash.trim() || txHash.length > 255)) {
        return res.status(400).json({ error: 'INVALID_TX_HASH' });
    }

    try {
        const result = await doTransaction(async (connection, commit) => {
            const [[transaction]] = await connection.query(
                'SELECT id, type, status FROM transactions WHERE id = ? FOR UPDATE',
                [transactionId]
            );
            if (!transaction) return 'NOT_FOUND';
            if (transaction.status !== 'pending') return 'NOT_PENDING';
            if (transaction.type !== 'crypto_withdraw') return 'INVALID_TYPE';

            if (txHash === undefined) {
                await connection.query(
                    'UPDATE transactions SET status = ? WHERE id = ?',
                    ['approved', transaction.id]
                );
            } else {
                await connection.query(
                    'UPDATE transactions SET status = ?, txHash = ? WHERE id = ?',
                    ['approved', txHash.trim(), transaction.id]
                );
            }
            await commit();
            return 'APPROVED';
        });

        if (result === 'NOT_FOUND') return res.status(404).json({ error: 'TRANSACTION_NOT_FOUND' });
        if (result === 'NOT_PENDING') return res.status(409).json({ error: 'TRANSACTION_NOT_PENDING' });
        if (result === 'INVALID_TYPE') return res.status(400).json({ error: 'INVALID_TRANSACTION_TYPE' });
        return res.json({ success: true });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'TX_HASH_ALREADY_CLAIMED' });
        console.error(error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
});

router.post('/reject', async (req, res) => {
    const transactionId = Number((req.body || {}).transactionId);
    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
        return res.status(400).json({ error: 'INVALID_TRANSACTION_ID' });
    }

    try {
        const result = await doTransaction(async (connection, commit) => {
            const [[transaction]] = await connection.query(
                'SELECT id, userId, amount, type, status FROM transactions WHERE id = ? FOR UPDATE',
                [transactionId]
            );
            if (!transaction) return 'NOT_FOUND';
            if (transaction.status !== 'pending') return 'NOT_PENDING';
            if (!['crypto_deposit', 'crypto_withdraw'].includes(transaction.type)) return 'INVALID_TYPE';

            if (transaction.type === 'crypto_withdraw') {
                const [refundResult] = await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [
                    transaction.amount,
                    transaction.userId
                ]);
                if (refundResult.affectedRows !== 1) throw new Error('Withdrawal user not found');
            }
            await connection.query(
                'UPDATE transactions SET status = ? WHERE id = ?',
                ['rejected', transaction.id]
            );
            await commit();
            return 'REJECTED';
        });

        if (result === 'NOT_FOUND') return res.status(404).json({ error: 'TRANSACTION_NOT_FOUND' });
        if (result === 'NOT_PENDING') return res.status(409).json({ error: 'TRANSACTION_NOT_PENDING' });
        if (result === 'INVALID_TYPE') return res.status(400).json({ error: 'INVALID_TRANSACTION_TYPE' });
        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
});

module.exports = router;
