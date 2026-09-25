/* =======================================================================
 *  막대 왕국 전쟁 - 화면 전환 / 저장 / 메인 루프
 * ======================================================================= */

const SAVE_KEY = SaveStore.key;

function defaultSave() {
  const lv = {};
  UNITS.forEach(u => { lv[u.id] = 1; });
  return {
    cleared: 0, coins: 0,
    upgrades: { wallet: 0, income: 0, power: 0, vitality: 0, castle: 0 },
    levels: lv, loadout: ['spear'], knownUnits: ['spear'],
    stars: {}, totalKills: 0, sound: true,
    owned: {}, stones: 3, pity: 0, mythPity: 0, season: 'olympus', pulls: 0, tutorial: false,
    endlessBest: 0, achv: {}, daily: null, auto: false,
    stats: { battles: 0, wins: 0, bossKills: 0, trains: 0, playSec: 0 }
  };
}

/* 해금된 병종 목록 */
function unlockedUnits() {
  const base = ROSTER_UNITS.filter(u => u.unlockStage <= save.cleared + 1);
  const summoned = SEASON_UNITS.filter(u => u.gacha && save.owned[u.id]);
  return base.concat(summoned);
}

/* 새로 해금된 병종을 자리가 있으면 편성에 자동 추가 */
function syncLoadout() {
  const unlocked = unlockedUnits();
  const known = new Set(save.knownUnits || unlocked.map(u => u.id));
  save.loadout = [...new Set(save.loadout || [])].filter(id => unlocked.some(u => u.id === id));
  unlocked.forEach(u => {
    if (!known.has(u.id) && save.loadout.length < LOADOUT_MAX && !save.loadout.includes(u.id) &&
        !(isHeroUnit(u) && save.loadout.filter(id => isHeroUnit(UNIT_BY_ID[id])).length >= HERO_SLOT_MAX)) {
      save.loadout.push(u.id);
    }
  });
  if (!save.loadout.length && unlocked.length) save.loadout.push(unlocked[0].id);
  save.loadout = save.loadout.slice(0, LOADOUT_MAX);
  save.knownUnits = unlocked.map(u => u.id);
  saveGame(save);
}

function loadGame() {
  const raw = SaveStore.read();
  if (!raw) return defaultSave();
  return normalizeSave(raw);
}

function normalizeSave(raw) {
    const s = Object.assign(defaultSave(), raw);
    const d = defaultSave();
    s.upgrades = Object.assign(d.upgrades, s.upgrades || {});
    s.levels = Object.assign(d.levels, s.levels || {});
    s.cleared = Math.max(0, Math.min(STAGES.length, s.cleared | 0));
    // 밸런스 패치로 상한이 바뀌어도 이미 획득한 레벨은 보존한다.
    UNITS.forEach(u => {
      s.levels[u.id] = Math.max(1, Math.floor(s.levels[u.id]) || 1);
    });
    if (!Array.isArray(s.loadout)) s.loadout = [];
    if (!Array.isArray(s.knownUnits) || !Object.prototype.hasOwnProperty.call(raw, 'knownUnits')) {
      s.knownUnits = UNITS.filter(u => u.unlockStage <= s.cleared + 1 || (u.gacha && s.owned && s.owned[u.id])).map(u => u.id);
    }
    if (!s.stars || typeof s.stars !== 'object') s.stars = {};
    if (typeof s.sound !== 'boolean') s.sound = true;
    if (!s.owned || typeof s.owned !== 'object') s.owned = {};
    if (!s.achv || typeof s.achv !== 'object') s.achv = {};
    if (typeof s.endlessBest !== 'number') s.endlessBest = 0;
    if (typeof s.auto !== 'boolean') s.auto = false;
    s.stats = Object.assign({ battles: 0, wins: 0, bossKills: 0, trains: 0, playSec: 0 },
                            s.stats || {});
    if (typeof s.stones !== 'number') s.stones = 3;
    if (typeof s.pity !== 'number') s.pity = 0;
    if (typeof s.pulls !== 'number') s.pulls = 0;
    if (!seasonById(s.season)) s.season = 'olympus';
    if (!Array.isArray(s.presets)) s.presets = [];
    s.presets = s.presets.slice(0, 3).map(p => Array.isArray(p) ? p.filter(id => typeof id === 'string' && UNIT_BY_ID[id]).slice(0, LOADOUT_MAX) : []);
    return s;
}

function saveGame(s) {
  const ok = SaveStore.write(s);
  const notice = document.getElementById('save-warning');
  if (notice) { notice.hidden = ok; notice.textContent = SaveStore.error; }
  return ok;
}

let save = loadGame();
let battle = null;
let renderer = null;
let lastTs = 0;

/* ------------------------------ 화면 ------------------------------ */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.prototype.slice.call(document.querySelectorAll(sel));

function show(id) {
  syncLoadout();
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  titleAnim.on = (id === 'scr-title');
  if (id === 'scr-title') { resizeTitle(); refreshTitleBadges(); }
  if (id === 'scr-map') renderMap();
  if (id === 'scr-shop') renderShop();
  if (id === 'scr-units') renderTraining();
  if (id === 'scr-formation') renderFormation();
  if (id === 'scr-gacha') renderGacha();
  if (id === 'scr-quest') { checkAchievements(); renderQuest(); }
  if (id === 'scr-battle' && renderer) renderer.resize();
  if (id !== 'scr-battle') BGM.play(id === 'scr-title' ? 'title' : 'map');
}

/* 브라우저 기본 confirm 대신 게임 톤에 맞춘 확인창 */
let confirmYes = null;
function askConfirm(title, text, onYes) {
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  confirmYes = onYes;
  $('#modal-confirm').classList.add('show');
  SFX.ui();
}

/* 12345 -> 12,345 */
function fmtNum(n) { return Math.floor(n || 0).toLocaleString('en-US'); }

let toastTimer = null;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

/* ------------------------ 일일 임무 / 업적 ------------------------ */
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/* 날짜가 바뀌면 임무를 새로 뽑는다 */
function refreshDaily() {
  const key = todayKey();
  if (save.daily && save.daily.date === key) return;
  save.daily = {
    date: key,
    list: dailyMissionIds(key).map(id => ({ id: id, got: 0, claimed: false }))
  };
  saveGame(save);
}

function missionProgress(m) {
  const def = missionById(m.id);
  return Math.min(def.need, m.got);
}
function missionDone(m) {
  return missionProgress(m) >= missionById(m.id).need;
}

/* 전투/소환/훈련 결과를 임무 진행도에 반영한다 */
function addStat(stat, n) {
  refreshDaily();
  let changed = false;
  save.daily.list.forEach(m => {
    if (missionById(m.id).stat === stat && !m.claimed) { m.got += n; changed = true; }
  });
  if (changed) saveGame(save);
  updateQuestBadge();
}

/* 조건을 만족한 업적을 즉시 지급한다 */
function checkAchievements() {
  let earned = [];
  ACHIEVEMENTS.forEach(a => {
    if (save.achv[a.id]) return;
    if (!a.test(save)) return;
    save.achv[a.id] = true;
    save.coins += a.gold;
    save.stones += a.stone;
    earned.push(a);
  });
  if (earned.length) {
    saveGame(save);
    SFX.levelUp();
    toast('업적 달성: ' + earned.map(a => a.name).join(', '));
  }
  updateQuestBadge();
  return earned;
}

/* 받을 수 있는 보상 개수를 탭에 표시 */
function claimableCount() {
  refreshDaily();
  return save.daily.list.filter(m => !m.claimed && missionDone(m)).length;
}
function updateQuestBadge() {
  const n = claimableCount();
  const el = $('#tab-quest');
  if (!el) return;
  el.textContent = n;
  el.classList.toggle('on', n > 0);
}

function renderQuest(tab) {
  refreshDaily();
  questTab = tab || questTab || 'daily';
  $('#quest-stones').textContent = save.stones;
  $('#quest-gold').textContent = fmtNum(save.coins);
  $$('#quest-tabs .season-tab').forEach(b =>
    b.classList.toggle('on', b.dataset.qtab === questTab));

  const box = $('#quest-list');
  box.innerHTML = '';

  if (questTab === 'daily') {
    save.daily.list.forEach(m => {
      const def = missionById(m.id);
      const done = missionDone(m);
      const el = document.createElement('div');
      el.className = 'quest-card' + (m.claimed ? ' claimed' : (done ? ' done' : ''));
      el.innerHTML =
        '<div class="q-head"><span class="q-name">' + def.text + '</span>' +
        '<span class="q-prog">' + missionProgress(m) + ' / ' + def.need + '</span></div>' +
        '<div class="q-bar"><div style="width:' +
          (missionProgress(m) / def.need * 100) + '%"></div></div>' +
        '<div class="q-reward">💰 ' + def.gold + '  🔮 ' + def.stone + '</div>' +
        '<button class="btn q-btn"' + (done && !m.claimed ? ' ' : ' disabled') + '>' +
          (m.claimed ? '수령 완료' : (done ? '보상 받기' : '진행 중')) + '</button>';
      if (done && !m.claimed) {
        el.querySelector('.q-btn').addEventListener('click', () => {
          m.claimed = true;
          save.coins += def.gold;
          save.stones += def.stone;
          saveGame(save);
          SFX.gold();
          toast('보상을 받았다');
          renderQuest('daily');
          checkAchievements();
        });
      }
      box.appendChild(el);
    });
    const note = document.createElement('div');
    note.className = 'quest-card note';
    note.innerHTML = '<div class="q-name">임무는 날짜가 바뀌면 새로 뽑힌다.</div>';
    box.appendChild(note);

  } else if (questTab === 'achv') {
    ACHIEVEMENTS.forEach(a => {
      const got = !!save.achv[a.id];
      const el = document.createElement('div');
      el.className = 'quest-card achv' + (got ? ' claimed' : '');
      el.innerHTML =
        '<div class="q-head"><span class="q-name">' + (got ? '🏅 ' : '') + a.name + '</span>' +
        '<span class="q-prog">' + (got ? '달성' : '미달성') + '</span></div>' +
        '<div class="q-desc">' + a.desc + '</div>' +
        '<div class="q-reward">💰 ' + a.gold + '  🔮 ' + a.stone + '</div>';
      box.appendChild(el);
    });

  } else {
    const st = save.stats;
    const rows = [
      ['돌파한 전장', save.cleared + ' / ' + STAGES.length],
      ['모은 별', totalStars(save) + ' / ' + (STAGES.length * 3)],
      ['치른 전투', st.battles + '회'],
      ['승리', st.wins + '회'],
      ['누적 처치', (save.totalKills || 0) + '명'],
      ['보스 처치', st.bossKills + '체'],
      ['무한 전장 최고 기록', (save.endlessBest || 0) + '웨이브'],
      ['소환 횟수', (save.pulls || 0) + '회'],
      ['보유 소환 병종', Object.keys(save.owned).length + ' / ' + SEASON_UNITS.filter(u => u.gacha).length],
      ['훈련 횟수', st.trains + '회'],
      ['달성 업적', Object.keys(save.achv).length + ' / ' + ACHIEVEMENTS.length],
      ['총 전투 시간', Math.floor(st.playSec / 60) + '분 ' + Math.floor(st.playSec % 60) + '초']
    ];
    rows.forEach(r => {
      const el = document.createElement('div');
      el.className = 'quest-card stat-card';
      el.innerHTML = '<span class="q-name">' + r[0] + '</span><span class="q-val">' + r[1] + '</span>';
      box.appendChild(el);
    });
  }
}
let questTab = 'daily';

/* ------------------------------ 지도 ------------------------------ */
/* 30개 전장을 긴 목록으로 늘어놓던 것을 장(章) 단위 진군로로 바꿨다.
 * 한 장에 10개, 화면 하나에 다 들어가고 스크롤이 없다. 전장을 누르면 오른쪽에
 * 정보가 뜨고, 거기서 편성을 고치거나 바로 출진한다. */
const CHAPTERS = [
  { name: '1장', sub: '국경 전선', from: 0, to: 10 },
  { name: '2장', sub: '왕도 수호', from: 10, to: 20 },
  { name: '2막', sub: '신화의 끝', from: 20, to: 30 },
  { name: '무한', sub: '끝없는 웨이브', endless: true }
];
let mapChapter = -1;       // -1: 진행 중인 장을 자동으로 고른다
let mapSel = -1;           // 고른 전장

function chapterOf(i) {
  for (let c = 0; c < CHAPTERS.length; c++) {
    const ch = CHAPTERS[c];
    if (!ch.endless && i >= ch.from && i < ch.to) return c;
  }
  return 0;
}

/* 전장 길이를 말로. 숫자보다 감이 온다. */
function stageLenLabel(st) {
  const len = st.len || 2000;
  return len < 1050 ? '짧은 전장' : len < 1260 ? '보통 전장' : '긴 전장';
}

/* 진군로 위 점 위치(%). 가로 화면에 맞춘 완만한 S 자 */
function trailPoint(k, n) {
  const x = 7 + (86 * k) / Math.max(1, n - 1);
  const y = 50 + Math.sin(k * 1.15 + 0.4) * 27;
  return { x: x, y: y };
}

function renderMap() {
  $('#map-coins').textContent = fmtNum(save.coins);
  updateQuestBadge();
  const pct = (save.cleared / STAGES.length) * 100;
  $('#map-progress').style.width = pct + '%';
  let totalStars = 0;
  for (const k in save.stars) totalStars += save.stars[k];
  $('#map-progress-txt').innerHTML =
    save.cleared + ' / ' + STAGES.length + ' <span class="gold-txt">★ ' +
    totalStars + ' / ' + (STAGES.length * 3) + '</span>';

  const current = Math.min(save.cleared, STAGES.length - 1);
  if (mapChapter < 0) mapChapter = chapterOf(current);
  if (mapSel < 0 || mapSel > save.cleared) mapSel = current;

  // 장 탭
  const tabs = $('#chapter-tabs');
  tabs.innerHTML = '';
  CHAPTERS.forEach((ch, c) => {
    const b = document.createElement('button');
    b.type = 'button';
    const open = ch.endless ? save.cleared >= ENDLESS_UNLOCK_STAGE : ch.from <= save.cleared;
    let stars = 0;
    if (!ch.endless) for (let i = ch.from; i < ch.to; i++) stars += save.stars[i] || 0;
    b.className = 'chapter-tab' + (c === mapChapter ? ' on' : '') + (open ? '' : ' locked');
    b.setAttribute('aria-pressed', String(c === mapChapter));
    b.innerHTML = '<span class="ch-name">' + (open ? '' : '🔒 ') + ch.name + '</span>' +
      '<span class="ch-sub">' + ch.sub + '</span>' +
      (ch.endless ? '<span class="ch-star">' + (save.endlessBest || 0) + '</span>'
                  : '<span class="ch-star">★ ' + stars + '/' + ((ch.to - ch.from) * 3) + '</span>');
    b.addEventListener('click', () => {
      mapChapter = c;
      if (!ch.endless && (mapSel < ch.from || mapSel >= ch.to)) mapSel = Math.min(save.cleared, ch.to - 1);
      SFX.ui();
      renderMap();
    });
    tabs.appendChild(b);
  });

  const ch = CHAPTERS[mapChapter];
  const list = $('#stage-list');
  const path = $('#trail-path');
  const endless = $('#endless-slot');
  list.innerHTML = '';
  path.innerHTML = '';
  $('#trail').classList.toggle('endless-mode', !!ch.endless);
  if (ch.endless) {
    renderEndlessSlot();
    renderStageDetail(-1);
    return;
  }
  endless.innerHTML = '';

  const n = ch.to - ch.from;
  let d = '', done = '';
  for (let k = 0; k < n; k++) {
    const p = trailPoint(k, n);
    d += (k ? ' L ' : 'M ') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
    if (ch.from + k <= save.cleared) done += (k ? ' L ' : 'M ') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
  }
  path.innerHTML = '<path class="tp-all" d="' + d + '"/><path class="tp-done" d="' + done + '"/>';

  for (let k = 0; k < n; k++) {
    const i = ch.from + k, st = STAGES[i];
    const locked = i > save.cleared;
    const cleared = i < save.cleared;
    const p = trailPoint(k, n);
    const el = document.createElement('button');
    el.type = 'button';
    el.disabled = locked;
    el.dataset.stage = String(i);
    el.className = 'stage' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '') +
                   (st.boss ? ' boss' : '') + (st.mods ? ' hard' : '') + (i === save.cleared ? ' current' : '') +
                   (i === mapSel ? ' sel' : '');
    el.style.left = p.x + '%';
    el.style.top = p.y + '%';
    el.style.setProperty('--field', FIELD_PALETTES[i % FIELD_PALETTES.length].ridge);
    el.setAttribute('aria-label', (i + 1) + '. ' + (locked ? '잠김' : st.name));
    el.innerHTML =
      '<span class="stage-no">' + (locked ? '🔒' : (st.boss ? '♛' : (i + 1))) + '</span>' +
      (st.mods && !locked ? '<span class="stage-mods">' + st.mods.map(m => '<i style="background:' + STAGE_MODS[m].color + '"></i>').join('') + '</span>' : '') +
      '<span class="stage-mark">' + (cleared ? starMarks(save.stars[i] || 0) : (i === save.cleared ? '▶' : '')) + '</span>';
    if (!locked) {
      el.addEventListener('click', () => {
        if (mapSel === i) { startBattle(i); return; }   // 한 번 더 누르면 출진
        mapSel = i;
        SFX.ui();
        $$('#stage-list .stage').forEach(b => b.classList.toggle('sel', b === el));
        renderStageDetail(i);
      });
    }
    list.appendChild(el);
  }
  renderStageDetail(mapSel >= ch.from && mapSel < ch.to ? mapSel : -1);
}

function renderStageDetail(i) {
  const box = $('#stage-detail');
  box.innerHTML = '';
  const ch = CHAPTERS[mapChapter];
  if (ch.endless || i < 0) {
    box.innerHTML = ch.endless
      ? '<div class="sd-name">무한 전장</div><p class="sd-hint">웨이브가 끝없이 온다. 웨이브마다 적이 강해지고 5웨이브마다 보스가 나온다. 성채가 무너질 때까지 몇 웨이브를 버티는지 겨룬다.</p>'
      : '<div class="sd-name">' + ch.name + ' · ' + ch.sub + '</div><p class="sd-hint">이전 장을 먼저 돌파해야 한다.</p>';
    const fb = document.createElement('button');
    fb.className = 'btn ghost sd-formation';
    fb.textContent = '편성';
    fb.addEventListener('click', () => openFormation(ch.endless ? 'endless' : null));
    box.appendChild(fb);
    return;
  }
  const st = STAGES[i];
  const types = [...new Set(st.waves.map(w => w.e))];
  const head = document.createElement('div');
  head.innerHTML =
    '<div class="sd-no">' + (st.boss ? '보스 전장' : '전장') + ' ' + (i + 1) + '</div>' +
    '<div class="sd-name">' + st.name + '</div>' +
    '<div class="sd-stars">' + starMarks(save.stars[i] || 0) + '</div>' +
    (st.hint ? '<p class="sd-hint">' + st.hint + '</p>' : '') +
    (st.mods ? '<div class="sd-mods">' + st.mods.map(m => {
      const d = STAGE_MODS[m];
      return '<div class="sd-mod" style="--mc:' + d.color + '"><b>' + d.name + '</b><span>' + d.desc + '</span>' +
             '<small>대응 · ' + d.counter + '</small></div>';
    }).join('') + '</div>' : '') +
    '<div class="sd-meta">' +
      '<span>적 요새 ' + st.baseHp.toLocaleString() + '</span>' +
      '<span>보상 💰' + st.reward + '</span>' +
      '<span>' + stageLenLabel(st) + '</span>' +
    '</div>';
  box.appendChild(head);
  const foes = document.createElement('div');
  foes.className = 'sd-foes';
  types.slice(0, 8).forEach(id => {
    const e = ENEMIES[id];
    const f = document.createElement('span');
    f.className = 'sd-foe' + (e.boss ? ' boss' : '');
    f.title = e.name;
    f.innerHTML = '<canvas></canvas><small>' + e.name + '</small>';
    drawUnitIcon(f.querySelector('canvas'), e, 30);
    foes.appendChild(f);
  });
  box.appendChild(foes);
  const btns = document.createElement('div');
  btns.className = 'sd-btns';
  const fb = document.createElement('button');
  fb.className = 'btn ghost sd-formation';
  fb.textContent = '편성 (' + save.loadout.length + '/' + LOADOUT_MAX + ')';
  fb.addEventListener('click', () => openFormation(i));
  const go = document.createElement('button');
  go.className = 'btn primary sd-go';
  go.id = 'btn-sortie';
  go.textContent = '출진 ▶';
  go.addEventListener('click', () => startBattle(i));
  btns.appendChild(fb);
  btns.appendChild(go);
  box.appendChild(btns);
}

function renderEndlessSlot() {
  const slot = $('#endless-slot');
  if (!slot) return;
  const open = save.cleared >= ENDLESS_UNLOCK_STAGE;
  slot.innerHTML = '';
  if (!open) {
    slot.innerHTML = '<div class="endless-card locked">🔒 무한 전장은 20전장을 모두 돌파하면 열린다</div>';
    return;
  }
  const el = document.createElement('div');
  el.className = 'endless-card';
  el.innerHTML =
    '<div class="e-title">무한 전장</div>' +
    '<div class="e-sub">끝이 없는 웨이브. 웨이브마다 적이 강해진다. 성채가 무너질 때까지 버텨라.</div>' +
    '<div class="e-best">최고 기록 <b>' + (save.endlessBest || 0) + '</b> 웨이브</div>' +
    '<button class="btn primary e-btn">도전</button>';
  el.querySelector('.e-btn').addEventListener('click', () => startEndless());
  slot.appendChild(el);
}

function starMarks(n) {
  let out = '';
  for (let i = 0; i < 3; i++) out += (i < n ? '★' : '☆');
  return '<span class="star-row">' + out + '</span>';
}

/* ------------------------------ 강화 ------------------------------ */
function renderShop() {
  $('#shop-coins').textContent = fmtNum(save.coins);
  const box = $('#shop-list');
  box.innerHTML = '';
  Object.keys(UPGRADES).forEach(key => {
    const u = UPGRADES[key];
    const lv = save.upgrades[key] || 0;
    const maxed = lv >= u.max;
    const cost = upgradeCost(key, lv);
    const card = document.createElement('div');
    card.className = 'up-card';
    let pips = '';
    for (let i = 0; i < u.max; i++) pips += '<div class="pip' + (i < lv ? ' on' : '') + '"></div>';
    card.innerHTML =
      '<div class="up-head"><div class="up-name">' + u.name + '</div>' +
      '<div class="up-lv">레벨 ' + lv + ' / ' + u.max + '</div></div>' +
      '<div class="up-desc">' + u.desc + '</div>' +
      '<div class="pips">' + pips + '</div>' +
      '<button class="btn primary up-buy"' + (maxed ? ' disabled' : '') + '>' +
        (maxed ? '최대 강화 완료' : '💰 ' + cost + ' 골드로 강화') + '</button>';
    if (!maxed) {
      card.querySelector('.up-buy').addEventListener('click', () => {
        if (save.coins < cost) { toast('골드가 부족하다'); return; }
        save.coins -= cost;
        save.upgrades[key] = lv + 1;
        saveGame(save);
        renderShop();
        SFX.levelUp();
        toast(u.name + ' 레벨 ' + (lv + 1) + ' 완료');
      });
    }
    box.appendChild(card);
  });
}

/* ------------------------------ 훈련소 ------------------------------ */
let trainingFilter = 'ally';
function renderTraining() {
  const hardCap = UNIT_LEVEL_HARD_CAP + (save.upgrades.academy || 0);
  $('#train-coins').textContent = fmtNum(save.coins);
  const cap = unitLevelCap(save.cleared, save.upgrades.academy);
  $('#train-cap').innerHTML =
    '레벨 상한 <b>' + cap + '</b>' +
    (cap < hardCap ? ' (전장을 돌파하면 상승)' : ' (최대)') +
    ' · 편성 <b>' + save.loadout.length + ' / ' + LOADOUT_MAX + '</b>' +
    ' <span class="hint">카드는 편성한 병종만 나온다</span>';

  const box = $('#units-list');
  box.innerHTML = '';
  const ownedSeason = SEASON_UNITS.filter(u => u.gacha && save.owned[u.id]);
  ROSTER_UNITS.concat(ownedSeason).forEach(u => {
    const unlocked = u.gacha ? true : (u.unlockStage <= save.cleared + 1);
    const lv = save.levels[u.id] || 1;
    const mul = unitLevelMul(lv);
    const cost = unitTrainCost(u, lv);
    const atCap = lv >= cap;
    const inTeam = save.loadout.indexOf(u.id) >= 0;
    const teamFull = save.loadout.length >= LOADOUT_MAX;

    const el = document.createElement('div');
    el.className = 'unit-card' + (unlocked ? '' : ' dim') + (inTeam ? ' teamed' : '') +
                   (u.gacha ? ' summoned r-' + rarityOf(u) : '');
    el.innerHTML =
      '<div class="unit-ico">' + (unlocked ? '<canvas></canvas>' : '<span>?</span>') + '</div>' +
      '<div class="unit-body">' +
        '<div class="unit-name">' + (unlocked ? u.name : '미합류 병종') +
          '<span class="unit-tag' + (unlocked ? '' : ' lock') + '">' +
          (unlocked ? u.role : u.unlockStage + '전장') + '</span>' +
          (u.gacha ? '<span class="rare-tag r-' + rarityOf(u) + '">' +
                     RARITY[rarityOf(u)].name + '</span>' : '') +
          (unlocked ? '<span class="lv-tag">레벨 ' + lv + '</span>' : '') +
          (unlocked && inTeam ? '<span class="team-tag">편성</span>' : '') + '</div>' +
        (unlocked && u.active ? '<div class="active-desc">액티브 · ' + u.active.name + ' (' + u.active.cd + '초): ' + u.active.desc + '</div>' : '') +
        (unlocked && u.abText ? '<div class="ab-text">◆ ' + u.abText + '</div>' : '') +
        '<div class="unit-desc">' +
          (unlocked ? u.desc : '전장 ' + u.unlockStage + '에 도달하면 합류한다.') + '</div>' +
        (unlocked ?
          '<div class="stat-row">' +
            '<span class="stat">비용 ' + u.cost + '</span>' +
            '<span class="stat hl">체력 ' + Math.round(u.hp * mul * (1 + .08 * (save.upgrades.vitality || 0))) + '</span>' +
            (u.atk ? '<span class="stat hl">공격 ' + Math.round(u.atk * mul * (1 + .06 * (save.upgrades.power || 0))) + '</span>' : '') +
            (u.range ? '<span class="stat">사거리 ' + u.range + '</span>' : '') +
            '<span class="stat">속도 ' + u.speed + '</span>' +
            '<span class="stat">쿨타임 ' + u.cooldown + '초</span>' +
            (u.maxActive ? '<span class="stat">동시 출진 ' + u.maxActive + '명</span>' : '') +
          '</div>' +
          '<div class="btn-row">' +
            '<button class="btn train-btn"' + (atCap ? ' disabled' : '') + '>' +
              (atCap ? (lv >= hardCap ? '최대 레벨' : '상한 도달')
                     : '💰 ' + cost + ' → 레벨 ' + (lv + 1)) + '</button>' +
            '<button class="btn team-btn' + (inTeam ? ' on' : '') + '"' +
              (!inTeam && teamFull ? ' disabled' : '') + '>' +
              (inTeam ? '편성 해제' : (teamFull ? '자리 없음' : '편성')) + '</button>' +
          '</div>'
        : '') +
      '</div>';

    if (unlocked) {
      drawUnitIcon(el.querySelector('.unit-ico canvas'), u, 54);
      if (!atCap) {
        el.querySelector('.train-btn').addEventListener('click', () => {
          if (save.coins < cost) { toast('골드가 부족하다'); return; }
          save.coins -= cost;
          save.levels[u.id] = lv + 1;
          save.stats.trains++;
          saveGame(save);
          addStat('trains', 1);
          renderTraining();
          SFX.levelUp();
          toast(u.name + ' 레벨 ' + (lv + 1) + ' 훈련 완료');
        });
      }
      const tb = el.querySelector('.team-btn');
      if (tb && !(!inTeam && teamFull)) {
        tb.addEventListener('click', () => {
          if (inTeam) {
            if (save.loadout.length <= 1) { toast('최소 한 병종은 편성해야 한다'); return; }
            save.loadout = save.loadout.filter(id => id !== u.id);
          } else {
            save.loadout.push(u.id);
          }
          saveGame(save);
          renderTraining();
        });
      }
    }
    el.dataset.kind = 'ally';
    el.dataset.teamed = String(inTeam);
    el.dataset.unlocked = String(unlocked);
    box.appendChild(el);
  });

  // 적 도감
  Object.keys(ENEMIES).forEach(key => {
    const e = ENEMIES[key];
    const el = document.createElement('div');
    el.className = 'unit-card foe';
    el.dataset.kind = 'enemy';
    el.innerHTML =
      '<div class="unit-ico"><canvas></canvas></div>' +
      '<div class="unit-body">' +
        '<div class="unit-name">' + e.name +
          '<span class="unit-tag foe-tag">' + (e.boss ? '보스' : '적') + '</span></div>' +
        '<div class="stat-row">' +
          '<span class="stat">체력 ' + e.hp.toLocaleString() + '</span>' +
          '<span class="stat">공격 ' + e.atk + '</span>' +
          '<span class="stat">사거리 ' + e.range + '</span>' +
          (e.ab && e.ab.heal ? '<span class="stat hl">아군 회복</span>' : '') +
          (e.ab && e.ab.poison ? '<span class="stat hl">중독</span>' : '') +
          (e.ab && e.ab.slow ? '<span class="stat hl">둔화</span>' : '') +
          (e.ab && e.ab.kbImmune ? '<span class="stat hl">넉백 면역</span>' : '') +
          (e.ab && e.ab.deathBomb ? '<span class="stat hl">사망 시 폭발</span>' : '') +
          (e.ab && e.ab.summon ? '<span class="stat hl">소환</span>' : '') +
          (e.ab && e.ab.leap ? '<span class="stat hl">도약</span>' : '') +
          (e.ab && e.ab.burrow ? '<span class="stat hl">땅굴</span>' : '') +
          (e.ab && e.ab.revive ? '<span class="stat hl">부활</span>' : '') +
          (e.ab && e.ab.rally ? '<span class="stat hl">지휘</span>' : '') +
          (e.ab && e.ab.weaken ? '<span class="stat hl">저주</span>' : '') +
          (e.area ? '<span class="stat">범위</span>' : '') +
        '</div>' +
      '</div>';
    const tactic = document.createElement('div');
    tactic.className = 'unit-desc';
    tactic.textContent = (e.abText ? e.abText + ' · ' : '') + enemyTactic(e);
    el.querySelector('.unit-body').appendChild(tactic);
    drawUnitIcon(el.querySelector('canvas'), e, 54);
    box.appendChild(el);
  });
  applyTrainingFilter();
}

function applyTrainingFilter() {
  $$('#units-list .unit-card').forEach(el => {
    el.hidden = trainingFilter === 'team' ? el.dataset.teamed !== 'true' :
      trainingFilter === 'ally' ? el.dataset.kind !== 'ally' :
      trainingFilter === 'enemy' ? el.dataset.kind !== 'enemy' : false;
  });
  $$('#training-filters button').forEach(el => {
    el.classList.toggle('on', el.dataset.filter === trainingFilter);
    el.setAttribute('aria-pressed', String(el.dataset.filter === trainingFilter));
  });
}

/* ============================ 소환의 제단 ============================ */
function rarityOf(u) { return u.rarity || 'N'; }

function rollRarity() {
  let total = 0;
  for (const k of RARITY_ORDER) total += RARITY[k].weight;
  let r = Math.random() * total;
  for (const k of RARITY_ORDER) {
    r -= RARITY[k].weight;
    if (r <= 0) return k;
  }
  return 'N';
}

/* 한 번 뽑기: 픽업 시즌 80%, 나머지 시즌 20% */
function pullOne(forceRarity) {
  const pool = gachaPool(save.season);
  let rarity = forceRarity || rollRarity();
  for (let guard = 0; guard < 8; guard++) {
    const useSeason = Math.random() < 0.8 || pool.others.length === 0;
    const src = useSeason ? pool.inSeason : pool.others;
    const list = src.filter(u => rarityOf(u) === rarity);
    if (list.length) return list[Math.floor(Math.random() * list.length)];
    const any = pool.inSeason.concat(pool.others).filter(u => rarityOf(u) === rarity);
    if (any.length) return any[Math.floor(Math.random() * any.length)];
    // 해당 등급이 풀에 없으면 한 단계 낮춘다
    const idx = RARITY_ORDER.indexOf(rarity);
    rarity = RARITY_ORDER[Math.max(0, idx - 1)];
  }
  return pool.inSeason[0];
}

/* 중복이면 레벨 +1 과 골드 환급 */
function grantUnit(u) {
  const cap = unitLevelCap(save.cleared, save.upgrades.academy);
  const dup = !!save.owned[u.id];
  let levelUp = false, gold = 0;
  if (dup) {
    const lv = save.levels[u.id] || 1;
    if (lv < cap) { save.levels[u.id] = lv + 1; levelUp = true; }
    gold = RARITY[rarityOf(u)].refund;
    save.coins += gold;
  } else {
    save.owned[u.id] = true;
    if (!save.levels[u.id]) save.levels[u.id] = 1;
  }
  return { unit: u, dup: dup, levelUp: levelUp, gold: gold };
}

function doPull(count) {
  const cost = count === 10 ? GACHA.tenPull : GACHA.stonePerPull * count;
  if (save.stones < cost) { toast('소환석이 부족하다'); return; }
  save.stones -= cost;

  const got = [];
  let bestIdx = -1, bestRank = -1;
  for (let i = 0; i < count; i++) {
    const u = rollSummon(save, pullOne);
    got.push(u);
    const rank = RARITY_ORDER.indexOf(rarityOf(u));
    if (rank > bestRank) { bestRank = rank; bestIdx = i; }
  }
  // 10회는 영웅 이상 1개 확정
  if (count === 10 && bestRank < RARITY_ORDER.indexOf(GACHA.tenMinRarity)) {
    got[bestIdx] = pullOne(GACHA.tenMinRarity);
    bestRank = RARITY_ORDER.indexOf(GACHA.tenMinRarity);
  }

  const results = got.map(grantUnit);
  syncLoadout();
  addStat('pulls', count);
  saveGame(save);
  checkAchievements();

  if (bestRank >= 3) SFX.command();
  else if (bestRank >= 2) SFX.levelUp();
  else SFX.gold();

  showPullResult(results);
  renderGacha();
}

function showPullResult(results) {
  const box = $('#pull-result');
  const grid = $('#pull-grid');
  grid.innerHTML = '';
  let best = 0;
  results.forEach((r, i) => {
    const rk = rarityOf(r.unit);
    best = Math.max(best, RARITY_ORDER.indexOf(rk));
    const el = document.createElement('div');
    el.className = 'pull-card r-' + rk + (r.dup ? ' dup' : ' fresh');
    el.style.animationDelay = (i * 0.09) + 's';
    el.innerHTML =
      '<div class="pull-rarity">' + RARITY[rk].name + '</div>' +
      '<canvas></canvas>' +
      '<div class="pull-name">' + r.unit.name + '</div>' +
      '<div class="pull-note">' +
        (r.dup ? (r.levelUp ? '레벨 +1 · 💰' + r.gold : '💰' + r.gold)
               : '<b>신규</b>') + '</div>';
    grid.appendChild(el);
    drawUnitIcon(el.querySelector('canvas'), r.unit, 60);
  });
  $('#pull-head').textContent =
    best >= 4 ? '신화 강림!!'
    : (best >= 3 ? '전설 강림!' : (best >= 2 ? '영웅 등장' : '소환 결과'));
  $('#pull-head').className = 'pull-head r-' + RARITY_ORDER[best];
  box.classList.add('show');
}

function renderGacha() {
  $('#gacha-stones').textContent = save.stones;
  $('#gacha-gold').textContent = fmtNum(save.coins);
  $('#tab-stones').textContent = save.stones;
  $('#pity-left').textContent = Math.max(0, GACHA.pity - save.pity);

  // 시즌 탭
  const tabs = $('#season-tabs');
  tabs.innerHTML = '';
  SEASONS.forEach(sn => {
    const b = document.createElement('button');
    b.className = 'season-tab' + (sn.id === save.season ? ' on' : '');
    b.innerHTML = '<span class="s-name">' + sn.name + '</span>' +
                  '<span class="s-sub">' + sn.sub + '</span>';
    b.addEventListener('click', () => {
      save.season = sn.id;
      saveGame(save);
      renderGacha();
      SFX.ui();
    });
    tabs.appendChild(b);
  });

  const sn = seasonById(save.season);
  $('#banner-title').textContent = sn.name;
  $('#banner-sub').textContent = sn.sub;
  $('#banner-desc').textContent = sn.desc;
  $('#banner').style.setProperty('--season', sn.color);
  $('#banner').style.setProperty('--season-dark', sn.accent);

  // 픽업 목록
  const list = $('#banner-list');
  list.innerHTML = '';
  sn.units.forEach(id => {
    const u = UNIT_BY_ID[id];
    const owned = !!save.owned[id];
    const el = document.createElement('div');
    el.className = 'pick r-' + rarityOf(u) + (owned ? ' owned' : '');
    el.innerHTML = '<canvas></canvas>' +
      '<div class="pick-name">' + u.name + '</div>' +
      '<div class="pick-rarity">' + RARITY[rarityOf(u)].name +
      (owned ? ' · 보유' : '') + '</div>';
    list.appendChild(el);
    drawUnitIcon(el.querySelector('canvas'), u, 44);
  });

  // 확률표
  const rate = $('#rate-box');
  let total = 0;
  RARITY_ORDER.forEach(k => { total += RARITY[k].weight; });
  rate.innerHTML = '<div class="rate-title">기본 확률 (확정 제외)</div>' +
    RARITY_ORDER.slice().reverse().map(k =>
      '<div class="rate-row r-' + k + '"><span>' + RARITY[k].name + '</span><span>' +
      (RARITY[k].weight / total * 100).toFixed(1) + '%</span></div>').join('') +
    '<div class="active-desc">신화 확정까지 ' + (GACHA.mythPity-(save.mythPity||0)) + '회 · 전설 확정까지 ' + (GACHA.pity-save.pity) + '회<br>시즌 변경 시 누적 유지 · 신화 획득 시 두 누적 초기화</div>';

  drawBanner(sn);
}

/* 배너 아트: 시즌 대표 병종을 나란히 세운다 */
function drawBanner(sn) {
  const cv = $('#banner-canvas');
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const w = Math.max(200, r.width), h = Math.max(120, r.height);
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(20,16,22,.15)');
  g.addColorStop(1, 'rgba(20,16,22,.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 소환진
  const cx = w / 2, cy = h * 0.9;
  ctx.strokeStyle = sn.accent;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 3; i++) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * (0.2 + i * 0.12), 12 + i * 7, 0, 0, 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const units = sn.units.map(id => UNIT_BY_ID[id]);
  const sc = Math.max(0.7, Math.min(1.5, h / 200));
  units.forEach((u, i) => {
    const n = units.length;
    const x = cx + (i - (n - 1) / 2) * (w / (n + 0.5));
    const own = !!save.owned[u.id];
    ctx.save();
    ctx.translate(x, cy - 6);
    ctx.globalAlpha = own ? 1 : 0.55;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(0, 0, 15 * sc, 4 * sc, 0, 0, 7); ctx.fill();
    drawBody(ctx, u, sc * (u.scale || 1) * 0.85, false, false, i * 1.3, false, 0.3);
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

/* ------------------------------ 전투 ------------------------------ */
function startEndless() {
  battle = new Battle(0, save, makeEndlessStage());
  $('#battle-stage').textContent = '무한 전장 · 최고 ' + (save.endlessBest || 0) + '웨이브';
  beginBattle();
}

function startBattle(index) {
  battle = new Battle(index, save);
  $('#battle-stage').textContent = (index + 1) + '. ' + battle.stage.name;
  beginBattle();
  // 특성 전장은 시작하자마자 무엇이 다른지 크게 알린다
  if (battle.stage.mods) battle.announce('전장 특성 · ' + battle.stage.mods.map(m => STAGE_MODS[m].name).join(' · '), 3.2);
}

function beginBattle() {
  clearTimeout(resultTimer);
  if (renderer) { renderer.syncGlSize(); renderer.resetFx(); }
  playAccum = 0;
  $('#result').classList.remove('show');
  battle.speed = Settings.get('keepSpeed') ? Settings.get('speed') : 1;
  $('#btn-speed').textContent = '▶▶ ' + battle.speed + 'x';
  $('#btn-pause').textContent = '❚❚';
  bossMusic = false;
  bossMusicT = 0;
  BGM.play('battle');
  setPaused(false);
  autoTimer = 0;
  refreshAutoBtn();
  save.stats.battles++;
  buildCards();
  show('scr-battle');
  if (!save.tutorial) {
    save.tutorial = true;
    saveGame(save);
    $('#modal-tutorial').classList.add('show');
    setPaused(true);
  }
  renderer.cam = renderer.camTarget = renderer.clampCam(ALLY_SPAWN_X + 200);
  renderer.dragUntil = 0;
  lastTs = 0;
}

function buildCards() {
  const box = $('#cards');
  box.innerHTML = '';
  battle.roster.forEach((u, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.dataset.id = u.id;
    b.style.setProperty('--role', unitRoleColor(u));
    b.title = u.name + ' · ' + u.role + '\n' + (u.abText || u.desc) + '\n단축키 ' + ((i + 1) % 10);
    b.setAttribute('aria-label', u.name + ' 출진, 비용 ' + u.cost);
    b.innerHTML =
      '<canvas class="c-ico"></canvas>' +
      '<div class="c-lv">Lv' + (save.levels[u.id] || 1) + '</div>' +
      '<div class="c-name">' + (u.short || u.name) + '</div>' +
      '<div class="c-role">' + u.role + '</div>' +
      '<div class="c-cost">' + u.cost + '</div>' +
      '<span class="c-key">' + ((i + 1) % 10) + '</span>' +
      '<div class="cool hide"></div>' +
      (u.active ? '<div class="c-act hide"><span class="c-act-k"></span><span class="c-act-v"></span></div>' : '');
    if (u.active) {
      b.classList.add('has-active');
      b.style.setProperty('--hero', u.accent);
      b.title += '\n' + u.active.name + ' — ' + u.active.desc + '\n(출전 중에 한 번 더 누르면 발동)';
    }
    drawUnitIcon(b.querySelector('.c-ico'), u, 38);
    b.addEventListener('click', () => onCardTap(u));
    box.appendChild(b);
  });
  cardEls = $$('#cards .card');
}

/* 카드 누르기. 전설·신화가 이미 전장에 서 있으면 출진 대신 액티브를 쓴다. */
function onCardTap(u) {
  if (!canBattleInput()) return;
  if (u.active && battle.heroCaster(u.id)) {
    if (battle.useHeroActive(u.id)) {
      SFX.command();
      buzz(25);
      toast(u.name + ' · ' + u.active.name);
      return;
    }
    const cd = Math.ceil(Math.max(battle.heroCooldowns[u.id] || 0, battle.heroGlobalCd));
    toast(cd > 0 ? u.active.name + ' · ' + cd + '초 남음' : u.active.name + ' · 대상 없음');
    return;
  }
  if (battle.cooldowns[u.id] > 0) { toast('아직 쿨타임이다'); return; }
  if (battle.money < u.cost) { toast('군자금이 부족하다'); return; }
  if (!battle.deploy(u.id)) toast('동시 출진 한도에 도달했다');
  else buzz(8);
}

let cardEls = [];

let paused = false;
let autoTimer = 0;
let playAccum = 0;
let resultTimer = null;
function canBattleInput() {
  return battle && battle.state === 'play' && !paused && !$('.modal.show') &&
    $('#scr-battle').classList.contains('active');
}
function setPaused(value) {
  paused = value;
  $('#btn-pause').textContent = paused ? '▶' : '❚❚';
  $('#btn-pause').setAttribute('aria-label', paused ? '전투 재개' : '일시정지');
  $('#pause-label').hidden = !paused;
}

function refreshAutoBtn() {
  const b = $('#btn-auto');
  if (!b) return;
  b.textContent = save.auto ? '자동 켜짐' : '자동 꺼짐';
  b.classList.toggle('on', !!save.auto);
}

/* 자동 출진: 낼 수 있는 카드 중 비싼 순으로 하나씩 내보낸다 */
function autoDeploy(dt) {
  if (!save.auto || !battle || battle.state !== 'play') return;
  autoTimer -= dt;
  if (autoTimer > 0) return;
  autoTimer = 0.35;
  const ready = battle.roster
    .filter(u => battle.canDeploy(u.id))
    .sort((a, b) => b.cost - a.cost);
  if (ready.length) battle.deploy(ready[0].id);
}

function updateHud() {
  const money = Math.floor(battle.money);
  $('#kill-count').textContent = battle.kills;
  // 증원이 돌기 시작하면 남은 적을 셀 수 없다
  $('#foe-left').textContent = (battle.endless || battle.reinforcing()) ? '∞' : battle.foesLeft();
  const cmdBtn = $('#btn-command');
  const ready = battle.canCommand();
  cmdBtn.disabled = !canBattleInput() || !ready;
  const allyPct = Math.max(0, battle.allyCastle.hp / battle.allyCastle.maxHp * 100);
  const enemyPct = Math.max(0, battle.enemyCastle.hp / battle.enemyCastle.maxHp * 100);
  $('#ally-hp').style.width = allyPct + '%';
  $('#enemy-hp').style.width = enemyPct + '%';
  $('#ally-hp-txt').textContent = Math.ceil(allyPct) + '%';
  $('#enemy-hp-txt').textContent = Math.ceil(enemyPct) + '%';
  $('#castle-status').classList.toggle('critical', allyPct < 30);
  const wave = battle.nextWave();
  // 무한 전장은 지금 몇 웨이브째이고 적이 얼마나 세졌는지를 먼저 보여 준다
  const endlessTag = battle.endless
    ? '웨이브 ' + battle.currentWave() + ' · 적 ×' + endlessMul(battle.currentWave() - 1).toFixed(1) + ' · ' : '';
  $('#wave-preview').textContent = endlessTag + (wave
    ? (wave.boss ? '보스 예고 · ' : (wave.reinforce ? '끝없는 증원 · ' : '다음 증원 · ')) +
      wave.name + ' ' + wave.seconds + '초'
    : '마지막 웨이브 · 남은 적을 처치하라');
  $('#wave-preview').classList.toggle('boss-warning', !!wave && wave.boss);
  $('#battle-clock').textContent = Math.floor(battle.time / 60) + ':' + String(Math.floor(battle.time % 60)).padStart(2, '0');
  cmdBtn.classList.toggle('ready', ready);
  $('#cmd-cd').textContent = ready ? '준비'
    : (battle.cmdCd > 0 ? Math.ceil(battle.cmdCd) : '대기');
  $('#money-txt').textContent = money;
  $('#wallet-txt').textContent = battle.walletMax;
  $('#wallet-fill').style.width = (battle.money / battle.walletMax * 100) + '%';
  cardEls.forEach(el => {
    const id = el.dataset.id;
    const cd = battle.cooldowns[id];
    const cool = el.querySelector('.cool');
    const u = UNIT_BY_ID[id];
    // 전설·신화가 전장에 서 있으면 카드는 액티브 버튼이 된다
    const alive = !!(u.active && battle.heroCaster(id));
    el.classList.toggle('alive', alive);
    if (u.active) {
      const act = el.querySelector('.c-act');
      act.classList.toggle('hide', !alive);
      if (alive) {
        const acd = Math.max(battle.heroCooldowns[id] || 0, battle.heroGlobalCd);
        const ready = battle.canHeroActive(id);
        el.classList.toggle('act-ready', ready);
        const k = acd > 0 && !ready ? '충전' : '필살';
        const v = ready ? '발동!' : (acd > 0 ? Math.ceil(acd) + '초' : '대상 없음');
        const kEl = act.querySelector('.c-act-k'), vEl = act.querySelector('.c-act-v');
        if (kEl.textContent !== k) kEl.textContent = k;
        if (vEl.textContent !== v) vEl.textContent = v;
        el.style.setProperty('--act', (u.active.cd ? Math.min(1, acd / u.active.cd) : 0) * 100 + '%');
        el.setAttribute('aria-label', u.name + ' ' + u.active.name + ' ' + v);
      } else {
        el.classList.remove('act-ready');
        el.setAttribute('aria-label', u.name + ' 출진, 비용 ' + u.cost);
      }
    }
    if (cd > 0 && !alive) { cool.classList.remove('hide'); cool.textContent = cd.toFixed(1); }
    else cool.classList.add('hide');
    el.classList.toggle('poor', !alive && money < u.cost);
    el.classList.toggle('available', alive ? battle.canHeroActive(id) : battle.canDeploy(id));
    el.setAttribute('aria-disabled', String(!canBattleInput() || !(battle.canDeploy(id) || (u.active && battle.canHeroActive(id)))));
    const max = UNIT_BY_ID[id].cooldown * battle.cdMul;
    el.style.setProperty('--cooldown', (max ? cd / max * 100 : 0) + '%');
  });
}

/* 전투에 쏟은 시간을 기록에 옮긴다. 전투를 포기하고 나가도 시간은 남긴다. */
function flushPlayTime() {
  if (playAccum <= 0) return;
  save.stats.playSec += Math.round(playAccum);
  playAccum = 0;
}

function showResult() {
  // 누적 기록과 임무 진행
  flushPlayTime();
  save.stats.bossKills += battle.bossKills || 0;
  addStat('kills', battle.kills);
  addStat('bosses', battle.bossKills || 0);
  if (battle.endless) addStat('endless', battle.wavesCleared || 0);
  if (battle.state === 'win') {
    save.stats.wins++;
    addStat('wins', 1);
    if (battle.stars >= 3) addStat('perfect', 1);
  }
  saveGame(save);
  checkAchievements();

  if (battle.endless) { showEndlessResult(); return; }

  const win = battle.state === 'win';
  $('#result-title').textContent = win ? '승 리' : '패 배';
  $('#result-stars').innerHTML = win
    ? starMarks(battle.stars) + (battle.newStars ? '<span class="new-star">신규</span>' : '')
    : '';
  const lines = [];
  lines.push('획득 골드 💰 ' + battle.coins +
             (battle.starBonus ? '  (별 보너스 ' + battle.starBonus + ')' : ''));
  lines.push('처치 ' + battle.kills + '  ·  남은 성채 ' +
             Math.round(battle.allyCastle.hp / battle.allyCastle.maxHp * 100) + '%');
  if (win) {
    const nextUnit = ROSTER_UNITS.find(u => u.unlockStage === battle.stageIndex + 2);
    if (nextUnit) lines.push('새 병종 해금: ' + nextUnit.name);
    if (battle.stars < 3) lines.push('성채를 더 지키면 별 3개를 받는다.');
    if (battle.stoneGain) lines.push('소환석 🔮 +' + battle.stoneGain);
    if (battle.stageIndex + 1 >= STAGES.length) lines.push('왕국 방어전 전 전장 제패!');
  } else {
    lines.push('강화를 올리거나 편성을 바꿔 보자.');
  }
  $('#result-desc').textContent = lines.join('\n');
  const hasNext = win && battle.stageIndex + 1 < STAGES.length;
  $('#btn-next').style.display = hasNext ? '' : 'none';
  $('#result').classList.add('show');
}

function showEndlessResult() {
  $('#result-title').textContent = battle.newRecord ? '신기록!' : '전투 종료';
  $('#result-stars').innerHTML =
    '<span class="wave-count">' + (battle.wavesCleared || 0) + '</span> 웨이브';
  const lines = [];
  lines.push('최고 기록 ' + (save.endlessBest || 0) + ' 웨이브');
  lines.push('획득 골드 💰 ' + battle.coins +
             (battle.stoneGain ? '  ·  소환석 🔮 ' + battle.stoneGain : ''));
  lines.push('처치 ' + battle.kills);
  $('#result-desc').textContent = lines.join('\n');
  $('#btn-next').style.display = 'none';
  $('#btn-retry').textContent = '다시 도전';
  $('#result').classList.add('show');
}

/* ------------------------------ 루프 ------------------------------ */
let bossMusic = false, bossMusicT = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  if (!lastTs) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (dt > 0.1) dt = 0.1;

  if (titleAnim.on) { drawTitle(dt); return; }
  if (!battle || !$('#scr-battle').classList.contains('active')) return;

  const before = battle.state;
  if (!paused && !$('.modal.show')) {
    autoDeploy(dt * battle.speed);
    battle.update(dt);
    if (battle.state === 'play') playAccum += dt;
  }
  else battle.updateFx(dt * 0.4);
  renderer.render(battle, dt, (paused || $('.modal.show')) ? dt * 0.4 : dt);
  updateHud();
  // 보스가 서면 곡을 바꾼다. 매 프레임 적을 훑을 필요는 없다.
  if (!bossMusic && battle.state === 'play' && (bossMusicT -= dt) <= 0) {
    bossMusicT = 0.5;
    if (battle.aliveBoss()) { bossMusic = true; BGM.play('boss'); }
  }
  if (before === 'play' && battle.state !== 'play') {
    BGM.stop(0.6);
    const ended = battle;
    resultTimer = setTimeout(() => {
      if (battle === ended && $('#scr-battle').classList.contains('active')) showResult();
    }, 700);
  }
}

/* ------------------------------ 입력 ------------------------------ */
function bindCanvasDrag(cv) {
  let dragging = false, lastX = 0, moved = 0;
  const down = x => { dragging = true; lastX = x; moved = 0; };
  const move = x => {
    if (!dragging) return;
    const dx = x - lastX;
    lastX = x;
    moved += Math.abs(dx);
    if (moved > 4) renderer.panBy(dx);
  };
  const up = () => { dragging = false; };

  cv.addEventListener('touchstart', e => down(e.touches[0].clientX), { passive: true });
  cv.addEventListener('touchmove', e => { move(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchend', up);
  cv.addEventListener('mousedown', e => down(e.clientX));
  window.addEventListener('mousemove', e => move(e.clientX));
  window.addEventListener('mouseup', up);
}

/* ------------------------------ 초기화 ------------------------------ */
/* 전체화면 + 가로 고정 시도 (지원하는 기기에서만 동작) */
function toggleFullscreen() {
  const el = document.documentElement;
  const lock = () => {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  };
  if (!document.fullscreenElement) {
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      const r = req.call(el);
      if (r && r.then) r.then(lock).catch(() => toast('전체화면을 지원하지 않는 기기다'));
      else lock();
    } else {
      toast('전체화면을 지원하지 않는 기기다');
    }
  } else {
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    document.exitFullscreen();
  }
}

/* --------------------- 타이틀 연출 --------------------- */
const titleAnim = { on: true, t: 0, cast: null, cv: null, ctx: null, w: 0, h: 0 };

function titleCast() {
  const allies = ['spear', 'shield', 'knight', 'archer', 'berserk', 'priest', 'duelist'];
  const foes = ['goblin', 'orcspear', 'ogre', 'wolf', 'dark', 'shaman', 'warlord'];
  const cast = [];
  allies.forEach((id, i) => {
    cast.push({ st: UNIT_BY_ID[id], dir: 1, base: -70 - i * 52, sc: 1, ph: i * 1.3,
                rate: 0.9 + (i % 3) * 0.25 });
  });
  foes.forEach((id, i) => {
    const e = ENEMIES[id];
    cast.push({ st: e, dir: -1, base: 70 + i * 54, sc: e.scale || 1, ph: 0.6 + i * 1.1,
                rate: 0.85 + (i % 3) * 0.3 });
  });
  return cast;
}

function resizeTitle() {
  const cv = titleAnim.cv;
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  titleAnim.w = Math.max(320, r.width);
  titleAnim.h = Math.max(240, r.height);
  cv.width = Math.round(titleAnim.w * dpr);
  cv.height = Math.round(titleAnim.h * dpr);
  titleAnim.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawTitle(dt) {
  const A = titleAnim;
  if (!A.cv) return;
  const ctx = A.ctx, w = A.w, h = A.h;
  if (!w || !h) return;
  A.t += dt;
  const t = A.t;
  const groundY = h * 0.86;

  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#2f3f57');
  sky.addColorStop(0.55, '#8d7f8e');
  sky.addColorStop(1, '#e3b988');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 저무는 해
  ctx.fillStyle = 'rgba(255,214,150,.35)';
  ctx.beginPath(); ctx.arc(w * 0.5, groundY - 40, 92, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,236,196,.85)';
  ctx.beginPath(); ctx.arc(w * 0.5, groundY - 40, 58, 0, 7); ctx.fill();

  // 구름
  ctx.fillStyle = 'rgba(40,36,50,.35)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 300 - t * 8) % (w + 600) + w + 600) % (w + 600) - 300;
    const cy = 40 + ((i * 37) % 4) * 26;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, 7);
    ctx.arc(cx + 28, cy + 6, 22, 0, 7);
    ctx.arc(cx - 28, cy + 7, 19, 0, 7);
    ctx.fill();
  }

  // 산맥
  const ridge = (color, amp, step, base) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, groundY + 10);
    for (let x = -step; x < w + step * 2; x += step) {
      ctx.lineTo(x, groundY - base);
      ctx.lineTo(x + step / 2, groundY - base - amp);
    }
    ctx.lineTo(w + 20, groundY + 10);
    ctx.closePath(); ctx.fill();
  };
  ridge('rgba(60,58,80,.75)', 120, 210, 30);
  ridge('rgba(40,40,56,.9)', 76, 140, 6);

  // 성채 실루엣
  ctx.fillStyle = 'rgba(28,28,38,.95)';
  const cw = 90, ch = 120;
  ctx.fillRect(18, groundY - ch, cw, ch);
  for (let i = 0; i < 4; i++) ctx.fillRect(18 + i * 24, groundY - ch - 14, 15, 16);
  ctx.fillRect(w - 18 - cw, groundY - ch, cw, ch);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(w - 18 - cw + i * 19, groundY - ch);
    ctx.lineTo(w - 18 - cw + i * 19 + 9, groundY - ch - 20);
    ctx.lineTo(w - 18 - cw + i * 19 + 18, groundY - ch);
    ctx.closePath(); ctx.fill();
  }

  // 땅
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = '#2b2431';
  ctx.fillRect(0, groundY, w, 4);

  // 부대
  if (!A.cast) A.cast = titleCast();
  const cx = w / 2;
  const sc = Math.max(0.55, Math.min(1.0, h / 560));
  A.cast.forEach(c => {
    const push = Math.sin(t * 0.7 + c.ph) * 7;
    const x = cx + (c.base + push * c.dir) * sc * 1.25;
    if (x < -60 || x > w + 60) return;
    const swing = 0.5 + 0.5 * Math.sin(t * c.rate * 3 + c.ph);
    ctx.save();
    ctx.translate(x, groundY + 4);
    ctx.scale(c.dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, 16 * sc * c.sc, 4 * sc, 0, 0, 7); ctx.fill();
    drawBody(ctx, c.st, sc * c.sc, false, false, t * 3 + c.ph, false, swing);
    ctx.restore();
  });

  // 불티
  ctx.fillStyle = 'rgba(255,200,120,.75)';
  for (let i = 0; i < 22; i++) {
    const sp = 14 + (i % 5) * 6;
    const ex = ((i * 137 + t * sp) % (w + 80)) - 40;
    const ey = groundY - ((t * (18 + (i % 4) * 7) + i * 91) % (groundY * 0.8));
    ctx.globalAlpha = 0.15 + 0.5 * (ey / groundY);
    ctx.fillRect(ex, ey, 2.4, 2.4);
  }
  ctx.globalAlpha = 1;

  // 아래쪽 어둡게
  const vg = ctx.createLinearGradient(0, h * 0.55, 0, h);
  vg.addColorStop(0, 'rgba(20,16,22,0)');
  vg.addColorStop(1, 'rgba(20,16,22,.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
}

function refreshTitleBadges() {
  $('#badge-progress').textContent = '돌파 ' + save.cleared + ' / ' + STAGES.length;
  $('#badge-gold').textContent = '💰 ' + fmtNum(save.coins);
  $('#badge-stones').textContent = '🔮 ' + save.stones;
  // 이어하기: 지금 도전할 전장으로 바로 들어간다 (첫 판은 진군도에서 안내를 보고 시작)
  const cont = $('#btn-continue');
  const next = save.cleared < STAGES.length ? save.cleared : -1;
  cont.hidden = !(save.cleared >= 1 && next >= 0);
  if (!cont.hidden) $('#continue-stage').textContent = (next + 1) + '. ' + STAGES[next].name;
}

function init() {
  renderer = new Renderer($('#cv'));
  // 필살 연출용 WebGL 레이어. 못 만들면 renderer 가 Canvas2D 연출로 되돌아간다.
  if (typeof GLFx !== 'undefined') {
    const glfx = new GLFx($('#cv-fx'));
    if (glfx.ok) {
      renderer.glfx = glfx;
      renderer.syncGlSize();
      window.addEventListener('resize', () => renderer.syncGlSize());
      // Canvas2D 때문에 4개로 묶어 두었던 제한을 넓힌다. 다만 무한정은 아니다 —
      // 가산 합성이라 너무 많이 겹치면 화면이 빛으로 덮여 전장이 안 보인다.
      if (typeof setCastLimits === 'function') setCastLimits(8, 3);
    }
  }
  SFX.init();
  // 예전 저장의 '효과음 끔' 은 효과음 크기 0 으로 옮긴다
  if (save.sound === false) { Settings.set('sfx', 0); save.sound = true; saveGame(save); }
  SFX.setVolume(Settings.get('sfx'));
  BGM.setVolume(Settings.get('bgm'));
  BGM.play('title');
  // 모바일은 사용자 조작이 한 번 있어야 오디오가 열린다
  const wake = () => { SFX.init(); SFX.resume(); BGM.resume(); };
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
    window.addEventListener(ev, wake, { once: true, passive: true }));
  titleAnim.cv = $('#title-bg');
  titleAnim.ctx = titleAnim.cv.getContext('2d');
  resizeTitle();
  refreshTitleBadges();
  bindCanvasDrag($('#cv'));

  initSaveManager();
  $('#btn-start').addEventListener('click', () => {
    if (SaveStore.blocked) { $('#modal-save').classList.add('show'); return; }
    show('scr-map');
  });
  $('#btn-continue').addEventListener('click', () => {
    if (SaveStore.blocked) { $('#modal-save').classList.add('show'); return; }
    if (save.cleared < STAGES.length) startBattle(save.cleared);
  });
  $('#btn-howto').addEventListener('click', () => $('#modal-howto').classList.add('show'));
  $$('[data-close]').forEach(b => b.addEventListener('click',
    () => b.closest('.modal').classList.remove('show')));
  $('#modal-howto').addEventListener('click', e => {
    if (e.target.id === 'modal-howto') e.target.classList.remove('show');
  });
  $('#btn-reset').addEventListener('click', () => {
    askConfirm('기록 초기화',
      '진행도와 소환한 병종까지 전부 사라진다. 정말 지울까?', () => {
        const fresh = defaultSave();
        if (!SaveStore.write(fresh, true)) { toast(SaveStore.error); return; }
        save = fresh;
        refreshTitleBadges();
        toast('기록을 초기화했다');
      });
  });
  $('#confirm-yes').addEventListener('click', () => {
    $('#modal-confirm').classList.remove('show');
    const fn = confirmYes; confirmYes = null;
    if (fn) fn();
  });
  $('#confirm-no').addEventListener('click', () => {
    $('#modal-confirm').classList.remove('show');
    confirmYes = null;
    SFX.ui();
  });
  $('#btn-tutorial-close').addEventListener('click', () => {
    $('#modal-tutorial').classList.remove('show');
    setPaused(false);
    SFX.ui();
  });
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => show(b.dataset.goto)));
  $('#btn-shop').addEventListener('click', () => show('scr-shop'));
  $('#btn-units').addEventListener('click', () => show('scr-units'));
  $('#btn-gacha').addEventListener('click', () => show('scr-gacha'));
  $('#btn-quest').addEventListener('click', () => show('scr-quest'));
  $$('#quest-tabs .season-tab').forEach(b =>
    b.addEventListener('click', () => { renderQuest(b.dataset.qtab); SFX.ui(); }));
  $('#btn-auto').addEventListener('click', () => {
    save.auto = !save.auto;
    saveGame(save);
    refreshAutoBtn();
    toast(save.auto ? '자동 출진을 켰다' : '자동 출진을 껐다');
    SFX.ui();
  });
  $('#btn-pull1').addEventListener('click', () => doPull(1));
  $('#btn-pull10').addEventListener('click', () => doPull(10));
  $('#btn-buy-stone').addEventListener('click', () => {
    if (save.coins < GACHA.goldPerStone) { toast('골드가 부족하다'); return; }
    save.coins -= GACHA.goldPerStone;
    save.stones++;
    saveGame(save);
    renderGacha();
    SFX.gold();
    toast('소환석을 하나 얻었다');
  });
  $('#btn-pull-close').addEventListener('click', () => {
    $('#pull-result').classList.remove('show');
    SFX.ui();
  });

  $('#btn-quit').addEventListener('click', () => {
    if (battle && battle.state === 'play') {
      askConfirm('전투 포기', '지금까지의 전과를 버리고 진군도로 돌아갈까?',
                 () => { flushPlayTime(); saveGame(save); show('scr-map'); });
      return;
    }
    flushPlayTime();
    saveGame(save);
    show('scr-map');
  });
  $('#btn-speed').addEventListener('click', () => {
    battle.speed = battle.speed === 1 ? 2 : (battle.speed === 2 ? 3 : 1);
    $('#btn-speed').textContent = '▶▶ ' + battle.speed + 'x';
    Settings.set('speed', battle.speed);
    SFX.ui();
  });
  $('#btn-pause').addEventListener('click', () => {
    if ($('.modal.show') || !battle || battle.state !== 'play') return;
    setPaused(!paused);
    toast(paused ? '일시정지' : '재개');
    SFX.ui();
  });
  $('#btn-command').addEventListener('click', () => {
    if (!canBattleInput()) return;
    if (!battle.canCommand()) { toast('왕명은 아직 준비되지 않았다'); return; }
    battle.useCommand();
  });
  initSettings();
  initFormation();
  $('#btn-retry').addEventListener('click', () => {
    if (battle && battle.endless) startEndless();
    else startBattle(battle.stageIndex);
  });
  $('#btn-next').addEventListener('click', () => {
    $('#btn-retry').textContent = '다시 싸운다';
    startBattle(battle.stageIndex + 1);
  });
  $('#btn-tomap').addEventListener('click', () => {
    $('#btn-retry').textContent = '다시 싸운다';
    show('scr-map');
  });

  $('#btn-full').addEventListener('click', toggleFullscreen);
  window.addEventListener('resize', () => {
    if (renderer) renderer.resize();
    resizeTitle();
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { if (renderer) renderer.resize(); resizeTitle(); }, 250);
  });
  $$('#training-filters button').forEach(el => el.addEventListener('click', () => {
    trainingFilter = el.dataset.filter;
    applyTrainingFilter();
  }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && battle && battle.state === 'play') setPaused(true);
    // 앱이 뒤로 가면 음악도 멈춘다 (배터리)
    if (SFX.ctx) { if (document.hidden) SFX.ctx.suspend(); else SFX.ctx.resume(); }
    lastTs = 0;
  });
  window.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (!battle || battle.state !== 'play' || !$('#scr-battle').classList.contains('active') || $('.modal.show')) return;
    if (e.code === 'Space') { e.preventDefault(); $('#btn-pause').click(); return; }
    if (!canBattleInput()) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); const i = (Number(e.key) + 9) % 10; if (cardEls[i]) cardEls[i].click(); }
    if (e.key.toLowerCase() === 'q') $('#btn-command').click();
    if (e.key.toLowerCase() === 'a') $('#btn-auto').click();
    if (e.key.toLowerCase() === 'f') { renderer.dragUntil = 0; }
  });
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', init);

/* ------------------------------ 설정 ------------------------------ */
function refreshSettingsUI() {
  const d = Settings.d;
  $$('#modal-settings .seg').forEach(seg => {
    const key = seg.id.replace('set-', '');
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.v === d[key]);
      b.setAttribute('aria-pressed', String(b.dataset.v === d[key]));
    });
  });
  for (const k of ['bgm', 'sfx']) {
    $('#set-' + k).value = Math.round(d[k] * 100);
    $('#set-' + k + '-v').textContent = Math.round(d[k] * 100);
  }
  for (const k of ['vibrate', 'dmgNums', 'shake', 'keepSpeed']) {
    $('#set-' + k).setAttribute('aria-checked', String(!!d[k]));
  }
}

function openSettings() {
  refreshSettingsUI();
  $('#modal-settings').classList.add('show');
  if (battle && battle.state === 'play' && $('#scr-battle').classList.contains('active')) setPaused(true);
  SFX.ui();
}

function initSettings() {
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-map-settings').addEventListener('click', openSettings);
  $('#btn-battle-settings').addEventListener('click', openSettings);
  $$('#set-lang button').forEach(b => b.addEventListener('click', () => {
    if (Settings.get('lang') === b.dataset.v) return;
    if (battle && battle.state === 'play' && $('#scr-battle').classList.contains('active')) {
      toast('전투 중에는 언어를 바꿀 수 없다');
      return;
    }
    Settings.set('lang', b.dataset.v);
    saveGame(save);
    // 글자는 화면 곳곳과 병종 자료에 박혀 있어서, 다시 여는 편이 확실하다
    location.reload();
  }));
  $$('#set-quality button').forEach(b => b.addEventListener('click', () => {
    Settings.set('quality', b.dataset.v);
    if (renderer) { renderer.resize(); renderer.syncGlSize(); }
    refreshSettingsUI();
    SFX.ui();
  }));
  $('#set-bgm').addEventListener('input', e => {
    const v = Number(e.target.value) / 100;
    Settings.set('bgm', v);
    BGM.setVolume(v);
    $('#set-bgm-v').textContent = e.target.value;
  });
  $('#set-sfx').addEventListener('input', e => {
    const v = Number(e.target.value) / 100;
    Settings.set('sfx', v);
    SFX.setVolume(v);
    $('#set-sfx-v').textContent = e.target.value;
  });
  $('#set-sfx').addEventListener('change', () => SFX.ui());
  for (const k of ['vibrate', 'dmgNums', 'shake', 'keepSpeed']) {
    $('#set-' + k).addEventListener('click', () => {
      Settings.set(k, !Settings.get(k));
      refreshSettingsUI();
      if (k === 'vibrate') buzz(20);
      SFX.ui();
    });
  }
}

/* 안드로이드 뒤로 가기 처리. true 를 돌려주면 앱이 닫히지 않는다. */
window.__androidBack = function () {
  const open = document.querySelector('.modal.show');
  if (open) {
    if (open.id === 'modal-tutorial') $('#btn-tutorial-close').click();
    else if (open.id === 'modal-confirm') $('#confirm-no').click();
    else open.classList.remove('show');
    return true;
  }
  if ($('#pull-result').classList.contains('show')) { $('#btn-pull-close').click(); return true; }
  const active = document.querySelector('.screen.active');
  if (!active) return false;
  if (active.id === 'scr-battle') {
    $('#btn-quit').click();
    return true;
  }
  if (active.id === 'scr-formation') { if (fmDrag) { dragEnd(); return true; } show(fmBack); return true; }
  if (['scr-shop','scr-units','scr-gacha','scr-quest'].includes(active.id)) { show('scr-map'); return true; }
  if (active.id === 'scr-map') { show('scr-title'); return true; }
  return false;   // 타이틀에서는 앱 종료
};

window.__androidPause = function () {
  if (battle && battle.state === 'play') setPaused(true);
  saveGame(save);
};

// 오프라인 지원 (http/https 로 열었을 때만)
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}


function backupText() {
  if (SaveStore.blocked) return localStorage.getItem(SAVE_KEY) || localStorage.getItem(SAVE_KEY + '-damaged') || '';
  return SaveStore.export(save);
}
function initSaveManager() {
  const notice = $('#save-warning');
  notice.textContent = SaveStore.error; notice.hidden = !SaveStore.blocked;
  if (SaveStore.recovered) toast('이전 자동 백업으로 진행도를 복구했습니다.');
  $('#btn-save-manager').addEventListener('click', () => $('#modal-save').classList.add('show'));
  $('#btn-export-save').addEventListener('click', () => {
    try {
      const raw = backupText();
      $('#save-text').value = raw;
      if (window.AndroidSave) { window.AndroidSave.exportSave(raw); return; }
      const url = URL.createObjectURL(new Blob([raw], {type:'application/json'}));
      const a = document.createElement('a'); a.href=url; a.download='stick-kingdom-backup.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast('백업을 만들지 못했습니다: ' + e.message); }
  });
  $('#btn-import-save').addEventListener('click', () => {
    if (window.AndroidSave) window.AndroidSave.importSave();
    else $('#save-file').click();
  });
  $('#save-file').addEventListener('change', async e => {
    const f=e.target.files[0]; e.target.value=''; if (!f) return;
    if (f.size>1048576) { toast('1MB 이하의 백업 파일을 선택해 주세요.'); return; }
    try { window.receiveSaveBackup(await f.text()); }
    catch (err) { toast('백업 파일을 읽지 못했습니다. 다른 파일을 선택해 주세요.'); }
  });
  $('#btn-previous-save').addEventListener('click', () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY + '-restore-point') || localStorage.getItem(SaveStore.backupKey);
      if (!raw) { toast('남아 있는 이전 백업이 없습니다.'); return; }
      window.receiveSaveBackup(raw);
    } catch (e) { toast('이전 백업을 읽지 못했습니다.'); }
  });
  $('#btn-restore-text').addEventListener('click', () => window.receiveSaveBackup($('#save-text').value));
}
window.receiveSaveBackup = function(raw) {
  try {
    const candidate = normalizeSave(SaveStore.parse(raw));
    askConfirm('진행도 복원', '전장 ' + candidate.cleared + '개 돌파 · 골드 ' + candidate.coins +
      ' · 소환석 ' + candidate.stones + '. 이 데이터로 교체할까요? 현재 저장은 자동 백업에 남깁니다.', () => {
      if (!SaveStore.write(candidate, true)) { toast(SaveStore.error); return; }
      save=candidate;
      $('#modal-save').classList.remove('show'); $('#save-warning').hidden=true;
      show('scr-title'); toast('진행도를 복원했습니다.');
    });
  } catch(e) { toast('복원하지 않았습니다: ' + e.message); }
};
