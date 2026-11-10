'use strict';
const fs = require('fs');
const path = require('path');
const baseline = require('./premium80-baseline.json');
function validatePremium80(catalog, backendRoot) {
    const counts = { Pokemon: 0, CSGO: 0, IRL: 0 };
    const slugs = new Set();
    if (catalog.revision !== 'premium-80-v3' || catalog.packs?.length !== 40) throw Error('Unexpected named-drop catalog');
    for (const pack of catalog.packs) {
        if (!Object.hasOwn(counts, pack.category) || slugs.has(pack.slug)) throw Error('Invalid category or duplicate slug');
        counts[pack.category]++; slugs.add(pack.slug);
        if (!Number.isSafeInteger(pack.priceCents) || pack.priceCents < 100 || pack.priceCents > 50000) throw Error('Invalid opening price');
        if (pack.items?.length !== 10) throw Error('Expected ten named rewards per pack');
        let next = 1, total = 0n;
        const names = new Set();
        for (const item of pack.items) {
            if (!item.name || names.has(item.name) || /credit|selection|bundle/i.test(item.name)) throw Error('Invalid or generic reward name');
            names.add(item.name);
            if (!Number.isSafeInteger(item.valueCents) || item.valueCents <= 0 || !Number.isSafeInteger(item.tickets) || item.tickets < 1 || item.rangeFrom !== next || item.rangeTo !== next + item.tickets - 1) throw Error('Invalid value or ticket interval');
            next = item.rangeTo + 1;
            total += BigInt(item.valueCents) * BigInt(item.tickets);
            if (!/^\/public\/drop-images\/[a-zA-Z0-9-]+\.(png|jpg|webp|gif|avif)$/.test(item.image)) throw Error('Invalid local drop image');
            if (backendRoot) {
                const file = path.join(backendRoot, item.image.slice(1));
                if (!fs.existsSync(file) || !fs.statSync(file).size) throw Error('Missing drop image: ' + item.image);
            }
        }
        const oldPack = baseline.packs.find(p => p.slug === pack.slug);
        if (!oldPack || oldPack.priceCents !== pack.priceCents) throw Error('Opening price changed');
        if (pack.priceCents <= 30000 && JSON.stringify(pack) !== JSON.stringify(oldPack)) throw Error('A pack at or below $300 was changed');
        if (pack.priceCents > 30000) {
            const loss = pack.items.filter(i => i.valueCents < pack.priceCents).reduce((s,i) => s+i.tickets,0);
            const profit = pack.items.filter(i => i.valueCents > pack.priceCents).reduce((s,i) => s+i.tickets,0);
            const refund = pack.items.filter(i => i.valueCents === pack.priceCents).reduce((s,i) => s+i.tickets,0);
            if (loss !== 80000 || profit !== 20000 || refund !== 0) throw Error('Premium pack does not have exact 80/20 odds');
        }
        if (pack.slug !== 'pokemon-eevee') {
            const sorted = [...pack.items].sort((a, b) => a.valueCents - b.valueCents);
            const top = sorted.at(-1);
            if (top.tickets !== 100 || sorted.at(-2).valueCents >= top.valueCents) throw Error('Chase must be a unique maximum at exactly 0.1%');
            if (pack.priceCents === 50000 && top.valueCents !== 1500000) throw Error('$500 pack must have a $15000 top drop');
        }
        if (next !== 100001 || total !== BigInt(pack.priceCents) * 90000n) throw Error('Ticket coverage or 90% target mismatch: ' + pack.slug);
    }
    if (counts.Pokemon !== 10 || counts.CSGO !== 10 || counts.IRL !== 20) throw Error('Wrong category counts');
    return counts;
}
module.exports = { validatePremium80 };
