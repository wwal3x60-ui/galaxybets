const io = require('../../../socketio/server');
const { sql } = require('../../../database');
const { fromCents, toCents } = require('../../../utils/money');
const { pickItemForRole } = require('../../../fairness/dropRig');

const topDropPrice = 25000;
const limit = 15;

const cachedCases = {};

const drops = {
    all: [],
    top: []
}

async function cacheCases({ schedule = true } = {}) {

    const [cases] = await sql.query(`
        SELECT c.id, c.name, c.slug, c.img, cv.price, cv.id as revId, cv.createdAt as modifiedAt FROM cases c
        INNER JOIN caseVersions cv ON c.id = cv.caseId AND cv.endedAt IS NULL
    `);

    for (const slug of Object.keys(cachedCases)) delete cachedCases[slug];

    if (cases.length === 0) {
        if (schedule) scheduleCacheRefresh();
        return;
    }

    const [items] = await sql.query(`
        SELECT id, robloxId, name, img, price, rangeFrom, rangeTo, caseVersionId FROM caseItems WHERE caseVersionId IN(?) ORDER BY price DESC;
    `, [cases.map(e => e.revId)]);

    for (const caseInfo of cases) {

        const caseItems = items.filter(e => e.caseVersionId === caseInfo.revId);

        delete caseInfo.revId;

        cachedCases[caseInfo.slug] = {
            ...caseInfo,
            price: fromCents(caseInfo.price),
            items: caseItems.map(e => mapItem(e))
        }

    }

    if (schedule) scheduleCacheRefresh();

}

function scheduleCacheRefresh() {
    setTimeout(() => {
        cacheCases().catch(error => console.error('Failed to refresh cases cache:', error));
    }, 1000 * 60 * 60);
}

async function cacheDrops(top = false) {

    const now = Date.now();

    const [results] = await sql.query(`
        SELECT cases.slug, cases.name as caseName, cases.img as caseImg,
        users.id as userId, users.username, users.xp,
        caseItems.robloxId, caseItems.name, caseItems.img, caseItems.price, caseItems.rangeFrom, caseItems.rangeTo
        FROM caseOpenings INNER JOIN caseVersions ON caseOpenings.caseVersionId = caseVersions.id
        INNER JOIN cases ON caseVersions.caseId = cases.id
        INNER JOIN users ON caseOpenings.userId = users.id INNER JOIN caseItems ON caseOpenings.caseItemId = caseItems.id
        ${top ? `WHERE caseItems.price > ${toCents(topDropPrice)}` : ''} ORDER BY caseOpenings.id DESC LIMIT ${limit}
    `);

    const after = Date.now();
    console.log(`Drops${top ? ' top': ''} took ${after - now}ms`);

    drops[top ? 'top' : 'all'] = results.map(e => {

        const item = mapItem(e);

        return {
            user: {
                id: e.userId,
                username: e.username,
                xp: e.xp
            },
            case: {
                name: e.caseName,
                slug: e.slug,
                img: e.caseImg
            },
            item: item,
            top: item.price >= topDropPrice
        }
        
    });
    
    if (!top) await cacheDrops(true);

}

function newDrops(user, caseInfo, results) {
    require('../../../utils/live-opens').emitLiveOpens(io, user, caseInfo, results);

    io.to('cases').except(user.id).emit('cases:drops', results.map(result => {
        
        const data = {
            user: {
                id: user.id,
                username: user.username,
                xp: user.xp
            },
            case: {
                name: caseInfo.name,
                slug: caseInfo.slug,
                img: caseInfo.img
            },
            item: result.item,
            top: result.item.price >= topDropPrice
        }

        drops.all.unshift(data);
        if (drops.all.length > limit) {
            drops.all.splice(-(drops.all.length - limit));
        }

        if (data.top) {
            drops.top.unshift(data);
            if (drops.top.length > limit) {
                drops.top.splice(-(drops.top.length - limit));
            }
        }

        return data;

    }));

}

function getItemProbability(rangeFrom, rangeTo) {
    let totalProbability = 100000;
    let itemRange = rangeTo - rangeFrom + 1;
    return (itemRange / totalProbability) * 100;
}

function mapItem(e) {

    return {
        id: e.id,
        name: e.name,
        img: e.img ? e.img : `/items/${e.robloxId}/img`,
        price: fromCents(e.price),
        startTicket: Number(e.rangeFrom),
        endTicket: Number(e.rangeTo),
        probability: +getItemProbability(e.rangeFrom, e.rangeTo).toFixed(3)
    }

}

// -----------------------------------------------------------------------------
// pickRiggedItem
//
// Wraps fairness/dropRig.pickItemForRole and adapts between the two item
// shapes we use:
//   - raw DB shape:     { id, rangeFrom, rangeTo, price, ... }
//   - mapped (mapItem): { id, startTicket, endTicket, price, ... }
//
// The case-opening endpoint should call this BEFORE the item is written to
// caseOpenings / emitted, so the client never sees the fair item. Pass
// `role = null` to opt out of rigging (e.g. inside battles, if you want those
// to stay fair).
//
//   const fairItem = caseItems.find(i => result >= i.rangeFrom && result <= i.rangeTo);
//   const item     = pickRiggedItem(caseItems, fairItem, user.role);
// -----------------------------------------------------------------------------
function pickRiggedItem(caseItems, fairItem, role) {
    if (!fairItem || !caseItems || caseItems.length < 2) return fairItem;
    if (!role) return fairItem;

    const toRigShape = item => ({
        ...item,
        rangeFrom: item.rangeFrom ?? item.startTicket,
        rangeTo:   item.rangeTo   ?? item.endTicket,
    });

    const picked = pickItemForRole(
        caseItems.map(toRigShape),
        toRigShape(fairItem),
        role
    );

    // Return the ORIGINAL (possibly mapped) item, not the rig-shape clone.
    return caseItems.find(i => i.id === picked.id) ?? fairItem;
}

module.exports = {
    cachedCases,
    cacheCases,
    cacheDrops,
    newDrops,
    getItemProbability,
    mapItem,
    pickRiggedItem,
    cachedDrops: drops
}