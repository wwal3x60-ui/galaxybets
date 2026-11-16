'use strict';
const {money,decimal,error,decision}=require('./protocol.cjs');
const success=balance=>({code:0,error:'',data:{Balance:Number(decimal(balance))}});
const refusal=message=>({code:1,error:message,data:null});
class Wallet {
 constructor(pool,config){this.pool=pool;this.config=config;}
 async transaction(fn) {
  const c=await this.pool.getConnection();let committed=false,broken=false;
  try{await c.beginTransaction();const value=await fn(c);try{await c.commit();committed=true;}catch(e){broken=true;throw e;}return value;}
  catch(e){if(!committed&&!broken)try{await c.rollback();}catch{broken=true;}throw e;}
  finally{if(broken)c.destroy();else c.release();}
 }
 async account(c,userId) {
  const [[user]]=await c.query('SELECT id,role,banned,accountLock,sponsorLock,CAST(balance AS CHAR) AS balance FROM users WHERE id=? FOR UPDATE',[userId]);
  if(!user)throw error('UNKNOWN_PLAYER');
  await c.query('INSERT IGNORE INTO gbSlotWalletRemainders(userId,units) VALUES (?,0)',[userId]);
  const [[dust]]=await c.query('SELECT units FROM gbSlotWalletRemainders WHERE userId=? FOR UPDATE',[userId]);
  return {user,balance:money(user.balance)+BigInt(dust.units)};
 }
 async get(userId) {
  if(userId==='codejackpot-wallet-test')return success(0n);
  return this.transaction(async c=>{const {balance}=await this.account(c,userId);return success(balance);});
 }
 async transfer(body,amount) {
  return this.transaction(async c=>{
   const {user,balance}=await this.account(c,body.UserID);
   const [[previous]]=await c.query('SELECT payloadHash,response FROM gbSlotTransactions WHERE appId=? AND transactionId=? FOR UPDATE',[body.AppID,body.TransactionID]);
   // Replay is checked before account restrictions or feature flags; committed results stay stable.
   if(previous)return decision({body,amount,balance,previous}).replay;
   const [[existing]]=await c.query('SELECT * FROM gbSlotRounds WHERE appId=? AND roundId=? FOR UPDATE',[body.AppID,body.RoundID]);
   let reference;
   if(body.Reason==='refund')[[reference]]=await c.query('SELECT * FROM gbSlotTransactions WHERE appId=? AND transactionId=? FOR UPDATE',[body.AppID,body.RefTransactionID]);
   const {fingerprint}=require('./protocol.cjs');let result,after;
   try {
    if(body.Reason==='bet') {
     if(!this.config.enabled)throw error('SLOTS_DISABLED');
     if(String(user.role).toUpperCase()!=='ADMIN' || user.banned || user.accountLock || user.sponsorLock)throw error('ACCOUNT_RESTRICTED');
     const [[session]]=await c.query("SELECT id FROM gbSlotSessions WHERE userId=? AND gameId=? AND currency=? AND state IN ('pending','launched') LIMIT 1",[body.UserID,body.GameID,this.config.currency]);
     if(!session)throw error('NO_LAUNCH_SESSION');
    }
    const plan=decision({body,amount,balance,round:existing,reference,maxBet:this.config.maxBet});
    after=plan.after;
    if(after<0n || after>9007199254740991n)throw error('BALANCE_OUT_OF_RANGE');
    result=success(after);
   }catch(e){if(!e.publicError)throw e;result=refusal(e.publicError);}
   if(result.code===0) {
    // Main wallet remains cents-compatible. Preserve the provider's four-decimal dust separately.
    await c.query('UPDATE users SET balance=? WHERE id=?',[decimal(after/100n,2),body.UserID]);
    await c.query('UPDATE gbSlotWalletRemainders SET units=? WHERE userId=?',[Number(after%100n),body.UserID]);
    if(!existing)await c.query('INSERT INTO gbSlotRounds(appId,roundId,userId,gameId,currency) VALUES (?,?,?,?,?)',[body.AppID,body.RoundID,body.UserID,body.GameID,body.Currency]);
    const column={bet:'betTotal',win:'winTotal',refund:'refundTotal'}[body.Reason];
    await c.query(`UPDATE gbSlotRounds SET ${column}=${column}+?,closed=? WHERE appId=? AND roundId=?`,[decimal(amount<0n?-amount:amount),body.IsEnd?1:0,body.AppID,body.RoundID]);
    if(body.Reason==='refund')await c.query('UPDATE gbSlotTransactions SET refunded=1 WHERE appId=? AND transactionId=?',[body.AppID,body.RefTransactionID]);
   }
   await c.query('INSERT INTO gbSlotTransactions(appId,transactionId,roundId,userId,gameId,reason,amount,payloadHash,response) VALUES (?,?,?,?,?,?,?,?,?)',[body.AppID,body.TransactionID,body.RoundID,body.UserID,body.GameID,body.Reason,decimal(amount),fingerprint(body),JSON.stringify(result)]);
   if(result.code===0)await require('../utils/bonus-slot-wagering').onTransfer(c,body,amount);
   return result;
  });
 }
}
module.exports={Wallet,success,refusal};
