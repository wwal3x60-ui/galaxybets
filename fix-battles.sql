CREATE TABLE IF NOT EXISTS battles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ownerId BIGINT UNSIGNED NOT NULL,
    ownerFunding TINYINT UNSIGNED NOT NULL DEFAULT 0,
    entryPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    privKey VARCHAR(16) NULL,
    minLevel INT UNSIGNED NOT NULL DEFAULT 0,
    teams TINYINT UNSIGNED NOT NULL DEFAULT 1,
    playersPerTeam TINYINT UNSIGNED NOT NULL DEFAULT 1,
    gamemode VARCHAR(32) NOT NULL,
    serverSeed VARCHAR(255) NOT NULL,
    EOSBlock BIGINT UNSIGNED NULL,
    clientSeed VARCHAR(255) NULL,
    round INT UNSIGNED NOT NULL DEFAULT 0,
    winnerTeam TINYINT UNSIGNED NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    startedAt DATETIME NULL,
    endedAt DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_battles_owner_ended (ownerId, endedAt),
    KEY idx_battles_ended_id (endedAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS battlePlayers (
    battleId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    slot TINYINT UNSIGNED NOT NULL,
    team TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (battleId, userId),
    UNIQUE KEY uq_battlePlayers_battle_slot (battleId, slot),
    KEY idx_battlePlayers_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS battleRounds (
    battleId BIGINT UNSIGNED NOT NULL,
    caseVersionId BIGINT UNSIGNED NOT NULL,
    round INT UNSIGNED NOT NULL,
    PRIMARY KEY (battleId, round),
    KEY idx_battleRounds_caseVersionId (caseVersionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
