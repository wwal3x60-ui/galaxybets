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
