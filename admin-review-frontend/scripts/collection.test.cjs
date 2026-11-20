'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/lib/cases/collection.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const collection={exports:{}};new Function('exports','module',compiled)(collection.exports,collection);
const {caseCollection,caseBySlug,filterCases,caseMoney,displayCaseName}=collection.exports;

test('the review collection has twenty unique, reachable cases with artwork',()=>{
 assert.equal(caseCollection.length,20);
 assert.equal(new Set(caseCollection.map(c=>c.slug)).size,20);
 for(const item of caseCollection){assert.match(item.slug,/^[a-z0-9-]+$/);assert.ok(item.price>0&&Number.isFinite(item.price));assert.equal(caseBySlug(item.slug),item);assert.ok(fs.existsSync(path.join(__dirname,'../public/assets/crimson/cases',item.slug+'.webp')));}
 assert.equal(caseBySlug('not-a-case'),undefined);
});
test('search ignores letter case and surrounding whitespace; category and price combine',()=>{
 assert.deepEqual(filterCases({search:'  REDLINE  '}).map(c=>c.slug),['redline']);
 const filtered=filterCases({category:'Tech',min:40,max:125});assert.equal(filtered.length,2);assert.ok(filtered.every(c=>c.category==='Tech'&&c.price>=40&&c.price<=125));
 assert.equal(filterCases({max:0}).length,0);assert.equal(filterCases({search:'there-is-no-such-case'}).length,0);
});
test('price sorting changes the view without mutating the collection',()=>{
 const before=caseCollection.map(c=>c.slug);const ascending=filterCases({sort:'price-low'});const descending=filterCases({sort:'price-high'});
 for(let i=1;i<ascending.length;i++)assert.ok(ascending[i].price>=ascending[i-1].price);
 assert.equal(ascending[0].slug,descending.at(-1).slug);assert.deepEqual(caseCollection.map(c=>c.slug),before);
});
test('visible case names and prices preserve their intended meaning',()=>{assert.equal(displayCaseName('Premium Pack'),'Premium Case');assert.equal(displayCaseName('Six Packs'),'Six Cases');assert.equal(caseMoney(4.99),'$4.99');});
test('all demo contents and hero/game assets are present',()=>{
 for(const rel of ['hero.webp',...['mines','roulette','coinflip','jackpot'].map(x=>'games/'+x+'.webp'),...['rifle','blade','gloves','watch','headphones','card'].map(x=>'items/'+x+'.webp')])assert.ok(fs.existsSync(path.join(__dirname,'../public/assets/crimson',rel)),rel);
});
