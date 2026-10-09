const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture() {
  const data = new Map(); let fail = '';
  const localStorage = {getItem:k=>data.get(k)??null,setItem(k,v){if(k===fail)throw Error('quota');data.set(k,String(v));}};
  const ctx=vm.createContext({localStorage,console});
  for(const f of ['data','save-store'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),ctx);
  return {store:vm.runInContext('SaveStore',ctx),data,quota:k=>fail=k};
}
const old={cleared:13,coins:60000,stones:30,levels:{spear:20},owned:{zeus:true},stars:{0:3}};
let n=0;function test(name,fn){fn();n++;console.log('✓ '+name);}
test('Legacy progress, purchases and levels survive reading and export/import',()=>{
  const {store:s,data}=fixture();data.set(s.key,JSON.stringify(old));
  assert.equal(JSON.stringify(s.parse(s.export(s.read()))),JSON.stringify(old));
});
test('Last valid save survives corrupted primary and damaged source is retained',()=>{
  const {store:s,data}=fixture();s.write(old);s.write({...old,coins:70000});data.set(s.key,'broken');
  assert.equal(s.read().coins,60000);assert.equal(data.get(s.key+'-damaged'),'broken');assert.equal(s.recovered,true);
});
test('Corruption without backup blocks automatic fresh-game overwrite',()=>{
  const {store:s,data}=fixture();data.set(s.key,'broken');assert.equal(s.read(),null);assert.equal(s.blocked,true);
  assert.equal(s.write({cleared:0,coins:0}),false);assert.equal(data.get(s.key),'broken');
});
test('Quota failure while backing up cannot overwrite primary',()=>{
  const {store:s,data,quota}=fixture();s.write(old);quota(s.backupKey);
  assert.equal(s.write({...old,coins:0}),false);assert.equal(JSON.parse(data.get(s.key)).coins,60000);
});
test('Explicit restore keeps a restore point through subsequent autosaves',()=>{
  const {store:s,data}=fixture();s.write(old);s.write({...old,coins:10},true);s.write({...old,coins:20});
  assert.equal(JSON.parse(data.get(s.key+'-restore-point')).coins,60000);
});
test('Invalid and future backups are rejected without mutation',()=>{
  const {store:s,data}=fixture();s.write(old);const before=data.get(s.key);
  for(const raw of ['null','{}','{"cleared":1,"coins":-1}',JSON.stringify({...old,daily:{list:[{}]}}),JSON.stringify({format:'stick-kingdom-save',version:99,data:old})])assert.throws(()=>s.parse(raw));
  assert.equal(data.get(s.key),before);
});
test('Missing primary recovers backup',()=>{
  const {store:s,data}=fixture();data.set(s.backupKey,JSON.stringify(old));assert.equal(s.read().cleared,13);
});
test('Evolution flags are kept and malformed ones are rejected',()=>{
  const {store:s}=fixture();
  assert.equal(JSON.stringify(s.parse(JSON.stringify({...old,evo:{spear:true,archer:false}})).evo),'{"spear":true,"archer":false}');
  assert.throws(()=>s.parse(JSON.stringify({...old,evo:{spear:'yes'}})));
});
test('Completed original campaign and expansion progress survive backup round trips',()=>{
  const {store:s}=fixture();for(const cleared of [20,21,30]){
    const data={...old,cleared,stars:{19:3,20:2}};assert.equal(s.parse(s.export(data)).cleared,cleared);
  }
});
test('Slot 1 keeps the legacy key; other slots are separate and remembered',()=>{
  const {store:s,data}=fixture();data.set('stick-kingdom-save-v1',JSON.stringify(old));
  assert.equal(s.slot,1);assert.equal(s.key,'stick-kingdom-save-v1');assert.equal(s.read().cleared,13);
  assert.equal(s.peek(2),null);
  s.useSlot(2);assert.equal(data.get(s.slotKey),'2');assert.equal(s.read(),null);
  s.write({...old,cleared:3,coins:5});
  assert.equal(JSON.parse(data.get('stick-kingdom-save-v1-s2')).cleared,3);
  assert.equal(JSON.parse(data.get('stick-kingdom-save-v1')).cleared,13,'slot 1 untouched');
  assert.equal(s.peek(1).cleared,13);assert.equal(s.peek(2).cleared,3);
  s.write({...old,cleared:4,coins:5});assert.equal(JSON.parse(data.get('stick-kingdom-save-v1-s2-backup')).cleared,3,'backups stay per slot');
  assert.equal(data.get('stick-kingdom-save-v1-backup'),undefined);
  assert.equal(s.useSlot(4),false);assert.equal(s.slot,2);
  data.set('stick-kingdom-save-v1-s3','broken');assert.equal(s.peek(3).broken,true);assert.equal(data.get('stick-kingdom-save-v1-s3'),'broken','peek never repairs');
});
test('A corrupted slot blocks only itself',()=>{
  const {store:s,data}=fixture();s.write(old);s.useSlot(2);data.set(s.key,'broken');
  assert.equal(s.read(),null);assert.equal(s.blocked,true);
  s.useSlot(1);assert.equal(s.blocked,false);assert.equal(s.read().cleared,13);
});
test('The chosen slot is picked up on the next launch',()=>{
  const data=new Map([['stick-kingdom-slot','3']]);
  const localStorage={getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,String(v));}};
  const ctx=vm.createContext({localStorage,console});
  for(const f of ['data','save-store'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),ctx);
  assert.equal(vm.runInContext('SaveStore.slot',ctx),3);assert.equal(vm.runInContext('SaveStore.key',ctx),'stick-kingdom-save-v1-s3');
});
test('Damaged number fields are repaired when a save is loaded',()=>{
  // main.js 는 DOM 을 쓰므로 저장 정리 함수만 떼어 data.js 위에서 돌린다
  const src=fs.readFileSync('js/main.js','utf8');
  const grab=name=>{const i=src.indexOf('function '+name+'(');const j=src.indexOf('\n}\n',i);return src.slice(i,j+3);};
  const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync('js/data.js','utf8'),ctx);
  vm.runInContext(grab('defaultSave')+grab('normalizeSave'),ctx);
  ctx.raw={...old,coins:'abc',stones:-4,pity:NaN,mythPity:'7',totalKills:null,upgrades:{wallet:'x',income:3.7},stats:{wins:'oops',battles:5}};
  const s=vm.runInContext('normalizeSave(raw)',ctx);
  assert.equal(s.coins,0);assert.equal(s.stones,3);assert.equal(s.pity,0);assert.equal(s.mythPity,7);assert.equal(s.totalKills,0);
  assert.equal(s.upgrades.wallet,0);assert.equal(s.upgrades.income,3);assert.equal(s.stats.wins,0);assert.equal(s.stats.battles,5);
  ctx.raw=old;const ok=vm.runInContext('normalizeSave(raw)',ctx);
  assert.equal(ok.coins,60000);assert.equal(ok.stones,30);assert.equal(ok.levels.spear,20);
});
console.log(n+' save protection checks passed');
