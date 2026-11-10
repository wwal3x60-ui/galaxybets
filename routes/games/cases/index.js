const {MAX_BET_USD}=require('../../../utils/bet-limits');
const { creditAffiliateGameBets, emitAffiliateCredits } = require('../../../utils/affiliate-commission');
const express = require('express');
const router = express.Router();

const { sql, doTransaction } = require('../../../database');

const { isAuthed, apiLimiter } = require('../../auth/functions');
const { roundDecimal, xpChanged } = require('../../../utils');
const { fromCents } = require('../../../utils/money');
const { getUserSeeds, getResult, combine }  = require('../../../fairness');
const { mapItem, newDrops, cachedCases } = require('./functions');

const io = require('../../../socketio/server');
const { newBets } = require('../../../socketio/bets');

const { enabledFeatures, xpMultiplier } = require('../../admin/config');

router.get('/', async (req, res) => {

    let cases = Object.values(cachedCases).map(e => {
        return {
            ...e,
            items: undefined
        }
    });

    res.json(cases);

});

const frontendRoutes = [
    '',
    '/affiliates',
    '/battles',
    '/cases',
    '/coinflips',
    '/crash',
    '/docs/faq',
    '/docs/tos',
    '/docs/aml',
    '/docs/privacy',
    '/jackpot',
    '/leaderboard',
    '/mines',
    '/roulette',
]

router.get('/sitemap.xml', async (req, res) => {

    let str = '<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">';
    str += Object.values(cachedCases).map(e => `<url><loc>${process.env.FRONTEND_URL}/cases/${e.slug}</loc><lastmod>${e.modifiedAt.toISOString()}</lastmod></url>`).join('');
    str += frontendRoutes.map(e => `<url><loc>${process.env.FRONTEND_URL}${e}</loc></url>`).join('');
    str += '</urlset>';

    res.set('Content-Type', 'text/xml');
    res.send(str);

});

router.get('/robots.txt', async (req, res) => {
    
    res.set('Content-Type', 'text/plain');

    let str = 'User-agent: *\n';
    str += 'Allow /';
    str += '\n';
    str += 'Sitemap: ' + process.env.FRONTEND_URL + '/sitemap.xml';

    res.send(str);
    
});

router.get('/:slug', async (req, res) => {

    if (!req.params.slug) return res.status(400).json({ error: 'MISSING_SLUG' });

    const caseInfo = cachedCases[req.params.slug];
    if (!caseInfo) return res.status(404).json({ error: 'NOT_FOUND' });

    res.json(caseInfo);

});

router.post('/:id/open', [isAuthed, apiLimiter], async (req, res) => {

    if (!enabledFeatures.cases) return res.status(400).json({ error: 'DISABLED' });
    if (!req.params.id) return res.status(400).json({ error: 'MISSING_SLUG' });

    if (typeof req.body.amount !== 'number') return res.status(400).json({ error: 'INVALID_AMOUNT' });

    const amount = Math.floor(req.body.amount);
    if (amount < 1 || amount > 5) return res.status(400).json({ error: 'INVALID_AMOUNT' });

    const [[caseInfo]] = await sql.query(`
        SELECT cases.id, cases.name, cases.slug, cases.img, caseVersions.price, caseVersions.id as revId FROM cases
        INNER JOIN caseVersions ON cases.id = caseVersions.caseId AND caseVersions.endedAt IS NULL
        WHERE cases.id = ?;
    `, [req.params.id]);

    if (!caseInfo) return res.status(404).json({ error: 'NOT_FOUND' });

    const casePrice = fromCents(caseInfo.price);
    if (casePrice < 0.2) return res.status(400).json({ error: 'INVALID_AMOUNT' });
    const price = roundDecimal(casePrice * amount);
    if(price>MAX_BET_USD)return res.status(400).json({error:"MAX_BET_CASES"});

    try {

        await doTransaction(async (connection, commit) => {

            const [[user]] = await connection.query('SELECT id, balance, username, perms, sponsorLock, role, anon, xp FROM users WHERE id = ? FOR UPDATE', [req.userId]);
            if (user.balance < price) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
    
            const [items] = await connection.query(`
                SELECT \`caseItems\`.\`id\`, \`caseItems\`.\`robloxId\`, \`caseItems\`.\`name\`, \`caseItems\`.\`img\`,
                    \`caseItems\`.\`price\`, \`caseItems\`.\`rangeFrom\`, \`caseItems\`.\`rangeTo\`
                FROM \`caseItems\`
                WHERE \`caseItems\`.\`caseVersionId\` = ?
                ORDER BY \`caseItems\`.\`price\` DESC;
            `, [caseInfo.revId]);
    
            const seeds = await getUserSeeds(user.id, connection, true);
            const results = [];
            const affiliateCredits = [];
    
            let value = -price;
            let total = 0;
    
            const edge = roundDecimal(casePrice * 0.1);
    
            for (let i = 0; i < amount; i++) {
    
                seeds.nonce++
    
                const seed = combine(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
                const result = getResult(seed);
    
                // console.log(result);
                const item = items.find(e => result >= e.rangeFrom && result <= e.rangeTo);
    
                if (!item) return res.status(500).json({ error: 'INTERNAL_ERROR' });
    
                const [fairResult] = await connection.query(
                    `INSERT INTO fairRolls (serverSeed, clientSeed, nonce, seed, result) VALUES (?, ?, ?, ?, ?)`,
                    [seeds.serverSeed, seeds.clientSeed, seeds.nonce, seed, result]
                );
                
                const [openingResult] = await connection.query(`
                    INSERT INTO caseOpenings (userId, caseVersionId, rollId, caseItemId) VALUES (?, ?, ?, ?)`,
                    [user.id, caseInfo.revId, fairResult.insertId, item.id]
                );
        
                await connection.query(`
                    INSERT INTO bets (userId, amount, winnings, edge, game, gameId, completed) VALUES (?, ?, ?, ?, ?, ?, 1)`,
                    [user.id, casePrice, fromCents(item.price), edge, 'case', openingResult.insertId]
                );
    
                affiliateCredits.push(...await creditAffiliateGameBets(
                    connection, 'case', [openingResult.insertId]
                ));

                const mappedItem = mapItem(item);

                // The won item goes to the user's inventory (cart), NOT to the balance.
                const [inventoryResult] = await connection.query(`
                    INSERT INTO inventory (userId, openingId, caseItemId, name, img, price) VALUES (?, ?, ?, ?, ?, ?)`,
                    [user.id, openingResult.insertId, item.id, mappedItem.name, mappedItem.img, mappedItem.price]
                );

                results.push({
                    openingId: openingResult.insertId,
                    inventoryId: inventoryResult.insertId,
                    nonce: seeds.nonce,
                    result,
                    seed,
                    item: mappedItem
                });
    
                total += fromCents(item.price);
    
            }
    
            // Winnings are NOT paid to the balance any more (they are in the inventory).
            value = roundDecimal(value);
    
            const xp = roundDecimal(price * xpMultiplier);
            await connection.query(`
                UPDATE users SET balance = balance + ?, xp = xp + ? WHERE id = ?
            `, [value, xp, user.id]);
            
            await xpChanged(user.id, user.xp, roundDecimal(user.xp + xp), connection);
    
            const [nonceIncrease] = await connection.query('UPDATE serverSeeds SET nonce = nonce + ? WHERE id = ?', [amount, seeds.serverSeedId]);
            if (nonceIncrease.affectedRows != 1) return res.status(404).json({ error: 'UNKNOWN_ERROR' });

            await commit();
            emitAffiliateCredits(affiliateCredits);

            io.to(user.id).emit('balance', 'set', roundDecimal(user.balance + value));

            res.json({
                balance: roundDecimal(user.balance + value),
                total,
                results
            });
    
            newBets(results.map(e => {
                return {
                    user: user,
                    amount: casePrice,
                    edge: edge,
                    payout: e.item.price,
                    game: 'case'
                }
            }));
    
            newDrops(user, caseInfo, results);
            
        });

    } catch (error) {
        console.error("CASE OPEN ERROR:", error);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

module.exports = router;