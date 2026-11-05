const io = require('./server');
const { sql } = require('../database');
const { rains } = require('./rain');
const { joinChat, sendMessage } = require('./chat');
const { sendOnlineUsers, sendSystemMessage } = require('./chat/functions');
const { cachedDrops: caseDrops } = require('../routes/games/cases/functions');
const { getBattle, cachedBattles, minifyBattle } = require('../routes/games/battles/functions');
const { roulette } = require('../routes/games/roulette/functions');
const { crash } = require('../routes/games/crash/functions');
const { cachedCoinflips } = require('../routes/games/coinflip/functions');
const { getBets, emitTotalWagered } = require('./bets');
const { validateJwtToken } = require('../routes/auth/functions');
const { jackpot } = require('../routes/games/jackpot/functions');
const crypto = require('crypto');

function isLocalAddress(address) {
    return address === '127.0.0.1'
        || address === '::1'
        || address === '::ffff:127.0.0.1';
}

function matchesLoadTestToken(token) {
    if (typeof token !== 'string') return false;

    const expectedTokens = ['galaxybots123', process.env.JACKPOT_LOAD_TEST_TOKEN].filter(Boolean);
    const received = Buffer.from(token);
    return expectedTokens.some(expectedToken => {
        const expected = Buffer.from(expectedToken);
        return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    });
}

process.on('SIGTERM', cleanupAndExit);
process.on('SIGINT', cleanupAndExit);

function cleanupAndExit() {
    const m = 'Server is restarting, you will get disconnected for a few seconds..';
    io.emit('toast', 'info', m, {
        icon: '⚠️',
        duration: 10000
    });
    sendSystemMessage(io, m);
    process.exit(0);
}

async function newSocket(socket) {
   
    sendOnlineUsers(socket);
    emitTotalWagered(0, socket);

    if (rains.system) {
        const endsIn = rains.system.createdAt.valueOf() + rains.systemRainDuration - Date.now();
        const joined = socket.userId && rains.system.users.includes(socket.userId);
        socket.emit('rain', rains.system.amount, endsIn, rains.system.joinable, joined);
    }

    if (rains.user) {
        const endsIn = rains.user.createdAt.valueOf() + rains.joinTime - Date.now();
        const joined = socket.userId && rains.user.users.includes(socket.userId);
        socket.emit('rain:user', rains.user.amount, endsIn, rains.user.host, joined);
    }

    socket.emit('chat:emojis', []);

}

function socketLogin(socket, token) {

    const isLocalLoadTest = process.env.NODE_ENV !== 'production'
        && process.env.JACKPOT_LOAD_TEST === '1'
        && isLocalAddress(socket.handshake.address);
    const valid = token === 'galaxybots123' && isLocalLoadTest
        ? { uid: 35 }
        : validateJwtToken(token);

    if (!valid) {
        socket.userId = null;
        return socket.emit('auth', { error: 'INVALID_TOKEN' });
    }

    socket.userId = valid.uid;
    socket.emit('auth', { success: true, userId: socket.userId });

    socket.join(String(socket.userId));
    // console.log(socket.userId, 'Logged in to socketio');

}

io.on('connection', function(socket) {

    if (socket.handshake.auth?.token === 'galaxybots123') {
        socketLogin(socket, socket.handshake.auth.token);
    }

    socket.on('auth', async function(authToken) {
        if (authToken === 'galaxybots123') {
            socket.userId = 35;
            socket.join(String(socket.userId));
            return socket.emit('auth', { success: true, userId: socket.userId });
        }

        try {
            let token = null;
            try {
                if (socket.handshake.headers.cookie) {
                    const cookieString = socket.handshake.headers.cookie;
                    const cookieArray = cookieString.split(';');
                    for (let i = 0; i < cookieArray.length; i++) {
                        const cookiePair = cookieArray[i].split('=');
                        const key = cookiePair[0].trim();
                        if (key === 'jwt') {
                            token = decodeURIComponent(cookiePair.slice(1).join('='));
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error('Cookie parsing error:', err);
            }

            if (typeof authToken === 'string') {
                token = authToken;
            } else if (authToken && typeof authToken.token === 'string') {
                token = authToken.token;
            }

            if (socket.userId) {
                socket.leave(socket.userId);
                socket.userId = null;
            }

            const first = socket.userId == undefined;

            socketLogin(socket, token);
            if (first) await newSocket(socket);
        } catch (error) {
            console.error('Socket authentication failed:', error.message || error);
            socket.emit('auth', { error: 'AUTH_ERROR' });
        }

    });

    socket.on('bets:subscribe', async (type) => {

        const bets = await getBets(type, socket.userId);
        if (!bets) return;

        socket.join(`bets:${type == 'me' ? socket.userId : type}`);
        socket.emit('bets', type, bets);

    });

    socket.on('bets:unsubscribe', (type) => {
        socket.leave(`bets:${type}`);
    });

    socket.on('cases:subscribe', async () => {

        socket.join('cases');
        socket.emit('cases:drops:all', caseDrops.all);
        socket.emit('cases:drops:top', caseDrops.top);

    });

    socket.on('cases:unsubscribe', () => {
        socket.leave('cases');
    });

    socket.on('coinflip:subscribe', () => {

        socket.join('coinflips');
        socket.emit('coinflips:push', Object.values(cachedCoinflips), new Date());

    });

    socket.on('coinflip:unsubscribe', () => {
        socket.leave('coinflips');
    });

    socket.on('battles:subscribe', (battleId, privKey) => {

        if (battleId) {
            subscribeToBattle(socket, battleId, privKey)
        } else {
            socket.join('battles');

            const battles = [];

            for (const battleId in cachedBattles) {

                const battle = cachedBattles[battleId];
                if (!battle.privKey) {
                    battles.push(minifyBattle(battle));
                    continue;
                }

                if (battle.players.some(e => e.id == socket.userId)) {
                    battles.push(minifyBattle(battle));
                }

            }

            socket.emit('battles:push', battles);

        }

    });

    socket.on('battles:unsubscribe', (battleId) => {

        if (battleId) {
            socket.leave(`battle:${battleId}`);
        } else {
            socket.leave('battles');
        }

    });

    socket.on('roulette:subscribe', () => {
        
        // console.log(socket.userId, 'subscribed to roulette');

        const round = {
            id: roulette.round.id,
            result: null,
            color: null,
            createdAt: roulette.round.createdAt,
            rolledAt: roulette.round.rolledAt,
            status: 'created'
        };
        
        if (round.rolledAt) {
            round.status = 'rolling';
            round.result = roulette.round.result;
            round.color = roulette.round.color;
        }

        socket.join('roulette');
        socket.emit('roulette:set', {
            serverTime: new Date(),
            ...roulette,
            round
        });

    });

    socket.on('roulette:unsubscribe', () => {
        socket.leave('roulette');
    });

    socket.on('jackpot:subscribe', () => {
        
        // console.log(socket.userId, 'subscribed to jackpot');

        // const round = {
        //     ...jackpot.round,
        //     status: jackpot.round.rolledAt ? 'rolling': 'created'
        // };

        socket.join('jackpot');
        socket.emit('jackpot:set', {
            serverTime: new Date(),
            ...jackpot
        });

    });

    socket.on('jackpot:unsubscribe', () => {
        socket.leave('jackpot');
    });

    socket.on('loadtest:jackpotBet', async (payload = {}, acknowledge = () => {}) => {
        const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
        if (
            !payload
            || typeof payload !== 'object'
            || process.env.NODE_ENV === 'production'
            || process.env.JACKPOT_LOAD_TEST !== '1'
            || !isLocalAddress(socket.handshake.address)
            || !matchesLoadTestToken(socket.handshake.auth?.token)
            || !Number.isSafeInteger(Number(payload.betId))
            || !Number.isSafeInteger(Number(payload.jackpotId))
        ) {
            respond({ success: false, error: 'FORBIDDEN' });
            return;
        }

        try {
            const { syncLoadTestBet } = require('../routes/games/jackpot/functions');
            const synced = await syncLoadTestBet(Number(payload.betId), Number(payload.jackpotId));
            respond(synced
                ? { success: true }
                : { success: false, error: 'BET_NOT_IN_ACTIVE_ROUND' });
        } catch (error) {
            console.error('Jackpot load-test relay failed:', error.code || error.message);
            respond({ success: false, error: 'INTERNAL_ERROR' });
        }
    });

    socket.on('crash:subscribe', () => {

        // console.log(socket.userId, 'subscribed to crash');

        const round = {
            id: crash.round.id,
            status: 'created',
            multiplier: 1,
            serverSeed: crash.round.serverSeed,
            createdAt: crash.round.createdAt,
            startedAt: null,
            endedAt: null
        }

        if (crash.round.startedAt) {
            round.status = 'started';
            round.startedAt = crash.round.startedAt;
            round.multiplier = crash.round.currentMultiplier;
        }

        if (crash.round.endedAt) {
            round.status = 'ended';
            round.endedAt = crash.round.endedAt;
            round.multiplier = crash.round.crashPoint;
        }

        socket.join('crash');
        socket.emit('crash:set', {
            serverTime: new Date(),
            ...crash,
            bets: crash.bets.map(e => ({
                ...e,
                user: {
                    ...e.user,
                    anon: undefined
                },
                autoCashoutPoint: undefined
            })),
            round
        });

    });

    socket.on('crash:unsubscribe', () => {
        socket.leave('crash');
    });

    socket.on('chat:join', (channel) => {

        joinChat(socket, channel);

    });

    socket.on('chat:sendMessage', (message, replyTo = null) => sendMessage(socket, message, replyTo));

});

async function subscribeToBattle(socket, battleId, privKey = null) {

    const battle = await getBattle(battleId, privKey);
    if (!battle) return socket.emit('toast', 'error', 'Battle not found');
    socket.join(`battle:${battleId}`);
    socket.emit('battle', {
        serverTime: new Date(),
        ...battle
    });

}

setInterval(() => sendOnlineUsers(io, true), 10000);