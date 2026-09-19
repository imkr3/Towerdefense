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
console.log(n+' save protection checks passed');
