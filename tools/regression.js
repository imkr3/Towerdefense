#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = vm.createContext({ console, Math, JSON, saveGame() {} });
for (const file of ['data', 'game']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + file + '.js'), 'utf8'), ctx);
const { Battle, Fighter, UNITS, UNIT_BY_ID: U, ENEMIES: E, makeEndlessStage, STAGES } = vm.runInContext('({Battle, Fighter, UNITS, UNIT_BY_ID, ENEMIES, makeEndlessStage, STAGES})', ctx);
const world = () => vm.runInContext('({WORLD, ENEMY_BASE_X, ENEMY_SPAWN_X})', ctx);
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
  // 전설·신화는 한 명씩만 설 수 있다. 쓰러지면 다시 낼 수 있어야 한다.
  const s=save();s.owned.zeus=true;s.loadout=['zeus'];const b=new Battle(0,s,{baseHp:10000,money:900,rate:0,waves:[],reward:0});
  b.money=900;b.cooldowns.zeus=0;assert.equal(b.deploy('zeus'),true);
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
test('Thirty stages retain the existing endless unlock threshold',()=>{
  const {STAGES,ENDLESS_UNLOCK_STAGE}=vm.runInContext('({STAGES,ENDLESS_UNLOCK_STAGE})',ctx);
  assert.equal(STAGES.length,30);assert.equal(ENDLESS_UNLOCK_STAGE,20);
  assert.ok(STAGES.slice(20).every(s=>s.waves.length>=8&&s.reward>900));
});
test('First expansion victory advances from 20 to 21 and retains old stars',()=>{
  const s=save();s.stars[19]=3;const b=new Battle(20,s);b.finish('win');
  assert.equal(s.cleared,21);assert.equal(s.stars[19],3);assert.ok(s.stars[20]>0);
});
/* ---------- 전설·신화 고유 능력 ---------- */
function hero(id) { const b=battle(); const s=b.save; s.owned[id]=1; s.loadout=[id,'spear']; return new Battle(0,s,{baseHp:10000,money:9999,rate:0,waves:[],reward:0}); }
test('Legendary and mythic units are limited to one on the field', () => {
  for (const id of ['zeus','thor','anubis','hades','odin','ra']) {
    assert.equal(U[id].maxActive, 1, id);
    const b=hero(id); b.money=99999; assert.equal(b.deploy(id),true);
    b.cooldowns[id]=0; assert.equal(b.canDeploy(id),false, id+' second copy');
  }
});
test('Zeus chain lightning hops to nearby enemies and weakens each hop', () => {
  const b=battle(), z=b.makeAlly(U.zeus,400);
  const es=[0,1,2,3,4].map(i=>{const e=new Fighter(E.ogre,'enemy',600+i*60);b.enemies.push(e);return e;});
  b.hitOne(100,es[0],z,false);
  const lost=es.map(e=>e.maxHp-e.hp);
  assert.equal(lost[0],100);
  for (let i=1;i<5;i++) assert.ok(lost[i]>0 && lost[i]<lost[i-1], 'hop '+i+' '+lost[i]);
});
test('Chain lightning does not reach enemies beyond its hop range', () => {
  const b=battle(), z=b.makeAlly(U.zeus,400);
  const a=new Fighter(E.ogre,'enemy',600), far=new Fighter(E.ogre,'enemy',600+U.zeus.ab.chain.range+50);
  b.enemies.push(a,far); b.hitOne(100,a,z,false); assert.equal(far.hp,far.maxHp);
});
test('Thor ignores armor and hits bosses and heavy armor harder', () => {
  const b=battle(), t=b.makeAlly(U.thor,400);
  const armored=new Fighter({...E.goblin,hp:5000,ab:{armor:0.5}},'enemy',500);
  const plain=new Fighter({...E.goblin,hp:5000},'enemy',500);
  b.hitOne(100,armored,t,false); b.hitOne(100,plain,t,false);
  assert.equal(plain.maxHp-plain.hp,100);
  assert.equal(armored.maxHp-armored.hp,100*U.thor.ab.breaker);
});
test('Odin rallies nearby allies but not himself', () => {
  const b=battle(), o=b.makeAlly(U.odin,500), near=b.makeAlly(U.spear,560), far=b.makeAlly(U.spear,1400);
  b.allies.push(o,near,far); o.abCd=0; b.supportTick(o,b.allies,0.01,true);
  assert.ok(near.rallyMul>1); assert.equal(far.rallyMul,1); assert.equal(o.rallyMul,1);
  assert.ok(Math.abs(b.rollDamage(near).dmg - near.atk*near.rallyMul) < 1e-9);
});
test('Rally wears off when its timer runs out', () => {
  const b=battle(), s=b.makeAlly(U.spear,500); s.rallyT=0.05; s.rallyMul=1.35;
  b.step([s],[],b.enemyCastle,0.1,true); assert.equal(s.rallyMul,1);
});
test('Ra brands enemies so every source deals more damage', () => {
  const b=battle(), r=b.makeAlly(U.ra,400), sp=b.makeAlly(U.spear,420);
  const e=new Fighter({...E.goblin,hp:5000},'enemy',500);
  b.hitOne(10,e,r,false); const before=e.hp; b.hitOne(100,e,sp,false);
  assert.equal(before-e.hp, 100*(1+U.ra.ab.sunmark.vuln));
});
test('Hades raises fallen enemies as skeletons, with a cap', () => {
  const b=battle(), h=b.makeAlly(U.hades,500); b.allies.push(h);
  const max=U.hades.ab.reanimate.max;
  for (let i=0;i<max+4;i++) { h.reCd=0; const e=new Fighter(E.goblin,'enemy',540); b.reanimate(e); }
  assert.equal(b.allies.filter(a=>a.raisedBy===h).length, max);
});
test('Hades does not raise summoned enemies or enemies out of range', () => {
  const b=battle(), h=b.makeAlly(U.hades,500); b.allies.push(h);
  const s=new Fighter(E.goblin,'enemy',520); s.summoned=true; b.reanimate(s);
  h.reCd=0; b.reanimate(new Fighter(E.goblin,'enemy',500+U.hades.ab.reanimate.radius+100));
  assert.equal(b.allies.length,1);
});
test('Hero actives do not re-trigger chain lightning on every target', () => {
  const b=hero('zeus'); b.money=99999; b.deploy('zeus'); const z=b.allies[0];
  for (let i=0;i<6;i++) b.enemies.push(new Fighter({...E.ogre,hp:99999},'enemy',z.x+60+i*20));
  b.heroCooldowns.zeus=0; b.heroGlobalCd=0;
  assert.equal(b.useHeroActive('zeus'),true); assert.equal(b._chaining,false);
});

test('Every stage has its own shorter battlefield, bosses a little longer', () => {
  for (const st of STAGES) { assert.ok(st.len >= 1200 && st.len < 2000, st.name + ' len ' + st.len); }
  assert.ok(STAGES[0].len < STAGES[18].len);
  assert.ok(STAGES[4].len > STAGES[3].len);                     // 보스 전장
});
test('A battle moves the enemy fort to the end of its own field', () => {
  const b = new Battle(0, save()); let w = world();
  assert.equal(w.WORLD, STAGES[0].len); assert.equal(b.enemyCastle.x, STAGES[0].len - 96);
  const b2 = new Battle(19, save()); w = world();
  assert.equal(w.WORLD, STAGES[19].len); assert.equal(b2.enemyCastle.x, w.ENEMY_BASE_X);
  const e = b2.spawnEnemy('goblin'); assert.ok(e.x <= w.ENEMY_SPAWN_X && e.x > w.ENEMY_SPAWN_X - 50);
  battle(); assert.equal(world().WORLD, 2000);                   // 길이 없는 임시 전장은 예전 길이
});
test('Units track age and engagement for animation only', () => {
  const b = battle(), a = b.makeAlly(U.spear, 500); b.allies.push(a);
  b.step(b.allies, [], b.enemyCastle, 0.1, true);
  assert.ok(Math.abs(a.age - 0.1) < 1e-9); assert.equal(a.engaged, false);
  const e = new Fighter(E.goblin, 'enemy', 530); b.enemies.push(e);
  b.step(b.allies, b.enemies, b.enemyCastle, 0.1, true); assert.equal(a.engaged, true);
});

test('Endless never runs out: waves keep coming and keep getting stronger', () => {
  const b = new Battle(0, save(), makeEndlessStage());
  assert.ok(b.queue.length >= 24);
  for (let i = 0; i < 400 && b.endlessW < 40; i++) { b.qi = b.queue.length; b.extendEndless(); }
  assert.ok(b.endlessW >= 40);
  const byWave = {}; b.queue.forEach(e => { byWave[e.wave] = e.mul; });
  assert.ok(byWave[39] > byWave[20] && byWave[20] > byWave[0]);
  assert.ok(byWave[39] > 3);                                   // 40웨이브쯤이면 세 배를 넘는다
  // 대기열이 비어도 무한 전장은 끝나지 않는다
  const c = new Battle(0, save(), makeEndlessStage());
  c.qi = c.queue.length; c.enemies.length = 0; c.update(1/30);
  assert.equal(c.state, 'play'); assert.ok(c.queue.length - c.qi >= 24);
  const e = c.spawnEnemy('goblin', undefined, vm.runInContext('endlessMul(30)', ctx));
  assert.ok(e.maxHp > E.goblin.hp * 3);
});
test('Stage traits: armored, horde, hero hunters and curse', () => {
  const mk = mods => battle({ baseHp: 10000, money: 900, rate: 0, reward: 0, mods: mods,
                              waves: [{ t: 0, e: 'goblin', n: 5, gap: 1 }, { t: 5, e: 'troll', n: 1, gap: 1 }] });
  const ir = mk(['ironclad']), g = ir.spawnEnemy('goblin', 900);
  assert.equal(g.ab.armor, 0.6); assert.equal(E.goblin.ab && E.goblin.ab.armor, undefined);
  const h = mk(['horde']); assert.equal(h.queue.filter(q => q.e === 'goblin').length, 9);
  assert.equal(h.queue.filter(q => q.e === 'troll').length, 1);
  const hg = h.spawnEnemy('goblin', 900); assert.equal(hg.maxHp, Math.round(E.goblin.hp * 0.6));
  const hunt = mk(['giantslayer']), orc = hunt.spawnEnemy('goblin', 520);
  const cheap = hunt.makeAlly(U.spear, 500), pricey = hunt.makeAlly(U.thor, 500);
  let a = cheap.hp; hunt.hitOne(10, cheap, orc, false); assert.equal(a - cheap.hp, 10);
  a = pricey.hp; hunt.hitOne(10, pricey, orc, false); assert.equal(a - pricey.hp, 30);
  const cu = mk(['curse']), sk = cu.makeAlly(U.skeleton, 500); sk.summoned = true; cu.allies.push(sk);
  const kn = cu.makeAlly(U.knight, 480); cu.allies.push(kn);
  kn.hp = 100; kn.heal(100); assert.equal(kn.hp, 150);
  cu.step(cu.allies, [], cu.enemyCastle, 1, true); assert.ok(sk.hp < sk.maxHp * 0.95);
});

/* ---------------- 요괴록 · 태엽 공방 ---------------- */
const rnd = v => { const r = ctx.Math.random; ctx.Math.random = () => v; return () => { ctx.Math.random = r; }; };
test('Gumiho charms non-boss foes into hitting their own side', () => {
  const b = hero('gumiho'), g = b.makeAlly(U.gumiho, 400);
  const a = new Fighter(E.orcspear, 'enemy', 600), c = new Fighter({ ...E.goblin, hp: 5000 }, 'enemy', 640);
  b.enemies.push(a, c);
  const undo = rnd(0); b.hitOne(1, a, g, false); undo();
  assert.ok(a.charmT > 0);
  const hp = c.hp; a.cd = 0; b.step(b.enemies, b.allies, b.allyCastle, 0.05, false);
  assert.ok(c.hp < hp, 'charmed foe strikes its ally'); assert.equal(a.x, 600, 'charmed foe does not advance');
  const boss = new Fighter(E.troll, 'enemy', 600); boss.boss = true;
  const undo2 = rnd(0); b.hitOne(1, boss, g, false); undo2(); assert.equal(boss.charmT, 0);
});
test('Reaper executes low non-boss foes but never bosses', () => {
  const b = hero('saja'), r = b.makeAlly(U.saja, 400);
  const e = new Fighter({ ...E.goblin, hp: 1000 }, 'enemy', 480); e.hp = 230; b.hitOne(40, e, r, false);
  assert.equal(e.dead, true);
  const boss = new Fighter({ ...E.troll, hp: 1000 }, 'enemy', 480); boss.boss = true; boss.hp = 150;
  b.hitOne(10, boss, r, false); assert.equal(boss.dead, false);
});
test('Dokkaebi bounty adds war funds, capped by the wallet', () => {
  const b = hero('dokkaebi'), d = b.makeAlly(U.dokkaebi, 400); b.money = 0;
  const undo = rnd(0); b.hitOne(1, new Fighter({ ...E.goblin, hp: 5000 }, 'enemy', 480), d, false); undo();
  assert.equal(b.money, U.dokkaebi.ab.bounty.gold);
  b.money = b.walletMax; const u2 = rnd(0); b.hitOne(1, new Fighter({ ...E.goblin, hp: 5000 }, 'enemy', 480), d, false); u2();
  assert.equal(b.money, b.walletMax);
});
test('Mudang weakens the damage a foe deals, then wears off', () => {
  const b = hero('mudang'), m = b.makeAlly(U.mudang, 400), e = new Fighter(E.orcspear, 'enemy', 500);
  const full = b.rollDamage(e).dmg; b.hitOne(1, e, m, false);
  assert.ok(Math.abs(b.rollDamage(e).dmg - full * 0.7) < 1e-9);
  b.step([e], [], b.allyCastle, 5, false); assert.equal(e.weakMul, 1);
});
test('Steam colossus spins up while firing and cools when it walks', () => {
  const b = hero('steammech'), m = b.makeAlly(U.steammech, 400); b.allies.push(m);
  const e = new Fighter({ ...E.goblin, hp: 99999 }, 'enemy', 560); b.enemies.push(e);
  const i0 = m.intervalNow;
  for (let k = 0; k < 40; k++) { m.cd = 0; b.step(b.allies, b.enemies, b.enemyCastle, 0.01, true); }
  assert.ok(Math.abs(m.spin - U.steammech.ab.spinup.max) < 1e-9); assert.ok(m.intervalNow < i0 / 2);
  b.enemies.length = 0; b.step(b.allies, b.enemies, b.enemyCastle, 0.01, true); assert.equal(m.spin, 0);
});
test('Airship bombs the farthest foe in range, others the nearest', () => {
  const b = hero('airship'), a = b.makeAlly(U.airship, 400), k = b.makeAlly(U.spear, 400);
  const near = new Fighter(E.goblin, 'enemy', 450), far = new Fighter(E.goblin, 'enemy', 700);
  assert.equal(b.findTarget(a, [near, far], b.enemyCastle), far);
  assert.equal(b.findTarget(k, [near, far], b.enemyCastle), near);
});
test('Inventor builds at most three turrets, and turrets hold position', () => {
  const b = hero('inventor'), inv = b.makeAlly(U.inventor, 300); b.allies.push(inv);
  for (let k = 0; k < 6; k++) { inv.abCd = 0; b.supportTick(inv, b.allies, 0.01, true); }
  const t = b.allies.filter(x => x.s.id === 'turret');
  assert.equal(t.length, 3); assert.ok(t.every(x => x.summoned && x.ab.hold));
});
test('Overdrive hastes nearby allies and clears stuns', () => {
  const b = heroBattle('inventor'); b.heroCooldowns.inventor = 0;
  const s2 = b.makeAlly(U.spear, 620); s2.stunT = 2; b.allies.push(s2);
  assert.equal(b.useHeroActive('inventor'), true);
  assert.ok(s2.hasteT > 0 && s2.hasteMul < 1); assert.equal(s2.stunT, 0);
});
test('Clockwork soldier explodes when destroyed', () => {
  const b = hero('clocksoldier'), c = b.makeAlly(U.clocksoldier, 500); b.allies.push(c);
  const e = new Fighter({ ...E.goblin, hp: 5000 }, 'enemy', 540); b.enemies.push(e);
  c.dead = true; const hp = e.hp; b.reap(b.allies, b.enemies, b.enemyCastle, false);
  assert.ok(e.hp < hp);
});
test('A squad brings at most five legends and mythics', () => {
  const s = save(); ['hades','odin','ra','gumiho','inventor','zeus','thor'].forEach(id => { s.owned[id] = 1; });
  s.loadout = ['hades','odin','ra','gumiho','inventor','zeus','thor','spear'];
  const b = new Battle(0, s); const ids = b.roster.map(u => u.id);
  assert.equal(ids.filter(id => U[id].rarity === 'UR' || U[id].rarity === 'SSR').length, 5);
  assert.ok(ids.includes('spear')); assert.ok(!ids.includes('zeus'));
});
test('Five seasons, every summon points at a real unit', () => {
  const { SEASONS } = vm.runInContext('({SEASONS})', ctx);
  assert.equal(SEASONS.length, 5);
  for (const sn of SEASONS) for (const id of sn.units) { assert.ok(U[id], id); assert.equal(U[id].season, sn.id); }
  for (const u of UNITS) if (u.ab && u.ab.summon) assert.ok(U[u.ab.summon.id], u.id);
});

console.log(count + ' regression checks passed');
