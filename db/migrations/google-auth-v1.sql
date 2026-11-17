CREATE TABLE IF NOT EXISTS googleIdentities (
 googleSubject VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 userId BIGINT UNSIGNED NOT NULL,
 createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (googleSubject),
 UNIQUE KEY uq_googleIdentities_userId (userId)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS googleAuthChallenges (
 nonce CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 expiresAt DATETIME NOT NULL,
 PRIMARY KEY (nonce),
 KEY idx_googleAuthChallenges_expiresAt (expiresAt)
) ENGINE=InnoDB;
