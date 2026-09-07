/* =======================================================================
 *  막대 왕국 전쟁 (Stick Kingdom War) - 게임 데이터
 *  컨셉: 졸라맨 왕국군 vs 오크 군단 (중세)
 * ======================================================================= */

// 유닛 공통 기본값
const UNIT_DEFAULTS = {
  hp: 100, atk: 10, range: 60, speed: 40, interval: 1.0,
  cost: 50, cooldown: 3, kb: 2, area: false, areaRadius: 0,
  ranged: false, scale: 1, unlockStage: 1, desc: ''
};

function mk(o) { return Object.assign({}, UNIT_DEFAULTS, o); }

/* -------------------- 아군 유닛: 왕국군 -------------------- */
const UNITS = [
  mk({
    id: 'spear', name: '창병', role: '근접',
    body: '#2f3540', accent: '#b9c2cc', shape: 'spear',
    hp: 260, atk: 34, range: 62, speed: 46, interval: 1.0,
    cost: 55, cooldown: 2.2, kb: 3, unlockStage: 1,
    desc: '값싸고 빨리 나오는 징집병. 머릿수로 전선을 채운다.'
  }),
  mk({
    id: 'shield', name: '방패병', role: '방어',
    body: '#2f3540', accent: '#8d6a3f', shape: 'shield',
    hp: 1900, atk: 14, range: 58, speed: 26, interval: 1.5,
    cost: 120, cooldown: 6.5, kb: 1, scale: 1.1, unlockStage: 2,
    desc: '두꺼운 방패로 전선을 버틴다. 공격력은 없다시피 하다.'
  }),
  mk({
    id: 'archer', name: '궁수', role: '원거리',
    body: '#2f3540', accent: '#3f7a43', shape: 'archer',
    hp: 220, atk: 62, range: 265, speed: 36, interval: 1.25,
    cost: 145, cooldown: 5.0, kb: 2, ranged: true, unlockStage: 3,
    desc: '뒤에서 활을 쏜다. 앞줄이 뚫리면 순식간에 쓰러진다.'
  }),
  mk({
    id: 'berserk', name: '광전사', role: '돌격',
    body: '#2f3540', accent: '#a63a2e', shape: 'berserk',
    hp: 470, atk: 42, range: 70, speed: 74, interval: 0.45,
    cost: 200, cooldown: 6.0, kb: 3, unlockStage: 5,
    desc: '쌍도끼를 미친 듯이 휘두른다. 방패병 뒤에 세워야 산다.'
  }),
  mk({
    id: 'bomber', name: '화약병', role: '자폭형',
    body: '#2f3540', accent: '#4b3a2a', shape: 'bomber',
    hp: 300, atk: 260, range: 78, speed: 96, interval: 3.0,
    cost: 165, cooldown: 8.0, kb: 1, area: true, areaRadius: 95, unlockStage: 7,
    desc: '적진까지 달려가 화약통을 터뜨린다. 한 방이 아주 아프다.'
  }),
  mk({
    id: 'knight', name: '기사', role: '주력',
    body: '#2f3540', accent: '#c8ced6', shape: 'knight',
    hp: 1250, atk: 135, range: 76, speed: 32, interval: 1.9,
    cost: 245, cooldown: 9.5, kb: 2, area: true, areaRadius: 80, scale: 1.1, unlockStage: 9,
    desc: '대검을 휘둘러 앞의 여럿을 함께 벤다. 왕국군의 중핵.'
  }),
  mk({
    id: 'catapult', name: '투석기', role: '공성',
    body: '#6b4b2a', accent: '#3d2b18', shape: 'catapult',
    hp: 760, atk: 340, range: 440, speed: 18, interval: 3.2,
    cost: 340, cooldown: 15, kb: 1, ranged: true, area: true, areaRadius: 110, scale: 1.15, unlockStage: 11,
    desc: '전장 반대편까지 바위를 던진다. 몰려오는 적을 통째로 정리.'
  }),
  mk({
    id: 'mage', name: '대마법사', role: '최종병기',
    body: '#3a2d6b', accent: '#8fd8ff', shape: 'mage',
    hp: 3400, atk: 430, range: 140, speed: 25, interval: 2.0,
    cost: 520, cooldown: 42, kb: 1, area: true, areaRadius: 130, scale: 1.3, unlockStage: 14,
    desc: '왕국 최후의 카드. 나오기까지 오래 걸리지만 전황을 뒤집는다.'
  })
];

const UNIT_BY_ID = {};
UNITS.forEach(u => { UNIT_BY_ID[u.id] = u; });

/* -------------------- 적 유닛: 오크 군단 -------------------- */
const ENEMIES = {
  goblin:   { name: '고블린 졸개', body: '#4d6b3a', accent: '#8a5a2a', shape: 'goblin',
              hp: 220, atk: 26, range: 60, speed: 42, interval: 1.1, kb: 2, gold: 12, scale: .85 },
  orcspear: { name: '오크 창병', body: '#4a6b46', accent: '#b0b6bd', shape: 'orcspear',
              hp: 340, atk: 55, range: 120, speed: 40, interval: 1.4, kb: 2, gold: 18 },
  ogre:     { name: '오우거', body: '#6b7a52', accent: '#4a3520', shape: 'ogre',
              hp: 2400, atk: 30, range: 62, speed: 24, interval: 1.6, kb: 1, gold: 34, scale: 1.2 },
  wolf:     { name: '늑대 기수', body: '#5a5f66', accent: '#7a4a2a', shape: 'wolf',
              hp: 380, atk: 70, range: 62, speed: 92, interval: 0.7, kb: 3, gold: 22 },
  ballista: { name: '석궁 사수', body: '#4a6b46', accent: '#6b4b2a', shape: 'ballista',
              hp: 520, atk: 40, range: 330, speed: 26, interval: 0.9, kb: 2, gold: 40, ranged: true },
  powder:   { name: '화약통 고블린', body: '#4d6b3a', accent: '#6e4a24', shape: 'powder',
              hp: 700, atk: 230, range: 80, speed: 62, interval: 3.0, kb: 1, gold: 38,
              area: true, areaRadius: 100 },
  dark:     { name: '흑기사', body: '#22242c', accent: '#8e2f3a', shape: 'dark',
              hp: 2100, atk: 210, range: 90, speed: 34, interval: 1.9, kb: 1, gold: 60, scale: 1.1 },
  troll:    { name: '트롤 대장', body: '#5c7040', accent: '#3a2418', shape: 'troll',
              hp: 9000, atk: 480, range: 150, speed: 20, interval: 2.4, kb: 1, gold: 220,
              area: true, areaRadius: 130, scale: 1.7, boss: true },
  warlord:  { name: '오크 대군주', body: '#3f5a3c', accent: '#c0392b', shape: 'warlord',
              hp: 22000, atk: 700, range: 180, speed: 17, interval: 2.6, kb: 1, gold: 600,
              area: true, areaRadius: 170, scale: 2.0, boss: true },
  lich:     { name: '리치', body: '#d9d4c4', accent: '#6f4bb5', shape: 'lich',
              hp: 5200, atk: 330, range: 100, speed: 28, interval: 2.0, kb: 1, gold: 130,
              scale: 1.3, boss: true }
};

/* -------------------- 스테이지 20개 -------------------- */
/* wave: { t: 등장 시각(초), e: 적 ID, n: 마리 수, gap: 간격(초) } */
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
  { name: '석궁수의 언덕', baseHp: 5600, money: 230, rate: 31, reward: 120, waves: [
      W(2,'orcspear',3,1.5), W(12,'ballista',2,2.4), W(26,'goblin',6,1.0), W(38,'ballista',3,2.0),
      W(52,'ogre',2,2.6) ] },
  { name: '화약 골짜기', baseHp: 6200, money: 240, rate: 32, reward: 135, waves: [
      W(2,'goblin',4,1.4), W(12,'powder',2,3.0), W(24,'orcspear',4,1.4), W(38,'powder',3,2.6),
      W(54,'wolf',4,1.2) ] },
  { name: '서리 성채', baseHp: 7000, money: 250, rate: 33, reward: 150, waves: [
      W(2,'wolf',3,1.5), W(14,'ogre',2,3.0), W(28,'ballista',3,1.8), W(44,'orcspear',5,1.2),
      W(58,'powder',2,2.6) ] },
  { name: '흑기사의 숲', baseHp: 7800, money: 260, rate: 34, reward: 170, waves: [
      W(2,'goblin',5,1.3), W(14,'dark',1), W(28,'ballista',3,1.8), W(42,'dark',2,4.0),
      W(58,'wolf',5,1.1) ] },
  { name: '★ 트롤 대장의 요새', baseHp: 8600, money: 280, rate: 36, reward: 300, boss: true, waves: [
      W(2,'goblin',5,1.3), W(14,'ogre',2,2.6), W(28,'troll',1), W(34,'orcspear',5,1.3),
      W(50,'wolf',5,1.2), W(66,'dark',2,3.5) ] },
  { name: '지하 미로', baseHp: 9200, money: 270, rate: 36, reward: 200, waves: [
      W(2,'orcspear',5,1.2), W(14,'powder',3,2.4), W(28,'dark',2,3.5), W(44,'ballista',4,1.6),
      W(60,'ogre',3,2.4) ] },
  { name: '불타는 야영지', baseHp: 10000, money: 280, rate: 37, reward: 220, waves: [
      W(2,'wolf',5,1.0), W(14,'wolf',6,0.9), W(28,'dark',2,3.0), W(44,'powder',4,2.2),
      W(60,'ballista',4,1.6), W(76,'ogre',3,2.2) ] },
  { name: '리치의 재림', baseHp: 11000, money: 300, rate: 38, reward: 260, boss: true, waves: [
      W(2,'goblin',6,1.1), W(14,'lich',1), W(20,'orcspear',5,1.2), W(36,'lich',1),
      W(50,'powder',4,2.0), W(68,'dark',3,3.0) ] },
  { name: '겨울 관문', baseHp: 12000, money: 300, rate: 39, reward: 280, waves: [
      W(2,'ballista',4,1.5), W(16,'ogre',3,2.2), W(32,'dark',3,2.8), W(50,'wolf',7,0.9),
      W(66,'powder',5,2.0), W(84,'ballista',5,1.4) ] },
  { name: '★ 두 트롤의 문', baseHp: 13000, money: 320, rate: 40, reward: 420, boss: true, waves: [
      W(2,'goblin',6,1.1), W(14,'troll',1), W(24,'orcspear',6,1.1), W(40,'troll',1),
      W(52,'dark',3,2.6), W(70,'powder',5,1.8) ] },
  { name: '역병의 폐허', baseHp: 14500, money: 320, rate: 41, reward: 320, waves: [
      W(2,'wolf',6,1.0), W(16,'dark',4,2.4), W(34,'ballista',6,1.3), W(52,'ogre',4,2.0),
      W(70,'powder',6,1.8), W(90,'lich',1) ] },
  { name: '심연의 관문', baseHp: 16000, money: 330, rate: 42, reward: 360, waves: [
      W(2,'orcspear',7,1.0), W(16,'dark',4,2.2), W(34,'lich',2,6.0), W(54,'ballista',6,1.2),
      W(74,'wolf',8,0.8), W(92,'powder',6,1.6) ] },
  { name: '대군의 진격', baseHp: 18000, money: 340, rate: 43, reward: 400, waves: [
      W(2,'goblin',8,0.9), W(14,'troll',1), W(26,'dark',4,2.2), W(44,'ogre',5,1.8),
      W(62,'ballista',7,1.2), W(82,'lich',2,5.0), W(104,'wolf',8,0.8) ] },
  { name: '대군주의 전조', baseHp: 20000, money: 360, rate: 45, reward: 460, boss: true, waves: [
      W(2,'wolf',7,0.9), W(16,'troll',1), W(30,'dark',5,2.0), W(50,'troll',1),
      W(64,'ballista',7,1.2), W(84,'lich',2,4.5), W(104,'powder',7,1.5) ] },
  { name: '★ 오크 대군주의 왕좌', baseHp: 24000, money: 400, rate: 48, reward: 900, boss: true, waves: [
      W(2,'goblin',8,0.9), W(14,'ogre',4,1.8), W(28,'troll',1), W(40,'dark',5,2.0),
      W(58,'warlord',1), W(70,'lich',2,4.0), W(88,'ballista',8,1.1), W(110,'troll',1),
      W(126,'wolf',9,0.8) ] }
];

/* -------------------- 메타 강화 -------------------- */
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

function upgradeCost(key, level) {
  const u = UPGRADES[key];
  return Math.round(u.base * Math.pow(u.step, level));
}
