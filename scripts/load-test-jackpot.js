const { jackpot, makeBotJoin } = require('../routes/games/jackpot/functions');

const botTimer = setInterval(() => {
    if (jackpot.spinning || jackpot.timeLeft <= 0 || !jackpot.round.id) return;

    const amount = Math.round((0.5 + Math.random() * 14.5) * 100) / 100;
    makeBotJoin(amount).catch(error => {
        console.error('Jackpot bot join failed:', error.code || error.message || error);
    });
}, 15000);

module.exports = {
    stop: () => clearInterval(botTimer)
};
