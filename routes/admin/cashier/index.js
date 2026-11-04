const express = require('express');
const router = express.Router();

const cryptoRoute = require('./crypto');
const manualCryptoRoute = require('./manual-crypto');
router.use('/crypto', cryptoRoute);
router.use('/', manualCryptoRoute);

module.exports = router;