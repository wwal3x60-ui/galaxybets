'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql, doTransaction } = require('../database');
const { firstEligibleBetId } = require('../utils/affiliate-config');
const { creditAffiliateCommission } = require('../utils/affiliate-commission');

// Run with the backend stopped. Dry-run by default; --apply credits only
// missing completed bets. The betId primary key makes reruns safe.
async function main() {
    const apply = process.argv.includes('--apply');
    if (!apply) {
        const [[summary]] = await sql.query(
            `SELECT COUNT(*) AS missingEligibleBets,
                    CAST(COALESCE(SUM(b.edge * 0.0300), 0) AS CHAR) AS pendingCommission
             FROM bets b
             JOIN affiliates a ON a.userId = b.userId
             JOIN users p ON p.id = b.userId JOIN users r ON r.id = a.affiliateId
             WHERE b.id >= ? AND b.completed = 1 AND b.edge > 0
               AND b.createdAt >= a.createdAt AND b.id >= a.firstBetId
               AND a.affiliateId <> a.userId AND p.role <> 'BOT' AND r.role <> 'BOT'
               AND NOT EXISTS (SELECT 1 FROM affiliateCommissions ac WHERE ac.betId = b.id)`,
            [firstEligibleBetId]
        );
        console.log('Read-only preview of missing commissions:', summary);
        return;
    }
    let cursor = '0';
    const counts = {};
    while (true) {
        const [bets] = await sql.query(
            `SELECT CAST(b.id AS CHAR) AS id FROM bets b
             WHERE b.id >= ? AND b.id > ? AND b.completed = 1
               AND NOT EXISTS (SELECT 1 FROM affiliateCommissions ac WHERE ac.betId = b.id)
             ORDER BY b.id ASC LIMIT 250`, [firstEligibleBetId, cursor]
        );
        if (!bets.length) break;
        for (const bet of bets) {
            const result = await doTransaction(async (connection, commit) => {
                const value = await creditAffiliateCommission(connection, bet.id);
                await commit();
                return value;
            });
            counts[result.status] = (counts[result.status] || 0) + 1;
            cursor = bet.id;
        }
    }
    console.log('Applied missing commissions:', counts);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => sql.end());
