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
    levels: lv
  };
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
    const cap = unitLevelCap(s.cleared);
    UNITS.forEach(u => {
      s.levels[u.id] = Math.max(1, Math.min(cap, s.levels[u.id] | 0 || 1));
    });
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
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
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
  $('#map-progress-txt').textContent = save.cleared + ' / ' + STAGES.length;

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
      '<div class="stage-mark">' + (cleared ? '⭐' : (locked ? '' : '▶')) + '</div>';
    if (!locked) el.addEventListener('click', () => startBattle(i));
    list.appendChild(el);
  });

  // 처음 도전할 스테이지가 보이도록 스크롤
  const next = list.children[Math.min(save.cleared, STAGES.length - 1)];
  if (next) setTimeout(() => next.scrollIntoView({ block: 'center' }), 30);
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
        toast(u.name + ' Lv.' + (lv + 1) + ' 완료');
      });
    }
    box.appendChild(card);
  });
}

/* ------------------------------ 훈련소 ------------------------------ */
function renderTraining() {
  $('#train-coins').textContent = save.coins;
  const cap = unitLevelCap(save.cleared);
  $('#train-cap').textContent = 'Lv 상한 ' + cap +
    (cap < UNIT_LEVEL_HARD_CAP ? ' (전장을 돌파하면 상승)' : ' (최대)');

  const box = $('#units-list');
  box.innerHTML = '';
  UNITS.forEach(u => {
    const unlocked = u.unlockStage <= save.cleared + 1;
    const lv = save.levels[u.id] || 1;
    const mul = unitLevelMul(lv);
    const cost = unitTrainCost(u, lv);
    const atCap = lv >= cap;
    const el = document.createElement('div');
    el.className = 'unit-card' + (unlocked ? '' : ' dim');
    el.innerHTML =
      '<div class="unit-ico">' + (unlocked ? '<canvas></canvas>' : '<span>?</span>') + '</div>' +
      '<div class="unit-body">' +
        '<div class="unit-name">' + (unlocked ? u.name : '미합류 병종') +
          '<span class="unit-tag' + (unlocked ? '' : ' lock') + '">' +
          (unlocked ? u.role : u.unlockStage + '전장') + '</span>' +
          (unlocked ? '<span class="lv-tag">Lv.' + lv + '</span>' : '') + '</div>' +
        '<div class="unit-desc">' +
          (unlocked ? u.desc : '전장 ' + u.unlockStage + '을(를) 돌파하면 합류한다.') + '</div>' +
        (unlocked ?
          '<div class="stat-row">' +
            '<span class="stat">비용 ' + u.cost + '</span>' +
            '<span class="stat hl">체력 ' + Math.round(u.hp * mul) + '</span>' +
            '<span class="stat hl">공격 ' + Math.round(u.atk * mul) + '</span>' +
            '<span class="stat">사거리 ' + u.range + '</span>' +
            '<span class="stat">속도 ' + u.speed + '</span>' +
            '<span class="stat">대기 ' + u.cooldown + '초</span>' +
            (u.area ? '<span class="stat">범위</span>' : '') +
            (u.ranged ? '<span class="stat">원거리</span>' : '') +
          '</div>' +
          '<button class="btn train-btn"' + (atCap ? ' disabled' : '') + '>' +
            (atCap ? (lv >= UNIT_LEVEL_HARD_CAP ? '최대 레벨' : '상한 도달 · 전장을 돌파하라')
                   : '💰 ' + cost + ' → Lv.' + (lv + 1)) +
          '</button>'
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
          toast(u.name + ' Lv.' + (lv + 1) + ' 훈련 완료');
        });
      }
    }
    box.appendChild(el);
  });

  const head = document.createElement('div');
  head.className = 'unit-card';
  head.innerHTML = '<div class="unit-ico"><canvas></canvas></div><div class="unit-body">' +
    '<div class="unit-name">오크 군단</div>' +
    '<div class="unit-desc">왕국을 노리는 침략자들. 고블린 졸개부터 오크 대군주까지 ' +
    Object.keys(ENEMIES).length + '종이 확인되었다.</div></div>';
  box.appendChild(head);
  drawUnitIcon(head.querySelector('canvas'), ENEMIES.warlord, 54);
}

/* ------------------------------ 전투 ------------------------------ */
function startBattle(index) {
  battle = new Battle(index, save);
  $('#battle-stage').textContent = (index + 1) + '. ' + battle.stage.name;
  $('#result').classList.remove('show');
  $('#btn-speed').textContent = '▶▶ 1x';
  buildCards();
  show('scr-battle');
  renderer.cam = renderer.camTarget = renderer.clampCam(ALLY_SPAWN_X + 200);
  renderer.dragUntil = 0;
  lastTs = 0;
}

function buildCards() {
  const box = $('#cards');
  box.innerHTML = '';
  battle.unlockedUnits().forEach(u => {
    const b = document.createElement('button');
    b.className = 'card';
    b.dataset.id = u.id;
    b.innerHTML =
      '<canvas class="c-ico"></canvas>' +
      '<div class="c-lv">Lv.' + (save.levels[u.id] || 1) + '</div>' +
      '<div class="c-name">' + u.name + '</div>' +
      '<div class="c-cost">' + u.cost + '</div>' +
      '<div class="cool hide"></div>';
    drawUnitIcon(b.querySelector('.c-ico'), u, 44);
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

function updateHud() {
  const money = Math.floor(battle.money);
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
  const lines = [];
  lines.push('획득 골드 💰 ' + battle.coins);
  if (win) {
    const nextUnit = UNITS.find(u => u.unlockStage === battle.stageIndex + 2);
    if (nextUnit) lines.push('새 병종 해금: ' + nextUnit.name);
    if (battle.stageIndex + 1 >= STAGES.length) lines.push('왕국 방어전 전 스테이지 제패!');
  } else {
    lines.push('강화를 올리거나 병종 배치 순서를 바꿔 보자.');
  }
  $('#result-desc').textContent = lines.join('\n');
  const hasNext = win && battle.stageIndex + 1 < STAGES.length;
  $('#btn-next').style.display = hasNext ? '' : 'none';
  $('#result').classList.add('show');
}

/* ------------------------------ 루프 ------------------------------ */
function loop(ts) {
  requestAnimationFrame(loop);
  if (!battle || !$('#scr-battle').classList.contains('active')) { lastTs = ts; return; }
  if (!lastTs) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (dt > 0.1) dt = 0.1;

  const before = battle.state;
  battle.update(dt);
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

function drawTitleScene() {
  const cv = $('#title-canvas');
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = 320, h = 120;
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(60,45,30,.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, h - 12); ctx.lineTo(w - 10, h - 12); ctx.stroke();

  const cast = [
    [58, UNIT_BY_ID.knight, 1, 1.15],
    [110, UNIT_BY_ID.archer, 1, 1.0],
    [16, UNIT_BY_ID.spear, 1, 0.95],
    [252, ENEMIES.warlord, -1, 0.9],
    [206, ENEMIES.goblin, -1, 1.0],
    [290, ENEMIES.ogre, -1, 0.8]
  ];
  cast.forEach(c => {
    ctx.save();
    ctx.translate(c[0], h - 12);
    ctx.scale(c[2], 1);
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.beginPath(); ctx.ellipse(0, 0, 14 * c[3], 4, 0, 0, 7); ctx.fill();
    drawBody(ctx, c[1].shape, c[1].body, c[1].accent, c[3], false, false, 0, false, 0.35);
    ctx.restore();
  });
}

function init() {
  renderer = new Renderer($('#cv'));
  drawTitleScene();
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
    battle.speed = battle.speed === 1 ? 2 : 1;
    $('#btn-speed').textContent = '▶▶ ' + battle.speed + 'x';
  });
  $('#btn-retry').addEventListener('click', () => startBattle(battle.stageIndex));
  $('#btn-next').addEventListener('click', () => startBattle(battle.stageIndex + 1));
  $('#btn-tomap').addEventListener('click', () => show('scr-map'));

  $('#btn-full').addEventListener('click', toggleFullscreen);
  window.addEventListener('resize', () => { if (renderer) renderer.resize(); });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { if (renderer) renderer.resize(); }, 250);
  });
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', init);

// 오프라인 지원 (http/https 로 열었을 때만)
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
