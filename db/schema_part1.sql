CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    emailVerifiedAt DATETIME NULL,
    passwordHash VARCHAR(255) NOT NULL,
    `2fa` VARCHAR(255) NULL, -- INFERRED from routes/admin/index.js:20
    role VARCHAR(32) NOT NULL DEFAULT 'USER', -- INFERRED from routes/admin/users/index.js:64
    perms INT UNSIGNED NOT NULL DEFAULT 0, -- INFERRED from routes/admin/index.js:66
    balance DECIMAL(18,2) NOT NULL DEFAULT 0,
    xp INT UNSIGNED NOT NULL DEFAULT 0, -- INFERRED from routes/admin/users/index.js:64
    anon TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from routes/user/index.js:24
    mentionsEnabled TINYINT(1) NOT NULL DEFAULT 1, -- INFERRED from routes/user/index.js:50
    banned TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/config.js:15
    tipBan TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/users/index.js:64
    leaderboardBan TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/users/index.js:64
    rainBan TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/users/index.js:64
    accountLock TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/users/index.js:64
    sponsorLock TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/config.js:15
    verified TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from socketio/chat/commands/tip.js:32
    affiliateCode VARCHAR(32) NULL, -- INFERRED from routes/user/affiliate.js:254
    affiliateCodeLock TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/users/affiliates.js:127
    affiliateEarningsOffset DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/user/affiliate.js:22
    maxPerTip DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/users/index.js:64
    maxTipPerUser DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/users/index.js:64
    tipAllowance DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from socketio/chat/commands/tip.js:32
    rainTipAllowance DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from socketio/chat/commands/rain.js:36
    cryptoAllowance DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/admin/users/index.js:64
    mutedUntil DATETIME NULL, -- INFERRED from socketio/chat/index.js:91
    ip VARCHAR(45) NULL, -- INFERRED from routes/auth/index.js:510
    country CHAR(2) NULL, -- INFERRED from routes/auth/index.js:147
    lastLogout DATETIME NULL, -- INFERRED from routes/admin/config.js:27
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/admin/statsbook.js:16
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_affiliateCode (affiliateCode),
    KEY idx_users_createdAt (createdAt),
    KEY idx_users_role (role),
    KEY idx_users_xp (xp),
    KEY idx_users_banned (banned),
    KEY idx_users_sponsorLock (sponsorLock),
    KEY idx_users_accountLock (accountLock),
    KEY idx_users_leaderboardBan (leaderboardBan),
    KEY idx_users_lastLogout (lastLogout),
    KEY idx_users_country (country),
    CONSTRAINT chk_users_balance_nonnegative CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/user/index.js:272
    userId BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    type VARCHAR(32) NOT NULL,
    method VARCHAR(64) NOT NULL,
    methodId VARCHAR(255) NULL, -- INFERRED from routes/user/index.js:272
    coin VARCHAR(16) NULL,
    txHash VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'approved',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_transactions_txHash (txHash),
    KEY idx_transactions_user_id (userId, id),
    KEY idx_transactions_user_type_created (userId, type, createdAt),
    KEY idx_transactions_type_created (type, createdAt),
    KEY idx_transactions_type_method_methodId (type, method, methodId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/user/index.js:156
    userId BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    winnings DECIMAL(18,2) NOT NULL DEFAULT 0,
    edge DECIMAL(18,2) NOT NULL DEFAULT 0,
    game VARCHAR(32) NOT NULL,
    gameId BIGINT UNSIGNED NOT NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_bets_user_completed_created (userId, completed, createdAt),
    KEY idx_bets_user_id (userId, id),
    KEY idx_bets_game_gameId (game, gameId),
    KEY idx_bets_completed_id (completed, id),
    KEY idx_bets_created_completed (createdAt, completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE serverSeeds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/blackjack/index.js:54
    userId BIGINT UNSIGNED NOT NULL,
    seed VARCHAR(255) NOT NULL,
    nonce BIGINT UNSIGNED NOT NULL DEFAULT 0,
    endedAt DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_serverSeeds_user_ended (userId, endedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE clientSeeds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/blackjack/index.js:44
    userId BIGINT UNSIGNED NOT NULL,
    seed VARCHAR(255) NOT NULL,
    endedAt DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_clientSeeds_user_ended (userId, endedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE fairRolls (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/cases/index.js:136
    serverSeed VARCHAR(255) NOT NULL,
    clientSeed VARCHAR(255) NOT NULL,
    nonce BIGINT UNSIGNED NOT NULL,
    seed VARCHAR(128) NOT NULL,
    result DECIMAL(18,8) NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/user/notifications.js:11
    userId BIGINT UNSIGNED NOT NULL,
    type VARCHAR(64) NOT NULL,
    content JSON NOT NULL,
    seen TINYINT(1) NOT NULL DEFAULT 0, -- INFERRED from routes/user/index.js:25
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_notifications_user_deleted_id (userId, deleted, id),
    KEY idx_notifications_user_seen (userId, seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE chatMessages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from socketio/chat/functions.js:20
    type VARCHAR(32) NOT NULL,
    senderId BIGINT UNSIGNED NULL,
    content LONGTEXT NULL,
    channelId VARCHAR(128) NULL,
    replyTo BIGINT UNSIGNED NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_chatMessages_sender_type_id (senderId, type, id),
    KEY idx_chatMessages_channel_deleted_id (channelId, deletedAt, id),
    KEY idx_chatMessages_replyTo (replyTo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bannedPhrases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/admin/phrases.js:62
    phrase VARCHAR(255) NOT NULL,
    addedBy BIGINT UNSIGNED NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_bannedPhrases_phrase (phrase),
    KEY idx_bannedPhrases_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE features (
    id VARCHAR(64) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE securityKeys (
    id VARCHAR(255) NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    nickname VARCHAR(64) NOT NULL,
    privateKey TEXT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_securityKeys_user_id (userId, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE leaderboards (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/leaderboard/functions.js:115
    type VARCHAR(32) NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    endedAt DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_leaderboards_type_ended (type, endedAt),
    KEY idx_leaderboards_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE promoCodes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/user/index.js:255
    code VARCHAR(32) NOT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    totalUses INT UNSIGNED NOT NULL DEFAULT 0,
    currentUses INT UNSIGNED NOT NULL DEFAULT 0,
    minLvl INT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_promoCodes_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE promoCodeUses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/user/index.js:271
    userId BIGINT UNSIGNED NOT NULL,
    promoCodeId BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_promoCodeUses_user_code (userId, promoCodeId),
    KEY idx_promoCodeUses_promoCodeId (promoCodeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE affiliates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/user/affiliate.js:207
    userId BIGINT UNSIGNED NOT NULL,
    affiliateId BIGINT UNSIGNED NOT NULL,
    affiliateReward DECIMAL(18,2) NOT NULL DEFAULT 0,
    ip VARCHAR(45) NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/user/affiliate.js:290
    PRIMARY KEY (id),
    KEY idx_affiliates_userId (userId),
    KEY idx_affiliates_affiliate_created (affiliateId, createdAt),
    KEY idx_affiliates_ip (ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE affiliateClaims (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/user/affiliate.js:98
    userId BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_affiliateClaims_user_created (userId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rakebackClaims (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/user/rakeback/index.js:46
    userId BIGINT UNSIGNED NOT NULL,
    type VARCHAR(32) NOT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_rakebackClaims_user_type_created (userId, type, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tips (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from socketio/chat/commands/tip.js:71
    fromUserId BIGINT UNSIGNED NOT NULL,
    toUserId BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_tips_from_to (fromUserId, toUserId),
    KEY idx_tips_toUserId (toUserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Columns with uncertain storage details:
-- - serverSeeds.seed and clientSeeds.seed use VARCHAR(255) for seed values of unspecified maximum length; fairness/index.js:26-27.
-- - fairRolls.result uses DECIMAL(18,8) for the numeric case result; routes/games/cases/index.js:136.
-- - chatMessages.content uses LONGTEXT because inserts store both message text and serialized payloads; socketio/chat/index.js:154, socketio/rain.js:144.
-- users.username is intentionally omitted: the existing auth flow stores the Roblox username there; routes/auth/index.js:131, routes/auth/index.js:510.
