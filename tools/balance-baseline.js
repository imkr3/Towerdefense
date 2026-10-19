#!/usr/bin/env node
/* =======================================================================
 *  5.3 밸런스 기준표: 이미 있는 전장 · 하드코어 · 도전은 5.2 를 기준으로 그보다 어려워지지 않는다.
 *  난이도를 올리고 싶으면 새 전장 · 새 하드코어 · 새 도전을 만든다 (CLAUDE.md 의 규칙).
 *
 *  node tools/balance-baseline.js          지금 값이 기준표를 넘지 않는지 (회귀 검사도 같은 함수를 쓴다)
 *  node tools/balance-baseline.js --write  기준표를 지금 값으로 다시 쓴다 — 쉬워지는 쪽으로 고쳤을 때만
 *
 *  기준표에 있는 전장(앞 80곳) · 도전(앞 8곳)만 본다. 새로 더한 곳은 기준표에 없으니 자유롭다.
 * ======================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const FILE = path.join(__dirname, 'balance-baseline.json');

function load() {
  const ctx = vm.createContext({ console, Math, JSON, saveGame() {} });
  for (const f of ['data', 'game']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/' + f + '.js'), 'utf8'), ctx);
  return vm.runInContext('({STAGES, EVENT_STAGES, ENEMIES, HARDCORE, AWAKEN_TAX, EVENT_BOSS_HP, hardcoreEnemyMul, hardcoreFortHp, hardcoreMods})', ctx);
}
const spawns = st => (st.waves || []).reduce((n, w) => n + (w.n || w.count || 1), 0);
const enemyIds = st => [...new Set((st.waves || []).map(w => w.id || w.type || w.e).filter(Boolean))].sort();

/* 클수록 어려운 값들 (castle 은 작을수록 어려워 뒤집어 둔다) */
function measure(G, nStages, nEvents) {
  const H = G.HARDCORE, out = { global: {}, stages: [], events: [], enemies: {} };
  for (const k of ['enemyMul', 'fortMul', 'cmdMul', 'stunResist', 'charmResist', 'mulFloor', 'fortFloor', 'soft', 'sally', 'minRatio']) if (typeof H[k] === 'number') out.global['hc.' + k] = k === 'cmdMul' ? H[k] : H[k];
  out.global['hc.castleInv'] = 1 / H.castleMul;
  out.global['hc.boss.hp'] = H.boss.hp; out.global['hc.boss.atk'] = H.boss.atk;
  out.global['hc.fury.per30'] = H.fury.per30; out.global['hc.fury.max'] = H.fury.max;
  out.global.awakenTax = G.AWAKEN_TAX; out.global.eventBossHp = G.EVENT_BOSS_HP;
  const ids = new Set();
  G.STAGES.slice(0, nStages).forEach((st, i) => {
    enemyIds(st).forEach(id => ids.add(id)); if (st.bossId) ids.add(st.bossId);
    out.stages.push({
      n: i + 1, name: st.name, enemyMul: st.enemyMul || 1, baseHp: st.baseHp, spawns: spawns(st),
      bossHp: (st.bossMul && st.bossMul.hp) || 1, bossAtk: (st.bossMul && st.bossMul.atk) || 1, mods: (st.mods || []).slice().sort(),
      hcMul: G.hardcoreEnemyMul(st), hcFort: G.hardcoreFortHp(st), hcBoss: st.hardBoss || 1, hcMods: G.hardcoreMods(st, i).slice().sort()
    });
  });
  G.EVENT_STAGES.slice(0, nEvents).forEach((st, k) => {
    enemyIds(st).forEach(id => ids.add(id));
    out.events.push({ n: k + 1, id: st.event.id, enemyMul: st.enemyMul || 1, baseHp: st.baseHp, spawns: spawns(st),
      bossHp: (st.bossMul && st.bossMul.hp) || 1, bossAtk: (st.bossMul && st.bossMul.atk) || 1, mods: (st.mods || []).slice().sort() });
  });
  for (const id of [...ids].sort()) { const e = G.ENEMIES[id]; if (e) out.enemies[id] = { hp: e.hp, atk: e.atk, speed: e.speed }; }
  return out;
}

/* 지금 값이 기준표보다 어려워진 곳 (빈 배열이면 통과) */
function compare(base, now) {
  const bad = [], eps = 1e-9;
  const num = (where, k, b, v) => { if (typeof b === 'number' && typeof v === 'number' && v > b * (1 + eps) + eps) bad.push(`${where} ${k}: ${b} → ${v}`); };
  const sub = (where, k, b, v) => { const extra = (v || []).filter(m => !(b || []).includes(m)); if (extra.length) bad.push(`${where} ${k}: +${extra.join(',')}`); };
  for (const k in base.global) num('전역', k, base.global[k], now.global[k]);
  base.stages.forEach((b, i) => { const v = now.stages[i];
    if (!v) { bad.push(`전장 ${b.n} 이 사라졌다`); return; }
    for (const k of ['enemyMul', 'baseHp', 'spawns', 'bossHp', 'bossAtk', 'hcMul', 'hcFort', 'hcBoss']) num(`전장 ${b.n}`, k, b[k], v[k]);
    sub(`전장 ${b.n}`, 'mods', b.mods, v.mods); sub(`전장 ${b.n}`, 'hcMods', b.hcMods, v.hcMods); });
  base.events.forEach((b, i) => { const v = now.events[i];
    if (!v) { bad.push(`도전 ${b.n} 이 사라졌다`); return; }
    for (const k of ['enemyMul', 'baseHp', 'spawns', 'bossHp', 'bossAtk']) num(`도전 ${b.n}`, k, b[k], v[k]);
    sub(`도전 ${b.n}`, 'mods', b.mods, v.mods); });
  for (const id in base.enemies) { const b = base.enemies[id], v = now.enemies[id];
    if (!v) continue;
    for (const k of ['hp', 'atk', 'speed']) num(`적 ${id}`, k, b[k], v[k]); }
  return bad;
}

function check() {
  const base = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  return compare(base, measure(load(), base.stages.length, base.events.length));
}

module.exports = { check, measure, compare, load };

if (require.main === module) {
  if (process.argv[2] === '--write') {
    const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
    const now = measure(load(), old ? old.stages.length : 80, old ? old.events.length : 8);
    if (old) { const bad = compare(old, now); if (bad.length) { console.error('기준표보다 어려워진 곳이 있어 다시 쓰지 않는다:\n  ' + bad.join('\n  ')); process.exit(1); } }
    now.note = '5.2 기준 — 이 전장 · 도전은 이보다 어려워지지 않는다. 쉬워지는 쪽으로만 다시 쓴다 (--write).';
    fs.writeFileSync(FILE, JSON.stringify(now, null, 1) + '\n');
    console.log('기준표를 썼다: 전장 ' + now.stages.length + ' · 도전 ' + now.events.length + ' · 적 ' + Object.keys(now.enemies).length);
  } else {
    const bad = check();
    if (bad.length) { console.error('✗ 기준(5.2)보다 어려워진 곳:\n  ' + bad.join('\n  ')); process.exit(1); }
    console.log('✓ 기존 전장 · 하드코어 · 도전이 5.2 기준보다 어렵지 않다');
  }
}
