require('dotenv').config({ quiet: true });

const { sql } = require('../database');

const features = [
    ['cases', 1],
    ['battles', 1],
    ['chat', 1],
    ['leaderboard', 1],
    ['affiliates', 0],
    ['blackjack', 0],
    ['coinflip', 0],
    ['crash', 0],
    ['cryptoDeposits', 0],
    ['cryptoWithdrawals', 0],
    ['jackpot', 0],
    ['mines', 0],
    ['promoCodes', 0],
    ['rain', 0],
    ['rakeback', 0],
    ['roulette', 0],
    ['tips', 0]
];

async function main() {
    const [result] = await sql.query(
        'INSERT IGNORE INTO features (id, enabled) VALUES ?',
        [features]
    );
    const inserted = result.affectedRows;
    const existed = features.length - inserted;

    console.log(`Inserted: ${inserted}; already existed: ${existed}`);
}

main()
    .catch(error => {
        console.error('Feature seed failed:', error.code || error.name || 'unknown error');
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await sql.end();
        } catch (error) {
            console.error('Failed to close feature seed database pool:', error.code || error.name || 'unknown error');
            process.exitCode = 1;
        }
        process.stdout.write('', () => process.exit(process.exitCode || 0));
    });
