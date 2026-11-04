const { rateLimit } = require('express-rate-limit');

const response = (req, res) => res.status(429).json({ error: 'TOO_MANY_REQUESTS' });

const createAuthLimiter = () => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: false,
    legacyHeaders: false,
    handler: response
});

const registerLimiter = createAuthLimiter();
const loginLimiter = createAuthLimiter();

module.exports = { registerLimiter, loginLimiter };
