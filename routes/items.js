const express = require('express');
const path = require('path');
const router = express.Router();

const { sql } = require('../database');
const { isAuthed } = require('./auth/functions');
const { fromCents, toCents } = require('../utils/money');

// List items from active case versions.
router.get('/', isAuthed, async (req, res, next) => {
    const limit = req.query.limit == null
        ? 200
        : Number(req.query.limit);

    const offset = req.query.offset == null
        ? 0
        : Number(req.query.offset);

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 500 ||
        !Number.isInteger(offset) ||
        offset < 0
    ) {
        return res.status(400).json({
            error: 'INVALID_PAGINATION'
        });
    }

    const search = typeof req.query.search === 'string'
        ? req.query.search.trim()
        : '';

    if (search.length > 128) {
        return res.status(400).json({
            error: 'INVALID_SEARCH'
        });
    }

    let maxCents;

    if (req.query.maxPrice != null) {
        const value = String(req.query.maxPrice).trim();

        if (
            !value ||
            !Number.isFinite(Number(value)) ||
            Number(value) < 0
        ) {
            return res.status(400).json({
                error: 'INVALID_MAX_PRICE'
            });
        }

        try {
            maxCents = toCents(value);
        } catch {
            return res.status(400).json({
                error: 'INVALID_MAX_PRICE'
            });
        }
    }

    const where = [];
    const args = [];

    if (search) {
        where.push('ci.name LIKE ?');
        args.push(`%${search}%`);
    }

    if (maxCents !== undefined) {
        where.push('ci.price <= ?');
        args.push(maxCents);
    }

    try {
        const [rows] = await sql.query(`
            SELECT ci.robloxId, ci.name, ci.price
            FROM caseItems ci
            INNER JOIN (
                SELECT source.robloxId, MAX(source.id) AS latestId
                FROM caseItems source
                INNER JOIN caseVersions cv
                    ON cv.id = source.caseVersionId
                WHERE cv.endedAt IS NULL
                GROUP BY source.robloxId
            ) active ON active.latestId = ci.id
            ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY ci.price ASC, ci.robloxId ASC
            LIMIT ? OFFSET ?
        `, [...args, limit, offset]);

        return res.json({
            items: rows.map((item) => ({
                id: String(item.robloxId),
                name: item.name,
                imageUrl: `/items/${item.robloxId}/img`,
                value: String(fromCents(Number(item.price)))
            }))
        });
    } catch (error) {
        next(error);
    }
});

// Serve item images.
router.get('/:id/img', (req, res, next) => {
    const itemId = req.params.id;

    if (!/^\d+$/.test(itemId)) {
        return res.status(400).json({
            error: 'INVALID_ITEM_ID'
        });
    }

    res.setHeader(
        'Cache-Control',
        'public, max-age=31536000'
    );

    res.setHeader(
        'Surrogate-Control',
        'public, max-age=31536000'
    );

    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    res.setHeader('Expires', date.toUTCString());

    const imagePath = path.resolve(
        __dirname,
        '..',
        'public',
        'items',
        `${itemId}.png`
    );

    res.sendFile(imagePath, (error) => {
        if (!error) return;

        if (error.code === 'ENOENT') {
            return res.status(404).json({
                error: 'ITEM_NOT_FOUND'
            });
        }

        return next(error);
    });
});

module.exports = router;