require('dotenv').config({ quiet: true });

const fs = require('fs');
const mysql = require('mysql2/promise');

const filePath = 'db/missing-tables.sql';
const createTablePattern = /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?([A-Za-z0-9_]+)`?\s*\(/i;

function databaseConnection() {
    return mysql.createConnection({
        host: process.env.SQL_HOST || 'localhost',
        port: Number(process.env.SQL_PORT || 3306),
        user: process.env.SQL_USER,
        database: process.env.SQL_DB,
        password: process.env.SQL_PASS,
        connectTimeout: 20000,
        ssl: process.env.SQL_CA
            ? { ca: process.env.SQL_CA, rejectUnauthorized: true }
            : { rejectUnauthorized: false }
    });
}

function getStatements() {
    return fs.readFileSync(filePath, 'utf8')
        .split(';')
        .map(statement => statement.trim())
        .filter(Boolean);
}

async function main() {
    const statements = getStatements();
    const tables = statements.map(statement => {
        const match = createTablePattern.exec(statement);
        if (!match) throw new Error('missing-tables.sql contains a non-CREATE TABLE statement');
        return match[1];
    });
    const connection = await databaseConnection();

    try {
        for (let index = 0; index < statements.length; index++) {
            const [existingRows] = await connection.query('SHOW TABLES LIKE ?', [tables[index]]);
            if (existingRows.length) continue;

            await connection.query(statements[index]);
            console.log(`Created table: ${tables[index]}`);
        }
    } finally {
        await connection.end();
    }
}

main().catch(() => {
    console.error('Applying missing database tables failed.');
    process.exitCode = 1;
});
