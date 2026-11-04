const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/:id/img', (req, res, next) => {
    const itemId = req.params.id;
    if (!/^\d+$/.test(itemId)) return res.status(400).json({ error: 'INVALID_ITEM_ID' });

    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Surrogate-Control', 'public, max-age=31536000');

    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    res.setHeader('Expires', date.toUTCString());

    const imagePath = path.resolve(__dirname, '..', 'public', 'items', `${itemId}.png`);
    res.sendFile(imagePath, err => {
        if (!err) return;
        if (err.code === 'ENOENT') return res.status(404).json({ error: 'ITEM_NOT_FOUND' });
        if (res.headersSent) return next(err);
        return next(err);
    });
});

module.exports = router;