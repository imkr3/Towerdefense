#!/usr/bin/env node
/* =======================================================================
 *  막대 왕국 전쟁 - 정적 점검
 *
 *  index.html 이 참조하는 파일이 실제로 있는지,
 *  오프라인 캐시 목록(sw.js)이 실제 파일과 맞는지,
 *  데이터에 빠진 항목이 없는지 확인한다.
 *
 *    node tools/check-assets.js
 * ======================================================================= */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const problems = [];
const ok = m => console.log('  ✓ ' + m);
const bad = m => { problems.push(m); console.error('  ✗ ' + m); };

/* 1. index.html 참조 파일 */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const refs = [];
html.replace(/<script src="([^"]+)"/g, (_, v) => refs.push(v));
html.replace(/<link[^>]+href="([^"]+)"/g, (_, v) => refs.push(v));
refs.filter(r => !/^https?:/.test(r)).forEach(r => {
  if (fs.existsSync(path.join(ROOT, r))) ok('참조 파일 있음: ' + r);
  else bad('참조 파일 없음: ' + r);
});

/* 2. 서비스워커 캐시 목록 */
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const cached = [];
const block = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS')));
block.replace(/'\.\/([^']+)'/g, (_, v) => cached.push(v));
cached.forEach(c => {
  if (fs.existsSync(path.join(ROOT, c))) ok('캐시 대상 있음: ' + c);
  else bad('캐시 대상 없음: ' + c);
});
refs.filter(r => /^(js|css)\//.test(r)).forEach(r => {
  if (cached.indexOf(r) < 0) bad('오프라인 캐시 목록에 빠짐: ' + r);
});

/* 3. 데이터 정합성 */
const ctx = { console, JSON, Math, saveGame: () => {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8'), ctx);
const D = vm.runInContext(
  '({UNITS, UNIT_BY_ID, ROSTER_UNITS, SEASON_UNITS, SEASONS, ENEMIES, STAGES, UPGRADES, RARITY, LOADOUT_MAX})',
  ctx);

const ids = {};
D.UNITS.forEach(u => {
  if (ids[u.id]) bad('병종 id 중복: ' + u.id);
  ids[u.id] = true;
  if (!u.shape) bad('shape 없음: ' + u.id);
  if (!u.name) bad('name 없음: ' + u.id);
  if (u.ab && u.ab.summon && !D.UNIT_BY_ID[u.ab.summon.id] && !D.ENEMIES[u.ab.summon.id]) {
    bad('소환 대상이 없다: ' + u.id + ' -> ' + u.ab.summon.id);
  }
});
ok('병종 ' + D.UNITS.length + '종 (전장 ' + D.ROSTER_UNITS.length +
   ' / 소환 ' + D.SEASON_UNITS.length + ')');

Object.keys(D.ENEMIES).forEach(k => {
  const e = D.ENEMIES[k];
  if (!e.shape) bad('적 shape 없음: ' + k);
  if (e.ab && e.ab.summon && !D.ENEMIES[e.ab.summon.id]) {
    bad('적 소환 대상이 없다: ' + k + ' -> ' + e.ab.summon.id);
  }
});
ok('적 ' + Object.keys(D.ENEMIES).length + '종');

D.STAGES.forEach((st, i) => {
  if (!st.waves.length) bad('전장 ' + (i + 1) + ': 파도가 없다');
  st.waves.forEach((w, n) => {
    if (!D.ENEMIES[w.e]) bad('전장 ' + (i + 1) + ': 없는 적 ' + w.e);
    // 파도는 적어 둔 순서대로 등장해야 한다. 시각이 뒤로 가면 보스가
    // 엉뚱하게 앞당겨져 난이도 곡선이 통째로 무너진다.
    if (n > 0 && w.t < st.waves[n - 1].t) {
      bad('전장 ' + (i + 1) + ': 파도 시각이 거꾸로다 (' + w.e + ' ' + w.t +
          '초, 앞 파도는 ' + st.waves[n - 1].t + '초)');
    }
  });
  if (!(st.baseHp > 0)) bad('전장 ' + (i + 1) + ': 요새 체력이 이상하다');
});
ok('전장 ' + D.STAGES.length + '개, 파도 참조와 등장 순서 정상');

D.SEASONS.forEach(sn => {
  sn.units.forEach(id => {
    const u = D.UNIT_BY_ID[id];
    if (!u) return bad('시즌 ' + sn.id + ': 없는 병종 ' + id);
    if (!u.gacha) bad('시즌 ' + sn.id + ': ' + id + ' 에 gacha 표시가 없다');
    if (!D.RARITY[u.rarity]) bad('시즌 ' + sn.id + ': ' + id + ' 등급이 이상하다');
  });
});
const pooled = {};
D.SEASONS.forEach(sn => sn.units.forEach(id => { pooled[id] = true; }));
D.SEASON_UNITS.filter(u => u.gacha).forEach(u => {
  if (!pooled[u.id]) bad('소환 풀에 빠진 병종: ' + u.id);
});
Object.keys(D.RARITY).forEach(r => {
  const n = D.SEASON_UNITS.filter(u => u.gacha && u.rarity === r).length;
  if (!n) bad('등급 ' + r + ' 에 병종이 하나도 없다');
});
ok('시즌 ' + D.SEASONS.length + '개, 소환 풀 정상');

/* 영어 번역이 자료를 전부 덮는지, 사전에 같은 열쇠가 두 번 들어가지 않았는지.
 * 번역이 빠지면 영어로 고른 화면에 한국어가 그대로 남고, 열쇠가 겹치면 뒤엣것이
 * 앞엣것을 조용히 덮어써서 엉뚱한 말이 나온다. */
const i18nSrc = fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8');
vm.runInContext(i18nSrc, ctx, { filename: 'js/i18n.js' });
const T = vm.runInContext(
  '({I18N_EN, MISSION_DEFS, ACHIEVEMENTS, STAGE_MODS, COMMAND})', ctx);
{
  const han = /[가-힣]/;
  const missing = new Set();
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || d > 6) return;
    for (const k in o) {
      const v = o[k];
      if (typeof v === 'string') {
        if (han.test(v) && !Object.prototype.hasOwnProperty.call(T.I18N_EN, v)) missing.add(v);
      } else if (v && typeof v === 'object') walk(v, d + 1);
    }
  };
  [D.UNITS, D.ENEMIES, D.STAGES, D.SEASONS, T.MISSION_DEFS, T.ACHIEVEMENTS,
   D.UPGRADES, T.COMMAND, D.RARITY, T.STAGE_MODS].forEach(o => walk(o, 0));
  if (missing.size) {
    [...missing].slice(0, 12).forEach(m => bad('영어 번역 없음: ' + m));
    if (missing.size > 12) bad('… 그 밖에 ' + (missing.size - 12) + '건');
  } else ok('영어 번역 ' + Object.keys(T.I18N_EN).length + '개, 자료 전체 덮음');

  const block = i18nSrc.slice(i18nSrc.indexOf('const I18N_EN = {'),
                              i18nSrc.indexOf('\n};', i18nSrc.indexOf('const I18N_EN = {')));
  const re = /'((?:[^'\\]|\\.)*)'\s*:/g;
  const seen = {}; let m2, dups = 0;
  while ((m2 = re.exec(block))) {
    if (seen[m2[1]]) { bad('번역 사전에 같은 열쇠가 둘: ' + m2[1]); dups++; }
    seen[m2[1]] = true;
  }
  if (!dups) ok('번역 사전에 중복 열쇠 없음');
}

/* 렌더러가 모든 shape 을 그릴 수 있는지 */
const render = fs.readFileSync(path.join(ROOT, 'js/render.js'), 'utf8');
const shapes = {};
D.UNITS.forEach(u => { shapes[u.shape] = true; });
Object.keys(D.ENEMIES).forEach(k => { shapes[D.ENEMIES[k].shape] = true; });
Object.keys(shapes).forEach(sh => {
  if (render.indexOf("case '" + sh + "'") < 0) bad('그리기 코드 없음: ' + sh);
});
ok('그리기 코드 ' + Object.keys(shapes).length + '종 확인');

if (problems.length) {
  console.error('\n정적 점검 실패 (' + problems.length + '건)\n');
  process.exit(1);
}
console.log('\n정적 점검 통과\n');
