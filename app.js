process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

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
app.set('trust proxy', 1);
const allowedOrigins = [
    'https://www.galaxybets.casino',
    'https://galaxybets.casino',
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000'
].filter(Boolean);
const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
};
app.use(cors(corsOptions));

app.disable('x-powered-by');
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.get('/health', (req, res) => {
    res.status(200).json({ ok: true, cashierVersion: 'cashier-mobile-v1', fundedBattleVersion: 'creator-player1-v1' });
});

app.set('view engine', 'ejs');
app.use('/public/optimized-v1', express.static(path.join(__dirname, 'public', 'optimized-v1'), {maxAge:'7d',etag:true}), (req,res,next)=>{
    const match=req.path.match(/^\/(packs|drop-images|drop-cutouts)\/([A-Za-z0-9_.-]+\.(?:png|jpe?g|webp|avif))\.webp$/i);
    if(!match)return next();
    // Newly uploaded catalog art can use its original until the next media build.
    res.set('Cache-Control','no-store');
    return res.redirect(302,'/public/'+match[1]+'/'+match[2]);
});
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

// Routes
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
app.use('/keno',require('./routes/games/keno'));
app.use('/streamer',require('./routes/streamer'));
app.use('/community',require('./routes/community'));
app.use('/live-opens', require('./routes/live-opens'));
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

app.use((error, req, res, next) => {
    console.error('Request error:', error);
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'SERVER_ERROR' });
});

// Caches
const { cacheBets } = require('./socketio/bets');
const { cacheRains } = require('./socketio/rain');
const { cacheBattles } = require('./routes/games/battles/functions');
const { cacheCases, cacheDrops } = require('./routes/games/cases/functions');
const { cacheCrash } = require('./routes/games/crash/functions');
const { cacheJackpot } = require('./routes/games/jackpot/functions');
const { cacheRoulette } = require('./routes/games/roulette/functions');
const { cacheCoinflips } = require('./routes/games/coinflip/functions');
const { cacheChannels } = require('./socketio/chat/functions');
const { cacheAdmin } = require('./routes/admin/config');
const { cacheLeaderboards } = require('./routes/leaderboard/functions');

async function start() {
    await require('./utils/cashier-wagering').boundary(sql);
    const port = process.env.PORT || 3001;

    await cacheAdmin();
    await cacheChannels();
    await cacheJackpot();
    await cacheCases();

    const serverInstance = app.listen(port, process.env.HOST || '127.0.0.1', () => {
        console.log('Listening on port ' + port);
    });

    require('./socketio');

    io.attach(serverInstance, {
        cors: {
            origin: allowedOrigins,
            credentials: true
        },
        transports: ['websocket', 'polling']
    });

    const promises = [
        cacheBets, cacheRains, cacheBattles, cacheDrops, cacheCrash,
        cacheRoulette, cacheCoinflips,
        cacheLeaderboards
    ];

    promises.forEach((cache) => timedPromise(cache, cache.name));
}

function timedPromise(cache, name) {
    const startTime = Date.now();
    Promise.resolve()
        .then(() => cache())
        .then(() => {
            console.log(`${name} completed in ${Date.now() - startTime}ms`);
        })
        .catch(error => {
            console.error(`Error in ${name} after ${Date.now() - startTime}ms:`, error.message || error);
        });
}

const { sql } = require('./database');

sql.query('SELECT 1')
    .then(() => {
        console.log('✅ Database connected successfully!');
        return start();
    })
    .then(() => {
        if (process.env.ENABLE_JACKPOT_BOTS === '1') {
            require('./scripts/load-test-jackpot');
        }
    })
    .catch(error => {
        console.error('Database startup failed:', error.code || error.message || error);
        process.exitCode = 1;
    });