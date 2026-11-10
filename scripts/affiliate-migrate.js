'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql } = require('../database');
const { firstEligibleBetId } = require('../utils/affiliate-config');

async function main() {
    const apply = process.argv.includes('--apply');
    const [duplicates] = await sql.query(
        'SELECT userId, COUNT(*) AS count FROM affiliates GROUP BY userId HAVING COUNT(*) > 1'
    );
    if (duplicates.length) {
        console.error('Duplicate referral relationships exist. No changes applied. Resolve these explicitly first.');
        console.table(duplicates);
        process.exitCode = 1;
        return;
    }
    const [columns] = await sql.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliates' AND COLUMN_NAME = 'firstBetId'`
    );
    const [indexes] = await sql.query(
        `SELECT INDEX_NAME FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliates' AND NON_UNIQUE = 0
         GROUP BY INDEX_NAME HAVING COUNT(*) = 1 AND MAX(COLUMN_NAME) = 'userId'`
    );
    console.log({ mode: apply ? 'apply' : 'audit', firstEligibleBetId,
        needsReferralBetBoundary: !columns.length, needsUniqueReferredUser: !indexes.length });
    if (!apply) return;
    if (!columns.length) await sql.query(
        'ALTER TABLE affiliates ADD COLUMN firstBetId BIGINT UNSIGNED NOT NULL DEFAULT 0'
    );
    if (!indexes.length) await sql.query(
        'ALTER TABLE affiliates ADD UNIQUE KEY uq_affiliates_userId (userId)'
    );
    // Old case openings omitted completed=1. Only repair post-cutoff openings
    // whose matching opening row proves the opening transaction committed.
    const [repair] = await sql.query(
        `UPDATE bets b SET b.completed = 1
         WHERE b.game = 'case' AND b.completed = 0 AND b.id >= ?
           AND EXISTS (
               SELECT 1 FROM caseOpenings co
               WHERE co.id = b.gameId AND co.userId = b.userId
           )`, [firstEligibleBetId]
    );
    console.log('Migration complete. Repaired case wager rows:', repair.affectedRows);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => sql.end());
