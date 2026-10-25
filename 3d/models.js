/* =======================================================================
 * 막대 왕국 전쟁 3D 시험판 — 모델 만들기
 * 병종 · 적 · 보스 290여 종을 손으로 하나씩 깎지 않고, 게임 데이터(모양 · 역할 · 공격 방식 ·
 * 몸/옷/장식 색 · 크기 · 보스)로 원형(사람 · 탈것 · 짐승 · 벌레 · 뱀 · 용 · 날짐승 · 유령 ·
 * 덩어리 · 공성 기계 · 탈것 기계 · 구조물)을 골라 같은 부품으로 조립한다.
 * 모델은 +x 쪽을 본다. 키는 1 배율에서 60 안팎(2D 전장 단위와 같다).
 * ======================================================================= */
(function () {
'use strict';
const T = THREE;

/* ---------- 재질 · 도형 캐시 ---------- */
const GEO = new Map();
function geo(key, make) { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; }
const box = (w, h, d) => geo('b' + w + ',' + h + ',' + d, () => new T.BoxGeometry(w, h, d));
const sph = (r, ws = 10, hs = 8) => geo('s' + r + ',' + ws, () => new T.SphereGeometry(r, ws, hs));
const cyl = (rt, rb, h, seg = 10) => geo('c' + rt + ',' + rb + ',' + h + ',' + seg, () => new T.CylinderGeometry(rt, rb, h, seg));
const cone = (r, h, seg = 10) => geo('k' + r + ',' + h + ',' + seg, () => new T.ConeGeometry(r, h, seg));
const cap = (r, len) => geo('p' + r + ',' + len, () => new T.CapsuleGeometry(r, len, 4, 8));
const tor = (r, t) => geo('t' + r + ',' + t, () => new T.TorusGeometry(r, t, 6, 16));
const arc = (r, t) => geo('a' + r + ',' + t, () => new T.TorusGeometry(r, t, 5, 12, Math.PI));

let GRAD = null;     // 만화풍 3단 음영
function gradTex() {
  if (GRAD) return GRAD;
  const d = new Uint8Array([90, 170, 255]);
  GRAD = new T.DataTexture(d, 3, 1, T.RedFormat);
  GRAD.minFilter = GRAD.magFilter = T.NearestFilter; GRAD.needsUpdate = true;
  return GRAD;
}
/* 병사마다 재질을 따로 둔다 (맞을 때 하얗게 · 흐려질 때 투명하게 하려고) */
function mat(color, opt) {
  const m = new T.MeshToonMaterial(Object.assign({ color: new T.Color(color || '#888888'), gradientMap: gradTex() }, opt || {}));
  m.userData.base = m.color.clone();
  return m;
}
function glow(color, opa) {
  const m = new T.MeshBasicMaterial({ color: new T.Color(color || '#ffffff'), transparent: true, opacity: opa == null ? 0.85 : opa, depthWrite: false });
  m.userData.base = m.color.clone();
  return m;
}
function mesh(g, m, x = 0, y = 0, z = 0) { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; }
function pivot(x = 0, y = 0, z = 0) { const g = new T.Group(); g.position.set(x, y, z); return g; }
const lighten = (hex, k) => { const c = new T.Color(hex); return c.lerp(new T.Color(k > 0 ? '#ffffff' : '#000000'), Math.abs(k)); };

/* ---------- 원형 고르기 ---------- */
const RX = {
  vehicle: /^(irontrain|tank|hovertank|ufo|bulldozer|ambulance|thunderbike|icecart|solarsat|jetvalk|handcar|chariot|biga|megabot|mechwukong)$/,
  machine: /^(catapult|orccatapult|siegebow|scorpio|hwacha|siegeram|goldcart|skycannon|magmacannon|turret|airship|steammech|merchant|gatling)$/,
  object: /^(totem|wardtotem|hourglass|jangseung|barricade|mirror|beacon)$/,
  tree: /^(treant|eldertree)$/,
  mush: /^(mushking|sporecap)$/,
  serpent: /^(sandworm|eel|leviathan|lavawyrm|quetzal)$/,
  dragon: /^(drake|stormgriffin)$/,
  flyer: /^(bat|cinderbat|harpy|pixie|phoenix)$/,
  ghost: /^(wraith|wisp|stormwisp|voidspawn|souleater|voidlord)$/,
  blob: /^(ooze|oozelet|magmaling|rockling|jelly|kraken)$/,
  insect: /^(spider|spiderqueen|spiderdemon|scorpion|scorpking|scarab|scarab_e|scarablet|clawcrab)$/,
  quad: /^(wolf|hellhound|fenrir|haetae|raptor|raptorqueen|triceratops|jungletyrant|sphinx|poisontoad|salamander)$/,
  mounted: /^(lancer|camelarcher|unicorn|griffinrider|dunerider|centaur|carpet|dragonknight|dragonspear|sleipnir|skyfox|valkyrie_x)$/,
  giant: /^(ogre|troll|frostgiant|golem|obsidian|colossus|gearcolossus|stoneidol|titan|cloudgiant|warlord|surtr|magmalord|jackalgod|sandpharaoh|warchief)$/,
  naga: /^(medusa|gorgon|nagaspear|siren|tidequeen|tidecaller)$/,
  smoky: /^(genie|djinnking)$/
};
function archetype(st) {
  const s = st.shape || '';
  for (const k of ['vehicle', 'machine', 'object', 'tree', 'mush', 'serpent', 'dragon', 'flyer', 'ghost', 'blob', 'insect', 'quad', 'mounted']) if (RX[k].test(s)) return k;
  if (typeof X3_VEHICLE !== 'undefined' && X3_VEHICLE[s]) return 'mounted';
  if (/dragon/.test(s)) return 'mounted';
  return 'humanoid';
}
function styleOf(st) {
  try { if (typeof attackStyle === 'function') return attackStyle(st); } catch (e) { /* 2D 표가 없으면 */ }
  return st.ranged ? 'shoot' : 'slash';
}

/* ---------- 부품 ---------- */
/* 머리 장식: 모양 · 이름에서 고른다 */
function headgear(st) {
  const s = st.shape || '', n = st.name || '';
  if (/king|queen|pharaoh|lord|emperor|arthur|zeus|ra$|hades|monarch|sunking|moonqueen|masklord|tyrant/.test(s) || /왕|여왕|파라오|군주|황제/.test(n)) return 'crown';
  if (/viking|valkyrie|thor|odin|berserk|jotunn|skadi|freya|runeguard|frostgiant/.test(s)) return 'horns';
  if (/mage|merlin|wizard|frost|pyro|necro|stormcaller|witch|morgana|hexer|sandmage|ashcaster|chrono|riftcaller|windcaller|tidecaller/.test(s) || /마도사|마법사|술사|마녀/.test(n)) return 'wizard';
  if (/priest|nun|miko|vestal|bari|mudang|sanzang|monk|sohei|rapriest|plaguer|shaman|runeseer|saja/.test(s) || /사제|무녀|무당|승|주술사/.test(n)) return 'hood';
  if (/archer|ranger|venom|ninja|assassin|duelist|tristan|kyudo|thief|rogue|dancer|dervish|jester/.test(s) || /궁수|자객|도적|닌자/.test(n)) return 'hood2';
  if (/samurai|ashigaru|tengu|susanoo/.test(s)) return 'kasa';
  if (/anubis|jackal/.test(s)) return 'jackal';
  if (/orc|goblin|troll|ogre|warchief|warlord|slinger/.test(s)) return 'tusks';
  if (/skel|mummy|ghost|lich/.test(s)) return 'skull';
  if (/knight|paladin|guard|legion|centurion|spartan|hoplite|shield|lancer|galahad|lancelot|halberd|spear|pike|pharaoh|aquilifer|gladiator|retiarius|pilum|percival|gawain/.test(s) || /기사|병|전사|근위/.test(n)) return 'helmet';
  return 'none';
}
function weaponKind(st, style) {
  const s = st.shape || '', n = st.name || '';
  if (style === 'cast') return /herald|bell|horn/.test(s) ? 'horn' : 'staff';
  if (style === 'shoot') {
    if (/catapult|cannon/.test(s)) return 'none';
    if (/musket|rifle|gun|sniper|pistol|arquebus|총/.test(s + n)) return 'gun';
    if (/sling|jester|bomber|throw|axethrower|javelin|velites|pilum/.test(s)) return 'throw';
    return 'bow';
  }
  if (style === 'thrust') return /guanyu|lubu|halberd|glaive|naginata|tomoe/.test(s) ? 'glaive' : 'spear';
  if (/wukong|sohei|monk|staffman/.test(s)) return 'pole';
  if (/golem|colossus|titan|stoneidol|obsidian/.test(s)) return 'none';
  if (style === 'heavy') {
    if (/guanyu|lubu|halberd|glaive|naginata|tomoe|reaper|scythe/.test(s)) return 'glaive';
    if (/axe|viking|berserk|도끼/.test(s + n)) return 'axe';
    if (/thor|hammer|mace|maceman|golem|ogre|troll/.test(s)) return 'hammer';
    if (/knight|paladin|guard|lancelot|arthur|galahad|gawain|percival|samurai|warrior|gladiator|legion|centurion|hero|king|lord|칼|검|기사/.test(s + n)) return 'sword';
    return 'club';
  }
  return /claw|wolf|hound|cat|bastet/.test(s) ? 'none' : 'sword';
}
function hasShield(st) {
  return /shield|knight|paladin|hoplite|spartan|legion|galahad|camelotguard|tengjia|orcshield|centurion|athena|guard|aquilifer/.test(st.shape || '') || /방패/.test(st.name || '');
}

function buildWeapon(kind, st, M) {
  const g = new T.Group(), acc = st.accent || '#c8ccd4';
  const metal = M.get(acc), wood = M.get('#6b4a2a');
  if (kind === 'sword') { g.add(mesh(box(2.2, 26, 1), metal, 0, 15, 0)); g.add(mesh(box(8, 2, 2.5), M.get('#c9a24a'), 0, 2.5, 0)); }
  else if (kind === 'spear') { g.add(mesh(cyl(0.9, 0.9, 52, 6), wood, 0, 14, 0)); g.add(mesh(cone(2.6, 9, 6), metal, 0, 44, 0)); }
  else if (kind === 'glaive') { g.add(mesh(cyl(1, 1, 56, 6), wood, 0, 14, 0)); const b = mesh(box(3, 16, 1.4), metal, 2, 46, 0); b.rotation.z = -0.25; g.add(b); g.add(mesh(box(5, 3, 3), M.get('#c9a24a'), 0, 38, 0)); }
  else if (kind === 'pole') { g.add(mesh(cyl(1.2, 1.2, 60, 6), M.get('#a8322a'), 0, 8, 0)); for (const y of [-21, 37]) g.add(mesh(cyl(1.8, 1.8, 5, 8), M.get('#e8c25a'), 0, y, 0)); }
  else if (kind === 'axe') { g.add(mesh(cyl(1, 1, 30, 6), wood, 0, 12, 0)); g.add(mesh(box(10, 9, 1.6), metal, 4.5, 24, 0)); }
  else if (kind === 'hammer') { g.add(mesh(cyl(1.1, 1.1, 28, 6), wood, 0, 11, 0)); g.add(mesh(box(9, 9, 9), metal, 0, 25, 0)); }
  else if (kind === 'club') { g.add(mesh(cyl(3.2, 1.2, 26, 7), wood, 0, 12, 0)); }
  else if (kind === 'bow') { const b = mesh(arc(14, 1), wood, 0, 0, 0); b.scale.set(1, 0.5, 1); g.add(b); g.add(mesh(box(28, 0.4, 0.4), M.get('#e8e0d0'), 0, 0, 0)); }
  else if (kind === 'gun') { g.add(mesh(box(3, 3, 3), wood, 0, 0, 0)); const barrel = mesh(cyl(1, 1, 24, 6), M.get('#3a3f48'), 0, 12, 0); g.add(barrel); }
  else if (kind === 'throw') { g.add(mesh(sph(2.8, 6, 5), M.get(acc), 0, 6, 0)); }
  else if (kind === 'staff') { g.add(mesh(cyl(1, 1.2, 40, 6), wood, 0, 12, 0)); const orb = mesh(sph(4, 10, 8), glow(acc, 0.95), 0, 34, 0); orb.castShadow = false; g.add(orb); g.userData.orb = orb; }
  else if (kind === 'horn') { g.add(mesh(cone(4, 14, 8), M.get('#d8b24a'), 0, 8, 0)); }
  g.userData.kind = kind;
  return g;
}

/* 재질 묶음 — 병사 하나가 쓰는 재질을 모아 둔다 (맞음 번쩍 · 투명) */
function Mats() {
  const map = new Map(), list = [];
  return {
    list,
    get(c) { let m = map.get(c); if (!m) { m = mat(c); map.set(c, m); list.push(m); } return m; },
    add(m) { list.push(m); return m; }
  };
}

/* ---------- 원형별 조립 ---------- */
function humanoid(st, M, opt = {}) {
  const root = new T.Group(), rig = {};
  const style = styleOf(st), skin = st.body || '#2b3038', tun = st.tunic || '#5a6a7a', acc = st.accent || '#c8ccd4';
  const big = opt.big ? 1.55 : 1, lw = (opt.big ? 4.6 : 2.6);
  const lower = opt.lower || (/cast/.test(style) && /priest|mage|merlin|necro|hades|sanzang|miko|vestal|saja|bari|mudang|persephone|freya|morgana|zhugeliang|diaochan|rapriest|lich|shaman|plaguer|sandmage|hexer|ashcaster|chrono|witch|faequeen/.test(st.shape) ? 'robe' : 'legs');
  const hip = 24 * big;
  // 다리 / 치마 / 꼬리 / 연기
  if (lower === 'legs') {
    for (const side of [-1, 1]) {
      const p = pivot(0, hip, side * 3.6 * big);
      p.add(mesh(cap(lw, 18 * big), M.get(skin), 0, -11 * big, 0));
      p.add(mesh(box(7 * big, 3 * big, 5 * big), M.get(lighten(skin, -0.25).getStyle()), 1.6 * big, -22.5 * big, 0));
      root.add(p); rig[side < 0 ? 'legB' : 'legF'] = p;
    }
  } else if (lower === 'robe') {
    const r = mesh(cone(11 * big, 30 * big, 12), M.get(tun), 0, 15 * big, 0); root.add(r); rig.robe = r;
  } else if (lower === 'tail') {
    const tail = new T.Group(); tail.position.set(0, 6, 0);
    for (let i = 0; i < 6; i++) { const seg = mesh(sph((6.5 - i * 0.8) * big, 8, 6), M.get(acc), -i * 6 * big, (i === 0 ? 10 : 2) * big, 0); tail.add(seg); }
    root.add(tail); rig.tail = tail;
  } else if (lower === 'smoke') {
    const sm = mesh(cone(9 * big, 26 * big, 10), glow(acc, 0.55), 0, 14 * big, 0); sm.rotation.z = Math.PI; root.add(sm); rig.smoke = sm;
  }
  // 몸통
  const armored = /heavy/.test(style) || hasShield(st) || opt.big;
  const torso = new T.Group(); torso.position.y = hip; root.add(torso); rig.torso = torso;
  torso.add(mesh(cyl((armored ? 8.5 : 6.5) * big, (armored ? 7 : 5.5) * big, 22 * big, 10), M.get(tun), 0, 11 * big, 0));
  torso.add(mesh(box(2, 4 * big, (armored ? 15 : 11) * big), M.get(lighten(tun, -0.35).getStyle()), 0, 1 * big, 0));      // 허리띠
  // 머리
  const head = pivot(0, 30 * big, 0); torso.add(head); rig.head = head;
  head.add(mesh(sph(7 * big, 12, 10), M.get(skin), 0, 0, 0));
  const eyeM = M.get('#f4f1ea');
  for (const z of [-2.6, 2.6]) { const e = mesh(sph(1.3 * big, 6, 5), eyeM, 6 * big, 1 * big, z * big); e.castShadow = false; head.add(e); }
  const hg = opt.headgear || headgear(st);
  if (hg === 'helmet') { head.add(mesh(sph(7.8 * big, 12, 8, ), M.get(acc), 0, 1.5 * big, 0)); head.children[head.children.length - 1].scale.set(1, 0.75, 1); head.add(mesh(box(2, 3 * big, 15 * big), M.get(lighten(acc, -0.3).getStyle()), 6.5 * big, 0, 0)); }
  else if (hg === 'crown') { const c = mesh(cyl(6.5 * big, 6.5 * big, 4 * big, 8), M.get('#e8c25a'), 0, 7.5 * big, 0); head.add(c); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; head.add(mesh(cone(1.4 * big, 4 * big, 4), M.get('#e8c25a'), Math.cos(a) * 6 * big, 11 * big, Math.sin(a) * 6 * big)); } }
  else if (hg === 'horns') { head.add(mesh(sph(7.6 * big, 12, 8), M.get(acc), 0, 2 * big, 0)); for (const z of [-1, 1]) { const h = mesh(cone(1.8 * big, 9 * big, 6), M.get('#efe6cf'), 0, 7 * big, z * 7 * big); h.rotation.x = -z * 0.9; head.add(h); } }
  else if (hg === 'wizard') { head.add(mesh(cyl(11 * big, 11 * big, 1.2, 14), M.get(tun), 0, 5 * big, 0)); const h = mesh(cone(6.5 * big, 20 * big, 12), M.get(tun), -2 * big, 15 * big, 0); h.rotation.z = 0.25; head.add(h); }
  else if (hg === 'hood' || hg === 'hood2') { const h = mesh(sph(8.2 * big, 12, 8), M.get(hg === 'hood' ? tun : lighten(tun, -0.2).getStyle()), -1 * big, 1.5 * big, 0); h.scale.set(1, 1.08, 1); head.add(h); head.children[1].position.x += 0.6; }
  else if (hg === 'kasa') { head.add(mesh(cone(13 * big, 6 * big, 14), M.get('#c8a46a'), 0, 7 * big, 0)); }
  else if (hg === 'jackal') { const s = mesh(box(9 * big, 5 * big, 6 * big), M.get(skin), 7 * big, -1 * big, 0); head.add(s); for (const z of [-1, 1]) head.add(mesh(cone(2.2 * big, 10 * big, 4), M.get(skin), -1 * big, 10 * big, z * 3.5 * big)); }
  else if (hg === 'tusks') { for (const z of [-1, 1]) { const t = mesh(cone(1 * big, 4 * big, 4), M.get('#f0e8d0'), 6 * big, -3 * big, z * 3 * big); head.add(t); } }
  else if (hg === 'skull') { head.children[0].material = M.get('#e8e2cf'); }
  // 팔: 뒤팔(방패) · 앞팔(무기)
  const sh = 22 * big;
  const armB = pivot(0, sh, -8.5 * big), armF = pivot(0, sh, 8.5 * big);
  for (const a of [armB, armF]) a.add(mesh(cap(lw * 0.85, 15 * big), M.get(skin), 0, -9 * big, 0));
  torso.add(armB); torso.add(armF); rig.armB = armB; rig.armF = armF;
  const hand = pivot(0, -18 * big, 0); armF.add(hand); rig.hand = hand;
  const wk = opt.weapon || weaponKind(st, style);
  if (wk !== 'none') { const w = buildWeapon(wk, st, M); w.scale.setScalar(big); hand.add(w); rig.weapon = w; if (w.userData.orb) rig.orb = w.userData.orb; }
  if (hasShield(st)) { const s = mesh(cyl(9 * big, 9 * big, 2, 12), M.get(acc), 3 * big, -14 * big, -1.5 * big); s.rotation.z = Math.PI / 2 - 0.9; armB.add(s); s.add(mesh(cyl(2.4 * big, 2.4 * big, 2.6, 8), M.get('#e8c25a'), 0, 0, 0)); rig.shield = s; }
  // 망토: 등급 높은 병종 · 보스 · 진화
  if (opt.cape || st.rarity === 'UR' || st.rarity === 'SSR' || st.rarity === 'SR' || st.boss || st.evo) {
    const c = mesh(box(1.2, 30 * big, 14 * big), M.get(st.boss ? '#7a1f2a' : (st.evo ? '#c9a24a' : acc)), -7.5 * big, 6 * big, 0); c.castShadow = true; torso.add(c); rig.cape = c;
  }
  // 날개 (발키리 · 하피 · 천사)
  if (opt.wings || /valkyrie|angel|seraph|harpy|nike/.test(st.shape)) addWings(torso, M, opt.wingColor || '#f4f1ea', 26 * big, rig, -4 * big, 16 * big);
  return { root, rig, h: (hg === 'wizard' ? 76 : 66) * big, style };
}

function addWings(parent, M, color, span, rig, x, y) {
  // 날개: 몸에 붙은 쪽이 넓고 끝으로 갈수록 가늘어지는 납작한 삼각 깃 두 겹
  for (const side of [-1, 1]) {
    const p = pivot(x, y, side * 4);
    const w = mesh(cone(span * 0.32, span, 3), M.get(color), -span * 0.12, 0, side * span * 0.5);
    w.rotation.x = side * Math.PI / 2; w.scale.set(1, 1, 0.12);
    const w2 = mesh(cone(span * 0.22, span * 0.7, 3), M.get(lighten(color, 0.18).getStyle()), -span * 0.22, -0.8, side * span * 0.36);
    w2.rotation.x = side * Math.PI / 2; w2.scale.set(1, 1, 0.1);
    p.add(w); p.add(w2); parent.add(p); rig[side < 0 ? 'wingB' : 'wingF'] = p;
  }
}

function quadBody(st, M, kind) {
  const root = new T.Group(), rig = {}, body = st.body || '#6b5a4a', acc = st.accent || '#d0c0a0';
  const s = st.shape || '';
  let L = 34, H = 14, legH = 18, headR = 8, neck = 1;
  if (/triceratops|jungletyrant|haetae|sphinx/.test(s)) { L = 46; H = 22; legH = 20; headR = 11; }
  if (/poisontoad/.test(s)) { L = 26; H = 18; legH = 8; headR = 9; }
  if (/salamander/.test(s)) { L = 36; H = 9; legH = 7; headR = 6.5; }
  if (/horse|unicorn|lancer|centaur|camel|sleipnir|dunerider/.test(kind || s)) { L = 40; H = 16; legH = 26; headR = 7; neck = 1.6; }
  const biped = /raptor|jungletyrant/.test(s);
  const torso = pivot(0, legH + H / 2, 0); root.add(torso); rig.torso = torso;
  const b = mesh(cap(H / 2, L - H), M.get(body), 0, 0, 0); b.rotation.z = Math.PI / 2; torso.add(b);
  if (/camel/.test(kind || s)) torso.add(mesh(sph(7, 8, 6), M.get(body), 0, H * 0.55, 0));
  const head = pivot(L / 2 + headR * 0.4, H * 0.35 + (neck - 1) * 10, 0); torso.add(head); rig.head = head;
  if (neck > 1) { const nk = mesh(cyl(3.5, 4.5, 14, 8), M.get(body), -2, -4, 0); nk.rotation.z = -0.7; head.add(nk); }
  head.add(mesh(sph(headR, 10, 8), M.get(body), headR * 0.4, 2, 0));
  head.add(mesh(box(headR * 1.1, headR * 0.7, headR * 0.9), M.get(lighten(body, 0.1).getStyle()), headR * 1.25, 0, 0));
  for (const z of [-1, 1]) { const e = mesh(sph(1.4, 6, 5), M.get(st.boss ? '#ff5a3c' : '#f4e27a'), headR * 1.1, headR * 0.45, z * headR * 0.45); e.castShadow = false; head.add(e); }
  if (/wolf|hound|fenrir|fox|haetae/.test(s + (kind || ''))) for (const z of [-1, 1]) head.add(mesh(cone(2.2, 6, 4), M.get(body), 0, headR + 2, z * headR * 0.45));
  if (/triceratops/.test(s)) { head.add(mesh(cyl(1, headR * 1.2, 2, 10), M.get(acc), -2, headR * 0.8, 0)); for (const z of [-1, 1]) { const h = mesh(cone(1.6, 12, 5), M.get('#efe6cf'), headR * 1.2, headR * 0.9, z * 4); h.rotation.z = -1.1; head.add(h); } }
  if (/unicorn/.test(s + (kind || ''))) { const h = mesh(cone(1.4, 12, 5), M.get('#f0e0a0'), headR * 1.2, headR * 1.2, 0); h.rotation.z = -0.7; head.add(h); }
  // 다리
  const legs = [];
  const spots = biped ? [[-2, -1], [-2, 1]] : [[L * 0.32, -1], [L * 0.32, 1], [-L * 0.32, -1], [-L * 0.32, 1]];
  for (const [x, z] of spots) {
    const p = pivot(x, legH, z * H * 0.38); p.add(mesh(cap(biped ? 3.6 : 2.6, legH - 4), M.get(lighten(body, -0.15).getStyle()), 0, -legH / 2, 0));
    root.add(p); legs.push(p);
  }
  rig.legs = legs;
  // 꼬리
  const tail = pivot(-L / 2, H * 0.1, 0); torso.add(tail); rig.tail = tail;
  const tl = mesh(cone(biped ? 5 : 2.4, biped ? 26 : 16, 6), M.get(body), -8, 0, 0); tl.rotation.z = Math.PI / 2 + 0.3; tail.add(tl);
  if (/sphinx/.test(s)) { head.children[0].material = M.get(acc); head.add(mesh(box(4, 12, 14), M.get('#3a5aa8'), -2, 0, 0)); }
  return { root, rig, h: legH + H + headR * 2 + (neck > 1 ? 12 : 0), style: styleOf(st), quad: true };
}

function insect(st, M) {
  const root = new T.Group(), rig = {}, body = st.body || '#3a3036', acc = st.accent || '#c04a3a', s = st.shape;
  const crab = /crab/.test(s), scorp = /scorp/.test(s), spider = /spider/.test(s);
  const torso = pivot(0, 10, 0); root.add(torso); rig.torso = torso;
  const b = mesh(sph(spider ? 12 : 11, 12, 8), M.get(body), -4, 0, 0); b.scale.set(1.3, spider ? 0.9 : 0.6, 1); torso.add(b);
  const head = pivot(10, 1, 0); torso.add(head); rig.head = head;
  head.add(mesh(sph(6, 10, 8), M.get(lighten(body, 0.12).getStyle()), 0, 0, 0));
  for (let i = 0; i < (spider ? 4 : 2); i++) for (const z of [-1, 1]) { const e = mesh(sph(1, 5, 4), M.get('#ff4a3a'), 4.5, 2 + i * 1.2, z * (1.6 + i * 0.6)); e.castShadow = false; head.add(e); }
  const legs = [];
  const n = spider ? 4 : 3;
  for (let i = 0; i < n; i++) for (const z of [-1, 1]) {
    const p = pivot(6 - i * 6, 6, z * 9); const l = mesh(cap(1.3, 16), M.get(body), 0, -2, z * 7); l.rotation.x = z * 1.1; p.add(l); root.add(p); legs.push(p);
  }
  rig.legs = legs;
  if (crab || scorp) for (const z of [-1, 1]) { const c = pivot(14, 4, z * 7); c.add(mesh(sph(5, 8, 6), M.get(acc), 6, 2, 0)); torso.add(c); rig[z < 0 ? 'clawB' : 'clawF'] = c; }
  if (scorp) { const tail = pivot(-16, 4, 0); for (let i = 0; i < 5; i++) tail.add(mesh(sph(3.4 - i * 0.3, 8, 6), M.get(body), -i * 3, i * 5, 0)); tail.add(mesh(cone(2.4, 7, 6), M.get(acc), -10, 27, 0)); torso.add(tail); rig.tail = tail; }
  if (/scarab/.test(s)) { b.material = M.get(acc); }
  return { root, rig, h: 26, style: styleOf(st), quad: true };
}

function serpent(st, M) {
  const root = new T.Group(), rig = { segs: [] }, body = st.body || '#3a6a5a', acc = st.accent || '#e0c050';
  const n = 9, r0 = /leviathan|lavawyrm/.test(st.shape) ? 12 : 9;
  // 머리 쪽 서너 마디는 고개를 쳐들고, 나머지는 땅을 긴다
  for (let i = 0; i < n; i++) { const sg = mesh(sph(r0 * (1 - i * 0.07), 10, 8), M.get(i % 2 ? body : lighten(body, 0.08).getStyle()), -i * r0 * 1.05, r0 * (1 + Math.max(0, 3 - i) * 0.75), 0); root.add(sg); rig.segs.push(sg); }
  const head = rig.segs[0]; rig.head = head;
  for (const z of [-1, 1]) { const e = mesh(sph(1.8, 6, 5), M.get('#ffd84a'), r0 * 0.8, r0 * 0.35, z * r0 * 0.45); e.castShadow = false; head.add(e); }
  { const _o = mesh(cone(r0 * 0.5, r0 * 1.2, 8), M.get(acc), r0 * 0.9, -r0 * 0.25, 0); _o.rotation.z = -Math.PI / 2; head.add(_o); }
  if (/quetzal/.test(st.shape)) addWings(head, M, acc, 40, rig, -4, 4);
  return { root, rig, h: r0 * 4.6, style: styleOf(st), serpent: true };
}

function dragon(st, M) {
  const q = quadBody(st, M, 'dragon');
  const wc = st.accent || '#c04a2a';
  addWings(q.rig.torso, M, wc, 54, q.rig, -4, 10);
  q.rig.head.add(mesh(cone(2, 10, 5), M.get('#efe6cf'), -2, 10, -3));
  q.rig.head.add(mesh(cone(2, 10, 5), M.get('#efe6cf'), -2, 10, 3));
  q.fly = 26; q.h += 10;
  return q;
}

function flyer(st, M) {
  const root = new T.Group(), rig = {}, body = st.body || '#3a2a3a', acc = st.accent || '#c04a6a', s = st.shape;
  if (/harpy|pixie/.test(s)) {
    const hm = humanoid(Object.assign({}, st, { shape: s, rarity: null }), M, { lower: 'legs', wings: true, wingColor: acc, weapon: 'none' });
    hm.root.scale.setScalar(/pixie/.test(s) ? 0.7 : 0.9);
    root.add(hm.root); Object.assign(rig, hm.rig);
    return { root, rig, h: hm.h * 0.9, style: styleOf(st), fly: 28 };
  }
  const torso = pivot(0, 0, 0); root.add(torso); rig.torso = torso;
  const phoenix = /phoenix/.test(s);
  const bm = phoenix ? glow('#ffb347', 0.95) : M.get(body);
  if (phoenix) M.add(bm);
  const b = mesh(sph(phoenix ? 12 : 7, 10, 8), bm, 0, 0, 0); b.scale.set(1.4, 1, 1); torso.add(b);
  const head = pivot(phoenix ? 14 : 8, 4, 0); torso.add(head); rig.head = head;
  head.add(mesh(sph(phoenix ? 6 : 4.5, 8, 6), bm, 0, 0, 0));
  for (const z of [-1, 1]) { const e = mesh(sph(1, 5, 4), M.get(phoenix ? '#ffffff' : '#ff4a4a'), 3, 1, z * 2); e.castShadow = false; head.add(e); }
  addWings(torso, M, phoenix ? '#ff7a2a' : acc, phoenix ? 60 : 30, rig, 0, 2);
  if (phoenix) { const tail = mesh(cone(6, 30, 8), glow('#ff5a1e', 0.8), -22, -2, 0); tail.rotation.z = Math.PI / 2; torso.add(tail); M.add(tail.material); }
  return { root, rig, h: phoenix ? 40 : 18, style: styleOf(st), fly: phoenix ? 50 : 40 };
}

function ghost(st, M) {
  const root = new T.Group(), rig = {}, acc = st.accent || '#9ad8ff', s = st.shape;
  const torso = pivot(0, 22, 0); root.add(torso); rig.torso = torso;
  if (/wisp/.test(s)) {
    const o = mesh(sph(9, 12, 10), glow(acc, 0.9), 0, 0, 0); torso.add(o); M.add(o.material); rig.orb = o;
    const h = mesh(sph(14, 12, 10), glow(acc, 0.25), 0, 0, 0); torso.add(h); M.add(h.material);
    return { root, rig, h: 40, style: styleOf(st), fly: 10 };
  }
  const robeM = M.get(st.tunic || '#3a3a5a');
  const r = mesh(cone(12, 40, 12), robeM, 0, 0, 0); r.rotation.z = Math.PI; r.position.y = 4; torso.add(r);
  robeM.transparent = true; robeM.opacity = 0.8;
  const head = pivot(0, 24, 0); torso.add(head); rig.head = head;
  head.add(mesh(sph(8, 10, 8), robeM, 0, 0, 0));
  for (const z of [-1, 1]) { const e = mesh(sph(1.6, 6, 5), glow(acc, 1), 6.5, 1, z * 2.8); e.castShadow = false; head.add(e); M.add(e.material); }
  for (const z of [-1, 1]) { const a = pivot(0, 16, z * 10); a.add(mesh(cap(2, 14), robeM, 0, -8, 0)); torso.add(a); rig[z < 0 ? 'armB' : 'armF'] = a; }
  return { root, rig, h: 60, style: styleOf(st), fly: 8 };
}

function blob(st, M) {
  const root = new T.Group(), rig = {}, body = st.body || '#6ac06a', acc = st.accent || '#e0f0a0', s = st.shape;
  const torso = pivot(0, 0, 0); root.add(torso); rig.torso = torso;
  if (/kraken/.test(s)) {
    torso.add(mesh(sph(18, 12, 10), M.get(body), 0, 30, 0));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, t = pivot(Math.cos(a) * 10, 16, Math.sin(a) * 10); t.add(mesh(cap(3, 22), M.get(lighten(body, -0.12).getStyle()), 0, -10, 0)); t.rotation.z = Math.cos(a) * 0.4; t.rotation.x = Math.sin(a) * 0.4; torso.add(t); (rig.tent = rig.tent || []).push(t); }
    for (const z of [-1, 1]) torso.add(mesh(sph(3, 6, 5), M.get('#ffd84a'), 15, 32, z * 6));
    rig.head = torso;
    return { root, rig, h: 50, style: styleOf(st) };
  }
  if (/jelly/.test(s)) {
    const bell = mesh(sph(11, 12, 8, ), glow(body, 0.75), 0, 30, 0); bell.scale.set(1, 0.7, 1); torso.add(bell); M.add(bell.material);
    for (let i = 0; i < 5; i++) torso.add(mesh(cyl(0.6, 0.6, 22, 4), glow(acc, 0.7), (i - 2) * 4, 16, 0));
    return { root, rig, h: 40, style: styleOf(st), fly: 6 };
  }
  const rock = /rock/.test(s), magma = /magma/.test(s);
  const m = magma ? glow('#ff7a2a', 0.95) : M.get(body);
  if (magma) M.add(m);
  const b = mesh(rock ? new T.DodecahedronGeometry(11) : sph(12, 12, 10), m, 0, 11, 0); b.scale.set(1.1, 0.85, 1); torso.add(b); rig.body = b;
  for (const z of [-1, 1]) { const e = mesh(sph(1.8, 6, 5), M.get('#1a1418'), 9, 14, z * 4); e.castShadow = false; torso.add(e); }
  rig.head = torso;
  return { root, rig, h: 24, style: styleOf(st), blob: true };
}

function machine(st, M) {
  const root = new T.Group(), rig = { wheels: [] }, s = st.shape, acc = st.accent || '#c8ccd4';
  const wood = M.get('#7a5a34'), dark = M.get('#4a3a2a'), metal = M.get('#8a929a');
  const wheel = (x, z, r = 7) => { const w = mesh(cyl(r, r, 3, 12), dark, x, r, z); w.rotation.x = Math.PI / 2; root.add(w); rig.wheels.push(w); };
  if (/airship/.test(s)) {
    const bal = mesh(sph(20, 14, 10), M.get(st.tunic || '#c04a3a'), 0, 62, 0); bal.scale.set(1.6, 0.9, 0.9); root.add(bal);
    root.add(mesh(box(26, 8, 12), wood, 0, 34, 0));
    for (const x of [-10, 10]) root.add(mesh(cyl(0.5, 0.5, 20, 4), dark, x, 46, 0));
    return { root, rig, h: 80, style: 'shoot', fly: 30 };
  }
  if (/steammech/.test(s)) {
    const torso = pivot(0, 34, 0); root.add(torso); rig.torso = torso;
    torso.add(mesh(box(26, 22, 22), metal, 0, 8, 0)); torso.add(mesh(cyl(3, 3, 16, 8), dark, -8, 26, 0));
    { const _o = mesh(cyl(4, 4, 20, 8), M.get(acc), 16, 6, 0); _o.rotation.z = Math.PI / 2; torso.add(_o); }
    rig.head = torso;
    const legs = []; for (const z of [-1, 1]) { const p = pivot(0, 32, z * 8); p.add(mesh(box(7, 30, 7), metal, 0, -15, 0)); root.add(p); legs.push(p); }
    rig.legs = legs;
    return { root, rig, h: 76, style: 'shoot' };
  }
  if (/merchant/.test(s)) {
    const hm = humanoid(st, M, { weapon: 'none' }); root.add(hm.root); Object.assign(rig, hm.rig);
    const cart = pivot(-26, 0, 0); cart.add(mesh(box(26, 14, 18), wood, 0, 16, 0)); cart.add(mesh(sph(6, 8, 6), M.get('#e8c25a'), 0, 26, 0)); root.add(cart);
    for (const z of [-10, 10]) { const w = mesh(cyl(7, 7, 3, 12), dark, -26, 7, z); w.rotation.x = Math.PI / 2; root.add(w); rig.wheels.push(w); }
    return { root, rig, h: 66, style: 'slash' };
  }
  // 바퀴 달린 틀
  root.add(mesh(box(36, 6, 20), wood, 0, 12, 0));
  for (const x of [-12, 12]) for (const z of [-11, 11]) wheel(x, z);
  if (/catapult/.test(s)) {
    root.add(mesh(box(4, 22, 4), wood, 4, 24, -8)); root.add(mesh(box(4, 22, 4), wood, 4, 24, 8));
    const arm = pivot(4, 30, 0); arm.add(mesh(box(36, 3, 3), wood, -12, 0, 0)); arm.add(mesh(cyl(5, 3, 4, 8), dark, -28, 2, 0)); arm.rotation.z = 0.5; root.add(arm); rig.armF = arm; rig.catapult = arm;
  } else if (/siegebow|scorpio/.test(s)) {
    const bow = pivot(0, 22, 0); const b = mesh(tor(14, 1.2), wood, 6, 4, 0); b.scale.set(0.45, 1, 1); b.rotation.x = Math.PI / 2; bow.add(b); bow.add(mesh(box(34, 3, 3), wood, 0, 4, 0)); root.add(bow); rig.recoil = bow;
  } else if (/hwacha/.test(s)) {
    const rack = pivot(0, 22, 0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const _o = mesh(cyl(1, 1, 18, 5), M.get('#c04a2a'), 4, 4 + j * 3, (i - 1.5) * 3); _o.rotation.z = -1.2; rack.add(_o); }
    root.add(rack); rig.recoil = rack;
  } else if (/siegeram/.test(s)) {
    { const _o = mesh(cone(18, 20, 4), wood, 0, 28, 0); _o.rotation.y = Math.PI / 4; root.add(_o); }
    const ram = pivot(0, 18, 0); { const _o = mesh(cyl(3.5, 3.5, 44, 8), dark, 6, 0, 0); _o.rotation.z = Math.PI / 2; ram.add(_o); } ram.add(mesh(sph(5, 8, 6), metal, 28, 0, 0)); root.add(ram); rig.ram = ram;
  } else if (/goldcart/.test(s)) {
    root.add(mesh(box(30, 12, 18), wood, 0, 22, 0)); for (let i = 0; i < 5; i++) root.add(mesh(sph(4, 8, 6), M.get('#ffd84a'), (i - 2) * 5, 30, (i % 2) * 4 - 2));
  } else {     // 대포 · 포탑 · 개틀링
    const gun = pivot(4, 24, 0); { const _o = mesh(cyl(4.5, 5.5, 30, 10), M.get(/magma/.test(s) ? '#3a2a24' : '#3a3f48'), 10, 0, 0); _o.rotation.z = -Math.PI / 2 + 0.25; gun.add(_o); }
    root.add(mesh(box(14, 10, 14), metal, 0, 20, 0)); root.add(gun); rig.armF = gun; rig.cannon = gun;
  }
  return { root, rig, h: 44, style: styleOf(st) };
}

function vehicle(st, M) {
  const root = new T.Group(), rig = { wheels: [] }, s = st.shape, acc = st.accent || '#c8ccd4', tun = st.tunic || '#5a6a3a';
  const dark = M.get('#2a2a2e'), metal = M.get('#7a828a');
  if (/ufo|solarsat/.test(s)) {
    const d = mesh(sph(24, 16, 8), metal, 0, 40, 0); d.scale.set(1, 0.3, 1); root.add(d);
    const dome = mesh(sph(10, 12, 8), glow(acc, 0.6), 0, 46, 0); root.add(dome); M.add(dome.material);
    return { root, rig, h: 56, style: 'shoot', fly: 18 };
  }
  if (/irontrain/.test(s)) {
    root.add(mesh(box(60, 26, 24), M.get('#3a3036'), 0, 24, 0)); { const _o = mesh(cyl(11, 11, 40, 12), M.get('#2a2428'), 14, 30, 0); _o.rotation.z = Math.PI / 2; root.add(_o); }
    root.add(mesh(cyl(4, 5, 16, 8), dark, 26, 50, 0)); { const _o = mesh(cone(12, 12, 4), M.get('#c04a2a'), 34, 14, 0); _o.rotation.z = -Math.PI / 2; root.add(_o); }
    for (const x of [-20, 0, 20]) for (const z of [-13, 13]) { const w = mesh(cyl(9, 9, 3, 12), M.get('#8a2a2a'), x, 9, z); w.rotation.x = Math.PI / 2; root.add(w); rig.wheels.push(w); }
    return { root, rig, h: 60, style: 'heavy' };
  }
  const tank = /tank|bulldozer|hovertank/.test(s), car = /ambulance|handcar|icecart/.test(s), bike = /bike|chariot|biga|jetvalk/.test(s);
  if (tank) {
    root.add(mesh(box(50, 14, 30), M.get(tun), 0, 14, 0));
    for (const z of [-16, 16]) root.add(mesh(box(54, 10, 6), dark, 0, 7, z));
    const tur = pivot(0, 26, 0); tur.add(mesh(cyl(11, 13, 10, 10), M.get(tun), 0, 0, 0)); { const _o = mesh(cyl(2.4, 2.4, 34, 8), dark, 20, 2, 0); _o.rotation.z = Math.PI / 2; tur.add(_o); }
    root.add(tur); rig.armF = tur; rig.cannon = tur;
    if (/bulldozer/.test(s)) root.add(mesh(box(4, 18, 34), M.get('#e8c25a'), 30, 10, 0));
    return { root, rig, h: 40, style: 'shoot' };
  }
  if (bike) {
    root.add(mesh(box(30, 10, 16), M.get(acc), 0, 16, 0));
    for (const x of [-12, 12]) { const w = mesh(cyl(9, 9, 3, 12), dark, x, 9, 0); w.rotation.x = Math.PI / 2; root.add(w); rig.wheels.push(w); }
    const rider = humanoid(st, M, { lower: 'legs' }); rider.root.scale.setScalar(0.85); rider.root.position.set(-4, 14, 0); root.add(rider.root); Object.assign(rig, rider.rig);
    if (/chariot|biga/.test(s)) { const horse = quadBody({ shape: 'horse', body: '#8a6a4a', accent: '#c8a46a' }, M, 'horse'); horse.root.position.set(38, 0, 0); root.add(horse.root); rig.legs = horse.rig.legs; }
    return { root, rig, h: 70, style: rider.style };
  }
  // 차 · 손수레
  root.add(mesh(box(44, 22, 24), M.get(car && /ambulance/.test(s) ? '#f0f0f0' : tun), 0, 20, 0)); root.add(mesh(box(16, 12, 22), glow('#9ad8ff', 0.7), 18, 36, 0));
  for (const x of [-14, 14]) for (const z of [-12, 12]) { const w = mesh(cyl(7, 7, 3, 12), dark, x, 7, z); w.rotation.x = Math.PI / 2; root.add(w); rig.wheels.push(w); }
  return { root, rig, h: 46, style: styleOf(st) };
}

function objectModel(st, M) {
  const root = new T.Group(), rig = {}, s = st.shape, body = st.body || '#7a5a3a', acc = st.accent || '#e0c050';
  if (/barricade/.test(s)) { for (let i = 0; i < 5; i++) { const p = mesh(box(4, 40, 4), M.get('#7a5a34'), 0, 18, (i - 2) * 7); p.rotation.x = (i - 2) * 0.08; root.add(p); } root.add(mesh(box(5, 4, 36), M.get('#5a4024'), 0, 26, 0)); return { root, rig, h: 42, style: 'slash' }; }
  if (/mirror/.test(s)) { const hm = humanoid(st, M, { lower: 'robe', weapon: 'none' }); root.add(hm.root); Object.assign(rig, hm.rig); const m = mesh(box(2, 30, 20), glow('#c8e8ff', 0.8), 14, 30, 0); root.add(m); M.add(m.material); return { root, rig, h: hm.h, style: 'cast' }; }
  if (/hourglass/.test(s)) { root.add(mesh(cyl(14, 14, 4, 12), M.get('#c9a24a'), 0, 2, 0)); { const _o = mesh(cone(11, 22, 12), glow('#e8d8a0', 0.7), 0, 15, 0); _o.rotation.z = Math.PI; root.add(_o); } root.add(mesh(cone(11, 22, 12), glow('#e8d8a0', 0.7), 0, 37, 0)); root.add(mesh(cyl(14, 14, 4, 12), M.get('#c9a24a'), 0, 50, 0)); return { root, rig, h: 54, style: 'cast' }; }
  // 토템 · 장승 · 등대
  const parts = /beacon/.test(s) ? 2 : 3;
  for (let i = 0; i < parts; i++) {
    const c = mesh(cyl(8 - i, 9 - i, 16, 8), M.get(i % 2 ? acc : body), 0, 8 + i * 16, 0); root.add(c);
    for (const z of [-1, 1]) root.add(mesh(sph(1.8, 6, 5), M.get('#1a1418'), 7.6 - i, 11 + i * 16, z * 3));
  }
  const top = mesh(sph(5, 8, 6), glow(acc, 0.9), 0, parts * 16 + 4, 0); root.add(top); M.add(top.material); rig.orb = top;
  if (/beacon/.test(s)) { const hm = humanoid(st, M, { weapon: 'staff' }); hm.root.position.x = -16; root.add(hm.root); Object.assign(rig, hm.rig); }
  return { root, rig, h: parts * 16 + 10, style: styleOf(st) };
}

function treeModel(st, M) {
  const hm = humanoid(Object.assign({}, st, { tunic: st.body || '#5a4028' }), M, { big: /eldertree/.test(st.shape), weapon: 'club', headgear: 'none' });
  const can = mesh(sph(16, 10, 8), M.get(st.accent || '#3f7a3a'), 0, 12, 0); can.scale.set(1.2, 0.9, 1.2); hm.rig.head.add(can);
  return hm;
}
function mushModel(st, M) {
  const hm = humanoid(st, M, { big: /mushking/.test(st.shape), headgear: 'none' });
  const capm = mesh(sph(13, 12, 8), M.get(st.accent || '#c04a3a'), 0, 6, 0); capm.scale.set(1, 0.6, 1); hm.rig.head.add(capm);
  for (let i = 0; i < 5; i++) { const a = i * 1.3; hm.rig.head.add(mesh(sph(1.8, 6, 5), M.get('#f4f1ea'), Math.cos(a) * 8, 9, Math.sin(a) * 8)); }
  return hm;
}
function mounted(st, M) {
  const s = st.shape || '';
  const root = new T.Group(), rig = {};
  let mountKind = 'horse', mount;
  if (/griffin/.test(s)) mountKind = 'griffin';
  else if (/dragon/.test(s)) mountKind = 'dragon';
  else if (/fox/.test(s)) mountKind = 'fox';
  else if (/camel/.test(s)) mountKind = 'camel';
  else if (/carpet/.test(s)) mountKind = 'carpet';
  if (mountKind === 'carpet') {
    mount = { root: new T.Group(), rig: {} }; const c = mesh(box(40, 2, 24), M.get(st.accent || '#c04a6a'), 0, 18, 0); mount.root.add(c);
  } else if (mountKind === 'dragon' || mountKind === 'griffin') {
    mount = dragon({ shape: mountKind === 'griffin' ? 'stormgriffin' : 'drake', body: mountKind === 'griffin' ? '#c8a46a' : (st.accent || '#4a6a8a'), accent: st.tunic || '#c04a2a', name: '' }, M);
  } else {
    mount = quadBody({ shape: mountKind, body: mountKind === 'fox' ? '#e0803a' : (mountKind === 'camel' ? '#c8a46a' : (/unicorn|sleipnir/.test(s) ? '#e8e8f0' : '#7a5a3a')), accent: '#d0c0a0', name: '' }, M, /unicorn/.test(s) ? 'unicorn' : mountKind);
  }
  root.add(mount.root);
  const centaur = /centaur/.test(s);
  const rider = humanoid(st, M, { lower: centaur ? 'none' : 'legs' });
  const seat = mountKind === 'carpet' ? 20 : (mount.h - (mountKind === 'horse' ? 24 : 18));
  rider.root.scale.setScalar(centaur ? 1 : 0.8);
  rider.root.position.set(centaur ? 14 : -2, centaur ? seat - 8 : seat - 14, 0);
  if (!centaur && rider.rig.legF) { rider.rig.legF.rotation.z = 1.2; rider.rig.legB.rotation.z = 1.2; }
  root.add(rider.root);
  Object.assign(rig, rider.rig);
  rig.legs = mount.rig.legs; rig.wingB = mount.rig.wingB; rig.wingF = mount.rig.wingF; rig.mountTail = mount.rig.tail;
  return { root, rig, h: seat + rider.h * 0.8, style: rider.style, fly: mount.fly || (mountKind === 'carpet' ? 16 : 0), quad: mountKind !== 'carpet' };
}

/* ---------- 부품 합치기 ----------
 * 같은 마디(피벗)에 붙은 부품 중 재질이 같고 따로 움직이지 않는 것은 한 덩어리로 합친다.
 * 병사 하나가 20~30 번 그리던 것을 10 번 안팎으로 — 폰에서 병사가 많아져도 버티게. */
const _v3 = new T.Vector3(), _m3 = new T.Matrix3();
function mergeList(list) {
  let nv = 0, ni = 0;
  for (const c of list) { nv += c.geometry.attributes.position.count; ni += c.geometry.index.count; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let ov = 0, oi = 0;
  for (const c of list) {
    c.updateMatrix(); _m3.getNormalMatrix(c.matrix);
    const P = c.geometry.attributes.position, N = c.geometry.attributes.normal, I = c.geometry.index;
    for (let i = 0; i < P.count; i++) {
      _v3.fromBufferAttribute(P, i).applyMatrix4(c.matrix); pos[(ov + i) * 3] = _v3.x; pos[(ov + i) * 3 + 1] = _v3.y; pos[(ov + i) * 3 + 2] = _v3.z;
      _v3.fromBufferAttribute(N, i).applyMatrix3(_m3).normalize(); nrm[(ov + i) * 3] = _v3.x; nrm[(ov + i) * 3 + 1] = _v3.y; nrm[(ov + i) * 3 + 2] = _v3.z;
    }
    for (let i = 0; i < I.count; i++) idx[oi + i] = I.getX(i) + ov;
    ov += P.count; oi += I.count;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.BufferAttribute(nrm, 3));
  g.setIndex(new T.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
function mergeStatic(root, rig) {
  const keep = new Set(), geos = [];
  for (const v of Object.values(rig)) { if (Array.isArray(v)) v.forEach(o => keep.add(o)); else if (v) keep.add(v); }
  root.traverse(node => {
    if (!node.children.length) return;
    const groups = new Map();
    for (const c of node.children) {
      if (!c.isMesh || c.children.length || keep.has(c) || !c.geometry.index || !c.geometry.attributes.normal) continue;
      const k = c.material.uuid + (c.castShadow ? 's' : 'n');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const g = mergeList(list);
      geos.push(g);
      const mm = new T.Mesh(g, list[0].material);
      mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow;
      for (const c of list) node.remove(c);
      node.add(mm);
    }
  });
  return geos;
}

/* ---------- 바깥에 내놓는 것 ---------- */
function build(st, side) {
  const M = Mats();
  const a = archetype(st);
  let m;
  switch (a) {
    case 'vehicle': m = vehicle(st, M); break;
    case 'machine': m = machine(st, M); break;
    case 'object': m = objectModel(st, M); break;
    case 'tree': m = treeModel(st, M); break;
    case 'mush': m = mushModel(st, M); break;
    case 'serpent': m = serpent(st, M); break;
    case 'dragon': m = dragon(st, M); break;
    case 'flyer': m = flyer(st, M); break;
    case 'ghost': m = ghost(st, M); break;
    case 'blob': m = blob(st, M); break;
    case 'insect': m = insect(st, M); break;
    case 'quad': m = quadBody(st, M); break;
    case 'mounted': m = mounted(st, M); break;
    default:
      if (RX.giant.test(st.shape)) m = humanoid(st, M, { big: true });
      else if (RX.naga.test(st.shape)) m = humanoid(st, M, { lower: 'tail' });
      else if (RX.smoky.test(st.shape)) m = humanoid(st, M, { lower: 'smoke' });
      else m = humanoid(st, M);
  }
  const geos = mergeStatic(m.root, m.rig);
  const wrap = new T.Group();       // 바깥: 위치 · 방향 · 크기
  const inner = new T.Group();      // 안: 넉백 기울기 · 뜀 · 쓰러짐
  inner.add(m.root); wrap.add(inner);
  // 보스 · 진화 발밑 고리
  if (st.boss || st.evo || st.rarity === 'UR' || st.rarity === 'SSR') {
    const ring = new T.Mesh(tor(22, 1.2), glow(st.boss ? '#ff5a3c' : (st.evo ? '#f6d365' : (st.accent || '#ffd76a')), 0.7));
    ring.rotation.x = Math.PI / 2; ring.position.y = 1; ring.castShadow = false; wrap.add(ring); M.add(ring.material); m.rig.ring = ring;
  }
  // 재질은 부품을 다 붙인 뒤 한꺼번에 모은다 (빛 재질까지 — 맞음 번쩍 · 투명이 모두에 먹게)
  const mats = new Set(M.list);
  wrap.traverse(o => { if (o.material) mats.add(o.material); });
  return { wrap, inner, rig: m.rig, mats: [...mats], geos, h: m.h, style: m.style || styleOf(st), kind: a, fly: m.fly || 0, quad: !!m.quad, serpent: !!m.serpent, blob: !!m.blob, side };
}

/* 애니메이션 — 엔진의 병사 상태(걷기 · 공격 · 넉백 · 기절 · 맞음)를 몸짓으로 */
function animate(m, s) {
  const r = m.rig, t = s.time || 0, ph = s.phase || 0;
  const walk = s.moving ? 1 : 0, sw = Math.sin(ph * 2), atk = s.atk || 0, wind = s.wind || 0;
  if (r.legF && r.legB) {
    const f0 = r.legF.userData.z0 ?? (r.legF.userData.z0 = r.legF.rotation.z), b0 = r.legB.userData.z0 ?? (r.legB.userData.z0 = r.legB.rotation.z);
    r.legF.rotation.z = f0 + sw * 0.7 * walk; r.legB.rotation.z = b0 - sw * 0.7 * walk;
  }
  if (r.legs) r.legs.forEach((l, i) => { l.rotation.z = Math.sin(ph * 2 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 * walk; });
  if (r.torso) r.torso.position.y = (r.torso.userData.y0 ?? (r.torso.userData.y0 = r.torso.position.y)) + Math.abs(sw) * 1.6 * walk + Math.sin(t * 2.2) * 0.6 * (1 - walk);
  /* 팔 각도 θ: 0 이면 아래로 늘어지고, π/2 면 앞으로, π 면 위로. 손에 쥔 무기는 손 각도로 맞춘다
   * (베기: 칼끝이 팔을 따라 앞아래 → 머리 위로 들었다가 내려친다 · 찌르기/쏘기: 팔과 한 줄 · 마법: 지팡이는 늘 곧게) */
  if (r.armB) r.armB.rotation.z = r.shield ? 0.9 + Math.sin(t * 2 + ph) * 0.05 + atk * 0.2 : -sw * 0.5 * walk;
  if (r.armF && !r.catapult && !r.cannon) {
    const st = m.style, wk = r.weapon ? r.weapon.userData.kind : 'none';
    const ease = k => 1 - (1 - k) * (1 - k);
    const swing = (rest, top, end) => atk > 0 ? top + (end - top) * ease(Math.min(1, atk * 1.6)) : rest + (top - rest) * wind;
    let th, hz = Math.PI + 0.9, dx = 0;
    if (st === 'thrust') { th = 1.35 - 0.15 * wind; hz = Math.PI; dx = atk > 0 ? Math.sin(atk * Math.PI) * 12 : -wind * 5; }
    else if (st === 'shoot' && wk !== 'throw') { th = Math.PI / 2 + (atk > 0 ? Math.sin(atk * Math.PI) * 0.15 : 0); hz = Math.PI; dx = -wind * 2 - (atk > 0 ? Math.sin(atk * Math.PI) * 3 : 0); }
    else if (st === 'cast') { th = 0.5 + wind * 1.5 + (atk > 0 ? Math.sin(atk * Math.PI) * 0.6 : 0); hz = -th; }
    else if (st === 'heavy') th = swing(0.3, 3.0, -0.1);
    else th = swing(0.35, 2.7, 0.15);
    if (!atk && !wind && (st === 'slash' || st === 'heavy')) th += sw * 0.3 * walk;
    r.armF.rotation.z = th;
    r.armF.position.x = (r.armF.userData.x0 ?? (r.armF.userData.x0 = r.armF.position.x)) + dx;
    if (r.hand) r.hand.rotation.z = hz;
  }
  if (r.catapult) r.catapult.rotation.z = 0.5 + (atk > 0 ? -Math.sin(atk * Math.PI) * 1.6 : wind * 0.3);
  if (r.cannon) r.cannon.position.x = (r.cannon.userData.x0 ?? (r.cannon.userData.x0 = r.cannon.position.x)) - (atk > 0 ? Math.sin(atk * Math.PI) * 4 : 0);
  if (r.recoil) r.recoil.position.x = (r.recoil.userData.x0 ?? (r.recoil.userData.x0 = r.recoil.position.x)) - (atk > 0 ? Math.sin(atk * Math.PI) * 3 : 0);
  if (r.ram) r.ram.position.x = atk > 0 ? Math.sin(atk * Math.PI) * 12 : -wind * 6;
  if (r.orb) { const k = 1 + wind * 0.5 + atk * 0.8 + Math.sin(t * 5) * 0.08; r.orb.scale.setScalar(k); }
  if (r.wingB && r.wingF) { const f = Math.sin(t * (m.fly ? 9 : 4)) * (m.fly ? 0.7 : 0.25); r.wingB.rotation.x = f; r.wingF.rotation.x = -f; }
  if (r.wheels) r.wheels.forEach(w => { w.rotation.y += (s.moving ? 0.15 : 0); });
  if (r.tail && r.tail.isGroup) r.tail.rotation.y = Math.sin(t * 3) * 0.3;
  if (r.segs) r.segs.forEach((g, i) => { g.position.z = Math.sin(t * 3 + i * 0.7) * (3 + i); g.position.y = (g.userData.y0 ?? (g.userData.y0 = g.position.y)) + Math.sin(t * 2 + i) * 1.5; });
  if (r.tent) r.tent.forEach((g, i) => { g.rotation.z = Math.sin(t * 2 + i) * 0.4; });
  if (r.cape) r.cape.rotation.x = Math.sin(t * 3 + ph) * 0.12;
  if (r.robe) r.robe.rotation.x = Math.sin(t * 2.4 + ph) * 0.05 * (1 + walk);
  if (r.head) r.head.rotation.z = s.stun ? Math.sin(t * 9) * 0.3 : (atk > 0 ? -0.1 : 0);
  if (r.ring) { r.ring.rotation.z = t * 0.8; r.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.05); }
  if (m.blob && r.body) { const q = Math.sin(t * 6) * 0.08 * (1 + walk); r.body.scale.set(1.1 + q, 0.85 - q, 1 + q); }
  // 겉: 넉백 기울기 · 뜀 · 쓰러짐 · 나는 높이
  const inner = m.inner;
  inner.rotation.z = (s.kb || 0) * 0.45 + (s.lean || 0) + (s.dead ? Math.min(1.45, s.dead * 2.2) : 0);
  inner.position.y = (m.fly ? m.fly + Math.sin(t * 2 + ph) * 3 : 0) + (s.lift || 0) - (s.dead ? s.dead * 6 : 0);
  // 맞은 순간 하얗게
  const fl = Math.min(1, (s.flash || 0) * 6), fade = s.fade == null ? 1 : s.fade;
  if (m._fl !== fl || m._fade !== fade) {
    m._fl = fl; m._fade = fade;
    for (const mt of m.mats) {
      if (mt.userData.base) mt.color.copy(mt.userData.base).lerp(WHITE, fl * 0.75);
      if (fade < 1 || mt.userData.wasT !== undefined) {
        if (mt.userData.wasT === undefined) { mt.userData.wasT = mt.transparent; mt.userData.wasO = mt.opacity; }
        mt.transparent = fade < 1 || mt.userData.wasT; mt.opacity = mt.userData.wasO * fade;
      }
    }
  }
}
const WHITE = new THREE.Color('#ffffff');

function dispose(m) { for (const mt of m.mats) mt.dispose(); if (m.geos) for (const g of m.geos) g.dispose(); }

window.M3 = { build, animate, dispose, archetype, styleOf, headgear };
})();
