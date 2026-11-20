-- Additive migration. Run once on the intended database before starting the updated backend.
CREATE TABLE IF NOT EXISTS coinflipHouse (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 userId BIGINT UNSIGNED NOT NULL,
 requestId CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 side ENUM('fire','ice') NOT NULL,
 winner ENUM('fire','ice') NOT NULL,
 amount DECIMAL(18,2) NOT NULL,
 payout DECIMAL(18,2) NOT NULL,
 createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(id),
 UNIQUE KEY uq_coinflip_house_request(userId,requestId),
 KEY idx_coinflip_house_user_created(userId,createdAt),
 CONSTRAINT chk_coinflip_house_stake CHECK(amount >= 0.20 AND amount <= 10000.00),
 CONSTRAINT chk_coinflip_house_payout CHECK(payout >= 0)
) ENGINE=InnoDB;
