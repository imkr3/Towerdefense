/* =======================================================================
 *  막대 왕국 전쟁 - 게임 데이터
 *  컨셉: 졸라맨 왕국군 vs 오크 군단 (중세)
 * ======================================================================= */

const LOADOUT_MAX = 10;      // 전투에 들고 갈 수 있는 병종 수

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
    hp: 260, atk: 34, range: 62, speed: 46, interval: 1.0,
    cost: 55, cooldown: 2.2, kb: 3, unlockStage: 1,
    desc: '값싸고 빨리 나오는 징집병. 머릿수로 전선을 채운다.'
  }),
  mk({
    id: 'shield', name: '방패병', role: '방어', shape: 'shield',
    body: '#2b3038', accent: '#8d6a3f', tunic: '#6b7480',
    hp: 1900, atk: 14, range: 58, speed: 26, interval: 1.5,
    cost: 120, cooldown: 6.5, kb: 1, scale: 1.1, unlockStage: 2,
    desc: '두꺼운 방패로 전선을 버틴다. 공격력은 없다시피 하다.'
  }),
  mk({
    id: 'archer', name: '궁수', role: '원거리', shape: 'archer',
    body: '#2b3038', accent: '#3f7a43', tunic: '#4a7c4e',
    hp: 220, atk: 62, range: 265, speed: 36, interval: 1.25,
    cost: 145, cooldown: 5.0, kb: 2, ranged: true, unlockStage: 3,
    desc: '뒤에서 활을 쏜다. 앞줄이 뚫리면 순식간에 쓰러진다.'
  }),
  mk({
    id: 'priest', name: '사제', role: '치유', shape: 'priest',
    body: '#2b3038', accent: '#e8d9a8', tunic: '#f0ead6',
    hp: 460, atk: 0, range: 0, speed: 30, interval: 2.0,
    cost: 175, cooldown: 12, kb: 1, unlockStage: 4,
    ab: { heal: 95, radius: 230, interval: 2.4, noAttack: true },
    abText: '주변 아군 회복 · 공격 안 함',
    desc: '싸우지 않는 대신 2.4초마다 주변 아군의 상처를 꿰맨다.'
  }),
  mk({
    id: 'berserk', castFx: 'slash', name: '광전사', role: '돌격', shape: 'berserk',
    body: '#2b3038', accent: '#b0b6bd', tunic: '#a63a2e',
    hp: 470, atk: 42, range: 70, speed: 74, interval: 0.45,
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
    hp: 300, atk: 260, range: 78, speed: 96, interval: 3.0,
    cost: 165, cooldown: 8.0, kb: 1, area: true, areaRadius: 95, unlockStage: 7,
    abText: '범위 폭발',
    desc: '적진까지 달려가 화약통을 터뜨린다. 한 방이 아주 아프다.'
  }),
  mk({
    id: 'merchant', name: '종군 상인', short: '상인', role: '보급', shape: 'merchant',
    body: '#2b3038', accent: '#c9a227', tunic: '#8a5a2a',
    hp: 620, atk: 0, range: 0, speed: 0, interval: 3.0,
    cost: 150, cooldown: 20, kb: 1, unlockStage: 8,
    ab: { gold: 12, hold: true, noAttack: true, interval: 3 },
    abText: '초당 군자금 +12 · 제자리 고정',
    desc: '성문 앞에 자리를 잡고 물자를 판다. 살아 있는 동안 군자금이 더 빨리 찬다.'
  }),
  mk({
    id: 'knight', castFx: 'slash', name: '기사', role: '주력', shape: 'knight',
    body: '#2b3038', accent: '#c8ced6', tunic: '#8e2f3a',
    hp: 1250, atk: 135, range: 76, speed: 32, interval: 1.9,
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
    abText: '주변 아군 공격 속도 30% 상승',
    desc: '진군 나팔을 분다. 싸우지 않지만 주변 아군이 훨씬 빨리 때린다.'
  }),
  mk({
    id: 'longbow', name: '대궁병', role: '장거리', shape: 'longbow',
    body: '#2b3038', accent: '#6b8f3f', tunic: '#3f5a2f',
    hp: 280, atk: 96, range: 400, speed: 30, interval: 2.0,
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
  N:   { name: '일반', color: '#8b8477', weight: 52, refund: 120 },
  R:   { name: '희귀', color: '#3f8ed0', weight: 30, refund: 320 },
  SR:  { name: '영웅', color: '#a05fd0', weight: 14, refund: 900 },
  SSR: { name: '전설', color: '#e8a020', weight: 4,  refund: 2400 }
};
const RARITY_ORDER = ['N', 'R', 'SR', 'SSR'];

const GACHA = {
  stonePerPull: 1,
  tenPull: 9,          // 10회 소환에 필요한 소환석
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
    hp: 2600, atk: 470, range: 380, speed: 24, interval: 2.6,
    cost: 600, cooldown: 45, kb: 1, ranged: true, area: true, areaRadius: 150, scale: 1.35,
    ab: { stun: { chance: 0.35, dur: 1.4 } },
    abText: '초장거리 번개 광역 · 35% 기절',
    desc: '하늘에서 번개를 내리꽂는다. 맞은 자리의 모든 것이 멈춘다.'
  }),
  mk({
    id: 'ares', castFx: 'slash', name: '아레스', short: '아레스', role: '전신', shape: 'ares',
    season: 'olympus', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c0392b', tunic: '#8e2f3a',
    hp: 2600, atk: 240, range: 88, speed: 34, interval: 1.7,
    cost: 400, cooldown: 18, kb: 1, area: true, areaRadius: 95, scale: 1.15,
    ab: { enrage: 1.8, lifesteal: 0.2 },
    abText: '범위 · 피가 깎일수록 가속 · 흡혈 20%',
    desc: '전쟁 그 자체. 상처가 깊어질수록 창은 더 빨라진다.'
  }),
  mk({
    id: 'artemis', castFx: 'holy', name: '아르테미스', short: '아르테미스', role: '사냥', shape: 'artemis',
    season: 'olympus', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#cfe8b0', tunic: '#4a7c4e',
    hp: 430, atk: 150, range: 420, speed: 44, interval: 0.9,
    cost: 360, cooldown: 14, kb: 2, ranged: true,
    ab: { pierce: true },
    abText: '일직선 관통 · 초당 1회 이상 연사',
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
    hp: 3900, atk: 600, range: 120, speed: 30, interval: 2.2,
    cost: 620, cooldown: 45, kb: 1, area: true, areaRadius: 130, scale: 1.4,
    ab: { stun: { chance: 0.4, dur: 1.2 }, push: 50 },
    abText: '광역 망치 · 40% 기절 · 밀쳐내기',
    desc: '묠니르가 떨어질 때마다 전선이 통째로 뒤로 밀린다.'
  }),
  mk({
    id: 'valkyrie', castFx: 'holy', name: '발키리', short: '발키리', role: '전선', shape: 'valkyrie',
    season: 'ragnarok', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#f0e6c8', tunic: '#3f6bb5',
    hp: 1500, atk: 210, range: 82, speed: 58, interval: 1.3,
    cost: 380, cooldown: 16, kb: 2,
    ab: { revive: 0.5, heal: 60, radius: 160, interval: 4 },
    abText: '1회 부활 · 주변 아군 회복',
    desc: '쓰러진 자를 거두는 전장의 처녀. 자기 자신도 한 번은 일어난다.'
  }),
  mk({
    id: 'fenrir', castFx: 'slash', name: '펜리르', short: '펜리르', role: '맹수', shape: 'fenrir',
    season: 'ragnarok', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#3a3f48', accent: '#7fd8ff', tunic: '#2a2e36',
    hp: 1900, atk: 185, range: 66, speed: 130, interval: 0.7,
    cost: 370, cooldown: 15, kb: 2, scale: 1.25,
    ab: { lifesteal: 0.4 },
    abText: '초고속 돌진 · 흡혈 40%',
    desc: '사슬을 끊고 나온 늑대. 물어뜯은 만큼 스스로 회복한다.'
  }),
  mk({
    id: 'viking', name: '바이킹 전사', short: '바이킹', role: '광전', shape: 'viking',
    season: 'ragnarok', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c8ced6', tunic: '#6b4b2a',
    hp: 950, atk: 110, range: 70, speed: 80, interval: 0.7,
    cost: 250, cooldown: 8, kb: 3,
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
    hp: 3300, atk: 430, range: 110, speed: 26, interval: 2.2,
    cost: 580, cooldown: 42, kb: 1, area: true, areaRadius: 120, scale: 1.35,
    ab: { summon: { id: 'mummy', n: 2 }, interval: 7 },
    abText: '광역 · 7초마다 미라 2기 소환',
    desc: '죽은 자를 세어 보내는 자. 쓰러진 자리마다 미라가 일어선다.'
  }),
  mk({
    id: 'rapriest', castFx: 'firestorm', name: '라의 사제', short: '라사제', role: '태양', shape: 'rapriest',
    season: 'nile', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#ffb03c', tunic: '#e8c65a',
    hp: 720, atk: 180, range: 300, speed: 30, interval: 2.0,
    cost: 350, cooldown: 14, kb: 2, ranged: true, area: true, areaRadius: 105,
    ab: { burn: { dps: 95, dur: 5 } },
    abText: '태양광 범위 · 화상 95/초 5초',
    desc: '태양을 조각내 던진다. 맞은 자리는 한참을 탄다.'
  }),
  mk({
    id: 'scarab', name: '황금 스카라베', short: '스카라베', role: '보물', shape: 'scarab',
    season: 'nile', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#c9a227', accent: '#6b5417', tunic: '#e8c65a',
    hp: 520, atk: 70, range: 62, speed: 110, interval: 0.8,
    cost: 220, cooldown: 8, kb: 3,
    ab: { gold: 8 },
    abText: '빠름 · 살아 있는 동안 군자금 +8/초',
    desc: '황금 껍질을 두른 풍뎅이. 굴러다니며 금화를 흘린다.'
  }),
  mk({
    id: 'desertarcher', name: '사막 궁수', short: '사막궁수', role: '원거리', shape: 'desertarcher',
    season: 'nile', rarity: 'N', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#e8d9a8', tunic: '#b98a52',
    hp: 270, atk: 80, range: 285, speed: 40, interval: 1.2,
    cost: 150, cooldown: 5, kb: 2, ranged: true,
    abText: '값싼 원거리',
    desc: '모래바람 속에서 자란 궁수. 싸고 빠르게 자리를 채운다.'
  }),
  mk({
    id: 'hoplite', name: '아테네 창병', short: '아테네창', role: '방진', shape: 'hoplite',
    season: 'olympus', rarity: 'N', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c8ced6', tunic: '#3f6bb5',
    hp: 620, atk: 58, range: 72, speed: 44, interval: 1.0,
    cost: 140, cooldown: 4.5, kb: 2,
    abText: '값싼 창방패 보병',
    desc: '도시국가의 시민병. 싸고 빠르게 전열을 채운다.'
  }),
  mk({
    id: 'northarcher', name: '북방 궁수', short: '북방궁수', role: '원거리', shape: 'northarcher',
    season: 'ragnarok', rarity: 'N', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#9fc6d8', tunic: '#4a5c6b',
    hp: 300, atk: 88, range: 300, speed: 38, interval: 1.15,
    cost: 155, cooldown: 5, kb: 2, ranged: true,
    abText: '값싼 원거리',
    desc: '얼음 바람 속에서 활을 당기는 사냥꾼.'
  }),
  mk({
    id: 'pharaoh', name: '파라오 근위대', short: '근위대', role: '수호', shape: 'pharaoh',
    season: 'nile', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#e8c65a', tunic: '#2b6b8e',
    hp: 2900, atk: 165, range: 78, speed: 28, interval: 1.6,
    cost: 370, cooldown: 16, kb: 1, scale: 1.15,
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

UNITS.push.apply(UNITS, SEASON_UNITS);
SEASON_UNITS.forEach(u => { UNIT_BY_ID[u.id] = u; });

const SEASONS = [
  { id: 'olympus', name: '올림포스', sub: '그리스 신화',
    color: '#d8c47a', accent: '#8e6b1f',
    desc: '번개와 창의 신들이 왕국의 부름에 응했다.',
    units: ['zeus', 'ares', 'artemis', 'medusa', 'spartan', 'hoplite'] },
  { id: 'ragnarok', name: '라그나로크', sub: '북유럽 신화',
    color: '#8fb6d8', accent: '#2f5f8e',
    desc: '최후의 전투를 앞둔 북방의 전사들이 내려왔다.',
    units: ['thor', 'valkyrie', 'fenrir', 'viking', 'runeseer', 'northarcher'] },
  { id: 'nile', name: '나일의 왕가', sub: '이집트 신화',
    color: '#e8c65a', accent: '#8a6a1f',
    desc: '모래 아래 잠들어 있던 사자의 신과 사제들이 깨어났다.',
    units: ['anubis', 'rapriest', 'pharaoh', 'scarab', 'desertarcher'] }
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
              hp: 340, atk: 55, range: 120, speed: 40, interval: 1.4, kb: 2, gold: 18 },
  ogre:     { name: '오우거', body: '#6b7a52', accent: '#4a3520', tunic: '#5a6a44', shape: 'ogre',
              hp: 2900, atk: 38, range: 62, speed: 24, interval: 1.6, kb: 1, gold: 34, scale: 1.2 },
  wolf:     { name: '늑대 기수', body: '#5a5f66', accent: '#7a4a2a', tunic: '#4a6b46', shape: 'wolf',
              hp: 380, atk: 70, range: 62, speed: 92, interval: 0.7, kb: 3, gold: 22 },
  ballista: { name: '석궁 사수', body: '#4a6b46', accent: '#6b4b2a', tunic: '#3d5a3a', shape: 'ballista',
              hp: 520, atk: 40, range: 330, speed: 26, interval: 0.9, kb: 2, gold: 40, ranged: true },
  spider:   { name: '독거미', body: '#3f3348', accent: '#9de08e', tunic: '#2c2434', shape: 'spider',
              hp: 430, atk: 40, range: 62, speed: 100, interval: 0.8, kb: 2, gold: 26,
              ab: { poison: { dps: 34, dur: 4 } } },
  shaman:   { name: '오크 주술사', body: '#4a6b46', accent: '#c98ae0', tunic: '#5a3a6b', shape: 'shaman',
              hp: 900, atk: 45, range: 200, speed: 30, interval: 1.8, kb: 2, gold: 55, ranged: true,
              ab: { heal: 75, radius: 230, interval: 3 } },
  powder:   { name: '화약통 고블린', body: '#4d6b3a', accent: '#6e4a24', tunic: '#3f5a2f', shape: 'powder',
              hp: 700, atk: 230, range: 80, speed: 62, interval: 3.0, kb: 1, gold: 38,
              area: true, areaRadius: 100 },
  orcshield:{ name: '방패 오크', body: '#4a6b46', accent: '#7a5a3a', tunic: '#3d5a3a', shape: 'orcshield',
              hp: 4200, atk: 78, range: 62, speed: 22, interval: 1.6, kb: 1, gold: 48, scale: 1.15,
              ab: { kbImmune: true, armor: 0.2 } },
  wraith:   { name: '망령', body: '#8fa0b5', accent: '#5de0d0', tunic: '#6a7c92', shape: 'wraith',
              hp: 820, atk: 92, range: 70, speed: 66, interval: 1.2, kb: 1, gold: 45,
              ab: { deathBomb: { dmg: 190, radius: 115 } } },
  dark:     { name: '흑기사', body: '#22242c', accent: '#8e2f3a', tunic: '#2f3038', shape: 'dark',
              hp: 2600, atk: 255, range: 90, speed: 34, interval: 1.9, kb: 1, gold: 60, scale: 1.1 },
  troll:    { name: '트롤 대장', body: '#5c7040', accent: '#3a2418', tunic: '#4a5c34', shape: 'troll',
              hp: 11000, atk: 540, range: 150, speed: 20, interval: 2.4, kb: 1, gold: 220,
              area: true, areaRadius: 130, scale: 1.7, boss: true },
  lich:     { name: '리치', body: '#d9d4c4', accent: '#6f4bb5', tunic: '#c4bfae', shape: 'lich',
              hp: 6400, atk: 380, range: 100, speed: 28, interval: 2.0, kb: 1, gold: 130,
              scale: 1.3, boss: true, ab: { summon: { id: 'goblin', n: 1 }, interval: 7 } },
  frostgiant:{ name: '서리 거인', body: '#9fc6d8', accent: '#ffffff', tunic: '#7fa8bd', shape: 'frostgiant',
              hp: 15000, atk: 580, range: 165, speed: 18, interval: 2.6, kb: 1, gold: 300,
              area: true, areaRadius: 145, scale: 1.8, boss: true, ab: { slow: 3 } },
  orcberserk:{ name: '오크 광전사', body: '#5a7a44', accent: '#c0392b', tunic: '#46603a', shape: 'orcberserk',
              hp: 1800, atk: 155, range: 66, speed: 78, interval: 0.9, kb: 2, gold: 52,
              ab: { enrage: 1.7 } },
  bat:      { name: '흡혈박쥐', body: '#4a3a52', accent: '#e04b6a', tunic: '#3a2c42', shape: 'bat',
              hp: 260, atk: 46, range: 60, speed: 120, interval: 0.6, kb: 3, gold: 20, scale: .8,
              ab: { lifesteal: 0.5 } },
  golem:    { name: '돌 골렘', body: '#8a8880', accent: '#5f5d56', tunic: '#767469', shape: 'golem',
              hp: 8200, atk: 310, range: 78, speed: 17, interval: 2.6, kb: 1, gold: 120, scale: 1.5,
              ab: { kbImmune: true, push: 30, armor: 0.25 } },
  totem:    { name: '저주 토템', body: '#6b4b2a', accent: '#c98ae0', tunic: '#4a3520', shape: 'totem',
              hp: 1400, atk: 0, range: 0, speed: 0, interval: 3, kb: 1, gold: 70,
              ab: { haste: { mul: 0.75, dur: 4 }, radius: 260, interval: 4, hold: true, noAttack: true } },
  drake:    { name: '화룡', body: '#a8382c', accent: '#ffb03c', tunic: '#7e2a20', shape: 'drake',
              hp: 19000, atk: 660, range: 200, speed: 22, interval: 2.4, kb: 1, gold: 420,
              area: true, areaRadius: 160, scale: 1.9, boss: true,
              ab: { burn: { dps: 90, dur: 5 } } },
  orccatapult:{ name: '오크 투석기', body: '#5c4326', accent: '#3d2b18', tunic: '#6b4b2a', shape: 'orccatapult',
              hp: 950, atk: 310, range: 430, speed: 14, interval: 3.4, kb: 1, gold: 90, ranged: true,
              area: true, areaRadius: 120, scale: 1.15 },
  warchief: { name: '오크 사령관', body: '#4a6b46', accent: '#c9a227', tunic: '#3d5a3a', shape: 'warchief',
              hp: 3600, atk: 250, range: 84, speed: 30, interval: 1.7, kb: 1, gold: 115, scale: 1.2,
              ab: { haste: { mul: 0.75, dur: 4 }, radius: 240, interval: 4 } },
  plaguer:  { name: '역병 술사', body: '#5a6b3a', accent: '#9de08e', tunic: '#3f4a2a', shape: 'plaguer',
              hp: 1150, atk: 95, range: 265, speed: 28, interval: 2.2, kb: 2, gold: 78, ranged: true,
              area: true, areaRadius: 95, ab: { poison: { dps: 72, dur: 5 } } },
  hellhound:{ name: '지옥견', body: '#3a2a2a', accent: '#ff8a3c', tunic: '#2a1e1e', shape: 'hellhound',
              hp: 920, atk: 135, range: 64, speed: 115, interval: 0.8, kb: 3, gold: 62,
              ab: { burn: { dps: 62, dur: 3 } } },
  siegeram: { name: '파성추', body: '#6b4b2a', accent: '#8a8880', tunic: '#4a3520', shape: 'siegeram',
              hp: 9500, atk: 430, range: 74, speed: 16, interval: 2.4, kb: 1, gold: 155, scale: 1.5,
              ab: { kbImmune: true, armor: 0.35, push: 45 } },
  spiderqueen:{ name: '거미 여왕', body: '#3f2f4a', accent: '#c98ae0', tunic: '#2c2434', shape: 'spiderqueen',
              hp: 15000, atk: 410, range: 125, speed: 22, interval: 2.2, kb: 1, gold: 360,
              area: true, areaRadius: 115, scale: 1.75, boss: true,
              ab: { summon: { id: 'spider', n: 2 }, interval: 6, poison: { dps: 80, dur: 5 } } },
  warlord:  { name: '오크 대군주', body: '#3f5a3c', accent: '#c0392b', tunic: '#2f4a2c', shape: 'warlord',
              hp: 27000, atk: 780, range: 180, speed: 17, interval: 2.6, kb: 1, gold: 600,
              area: true, areaRadius: 170, scale: 2.0, boss: true,
              ab: { push: 40, summon: { id: 'orcspear', n: 2 }, interval: 8, armor: 0.2 } }
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
  { name: '★ 트롤 대장의 요새', baseHp: 8600, money: 280, rate: 36, reward: 300, boss: true, waves: [
      W(2,'goblin',5,1.3), W(14,'ogre',2,2.6), W(28,'troll',1), W(34,'orcspear',5,1.3),
      W(50,'wolf',5,1.2), W(66,'shaman',2,3.5) ] },
  { name: '흑기사의 숲', baseHp: 9800, money: 270, rate: 36, reward: 210, waves: [
      W(2,'orcspear',5,1.2), W(14,'dark',1), W(28,'orcberserk',2,2.6), W(44,'plaguer',2,3.0),
      W(60,'dark',2,3.5), W(76,'ballista',4,1.6), W(92,'bat',7,0.8) ] },
  { name: '망령의 폐허', baseHp: 10800, money: 280, rate: 37, reward: 230, waves: [
      W(2,'wolf',5,1.0), W(14,'wraith',2,2.6), W(24,'totem',1), W(34,'orccatapult',1),
      W(48,'wraith',3,2.4), W(64,'plaguer',3,2.2), W(80,'orcberserk',3,2.2),
      W(96,'hellhound',5,1.2) ] },
  { name: '리치의 재림', baseHp: 11000, money: 300, rate: 38, reward: 260, boss: true, waves: [
      W(2,'goblin',6,1.1), W(14,'lich',1), W(20,'orcspear',5,1.2), W(36,'lich',1),
      W(50,'warchief',1), W(64,'powder',4,2.0), W(82,'dark',3,3.0) ] },
  { name: '방패벽 관문', baseHp: 12000, money: 300, rate: 39, reward: 285, waves: [
      W(2,'orcshield',2,3.0), W(16,'ballista',4,1.5), W(30,'golem',1), W(44,'siegeram',1),
      W(60,'orcshield',3,2.6), W(76,'wolf',7,0.9), W(92,'shaman',3,3.0), W(110,'dark',3,2.6) ] },
  { name: '★ 두 트롤의 문', baseHp: 13000, money: 320, rate: 40, reward: 420, boss: true, waves: [
      W(2,'goblin',6,1.1), W(14,'troll',1), W(24,'orcspear',6,1.1), W(40,'troll',1),
      W(52,'warchief',1), W(66,'dark',3,2.6), W(84,'orccatapult',2,4.0), W(102,'powder',5,1.8) ] },
  { name: '역병의 늪', baseHp: 20000, money: 320, rate: 41, reward: 330, waves: [
      W(2,'spider',7,0.9), W(14,'totem',2,6.0), W(24,'spiderqueen',1), W(42,'plaguer',4,2.2),
      W(58,'bat',9,0.7), W(74,'orcshield',4,2.0), W(92,'wraith',5,1.8), W(108,'golem',1),
      W(124,'lich',1) ] },
  { name: '★ 서리 거인의 고개', baseHp: 22500, money: 340, rate: 42, reward: 480, boss: true, waves: [
      W(2,'orcspear',6,1.1), W(16,'orccatapult',2,4.0), W(32,'frostgiant',1), W(46,'wolf',7,0.9),
      W(62,'siegeram',1), W(78,'orcshield',3,2.4), W(96,'dark',4,2.4), W(114,'frostgiant',1),
      W(130,'orcberserk',5,1.4) ] },
  { name: '★ 화룡의 둥지', baseHp: 27000, money: 340, rate: 43, reward: 520, boss: true, waves: [
      W(2,'goblin',8,0.9), W(14,'orcberserk',3,2.0), W(30,'drake',1), W(46,'warchief',1),
      W(60,'orcshield',4,1.8), W(76,'orccatapult',2,3.5), W(94,'golem',1), W(112,'hellhound',7,1.0),
      W(130,'drake',1), W(150,'dark',5,1.8) ] },
  { name: '대군주의 전조', baseHp: 26000, money: 360, rate: 45, reward: 470, boss: true, waves: [
      W(2,'wolf',7,0.9), W(16,'frostgiant',1), W(30,'spiderqueen',1), W(48,'troll',1),
      W(62,'siegeram',1), W(78,'warchief',2,5.0), W(96,'orcshield',4,2.2), W(116,'plaguer',5,1.8),
      W(136,'golem',1), W(156,'drake',1) ] },
  { name: '★ 오크 대군주의 왕좌', baseHp: 32000, money: 400, rate: 48, reward: 900, boss: true, waves: [
      W(2,'goblin',8,0.9), W(14,'orcshield',4,1.8), W(28,'troll',1), W(40,'warchief',2,4.0),
      W(58,'warlord',1), W(72,'siegeram',1), W(88,'frostgiant',1), W(104,'orccatapult',3,3.0),
      W(120,'drake',1), W(136,'spiderqueen',1), W(154,'orcberserk',6,1.2),
      W(174,'wraith',8,0.9), W(194,'golem',2,6.0) ] }
];


/* =======================================================================
 *  무한 전장 - 끝없이 밀려오는 파도
 * ======================================================================= */
const ENDLESS_POOL = [
  { id: 'goblin',   from: 0 },  { id: 'orcspear', from: 0 },
  { id: 'wolf',     from: 2 },  { id: 'spider',   from: 3 },
  { id: 'bat',      from: 4 },  { id: 'ogre',     from: 4 },
  { id: 'ballista', from: 5 },  { id: 'shaman',   from: 6 },
  { id: 'powder',   from: 7 },  { id: 'orcshield',from: 8 },
  { id: 'orcberserk', from: 9 },{ id: 'wraith',   from: 10 },
  { id: 'dark',     from: 11 }, { id: 'golem',    from: 13 },
  { id: 'totem',    from: 14 }
];
const ENDLESS_BOSSES = ['lich', 'troll', 'frostgiant', 'drake', 'warlord'];

/* round 번째 무한 전장을 만든다. 파도가 갈수록 촘촘하고 강해진다. */
function makeEndlessStage(waveCount) {
  const waves = [];
  let t = 2;
  for (let w = 0; w < (waveCount || 40); w++) {
    const tier = Math.floor(w / 2);
    const pool = ENDLESS_POOL.filter(e => e.from <= tier);
    const pick = pool[(w * 7 + 3) % pool.length].id;
    const n = 3 + Math.min(9, Math.floor(w / 2));
    const gap = Math.max(0.55, 1.6 - w * 0.03);
    waves.push(W(t, pick, n, gap));
    // 5 파도마다 보스
    if (w > 0 && w % 5 === 0) {
      const bi = Math.min(ENDLESS_BOSSES.length - 1, Math.floor(w / 5) - 1);
      waves.push(W(t + 4, ENDLESS_BOSSES[bi], 1));
    }
    t += Math.max(7, 16 - w * 0.25);
  }
  return {
    name: '무한 전장', endless: true,
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
  { id: 'endless5',text: '무한 전장 5파도 돌파', need: 5,  stat: 'endless', gold: 800, stone: 1 }
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
  { id: 'star60',   name: '완전 제압',    desc: '모든 전장 별 3개',            gold: 6000, stone: 8,
    test: s => totalStars(s) >= 60 },
  { id: 'kill1000', name: '천 명의 적',   desc: '누적 1000 처치',              gold: 1000, stone: 1,
    test: s => (s.totalKills || 0) >= 1000 },
  { id: 'kill5000', name: '전장의 주인',  desc: '누적 5000 처치',              gold: 3000, stone: 3,
    test: s => (s.totalKills || 0) >= 5000 },
  { id: 'summon10', name: '제단의 손님',  desc: '소환 10회',                   gold: 500,  stone: 1,
    test: s => (s.pulls || 0) >= 10 },
  { id: 'summon100',name: '제단의 단골',  desc: '소환 100회',                  gold: 3000, stone: 3,
    test: s => (s.pulls || 0) >= 100 },
  { id: 'legend',   name: '신화의 계약',  desc: '전설 병종 보유',              gold: 2000, stone: 2,
    test: s => SEASON_UNITS.some(u => u.rarity === 'SSR' && s.owned && s.owned[u.id]) },
  { id: 'allseason',name: '세 신화',      desc: '세 시즌 전설을 모두 보유',    gold: 8000, stone: 10,
    test: s => SEASONS.every(sn => sn.units.some(id => {
      const u = UNIT_BY_ID[id];
      return u && u.rarity === 'SSR' && s.owned && s.owned[id];
    })) },
  { id: 'maxlv',    name: '정예 조련',    desc: '병종 하나를 15레벨로',        gold: 2500, stone: 3,
    test: s => Object.keys(s.levels || {}).some(k => s.levels[k] >= 15) },
  { id: 'endless10',name: '끝없는 전장',  desc: '무한 전장 10파도 돌파',       gold: 2000, stone: 3,
    test: s => (s.endlessBest || 0) >= 10 },
  { id: 'endless25',name: '불굴의 성채',  desc: '무한 전장 25파도 돌파',       gold: 7000, stone: 8,
    test: s => (s.endlessBest || 0) >= 25 }
];

function totalStars(s) {
  let n = 0;
  for (const k in (s.stars || {})) n += s.stars[k];
  return n;
}

/* -------------------- 병영 강화 -------------------- */
const UPGRADES = {
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
             desc: '모든 병종의 재정비 시간 -3%/레벨' },
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
