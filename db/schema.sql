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
CREATE TABLE cases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/cases/functions.js:17
    name VARCHAR(128) NOT NULL, -- INFERRED from routes/games/cases/functions.js:17
    slug VARCHAR(128) NOT NULL, -- INFERRED from routes/games/cases/functions.js:17
    img VARCHAR(512) NULL, -- INFERRED from routes/games/cases/functions.js:17
    PRIMARY KEY (id),
    UNIQUE KEY uq_cases_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE caseVersions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/cases/functions.js:17
    caseId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/functions.js:18
    -- REPRICE in phase 4
    price BIGINT UNSIGNED NOT NULL DEFAULT 0, -- integer cents
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/games/cases/functions.js:17
    endedAt DATETIME NULL, -- INFERRED from routes/games/cases/functions.js:18
    PRIMARY KEY (id),
    KEY idx_caseVersions_case_ended_id (caseId, endedAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE caseItems (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/cases/functions.js:22
    caseVersionId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/functions.js:22
    robloxId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/functions.js:22
    name VARCHAR(255) NOT NULL, -- INFERRED from routes/games/cases/functions.js:22
    img VARCHAR(512) NULL, -- INFERRED from routes/games/cases/functions.js:22
    -- REPRICE in phase 4
    price BIGINT UNSIGNED NOT NULL DEFAULT 0, -- integer cents
    -- REPRICE in phase 4
    robloxPrice BIGINT UNSIGNED NOT NULL DEFAULT 0, -- integer cents
    rangeFrom INT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/functions.js:22
    rangeTo INT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/functions.js:22
    PRIMARY KEY (id),
    KEY idx_caseItems_version_price (caseVersionId, price),
    KEY idx_caseItems_price (price),
    KEY idx_caseItems_version_range (caseVersionId, rangeFrom, rangeTo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE caseOpenings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/cases/functions.js:53
    userId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/index.js:141
    caseVersionId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/index.js:141
    rollId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/index.js:141
    caseItemId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/index.js:141
    PRIMARY KEY (id),
    KEY idx_caseOpenings_version_item (caseVersionId, caseItemId),
    KEY idx_caseOpenings_user_id (userId, id),
    KEY idx_caseOpenings_rollId (rollId),
    KEY idx_caseOpenings_caseItemId (caseItemId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE battles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/battles/index.js:110
    ownerId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/index.js:110
    ownerFunding TINYINT UNSIGNED NOT NULL DEFAULT 0, -- INFERRED from routes/games/battles/index.js:110
    entryPrice DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/battles/index.js:110
    privKey VARCHAR(16) NULL, -- INFERRED from routes/games/battles/index.js:110
    minLevel INT UNSIGNED NOT NULL DEFAULT 0, -- INFERRED from routes/games/battles/index.js:110
    teams TINYINT UNSIGNED NOT NULL DEFAULT 1, -- INFERRED from routes/games/battles/index.js:110
    playersPerTeam TINYINT UNSIGNED NOT NULL DEFAULT 1, -- INFERRED from routes/games/battles/index.js:110
    gamemode VARCHAR(32) NOT NULL, -- INFERRED from routes/games/battles/index.js:110
    serverSeed VARCHAR(255) NOT NULL, -- INFERRED from routes/games/battles/index.js:110
    EOSBlock BIGINT UNSIGNED NULL, -- INFERRED from routes/games/battles/functions.js:278
    clientSeed VARCHAR(255) NULL, -- INFERRED from routes/games/battles/functions.js:373
    round INT UNSIGNED NOT NULL DEFAULT 0, -- INFERRED from routes/games/battles/functions.js:383
    winnerTeam TINYINT UNSIGNED NULL, -- INFERRED from routes/games/battles/functions.js:439
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/games/battles/functions.js:134
    startedAt DATETIME NULL, -- INFERRED from routes/games/battles/functions.js:373
    endedAt DATETIME NULL, -- INFERRED from routes/games/battles/functions.js:134
    PRIMARY KEY (id),
    KEY idx_battles_owner_ended (ownerId, endedAt),
    KEY idx_battles_ended_id (endedAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE battlePlayers (
    battleId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/index.js:121
    userId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/index.js:121
    slot TINYINT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/index.js:121
    team TINYINT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/index.js:121
    PRIMARY KEY (battleId, userId),
    UNIQUE KEY uq_battlePlayers_battle_slot (battleId, slot),
    KEY idx_battlePlayers_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE battleRounds (
    battleId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/index.js:117
    caseVersionId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/index.js:117
    round INT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/index.js:117
    PRIMARY KEY (battleId, round),
    KEY idx_battleRounds_caseVersionId (caseVersionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE battleOpenings (
    battleId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/functions.js:373
    caseOpeningId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/functions.js:373
    round INT UNSIGNED NOT NULL, -- INFERRED from routes/games/battles/functions.js:373
    PRIMARY KEY (battleId, caseOpeningId),
    KEY idx_battleOpenings_battle_round (battleId, round)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE coinflips (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/coinflip/index.js:43
    ownerId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/coinflip/index.js:43
    fire BIGINT UNSIGNED NULL, -- INFERRED from routes/games/coinflip/index.js:43
    ice BIGINT UNSIGNED NULL, -- INFERRED from routes/games/coinflip/index.js:43
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/coinflip/index.js:43
    serverSeed VARCHAR(255) NOT NULL, -- INFERRED from routes/games/coinflip/index.js:43
    clientSeed VARCHAR(255) NULL, -- INFERRED from routes/games/coinflip/functions.js:119
    winnerSide VARCHAR(8) NULL, -- INFERRED from routes/games/coinflip/functions.js:119
    EOSBlock BIGINT UNSIGNED NULL, -- INFERRED from routes/games/coinflip/functions.js:105
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/games/coinflip/index.js:43
    startedAt DATETIME NULL, -- INFERRED from routes/games/coinflip/functions.js:119
    PRIMARY KEY (id),
    KEY idx_coinflips_winnerSide (winnerSide),
    KEY idx_coinflips_createdAt (createdAt),
    KEY idx_coinflips_ownerId (ownerId),
    KEY idx_coinflips_fire (fire),
    KEY idx_coinflips_ice (ice)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE crash (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/crash/functions.js:26
    crashPoint DECIMAL(18,8) NOT NULL DEFAULT 0, -- INFERRED from routes/games/crash/functions.js:92
    serverSeed VARCHAR(255) NOT NULL, -- INFERRED from routes/games/crash/functions.js:26
    createdAt DATETIME NULL, -- INFERRED from routes/games/crash/functions.js:32
    startedAt DATETIME NULL, -- INFERRED from routes/games/crash/functions.js:158
    endedAt DATETIME NULL, -- INFERRED from routes/games/crash/functions.js:26
    PRIMARY KEY (id),
    KEY idx_crash_ended_id (endedAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE crashBets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/crash/index.js:50
    userId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/crash/index.js:50
    roundId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/crash/index.js:50
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/crash/index.js:50
    autoCashoutPoint DECIMAL(18,8) NULL, -- INFERRED from routes/games/crash/index.js:50
    cashoutPoint DECIMAL(18,8) NULL, -- INFERRED from routes/games/crash/functions.js:114
    PRIMARY KEY (id),
    KEY idx_crashBets_roundId (roundId),
    KEY idx_crashBets_user_round (userId, roundId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE jackpot (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/jackpot/functions.js:41
    serverSeed VARCHAR(255) NOT NULL, -- INFERRED from routes/games/jackpot/functions.js:41
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/jackpot/index.js:69
    winnerBet BIGINT UNSIGNED NULL, -- INFERRED from routes/games/jackpot/functions.js:200
    ticket BIGINT UNSIGNED NULL, -- INFERRED from routes/games/jackpot/functions.js:200
    clientSeed VARCHAR(255) NULL, -- INFERRED from routes/games/jackpot/functions.js:200
    EOSBlock BIGINT UNSIGNED NULL, -- INFERRED from routes/games/jackpot/functions.js:179
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/games/jackpot/functions.js:41
    rolledAt DATETIME NULL, -- INFERRED from routes/games/jackpot/functions.js:200
    endedAt DATETIME NULL, -- INFERRED from routes/games/jackpot/functions.js:35
    PRIMARY KEY (id),
    KEY idx_jackpot_ended_id (endedAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE jackpotBets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/jackpot/index.js:65
    userId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/jackpot/index.js:65
    jackpotId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/jackpot/index.js:65
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/jackpot/index.js:65
    ticketsFrom BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/jackpot/index.js:65
    ticketsTo BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/jackpot/index.js:65
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/games/jackpot/functions.js:80
    PRIMARY KEY (id),
    KEY idx_jackpotBets_jackpot_id (jackpotId, id),
    KEY idx_jackpotBets_user_jackpot (userId, jackpotId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE mines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/mines/index.js:75
    userId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/mines/index.js:75
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/mines/index.js:75
    clientSeedId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/mines/index.js:75
    serverSeedId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/mines/index.js:75
    nonce BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/mines/index.js:75
    minesCount TINYINT UNSIGNED NOT NULL, -- INFERRED from routes/games/mines/index.js:75
    mines JSON NOT NULL, -- INFERRED from routes/games/mines/index.js:75
    revealedTiles JSON NOT NULL, -- INFERRED from routes/games/mines/index.js:75
    payout DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/mines/index.js:120
    endedAt DATETIME NULL, -- INFERRED from routes/games/mines/index.js:53
    PRIMARY KEY (id),
    KEY idx_mines_user_ended (userId, endedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE roulette (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/roulette/functions.js:27
    result TINYINT UNSIGNED NOT NULL, -- INFERRED from routes/games/roulette/functions.js:85
    color TINYINT UNSIGNED NOT NULL, -- INFERRED from routes/games/roulette/functions.js:111
    createdAt DATETIME NULL, -- INFERRED from routes/games/roulette/functions.js:33
    rolledAt DATETIME NULL, -- INFERRED from routes/games/roulette/functions.js:106
    endedAt DATETIME NULL, -- INFERRED from routes/games/roulette/functions.js:27
    PRIMARY KEY (id),
    KEY idx_roulette_ended_id (endedAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rouletteBets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/roulette/index.js:82
    userId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/roulette/index.js:82
    roundId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/roulette/index.js:82
    color TINYINT UNSIGNED NOT NULL, -- INFERRED from routes/games/roulette/index.js:82
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/roulette/index.js:82
    PRIMARY KEY (id),
    KEY idx_rouletteBets_roundId (roundId),
    KEY idx_rouletteBets_user_round (userId, roundId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE blackjack (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/blackjack/index.js:82
    userId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/blackjack/index.js:82
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/blackjack/index.js:82
    clientSeedId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/blackjack/index.js:82
    serverSeedId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/blackjack/index.js:82
    nonce BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/blackjack/index.js:82
    payout DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/games/blackjack/index.js:82
    actions JSON NULL, -- INFERRED from routes/games/blackjack/index.js:210
    endedAt DATETIME NULL, -- INFERRED from routes/games/blackjack/index.js:82
    PRIMARY KEY (id),
    KEY idx_blackjack_user_ended (userId, endedAt),
    KEY idx_blackjack_clientSeedId (clientSeedId),
    KEY idx_blackjack_serverSeedId (serverSeedId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rains (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from socketio/rain.js:21
    host BIGINT UNSIGNED NULL, -- INFERRED from socketio/chat/commands/rain.js:53
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from socketio/rain.js:21
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from socketio/rain.js:16
    endedAt DATETIME NULL, -- INFERRED from socketio/rain.js:16
    PRIMARY KEY (id),
    KEY idx_rains_ended_host_created (endedAt, host, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rainUsers (
    rainId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/rain.js:98
    userId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/rain.js:98
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from socketio/rain.js:135
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/rain.js:93
    PRIMARY KEY (rainId, userId),
    KEY idx_rainUsers_user_created (userId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rainTips (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/admin/rain.js:37
    rainId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/rain.js:147
    userId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/rain.js:147
    amount DECIMAL(18,2) NOT NULL DEFAULT 0, -- INFERRED from routes/rain.js:147
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/admin/rain.js:45
    PRIMARY KEY (id),
    KEY idx_rainTips_user_created (userId, createdAt),
    KEY idx_rainTips_rain_amount (rainId, amount),
    KEY idx_rainTips_rain_created (rainId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Columns with uncertain storage details:
-- - cases.img and caseItems.img use VARCHAR(512) for URL/path lengths; routes/games/cases/functions.js:17.
-- - caseItems.robloxId is BIGINT UNSIGNED and robloxPrice is decimal based on source item data; utils/cases.json:11.
-- - caseItems.rangeFrom/rangeTo are unsigned integers for the 0-99999 random range; routes/games/cases/functions.js:121.
-- - battles.privKey uses VARCHAR(16) for the generated short invite key; routes/games/battles/index.js:110.
-- - battles.gamemode uses VARCHAR(32); routes/games/battles/index.js:110.
-- - coinflips.winnerSide uses VARCHAR(8) for the 'fire'/'ice' values; routes/games/coinflip/functions.js:119.
-- - crash.crashPoint, crashBets.autoCashoutPoint, and crashBets.cashoutPoint use DECIMAL(18,8) for multipliers; routes/games/crash/functions.js:92.
-- - jackpot.ticket and jackpotBets ticket endpoints use BIGINT UNSIGNED for integer ticket positions; routes/games/jackpot/functions.js:200, routes/games/jackpot/index.js:65.
-- - roulette.result and roulette.color use TINYINT UNSIGNED to store the outcome and color index; routes/games/roulette/functions.js:85, routes/games/roulette/functions.js:111.
-- - rains.createdAt/endedAt use nullable lifecycle timestamps as the application marks rain completion; socketio/rain.js:21, socketio/rain.js:115.
-- MySQL 8 payment schemas. No foreign keys are defined.
-- The legacy fiatAmount/robuxAmount pairs are represented by one usdAmount
-- column as requested; application code still treats those legacy values as
-- different units and must be migrated separately.

CREATE TABLE cryptoDeposits (
    -- INFERRED from routes/trading/crypto/deposit/index.js:156
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- INFERRED from routes/trading/crypto/deposit/index.js:156
    userId BIGINT UNSIGNED NOT NULL,
    -- INFERRED from routes/trading/crypto/deposit/index.js:156
    usdAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    cryptoAmount DECIMAL(24,12) NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'SOL',
    rateUsd DECIMAL(18,8) NULL,
    txHash VARCHAR(128) NULL,
    -- INFERRED from routes/trading/crypto/deposit/index.js:141
    txId VARCHAR(128) NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    approvedBy BIGINT UNSIGNED NULL,
    approvedAt DATETIME NULL,
    -- INFERRED from routes/trading/crypto/deposit/index.js:41
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- INFERRED from routes/trading/crypto/deposit/index.js:41
    modifiedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cryptoDeposits_currency_txHash (currency, txHash),
    KEY idx_cryptoDeposits_currency_txId (currency, txId),
    KEY idx_cryptoDeposits_user_id (userId, id),
    KEY idx_cryptoDeposits_status_createdAt (status, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cryptoWithdraws (
    -- INFERRED from routes/trading/crypto/withdraw/index.js:150
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- INFERRED from routes/trading/crypto/withdraw/index.js:150
    userId BIGINT UNSIGNED NOT NULL,
    -- INFERRED from routes/trading/crypto/withdraw/index.js:150
    usdAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    cryptoAmount DECIMAL(24,12) NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'SOL',
    rateUsd DECIMAL(18,8) NULL,
    txHash VARCHAR(128) NULL,
    -- INFERRED from routes/trading/crypto/withdraw/index.js:48
    txId VARCHAR(128) NULL,
    -- INFERRED from routes/admin/cashier/crypto.js:98
    exchangeId VARCHAR(128) NULL,
    -- INFERRED from routes/trading/crypto/withdraw/index.js:150
    address VARCHAR(128) NOT NULL,
    -- INFERRED from routes/trading/crypto/withdraw/index.js:150
    chain VARCHAR(32) NOT NULL,
    status ENUM('pending','approved','rejected','sent') NOT NULL DEFAULT 'pending',
    approvedBy BIGINT UNSIGNED NULL,
    approvedAt DATETIME NULL,
    -- INFERRED from routes/trading/crypto/withdraw/index.js:48
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- INFERRED from routes/trading/crypto/withdraw/index.js:48
    modifiedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cryptoWithdraws_currency_txHash (currency, txHash),
    KEY idx_cryptoWithdraws_user_id (userId, id),
    KEY idx_cryptoWithdraws_user_status (userId, status),
    KEY idx_cryptoWithdraws_status_modifiedAt (status, modifiedAt),
    KEY idx_cryptoWithdraws_exchangeId (exchangeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cryptoWallets (
    -- INFERRED from routes/trading/crypto/deposit/index.js:78
    userId BIGINT UNSIGNED NOT NULL,
    -- INFERRED from routes/trading/crypto/deposit/index.js:78
    currency VARCHAR(10) NOT NULL,
    -- INFERRED from routes/trading/crypto/deposit/index.js:78
    address VARCHAR(128) NOT NULL,
    PRIMARY KEY (userId, currency),
    KEY idx_cryptoWallets_address_currency (address, currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cryptos (
    -- INFERRED from routes/trading/crypto/deposit/functions.js:114
    id VARCHAR(10) NOT NULL,
    -- INFERRED from routes/trading/crypto/deposit/functions.js:114
    name VARCHAR(64) NOT NULL,
    -- INFERRED from routes/trading/crypto/deposit/functions.js:114
    coingeckoId VARCHAR(128) NOT NULL,
    -- INFERRED from routes/trading/crypto/deposit/functions.js:114
    price DECIMAL(18,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Columns and compatibility details to confirm:
-- - cryptoDeposits.txId and txHash may represent the same provider transaction:
--   routes/trading/crypto/deposit/index.js:141
-- - cryptoWithdraws.txId and txHash may represent the same blockchain transaction:
--   routes/trading/crypto/withdraw/functions.js:182
-- - Crypto payment amounts are stored using separate fiat and crypto columns:
--   routes/trading/crypto/deposit/index.js:156
--   routes/trading/crypto/withdraw/index.js:150
-- - Crypto status enums intentionally use the requested values, but legacy
--   application code writes other values:
--   routes/trading/crypto/deposit/index.js:126
--   routes/trading/crypto/withdraw/index.js:202
--   routes/admin/cashier/crypto.js:103
--   routes/trading/crypto/withdraw/functions.js:182
-- - cryptos.price is a crypto/USD quote with sub-cent values, but DECIMAL(18,2)
--   is used to follow the USD-column rule:
--   routes/trading/crypto/deposit/functions.js:114
