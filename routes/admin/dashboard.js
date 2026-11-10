const express = require('express');
const router = express.Router();

const { sql } = require('../../database');

router.get('/', async (req, res, next) => {
    try {
        const [[totals]] = await sql.query(`
            SELECT
                COALESCE(SUM(
                    CASE WHEN type = 'crypto_deposit'
                        THEN amount ELSE -amount END
                ), 0) AS total,

                COALESCE(SUM(
                    CASE WHEN createdAt >= NOW() - INTERVAL 1 DAY
                        THEN CASE WHEN type = 'crypto_deposit'
                            THEN amount ELSE -amount END
                        ELSE 0 END
                ), 0) AS lastDay,

                COALESCE(SUM(
                    CASE WHEN createdAt >= NOW() - INTERVAL 7 DAY
                        THEN CASE WHEN type = 'crypto_deposit'
                            THEN amount ELSE -amount END
                        ELSE 0 END
                ), 0) AS last7d,

                COALESCE(SUM(
                    CASE WHEN createdAt >= NOW() - INTERVAL 31 DAY
                        THEN CASE WHEN type = 'crypto_deposit'
                            THEN amount ELSE -amount END
                        ELSE 0 END
                ), 0) AS last31d

            FROM transactions
            WHERE status = 'approved'
              AND type IN ('crypto_deposit', 'crypto_withdraw')
        `);

        const profit = {
            total: Number(totals.total),
            lastDay: Number(totals.lastDay),
            last7d: Number(totals.last7d),
            last31d: Number(totals.last31d)
        };

        const [growth] = await sql.query(`
            SELECT
                DATE_FORMAT(
                    DATE_SUB(createdAt, INTERVAL WEEKDAY(createdAt) DAY),
                    '%d/%m/%Y'
                ) AS \`from\`,

                DATE_FORMAT(
                    DATE_ADD(
                        DATE_SUB(createdAt, INTERVAL WEEKDAY(createdAt) DAY),
                        INTERVAL 6 DAY
                    ),
                    '%d/%m/%Y'
                ) AS \`to\`,

                COUNT(id) AS players

            FROM users
            GROUP BY \`from\`, \`to\`
            ORDER BY MIN(createdAt) DESC
            LIMIT 9
        `);

        return res.json({
            profit,
            growth,
            topCountries: []
        });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;