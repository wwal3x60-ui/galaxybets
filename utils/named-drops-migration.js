'use strict';
function sameItems(rows, expected) {
    return rows.length === expected.length && rows.every((row, i) => {
        const item = expected[i];
        return row.name === item.name && row.img === item.image && String(row.price) === String(item.valueCents) && String(row.robloxId) === String(item.catalogId) && Number(row.rangeFrom) === item.rangeFrom && Number(row.rangeTo) === item.rangeTo;
    });
}
async function planNamedDrops(connection, catalog, baseline, lock = false) {
    const plan = [];
    for (const pack of catalog.packs) {
        const old = baseline.packs.find(row => row.slug === pack.slug);
        if (!old || old.priceCents !== pack.priceCents) throw Error('Opening price changed in catalog: ' + pack.slug);
        const [[row]] = await connection.query('SELECT CAST(id AS CHAR) AS id, name, img FROM cases WHERE slug = ?' + (lock ? ' FOR UPDATE' : ''), [pack.slug]);
        if (!row || row.name !== pack.name || row.img !== pack.image) throw Error('Pack missing or customized; stopped without overwriting: ' + pack.slug);
        const [versions] = await connection.query('SELECT CAST(id AS CHAR) AS id, CAST(price AS CHAR) AS price FROM caseVersions WHERE caseId = ? AND endedAt IS NULL' + (lock ? ' FOR UPDATE' : ''), [row.id]);
        if (versions.length !== 1 || String(versions[0].price) !== String(pack.priceCents)) throw Error('Active version or price differs: ' + pack.slug);
        const [items] = await connection.query('SELECT name, img, CAST(price AS CHAR) AS price, CAST(robloxId AS CHAR) AS robloxId, rangeFrom, rangeTo FROM caseItems WHERE caseVersionId = ? ORDER BY rangeFrom' + (lock ? ' FOR UPDATE' : ''), [versions[0].id]);
        if (sameItems(items, pack.items)) {
            plan.push({ action: 'unchanged', caseId: row.id, versionId: versions[0].id, pack });
        } else if (sameItems(items, old.items)) {
            plan.push({ action: 'new-version', caseId: row.id, versionId: versions[0].id, pack });
        } else {
            throw Error('Rewards were customized; stopped without overwriting: ' + pack.slug);
        }
    }
    return plan;
}
async function applyNamedDrops(connection, catalog, baseline) {
    const plan = await planNamedDrops(connection, catalog, baseline, true);
    let updated = 0, unchanged = 0;
    for (const entry of plan) {
        if (entry.action === 'unchanged') { unchanged++; continue; }
        const [ended] = await connection.query('UPDATE caseVersions SET endedAt = NOW() WHERE id = ? AND endedAt IS NULL', [entry.versionId]);
        if (ended.affectedRows !== 1) throw Error('Active version changed during migration');
        await connection.query('INSERT INTO caseVersions (caseId, price) VALUES (?, ?)', [entry.caseId, entry.pack.priceCents]);
        const [[version]] = await connection.query('SELECT CAST(id AS CHAR) AS id FROM caseVersions WHERE caseId = ? AND endedAt IS NULL', [entry.caseId]);
        for (const item of entry.pack.items) {
            await connection.query('INSERT INTO caseItems (caseVersionId, robloxId, name, img, price, robloxPrice, rangeFrom, rangeTo) VALUES (?, ?, ?, ?, ?, 0, ?, ?)', [version.id, item.catalogId, item.name, item.image, item.valueCents, item.rangeFrom, item.rangeTo]);
        }
        updated++;
    }
    return { updated, unchanged };
}
module.exports = { sameItems, planNamedDrops, applyNamedDrops };
