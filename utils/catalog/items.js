const cases = require('../cases.json');

const items = {};

for (const caseInfo of cases) {
    for (const item of caseInfo.items || []) {
        const id = String(item.id);
        if (Object.prototype.hasOwnProperty.call(items, id)) continue;

        items[id] = {
            ...item,
            id,
            img: `/public/items/${id}.png`
        };
    }
}

module.exports = { items };
