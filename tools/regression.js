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
const {rollSummon,GACHA,RARITY}=vm.runInContext('({rollSummon,GACHA,RARITY})',ctx);
test('Mythic pity wins over legendary pity, resets both, preserves inventory',()=>{
  const s={mythPity:119,pity:39,pulls:119,owned:{zeus:true}};
  let forced;rollSummon(s,r=>{forced=r;return U.hades;});assert.equal(forced,'UR');assert.equal(s.pity,0);assert.equal(s.mythPity,0);assert.equal(s.pulls,120);assert.equal(s.owned.zeus,true);
});
test('Old saves start mythic pity safely and SSR does not reset mythic progress',()=>{
  const s={pity:39};let forced;rollSummon(s,r=>{forced=r;return U.zeus;});assert.equal(forced,'SSR');assert.equal(s.mythPity,1);assert.equal(s.pity,0);
  assert.equal(Object.values(RARITY).reduce((n,r)=>n+r.weight,0),100);
});
function heroBattle(id){const s=save();s.owned[id]=true;s.loadout=[id];const b=new Battle(0,s,{baseHp:10000,money:900,rate:0,waves:[],reward:0});b.deploy(id);b.allies[0].x=600;return b;}
test('Active needs living deployed hero, target and initial cooldown',()=>{
  const b=heroBattle('hades');assert.equal(b.useHeroActive('hades'),false);b.heroCooldowns.hades=0;
  assert.equal(b.useHeroActive('hades'),false);const e=b.spawnEnemy('ogre',800);const hp=e.hp;
  assert.equal(b.useHeroActive('hades'),true);assert.ok(e.hp<hp);assert.equal(e.slowT,3);assert.equal(b.enemyCastle.hp,10000);assert.equal(b.useHeroActive('hades'),false);
});
test('Redeploy cannot reset active cooldown and dead heroes cannot cast',()=>{
  const b=heroBattle('ra');b.heroCooldowns.ra=31;b.allies[0].dead=true;assert.equal(b.canHeroActive('ra'),false);
  b.money=900;b.cooldowns.ra=0;b.deploy('ra');assert.equal(b.heroCooldowns.ra,31);
});
test('Rune protection cleanses nearby allies without stacking shields',()=>{
  const b=heroBattle('odin'),a=b.allies[0];a.poisonT=3;a.burnT=3;b.heroCooldowns.odin=0;
  assert.equal(b.useHeroActive('odin'),true);assert.equal(a.poisonT+a.burnT,0);assert.equal(a.barrier,320);
  b.heroCooldowns.odin=0;b.heroGlobalCd=0;b.useHeroActive('odin');assert.equal(a.barrier,320);
});
test('Shared active cooldown and stun block skill spam',()=>{
  const b=heroBattle('odin');b.heroCooldowns.odin=0;b.heroGlobalCd=1;assert.equal(b.canHeroActive('odin'),false);
  b.heroGlobalCd=0;b.allies[0].stunT=1;assert.equal(b.canHeroActive('odin'),false);
});
test('Forty stages span three acts and keep the endless threshold',()=>{
  const {STAGES,ENDLESS_UNLOCK_STAGE,ACTS,actOf}=vm.runInContext('({STAGES,ENDLESS_UNLOCK_STAGE,ACTS,actOf})',ctx);
  assert.equal(STAGES.length,40);assert.equal(ENDLESS_UNLOCK_STAGE,20);
  assert.equal(ACTS.map(a=>a.from).join(','),'0,20,30');
  assert.equal(actOf(0),ACTS[0]);assert.equal(actOf(29),ACTS[1]);assert.equal(actOf(39),ACTS[2]);
  assert.ok(STAGES.slice(20,30).every(s=>s.waves.length>=8&&s.reward>900));
  assert.ok(STAGES.slice(30).every(s=>s.waves.length>=8&&s.reward>=2400&&s.enemyMul>3));
});
test('Evasion only dodges projectiles and never true shots', () => {
  const b=battle(),h=b.spawnEnemy('harpy',600);
  const archer=b.makeAlly(U.archer,500),falcon=b.makeAlly(U.falconer,500),spear=b.makeAlly(U.spear,560);
  let dodged=0;for(let i=0;i<400;i++){const hp=h.hp;b.hitOne(1,h,archer,false);if(h.hp===hp)dodged++;h.hp=h.maxHp;}
  assert.ok(dodged>110&&dodged<250,'회피율이 45% 언저리여야 한다: '+dodged);
  for(let i=0;i<50;i++){const hp=h.hp;b.hitOne(1,h,falcon,false);assert.ok(h.hp<hp);h.hp=h.maxHp;}
  for(let i=0;i<50;i++){const hp=h.hp;b.hitOne(1,h,spear,false);assert.ok(h.hp<hp);h.hp=h.maxHp;}
});
test('Curse raises damage taken and purifiers wash it off', () => {
  const b=battle(),hex=b.spawnEnemy('hexer',700),a=b.makeAlly(U.spear,600),p=b.makeAlly(U.purifier,600);
  b.hitOne(0,a,hex,false);assert.ok(a.curseT>0);assert.equal(a.curseMul,1.35);
  const hp=a.hp;a.takeDamage(100);assert.ok(Math.abs(hp-a.hp-135)<1e-6);
  b.supportTick(p,[p,a],.1,true);assert.equal(a.curseT,0);assert.equal(a.curseMul,1);
});
test('An expired strong curse or sunder never boosts a weaker later one', () => {
  const b=battle(),hex=b.spawnEnemy('hexer',700),king=b.spawnEnemy('shadowking',760);
  const a=b.makeAlly(U.spear,600);
  b.hitOne(0,a,king,false);assert.equal(a.curseMul,1.25);
  a.curseT=0;b.hitOne(0,a,hex,false);assert.equal(a.curseMul,1.35);
  a.curseT=0;b.hitOne(0,a,king,false);assert.equal(a.curseMul,1.25,'만료된 강한 저주가 남으면 안 된다');
  const al=b.makeAlly(U.alchemist,500),e=b.spawnEnemy('orcshield',560);
  const weak=new Fighter({...U.alchemist,ab:{sunder:{amount:0.1,dur:3}}},'ally',500);
  b.hitOne(0,e,al,false);assert.equal(e.sunderAmt,0.3);
  e.sunderT=0;b.hitOne(0,e,weak,false);
  assert.equal(e.sunderAmt,0.1,'만료된 강한 부식이 남으면 안 된다');
});
test('Sunder strips armour for its duration only, per fighter', () => {
  const b=battle(),al=b.makeAlly(U.alchemist,500);
  const one=b.spawnEnemy('orcshield',560),two=b.spawnEnemy('orcshield',600);
  b.hitOne(0,one,al,false);
  assert.ok(Math.abs(one.armorNow-0)<1e-9,'부식이 갑주 15%를 전부 벗긴다');
  assert.ok(Math.abs(two.armorNow-0.15)<1e-9,'다른 개체의 갑주는 그대로여야 한다');
  one.sunderT=0;assert.ok(Math.abs(one.armorNow-0.15)<1e-9);
});
test('Execution multiplies damage only below the threshold', () => {
  const b=battle(),ex=b.makeAlly(U.executioner,500),e=b.spawnEnemy('ogre',560);
  assert.equal(b.hitOne(100,e,ex,false),100);
  e.hp=e.maxHp*0.2;assert.equal(b.hitOne(100,e,ex,false),260);
});
test('Shield break eats the barrier before the hit lands', () => {
  const b=battle(),inq=b.makeAlly(U.inquisitor,500),e=b.spawnEnemy('goblin',560);
  e.giveBarrier(300);b.hitOne(100,e,inq,false);
  assert.equal(e.barrier,0);assert.equal(e.hp,e.maxHp-100);
});
test('Chain lightning jumps to nearby foes with falloff and never loops', () => {
  const b=battle(),t=b.makeAlly(U.tempest,500);t.atk=100;
  const near=[b.spawnEnemy('goblin',560),b.spawnEnemy('goblin',600),b.spawnEnemy('goblin',640)];
  const far=b.spawnEnemy('goblin',1400);
  const hp=near.map(e=>e.hp);
  b.chainFrom(t,near[0],b.enemies);
  assert.equal(near[0].hp,hp[0],'첫 대상은 연쇄에서 제외된다');
  assert.ok(Math.abs(hp[1]-near[1].hp-60)<1e-6);
  assert.ok(Math.abs(hp[2]-near[2].hp-36)<1e-6);
  assert.equal(far.hp,far.maxHp);
});
test('Raiders drain the war chest but never below zero', () => {
  const b=battle(),r=b.spawnEnemy('raider',200),a=b.makeAlly(U.spear,180);
  b.money=20;b.hitOne(10,a,r,false);assert.equal(b.money,6);
  b.hitOne(10,a,r,false);assert.equal(b.money,0);
});
test('Death split spawns once and the spawn keeps its wave', () => {
  const b=battle(),e=b.spawnEnemy('bloat',900);e.wave=3;e.dead=true;
  b.reap(b.enemies,b.allies,b.allyCastle,true);
  const spawn=b.enemies.filter(x=>x.split);
  assert.equal(spawn.length,2);assert.ok(spawn.every(x=>x.wave===3&&x.s.id==='spider'));
  spawn[0].dead=true;b.reap(b.enemies,b.allies,b.allyCastle,true);
  assert.equal(b.enemies.filter(x=>x.split).length,2);
});
test('Summon caps hold the live count steady', () => {
  const b=battle(),bm=b.makeAlly(U.beastmaster,500);b.allies.push(bm);
  for(let i=0;i<4;i++){bm.abCd=0;b.supportTick(bm,b.allies,.1,true);}
  assert.equal(b.allies.filter(a=>a.s.id==='warwolf').length,4);
  b.allies.filter(a=>a.s.id==='warwolf')[0].dead=true;
  b.allies=b.allies.filter(a=>!a.dead);bm.abCd=0;b.supportTick(bm,b.allies,.1,true);
  assert.equal(b.allies.filter(a=>a.s.id==='warwolf').length,4);
});
test('A weaker haste aura never slows the royal command', () => {
  const b=battle(),h=b.makeAlly(U.herald,500),a=b.makeAlly(U.spear,520);
  b.allies.push(h,a);b.cmdCd=0;b.useCommand();
  assert.equal(a.hasteMul,0.6);
  h.abCd=0;b.supportTick(h,b.allies,.1,true);
  assert.equal(a.hasteMul,0.6,'나팔수가 왕명 가속을 덮어써서는 안 된다');
  a.hasteT=0;h.abCd=0;b.supportTick(h,b.allies,.1,true);
  assert.equal(a.hasteMul,0.7);
});
test('Every effect the roster casts can be drawn by both layers',()=>{
  const {UNITS,ENEMIES}=vm.runInContext('({UNITS,ENEMIES})',ctx);
  const layer=Object.create(require('../js/gl-fx.js').GLFx.prototype);
  const render=fs.readFileSync(path.join(__dirname,'../js/render.js'),'utf8');
  const kinds=new Set();
  // 신화 액티브(kind)는 mythic 연출 한 곳에서 기본형까지 받아 그린다.
  UNITS.forEach(u=>{ if(u.castFx)kinds.add(u.castFx); });
  Object.keys(ENEMIES).forEach(k=>{
    const e=ENEMIES[k];
    if(e.special&&e.special.kind)kinds.add(e.special.kind);
    (e.phases||[]).forEach(p=>{if(p.kind)kinds.add(p.kind);});
  });
  for(const kind of kinds){
    assert.ok(render.indexOf("case '"+kind+"'")>=0||render.indexOf("kind==='"+kind+"'")>=0,
              '캔버스 연출 없음: '+kind);
  }
  for(const u of UNITS) if(u.castFx) assert.ok(layer.supports(u.castFx),'WebGL 연출 없음: '+u.castFx);
});
test('First expansion victory advances from 20 to 21 and retains old stars',()=>{
  const s=save();s.stars[19]=3;const b=new Battle(20,s);b.finish('win');
  assert.equal(s.cleared,21);assert.equal(s.stars[19],3);assert.ok(s.stars[20]>0);
});
console.log(count + ' regression checks passed');
