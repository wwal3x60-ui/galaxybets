require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { sql } = require('../database');
const { cacheCases } = require('../routes/games/cases/functions');
const { items: catalogueItems } = require('../utils/catalog/items');
const { toCents } = require('../utils/money');
const cases = require('../utils/cases.json');

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
        if (!fs.existsSync(path.join(__dirname, '..', 'public', 'cases', `${slug}.png`))) {
            throw new Error(`Missing local case image for ${slug}`);
        }

        const ranges = new Set();
        for (const item of caseInfo.items) {
            const id = String(item.id);
            const range = `${item.rangeFrom}:${item.rangeTo}`;
            if (!catalogueItems[id]) throw new Error(`Missing catalogue item ${id}`);
            if (!fs.existsSync(path.join(__dirname, '..', 'public', 'items', `${id}.png`))) {
                throw new Error(`Missing local item image for ${id}`);
            }
            if (ranges.has(range)) throw new Error(`Duplicate item range ${range} in ${slug}`);
            ranges.add(range);
        }
    }

    return itemSlots;
}

async function ensureTables() {
    await sql.query(`
        CREATE TABLE IF NOT EXISTS cases (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(128) NOT NULL,
            slug VARCHAR(128) NOT NULL,
            img VARCHAR(512) NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_cases_slug (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await sql.query(`
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
    await sql.query(`
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

    await normalizeMoneyColumn('caseVersions', 'price');
    await normalizeMoneyColumn('caseItems', 'price');
    await normalizeMoneyColumn('caseItems', 'robloxPrice');
}

async function normalizeMoneyColumn(table, column) {
    const [columns] = await sql.query(`SHOW COLUMNS FROM \`${table}\``);
    const definition = columns.find(entry => entry.Field === column);
    if (!definition) throw new Error(`Missing ${table}.${column} column`);

    const type = definition.Type.toLowerCase();
    if (/^(decimal|float|double)/.test(type)) {
        await sql.query(`UPDATE \`${table}\` SET \`${column}\` = ROUND(\`${column}\` * 100)`);
    }
    if (!type.startsWith('bigint')) {
        await sql.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` BIGINT UNSIGNED NOT NULL DEFAULT 0`);
    }
}

async function seedData() {
    const connection = await sql.getConnection();
    let casesInserted = 0;
    let itemsInserted = 0;
    let caseItemRowsInserted = 0;

    try {
        await connection.beginTransaction();

        const [existingItemRows] = await connection.query('SELECT DISTINCT robloxId FROM caseItems');
        const existingItemIds = new Set(existingItemRows.map(row => String(row.robloxId)));
        const countedItems = new Set(existingItemIds);

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
                const itemImage = `/public/items/${id}.png`;
                const values = [
                    id,
                    item.name || catalogueItem.name,
                    itemImage,
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
    } finally {
        connection.release();
    }

    return { casesInserted, itemsInserted, caseItemRowsInserted };
}

async function getCasesPreview() {
    const app = express();
    app.use('/cases', require('../routes/games/cases'));
    const server = await new Promise((resolve, reject) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
        instance.once('error', reject);
    });

    try {
        const address = server.address();
        const get = requestPath => new Promise((resolve, reject) => {
            http.get({ host: '127.0.0.1', port: address.port, path: requestPath }, res => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body }));
            }).on('error', reject);
        });
        const response = await get('/cases');
        if (response.status !== 200) throw new Error(`GET /cases returned ${response.status}`);

        const data = JSON.parse(response.body);
        const firstThree = data.slice(0, 3).map(({ id, name, slug, img, price, modifiedAt }) => ({
            id,
            name,
            slug,
            img,
            price,
            modifiedAt
        }));
        const detailResponse = await get(`/cases/${encodeURIComponent(firstThree[0].slug)}`);
        if (detailResponse.status !== 200) {
            throw new Error(`GET /cases/:slug returned ${detailResponse.status}`);
        }
        const detail = JSON.parse(detailResponse.body);
        if (!Array.isArray(detail.items)) throw new Error('Case detail response has no items');
        return { firstThree, detail };
    } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}

async function main() {
    const itemSlots = validateSource();
    if (!process.env.SQL_USER || !process.env.SQL_DB) {
        throw new Error('SQL_USER and SQL_DB must be configured');
    }

    await ensureTables();
    const inserted = await seedData();
    await cacheCases({ schedule: false });
    const preview = await getCasesPreview();
    const [[storedPrice]] = await sql.query(`
        SELECT cv.price FROM cases c
        INNER JOIN caseVersions cv ON c.id = cv.caseId AND cv.endedAt IS NULL
        WHERE c.slug = ?
        ORDER BY cv.id DESC LIMIT 1
    `, [preview.firstThree[0].slug]);

    console.log(`Source: ${cases.length} cases, ${itemSlots} item slots, ${Object.keys(catalogueItems).length} unique catalogue items`);
    console.log(`Inserted cases: ${inserted.casesInserted}`);
    console.log(`Inserted items: ${inserted.itemsInserted}`);
    console.log(`Inserted case-item rows: ${inserted.caseItemRowsInserted}`);
    console.log(`Stored ${preview.firstThree[0].slug} price: ${storedPrice.price} cents`);
    console.log('GET /cases status: 200');
    console.log('GET /cases first 3 entries:');
    console.log(JSON.stringify(preview.firstThree, null, 2));
    console.log(`GET /cases/${preview.firstThree[0].slug} status: 200; item slots: ${preview.detail.items.length}`);
}

main()
    .catch(error => {
        console.error('Case seed failed:', error.code || error.name || 'unknown error');
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await sql.end();
        } catch (error) {
            console.error('Failed to close case seed database pool:', error.code || error.name || 'unknown error');
            process.exitCode = 1;
        }
        process.stdout.write('', () => process.exit(process.exitCode || 0));
    });
