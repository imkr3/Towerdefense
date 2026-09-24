/* =======================================================================
 *  막대 왕국 전쟁 - 게임 데이터
 *  컨셉: 졸라맨 왕국군 vs 오크 군단 (중세)
 * ======================================================================= */

const LOADOUT_MAX = 10;      // 전투에 들고 갈 수 있는 병종 수
const HERO_SLOT_MAX = 5;     // 그 가운데 전설·신화는 이만큼까지 — 몰아 넣기만 해서는 안 된다
function isHeroUnit(u) { return !!u && (u.rarity === 'SSR' || u.rarity === 'UR'); }

const UNIT_DEFAULTS = {
  hp: 100, atk: 10, range: 60, speed: 40, interval: 1.0,
  cost: 50, cooldown: 3, kb: 2, area: false, areaRadius: 0,
  ranged: false, scale: 1, unlockStage: 1, desc: '', abText: '', ab: null, short: '',
  castFx: null, rarity: null,
  tunic: '#5b6572'
};

function mk(o) { return Object.assign({}, UNIT_DEFAULTS, o); }

/* -------------------- 아군: 왕국군 -------------------- */
const UNITS = [
  mk({
    id: 'spear', name: '창병', role: '근접', shape: 'spear',
    body: '#2b3038', accent: '#c3cad2', tunic: '#3f6bb5',
    hp: 340, atk: 44, range: 90, speed: 46, interval: 1.0,
    cost: 55, cooldown: 2.2, kb: 3, unlockStage: 1,
    desc: '값싸고 빨리 나오는 징집병. 창이 길어 한 방은 먼저 내지른다.'
  }),
  mk({
    id: 'shield', name: '방패병', role: '방어', shape: 'shield',
    body: '#2b3038', accent: '#8d6a3f', tunic: '#6b7480',
    hp: 2300, atk: 30, range: 58, speed: 26, interval: 1.5,
    cost: 120, cooldown: 6.5, kb: 1, scale: 1.1, unlockStage: 2,
    desc: '두꺼운 방패로 전선을 버틴다. 오래 버티며 조금씩 갉는다.'
  }),
  mk({
    id: 'archer', name: '궁수', role: '원거리', shape: 'archer',
    body: '#2b3038', accent: '#3f7a43', tunic: '#4a7c4e',
    hp: 300, atk: 80, range: 265, speed: 36, interval: 1.25,
    cost: 145, cooldown: 5.0, kb: 2, ranged: true, unlockStage: 3,
    desc: '뒤에서 활을 쏜다. 앞줄이 뚫리면 순식간에 쓰러진다.'
  }),
  mk({
    id: 'priest', name: '사제', role: '치유', shape: 'priest',
    body: '#2b3038', accent: '#e8d9a8', tunic: '#f0ead6',
    hp: 460, atk: 0, range: 0, speed: 30, interval: 2.0,
    cost: 175, cooldown: 12, kb: 1, unlockStage: 4,
    ab: { heal: 120, radius: 230, interval: 2.4, noAttack: true },
    abText: '주변 아군 회복 · 공격 안 함',
    desc: '싸우지 않는 대신 2.4초마다 주변 아군의 상처를 꿰맨다.'
  }),
  mk({
    id: 'berserk', castFx: 'slash', name: '광전사', role: '돌격', shape: 'berserk',
    body: '#2b3038', accent: '#b0b6bd', tunic: '#a63a2e',
    hp: 600, atk: 52, range: 70, speed: 74, interval: 0.45,
    cost: 200, cooldown: 6.0, kb: 3, unlockStage: 5,
    desc: '쌍도끼를 미친 듯이 휘두른다. 방패병 뒤에 세워야 산다.'
  }),
  mk({
    id: 'venom', name: '독침 궁수', short: '독침궁수', role: '중독', shape: 'venom',
    body: '#2b3038', accent: '#7fbf3f', tunic: '#3f6b4a',
    hp: 250, atk: 32, range: 250, speed: 38, interval: 1.4,
    cost: 190, cooldown: 6.5, kb: 2, ranged: true, unlockStage: 6,
    ab: { poison: { dps: 48, dur: 5 } },
    abText: '중독 48/초 · 5초',
    desc: '독을 바른 화살을 쏜다. 체력 큰 적일수록 독이 잘 듣는다.'
  }),
  mk({
    id: 'bomber', castFx: 'firestorm', name: '화약병', role: '자폭형', shape: 'bomber',
    body: '#2b3038', accent: '#6b4b2a', tunic: '#8a6a3a',
    hp: 300, atk: 300, range: 78, speed: 96, interval: 3.0,
    cost: 165, cooldown: 8.0, kb: 1, area: true, areaRadius: 95, unlockStage: 7,
    abText: '범위 폭발',
    desc: '적진까지 달려가 화약통을 터뜨린다. 한 방이 아주 아프다.'
  }),
  mk({
    id: 'merchant', name: '종군 상인', short: '상인', role: '보급', shape: 'merchant',
    body: '#2b3038', accent: '#c9a227', tunic: '#8a5a2a',
    hp: 620, atk: 0, range: 0, speed: 0, interval: 3.0,
    cost: 150, cooldown: 20, kb: 1, unlockStage: 8, maxActive: 3,
    ab: { gold: 12, hold: true, noAttack: true, interval: 3 },
    abText: '초당 군자금 +12 · 최대 3명 · 공격 강화 미적용',
    desc: '성문 앞에 자리를 잡고 물자를 판다. 살아 있는 동안 군자금이 더 빨리 찬다.'
  }),
  mk({
    id: 'knight', castFx: 'slash', name: '기사', role: '주력', shape: 'knight',
    body: '#2b3038', accent: '#c8ced6', tunic: '#8e2f3a',
    hp: 1600, atk: 165, range: 76, speed: 32, interval: 1.9,
    cost: 245, cooldown: 9.5, kb: 2, area: true, areaRadius: 80, scale: 1.1, unlockStage: 9,
    abText: '범위 공격',
    desc: '대검을 휘둘러 앞의 여럿을 함께 벤다. 왕국군의 중핵.'
  }),
  mk({
    id: 'frost', castFx: 'iceburst', name: '서리 마도사', short: '마도사', role: '둔화', shape: 'frost',
    body: '#2b3038', accent: '#8fd8ff', tunic: '#2f5f8e',
    hp: 320, atk: 58, range: 285, speed: 30, interval: 1.6,
    cost: 240, cooldown: 8.5, kb: 2, ranged: true, area: true, areaRadius: 75, unlockStage: 10,
    ab: { slow: 2.5 },
    abText: '범위 · 2.5초 둔화',
    desc: '서리를 흩뿌려 적 무리의 발과 공격을 함께 늦춘다.'
  }),
  mk({
    id: 'catapult', castFx: 'shockwave', name: '투석기', role: '공성', shape: 'catapult',
    body: '#6b4b2a', accent: '#3d2b18', tunic: '#6b4b2a',
    hp: 760, atk: 340, range: 440, speed: 18, interval: 3.2,
    cost: 340, cooldown: 15, kb: 1, ranged: true, area: true, areaRadius: 110,
    scale: 1.15, unlockStage: 11,
    abText: '초장거리 범위',
    desc: '전장 반대편까지 바위를 던진다. 몰려오는 적을 통째로 정리.'
  }),
  mk({
    id: 'duelist', castFx: 'slash', name: '결투가', role: '암살', shape: 'duelist',
    body: '#2b3038', accent: '#d8dde3', tunic: '#4a3a6b',
    hp: 640, atk: 95, range: 72, speed: 62, interval: 0.9,
    cost: 265, cooldown: 9.0, kb: 2, unlockStage: 12,
    ab: { crit: { chance: 0.3, mul: 2.6 }, lifesteal: 0.35 },
    abText: '30% 치명타 2.6배 · 흡혈 35%',
    desc: '급소만 노리고 벤 만큼 회복한다. 오래 살아남을수록 무서워진다.'
  }),
  mk({
    id: 'sniper', castFx: 'holy', name: '석궁 저격수', short: '저격수', role: '관통', shape: 'sniper',
    body: '#2b3038', accent: '#9aa3ad', tunic: '#3a4450',
    hp: 300, atk: 205, range: 520, speed: 16, interval: 3.4,
    cost: 310, cooldown: 13, kb: 1, ranged: true, unlockStage: 13,
    ab: { pierce: true },
    abText: '일직선 관통 · 사거리 520',
    desc: '거대 석궁으로 전선을 꿰뚫는다. 한 발이 줄 서 있는 적 전부를 관통한다.'
  }),
  mk({
    id: 'mage', castFx: 'runes', name: '대마법사', role: '섬멸', shape: 'mage',
    body: '#3a2d6b', accent: '#8fd8ff', tunic: '#3a2d6b',
    hp: 3400, atk: 430, range: 140, speed: 25, interval: 2.0,
    cost: 520, cooldown: 42, kb: 1, area: true, areaRadius: 130, scale: 1.3, unlockStage: 14,
    abText: '광역 폭발 · 20% 기절',
    ab: { stun: { chance: 0.2, dur: 1.2 } },
    desc: '왕국의 최종 카드. 폭발에 휘말린 적은 종종 얼어붙는다.'
  }),
  mk({
    id: 'colossus', castFx: 'shockwave', name: '강철 거인', short: '거인', role: '불굴', shape: 'colossus',
    body: '#4a5560', accent: '#c8ced6', tunic: '#7a8894',
    hp: 4400, atk: 190, range: 92, speed: 16, interval: 2.4,
    cost: 470, cooldown: 30, kb: 1, scale: 1.45, unlockStage: 16,
    ab: { kbImmune: true, barrier: 280, radius: 210, interval: 6 },
    abText: '넉백 면역 · 주변 아군 보호막 280',
    desc: '밀리지 않는 강철 덩어리. 6초마다 주변 아군에게 보호막을 씌운다.'
  }),
  mk({
    id: 'necro', castFx: 'pillar', name: '사령술사', role: '소환', shape: 'necro',
    body: '#2b3038', accent: '#9de08e', tunic: '#2f3f2f',
    hp: 760, atk: 45, range: 210, speed: 24, interval: 2.0,
    cost: 395, cooldown: 22, kb: 1, ranged: true, unlockStage: 18,
    ab: { summon: { id: 'skeleton', n: 2 }, interval: 6 },
    abText: '6초마다 해골 병사 2기 소환',
    desc: '쓰러진 병사를 다시 세운다. 소환된 해골은 공짜로 전선을 채운다.'
  }),
  mk({
    id: 'herald', name: '나팔수', role: '지휘', shape: 'herald',
    body: '#2b3038', accent: '#e8c65a', tunic: '#c9a227',
    hp: 520, atk: 0, range: 0, speed: 34, interval: 3.0,
    cost: 195, cooldown: 14, kb: 2, unlockStage: 6,
    ab: { haste: { mul: 0.7, dur: 4 }, radius: 240, interval: 3.5, noAttack: true },
    abText: '주변 아군 공격 간격 30% 감소',
    desc: '진군 나팔을 분다. 싸우지 않지만 주변 아군이 훨씬 빨리 때린다.'
  }),
  mk({
    id: 'longbow', name: '대궁병', role: '장거리', shape: 'longbow',
    body: '#2b3038', accent: '#6b8f3f', tunic: '#3f5a2f',
    hp: 340, atk: 118, range: 400, speed: 30, interval: 2.0,
    cost: 225, cooldown: 7.0, kb: 2, ranged: true, unlockStage: 9,
    abText: '사거리 400 · 뒤에서 안전하게',
    desc: '장궁으로 전선 훨씬 뒤에서 쏜다. 사거리 하나로 먹고산다.'
  }),
  mk({
    id: 'pyro', castFx: 'firestorm', name: '불꽃술사', role: '화염', shape: 'pyro',
    body: '#2b3038', accent: '#ff8a3c', tunic: '#8e3a1f',
    hp: 340, atk: 70, range: 235, speed: 32, interval: 1.8,
    cost: 255, cooldown: 9.0, kb: 2, ranged: true, area: true, areaRadius: 90,
    unlockStage: 12,
    ab: { burn: { dps: 70, dur: 4 } },
    abText: '범위 화염 · 화상 70/초 4초',
    desc: '불덩이를 던져 넓게 태운다. 몰려 있을수록 잘 듣는다.'
  }),
  mk({
    id: 'paladin', castFx: 'holy', name: '성기사', role: '불굴', shape: 'paladin',
    body: '#2b3038', accent: '#f0e6c8', tunic: '#c9a227',
    hp: 2100, atk: 175, range: 84, speed: 26, interval: 2.0,
    cost: 380, cooldown: 18, kb: 1, scale: 1.15, unlockStage: 15,
    ab: { revive: 0.6, heal: 70, radius: 170, interval: 4 },
    abText: '쓰러져도 1회 부활 · 주변 아군 회복',
    desc: '한 번 쓰러져도 다시 일어난다. 버티면서 주변을 치유하는 전선의 기둥.'
  }),
  mk({
    id: 'engineer', name: '공병', role: '축성', shape: 'engineer',
    body: '#2b3038', accent: '#8a6a3a', tunic: '#6b5a3f',
    hp: 420, atk: 25, range: 70, speed: 40, interval: 2.0,
    cost: 210, cooldown: 16, kb: 2, unlockStage: 17,
    ab: { summon: { id: 'barricade', n: 1 }, interval: 9 },
    abText: '9초마다 방벽 설치',
    desc: '전진하며 나무 방벽을 세운다. 방벽은 움직이지 않고 얻어맞아 준다.'
  }),
  mk({
    id: 'rogue', castFx: 'slash', name: '쌍검 도적', role: '연타', shape: 'rogue',
    body: '#2b3038', accent: '#c8ced6', tunic: '#3a3f4a',
    hp: 700, atk: 62, range: 68, speed: 86, interval: 0.35,
    cost: 300, cooldown: 11, kb: 3, unlockStage: 19,
    ab: { crit: { chance: 0.22, mul: 2.2 }, lifesteal: 0.2 },
    abText: '초당 3회 연타 · 치명타 22%',
    desc: '눈에 안 보일 속도로 두 자루를 번갈아 찌른다.'
  }),
  mk({id:'runeguard',name:'룬 수호병',role:'보호막',shape:'runeguard',
    body:'#384d68',accent:'#76e5eb',tunic:'#315783',hp:1600,atk:32,range:65,speed:28,interval:1.5,
    cost:240,cooldown:13,kb:1,unlockStage:7,maxActive:2,
    ab:{barrier:95,radius:145,interval:6},abText:'6초마다 주변 보호막 95 · 최대 2명',
    desc:'룬 방패로 좁은 전선을 지킨다. 보호막은 중첩되지 않고 더 큰 값으로 갱신된다.'}),
  mk({id:'musketeer',name:'왕실 총사',role:'관통',shape:'musketeer',
    body:'#35364d',accent:'#edbc70',tunic:'#754764',hp:360,atk:190,range:290,speed:32,interval:2.5,
    cost:285,cooldown:11,kb:2,unlockStage:10,ranged:true,
    ab:{pierce:true},abText:'사선 위 적 관통 · 느린 장전',
    desc:'긴 총신으로 밀집 대열을 관통한다. 빠른 적에게 접근을 허용하지 말자.'}),
  mk({id:'purifier',name:'새벽 정화사',role:'정화',shape:'purifier',
    body:'#d5ddd6',accent:'#a4f6cc',tunic:'#478479',hp:550,atk:0,range:0,speed:31,interval:3,
    cost:230,cooldown:16,kb:2,unlockStage:12,maxActive:2,
    ab:{cleanse:true,heal:55,radius:185,interval:4,noAttack:true},abText:'4초마다 중독·화상·둔화 해제 및 회복 · 최대 2명',
    desc:'향로의 빛으로 상태이상을 씻는다. 직접 공격하지 않으며 기절은 해제하지 못한다.'}),
  mk({id:'frostlancer',name:'서리 창기사',role:'둔화',shape:'frostlancer',
    body:'#4b6482',accent:'#c0efff',tunic:'#648aa8',hp:1250,atk:110,range:145,speed:39,interval:1.5,
    cost:270,cooldown:10,kb:2,unlockStage:14,
    ab:{slow:1.6},abText:'타격 시 1.6초 둔화',
    desc:'긴 얼음 창으로 돌격을 저지한다. 방패 뒤에서 늑대 기수를 견제하자.'}),
  // 소환 전용
  mk({
    id: 'barricade', name: '나무 방벽', role: '구조물', shape: 'barricade',
    body: '#7a5a34', accent: '#5c4326', tunic: '#7a5a34',
    hp: 1600, atk: 0, range: 0, speed: 0, interval: 3,
    cost: 0, cooldown: 0, kb: 1, unlockStage: 999,
    ab: { hold: true, noAttack: true, kbImmune: true },
    desc: '공병이 세운 방벽. 때리지는 못해도 오래 버틴다.'
  }),
  // 소환 전용 (카드에는 나오지 않는다)
  mk({
    id: 'skeleton', name: '해골 병사', role: '소환수', shape: 'skeleton',
    body: '#d8d2c0', accent: '#8a8375', tunic: '#b9b2a0',
    hp: 210, atk: 30, range: 60, speed: 58, interval: 0.9,
    cost: 0, cooldown: 0, kb: 2, unlockStage: 999,
    desc: '사령술사가 불러낸 해골. 오래 버티지는 못한다.'
  })
];

const UNIT_BY_ID = {};
UNITS.forEach(u => { UNIT_BY_ID[u.id] = u; });
// 카드로 뽑을 수 있는 병종만
const ROSTER_UNITS = UNITS.filter(u => u.unlockStage <= 100);   // 전장 진행으로 얻는 병종


/* =======================================================================
 *  시즌 소환 병종 (뽑기로만 얻는다)
 * ======================================================================= */
const RARITY = {
  N:   { name: '일반', color: '#8b8477', weight: 51, refund: 120 },
  R:   { name: '희귀', color: '#3f8ed0', weight: 30, refund: 320 },
  SR:  { name: '영웅', color: '#a05fd0', weight: 14, refund: 900 },
  SSR: { name: '전설', color: '#e8a020', weight: 4,  refund: 2400 },
  UR: { name:'신화', color:'#68f5e5', weight:1, refund:4000 }
};
const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR'];

const GACHA = {
  stonePerPull: 1,
  tenPull: 9,          // 10회 소환에 필요한 소환석
  mythPity: 120,       // 신화 확정까지 누적, 시즌을 바꿔도 유지
  pity: 40,            // 이 횟수 안에 전설 확정
  goldPerStone: 2000,  // 골드로 소환석 구매
  tenMinRarity: 'SR'   // 10회 소환은 영웅 이상 1개 확정
};

const SEASON_UNITS = [
  /* ---------------- 시즌 1 · 올림포스 ---------------- */
  mk({
    id: 'zeus', castFx: 'lightning', name: '제우스', short: '제우스', role: '뇌신', shape: 'zeus',
    season: 'olympus', rarity: 'SSR', gacha: true, unlockStage: 999,
    body: '#e8cfa4', accent: '#ffe14a', tunic: '#f7f2e4',
    hp: 900, atk: 150, range: 330, speed: 24, interval: 1.8,
    cost: 480, cooldown: 40, kb: 2, ranged: true, scale: 1.35, maxActive: 1,
    ab: { chain: { n: 4, fall: 0.75, range: 130 } },
    abText: '연쇄 번개 · 4번 튕김 · 몸이 약함',
    desc: '번개가 적에서 적으로 옮겨 붙는다. 떼로 몰려올수록 무섭지만, 단단한 한 놈 앞에서는 약하고 몸도 가볍다. 앞을 지켜 줄 병력이 있어야 산다.'
  }),
  mk({
    id: 'ares', castFx: 'slash', name: '아레스', short: '아레스', role: '전신', shape: 'ares',
    season: 'olympus', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c0392b', tunic: '#8e2f3a',
    hp: 1900, atk: 170, range: 88, speed: 34, interval: 1.7,
    cost: 400, cooldown: 26, kb: 1, area: true, areaRadius: 95, scale: 1.15,
    ab: { enrage: 1.8, lifesteal: 0.12 },
    abText: '범위 · 피가 깎일수록 가속 · 흡혈 12%',
    desc: '전쟁 그 자체. 상처가 깊어질수록 창은 더 빨라진다.'
  }),
  mk({
    id: 'artemis', castFx: 'holy', name: '아르테미스', short: '아르테미스', role: '사냥', shape: 'artemis',
    season: 'olympus', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#cfe8b0', tunic: '#4a7c4e',
    hp: 430, atk: 95, range: 390, speed: 44, interval: 1.15,
    cost: 380, cooldown: 22, kb: 2, ranged: true,
    ab: { pierce: true },
    abText: '일직선 관통 · 1.15초마다 사격',
    desc: '달의 사냥꾼. 화살 한 발이 줄지어 선 적을 전부 꿰뚫는다.'
  }),
  mk({
    id: 'medusa', castFx: 'iceburst', name: '메두사', short: '메두사', role: '석화', shape: 'medusa',
    season: 'olympus', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#6b8f5f', accent: '#9de08e', tunic: '#4a6b46',
    hp: 760, atk: 92, range: 240, speed: 28, interval: 1.8,
    cost: 260, cooldown: 10, kb: 2, ranged: true,
    ab: { stun: { chance: 0.5, dur: 1.6 }, slow: 2 },
    abText: '50% 석화(기절) · 둔화',
    desc: '눈을 마주친 자는 돌이 된다. 전선을 통째로 굳혀 버린다.'
  }),
  mk({
    id: 'spartan', name: '스파르타 전사', short: '스파르타', role: '밀집', shape: 'spartan',
    season: 'olympus', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c9a227', tunic: '#a83a2e',
    hp: 2700, atk: 92, range: 66, speed: 30, interval: 1.4,
    cost: 230, cooldown: 9, kb: 1, scale: 1.1,
    ab: { kbImmune: true },
    abText: '넉백 면역 · 밀리지 않는 방진',
    desc: '한 발도 물러서지 않는다. 방패를 맞대고 버티는 것이 임무다.'
  }),

  /* ---------------- 시즌 2 · 라그나로크 ---------------- */
  mk({
    id: 'thor', castFx: 'shockwave', name: '토르', short: '토르', role: '뇌신', shape: 'thor',
    season: 'ragnarok', rarity: 'SSR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#b9c2cc', tunic: '#8e2f3a',
    hp: 2200, atk: 190, range: 90, speed: 30, interval: 1.6,
    cost: 460, cooldown: 36, kb: 1, scale: 1.4, maxActive: 1,
    ab: { breaker: 1.8, push: 30 },
    abText: '파쇄 · 갑주 무시 · 보스·중장갑에게 1.8배 · 단일 대상',
    desc: '묠니르는 갑옷도 성벽도 가리지 않는다. 보스와 중장갑을 깨는 데는 따를 자가 없지만, 한 번에 하나밖에 못 친다. 떼는 다른 병력이 맡아야 한다.'
  }),
  mk({
    id: 'valkyrie', castFx: 'holy', name: '발키리', short: '발키리', role: '전선', shape: 'valkyrie',
    season: 'ragnarok', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#f0e6c8', tunic: '#3f6bb5',
    hp: 1100, atk: 110, range: 82, speed: 58, interval: 1.3,
    cost: 390, cooldown: 24, kb: 2,
    ab: { revive: 0.5, heal: 60, radius: 160, interval: 4 },
    abText: '1회 부활 · 주변 아군 회복',
    desc: '쓰러진 자를 거두는 전장의 처녀. 자기 자신도 한 번은 일어난다.'
  }),
  mk({
    id: 'fenrir', castFx: 'slash', name: '펜리르', short: '펜리르', role: '맹수', shape: 'fenrir',
    season: 'ragnarok', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#3a3f48', accent: '#7fd8ff', tunic: '#2a2e36',
    hp: 1100, atk: 100, range: 66, speed: 130, interval: 0.8,
    cost: 390, cooldown: 24, kb: 2, scale: 1.25,
    ab: { lifesteal: 0.25 },
    abText: '초고속 돌진 · 흡혈 25%',
    desc: '사슬을 끊고 나온 늑대. 물어뜯은 만큼 스스로 회복한다.'
  }),
  mk({
    id: 'viking', name: '바이킹 전사', short: '바이킹', role: '광전', shape: 'viking',
    season: 'ragnarok', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c8ced6', tunic: '#6b4b2a',
    hp: 950, atk: 78, range: 70, speed: 80, interval: 0.7,
    cost: 260, cooldown: 10, kb: 3,
    ab: { enrage: 1.7, crit: { chance: 0.25, mul: 2.2 } },
    abText: '광폭화 · 25% 치명타',
    desc: '피를 볼수록 웃는다. 죽기 직전이 가장 강하다.'
  }),
  mk({
    id: 'runeseer', name: '룬 주술사', short: '룬술사', role: '지원', shape: 'runeseer',
    season: 'ragnarok', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#7fd8ff', tunic: '#3a4e6b',
    hp: 640, atk: 0, range: 0, speed: 30, interval: 4,
    cost: 240, cooldown: 12, kb: 1,
    ab: { haste: { mul: 0.78, dur: 4 }, barrier: 190, radius: 210, interval: 4, noAttack: true },
    abText: '주변 아군 가속 + 보호막 190',
    desc: '룬을 새겨 아군을 감싼다. 싸우지 않지만 없으면 아쉽다.'
  }),

  /* ---------------- 시즌 3 · 나일의 왕가 ---------------- */
  mk({
    id: 'anubis', castFx: 'pillar', name: '아누비스', short: '아누비스', role: '사자', shape: 'anubis',
    season: 'nile', rarity: 'SSR', gacha: true, unlockStage: 999,
    body: '#2a2a30', accent: '#e8c65a', tunic: '#1e1e24',
    hp: 1800, atk: 80, range: 110, speed: 26, interval: 2,
    cost: 420, cooldown: 34, kb: 1, scale: 1.35, maxActive: 1,
    ab: { summon: { id: 'mummy', n: 1 }, interval: 8 },
    abText: '8초마다 미라 1기 · 본인 화력 약함',
    desc: '미라를 세워 전열을 대신 막게 한다. 스스로는 거의 싸우지 못하니, 미라 뒤에서 때려 줄 병력과 함께 써야 한다.'
  }),
  mk({
    id: 'rapriest', castFx: 'firestorm', name: '라의 사제', short: '라사제', role: '태양', shape: 'rapriest',
    season: 'nile', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#ffb03c', tunic: '#e8c65a',
    hp: 720, atk: 180, range: 300, speed: 30, interval: 2.0,
    cost: 350, cooldown: 18, kb: 2, ranged: true, area: true, areaRadius: 105,
    ab: { burn: { dps: 60, dur: 5 } },
    abText: '태양광 범위 · 화상 60/초 5초',
    desc: '태양을 조각내 던진다. 맞은 자리는 한참을 탄다.'
  }),
  mk({
    id: 'scarab', name: '황금 스카라베', short: '스카라베', role: '보물', shape: 'scarab',
    season: 'nile', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#c9a227', accent: '#6b5417', tunic: '#e8c65a',
    hp: 520, atk: 70, range: 62, speed: 110, interval: 0.8,
    cost: 220, cooldown: 12, kb: 3,
    ab: { gold: 8 },
    abText: '빠름 · 살아 있는 동안 군자금 +8/초',
    desc: '황금 껍질을 두른 풍뎅이. 굴러다니며 금화를 흘린다.'
  }),
  mk({
    id: 'desertarcher', name: '사막 궁수', short: '사막궁수', role: '원거리', shape: 'desertarcher',
    season: 'nile', rarity: 'N', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#e8d9a8', tunic: '#b98a52',
    hp: 270, atk: 47, range: 285, speed: 40, interval: 1.2,
    cost: 150, cooldown: 7, kb: 2, ranged: true,
    abText: '값싼 원거리',
    desc: '모래바람 속에서 자란 궁수. 싸고 빠르게 자리를 채운다.'
  }),
  mk({
    id: 'hoplite', name: '아테네 창병', short: '아테네창', role: '방진', shape: 'hoplite',
    season: 'olympus', rarity: 'N', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c8ced6', tunic: '#3f6bb5',
    hp: 620, atk: 41, range: 72, speed: 44, interval: 1.0,
    cost: 140, cooldown: 6, kb: 2,
    abText: '값싼 창방패 보병',
    desc: '도시국가의 시민병. 싸고 빠르게 전열을 채운다.'
  }),
  mk({
    id: 'northarcher', name: '북방 궁수', short: '북방궁수', role: '원거리', shape: 'northarcher',
    season: 'ragnarok', rarity: 'N', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#9fc6d8', tunic: '#4a5c6b',
    hp: 300, atk: 52, range: 300, speed: 38, interval: 1.15,
    cost: 155, cooldown: 7, kb: 2, ranged: true,
    abText: '값싼 원거리',
    desc: '얼음 바람 속에서 활을 당기는 사냥꾼.'
  }),
  mk({
    id: 'pharaoh', name: '파라오 근위대', short: '근위대', role: '수호', shape: 'pharaoh',
    season: 'nile', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#e8c65a', tunic: '#2b6b8e',
    hp: 2300, atk: 112, range: 78, speed: 28, interval: 1.6,
    cost: 370, cooldown: 24, kb: 1, scale: 1.15,
    ab: { kbImmune: true, barrier: 200, radius: 180, interval: 6 },
    abText: '넉백 면역 · 주변 아군 보호막 200',
    desc: '왕의 무덤을 지키던 창병. 한 걸음도 밀리지 않는다.'
  }),
  // 소환 전용
  mk({
    id: 'mummy', name: '미라', role: '소환수', shape: 'mummy',
    body: '#cfc09a', accent: '#7a7263', tunic: '#bdae88',
    hp: 720, atk: 62, range: 62, speed: 26, interval: 1.4,
    cost: 0, cooldown: 0, kb: 1, unlockStage: 999,
    ab: { kbImmune: true },
    desc: '아누비스가 일으킨 미라. 느리지만 밀리지 않는다.'
  })
];

/* 신화: 압도적인 상시 화력 대신 직접 선택하는 전술 능력에 집중한다. */
SEASON_UNITS.push(
  mk({id:'hades',name:'하데스',role:'명계',shape:'hades',season:'olympus',rarity:'UR',gacha:true,unlockStage:999,
    body:'#807395',accent:'#c98aff',tunic:'#33213f',hp:2000,atk:170,range:245,speed:25,interval:2.2,
    cost:560,cooldown:45,kb:2,ranged:true,area:true,areaRadius:80,scale:1.2,maxActive:1,
    ab:{lifesteal:.1,reanimate:{id:'skeleton',radius:260,cd:1.4,max:8}},
    abText:'명계 · 주변에서 쓰러진 적을 해골로 일으킴(최대 8) · 명계의 문',
    desc:'근처에서 쓰러진 적을 해골 병사로 일으킨다. 싸움이 길어질수록 군세가 불어나지만, 스스로는 시체를 만들 힘이 없다. 적을 쓰러뜨려 줄 주력과 함께여야 한다.',
    active:{name:'명계의 문',kind:'underworld',cd:52,radius:230,mul:2.6,slow:3,desc:'가장 가까운 적 주변 피해·3초 둔화. 성채에는 피해 없음.'}}),
  mk({id:'odin',name:'오딘',role:'룬의 지배자',shape:'odin',season:'ragnarok',rarity:'UR',gacha:true,unlockStage:999,
    body:'#b4bdc4',accent:'#7be6ff',tunic:'#28495e',hp:1600,atk:150,range:290,speed:27,interval:2.2,
    cost:560,cooldown:45,kb:2,ranged:true,maxActive:1,scale:1.15,
    ab:{pierce:true,rally:{atk:.35,radius:300},interval:2.5},
    abText:'지휘 · 주변 아군 공격력 +35% (자신 제외) · 운명의 룬',
    desc:'궁니르를 들어 전군을 지휘한다. 곁에 선 병사들이 한층 세게 친다. 혼자서는 평범한 창잡이일 뿐 — 거느린 군대가 강할수록 오딘도 강해진다.',
    active:{name:'운명의 룬',kind:'runeveil',cd:48,radius:300,barrier:320,desc:'주변 아군 보호막·중독과 화상 정화. 보호막 중첩 없음.'}}),
  mk({id:'ra',name:'라',role:'태양신',shape:'ra',season:'nile',rarity:'UR',gacha:true,unlockStage:999,
    body:'#c9a466',accent:'#ffca62',tunic:'#f0e0ae',hp:1500,atk:140,range:260,speed:26,interval:2.2,
    cost:540,cooldown:45,kb:2,ranged:true,area:true,areaRadius:85,maxActive:1,scale:1.2,
    ab:{burn:{dps:18,dur:3},sunmark:{vuln:.3,dur:4}},
    abText:'태양 낙인 · 맞은 적은 4초간 모든 피해 +30% · 태양의 심판',
    desc:'태양빛으로 적을 낙인찍는다. 낙인 찍힌 적은 누구에게 맞든 더 아프다. 라 혼자서는 약하지만, 주력의 화력을 한 단계 끌어올린다.',
    active:{name:'태양의 심판',kind:'sunfall',cd:55,radius:215,mul:3,burn:5,desc:'가장 가까운 적 주변 피해·5초 화상·낙인. 성채에는 피해 없음.'}}),
  mk({id:'persephone',name:'페르세포네',role:'봄과 명계',shape:'persephone',season:'olympus',rarity:'SR',gacha:true,unlockStage:999,
    body:'#e2c4cf',accent:'#f6a5d4',tunic:'#713d79',hp:700,atk:75,range:235,speed:32,interval:1.8,
    cost:280,cooldown:18,kb:2,ranged:true,ab:{heal:45,radius:175,interval:4},abText:'주변 회복 · 꽃잎 탄환',desc:'석류와 꽃관을 지닌 봄의 여왕. 명계의 군대에도 생명을 되돌린다.'}),
  mk({id:'skadi',name:'스카디',role:'겨울 사냥꾼',shape:'skadi',season:'ragnarok',rarity:'SR',gacha:true,unlockStage:999,
    body:'#bfd4e1',accent:'#a9eaff',tunic:'#4e698a',hp:560,atk:95,range:315,speed:43,interval:1.7,
    cost:285,cooldown:17,kb:2,ranged:true,ab:{slow:1.2},abText:'1.2초 둔화 · 서리 화살',desc:'털 망토를 두른 산의 사냥꾼. 서리 활로 돌격의 발걸음을 묶는다.'}),
  mk({id:'bastet',name:'바스테트',role:'고양이 수호신',shape:'bastet',season:'nile',rarity:'SR',gacha:true,unlockStage:999,
    body:'#39364e',accent:'#e9bf65',tunic:'#287d7a',hp:1100,atk:76,range:70,speed:80,interval:.9,
    cost:280,cooldown:17,kb:3,ab:{crit:{chance:.2,mul:1.8},lifesteal:.12},abText:'치명타 20% · 흡혈 12%',desc:'고양이 귀와 황금 발톱을 지닌 수호신. 낮은 자세로 전선의 빈틈을 파고든다.'})
);
/* ---------------- 시즌 4 · 요괴록 (한국 설화) ----------------
 * 신이 아니라 옛이야기 속 요괴와 저승의 관리들. 싸움을 비트는 쪽이다:
 * 적을 홀리고(구미호), 명부에 오른 적을 거두고(저승사자), 판돈을 불린다(도깨비). */
SEASON_UNITS.push(
  mk({id:'gumiho',name:'구미호',role:'홀림',shape:'gumiho',castFx:'foxfire',season:'yokai',rarity:'UR',gacha:true,unlockStage:999,
    body:'#f3e6da',accent:'#ff7ab8',tunic:'#b8324b',hp:1500,atk:120,range:250,speed:34,interval:2.0,
    cost:540,cooldown:45,kb:2,ranged:true,area:true,areaRadius:70,scale:1.15,
    ab:{charm:{chance:.25,dur:3}},
    abText:'여우불 · 맞은 적 25%를 3초 홀림(제 편을 침, 보스 제외) · 여우 구슬',
    desc:'아홉 꼬리의 여우. 여우불에 홀린 적은 잠시 제 편을 친다. 몰려오는 무리를 서로 싸우게 만들지만, 스스로 적을 쓰러뜨리는 힘은 크지 않다.',
    active:{name:'여우 구슬',kind:'foxbead',cd:50,radius:220,mul:1.6,charm:4,desc:'가장 가까운 적 주변 피해·4초 홀림(보스 제외). 성채에는 피해 없음.'}}),
  mk({id:'saja',name:'저승사자',role:'명부',shape:'saja',castFx:'inkslash',season:'yokai',rarity:'SSR',gacha:true,unlockStage:999,
    body:'#e9e4dc',accent:'#9fd3ff',tunic:'#17171d',hp:1700,atk:120,range:95,speed:32,interval:1.6,
    cost:440,cooldown:36,kb:1,scale:1.15,
    ab:{execute:.2},
    abText:'명부 · 체력 20% 이하인 적을 즉시 거둠(보스 제외) · 명부 호명',
    desc:'검은 갓을 쓴 저승의 관리. 명부에 이름이 오른 적은 한 번의 손짓으로 데려간다. 단단한 적을 깎아 줄 동료가 있어야 제 몫을 한다.',
    active:{name:'명부 호명',kind:'reaproll',cd:48,radius:240,mul:1.4,execute:.35,desc:'가장 가까운 적 주변 피해 뒤, 체력 35% 이하는 즉시 거둠(보스 제외).'}}),
  mk({id:'dokkaebi',name:'도깨비',role:'방망이',shape:'dokkaebi',castFx:'goldburst',season:'yokai',rarity:'SR',gacha:true,unlockStage:999,
    body:'#4f8a6a',accent:'#f2c14e',tunic:'#7b4a2a',hp:1500,atk:100,range:80,speed:36,interval:1.3,
    cost:330,cooldown:20,kb:1,area:true,areaRadius:80,scale:1.15,
    ab:{bounty:{chance:.3,gold:18}},
    abText:'범위 · 때릴 때 30% 확률로 군자금 +18',
    desc:'"금 나와라 뚝딱!" 방망이를 휘두를 때마다 이따금 금이 쏟아진다.'}),
  mk({id:'haetae',name:'해치',role:'수호수',shape:'haetae',castFx:'shockwave',season:'yokai',rarity:'SR',gacha:true,unlockStage:999,
    body:'#e4d6b0',accent:'#3e9c8f',tunic:'#b98a3a',hp:2600,atk:60,range:70,speed:26,interval:1.5,
    cost:320,cooldown:22,kb:1,scale:1.2,
    ab:{kbImmune:true,thorns:.3},
    abText:'넉백 면역 · 근접 피해 30% 되돌림',
    desc:'옳고 그름을 가리는 상상의 짐승. 밀리지 않고, 저를 친 자에게 그대로 돌려준다.'}),
  mk({id:'mudang',name:'무당',role:'액막이',shape:'mudang',castFx:'holy',season:'yokai',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#e84d6b',tunic:'#f2e3c6',hp:520,atk:40,range:230,speed:34,interval:1.6,
    cost:240,cooldown:12,kb:2,ranged:true,
    ab:{weaken:{mul:.7,dur:4}},
    abText:'액막이 방울 · 맞은 적의 공격력 -30% (4초)',
    desc:'방울과 부채로 액을 막는다. 무서운 적일수록 이 방울 소리가 반갑다.'}),
  mk({id:'hwarang',name:'화랑',role:'풍류 검객',shape:'hwarang',castFx:'slash',season:'yokai',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#f4d06f',tunic:'#3a7ca5',hp:780,atk:68,range:70,speed:60,interval:.85,
    cost:230,cooldown:10,kb:2,
    ab:{lifesteal:.15},
    abText:'빠른 검 · 흡혈 15%',
    desc:'꽃처럼 차려입은 젊은 검객. 빠르게 파고들어 벤 만큼 회복한다.'}),
  mk({id:'pojol',name:'포졸',role:'육모방망이',shape:'pojol',season:'yokai',rarity:'N',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#c0392b',tunic:'#2f3e5c',hp:600,atk:40,range:95,speed:44,interval:1.2,
    cost:145,cooldown:6,kb:2,
    abText:'값싼 창 · 긴 사거리',
    desc:'고을을 지키던 포졸. 싸고 빠르게 전열을 채운다.'})
);

/* ---------------- 시즌 5 · 태엽 공방 (증기와 톱니) ----------------
 * 신화도 요괴도 아닌 발명가들. 세워 두고(포탑), 예열하고(증기 거상),
 * 뒷줄을 노린다(비행선). 손이 많이 가지만 갖춰지면 단단하다. */
SEASON_UNITS.push(
  mk({id:'inventor',name:'대발명가',role:'공방장',shape:'inventor',castFx:'tesla',season:'clockwork',rarity:'UR',gacha:true,unlockStage:999,
    body:'#e9d3b0',accent:'#ffb347',tunic:'#5a3b26',hp:1300,atk:90,range:240,speed:28,interval:1.8,
    cost:540,cooldown:45,kb:2,ranged:true,scale:1.1,
    ab:{summon:{id:'turret',n:1,max:3},interval:7},
    abText:'7초마다 포탑 설치(최대 3) · 과부하',
    desc:'톱니와 증기로 전장을 설계한다. 제자리에 박힌 포탑이 쉬지 않고 쏜다. 앞줄이 버텨 주면 포탑이 늘고, 무너지면 아무것도 못 세운다.',
    active:{name:'과부하',kind:'overdrive',cd:50,radius:320,haste:{mul:.55,dur:6},desc:'주변 아군 공격 속도 크게 증가(6초)·기절 해제.'}}),
  mk({id:'steammech',name:'증기 거상',role:'예열 포격',shape:'steammech',castFx:'steamburst',season:'clockwork',rarity:'SSR',gacha:true,unlockStage:999,
    body:'#8a7a66',accent:'#ff8c42',tunic:'#4a4038',hp:2600,atk:70,range:250,speed:20,interval:1.2,
    cost:470,cooldown:38,kb:1,ranged:true,area:true,areaRadius:75,scale:1.35,
    ab:{spinup:{per:.1,max:1.2}},
    abText:'예열 · 쏠수록 빨라짐(최대 2.2배) · 걸으면 식음 · 증기 폭발',
    desc:'굴뚝에서 연기를 뿜는 걸어 다니는 포대. 처음엔 느리지만 멈춰 서서 쏠수록 불을 뿜는다. 전선이 자주 흔들리면 영영 예열되지 않는다.',
    active:{name:'증기 폭발',kind:'steamburst',cd:46,radius:200,mul:2.2,push:90,desc:'가장 가까운 적 주변 피해·크게 밀쳐 냄.'}}),
  mk({id:'airship',name:'비행선 폭격수',short:'비행선',role:'뒷줄 폭격',shape:'airship',castFx:'firestorm',season:'clockwork',rarity:'SR',gacha:true,unlockStage:999,
    body:'#6b4b2a',accent:'#ff9f43',tunic:'#b8a27a',hp:700,atk:120,range:380,speed:30,interval:2.4,
    cost:360,cooldown:24,kb:2,ranged:true,area:true,areaRadius:70,
    ab:{backline:true,burn:{dps:30,dur:3}},
    abText:'뒷줄 폭격 · 사거리 안 가장 먼 적 · 화상',
    desc:'하늘에서 폭탄을 떨군다. 앞줄 너머의 주술사와 투석기를 노린다.'}),
  mk({id:'teslaknight',name:'테슬라 기사',short:'테슬라',role:'방전',shape:'teslaknight',castFx:'tesla',season:'clockwork',rarity:'SR',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#7fe3ff',tunic:'#3b4a5c',hp:1500,atk:90,range:80,speed:34,interval:1.3,
    cost:340,cooldown:22,kb:1,scale:1.1,
    ab:{chain:{n:2,fall:.6,range:110},stun:{chance:.12,dur:.6}},
    abText:'방전 · 2번 튕김 · 12% 기절',
    desc:'등에 코일을 짊어진 기사. 창끝에서 튄 전기가 옆의 적까지 태운다.'}),
  mk({id:'clocksoldier',name:'태엽 병정',short:'태엽병정',role:'자폭 톱니',shape:'clocksoldier',season:'clockwork',rarity:'R',gacha:true,unlockStage:999,
    body:'#b08d57',accent:'#e0c080',tunic:'#6b4f2e',hp:700,atk:45,range:70,speed:40,interval:1.1,
    cost:200,cooldown:9,kb:2,
    ab:{deathBomb:{dmg:160,radius:95}},
    abText:'쓰러지면 톱니 폭발(범위 160)',
    desc:'태엽을 감아 움직이는 병정. 부서질 때 톱니가 사방으로 튄다.'}),
  mk({id:'mechanic',name:'정비공',role:'수리',shape:'mechanic',season:'clockwork',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#f5c542',tunic:'#3e5f7a',hp:560,atk:28,range:70,speed:36,interval:1.4,
    cost:230,cooldown:12,kb:2,
    ab:{heal:70,radius:180,interval:3.5},
    abText:'주변 아군 수리(회복) · 약한 렌치',
    desc:'렌치 하나로 사람도 기계도 고친다. 포탑과 거상 곁에 두면 오래 버틴다.'}),
  mk({id:'rifleman',name:'소총수',role:'원거리',shape:'rifleman',season:'clockwork',rarity:'N',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#b0b6bd',tunic:'#5a6b3a',hp:280,atk:50,range:300,speed:40,interval:1.3,
    cost:150,cooldown:7,kb:2,ranged:true,
    abText:'값싼 원거리',
    desc:'공방에서 찍어 낸 소총을 든 민병. 싸고 멀리 쏜다.'}),
  // 소환 전용
  mk({id:'turret',name:'증기 포탑',role:'소환물',shape:'turret',unlockStage:999,
    body:'#6b5a48',accent:'#ffb347',tunic:'#4a4038',hp:900,atk:55,range:300,speed:0,interval:.8,
    cost:0,cooldown:0,kb:1,ranged:true,
    ab:{hold:true,kbImmune:true},
    desc:'대발명가가 세운 포탑. 움직이지 않고 쏘기만 한다.'})
);
// 전설·신화는 한 명씩만 전장에 설 수 있다. 머릿수로 밀어붙이는 병종이 아니라
// 판을 바꾸는 특수 병종이기 때문이다.
SEASON_UNITS.forEach(u => {
  if (u.gacha && (u.rarity === 'SSR' || u.rarity === 'UR')) u.maxActive = 1;
  // 영웅(SR)도 줄지어 세울 수는 없다. 둘까지.
  else if (u.gacha && u.rarity === 'SR' && !u.maxActive) u.maxActive = 2;
});
UNITS.push.apply(UNITS, SEASON_UNITS);
SEASON_UNITS.forEach(u => { UNIT_BY_ID[u.id] = u; });

UNIT_BY_ID.zeus.active={name:'천둥의 칙령',kind:'thunderseal',cd:48,radius:180,mul:3.0,stun:.8,desc:'가장 가까운 적 주변 번개 피해·0.8초 기절.'};
UNIT_BY_ID.thor.active={name:'묠니르 강타',kind:'thunderseal',cd:45,radius:190,mul:2.6,stun:.6,desc:'가장 가까운 적 주변 충격파 피해·0.6초 기절.'};
UNIT_BY_ID.anubis.active={name:'사자의 결계',kind:'underworld',cd:50,radius:250,barrier:240,desc:'주변 아군에게 보호막·중독과 화상 정화.'};

function rollSummon(s, pick) {
  s.pity = (s.pity || 0) + 1;
  s.mythPity = (s.mythPity || 0) + 1;
  s.pulls = (s.pulls || 0) + 1;
  const u = pick(s.mythPity >= GACHA.mythPity ? 'UR' : s.pity >= GACHA.pity ? 'SSR' : undefined);
  if (u.rarity === 'UR') s.mythPity = 0;
  if (u.rarity === 'SSR' || u.rarity === 'UR') s.pity = 0;
  return u;
}

const SEASONS = [
  { id: 'olympus', name: '올림포스', sub: '그리스 신화',
    color: '#d8c47a', accent: '#8e6b1f',
    desc: '번개와 창의 신들이 왕국의 부름에 응했다.',
    units: ['hades', 'persephone', 'zeus', 'ares', 'artemis', 'medusa', 'spartan', 'hoplite'] },
  { id: 'ragnarok', name: '라그나로크', sub: '북유럽 신화',
    color: '#8fb6d8', accent: '#2f5f8e',
    desc: '최후의 전투를 앞둔 북방의 전사들이 내려왔다.',
    units: ['odin', 'skadi', 'thor', 'valkyrie', 'fenrir', 'viking', 'runeseer', 'northarcher'] },
  { id: 'nile', name: '나일의 왕가', sub: '이집트 신화',
    color: '#e8c65a', accent: '#8a6a1f',
    desc: '모래 아래 잠들어 있던 사자의 신과 사제들이 깨어났다.',
    units: ['ra', 'bastet', 'anubis', 'rapriest', 'pharaoh', 'scarab', 'desertarcher'] },
  { id: 'yokai', name: '요괴록', sub: '한국 설화',
    color: '#e0707a', accent: '#8e1f2f',
    desc: '달 밝은 밤, 옛이야기 속 요괴와 저승의 관리들이 왕국 편에 섰다.',
    units: ['gumiho', 'saja', 'dokkaebi', 'haetae', 'mudang', 'hwarang', 'pojol'] },
  { id: 'clockwork', name: '태엽 공방', sub: '증기와 톱니',
    color: '#d9a066', accent: '#6b4a24',
    desc: '연기 자욱한 공방에서 발명가들이 기계 군단을 끌고 나왔다.',
    units: ['inventor', 'steammech', 'airship', 'teslaknight', 'clocksoldier', 'mechanic', 'rifleman'] }
];

/* 소환 풀: 시즌 병종 + (다른 시즌은 낮은 확률로) */
function seasonById(id) {
  for (const s of SEASONS) if (s.id === id) return s;
  return SEASONS[0];
}
function gachaPool(seasonId) {
  const pick = seasonById(seasonId);
  const inSeason = pick.units.map(id => UNIT_BY_ID[id]);
  const others = SEASON_UNITS.filter(u => u.gacha && u.season !== seasonId);
  return { inSeason: inSeason, others: others };
}

/* -------------------- 적: 오크 군단 -------------------- */
const ENEMIES = {
  goblin:   { name: '고블린 졸개', body: '#4d6b3a', accent: '#8a5a2a', tunic: '#3f5a2f', shape: 'goblin',
              hp: 220, atk: 26, range: 60, speed: 42, interval: 1.1, kb: 2, gold: 12, scale: .85 },
  orcspear: { name: '오크 창병', body: '#4a6b46', accent: '#b0b6bd', tunic: '#3d5a3a', shape: 'orcspear',
              hp: 400, atk: 66, range: 120, speed: 40, interval: 1.4, kb: 2, gold: 18 },
  ogre:     { name: '오우거', body: '#6b7a52', accent: '#4a3520', tunic: '#5a6a44', shape: 'ogre',
              ab:{regen:18}, abText:'초당 체력 18 재생 · 화상 중에는 재생 중단', hp: 3300, atk: 48, range: 62, speed: 24, interval: 1.6, kb: 1, gold: 34, scale: 1.2 },
  wolf:     { name: '늑대 기수', body: '#5a5f66', accent: '#7a4a2a', tunic: '#4a6b46', shape: 'wolf',
              hp: 450, atk: 86, range: 62, speed: 92, interval: 0.7, kb: 3, gold: 22 },
  ballista: { name: '석궁 사수', body: '#4a6b46', accent: '#6b4b2a', tunic: '#3d5a3a', shape: 'ballista',
              hp: 620, atk: 52, range: 330, speed: 26, interval: 0.9, kb: 2, gold: 40, ranged: true },
  spider:   { name: '독거미', body: '#3f3348', accent: '#9de08e', tunic: '#2c2434', shape: 'spider',
              hp: 520, atk: 50, range: 62, speed: 100, interval: 0.8, kb: 2, gold: 26,
              ab: { poison: { dps: 26, dur: 4 }, slow: 1.2 }, abText:'독과 거미줄 · 정화로 해제' },
  shaman:   { name: '오크 주술사', body: '#4a6b46', accent: '#c98ae0', tunic: '#5a3a6b', shape: 'shaman',
              hp: 1150, atk: 58, range: 200, speed: 30, interval: 1.8, kb: 2, gold: 55, ranged: true,
              ab: { heal: 75, radius: 230, interval: 3 } },
  powder:   { name: '화약통 고블린', body: '#4d6b3a', accent: '#6e4a24', tunic: '#3f5a2f', shape: 'powder',
              hp: 860, atk: 290, range: 80, speed: 62, interval: 3.0, kb: 1, gold: 38,
              area: true, areaRadius: 100 },
  orcshield:{ name: '방패 오크', body: '#4a6b46', accent: '#7a5a3a', tunic: '#3d5a3a', shape: 'orcshield',
              hp: 5300, atk: 98, range: 62, speed: 22, interval: 1.6, kb: 1, gold: 48, scale: 1.15,
              ab: { kbImmune: true, armor: 0.15, thorns: 0.12 }, abText:'근접 피해 12% 반격 · 원거리 공격으로 대응' },
  wraith:   { name: '망령', body: '#8fa0b5', accent: '#5de0d0', tunic: '#6a7c92', shape: 'wraith',
              hp: 1020, atk: 118, range: 70, speed: 66, interval: 1.2, kb: 1, gold: 45,
              ab: { deathBomb: { dmg: 190, radius: 115 } } },
  dark:     { name: '흑기사', body: '#22242c', accent: '#8e2f3a', tunic: '#2f3038', shape: 'dark',
              hp: 3300, atk: 320, range: 90, speed: 34, interval: 1.9, kb: 1, gold: 60, scale: 1.1 },
  troll:    { name: '트롤 대장', body: '#5c7040', accent: '#3a2418', tunic: '#4a5c34', shape: 'troll',
              hp: 12500, atk: 610, range: 150, speed: 20, interval: 2.4, kb: 1, gold: 220,
              area: true, areaRadius: 130, scale: 1.7, boss: true,
              special: { t: 'meteor', name: '바위 투척', cd: 12, n: 2, dmg: 340,
                         radius: 110, warn: 1.1, kind: 'shockwave' },
              phases: [
                { at: 0.65, t: 'roar',   name: '대지 포효', r: 340, stun: 1.0, push: 70 },
                { at: 0.35, t: 'enrage', name: '피의 격노', atk: 1.3, rate: 0.75, speed: 1.3 },
                { at: 0.15, t: 'heal',   name: '트롤의 재생', ratio: 0.22 }
              ] },
  lich:     { name: '리치', body: '#d9d4c4', accent: '#6f4bb5', tunic: '#c4bfae', shape: 'lich',
              hp: 7000, atk: 430, range: 100, speed: 28, interval: 2.0, kb: 1, gold: 130,
              scale: 1.3, boss: true, ab: { summon: { id: 'goblin', n: 1 }, interval: 7 },
              special: { t: 'summon', name: '망자 소환', cd: 9, id: 'wraith', n: 1 },
              phases: [
                { at: 0.60, t: 'drain',  name: '생명 흡수', r: 320, dmg: 150, ratio: 0.7 },
                { at: 0.30, t: 'shield', name: '영혼 보호막', ratio: 0.2 },
                { at: 0.15, t: 'summon', name: '죽음의 군세', id: 'wraith', n: 3 }
              ] },
  frostgiant:{ name: '서리 거인', body: '#9fc6d8', accent: '#ffffff', tunic: '#7fa8bd', shape: 'frostgiant',
              hp: 16800, atk: 660, range: 165, speed: 18, interval: 2.6, kb: 1, gold: 300,
              area: true, areaRadius: 145, scale: 1.8, boss: true, ab: { slow: 3 },
              special: { t: 'frost', name: '한파', cd: 10, r: 420, dur: 4.5 },
              phases: [
                { at: 0.65, t: 'roar',   name: '얼음 포효', r: 360, stun: 1.2, push: 80 },
                { at: 0.35, t: 'meteor', name: '빙하 낙하', n: 3, dmg: 360, radius: 115,
                            warn: 1.1, stun: 0.6, kind: 'iceburst' },
                { at: 0.15, t: 'enrage', name: '서리의 분노', atk: 1.25, rate: 0.78, speed: 1.35 }
              ] },
  orcberserk:{ name: '오크 광전사', body: '#5a7a44', accent: '#c0392b', tunic: '#46603a', shape: 'orcberserk',
              hp: 2250, atk: 195, range: 66, speed: 78, interval: 0.9, kb: 2, gold: 52,
              ab: { enrage: 1.7 } },
  bat:      { name: '흡혈박쥐', body: '#4a3a52', accent: '#e04b6a', tunic: '#3a2c42', shape: 'bat',
              hp: 320, atk: 58, range: 60, speed: 120, interval: 0.6, kb: 3, gold: 20, scale: .8,
              ab: { lifesteal: 0.5 } },
  golem:    { name: '돌 골렘', body: '#8a8880', accent: '#5f5d56', tunic: '#767469', shape: 'golem',
              hp: 10200, atk: 390, range: 78, speed: 17, interval: 2.6, kb: 1, gold: 120, scale: 1.5,
              ab: { kbImmune: true, push: 30, armor: 0.25 } },
  totem:    { name: '저주 토템', body: '#6b4b2a', accent: '#c98ae0', tunic: '#4a3520', shape: 'totem',
              hp: 1800, atk: 0, range: 0, speed: 0, interval: 3, kb: 1, gold: 70,
              ab: { haste: { mul: 0.75, dur: 4 }, radius: 260, interval: 4, hold: true, noAttack: true } },
  drake:    { name: '화룡', body: '#a8382c', accent: '#ffb03c', tunic: '#7e2a20', shape: 'drake',
              hp: 18000, atk: 730, range: 200, speed: 22, interval: 2.4, kb: 1, gold: 420,
              area: true, areaRadius: 160, scale: 1.9, boss: true,
              ab: { burn: { dps: 90, dur: 5 } },
              special: { t: 'meteor', name: '화염 브레스', cd: 9, n: 3, dmg: 330, radius: 120,
                         warn: 1.0, burn: { dps: 70, dur: 4 }, kind: 'firestorm' },
              phases: [
                { at: 0.60, t: 'enrage', name: '분노의 불길', atk: 1.2, rate: 0.78 },
                { at: 0.35, t: 'roar',   name: '용의 포효', r: 380, stun: 1.1, push: 90 },
                { at: 0.15, t: 'meteor', name: '멸화', n: 5, dmg: 400, radius: 120, warn: 1.2,
                            burn: { dps: 90, dur: 4 }, kind: 'firestorm' }
              ] },
  orccatapult:{ name: '오크 투석기', body: '#5c4326', accent: '#3d2b18', tunic: '#6b4b2a', shape: 'orccatapult',
              hp: 1200, atk: 390, range: 430, speed: 14, interval: 3.4, kb: 1, gold: 90, ranged: true,
              area: true, areaRadius: 120, scale: 1.15 },
  warchief: { name: '오크 사령관', body: '#4a6b46', accent: '#c9a227', tunic: '#3d5a3a', shape: 'warchief',
              hp: 4600, atk: 315, range: 84, speed: 30, interval: 1.7, kb: 1, gold: 115, scale: 1.2,
              ab: { haste: { mul: 0.75, dur: 4 }, radius: 240, interval: 4 } },
  plaguer:  { name: '역병 술사', body: '#5a6b3a', accent: '#9de08e', tunic: '#3f4a2a', shape: 'plaguer',
              hp: 1450, atk: 120, range: 265, speed: 28, interval: 2.2, kb: 2, gold: 78, ranged: true,
              area: true, areaRadius: 95, ab: { poison: { dps: 72, dur: 5 } } },
  hellhound:{ name: '지옥견', body: '#3a2a2a', accent: '#ff8a3c', tunic: '#2a1e1e', shape: 'hellhound',
              hp: 1150, atk: 170, range: 64, speed: 115, interval: 0.8, kb: 3, gold: 62,
              ab: { burn: { dps: 62, dur: 3 } } },
  siegeram: { name: '파성추', body: '#6b4b2a', accent: '#8a8880', tunic: '#4a3520', shape: 'siegeram',
              hp: 12000, atk: 540, range: 74, speed: 16, interval: 2.4, kb: 1, gold: 155, scale: 1.5,
              ab: { kbImmune: true, armor: 0.35, push: 45 } },
  spiderqueen:{ name: '거미 여왕', body: '#3f2f4a', accent: '#c98ae0', tunic: '#2c2434', shape: 'spiderqueen',
              hp: 16500, atk: 470, range: 125, speed: 22, interval: 2.2, kb: 1, gold: 360,
              area: true, areaRadius: 115, scale: 1.75, boss: true,
              ab: { summon: { id: 'spider', n: 2 }, interval: 6, poison: { dps: 80, dur: 5 } },
              special: { t: 'summon', name: '알주머니', cd: 8, id: 'spider', n: 2 },
              phases: [
                { at: 0.65, t: 'meteor', name: '독액 분사', n: 3, dmg: 260, radius: 100,
                            warn: 0.9, kind: 'runes' },
                { at: 0.35, t: 'summon', name: '거미 떼', id: 'spider', n: 4 },
                { at: 0.15, t: 'enrage', name: '여왕의 광란', speed: 1.5, rate: 0.7, atk: 1.2 }
              ] },
  warlord:  { name: '오크 대군주', body: '#3f5a3c', accent: '#c0392b', tunic: '#2f4a2c', shape: 'warlord',
              hp: 22000, atk: 820, range: 180, speed: 17, interval: 2.6, kb: 1, gold: 600,
              area: true, areaRadius: 170, scale: 2.0, boss: true,
              ab: { push: 40, summon: { id: 'orcspear', n: 1 }, interval: 10, armor: 0.2 },
              special: { t: 'meteor', name: '대군주의 일격', cd: 11, n: 3, dmg: 420, radius: 120,
                         warn: 1.1, stun: 0.5, kind: 'shockwave' },
              phases: [
                { at: 0.75, t: 'summon', name: '친위대 소집', id: 'orcshield', n: 1 },
                { at: 0.50, t: 'roar',   name: '전장의 포효', r: 420, stun: 1.3, push: 100 },
                { at: 0.30, t: 'enrage', name: '대군주의 분노', atk: 1.25, rate: 0.8, speed: 1.25 },
                { at: 0.12, t: 'summon', name: '최후의 군세', id: 'orcberserk', n: 2 }
              ] },

  /* ---------------- 3막: 심연의 조수 ----------------
   * 오크 군단이 무너진 자리로 바다 밑에서 올라온 것들이 밀려든다.
   * 하나하나가 왕국군의 약점을 골라 때린다 — 뒷줄, 회복, 밀집, 강화. */
  ratling:  { name: '시궁쥐 떼', body: '#5b5147', accent: '#c4a15a', tunic: '#463e36', shape: 'ratling',
              hp: 300, atk: 46, range: 56, speed: 112, interval: 0.6, kb: 3, gold: 11, scale: .72,
              abText: '아주 빠르고 값싸다 · 범위 공격으로 쓸어라' },
  harpy:    { name: '하피 약탈자', body: '#6b5a72', accent: '#e8c46a', tunic: '#4a3c54', shape: 'harpy',
              hp: 1300, atk: 170, range: 74, speed: 110, interval: 0.85, kb: 3, gold: 58,
              ab: { backline: true, lifesteal: 0.25 },
              abText: '사거리 안 가장 뒤의 아군을 노린다 · 흡혈 25%' },
  banshee:  { name: '통곡의 밴시', body: '#b9c6d4', accent: '#7ce0d8', tunic: '#8ea2b8', shape: 'banshee',
              hp: 2100, atk: 125, range: 310, speed: 30, interval: 2.0, kb: 2, gold: 88, ranged: true,
              area: true, areaRadius: 90, ab: { weaken: { mul: 0.7, dur: 4 } },
              abText: '통곡을 맞은 아군은 피해 30% 감소 · 먼저 끊어라' },
  deepone:  { name: '심연 추종자', body: '#37605e', accent: '#8ef0c4', tunic: '#27484a', shape: 'deepone',
              hp: 1800, atk: 155, range: 64, speed: 88, interval: 1.0, kb: 2, gold: 72,
              ab: { poison: { dps: 74, dur: 4 } }, abText: '맹독 발톱 · 정화와 해독 훈련으로 버텨라' },
  bloodcultist:{ name: '피의 광신도', body: '#5a3a42', accent: '#e05a5a', tunic: '#3d272e', shape: 'bloodcultist',
              hp: 2400, atk: 95, range: 66, speed: 36, interval: 1.6, kb: 2, gold: 84,
              ab: { rally: { atk: 0.4, radius: 250 }, interval: 5, lifesteal: 0.3 },
              abText: '주변 적의 공격력 +40% · 후방 지원부터 잘라라' },
  ironmaul: { name: '강철 망치병', body: '#43474f', accent: '#cfd6de', tunic: '#33363d', shape: 'ironmaul',
              hp: 6800, atk: 340, range: 74, speed: 24, interval: 2.2, kb: 1, gold: 108, scale: 1.2,
              ab: { armor: 0.3, kbImmune: true, push: 30, stun: { chance: 0.3, dur: 0.7 } },
              abText: '방어 30% · 넉백 면역 · 30% 확률로 0.7초 기절' },
  tentacle: { name: '심연의 촉수', body: '#3d3358', accent: '#a86ae0', tunic: '#2b2440', shape: 'tentacle',
              hp: 3600, atk: 215, range: 345, speed: 0, interval: 1.8, kb: 1, gold: 92, ranged: true,
              ab: { hold: true, slow: 1.8 },
              abText: '땅에 박혀 멀리서 휘감는다 · 맞으면 둔화' },
  siegetower:{ name: '공성탑', body: '#5c4326', accent: '#8a8880', tunic: '#43301b', shape: 'siegetower',
              hp: 16000, atk: 300, range: 320, speed: 12, interval: 3.0, kb: 1, gold: 205, scale: 1.65,
              ranged: true, area: true, areaRadius: 110,
              ab: { kbImmune: true, armor: 0.25, summon: { id: 'orcspear', n: 2, max: 6 }, interval: 7 },
              abText: '넉백 면역 · 방어 25% · 7초마다 병력을 쏟아낸다' },

  hydra:    { name: '아홉머리 히드라', body: '#3f6b4a', accent: '#b6f07a', tunic: '#2f5238', shape: 'hydra',
              hp: 27000, atk: 700, range: 175, speed: 19, interval: 2.2, kb: 1, gold: 520,
              area: true, areaRadius: 150, scale: 1.9, boss: true,
              ab: { regen: 130, poison: { dps: 90, dur: 4 } },
              abText: '초당 130 재생 · 화상 중에는 재생 중단',
              special: { t: 'meteor', name: '삼중 독액', cd: 9, n: 3, dmg: 380, radius: 120,
                         warn: 1.0, kind: 'runes' },
              phases: [
                { at: 0.70, t: 'summon', name: '머리 분열', id: 'deepone', n: 2 },
                { at: 0.45, t: 'heal',   name: '재생의 늪', ratio: 0.18 },
                { at: 0.20, t: 'enrage', name: '아홉 겹 분노', atk: 1.3, rate: 0.72, speed: 1.3 }
              ] },
  leviathan:{ name: '심연의 레비아탄', body: '#2f5f7a', accent: '#7ce8ff', tunic: '#23485e', shape: 'leviathan',
              hp: 36000, atk: 900, range: 215, speed: 16, interval: 2.6, kb: 1, gold: 700,
              area: true, areaRadius: 185, scale: 2.0, boss: true,
              ab: { slow: 1.5, armor: 0.2 },
              abText: '맞은 아군은 둔화 · 방어 20% · 해일은 전장 절반을 얼린다',
              special: { t: 'frost', name: '해일', cd: 13, r: 380, dur: 3.0 },
              phases: [
                { at: 0.68, t: 'roar',   name: '심해의 포효', r: 400, stun: 1.2, push: 95 },
                { at: 0.42, t: 'meteor', name: '삼중 조수', n: 4, dmg: 400, radius: 125,
                            warn: 1.1, stun: 0.5, kind: 'iceburst' },
                { at: 0.18, t: 'enrage', name: '조수의 격노', atk: 1.3, rate: 0.75, speed: 1.35 }
              ] },
  abysslord:{ name: '심연왕', body: '#241f3a', accent: '#c46af0', tunic: '#1a1630', shape: 'abysslord',
              hp: 30000, atk: 1050, range: 200, speed: 16, interval: 2.5, kb: 1, gold: 1200,
              area: true, areaRadius: 195, scale: 2.2, boss: true,
              ab: { push: 45, summon: { id: 'deepone', n: 2, max: 6 }, interval: 9 },
              abText: '넉백 밀치기 · 9초마다 추종자 소환 · 촉수를 불러 세운다',
              special: { t: 'meteor', name: '심연의 손아귀', cd: 10, n: 4, dmg: 440, radius: 125,
                         warn: 1.05, stun: 0.6, kind: 'abyss' },
              phases: [
                { at: 0.78, t: 'summon', name: '촉수 소환', id: 'tentacle', n: 2 },
                { at: 0.55, t: 'roar',   name: '심연의 부름', r: 440, stun: 1.35, push: 105 },
                { at: 0.32, t: 'shield', name: '심해의 장막', ratio: 0.22 },
                { at: 0.14, t: 'enrage', name: '왕의 최후', atk: 1.3, rate: 0.75, speed: 1.3 }
              ] }
};

/* -------------------- 전장 20개 -------------------- */
function W(t, e, n, gap) { return { t: t, e: e, n: n || 1, gap: gap || 1.2 }; }

const STAGES = [
  { name: '국경 초소', baseHp: 2600, money: 180, rate: 26, reward: 60, waves: [
      W(1,'goblin',3,2.2), W(12,'goblin',4,1.8), W(24,'goblin',5,1.4) ] },
  { name: '밀밭 오솔길', baseHp: 3200, money: 190, rate: 27, reward: 70, waves: [
      W(1,'goblin',3,2.0), W(10,'orcspear',2,2.0), W(22,'goblin',4,1.5), W(32,'orcspear',3,1.6) ] },
  { name: '무너진 돌다리', baseHp: 3800, money: 200, rate: 28, reward: 80, waves: [
      W(2,'goblin',4,1.8), W(14,'orcspear',3,1.6), W(26,'ogre',1), W(36,'goblin',6,1.1) ] },
  { name: '늑대 골짜기', baseHp: 4400, money: 210, rate: 29, reward: 95, waves: [
      W(2,'goblin',3,1.6), W(11,'wolf',2,2.0), W(22,'orcspear',4,1.4), W(34,'wolf',3,1.4),
      W(46,'ogre',1) ] },
  { name: '★ 리치의 무덤가', baseHp: 5200, money: 240, rate: 31, reward: 160, boss: true, waves: [
      W(2,'goblin',4,1.6), W(14,'orcspear',3,1.5), W(26,'lich',1), W(30,'wolf',3,1.5),
      W(46,'ogre',2,3.0) ] },
  { name: '거미 굴', baseHp: 5600, money: 230, rate: 31, reward: 125, waves: [
      W(2,'orcspear',3,1.5), W(12,'spider',3,1.8), W(26,'goblin',6,1.0), W(38,'spider',4,1.6),
      W(52,'ogre',2,2.6) ] },
  { name: '석궁수의 언덕', baseHp: 6000, money: 235, rate: 32, reward: 135, waves: [
      W(2,'goblin',4,1.4), W(12,'ballista',2,2.4), W(24,'orcspear',4,1.4), W(38,'ballista',3,2.0),
      W(54,'wolf',4,1.2) ] },
  { name: '주술사의 야영지', baseHp: 6600, money: 245, rate: 33, reward: 155, waves: [
      W(2,'wolf',3,1.5), W(12,'shaman',1), W(24,'bat',5,1.0), W(38,'orcspear',5,1.2),
      W(52,'shaman',2,4.0), W(66,'spider',4,1.4), W(80,'ogre',2,3.0) ] },
  { name: '화약 골짜기', baseHp: 7200, money: 250, rate: 34, reward: 170, waves: [
      W(2,'goblin',5,1.3), W(12,'powder',2,3.0), W(26,'hellhound',3,1.6), W(42,'powder',3,2.4),
      W(58,'wolf',5,1.1), W(72,'ballista',3,1.8) ] },
  { name: '★ 트롤 대장의 요새', baseHp: 8600, money: 300, rate: 38, reward: 300, boss: true, waves: [
      W(2,'goblin',5,1.3), W(14,'ogre',2,2.6), W(28,'troll',1), W(34,'orcspear',5,1.3),
      W(50,'wolf',5,1.2), W(66,'shaman',2,3.5) ] },
  { name: '흑기사의 숲', baseHp: 9800, money: 300, rate: 39, reward: 210, waves: [
      W(2,'orcspear',5,1.2), W(14,'dark',1), W(28,'orcberserk',2,2.6), W(44,'plaguer',2,3.0),
      W(60,'dark',2,3.5), W(76,'ballista',4,1.6), W(92,'bat',7,0.8) ] },
  { name: '망령의 폐허', baseHp: 10800, money: 310, rate: 41, reward: 230, waves: [
      W(2,'wolf',5,1.0), W(14,'wraith',2,2.6), W(24,'totem',1), W(34,'orccatapult',1),
      W(48,'wraith',3,2.4), W(64,'plaguer',3,2.2), W(80,'orcberserk',3,2.2),
      W(96,'hellhound',5,1.2) ] },
  { name: '리치의 재림', baseHp: 11000, money: 330, rate: 42, reward: 260, boss: true, waves: [
      W(2,'goblin',6,1.1), W(14,'lich',1), W(20,'orcspear',5,1.2), W(36,'lich',1),
      W(50,'warchief',1), W(64,'powder',4,2.0), W(82,'dark',3,3.0) ] },
  { name: '방패벽 관문', baseHp: 12000, money: 340, rate: 44, reward: 285, waves: [
      W(2,'orcshield',2,3.0), W(16,'ballista',4,1.5), W(30,'golem',1), W(44,'siegeram',1),
      W(60,'orcshield',3,2.6), W(76,'wolf',7,0.9), W(92,'shaman',3,3.0), W(110,'dark',3,2.6) ] },
  { name: '★ 거대 트롤의 문', baseHp: 13000, money: 360, rate: 46, reward: 420, boss: true, waves: [
      W(2,'goblin',6,1.1), W(14,'troll',1), W(24,'orcspear',6,1.1), W(40,'troll',1),
      W(52,'warchief',1), W(66,'dark',3,2.6), W(84,'orccatapult',2,4.0), W(102,'powder',5,1.8) ] },
  { name: '역병의 늪', baseHp: 20000, money: 370, rate: 48, reward: 330, waves: [
      W(2,'spider',7,0.9), W(14,'totem',2,6.0), W(24,'spiderqueen',1), W(42,'plaguer',4,2.2),
      W(58,'bat',9,0.7), W(74,'orcshield',4,2.0), W(92,'wraith',5,1.8), W(108,'golem',1),
      W(124,'lich',1) ] },
  { name: '★ 서리 거인의 고개', baseHp: 22500, money: 390, rate: 50, reward: 480, boss: true, waves: [
      W(2,'orcspear',6,1.1), W(16,'orccatapult',2,4.0), W(32,'frostgiant',1), W(46,'wolf',7,0.9),
      W(62,'siegeram',1), W(78,'orcshield',3,2.4), W(96,'dark',4,2.4), W(114,'frostgiant',1),
      W(130,'orcberserk',5,1.4) ] },
  { name: '★ 화룡의 둥지', baseHp: 27000, money: 400, rate: 52, reward: 520, boss: true, waves: [
      W(2,'goblin',8,0.9), W(14,'orcberserk',3,2.0), W(30,'drake',1), W(46,'warchief',1),
      W(60,'orcshield',4,1.8), W(76,'orccatapult',2,3.5), W(94,'golem',1), W(112,'hellhound',7,1.0),
      W(130,'drake',1), W(150,'dark',5,1.8) ] },
  { name: '대군주의 전조', baseHp: 26000, money: 420, rate: 54, reward: 470, boss: true, waves: [
      W(2,'wolf',7,0.9), W(16,'frostgiant',1), W(30,'spiderqueen',1), W(48,'troll',1),
      W(62,'siegeram',1), W(78,'warchief',2,5.0), W(96,'orcshield',4,2.2), W(116,'plaguer',5,1.8),
      W(136,'golem',1), W(156,'drake',1) ] },
  { name: '★ 오크 대군주의 왕좌', baseHp: 30000, money: 460, rate: 58, reward: 900, boss: true, waves: [
      W(2,'goblin',8,0.9), W(14,'orcshield',3,1.8), W(30,'troll',1), W(46,'warchief',2,4.0),
      W(62,'warlord',1), W(86,'siegeram',1), W(106,'orccatapult',2,3.0),
      W(126,'drake',1), W(150,'orcberserk',5,1.2), W(172,'spiderqueen',1),
      W(194,'wraith',7,0.9), W(216,'golem',2,6.0) ] }
];

/* 1막 난이도 곡선. 초반은 기본 병종으로 넘어가야 하니 거의 건드리지 않고,
 * 뒤로 갈수록 같은 적이 더 억세진다. */
STAGES.forEach((st, i) => { if (!st.enemyMul) st.enemyMul = +(1 + 0.02 * i + 0.0016 * i * i).toFixed(3); });

/* 2막: 기존 20전장 인덱스는 유지하여 저장과 별 기록을 보존한다. */
const ENDLESS_UNLOCK_STAGE = 20;
STAGES.push(
  {name:'검은 강의 나루',hint:'망령 폭발에 대비해 전열을 분산',baseHp:32000,money:400,rate:48,reward:960,enemyMul:1.62,waves:[
    W(2,'orcspear',7,1),W(18,'wraith',5,2),W(38,'dark',3,3),W(58,'lich',1),W(80,'wolf',8,1),W(104,'wraith',6,1.6),W(130,'golem',2,5),W(154,'orcshield',5,2),W(180,'lich',1)]},
  {name:'망자의 행렬',hint:'소환 병력은 관통과 범위 공격으로 처리',baseHp:33500,money:405,rate:49,reward:1020,boss:true,enemyMul:1.77,waves:[
    W(2,'orcshield',3,2),W(20,'lich',1),W(40,'plaguer',5,2),W(60,'wraith',6,1.4),W(84,'lich',1),W(108,'dark',5,2),W(134,'totem',2,4),W(158,'lich',1),W(182,'orcberserk',7,1)]},
  {name:'가시 왕관의 성문',hint:'가시 반격은 원거리 병종으로 대응',baseHp:35000,money:410,rate:50,reward:1100,enemyMul:1.94,waves:[
    W(2,'orcshield',4,2),W(22,'shaman',3,3),W(44,'golem',2,5),W(66,'siegeram',2,5),W(92,'orcshield',5,2),W(116,'ballista',5,2),W(140,'warchief',2,5),W(168,'dark',6,2),W(196,'troll',1)]},
  {name:'★ 명계의 삼중 봉인',hint:'근접 벽 뒤에서 해골을 부르는 리치를 먼저 노려라',baseHp:38000,money:420,rate:51,reward:1350,boss:true,enemyMul:3.2,waves:[
    W(2,'wraith',5,2),W(24,'lich',1),W(48,'spiderqueen',1),W(70,'plaguer',6,1.8),W(96,'troll',1),W(122,'lich',1),W(148,'orcshield',5,2),W(174,'spiderqueen',1),W(204,'wraith',8,1)]},
  {name:'눈보라 추격전',hint:'빠른 늑대 기수를 둔화로 저지',baseHp:39500,money:425,rate:52,reward:1250,enemyMul:2.29,waves:[
    W(2,'wolf',10,.8),W(24,'dark',5,2),W(48,'frostgiant',1),W(72,'wolf',10,.8),W(96,'orccatapult',2,5),W(120,'orcberserk',7,1.2),W(148,'frostgiant',1),W(180,'golem',2,5),W(208,'wolf',12,.7)]},
  {name:'얼어붙은 공성로',hint:'공성 병기를 막을 보호막 전열 필요',baseHp:41000,money:430,rate:53,reward:1320,enemyMul:2.46,waves:[
    W(2,'orcshield',4,2),W(22,'siegeram',2,5),W(46,'ballista',6,2),W(72,'frostgiant',1),W(100,'orcshield',6,1.8),W(126,'orccatapult',3,5),W(154,'warchief',2,5),W(184,'frostgiant',1),W(214,'dark',7,1.8)]},
  {name:'★ 영원의 겨울 왕좌',hint:'연속 광역 공격 뒤 왕명으로 회복',baseHp:44000,money:440,rate:54,reward:1600,boss:true,enemyMul:6.2,waves:[
    W(2,'wolf',8,1),W(24,'frostgiant',1),W(52,'troll',1),W(78,'orcshield',6,1.8),W(104,'frostgiant',1),W(136,'golem',2,5),W(164,'warchief',2,5),W(192,'frostgiant',1),W(224,'orcberserk',8,1)]},
  {name:'불타는 태양 회랑',hint:'화상을 정화하며 화룡을 견제',baseHp:45500,money:445,rate:55,reward:1500,enemyMul:3.3,waves:[
    W(2,'hellhound',9,.8),W(26,'powder',6,1.8),W(52,'drake',1),W(80,'plaguer',6,2),W(108,'orcshield',6,1.8),W(138,'drake',1),W(170,'hellhound',10,.8),W(200,'siegeram',2,4),W(230,'dark',7,1.5)]},
  {name:'황금 일식의 제단',hint:'치유·가속 토템을 범위 공격으로 압박',baseHp:47500,money:450,rate:56,reward:1650,boss:true,enemyMul:3.05,waves:[
    W(2,'orcshield',5,2),W(26,'totem',2,6),W(50,'shaman',5,3),W(78,'warlord',1),W(108,'golem',2,5),W(140,'drake',1),W(174,'warchief',3,5),W(208,'orcberserk',8,1),W(240,'lich',2,8)]},
  {name:'★ 세 신화의 종착지',hint:'원거리 호위를 먼저 걷어 내고, 대군주에게 액티브와 왕명을 몰아 쓰라',baseHp:51000,money:465,rate:58,reward:2200,boss:true,enemyMul:3.8,waves:[
    W(2,'orcshield',5,2),W(26,'lich',1),W(52,'frostgiant',1),W(82,'drake',1),W(114,'warlord',1),W(148,'warchief',2,5),W(182,'spiderqueen',1),W(216,'golem',3,5),W(248,'warlord',1),W(276,'hellhound',10,.8)]}
);

/* 3막: 심연의 조수 (31~40전장).
 * 오크 군단을 밀어낸 자리로 바다 밑의 것들이 올라온다. 여기서부터는
 * 스탯을 쌓는 것만으로는 안 되고, 전장 특성마다 받아칠 병종을 챙겨야 한다. */
STAGES.push(
  {name:'조수가 삼킨 해안',hint:'쥐 떼는 범위 공격으로 한 번에 쓸어라',baseHp:300000,money:470,rate:59,reward:2300,enemyMul:3.6,waves:[
    W(2,'ratling',10,.7),W(12,'deepone',5,1.4),W(24,'harpy',4,1.6),W(38,'ratling',14,.6),W(52,'orcshield',5,2),W(66,'deepone',7,1.2),W(82,'banshee',3,3),W(98,'harpy',6,1.2),W(114,'ironmaul',2,4),W(132,'deepone',9,1),W(150,'ratling',18,.55),W(168,'harpy',8,1)]},
  {name:'통곡하는 등대',hint:'밴시의 통곡은 아군 피해를 깎는다 — 먼저 끊어라',baseHp:300000,money:475,rate:60,reward:2400,enemyMul:3.2,waves:[
    W(2,'deepone',6,1.2),W(14,'banshee',3,2.6),W(28,'harpy',5,1.4),W(42,'ironmaul',2,4),W(58,'banshee',4,2.4),W(74,'tentacle',2,5),W(90,'wraith',8,1.2),W(106,'banshee',5,2.2),W(124,'ironmaul',3,3.5),W(142,'harpy',8,1),W(160,'banshee',6,2),W(180,'deepone',10,1)]},
  {name:'★ 아홉머리의 늪',hint:'히드라는 재생한다 — 화상으로 재생을 끊고 몰아쳐라',baseHp:330000,money:480,rate:61,reward:2900,boss:true,enemyMul:2.9,waves:[
    W(2,'ratling',12,.7),W(14,'deepone',6,1.2),W(30,'hydra',1),W(48,'plaguer',6,2),W(64,'deepone',8,1.1),W(80,'tentacle',2,5),W(98,'ironmaul',3,3.5),W(116,'banshee',4,2.4),W(134,'bloodcultist',3,3),W(154,'deepone',10,1),W(174,'ironmaul',4,3)]},
  {name:'가라앉은 성채',hint:'공성탑이 병력을 토해낸다 — 탑을 먼저 부수는 편이 빠르다',baseHp:330000,money:485,rate:62,reward:2700,enemyMul:3.2,waves:[
    W(2,'orcshield',5,2),W(14,'siegetower',1),W(30,'ironmaul',3,3.5),W(46,'ballista',6,1.8),W(62,'siegetower',1),W(78,'deepone',8,1.1),W(96,'golem',3,4),W(114,'siegetower',1),W(132,'ironmaul',4,3),W(152,'ballista',8,1.5),W(172,'golem',3,4)]},
  {name:'피의 제단',hint:'광신도가 주변 적을 강화한다 — 후열부터 도려내라',baseHp:350000,money:490,rate:63,reward:2850,enemyMul:3.1,waves:[
    W(2,'bloodcultist',3,3),W(14,'orcberserk',8,1),W(30,'bloodcultist',4,2.6),W(46,'hellhound',9,.9),W(62,'ironmaul',3,3.5),W(80,'bloodcultist',5,2.4),W(98,'dark',7,1.6),W(116,'harpy',7,1.1),W(134,'warchief',3,4),W(154,'bloodcultist',6,2.2),W(174,'orcberserk',10,.9)]},
  {name:'★ 레비아탄의 해구',hint:'해일이 오면 둔화가 겹친다 — 넉백 면역 앞줄로 버텨라',baseHp:300000,money:495,rate:64,reward:3300,boss:true,enemyMul:2.6,waves:[
    W(2,'deepone',7,1.2),W(14,'tentacle',2,5),W(32,'leviathan',1),W(50,'banshee',4,2.4),W(66,'ironmaul',3,3.5),W(84,'harpy',7,1.1),W(102,'siegetower',1),W(120,'deepone',9,1),W(140,'bloodcultist',4,2.6),W(160,'ironmaul',4,3),W(180,'harpy',9,1)]},
  {name:'숨 막히는 안개 습지',hint:'독무가 전군을 좀먹는다 — 치유와 재생 없이는 못 버틴다',baseHp:360000,money:500,rate:65,reward:3200,enemyMul:2.9,waves:[
    W(2,'ratling',14,.6),W(14,'plaguer',6,2),W(30,'deepone',9,1),W(46,'hydra',1),W(64,'tentacle',3,4),W(82,'banshee',5,2.2),W(100,'ironmaul',4,3),W(118,'ratling',18,.55),W(136,'bloodcultist',5,2.4),W(156,'plaguer',8,1.8),W(176,'deepone',12,.9)]},
  {name:'번개 치는 난바다',hint:'폭풍이 화살을 밀어낸다 — 근접 주력으로 짜라',baseHp:380000,money:505,rate:66,reward:3400,enemyMul:3,waves:[
    W(2,'harpy',7,1.1),W(14,'wolf',12,.7),W(30,'ironmaul',4,3),W(48,'leviathan',1),W(66,'harpy',9,1),W(84,'orcberserk',10,.9),W(102,'siegetower',1),W(120,'ironmaul',5,2.6),W(140,'hellhound',12,.8),W(160,'harpy',11,.9),W(180,'ironmaul',6,2.4)]},
  {name:'★ 심연의 관문',hint:'간조로 카드가 늦게 돌아온다 — 오래 버티는 병종을 아껴 써라',baseHp:200000,money:540,rate:70,reward:3800,boss:true,enemyMul:1.75,waves:[
    W(2,'orcshield',6,1.8),W(14,'tentacle',3,4),W(32,'abysslord',1),W(52,'banshee',5,2.2),W(70,'ironmaul',4,3),W(88,'siegetower',1),W(106,'deepone',10,1),W(124,'golem',3,4),W(144,'bloodcultist',5,2.4),W(164,'ironmaul',6,2.4),W(184,'banshee',7,1.8)]},
  {name:'★ 심연왕의 옥좌',hint:'모든 특성이 한꺼번에 걸린다 — 특성마다 하나씩 답을 챙겨 와라',baseHp:230000,money:560,rate:72,reward:5000,boss:true,enemyMul:1.8,waves:[
    W(2,'ratling',16,.6),W(16,'hydra',1),W(34,'leviathan',1),W(54,'siegetower',1),W(72,'abysslord',1),W(92,'bloodcultist',6,2.2),W(110,'ironmaul',5,2.6),W(128,'banshee',6,2),W(146,'harpy',10,.9),W(166,'tentacle',3,4),W(186,'deepone',12,.9),W(206,'ironmaul',7,2.2)]}
);


/* 전장 특성. 어려운 전장에는 특성이 붙어서, 스탯 높은 병종을 몰아 넣는 것만으로는
 * 풀리지 않고 그 특성을 받아칠 병종을 챙겨야 한다. */
const STAGE_MODS = {
  ironclad: { name: '중갑', desc: '모든 적이 방어 60% — 받는 피해가 크게 준다 (중독·화상은 그대로)',
              counter: '토르(파쇄) · 중독 · 화상 · 태양 낙인', color: '#8fa3b5' },
  horde:    { name: '물량', desc: '적이 1.8배 많이 몰려온다 (하나하나는 약하다)',
              counter: '범위 공격 · 연쇄 번개 · 값싼 방패 벽', color: '#c98a4b' },
  giantslayer: { name: '영웅 사냥꾼', desc: '적이 비용 350 이상인 아군(영웅·전설·신화)에게 3배 피해',
              counter: '값싼 병력을 많이 · 소환물 · 비싼 병종은 뒤에', color: '#9b6bd1' },
  curse:    { name: '저주', desc: '소환된 아군이 초당 10%씩 시들고, 회복·흡혈이 절반',
              counter: '소환·치유에 기대지 않는 진짜 병력', color: '#5f8f5a' },
  blitz:    { name: '질주', desc: '적 이동 속도 +45% · 공격 속도 +20%',
              counter: '둔화 · 넉백 면역 방패 · 튼튼한 앞줄', color: '#d0605a' },
  venomfog: { name: '독무', desc: '아군 전원이 초당 26 피해를 계속 받는다 (정화로는 못 걷는다)',
              counter: '치유 · 재생 · 해독 훈련 · 체력 큰 병종', color: '#7fbf3f' },
  stormfront:{ name: '폭풍 전선', desc: '아군 원거리 사거리 28% 감소 (사거리 150 초과 병종)',
              counter: '근접 주력 · 단단한 앞줄 · 사거리에 기대지 않는 편성', color: '#6fa8d0' },
  lowtide:  { name: '간조', desc: '아군 재출진 대기 +45%',
              counter: '병참 강화 · 값싼 병종 · 한 번에 오래 버티는 병종', color: '#4fb8a8' }
};
const HARD_STAGE_MODS = {
  9: ['ironclad'], 14: ['blitz'], 16: ['horde'], 17: ['ironclad', 'giantslayer'],
  19: ['horde', 'ironclad'],
  21: ['horde'], 23: ['horde', 'giantslayer', 'curse'], 24: ['blitz'], 26: ['blitz', 'giantslayer', 'curse'],
  27: ['horde', 'ironclad'], 29: ['giantslayer', 'curse', 'horde', 'blitz'],
  // 3막. 특성이 매 전장에 붙고, 마지막은 여섯 가지가 한꺼번에 걸린다.
  30: ['horde'], 31: ['stormfront'], 32: ['venomfog'], 33: ['lowtide', 'horde'],
  34: ['giantslayer', 'blitz'], 35: ['ironclad', 'blitz'], 36: ['venomfog', 'horde', 'curse'],
  37: ['stormfront', 'giantslayer'], 38: ['lowtide', 'ironclad'],
  39: ['venomfog', 'stormfront', 'lowtide', 'ironclad', 'giantslayer', 'horde']
};
STAGES.forEach((st, i) => { if (!st.mods && HARD_STAGE_MODS[i]) st.mods = HARD_STAGE_MODS[i]; });
// 전설·신화 풀이 넓어질수록 몰아 넣기만 한 편성도 두루 갖춘다. 조합이 필요한
// 1막 전장은 적 배율을 따로 올려 둔다.
STAGES[15].enemyMul = 1.85;             // 끼어 있던 보스 둘이 정예로 바뀐 만큼
STAGES[16].enemyMul = 1.65;
STAGES[17].enemyMul = 1.6;
STAGES[19].enemyMul = 1.85;

/* ------------------------------------------------------------------
 *  보스는 전장마다 하나.
 *  예전엔 한 전장에 보스가 여럿 몰려나왔다. 이제 보스 전장에는 그 전장을
 *  대표하는 보스 하나만, 대신 훨씬 강하게 나온다. 빠진 보스 자리는 그 보스가
 *  못 하는 쪽을 채워 주는 잡몹 무리가 메운다:
 *   - 근접 거구(트롤·서리 거인·대군주) → 뒤에서 쏘는 원거리 다수 + 빠른 근접 몇
 *   - 뒤에 서는 소환사(리치·거미 여왕) → 앞을 막는 근접 벽 + 원거리 조금
 *   - 불 뿜는 화룡 → 단단한 앞줄 + 빠른 근접 + 원거리 조금
 *  보스 전장이 아닌 곳에 끼어 있던 보스는 정예 잡몹으로 바꾼다.
 * ------------------------------------------------------------------ */
const BOSS_ROLE = { troll: 'bruiser', frostgiant: 'bruiser', warlord: 'bruiser',
                    lich: 'caster', spiderqueen: 'caster', drake: 'flyer',
                    hydra: 'caster', leviathan: 'bruiser', abysslord: 'bruiser' };
const BOSS_ESCORT = {
  bruiser: { back: ['ballista', 'shaman', 'plaguer', 'orccatapult', 'banshee', 'siegetower'], front: ['wolf', 'hellhound', 'orcspear', 'harpy'], nb: 4, nf: 2 },
  caster:  { back: ['ballista', 'plaguer', 'banshee'], front: ['orcshield', 'orcspear', 'orcberserk', 'dark', 'ironmaul', 'deepone'], nb: 2, nf: 4 },
  flyer:   { back: ['shaman', 'ballista', 'banshee'], front: ['orcshield', 'hellhound', 'orcberserk', 'golem', 'ironmaul'], nb: 2, nf: 3 }
};
/* 전장 번호(0부터) → 그 전장의 보스 */
const STAGE_BOSS = { 4: 'lich', 9: 'troll', 12: 'lich', 14: 'troll', 16: 'frostgiant', 17: 'drake',
                     18: 'spiderqueen', 19: 'warlord', 21: 'lich', 23: 'lich', 26: 'frostgiant',
                     28: 'drake', 29: 'warlord',
                     32: 'hydra', 35: 'leviathan', 38: 'abysslord', 39: 'abysslord' };
const ELITE_FOR = { troll: ['ogre', 1], lich: ['shaman', 2], frostgiant: ['golem', 1],
                    drake: ['hellhound', 3], spiderqueen: ['spider', 4], warlord: ['warchief', 1],
                    hydra: ['deepone', 3], leviathan: ['ironmaul', 2], abysslord: ['tentacle', 2] };
const BOSS_HP_MUL = 2.5;       // 하나뿐인 보스는 그만큼 단단하다
const BOSS_ATK_MUL = 1.2;
(function oneBossPerStage() {
  // 잡몹은 원래 처음 나오던 전장 즈음부터만 쓴다 (1전장에 투석기가 나오면 안 된다)
  const first = {};
  STAGES.forEach((st, i) => st.waves.forEach(w => { if (first[w.e] === undefined) first[w.e] = i; }));
  STAGES.forEach((st, i) => {
    const sig = STAGE_BOSS[i];
    const bossWaves = st.waves.filter(w => ENEMIES[w.e].boss);
    if (!sig && !bossWaves.length) return;
    const out = st.waves.filter(w => !ENEMIES[w.e].boss);
    const last = st.waves.reduce((m, w) => Math.max(m, w.t), 0);
    const ok = id => first[id] !== undefined && first[id] <= i + 1;
    const pick = (list, k) => { const c = list.filter(ok); return c.length ? c[k % c.length] : 'orcspear'; };
    if (sig) {
      const esc = BOSS_ESCORT[BOSS_ROLE[sig]];
      // 호위 규모: 앞 전장은 절반, 뒤로 갈수록 제 크기
      const grow = 0.5 + 0.5 * Math.min(1, i / 29);
      const nb = Math.max(2, Math.round(esc.nb * grow)), nf = Math.max(1, Math.round(esc.nf * grow));
      bossWaves.slice(1).forEach((w, k) => {              // 빠진 두 번째 보스부터 → 보스를 받쳐 줄 무리
        out.push(W(w.t, pick(esc.back, k + 1), Math.max(2, nb - 1), 1.3));
        out.push(W(w.t + 3, pick(esc.front, k + 1), Math.max(1, nf - 1), 1.1));
      });
      const firstT = bossWaves.length ? bossWaves[0].t : 0;
      const tb = Math.round(Math.max(firstT, last * 0.35, 20));
      out.push(W(tb, sig, 1));
      out.push(W(tb + 1, pick(esc.back, 0), nb, 1.2));      // 보스와 함께 오는 호위
      out.push(W(tb + 2, pick(esc.front, 0), nf, 1.0));
      st.bossId = sig;
      st.bossRole = BOSS_ROLE[sig];
    } else {
      bossWaves.forEach(w => { const el = ELITE_FOR[w.e]; out.push(W(w.t, el[0], el[1], 1.6)); });
    }
    st.waves = out.sort((a, b) => a.t - b.t);
  });
})();

/* 전장 길이. 예전엔 모두 2000 이라 병사가 적과 부딪히기까지 40초 넘게 걸어야 했다.
 * 초반은 짧게 붙고, 뒤로 갈수록·보스 전장일수록 조금씩 길어진다. */
STAGES.forEach((st, i) => {
  if (st.len) return;
  // 레벨마다 조금씩 다르게: 뒤로 갈수록 길어지되, 사이사이 짧은 전장이 섞인다
  const wiggle = [0, -70, 50, -40, 80][i % 5];
  const base = i < 20 ? 900 + 20 * i
             : i < 30 ? 1180 + 18 * (i - 20)
             : 1330 + 8 * (i - 30);        // 3막은 이미 길다. 더 늘리면 걷기만 한다.
  st.len = base + wiggle + (st.boss ? 120 : 0);
});

/* =======================================================================
 *  무한 전장 - 끝없이 밀려오는 웨이브
 * ======================================================================= */
const ENDLESS_POOL = [
  { id: 'goblin',   from: 0 },  { id: 'orcspear', from: 0 },
  { id: 'wolf',     from: 2 },  { id: 'spider',   from: 3 },
  { id: 'bat',      from: 4 },  { id: 'ogre',     from: 4 },
  { id: 'ballista', from: 5 },  { id: 'shaman',   from: 6 },
  { id: 'powder',   from: 7 },  { id: 'orcshield',from: 8 },
  { id: 'orcberserk', from: 9 },{ id: 'wraith',   from: 10 },
  { id: 'dark',     from: 11 }, { id: 'golem',    from: 13 },
  { id: 'totem',    from: 14 },
  // 3막 잡몹도 무한 전장 후반에 섞인다
  { id: 'ratling',  from: 5 },  { id: 'harpy',    from: 9 },
  { id: 'deepone',  from: 11 }, { id: 'banshee',  from: 12 },
  { id: 'bloodcultist', from: 15 }, { id: 'ironmaul', from: 16 },
  { id: 'plaguer',  from: 12 }, { id: 'hellhound', from: 10 }
];
const ENDLESS_BOSSES = ['lich', 'troll', 'frostgiant', 'drake', 'warlord',
                        'hydra', 'spiderqueen', 'leviathan', 'abysslord'];

/* 무한 전장 적 배율. 웨이브마다 7%씩 붙고, 25웨이브를 넘기면 거기에
 * 웨이브당 4%씩 곱으로 불어난다. 상한이 없으니 언젠가는 반드시 무너진다. */
function endlessMul(w) {
  return (1 + 0.07 * w) * Math.pow(1.04, Math.max(0, w - 25));
}

/* 무한 전장 w 번째 웨이브(0부터). t 초에 시작한다.
 * 적 종류는 웨이브가 지날수록 넓어지고, 5웨이브마다 보스가 함께 온다. */
function endlessWave(w, t) {
  const tier = Math.floor(w / 2);
  const pool = ENDLESS_POOL.filter(e => e.from <= tier);
  const pick = pool[(w * 7 + 3) % pool.length].id;
  const n = 3 + Math.min(9, Math.floor(w / 2));
  const gap = Math.max(0.55, 1.6 - w * 0.03);
  const mul = endlessMul(w);
  const waves = [Object.assign(W(t, pick, n, gap), { wave: w, mul: mul })];
  if ((w + 1) % 5 === 0) {
    const bi = (Math.floor((w + 1) / 5) - 1) % ENDLESS_BOSSES.length;
    waves.push(Object.assign(W(t + 4, ENDLESS_BOSSES[bi], 1), { wave: w, mul: mul }));
  }
  return { waves: waves, next: t + Math.max(7, 16 - w * 0.25) };
}

/* 무한 전장. 웨이브 수를 주면 그만큼 미리 적어 두고(검사용),
 * 안 주면 끝없이 이어진다 — 엔진이 모자랄 때마다 endlessWave 로 더 붙인다. */
function makeEndlessStage(waveCount) {
  const waves = [];
  let t = 2;
  for (let w = 0; w < (waveCount || 0); w++) {
    const spec = endlessWave(w, t);
    spec.waves.forEach(x => waves.push(x));
    t = spec.next;
  }
  return {
    name: '무한 전장', endless: true, infinite: !waveCount, len: 1250,
    baseHp: 99999999,          // 적 요새는 부술 수 없다. 버티는 것이 전부다
    money: 320, rate: 40, reward: 0,
    waves: waves
  };
}

/* =======================================================================
 *  일일 임무 / 업적
 * ======================================================================= */
const MISSION_DEFS = [
  { id: 'kill60',  text: '적 60명 처치',        need: 60, stat: 'kills',   gold: 400, stone: 1 },
  { id: 'kill150', text: '적 150명 처치',       need: 150, stat: 'kills',  gold: 900, stone: 1 },
  { id: 'win2',    text: '전장 2회 승리',       need: 2,  stat: 'wins',    gold: 500, stone: 1 },
  { id: 'win4',    text: '전장 4회 승리',       need: 4,  stat: 'wins',    gold: 1100, stone: 1 },
  { id: 'star3',   text: '별 3개로 승리 1회',   need: 1,  stat: 'perfect', gold: 700, stone: 1 },
  { id: 'pull3',   text: '소환 3회',            need: 3,  stat: 'pulls',   gold: 300, stone: 1 },
  { id: 'cmd2',    text: '왕의 명령 2회 사용',  need: 2,  stat: 'commands',gold: 400, stone: 1 },
  { id: 'train2',  text: '병종 훈련 2회',       need: 2,  stat: 'trains',  gold: 350, stone: 1 },
  { id: 'boss1',   text: '보스 1체 처치',       need: 1,  stat: 'bosses',  gold: 600, stone: 1 },
  { id: 'endless5',text: '무한 전장 5웨이브 돌파', need: 5,  stat: 'endless', gold: 800, stone: 1 }
];
const DAILY_COUNT = 3;

/* 날짜로 고정된 3개를 고른다. 같은 날이면 항상 같은 임무가 나온다. */
function dailyMissionIds(dateKey) {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  const ids = [];
  const pool = MISSION_DEFS.slice();
  for (let i = 0; i < DAILY_COUNT && pool.length; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    ids.push(pool.splice(h % pool.length, 1)[0].id);
  }
  return ids;
}
function missionById(id) {
  for (const m of MISSION_DEFS) if (m.id === id) return m;
  return null;
}

const ACHIEVEMENTS = [
  { id: 'first',    name: '첫 승리',      desc: '전장을 하나 돌파한다',        gold: 200,  stone: 1,
    test: s => s.cleared >= 1 },
  { id: 'clear5',   name: '국경 수호',    desc: '5전장 돌파',                  gold: 500,  stone: 1,
    test: s => s.cleared >= 5 },
  { id: 'clear10',  name: '왕국의 방패',  desc: '10전장 돌파',                 gold: 1200, stone: 2,
    test: s => s.cleared >= 10 },
  { id: 'clear20',  name: '대군주 토벌',  desc: '20전장 전부 돌파',            gold: 4000, stone: 5,
    test: s => s.cleared >= 20 },
  { id: 'star30',   name: '별 수집가',    desc: '별 30개 획득',                gold: 1500, stone: 2,
    test: s => totalStars(s) >= 30 },
  { id: 'star60',   name: '완전 제압',    desc: '별 60개 획득',                gold: 6000, stone: 8,
    test: s => totalStars(s) >= 60 },
  { id: 'star120',  name: '흠 없는 진군',  desc: '모든 전장 별 3개',            gold: 12000, stone: 15,
    test: s => totalStars(s) >= 120 },
  { id: 'kill1000', name: '천 명의 적',   desc: '누적 1000 처치',              gold: 1000, stone: 1,
    test: s => (s.totalKills || 0) >= 1000 },
  { id: 'kill5000', name: '전장의 주인',  desc: '누적 5000 처치',              gold: 3000, stone: 3,
    test: s => (s.totalKills || 0) >= 5000 },
  { id: 'summon10', name: '제단의 손님',  desc: '소환 10회',                   gold: 500,  stone: 1,
    test: s => (s.pulls || 0) >= 10 },
  { id: 'summon100',name: '제단의 단골',  desc: '소환 100회',                  gold: 3000, stone: 3,
    test: s => (s.pulls || 0) >= 100 },
  { id: 'legend',   name: '신화의 계약',  desc: '전설 이상 병종 보유',              gold: 2000, stone: 2,
    test: s => SEASON_UNITS.some(u => (u.rarity === 'SSR' || u.rarity === 'UR') && s.owned && s.owned[u.id]) },
  { id: 'allseason',name: '모든 신화',    desc: '모든 시즌에서 전설 이상을 각각 보유',   gold: 8000, stone: 10,
    test: s => SEASONS.every(sn => sn.units.some(id => {
      const u = UNIT_BY_ID[id];
      return u && (u.rarity === 'SSR' || u.rarity === 'UR') && s.owned && s.owned[id];
    })) },
  { id: 'maxlv',    name: '정예 조련',    desc: '병종 하나를 15레벨로',        gold: 2500, stone: 3,
    test: s => Object.keys(s.levels || {}).some(k => s.levels[k] >= 15) },
  { id:'campaign30',name:'세 신화의 정복자',desc:'30전장 모두 돌파',gold:5000,stone:5,test:s=>s.cleared>=30 },
  { id:'campaign40',name:'심연의 종결자',desc:'40전장 모두 돌파',gold:15000,stone:20,test:s=>s.cleared>=40 },
  { id: 'endless10',name: '끝없는 전장',  desc: '무한 전장 10웨이브 돌파',       gold: 2000, stone: 3,
    test: s => (s.endlessBest || 0) >= 10 },
  { id: 'endless25',name: '불굴의 성채',  desc: '무한 전장 25웨이브 돌파',       gold: 7000, stone: 8,
    test: s => (s.endlessBest || 0) >= 25 }
];

function totalStars(s) {
  let n = 0;
  for (const k in (s.stars || {})) n += s.stars[k];
  return n;
}

/* -------------------- 병영 강화 -------------------- */
const UPGRADES = {
  medicine:{name:'야전 의무대',max:5,base:320,step:1.65,desc:'아군 지원병의 회복량 +6%/레벨 (왕명 제외)'},
  resistance:{name:'해독 훈련',max:5,base:350,step:1.65,desc:'아군 중독·화상 피해 -5%/레벨'},
  deployment:{name:'출진 보호진',max:5,base:380,step:1.7,desc:'직접 출진한 병사에게 보호막 25/레벨 (소환수 제외)'},
  wallet:  { name: '군자금 금고', max: 10, base: 100, step: 1.5,
             desc: '전투 중 보유할 수 있는 군자금 한도가 늘어난다.' },
  income:  { name: '세금 징수', max: 10, base: 115, step: 1.52,
             desc: '전투 중 군자금이 차는 속도가 빨라진다.' },
  power:   { name: '무기 연마', max: 10, base: 130, step: 1.55,
             desc: '모든 아군 병사의 공격력 +6%/레벨' },
  vitality:{ name: '갑옷 강화', max: 10, base: 130, step: 1.55,
             desc: '모든 아군 병사의 체력 +8%/레벨' },
  castle:  { name: '성벽 보수', max: 10, base: 120, step: 1.52,
             desc: '아군 성채 체력 +10%/레벨' },
  logistics:{ name: '병참', max: 10, base: 150, step: 1.55,
             desc: '모든 병종의 쿨타임 -3%/레벨' },
  treasury:{ name: '전시 국고', max: 10, base: 130, step: 1.5,
             desc: '전투 시작 군자금 +60/레벨' },
  spoils:  { name: '전리품 수거', max: 10, base: 140, step: 1.5,
             desc: '적 처치 골드 +8%/레벨' },
  academy: { name: '사관학교', max: 5, base: 900, step: 1.9,
             desc: '병종 레벨 상한 +1/레벨 (최대 20레벨까지)' },
  command: { name: '왕의 명령', max: 5, base: 700, step: 1.8,
             desc: '왕명 재사용 -8초, 회복량 +8%/레벨' }
};

/* -------------------- 왕의 명령 (액티브) -------------------- */
const COMMAND = {
  baseCooldown: 75,      // 기본 재사용 대기
  cooldownPerLv: 8,      // 강화 레벨당 감소
  healRatio: 0.25,       // 전군 최대 체력 대비 회복
  healPerLv: 0.08,
  hasteMul: 0.6,         // 공격 간격 배율
  hasteDur: 8
};

/* -------------------- 병종 레벨 -------------------- */
const UNIT_LEVEL_HARD_CAP = 15;
const UNIT_LEVEL_BASE_CAP = 5;
const UNIT_LEVEL_GAIN = 0.10;

function unitLevelCap(cleared, academy) {
  const a = academy || 0;
  return Math.min(UNIT_LEVEL_HARD_CAP + a, UNIT_LEVEL_BASE_CAP + (cleared || 0) + a);
}
function unitLevelMul(level) {
  return 1 + UNIT_LEVEL_GAIN * ((level || 1) - 1);
}
function unitTrainCost(unit, level) {
  const base = 40 + unit.cost * 0.6;
  return Math.round(base * (0.6 + 0.4 * (level || 1)));
}
function upgradeCost(key, level) {
  const u = UPGRADES[key];
  return Math.round(u.base * Math.pow(u.step, level));
}

/* Tactical descriptions shared by the campaign and enemy codex. */
function enemyTactic(e) {
  if (e.boss) return '보스 · 왕명을 아껴 폭격 후 회복';
  if (e.ab && e.ab.armor) return '중장갑 · 중독과 화상으로 지속 피해';
  if (e.ab && e.ab.heal) return '치유 지원 · 범위 공격으로 후열 압박';
  if (e.ab && e.ab.deathBomb) return '사망 폭발 · 저렴한 전열로 피해 분산';
  if (e.speed >= 85) return '고속 돌격 · 방패병과 둔화로 저지';
  if (e.ranged) return '원거리 · 방어 병종 뒤에 장거리 배치';
  if (e.area) return '광역 공격 · 소수 정예와 치유 조합';
  return '전열 병력 · 방패와 궁수의 합동 공격';
}
function unitRoleColor(u) {
  if (u.ab && u.ab.noAttack) return '#7bcda6';
  if (u.role === '방어' || u.role === '불굴') return '#8abcf2';
  if (u.ranged) return '#c6adfa';
  return '#efbd76';
}
