'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql } = require('../database');

// Stop the backend before --apply. No user balances or old ledger rows change.
async function main() {
    const apply = process.argv.includes('--apply');
    const [columns] = await sql.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'affiliatewallets' AND COLUMN_NAME = 'available'`
    );
    const [tables] = await sql.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'affiliatewithdrawals'`
    );
    console.log({ mode: apply ? 'apply' : 'audit', needsAvailableBalance: !columns.length, needsWithdrawalLedger: !tables.length });
    if (!apply) return;
    if (!columns.length) await sql.query(
        'ALTER TABLE affiliateWallets ADD COLUMN available DECIMAL(18,2) NOT NULL DEFAULT 0.00'
    );
    await sql.query(`CREATE TABLE IF NOT EXISTS affiliateWithdrawals (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        userId BIGINT UNSIGNED NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        requestKey VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        qualifiedDepositors INT UNSIGNED NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_affiliate_withdrawal_request (userId, requestKey),
        CONSTRAINT fk_affiliate_withdrawal_user FOREIGN KEY (userId) REFERENCES users(id),
        CONSTRAINT chk_affiliate_withdrawal_min CHECK (amount >= 5.00),
        CONSTRAINT chk_affiliate_withdrawal_depositors CHECK (qualifiedDepositors >= 8)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    console.log('Manual affiliate migration complete. Existing balances, credited commissions and fractional carry were preserved.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => sql.end());
