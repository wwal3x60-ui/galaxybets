require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

async function main() {
    console.log("\n=== GalaxyBets Admin Password Reset ===\n");
    const dbPass = await ask("1. Enter your Aiven Database Password: ");
    const email = await ask("2. Enter your Admin Email: ");
    const newPass = await ask("3. Enter your NEW Password: ");

    console.log("\nProcessing...");
    const hash = await bcrypt.hash(newPass, 12);
    
    const connection = await mysql.createConnection({
        host: 'mysql-3dd690bd-galaxybets.h.aivencloud.com',
        port: 11840,
        user: 'avnadmin',
        password: dbPass,
        database: 'defaultdb',
        ssl: { rejectUnauthorized: false }
    });

    const [result] = await connection.query(
        'UPDATE users SET passwordHash = ? WHERE email = ?',
        [hash, email]
    );

    if (result.affectedRows > 0) {
        console.log(`\n✅ Success! Password updated for ${email}\n`);
    } else {
        console.log(`\n❌ User with email ${email} not found.\n`);
    }

    await connection.end();
    rl.close();
}
main().catch(console.error);