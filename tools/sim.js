#!/usr/bin/env node
/* =======================================================================
 *  막대 왕국 전쟁 - 전장 밸런스 시뮬레이터
 *
 *  브라우저 없이 전투 엔진만 돌려 20개 전장의 승패를 확인한다.
 *  난수를 고정하므로 같은 입력이면 항상 같은 결과가 나온다.
 *
 *    node tools/sim.js              기본 표 출력
 *    node tools/sim.js 2 3          병영 강화 2 / 병종 레벨 3 으로
 *    node tools/sim.js --check      기대 곡선을 벗어나면 실패로 종료
 * ======================================================================= */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/* 고정 난수 (mulberry32) - CI 에서 결과가 흔들리지 않게 */
function makeRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadEngine(seed) {
  const seededMath = Object.create(Math);
  seededMath.random = makeRandom(seed);
  const ctx = {
    console: console,
    JSON: JSON,
    Math: seededMath,
    performance: { now: () => Date.now() },
    saveGame: () => {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['js/data.js', 'js/game.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return vm.runInContext(
    '({Battle, STAGES, UNITS, ROSTER_UNITS, LOADOUT_MAX, unitLevelCap, unitTrainCost, UPGRADES})',
    ctx);
}

/* 한 전장을 자동 전투로 돌린다. 카드는 나오는 대로 전부 낸다. */
/* 소환으로 최상급만 뽑아낸 편성. "좋은 애 뽑으면 그냥 깨진다"를 재어 본다. */
function gachaLoadout(g, index) {
  const rank = { UR: -1, SSR: 0, SR: 1, R: 2, N: 3 };
  const pulled = g.UNITS
    .filter(u => u.gacha)
    .sort((a, b) => (rank[a.rarity] - rank[b.rarity]) || (b.cost - a.cost));
  const front = g.ROSTER_UNITS
    .filter(u => u.unlockStage <= index + 1)
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 2);                       // 값싼 벽 둘은 남겨 둔다
  return front.concat(pulled).slice(0, g.LOADOUT_MAX).map(u => u.id);
}

/* 갓 시작한 플레이어. BASIC_STAGES 까지 해금되는 기본 병종만 손에 쥐고 있다.
 * 뒤 전장을 돌릴 때도 이 편성을 그대로 들려 보내야 제약이 된다. */
function basicLoadout(g) {
  return g.ROSTER_UNITS
    .filter(u => u.unlockStage <= BASIC_STAGES)
    .slice(0, g.LOADOUT_MAX)
    .map(u => u.id);
}

function runStage(g, index, upLv, unitLv, trace, gacha, basic) {
  const academy = Math.min(5, Math.floor(upLv / 2));
  const cap = g.unitLevelCap(index, academy);
  const levels = {};
  g.UNITS.forEach(u => { levels[u.id] = Math.min(unitLv, cap); });

  const unlocked = g.ROSTER_UNITS.filter(u => u.unlockStage <= index + 1);
  const loadout = basic ? basicLoadout(g) : (gacha ? gachaLoadout(g, index) : unlocked.slice()
    .sort((a, b) => b.cost - a.cost)
    .slice(0, g.LOADOUT_MAX)
    .map(u => u.id));
  const owned = {};
  if (gacha) g.UNITS.forEach(u => { if (u.gacha) owned[u.id] = 1; });

  const save = {
    cleared: index, coins: 0, levels: levels, loadout: loadout, stars: {}, owned: owned,
    upgrades: {
      wallet: upLv, income: upLv, power: upLv, vitality: upLv, castle: upLv,
      logistics: upLv, treasury: upLv, spoils: upLv,
      medicine: Math.min(5,upLv), resistance: Math.min(5,upLv), deployment: Math.min(5,upLv),
      academy: academy, command: Math.min(5, Math.floor(upLv / 2))
    }
  };

  const b = new g.Battle(index, save);
  const dt = 1 / 30;
  let t = 0, nextLog = 20;
  while (b.state === 'play' && t < 420) {
    for (const u of b.roster) if (b.canDeploy(u.id)) b.deploy(u.id);
    if (b.canCommand() && b.allies.length > 4) b.useCommand();
    for(const u of b.roster) if(u.active && b.canHeroActive(u.id)) b.useHeroActive(u.id);
    b.update(dt);
    t += dt;
    if (trace && t >= nextLog) {                 // --trace: 20초마다 전황을 찍는다
      nextLog += 20;
      const cnt = {};
      b.enemies.forEach(e => { cnt[e.s.name] = (cnt[e.s.name] || 0) + 1; });
      console.log('    ' + String(Math.round(t)).padStart(3) + '초  아군성 ' +
        String(Math.round(b.allyCastle.hp / b.allyCastle.maxHp * 100)).padStart(3) + '%  적성 ' +
        String(Math.round(b.enemyCastle.hp / b.enemyCastle.maxHp * 100)).padStart(3) + '%  ' +
        '아군 ' + String(b.allies.length).padStart(2) + '  적 ' +
        String(b.enemies.length).padStart(2) + '  ' +
        Object.keys(cnt).map(k => k + '×' + cnt[k]).join(' '));
    }
  }
  return {
    stage: index + 1,
    name: g.STAGES[index].name,
    win: b.state === 'win',
    seconds: Math.round(t),
    coins: b.coins,
    kills: b.kills,
    castle: Math.round(b.allyCastle.hp / b.allyCastle.maxHp * 100)
  };
}

function runAll(upLv, unitLv, seed, gacha, limit) {
  const g = loadEngine(seed);
  const rows = [];
  for (let i = 0; i < (limit || g.STAGES.length); i++) rows.push(runStage(g, i, upLv, unitLv, false, gacha));
  return rows;
}

/* 기본 병종만으로 앞 전장들을 어디까지 미는지 */
function runBasic(stages, seed) {
  const g = loadEngine(seed);
  const n = Math.max(1, Math.min(stages, g.STAGES.length));
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(runStage(g, i, 0, 1, false, false, true));
  return rows;
}

function printTable(rows, upLv, unitLv) {
  console.log(`\n  병영 강화 Lv${upLv} / 병종 Lv${unitLv}`);
  console.log('  ' + '-'.repeat(58));
  rows.forEach(r => {
    console.log('  ' +
      ('S' + String(r.stage).padStart(2)) + '  ' +
      (r.win ? '승리' : '패배') + '  ' +
      String(r.seconds).padStart(3) + '초  ' +
      ('성채 ' + String(r.castle).padStart(3) + '%') + '  ' +
      ('처치 ' + String(r.kills).padStart(3)) + '  ' + r.name);
  });
  const wins = rows.filter(r => r.win).length;
  console.log('  ' + '-'.repeat(58));
  console.log(`  결과: ${wins} / ${rows.length} 승리\n`);
  return wins;
}

/* 기대하는 난이도 곡선. 크게 벗어나면 밸런스가 깨진 것으로 본다. */
/* 기대하는 난이도 곡선.
 * 기본 병종만으로 초반 전장은 밀 수 있어야 하고, 보스 전장부터는
 * 병영 강화 없이 넘지 못해야 한다. */
const EXPECT = [
  { up: 0, lv: 1, min: 4,  max: 11, label: '무강화' },
  { up: 2, lv: 3, min: 9,  max: 16, label: '중반 강화' },
  { up: 3, lv: 5, min: 13, max: 19, label: '후반 강화' },
  { up: 5, lv: 8, min: 20, max: 20, label: '완전 강화' }
];

/* 소환 병종은 특색으로 값을 해야지, 전장 진도를 건너뛰는 열쇠가 되면 안 된다.
 * 최상급만 뽑아 편성했을 때 전장 병종 편성과 이만큼 이상 벌어지면 실패로 본다. */
const GACHA_GAP = 4;

/* 해금되는 기본 병종(창병·방패병·궁수)만으로 넘어야 하는 전장 수 */
const BASIC_STAGES = 3;

/* 2막(21~30전장)을 캠페인 완주 수준(강화5/Lv8)으로 돌파해도 되는 최대 개수.
 * 이걸 넘으면 2막이 자체 성장 구간 노릇을 못 한다. */
const EXT_ENTRY_MAX = 6;

function check() {
  let failed = 0;
  EXPECT.forEach(e => {
    const rows = runAll(e.up, e.lv, 12345, false, 20);
    const wins = printTable(rows, e.up, e.lv);
    const slow = rows.filter(r => r.win && r.seconds > 400);
    if (wins < e.min || wins > e.max) {
      console.error(`  ✗ ${e.label}: ${wins}승은 기대 범위 ${e.min}~${e.max} 밖이다`);
      failed++;
    } else {
      console.log(`  ✓ ${e.label}: ${wins}승 (기대 ${e.min}~${e.max})`);
    }
    if (slow.length) {
      console.error(`  ✗ ${e.label}: 교착에 가까운 전장 ${slow.map(r => r.stage).join(', ')}`);
      failed++;
    }
  });
  // 갓 시작한 플레이어가 기본 병종만으로 3전장까지 갈 수 있어야 한다
  const basicRows = runBasic(BASIC_STAGES, 12345);
  basicRows.forEach(r => {
    const line = `기본 병종 ${r.stage}전장: ${r.win ? '승리' : '패배'} (${r.seconds}초, 성채 ${r.castle}%)`;
    if (r.win) console.log(`  ✓ ${line}`);
    else { console.error(`  ✗ ${line} — 강화 없이 넘을 수 있어야 한다`); failed++; }
  });

  // 소환 편성이 전장 편성을 얼마나 앞지르는지
  [{ up: 0, lv: 1 }, { up: 3, lv: 5 }].forEach(e => {
    const base = runAll(e.up, e.lv, 12345, false, 20).filter(r => r.win).length;
    const pulled = runAll(e.up, e.lv, 12345, true, 20).filter(r => r.win).length;
    const gap = pulled - base;
    const line = `소환 편성 격차 (강화 ${e.up}/Lv${e.lv}): 전장 ${base}승 vs 소환 ${pulled}승 = ${gap >= 0 ? '+' : ''}${gap}`;
    if (Math.abs(gap) > GACHA_GAP) {
      console.error(`  ✗ ${line} — ±${GACHA_GAP} 를 넘었다`);
      failed++;
    } else {
      console.log(`  ✓ ${line}`);
    }
  });

  // 2막은 캠페인을 막 끝낸 수준으로 "들어갈 수는" 있되 쓸어담지는 못해야 한다.
  const entryEngine=loadEngine(12345), entryRows=[];
  for(let i=20;i<entryEngine.STAGES.length;i++)entryRows.push(runStage(entryEngine,i,5,8,false,false));
  printTable(entryRows,5,8);
  if(!entryRows[0].win){console.error('  ✗ 21전장은 기존 캠페인 완주 강화 수준으로 진입 가능해야 함');failed++;}
  const entryWins=entryRows.filter(r=>r.win).length;
  if(entryWins>EXT_ENTRY_MAX){
    console.error(`  ✗ 2막이 너무 무르다: 캠페인 완주 수준으로 ${entryWins}/10 돌파 (최대 ${EXT_ENTRY_MAX})`);
    failed++;
  } else {
    console.log(`  ✓ 2막 진입 관문: 캠페인 완주 수준으로 ${entryWins}/10 돌파 (최대 ${EXT_ENTRY_MAX})`);
  }
  // Expansion has its own progression gate; original campaign thresholds stay unchanged.
  for(const seed of [12345,98765]) {
    const g=loadEngine(seed), rows=[];
    for(let i=20;i<g.STAGES.length;i++) rows.push(runStage(g,i,8,12,false,false));
    printTable(rows,8,12);
    if(rows.some(r=>!r.win || r.seconds>400)){console.error('  ✗ 확장 전장: 충분한 강화로 400초 내 돌파 필요 (seed '+seed+')');failed++;}
    else console.log('  ✓ 확장 전장 10개 완주 (seed '+seed+')');
  }
  if (failed) {
    console.error(`\n밸런스 검사 실패 (${failed}건)\n`);
    process.exit(1);
  }
  console.log('\n밸런스 검사 통과\n');
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  check();
} else if (args[0] === '--gacha') {
  // node tools/sim.js --gacha [강화Lv] [병종Lv]
  // 최상급 소환 병종만 편성했을 때의 곡선. 전장 병종 편성과 나란히 찍는다.
  const upLv = parseInt(args[1] || '0', 10);
  const unitLv = parseInt(args[2] || '1', 10);
  console.log('\n  [전장 병종 편성]');
  const base = printTable(runAll(upLv, unitLv, 12345, false), upLv, unitLv);
  console.log('  [최상급 소환 편성]');
  const pulled = printTable(runAll(upLv, unitLv, 12345, true), upLv, unitLv);
  console.log(`  차이: 소환 편성이 ${pulled - base >= 0 ? '+' : ''}${pulled - base} 전장\n`);
} else if (args[0] === '--basic') {
  // node tools/sim.js --basic [전장수]
  // 기본 병종(3전장까지 해금)만 들고 강화 없이 어디까지 가는지
  const stages = parseInt(args[1], 10) || BASIC_STAGES + 2;
  console.log('\n  기본 병종만 · 강화 없음');
  printTable(runBasic(stages, 12345), 0, 1);
} else if (args[0] === '--trace') {
  // node tools/sim.js --trace <전장번호> [강화Lv] [병종Lv]
  const stage = parseInt(args[1] || '20', 10) - 1;
  const upLv = parseInt(args[2] || '5', 10);
  const unitLv = parseInt(args[3] || '8', 10);
  const g = loadEngine(12345);
  // 난수는 한 판 안에서 이어진다. --check 와 같은 결과를 보려면
  // 앞 전장들을 먼저 돌려 난수 흐름을 같은 자리에 맞춰 두어야 한다.
  for (let i = 0; i < stage; i++) runStage(g, i, upLv, unitLv);
  console.log(`\n  전장 ${stage + 1} 추적 (강화 ${upLv} / 병종 Lv${unitLv})`);
  printTable([runStage(g, stage, upLv, unitLv, true)], upLv, unitLv);
} else {
  const upLv = parseInt(args[0] || '0', 10);
  const unitLv = parseInt(args[1] || '1', 10);
  printTable(runAll(upLv, unitLv, 12345), upLv, unitLv);
}
