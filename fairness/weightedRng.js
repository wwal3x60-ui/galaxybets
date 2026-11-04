const BOT_WIN_CHANCE = 0.5 * 1.18;
const ADMIN_WIN_CHANCE = 0.76;

function hashRoll(hash, offset = 0) {
    return parseInt(hash.slice(offset, offset + 13), 16) / 0x10000000000000;
}

function getRoleWeightedWinner(hash, candidates, normalWinner) {
    const adminCandidates = candidates.filter(candidate => candidate.roles.includes('ADMIN'));
    const nonAdminCandidates = candidates.filter(candidate => !candidate.roles.includes('ADMIN'));

    let favoredCandidates;
    let otherCandidates;
    let userRole;
    let winChance;

    if (adminCandidates.length && nonAdminCandidates.length) {
        favoredCandidates = adminCandidates;
        otherCandidates = nonAdminCandidates;
        userRole = 'ADMIN';
        winChance = ADMIN_WIN_CHANCE;
    } else {
        const botCandidates = candidates.filter(candidate =>
            candidate.roles.length > 0 && candidate.roles.every(role => role === 'BOT')
        );
        const nonBotCandidates = candidates.filter(candidate => !botCandidates.includes(candidate));

        if (!botCandidates.length || !nonBotCandidates.length) return normalWinner;

        favoredCandidates = botCandidates;
        otherCandidates = nonBotCandidates;
        userRole = 'BOT';
        winChance = BOT_WIN_CHANCE;
    }

    console.log("WEIGHTED RNG APPLIED:", { userRole, winChance });

    const selectedGroup = hashRoll(hash) < winChance ? favoredCandidates : otherCandidates;
    const selectedIndex = Math.floor(hashRoll(hash, 13) * selectedGroup.length);
    return selectedGroup[Math.min(selectedIndex, selectedGroup.length - 1)].id;
}

module.exports = {
    getRoleWeightedWinner
};
