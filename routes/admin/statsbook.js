const express = require('express');
const router = express.Router();

const { sql } = require('../../database');

const resultsPerPage = 10;
const msInDay = 86400000;

let launchDay = false;

router.get('/', async (req, res) => {

    if (!launchDay) {
        [[{ launchDay }]] = await sql.query('SELECT MIN(createdAt) as launchDay FROM users');
        launchDay.setHours(0, 0, 0, 0);
        launchDay = launchDay.valueOf();
    }

    const today = Date.now();
    const totalDays = Math.ceil((today - launchDay) / msInDay);

    const pages = Math.ceil(totalDays / resultsPerPage);

    let page = parseInt(req.query.page);
    page = !isNaN(page) && page > 0 ? page : 1;

    if (page > pages) return res.status(404).json({ error: 'PAGE_NOT_FOUND' });

    const dayFromMs = today - ((page - 1) * resultsPerPage) * msInDay;
    const dayFrom = toDateString(dayFromMs - resultsPerPage * msInDay);
    const dayTo = toDateString(dayFromMs);
    // console.log(dayFrom, dayTo)

    const days = [];

    const [newUsers] = await sql.query(` 
        SELECT DATE(createdAt) as date, COUNT(*) as total
        FROM users WHERE DATE(createdAt) >= ? AND DATE(createdAt) <= ? 
        GROUP BY date ORDER BY date DESC
    `, [dayFrom, dayTo]);

    const newUsersMap = {};
    newUsers.forEach(e => newUsersMap[toDateString(e.date)] = e.total);

    const [cryptoDeposits] = await sql.query(`
        SELECT DATE(createdAt) as date, SUM(fiatAmount) as total
        FROM cryptoDeposits WHERE DATE(createdAt) >= ? AND DATE(createdAt) <= ?
        GROUP BY date ORDER BY date DESC
    `, [dayFrom, dayTo]);

    const cryptoDepositsMap = {};
    cryptoDeposits.forEach(e => cryptoDepositsMap[toDateString(e.date)] = e.total);

    const [cryptoWithdraws] = await sql.query(`
        SELECT DATE(modifiedAt) as date, SUM(fiatAmount) as total
        FROM cryptoWithdraws WHERE status = 'completed' AND DATE(modifiedAt) >= ? AND DATE(modifiedAt) <= ?
        GROUP BY date ORDER BY date DESC
    `, [dayFrom, dayTo]);

    const cryptoWithdrawsMap = {};
    cryptoWithdraws.forEach(e => cryptoWithdrawsMap[toDateString(e.date)] = e.total);

    const offset = (page - 1) * resultsPerPage;
    const max = Math.min(totalDays - offset, resultsPerPage);

    for (let i = 0; i < max; i++) {
    
        const day = toDateString(dayFromMs - i * msInDay);

        const newUsersCount = newUsersMap[day] || 0;

        const cryptoDepositsCount = (cryptoDepositsMap[day] || 0);
        const cryptoWithdrawsCount = (cryptoWithdrawsMap[day] || 0);

        days.push({
            date: day,
            npc: newUsersCount,
            cryptoDeposits: cryptoDepositsCount,
            cryptoWithdraws: cryptoWithdrawsCount,
            netProfit: cryptoDepositsCount - cryptoWithdrawsCount
        });

    }
    
    res.json({
        page,
        pages,
        total: totalDays,
        data: days
    })

});

function toDateString(date) {
    date = new Date(date);
    return date.toISOString().split('T')[0]
}

module.exports = router;