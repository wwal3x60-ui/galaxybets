const { rateLimit } = require('express-rate-limit');

const response = (req, res) => res.status(429).json({ error: 'TOO_MANY_REQUESTS' });

const createCryptoLimiter = () => rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: false,
    legacyHeaders: false,
    handler: response
});

module.exports = {
    depositCryptoLimiter: createCryptoLimiter(),
    withdrawalCryptoLimiter: createCryptoLimiter()
};
