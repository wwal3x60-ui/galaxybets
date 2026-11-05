require('dotenv').config({ quiet: true });

const { sql } = require('../database');

const MAX_BOTS_PER_ROUND = 2;
const HUMAN_BET_THRESHOLD = 50;
const MAX_USER_ROUND_BET = 20000;

function assertConfiguration() {
    if (process.env.JACKPOT_LOAD_TEST !== '1') {
        throw new Error('Set JACKPOT_LOAD_TEST=1 in the local test environment to enable the relay');
    }
    if (!process.env.JACKPOT_LOAD_TEST_TOKEN) {
        throw new Error('JACKPOT_LOAD_TEST_TOKEN must be configured for both the app and this script');
    }
    if (!process.env.SQL_USER || !process.env.SQL_DB || !process.env.SQL_PASS) {
        throw new Error('SQL_USER, SQL_DB, and SQL_PASS must be configured');
    }
}

function errorLabel(error) {
    return error?.code || error?.name || 'unknown error';
}

const socketUrl = process.env.NODE_ENV === 'production'
    ? 'https://galaxybets-1.onrender.com'
    : 'http://localhost:3001';

assertConfiguration();

const socket = require('socket.io-client')(socketUrl, {
    transports: ['websocket']
});

let stopped = false;
let currentRoundId = null;
let roundTimeLeft = 0;
const handledRoundIds = new Set();
const handledHumanBetIds = new Set();

function relayBet(betId, jackpotId) {
    return new Promise((resolve, reject) => {
        if (!socket.connected) {
            reject(new Error('Socket.IO is not connected to the local app'));
            return;
        }

        socket.timeout(5000).emit('loadtest:jackpotBet', {
            token: process.env.JACKPOT_LOAD_TEST_TOKEN,
            betId,
            jackpotId
        }, (error, response) => {
            if (error) {
                reject(new Error('The local app did not acknowledge the Jackpot test bet'));
                return;
            }
            if (!response?.success) {
                reject(new Error(response?.error || 'The local app rejected the Jackpot test bet'));
                return;
            }
            resolve();
        });
    });
}

async function placeBotBet(botId, betCents, targetJackpotId = null) {
    const connection = await sql.getConnection();
    let insertedBet;

    try {
        await connection.beginTransaction();

        const roundQuery = targetJackpotId
            ? 'SELECT id, amount FROM jackpot WHERE id = ? AND endedAt IS NULL AND rolledAt IS NULL FOR UPDATE'
            : 'SELECT id, amount FROM jackpot WHERE endedAt IS NULL AND rolledAt IS NULL ORDER BY id ASC LIMIT 1 FOR UPDATE';
        const roundParams = targetJackpotId ? [targetJackpotId] : [];
        const [[round]] = await connection.query(roundQuery, roundParams);
        if (!round) {
            await connection.rollback();
            return false;
        }

        const [[bot]] = await connection.query(
            'SELECT id, role FROM users WHERE id = ? AND role = ? FOR UPDATE',
            [botId, 'BOT']
        );
        if (!bot) {
            await connection.rollback();
            return false;
        }

        const amount = betCents / 100;
        const [[existingBets]] = await connection.query(
            'SELECT COALESCE(SUM(amount), 0) AS amount FROM jackpotBets WHERE userId = ? AND jackpotId = ?',
            [bot.id, round.id]
        );
        if (Number(existingBets.amount) + amount > MAX_USER_ROUND_BET) {
            await connection.rollback();
            return false;
        }

        const currentAmountCents = Math.round(Number(round.amount) * 100);
        const ticketsFrom = currentAmountCents;
        const ticketsTo = ticketsFrom + betCents - 1;
        const nextAmount = (currentAmountCents + betCents) / 100;

        const [betResult] = await connection.query(
            'INSERT INTO jackpotBets (userId, jackpotId, amount, ticketsFrom, ticketsTo) VALUES (?, ?, ?, ?, ?)',
            [bot.id, round.id, amount, ticketsFrom, ticketsTo]
        );
        await connection.query(
            'INSERT INTO bets (userId, amount, edge, game, gameId, completed) VALUES (?, ?, ?, ?, ?, ?)',
            [bot.id, amount, 0, 'jackpot', betResult.insertId, 0]
        );
        await connection.query('UPDATE jackpot SET amount = ? WHERE id = ?', [nextAmount, round.id]);

        await connection.commit();
        insertedBet = { id: Number(betResult.insertId), jackpotId: Number(round.id) };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    await relayBet(insertedBet.id, insertedBet.jackpotId);
    console.log(`Added local Jackpot test bet ${insertedBet.id} to round ${insertedBet.jackpotId}`);
    return true;
}

async function runRound(jackpotId) {
    const roundId = Number(jackpotId);
    if (
        stopped
        || !socket.connected
        || !Number.isSafeInteger(roundId)
        || roundTimeLeft <= 0
        || handledRoundIds.has(roundId)
    ) return;

    handledRoundIds.add(roundId);
    if (handledRoundIds.size > 100) {
        handledRoundIds.delete(handledRoundIds.values().next().value);
    }
    try {
        const numBots = Math.floor(Math.random() * MAX_BOTS_PER_ROUND) + 1;
        const [bots] = await sql.query(
            `SELECT id FROM users WHERE role = ? ORDER BY RAND() LIMIT ${numBots}`,
            ['BOT']
        );

        if (bots.length !== numBots) {
            throw new Error(`Requested ${numBots} bots, but only ${bots.length} are available`);
        }

        for (const bot of bots) {
            const roll = Math.random();
            let amount;
            if (roll < 0.4) {
                amount = 0.5 + Math.random() * (15 - 0.5);
            } else {
                amount = 0.5 + Math.random() * (7 - 0.5);
            }
            amount = Math.round(amount * 100) / 100;
            const botBetCents = Math.round(amount * 100);
            const placed = await placeBotBet(bot.id, botBetCents, roundId);
            if (!placed) {
                throw new Error(`Unable to place a scheduled bot bet in round ${roundId}`);
            }
        }
    } catch (error) {
        console.error('Jackpot load-test round failed:', errorLabel(error));
    }
}

async function handleHumanBet(bet) {
    const betId = Number(bet?.id);
    if (
        stopped
        || !Number.isSafeInteger(betId)
        || bet?.user?.role === 'BOT'
        || !Number.isFinite(Number(bet?.amount))
        || Number(bet.amount) < HUMAN_BET_THRESHOLD
        || handledHumanBetIds.has(betId)
    ) return;

    handledHumanBetIds.add(betId);
    try {
        const [[humanBet]] = await sql.query(`
            SELECT jb.jackpotId, jb.amount
            FROM jackpotBets jb
            INNER JOIN users u ON u.id = jb.userId
            WHERE jb.id = ? AND u.role <> ?
        `, [betId, 'BOT']);
        if (
            !humanBet
            || Number(humanBet.amount) < HUMAN_BET_THRESHOLD
            || Number(humanBet.jackpotId) !== currentRoundId
            || roundTimeLeft <= 0
        ) return;

        const [[round]] = await sql.query(
            'SELECT id FROM jackpot WHERE id = ? AND endedAt IS NULL AND rolledAt IS NULL',
            [humanBet.jackpotId]
        );
        if (!round) return;

        const [bots] = await sql.query(
            'SELECT id FROM users WHERE role = ? ORDER BY RAND() LIMIT 1',
            ['BOT']
        );
        if (!bots.length) return;

        const humanAmount = Number(humanBet.amount);
        if (!Number.isFinite(humanAmount)) return;
        const botAmount = humanAmount * (0.8 + Math.random() * 0.4);
        const botBetCents = Math.round(botAmount * 100);
        const placed = await placeBotBet(bots[0].id, botBetCents, Number(humanBet.jackpotId));

        if (placed) {
            console.log(`Simulated local high-bet concurrency for Jackpot bet ${betId}`);
        }
    } catch (error) {
        handledHumanBetIds.delete(betId);
        console.error('Jackpot load-test whale simulation failed:', errorLabel(error));
    }
}

async function shutdown() {
    if (stopped) return;
    stopped = true;
    socket.disconnect();

    try {
        await sql.end();
    } catch (error) {
        console.error('Failed to close Jackpot load-test database pool:', errorLabel(error));
        process.exitCode = 1;
    }
}

socket.on('connect', () => {
    console.log('Connected to local Socket.IO server for Jackpot load testing');
    socket.emit('jackpot:subscribe');
});

socket.on('jackpot:set', jackpot => {
    currentRoundId = Number(jackpot?.round?.id);
    roundTimeLeft = Number(jackpot?.timeLeft ?? 60);
    void runRound(currentRoundId);
});

socket.on('jackpot:newRound', round => {
    currentRoundId = Number(round?.id);
    roundTimeLeft = Number(round?.timeLeft ?? 60);
    void runRound(currentRoundId);
});

socket.on('jackpot:tick', seconds => {
    roundTimeLeft = Math.max(0, Number(seconds) || 0);
});

socket.on('jackpot:roll', () => {
    roundTimeLeft = 0;
});

socket.on('connect_error', error => {
    console.error('Jackpot load-test Socket.IO connection failed:', errorLabel(error));
});

socket.on('jackpot:bets', bets => {
    if (!Array.isArray(bets)) return;
    for (const bet of bets) {
        void handleHumanBet(bet);
    }
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
