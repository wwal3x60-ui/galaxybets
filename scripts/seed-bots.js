require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const { sql } = require('../database');

const bots = [
    ['BotAtlas', 'bot-atlas@bots.invalid'],
    ['BotComet', 'bot-comet@bots.invalid'],
    ['BotNova', 'bot-nova@bots.invalid'],
    ['BotOrion', 'bot-orion@bots.invalid'],
    ['BotPulsar', 'bot-pulsar@bots.invalid'],
    ['BotAstra', 'bot-astra@bots.invalid'],
    ['BotDraco', 'bot-draco@bots.invalid'],
    ['BotEclipse', 'bot-eclipse@bots.invalid'],
    ['BotHelix', 'bot-helix@bots.invalid'],
    ['BotLumen', 'bot-lumen@bots.invalid'],
    ['BotQuasar', 'bot-quasar@bots.invalid'],
    ['BotVega', 'bot-vega@bots.invalid']
];

async function main() {
    let inserted = 0;
    let existed = 0;

    for (const [username, email] of bots) {
        const [[user]] = await sql.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (user) {
            existed++;
            continue;
        }

        const passwordHash = crypto.randomBytes(32).toString('hex');
        await sql.query(
            'INSERT INTO users (username, email, passwordHash, role, balance, xp, perms, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [username, email, passwordHash, 'BOT', 0, 0, 0, 0]
        );
        inserted++;
    }

    console.log(`Inserted: ${inserted}; already existed: ${existed}`);
}

main()
    .catch(error => {
        console.error('Bot seed failed:', error.code || error.name || 'unknown error');
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await sql.end();
        } catch (error) {
            console.error('Failed to close bot seed database pool:', error.code || error.name || 'unknown error');
            process.exitCode = 1;
        }
        process.stdout.write('', () => process.exit(process.exitCode || 0));
    });
