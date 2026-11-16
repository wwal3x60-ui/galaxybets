'use strict';
const {VERSION,FLAG,REQUEST_CHECK,AWARD_CHECK,CLOSURE_DDL,SLOT_DDLS}=require('../utils/bonus400-schema.cjs');
const OLD_REQUEST='rate IN (10,20,30,40,50) AND bonusAmount>0 AND bonusAmount<=500 AND wagerAmount>0';
const COMPAT_REQUEST="(bonusAmount>0 AND wagerAmount>0 AND ((version IN ('streamer-ftd-v3-5x','streamer-ftd-v2','jammy-ftd-v1') AND rate IN (10,20,30,40,50) AND bonusAmount<=500) OR (version='streamer-ftd-v4-400-25x' AND rate=400 AND bonusAmount<=50000)))";
const OLD_AWARD='depositAmount>=40 AND bonusAmount>0 AND bonusAmount<=500 AND wagerAmount>=depositAmount AND transactionId<>bonusTransactionId';
const metadataText=value=>String(value).replace(/\\'/g,"'");
const normalized=value=>metadataText(value).toLowerCase().replace(/_[a-z0-9]+(?=')/g,'').replace(/[\s()`"]/g,'');
// CHECK_CLAUSE can escape its literal delimiters and add charset introducers.
// Parse the supported predicates instead of deleting boolean parentheses: the
// gate must distinguish A AND (B OR C) from (A AND B) OR C.
function canonicalCheck(value){
 const input=metadataText(value),tokens=[];let index=0;
 while(index<input.length){
  const rest=input.slice(index),space=/^\s+/.exec(rest);if(space){index+=space[0].length;continue;}
  const quote=input[index];
  if(quote==="'"||quote==='`'||quote==='"'){
   index++;let text='',closed=false;
   while(index<input.length){
    if(input[index]===quote){if(input[index+1]===quote){text+=quote;index+=2;continue;}index++;closed=true;break;}
    text+=input[index++];
   }
   if(!closed)throw Error('Unclosed CHECK token');
   tokens.push({kind:quote==="'"?'string':'identifier',value:quote==="'"?text:text.toLowerCase()});continue;
  }
  const number=/^\d+(?:\.\d+)?/.exec(rest);
  if(number){const [whole,fraction='']=number[0].split('.');const tail=fraction.replace(/0+$/,'');tokens.push({kind:'number',value:BigInt(whole).toString()+(tail?'.'+tail:'')});index+=number[0].length;continue;}
  const word=/^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
  if(word){tokens.push({kind:'identifier',value:word[0].toLowerCase()});index+=word[0].length;continue;}
  const operator=/^(?:>=|<=|<>|!=|=|>|<|\(|\)|,)/.exec(rest);
  if(operator){tokens.push({kind:'operator',value:operator[0]==='!='?'<>':operator[0]});index+=operator[0].length;continue;}
  throw Error('Unsupported CHECK token');
 }
 let position=0;
 const at=v=>tokens[position]?.value===v;
 const take=v=>{if(!at(v))throw Error('Unexpected CHECK syntax');position++;};
 function operand(){
  let token=tokens[position++];if(!token)throw Error('Missing CHECK operand');
  if(token.kind==='identifier'&&/^_[a-z0-9]+$/.test(token.value)&&tokens[position]?.kind==='string')token=tokens[position++];
  if(!['identifier','string','number'].includes(token.kind))throw Error('Unsupported CHECK operand');
  return [token.kind,token.value];
 }
 function atom(){
  if(at('(')){take('(');const value=or();take(')');return value;}
  const left=operand(),op=tokens[position++];
  if(op?.value==='in'){
   take('(');const list=[operand()];while(at(',')){take(',');list.push(operand());}take(')');return ['in',left,list];
  }
  if(!op||op.kind!=='operator'||!['>','>=','<','<=','=','<>'].includes(op.value))throw Error('Unsupported CHECK operator');
  return [op.value,left,operand()];
 }
 function chain(operator,next){const parts=[next()];while(at(operator)){take(operator);parts.push(next());}const flattened=[];for(const part of parts){if(part[0]===operator)flattened.push(...part.slice(1));else flattened.push(part);}return flattened.length===1?flattened[0]:[operator,...flattened];}
 function and(){return chain('and',atom);}
 function or(){return chain('or',and);}
 const result=or();if(position!==tokens.length)throw Error('Trailing CHECK syntax');return JSON.stringify(result);
}
function sameCheck(actual,expected){try{return canonicalCheck(actual)===canonicalCheck(expected);}catch{return false;}}
function metadataTableMatches(actual,expected,mode){
 if(![0,1,2].includes(mode))throw Error('Unsupported MySQL table-name mode');
 return mode===0?String(actual)===String(expected):String(actual).toLowerCase()===String(expected).toLowerCase();
}
const requiredTables=['users','transactions','bets','siteFlags','depositBonusRequests','depositBonusAwards','cashierDepositWagers','cashierWagerCredits','cashierWagerRemainders','mines','coinflips','battles','battlePlayers','inventory','gbSlotRounds','gbSlotWalletRemainders'];
async function migration(c,{apply=false}={}){
 const [[version]]=await c.query('SELECT VERSION() AS version');
 const v=String(version.version).match(/^(\d+)\.(\d+)\.(\d+)/);
 if(!v||/mariadb/i.test(version.version)||Number(v[1])<8||(Number(v[1])===8&&Number(v[2])===0&&Number(v[3])<16))throw Error('MySQL 8.0.16 or newer is required for enforced CHECK constraints.');
 const [[identifierMode]]=await c.query('SELECT @@lower_case_table_names AS mode');
 const tableNameMode=Number(identifierMode.mode);
 if(![0,1,2].includes(tableNameMode))throw Error('Unsupported MySQL table-name mode');
 const sameTable=(actual,expected)=>metadataTableMatches(actual,expected,tableNameMode);
 const sameColumn=(actual,expected)=>String(actual).toLowerCase()===String(expected).toLowerCase();
 const [tables]=await c.query('SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.tables WHERE table_schema=DATABASE()');
 for(const name of requiredTables)if(!tables.some(t=>sameTable(t.name,name)&&t.engine==='InnoDB'))throw Error('Missing InnoDB table: '+name);
 const [[base]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_streamer_bonus_version'");
 if(base?.value!=='streamer-ftd-v2')throw Error('Base streamer bonus schema is not ready.');
 for(const name of ['gb_cashier_first_bet','gb_weighted_wager_first_bet_v1']){const [[flag]]=await c.query('SELECT value FROM siteFlags WHERE name=?',[name]);if(!flag||!/^\d+$/.test(String(flag.value))||BigInt(flag.value)<1n)throw Error('Missing positive wagering boundary: '+name);}
 const [columns]=await c.query("SELECT TABLE_NAME AS tableName,COLUMN_NAME AS name,COLUMN_TYPE AS type FROM information_schema.columns WHERE table_schema=DATABASE()");
 const needed={users:['id','role','banned','accountLock','sponsorLock','balance','wagerRequirement','wagerProgress'],transactions:['id','userId','type','method','status','amount'],bets:['id','userId','completed'],mines:['id','userId','endedAt'],coinflips:['id','ownerId','fire','ice','winnerSide'],battles:['id','ownerId','endedAt','cancelledAt'],battlePlayers:['battleId','userId'],inventory:['id','userId','status','price'],gbSlotRounds:['userId','roundId','closed'],gbSlotWalletRemainders:['userId','units'],cashierDepositWagers:['transactionId','userId','amount','remaining','firstBetId'],cashierWagerRemainders:['userId','transactionId','halfCent']};
 for(const [table,names] of Object.entries(needed))for(const name of names)if(!columns.some(x=>sameTable(x.tableName,table)&&sameColumn(x.name,name)))throw Error('Missing exhaustion-check column: '+table+'.'+name);
 const [[badRequest]]=await c.query('SELECT transactionId FROM depositBonusRequests WHERE NOT '+REQUEST_CHECK+' LIMIT 1');
 const [[badAward]]=await c.query('SELECT userId FROM depositBonusAwards WHERE NOT '+AWARD_CHECK+' LIMIT 1');
 if(badRequest||badAward)throw Error('Existing bonus rows are incompatible with the reviewed schema; no DDL applied.');
 const rate=columns.find(x=>sameTable(x.tableName,'depositBonusRequests')&&sameColumn(x.name,'rate'));
 if(!rate||!/^(tinyint|smallint|mediumint|int|bigint)(\(\d+\))? unsigned$/i.test(rate.type))throw Error('Unexpected bonus rate column type');
 const [checks]=await c.query(`SELECT t.TABLE_NAME AS tableName,t.CONSTRAINT_NAME AS name,c.CHECK_CLAUSE AS clause FROM information_schema.table_constraints t JOIN information_schema.check_constraints c ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.CONSTRAINT_TYPE='CHECK' AND LOWER(t.TABLE_NAME) IN ('depositbonusrequests','depositbonusawards')`);
 const actions=[];
 for(const [table,name,oldClause,newClause] of [['depositBonusRequests','chk_bonus_request_values',OLD_REQUEST,REQUEST_CHECK],['depositBonusAwards','chk_bonus_award_values',OLD_AWARD,AWARD_CHECK]]){
  const check=checks.find(x=>sameTable(x.tableName,table)&&sameColumn(x.name,name));
  if(!check||![oldClause,newClause,...(table==='depositBonusRequests'?[COMPAT_REQUEST]:[])].some(expected=>sameCheck(check.clause,expected))){
   const failure=Error('Unexpected or missing CHECK constraint: '+name);
   failure.schemaDiagnostic={tableNameMode,table,name,found:!!check,actualClause:check?.clause||null,expectedOld:oldClause,expectedNew:newClause,returnedChecks:checks.map(x=>({table:x.tableName,name:x.name}))};
   throw failure;
  }
  const clauses=[];
  if(table==='depositBonusRequests'&&/^tinyint/i.test(rate.type))clauses.push('MODIFY COLUMN rate SMALLINT UNSIGNED NOT NULL');
  if(!sameCheck(check.clause,newClause))clauses.push('DROP CHECK '+name,'ADD CONSTRAINT '+name+' CHECK '+newClause);
  if(clauses.length)actions.push('ALTER TABLE '+table+' '+clauses.join(', '));
 }
 if(!tables.some(t=>sameTable(t.name,'cashierWagerClosures')))actions.push(CLOSURE_DDL);
 else{
  const [[ddl]]=await c.query('SHOW CREATE TABLE cashierWagerClosures');
  const existing=normalized(Object.values(ddl)[1]);
  for(const fragment of ['PRIMARY KEY(userId,approvedDepositId,requirementTransactionId)','waivedAmount decimal(18,2) NOT NULL',"reason='BALANCE_EXHAUSTED'",'FOREIGN KEY(userId) REFERENCES users(id)','FOREIGN KEY(approvedDepositId) REFERENCES transactions(id)'])if(!existing.includes(normalized(fragment)))throw Error('Existing closure table requires manual schema review');
 }
 for(const [index,name] of ['cashierBonusSlotBets','cashierBonusSlotCredits'].entries()){if(!tables.some(t=>sameTable(t.name,name)))actions.push(SLOT_DDLS[index]);else{const fields=index===0?['appId','transactionId','userId','requirementTransactionId','roundId','stakeUnits','settled','refunded']:['userId','requirementTransactionId','credited'];for(const nameField of fields)if(!columns.some(x=>sameTable(x.tableName,name)&&sameColumn(x.name,nameField)))throw Error('Unexpected slots bonus ledger schema');}}
 if(!apply)return {status:'PREFLIGHT_COMPLETE',changesRequired:actions.length,policyVersion:VERSION,tableNameMode};
 for(const statement of actions)await c.query(statement);
 // Recheck after DDL before setting readiness. MySQL DDL commits per table;
 // each CHECK replacement is combined with its rate change in one atomic ALTER.
 const verified=await migration(c,{apply:false});
 if(verified.changesRequired!==0)throw Error('Bonus schema verification did not converge');
 await c.query("INSERT INTO siteFlags(name,value) VALUES ('gb_bonus_400_schema_v1','ready') ON DUPLICATE KEY UPDATE value=VALUES(value)");
 await c.query('INSERT INTO siteFlags(name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',[FLAG,'ready']);
 return {status:'BONUS400_SCHEMA_READY',changesApplied:actions.length,policyVersion:VERSION,tableNameMode,balancesChanged:false,historicalRequirementsChanged:false};
}
async function main(){
 const fs=require('node:fs'),path=require('node:path');
 const args=process.argv.slice(2),get=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
 const applying=args.includes('--apply');
 if(applying&&args.includes('--check'))throw Error('Choose --check or --apply, not both.');
 const env=require('dotenv').parse(fs.readFileSync(path.resolve(get('--env-file')||'.env')));
 const host=env.SQL_HOST||'localhost',database=env.SQL_DB||'',port=Number(env.SQL_PORT||3306);
 const expectedHost=get('--expected-host'),expectedDb=get('--expected-db'),expectedPort=get('--expected-port');
 if(!expectedHost||!expectedDb||!expectedPort)throw Error('Provide --expected-host, --expected-port and --expected-db for both check and apply.');
 console.log(JSON.stringify({target:{host,port,database,source:'explicit env file'},applying}));
 if(host!==expectedHost||database!==expectedDb||port!==Number(expectedPort))throw Error('Database target does not match expected host/port/database; no connection attempted.');
 let c,locked=false;
 try{
  c=await require('mysql2/promise').createConnection({host,port,database,user:env.SQL_USER,password:env.SQL_PASS,connectTimeout:20000,ssl:env.NODE_ENV==='development'&&['127.0.0.1','localhost','::1'].includes(host)?undefined:env.SQL_CA?{ca:env.SQL_CA,rejectUnauthorized:true}:{rejectUnauthorized:false}});
  const [[lock]]=await c.query('SELECT GET_LOCK(?,0) AS acquired',[FLAG]);locked=Number(lock.acquired)===1;if(!locked)throw Error('Another bonus400 migration is running');
  console.log(JSON.stringify(await migration(c,{apply:applying})));
 }finally{if(c){if(locked)await c.query('SELECT RELEASE_LOCK(?)',[FLAG]).catch(()=>{});await c.end();}}
}
if(require.main===module)main().catch(e=>{if(e.schemaDiagnostic)console.error('Schema preflight detail:',JSON.stringify(e.schemaDiagnostic));console.error('Bonus400 migration stopped:',e.code||e.message);process.exitCode=1;});
module.exports={migration,normalized,metadataTableMatches,canonicalCheck,sameCheck};
