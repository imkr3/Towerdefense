/* =======================================================================
 *  달콤 방어전 - 화면 전환 / 저장 / 메인 루프
 * ======================================================================= */

const SAVE_KEY = 'stick-kingdom-save-v1';

function defaultSave() {
  const lv = {};
  UNITS.forEach(u => { lv[u.id] = 1; });
  return {
    cleared: 0, coins: 0,
    upgrades: { wallet: 0, income: 0, power: 0, vitality: 0, castle: 0 },
    levels: lv, loadout: ['spear'],
    stars: {}, totalKills: 0, sound: true
  };
}

/* 해금된 병종 목록 */
function unlockedUnits() {
  return ROSTER_UNITS.filter(u => u.unlockStage <= save.cleared + 1);
}

/* 새로 해금된 병종을 자리가 있으면 편성에 자동 추가 */
function syncLoadout() {
  const unlocked = unlockedUnits();
  save.loadout = (save.loadout || []).filter(id => unlocked.some(u => u.id === id));
  unlocked.forEach(u => {
    if (save.loadout.length < LOADOUT_MAX && save.loadout.indexOf(u.id) < 0) {
      save.loadout.push(u.id);
    }
  });
  save.loadout = save.loadout.slice(0, LOADOUT_MAX);
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
    if (!s.stars || typeof s.stars !== 'object') s.stars = {};
    if (typeof s.sound !== 'boolean') s.sound = true;
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
  if (id === 'scr-battle' && renderer) renderer.resize();
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

/* ------------------------------ 지도 ------------------------------ */
function renderMap() {
  $('#map-coins').textContent = save.coins;
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
    const el = document.createElement('div');
    el.className = 'stage' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '') +
                   (st.boss ? ' boss' : '');
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
    if (!locked) el.addEventListener('click', () => startBattle(i));
    list.appendChild(el);
  });

  // 처음 도전할 스테이지가 보이도록 스크롤
  const next = list.children[Math.min(save.cleared, STAGES.length - 1)];
  if (next) setTimeout(() => next.scrollIntoView({ block: 'center' }), 30);
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
function renderTraining() {
  $('#train-coins').textContent = save.coins;
  const cap = unitLevelCap(save.cleared, save.upgrades.academy);
  $('#train-cap').innerHTML =
    'Lv 상한 <b>' + cap + '</b>' +
    (cap < UNIT_LEVEL_HARD_CAP ? ' (전장을 돌파하면 상승)' : ' (최대)') +
    ' · 편성 <b>' + save.loadout.length + ' / ' + LOADOUT_MAX + '</b>' +
    ' <span class="hint">카드는 편성한 병종만 나온다</span>';

  const box = $('#units-list');
  box.innerHTML = '';
  ROSTER_UNITS.forEach(u => {
    const unlocked = u.unlockStage <= save.cleared + 1;
    const lv = save.levels[u.id] || 1;
    const mul = unitLevelMul(lv);
    const cost = unitTrainCost(u, lv);
    const atCap = lv >= cap;
    const inTeam = save.loadout.indexOf(u.id) >= 0;
    const teamFull = save.loadout.length >= LOADOUT_MAX;

    const el = document.createElement('div');
    el.className = 'unit-card' + (unlocked ? '' : ' dim') + (inTeam ? ' teamed' : '');
    el.innerHTML =
      '<div class="unit-ico">' + (unlocked ? '<canvas></canvas>' : '<span>?</span>') + '</div>' +
      '<div class="unit-body">' +
        '<div class="unit-name">' + (unlocked ? u.name : '미합류 병종') +
          '<span class="unit-tag' + (unlocked ? '' : ' lock') + '">' +
          (unlocked ? u.role : u.unlockStage + '전장') + '</span>' +
          (unlocked ? '<span class="lv-tag">Lv.' + lv + '</span>' : '') +
          (unlocked && inTeam ? '<span class="team-tag">편성</span>' : '') + '</div>' +
        (unlocked && u.abText ? '<div class="ab-text">◆ ' + u.abText + '</div>' : '') +
        '<div class="unit-desc">' +
          (unlocked ? u.desc : '전장 ' + u.unlockStage + '을(를) 돌파하면 합류한다.') + '</div>' +
        (unlocked ?
          '<div class="stat-row">' +
            '<span class="stat">비용 ' + u.cost + '</span>' +
            '<span class="stat hl">체력 ' + Math.round(u.hp * mul) + '</span>' +
            (u.atk ? '<span class="stat hl">공격 ' + Math.round(u.atk * mul) + '</span>' : '') +
            (u.range ? '<span class="stat">사거리 ' + u.range + '</span>' : '') +
            '<span class="stat">속도 ' + u.speed + '</span>' +
            '<span class="stat">대기 ' + u.cooldown + '초</span>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button class="btn train-btn"' + (atCap ? ' disabled' : '') + '>' +
              (atCap ? (lv >= UNIT_LEVEL_HARD_CAP ? '최대 레벨' : '상한 도달')
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
    box.appendChild(el);
  });

  // 적 도감
  Object.keys(ENEMIES).forEach(key => {
    const e = ENEMIES[key];
    const el = document.createElement('div');
    el.className = 'unit-card foe';
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
    drawUnitIcon(el.querySelector('canvas'), e, 54);
    box.appendChild(el);
  });
}

/* ------------------------------ 전투 ------------------------------ */
function startBattle(index) {
  battle = new Battle(index, save);
  $('#battle-stage').textContent = (index + 1) + '. ' + battle.stage.name;
  $('#result').classList.remove('show');
  $('#btn-speed').textContent = '▶▶ 1x';
  $('#btn-pause').textContent = '⏸';
  paused = false;
  buildCards();
  show('scr-battle');
  renderer.cam = renderer.camTarget = renderer.clampCam(ALLY_SPAWN_X + 200);
  renderer.dragUntil = 0;
  lastTs = 0;
}

function buildCards() {
  const box = $('#cards');
  box.innerHTML = '';
  battle.roster.forEach(u => {
    const b = document.createElement('button');
    b.className = 'card';
    b.dataset.id = u.id;
    b.innerHTML =
      '<canvas class="c-ico"></canvas>' +
      '<div class="c-lv">Lv.' + (save.levels[u.id] || 1) + '</div>' +
      '<div class="c-name">' + (u.short || u.name) + '</div>' +
      '<div class="c-cost">' + u.cost + '</div>' +
      '<div class="cool hide"></div>';
    drawUnitIcon(b.querySelector('.c-ico'), u, 38);
    b.addEventListener('click', () => {
      if (battle.state !== 'play') return;
      if (battle.cooldowns[u.id] > 0) { toast('아직 재정비 중'); return; }
      if (battle.money < u.cost) { toast('군자금이 부족하다'); return; }
      battle.deploy(u.id);
    });
    box.appendChild(b);
  });
  cardEls = $$('#cards .card');
}

let cardEls = [];

let paused = false;

function updateHud() {
  const money = Math.floor(battle.money);
  $('#kill-count').textContent = battle.kills;
  const cmdBtn = $('#btn-command');
  const ready = battle.cmdCd <= 0;
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
  });
}

function showResult() {
  const win = battle.state === 'win';
  $('#result-title').textContent = win ? '승 리' : '패 배';
  $('#result-stars').innerHTML = win
    ? starMarks(battle.stars) + (battle.newStars ? '<span class="new-star">NEW</span>' : '')
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
    if (battle.stageIndex + 1 >= STAGES.length) lines.push('왕국 방어전 전 전장 제패!');
  } else {
    lines.push('강화를 올리거나 편성을 바꿔 보자.');
  }
  $('#result-desc').textContent = lines.join('\n');
  const hasNext = win && battle.stageIndex + 1 < STAGES.length;
  $('#btn-next').style.display = hasNext ? '' : 'none';
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
  if (!paused) battle.update(dt);
  else battle.updateFx(dt * 0.4);
  renderer.render(battle, dt);
  updateHud();
  if (before === 'play' && battle.state !== 'play') setTimeout(showResult, 700);
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
}

function init() {
  renderer = new Renderer($('#cv'));
  SFX.init();
  SFX.on = save.sound !== false;
  $('#btn-sound').textContent = save.sound !== false ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐';
  // 모바일은 사용자 조작이 있어야 오디오가 열린다
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => { SFX.init(); SFX.resume(); }, { once: false }));
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
    if (confirm('모든 진행 기록을 지울까?')) {
      save = defaultSave(); saveGame(save); toast('기록을 초기화했다');
    }
  });
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => show(b.dataset.goto)));
  $('#btn-shop').addEventListener('click', () => show('scr-shop'));
  $('#btn-units').addEventListener('click', () => show('scr-units'));

  $('#btn-quit').addEventListener('click', () => {
    if (battle && battle.state === 'play' && !confirm('전투를 포기하고 진군도로 돌아갈까?')) return;
    show('scr-map');
  });
  $('#btn-speed').addEventListener('click', () => {
    battle.speed = battle.speed === 1 ? 2 : (battle.speed === 2 ? 3 : 1);
    $('#btn-speed').textContent = '▶▶ ' + battle.speed + 'x';
    SFX.ui();
  });
  $('#btn-pause').addEventListener('click', () => {
    paused = !paused;
    $('#btn-pause').textContent = paused ? '▶' : '⏸';
    toast(paused ? '일시정지' : '재개');
    SFX.ui();
  });
  $('#btn-command').addEventListener('click', () => {
    if (!battle || battle.state !== 'play') return;
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
  $('#btn-retry').addEventListener('click', () => startBattle(battle.stageIndex));
  $('#btn-next').addEventListener('click', () => startBattle(battle.stageIndex + 1));
  $('#btn-tomap').addEventListener('click', () => show('scr-map'));

  $('#btn-full').addEventListener('click', toggleFullscreen);
  window.addEventListener('resize', () => {
    if (renderer) renderer.resize();
    resizeTitle();
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { if (renderer) renderer.resize(); resizeTitle(); }, 250);
  });
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', init);

/* 안드로이드 뒤로 가기 처리. true 를 돌려주면 앱이 닫히지 않는다. */
window.__androidBack = function () {
  const open = document.querySelector('.modal.show');
  if (open) { open.classList.remove('show'); return true; }
  const active = document.querySelector('.screen.active');
  if (!active) return false;
  if (active.id === 'scr-battle') {
    if (battle && battle.state === 'play' && !$('#result').classList.contains('show')) {
      show('scr-map');
    } else {
      show('scr-map');
    }
    return true;
  }
  if (active.id === 'scr-shop' || active.id === 'scr-units') { show('scr-map'); return true; }
  if (active.id === 'scr-map') { show('scr-title'); return true; }
  return false;   // 타이틀에서는 앱 종료
};

// 오프라인 지원 (http/https 로 열었을 때만)
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
