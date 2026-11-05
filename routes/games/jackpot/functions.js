const { sql, doTransaction } = require('../../../database');
const { newBets } = require('../../../socketio/bets');
const { sleep, roundDecimal } = require('../../../utils');
const { sha256, generateServerSeed } = require('../../../fairness');
const { getEOSBlockNumber, waitForEOSBlock } = require('../../../fairness/eos');
const io = require('../../../socketio/server');
const crypto = require('crypto');

const jackpot = {
    round: {},
    bets: [],
    timeLeft: 60,
    spinning: false,
    config: {
        betTime: 60000,
        rollTime: 5000,
        minBet: 0.2,
        maxBet: 10000
    }
};

async function getJackpotBets(roundId) {
    const [bets] = await sql.query(`
        SELECT jackpotBets.userId, users.username, users.role, users.xp, users.anon,
            jackpotBets.ticketsFrom, jackpotBets.ticketsTo, jackpotBets.amount, jackpotBets.id
        FROM jackpotBets
        INNER JOIN users ON users.id = jackpotBets.userId
        WHERE jackpotBets.jackpotId = ?
        ORDER BY jackpotBets.id ASC
    `, [roundId]);

    return bets.map(bet => ({
        id: bet.id,
        user: {
            id: bet.userId,
            username: bet.username,
            role: bet.role,
            xp: bet.xp,
            anon: bet.anon
        },
        amount: bet.amount,
        ticketsFrom: bet.ticketsFrom,
        ticketsTo: bet.ticketsTo
    }));
}

async function broadcastJackpotState(roundId = jackpot.round.id) {
    const [rounds] = await sql.query('SELECT amount FROM jackpot WHERE id = ?', [roundId]);
    const updatedBets = await getJackpotBets(roundId);
    const newTotalAmount = rounds[0]?.amount ?? 0;

    jackpot.bets = updatedBets;
    jackpot.round.amount = newTotalAmount;
    io.to('jackpot').emit('jackpot:bets', updatedBets);
    io.to('jackpot').emit('jackpot:amount', newTotalAmount);
}

const combine = (serverSeed, clientSeed) => {
    return crypto.createHmac('sha256', serverSeed).update(clientSeed).digest('hex');
}

// returns a float between 0 and 1
const getFloatResult = hashedValue => {
    let decimalNumber = parseInt(hashedValue, 16);
    let maxDecimalValue = parseInt('f'.repeat(64), 16);
    let floatNumber = decimalNumber / (maxDecimalValue - 1);
    return Number(floatNumber.toFixed(7));
};

async function getJackpotRound() {

    const [[round]] = await sql.query('SELECT * FROM jackpot WHERE endedAt IS NULL ORDER BY id ASC LIMIT 1');

    if (!round) {

        const now = new Date();
        const serverSeed = generateServerSeed();
        const [result] = await sql.query('INSERT INTO jackpot (serverSeed, createdAt) VALUES (?, ?)', [serverSeed, now]);

        return {
            id: result.insertId,
            amount: 0,
            winnerBet: null,
            ticket: null,
            serverSeed,
            EOSBlock: null,
            clientSeed: null,
            new: true,
            createdAt: now,
            rolledAt: null,
            endedAt: null
        }

    }

    return round;

}

let unhashedSeed = false;

async function updateJackpot() {

    const round = await getJackpotRound();
    if (!round) return;

    unhashedSeed = round.serverSeed;
    round.serverSeed = sha256(round.serverSeed);

    jackpot.round = round;
    
    if (!jackpot.round.new) {

        const bets = await getJackpotBets(round.id);

        if (bets.length) {
            jackpot.bets = bets;
        } else {
            jackpot.bets = [];
        }

    } else {
        delete jackpot.round.new;
        jackpot.bets = [];
    }

    jackpot.spinning = Boolean(round.EOSBlock || round.rolledAt);
    jackpot.timeLeft = jackpot.spinning ? 0 : jackpot.config.betTime / 1000;

    const newRound = {
        ...jackpot.round,
        bets: [],
        config: jackpot.config,
        timeLeft: jackpot.timeLeft,
        spinning: jackpot.spinning
    };
    io.to('jackpot').emit('jackpot:newRound', newRound);
    io.to('jackpot').emit('jackpot:new', newRound);
    io.to('jackpot').emit('jackpot:tick', jackpot.timeLeft);

    if (jackpot.bets.length) {
        io.to('jackpot').emit('jackpot:bets', jackpot.bets);
    }

}

async function cacheJackpot() {

    await updateJackpot();
    startJackpotTimer();

}

let jackpotTimer;
let jackpotProcessing = false;

function startJackpotTimer() {
    if (jackpotTimer) return;

    jackpotTimer = setInterval(() => {
        if (jackpot.spinning) {
            io.to('jackpot').emit('jackpot:tick', 0);
            if (!jackpotProcessing) processJackpotRound();
            return;
        }

        jackpot.timeLeft = Math.max(0, jackpot.timeLeft - 1);
        io.to('jackpot').emit('jackpot:tick', jackpot.timeLeft);

        if (jackpot.timeLeft === 0) {
            jackpot.spinning = true;
            jackpot.round.bettingClosed = true;
            processJackpotRound();
        }
    }, 1000);
}

function processJackpotRound() {
    if (jackpotProcessing) return;
    jackpotProcessing = true;

    finishJackpotRound()
        .catch(error => {
            console.error('Unable to finish Jackpot round:', error);
        })
        .finally(() => {
            jackpotProcessing = false;
        });
}

async function finishJackpotRound() {
    const round = jackpot.round;
    if (!round.id) throw new Error('Cannot finish a Jackpot round without an id');

    if (round.endedAt) {
        await updateJackpot();
        io.to('jackpot').emit('jackpot:tick', jackpot.timeLeft);
        return;
    }

    if (!round.rolledAt && jackpot.bets.length) {
        let commitTo = round.EOSBlock;

        if (!commitTo) {
            const blockNumber = await getEOSBlockNumber();
            commitTo = blockNumber + 2;
            await sql.query('UPDATE jackpot SET EOSBlock = ? WHERE id = ?', [commitTo, round.id]);

            round.EOSBlock = commitTo;
            io.to('jackpot').emit('jackpot:commit', commitTo);
        }

        const clientSeed = round.clientSeed || await waitForEOSBlock(commitTo);
        const getBetWeight = bet => Number(bet.amount) * (bet.user.role === 'BOT' ? 1.3 : 1);
        const totalWeight = jackpot.bets.reduce((total, bet) => total + getBetWeight(bet), 0);
        if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
            throw new Error(`Invalid total Jackpot weight for round ${round.id}`);
        }

        const weightedRoll = getFloatResult(combine(unhashedSeed, clientSeed)) * totalWeight;
        let cumulativeWeight = 0;
        const winner = jackpot.bets.find(bet => {
            cumulativeWeight += getBetWeight(bet);
            return weightedRoll < cumulativeWeight;
        });
        if (!winner) throw new Error(`No winning Jackpot bet found for round ${round.id}`);
        const winnerTicket = Math.floor(weightedRoll * 100);

        const rolledAt = new Date();
        round.winnerTicket = winnerTicket;
        round.serverSeed = unhashedSeed;
        round.clientSeed = clientSeed;
        round.winnerBet = winner.id;
        round.rolledAt = rolledAt;

        await sql.query(
            'UPDATE jackpot SET rolledAt = ?, ticket = ?, clientSeed = ?, winnerBet = ? WHERE id = ?',
            [rolledAt, winnerTicket, clientSeed, winner.id, round.id]
        );
        const totalAmount = roundDecimal(Number(round.amount));
        const userBet = roundDecimal(jackpot.bets
            .filter(bet => String(bet.user.id) === String(winner.user.id))
            .reduce((amount, bet) => amount + Number(bet.amount), 0));
        const winnerWeight = jackpot.bets
            .filter(bet => String(bet.user.id) === String(winner.user.id))
            .reduce((weight, bet) => weight + getBetWeight(bet), 0);
        io.to('jackpot').emit(
            'jackpot:roll',
            round.id,
            unhashedSeed,
            clientSeed,
            winner.id,
            winnerTicket,
            {
                user: {
                    ...winner.user,
                    username: winner.user.username
                },
                amount: userBet,
                totalAmount,
                chance: (winnerWeight / totalWeight) * 100
            }
        );
    }

    if (jackpot.bets.length) {
        await sleep(jackpot.config.rollTime);

        const endedAt = new Date();
        await doTransaction(async (connection, commit) => {
            await connection.query('UPDATE jackpot SET endedAt = ? WHERE id = ?', [endedAt, round.id]);

            const socketBets = [];
            const betIds = [];
            const winnings = roundDecimal(round.amount);
            let winnerBalance;

            for (const bet of jackpot.bets) {
                betIds.push(bet.id);
                let won = 0;

                if (bet.id == round.winnerBet) {
                    won = winnings;
                    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [won, bet.user.id]);
                    winnerBalance = { userId: bet.user.id, amount: won };
                }

                socketBets.push({
                    user: bet.user,
                    amount: bet.amount,
                    edge: 0,
                    payout: won,
                    game: 'jackpot'
                });
            }

            await connection.query(`
                UPDATE bets SET completed = 1, winnings = CASE WHEN gameId = ? THEN ? ELSE 0 END
                WHERE game = ? AND gameId IN(?)`,
                [round.winnerBet, winnings, 'jackpot', betIds]
            );

            await commit();
            round.endedAt = endedAt;
            if (winnerBalance) {
                io.to(winnerBalance.userId).emit('balance', 'add', winnerBalance.amount);
            }
            newBets(socketBets);
        });
    } else {
        const endedAt = new Date();
        await sql.query('UPDATE jackpot SET endedAt = ? WHERE id = ?', [endedAt, round.id]);
        round.endedAt = endedAt;
    }

    io.emit('jackpot:reset');
    await updateJackpot();
    io.to('jackpot').emit('jackpot:tick', jackpot.timeLeft);
}

async function makeBotJoin(amount = jackpot.round.amount) {

    try {

        await doTransaction(async (connection, commit) => {

            await connection.query('SELECT id FROM jackpot WHERE id = ? FOR UPDATE', [jackpot.round.id]);

            const [[bot]] = await connection.query('SELECT id, username, role, xp FROM users WHERE role = ? LIMIT 1', ['BOT']);
            if (!bot) return console.warn('No bot found jackpot');
    
            const ticketsFrom = jackpot.round.amount * 100;
            const ticketsTo = ticketsFrom + (amount * 100) - 1;
    
            const [jackpotBetResult] = await connection.query('INSERT INTO jackpotBets (userId, jackpotId, amount, ticketsFrom, ticketsTo) VALUES (?, ?, ?, ?, ?)', [bot.id, jackpot.round.id, amount, ticketsFrom, ticketsTo]);
            const [betResult] = await connection.query('INSERT INTO bets (userId, amount, edge, game, gameId, completed) VALUES (?, ?, ?, ?, ?, ?)', [bot.id, amount, 0, 'jackpot', jackpotBetResult.insertId, false]);
    
            jackpot.round.amount = roundDecimal(jackpot.round.amount + amount);
            await connection.query('UPDATE jackpot SET amount = ? WHERE id = ?', [jackpot.round.amount, jackpot.round.id]);
            
            await commit();
    
            await broadcastJackpotState(jackpot.round.id);
            
        });

    } catch (e) {
        console.error(e);
    }

}

async function syncLoadTestBet(betId, jackpotId) {

    if (jackpot.spinning || jackpot.timeLeft <= 0) return false;

    const [[round]] = await sql.query(
        'SELECT id, amount, rolledAt, endedAt FROM jackpot WHERE id = ?',
        [jackpotId]
    );
    if (!round || round.rolledAt || round.endedAt || Number(jackpot.round.id) !== jackpotId) return false;

    const [[record]] = await sql.query(`
        SELECT jackpotBets.id, jackpotBets.userId, jackpotBets.jackpotId, jackpotBets.amount,
            jackpotBets.ticketsFrom, jackpotBets.ticketsTo, users.username, users.role, users.xp, users.anon,
            users.balance
        FROM jackpotBets
        INNER JOIN users ON users.id = jackpotBets.userId
        WHERE jackpotBets.id = ? AND jackpotBets.jackpotId = ? AND users.role = ?
    `, [betId, jackpotId, 'BOT']);
    if (!record) return false;

    const alreadyCached = jackpot.bets.some(bet => Number(bet.id) === betId);
    if (!alreadyCached) {
        jackpot.bets.push({
            id: record.id,
            user: {
                id: record.userId,
                username: record.username,
                role: record.role,
                xp: record.xp,
                anon: record.anon
            },
            amount: record.amount,
            ticketsFrom: record.ticketsFrom,
            ticketsTo: record.ticketsTo
        });
    }

    jackpot.round.amount = round.amount;
    await broadcastJackpotState(jackpotId);
    io.to(String(record.userId)).emit('balance', 'set', roundDecimal(Number(record.balance)));

    return true;
}

module.exports = {
    cacheJackpot,
    makeBotJoin,
    jackpot,
    syncLoadTestBet,
    broadcastJackpotState
}
