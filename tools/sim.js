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
let SIM_HARD = false;             // --hardcore 로 켠다

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
    let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (process.env.SIM_PATCH) for (const kv of process.env.SIM_PATCH.split('||')) { const [a, b] = kv.split('=>'); if (src.includes(a)) src = src.split(a).join(b); }
    vm.runInContext(src, ctx, { filename: f });
  }
  return vm.runInContext(
    '({Battle, STAGES, EVENT_STAGES, EXPEDITIONS, MOD_COUNTERS, recommendDeck, UNITS, UNIT_BY_ID, ROSTER_UNITS, LOADOUT_MAX, HERO_SLOT_MAX, unitLevelCap, unitTrainCost, UPGRADES, EVO_LEVEL, EVOLUTIONS, EVOLUTIONS2})',
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
  // 3.0.2: 엄호 없는 원거리는 약해진다. 조합을 아는 플레이어답게 몸통에 근접 전열 둘은 꼭 넣는다.
  const pool = g.ROSTER_UNITS.filter(u => u.unlockStage <= index + 1).sort((a, b) => b.cost - a.cost);
  const n = g.LOADOUT_MAX - roles.length;
  const front = pool.filter(u => !u.ranged && !(u.ab && u.ab.noAttack)).slice(0, 2);
  const core = front.concat(pool.filter(u => !front.includes(u)).slice(0, n - front.length)).map(u => u.id);
  return core.concat(roles).slice(0, g.LOADOUT_MAX);
}

/* 공략 편성: 전장 특성을 받아칠 병종을 먼저 챙기고 나머지는 전장 병종으로 채운다.
 * "특정 조합이면 풀린다" 를 재는 쪽이다. 소환 병종은 전부 가졌다고 본다. */
const COUNTER_FRONT = 4;   // 공략 편성에 넣는 근접 전열 수 (3.2)
/* 특성별 대응 병종 표는 js/data.js 의 MOD_COUNTERS (게임의 추천 편성과 같은 표) */
function counterLoadout(g, index, stage) {
  const st = stage || g.STAGES[index];
  const hunted = (st.mods || []).includes('giantslayer');
  // 영웅 사냥꾼이 있으면 비싼 병종은 과녁일 뿐이다
  const ok = id => { const u = g.UNIT_BY_ID[id];
    return u && (u.gacha || u.unlockStage <= index + 1) && !(hunted && u.cost >= 350); };
  const picks = [];
  const mods = st.mods || [];
  // 특성마다 앞에서부터 번갈아 하나씩 — 두 특성이 겹치면 양쪽을 고루 챙긴다
  for (let k = 0; k < 7 && picks.length < g.LOADOUT_MAX; k++) {
    for (const m of mods) {
      const id = (g.MOD_COUNTERS[m] || [])[k];
      if (id && ok(id) && !picks.includes(id) && picks.length < g.LOADOUT_MAX) picks.push(id);
    }
  }
  const rest = g.ROSTER_UNITS.filter(u => u.unlockStage <= index + 1 && !picks.includes(u.id) && !(hunted && u.cost >= 350))
    .sort((a, b) => b.cost - a.cost).map(u => u.id);
  const deck = picks.concat(rest).slice(0, g.LOADOUT_MAX);
  // 3.0.2 엄호 규칙: 공략 편성도 근접 전열을 챙긴다 (원거리만 몰리면 엄호 없음)
  const melee = id => { const u = g.UNIT_BY_ID[id]; return u && !u.ranged && !(u.ab && u.ab.noAttack) && !(u.ab && u.ab.summon); };
  const front = rest.filter(melee);
  for (let k = deck.length - 1; deck.filter(melee).length < COUNTER_FRONT && front.length && k >= 0; k--) {
    if (melee(deck[k])) continue;
    deck[k] = front.shift();
  }
  return deck;
}

/* 원거리만 / 근접만 몰아 넣은 편성 (소환 병종 포함, 전설·신화 5명까지). "원거리 도배" 를 잰다. */
function styleLoadout(g, index, ranged, campaignOnly) {
  const ok = u => u.cost > 0 && (campaignOnly ? u.unlockStage <= index + 1 : (u.gacha || u.unlockStage <= index + 1)) &&
    !!u.ranged === ranged && !(u.ab && u.ab.noAttack) && !(campaignOnly && u.ab && u.ab.summon);
  const list = g.UNITS.filter(ok).sort((a, b) => b.cost - a.cost);
  let heroes = 0;
  return list.filter(u => !(u.rarity === 'SSR' || u.rarity === 'UR') || ++heroes <= g.HERO_SLOT_MAX).slice(0, g.LOADOUT_MAX).map(u => u.id);
}

/* opt.event: 이벤트 전장 번호 (EVENT_STAGES). opt.timed: 타이밍을 맞추는 플레이어
 *  - 출진 지점에 포격이 곧 떨어지면 기다렸다가 내보낸다
 *  - 보스가 안개화·반사 결계 중이거나, 핵이 가려져 있으면 액티브를 아낀다
 *  - 핵 보스에겐 약점이 드러났을 때 왕명을 쓴다 */
function runStage(g, index, upLv, unitLv, trace, gacha, basic, opt) {
  opt = opt || {};
  const exStage = opt.expedition !== undefined ? g.EXPEDITIONS[opt.expedition] : null;   // 3.7 금화 원정
  const evStage = opt.event !== undefined ? g.EVENT_STAGES[opt.event] : exStage;
  if (exStage) index = exStage.expedition.unlock - 1;   // 원정: 열리는 시점의 병종으로
  else if (evStage) index = g.STAGES.length - 1;        // 이벤트: 캠페인을 다 연 상태로 본다
  const academy = Math.min(5, Math.floor(upLv / 2));
  const cap = g.unitLevelCap(index, academy);
  const levels = {};
  g.UNITS.forEach(u => { levels[u.id] = Math.min(unitLv, cap); });

  const unlocked = g.ROSTER_UNITS.filter(u => u.unlockStage <= index + 1);
  const loadout = Array.isArray(gacha) ? gacha.slice()      // 3.6: 편성을 직접 넘길 수도 있다
    : basic ? basicLoadout(g)
    : gacha === 'legend' ? legendLoadout(g)
    : (typeof gacha === 'string' && gacha.indexOf('trio:') === 0)
      ? unlocked.slice().sort((a, b) => b.cost - a.cost).slice(0, g.LOADOUT_MAX - gacha.slice(5).split('+').length).map(u => u.id).concat(gacha.slice(5).split('+'))
    : (typeof gacha === 'string' && gacha.indexOf('legend-') === 0)
      ? g.UNITS.filter(u => u.gacha && (u.rarity === 'UR' || u.rarity === 'SSR' || u.rarity === 'SR') && u.id !== gacha.slice(7))
          .sort((a, b) => ({ UR: 0, SSR: 1, SR: 2 }[a.rarity] - { UR: 0, SSR: 1, SR: 2 }[b.rarity]) || (b.cost - a.cost))
          .slice(0, g.LOADOUT_MAX).map(u => u.id)
    : (typeof gacha === 'string' && gacha.indexOf('mono:') === 0) ? [gacha.slice(5)]
    : (gacha === 'ranged' || gacha === 'melee') ? styleLoadout(g, index, gacha === 'ranged')
    : gacha === 'rangedbase' ? styleLoadout(g, index, true, true)
    : gacha === 'combo' ? comboLoadout(g, index)
    : gacha === 'counter' ? (evStage ? evStage.event.deck.slice() : counterLoadout(g, index))
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

  // 레벨 10 을 넘긴 병종은 진화해 있다고 본다 (실제 플레이어도 그렇게 쓴다)
  const evo = {};
  if (!process.env.SIM_NOEVO && Math.min(unitLv, cap) >= g.EVO_LEVEL) g.UNITS.forEach(u => { if (g.EVOLUTIONS[u.id]) evo[u.id] = true; });
  // 4.1: 레벨 20 을 넘긴 전장 병종은 3진까지 마쳤다고 본다
  const evo2 = {};
  if (!process.env.SIM_NOEVO && !process.env.SIM_NOEVO2 && Math.min(unitLv, cap) >= 20) g.UNITS.forEach(u => { if (g.EVOLUTIONS2 && g.EVOLUTIONS2[u.id]) evo2[u.id] = true; });
  const save = {
    cleared: index, coins: 0, levels: levels, loadout: loadout, stars: {}, owned: owned, evo: evo, evo2: evo2,
    upgrades: {
      wallet: upLv, income: upLv, power: upLv, vitality: upLv, castle: upLv,
      logistics: upLv, treasury: upLv, spoils: upLv,
      medicine: Math.min(5,upLv), resistance: Math.min(5,upLv), deployment: Math.min(5,upLv),
      academy: academy, command: Math.min(5, Math.floor(upLv / 2))
    }
  };

  const b = evStage ? new g.Battle(g.STAGES.length + (exStage ? g.EVENT_STAGES.length + opt.expedition : opt.event), save, evStage)
                    : new g.Battle(index, save, null, { hard: !!SIM_HARD });
  const dt = 1 / 30;
  let t = 0, nextLog = 20;
  const timed = !!opt.timed;
  while (b.state === 'play' && t < 420) {
    let boss = null;
    if (timed) for (const e of b.enemies) if (e.boss && !e.dead) { boss = e; break; }
    const shelling = timed && b.pending.some(p => p.side === 'enemy' && p.t < 2.6 && Math.abs(p.x - b.allyCastle.x) < 520);
    const guarded = !!boss && (boss.veilT > 0 || boss.reflectT > 0 || (boss.ab.core && boss.exposedT <= 0));
    if (!shelling && !(boss && boss.veilT > 0)) for (const u of b.roster) if (b.autoWants(u.id)) b.deploy(u.id);   // 자동 출진과 같은 기준
    const cmdOk = !timed || !boss || (!(boss.reflectT > 0) && (!boss.ab.core || boss.exposedT > 0 || b.allyCastle.hp < b.allyCastle.maxHp * 0.4));
    if (b.canCommand() && b.allies.length > 4 && cmdOk && !shelling) b.useCommand();
    if (!guarded) for(const u of b.roster) if(u.active && b.canHeroActive(u.id)) b.useHeroActive(u.id);
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
    stage: exStage ? 'G' + (opt.expedition + 1) : evStage ? 'E' + (opt.event + 1) : index + 1,
    name: (evStage || g.STAGES[index]).name,
    win: b.state === 'win',
    seconds: Math.round(t),
    coins: b.coins, caught: b.caught || 0, fled: b.fled || 0,
    kills: b.kills,
    castle: Math.round(b.allyCastle.hp / b.allyCastle.maxHp * 100),
    foe: Math.round(b.enemyCastle.hp / b.enemyCastle.maxHp * 100)
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
  // 3.2: 1막이 억세진 만큼 같은 강화로 넘는 전장이 한둘 줄었다
  { up: 0, lv: 1, min: 2,  max: 7,  label: '무강화' },
  { up: 2, lv: 3, min: 6,  max: 11, label: '중반 강화' },
  { up: 3, lv: 5, min: 8,  max: 13, label: '후반 강화' },
  // 편성을 생각하지 않고 비싼 병종만 채우면, 다 키워도 특성 전장에서 막힌다
  { up: 5, lv: 8, min: 12, max: 17, label: '완전 강화 (아무 편성)' }
];

/* 제대로 편성하는 플레이어: 특성 전장에는 그 특성을 받아칠 공략 편성을 든다.
 * 이 플레이어는 충분히 키웠을 때 캠페인을 거의 다, 2막을 전부 넘어야 한다. */
const SMART_ACT1 = { up: 7, lv: 11, min: 19 };   // 3.2: 6/Lv10 → 7/Lv11
const SMART_ACT2 = { up: 10, lv: 14 };   // 3.1: 2막은 격앙·보스 격노로 한 단계 더 키워야 다 넘는다

/* 진짜 어려운 전장. 전설·신화를 다 가져도 몰아 넣기만 해서는 못 넘고,
 * 특성에 맞춘 공략 편성이라야 넘는다. HARD_SEEDS 판 중 이긴 횟수로 본다. */
const LEGEND_PROOF = [
  { stage: 18, up: 7, lv: 11 }, { stage: 20, up: 7, lv: 11 },
  // 3.4: S28(물량+중갑)은 뺐다. 영웅의 공격력이 갑주를 뚫는 건 이제 의도한 몫이다
  { stage: 27, up: 9, lv: 13 }, { stage: 30, up: 9, lv: 13 },
  // 3.3 3막의 조합 전장
  { stage: 38, up: 10, lv: 18 }, { stage: 39, up: 10, lv: 18 }
];
/* 시즌마다 대표 셋. 어느 시즌을 뽑든 비슷한 값어치여야 한다. */
const SEASON_TRIOS = [
  ['hades', 'zeus', 'artemis'], ['odin', 'thor', 'valkyrie'], ['ra', 'anubis', 'pharaoh'],
  ['gumiho', 'saja', 'dokkaebi'], ['inventor', 'steammech', 'mechanic'], ['wukong', 'nezha', 'bajie'],
  ['arthur', 'merlin', 'lancelot']
];
/* 3.0: 병종 하나만 들고 전장을 쓸어 담으면 안 된다 (메두사 하나로 30전장 중 18곳을 넘던 것).
 * 한 병종 편성으로 넘을 수 있는 전장 수 상한. 겹쳐 세우기 좋은 병종들로 잰다. */
const MONO_MAX = 12;
const MONO_SUSPECTS = ['medusa', 'catapult', 'mage', 'necro', 'rogue', 'engineer', 'colossus', 'paladin',
  'rapriest', 'wukong', 'bajie', 'lancer', 'monk', 'alchemist', 'falconer', 'javelin'];
const SEASON_SPREAD = 2;
/* 3.7 금화 원정: 열리는 무렵의 전력(강화/Lv)으로 이만큼은 이겨야 하고, 너무 쉽지도 않게.
 * 금화는 그 무렵 전장을 다시 도는 것의 분당 1.5~2배쯤 (minRate~maxRate, 전장 편성 기준) */
const EXP_EXPECT = [
  { up: 2, lv: 5,  min: 4, minRate: 400, maxRate: 850 },
  { up: 5, lv: 9,  min: 4, minRate: 650, maxRate: 1400 },
  { up: 8, lv: 12, min: 4, minRate: 1800, maxRate: 3000 }
];
const EVENT_EXPECT = { up: 10, lv: 15, naiveMax: 4, timedMin: 6 };   // 이벤트 전장 기대치 (3.2) · 3.9: 판 10개 기준 (5판은 한두 판 운에 갈렸다)
/* 3.9: E3(망령 함대)는 '포격 뒤에 출진' 이 시뮬레이터에서 거의 차이를 못 낸다 — 포탄이 갓 나온 병사보다
 * 이미 선 뒷줄에 떨어지기 때문. 근접 영웅이 단단해진 뒤로는 판마다 운에 갈려, 타이밍 기준만 5/10 으로 둔다. */
const EVENT_TIMED_MIN = { 2: 5 };
const ACT3_ENTRY = { up: 10, lv: 14, min: 2, max: 5 };   // 3.3
const SMART_ACT3 = { up: 10, lv: 18 };
const ACT4_ENTRY = { up: 10, lv: 18, min: 2, max: 5 };   // 4.0: 3막을 끝낸 수준으론 앞 몇 곳만
const SMART_ACT4 = { up: 10, lv: 24 };                   // 4.0: 레벨 상한 20(+사관학교 5)까지 키우면 전부
const HARD_MODE = { up: 10, lv: 15, min: 12, max: 20, bossMax: 6 };   // 하드코어 기대치 (3.1)
const LEGEND_PROOF_MAX = 1;      // 전설만 편성이 이길 수 있는 최대 판 수
const COUNTER_MIN = 4;           // 공략 편성이 이겨야 하는 최소 판 수

/* 전설·신화는 스탯이 아니라 역할로 값을 한다.
 * - 전설·신화만 몽땅 넣은 "무지성" 편성은 전장 병종 편성보다 LEGEND_GAP 이상 앞서면 안 된다
 * - 전장 병종으로 몸통을 세우고 역할에 맞게 얹은 "조합" 편성은 무지성 편성을 이겨야 한다 */
const LEGEND_GAP = 4;   // 3.4: 전설·신화의 체급을 올렸다 — 몰아 넣은 편성이 보스 전장 몇 곳을 더 넘는 건 받아들인다

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
  [{ up: 5, lv: 7 }, { up: 7, lv: 10 }].forEach(e => {        // 3.2: 1막이 억세져 전설 쪽이 앞서는 낮은 구간은 빼고 본다
    const base = runAll(e.up, e.lv, 12345, false, 20).filter(r => r.win).length;
    const legend = runAll(e.up, e.lv, 12345, 'legend', 20).filter(r => r.win).length;
    const combo = runAll(e.up, e.lv, 12345, 'combo', 20).filter(r => r.win).length;
    const tag = `(강화 ${e.up}/Lv${e.lv}) 전장 ${base} · 전설만 ${legend} · 조합 ${combo}`;
    if (legend - base > LEGEND_GAP) {
      console.error(`  ✗ 무지성 전설 편성이 너무 세다 ${tag} — 전장 편성보다 ${LEGEND_GAP} 넘게 앞선다`);
      failed++;
    } else if (combo < legend) {                 // 3.4: 조합이 전설만 편성보다 못하지만 않으면 된다
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
  for(let i=20;i<30;i++)entryRows.push(runStage(entryEngine,i,5,8,false,false));
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
  // 병종 하나만으로 쓸어 담지 못한다
  const g0n = loadEngine(1).STAGES.length;
  {
    const worst = MONO_SUSPECTS.map(id => {
      const g = loadEngine(12345), u = g.UNIT_BY_ID[id]; let w = 0;
      for (let i = 0; i < g.STAGES.length; i++) {
        if (!u.gacha && u.unlockStage > i + 1) continue;
        if (runStage(g, i, 5, 10, false, 'mono:' + id).win) w++;
      }
      return [id, w];
    }).sort((a, b) => b[1] - a[1]);
    const tag = worst.slice(0, 4).map(([id, w]) => id + ' ' + w).join(' · ');
    if (worst[0][1] > MONO_MAX) { console.error(`  ✗ 병종 하나로 너무 많이 넘는다 (강화 5/Lv10): ${tag} (최대 ${MONO_MAX}/${g0n})`); failed++; }
    else console.log(`  ✓ 병종 하나로는 못 쓸어 담는다 (강화 5/Lv10): ${tag} (최대 ${MONO_MAX}/${g0n})`);
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
    for (let i = 20; i < 30; i++) rows.push(runStage(g, i, SMART_ACT2.up, SMART_ACT2.lv, false, 'smart'));
    printTable(rows, SMART_ACT2.up, SMART_ACT2.lv);
    if (rows.some(r => !r.win || r.seconds > 400)) { console.error('  ✗ 2막: 공략 편성으로 충분히 키우면 400초 안에 전부 넘어야 한다 (seed ' + seed + ')'); failed++; }
    else console.log('  ✓ 2막 공략 편성 완주 (seed ' + seed + ')');
  }
  // 진짜 어려운 전장은 전설·신화를 몰아 넣는 것만으로는 안 된다
  for (const h of LEGEND_PROOF) {
    const [r] = runHard(h.up, h.lv, 0, h.stage - 1, h.stage);
    const tag = `S${h.stage} ${r.mods} (강화 ${h.up}/Lv${h.lv}) 전설만 ${r.legend}/${HARD_SEEDS.length} · 원거리만 ${r.ranged}/${HARD_SEEDS.length} · 공략 ${r.counter}/${HARD_SEEDS.length}`;
    if (r.legend > LEGEND_PROOF_MAX) { console.error(`  ✗ 전설만으로 넘어가 버린다 ${tag}`); failed++; }
    else if (r.ranged > LEGEND_PROOF_MAX) { console.error(`  ✗ 원거리만 몰아 넣어도 넘어가 버린다 ${tag} · 원거리만 ${r.ranged}`); failed++; }
    else if (r.counter < COUNTER_MIN) { console.error(`  ✗ 공략 편성으로도 못 넘는다 ${tag}`); failed++; }
    else console.log(`  ✓ 조합이 필요한 전장 ${tag}`);
  }
  // 3.3 3막: 2막을 막 끝낸 수준(10/Lv14)으론 앞 몇 곳만, 끝까지 키우면(10/Lv18) 전부
  {
    const g = loadEngine(12345); let w = 0;
    for (let i = 30; i < 40; i++) w += runStage(g, i, ACT3_ENTRY.up, ACT3_ENTRY.lv, false, 'smart').win ? 1 : 0;
    const tag = `3막 진입 (강화 ${ACT3_ENTRY.up}/Lv${ACT3_ENTRY.lv} 공략 편성) ${w}/10 (기대 ${ACT3_ENTRY.min}~${ACT3_ENTRY.max})`;
    if (w < ACT3_ENTRY.min || w > ACT3_ENTRY.max) { console.error('  ✗ ' + tag); failed++; } else console.log('  ✓ ' + tag);
  }
  for (const seed of [12345, 98765]) {
    const g = loadEngine(seed), rows = [];
    for (let i = 30; i < 40; i++) rows.push(runStage(g, i, SMART_ACT3.up, SMART_ACT3.lv, false, 'smart'));
    printTable(rows, SMART_ACT3.up, SMART_ACT3.lv);
    if (rows.some(r => !r.win || r.seconds > 400)) { console.error('  ✗ 3막: 끝까지 키운 공략 편성은 400초 안에 전부 넘어야 한다 (seed ' + seed + ')'); failed++; }
    else console.log('  ✓ 3막 공략 편성 완주 (seed ' + seed + ')');
  }
  // 4.0 4막 '천공 요새': 3막을 끝낸 수준(10/Lv18)으론 앞 몇 곳만, 새 상한까지 키우면(10/Lv24) 전부
  {
    const g = loadEngine(12345); let w = 0;
    for (let i = 40; i < 50; i++) w += runStage(g, i, ACT4_ENTRY.up, ACT4_ENTRY.lv, false, 'smart').win ? 1 : 0;
    const tag = `4막 진입 (강화 ${ACT4_ENTRY.up}/Lv${ACT4_ENTRY.lv} 공략 편성) ${w}/10 (기대 ${ACT4_ENTRY.min}~${ACT4_ENTRY.max})`;
    if (w < ACT4_ENTRY.min || w > ACT4_ENTRY.max) { console.error('  ✗ ' + tag); failed++; } else console.log('  ✓ ' + tag);
  }
  for (const seed of [12345, 98765]) {
    const g = loadEngine(seed), rows = [];
    for (let i = 40; i < 50; i++) rows.push(runStage(g, i, SMART_ACT4.up, SMART_ACT4.lv, false, 'smart'));
    printTable(rows, SMART_ACT4.up, SMART_ACT4.lv);
    if (rows.some(r => !r.win || r.seconds > 400)) { console.error('  ✗ 4막: 끝까지 키운 공략 편성은 400초 안에 전부 넘어야 한다 (seed ' + seed + ')'); failed++; }
    else console.log('  ✓ 4막 공략 편성 완주 (seed ' + seed + ')');
  }
  // 3.1: 하드코어는 확실히 어렵다. 다 키운 공략 편성으로도 절반 남짓, 보스 전장은 대부분 막힌다.
  {
    SIM_HARD = true;
    const g = loadEngine(12345), rows = [];
    for (let i = 0; i < g.STAGES.length; i++) rows.push(runStage(g, i, HARD_MODE.up, HARD_MODE.lv, false, 'smart'));
    SIM_HARD = false;
    const wins = rows.filter(r => r.win).length;
    const bossWins = rows.filter(r => r.win && g.STAGES[r.stage - 1].boss).length;
    const bosses = rows.filter(r => g.STAGES[r.stage - 1].boss).length;
    const tag = `하드코어 (강화 ${HARD_MODE.up}/Lv${HARD_MODE.lv} 공략 편성) ${wins}/${g.STAGES.length} · 보스 전장 ${bossWins}/${bosses}`;
    if (wins < HARD_MODE.min || wins > HARD_MODE.max) { console.error(`  ✗ ${tag} — 기대 ${HARD_MODE.min}~${HARD_MODE.max}`); failed++; }
    else if (bossWins > HARD_MODE.bossMax) { console.error(`  ✗ ${tag} — 보스 전장이 너무 쉽다 (최대 ${HARD_MODE.bossMax})`); failed++; }
    else console.log(`  ✓ ${tag}`);
  }
  // 3.2 이벤트 전장: 공략 편성을 나오는 대로 내면 절반도 못 이기고, 타이밍을 맞춰야 넘는다
  for (let k = 0; k < 5; k++) {
    const r = runEvent(k, EVENT_EXPECT.up, EVENT_EXPECT.lv);
    const tag = `이벤트 E${k + 1} (강화 ${EVENT_EXPECT.up}/Lv${EVENT_EXPECT.lv}) 공략 ${r.naive}/${EVENT_SEEDS.length} · 타이밍 ${r.timed}/${EVENT_SEEDS.length} · 전설만 ${r.legend}/${EVENT_SEEDS.length}`;
    if (r.naive > EVENT_EXPECT.naiveMax) { console.error(`  ✗ ${tag} — 공략 편성을 막 내도 넘는다 (최대 ${EVENT_EXPECT.naiveMax})`); failed++; }
    else if (r.timed < (EVENT_TIMED_MIN[k] || EVENT_EXPECT.timedMin)) { console.error(`  ✗ ${tag} — 타이밍을 맞춰도 못 넘는다 (최소 ${EVENT_TIMED_MIN[k] || EVENT_EXPECT.timedMin})`); failed++; }
    else console.log(`  ✓ ${tag}`);
  }
  // 3.7 금화 원정: 열리는 무렵 전력이면 거의 늘 이기고, 금화는 그 무렵 전장을 다시 도는 것보다 낫되 지나치지 않게
  for (let k = 0; k < EXP_EXPECT.length; k++) {
    const X = EXP_EXPECT[k];
    let w = 0, coins = 0, sec = 0;
    for (const sd of HARD_SEEDS) { const r = runStage(loadEngine(sd), 0, X.up, X.lv, false, false, false, { expedition: k }); w += r.win ? 1 : 0; coins += r.coins; sec += r.seconds; }
    const rate = Math.round(coins / sec * 60);
    const tag = `금화 원정 G${k + 1} (강화 ${X.up}/Lv${X.lv}) ${w}/${HARD_SEEDS.length}승 · 분당 금화 ${rate}`;
    if (w < X.min) { console.error(`  ✗ ${tag} — 열리는 무렵 전력으로 너무 자주 진다 (최소 ${X.min})`); failed++; }
    else if (rate < X.minRate || rate > X.maxRate) { console.error(`  ✗ ${tag} — 금화가 기대(${X.minRate}~${X.maxRate})를 벗어남`); failed++; }
    else console.log(`  ✓ ${tag}`);
  }
  if (failed) {
    console.error(`\n밸런스 검사 실패 (${failed}건)\n`);
    process.exit(1);
  }
  console.log('\n밸런스 검사 통과\n');
}

/* 특성이 붙은 어려운 전장만 골라, 세 편성으로 돌린다 */
const HARD_SEEDS = [12345, 98765, 4242, 777, 31337];
const EVENT_SEEDS = HARD_SEEDS.concat([2024, 555, 8080, 1357, 90210]);   // 3.9: 이벤트 검사는 10판
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
    r.ranged = count('ranged');
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

/* 이벤트 전장: 판마다 세 방식 — 공략 편성을 나오는 대로 / 공략 편성을 타이밍 맞춰 */
function runEvent(k, upLv, unitLv, seeds, tweak) {
  const r = { naive: 0, timed: 0, legend: 0 };
  const eng = sd => { const g = loadEngine(sd); if (tweak) tweak(g.EVENT_STAGES[k]); return g; };
  for (const sd of seeds || EVENT_SEEDS) {
    r.naive += runStage(eng(sd), 0, upLv, unitLv, false, 'counter', false, { event: k }).win ? 1 : 0;
    r.timed += runStage(eng(sd), 0, upLv, unitLv, false, 'counter', false, { event: k, timed: true }).win ? 1 : 0;
    if (!tweak) r.legend += runStage(eng(sd), 0, upLv, unitLv, false, 'legend', false, { event: k, timed: true }).win ? 1 : 0;
  }
  return r;
}

const args = process.argv.slice(2);
if (args[0] === '--event') {
  // node tools/sim.js --event [강화] [Lv] [번호,...]   이벤트 전장 승수 (공략·타이밍·전설만)
  const upLv = +(args[1] || 10), unitLv = +(args[2] || 15);
  const ks = args[3] ? args[3].split(',').map(Number) : [0, 1, 2, 3, 4];
  const g = loadEngine(12345);
  for (const k of ks) {
    const r = runEvent(k, upLv, unitLv);
    console.log('  E' + (k + 1) + ' ' + g.EVENT_STAGES[k].name.padEnd(8) + '  공략 ' + r.naive + '/' + EVENT_SEEDS.length + ' · 타이밍 ' + r.timed + '/' + EVENT_SEEDS.length + ' · 전설만(타이밍) ' + r.legend + '/' + EVENT_SEEDS.length);
  }
} else if (args[0] === '--etune') {
  // node tools/sim.js --etune <번호> <강화> <Lv> <배율,...> [보스체력배,...]
  const k = +args[1] - 1, upLv = +args[2], unitLv = +args[3];
  const hs = args[5] ? args[5].split(',').map(Number) : [null];
  for (const m of args[4].split(',').map(Number)) for (const h of hs) {
    const r = runEvent(k, upLv, unitLv, null, st => { st.enemyMul = m; if (h) st.bossMul = Object.assign({}, st.bossMul, { hp: h }); });
    console.log('  E' + (k + 1) + ' ×' + m + (h ? ' 보스×' + h : '') + '   공략 ' + r.naive + '/' + EVENT_SEEDS.length + ' · 타이밍 ' + r.timed + '/' + EVENT_SEEDS.length);
  }
} else if (args[0] === '--etrace') {
  // node tools/sim.js --etrace <번호> [강화] [Lv] [편성] [timed]
  const k = +args[1] - 1, upLv = +(args[2] || 10), unitLv = +(args[3] || 15);
  const g = loadEngine(12345);
  printTable([runStage(g, 0, upLv, unitLv, true, args[4] || 'counter', false, { event: k, timed: args[5] === 'timed' })], upLv, unitLv);
} else if (args[0] === '--check') {
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
} else if (args[0] === '--units') {
  // node tools/sim.js --units [덱 수=60] [seed=1]
  // 3.6 병종 기여도: 전장 병종 37개에서 무작위 10개 편성을 뽑아 막별 전장 10곳에서 돌리고,
  // 그 병종이 든 판의 승률이 전장 평균보다 얼마나 높은지(%p)를 본다. 시너지까지 함께 잰다.
  const N = +(args[1] || 60), seed0 = +(args[2] || 1);
  let r = seed0 * 9301 + 49297; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const PTS = [[9,6,10],[13,6,10],[16,7,11],[18,7,11],[21,9,13],[24,9,13],[27,9,14],[32,10,16],[35,10,16],[38,10,17]];
  const g0 = loadEngine(1), roster = g0.ROSTER_UNITS.map(u => u.id), rows = [];
  for (let k = 0; k < N; k++) {
    const a = roster.slice(), deck = []; while (deck.length < 10) deck.push(a.splice(Math.floor(rnd() * a.length), 1)[0]);
    for (const [st, up, lv] of PTS) rows.push({ d: deck, s: st, w: runStage(loadEngine(seed0 * 1000 + k), st - 1, up, lv, false, deck.slice()).win ? 1 : 0 });
  }
  const avg = {}; for (const [st] of PTS) { const xs = rows.filter(x => x.s === st); avg[st] = xs.reduce((s, x) => s + x.w, 0) / xs.length; }
  const U = {}; for (const x of rows) for (const id of x.d) { const u = U[id] = U[id] || { n: 0, sum: 0 }; u.n++; u.sum += x.w - avg[x.s]; }
  const list = Object.keys(U).map(id => ({ id, n: U[id].n, d: U[id].sum / U[id].n * 100 })).sort((a, b) => b.d - a.d);
  console.log('  판 ' + rows.length + ' · 전장별 평균 승률 ' + PTS.map(([st]) => st + ':' + avg[st].toFixed(2)).join(' '));
  list.forEach(x => console.log('  ' + x.id.padEnd(13) + String(x.n).padStart(4) + '  ' + (x.d >= 0 ? '+' : '') + x.d.toFixed(1) + '%p'));
  const m = list.reduce((s, x) => s + x.d, 0) / list.length;
  console.log('  편차(표준편차) ' + Math.sqrt(list.reduce((s, x) => s + (x.d - m) ** 2, 0) / list.length).toFixed(2) + '%p');
} else if (args[0] === '--exp') {
  // node tools/sim.js --exp [강화] [Lv] [원정 번호,...]   3.7 금화 원정: 승수 · 금화 · 시간 · 잡은 수레 (전장 편성 / 공략 편성)
  const ks = args[3] ? args[3].split(',').map(n => +n - 1) : null;
  const g0 = loadEngine(1);
  for (let k = 0; k < g0.EXPEDITIONS.length; k++) {
    if (ks && !ks.includes(k)) continue;
    const ex = g0.EXPEDITIONS[k];
    const up = args[1] !== undefined ? +args[1] : EXP_EXPECT[k].up, lv = args[2] !== undefined ? +args[2] : EXP_EXPECT[k].lv;
    for (const mode of [false, 'smart']) {
      let w = 0, coins = 0, sec = 0, caught = 0, fled = 0;
      for (const sd of HARD_SEEDS) {
        const r = runStage(loadEngine(sd), 0, up, lv, false, mode, false, { expedition: k });
        w += r.win ? 1 : 0; coins += r.coins; sec += r.seconds; caught += r.caught; fled += r.fled;
      }
      const n = HARD_SEEDS.length;
      console.log('  G' + (k + 1) + ' ' + ex.name.padEnd(10) + ' (강화 ' + up + '/Lv' + lv + ') ' + (mode ? '공략' : '전장') + ' 편성  승 ' + w + '/' + n +
        ' · 금화 ' + Math.round(coins / n) + ' · ' + Math.round(sec / n) + '초 · 분당 ' + Math.round(coins / sec * 60) + ' · 수레 ' + caught + '/' + (caught + fled));
    }
  }
} else if (args[0] === '--solo') {
  // node tools/sim.js --solo <강화> <Lv> id,id,...  전장 편성 9 + 그 병종 하나
  const upLv = +args[1], unitLv = +args[2];
  const base = runAll(upLv, unitLv, 12345, false, 20).filter(r => r.win).length;
  console.log('  전장 편성 ' + base);
  for (const id of args[3].split(',')) {
    const w = runAll(upLv, unitLv, 12345, 'with:' + id, 20).filter(r => r.win).length;
    console.log('  + ' + id.padEnd(14) + w + '  (' + (w - base >= 0 ? '+' : '') + (w - base) + ')');
  }
} else if (args[0] === '--hardcore') {
  // node tools/sim.js --hardcore [강화Lv] [병종Lv] [시작] [끝]   공략 편성으로 하드코어
  SIM_HARD = true;
  const upLv = +(args[1] || 10), unitLv = +(args[2] || 15), from = +(args[3] || 0), to = +(args[4] || 30);
  const g = loadEngine(12345), rows = [];
  for (let i = from; i < to; i++) rows.push(runStage(g, i, upLv, unitLv, false, 'smart'));
  printTable(rows, upLv, unitLv);
} else if (args[0] === '--style') {
  // node tools/sim.js --style <강화> <Lv> [시작] [끝]   원거리만 · 근접만 · 공략 편성
  const upLv = +args[1], unitLv = +args[2], from = +(args[3] || 0), to = +(args[4] || 30);
  for (const mode of ['ranged', 'rangedbase', 'melee', 'smart']) {
    const g = loadEngine(12345), wins = [];
    for (let i = from; i < to; i++) if (runStage(g, i, upLv, unitLv, false, mode).win) wins.push(i + 1);
    console.log('  ' + mode.padEnd(10) + String(wins.length).padStart(2) + '  ' + wins.join(','));
  }
} else if (args[0] === '--modes') {
  // node tools/sim.js --modes <강화> <Lv> [편성,...] [시작] [끝]   편성별로 이긴 전장 (plain = 전장 편성)
  const upLv = +args[1], unitLv = +args[2], from = +(args[4] || 0), to = +(args[5] || 20);
  for (const mode of (args[3] || 'plain,legend,combo').split(',')) {
    const g = loadEngine(12345), wins = [], margin = [];
    for (let i = from; i < to; i++) {
      const r = runStage(g, i, upLv, unitLv, false, mode === 'plain' ? false : mode);
      if (r.win) wins.push(i + 1);
      margin.push((i + 1) + (r.win ? '+' + r.castle : '-' + r.foe));  // 이기면 남은 성채, 지면 남은 적 요새
    }
    console.log('  ' + mode.padEnd(10) + String(wins.length).padStart(2) + '  ' + wins.join(','));
    if (process.env.SIM_MARGIN) console.log('            ' + margin.join(' '));
  }
} else if (args[0] === '--mono') {
  // node tools/sim.js --mono <강화> <Lv> [id,...]  그 병종 하나만 들고 30전장
  const upLv = +args[1], unitLv = +args[2];
  const g0 = loadEngine(12345);
  const ids = args[3] ? args[3].split(',') : g0.UNITS.filter(u => u.cost > 0).map(u => u.id);
  const res = ids.map(id => {
    const g = loadEngine(12345); const wins = [], u = g.UNIT_BY_ID[id];
    for (let i = 0; i < g.STAGES.length; i++) {
      if (!u.gacha && u.unlockStage > i + 1) continue;          // 아직 해금 전: 편성이 통째로 바뀌므로 세지 않는다
      if (runStage(g, i, upLv, unitLv, false, 'mono:' + id).win) wins.push(i + 1);
    }
    return { id, n: wins.length, wins };
  }).sort((a, b) => b.n - a.n);
  res.forEach(r => console.log('  ' + r.id.padEnd(14) + String(r.n).padStart(2) + '  ' + r.wins.join(',')));
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
} else if (args[0] === '--proof') {
  // node tools/sim.js --proof   조합이 필요한 전장만: 전설만 / 공략 편성 이긴 판 수
  for (const h of LEGEND_PROOF) {
    const [r] = runHard(h.up, h.lv, 0, h.stage - 1, h.stage);
    console.log(`  S${h.stage} (${h.up}/Lv${h.lv}) 전장 ${r.base} · 전설만 ${r.legend} · 원거리만 ${r.ranged} · 공략 ${r.counter}   ${r.mods}`);
  }
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
