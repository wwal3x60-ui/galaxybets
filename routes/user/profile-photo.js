const express = require('express');
const sharp = require('sharp');
const { sql } = require('../../database');
const { isAuthed, apiLimiter } = require('../auth/functions');

const router = express.Router();
const MAX_BYTES = 48 * 1024;

// Get your current photo.
router.get('/profile-photo', isAuthed, async (req, res, next) => {
    try {
        const [[user]] = await sql.query(
            'SELECT profilePhoto FROM users WHERE id = ?',
            [req.userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'USER_NOT_FOUND' });
        }

        res.set('Cache-Control', 'no-store');
        return res.json({ profilePhoto: user.profilePhoto });
    } catch (error) {
        return next(error);
    }
});

// Save your photo.
router.post('/profile-photo', [isAuthed, apiLimiter], async (req, res, next) => {
    const value = req.body?.profilePhoto;

    if (typeof value !== 'string' || value.length > 65580) {
        return res.status(400).json({ error: 'INVALID_PROFILE_PHOTO' });
    }

    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);

    if (!match) {
        return res.status(400).json({ error: 'INVALID_PROFILE_PHOTO' });
    }

    const bytes = Buffer.from(match[2], 'base64');

    if (
        !bytes.length ||
        bytes.length > MAX_BYTES ||
        bytes.toString('base64') !== match[2]
    ) {
        return res.status(400).json({
            error: 'PHOTO_TOO_LARGE_OR_INVALID'
        });
    }

    let profilePhoto;

    try {
        const image = sharp(bytes, {
            limitInputPixels: 8000000,
            failOn: 'warning'
        });

        const metadata = await image.metadata();

        if (
            metadata.format !== match[1] ||
            (metadata.pages || 1) !== 1
        ) {
            return res.status(400).json({
                error: 'INVALID_PROFILE_PHOTO'
            });
        }

        const output = await image
            .rotate()
            .resize(256, 256, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer();

        if (output.length > MAX_BYTES) {
            return res.status(400).json({ error: 'PHOTO_TOO_LARGE' });
        }

        profilePhoto =
            'data:image/webp;base64,' + output.toString('base64');
    } catch {
        return res.status(400).json({ error: 'INVALID_PROFILE_PHOTO' });
    }

    try {
        const [[user]] = await sql.query(
            'SELECT id FROM users WHERE id = ?',
            [req.userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'USER_NOT_FOUND' });
        }

        await sql.query(
            'UPDATE users SET profilePhoto = ? WHERE id = ?',
            [profilePhoto, req.userId]
        );

        return res.json({ success: true, profilePhoto });
    } catch (error) {
        return next(error);
    }
});

// Remove your photo.
router.delete('/profile-photo', [isAuthed, apiLimiter], async (req, res, next) => {
    try {
        const [[user]] = await sql.query(
            'SELECT id FROM users WHERE id = ?',
            [req.userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'USER_NOT_FOUND' });
        }

        await sql.query(
            'UPDATE users SET profilePhoto = NULL WHERE id = ?',
            [req.userId]
        );

        return res.json({ success: true, profilePhoto: null });
    } catch (error) {
        return next(error);
    }
});

// Serve uploaded photos through the existing avatar URL.
router.get('/:id/img', async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();

    try {
        const [[user]] = await sql.query(
            'SELECT profilePhoto FROM users WHERE id = ?',
            [req.params.id]
        );

        const match = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
            user?.profilePhoto || ''
        );

        // Continue to the existing initials/bot avatar route.
        if (!match) return next();

        res.set('Cache-Control', 'no-store');
        res.set('X-Content-Type-Options', 'nosniff');

        return res
            .type('image/webp')
            .send(Buffer.from(match[1], 'base64'));
    } catch (error) {
        return next(error);
    }
});

module.exports = router;