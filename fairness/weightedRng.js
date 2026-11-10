// -----------------------------------------------------------------------------
// Role-weighted RNG
//
// Each role has a WIN-CHANCE MULTIPLIER. The effective win probability used by
// getRoleWeightedWinner is:
//
//     chance = BASE_WIN_CHANCE * roleMultiplier
//
// A matchup's favored group is the candidate(s) with the highest effective
// chance; that value becomes the favored group's win probability. Everyone
// else shares the remainder (1 - chance) uniformly.
//
// Effective chances with the current table (BASE_WIN_CHANCE = 0.5):
//
//   ADMIN    → 0.5 * 1.75 = 0.875  (87.5%)
//   STREAMER → 0.5 * 1.2  = 0.60   (60%)
//   BOT      → 0.5 * 1.18 = 0.59   (59%)
//   USER     → 0.5 * 0.5  = 0.25   (25%)
//   (unknown)→ 0.5 * 1.0  = 0.50   (50% — falls back to fair winner)
//
// If every candidate has the same effective chance (e.g. USER vs USER), no
// weighting applies and `normalWinner` is returned — same as before.
// -----------------------------------------------------------------------------

const BASE_WIN_CHANCE = 0.5;

const ROLE_WIN_MULTIPLIER = {
    ADMIN: 1.75,
    STREAMER: 1.2,
    USER: 0.5,
    BOT: 1.18,
};

const DEFAULT_MULTIPLIER = 1;

function hashRoll(hash, offset = 0) {
    return parseInt(hash.slice(offset, offset + 13), 16) / 0x10000000000000;
}

function candidateChance(candidate) {
    if (!candidate.roles || !candidate.roles.length) {
        return BASE_WIN_CHANCE * DEFAULT_MULTIPLIER;
    }

    // A team with multiple roles inherits the strongest one.
    // (e.g. ADMIN + USER → uses the ADMIN multiplier.)
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

    const scored = candidates.map(c => ({
        id: c.id,
        chance: candidateChance(c),
    }));

    const maxChance = Math.max(...scored.map(c => c.chance));
    const minChance = Math.min(...scored.map(c => c.chance));

    // Everyone has the same effective chance → no role weighting applies.
    if (maxChance === minChance) return normalWinner;

    const favoredCandidates = scored.filter(c => c.chance === maxChance);
    const otherCandidates = scored.filter(c => c.chance < maxChance);

    // The favored group's win probability, clamped so it never goes to
    // 0% or 100% (keeps the hash roll well-defined).
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