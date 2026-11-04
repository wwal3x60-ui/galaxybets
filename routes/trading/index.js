const express = require('express');
const router = express.Router();

const cryptoRoute = require('./crypto');

router.use('/crypto', cryptoRoute);

module.exports = router;