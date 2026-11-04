const express = require('express');
const router = express.Router();

const manualCryptoRoute = require('./manual-crypto');
router.use('/', manualCryptoRoute);

module.exports = router;