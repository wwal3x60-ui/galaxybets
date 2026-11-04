require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const { sql } = require('../database');

const leaderboardUsers = [
    ['CryptoWhale', 364.24],
    ['LuckyLuke', 322.77],
    ['AceOfSpades', 289.20],
    ['MoonWalker', 240.53],
    ['HighRoller99', 201.56],
    ['JackpotJohn', 198.56],
    ['NeonNight', 156.42],
    ['Vortex', 135.32],
    ['Gambit', 89.24]
];

async function main() {
    const connection = await sql.getConnection();
    let insertedUsers = 0;
    let insertedBets = 0;

    try {
        await connection.beginTransaction();

        for (const [username, wagered] of leaderboardUsers) {
            const email = `${username.toLowerCase()}@leaderboard-seed.invalid`;
            const [[existingUser]] = await connection.query(
                'SELECT id, email FROM users WHERE username = ?',
                [username]
            );

            let userId;
            if (existingUser) {
                if (existingUser.email !== email) {
                    throw new Error(`Username already belongs to a different account: ${username}`);
                }
                userId = existingUser.id;
            } else {
                const [userResult] = await connection.query(
                    'INSERT INTO users (username, email, passwordHash, role) VALUES (?, ?, ?, ?)',
                    [username, email, crypto.randomBytes(32).toString('hex'), 'USER']
                );
                userId = userResult.insertId;
                insertedUsers++;
            }

            const [[existingBet]] = await connection.query(
                "SELECT id FROM bets WHERE userId = ? AND game = 'leaderboard_seed' AND gameId = 0 ORDER BY id LIMIT 1",
                [userId]
            );

            if (existingBet) {
                await connection.query(
                    'UPDATE bets SET amount = ?, winnings = 0, edge = 0, completed = 1, createdAt = NOW() WHERE id = ?',
                    [wagered, existingBet.id]
                );
            } else {
                await connection.query(
                    "INSERT INTO bets (userId, amount, winnings, edge, game, gameId, completed, createdAt) VALUES (?, ?, 0, 0, 'leaderboard_seed', 0, 1, NOW())",
                    [userId, wagered]
                );
                insertedBets++;
            }
        }

        await connection.commit();
        console.log(`Created ${insertedUsers} users and ${insertedBets} seed bets; existing seed bets were refreshed.`);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

main()
    .catch(error => {
        console.error('Leaderboard seed failed:', error.code || error.message || 'unknown error');
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await sql.end();
        } catch (error) {
            console.error('Failed to close leaderboard seed database pool:', error.code || error.name || 'unknown error');
            process.exitCode = 1;
        }
        process.stdout.write('', () => process.exit(process.exitCode || 0));
    });
