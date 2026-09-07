/* =======================================================================
 *  달콤 방어전 - 화면 전환 / 저장 / 메인 루프
 * ======================================================================= */

const SAVE_KEY = 'sweet-defense-save-v1';

function defaultSave() {
  return { cleared: 0, coins: 0, upgrades: { wallet: 0, income: 0, power: 0, vitality: 0, castle: 0 } };
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = Object.assign(defaultSave(), JSON.parse(raw));
    s.upgrades = Object.assign(defaultSave().upgrades, s.upgrades || {});
    s.cleared = Math.max(0, Math.min(STAGES.length, s.cleared | 0));
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
  if (id === 'scr-units') renderUnitBook();
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
        '<div class="stage-meta">' + (locked ? '이전 스테이지를 먼저 클리어' :
            ('적 본진 ' + st.baseHp.toLocaleString() + ' · 보상 🍯' + st.reward)) + '</div>' +
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
        (maxed ? '최대 강화 완료' : '🍯 ' + cost + ' 사용해 강화') + '</button>';
    if (!maxed) {
      card.querySelector('.up-buy').addEventListener('click', () => {
        if (save.coins < cost) { toast('꿀이 부족해!'); return; }
        save.coins -= cost;
        save.upgrades[key] = lv + 1;
        saveGame(save);
        renderShop();
        toast(u.name + ' Lv.' + (lv + 1) + ' 달성!');
      });
    }
    box.appendChild(card);
  });
}

/* ------------------------------ 도감 ------------------------------ */
function renderUnitBook() {
  const box = $('#units-list');
  box.innerHTML = '';
  UNITS.forEach(u => {
    const unlocked = u.unlockStage <= save.cleared + 1;
    const el = document.createElement('div');
    el.className = 'unit-card';
    el.innerHTML =
      '<div class="unit-ico">' + (unlocked ? u.emoji : '❔') + '</div>' +
      '<div class="unit-body">' +
        '<div class="unit-name">' + (unlocked ? u.name : '미해금 유닛') +
          '<span class="unit-tag' + (unlocked ? '' : ' lock') + '">' +
          (unlocked ? '보유' : u.unlockStage + '스테이지') + '</span></div>' +
        '<div class="unit-desc">' + (unlocked ? u.desc : '스테이지 ' + u.unlockStage + '에 도달하면 합류한다.') + '</div>' +
        (unlocked ? '<div class="stat-row">' +
          '<span class="stat">비용 ' + u.cost + '</span>' +
          '<span class="stat">체력 ' + u.hp + '</span>' +
          '<span class="stat">공격 ' + u.atk + '</span>' +
          '<span class="stat">사거리 ' + u.range + '</span>' +
          '<span class="stat">속도 ' + u.speed + '</span>' +
          '<span class="stat">대기 ' + u.cooldown + '초</span>' +
          (u.area ? '<span class="stat">범위공격</span>' : '') +
          (u.ranged ? '<span class="stat">원거리</span>' : '') +
        '</div>' : '') +
      '</div>';
    box.appendChild(el);
  });

  const head = document.createElement('div');
  head.className = 'unit-card';
  head.innerHTML = '<div class="unit-ico">🥦</div><div class="unit-body">' +
    '<div class="unit-name">채소 군단</div>' +
    '<div class="unit-desc">달콤 왕국을 노리는 침략자들. 콩알 졸병부터 마늘 대군주까지 ' +
    Object.keys(ENEMIES).length + '종이 확인되었다.</div></div>';
  box.appendChild(head);
}

/* ------------------------------ 전투 ------------------------------ */
function startBattle(index) {
  battle = new Battle(index, save);
  $('#battle-stage').textContent = '1-' + (index + 1) + '  ' + battle.stage.name;
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
      '<div class="c-emoji">' + u.emoji + '</div>' +
      '<div class="c-name">' + u.name + '</div>' +
      '<div class="c-cost">' + u.cost + '</div>' +
      '<div class="cool hide"></div>';
    b.addEventListener('click', () => {
      if (battle.state !== 'play') return;
      if (battle.cooldowns[u.id] > 0) { toast('준비 중이야'); return; }
      if (battle.money < u.cost) { toast('자금이 부족해'); return; }
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
  $('#result-title').textContent = win ? '승리!' : '패배...';
  const lines = [];
  lines.push('획득 꿀 🍯 ' + battle.coins);
  if (win) {
    const nextUnit = UNITS.find(u => u.unlockStage === battle.stageIndex + 2);
    if (nextUnit) lines.push('새 유닛 해금: ' + nextUnit.emoji + ' ' + nextUnit.name);
    if (battle.stageIndex + 1 >= STAGES.length) lines.push('1번 맵 전 스테이지 제패!');
  } else {
    lines.push('강화를 올리거나 배치 순서를 바꿔 보자.');
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
function init() {
  renderer = new Renderer($('#cv'));
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
      save = defaultSave(); saveGame(save); toast('기록을 초기화했어');
    }
  });
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => show(b.dataset.goto)));
  $('#btn-shop').addEventListener('click', () => show('scr-shop'));
  $('#btn-units').addEventListener('click', () => show('scr-units'));

  $('#btn-quit').addEventListener('click', () => {
    if (battle && battle.state === 'play' && !confirm('전투를 포기하고 지도로 돌아갈까?')) return;
    show('scr-map');
  });
  $('#btn-speed').addEventListener('click', () => {
    battle.speed = battle.speed === 1 ? 2 : 1;
    $('#btn-speed').textContent = '▶▶ ' + battle.speed + 'x';
  });
  $('#btn-retry').addEventListener('click', () => startBattle(battle.stageIndex));
  $('#btn-next').addEventListener('click', () => startBattle(battle.stageIndex + 1));
  $('#btn-tomap').addEventListener('click', () => show('scr-map'));

  window.addEventListener('resize', () => { if (renderer) renderer.resize(); });
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', init);

// 오프라인 지원 (http/https 로 열었을 때만)
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
