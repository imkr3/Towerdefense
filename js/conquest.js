/* =======================================================================
 *  5.0 정벌 화면 — 출발 · 갈림길 지도 · 축복/유물 고르기 · 상점 · 야영 · 제단 · 정산
 *  규칙과 자료는 data.js 의 CONQ / conq* (시뮬레이터도 같은 함수를 돈다).
 *  진행 중인 원정은 save.conquest 에 있다 — 앱을 꺼도 그 자리에서 이어진다.
 *  (전투 도중에 꺼진 것은 그 전투를 다시 치른다. 전투에서 '나가기'를 고르면 진 것으로 친다.)
 * ======================================================================= */
let conqSel = -1;          // 지금 층에서 고른 갈림길
let conqAsc = -1;          // 출발 화면에서 고른 단계
let conqLast = null;       // 막 끝난 원정의 정산 (화면에 한 번 보여 준다)

function conqRunNow() { return save.conquest || null; }
function conqPct(v) { return Math.round(v * 100) + '%'; }
function conqEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function openConquest() {
  if (!conqOpen(save)) { toast(CONQ.unlock + '전장을 돌파하면 정벌이 열립니다'); return; }
  show('scr-conquest');
}

/* ------------------------------ 화면 전체 ------------------------------ */
function renderConquest() {
  const run = conqRunNow();
  $('#conq-coins').textContent = fmtNum(save.coins);
  $('#conq-title').textContent = run ? '정벌 · ' + (run.asc ? '단계 ' + run.asc : '기본') : '정벌';
  $('#conq-chips').innerHTML = run
    ? '<span class="cq-chip castle" title="성채">🏰 ' + conqPct(run.castle) + '</span><span class="cq-chip scrip" title="군표">🎖 ' + run.scrip + '</span>'
    : '';
  const body = $('#conq-body');
  body.innerHTML = '';
  body.appendChild(run ? conqRunView(run) : conqLobby());
  conqOverlay(run);
}

/* ------------------------------ 출발 화면 ------------------------------ */
function conqLobby() {
  const rec = conqNormRec(save.conqRec);
  const top = conqAscOpen(save);
  if (conqAsc < 0 || conqAsc > top) conqAsc = top;
  const wrap = document.createElement('div');
  wrap.className = 'cq-lobby';
  const deck = (save.loadout || []).filter(id => UNIT_BY_ID[id]);
  wrap.innerHTML =
    '<div class="cq-intro">' +
      '<div class="cq-h">⚔ 왕국 정벌</div>' +
      '<p class="cq-lead">갈림길을 골라 세 막을 내려가는 원정입니다. 한 번 지면 원정이 끝납니다.</p>' +
      '<ul class="cq-rules">' +
        '<li><b>성채가 이어집니다</b> · 전투에서 잃은 성채는 다음 전투에도 그대로 — 야영 · 상점 · 유물로 고칩니다</li>' +
        '<li><b>축복</b> · 이길 때마다 하나 골라 쌓습니다 (공격 · 체력 · 수입 · 출진 대기 …)</li>' +
        '<li><b>유물</b> · 정예와 보스가 줍니다. 원정마다 하나뿐인 큰 힘</li>' +
        '<li><b>군표 🎖</b> · 전투에서 모아 상점에서 씁니다 (원정이 끝나면 사라집니다)</li>' +
        '<li><b>전장</b> · 내가 돌파한 전장에서 뽑습니다. 깊이 내려갈수록 적이 억세집니다</li>' +
        '<li><b>편성</b> · 출발할 때의 편성으로 싸웁니다 — 징집소에서 한 칸씩 바꿀 수 있습니다</li>' +
        '<li><b>길</b> · 갈림길은 세 줄. 고른 줄의 이웃 줄로만 내려갑니다 — 앞을 보고 길을 짜세요</li>' +
        '<li><b>위험 걸기</b> · 전투마다 평소 · 도발 · 결사 — 적이 억세질수록 군표 · 금화 · 축복 등급이 오릅니다</li>' +
      '</ul>' +
      '<div class="cq-rec">최고 <b>' + rec.best + '</b> / ' + (CONQ.acts * CONQ.floors) + '층 · 정벌 <b>' + rec.wins + '</b>회 · 원정 ' + rec.runs + '회' +
        (rec.top >= 0 ? ' · 넘은 단계 <b>' + rec.top + '</b>' : '') + '</div>' +
    '</div>' +
    '<aside class="cq-side">' +
      '<div class="cq-asc">' +
        '<div class="cq-asc-h">정벌 단계</div>' +
        '<div class="cq-asc-pick"><button type="button" class="icon-btn" data-asc="-1" aria-label="단계 내리기">◀</button>' +
          '<span class="cq-asc-n">' + (conqAsc ? '단계 ' + conqAsc : '기본') + '</span>' +
          '<button type="button" class="icon-btn" data-asc="1" aria-label="단계 올리기">▶</button></div>' +
        '<div class="cq-asc-list">' + (conqAsc ? CONQ_ASC.slice(1, conqAsc + 1).map((t, i) => '<div>' + (i + 1) + '. ' + t + '</div>').join('') +
          '<div class="cq-asc-note">적 +' + Math.round(CONQ.ascCurve[conqAsc] * CONQ.ascEarly * 100) + '% → +' + Math.round(CONQ.ascCurve[conqAsc] * 100) + '% (깊이 내려갈수록)</div>' : '<div>단계를 넘으면 다음 단계가 열립니다 (최대 ' + CONQ.ascMax + ')</div>') + '</div>' +
      '</div>' +
      '<div class="cq-deck-h">출진 편성 <span>' + deck.length + ' / ' + LOADOUT_MAX + '</span></div>' +
      '<div class="cq-deck"></div>' +
      '<div class="cq-btns"><button type="button" class="btn ghost" id="conq-fix">편성 바꾸기</button>' +
        '<button type="button" class="btn primary" id="conq-go">정벌 출발</button></div>' +
    '</aside>';
  const dk = wrap.querySelector('.cq-deck');
  deck.forEach(id => { const c = document.createElement('canvas'); c.title = UNIT_BY_ID[id].name; dk.appendChild(c); drawUnitIcon(c, unitFor(save, id), 34); });
  wrap.querySelectorAll('[data-asc]').forEach(b => b.addEventListener('click', () => {
    conqAsc = Math.max(0, Math.min(top, conqAsc + +b.dataset.asc)); SFX.ui(); renderConquest();
  }));
  wrap.querySelector('#conq-fix').addEventListener('click', () => { SFX.ui(); openFormation(null); });
  wrap.querySelector('#conq-go').addEventListener('click', () => {
    if (!deck.length) { toast('편성이 비어 있습니다'); return; }
    save.conquest = conqNewRun(save, conqAsc, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    conqSel = -1;
    saveGame(save);
    SFX.ui();
    renderConquest();
  });
  return wrap;
}

/* ------------------------------ 원정 지도 ------------------------------ */
function conqNodeLabel(node) {
  const N = CONQ_NODES[node.t];
  if (node.t === 'boss') { const st = STAGES[node.src]; return (ENEMIES[st.bossId] || {}).name || N.name; }
  return N.name;
}
function conqRunView(run) {
  const wrap = document.createElement('div');
  wrap.className = 'cq-run';
  const row = run.map[run.floor] || [];
  if (conqSel >= row.length || (conqSel >= 0 && !conqReachable(run, conqSel))) conqSel = -1;
  if (conqSel < 0 && row.length === 1) conqSel = 0;
  // 막 표시
  let acts = '<div class="cq-acts">';
  for (let a = 0; a < CONQ.acts; a++) acts += '<span class="cq-act' + (a === run.act ? ' on' : a < run.act ? ' done' : '') + '">' + (a + 1) + '막</span>';
  acts += '<span class="cq-floor">' + (run.floor + 1) + ' / ' + CONQ.floors + '층</span></div>';
  // 갈림길 지도: 층마다 한 줄 (왼쪽 → 오른쪽)
  let map = '<div class="cq-map">';
  run.map.forEach((r, f) => {
    map += '<div class="cq-col' + (f === run.floor ? ' now' : f < run.floor ? ' past' : '') + '">';
    r.forEach((node, k) => {
      const N = CONQ_NODES[node.t], took = f < run.floor && run.path[f] === k;
      const live = f === run.floor && conqReachable(run, k);                // 5.1 지난 층에서 고른 줄의 이웃만
      const cls = 'cq-node t-' + node.t + (live ? ' live' : f === run.floor ? ' block' : '') + (f === run.floor && k === conqSel ? ' sel' : '') + (took ? ' took' : '') + (f < run.floor && !took ? ' skip' : '');
      map += '<button type="button" class="' + cls + '" data-f="' + f + '" data-k="' + k + '"' + (live ? '' : ' tabindex="-1"') + '>' +
        (node.t === 'boss' ? '<canvas></canvas>' : '<i>' + N.icon + '</i>') + '<span>' + conqNodeLabel(node) + '</span>' +
        (node.mod ? '<em class="cq-mod" style="--mc:' + STAGE_MODS[node.mod].color + '">' + STAGE_MODS[node.mod].name + (node.mod2 ? ' · ' + STAGE_MODS[node.mod2].name : '') + '</em>' : '') + '</button>';
    });
    map += '</div>';
  });
  map += '</div>';
  wrap.innerHTML = '<div class="cq-main">' + acts + map + '</div><aside class="cq-side cq-detail"></aside>';
  wrap.querySelectorAll('.cq-node.t-boss canvas').forEach(c => {
    const node = run.map[CONQ.floors - 1][0], st = STAGES[node.src];
    if (ENEMIES[st.bossId]) drawUnitIcon(c, ENEMIES[st.bossId], 30);
  });
  wrap.querySelectorAll('.cq-node.live').forEach(b => b.addEventListener('click', () => { conqSel = +b.dataset.k; SFX.ui(); renderConquest(); }));
  conqDetail(run, wrap.querySelector('.cq-detail'));
  return wrap;
}

/* 오른쪽: 고른 칸 설명 · 지금 가진 것 */
function conqDetail(run, el) {
  const node = conqSel >= 0 ? run.map[run.floor][conqSel] : null;
  let h = '';
  if (node) {
    const N = CONQ_NODES[node.t];
    h += '<div class="cq-pick-h"><i>' + N.icon + '</i> ' + N.name + '</div><div class="cq-pick-d">' + N.desc + '</div>';
    if (node.src !== undefined) {
      const st = conqStage(run, node), src = STAGES[node.src];
      h += '<div class="cq-pick-st">' + conqEsc(src.name) + ' <span>(' + (node.src + 1) + '전장)</span></div>';
      h += '<div class="cq-pick-pow">적 강도 <b>×' + (st.enemyMul / (src.enemyMul || 1)).toFixed(2) + '</b>' + (run.curse > 0 ? ' · 저주 ' + run.curse + '전' : '') + '</div>';
      if (st.mods && st.mods.length) h += '<div class="cq-pick-mods">' + st.mods.map(m => '<span style="--mc:' + STAGE_MODS[m].color + '">' + STAGE_MODS[m].name + '</span>').join('') + '</div>';
      if (node.aff) h += affixBlock(node.aff);
    }
    if (node.src !== undefined) {           // 5.1 위험 걸기: 평소 · 도발 · 결사
      h += '<div class="cq-risks">' + CONQ_RISK.map((r, i) => '<button type="button" class="btn ' + (i ? 'cq-risk r' + i : 'primary') + ' cq-enter" data-risk="' + i + '">' +
        '<b>' + (i ? r.name : '출진') + '</b><small>' + (i ? r.desc : '평소대로') + '</small></button>').join('') + '</div>';
    } else h += '<button type="button" class="btn primary cq-enter" data-risk="0">들어간다</button>';
  } else h += '<div class="cq-pick-d">갈림길 하나를 고르세요</div>';
  // 지금 가진 것
  const R = conqEffects(run);
  h += '<div class="cq-have"><div class="cq-have-h">유물 <span>' + run.relics.length + '</span></div><div class="cq-relics">' +
    (run.relics.length ? run.relics.map(id => { const r = CONQ_RELIC_BY_ID[id]; return '<span class="cq-relic' + (id === 'phoenix' && run.phoenixUsed ? ' used' : '') + '" title="' + conqEsc(r.name + ' · ' + r.desc) + '">' + r.icon + '</span>'; }).join('') : '<em>없음</em>') + '</div>';
  const bl = Object.keys(run.bless);
  h += '<div class="cq-have-h">축복 <span>' + conqBlessCount(run) + '</span></div><div class="cq-bless">' +
    (bl.length ? bl.map(id => { const b = CONQ_BLESS_BY_ID[id]; return '<span class="cq-b r-' + b.rar + '" title="' + conqEsc(b.name + ' · ' + b.desc) + '">' + b.icon + (run.bless[id] > 1 ? '<sub>×' + run.bless[id] + '</sub>' : '') + '</span>'; }).join('') : '<em>없음</em>') + '</div>';
  h += '<div class="cq-sum">' + conqSummary(R).map(x => '<span>' + x + '</span>').join('') + '</div></div>';
  h += '<button type="button" class="btn ghost danger cq-quit">원정 포기</button>';
  el.innerHTML = h;
  el.querySelectorAll('.cq-enter').forEach(go => go.addEventListener('click', () => { run.risk = +go.dataset.risk || 0; conqEnter(run, conqSel); }));
  el.querySelector('.cq-quit').addEventListener('click', () => {
    askConfirm('원정 포기', '지금 원정을 끝냅니다. 여기까지의 보상은 받습니다.', () => {
      run.done = 'lose';
      conqEnd(run);
    });
  });
}
/* 쌓인 효과를 짧게 (1 이 아닌 것만) */
function conqSummary(R) {
  const out = [], pc = (v, name) => { if (Math.abs(v - 1) > 0.001) out.push(name + ' ' + (v > 1 ? '+' : '') + Math.round((v - 1) * 100) + '%'); };
  pc(R.atk, '공격'); pc(R.hp, '체력'); pc(R.meleeAtk, '근접 공격'); pc(R.meleeHp, '근접 체력'); pc(R.rangedAtk, '원거리 공격');
  pc(R.heroAtk, '영웅 공격'); pc(R.cheapAtk, '값싼 병종'); pc(R.income, '수입'); pc(R.cd, '출진 대기'); pc(R.cost, '비용');
  pc(R.castle, '성채'); pc(R.enemyHp, '적 체력'); pc(R.enemyAtk, '적 공격'); pc(R.bossHp, '보스 체력'); pc(R.heroCd, '액티브 대기'); pc(R.cmdCd, '왕명 대기');
  if (R.range) out.push('사거리 +' + R.range);
  if (R.startMoney) out.push('시작 군자금 +' + R.startMoney);
  if (R.wallet) out.push('군자금 한도 +' + R.wallet);
  if (R.killGold) out.push('처치 군자금 +' + R.killGold);
  if (R.barrier) out.push('출진 보호막 +' + R.barrier);
  if (R.regen) out.push('성채 회복 ' + (R.regen * 100).toFixed(1) + '%/초');
  if (R.healAfter) out.push('전투 후 성채 +' + Math.round(R.healAfter * 100) + '%');
  pc(R.fortHp, '적 요새'); pc(R.scrip, '군표');
  if (R.scripFlat) out.push('전투 후 군표 +' + R.scripFlat);
  if (R.heroStart) out.push('액티브 준비됨');
  if (R.cmdStart) out.push('왕명 준비됨');
  if (R.freePath) out.push('어느 줄로든');
  if (R.luck) out.push('축복 운');
  return out;
}

/* 고른 칸에 들어간다 */
function conqEnter(run, k) {
  const node = run.map[run.floor][k];
  if (!node || run.pending || run.room || !conqReachable(run, k)) return;
  if (run.locked) {
    if (k !== run.locked.k) { toast('끊긴 전투를 먼저 마쳐야 합니다'); return; }
    run.risk = run.locked.risk;
  }
  run.path[run.floor] = k;
  SFX.ui();
  if (node.src !== undefined) { startConquestBattle(run, node); return; }
  run.risk = 0;
  if (node.t === 'shop') run.room = { t: 'shop', items: conqShop(run) };
  else if (node.t === 'rest') run.room = { t: 'rest' };
  else if (node.t === 'shrine') run.room = { t: 'shrine', id: conqPick(conqRng(run, 3), CONQ_SHRINES).id };
  else if (node.t === 'forge') run.room = { t: 'forge' };
  else if (node.t === 'recruit') run.room = { t: 'recruit', opts: conqRecruitOffer(run, save) };
  else if (node.t === 'treasure') {         // 보물: 유물 둘 중 하나를 고르고 곧장 다음 층으로
    run.pending = { kind: 'relic', opts: conqRelicOffer(run, 2), treasure: true };
    conqAdvance(run); conqSel = -1;
  }
  saveGame(save);
  renderConquest();
}
function conqLeaveRoom(run) {
  run.room = null;
  conqAdvance(run);
  conqSel = -1;
  saveGame(save);
  if (run.done) { conqEnd(run); return; }
  renderConquest();
}

/* ------------------------------ 겹쳐 뜨는 창 ------------------------------ */
function conqOverlay(run) {
  const box = $('#conq-over');
  box.innerHTML = '';
  box.classList.remove('show');
  let card = null;
  if (conqLast) card = conqSummaryCard();
  else if (run && run.pending) card = conqPickCard(run);
  else if (run && run.room) card = run.room.t === 'shop' ? conqShopCard(run) : run.room.t === 'rest' ? conqRestCard(run)
    : run.room.t === 'forge' ? conqForgeCard(run) : run.room.t === 'recruit' ? conqRecruitCard(run) : conqShrineCard(run);
  if (!card) return;
  box.appendChild(card);
  box.classList.add('show');
}
function conqCard(title, sub) {
  const c = document.createElement('div');
  c.className = 'cq-over-card';
  c.innerHTML = '<h3>' + title + '</h3>' + (sub ? '<p class="cq-over-sub">' + sub + '</p>' : '');
  return c;
}
function conqOfferEl(kind, id, extra) {
  const it = kind === 'relic' ? CONQ_RELIC_BY_ID[id] : CONQ_BLESS_BY_ID[id];
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cq-offer ' + (kind === 'relic' ? 'relic' + (it.cursed ? ' cursed' : '') : 'r-' + it.rar);
  b.innerHTML = '<i>' + it.icon + '</i><b>' + it.name + '</b>' +
    '<small>' + (kind === 'relic' ? (it.cursed ? '대가 있는 유물' : '유물') : CONQ_RARITY[it.rar].name) + '</small><em>' + it.desc + '</em>' + (extra || '');
  return b;
}

/* 축복 · 유물 고르기 */
function conqPickCard(run) {
  const p = run.pending;
  const relic = p.kind === 'relic';
  const card = conqCard(p.start ? '출발 유물 고르기' : p.treasure ? '💎 보물 · 유물 고르기' : relic ? '유물 고르기' : '축복 고르기',
    p.got ? '정예의 전리품 · ' + CONQ_RELIC_BY_ID[p.got].icon + ' ' + CONQ_RELIC_BY_ID[p.got].name : p.start ? '원정을 함께할 유물 하나' : '');
  const row = document.createElement('div');
  row.className = 'cq-offers';
  p.opts.forEach(id => {
    const b = conqOfferEl(p.kind, id);
    b.addEventListener('click', () => {
      conqTake(run, p.kind, id);
      run.pending = p.then || null;
      SFX.ui();
      saveGame(save);
      renderConquest();
    });
    row.appendChild(b);
  });
  card.appendChild(row);
  if (!p.start) {
    const btns = document.createElement('div'); btns.className = 'cq-btnrow';
    const cost = conqRerollCost(run);          // 5.1 다시 굴리기
    const re = document.createElement('button');
    re.type = 'button'; re.className = 'btn cq-skip cq-reroll' + (run.scrip < cost ? ' off' : '');
    re.textContent = '🎲 다시 굴리기 · 군표 ' + cost;
    re.addEventListener('click', () => {
      if (!conqReroll(run)) { toast('군표가 모자랍니다'); return; }
      SFX.ui(); saveGame(save); renderConquest();
    });
    const skip = document.createElement('button');
    skip.type = 'button'; skip.className = 'btn ghost cq-skip';
    skip.textContent = '넘기기 · 군표 +15';
    skip.addEventListener('click', () => { run.scrip += 15; run.pending = p.then || null; SFX.ui(); saveGame(save); renderConquest(); });
    btns.appendChild(re); btns.appendChild(skip);
    card.appendChild(btns);
  }
  return card;
}

/* 상점 */
function conqShopCard(run) {
  const card = conqCard('🛒 상점', '군표 🎖 ' + run.scrip + ' · 성채 ' + conqPct(run.castle));
  const row = document.createElement('div');
  row.className = 'cq-offers shop';
  run.room.items.forEach(item => {
    let b;
    const price = '<span class="cq-price">' + (item.sold ? '팔림' : '🎖 ' + item.price) + '</span>';
    if (item.kind === 'heal') {
      b = document.createElement('button'); b.type = 'button'; b.className = 'cq-offer heal';
      b.innerHTML = '<i>🧰</i><b>성채 수리</b><small>회복</small><em>성채 +' + Math.round(item.amount * 100) + '%</em>' + price;
    } else b = conqOfferEl(item.kind, item.id, price);
    const can = !item.sold && run.scrip >= item.price && !(item.kind === 'heal' && run.castle >= 1);
    b.classList.toggle('off', !can);
    b.addEventListener('click', () => {
      if (!conqBuy(run, item)) { toast(item.sold ? '이미 샀습니다' : run.scrip < item.price ? '군표가 모자랍니다' : '성채가 이미 가득합니다'); return; }
      SFX.ui(); saveGame(save); renderConquest();
    });
    row.appendChild(b);
  });
  card.appendChild(row);
  const out = document.createElement('button');
  out.type = 'button'; out.className = 'btn primary cq-skip'; out.textContent = '떠난다';
  out.addEventListener('click', () => { SFX.ui(); conqLeaveRoom(run); });
  card.appendChild(out);
  return card;
}

/* 야영 */
function conqRestCard(run) {
  const heal = conqRestHeal(run);
  const card = conqCard('🔥 야영', '성채 ' + conqPct(run.castle) + ' · 하룻밤을 어떻게 보낼까');
  const row = document.createElement('div');
  row.className = 'cq-offers';
  const a = document.createElement('button'); a.type = 'button'; a.className = 'cq-offer heal' + (run.castle >= 1 ? ' off' : '');
  a.innerHTML = '<i>🛠</i><b>성벽 수리</b><small>휴식</small><em>성채 +' + Math.round(heal * 100) + '%</em>';
  a.addEventListener('click', () => {
    if (run.castle >= 1) { toast('성채가 이미 가득합니다'); return; }
    run.castle = Math.min(1, run.castle + heal); SFX.ui(); conqLeaveRoom(run);
  });
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cq-offer r-rare';
  b.innerHTML = '<i>🎯</i><b>훈련</b><small>희귀 축복</small><em>희귀 축복 셋 중 하나를 고른다</em>';
  b.addEventListener('click', () => {
    run.pending = { kind: 'bless', opts: conqBlessOffer(run, 3 + conqEffects(run).extraPick, CONQ_ODDS.rest), odds: CONQ_ODDS.rest };   // 5.1.1 다시 굴려도 희귀
    SFX.ui(); conqLeaveRoom(run);
  });
  row.appendChild(a); row.appendChild(b);
  card.appendChild(row);
  return card;
}

/* 5.1 대장간: 가진 축복 하나를 하나 더 */
function conqForgeCard(run) {
  const card = conqCard('⚒ 대장간', '벼릴 축복 하나를 고르세요 — 같은 축복이 하나 더 쌓입니다');
  const row = document.createElement('div');
  row.className = 'cq-offers shop';
  Object.keys(run.bless).forEach(id => {
    const b = conqOfferEl('bless', id, '<span class="cq-price">' + (run.bless[id] > 1 ? '×' + run.bless[id] + ' → ×' + (run.bless[id] + 1) : '×1 → ×2') + '</span>');
    b.addEventListener('click', () => { conqForge(run, id); SFX.ui(); conqLeaveRoom(run); });
    row.appendChild(b);
  });
  if (!row.children.length) { const p = document.createElement('p'); p.className = 'cq-res'; p.textContent = '벼릴 축복이 없습니다 · 고철을 팔아 군표 +25'; card.appendChild(p); }
  else card.appendChild(row);
  const out = document.createElement('button');
  out.type = 'button'; out.className = 'btn ghost cq-skip'; out.textContent = row.children.length ? '그냥 떠난다' : '고철을 판다';
  out.addEventListener('click', () => { if (!row.children.length) run.scrip += 25; SFX.ui(); conqLeaveRoom(run); });
  card.appendChild(out);
  return card;
}
/* 5.1 징집소: 병종 하나를 고르고, 바꿀 칸(또는 빈 칸)을 고른다 */
function conqRecruitCard(run) {
  const rm = run.room;
  const card = conqCard('📋 징집소', rm.pick ? '바꿀 자리를 고르세요 · ' + UNIT_BY_ID[rm.pick].name : '편성에 넣을 병종 하나를 고르세요 (편성 ' + run.deck.length + ' / ' + LOADOUT_MAX + ')');
  const row = document.createElement('div');
  row.className = 'cq-offers recruit';
  const unitBtn = (id, extra) => {
    const u = UNIT_BY_ID[id], b = document.createElement('button');
    b.type = 'button'; b.className = 'cq-offer unit r-' + ({ UR: 'epic', SSR: 'epic', SR: 'rare' }[u.rarity] || 'common');
    b.innerHTML = '<canvas></canvas><b>' + u.name + '</b><small>' + (u.role || '') + ' · 비용 ' + unitFor(save, id).cost + '</small>' + (extra || '');
    drawUnitIcon(b.querySelector('canvas'), unitFor(save, id), 40);
    return b;
  };
  if (!rm.pick) {
    rm.opts.forEach(id => { const b = unitBtn(id); b.addEventListener('click', () => { rm.pick = id; SFX.ui(); saveGame(save); renderConquest(); }); row.appendChild(b); });
    if (!rm.opts.length) { const p = document.createElement('p'); p.className = 'cq-res'; p.textContent = '데려올 병종이 없습니다'; card.appendChild(p); }
  } else {
    run.deck.forEach((id, slot) => {
      const b = unitBtn(id, '<em>이 자리에</em>');
      b.addEventListener('click', () => {
        if (!conqRecruit(run, rm.pick, slot)) { toast('전설·신화는 최대 ' + HERO_SLOT_MAX + '명까지 편성할 수 있습니다'); return; }
        SFX.ui(); conqLeaveRoom(run);
      });
      row.appendChild(b);
    });
    if (run.deck.length < LOADOUT_MAX) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cq-offer heal';
      b.innerHTML = '<i>➕</i><b>빈 자리에 더한다</b><small>편성 ' + run.deck.length + ' → ' + (run.deck.length + 1) + '</small>';
      b.addEventListener('click', () => {
        if (!conqRecruit(run, rm.pick, run.deck.length)) { toast('전설·신화는 최대 ' + HERO_SLOT_MAX + '명까지 편성할 수 있습니다'); return; }
        SFX.ui(); conqLeaveRoom(run);
      });
      row.insertBefore(b, row.firstChild);
    }
  }
  card.appendChild(row);
  const out = document.createElement('button');
  out.type = 'button'; out.className = 'btn ghost cq-skip';
  out.textContent = rm.pick ? '다른 병종 고르기' : '그냥 떠난다';
  out.addEventListener('click', () => { SFX.ui(); if (rm.pick) { rm.pick = null; saveGame(save); renderConquest(); } else conqLeaveRoom(run); });
  card.appendChild(out);
  return card;
}

/* 제단 */
function conqShrineCard(run) {
  const sh = CONQ_SHRINE_BY_ID[run.room.id];
  const card = conqCard('✨ ' + sh.name, sh.text);
  const res = run.room.res;
  if (res) {
    const lines = [];
    if (res.lost) lines.push('잃음 · ' + CONQ_BLESS_BY_ID[res.lost].icon + ' ' + CONQ_BLESS_BY_ID[res.lost].name);
    if (res.relic) lines.push('유물 · ' + CONQ_RELIC_BY_ID[res.relic].icon + ' ' + CONQ_RELIC_BY_ID[res.relic].name);
    if (res.bless) lines.push('축복 · ' + CONQ_BLESS_BY_ID[res.bless].icon + ' ' + CONQ_BLESS_BY_ID[res.bless].name);
    if (res.gamble !== undefined) lines.push(res.gamble ? '이겼다! 군표 +90' : '졌다…');
    if (!lines.length) lines.push(res.none ? '조용히 지나쳤다' : '끝났다');
    const p = document.createElement('p'); p.className = 'cq-res'; p.textContent = lines.join('\n');
    card.appendChild(p);
    const out = document.createElement('button');
    out.type = 'button'; out.className = 'btn primary cq-skip'; out.textContent = '계속';
    out.addEventListener('click', () => { SFX.ui(); conqLeaveRoom(run); });
    card.appendChild(out);
    return card;
  }
  const row = document.createElement('div');
  row.className = 'cq-offers shrine';
  sh.opts.forEach(o => {
    const b = document.createElement('button'); b.type = 'button';
    const can = conqShrineCan(run, o);
    b.className = 'cq-offer choice' + (can ? '' : ' off');
    b.innerHTML = '<b>' + o.label + '</b>' + (o.note ? '<em>' + o.note + '</em>' : '');
    b.addEventListener('click', () => {
      if (!conqShrineCan(run, o)) { toast('대가를 치를 수 없습니다'); return; }
      const r = conqShrine(run, o) || {};
      if (!o.cost && !Object.keys(o.gain || {}).length) r.none = true;
      run.room.res = r;
      SFX.ui(); saveGame(save); renderConquest();
    });
    row.appendChild(b);
  });
  card.appendChild(row);
  return card;
}

/* 원정 정산 */
function conqSummaryCard() {
  const { run, fin } = conqLast;
  const card = conqCard(fin.win ? '👑 정벌 완료!' : '정벌 실패', (run.asc ? '단계 ' + run.asc : '기본') + ' · ' + fin.floors + ' / ' + (CONQ.acts * CONQ.floors) + '층');
  const lines = [];
  lines.push('이긴 전투 ' + fin.won + ' · 처치 ' + fmtNum(run.kills));
  lines.push('전투 금화 💰 ' + fmtNum(run.coins) + (fin.coins ? ' · 정벌 보상 💰 ' + fmtNum(fin.coins) : ''));
  lines.push('소환석 🔮 +' + fin.stones);
  if (fin.first) lines.push('단계 ' + run.asc + ' 첫 정벌! 소환석 덤 · ' + (run.asc < CONQ.ascMax ? '단계 ' + (run.asc + 1) + ' 열림' : '마지막 단계'));
  if (run.relics.length) lines.push('유물 ' + run.relics.map(id => CONQ_RELIC_BY_ID[id].icon).join(' '));
  const p = document.createElement('p'); p.className = 'cq-res'; p.textContent = lines.join('\n');
  card.appendChild(p);
  const ok = document.createElement('button');
  ok.type = 'button'; ok.className = 'btn primary cq-skip'; ok.textContent = '확인';
  ok.addEventListener('click', () => { conqLast = null; SFX.ui(); renderConquest(); });
  card.appendChild(ok);
  return card;
}

/* 원정이 끝났다 (졌거나 · 다 내려갔거나 · 포기) */
function conqEnd(run) {
  const fin = conqFinish(save, run);
  conqLast = { run: run, fin: fin };
  save.conquest = null;
  conqSel = -1;
  checkAchievements();
  saveGame(save);
  if ($('#scr-conquest').classList.contains('active')) renderConquest();
}

/* ------------------------------ 전투 ------------------------------ */
function startConquestBattle(run, node) {
  const st = conqStage(run, node);
  battle = new Battle(node.src, save, st, { run: conqEffects(run), castle: run.castle, deck: run.deck });
  battle.conqNode = node;
  run.fighting = true;
  saveGame(save);
  $('#scr-battle').classList.toggle('hardcore', node.t !== 'battle');
  $('#battle-stage').textContent = '⚔ ' + (run.act + 1) + '막 ' + (run.floor + 1) + '층 · ' + st.name + (run.risk ? ' · ' + CONQ_RISK[run.risk].name : '');
  beginBattle();
  const mods = Object.keys(battle.mods).map(m => STAGE_MODS[m].name);
  const head = node.t === 'boss' ? '정벌 보스' : node.t === 'elite' ? '정벌 정예' : node.t === 'trial' ? '정벌 시련' : '정벌';
  battle.announce(head + ' · 성채 ' + conqPct(run.castle) + (mods.length ? ' · ' + mods.join(' · ') : ''), 3.2);
}

/* 전투가 끝나면 원정을 고친다 (결과창 · 나가기 둘 다 여기로) */
function conqResolveBattle(b) {
  const run = conqRunNow();
  if (!run || !b || !b.conquest || b._conqDone) return (b && b._conqInfo) || null;
  b._conqDone = true;
  const win = b.state === 'win';
  const ratio = b.allyCastle.hp / b.allyCastle.maxHp;
  const before = run.scrip;
  conqAfterBattle(run, b.conqNode, win, ratio, { phoenixUsed: !!b.phoenixUsed, kills: b.kills, coins: b.coins });
  run.fighting = false; run.locked = null;
  const info = { win: win, castle: run.castle, scrip: run.scrip - before, boss: b.conqNode.t === 'boss', phoenix: !!b.phoenixUsed };
  if (win) { conqAdvance(run); conqSel = -1; }
  if (run.done) { info.done = run.done; conqEnd(run); }
  else saveGame(save);
  b._conqInfo = info;
  return info;
}
function showConquestResult() {
  const b = battle, info = conqResolveBattle(b) || { win: b.state === 'win' };
  $('#result-title').textContent = info.done === 'win' ? '정벌 완료!' : info.win ? (info.boss ? '보스 격파' : '정벌 승리') : '정벌 실패';
  $('#result-stars').innerHTML = info.win ? starMarks(b.stars) : '';
  const lines = [];
  lines.push('획득 골드 💰 ' + fmtNum(b.coins) + '  ·  처치 ' + b.kills);
  if (info.win) {
    lines.push('남은 성채 ' + conqPct(info.castle) + (info.boss ? ' (보스 격파 · 30% 회복)' : '') + '  ·  군표 🎖 +' + info.scrip);
    if (info.phoenix) lines.push('🪶 불사조 깃털을 썼습니다');
    if (!info.done) lines.push('정벌 지도로 돌아가 보상을 고르세요');
  } else lines.push('성채가 무너졌습니다 · 원정이 끝났습니다');
  appendTrialNews(lines);
  $('#result-desc').textContent = lines.join('\n');
  $('#btn-retry').style.display = 'none';
  $('#btn-next').style.display = 'none';
  $('#btn-fix').style.display = 'none';
  $('#btn-tomap').style.display = 'none';
  $('#btn-conq').style.display = '';
  $('#result').classList.add('show');
}
/* 전투 '나가기': 정벌에선 진 것으로 */
function conqQuitBattle() {
  if (!battle || !battle.conquest) return false;
  askConfirm('정벌 전투 포기', '이 전투를 포기하면 원정이 여기서 끝납니다. 정말 나가시겠습니까?', () => {
    if (battle.state === 'play') battle.finish('lose');
    conqResolveBattle(battle);
    flushPlayTime(); saveGame(save);
    show('scr-conquest');
  });
  return true;
}

/* 진군도 '정벌' 탭의 카드 */
function renderConqSlot() {
  const slot = $('#endless-slot');
  slot.innerHTML = '';
  const el = document.createElement('div');
  if (!conqOpen(save)) {
    el.className = 'endless-card locked';
    el.textContent = '🔒 정벌은 ' + CONQ.unlock + '전장을 돌파하면 열립니다';
    slot.appendChild(el);
    return;
  }
  const run = conqRunNow(), rec = conqNormRec(save.conqRec);
  el.className = 'endless-card conq-card';
  el.innerHTML = '<div class="e-title">⚔ 왕국 정벌</div>' +
    '<div class="e-sub">갈림길을 골라 세 막을 내려가는 원정. 이길 때마다 축복을, 정예와 보스는 유물을 줍니다. 성채는 이어지고, 한 번 지면 끝.</div>' +
    '<div class="e-best">' + (run ? '진행 중 · ' + (run.act + 1) + '막 ' + (run.floor + 1) + '층 · 성채 ' + conqPct(run.castle)
      : '최고 <b>' + rec.best + '</b>층 · 정벌 <b>' + rec.wins + '</b>회') + '</div>' +
    '<button class="btn primary e-btn">' + (run ? '이어서' : '정벌로') + '</button>';
  el.querySelector('.e-btn').addEventListener('click', () => { SFX.ui(); openConquest(); });
  slot.appendChild(el);
}

/* 타이틀의 '왕국 정벌' 단추: 열린 뒤에만 보인다 */
function refreshConqTitle() {
  const b = $('#btn-conquest');
  if (!b) return;
  b.hidden = !conqOpen(save);
  const run = conqRunNow();
  $('#conquest-state').textContent = run ? (run.act + 1) + '막 ' + (run.floor + 1) + '층 진행 중' : '로그라이크 원정';
}
function initConquest() {
  $('#btn-conquest').addEventListener('click', () => { SFX.ui(); openConquest(); });
  $('#conq-back').addEventListener('click', () => { SFX.ui(); show('scr-map'); });
  $('#btn-conq').addEventListener('click', () => {
    $('#result').classList.remove('show');
    show('scr-conquest');
  });
  refreshConqTitle();
}
