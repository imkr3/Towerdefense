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
    desc: '값싸고 빨리 나오는 징집병입니다. 긴 창으로 적보다 한발 먼저 찌릅니다.'
  }),
  mk({
    id: 'shield', name: '방패병', role: '방어', shape: 'shield',
    body: '#2b3038', accent: '#8d6a3f', tunic: '#6b7480',
    hp: 2300, atk: 30, range: 58, speed: 26, interval: 1.5,
    cost: 120, cooldown: 6.5, kb: 1, scale: 1.1, unlockStage: 2,
    desc: '두꺼운 방패로 전선을 지킵니다. 오래 버티며 조금씩 적을 깎습니다.'
  }),
  mk({
    id: 'archer', name: '궁수', role: '원거리', shape: 'archer',
    body: '#2b3038', accent: '#3f7a43', tunic: '#4a7c4e',
    hp: 300, atk: 80, range: 265, speed: 36, interval: 1.25,
    cost: 145, cooldown: 5.0, kb: 2, ranged: true, unlockStage: 3,
    desc: '뒤에서 활을 쏩니다. 앞줄이 뚫리면 순식간에 쓰러집니다.'
  }),
  mk({
    id: 'priest', name: '사제', role: '치유', shape: 'priest',
    body: '#2b3038', accent: '#e8d9a8', tunic: '#f0ead6',
    hp: 460, atk: 0, range: 0, speed: 30, interval: 2.0,
    cost: 175, cooldown: 12, kb: 1, unlockStage: 4,
    ab: { heal: 120, radius: 230, interval: 2.4, noAttack: true },
    abText: '주변 아군 회복 · 공격 안 함',
    desc: '직접 싸우지 않는 대신 2.4초마다 주변 아군을 치료합니다.'
  }),
  mk({
    id: 'berserk', castFx: 'slash', name: '광전사', role: '돌격', shape: 'berserk',
    body: '#2b3038', accent: '#b0b6bd', tunic: '#a63a2e',
    hp: 690, atk: 54, range: 70, speed: 74, interval: 0.45,
    cost: 200, cooldown: 6.0, kb: 3, unlockStage: 5,
    desc: '쌍도끼를 미친 듯이 휘두릅니다. 방패병 뒤에 세워야 오래 살아남습니다.'
  }),
  mk({
    id: 'venom', name: '독침 궁수', short: '독침궁수', role: '중독', shape: 'venom',
    body: '#2b3038', accent: '#7fbf3f', tunic: '#3f6b4a',
    hp: 250, atk: 32, range: 250, speed: 38, interval: 1.4,
    cost: 190, cooldown: 6.5, kb: 2, ranged: true, unlockStage: 6,
    ab: { poison: { dps: 48, dur: 5 } },
    abText: '중독 48/초 · 5초',
    desc: '독을 바른 화살을 쏩니다. 체력이 많은 적일수록 독이 잘 듣습니다.'
  }),
  mk({
    id: 'bomber', castFx: 'firestorm', name: '화약병', role: '자폭형', shape: 'bomber',
    body: '#2b3038', accent: '#6b4b2a', tunic: '#8a6a3a',
    hp: 300, atk: 300, range: 78, speed: 96, interval: 3.0,
    cost: 165, cooldown: 8.0, kb: 1, area: true, areaRadius: 95, unlockStage: 7,
    abText: '범위 폭발',
    desc: '적진까지 달려가 화약통을 터뜨립니다. 한 방이 매우 강력합니다.'
  }),
  mk({
    id: 'merchant', name: '종군 상인', short: '상인', role: '보급', shape: 'merchant',
    body: '#2b3038', accent: '#c9a227', tunic: '#8a5a2a',
    hp: 620, atk: 0, range: 0, speed: 0, interval: 3.0,
    cost: 150, cooldown: 20, kb: 1, unlockStage: 8, maxActive: 3,
    ab: { gold: 12, hold: true, noAttack: true, interval: 3 },
    abText: '초당 군자금 +12 · 최대 3명 · 공격 강화 미적용',
    desc: '성문 앞에 자리를 잡고 물자를 팝니다. 살아 있는 동안 군자금이 더 빨리 찹니다.'
  }),
  mk({
    id: 'knight', castFx: 'slash', name: '기사', role: '주력', shape: 'knight',
    body: '#2b3038', accent: '#c8ced6', tunic: '#8e2f3a',
    hp: 1600, atk: 165, range: 76, speed: 32, interval: 1.9,
    cost: 245, cooldown: 9.5, kb: 2, area: true, areaRadius: 80, scale: 1.1, unlockStage: 9,
    abText: '범위 공격',
    desc: '대검을 휘둘러 앞의 여러 적을 함께 벱니다. 왕국군의 중추입니다.'
  }),
  mk({
    id: 'frost', castFx: 'iceburst', name: '서리 마도사', short: '마도사', role: '둔화', shape: 'frost',
    body: '#2b3038', accent: '#8fd8ff', tunic: '#2f5f8e',
    hp: 320, atk: 58, range: 285, speed: 30, interval: 1.6,
    cost: 240, cooldown: 8.5, kb: 2, ranged: true, area: true, areaRadius: 75, unlockStage: 10,
    ab: { slow: 2.5 },
    abText: '범위 · 2.5초 둔화',
    desc: '서리를 흩뿌려 적 무리의 이동과 공격을 함께 늦춥니다.'
  }),
  mk({
    id: 'catapult', castFx: 'shockwave', name: '투석기', role: '공성', shape: 'catapult',
    body: '#6b4b2a', accent: '#3d2b18', tunic: '#6b4b2a',
    hp: 760, atk: 340, range: 440, speed: 18, interval: 3.2,
    cost: 340, cooldown: 15, kb: 1, ranged: true, area: true, areaRadius: 110,
    scale: 1.15, unlockStage: 11,
    abText: '초장거리 범위',
    desc: '전장 반대편까지 바위를 던집니다. 몰려오는 적을 한꺼번에 정리합니다.'
  }),
  mk({
    id: 'duelist', castFx: 'slash', name: '결투가', role: '암살', shape: 'duelist',
    body: '#2b3038', accent: '#d8dde3', tunic: '#4a3a6b',
    hp: 640, atk: 95, range: 72, speed: 62, interval: 0.9,
    cost: 265, cooldown: 9.0, kb: 2, unlockStage: 12,
    ab: { crit: { chance: 0.3, mul: 2.6 }, lifesteal: 0.35 },
    abText: '30% 치명타 2.6배 · 흡혈 35%',
    desc: '급소만 노리고, 벤 만큼 회복합니다. 오래 살아남을수록 무서워집니다.'
  }),
  mk({
    id: 'sniper', castFx: 'holy', name: '석궁 저격수', short: '저격수', role: '관통', shape: 'sniper',
    body: '#2b3038', accent: '#9aa3ad', tunic: '#3a4450',
    hp: 300, atk: 205, range: 620, speed: 16, interval: 3.4,
    cost: 310, cooldown: 13, kb: 1, ranged: true, unlockStage: 13,
    ab: { pierce: true },
    abText: '일직선 관통 · 사거리 520',
    desc: '거대 석궁으로 전선을 꿰뚫습니다. 한 발로 줄지어 선 적을 모두 관통합니다.'
  }),
  mk({
    id: 'mage', castFx: 'runes', name: '대마법사', role: '섬멸', shape: 'mage',
    body: '#3a2d6b', accent: '#8fd8ff', tunic: '#3a2d6b',
    hp: 3400, atk: 430, range: 140, speed: 25, interval: 2.0,
    cost: 520, cooldown: 42, kb: 1, area: true, areaRadius: 130, scale: 1.3, unlockStage: 14,
    abText: '광역 폭발 · 20% 기절',
    ab: { stun: { chance: 0.2, dur: 1.2 } },
    desc: '왕국의 최종 병기입니다. 폭발에 휘말린 적은 종종 얼어붙습니다.'
  }),
  mk({
    id: 'colossus', castFx: 'shockwave', name: '강철 거인', short: '거인', role: '불굴', shape: 'colossus',
    body: '#4a5560', accent: '#c8ced6', tunic: '#7a8894',
    hp: 4400, atk: 190, range: 92, speed: 16, interval: 2.4,
    cost: 470, cooldown: 30, kb: 1, scale: 1.45, unlockStage: 16,
    ab: { kbImmune: true, barrier: 280, radius: 210, interval: 6 },
    abText: '넉백 면역 · 주변 아군 보호막 280',
    desc: '밀리지 않는 강철 덩어리입니다. 6초마다 주변 아군에게 보호막을 씌웁니다.'
  }),
  mk({
    id: 'necro', castFx: 'pillar', name: '사령술사', role: '소환', shape: 'necro',
    body: '#2b3038', accent: '#9de08e', tunic: '#2f3f2f',
    hp: 760, atk: 45, range: 210, speed: 24, interval: 2.0,
    cost: 395, cooldown: 22, kb: 1, ranged: true, unlockStage: 18,
    ab: { summon: { id: 'skeleton', n: 2 }, interval: 6 },
    abText: '6초마다 해골 병사 2기 소환',
    desc: '쓰러진 병사를 다시 일으킵니다. 소환된 해골이 공짜로 전선을 채웁니다.'
  }),
  mk({
    id: 'herald', name: '나팔수', role: '지휘', shape: 'herald',
    body: '#2b3038', accent: '#e8c65a', tunic: '#c9a227',
    hp: 520, atk: 0, range: 0, speed: 34, interval: 3.0,
    cost: 195, cooldown: 14, kb: 2, unlockStage: 6,
    ab: { haste: { mul: 0.78, dur: 4 }, radius: 240, interval: 3.5, noAttack: true },
    abText: '주변 아군 공격 간격 22% 감소',
    desc: '진군 나팔을 붑니다. 직접 싸우지 않지만 주변 아군의 공격 속도가 크게 오릅니다.'
  }),
  mk({
    id: 'longbow', name: '대궁병', role: '장거리', shape: 'longbow',
    body: '#2b3038', accent: '#6b8f3f', tunic: '#3f5a2f',
    hp: 340, atk: 111, range: 470, speed: 30, interval: 2.0,
    cost: 225, cooldown: 7.0, kb: 2, ranged: true, unlockStage: 9,
    abText: '사거리 400 · 뒤에서 안전하게',
    desc: '장궁으로 전선 훨씬 뒤에서 쏩니다. 긴 사거리가 최대 무기입니다.'
  }),
  mk({
    id: 'pyro', castFx: 'firestorm', name: '불꽃술사', role: '화염', shape: 'pyro',
    body: '#2b3038', accent: '#ff8a3c', tunic: '#8e3a1f',
    hp: 340, atk: 70, range: 235, speed: 32, interval: 1.8,
    cost: 255, cooldown: 9.0, kb: 2, ranged: true, area: true, areaRadius: 90,
    unlockStage: 12,
    ab: { burn: { dps: 70, dur: 4 } },
    abText: '범위 화염 · 화상 70/초 4초',
    desc: '불덩이를 던져 넓게 태웁니다. 적이 몰려 있을수록 효과적입니다.'
  }),
  mk({
    id: 'paladin', castFx: 'holy', name: '성기사', role: '불굴', shape: 'paladin',
    body: '#2b3038', accent: '#f0e6c8', tunic: '#c9a227',
    hp: 2100, atk: 175, range: 84, speed: 26, interval: 2.0,
    cost: 380, cooldown: 18, kb: 1, scale: 1.15, unlockStage: 15,
    ab: { revive: 0.6, heal: 70, radius: 170, interval: 4 },
    abText: '쓰러져도 1회 부활 · 주변 아군 회복',
    desc: '한 번 쓰러져도 다시 일어납니다. 버티면서 주변을 치유하는 전선의 기둥입니다.'
  }),
  mk({
    id: 'engineer', name: '공병', role: '축성', shape: 'engineer',
    body: '#2b3038', accent: '#8a6a3a', tunic: '#6b5a3f',
    hp: 520, atk: 40, range: 70, speed: 40, interval: 2.0,
    cost: 185, cooldown: 16, kb: 2, unlockStage: 17,
    ab: { summon: { id: 'barricade', n: 1 }, interval: 6 },
    abText: '6초마다 방벽 설치',
    desc: '전진하며 나무 방벽을 세웁니다. 방벽은 움직이지 않고 적의 공격을 대신 받아 냅니다.'
  }),
  mk({
    id: 'rogue', castFx: 'slash', name: '쌍검 도적', role: '연타', shape: 'rogue',
    body: '#2b3038', accent: '#c8ced6', tunic: '#3a3f4a',
    hp: 700, atk: 62, range: 68, speed: 86, interval: 0.35,
    cost: 300, cooldown: 11, kb: 3, unlockStage: 19,
    ab: { crit: { chance: 0.22, mul: 2.2 }, lifesteal: 0.2 },
    abText: '초당 3회 연타 · 치명타 22%',
    desc: '눈에 보이지 않는 속도로 두 자루 창을 번갈아 찌릅니다.'
  }),
  mk({id:'runeguard',name:'룬 수호병',role:'보호막',shape:'runeguard',
    body:'#384d68',accent:'#76e5eb',tunic:'#315783',hp:1600,atk:32,range:65,speed:28,interval:1.5,
    cost:240,cooldown:13,kb:1,unlockStage:7,maxActive:2,
    ab:{barrier:95,radius:145,interval:6},abText:'6초마다 주변 보호막 95 · 최대 2명',
    desc:'룬 방패로 좁은 전선을 지킵니다. 보호막은 중첩되지 않고 더 큰 값으로 갱신됩니다.'}),
  mk({id:'musketeer',name:'왕실 총사',role:'관통',shape:'musketeer',
    body:'#35364d',accent:'#edbc70',tunic:'#754764',hp:420,atk:225,range:350,speed:32,interval:2.2,
    cost:285,cooldown:11,kb:2,unlockStage:10,ranged:true,
    ab:{pierce:true},abText:'사선 위 적 관통 · 느린 장전',
    desc:'긴 총신으로 밀집 대열을 관통합니다. 빠른 적이 접근하지 못하게 하세요.'}),
  mk({id:'purifier',name:'새벽 정화사',role:'정화',shape:'purifier',
    body:'#d5ddd6',accent:'#a4f6cc',tunic:'#478479',hp:550,atk:0,range:0,speed:31,interval:3,
    cost:175,cooldown:16,kb:2,unlockStage:12,maxActive:2,
    ab:{cleanse:true,heal:100,radius:200,interval:4,noAttack:true},abText:'4초마다 중독·화상·둔화 해제 및 회복 · 최대 2명',
    desc:'향로의 빛으로 상태이상을 정화합니다. 직접 공격하지 않으며, 기절은 해제하지 못합니다.'}),
  mk({id:'frostlancer',name:'서리 창기사',role:'둔화',shape:'frostlancer',
    body:'#4b6482',accent:'#c0efff',tunic:'#648aa8',hp:1250,atk:110,range:145,speed:39,interval:1.5,
    cost:270,cooldown:10,kb:2,unlockStage:14,
    ab:{slow:1.6},abText:'타격 시 1.6초 둔화',
    desc:'긴 얼음 창으로 돌격을 저지합니다. 방패 뒤에서 늑대 기수를 견제하세요.'}),
  /* ---------- 3.0 새 전장 병종: 새 적들을 받아칠 손 ---------- */
  mk({id:'javelin',name:'투창병',role:'투창',shape:'javelin',
    body:'#2b3038',accent:'#d0b07a',tunic:'#7a5a2e',hp:420,atk:58,range:175,speed:44,interval:1.35,
    cost:130,kb:2,ranged:true,unlockStage:5,
    ab:{breaker:1.3},abText:'파쇄 · 갑주 무시 · 중장갑·보스에게 1.3배',
    desc:'무거운 투창을 던져 방패째 꿰뚫습니다. 궁수보다 짧게 던지지만 단단한 적에게 강합니다.'}),
  mk({id:'falconer',name:'매 조련사',short:'매조련사',role:'사냥',shape:'falconer',
    body:'#2b3038',accent:'#c98a3a',tunic:'#5a6b3a',hp:440,atk:110,range:380,speed:34,interval:1.6,
    cost:210,kb:2,ranged:true,unlockStage:10,
    ab:{backline:true,hunter:1.9},abText:'매가 뒷줄을 노림 · 원거리 적에게 1.9배',
    desc:'매를 날려 적 뒷줄의 궁수와 주술사부터 낚아챕니다. 앞의 덩치는 다른 병력에게 맡기세요.'}),
  mk({id:'bellringer',name:'종지기',role:'부동',shape:'bellringer',
    body:'#2b3038',accent:'#e8c65a',tunic:'#6b4a7a',hp:950,atk:0,range:0,speed:30,interval:3,
    cost:165,kb:1,unlockStage:15,maxActive:2,
    ab:{ward:{dur:3},heal:90,radius:240,interval:4,noAttack:true},
    abText:'4초마다 종소리 · 기절·둔화 풀고 3초 기절 면역 · 조금 회복 · 최대 2명',
    desc:'성당의 큰 종을 울려 휘청이는 아군을 다시 세웁니다. 기절을 거는 보스 앞에서 진가가 나옵니다.'}),
  mk({id:'lancer',name:'창기병',role:'기병 돌격',shape:'lancer',
    body:'#2b3038',accent:'#c8ced6',tunic:'#3f6bb5',hp:1500,atk:150,range:95,speed:72,interval:1.8,
    cost:320,kb:2,scale:1.15,unlockStage:21,
    ab:{charge:{mul:2.6,dist:110,push:55}},abText:'돌격 · 달려온 첫 일격 2.6배 + 밀쳐 냄',
    desc:'말을 달려 적진에 창을 꽂습니다. 달려온 만큼 첫 일격이 무겁고, 밀려났다가 다시 달리면 또 돌격합니다.'}),
  mk({id:'alchemist',name:'연금술사',role:'부식',shape:'alchemist',
    body:'#2b3038',accent:'#7fe0a0',tunic:'#4a3a6b',hp:520,atk:66,range:260,speed:30,interval:1.9,
    cost:290,kb:2,ranged:true,area:true,areaRadius:70,unlockStage:24,
    ab:{sunmark:{vuln:.2,dur:4},poison:{dps:40,dur:4}},abText:'산성 플라스크 · 범위 부식(받는 피해 +20%) · 중독',
    desc:'산이 든 플라스크를 던집니다. 녹아내린 갑옷은 누구에게 맞든 더 아픕니다.'}),
  mk({id:'monk',name:'무승',role:'부동심',shape:'monk',
    body:'#2b3038',accent:'#e8a23a',tunic:'#c0662a',hp:1400,atk:62,range:66,speed:60,interval:.55,
    cost:300,kb:2,unlockStage:27,
    ab:{unshakable:true,kbImmune:true,lifesteal:.12},abText:'부동심 · 기절·둔화·넉백 무시 · 흡혈 12%',
    desc:'산사에서 수련한 권법가입니다. 어떤 충격에도 흔들리지 않고 주먹을 쉬지 않습니다.'}),
  /* ---------- 3.3 3막 '심연의 바다' 병종: 바다 군단을 받아칠 손 ---------- */
  mk({id:'harpoon',name:'작살병',role:'작살',shape:'harpoon',castFx:'harpoon',
    body:'#2b3038',accent:'#9fd8e8',tunic:'#2f5a6b',hp:640,atk:113,range:175,speed:40,interval:1.6,
    cost:180,kb:2,ranged:true,unlockStage:31,
    ab:{breaker:1.35,slow:1.0},abText:'작살 · 갑주 무시 · 단단한 적 1.35배 · 1초 둔화',
    desc:'밧줄 달린 작살로 등딱지째 꿰고 끌어당깁니다. 집게 게와 어인을 상대하는 바닷가의 기본 병종입니다.'}),
  mk({id:'corsair',name:'해적 검사',short:'해적검사',role:'칼춤',shape:'corsair',castFx:'slash',
    body:'#2b3038',accent:'#e8c65a',tunic:'#8e2f3a',hp:1380,atk:140,range:70,speed:70,interval:.75,
    cost:260,kb:2,unlockStage:33,
    ab:{dodge:.25,lifesteal:.15},abText:'칼춤 · 공격 25% 회피 · 흡혈 15%',
    desc:'갑판 위에서 단련한 쌍검잡이입니다. 창끝을 흘려 넘기며 나가 창병의 품으로 파고듭니다.'}),
  mk({id:'beacon',name:'등대지기',role:'등불',shape:'beacon',
    body:'#2b3038',accent:'#ffe9a0',tunic:'#3f6bb5',hp:900,atk:0,range:0,speed:30,interval:3,
    cost:250,kb:1,unlockStage:34,maxActive:2,
    ab:{ward:{dur:3},barrier:170,radius:240,interval:5,noAttack:true},
    abText:'5초마다 등불 · 홀림·기절·둔화 해제와 3초 면역 · 보호막 170 · 최대 2명',
    desc:'바다 건너까지 비추는 등불을 듭니다. 세이렌의 노래에 홀린 병사도 등불 아래에선 정신을 차립니다.'}),
  mk({id:'stormcaller',name:'폭풍술사',role:'뇌우',shape:'stormcaller',castFx:'storm',
    body:'#2b3038',accent:'#9ad8ff',tunic:'#2a3a6b',hp:700,atk:130,range:280,speed:28,interval:2.2,
    cost:420,kb:2,ranged:true,area:true,areaRadius:80,unlockStage:36,
    ab:{chain:{n:3,fall:.6,range:130}},abText:'뇌우 · 범위 벼락이 세 번 튕김',
    desc:'바다 위 먹구름을 불러 벼락을 내립니다. 떼로 몰려오는 해파리와 장어에게 특히 강합니다.'}),
  mk({id:'anchorguard',name:'닻 수호병',short:'닻수호병',role:'닻',shape:'anchorguard',castFx:'tidal',
    body:'#2b3038',accent:'#8fa3b5',tunic:'#3a4a5a',hp:4200,atk:140,range:80,speed:26,interval:1.6,
    cost:460,kb:1,scale:1.25,unlockStage:38,
    ab:{kbImmune:true,armor:.3,slow:1.2,push:30},abText:'닻 · 넉백 면역 · 갑주 30% · 맞은 적 둔화',
    desc:'거대한 닻을 휘둘러 전열을 붙듭니다. 해일도 밀어내지 못하는 마지막 둑입니다.'}),
  // 4.9 기본 병종 셋 — 3막 · 4막 · 5막에서 하나씩 합류
  mk({id:'maceman',name:'철퇴병',role:'타격',shape:'maceman',castFx:'shockwave',
    body:'#2b3038',accent:'#b8a070',tunic:'#6a4a3a',hp:1500,atk:84,range:70,speed:36,interval:1.4,
    cost:230,kb:1,unlockStage:34,
    ab:{stun:{chance:.2,dur:.8},breaker:1.25},abText:'철퇴 · 20% 기절 0.8초 · 중장갑에게 1.25배',
    desc:'묵직한 철퇴로 투구째 내리칩니다. 맞은 적이 비틀거리는 사이 전열이 숨을 돌립니다.'}),
  mk({id:'axethrower',name:'도끼 투척병',short:'도끼투척',role:'근거리 투척',shape:'axethrower',
    body:'#2b3038',accent:'#c8ccd4',tunic:'#4a6a3a',hp:760,atk:76,range:200,speed:40,interval:1.3,
    cost:210,kb:2,ranged:true,area:true,areaRadius:45,unlockStage:44,
    ab:{},abText:'빙글 도는 손도끼 · 짧은 사거리 · 작은 범위',
    desc:'전열 바로 뒤에서 손도끼를 던집니다. 멀리는 못 가지만 몰려든 적을 두셋씩 찍어 냅니다.'}),
  mk({id:'siegebow',name:'발리스타',role:'공성 쇠뇌',shape:'siegebow',
    body:'#2b3038',accent:'#d8b878',tunic:'#5a4a34',hp:720,atk:100,range:420,speed:22,interval:2.6,
    cost:320,kb:2,ranged:true,unlockStage:52,
    ab:{pierce:true,breaker:1.6},abText:'거대 쇠뇌 · 일직선 관통 · 보스·중장갑에게 1.6배 · 아주 긴 사거리',
    desc:'바퀴 달린 거대한 쇠뇌입니다. 창만 한 화살이 줄지어 선 적을 꿰뚫고 갑옷까지 뚫습니다.'}),
  // 소환 전용
  mk({
    id: 'barricade', name: '나무 방벽', role: '구조물', shape: 'barricade',
    body: '#7a5a34', accent: '#5c4326', tunic: '#7a5a34',
    hp: 2000, atk: 0, range: 0, speed: 0, interval: 3,
    cost: 0, cooldown: 0, kb: 1, unlockStage: 999,
    ab: { hold: true, noAttack: true, kbImmune: true },
    desc: '공병이 세운 방벽입니다. 공격은 못 하지만 오래 버팁니다.'
  }),
  // 소환 전용 (카드에는 나오지 않는다)
  mk({
    id: 'skeleton', name: '해골 병사', role: '소환수', shape: 'skeleton',
    body: '#d8d2c0', accent: '#8a8375', tunic: '#b9b2a0',
    hp: 210, atk: 30, range: 60, speed: 58, interval: 0.9,
    cost: 0, cooldown: 0, kb: 2, unlockStage: 999,
    desc: '사령술사가 불러낸 해골입니다. 오래 버티지는 못합니다.'
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
    desc: '번개가 적에서 적으로 옮겨 붙습니다. 떼로 몰려올수록 강력하지만, 단단한 적 하나에는 약하고 몸도 약합니다. 앞을 지켜 줄 병력이 꼭 필요합니다.'
  }),
  mk({
    id: 'ares', castFx: 'slash', name: '아레스', short: '아레스', role: '전신', shape: 'ares',
    season: 'olympus', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c0392b', tunic: '#8e2f3a',
    hp: 1900, atk: 170, range: 88, speed: 34, interval: 1.7,
    cost: 400, cooldown: 26, kb: 1, area: true, areaRadius: 95, scale: 1.15,
    ab: { enrage: 1.8, lifesteal: 0.12 },
    abText: '범위 · 피가 깎일수록 가속 · 흡혈 12%',
    desc: '전쟁 그 자체입니다. 상처가 깊어질수록 창이 더 빨라집니다.'
  }),
  mk({
    id: 'artemis', castFx: 'holy', name: '아르테미스', short: '아르테미스', role: '사냥', shape: 'artemis',
    season: 'olympus', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#cfe8b0', tunic: '#4a7c4e',
    hp: 430, atk: 95, range: 390, speed: 44, interval: 1.15,
    cost: 380, cooldown: 22, kb: 2, ranged: true,
    ab: { pierce: true },
    abText: '일직선 관통 · 1.15초마다 사격',
    desc: '달의 사냥꾼입니다. 화살 한 발로 줄지어 선 적을 모두 꿰뚫습니다.'
  }),
  mk({
    id: 'medusa', castFx: 'iceburst', name: '메두사', short: '메두사', role: '석화', shape: 'medusa',
    season: 'olympus', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#6b8f5f', accent: '#9de08e', tunic: '#4a6b46',
    hp: 760, atk: 92, range: 240, speed: 28, interval: 1.8,
    cost: 260, cooldown: 10, kb: 2, ranged: true,
    ab: { stun: { chance: 0.3, dur: 1.4 }, slow: 2 },
    abText: '30% 석화(기절) · 둔화',
    desc: '눈을 마주친 자는 돌이 됩니다. 적의 전선을 통째로 굳혀 버립니다.'
  }),
  mk({
    id: 'spartan', name: '스파르타 전사', short: '스파르타', role: '밀집', shape: 'spartan',
    season: 'olympus', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c9a227', tunic: '#a83a2e',
    hp: 2700, atk: 92, range: 66, speed: 30, interval: 1.4,
    cost: 230, cooldown: 9, kb: 1, scale: 1.1,
    ab: { kbImmune: true },
    abText: '넉백 면역 · 밀리지 않는 방진',
    desc: '한 발도 물러서지 않습니다. 방패를 맞대고 버티는 것이 임무입니다.'
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
    desc: '묠니르는 갑옷도 성벽도 가리지 않습니다. 보스와 중장갑을 깨는 데는 따를 자가 없지만, 한 번에 하나밖에 못 칩니다. 적 무리는 다른 병력에게 맡기세요.'
  }),
  mk({
    id: 'valkyrie', castFx: 'holy', name: '발키리', short: '발키리', role: '전선', shape: 'valkyrie',
    season: 'ragnarok', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#f0e6c8', tunic: '#3f6bb5',
    hp: 1100, atk: 110, range: 82, speed: 58, interval: 1.3,
    cost: 390, cooldown: 24, kb: 2,
    ab: { revive: 0.5, heal: 60, radius: 160, interval: 4 },
    abText: '1회 부활 · 주변 아군 회복',
    desc: '쓰러진 자를 거두는 전장의 처녀입니다. 자신도 한 번은 다시 일어납니다.'
  }),
  mk({
    id: 'fenrir', castFx: 'slash', name: '펜리르', short: '펜리르', role: '맹수', shape: 'fenrir',
    season: 'ragnarok', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#3a3f48', accent: '#7fd8ff', tunic: '#2a2e36',
    hp: 1100, atk: 100, range: 66, speed: 130, interval: 0.8,
    cost: 390, cooldown: 24, kb: 2, scale: 1.25,
    ab: { lifesteal: 0.25 },
    abText: '초고속 돌진 · 흡혈 25%',
    desc: '사슬을 끊고 나온 늑대입니다. 물어뜯은 만큼 스스로 회복합니다.'
  }),
  mk({
    id: 'viking', name: '바이킹 전사', short: '바이킹', role: '광전', shape: 'viking',
    season: 'ragnarok', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c8ced6', tunic: '#6b4b2a',
    hp: 950, atk: 78, range: 70, speed: 80, interval: 0.7,
    cost: 260, cooldown: 10, kb: 3,
    ab: { enrage: 1.7, crit: { chance: 0.25, mul: 2.2 } },
    abText: '광폭화 · 25% 치명타',
    desc: '피를 볼수록 웃습니다. 죽기 직전에 가장 강해집니다.'
  }),
  mk({
    id: 'runeseer', name: '룬 주술사', short: '룬술사', role: '지원', shape: 'runeseer',
    season: 'ragnarok', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#7fd8ff', tunic: '#3a4e6b',
    hp: 640, atk: 0, range: 0, speed: 30, interval: 4,
    cost: 240, cooldown: 12, kb: 1,
    ab: { haste: { mul: 0.78, dur: 4 }, barrier: 190, radius: 210, interval: 4, noAttack: true },
    abText: '주변 아군 가속 + 보호막 190',
    desc: '룬을 새겨 아군을 보호막으로 감쌉니다. 싸우지는 않지만 없으면 아쉽습니다.'
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
    desc: '미라를 일으켜 전열을 대신 막게 합니다. 스스로는 거의 싸우지 못하니, 미라 뒤에서 때려 줄 병력과 함께 쓰세요.'
  }),
  mk({
    id: 'rapriest', castFx: 'firestorm', name: '라의 사제', short: '라사제', role: '태양', shape: 'rapriest',
    season: 'nile', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#ffb03c', tunic: '#e8c65a',
    hp: 720, atk: 180, range: 300, speed: 30, interval: 2.0,
    cost: 350, cooldown: 18, kb: 2, ranged: true, area: true, areaRadius: 105,
    ab: { burn: { dps: 60, dur: 5 } },
    abText: '태양광 범위 · 화상 60/초 5초',
    desc: '태양을 조각내 던집니다. 맞은 자리는 한참 동안 불탑니다.'
  }),
  mk({
    id: 'scarab', name: '황금 스카라베', short: '스카라베', role: '보물', shape: 'scarab',
    season: 'nile', rarity: 'R', gacha: true, unlockStage: 999,
    body: '#c9a227', accent: '#6b5417', tunic: '#e8c65a',
    hp: 520, atk: 70, range: 62, speed: 110, interval: 0.8,
    cost: 220, cooldown: 12, kb: 3,
    ab: { gold: 8 },
    abText: '빠름 · 살아 있는 동안 군자금 +8/초',
    desc: '황금 껍질을 두른 풍뎅이입니다. 굴러다니며 금화를 흘립니다.'
  }),
  mk({
    id: 'desertarcher', name: '사막 궁수', short: '사막궁수', role: '원거리', shape: 'desertarcher',
    season: 'nile', rarity: 'N', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#e8d9a8', tunic: '#b98a52',
    hp: 270, atk: 47, range: 285, speed: 40, interval: 1.2,
    cost: 150, cooldown: 7, kb: 2, ranged: true,
    abText: '값싼 원거리',
    desc: '모래바람 속에서 자란 궁수입니다. 싸고 빠르게 자리를 채웁니다.'
  }),
  mk({
    id: 'hoplite', name: '아테네 창병', short: '아테네창', role: '방진', shape: 'hoplite',
    season: 'olympus', rarity: 'N', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#c8ced6', tunic: '#3f6bb5',
    hp: 620, atk: 41, range: 72, speed: 44, interval: 1.0,
    cost: 140, cooldown: 6, kb: 2,
    abText: '값싼 창방패 보병',
    desc: '도시국가의 시민병입니다. 싸고 빠르게 전열을 채웁니다.'
  }),
  mk({
    id: 'northarcher', name: '북방 궁수', short: '북방궁수', role: '원거리', shape: 'northarcher',
    season: 'ragnarok', rarity: 'N', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#9fc6d8', tunic: '#4a5c6b',
    hp: 300, atk: 52, range: 300, speed: 38, interval: 1.15,
    cost: 155, cooldown: 7, kb: 2, ranged: true,
    abText: '값싼 원거리',
    desc: '얼음 바람 속에서 활을 당기는 사냥꾼입니다.'
  }),
  mk({
    id: 'pharaoh', name: '파라오 근위대', short: '근위대', role: '수호', shape: 'pharaoh',
    season: 'nile', rarity: 'SR', gacha: true, unlockStage: 999,
    body: '#2b3038', accent: '#e8c65a', tunic: '#2b6b8e',
    hp: 2300, atk: 112, range: 78, speed: 28, interval: 1.6,
    cost: 370, cooldown: 24, kb: 1, scale: 1.15,
    ab: { kbImmune: true, barrier: 200, radius: 180, interval: 6 },
    abText: '넉백 면역 · 주변 아군 보호막 200',
    desc: '왕의 무덤을 지키던 창병입니다. 한 걸음도 밀리지 않습니다.'
  }),
  // 소환 전용
  mk({
    id: 'mummy', name: '미라', role: '소환수', shape: 'mummy',
    body: '#cfc09a', accent: '#7a7263', tunic: '#bdae88',
    hp: 720, atk: 62, range: 62, speed: 26, interval: 1.4,
    cost: 0, cooldown: 0, kb: 1, unlockStage: 999,
    ab: { kbImmune: true },
    desc: '아누비스가 일으킨 미라입니다. 느리지만 밀리지 않습니다.'
  })
];

/* 신화: 압도적인 상시 화력 대신 직접 선택하는 전술 능력에 집중한다. */
SEASON_UNITS.push(
  mk({id:'hades',name:'하데스',role:'명계',shape:'hades',season:'olympus',rarity:'UR',gacha:true,unlockStage:999,
    body:'#807395',accent:'#c98aff',tunic:'#33213f',hp:2000,atk:170,range:245,speed:25,interval:2.2,
    cost:560,cooldown:45,kb:2,ranged:true,area:true,areaRadius:80,scale:1.2,maxActive:1,
    ab:{lifesteal:.1,reanimate:{id:'skeleton',radius:260,cd:1.4,max:8}},
    abText:'명계 · 주변에서 쓰러진 적을 해골로 일으킴(최대 8) · 명계의 문',
    desc:'근처에서 쓰러진 적을 해골 병사로 일으킵니다. 싸움이 길어질수록 군세가 불어나지만, 스스로 적을 쓰러뜨릴 힘은 없습니다. 적을 쓰러뜨려 줄 주력과 함께 쓰세요.',
    active:{name:'명계의 문',kind:'underworld',cd:52,radius:230,mul:2.6,slow:3,desc:'가장 가까운 적 주변 피해·3초 둔화. 성채에는 피해 없음.'}}),
  mk({id:'odin',name:'오딘',role:'룬의 지배자',shape:'odin',season:'ragnarok',rarity:'UR',gacha:true,unlockStage:999,
    body:'#e2c6a8',accent:'#7be6ff',tunic:'#28495e',hp:1600,atk:150,range:290,speed:27,interval:2.2,
    cost:560,cooldown:45,kb:2,ranged:true,maxActive:1,scale:1.15,
    ab:{pierce:true,rally:{atk:.35,radius:300},interval:2.5},
    abText:'지휘 · 주변 아군 공격력 +35% (자신 제외) · 운명의 룬',
    desc:'궁니르를 들어 전군을 지휘합니다. 곁에 선 병사들이 한층 세게 칩니다. 혼자서는 평범한 창잡이일 뿐 — 거느린 군대가 강할수록 오딘도 강해집니다.',
    active:{name:'운명의 룬',kind:'runeveil',cd:48,radius:300,barrier:320,desc:'주변 아군 보호막·중독과 화상 정화. 보호막 중첩 없음.'}}),
  mk({id:'ra',name:'라',role:'태양신',shape:'ra',season:'nile',rarity:'UR',gacha:true,unlockStage:999,
    body:'#c9a466',accent:'#ffca62',tunic:'#f0e0ae',hp:1500,atk:140,range:260,speed:26,interval:2.2,
    cost:540,cooldown:45,kb:2,ranged:true,area:true,areaRadius:85,maxActive:1,scale:1.2,
    ab:{burn:{dps:18,dur:3},sunmark:{vuln:.3,dur:4}},
    abText:'태양 낙인 · 맞은 적은 4초간 모든 피해 +30% · 태양의 심판',
    desc:'태양빛으로 적에게 낙인을 새깁니다. 낙인 찍힌 적은 누구에게 맞든 더 큰 피해를 받습니다. 라 혼자서는 약하지만, 주력의 화력을 한 단계 끌어올립니다.',
    active:{name:'태양의 심판',kind:'sunfall',cd:55,radius:215,mul:3,burn:5,desc:'가장 가까운 적 주변 피해·5초 화상·낙인. 성채에는 피해 없음.'}}),
  mk({id:'persephone',name:'페르세포네',role:'봄과 명계',shape:'persephone',season:'olympus',rarity:'SR',gacha:true,unlockStage:999,
    body:'#e2c4cf',accent:'#f6a5d4',tunic:'#713d79',hp:700,atk:75,range:235,speed:32,interval:1.8,
    cost:280,cooldown:18,kb:2,ranged:true,ab:{heal:45,radius:175,interval:4},abText:'주변 회복 · 꽃잎 탄환',desc:'석류와 꽃관을 지닌 봄의 여왕입니다. 명계의 군대에도 생명을 되돌려 줍니다.'}),
  mk({id:'skadi',name:'스카디',role:'겨울 사냥꾼',shape:'skadi',season:'ragnarok',rarity:'SR',gacha:true,unlockStage:999,
    body:'#bfd4e1',accent:'#a9eaff',tunic:'#4e698a',hp:560,atk:95,range:315,speed:43,interval:1.7,
    cost:285,cooldown:17,kb:2,ranged:true,ab:{slow:1.2},abText:'1.2초 둔화 · 서리 화살',desc:'털 망토를 두른 산의 사냥꾼입니다. 서리 활로 돌격하는 적의 발을 묶습니다.'}),
  mk({id:'bastet',name:'바스테트',role:'고양이 수호신',shape:'bastet',season:'nile',rarity:'SR',gacha:true,unlockStage:999,
    body:'#39364e',accent:'#e9bf65',tunic:'#287d7a',hp:1100,atk:76,range:70,speed:80,interval:.9,
    cost:280,cooldown:17,kb:3,ab:{crit:{chance:.2,mul:1.8},lifesteal:.12},abText:'치명타 20% · 흡혈 12%',desc:'고양이 귀와 황금 발톱을 지닌 수호신입니다. 낮은 자세로 전선의 빈틈을 파고듭니다.'})
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
    desc:'아홉 꼬리의 여우입니다. 여우불에 홀린 적은 잠시 제 편을 공격합니다. 몰려오는 무리를 서로 싸우게 만들지만, 스스로 적을 쓰러뜨리는 힘은 약합니다.',
    active:{name:'여우 구슬',kind:'foxbead',cd:50,radius:220,mul:1.6,charm:4,desc:'가장 가까운 적 주변 피해·4초 홀림(보스 제외). 성채에는 피해 없음.'}}),
  mk({id:'saja',name:'저승사자',role:'명부',shape:'saja',castFx:'inkslash',season:'yokai',rarity:'SSR',gacha:true,unlockStage:999,
    body:'#e9e4dc',accent:'#9fd3ff',tunic:'#17171d',hp:2050,atk:120,range:95,speed:32,interval:1.6,
    cost:440,cooldown:36,kb:1,scale:1.15,
    ab:{execute:.2},
    abText:'명부 · 체력 20% 이하인 적을 즉시 거둠(보스 제외) · 명부 호명',
    desc:'검은 갓을 쓴 저승의 관리입니다. 명부에 이름이 오른 적은 손짓 한 번으로 데려갑니다. 단단한 적을 깎아 줄 동료가 있어야 제 몫을 합니다.',
    active:{name:'명부 호명',kind:'reaproll',cd:48,radius:240,mul:1.4,execute:.35,desc:'가장 가까운 적 주변 피해 뒤, 체력 35% 이하는 즉시 거둠(보스 제외).'}}),
  mk({id:'dokkaebi',name:'도깨비',role:'방망이',shape:'dokkaebi',castFx:'goldburst',season:'yokai',rarity:'SR',gacha:true,unlockStage:999,
    body:'#4f8a6a',accent:'#f2c14e',tunic:'#7b4a2a',hp:1500,atk:100,range:80,speed:36,interval:1.3,
    cost:330,cooldown:20,kb:1,area:true,areaRadius:80,scale:1.15,
    ab:{bounty:{chance:.3,gold:18}},
    abText:'범위 · 때릴 때 30% 확률로 군자금 +18',
    desc:'"금 나와라 뚝딱!" 방망이를 휘두를 때마다 이따금 금이 쏟아집니다.'}),
  mk({id:'haetae',name:'해치',role:'수호수',shape:'haetae',castFx:'shockwave',season:'yokai',rarity:'SR',gacha:true,unlockStage:999,
    body:'#e4d6b0',accent:'#3e9c8f',tunic:'#b98a3a',hp:2600,atk:60,range:70,speed:26,interval:1.5,
    cost:320,cooldown:22,kb:1,scale:1.2,
    ab:{kbImmune:true,thorns:.3},
    abText:'넉백 면역 · 근접 피해 30% 되돌림',
    desc:'옳고 그름을 가리는 상상의 짐승입니다. 밀리지 않으며, 자신을 친 자에게 피해를 그대로 돌려줍니다.'}),
  mk({id:'mudang',name:'무당',role:'액막이',shape:'mudang',castFx:'holy',season:'yokai',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#e84d6b',tunic:'#f2e3c6',hp:520,atk:40,range:230,speed:34,interval:1.6,
    cost:240,cooldown:12,kb:2,ranged:true,
    ab:{weaken:{mul:.7,dur:4}},
    abText:'액막이 방울 · 맞은 적의 공격력 -30% (4초)',
    desc:'방울과 부채로 액운을 막습니다. 적이 무서울수록 이 방울 소리가 반갑습니다.'}),
  mk({id:'hwarang',name:'화랑',role:'풍류 검객',shape:'hwarang',castFx:'slash',season:'yokai',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#f4d06f',tunic:'#3a7ca5',hp:780,atk:68,range:70,speed:60,interval:.85,
    cost:230,cooldown:10,kb:2,
    ab:{lifesteal:.15},
    abText:'빠른 검 · 흡혈 15%',
    desc:'꽃처럼 차려입은 젊은 검객입니다. 빠르게 파고들어 벤 만큼 회복합니다.'}),
  mk({id:'pojol',name:'포졸',role:'육모방망이',shape:'pojol',season:'yokai',rarity:'N',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#c0392b',tunic:'#2f3e5c',hp:600,atk:40,range:95,speed:44,interval:1.2,
    cost:145,cooldown:6,kb:2,
    abText:'값싼 창 · 긴 사거리',
    desc:'고을을 지키던 포졸입니다. 싸고 빠르게 전열을 채웁니다.'})
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
    desc:'톱니와 증기로 전장을 설계합니다. 제자리에 세운 포탑이 쉬지 않고 쏩니다. 앞줄이 버텨 주면 포탑이 늘고, 무너지면 아무것도 세우지 못합니다.',
    active:{name:'과부하',kind:'overdrive',cd:50,radius:320,haste:{mul:.55,dur:6},desc:'주변 아군 공격 속도 크게 증가(6초)·기절 해제.'}}),
  mk({id:'steammech',name:'증기 거상',role:'예열 포격',shape:'steammech',castFx:'steamburst',season:'clockwork',rarity:'SSR',gacha:true,unlockStage:999,
    body:'#8a7a66',accent:'#ff8c42',tunic:'#4a4038',hp:2600,atk:70,range:250,speed:20,interval:1.2,
    cost:470,cooldown:38,kb:1,ranged:true,area:true,areaRadius:75,scale:1.35,
    ab:{spinup:{per:.1,max:1.2}},
    abText:'예열 · 쏠수록 빨라짐(최대 2.2배) · 걸으면 식음 · 증기 폭발',
    desc:'굴뚝에서 연기를 뿜는 걸어 다니는 포대입니다. 처음엔 느리지만 멈춰 서서 쏠수록 불을 뿜습니다. 전선이 자주 흔들리면 좀처럼 예열되지 않습니다.',
    active:{name:'증기 폭발',kind:'steamburst',cd:46,radius:200,mul:2.2,push:90,desc:'가장 가까운 적 주변 피해·크게 밀쳐 냄.'}}),
  mk({id:'airship',name:'비행선 폭격수',short:'비행선',role:'뒷줄 폭격',shape:'airship',castFx:'firestorm',season:'clockwork',rarity:'SR',gacha:true,unlockStage:999,
    body:'#6b4b2a',accent:'#ff9f43',tunic:'#b8a27a',hp:700,atk:120,range:380,speed:30,interval:2.4,
    cost:360,cooldown:24,kb:2,ranged:true,area:true,areaRadius:70,
    ab:{backline:true,burn:{dps:30,dur:3}},
    abText:'뒷줄 폭격 · 사거리 안 가장 먼 적 · 화상',
    desc:'하늘에서 폭탄을 떨굽니다. 앞줄 너머의 주술사와 투석기를 노립니다.'}),
  mk({id:'teslaknight',name:'테슬라 기사',short:'테슬라',role:'방전',shape:'teslaknight',castFx:'tesla',season:'clockwork',rarity:'SR',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#7fe3ff',tunic:'#3b4a5c',hp:1500,atk:90,range:80,speed:34,interval:1.3,
    cost:340,cooldown:22,kb:1,scale:1.1,
    ab:{chain:{n:2,fall:.6,range:110},stun:{chance:.12,dur:.6}},
    abText:'방전 · 2번 튕김 · 12% 기절',
    desc:'등에 코일을 짊어진 기사입니다. 창끝에서 튄 전기가 옆의 적까지 태웁니다.'}),
  mk({id:'clocksoldier',name:'태엽 병정',short:'태엽병정',role:'자폭 톱니',shape:'clocksoldier',season:'clockwork',rarity:'R',gacha:true,unlockStage:999,
    body:'#b08d57',accent:'#e0c080',tunic:'#6b4f2e',hp:700,atk:45,range:70,speed:40,interval:1.1,
    cost:200,cooldown:9,kb:2,
    ab:{deathBomb:{dmg:160,radius:95}},
    abText:'쓰러지면 톱니 폭발 (피해 160)',
    desc:'태엽을 감아 움직이는 병정입니다. 부서질 때 톱니가 사방으로 튑니다.'}),
  mk({id:'mechanic',name:'정비공',role:'수리',shape:'mechanic',season:'clockwork',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#f5c542',tunic:'#3e5f7a',hp:560,atk:28,range:70,speed:36,interval:1.4,
    cost:230,cooldown:12,kb:2,
    ab:{heal:70,radius:180,interval:3.5},
    abText:'주변 아군 수리(회복) · 약한 렌치',
    desc:'렌치 하나로 사람도 기계도 고칩니다. 포탑과 거상 곁에 두면 오래 버팁니다.'}),
  mk({id:'rifleman',name:'소총수',role:'원거리',shape:'rifleman',season:'clockwork',rarity:'N',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#b0b6bd',tunic:'#5a6b3a',hp:280,atk:50,range:340,speed:40,interval:1.3,
    cost:150,cooldown:7,kb:2,ranged:true,
    abText:'값싼 원거리',
    desc:'공방에서 찍어 낸 소총을 든 민병입니다. 싸고 멀리 쏩니다.'}),
  // 소환 전용
  mk({id:'turret',name:'증기 포탑',role:'소환물',shape:'turret',unlockStage:999,
    body:'#6b5a48',accent:'#ffb347',tunic:'#4a4038',hp:900,atk:55,range:300,speed:0,interval:.8,
    cost:0,cooldown:0,kb:1,ranged:true,
    ab:{hold:true,kbImmune:true},
    desc:'대발명가가 세운 포탑입니다. 움직이지 않고 쏘기만 합니다.'})
);

/* ---------------- 시즌 6 · 서유기 (천궁 대란) ----------------
 * 구름을 타고 온 원숭이 왕과 서역으로 가던 일행. 싸움을 불리는 쪽이다:
 * 분신을 뿌리고(손오공), 적을 한데 묶고(나타), 쓰러뜨린 만큼 배를 채운다(저팔계). */
SEASON_UNITS.push(
  mk({id:'wukong',name:'손오공',role:'제천대성',shape:'wukong',castFx:'staff',season:'journey',rarity:'UR',gacha:true,unlockStage:999,
    body:'#c98a4a',accent:'#ffd24a',tunic:'#b8322e',hp:1700,atk:130,range:120,speed:46,interval:1.6,
    cost:550,kb:2,area:true,areaRadius:80,scale:1.15,
    ab:{summon:{id:'monkeyclone',n:2,max:4,life:9},interval:9},
    abText:'분신술 · 9초마다 분신 2기(최대 4, 9초 유지) · 여의봉 강타',
    desc:'털 한 가닥을 뽑아 불면 분신이 튀어나옵니다. 분신은 금방 사라지니 싸움을 쉬지 않고 이어 가야 합니다. 혼자서는 적을 다 쓸어 낼 힘이 없습니다.',
    active:{name:'여의봉 강타',kind:'staff',cd:50,radius:210,mul:2.4,stun:1,clones:2,desc:'가장 가까운 적 주변 피해·1초 기절, 분신 2기를 곧바로 부름.'}}),
  mk({id:'nezha',name:'나타',role:'풍화륜',shape:'nezha',castFx:'firering',season:'journey',rarity:'SSR',gacha:true,unlockStage:999,
    body:'#e8c8a8',accent:'#ff7a3c',tunic:'#d8453a',hp:1750,atk:95,range:80,speed:95,interval:1.1,
    cost:450,kb:2,area:true,areaRadius:70,scale:1.1,
    ab:{burn:{dps:45,dur:3}},abText:'풍화륜 · 빠른 범위 화염 · 혼천릉',
    desc:'불타는 바퀴를 타고 전장을 가로지르는 소년 장수입니다. 빠르게 파고들어 무리를 불태우지만, 몸이 가벼워 오래 버티지는 못합니다.',
    active:{name:'혼천릉',kind:'skybind',cd:46,radius:240,mul:1.5,pull:90,slow:3,desc:'가장 가까운 적 주변을 붉은 비단으로 묶어 한데 끌어모음·3초 둔화.'}}),
  mk({id:'sanzang',name:'삼장법사',short:'삼장',role:'자비',shape:'sanzang',season:'journey',rarity:'SR',gacha:true,unlockStage:999,
    body:'#e8d4b0',accent:'#e8c65a',tunic:'#c9a227',hp:800,atk:0,range:0,speed:28,interval:3,
    cost:330,kb:1,
    ab:{heal:55,pacify:{mul:.75,dur:4},radius:220,interval:4,noAttack:true},
    abText:'독경 · 주변 아군 회복 · 주변 적 공격력 -25%',
    desc:'경을 읊어 아군을 돌보고 적의 살기마저 누그러뜨립니다. 직접 싸우지는 않습니다.'}),
  mk({id:'bajie',name:'저팔계',role:'대식가',shape:'bajie',season:'journey',rarity:'SR',gacha:true,unlockStage:999,
    body:'#e8a8a0',accent:'#b0b6bd',tunic:'#3a4a6b',hp:2600,atk:105,range:80,speed:28,interval:1.6,
    cost:340,kb:1,area:true,areaRadius:80,scale:1.2,
    ab:{kbImmune:true,feast:.12},abText:'쇠스랑 · 범위 · 넉백 면역 · 처치할 때마다 체력 12% 회복',
    desc:'아홉 날 쇠스랑을 휘두르는 대식가입니다. 쓰러뜨린 적만큼 배를 채우며 버팁니다.'}),
  mk({id:'wujing',name:'사오정',role:'강의 수호',shape:'wujing',season:'journey',rarity:'R',gacha:true,unlockStage:999,
    body:'#6b8fa0',accent:'#c8ced6',tunic:'#3f5a6b',hp:1250,atk:72,range:88,speed:32,interval:1.5,
    cost:250,kb:2,area:true,areaRadius:70,
    ab:{slow:1.2},abText:'월아산 · 범위 · 1.2초 둔화',
    desc:'유사하의 강물에서 올라온 과묵한 장수입니다. 초승달 삽날로 적 무리의 발을 묶습니다.'}),
  mk({id:'monkey',name:'화과산 원숭이',short:'원숭이',role:'척후',shape:'monkey',season:'journey',rarity:'R',gacha:true,unlockStage:999,
    body:'#b0763a',accent:'#e8c65a',tunic:'#6b4a2a',hp:620,atk:52,range:62,speed:100,interval:.7,
    cost:210,kb:3,scale:.9,
    ab:{dodge:.3,crit:{chance:.15,mul:2}},abText:'날렵함 · 30% 회피 · 치명타 15%',
    desc:'화과산에서 내려온 원숭이 병사입니다. 요리조리 피하며 적을 할퀴어 댑니다.'}),
  mk({id:'celestial',name:'천병',role:'천궁 수비',shape:'celestial',season:'journey',rarity:'N',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#e8c65a',tunic:'#8e2f3a',hp:640,atk:40,range:74,speed:42,interval:1.1,
    cost:145,kb:2,
    ab:{armor:.15},abText:'값싼 창방패 · 갑주 15%',
    desc:'천궁을 지키는 하늘의 병사입니다. 싸고 단단하게 전열을 채웁니다.'}),
  // 4.0 시즌: 원탁의 기사 (아서왕 전설)
  mk({id:'arthur',name:'아서왕',short:'아서',role:'왕의 검',shape:'arthur',castFx:'holy',season:'camelot',rarity:'UR',gacha:true,unlockStage:999,
    body:'#d8d2c4',accent:'#ffd76a',tunic:'#2a4a8e',hp:1800,atk:140,range:96,speed:40,interval:1.5,
    cost:560,kb:2,area:true,areaRadius:85,scale:1.2,
    ab:{rally:{atk:.25,radius:240},interval:3},
    abText:'왕의 기치 · 주변 아군 공격력 +25% (자신 제외) · 엑스칼리버',
    desc:'호수의 여인에게서 받은 성검을 든 브리튼의 왕입니다. 앞에 서서 기사들을 이끌 때 가장 강합니다. 혼자서는 그저 좋은 검사일 뿐입니다.',
    active:{name:'엑스칼리버',kind:'excalibur',cd:50,radius:230,mul:2.8,stun:.8,desc:'가장 가까운 적 주변에 성검의 빛 · 0.8초 기절.'}}),
  mk({id:'merlin',name:'멀린',role:'대마법사',shape:'merlin',castFx:'runes',season:'camelot',rarity:'SSR',gacha:true,unlockStage:999,
    body:'#c8c0d8',accent:'#8fd0ff',tunic:'#3a2e6b',hp:1150,atk:118,range:300,speed:26,interval:2.2,
    cost:470,kb:2,ranged:true,area:true,areaRadius:90,scale:1.1,
    ab:{slow:1.5},abText:'비전 구슬 · 범위 · 1.5초 둔화 · 시간의 매듭',
    desc:'왕을 길러 낸 늙은 마법사입니다. 시간을 묶어 적 무리를 한자리에 붙잡습니다.',
    active:{name:'시간의 매듭',kind:'thunderseal',cd:46,radius:240,mul:1.8,stun:1.6,slow:4,desc:'가장 가까운 적 주변 피해 · 1.6초 정지 · 4초 둔화.'}}),
  mk({id:'lancelot',name:'랜슬롯',role:'호수의 기사',shape:'lancelot',castFx:'slash',season:'camelot',rarity:'SR',gacha:true,unlockStage:999,
    body:'#c8ced6',accent:'#7ac8ff',tunic:'#3a5a8a',hp:1500,atk:115,range:80,speed:48,interval:1.1,
    cost:360,kb:2,
    ab:{crit:{chance:.25,mul:2.2},lifesteal:.15},abText:'무쌍의 검 · 치명타 25% ×2.2 · 흡혈 15%',
    desc:'원탁에서 가장 뛰어난 검사입니다. 날카롭게 베고 벤 만큼 버팁니다.'}),
  mk({id:'morgana',name:'모르가나',role:'요정의 마녀',shape:'morgana',season:'camelot',rarity:'SR',gacha:true,unlockStage:999,
    body:'#d8c0d0',accent:'#b07aff',tunic:'#3a1a4a',hp:720,atk:80,range:250,speed:30,interval:1.9,
    cost:320,kb:2,ranged:true,
    ab:{poison:{dps:42,dur:5},slow:1},abText:'요정의 저주 · 중독 42/초 5초 · 1초 둔화',
    desc:'아발론의 마녀입니다. 저주를 건 적은 천천히 시들어 갑니다.'}),
  mk({id:'tristan',name:'트리스탄',role:'하프 궁수',shape:'tristan',season:'camelot',rarity:'R',gacha:true,unlockStage:999,
    body:'#d0c8b8',accent:'#e8c65a',tunic:'#2a6a4a',hp:600,atk:70,range:330,speed:34,interval:1.4,
    cost:250,kb:2,ranged:true,
    ab:{crit:{chance:.2,mul:2.4}},abText:'하프 활 · 긴 사거리 · 치명타 20% ×2.4',
    desc:'하프 줄을 시위 삼아 쏘는 음유 기사입니다. 멀리서 정확히 꿰뚫습니다.'}),
  mk({id:'galahad',name:'갈라하드',role:'성배의 기사',shape:'galahad',season:'camelot',rarity:'R',gacha:true,unlockStage:999,
    body:'#e8e4d8',accent:'#ffe28a',tunic:'#c8c0a8',hp:1700,atk:55,range:70,speed:30,interval:1.4,
    cost:240,kb:1,
    ab:{armor:.3,kbImmune:true,regen:20},abText:'성배의 가호 · 갑주 30% · 넉백 면역 · 초당 20 회복',
    desc:'성배를 찾아낸 순결한 기사입니다. 흔들리지 않고 앞줄을 지킵니다.'}),
  mk({id:'camelotguard',name:'카멜롯 경비병',short:'경비병',role:'성문 수비',shape:'camelotguard',season:'camelot',rarity:'N',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#7aa8e8',tunic:'#2a4a8e',hp:660,atk:42,range:74,speed:42,interval:1.1,
    cost:150,kb:2,
    ab:{armor:.12,dodge:.1},abText:'값싼 창방패 · 갑주 12% · 회피 10%',
    desc:'카멜롯 성문을 지키는 병사입니다. 싸고 날래게 전열을 채웁니다.'}),
  // 4.9 시즌: 벚꽃 전국 (일본 설화와 무사) — 폭풍의 신 · 산의 요괴 · 그림자 · 신사의 무녀 · 무사들
  mk({id:'susanoo',name:'스사노오',role:'폭풍의 신',shape:'susanoo',castFx:'slash',season:'sengoku',rarity:'UR',gacha:true,unlockStage:999,
    body:'#e8d8c0',accent:'#7ad0ff',tunic:'#2a3a6a',hp:1750,atk:138,range:100,speed:40,interval:1.5,
    cost:560,kb:2,area:true,areaRadius:90,scale:1.2,
    ab:{slow:1,push:25},abText:'폭풍 검 · 범위 · 맞은 적 1초 둔화 · 밀쳐 냄 · 오로치 베기',
    desc:'여덟 머리 큰뱀을 벤 폭풍의 신입니다. 몰려든 적을 한꺼번에 베고 바람으로 밀어냅니다. 혼자 보스를 녹이지는 못합니다.',
    active:{name:'오로치 베기',kind:'thunderseal',cd:50,radius:240,mul:2.6,slow:4,push:80,desc:'가장 가까운 적 주변 폭풍 베기 · 4초 둔화 · 밀쳐 냄.'}}),
  mk({id:'tengu',name:'텐구',role:'산의 요괴',shape:'tengu',castFx:'slash',season:'sengoku',rarity:'SSR',gacha:true,unlockStage:999,
    body:'#d84a3a',accent:'#f0e0b0',tunic:'#3a3a3a',hp:1500,atk:108,range:82,speed:80,interval:1.0,
    cost:450,kb:2,scale:1.1,
    ab:{dodge:.25,charge:{dist:120,mul:2.2,push:40}},abText:'날개 · 25% 회피 · 달려온 첫 일격 2.2배 · 깃털 부채 돌풍',
    desc:'붉은 얼굴에 긴 코, 검은 날개를 단 산의 요괴입니다. 바람처럼 날아들어 첫 칼에 크게 베고 빠집니다.',
    active:{name:'깃털 부채 돌풍',kind:'steamburst',cd:44,radius:230,mul:1.8,push:120,desc:'가장 가까운 적 주변 돌풍 피해 · 크게 밀쳐 냄.'}}),
  mk({id:'ninja',name:'닌자',role:'그림자',shape:'ninja',castFx:'slash',season:'sengoku',rarity:'SR',gacha:true,unlockStage:999,
    body:'#2a2a34',accent:'#c8c8d8',tunic:'#1e1e28',hp:950,atk:94,range:66,speed:90,interval:0.8,
    cost:330,kb:2,
    ab:{crit:{chance:.3,mul:2.3},dodge:.3},abText:'쌍 단도 · 치명타 30% ×2.3 · 30% 회피 · 아주 빠름',
    desc:'그림자에서 튀어나와 급소만 찌릅니다. 맞기 전에 피하지만, 오래 붙어 싸우면 버티지 못합니다.'}),
  mk({id:'miko',name:'무녀',role:'신사의 무녀',shape:'miko',season:'sengoku',rarity:'SR',gacha:true,unlockStage:999,
    body:'#f0e8e0',accent:'#e8505a',tunic:'#f4f0ea',hp:780,atk:40,range:200,speed:32,interval:1.8,
    cost:300,kb:2,ranged:true,
    ab:{heal:50,radius:170,interval:4,cleanse:true},abText:'방울 춤 · 4초마다 주변 아군 회복 · 중독·화상 정화',
    desc:'신사의 방울을 흔들어 부정을 씻어 냅니다. 아군의 독과 불을 털어 주고 상처를 아물게 합니다.'}),
  mk({id:'samurai',name:'사무라이',role:'칼잡이',shape:'samurai',castFx:'slash',season:'sengoku',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#d8d8e0',tunic:'#8e2f3a',hp:1150,atk:76,range:74,speed:40,interval:1.1,
    cost:240,kb:2,
    ab:{crit:{chance:.2,mul:2},armor:.1},abText:'발도술 · 치명타 20% ×2 · 갑주 10%',
    desc:'갑옷을 두른 무사입니다. 칼집에서 뽑는 한 번의 베기에 모든 것을 겁니다.'}),
  mk({id:'kyudo',name:'궁도가',role:'긴 활',shape:'kyudo',season:'sengoku',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#e8c65a',tunic:'#3a4a6a',hp:580,atk:70,range:350,speed:34,interval:1.5,
    cost:245,kb:2,ranged:true,
    ab:{crit:{chance:.15,mul:2.2}},abText:'긴 활 · 긴 사거리 · 치명타 15% ×2.2',
    desc:'키보다 긴 활을 당기는 궁도가입니다. 아주 멀리서 정확히 맞힙니다.'}),
  mk({id:'ashigaru',name:'아시가루',role:'창 졸병',shape:'ashigaru',season:'sengoku',rarity:'N',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#c8a050',tunic:'#4a3a2a',hp:620,atk:43,range:86,speed:44,interval:1.1,
    cost:140,kb:2,
    ab:{armor:.1},abText:'긴 창 · 값싸게 머릿수 · 갑주 10%',
    desc:'삿갓을 쓴 창 졸병입니다. 싸고 많이 나와 긴 창으로 전열을 채웁니다.'}),
  // 4.15 시즌: 삼국지 (도원결의와 와룡) — 청룡도의 무신 · 와룡 군사 · 상산의 창 · 장판교의 호령 · 노장의 활 · 등갑 · 극
  mk({id:'guanyu',name:'관우',role:'청룡도의 무신',shape:'guanyu',castFx:'slash',season:'threekingdoms',rarity:'UR',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#4ad08a',tunic:'#2a6a3a',hp:1850,atk:140,range:104,speed:36,interval:1.5,
    cost:560,kb:2,area:true,areaRadius:85,scale:1.22,
    ab:{armor:.15,kbImmune:true,push:20},abText:'청룡언월도 · 범위 · 갑주 15% · 넉백 면역 · 밀쳐 냄 · 청룡언월 일섬',
    desc:'붉은 얼굴에 긴 수염, 여든두 근 청룡언월도를 든 무신입니다. 흔들림 없이 서서 한 번 휘두를 때마다 앞줄을 통째로 벱니다.',
    active:{name:'청룡언월 일섬',kind:'dragonblade',cd:50,radius:250,mul:2.8,stun:.7,push:60,desc:'가장 가까운 적 주변을 크게 베어 피해 · 0.7초 기절 · 밀쳐 냄.'}}),
  mk({id:'zhugeliang',name:'제갈량',role:'와룡 군사',shape:'zhugeliang',season:'threekingdoms',rarity:'SSR',gacha:true,unlockStage:999,
    body:'#f0e0c8',accent:'#ffb04a',tunic:'#f4f0e6',hp:900,atk:96,range:300,speed:32,interval:1.8,
    cost:450,kb:2,ranged:true,area:true,areaRadius:80,
    ab:{slow:1.5},abText:'학 깃털 부채 · 바람 칼날 범위 · 맞은 적 1.5초 둔화 · 동남풍',
    desc:'학 깃털 부채를 든 와룡 선생입니다. 바람을 불러 적의 발을 묶고, 때가 오면 동남풍에 불을 실어 보냅니다.',
    active:{name:'동남풍',kind:'eastwind',cd:46,radius:260,mul:2.2,burn:5,push:60,desc:'가장 가까운 적 주변 불바람 피해 · 5초 화상 · 밀쳐 냄.'}}),
  mk({id:'zhaoyun',name:'조운',role:'상산의 창',shape:'zhaoyun',castFx:'slash',season:'threekingdoms',rarity:'SR',gacha:true,unlockStage:999,
    body:'#e8dcc8',accent:'#a8d8ff',tunic:'#e8eaf0',hp:1100,atk:90,range:92,speed:72,interval:1.0,
    cost:340,kb:2,scale:1.1,
    ab:{charge:{dist:120,mul:2,push:30},dodge:.2},abText:'백마와 용담창 · 달려온 첫 일격 2배 · 회피 20% · 빠름',
    desc:'흰 말을 타고 적진을 홀로 가르는 상산의 장수입니다. 달려 들어가는 첫 창이 가장 무섭습니다.'}),
  mk({id:'zhangfei',name:'장비',role:'장판교의 호령',shape:'zhangfei',castFx:'slash',season:'threekingdoms',rarity:'SR',gacha:true,unlockStage:999,
    body:'#3a3030',accent:'#e8c050',tunic:'#2a2a3a',hp:1500,atk:82,range:88,speed:34,interval:1.3,
    cost:320,kb:2,scale:1.12,
    ab:{stun:{chance:.15,dur:.7},armor:.2},abText:'장팔사모 · 기절 15% · 갑주 20%',
    desc:'호랑이 수염에 우레 같은 목소리를 가진 장수입니다. 장팔사모로 찌르면 적이 넋을 잃고 멈춰 섭니다.'}),
  mk({id:'huangzhong',name:'황충',role:'노장의 활',shape:'huangzhong',season:'threekingdoms',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#e8c65a',tunic:'#8a3a2a',hp:600,atk:70,range:340,speed:32,interval:1.5,
    cost:245,kb:2,ranged:true,
    ab:{breaker:1.4,crit:{chance:.1,mul:2}},abText:'노장의 강궁 · 긴 사거리 · 보스·중장갑에게 1.4배 · 치명타 10%',
    desc:'흰 수염의 노장이지만 활은 누구보다 셉니다. 단단한 적일수록 더 깊이 꿰뚫습니다.'}),
  mk({id:'tengjia',name:'등갑병',role:'남만의 등갑',shape:'tengjia',season:'threekingdoms',rarity:'R',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#e8d080',tunic:'#a8803a',hp:1450,atk:50,range:72,speed:34,interval:1.3,
    cost:235,kb:1,
    ab:{armor:.4,thorns:.1},abText:'기름 먹인 등나무 갑옷 · 갑주 40% · 근접 피해 10% 반사',
    desc:'기름에 절인 등나무 갑옷을 입은 남만의 병사입니다. 칼도 화살도 잘 들지 않아 앞줄을 오래 버팁니다.'}),
  mk({id:'jiqiang',name:'창극병',role:'긴 극',shape:'jiqiang',season:'threekingdoms',rarity:'N',gacha:true,unlockStage:999,
    body:'#2b3038',accent:'#d84a3a',tunic:'#3a4a6a',hp:640,atk:44,range:92,speed:42,interval:1.15,
    cost:145,kb:2,
    ab:{push:10},abText:'긴 극 · 값싸게 머릿수 · 살짝 밀쳐 냄',
    desc:'갈고리 달린 긴 극을 든 졸병입니다. 싸고 많이 나와 적을 조금씩 밀어냅니다.'}),
  // 소환 전용
  mk({id:'monkeyclone',name:'분신',role:'소환수',shape:'monkeyclone',unlockStage:999,
    body:'#c98a4a',accent:'#ffd24a',tunic:'#b8322e',hp:520,atk:60,range:80,speed:60,interval:1.0,
    cost:0,cooldown:0,kb:2,ab:{dodge:.2},
    desc:'손오공의 털 한 가닥이 변한 분신입니다. 잠시 뒤 연기처럼 사라집니다.'})
);
SEASON_UNITS.push(
  // 5.2 시즌: 천일야화 (램프의 마신과 일곱 바다) — 램프의 마신 · 일곱 바다의 선장 · 하늘 양탄자 · 이야기꾼 · 초승달 칼 · 낙타 궁기병 · 마흔 도적
  mk({id:'genie',name:'지니',role:'램프의 마신',shape:'genie',castFx:'wishburst',season:'arabian',rarity:'UR',gacha:true,unlockStage:999,
    body:'#4aa0f0',accent:'#ffd24a',tunic:'#5a2a8e',hp:1550,atk:135,range:270,speed:30,interval:2.0,
    cost:550,kb:2,ranged:true,area:true,areaRadius:80,scale:1.3,
    ab:{wish:{heal:.1,barrier:150,haste:{mul:.75,dur:4}},radius:280,interval:6},
    abText:'램프 마법 범위 · 6초마다 주변 아군에게 소원 하나 (회복 → 보호막 → 가속 차례로) · 세 가지 소원',
    desc:'황금 램프에서 피어오른 푸른 마신입니다. 마법 구슬로 적을 터뜨리고, 곁의 병사들에게 차례로 소원을 들어줍니다 — 상처는 아물고, 몸은 단단해지고, 발은 빨라집니다.',
    active:{name:'세 가지 소원',kind:'threewish',cd:52,radius:270,mul:2.4,stun:1,gold:150,ally:{barrier:220,radius:320},desc:'가장 가까운 적 주변 피해 · 1초 기절, 주변 아군 보호막, 군자금 +150.'}}),
  mk({id:'sinbad',name:'신드바드',role:'일곱 바다의 선장',shape:'sinbad',castFx:'slash',season:'arabian',rarity:'SSR',gacha:true,unlockStage:999,
    body:'#c8925a',accent:'#4ad8e8',tunic:'#2a5a8e',hp:1450,atk:106,range:86,speed:46,interval:1.1,
    cost:450,kb:2,area:true,areaRadius:55,scale:1.12,
    ab:{dodge:.2,crit:{chance:.15,mul:2.2}},abText:'휘두르는 언월도 범위 · 회피 20% · 치명타 15% ×2.2 · 로크의 습격',
    desc:'일곱 번 바다로 나가 일곱 번 살아 돌아온 선장입니다. 파도처럼 몸을 틀어 칼을 피하고, 언월도를 크게 휘둘러 앞줄을 쓸어 냅니다. 위급하면 거대한 로크 새를 부릅니다.',
    active:{name:'로크의 습격',kind:'rocdive',cd:46,radius:240,mul:2.5,stun:.8,push:90,desc:'거대한 로크 새가 내리꽂혀 가장 가까운 적 주변 피해 · 0.8초 기절 · 밀쳐 냄.'}}),
  mk({id:'carpet',name:'양탄자 기사',short:'양탄자',role:'하늘을 나는 양탄자',shape:'carpet',season:'arabian',rarity:'SR',gacha:true,unlockStage:999,
    body:'#d8a070',accent:'#ff5a8a',tunic:'#3a7ac8',hp:700,atk:88,range:250,speed:64,interval:1.1,
    cost:330,kb:1,ranged:true,
    ab:{hunter:1.8,dodge:.25},abText:'날아다니며 던지는 굽은 단검 · 원거리 적에게 1.8배 · 회피 25% · 빠름',
    desc:'하늘을 나는 양탄자를 타고 전장 위를 미끄러집니다. 적의 궁수와 마법사를 먼저 노려 굽은 단검을 던집니다.'}),
  mk({id:'scheherazade',name:'셰에라자드',role:'천일야화의 이야기꾼',shape:'scheherazade',season:'arabian',rarity:'SR',gacha:true,unlockStage:999,
    body:'#e8c0a0',accent:'#ffcf5a',tunic:'#8e2a6a',hp:700,atk:38,range:220,speed:30,interval:1.8,
    cost:320,kb:1,ranged:true,
    ab:{haste:{mul:.82,dur:4},pacify:{mul:.8,dur:4},radius:210,interval:5},
    abText:'천 하룻밤의 이야기 · 5초마다 주변 아군 공격이 빨라지고 주변 적 공격력 -20%',
    desc:'천 하룻밤 동안 이야기를 이어 간 이야기꾼입니다. 그녀의 이야기에 아군은 기운이 솟고, 적은 넋을 놓아 칼끝이 무뎌집니다.'}),
  mk({id:'scimitar',name:'시미터 전사',short:'시미터',role:'쌍 초승달 칼',shape:'scimitar',castFx:'slash',season:'arabian',rarity:'R',gacha:true,unlockStage:999,
    body:'#b07a50',accent:'#e8e0c8',tunic:'#c83a3a',hp:820,atk:60,range:68,speed:48,interval:0.8,
    cost:230,kb:2,
    ab:{crit:{chance:.18,mul:2},dodge:.1},abText:'두 자루 초승달 칼 · 빠른 연속 베기 · 치명타 18% · 회피 10%',
    desc:'초승달처럼 휜 칼 두 자루를 번갈아 휘두르는 사막의 전사입니다. 빠르게 베고 날렵하게 피합니다.'}),
  mk({id:'camelarcher',name:'낙타 궁기병',short:'낙타궁',role:'사막의 궁기병',shape:'camelarcher',season:'arabian',rarity:'R',gacha:true,unlockStage:999,
    body:'#b07a50',accent:'#f0ece0',tunic:'#2a6a8a',hp:680,atk:62,range:310,speed:56,interval:1.35,
    cost:245,kb:2,ranged:true,
    ab:{pierce:true},abText:'낙타 위의 짧은 활 · 줄 선 적을 꿰뚫는 화살 · 빠름',
    desc:'낙타 등에 올라 모래 언덕을 넘나드는 궁기병입니다. 높은 곳에서 쏜 화살이 줄 선 적을 꿰뚫습니다.'}),
  mk({id:'bandit',name:'사막 도적',short:'도적',role:'마흔 도적',shape:'bandit',castFx:'slash',season:'arabian',rarity:'N',gacha:true,unlockStage:999,
    body:'#a87048',accent:'#e8c65a',tunic:'#3a3a3a',hp:600,atk:42,range:66,speed:52,interval:0.95,
    cost:140,kb:2,
    ab:{bounty:{chance:.12,gold:8}},abText:'굽은 단검 · 값싸고 빠름 · 맞힐 때 12% 확률로 금화 +8',
    desc:'"열려라 참깨!" — 마흔 도적의 졸개입니다. 싸고 날래며, 칼끝에 걸린 적의 주머니를 털어 금화를 챙깁니다.'})
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

/* 3.0: 같은 병종을 끝없이 겹쳐 세울 수 없다. 한 병종만 몰아 넣은 편성으로 전장을
 * 다 쓸어 담던 것을 막는다(메두사 열 명이 적을 영원히 굳히는 식). 비쌀수록 적게 선다. */
function stackCap(cost) {
  return cost < 100 ? 12 : cost < 170 ? 9 : cost < 250 ? 6 : cost < 330 ? 4 : cost < 450 ? 3 : 2;
}
/* 3.12: 값싼 기본 병종(창병·방패·투창·궁수, N 등급 소환병)은 동시 출진 제한이 없다 — 머릿수가 곧 쓸모다.
 * 대신 모든 병종이 함께 쓰는 전장 병력 상한(FIELD_CAP, game.js)에 걸린다. */
const FREE_STACK_COST = 160;
UNITS.forEach(u => {
  if (u.cost > 0 && !u.maxActive) {
    if (u.cost < FREE_STACK_COST) u.noStackCap = true;
    else u.maxActive = stackCap(u.cost);
  }
});

UNIT_BY_ID.zeus.active={name:'천둥의 칙령',kind:'thunderseal',cd:48,radius:180,mul:3.0,stun:.8,desc:'가장 가까운 적 주변 번개 피해·0.8초 기절.'};
UNIT_BY_ID.thor.active={name:'묠니르 강타',kind:'thunderseal',cd:45,radius:190,mul:2.6,stun:.6,desc:'가장 가까운 적 주변 충격파 피해·0.6초 기절.'};
UNIT_BY_ID.anubis.active={name:'사자의 결계',kind:'underworld',cd:50,radius:250,barrier:240,desc:'주변 아군에게 보호막·중독과 화상 정화.'};

/* ------------------------------------------------------------------
 *  비용 등급: 비싼 병종은 스펙을 크게, 대신 다시 부르기까지 오래 걸린다.
 *  - 체력·공격은 비용 200 부터 오르기 시작해 560 에서 +50%
 *  - 재출진 대기(쿨타임)는 병종마다 모두 다르다. 대략 2 + 0.00019×비용² 에
 *    지원·소환 병종은 조금 더, 값싼 벽과 징집병은 조금 덜.
 * ------------------------------------------------------------------ */
const UNIT_COOLDOWN = {
  spear: 2.2, shield: 5.1, hoplite: 5.7, archer: 6.0, pojol: 6.3, desertarcher: 6.6, rifleman: 6.9,
  northarcher: 7.2, bomber: 7.8, venom: 8.9, berserk: 9.6, clocksoldier: 9.9, priest: 10.5,
  herald: 11.1, scarab: 11.4, longbow: 11.7, spartan: 12.0, engineer: 12.2, hwarang: 12.5,
  frost: 12.9, mudang: 13.2, knight: 13.5, pyro: 14.4, purifier: 14.6, mechanic: 14.9, medusa: 15.1,
  duelist: 15.3, viking: 15.6, runeguard: 15.8, runeseer: 16.1, frostlancer: 16.4, bastet: 16.9,
  musketeer: 17.4, skadi: 17.7, merchant: 18.5, rogue: 19.1, sniper: 20.3, persephone: 20.6,
  haetae: 21.5, dokkaebi: 22.7, catapult: 24.0, teslaknight: 24.4, rapriest: 25.3, airship: 26.6,
  artemis: 29.4, fenrir: 30.9, ares: 32.4, pharaoh: 33.6, paladin: 35.3, necro: 35.8, valkyrie: 37.1,
  saja: 41.9, anubis: 43.0, thor: 45.6, steammech: 47.5, zeus: 49.4, colossus: 52.8, mage: 55.0,
  ra: 62.0, gumiho: 62.6, odin: 66.5, inventor: 69.4, hades: 74.5,
  // 3.0
  javelin: 5.4, celestial: 6.1, monkey: 12.8, falconer: 13.0, wujing: 13.8, bellringer: 14.2,
  alchemist: 18.0, monk: 18.8, lancer: 20.0, sanzang: 26.0, bajie: 27.5, nezha: 44.0, wukong: 68.0,
  // 3.3
  harpoon: 7.5, corsair: 13.7, beacon: 15.0, stormcaller: 33.0, anchorguard: 40.0,
  // 4.0 원탁의 기사 (같은 등급 병종들과 나란히)
  camelotguard: 6.4, galahad: 12.6, tristan: 13.1, morgana: 21.0, lancelot: 27.0, merlin: 50.0, arthur: 66.0,
  // 4.9 벚꽃 전국 · 기본 병종 셋
  ashigaru: 5.9, samurai: 12.7, kyudo: 13.3, miko: 20.5, ninja: 26.5, tengu: 44.5, susanoo: 66.2,
  maceman: 13.6, axethrower: 11.6, siegebow: 22.0,
  // 4.15 삼국지
  jiqiang: 6.2, tengjia: 12.3, huangzhong: 13.4, zhangfei: 21.2, zhaoyun: 26.3, zhugeliang: 44.8, guanyu: 66.4,
  // 5.2 천일야화
  bandit: 6.5, scimitar: 12.4, camelarcher: 13.9, scheherazade: 20.8, carpet: 25.8, sinbad: 44.2, genie: 67.2
};
const TIER_FROM = 200, TIER_TO = 560, TIER_MAX = 0.35;
function costTierMul(cost) {
  return 1 + TIER_MAX * Math.max(0, Math.min(1, (cost - TIER_FROM) / (TIER_TO - TIER_FROM)));
}
UNITS.forEach(u => {
  if (!u.cost) return;                                   // 소환물은 그대로
  const m = costTierMul(u.cost);
  u.hp = Math.round(u.hp * m);
  u.atk = Math.round(u.atk * m);
  if (UNIT_COOLDOWN[u.id] !== undefined) u.cooldown = UNIT_COOLDOWN[u.id];
});

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
    desc: '번개와 창의 신들이 왕국의 부름에 응합니다.',
    units: ['hades', 'persephone', 'zeus', 'ares', 'artemis', 'medusa', 'spartan', 'hoplite'] },
  { id: 'ragnarok', name: '라그나로크', sub: '북유럽 신화',
    color: '#8fb6d8', accent: '#2f5f8e',
    desc: '최후의 전투를 앞둔 북방의 전사들이 내려옵니다.',
    units: ['odin', 'skadi', 'thor', 'valkyrie', 'fenrir', 'viking', 'runeseer', 'northarcher'] },
  { id: 'nile', name: '나일의 왕가', sub: '이집트 신화',
    color: '#e8c65a', accent: '#8a6a1f',
    desc: '모래 아래 잠들어 있던 사자의 신과 사제들이 깨어납니다.',
    units: ['ra', 'bastet', 'anubis', 'rapriest', 'pharaoh', 'scarab', 'desertarcher'] },
  { id: 'yokai', name: '요괴록', sub: '한국 설화',
    color: '#e0707a', accent: '#8e1f2f',
    desc: '달 밝은 밤, 옛이야기 속 요괴와 저승의 관리들이 왕국 편에 섭니다.',
    units: ['gumiho', 'saja', 'dokkaebi', 'haetae', 'mudang', 'hwarang', 'pojol'] },
  { id: 'clockwork', name: '태엽 공방', sub: '증기와 톱니',
    color: '#d9a066', accent: '#6b4a24',
    desc: '연기 자욱한 공방에서 발명가들이 기계 군단을 이끌고 나옵니다.',
    units: ['inventor', 'steammech', 'airship', 'teslaknight', 'clocksoldier', 'mechanic', 'rifleman'] },
  { id: 'journey', name: '서유기', sub: '천궁 대란',
    color: '#e8a23a', accent: '#8e3a1f',
    desc: '구름을 타고 온 제천대성과 서역으로 가던 일행이 왕국의 전장에 내려섭니다.',
    units: ['wukong', 'nezha', 'sanzang', 'bajie', 'wujing', 'monkey', 'celestial'] },
  { id: 'camelot', name: '원탁의 기사', sub: '아서왕 전설',
    color: '#8fb4ec', accent: '#2a4a8e',
    desc: '성검이 다시 뽑히고, 원탁에 둘러앉았던 기사들이 왕국의 부름에 응합니다.',
    units: ['arthur', 'merlin', 'lancelot', 'morgana', 'tristan', 'galahad', 'camelotguard'] },
  { id: 'sengoku', name: '벚꽃 전국', sub: '일본 설화와 무사',
    color: '#f0a8c0', accent: '#a8324a',
    desc: '벚꽃이 흩날리는 산성에서 폭풍의 신과 요괴, 무사들이 왕국의 부름에 응합니다.',
    units: ['susanoo', 'tengu', 'ninja', 'miko', 'samurai', 'kyudo', 'ashigaru'] },
  { id: 'threekingdoms', name: '삼국지', sub: '도원결의와 와룡',
    color: '#e8b04a', accent: '#8e2a1f',
    desc: '복숭아밭에서 형제를 맺은 장수들과 와룡 선생이 왕국의 깃발 아래 모입니다.',
    units: ['guanyu', 'zhugeliang', 'zhaoyun', 'zhangfei', 'huangzhong', 'tengjia', 'jiqiang'] },
  { id: 'arabian', name: '천일야화', sub: '램프의 마신과 일곱 바다',
    color: '#5ad0e0', accent: '#6a2a8e',
    desc: '천 하룻밤의 이야기 속 램프의 마신과 일곱 바다의 선장, 하늘을 나는 양탄자가 왕국의 부름에 응합니다.',
    units: ['genie', 'sinbad', 'carpet', 'scheherazade', 'scimitar', 'camelarcher', 'bandit'] }
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
  wardtotem: { name: '수호 토템', body: '#3a4a6a', accent: '#ffd76a', tunic: '#22304a', shape: 'wardtotem',   // 4.21 보스 각인
              hp: 1000, atk: 0, range: 0, speed: 0, interval: 3, kb: 1, gold: 0, scale: 1.1,
              ab: { hold: true, noAttack: true, kbImmune: true } },
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
  /* ---------- 2.5 새 잡몹: 역할이 다른 여덟 ---------- */
  slinger:  { name: '고블린 투석병', body: '#4d6b3a', accent: '#a07a4a', tunic: '#5a4a2f', shape: 'slinger',
              hp: 260, atk: 30, range: 200, speed: 40, interval: 1.4, kb: 2, gold: 14, scale: .85, ranged: true,
              abText: '값싼 원거리 · 초반부터 뒤에서 돌을 던집니다' },
  drummer:  { name: '오크 북잡이', body: '#4a6b46', accent: '#c0392b', tunic: '#6b4a2a', shape: 'drummer',
              hp: 900, atk: 20, range: 60, speed: 32, interval: 1.6, kb: 2, gold: 40,
              ab: { rally: { atk: .3, radius: 220 }, interval: 2.5 }, abText: '전쟁 북 · 주변 적 공격력 +30%' },
  hexer:    { name: '저주 주술사', body: '#3f5a3c', accent: '#b784e0', tunic: '#3a2a4a', shape: 'hexer',
              hp: 800, atk: 40, range: 230, speed: 30, interval: 1.8, kb: 2, gold: 45, ranged: true,
              ab: { weaken: { mul: .7, dur: 4 } }, abText: '저주 · 맞은 아군의 공격력 -30% (4초)' },
  skelarcher:{ name: '해골 궁수', body: '#d8d2c0', accent: '#8a8f7a', tunic: '#5a5448', shape: 'skelarcher',
              hp: 520, atk: 55, range: 280, speed: 34, interval: 1.3, kb: 2, gold: 28, ranged: true,
              ab: { revive: .4 }, abText: '한 번 쓰러져도 다시 일어납니다' },
  boneguard:{ name: '해골 방패병', body: '#d8d2c0', accent: '#7a8a9a', tunic: '#4a4a52', shape: 'boneguard',
              hp: 1800, atk: 60, range: 60, speed: 30, interval: 1.3, kb: 1, gold: 40,
              ab: { revive: .5, armor: .1 }, abText: '갑주 10% · 한 번 쓰러져도 다시 일어납니다' },
  assassin: { name: '고블린 암살자', body: '#3f5a2f', accent: '#c0392b', tunic: '#1f2a1f', shape: 'assassin',
              hp: 700, atk: 110, range: 60, speed: 70, interval: .9, kb: 2, gold: 38, scale: .9,
              ab: { leap: { trigger: 170, range: 320 }, crit: { chance: .2, mul: 2 } },
              abText: '도약 · 전열을 뛰어넘어 궁수와 마법사를 노립니다' },
  burrower: { name: '땅굴 고블린', body: '#4d6b3a', accent: '#8a6a3a', tunic: '#5a4a2f', shape: 'burrower',
              hp: 1100, atk: 90, range: 60, speed: 55, interval: 1.0, kb: 2, gold: 36,
              ab: { burrow: { stun: 1.0, radius: 90 } }, abText: '땅굴 · 땅속으로 다가와 전열 밑에서 튀어나오며 기절' },
  chariot:  { name: '오크 전차', body: '#4a6b46', accent: '#8a5a2a', tunic: '#6b4a2a', shape: 'chariot',
              hp: 5200, atk: 280, range: 80, speed: 64, interval: 1.8, kb: 1, gold: 90, scale: 1.3,
              ab: { kbImmune: true, push: 35 }, abText: '돌격 전차 · 넉백 면역 · 들이받아 밀쳐 냅니다' },
  /* ---------- 3.0 특이한 적: 편성 한 가지로는 못 받아치는 일곱 ---------- */
  ooze:     { name: '분열 슬라임', body: '#5fae5a', accent: '#bff5a8', tunic: '#3f7a3c', shape: 'ooze',
              hp: 1500, atk: 55, range: 60, speed: 30, interval: 1.3, kb: 1, gold: 30, scale: 1.1,
              ab: { split: { id: 'oozelet', n: 2 } }, abText: '분열 · 쓰러지면 꼬마 슬라임 둘로 갈라집니다' },
  oozelet:  { name: '꼬마 슬라임', body: '#7cc46e', accent: '#d8ffc8', tunic: '#4f8f48', shape: 'oozelet',
              hp: 460, atk: 28, range: 56, speed: 46, interval: 1.0, kb: 2, gold: 6, scale: .7 },
  mirror:   { name: '거울 마녀', body: '#5a4a6b', accent: '#bfe9ff', tunic: '#3a2a4a', shape: 'mirror',
              hp: 1100, atk: 64, range: 220, speed: 30, interval: 1.7, kb: 2, gold: 50, ranged: true, noReinf: true,
              ab: { mirror: { cut: .5, reflect: .35 } }, abText: '거울 방패 · 원거리 피해 50% 감소, 35%를 쏜 자에게 되돌림' },
  jailer:   { name: '사슬 간수', body: '#4a6b46', accent: '#9aa3ab', tunic: '#3a3f48', shape: 'jailer',
              hp: 3400, atk: 150, range: 80, speed: 26, interval: 1.8, kb: 1, gold: 70, scale: 1.25, noReinf: true,
              ab: { hook: { cd: 8, range: 460, stun: 1.2 } }, abText: '갈고리 사슬 · 뒤쪽 원거리 아군을 끌어와 기절시킵니다' },
  thief:    { name: '금화 도둑', body: '#4d6b3a', accent: '#e8c65a', tunic: '#3a3a2a', shape: 'thief',
              hp: 620, atk: 38, range: 60, speed: 108, interval: .7, kb: 2, gold: 30, scale: .85,
              ab: { thief: { steal: 18 } }, abText: '소매치기 · 때릴 때마다 군자금을 훔치고, 쓰러뜨리면 되찾습니다' },
  // 3.7 금화 원정
  goldcart: { name: '황금 수레', body: '#7a5a34', accent: '#ffd35a', tunic: '#5c4326', shape: 'goldcart',
              hp: 1300, atk: 0, range: 40, speed: 44, interval: 3, kb: 1, gold: 300, scale: 1.2, noReinf: true,
              ab: { flee: 70, kbImmune: true, noAttack: true },
              abText: '싸우지 않고 아군 성채로 굴러감 · 닿기 전에 부수면 금화, 닿으면 달아남' },
  banditchief:{ name: '도적 두목', body: '#3a4a2e', accent: '#ffd35a', tunic: '#6b2a2a', shape: 'thief',
              hp: 5200, atk: 120, range: 70, speed: 70, interval: .8, kb: 1, gold: 1500, scale: 1.35, noReinf: true,
              ab: { thief: { steal: 45 }, dodge: .2 },
              abText: '큰손 소매치기 · 때릴 때마다 군자금 45를 훔치고 공격 20% 회피 · 쓰러뜨리면 되찾고 큰 금화' },
  goldwyrm: { name: '황금 비룡', body: '#c9a227', accent: '#fff1a8', tunic: '#8a6a1a', shape: 'drake',
              hp: 16000, atk: 640, range: 200, speed: 22, interval: 2.4, kb: 1, gold: 3000,
              area: true, areaRadius: 150, scale: 1.9, boss: true,
              special: { t: 'meteor', name: '금빛 숨결', cd: 10, n: 3, dmg: 300, radius: 115, warn: 1.1, kind: 'firestorm' },
              phases: [
                { at: 0.70, t: 'summon', name: '보물을 지켜라', id: 'goldcart', n: 2 },
                { at: 0.40, t: 'summon', name: '보물을 빼돌려라', id: 'goldcart', n: 3 },
                { at: 0.20, t: 'enrage', name: '탐욕의 분노', atk: 1.2, rate: 0.8 }
              ],
              abText: '금빛 숨결 · 체력이 깎이면 황금 수레를 빼돌린다' },
  chrono:   { name: '시간 주술사', body: '#3f5a3c', accent: '#8fe0ff', tunic: '#2a3a5a', shape: 'chrono',
              hp: 1300, atk: 50, range: 270, speed: 24, interval: 2.0, kb: 2, gold: 65, ranged: true, noReinf: true,
              ab: { chrono: .6 }, abText: '모래시계 · 살아 있는 동안 아군 카드 재사용 대기가 40% 느려집니다' },
  souleater:{ name: '흡혼귀', body: '#2a2438', accent: '#9d7bff', tunic: '#1c1828', shape: 'souleater',
              hp: 2600, atk: 150, range: 70, speed: 40, interval: 1.3, kb: 1, gold: 75, scale: 1.15, noReinf: true,
              ab: { souleater: { atk: .1, max: 10, radius: 320 } }, abText: '영혼 포식 · 근처에서 아군이 쓰러질 때마다 강해지고 회복합니다' },
  sapper:   { name: '성벽 파괴병', body: '#4d6b3a', accent: '#c0392b', tunic: '#5a4a2f', shape: 'sapper',
              hp: 950, atk: 0, range: 60, speed: 74, interval: 1, kb: 1, gold: 40, noReinf: true,
              ab: { sapper: { dmg: 650, radius: 90 } }, abText: '돌파 · 병사를 무시하고 성채로 달려가 자폭합니다' },
  /* ---------- 3.3 3막 '심연의 바다': 바다 군단 ---------- */
  clawcrab: { name: '집게 게', body: '#b5503a', accent: '#f0c0a0', tunic: '#7a2e20', shape: 'clawcrab',
              hp: 2600, atk: 140, range: 62, speed: 26, interval: 1.5, kb: 1, gold: 45, scale: 1.1,
              ab: { armor: 0.4, kbImmune: true }, abText: '단단한 등딱지 · 갑주 40% · 파쇄와 독으로' },
  nagaspear:{ name: '나가 창병', body: '#3a7a6a', accent: '#c8f0e0', tunic: '#245048', shape: 'nagaspear',
              hp: 1300, atk: 170, range: 125, speed: 48, interval: 1.3, kb: 2, gold: 40,
              ab: { dodge: 0.15 }, abText: '물결 몸놀림 · 공격 15% 회피 · 긴 창' },
  siren:    { name: '세이렌', body: '#6a8ab0', accent: '#ffd0f0', tunic: '#3a4a7a', shape: 'siren',
              hp: 1000, atk: 70, range: 260, speed: 28, interval: 2.0, kb: 2, gold: 55, ranged: true, noReinf: true,
              ab: { charm: { chance: 0.22, dur: 2.5 } }, abText: '노래 · 맞은 아군이 2.5초 홀려 제 편을 칩니다 · 등대지기의 등불로 막기' },
  deepone:  { name: '심연 어인', body: '#4a6a5a', accent: '#a0ffd0', tunic: '#2a3a32', shape: 'deepone',
              hp: 2000, atk: 160, range: 64, speed: 40, interval: 1.1, kb: 1, gold: 48,
              ab: { regen: 40, revive: 0.3 }, abText: '재생 · 초당 40 회복, 한 번 다시 일어남 · 화상이면 재생 멈춤' },
  jelly:    { name: '독 해파리', body: '#9a7ad0', accent: '#ffd0ff', tunic: '#6a4aa0', shape: 'jelly',
              hp: 700, atk: 40, range: 56, speed: 50, interval: 1.0, kb: 2, gold: 20, scale: .85,
              ab: { deathBomb: { dmg: 180, radius: 110 }, poison: { dps: 30, dur: 3 } }, abText: '촉수 · 중독, 터지며 쏘임' },
  tidecaller:{ name: '조수 술사', body: '#3a6a8a', accent: '#9fe8ff', tunic: '#1f3a5a', shape: 'tidecaller',
              hp: 1800, atk: 60, range: 230, speed: 26, interval: 2.0, kb: 1, gold: 70, ranged: true, noReinf: true,
              special: { t: 'roar', name: '밀물', first: 5, cd: 9, r: 260, push: 90 },
              abText: '밀물 · 9초마다 앞의 아군을 밀어냅니다' },
  seahook:  { name: '작살 어부', body: '#4a6a5a', accent: '#c8ced6', tunic: '#3a4a3a', shape: 'seahook',
              hp: 1400, atk: 120, range: 200, speed: 30, interval: 1.8, kb: 2, gold: 55, ranged: true, noReinf: true,
              ab: { hook: { cd: 9, range: 420, stun: 1.0 } }, abText: '작살 · 뒤쪽 원거리 아군을 끌어와 기절시킵니다' },
  eel:      { name: '전기 장어', body: '#3a5a7a', accent: '#ffe86a', tunic: '#22384e', shape: 'eel',
              hp: 900, atk: 110, range: 60, speed: 105, interval: .8, kb: 3, gold: 30,
              ab: { chain: { n: 2, fall: 0.6, range: 110 } }, abText: '전류 · 맞은 아군 옆으로 튕깁니다' },
  kraken:   { name: '크라켄', body: '#7a3a5a', accent: '#ffb0d0', tunic: '#4a1a3a', shape: 'kraken',
              hp: 26000, atk: 760, range: 190, speed: 16, interval: 2.4, kb: 1, gold: 1100,
              area: true, areaRadius: 150, scale: 2.0, boss: true,
              ab: { kbImmune: true, summon: { id: 'jelly', n: 2 }, interval: 10 },
              special: { t: 'meteor', name: '촉수 강타', cd: 10, n: 3, dmg: 380, radius: 120, warn: 1.1, stun: 0.5, kind: 'tidal' },
              phases: [
                { at: 0.65, t: 'roar',   name: '심해의 포효', r: 380, stun: 1.0, push: 90 },
                { at: 0.35, t: 'summon', name: '먹물 떼', id: 'eel', n: 4 },
                { at: 0.15, t: 'enrage', name: '크라켄의 분노', atk: 1.25, rate: 0.8 }
              ] },
  tidequeen:{ name: '해일 여왕', body: '#2a7a7a', accent: '#ffe9a0', tunic: '#1a4a5a', shape: 'tidequeen',
              hp: 28000, atk: 820, range: 200, speed: 20, interval: 2.2, kb: 1, gold: 1300,
              area: true, areaRadius: 160, scale: 1.9, boss: true,
              ab: { dodge: 0.1, summon: { id: 'nagaspear', n: 1 }, interval: 9 },
              special: { t: 'roar', name: '해일', cd: 11, r: 420, push: 120, stun: 0.6 },
              phases: [
                { at: 0.70, t: 'frost',  name: '소용돌이', r: 420, dur: 4 },
                { at: 0.45, t: 'summon', name: '근위 나가', id: 'nagaspear', n: 4 },
                { at: 0.30, t: 'heal',   name: '조수의 축복', ratio: 0.18 },
                { at: 0.12, t: 'enrage', name: '여왕의 노여움', atk: 1.25, rate: 0.8, speed: 1.2 }
              ] },
  leviathan:{ name: '리바이어던', body: '#1f3a5a', accent: '#6affd0', tunic: '#0e2238', shape: 'leviathan',
              hp: 34000, atk: 950, range: 220, speed: 14, interval: 2.6, kb: 1, gold: 2000,
              area: true, areaRadius: 180, scale: 2.4, boss: true,
              ab: { kbImmune: true, armor: 0.2 },
              special: { t: 'meteor', name: '해일 낙하', cd: 10, n: 4, dmg: 440, radius: 125, warn: 1.2, kind: 'tidal' },
              phases: [
                { at: 0.75, t: 'summon', name: '심연의 아이들', id: 'deepone', n: 3 },
                { at: 0.50, t: 'roar',   name: '심연의 울음', r: 440, stun: 1.2, push: 110 },
                { at: 0.30, t: 'swap',   name: '심연 개방',
                            special: { t: 'meteor', name: '해일 낙하', first: 3, cd: 7, n: 5, dmg: 480, radius: 125, warn: 1.1, kind: 'tidal' } },
                { at: 0.12, t: 'enrage', name: '바다의 종말', atk: 1.25, rate: 0.8, speed: 1.2 }
              ] },
  /* ---------- 4.0 4막 '천공 요새': 하늘의 군단 ---------- */
  harpy:    { name: '하피', body: '#8a6a9a', accent: '#ffd07a', tunic: '#5a3a6a', shape: 'harpy',
              hp: 860, atk: 100, range: 58, speed: 108, interval: .8, kb: 3, gold: 24, scale: .85,
              ab: { dodge: .25 }, abText: '날쌘 깃털 · 25% 회피 · 아주 빠름' },
  griffinrider:{ name: '그리폰 기수', body: '#c8a060', accent: '#e8e0c8', tunic: '#6a4a2a', shape: 'griffinrider',
              hp: 1700, atk: 150, range: 72, speed: 60, interval: 1.2, kb: 2, gold: 70, scale: 1.2,
              ab: { leap: { trigger: 170, range: 320 } }, abText: '급강하 · 전열을 넘어 뒤의 원거리 병사를 덮칩니다' },
  stormwisp:{ name: '폭풍 정령', body: '#6a8ab8', accent: '#e8f6ff', tunic: '#3a4a7a', shape: 'stormwisp',
              hp: 1200, atk: 105, range: 240, speed: 30, interval: 2.0, kb: 2, gold: 55, ranged: true,
              ab: { chain: { n: 3, fall: 0.6, range: 120 } }, abText: '연쇄 번개 · 맞은 아군 옆으로 세 번 튕깁니다' },
  cloudgiant:{ name: '구름 거인', body: '#c8d4e4', accent: '#7a9ac8', tunic: '#8aa0c0', shape: 'cloudgiant',
              hp: 3800, atk: 220, range: 92, speed: 22, interval: 1.9, kb: 1, gold: 150, scale: 1.45, noReinf: true,
              ab: { kbImmune: true, armor: 0.25, regen: 60 }, abText: '구름 몸 · 갑주 25% · 초당 60 회복 · 화상이면 재생 멈춤' },
  skycannon:{ name: '천공 포대', body: '#5a6a7a', accent: '#ffd35a', tunic: '#3a4a5a', shape: 'skycannon',
              hp: 1100, atk: 70, range: 300, speed: 14, interval: 3.6, kb: 1, gold: 95, ranged: true, noReinf: true,
              area: true, areaRadius: 80, scale: 1.15, abText: '포격 · 아주 멀리서 무리를 노립니다' },
  windcaller:{ name: '바람 주술사', body: '#5a8a8a', accent: '#c8fff0', tunic: '#2a4a4a', shape: 'windcaller',
              hp: 1700, atk: 60, range: 230, speed: 26, interval: 2.0, kb: 1, gold: 70, ranged: true, noReinf: true,
              special: { t: 'roar', name: '돌풍', first: 5, cd: 9, r: 260, push: 100 },
              abText: '돌풍 · 9초마다 앞의 아군을 밀어냅니다 · 넉백 면역은 버팁니다' },
  stormgriffin:{ name: '폭풍 그리폰 왕', body: '#c89850', accent: '#9fe8ff', tunic: '#7a5a2a', shape: 'stormgriffin',
              hp: 30000, atk: 860, range: 140, speed: 30, interval: 2.0, kb: 1, gold: 1400,
              area: true, areaRadius: 150, scale: 2.0, boss: true,
              ab: { kbImmune: true, dodge: 0.12, summon: { id: 'harpy', n: 2 }, interval: 9 },
              special: { t: 'meteor', name: '번개 강하', cd: 10, n: 3, dmg: 400, radius: 120, warn: 1.1, stun: 0.5, kind: 'storm' },
              phases: [
                { at: 0.65, t: 'roar',   name: '폭풍의 울음', r: 400, stun: 1.0, push: 100 },
                { at: 0.35, t: 'summon', name: '하피 떼', id: 'harpy', n: 5 },
                { at: 0.15, t: 'enrage', name: '폭풍왕의 분노', atk: 1.25, rate: 0.8, speed: 1.2 }
              ] },
  cloudking:{ name: '구름 왕', body: '#d8e0ec', accent: '#ffd76a', tunic: '#8aa0c8', shape: 'cloudking',
              hp: 32000, atk: 900, range: 120, speed: 16, interval: 2.4, kb: 1, gold: 1600,
              area: true, areaRadius: 170, scale: 2.2, boss: true,
              ab: { kbImmune: true, armor: 0.2, regen: 80 },
              special: { t: 'roar', name: '천둥 박수', cd: 11, r: 420, push: 120, stun: 0.6 },
              phases: [
                { at: 0.70, t: 'frost',  name: '구름 장막', r: 420, dur: 4 },
                { at: 0.45, t: 'summon', name: '구름 거인', id: 'cloudgiant', n: 2 },
                { at: 0.30, t: 'heal',   name: '비의 축복', ratio: 0.15 },
                { at: 0.12, t: 'enrage', name: '왕의 노여움', atk: 1.25, rate: 0.8 }
              ] },
  skylord:  { name: '천공의 군주', body: '#3a3a5a', accent: '#ffe28a', tunic: '#1a1a3a', shape: 'skylord',
              hp: 38000, atk: 1000, range: 240, speed: 14, interval: 2.6, kb: 1, gold: 2400,
              area: true, areaRadius: 180, scale: 2.4, boss: true,
              ab: { kbImmune: true, armor: 0.2 },
              special: { t: 'meteor', name: '천벌', cd: 10, n: 4, dmg: 460, radius: 125, warn: 1.2, kind: 'lightning' },
              phases: [
                { at: 0.75, t: 'summon', name: '그리폰 기사단', id: 'griffinrider', n: 3 },
                { at: 0.50, t: 'roar',   name: '하늘의 진노', r: 440, stun: 1.2, push: 110 },
                { at: 0.30, t: 'swap',   name: '폭풍 개방',
                            special: { t: 'meteor', name: '천벌', first: 3, cd: 7, n: 5, dmg: 500, radius: 125, warn: 1.1, kind: 'lightning' } },
                { at: 0.12, t: 'enrage', name: '천공의 종말', atk: 1.25, rate: 0.8, speed: 1.2 }
              ] },
  /* ---------- 4.6 5막 '잊힌 밀림': 비늘과 뿔의 군단 ---------- */
  lizardman:{ name: '도마뱀 전사', body: '#5a8a3a', accent: '#e8c84a', tunic: '#7a4a2a', shape: 'lizardman',
              hp: 2100, atk: 200, range: 66, speed: 54, interval: 1.0, kb: 2, gold: 60,
              ab: { dodge: 0.15, lifesteal: 0.15 }, abText: '비늘 방패 · 15% 회피 · 흡혈 15%' },
  raptor:   { name: '랩터', body: '#8a6a3a', accent: '#e8603a', tunic: '#5a3a1a', shape: 'raptor',
              hp: 1150, atk: 160, range: 56, speed: 132, interval: .7, kb: 3, gold: 30, scale: .9,
              ab: { leap: { trigger: 170, range: 300 } }, abText: '무리 사냥 · 아주 빠름 · 전열을 뛰어넘어 원거리 병사를 덮칩니다' },
  poisontoad:{ name: '독두꺼비', body: '#6a9a3a', accent: '#c84ae8', tunic: '#3a5a2a', shape: 'poisontoad',
              hp: 1600, atk: 95, range: 210, speed: 26, interval: 1.7, kb: 1, gold: 55, ranged: true, scale: 1.05,
              area: true, areaRadius: 75, ab: { poison: { dps: 70, dur: 4 } }, abText: '독 침 · 범위 중독 70/초 · 정화로 해제' },
  vineshaman:{ name: '덩굴 주술사', body: '#4a6a3a', accent: '#9fe86a', tunic: '#2a4a2a', shape: 'vineshaman',
              hp: 1800, atk: 70, range: 230, speed: 24, interval: 2.0, kb: 1, gold: 75, ranged: true, noReinf: true,
              ab: { heal: 170, radius: 220, interval: 4 },
              special: { t: 'frost', name: '휘감는 덩굴', first: 5, cd: 10, r: 260, dur: 3 },
              abText: '치유 · 4초마다 주변 적 회복 · 10초마다 덩굴로 아군을 묶어 느리게' },
  stoneidol:{ name: '석상 수호자', body: '#8a8a6a', accent: '#4ae8c8', tunic: '#6a6a4a', shape: 'stoneidol',
              hp: 4400, atk: 210, range: 82, speed: 20, interval: 2.0, kb: 1, gold: 140, scale: 1.35, noReinf: true,
              ab: { kbImmune: true, armor: 0.35, thorns: 0.2 }, abText: '돌 몸 · 갑주 35% · 근접 피해 20% 반사 · 넉백 면역' },
  triceratops:{ name: '뿔 공룡', body: '#7a8a5a', accent: '#e8d8a8', tunic: '#5a6a3a', shape: 'triceratops',
              hp: 5400, atk: 270, range: 90, speed: 30, interval: 1.8, kb: 1, gold: 170, scale: 1.5, noReinf: true,
              ab: { kbImmune: true, armor: 0.2, charge: { dist: 150, mul: 2.2, push: 130 } },
              abText: '뿔 돌진 · 달려와 첫 일격 2.2배로 밀쳐 냄 · 갑주 20% · 넉백 면역' },
  raptorqueen:{ name: '랩터 여왕', body: '#9a6a2a', accent: '#ff5a3a', tunic: '#6a3a1a', shape: 'raptorqueen',
              hp: 34000, atk: 900, range: 96, speed: 52, interval: 1.4, kb: 1, gold: 1600,
              area: true, areaRadius: 130, scale: 1.9, boss: true,
              ab: { kbImmune: true, dodge: 0.15, summon: { id: 'raptor', n: 3 }, interval: 8 },
              special: { t: 'roar', name: '사냥의 포효', cd: 10, r: 380, stun: 0.8, push: 90 },
              phases: [
                { at: 0.65, t: 'summon', name: '사냥 무리', id: 'raptor', n: 6 },
                { at: 0.40, t: 'roar',   name: '피 냄새', r: 460, stun: 1.2, push: 120 },
                { at: 0.15, t: 'enrage', name: '여왕의 광란', atk: 1.3, rate: 0.75, speed: 1.3 }
              ] },
  quetzal:  { name: '깃털 뱀', body: '#3aa87a', accent: '#ffd23a', tunic: '#e84a3a', shape: 'quetzal',
              hp: 36000, atk: 940, range: 230, speed: 18, interval: 2.4, kb: 1, gold: 1800, ranged: true,
              area: true, areaRadius: 160, scale: 2.1, boss: true,
              ab: { kbImmune: true, dodge: 0.1 },
              special: { t: 'meteor', name: '태양 깃털', cd: 9, n: 4, dmg: 500, radius: 120, warn: 1.1, burn: { dps: 60, dur: 3 }, kind: 'firestorm' },
              phases: [
                { at: 0.75, t: 'summon', name: '도마뱀 전사단', id: 'lizardman', n: 4 },
                { at: 0.50, t: 'roar',   name: '깃털 폭풍', r: 440, stun: 1.0, push: 120 },
                { at: 0.30, t: 'swap',   name: '일식의 날개',
                            special: { t: 'meteor', name: '태양 깃털', first: 3, cd: 6, n: 5, dmg: 520, radius: 125, warn: 1.0, burn: { dps: 70, dur: 3 }, kind: 'firestorm' } },
                { at: 0.12, t: 'enrage', name: '신의 분노', atk: 1.25, rate: 0.8, speed: 1.2 }
              ] },
  jungletyrant:{ name: '밀림의 폭군', body: '#5a4a3a', accent: '#ff7a2a', tunic: '#3a2a1a', shape: 'jungletyrant',
              hp: 44000, atk: 1150, range: 132, speed: 22, interval: 2.2, kb: 1, gold: 2800,
              area: true, areaRadius: 185, scale: 2.5, boss: true,
              ab: { kbImmune: true, armor: 0.2 },
              special: { t: 'roar', name: '폭군의 포효', cd: 11, r: 460, stun: 1.2, push: 130 },
              phases: [
                { at: 0.75, t: 'summon', name: '뿔 공룡 떼', id: 'triceratops', n: 2 },
                { at: 0.55, t: 'swap',   name: '화산 분화',
                            special: { t: 'meteor', name: '불타는 바위', first: 2, cd: 7, n: 5, dmg: 540, radius: 130, warn: 1.1, burn: { dps: 70, dur: 3 }, kind: 'firestorm' } },
                { at: 0.35, t: 'summon', name: '랩터 떼', id: 'raptor', n: 8 },
                { at: 0.12, t: 'enrage', name: '멸종의 분노', atk: 1.3, rate: 0.75, speed: 1.25 }
              ] },
  /* ---------- 4.11 6막 '홀린 요정 숲': 요정과 버섯, 나무 정령의 군단 ---------- */
  pixie:    { name: '장난꾸러기 요정', body: '#f0d8f8', accent: '#7ae8ff', tunic: '#c86ae8', shape: 'pixie',
              hp: 950, atk: 80, range: 150, speed: 120, interval: .65, kb: 3, gold: 30, ranged: true, scale: .75,
              ab: { dodge: 0.35 }, abText: '요정 가루 · 35% 회피 · 아주 빠름 · 떼로 날아듭니다' },
  sporecap: { name: '독버섯 병사', body: '#e8d8c0', accent: '#b06ae8', tunic: '#c83a4a', shape: 'sporecap',
              hp: 2700, atk: 215, range: 62, speed: 40, interval: 1.1, kb: 2, gold: 60, scale: 1.05,
              ab: { armor: 0.15, deathBomb: { dmg: 220, radius: 105, poison: { dps: 85, dur: 4 } } },
              abText: '버섯 갓 · 갑주 15% · 쓰러지면 포자가 터져 둘레를 중독 (85/초)' },
  treant:   { name: '나무 정령', body: '#6a5a3a', accent: '#8ae86a', tunic: '#4a3a22', shape: 'treant',
              hp: 6600, atk: 290, range: 92, speed: 22, interval: 2.0, kb: 1, gold: 180, scale: 1.6, noReinf: true,
              area: true, areaRadius: 90, ab: { kbImmune: true, armor: 0.25, regen: 90 },
              abText: '나무 몸 · 갑주 25% · 초당 90 회복 · 화상이면 재생 멈춤 · 넉백 면역' },
  satyr:    { name: '사티로스 피리꾼', body: '#a8784a', accent: '#ffd25a', tunic: '#6a4a2a', shape: 'satyr',
              hp: 2100, atk: 150, range: 240, speed: 34, interval: 1.4, kb: 1, gold: 70, ranged: true, noReinf: true,
              ab: { rally: { atk: .3, radius: 220 }, interval: 2.5, weaken: { mul: .75, dur: 3 } },
              abText: '홀리는 피리 · 주변 적 공격력 +30% · 맞은 아군 공격력 -25% (3초)' },
  unicorn:  { name: '일각수 기사', body: '#f4f0ff', accent: '#ff8ad8', tunic: '#8a7ae8', shape: 'unicorn',
              hp: 3700, atk: 265, range: 78, speed: 74, interval: 1.2, kb: 1, gold: 120, scale: 1.25, noReinf: true,
              ab: { charge: { dist: 140, mul: 2.3, push: 110 }, heal: 150, radius: 180, interval: 5 },
              abText: '뿔 돌격 · 달려와 첫 일격 2.3배 · 5초마다 주변 적 회복' },
  wisp:     { name: '홀림불', body: '#c8fff0', accent: '#5affc8', tunic: '#3aa88a', shape: 'wisp',
              hp: 1600, atk: 175, range: 200, speed: 46, interval: 1.5, kb: 2, gold: 50, ranged: true, scale: 1.1,
              ab: { glamour: 130, burn: { dps: 50, dur: 3 } },
              abText: '홀림 장막 · 130 안으로 다가와야 보입니다 (멀리서 못 쏨 · 범위 공격은 맞음) · 도깨비불 화상' },
  mushking: { name: '버섯 왕', body: '#e8d0b0', accent: '#b06ae8', tunic: '#c8303a', shape: 'mushking',
              hp: 40000, atk: 1000, range: 100, speed: 20, interval: 2.0, kb: 1, gold: 2000,
              area: true, areaRadius: 150, scale: 2.2, boss: true,
              ab: { kbImmune: true, armor: 0.15, summon: { id: 'sporecap', n: 2 }, interval: 9 },
              special: { t: 'meteor', name: '포자 폭탄', cd: 9, n: 4, dmg: 470, radius: 120, warn: 1.1, poison: { dps: 90, dur: 4 }, kind: 'runes' },
              phases: [
                { at: 0.70, t: 'summon', name: '버섯 군락', id: 'sporecap', n: 5 },
                { at: 0.45, t: 'roar',   name: '포자 폭풍', r: 440, stun: 1.0, push: 110 },
                { at: 0.15, t: 'enrage', name: '균사의 분노', atk: 1.3, rate: 0.75, speed: 1.3 }
              ] },
  faequeen: { name: '달빛 요정 여왕', body: '#f8e8ff', accent: '#7ae8ff', tunic: '#a86ae8', shape: 'faequeen',
              hp: 38000, atk: 960, range: 260, speed: 18, interval: 2.2, kb: 1, gold: 2300, ranged: true,
              area: true, areaRadius: 140, scale: 2.0, boss: true,
              ab: { kbImmune: true, dodge: 0.2 },
              special: { t: 'frost', name: '얽히는 꽃덩굴', first: 6, cd: 10, r: 300, dur: 3 },
              phases: [
                { at: 0.75, t: 'summon', name: '요정 무리', id: 'pixie', n: 8 },
                { at: 0.50, t: 'summon', name: '홀림불 행렬', id: 'wisp', n: 4 },
                { at: 0.30, t: 'swap',   name: '달빛 화살비',
                            special: { t: 'meteor', name: '달빛 화살', first: 3, cd: 7, n: 5, dmg: 520, radius: 120, warn: 1.0, kind: 'lightning' } },
                { at: 0.12, t: 'enrage', name: '여왕의 노여움', atk: 1.25, rate: 0.75, speed: 1.2 }
              ] },
  eldertree:{ name: '고목왕', body: '#5a4a32', accent: '#9ae86a', tunic: '#3a2a1a', shape: 'eldertree',
              hp: 50000, atk: 1250, range: 140, speed: 14, interval: 2.4, kb: 1, gold: 3200,
              area: true, areaRadius: 190, scale: 2.7, boss: true,
              ab: { kbImmune: true, armor: 0.25, regen: 220 },
              special: { t: 'roar', name: '뿌리 흔들기', cd: 11, r: 460, stun: 1.2, push: 120 },
              phases: [
                { at: 0.75, t: 'summon', name: '깨어난 숲', id: 'treant', n: 2 },
                { at: 0.55, t: 'swap',   name: '떨어지는 고목 열매',
                            special: { t: 'meteor', name: '고목 열매', first: 2, cd: 7, n: 5, dmg: 560, radius: 130, warn: 1.1, poison: { dps: 80, dur: 3 }, kind: 'shockwave' } },
                { at: 0.35, t: 'summon', name: '일각수 기사단', id: 'unicorn', n: 3 },
                { at: 0.12, t: 'enrage', name: '숲의 분노', atk: 1.3, rate: 0.75, speed: 1.25 }
              ],
              abText: '고목 · 갑주 25% · 초당 220 회복 (화상이면 멈춤) · 뿌리로 밀쳐 기절' },
  /* ---------- 4.15 7막 '모래폭풍 사막': 전갈 · 미라 · 모래벌레의 군단 ---------- */
  scorpion: { name: '거대 전갈', body: '#b8783a', accent: '#5aff8a', tunic: '#7a4a22', shape: 'scorpion',
              hp: 3300, atk: 250, range: 70, speed: 50, interval: 1.1, kb: 2, gold: 70, scale: 1.15,
              ab: { armor: 0.25, poison: { dps: 70, dur: 3 } }, abText: '독침 · 갑주 25% · 중독 70/초' },
  mummy:    { name: '미라 병사', body: '#d8cca8', accent: '#5ae8ff', tunic: '#a89870', shape: 'mummy',
              hp: 2600, atk: 220, range: 62, speed: 34, interval: 1.2, kb: 2, gold: 60,
              ab: { revive: 0.5 }, abText: '붕대 몸 · 한 번 쓰러져도 체력 50% 로 다시 일어남' },
  sandworm: { name: '모래벌레', body: '#c89a5a', accent: '#ff7a5a', tunic: '#8a6a3a', shape: 'sandworm',
              hp: 7500, atk: 320, range: 96, speed: 40, interval: 1.8, kb: 1, gold: 200, scale: 1.6, noReinf: true,
              area: true, areaRadius: 100, ab: { kbImmune: true, armor: 0.2, burrow: { stun: 1.0, radius: 110 } },
              abText: '땅속으로 다가와 전열 밑에서 솟구치며 기절 · 갑주 20% · 넉백 면역' },
  dunerider:{ name: '사막 약탈자', body: '#7a5a3a', accent: '#ffd25a', tunic: '#3a5a8a', shape: 'dunerider',
              hp: 2300, atk: 210, range: 260, speed: 70, interval: 1.3, kb: 2, gold: 70, ranged: true, scale: 1.1,
              ab: { dodge: 0.15 }, abText: '낙타 궁기병 · 빠르게 달려와 쏨 · 15% 회피' },
  sandmage: { name: '모래 술사', body: '#8a6a4a', accent: '#ffb84a', tunic: '#5a2a5a', shape: 'sandmage',
              hp: 2200, atk: 150, range: 240, speed: 30, interval: 1.8, kb: 1, gold: 80, ranged: true, noReinf: true,
              area: true, areaRadius: 90, ab: { weaken: { mul: 0.75, dur: 3 } }, abText: '모래 회오리 · 범위 공격 · 맞은 아군 공격력 -25% (3초)' },
  scarab:   { name: '황금 풍뎅이 떼', body: '#c8a83a', accent: '#5affd8', tunic: '#7a5a1a', shape: 'scarab_e',
              hp: 1800, atk: 160, range: 58, speed: 88, interval: .8, kb: 2, gold: 40, scale: .95,
              ab: { split: { id: 'scarablet', n: 3 } }, abText: '떼 · 아주 빠름 · 쓰러지면 작은 풍뎅이 셋으로 흩어짐' },
  scarablet:{ name: '작은 풍뎅이', body: '#d8b84a', accent: '#5affd8', tunic: '#8a6a2a', shape: 'scarablet',
              hp: 520, atk: 80, range: 52, speed: 104, interval: .7, kb: 3, gold: 6, scale: .65 },
  scorpking:{ name: '전갈 왕', body: '#a8602a', accent: '#5aff8a', tunic: '#6a3a1a', shape: 'scorpking',
              hp: 46000, atk: 1150, range: 110, speed: 22, interval: 2.0, kb: 1, gold: 2400,
              area: true, areaRadius: 160, scale: 2.3, boss: true,
              ab: { kbImmune: true, armor: 0.25, poison: { dps: 120, dur: 4 } },
              special: { t: 'meteor', name: '독침 비', cd: 9, n: 4, dmg: 520, radius: 120, warn: 1.1, poison: { dps: 110, dur: 4 }, kind: 'runes' },
              phases: [
                { at: 0.70, t: 'summon', name: '전갈 떼', id: 'scorpion', n: 4 },
                { at: 0.45, t: 'roar',   name: '모래 꼬리치기', r: 440, stun: 1.0, push: 110 },
                { at: 0.15, t: 'enrage', name: '독의 분노', atk: 1.3, rate: 0.75, speed: 1.3 }
              ] },
  sphinx:   { name: '스핑크스', body: '#d8b06a', accent: '#5ac8ff', tunic: '#2a4a8a', shape: 'sphinx',
              hp: 44000, atk: 1050, range: 270, speed: 16, interval: 2.2, kb: 1, gold: 2600, ranged: true,
              area: true, areaRadius: 150, scale: 2.3, boss: true,
              ab: { kbImmune: true, dodge: 0.1 },
              special: { t: 'frost', name: '수수께끼의 모래', first: 6, cd: 10, r: 320, dur: 3 },
              phases: [
                { at: 0.75, t: 'summon', name: '미라 근위대', id: 'mummy', n: 5 },
                { at: 0.50, t: 'swap',   name: '태양 광선',
                            special: { t: 'meteor', name: '태양 광선', first: 3, cd: 7, n: 5, dmg: 560, radius: 120, warn: 1.0, burn: { dps: 80, dur: 3 }, kind: 'lightning' } },
                { at: 0.30, t: 'summon', name: '약탈자 습격', id: 'dunerider', n: 4 },
                { at: 0.12, t: 'enrage', name: '풀리지 않는 수수께끼', atk: 1.25, rate: 0.75, speed: 1.2 }
              ] },
  sandpharaoh:{ name: '모래폭풍의 파라오', body: '#c8a86a', accent: '#ffd23a', tunic: '#2a3a7a', shape: 'sandpharaoh',
              hp: 56000, atk: 1350, range: 140, speed: 16, interval: 2.4, kb: 1, gold: 3600,
              area: true, areaRadius: 190, scale: 2.6, boss: true,
              ab: { kbImmune: true, armor: 0.2, revive: 0.3 },
              special: { t: 'roar', name: '모래폭풍의 포효', cd: 11, r: 460, stun: 1.2, push: 120 },
              phases: [
                { at: 0.75, t: 'summon', name: '모래벌레 소환', id: 'sandworm', n: 2 },
                { at: 0.55, t: 'swap',   name: '무너지는 피라미드',
                            special: { t: 'meteor', name: '떨어지는 사암', first: 2, cd: 7, n: 5, dmg: 600, radius: 130, warn: 1.1, kind: 'shockwave' } },
                { at: 0.35, t: 'summon', name: '불멸의 군단', id: 'mummy', n: 6 },
                { at: 0.12, t: 'enrage', name: '사막의 분노', atk: 1.3, rate: 0.75, speed: 1.25 }
              ],
              abText: '파라오 · 갑주 20% · 한 번 쓰러져도 체력 30% 로 다시 일어남 · 모래폭풍의 포효' },
  /* ---------- 5.3 9막 '불의 산맥': 용암 군단 (lavaborn — 분화에 다치지 않고 화상은 반만, 둔화되면 받는 피해 +25%) ---------- */
  salamander:{ name: '불도마뱀', body: '#c8502a', accent: '#ffd23a', tunic: '#5a1e12', shape: 'salamander',
              hp: 3800, atk: 280, range: 66, speed: 58, interval: 1.0, kb: 2, gold: 70, scale: 1.1,
              ab: { lavaborn: true, burn: { dps: 80, dur: 3 } }, abText: '용암 몸 · 화상 80/초 · 분화에 다치지 않음 · 서리에 약함' },
  magmaling:{ name: '용암 덩이', body: '#e8602a', accent: '#ffe08a', tunic: '#3a1a12', shape: 'magmaling',
              hp: 1600, atk: 150, range: 54, speed: 80, interval: .8, kb: 3, gold: 30, scale: .85,
              ab: { lavaborn: true, deathBomb: { dmg: 220, radius: 100 } }, abText: '떼 · 빠름 · 쓰러지며 터진다 · 분화에 다치지 않음' },
  obsidian: { name: '흑요석 거인', body: '#2a2630', accent: '#ff6a2a', tunic: '#1a1620', shape: 'obsidian',
              hp: 9000, atk: 340, range: 82, speed: 26, interval: 1.8, kb: 1, gold: 220, scale: 1.6, noReinf: true,
              area: true, areaRadius: 90, ab: { lavaborn: true, kbImmune: true, armor: 0.35, thorns: 0.15 },
              abText: '검은 유리 몸 · 갑주 35% · 때린 근접에게 15% 되돌림 · 넉백 면역 · 파쇄와 서리로' },
  ashcaster:{ name: '잿빛 주술사', body: '#6a6268', accent: '#ff8a3a', tunic: '#3a2a2e', shape: 'ashcaster',
              hp: 2400, atk: 170, range: 250, speed: 30, interval: 1.9, kb: 1, gold: 90, ranged: true, noReinf: true,
              area: true, areaRadius: 90, ab: { lavaborn: true, burn: { dps: 60, dur: 4 }, weaken: { mul: 0.8, dur: 3 } },
              abText: '화산재 저주 · 범위 · 화상 · 맞은 아군 공격력 -20% (3초)' },
  cinderbat:{ name: '불티 박쥐', body: '#3a2024', accent: '#ff9a3a', tunic: '#5a1a12', shape: 'cinderbat',
              hp: 1400, atk: 130, range: 54, speed: 96, interval: .7, kb: 3, gold: 25, scale: .8,
              ab: { lavaborn: true, dodge: 0.2, burn: { dps: 50, dur: 2 } }, abText: '불티를 흘리며 나는 박쥐 떼 · 아주 빠름 · 20% 회피' },
  magmacannon:{ name: '용암 투석병', body: '#5a3a2a', accent: '#ff7a2a', tunic: '#2a2224', shape: 'magmacannon',
              hp: 3000, atk: 300, range: 330, speed: 28, interval: 2.6, kb: 1, gold: 110, ranged: true, noReinf: true,
              area: true, areaRadius: 100, scale: 1.15, ab: { lavaborn: true, burn: { dps: 70, dur: 3 } },
              abText: '용암 덩어리를 멀리 던진다 · 범위 · 화상' },
  lavawyrm: { name: '용암 거룡', body: '#8a2a1a', accent: '#ffb02a', tunic: '#3a1210', shape: 'lavawyrm',
              hp: 50000, atk: 1200, range: 120, speed: 20, interval: 2.0, kb: 1, gold: 2600,
              area: true, areaRadius: 170, scale: 2.4, boss: true,
              ab: { kbImmune: true, armor: 0.2, lavaborn: true, burn: { dps: 120, dur: 4 } },
              special: { t: 'meteor', name: '용암 비', cd: 9, n: 4, dmg: 560, radius: 120, warn: 1.1, burn: { dps: 100, dur: 4 }, kind: 'eruption' },
              phases: [
                { at: 0.70, t: 'summon', name: '불도마뱀 떼', id: 'salamander', n: 4 },
                { at: 0.45, t: 'roar',   name: '땅을 가르는 꼬리', r: 440, stun: 1.0, push: 110 },
                { at: 0.15, t: 'enrage', name: '끓어오르는 피', atk: 1.3, rate: 0.75, speed: 1.3 }
              ],
              abText: '용암 거룡 · 갑주 20% · 화상 · 용암 비' },
  phoenix:  { name: '불사조', body: '#ff7a2a', accent: '#ffe85a', tunic: '#c8301a', shape: 'phoenix',
              hp: 42000, atk: 1050, range: 260, speed: 18, interval: 2.1, kb: 1, gold: 2800, ranged: true,
              area: true, areaRadius: 150, scale: 2.3, boss: true,
              ab: { kbImmune: true, dodge: 0.1, revive: 0.5, lavaborn: true },
              special: { t: 'meteor', name: '불꽃 깃털', first: 5, cd: 8, n: 5, dmg: 480, radius: 100, warn: 1.0, burn: { dps: 90, dur: 3 }, kind: 'firestorm' },
              phases: [
                { at: 0.70, t: 'summon', name: '불티 떼', id: 'cinderbat', n: 6 },
                { at: 0.40, t: 'summon', name: '용암 방울', id: 'magmaling', n: 6 },
                { at: 0.12, t: 'enrage', name: '재 속의 불꽃', atk: 1.25, rate: 0.75, speed: 1.2 }
              ],
              abText: '불사조 · 한 번 쓰러져도 재에서 체력 50% 로 다시 날아오른다 · 불꽃 깃털' },
  magmalord:{ name: '용암 군주', body: '#2a1a1a', accent: '#ff5a1a', tunic: '#5a1a10', shape: 'magmalord',
              hp: 62000, atk: 1400, range: 150, speed: 16, interval: 2.4, kb: 1, gold: 3800,
              area: true, areaRadius: 200, scale: 2.7, boss: true,
              ab: { kbImmune: true, armor: 0.25, lavaborn: true },
              special: { t: 'roar', name: '화산의 포효', cd: 11, r: 460, stun: 1.2, push: 120 },
              phases: [
                { at: 0.75, t: 'summon', name: '흑요석 근위대', id: 'obsidian', n: 2 },
                { at: 0.55, t: 'swap',   name: '대분화',
                            special: { t: 'meteor', name: '대분화', first: 2, cd: 7, n: 6, dmg: 620, radius: 130, warn: 1.2, burn: { dps: 110, dur: 4 }, kind: 'eruption' } },
                { at: 0.35, t: 'summon', name: '불도마뱀 군단', id: 'salamander', n: 6 },
                { at: 0.12, t: 'enrage', name: '산이 무너진다', atk: 1.3, rate: 0.75, speed: 1.25 }
              ],
              abText: '용암 군주 · 갑주 25% · 화산의 포효 → 대분화' },
  /* ---------- 5.3 도전 '무스펠의 불꽃 거인' · '해와 달의 쌍왕' ---------- */
  surtr:    { name: '불꽃 거인 수르트', body: '#3a1a14', accent: '#ff6a1a', tunic: '#6a1a10', shape: 'surtr',
              hp: 58000, atk: 1250, range: 140, speed: 16, interval: 2.2, kb: 1, gold: 3600,
              area: true, areaRadius: 180, scale: 2.7, boss: true,
              ab: { kbImmune: true, armor: 0.2, lavaborn: true },
              special: { t: 'inferno', name: '무스펠의 불꽃 검', first: 12, cd: 18, wind: 4, ratio: 0.4, burn: { dps: 120, dur: 4 } },
              phases: [
                { at: 0.70, t: 'summon', name: '불도마뱀 떼', id: 'salamander', n: 5 },
                { at: 0.45, t: 'summon', name: '흑요석 근위대', id: 'obsidian', n: 2 },
                { at: 0.15, t: 'enrage', name: '라그나로크의 불', atk: 1.3, rate: 0.75, speed: 1.25 }
              ],
              abText: '불꽃 검을 치켜들면 4초 안에 기절시켜 끊어야 한다 · 못 끊으면 아군 모두 최대 체력 40% 피해 + 화상' },
  sunking:  { name: '해의 왕', body: '#e8b04a', accent: '#fff07a', tunic: '#c8601a', shape: 'sunking',
              hp: 40000, atk: 1100, range: 120, speed: 18, interval: 2.0, kb: 1, gold: 2600,
              area: true, areaRadius: 150, scale: 2.3, boss: true,
              ab: { kbImmune: true, armor: 0.15, burn: { dps: 100, dur: 4 }, twin: { partner: 'moonqueen', window: 10, revive: 0.6 } },
              special: { t: 'meteor', name: '태양 창', cd: 9, n: 4, dmg: 520, radius: 110, warn: 1.1, burn: { dps: 90, dur: 3 }, kind: 'lightning' },
              phases: [ { at: 0.15, t: 'enrage', name: '정오의 열기', atk: 1.25, rate: 0.75, speed: 1.2 } ],
              abText: '쌍왕 · 달의 여왕과 10초 안에 함께 쓰러뜨려야 한다 (아니면 먼저 쓰러진 쪽이 되살아난다)' },
  moonqueen:{ name: '달의 여왕', body: '#c8d8f0', accent: '#9ad8ff', tunic: '#2a2a6a', shape: 'moonqueen',
              hp: 34000, atk: 950, range: 270, speed: 16, interval: 2.2, kb: 1, gold: 2600, ranged: true,
              area: true, areaRadius: 140, scale: 2.2, boss: true,
              ab: { kbImmune: true, dodge: 0.1, twin: { partner: 'sunking', window: 10, revive: 0.6 } },
              special: { t: 'frost', name: '달빛 서리', first: 6, cd: 10, r: 320, dur: 3 },
              phases: [
                { at: 0.60, t: 'summon', name: '별의 시녀', id: 'wisp', n: 3 },
                { at: 0.15, t: 'enrage', name: '자정의 냉기', atk: 1.25, rate: 0.75, speed: 1.2 }
              ],
              abText: '쌍왕 · 해의 왕과 10초 안에 함께 쓰러뜨려야 한다 (아니면 먼저 쓰러진 쪽이 되살아난다)' },
  /* ---------- 4.15 도전 '파라오의 모래시계' ---------- */
  hourglass:{ name: '모래시계 토템', body: '#c8a050', accent: '#ffe08a', tunic: '#6a4a24', shape: 'hourglass',
              hp: 6000, atk: 0, range: 0, speed: 0, interval: 3, kb: 1, gold: 150, scale: 1.3, noReinf: true,
              ab: { hold: true, noAttack: true, kbImmune: true, armor: 0.2 },
              abText: '살아 있으면 모래시계가 뒤집힐 때마다 요새 회복 · 움직이지 않는다' },
  jackalgod:{ name: '심판의 아누비스', body: '#1c1c24', accent: '#ffd23a', tunic: '#2a5a8a', shape: 'jackalgod',
              hp: 52000, atk: 1100, range: 110, speed: 18, interval: 2.0, kb: 1, gold: 3400,
              area: true, areaRadius: 150, scale: 2.4, boss: true,
              ab: { kbImmune: true, armor: 0.15 },
              special: { t: 'meteor', name: '심판의 저울', first: 5, cd: 9, n: 4, dmg: 520, radius: 110, warn: 1.1, kind: 'lightning' },
              phases: [
                { at: 0.70, t: 'summon', name: '모래시계 재건', id: 'hourglass', n: 2 },
                { at: 0.45, t: 'summon', name: '미라 근위대', id: 'mummy', n: 6 },
                { at: 0.20, t: 'enrage', name: '최후의 심판', atk: 1.25, rate: 0.75, speed: 1.2 }
              ],
              abText: '심판의 신 · 갑주 15% · 넉백 면역 · 쓰러진 모래시계를 다시 세운다 · 심판의 저울' },
  /* ---------- 4.6 도전 '폭주 기관차' · '그림자 가면무도회' ---------- */
  irontrain:{ name: '폭주 기관차', body: '#3a3c44', accent: '#ff7a2a', tunic: '#8a2a2a', shape: 'irontrain',
              hp: 60000, atk: 420, range: 60, speed: 9, interval: 1, kb: 1, gold: 3000, scale: 2.1, boss: true,
              ab: { kbImmune: true, armor: 0.3, train: { first: 14, every: 16, warn: 2.6, dur: 2.6, mul: 3, ram: 0.5 },
                    summon: { id: 'coalstoker', n: 2 }, interval: 9 },
              abText: '멈추지 않는 기관차 · 성채에 닿으면 패배 · 둔화·기절로만 늦출 수 있다 · 경적 뒤 돌진' },
  coalstoker:{ name: '화부', body: '#4a3a32', accent: '#ff9a3a', tunic: '#2a2a2e', shape: 'coalstoker',
              hp: 2600, atk: 230, range: 62, speed: 58, interval: 1.0, kb: 2, gold: 50, noReinf: false,
              ab: { burn: { dps: 60, dur: 3 } }, abText: '석탄 삽 · 화상 60/초' },
  handcar:  { name: '수동차 포대', body: '#5a4a3a', accent: '#ffd23a', tunic: '#3a3a42', shape: 'handcar',
              hp: 2400, atk: 260, range: 320, speed: 40, interval: 2.6, kb: 1, gold: 80, ranged: true, noReinf: true,
              area: true, areaRadius: 95, scale: 1.15, abText: '레일 위의 대포 · 멀리서 범위 포격' },
  masklord: { name: '가면 군주', body: '#2a1a3a', accent: '#c06aff', tunic: '#5a1a4a', shape: 'masklord',
              hp: 46000, atk: 820, range: 260, speed: 16, interval: 2.2, kb: 1, gold: 3200, ranged: true,
              area: true, areaRadius: 140, scale: 2.0, boss: true,
              ab: { kbImmune: true, dodge: 0.1, mask: { first: 6, every: 13, seal: 13, n: 4, mul: 1 } },
              special: { t: 'meteor', name: '떨어지는 가면', cd: 11, n: 3, dmg: 440, radius: 110, warn: 1.2, kind: 'lightning' },
              phases: [
                { at: 0.65, t: 'summon', name: '무희 입장', id: 'dancer', n: 5 },
                { at: 0.40, t: 'summon', name: '광대 행렬', id: 'jester', n: 3 },
                { at: 0.15, t: 'enrage', name: '마지막 춤', atk: 1.3, rate: 0.7, speed: 1.3 }
              ],
              abText: '그림자 가면 · 가장 많이 낸 병종을 봉인하고 그 그림자를 보냅니다 · 고르게 섞어 내세요' },
  dancer:   { name: '가면 무희', body: '#e8d8f0', accent: '#ff5aa8', tunic: '#6a2a7a', shape: 'dancer',
              hp: 1700, atk: 210, range: 60, speed: 112, interval: .75, kb: 2, gold: 40, scale: .95,
              ab: { dodge: 0.4 }, abText: '춤추는 칼 · 40% 회피 · 아주 빠름' },
  jester:   { name: '광대 폭탄꾼', body: '#f0e0c8', accent: '#ffd23a', tunic: '#c8303a', shape: 'jester',
              hp: 2000, atk: 200, range: 240, speed: 30, interval: 2.0, kb: 1, gold: 60, ranged: true,
              area: true, areaRadius: 90, ab: { deathBomb: { dmg: 260, radius: 110 } }, abText: '폭죽 공 · 범위 공격 · 쓰러지며 터짐' },
  /* ---------- 3.2 이벤트 전장의 적: 타이밍을 맞춰야 잡히는 보스 다섯과 그 졸개들 ---------- */
  bloodthrall:{ name: '혈귀 노예', body: '#6b2a34', accent: '#e04b6a', tunic: '#3a1a22', shape: 'bloodthrall',
              hp: 2400, atk: 180, range: 64, speed: 46, interval: 1.1, kb: 1, gold: 60, noReinf: true,
              ab: { lifesteal: 0.35, revive: 0.4 }, abText: '흡혈 35% · 한 번 쓰러져도 피를 모아 다시 일어납니다' },
  stoneward:{ name: '바위 수호자', body: '#7a7468', accent: '#8fd8ff', tunic: '#5a554c', shape: 'stoneward',
              hp: 3000, atk: 60, range: 60, speed: 20, interval: 2, kb: 1, gold: 70, scale: 1.2, noReinf: true,
              ab: { barrier: 420, radius: 230, interval: 5, armor: 0.3, kbImmune: true },
              abText: '수호 · 5초마다 주변 적에게 보호막 · 갑주 30%' },
  rockling: { name: '바위 새끼', body: '#8a8578', accent: '#c8b88a', tunic: '#6a6558', shape: 'rockling',
              hp: 1900, atk: 150, range: 60, speed: 34, interval: 1.2, kb: 1, gold: 36, scale: .9,
              ab: { armor: 0.4, kbImmune: true }, abText: '돌 껍질 · 갑주 40% · 넉백 면역' },
  ghostsailor:{ name: '유령 선원', body: '#8fb8c0', accent: '#5de0d0', tunic: '#4a6a78', shape: 'ghostsailor',
              hp: 1250, atk: 210, range: 64, speed: 88, interval: .9, kb: 2, gold: 40,
              ab: { dodge: 0.3 }, abText: '흐릿한 몸 · 공격 30%를 흘려보냅니다' },
  ghostgunner:{ name: '유령 포수', body: '#7aa0aa', accent: '#ffb03c', tunic: '#3a5560', shape: 'ghostgunner',
              hp: 1500, atk: 330, range: 390, speed: 18, interval: 3.2, kb: 1, gold: 70, ranged: true, noReinf: true,
              area: true, areaRadius: 110, abText: '함포 · 멀리서 범위 포격' },
  voidspawn:{ name: '공허 새끼', body: '#2a2440', accent: '#b784e0', tunic: '#1c1830', shape: 'voidspawn',
              hp: 900, atk: 120, range: 60, speed: 62, interval: 1, kb: 2, gold: 18, scale: .85,
              ab: { deathBomb: { dmg: 260, radius: 110 } }, abText: '붕괴 · 쓰러지면 터집니다' },
  riftcaller:{ name: '균열 소환사', body: '#3a2a5a', accent: '#d8a8ff', tunic: '#241a3a', shape: 'riftcaller',
              hp: 2600, atk: 90, range: 240, speed: 22, interval: 2, kb: 1, gold: 80, ranged: true, noReinf: true,
              ab: { summon: { id: 'voidspawn', n: 1 }, interval: 6 }, abText: '균열 · 6초마다 공허 새끼를 불러냅니다' },
  imp:      { name: '화염 임프', body: '#a8382c', accent: '#ffd35a', tunic: '#6a1e18', shape: 'imp',
              hp: 760, atk: 150, range: 58, speed: 112, interval: .7, kb: 3, gold: 22, scale: .8,
              ab: { burn: { dps: 60, dur: 3 } }, abText: '불씨 · 화상을 남깁니다' },
  demonknight:{ name: '마계 기사', body: '#3a1a22', accent: '#ff5a3c', tunic: '#1c0e12', shape: 'demonknight',
              hp: 6400, atk: 430, range: 92, speed: 30, interval: 1.8, kb: 1, gold: 140, scale: 1.3, noReinf: true,
              ab: { armor: 0.3, kbImmune: true, weaken: { mul: 0.6, dur: 4 } }, abText: '저주받은 검 · 맞은 아군 공격력 -40% · 갑주 30%' },
  vampire:  { name: '흡혈 백작', body: '#2a1a2a', accent: '#e04b6a', tunic: '#5a0e1e', shape: 'vampire',
              hp: 20000, atk: 700, range: 110, speed: 26, interval: 1.8, kb: 1, gold: 700,
              scale: 1.6, boss: true,
              ab: { lifesteal: 0.3, summon: { id: 'bloodthrall', n: 1 }, interval: 9 },
              special: { t: 'veil', name: '안개화 · 안개 속에 병사를 내보내지 마세요', first: 10, cd: 14, dur: 4.5, r: 300, dmg: 160, ratio: 0.8, charm: 6 },
              phases: [
                { at: 0.70, t: 'summon', name: '밤의 권속', id: 'bat', n: 6 },
                { at: 0.40, t: 'swap', name: '핏빛 월식', atk: 1.15,
                            special: { t: 'veil', name: '안개화 · 안개 속에 병사를 내보내지 마세요', first: 3, cd: 10, dur: 5, r: 340, dmg: 200, ratio: 0.9, charm: 6 } },
                { at: 0.15, t: 'enrage', name: '피의 갈증', atk: 1.25, rate: 0.8 }
              ],
              abText: '안개화 · 주기적으로 안개가 되어 주변의 피를 빱니다. 안개 속에 내보낸 병사는 홀립니다' },
  titan:    { name: '대지 거신', body: '#6a6458', accent: '#ffb03c', tunic: '#4a453c', shape: 'titan',
              hp: 30000, atk: 900, range: 170, speed: 14, interval: 2.8, kb: 1, gold: 900,
              area: true, areaRadius: 160, scale: 2.2, boss: true,
              ab: { kbImmune: true, core: { armor: 0.5, mul: 2.2 } },
              special: { t: 'slam', name: '대지 분쇄', first: 9, cd: 15, dmg: 1100, radius: 220, warn: 2.4, stun: 1.2, expose: 6 },
              phases: [
                { at: 0.60, t: 'summon', name: '바위 떼', id: 'rockling', n: 3 },
                { at: 0.30, t: 'swap', name: '거신의 분노',
                            special: { t: 'slam', name: '대지 분쇄', first: 4, cd: 11, dmg: 1300, radius: 240, warn: 2.2, stun: 1.4, expose: 5 } }
              ],
              abText: '용암 핵 · 평소엔 피해 50% 감소, 대지 분쇄 뒤 6초간 핵이 드러나 2.2배 — 그때 액티브와 왕명을' },
  ghostcaptain:{ name: '유령 선장', body: '#6a8a96', accent: '#5de0d0', tunic: '#2a3a48', shape: 'ghostcaptain',
              hp: 24000, atk: 760, range: 150, speed: 22, interval: 2.0, kb: 1, gold: 800,
              area: true, areaRadius: 130, scale: 1.7, boss: true, ab: { dodge: 0.15 },
              special: { t: 'barrage', name: '일제 포격', first: 8, cd: 13, n: 5, gap: 80, radius: 85, dmg: 2000, warn: 2.0, kind: 'firestorm' },
              phases: [
                { at: 0.70, t: 'summon', name: '승선하라', id: 'ghostsailor', n: 4 },
                { at: 0.35, t: 'swap', name: '전 포문 개방',
                            special: { t: 'barrage', name: '일제 포격', first: 3, cd: 9, n: 6, gap: 75, radius: 85, dmg: 1000, warn: 1.8, kind: 'firestorm' } },
                { at: 0.15, t: 'enrage', name: '망령의 분노', atk: 1.2, rate: 0.8, speed: 1.3 }
              ],
              abText: '일제 포격 · 출진 지점을 예고 뒤 포격합니다 — 포탄이 떨어진 다음에 병사를 내보내세요' },
  voidlord: { name: '공허의 군주', body: '#241a3a', accent: '#b784e0', tunic: '#140e22', shape: 'voidlord',
              hp: 28000, atk: 820, range: 200, speed: 18, interval: 2.2, kb: 1, gold: 1000,
              area: true, areaRadius: 150, scale: 1.9, boss: true, ab: { kbImmune: true },
              special: { t: 'reflect', name: '공허 반사 · 액티브와 왕명을 참으세요', first: 8, cd: 13, dur: 4.5, ratio: 0.85 },
              phases: [
                { at: 0.66, t: 'summon', name: '공허의 틈', id: 'voidspawn', n: 5 },
                { at: 0.33, t: 'swap', name: '끝없는 공허',
                            special: { t: 'reflect', name: '공허 반사 · 액티브와 왕명을 참으세요', first: 3, cd: 9, dur: 5, ratio: 0.9 } },
                { at: 0.12, t: 'summon', name: '균열 확장', id: 'riftcaller', n: 2 }
              ],
              abText: '공허 반사 · 결계가 선 동안 받은 피해의 85%를 되돌리고, 곁에 쓴 액티브는 시전자에게, 왕명은 삼켜집니다' },
  demonking:{ name: '마왕', body: '#2a0e12', accent: '#ff3c3c', tunic: '#1a0608', shape: 'demonking',
              hp: 34000, atk: 1000, range: 190, speed: 18, interval: 2.4, kb: 1, gold: 1500,
              area: true, areaRadius: 170, scale: 2.3, boss: true,
              ab: { kbImmune: true, burn: { dps: 110, dur: 4 } },
              special: { t: 'barrage', name: '지옥불 포격', first: 8, cd: 12, n: 5, gap: 85, radius: 90, dmg: 1000, warn: 2.0,
                         burn: { dps: 90, dur: 4 }, kind: 'firestorm' },
              phases: [
                { at: 0.75, t: 'swap', name: '마왕의 결계',
                            special: { t: 'reflect', name: '마계 반사 · 액티브와 왕명을 참으세요', first: 3, cd: 11, dur: 4.5, ratio: 0.85 } },
                { at: 0.55, t: 'summon', name: '마계 근위대', id: 'demonknight', n: 2 },
                { at: 0.35, t: 'swap', name: '마왕 강림', core: { armor: 0.4, mul: 1.8 }, atk: 1.15,
                            special: { t: 'slam', name: '종말의 일격', first: 4, cd: 12, dmg: 1500, radius: 250, warn: 2.3, stun: 1.4, expose: 6 } },
                { at: 0.12, t: 'enrage', name: '마왕의 광기', atk: 1.25, rate: 0.8, speed: 1.2 }
              ],
              abText: '세 얼굴 · 출진 지점 포격 → 반사 결계 → 핵 노출. 페이즈마다 다른 타이밍을 요구합니다' },
};

/* -------------------- 전장 20개 -------------------- */
function W(t, e, n, gap) { return { t: t, e: e, n: n || 1, gap: gap || 1.2 }; }
function Wm(t, e, n, mul) { return { t: t, e: e, n: n || 1, gap: 1.2, mul: mul }; }   // 3.7: 이 적만 더 억세게

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
  {name:'★ 명계의 삼중 봉인',hint:'근접 벽 뒤에서 해골을 부르는 리치를 먼저 노리세요',baseHp:38000,money:420,rate:51,reward:1350,boss:true,enemyMul:3.2,waves:[
    W(2,'wraith',5,2),W(24,'lich',1),W(48,'spiderqueen',1),W(70,'plaguer',6,1.8),W(96,'troll',1),W(122,'lich',1),W(148,'orcshield',5,2),W(174,'spiderqueen',1),W(204,'wraith',8,1)]},
  {name:'눈보라 추격전',hint:'빠른 늑대 기수를 둔화로 저지',baseHp:39500,money:425,rate:52,reward:1250,enemyMul:2.29,waves:[
    W(2,'wolf',10,.8),W(24,'dark',5,2),W(48,'frostgiant',1),W(72,'wolf',10,.8),W(96,'orccatapult',2,5),W(120,'orcberserk',7,1.2),W(148,'frostgiant',1),W(180,'golem',2,5),W(208,'wolf',12,.7)]},
  {name:'얼어붙은 공성로',hint:'공성 병기를 막을 보호막 전열 필요',baseHp:41000,money:430,rate:53,reward:1320,enemyMul:2.46,waves:[
    W(2,'orcshield',4,2),W(22,'siegeram',2,5),W(46,'ballista',6,2),W(72,'frostgiant',1),W(100,'orcshield',6,1.8),W(126,'orccatapult',3,5),W(154,'warchief',2,5),W(184,'frostgiant',1),W(214,'dark',7,1.8)]},
  {name:'★ 영원의 겨울 왕좌',hint:'연속 광역 공격 뒤 왕명으로 회복',baseHp:44000,money:440,rate:54,reward:1600,boss:true,enemyMul:10.6,waves:[
    W(2,'wolf',8,1),W(24,'frostgiant',1),W(52,'troll',1),W(78,'orcshield',6,1.8),W(104,'frostgiant',1),W(136,'golem',2,5),W(164,'warchief',2,5),W(192,'frostgiant',1),W(224,'orcberserk',8,1)]},
  {name:'불타는 태양 회랑',hint:'화상을 정화하며 화룡을 견제',baseHp:45500,money:445,rate:55,reward:1500,enemyMul:6,waves:[
    W(2,'hellhound',9,.8),W(26,'powder',6,1.8),W(52,'drake',1),W(80,'plaguer',6,2),W(108,'orcshield',6,1.8),W(138,'drake',1),W(170,'hellhound',10,.8),W(200,'siegeram',2,4),W(230,'dark',7,1.5)]},
  {name:'황금 일식의 제단',hint:'치유·가속 토템을 범위 공격으로 압박',baseHp:47500,money:450,rate:56,reward:1650,boss:true,enemyMul:4.2,waves:[
    W(2,'orcshield',5,2),W(26,'totem',2,6),W(50,'shaman',5,3),W(78,'warlord',1),W(108,'golem',2,5),W(140,'drake',1),W(174,'warchief',3,5),W(208,'orcberserk',8,1),W(240,'lich',2,8)]},
  {name:'★ 세 신화의 종착지',hint:'원거리 호위를 먼저 걷어 내고, 대군주에게 액티브와 왕명을 집중하세요',baseHp:51000,money:465,rate:58,reward:2200,boss:true,enemyMul:10,bossMul:{hp:.65},waves:[
    W(2,'orcshield',5,2),W(26,'lich',1),W(52,'frostgiant',1),W(82,'drake',1),W(114,'warlord',1),W(148,'warchief',2,5),W(182,'spiderqueen',1),W(216,'golem',3,5),W(248,'warlord',1),W(276,'hellhound',10,.8)]}
);

/* 3막 '심연의 바다' (3.3): 신화의 끝 너머, 바다 밑에서 올라온 군단. 31~40전장. */
const ACT3_FROM = 30;
STAGES.push(
  {name:'난파선 해안',hint:'집게 게의 등딱지는 작살과 독으로',baseHp:53000,money:470,rate:60,reward:2300,enemyMul:18.0,waves:[
    W(2,'clawcrab',3,2),W(18,'nagaspear',5,1.2),W(38,'jelly',8,.7),W(60,'clawcrab',4,2),W(84,'nagaspear',6,1),W(110,'eel',6,.8),W(136,'clawcrab',5,1.8),W(162,'deepone',3,2.5),W(190,'nagaspear',8,.9)]},
  {name:'산호초 여울',hint:'빠른 장어 떼는 범위 공격과 둔화로',baseHp:55000,money:475,rate:61,reward:2400,enemyMul:15.0,waves:[
    W(2,'eel',8,.6),W(20,'jelly',8,.6),W(40,'nagaspear',6,1),W(64,'tidecaller',1),W(84,'eel',10,.5),W(110,'clawcrab',5,1.8),W(138,'deepone',4,2),W(166,'jelly',12,.5),W(196,'eel',12,.5)]},
  {name:'★ 크라켄의 만',hint:'촉수 예고를 피하고, 크라켄이 부르는 해파리를 범위로 걷어 내세요',baseHp:58000,money:480,rate:62,reward:2900,boss:true,enemyMul:20.0,waves:[
    W(2,'nagaspear',6,1),W(24,'kraken',1),W(46,'jelly',8,.6),W(70,'clawcrab',5,1.8),W(96,'eel',8,.6),W(124,'deepone',4,2),W(152,'nagaspear',8,.9),W(184,'clawcrab',6,1.6)]},
  {name:'안개 등대',hint:'세이렌의 노래 · 등대지기의 등불이 홀림을 풉니다',baseHp:60000,money:485,rate:62,reward:2700,enemyMul:29.0,waves:[
    W(2,'nagaspear',6,1),W(20,'siren',2,3),W(40,'deepone',4,2),W(62,'siren',3,2.5),W(86,'clawcrab',5,1.8),W(112,'seahook',2,4),W(138,'nagaspear',8,.9),W(166,'siren',3,2.5),W(194,'deepone',5,1.8)]},
  {name:'세이렌의 암초',hint:'노래하는 세이렌을 매 조련사와 원거리로 먼저',baseHp:62000,money:490,rate:63,reward:2800,enemyMul:27.0,waves:[
    W(2,'siren',3,2),W(22,'nagaspear',8,.9),W(44,'seahook',2,4),W(66,'siren',4,2),W(90,'eel',10,.5),W(116,'tidecaller',2,5),W(142,'deepone',5,1.8),W(170,'siren',4,2),W(200,'clawcrab',6,1.6)]},
  {name:'★ 해일 여왕의 신전',hint:'해일에 밀려도 닻 수호병은 버팁니다 · 여왕이 부르는 나가를 걷어 내세요',baseHp:65000,money:500,rate:64,reward:3200,boss:true,enemyMul:14.0,waves:[
    W(2,'nagaspear',8,.9),W(26,'tidequeen',1),W(50,'siren',3,2.5),W(76,'clawcrab',6,1.6),W(104,'tidecaller',2,5),W(132,'deepone',5,1.8),W(162,'nagaspear',10,.8),W(194,'eel',12,.5)]},
  {name:'침몰한 도시',hint:'단단한 무리 · 파쇄와 범위로',baseHp:66000,money:505,rate:64,reward:3000,enemyMul:38.0,waves:[
    W(2,'clawcrab',6,1.6),W(24,'deepone',5,1.8),W(48,'jelly',12,.5),W(72,'seahook',3,3),W(98,'clawcrab',8,1.4),W(126,'golem',2,5),W(154,'deepone',6,1.6),W(184,'nagaspear',10,.8),W(214,'clawcrab',8,1.4)]},
  {name:'폭풍 해협',hint:'질주하는 장어와 영웅 사냥꾼 · 값싼 벽과 범위로',baseHp:68000,money:510,rate:65,reward:3100,enemyMul:16.0,waves:[
    W(2,'eel',12,.5),W(22,'nagaspear',8,.9),W(46,'tidecaller',2,4),W(70,'eel',14,.4),W(96,'siren',4,2),W(122,'hellhound',8,.7),W(150,'nagaspear',10,.8),W(180,'eel',16,.4),W(210,'deepone',6,1.6)]},
  {name:'심연의 문',hint:'모든 바다 군단 · 등불과 파쇄를 함께',baseHp:70000,money:515,rate:66,reward:3300,enemyMul:20.0,waves:[
    W(2,'clawcrab',6,1.6),W(24,'siren',4,2),W(48,'deepone',6,1.6),W(74,'seahook',3,3),W(100,'tidecaller',2,4),W(126,'eel',14,.4),W(154,'clawcrab',8,1.4),W(184,'siren',5,1.8),W(214,'deepone',8,1.4),W(244,'nagaspear',12,.7)]},
  {name:'★ 리바이어던의 심연',hint:'해일 낙하 예고를 피하고, 심연이 열리면 왕명으로 버티세요',baseHp:76000,money:530,rate:68,reward:4200,boss:true,enemyMul:20.0,waves:[
    W(2,'nagaspear',8,.9),W(26,'leviathan',1),W(52,'siren',4,2),W(80,'clawcrab',8,1.4),W(110,'deepone',6,1.6),W(140,'tidecaller',3,4),W(170,'eel',16,.4),W(200,'seahook',3,3),W(230,'nagaspear',12,.7),W(262,'clawcrab',10,1.2)]}
);


/* 4막 '천공 요새' (4.0): 심연 너머 하늘에 떠오른 성채. 41~50전장. */
const ACT4_FROM = 40;
STAGES.push(
  {name:'구름 다리',hint:'날쌘 하피 떼는 범위 공격과 둔화로',baseHp:80000,money:540,rate:68,reward:3400,enemyMul:22.0,waves:[
    W(12,'harpy',6,.7),W(20,'griffinrider',2,2.5),W(40,'stormwisp',2,2.5),W(62,'harpy',8,.6),W(86,'griffinrider',3,2.2),W(112,'stormwisp',3,2),W(138,'harpy',10,.5),W(166,'cloudgiant',1),W(194,'griffinrider',4,1.8)]},
  {name:'바람의 절벽',hint:'바람 주술사의 돌풍 · 넉백 면역 방패로 버티세요',baseHp:82000,money:545,rate:69,reward:3500,enemyMul:20.0,waves:[
    W(12,'griffinrider',3,2),W(22,'windcaller',1),W(40,'harpy',8,.6),W(64,'stormwisp',3,2),W(88,'windcaller',2,4),W(114,'cloudgiant',2,4),W(142,'harpy',10,.5),W(170,'griffinrider',4,1.8),W(200,'stormwisp',4,1.8)]},
  {name:'★ 폭풍 그리폰의 둥지',hint:'번개 강하 예고를 피하고, 그리폰 왕이 부르는 하피를 범위로',baseHp:85000,money:550,rate:70,reward:4000,boss:true,enemyMul:21.0,waves:[
    W(12,'harpy',6,.7),W(24,'stormgriffin',1),W(48,'stormwisp',3,2),W(74,'griffinrider',4,1.8),W(102,'harpy',10,.5),W(130,'cloudgiant',2,4),W(160,'windcaller',2,4),W(190,'griffinrider',5,1.6)]},
  {name:'천공 포대',hint:'멀리서 쏘는 포대 · 저격수와 매 조련사로 먼저 걷어 내세요',baseHp:86000,money:555,rate:70,reward:3700,enemyMul:28.0,waves:[
    W(12,'griffinrider',3,2),W(18,'skycannon',2,3),W(40,'harpy',8,.6),W(64,'skycannon',2,3),W(90,'cloudgiant',2,4),W(116,'stormwisp',4,1.8),W(142,'skycannon',2,3),W(170,'harpy',12,.5),W(200,'griffinrider',5,1.6)]},
  {name:'번개 첨탑',hint:'연쇄 번개는 흩어 세워 받으세요 · 정령을 원거리로 먼저',baseHp:88000,money:560,rate:71,reward:3800,enemyMul:26.0,waves:[
    W(12,'stormwisp',3,2),W(22,'harpy',8,.6),W(44,'windcaller',2,4),W(68,'stormwisp',5,1.6),W(94,'griffinrider',4,1.8),W(120,'cloudgiant',2,4),W(148,'stormwisp',5,1.6),W(176,'harpy',12,.5),W(206,'skycannon',3,2.5)]},
  {name:'★ 구름 왕의 옥좌',hint:'구름 거인의 재생은 화상으로 끊고, 구름 장막엔 왕명으로 버티세요',baseHp:90000,money:570,rate:72,reward:4400,boss:true,enemyMul:18.0,waves:[
    W(12,'cloudgiant',2,4),W(26,'cloudking',1),W(50,'stormwisp',3,2),W(76,'harpy',10,.5),W(104,'windcaller',2,4),W(132,'griffinrider',5,1.6),W(162,'cloudgiant',3,3),W(194,'harpy',12,.5)]},
  {name:'하늘 정원',hint:'단단한 거인 무리 · 파쇄와 화상으로',baseHp:92000,money:575,rate:72,reward:4000,enemyMul:32.0,waves:[
    W(12,'cloudgiant',3,3),W(26,'harpy',10,.5),W(50,'skycannon',3,2.5),W(76,'cloudgiant',4,2.5),W(104,'stormwisp',5,1.6),W(132,'golem',2,5),W(160,'griffinrider',6,1.4),W(190,'cloudgiant',4,2.5),W(220,'harpy',14,.4)]},
  {name:'폭풍의 눈',hint:'질주하는 하피와 그리폰 · 값싼 벽과 범위로',baseHp:94000,money:580,rate:73,reward:4100,enemyMul:20.0,waves:[
    W(12,'harpy',14,.4),W(22,'griffinrider',5,1.6),W(46,'windcaller',2,4),W(70,'harpy',16,.4),W(96,'stormwisp',5,1.6),W(122,'hellhound',8,.7),W(150,'griffinrider',6,1.4),W(180,'harpy',18,.35),W(210,'cloudgiant',3,3)]},
  {name:'천공 성채의 문',hint:'모든 천공 군단 · 둔화와 파쇄를 함께',baseHp:96000,money:590,rate:74,reward:4300,enemyMul:22.0,waves:[
    W(12,'griffinrider',5,1.6),W(24,'skycannon',3,2.5),W(48,'cloudgiant',3,3),W(74,'windcaller',2,4),W(100,'stormwisp',5,1.6),W(126,'harpy',16,.4),W(154,'griffinrider',6,1.4),W(184,'skycannon',4,2),W(214,'cloudgiant',4,2.5),W(244,'harpy',18,.35)]},
  {name:'★ 천공의 군주',hint:'천벌 예고를 피하고, 폭풍이 열리면 왕명과 필살을 몰아 쓰세요',baseHp:100000,money:600,rate:76,reward:5500,boss:true,enemyMul:21.0,waves:[
    W(12,'griffinrider',5,1.6),W(26,'skylord',1),W(52,'stormwisp',5,1.6),W(80,'cloudgiant',3,3),W(110,'skycannon',3,2.5),W(140,'windcaller',3,4),W(170,'harpy',18,.35),W(200,'griffinrider',6,1.4),W(230,'cloudgiant',4,2.5),W(262,'stormwisp',6,1.4)]}
);

/* 5막 '잊힌 밀림' (4.6): 하늘 성채가 무너진 뒤 떨어진 남쪽 밀림 — 비늘과 뿔의 군단, 잊힌 신전. 51~60전장.
 * 4막보다 한 단계 억세다: 적 배율이 높고, 처음부터 특성이 붙은 전장이 섞인다. */
const ACT5_FROM = 50;
STAGES.push(
  {name:'덩굴 오솔길',hint:'날쌘 랩터는 넉백 면역 방패와 범위로 · 원거리는 전열 뒤에',baseHp:104000,money:610,rate:77,reward:4600,enemyMul:19.5,waves:[
    W(12,'lizardman',5,1),W(22,'raptor',6,.6),W(44,'poisontoad',2,2.5),W(66,'lizardman',7,.9),W(90,'raptor',8,.5),W(116,'vineshaman',1),W(140,'lizardman',8,.8),W(168,'raptor',10,.45),W(198,'poisontoad',3,2.2)]},
  {name:'독안개 늪',hint:'독두꺼비의 범위 중독 · 정화사로 풀고 저격으로 먼저',baseHp:106000,money:615,rate:78,reward:4700,enemyMul:19.5,mods:['curse'],waves:[
    W(12,'poisontoad',3,2.2),W(22,'lizardman',6,.9),W(44,'vineshaman',1),W(64,'poisontoad',4,2),W(88,'raptor',8,.5),W(112,'lizardman',8,.8),W(138,'poisontoad',5,1.8),W(166,'vineshaman',2,4),W(196,'raptor',12,.4)]},
  {name:'★ 랩터 여왕의 둥지',hint:'사냥 무리는 범위 공격으로 한꺼번에 · 포효엔 기절 면역으로',baseHp:110000,money:625,rate:79,reward:5200,boss:true,enemyMul:18.0,waves:[
    W(12,'raptor',8,.5),W(24,'raptorqueen',1),W(48,'lizardman',6,.9),W(74,'poisontoad',3,2.2),W(100,'raptor',12,.4),W(128,'vineshaman',2,4),W(156,'lizardman',8,.8),W(186,'raptor',14,.35)]},
  {name:'잊힌 신전의 계단',hint:'석상 수호자는 반사 · 원거리와 파쇄로 깎으세요',baseHp:112000,money:630,rate:80,reward:4900,enemyMul:18.5,waves:[
    W(12,'lizardman',6,.9),W(20,'stoneidol',1),W(42,'poisontoad',3,2.2),W(66,'stoneidol',2,4),W(92,'raptor',10,.45),W(118,'vineshaman',2,4),W(146,'stoneidol',2,4),W(176,'lizardman',10,.7),W(206,'poisontoad',4,2)]},
  {name:'뿔 공룡 평원',hint:'뿔 돌진의 첫 일격 · 값싼 벽을 앞에 두고 화상과 파쇄로',baseHp:114000,money:635,rate:81,reward:5000,enemyMul:24.0,mods:['ironclad'],waves:[
    W(12,'raptor',8,.5),W(22,'triceratops',1),W(46,'lizardman',8,.8),W(72,'triceratops',2,4),W(98,'poisontoad',4,2),W(124,'raptor',12,.4),W(150,'triceratops',2,4),W(178,'vineshaman',2,4),W(208,'lizardman',10,.7)]},
  {name:'★ 깃털 뱀의 제단',hint:'태양 깃털 예고를 피하고, 일식이 오면 왕명으로 버티세요',baseHp:118000,money:645,rate:82,reward:5600,boss:true,enemyMul:19.0,waves:[
    W(12,'lizardman',6,.9),W(26,'quetzal',1),W(50,'poisontoad',4,2),W(76,'raptor',12,.4),W(104,'stoneidol',2,4),W(132,'vineshaman',2,4),W(162,'lizardman',10,.7),W(194,'triceratops',2,4)]},
  {name:'안개 폭포',hint:'몰려오는 랩터와 주술사의 치유 · 주술사를 먼저 끊으세요',baseHp:120000,money:650,rate:83,reward:5300,enemyMul:18.5,mods:['blitz'],waves:[
    W(12,'raptor',12,.4),W(22,'vineshaman',2,3),W(44,'lizardman',8,.8),W(68,'raptor',14,.35),W(94,'poisontoad',4,2),W(120,'vineshaman',2,4),W(146,'raptor',16,.35),W(174,'stoneidol',2,4),W(204,'lizardman',12,.6)]},
  {name:'화산 정글',hint:'단단한 무리 · 화상과 파쇄를 함께',baseHp:122000,money:655,rate:84,reward:5400,enemyMul:28.0,waves:[
    W(12,'stoneidol',2,4),W(22,'triceratops',2,4),W(46,'poisontoad',4,2),W(72,'lizardman',10,.7),W(98,'triceratops',2,4),W(124,'stoneidol',3,3),W(152,'raptor',14,.35),W(180,'triceratops',3,3),W(210,'vineshaman',3,3)]},
  {name:'신전의 심장',hint:'밀림의 모든 군단 · 둔화와 범위, 파쇄를 함께',baseHp:126000,money:665,rate:85,reward:5700,enemyMul:22.0,mods:['horde','curse'],waves:[
    W(12,'lizardman',8,.8),W(22,'poisontoad',3,2.2),W(44,'raptor',12,.4),W(68,'stoneidol',2,4),W(92,'vineshaman',2,4),W(118,'triceratops',2,4),W(144,'raptor',16,.35),W(172,'poisontoad',5,1.8),W(202,'lizardman',12,.6),W(232,'triceratops',3,3)]},
  {name:'★ 밀림의 폭군',hint:'화산이 터지면 바위 예고를 피하고, 폭군의 포효엔 왕명과 필살을 몰아 쓰세요',baseHp:132000,money:680,rate:87,reward:7000,boss:true,enemyMul:17.0,waves:[
    W(12,'triceratops',2,4),W(26,'jungletyrant',1),W(52,'raptor',12,.4),W(80,'stoneidol',3,3),W(110,'poisontoad',5,1.8),W(140,'vineshaman',3,3),W(170,'lizardman',12,.6),W(200,'triceratops',3,3),W(232,'raptor',16,.35),W(262,'stoneidol',3,3)]}
);

/* 6막 '홀린 요정 숲' (4.11): 밀림 너머 안개 속 요정의 숲 — 요정 · 버섯 · 나무 정령의 군단. 61~70전장.
 * 5막보다 또 한 단계: 멀리서만 쏘면 홀림불이 안 보이고, 버섯은 쓰러지며 독을 뿌리고, 나무 정령은 화상 없이는 다시 자란다. */
const ACT6_FROM = 60;
STAGES.push(
  {name:'요정 고리 숲길',hint:'날쌘 요정 떼는 범위 공격으로 · 홀림불은 가까이 가야 보입니다',baseHp:307000,money:690,rate:88,reward:7200,enemyMul:35.2,waves:[
    W(12,'pixie',6,.5),W(22,'sporecap',4,1.2),W(44,'wisp',2,2.5),W(66,'pixie',10,.4),W(90,'sporecap',6,1),W(116,'satyr',1),W(140,'wisp',3,2.2),W(168,'pixie',12,.35),W(198,'sporecap',7,.9)]},
  {name:'독버섯 골짜기',hint:'버섯은 쓰러지며 포자를 터뜨립니다 · 정화사를 데려가고 앞줄을 자주 갈아 주세요',baseHp:515000,money:695,rate:89,reward:7400,enemyMul:57,mods:['horde'],waves:[
    W(12,'sporecap',5,1.1),W(22,'pixie',8,.45),W(44,'satyr',1),W(64,'sporecap',6,1),W(88,'wisp',3,2.2),W(112,'pixie',10,.4),W(138,'sporecap',8,.9),W(166,'satyr',2,4),W(196,'sporecap',8,.8)]},
  {name:'★ 버섯 왕의 궁정',hint:'포자 폭탄 예고를 피하고, 중독은 정화로 · 버섯 무리는 범위로 한꺼번에',baseHp:180000,money:705,rate:90,reward:8000,boss:true,enemyMul:19,waves:[
    W(12,'sporecap',6,1),W(24,'mushking',1),W(48,'pixie',10,.4),W(74,'wisp',3,2.2),W(100,'sporecap',8,.9),W(128,'satyr',2,4),W(156,'pixie',12,.35),W(186,'sporecap',10,.8)]},
  {name:'홀림불 늪',hint:'홀림불은 멀리서 못 쏩니다 · 튼튼한 근접 전열을 앞세우고 범위로 태우세요',baseHp:299000,money:710,rate:91,reward:7700,enemyMul:26.5,waves:[
    W(12,'wisp',3,2),W(20,'sporecap',5,1.1),W(42,'wisp',4,1.8),W(66,'pixie',10,.4),W(92,'wisp',5,1.6),W(118,'satyr',2,4),W(146,'sporecap',8,.9),W(176,'wisp',6,1.4),W(206,'pixie',12,.35)]},
  {name:'고목의 회랑',hint:'나무 정령은 화상이 붙으면 다시 자라지 못합니다 · 화상과 파쇄로',baseHp:339000,money:720,rate:92,reward:7900,enemyMul:29.5,mods:['ironclad'],waves:[
    W(12,'sporecap',6,1),W(22,'treant',1),W(46,'wisp',3,2.2),W(72,'treant',2,4),W(98,'pixie',10,.4),W(124,'satyr',2,4),W(150,'treant',2,4),W(178,'sporecap',8,.9),W(208,'wisp',4,1.8)]},
  {name:'★ 달빛 요정 궁',hint:'꽃덩굴에 묶이면 둔화 · 달빛 화살 예고를 피하고 왕명으로 버티세요',baseHp:194000,money:730,rate:93,reward:8600,boss:true,enemyMul:14,waves:[
    W(12,'pixie',10,.4),W(26,'faequeen',1),W(50,'wisp',4,1.8),W(76,'sporecap',8,.9),W(104,'treant',2,4),W(132,'satyr',2,4),W(162,'pixie',14,.35),W(194,'unicorn',2,3)]},
  {name:'사티로스의 잔치',hint:'피리 소리가 적을 북돋웁니다 · 피리꾼을 먼저, 저주된 아군은 잠시 뒤로',baseHp:590000,money:740,rate:94,reward:8200,enemyMul:59,waves:[
    W(12,'satyr',2,3),W(22,'sporecap',6,1),W(44,'unicorn',2,3),W(68,'satyr',3,2.5),W(94,'pixie',12,.35),W(120,'unicorn',2,3),W(146,'wisp',4,1.8),W(174,'satyr',3,2.5),W(204,'sporecap',10,.8)]},
  {name:'일각수 초원',hint:'일각수의 돌격 첫 일격 · 넉백 면역 방패를 앞에 두고 치유하는 기사를 먼저',baseHp:328000,money:745,rate:95,reward:8400,enemyMul:37.4,mods:['blitz'],waves:[
    W(12,'pixie',8,.45),W(26,'unicorn',2,3),W(44,'unicorn',3,2.5),W(68,'wisp',4,1.8),W(94,'sporecap',8,.9),W(120,'unicorn',3,2.5),W(146,'satyr',2,4),W(174,'treant',2,4),W(204,'unicorn',4,2)]},
  {name:'숲의 심장부',hint:'요정 숲의 모든 군단 · 정화 · 화상 · 범위를 함께',baseHp:246000,money:755,rate:96,reward:8800,enemyMul:37,mods:['horde','curse'],waves:[
    W(12,'sporecap',8,.9),W(22,'wisp',3,2.2),W(44,'pixie',12,.35),W(68,'treant',2,4),W(92,'satyr',2,4),W(118,'unicorn',3,2.5),W(144,'pixie',14,.35),W(172,'sporecap',10,.8),W(202,'wisp',5,1.6),W(232,'treant',3,3)]},
  {name:'★ 고목왕',hint:'고목왕은 화상 없이는 계속 자랍니다 · 열매 예고를 피하고, 뿌리가 흔들리면 왕명과 필살을',baseHp:215000,money:770,rate:98,reward:9800,boss:true,enemyMul:23.5,waves:[
    W(12,'treant',2,4),W(26,'eldertree',1),W(52,'pixie',12,.35),W(80,'sporecap',8,.9),W(110,'wisp',5,1.6),W(140,'satyr',3,3),W(170,'unicorn',3,2.5),W(200,'treant',3,3),W(232,'pixie',16,.3),W(262,'sporecap',10,.8)]}
);

/* 7막 '모래폭풍 사막' (4.15): 요정 숲 너머 끝없는 모래바다 — 전갈 · 미라 · 모래벌레, 잊힌 파라오의 군단. 71~80전장.
 * 새 기믹 '모래폭풍': storm.every 초마다 storm.dur 초 동안 모래가 불어 원거리 사거리가 storm.range 배가 된다 (양쪽 모두). */
const ACT7_FROM = 70;
const SANDSTORM = { first: 18, every: 24, dur: 8, range: 0.55 };
STAGES.push(
  {name:'뜨거운 모래언덕',hint:'모래폭풍이 불면 원거리가 짧아집니다 · 튼튼한 근접 전열을 앞세우세요',baseHp:300000,money:790,rate:100,reward:10000,enemyMul:30,waves:[
    W(12,'scarab',5,.6),W(22,'scorpion',3,1.4),W(44,'dunerider',3,1.6),W(66,'scarab',7,.5),W(90,'mummy',5,1),W(116,'sandmage',1),W(140,'scorpion',5,1.1),W(168,'scarab',9,.45),W(198,'dunerider',4,1.4)]},
  {name:'미라의 골짜기',hint:'미라는 한 번 더 일어납니다 · 범위 공격으로 두 번 쓰러뜨리세요',baseHp:320000,money:795,rate:101,reward:10300,enemyMul:25,mods:['curse'],waves:[
    W(12,'mummy',5,1),W(22,'scarab',6,.5),W(44,'sandmage',1),W(64,'mummy',6,.9),W(88,'scorpion',4,1.2),W(112,'mummy',7,.8),W(138,'dunerider',4,1.4),W(166,'sandmage',2,4),W(196,'mummy',8,.7)]},
  {name:'★ 전갈 왕의 둥지',hint:'독침 비 예고를 피하고 중독은 정화로 · 전갈 떼는 파쇄와 범위로',baseHp:240000,money:805,rate:102,reward:11000,boss:true,enemyMul:20,waves:[
    W(12,'scorpion',4,1.2),W(24,'scorpking',1),W(48,'scarab',7,.5),W(74,'dunerider',3,1.6),W(100,'scorpion',5,1.1),W(128,'sandmage',2,4),W(156,'scarab',9,.45),W(186,'scorpion',6,1)]},
  {name:'모래벌레의 사구',hint:'모래벌레는 땅속으로 다가와 솟구칩니다 · 전열 뒤를 비우지 마세요',baseHp:330000,money:810,rate:103,reward:10600,enemyMul:23,waves:[
    W(12,'scarab',6,.5),W(20,'sandworm',1),W(42,'dunerider',3,1.6),W(66,'sandworm',2,4),W(92,'scorpion',4,1.2),W(118,'sandmage',2,4),W(146,'sandworm',2,4),W(176,'mummy',7,.8),W(206,'scarab',9,.45)]},
  {name:'신기루 오아시스',hint:'약탈자는 빠르게 달려와 쏩니다 · 넉백 면역 방패와 저격으로',baseHp:340000,money:815,rate:104,reward:10800,enemyMul:21,mods:['blitz'],waves:[
    W(12,'dunerider',3,1.4),W(22,'scarab',7,.5),W(44,'dunerider',4,1.3),W(68,'sandmage',2,3),W(94,'scorpion',5,1.1),W(120,'dunerider',5,1.2),W(146,'mummy',6,.9),W(174,'dunerider',5,1.2),W(204,'scarab',10,.4)]},
  {name:'★ 스핑크스의 문',hint:'수수께끼의 모래에 묶이면 둔화 · 태양 광선 예고를 피하고 왕명으로 버티세요',baseHp:250000,money:825,rate:105,reward:11800,boss:true,enemyMul:18,waves:[
    W(12,'mummy',5,1),W(26,'sphinx',1),W(50,'dunerider',4,1.4),W(76,'scorpion',5,1.1),W(104,'sandmage',2,4),W(132,'mummy',7,.8),W(162,'scarab',10,.4),W(194,'sandworm',2,4)]},
  {name:'왕가의 계곡',hint:'미라와 술사의 진군 · 술사를 먼저 끊으세요',baseHp:350000,money:830,rate:106,reward:11200,enemyMul:26,mods:['giantslayer'],waves:[
    W(12,'mummy',4,1.1),W(24,'sandmage',2,3),W(44,'scorpion',4,1.2),W(68,'sandmage',3,2.5),W(94,'mummy',8,.7),W(120,'dunerider',4,1.4),W(146,'sandmage',3,2.5),W(174,'mummy',8,.7),W(204,'scorpion',6,1)]},
  {name:'유리 사막',hint:'단단한 무리 · 화상과 파쇄를 함께',opening:'calm',baseHp:360000,money:835,rate:107,reward:11400,enemyMul:22,mods:['ironclad'],waves:[
    W(12,'scorpion',5,1.1),W(22,'sandworm',1),W(46,'scorpion',5,1.1),W(72,'mummy',7,.8),W(98,'sandworm',2,4),W(124,'scorpion',6,1),W(152,'sandmage',2,4),W(180,'sandworm',2,4),W(210,'dunerider',5,1.2)]},
  {name:'모래폭풍의 눈',hint:'사막의 모든 군단 · 근접 전열 · 정화 · 범위를 함께',baseHp:340000,money:845,rate:108,reward:11800,enemyMul:38,mods:['horde','curse'],waves:[
    W(12,'scarab',8,.45),W(22,'mummy',5,1),W(44,'dunerider',4,1.4),W(68,'sandworm',2,4),W(92,'sandmage',2,4),W(118,'scorpion',5,1.1),W(144,'scarab',10,.4),W(172,'mummy',8,.7),W(202,'dunerider',5,1.2),W(232,'sandworm',2,4)]},
  {name:'★ 모래폭풍의 파라오',hint:'파라오는 한 번 다시 일어납니다 · 사암 예고를 피하고, 포효엔 왕명과 필살을',baseHp:280000,money:860,rate:110,reward:13000,boss:true,enemyMul:15,waves:[
    W(12,'scorpion',4,1.2),W(26,'sandpharaoh',1),W(52,'scarab',9,.45),W(80,'sandworm',2,4),W(110,'mummy',7,.8),W(140,'sandmage',3,3),W(170,'dunerider',5,1.2),W(200,'scorpion',6,1),W(232,'scarab',12,.4),W(262,'sandworm',3,3)]}
);
STAGES.slice(ACT7_FROM).forEach(st => { st.storm = SANDSTORM; });

/* 9막 '불의 산맥' (5.3): 사막 너머 하늘을 가린 화산 지대 — 용암 군단 (불도마뱀 · 용암 덩이 · 흑요석 거인 · 잿빛 주술사 · 불티 박쥐 · 용암 투석병). 81~90전장.
 * 새 기믹 '분화': first 초부터 every 초마다 병사가 선 자리 몇 곳이 붉게 갈라지고, warn 초 뒤 용암이 솟아 최대 체력 ratio 만큼 친다 (양쪽 모두).
 * 용암 군단(lavaborn)은 분화에 다치지 않고 화상은 반만 듣지만, 둔화된 동안 받는 피해가 +25% — 서리 · 둔화 편성이 열쇠.
 * 5.3 부터 난이도는 새 전장으로만 올린다: 8막을 다 넘은 만렙 편성에게도 버거운 곳. */
const ACT8_FROM = 80;
const VOLCANO = { first: 16, every: 21, n: 3, warn: 1.6, r: 85, ratio: 0.16, bossRatio: 0.03, burn: { dps: 60, dur: 3 } };
STAGES.push(
  {name:'잿빛 산기슭',hint:'붉게 갈라진 땅에서 용암이 솟습니다 · 용암 군단은 멀쩡하고 우리만 다칩니다 — 치유와 서리를 챙기세요',baseHp:380000,money:870,rate:112,reward:13500,enemyMul:19,waves:[
    W(12,'salamander',4,1.2),W(22,'magmaling',6,.5),W(44,'cinderbat',6,.5),W(66,'salamander',5,1.1),W(90,'ashcaster',2,3),W(116,'magmaling',8,.45),W(140,'salamander',6,1),W(168,'cinderbat',8,.45),W(198,'ashcaster',2,3)]},
  {name:'용암 강',hint:'용암 덩이는 쓰러지며 터집니다 · 원거리로 멀리서 녹이세요',baseHp:395000,money:875,rate:113,reward:13800,enemyMul:63,mods:['blitz'],waves:[
    W(12,'magmaling',8,.45),W(22,'salamander',4,1.2),W(44,'magmaling',10,.4),W(68,'cinderbat',8,.45),W(94,'salamander',6,1),W(120,'magmaling',12,.35),W(146,'ashcaster',2,3),W(174,'salamander',7,.9),W(204,'magmaling',14,.35)]},
  {name:'★ 용암 거룡의 둥지',hint:'용암 비 예고를 피하고, 거룡의 꼬리치기엔 넉백 면역 방패로 버티세요 · 둔화하면 더 아프게 맞습니다',baseHp:280000,money:885,rate:114,reward:14500,boss:true,enemyMul:33,waves:[
    W(12,'salamander',4,1.2),W(24,'lavawyrm',1),W(48,'magmaling',8,.45),W(74,'ashcaster',2,3),W(100,'salamander',6,1),W(128,'cinderbat',8,.45),W(156,'magmaling',10,.4),W(186,'salamander',7,.9)]},
  {name:'흑요석 협곡',hint:'흑요석 거인은 단단하고 때린 근접에게 되돌려 줍니다 · 파쇄와 서리로',opening:'calm',baseHp:410000,money:890,rate:115,reward:14200,enemyMul:27.5,mods:['ironclad'],waves:[
    W(12,'salamander',5,1.1),W(22,'obsidian',1),W(46,'magmaling',8,.45),W(72,'obsidian',2,4),W(98,'ashcaster',2,3),W(124,'salamander',6,1),W(150,'obsidian',2,4),W(178,'magmacannon',2,3),W(208,'salamander',7,.9)]},
  {name:'불티 동굴',hint:'불티 박쥐 떼가 몰려옵니다 · 범위 공격으로 한꺼번에',baseHp:400000,money:895,rate:116,reward:14400,enemyMul:165,mods:['horde'],waves:[
    W(12,'cinderbat',8,.4),W(22,'magmaling',6,.5),W(44,'cinderbat',10,.35),W(68,'salamander',5,1.1),W(94,'cinderbat',12,.3),W(120,'ashcaster',2,3),W(146,'cinderbat',14,.3),W(174,'magmaling',10,.4),W(204,'cinderbat',16,.3)]},
  {name:'★ 불사조의 둥지',hint:'불사조는 재에서 한 번 다시 날아오릅니다 · 깃털 예고를 피하고 두 번째 날개짓에 필살을 아끼세요',baseHp:290000,money:905,rate:117,reward:15200,boss:true,enemyMul:33,waves:[
    W(12,'cinderbat',8,.4),W(26,'phoenix',1),W(50,'salamander',5,1.1),W(76,'magmaling',8,.45),W(104,'ashcaster',2,3),W(132,'cinderbat',10,.35),W(162,'salamander',7,.9),W(194,'magmacannon',2,3)]},
  {name:'신들의 화로',hint:'용암 투석병과 주술사가 멀리서 쏩니다 · 값싼 병력으로 밀고 들어가 뒷줄을 끊으세요',baseHp:420000,money:910,rate:118,reward:14800,enemyMul:14,mods:['giantslayer'],waves:[
    W(12,'salamander',4,1.2),W(24,'magmacannon',2,3),W(44,'ashcaster',2,3),W(68,'magmacannon',3,2.5),W(94,'salamander',7,.9),W(120,'ashcaster',3,2.5),W(146,'magmacannon',3,2.5),W(174,'magmaling',10,.4),W(204,'salamander',8,.8)]},
  {name:'끓는 호수',hint:'김이 오르는 호숫가 · 소환과 치유가 약해집니다 — 진짜 병력으로',baseHp:430000,money:915,rate:119,reward:15000,enemyMul:39,mods:['curse'],waves:[
    W(12,'magmaling',8,.45),W(22,'salamander',5,1.1),W(46,'obsidian',1),W(72,'cinderbat',10,.35),W(98,'ashcaster',2,3),W(124,'salamander',7,.9),W(152,'obsidian',2,4),W(180,'magmacannon',2,3),W(210,'magmaling',12,.35)]},
  {name:'분화구 가장자리',hint:'용암 군단의 모든 무리 · 서리 · 범위 · 파쇄 · 치유를 함께',baseHp:400000,money:925,rate:120,reward:15600,enemyMul:131,mods:['horde','curse'],waves:[
    W(12,'magmaling',10,.4),W(22,'salamander',5,1.1),W(44,'cinderbat',10,.35),W(68,'obsidian',2,4),W(92,'ashcaster',2,3),W(118,'salamander',6,1),W(144,'magmaling',12,.35),W(172,'magmacannon',3,2.5),W(202,'cinderbat',12,.3),W(232,'obsidian',2,4)]},
  {name:'★ 용암 군주',hint:'군주의 포효 뒤 대분화가 이어집니다 · 붉은 원을 피하고, 흑요석 근위대엔 파쇄를',baseHp:330000,money:940,rate:122,reward:17000,boss:true,enemyMul:22.5,waves:[
    W(12,'salamander',5,1.1),W(26,'magmalord',1),W(52,'magmaling',10,.4),W(80,'obsidian',2,4),W(110,'ashcaster',3,2.5),W(140,'cinderbat',10,.35),W(170,'salamander',7,.9),W(200,'magmacannon',3,2.5),W(232,'magmaling',12,.35),W(262,'obsidian',2,4)]}
);
STAGES.slice(ACT8_FROM).forEach(st => { st.volcano = VOLCANO; });

/* 전장 특성. 어려운 전장에는 특성이 붙어서, 스탯 높은 병종을 몰아 넣는 것만으로는
 * 풀리지 않고 그 특성을 받아칠 병종을 챙겨야 한다. */
const STAGE_MODS = {
  ironclad: { name: '중갑', desc: '모든 적이 방어 60%(보스는 30%) — 아군의 공격 피해가 크게 줄어듭니다 (중독·화상은 그대로)',
              counter: '토르(파쇄) · 중독 · 화상 · 태양 낙인', color: '#8fa3b5' },
  horde:    { name: '물량', desc: '적이 1.8배 많이 몰려옵니다 (하나하나는 약함)',
              counter: '범위 공격 · 연쇄 번개 · 값싼 방패 벽', color: '#c98a4b' },
  giantslayer: { name: '영웅 사냥꾼', desc: '적이 비용 350 이상인 아군(영웅·전설·신화)에게 4배 피해',
              counter: '값싼 병력을 많이 · 소환물 · 비싼 병종은 뒤에', color: '#9b6bd1' },
  curse:    { name: '저주', desc: '소환된 아군이 초당 10%씩 시들고, 회복·흡혈이 절반',
              counter: '소환·치유에 기대지 않는 진짜 병력', color: '#5f8f5a' },
  blitz:    { name: '질주', desc: '적 이동 속도 +45% · 공격 속도 +20%',
              counter: '둔화 · 넉백 면역 방패 · 튼튼한 앞줄', color: '#d0605a' }
};
/* 3.6 전장 특성마다 받아치는 병종 (앞일수록 잘 듣는다). 시뮬레이터의 공략 편성도 이 표를 쓴다. */
const MOD_COUNTERS = {
  ironclad: ['thor', 'javelin', 'venom', 'shield', 'alchemist', 'pyro', 'rapriest', 'knight', 'ra'],
  horde:    ['zeus', 'frost', 'pyro', 'catapult', 'knight', 'shield', 'spear'],
  blitz:    ['shield', 'frostlancer', 'frost', 'skadi', 'spartan', 'monk', 'colossus', 'medusa'],
  giantslayer: ['spear', 'shield', 'javelin', 'venom', 'catapult', 'sniper', 'pyro', 'musketeer', 'frost'],
  curse: ['knight', 'shield', 'spear', 'javelin', 'venom', 'pyro', 'frost']
};
/* 전장 병종이 열렸나: 전장 진행으로 · 또는 5.2 개발자 모드 '모든 캐릭터 해금'으로 */
function rosterOpen(s, u) { return u.unlockStage <= ((s && s.cleared) || 0) + 1 || !!(s && s.devUnits && s.devUnits[u.id]); }
/* 지금 쓸 수 있는 병종: 전장 진행으로 열린 것 + 소환해 얻은 것 */
function availableUnits(save) {
  return UNITS.filter(u => u.cost > 0 &&
    (u.gacha ? !!(save.owned && save.owned[u.id]) : rosterOpen(save, u)));
}
/* 앞에서 몸으로 막는 병종 (원거리 엄호 규칙의 '근접 전열') */
function isFrontUnit(u) { return !!u && !u.ranged && !(u.ab && (u.ab.noAttack || u.ab.summon)); }
const FRONT_MIN = 3;

/* 출진 전 편성 점검. 특성마다 가진 대응 병종과, 지금 편성의 눈에 띄는 약점.
 * 경고는 번역하기 쉽게 고정 문구(key) + 숫자(n) 로 돌려준다. */
function deckAdvice(save, stage) {
  const mods = stage.mods || [];
  const inDeck = new Set(save.loadout || []);
  const avail = new Set(availableUnits(save).map(u => u.id));
  const counters = mods.map(m => {
    const ids = (MOD_COUNTERS[m] || []).filter(id => avail.has(id)).slice(0, 5);
    return { mod: m, ids: ids, have: ids.filter(id => inDeck.has(id)) };
  });
  const deck = (save.loadout || []).map(id => UNIT_BY_ID[id]).filter(Boolean);
  const warns = [];
  const front = deck.filter(isFrontUnit).length;
  if (front < FRONT_MIN) warns.push({ key: '근접 전열이 부족합니다 · 원거리 병종이 엄호를 못 받습니다', n: front });
  if (mods.includes('giantslayer')) {
    const n = deck.filter(u => u.cost >= 350).length;
    if (n >= 3) warns.push({ key: '비용 350 이상 병종이 많습니다 · 영웅 사냥꾼에게 4배 피해', n: n });
  }
  if (mods.includes('curse')) {
    const n = deck.filter(u => u.ab && (u.ab.summon || u.ab.heal)).length;
    if (n >= 3) warns.push({ key: '소환·치유 병종이 많습니다 · 저주로 약해집니다', n: n });
  }
  for (const c of counters) if (c.ids.length && !c.have.length) warns.push({ key: '대응 병종이 편성에 없습니다', mod: c.mod });
  return { counters: counters, warns: warns };
}

/* 추천 편성: 특성 대응 병종을 번갈아 먼저, 근접 전열을 챙기고, 나머지는 비용·레벨 순.
 * 영웅 사냥꾼이면 비싼 병종을, 저주면 소환·치유에 기대는 병종을 뒤로 뺀다. */
function recommendDeck(save, stage) {
  const mods = (stage && stage.mods) || [];
  const hunted = mods.includes('giantslayer'), cursed = mods.includes('curse');
  const lv = id => (save.levels && save.levels[id]) || 1;
  const pool = availableUnits(save).filter(u => !(hunted && u.cost >= 350));
  const ok = new Set(pool.map(u => u.id));
  const picks = [];
  let heroes = 0;
  const add = id => {
    const u = UNIT_BY_ID[id];
    if (!ok.has(id) || picks.includes(id) || picks.length >= LOADOUT_MAX) return;
    if (isHeroUnit(u)) { if (heroes >= HERO_SLOT_MAX) return; heroes++; }
    picks.push(id);
  };
  for (let k = 0; k < 7; k++) for (const m of mods) { const id = (MOD_COUNTERS[m] || [])[k]; if (id) add(id); }
  const score = u => u.cost * (1 + 0.08 * (lv(u.id) - 1)) * (cursed && u.ab && (u.ab.summon || u.ab.heal) ? 0.4 : 1);
  const rest = pool.filter(u => !picks.includes(u.id)).sort((a, b) => score(b) - score(a));
  const fronts = rest.filter(isFrontUnit);
  while (picks.filter(id => isFrontUnit(UNIT_BY_ID[id])).length < FRONT_MIN + 1 && fronts.length && picks.length < LOADOUT_MAX) add(fronts.shift().id);
  for (const u of rest) add(u.id);
  return picks;
}

const HARD_STAGE_MODS = {
  9: ['ironclad'], 14: ['blitz'], 16: ['horde'], 17: ['ironclad', 'giantslayer'],
  19: ['horde', 'ironclad', 'giantslayer'],
  21: ['horde'], 23: ['horde', 'giantslayer', 'curse'], 24: ['blitz'], 26: ['blitz', 'giantslayer', 'curse'],
  27: ['horde', 'ironclad'], 29: ['giantslayer', 'curse', 'horde', 'blitz'],
  // 3막
  33: ['curse'], 36: ['ironclad', 'horde'], 37: ['blitz', 'giantslayer'], 38: ['ironclad', 'curse', 'blitz'],
  // 4막 (4.0)
  43: ['giantslayer'], 46: ['ironclad', 'horde'], 47: ['blitz', 'horde'], 48: ['ironclad', 'giantslayer', 'blitz'],
  // 5막 (4.6): 캠페인에서도 특성이 붙은 곳이 있다 (위의 st.mods 가 먼저)
  53: ['giantslayer'], 56: ['ironclad', 'horde'], 57: ['blitz', 'giantslayer'], 59: ['ironclad', 'curse'],
  // 6막 (4.11)
  63: ['giantslayer'], 66: ['curse', 'giantslayer'], 69: ['ironclad', 'curse'],
  // 7막 (4.15)
  73: ['giantslayer'], 79: ['ironclad', 'blitz']
};
STAGES.forEach((st, i) => { if (!st.mods && HARD_STAGE_MODS[i]) st.mods = HARD_STAGE_MODS[i]; });
// 전설·신화 풀이 넓어질수록 몰아 넣기만 한 편성도 두루 갖춘다. 조합이 필요한
// 1막 전장은 적 배율을 따로 올려 둔다.
STAGES[15].enemyMul = 2.3;              // 끼어 있던 보스 둘이 정예로 바뀐 만큼
STAGES[11].enemyMul = 1.78;             // 2.7: 쿨타임·비용 등급 조정 뒤 중반이 물러져서
STAGES[12].enemyMul = 1.62;             // 3.0.2: 엄호 없는 원거리가 약해진 만큼 리치의 재림을 조금 누그러뜨린다
STAGES[14].enemyMul = 1.9;              // 3.0.2: 원거리가 전열 뒤에서 기다리게 되어 거대 트롤의 문을 다시 조인다
STAGES[16].enemyMul = 1.65;
STAGES[17].enemyMul = 2.0;             // 3.2: 보스 ×1.15 가 붙어 2.3 · 2.7: 비싼 병종 강화·진화에 맞춰 다시 조율 (3.0: 보스를 반드시 쓰러뜨리게 되어 다시)
STAGES[23].enemyMul = 6;               // 3.0: 보스 배율을 누그러뜨린 만큼 삼중 봉인 자체를 올린다
STAGES[19].enemyMul = 3.2;             // 3.0: 대군주를 반드시 쓰러뜨려야 하는 대신 영웅 사냥꾼이 붙었다
/* 3.2: 1막은 더 억세게, 잡몹 전장도 쉬어 가는 곳이 되지 않게.
 *  - 1막 4전장부터: 잡몹 전장 ×1.3, 보스 전장 ×1.15 (1~3전장은 기본 병종으로 넘어가야 하니 그대로)
 *  - 2막 잡몹 전장 ×1.25 */
const ACT1_MOB_MUL = 1.3, ACT1_BOSS_MUL = 1.15, ACT2_MOB_MUL = 1.25;
STAGES.forEach((st, i) => {
  if (i < 3) return;
  // 3막(3.3)은 배율을 처음부터 그 값으로 적어 두었다
  const mul = i < 20 ? (st.boss ? ACT1_BOSS_MUL : ACT1_MOB_MUL) : i >= ACT3_FROM ? 1 : (st.boss ? 1 : ACT2_MOB_MUL);
  st.enemyMul = +(st.enemyMul * mul).toFixed(3);
});

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
/* 새 잡몹을 전장에 섞는다. [시각, 적, 수, 간격] — 처음 나오는 전장 순서가 곧 해금 순서다. */
const NEW_MOB_WAVES = {
  1: [[20, 'slinger', 2, 1.5]], 2: [[26, 'slinger', 3, 1.4]], 4: [[34, 'slinger', 3, 1.4]],
  6: [[40, 'slinger', 4, 1.2]], 7: [[50, 'drummer', 1]], 8: [[44, 'drummer', 1], [60, 'slinger', 4, 1.2]],
  10: [[60, 'hexer', 2, 2]], 11: [[40, 'skelarcher', 3, 1.4], [70, 'boneguard', 2, 1.6]],
  12: [[50, 'boneguard', 3, 1.5], [64, 'skelarcher', 3, 1.3]], 13: [[70, 'assassin', 2, 2], [90, 'drummer', 1]],
  14: [[60, 'burrower', 2, 2]], 15: [[80, 'hexer', 3, 1.8], [100, 'burrower', 2, 2]],
  16: [[90, 'chariot', 1], [110, 'assassin', 2, 1.8]], 17: [[80, 'burrower', 3, 1.6], [100, 'drummer', 1]],
  18: [[100, 'chariot', 1], [120, 'hexer', 3, 1.6]],
  19: [[110, 'drummer', 2, 3], [140, 'chariot', 2, 4], [160, 'assassin', 3, 1.5]],
  20: [[70, 'skelarcher', 4, 1.2], [120, 'boneguard', 3, 1.5]], 21: [[100, 'boneguard', 4, 1.4], [140, 'skelarcher', 5, 1.1]],
  22: [[90, 'drummer', 2, 3], [120, 'chariot', 2, 4]], 23: [[130, 'skelarcher', 5, 1.1], [160, 'hexer', 3, 1.6]],
  24: [[90, 'assassin', 3, 1.5], [160, 'burrower', 3, 1.5]], 25: [[110, 'burrower', 3, 1.5], [150, 'chariot', 2, 4]],
  26: [[120, 'drummer', 2, 3], [150, 'assassin', 3, 1.4]], 27: [[100, 'hexer', 3, 1.5], [200, 'chariot', 2, 4]],
  28: [[100, 'drummer', 2, 3], [180, 'hexer', 3, 1.5]],
  29: [[160, 'burrower', 3, 1.4], [200, 'chariot', 2, 4], [230, 'assassin', 4, 1.3]]
};
/* 3.0.1 기절 저항. 기절만 쌓아 두면 다 멈추던 것을 비튼다.
 *  면역: 무게로 밀고 오는 기계·거구·망령 — 둔화나 화력으로 잡아야 한다
 *  저항: 갑주 두른 정예·광폭한 적 — 기절이 30% 짧게 걸린다 */
const STUN_IMMUNE = ['siegeram', 'souleater', 'titan', 'stoneward'];
const STUN_RESIST = { clawcrab: 0.3, deepone: 0.3, demonknight: 0.5, rockling: 0.3, voidlord: 0.3, demonking: 0.3, golem: 0.5, orcshield: 0.3, dark: 0.3, warchief: 0.3, orcberserk: 0.3, jailer: 0.3, chariot: 0.3, wraith: 0.3 };
STUN_IMMUNE.forEach(id => {
  const e = ENEMIES[id];
  e.ab = Object.assign({}, e.ab, { stunImmune: true });
  e.abText = (e.abText ? e.abText + ' · ' : '') + '기절 면역';
});
Object.keys(STUN_RESIST).forEach(id => {
  const e = ENEMIES[id];
  e.ab = Object.assign({}, e.ab, { stunResist: STUN_RESIST[id] });
  e.abText = (e.abText ? e.abText + ' · ' : '') + '기절 저항 ' + Math.round(STUN_RESIST[id] * 100) + '%';
});

/* 3.0 특이한 적. 한 종류씩 전장에 처음 얼굴을 비추고, 뒤로 갈수록 섞여 나온다. */
const ODD_MOB_WAVES = {
  5: [[30, 'thief', 2, 1.6]], 7: [[46, 'thief', 3, 1.3]], 8: [[56, 'sapper', 1]],
  9: [[70, 'sapper', 2, 3]], 10: [[36, 'ooze', 2, 3]], 11: [[58, 'ooze', 2, 3], [88, 'thief', 3, 1.2]],
  12: [[40, 'mirror', 2, 2.5]], 13: [[70, 'mirror', 2, 2], [96, 'sapper', 2, 3]], 14: [[50, 'ooze', 3, 2.4]],
  15: [[70, 'jailer', 1], [110, 'mirror', 2, 2]], 16: [[60, 'jailer', 1], [100, 'thief', 4, 1]],
  17: [[90, 'ooze', 3, 2], [130, 'sapper', 2, 2.5]], 18: [[70, 'chrono', 1], [120, 'jailer', 1]],
  19: [[90, 'chrono', 1], [150, 'mirror', 3, 1.8]],
  20: [[80, 'souleater', 1], [140, 'ooze', 3, 2]], 21: [[90, 'souleater', 1], [160, 'sapper', 3, 2]],
  22: [[100, 'jailer', 2, 5], [170, 'chrono', 1]], 23: [[90, 'mirror', 3, 2], [150, 'souleater', 1]],
  24: [[70, 'thief', 5, .9], [170, 'jailer', 1]], 25: [[100, 'ooze', 4, 1.8], [190, 'chrono', 1]],
  26: [[120, 'souleater', 2, 4], [200, 'sapper', 3, 2]], 27: [[80, 'sapper', 3, 2], [160, 'mirror', 4, 1.6]],
  28: [[110, 'chrono', 2, 6], [190, 'souleater', 2, 4]],
  29: [[130, 'jailer', 2, 5], [210, 'ooze', 5, 1.5], [240, 'chrono', 1]]
};
STAGES.forEach((st, i) => {
  (NEW_MOB_WAVES[i] || []).forEach(([t, e, n, gap]) => st.waves.push(W(t, e, n, gap)));
  (ODD_MOB_WAVES[i] || []).forEach(([t, e, n, gap]) => st.waves.push(W(t, e, n, gap)));
  st.waves.sort((a, b) => a.t - b.t);
});

const BOSS_ROLE = { kraken: 'bruiser', tidequeen: 'caster', leviathan: 'bruiser',
                    raptorqueen: 'bruiser', quetzal: 'flyer', jungletyrant: 'bruiser',
                    mushking: 'bruiser', faequeen: 'caster', eldertree: 'bruiser',
                    scorpking: 'bruiser', sphinx: 'caster', sandpharaoh: 'bruiser',
                    lavawyrm: 'bruiser', phoenix: 'flyer', magmalord: 'bruiser',
                    stormgriffin: 'flyer', cloudking: 'bruiser', skylord: 'caster',
                    troll: 'bruiser', frostgiant: 'bruiser', warlord: 'bruiser',
                    lich: 'caster', spiderqueen: 'caster', drake: 'flyer' };
const BOSS_ESCORT = {
  bruiser: { back: ['ballista', 'slinger', 'shaman', 'hexer', 'plaguer', 'orccatapult'], front: ['wolf', 'assassin', 'hellhound', 'orcspear'], nb: 4, nf: 2,
             sea: { back: ['siren', 'seahook'], front: ['nagaspear', 'eel'] },
             sky: { back: ['stormwisp', 'skycannon'], front: ['harpy', 'griffinrider'] },
             jungle: { back: ['poisontoad', 'vineshaman'], front: ['raptor', 'lizardman', 'triceratops'] },
             fey: { back: ['satyr', 'wisp'], front: ['sporecap', 'pixie', 'treant'] },
             sand: { back: ['dunerider', 'sandmage'], front: ['scorpion', 'scarab', 'mummy'] },
             lava: { back: ['ashcaster', 'magmacannon'], front: ['salamander', 'magmaling', 'obsidian'] } },
  caster:  { back: ['ballista', 'skelarcher', 'plaguer'], front: ['orcshield', 'boneguard', 'orcspear', 'orcberserk', 'chariot', 'dark'], nb: 2, nf: 4,
             sea: { back: ['siren', 'tidecaller'], front: ['clawcrab', 'deepone', 'nagaspear'] },
             sky: { back: ['stormwisp', 'windcaller'], front: ['cloudgiant', 'griffinrider', 'harpy'] },
             jungle: { back: ['vineshaman', 'poisontoad'], front: ['stoneidol', 'lizardman', 'raptor'] },
             fey: { back: ['wisp', 'satyr'], front: ['sporecap', 'treant', 'unicorn'] },
             sand: { back: ['sandmage', 'dunerider'], front: ['mummy', 'scorpion', 'sandworm'] },
             lava: { back: ['ashcaster', 'magmacannon'], front: ['obsidian', 'salamander', 'magmaling'] } },
  flyer:   { back: ['shaman', 'hexer', 'ballista'], front: ['orcshield', 'burrower', 'hellhound', 'boneguard', 'orcberserk', 'golem'], nb: 2, nf: 3,
             sky: { back: ['stormwisp', 'windcaller'], front: ['cloudgiant', 'harpy'] },
             jungle: { back: ['poisontoad', 'vineshaman'], front: ['lizardman', 'raptor'] },
             fey: { back: ['wisp', 'satyr'], front: ['sporecap', 'pixie'] },
             sand: { back: ['dunerider', 'sandmage'], front: ['scorpion', 'mummy'] },
             lava: { back: ['ashcaster', 'magmacannon'], front: ['salamander', 'cinderbat'] } }
};
/* 전장 번호(0부터) → 그 전장의 보스 */
const STAGE_BOSS = { 4: 'lich', 9: 'troll', 12: 'lich', 14: 'troll', 16: 'frostgiant', 17: 'drake',
                     18: 'spiderqueen', 19: 'warlord', 21: 'lich', 23: 'lich', 26: 'frostgiant',
                     28: 'drake', 29: 'warlord', 32: 'kraken', 35: 'tidequeen', 39: 'leviathan',
                     42: 'stormgriffin', 45: 'cloudking', 49: 'skylord',
                     52: 'raptorqueen', 55: 'quetzal', 59: 'jungletyrant',
                     62: 'mushking', 65: 'faequeen', 69: 'eldertree',
                     72: 'scorpking', 75: 'sphinx', 79: 'sandpharaoh',
                     82: 'lavawyrm', 85: 'phoenix', 89: 'magmalord' };
const ELITE_FOR = { troll: ['ogre', 1], lich: ['shaman', 2], frostgiant: ['golem', 1],
                    drake: ['hellhound', 3], spiderqueen: ['spider', 4], warlord: ['warchief', 1] };
/* 그 막의 군단으로 바꾼 호위 (3막 바다 · 4막 천공 · 5막 밀림 · 6막 요정 숲) */
function actEscort(role, i) {
  const esc0 = BOSS_ESCORT[role];
  return i >= ACT8_FROM && esc0.lava ? Object.assign({}, esc0, esc0.lava)
    : i >= ACT7_FROM && esc0.sand ? Object.assign({}, esc0, esc0.sand)
    : i >= ACT6_FROM && esc0.fey ? Object.assign({}, esc0, esc0.fey)
    : i >= ACT5_FROM && esc0.jungle ? Object.assign({}, esc0, esc0.jungle)
    : i >= ACT4_FROM && esc0.sky ? Object.assign({}, esc0, esc0.sky)
    : i >= ACT3_FROM && esc0.sea ? Object.assign({}, esc0, esc0.sea) : esc0;
}
const BOSS_HP_MUL = 2.0;       // 하나뿐인 보스는 그만큼 단단하다
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
      const esc = actEscort(BOSS_ROLE[sig], i);
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

/* ------------------------------------------------------------------
 *  개전 방식. 매번 같은 식으로 시작하면 금방 질린다.
 *   - rush  : 곧바로 적이 온다
 *   - calm  : 첫 적이 12초쯤 뒤에 온다 — 편성을 깔 시간이 있다
 *   - sally : 요새를 두들기면(체력 80%·45%) 요새가 충격파로 아군을 밀어내며
 *             숨겨 둔 수비대를 쏟아낸다
 *  1·2전장은 안내 삼아 늘 rush. 조합 검증용 전장 몇 곳은 손으로 정한다.
 * ------------------------------------------------------------------ */
const OPENINGS = {
  rush:  { name: '정면 돌격', icon: '⚔', color: '#ff7a5a', desc: '전투가 시작되자마자 적이 몰려옵니다.' },
  calm:  { name: '폭풍 전야', icon: '⏳', color: '#7ac8ff', desc: '잠시 조용하다가 적이 한꺼번에 들이닥칩니다. 그 사이 전열을 갖추세요.' },
  sally: { name: '요새 반격', icon: '🏰', color: '#ffb45a', desc: '요새 체력이 80%·45%가 되면 충격파로 아군을 밀쳐내고 수비대를 풀어놓습니다.' }
};
STAGES[17].opening = 'calm';
STAGES[23].opening = 'calm';
STAGES[27].opening = 'sally';
STAGES.forEach((st, i) => {
  st.opening = st.opening || (i < 2 ? 'rush' : ['calm', 'rush', 'sally'][i % 3]);
  // 고요: 첫 12초는 조용하다가, 그 사이 올 적이 한꺼번에 몰려온다 (전체 압박은 그대로)
  if (st.opening === 'calm') st.waves.forEach(w => { if (w.t < 12) w.t = 12; });
  if (st.opening !== 'sally') return;
  // 수비대: 보스 전장이면 그 보스의 호위, 아니면 이 전장에서 가장 흔한 잡몹 둘
  let front, back;
  if (st.bossRole) {
    // 4.11: 수비대도 그 막의 군단으로 (예전엔 바다 · 밀림 · 요정 숲 전장에서도 늑대 기수 · 석궁 사수가 나왔다)
    const esc = actEscort(st.bossRole, i);
    const seen = new Set(); STAGES.slice(0, i + 1).forEach(x => x.waves.forEach(w => seen.add(w.e)));
    front = esc.front.find(id => seen.has(id)) || 'orcspear';
    back = esc.back.find(id => seen.has(id)) || 'ballista';
  } else {
    const count = {};
    st.waves.forEach(w => { if (!ENEMIES[w.e].boss && !(ENEMIES[w.e].ab && ENEMIES[w.e].ab.hold)) count[w.e] = (count[w.e] || 0) + w.n; });
    const top = Object.keys(count).sort((a, b) => count[b] - count[a]);
    front = top.find(id => !ENEMIES[id].ranged) || top[0] || 'orcspear';
    back = top.find(id => ENEMIES[id].ranged) || top[1] || front;
  }
  const n = Math.min(11, 2 + Math.floor(i / 7));   // 4.15: 7막에서 13명씩 쏟아져 단번에 무너졌다 — 6막 크기(11)에서 멈춘다
  st.sally = [
    { at: 0.8, group: [[front, n], [back, Math.max(1, n - 1)]] },
    { at: 0.45, group: [[front, n + 1], [back, n]] }
  ];
});

/* ------------------------------------------------------------------
 *  전장 컨셉: 모습(look)과 전장 곡(music). 곡은 서른 전장이 모두 다르다.
 *  보스가 나오면 보스곡으로 바뀌고, 마지막 전장은 따로 한 곡(finale).
 * ------------------------------------------------------------------ */
const STAGE_LOOKS = ['meadow', 'wheat', 'river', 'forest', 'graveyard', 'cave', 'hills', 'camp', 'canyon', 'fortress',
  'darkforest', 'ruins', 'graveyard', 'fortress', 'fortress', 'swamp', 'snow', 'volcano', 'warcamp', 'warcamp',
  'blackriver', 'underworld', 'thorns', 'underworld', 'blizzard', 'snow', 'snow', 'desert', 'eclipse', 'mythic',
  'shore', 'reef', 'stormsea', 'lighthouse', 'reef', 'sunken', 'sunken', 'stormsea', 'abyss', 'abyss',
  'skyisle', 'skyisle', 'stormspire', 'skyisle', 'stormspire', 'skyisle', 'skyisle', 'stormspire', 'stormspire', 'stormspire',
  'jungle', 'jungle', 'jungle', 'temple', 'jungle', 'temple', 'jungle', 'lavajungle', 'temple', 'lavajungle',
  'feywood', 'mushgrove', 'mushgrove', 'moonglade', 'feywood', 'moonglade', 'feywood', 'moonglade', 'mushgrove', 'feywood',
  'dunes', 'tombvalley', 'dunes', 'dunes', 'oasis', 'tombvalley', 'tombvalley', 'oasis', 'dunes', 'tombvalley',
  'ashslope', 'lavariver', 'lavariver', 'caldera', 'ashslope', 'caldera', 'lavariver', 'ashslope', 'caldera', 'caldera'];
const STAGE_MUSIC = ['meadow', 'wheat', 'river', 'wolfwood', 'graveyard', 'cave', 'hills', 'camp', 'canyon', 'fortress',
  'darkwood', 'ruins', 'return', 'shieldwall', 'gate', 'swamp', 'snowpass', 'volcano', 'warcamp', 'throne',
  'blackriver', 'underworld', 'thorngate', 'seal', 'blizzard', 'siege', 'winterthrone', 'desert', 'eclipse', 'mythic',
  'shore', 'coral', 'krakenbay', 'lighthouse', 'sirensong', 'tidetemple', 'sunken', 'strait', 'abyssgate', 'leviathan',
  'cloudbridge', 'windcliff', 'griffinnest', 'skybattery', 'thunderspire', 'cloudthrone', 'skygarden', 'stormeye', 'citadelgate', 'skythrone',
  'vinepath', 'toadmarsh', 'raptornest', 'templesteps', 'hornplain', 'serpentaltar', 'mistfalls', 'lavajungle', 'templeheart', 'tyrant',
  'fairyring', 'sporevale', 'mushcourt', 'wispmarsh', 'treehall', 'moonpalace', 'satyrfeast', 'unicornmeadow', 'forestheart', 'elderking',
  'hotdunes', 'mummyvale', 'scorpnest', 'wormdunes', 'mirage', 'sphinxgate', 'kingsvalley', 'glassdesert', 'stormeye7', 'pharaoh',
  'ashslope', 'lavariver', 'wyrmnest', 'obsidiangorge', 'cindercave', 'phoenixnest', 'godforge', 'boilinglake', 'craterrim', 'magmalord'];
STAGES.forEach((st, i) => {
  st.look = st.look || STAGE_LOOKS[i] || 'meadow';
  st.music = st.music || STAGE_MUSIC[i] || 'meadow';
});
STAGES[29].finale = true;                      // 2막의 끝: 세 신화의 종착지
STAGES[39].bossMusic = 'finale2';               // 3막의 끝은 따로 한 곡 (3.3)
STAGES[ACT5_FROM - 1].bossMusic = 'finale3';      // 4막의 끝 (4.0)
STAGES[ACT6_FROM - 1].bossMusic = 'finale4';      // 5막의 끝 (4.6)
STAGES[ACT7_FROM - 1].bossMusic = 'finale5';      // 6막의 끝 (4.11)
STAGES[ACT8_FROM - 1].bossMusic = 'finale6';      // 8막의 끝 (4.15)
STAGES[STAGES.length - 1].bossMusic = 'finale7';   // 9막의 끝 (5.3)
STAGES.forEach((st, i) => { if (i < 50) st.hardRatio = i === 37 ? 1 : 1.3; });   // 4.18 하드코어 적 배율 바닥: 1~5막은 전장의 1.3배 이상 (38전장 기습은 1배), 6~7막은 0.8배 이상 — 다 키운 편성이 겨우 넘는 곳이라 요새·성채·보스·특성으로 어렵게
STAGES[79].hardMods = ['blitz', 'curse']; STAGES[79].hardSoft = 0.65; STAGES[79].hardBoss = 0.7; STAGES[75].hardSoft = 0.85; STAGES[75].hardBoss = 0.75;   // 4.18 하드코어 7막의 끝: 되살아나는 파라오 앞에서 다 키운 편성도 무너졌다 — 이 전장만 배율을 조금 덜어 준다   // 7막의 끝 (4.15)
/* 4.20 하드코어는 '만렙 기준': 강화 10 · Lv30 · 전장을 다 연 계정(병종 · 진화 전부, 소환 영웅 전부)의 가장 잘 맞는 편성이
 * 전장마다 정해 둔 만큼 이기도록 하드코어 적 배율에 따로 곱한다. 시뮬레이터로 찾았다 (씨앗 여섯 판 이분 탐색 → 다른 씨앗 열 판으로 확인).
 * 4.20: 승률 50% · 4.21: 보스 각인을 더하고 30% 안팎 (보스 전장은 각인이 어려움을 맡아 능력치를 덜기도 했다).
 * 만렙 계정에게 앞쪽 전장은 거저라 값이 크다.
 * 5.2: 오딘 4진 · 새 3진 다섯 · 버프 편성을 아서 먼저 내보내게 해 다시 맞췄다 (가장 센 편성의 승률 1/3 — 4.24 와 같은 방법). */
const HARD_TUNE = [
  14.9, 15.0, 12.1, 10.1, 4.31, 11.8, 8.0, 6.45, 3.64, 2.92,   // 1~10
  3.78, 3.61, 3.23, 3.62, 6.75, 8.93, 7.08, 4.14, 13.4, 13.8,   // 11~20
  8.01, 9.01, 17.7, 4.56, 10.4, 13.5, 3.51, 2.57, 12.9, 7.41,   // 21~30
  11.5, 3.04, 2.73, 6.87, 6.91, 4.47, 7.39, 2.37, 6.22, 9.02,   // 31~40
  4.07, 7.44, 6.33, 3.47, 4.81, 8.35, 7.74, 7.03, 3.21, 8.25,   // 41~50
  9.6, 7.75, 5.4, 10.5, 8.23, 9.26, 4.76, 4.66, 7.66, 6.83,   // 51~60
  5.03, 4.33, 5.73, 3.13, 6.57, 6.85, 2.12, 2.61, 3.82, 5.31,   // 61~70
  5.26, 2.95, 3.28, 2.42, 3.35, 3.99, 2.99, 5.11, 2.54, 4.73,   // 71~80
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4    // 81~90
];
STAGES.forEach((st, i) => { st.hardTune = HARD_TUNE[i]; });
/* 4.23 하드코어 보스 전장의 보스 체력 배율 (전장 번호 → hardBoss). 보스 체력을 4.22 의 1.6배로 올리고(HARDCORE.boss.hp 2 → 3.2)
 * 위 hardTune 을 낮춰 승률을 맞추되, hardTune 이 보스 체력까지 깎지 않게 되돌려 둔 값 — 잡몹이 바닥까지 내려가도 넘을 수 없던
 * 몇 곳(29 · 36)만 보스 체력 상향폭을 조금 덜었다 */
const HARD_BOSS_HP = { 5: 1.03, 10: 1.08, 13: 1.13, 15: 1.03, 17: 0.993, 18: 1.15, 19: 1.13, 20: 1.13, 22: 1.01, 24: 1.98, 27: 1.1, 29: 1.82, 30: 0.977, 33: 1.01, 36: 1.63, 40: 1.04, 43: 1.25, 46: 1.06, 50: 1.17, 53: 1.06, 56: 1.13, 60: 1.19, 63: 1.1, 66: 1.45, 70: 1.19, 73: 1.38, 76: 0.985, 80: 0.861 };
for (const k in HARD_BOSS_HP) STAGES[k - 1].hardBoss = HARD_BOSS_HP[k];
/* 4.23 보스 등장 충격파 · 보스가 밀치기에 버티게 되자, 특성이 붙은 진군 보스 전장 몇 곳을 공략 편성으로도 넘기 어려워졌다 (밀쳐 내며 붙잡던 길이 막혔다).
 * 진군의 적 배율을 조금 덜고, 하드코어는 hardTune 으로 되돌려 그대로 둔다 */
[[18, 0.86], [20, 0.9], [27, 0.8], [30, 0.85]].forEach(([n, k]) => { const st = STAGES[n - 1]; st.enemyMul = Math.round(st.enemyMul * k * 100) / 100; st.hardTune = st.hardTune / k; });

/* 4.21 보스 각인: 하드코어 · 도전에서 보스가 제 고유 기술 말고 둘을 더 쓴다. 모두 예고가 있고, 받아칠 길이 있다.
 * (진군 · 무한 전장의 보스는 그대로) */
const BOSS_AFFIXES = {
  charge: { t: 'charge', name: '돌진', icon: '➶', cd: 15, first: 9, warn: 1.6, dist: 320, ratio: 0.35, push: 70, stun: 0.6,
            desc: '붉은 길을 그은 뒤 내달려 맨 앞 병사를 들이받는다 — 부딪힌 자리 둘레 최대 체력 35% 피해 · 밀쳐 냄' },
  clone:  { t: 'clone', name: '분신', icon: '👥', cd: 24, first: 12, n: 2, hp: 0.07, atk: 0.35, life: 9, heal: 0.06,
            desc: '분신 둘 — 9초 안에 못 베면 분신마다 보스 체력이 6% 찬다' },
  totem:  { t: 'totem', name: '수호 토템', icon: '🗿', cd: 28, first: 10, n: 2, hp: 0.05, cut: 0.5,
            desc: '보스 뒤에 토템 둘 — 하나라도 서 있으면 보스가 받는 피해 절반 (사거리 긴 병종 · 범위 공격으로)' },
  doom:   { t: 'doom', name: '사형 선고', icon: '☠', cd: 17, first: 8, delay: 4, ratio: 0.85,
            desc: '가장 강한 아군 하나에 낙인 — 4초 뒤 최대 체력 85% 피해 (보호막 · 회복 · 왕명으로 버틴다)' },
  tax:    { t: 'tax', name: '군자금 탈취', icon: '💸', cd: 21, first: 14, delay: 3, ratio: 0.5,
            desc: '3초 뒤 쌓인 군자금 절반을 빼앗는다 — 그 전에 출진시켜라' },
  pull:   { t: 'pull', name: '끌어당김', icon: '🌀', cd: 19, first: 11, r: 380, warn: 1.3, radius: 150, ratio: 0.3,
            desc: '앞의 병사를 보스 앞으로 끌어당긴 뒤 내려찍는다(최대 체력 30%) — 뒷줄 원거리도 끌려온다' },
  // 4.23 각인 셋 더
  starfall: { t: 'starfall', name: '유성우', icon: '☄', cd: 20, first: 13, n: 4, warn: 1.8, radius: 85, ratio: 0.22,
            desc: '아군이 모인 자리 넷에 붉은 원 — 1.8초 뒤 유성이 떨어져 최대 체력 22% 피해 (회복 · 보호막 · 흩어진 전열로 버틴다)' },
  seal:   { t: 'seal', name: '봉인', icon: '⛓', cd: 23, first: 15, n: 2, dur: 7,
            desc: '가장 비싼 출진 카드 둘을 7초 동안 묶는다 — 값싼 병종도 섞어 두어라' },
  frenzy: { t: 'frenzy', name: '광폭', icon: '🔥', cd: 22, first: 16, dur: 7, rate: 0.6, speed: 1.4,
            desc: '7초 동안 공격 · 이동이 빨라진다 — 기절시키면 바로 풀린다' }
};
const AFFIX_KEYS = Object.keys(BOSS_AFFIXES);
// 4.23 도전의 보스는 각인 셋 (새 각인 하나씩 더). 가면무도회는 제 기믹이 봉인이라 봉인 각인은 주지 않는다
const EVENT_AFFIX = { eclipse: ['clone', 'doom', 'starfall'], titan: ['charge', 'pull', 'frenzy'], fleet: ['tax', 'totem', 'seal'], rift: ['pull', 'clone', 'seal'],
                      demonking: ['doom', 'totem', 'frenzy'], train: ['doom', 'tax', 'starfall'], masque: ['clone', 'doom', 'frenzy'], hourglass: ['totem', 'pull', 'starfall'],
                      muspel: ['charge', 'tax', 'frenzy'], twins: ['starfall', 'seal'] };   // 5.3 (쌍왕은 둘이라 하나씩 적게)
/* 이 전장의 보스가 쓰는 각인 (하드코어 보스 전장은 짝 36가지 중 28가지를 돌려 가며 — 4.23: 보폭 13 이라 전장마다 다른 짝) */
function bossAffixes(stage, idx, hard) {
  if (stage && stage.runAffix) return stage.runAffix;          // 5.0 정벌 보스
  if (stage && stage.event) return EVENT_AFFIX[stage.event.id] || [];
  if (!hard || !stage || !stage.boss || !stage.bossId) return [];
  let k = 0;
  for (let i = 0; i < idx && i < STAGES.length; i++) if (STAGES[i].boss && STAGES[i].bossId) k++;
  const pairs = [];
  for (let a = 0; a < AFFIX_KEYS.length; a++) for (let b = a + 1; b < AFFIX_KEYS.length; b++) pairs.push([AFFIX_KEYS[a], AFFIX_KEYS[b]]);
  return pairs[(k * 13 + 2) % pairs.length];
}

/* 전장 길이. 예전엔 모두 2000 이라 병사가 적과 부딪히기까지 40초 넘게 걸어야 했다.
 * 초반은 짧게 붙고, 뒤로 갈수록·보스 전장일수록 조금씩 길어진다. */
STAGES.forEach((st, i) => {
  if (st.len) return;
  // 레벨마다 조금씩 다르게: 뒤로 갈수록 길어지되, 사이사이 짧은 전장이 섞인다
  const wiggle = [0, -70, 50, -40, 80][i % 5];
  const base = i < 20 ? 900 + 20 * i : i < 30 ? 1180 + 18 * (i - 20) : i < 40 ? 1300 + 12 * (i - 30)   // 3막은 조금 짧게 다시 시작
    : i < 50 ? 1340 + 12 * (i - 40)                                                              // 4막도
    : i < 60 ? 1380 + 12 * (i - 50)                                                              // 5막 (4.6)
    : i < 70 ? 1380 + 10 * (i - 60)                                                              // 6막 (4.11)
    : i < 80 ? 1360 + 10 * (i - 70)                                                              // 7막 (4.15)
    : 1380 + 10 * (i - 80);                                                                      // 9막 (5.3)
  st.len = base + wiggle + (st.boss ? 120 : 0);
});

/* =======================================================================
 *  이벤트 전장 (3.2) — 극악 난이도 도전 다섯.
 *
 *  보스마다 "언제 무엇을 하느냐" 를 묻는 기믹이 하나씩 있다. 카드를 나오는 대로 내고
 *  액티브를 쿨마다 눌러서는 잘 이기지 못한다(시뮬레이터 공략 편성 승률 50% 이하).
 *   - 흡혈 백작: 안개화 중 내보낸 병사는 홀린다 — 출진을 안개가 걷힌 뒤로 미룬다 (4.12: 무적은 뺐다)
 *   - 대지 거신: 핵이 85%를 막다가 내려찍은 뒤 6초만 드러난다 — 그때 액티브·왕명을 몰아 쓴다
 *   - 유령 선장: 출진 지점 포격 — 포탄이 떨어진 다음에 병사를 내보낸다
 *   - 공허의 군주: 반사 결계 중에 때리면 되돌아온다 — 결계 중엔 액티브를 참는다
 *   - 마왕: 세 얼굴(포격 → 반사 → 핵)을 차례로
 *  캠페인 진도와 따로 기록한다(save.events[id] = 별 수). 처음 넘으면 큰 보상.
 * ======================================================================= */
const EVENT_STAGES = [
  { name: '핏빛 월식', bossId: 'vampire', bossRole: 'caster', boss: true, look: 'graveyard', music: 'underworld',
    bossMusic: 'boss_vampire', mods: ['curse'], baseHp: 36000, money: 520, rate: 58, reward: 0, enemyMul: 13.5, bossMul: { hp: 22, atk: 1.6 },
    fury: { per30: 0.1, max: 1.2 }, len: 1500,
    event: { id: 'eclipse', deck: ['thor','zeus','ra','odin','pyro','javelin','knight','spartan','frost','catapult'],
             unlock: 10, reward: 6000, stones: 12,
             mech: '안개화 중 내보낸 병사는 홀립니다 · 출진은 안개가 걷힌 뒤에' },
    waves: [W(2,'bat',8,.6), W(14,'bloodthrall',3,2), W(30,'hexer',3,1.6), W(40,'vampire',1), W(44,'bloodthrall',3,1.6),
            W(70,'wraith',5,1.4), W(96,'bat',10,.5), W(120,'bloodthrall',4,1.6), W(150,'hexer',4,1.4), W(180,'wraith',6,1.2),
            W(210,'bloodthrall',5,1.4)] },
  { name: '거신의 망치', bossId: 'titan', bossRole: 'bruiser', boss: true, look: 'volcano', music: 'volcano',
    bossMusic: 'boss_titan', mods: ['ironclad'], baseHp: 42000, money: 540, rate: 60, reward: 0, enemyMul: 11, bossMul: { hp: 4.5, atk: 1.6 },
    fury: { per30: 0.1, max: 1.2 }, len: 1550,
    event: { id: 'titan', deck: ['thor','ra','odin','rapriest','venom','pyro','alchemist','javelin','shield','knight'],
             unlock: 15, reward: 9000, stones: 15,
             mech: '핵은 내려찍은 뒤 6초만 드러난다 · 그때 액티브와 왕명을' },
    waves: [W(2,'rockling',4,1.4), W(16,'stoneward',1), W(26,'orcspear',6,1), W(40,'titan',1), W(46,'stoneward',2,4),
            W(66,'rockling',6,1.2), W(92,'golem',2,5), W(120,'stoneward',2,4), W(146,'siegeram',2,5), W(176,'rockling',8,1),
            W(206,'golem',2,5)] },
  { name: '망령 함대', bossId: 'ghostcaptain', bossRole: 'caster', boss: true, look: 'blackriver', music: 'blackriver',
    bossMusic: 'boss_ghostfleet', mods: ['blitz'], baseHp: 44000, money: 560, rate: 62, reward: 0, enemyMul: 5.6, bossMul: { hp: 2, atk: 1.6 },
    fury: { per30: 0.1, max: 1.3 }, len: 1550,
    event: { id: 'fleet', deck: ['zeus','odin','thor','shield','spartan','frost','frostlancer','pyro','catapult','knight'],
             unlock: 20, reward: 12000, stones: 18,
             mech: '출진 지점에 포격 · 포탄이 떨어진 다음에 내보내기' },
    waves: [W(2,'ghostsailor',6,.8), W(18,'ghostgunner',2,3), W(34,'wraith',4,1.2), W(40,'ghostcaptain',1),
            W(46,'ghostsailor',5,.8), W(72,'ghostgunner',3,3), W(100,'ghostsailor',8,.7), W(128,'wraith',6,1),
            W(156,'ghostgunner',3,3), W(186,'ghostsailor',10,.6), W(216,'wraith',8,.9)] },
  { name: '혼돈의 균열', bossId: 'voidlord', bossRole: 'caster', boss: true, look: 'eclipse', music: 'eclipse',
    bossMusic: 'boss_voidlord', mods: ['horde'], baseHp: 48000, money: 580, rate: 64, reward: 0, enemyMul: 9.7, bossMul: { hp: 5.1, atk: 1.6 },
    fury: { per30: 0.1, max: 1.3 }, len: 1600,
    event: { id: 'rift', deck: ['zeus','odin','thor','pyro','catapult','frost','knight','shield','spear','mage'],
             unlock: 25, reward: 15000, stones: 20,
             mech: '반사 결계 중엔 액티브·왕명 금지 · 되돌아온다' },
    waves: [W(2,'voidspawn',6,.8), W(16,'riftcaller',1), W(30,'mirror',3,1.6), W(40,'voidlord',1), W(46,'voidspawn',6,.8),
            W(72,'riftcaller',2,4), W(98,'mirror',4,1.4), W(124,'voidspawn',10,.6), W(152,'souleater',2,4),
            W(180,'riftcaller',2,4), W(210,'voidspawn',12,.5)] },
  { name: '마왕 강림', bossId: 'demonking', bossRole: 'bruiser', boss: true, look: 'mythic', music: 'mythic',
    bossMusic: 'boss_demonking', mods: ['giantslayer', 'curse'], baseHp: 56000, money: 600, rate: 66, reward: 0, enemyMul: 9, bossMul: { hp: 1.8, atk: 1.7 },
    fury: { per30: 0.12, max: 1.5 }, len: 1650,
    event: { id: 'demonking', deck: ['spear','shield','javelin','venom','catapult','pyro','frost','knight','musketeer','sniper'],
             unlock: 30, reward: 25000, stones: 30,
             mech: '포격 → 반사 결계 → 핵 노출 · 페이즈마다 다른 타이밍' },
    waves: [W(2,'imp',8,.6), W(16,'demonknight',1), W(30,'hellhound',6,.9), W(40,'demonking',1), W(46,'imp',8,.6),
            W(70,'demonknight',2,4), W(96,'warchief',2,4), W(122,'imp',12,.5), W(150,'demonknight',2,4),
            W(180,'hellhound',10,.6), W(212,'demonknight',3,3)] }
];
/* 4.6 도전 둘: '공략 편성을 그대로 들고 가도 힘든' 급. 기믹이 새롭고, 곡이 빠르고 신난다.
 * 기관차 전장은 영웅 사냥꾼: 전설만 몰아 넣고 필살 기절을 이어 걸어 기관차를 세워 두는 길을 막는다. */
EVENT_STAGES.push(
  { name: '폭주 기관차', bossId: 'irontrain', bossRole: 'bruiser', boss: true, noWard: true, look: 'railway', music: 'railrush',
    bossMusic: 'boss_train', mods: ['giantslayer'], baseHp: 150000, money: 640, rate: 82, reward: 0, enemyMul: 7.6, bossMul: { hp: 3, atk: 1.2 },
    fury: { per30: 0.12, max: 1.5 }, len: 1700,
    event: { id: 'train', deck: ['frost','frostlancer','stormcaller','bellringer','musketeer','zeus','catapult','sniper','knight','shield'],
             unlock: 45, reward: 30000, stones: 35,
             mech: '기관차가 성채에 닿으면 패배 · 둔화·기절로 늦추며 요새를 먼저 부수세요 · 경적이 울리면 돌진' },
    waves: [W(1,'irontrain',1), W(4,'coalstoker',4,1), W(16,'handcar',2,3), W(30,'coalstoker',6,.8), W(46,'golem',2,4),
            W(62,'handcar',3,2.5), W(78,'coalstoker',8,.7), W(96,'hellhound',8,.6), W(114,'handcar',3,2.5), W(132,'coalstoker',10,.6),
            W(152,'golem',3,3), W(172,'coalstoker',12,.5)] },
  { name: '그림자 가면무도회', bossId: 'masklord', bossRole: 'caster', boss: true, look: 'ballroom', music: 'masquerade',
    bossMusic: 'boss_masklord', mods: ['horde'], baseHp: 160000, money: 660, rate: 84, reward: 0, enemyMul: 10.5, bossMul: { hp: 3.2, atk: 1.3 },
    fury: { per30: 0.12, max: 1.5 }, len: 1650,
    event: { id: 'masque', deck: ['knight','shield','spear','archer','priest','mage','catapult','sniper','odin','ra'],
             unlock: 55, reward: 40000, stones: 40,
             mech: '가장 많이 낸 병종을 봉인하고 그 그림자를 보냅니다 · 한 병종만 쏟지 말고 고르게 섞어 내기' },
    waves: [W(2,'dancer',6,.6), W(14,'jester',2,2.5), W(28,'dancer',6,.6), W(40,'masklord',1), W(46,'jester',3,2.2),
            W(70,'dancer',10,.5), W(96,'jester',4,2), W(122,'dancer',12,.45), W(150,'jester',4,2), W(180,'dancer',14,.4),
            W(210,'jester',5,1.8)] }
);
/* 4.15 도전: '파라오의 모래시계' — 시간 제한 공성. 모래가 다 떨어지기 전에 요새를 부숴야 한다.
 * 전장 곳곳의 모래시계 토템이 살아 있으면 모래시계가 뒤집힐 때마다 요새가 토템 수만큼 회복한다.
 * 버티기만 하는 편성으로는 시간이 모자라고, 토템을 내버려 두면 요새가 끝없이 아문다. */
EVENT_STAGES.push(
  { name: '파라오의 모래시계', bossId: 'jackalgod', bossRole: 'bruiser', boss: true, look: 'goldtomb', music: 'sandclock',
    bossMusic: 'boss_anubis', mods: ['blitz'], baseHp: 170000, money: 680, rate: 86, reward: 0, enemyMul: 11, bossMul: { hp: 3, atk: 1.3 },
    fury: { per30: 0.12, max: 1.5 }, len: 1650,
    hourglass: { id: 'hourglass', at: [0.5, 0.68, 0.84], every: 18, heal: 0.05, limit: 210 },
    event: { id: 'hourglass', deck: ['sniper','catapult','zhugeliang','huangzhong','pyro','knight','shield','spear','mage','guanyu'],
             unlock: 70, reward: 50000, stones: 45,
             mech: '3분 30초 안에 요새를 부수지 못하면 패배 · 모래시계 토템이 살아 있으면 18초마다 요새 회복 · 토템부터 깨기' },
    waves: [W(2,'mummy',5,.8), W(12,'scarab',4,1.2), W(26,'sandmage',2,3), W(40,'jackalgod',1), W(46,'dunerider',4,1.2),
            W(66,'mummy',8,.7), W(88,'scorpion',3,2.5), W(110,'scarab',8,.8), W(132,'sandmage',3,2.5), W(156,'mummy',10,.6),
            W(180,'sandworm',2,4)] }
);
/* 5.3 도전 둘 — 난이도는 새 곳으로 (기존 도전은 5.2 기준 그대로).
 *  - '무스펠의 불꽃 거인': 수르트가 불꽃 검을 치켜들면 4초 안에 기절로 끊어야 한다. 못 끊으면 아군 모두 최대 체력 40% + 화상.
 *    끊으면 3초 비틀거린다 — 기절을 언제 쓰느냐를 묻는다 (필살을 쿨마다 눌러 버리면 막을 것이 없다).
 *  - '해와 달의 쌍왕': 보스 둘. 한쪽이 쓰러지면 10초 안에 다른 쪽도 쓰러뜨려야 결계가 걷힌다. 늦으면 먼저 쓰러진 쪽이 체력 60% 로 되살아나고,
 *    남은 쪽은 격노한다 — 피해를 고르게 나눠 두 체력을 함께 깎아 내려가야 한다. */
EVENT_STAGES.push(
  { name: '무스펠의 불꽃 거인', bossId: 'surtr', bossRole: 'bruiser', boss: true, look: 'caldera', music: 'muspel',
    bossMusic: 'boss_surtr', mods: ['ironclad'], baseHp: 180000, money: 700, rate: 88, reward: 0, enemyMul: 11, bossMul: { hp: 3, atk: 1.3 },
    fury: { per30: 0.12, max: 1.5 }, len: 1650,
    event: { id: 'muspel', deck: ['thor','zeus','guanyu','frost','frostlancer','spartan','shield','knight','priest','catapult'],
             unlock: 80, reward: 60000, stones: 50,
             mech: '불꽃 검을 치켜들면 4초 안에 기절로 끊으세요 · 못 끊으면 아군 모두 최대 체력 40% 피해 · 끊으면 3초 비틀거림' },
    waves: [W(2,'salamander',5,.8), W(12,'magmaling',6,.6), W(26,'ashcaster',2,3), W(40,'surtr',1), W(46,'cinderbat',8,.5),
            W(66,'salamander',6,.8), W(88,'obsidian',2,4), W(110,'magmaling',10,.5), W(132,'magmacannon',2,3), W(156,'salamander',8,.7),
            W(180,'obsidian',2,4)] },
  { name: '해와 달의 쌍왕', bossId: 'sunking', bossRole: 'caster', boss: true, look: 'eclipse', music: 'twinsky',
    bossMusic: 'boss_twins', mods: ['horde'], baseHp: 190000, money: 720, rate: 90, reward: 0, enemyMul: 12, bossMul: { hp: 2.6, atk: 1.3 },
    fury: { per30: 0.12, max: 1.5 }, len: 1650,
    event: { id: 'twins', deck: ['merlin','ra','zeus','odin','thor','catapult','mage','pyro','knight','shield'],
             unlock: 88, reward: 70000, stones: 55,
             mech: '보스 둘 · 한쪽을 쓰러뜨리면 10초 안에 다른 쪽도 · 늦으면 먼저 쓰러진 쪽이 되살아나고 남은 쪽은 격노 — 두 체력을 함께 깎으세요' },
    waves: [W(2,'pixie',8,.5), W(14,'unicorn',2,3), W(28,'harpy',6,.6), W(40,'sunking',1), W(40,'moonqueen',1), W(46,'wisp',3,2),
            W(70,'griffinrider',4,1.4), W(96,'pixie',12,.4), W(122,'unicorn',3,2.5), W(150,'stormwisp',3,2.5), W(180,'harpy',10,.5)] }
);
/* 4.18: 다 키운 편성이면 도전 여덟이 모두 성채 100% 로 끝났다 (하드코어보다 쉽다는 말이 맞았다).
 * 도전을 더 억세게: 적 배율 · 보스 체력에 곱한다.
   * 도전마다 여유가 달라(앞의 다섯은 넉넉, 뒤의 셋은 빠듯) 따로 맞춘다: [적 배율, 보스 체력] */
// 4.20: 만렙(Lv30 · 강화 10) 기준으로 다시 — 가장 잘 맞는 편성 + 타이밍 공략의 승률이 50% 안팎 (하드코어와 같은 기준)
// 4.21: 보스 각인을 더하고 승률 목표를 30% 안팎으로 — 각인이 무거운 곳(거신 · 균열 · 모래시계)은 능력치를 오히려 덜었다
// 4.22: 분신이 돌아올 때마다 덜 채우게 되어(끝나지 않는 판 막기) 분신 도전(월식 · 균열 · 가면무도회)이 쉬워져 다시 올렸다 · 토템 원거리 우선으로 마왕도 조금
const EVENT_TOUGH = { eclipse: [0.715, 4.256], titan: [4.682, 2.569], fleet: [6.502, 2.515], rift: [3.776, 2.376], demonking: [2.243, 2.942],
                      train: [4.364, 1.492], masque: [5.23, 2.708], hourglass: [3.381, 1.314],
                      muspel: [7.1, 1], twins: [6.8, 1] };   // 5.3 새 도전 — 가장 센 편성 1/3 로 맞췄다
// 4.24: 버프 · 디버프를 몰아 넣은 편성(멀린 · 오딘 · 아서 · 라 · 제갈량 + 북 · 룬 현자 · 사제 · 무당)도 기준에 넣어 다시 맞췄다 — 적 배율이 오르면 보스 체력도 따라 오른다
// 5.2: 오딘 4진 · 새 3진 다섯을 넣고 하드코어와 같이 다시 맞췄다
const EVENT_BOSS_HP = 1.6;   // 4.23 도전 보스 체력을 따로 더 (보스가 생각보다 빨리 녹았다) — 잡몹 · 공격은 EVENT_TOUGH 로 맞춘다
EVENT_STAGES.forEach((st, k) => {
  st.eventIndex = k; st.opening = 'rush';
  const tg = EVENT_TOUGH[st.event.id] || [1, 1];
  st.enemyMul = Math.round(st.enemyMul * tg[0] * 100) / 100;
  if (st.bossMul) st.bossMul = Object.assign({}, st.bossMul, { hp: Math.round(st.bossMul.hp * tg[1] * EVENT_BOSS_HP * 100) / 100 });
});
function eventOpen(s, k) { return !!EVENT_STAGES[k] && (s.cleared || 0) >= EVENT_STAGES[k].event.unlock; }
function eventCount(s) { let n = 0; for (const st of EVENT_STAGES) if (s.events && s.events[st.event.id]) n++; return n; }

/* =======================================================================
 *  3.7 금화 원정 — 몇 번이고 다시 돌며 금화를 버는 곳
 *   - 돌파할 때마다 정해진 금화 + 황금 수레·도적 두목·비룡이 지닌 금화 (소환석은 없다)
 *   - 황금 수레는 싸우지 않고 아군 성채로 굴러간다. 닿기 전에 부숴야 금화가 들어온다
 *   - 난이도는 열리는 시점의 캠페인과 비슷하게, 금화는 그 무렵 전장을 다시 도는 것의 약 1.5~2배 (분당)
 * ======================================================================= */
const EXPEDITIONS = [
  { name: '황금 수레 호송대', look: 'wheat', music: 'wheat', baseHp: 7000, money: 250, rate: 34, reward: 0, enemyMul: 3.0, len: 1000,
    expedition: { id: 'convoy', unlock: 6, reward: 260, tier: '쉬움',
                  mech: '황금 수레는 싸우지 않고 성채로 굴러갑니다 · 닿기 전에 부수세요' },
    waves: [W(2,'goblin',4,1), W(8,'goldcart',1), W(14,'orcspear',3,1.4), W(24,'goldcart',1), W(30,'wolf',3,1.2),
            W(40,'goblin',5,.8), W(46,'goldcart',1), W(56,'orcspear',4,1.2), W(64,'goldcart',1), W(72,'wolf',4,1),
            W(80,'goldcart',1)] },
  { name: '도적 소굴', look: 'darkforest', music: 'darkwood', baseHp: 17000, money: 370, rate: 47, reward: 0, enemyMul: 6.0, len: 1150,
    expedition: { id: 'den', unlock: 15, reward: 600, tier: '보통',
                  mech: '도적이 군자금을 훔칩니다 · 두목을 쓰러뜨리면 되찾고 큰 금화' },
    waves: [W(2,'thief',3,1.2), W(10,'orcspear',4,1.2), Wm(18,'goldcart',1,3.5), W(24,'thief',4,1), W(34,'assassin',2,2),
            Wm(42,'goldcart',1,3.5), W(50,'banditchief',1), W(56,'thief',5,.9), W(68,'orcshield',2,3), Wm(78,'goldcart',1,3.5),
            W(88,'assassin',3,1.6), W(98,'thief',6,.8), Wm(108,'goldcart',1,3.5)] },
  { name: '용의 보물창고', look: 'cave', music: 'cave', bossMusic: 'boss_goldwyrm', bossId: 'goldwyrm', boss: true,
    baseHp: 36000, money: 430, rate: 53, reward: 0, enemyMul: 8.5, len: 1250,
    expedition: { id: 'hoard', unlock: 25, reward: 1900, tier: '어려움',
                  mech: '비룡이 다치면 황금 수레를 빼돌립니다 · 보스와 수레를 함께 노리세요' },
    waves: [W(2,'spider',5,.8), Wm(12,'goldcart',1,4.2), W(18,'dark',2,3), W(28,'golem',1), Wm(36,'goldcart',1,4.2),
            W(44,'goldwyrm',1), W(50,'spider',6,.7), W(64,'dark',2,3), W(80,'orcberserk',3,1.6), Wm(96,'goldcart',1,4.2),
            W(110,'golem',1), W(126,'spider',8,.6)] }
];
EXPEDITIONS.forEach((st, k) => { st.expIndex = k; st.opening = 'rush'; });
function expeditionOpen(s, k) { return !!EXPEDITIONS[k] && (s.cleared || 0) >= EXPEDITIONS[k].expedition.unlock; }

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
  { id: 'slinger',  from: 1 },  { id: 'drummer',  from: 6 },
  { id: 'skelarcher', from: 8 },{ id: 'boneguard', from: 9 },
  { id: 'hexer',    from: 10 }, { id: 'assassin', from: 12 },
  { id: 'burrower', from: 13 }, { id: 'chariot',  from: 15 },
  { id: 'thief',    from: 3 },  { id: 'ooze',     from: 6 },
  { id: 'sapper',   from: 7 },  { id: 'mirror',   from: 9 },
  { id: 'jailer',   from: 11 }, { id: 'chrono',   from: 13 },
  { id: 'souleater', from: 14 }
];
/* 4.16: 2막~7막과 도전의 적도 차례로 풀려 섞인다 (tier = 웨이브 ÷ 2) */
ENDLESS_POOL.push(
  { id: 'hellhound', from: 3 },  { id: 'plaguer', from: 3 },
  { id: 'clawcrab', from: 5 },   { id: 'nagaspear', from: 5 }, { id: 'jelly', from: 5 },   { id: 'eel', from: 5 },
  { id: 'deepone', from: 6 },    { id: 'siren', from: 6 },     { id: 'tidecaller', from: 6 }, { id: 'seahook', from: 6 }, { id: 'orccatapult', from: 6 },
  { id: 'harpy', from: 7 },      { id: 'griffinrider', from: 7 }, { id: 'stormwisp', from: 7 }, { id: 'warchief', from: 7 },
  { id: 'windcaller', from: 8 }, { id: 'skycannon', from: 8 }, { id: 'cloudgiant', from: 8 }, { id: 'siegeram', from: 8 },
  { id: 'lizardman', from: 9 },  { id: 'raptor', from: 9 },    { id: 'poisontoad', from: 9 }, { id: 'vineshaman', from: 9 },
  { id: 'stoneidol', from: 10 }, { id: 'triceratops', from: 10 }, { id: 'pixie', from: 10 }, { id: 'sporecap', from: 10 },
  { id: 'wisp', from: 11 },      { id: 'satyr', from: 11 },    { id: 'treant', from: 11 },   { id: 'unicorn', from: 11 },
  { id: 'scarab', from: 12 },    { id: 'scorpion', from: 12 }, { id: 'dunerider', from: 12 }, { id: 'mummy', from: 12 },
  { id: 'sandmage', from: 13 },  { id: 'sandworm', from: 13 }, { id: 'dancer', from: 13 },   { id: 'coalstoker', from: 13 }
);

/* =======================================================================
 *  4.16 무한 전장 전면 개편
 *  - 정말로 끝이 없다: 적 요새는 무너지지 않고, 아군 성채가 무너질 때까지 이어진다.
 *  - 대신 오래 끌지 않는다: 적이 웨이브마다 가파르게(곱으로) 세지고 웨이브 간격도 짧다.
 *  - 3웨이브마다 보스: 캠페인 전장 보스 둘 뒤에 도전 보스 하나 — 1막부터 7막까지, 도전 보스는 차례로.
 *    12웨이브마다는 보스 둘이 한꺼번에 (전장 보스 + 도전 보스).
 *  - 보스 체력·공격은 기준값 쪽으로 반쯤 당겨 맞춘다(k): 1막 보스도 끝까지 위협이 되고, 7막 보스만 압도하지 않게.
 *  - 곡은 그 보스의 곡으로 바뀐다 (music.js endlessBossTrack).
 * ======================================================================= */
const ENDLESS_STAGE_BOSSES = ['lich', 'troll', 'frostgiant', 'drake', 'spiderqueen', 'warlord', 'kraken', 'tidequeen', 'leviathan',
  'stormgriffin', 'cloudking', 'skylord', 'raptorqueen', 'quetzal', 'jungletyrant', 'mushking', 'faequeen', 'eldertree',
  'scorpking', 'sphinx', 'sandpharaoh'];
const ENDLESS_EVENT_BOSSES = ['vampire', 'titan', 'ghostcaptain', 'voidlord', 'demonking', 'masklord', 'jackalgod'];   // 기관차는 성채에 닿으면 끝이라 뺀다
const ENDLESS_BOSSES = ENDLESS_STAGE_BOSSES.concat(ENDLESS_EVENT_BOSSES);
const ENDLESS_BOSS = { every: 3, pair: 12, hp: 12000, atk: 520, k: 0.6 };
/* k 번째 보스 자리(0부터): 전장 보스 · 전장 보스 · 도전 보스 … */
function endlessBossAt(k) {
  if (k % 3 === 2) return ENDLESS_EVENT_BOSSES[Math.floor(k / 3) % ENDLESS_EVENT_BOSSES.length];
  return ENDLESS_STAGE_BOSSES[(k - Math.floor((k + 1) / 3)) % ENDLESS_STAGE_BOSSES.length];
}
/* 보스 체력·공격 보정 (적 배율과 따로 곱한다) */
function endlessBossNorm(spec) {
  return { hp: Math.pow(ENDLESS_BOSS.hp / spec.hp, ENDLESS_BOSS.k), atk: Math.pow(ENDLESS_BOSS.atk / Math.max(1, spec.atk), ENDLESS_BOSS.k) };
}

/* 무한 전장 적 배율: 웨이브마다 곱으로 불어난다. 상한이 없으니 언젠가는 반드시 무너진다. */
const ENDLESS_RAMP = { base: 1.1, lin: 0.03 };
function endlessMul(w) {
  return Math.pow(ENDLESS_RAMP.base, w) * (1 + ENDLESS_RAMP.lin * w);
}

/* 무한 전장 w 번째 웨이브(0부터). t 초에 시작한다.
 * 막 풀린 적 무리 + 예전 적 무리 둘이 함께 오고, 3웨이브마다 보스가 섞인다. */
function endlessWave(w, t) {
  const tier = Math.floor(w / 2);
  const pool = ENDLESS_POOL.filter(e => e.from <= tier);
  const fresh = pool.filter(e => e.from >= tier - 3);
  const a = (fresh.length ? fresh : pool)[(w * 7 + 3) % (fresh.length || pool.length)].id;
  const b = pool[(w * 5 + 1) % pool.length].id;
  const n = 4 + Math.min(8, Math.floor(w / 3));
  const gap = Math.max(0.45, 1.3 - w * 0.03);
  const mul = endlessMul(w);
  const tag = x => Object.assign(x, { wave: w, mul: mul });
  const waves = [tag(W(t, a, n, gap)), tag(W(t + 2, b, Math.ceil(n / 2), gap))];
  if ((w + 1) % ENDLESS_BOSS.every === 0) {
    const k = (w + 1) / ENDLESS_BOSS.every - 1, id = endlessBossAt(k);
    waves.push(tag(W(t + 3, id, 1)));
    if ((w + 1) % ENDLESS_BOSS.pair === 0)            // 보스 둘: 앞서 쓰러뜨린 전장 보스 하나가 함께 돌아온다
      waves.push(tag(W(t + 6, ENDLESS_STAGE_BOSSES[Math.floor(k / 2) % ENDLESS_STAGE_BOSSES.length], 1)));
  }
  return { waves: waves, next: t + Math.max(9, 14 - w * 0.12) };
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
    name: '무한 전장', endless: true, infinite: !waveCount, len: 1250, look: 'endless',
    baseHp: 2000000,           // 4.16: 무너지지 않는다 (끝없는 결계) — 아군 성채가 무너질 때까지
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
  { id: 'first',    name: '첫 승리',      desc: '전장 1개 돌파',        gold: 200,  stone: 1,
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
  { id: 'legend',   name: '신화의 계약',  desc: '전설 이상 병종 보유',              gold: 2000, stone: 2,
    test: s => SEASON_UNITS.some(u => (u.rarity === 'SSR' || u.rarity === 'UR') && s.owned && s.owned[u.id]) },
  { id: 'allseason',name: '세 신화',      desc: '모든 시즌에서 전설 이상을 각각 보유',    gold: 8000, stone: 10,
    test: s => SEASONS.every(sn => sn.units.some(id => {
      const u = UNIT_BY_ID[id];
      return u && (u.rarity === 'SSR' || u.rarity === 'UR') && s.owned && s.owned[id];
    })) },
  { id: 'maxlv',    name: '정예 조련',    desc: '병종 하나를 15레벨로',        gold: 2500, stone: 3,
    test: s => Object.keys(s.levels || {}).some(k => s.levels[k] >= 15) },
  { id:'campaign30',name:'세 신화의 정복자',desc:'30전장 모두 돌파',gold:5000,stone:5,test:s=>s.cleared>=30 },
  { id:'campaign40',name:'심연을 건넌 자',desc:'40전장 모두 돌파',gold:12000,stone:10,test:s=>s.cleared>=40 },
  { id: 'awaken1',  name: '세 번째 모습', desc: '병종 하나를 3진',              gold: 5000, stone: 5,
    test: s => Object.keys(s.evo2 || {}).length >= 1 },
  { id: 'awakenAll', name: '엉뚱한 군대', desc: '3진 10종 모두',                gold: 20000, stone: 15,
    test: s => Object.keys(EVOLUTIONS2).filter(id => !UNIT_BY_ID[id].gacha).every(id => s.evo2 && s.evo2[id] !== undefined) },   // 4.7: 전장 병종 열 (소환 영웅은 따로)
  { id: 'awakenHero', name: '신들의 신형 장비', desc: '소환 영웅 하나를 3진',      gold: 12000, stone: 10,
    test: s => Object.keys(EVOLUTIONS2).some(id => UNIT_BY_ID[id].gacha && s.evo2 && s.evo2[id] !== undefined) },
  { id:'campaign50',name:'하늘에 오른 자',desc:'50전장 모두 돌파 (5막 천공 요새)',gold:20000,stone:15,test:s=>s.cleared>=50 },
  { id:'campaign60',name:'밀림의 왕',desc:'60전장 모두 돌파 (6막 잊힌 밀림)',gold:30000,stone:20,test:s=>s.cleared>=60 },
  { id:'campaign70',name:'숲을 깨운 자',desc:'70전장 모두 돌파 (7막 홀린 요정 숲)',gold:40000,stone:25,test:s=>s.cleared>=70 },
  { id:'campaign80',name:'모래폭풍을 건넌 자',desc:'80전장 모두 돌파 (8막 모래폭풍 사막)',gold:50000,stone:30,test:s=>s.cleared>=80 },
  { id:'campaign90',name:'불의 산맥을 넘은 자',desc:'90전장 모두 돌파 (9막 불의 산맥)',gold:60000,stone:35,test:s=>s.cleared>=90 },
  { id:'trainStop',name:'기관차를 멈춘 자',desc:'도전 \'폭주 기관차\' 돌파',gold:15000,stone:15,test:s=>!!(s.events && s.events.train) },
  { id:'unmasked',name:'가면을 벗긴 자',desc:'도전 \'그림자 가면무도회\' 돌파',gold:15000,stone:15,test:s=>!!(s.events && s.events.masque) },
  { id:'ultimate',name:'궁극에 이른 자',desc:'병종 하나를 4진',gold:30000,stone:20,test:s=>Object.keys(s.evo3 || {}).length >= 1 },
  { id:'timeDefier',name:'시간을 거스른 자',desc:'도전 \'파라오의 모래시계\' 돌파',gold:20000,stone:20,test:s=>!!(s.events && s.events.hourglass) },
  { id: 'endless10',name: '끝없는 전장',  desc: '무한 전장 10웨이브 돌파',       gold: 2000, stone: 3,
    test: s => (s.endlessBest || 0) >= 10 },
  { id: 'endless25',name: '불굴의 성채',  desc: '무한 전장 25웨이브 돌파',       gold: 7000, stone: 8,
    test: s => (s.endlessBest || 0) >= 25 },
  { id: 'hard1',    name: '모진 싸움',    desc: '하드코어 전장 1곳 돌파',         gold: 1000, stone: 2,
    test: s => hardCount(s) >= 1 },
  { id: 'hard10',   name: '강철 의지',    desc: '하드코어 전장 10곳 돌파',        gold: 5000, stone: 5,
    test: s => hardCount(s) >= 10 },
  { id: 'hard30',   name: '꺾이지 않는 왕국', desc: '하드코어 전장 30곳 돌파', gold: 15000, stone: 15,
    test: s => hardCount(s) >= 30 },
  { id: 'hard40',   name: '심연도 꺾지 못한 왕국', desc: '하드코어 전장 40곳 돌파', gold: 40000, stone: 30,
    test: s => hardCount(s) >= 40 },
  { id: 'hard50',   name: '하늘도 꺾지 못한 왕국', desc: '하드코어 전장 50곳 모두 돌파', gold: 60000, stone: 40,
    test: s => hardCount(s) >= 50 },
  { id: 'event1',   name: '극악의 문턱', desc: '이벤트 전장 1곳 돌파',            gold: 3000, stone: 5,
    test: s => eventCount(s) >= 1 },
  { id: 'event5',   name: '마왕을 넘어선 자', desc: '이벤트 전장 5곳 모두 돌파',   gold: 30000, stone: 30,
    test: s => eventCount(s) >= 5 },
  // 5.0 정벌
  { id: 'conq1',    name: '정벌자',      desc: '왕국 정벌을 끝까지 1회',          gold: 3000, stone: 5,
    test: s => !!(s.conqRec && s.conqRec.wins >= 1) },
  { id: 'conq5',    name: '피로 쓴 정벌기', desc: '정벌 단계 5 넘기',             gold: 10000, stone: 12,
    test: s => !!(s.conqRec && s.conqRec.top >= 5) },
  { id: 'conq10',   name: '끝없는 정복', desc: '정벌 단계 10 넘기',              gold: 30000, stone: 30,
    test: s => !!(s.conqRec && s.conqRec.top >= 10) }
];
function hardCount(s) { let n = 0; for (const k in (s.hard || {})) if (s.hard[k]) n++; return n; }

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
             desc: '전투 중 보유할 수 있는 군자금 한도가 늘어납니다.' },
  income:  { name: '세금 징수', max: 10, base: 115, step: 1.52,
             desc: '전투 중 군자금이 차는 속도가 빨라집니다.' },
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
             desc: '병종 레벨 상한 +1/레벨 (최대 25레벨까지)' },
  command: { name: '왕의 명령', max: 5, base: 700, step: 1.8,
             desc: '왕명 재사용 -8초, 회복량 +8%/레벨' }
};

/* 3.6 강화 병영: 중요한 것부터 보이게 늘어놓고, 레벨마다 실제 효과를 숫자로 보여 준다.
 * 숫자는 game.js 의 계산과 같아야 한다 (회귀 테스트가 확인). [이름표, 값] */
const SHOP_ORDER = ['wallet', 'income', 'power', 'vitality', 'castle', 'logistics', 'treasury', 'spoils',
                    'command', 'academy', 'deployment', 'medicine', 'resistance'];
function upgradeEffect(key, lv) {
  lv = lv || 0;
  switch (key) {
    case 'wallet': return ['군자금 한도', String(900 + 260 * lv)];
    case 'income': return ['군자금 수입', '+' + 12 * lv + '%'];
    case 'power': return ['공격력', '+' + 6 * lv + '%'];
    case 'vitality': return ['체력', '+' + 8 * lv + '%'];
    case 'castle': return ['성채 체력', String(Math.round(4000 * (1 + 0.10 * lv)))];
    case 'logistics': return ['쿨타임', '-' + 3 * lv + '%'];
    case 'treasury': return ['시작 군자금', '+' + 60 * lv];
    case 'spoils': return ['처치 골드', '+' + 8 * lv + '%'];
    case 'academy': return ['레벨 상한', String(UNIT_LEVEL_HARD_CAP + lv)];
    case 'command': return ['왕명 재사용', (COMMAND.baseCooldown - COMMAND.cooldownPerLv * lv) + '초'];
    case 'deployment': return ['출진 보호막', String(25 * lv)];
    case 'medicine': return ['회복량', '+' + 6 * lv + '%'];
    case 'resistance': return ['중독·화상 피해', '-' + 5 * lv + '%'];
  }
  return ['', ''];
}

/* 3.6 편성 병종 고르게 훈련: 레벨이 가장 낮은 편성 병종부터 (같으면 싼 것부터) 골드가 닿는 데까지.
 * 실제로 바꾸지 않고 계획만 돌려준다. */
function trainDeckPlan(save) {
  const cap = unitLevelCap(save.cleared, save.upgrades && save.upgrades.academy);
  const levels = Object.assign({}, save.levels);
  const ids = (save.loadout || []).filter(id => UNIT_BY_ID[id]);
  let coins = save.coins || 0, spent = 0, n = 0;
  for (;;) {
    let best = null;
    for (const id of ids) {
      const lv = levels[id] || 1;
      if (lv >= cap) continue;
      if (!best || lv < best.lv || (lv === best.lv && UNIT_BY_ID[id].cost < UNIT_BY_ID[best.id].cost)) best = { id: id, lv: lv };
    }
    if (!best) break;
    const cost = unitTrainCost(UNIT_BY_ID[best.id], best.lv);
    if (coins < cost) break;
    coins -= cost; spent += cost; n++;
    levels[best.id] = best.lv + 1;
  }
  return { levels: levels, spent: spent, n: n };
}

/* 3.6 패배했을 때 무엇을 바꾸면 좋을지. 고정 문구(번역용)로 최대 3개.
 * info: { foePct: 적 요새 남은 %, time: 전투 초, bossAlive, coins } */
function defeatTips(save, stage, info) {
  const tips = [];
  for (const w of deckAdvice(save, stage).warns) {
    if (w.mod) tips.push(STAGE_MODS[w.mod].name + ' · ' + STAGE_MODS[w.mod].counter);
    else tips.push(w.key);
  }
  // 4.8 도전 기믹마다 맞는 요령 (기관차는 쓰러뜨릴 필요가 없다)
  if (stage && stage.bossId === 'irontrain') tips.push('기관차는 싸우지 않습니다 · 둔화(서리 마도사·폭풍술사)와 기절(종지기)로 늦추고 그 사이 요새를 부수세요');
  else if (stage && stage.bossId === 'masklord') tips.push('가장 많이 낸 병종이 봉인되고 그림자로 돌아옵니다 · 비싼 병종을 몰아 내지 말고 고르게 섞으세요');
  else if (info.bossAlive) tips.push('보스가 끝까지 버텼습니다 · 보스에 강한 병종을 넣고 왕명을 보스 앞에서 쓰세요');
  // 4.11 요정 숲: 홀림불은 멀리서 못 쏘고, 나무 정령 · 고목왕은 화상이 붙어야 재생이 멈춘다
  if (stage && stage.waves && stage.waves.some(w => w.e === 'wisp')) tips.push('홀림불은 가까이 가야 보입니다 · 근접 전열을 앞세우고 범위 공격을 챙기세요');
  if (stage && stage.waves && stage.waves.some(w => w.e === 'treant' || w.e === 'eldertree')) tips.push('나무 정령은 화상이 붙어야 재생이 멈춥니다 · 불꽃술사 같은 화상 병종을 넣으세요');
  if (info.foePct > 70) tips.push('적 요새에 거의 닿지 못했습니다 · 무기 연마와 갑옷 강화를 올려 보세요');
  else if (info.time >= 240) tips.push('싸움이 길어지면 적이 억세집니다 · 화력을 더 챙기세요');
  const cheapest = Math.min.apply(null, SHOP_ORDER.slice(0, 5).map(k => (save.upgrades[k] || 0) >= UPGRADES[k].max ? Infinity : upgradeCost(k, save.upgrades[k] || 0)));
  if ((save.coins || 0) >= cheapest) tips.push('지금 골드로 강화 병영·훈련소에서 더 강해질 수 있습니다');
  return tips.slice(0, 3);
}

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
const UNIT_LEVEL_HARD_CAP = 25;   // 4.0: 15 → 20 (사관학교까지 25) — 4막에서 더 키울 자리 · 4.15: 22 (27) — 7막 · 4.20: 25 (30) — 만렙 30 으로 통일
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
/* =======================================================================
 *  레벨 성장 · 진화
 *
 *  레벨이 오르면 체력·공격(과 그것을 따르는 회복·보호막·독 세기)만이 아니라
 *  병종이 하는 일 자체가 좋아진다. 사제는 더 넓게·자주 고치고, 나팔수는 더
 *  세게 불고, 상인은 더 벌고, 사수는 더 멀리 쏜다. 공격하지 않는 병종도
 *  레벨이 헛돌지 않게 하려는 것이다.
 *
 *  레벨 10 이 되면 진화할 수 있다. 진화하면 이름·모습이 바뀌고 능력이
 *  하나 붙거나 바뀐다(체력·공격 +5%). 대신 무언가 하나를 내준다. 진화한 뒤에도 훈련소에서 언제든
 *  기본 형태로 되돌려 쓸 수 있다 — 진화가 늘 정답은 아니다.
 * ======================================================================= */
const EVO_LEVEL = 10;
const EVO_STAT = 1.05;
function evoCost(u) { return Math.round(1200 + (u.cost || 0) * 6); }

/* 진화는 특화다. 좋아지는 것(plus)과 대신 잃는 것(cost)이 함께 온다.
 *  add: 스탯에 더함 · set: 스탯을 바꿈 · ab: 능력에 덧붙임 · mul: 'poison.dps' 처럼 능력 수치를 곱함
 *  cost: 대가. 'interval' 은 스탯, 'ab.heal' 은 능력 수치에 곱한다. 글은 자동으로 붙는다. */
const EVOLUTIONS = {
  // 3.3 3막 병종
  harpoon: { name: '고래잡이', plus: '갈고리 작살 · 둔화 1.8초', ab: { slow: 1.8 }, cost: { interval: 1.12 } },
  corsair: { name: '해적 선장', short: '해적선장', plus: '회피 30% · 쓰러뜨리면 금화', ab: { dodge: 0.3, bounty: { chance: 0.3, gold: 12 } }, cost: { hp: 0.9 } },
  beacon: { name: '대등대지기', short: '대등대', plus: '보호막 180 · 등불이 더 멀리', ab: { barrier: 180, radius: 280 }, cost: { 'ab.interval': 1.15 } },
  stormcaller: { name: '뇌우의 군주', short: '뇌우군주', plus: '벼락이 네 번 튕김', ab: { chain: { n: 4, fall: 0.66, range: 140 } }, cost: { interval: 1.12 } },
  anchorguard: { name: '심해 수호자', short: '심해수호', plus: '근접 피해 15% 반사', ab: { thorns: 0.15 }, cost: { speed: 0.85 } },
  // 4.9 기본 병종 셋
  maceman:     { name: '철퇴 대장', short: '철퇴대장', plus: '기절 30% · 넉백 면역', ab: { stun: { chance: 0.3, dur: 0.8 }, kbImmune: true }, cost: { speed: 0.85 } },
  axethrower:  { name: '쌍도끼 투척병', short: '쌍도끼', plus: '범위 +20 · 공격 15% 빠름', add: { areaRadius: 20 }, set: { interval: 1.1 }, cost: { hp: 0.9 } },
  siegebow:    { name: '연발 발리스타', short: '연발노', plus: '공격 25% 빠름 · 파쇄 1.8배', ab: { breaker: 1.8 }, set: { interval: 1.95 }, cost: { range: 0.9 } },
  spear:   { look: { shape: 'spear_evo', tunic: '#8e2f3a', accent: '#e8c65a', grow: 1.06 }, name: '근위 창병', plus: '사거리 +20 · 찌를 때 적을 밀쳐 냄', add: { range: 20 }, ab: { push: 22 }, cost: { interval: 1.1 } },
  shield:  { name: '철벽 방패병', short: '철벽병', plus: '넉백 면역 · 근접 피해 15% 반사', ab: { kbImmune: true, thorns: 0.15 }, cost: { speed: 0.85 } },
  archer:  { look: { shape: 'archer_evo', tunic: '#2f6a3a', accent: '#9fffb0', grow: 1.08 }, name: '명궁', plus: '치명타 25% (2.2배)', ab: { crit: { chance: 0.25, mul: 2.2 } }, cost: { interval: 1.12 } },
  priest:  { look: { shape: 'priest_evo', tunic: '#f4f1e8', accent: '#ffe28a', grow: 1.08 }, name: '대사제', plus: '치유 범위 +40 · 중독·화상·둔화 정화', ab: { cleanse: true }, abAdd: { radius: 40 }, cost: { 'ab.heal': 0.85 } },
  berserk: { name: '피의 광전사', short: '피광전사', plus: '다칠수록 빨라짐 · 흡혈 15%', ab: { enrage: 1.8, lifesteal: 0.15 }, cost: { hp: 0.9 } },
  venom:   { name: '맹독 궁수', short: '맹독궁수', plus: '독이 주변으로 번짐 (범위 60)', set: { area: true, areaRadius: 60 }, cost: { interval: 1.15 } },
  bomber:  { name: '폭약 장인', short: '폭약장인', plus: '폭발 범위 +40 · 화상', add: { areaRadius: 40 }, ab: { burn: { dps: 30, dur: 3 } }, cost: { atk: 0.85 } },
  merchant:{ name: '왕실 조달관', short: '조달관', plus: '군자금 +40%', mul: { gold: 1.4 }, cost: { hp: 0.8 } },
  knight:  { look: { shape: 'knight_evo', tunic: '#f0e6c8', accent: '#ffe9a0', grow: 1.1 }, name: '성검 기사', short: '성검기사', plus: '범위 +20 · 흡혈 10%', add: { areaRadius: 20 }, ab: { lifesteal: 0.1 }, cost: { interval: 1.1 } },
  frost:   { name: '빙결 마도사', short: '빙결마도', plus: '15% 확률로 얼림 (기절 0.8초)', ab: { stun: { chance: 0.15, dur: 0.8 } }, cost: { 'ab.slow': 0.7 } },
  catapult:{ look: { shape: 'catapult_evo', accent: '#ff8a3c', grow: 1.12 }, name: '화염 투석기', short: '화염투석', plus: '불붙은 바위 · 화상 · 범위 +25', add: { areaRadius: 25 }, ab: { burn: { dps: 35, dur: 4 } }, cost: { interval: 1.15 } },
  duelist: { name: '검성', plus: '체력 15% 이하 적 즉시 처치 (보스 제외)', ab: { execute: 0.15 }, cost: { 'ab.crit.chance': 0.67 } },
  sniper:  { name: '공성 저격수', short: '공성저격', plus: '파쇄 · 보스·중장갑에게 1.6배', ab: { breaker: 1.6 }, cost: { interval: 1.15 } },
  mage:    { look: { shape: 'mage_evo', tunic: '#2a2a6b', accent: '#9ad8ff', grow: 1.12 }, name: '대현자', plus: '기절 확률 30% · 화상', ab: { stun: { chance: 0.3, dur: 1.2 }, burn: { dps: 40, dur: 3 } }, cost: { areaRadius: 0.85 } },
  colossus:{ look: { shape: 'colossus_evo', tunic: '#4a5a6a', accent: '#c9a227', grow: 1.12 }, name: '강철 요새', short: '강철요새', plus: '보호막 +20% · 근접 피해 20% 반사', mul: { barrier: 1.2 }, ab: { thorns: 0.2 }, cost: { speed: 0.85 } },
  necro:   { look: { shape: 'necro_evo', tunic: '#1c1828', accent: '#7fffb0', grow: 1.1 }, name: '사령 군주', short: '사령군주', plus: '해골을 3기씩 소환', ab: { summon: { n: 3 } }, cost: { 'ab.interval': 1.3 } },
  herald:  { name: '전쟁 고수', short: '전쟁고수', plus: '가속에 더해 주변 아군 공격력 +12%', ab: { rally: { atk: 0.12, radius: 240 } }, cost: { 'ab.interval': 1.2 } },
  longbow: { name: '매의 눈', plus: '화살이 줄지어 선 적을 관통', ab: { pierce: true }, cost: { atk: 0.85 } },
  pyro:    { name: '업화술사', short: '업화술사', plus: '화상 +35% · 범위 +20', add: { areaRadius: 20 }, mul: { 'burn.dps': 1.35 }, cost: { atk: 0.85 } },
  paladin: { name: '빛의 수호자', short: '빛수호자', plus: '부활 체력 90% · 주변 보호막 100', ab: { revive: 0.9, barrier: 100 }, cost: { 'ab.heal': 0.6 } },
  engineer:{ name: '요새 공병', short: '요새공병', plus: '방벽을 2개씩 설치', ab: { summon: { n: 2 } }, cost: { 'ab.interval': 1.4 } },
  rogue:   { name: '그림자 도적', short: '그림자', plus: '치명타 35% · 2.6배', ab: { crit: { chance: 0.35, mul: 2.6 } }, cost: { 'ab.lifesteal': 0.5 } },
  runeguard:{ name: '룬 성벽', plus: '넉백 면역 · 보호막 +30%', ab: { kbImmune: true }, mul: { barrier: 1.3 }, cost: { 'ab.radius': 0.85 } },
  musketeer:{ name: '왕실 척탄병', short: '척탄병', plus: '20% 확률로 기절 (0.7초)', ab: { stun: { chance: 0.2, dur: 0.7 } }, cost: { interval: 1.1 } },
  purifier:{ name: '여명의 성녀', short: '여명성녀', plus: '정화할 때 보호막 60', ab: { barrier: 60 }, cost: { 'ab.heal': 0.7 } },
  frostlancer:{ name: '빙하 창기사', short: '빙하창기', plus: '넉백 면역 · 찌를 때 밀쳐 냄', ab: { kbImmune: true, push: 25 }, cost: { 'ab.slow': 0.6 } },

  zeus:    { name: '올림포스의 왕', short: '천공왕', plus: '번개 6번 튕김 · 덜 약해짐', ab: { chain: { n: 6, fall: 0.82 } }, cost: { atk: 0.85 } },
  ares:    { name: '전쟁의 화신', short: '전쟁화신', plus: '넉백 면역 · 광폭화 강화', ab: { kbImmune: true, enrage: 2.0 }, cost: { 'ab.lifesteal': 0.5 } },
  artemis: { name: '달의 여신', short: '달의여신', plus: '달빛 화살 · 둔화 · 치명타 20%', ab: { slow: 1.2, crit: { chance: 0.2, mul: 2 } }, cost: { interval: 1.1 } },
  medusa:  { name: '고르곤 여왕', short: '고르곤', plus: '석화의 시선이 주변으로 퍼짐', set: { area: true, areaRadius: 70 }, cost: { 'ab.stun.chance': 0.6 } },
  spartan: { name: '스파르타 왕', short: '스파르타왕', plus: '주변 아군 공격력 +12% · 반사 15%', ab: { thorns: 0.15, rally: { atk: 0.12, radius: 180 }, interval: 3 }, cost: { atk: 0.85 } },
  thor:    { look: { shape: 'thor_evo', accent: '#9ad8ff', grow: 1.12 }, name: '천둥의 신', short: '천둥신', plus: '묠니르 번개가 2번 튕김', ab: { chain: { n: 2, fall: 0.5, range: 120 } }, cost: { 'ab.breaker': 0.89 } },
  valkyrie:{ name: '발키리 대장', short: '발키리장', plus: '부활 체력 80% · 주변 보호막 90', ab: { revive: 0.8, barrier: 90 }, cost: { 'ab.heal': 0.5 } },
  fenrir:  { name: '종말의 늑대', short: '종말늑대', plus: '치명타 25% · 12% 기절', ab: { crit: { chance: 0.25, mul: 2.2 }, stun: { chance: 0.12, dur: 0.6 } }, cost: { 'ab.lifesteal': 0.6 } },
  viking:  { name: '바이킹 족장', short: '족장', plus: '도끼질이 범위 공격으로', set: { area: true, areaRadius: 70 }, cost: { interval: 1.15 } },
  runeseer:{ name: '룬 현자', plus: '중독·화상·둔화 정화 추가', ab: { cleanse: true }, cost: { 'ab.barrier': 0.8 } },
  anubis:  { name: '명계의 심판자', short: '심판자', plus: '미라를 2기씩 · 사자의 결계 강화', ab: { summon: { n: 2 } }, active: { barrier: 300 }, cost: { 'ab.interval': 1.35 } },
  rapriest:{ name: '태양의 대사제', short: '태양사제', plus: '태양 낙인 (받는 피해 +15%)', ab: { sunmark: { vuln: 0.15, dur: 3 } }, cost: { 'ab.burn.dps': 0.7 } },
  scarab:  { name: '태양 스카라베', short: '태양풍뎅', plus: '군자금 +50% · 때리면 금화', mul: { gold: 1.5 }, ab: { bounty: { chance: 0.2, gold: 8 } }, cost: { hp: 0.8 } },
  desertarcher:{ name: '사막의 매', short: '사막의매', plus: '불화살 · 화상', ab: { burn: { dps: 20, dur: 3 } }, cost: { atk: 0.85 } },
  hoplite: { name: '방진 창병', short: '방진창병', plus: '넉백 면역', ab: { kbImmune: true }, cost: { speed: 0.85 } },
  northarcher:{ name: '서리 궁수', short: '서리궁수', plus: '서리 화살 · 둔화', ab: { slow: 0.8 }, cost: { atk: 0.85 } },
  pharaoh: { name: '불멸 근위대', short: '불멸근위', plus: '한 번 쓰러져도 부활', ab: { revive: 0.5 }, cost: { 'ab.barrier': 0.7 } },
  hades:   { name: '명계의 왕', short: '명계왕', plus: '해골 최대 11 · 명계의 문 강화', ab: { reanimate: { max: 11 } }, active: { mul: 3.0 }, cost: { atk: 0.85 } },
  odin:    { name: '만물의 아버지', short: '만물의부', plus: '지휘 +45% · 범위 확대', ab: { rally: { atk: 0.45, radius: 340 } }, cost: { interval: 1.2 } },
  ra:      { name: '태양의 화신', short: '태양화신', plus: '낙인 피해 +40% · 태양의 심판 강화', ab: { sunmark: { vuln: 0.4 } }, active: { mul: 3.3 }, cost: { atk: 0.85 } },
  persephone:{ name: '명계의 여왕', short: '명계여왕', plus: '회복 +30% · 꽃잎 탄환 둔화', mul: { heal: 1.3 }, ab: { slow: 0.8 }, cost: { atk: 0.7 } },
  skadi:   { name: '겨울의 여왕', short: '겨울여왕', plus: '서리 화살이 관통', ab: { pierce: true }, cost: { 'ab.slow': 0.6 } },
  bastet:  { name: '황금 수호신', short: '황금수호', plus: '치명타 30% · 때리면 금화', ab: { crit: { chance: 0.3, mul: 2.2 }, bounty: { chance: 0.15, gold: 8 } }, cost: { 'ab.lifesteal': 0.5 } },
  gumiho:  { name: '천년 구미호', short: '천년여우', plus: '홀림 확률 35% · 여우 구슬 강화', ab: { charm: { chance: 0.35 } }, active: { charm: 5 }, cost: { areaRadius: 0.8 } },
  saja:    { name: '저승 차사', short: '차사', plus: '명부 26% · 명부 호명 강화', ab: { execute: 0.26 }, active: { execute: 0.42 }, cost: { interval: 1.1 } },
  dokkaebi:{ name: '도깨비 대장', short: '도깨비장', plus: '금 나올 확률 45% · 한 번에 +22', ab: { bounty: { chance: 0.45, gold: 22 } }, cost: { atk: 0.85 } },
  haetae:  { name: '해치 수호왕', short: '수호왕', plus: '근접 피해 45% 반사', ab: { thorns: 0.45 }, cost: { atk: 0.8 } },
  mudang:  { name: '큰무당', plus: '액막이가 주변에 퍼짐 · 적 공격력 -40%', set: { area: true, areaRadius: 60 }, ab: { weaken: { mul: 0.6 } }, cost: { interval: 1.15 } },
  hwarang: { name: '화랑 대장', short: '화랑대장', plus: '흡혈 20% · 치명타 20%', ab: { lifesteal: 0.2, crit: { chance: 0.2, mul: 2 } }, cost: { hp: 0.9 } },
  pojol:   { name: '포도대장', plus: '12% 확률로 기절', ab: { stun: { chance: 0.12, dur: 0.6 } }, cost: { interval: 1.1 } },
  inventor:{ name: '천재 발명가', short: '천재발명', plus: '포탑 최대 4 · 설치가 빨라짐', ab: { summon: { max: 4 }, interval: 6 }, cost: { atk: 0.8 } },
  steammech:{ name: '증기 요새', short: '증기요새', plus: '예열 최대 2.6배 · 넉백 면역', ab: { spinup: { max: 1.6 }, kbImmune: true }, cost: { 'ab.spinup.per': 0.8 } },
  airship: { name: '비행 전함', short: '비행전함', plus: '폭격 범위 +25 · 화상 +40%', add: { areaRadius: 25 }, mul: { 'burn.dps': 1.4 }, cost: { interval: 1.1 } },
  teslaknight:{ name: '번개 기사단장', short: '번개단장', plus: '3번 튕김 · 기절 18%', ab: { chain: { n: 3 }, stun: { chance: 0.18 } }, cost: { atk: 0.9 } },
  clocksoldier:{ name: '태엽 척탄병', short: '태엽척탄', plus: '톱니 폭발 1.7배 · 범위 +30', mul: { 'deathBomb.dmg': 1.7 }, abAdd: { 'deathBomb.radius': 30 }, cost: { hp: 0.85 } },
  mechanic:{ name: '수석 정비공', short: '수석정비', plus: '수리할 때 보호막 70', ab: { barrier: 70 }, cost: { 'ab.heal': 0.7 } },
  rifleman:{ name: '명사수', plus: '치명타 25% (2배)', ab: { crit: { chance: 0.25, mul: 2 } }, cost: { interval: 1.1 } },
  // 3.0 새 전장 병종
  javelin: { name: '중투창병', plus: '투창이 줄지어 선 적을 관통', ab: { pierce: true }, cost: { interval: 1.12 } },
  falconer:{ name: '매사냥 대장', short: '매사냥장', plus: '원거리 적에게 1.9배 · 매 두 마리', ab: { hunter: 1.9 }, cost: { hp: 0.85 } },
  bellringer:{ name: '대성당 종지기', short: '대종지기', plus: '기절 면역 4.5초 · 종소리 보호막 80', ab: { ward: { dur: 4.5 }, barrier: 80 }, cost: { 'ab.heal': 0.5 } },
  lancer:  { name: '성기사단 창기병', short: '성창기병', plus: '돌격 3.4배 · 넉백 면역', ab: { charge: { mul: 3.4 }, kbImmune: true }, cost: { speed: 0.9 } },
  alchemist:{ name: '대연금술사', short: '대연금', plus: '부식 +75% · 범위 +20', add: { areaRadius: 20 }, mul: { 'sunmark.vuln': 1.75 }, cost: { 'ab.poison.dps': 0.6 } },
  monk:    { name: '금강 무승', short: '금강승', plus: '회피 20% · 흡혈 20%', ab: { dodge: 0.2, lifesteal: 0.2 }, cost: { atk: 0.9 } },
  // 4.0 원탁의 기사
  arthur:  { name: '영원한 왕', short: '영원왕', plus: '지휘 +40% · 엑스칼리버 강화', ab: { rally: { atk: 0.4, radius: 300 } }, active: { mul: 3.4 }, cost: { interval: 1.15 } },
  merlin:  { name: '아발론의 현자', short: '현자', plus: '범위 +20 · 시간의 매듭 7초 둔화', add: { areaRadius: 20 }, active: { slow: 7 }, cost: { hp: 0.88 } },
  lancelot:{ name: '무적의 기사', short: '무적기사', plus: '치명타 35% · 흡혈 25%', ab: { crit: { chance: 0.35, mul: 2.2 }, lifesteal: 0.25 }, cost: { hp: 0.9 } },
  morgana: { name: '요정 여왕', short: '요정여왕', plus: '중독 +60% · 둔화 2초', mul: { 'poison.dps': 1.6 }, ab: { slow: 2 }, cost: { interval: 1.12 } },
  tristan: { name: '음유 명궁', short: '음유명궁', plus: '사거리 +60 · 치명타 30%', add: { range: 60 }, ab: { crit: { chance: 0.3, mul: 2.4 } }, cost: { atk: 0.9 } },
  galahad: { name: '성배의 수호자', short: '성배수호', plus: '갑주 40% · 초당 40 회복', ab: { armor: 0.4, regen: 40 }, cost: { speed: 0.85 } },
  // 4.9 벚꽃 전국
  susanoo: { name: '폭풍의 신위', short: '폭풍신위', plus: '범위 +20 · 오로치 베기 강화', add: { areaRadius: 20 }, active: { mul: 3.0 }, cost: { atk: 0.88 } },
  tengu:   { name: '대텐구', short: '대텐구', plus: '회피 35% · 깃털 부채 돌풍 강화', ab: { dodge: 0.35 }, active: { mul: 2.2, push: 160 }, cost: { hp: 0.9 } },
  ninja:   { name: '상급 닌자', short: '상급닌자', plus: '치명타 35% · 달려온 첫 일격 1.8배', ab: { crit: { chance: 0.35, mul: 2.3 }, charge: { dist: 100, mul: 1.8, push: 20 } }, cost: { hp: 0.88 } },
  miko:    { name: '대무녀', short: '대무녀', plus: '회복 +40% · 주변 보호막 70', mul: { heal: 1.4 }, ab: { barrier: 70 }, cost: { atk: 0.8 } },
  samurai: { name: '무사 대장', short: '무사대장', plus: '치명타 30% · 흡혈 12%', ab: { crit: { chance: 0.3, mul: 2 }, lifesteal: 0.12 }, cost: { interval: 1.1 } },
  kyudo:   { name: '궁도 명인', short: '궁도명인', plus: '사거리 +40 · 관통', add: { range: 40 }, ab: { pierce: true }, cost: { interval: 1.12 } },
  ashigaru:{ name: '아시가루 조장', short: '조장', plus: '갑주 20% · 사거리 +10', add: { range: 10 }, ab: { armor: 0.2 }, cost: { atk: 0.9 } },
  // 4.15 삼국지
  guanyu:  { name: '무성 관우', short: '무성', plus: '범위 +20 · 청룡언월 일섬 강화', add: { areaRadius: 20 }, active: { mul: 3.1 }, cost: { atk: 0.88 } },
  zhugeliang:{ name: '와룡 선생', short: '와룡', plus: '바람에 불 · 화상 · 동남풍 강화', ab: { burn: { dps: 40, dur: 3 } }, active: { mul: 2.6, burn: 7 }, cost: { hp: 0.88 } },
  zhaoyun: { name: '상산의 조자룡', short: '조자룡', plus: '회피 30% · 달려온 첫 일격 2.6배', ab: { dodge: 0.3, charge: { mul: 2.6 } }, cost: { hp: 0.9 } },
  zhangfei:{ name: '만인지적', short: '만인적', plus: '기절 25% · 근접 피해 15% 반사', ab: { stun: { chance: 0.25, dur: 0.8 }, thorns: 0.15 }, cost: { speed: 0.88 } },
  huangzhong:{ name: '노익장 신궁', short: '신궁', plus: '사거리 +40 · 치명타 25%', add: { range: 40 }, ab: { crit: { chance: 0.25, mul: 2.2 } }, cost: { interval: 1.1 } },
  tengjia: { name: '남만 등갑대', short: '등갑대', plus: '갑주 50% · 초당 25 회복', ab: { armor: 0.5, regen: 25 }, cost: { atk: 0.85 } },
  jiqiang: { name: '극병 대장', short: '극병장', plus: '사거리 +12 · 갑주 15%', add: { range: 12 }, ab: { armor: 0.15 }, cost: { atk: 0.9 } },
  camelotguard:{ name: '카멜롯 근위대', short: '근위대', plus: '갑주 22% · 회피 15%', ab: { armor: 0.22, dodge: 0.15 }, cost: { atk: 0.9 } },
  // 5.2 천일야화
  genie:   { name: '자유의 마신', short: '자유마신', plus: '소원 +30% · 세 가지 소원 강화 (군자금 +220)', mul: { 'wish.heal': 1.3, 'wish.barrier': 1.3 }, active: { mul: 2.8, gold: 220 }, cost: { atk: 0.88 } },
  sinbad:  { name: '일곱 바다의 영웅', short: '바다영웅', plus: '회피 30% · 범위 +20 · 로크의 습격 강화', add: { areaRadius: 20 }, ab: { dodge: 0.3 }, active: { mul: 2.9, stun: 1.1 }, cost: { hp: 0.9 } },
  carpet:  { name: '바람의 양탄자', short: '바람양탄', plus: '원거리 적에게 2.3배 · 사거리 +30', add: { range: 30 }, ab: { hunter: 2.3 }, cost: { hp: 0.88 } },
  scheherazade:{ name: '천하룻밤의 왕비', short: '이야기왕비', plus: '가속 강화 · 적 공격력 -30%', ab: { haste: { mul: 0.75 }, pacify: { mul: 0.7 } }, cost: { 'ab.interval': 1.12 } },
  scimitar:{ name: '사막의 검무사', short: '검무사', plus: '치명타 30% · 흡혈 10%', ab: { crit: { chance: 0.3, mul: 2.1 }, lifesteal: 0.1 }, cost: { hp: 0.9 } },
  camelarcher:{ name: '사막의 명궁 기병', short: '명궁기병', plus: '사거리 +40 · 치명타 20%', add: { range: 40 }, ab: { crit: { chance: 0.2, mul: 2 } }, cost: { interval: 1.1 } },
  bandit:  { name: '도적단 두목', short: '두목', plus: '금화 확률 25% · 회피 15%', ab: { bounty: { chance: 0.25, gold: 10 }, dodge: 0.15 }, cost: { atk: 0.9 } },
  // 3.0 서유기
  wukong:  { look: { shape: 'wukong_evo', tunic: '#c9a227', accent: '#ffd35a', grow: 1.1 }, name: '투전승불', plus: '분신 최대 6 · 여의봉 강타 강화', ab: { summon: { max: 6 } }, active: { mul: 2.9 }, cost: { atk: 0.85 } },
  nezha:   { name: '삼두육비 나타', short: '삼두육비', plus: '화상 +50% · 혼천릉 강화', mul: { 'burn.dps': 1.5 }, active: { pull: 130, slow: 4 }, cost: { hp: 0.9 } },
  sanzang: { name: '전단공덕불', short: '공덕불', plus: '회복 +30% · 적 공격력 -35%', mul: { heal: 1.3 }, ab: { pacify: { mul: 0.65 } }, cost: { 'ab.interval': 1.15 } },
  bajie:   { name: '정단사자', plus: '포식 25% · 근접 피해 15% 반사', ab: { feast: 0.25, thorns: 0.15 }, cost: { speed: 0.85 } },
  wujing:  { name: '금신나한', plus: '둔화 2초 · 12% 기절', ab: { slow: 2, stun: { chance: 0.12, dur: 0.6 } }, cost: { interval: 1.1 } },
  monkey:  { name: '원숭이 대장', short: '원숭대장', plus: '회피 40% · 치명타 25%', ab: { dodge: 0.4, crit: { chance: 0.25, mul: 2 } }, cost: { hp: 0.85 } },
  celestial:{ name: '천궁 근위병', short: '천궁근위', plus: '갑주 25%', ab: { armor: 0.25 }, cost: { speed: 0.85 } }
};
/* 대가 글에 쓰는 이름 */
const EVO_LABELS = {
  interval: '공격 간격', atk: '공격력', hp: '체력', speed: '이동 속도', areaRadius: '공격 범위',
  'ab.heal': '회복량', 'ab.slow': '둔화 시간', 'ab.stun.chance': '기절 확률', 'ab.lifesteal': '흡혈',
  'ab.barrier': '보호막', 'ab.burn.dps': '화상 피해', 'ab.interval': '능력 주기', 'ab.radius': '능력 범위',
  'ab.crit.chance': '치명타 확률', 'ab.spinup.per': '예열 속도', 'ab.breaker': '파쇄 배율',
  'ab.poison.dps': '중독 피해'
};
function evoCostText(e) {
  return Object.keys(e.cost || {}).map(k => {
    const d = Math.round((e.cost[k] - 1) * 100);
    return (EVO_LABELS[k] || k) + ' ' + (d > 0 ? '+' : '') + d + '%';
  }).join(' · ');
}

/* 진화 망토 색: 근접은 진홍, 원거리는 청람, 지원은 보라 */
function evoCapeColor(u) {
  if (u.ab && (u.ab.noAttack || u.ab.heal || u.ab.barrier || u.ab.haste)) return '#5a2f86';
  return u.ranged ? '#1f4f8a' : '#8a1f2e';
}

function _getPath(o, path) { const k = path.split('.'); for (const p of k) { if (!o) return undefined; o = o[p]; } return o; }
function _setPath(o, path, v) { const k = path.split('.'); for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = v; }
function _r2(v) { return Math.round(v * 100) / 100; }

function applyEvolution(r, e, noCost) {
  r.evo = true;
  r.baseName = r.name;
  r.name = e.name;
  r.short = e.short || e.name;
  r.hp = Math.round(r.hp * EVO_STAT);
  r.atk = Math.round(r.atk * EVO_STAT);
  r.scale = _r2((r.scale || 1) * 1.08);
  r.evoCape = e.cape || evoCapeColor(r);
  r.evoPlus = e.plus;
  r.abText = (r.abText ? r.abText + ' · ' : '') + '✦ ' + e.plus;
  if (e.add) for (const k in e.add) r[k] = (r[k] || 0) + e.add[k];
  if (e.set) Object.assign(r, e.set);
  if (e.ab) {
    r.ab = r.ab || {};
    for (const k in e.ab) {
      const v = e.ab[k];
      r.ab[k] = (v && typeof v === 'object' && r.ab[k] && typeof r.ab[k] === 'object')
        ? Object.assign({}, r.ab[k], v) : (v && typeof v === 'object' ? Object.assign({}, v) : v);
    }
    if (r.ab.summon && !r.ab.summon.id) r.ab.summon.id = 'skeleton';
    if (r.ab.rally && !r.ab.interval) r.ab.interval = 3;
    if (r.ab.barrier && !r.ab.radius) r.ab.radius = 180;
    if (r.ab.barrier && !r.ab.interval) r.ab.interval = 5;
  }
  if (e.mul) for (const k in e.mul) { const v = _getPath(r.ab, k); if (typeof v === 'number') _setPath(r.ab, k, _r2(v * e.mul[k])); }
  if (e.abAdd) for (const k in e.abAdd) { const v = _getPath(r.ab, k); if (typeof v === 'number') _setPath(r.ab, k, v + e.abAdd[k]); }
  if (e.active && r.active) Object.assign(r.active, e.active);
  // 3.4 극적인 진화: 모습 자체가 바뀐다 (다른 그림 · 색 · 몸집)
  if (e.look) {
    r.shape = e.look.shape;
    for (const k of ['body', 'accent', 'tunic']) if (e.look[k]) r[k] = e.look[k];
    r.scale = _r2(r.scale * (e.look.grow || 1));
    r.bigEvo = true;
  }
  if (e.cost && !noCost) for (const k in e.cost) {
    if (k.indexOf('ab.') === 0) { const v = _getPath(r.ab, k.slice(3)); if (typeof v === 'number') _setPath(r.ab, k.slice(3), _r2(v * e.cost[k])); }
    else if (typeof r[k] === 'number') r[k] = k === 'interval' ? _r2(r[k] * e.cost[k]) : Math.round(r[k] * e.cost[k]);
  }
  r.evoMinus = noCost ? '' : evoCostText(e);
}

/* =======================================================================
 *  4.1 3진 (각성). 진화를 마친 병종이 레벨 20 이 되면 한 번 더 바뀐다. (4.3: 여섯 병종만)
 *  2진이 '특화(얻는 것 + 잃는 것)' 였다면 3진은 '완성': 2진의 대가가 사라지고, 체력·공격 ×1.35,
 *  능력이 하나 더 붙고, 모습이 엉뚱하게(그러나 어울리게) 바뀐다 — 투석기가 전차가 되는 식.
 *  대가는 출진 비용 +30% · 출진 쿨타임 +30% 뿐. 진화와 마찬가지로 언제든 기본·진화 형태로 되돌려 쓸 수 있다.
 *  look.shape 는 render.js 의 그림, shot 이 있으면 투사체 모양도 바뀐다.
 *  faster: 공격 간격 배율 (작을수록 빠름)
 * ======================================================================= */
const EVO2_LEVEL = 20;
const EVO2_STAT = 1.35;
const EVO2_STAT_HERO = 1.1;   // 4.7 소환 영웅은 원래 세다 — 3진은 체력·공격보다 능력·필살이 크게 오른다 (전설만 편성이 도전을 쉽게 넘던 것을 막는다)
const EVO2_PRICE = { cost: 1.3, cooldown: 1.3 };
function evo2Cost(u) { return Math.round(5000 + (u.cost || 0) * 25); }
const EVOLUTIONS2 = {
  // 4.3: 전장 병종 모두가 아니라 여섯만 — 대신 모습·움직임·연출을 공들여 만든다.
  //  castFx: 맞힌 자리의 연출 · atkFx: 치는 순간의 연출 · healFx: 치유 연출 · arrive: 출진 연출 · shot: 투사체 모양
  spear:   { look: { shape: 'drillspear', tunic: '#d8742a', accent: '#ffd35a' }, name: '드릴 창병', short: '드릴창',
             plus: '회전 드릴 창 · 파쇄 1.4배 · 공격 15% 빠름 · 갑주 15% · 더 세게 밀쳐 냄', add: { range: 10 }, faster: 0.85, ab: { breaker: 1.4, push: 40, armor: 0.15 },
             castFx: 'drillspark', arrive: 'drill' },
  priest:  { look: { shape: 'ambulance', tunic: '#f6f3ea', accent: '#e8403a', grow: 1.05 }, name: '구급 마차', short: '구급마차',
             plus: '사이렌 · 회복 +40% · 범위 +60 · 정화 · 보호막 60', mul: { heal: 1.4 }, abAdd: { radius: 60 }, ab: { cleanse: true, barrier: 60 },
             healFx: 'siren', arrive: 'siren' },
  catapult:{ look: { shape: 'tank', tunic: '#5f7038', accent: '#ffb03c', grow: 1.05 }, name: '공성 전차', short: '전차',
             plus: '전차 포탑 · 갑주 30% · 넉백 면역 · 화상 · 범위 +30', add: { areaRadius: 30 }, ab: { armor: 0.3, kbImmune: true, burn: { dps: 45, dur: 4 } },
             shot: 'shell', castFx: 'shellblast', atkFx: 'muzzle', arrive: 'tank' },
  mage:    { look: { shape: 'ufo', tunic: '#3a3f8f', accent: '#8affc0', grow: 1.05 }, name: '비행접시 대현자', short: '비행접시',
             plus: '비행접시 광선 · 기절 35% · 화상 · 범위 +20', add: { areaRadius: 20 }, ab: { stun: { chance: 0.35, dur: 1.2 }, burn: { dps: 55, dur: 3 } },
             castFx: 'ufoburst', atkFx: 'ufobeam', arrive: 'ufo' },
  colossus:{ look: { shape: 'megabot', body: '#eef1f8', tunic: '#2f56c8', accent: '#ffd23a', grow: 0.8 }, name: '거대 로봇', short: '거대로봇',
             plus: '로켓 주먹 · 보호막 +40% · 반사 25% · 범위 공격 · 밀쳐 냄', mul: { barrier: 1.4 }, ab: { thorns: 0.25, push: 30 }, set: { area: true, areaRadius: 70 },
             castFx: 'rocketpunch', arrive: 'robot' },
  falconer:{ look: { shape: 'dronepilot', tunic: '#34424f', accent: '#5ad8ff' }, name: '드론 조종사', short: '드론',
             plus: '드론 편대 · 원거리 적에게 2.4배 · 사거리 +60', add: { range: 60 }, ab: { hunter: 2.4 },
             shot: 'drone', castFx: 'dronestrike', arrive: 'drone' },
  // 4.4: 넷 더 — 불도저 · 빙수 수레 · 광선검 · 레일건
  shield:  { look: { shape: 'bulldozer', tunic: '#f0b42a', accent: '#ff8a2a' }, name: '방패 불도저', short: '불도저',
             plus: '불도저 삽 · 갑주 30% · 반사 25% · 밀쳐 냄', ab: { kbImmune: true, armor: 0.3, thorns: 0.25, push: 30 },
             castFx: 'dozerpush', arrive: 'dozer' },
  frost:   { look: { shape: 'icecart', tunic: '#7ac8e8', accent: '#ff8ab0' }, name: '빙수 마도사', short: '빙수마도',
             plus: '눈덩이 폭격 · 범위 70 · 얼림 25% · 둔화 +30%', set: { area: true, areaRadius: 70 },
             ab: { stun: { chance: 0.25, dur: 0.9 } }, mul: { slow: 1.3 }, shot: 'snowball', castFx: 'snowburst', arrive: 'snow' },
  duelist: { look: { shape: 'lightsaber', tunic: '#2a2a3a', accent: '#5ad8ff' }, name: '광선검 검성', short: '광선검',
             plus: '광선검 범위 베기 · 체력 20% 이하 즉시 처치 · 치명타 35% ×2.8', set: { area: true, areaRadius: 55 }, ab: { execute: 0.2, crit: { chance: 0.35, mul: 2.8 } },
             castFx: 'sabercut', arrive: 'saber' },
  sniper:  { look: { shape: 'railgun', tunic: '#2a3a4a', accent: '#5ae8ff' }, name: '레일건 저격수', short: '레일건',
             plus: '레일건 · 관통 · 보스·중장갑에게 2배', ab: { breaker: 2.0 }, shot: 'rail', castFx: 'railhit', atkFx: 'railflash', arrive: 'rail' },
  // 4.7: 소환 영웅도 — 신화 둘 · 전설 둘 · 영웅 둘. 필살(active)도 3진에 맞게 세진다.
  wukong:  { look: { shape: 'mechwukong', tunic: '#c83a2a', accent: '#ffd23a' }, name: '메카 대성', short: '메카대성',
             plus: '근두운 제트 · 확장 여의봉 범위 +35 · 분신 최대 6 · 여의봉 강타 3.1배 · 기절 1.5초 · 분신 3기',
             add: { areaRadius: 35, range: 20 }, ab: { summon: { max: 6 } }, active: { mul: 3.1, stun: 1.5, clones: 3, desc: '가장 가까운 적 주변 피해·1.5초 기절, 분신 3기를 곧바로 부름.' },
             castFx: 'mechstaff', arrive: 'cloudjet' },
  ra:      { look: { shape: 'solarsat', tunic: '#f0e0ae', accent: '#ffca3a' }, name: '태양 위성 라', short: '태양위성',
             plus: '궤도 위성 태양광선 · 낙인 피해 +50% · 화상 2배 · 범위 +25 · 태양의 심판 3.6배',
             add: { areaRadius: 25 }, ab: { sunmark: { vuln: 0.5 } }, mul: { 'burn.dps': 2 }, active: { mul: 3.6, radius: 250 },
             shot: 'solar', castFx: 'solarburn', atkFx: 'solarray', arrive: 'orbit' },
  thor:    { look: { shape: 'thunderbike', tunic: '#8e2f3a', accent: '#7ad8ff', grow: 0.95 }, name: '천둥 라이더', short: '천둥바이크',
             plus: '번개 바이크 돌진 · 달려온 첫 일격 2배 · 번개 4번 튕김 · 묠니르 강타 3.1배',
             ab: { charge: { dist: 140, mul: 2, push: 50 }, chain: { n: 4, fall: 0.6, range: 140 } }, active: { mul: 3.1, stun: 0.9, desc: '가장 가까운 적 주변 충격파 피해·0.9초 기절.' },
             castFx: 'boltstrike', arrive: 'bike' },
  merlin:  { look: { shape: 'holomage', tunic: '#2a2e6b', accent: '#5af0ff' }, name: '홀로그램 대마도사', short: '홀로마도',
             plus: '홀로그램 룬 포격 · 범위 +30 · 둔화 2배 · 기절 20% · 시간의 매듭 2.2초 정지',
             add: { areaRadius: 30 }, mul: { slow: 2 }, ab: { stun: { chance: 0.2, dur: 0.8 } }, active: { stun: 2.2, slow: 8, mul: 2.3, desc: '가장 가까운 적 주변 피해 · 2.2초 정지 · 8초 둔화.' },
             shot: 'holo', castFx: 'holoburst', arrive: 'holo' },
  valkyrie:{ look: { shape: 'jetvalk', tunic: '#3f6bb5', accent: '#ffe48a' }, name: '제트팩 발키리', short: '제트발키리',
             plus: '제트팩 급강하 · 달려온 첫 일격 2.2배 · 이동 +25% · 부활 체력 100% · 주변 보호막 120',
             add: { speed: 14 }, ab: { charge: { dist: 110, mul: 2.2, push: 40 }, revive: 1.0, barrier: 120 },
             castFx: 'divestrike', arrive: 'jetdive' },
  artemis: { look: { shape: 'moonbow', body: '#3a4a5a', tunic: '#3a7a8e', accent: '#a8f0ff' }, name: '달빛 레이저 궁수', short: '레이저궁',
             plus: '초승달 레이저 활 · 관통 · 치명타 25% ×2.4 · 사거리 +40 · 공격 15% 빠름',
             add: { range: 40 }, faster: 0.85, ab: { crit: { chance: 0.25, mul: 2.4 } },
             shot: 'laser', castFx: 'laserhit', atkFx: 'moonflash', arrive: 'moon' },
  // 4.15 삼국지의 신화: 관우가 청룡을 거느린 군신이 된다
  guanyu:  { look: { shape: 'azureguan', tunic: '#1f6a4a', accent: '#5affc0', grow: 0.95 }, name: '청룡 군신', short: '청룡군신',
             plus: '등 뒤를 휘감는 청룡 · 빛의 언월도 범위 +35 · 갑주 25% · 맞은 적 1.5초 둔화 · 청룡언월 일섬 3.4배 · 기절 1.2초',
             add: { areaRadius: 35 }, ab: { armor: 0.25, slow: 1.5 }, active: { mul: 3.4, stun: 1.2, desc: '가장 가까운 적 주변을 청룡과 함께 베어 피해 · 1.2초 기절 · 밀쳐 냄.' },
             castFx: 'dragonslash', arrive: 'dragon' },
  // 4.25 3진이 없던 시즌에 하나씩: 요괴록 · 태엽 공방 · 벚꽃 전국의 신화
  gumiho:  { look: { shape: 'skyfox', body: '#fff4fa', tunic: '#6a2a8a', accent: '#ff8ae0', grow: 1.0 }, name: '천호 여제', short: '천호여제',
             plus: '빛나는 아홉 꼬리 · 큰 여우불 구슬 · 홀림 3.5초 · 사거리 +30 · 범위 +25 · 여우 구슬 2.4배 · 6초 홀림',
             add: { range: 30, areaRadius: 25 }, ab: { charm: { dur: 3.5 } },   // 범위 공격에 튕김을 얹으면 맞은 적마다 튕겨 너무 셌다
             active: { mul: 2.4, charm: 6, radius: 260, desc: '가장 가까운 적 주변 여우 구슬 아홉이 터진다 · 6초 홀림(보스 제외). 성채에는 피해 없음.' },
             shot: 'foxorb', castFx: 'foxstorm', arrive: 'ninetail' },
  inventor:{ look: { shape: 'clockforge', body: '#f0dcb4', tunic: '#5a3b26', accent: '#ffb347', grow: 1.05 }, name: '태엽 신공방', short: '신공방',
             plus: '걷는 태엽 공방 · 테슬라 코일 번개 · 포탑 최대 5 · 5.5초마다 설치 · 사거리 +40 · 과부하 8초 · 범위 +60',
             add: { range: 40 }, ab: { summon: { max: 5 }, interval: 5.5 },
             active: { haste: { mul: 0.45, dur: 8 }, radius: 380, desc: '주변 아군 공격 속도 크게 증가(8초)·기절 해제.' },
             shot: 'teslabolt', castFx: 'teslacoil', arrive: 'forge' },
  susanoo: { look: { shape: 'stormgod', body: '#eef2f6', tunic: '#1e2c5a', accent: '#8ad8ff', grow: 1.0 }, name: '천총운 폭풍신', short: '폭풍신',
             plus: '먹구름을 탄 폭풍신 · 등 뒤의 여덟 머리 큰뱀 그림자 · 천총운검 · 범위 +35 · 갑주 15% · 둔화 1.4초 · 오로치 베기 3.6배',
             add: { areaRadius: 35 }, ab: { slow: 1.4, push: 35, armor: 0.15 },
             active: { mul: 3.6, slow: 6, push: 120, desc: '가장 가까운 적 주변을 천총운검으로 베어 피해 · 6초 둔화 · 크게 밀쳐 냄.' },
             castFx: 'kusanagi', arrive: 'stormcloud' },
  // 5.2 라그나로크의 신화: 만물의 아버지가 여덟 다리 군마 슬레이프니르를 타고 무지개다리를 내려온다
  odin:    { look: { shape: 'sleipnir', body: '#e2c6a8', tunic: '#26446a', accent: '#8ae8ff', grow: 1.0 }, name: '슬레이프니르 기수', short: '슬레이프니르',
             plus: '여덟 다리 군마 · 지휘 +50% · 지휘 범위 380 · 사거리 +30 · 보스·중장갑에게 1.4배 · 줄 선 적을 꿰뚫는 궁니르 · 운명의 룬 보호막 520 · 범위 360',
             add: { range: 30 }, ab: { rally: { atk: 0.5, radius: 380 }, breaker: 1.4 },
             active: { barrier: 520, radius: 360, desc: '주변 아군에게 큰 보호막 · 중독과 화상 정화. 보호막 중첩 없음.' },
             shot: 'gungnir', castFx: 'gungnir', arrive: 'bifrost' },
  // 5.2 등급을 고루: 신화 지니 · 전설 제갈량 · 영웅 도깨비 · 희귀 메두사 · 일반 소총수
  genie:   { look: { shape: 'djinnking', body: '#3a78e8', tunic: '#2a1a6a', accent: '#ffd24a', grow: 1.0 }, name: '마신왕 지니', short: '마신왕',
             plus: '네 팔의 마신왕 · 별을 품은 연기 꼬리 · 램프 불꽃 범위 +30 · 사거리 +30 · 소원 강화 (회복 15% · 보호막 220 · 가속 5초) · 세 가지 소원 3.2배 · 1.4초 기절 · 군자금 +300',
             add: { areaRadius: 30, range: 30 }, ab: { wish: { heal: 0.15, barrier: 220, haste: { mul: 0.7, dur: 5 } } },
             active: { mul: 3.2, stun: 1.4, gold: 300, ally: { barrier: 320, radius: 340 }, desc: '가장 가까운 적 주변 피해 · 1.4초 기절, 주변 아군 큰 보호막, 군자금 +300.' },
             shot: 'djinnorb', castFx: 'djinnblast', arrive: 'lamp' },
  zhugeliang:{ look: { shape: 'bagua', body: '#f0e0c8', tunic: '#f4f0e6', accent: '#ffb04a', grow: 1.0 }, name: '팔진도 와룡', short: '팔진와룡',
             plus: '사륜거 · 등 뒤의 팔괘 · 칠성등 · 바람 칼날 범위 +25 · 사거리 +30 · 둔화 2초 · 동남풍 3배 · 8초 화상 · 팔진에 가둔 적은 3초 동안 홀려 제 편을 친다 (보스 제외)',
             add: { areaRadius: 25, range: 30 }, ab: { slow: 2 },   // 범위 공격에 홀림을 얹으면 맞은 적마다 굴려 만렙에서 너무 셌다 — 팔진(필살)에만
             active: { mul: 3.0, burn: 8, charm: 3, radius: 290, desc: '가장 가까운 적 주변 불바람 피해 · 8초 화상 · 밀쳐 냄 · 팔진에 가둔 적은 3초 홀림 (보스 제외).' },
             shot: 'fanwind', castFx: 'bagua', arrive: 'bagua' },
  dokkaebi:{ look: { shape: 'dokkaebiking', body: '#3f7a5a', tunic: '#c8963a', accent: '#ffd24a', grow: 1.0 }, name: '도깨비 대왕', short: '도깨비왕',
             plus: '금빛 도깨비 방망이 · 도깨비불 · 범위 +25 · 금 나올 확률 55% · 한 번에 +30 · 기절 15%',
             add: { areaRadius: 25 }, ab: { bounty: { chance: 0.55, gold: 30 }, stun: { chance: 0.15, dur: 0.8 } },
             castFx: 'goldbat', arrive: 'wisp' },
  medusa:  { look: { shape: 'gorgon', body: '#6a9a5a', tunic: '#8a6a3a', accent: '#b8ff8a', grow: 1.0 }, name: '석화의 여제', short: '석화여제',
             plus: '뱀 꼬리 · 머리카락은 쉿쉿대는 뱀 · 청동 거울 방패 · 석화의 시선 범위 80 · 석화 30% (1.6초) · 굳은 적은 받는 피해 +20%',
             set: { area: true, areaRadius: 80 }, ab: { stun: { chance: 0.3, dur: 1.6 }, sunmark: { vuln: 0.2, dur: 3 }, petrify: true },
             shot: 'gaze', castFx: 'petrify', arrive: 'snakes' },
  rifleman:{ look: { shape: 'gatling', tunic: '#5a6b3a', accent: '#ffc24a', grow: 1.0 }, name: '개틀링 사수', short: '개틀링',
             plus: '손으로 돌리는 놋쇠 개틀링 · 공격 25% 빠름 · 쏠수록 빨라진다 (최대 1.6배) · 치명타 20%',
             faster: 0.75, ab: { spinup: { per: 0.06, max: 0.6 }, crit: { chance: 0.2, mul: 2 } },
             shot: 'bullet', castFx: 'bulletpuff', atkFx: 'gatling', arrive: 'gatling' }
};

/* 4.4 3진의 시련: 레벨 20 · 금화에 더해 병종마다 다른 조건 둘을 채워야 3진할 수 있다.
 *  speed: 전장(stage 번째, 0부터)을 sec 초 안에 돌파 (전투 시간 기준 — 배속과 상관없다)
 *  series: 계열 병종(ids) 모두 lv 이상 · perfect: 성채 피해 없이 돌파 · stars: 전장 from~to-1 모두 ★3
 *  dmg / heal: 그 병종의 누적 피해 / 치유 · hard: 하드코어 돌파 수 · event: 이벤트 돌파 수 · endless: 무한 전장 최고 웨이브
 *  4.4 이전에 이미 3진한 병종은 그대로 쓴다. */
const EVO2_TRIALS = {
  spear:    [{ t: 'speed', stage: 4, sec: 38 }, { t: 'series', name: '창 계열', ids: ['spear', 'javelin', 'frostlancer', 'lancer'], lv: 18 }],
  priest:   [{ t: 'heal', id: 'priest', n: 1200000 }, { t: 'series', name: '수호 계열', ids: ['priest', 'purifier', 'runeguard', 'bellringer'], lv: 18 }],
  catapult: [{ t: 'speed', stage: 19, sec: 75 }, { t: 'series', name: '화약 계열', ids: ['catapult', 'bomber', 'musketeer', 'engineer'], lv: 18 }],
  mage:     [{ t: 'dmg', id: 'mage', n: 1500000 }, { t: 'series', name: '마법 계열', ids: ['mage', 'frost', 'pyro', 'necro'], lv: 18 }],
  colossus: [{ t: 'hard', n: 5 }, { t: 'perfect', stage: 14 }],
  falconer: [{ t: 'stars', from: 0, to: 20 }, { t: 'series', name: '사냥 계열', ids: ['falconer', 'archer', 'longbow', 'venom'], lv: 18 }],
  shield:   [{ t: 'perfect', stage: 9 }, { t: 'series', name: '철벽 계열', ids: ['shield', 'paladin', 'colossus', 'monk'], lv: 18 }],
  frost:    [{ t: 'speed', stage: 24, sec: 38 }, { t: 'event', n: 1 }],
  duelist:  [{ t: 'speed', stage: 11, sec: 25 }, { t: 'endless', n: 12 }],
  sniper:   [{ t: 'dmg', id: 'sniper', n: 1500000 }, { t: 'speed', stage: 32, sec: 170 }],
  // 4.7 소환 영웅: 등급이 높을수록 조건이 무겁다 (신화 · 전설 · 영웅)
  wukong:   [{ t: 'endless', n: 20 }, { t: 'dmg', id: 'wukong', n: 3000000 }],
  ra:       [{ t: 'hard', n: 25 }, { t: 'stars', from: 40, to: 50 }],
  thor:     [{ t: 'speed', stage: 42, sec: 95 }, { t: 'dmg', id: 'thor', n: 2000000 }],
  merlin:   [{ t: 'perfect', stage: 45 }, { t: 'event', n: 4 }],
  valkyrie: [{ t: 'speed', stage: 27, sec: 64 }, { t: 'perfect', stage: 29 }],
  artemis:  [{ t: 'series', name: '활 계열', ids: ['artemis', 'archer', 'longbow', 'venom'], lv: 20 }, { t: 'dmg', id: 'artemis', n: 1500000 }],
  guanyu:   [{ t: 'stars', from: 60, to: 70 }, { t: 'dmg', id: 'guanyu', n: 3500000 }],   // 4.15
  // 4.25 시즌 신화 셋
  gumiho:   [{ t: 'event', n: 5 }, { t: 'dmg', id: 'gumiho', n: 2500000 }],
  inventor: [{ t: 'endless', n: 22 }, { t: 'series', name: '태엽 공방', ids: ['inventor', 'steammech', 'airship', 'teslaknight'], lv: 22 }],
  susanoo:  [{ t: 'hard', n: 30 }, { t: 'dmg', id: 'susanoo', n: 3500000 }],
  // 5.2
  odin:     [{ t: 'hard', n: 20 }, { t: 'series', name: '라그나로크', ids: ['odin', 'thor', 'valkyrie', 'skadi'], lv: 24 }],
  genie:    [{ t: 'event', n: 5 }, { t: 'dmg', id: 'genie', n: 3000000 }],
  zhugeliang:[{ t: 'hard', n: 15 }, { t: 'dmg', id: 'zhugeliang', n: 2000000 }],
  dokkaebi: [{ t: 'perfect', stage: 22 }, { t: 'series', name: '요괴록', ids: ['dokkaebi', 'haetae', 'mudang', 'hwarang'], lv: 20 }],
  medusa:   [{ t: 'stars', from: 20, to: 30 }, { t: 'series', name: '올림포스', ids: ['medusa', 'spartan', 'hoplite', 'artemis'], lv: 20 }],
  rifleman: [{ t: 'dmg', id: 'rifleman', n: 800000 }, { t: 'series', name: '태엽 공방', ids: ['rifleman', 'clocksoldier', 'mechanic', 'teslaknight'], lv: 18 }]
};
function _trialNum(n) { return n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : String(Math.round(n)); }
/* 시련 하나의 진행: { done, text(조건), prog(지금 상태) } */
function trialState(s, c) {
  s = s || {};
  const lv = id => (s.levels && s.levels[id]) || 1;
  const life = id => (s.life && s.life[id]) || {};
  switch (c.t) {
    case 'speed': {
      const b = s.best && s.best[c.stage];
      return { done: b !== undefined && b <= c.sec, text: '전장 ' + (c.stage + 1) + ' 돌파 · ' + c.sec + '초 안에', prog: b !== undefined ? '최고 ' + Math.ceil(b) + '초' : '기록 없음' };
    }
    case 'series': {
      const k = c.ids.filter(id => lv(id) >= c.lv).length;
      return { done: k === c.ids.length, text: c.name + ' (' + c.ids.map(id => UNIT_BY_ID[id].name).join(' · ') + ') 모두 Lv ' + c.lv, prog: k + ' / ' + c.ids.length };
    }
    case 'perfect': {
      const ok = !!(s.perfect && s.perfect[c.stage]);
      return { done: ok, text: '전장 ' + (c.stage + 1) + ' 돌파 · 성채 100%', prog: ok ? '완료' : '아직' };
    }
    case 'stars': {
      let k = 0; for (let i = c.from; i < c.to; i++) if (s.stars && s.stars[i] >= 3) k++;
      return { done: k === c.to - c.from, text: '전장 ' + (c.from + 1) + '~' + c.to + ' 모두 ★3', prog: k + ' / ' + (c.to - c.from) };
    }
    case 'dmg': case 'heal': {
      const v = life(c.id)[c.t === 'dmg' ? 'd' : 'h'] || 0;
      return { done: v >= c.n, text: UNIT_BY_ID[c.id].name + (c.t === 'dmg' ? ' 누적 피해 ' : ' 누적 치유 ') + _trialNum(c.n), prog: _trialNum(Math.min(v, c.n)) + ' / ' + _trialNum(c.n) };
    }
    case 'hard': {
      const k = s.hard ? Object.keys(s.hard).filter(i => s.hard[i]).length : 0;
      return { done: k >= c.n, text: '하드코어 ' + c.n + '곳 돌파', prog: Math.min(k, c.n) + ' / ' + c.n };
    }
    case 'event': {
      const k = s.events ? Object.keys(s.events).filter(i => s.events[i] > 0).length : 0;
      return { done: k >= c.n, text: '이벤트 전장 ' + c.n + '곳 돌파', prog: Math.min(k, c.n) + ' / ' + c.n };
    }
    case 'endless': {
      const b = s.endlessBest || 0;
      return { done: b >= c.n, text: '무한 전장 ' + c.n + '웨이브', prog: '최고 ' + b + '웨이브' };
    }
  }
  return { done: true, text: '', prog: '' };
}
function evo2Trials(s, id) { return (EVO2_TRIALS[id] || []).map(c => Object.assign({ c: c }, trialState(s, c))); }
function evo2TrialsDone(s, id) { return evo2Trials(s, id).every(x => x.done); }
function _mergeAb(r, src) {
  r.ab = r.ab || {};
  for (const k in src) {
    const v = src[k];
    r.ab[k] = (v && typeof v === 'object' && r.ab[k] && typeof r.ab[k] === 'object')
      ? Object.assign({}, r.ab[k], v) : (v && typeof v === 'object' ? Object.assign({}, v) : v);
  }
}
function applyEvo2(r, e) {
  r.evo2 = true;
  r.name = e.name;
  r.short = e.short || e.name;
  const st = r.gacha ? EVO2_STAT_HERO : EVO2_STAT;
  r.hp = Math.round(r.hp * st);
  r.atk = Math.round(r.atk * st);
  r.cost = Math.round(r.cost * EVO2_PRICE.cost / 5) * 5;
  if (r.cooldown) r.cooldown = _r2(r.cooldown * EVO2_PRICE.cooldown);
  r.evoPlus = e.plus;
  r.abText = (r.abText ? r.abText + ' · ' : '') + '✪ ' + e.plus;
  if (e.add) for (const k in e.add) r[k] = (r[k] || 0) + e.add[k];
  if (e.set) Object.assign(r, e.set);
  if (e.faster) r.interval = _r2(r.interval * e.faster);
  if (e.ab) _mergeAb(r, e.ab);
  if (e.mul) for (const k in e.mul) { const v = _getPath(r.ab, k); if (typeof v === 'number') _setPath(r.ab, k, _r2(v * e.mul[k])); }
  if (e.abAdd) for (const k in e.abAdd) { const v = _getPath(r.ab, k); if (typeof v === 'number') _setPath(r.ab, k, v + e.abAdd[k]); }
  if (e.look) {
    r.shape = e.look.shape;
    for (const k of ['body', 'accent', 'tunic']) if (e.look[k]) r[k] = e.look[k];
    r.scale = _r2((r.base && r.base.scale || 1) * 1.12 * (e.look.grow || 1));
    r.bigEvo = true;
  }
  if (e.shot) r.shot = e.shot;
  if (e.castFx) r.castFx = e.castFx;
  if (e.atkFx) r.atkFx = e.atkFx;
  if (e.healFx) r.healFx = e.healFx;
  if (e.arrive) r.arrive = e.arrive;
  if (e.active && r.active) Object.assign(r.active, e.active);   // 4.7 소환 영웅의 필살도 세진다
  r.evoMinus = '출진 비용 +' + Math.round((EVO2_PRICE.cost - 1) * 100) + '% · 쿨타임 +' + Math.round((EVO2_PRICE.cooldown - 1) * 100) + '%';
}

/* =======================================================================
 *  4.18 4진 (궁극). 3진을 마친 병종 가운데 둘만 — 레벨 25(사관학교로 연 상한)에서 한 번 더.
 *  3진 위에 얹는다. 체력·공격이 다시 오르고(영웅 ×1.15 · 전장 병종 ×1.3) 능력이 크게 바뀐다.
 *  대가: 출진 비용 · 쿨타임 +15% (3진 대가 위에). 시련 둘. 기본 · 진화 · 3진 · 4진 어느 형태로든 되돌려 쓸 수 있다.
 * ======================================================================= */
const EVO3_LEVEL = 25;
const EVO3_STAT = 1.3, EVO3_STAT_HERO = 1.15;
const EVO3_PRICE = { cost: 1.15, cooldown: 1.15 };
function evo3Cost(u) { return Math.round(30000 + (u.cost || 0) * 60); }
const EVOLUTIONS3 = {
  // 멀린: 다시 마법사의 모습으로 — 별빛 로브 · 초승달 모자 · 은하를 담은 수정 지팡이. 돕는 법사이자 딜러.
  merlin:  { look: { shape: 'starmerlin', body: '#ece6f4', tunic: '#1c1f5a', accent: '#ffd76a', grow: 1.05 }, name: '별의 대현자 멀린', short: '별의대현자',
             plus: '별똥별 포격 · 범위 +35 · 사거리 +40 · 공격 20% 빠름 · 별빛이 3번 튕김 · 별의 낙인 (받는 피해 +20%) · 주변 아군 공격력 +12% · 별의 심판 4.2배 · 2.6초 정지 · 주변 아군 보호막 · 가속',
             add: { areaRadius: 35, range: 40 }, faster: 0.8,
             ab: { chain: { n: 3, fall: 0.5, range: 160 }, sunmark: { vuln: 0.2, dur: 3 }, rally: { atk: 0.12, radius: 260 }, stun: { chance: 0.25, dur: 0.9 } },
             active: { name: '별의 심판', kind: 'astral', mul: 4.2, stun: 2.6, slow: 8, radius: 290, ally: { barrier: 260, haste: { mul: 0.7, dur: 6 }, radius: 340 },
                       desc: '하늘에서 별을 떨어뜨려 가장 가까운 적 주변에 큰 피해 · 2.6초 정지 · 8초 둔화, 주변 아군에게 보호막과 6초 가속.' },
             shot: 'star', castFx: 'starfall', atkFx: 'starsigil', arrive: 'stargate' },
  // 공성 전차: 미래 무기를 단 반중력 전차 — 쌍열 플라즈마 포 · 측면 미사일 포드 · 근접 방어 레이저 · 에너지 방벽.
  catapult:{ look: { shape: 'hovertank', body: '#dfe6ee', tunic: '#3a4a5e', accent: '#5ad8ff', grow: 1.05 }, name: '플라즈마 기동전차', short: '플라즈마전차',
             plus: '반중력 부양 · 쌍열 플라즈마 포 범위 +30 · 사거리 +60 · 공격 15% 빠름 · 플라즈마 화상 · 보스·중장갑에게 1.5배 · 세 번째 포격마다 미사일 4발 · 갑주 45% · 초당 60 수리',
             add: { areaRadius: 30, range: 60 }, faster: 0.85,
             ab: { armor: 0.45, regen: 60, burn: { dps: 90, dur: 4 }, breaker: 1.5, salvo: { every: 3, n: 4, mul: 0.55, radius: 60 } },
             shot: 'plasma', castFx: 'plasmablast', atkFx: 'plasmamuzzle', arrive: 'hoverdrop' },
  // 5.2 오딘: 세계수 앞에 선 만물의 아버지 — 전군을 북돋우고 지키며, 뿌리로 적을 친다
  odin:    { look: { shape: 'yggodin', body: '#e2c6a8', tunic: '#1a2450', accent: '#ffe08a', grow: 1.05 }, name: '세계수의 만물부', short: '세계수',
             plus: '등 뒤의 세계수 광배 · 룬 고리 · 지휘 +55% · 지휘 범위 440 · 주변 아군 기절 · 둔화를 풀고 1.5초 기절 면역 · 사거리 +40 · 룬 낙인 (받는 피해 +15%) · 세계수의 심판 3.4배 · 1.6초 정지 · 주변 아군 큰 보호막 · 가속 · 정화',
             add: { range: 40 }, ab: { rally: { atk: 0.55, radius: 440 }, ward: { dur: 1.5 }, radius: 360, sunmark: { vuln: 0.15, dur: 3 } },
             active: { name: '세계수의 심판', kind: 'yggdrasil', barrier: 0, mul: 3.4, stun: 1.6, radius: 300, ally: { barrier: 620, haste: { mul: 0.72, dur: 6 }, radius: 440, cleanse: true },
                       desc: '가장 가까운 적 주변을 세계수의 뿌리로 쳐 큰 피해 · 1.6초 정지, 주변 아군에게 큰 보호막과 6초 가속 · 독 · 화상 정화.' },
             shot: 'worldrune', castFx: 'yggdrasil', atkFx: 'yggsigil', arrive: 'worldtree' }
};
const EVO3_TRIALS = {
  merlin:   [{ t: 'event', n: 6 }, { t: 'dmg', id: 'merlin', n: 6000000 }],
  catapult: [{ t: 'stars', from: 70, to: 80 }, { t: 'dmg', id: 'catapult', n: 8000000 }],
  odin:     [{ t: 'hard', n: 45 }, { t: 'endless', n: 28 }]   // 5.2
};
function evo3Trials(s, id) { return (EVO3_TRIALS[id] || []).map(c => Object.assign({ c: c }, trialState(s, c))); }
function evo3TrialsDone(s, id) { return evo3Trials(s, id).every(x => x.done); }
function applyEvo3(r, e) {
  r.evo3 = true;
  r.name = e.name;
  r.short = e.short || e.name;
  const st = r.gacha ? EVO3_STAT_HERO : EVO3_STAT;
  r.hp = Math.round(r.hp * st);
  r.atk = Math.round(r.atk * st);
  r.cost = Math.round(r.cost * EVO3_PRICE.cost / 5) * 5;
  if (r.cooldown) r.cooldown = _r2(r.cooldown * EVO3_PRICE.cooldown);
  r.evoPlus = e.plus;
  r.abText = (r.base.abText ? r.base.abText + ' · ' : '') + '✸ ' + e.plus;
  if (e.add) for (const k in e.add) r[k] = (r[k] || 0) + e.add[k];
  if (e.faster) r.interval = _r2(r.interval * e.faster);
  if (e.ab) _mergeAb(r, e.ab);
  if (e.look) {
    r.shape = e.look.shape;
    for (const k of ['body', 'accent', 'tunic']) if (e.look[k]) r[k] = e.look[k];
    r.scale = _r2((r.base && r.base.scale || 1) * 1.16 * (e.look.grow || 1));
    r.bigEvo = true;
  }
  for (const k of ['shot', 'castFx', 'atkFx', 'healFx', 'arrive']) if (e[k]) r[k] = e[k];
  if (e.active && r.active) Object.assign(r.active, e.active);
  r.evoMinus = '출진 비용 +' + Math.round((EVO2_PRICE.cost * EVO3_PRICE.cost - 1) * 100) + '% · 쿨타임 +' + Math.round((EVO2_PRICE.cooldown * EVO3_PRICE.cooldown - 1) * 100) + '%';
}

/* 레벨이 오를 때 체력·공격 말고 좋아지는 것들. k = 레벨 - 1 */
function growUnit(r, lv) {
  const k = Math.max(0, (lv || 1) - 1);
  if (!k) return;
  const ab = r.ab;
  if (r.ranged && r.range) r.range = Math.round(r.range * (1 + 0.008 * k));
  if (!ab) return;
  const support = ab.heal || ab.barrier || ab.haste || ab.cleanse || ab.rally || ab.summon || ab.ward || ab.pacify || ab.wish;
  if (support && ab.interval) ab.interval = _r2(ab.interval * Math.max(0.7, 1 - 0.02 * k));
  if (ab.radius) ab.radius = Math.round(ab.radius * (1 + 0.015 * k));
  if (ab.haste) ab.haste = { mul: _r2(Math.max(0.5, ab.haste.mul - 0.008 * k)), dur: _r2(ab.haste.dur + 0.1 * k) };
  if (ab.rally) ab.rally = { atk: _r2(ab.rally.atk + 0.01 * k), radius: Math.round(ab.rally.radius * (1 + 0.015 * k)) };
  if (ab.gold) ab.gold = _r2(ab.gold * (1 + 0.06 * k));
  if (typeof ab.slow === 'number') ab.slow = _r2(ab.slow * (1 + 0.03 * k));
  if (ab.stun) ab.stun = { chance: _r2(Math.min(ab.stun.chance + 0.12, ab.stun.chance + 0.008 * k)), dur: ab.stun.dur };
  if (ab.crit) ab.crit = { chance: _r2(Math.min(0.6, ab.crit.chance + 0.008 * k)), mul: ab.crit.mul };
  if (ab.poison) ab.poison = { dps: ab.poison.dps, dur: _r2(ab.poison.dur + 0.1 * k) };
  if (ab.burn) ab.burn = { dps: ab.burn.dps, dur: _r2(ab.burn.dur + 0.08 * k) };
  if (ab.charm) ab.charm = { chance: _r2(Math.min(0.6, ab.charm.chance + 0.006 * k)), dur: ab.charm.dur };
  if (ab.weaken) ab.weaken = { mul: _r2(Math.max(0.5, ab.weaken.mul - 0.006 * k)), dur: ab.weaken.dur };
  if (ab.execute) ab.execute = _r2(Math.min(0.5, ab.execute + 0.004 * k));
  if (ab.bounty) ab.bounty = { chance: _r2(Math.min(0.8, ab.bounty.chance + 0.01 * k)), gold: ab.bounty.gold };
  if (ab.lifesteal) ab.lifesteal = _r2(ab.lifesteal + 0.004 * k);
  if (ab.thorns) ab.thorns = _r2(ab.thorns + 0.01 * k);
  if (ab.revive) ab.revive = _r2(Math.min(1, ab.revive + 0.02 * k));
  if (ab.chain) ab.chain = Object.assign({}, ab.chain, { fall: _r2(Math.min(0.95, ab.chain.fall + 0.008 * k)) });
  if (ab.spinup) ab.spinup = { per: ab.spinup.per, max: _r2(ab.spinup.max + 0.03 * k) };
  if (ab.deathBomb) ab.deathBomb = { dmg: ab.deathBomb.dmg, radius: Math.round(ab.deathBomb.radius + 1.5 * k) };
  if (ab.reanimate) ab.reanimate = Object.assign({}, ab.reanimate, { max: ab.reanimate.max + Math.floor(k / 3) });
  if (ab.sunmark) ab.sunmark = { vuln: _r2(ab.sunmark.vuln + 0.006 * k), dur: ab.sunmark.dur };
  // 3.0
  if (ab.hunter) ab.hunter = _r2(ab.hunter + 0.01 * k);
  if (ab.ward) ab.ward = { dur: _r2(ab.ward.dur + 0.05 * k) };
  if (ab.charge) ab.charge = Object.assign({}, ab.charge, { mul: _r2(ab.charge.mul + 0.03 * k) });
  if (ab.dodge) ab.dodge = _r2(Math.min(0.5, ab.dodge + 0.004 * k));
  if (ab.feast) ab.feast = _r2(ab.feast + 0.003 * k);
  if (ab.pacify) ab.pacify = { mul: _r2(Math.max(0.5, ab.pacify.mul - 0.005 * k)), dur: ab.pacify.dur };
  if (ab.summon && ab.summon.life) ab.summon = Object.assign({}, ab.summon, { life: _r2(ab.summon.life + 0.1 * k) });
}

/* 병종이 하는 일을 숫자로. 훈련소가 레벨마다 무엇이 오르는지 보여 줄 때 쓴다.
 * pw: 레벨·강화 배율 — 회복·보호막·독·화상 세기는 공격 배율을 따른다. */
const STAT_LABELS = {
  heal: '회복', barrier: '보호막', radius: '효과 범위', interval: '능력 주기', haste: '가속',
  rally: '지휘', gold: '군자금', poison: '중독', burn: '화상', slow: '둔화', stun: '기절',
  crit: '치명타', lifesteal: '흡혈', charm: '홀림', execute: '명부', bounty: '금화', thorns: '반사',
  revive: '부활', chain: '연쇄', summon: '소환', spinup: '예열', weaken: '액막이', sunmark: '낙인',
  reanimate: '해골', range: '사거리', sec: '초', perSec: '/초', times: '번', max: '최대',
  hunter: '사냥', ward: '기절 면역', charge: '돌격', dodge: '회피', feast: '포식', pacify: '독경',
  armor: '갑주', life: '유지', vanguard: '선봉', wish: '소원'
};
function unitRoleStats(r, pw) {
  const ab = r.ab || {}, L = STAT_LABELS, out = [];
  const pct = v => Math.round(v * 100) + '%';
  const support = ab.heal || ab.barrier || ab.haste || ab.cleanse || ab.rally || ab.summon || ab.ward || ab.pacify || ab.wish;
  if (ab.heal) out.push([L.heal, Math.round(ab.heal * pw)]);
  if (ab.wish) out.push([L.wish, pct(ab.wish.heal) + ' · ' + Math.round(ab.wish.barrier * pw) + ' · -' + pct(1 - ab.wish.haste.mul)]);
  if (ab.barrier) out.push([L.barrier, Math.round(ab.barrier * pw)]);
  if (ab.haste) out.push([L.haste, '-' + pct(1 - ab.haste.mul) + ' · ' + ab.haste.dur + L.sec]);
  if (ab.rally) out.push([L.rally, '+' + pct(ab.rally.atk)]);
  if (ab.gold) out.push([L.gold, '+' + ab.gold + L.perSec]);
  if (ab.summon) out.push([L.summon, (ab.summon.n || 1) + (ab.summon.max ? ' · ' + L.max + ' ' + ab.summon.max : '')]);
  if (ab.radius && support) out.push([L.radius, ab.radius]);
  if (ab.interval && support) out.push([L.interval, ab.interval + L.sec]);
  if (ab.poison) out.push([L.poison, Math.round(ab.poison.dps * pw) + L.perSec + ' · ' + ab.poison.dur + L.sec]);
  if (ab.burn) out.push([L.burn, Math.round(ab.burn.dps * pw) + L.perSec + ' · ' + ab.burn.dur + L.sec]);
  if (typeof ab.slow === 'number') out.push([L.slow, ab.slow + L.sec]);
  if (ab.stun) out.push([L.stun, pct(ab.stun.chance)]);
  if (ab.crit) out.push([L.crit, pct(ab.crit.chance) + ' ×' + ab.crit.mul]);
  if (ab.lifesteal) out.push([L.lifesteal, pct(ab.lifesteal)]);
  if (ab.charm) out.push([L.charm, pct(ab.charm.chance)]);
  if (ab.execute) out.push([L.execute, pct(ab.execute)]);
  if (ab.bounty) out.push([L.bounty, pct(ab.bounty.chance) + ' · +' + ab.bounty.gold]);
  if (ab.thorns) out.push([L.thorns, pct(ab.thorns)]);
  if (ab.revive) out.push([L.revive, pct(ab.revive)]);
  if (ab.chain) out.push([L.chain, ab.chain.n + L.times]);
  if (ab.spinup) out.push([L.spinup, '×' + (1 + ab.spinup.max).toFixed(1)]);
  if (ab.weaken) out.push([L.weaken, '-' + pct(1 - ab.weaken.mul)]);
  if (ab.sunmark) out.push([L.sunmark, '+' + pct(ab.sunmark.vuln)]);
  if (ab.reanimate) out.push([L.reanimate, L.max + ' ' + ab.reanimate.max]);
  if (ab.summon && ab.summon.life) out.push([L.life, ab.summon.life + L.sec]);
  if (ab.hunter) out.push([L.hunter, '×' + ab.hunter]);
  if (ab.ward) out.push([L.ward, ab.ward.dur + L.sec]);
  if (ab.charge) out.push([L.charge, '×' + ab.charge.mul]);
  if (ab.dodge) out.push([L.dodge, pct(ab.dodge)]);
  if (ab.feast) out.push([L.feast, pct(ab.feast)]);
  if (ab.pacify) out.push([L.pacify, '-' + pct(1 - ab.pacify.mul)]);
  if (ab.armor) out.push([L.armor, pct(ab.armor)]);
  if (ab.vanguard) out.push([L.vanguard, '-' + pct(ab.vanguard.cut) + ' · ' + ab.vanguard.r]);
  return out;
}

/* 레벨·진화를 반영한 병종. 전투·카드·훈련소가 모두 이것을 본다. */
const _resolved = {};
/* 3.4 영웅의 체급. 전설·신화는 역할로 값을 하되, 몸집과 힘도 일반 병사보다 한 수 위여야 한다.
 * 근접 영웅은 앞에서 맞으며 싸우니 체력과 갑주를 더 받는다(예전엔 뭘 해 보기도 전에 쓰러졌다). */
const HERO_POWER = { UR: { hp: 1.35, atk: 1.2 }, SSR: { hp: 1.25, atk: 1.15 } };
/* 3.9 근접 영웅은 '선봉': 맞아도 버티고(갑주·체력·흡혈) 곁의 아군도 지킨다(선봉 — 주변 아군이 받는 피해 -10%).
 * 3.4 의 체력 ×1.3 · 갑주 +10% 로는 여전히 원거리 영웅보다 훨씬 자주 쓰러졌다. */
const HERO_MELEE = { hp: 1.55, armor: 0.3, revive: 0.4, lifesteal: 0.12, vanguard: { r: 160, cut: 0.1 } };
/* 4.24 근접 병종 보강 · 탈것 속도.
 * - 근접 병종(아군 · 비용 있는 것)이 체력 · 갑주가 얇아 앞에서 아무것도 못 하고 녹았다 → 체력을 올리되 얇을수록 크게(최대 ×1.5),
 *   갑주 +0.1 (최대 0.5). 원래 체력이 아주 큰 근접(만렙 1.5만 이상: 거대 로봇 · 심해 수호자 · 신화 영웅 등)은 그 대가로 공격 −15%.
 * - 탈것 · 날것인데 걸어가는 병사보다 느리던 모습들: 바이크 · 말 · 비행접시 · 근두운 · 위성 등은 모습에 맞게 빠르게 (느려지지는 않는다) */
const FRONTLINE = { maxBoost: 0.5, refHp: 14000, armor: 0.1, bigHp: 15000, bigAtk: 0.85 };
const SHAPE_SPEED = { sleipnir: 64, bagua: 38, djinnking: 36, thunderbike: 72, knight_evo: 52, unicorn: 60, ufo: 44, hovertank: 32, solarsat: 38, mechwukong: 66, jetvalk: 80,
                      icecart: 40, ambulance: 46, azureguan: 48, stormgod: 62, clockforge: 34, skyfox: 40, airship: 40, railgun: 22, megabot: 22, tank: 26, nezha: 100 };
function frontlineBuild(r) {
  if (r.enemy) return;
  const sp = SHAPE_SPEED[r.shape];
  if (sp && r.speed < sp) r.speed = sp;
  if (r.ranged || !(r.cost > 0) || !(r.speed > 0)) return;          // 소환물 · 건물 · 원거리는 그대로
  const full = r.hp * unitLevelMul(30);                              // 만렙 기준으로 얇은지 두꺼운지 본다 (레벨마다 갈리지 않게)
  const boost = 1 + FRONTLINE.maxBoost * Math.max(0, 1 - full / FRONTLINE.refHp);
  if (full >= FRONTLINE.bigHp && r.atk > 0) r.atk = Math.round(r.atk * FRONTLINE.bigAtk);
  r.hp = Math.round(r.hp * boost);
  r.ab = r.ab ? r.ab : {};
  r.ab.armor = _r2(Math.min(0.5, (r.ab.armor || 0) + FRONTLINE.armor));
}
function heroBuild(r) {
  const p = r.gacha && HERO_POWER[r.rarity];
  if (!p) return;
  r.hp = Math.round(r.hp * p.hp);
  r.atk = Math.round(r.atk * p.atk);
  if (!r.ranged && r.atk > 0) {
    r.hp = Math.round(r.hp * HERO_MELEE.hp);
    r.ab = r.ab || {};
    r.ab.armor = _r2(Math.min(0.5, (r.ab.armor || 0) + HERO_MELEE.armor));
    r.ab.kbImmune = true;                       // 앞에서 버티는 영웅은 밀려나지 않는다
    r.ab.revive = Math.max(r.ab.revive || 0, HERO_MELEE.revive);   // 불굴: 한 번은 다시 일어난다
    r.ab.lifesteal = Math.max(r.ab.lifesteal || 0, HERO_MELEE.lifesteal);
    r.ab.vanguard = HERO_MELEE.vanguard;       // 선봉: 곁의 아군이 받는 피해를 줄인다
  }
}
function resolveUnit(u, lv, evo) {
  if (!u) return u;
  lv = Math.max(1, lv || 1);
  const ev = !!(evo && EVOLUTIONS[u.id] && lv >= EVO_LEVEL);
  // 4.1: evo === 2 면 3진 (2진을 대가 없이 얹은 위에 3진)
  const ev2 = ev && (evo === 2 || evo === 3) && !!EVOLUTIONS2[u.id] && lv >= EVO2_LEVEL;
  const ev3 = ev2 && evo === 3 && !!EVOLUTIONS3[u.id] && lv >= EVO3_LEVEL;   // 4.18 4진은 3진 위에
  const key = u.id + '|' + lv + '|' + (ev3 ? 3 : ev2 ? 2 : ev ? 1 : 0);
  if (_resolved[key]) return _resolved[key];
  const r = Object.assign({}, u);
  r.base = u;
  r.level = lv;
  r.ab = u.ab ? JSON.parse(JSON.stringify(u.ab)) : null;
  if (u.active) r.active = Object.assign({}, u.active);
  if (ev) applyEvolution(r, EVOLUTIONS[u.id], ev2);
  if (ev2) applyEvo2(r, EVOLUTIONS2[u.id]);
  if (ev3) applyEvo3(r, EVOLUTIONS3[u.id]);
  growUnit(r, lv);
  heroBuild(r);
  frontlineBuild(r);
  _resolved[key] = r;
  return r;
}
/* 저장에서 이 병종이 지금 진화 형태를 쓰는가 */
function usesEvo(save, id) {
  return !!(save && save.evo && save.evo[id] === true && (save.levels && save.levels[id] || 1) >= EVO_LEVEL);
}
/* 4.1 3진을 쓰는가: 2진을 마쳤고(save.evo 에 기록), 3진을 마쳤고 켜 두었고, 레벨 20 이상 */
function usesEvo2(save, id) {
  return !!(save && save.evo2 && save.evo2[id] === true && save.evo && save.evo[id] !== undefined &&
            EVOLUTIONS2[id] && (save.levels && save.levels[id] || 1) >= EVO2_LEVEL);
}
/* 4.18 4진을 쓰는가: 3진을 쓰고 있고, 4진을 마쳤고 켜 두었고, 레벨 25 이상 */
function usesEvo3(save, id) {
  return !!(usesEvo2(save, id) && save.evo3 && save.evo3[id] === true && EVOLUTIONS3[id] && (save.levels && save.levels[id] || 1) >= EVO3_LEVEL);
}
/* 형태 고르기 (훈련소 · 편성 공용). form: 'base' | 'evo' | 'evo2' | 'evo3' */
function setEvoForm(save, id, form) {
  if (!save.evo2) save.evo2 = {};
  if (!save.evo3) save.evo3 = {};
  save.evo[id] = form !== 'base';
  if (save.evo2[id] !== undefined) save.evo2[id] = form === 'evo2' || form === 'evo3';
  if (save.evo3[id] !== undefined) save.evo3[id] = form === 'evo3';
}
/* 지금 쓰는 형태: 0 기본 · 1 진화 · 2 3진 · 3 4진 */
function evoForm(save, id) { return usesEvo3(save, id) ? 3 : usesEvo2(save, id) ? 2 : usesEvo(save, id) ? 1 : 0; }
function unitFor(save, id) {
  const u = UNIT_BY_ID[id];
  const f = evoForm(save, id);
  return resolveUnit(u, (save && save.levels && save.levels[id]) || 1, f >= 2 ? f : f === 1);
}

/* =======================================================================
 *  하드코어. 돌파한 전장을 한 번 더, 훨씬 모질게.
 *   - 적 체력·공격 ×3.5(최소 ×5), 적 요새 체력 ×2(최소 40000), 전장 특성 하나가 더 붙는다 (3.1: ×1.5 → ×3.5)
 *   - 격앙: 싸움이 30초 길어질 때마다 새로 나오는 적이 15% 더 억세진다 (최대 2.5배)
 *   - 아군 성채 체력 60%, 왕의 명령 재사용 대기 1.5배, 모든 적 기절 저항 30%
 *   - 이기면 보상 골드 3배, 처음 이기면 소환석 5개와 왕관 기록
 *   다 키운 공략 편성으로도 30곳 중 절반 남짓만 넘는다 (`npm run balance` 가 검사).
 * ======================================================================= */
// 4.4: 3진이 생긴 뒤로 도전이 쉬워졌다 — 적 ×3.5 → 4.1 (바닥 5 → 6.2), 요새 ×2 → 2.2, 보스 체력 ×2.6 → 2.9
const HARDCORE = { enemyMul: 4.6, fortMul: 2.4, castleMul: 0.6, cmdMul: 1.5, reward: 3, stones: 5, stunResist: 0.3, charmResist: 0.4,
                   // 3.19: 하드코어 보스는 따로 더 억세다. 다 키운 영웅 편성이 필살을 몰아 쓰면 10~20초 만에 녹았다
                   boss: { hp: 3.2, atk: 1.2 },   // 4.18: 3.3 → 2 (7막 끝 보스 셋이 다 키워도 넘을 수 없었다) · 4.23: 3.2 — 보스가 너무 빨리 녹았다 (전장별 보정으로 승률은 맞춘다)
                   fury: { per30: 0.15, max: 1.5 },   // 3.1: 오래 끌수록 새로 나오는 적이 억세진다 (최대 2.5배)
                   // 앞쪽 전장도 모질게: 적 배율과 요새 체력에 바닥을 깐다 (2막 초입 수준)
                   mulFloor: 6.9, fortFloor: 50000, soft: 4, sally: 0.5, minRatio: 0.8,
                   twists: ['blitz', 'horde', 'ironclad', 'curse'] };
/* 4.4 각성 경계: 도전(하드코어 · 이벤트)에서는 편성한 3진 하나마다 적이 6%씩 억세진다 (3진은 체력·공격 ×1.35) */
const AWAKEN_TAX = 0.06;
/* 4.18: 전장 배율이 큰 뒤쪽 전장은 하드코어 배율이 누그러진다 (m / (1 + m/soft)). 예전엔 7막(배율 16~59)에 ×4.6 을 그대로 곱해
 * ×270 까지 올라 다 키운 편성도 30초 안에 성채가 무너졌다 — 어려운 게 아니라 깰 수 없었다. 앞쪽 전장은 거의 그대로다. */
function hardcoreEnemyMul(st) { const m = st.enemyMul || 1; return Math.max(Math.max(HARDCORE.enemyMul * m / (1 + m / HARDCORE.soft), m * (st.hardRatio || HARDCORE.minRatio)) * (st.hardSoft || 1), HARDCORE.mulFloor) * (st.hardTune || 1); }   // 4.20 hardTune: 만렙 기준 전장별 보정
/* 4.24 근접 병종을 보강한 만큼 진군이 쉬워져(막 입구 관문을 공략 편성이 7~8곳씩 넘었다) 진군 적 배율을 ×1.08.
 * 하드코어는 방금 맞춘 그대로 두려고 hardTune 으로 정확히 되돌린다 (hardcoreEnemyMul 이 배율에 곧게 비례하지 않아 전장마다 계산) */
const CAMPAIGN_MELEE_COMP = 1.08, CAMPAIGN_COMP_SKIP = { 33: 1, 39: 1, 52: 1, 53: 0.92, 60: 0.95, 61: 1, 63: 1, 65: 1, 67: 1, 68: 1, 70: 1, 75: 1 };
STAGES.forEach((st, i) => {
  if (i < 3) return;                                                   // 1~3전장은 기본 병종으로 넘는 곳이라 그대로
  const k = CAMPAIGN_COMP_SKIP[i + 1] || CAMPAIGN_MELEE_COMP;            // 다 키운 공략 편성도 빠듯한 곳은 덜 (또는 조금 덜어)
  const before = hardcoreEnemyMul(st);
  st.enemyMul = Math.round((st.enemyMul || 1) * k * 100) / 100;
  st.hardTune = st.hardTune * before / hardcoreEnemyMul(st);
});
function hardcoreFortHp(st) { return Math.max(Math.round(st.baseHp * HARDCORE.fortMul), HARDCORE.fortFloor); }
function hardcoreMods(st, i) {
  if (st && st.hardMods) return st.hardMods.slice();   // 4.18: 하드코어에서만 따로 (진군 특성은 그대로)
  const base = (st && st.mods) || [];
  // 4.18: 이미 특성이 둘 이상인 전장엔 더 얹지 않는다 — 중갑 · 저주 · 질주가 셋 겹친 막의 끝 전장은 다 키워도 넘을 수 없었다
  if (base.length >= 2) return base.slice();
  const tw = HARDCORE.twists;
  for (let k = 0; k < tw.length; k++) {
    const m = tw[(i + k) % tw.length];
    if (base.indexOf(m) < 0) return base.concat([m]);
  }
  return base.slice();
}

function upgradeCost(key, level) {
  const u = UPGRADES[key];
  return Math.round(u.base * Math.pow(u.step, level));
}

/* Tactical descriptions shared by the campaign and enemy codex. */
function enemyTactic(e) {
  if (e.boss) return '보스 · 왕명을 아껴 폭격 후 회복';
  if (e.ab && e.ab.stunImmune && !e.ab.souleater && !e.ab.deathBomb) return '기절 면역 · 기절 대신 둔화와 화력, 파쇄로';
  if (e.ab && e.ab.split) return '분열 · 범위 공격과 화상으로 갈라진 것까지 한꺼번에';
  if (e.ab && e.ab.mirror) return '거울 · 원거리는 튕겨 나오니 근접 병종으로 붙으세요';
  if (e.ab && e.ab.hook) return '갈고리 · 원거리만 두면 끌려갑니다, 넉백 면역이나 종지기로';
  if (e.ab && e.ab.thief) return '도둑 · 빨라서 둔화·장거리로 끊어야 군자금을 지킵니다';
  if (e.ab && e.ab.chrono) return '시간술 · 뒷줄에 숨으니 매 조련사·비행선·저격수로 먼저';
  if (e.ab && e.ab.souleater) return '포식 · 값싼 병사를 흘려보내면 커집니다, 한 번에 몰아치세요';
  if (e.ab && e.ab.sapper) return '돌파 · 전열을 지나쳐 가니 둔화·기절·원거리로 성채 앞에서';
  if (e.ab && e.ab.leap) return '암살 · 궁수 곁에 방패병이나 근접 병종을 두세요';
  if (e.ab && e.ab.burrow) return '땅굴 · 전열을 두껍게, 기절 뒤 왕명으로 수습';
  if (e.ab && e.ab.rally) return '지휘 · 북잡이부터 원거리로 끊어 내세요';
  if (e.ab && e.ab.weaken) return '저주 · 정화사로 해제, 멀리서 먼저 쓰러뜨리세요';
  if (e.ab && e.ab.revive) return '부활 · 두 번 쓰러뜨려야 합니다, 범위 공격이 유리';
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

/* =======================================================================
 *  5.0 정벌 — 갈림길을 따라 세 막을 내려가는 원정 (로그라이크)
 *
 *  - 편성은 출발할 때 그대로 묶인다. 성채 체력은 전투가 끝나도 이어진다 — 한 번 지면 원정이 끝난다.
 *  - 막마다 여섯 층: 층마다 갈림길 둘~셋 중 하나를 고른다 (전투 · 정예 · 상점 · 야영 · 제단). 여섯째 층은 보스.
 *  - 이기면 축복(쌓이는 능력) 하나를 고르고, 정예 · 보스는 유물(하나뿐인 큰 힘)을 준다. 군표 🎖 로 상점에서 산다.
 *  - 전장은 내가 돌파한 전장들에서 뽑는다 (깊이 내려갈수록 뒤 전장 · 더 억센 적). 끝까지 가면 정벌 단계가 오른다.
 *  자료 · 규칙은 여기(시뮬레이터도 그대로 돌린다), 화면은 conquest.js, 전투 효과는 game.js 의 run.
 * ======================================================================= */
const CONQ = {
  unlock: 20,             // 20전장(2막)까지 돌파하면 열린다
  acts: 3, floors: 6,     // 막 셋 · 막마다 여섯 층 (마지막 층은 보스)
  ascMax: 10,
  startScrip: 50,
  span: 34,               // 전장을 뽑는 폭: 돌파한 마지막 전장에서 이만큼 앞까지
  lag: 3,                 // 막 돌파한 끝 전장 몇은 빼고 (갓 넘은 곳은 배율이 얹히면 벽이다)
  lanes: 3,               // 5.1 갈림길은 세 줄 — 고른 줄의 이웃 줄로만 내려간다
  mul0: 1.12, mulDepth: 0.5,         // 적 배율: 첫 층 ×mul0 → 마지막 보스 ×mul0×(1+mulDepth)   (5.1: 1.0/0.35 → 1.12/0.5)
  castleMul: 0.8,                    // 5.1 원정 성채는 진군보다 얇다 — 새는 피해가 다음 전투까지 남는다
  // 정벌 단계의 적 덤(깊이 끝 기준): 낮은 단계는 완만하게, 높은 단계는 가파르게. 첫 층엔 40%만, 내려갈수록 다 받는다
  ascCurve: [0, 0.05, 0.11, 0.18, 0.26, 0.36, 0.55, 0.72, 0.9, 1.2, 1.55], ascEarly: 0.3,   // 5.1: 6 · 10단계의 ×1.1 도 여기에 (첫 층이 벽이었다)
  elite: 1.45, eliteFort: 1.25,       // 정예: 적 ×1.45 · 요새 ×1.25 · 특성 하나
  trial: 1.75, trialFort: 1.4,        // 5.1 시련: 적 ×1.75 · 요새 ×1.4 · 특성 둘 — 유물 고르기 + 높은 축복
  risk: [{ mul: 1, scrip: 1, coin: 1 }, { mul: 1.2, scrip: 1.5, coin: 1.3 }, { mul: 1.45, scrip: 2, coin: 1.6, up: 1 }],   // 5.1 평소 · 도발 · 결사
  reroll: { base: 20, step: 10 },     // 5.1 고르기 다시 굴리기: 군표 20, 쓸 때마다 +10
  fortDepth: 0.5,                     // 요새 체력: 깊이에 따라 ×(1+0.5d)
  bossHp: 1.3, bossAff: [2, 2, 3],    // 보스 체력 덤 · 막마다 각인 수 (5.1: 1.0 · 1/2/3 → 1.3 · 2/2/3)
  curseMul: 1.15,                     // 저주받은 보물: 다음 세 전투 적 +15%
  scrip: { battle: 30, elite: 60, trial: 80, boss: 100, perAct: 10 },
  heal: { rest: 0.3, boss: 0.3 },
  price: { common: 45, rare: 75, epic: 120, relic: 140, heal: 40 },
  coin: { mul: 1.4, perAct: 0.25, elite: 1.6, trial: 2, boss: 2.5, victory: 2500 }
};

/* 축복: 겹쳐 쌓인다. fx 의 곱셈 키는 곱하고, CONQ_ADD 키는 더한다 */
const CONQ_ADD = { range: 1, wallet: 1, startMoney: 1, regen: 1, killGold: 1, cmdHeal: 1, barrier: 1, phoenix: 1,
                   healAfter: 1, extraPick: 1, restHeal: 1, heroStart: 1, cmdStart: 1, freePath: 1, luck: 1, scripFlat: 1 };
const CONQ_BASE = { atk: 1, hp: 1, meleeAtk: 1, meleeHp: 1, rangedAtk: 1, heroAtk: 1, cheapAtk: 1, cheapHp: 1,
                    income: 1, cd: 1, cost: 1, castle: 1, bossHp: 1, enemyHp: 1, enemyAtk: 1, heroCd: 1, cmdCd: 1,
                    scrip: 1, shop: 1, coinMul: 1,
                    range: 0, wallet: 0, startMoney: 0, regen: 0, killGold: 0, cmdHeal: 0, barrier: 0, phoenix: 0,
                    healAfter: 0, extraPick: 0, restHeal: 0,
                    fortHp: 1, heroStart: 0, cmdStart: 0, freePath: 0, luck: 0, scripFlat: 0 };   // 5.1
const CONQ_BLESS = [
  { id: 'blade',    rar: 'common', icon: '🗡', name: '날 선 칼날',  desc: '모든 아군 공격 +8%',                 fx: { atk: 1.08 } },
  { id: 'mail',     rar: 'common', icon: '🛡', name: '단단한 갑옷', desc: '모든 아군 체력 +10%',                fx: { hp: 1.1 } },
  { id: 'warcry',   rar: 'common', icon: '📣', name: '선봉의 함성', desc: '근접 병종 공격 +14%',                fx: { meleeAtk: 1.14 } },
  { id: 'wall',     rar: 'common', icon: '🧱', name: '방패벽',      desc: '근접 병종 체력 +16%',                fx: { meleeHp: 1.16 } },
  { id: 'hawk',     rar: 'common', icon: '🦅', name: '매의 눈',     desc: '원거리 병종 공격 +14%',              fx: { rangedAtk: 1.14 } },
  { id: 'string',   rar: 'common', icon: '🏹', name: '긴 활시위',   desc: '원거리 병종 사거리 +25',             fx: { range: 25 } },
  { id: 'supply',   rar: 'common', icon: '📦', name: '병참 개선',   desc: '군자금 수입 +12%',                   fx: { income: 1.12 } },
  { id: 'vault',    rar: 'common', icon: '💼', name: '큰 금고',     desc: '군자금 한도 +250 · 시작 군자금 +100', fx: { wallet: 250, startMoney: 100 } },
  { id: 'muster',   rar: 'common', icon: '📯', name: '빠른 징집',   desc: '출진 대기 -10%',                     fx: { cd: 0.9 } },
  { id: 'mason',    rar: 'common', icon: '🏰', name: '성벽 보수',   desc: '성채 최대 체력 +15% · 곧바로 15% 회복', fx: { castle: 1.15 }, heal: 0.15 },
  { id: 'loot',     rar: 'common', icon: '🪙', name: '전리품 사냥', desc: '적을 쓰러뜨릴 때마다 군자금 +3',     fx: { killGold: 3 } },
  { id: 'militia',  rar: 'common', icon: '⚒', name: '민병대',      desc: '비용 150 이하 병종 공격 · 체력 +18%', fx: { cheapAtk: 1.18, cheapHp: 1.18 } },
  { id: 'drum',     rar: 'rare',   icon: '🥁', name: '전쟁의 북',   desc: '모든 아군 공격 +15%',                fx: { atk: 1.15 } },
  { id: 'valor',    rar: 'rare',   icon: '⭐', name: '영웅의 기개', desc: '전설 · 신화 공격 +22%',              fx: { heroAtk: 1.22 } },
  { id: 'sand',     rar: 'rare',   icon: '⏳', name: '시간의 모래', desc: '영웅 액티브 대기 -18%',              fx: { heroCd: 0.82 } },
  { id: 'regal',    rar: 'rare',   icon: '👑', name: '왕의 위엄',   desc: '왕의 명령 대기 -25% · 치유 +10%',    fx: { cmdCd: 0.75, cmdHeal: 0.1 } },
  { id: 'masonry',  rar: 'rare',   icon: '🔧', name: '축성술',      desc: '전투 중 성채가 초당 0.4% 회복',      fx: { regen: 0.004 } },
  { id: 'wagon',    rar: 'rare',   icon: '🛒', name: '보급 마차',   desc: '출진 비용 -10%',                     fx: { cost: 0.9 } },
  { id: 'charm',    rar: 'rare',   icon: '🧿', name: '보호의 부적', desc: '출진할 때 보호막 +150',              fx: { barrier: 150 } },
  { id: 'hunter',   rar: 'rare',   icon: '🎯', name: '사냥꾼의 표식', desc: '보스 체력 -12%',                   fx: { bossHp: 0.88 } },
  { id: 'wargod',   rar: 'epic',   icon: '⚜', name: '군신의 가호', desc: '모든 아군 공격 +20% · 체력 +20%',    fx: { atk: 1.2, hp: 1.2 } },
  { id: 'endless',  rar: 'epic',   icon: '♾', name: '끝없는 보급', desc: '군자금 수입 +25% · 출진 대기 -15%',  fx: { income: 1.25, cd: 0.85 } },
  { id: 'wither',   rar: 'epic',   icon: '🥀', name: '쇠약의 저주', desc: '모든 적 체력 -10% · 공격 -10%',      fx: { enemyHp: 0.9, enemyAtk: 0.9 } },
  { id: 'bastion',  rar: 'epic',   icon: '🗼', name: '거인의 성채', desc: '성채 최대 체력 +35% · 전투가 끝날 때마다 10% 회복', fx: { castle: 1.35, healAfter: 0.1 } },
  // 5.1 열둘 더
  { id: 'ram',      rar: 'common', icon: '🐏', name: '공성 망치',   desc: '적 요새 체력 -10%',                  fx: { fortHp: 0.9 } },
  { id: 'ration',   rar: 'common', icon: '🍖', name: '넉넉한 군량', desc: '시작 군자금 +150',                   fx: { startMoney: 150 } },
  { id: 'drill',    rar: 'common', icon: '🥋', name: '훈련 교관',   desc: '출진 대기 -6% · 모든 아군 공격 +4%', fx: { cd: 0.94, atk: 1.04 } },
  { id: 'pike',     rar: 'common', icon: '🔱', name: '장창 대열',   desc: '근접 병종 공격 · 체력 +8%',          fx: { meleeAtk: 1.08, meleeHp: 1.08 } },
  { id: 'sapper',   rar: 'rare',   icon: '💣', name: '공성 기술자', desc: '적 요새 체력 -20%',                  fx: { fortHp: 0.8 } },
  { id: 'standard', rar: 'rare',   icon: '🚩', name: '전쟁 군기',   desc: '영웅 액티브가 준비된 채로 전투를 시작한다', fx: { heroStart: 1 } },
  { id: 'signet',   rar: 'rare',   icon: '💍', name: '선왕의 인장', desc: '왕의 명령이 준비된 채로 전투를 시작한다', fx: { cmdStart: 1 } },
  { id: 'tithe',    rar: 'rare',   icon: '⛪', name: '십일조',      desc: '군표 획득 +20%',                     fx: { scrip: 1.2 } },
  { id: 'legion',   rar: 'epic',   icon: '🛡', name: '불패의 군단', desc: '모든 아군 체력 +30% · 근접 체력 +15%', fx: { hp: 1.3, meleeHp: 1.15 } },
  { id: 'volley',   rar: 'epic',   icon: '🎯', name: '화살 폭풍',   desc: '원거리 공격 +30% · 사거리 +30',      fx: { rangedAtk: 1.3, range: 30 } },
  { id: 'coffers',  rar: 'epic',   icon: '🏦', name: '왕실 금고',   desc: '수입 +20% · 군자금 한도 +400 · 시작 군자금 +200', fx: { income: 1.2, wallet: 400, startMoney: 200 } },
  { id: 'bane',     rar: 'epic',   icon: '🐉', name: '용 사냥꾼',   desc: '보스 체력 -25% · 전설 · 신화 공격 +15%', fx: { bossHp: 0.75, heroAtk: 1.15 } }
];
/* 유물: 원정마다 하나씩만 */
const CONQ_RELICS = [
  { id: 'phoenix',  icon: '🪶', name: '불사조 깃털',   desc: '성채가 무너지는 순간 한 번, 50%로 되살아난다 (쓰면 사라진다)', fx: { phoenix: 1 } },
  { id: 'crown',    icon: '👑', name: '황금 왕관',     desc: '군표 획득 +30%',                        fx: { scrip: 1.3 } },
  { id: 'scales',   icon: '⚖', name: '상인의 저울',   desc: '상점 가격 -25%',                        fx: { shop: 0.75 } },
  { id: 'orb',      icon: '🔮', name: '예언자의 수정구', desc: '축복을 고를 때 하나 더 보인다',      fx: { extraPick: 1 } },
  { id: 'tent',     icon: '⛺', name: '야전 병원',     desc: '전투가 끝날 때마다 성채 8% 회복',       fx: { healAfter: 0.08 } },
  { id: 'heart',    icon: '❤', name: '용의 심장',     desc: '모든 아군 체력 +25%',                   fx: { hp: 1.25 } },
  { id: 'sword',    icon: '⚔', name: '전쟁 군주의 검', desc: '모든 아군 공격 +25%',                  fx: { atk: 1.25 } },
  { id: 'hammer',   icon: '🔨', name: '대장장이 망치', desc: '근접 병종 공격 · 체력 +20%',            fx: { meleeAtk: 1.2, meleeHp: 1.2 } },
  { id: 'quiver',   icon: '🏹', name: '엘프 화살통',   desc: '원거리 병종 공격 +20% · 사거리 +20',    fx: { rangedAtk: 1.2, range: 20 } },
  { id: 'spring',   icon: '💧', name: '마나 샘',       desc: '영웅 액티브 대기 -30%',                 fx: { heroCd: 0.7 } },
  { id: 'key',      icon: '🗝', name: '금고 열쇠',     desc: '시작 군자금 +250 · 군자금 한도 +300',   fx: { startMoney: 250, wallet: 300 } },
  { id: 'roll',     icon: '📜', name: '징병 명부',     desc: '출진 대기 -20%',                        fx: { cd: 0.8 } },
  { id: 'cornerstone', icon: '🪨', name: '거석의 초석', desc: '성채 최대 체력 +50%',                  fx: { castle: 1.5 } },
  { id: 'axe',      icon: '🪓', name: '처형인의 도끼', desc: '보스 체력 -20%',                        fx: { bossHp: 0.8 } },
  { id: 'plague',   icon: '☠', name: '역병 단지',     desc: '모든 적 체력 -12%',                     fx: { enemyHp: 0.88 } },
  { id: 'grail',    icon: '🏆', name: '수호의 성배',   desc: '출진할 때 보호막 +300',                 fx: { barrier: 300 } },
  { id: 'sack',     icon: '💰', name: '약탈자의 자루', desc: '적을 쓰러뜨릴 때마다 군자금 +6 · 금화 보상 +25%', fx: { killGold: 6, coinMul: 1.25 } },
  { id: 'flint',    icon: '🔥', name: '모닥불 부싯돌', desc: '야영에서 성채를 20%p 더 회복',          fx: { restHeal: 0.2 } },
  { id: 'horn',     icon: '📯', name: '왕실 나팔',     desc: '왕의 명령 대기 -40%',                   fx: { cmdCd: 0.6 } },
  { id: 'mirror',   icon: '🪞', name: '거울 방패',     desc: '모든 적 공격 -15%',                     fx: { enemyAtk: 0.85 } },
  // 5.1 열 더 — 앞의 넷은 대가가 있다
  { id: 'bloodcrown', icon: '🩸', name: '피의 왕관',   desc: '모든 아군 공격 +35% · 대가: 성채 최대 체력 -25%', fx: { atk: 1.35, castle: 0.75 }, cursed: true },
  { id: 'greed',    icon: '💎', name: '탐욕의 반지',   desc: '군표 획득 +60% · 대가: 모든 적 체력 +10%', fx: { scrip: 1.6, enemyHp: 1.1 }, cursed: true },
  { id: 'helm',     icon: '⛑', name: '광전사의 투구', desc: '근접 공격 +40% · 대가: 근접 체력 -15%',  fx: { meleeAtk: 1.4, meleeHp: 0.85 }, cursed: true },
  { id: 'glass',    icon: '🔭', name: '유리 대포',     desc: '원거리 공격 +40% · 대가: 모든 아군 체력 -12%', fx: { rangedAtk: 1.4, hp: 0.88 }, cursed: true },
  { id: 'ballista', icon: '🎯', name: '공성 노포',     desc: '적 요새 체력 -30%',                     fx: { fortHp: 0.7 } },
  { id: 'warbanner', icon: '🚩', name: '왕의 깃발',    desc: '영웅 액티브 · 왕의 명령이 준비된 채로 전투를 시작한다', fx: { heroStart: 1, cmdStart: 1 } },
  { id: 'compass',  icon: '🧭', name: '탐험가의 나침반', desc: '갈림길 어느 줄로든 내려갈 수 있다',   fx: { freePath: 1 } },
  { id: 'lantern',  icon: '🏮', name: '길잡이 등불',   desc: '축복을 고를 때 희귀 · 영웅이 더 자주 나온다', fx: { luck: 1 } },
  { id: 'hourglass', icon: '⌛', name: '시간술사의 모래시계', desc: '출진 대기 -12% · 영웅 액티브 대기 -12%', fx: { cd: 0.88, heroCd: 0.88 } },
  { id: 'cart',     icon: '🛻', name: '전리품 수레',   desc: '전투가 끝날 때마다 군표 +12',           fx: { scripFlat: 12 } }
];
const CONQ_BLESS_BY_ID = {}, CONQ_RELIC_BY_ID = {};
CONQ_BLESS.forEach(b => { CONQ_BLESS_BY_ID[b.id] = b; });
CONQ_RELICS.forEach(r => { CONQ_RELIC_BY_ID[r.id] = r; });
const CONQ_RARITY = { common: { name: '일반', color: '#c9d3df' }, rare: { name: '희귀', color: '#6fb6ff' }, epic: { name: '영웅', color: '#e08cff' } };
const CONQ_NODES = {
  battle: { name: '전투', icon: '⚔', desc: '이기면 축복 하나 · 군표' },
  elite:  { name: '정예', icon: '💀', desc: '억센 적 · 전장 특성 하나 — 이기면 유물 + 축복' },
  shop:   { name: '상점', icon: '🛒', desc: '군표로 축복 · 유물 · 성채 수리를 산다' },
  rest:   { name: '야영', icon: '🔥', desc: '성채를 고치거나, 훈련으로 희귀 축복' },
  shrine: { name: '제단', icon: '✨', desc: '무엇이 기다리는지 모른다 — 대가와 보상' },
  boss:   { name: '보스', icon: '👑', desc: '막의 주인 · 각인을 두른 보스 — 이기면 유물 고르기 · 성채 30% 회복' },
  // 5.1
  trial:  { name: '시련', icon: '🔥', desc: '아주 억센 적 · 전장 특성 둘 — 이기면 유물 고르기 + 높은 축복' },
  forge:  { name: '대장간', icon: '⚒', desc: '가진 축복 하나를 하나 더 벼린다' },
  recruit: { name: '징집소', icon: '📋', desc: '편성 한 칸을 다른 병종으로 바꾼다 (자리가 있으면 더한다)' },
  treasure: { name: '보물', icon: '💎', desc: '유물 둘 중 하나를 고른다' }
};
/* 5.1 전투마다 거는 위험: 적이 억세지는 대신 군표 · 금화가 늘고, 결사는 축복 등급이 하나 오른다 */
const CONQ_RISK = [
  { name: '평소', desc: '그대로 싸운다' },
  { name: '도발', desc: '적 +20% · 군표 ×1.5 · 금화 ×1.3' },
  { name: '결사', desc: '적 +45% · 군표 ×2 · 금화 ×1.6 · 축복 등급 하나 위' }
];
/* 정벌 단계: 끝까지 가면 하나씩 열린다. CONQ.ascCurve 만큼 적이 억세지고(깊이 내려갈수록 — 첫 층엔 40%) 아래가 쌓인다 */
const CONQ_ASC = [
  '기본',
  '정예가 더 자주 나온다',
  '성채 85%로 출발한다',
  '상점 가격 +20%',
  '보스 각인 +1',
  '야영 회복 -10%p',
  '적 체력 · 공격 +10%',
  '전투에서 받는 군표 -20%',
  '모든 전투에 전장 특성 하나',
  '보스 체력 +20%',
  '마지막 보스 각인 +1 · 적 +10%'
];
/* 제단: 고를 수 있는 일 둘. cost/gain 은 conqApply 가 푼다 */
const CONQ_SHRINES = [
  { id: 'blood',  name: '피의 제단',      text: '붉게 젖은 돌이 대가를 원한다.',
    opts: [{ label: '피를 바친다', note: '성채 -20% · 유물 하나', cost: { castle: 0.2 }, gain: { relic: 1 } }, { label: '지나간다', note: '', gain: {} }] },
  { id: 'smith',  name: '떠돌이 대장장이', text: '“군표만 있으면 무엇이든 벼려 드리지.”',
    opts: [{ label: '벼려 달라', note: '군표 50 · 희귀 축복 고르기', cost: { scrip: 50 }, gain: { pick: 'rare' } }, { label: '지나간다', note: '', gain: {} }] },
  { id: 'spring', name: '치유의 샘',      text: '맑은 물이 솟는다.',
    opts: [{ label: '성벽을 씻는다', note: '성채 +30%', gain: { heal: 0.3 } }, { label: '물을 팔아넘긴다', note: '군표 +40', gain: { scrip: 40 } }] },
  { id: 'gamble', name: '도박꾼의 탁자',  text: '“반반이오. 걸겠소?”',
    opts: [{ label: '군표 30을 건다', note: '절반의 확률로 군표 90', cost: { scrip: 30 }, gain: { gamble: 90 } }, { label: '지나간다', note: '', gain: {} }] },
  { id: 'cursed', name: '저주받은 보물',  text: '검은 상자에서 속삭임이 새어 나온다.',
    opts: [{ label: '연다', note: '유물 하나 · 다음 전투 셋은 적 +15%', gain: { relic: 1, curse: 3 } }, { label: '지나간다', note: '', gain: {} }] },
  { id: 'merc',   name: '용병 야영지',    text: '돈만 주면 싸워 줄 자들이 모여 있다.',
    opts: [{ label: '고용한다', note: '군표 35 · 일반 축복 고르기', cost: { scrip: 35 }, gain: { pick: 'common' } }, { label: '함께 술을 마신다', note: '성채 +12%', gain: { heal: 0.12 } }] },
  { id: 'pilgrim', name: '순례자',        text: '지친 순례자가 축복을 빌어 준다.',
    opts: [{ label: '축복을 받는다', note: '무작위 일반 축복 하나', gain: { randBless: 'common' } }, { label: '노자를 받는다', note: '군표 +50', gain: { scrip: 50 } }] },
  { id: 'mist',   name: '망각의 안개',    text: '안개 속에서 무언가를 잃고 무언가를 얻는다.',
    opts: [{ label: '안개 속으로', note: '가진 축복 하나를 잃고 영웅 축복 고르기', cost: { loseBless: 1 }, gain: { pick: 'epic' } }, { label: '돌아선다', note: '', gain: {} }] },
  // 5.1 넷 더
  { id: 'seer',   name: '점술가',          text: '“네 앞길을 넷으로 갈라 보여 주지.”',
    opts: [{ label: '점을 본다', note: '군표 25 · 축복 넷 중 하나 고르기', cost: { scrip: 25 }, gain: { pick4: 1 } }, { label: '지나간다', note: '', gain: {} }] },
  { id: 'duel',   name: '결투 신청',        text: '이름 모를 기사가 길을 막고 칼을 뽑는다.',
    opts: [{ label: '받아들인다', note: '성채 -15% · 무작위 영웅 축복 하나', cost: { castle: 0.15 }, gain: { randBless: 'epic' } }, { label: '물러선다', note: '', gain: {} }] },
  { id: 'refugee', name: '피난민 행렬',     text: '불탄 마을에서 쫓겨난 이들이 성문을 두드린다.',
    opts: [{ label: '받아들인다', note: '군표 -30 · 성벽 보수 축복', cost: { scrip: 30 }, gain: { bless: 'mason' } }, { label: '외면한다', note: '군표 +30 · 다음 전투 적 +15%', gain: { scrip: 30, curse: 1 } }] },
  { id: 'anvil',  name: '버려진 대장간',    text: '아직 불씨가 남은 화덕이 있다.',
    opts: [{ label: '화덕을 지핀다', note: '가진 축복 하나를 무작위로 하나 더', cost: { needBless: 1 }, gain: { dupBless: 1 } }, { label: '고철을 판다', note: '군표 +35', gain: { scrip: 35 } }] }
];
const CONQ_SHRINE_BY_ID = {};
CONQ_SHRINES.forEach(s => { CONQ_SHRINE_BY_ID[s.id] = s; });

/* 원정마다 고정된 난수 — 같은 원정은 다시 열어도 같은 지도 · 같은 선택지 */
function conqRng(run, salt) {
  let s = ((run.seed >>> 0) ^ Math.imul((run.rn = (run.rn || 0) + 1) + (salt || 0), 0x9e3779b1)) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function conqPick(R, arr) { return arr[Math.floor(R() * arr.length)]; }
function conqOpen(s) { return (s.cleared || 0) >= CONQ.unlock; }
function conqAscOpen(s) { return Math.min(CONQ.ascMax, ((s.conqRec && s.conqRec.asc) || 0)); }   // 고를 수 있는 가장 높은 단계

/* 깊이 0~1: 막 · 층을 한 줄로 */
function conqDepth(act, floor) { return (act * CONQ.floors + floor) / (CONQ.acts * CONQ.floors - 1); }
/* 전장을 뽑는 범위: 돌파한 마지막 전장에서 span 만큼 */
function conqRange(run) { const hi = Math.max(0, Math.min(STAGES.length, run.tier) - 1 - CONQ.lag); return { lo: Math.max(0, hi - CONQ.span), hi: hi }; }
/* 이 층의 적 배율 (깊이 · 단계) */
function conqMul(run, d) { return CONQ.mul0 * (1 + CONQ.mulDepth * d) * (1 + (CONQ.ascCurve[run.asc] || 0) * (CONQ.ascEarly + (1 - CONQ.ascEarly) * d)); }

/* 막 하나의 지도 (5.1): 층마다 세 줄. 고른 줄의 이웃 줄(위 · 같은 · 아래)로만 내려간다.
 * 첫 층은 전투 셋, 넷째(끝 앞) 층엔 야영이나 상점이 하나는 있다, 마지막 층은 보스 하나 (어느 줄에서든 간다) */
const CONQ_WEIGHTS = [['battle', 38], ['elite', 14], ['shop', 9], ['rest', 9], ['shrine', 12], ['trial', 6], ['forge', 6], ['recruit', 6], ['treasure', 3]];
function conqMakeAct(run, act) {
  const R = conqRng(run, 101 + act * 7);
  const map = [];
  for (let f = 0; f < CONQ.floors; f++) {
    const d = conqDepth(act, f);
    if (f === CONQ.floors - 1) { map.push([conqBattleNode(run, R, 'boss', d, act)]); continue; }
    const w = CONQ_WEIGHTS.map(([t, x]) => [t,
      t === 'elite' ? (f >= 2 ? x * (run.asc >= 1 ? 1.5 : 1) : 0) : t === 'trial' ? (f >= 2 ? x : 0) : t === 'rest' ? (f >= 2 ? x : 3) :
      t === 'treasure' || t === 'forge' ? (f >= 1 ? x : 0) : x]);
    const sum = w.reduce((a, b) => a + b[1], 0);
    const row = [];
    for (let k = 0; k < CONQ.lanes; k++) {
      let t = 'battle';
      if (f > 0) { let x = R() * sum; t = w.find(p => (x -= p[1]) < 0)[0]; }
      if (row.indexOf(t) >= 0 && t !== 'battle' && R() < 0.7) t = 'battle';   // 같은 줄에 같은 쉼터가 겹치지 않게
      row.push(t);
    }
    const fight = t => t === 'battle' || t === 'elite' || t === 'trial';
    if (!row.some(fight)) row[1] = 'battle';                                 // 싸우지 않고는 내려갈 수 없다
    if (f === CONQ.floors - 2 && !row.some(t => t === 'rest' || t === 'shop')) row[conqPick(R, [0, 2])] = R() < 0.6 ? 'rest' : 'shop';
    map.push(row.map(t => fight(t) ? conqBattleNode(run, R, t, d, act) : { t: t }));
  }
  return map;
}
/* 이 칸으로 갈 수 있나: 막의 첫 층 · 보스 층 · 나침반이면 어디든, 아니면 지난 층에서 고른 줄의 이웃 */
function conqReachable(run, k) {
  const row = run.map[run.floor] || [];
  if (k < 0 || k >= row.length) return false;
  if (run.floor === 0 || row.length === 1 || conqEffects(run).freePath) return true;
  const prev = run.path[run.floor - 1], pr = run.map[run.floor - 1] || [];
  if (prev === undefined || pr.length !== row.length) return true;            // 옛 지도(줄 수가 다름)는 막지 않는다
  return Math.abs(k - prev) <= 1;
}
function conqBattleNode(run, R, t, d, act) {
  const { lo, hi } = conqRange(run);
  const c = lo + d * (hi - lo);
  const boss = t === 'boss';
  // 보스 층은 보스 전장에서, 아니면 보스가 없는 전장에서. 가운데(c)에 가까운 것 넷 중 하나 (시련은 더 뒤에서)
  const pool = [];
  STAGES.forEach((st, i) => { if (i <= hi && !!(st.boss && st.bossId) === boss) pool.push(i); });
  if (!pool.length) STAGES.forEach((st, i) => { if (!!(st.boss && st.bossId) === boss) pool.push(i); });
  const cc = t === 'trial' ? Math.min(hi, c + 4) : c;
  pool.sort((a, b) => Math.abs(a - cc) - Math.abs(b - cc));
  const src = boss && act === CONQ.acts - 1 ? pool.slice(0, 2).sort((a, b) => b - a)[0] : conqPick(R, pool.slice(0, 4));
  const node = { t: t, src: src };
  const modKeys = Object.keys(STAGE_MODS);
  if (t === 'elite' || t === 'trial' || run.asc >= 8) node.mod = conqPick(R, modKeys);
  if (t === 'trial') node.mod2 = conqPick(R, modKeys.filter(m => m !== node.mod));
  if (boss) {
    const n = CONQ.bossAff[act] + (run.asc >= 4 ? 1 : 0) + (run.asc >= 10 && act === CONQ.acts - 1 ? 1 : 0);
    const keys = AFFIX_KEYS.slice();
    node.aff = [];
    for (let k = 0; k < Math.min(n, keys.length); k++) node.aff.push(keys.splice(Math.floor(R() * keys.length), 1)[0]);
  }
  return node;
}

/* 새 원정 */
function conqNewRun(s, asc, seed) {
  const run = { v: 1, asc: Math.max(0, Math.min(conqAscOpen(s), asc | 0)), seed: (seed >>> 0) || 1, rn: 0,
                tier: Math.min(STAGES.length, s.cleared || 0), deck: (s.loadout || []).slice(0, LOADOUT_MAX),
                act: 0, floor: 0, castle: 1, scrip: CONQ.startScrip, bless: {}, relics: [], won: 0, curse: 0,
                kills: 0, coins: 0, pending: null, map: null, done: null, path: [], room: null, risk: 0, rerolls: 0 };
  if (run.asc >= 2) run.castle = 0.85;
  run.map = conqMakeAct(run, 0);
  run.pending = { kind: 'relic', opts: conqRelicOffer(run, 3), start: true };   // 출발 유물 하나 고르기
  return run;
}

/* 지금 가진 축복 · 유물을 한데 모은 효과 */
function conqEffects(run) {
  const R = Object.assign({}, CONQ_BASE);
  const add = fx => { for (const k in fx) { if (CONQ_ADD[k]) R[k] += fx[k]; else R[k] *= fx[k]; } };
  for (const id in (run.bless || {})) { const b = CONQ_BLESS_BY_ID[id]; if (b) for (let i = 0; i < run.bless[id]; i++) add(b.fx); }
  (run.relics || []).forEach(id => { const r = CONQ_RELIC_BY_ID[id]; if (r) add(r.fx); });
  if (run.phoenixUsed) R.phoenix = 0;
  return R;
}
/* 축복 고르기: 희귀도를 굴려 서로 다른 n 개. up: 등급을 한 칸 올린다(결사) · 등불은 일반을 덜 */
function conqBlessOffer(run, n, odds, up) {
  const R = conqRng(run, 7);
  if (Array.isArray(odds)) {
    let o = odds.slice();
    if (conqEffects(run).luck) o = [o[0] * 0.6, o[1] + o[0] * 0.25, o[2] + o[0] * 0.15];
    if (up) o = [0, o[0] + o[1] * 0.5, o[2] + o[1] * 0.5];
    odds = o;
  } else if (up && odds === 'common') odds = 'rare';
  else if (up && odds === 'rare') odds = 'epic';
  const out = [];
  for (let k = 0; k < 40 && out.length < n; k++) {
    const x = R(), rar = typeof odds === 'string' ? odds : (x < odds[0] ? 'common' : x < odds[0] + odds[1] ? 'rare' : 'epic');
    const pool = CONQ_BLESS.filter(b => b.rar === rar && out.indexOf(b.id) < 0);
    if (pool.length) out.push(conqPick(R, pool).id);
  }
  return out;
}
function conqRelicOffer(run, n) {
  const R = conqRng(run, 13);
  const pool = CONQ_RELICS.filter(r => (run.relics || []).indexOf(r.id) < 0).map(r => r.id);
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  return out;
}
const CONQ_ODDS = { battle: [0.68, 0.27, 0.05], elite: [0.35, 0.47, 0.18], trial: [0, 0.55, 0.45], boss: [0, 0.6, 0.4], rest: 'rare' };
/* 5.1 고르기 다시 굴리기: 같은 종류 · 같은 확률로 새 선택지 (값은 쓸 때마다 오른다) */
function conqRerollCost(run) { return CONQ.reroll.base + CONQ.reroll.step * (run.rerolls || 0); }
function conqReroll(run) {
  const p = run.pending, cost = conqRerollCost(run);
  if (!p || p.start || run.scrip < cost) return false;
  run.scrip -= cost; run.rerolls = (run.rerolls || 0) + 1;
  p.opts = p.kind === 'relic' ? conqRelicOffer(run, p.opts.length) : conqBlessOffer(run, p.opts.length, p.odds || CONQ_ODDS.battle, p.up);
  return true;
}

/* 고른 칸의 전장을 만든다 (깊이 · 단계 · 정예 · 시련 · 저주 · 위험을 얹은 STAGES 복사본) */
function conqStage(run, node) {
  const src = STAGES[node.src];
  const d = conqDepth(run.act, run.floor);
  const risk = CONQ.risk[run.risk || 0] || CONQ.risk[0];
  let mul = conqMul(run, d) * risk.mul;
  if (node.t === 'elite') mul *= CONQ.elite;
  if (node.t === 'trial') mul *= CONQ.trial;
  if (run.curse > 0) mul *= CONQ.curseMul;
  const fortK = node.t === 'elite' ? CONQ.eliteFort : node.t === 'trial' ? CONQ.trialFort : 1;
  const coinK = (CONQ.coin[node.t] || 1) * risk.coin;
  const mods = node.mod ? [node.mod].concat(node.mod2 ? [node.mod2] : []) : (src.mods || []).slice();
  const st = Object.assign({}, src, {
    name: src.name, waves: src.waves.map(w => Object.assign({}, w)),
    enemyMul: (src.enemyMul || 1) * mul,
    baseHp: Math.round(src.baseHp * (1 + CONQ.fortDepth * d) * fortK),
    reward: Math.round(src.reward * (CONQ.coin.mul + CONQ.coin.perAct * run.act) * coinK),
    mods: mods,
    conquest: { t: node.t, act: run.act, floor: run.floor, risk: run.risk || 0 }
  });
  if (node.aff) st.runAffix = node.aff.slice();
  if (node.t === 'boss') st.conqBossHp = CONQ.bossHp * (run.asc >= 9 ? 1.2 : 1);
  delete st.hardTune; delete st.hardBoss;
  return st;
}

/* 전투 하나가 끝났다: 성채 · 보상 · 다음 고르기 */
function conqAfterBattle(run, node, win, castleRatio, extra) {
  const R = conqEffects(run);
  extra = extra || {};
  const risk = CONQ.risk[run.risk || 0] || CONQ.risk[0];
  run.risk = 0;
  if (extra.phoenixUsed) run.phoenixUsed = true;
  run.kills += extra.kills || 0;
  run.coins += extra.coins || 0;
  if (!win) { run.castle = 0; run.done = 'lose'; run.pending = null; return run; }
  if (run.curse > 0) run.curse--;
  run.won++;
  run.castle = Math.min(1, Math.max(0.01, castleRatio) + R.healAfter + (node.t === 'boss' ? CONQ.heal.boss : 0));
  const base = CONQ.scrip[node.t] + CONQ.scrip.perAct * run.act;
  run.scrip += Math.round(base * R.scrip * risk.scrip * (run.asc >= 7 ? 0.8 : 1)) + R.scripFlat;
  const pick = 3 + R.extraPick, up = risk.up ? 1 : 0;
  const bless = odds => ({ kind: 'bless', opts: conqBlessOffer(run, pick, odds, up), odds: odds, up: up });
  if (node.t === 'boss' || node.t === 'trial') run.pending = Object.assign({ kind: 'relic', opts: conqRelicOffer(run, 3) }, { then: bless(CONQ_ODDS[node.t]) });
  else if (node.t === 'elite') {
    const rel = conqRelicOffer(run, 1)[0];
    if (rel) run.relics.push(rel);
    run.pending = Object.assign(bless(CONQ_ODDS.elite), { got: rel || null });
  } else run.pending = bless(CONQ_ODDS.battle);
  return run;
}
/* 다음 층으로 (막 끝이면 다음 막 · 마지막 막이면 정벌 완료) */
function conqAdvance(run) {
  run.floor++;
  if (run.floor >= CONQ.floors) {
    run.act++; run.floor = 0;
    if (run.act >= CONQ.acts) { run.done = 'win'; return run; }
    run.map = conqMakeAct(run, run.act); run.path = [];
  }
  return run;
}
/* 축복 · 유물 받기 */
function conqTake(run, kind, id) {
  if (kind === 'relic') {
    const r = CONQ_RELIC_BY_ID[id];
    if (r && run.relics.indexOf(id) < 0) run.relics.push(id);
    return run;
  }
  const b = CONQ_BLESS_BY_ID[id];
  if (!b) return run;
  run.bless[id] = (run.bless[id] || 0) + 1;
  if (b.heal) run.castle = Math.min(1, run.castle + b.heal);
  return run;
}
function conqBlessCount(run) { let n = 0; for (const k in run.bless) n += run.bless[k]; return n; }

/* 5.1 대장간: 가진 축복 하나를 하나 더 (고를 수 있는 것: 가진 것 전부) */
function conqForge(run, id) { if (!run.bless[id]) return false; conqTake(run, 'bless', id); return true; }
/* 5.1 징집소: 편성에 없는 쓸 수 있는 병종 셋 (영웅은 자리가 날 때만 의미가 있지만 바꿔 넣을 수는 있다) */
function conqRecruitOffer(run, s) {
  const R = conqRng(run, 41);
  const pool = availableUnits(s).filter(u => run.deck.indexOf(u.id) < 0).map(u => u.id);
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  return out;
}
/* id 를 slot 자리에 넣는다 (slot 이 편성 길이면 더한다). 전설 · 신화 자리 수를 넘으면 false */
function conqRecruit(run, id, slot) {
  const u = UNIT_BY_ID[id];
  if (!u || run.deck.indexOf(id) >= 0 || slot < 0 || slot > run.deck.length || slot >= LOADOUT_MAX) return false;
  const next = run.deck.slice();
  if (slot === next.length) next.push(id); else next[slot] = id;
  if (next.filter(x => isHeroUnit(UNIT_BY_ID[x])).length > HERO_SLOT_MAX) return false;
  run.deck = next;
  return true;
}

/* 상점: 들를 때 한 번 정한다 */
function conqShop(run) {
  const R = conqEffects(run);
  const pm = R.shop * (run.asc >= 3 ? 1.2 : 1);
  const items = [];
  conqBlessOffer(run, 3, [0.5, 0.38, 0.12]).forEach(id => items.push({ kind: 'bless', id: id, price: Math.round(CONQ.price[CONQ_BLESS_BY_ID[id].rar] * pm) }));
  conqRelicOffer(run, 2).forEach(id => items.push({ kind: 'relic', id: id, price: Math.round(CONQ.price.relic * pm) }));
  items.push({ kind: 'heal', amount: 0.25, price: Math.round(CONQ.price.heal * pm) });
  return items;
}
function conqBuy(run, item) {
  if (!item || item.sold || run.scrip < item.price) return false;
  if (item.kind === 'heal' && run.castle >= 1) return false;
  run.scrip -= item.price; item.sold = true;
  if (item.kind === 'heal') run.castle = Math.min(1, run.castle + item.amount);
  else conqTake(run, item.kind, item.id);
  return true;
}
function conqRestHeal(run) { return Math.max(0.1, CONQ.heal.rest + conqEffects(run).restHeal - (run.asc >= 5 ? 0.1 : 0)); }

/* 제단의 선택: 대가를 치를 수 없으면 false. 고르기가 이어지면 run.pending 이 선다 */
function conqShrineCan(run, opt) {
  const c = opt.cost || {};
  return !(c.scrip && run.scrip < c.scrip) && !(c.castle && run.castle <= c.castle + 0.02) && !(c.loseBless && conqBlessCount(run) < c.loseBless) &&
    !(c.needBless && conqBlessCount(run) < c.needBless);
}
function conqShrine(run, opt, rnd) {
  if (!conqShrineCan(run, opt)) return null;
  const c = opt.cost || {}, g = opt.gain || {}, R = conqRng(run, 29);
  const out = {};
  if (c.scrip) run.scrip -= c.scrip;
  if (c.castle) run.castle = Math.max(0.01, run.castle - c.castle);
  if (c.loseBless) { const ids = Object.keys(run.bless).filter(k => run.bless[k] > 0); const id = conqPick(R, ids); run.bless[id]--; if (!run.bless[id]) delete run.bless[id]; out.lost = id; }
  if (g.heal) run.castle = Math.min(1, run.castle + g.heal);
  if (g.scrip) run.scrip += g.scrip;
  if (g.curse) run.curse += g.curse;
  if (g.gamble) { out.gamble = (rnd !== undefined ? rnd : R()) < 0.5; if (out.gamble) run.scrip += g.gamble; }
  if (g.relic) { const id = conqRelicOffer(run, 1)[0]; if (id) { run.relics.push(id); out.relic = id; } }
  if (g.randBless) { const pool = CONQ_BLESS.filter(b => b.rar === g.randBless); const b = conqPick(R, pool); conqTake(run, 'bless', b.id); out.bless = b.id; }
  if (g.bless) { conqTake(run, 'bless', g.bless); out.bless = g.bless; }
  if (g.dupBless) { const ids = Object.keys(run.bless).filter(k => run.bless[k] > 0); if (ids.length) { const id = conqPick(R, ids); conqTake(run, 'bless', id); out.bless = id; } }
  if (g.pick) run.pending = { kind: 'bless', opts: conqBlessOffer(run, 3 + conqEffects(run).extraPick, g.pick), odds: g.pick };
  if (g.pick4) run.pending = { kind: 'bless', opts: conqBlessOffer(run, 4 + conqEffects(run).extraPick, [0.45, 0.4, 0.15]), odds: [0.45, 0.4, 0.15] };
  return out;
}

/* 원정이 끝났을 때의 보상 (금화 · 소환석) — 기록도 여기서 고친다 */
function conqFinish(s, run) {
  const win = run.done === 'win';
  const rec = s.conqRec || (s.conqRec = { asc: 0, top: -1, best: 0, runs: 0, wins: 0 });
  const floors = win ? CONQ.acts * CONQ.floors : run.act * CONQ.floors + run.floor;   // 다 내려간 층 수
  rec.runs = (rec.runs || 0) + 1;
  rec.best = Math.max(rec.best || 0, floors);
  let coins = 0, stones = Math.floor(run.won / 2), first = false;
  if (win) {
    rec.wins = (rec.wins || 0) + 1;
    coins += Math.round(CONQ.coin.victory * (1 + 0.25 * run.asc) * conqEffects(run).coinMul);
    stones += 5 + run.asc;
    first = run.asc > (rec.top === undefined ? -1 : rec.top);          // 이 단계를 처음 넘었다
    if (first) { stones += 2 * (run.asc + 1); rec.top = run.asc; }
    rec.asc = Math.min(CONQ.ascMax, Math.max(rec.asc || 0, run.asc + 1));
  }
  s.coins = (s.coins || 0) + coins;
  s.stones = (s.stones || 0) + stones;
  return { win: win, coins: coins, stones: stones, first: first, floors: floors, won: run.won };
}
/* 저장된 원정을 믿을 만한 모양으로 (깨진 칸은 버린다 — 고칠 수 없으면 원정을 통째로 버린다) */
function conqNormRec(r) {
  const n = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d; };
  r = r && typeof r === 'object' ? r : {};
  return { asc: n(r.asc, 0, CONQ.ascMax, 0), top: n(r.top, -1, CONQ.ascMax, -1), best: n(r.best, 0, CONQ.acts * CONQ.floors, 0),
           runs: n(r.runs, 0, 1e9, 0), wins: n(r.wins, 0, 1e9, 0) };
}
function conqNormalize(run) {
  if (!run || typeof run !== 'object' || run.v !== 1 || !Array.isArray(run.map)) return null;
  const num = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null; };
  const act = num(run.act, 0, CONQ.acts - 1), floor = num(run.floor, 0, CONQ.floors - 1);
  if (act === null || floor === null || run.map.length !== CONQ.floors) return null;
  const okNode = n => n && typeof n === 'object' && CONQ_NODES[n.t] && (!('src' in n) || (STAGES[n.src] !== undefined)) &&
    (!n.mod || STAGE_MODS[n.mod]) && (!n.mod2 || STAGE_MODS[n.mod2]) && (!n.aff || (Array.isArray(n.aff) && n.aff.every(k => BOSS_AFFIXES[k])));
  if (!run.map.every(row => Array.isArray(row) && row.length && row.every(okNode))) return null;
  const out = Object.assign({}, run, { act: act | 0, floor: floor | 0 });
  out.asc = num(run.asc, 0, CONQ.ascMax) | 0;
  out.seed = (Number(run.seed) >>> 0) || 1; out.rn = Math.max(0, Number(run.rn) | 0);
  out.tier = num(run.tier, 0, STAGES.length) | 0;
  out.castle = num(run.castle, 0.01, 1); if (out.castle === null) out.castle = 1;
  out.scrip = Math.floor(num(run.scrip, 0, 1e6) || 0);
  out.won = Math.floor(num(run.won, 0, 99) || 0); out.curse = Math.floor(num(run.curse, 0, 9) || 0);
  out.kills = Math.floor(num(run.kills, 0, 1e9) || 0); out.coins = Math.floor(num(run.coins, 0, 1e12) || 0);
  out.risk = Math.floor(num(run.risk, 0, CONQ.risk.length - 1) || 0); out.rerolls = Math.floor(num(run.rerolls, 0, 999) || 0);
  out.deck = Array.isArray(run.deck) ? run.deck.filter(id => typeof id === 'string' && UNIT_BY_ID[id]).slice(0, LOADOUT_MAX) : [];
  if (!out.deck.length) return null;
  const bless = {};
  if (run.bless && typeof run.bless === 'object') for (const k in run.bless) { const c = Math.floor(Number(run.bless[k])); if (CONQ_BLESS_BY_ID[k] && c > 0) bless[k] = Math.min(c, 99); }
  out.bless = bless;
  out.relics = Array.isArray(run.relics) ? [...new Set(run.relics.filter(id => CONQ_RELIC_BY_ID[id]))] : [];
  out.phoenixUsed = run.phoenixUsed === true;
  const okList = (kind, ids) => Array.isArray(ids) && ids.every(id => kind === 'relic' ? CONQ_RELIC_BY_ID[id] : CONQ_BLESS_BY_ID[id]);
  const okPend = p => p && typeof p === 'object' && (p.kind === 'relic' || p.kind === 'bless') && okList(p.kind, p.opts) && (!p.then || okPend(p.then)) &&
    (!p.got || !!CONQ_RELIC_BY_ID[p.got]);
  out.pending = okPend(run.pending) ? run.pending : null;
  const rm = run.room;
  out.room = rm && typeof rm === 'object' && (rm.t === 'rest' || rm.t === 'forge' || (rm.t === 'shrine' && CONQ_SHRINE_BY_ID[rm.id]) ||
    (rm.t === 'recruit' && Array.isArray(rm.opts) && rm.opts.every(id => UNIT_BY_ID[id])) ||
    (rm.t === 'shop' && Array.isArray(rm.items) && rm.items.every(i => i && (i.kind === 'heal' || okList(i.kind, [i.id])) && Number(i.price) >= 0))) ? rm : null;
  if (out.room && out.room.t === 'recruit' && out.room.pick && !UNIT_BY_ID[out.room.pick]) out.room = Object.assign({}, out.room, { pick: null });
  if (out.room && out.room.res) {          // 제단 결과에 적힌 이름이 사라진 것이면 결과만 비운다
    const r = out.room.res;
    if ((r.lost && !CONQ_BLESS_BY_ID[r.lost]) || (r.bless && !CONQ_BLESS_BY_ID[r.bless]) || (r.relic && !CONQ_RELIC_BY_ID[r.relic])) out.room = Object.assign({}, out.room, { res: { none: true } });
  }
  out.done = null; out.fighting = false;
  out.path = Array.isArray(run.path) ? run.path.slice(0, CONQ.floors).map(x => Number.isInteger(x) && x >= 0 && x < CONQ.lanes ? x : 0) : [];
  return out;
}
