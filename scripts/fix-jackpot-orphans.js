require('dotenv').config({ quiet: true });

const { sql } = require('../database');

async function main() {
    const [rounds] = await sql.query(`
        SELECT j.id,
            SUM(CASE WHEN u.role = 'BOT' THEN 0 ELSE 1 END) AS realBets
        FROM jackpot j
        INNER JOIN jackpotBets jb ON jb.jackpotId = j.id
        INNER JOIN users u ON u.id = jb.userId
        WHERE j.endedAt IS NULL
        GROUP BY j.id
    `);

    const botOnlyRounds = rounds.filter(round => Number(round.realBets) === 0);
    const realUserRounds = rounds.filter(round => Number(round.realBets) > 0);

    if (botOnlyRounds.length) {
        await sql.query(
            'UPDATE jackpot SET endedAt = NOW() WHERE endedAt IS NULL AND id IN (?)',
            [botOnlyRounds.map(round => round.id)]
        );
    }

    console.log(`bot_only_rounds=${botOnlyRounds.length}`);
    console.log(`real_user_rounds=${realUserRounds.length}`);
    console.log(`finished_rounds=${botOnlyRounds.length}`);
}

main()
    .catch(error => {
        console.error('Jackpot orphan cleanup failed:', error.code || error.message || error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sql.end();
    });
