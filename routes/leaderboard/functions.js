'use strict';
const { sql, doTransaction } = require('../../database');
const io = require('../../socketio/server');
const { makeRaceService, definitions } = require('./race-service');
const service = makeRaceService({ sql, doTransaction, io });
const leaderboards = Object.fromEntries(Object.entries(definitions).map(([type, definition]) => [type, { rewards: Object.fromEntries(definition.prizes.map((value, i) => [i + 1, Number(value)])) }]));
let running = false;
let refreshTimer;

async function refreshAll() {
    for (const type of Object.keys(leaderboards)) {
        try {
            leaderboards[type].cache = await service.update(type);
            io.emit(`leaderboard:${type}`, leaderboards[type].cache.users);
        } catch (error) { console.error(`Unable to update ${type} race:`, error.message); }
    }
}
async function cacheLeaderboards() {
    if (running) return;
    running = true;
    const loop = async () => {
        try { await refreshAll(); } finally { refreshTimer = setTimeout(loop, 10000); refreshTimer.unref?.(); }
    };
    await loop();
}
// Preserve game-side imports while refreshing both races. Requests also refresh
// directly, so there is no dependency on optional game hooks.
function scheduleWeeklyLeaderboardRefresh() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(async () => { refreshTimer = null; await refreshAll(); }, 250);
    refreshTimer.unref?.();
}
async function getRace(type) {
    const data = await service.update(type);
    leaderboards[type].cache = data;
    return data;
}
module.exports = { leaderboards, cacheLeaderboards, scheduleWeeklyLeaderboardRefresh, getRace };
