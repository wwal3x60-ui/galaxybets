'use strict';

const { firstEligibleBetId: activationBetId } = require('./affiliate-config');

function positiveId(value) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
        throw new Error('Unsafe numeric ID');
    }

    const text = String(value);

    if (!/^[1-9]\d{0,19}$/.test(text) || BigInt(text) > 18446744073709551615n) {
        throw new Error('Invalid ID');
    }

    return text;
}

function units(value, scale) {
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));

    if (!match || (match[3] || '').length > scale) {
        throw new Error('Invalid database decimal');
    }

    const amount = BigInt(
        match[2] + (match[3] || '').padEnd(scale, '0')
    );

    return match[1] ? -amount : amount;
}

function decimal(value, scale) {
    const text = value.toString().padStart(scale + 1, '0');
    return text.slice(0, -scale) + '.' + text.slice(-scale);
}

// Accrue to the affiliate wallet; payout requires an explicit eligible withdrawal.
// Call only inside the settlement transaction.
// The caller must commit or roll back the entire transaction.
async function creditAffiliateCommission(connection, betId, firstEligibleBetId = activationBetId) {
    const id = positiveId(betId);
    const firstId = positiveId(firstEligibleBetId);

    if (BigInt(id) < BigInt(firstId)) {
        return { status: 'before_activation' };
    }

    const [[bet]] = await connection.query(
        `SELECT CAST(userId AS CHAR) AS userId,
                CAST(edge AS CHAR) AS edgeAmount, completed
         FROM bets WHERE id = ? FOR UPDATE`,
        [id]
    );

    if (!bet || Number(bet.completed) !== 1) {
        return { status: 'not_completed' };
    }

    const [[existing]] = await connection.query(
        'SELECT betId FROM affiliateCommissions WHERE betId = ?',
        [id]
    );

    if (existing) {
        return { status: 'already_recorded' };
    }

    const edgeCents = units(bet.edgeAmount, 2);

    if (edgeCents <= 0n) {
        return { status: 'no_edge' };
    }

    const [[referral]] = await connection.query(
        `SELECT CAST(a.affiliateId AS CHAR) AS affiliateId
         FROM affiliates AS a
         JOIN bets AS b ON b.id = ? AND b.userId = a.userId
         JOIN users AS player ON player.id = a.userId
         JOIN users AS referrer ON referrer.id = a.affiliateId
         WHERE a.userId = ? AND a.affiliateId <> a.userId
           AND b.createdAt >= a.createdAt AND b.id >= a.firstBetId
           AND player.role <> 'BOT' AND referrer.role <> 'BOT'
         ORDER BY a.id ASC LIMIT 1 FOR UPDATE`,
        [id, bet.userId]
    );

    if (!referral) {
        return { status: 'no_eligible_referral' };
    }

    const affiliateId = positiveId(referral.affiliateId);

    await connection.query(
        `INSERT INTO affiliateWallets (userId, remainder) VALUES (?, 0)
         ON DUPLICATE KEY UPDATE userId = userId`,
        [affiliateId]
    );

    const [[wallet]] = await connection.query(
        `SELECT CAST(remainder AS CHAR) AS remainder
         FROM affiliateWallets WHERE userId = ? FOR UPDATE`,
        [affiliateId]
    );

    const oldRemainder = units(wallet.remainder, 8);

    if (oldRemainder < 0n || oldRemainder >= 1000000n) {
        throw new Error('Invalid affiliate wallet remainder');
    }

    // Exactly 3% of recorded edge, calculated with integer arithmetic.
    const commission = edgeCents * 30000n;
    const available = commission + oldRemainder;
    const creditCents = available / 1000000n;
    const remainder = available % 1000000n;

    const balanceCredit = decimal(creditCents, 2);
    const commissionAmount = decimal(commission, 8);

    await connection.query(
        `INSERT INTO affiliateCommissions
         (betId, affiliateId, referredUserId, edgeAmount,
          commissionRate, commissionAmount, balanceCredit)
         VALUES (?, ?, ?, ?, 0.0300, ?, ?)`,
        [
            id,
            affiliateId,
            bet.userId,
            bet.edgeAmount,
            commissionAmount,
            '0.00'
        ]
    );

    await connection.query(
        `UPDATE affiliateWallets SET remainder = ?, available = available + ? WHERE userId = ?`,
        [decimal(remainder, 8), balanceCredit, affiliateId]
    );

    return {
        status: 'recorded',
        affiliateId,
        commissionAmount,
        balanceCredit: '0.00',
        walletCredit: balanceCredit
    };
}

// Settle already-completed bet rows using their real bets.id values.
// The caller passes its active transaction connection and commits once.
async function creditAffiliateGameBets(connection, game, gameIds) {
    if (!Array.isArray(gameIds)) throw new Error('Expected game IDs');
    const ids = [...new Set(gameIds.map(positiveId))];
    if (!ids.length) return [];
    const [bets] = await connection.query(
        `SELECT CAST(id AS CHAR) AS id FROM bets
         WHERE game = ? AND gameId IN (?) AND completed = 1 AND id >= ?
         ORDER BY id ASC FOR UPDATE`,
        [game, ids, activationBetId]
    );
    const credits = [];
    for (const bet of bets) {
        const result = await creditAffiliateCommission(connection, bet.id);
        if (result.status === 'recorded') credits.push(result);
    }
    return credits;
}

// Call only AFTER commit. A notification failure must not retry settlement.
function emitAffiliateCredits(credits) {
    try {
        const io = require('../socketio/server');
        const totals = new Map();
        for (const credit of credits) {
            const cents = units(credit.balanceCredit, 2);
            if (cents > 0n) {
                totals.set(credit.affiliateId,
                    (totals.get(credit.affiliateId) || 0n) + cents);
            }
        }
        for (const [affiliateId, cents] of totals) {
            io.to(String(affiliateId)).emit('balance', 'add', Number(decimal(cents, 2)));
        }
    } catch (error) {
        console.error('Affiliate balance notification failed:', error.message);
    }
}

// Retry only known rollback-safe locking errors in settlement callbacks.
// Never retry after commit, or on an ambiguous connection/commit failure.
async function withAffiliateSettlement(callback) {
    const { doTransaction } = require('../database');
    for (let attempt = 0; ; attempt++) {
        let committed = false;
        try {
            return await doTransaction((connection, commit, rollback) => callback(
                connection,
                async () => { await commit(); committed = true; },
                rollback
            ));
        } catch (error) {
            if (committed || attempt >= 2 ||
                !['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw error;
            await new Promise(resolve => setTimeout(resolve, 30 * (attempt + 1)));
        }
    }
}

module.exports = {
    creditAffiliateCommission,
    creditAffiliateGameBets,
    emitAffiliateCredits,
    withAffiliateSettlement,
    positiveId, units, decimal
};
