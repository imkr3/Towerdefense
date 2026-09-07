/* =======================================================================
 *  막대 왕국 전쟁 - 게임 데이터
 *  컨셉: 졸라맨 왕국군 vs 오크 군단 (중세)
 * ======================================================================= */

const LOADOUT_MAX = 10;      // 전투에 들고 갈 수 있는 병종 수

const UNIT_DEFAULTS = {
  hp: 100, atk: 10, range: 60, speed: 40, interval: 1.0,
  cost: 50, cooldown: 3, kb: 2, area: false, areaRadius: 0,
  ranged: false, scale: 1, unlockStage: 1, desc: '', abText: '', ab: null,
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
    id: 'berserk', name: '광전사', role: '돌격', shape: 'berserk',
    body: '#2b3038', accent: '#b0b6bd', tunic: '#a63a2e',
    hp: 470, atk: 42, range: 70, speed: 74, interval: 0.45,
    cost: 200, cooldown: 6.0, kb: 3, unlockStage: 5,
    desc: '쌍도끼를 미친 듯이 휘두른다. 방패병 뒤에 세워야 산다.'
  }),
  mk({
    id: 'venom', name: '독침 궁수', role: '중독', shape: 'venom',
    body: '#2b3038', accent: '#7fbf3f', tunic: '#3f6b4a',
    hp: 250, atk: 32, range: 250, speed: 38, interval: 1.4,
    cost: 190, cooldown: 6.5, kb: 2, ranged: true, unlockStage: 6,
    ab: { poison: { dps: 48, dur: 5 } },
    abText: '중독 48/초 · 5초',
    desc: '독을 바른 화살을 쏜다. 체력 큰 적일수록 독이 잘 듣는다.'
  }),
  mk({
    id: 'bomber', name: '화약병', role: '자폭형', shape: 'bomber',
    body: '#2b3038', accent: '#6b4b2a', tunic: '#8a6a3a',
    hp: 300, atk: 260, range: 78, speed: 96, interval: 3.0,
    cost: 165, cooldown: 8.0, kb: 1, area: true, areaRadius: 95, unlockStage: 7,
    abText: '범위 폭발',
    desc: '적진까지 달려가 화약통을 터뜨린다. 한 방이 아주 아프다.'
  }),
  mk({
    id: 'merchant', name: '종군 상인', role: '보급', shape: 'merchant',
    body: '#2b3038', accent: '#c9a227', tunic: '#8a5a2a',
    hp: 620, atk: 0, range: 0, speed: 0, interval: 3.0,
    cost: 150, cooldown: 20, kb: 1, unlockStage: 8,
    ab: { gold: 12, hold: true, noAttack: true, interval: 3 },
    abText: '초당 군자금 +12 · 제자리 고정',
    desc: '성문 앞에 자리를 잡고 물자를 판다. 살아 있는 동안 군자금이 더 빨리 찬다.'
  }),
  mk({
    id: 'knight', name: '기사', role: '주력', shape: 'knight',
    body: '#2b3038', accent: '#c8ced6', tunic: '#8e2f3a',
    hp: 1250, atk: 135, range: 76, speed: 32, interval: 1.9,
    cost: 245, cooldown: 9.5, kb: 2, area: true, areaRadius: 80, scale: 1.1, unlockStage: 9,
    abText: '범위 공격',
    desc: '대검을 휘둘러 앞의 여럿을 함께 벤다. 왕국군의 중핵.'
  }),
  mk({
    id: 'frost', name: '서리 마도사', role: '둔화', shape: 'frost',
    body: '#2b3038', accent: '#8fd8ff', tunic: '#2f5f8e',
    hp: 320, atk: 58, range: 285, speed: 30, interval: 1.6,
    cost: 240, cooldown: 8.5, kb: 2, ranged: true, area: true, areaRadius: 75, unlockStage: 10,
    ab: { slow: 2.5 },
    abText: '범위 · 2.5초 둔화',
    desc: '서리를 흩뿌려 적 무리의 발과 공격을 함께 늦춘다.'
  }),
  mk({
    id: 'catapult', name: '투석기', role: '공성', shape: 'catapult',
    body: '#6b4b2a', accent: '#3d2b18', tunic: '#6b4b2a',
    hp: 760, atk: 340, range: 440, speed: 18, interval: 3.2,
    cost: 340, cooldown: 15, kb: 1, ranged: true, area: true, areaRadius: 110,
    scale: 1.15, unlockStage: 11,
    abText: '초장거리 범위',
    desc: '전장 반대편까지 바위를 던진다. 몰려오는 적을 통째로 정리.'
  }),
  mk({
    id: 'duelist', name: '결투가', role: '암살', shape: 'duelist',
    body: '#2b3038', accent: '#d8dde3', tunic: '#4a3a6b',
    hp: 640, atk: 95, range: 72, speed: 62, interval: 0.9,
    cost: 265, cooldown: 9.0, kb: 2, unlockStage: 12,
    ab: { crit: { chance: 0.3, mul: 2.6 }, lifesteal: 0.35 },
    abText: '30% 치명타 2.6배 · 흡혈 35%',
    desc: '급소만 노리고 벤 만큼 회복한다. 오래 살아남을수록 무서워진다.'
  }),
  mk({
    id: 'sniper', name: '석궁 저격수', role: '관통', shape: 'sniper',
    body: '#2b3038', accent: '#9aa3ad', tunic: '#3a4450',
    hp: 300, atk: 205, range: 520, speed: 16, interval: 3.4,
    cost: 310, cooldown: 13, kb: 1, ranged: true, unlockStage: 13,
    ab: { pierce: true },
    abText: '일직선 관통 · 사거리 520',
    desc: '거대 석궁으로 전선을 꿰뚫는다. 한 발이 줄 서 있는 적 전부를 관통한다.'
  }),
  mk({
    id: 'mage', name: '대마법사', role: '섬멸', shape: 'mage',
    body: '#3a2d6b', accent: '#8fd8ff', tunic: '#3a2d6b',
    hp: 3400, atk: 430, range: 140, speed: 25, interval: 2.0,
    cost: 520, cooldown: 42, kb: 1, area: true, areaRadius: 130, scale: 1.3, unlockStage: 14,
    abText: '광역 폭발 · 20% 기절',
    ab: { stun: { chance: 0.2, dur: 1.2 } },
    desc: '왕국의 최종 카드. 폭발에 휘말린 적은 종종 얼어붙는다.'
  }),
  mk({
    id: 'colossus', name: '강철 거인', role: '불굴', shape: 'colossus',
    body: '#4a5560', accent: '#c8ced6', tunic: '#7a8894',
    hp: 4400, atk: 190, range: 92, speed: 16, interval: 2.4,
    cost: 470, cooldown: 30, kb: 1, scale: 1.45, unlockStage: 16,
    ab: { kbImmune: true, barrier: 280, radius: 210, interval: 6 },
    abText: '넉백 면역 · 주변 아군 보호막 280',
    desc: '밀리지 않는 강철 덩어리. 6초마다 주변 아군에게 보호막을 씌운다.'
  }),
  mk({
    id: 'necro', name: '사령술사', role: '소환', shape: 'necro',
    body: '#2b3038', accent: '#9de08e', tunic: '#2f3f2f',
    hp: 760, atk: 45, range: 210, speed: 24, interval: 2.0,
    cost: 395, cooldown: 22, kb: 1, ranged: true, unlockStage: 18,
    ab: { summon: { id: 'skeleton', n: 2 }, interval: 6 },
    abText: '6초마다 해골 병사 2기 소환',
    desc: '쓰러진 병사를 다시 세운다. 소환된 해골은 공짜로 전선을 채운다.'
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
const ROSTER_UNITS = UNITS.filter(u => u.unlockStage <= 100);

/* -------------------- 적: 오크 군단 -------------------- */
const ENEMIES = {
  goblin:   { name: '고블린 졸개', body: '#4d6b3a', accent: '#8a5a2a', tunic: '#3f5a2f', shape: 'goblin',
              hp: 220, atk: 26, range: 60, speed: 42, interval: 1.1, kb: 2, gold: 12, scale: .85 },
  orcspear: { name: '오크 창병', body: '#4a6b46', accent: '#b0b6bd', tunic: '#3d5a3a', shape: 'orcspear',
              hp: 340, atk: 55, range: 120, speed: 40, interval: 1.4, kb: 2, gold: 18 },
  ogre:     { name: '오우거', body: '#6b7a52', accent: '#4a3520', tunic: '#5a6a44', shape: 'ogre',
              hp: 2400, atk: 30, range: 62, speed: 24, interval: 1.6, kb: 1, gold: 34, scale: 1.2 },
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
              hp: 3300, atk: 62, range: 62, speed: 22, interval: 1.6, kb: 1, gold: 48, scale: 1.15,
              ab: { kbImmune: true } },
  wraith:   { name: '망령', body: '#8fa0b5', accent: '#5de0d0', tunic: '#6a7c92', shape: 'wraith',
              hp: 820, atk: 92, range: 70, speed: 66, interval: 1.2, kb: 1, gold: 45,
              ab: { deathBomb: { dmg: 190, radius: 115 } } },
  dark:     { name: '흑기사', body: '#22242c', accent: '#8e2f3a', tunic: '#2f3038', shape: 'dark',
              hp: 2100, atk: 210, range: 90, speed: 34, interval: 1.9, kb: 1, gold: 60, scale: 1.1 },
  troll:    { name: '트롤 대장', body: '#5c7040', accent: '#3a2418', tunic: '#4a5c34', shape: 'troll',
              hp: 9000, atk: 480, range: 150, speed: 20, interval: 2.4, kb: 1, gold: 220,
              area: true, areaRadius: 130, scale: 1.7, boss: true },
  lich:     { name: '리치', body: '#d9d4c4', accent: '#6f4bb5', tunic: '#c4bfae', shape: 'lich',
              hp: 5200, atk: 330, range: 100, speed: 28, interval: 2.0, kb: 1, gold: 130,
              scale: 1.3, boss: true, ab: { summon: { id: 'goblin', n: 1 }, interval: 7 } },
  frostgiant:{ name: '서리 거인', body: '#9fc6d8', accent: '#ffffff', tunic: '#7fa8bd', shape: 'frostgiant',
              hp: 12500, atk: 520, range: 165, speed: 18, interval: 2.6, kb: 1, gold: 300,
              area: true, areaRadius: 145, scale: 1.8, boss: true, ab: { slow: 3 } },
  warlord:  { name: '오크 대군주', body: '#3f5a3c', accent: '#c0392b', tunic: '#2f4a2c', shape: 'warlord',
              hp: 22000, atk: 700, range: 180, speed: 17, interval: 2.6, kb: 1, gold: 600,
              area: true, areaRadius: 170, scale: 2.0, boss: true,
              ab: { push: 40, summon: { id: 'orcspear', n: 2 }, interval: 8 } }
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
      W(2,'wolf',3,1.5), W(12,'shaman',1), W(24,'ogre',2,3.0), W(38,'orcspear',5,1.2),
      W(52,'shaman',2,4.0), W(66,'spider',4,1.4) ] },
  { name: '화약 골짜기', baseHp: 7200, money: 250, rate: 34, reward: 170, waves: [
      W(2,'goblin',5,1.3), W(12,'powder',2,3.0), W(26,'ballista',3,1.8), W(42,'powder',3,2.4),
      W(58,'wolf',5,1.1) ] },
  { name: '★ 트롤 대장의 요새', baseHp: 8600, money: 280, rate: 36, reward: 300, boss: true, waves: [
      W(2,'goblin',5,1.3), W(14,'ogre',2,2.6), W(28,'troll',1), W(34,'orcspear',5,1.3),
      W(50,'wolf',5,1.2), W(66,'shaman',2,3.5) ] },
  { name: '흑기사의 숲', baseHp: 9200, money: 270, rate: 36, reward: 210, waves: [
      W(2,'orcspear',5,1.2), W(14,'dark',1), W(28,'spider',5,1.2), W(44,'dark',2,3.5),
      W(60,'ballista',4,1.6) ] },
  { name: '망령의 폐허', baseHp: 10000, money: 280, rate: 37, reward: 230, waves: [
      W(2,'wolf',5,1.0), W(14,'wraith',2,2.6), W(28,'powder',3,2.2), W(44,'wraith',3,2.4),
      W(60,'ballista',4,1.6), W(76,'ogre',3,2.2) ] },
  { name: '리치의 재림', baseHp: 11000, money: 300, rate: 38, reward: 260, boss: true, waves: [
      W(2,'goblin',6,1.1), W(14,'lich',1), W(20,'orcspear',5,1.2), W(36,'lich',1),
      W(50,'powder',4,2.0), W(68,'dark',3,3.0) ] },
  { name: '방패벽 관문', baseHp: 12000, money: 300, rate: 39, reward: 285, waves: [
      W(2,'orcshield',2,3.0), W(16,'ballista',4,1.5), W(32,'orcshield',3,2.6), W(50,'wolf',7,0.9),
      W(66,'shaman',3,3.0), W(84,'dark',3,2.6) ] },
  { name: '★ 두 트롤의 문', baseHp: 13000, money: 320, rate: 40, reward: 420, boss: true, waves: [
      W(2,'goblin',6,1.1), W(14,'troll',1), W(24,'orcspear',6,1.1), W(40,'troll',1),
      W(52,'dark',3,2.6), W(70,'powder',5,1.8) ] },
  { name: '역병의 늪', baseHp: 14500, money: 320, rate: 41, reward: 330, waves: [
      W(2,'spider',7,0.9), W(16,'wraith',4,2.2), W(34,'shaman',3,2.6), W(52,'orcshield',4,2.0),
      W(70,'powder',6,1.8), W(90,'lich',1) ] },
  { name: '★ 서리 거인의 고개', baseHp: 15500, money: 340, rate: 42, reward: 480, boss: true, waves: [
      W(2,'orcspear',6,1.1), W(16,'ballista',4,1.5), W(30,'frostgiant',1), W(44,'wolf',7,0.9),
      W(62,'orcshield',3,2.4), W(82,'dark',4,2.4) ] },
  { name: '대군의 진격', baseHp: 18000, money: 340, rate: 43, reward: 420, waves: [
      W(2,'goblin',8,0.9), W(14,'troll',1), W(26,'dark',4,2.2), W(44,'orcshield',4,1.8),
      W(62,'ballista',7,1.2), W(82,'lich',2,5.0), W(104,'wraith',6,1.2) ] },
  { name: '대군주의 전조', baseHp: 20000, money: 360, rate: 45, reward: 470, boss: true, waves: [
      W(2,'wolf',7,0.9), W(16,'frostgiant',1), W(30,'dark',5,2.0), W(50,'troll',1),
      W(64,'shaman',4,2.4), W(84,'orcshield',4,2.2), W(104,'powder',7,1.5) ] },
  { name: '★ 오크 대군주의 왕좌', baseHp: 24000, money: 400, rate: 48, reward: 900, boss: true, waves: [
      W(2,'goblin',8,0.9), W(14,'orcshield',4,1.8), W(28,'troll',1), W(40,'dark',5,2.0),
      W(58,'warlord',1), W(70,'lich',2,4.0), W(88,'frostgiant',1), W(104,'ballista',8,1.1),
      W(126,'wraith',8,0.9) ] }
];

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
             desc: '아군 성채 체력 +10%/레벨' }
};

/* -------------------- 병종 레벨 -------------------- */
const UNIT_LEVEL_HARD_CAP = 15;
const UNIT_LEVEL_BASE_CAP = 5;
const UNIT_LEVEL_GAIN = 0.10;

function unitLevelCap(cleared) {
  return Math.min(UNIT_LEVEL_HARD_CAP, UNIT_LEVEL_BASE_CAP + (cleared || 0));
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
