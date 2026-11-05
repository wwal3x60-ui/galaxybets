CREATE TABLE IF NOT EXISTS leaderboardUsers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    leaderboardId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    position INT UNSIGNED NOT NULL,
    totalWagered DECIMAL(18,2) NOT NULL DEFAULT 0,
    amountWon DECIMAL(18,2) NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_leaderboardUsers_leaderboardId (leaderboardId, position),
    KEY idx_leaderboardUsers_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
