const {MAX_BET_USD}=require('../../../utils/bet-limits');
const { randomInt } = require('crypto');
const { sql, doTransaction } = require('../../../database');
const { newBets } = require('../../../socketio/bets');
const { creditAffiliateGameBets, emitAffiliateCredits } = require('../../../utils/affiliate-commission');
const { sleep, roundDecimal } = require('../../../utils');
const io = require('../../../socketio/server');

const colorsMultipliers = {
    0: 14,
    1: 2,
    2: 2,
    3: 7
};

// These two existing positions also win the comet side bet.
// Their original green/red colors remain unchanged.
const specialNumbers = Object.freeze([1, 8]);

function isRouletteBetWinner(betColor, result, resultColor) {
    if (Number(betColor) === 3) {
        return specialNumbers.includes(Number(result));
    }

    return Number(betColor) === Number(resultColor);
}

const roulette = {
    round: {},
    bets: [],
    last: [],
    timeLeft: 15,
    spinning: false,
    finishing: false,
    config: {
        maxBet: MAX_BET_USD,
        sideBet: {
            color: 3,
            multiplier: 7,
            winningNumbers: [...specialNumbers],
            maxBet: MAX_BET_USD
        },
        betTime: 15000,
        rollTime: 5000
    }
};

const lastResults = 100;

let rouletteTimer;
let finishRetryTimer;

function getColorForNumber(number) {
    if (number === 0) return 0;
    return number <= 7 ? 1 : 2;
}

function getColorName(color) {
    return ['gold', 'green', 'red'][color];
}

async function getRouletteRound() {
    const [[round]] = await sql.query(
        `SELECT *
         FROM roulette
         WHERE endedAt IS NULL
         ORDER BY id ASC
         LIMIT 1`
    );

    if (!round) return;

    const now = new Date();

    if (!round.createdAt) {
        await sql.query(
            'UPDATE roulette SET createdAt = ? WHERE id = ?',
            [now, round.id]
        );

        round.new = true;
    }

    return round;
}

async function updateRoulette() {
    let round = await getRouletteRound();

    if (!round) {
        await sql.query(
            `INSERT INTO roulette (result, color, createdAt)
             VALUES (?, ?, ?)`,
            [0, 0, new Date()]
        );

        round = await getRouletteRound();

        if (!round) {
            throw new Error('Unable to create the next roulette round.');
        }
    }

    roulette.round = round;
    roulette.spinning = Boolean(round.rolledAt);
    roulette.timeLeft = roulette.spinning
        ? 0
        : roulette.config.betTime / 1000;

    if (!roulette.round.new) {
        const [bets] = await sql.query(
            `SELECT
                rouletteBets.userId,
                users.username,
                users.xp,
                users.anon,
                rouletteBets.color,
                rouletteBets.amount,
                rouletteBets.id
             FROM rouletteBets
             INNER JOIN users ON users.id = rouletteBets.userId
             WHERE roundId = ?`,
            [round.id]
        );

        roulette.bets = bets.map(bet => ({
            id: bet.id,
            user: {
                id: bet.userId,
                username: bet.username,
                xp: bet.xp,
                anon: bet.anon
            },
            color: bet.color,
            amount: bet.amount
        }));
    } else {
        roulette.bets = [];
    }

    io.to('roulette').emit('roulette:new', {
        id: round.id,
        createdAt: round.createdAt,
        timeLeft: roulette.timeLeft,
        spinning: roulette.spinning
    });

    io.to('roulette').emit('roulette:tick', roulette.timeLeft);

    if (roulette.bets.length) {
        io.to('roulette').emit('roulette:bets', roulette.bets);
    }

    return true;
}

async function cacheRoulette() {
    const [last] = await sql.query(
        `SELECT result
         FROM roulette
         WHERE endedAt IS NOT NULL
         ORDER BY id DESC
         LIMIT ?`,
        [lastResults]
    );

    roulette.last = last.map(bet => bet.result);

    await updateRoulette();

    if (roulette.spinning) {
        finishRouletteWithRetry();
    }

    startRouletteTimer();
}

async function finishRouletteRound() {
    const round = roulette.round;

    if (round.endedAt) {
        await updateRoulette();
        return;
    }

    if (!round.rolledAt) {
        const winningNumber = randomInt(0, 15);
        const winningColor = getColorForNumber(winningNumber);
        const rolledAt = new Date();

        await doTransaction(async (connection, commit) => {
            const [[currentRound]] = await connection.query(
                'SELECT rolledAt FROM roulette WHERE id = ? FOR UPDATE',
                [round.id]
            );

            if (!currentRound) {
                throw new Error(
                    `Roulette round ${round.id} no longer exists.`
                );
            }

            if (!currentRound.rolledAt) {
                await connection.query(
                    `UPDATE roulette
                     SET result = ?, color = ?, rolledAt = ?
                     WHERE id = ?`,
                    [
                        winningNumber,
                        winningColor,
                        rolledAt,
                        round.id
                    ]
                );

                round.result = winningNumber;
                round.color = winningColor;
                round.rolledAt = rolledAt;
            } else {
                const [[savedRound]] = await connection.query(
                    `SELECT result, color, rolledAt
                     FROM roulette
                     WHERE id = ?`,
                    [round.id]
                );

                round.result = savedRound.result;
                round.color = savedRound.color;
                round.rolledAt = savedRound.rolledAt;
            }

            await commit();
        });
    }

    roulette.spinning = true;
    roulette.timeLeft = 0;

    if (!round.spinEmitted) {
        const winningColor = getColorName(round.color);

        console.log('ROULETTE SPINNING:', round.result);

        io.to('roulette').emit('roulette:spin', {
            id: round.id,
            winningNumber: round.result,
            winningColor,
            result: round.result,
            color: round.color
        });

        round.spinEmitted = true;
    }

    await sleep(roulette.config.rollTime);

    const socketBets = [];
    const balanceUpdates = [];
    const affiliateCredits = [];
    const endedAt = new Date();

    await doTransaction(async (connection, commit) => {
        const [[currentRound]] = await connection.query(
            'SELECT endedAt FROM roulette WHERE id = ? FOR UPDATE',
            [round.id]
        );

        if (!currentRound) {
            throw new Error(
                `Roulette round ${round.id} no longer exists.`
            );
        }

        if (currentRound.endedAt) {
            round.endedAt = currentRound.endedAt;
            await commit();
            return;
        }

        const [bets] = await connection.query(
            `SELECT
                rouletteBets.id,
                rouletteBets.userId,
                rouletteBets.color,
                rouletteBets.amount,
                users.username,
                users.xp,
                users.anon
             FROM rouletteBets
             LEFT JOIN users ON users.id = rouletteBets.userId
             WHERE rouletteBets.roundId = ?`,
            [round.id]
        );

        for (const bet of bets) {
            const amount = Number(bet.amount);

            const winnings = isRouletteBetWinner(
                bet.color,
                round.result,
                round.color
            )
                ? roundDecimal(
                    amount * colorsMultipliers[Number(bet.color)]
                )
                : 0;

            const user = {
                id: bet.userId,
                username: bet.username,
                xp: bet.xp,
                anon: bet.anon
            };

            if (winnings > 0) {
                await connection.query(
                    'UPDATE users SET balance = balance + ? WHERE id = ?',
                    [winnings, bet.userId]
                );

                balanceUpdates.push({
                    userId: bet.userId,
                    winnings
                });
            }

            await connection.query(
                `UPDATE bets
                 SET completed = 1, winnings = ?
                 WHERE game = ? AND gameId = ?`,
                [winnings, 'roulette', bet.id]
            );

            affiliateCredits.push(...await creditAffiliateGameBets(
                connection, 'roulette', [bet.id]
            ));

            socketBets.push({
                user,
                amount,
                edge: roundDecimal(amount * 0.05),
                payout: winnings,
                game: 'roulette'
            });
        }

        await connection.query(
            'UPDATE roulette SET endedAt = ? WHERE id = ?',
            [endedAt, round.id]
        );

        await commit();

        round.endedAt = endedAt;
    });

    for (const update of balanceUpdates) {
        io.to(update.userId).emit(
            'balance',
            'add',
            update.winnings
        );
    }

    emitAffiliateCredits(affiliateCredits);

    if (socketBets.length) {
        newBets(socketBets);
    }

    roulette.last.unshift(round.result);

    if (roulette.last.length > lastResults) {
        roulette.last.pop();
    }

    await updateRoulette();
}

function finishRouletteWithRetry() {
    if (roulette.finishing) return;

    roulette.finishing = true;

    finishRouletteRound()
        .catch(error => {
            console.error('Unable to finish roulette round:', error);

            finishRetryTimer = setTimeout(() => {
                finishRetryTimer = null;
                roulette.finishing = false;
                finishRouletteWithRetry();
            }, 1000);
        })
        .finally(() => {
            if (!finishRetryTimer) {
                roulette.finishing = false;
            }
        });
}

function startRouletteTimer() {
    if (rouletteTimer) return;

    rouletteTimer = setInterval(async () => {
        if (!roulette.round.id || roulette.spinning) return;

        if (roulette.timeLeft > 0) {
            roulette.timeLeft--;

            io.to('roulette').emit(
                'roulette:tick',
                roulette.timeLeft
            );
        }

        if (roulette.timeLeft === 0) {
            roulette.spinning = true;
            finishRouletteWithRetry();
        }
    }, 1000);
}

module.exports = {
    roulette,
    cacheRoulette
};