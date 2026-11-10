'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql, doTransaction } = require('../database');
const catalog = require('../utils/galaxy-chase-catalog.json');
const baseline = require('../utils/galaxy-chase-baseline.json');
const { validateChaseCatalog } = require('../utils/pack-chase-validator');
const { planChaseCatalog, applyChaseCatalog } = require('../utils/pack-chase-migration');
const { ensureTicketFields } = require('../utils/pack-ticket-api-patch');
const root = path.join(__dirname, '..');
function guardCatalog() {
    validateChaseCatalog(catalog, root);
    const old = baseline.packs.find(p => p.slug === 'pokemon-eevee');
    const current = catalog.packs.find(p => p.slug === 'pokemon-eevee');
    if (JSON.stringify(old) !== JSON.stringify(current)) throw Error('Eevee was changed; stopped.');
}
async function main() {
    guardCatalog();
    const apply = process.argv.includes('--apply');
    if (apply && !process.argv.includes('--backend-stopped')) throw Error('Stop the backend and add --backend-stopped before applying.');
    const sourcePlan = ensureTicketFields(root, false);
    const plan = await planChaseCatalog(sql, catalog, baseline);
    console.table(plan.map(e => { const top = [...e.pack.items].sort((a,b) => b.valueCents-a.valueCents)[0]; return { pack: e.pack.name, openingPrice: (e.pack.priceCents/100).toFixed(2), maxDrop: (top.valueCents/100).toFixed(2), maxChance: (top.tickets/1000).toFixed(3)+'%', action: e.action }; }));
    console.log({ mode: apply ? 'apply' : 'preview', ...sourcePlan, targetReturn: '90%', Eevee: 'unchanged' });
    if (!apply) { console.log('Read-only preview. Existing winnings, inventory and prices will be preserved.'); return; }
    console.log(ensureTicketFields(root, true));
    const result = await doTransaction(async (connection, commit) => {
        const result = await applyChaseCatalog(connection, catalog, baseline);
        await commit(); return result;
    });
    console.log('Chase balance installed:', result);
    console.log('Restart backend to refresh its cache. Previous winnings and Eevee were preserved.');
}
main().catch(error => { console.error(error.message); process.exitCode=1; }).finally(() => sql.end());
