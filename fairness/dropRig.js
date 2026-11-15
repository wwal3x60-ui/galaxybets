'use strict';

const ROLE_DROP_MULTIPLIER = Object.freeze({
    ADMIN: 1.0,
    STREAMER: 1.0,
    USER: 1.0,
    BOT: 1.0,
    AFFILIATE_MANAGER: 1.0,
});

function pickItemForRole(caseItems, fairItem, role) {
    return fairItem;
}

module.exports = {
    pickItemForRole,
    ROLE_DROP_MULTIPLIER,
};