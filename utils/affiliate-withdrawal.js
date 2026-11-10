'use strict';
const { positiveId, units, decimal } = require('./affiliate-commission');
const minDepositors = 8;
const minClaim = 5;

function failure(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

// Lifetime distinct referred players with a positive approved deposit made
// after linking this referral. Pending/rejected deposits and bots never count.
async function getQualifiedDepositors(connection, userId) {
    const [[row]] = await connection.query(
        `SELECT COUNT(DISTINCT a.userId) AS count
         FROM affiliates a
         JOIN users player ON player.id = a.userId
         WHERE a.affiliateId = ? AND a.userId <> a.affiliateId
           AND player.role <> 'BOT'
           AND EXISTS (
               SELECT 1 FROM transactions t
               WHERE t.userId = a.userId AND t.type = 'crypto_deposit'
                 AND t.status = 'approved' AND t.amount > 0
                 AND t.createdAt >= a.createdAt
           )`, [positiveId(userId)]
    );
    return Number(row.count);
}

// Must be called inside one transaction. Lock order matches settlement:
// owner user, then wallet. Never credit or send balance events before commit.
async function withdrawAffiliateEarnings(connection, userId, requestKey) {
    const id = positiveId(userId);
    if (typeof requestKey !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(requestKey)) {
        throw failure('INVALID_REQUEST_ID');
    }
    const [[user]] = await connection.query(
        'SELECT id, role, banned, accountLock, sponsorLock FROM users WHERE id = ? FOR UPDATE', [id]
    );
    if (!user || user.role === 'BOT' || user.banned || user.accountLock || user.sponsorLock) {
        throw failure('ACCOUNT_LOCKED');
    }
    const [[existing]] = await connection.query(
        `SELECT CAST(id AS CHAR) AS id, CAST(amount AS CHAR) AS amount
         FROM affiliateWithdrawals WHERE userId = ? AND requestKey = ?`, [id, requestKey]
    );
    if (existing) return { withdrawalId: existing.id, amount: existing.amount, reused: true };

    await connection.query(
        `INSERT INTO affiliateWallets (userId, remainder) VALUES (?, 0)
         ON DUPLICATE KEY UPDATE userId = userId`, [id]
    );
    const [[wallet]] = await connection.query(
        'SELECT CAST(available AS CHAR) AS available FROM affiliateWallets WHERE userId = ? FOR UPDATE', [id]
    );
    const available = units(wallet.available, 2);
    if (available < BigInt(minClaim) * 100n) throw failure('MIN_WITHDRAWAL');
    const qualifiedDepositors = await getQualifiedDepositors(connection, id);
    if (qualifiedDepositors < minDepositors) throw failure('NOT_ENOUGH_DEPOSITORS');

    const amount = decimal(available, 2);
    await connection.query(
        'INSERT INTO affiliateWithdrawals (userId, amount, requestKey, qualifiedDepositors) VALUES (?, ?, ?, ?)', [id, amount, requestKey, qualifiedDepositors]
    );
    // Read as CHAR so large IDs are never rounded by the driver.
    const [[withdrawal]] = await connection.query(
        'SELECT CAST(id AS CHAR) AS id FROM affiliateWithdrawals WHERE userId = ? AND requestKey = ?', [id, requestKey]
    );
    await connection.query('UPDATE affiliateWallets SET available = 0 WHERE userId = ?', [id]);
    const [credit] = await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, id]);
    if (credit.affectedRows !== 1) throw new Error('Affiliate withdrawal user not found');
    await connection.query(
        `INSERT INTO transactions (userId, amount, type, method, methodId)
         VALUES (?, ?, 'in', 'affiliate_withdrawal', ?)`, [id, amount, withdrawal.id]
    );
    return { withdrawalId: withdrawal.id, amount, qualifiedDepositors, reused: false };
}

module.exports = { getQualifiedDepositors, withdrawAffiliateEarnings, minDepositors, minClaim };
