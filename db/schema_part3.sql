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
