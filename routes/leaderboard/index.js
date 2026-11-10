'use strict';
const express = require('express');
const router = express.Router();
const { getRace, leaderboards } = require('./functions');
router.get('/:type', async (req, res) => {
    const type = req.params.type;
    if (!Object.hasOwn(leaderboards, type)) return res.status(400).json({error:'INVALID_TYPE'});
    try {
        const data = await getRace(type);
        res.set('Cache-Control', 'no-store');
        return res.json(data);
    } catch (error) {
        console.error('Race request failed:', error.message);
        return res.status(503).json({error:'RACE_UNAVAILABLE'});
    }
});
module.exports = router;
