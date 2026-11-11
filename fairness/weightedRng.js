// -----------------------------------------------------------------------------
// Role-weighted RNG — NEUTRAL / FAIR MODE
//
// Every role uses multiplier 1.0, so every candidate has the same effective
// win chance (BASE_WIN_CHANCE * 1.0 = 0.5). When all candidates share the same
// chance, getRoleWeightedWinner() falls through to `normalWinner` — i.e. pure
// 50/50 fairness from the hash. No role gets a favourability boost.
//
// To re-enable role weighting later, just bump individual multipliers below.
// -----------------------------------------------------------------------------

const BASE_WIN_CHANCE = 0.5;

const ROLE_WIN_MULTIPLIER = {
    ADMIN:    1.0,
    STREAMER: 1.0,
    USER:     1.0,
    BOT:      1.0,
};

const DEFAULT_MULTIPLIER = 1.0;

function hashRoll(hash, offset = 0) {
    return parseInt(hash.slice(offset, offset + 13), 16) / 0x10000000000000;
}

function candidateChance(candidate) {
    if (!candidate.roles || !candidate.roles.length) {
        return BASE_WIN_CHANCE * DEFAULT_MULTIPLIER;
    }
    let best = 0;
    for (const role of candidate.roles) {
        const m = ROLE_WIN_MULTIPLIER[role] ?? DEFAULT_MULTIPLIER;
        if (m > best) best = m;
    }
    if (best === 0) best = DEFAULT_MULTIPLIER;
    return BASE_WIN_CHANCE * best;
}

function getRoleWeightedWinner(hash, candidates, normalWinner) {
    if (!candidates.length) return normalWinner;

    const scored = candidates.map(c => ({ id: c.id, chance: candidateChance(c) }));

    const maxChance = Math.max(...scored.map(c => c.chance));
    const minChance = Math.min(...scored.map(c => c.chance));

    // Neutral mode: everyone equal -> return the fair hash winner.
    if (maxChance === minChance) return normalWinner;

    const favoredCandidates = scored.filter(c => c.chance === maxChance);
    const otherCandidates = scored.filter(c => c.chance < maxChance);
    const winChance = Math.max(0.01, Math.min(0.99, maxChance));

    console.log('WEIGHTED RNG APPLIED:', {
        maxChance,
        winChance,
        favoredIds: favoredCandidates.map(c => c.id),
    });

    const selectedGroup = hashRoll(hash) < winChance ? favoredCandidates : otherCandidates;
    const selectedIndex = Math.floor(hashRoll(hash, 13) * selectedGroup.length);
    return selectedGroup[Math.min(selectedIndex, selectedGroup.length - 1)].id;
}

module.exports = {
    getRoleWeightedWinner,
    ROLE_WIN_MULTIPLIER,
    BASE_WIN_CHANCE,
};