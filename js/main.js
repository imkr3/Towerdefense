/* =======================================================================
 *  막대 왕국 전쟁 - 화면 전환 / 저장 / 메인 루프
 * ======================================================================= */

const SAVE_KEY = 'stick-kingdom-save-v1';

function defaultSave() {
  const lv = {};
  UNITS.forEach(u => { lv[u.id] = 1; });
  return {
    cleared: 0, coins: 0,
    upgrades: { wallet: 0, income: 0, power: 0, vitality: 0, castle: 0 },
    levels: lv, loadout: ['spear'], knownUnits: ['spear'],
    stars: {}, totalKills: 0, sound: true,
    owned: {}, stones: 3, pity: 0, season: 'olympus', pulls: 0, tutorial: false,
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
    if (!known.has(u.id) && save.loadout.length < LOADOUT_MAX && !save.loadout.includes(u.id)) {
      save.loadout.push(u.id);
    }
  });
  if (!save.loadout.length && unlocked.length) save.loadout.push(unlocked[0].id);
  save.loadout = save.loadout.slice(0, LOADOUT_MAX);
  save.knownUnits = unlocked.map(u => u.id);
  saveGame(save);
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = Object.assign(defaultSave(), JSON.parse(raw));
    const d = defaultSave();
    s.upgrades = Object.assign(d.upgrades, s.upgrades || {});
    s.levels = Object.assign(d.levels, s.levels || {});
    s.cleared = Math.max(0, Math.min(STAGES.length, s.cleared | 0));
    // 상한을 넘긴 레벨은 잘라낸다
    const cap = unitLevelCap(s.cleared, s.upgrades.academy);
    UNITS.forEach(u => {
      s.levels[u.id] = Math.max(1, Math.min(cap, s.levels[u.id] | 0 || 1));
    });
    if (!Array.isArray(s.loadout)) s.loadout = [];
    if (!Array.isArray(s.knownUnits) || !Object.prototype.hasOwnProperty.call(JSON.parse(raw), 'knownUnits')) {
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
    return s;
  } catch (e) { return defaultSave(); }
}

function saveGame(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {}
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
  if (id === 'scr-gacha') renderGacha();
  if (id === 'scr-quest') { checkAchievements(); renderQuest(); }
  if (id === 'scr-battle' && renderer) renderer.resize();
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
  $('#quest-gold').textContent = save.coins;
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
      ['무한 전장 최고 기록', (save.endlessBest || 0) + '파도'],
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
function renderMap() {
  $('#map-coins').textContent = save.coins;
  renderEndlessSlot();
  updateQuestBadge();
  const pct = (save.cleared / STAGES.length) * 100;
  $('#map-progress').style.width = pct + '%';
  let totalStars = 0;
  for (const k in save.stars) totalStars += save.stars[k];
  $('#map-progress-txt').innerHTML =
    save.cleared + ' / ' + STAGES.length + ' <span class="gold-txt">★ ' +
    totalStars + ' / ' + (STAGES.length * 3) + '</span>';

  const list = $('#stage-list');
  list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const locked = i > save.cleared;
    const cleared = i < save.cleared;
    const el = document.createElement('button');
    el.type = 'button';
    el.disabled = locked;
    el.className = 'stage' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '') +
                   (st.boss ? ' boss' : '') + (i === save.cleared ? ' current' : '');
    el.style.setProperty('--field', FIELD_PALETTES[i % FIELD_PALETTES.length].ridge);
    el.innerHTML =
      '<div class="stage-no">' + (locked ? '🔒' : (i + 1)) + '</div>' +
      '<div class="stage-info">' +
        '<div class="stage-name">' + (locked ? '???' : st.name) + '</div>' +
        '<div class="stage-meta">' + (locked ? '이전 전장을 먼저 돌파해야 한다' :
            ('적 요새 ' + st.baseHp.toLocaleString() + ' · 보상 💰' + st.reward)) + '</div>' +
      '</div>' +
      '<div class="stage-mark">' +
        (locked ? '' : (cleared || i < save.cleared
          ? starMarks(save.stars[i] || 0) : '▶')) + '</div>';
    if (!locked) {
      const intel = document.createElement('div');
      intel.className = 'stage-intel';
      const types = [...new Set(st.waves.map(w => w.e))];
      intel.textContent = types.slice(0, 3).map(id => ENEMIES[id].name).join(' · ') + (types.length > 3 ? ' 외 ' + (types.length - 3) + '종' : '');
      el.querySelector('.stage-info').appendChild(intel);
      el.addEventListener('click', () => startBattle(i));
    }
    list.appendChild(el);
  });

  // 처음 도전할 스테이지가 보이도록 스크롤
  const next = list.children[Math.min(save.cleared, STAGES.length - 1)];
  if (next) setTimeout(() => next.scrollIntoView({ block: 'center' }), 30);
}

function renderEndlessSlot() {
  const slot = $('#endless-slot');
  if (!slot) return;
  const open = save.cleared >= STAGES.length;
  slot.innerHTML = '';
  if (!open) {
    slot.innerHTML = '<div class="endless-card locked">🔒 무한 전장은 20전장을 모두 돌파하면 열린다</div>';
    return;
  }
  const el = document.createElement('div');
  el.className = 'endless-card';
  el.innerHTML =
    '<div class="e-title">무한 전장</div>' +
    '<div class="e-sub">총 45공세에 도전한다. 증원까지 모두 격파해야 돌파로 인정된다.</div>' +
    '<div class="e-best">최고 기록 <b>' + (save.endlessBest || 0) + '</b> 파도</div>' +
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
  $('#shop-coins').textContent = save.coins;
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
      '<div class="up-lv">Lv.' + lv + ' / ' + u.max + '</div></div>' +
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
        toast(u.name + ' Lv.' + (lv + 1) + ' 완료');
      });
    }
    box.appendChild(card);
  });
}

/* ------------------------------ 훈련소 ------------------------------ */
let trainingFilter = 'all';
function renderTraining() {
  const hardCap = UNIT_LEVEL_HARD_CAP + (save.upgrades.academy || 0);
  $('#train-coins').textContent = save.coins;
  const cap = unitLevelCap(save.cleared, save.upgrades.academy);
  $('#train-cap').innerHTML =
    'Lv 상한 <b>' + cap + '</b>' +
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
          (unlocked ? '<span class="lv-tag">Lv.' + lv + '</span>' : '') +
          (unlocked && inTeam ? '<span class="team-tag">편성</span>' : '') + '</div>' +
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
            '<span class="stat">대기 ' + u.cooldown + '초</span>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button class="btn train-btn"' + (atCap ? ' disabled' : '') + '>' +
              (atCap ? (lv >= hardCap ? '최대 레벨' : '상한 도달')
                     : '💰 ' + cost + ' → Lv.' + (lv + 1)) + '</button>' +
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
          saveGame(save);
          save.stats.trains++;
          addStat('trains', 1);
          renderTraining();
          SFX.levelUp();
          toast(u.name + ' Lv.' + (lv + 1) + ' 훈련 완료');
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
          (e.area ? '<span class="stat">범위</span>' : '') +
        '</div>' +
      '</div>';
    const tactic = document.createElement('div');
    tactic.className = 'unit-desc';
    tactic.textContent = enemyTactic(e);
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
    save.pity++;
    save.pulls++;
    let u;
    if (save.pity >= GACHA.pity) { u = pullOne('SSR'); save.pity = 0; }
    else {
      u = pullOne();
      if (rarityOf(u) === 'SSR') save.pity = 0;
    }
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
        (r.dup ? (r.levelUp ? 'Lv +1 · 💰' + r.gold : '💰' + r.gold)
               : '<b>신규</b>') + '</div>';
    grid.appendChild(el);
    drawUnitIcon(el.querySelector('canvas'), r.unit, 60);
  });
  $('#pull-head').textContent =
    best >= 3 ? '전설 강림!' : (best >= 2 ? '영웅 등장' : '소환 결과');
  $('#pull-head').className = 'pull-head r-' + RARITY_ORDER[best];
  box.classList.add('show');
}

function renderGacha() {
  $('#gacha-stones').textContent = save.stones;
  $('#gacha-gold').textContent = save.coins;
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
  rate.innerHTML = '<div class="rate-title">등급 확률</div>' +
    RARITY_ORDER.slice().reverse().map(k =>
      '<div class="rate-row r-' + k + '"><span>' + RARITY[k].name + '</span><span>' +
      (RARITY[k].weight / total * 100).toFixed(1) + '%</span></div>').join('');

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
  battle = new Battle(0, save, makeEndlessStage(45));
  $('#battle-stage').textContent = '무한 전장 · 최고 ' + (save.endlessBest || 0) + '파도';
  beginBattle();
}

function startBattle(index) {
  battle = new Battle(index, save);
  $('#battle-stage').textContent = (index + 1) + '. ' + battle.stage.name;
  beginBattle();
}

function beginBattle() {
  clearTimeout(resultTimer);
  playAccum = 0;
  $('#result').classList.remove('show');
  $('#btn-speed').textContent = '▶▶ 1x';
  $('#btn-pause').textContent = '⏸';
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
      '<div class="c-lv">Lv.' + (save.levels[u.id] || 1) + '</div>' +
      '<div class="c-name">' + (u.short || u.name) + '</div>' +
      '<div class="c-role">' + u.role + '</div>' +
      '<div class="c-cost">' + u.cost + '</div>' +
      '<span class="c-key">' + ((i + 1) % 10) + '</span>' +
      '<div class="cool hide"></div>';
    drawUnitIcon(b.querySelector('.c-ico'), u, 38);
    b.addEventListener('click', () => {
      if (!canBattleInput()) return;
      if (battle.cooldowns[u.id] > 0) { toast('아직 재정비 중'); return; }
      if (battle.money < u.cost) { toast('군자금이 부족하다'); return; }
      if (!battle.deploy(u.id)) toast('동시 출진 한도에 도달했다');
    });
    box.appendChild(b);
  });
  cardEls = $$('#cards .card');
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
  $('#btn-pause').textContent = paused ? '▶' : '⏸';
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
  $('#foe-left').textContent = battle.reinforcing() ? '∞' : battle.foesLeft();
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
  $('#wave-preview').textContent = wave
    ? (wave.boss ? '보스 예고 · ' : (wave.reinforce ? '끝없는 증원 · ' : '다음 증원 · ')) +
      wave.name + ' ' + wave.seconds + '초'
    : '최종 공세 · 남은 적을 격파하라';
  $('#wave-preview').classList.toggle('boss-warning', !!wave && wave.boss);
  $('#battle-clock').textContent = Math.floor(battle.time / 60) + ':' + String(Math.floor(battle.time % 60)).padStart(2, '0');
  cmdBtn.classList.toggle('ready', ready);
  $('#cmd-cd').textContent = ready ? '준비' : Math.ceil(battle.cmdCd);
  $('#money-txt').textContent = money;
  $('#wallet-txt').textContent = battle.walletMax;
  $('#wallet-fill').style.width = (battle.money / battle.walletMax * 100) + '%';
  cardEls.forEach(el => {
    const id = el.dataset.id;
    const cd = battle.cooldowns[id];
    const cool = el.querySelector('.cool');
    if (cd > 0) { cool.classList.remove('hide'); cool.textContent = cd.toFixed(1); }
    else cool.classList.add('hide');
    el.classList.toggle('poor', money < UNIT_BY_ID[id].cost);
    el.classList.toggle('available', battle.canDeploy(id));
    el.setAttribute('aria-disabled', String(!canBattleInput() || !battle.canDeploy(id)));
    const max = UNIT_BY_ID[id].cooldown * battle.cdMul;
    el.style.setProperty('--cooldown', (max ? cd / max * 100 : 0) + '%');
  });
}

function showResult() {
  // 누적 기록과 임무 진행
  save.stats.playSec += Math.round(playAccum);
  playAccum = 0;
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
    '<span class="wave-count">' + (battle.wavesCleared || 0) + '</span> 파도';
  const lines = [];
  lines.push('최고 기록 ' + (save.endlessBest || 0) + ' 파도');
  lines.push('획득 골드 💰 ' + battle.coins +
             (battle.stoneGain ? '  ·  소환석 🔮 ' + battle.stoneGain : ''));
  lines.push('처치 ' + battle.kills);
  $('#result-desc').textContent = lines.join('\n');
  $('#btn-next').style.display = 'none';
  $('#btn-retry').textContent = '다시 도전';
  $('#result').classList.add('show');
}

/* ------------------------------ 루프 ------------------------------ */
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
  renderer.render(battle, dt);
  updateHud();
  if (before === 'play' && battle.state !== 'play') {
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
  $('#badge-gold').textContent = '💰 ' + save.coins;
  $('#badge-stones').textContent = '🔮 ' + save.stones;
}

function init() {
  renderer = new Renderer($('#cv'));
  SFX.init();
  SFX.on = save.sound !== false;
  $('#btn-sound').textContent = save.sound !== false ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐';
  // 모바일은 사용자 조작이 한 번 있어야 오디오가 열린다
  const wake = () => { SFX.init(); SFX.resume(); };
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
    window.addEventListener(ev, wake, { once: true, passive: true }));
  titleAnim.cv = $('#title-bg');
  titleAnim.ctx = titleAnim.cv.getContext('2d');
  resizeTitle();
  refreshTitleBadges();
  bindCanvasDrag($('#cv'));

  $('#btn-start').addEventListener('click', () => show('scr-map'));
  $('#btn-howto').addEventListener('click', () => $('#modal-howto').classList.add('show'));
  $$('[data-close]').forEach(b => b.addEventListener('click',
    () => b.closest('.modal').classList.remove('show')));
  $('#modal-howto').addEventListener('click', e => {
    if (e.target.id === 'modal-howto') e.target.classList.remove('show');
  });
  $('#btn-reset').addEventListener('click', () => {
    askConfirm('기록 초기화',
      '진행도와 소환한 병종까지 전부 사라진다. 정말 지울까?', () => {
        save = defaultSave();
        saveGame(save);
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
                 () => show('scr-map'));
      return;
    }
    show('scr-map');
  });
  $('#btn-speed').addEventListener('click', () => {
    battle.speed = battle.speed === 1 ? 2 : (battle.speed === 2 ? 3 : 1);
    $('#btn-speed').textContent = '▶▶ ' + battle.speed + 'x';
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
  $('#btn-sound').addEventListener('click', () => {
    save.sound = !save.sound;
    SFX.on = save.sound;
    saveGame(save);
    $('#btn-sound').textContent = save.sound ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐';
    if (save.sound) SFX.ui();
  });
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
