require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const sourceRoots = ['app.js', 'routes', 'socketio', 'utils', 'database'];
const tableReferencePattern = /\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+`?([A-Za-z0-9_]+)`?\b/gi;
const sqlStartPattern = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|WITH)\b/i;

function collectJavaScriptFiles(targetPath, files = []) {
    if (!fs.existsSync(targetPath)) return files;

    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
        for (const entry of fs.readdirSync(targetPath)) {
            collectJavaScriptFiles(path.join(targetPath, entry), files);
        }
    } else if (targetPath.endsWith('.js')) {
        files.push(targetPath);
    }

    return files;
}

function collectStringLiterals(source) {
    const literals = [];
    let quote = null;
    let value = '';
    let index = 0;

    while (index < source.length) {
        const character = source[index];
        const nextCharacter = source[index + 1];

        if (!quote && character === '/' && nextCharacter === '/') {
            index += 2;
            while (index < source.length && source[index] !== '\n') index++;
            continue;
        }

        if (!quote && character === '/' && nextCharacter === '*') {
            index += 2;
            while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++;
            index += 2;
            continue;
        }

        if (!quote && (character === "'" || character === '"' || character === '`')) {
            quote = character;
            value = '';
            index++;
            continue;
        }

        if (quote) {
            if (character === '\\') {
                value += character;
                if (index + 1 < source.length) value += source[++index];
            } else if (character === quote) {
                literals.push(value);
                quote = null;
            } else {
                value += character;
            }
        }

        index++;
    }

    return literals;
}

function collectReferencedTables() {
    const files = sourceRoots.flatMap(root => collectJavaScriptFiles(path.resolve(root)));
    const tables = new Map();

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        for (const literal of collectStringLiterals(source)) {
            if (!sqlStartPattern.test(literal)) continue;

            let match;
            tableReferencePattern.lastIndex = 0;
            while ((match = tableReferencePattern.exec(literal)) !== null) {
                const tableName = match[1];
                tables.set(tableName.toLowerCase(), tableName);
            }
        }
    }

    return tables;
}

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

async function main() {
    const referencedTables = collectReferencedTables();
    const connection = await databaseConnection();

    try {
        const [rows] = await connection.query('SHOW TABLES');
        const existingTables = new Set(
            rows.map(row => String(Object.values(row)[0]).toLowerCase())
        );
        const missingTables = [...referencedTables.entries()]
            .filter(([tableName]) => !existingTables.has(tableName))
            .map(([, tableName]) => tableName)
            .sort();

        console.log('Missing tables:');
        for (const tableName of missingTables) console.log(tableName);
    } finally {
        await connection.end();
    }
}

main().catch(() => {
    console.error('Database audit failed.');
    process.exitCode = 1;
});
