/* =======================================================================
 * 막대 왕국 전쟁 — 3D 렌더 그림체 (시험)
 * 2D 전투는 그대로 두고, 병사 몸은 3D 모델(3d/models.js)을 옆에서 조명을 넣어 찍은
 * 스프라이트로 바꿔 그린다 (미리 렌더한 2D — 예전 3D 렌더 게임들의 방식).
 * 투사체 · 타격 · 폭발 · 연기 · 오라 · 소환 빛 · 피해 숫자도 입체 음영으로 다시 그린다.
 * 설정 '그림체' 에서 켤 때만 three.js 와 함께 불러온다.
 * ======================================================================= */
(function () {
'use strict';
const T = THREE;

/* ---------- 찍는 틀 ---------- */
const POSES = [{ time: 0.3 }];                                                  // 0 대기
for (let k = 0; k < 6; k++) POSES.push({ time: 0.3, phase: k / 6 * Math.PI, moving: true });   // 1~6 걷기
POSES.push({ time: 0.3, wind: 1 });                                             // 7 준비
for (let k = 0; k < 4; k++) POSES.push({ time: 0.3, atk: (k + 0.5) / 4 });      // 8~11 공격
const IDLE = 0, WALK0 = 1, WIND = 7, ATK0 = 8;
const YAW = 0.42, ELEV = 0.2;           // 조금 앞쪽 · 조금 위에서 (얼굴과 몸 앞이 보이게)
const PPU_MAX = 2.2, PX_MAX = 340;      // 월드 1 단위당 화소 · 한 칸 최대 크기

let R = null, scene = null, cam = null;
function init() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  R = new T.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setClearColor(0x000000, 0);
  R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.15;
  scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xeef4ff, 0x6a5440, 1.25));
  const key = new T.DirectionalLight(0xfff0dc, 2.8); key.position.set(-40, 150, 130); scene.add(key);     // 앞 왼쪽 위 해
  const rim = new T.DirectionalLight(0xc8dcff, 2.2); rim.position.set(110, 70, -150); scene.add(rim);      // 뒤에서 테두리 빛
  const fill = new T.DirectionalLight(0xffd8b0, 0.45); fill.position.set(120, -10, 90); scene.add(fill);
  cam = new T.OrthographicCamera(-1, 1, 1, -1, -3000, 3000);
  cam.position.set(Math.sin(YAW) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(YAW) * Math.cos(ELEV)).multiplyScalar(1000);
  cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
}

/* 만화 음영 재질을 매끈한 PBR 재질로 — '3D 로 만든' 느낌 */
function smoothen(m) {
  const swap = new Map(), made = [];
  m.wrap.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.isMeshToonMaterial) return;
    let n = swap.get(o.material);
    if (!n) {
      const c = o.material.color, l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      n = new T.MeshStandardMaterial({ color: c.clone(), roughness: l > 0.45 ? 0.42 : 0.62, metalness: l > 0.45 ? 0.25 : 0.04 });
      swap.set(o.material, n); made.push(n);
    }
    o.material = n;
  });
  return made;
}

const _v = new T.Vector3(), _box = new T.Box3(), _all = new T.Box3();
function bake(st) {
  if (!R) init();
  const m = M3.build(st, 'ally');
  const made = smoothen(m);
  scene.add(m.wrap);
  // 모든 자세를 덮는 틀 (월드 → 카메라 공간)
  _all.makeEmpty();
  for (const p of POSES) { M3.animate(m, p); m.wrap.updateMatrixWorld(true); _box.setFromObject(m.wrap); _all.union(_box); }
  _all.expandByScalar(3);
  let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity;
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? _all.max.x : _all.min.x, i & 2 ? _all.max.y : _all.min.y, i & 4 ? _all.max.z : _all.min.z).applyMatrix4(cam.matrixWorldInverse);
    l = Math.min(l, _v.x); r = Math.max(r, _v.x); b = Math.min(b, _v.y); t = Math.max(t, _v.y);
  }
  const P = Math.min(PPU_MAX, PX_MAX / Math.max(r - l, t - b));
  const fw = Math.ceil((r - l) * P), fh = Math.ceil((t - b) * P);
  r = l + fw / P; b = t - fh / P;
  Object.assign(cam, { left: l, right: r, top: t, bottom: b }); cam.updateProjectionMatrix();
  R.setSize(fw, fh, false);
  _v.set(0, 0, 0).applyMatrix4(cam.matrixWorldInverse);
  const ax = (_v.x - l) * P + 1, ay = (t - _v.y) * P + 1;          // 발 자리 (테두리 1화소 포함)
  const cw = fw + 2, ch = fh + 2;
  const atlas = document.createElement('canvas'); atlas.width = cw * POSES.length; atlas.height = ch;
  const ac = atlas.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch;
  const tc = tmp.getContext('2d');
  POSES.forEach((p, i) => {
    M3.animate(m, p);
    R.render(scene, cam);
    // 얇은 잉크 테두리: 실루엣을 여덟 방향으로 한 칸씩 밀어 어둡게 깔고 위에 몸을 얹는다 (밝은 땅에서도 읽히게)
    tc.clearRect(0, 0, cw, ch);
    tc.globalCompositeOperation = 'source-over';
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 2], [0, 2], [2, 0]]) tc.drawImage(R.domElement, dx, dy);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = 'rgba(14,16,24,.78)'; tc.fillRect(0, 0, cw, ch);
    tc.globalCompositeOperation = 'source-over';
    tc.drawImage(R.domElement, 1, 1);
    ac.drawImage(tmp, i * cw, 0);
  });
  scene.remove(m.wrap);
  M3.dispose(m); made.forEach(x => x.dispose());
  // 대기 자세가 실제로 차지하는 칸 (아이콘에 꽉 차게 넣으려고)
  const px = ac.getImageData(0, 0, cw, ch).data;
  let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (px[(y * cw + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { atlas, cw, ch, ax, ay, P, used: 0, ib: x1 >= x0 ? [x0, y0, x1 + 1, y1 + 1] : [0, 0, cw, ch] };
}

/* ---------- 캐시 · 차례 ---------- */
const cache = new Map(), queue = [], queued = new Set(), waiters = new Map();
const MAX = 64;
const keyOf = st => (st.id || st.shape) + '|' + st.shape + '|' + st.body + '|' + st.tunic + '|' + st.accent + '|' + (st.rarity || '') + (st.boss ? 'B' : '') + (st.evo ? 'E' : '');
let tickN = 0;
function want(st) {
  const k = keyOf(st);
  const e = cache.get(k);
  if (e) { e.used = tickN; return e; }
  if (!queued.has(k)) { queued.add(k); queue.push({ k, st }); pump(); }
  return null;
}
/* 전투 밖(훈련소 · 편성)에서도 차례를 굴린다 */
let pumping = false, lastTick = 0;
function pump() {
  if (pumping) return;
  pumping = true;
  const step = () => { if (performance.now() - lastTick > 12) tick(); if (queue.length && !failed) requestAnimationFrame(step); else pumping = false; };
  requestAnimationFrame(step);
}
let failed = false;
function tick() {
  tickN++; lastTick = performance.now();
  if (failed || !queue.length) return;
  const t0 = performance.now();
  do {
    const j = queue.shift(); queued.delete(j.k);
    try { cache.set(j.k, Object.assign(bake(j.st), { used: tickN })); }
    catch (err) { failed = true; R3D.on = false; console.warn('3D 렌더 그림체를 만들지 못해 막대 그림으로 돌아갑니다', err); return; }
    const w = waiters.get(j.k);
    if (w) { waiters.delete(j.k); w.forEach(fn => { try { fn(); } catch (e) { /* 화면이 바뀌었다 */ } }); }
  } while (queue.length && performance.now() - t0 < 10);
  if (cache.size > MAX) {          // 오래 안 쓴 것부터 버린다
    const old = [...cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, cache.size - MAX);
    for (const [k] of old) cache.delete(k);
  }
}

const BODY_K = 1.1;           // 막대 병사(굵은 잉크 선)와 같은 덩치로 보이게 조금 키운다
function blit(ctx, e, i, s, mode, alpha) {
  const k = s / e.P * BODY_K;
  if (mode) { ctx.save(); ctx.globalCompositeOperation = mode; if (alpha != null) ctx.globalAlpha *= alpha; }
  ctx.drawImage(e.atlas, i * e.cw, 0, e.cw, e.ch, -e.ax * k, -e.ay * k, e.cw * k, e.ch * k);
  if (mode) ctx.restore();
}
function poseOf(f, moving, swingT, wind) {
  if (swingT >= 0) return ATK0 + Math.min(3, Math.floor(swingT * 4));
  if (wind > 0.35) return WIND;
  if (moving) { const b = ((f.bob % Math.PI) + Math.PI) % Math.PI; return WALK0 + Math.min(5, Math.floor(b / Math.PI * 6)); }
  return IDLE;
}

/* ======================================================================
 * 입체 음영 이펙트 (캔버스) — 구 · 원통 · 고리를 빛과 그늘로
 * ====================================================================== */
const rgb = c => { const x = new T.Color(c || '#ffffff'); return [Math.round(x.r * 255), Math.round(x.g * 255), Math.round(x.b * 255)]; };
const RGB = new Map();
function col(c, a, k) {      // k: 밝게(+) · 어둡게(-)
  let v = RGB.get(c); if (!v) { v = rgb(c); RGB.set(c, v); }
  const f = k || 0, m = x => Math.round(f > 0 ? x + (255 - x) * f : x * (1 + f));
  return 'rgba(' + m(v[0]) + ',' + m(v[1]) + ',' + m(v[2]) + ',' + (a == null ? 1 : a) + ')';
}
/* 빛 받는 구: 왼쪽 위가 밝고 오른쪽 아래 가장자리가 어둡다 + 반짝 */
function sphere(ctx, x, y, r, c, a, glow, soft) {
  if (r <= 0.3) return;
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
  g.addColorStop(0, col(c, a, glow ? 0.85 : 0.5)); g.addColorStop(0.5, col(c, a, glow ? 0.25 : 0)); g.addColorStop(soft ? 0.82 : 1, col(c, a * (soft ? 0.7 : 1), glow ? -0.1 : -0.5));
  if (soft) g.addColorStop(1, col(c, 0, -0.5));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  if (soft) return;                                  // 연기 · 불길은 반짝이지 않는다
  ctx.fillStyle = 'rgba(255,255,255,' + 0.55 * (a == null ? 1 : a) + ')';
  ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, 7); ctx.fill();
}
/* 부드러운 빛 덩이 (가산 합성으로 겹쳐 불길이 된다) */
function blob(ctx, x, y, r, c, a) {
  const g = ctx.createRadialGradient(x, y - r * 0.15, 0, x, y, r);
  g.addColorStop(0, col(c, a, 0.7)); g.addColorStop(0.35, col(c, a * 0.85)); g.addColorStop(1, col(c, 0, -0.3));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
function halo(ctx, x, y, r, c, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col(c, a, 0.5)); g.addColorStop(0.4, col(c, a * 0.5)); g.addColorStop(1, col(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
/* 땅에 누운 고리: 위 가장자리는 밝고 아래는 그늘 (도톰한 띠처럼) */
function ring(ctx, x, y, rx, ry, c, a, w) {
  ctx.lineWidth = w * 1.6; ctx.strokeStyle = col(c, a * 0.55, -0.5);
  ctx.beginPath(); ctx.ellipse(x, y + w * 0.5, rx, ry, 0, 0, 7); ctx.stroke();
  ctx.lineWidth = w; ctx.strokeStyle = col(c, a, 0.15);
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.stroke();
  ctx.lineWidth = w * 0.4; ctx.strokeStyle = col(c, a, 0.75);
  ctx.beginPath(); ctx.ellipse(x, y - w * 0.3, rx, ry, 0, Math.PI, Math.PI * 2); ctx.stroke();
}
/* 원통 빛기둥: 가운데가 밝고 양옆으로 어두워진다 */
function pillar(ctx, x, y, w, h, c, a) {
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, col(c, 0)); g.addColorStop(0.3, col(c, a * 0.5)); g.addColorStop(0.5, col(c, a, 0.8)); g.addColorStop(0.7, col(c, a * 0.5)); g.addColorStop(1, col(c, 0));
  ctx.fillStyle = g; ctx.fillRect(x - w, y - h, w * 2, h);
  ring(ctx, x, y, w * 1.2, w * 0.36, c, a, 2);
}
/* 연기 덩이: 그늘진 구 여럿 */
function puffs(ctx, x, y, r, n, q, c, a, seed) {
  for (let i = 0; i < n; i++) {
    const ang = i / n * Math.PI * 2 + seed, d = r * (0.3 + q * 0.9);
    sphere(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.45 - q * r * 0.6, r * (0.35 + q * 0.35) * (0.8 + (i % 3) * 0.15), c, a, false, true);
  }
}
/* 불덩이: 아래는 그을린 붉은 덩이(그늘), 위로 가산 합성 불길 — 가운데가 하얗게 탄다 */
function fireball(ctx, x, y, r, q, a) {
  for (let i = 0; i < 6; i++) {
    const ang = i * 2.399 + 0.5, d = r * 0.5 * (0.35 + q);
    sphere(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.6 - q * r * 0.35, r * (0.4 + q * 0.1), q < 0.5 ? '#d8481a' : '#7a3a26', a * 0.85, false, true);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const ang = i * 2.399, d = r * 0.4 * (0.3 + q);
    blob(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.6 - q * r * 0.3, r * (0.48 - q * 0.18), i % 3 ? '#ff8a2a' : '#ffc84a', a * (1 - q * 0.7));
  }
  blob(ctx, x, y - q * r * 0.2, r * 0.42 * (1 - q * 0.6), '#fff4c8', a * (1 - q));
  ctx.restore();
}

const FX = {
  hit(rd, ctx, e, x, y, p, cs) {
    const q = 1 - p, dir = e.dir || 1, c = e.color || '#ffe6a0', big = e.big ? 1.6 : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    halo(ctx, x, y, (16 + q * 12) * cs * big, c, p * 0.9);
    blob(ctx, x, y, (7 + q * 4) * cs * big, '#ffffff', p);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {                      // 불똥: 앞쪽으로 튀는 빛줄기 (뿌리는 밝고 끝은 색)
      const a = -0.9 + i * 0.45 + (e.x % 3) * 0.1, d0 = (4 + q * 8) * cs * big, d1 = (12 + q * 26) * cs * big;
      const x0 = x + dir * Math.cos(a) * d0, y0 = y + Math.sin(a) * d0, x1 = x + dir * Math.cos(a) * d1, y1 = y + Math.sin(a) * d1;
      const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(255,255,255,' + p + ')'); g.addColorStop(1, col(c, 0));
      ctx.strokeStyle = g; ctx.lineWidth = (2.6 - i * 0.2) * cs; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.restore();
    if (q < 0.7) for (let i = 0; i < 3; i++) {        // 튀는 파편: 그늘진 작은 돌
      const a = -1.2 + i * 0.8, d = q * 30 * cs * big;
      sphere(ctx, x + dir * Math.cos(a) * d, y + Math.sin(a) * d + q * q * 30 * cs, 2.2 * cs * big, '#a89a86', p);
    }
    return true;
  },
  crit(rd, ctx, e, x, y, p, cs) { return FX.hit(rd, ctx, Object.assign({}, e, { big: true, color: '#ffd66e' }), x, y, p, cs); },
  boom(rd, ctx, e, x, y, p, cs) {
    const q = 1 - p, r = Math.max(22 * cs, e.r * rd.zoom * 0.72), gy = y + 18 * cs;
    ring(ctx, x, gy, r * (0.6 + q * 1.2), r * (0.6 + q * 1.2) * 0.28, '#ffd9a0', p * 0.9, 3.4 * cs);   // 충격파
    if (q > 0.3) puffs(ctx, x, y - 6 * cs, r * 0.85, 7, (q - 0.3) / 0.7, '#5a5450', p * 0.85, e.x * 0.01);   // 남는 연기
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    halo(ctx, x, y, r * 2, '#ff9a3c', p * 0.8);
    if (q < 0.25) blob(ctx, x, y, r * (1.1 + q * 2), '#fff6d8', 1 - q / 0.25);      // 터지는 순간 흰 섬광
    ctx.restore();
    if (q < 0.8) fireball(ctx, x, y, r, q / 0.8, 1);
    for (let i = 0; i < 6; i++) {                       // 튀는 돌 조각: 포물선으로 떨어진다
      const a = -Math.PI * (0.15 + i * 0.14), v = r * (1.2 + (i % 3) * 0.35);
      sphere(ctx, x + Math.cos(a) * v * q, y + Math.sin(a) * v * q + q * q * r * 1.6, (2.2 + (i % 2)) * cs, '#7a6a5a', Math.min(1, p * 2));
    }
    return true;
  },
  poof(rd, ctx, e, x, y, p, cs) {
    const q = 1 - p, r = (e.big ? 40 : 22) * cs;
    puffs(ctx, x, y + 10 * cs, r, e.big ? 9 : 6, q, e.color || '#d8ccb0', p * 0.85, e.x * 0.013);
    return true;
  },
  aura(rd, ctx, e, x, y, p, cs) {
    const q = 1 - p, rr = Math.max(10 * cs, e.r * rd.zoom * (0.25 + q * 0.75)), c = e.color || '#9ad8ff', gy = y + 14 * cs;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, gy - 50 * cs, 0, gy);          // 고리에서 피어오르는 빛 막
    g.addColorStop(0, col(c, 0)); g.addColorStop(1, col(c, p * 0.35));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, gy - 25 * cs, rr, 25 * cs + rr * 0.28, 0, 0, 7); ctx.fill();
    ctx.restore();
    ring(ctx, x, gy, rr, rr * 0.28, c, p * 0.95, 2.6 * cs);
    for (let i = 0; i < 4; i++) {                      // 떠오르는 빛 구슬
      const a = i * 1.57 + q * 2, k = (q + i * 0.25) % 1;
      sphere(ctx, x + Math.cos(a) * rr * 0.8, gy - k * 46 * cs + Math.sin(a) * rr * 0.2, 2.6 * cs, c, p * (1 - k), true);
    }
    return true;
  },
  spawn(rd, ctx, e, x, y, p, cs) {
    const gy = rd.rowY(e.row), q = 1 - p, c = e.color || (e.grand ? '#ffe28a' : '#cfe8ff');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    pillar(ctx, x, gy, (e.grand ? 22 : 12) * cs * (1 - q * 0.5), (e.grand ? 190 : 110) * cs, c, p * 0.75);
    ctx.restore();
    ring(ctx, x, gy + 2, (8 + q * (e.grand ? 50 : 32)) * cs, (3 + q * (e.grand ? 15 : 10)) * cs, c, p, 2.4 * cs);
    return true;
  },
  coin(rd, ctx, e, x, y, p, cs) {
    const q = 1 - p, cy = y - 10 * cs - q * 34 * cs, sw = Math.abs(Math.cos(q * 14));
    ctx.save(); ctx.globalAlpha = Math.min(1, p * 2);
    const g = ctx.createLinearGradient(x - 7 * cs, cy - 7 * cs, x + 7 * cs, cy + 7 * cs);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ffc93a'); g.addColorStop(1, '#a8701a');
    ctx.fillStyle = '#7a5010'; ctx.beginPath(); ctx.ellipse(x + 1 * cs, cy, 7 * cs * Math.max(0.15, sw), 7 * cs, 0, 0, 7); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, 7 * cs * Math.max(0.12, sw), 7 * cs, 0, 0, 7); ctx.fill();
    if (e.v) text3d(ctx, '+' + e.v, x + 10 * cs, cy + 4 * cs, 12 * cs, '#ffe08a', 'left');
    ctx.restore();
    return true;
  },
  dmg(rd, ctx, e, x, y, p, cs) {
    if (!rd.showDmg) return true;
    const k = 1 - p, ease = 1 - Math.pow(1 - Math.min(1, k / 0.6), 3);
    const rise = ease * 34 * cs + (e.dy || 0);
    let pop = k < 0.12 ? 1 + (k / 0.12) * 0.45 : 1.45 - Math.min(0.45, (k - 0.12) * 3);
    if (e.bump > 0) { pop += e.bump * 2.5; e.bump = Math.max(0, e.bump - (rd._frameDt || 0.016)); }
    ctx.save(); ctx.globalAlpha = Math.min(1, p * 2.5);
    text3d(ctx, e.crit ? e.v + '!' : String(e.v), x, y - rise, (e.crit ? 19 : 13.5) * cs * pop, e.crit ? '#ffd166' : (e.ally ? '#ff9c8a' : '#f4ecd8'), 'center');
    ctx.restore();
    return true;
  }
};
/* 돌출 글자: 아래로 몇 겹 어둡게 깔아 두께를 주고, 윗면은 위가 밝은 그라디언트 */
function text3d(ctx, s, x, y, size, c, align) {
  ctx.font = '900 ' + Math.round(size) + 'px system-ui, sans-serif';
  ctx.textAlign = align; ctx.lineJoin = 'round';
  const d = Math.max(1, size * 0.09);
  ctx.fillStyle = col(c, 1, -0.72);
  for (let i = 3; i >= 1; i--) ctx.fillText(s, x + d * i * 0.5, y + d * i);
  ctx.lineWidth = Math.max(2, size * 0.16); ctx.strokeStyle = 'rgba(10,8,12,.85)'; ctx.strokeText(s, x, y);
  const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y);
  g.addColorStop(0, col(c, 1, 0.6)); g.addColorStop(0.55, col(c, 1)); g.addColorStop(1, col(c, 1, -0.25));
  ctx.fillStyle = g; ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}

/* 투사체: 화살은 둥근 자루(원통 음영) · 쇠 촉 · 깃, 마법탄 · 폭탄은 빛나는 구, 보스 돌은 그늘진 바위 */
function shot(ctx, cs, s, p, magic, clock) {
  if (s.bossThrow) {
    ctx.rotate(clock * 9);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; halo(ctx, 0, 0, 16 * cs, s.color || '#ff7a4a', 0.6); ctx.restore();
    sphere(ctx, 0, 0, 8.5 * cs, '#5a4e48', 1); return true;
  }
  if (s.area || magic) {
    const r0 = (s.area ? 6.5 : 5.5) * cs, c = s.color || '#ffd76a';
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; halo(ctx, 0, 0, r0 * 2.8, c, 0.7); ctx.restore();
    if (s.area && !magic) { sphere(ctx, 0, 0, r0, '#3a3436', 1); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(-r0 * 0.9, -r0 * 0.6, 1.6 * cs, 0, 7); ctx.fill(); }   // 폭탄: 검은 쇠공 + 심지 불
    else sphere(ctx, 0, 0, r0, c, 1, true);
    return true;
  }
  // 화살
  const g = ctx.createLinearGradient(0, -1.6 * cs, 0, 1.6 * cs);
  g.addColorStop(0, '#d8b888'); g.addColorStop(0.45, '#9a7448'); g.addColorStop(1, '#4a3420');
  ctx.fillStyle = g; ctx.fillRect(-11 * cs, -1.3 * cs, 19 * cs, 2.6 * cs);
  const h = ctx.createLinearGradient(0, -4 * cs, 0, 4 * cs);
  h.addColorStop(0, '#ffffff'); h.addColorStop(0.5, '#b8c0ca'); h.addColorStop(1, '#4a525c');
  ctx.fillStyle = h; ctx.beginPath(); ctx.moveTo(14 * cs, 0); ctx.lineTo(6 * cs, -3.8 * cs); ctx.lineTo(7.5 * cs, 0); ctx.lineTo(6 * cs, 3.8 * cs); ctx.closePath(); ctx.fill();
  for (const k of [-1, 1]) {
    ctx.fillStyle = col(s.color || '#e8e0d0', 1, k < 0 ? 0.3 : -0.3);
    ctx.beginPath(); ctx.moveTo(-5 * cs, 0); ctx.lineTo(-11 * cs, k * 4 * cs); ctx.lineTo(-13.5 * cs, k * 3.4 * cs); ctx.lineTo(-9 * cs, 0); ctx.closePath(); ctx.fill();
  }
  return true;
}

/* ---------- 바깥에 내놓는 것 ---------- */
R3D.api = {
  tick,
  /* 전투 시작: 편성 · 그 전장의 적을 미리 찍어 둔다 */
  prepare(battle) {
    try {
      for (const u of battle.roster || []) want(u);
      const seen = new Set();
      for (const w of (battle.stage && battle.stage.waves) || []) if (!seen.has(w.e) && ENEMIES[w.e]) { seen.add(w.e); want(ENEMIES[w.e]); }
    } catch (e) { /* 미리 찍기는 덤 */ }
  },
  fighter(ctx, f, s, moving, swingT, wind) {
    const e = want(f.s); if (!e) return false;
    blit(ctx, e, poseOf(f, moving, swingT, wind), s);
    return true;
  },
  flash(ctx, f, s, moving, swingT, wind, a) {
    const e = want(f.s); if (!e) return false;
    blit(ctx, e, poseOf(f, moving, swingT, wind), s, 'lighter', a);
    return true;
  },
  body(ctx, st, s, flash) {
    const e = want(st); if (!e) return false;
    blit(ctx, e, IDLE, s, flash ? 'lighter' : null);
    return true;
  },
  /* 병종 아이콘: 다 찍혔으면 그려 주고, 아니면 찍히는 대로 다시 칠하도록 기다린다 */
  icon(c, st, px, again) {
    const e = want(st);
    if (!e) { if (again) { const k = keyOf(st); if (!waiters.has(k)) waiters.set(k, []); if (waiters.get(k).length < 40) waiters.get(k).push(again); } return false; }
    const [x0, y0, x1, y1] = e.ib, bw = x1 - x0, bh = y1 - y0, k = Math.min(px * 0.9 / bw, px * 0.9 / bh);
    c.drawImage(e.atlas, x0, y0, bw, bh, (px - bw * k) / 2, px * 0.96 - bh * k, bw * k, bh * k);
    return true;
  },
  fx(rd, ctx, e, x, y, p, cs) { const h = FX[e.type]; return !!(h && h(rd, ctx, e, x, y, p, cs)); },
  shot,
  ready: k => cache.has(k), size: () => cache.size, pending: () => queue.length, failed: () => failed
};
})();
