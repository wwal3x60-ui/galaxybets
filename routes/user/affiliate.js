const express = require('express');
const router = express.Router();
const { randomBytes } = require('crypto');

const { sql, doTransaction } = require('../../database');

const { isAuthed, apiLimiter } = require('../auth/functions');
const { roundDecimal, sendLog } = require('../../utils');
const io = require('../../socketio/server');
const { enabledFeatures } = require('../admin/config');

const minClaim = 5;
let cachedAffiliates = {};

async function getAffiliateData(userId) {
    
    if (cachedAffiliates[userId]?.affiliateCode) return cachedAffiliates[userId];

    const affiliateCode = await getOrCreateAffiliateCode(userId);
    const [[user]] = await sql.query('SELECT affiliateEarningsOffset FROM users WHERE id = ?', [userId]);
    const { lastClaimDate, unclaimedEarnings, totalWagered, totalEarnings, users } = await getAffiliateInfo(userId, user.affiliateEarningsOffset);

    cachedAffiliates[userId] = {
        affiliateCode,
        lastClaim: lastClaimDate,
        unclaimedEarnings,
        totalWagered,
        totalEarnings,
        canClaim: unclaimedEarnings >= minClaim,
        minClaim,
        users
    };

    setTimeout(() => {
        delete cachedAffiliates[userId];
    }, 25000);

    return cachedAffiliates[userId];

}

router.get('/', isAuthed, async (req, res) => {

    try {
        const data = await getAffiliateData(req.userId);

        res.json({
            ...data,
            cachedAt: undefined,
            users: undefined
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

});

async function getOrCreateAffiliateCode(userId) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const affiliateCode = await doTransaction(async (connection, commit) => {
                const [[user]] = await connection.query(
                    'SELECT affiliateCode FROM users WHERE id = ? FOR UPDATE',
                    [userId]
                );
                if (!user) throw new Error(`User ${userId} was not found while creating an affiliate code.`);
                if (user.affiliateCode) {
                    await commit();
                    return user.affiliateCode;
                }

                const code = randomBytes(4).toString('hex');
                await connection.query('UPDATE users SET affiliateCode = ? WHERE id = ?', [code, userId]);
                await commit();
                return code;
            });

            delete cachedAffiliates[userId];
            return affiliateCode;
        } catch (e) {
            if (e.code !== 'ER_DUP_ENTRY' || attempt === 2) throw e;
        }
    }
}

const resultsPerPage = 6;

router.get('/users', isAuthed, async (req, res) => {

    const info = await getAffiliateData(req.userId);

    let page = parseInt(req.query.page);
    page = !isNaN(page) && page > 0 ? page : 1;

    const offset = (page - 1) * resultsPerPage;
    if (!info.users.length) return res.json({ page: 1, pages: 0, total: 0, data: [] });

    const pages = Math.ceil(info.users.length / resultsPerPage);

    if (page > pages) return res.status(404).json({ error: 'PAGE_NOT_FOUND' });
    const data = info.users.slice(offset, offset + resultsPerPage);
    
    res.json({
        page,
        pages,
        total: info.users.length,
        data
    });

});

router.use((req, res, next) => {
    if (!enabledFeatures.affiliates) return res.status(400).json({ error: 'DISABLED' });
    next();
});

router.post('/claim', [isAuthed, apiLimiter], async (req, res) => {

    try {

        await doTransaction(async (connection, commit) => {

            const [[user]] = await connection.query('SELECT id, username, balance, affiliateEarningsOffset FROM users WHERE id = ? FOR UPDATE', [req.userId]);

            const { unclaimedEarnings } = await getAffiliateInfo(req.userId, user.affiliateEarningsOffset, connection);
            if (unclaimedEarnings < minClaim) return res.status(400).json({ error: 'NOT_ENOUGH_BETS' });
        
            const [result] = await connection.query('INSERT INTO affiliateClaims (userId, amount) VALUES (?, ?)', [user.id, unclaimedEarnings]);
            await connection.query('UPDATE users SET balance = balance + ?, affiliateEarningsOffset = 0 WHERE id = ?', [unclaimedEarnings, user.id]);
        
            await connection.query('INSERT INTO transactions (userId, amount, type, method, methodId) VALUES (?, ?, ?, ?, ?)', [user.id, unclaimedEarnings, 'in', 'affiliate', result.insertId]);
            await commit();

            delete cachedAffiliates[req.userId];
            io.to(user.id).emit('balance', 'set', roundDecimal(user.balance + unclaimedEarnings));

            res.json({ success: true });
            sendLog('affiliate', `*${user.username}* (\`${user.id}\`) claimed $${unclaimedEarnings} from affiliate earnings.`);

        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

});

router.post('/', [isAuthed, apiLimiter], async (req, res) => {
    
    const code = req.body.code?.toLowerCase().trim();
    if (!code || typeof code != 'string' || code.length < 2 || code.length > 20 || !onlyLettersAndNumbers(code)) return res.status(400).json({ error: 'INVALID_CODE' });

    try {

        await doTransaction(async (connection, commit) => {
        
            const [[affiliate]] = await connection.query('SELECT id, username FROM users WHERE LOWER(affiliateCode) = LOWER(?) FOR UPDATE', [code]);
            if (!affiliate) return res.status(404).json({ error: 'CODE_NOT_FOUND' });
    
            const [[affiliated]] = await connection.query('SELECT userId FROM affiliates WHERE userId = ? OR ip = ?', [req.userId, req.headers['cf-connecting-ip']]);
            if (affiliated?.userId) return res.status(400).json({ error: 'ALREADY_AFFILIATED' });
    
            const [[user]] = await connection.query('SELECT id, username, balance, accountLock, sponsorLock, createdAt FROM users WHERE id = ? FOR UPDATE', [req.userId]);
            if (user.accountLock || user.sponsorLock) return res.status(400).json({ error: 'ACCOUNT_LOCKED' });
            if (user.createdAt.getTime() > Date.now() - 1000 * 60 * 60 * 24) {
                return res.status(400).json({ error: 'ACCOUNT_AGE_AFFILIATE' });
            }
            
            if (user.id == affiliate.id) return res.status(400).json({ error: 'CANT_REDEEM_OWN_CODE' });
    
            if (user.createdAt.getTime() < Date.now() - 1000 * 60 * 60 * 24 * 30) {
                return res.status(400).json({ error: 'ACCOUNT_AGE_AFFILIATE' });
            }
    
            const reward = 10;
    
            await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [reward, user.id]);
            const [result] = await connection.query('INSERT INTO affiliates (userId, affiliateId, affiliateReward, ip) VALUES (?, ?, ?, ?)', [user.id, affiliate.id, reward, req.headers['cf-connecting-ip']]);
            await connection.query('INSERT INTO transactions (userId, amount, type, method, methodId) VALUES (?, ?, ?, ?, ?)', [user.id, reward, 'in', 'affiliate-code', result.insertId]);
            await commit();
    
            io.to(user.id).emit('balance', 'set', roundDecimal(user.balance + reward))
            sendLog('affiliate', `*${user.username}* (\`${user.id}\`) used code \`${code}\` of *${affiliate.username}* (\`${affiliate.id}\`) - #${result.insertId}`);
            res.json({ success: true, reward });

        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

});

router.get('/usedCode', isAuthed, async (req, res) => {

    const [[user]] = await sql.query('SELECT users.affiliateCode FROM users JOIN affiliates ON affiliates.affiliateId = users.id WHERE affiliates.userId = ?', [req.userId]);
    if (!user) return res.json({ code: null });

    res.json({ code: user.affiliateCode });

});

const blacklistedCodes = ['free', 'clash', '123', '1234', 'blox', 'rblxwild', 'bloxflip', 'rbxgold', 'betbux', 'freebux', 'bux'];

router.post('/code', [isAuthed, apiLimiter], async (req, res) => {

    const rawCode = req.body?.code;
    if (typeof rawCode !== 'string') return res.status(400).json({ error: 'INVALID_CODE' });
    const code = rawCode.trim().toLowerCase();
    if (code.length < 3 || code.length > 15 || !onlyLettersAndNumbers(code)) return res.status(400).json({ error: 'INVALID_CODE' });
    if (blacklistedCodes.includes(code)) return res.status(400).json({ error: 'INVALID_CODE' });

    try {

        const [[user]] = await sql.query('SELECT affiliateCodeLock FROM users WHERE id = ?', [req.userId]);
        if (user.affiliateCodeLock) return res.status(400).json({ error: 'CODE_LOCKED' });

        await doTransaction(async (connection, commit) => {

            const [[user]] = await connection.query('SELECT id, username, balance, accountLock, sponsorLock, createdAt FROM users WHERE id = ? FOR UPDATE', [req.userId]);
            if (user.accountLock || user.sponsorLock) return res.status(400).json({ error: 'ACCOUNT_LOCKED' });

            const [[affiliate]] = await connection.query('SELECT id FROM users WHERE affiliateCode = ? AND id != ?', [code, req.userId]);
            if (affiliate) return res.status(400).json({ error: 'CODE_TAKEN' });
        
            await connection.query('UPDATE users SET affiliateCode = ? WHERE id = ?', [code, req.userId]);
            await commit();
    
            delete cachedAffiliates[req.userId];
            res.json({ success: true, code });
            sendLog('affiliate', `*${user.username}* (\`${user.id}\`) set his code to \`${code}\`.`);

        });

    } catch(e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'CODE_TAKEN' });
        console.error(e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

});

function onlyLettersAndNumbers(str) {
    return /^[A-Za-z0-9]*$/.test(str);
}

async function getAffiliateInfo(userId, offsetAmount, connection = sql) {

    const [[lastClaim]] = await connection.query('SELECT createdAt FROM affiliateClaims WHERE userId = ? ORDER BY createdAt DESC LIMIT 1', [userId]);
    const lastClaimDate = lastClaim?.createdAt || new Date('2021-01-01 00:00:00');

    const [users] = await connection.query(
        `
        SELECT 
        users.id, users.username, users.xp,
        COALESCE(SUM(bets.amount), 0) as totalWagered,
        COALESCE(SUM(bets.edge), 0) AS totalEdge,
        COALESCE(SUM(CASE WHEN bets.createdAt > ? THEN bets.amount ELSE 0 END), 0) as unclaimedWagered,
        COALESCE(SUM(CASE WHEN bets.createdAt > ? THEN bets.edge ELSE 0 END), 0) AS unclaimedEdge,
        affiliates.createdAt as affiliatedAt
        FROM affiliates
        INNER JOIN users ON users.id = affiliates.userId
        LEFT JOIN bets ON bets.userId = users.id AND bets.createdAt > affiliates.createdAt AND bets.completed = 1
        WHERE affiliates.affiliateId = ?
        GROUP BY users.id ORDER BY totalEdge DESC;
        `,
        [lastClaimDate, lastClaimDate, userId]
    );

    let totalEarnings = 0;
    let unclaimedEarnings = 0;
    let totalWagered = 0;

    users.forEach(e => {
        e.totalEarnings = roundDecimal(e.totalEdge * 0.1);
        e.unclaimedEarnings = roundDecimal(e.unclaimedEdge * 0.1);
        totalWagered += e.totalWagered;
        totalEarnings += e.totalEarnings;
        unclaimedEarnings += e.unclaimedEarnings;
    });

    totalWagered = roundDecimal(totalWagered);
    totalEarnings = roundDecimal(totalEarnings);
    unclaimedEarnings = roundDecimal(unclaimedEarnings + offsetAmount)

    return {
        lastClaimDate,
        totalWagered,
        totalEarnings,
        unclaimedEarnings,
        users
    };

}

module.exports = router;