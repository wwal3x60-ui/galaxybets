'use strict';
const {units,decimal} = require('./cashier-money');
const min = (a,b) => a < b ? a : b;
async function boundary(c) {
  const [[flag]] = await c.query("SELECT value FROM siteFlags WHERE name='gb_cashier_first_bet'");
  if (!flag || !/^[1-9]\d*$/.test(String(flag.value))) throw Error('Cashier wagering schema is not installed. Run the supplied Aiven migration before deploying.');
  return String(flag.value);
}
async function addDepositRequirement(c, userId, transactionId, amount, requiredAmount=amount) {
  if (units(requiredAmount)<units(amount)) throw Error("Wagering requirement cannot be below deposit amount");
  await boundary(c);
  await c.query('SELECT id FROM users WHERE id=? FOR UPDATE',[userId]);
  // A locking current read avoids a stale REPEATABLE READ snapshot when a bet
  // commits while this deposit waits for the user's balance lock.
  const [[last]] = await c.query('SELECT CAST(id AS CHAR) AS id FROM bets ORDER BY id DESC LIMIT 1 FOR UPDATE');
  const firstBetId=(BigInt(last?.id||'0')+1n).toString();
  const [saved]=await c.query('INSERT IGNORE INTO cashierDepositWagers(transactionId,userId,amount,remaining,firstBetId) VALUES (?,?,?,?,?)',[transactionId,userId,requiredAmount,requiredAmount,firstBetId]);
  if (saved.affectedRows!==1) throw Error('Deposit wagering requirement already recorded');
  await c.query('UPDATE users SET wagerProgress=LEAST(wagerProgress,wagerRequirement),wagerRequirement=wagerRequirement+? WHERE id=?',[requiredAmount,userId]);
}
async function creditGameWagers(c, game, gameIds) {
  const firstBet=await boundary(c);
  const [bets]=await c.query(`SELECT CAST(id AS CHAR) AS id,CAST(userId AS CHAR) AS userId,CAST(amount AS CHAR) AS amount
    FROM bets WHERE game=? AND gameId IN (?) AND completed=1 AND amount>0 AND id>=? ORDER BY userId,id FOR UPDATE`,[game,gameIds,firstBet]);
  for (const bet of bets) {
    const [[user]]=await c.query('SELECT role,CAST(wagerRequirement AS CHAR) AS required,CAST(wagerProgress AS CHAR) AS progress FROM users WHERE id=? FOR UPDATE',[bet.userId]);
    if (!user || String(user.role).toUpperCase()==='BOT' || units(user.required)<=units(user.progress)) continue;
    const [saved]=await c.query('INSERT IGNORE INTO cashierWagerCredits(betId,userId,credited) VALUES (?,?,0)',[bet.id,bet.userId]);
    if (saved.affectedRows!==1) continue;
    const [deposits]=await c.query('SELECT CAST(w.transactionId AS CHAR) AS transactionId,CAST(w.remaining AS CHAR) AS remaining,CAST(w.firstBetId AS CHAR) AS firstBetId,t.type AS fundingType,t.method AS fundingMethod FROM cashierDepositWagers w LEFT JOIN transactions t ON t.id=w.transactionId WHERE w.userId=? AND w.remaining>0 ORDER BY w.transactionId FOR UPDATE',[bet.userId]);
    const outstanding=units(user.required)-units(user.progress);
    const tracked=deposits.reduce((sum,d)=>sum+units(d.remaining),0n);
    const legacy=outstanding>tracked?outstanding-tracked:0n;
    let available=units(bet.amount),credited=min(available,legacy); available-=credited;
    for(const deposit of deposits) {
      // Received-tip wagering is earned only on completed Packs and Battles.
      if(deposit.fundingType==='in'&&deposit.fundingMethod==='tip'&&!['case','battle'].includes(game))continue;
      if(available<=0n)break;
      if(BigInt(bet.id)<BigInt(deposit.firstBetId))continue;
      const credit=min(available,units(deposit.remaining));
      if(credit<=0n)continue;
      await c.query('UPDATE cashierDepositWagers SET remaining=remaining-? WHERE transactionId=?',[decimal(credit),deposit.transactionId]);
      available-=credit;credited+=credit;
    }
    if(credited>0n) {
      await c.query('UPDATE users SET wagerProgress=LEAST(wagerRequirement,wagerProgress+?) WHERE id=?',[decimal(credited),bet.userId]);
      await c.query('UPDATE cashierWagerCredits SET credited=? WHERE betId=?',[decimal(credited),bet.id]);
    }
  }
}
module.exports={addDepositRequirement,creditGameWagers,boundary};
