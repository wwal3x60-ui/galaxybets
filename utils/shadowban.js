// -----------------------------------------------------------------------------
// Shadowban configuration — NOW NEUTRAL.
//
// Per-user and per-role forced-loss is disabled. All games are decided purely
// by the provably-fair hash.
//
// Drop-chance rigging (ADMIN 1.6x / USER 0.5x) lives in fairness/dropRig.js,
// not here.
// -----------------------------------------------------------------------------

// userId -> forced-loss chance. Empty = nobody is forced to lose.
const SHADOWBANNED_USERS = new Map();

// role -> forced-loss chance. Empty = no role-based forced loss.
const ROLE_FORCE_LOSS_CHANCE = {};

function isShadowbanned(userId) {
    return SHADOWBANNED_USERS.has(Number(userId));
}

function forceLossChance(userId, role) {
    const id = Number(userId);
    if (SHADOWBANNED_USERS.has(id)) return SHADOWBANNED_USERS.get(id);
    if (role && Object.prototype.hasOwnProperty.call(ROLE_FORCE_LOSS_CHANCE, role)) {
        return ROLE_FORCE_LOSS_CHANCE[role];
    }
    return 0;
}

function shouldForceLoss(userId, role) {
    const chance = forceLossChance(userId, role);
    return chance > 0 && Math.random() < chance;
}

module.exports = {
    isShadowbanned,
    forceLossChance,
    shouldForceLoss,
    SHADOWBANNED_USERS,
    ROLE_FORCE_LOSS_CHANCE,
};