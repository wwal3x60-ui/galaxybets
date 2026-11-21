'use strict';

const ROLE_DROP_MULTIPLIER = Object.freeze({
    ADMIN: 3.0,
    STREAMER: 1.0,
    USER: 0.3,
    BOT: 1.5,
    AFFILIATE_MANAGER: 1.0,
});

function pickItemForRole(caseItems, fairItem, role) {
    return fairItem;
}

module.exports = {
    pickItemForRole,
    ROLE_DROP_MULTIPLIER,
};