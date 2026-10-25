/* =======================================================================
 * 막대 왕국 전쟁 3D 시험판 — 장면 · 전투 · 화면
 * 전투는 본편 엔진(js/game.js 의 Battle)을 그대로 돌리고, 그리는 것만 3D 로 바꿨다.
 * 2D 전장 좌표 x 는 그대로 3D x 로, 줄(row 0~2)은 앞뒤 깊이(z)로 옮긴다.
 * 시험판이라 본편 저장은 읽기만 하고 쓰지 않는다.
 * ======================================================================= */
(function () {
'use strict';
const T = THREE;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* 엔진이 판이 끝날 때 저장을 부른다 — 시험판은 저장하지 않는다 */
window.saveGame = function () { return true; };

const LS = {
  get(k, d) { try { const v = localStorage.getItem('sk3d-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sk3d-' + k, JSON.stringify(v)); } catch (e) { /* 저장소 없음 */ } }
};
const COARSE = window.matchMedia && matchMedia('(pointer: coarse)').matches;
const OPT = { all: LS.get('all', false), hq: LS.get('hq', !COARSE), hard: false };
const ROW_GAP = 26;
const rowZ = r => ((r == null ? 1 : r) - 1) * ROW_GAP;

/* ---------- 본편 저장 (읽기만) ---------- */
function baseSave() {
  let raw = null;
  try { raw = SaveStore.read(); } catch (e) { raw = null; }
  const s = Object.assign({ cleared: 0, coins: 0, upgrades: {}, levels: {}, loadout: ['spear'], owned: {}, evo: {}, evo2: {}, evo3: {}, devUnits: {}, stars: {}, hard: {}, events: {} }, raw || {});
  for (const k of ['upgrades', 'levels', 'owned', 'evo', 'evo2', 'evo3', 'devUnits', 'stars', 'hard', 'events']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  UNITS.forEach(u => { s.levels[u.id] = Math.max(1, Math.floor(s.levels[u.id]) || 1); });
  if (!Array.isArray(s.loadout)) s.loadout = ['spear'];
  s.cleared = Math.max(0, Math.min(STAGES.length, s.cleared | 0));
  s._found = !!raw;
  return s;
}
let SAVE = baseSave();

function availableUnits() {
  if (OPT.all) return UNITS.slice();
  return UNITS.filter(u => rosterOpen(SAVE, u) || (u.gacha && SAVE.owned[u.id]));
}
function heroCount(list) { return list.filter(id => isHeroUnit(UNIT_BY_ID[id])).length; }
let DECK = LS.get('deck', null);
function deckNow() {
  const ok = new Set(availableUnits().map(u => u.id));
  let d = (Array.isArray(DECK) ? DECK : SAVE.loadout).filter(id => ok.has(id));
  if (!d.length || (OPT.all && !Array.isArray(DECK))) d = sampleDeck();
  return d.slice(0, LOADOUT_MAX);
}
/* 편성이 없을 때: 값싼 벽 · 원거리 · 지원 · 영웅 둘을 고루 */
function sampleDeck() {
  const av = availableUnits(), out = [];
  const pick = f => { const u = av.find(u => f(u) && !out.includes(u.id)); if (u) out.push(u.id); };
  pick(u => u.id === 'spear'); pick(u => u.id === 'shield'); pick(u => u.id === 'archer'); pick(u => u.id === 'priest');
  const plain = av.filter(u => !isHeroUnit(u) && !out.includes(u.id)).sort((a, b) => b.cost - a.cost);
  for (let i = 0; out.length < 8 && i < plain.length; i += Math.max(1, Math.floor(plain.length / 5))) out.push(plain[i].id);
  av.filter(isHeroUnit).sort((a, b) => b.cost - a.cost).slice(0, HERO_SLOT_MAX).forEach(u => out.push(u.id));
  return out.slice(0, LOADOUT_MAX);
}
function battleSave() {
  const s = JSON.parse(JSON.stringify(SAVE));
  if (OPT.all) UNITS.forEach(u => { if (u.gacha) s.owned[u.id] = true; else s.devUnits[u.id] = true; });
  s.loadout = deckNow();
  return s;
}

/* ---------- 렌더러 ---------- */
const canvas = $('#view');
let R;
try {
  R = new T.WebGLRenderer({ canvas, antialias: OPT.hq, powerPreference: 'high-performance' });
} catch (e) {
  $('#boot').classList.add('err');
  $('#boot').textContent = '이 기기에서 WebGL 을 켤 수 없어 3D 시험판을 열 수 없습니다. (' + (e && e.message || e) + ')';
  return;
}
R.setPixelRatio(Math.min(window.devicePixelRatio || 1, OPT.hq ? 2 : 1.25));
R.shadowMap.enabled = OPT.hq;
R.shadowMap.type = T.PCFSoftShadowMap;
const camera = new T.PerspectiveCamera(36, 1, 5, 9000);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  R.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (gal.cam) { gal.cam.aspect = camera.aspect; gal.cam.updateProjectionMatrix(); }
}
window.addEventListener('resize', resize);

/* 공용 도형 */
const G = {
  ring: new T.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2),
  disc: new T.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
  sph: new T.SphereGeometry(1, 14, 10),
  pillar: new T.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0),
  arrow: new T.CylinderGeometry(0.7, 0.7, 18, 5).rotateZ(Math.PI / 2),
  tip: new T.ConeGeometry(1.6, 5, 5).rotateZ(-Math.PI / 2).translate(10, 0, 0),
  beam: new T.BoxGeometry(1, 1, 1).translate(0.5, 0, 0),
  mound: new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)
};
const fxMat = (color, opa, add) => new T.MeshBasicMaterial({ color: new T.Color(color || '#ffffff'), transparent: true, opacity: opa == null ? 1 : opa,
  depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, side: T.DoubleSide });
const MAT_CACHE = new Map();
function cachedMat(key, make) { let m = MAT_CACHE.get(key); if (!m) { m = make(); MAT_CACHE.set(key, m); } return m; }
function toon(color) {
  return cachedMat('toon' + color, () => new T.MeshToonMaterial({ color: new T.Color(color) }));
}
function lum(hex) { const c = new T.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
/* 씨앗 난수 — 전장마다 소품 자리가 같게 */
function seeded(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ======================================================================
 * 전장
 * ====================================================================== */
let scene = null, sun = null, field = null;

function skyTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  return tx;
}

function propMesh(kind, L, n, rnd, len, near) {
  let geo, color;
  if (/pine/.test(kind)) { geo = new T.ConeGeometry(16, 60, 7).translate(0, 30, 0); color = L.prop || '#2f4a30'; }
  else if (/tree|palm|jungle|bush|flower|reeds|mush/.test(kind)) { geo = new T.IcosahedronGeometry(18, 0).translate(0, 26, 0); color = L.prop || '#4d6a34'; }
  else if (/grave|stone|tomb|pillar|ruin|obelisk|column/.test(kind)) { geo = new T.BoxGeometry(12, 26, 8).translate(0, 13, 0); color = L.ridge || '#777'; }
  else if (/crystal|ice|shard/.test(kind)) { geo = new T.OctahedronGeometry(12, 0).translate(0, 14, 0); color = L.orb || '#cfe8ff'; }
  else { geo = new T.DodecahedronGeometry(10, 0).translate(0, 5, 0); color = L.speck || L.groundDark || '#666'; }
  const m = new T.InstancedMesh(geo, toon(color), n);
  const o = new T.Object3D();
  for (let i = 0; i < n; i++) {
    const back = !near || rnd() < 0.85;
    o.position.set((rnd() - 0.5) * (len + 1600), 0, back ? -130 - rnd() * 800 : 110 + rnd() * 120);
    o.rotation.y = rnd() * Math.PI * 2;
    o.scale.setScalar(back ? 0.6 + rnd() * 1.1 : 0.35 + rnd() * 0.3);
    o.updateMatrix(); m.setMatrixAt(i, o.matrix);
  }
  m.castShadow = OPT.hq; m.receiveShadow = false;
  return m;
}

function allyCastleModel() {
  const g = new T.Group(), stone = toon('#a7acb4'), dark = toon('#5c6068'), roof = toon('#3a5aa8'), wood = toon('#6b4a2a');
  const add = (geo, m, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = OPT.hq; o.receiveShadow = OPT.hq; g.add(o); return o; };
  add(new T.BoxGeometry(70, 96, 96), stone, -10, 48, 0);
  for (const z of [-56, 56]) {
    add(new T.CylinderGeometry(20, 22, 140, 12), stone, 0, 70, z);
    add(new T.ConeGeometry(25, 44, 12), roof, 0, 162, z);
  }
  for (let i = -3; i <= 3; i++) add(new T.BoxGeometry(12, 12, 10), stone, 22, 102, i * 13);
  add(new T.BoxGeometry(4, 40, 30), dark, 26, 20, 0);
  add(new T.CylinderGeometry(1.2, 1.2, 60, 6), wood, -10, 126, 0);
  const flag = add(new T.BoxGeometry(26, 16, 1), roof, 3, 146, 0); flag.userData.flag = true;
  g.userData.flag = flag;
  return g;
}
function enemyCastleModel() {
  const g = new T.Group(), log = toon('#5a3e2a'), dark = toon('#3a2a26'), red = toon('#a8322a'), bone = toon('#e8e2cf');
  const add = (geo, m, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = OPT.hq; o.receiveShadow = OPT.hq; g.add(o); return o; };
  add(new T.BoxGeometry(80, 110, 90), dark, 14, 55, 0);
  add(new T.ConeGeometry(52, 50, 4), red, 14, 135, 0).rotation.y = Math.PI / 4;
  for (let i = -5; i <= 5; i++) {
    const h = 66 + (i % 2 ? 10 : 0);
    add(new T.CylinderGeometry(5, 5.5, h, 7), log, -34, h / 2, i * 11);
    add(new T.ConeGeometry(5, 12, 7), log, -34, h + 6, i * 11);
  }
  const skull = add(new T.SphereGeometry(13, 12, 10), bone, -27, 92, 0);
  for (const z of [-5, 5]) add(new T.SphereGeometry(3, 8, 6), toon('#1a1010'), -38, 94, z);
  skull.scale.set(1, 1.05, 1);
  for (const z of [-48, 48]) add(new T.BoxGeometry(1, 34, 18), red, -20, 120, z);
  return g;
}

function buildField(stage) {
  disposeScene(scene);
  scene = new T.Scene();
  const L = lookOf(stage);
  const dark = lum(L.sky0 || '#888') < 0.22;
  const len = WORLD;
  scene.background = skyTexture(L.sky0 || '#8ec3e6', L.sky1 || '#e6efd8');
  scene.fog = new T.Fog(new T.Color(L.sky1 || '#e6efd8'), 1100, 3600);
  scene.add(new T.HemisphereLight(new T.Color(L.sky0 || '#ffffff'), new T.Color(L.groundDark || '#444'), dark ? 2.2 : 1.9));
  sun = new T.DirectionalLight(new T.Color(L.orb || '#fff5dd'), dark ? 1.1 : 2.1);
  sun.castShadow = OPT.hq;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -700, right: 700, top: 420, bottom: -420, near: 50, far: 2400 });
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  // 땅 · 길
  const ground = new T.Mesh(new T.PlaneGeometry(len + 6000, 4000).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ color: new T.Color(L.ground || '#7f9a4f') }));
  ground.receiveShadow = OPT.hq; scene.add(ground);
  const road = new T.Mesh(new T.PlaneGeometry(len - 80, 104).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ color: new T.Color(L.groundDark || '#5a7236'), transparent: true, opacity: 0.75 }));
  road.position.y = 0.3; road.receiveShadow = OPT.hq; scene.add(road);
  // 먼 산 (두 겹)
  const rnd = seeded(len * 7 + (stage.name || '').length * 131);
  for (const [color, zf, hMin, hMax, n] of [[L.ridgeFar || '#86a7b6', -2600, 380, 760, 16], [L.ridge || '#5f8a5c', -1500, 200, 420, 18]]) {
    const m = new T.MeshLambertMaterial({ color: new T.Color(color) });
    for (let i = 0; i < n; i++) {
      const h = hMin + rnd() * (hMax - hMin), r = h * (0.9 + rnd() * 0.7);
      const c = new T.Mesh(new T.ConeGeometry(r, h, L.ridgeStyle === 'sharp' ? 5 : 9), m);
      c.position.set((i / (n - 1) - 0.5) * (len + 4200) + (rnd() - 0.5) * 300, h / 2 - 4, zf - rnd() * 400);
      scene.add(c);
    }
  }
  // 소품
  const props = (L.props && L.props.length ? L.props : ['rock']).slice(0, 3);
  props.forEach((p, i) => scene.add(propMesh(p, L, i === 0 ? 60 : 36, rnd, len, i === props.length - 1)));
  // 성
  const ac = allyCastleModel(); ac.position.set(ALLY_BASE_X - len / 2 - 40, 0, 0); scene.add(ac);
  const ec = enemyCastleModel(); ec.position.set(ENEMY_BASE_X - len / 2 + 40, 0, 0); scene.add(ec);
  field = { look: L, dark, len, allyCastle: ac, enemyCastle: ec, units: new T.Group(), fxRoot: new T.Group(), bars: new T.Group() };
  scene.add(field.units); scene.add(field.fxRoot); scene.add(field.bars);
}

function disposeScene(sc) {
  if (!sc) return;
  // 병사 · 효과는 clearBattle 이 치운다. 남은 땅 · 산 · 소품의 도형과 재질만 버린다 (공용 · 캐시는 남긴다)
  if (field) for (const g of [field.units, field.fxRoot, field.bars]) sc.remove(g);
  const keepG = new Set(Object.values(G)), keepM = new Set(MAT_CACHE.values());
  sc.traverse(o => {
    if (o.geometry && !keepG.has(o.geometry)) o.geometry.dispose();
    if (o.material && !keepM.has(o.material) && o.material.dispose) o.material.dispose();
  });
  if (sc.background && sc.background.dispose) sc.background.dispose();
}

/* ======================================================================
 * 전투
 * ====================================================================== */
let battle = null, cfg = null, paused = false, follow = true, camX = 0, camDist = 640, camTilt = 0.42;
const live = new Map();        // 병사 → 모델
const dying = [];              // 쓰러진 병사 모델 (넘어지며 흐려진다)
const shotVis = new Map();
const fxVis = new Map();
const burrowVis = new Map();
let stamp = 0, clock = 0, autoT = 0;
const hpBg = new T.SpriteMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false });
const hpFill = {
  ally: new T.SpriteMaterial({ color: new T.Color('#5ad06a'), depthTest: false }),
  enemy: new T.SpriteMaterial({ color: new T.Color('#e8584a'), depthTest: false }),
  boss: new T.SpriteMaterial({ color: new T.Color('#ffb03c'), depthTest: false })
};
const stunMat = fxMat('#ffe04a', 0.9, true);
const blobMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

function startBattle(c) {
  cfg = c;
  clearBattle();
  const s = battleSave();
  if (c.kind === 'event') battle = new Battle(STAGES.length + c.index, s, EVENT_STAGES[c.index]);
  else battle = new Battle(c.index, s, null, { hard: !!c.hard });
  battle.speed = LS.get('speed', 1);
  buildField(battle.stage);
  camX = ALLY_BASE_X + 420 - WORLD / 2; follow = true; paused = false;
  $('#b-stage').textContent = c.kind === 'event' ? '✦ E' + (c.index + 1) + '. ' + battle.stage.name : (c.hard ? '💀 ' : '') + (c.index + 1) + '. ' + battle.stage.name;
  $('#result').hidden = true; $('#pause-cover').hidden = true;
  buildCards();
  syncButtons();
  show('battle');
  if (c.kind === 'event' && battle.stage.event) battle.announce('도전 · ' + battle.stage.event.mech, 4);
  else if (c.hard) battle.announce('하드코어 · 적이 훨씬 모질다', 3);
  resultShown = false;
}

function clearBattle() {
  for (const [, m] of live) { M3.dispose(m); if (m.bar) disposeBar(m.bar); }
  live.clear();
  for (const d of dying) M3.dispose(d.m);
  dying.length = 0;
  for (const [, v] of fxVis) if (v) disposeFx(v);
  fxVis.clear(); shotVis.clear(); burrowVis.clear();
  numPool.forEach(n => { n.el.style.opacity = 0; n.busy = false; });
  bursts.forEach(b => b.mesh.material.dispose()); bursts.length = 0;
  battle = null;
}

function makeBar() {
  const g = new T.Group();
  const bg = new T.Sprite(hpBg); bg.center.set(0, 0.5); bg.scale.set(32, 3.4, 1); bg.renderOrder = 10;
  const fill = new T.Sprite(hpFill.ally); fill.center.set(0, 0.5); fill.scale.set(31, 2.4, 1); fill.position.set(0.5, 0, 0.01); fill.renderOrder = 11;
  g.add(bg); g.add(fill); g.userData.fill = fill;
  field.bars.add(g);
  return g;
}
function disposeBar(b) { if (b.parent) b.parent.remove(b); }

function newModel(f) {
  const m = M3.build(f.s, f.side);
  m.jz = (Math.random() - 0.5) * 10;
  m.z = rowZ(f.row) + m.jz;
  m.ph = Math.random() * 6;
  m.wrap.traverse(o => { if (o.isMesh) { o.castShadow = OPT.hq && !(o.material && o.material.transparent); } });
  if (!OPT.hq) {                  // 그림자를 끈 저화질: 발밑에 둥근 그늘만
    const b = new T.Mesh(G.disc, blobMat); b.position.y = 0.5; b.scale.set(m.quad || m.serpent ? 26 : 16, 1, m.quad || m.serpent ? 14 : 12); b.renderOrder = 1; m.wrap.add(b); m.blobShadow = b;
  }
  field.units.add(m.wrap);
  live.set(f, m);
  return m;
}

function syncFighters(dt, adt) {
  stamp++;
  const W2 = WORLD / 2;
  for (const list of [battle.allies, battle.enemies]) {
    for (const f of list) {
      if (f.dead) continue;
      let m = live.get(f);
      if (!m) m = newModel(f);
      m.seen = stamp;
      const tz = rowZ(f.row) + m.jz;
      m.z += (tz - m.z) * Math.min(1, dt * 6);
      m.wrap.position.set(f.x - W2, 0, m.z);
      const face = (f.charmT > 0 ? -f.dir : f.dir) > 0 ? 0 : Math.PI;
      m.wrap.rotation.y += (face - m.wrap.rotation.y) * Math.min(1, dt * 10);
      m.wrap.scale.setScalar(f.scale || 1);
      const walking = f.moving && !f.engaged;
      if (walking) m.ph += adt * Math.max(2.5, (f.s.speed || 40) / 9);
      const atk = f.swing > 0 ? Math.max(0, 1 - f.swing / 0.22) : 0;
      const wind = (f.engaged && f.swing <= 0 && f.cd < 0.45) ? 1 - f.cd / 0.45 : 0;
      M3.animate(m, {
        time: clock, phase: m.ph, moving: walking, atk, wind,
        kb: f.kbTimer > 0 ? Math.min(1, f.kbTimer * 2.5) : 0,
        lift: f.flyT > 0 ? Math.min(30, f.flyT * 60) : 0,
        stun: f.stunT > 0, flash: f.hitFlash || 0, fade: f.vanish ? 0.4 : (f.veilT > 0 ? 0.45 : 1)
      });
      // 기절 별
      if (f.stunT > 0) {
        if (!m.stun) { m.stun = new T.Mesh(G.ring, stunMat); m.stun.scale.setScalar(9); m.wrap.add(m.stun); }
        m.stun.visible = true; m.stun.position.y = m.h + 6 + (m.fly || 0); m.stun.rotation.y = clock * 5;
      } else if (m.stun) m.stun.visible = false;
      // 체력 막대 (다친 병사 · 보스만)
      const hurt = f.hp < f.maxHp;
      if (hurt || f.boss) {
        if (!m.bar) m.bar = makeBar();
        const k = Math.max(0, f.hp / f.maxHp), fill = m.bar.userData.fill;
        fill.material = f.boss ? hpFill.boss : hpFill[f.side === 'ally' ? 'ally' : 'enemy'];
        fill.scale.x = 31 * k;
        const w = f.boss ? 1.8 : 1;
        m.bar.scale.set(w, w, 1);
        m.bar.position.set(f.x - W2 - 16 * w, (m.h + (m.fly || 0)) * (f.scale || 1) + 10, m.z);
        m.bar.visible = true;
      } else if (m.bar) m.bar.visible = false;
    }
  }
  for (const [f, m] of live) {
    if (m.seen === stamp && !f.dead) continue;
    live.delete(f);
    if (m.bar) disposeBar(m.bar);
    if (m.stun) m.stun.visible = false;
    if (m.blobShadow) m.blobShadow.visible = false;
    dying.push({ m, t: 0, vanish: !!f.vanish });
  }
  for (let i = dying.length - 1; i >= 0; i--) {
    const d = dying[i];
    d.t += adt;
    const life = d.vanish ? 0.35 : 1.1;
    M3.animate(d.m, { time: clock, phase: d.m.ph, dead: d.vanish ? 0 : Math.min(1, d.t / 0.55), fade: Math.max(0, 1 - Math.max(0, d.t - (d.vanish ? 0 : 0.6)) / (life - (d.vanish ? 0 : 0.6))) });
    if (d.t >= life) { field.units.remove(d.m.wrap); M3.dispose(d.m); dying.splice(i, 1); }
  }
}

/* 땅속을 기어 오는 적: 흙더미 */
function syncBurrowers() {
  const W2 = WORLD / 2, seen = new Set();
  for (const b of battle.burrowers || []) {
    let v = burrowVis.get(b);
    if (!v) { v = new T.Mesh(G.mound, toon('#6b5236')); v.scale.set(16, 8, 14); field.units.add(v); burrowVis.set(b, v); }
    v.position.set(b.x - W2, 0, rowZ(b.row));
    v.scale.y = 7 + Math.sin(clock * 12 + b.x) * 1.5;
    seen.add(b);
  }
  for (const [b, v] of burrowVis) if (!seen.has(b)) { field.units.remove(v); burrowVis.delete(b); }
}

/* 투사체 */
function shotMesh(s) {
  const color = s.color || (s.side === 'ally' ? '#e8e0d0' : '#ffb07a');
  if (s.area || s.missile || s.bossThrow || s.magic) {
    const g = new T.Group();
    const core = new T.Mesh(G.sph, cachedMat('shotc' + color, () => fxMat(color, 1, false))); core.scale.setScalar(s.missile ? 5 : 4.5);
    const halo = new T.Mesh(G.sph, cachedMat('shoth' + color, () => fxMat(color, 0.35, true))); halo.scale.setScalar(s.missile ? 11 : 9);
    g.add(core); g.add(halo); g.userData.ball = true;
    return g;
  }
  const g = new T.Group();
  g.add(new T.Mesh(G.arrow, cachedMat('arr', () => new T.MeshBasicMaterial({ color: new T.Color('#7a5a34') }))));
  g.add(new T.Mesh(G.tip, cachedMat('tip' + color, () => new T.MeshBasicMaterial({ color: new T.Color(color) }))));
  return g;
}
function syncShots() {
  const W2 = WORLD / 2;
  for (const s of battle.shots) {
    if (s.t < 0) continue;
    let v = shotVis.get(s);
    if (!v) { v = { mesh: shotMesh(s), area: !!s.area, color: s.color }; field.fxRoot.add(v.mesh); shotVis.set(s, v); }
    v.seen = stamp;
    const p = Math.min(1, s.t / (s.dur || 1)), arc = s.missile ? 150 : 60;
    const x = s.x + (s.tx - s.x) * p, y = 36 + Math.sin(p * Math.PI) * arc, z = rowZ(s.y0);
    v.mesh.position.set(x - W2, y, z);
    const vx = (s.tx - s.x), vy = Math.cos(p * Math.PI) * Math.PI * arc;
    v.mesh.rotation.z = Math.atan2(vy, vx);
    v.last = v.mesh.position.clone();
  }
  for (const [s, v] of shotVis) {
    if (v.seen === stamp) continue;
    field.fxRoot.remove(v.mesh);
    shotVis.delete(s);
    if (v.area && v.last) burst(v.last, v.color || '#ffb347', 34);
  }
}

/* 효과 — 엔진의 fx 목록을 3D 모양으로 */
const RING_TYPES = /aura|rally|chill|charm|stun|revive|bell|banner|soul|reap|wish|mirror|release|cast|pullwave/;
const WARN_TYPES = /warn|doom|inferno|firewave|taxwarn/;
function makeFx(e) {
  const t = e.type;
  if (t === 'corpse') return null;
  if (t === 'dmg' || t === 'miss' || t === 'coin') return { dom: popNumber(e) };
  const v = { root: new T.Group(), mats: [] };
  const add = (geo, color, opa, add_) => { const m = fxMat(color, opa, add_); v.mats.push(m); const o = new T.Mesh(geo, m); o.renderOrder = 5; v.root.add(o); return o; };
  const color = e.color || ({ hit: '#ffffff', boom: '#ff9a3c', spawn: '#9ad8ff', poof: '#cfcfcf', warn: '#ff5a3c', x3: '#ffe9a0', beam: '#bfe6ff', chain: '#a8d8ff', leap: '#ffd27a', chargeline: '#ff5a3c', firewave: '#ff7a1e', inferno: '#ff5a1e', doom: '#b04aff' })[t] || '#ffd76a';
  v.kind = 'ring';
  if (t === 'hit') { v.kind = 'spark'; v.a = add(G.sph, color, 0.9, true); }
  else if (t === 'boom') { v.kind = 'boom'; v.a = add(G.sph, color, 0.8, true); v.b = add(G.ring, '#ffd27a', 0.8, true); }
  else if (t === 'spawn' || t === 'x3') { v.kind = 'pillar'; v.a = add(G.pillar, color, 0.55, true); v.b = add(G.ring, color, 0.9, true); }
  else if (t === 'poof') { v.kind = 'poof'; v.a = add(G.sph, color, 0.55, false); }
  else if (WARN_TYPES.test(t) || t === 'chargeline') {
    v.kind = 'warn';
    if (e.x2 !== undefined) { v.kind = 'strip'; v.a = add(G.beam, color, 0.4, false); }
    else { v.a = add(G.disc, color, 0.3, false); v.b = add(G.ring, color, 0.9, false); }
  }
  else if (e.x2 !== undefined) { v.kind = 'beam'; v.a = add(G.beam, color, 0.85, true); }
  else { v.a = add(G.ring, color, 0.9, true); if (t === 'cast') v.b = add(G.pillar, color, 0.3, true); }
  field.fxRoot.add(v.root);
  return v;
}
function disposeFx(v) {
  if (v.dom) { v.dom.busy = false; v.dom.el.style.opacity = 0; return; }
  if (v.root.parent) v.root.parent.remove(v.root);
  v.mats.forEach(m => m.dispose());
}
function updateFx(v, e) {
  const W2 = WORLD / 2, life = e.life || 0.5, p = Math.max(0, Math.min(1, 1 - e.t / life)), q = 1 - p;
  const x = e.x - W2, z = e.row == null ? 0 : rowZ(e.row);
  if (v.dom) { placeNumber(v.dom, e, p); return; }
  v.root.position.set(x, 0, z);
  const r = e.r || 60;
  switch (v.kind) {
    case 'spark': v.a.position.set((e.dir || 0) * 4, 36, 0); v.a.scale.setScalar(4 + p * 9); v.a.material.opacity = q * 0.9; break;
    case 'boom': v.a.position.y = 18; v.a.scale.setScalar(Math.max(8, r * 0.55) * (0.4 + p * 0.8)); v.a.material.opacity = q * 0.8; v.b.scale.setScalar(r * (0.3 + p)); v.b.position.y = 1; v.b.material.opacity = q; break;
    case 'pillar': { const big = e.grand ? 1.6 : 1; v.a.scale.set(14 * big, 200 * big * (0.4 + q * 0.6), 14 * big); v.a.material.opacity = q * 0.55; v.b.scale.setScalar(20 + p * 40); v.b.position.y = 1; v.b.material.opacity = q; break; }
    case 'poof': v.a.position.y = 24 + p * 14; v.a.scale.setScalar(10 + p * 18); v.a.material.opacity = q * 0.5; break;
    case 'warn': {
      v.root.position.z = e.row == null ? 0 : z;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 14);
      v.a.scale.setScalar(r); v.a.position.y = 0.6; v.a.material.opacity = 0.18 + p * 0.25 + pulse * 0.08;
      v.b.scale.setScalar(r * (0.2 + p * 0.8)); v.b.position.y = 0.8; v.b.material.opacity = 0.9;
      break;
    }
    case 'strip': { const x2 = e.x2 - W2; v.root.position.x = Math.min(x, x2); v.a.scale.set(Math.abs(x2 - x) || 1, 1, 26); v.a.position.y = 0.7; v.a.material.opacity = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(clock * 12)); break; }
    case 'beam': {
      const x2 = e.x2 - W2, z2 = e.row2 == null ? z : rowZ(e.row2);
      v.root.position.set(x, 40, z);
      const dx = x2 - x, dz = z2 - z;
      v.a.scale.set(Math.hypot(dx, dz) || 1, 2.4 * (0.5 + q), 2.4 * (0.5 + q));
      v.a.rotation.y = -Math.atan2(dz, dx);
      v.a.material.opacity = q;
      break;
    }
    default:
      v.a.scale.setScalar(Math.max(14, r) * (0.25 + p * 0.85)); v.a.position.y = 1.2; v.a.material.opacity = q * 0.9;
      if (v.b) { v.b.scale.set(16, 90 * q, 16); v.b.material.opacity = q * 0.35; }
  }
}
function syncFx() {
  for (const e of battle.fx) {
    let v = fxVis.get(e);
    if (v === undefined) { v = makeFx(e); fxVis.set(e, v); }
    if (!v) continue;
    v.seen = stamp;
    updateFx(v, e);
  }
  for (const [e, v] of fxVis) {
    if (v && v.seen === stamp) continue;
    if (!v && battle.fx.includes(e)) continue;
    if (v) disposeFx(v);
    fxVis.delete(e);
  }
  // 터지는 탄의 불꽃 (엔진에 없는 3D 장식)
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.t += lastAdt;
    const p = b.t / 0.4;
    b.mesh.scale.setScalar(b.r * (0.3 + p)); b.mesh.material.opacity = Math.max(0, 0.8 * (1 - p));
    if (p >= 1) { field.fxRoot.remove(b.mesh); b.mesh.material.dispose(); bursts.splice(i, 1); }
  }
}
const bursts = [];
let lastAdt = 0;
function burst(pos, color, r) {
  if (bursts.length > 30) return;
  const mesh = new T.Mesh(G.sph, fxMat(color, 0.8, true)); mesh.position.copy(pos); field.fxRoot.add(mesh);
  bursts.push({ mesh, t: 0, r });
}

/* 피해 숫자 — DOM 으로 (글자는 DOM 이 또렷하고 값싸다) */
const numBox = $('#numbers'), numPool = [];
for (let i = 0; i < 48; i++) { const el = document.createElement('span'); el.style.opacity = 0; numBox.appendChild(el); numPool.push({ el, busy: false }); }
function popNumber(e) {
  const n = numPool.find(n => !n.busy);
  if (!n) return { busy: false, el: { style: {} }, dummy: true };
  n.busy = true;
  n.el.className = e.type === 'coin' ? 'gold' : (e.crit ? 'crit' : (e.ally ? 'ally' : ''));
  n.el.textContent = e.type === 'coin' ? '+' + e.v + 'G' : (e.type === 'miss' ? '빗나감' : String(e.v));
  return n;
}
const _v = new T.Vector3();
function placeNumber(n, e, p) {
  if (n.dummy) return;
  _v.set(e.x - WORLD / 2, 64 + (e.dy || 0) + p * 30, e.row == null ? 0 : rowZ(e.row)).project(camera);
  if (_v.z > 1) { n.el.style.opacity = 0; return; }
  const sx = (_v.x * 0.5 + 0.5) * window.innerWidth, sy = (-_v.y * 0.5 + 0.5) * window.innerHeight;
  n.el.style.transform = 'translate(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px) translate(-50%,-50%) scale(' + (e.crit ? 1.15 : 1) + ')';
  n.el.style.opacity = p < 0.7 ? 1 : (1 - p) / 0.3;
}

/* 성 */
function syncCastles(adt) {
  for (const [c, m, sgn] of [[battle.allyCastle, field.allyCastle, -1], [battle.enemyCastle, field.enemyCastle, 1]]) {
    if (c.dead) {
      m.userData.fall = Math.min(1.6, (m.userData.fall || 0) + adt);
      const k = m.userData.fall / 1.6;
      m.position.y = -k * 90; m.rotation.z = sgn * k * 0.25;
    } else {
      m.position.y = 0; m.rotation.z = 0; m.userData.fall = 0;
      const sh = c.hitFlash > 0 ? (Math.random() - 0.5) * 2.5 : 0;
      m.position.z = sh;
    }
    if (m.userData.flag) m.userData.flag.rotation.y = Math.sin(clock * 3) * 0.25;
  }
}

/* 카메라 */
function placeCamera(dt) {
  if (!battle) return;
  const W2 = WORLD / 2;
  if (follow) {
    const tgt = battle.frontline() - W2 - 60;
    camX += (tgt - camX) * Math.min(1, dt * 1.8);
  }
  const lim = W2 - 120;
  camX = Math.max(-lim, Math.min(lim, camX));
  const portrait = camera.aspect < 1;
  const dist = camDist * (portrait ? 1.3 : 1);
  let sx = 0, sy = 0;
  const sh = battle.shake || 0;
  if (sh > 0.2) { sx = (Math.random() - 0.5) * sh * 1.4; sy = (Math.random() - 0.5) * sh * 0.8; }
  camera.position.set(camX + sx, 40 + dist * camTilt + sy, dist);
  camera.lookAt(camX + sx, 34, 0);
  if (sun) { sun.position.set(camX - 360, 820, 520); sun.target.position.set(camX, 0, 0); }
}

/* ---------- HUD ---------- */
let cardEls = [], resultShown = false;
function buildCards() {
  const box = $('#cards'); box.innerHTML = '';
  cardEls = battle.roster.map(u => {
    const b = document.createElement('button');
    b.className = 'card';
    b.innerHTML = '<span class="rb r-' + (u.rarity || 'N') + '">' + (u.rarity || '') + '</span><span class="nm"></span><span class="co"></span><i class="cd"></i><span class="act">필살</span>';
    b.querySelector('.nm').textContent = u.name;
    b.querySelector('.co').textContent = u.cost;
    thumb(u).then(url => { if (url) b.style.backgroundImage = 'url(' + url + ')'; });
    b.addEventListener('click', ev => {
      if (!battle || paused) return;
      unlockAudio();
      if (ev.target.classList.contains('act')) { if (battle.useHeroActive(u.id)) toast(u.name + ' 필살!'); return; }
      battle.deploy(u.id);
    });
    box.appendChild(b);
    return { u, b, cd: b.querySelector('.cd'), act: b.querySelector('.act'), off: null, h: -1, ready: null };
  });
}
function hud() {
  const a = battle.allyCastle, e = battle.enemyCastle;
  setW($('#hp-ally'), a.hp / a.maxHp);
  setW($('#hp-enemy'), e.hp / e.maxHp);
  setText($('#b-money'), '💰 ' + Math.floor(battle.money) + ' / ' + battle.walletMax);
  for (const c of cardEls) {
    const off = !battle.canDeploy(c.u.id);
    if (off !== c.off) { c.off = off; c.b.classList.toggle('off', off); }
    const full = c.u.cooldown * battle.cdMul, h = full > 0 ? Math.round(Math.max(0, battle.cooldowns[c.u.id] || 0) / full * 100) : 0;
    if (h !== c.h) { c.h = h; c.cd.style.height = h + '%'; }
    const ready = !!(c.u.active && battle.canHeroActive(c.u.id));
    if (ready !== c.ready) { c.ready = ready; c.act.classList.toggle('ready', ready); }
  }
  const cmd = $('#b-cmd');
  cmd.classList.toggle('off', !battle.canCommand());
  setH(cmd.querySelector('i'), Math.max(0, battle.cmdCd) / battle.cmdMax);
  const boss = battle.aliveBoss();
  $('#boss-bar').hidden = !boss;
  if (boss) { setText($('#boss-name'), '👑 ' + boss.s.name); setW($('#boss-hp'), boss.hp / boss.maxHp); }
  const an = $('#announce');
  const msg = battle.patternT > 0 ? battle.patternName : (battle.bossAlert > 0 ? '보스 등장!' : '');
  if (msg) setText(an, msg);
  an.style.opacity = msg ? 1 : 0;
  const fl = $('#flash');
  if (battle.flash > 0) { fl.style.background = battle.flashColor || '#fff'; fl.style.opacity = Math.min(0.55, battle.flash); } else fl.style.opacity = 0;
  if (battle.state !== 'play' && !resultShown) showResult();
}
function setW(el, k) { const v = Math.max(0, Math.min(100, Math.round(k * 1000) / 10)) + '%'; if (el._w !== v) { el._w = v; el.style.width = v; } }
function setH(el, k) { const v = Math.max(0, Math.min(100, Math.round(k * 100))) + '%'; if (el._h !== v) { el._h = v; el.style.height = v; } }
function setText(el, s) { if (el._t !== s) { el._t = s; el.textContent = s; } }
function showResult() {
  resultShown = true;
  const win = battle.state === 'win', b = battle;
  setTimeout(() => {
    if (battle !== b) return;          // 그새 나갔거나 다시 시작했다
    $('#res-title').textContent = win ? '🏆 승리!' : '💀 패배';
    const t = Math.round(battle.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    $('#res-body').textContent = '처치 ' + battle.kills + ' · ' + mm + ':' + ss + (win && battle.stars ? ' · ' + '★'.repeat(battle.stars) : '');
    $('#result').hidden = false;
  }, 1400);
}
function syncButtons() {
  if (!battle) return;
  $('#b-speed').textContent = '▶▶ ' + battle.speed + 'x';
  $('#b-auto').classList.toggle('on', !!OPT.auto);
  $('#b-cam').classList.toggle('on', follow);
  $('#b-pause').textContent = paused ? '▶' : '⏸';
}
function autoDeploy(dt) {
  if (!OPT.auto || battle.state !== 'play') return;
  if ((autoT -= dt) > 0) return;
  autoT = 0.35;
  const ready = battle.roster.filter(u => battle.autoWants(u.id)).sort((a, b) => b.cost - a.cost);
  if (ready.length) battle.deploy(ready[0].id);
  for (const u of battle.roster) if (u.active && battle.autoActiveOk && battle.autoActiveOk(u.id)) battle.useHeroActive(u.id);
}

/* ---------- 카드 그림 (모델을 작은 캔버스에 찍어 둔다) ---------- */
const thumbs = new Map();
let thumbR = null, thumbScene = null, thumbCam = null;
const thumbQ = [];
function thumb(st) {
  const key = st.shape + '|' + st.body + '|' + st.tunic + '|' + st.accent;
  if (thumbs.has(key)) return Promise.resolve(thumbs.get(key));
  return new Promise(res => { thumbQ.push({ st, key, res }); if (thumbQ.length === 1) setTimeout(drainThumbs, 0); });
}
function drainThumbs() {
  try {
    if (!thumbR) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      thumbR = new T.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
      thumbScene = new T.Scene();
      thumbScene.add(new T.HemisphereLight(0xffffff, 0x445566, 2));
      const d = new T.DirectionalLight(0xffffff, 1.8); d.position.set(60, 120, 140); thumbScene.add(d);
      thumbCam = new T.PerspectiveCamera(30, 1, 1, 2000);
    }
    while (thumbQ.length) {
      const job = thumbQ.shift();
      if (thumbs.has(job.key)) { job.res(thumbs.get(job.key)); continue; }
      const m = M3.build(job.st, 'ally');
      M3.animate(m, { time: 0.3, phase: 0 });
      m.wrap.rotation.y = -0.5;
      thumbScene.add(m.wrap);
      const box = new T.Box3().setFromObject(m.wrap), size = box.getSize(new T.Vector3()), mid = box.getCenter(new T.Vector3());
      const r = Math.max(size.y, size.x * 0.8, 30) * 0.62;
      thumbCam.position.set(mid.x + r * 0.5, mid.y + r * 0.35, mid.z + r * 3.4);
      thumbCam.lookAt(mid.x, mid.y, mid.z);
      thumbR.render(thumbScene, thumbCam);
      const url = thumbR.domElement.toDataURL('image/png');
      thumbScene.remove(m.wrap); M3.dispose(m);
      thumbs.set(job.key, url); job.res(url);
    }
  } catch (e) {
    while (thumbQ.length) thumbQ.shift().res(null);
  }
}

/* ======================================================================
 * 모델 도감
 * ====================================================================== */
const gal = { scene: null, cam: null, model: null, list: [], idx: 0, anim: 'idle', spin: true, t: 0, tab: 'all', q: '', yaw: -0.4 };
function galEntries() {
  const out = [];
  UNITS.forEach(u => out.push({ st: u, side: 'ally', name: u.name, boss: false, tag: (u.rarity || '') + ' · ' + (u.role || '') }));
  Object.keys(ENEMIES).forEach(k => { const e = ENEMIES[k]; out.push({ st: Object.assign({ id: k }, e), side: 'enemy', name: e.name, boss: !!e.boss, tag: e.boss ? '보스' : '적' }); });
  return out;
}
let GAL_ALL = null;
function galSetup() {
  if (!GAL_ALL) GAL_ALL = galEntries();
  if (!gal.scene) {
    const s = gal.scene = new T.Scene();
    s.background = skyTexture('#2a3448', '#7a8aa0');
    s.add(new T.HemisphereLight(0xdfe8ff, 0x3a3428, 1.9));
    const d = new T.DirectionalLight(0xfff2dd, 2.2); d.position.set(-120, 260, 200); d.castShadow = OPT.hq; d.shadow.mapSize.set(1024, 1024);
    Object.assign(d.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 10, far: 800 });
    s.add(d);
    const floor = new T.Mesh(new T.CylinderGeometry(90, 96, 8, 48), new T.MeshToonMaterial({ color: new T.Color('#4a5266') }));
    floor.position.y = -4; floor.receiveShadow = OPT.hq; s.add(floor);
    const rim = new T.Mesh(new T.TorusGeometry(92, 1.4, 6, 64), fxMat('#f2c75c', 0.8, true)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.5; s.add(rim);
    gal.cam = new T.PerspectiveCamera(32, camera.aspect, 1, 4000);
  }
  galFilter();
}
function galFilter() {
  const q = gal.q.trim();
  gal.list = GAL_ALL.filter(g => (gal.tab === 'all' || (gal.tab === 'ally' && g.side === 'ally') || (gal.tab === 'enemy' && g.side === 'enemy' && !g.boss) || (gal.tab === 'boss' && g.boss)) &&
    (!q || g.name.includes(q) || (g.st.shape || '').includes(q)));
  $('#gal-count').textContent = gal.list.length + ' / ' + GAL_ALL.length + '종';
  const box = $('#gal-list'); box.innerHTML = '';
  gal.list.forEach((g, i) => {
    const b = document.createElement('button');
    b.className = 'row' + (g.boss ? ' boss' : '');
    b.innerHTML = '<span class="n"></span><span class="t"></span>';
    b.querySelector('.n').textContent = i + 1;
    b.querySelector('.t').textContent = g.name;
    b.addEventListener('click', () => galShow(i));
    box.appendChild(b);
  });
  galShow(Math.min(gal.idx, gal.list.length - 1));
}
function galShow(i) {
  if (!gal.list.length) return;
  gal.idx = (i + gal.list.length) % gal.list.length;
  const g = gal.list[gal.idx];
  if (gal.model) { gal.scene.remove(gal.model.wrap); M3.dispose(gal.model); }
  const m = gal.model = M3.build(g.st, g.side);
  m.wrap.traverse(o => { if (o.isMesh) o.castShadow = OPT.hq && !(o.material && o.material.transparent); });
  m.wrap.scale.setScalar(Math.min(1.6, g.st.scale || 1));
  gal.scene.add(m.wrap);
  gal.t = 0;
  M3.animate(m, { time: 0, phase: 0 });          // 나는 것들은 떠오른 자리로 잰다
  const box = new T.Box3().setFromObject(m.wrap), size = box.getSize(new T.Vector3());
  gal.fit = Math.max(size.y, size.x * 0.7, size.z * 0.7, 40);
  gal.cy = box.getCenter(new T.Vector3()).y;
  gal.rad = Math.hypot(size.x, size.z) / 2;      // 돌려도 가로로 이만큼은 차지한다
  $('#gal-name').textContent = g.name;
  const s = g.st;
  $('#gal-meta').textContent = [g.tag, '모양 ' + (s.shape || '-'), '틀 ' + m.kind, '공격 ' + m.style, '체력 ' + s.hp, '공격력 ' + s.atk, '사거리 ' + s.range].join(' · ');
  $$('#gal-list .row').forEach((r, k) => r.classList.toggle('sel', k === gal.idx));
  const sel = $$('#gal-list .row')[gal.idx];
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
}
function galFrame(dt) {
  const m = gal.model; if (!m) return;
  gal.t += dt;
  if (gal.spin) gal.yaw += dt * 0.6;
  m.wrap.rotation.y = gal.yaw;
  const cyc = gal.t % 1.6, a = gal.anim;
  const st = { time: gal.t, phase: a === 'walk' ? gal.t * 6 : 0, moving: a === 'walk' };
  if (a === 'attack') { if (cyc < 0.6) st.wind = cyc / 0.6; else if (cyc < 0.9) st.atk = (cyc - 0.6) / 0.3; }
  if (a === 'hit') { st.flash = cyc < 0.15 ? 0.15 - cyc : 0; st.kb = cyc < 0.5 ? 1 - cyc / 0.5 : 0; st.stun = cyc > 0.5; }
  if (a === 'die') { st.dead = Math.min(1, cyc / 0.6); st.fade = cyc > 1.1 ? Math.max(0, 1 - (cyc - 1.1) / 0.4) : 1; }
  M3.animate(m, st);
  const f = gal.fit, portrait = gal.cam.aspect < 1;
  // 세로: 아래 목록 · 설명을 비켜 화면 위쪽에 (좁은 가로폭에 넓은 모델도 들어가게 더 물러선다)
  const d = portrait ? Math.max(f * 4.8, gal.rad * 1.1 / (Math.tan(16 * Math.PI / 180) * gal.cam.aspect)) : f * 2.5;
  const cx = portrait ? 0 : -f * 0.35;          // 왼쪽 목록을 비켜 오른쪽에 세운다
  const cy = portrait ? gal.cy - d * 0.13 : gal.cy;
  gal.cam.position.set(cx, cy + f * 0.25, d);
  gal.cam.lookAt(cx, cy, 0);
}

/* ======================================================================
 * 메뉴 배경: 병종 · 적이 행진한다
 * ====================================================================== */
const menu = { scene: null, cam: null, units: [], t: 0 };
function menuSetup() {
  if (menu.scene) return;
  const s = menu.scene = new T.Scene();
  s.background = skyTexture('#6fa6d6', '#f2e3c4');
  s.fog = new T.Fog(new T.Color('#f2e3c4'), 400, 1500);
  s.add(new T.HemisphereLight(0xffffff, 0x556644, 1.9));
  const d = new T.DirectionalLight(0xfff0d8, 2.2); d.position.set(-200, 400, 300); d.castShadow = OPT.hq; d.shadow.mapSize.set(1024, 1024);
  Object.assign(d.shadow.camera, { left: -500, right: 500, top: 300, bottom: -300, near: 10, far: 1500 });
  s.add(d);
  const g = new T.Mesh(new T.PlaneGeometry(4000, 3000).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ color: new T.Color('#7f9a4f') })); g.receiveShadow = OPT.hq; s.add(g);
  const road = new T.Mesh(new T.PlaneGeometry(4000, 110).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ color: new T.Color('#5a7236') })); road.position.y = 0.3; road.receiveShadow = OPT.hq; s.add(road);
  const rnd = seeded(7);
  for (let i = 0; i < 14; i++) { const h = 220 + rnd() * 300; const c = new T.Mesh(new T.ConeGeometry(h, h, 9), new T.MeshLambertMaterial({ color: new T.Color('#86a7b6') })); c.position.set((i - 7) * 320, h / 2, -1100 - rnd() * 300); s.add(c); }
  s.add(propMesh('tree', { prop: '#4d6a34' }, 50, rnd, 1600, true));
  menu.cam = new T.PerspectiveCamera(34, camera.aspect, 5, 5000);
  const picks = [], allies = UNITS.filter(u => u.rarity === 'SSR' || u.rarity === 'UR'), foes = Object.keys(ENEMIES).filter(k => ENEMIES[k].boss);
  for (let i = 0; i < 8; i++) picks.push({ st: allies[Math.floor(rnd() * allies.length)], side: 'ally', dir: 1 });
  for (let i = 0; i < 6; i++) { const k = foes[Math.floor(rnd() * foes.length)]; picks.push({ st: Object.assign({ id: k }, ENEMIES[k]), side: 'enemy', dir: -1 }); }
  picks.forEach((p, i) => {
    const m = M3.build(p.st, p.side);
    m.wrap.traverse(o => { if (o.isMesh) o.castShadow = OPT.hq && !(o.material && o.material.transparent); });
    m.dir = p.dir; m.x = p.dir > 0 ? -700 + i * 90 : 700 - (i - 8) * 140; m.z = ((i % 3) - 1) * ROW_GAP; m.ph = rnd() * 6;
    m.speed = 30 + rnd() * 20;
    m.wrap.rotation.y = p.dir > 0 ? 0 : Math.PI;
    m.wrap.scale.setScalar(Math.min(1.4, p.st.scale || 1));
    s.add(m.wrap); menu.units.push(m);
  });
}
function menuFrame(dt) {
  menu.t += dt;
  for (const m of menu.units) {
    m.x += m.dir * m.speed * dt; m.ph += dt * 5;
    if (m.x > 800) m.x = -800; if (m.x < -800) m.x = 800;
    m.wrap.position.set(m.x, 0, m.z);
    M3.animate(m, { time: menu.t, phase: m.ph, moving: true });
  }
  const c = menu.cam;
  c.position.set(Math.sin(menu.t * 0.05) * 160, 170, 760);
  c.lookAt(80, 40, 0);
}

/* ======================================================================
 * 화면 전환 · 목록
 * ====================================================================== */
let mode = 'menu';
function show(id) {
  $$('.scr').forEach(s => s.classList.toggle('active', s.id === id));
  mode = id;
  if (id === 'menu') { menuSetup(); refreshMenu(); }
  if (id === 'gallery') galSetup();
  if (id === 'deck') renderDeck();
  if (id !== 'battle' && battle) clearBattle();
}
function refreshMenu() {
  $('#opt-all').checked = OPT.all; $('#opt-hq').checked = OPT.hq;
  $('#save-note').textContent = SAVE._found
    ? '본편 ' + SaveStore.slot + '번 슬롯: ' + SAVE.cleared + '전장 돌파 · 편성 ' + deckNow().length + '명 (읽기만 한다)'
    : '본편 저장이 없어 처음 상태로 연다. "모든 병종 체험"을 켜면 다 써 볼 수 있다.';
}
const CHAPTERS = ['1막 국경 전선', '2막 왕도 수호', '3막 신화의 끝', '4막 심연의 바다', '5막 천공 요새', '6막 잊힌 밀림', '7막 홀린 요정 숲', '8막 모래폭풍 사막', '9막 불의 산맥'];
let stageKind = 'campaign';
function renderStages(kind) {
  stageKind = kind;
  $('#stages-title').textContent = kind === 'event' ? '도전' : '전장';
  $('#hard-wrap').style.display = kind === 'event' ? 'none' : '';
  const box = $('#stage-list'); box.innerHTML = '';
  if (kind === 'event') {
    EVENT_STAGES.forEach((st, k) => {
      const open = OPT.all || eventOpen(SAVE, k);
      box.appendChild(stageRow('E' + (k + 1), st.name, open ? (st.event && st.event.mech || '') : '🔒 ' + (st.event ? st.event.unlock : '?') + '전장 돌파 뒤', open, true, () => startBattle({ kind: 'event', index: k })));
    });
    return;
  }
  STAGES.forEach((st, i) => {
    if (i % 10 === 0) { const h = document.createElement('div'); h.className = 'act'; h.textContent = CHAPTERS[i / 10] || (Math.floor(i / 10) + 1) + '막'; box.appendChild(h); }
    const open = OPT.all || i <= SAVE.cleared;
    box.appendChild(stageRow(i + 1, st.name, open ? (st.look || 'meadow') : '🔒', open, !!st.bossId, () => {
      const hard = OPT.hard && (OPT.all || i < SAVE.cleared);
      if (OPT.hard && !hard) toast('하드코어는 돌파한 전장에서만');
      startBattle({ kind: 'campaign', index: i, hard });
    }));
  });
}
function stageRow(n, name, tag, open, boss, go) {
  const b = document.createElement('button');
  b.className = 'row' + (boss ? ' boss' : '');
  b.disabled = !open; if (!open) b.style.opacity = 0.45;
  b.innerHTML = '<span class="n"></span><span class="t"></span><span class="tag"></span>';
  b.querySelector('.n').textContent = n; b.querySelector('.t').textContent = name; b.querySelector('.tag').textContent = tag;
  b.addEventListener('click', () => { unlockAudio(); go(); });
  return b;
}
function renderDeck() {
  const d = deckNow(), pick = $('#deck-pick'), list = $('#deck-list');
  $('#deck-count').textContent = d.length + ' / ' + LOADOUT_MAX;
  pick.innerHTML = ''; list.innerHTML = '';
  const chip = (u, inDeck) => {
    const b = document.createElement('button');
    b.className = 'chip' + (inDeck ? ' in' : '');
    b.innerHTML = '<span class="r r-' + (u.rarity || 'N') + '">' + (u.rarity || 'N') + '</span>';
    b.appendChild(document.createTextNode(u.name + ' ' + u.cost));
    b.addEventListener('click', () => {
      let cur = deckNow();
      if (cur.includes(u.id)) cur = cur.filter(x => x !== u.id);
      else {
        if (cur.length >= LOADOUT_MAX) { toast('편성은 ' + LOADOUT_MAX + '명까지'); return; }
        if (isHeroUnit(u) && heroCount(cur) >= HERO_SLOT_MAX) { toast('전설 · 신화는 ' + HERO_SLOT_MAX + '명까지'); return; }
        cur.push(u.id);
      }
      DECK = cur; LS.set('deck', DECK); renderDeck();
    });
    return b;
  };
  d.forEach(id => pick.appendChild(chip(UNIT_BY_ID[id], true)));
  const rank = { UR: 0, SSR: 1, SR: 2, R: 3, N: 4 };
  availableUnits().filter(u => !d.includes(u.id)).sort((a, b) => (rank[a.rarity] - rank[b.rarity]) || (a.cost - b.cost)).forEach(u => list.appendChild(chip(u, false)));
}

let toastT = 0;
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600); }
let audioOn = false;
function unlockAudio() {
  if (audioOn) return; audioOn = true;
  try { SFX.init(); if (SFX.resume) SFX.resume(); } catch (e) { /* 소리 없이 */ }
}

/* ---------- 입력 ---------- */
document.addEventListener('click', ev => {
  const go = ev.target.closest('[data-go]');
  if (!go) return;
  unlockAudio();
  const to = go.dataset.go;
  if (to === 'stages' || to === 'events') { renderStages(to === 'events' ? 'event' : 'campaign'); show('stages'); }
  else show(to);
});
$('#opt-all').addEventListener('change', e => { OPT.all = e.target.checked; LS.set('all', OPT.all); refreshMenu(); });
$('#opt-hq').addEventListener('change', e => { OPT.hq = e.target.checked; LS.set('hq', OPT.hq); toast('다시 열면 적용된다'); setTimeout(() => location.reload(), 600); });
$('#opt-hard').addEventListener('change', e => { OPT.hard = e.target.checked; });
$('#deck-clear').addEventListener('click', () => { DECK = []; LS.set('deck', DECK); renderDeck(); });
$('#b-speed').addEventListener('click', () => { if (!battle) return; battle.speed = battle.speed >= 3 ? 1 : battle.speed + 1; LS.set('speed', battle.speed); syncButtons(); });
$('#b-pause').addEventListener('click', () => { paused = !paused; $('#pause-cover').hidden = !paused; syncButtons(); });
$('#pause-cover').addEventListener('click', () => { paused = false; $('#pause-cover').hidden = true; syncButtons(); });
OPT.auto = LS.get('auto', false);
$('#b-auto').addEventListener('click', () => { OPT.auto = !OPT.auto; LS.set('auto', OPT.auto); syncButtons(); });
$('#b-cam').addEventListener('click', () => { follow = !follow; syncButtons(); });
$('#b-exit').addEventListener('click', () => { renderStages(stageKind); show('stages'); });
$('#b-cmd').addEventListener('click', () => { if (battle && !paused && battle.useCommand()) toast('👑 왕의 명령!'); });
$('#res-again').addEventListener('click', () => startBattle(cfg));
$('#res-back').addEventListener('click', () => { renderStages(stageKind); show('stages'); });
$$('[data-gtab]').forEach(b => b.addEventListener('click', () => { gal.tab = b.dataset.gtab; $$('[data-gtab]').forEach(x => x.classList.toggle('on', x === b)); gal.idx = 0; galFilter(); }));
$$('[data-anim]').forEach(b => b.addEventListener('click', () => { gal.anim = b.dataset.anim; gal.t = 0; $$('[data-anim]').forEach(x => x.classList.toggle('on', x === b)); }));
$('#gal-prev').addEventListener('click', () => galShow(gal.idx - 1));
$('#gal-next').addEventListener('click', () => galShow(gal.idx + 1));
$('#gal-spin').addEventListener('click', () => { gal.spin = !gal.spin; $('#gal-spin').classList.toggle('on', gal.spin); });
$('#gal-spin').classList.toggle('on', gal.spin);
$('#gal-search').addEventListener('input', e => { gal.q = e.target.value; gal.idx = 0; galFilter(); });
document.addEventListener('keydown', e => {
  if (mode === 'gallery' && e.target.tagName !== 'INPUT') { if (e.key === 'ArrowDown' || e.key === 'ArrowRight') galShow(gal.idx + 1); if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') galShow(gal.idx - 1); }
  if (mode === 'battle' && battle) {
    if (e.key === ' ') { paused = !paused; $('#pause-cover').hidden = !paused; syncButtons(); e.preventDefault(); }
    const n = '1234567890'.indexOf(e.key);
    if (n >= 0 && battle.roster[n]) battle.deploy(battle.roster[n].id);
  }
});

/* 끌어서 전장 훑기 · 휠/두 손가락으로 당기기 (도감은 끌어서 돌리기) */
const ptr = new Map();
let pinch0 = 0, dist0 = 0;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); unlockAudio(); if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = camDist; } });
canvas.addEventListener('pointermove', e => {
  const p = ptr.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptr.size === 2) { const [a, b] = [...ptr.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) camDist = Math.max(260, Math.min(1300, dist0 * pinch0 / d)); return; }
  if (mode === 'battle') {
    if (Math.abs(dx) > 1) follow = false, syncButtons();
    camX -= dx * camDist / window.innerHeight * 1.1;
    camTilt = Math.max(0.12, Math.min(0.95, camTilt + dy * 0.003));
  } else if (mode === 'gallery') { gal.yaw += dx * 0.012; gal.spin = false; $('#gal-spin').classList.remove('on'); }
});
const up = e => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch0 = 0; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { if (mode === 'battle') { camDist = Math.max(260, Math.min(1300, camDist * (e.deltaY > 0 ? 1.1 : 0.9))); e.preventDefault(); } }, { passive: false });

/* ---------- 고리 ---------- */
let lastTs = 0, fpsT = 0, fpsN = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (document.hidden) { lastTs = 0; return; }
  let dt = lastTs ? (ts - lastTs) / 1000 : 0.016;
  lastTs = ts;
  if (dt > 0.1) dt = 0.1;
  fpsT += dt; fpsN++;
  if (fpsT > 1) { window.__fps3d = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; }
  if (mode === 'battle' && battle) {
    const run = !paused;
    if (run) { autoDeploy(dt * battle.speed); battle.update(dt); }
    const adt = run ? dt * battle.speed : 0;
    lastAdt = adt;
    clock += adt;
    if (battle.shake > 0) battle.shake = Math.max(0, battle.shake - dt * 24);
    syncFighters(dt, adt);
    syncBurrowers();
    syncShots();
    syncFx();
    syncCastles(adt);
    placeCamera(dt);
    hud();
    R.render(scene, camera);
  } else if (mode === 'gallery' && gal.scene) {
    galFrame(dt);
    R.render(gal.scene, gal.cam);
  } else if (menu.scene) {
    menuFrame(dt);
    menu.cam.aspect = camera.aspect; menu.cam.updateProjectionMatrix();
    R.render(menu.scene, menu.cam);
  }
}

/* 안드로이드 뒤로 가기 · Esc: 전투 → 전장 목록 → 메뉴 → 본편 */
window.__androidBack = function () {
  if (mode === 'battle') { renderStages(stageKind); show('stages'); return true; }
  if (mode !== 'menu') { show('menu'); return true; }
  location.href = '../index.html';
  return true;
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') { window.__androidBack(); e.preventDefault(); } });

/* 시작 */
resize();
show('menu');
$('#boot').remove();
requestAnimationFrame(frame);
window.__g3d = { R, start: startBattle, get battle() { return battle; }, show, gal, M3, live, galShow, OPT };
})();
