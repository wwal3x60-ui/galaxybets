'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql, doTransaction } = require('../database');
const catalog = require('../utils/galaxy-named-drops.json');
const baseline = require('../utils/galaxy-drops-baseline.json');
const { validateNamedDrops } = require('../utils/named-drops-validator');
const { planNamedDrops, applyNamedDrops } = require('../utils/named-drops-migration');
async function main() {
    const counts = validateNamedDrops(catalog, path.join(__dirname, '..'));
    const applying = process.argv.includes('--apply');
    if (applying && !process.argv.includes('--backend-stopped')) throw Error('Stop the backend first, then add --backend-stopped to the apply command.');
    const plan = await planNamedDrops(sql, catalog, baseline);
    console.table(plan.map(entry => ({ pack: entry.pack.name, openingPrice: (entry.pack.priceCents / 100).toFixed(2), rewards: 10, action: entry.action })));
    console.log({ mode: applying ? 'apply' : 'preview', counts, targetReturn: '90%', newVersions: plan.filter(e => e.action === 'new-version').length });
    if (!applying) {
        console.log('Read-only preview. Review NAMED-REWARDS.md before applying. Existing inventory and historical rewards are preserved.');
        return;
    }
    const result = await doTransaction(async (connection, commit) => {
        const result = await applyNamedDrops(connection, catalog, baseline);
        await commit();
        return result;
    });
    console.log('Named drops installed:', result);
    console.log('Old versions and winnings were preserved. Restart the backend to refresh pack images and cached contents.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => sql.end());
