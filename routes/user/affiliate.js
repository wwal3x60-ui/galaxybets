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

const referralSwitch = require('../../utils/referral-switch');
let cachedAffiliates = {};
router.get('/referral-policy', apiLimiter, async (_req,res) => {
 try { await sql.query('SELECT id FROM affiliateReferralHistory LIMIT 0');res.json({version:referralSwitch.VERSION,cooldownDays:15}); }
 catch { res.status(503).json({error:'REFERRAL_SWITCH_NOT_READY'}); }
});

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
        totalDeposited: info.totalDeposited,
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
    try {
        const result = await doTransaction(async (connection, commit) => {
            const value = await referralSwitch.applyCode(connection, req.userId, req.body?.code, req.ip || req.socket?.remoteAddress || '');
            await commit();
            return value;
        });
        for (const id of [req.userId,result.previousAffiliateId,result.affiliateId]) if(id!=null) delete cachedAffiliates[id];
        res.json({success:true,reward:0,reused:result.reused,code:result.code});
        if(!result.reused) sendLog('affiliate', `*${result.userName}* (\`${req.userId}\`) linked code \`${result.code}\` of *${result.ownerName}* (\`${result.affiliateId}\`).`);
    } catch(error) {
        if(error.publicError)return res.status(error.status||400).json({error:error.publicError,changeAvailableAt:error.changeAvailableAt});
        if(error.code==='ER_DUP_ENTRY')return res.status(409).json({error:'AFFILIATE_LINK_CONFLICT'});
        console.error('Referral update failed:',error.code||error.message);
        if(!res.headersSent)res.status(500).json({error:'INTERNAL_ERROR'});
    }
});

router.get('/usedCode', isAuthed, async (req, res) => {
    try { res.json(referralSwitch.publicLink(await referralSwitch.readLink(sql,req.userId))); }
    catch(error) { res.status(error.status||500).json({error:error.publicError||'INTERNAL_ERROR'}); }
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
         FROM ${referralSwitch.periods} AS affiliates
         INNER JOIN users ON users.id = affiliates.userId
         LEFT JOIN bets ON bets.userId = users.id
            AND bets.createdAt >= affiliates.createdAt AND (bets.id >= affiliates.firstBetId OR bets.id < ${affiliateFirstEligibleBetId})
            AND (affiliates.endBetId IS NULL OR bets.id < affiliates.endBetId) AND bets.completed = 1
         WHERE affiliates.affiliateId = ?
         GROUP BY users.id, users.username, users.xp
         ORDER BY totalEdge DESC`,
        [affiliateFirstEligibleBetId, lastClaimDate, userId]
    );

    const [deposits] = await connection.query(
        `SELECT a.userId,COALESCE(SUM(t.amount),0) AS totalDeposited,COUNT(t.id) AS depositCount
         FROM ${referralSwitch.periods} a LEFT JOIN transactions t ON t.userId=a.userId
           AND t.createdAt>=a.createdAt AND (a.endedAt IS NULL OR t.createdAt<a.endedAt) AND t.status='approved' AND t.type IN ('deposit','crypto_deposit')
         WHERE a.affiliateId=? GROUP BY a.userId`,[userId]
    );
    const depositsByUser=new Map(deposits.map(row=>[String(row.userId),row]));

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

        user.totalDeposited = Number(depositsByUser.get(String(user.id))?.totalDeposited || 0);
        user.depositCount = Number(depositsByUser.get(String(user.id))?.depositCount || 0);
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
        totalDeposited: roundDecimal(users.reduce((sum,u)=>sum+u.totalDeposited,0)),
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