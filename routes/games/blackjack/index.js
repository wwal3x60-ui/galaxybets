const express = require('express');
const router = express.Router();
const { isAuthed } = require('../../auth/functions');

// The supplied Blackjack implementation has unfinished action/settlement
// handlers. Keep it unavailable rather than accepting wagers it cannot settle.
router.use(isAuthed);
router.use((req, res) => res.status(400).json({ error: 'DISABLED' }));

module.exports = router;
