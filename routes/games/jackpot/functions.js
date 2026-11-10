const {MAX_BET_USD}=require('../../../utils/bet-limits');
const { creditAffiliateGameBets, emitAffiliateCredits, withAffiliateSettlement } = require('../../../utils/affiliate-commission');
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
        maxBet: MAX_BET_USD
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

    if (String(jackpot.round.id) !== String(roundId)) return;
    jackpot.bets = updatedBets;
    jackpot.round.amount = newTotalAmount;
    io.to('jackpot').emit('jackpot:bets', updatedBets);
    io.to('jackpot').emit('jackpot:amount', newTotalAmount);
}

const {ensureBots}=require('../../../utils/jackpot-bots');
const {jackpotWinner}=require('../../../utils/fair-ticket');
async function ensureJackpotBot(){await ensureBots(sql);}

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
    if (!jackpot.spinning) await startCountdown(round.countStartedAt);

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

    await loadJackpotFromDatabase();
    startJackpotTimer();

}

async function loadJackpotFromDatabase() {
    await ensureJackpotBot();
    const round = await getJackpotRound();
    unhashedSeed = round.serverSeed;
    round.serverSeed = sha256(round.serverSeed);
    jackpot.round = round;
    jackpot.bets = await getJackpotBets(round.id);
    jackpot.round.amount = Number(round.amount) || 0;
    jackpot.spinning = Boolean(round.EOSBlock || round.rolledAt);

    if (!jackpot.spinning) {
        await startCountdown(round.countStartedAt);
        if (jackpot.timeLeft <= 0) {
            jackpot.spinning = true;
            jackpot.round.bettingClosed = true;
        }
    } else {
        jackpot.timeLeft = 0;
    }

    return jackpot;
}

let jackpotTimer;
let jackpotProcessing = false;

async function startCountdown(countStartedAt = new Date()) {
    const startedAt = countStartedAt ? new Date(countStartedAt) : new Date();
    const validStartedAt = Number.isNaN(startedAt.getTime()) ? new Date() : startedAt;
    jackpot.round.countStartedAt = validStartedAt;
    jackpot.timeLeft = Math.max(
        0,
        Math.ceil((jackpot.config.betTime - (Date.now() - validStartedAt.getTime())) / 1000)
    );
    await sql.query('UPDATE jackpot SET countStartedAt = ? WHERE id = ?', [validStartedAt, jackpot.round.id]);
    io.to('jackpot').emit('jackpot:countStart', validStartedAt);
}

function startJackpotTimer() {
    if (jackpotTimer) return;

    let tickBusy=false;
    jackpotTimer = setInterval(async () => {
        if(tickBusy)return;tickBusy=true;try{
        if (jackpot.spinning) {
            io.to('jackpot').emit('jackpot:tick', 0);
            if (!jackpotProcessing) processJackpotRound();
            return;
        }

        await broadcastJackpotState(jackpot.round.id);
        jackpot.timeLeft=Math.max(0,Math.ceil((new Date(jackpot.round.countStartedAt).getTime()+jackpot.config.betTime-Date.now())/1000));
        io.to('jackpot').emit('jackpot:tick', jackpot.timeLeft);

        if (jackpot.timeLeft === 0) {
            jackpot.spinning = true;
            jackpot.round.bettingClosed = true;
            processJackpotRound();
        }
        }catch(e){console.error('Jackpot tick:',e.message);}finally{tickBusy=false;}
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
    if(jackpot.round.id&&!jackpot.round.rolledAt&&!jackpot.round.endedAt){
        await doTransaction(async(connection,commit)=>{
            const [[saved]]=await connection.query('SELECT amount FROM jackpot WHERE id=? FOR UPDATE',[jackpot.round.id]);
            const [entries]=await connection.query('SELECT jb.*,u.username,u.role,u.xp,u.anon FROM jackpotBets jb JOIN users u ON u.id=jb.userId WHERE jb.jackpotId=? ORDER BY jb.id',[jackpot.round.id]);
            jackpot.round.amount=Number(saved.amount);jackpot.bets=entries.map(b=>({...b,user:{id:b.userId,username:b.username,role:b.role,xp:b.xp,anon:b.anon}}));await commit();
        });
    }
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
        const selected=jackpotWinner(combine(unhashedSeed,clientSeed),jackpot.bets);
        const winner=selected.winner,winnerTicket=selected.ticket,totalWeight=selected.total/100;
        if(!winner)throw Error('Winning jackpot ticket has no owner');
        const getBetWeight=bet=>Number(bet.amount);

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
        await withAffiliateSettlement(async (connection, commit) => {
            const [[saved]] = await connection.query(
                'SELECT endedAt FROM jackpot WHERE id = ? FOR UPDATE', [round.id]
            );
            if (!saved) throw new Error('Jackpot no longer exists');
            if (saved.endedAt) {
                await commit();
                round.endedAt = saved.endedAt;
                return;
            }
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

            const credits = await creditAffiliateGameBets(connection, 'jackpot', betIds);
            await commit();
            emitAffiliateCredits(credits);
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

async function makeBotJoin(){return {joined:false,reason:'use-bot-worker'};}

module.exports = {
    cacheJackpot,
    makeBotJoin,
    jackpot,
    loadJackpotFromDatabase,
    startCountdown,
    broadcastJackpotState
}
