'use strict';
const {units,decimal}=require('./cashier-money');
async function add(c,userId,transactionId,amount){
 const required=decimal(units(amount)*5n);
 await require('./cashier-wagering').addDepositRequirement(c,userId,transactionId,amount,required);
 return required;
}
async function progress(c,userId){
 const [[row]]=await c.query(`SELECT CAST(COALESCE(SUM(t.amount),0) AS CHAR) AS received,
  CAST(COALESCE(SUM(w.amount),0) AS CHAR) AS required,CAST(COALESCE(SUM(w.remaining),0) AS CHAR) AS remaining
  FROM cashierDepositWagers w JOIN transactions t ON t.id=w.transactionId
  WHERE w.userId=? AND t.type='in' AND t.method='tip' AND t.status='approved'`,[userId]);
 const [[audit]]=await c.query("SELECT CAST(COALESCE(SUM(x.waivedAmount),0) AS CHAR) AS waived FROM cashierWagerClosures x JOIN transactions t ON t.id=x.requirementTransactionId WHERE x.userId=? AND t.type='in' AND t.method='tip' AND t.status='approved'",[userId]);
 const satisfied=units(row.required)-units(row.remaining);
 if(units(audit.waived)>satisfied)throw Error('Tip closure audit exceeds satisfied requirement');
 return {...row,waived:audit.waived,actualProgress:decimal(satisfied-units(audit.waived)),multiplier:'5',qualifyingGames:['case','battle','mines','roulette','jackpot','coinflip','crash','upgrader'],contributions:{house:50,packs:100,battles:100},existingTermsPreserved:true};
}
module.exports={add,progress};
