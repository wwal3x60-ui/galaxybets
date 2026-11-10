'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql } = require('../database');
const catalog = require('../utils/galaxy-named-drops.json');
const { validateNamedDrops } = require('../utils/named-drops-validator');
const { sameItems } = require('../utils/named-drops-migration');
async function main() {
    validateNamedDrops(catalog, path.join(__dirname, '..'));
    const errors = { missingPacks: 0, invalidVersion: 0, changedOpeningPrice: 0, mismatchedDrops: 0, invalidTicketCoverage: 0, invalidExpectedReturn: 0 };
    let installed = 0;
    for (const pack of catalog.packs) {
        const [[row]] = await sql.query('SELECT CAST(id AS CHAR) AS id FROM cases WHERE slug = ?', [pack.slug]);
        if (!row) { errors.missingPacks++; continue; }
        const [versions] = await sql.query('SELECT CAST(id AS CHAR) AS id, CAST(price AS CHAR) AS price FROM caseVersions WHERE caseId = ? AND endedAt IS NULL', [row.id]);
        if (versions.length !== 1) { errors.invalidVersion++; continue; }
        if (String(versions[0].price) !== String(pack.priceCents)) errors.changedOpeningPrice++;
        const [items] = await sql.query('SELECT name, img, CAST(price AS CHAR) AS price, CAST(robloxId AS CHAR) AS robloxId, rangeFrom, rangeTo FROM caseItems WHERE caseVersionId = ? ORDER BY rangeFrom', [versions[0].id]);
        if (!sameItems(items, pack.items)) errors.mismatchedDrops++; else installed++;
        let next = 1, total = 0n, gap = false;
        for (const item of items) {
            const first = Number(item.rangeFrom), last = Number(item.rangeTo);
            if (first !== next || last < first) gap = true;
            next = last + 1;
            total += BigInt(item.price) * BigInt(last - first + 1);
        }
        if (gap || next !== 100001) errors.invalidTicketCoverage++;
        if (total !== BigInt(pack.priceCents) * 90000n) errors.invalidExpectedReturn++;
    }
    console.table(errors); console.log({ installedPacks: installed, targetReturn: '90%', openingPrices: 'preserved' });
    if (Object.values(errors).some(Boolean)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => sql.end());
