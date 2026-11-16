'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {migration,metadataTableMatches}=require('../scripts/apply-bonus400-v1.cjs');
const {canonicalCheck,sameCheck}=require('../scripts/apply-bonus400-v1.cjs');
const {REQUEST_CHECK,AWARD_CHECK}=require('../utils/bonus400-schema.cjs');
const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../scripts/bonus400-qa-schema.json'),'utf8'));
function metadataConnection(mode,{forceLower=false,omitTable=null,wrongEngine=null}={}){
 const actual=name=>mode!==0||forceLower?name.toLowerCase():name;
 const tables=schema.tables.filter(t=>t.name!==omitTable).map(t=>({name:actual(t.name),engine:t.name===wrongEngine?'MyISAM':t.engine}));
 const columns=[],checks=[];
 for(const table of schema.tables){
  for(const line of table.ddl.split('\n')){
   const column=line.match(/^\s+"([^"]+)"\s+(.+)$/);
   if(column)columns.push({tableName:actual(table.name),name:column[1],type:column[2].split(/\s+(?:NOT NULL|DEFAULT|AUTO_INCREMENT|CHARACTER SET|COLLATE)/i)[0]});
   const check=line.match(/CONSTRAINT "(chk_bonus_(?:request|award)_values)" CHECK (.+)$/);
   if(check)checks.push({tableName:actual(table.name),name:check[1],clause:check[2].replace(/,$/,'')});
  }
 }
 const queries=[];
 return {queries,query:async(q,p)=>{
  queries.push(q);
  if(q==='SELECT VERSION() AS version')return [[{version:'8.0.46'}]];
  if(q==='SELECT @@lower_case_table_names AS mode')return [[{mode}]];
  if(q.startsWith('SELECT TABLE_NAME AS name,ENGINE AS engine'))return [tables];
  if(q.includes("name='gb_streamer_bonus_version'"))return [[{value:'streamer-ftd-v2'}]];
  if(q==='SELECT value FROM siteFlags WHERE name=?')return [[{value:'1'}]];
  if(q.startsWith('SELECT TABLE_NAME AS tableName,COLUMN_NAME'))return [columns];
  if(q.startsWith('SELECT transactionId FROM depositBonusRequests WHERE NOT')||q.startsWith('SELECT userId FROM depositBonusAwards WHERE NOT'))return [[]];
  if(q.includes('information_schema.table_constraints'))return [checks];
  throw Error('Unexpected or mutating preflight query: '+q);
 }};
}
test('table matching follows MySQL mode and fails closed on an unknown mode',()=>{
 assert.equal(metadataTableMatches('siteflags','siteFlags',1),true);
 assert.equal(metadataTableMatches('siteflags','siteFlags',2),true);
 assert.equal(metadataTableMatches('siteflags','siteFlags',0),false);
 assert.throws(()=>metadataTableMatches('siteflags','siteFlags',3));
});
for(const mode of [0,1,2])test('complete schema preflight handles identifier mode '+mode,async()=>{
 const c=metadataConnection(mode);const result=await migration(c);
 assert.equal(result.status,'PREFLIGHT_COMPLETE');assert.equal(result.changesRequired,5);assert.equal(result.tableNameMode,mode);
 assert(c.queries.every(q=>q.startsWith('SELECT ')));
});
test('case-sensitive server still rejects a wrongly cased table name',async()=>{
 await assert.rejects(()=>migration(metadataConnection(0,{forceLower:true})),/Missing InnoDB table: siteFlags/);
});
test('case-insensitive handling still rejects missing or non-InnoDB tables',async()=>{
 await assert.rejects(()=>migration(metadataConnection(1,{omitTable:'siteFlags'})),/Missing InnoDB table: siteFlags/);
 await assert.rejects(()=>migration(metadataConnection(1,{wrongEngine:'siteFlags'})),/Missing InnoDB table: siteFlags/);
});
test('actual escaped MySQL CHECK metadata matches the reviewed new formula',()=>{
 const observed=REQUEST_CHECK.replace(/'([^']*)'/g,"_utf8mb4\\'$1\\'");
 assert.equal(sameCheck(observed,REQUEST_CHECK),true);
});
test('CHECK comparison accepts redundant wrapping and equivalent decimal literals',()=>{
 const observed='(((`depositAmount`>=40.00) AND (`bonusAmount`>0.00) AND (`bonusAmount`<=50000.00) AND (`wagerAmount`>=`depositAmount`) AND (`transactionId`<>`bonusTransactionId`)))';
 assert.equal(sameCheck(observed,AWARD_CHECK),true);
});
test('CHECK comparison retains boolean grouping',()=>{
 assert.equal(sameCheck('bonusAmount>0 AND (wagerAmount>0 OR rate=400)','(bonusAmount>0 AND wagerAmount>0) OR rate=400'),false);
});
test('CHECK comparison rejects changed monetary caps and version literals',()=>{
 assert.equal(sameCheck(REQUEST_CHECK.replace('bonusAmount<=50000','bonusAmount<=500000'),REQUEST_CHECK),false);
 assert.equal(sameCheck(REQUEST_CHECK.replace('streamer-ftd-v4-400-25x','STREAMER-FTD-V4-400-25X'),REQUEST_CHECK),false);
 assert.equal(sameCheck(REQUEST_CHECK.replace('rate=400','rate=401'),REQUEST_CHECK),false);
});
test('CHECK comparison fails closed on unsupported or trailing SQL syntax',()=>{
 assert.equal(sameCheck('bonusAmount<=500 OR 1=1','bonusAmount<=500'),false);
 assert.throws(()=>canonicalCheck('bonusAmount+1<=500'));
 assert.equal(sameCheck('bonusAmount<=500; SELECT 1','bonusAmount<=500'),false);
});
