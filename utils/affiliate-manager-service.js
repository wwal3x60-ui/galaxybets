'use strict';
const {sql,doTransaction}=require('../database');
const {createService}=require('./affiliate-managers');
const transaction=async fn=>{for(let attempt=0;;attempt++){let committed=false;try{return await doTransaction((c,commit,rollback)=>fn(c,async()=>{await commit();committed=true;},rollback));}catch(e){if(committed||attempt>=2||!['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(e.code))throw e;await new Promise(resolve=>setTimeout(resolve,30*(attempt+1)));}}};
module.exports=createService({sql,transaction,tipWagering:require('./tip-wagering'),notify:async userId=>{const [[u]]=await sql.query('SELECT CAST(balance AS CHAR) AS balance FROM users WHERE id=?',[userId]);if(u)require('../socketio/server').to(String(userId)).emit('balance','set',Number(u.balance));}});
