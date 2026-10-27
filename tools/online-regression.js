#!/usr/bin/env node
/* 5.21 온라인 2인 (대전 · 협동) 회귀 검사
 *  - 넘겨받은 편성 정리 (mpSave) · 대전 표준 규칙 · 협동 지갑
 *  - 오른쪽 사람의 뒤집힌 판이 끝자리까지 되돌아오는지
 *  - 두 기기(따로 띄운 vm)가 같은 입력으로 같은 판을 도는지 · 잃어버리는 중계로도 · 판 사진으로 다시 맞추기
 *  - 번역 · 앱 권한 · 오프라인 목록 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 기기 하나 = vm 하나 (전역 · 병종 캐시가 따로다)
function device() {
  const M = Object.create(Math);
  let seed = 99; M.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ctx = { console, JSON, Math: M, performance: { now: () => 0 }, saveGame() {} };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['js/data.js', 'js/game.js', 'js/online.js']) vm.runInContext(read(f), ctx, { filename: f });
  return Object.assign(vm.runInContext('({Battle, MP, UNITS, UNIT_BY_ID, LOADOUT_MAX, COMMAND, mpSave, pvpStage, mpMakeBattle, MpLock, MpSnap, mpValidAct})', ctx), { ctx });
}
const G = device();
const DECK0 = ['spear', 'shield', 'archer', 'priest', 'knight', 'merchant', 'lancer', 'catapult', 'zeus', 'odin'];
const DECK1 = ['spear', 'shield', 'catapult', 'siegebow', 'hwacha', 'colossus', 'anchorguard', 'archer', 'inventor', 'steammech'];
const cfgOf = (mode, extra) => Object.assign({ mode, seed: 4242, stage: 14, look: 'meadow', p: [{ cleared: 90, loadout: DECK0 }, { cleared: 90, loadout: DECK1 }] }, extra || {});
const copy = o => JSON.parse(JSON.stringify(o));

let count = 0;
function test(name, fn) { fn(); count++; console.log('✓ ' + name); }

test('5.21: a peer deck is cleaned — unknown ids, repeats, too many cards, odd levels and broken evolution chains are dropped', () => {
  const info = { cleared: 1e9, loadout: ['spear', 'spear', 'nope', 7, ...DECK0], levels: { spear: 999, shield: -5, archer: 'x' },
                 evo: { knight: 'yes' }, evo2: { spear: true }, upgrades: { atk: 3, 'b@d': 4, hp: 99 } };
  const c = G.mpSave(info, false);
  assert.ok(c.loadout.length <= G.LOADOUT_MAX && new Set(c.loadout).size === c.loadout.length && c.loadout.every(id => G.UNIT_BY_ID[id]));
  assert.equal(c.levels.spear, 30); assert.equal(c.levels.shield, 1); assert.equal(c.levels.archer, 1);
  assert.equal(c.evo.knight, undefined, 'only true/false evolution flags');
  assert.equal(c.evo2.spear, undefined, 'no 3rd form without the 2nd');
  assert.equal(JSON.stringify(c.upgrades), '{"atk":3}', 'co-op keeps sane upgrades only');
  assert.ok(c.cleared <= 1e4);
  const p = G.mpSave(info, true);
  assert.ok(Object.values(p.levels).every(l => l === G.MP.pvp.level), 'versus: every unit at the fixed level');
  assert.equal(JSON.stringify(p.upgrades), '{}', 'versus: no upgrades');
  assert.equal(G.mpSave({ loadout: ['nope'] }, true).loadout.length, 0);
});

test('5.21: versus — both sides get the same castle, purse and command; the right player deploys from the right at the same strength', () => {
  const b = G.mpMakeBattle(cfgOf('pvp', { p: [{ cleared: 90, loadout: DECK0 }, { cleared: 90, loadout: DECK0 }] }));
  assert.equal(b.allyCastle.maxHp, G.MP.pvp.castle); assert.equal(b.enemyCastle.maxHp, G.MP.pvp.castle);
  const w0 = b.walletOf(0), w1 = b.walletOf(1);
  for (const k of ['money', 'income', 'walletMax', 'cmdMax']) assert.equal(w0[k], w1[k], k);
  assert.ok(!b.bossWard, 'no boss ward in versus');
  b.walletOf(0).money = b.walletOf(1).money = 5000;
  assert.ok(b.mpAct(0, { k: 'd', id: 'knight' })); assert.ok(b.mpAct(1, { k: 'd', id: 'knight' }));
  const k0 = b.allies.find(f => f.s.id === 'knight'), k1 = b.enemies.find(f => f.s.id === 'knight');
  assert.ok(k0 && k1, 'the right player\'s unit lives on the enemy list');
  assert.equal(k1.pl, 1); assert.ok(k1.pvp && k1.pc);
  const mid = (b.allyCastle.x + b.enemyCastle.x) / 2;
  assert.equal(mid * 2, G.MP.pvp.len, 'the field is the versus length');
  assert.ok(k0.x < mid && k1.x > mid && k0.dir === 1 && k1.dir === -1);
  assert.equal(k0.maxHp, k1.maxHp); assert.equal(k0.s.atk, k1.s.atk);
  assert.ok(Math.abs((k0.x - b.allyCastle.x) - (b.enemyCastle.x - k1.x)) <= 40, 'mirrored spawn points (same 40px scatter)');
});

test('5.21: looking from the right side and back leaves the battle bit-for-bit unchanged', () => {
  const b = G.mpMakeBattle(cfgOf('pvp'));
  for (let i = 0; i < 900; i++) {
    if (i % 20 === 0) for (const pl of [0, 1]) b.mpAct(pl, { k: 'd', id: (pl ? DECK1 : DECK0)[(i / 20) % 10] });
    b.mpStep(1 / 30);
  }
  const before = b.mpHash(), xs = b.allies.concat(b.enemies).map(f => f.x);
  let seen = 0;
  b.viewFrame(1, () => { seen = b.allies.length; for (const f of b.allies) assert.equal(f.side, 'ally'); });
  assert.equal(seen, b.enemies.length, 'the right player sees their own units as allies');
  assert.equal(b.mpHash(), before);
  assert.equal(JSON.stringify(b.allies.concat(b.enemies).map(f => f.x)), JSON.stringify(xs));
});

test('5.21: co-op — separate purses and cooldowns, a per-player field cap, tougher foes and fort', () => {
  const solo = new G.Battle(14, G.mpSave({ cleared: 90, loadout: DECK0 }, false));
  const b = G.mpMakeBattle(cfgOf('coop'));
  assert.ok(Math.abs(b.enemyMulBase / solo.enemyMulBase - G.MP.coop.enemyMul) < 1e-9);
  assert.equal(b.enemyCastle.maxHp, Math.round(solo.enemyCastle.maxHp * G.MP.coop.fortMul));
  const m0 = b.walletOf(0).money, m1 = b.walletOf(1).money;
  assert.ok(b.mpAct(1, { k: 'd', id: 'spear' }));
  assert.equal(b.walletOf(0).money, m0, 'player 1 did not pay'); assert.ok(b.walletOf(1).money < m1, 'player 2 paid');
  assert.equal(b.walletOf(0).cooldowns.spear || 0, 0); assert.ok(b.walletOf(1).cooldowns.spear > 0);
  assert.equal(b.allies.find(f => f.s.id === 'spear').pl, 1);
  // 칸 수는 사람마다
  b.walletOf(0).money = 1e6;
  let n = 0;
  for (let i = 0; i < 200 && n < G.MP.coop.cap + 5; i++) { b.walletOf(0).cooldowns.spear = 0; b.walletOf(0).money = 1e6; if (b.mpAct(0, { k: 'd', id: 'spear' })) n++; }
  assert.equal(n, G.MP.coop.cap, 'player 1 fills only their own share');
  b.walletOf(1).cooldowns.shield = 0; b.walletOf(1).money = 1e6;
  assert.ok(b.mpAct(1, { k: 'd', id: 'shield' }), 'player 2 still has room');
});

test('5.21: surrender — versus gives the match to the other side, co-op loses for both', () => {
  const p = G.mpMakeBattle(cfgOf('pvp')); p.mpAct(1, { k: 'q' }); assert.equal(p.state, 'win');
  const p2 = G.mpMakeBattle(cfgOf('pvp')); p2.mpAct(0, { k: 'q' }); assert.equal(p2.state, 'lose');
  const c = G.mpMakeBattle(cfgOf('coop')); c.mpAct(1, { k: 'q' }); assert.equal(c.state, 'lose');
});

test('5.21: versus overtime — after the time limit both castles crumble, so a stalemate still ends', () => {
  const b = G.mpMakeBattle(cfgOf('pvp'));
  b.time = G.MP.pvp.overtime + 1;
  const h0 = b.allyCastle.hp, h1 = b.enemyCastle.hp;
  b.mpStep(1 / 30);
  assert.ok(b.allyCastle.hp < h0 && b.enemyCastle.hp < h1);
  assert.ok(Math.abs((h0 - b.allyCastle.hp) - (h1 - b.enemyCastle.hp)) < 1e-9, 'evenly');
});

test('5.21: rewards — versus pays by result (none for a match settled inside a minute), the right player reads the result flipped, co-op pays like a stage', () => {
  const ctx = device().ctx;
  const run = (mode, role, setup) => vm.runInContext(`(() => {
    save = { coins: 0, stats: {} }; saveGame = () => {}; $ = () => ({ classList: { contains: () => false } }); setTimeout = () => 0;
    const b = mpMakeBattle(${JSON.stringify(cfgOf(mode))});
    (${setup})(b);
    battle = b; Online.cfg = { mode: '${mode}' }; Online.role = ${role}; Online.state = 'battle'; Online.rewarded = false; Online.peer = null;
    Online.endBattle(b.state);
    return { res: Online.result.res, coins: save.coins, games: save.stats.${mode === 'pvp' ? 'pvpGames' : 'coopGames'} };
  })()`, ctx);
  const R = vm.runInContext('MP_PVP_REWARD', ctx);
  let r = run('pvp', 0, 'b => { b.time = 200; b.finish("win"); }');
  assert.equal(r.res, 'win'); assert.equal(r.coins, R.win); assert.equal(r.games, 1);
  r = run('pvp', 1, 'b => { b.time = 200; b.finish("win"); }');
  assert.equal(r.res, 'lose', 'left won → right lost'); assert.equal(r.coins, R.lose);
  r = run('pvp', 0, 'b => { b.time = 5; b.finish("win"); }');
  assert.equal(r.coins, 0, 'a surrender swap inside a minute pays nothing');
  // 협동의 처치 금화는 0번 지갑에 함께 쌓인다 (전장이 왼쪽 사람 자리에서 돈다) — 오른쪽 사람도 같이 받는다
  const kill = () => vm.runInContext(`(() => { const b = mpMakeBattle(${JSON.stringify(cfgOf('coop'))}); b.walletOf(0).money = b.walletOf(1).money = 1e5;
    const d1 = ${JSON.stringify(DECK1)};
    for (let i = 0; i < 1800 && b.state === 'play'; i++) { if (i % 30 === 0) { b.walletOf(1).money = 1e5; b.mpAct(1, { k: 'd', id: d1[(i / 30) % d1.length] }); } b.mpStep(1 / 30); }
    return [b.walletOf(0).coins, b.walletOf(1).coins, b.walletOf(0).kills]; })()`, ctx);
  const [c0, c1, k0] = kill();
  assert.ok(c0 > 0 && k0 > 0 && c1 === 0, 'team pool in wallet 0: ' + [c0, c1, k0]);
  r = run('coop', 1, 'b => { b.time = 200; b.coins = 40; b.finish("win"); }');
  assert.equal(r.res, 'win'); assert.equal(r.coins, vm.runInContext('STAGES[14].reward', ctx) + 40, 'co-op win: the stage reward and the team\'s kill gold');
});

test('5.21: only well-formed actions are accepted from the wire', () => {
  assert.ok(G.mpValidAct({ k: 'd', id: 'spear' })); assert.ok(G.mpValidAct({ k: 'c' })); assert.ok(G.mpValidAct({ k: 'q' }));
  for (const bad of [null, 5, {}, { k: 'x' }, { k: 'd' }, { k: 'h', id: 7 }, { k: 'd', id: 'x'.repeat(80) }]) assert.ok(!G.mpValidAct(bad), JSON.stringify(bad));
});

/* 두 기기를 이어 돌린다: 늦고 잃어버리는 중계 */
function link(mode, loss, secs, snapAt) {
  const A = device(), B = device(), cfg = cfgOf(mode);
  const bA = A.mpMakeBattle(copy(cfg)), bB = B.mpMakeBattle(copy(cfg));
  let rnd = 11; const R = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const wire = []; let now = 0;
  const send = to => m => { if (R() < loss) return; wire.push({ at: now + 0.04 + R() * 0.3, to, m: copy(m) }); };
  const LA = new A.MpLock(bA, 0, cfg.seed, send(1)), LB = new B.MpLock(bB, 1, cfg.seed, send(0));
  let desync = 0; LA.onDesync = LB.onDesync = () => desync++;
  const ptr = [0, 0];
  const ai = (L, pl) => L.b.viewFrame(pl, () => {
    const b = L.b, R2 = b.roster;
    for (let t = 0; t < R2.length; t++) {
      const u = R2[(ptr[pl] + t) % R2.length];
      if (b.cooldowns[u.id] > 0 || L.pendingOf('d', u.id)) continue;
      if (b.money < u.cost) break;
      ptr[pl] = (ptr[pl] + t + 1) % R2.length; L.input({ k: 'd', id: u.id }); break;
    }
  });
  let frames = 0, snapped = false;
  while ((LA.b.state === 'play' || LB.b.state === 'play') && now < secs) {
    const dt = 1 / 60 + (R() < 0.05 ? 0.07 : 0);
    now += dt; frames++;
    for (let i = wire.length - 1; i >= 0; i--) if (wire[i].at <= now) { const w = wire.splice(i, 1)[0]; (w.to ? LB : LA).receive(w.m); }
    if (frames % 12 === 0) { ai(LA, 0); ai(LB, 1); }
    LA.frame(dt); LB.frame(dt);
    if (snapAt && !snapped && LA.turn >= snapAt && LB.turn >= LA.turn) {
      // B 의 판을 일부러 틀어 놓고, A 의 사진(글)으로 갈아 끼운다
      LB.b.allyCastle.hp -= 123;
      const text = JSON.stringify({ turn: LA.turn, rng: LA.rng.get(), snap: A.MpSnap.encode(LA.b) });
      const o = JSON.parse(text);
      LB.adopt(B.MpSnap.decode(o.snap), o.turn, o.rng);
      snapped = true;
    }
  }
  // 늦게 온 입력까지 받아 같은 턴에 맞춘다
  for (let k = 0; k < 600 && LA.turn !== LB.turn; k++) {
    now += 1 / 60;
    for (let i = wire.length - 1; i >= 0; i--) if (wire[i].at <= now) { const w = wire.splice(i, 1)[0]; (w.to ? LB : LA).receive(w.m); }
    if (LA.turn < LB.turn) LA.frame(1 / 60); else LB.frame(1 / 60);
  }
  return { LA, LB, desync, snapped };
}

test('5.21: two devices in lockstep over a lossy relay stay identical (versus, 20% loss)', () => {
  const { LA, LB, desync } = link('pvp', 0.2, 120);
  assert.ok(LA.turn > 300, 'the match advanced: ' + LA.turn);
  assert.equal(LA.turn, LB.turn); assert.equal(desync, 0);
  assert.equal(LA.b.mpHash(), LB.b.mpHash());
  assert.ok(LA.b.allies.length + LA.b.enemies.length > 0, 'both sides fought');
});

test('5.21: two devices in lockstep stay identical in co-op too', () => {
  const { LA, LB, desync } = link('coop', 0.1, 90);
  assert.equal(LA.turn, LB.turn); assert.equal(desync, 0);
  assert.equal(LA.b.mpHash(), LB.b.mpHash());
});

test('5.21: a desynced device is put right by the host\'s snapshot and stays in step afterwards', () => {
  const { LA, LB, desync, snapped } = link('pvp', 0.05, 80, 300);
  assert.ok(snapped);
  assert.equal(LA.turn, LB.turn); assert.equal(desync, 0, 'no desync after adopting the snapshot');
  assert.equal(LA.b.mpHash(), LB.b.mpHash());
  assert.equal(LB.adopted, 1);
});

test('5.21: sound effects never draw from the seeded battle dice (a skipped sound must not split the two devices)', () => {
  const game = read('js/game.js');
  const sfx = game.slice(game.indexOf('function sfx(name) {'), game.indexOf('const SYS_RANDOM'));
  assert.ok(/Math\.random = SYS_RANDOM;\s*try \{ fn\.call\(SFX\); \} finally \{ Math\.random = r; \}/.test(sfx));
});

test('5.21: online screens are translated, the app may reach the relays, and the code ships offline', () => {
  const store = { 'stick-kingdom-settings-v1': JSON.stringify({ lang: 'en' }) };
  const ctx = vm.createContext({ console, Math, JSON, saveGame() {}, localStorage: { getItem: k => store[k] || null, setItem() {} }, navigator: { language: 'en' }, document: { body: null, addEventListener() {} }, window: {} });
  for (const f of ['settings', 'data', 'game', 'i18n']) vm.runInContext(read('js/' + f + '.js') + (f === 'settings' ? ';this.Settings=Settings;' : ''), ctx);
  const lv = vm.runInContext('MP.pvp.level', ctx);
  const lines = ['Bob 님이 들어왔습니다', '🌐 Bob 님을 기다리는 중… 3초', '🌐 대전 · vs Bob · 중계 끊김', '대전 전적 3승 / 5판', '방을 찾는 중… · 중계 0/3 (연결 중)',
    '⚔ 대전: 왼쪽이 나, 오른쪽이 상대 요새. 레벨은 모두 ' + lv + ' · 강화는 빼고 겨룹니다 (진화 형태는 내가 가진 대로). 성채 궁수 · 범위/공성 피해 감소 · 5분 뒤엔 두 성채가 함께 무너집니다.',
    '🤝 협동: 둘이 같은 성채를 지킵니다. 군자금 · 카드 · 왕명은 따로. 적이 ×' + G.MP.coop.enemyMul + ' 단단하고 요새가 ×' + G.MP.coop.fortMul + ' 두껍습니다. 내 레벨 · 강화 그대로. 전장: 15. 국경 초소',
    '판이 달라 함께할 수 없습니다 (방: 5.21.0 · 나: 5.20.0). 같은 버전으로 맞춰 주세요.', '항복하면 이 판은 집니다. 항복할까요?', '장기전 · 두 성채가 무너지기 시작합니다'];
  for (const s of lines) { const r = vm.runInContext('t(' + JSON.stringify(s) + ')', ctx); assert.ok(!/[가-힣]/.test(r), s + ' → ' + r); }
  const html = read('index.html');
  for (const m of html.slice(html.indexOf('id="modal-online"'), html.indexOf('id="mp-start"') + 60).matchAll(/>([^<>]*[가-힣][^<>]*)</g)) {
    const r = vm.runInContext('t(' + JSON.stringify(m[1].trim()) + ')', ctx); assert.ok(!/[가-힣]/.test(r), m[1] + ' → ' + r);
  }
  assert.ok(/android\.permission\.INTERNET/.test(read('android/app/src/main/AndroidManifest.xml')), 'the Android app needs the internet permission');
  assert.ok(read('sw.js').includes("'./js/online.js'"), 'offline cache lists online.js');
  assert.ok(html.indexOf('js/online.js') > html.indexOf('js/main.js'));
});

console.log(count + ' online checks passed');
