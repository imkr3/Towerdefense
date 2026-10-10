#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = vm.createContext({ console, Math, JSON, saveGame() {} });
for (const file of ['data', 'game']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + file + '.js'), 'utf8'), ctx);
const { Battle, Fighter, UNITS, UNIT_BY_ID: U, ENEMIES: E, makeEndlessStage, STAGES, FIELD_CAP, FIELD_TOTAL_CAP } = vm.runInContext('({Battle, Fighter, UNITS, UNIT_BY_ID, ENEMIES, makeEndlessStage, STAGES, FIELD_CAP, FIELD_TOTAL_CAP})', ctx);
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
test('3.14: stats are cached per battle, a cast names itself, auto holds actives before a closed core',()=>{
  const b=heroBattle('thor');assert.equal(b.stats('thor'),b.stats('thor'),'same object, no rebuild each frame');
  b.heroCooldowns.thor=0;b.spawnEnemy('ogre',700);assert.equal(b.autoActiveOk('thor'),true);
  const boss=b.spawnEnemy('ogre',720);boss.boss=true;boss.ab=Object.assign({},boss.ab,{core:true});boss.exposedT=0;
  assert.equal(b.autoActiveOk('thor'),false,'core shut: save it');boss.exposedT=3;assert.equal(b.autoActiveOk('thor'),true);
  assert.equal(b.useHeroActive('thor'),true);const call=b.fx.find(e=>e.type==='herocall');assert.ok(call&&call.name&&call.stack===0);
});
test('3.15 battle report: damage dealt/taken per unit, summons and poison count for their owner, heals too',()=>{
  const s=save();s.loadout=['spear','venom','priest'];const b=new Battle(0,s,{baseHp:1e6,money:1e6,rate:0,waves:[],reward:0});
  b.deploy('spear');const sp=b.allies[0];sp.x=600;const e=b.spawnEnemy('ogre',640);
  b.hitOne(100,e,sp,false);assert.ok(b.meter.spear.dmg>0&&b.meter.spear.n===1);
  b.hitOne(50,sp,e,false);assert.ok(b.meter.spear.taken>0,'damage taken by the spear');
  const sk=b.makeAlly(U.skeleton,610,sp);b.hitOne(80,e,sk,false);assert.ok(!b.meter.skeleton,'summon credits its owner');
  b.money=1e6;b.deploy('venom');const v=b.allies.find(a=>a.s.id==='venom');const d0=b.meter.venom.dmg;
  b.hitOne(10,e,v,false);const after=b.meter.venom.dmg;for(let i=0;i<30;i++)b.tick(1/30);assert.ok(b.meter.venom.dmg>after&&after>d0,'poison ticks count for the venom archer');
  b.money=1e6;b.deploy('priest');const pr=b.allies.find(a=>a.s.id==='priest');pr.x=600;sp.hp=sp.maxHp*0.3;pr.abCd=0;b.supportTick(pr,b.allies,0.01,true);
  assert.ok((b.meter.priest.heal||0)>0,'healing is recorded');
});
test('Own cooldown and stun block skill spam',()=>{
  const b=heroBattle('odin');b.heroCooldowns.odin=0;b.allies[0].stunT=1;assert.equal(b.canHeroActive('odin'),false);
});
test('Several heroes can fire their actives back to back (no shared cooldown)',()=>{
  const s=save();s.owned.odin=true;s.owned.anubis=true;s.loadout=['odin','anubis'];
  const b=new Battle(0,s,{baseHp:10000,money:5000,rate:0,waves:[],reward:0});b.money=5000;b.deploy('odin');b.money=5000;b.deploy('anubis');b.spawnEnemy('ogre',700);
  b.heroCooldowns.odin=0;b.heroCooldowns.anubis=0;
  assert.equal(b.useHeroActive('odin'),true);assert.equal(b.canHeroActive('anubis'),true);assert.equal(b.useHeroActive('anubis'),true);
  assert.equal(b.canHeroActive('odin'),false,'each still waits for its own cooldown');
});
test('Forty stages retain the existing endless unlock threshold',()=>{
  const {STAGES,ENDLESS_UNLOCK_STAGE}=vm.runInContext('({STAGES,ENDLESS_UNLOCK_STAGE})',ctx);
  assert.equal(STAGES.length,50);assert.equal(ENDLESS_UNLOCK_STAGE,20);
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
  for (const st of STAGES) { assert.ok(st.len >= 800 && st.len < 1700, st.name + ' len ' + st.len); }
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
  a = pricey.hp; hunt.hitOne(10, pricey, orc, false); const hurt = a - pricey.hp;
  const calm = mk([]), thor = calm.makeAlly(U.thor, 500); a = thor.hp; calm.hitOne(10, thor, calm.spawnEnemy('goblin', 520), false);
  assert.equal(hurt, 40, 'hero hunters hit heroes 4x and pierce their armor (3.9): ' + hurt);
  assert.ok(a - thor.hp < 10, 'outside hunter stages the hero armor still works');
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
test('Seven seasons, every summon points at a real unit', () => {
  const { SEASONS } = vm.runInContext('({SEASONS})', ctx);
  assert.equal(SEASONS.length, 7);
  for (const sn of SEASONS) for (const id of sn.units) { assert.ok(U[id], id); assert.equal(U[id].season, sn.id); }
  for (const u of UNITS) if (u.ab && u.ab.summon) assert.ok(U[u.ab.summon.id], u.id);
});

/* ---------------- 보스는 전장마다 하나 ---------------- */
test('Every campaign stage has at most one boss, boss stages exactly one', () => {
  STAGES.forEach((st, i) => {
    const bosses = st.waves.filter(w => E[w.e].boss);
    const count = bosses.reduce((n, w) => n + w.n, 0);
    assert.ok(count <= 1, 'S' + (i + 1) + ' has ' + count + ' bosses');
    if (st.bossId) { assert.equal(count, 1, 'S' + (i + 1)); assert.equal(bosses[0].e, st.bossId); }
  });
});
test('Escorts complement the boss: bruisers bring ranged, casters bring a melee wall', () => {
  const { BOSS_ESCORT } = vm.runInContext('({BOSS_ESCORT})', ctx);
  const ranged = id => E[id].ranged || E[id].range >= 200;
  assert.ok(BOSS_ESCORT.bruiser.back.every(ranged) && BOSS_ESCORT.bruiser.nb > BOSS_ESCORT.bruiser.nf);
  assert.ok(BOSS_ESCORT.caster.front.every(id => !ranged(id)) && BOSS_ESCORT.caster.nf > BOSS_ESCORT.caster.nb);
  const st = STAGES[19], t = st.waves.find(w => w.e === st.bossId).t;
  const near = st.waves.filter(w => w.t > t && w.t <= t + 3 && !E[w.e].boss).map(w => w.e);
  assert.ok(near.some(ranged), 'warlord arrives with ranged escort: ' + near);
});
test('The single campaign boss is much stronger; endless bosses are not', () => {
  const { BOSS_HP_MUL, BOSS_MUL_EXP } = vm.runInContext('({BOSS_HP_MUL, BOSS_MUL_EXP})', ctx);
  const b = new Battle(9, save()); const t = b.spawnEnemy('troll', 900);
  // 3.0: 보스는 반드시 쓰러뜨려야 하므로 전장 배율은 누그러뜨려(지수) 받는다
  assert.equal(t.maxHp, Math.round(Math.round(E.troll.hp * Math.pow(STAGES[9].enemyMul, BOSS_MUL_EXP)) * BOSS_HP_MUL));
  assert.ok(t.maxHp > E.troll.hp * 2);
  const en = new Battle(0, save(), makeEndlessStage()); const t2 = en.spawnEnemy('troll', 900);
  assert.equal(t2.maxHp, E.troll.hp);
});
test('Reinforcements never bring a boss back', () => {
  const b = new Battle(29, save());
  assert.ok(!b.reinfPool.concat(b.reinfHeavy).some(id => E[id].boss));
  b.qi = b.queue.length;
  for (let k = 0; k < 40; k++) { b.reinfT = 0; b.tickReinforce(0.01); b.enemies.length = Math.min(b.enemies.length, 4); }
  assert.ok(!b.enemies.some(e => e.boss));
});

/* ---------------- 2.5 새 잡몹 ---------------- */
test('Burrowers travel untargetable, then surface under the front line and stun', () => {
  const b = battle(); const a = b.makeAlly(U.spear, 400); b.allies.push(a);
  const g = b.spawnEnemy('burrower', 700);
  assert.equal(b.enemies.includes(g), false); assert.equal(b.burrowers.length, 1);
  assert.equal(b.findTarget(a, b.enemies, b.enemyCastle) === g, false);
  assert.equal(b.foesLeft(), 1);
  for (let k = 0; k < 200 && g.burrowed; k++) b.stepBurrowers(0.05);
  assert.equal(g.burrowed, false); assert.ok(b.enemies.includes(g)); assert.ok(a.stunT > 0);
});
test('Assassins leap once over the front line onto a ranged unit', () => {
  const b = battle(); const front = b.makeAlly(U.shield, 500), archer = b.makeAlly(U.archer, 360);
  b.allies.push(front, archer);
  const x = b.spawnEnemy('assassin', 640);
  b.tryLeap(x, b.allies);
  assert.equal(x.leapt, true); assert.ok(Math.abs(x.x - (archer.x + 30)) < 1e-9);
  const y = b.spawnEnemy('assassin', 900); b.tryLeap(y, b.allies);
  assert.ok(!y.leapt && y.x === 900, 'too far to trigger');
});
test('Drummers rally nearby foes, hexers weaken allies, bones get back up', () => {
  const b = battle(); const d = b.spawnEnemy('drummer', 700), o = b.spawnEnemy('orcspear', 740);
  d.abCd = 0; b.supportTick(d, b.enemies, 0.01, false); assert.ok(o.rallyMul > 1);
  const a = b.makeAlly(U.knight, 500), h = b.spawnEnemy('hexer', 700);
  b.hitOne(1, a, h, false); assert.ok(a.weakT > 0 && a.weakMul < 1);
  const bone = b.spawnEnemy('boneguard', 700); bone.takeDamage(bone.hp + 10);
  assert.equal(bone.dead, false); assert.ok(bone.hp > 0);
});
test('Every new mob appears in the campaign, in the endless pool and in the bestiary text', () => {
  const ids = ['slinger', 'drummer', 'hexer', 'skelarcher', 'boneguard', 'assassin', 'burrower', 'chariot'];
  const { ENDLESS_POOL } = vm.runInContext('({ENDLESS_POOL})', ctx);
  for (const id of ids) {
    assert.ok(STAGES.some(st => st.waves.some(w => w.e === id)), id + ' in campaign');
    assert.ok(ENDLESS_POOL.some(p => p.id === id), id + ' in endless');
    assert.ok(E[id].abText, id + ' has ability text');
  }
});

/* ---------------- 2.6 개전 방식 ---------------- */
test('Stages open three ways: rush, calm (first foe at 12s+) and sally', () => {
  const kinds = new Set(STAGES.map(st => st.opening));
  assert.deepEqual([...kinds].sort(), ['calm', 'rush', 'sally']);
  assert.equal(STAGES[0].opening, 'rush'); assert.equal(STAGES[1].opening, 'rush');
  for (const st of STAGES.filter(s => s.opening === 'calm')) assert.ok(Math.min(...st.waves.map(w => w.t)) >= 12);
  for (const st of STAGES.filter(s => s.opening === 'sally')) assert.equal(st.sally.length, 2);
});
test('A sally fires once per threshold, shoves nearby allies back and releases the garrison', () => {
  const st = STAGES.find(s => s.opening === 'sally');
  const b = new Battle(0, save(), { baseHp: 10000, money: 900, rate: 0, waves: [], reward: 0, sally: st.sally });
  const c = b.enemyCastle; const a = b.makeAlly(U.spear, c.x - 100), far = b.makeAlly(U.spear, 200);
  b.allies.push(a, far); const x0 = a.x;
  b.checkSally(); assert.equal(b.enemies.length, 0, 'nothing at full hp');
  c.hp = c.maxHp * 0.7; b.checkSally();
  const n1 = st.sally[0].group.reduce((s, g) => s + g[1], 0);
  assert.equal(b.enemies.length + b.burrowers.length, n1);
  assert.ok(a.x < x0 && a.stunT > 0); assert.equal(far.x, 200);
  b.checkSally(); assert.equal(b.enemies.length + b.burrowers.length, n1, 'does not refire');
  c.hp = c.maxHp * 0.3; b.checkSally(); assert.equal(b.sallyDone, 2);
});

/* ---------------- 2.7 비용 등급 · 레벨 성장 · 진화 ---------------- */
const G = vm.runInContext('({resolveUnit, unitFor, EVOLUTIONS, EVO_LEVEL, costTierMul, unitRoleStats, evoCost})', ctx);
test('Every card unit has its own cooldown, and pricier units wait longer', () => {
  const cards = UNITS.filter(u => u.cost > 0);
  assert.equal(new Set(cards.map(u => u.cooldown)).size, cards.length, 'cooldowns are unique');
  const cheap = cards.filter(u => u.cost < 200), dear = cards.filter(u => u.cost >= 450);
  assert.ok(Math.max(...cheap.map(u => u.cooldown)) < Math.min(...dear.map(u => u.cooldown)));
  assert.ok(G.costTierMul(560) > G.costTierMul(300) && G.costTierMul(150) === 1);
});
test('Level-ups improve what a unit does, not just HP/ATK', () => {
  const p1 = G.resolveUnit(U.priest, 1), p9 = G.resolveUnit(U.priest, 9);
  assert.ok(p9.ab.radius > p1.ab.radius && p9.ab.interval < p1.ab.interval, 'healer: wider and more often');
  assert.ok(G.resolveUnit(U.herald, 9).ab.haste.mul < U.herald.ab.haste.mul, 'herald: stronger haste');
  assert.ok(G.resolveUnit(U.merchant, 9).ab.gold > U.merchant.ab.gold, 'merchant: more funds');
  assert.ok(G.resolveUnit(U.longbow, 9).range > U.longbow.range, 'ranged: longer reach');
  assert.equal(U.priest.ab.radius, 230, 'base data is never mutated');
  assert.ok(G.unitRoleStats(p9, 1).length >= 3, 'role stats are shown');
});
test('Every card unit has a Lv10 evolution that adds something and costs something', () => {
  for (const u of UNITS.filter(u => u.cost > 0)) {
    const e = G.EVOLUTIONS[u.id];
    assert.ok(e && e.name && e.plus && e.cost && Object.keys(e.cost).length, u.id);
    assert.ok(G.evoCost(u) > 1000, u.id + ' evolution has a price');
    const r = G.resolveUnit(u, G.EVO_LEVEL, true);
    assert.equal(r.evo, true, u.id); assert.equal(r.name, e.name);
    assert.ok(r.evoMinus && r.abText.indexOf(e.plus) >= 0, u.id + ' shows plus and trade-off');
  }
  assert.equal(G.resolveUnit(U.spear, G.EVO_LEVEL - 1, true).evo, undefined, 'no evolution below Lv10');
  const sp = G.resolveUnit(U.spear, 10, true);
  assert.equal(sp.range, G.resolveUnit(U.spear, 10, false).range + 20); assert.ok(sp.ab.push > 0);
  assert.ok(sp.interval > U.spear.interval, 'trade-off applied');
});
test('Battles deploy the chosen form, and the base form can be switched back', () => {
  const s = save(); s.levels = { spear: 10 }; s.loadout = ['spear'];
  s.evo = { spear: true };
  let b = new Battle(0, s, {baseHp:10000,money:900,rate:0,waves:[],reward:0});
  assert.equal(b.roster[0].evo, true); b.deploy('spear'); assert.equal(b.allies[0].s.evo, true);
  s.evo = { spear: false };
  b = new Battle(0, s, {baseHp:10000,money:900,rate:0,waves:[],reward:0});
  b.deploy('spear'); assert.ok(!b.allies[0].s.evo); assert.equal(b.allies[0].s.name, U.spear.name);
});
test('Summons grow with the summoner at half rate', () => {
  const s = save(); s.levels = { necro: 11 }; s.loadout = ['necro'];
  const b = new Battle(0, s, {baseHp:10000,money:900,rate:0,waves:[],reward:0});
  b.deploy('necro'); const n = b.allies[0]; n.abCd = 0; b.supportTick(n, b.allies, 0.01, true);
  const sk = b.allies.find(a => a.summoned);
  assert.ok(sk && sk.maxHp > U.skeleton.hp && sk.maxHp < U.skeleton.hp * 2);
});

/* ---------------- 3.0 보스의 결계 · 겹쳐 세우기 · 기절 면역 ---------------- */
const H = vm.runInContext('({HARDCORE, hardcoreMods, hardcoreEnemyMul, hardcoreFortHp, hardCount, stackCap})', ctx);
function bossStage(extra) { return Object.assign({ baseHp: 10000, money: 900, rate: 0, reward: 100, bossId: 'troll',
  waves: [{ t: 999, e: 'troll', n: 1, gap: 1 }] }, extra || {}); }
test('The fort cannot fall while the boss lives, and falls once it is slain', () => {
  const b = new Battle(0, save(), bossStage()); b.update(1 / 30);
  b.enemyCastle.takeDamage(1e9); assert.equal(b.enemyCastle.dead, false);
  assert.ok(Math.abs(b.enemyCastle.hp - b.enemyCastle.maxHp * 0.05) < 1e-6, 'held at the ward floor');
  b.update(1 / 30); assert.ok(b.wardUp());
  const boss = b.enemies.find(e => e.boss); assert.ok(boss, 'reaching the ward calls the boss out early');
  boss.hp = 0; boss.dead = true; b.update(1 / 30); assert.equal(b.bossDown, true);
  b.enemyCastle.takeDamage(1e9); b.update(1 / 30); assert.equal(b.state, 'win');
});
test('Stages without a boss keep the old fort rules', () => {
  const b = battle(); b.enemyCastle.takeDamage(1e9); b.update(1 / 30); assert.equal(b.state, 'win');
});
test('A stunned foe gets a short immunity, bosses stun for half as long', () => {
  const b = battle(); const e = b.spawnEnemy('goblin', 900);
  assert.equal(e.stun(1), true); assert.equal(e.stun(1), false, 'no chain stun');
  e.stunT = 0; e.stunImm = 0; const boss = b.spawnEnemy('troll', 900);
  boss.stun(1); assert.ok(Math.abs(boss.stunT - 0.5 * 0.75) < 1e-9, 'half, then the player stun cut');
  const m = b.makeAlly(U.monk, 500); assert.equal(m.stun(2), false, 'the monk is unshakable');
});
test('Card units stack up to a cost-based cap, except cheap basics which only the shared field cap limits', () => {
  for (const u of UNITS.filter(u => u.cost > 0)) {
    if (u.noStackCap) assert.ok(!u.maxActive && u.cost < 160, u.id + ' unlimited');
    else assert.ok(u.maxActive >= 1 && u.maxActive <= 9, u.id);
  }
  for (const id of ['spear', 'shield', 'archer', 'javelin', 'hoplite']) assert.ok(U[id].noStackCap, id + ' has no own cap');
  for (const id of ['merchant', 'bomber', 'priest', 'zeus']) assert.ok(U[id].maxActive >= 1, id + ' keeps its cap');
  assert.ok(U.medusa.maxActive > U.mage.maxActive);
  // 제한 없는 창병만 내도 공통 상한에서 멈춘다
  const sp = save(); sp.loadout = ['spear'];
  const bs = new Battle(0, sp, { baseHp: 1e6, money: 1e6, rate: 0, waves: [], reward: 0 });
  for (let i = 0; i < 60; i++) { bs.cooldowns.spear = 0; bs.money = 1e6; bs.deploy('spear'); }
  assert.equal(bs.allies.length, FIELD_CAP);
  // 자동 출진은 예전 상한(stackCap)까지만 — 싼 병종만 끝없이 사서 돈이 마르지 않게
  const sa = save(); sa.loadout = ['spear'];
  const ba = new Battle(0, sa, { baseHp: 1e6, money: 1e6, rate: 0, waves: [], reward: 0 });
  let auto = 0; for (let i = 0; i < 40; i++) { ba.cooldowns.spear = 0; ba.money = 1e6; if (ba.autoWants('spear')) { ba.deploy('spear'); auto++; } }
  assert.equal(auto, 12, 'auto stops spear at its old cap'); ba.cooldowns.spear = 0; assert.ok(ba.canDeploy('spear'), 'a tap still deploys past it');
  const s = save(); s.owned.medusa = 1; s.loadout = ['medusa'];
  const b = new Battle(0, s, { baseHp: 10000, money: 99999, rate: 0, waves: [], reward: 0 });
  let n = 0; for (let i = 0; i < 10; i++) { b.cooldowns.medusa = 0; b.money = 900; if (b.deploy('medusa')) n++; }
  assert.equal(n, U.medusa.maxActive);
});
test('Enemy healers mend bosses at reduced strength', () => {
  const b = battle(); const sh = b.spawnEnemy('shaman', 900), boss = b.spawnEnemy('troll', 920), orc = b.spawnEnemy('orcspear', 910);
  boss.hp = 1; orc.hp = 1; sh.abCd = 0; b.supportTick(sh, b.enemies, 0.01, false);
  assert.ok(boss.hp - 1 < orc.hp - 1, 'boss heals less');
});

/* ---------------- 3.0 특이한 적 ---------------- */
test('Splitting ooze bursts into two little oozes', () => {
  const b = battle(); const o = b.spawnEnemy('ooze', 900); o.hp = 0; o.dead = true;
  b.update(1 / 30); assert.equal(b.enemies.filter(e => e.kind === 'oozelet').length, 2);
});
test('Mirror witch halves ranged damage and bounces some back', () => {
  const b = battle(); const w = b.spawnEnemy('mirror', 900), a = b.makeAlly(U.archer, 600);
  const hp0 = w.hp, ahp = a.hp; b.hitOne(100, w, a, false);
  assert.equal(hp0 - w.hp, 50); assert.ok(a.hp < ahp, 'shooter takes the reflection');
  const k = b.makeAlly(U.knight, 880); const hp1 = w.hp; b.hitOne(100, w, k, false); assert.equal(hp1 - w.hp, 100, 'melee is not mirrored');
});
test('Coin thief steals funds, and slaying him returns them', () => {
  const b = battle(); b.money = 100; const th = b.spawnEnemy('thief', 700), a = b.makeAlly(U.spear, 690);
  b.hitOne(1, a, th, false); assert.equal(b.money, 100 - E.thief.ab.thief.steal);
  th.hp = 0; th.dead = true; b.update(1 / 30); assert.ok(b.money >= 100);
});
test('Wall breaker walks past soldiers and blows up at the castle', () => {
  const b = battle(); const sp = b.spawnEnemy('sapper', 400), a = b.makeAlly(U.shield, 380); b.allies.push(a);
  assert.equal(b.findTarget(sp, b.allies, b.allyCastle), null, 'ignores soldiers');
  sp.x = b.allyCastle.x + 60; const hp = b.allyCastle.hp;
  const t = b.findTarget(sp, b.allies, b.allyCastle); assert.equal(t, b.allyCastle);
  b.attack(sp, t, b.allies, b.allyCastle); assert.ok(b.allyCastle.hp < hp && sp.dead && sp.exploded);
  const k = b.kills; b.update(1 / 30); assert.equal(b.kills, k, 'no bounty for a blast');
});
test('Chain jailer hooks the farthest ranged ally and stuns them', () => {
  const b = battle(); const j = b.spawnEnemy('jailer', 900), near = b.makeAlly(U.spear, 800), far = b.makeAlly(U.archer, 560);
  b.allies.push(near, far); j.hookCd = 0; b.tryHook(j, b.allies, 0.01);
  assert.ok(Math.abs(far.x - (j.x - 40)) < 1e-6 && far.stunT > 0); assert.equal(near.x, 800);
});
test('Chronomancer slows card cooldowns while alive', () => {
  const b = battle(); b.deploy('spear'); const cd = b.cooldowns.spear; b.spawnEnemy('chrono', 1700);
  b.update(1 / 30); assert.equal(b.chronoOn, true); assert.ok(cd - b.cooldowns.spear < 1 / 30 * 0.7);
});
test('Soul eater grows when allies fall nearby, not from summons', () => {
  const b = battle(); const se = b.spawnEnemy('souleater', 900); const a = b.makeAlly(U.spear, 880), sk = b.makeAlly(U.skeleton, 880);
  sk.summoned = true; b.allies.push(a, sk); a.dead = sk.dead = true; const atk = se.atk; b.update(1 / 30);
  assert.equal(se.souls, 1); assert.ok(se.atk > atk);
});

/* ---------------- 3.0 새 병종 ---------------- */
test('New units: charge, dodge, feast, hunter, ward, pacify and fading clones', () => {
  const b = battle(); const l = b.makeAlly(U.lancer, 500), g = b.spawnEnemy('orcspear', 560);
  l.chargeDist = 999; const hp = g.hp; b.attack(l, g, b.enemies, b.enemyCastle);
  assert.ok(hp - g.hp > l.atk * 2, 'charged hit'); assert.equal(l.chargeDist, 0);
  const m = b.makeAlly(U.monkey, 500), undo = rnd(0); b.hitOne(100, m, g, false); undo(); assert.equal(m.hp, m.maxHp, 'dodged');
  const pig = b.makeAlly(U.bajie, 500), gob = b.spawnEnemy('goblin', 560); pig.hp = 100; b.hitOne(9999, gob, pig, false);
  assert.ok(pig.hp > 100, 'feast heals on kill');
  const fal = b.makeAlly(U.falconer, 500), bal = b.spawnEnemy('ballista', 800), bhp = bal.hp; b.hitOne(100, bal, fal, false);
  assert.equal(bhp - bal.hp, 100 * U.falconer.ab.hunter);
  const bell = b.makeAlly(U.bellringer, 500), mate = b.makeAlly(U.spear, 520); mate.stunT = 3; bell.abCd = 0;
  b.supportTick(bell, [bell, mate], 0.01, true); assert.equal(mate.stunT, 0); assert.equal(mate.stun(1), false, 'ward protects');
  const s = save(); s.owned.sanzang = 1; const b2 = new Battle(0, s, { baseHp: 10000, money: 900, rate: 0, waves: [], reward: 0 });
  const sz = b2.makeAlly(U.sanzang, 500), foe = b2.spawnEnemy('orcspear', 600); sz.abCd = 0; b2.supportTick(sz, [sz], 0.01, true);
  assert.equal(foe.weakMul, U.sanzang.ab.pacify.mul);
  const s3 = save(); s3.owned.wukong = 1; s3.loadout = ['wukong'];
  const b3 = new Battle(0, s3, { baseHp: 10000, money: 9999, rate: 0, waves: [], reward: 0 }); b3.deploy('wukong');
  const wk = b3.allies[0]; wk.abCd = 0; b3.supportTick(wk, b3.allies, 0.01, true);
  const clones = b3.allies.filter(a => a.summoned); assert.equal(clones.length, 2);
  b3.step(b3.allies, [], b3.enemyCastle, U.wukong.ab.summon.life + 0.1, true); assert.ok(clones.every(c => c.dead && c.vanish));
});
test('Every new unit and enemy has a drawing, an evolution and English text', () => {
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
  for (const id of ['javelin', 'falconer', 'bellringer', 'lancer', 'alchemist', 'monk', 'wukong', 'nezha', 'sanzang', 'bajie', 'wujing', 'monkey', 'celestial']) {
    assert.ok(render.indexOf("case '" + U[id].shape + "'") >= 0, id); assert.ok(G.EVOLUTIONS[id], id);
    assert.ok(i18n.indexOf("'" + U[id].name + "'") >= 0, id + ' name translated');
  }
  for (const id of ['ooze', 'oozelet', 'mirror', 'jailer', 'thief', 'chrono', 'souleater', 'sapper']) {
    assert.ok(render.indexOf("case '" + E[id].shape + "'") >= 0, id); assert.ok(i18n.indexOf("'" + E[id].name + "'") >= 0, id);
  }
});

/* ---------------- 3.0 하드코어 ---------------- */
test('Hardcore: tougher foes and fort, weaker castle, an extra trait', () => {
  const s = save(), st = STAGES[2];
  const n = new Battle(2, s), h = new Battle(2, s, null, { hard: true });
  assert.equal(h.hard, true); assert.equal(h.enemyCastle.maxHp, H.hardcoreFortHp(st));
  assert.ok(h.enemyCastle.maxHp > n.enemyCastle.maxHp && h.allyCastle.maxHp < n.allyCastle.maxHp && h.cmdMax > n.cmdMax);
  assert.ok(h.spawnEnemy('goblin', 900).maxHp >= E.goblin.hp * H.HARDCORE.mulFloor - 1);
  assert.equal(Object.keys(h.mods).length, (st.mods || []).length + 1);
  assert.equal(new Battle(0, s, makeEndlessStage(3), { hard: true }).hard, false, 'endless is never hardcore');
  for (let i = 0; i < STAGES.length; i++) assert.ok(H.hardcoreMods(STAGES[i], i).length >= (STAGES[i].mods || []).length);
});
test('Hardcore wins record a crown, pay double and stones once', () => {
  const s = save(); s.stones = 0; const b = new Battle(2, s, null, { hard: true });
  b.finish('win'); assert.equal(s.hard[2], true); assert.equal(b.stoneGain, H.HARDCORE.stones);
  assert.ok(b.coins >= STAGES[2].reward * 2); assert.equal(s.cleared, 20, 'progress is untouched');
  const b2 = new Battle(2, s, null, { hard: true }); b2.finish('win'); assert.equal(b2.stoneGain, 0);
  assert.equal(H.hardCount(s), 1);
});

test('Some foes shrug off stuns: heavy ones are immune, elites resist', () => {
  const b = battle(); const g = b.spawnEnemy('siegeram', 900), o = b.spawnEnemy('orcshield', 900), gob = b.spawnEnemy('goblin', 900);
  assert.equal(g.stun(2), false); assert.equal(g.stunT, 0);
  assert.equal(o.stun(2), true); assert.ok(Math.abs(o.stunT - 2 * 0.7 * 0.75) < 1e-9);
  assert.equal(gob.stun(2), true); assert.ok(Math.abs(gob.stunT - 2 * 0.75) < 1e-9);
  const m = b.makeAlly(U.medusa, 860), undo = rnd(0); b.hitOne(1, g, m, false); undo();
  assert.ok(b.fx.some(f => f.type === 'miss' && f.text === '기절 면역'), 'shows the shrug-off');
  const h = new Battle(2, save(), null, { hard: true }), hg = h.spawnEnemy('goblin', 900);
  hg.stun(2); assert.ok(Math.abs(hg.stunT - 2 * 0.7 * 0.75) < 1e-9, 'hardcore foes resist 30%');
  assert.ok(/기절 면역/.test(E.siegeram.abText) && /기절 저항/.test(E.orcshield.abText));
});

test('Enemy healing does not stack, and reinforcements stop sending healers past two', () => {
  const b = battle(); const s1 = b.spawnEnemy('shaman', 900), s2 = b.spawnEnemy('shaman', 905), orc = b.spawnEnemy('orcshield', 910);
  orc.hp = 1; s1.abCd = 0; s2.abCd = 0; b.supportTick(s1, b.enemies, 0.01, false); const once = orc.hp;
  b.supportTick(s2, b.enemies, 0.01, false); assert.equal(orc.hp, once, 'second healer in the same moment is ignored');
  assert.equal(E.mirror.noReinf, true);
  const r = new Battle(0, save(), { baseHp: 99999, money: 0, rate: 0, reward: 0, waves: [{ t: 0, e: 'shaman', n: 1, gap: 1 }] });
  r.update(1 / 30); r.spawnEnemy('shaman', 900); r.reinfPool = ['shaman']; r.reinfT = 0; r.reinfOn = true;
  const before = r.enemies.length; r.tickReinforce(0.01); assert.equal(r.enemies.length, before);
});

test('Ranged units without a melee front line lose most of their punch', () => {
  const b = battle(); const ar = b.makeAlly(U.archer, 500); b.allies.push(ar);
  const e1 = b.spawnEnemy('orcshield', 520), undo = rnd(0.99);
  b.updateCover(0.1); assert.equal(ar.exposed, false, 'a short grace while the next melee walks up');
  b.updateCover(10); assert.equal(ar.exposed, true);
  let hp = e1.hp; b.attack(ar, e1, b.enemies, b.enemyCastle); b.updateShots(5); const bare = hp - e1.hp;
  const sp = b.makeAlly(U.spear, 510); b.allies.push(sp); b.updateCover(); assert.equal(ar.exposed, false);
  ar.cd = 0; hp = e1.hp; b.attack(ar, e1, b.enemies, b.enemyCastle); b.updateShots(5); const covered = hp - e1.hp; undo();
  assert.ok(bare < covered * 0.5, 'exposed ' + bare + ' vs covered ' + covered);
  const sk = b.makeAlly(U.skeleton, 600); sk.summoned = true; b.allies.push(sk); sp.dead = true; b.updateCover(10);
  assert.equal(ar.exposed, true, 'summoned skeletons are not cover');
  assert.equal(sk.exposed, true, 'summons fighting without a living front line are shaky too');
  assert.ok(b.rush > 1, 'enemies rush an open line');
  const bar = b.makeAlly(U.barricade, 600); bar.summoned = true; b.allies.push(bar); b.updateCover(0.1);
  assert.equal(ar.exposed, false, 'barricades are cover');
  assert.equal(b.rush, 1);
});

test('Enemies charge in faster when no melee soldier holds the line', () => {
  const walk = withMelee => {
    const b = battle(); b.allies.push(b.makeAlly(U.archer, 200));
    if (withMelee) b.allies.push(b.makeAlly(U.spear, 250));
    const e = b.spawnEnemy('goblin', 900); b.updateCover(10);
    const x0 = e.x; b.step(b.enemies, b.allies, b.allyCastle, 0.1, false); return x0 - e.x;
  };
  const open = walk(false), held = walk(true);
  assert.ok(held > 0 && open > held * 1.5, 'open ' + open + ' vs held ' + held);
});

/* ---------------- 3.1 어려운 전장 ---------------- */
test('A campaign boss left alive too long enrages once', () => {
  const b = new Battle(0, save(), bossStage()); b.update(1 / 30);
  const boss = b.spawnEnemy('troll', 900); const atk = boss.atk, spd = boss.speedNow, iv = boss.intervalNow;
  b.time = boss.bornT + 49; b.checkEnrage(); assert.equal(!!boss.furious, false);
  b.time = boss.bornT + 51; b.checkEnrage(); assert.equal(boss.furious, true);
  assert.ok(boss.atk > atk * 1.5 && boss.speedNow > spd * 1.2 && boss.intervalNow < iv);
  const once = boss.atk; b.checkEnrage(); assert.equal(boss.atk, once, 'only once');
  const plain = battle(); const t = plain.spawnEnemy('troll', 900); plain.time = 999; plain.checkEnrage();
  assert.equal(!!t.furious, false, 'no enrage outside campaign boss stages');
});
test('Fury: in hardcore and act 2, foes arriving later are tougher', () => {
  const s = save();
  const h = new Battle(2, s, null, { hard: true }); const early = h.spawnEnemy('goblin', 900).maxHp;
  h.time = 120; const late = h.spawnEnemy('goblin', 900).maxHp;
  assert.ok(late > early * 1.5, 'hardcore ' + early + ' → ' + late);
  h.time = 9999; assert.ok(h.spawnEnemy('goblin', 900).maxHp <= early * (1 + H.HARDCORE.fury.max) + 1, 'capped');
  const a2 = new Battle(21, s); const e2 = a2.spawnEnemy('goblin', 900).maxHp; a2.time = 300;
  assert.ok(a2.spawnEnemy('goblin', 900).maxHp > e2 * 1.3, 'act 2 fury');
  const a1 = new Battle(5, s); const e1 = a1.spawnEnemy('goblin', 900).maxHp; a1.time = 200;
  assert.equal(a1.spawnEnemy('goblin', 900).maxHp, e1, 'act 1 has no fury');
});

/* ---------------- 3.2 이벤트 전장 ---------------- */
const EV = vm.runInContext('({EVENT_STAGES, eventOpen, eventCount})', ctx);
function evBattle(k, s) { return new Battle(STAGES.length + k, s || save(), EV.EVENT_STAGES[k]); }
test('Five event stages, each with its own new boss, locked behind campaign progress', () => {
  assert.equal(EV.EVENT_STAGES.length, 5);
  const bosses = new Set();
  EV.EVENT_STAGES.forEach((st, k) => {
    assert.ok(E[st.bossId] && E[st.bossId].boss, st.name); bosses.add(st.bossId);
    assert.ok(st.waves.some(w => w.e === st.bossId), 'boss appears');
    st.waves.forEach(w => assert.ok(E[w.e], st.name + ' ' + w.e));
    assert.ok(st.event.deck.length === 10 && st.event.deck.every(id => U[id]), 'recommended deck');
    assert.equal(EV.eventOpen({ cleared: st.event.unlock - 1 }, k), false); assert.equal(EV.eventOpen({ cleared: st.event.unlock }, k), true);
  });
  assert.equal(bosses.size, 5);
});
test('Event battles are not campaign progress: they record stars and pay stones once', () => {
  const s = save(); s.stones = 0; s.cleared = 30; const b = evBattle(0, s);
  assert.ok(b.event && b.bossWard); b.finish('win');
  assert.equal(s.events.eclipse, 3); assert.equal(b.stoneGain, EV.EVENT_STAGES[0].event.stones); assert.equal(s.cleared, 30);
  assert.equal(s.stars[STAGES.length], undefined, 'no campaign stars');
  const b2 = evBattle(0, s); b2.finish('win'); assert.equal(b2.stoneGain, 0); assert.equal(EV.eventCount(s), 1);
});
test('Mistform: the vampire takes nothing, charms troops sent in, and swallows actives', () => {
  const s = save(); s.owned.thor = true; s.loadout = ['thor', 'spear']; s.cleared = 30;
  const b = evBattle(0, s); b.update(1 / 30);
  const v = b.spawnEnemy('vampire', 700); b.bossAct(v, E.vampire.special);
  assert.ok(v.veilT > 0); const hp = v.hp; assert.equal(v.takeDamage(99999), 0); assert.equal(v.hp, hp);
  b.money = 9999; b.cooldowns.spear = 0; b.deploy('spear'); assert.ok(b.allies[b.allies.length - 1].charmT > 0, 'charmed in the mist');
  b.cooldowns.thor = 0; b.deploy('thor'); const thor = b.allies.find(a => a.s.id === 'thor'); thor.x = 650; thor.charmT = 0;
  const mob = b.spawnEnemy('goblin', 690); const mhp = mob.hp; v.hp = v.maxHp * 0.5;
  b.heroCooldowns.thor = 0; b.heroGlobalCd = 0; assert.equal(b.useHeroActive('thor'), true);
  assert.equal(mob.hp, mhp, 'active swallowed'); assert.ok(v.hp > v.maxHp * 0.5, 'mist feeds on it');
  v.veilT = 0; b.money = 9999; b.cooldowns.spear = 0; b.deploy('spear'); assert.equal(b.allies[b.allies.length - 1].charmT, 0);
});
test('Magma core: the titan shrugs off hits until its slam lands, then takes 3.6x', () => {
  const b = evBattle(1); b.update(1 / 30);
  const t = b.spawnEnemy('titan', 900); t.stunImm = 99;
  const arm = 1 - Math.min(0.75, t.ab.armor || 0);          // 중갑 특성도 함께 걸린다
  const h0 = t.hp; t.takeDamage(1000); const guarded = h0 - t.hp;
  assert.ok(Math.abs(guarded - 50 * arm) < 1, 'guarded ' + guarded);
  b.allies.push(b.makeAlly(U.spear, 700));
  b.bossAct(t, E.titan.special); assert.equal(b.pending.length, 1);
  b.updatePending(5); assert.ok(t.exposedT > 5);
  const h1 = t.hp; t.takeDamage(1000); assert.ok(Math.abs(h1 - t.hp - 3600 * arm) < 1);
});
test('Broadside shells the deploy zone, not the front line', () => {
  const b = evBattle(2); b.update(1 / 30);
  const c = b.spawnEnemy('ghostcaptain', 1200); b.bossAct(c, E.ghostcaptain.special);
  const X = vm.runInContext('ALLY_SPAWN_X', ctx);
  assert.equal(b.pending.length, E.ghostcaptain.special.n);
  assert.ok(b.pending.every(p => Math.abs(p.x - X) < 600 && p.t >= 2), 'near the spawn, with a warning');
});
test('Void mirror reflects hits, turns actives on their caster and swallows the Command', () => {
  const s = save(); s.owned.thor = true; s.loadout = ['thor']; s.cleared = 30;
  const b = evBattle(3, s); b.update(1 / 30);
  const v = b.spawnEnemy('voidlord', 700); b.bossAct(v, E.voidlord.special); assert.ok(v.reflectT > 0);
  const sp = b.makeAlly(U.spear, 650); b.allies.push(sp);
  const vh = v.hp, sh = sp.hp; b.hitOne(1000, v, sp, false);
  assert.ok(sp.dead || sh - sp.hp > 500, 'attacker hurt'); assert.ok(vh - v.hp < 200, 'boss barely scratched');
  b.money = 9999; b.cooldowns.thor = 0; b.deploy('thor'); const thor = b.allies.find(a => a.s.id === 'thor'); thor.x = 640;
  b.heroCooldowns.thor = 0; b.heroGlobalCd = 0; const th = thor.hp; const v2 = v.hp;
  assert.equal(b.useHeroActive('thor'), true); assert.ok(thor.hp < th, 'active bounced'); assert.equal(v.hp, v2);
  b.cmdCd = 0; const hurt = b.allies[0]; hurt.hp = 1; assert.equal(b.useCommand(), true); assert.equal(hurt.hp, 1, 'command swallowed');
});
test('The Demon King changes faces: shelling, then a mirror, then an exposed core', () => {
  const b = evBattle(4); b.update(1 / 30);
  const d = b.spawnEnemy('demonking', 1200); d.stunImm = 99;
  assert.equal((d.curSpecial || d.s.special).t, 'barrage');
  d.hp = d.maxHp * 0.7; b.bossTick(d, 0.01); assert.equal(d.curSpecial.t, 'reflect');
  d.hp = d.maxHp * 0.3; b.bossTick(d, 0.01); assert.equal(d.curSpecial.t, 'slam'); assert.ok(d.ab.core);
});
test('Event enemies are drawn and translated', () => {
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
  for (const id of ['bloodthrall', 'stoneward', 'rockling', 'ghostsailor', 'ghostgunner', 'voidspawn', 'riftcaller', 'imp', 'demonknight',
                    'vampire', 'titan', 'ghostcaptain', 'voidlord', 'demonking']) {
    assert.ok(render.indexOf("case '" + E[id].shape + "'") >= 0, id); assert.ok(i18n.indexOf("'" + E[id].name + "'") >= 0, id);
    if (E[id].abText) assert.ok(i18n.indexOf("'" + E[id].abText + "'") >= 0, id + ' abText');
  }
  EV.EVENT_STAGES.forEach(st => { assert.ok(i18n.indexOf("'" + st.name + "'") >= 0, st.name); assert.ok(i18n.indexOf("'" + st.event.mech + "'") >= 0, st.event.mech); });
});
test('Act 1 and plain stages got tougher (3.2)', () => {
  assert.ok(STAGES[5].enemyMul > 1.25, 'mob stage ' + STAGES[5].enemyMul);
  assert.ok(STAGES[1].enemyMul < 1.1, 'first stages stay gentle');
});

/* ---------------- 3.2.1 버그 수정 ---------------- */
test('Support troops wait behind the melee line and never walk into the enemy fort', () => {
  const s = save(); s.loadout = ['priest']; const b = new Battle(0, s, { baseHp: 10000, money: 900, rate: 0, waves: [], reward: 0 });
  const pr = b.makeAlly(U.priest, 300); b.allies.push(pr);
  for (let i = 0; i < 30 * 120; i++) b.update(1 / 30);
  assert.ok(pr.x < b.enemyCastle.x - b.enemyCastle.radius - 150, 'stopped short of the fort ' + Math.round(pr.x));
  const sp = b.makeAlly(U.spear, 500); sp.speedMul = 0; b.allies.push(sp);
  pr.x = 300; for (let i = 0; i < 30 * 30; i++) b.update(1 / 30);
  assert.ok(pr.x <= sp.x - 15, 'behind the spear ' + Math.round(pr.x) + ' vs ' + Math.round(sp.x));
});
test('Turrets are set up near the front and roll forward when left idle', () => {
  const s = save(); s.owned.inventor = true; s.loadout = ['inventor'];
  const b = new Battle(0, s, { baseHp: 10000, money: 900, rate: 0, waves: [], reward: 0 });
  const inv = b.makeAlly(U.inventor, 200); b.allies.push(inv);
  const sp = b.makeAlly(U.spear, 700); sp.speedMul = 0; b.allies.push(sp);
  b.updateCover(0.1); inv.abCd = 0; b.supportTick(inv, b.allies, 0.01, true);
  const t = b.allies.find(a => a.s.id === 'turret'); assert.ok(t && t.x > 300, 'placed toward the front ' + (t && Math.round(t.x)));
  t.x = 250; for (let i = 0; i < 30 * 20; i++) b.update(1 / 30);
  assert.ok(t.x > 500 && t.x <= sp.x - 30, 'rolled up behind the line ' + Math.round(t.x));
});
test('Enemy splash aimed at troops does not chip the castle; shots at the castle still do', () => {
  const b = battle(); b.update(1 / 30);
  const cat = b.spawnEnemy('orccatapult', 500); const near = b.makeAlly(U.spear, 160); b.allies.push(near);
  const hp = b.allyCastle.hp; b.attack(cat, near, b.allies, b.allyCastle); b.updateShots(5);
  assert.equal(b.allyCastle.hp, hp, 'castle untouched');
  near.dead = true; b.attack(cat, b.allyCastle, b.allies, b.allyCastle); b.updateShots(5);
  assert.ok(b.allyCastle.hp < hp, 'direct castle shot lands');
});
test('Deploy-zone shelling never hits the castle itself', () => {
  const b = new Battle(STAGES.length + 2, save(), EV.EVENT_STAGES[2]); b.update(1 / 30);
  const c = b.spawnEnemy('ghostcaptain', 1200); b.bossAct(c, E.ghostcaptain.special);
  const hp = b.allyCastle.hp; b.updatePending(5); assert.equal(b.allyCastle.hp, hp);
});
test('Endless: the fort holds until wave 25, then falling it ends the run as a win', () => {
  const s = save(); s.stats = {}; const b = new Battle(0, s, makeEndlessStage());
  b.update(1 / 30); b.enemyCastle.takeDamage(1e12); b.update(1 / 30);
  assert.equal(b.state, 'play'); assert.ok(b.wardUp(), 'warded early');
  b.currentWave = () => 25; b.update(1 / 30); b.enemyCastle.takeDamage(1e12); b.update(1 / 30);
  assert.equal(b.state, 'win'); assert.equal(b.fortFell, true); assert.ok(b.stoneGain >= 2);
});

test('Overtime: a stalled battle without fury slowly toughens new foes so it always ends', () => {
  const b = battle(); b.update(1 / 30); const e0 = b.spawnEnemy('goblin', 900).maxHp;
  b.time = 239; assert.equal(b.spawnEnemy('goblin', 900).maxHp, e0);
  b.time = 480; assert.ok(b.spawnEnemy('goblin', 900).maxHp > e0 * 1.9);
  const en = new Battle(0, save(), makeEndlessStage()); en.update(1 / 30); const w = en.spawnEnemy('goblin', 900).maxHp;
  en.time = 600; assert.equal(en.spawnEnemy('goblin', 900).maxHp, w, 'endless has its own scaling');
});

/* ---------------- 3.3 3막 '심연의 바다' ---------------- */
test('Act 3: ten sea stages with their own bosses, looks and music', () => {
  const A = STAGES.slice(30, 40);
  assert.equal(A.length, 10);
  assert.equal(A.filter(s => s.bossId).map(s => s.bossId).join(','), 'kraken,tidequeen,leviathan');
  const seen = new Set(STAGES.map(s => s.music)); assert.equal(seen.size, 50, 'every stage has its own track');
  const mus = fs.readFileSync(path.join(__dirname, '../js/music.js'), 'utf8');
  for (const st of A) assert.ok(mus.indexOf('  ' + st.music + ': {') >= 0, st.music);
  for (const t of ['boss_kraken', 'boss_tidequeen', 'finale2']) assert.ok(mus.indexOf('  ' + t + ': {') >= 0, t);
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  for (const look of new Set(A.map(s => s.look))) assert.ok(render.indexOf('  ' + look + ':') >= 0, look);
  assert.equal(STAGES[29].finale, true); assert.equal(STAGES[39].bossMusic, 'finale2');
  assert.ok(A[9].enemyMul > A[0].enemyMul, 'the act ramps up');
});
test('New sea units and foes are drawn, translated and evolve', () => {
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
  for (const id of ['harpoon', 'corsair', 'beacon', 'stormcaller', 'anchorguard']) {
    assert.ok(render.indexOf("case '" + U[id].shape + "'") >= 0, id); assert.ok(G.EVOLUTIONS[id], id);
    assert.ok(i18n.indexOf("'" + U[id].name + "'") >= 0, id + ' name'); assert.ok(U[id].unlockStage > 30 && U[id].unlockStage <= 40);
  }
  for (const id of ['clawcrab', 'nagaspear', 'siren', 'deepone', 'jelly', 'tidecaller', 'seahook', 'eel', 'kraken', 'tidequeen', 'leviathan']) {
    assert.ok(render.indexOf("case '" + E[id].shape + "'") >= 0, id); assert.ok(i18n.indexOf("'" + E[id].name + "'") >= 0, id);
  }
  for (const k of ['tidal', 'harpoon', 'storm']) {
    assert.ok(render.indexOf("case '" + k + "':") >= 0, 'canvas fx ' + k);
    assert.ok(fs.readFileSync(path.join(__dirname, '../js/gl-fx.js'), 'utf8').indexOf("case '" + k + "':") >= 0, 'gl fx ' + k);
  }
});
test('Siren song charms allies; the Lightkeeper lantern breaks it and wards it off', () => {
  const s = save(); s.loadout = ['beacon']; const b = new Battle(0, s, { baseHp: 10000, money: 900, rate: 0, waves: [], reward: 0 });
  const sp = b.makeAlly(U.spear, 500); b.allies.push(sp);
  const sir = b.spawnEnemy('siren', 700); const undo = rnd(0);
  b.hitOne(10, sp, sir, false); assert.ok(sp.charmT > 0, 'charmed');
  const bc = b.makeAlly(U.beacon, 480); b.allies.push(bc); bc.abCd = 0; b.supportTick(bc, b.allies, 0.01, true);
  assert.equal(sp.charmT, 0, 'lantern clears it'); b.hitOne(10, sp, sir, false); assert.equal(sp.charmT, 0, 'and wards it off'); undo();
});
test('Tidecallers push the front back without a boss banner', () => {
  const b = battle(); b.update(1 / 30);
  const tc = b.spawnEnemy('tidecaller', 700); const sp = b.makeAlly(U.spear, 600); b.allies.push(sp);
  b.patternName = ''; b.bossAct(tc, E.tidecaller.special);
  assert.ok(sp.x < 600, 'pushed'); assert.equal(b.patternName, '', 'no big banner for a mob');
});

/* ---------------- 3.4 영웅의 체급 · 극적인 진화 ---------------- */
test('Legends and myths outclass their cost: more hp/atk, melee heroes get armor, knockback immunity and a second wind', () => {
  const thor = G.resolveUnit(U.thor, 1), wukong = G.resolveUnit(U.wukong, 1), odin = G.resolveUnit(U.odin, 1);
  const plain = G.resolveUnit(Object.assign({}, U.thor, { gacha: false, id: 'thor_plain' }), 1);
  assert.ok(thor.hp >= plain.hp * 1.25 * 1.3 - 2 && thor.atk > plain.atk, 'melee hero hp ' + thor.hp + ' vs ' + plain.hp);
  assert.ok(thor.ab.kbImmune && thor.ab.revive >= 0.3 && thor.ab.armor >= 0.1, 'melee hero kit');
  assert.ok(wukong.ab.kbImmune && wukong.ab.revive >= 0.3, 'wukong kit');
  assert.ok(odin.hp > U.odin.hp && odin.atk > U.odin.atk && !(odin.ab && odin.ab.kbImmune), 'ranged hero: stats only');
  const spear = G.resolveUnit(U.spear, 1); assert.equal(spear.hp, U.spear.hp, 'regular units untouched');
});
test('Some evolutions change the whole silhouette, and every new look is drawn', () => {
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  const big = Object.keys(G.EVOLUTIONS).filter(id => G.EVOLUTIONS[id].look);
  assert.ok(big.length >= 8, 'several dramatic evolutions');
  for (const id of big) {
    const r = G.resolveUnit(U[id], 10, true), base = G.resolveUnit(U[id], 10, false);
    assert.notEqual(r.shape, base.shape, id); assert.ok(r.bigEvo, id); assert.ok(r.scale > base.scale, id + ' grows');
    assert.ok(render.indexOf("case '" + r.shape + "'") >= 0, id + ' drawn');
  }
});

/* ---------------- 3.5 최적화 · 병력 상한 ---------------- */
test('Field cap: one shared limit of 40 deployed soldiers, summons stop at 60 in total', () => {
  assert.equal(FIELD_CAP, 40); assert.equal(FIELD_TOTAL_CAP, 60);
  const s = save(); s.loadout = ['spear', 'shield', 'archer', 'knight', 'mage', 'venom', 'longbow', 'priest']; const b = new Battle(0, s, { baseHp: 1e6, money: 1e6, rate: 0, waves: [], reward: 0 });
  for (let i = 0; i < 120; i++) for (const id of s.loadout) { b.cooldowns[id] = 0; b.money = 1e6; b.deploy(id); }
  assert.equal(b.allies.length, FIELD_CAP); assert.ok(b.fieldFull()); b.cooldowns.spear = 0; assert.equal(b.canDeploy('spear'), false);
  for (let i = 0; i < 20; i++) { const m = b.makeAlly(U.skeleton, 300); m.summoned = true; b.allies.push(m); }
  assert.equal(b.roomForSummon(), false, 'no room past 60');
  b.allies[0].dead = true; b.allies.splice(0, 1); b.cooldowns.spear = 0; assert.ok(b.canDeploy('spear'), 'a fallen soldier frees a slot');
});
test('Renderer and HUD stay light: frame cap, HUD diffing, cached background layers', () => {
  const main = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  assert.ok(/FRAME_MIN_MS/.test(main) && /ts - lastTs < /.test(main), 'frame cap');
  const hud = main.slice(main.indexOf('function updateHud()'), main.indexOf('function updateHud()') + 4000);
  assert.ok(!/\$\('#/.test(hud), 'updateHud must not query the DOM every frame');
  assert.ok(!/\.textContent = /.test(hud.replace('el.textContent = v', '')), 'updateHud writes text only through hudText');
  assert.ok(/paintGround\(/.test(render) && /BG_FAR_PAR/.test(render), 'background split into cached far layer + ground');
  const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\{([\s\S]*?)\}\s*\}/g))
    assert.ok(!/box-shadow|\bleft:|\bwidth:/.test(m[2]), 'keyframes ' + m[1] + ' animates a paint/layout property');
});

test('Undying heroes show their second wind once', () => {
  const b = battle(); const th = b.makeAlly(G.resolveUnit(U.thor, 5), 500); b.allies.push(th);
  th.takeDamage(th.maxHp * 5); assert.ok(!th.dead && th.hp > 0 && th.usedRevive, 'revived');
  b.update(1 / 30); assert.equal(b.fx.filter(e => e.type === 'revive').length, 1, 'one revive effect');
  b.update(1 / 30); assert.equal(b.fx.filter(e => e.type === 'revive').length, 1, 'not repeated');
  th.takeDamage(th.maxHp * 5); assert.ok(th.dead, 'only once');
});

/* ---------------- 3.6 편의성 ---------------- */
const Q = vm.runInContext('({deckAdvice, recommendDeck, availableUnits, isFrontUnit, MOD_COUNTERS, upgradeEffect, SHOP_ORDER, UPGRADES, trainDeckPlan, unitTrainCost, STAGE_MODS, HERO_SLOT_MAX, LOADOUT_MAX})', ctx);
test('Deck check flags missing counters, thin front lines and hunted heroes', () => {
  const st = { mods: ['ironclad', 'giantslayer'] };
  const s = { cleared: 25, owned: { thor: 1, zeus: 1, hades: 1 }, levels: {}, loadout: ['archer', 'mage', 'longbow', 'zeus', 'hades', 'thor'] };
  const a = Q.deckAdvice(s, st);
  assert.equal(a.counters.length, 2);
  assert.ok(a.counters[0].ids.includes('thor') && a.counters[0].have.includes('thor'), 'thor counters ironclad and is in the deck');
  const keys = a.warns.map(w => w.key).join('|');
  assert.ok(/근접 전열/.test(keys), 'thin front line'); assert.ok(/350 이상/.test(keys), 'expensive units vs hunters');
  assert.ok(a.warns.some(w => w.mod === 'giantslayer'), 'no hunter counter in deck');
  assert.ok(/4배/.test(Q.STAGE_MODS.giantslayer.desc), 'trait text matches HUNT_MUL 4');
});
test('Recommended deck: counters first, a real front line, hero cap, nothing locked or hunted', () => {
  const owned = {}; for (const u of UNITS) if (u.gacha) owned[u.id] = 1;
  for (const st of STAGES.slice(0, 40)) {
    const i = STAGES.indexOf(st), s = { cleared: i, owned, levels: {}, loadout: [] };
    const deck = Q.recommendDeck(s, st), avail = new Set(Q.availableUnits(s).map(u => u.id));
    assert.ok(deck.length === Q.LOADOUT_MAX && new Set(deck).size === deck.length, 'full, unique: S' + (i + 1));
    assert.ok(deck.every(id => avail.has(id)), 'only available units: S' + (i + 1));
    assert.ok(deck.filter(id => U[id].rarity === 'SSR' || U[id].rarity === 'UR').length <= Q.HERO_SLOT_MAX, 'hero cap');
    assert.ok(deck.filter(id => Q.isFrontUnit(U[id])).length >= 3, 'front line: S' + (i + 1));
    if ((st.mods || []).includes('giantslayer')) assert.ok(deck.every(id => U[id].cost < 350), 'no hunted units: S' + (i + 1));
    for (const m of st.mods || []) assert.ok(deck.some(id => Q.MOD_COUNTERS[m].includes(id)), m + ' countered: S' + (i + 1));
  }
});
test('Shop shows the same numbers the battle uses', () => {
  const b = new Battle(0, Object.assign(save(), { upgrades: { wallet: 4, income: 3, castle: 5, logistics: 2, treasury: 1, spoils: 3 } }), { baseHp: 1e4, money: 100, rate: 50, waves: [], reward: 0 });
  assert.equal(Q.upgradeEffect('wallet', 4)[1], String(b.walletMax));
  assert.equal(Q.upgradeEffect('income', 3)[1], '+' + Math.round((b.income / 50 - 1) * 100) + '%');
  assert.equal(Q.upgradeEffect('castle', 5)[1], String(b.allyCastle.maxHp));
  assert.equal(Q.upgradeEffect('logistics', 2)[1], '-' + Math.round((1 - b.cdMul) * 100) + '%');
  assert.equal(Q.upgradeEffect('spoils', 3)[1], '+' + Math.round((b.goldMul - 1) * 100) + '%');
  for (const k of Object.keys(Q.UPGRADES)) assert.ok(Q.SHOP_ORDER.includes(k) && Q.upgradeEffect(k, 1)[0], 'shop lists ' + k);
});
test('Train deck evenly: lowest level first, never past the cap or the gold', () => {
  const s = { cleared: 3, coins: 2000, upgrades: {}, levels: { spear: 4, shield: 1, archer: 2 }, loadout: ['spear', 'shield', 'archer'] };
  const plan = Q.trainDeckPlan(s);
  assert.ok(plan.n > 0 && plan.spent <= 2000);
  const cap = 5 + 3;
  for (const id of s.loadout) assert.ok(plan.levels[id] <= cap);
  assert.ok(plan.levels.shield >= 2 && plan.levels.archer >= 2, 'low ones first');
  assert.equal(s.levels.shield, 1, 'plan does not touch the save');
  let cost = 0; for (const id of s.loadout) for (let l = s.levels[id]; l < plan.levels[id]; l++) cost += Q.unitTrainCost(U[id], l);
  assert.equal(cost, plan.spent);
});

test('Defeat tips point at the real problem, at most three', () => {
  const D = vm.runInContext('defeatTips', ctx);
  const s = { cleared: 20, coins: 0, upgrades: {}, owned: {}, levels: {}, loadout: ['archer', 'mage', 'longbow'] };
  const tips = D(s, STAGES[19], { foePct: 95, time: 60, bossAlive: true });
  assert.ok(tips.length >= 1 && tips.length <= 3);
  assert.ok(/근접 전열/.test(tips[0]), 'thin front first');
  const rich = D(Object.assign({}, s, { coins: 1e6, loadout: ['spear', 'shield', 'knight', 'javelin', 'frost', 'pyro'] }), STAGES[3], { foePct: 10, time: 300, bossAlive: false });
  assert.ok(rich.some(x => /길어지면/.test(x)) && rich.some(x => /골드/.test(x)), rich.join(' / '));
});

/* ---------------- 3.7 금화 원정 ---------------- */
const X = vm.runInContext('({EXPEDITIONS, expeditionOpen, EVENT_STAGES})', ctx);
function exBattle(k, s) { return new Battle(STAGES.length + X.EVENT_STAGES.length + k, s || save(), X.EXPEDITIONS[k]); }
test('Gold raids: three repeatable stages that open with progress', () => {
  assert.equal(X.EXPEDITIONS.length, 3);
  const ids = new Set(X.EXPEDITIONS.map(st => st.expedition.id)); assert.equal(ids.size, 3);
  assert.ok(!X.expeditionOpen({ cleared: 5 }, 0) && X.expeditionOpen({ cleared: 6 }, 0));
  assert.ok(!X.expeditionOpen({ cleared: 24 }, 2) && X.expeditionOpen({ cleared: 25 }, 2));
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
  assert.ok(render.indexOf("case 'goldcart'") >= 0, 'cart drawn');
  for (const st of X.EXPEDITIONS) {
    assert.ok(i18n.indexOf("'" + st.name + "'") >= 0 && i18n.indexOf("'" + st.expedition.mech + "'") >= 0, st.name);
    for (const w of st.waves) assert.ok(E[w.e], w.e);
  }
  for (const id of ['goldcart', 'banditchief', 'goldwyrm']) assert.ok(i18n.indexOf("'" + E[id].name + "'") >= 0, id);
});
test('Gold raid win pays every time, never gives stones, keeps the best stars', () => {
  const s = Object.assign(save(), { cleared: 30, coins: 0, stones: 0, expeditions: {} });
  const b = exBattle(0, s); b.coins = 100; b.finish('win');
  assert.equal(s.expeditions.convoy, 3); assert.equal(b.stoneGain, 0); assert.equal(s.stones, 0);
  assert.equal(s.coins, 100 + X.EXPEDITIONS[0].expedition.reward);
  const b2 = exBattle(0, s); b2.allyCastle.hp = b2.allyCastle.maxHp * 0.3; b2.finish('win');
  assert.equal(s.expeditions.convoy, 3, 'best kept'); assert.equal(s.expRuns, 2);
  const c0 = s.coins, b3 = exBattle(1, s); b3.coins = 200; b3.finish('lose');
  assert.equal(s.coins, c0 + 100, 'a loss keeps half the loot'); assert.equal(s.expeditions.den, undefined);
});
test('Gold carts roll past the line, pay when broken and vanish (no gold) at the castle', () => {
  const b = exBattle(0); b.update(1 / 30);
  const sp = b.makeAlly(U.spear, 600); b.allies.push(sp);
  const cart = b.spawnEnemy('goldcart', 640); const x0 = cart.x;
  for (let i = 0; i < 10; i++) b.update(1 / 30);
  assert.ok(cart.x < x0 - 1, 'keeps rolling even with a spear in front');
  const c0 = b.coins; cart.takeDamage(cart.maxHp * 10); b.update(1 / 30);
  assert.equal(b.coins - c0, Math.round(E.goldcart.gold * 0.2), 'cart gold'); assert.equal(b.caught, 1);
  const run = b.spawnEnemy('goldcart', b.allyCastle.x + 40); const c1 = b.coins; b.update(1 / 30); b.update(1 / 30);
  assert.ok(run.dead && run.vanish, 'escaped'); assert.equal(b.fled, 1); assert.equal(b.coins, c1, 'no gold for an escaped cart');
});
test('Gold raid fort holds until every wave and cart has come out', () => {
  const b = exBattle(0); b.update(1 / 30);
  b.enemyCastle.takeDamage(b.enemyCastle.maxHp * 2); b.update(1 / 30);
  assert.ok(b.state === 'play' && b.enemyCastle.hp > 0, 'warded while waves remain');
  assert.ok(b.expWard && b.wardUp());
  b.qi = b.queue.length; b.enemies.forEach(e => { e.dead = true; }); b.update(1 / 30); b.update(1 / 30);
  b.enemyCastle.takeDamage(b.enemyCastle.maxHp * 2); b.update(1 / 30); b.update(1 / 30);
  assert.equal(b.state, 'win');
});

/* ---------------- 3.8 편의 · 최적화 ---------------- */
test('Paused battle resumes from the centre card or a tap on the field', () => {
  const main = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(/#pause-label\{[^}]*pointer-events:auto/.test(css), 'pause card takes taps');
  assert.ok(/\$\('#pause-label'\)\.addEventListener\('click', resumeFromTap\)/.test(main), 'card resumes');
  assert.ok(/moved <= 6 && paused/.test(main), 'a tap (not a drag) on the field resumes');
  assert.ok(/id="pause-label" role="button"/.test(html));
});
test('Menus stay light: icons cached and painted when visible, formation pool updated in place', () => {
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  const form = fs.readFileSync(path.join(__dirname, '../js/formation.js'), 'utf8');
  assert.ok(/_iconCache\.get\(key\)/.test(render) && /IntersectionObserver/.test(render), 'icon cache + lazy paint');
  assert.ok(/box\._sig === sig/.test(form), 'pool reuses tiles when the list is unchanged');
  assert.ok(/q === 'low' \? 1\.5 : 1\.75/.test(render), 'auto quality caps canvas density at 1.75');
});

/* ---------------- 3.9 근접 영웅 '선봉' · 사거리 · 연출 층 ---------------- */
test('Melee legends are vanguards: tough, lifesteal, shield nearby allies, keep to the line', () => {
  const th = G.resolveUnit(U.thor, 5);
  assert.ok(th.ab.armor >= 0.3 && th.ab.lifesteal >= 0.12 && th.ab.revive >= 0.4 && th.ab.vanguard, 'vanguard kit');
  assert.ok(!G.resolveUnit(U.zeus, 5).ab.vanguard, 'ranged heroes do not get it');
  const b = battle(); const hero = b.makeAlly(th, 500), sp = b.makeAlly(U.spear, 520), far = b.makeAlly(U.spear, 900);
  b.allies.push(hero, sp, far); b.updateCover(0);
  const orc = b.spawnEnemy('goblin', 560);
  let a = sp.hp; b.hitOne(100, sp, orc, false); const near = a - sp.hp;
  a = far.hp; b.hitOne(100, far, orc, false); const away = a - far.hp;
  assert.ok(Math.abs(near - away * 0.9) < 1, 'allies next to a vanguard take 10% less: ' + near + ' vs ' + away);
  // 전열보다 멀리 앞서지 않는다
  const b2 = battle(); const h2 = b2.makeAlly(G.resolveUnit(U.nezha, 5), 400), line = b2.makeAlly(U.shield, 300);
  b2.allies.push(h2, line); for (let i = 0; i < 60; i++) b2.update(1 / 30);
  assert.ok(h2.x - line.x <= 60 + 40, 'nezha waits for the line: ' + Math.round(h2.x - line.x));
});
test('Ranged reach is spread from skirmishers to artillery', () => {
  const r = UNITS.filter(u => u.ranged && u.cost > 0 && !u.gacha).map(u => u.range);
  assert.ok(Math.min(...r) <= 180 && Math.max(...r) >= 600, 'short and very long');
  assert.ok(new Set(r.map(x => Math.round(x / 50))).size >= 7, 'many distinct bands');
});

/* ---------------- 4.0 4막 '천공 요새' · 원탁의 기사 ---------------- */
test('Act 4 Sky Citadel: ten stages, sky looks, three bosses, ramps up', () => {
  const A = STAGES.slice(40, 50);
  assert.equal(A.length, 10);
  assert.equal(A.filter(s => s.bossId).map(s => s.bossId).join(','), 'stormgriffin,cloudking,skylord');
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  for (const look of new Set(A.map(s => s.look))) assert.ok(render.indexOf('  ' + look + ':') >= 0, look);
  assert.equal(STAGES[49].bossMusic, 'finale3');
  assert.ok(A[9].baseHp > A[0].baseHp && A[8].enemyMul >= A[0].enemyMul, 'the act ramps up');
  const music = fs.readFileSync(path.join(__dirname, '../js/music.js'), 'utf8');
  for (const st of A) assert.ok(music.indexOf('  ' + st.music + ':') >= 0, 'music ' + st.music);
  for (const k of ['boss_stormgriffin', 'boss_cloudking', 'boss_skylord', 'finale3', 'hc_sky']) assert.ok(music.indexOf('  ' + k + ':') >= 0, k);
});
test('Round Table season units and sky foes are drawn and translated', () => {
  const render = fs.readFileSync(path.join(__dirname, '../js/render.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
  const { SEASONS } = vm.runInContext('({SEASONS})', ctx);
  const sn = SEASONS.find(x => x.id === 'camelot');
  assert.equal(sn.units.slice().sort().join(','), 'arthur,camelotguard,galahad,lancelot,merlin,morgana,tristan');
  for (const id of sn.units) {
    assert.ok(render.indexOf("case '" + U[id].shape + "'") >= 0, id);
    assert.ok(i18n.indexOf("'" + U[id].name + "'") >= 0, id + ' name');
  }
  for (const id of ['harpy', 'griffinrider', 'stormwisp', 'cloudgiant', 'skycannon', 'windcaller', 'stormgriffin', 'cloudking', 'skylord']) {
    assert.ok(render.indexOf("case '" + E[id].shape + "'") >= 0, id); assert.ok(i18n.indexOf("'" + E[id].name + "'") >= 0, id);
    if (E[id].abText) assert.ok(i18n.indexOf("'" + E[id].abText + "'") >= 0, id + ' abText');
  }
  assert.ok(render.indexOf("e.kind==='excalibur'") >= 0, 'canvas excalibur');
  assert.ok(fs.readFileSync(path.join(__dirname, '../js/gl-fx.js'), 'utf8').indexOf("case 'excalibur':") >= 0, 'gl excalibur');
});
test('Arthur rallies others but not himself; cloud giants stop regenerating when burned', () => {
  const b = battle(); const ar = b.makeAlly(G.resolveUnit(U.arthur, 5), 500), sp = b.makeAlly(U.spear, 520);
  b.allies.push(ar, sp);
  assert.ok(U.arthur.ab.rally && U.arthur.active.kind === 'excalibur');
  const g = b.spawnEnemy('cloudgiant', 900); g.hp = g.maxHp * 0.5; const h0 = g.hp;
  g.burnT = 3; g.burnDps = 1; for (let i = 0; i < 30; i++) b.update(1 / 30);
  assert.ok(g.hp <= h0, 'burning blocks regen');
  g.burnT = 0; const h1 = g.hp; for (let i = 0; i < 30; i++) b.update(1 / 30);
  assert.ok(g.hp > h1, 'regen resumes');
});

/* ---------------- 4.1 3진 (각성) ---------------- */
test('4.3: only six units awaken — each drawn, translated and given its own effects', () => {
  const X = vm.runInContext('({EVOLUTIONS, EVOLUTIONS2, EVO2_LEVEL, ROSTER_UNITS, evo2Cost})', ctx);
  const read = f => fs.readFileSync(path.join(__dirname, '../js/' + f), 'utf8');
  const render = read('render.js'), i18n = read('i18n.js'), gl = read('gl-fx.js');
  assert.equal(X.EVO2_LEVEL, 20);
  const ids = Object.keys(X.EVOLUTIONS2).sort();
  assert.deepEqual(ids, ['catapult', 'colossus', 'falconer', 'mage', 'priest', 'spear']);
  for (const id of ids) {
    const e = X.EVOLUTIONS2[id], u = U[id];
    assert.ok(u && X.EVOLUTIONS[id] && X.ROSTER_UNITS.includes(u), id + ' is a campaign unit with a first evolution');
    assert.ok(e.look && e.look.shape && e.plus && e.arrive && (e.castFx || e.healFx), id + ' has a look, text, an arrival and a signature effect');
    assert.ok(render.indexOf("case '" + e.look.shape + "':") >= 0, id + ' drawn');
    for (const k of [e.name, e.short, e.plus]) assert.ok(i18n.indexOf("'" + k + "'") >= 0, id + ' translated: ' + k);
    if (e.castFx) {
      assert.ok(gl.indexOf("case '" + e.castFx + "':") >= 0, id + ' impact has a WebGL version');
      assert.ok(render.indexOf("case '" + e.castFx + "':") >= 0, id + ' impact has a Canvas fallback');
    }
    assert.ok(X.evo2Cost(u) > G.evoCost(u), 'costs more than the first evolution');
    const r = G.resolveUnit(u, 20, 2);
    for (const k of ['castFx', 'arrive', 'atkFx', 'healFx', 'shot']) if (e[k]) assert.equal(r[k], e[k], id + ' carries ' + k);
  }
  const shapes = ids.map(id => X.EVOLUTIONS2[id].look.shape);
  assert.equal(new Set(shapes).size, shapes.length, 'every third form looks different');
  for (const u of X.ROSTER_UNITS) if (!X.EVOLUTIONS2[u.id] && X.EVOLUTIONS[u.id]) {
    const r = G.resolveUnit(u, 20, 2);
    assert.ok(r.evo && !r.evo2, u.id + ' stops at the first evolution');
  }
  const ach = vm.runInContext('ACHIEVEMENTS', ctx).find(a => a.id === 'awakenAll');
  const all = {}; ids.forEach(id => all[id] = true);
  assert.ok(ach.test({ evo2: all }) && !ach.test({ evo2: { catapult: true } }), 'the achievement asks for all six');
  assert.ok(ach.test({ evo2: Object.assign({}, all, { mage: false }) }), 'a finished but unused third form still counts');
});
test('Third form: big upgrade, only deploy cost and cooldown go up, evolution trade-off removed', () => {
  for (const id of ['catapult', 'priest', 'spear', 'mage', 'colossus', 'falconer']) {
    const e1 = G.resolveUnit(U[id], 20, true), e2 = G.resolveUnit(U[id], 20, 2);
    assert.equal(e2.evo2, true, id); assert.equal(e2.evo, true, id);
    assert.ok(e2.hp > e1.hp * 1.3 && e2.atk >= e1.atk * 1.3 - 1, id + ' stronger');
    assert.ok(e2.cost > e1.cost && e2.cooldown > e1.cooldown, id + ' costs more and cools down longer');
    assert.ok(e2.interval <= U[id].interval + 1e-9, id + ' keeps the base attack speed (trade-off gone)');
    assert.ok(e2.speed >= U[id].speed, id + ' not slowed');
  }
  assert.equal(G.resolveUnit(U.catapult, 20, 2).shape, 'tank', 'the catapult becomes a tank');
  assert.equal(G.resolveUnit(U.catapult, 19, 2).evo2, undefined, 'no third form below Lv20');
  assert.ok(G.resolveUnit(U.priest, 20, 2).ab.heal > G.resolveUnit(U.priest, 20, false).ab.heal, 'ambulance heals more than base priest');
  assert.equal(U.catapult.shape, 'catapult', 'base data is never mutated');
});
test('Save forms: base / evolved / third, chosen per unit', () => {
  const X = vm.runInContext('({evoForm, setEvoForm})', ctx);
  const sv = { levels: { catapult: 20, archer: 12 }, evo: { catapult: true, archer: true }, evo2: { catapult: true } };
  assert.equal(X.evoForm(sv, 'catapult'), 2); assert.equal(G.unitFor(sv, 'catapult').shape, 'tank');
  X.setEvoForm(sv, 'catapult', 'evo'); assert.equal(X.evoForm(sv, 'catapult'), 1); assert.equal(sv.evo2.catapult, false);
  X.setEvoForm(sv, 'catapult', 'base'); assert.equal(X.evoForm(sv, 'catapult'), 0);
  X.setEvoForm(sv, 'catapult', 'evo2'); assert.equal(X.evoForm(sv, 'catapult'), 2);
  X.setEvoForm(sv, 'archer', 'evo2'); assert.equal(sv.evo2.archer, undefined, 'archers have no third form');
  assert.equal(X.evoForm(sv, 'archer'), 1);
  sv.levels.spear = 12; sv.evo.spear = true;
  X.setEvoForm(sv, 'spear', 'evo2'); assert.equal(sv.evo2.spear, undefined, 'cannot pick a third form not yet earned');
  const b = new Battle(0, Object.assign(save(), { loadout: ['catapult'], levels: { catapult: 20 }, evo: { catapult: true }, evo2: { catapult: true } }));
  assert.equal(b.stats('catapult').shape, 'tank'); assert.ok(b.stats('catapult').cost > U.catapult.cost);
});

/* ---------------- 4.2 버그 수정 ---------------- */
test('Deploying at the total field cap makes the oldest summon vanish instead of overfilling', () => {
  const s = save(); s.loadout = ['spear']; const b = new Battle(0, s);
  const sk = U.skeleton || U.monkeyclone;
  for (let i = 0; i < FIELD_TOTAL_CAP; i++) { const m = b.makeAlly(sk, 300 + i, b.makeAlly(U.necro, 200)); m.summoned = true; m.age = i; b.allies.push(m); }
  b.money = 1e6; b.cooldowns.spear = 0;
  assert.ok(b.deploy('spear'), 'deploying is never blocked by summons');
  const alive = b.allies.filter(a => !a.dead);
  assert.equal(alive.length, FIELD_TOTAL_CAP, 'total stays at the cap');
  assert.ok(b.allies.some(a => a.dead && a.vanish && a.age === FIELD_TOTAL_CAP - 1), 'the oldest summon made room');
});
test('Giantslayer judges a unit by its own price, not the third-form surcharge', () => {
  const s = save(); s.loadout = ['catapult']; s.levels = { catapult: 20 }; s.evo = { catapult: true }; s.evo2 = { catapult: true };
  const b = new Battle(0, s, { baseHp: 10000, money: 900, rate: 0, waves: [], reward: 0, mods: ['giantslayer'] });
  const tank = b.makeAlly(b.stats('catapult'), 500);
  assert.ok(tank.s.cost >= 350 && U.catapult.cost < 350, 'the tank costs more than 350 now'); assert.ok(b.mods.giantslayer, 'mod active');
  const orc = b.spawnEnemy('goblin', 560); const undo = rnd(0);
  const h0 = tank.hp; b.hitOne(100, tank, orc, false); undo();
  assert.ok(h0 - tank.hp < 150, 'not treated as a hero: ' + (h0 - tank.hp));
});
test('English data pass covers the third-form table', () => {
  const i18n = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
  assert.ok(/EVOLUTIONS, EVOLUTIONS2,/.test(i18n), 'EVOLUTIONS2 is translated at start');
  assert.ok(/'하드코어 전장 40곳 돌파'/.test(i18n));
});

/* ---------------- 4.3 3진 여섯의 연출 ---------------- */
function x3Battle(ids) {
  const s = save(); s.loadout = ids; s.levels = {}; s.evo = {}; s.evo2 = {};
  for (const id of ids) { s.levels[id] = 20; s.evo[id] = true; s.evo2[id] = true; }
  const b = new Battle(0, s); b.money = 1e6; return b;
}
test('4.3: each third form arrives its own way instead of the light pillar', () => {
  const b = x3Battle(['catapult', 'colossus', 'mage', 'priest', 'falconer', 'spear']);
  const subs = [];
  for (const id of b.roster.map(u => u.id)) {
    b.cooldowns[id] = 0; b.fx.length = 0; assert.ok(b.deploy(id), id);
    assert.ok(!b.fx.some(e => e.type === 'spawn'), id + ' skips the generic pillar');
    const a = b.fx.find(e => e.type === 'x3' && e.kind === 'arrive'); assert.ok(a, id + ' arrival'); subs.push(a.sub);
  }
  assert.deepEqual(subs.sort(), ['drill', 'drone', 'robot', 'siren', 'tank', 'ufo']);
  const plain = battle(); plain.money = 1e6; plain.deploy('spear');
  assert.ok(plain.fx.some(e => e.type === 'spawn') && !plain.fx.some(e => e.type === 'x3'), 'ordinary units are unchanged');
});
test('4.3: tank fires with a muzzle blast, the saucer beams down, the robot quakes the ground', () => {
  const b = x3Battle(['catapult', 'mage', 'colossus']);
  const tank = b.makeAlly(b.stats('catapult'), 400), ufo = b.makeAlly(b.stats('mage'), 420), bot = b.makeAlly(b.stats('colossus'), 440);
  const e = b.spawnEnemy('goblin', 520);
  b.attack(tank, e, b.enemies, b.enemyCastle);
  const mz = b.fx.find(f => f.type === 'x3' && f.kind === 'muzzle');
  assert.ok(mz && mz.x === tank.x && mz.ox > 0 && mz.h > 0, 'muzzle offset kept in body units');
  assert.equal(b.shots[b.shots.length - 1].src, tank);
  b.fx.length = 0; b.attack(ufo, e, b.enemies, b.enemyCastle);
  const beam = b.fx.find(f => f.type === 'x3' && f.kind === 'ufobeam');
  assert.ok(beam && beam.x === ufo.x && beam.x2 === e.x, 'beam runs from the saucer to the target');
  assert.ok(b.fx.some(f => f.type === 'cast' && f.kind === 'ufoburst' && f.x3), 'saucer impact');
  b.fx.length = 0; const shake = b.shake; b.attack(bot, e, b.enemies, b.enemyCastle);
  assert.ok(b.fx.some(f => f.type === 'x3' && f.kind === 'quake'), 'rocket punch cracks the ground');
  assert.ok(b.shake >= Math.max(shake, 6), 'and shakes the screen');
});
test('4.3: shell impact leaves smoke and scorch; third-form impacts are never starved by other casts', () => {
  const b = x3Battle(['catapult']); const tank = b.makeAlly(b.stats('catapult'), 400);
  for (let i = 0; i < 12; i++) b.fx.push({ type: 'cast', kind: 'holy', x: 600, row: 0, t: 1, life: 1 });   // 보통 병사의 연출이 가득
  b.castFx(tank, 700, 0, false);
  assert.ok(b.fx.some(f => f.type === 'cast' && f.kind === 'shellblast'), 'tank impact still shows');
  assert.ok(b.fx.some(f => f.type === 'x3' && f.kind === 'boom'), 'smoke and scorch');
  for (let i = 0; i < 40; i++) b.castFx(tank, 700, 0, false);
  assert.ok(b.fx.filter(f => f.type === 'x3').length <= 12, 'x3 effects are capped');
  assert.ok(b.fx.filter(f => f.type === 'cast' && f.x3).length <= 8, 'x3 casts are capped too');
});
test('4.3: the ambulance siren replaces the plain auras and marks healed allies', () => {
  const b = x3Battle(['priest']); const amb = b.makeAlly(b.stats('priest'), 400);
  const hurt = [b.makeAlly(U.spear, 420), b.makeAlly(U.spear, 440)]; hurt.forEach(m => { m.hp = 1; });
  const full = b.makeAlly(U.spear, 460);
  b.allies.push(amb, ...hurt, full); amb.abCd = 0;
  b.supportTick(amb, b.allies, 0.1, true);
  assert.ok(hurt.every(m => m.hp > 1), 'heals');
  assert.ok(b.fx.some(f => f.type === 'x3' && f.kind === 'siren'), 'siren rings');
  assert.equal(b.fx.filter(f => f.type === 'x3' && f.kind === 'medic').length, 2, 'a red cross over each healed ally');
  assert.ok(!b.fx.some(f => f.type === 'aura'), 'no stacked heal / cleanse / barrier auras');
  const p = battle(); const pr = p.makeAlly(U.priest, 400), m = p.makeAlly(U.spear, 420); m.hp = 1; p.allies.push(pr, m); pr.abCd = 0;
  p.supportTick(pr, p.allies, 0.1, true);
  assert.ok(p.fx.some(f => f.type === 'aura') && !p.fx.some(f => f.type === 'x3'), 'the base priest keeps its aura');
});

test('4.4: strike warnings run on battle time and land together with the strike', () => {
  const b = battle(), src = b.makeAlly(U.spear, 400);
  b.queueStrike(src, { x: 900, r: 60, dmg: 10, warn: 1, kind: 'shockwave' });
  const w = b.fx.find(f => f.type === 'warn');
  for (let i = 0; i < 20; i++) b.updateFx(0.4);              // 일시정지 중 흐르는 화면 시간
  assert.ok(b.fx.includes(w) && w.t === 1, 'paused: the warning stays');
  b.updatePending(0.5); assert.ok(Math.abs(w.t - 0.5) < 1e-9, 'shrinks with the strike timer');
  b.updatePending(0.6); b.updateFx(0);
  assert.ok(!b.fx.includes(w) && !b.pending.length, 'gone exactly when the strike lands');
});
test('4.4: poison and burn respect the veil and the core', () => {
  const b = battle();
  const veiled = new Fighter(E.goblin, 'enemy', 1800); veiled.veilT = 2; veiled.poisonT = 1; veiled.poisonDps = 300;
  const cored = new Fighter({ ...E.goblin, ab: { core: { armor: 0.95, mul: 3 } } }, 'enemy', 1800); cored.burnT = 1; cored.burnDps = 100;
  b.step([veiled, cored], [], b.allyCastle, 0.1, false);
  assert.equal(veiled.hp, veiled.maxHp);
  assert.ok(Math.abs(cored.maxHp - cored.hp - 0.5) < 1e-6, 'closed core blocks 95%');
});
test('4.4: a weaker haste does not overwrite a stronger one still running', () => {
  const b = battle(), a = b.makeAlly(U.spear, 400); b.allies.push(a);
  b.cmdCd = 0; b.useCommand();
  const strong = a.hasteMul; assert.ok(strong < 0.7);
  const herald = new Fighter({ ...U.spear, ab: { radius: 200, haste: { mul: 0.78, dur: 3 } } }, 'ally', 410);
  herald.abCd = 0; b.supportTick(herald, [a, herald], 0.1, true);
  assert.equal(a.hasteMul, strong);
});

console.log(count + ' regression checks passed');
