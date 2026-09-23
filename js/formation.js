/* =======================================================================
 *  막대 왕국 전쟁 - 편성 화면 (끌어다 놓기)
 *
 *  위: 출진 칸 10개. 전투 카드와 같은 순서다.
 *  아래: 보유 병종. 카드를 끌어 칸에 놓으면 편성, 칸끼리 끌면 자리 바꿈,
 *        칸을 아래로 끌어내면 뺀다. 누르기만 하면 넣고 빼기가 된다.
 *
 *  터치에서는 목록 스크롤과 끌기가 부딪힌다. 가로로 끌거나 잠깐 누르고 있으면
 *  끌기, 세로로 쓸면 스크롤로 나눈다.
 * ======================================================================= */

const PRESET_COUNT = 3;
const HOLD_MS = 170;          // 터치: 이만큼 누르고 있으면 끌기 시작
const DRAG_START_PX = 8;

let fmTarget = null;          // 전장 번호 | 'endless' | null(그냥 편성)
let fmBack = 'scr-map';
let fmFilter = 'all';
let fmFocus = null;           // 오른쪽에 정보를 띄울 병종
let fmDrag = null;

function openFormation(target) {
  fmTarget = (target === undefined) ? null : target;
  const active = document.querySelector('.screen.active');
  fmBack = active && active.id !== 'scr-formation' ? active.id : 'scr-map';
  show('scr-formation');
}

function formationPresets() {
  if (!Array.isArray(save.presets)) save.presets = [];
  while (save.presets.length < PRESET_COUNT) save.presets.push([]);
  return save.presets;
}

function sameList(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function commitLoadout(msg) {
  saveGame(save);
  if (msg) toast(msg);
  renderFormation();
}

function heroCount(list) { return list.filter(id => isHeroUnit(UNIT_BY_ID[id])).length; }

/* 전설·신화를 하나 더 넣어도 되나 (out: 그 자리에서 빠질 병종) */
function heroRoom(id, out) {
  if (!isHeroUnit(UNIT_BY_ID[id])) return true;
  const n = heroCount(save.loadout) - (out && isHeroUnit(UNIT_BY_ID[out]) ? 1 : 0);
  if (n < HERO_SLOT_MAX) return true;
  toast('전설·신화는 편성에 ' + HERO_SLOT_MAX + '명까지다');
  return false;
}

/* 칸 index 에 병종 id 를 놓는다. 이미 편성된 병종이면 자리를 바꾼다. */
function placeUnit(id, index) {
  const L = save.loadout;
  const cur = L.indexOf(id);
  if (cur < 0 && !heroRoom(id, L[index])) return 'blocked';
  if (cur >= 0) {
    if (index >= L.length) { L.splice(cur, 1); L.push(id); }
    else if (cur !== index) { const t = L[index]; L[index] = id; L[cur] = t; }
    return 'move';
  }
  if (index < L.length) {
    const out = L[index];
    L[index] = id;
    return out;
  }
  if (L.length >= LOADOUT_MAX) return null;
  L.push(id);
  return 'add';
}

function removeUnit(id) {
  if (save.loadout.length <= 1) { toast('최소 한 병종은 편성해야 한다'); return false; }
  save.loadout = save.loadout.filter(x => x !== id);
  return true;
}

function toggleUnit(id) {
  if (save.loadout.includes(id)) {
    if (removeUnit(id)) { SFX.ui(); commitLoadout(); }
    return;
  }
  if (save.loadout.length >= LOADOUT_MAX) { toast('칸이 가득 찼다. 칸 위에 끌어 놓으면 바꾼다'); return; }
  if (!heroRoom(id)) return;
  save.loadout.push(id);
  SFX.deploy();
  buzz(8);
  commitLoadout();
}

/* 비어 있는 칸을 레벨 높고 싼 병종부터 채운다 */
function autoFillLoadout() {
  const pool = unlockedUnits().filter(u => !save.loadout.includes(u.id));
  pool.sort((a, b) => ((save.levels[b.id] || 1) - (save.levels[a.id] || 1)) || (a.cost - b.cost));
  let n = 0;
  for (const u of pool) {
    if (save.loadout.length >= LOADOUT_MAX) break;
    if (isHeroUnit(u) && heroCount(save.loadout) >= HERO_SLOT_MAX) continue;
    save.loadout.push(u.id);
    n++;
  }
  commitLoadout(n ? n + '개 칸을 채웠다' : '채울 칸이 없다');
}

function unitMatchesFilter(u) {
  if (fmFilter === 'melee') return !u.ranged;
  if (fmFilter === 'ranged') return !!u.ranged;
  if (fmFilter === 'hero') return u.rarity === 'SSR' || u.rarity === 'UR';
  return true;
}

function renderFormation() {
  if (!$('#scr-formation').classList.contains('active')) return;
  $('#formation-coins').textContent = fmtNum(save.coins);
  renderFormationSlots();
  renderFormationPool();
  renderFormationSide();
}

function unitTileHTML(u, sub) {
  const lv = save.levels[u.id] || 1;
  return '<canvas></canvas><span class="ft-name">' + (u.short || u.name) + '</span>' +
    '<span class="ft-sub">' + sub + '</span><span class="ft-lv">' + lv + '</span>';
}

function renderFormationSlots() {
  const box = $('#formation-slots');
  box.innerHTML = '';
  let cost = 0, heroes = 0, ranged = 0;
  for (let i = 0; i < LOADOUT_MAX; i++) {
    const u = UNIT_BY_ID[save.loadout[i]];
    const slot = document.createElement('div');
    slot.className = 'f-slot' + (u ? ' filled' : '') + (u && u.rarity ? ' r-' + u.rarity : '');
    slot.dataset.slot = String(i);
    if (!u) {
      slot.innerHTML = '<span class="fs-key">' + ((i + 1) % 10) + '</span><span class="fs-empty">＋</span>';
      slot.setAttribute('aria-label', (i + 1) + '번 칸 비어 있음');
    } else {
      cost += u.cost;
      if (u.rarity === 'SSR' || u.rarity === 'UR') heroes++;
      if (u.ranged) ranged++;
      slot.innerHTML = '<span class="fs-key">' + ((i + 1) % 10) + '</span>' + unitTileHTML(u, '💰' + u.cost);
      slot.setAttribute('aria-label', (i + 1) + '번 칸 ' + u.name);
      drawUnitIcon(slot.querySelector('canvas'), u, 38);
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'fs-remove';
      x.textContent = '✕';
      x.setAttribute('aria-label', u.name + ' 빼기');
      x.addEventListener('pointerdown', e => e.stopPropagation());
      x.addEventListener('click', e => {
        e.stopPropagation();
        if (removeUnit(u.id)) { SFX.ui(); commitLoadout(); }
      });
      slot.appendChild(x);
      slot.addEventListener('pointerdown', e => dragDown(e, { kind: 'slot', id: u.id, index: i }, slot));
    }
    box.appendChild(slot);
  }
  const n = save.loadout.length;
  $('#formation-sum').innerHTML =
    '<span>편성 <b>' + n + ' / ' + LOADOUT_MAX + '</b></span>' +
    '<span>평균 비용 <b>' + (n ? Math.round(cost / n) : 0) + '</b></span>' +
    '<span>근접 <b>' + (n - ranged) + '</b> · 원거리 <b>' + ranged + '</b></span>' +
    '<span' + (heroes > HERO_SLOT_MAX ? ' class="over-cap"' : '') + '>전설·신화 <b>' + heroes + ' / ' + HERO_SLOT_MAX + '</b></span>';
}

function renderFormationPool() {
  const filters = $('#pool-filters');
  filters.innerHTML = '';
  [['all', '전체'], ['melee', '근접'], ['ranged', '원거리'], ['hero', '전설·신화']].forEach(([k, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = k === fmFilter ? 'on' : '';
    b.setAttribute('aria-pressed', String(k === fmFilter));
    b.addEventListener('click', () => { fmFilter = k; renderFormationPool(); });
    filters.appendChild(b);
  });

  const box = $('#formation-pool');
  const keep = box.scrollTop;
  box.innerHTML = '';
  const rank = { UR: 0, SSR: 1, SR: 2, R: 3, N: 4 };
  const list = unlockedUnits().filter(unitMatchesFilter)
    .sort((a, b) => (a.gacha ? rank[a.rarity] : 9) - (b.gacha ? rank[b.rarity] : 9) || a.cost - b.cost);
  list.forEach(u => {
    const inTeam = save.loadout.includes(u.id);
    const el = document.createElement('div');
    el.className = 'f-tile' + (inTeam ? ' in' : '') + (u.rarity ? ' r-' + u.rarity : '') +
                   (fmFocus === u.id ? ' focus' : '');
    el.dataset.unit = u.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-pressed', String(inTeam));
    el.setAttribute('aria-label', u.name + (inTeam ? ' 편성됨' : ''));
    el.innerHTML = unitTileHTML(u, '💰' + u.cost) + (inTeam ? '<span class="ft-check">✓</span>' : '');
    drawUnitIcon(el.querySelector('canvas'), u, 38);
    el.addEventListener('pointerdown', e => dragDown(e, { kind: 'pool', id: u.id }, el));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fmFocus = u.id; toggleUnit(u.id); }
    });
    box.appendChild(el);
  });
  if (!list.length) box.innerHTML = '<p class="pool-empty">해당하는 병종이 없다</p>';
  box.scrollTop = keep;
}

function renderFormationSide() {
  const side = $('#formation-side');
  side.innerHTML = '';
  const u = UNIT_BY_ID[fmFocus];
  if (u) {
    const info = document.createElement('div');
    info.className = 'fs-info';
    info.innerHTML =
      '<div class="fi-head"><canvas></canvas><div><div class="fi-name">' + u.name + '</div>' +
      '<div class="fi-role">' + u.role + (u.rarity ? ' · ' + RARITY[u.rarity].name : '') +
      ' · 레벨 ' + (save.levels[u.id] || 1) + '</div></div></div>' +
      '<div class="fi-stats"><span>💰' + u.cost + '</span><span>쿨타임 ' + u.cooldown + '초</span>' +
      (u.range ? '<span>사거리 ' + u.range + '</span>' : '') +
      (u.maxActive ? '<span>동시 ' + u.maxActive + '명</span>' : '') + '</div>' +
      (u.abText ? '<div class="fi-ab">◆ ' + u.abText + '</div>' : '') +
      (u.active ? '<div class="fi-ab act">액티브 · ' + u.active.name + '</div>' : '');
    drawUnitIcon(info.querySelector('canvas'), u, 40);
    side.appendChild(info);
  } else {
    const tip = document.createElement('p');
    tip.className = 'fs-tip';
    tip.textContent = '병종을 누르면 여기에 정보가 나온다.';
    side.appendChild(tip);
  }

  const tools = document.createElement('div');
  tools.className = 'fs-tools';
  const fill = document.createElement('button');
  fill.className = 'btn ghost';
  fill.textContent = '빈 칸 채우기';
  fill.addEventListener('click', autoFillLoadout);
  const clear = document.createElement('button');
  clear.className = 'btn ghost';
  clear.textContent = '비우기';
  clear.addEventListener('click', () => {
    save.loadout = save.loadout.slice(0, 1);
    commitLoadout('첫 칸만 남겼다');
  });
  tools.appendChild(fill);
  tools.appendChild(clear);
  side.appendChild(tools);

  const presets = formationPresets();
  const pbox = document.createElement('div');
  pbox.className = 'fs-presets';
  presets.forEach((p, k) => {
    const row = document.createElement('div');
    const same = p.length && sameList(p, save.loadout);
    row.className = 'fp-row' + (same ? ' on' : '');
    row.innerHTML = '<span class="fp-name">저장 ' + (k + 1) + '</span>' +
      '<span class="fp-n">' + (p.length ? p.length + '병종' : '비어 있음') + '</span>';
    const load = document.createElement('button');
    load.className = 'fp-btn';
    load.textContent = '불러오기';
    load.disabled = !p.length;
    load.addEventListener('click', () => {
      const unlocked = new Set(unlockedUnits().map(x => x.id));
      const next = p.filter(id => unlocked.has(id)).slice(0, LOADOUT_MAX);
      if (!next.length) { toast('불러올 병종이 없다'); return; }
      save.loadout = next;
      SFX.ui();
      commitLoadout('저장 ' + (k + 1) + ' 편성을 불러왔다');
    });
    const store = document.createElement('button');
    store.className = 'fp-btn';
    store.textContent = '저장';
    store.addEventListener('click', () => {
      presets[k] = save.loadout.slice();
      SFX.ui();
      commitLoadout('저장 ' + (k + 1) + ' 에 기록했다');
    });
    row.appendChild(load);
    row.appendChild(store);
    pbox.appendChild(row);
  });
  side.appendChild(pbox);

  if (fmTarget !== null) {
    const go = document.createElement('button');
    go.className = 'btn primary fs-go';
    go.id = 'btn-formation-go';
    const name = fmTarget === 'endless' ? '무한 전장' : (fmTarget + 1) + '. ' + STAGES[fmTarget].name;
    go.innerHTML = '출진 ▶<small>' + name + '</small>';
    go.addEventListener('click', () => {
      if (fmTarget === 'endless') startEndless();
      else startBattle(fmTarget);
    });
    side.appendChild(go);
  }
}

/* ------------------------------ 끌기 ------------------------------ */
function dragDown(e, src, el) {
  if (e.button !== undefined && e.button !== 0) return;
  if (fmDrag) dragEnd();
  fmDrag = {
    src: src, el: el, id: e.pointerId, touch: e.pointerType === 'touch',
    x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
    active: false, held: false, hold: null, ghost: null, over: null
  };
  if (fmDrag.touch && src.kind === 'pool') {
    fmDrag.hold = setTimeout(() => {
      if (!fmDrag) return;
      fmDrag.held = true;
      dragBegin();
    }, HOLD_MS);
  }
  window.addEventListener('pointermove', dragMove);
  window.addEventListener('pointerup', dragUp);
  window.addEventListener('pointercancel', dragCancel);
}

function dragBegin() {
  const d = fmDrag;
  if (!d || d.active) return;
  d.active = true;
  clearTimeout(d.hold);
  const r = d.el.getBoundingClientRect();
  const g = d.el.cloneNode(true);
  // 복제본의 캔버스는 비어 있으니 그림을 옮겨 붙인다
  const from = d.el.querySelector('canvas'), to = g.querySelector('canvas');
  if (from && to) { to.width = from.width; to.height = from.height; to.getContext('2d').drawImage(from, 0, 0); }
  g.classList.add('f-ghost');
  g.style.width = r.width + 'px';
  g.style.height = r.height + 'px';
  d.dx = d.x0 - r.left;
  d.dy = d.y0 - r.top;
  document.body.appendChild(g);
  d.ghost = g;
  d.el.classList.add('dragging');
  $('#scr-formation').classList.add('is-dragging');
  placeGhost();
  buzz(10);
}

function placeGhost() {
  const d = fmDrag;
  d.ghost.style.transform = 'translate(' + (d.x - d.dx) + 'px,' + (d.y - d.dy) + 'px) rotate(-3deg) scale(1.06)';
  const hit = document.elementFromPoint(d.x, d.y);
  const slot = hit && hit.closest ? hit.closest('.f-slot') : null;
  const out = d.src.kind === 'slot' && !(hit && hit.closest && hit.closest('#formation-slots'));
  if (d.over !== slot) {
    if (d.over) d.over.classList.remove('over');
    if (slot) slot.classList.add('over');
    d.over = slot;
  }
  d.ghost.classList.toggle('will-remove', out && save.loadout.length > 1);
}

function dragMove(e) {
  const d = fmDrag;
  if (!d || e.pointerId !== d.id) return;
  d.x = e.clientX; d.y = e.clientY;
  if (!d.active) {
    const dx = d.x - d.x0, dy = d.y - d.y0;
    if (Math.hypot(dx, dy) < DRAG_START_PX) return;
    // 터치로 목록을 세로로 쓸면 스크롤이다
    if (d.touch && d.src.kind === 'pool' && !d.held && Math.abs(dy) > Math.abs(dx)) { dragEnd(); return; }
    dragBegin();
  }
  placeGhost();
}

function dragUp(e) {
  const d = fmDrag;
  if (!d || e.pointerId !== d.id) return;
  if (!d.active) {
    dragEnd();
    // 끌지 않고 뗐으면 누르기
    fmFocus = d.src.id;
    if (d.src.kind === 'pool') toggleUnit(d.src.id);
    else { SFX.ui(); renderFormation(); }
    return;
  }
  const hit = document.elementFromPoint(d.x, d.y);
  const slot = hit && hit.closest ? hit.closest('.f-slot') : null;
  const inSlots = hit && hit.closest && hit.closest('#formation-slots');
  const src = d.src;
  dragEnd();
  fmFocus = src.id;
  if (slot) {
    const index = Number(slot.dataset.slot);
    const res = placeUnit(src.id, index);
    if (res === null) { toast('칸이 가득 찼다'); renderFormation(); return; }
    if (res === 'blocked') { renderFormation(); return; }
    SFX.deploy();
    buzz(12);
    const out = (res !== 'move' && res !== 'add') ? UNIT_BY_ID[res] : null;
    commitLoadout(out ? out.name + ' 대신 ' + UNIT_BY_ID[src.id].name : '');
    const placed = document.querySelector('.f-slot[data-slot="' + Math.min(index, save.loadout.length - 1) + '"]');
    if (placed) placed.classList.add('pop');
    return;
  }
  if (src.kind === 'slot' && !inSlots) {
    if (removeUnit(src.id)) { SFX.ui(); commitLoadout(); return; }
  }
  renderFormation();
}

function dragCancel(e) {
  if (fmDrag && e.pointerId === fmDrag.id) dragEnd();
}

function dragEnd() {
  const d = fmDrag;
  if (!d) return;
  clearTimeout(d.hold);
  if (d.ghost) d.ghost.remove();
  if (d.over) d.over.classList.remove('over');
  d.el.classList.remove('dragging');
  $('#scr-formation').classList.remove('is-dragging');
  window.removeEventListener('pointermove', dragMove);
  window.removeEventListener('pointerup', dragUp);
  window.removeEventListener('pointercancel', dragCancel);
  fmDrag = null;
}

// 끌고 있는 동안에는 목록이 따라 스크롤되지 않게 막는다
document.addEventListener('touchmove', e => { if (fmDrag && fmDrag.active) e.preventDefault(); }, { passive: false });

function initFormation() {
  $('#btn-formation').addEventListener('click', () => openFormation(null));
  $('#btn-open-formation').addEventListener('click', () => openFormation(null));
  $('#btn-formation-back').addEventListener('click', () => show(fmBack));
}
