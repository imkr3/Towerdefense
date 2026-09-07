/* =======================================================================
 *  달콤 방어전 (Sweet Defense) - 게임 데이터
 *  컨셉: 디저트 부대(스위트 브리게이드) vs 채소 군단(베지 호드)
 * ======================================================================= */

// 유닛 공통 기본값
const UNIT_DEFAULTS = {
  hp: 100, atk: 10, range: 60, speed: 40, interval: 1.0,
  cost: 50, cooldown: 3, kb: 2, area: false, areaRadius: 0,
  ranged: false, scale: 1, unlockStage: 1, desc: ''
};

function mk(o) { return Object.assign({}, UNIT_DEFAULTS, o); }

/* -------------------- 아군 유닛: 디저트 부대 -------------------- */
const UNITS = [
  mk({
    id: 'pudding', name: '푸딩 신병', emoji: '🍮',
    body: '#f6c76a', accent: '#7a4a1e', shape: 'dome',
    hp: 260, atk: 34, range: 62, speed: 46, interval: 1.0,
    cost: 55, cooldown: 2.2, kb: 3, unlockStage: 1,
    desc: '싸고 빠르게 나오는 물량형 근접 병사. 숫자가 힘이다.'
  }),
  mk({
    id: 'marsh', name: '마시멜로 방벽', emoji: '🍢',
    body: '#fff4f6', accent: '#e08fa6', shape: 'blob',
    hp: 1900, atk: 14, range: 58, speed: 26, interval: 1.5,
    cost: 120, cooldown: 6.5, kb: 1, scale: 1.15, unlockStage: 2,
    desc: '거대한 체력으로 전선을 막는 방패. 공격력은 거의 없다.'
  }),
  mk({
    id: 'chip', name: '초코칩 사수', emoji: '🍪',
    body: '#c98a4b', accent: '#5b3316', shape: 'disc',
    hp: 220, atk: 62, range: 265, speed: 36, interval: 1.25,
    cost: 145, cooldown: 5.0, kb: 2, ranged: true, unlockStage: 3,
    desc: '멀리서 초코칩을 쏘는 원거리 딜러. 맞으면 잘 부서진다.'
  }),
  mk({
    id: 'macaron', name: '마카롱 쌍둥이', emoji: '🍬',
    body: '#ffb3d1', accent: '#8e4a68', shape: 'twin',
    hp: 470, atk: 42, range: 70, speed: 74, interval: 0.45,
    cost: 200, cooldown: 6.0, kb: 3, unlockStage: 5,
    desc: '발이 빠르고 연타가 강한 돌격형. 탱커 뒤에 세우면 좋다.'
  }),
  mk({
    id: 'cream', name: '슈크림 폭탄병', emoji: '🧁',
    body: '#ffe9b8', accent: '#b4622a', shape: 'cup',
    hp: 300, atk: 260, range: 78, speed: 96, interval: 3.0,
    cost: 165, cooldown: 8.0, kb: 1, area: true, areaRadius: 95, unlockStage: 7,
    desc: '적진으로 달려가 크림을 터뜨린다. 범위 한 방이 매우 아프다.'
  }),
  mk({
    id: 'donut', name: '도넛 롤러', emoji: '🍩',
    body: '#f0a3c0', accent: '#6b3b2a', shape: 'ring',
    hp: 1250, atk: 135, range: 76, speed: 32, interval: 1.9,
    cost: 245, cooldown: 9.5, kb: 2, area: true, areaRadius: 80, scale: 1.1, unlockStage: 9,
    desc: '굴러가며 주변을 뭉갠다. 체력과 범위 공격을 겸비한 주력.'
  }),
  mk({
    id: 'cake', name: '케이크 대포', emoji: '🎂',
    body: '#fdf0d5', accent: '#d94f6a', shape: 'cake',
    hp: 760, atk: 340, range: 440, speed: 18, interval: 3.2,
    cost: 340, cooldown: 15, kb: 1, ranged: true, area: true, areaRadius: 110, scale: 1.15, unlockStage: 11,
    desc: '초장거리 포격. 몰려오는 적을 한 번에 정리한다.'
  }),
  mk({
    id: 'queen', name: '아이스크림 여왕', emoji: '🍦',
    body: '#fff8e7', accent: '#7fd2e8', shape: 'cone',
    hp: 3400, atk: 430, range: 140, speed: 25, interval: 2.0,
    cost: 520, cooldown: 42, kb: 1, area: true, areaRadius: 130, scale: 1.35, unlockStage: 14,
    desc: '부대의 최종 병기. 나오는 데 오래 걸리지만 전선을 뒤집는다.'
  })
];

const UNIT_BY_ID = {};
UNITS.forEach(u => { UNIT_BY_ID[u.id] = u; });

/* -------------------- 적 유닛: 채소 군단 -------------------- */
const ENEMIES = {
  bean:     { name: '콩알 졸병', body: '#8fd06a', accent: '#2f5d1e', shape: 'blob',
              hp: 220, atk: 26, range: 60, speed: 42, interval: 1.1, kb: 2, gold: 12, scale: .85 },
  carrot:   { name: '당근 창병', body: '#f2913c', accent: '#2f6d2a', shape: 'spike',
              hp: 340, atk: 55, range: 120, speed: 40, interval: 1.4, kb: 2, gold: 18 },
  broccoli: { name: '브로콜리 방패', body: '#5aa84a', accent: '#28502a', shape: 'tree',
              hp: 2400, atk: 30, range: 62, speed: 24, interval: 1.6, kb: 1, gold: 34, scale: 1.15 },
  pepper:   { name: '고추 돌격병', body: '#e0463c', accent: '#3f7c2f', shape: 'chili',
              hp: 380, atk: 70, range: 62, speed: 92, interval: 0.7, kb: 3, gold: 22 },
  corn:     { name: '옥수수 기관총', body: '#f5d64e', accent: '#8a6a1e', shape: 'corn',
              hp: 520, atk: 40, range: 330, speed: 26, interval: 0.9, kb: 2, gold: 40, ranged: true },
  onion:    { name: '양파 자폭병', body: '#e7d7f0', accent: '#8b5ca8', shape: 'onion',
              hp: 700, atk: 230, range: 80, speed: 62, interval: 3.0, kb: 1, gold: 38,
              area: true, areaRadius: 100 },
  eggplant: { name: '가지 기사', body: '#7a4bb5', accent: '#33204f', shape: 'egg',
              hp: 2100, atk: 210, range: 90, speed: 34, interval: 1.9, kb: 1, gold: 60, scale: 1.1 },
  pumpkin:  { name: '호박 대왕', body: '#f08a2c', accent: '#6d3a10', shape: 'pumpkin',
              hp: 9000, atk: 480, range: 150, speed: 20, interval: 2.4, kb: 1, gold: 220,
              area: true, areaRadius: 130, scale: 1.7, boss: true },
  garlic:   { name: '마늘 대군주', body: '#f3efe2', accent: '#9b8a5e', shape: 'garlic',
              hp: 22000, atk: 700, range: 180, speed: 17, interval: 2.6, kb: 1, gold: 600,
              area: true, areaRadius: 170, scale: 2.0, boss: true },
  radish:   { name: '무 장군', body: '#f7f4ee', accent: '#7fc45a', shape: 'radish',
              hp: 5200, atk: 330, range: 100, speed: 28, interval: 2.0, kb: 1, gold: 130,
              scale: 1.35, boss: true }
};

/* -------------------- 스테이지 20개 -------------------- */
/* wave: { t: 등장 시각(초), e: 적 ID, n: 마리 수, gap: 간격(초) } */
function W(t, e, n, gap) { return { t: t, e: e, n: n || 1, gap: gap || 1.2 }; }

const STAGES = [
  { name: '설탕 들판 초입', baseHp: 2600, money: 180, rate: 26, reward: 60, waves: [
      W(1,'bean',3,2.2), W(12,'bean',4,1.8), W(24,'bean',5,1.4) ] },
  { name: '당근 밭', baseHp: 3200, money: 190, rate: 27, reward: 70, waves: [
      W(1,'bean',3,2.0), W(10,'carrot',2,2.0), W(22,'bean',4,1.5), W(32,'carrot',3,1.6) ] },
  { name: '초록 언덕', baseHp: 3800, money: 200, rate: 28, reward: 80, waves: [
      W(2,'bean',4,1.8), W(14,'carrot',3,1.6), W(26,'broccoli',1), W(36,'bean',6,1.1) ] },
  { name: '매운 오솔길', baseHp: 4400, money: 210, rate: 29, reward: 95, waves: [
      W(2,'bean',3,1.6), W(11,'pepper',2,2.0), W(22,'carrot',4,1.4), W(34,'pepper',3,1.4),
      W(46,'broccoli',1) ] },
  { name: '★ 무 장군의 밭', baseHp: 5200, money: 240, rate: 31, reward: 160, boss: true, waves: [
      W(2,'bean',4,1.6), W(14,'carrot',3,1.5), W(26,'radish',1), W(30,'pepper',3,1.5),
      W(46,'broccoli',2,3.0) ] },
  { name: '옥수수 밭', baseHp: 5600, money: 230, rate: 31, reward: 120, waves: [
      W(2,'carrot',3,1.5), W(12,'corn',2,2.4), W(26,'bean',6,1.0), W(38,'corn',3,2.0),
      W(52,'broccoli',2,2.6) ] },
  { name: '양파 골짜기', baseHp: 6200, money: 240, rate: 32, reward: 135, waves: [
      W(2,'bean',4,1.4), W(12,'onion',2,3.0), W(24,'carrot',4,1.4), W(38,'onion',3,2.6),
      W(54,'pepper',4,1.2) ] },
  { name: '서리 내린 텃밭', baseHp: 7000, money: 250, rate: 33, reward: 150, waves: [
      W(2,'pepper',3,1.5), W(14,'broccoli',2,3.0), W(28,'corn',3,1.8), W(44,'carrot',5,1.2),
      W(58,'onion',2,2.6) ] },
  { name: '가지 숲', baseHp: 7800, money: 260, rate: 34, reward: 170, waves: [
      W(2,'bean',5,1.3), W(14,'eggplant',1), W(28,'corn',3,1.8), W(42,'eggplant',2,4.0),
      W(58,'pepper',5,1.1) ] },
  { name: '★ 호박 대왕의 성', baseHp: 8600, money: 280, rate: 36, reward: 300, boss: true, waves: [
      W(2,'bean',5,1.3), W(14,'broccoli',2,2.6), W(28,'pumpkin',1), W(34,'carrot',5,1.3),
      W(50,'pepper',5,1.2), W(66,'eggplant',2,3.5) ] },
  { name: '뿌리 미로', baseHp: 9200, money: 270, rate: 36, reward: 200, waves: [
      W(2,'carrot',5,1.2), W(14,'onion',3,2.4), W(28,'eggplant',2,3.5), W(44,'corn',4,1.6),
      W(60,'broccoli',3,2.4) ] },
  { name: '고추 화산', baseHp: 10000, money: 280, rate: 37, reward: 220, waves: [
      W(2,'pepper',5,1.0), W(14,'pepper',6,0.9), W(28,'eggplant',2,3.0), W(44,'onion',4,2.2),
      W(60,'corn',4,1.6), W(76,'broccoli',3,2.2) ] },
  { name: '무 장군의 재도전', baseHp: 11000, money: 300, rate: 38, reward: 260, boss: true, waves: [
      W(2,'bean',6,1.1), W(14,'radish',1), W(20,'carrot',5,1.2), W(36,'radish',1),
      W(50,'onion',4,2.0), W(68,'eggplant',3,3.0) ] },
  { name: '겨울 창고', baseHp: 12000, money: 300, rate: 39, reward: 280, waves: [
      W(2,'corn',4,1.5), W(16,'broccoli',3,2.2), W(32,'eggplant',3,2.8), W(50,'pepper',7,0.9),
      W(66,'onion',5,2.0), W(84,'corn',5,1.4) ] },
  { name: '★ 두 호박의 문', baseHp: 13000, money: 320, rate: 40, reward: 420, boss: true, waves: [
      W(2,'bean',6,1.1), W(14,'pumpkin',1), W(24,'carrot',6,1.1), W(40,'pumpkin',1),
      W(52,'eggplant',3,2.6), W(70,'onion',5,1.8) ] },
  { name: '썩은 온실', baseHp: 14500, money: 320, rate: 41, reward: 320, waves: [
      W(2,'pepper',6,1.0), W(16,'eggplant',4,2.4), W(34,'corn',6,1.3), W(52,'broccoli',4,2.0),
      W(70,'onion',6,1.8), W(90,'radish',1) ] },
  { name: '뿌리의 심장', baseHp: 16000, money: 330, rate: 42, reward: 360, waves: [
      W(2,'carrot',7,1.0), W(16,'eggplant',4,2.2), W(34,'radish',2,6.0), W(54,'corn',6,1.2),
      W(74,'pepper',8,0.8), W(92,'onion',6,1.6) ] },
  { name: '대군의 행진', baseHp: 18000, money: 340, rate: 43, reward: 400, waves: [
      W(2,'bean',8,0.9), W(14,'pumpkin',1), W(26,'eggplant',4,2.2), W(44,'broccoli',5,1.8),
      W(62,'corn',7,1.2), W(82,'radish',2,5.0), W(104,'pepper',8,0.8) ] },
  { name: '마늘의 전조', baseHp: 20000, money: 360, rate: 45, reward: 460, boss: true, waves: [
      W(2,'pepper',7,0.9), W(16,'pumpkin',1), W(30,'eggplant',5,2.0), W(50,'pumpkin',1),
      W(64,'corn',7,1.2), W(84,'radish',2,4.5), W(104,'onion',7,1.5) ] },
  { name: '★ 마늘 대군주의 왕좌', baseHp: 24000, money: 400, rate: 48, reward: 900, boss: true, waves: [
      W(2,'bean',8,0.9), W(14,'broccoli',4,1.8), W(28,'pumpkin',1), W(40,'eggplant',5,2.0),
      W(58,'garlic',1), W(70,'radish',2,4.0), W(88,'corn',8,1.1), W(110,'pumpkin',1),
      W(126,'pepper',9,0.8) ] }
];

/* -------------------- 메타 강화 -------------------- */
const UPGRADES = {
  wallet:  { name: '지갑 용량', max: 10, base: 100, step: 1.5,
             desc: '전투 중 최대 소지금이 늘어난다.' },
  income:  { name: '자금 수급', max: 10, base: 115, step: 1.52,
             desc: '초당 자금 회복량이 늘어난다.' },
  power:   { name: '부대 공격력', max: 10, base: 130, step: 1.55,
             desc: '모든 아군 유닛의 공격력 +6%/레벨' },
  vitality:{ name: '부대 체력', max: 10, base: 130, step: 1.55,
             desc: '모든 아군 유닛의 체력 +8%/레벨' },
  castle:  { name: '성벽 보강', max: 10, base: 120, step: 1.52,
             desc: '아군 본진 체력 +10%/레벨' }
};

function upgradeCost(key, level) {
  const u = UPGRADES[key];
  return Math.round(u.base * Math.pow(u.step, level));
}
