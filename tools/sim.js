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
    '({Battle, STAGES, UNITS, UNIT_BY_ID, ROSTER_UNITS, LOADOUT_MAX, HERO_SLOT_MAX, unitLevelCap, unitTrainCost, UPGRADES})',
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

/* 무지성 전설 편성: 전설·신화만 몽땅 넣는다. 한 명씩밖에 못 서니
 * 남는 칸은 영웅(SR)으로 채운다. 전장 병종은 하나도 없다. */
function legendLoadout(g) {
  const rank = { UR: 0, SSR: 1, SR: 2 };
  // 전설·신화는 편성에 HERO_SLOT_MAX 명까지. 남는 칸은 영웅(SR)으로 채운다.
  const sorted = g.UNITS
    .filter(u => u.gacha && rank[u.rarity] !== undefined)
    .sort((a, b) => (rank[a.rarity] - rank[b.rarity]) || (b.cost - a.cost));
  const heroes = sorted.filter(u => u.rarity !== 'SR').slice(0, g.HERO_SLOT_MAX);
  const rest = sorted.filter(u => u.rarity === 'SR');
  return heroes.concat(rest).slice(0, g.LOADOUT_MAX).map(u => u.id);
}

/* 조합 편성: 전장 병종으로 몸통을 세우고, 전설·신화는 역할에 맞는 셋만 얹는다.
 * 오딘(지휘) + 라(낙인)가 주력의 화력을 끌어올리고, 토르가 보스를 깬다. */
function comboLoadout(g, index) {
  // 전설·신화 다섯 칸을 역할로 채운다: 지휘(오딘) · 낙인(라) · 파쇄(토르) · 홀림(구미호) · 포탑(대발명가).
  // 몸통은 전장 병종 다섯. 잡몹이 다양해진 2.5 부터는 셋으로는 모자라 다섯을 다 쓴다.
  const roles = ['odin', 'ra', 'thor', 'gumiho', 'inventor'];
  const core = g.ROSTER_UNITS
    .filter(u => u.unlockStage <= index + 1)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, g.LOADOUT_MAX - roles.length)
    .map(u => u.id);
  return core.concat(roles).slice(0, g.LOADOUT_MAX);
}

/* 공략 편성: 전장 특성을 받아칠 병종을 먼저 챙기고 나머지는 전장 병종으로 채운다.
 * "특정 조합이면 풀린다" 를 재는 쪽이다. 소환 병종은 전부 가졌다고 본다. */
const COUNTERS = {
  ironclad: ['thor', 'venom', 'shield', 'pyro', 'rapriest', 'knight', 'ra'],
  horde:    ['zeus', 'frost', 'pyro', 'catapult', 'knight', 'shield', 'spear'],
  blitz:    ['shield', 'frostlancer', 'frost', 'skadi', 'spartan', 'colossus', 'medusa'],
  giantslayer: ['spear', 'shield', 'venom', 'catapult', 'sniper', 'pyro', 'musketeer', 'frost'],
  curse: ['knight', 'shield', 'spear', 'venom', 'pyro', 'frost']
};
function counterLoadout(g, index) {
  const st = g.STAGES[index];
  const hunted = (st.mods || []).includes('giantslayer');
  // 영웅 사냥꾼이 있으면 비싼 병종은 과녁일 뿐이다
  const ok = id => { const u = g.UNIT_BY_ID[id];
    return u && (u.gacha || u.unlockStage <= index + 1) && !(hunted && u.cost >= 350); };
  const picks = [];
  const mods = st.mods || [];
  // 특성마다 앞에서부터 번갈아 하나씩 — 두 특성이 겹치면 양쪽을 고루 챙긴다
  for (let k = 0; k < 7 && picks.length < g.LOADOUT_MAX; k++) {
    for (const m of mods) {
      const id = (COUNTERS[m] || [])[k];
      if (id && ok(id) && !picks.includes(id) && picks.length < g.LOADOUT_MAX) picks.push(id);
    }
  }
  const rest = g.ROSTER_UNITS.filter(u => u.unlockStage <= index + 1 && !picks.includes(u.id) && !(hunted && u.cost >= 350))
    .sort((a, b) => b.cost - a.cost).map(u => u.id);
  return picks.concat(rest).slice(0, g.LOADOUT_MAX);
}

function runStage(g, index, upLv, unitLv, trace, gacha, basic) {
  const academy = Math.min(5, Math.floor(upLv / 2));
  const cap = g.unitLevelCap(index, academy);
  const levels = {};
  g.UNITS.forEach(u => { levels[u.id] = Math.min(unitLv, cap); });

  const unlocked = g.ROSTER_UNITS.filter(u => u.unlockStage <= index + 1);
  const loadout = basic ? basicLoadout(g)
    : gacha === 'legend' ? legendLoadout(g)
    : (typeof gacha === 'string' && gacha.indexOf('trio:') === 0)
      ? unlocked.slice().sort((a, b) => b.cost - a.cost).slice(0, g.LOADOUT_MAX - gacha.slice(5).split('+').length).map(u => u.id).concat(gacha.slice(5).split('+'))
    : (typeof gacha === 'string' && gacha.indexOf('legend-') === 0)
      ? g.UNITS.filter(u => u.gacha && (u.rarity === 'UR' || u.rarity === 'SSR' || u.rarity === 'SR') && u.id !== gacha.slice(7))
          .sort((a, b) => ({ UR: 0, SSR: 1, SR: 2 }[a.rarity] - { UR: 0, SSR: 1, SR: 2 }[b.rarity]) || (b.cost - a.cost))
          .slice(0, g.LOADOUT_MAX).map(u => u.id)
    : gacha === 'combo' ? comboLoadout(g, index)
    : gacha === 'counter' ? counterLoadout(g, index)
    : (typeof gacha === 'string' && gacha.indexOf('with:') === 0)
      ? unlocked.slice().sort((a, b) => b.cost - a.cost).slice(0, g.LOADOUT_MAX - 1).map(u => u.id).concat([gacha.slice(5)])
    : gacha === 'smart' ? (g.STAGES[index].mods ? counterLoadout(g, index) : unlocked.slice()
        .sort((a, b) => b.cost - a.cost).slice(0, g.LOADOUT_MAX).map(u => u.id))
    : gacha ? gachaLoadout(g, index)
    : unlocked.slice()
      .sort((a, b) => b.cost - a.cost)
      .slice(0, g.LOADOUT_MAX)
      .map(u => u.id);
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
        '[' + b.allies.map(a => a.s.id).join(',').slice(0, 90) + '] ' +
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
  { up: 0, lv: 1, min: 3,  max: 8,  label: '무강화' },
  { up: 2, lv: 3, min: 7,  max: 12, label: '중반 강화' },
  { up: 3, lv: 5, min: 10, max: 15, label: '후반 강화' },
  // 편성을 생각하지 않고 비싼 병종만 채우면, 다 키워도 특성 전장에서 막힌다
  { up: 5, lv: 8, min: 13, max: 18, label: '완전 강화 (아무 편성)' }
];

/* 제대로 편성하는 플레이어: 특성 전장에는 그 특성을 받아칠 공략 편성을 든다.
 * 이 플레이어는 충분히 키웠을 때 캠페인을 거의 다, 2막을 전부 넘어야 한다. */
const SMART_ACT1 = { up: 6, lv: 10, min: 19 };
const SMART_ACT2 = { up: 8, lv: 12 };

/* 진짜 어려운 전장. 전설·신화를 다 가져도 몰아 넣기만 해서는 못 넘고,
 * 특성에 맞춘 공략 편성이라야 넘는다. HARD_SEEDS 판 중 이긴 횟수로 본다. */
const LEGEND_PROOF = [
  { stage: 18, up: 6, lv: 10 }, { stage: 20, up: 6, lv: 10 },
  { stage: 27, up: 8, lv: 12 }, { stage: 28, up: 8, lv: 12 }, { stage: 30, up: 8, lv: 12 }
];
/* 시즌마다 대표 셋. 어느 시즌을 뽑든 비슷한 값어치여야 한다. */
const SEASON_TRIOS = [
  ['hades', 'zeus', 'artemis'], ['odin', 'thor', 'valkyrie'], ['ra', 'anubis', 'pharaoh'],
  ['gumiho', 'saja', 'dokkaebi'], ['inventor', 'steammech', 'mechanic']
];
const SEASON_SPREAD = 2;
const LEGEND_PROOF_MAX = 1;      // 전설만 편성이 이길 수 있는 최대 판 수
const COUNTER_MIN = 4;           // 공략 편성이 이겨야 하는 최소 판 수

/* 전설·신화는 스탯이 아니라 역할로 값을 한다.
 * - 전설·신화만 몽땅 넣은 "무지성" 편성은 전장 병종 편성보다 LEGEND_GAP 이상 앞서면 안 된다
 * - 전장 병종으로 몸통을 세우고 역할에 맞게 얹은 "조합" 편성은 무지성 편성을 이겨야 한다 */
const LEGEND_GAP = 2;

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

  // 무지성 전설 편성 vs 조합 편성
  // 3/Lv5 는 1막 뒤쪽 벽에 세 편성이 모두 막혀 똑같이 13 이 나온다. 갈라지는 4/Lv6 에서 본다.
  [{ up: 2, lv: 3 }, { up: 4, lv: 6 }].forEach(e => {
    const base = runAll(e.up, e.lv, 12345, false, 20).filter(r => r.win).length;
    const legend = runAll(e.up, e.lv, 12345, 'legend', 20).filter(r => r.win).length;
    const combo = runAll(e.up, e.lv, 12345, 'combo', 20).filter(r => r.win).length;
    const tag = `(강화 ${e.up}/Lv${e.lv}) 전장 ${base} · 전설만 ${legend} · 조합 ${combo}`;
    if (legend - base > LEGEND_GAP) {
      console.error(`  ✗ 무지성 전설 편성이 너무 세다 ${tag} — 전장 편성보다 ${LEGEND_GAP} 넘게 앞선다`);
      failed++;
    } else if (combo <= legend) {
      console.error(`  ✗ 조합 편성이 무지성 전설 편성을 못 이긴다 ${tag}`);
      failed++;
    } else {
      console.log(`  ✓ 전설은 조합으로 산다 ${tag}`);
    }
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
  // 시즌끼리 격차: 시즌마다 대표 셋(신화·전설·영웅)을 전장 7 에 얹어 본다
  {
    const wins = SEASON_TRIOS.map(t => {
      const g = loadEngine(12345); let w = 0;
      for (let i = 0; i < 20; i++) w += runStage(g, i, 3, 5, false, 'trio:' + t.join('+')).win ? 1 : 0;
      return w;
    });
    const spread = Math.max(...wins) - Math.min(...wins);
    const tag = SEASON_TRIOS.map((t, i) => t[0] + ' ' + wins[i]).join(' · ');
    if (spread > SEASON_SPREAD) { console.error(`  ✗ 시즌 격차 ${spread} (최대 ${SEASON_SPREAD}): ${tag}`); failed++; }
    else console.log(`  ✓ 시즌 균형 (강화 3/Lv5) ${tag}`);
  }
  // 제대로 편성하는 플레이어는 충분히 키우면 넘는다
  {
    const g = loadEngine(12345), rows = [];
    for (let i = 0; i < 20; i++) rows.push(runStage(g, i, SMART_ACT1.up, SMART_ACT1.lv, false, 'smart'));
    const wins = printTable(rows, SMART_ACT1.up, SMART_ACT1.lv);
    if (wins < SMART_ACT1.min) { console.error(`  ✗ 공략 편성 캠페인: ${wins}/20 (최소 ${SMART_ACT1.min})`); failed++; }
    else console.log(`  ✓ 공략 편성 캠페인: ${wins}/20 (강화 ${SMART_ACT1.up}/Lv${SMART_ACT1.lv})`);
  }
  for (const seed of [12345, 98765]) {
    const g = loadEngine(seed), rows = [];
    for (let i = 20; i < g.STAGES.length; i++) rows.push(runStage(g, i, SMART_ACT2.up, SMART_ACT2.lv, false, 'smart'));
    printTable(rows, SMART_ACT2.up, SMART_ACT2.lv);
    if (rows.some(r => !r.win || r.seconds > 400)) { console.error('  ✗ 2막: 공략 편성으로 충분히 키우면 400초 안에 전부 넘어야 한다 (seed ' + seed + ')'); failed++; }
    else console.log('  ✓ 2막 공략 편성 완주 (seed ' + seed + ')');
  }
  // 진짜 어려운 전장은 전설·신화를 몰아 넣는 것만으로는 안 된다
  for (const h of LEGEND_PROOF) {
    const [r] = runHard(h.up, h.lv, 0, h.stage - 1, h.stage);
    const tag = `S${h.stage} ${r.mods} (강화 ${h.up}/Lv${h.lv}) 전설만 ${r.legend}/${HARD_SEEDS.length} · 공략 ${r.counter}/${HARD_SEEDS.length}`;
    if (r.legend > LEGEND_PROOF_MAX) { console.error(`  ✗ 전설만으로 넘어가 버린다 ${tag}`); failed++; }
    else if (r.counter < COUNTER_MIN) { console.error(`  ✗ 공략 편성으로도 못 넘는다 ${tag}`); failed++; }
    else console.log(`  ✓ 조합이 필요한 전장 ${tag}`);
  }
  if (failed) {
    console.error(`\n밸런스 검사 실패 (${failed}건)\n`);
    process.exit(1);
  }
  console.log('\n밸런스 검사 통과\n');
}

/* 특성이 붙은 어려운 전장만 골라, 세 편성으로 돌린다 */
const HARD_SEEDS = [12345, 98765, 4242, 777, 31337];
function runHard(upLv, unitLv, seed, from, to) {
  const engines = HARD_SEEDS.map(sd => loadEngine(sd));
  const g0 = engines[0];
  const rows = [];
  for (let i = from; i < to; i++) {
    if (!g0.STAGES[i].mods) continue;
    const r = { stage: i + 1, name: g0.STAGES[i].name, mods: g0.STAGES[i].mods.join('+') };
    // 판마다 난수가 다르니 세 번씩 돌려 이긴 횟수를 센다
    const count = mode => engines.reduce((n, g) => n + (runStage(g, i, upLv, unitLv, false, mode).win ? 1 : 0), 0);
    r.base = count(false);
    r.legend = count('legend');
    r.counter = count('counter');
    rows.push(r);
  }
  return rows;
}
function printHard(rows, upLv, unitLv) {
  const n = HARD_SEEDS.length;
  console.log(`\n  어려운 전장 (강화 ${upLv} / Lv${unitLv})   이긴 횟수 / ${n}판: 전장편성 · 전설만 · 공략편성`);
  rows.forEach(r => console.log('  S' + String(r.stage).padStart(2) + '   ' +
    r.base + ' · ' + r.legend + ' · ' + r.counter + '   ' + r.mods.padEnd(26) + r.name));
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  check();
} else if (args[0] === '--tune') {
  // node tools/sim.js --tune <전장번호> <강화Lv> <병종Lv> <배율,배율,...>
  // 한 전장의 enemyMul 을 바꿔 가며 세 편성의 승수를 본다 (조율용)
  const i = parseInt(args[1], 10) - 1, upLv = +args[2], unitLv = +args[3];
  for (const m of args[4].split(',').map(Number)) {
    const engines = HARD_SEEDS.map(sd => { const g = loadEngine(sd); g.STAGES[i].enemyMul = m; return g; });
    const count = mode => engines.reduce((n, g) => n + (runStage(g, i, upLv, unitLv, false, mode).win ? 1 : 0), 0);
    console.log('  S' + (i + 1) + ' ×' + m + '   전장 ' + count(false) + ' · 전설만 ' + count('legend') + ' · 공략 ' + count('counter'));
  }
} else if (args[0] === '--smart') {
  // node tools/sim.js --smart [강화Lv] [병종Lv] [시작] [끝]
  // 특성 전장에는 공략 편성, 나머지는 전장 편성으로 — "제대로 하는 플레이어"
  const upLv = +(args[1] || 6), unitLv = +(args[2] || 10), from = +(args[3] || 0), to = +(args[4] || 20);
  const g = loadEngine(12345), rows = [];
  for (let i = from; i < to; i++) rows.push(runStage(g, i, upLv, unitLv, false, 'smart'));
  printTable(rows, upLv, unitLv);
} else if (args[0] === '--solo') {
  // node tools/sim.js --solo <강화> <Lv> id,id,...  전장 편성 9 + 그 병종 하나
  const upLv = +args[1], unitLv = +args[2];
  const base = runAll(upLv, unitLv, 12345, false, 20).filter(r => r.win).length;
  console.log('  전장 편성 ' + base);
  for (const id of args[3].split(',')) {
    const w = runAll(upLv, unitLv, 12345, 'with:' + id, 20).filter(r => r.win).length;
    console.log('  + ' + id.padEnd(14) + w + '  (' + (w - base >= 0 ? '+' : '') + (w - base) + ')');
  }
} else if (args[0] === '--minus') {
  // node tools/sim.js --minus <강화> <Lv> id,...  전설만 편성에서 하나씩 뺐을 때
  const upLv = +args[1], unitLv = +args[2];
  console.log('  전설만 ' + runAll(upLv, unitLv, 12345, 'legend', 20).filter(r => r.win).length);
  for (const id of args[3].split(','))
    console.log('  - ' + id.padEnd(12) + runAll(upLv, unitLv, 12345, 'legend-' + id, 20).filter(r => r.win).length);
} else if (args[0] === '--combo') {
  // node tools/sim.js --combo <강화> <Lv> a+b+c,d+e+f  전장 7 + 셋
  const upLv = +args[1], unitLv = +args[2];
  for (const trio of args[3].split(',')) {
    const g = loadEngine(12345); let w = 0;
    for (let i = 0; i < 20; i++) {
      const save0 = trio.split('+');
      w += runStage(g, i, upLv, unitLv, false, 'trio:' + save0.join('+')).win ? 1 : 0;
    }
    console.log('  ' + trio.padEnd(30) + w);
  }
} else if (args[0] === '--hard') {
  // node tools/sim.js --hard [강화Lv] [병종Lv]
  const upLv = parseInt(args[1] || '5', 10), unitLv = parseInt(args[2] || '8', 10);
  printHard(runHard(upLv, unitLv, 12345, 0, 20), upLv, unitLv);
  if (args[3]) { printHard(runHard(+args[3], +args[4], 12345, 0, 20), +args[3], +args[4]); }
  printHard(runHard(8, 12, 12345, 20, 30), 8, 12);
} else if (args[0] === '--legend') {
  // node tools/sim.js --legend [강화Lv] [병종Lv]
  // 전장 편성 / 무지성 전설 편성 / 조합 편성을 나란히 찍는다
  const upLv = parseInt(args[1] || '2', 10);
  const unitLv = parseInt(args[2] || '3', 10);
  console.log('\n  [전장 병종 편성]');
  printTable(runAll(upLv, unitLv, 12345, false, 20), upLv, unitLv);
  console.log('  [무지성 전설·신화 편성]');
  printTable(runAll(upLv, unitLv, 12345, 'legend', 20), upLv, unitLv);
  console.log('  [조합 편성: 전장 7 + 오딘·라·토르]');
  printTable(runAll(upLv, unitLv, 12345, 'combo', 20), upLv, unitLv);
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
  const mode = args[4] || false;                // legend | combo | counter
  for (let i = 0; i < stage; i++) runStage(g, i, upLv, unitLv);
  console.log(`\n  전장 ${stage + 1} 추적 (강화 ${upLv} / 병종 Lv${unitLv}${mode ? ' / ' + mode : ''})`);
  printTable([runStage(g, stage, upLv, unitLv, true, mode)], upLv, unitLv);
} else {
  const upLv = parseInt(args[0] || '0', 10);
  const unitLv = parseInt(args[1] || '1', 10);
  printTable(runAll(upLv, unitLv, 12345), upLv, unitLv);
}
