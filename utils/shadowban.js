const SHADOWBANNED_USERS = [175]; // User 175 is restricted

function isShadowbanned(userId) {
    return SHADOWBANNED_USERS.includes(Number(userId));
}

module.exports = { isShadowbanned };