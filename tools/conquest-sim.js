#!/usr/bin/env node
/* 5.0 정벌 시뮬레이터 — 원정 한 판을 처음부터 끝까지 자동으로 돌린다.
 *   node tools/conquest-sim.js [판 수] [시드] [돌파 전장] [병종 레벨] [강화] [정벌 단계] [편성 core|buff|mid]
 * 갈림길 고르기: 성채가 낮으면 야영 · 상점, 넉넉하면 정예. 축복은 등급 높은 것, 상점은 수리(60% 아래) → 유물 → 축복.
 * 전투는 sim.js 와 같이 자동 출진 · 왕명 · 액티브를 쓸 수 있을 때마다 쓴다. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.env.ROOT || path.join(__dirname, '..');
function makeRandom(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function load(seed) {
  const M = Object.create(Math); M.random = makeRandom(seed);
  const ctx = { console, JSON, Math: M, performance: { now: () => Date.now() }, saveGame: () => {} }; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['js/data.js', 'js/game.js']) {
    let src = fs.readFileSync(ROOT + '/' + f, 'utf8');
    if (process.env.SIM_PATCH) for (const kv of process.env.SIM_PATCH.split('||')) { const [a, b] = kv.split('=>'); src = src.split(a).join(b); }
    vm.runInContext(src, ctx, { filename: f });
  }
  return vm.runInContext('({Battle, STAGES, UNITS, ROSTER_UNITS, CONQ, CONQ_BLESS_BY_ID, CONQ_RELIC_BY_ID, CONQ_SHRINE_BY_ID, CONQ_SHRINES, conqNewRun, conqEffects, conqStage, conqAfterBattle, conqAdvance, conqTake, conqShop, conqBuy, conqRestHeal, conqShrine, conqShrineCan, conqFinish, conqBlessOffer, conqRelicOffer, conqRng, conqPick, CONQ_ODDS, conqReachable, conqForge, unitLevelCap, EVOLUTIONS, EVOLUTIONS2, EVOLUTIONS3})', ctx);
}
const DECKS = {
  core: ['mage', 'colossus', 'thor', 'ra', 'odin', 'merlin', 'herald', 'runeseer', 'priest', 'mudang'],
  buff: ['merlin', 'odin', 'arthur', 'ra', 'zhugeliang', 'herald', 'runeseer', 'priest', 'mudang', 'catapult'],
};
function account(g, tier, lv, up, deckName) {
  const levels = {}, owned = {}, evo = {}, evo2 = {}, evo3 = {};
  const cap = g.unitLevelCap(tier, Math.min(5, up >> 1));
  g.UNITS.forEach(u => { const L = Math.min(lv, cap); levels[u.id] = L; if (u.gacha) owned[u.id] = 1;
    if (L >= 10 && g.EVOLUTIONS[u.id]) evo[u.id] = true; if (L >= 20 && g.EVOLUTIONS2[u.id]) evo2[u.id] = true; if (L >= 25 && g.EVOLUTIONS3[u.id]) evo3[u.id] = true; });
  const deck = DECKS[deckName] || g.ROSTER_UNITS.filter(u => u.unlockStage <= tier + 1).sort((a, b) => b.cost - a.cost).slice(0, 10).map(u => u.id);
  return { cleared: tier, coins: 0, stones: 0, levels, owned, evo, evo2, evo3, loadout: deck, stars: {},
    upgrades: { wallet: up, income: up, power: up, vitality: up, castle: up, logistics: up, treasury: up, spoils: up,
      medicine: Math.min(5, up), resistance: Math.min(5, up), deployment: Math.min(5, up), academy: Math.min(5, up >> 1), command: Math.min(5, up >> 1) } };
}
function fight(g, save, run, node) {
  const st = g.conqStage(run, node);
  const b = new g.Battle(node.src, save, st, { run: g.conqEffects(run), castle: run.castle, deck: run.deck });
  const dt = 1 / 30; let t = 0;
  while (b.state === 'play' && t < 420) {
    for (const u of b.roster) if (b.autoWants(u.id)) b.deploy(u.id);
    if (b.canCommand() && b.allies.length > 4) b.useCommand();
    for (const u of b.roster) if (u.active && b.canHeroActive(u.id)) b.useHeroActive(u.id);
    b.update(dt); t += dt;
  }
  if (process.env.DBG && b.state !== 'win') console.log('  패배', st.name, '(' + (node.src + 1) + '전장)', '배율 ×' + st.enemyMul.toFixed(2), st.mods.join(','), '성채 ' + Math.round(run.castle * 100) + '%', Math.round(t) + '초');
  return { win: b.state === 'win', castle: b.allyCastle.hp / b.allyCastle.maxHp, phoenix: !!b.phoenixUsed, t: Math.round(t), kills: b.kills, coins: b.coins };
}
const RANK = { epic: 0, rare: 1, common: 2 };
function pickBless(g, run, opts) { return opts.slice().sort((a, b) => RANK[g.CONQ_BLESS_BY_ID[a].rar] - RANK[g.CONQ_BLESS_BY_ID[b].rar])[0]; }
function pickRelic(g, run, opts) { return opts.find(id => !g.CONQ_RELIC_BY_ID[id].cursed) || opts[0]; }
function resolvePending(g, run) {
  while (run.pending) {
    const p = run.pending; run.pending = null;
    if (p.opts && p.opts.length) g.conqTake(run, p.kind, p.kind === 'bless' ? pickBless(g, run, p.opts) : pickRelic(g, run, p.opts));
    if (p.then) run.pending = p.then;
  }
}
/* 갈 수 있는 줄 가운데서 고른다: 성채가 낮으면 쉼터, 넉넉하면 정예 · 시련 */
function choose(g, row, run) {
  const ok = row.map((n, k) => g.conqReachable(run, k) ? k : -1).filter(k => k >= 0);
  const has = t => ok.find(k => row[k].t === t);
  const order = run.castle < 0.45 ? ['rest', 'shop', 'treasure', 'forge', 'shrine', 'recruit', 'battle', 'elite', 'trial']
    : run.castle > 0.8 ? ['treasure', 'elite', 'battle', 'forge', 'trial', 'shrine', 'shop', 'recruit', 'rest']
    : ['treasure', 'battle', 'forge', 'shrine', 'shop', 'rest', 'elite', 'recruit', 'trial'];
  for (const t of order) { const k = has(t); if (k !== undefined) return k; }
  return ok[0];
}
function playRun(seed, opt) {
  const g = load(seed);
  const save = account(g, opt.tier, opt.lv, opt.up, opt.deck);
  save.conqRec = { asc: opt.asc, top: opt.asc - 1 };
  const run = g.conqNewRun(save, opt.asc, seed * 7919 + 13);
  resolvePending(g, run);
  const log = [];
  while (!run.done) {
    const row = run.map[run.floor], k = choose(g, row, run), node = row[k];
    run.path[run.floor] = k;
    if (node.src !== undefined) {
      run.risk = process.env.RISK ? +process.env.RISK : (run.castle > 0.9 && node.t === 'battle' ? 1 : 0);   // 넉넉하면 도발
      const r = fight(g, save, run, node);
      log.push(node.t.slice(0,2) + (r.win ? '' : 'X') + Math.round(r.castle * 100) + '@' + r.t);
      g.conqAfterBattle(run, node, r.win, r.castle, { phoenixUsed: r.phoenix, kills: r.kills, coins: r.coins });
      if (run.done) break;
      resolvePending(g, run);
    } else if (node.t === 'shop') {
      const items = g.conqShop(run);
      if (run.castle < 0.6) g.conqBuy(run, items.find(i => i.kind === 'heal'));
      for (const it of items.filter(i => i.kind === 'relic')) g.conqBuy(run, it);
      for (const it of items.filter(i => i.kind === 'bless')) g.conqBuy(run, it);
      log.push('$');
    } else if (node.t === 'rest') {
      if (run.castle < 0.7) run.castle = Math.min(1, run.castle + g.conqRestHeal(run));
      else { run.pending = { kind: 'bless', opts: g.conqBlessOffer(run, 3, 'rare') }; resolvePending(g, run); }
      log.push('r');
    } else if (node.t === 'shrine') {
      const R = g.conqRng(run, 3), sh = g.conqPick(R, g.CONQ_SHRINES);
      const o = (sh.id !== 'blood' || run.castle > 0.5) && g.conqShrineCan(run, sh.opts[0]) ? sh.opts[0] : sh.opts[1];
      g.conqShrine(run, o); resolvePending(g, run);
      log.push('?');
    } else if (node.t === 'forge') {
      const ids = Object.keys(run.bless).sort((a, b) => RANK[g.CONQ_BLESS_BY_ID[a].rar] - RANK[g.CONQ_BLESS_BY_ID[b].rar]);
      if (ids.length) g.conqForge(run, ids[0]); else run.scrip += 25;
      log.push('f');
    } else if (node.t === 'treasure') {
      run.pending = { kind: 'relic', opts: g.conqRelicOffer(run, 2) }; resolvePending(g, run);
      log.push('t');
    } else log.push(node.t[0]);                                  // 징집소는 지나친다 (편성이 이미 짜여 있다)
    if (run.done) break;
    g.conqAdvance(run);
  }
  const fin = g.conqFinish(save, run);
  return { win: fin.win, floors: fin.floors, won: run.won, relics: run.relics.length, bless: Object.values(run.bless).reduce((a, b) => a + b, 0), log: log.join(' ') };
}
module.exports = { playRun, load };
if (require.main === module) {
  const [N, s0, tier, lv, up, asc, deck] = process.argv.slice(2);
  const opt = { tier: +(tier || 80), lv: +(lv || 30), up: +(up || 10), asc: +(asc || 0), deck: deck || 'core' };
  let w = 0, fl = 0; const n = +(N || 4);
  for (let k = 0; k < n; k++) { const r = playRun(+(s0 || 1) * 100 + k, opt); w += r.win; fl += r.floors; console.log(JSON.stringify(r)); }
  console.log('합계', JSON.stringify(opt), '정벌 ' + w + '/' + n, '평균 ' + (fl / n).toFixed(1) + '층');
}
