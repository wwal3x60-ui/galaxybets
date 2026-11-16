'use strict';
const VERSION='streamer-ftd-v5-400-40x-slots';
const FLAG='gb_bonus_400_schema_v2';
const REQUEST_CHECK=`(bonusAmount>0 AND wagerAmount>0 AND ((version IN ('streamer-ftd-v3-5x','streamer-ftd-v2','jammy-ftd-v1') AND rate IN (10,20,30,40,50) AND bonusAmount<=500) OR (version IN ('streamer-ftd-v4-400-25x','${VERSION}') AND rate=400 AND bonusAmount<=50000)))`;
const AWARD_CHECK='(depositAmount>=40 AND bonusAmount>0 AND bonusAmount<=50000 AND wagerAmount>=depositAmount AND transactionId<>bonusTransactionId)';
const CLOSURE_DDL=`CREATE TABLE IF NOT EXISTS cashierWagerClosures (
 userId BIGINT UNSIGNED NOT NULL,
 approvedDepositId BIGINT UNSIGNED NOT NULL,
 requirementTransactionId BIGINT UNSIGNED NOT NULL,
 waivedAmount DECIMAL(18,2) NOT NULL,
 reason VARCHAR(32) NOT NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(userId,approvedDepositId,requirementTransactionId),
 KEY idx_wager_closure_requirement(userId,requirementTransactionId),
 CONSTRAINT chk_wager_closure_values CHECK (waivedAmount>0 AND reason='BALANCE_EXHAUSTED'),
 CONSTRAINT fk_wager_closure_user FOREIGN KEY(userId) REFERENCES users(id),
 CONSTRAINT fk_wager_closure_deposit FOREIGN KEY(approvedDepositId) REFERENCES transactions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
const SLOT_DDLS=[`CREATE TABLE IF NOT EXISTS cashierBonusSlotBets (
 appId VARCHAR(191) COLLATE utf8mb4_bin NOT NULL, transactionId VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 userId BIGINT UNSIGNED NOT NULL, requirementTransactionId BIGINT UNSIGNED NOT NULL,
 roundId VARCHAR(191) COLLATE utf8mb4_bin NOT NULL, stakeUnits BIGINT UNSIGNED NOT NULL,
 settled TINYINT UNSIGNED NOT NULL DEFAULT 0, refunded TINYINT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(appId,transactionId), KEY byRequirement(userId,requirementTransactionId), KEY byRound(appId,roundId,userId),
 CONSTRAINT chk_bonus_slot_bet CHECK(stakeUnits>0 AND settled IN (0,1) AND refunded IN (0,1))
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
 `CREATE TABLE IF NOT EXISTS cashierBonusSlotCredits (
 userId BIGINT UNSIGNED NOT NULL, requirementTransactionId BIGINT UNSIGNED NOT NULL,
 credited DECIMAL(18,2) NOT NULL DEFAULT 0,
 PRIMARY KEY(userId,requirementTransactionId), CONSTRAINT chk_bonus_slot_credit CHECK(credited>=0)
 ) ENGINE=InnoDB`];
module.exports={SLOT_DDLS,VERSION,FLAG,REQUEST_CHECK,AWARD_CHECK,CLOSURE_DDL};
