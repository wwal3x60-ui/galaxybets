CREATE TABLE IF NOT EXISTS passwordResetTokens (
 userId BIGINT UNSIGNED NOT NULL,
 tokenHash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 emailSnapshot VARCHAR(254) NOT NULL,
 passwordSnapshot VARCHAR(255) NULL,
 requestedAt DATETIME(3) NOT NULL,
 expiresAt DATETIME(3) NULL,
 revokedBeforeMs BIGINT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY (userId),
 UNIQUE KEY uq_passwordResetTokens_hash (tokenHash),
 KEY idx_passwordResetTokens_expires (expiresAt)
) ENGINE=InnoDB;
