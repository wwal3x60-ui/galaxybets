const express = require('express');
const router = express.Router();

const { sql, doTransaction } = require('../../database');

const { isAuthed, apiLimiter } = require('../auth/functions');
const { roundDecimal, getUserLevel, sendLog } = require('../../utils');
const io = require('../../socketio/server');
const { enabledFeatures, checkAccountLock } = require('../admin/config');
const { getUserRakebacks } = require('./rakeback/functions');

const affiliateRoute = require('./affiliate');
const rakebackRoute = require('./rakeback');
const notificationsRoute = require('./notifications');

router.use(require('./profile-photo'));
router.use('/affiliate', affiliateRoute);
router.use('/rakeback', rakebackRoute);
router.use('/notifications', notificationsRoute);

router.get('/', isAuthed, async (req, res) => {

    const [[user]] = await sql.query('SELECT id, role, username, balance, xp, anon FROM users WHERE id = ?', [req.userId]);
    const [[{ notifications }]] = await sql.query('SELECT COUNT(*) as notifications FROM notifications WHERE userId = ? AND seen = 0', [req.userId]);
    user.notifications = notifications;

    const rakebacks = await getUserRakebacks(req.userId);
    user.rewards = Object.values(rakebacks).filter(e => e.canClaim).length;

    res.json(user);

});

router.post('/anon', isAuthed, async (req, res) => {

    const enabled = req.body.enable;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'INVALID_ENABLED' });

    await sql.query('UPDATE users SET anon = ? WHERE id = ?', [enabled, req.userId]);
    res.json({ success: true });

});

router.post('/mentions', isAuthed, async (req, res) => {

    const enabled = req.body.enable;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'INVALID_ENABLED' });

    await sql.query('UPDATE users SET mentionsEnabled = ? WHERE id = ?', [enabled, req.userId]);
    res.json({ success: true });

});

const resultsPerPage = 10;
const allowedTypes = ['deposit', 'withdraw', 'in', 'out'];
const allowedMethods = ['rakeback', 'tip', 'promo', 'affiliate', 'crypto', 'rain', 'sell'];

router.get('/transactions', isAuthed, async (req, res) => {

    let page = parseInt(req.query.page);
    page = !isNaN(page) && page > 0 ? page : 1;

    const offset = (page - 1) * resultsPerPage;

    const args = [req.userId];
    let where = 'WHERE userId = ?';

    if (req.query.types) {
        const types = req.query.types.split(',');
        if (types.some(type => !allowedTypes.includes(type))) return res.status(400).json({ error: 'INVALID_TYPE' });
        where += ` AND type IN (${types.map(() => '?').join(',')})`;
        args.push(...types);
    }

    if (req.query.methods) {
        const methods = req.query.methods.split(',');
        if (methods.some(method => !allowedMethods.includes(method))) return res.status(400).json({ error: 'INVALID_METHOD' });
        where += ` AND method IN (${methods.map(() => '?').join(',')})`;
        args.push(...methods);
    }

    const [[{ total }]] = await sql.query(`SELECT COUNT(*) as total FROM transactions ${where}`, args);
    if (!total) return res.json({ page: 1, pages: 0, total: 0, data: [] });

    const pages = Math.ceil(total / resultsPerPage);

    if (page > pages) return res.status(404).json({ error: 'PAGE_NOT_FOUND' });
    const [data] = await sql.query(`SELECT amount, type, method, methodId, createdAt FROM transactions ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, resultsPerPage, offset]);
    
    res.json({
        page,
        pages,
        total,
        data
    });

});

const allowedGames = ['keno', 'battle', 'case', 'coinflip', 'crash', 'jackpot', 'roulette'];

router.get('/bets', isAuthed, async (req, res) => {

    let page = parseInt(req.query.page);
    page = !isNaN(page) && page > 0 ? page : 1;

    const offset = (page - 1) * resultsPerPage;

    const args = [req.userId];
    let where = 'WHERE userId = ?';

    if (req.query.games) {
        const games = req.query.games.split(',');
        if (games.some(game => !allowedGames.includes(game))) return res.status(400).json({ error: 'INVALID_GAME' });
        where += ` AND game IN (${games.map(() => '?').join(',')})`;
        args.push(...games);
    }

    const [[{ total }]] = await sql.query(`SELECT COUNT(*) as total FROM bets ${where}`, args);
    if (!total) return res.json({ page: 1, pages: 0, total: 0, data: [] });

    const pages = Math.ceil(total / resultsPerPage);

    if (page > pages) return res.status(404).json({ error: 'PAGE_NOT_FOUND' });
    const [data] = await sql.query(`SELECT amount, winnings, game, gameId, completed, createdAt FROM bets ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, resultsPerPage, offset]);
    
    res.json({
        page,
        pages,
        total,
        data
    });

});

// ---------------------------------------------------------------------------
// Inventory (the "cart"): items won from cases wait here until sold.
// ---------------------------------------------------------------------------

router.get('/inventory', isAuthed, async (req, res) => {

    try {
        const status = req.query.status === 'SOLD' ? 'SOLD' : 'AVAILABLE';
        const [items] = await sql.query(
            'SELECT id, name, img, price, status, createdAt FROM inventory WHERE userId = ? AND status = ? ORDER BY id DESC LIMIT 500',
            [req.userId, status]
        );
        res.json(items);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

});

router.post('/inventory/sell', [isAuthed, apiLimiter], async (req, res) => {

    const rawIds = req.body?.ids;
    if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 100) return res.status(400).json({ error: 'INVALID_IDS' });

    const ids = [...new Set(rawIds.map(e => Number(e)))];
    if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) return res.status(400).json({ error: 'INVALID_IDS' });

    try {

        await doTransaction(async (connection, commit) => {

            const [[user]] = await connection.query('SELECT id, username, balance FROM users WHERE id = ? FOR UPDATE', [req.userId]);

            // Lock the chosen items; they must be yours and still unsold
            const [items] = await connection.query(
                "SELECT id, price FROM inventory WHERE userId = ? AND status = 'AVAILABLE' AND id IN (?) FOR UPDATE",
                [req.userId, ids]
            );
            if (items.length !== ids.length) return res.status(400).json({ error: 'ITEMS_NOT_AVAILABLE' });

            const total = roundDecimal(items.reduce((sum, e) => sum + e.price, 0));
            if (!(total > 0)) return res.status(400).json({ error: 'INVALID_IDS' });

            await connection.query("UPDATE inventory SET status = 'SOLD', soldAt = NOW() WHERE userId = ? AND id IN (?)", [req.userId, ids]);
            await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [total, user.id]);
            await connection.query(
                'INSERT INTO transactions (userId, amount, type, method, methodId) VALUES (?, ?, ?, ?, ?)',
                [user.id, total, 'in', 'sell', String(items[0].id)]
            );
            await commit();

            const balance = roundDecimal(user.balance + total);
            io.to(String(user.id)).emit('balance', 'set', balance);
            res.json({ success: true, totalPrice: total, balance });


        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

});

const botImgs = {
    'bot1': '/public/bot1.png',
    'bot2': '/public/bot2.png',
    'bot3': '/public/bot3.png'
}

router.get('/:id/img', async (req, res) => {
    
    const userId = req.params.id;

    if (botImgs[userId]) return res.redirect(process.env.BASE_URL + botImgs[userId]);

    if (!/^\d+$/.test(userId)) return res.status(400).json({ error: 'INVALID_USER_ID' });

    const [[user]] = await sql.query('SELECT username FROM users WHERE id = ?', [userId]);

    const hues = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
    const background = user
        ? `hsl(${hues[Number(BigInt(userId) % BigInt(hues.length))]}, 65%, 50%)`
        : '#808080';
    const firstCharacter = user ? Array.from(user.username)[0] : '?';
    const upperCharacter = firstCharacter ? firstCharacter.toUpperCase() : '?';
    const initial = /^[A-Za-z0-9]$/.test(upperCharacter) ? upperCharacter : '?';

    res.set('Cache-Control', 'no-store');
    res.type('image/svg+xml').send(
        `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
        `<rect width="64" height="64" rx="12" fill="${background}"/>` +
        `<text x="32" y="32" fill="#fff" font-family="sans-serif" font-size="36" font-weight="600" text-anchor="middle" dominant-baseline="central">${initial}</text>` +
        `</svg>`
    );
});

router.get('/:id/profile', async (req, res) => {

    const userId = parseInt(req.params.id);
    if (!userId || isNaN(userId)) return res.status(400).json({ error: 'INVALID_USER_ID' });

    const [[user]] = await sql.query('SELECT id, username, xp FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    const [[wagered]] = await sql.query('SELECT SUM(amount) AS wagered FROM bets WHERE userId = ? AND completed = 1', [userId]);
    user.wagered = wagered.wagered || 0;

    const [[result]] = await sql.query(`
        SELECT 
        SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as deposits,
        SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END) as withdraws
        FROM transactions 
        WHERE userId = ? AND type IN ('deposit', 'withdraw')
    `, [userId]);
  
    user.deposits = result.deposits || 0;
    user.withdraws = result.withdraws || 0;

    res.json(user);

});

router.post('/promo', [isAuthed, apiLimiter], async (req, res) => {

    if (!enabledFeatures.promoCodes) return res.status(400).json({ error: 'DISABLED' });

    const code = req.body.code;
    if (!code || typeof code != 'string' || code.length < 2 || code.length > 20) return res.status(400).json({ error: 'INVALID_CODE' });

    try {

        await doTransaction(async (connection, commit) => {

            const [[promo]] = await connection.query('SELECT id, code, amount, totalUses, currentUses, minLvl FROM promoCodes WHERE code = ? FOR UPDATE', [code]);
            if (!promo) return res.status(404).json({ error: 'CODE_NOT_FOUND' });
            if (promo.totalUses && promo.currentUses >= promo.totalUses) return res.status(400).json({ error: 'CODE_EXPIRED' });
    
            const [[user]] = await connection.query('SELECT id, username, balance, xp FROM users WHERE id = ? FOR UPDATE', [req.userId]);
    
            if (promo.minLvl) {
                const lvl = getUserLevel(user.xp);
                if (lvl < promo.minLvl) return res.status(400).json({ error: 'INSUFFICIENT_LEVEL' });
            }
    
            const [[userPromo]] = await connection.query('SELECT id FROM promoCodeUses WHERE userId = ? AND promoCodeId = ?', [req.userId, promo.id]);
            if (userPromo) return res.status(400).json({ error: 'ALREADY_USED_CODE' });
    
            await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [promo.amount, user.id]);
            await connection.query('UPDATE promoCodes SET currentUses = currentUses + 1 WHERE id = ?', [promo.id]);
            const [result] = await connection.query('INSERT INTO promoCodeUses (userId, promoCodeId) VALUES (?, ?)', [user.id, promo.id]);
            await connection.query('INSERT INTO transactions (userId, amount, type, method, methodId) VALUES (?, ?, ?, ?, ?)', [user.id, promo.amount, 'in', 'promo', result.insertId]);
    
            await commit();
    
            sendLog('promo', `Promo code \`${promo.code}\` of $${promo.amount} redeemed by *${user.username}* (\`${user.id}\`) - Uses: \`${promo.currentUses + 1}/${promo.totalUses}\``);
            io.to(user.id).emit('balance', 'set', roundDecimal(user.balance + promo.amount))
            res.json({ success: true });

        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

});

module.exports = router;