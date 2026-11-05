CREATE TABLE IF NOT EXISTS cases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/cases/functions.js:17
    name VARCHAR(128) NOT NULL, -- INFERRED from routes/games/cases/functions.js:17
    slug VARCHAR(128) NOT NULL, -- INFERRED from routes/games/cases/functions.js:17
    img VARCHAR(512) NULL, -- INFERRED from routes/games/cases/functions.js:17
    PRIMARY KEY (id),
    UNIQUE KEY uq_cases_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS caseVersions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, -- INFERRED from routes/games/cases/functions.js:17
    caseId BIGINT UNSIGNED NOT NULL, -- INFERRED from routes/games/cases/functions.js:18
    -- REPRICE in phase 4
    price BIGINT UNSIGNED NOT NULL DEFAULT 0, -- integer cents
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- INFERRED from routes/games/cases/functions.js:17
    endedAt DATETIME NULL, -- INFERRED from routes/games/cases/functions.js:18
    PRIMARY KEY (id),
    KEY idx_caseVersions_case_ended_id (caseId, endedAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS caseItems (
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
