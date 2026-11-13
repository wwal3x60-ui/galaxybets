'use strict';
const {units,decimal}=require('./cashier-money');
async function add(c,userId,transactionId,amount){
 const required=decimal(units(amount)*4n);
 await require('./cashier-wagering').addDepositRequirement(c,userId,transactionId,amount,required);
 return required;
}
async function progress(c,userId){
 const [[row]]=await c.query(`SELECT CAST(COALESCE(SUM(t.amount),0) AS CHAR) AS received,
  CAST(COALESCE(SUM(w.amount),0) AS CHAR) AS required,CAST(COALESCE(SUM(w.remaining),0) AS CHAR) AS remaining
  FROM cashierDepositWagers w JOIN transactions t ON t.id=w.transactionId
  WHERE w.userId=? AND t.type='in' AND t.method='tip' AND t.status='approved'`,[userId]);
 return {...row,multiplier:'4',qualifyingGames:['case','battle']};
}
module.exports={add,progress};
