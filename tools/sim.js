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
function runStage(g, index, upLv, unitLv) {
  const academy = Math.min(5, Math.floor(upLv / 2));
  const cap = g.unitLevelCap(index, academy);
  const levels = {};
  g.UNITS.forEach(u => { levels[u.id] = Math.min(unitLv, cap); });

  const unlocked = g.ROSTER_UNITS.filter(u => u.unlockStage <= index + 1);
  const loadout = unlocked.slice()
    .sort((a, b) => b.cost - a.cost)
    .slice(0, g.LOADOUT_MAX)
    .map(u => u.id);

  const save = {
    cleared: index, coins: 0, levels: levels, loadout: loadout, stars: {}, owned: {},
    upgrades: {
      wallet: upLv, income: upLv, power: upLv, vitality: upLv, castle: upLv,
      logistics: upLv, treasury: upLv, spoils: upLv,
      academy: academy, command: Math.min(5, Math.floor(upLv / 2))
    }
  };

  const b = new g.Battle(index, save);
  const dt = 1 / 30;
  let t = 0;
  while (b.state === 'play' && t < 420) {
    for (const u of b.roster) if (b.canDeploy(u.id)) b.deploy(u.id);
    if (b.canCommand() && b.allies.length > 4) b.useCommand();
    b.update(dt);
    t += dt;
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

function runAll(upLv, unitLv, seed) {
  const g = loadEngine(seed);
  const rows = [];
  for (let i = 0; i < g.STAGES.length; i++) rows.push(runStage(g, i, upLv, unitLv));
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
const EXPECT = [
  { up: 0, lv: 1, min: 8,  max: 17, label: '무강화' },
  { up: 2, lv: 3, min: 15, max: 20, label: '중반 강화' },
  { up: 3, lv: 5, min: 20, max: 20, label: '충분한 강화' }
];

function check() {
  let failed = 0;
  EXPECT.forEach(e => {
    const rows = runAll(e.up, e.lv, 12345);
    const wins = printTable(rows, e.up, e.lv);
    const slow = rows.filter(r => r.win && r.seconds > 360);
    if (wins < e.min || wins > e.max) {
      console.error(`  ✗ ${e.label}: ${wins}승은 기대 범위 ${e.min}~${e.max} 밖이다`);
      failed++;
    } else {
      console.log(`  ✓ ${e.label}: ${wins}승 (기대 ${e.min}~${e.max})`);
    }
    if (slow.length) {
      console.error(`  ✗ ${e.label}: 6분을 넘긴 전장 ${slow.map(r => r.stage).join(', ')}`);
      failed++;
    }
  });
  if (failed) {
    console.error(`\n밸런스 검사 실패 (${failed}건)\n`);
    process.exit(1);
  }
  console.log('\n밸런스 검사 통과\n');
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  check();
} else {
  const upLv = parseInt(args[0] || '0', 10);
  const unitLv = parseInt(args[1] || '1', 10);
  printTable(runAll(upLv, unitLv, 12345), upLv, unitLv);
}
