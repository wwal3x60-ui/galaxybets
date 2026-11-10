const express = require('express');
const router = express.Router();
const { randomBytes } = require('crypto');

const { sql, doTransaction } = require('../../database');
const { isAuthed, apiLimiter } = require('../auth/functions');
const { roundDecimal, sendLog } = require('../../utils');
const io = require('../../socketio/server');
const { enabledFeatures } = require('../admin/config');

const { minClaim, minDepositors, getQualifiedDepositors, withdrawAffiliateEarnings } = require('../../utils/affiliate-withdrawal');
const { withAffiliateSettlement, emitAffiliateCredits } = require('../../utils/affiliate-commission');
const { firstEligibleBetId: affiliateFirstEligibleBetId } = require('../../utils/affiliate-config');

let cachedAffiliates = {};

async function getAffiliateData(userId) {
    if (cachedAffiliates[userId]?.affiliateCode) {
        return cachedAffiliates[userId];
    }

    const affiliateCode = await getOrCreateAffiliateCode(userId);

    const [[user]] = await sql.query(
        'SELECT affiliateEarningsOffset FROM users WHERE id = ?',
        [userId]
    );

    const info = await getAffiliateInfo(
        userId,
        user.affiliateEarningsOffset
    );

    cachedAffiliates[userId] = {
        affiliateCode,
        lastClaim: info.lastClaimDate,
        unclaimedEarnings: info.unclaimedEarnings,
        totalWagered: info.totalWagered,
        totalEarnings: info.totalEarnings,
        totalCredited: info.totalCredited,
        legacyUnclaimedEarnings: info.legacyUnclaimedEarnings,
        fractionalRemainder: info.fractionalRemainder,
        commissionRate: 0.03,
        qualifiedDepositors: info.qualifiedDepositors,
        minDepositors,
        canClaim: Number(info.unclaimedEarnings) >= minClaim && info.qualifiedDepositors >= minDepositors,
        payoutMode: 'manual', 
        minClaim,
        referralsCount: info.users.length,
        users: info.users
    };

    setTimeout(() => {
        delete cachedAffiliates[userId];
    }, 2000);

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
            const affiliateCode = await doTransaction(
                async (connection, commit) => {
                    const [[user]] = await connection.query(
                        'SELECT affiliateCode FROM users WHERE id = ? FOR UPDATE',
                        [userId]
                    );

                    if (!user) {
                        throw new Error(
                            `User ${userId} was not found while creating an affiliate code.`
                        );
                    }

                    if (user.affiliateCode) {
                        await commit();
                        return user.affiliateCode;
                    }

                    const code = randomBytes(4).toString('hex');

                    await connection.query(
                        'UPDATE users SET affiliateCode = ? WHERE id = ?',
                        [code, userId]
                    );

                    await commit();
                    return code;
                }
            );

            delete cachedAffiliates[userId];
            return affiliateCode;
        } catch (e) {
            if (e.code !== 'ER_DUP_ENTRY' || attempt === 2) {
                throw e;
            }
        }
    }
}

const resultsPerPage = 6;

router.get('/users', isAuthed, async (req, res) => {
    const info = await getAffiliateData(req.userId);

    let page = parseInt(req.query.page);
    page = !isNaN(page) && page > 0 ? page : 1;

    const offset = (page - 1) * resultsPerPage;

    if (!info.users.length) {
        return res.json({
            page: 1,
            pages: 0,
            total: 0,
            data: []
        });
    }

    const pages = Math.ceil(info.users.length / resultsPerPage);

    if (page > pages) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND' });
    }

    const data = info.users.slice(offset, offset + resultsPerPage);

    res.json({
        page,
        pages,
        total: info.users.length,
        data
    });
});

router.use((req, res, next) => {
    if (!enabledFeatures.affiliates) {
        return res.status(400).json({ error: 'DISABLED' });
    }

    next();
});

// Claim all available whole cents into the site balance. This is not an
// external crypto withdrawal; that remains a separate cashier action.
router.post('/claim', [isAuthed, apiLimiter], async (req, res) => {
    try {
        const result = await withAffiliateSettlement(async (connection, commit) => {
            const value = await withdrawAffiliateEarnings(connection, req.userId, req.body?.requestId);
            await commit();
            return value;
        });
        delete cachedAffiliates[req.userId];
        if (!result.reused) emitAffiliateCredits([{ affiliateId: String(req.userId), balanceCredit: result.amount }]);
        return res.json({ success: true, claimedAmount: result.amount, withdrawalId: result.withdrawalId, count: 1 });
    } catch (error) {
        const codes = ['INVALID_REQUEST_ID', 'MIN_WITHDRAWAL', 'NOT_ENOUGH_DEPOSITORS', 'ACCOUNT_LOCKED'];
        if (codes.includes(error.code)) return res.status(400).json({ error: error.code, minClaim, minDepositors });
        console.error(error);
        return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

router.post('/', [isAuthed, apiLimiter], async (req, res) => {
    const rawCode = req.body?.code;
    const code = typeof rawCode === 'string' ? rawCode.toLowerCase().trim() : '';

    if (
        !code ||
        typeof code != 'string' ||
        code.length < 2 ||
        code.length > 20 ||
        !onlyLettersAndNumbers(code)
    ) {
        return res.status(400).json({ error: 'INVALID_CODE' });
    }

    try {
        await doTransaction(async (connection, commit) => {
            const [[affiliate]] = await connection.query(
                'SELECT id, username, role FROM users WHERE LOWER(affiliateCode) = LOWER(?) FOR UPDATE',
                [code]
            );

            if (!affiliate || affiliate.role === 'BOT') {
                return res.status(404).json({ error: 'CODE_NOT_FOUND' });
            }

            const [[affiliated]] = await connection.query(
                'SELECT userId FROM affiliates WHERE userId = ? OR ip = ? FOR UPDATE',
                [req.userId, req.ip || req.socket?.remoteAddress || '']
            );

            if (affiliated?.userId) {
                return res.status(400).json({
                    error: 'ALREADY_AFFILIATED'
                });
            }

            const [[user]] = await connection.query(
                'SELECT id, username, accountLock, sponsorLock, role FROM users WHERE id = ? FOR UPDATE',
                [req.userId]
            );

            if (!user || user.accountLock || user.sponsorLock || user.role === 'BOT') {
                return res.status(400).json({
                    error: 'ACCOUNT_LOCKED'
                });
            }

            if (user.id == affiliate.id) {
                return res.status(400).json({
                    error: 'CANT_REDEEM_OWN_CODE'
                });
            }

            const [[existingReferral]] = await connection.query(
                'SELECT userId FROM affiliates WHERE userId = ? FOR UPDATE', [user.id]
            );
            if (existingReferral) return res.status(400).json({ error: 'ALREADY_AFFILIATED' });
            const [[lastBet]] = await connection.query(
                'SELECT CAST(id AS CHAR) AS id FROM bets WHERE userId = ? ORDER BY id DESC LIMIT 1 FOR UPDATE',
                [user.id]
            );
            const firstBetId = (BigInt(lastBet?.id || '0') + 1n).toString();

            const [result] = await connection.query(
                'INSERT INTO affiliates (userId, affiliateId, affiliateReward, ip, firstBetId) VALUES (?, ?, 0, ?, ?)',
                [user.id, affiliate.id, req.ip || req.socket?.remoteAddress || '', firstBetId]
            );

            await commit();

            sendLog(
                'affiliate',
                `*${user.username}* (\`${user.id}\`) used code \`${code}\` of *${affiliate.username}* (\`${affiliate.id}\`) - #${result.insertId}`
            );

            // Keep reward: 0 for compatibility; linking never credits a balance.
            res.json({ success: true, reward: 0 });
        });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'ALREADY_AFFILIATED' });
        console.error(e);
        if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

router.get('/usedCode', isAuthed, async (req, res) => {
    const [[user]] = await sql.query(
        'SELECT users.affiliateCode, CAST(users.id AS CHAR) AS affiliateId FROM users JOIN affiliates ON affiliates.affiliateId = users.id WHERE affiliates.userId = ?',
        [req.userId]
    );

    if (!user) {
        return res.json({ code: null });
    }

    res.json({ code: user.affiliateCode, affiliateId: user.affiliateId });
});

const blacklistedCodes = [
    'free',
    'clash',
    '123',
    '1234',
    'blox',
    'rblxwild',
    'bloxflip',
    'rbxgold',
    'betbux',
    'freebux',
    'bux'
];

router.post('/code', [isAuthed, apiLimiter], async (req, res) => {
    const rawCode = req.body?.code;

    if (typeof rawCode !== 'string') {
        return res.status(400).json({ error: 'INVALID_CODE' });
    }

    const code = rawCode.trim().toLowerCase();

    if (
        code.length < 3 ||
        code.length > 15 ||
        !onlyLettersAndNumbers(code)
    ) {
        return res.status(400).json({ error: 'INVALID_CODE' });
    }

    if (blacklistedCodes.includes(code)) {
        return res.status(400).json({ error: 'INVALID_CODE' });
    }

    try {
        const [[user]] = await sql.query(
            'SELECT affiliateCodeLock FROM users WHERE id = ?',
            [req.userId]
        );

        if (user.affiliateCodeLock) {
            return res.status(400).json({ error: 'CODE_LOCKED' });
        }

        await doTransaction(async (connection, commit) => {
            const [[user]] = await connection.query(
                'SELECT id, username, balance, accountLock, sponsorLock, createdAt, role, affiliateCodeLock FROM users WHERE id = ? FOR UPDATE',
                [req.userId]
            );

            if (user?.affiliateCodeLock) return res.status(400).json({ error: 'CODE_LOCKED' });

            if (!user || user.accountLock || user.sponsorLock || user.role === 'BOT') {
                return res.status(400).json({
                    error: 'ACCOUNT_LOCKED'
                });
            }

            const [[affiliate]] = await connection.query(
                'SELECT id FROM users WHERE affiliateCode = ? AND id != ?',
                [code, req.userId]
            );

            if (affiliate) {
                return res.status(400).json({ error: 'CODE_TAKEN' });
            }

            await connection.query(
                'UPDATE users SET affiliateCode = ? WHERE id = ?',
                [code, req.userId]
            );

            await commit();

            delete cachedAffiliates[req.userId];

            res.json({ success: true, code });

            sendLog(
                'affiliate',
                `*${user.username}* (\`${user.id}\`) set his code to \`${code}\`.`
            );
        });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'CODE_TAKEN' });
        }

        console.error(e);
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
});

function onlyLettersAndNumbers(str) {
    return /^[A-Za-z0-9]*$/.test(str);
}

async function getAffiliateInfo(userId, offsetAmount, connection = sql) {
    const [[lastClaim]] = await connection.query(
        'SELECT createdAt FROM affiliateClaims WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
        [userId]
    );

    const lastClaimDate =
        lastClaim?.createdAt || new Date('2021-01-01 00:00:00');

    // Keep historical wager statistics, but freeze the old claim calculation
    // at the fixed cutoff. These old amounts are reported separately only.
    const [users] = await connection.query(
        `SELECT
            users.id, users.username, users.xp,
            COALESCE(SUM(bets.amount), 0) AS totalWagered,
            COALESCE(SUM(bets.edge), 0) AS totalEdge,
            COALESCE(SUM(CASE WHEN bets.id < ? AND bets.createdAt > ?
                THEN bets.edge ELSE 0 END), 0) AS legacyUnclaimedEdge,
            MIN(affiliates.createdAt) AS affiliatedAt
         FROM affiliates
         INNER JOIN users ON users.id = affiliates.userId
         LEFT JOIN bets ON bets.userId = users.id
            AND bets.createdAt >= affiliates.createdAt AND bets.id >= affiliates.firstBetId AND bets.completed = 1
         WHERE affiliates.affiliateId = ?
         GROUP BY users.id, users.username, users.xp
         ORDER BY totalEdge DESC`,
        [affiliateFirstEligibleBetId, lastClaimDate, userId]
    );

    // Aggregate separately so joining bets cannot multiply earnings.
    const [commissions] = await connection.query(
        `SELECT CAST(referredUserId AS CHAR) AS referredUserId,
                COALESCE(SUM(commissionAmount), 0) AS totalEarnings,
                COALESCE(SUM(balanceCredit), 0) AS totalCredited
         FROM affiliateCommissions
         WHERE affiliateId = ? AND betId >= ?
         GROUP BY referredUserId`,
        [userId, affiliateFirstEligibleBetId]
    );

    const [[totals]] = await connection.query(
        `SELECT COALESCE(SUM(commissionAmount), 0) AS totalEarnings,
                COALESCE(SUM(balanceCredit), 0) AS totalCredited
         FROM affiliateCommissions
         WHERE affiliateId = ? AND betId >= ?`,
        [userId, affiliateFirstEligibleBetId]
    );

    const [[wallet]] = await connection.query(
        'SELECT CAST(remainder AS CHAR) AS remainder, CAST(available AS CHAR) AS available FROM affiliateWallets WHERE userId = ?',
        [userId]
    );

    const [[withdrawals]] = await connection.query(
        'SELECT CAST(COALESCE(SUM(amount), 0) AS CHAR) AS total FROM affiliateWithdrawals WHERE userId = ?',
        [userId]
    );
    const qualifiedDepositors = await getQualifiedDepositors(connection, userId);

    const byUser = new Map(
        commissions.map(row => [String(row.referredUserId), row])
    );

    let totalWagered = 0;
    let legacyUnclaimedEarnings = 0;

    users.forEach(user => {
        const commission = byUser.get(String(user.id));

        user.totalWagered = Number(user.totalWagered);
        user.totalEdge = Number(user.totalEdge);

        user.totalEarnings = roundDecimal(
            Number(commission?.totalEarnings || 0),
            8
        );

        user.totalCredited = roundDecimal(
            Number(commission?.totalCredited || 0)
        );

        user.unclaimedEarnings = 0;

        user.legacyUnclaimedEarnings = roundDecimal(
            Number(user.legacyUnclaimedEdge) * 0.1
        );

        delete user.legacyUnclaimedEdge;

        totalWagered += user.totalWagered;
        legacyUnclaimedEarnings += user.legacyUnclaimedEarnings;
    });

    return {
        lastClaimDate,
        totalWagered: roundDecimal(totalWagered),
        totalEarnings: roundDecimal(Number(totals.totalEarnings), 8),
        totalCredited: roundDecimal(Number(totals.totalCredited) + Number(withdrawals.total)),
        unclaimedEarnings: wallet?.available || '0.00',
        qualifiedDepositors,
        legacyUnclaimedEarnings: roundDecimal(
            legacyUnclaimedEarnings + Number(offsetAmount || 0)
        ),
        fractionalRemainder: wallet?.remainder || '0.00000000',
        users
    };
}

module.exports = router;