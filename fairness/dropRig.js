// -----------------------------------------------------------------------------
// Role-based drop-chance rigging for cases / boxes.
//
// ROLE_DROP_MULTIPLIER applies to DROP QUALITY:
//   1.6  -> 60% chance to upgrade the fair item one rarity tier (better)
//   1.0  -> no change (fair)
//   0.5  -> 50% chance to downgrade the fair item one rarity tier (worse)
//
// "Rarity" is inferred from each item's range span (rangeTo - rangeFrom).
// Smaller span = rarer drop. This matches standard case layouts where the
// rarest items occupy the narrowest slice of the roll space.
//
// Integration point (case-opening code):
//
//   const fairItem = caseItems.find(i => result >= i.rangeFrom && result <= i.rangeTo);
//   const item     = pickItemForRole(caseItems, fairItem, user.role);   // <-- new
//
// IMPORTANT: apply the rig BEFORE persisting the item to the DB and BEFORE
// emitting the item to the client. Otherwise the fair item leaks and the rig
// becomes visible.
// -----------------------------------------------------------------------------

const ROLE_DROP_MULTIPLIER = {
    ADMIN:    1.6,
    STREAMER: 1.0,
    USER:     0.5,
    BOT:      1.0,
};

function itemSpan(item) {
    return (item.rangeTo - item.rangeFrom);
}

function pickItemForRole(caseItems, fairItem, role) {
    if (!fairItem || !caseItems || caseItems.length < 2) return fairItem;

    const mult = ROLE_DROP_MULTIPLIER[role];
    if (!mult || mult === 1.0) return fairItem;

    // Rank by rarity: ascending span = descending rarity (rarer first).
    const sorted = [...caseItems].sort((a, b) => itemSpan(a) - itemSpan(b));
    const curIdx = sorted.findIndex(i => i.id === fairItem.id);
    if (curIdx === -1) return fairItem;

    if (mult > 1.0) {
        // UPGRADE: with probability (mult - 1) move one tier toward rarer.
        //   1.6 -> 60% chance to upgrade
        const upgradeChance = mult - 1.0;
        if (curIdx > 0 && Math.random() < upgradeChance) {
            return sorted[curIdx - 1];
        }
    } else {
        // DOWNGRADE: with probability (1 - mult) move one tier toward common.
        //   0.5 -> 50% chance to downgrade
        const downgradeChance = 1.0 - mult;
        if (curIdx < sorted.length - 1 && Math.random() < downgradeChance) {
            return sorted[curIdx + 1];
        }
    }

    return fairItem;
}

module.exports = {
    pickItemForRole,
    ROLE_DROP_MULTIPLIER,
};