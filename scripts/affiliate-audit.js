'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql } = require('../database');
const { firstEligibleBetId } = require('../utils/affiliate-config');

async function main() {
    const checks = {
        invalidCommissions: `SELECT COUNT(*) AS count FROM affiliateCommissions
            WHERE commissionRate <> 0.0300 OR commissionAmount <> edgeAmount * 0.0300
               OR balanceCredit < 0 OR betId < ${firstEligibleBetId}`,
        invalidWallets: `SELECT COUNT(*) AS count FROM affiliateWallets
            WHERE remainder < 0 OR remainder >= 0.01000000 OR available < 0`,
        mismatchedWallets: `SELECT COUNT(*) AS count FROM (
            SELECT affiliateId AS userId FROM affiliateCommissions
            UNION SELECT userId FROM affiliateWallets
            UNION SELECT userId FROM affiliateWithdrawals
        ) owners
        LEFT JOIN affiliateWallets aw ON aw.userId = owners.userId
        LEFT JOIN (
            SELECT affiliateId, SUM(commissionAmount) AS earned, SUM(balanceCredit) AS credited
            FROM affiliateCommissions GROUP BY affiliateId
        ) ac ON ac.affiliateId = owners.userId
        LEFT JOIN (
            SELECT userId, SUM(amount) AS claimed FROM affiliateWithdrawals GROUP BY userId
        ) w ON w.userId = owners.userId
        WHERE aw.userId IS NULL OR
            COALESCE(ac.earned, 0) - COALESCE(ac.credited, 0) - COALESCE(w.claimed, 0)
            <> aw.available + aw.remainder`,
        missingCredits: `SELECT COUNT(*) AS count FROM bets b
            JOIN affiliates a ON a.userId = b.userId
            JOIN users p ON p.id = b.userId JOIN users r ON r.id = a.affiliateId
            WHERE b.completed = 1 AND b.edge > 0 AND b.id >= ${firstEligibleBetId}
              AND b.id >= a.firstBetId AND b.createdAt >= a.createdAt
              AND a.userId <> a.affiliateId AND p.role <> 'BOT' AND r.role <> 'BOT'
              AND NOT EXISTS (SELECT 1 FROM affiliateCommissions ac WHERE ac.betId = b.id)`,
        invalidWithdrawals: `SELECT COUNT(*) AS count FROM affiliateWithdrawals
            WHERE amount < 5.00 OR qualifiedDepositors < 8`,
        missingWithdrawalHistory: `SELECT COUNT(*) AS count FROM affiliateWithdrawals w
            WHERE (SELECT COUNT(*) FROM transactions t
                   WHERE t.method = 'affiliate_withdrawal' AND CAST(t.methodId AS BINARY) = CAST(w.id AS BINARY)
                     AND t.userId = w.userId AND t.amount = w.amount
                     AND t.type = 'in' AND t.status = 'approved') <> 1`,
        orphanWithdrawalHistory: `SELECT COUNT(*) AS count FROM transactions t
            WHERE t.method = 'affiliate_withdrawal' AND NOT EXISTS (
                SELECT 1 FROM affiliateWithdrawals w WHERE CAST(w.id AS BINARY) = CAST(t.methodId AS BINARY)
                  AND w.userId = t.userId AND w.amount = t.amount
            )`
    };
    const results = {};
    for (const [name, query] of Object.entries(checks)) {
        const [[result]] = await sql.query(query);
        results[name] = Number(result.count);
    }
    const [[summary]] = await sql.query(
        `SELECT COUNT(*) AS recordedBets,
                CAST(COALESCE(SUM(commissionAmount), 0) AS CHAR) AS earned,
                CAST(COALESCE(SUM(balanceCredit), 0) AS CHAR) AS previouslyAutoCredited,
                (SELECT CAST(COALESCE(SUM(amount), 0) AS CHAR) FROM affiliateWithdrawals) AS manuallyWithdrawn,
                (SELECT CAST(COALESCE(SUM(available), 0) AS CHAR) FROM affiliateWallets) AS available,
                (SELECT CAST(COALESCE(SUM(remainder), 0) AS CHAR) FROM affiliateWallets) AS fractionalCarry
         FROM affiliateCommissions`
    );
    console.table(results);
    console.log(summary);
    if (!Number(summary.recordedBets)) console.log('No commission has been recorded yet.');
    if (Object.values(results).some(Boolean)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => sql.end());
