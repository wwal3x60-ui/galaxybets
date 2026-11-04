require('dotenv').config();
const express = require('express');
const nocache = require("nocache");
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const rfs = require('rotating-file-stream');
const io = require('./socketio/server');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());

// Allow requests from your Vercel frontend
const frontendOrigin = process.env.FRONTEND_URL
    ? new URL(process.env.FRONTEND_URL).origin
    : false;

app.use(cors({
    origin: frontendOrigin,
    credentials: true
}));

app.options('*', (req, res) => {
    res.sendStatus(204);
});

app.set('view engine', 'ejs');
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets')));

if (process.env.NODE_ENV == 'development') {
    app.use(morgan('dev', {
        skip: (req, res) => req.url.endsWith('/img')
    }));
}

morgan.token('ip', function(req, res) {
    return req.headers['cf-connecting-ip']
});

morgan.token('user-agent', function(req, res) {
    return req.headers['user-agent']
});

const logDirectory = path.join(__dirname, 'logs');

const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',
    path: logDirectory,
    size: "10M",
});

app.use(morgan('[:date[clf]] :ip :method :url :status :response-time ms - :user-agent', {
    stream: accessLogStream,
    skip: (req, res) => req.url.endsWith('/img')
}));

app.use(bodyParser.json({
    verify: function (req, res, buf, encoding) {
        req.rawJsonBody = buf;
    }
}));

app.use(bodyParser.urlencoded({
    extended: true,
    verify: function (req, res, buf, encoding) {
        req.rawUrlBody = buf;
    }
}));

app.use(nocache());
app.use(cookieParser());

const authRoute = require('./routes/auth');
const userRoute = require('./routes/user');
const depositsRoute = require('./routes/user/deposits');
const withdrawalsRoute = require('./routes/user/withdrawals');
const itemsRoute = require('./routes/items');
const rainRoute = require('./routes/rain');
const leaderboardRoute = require('./routes/leaderboard');
const casesRoute = require('./routes/games/cases');
const battlesRoute = require('./routes/games/battles');
const rouletteRoute = require('./routes/games/roulette');
const crashRoute = require('./routes/games/crash');
const coinflipRoute = require('./routes/games/coinflip');
const jackpotRoute = require('./routes/games/jackpot');
const minesRoute = require('./routes/games/mines');
const blackjackRoute = require('./routes/games/blackjack');
const adminRoute = require('./routes/admin');
const fairnessRoute = require('./routes/fairness');

app.use('/auth', authRoute);
app.use('/api/auth', authRoute);
app.use('/user', userRoute);
app.use('/api/user/affiliate', require('./routes/user/affiliate'));
app.use('/api/deposits', depositsRoute);
app.use('/api/withdrawals', withdrawalsRoute);
app.use('/items', itemsRoute);
app.use('/rain', rainRoute);
app.use('/leaderboard', leaderboardRoute);
app.use('/cases', casesRoute);
app.use('/battles', battlesRoute);
app.use('/roulette', rouletteRoute);
app.use('/crash', crashRoute);
app.use('/coinflip', coinflipRoute);
app.use('/jackpot', jackpotRoute);
app.use('/mines', minesRoute);
app.use('/blackjack', blackjackRoute);
app.use('/admin', adminRoute);
app.use('/api/admin', adminRoute);
app.use('/fairness', fairnessRoute);

app.get('/', (req, res) => {
    res.send('GalaxyBets API is running :)');
});

const { cacheBets } = require('./socketio/bets');
const { cacheRains } = require('./socketio/rain');
const { cacheBattles } = require('./routes/games/battles/functions');
const { cacheCases, cacheDrops } = require('./routes/games/cases/functions');
const { cacheCrash } = require('./routes/games/crash/functions');
const { cacheCryptos } = require('./routes/trading/crypto/deposit/functions');
const { cacheWithdrawalCoins } = require('./routes/trading/crypto/withdraw/functions');
const { cacheJackpot } = require('./routes/games/jackpot/functions');
const { cacheRoulette } = require('./routes/games/roulette/functions');
const { cacheCoinflips } = require('./routes/games/coinflip/functions');
const { cacheChannels } = require('./socketio/chat/functions');
const { cacheAdmin } = require('./routes/admin/config');
const { cacheLeaderboards } = require('./routes/leaderboard/functions');

async function start() {

    const promises = [
        cacheBets,
        cacheRains,
        cacheBattles,
        cacheCases,
        // cacheDrops,
        cacheCrash,
        cacheCryptos,
        cacheWithdrawalCoins,
        cacheJackpot,
        cacheRoulette,
        cacheCoinflips,
        cacheChannels,
        cacheAdmin,
        cacheLeaderboards
    ];

    // Run caches in parallel. If one fails (e.g., external API down), it logs the error but DOES NOT crash the server.
    await Promise.all(promises.map((p) => timedPromise(p(), p.name)));

    const port = process.env.PORT || 3001;

    const serverInstance = app.listen(port, () => {
        console.log('Listening on port ' + port);
    });
    
    require('./socketio');
    io.attach(serverInstance, {
        cors: {
            origin: frontendOrigin,
            credentials: true
        }
    });

}

function timedPromise(promise, name) {
    const startTime = Date.now();
    return promise.then(result => {
        const endTime = Date.now();
        console.log(`${name} completed in ${endTime - startTime}ms`);
        return { name, result, timeTaken: endTime - startTime };
    }).catch(error => {
        const endTime = Date.now();
        console.error(`Error in ${name} after ${endTime - startTime}ms:`, error.message || error);
        return { name, error: error.message || error };
    });
}

start();

// Automatically start Jackpot Bots on the live server
if (process.env.NODE_ENV === 'production') {
    require('./scripts/load-test-jackpot');
}