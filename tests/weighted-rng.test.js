const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getRoleWeightedWinner } = require('../fairness/weightedRng');

const zeroRoll = '0'.repeat(64);
const highRoll = 'f'.repeat(64);
const seventyFivePointFivePercentRoll = Math.floor(0.755 * 0x10000000000000)
    .toString(16)
    .padStart(13, '0')
    .padEnd(64, '0');

test('Admin wins at the 76% threshold before bot weighting is considered', () => {
    const candidates = [
        { id: 'admin', roles: ['ADMIN'] },
        { id: 'bot', roles: ['BOT'] }
    ];

    assert.equal(getRoleWeightedWinner(zeroRoll, candidates, 'bot'), 'admin');
    assert.equal(getRoleWeightedWinner(seventyFivePointFivePercentRoll, candidates, 'bot'), 'admin');
    assert.equal(getRoleWeightedWinner(highRoll, candidates, 'bot'), 'bot');
});

test('Bot has a 59% chance against a human from the 1.18x probability multiplier', () => {
    const candidates = [
        { id: 'bot', roles: ['BOT'] },
        { id: 'human', roles: ['USER'] }
    ];

    assert.equal(getRoleWeightedWinner(zeroRoll, candidates, 'human'), 'bot');
    assert.equal(getRoleWeightedWinner(highRoll, candidates, 'human'), 'human');
});

test('Equal-role teams keep the original fair winner', () => {
    const botTeams = [
        { id: 'bot-one', roles: ['BOT'] },
        { id: 'bot-two', roles: ['BOT'] }
    ];
    const adminTeams = [
        { id: 'admin-one', roles: ['ADMIN'] },
        { id: 'admin-two', roles: ['ADMIN'] }
    ];

    assert.equal(getRoleWeightedWinner(zeroRoll, botTeams, 'bot-two'), 'bot-two');
    assert.equal(getRoleWeightedWinner(zeroRoll, adminTeams, 'admin-two'), 'admin-two');
});

test('Human-only teams keep the original fair winner', () => {
    const candidates = [
        { id: 'user-one', roles: ['USER'] },
        { id: 'user-two', roles: ['USER'] }
    ];

    assert.equal(getRoleWeightedWinner(zeroRoll, candidates, 'user-two'), 'user-two');
});
