// -----------------------------------------------------------------------------
// Shadowban configuration
//
// SHADOWBANNED_USERS maps userId -> forced-loss chance (0..1).
// When a shadowbanned user is in a game, there is `chance` probability that
// the round is rigged against them (they lose).
//
// NOTE: this stacks on top of `weightedRng` role weighting if you re-enable it.
// Right now role weighting is neutral (1.0 for everyone), so this is the only
// place a game is rigged.
// -----------------------------------------------------------------------------

// userId -> forced-loss chance
const SHADOWBANNED_USERS = new Map([
    [175, 0.5],   // User 175: forced to lose ~50% of the time
]);

// role -> forced-loss chance. Empty = no role-based shadowban.
// e.g. { USER: 0.5 } would force-loss all USER role accounts 50% of the time.
const ROLE_FORCE_LOSS_CHANCE = {};

function isShadowbanned(userId) {
    return SHADOWBANNED_USERS.has(Number(userId));
}

function forceLossChance(userId, role) {
    const id = Number(userId);
    if (SHADOWBANNED_USERS.has(id)) {
        return SHADOWBANNED_USERS.get(id);
    }
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