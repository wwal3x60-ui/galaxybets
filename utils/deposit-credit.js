'use strict';
const {units,decimal}=require('./cashier-money');
const bonus=require('./deposit-bonus');
const wagering=require('./cashier-wagering');
const exhaustion=require('./exhausted-wagering');
// Used only inside the cashier's existing user-first transaction. No commit,
// provider call, automatic migration or notification takes place in this helper.
async function creditApprovedDeposit(c,transaction){
 const [[user]]=await c.query('SELECT id FROM users WHERE id=? FOR UPDATE',[transaction.userId]);
 const [[stored]]=await c.query('SELECT id,userId,CAST(amount AS CHAR) AS amount,type,status FROM transactions WHERE id=? FOR UPDATE',[transaction.id]);
 if(!user||!stored||String(stored.userId)!==String(transaction.userId)||stored.type!=='crypto_deposit'||stored.status!=='pending'||units(stored.amount)!==units(String(transaction.amount)))throw Error('Deposit is not pending or does not match the locked transaction');
 const closure=await exhaustion.closeIfExhausted(c,stored.userId,stored.id);
 const award=await bonus.approve(c,stored);
 await wagering.addDepositRequirement(c,stored.userId,stored.id,stored.amount,award.required);
 const [credited]=await c.query('UPDATE users SET balance=balance+? WHERE id=?',[decimal(units(stored.amount)+units(award.bonus)),stored.userId]);
 if(credited.affectedRows!==1)throw Error('Deposit user not found');
 const [approved]=await c.query("UPDATE transactions SET status='approved' WHERE id=? AND status='pending'",[stored.id]);
 if(approved.affectedRows!==1)throw Error('Deposit approval changed concurrently');
 return {award,closure};
}
module.exports={creditApprovedDeposit};
