#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = vm.createContext({ console, Math, JSON, saveGame() {} });
for (const file of ['data', 'game']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + file + '.js'), 'utf8'), ctx);
const { Battle, Fighter, UNITS, UNIT_BY_ID: U, ENEMIES: E, makeEndlessStage } = vm.runInContext('({Battle, Fighter, UNITS, UNIT_BY_ID, ENEMIES, makeEndlessStage})', ctx);
function save() { return {cleared:20, coins:0, upgrades:{}, stars:{}, owned:{}, levels:{}, loadout:['spear','merchant','duelist']}; }
function battle(stage) { return new Battle(0, save(), stage || {baseHp:10000,money:900,rate:0,waves:[],reward:0}); }
let count = 0;
function test(name, fn) { fn(); count++; console.log('✓ ' + name); }
test('Invalid and unselected cards cannot deploy', () => {
  const b = battle(); assert.equal(b.canDeploy('missing'), false); assert.equal(b.deploy('archer'), false);
  assert.equal(b.deploy('spear'), true);
});
test('Duplicate loadout entries are removed', () => {
  const s = save(); s.loadout = ['spear','spear']; assert.equal(new Battle(0,s).roster.length,1);
});
test('Merchant has a live-unit cap and fixed income', () => {
  const b = battle();
  for (let i=0;i<3;i++) { b.money=900; b.cooldowns.merchant=0; assert.equal(b.deploy('merchant'),true); }
  b.cooldowns.merchant=0; assert.equal(b.deploy('merchant'),false);
  b.allies[0].dead=true; assert.equal(b.canDeploy('merchant'),true);
  const m=b.allies[1];m.abMul=5;b.money=0;b.supportTick(m,b.allies,1,true);assert.equal(b.money,12);
});
test('Lifesteal uses HP damage after armor, barrier and overkill', () => {
  const b=battle(), a=b.makeAlly(U.duelist,500);a.hp=100;
  const e=new Fighter({...E.goblin,ab:{armor:0.5}},'enemy',550);e.hp=10;e.giveBarrier(40);
  b.hitOne(100,e,a,false);assert.equal(e.hp,0);assert.equal(a.hp,103.5);
});
test('Expired strong poison does not amplify a later weak poison', () => {
  const b=battle(), a=b.makeAlly(U.venom,500), e=new Fighter(E.goblin,'enemy',550);
  e.poisonT=0;e.poisonDps=999;b.hitOne(1,e,a,false);assert.equal(e.poisonDps,48);
});
test('DOT deals only its remaining duration', () => {
  const b=battle(),e=new Fighter(E.goblin,'enemy',1800); e.poisonT=.01;e.poisonDps=100;
  b.step([e],[],b.allyCastle,.03,false);assert.ok(Math.abs(e.hp-(e.maxHp-1))<1e-8);
});
test('Enemy death explosions damage the opposing castle once', () => {
  const b=battle(),e=b.spawnEnemy('wraith',b.allyCastle.x);e.dead=true;
  b.reap(b.enemies,b.allies,b.allyCastle,true);b.reap(b.enemies,b.allies,b.allyCastle,true);
  assert.equal(b.allyCastle.hp,b.allyCastle.maxHp-190);assert.equal(b.enemyCastle.hp,b.enemyCastle.maxHp);assert.equal(b.kills,1);
});
test('A projectile kill on the winning tick earns its reward', () => {
  const b=battle(),e=b.spawnEnemy('goblin',b.enemyCastle.x);
  b.shots.push({t:0,dur:.01,side:'ally',tx:e.x,y0:0,dmg:20000,area:true,areaRadius:100});
  b.update(1/30);assert.equal(b.state,'win');assert.equal(b.kills,1);assert.equal(b.coins,Math.round(12*.2)+180);
});
test('Battle rewards cannot be claimed twice', () => {
  const b=battle();b.finish('win');const coins=b.save.coins;b.finish('win');assert.equal(b.save.coins,coins);
});
test('45 endless waves include nine bosses in the correct groups', () => {
  const st=makeEndlessStage(45);assert.equal(new Set(st.waves.map(w=>w.wave)).size,45);
  const bosses=st.waves.filter(w=>E[w.e].boss);assert.equal(bosses.length,9);assert.equal(bosses[0].wave,4);assert.equal(bosses[8].wave,44);
});
test('Endless progress requires all enemies and summons in a wave to die', () => {
  const b=battle({endless:true,baseHp:99999,money:0,rate:0,waves:[{t:0,e:'lich',n:1,gap:1,wave:0},{t:99,e:'goblin',n:1,gap:1,wave:1}]});
  b.update(1/30);assert.equal(b.wavesDone(),0);
  const boss=b.enemies[0];b.bossAct(boss,{t:'summon',id:'goblin',n:1});boss.dead=true;
  assert.equal(b.wavesDone(),0);b.enemies.forEach(e=>e.dead=true);assert.equal(b.wavesDone(),1);
});
test('3x simulation advances in bounded steps', () => {
  const b=battle();b.speed=3;const steps=[];b.tick=dt=>steps.push(dt);b.update(.1);
  assert.equal(steps.length,9);assert.ok(steps.every(dt=>dt<=1/30));
});
test('Revival does not erase damage already dealt for lifesteal', () => {
  const b=battle(),a=b.makeAlly(U.duelist,500),e=b.makeAlly(U.paladin,550);
  a.hp=100;e.hp=10;b.hitOne(100,e,a,false);assert.equal(e.usedRevive,true);assert.equal(a.hp,103.5);
});
test('Melee impact preserves row zero and attacker direction', () => {
  const b=battle(),a=b.makeAlly(U.spear,500),e=new Fighter(E.goblin,'enemy',530);
  e.row=0;b.attack(a,e,[e],b.enemyCastle);
  const fx=b.fx.find(e=>e.type==='hit'||e.type==='crit');
  assert.equal(fx.row,0);assert.equal(fx.dir,1);
});
test('Thorns counter melee once but never ranged damage', () => {
  const b=battle(),a=b.makeAlly(U.spear,500),e=new Fighter(E.orcshield,'enemy',530);
  const hp=a.hp;b.hitOne(100,e,a,false);assert.ok(a.hp<hp);
  const ar=b.makeAlly(U.musketeer,500),before=ar.hp;b.hitOne(100,e,ar,false);assert.equal(ar.hp,before);
});
test('Regeneration stops during burning', () => {
  const b=battle(),e=new Fighter(E.ogre,'enemy',1800);e.hp=100;e.stunT=10;
  b.step([e],[],b.allyCastle,1,false);assert.equal(e.hp,118);
  e.burnT=1;e.burnDps=10;b.step([e],[],b.allyCastle,1,false);assert.equal(e.hp,108);
});
test('Cleanse removes nearby DOT and slow, keeps stun and distant ailments', () => {
  const b=battle(),p=b.makeAlly(U.purifier,500),a=b.makeAlly(U.spear,520),far=b.makeAlly(U.spear,900);
  for(const f of [a,far]){f.poisonT=5;f.burnT=4;f.slowT=3;f.stunT=2;}
  b.supportTick(p,[p,a,far],.1,true);assert.equal(a.poisonT+a.burnT+a.slowT,0);assert.equal(a.stunT,2);assert.equal(far.poisonT,5);
});
test('Deployment ward applies only on card deployment', () => {
  const s=save();s.upgrades.deployment=3;const b=new Battle(0,s,{baseHp:10000,money:900,rate:0,waves:[],reward:0});
  b.deploy('spear');assert.equal(b.allies[0].barrier,75);assert.equal(b.makeAlly(U.skeleton,500).barrier,0);
});
test('DOT resistance reduces poison by the advertised amount', () => {
  const b=battle(),a=b.makeAlly(U.spear,500);b.save.upgrades.resistance=5;a.poisonT=1;a.poisonDps=100;a.stunT=2;
  const hp=a.hp;b.step([a],[],b.enemyCastle,1,true);assert.equal(hp-a.hp,75);
});
test('Negative damage never heals HP or barrier', () => {
  const f=new Fighter(E.goblin,'enemy',500);f.hp=100;f.giveBarrier(20);f.takeDamage(-50);assert.equal(f.hp,100);assert.equal(f.barrier,20);
});
test('Legendary active cap allows replacements after death', () => {
  const s=save();s.owned.zeus=true;s.loadout=['zeus'];const b=new Battle(0,s,{baseHp:10000,money:900,rate:0,waves:[],reward:0});
  for(let i=0;i<2;i++){b.money=900;b.cooldowns.zeus=0;assert.equal(b.deploy('zeus'),true);}
  b.money=900;b.cooldowns.zeus=0;assert.equal(b.canDeploy('zeus'),false);b.allies[0].dead=true;assert.equal(b.canDeploy('zeus'),true);
});
test('Medical upgrade increases support healing by 6 percent per level', () => {
  const b=battle(),p=b.makeAlly(U.priest,500),a=b.makeAlly(U.spear,520);b.save.upgrades.medicine=5;a.hp=10;
  b.supportTick(p,[p,a],.1,true);assert.ok(Math.abs(a.hp-(10+120*1.3))<1e-8);
});
console.log(count + ' regression checks passed');
