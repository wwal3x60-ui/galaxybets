'use strict';require('dotenv').config();
const {sql,doTransaction}=require('../database');const {ensureBots,createBotWorker}=require('../utils/jackpot-bots');let timer,stopping=false;
const worker=createBotWorker({sql,doTransaction,onChange:require.main===module?async()=>{}:async id=>require('../routes/games/jackpot/functions').broadcastJackpotState(id)});
async function start(){await ensureBots(sql);timer=setInterval(()=>{if(!stopping)worker.tick().catch(e=>console.error('Jackpot bot worker:',e.code||e.message));},250);if(require.main!==module)timer.unref?.();console.log('Bots running: 1–3 initial at 3s; human $10+ reactions at 2–7s; funded wallets only.');}
start().catch(e=>{console.error('Unable to start jackpot bots:',e.message);if(require.main===module)process.exitCode=1;});
async function stop(){stopping=true;clearInterval(timer);if(require.main===module)await sql.end();}if(require.main===module){process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());}module.exports={stop,tick:worker.tick};
