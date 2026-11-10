'use strict';
require('dotenv').config();const {sql}=require('../database');const {migrate}=require('../utils/feature-schema');
(async()=>{const apply=process.argv.includes('--apply');if(apply&&!process.argv.includes('--backend-stopped'))throw Error('Stop backend and bot scripts; add --backend-stopped.');console.log({mode:apply?'apply':'preview',...await migrate(sql,apply)});console.log(apply?'Feature schema installed. No packs, odds, balances or historical results were changed.':'Read-only preview.');})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>sql.end());
