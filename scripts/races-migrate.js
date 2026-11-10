'use strict';
const path = require('path');
require('dotenv').config({path:path.join(__dirname, '../.env')});
const {sql, doTransaction} = require('../database');
const {makeRaceService} = require('../routes/leaderboard/race-service');
async function main() {
    const apply = process.argv.includes('--apply');
    const [tables] = await sql.query(`SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) IN ('gbraceseries','gbracerounds','gbraceprizes')`);
    console.log({mode:apply?'apply':'audit',existingRaceTables:tables.length,weeklyPrizes:['300.00','150.00','50.00'],monthlyPrizes:['6000.00','3000.00','1000.00']});
    if (!apply) return;
    await sql.query(`CREATE TABLE IF NOT EXISTS gbRaceSeries (
        type VARCHAR(16) NOT NULL, currentRoundId BIGINT UNSIGNED DEFAULT NULL,
        anchorDay TINYINT UNSIGNED NOT NULL, PRIMARY KEY (type),
        CONSTRAINT chk_gb_race_type CHECK (type IN ('weekly','monthly')),
        CONSTRAINT chk_gb_race_day CHECK (anchorDay BETWEEN 1 AND 31)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await sql.query(`CREATE TABLE IF NOT EXISTS gbRaceRounds (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, type VARCHAR(16) NOT NULL,
        roundNumber INT UNSIGNED NOT NULL, startsAt DATETIME(3) NOT NULL, endsAt DATETIME(3) NOT NULL,
        settledAt DATETIME(3) DEFAULT NULL, firstPrize DECIMAL(18,2) NOT NULL,
        secondPrize DECIMAL(18,2) NOT NULL, thirdPrize DECIMAL(18,2) NOT NULL,
        PRIMARY KEY (id), UNIQUE KEY uq_gb_race_round (type, roundNumber),
        CONSTRAINT chk_gb_race_window CHECK (endsAt > startsAt),
        CONSTRAINT fk_gb_race_series FOREIGN KEY (type) REFERENCES gbRaceSeries(type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await sql.query(`CREATE TABLE IF NOT EXISTS gbRacePrizes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, roundId BIGINT UNSIGNED NOT NULL,
        userId BIGINT UNSIGNED NOT NULL, position TINYINT UNSIGNED NOT NULL,
        wagered DECIMAL(20,2) NOT NULL, amount DECIMAL(18,2) NOT NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id), UNIQUE KEY uq_gb_race_place (roundId, position),
        UNIQUE KEY uq_gb_race_user (roundId, userId), KEY idx_gb_race_prize_user (userId),
        CONSTRAINT chk_gb_race_place CHECK (position BETWEEN 1 AND 3),
        CONSTRAINT chk_gb_race_positive CHECK (amount > 0 AND wagered > 0),
        CONSTRAINT fk_gb_race_prize_round FOREIGN KEY (roundId) REFERENCES gbRaceRounds(id),
        CONSTRAINT fk_gb_race_prize_user FOREIGN KEY (userId) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    const service = makeRaceService({sql,doTransaction,io:{}});
    await doTransaction(async(connection,commit)=>{await service.seed(connection);await commit();});
    const [rounds] = await sql.query(`SELECT r.type, r.roundNumber,
        DATE_FORMAT(r.startsAt,'%Y-%m-%dT%H:%i:%sZ') AS startsAtUTC,
        DATE_FORMAT(r.endsAt,'%Y-%m-%dT%H:%i:%sZ') AS endsAtUTC
        FROM gbRaceSeries s JOIN gbRaceRounds r ON r.id = s.currentRoundId ORDER BY r.type`);
    console.table(rounds);
    console.log('Race migration complete. Existing schedules were preserved; no balances or historical leaderboard rows were changed.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>sql.end());
