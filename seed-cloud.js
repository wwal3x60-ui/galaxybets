const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const readline = require('readline');
const { items: catalogueItems } = require('./utils/catalog/items');
const { toCents } = require('./utils/money');
const cases = require('./utils/cases.json');

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function validateSource() {
    const itemSlots = cases.reduce((total, caseInfo) => total + caseInfo.items.length, 0);
    if (cases.length !== 35 || itemSlots !== 262) {
        throw new Error(`Unexpected case source size: ${cases.length} cases and ${itemSlots} item slots`);
    }

    for (const caseInfo of cases) {
        const slug = slugify(caseInfo.name);
        if (!fs.existsSync(path.join(__dirname, 'public', 'cases', `${slug}.png`))) {
            throw new Error(`Missing local case image for ${slug}`);
        }

        const ranges = new Set();
        for (const item of caseInfo.items) {
            const id = String(item.id);
            const range = `${item.rangeFrom}:${item.rangeTo}`;
            if (!catalogueItems[id]) throw new Error(`Missing catalogue item ${id}`);
            if (!fs.existsSync(path.join(__dirname, 'public', 'items', `${id}.png`))) {
                throw new Error(`Missing local item image for ${id}`);
            }
            if (ranges.has(range)) throw new Error(`Duplicate item range ${range} in ${slug}`);
            ranges.add(range);
        }
    }

    return itemSlots;
}

async function ensureTables(connection) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS cases (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(128) NOT NULL,
            slug VARCHAR(128) NOT NULL,
            img VARCHAR(512) NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_cases_slug (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS caseVersions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            caseId BIGINT UNSIGNED NOT NULL,
            price BIGINT UNSIGNED NOT NULL DEFAULT 0,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            endedAt DATETIME NULL,
            PRIMARY KEY (id),
            KEY idx_caseVersions_case_ended_id (caseId, endedAt, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS caseItems (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            caseVersionId BIGINT UNSIGNED NOT NULL,
            robloxId BIGINT UNSIGNED NOT NULL,
            name VARCHAR(255) NOT NULL,
            img VARCHAR(512) NULL,
            price BIGINT UNSIGNED NOT NULL DEFAULT 0,
            robloxPrice BIGINT UNSIGNED NOT NULL DEFAULT 0,
            rangeFrom INT UNSIGNED NOT NULL,
            rangeTo INT UNSIGNED NOT NULL,
            PRIMARY KEY (id),
            KEY idx_caseItems_version_price (caseVersionId, price),
            KEY idx_caseItems_price (price),
            KEY idx_caseItems_version_range (caseVersionId, rangeFrom, rangeTo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await normalizeMoneyColumn(connection, 'caseVersions', 'price');
    await normalizeMoneyColumn(connection, 'caseItems', 'price');
    await normalizeMoneyColumn(connection, 'caseItems', 'robloxPrice');
}

async function normalizeMoneyColumn(connection, table, column) {
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
    const definition = columns.find(entry => entry.Field === column);
    if (!definition) throw new Error(`Missing ${table}.${column} column`);

    const type = definition.Type.toLowerCase();
    if (/^(decimal|float|double)/.test(type)) {
        await connection.query(`UPDATE \`${table}\` SET \`${column}\` = ROUND(\`${column}\` * 100)`);
    }
    if (!type.startsWith('bigint')) {
        await connection.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` BIGINT UNSIGNED NOT NULL DEFAULT 0`);
    }
}

async function seedData(connection) {
    let casesInserted = 0;
    let itemsInserted = 0;
    let caseItemRowsInserted = 0;

    await connection.beginTransaction();
    try {
        const [existingItemRows] = await connection.query('SELECT DISTINCT robloxId FROM caseItems');
        const countedItems = new Set(existingItemRows.map(row => String(row.robloxId)));

        for (const caseInfo of cases) {
            const slug = slugify(caseInfo.name);
            const caseImage = `/public/cases/${slug}.png`;
            const [[existingCase]] = await connection.query('SELECT id FROM cases WHERE slug = ?', [slug]);
            let caseId;

            if (existingCase) {
                caseId = existingCase.id;
                await connection.query('UPDATE cases SET name = ?, img = ? WHERE id = ?', [
                    caseInfo.name,
                    caseImage,
                    caseId
                ]);
            } else {
                const [insertedCase] = await connection.query(
                    'INSERT INTO cases (name, slug, img) VALUES (?, ?, ?)',
                    [caseInfo.name, slug, caseImage]
                );
                caseId = insertedCase.insertId;
                casesInserted++;
            }

            const [activeVersions] = await connection.query(
                'SELECT id FROM caseVersions WHERE caseId = ? AND endedAt IS NULL ORDER BY id DESC',
                [caseId]
            );
            let versionId;
            if (activeVersions.length) {
                versionId = activeVersions[0].id;
                await connection.query('UPDATE caseVersions SET price = ? WHERE id = ?', [
                    toCents(caseInfo.price),
                    versionId
                ]);
                if (activeVersions.length > 1) {
                    await connection.query(
                        'UPDATE caseVersions SET endedAt = NOW() WHERE caseId = ? AND endedAt IS NULL AND id <> ?',
                        [caseId, versionId]
                    );
                }
            } else {
                const [insertedVersion] = await connection.query(
                    'INSERT INTO caseVersions (caseId, price) VALUES (?, ?)',
                    [caseId, toCents(caseInfo.price)]
                );
                versionId = insertedVersion.insertId;
            }

            for (const item of caseInfo.items) {
                const id = String(item.id);
                const catalogueItem = catalogueItems[id];
                const values = [
                    id,
                    item.name || catalogueItem.name,
                    `/public/items/${id}.png`,
                    toCents(item.price),
                    toCents(item.robloxPrice || 0),
                    item.rangeFrom,
                    item.rangeTo
                ];
                const [[existingItem]] = await connection.query(
                    'SELECT id FROM caseItems WHERE caseVersionId = ? AND rangeFrom = ? AND rangeTo = ? ORDER BY id LIMIT 1',
                    [versionId, item.rangeFrom, item.rangeTo]
                );

                if (existingItem) {
                    await connection.query(
                        'UPDATE caseItems SET robloxId = ?, name = ?, img = ?, price = ?, robloxPrice = ?, rangeFrom = ?, rangeTo = ? WHERE id = ?',
                        [...values, existingItem.id]
                    );
                } else {
                    await connection.query(
                        'INSERT INTO caseItems (caseVersionId, robloxId, name, img, price, robloxPrice, rangeFrom, rangeTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [versionId, ...values]
                    );
                    caseItemRowsInserted++;
                    if (!countedItems.has(id)) {
                        itemsInserted++;
                        countedItems.add(id);
                    }
                }
            }
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    }

    return { casesInserted, itemsInserted, caseItemRowsInserted };
}

async function main() {
    const itemSlots = validateSource();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let password;
    try {
        password = await new Promise(resolve => rl.question('Enter your Aiven database password: ', resolve));
    } finally {
        rl.close();
    }

    const connection = await mysql.createConnection({
        host: 'mysql-3dd690bd-galaxybets.h.aivencloud.com',
        port: 11840,
        user: 'avnadmin',
        password,
        database: 'defaultdb',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await ensureTables(connection);
        const inserted = await seedData(connection);
        console.log(`Source: ${cases.length} cases and ${itemSlots} case-item slots`);
        console.log(`Inserted cases: ${inserted.casesInserted}`);
        console.log(`Inserted unique items: ${inserted.itemsInserted}`);
        console.log(`Inserted case-item rows: ${inserted.caseItemRowsInserted}`);
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    console.error('Cloud case seed failed:', error.message || error.code || error.name || 'unknown error');
    process.exitCode = 1;
});
