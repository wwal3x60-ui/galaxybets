'use strict';
const path = require('path');
require('dotenv').config({path:path.join(__dirname, '../.env')});
const {sql} = require('../database');
async function main() {
    const checks = {
        invalidSchedule: `SELECT COUNT(*) AS count FROM gbRaceSeries s LEFT JOIN gbRaceRounds r ON r.id = s.currentRoundId
            WHERE r.id IS NULL OR r.type <> s.type OR r.settledAt IS NOT NULL OR r.endsAt <= r.startsAt`,
        missingSeries: `SELECT 2 - COUNT(*) AS count FROM gbRaceSeries WHERE type IN ('weekly','monthly')`,
        invalidPrize: `SELECT COUNT(*) AS count FROM gbRacePrizes p JOIN gbRaceRounds r ON r.id = p.roundId
            WHERE r.settledAt IS NULL OR p.position NOT BETWEEN 1 AND 3 OR p.wagered <= 0
            OR p.amount <> CASE p.position WHEN 1 THEN r.firstPrize WHEN 2 THEN r.secondPrize WHEN 3 THEN r.thirdPrize END`,
        missingPrizeHistory: `SELECT COUNT(*) AS count FROM gbRacePrizes p WHERE
            (SELECT COUNT(*) FROM transactions t WHERE t.method = 'race_prize' AND t.type = 'in' AND t.status = 'approved'
             AND t.userId = p.userId AND t.amount = p.amount
             AND CAST(t.methodId AS BINARY) = CAST(CONCAT(p.roundId, ':', p.position) AS BINARY)) <> 1`,
        orphanPrizeHistory: `SELECT COUNT(*) AS count FROM transactions t WHERE t.method = 'race_prize' AND NOT EXISTS (
            SELECT 1 FROM gbRacePrizes p WHERE t.userId = p.userId AND t.amount = p.amount
            AND CAST(t.methodId AS BINARY) = CAST(CONCAT(p.roundId, ':', p.position) AS BINARY))`,
        overlappingRounds: `SELECT COUNT(*) AS count FROM gbRaceRounds a JOIN gbRaceRounds b ON a.type = b.type AND a.id < b.id
            AND a.startsAt < b.endsAt AND b.startsAt < a.endsAt`
    };
    const result={};for(const [name,query] of Object.entries(checks)){const [[row]]=await sql.query(query);result[name]=Number(row.count);}
    console.table(result);
    const [[summary]]=await sql.query('SELECT COUNT(*) AS prizesPaid, CAST(COALESCE(SUM(amount),0) AS CHAR) AS totalPaid FROM gbRacePrizes');
    console.log(summary);if(Object.values(result).some(Boolean))process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>sql.end());
