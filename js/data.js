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
    hp: 600, atk: 52, range: 70, speed: 74, interval: 0.45,
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
    hp: 300, atk: 205, range: 520, speed: 16, interval: 3.4,
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
    ab: { haste: { mul: 0.7, dur: 4 }, radius: 240, interval: 3.5, noAttack: true },
    abText: '주변 아군 공격 간격 30% 감소',
    desc: '진군 나팔을 붑니다. 직접 싸우지 않지만 주변 아군의 공격 속도가 크게 오릅니다.'
  }),
  mk({
    id: 'longbow', name: '대궁병', role: '장거리', shape: 'longbow',
    body: '#2b3038', accent: '#6b8f3f', tunic: '#3f5a2f',
    hp: 340, atk: 118, range: 400, speed: 30, interval: 2.0,
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
    hp: 420, atk: 25, range: 70, speed: 40, interval: 2.0,
    cost: 210, cooldown: 16, kb: 2, unlockStage: 17,
    ab: { summon: { id: 'barricade', n: 1 }, interval: 9 },
    abText: '9초마다 방벽 설치',
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
    body:'#35364d',accent:'#edbc70',tunic:'#754764',hp:360,atk:190,range:290,speed:32,interval:2.5,
    cost:285,cooldown:11,kb:2,unlockStage:10,ranged:true,
    ab:{pierce:true},abText:'사선 위 적 관통 · 느린 장전',
    desc:'긴 총신으로 밀집 대열을 관통합니다. 빠른 적이 접근하지 못하게 하세요.'}),
  mk({id:'purifier',name:'새벽 정화사',role:'정화',shape:'purifier',
    body:'#d5ddd6',accent:'#a4f6cc',tunic:'#478479',hp:550,atk:0,range:0,speed:31,interval:3,
    cost:230,cooldown:16,kb:2,unlockStage:12,maxActive:2,
    ab:{cleanse:true,heal:55,radius:185,interval:4,noAttack:true},abText:'4초마다 중독·화상·둔화 해제 및 회복 · 최대 2명',
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
    body:'#2b3038',accent:'#c98a3a',tunic:'#5a6b3a',hp:380,atk:84,range:340,speed:34,interval:1.6,
    cost:235,kb:2,ranged:true,unlockStage:10,
    ab:{backline:true,hunter:1.6},abText:'매가 뒷줄을 노림 · 원거리 적에게 1.6배',
    desc:'매를 날려 적 뒷줄의 궁수와 주술사부터 낚아챕니다. 앞의 덩치는 다른 병력에게 맡기세요.'}),
  mk({id:'bellringer',name:'종지기',role:'부동',shape:'bellringer',
    body:'#2b3038',accent:'#e8c65a',tunic:'#6b4a7a',hp:720,atk:0,range:0,speed:30,interval:3,
    cost:220,kb:1,unlockStage:15,maxActive:2,
    ab:{ward:{dur:3},heal:40,radius:220,interval:5,noAttack:true},
    abText:'5초마다 종소리 · 기절·둔화 풀고 3초 기절 면역 · 조금 회복 · 최대 2명',
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
    body:'#2b3038',accent:'#9fd8e8',tunic:'#2f5a6b',hp:600,atk:95,range:210,speed:40,interval:1.6,
    cost:180,kb:2,ranged:true,unlockStage:31,
    ab:{breaker:1.35,slow:1.0},abText:'작살 · 갑주 무시 · 단단한 적 1.35배 · 1초 둔화',
    desc:'밧줄 달린 작살로 등딱지째 꿰고 끌어당깁니다. 집게 게와 어인을 상대하는 바닷가의 기본 병종입니다.'}),
  mk({id:'corsair',name:'해적 검사',short:'해적검사',role:'칼춤',shape:'corsair',castFx:'slash',
    body:'#2b3038',accent:'#e8c65a',tunic:'#8e2f3a',hp:1300,atk:120,range:70,speed:70,interval:.75,
    cost:260,kb:2,unlockStage:33,
    ab:{dodge:.2,lifesteal:.15},abText:'칼춤 · 공격 20% 회피 · 흡혈 15%',
    desc:'갑판 위에서 단련한 쌍검잡이입니다. 창끝을 흘려 넘기며 나가 창병의 품으로 파고듭니다.'}),
  mk({id:'beacon',name:'등대지기',role:'등불',shape:'beacon',
    body:'#2b3038',accent:'#ffe9a0',tunic:'#3f6bb5',hp:900,atk:0,range:0,speed:30,interval:3,
    cost:250,kb:1,unlockStage:34,maxActive:2,
    ab:{ward:{dur:3},barrier:120,radius:230,interval:5,noAttack:true},
    abText:'5초마다 등불 · 홀림·기절·둔화 해제와 3초 면역 · 보호막 120 · 최대 2명',
    desc:'바다 건너까지 비추는 등불을 듭니다. 세이렌의 노래에 홀린 병사도 등불 아래에선 정신을 차립니다.'}),
  mk({id:'stormcaller',name:'폭풍술사',role:'뇌우',shape:'stormcaller',castFx:'storm',
    body:'#2b3038',accent:'#9ad8ff',tunic:'#2a3a6b',hp:620,atk:110,range:280,speed:28,interval:2.2,
    cost:420,kb:2,ranged:true,area:true,areaRadius:80,unlockStage:36,
    ab:{chain:{n:3,fall:.6,range:130}},abText:'뇌우 · 범위 벼락이 세 번 튕김',
    desc:'바다 위 먹구름을 불러 벼락을 내립니다. 떼로 몰려오는 해파리와 장어에게 특히 강합니다.'}),
  mk({id:'anchorguard',name:'닻 수호병',short:'닻수호병',role:'닻',shape:'anchorguard',castFx:'tidal',
    body:'#2b3038',accent:'#8fa3b5',tunic:'#3a4a5a',hp:4200,atk:140,range:80,speed:26,interval:1.6,
    cost:460,kb:1,scale:1.25,unlockStage:38,
    ab:{kbImmune:true,armor:.3,slow:1.2,push:30},abText:'닻 · 넉백 면역 · 갑주 30% · 맞은 적 둔화',
    desc:'거대한 닻을 휘둘러 전열을 붙듭니다. 해일도 밀어내지 못하는 마지막 둑입니다.'}),
  // 소환 전용
  mk({
    id: 'barricade', name: '나무 방벽', role: '구조물', shape: 'barricade',
    body: '#7a5a34', accent: '#5c4326', tunic: '#7a5a34',
    hp: 1600, atk: 0, range: 0, speed: 0, interval: 3,
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
    ab: { stun: { chance: 0.35, dur: 1.6 }, slow: 2 },
    abText: '35% 석화(기절) · 둔화',
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
    body:'#b4bdc4',accent:'#7be6ff',tunic:'#28495e',hp:1600,atk:150,range:290,speed:27,interval:2.2,
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
    body:'#e9e4dc',accent:'#9fd3ff',tunic:'#17171d',hp:1700,atk:120,range:95,speed:32,interval:1.6,
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
    body:'#2b3038',accent:'#b0b6bd',tunic:'#5a6b3a',hp:280,atk:50,range:300,speed:40,interval:1.3,
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
    body:'#e8c8a8',accent:'#ff7a3c',tunic:'#d8453a',hp:1300,atk:95,range:80,speed:95,interval:1.1,
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
  // 소환 전용
  mk({id:'monkeyclone',name:'분신',role:'소환수',shape:'monkeyclone',unlockStage:999,
    body:'#c98a4a',accent:'#ffd24a',tunic:'#b8322e',hp:520,atk:60,range:80,speed:60,interval:1.0,
    cost:0,cooldown:0,kb:2,ab:{dodge:.2},
    desc:'손오공의 털 한 가닥이 변한 분신입니다. 잠시 뒤 연기처럼 사라집니다.'})
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
UNITS.forEach(u => { if (u.cost > 0 && !u.maxActive) u.maxActive = stackCap(u.cost); });

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
  harpoon: 7.5, corsair: 13.7, beacon: 15.0, stormcaller: 33.0, anchorguard: 40.0
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
    units: ['wukong', 'nezha', 'sanzang', 'bajie', 'wujing', 'monkey', 'celestial'] }
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
              special: { t: 'veil', name: '안개화 · 출진과 액티브를 멈추세요', first: 10, cd: 14, dur: 4.5, r: 300, dmg: 160, ratio: 0.8, charm: 6 },
              phases: [
                { at: 0.70, t: 'summon', name: '밤의 권속', id: 'bat', n: 6 },
                { at: 0.40, t: 'swap', name: '핏빛 월식', atk: 1.15,
                            special: { t: 'veil', name: '안개화 · 출진과 액티브를 멈추세요', first: 3, cd: 10, dur: 5, r: 340, dmg: 200, ratio: 0.9, charm: 6 } },
                { at: 0.15, t: 'enrage', name: '피의 갈증', atk: 1.25, rate: 0.8 }
              ],
              abText: '안개화 · 주기적으로 안개가 되어 어떤 공격도 받지 않고 피를 빱니다. 안개 속에 내보낸 병사는 홀리고, 액티브는 삼켜집니다' },
  titan:    { name: '대지 거신', body: '#6a6458', accent: '#ffb03c', tunic: '#4a453c', shape: 'titan',
              hp: 30000, atk: 900, range: 170, speed: 14, interval: 2.8, kb: 1, gold: 900,
              area: true, areaRadius: 160, scale: 2.2, boss: true,
              ab: { kbImmune: true, core: { armor: 0.95, mul: 3.6 } },
              special: { t: 'slam', name: '대지 분쇄', first: 9, cd: 15, dmg: 1100, radius: 220, warn: 2.4, stun: 1.2, expose: 6 },
              phases: [
                { at: 0.60, t: 'summon', name: '바위 떼', id: 'rockling', n: 3 },
                { at: 0.30, t: 'swap', name: '거신의 분노',
                            special: { t: 'slam', name: '대지 분쇄', first: 4, cd: 11, dmg: 1300, radius: 240, warn: 2.2, stun: 1.4, expose: 5 } }
              ],
              abText: '용암 핵 · 평소엔 피해 95% 감소, 대지 분쇄 뒤 6초간 핵이 드러나 3.6배 — 그때 액티브와 왕명을' },
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
                { at: 0.35, t: 'swap', name: '마왕 강림', core: { armor: 0.8, mul: 2.8 }, atk: 1.15,
                            special: { t: 'slam', name: '종말의 일격', first: 4, cd: 12, dmg: 1500, radius: 250, warn: 2.3, stun: 1.4, expose: 6 } },
                { at: 0.12, t: 'enrage', name: '마왕의 광기', atk: 1.25, rate: 0.8, speed: 1.2 }
              ],
              abText: '세 얼굴 · 출진 지점 포격 → 반사 결계 → 핵 노출. 페이즈마다 다른 타이밍을 요구합니다' },
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
  {name:'★ 명계의 삼중 봉인',hint:'근접 벽 뒤에서 해골을 부르는 리치를 먼저 노리세요',baseHp:38000,money:420,rate:51,reward:1350,boss:true,enemyMul:3.2,waves:[
    W(2,'wraith',5,2),W(24,'lich',1),W(48,'spiderqueen',1),W(70,'plaguer',6,1.8),W(96,'troll',1),W(122,'lich',1),W(148,'orcshield',5,2),W(174,'spiderqueen',1),W(204,'wraith',8,1)]},
  {name:'눈보라 추격전',hint:'빠른 늑대 기수를 둔화로 저지',baseHp:39500,money:425,rate:52,reward:1250,enemyMul:2.29,waves:[
    W(2,'wolf',10,.8),W(24,'dark',5,2),W(48,'frostgiant',1),W(72,'wolf',10,.8),W(96,'orccatapult',2,5),W(120,'orcberserk',7,1.2),W(148,'frostgiant',1),W(180,'golem',2,5),W(208,'wolf',12,.7)]},
  {name:'얼어붙은 공성로',hint:'공성 병기를 막을 보호막 전열 필요',baseHp:41000,money:430,rate:53,reward:1320,enemyMul:2.46,waves:[
    W(2,'orcshield',4,2),W(22,'siegeram',2,5),W(46,'ballista',6,2),W(72,'frostgiant',1),W(100,'orcshield',6,1.8),W(126,'orccatapult',3,5),W(154,'warchief',2,5),W(184,'frostgiant',1),W(214,'dark',7,1.8)]},
  {name:'★ 영원의 겨울 왕좌',hint:'연속 광역 공격 뒤 왕명으로 회복',baseHp:44000,money:440,rate:54,reward:1600,boss:true,enemyMul:11.2,waves:[
    W(2,'wolf',8,1),W(24,'frostgiant',1),W(52,'troll',1),W(78,'orcshield',6,1.8),W(104,'frostgiant',1),W(136,'golem',2,5),W(164,'warchief',2,5),W(192,'frostgiant',1),W(224,'orcberserk',8,1)]},
  {name:'불타는 태양 회랑',hint:'화상을 정화하며 화룡을 견제',baseHp:45500,money:445,rate:55,reward:1500,enemyMul:6,waves:[
    W(2,'hellhound',9,.8),W(26,'powder',6,1.8),W(52,'drake',1),W(80,'plaguer',6,2),W(108,'orcshield',6,1.8),W(138,'drake',1),W(170,'hellhound',10,.8),W(200,'siegeram',2,4),W(230,'dark',7,1.5)]},
  {name:'황금 일식의 제단',hint:'치유·가속 토템을 범위 공격으로 압박',baseHp:47500,money:450,rate:56,reward:1650,boss:true,enemyMul:4.2,waves:[
    W(2,'orcshield',5,2),W(26,'totem',2,6),W(50,'shaman',5,3),W(78,'warlord',1),W(108,'golem',2,5),W(140,'drake',1),W(174,'warchief',3,5),W(208,'orcberserk',8,1),W(240,'lich',2,8)]},
  {name:'★ 세 신화의 종착지',hint:'원거리 호위를 먼저 걷어 내고, 대군주에게 액티브와 왕명을 집중하세요',baseHp:51000,money:465,rate:58,reward:2200,boss:true,enemyMul:11,waves:[
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
  {name:'안개 등대',hint:'세이렌의 노래 · 등대지기의 등불이 홀림을 풉니다',baseHp:60000,money:485,rate:62,reward:2700,enemyMul:27.0,waves:[
    W(2,'nagaspear',6,1),W(20,'siren',2,3),W(40,'deepone',4,2),W(62,'siren',3,2.5),W(86,'clawcrab',5,1.8),W(112,'seahook',2,4),W(138,'nagaspear',8,.9),W(166,'siren',3,2.5),W(194,'deepone',5,1.8)]},
  {name:'세이렌의 암초',hint:'노래하는 세이렌을 매 조련사와 원거리로 먼저',baseHp:62000,money:490,rate:63,reward:2800,enemyMul:27.0,waves:[
    W(2,'siren',3,2),W(22,'nagaspear',8,.9),W(44,'seahook',2,4),W(66,'siren',4,2),W(90,'eel',10,.5),W(116,'tidecaller',2,5),W(142,'deepone',5,1.8),W(170,'siren',4,2),W(200,'clawcrab',6,1.6)]},
  {name:'★ 해일 여왕의 신전',hint:'해일에 밀려도 닻 수호병은 버팁니다 · 여왕이 부르는 나가를 걷어 내세요',baseHp:65000,money:500,rate:64,reward:3200,boss:true,enemyMul:14.0,waves:[
    W(2,'nagaspear',8,.9),W(26,'tidequeen',1),W(50,'siren',3,2.5),W(76,'clawcrab',6,1.6),W(104,'tidecaller',2,5),W(132,'deepone',5,1.8),W(162,'nagaspear',10,.8),W(194,'eel',12,.5)]},
  {name:'침몰한 도시',hint:'단단한 무리 · 파쇄와 범위로',baseHp:66000,money:505,rate:64,reward:3000,enemyMul:36.0,waves:[
    W(2,'clawcrab',6,1.6),W(24,'deepone',5,1.8),W(48,'jelly',12,.5),W(72,'seahook',3,3),W(98,'clawcrab',8,1.4),W(126,'golem',2,5),W(154,'deepone',6,1.6),W(184,'nagaspear',10,.8),W(214,'clawcrab',8,1.4)]},
  {name:'폭풍 해협',hint:'질주하는 장어와 영웅 사냥꾼 · 값싼 벽과 범위로',baseHp:68000,money:510,rate:65,reward:3100,enemyMul:16.0,waves:[
    W(2,'eel',12,.5),W(22,'nagaspear',8,.9),W(46,'tidecaller',2,4),W(70,'eel',14,.4),W(96,'siren',4,2),W(122,'hellhound',8,.7),W(150,'nagaspear',10,.8),W(180,'eel',16,.4),W(210,'deepone',6,1.6)]},
  {name:'심연의 문',hint:'모든 바다 군단 · 등불과 파쇄를 함께',baseHp:70000,money:515,rate:66,reward:3300,enemyMul:20.0,waves:[
    W(2,'clawcrab',6,1.6),W(24,'siren',4,2),W(48,'deepone',6,1.6),W(74,'seahook',3,3),W(100,'tidecaller',2,4),W(126,'eel',14,.4),W(154,'clawcrab',8,1.4),W(184,'siren',5,1.8),W(214,'deepone',8,1.4),W(244,'nagaspear',12,.7)]},
  {name:'★ 리바이어던의 심연',hint:'해일 낙하 예고를 피하고, 심연이 열리면 왕명으로 버티세요',baseHp:76000,money:530,rate:68,reward:4200,boss:true,enemyMul:20.0,waves:[
    W(2,'nagaspear',8,.9),W(26,'leviathan',1),W(52,'siren',4,2),W(80,'clawcrab',8,1.4),W(110,'deepone',6,1.6),W(140,'tidecaller',3,4),W(170,'eel',16,.4),W(200,'seahook',3,3),W(230,'nagaspear',12,.7),W(262,'clawcrab',10,1.2)]}
);


/* 전장 특성. 어려운 전장에는 특성이 붙어서, 스탯 높은 병종을 몰아 넣는 것만으로는
 * 풀리지 않고 그 특성을 받아칠 병종을 챙겨야 한다. */
const STAGE_MODS = {
  ironclad: { name: '중갑', desc: '모든 적이 방어 60%(보스는 30%) — 아군의 공격 피해가 크게 줄어듭니다 (중독·화상은 그대로)',
              counter: '토르(파쇄) · 중독 · 화상 · 태양 낙인', color: '#8fa3b5' },
  horde:    { name: '물량', desc: '적이 1.8배 많이 몰려옵니다 (하나하나는 약함)',
              counter: '범위 공격 · 연쇄 번개 · 값싼 방패 벽', color: '#c98a4b' },
  giantslayer: { name: '영웅 사냥꾼', desc: '적이 비용 350 이상인 아군(영웅·전설·신화)에게 3배 피해',
              counter: '값싼 병력을 많이 · 소환물 · 비싼 병종은 뒤에', color: '#9b6bd1' },
  curse:    { name: '저주', desc: '소환된 아군이 초당 10%씩 시들고, 회복·흡혈이 절반',
              counter: '소환·치유에 기대지 않는 진짜 병력', color: '#5f8f5a' },
  blitz:    { name: '질주', desc: '적 이동 속도 +45% · 공격 속도 +20%',
              counter: '둔화 · 넉백 면역 방패 · 튼튼한 앞줄', color: '#d0605a' }
};
const HARD_STAGE_MODS = {
  9: ['ironclad'], 14: ['blitz'], 16: ['horde'], 17: ['ironclad', 'giantslayer'],
  19: ['horde', 'ironclad', 'giantslayer'],
  21: ['horde'], 23: ['horde', 'giantslayer', 'curse'], 24: ['blitz'], 26: ['blitz', 'giantslayer', 'curse'],
  27: ['horde', 'ironclad'], 29: ['giantslayer', 'curse', 'horde', 'blitz'],
  // 3막
  33: ['curse'], 36: ['ironclad', 'horde'], 37: ['blitz', 'giantslayer'], 38: ['ironclad', 'curse', 'blitz']
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
                    troll: 'bruiser', frostgiant: 'bruiser', warlord: 'bruiser',
                    lich: 'caster', spiderqueen: 'caster', drake: 'flyer' };
const BOSS_ESCORT = {
  bruiser: { back: ['ballista', 'slinger', 'shaman', 'hexer', 'plaguer', 'orccatapult'], front: ['wolf', 'assassin', 'hellhound', 'orcspear'], nb: 4, nf: 2,
             sea: { back: ['siren', 'seahook'], front: ['nagaspear', 'eel'] } },
  caster:  { back: ['ballista', 'skelarcher', 'plaguer'], front: ['orcshield', 'boneguard', 'orcspear', 'orcberserk', 'chariot', 'dark'], nb: 2, nf: 4,
             sea: { back: ['siren', 'tidecaller'], front: ['clawcrab', 'deepone', 'nagaspear'] } },
  flyer:   { back: ['shaman', 'hexer', 'ballista'], front: ['orcshield', 'burrower', 'hellhound', 'boneguard', 'orcberserk', 'golem'], nb: 2, nf: 3 }
};
/* 전장 번호(0부터) → 그 전장의 보스 */
const STAGE_BOSS = { 4: 'lich', 9: 'troll', 12: 'lich', 14: 'troll', 16: 'frostgiant', 17: 'drake',
                     18: 'spiderqueen', 19: 'warlord', 21: 'lich', 23: 'lich', 26: 'frostgiant',
                     28: 'drake', 29: 'warlord', 32: 'kraken', 35: 'tidequeen', 39: 'leviathan' };
const ELITE_FOR = { troll: ['ogre', 1], lich: ['shaman', 2], frostgiant: ['golem', 1],
                    drake: ['hellhound', 3], spiderqueen: ['spider', 4], warlord: ['warchief', 1] };
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
      const esc0 = BOSS_ESCORT[BOSS_ROLE[sig]];
      // 3막 보스는 바다 군단이 호위한다
      const esc = i >= ACT3_FROM && esc0.sea ? Object.assign({}, esc0, esc0.sea) : esc0;
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
    const esc = BOSS_ESCORT[st.bossRole];
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
  const n = 2 + Math.floor(i / 7);
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
  'shore', 'reef', 'stormsea', 'lighthouse', 'reef', 'sunken', 'sunken', 'stormsea', 'abyss', 'abyss'];
const STAGE_MUSIC = ['meadow', 'wheat', 'river', 'wolfwood', 'graveyard', 'cave', 'hills', 'camp', 'canyon', 'fortress',
  'darkwood', 'ruins', 'return', 'shieldwall', 'gate', 'swamp', 'snowpass', 'volcano', 'warcamp', 'throne',
  'blackriver', 'underworld', 'thorngate', 'seal', 'blizzard', 'siege', 'winterthrone', 'desert', 'eclipse', 'mythic',
  'shore', 'coral', 'krakenbay', 'lighthouse', 'sirensong', 'tidetemple', 'sunken', 'strait', 'abyssgate', 'leviathan'];
STAGES.forEach((st, i) => {
  st.look = st.look || STAGE_LOOKS[i] || 'meadow';
  st.music = st.music || STAGE_MUSIC[i] || 'meadow';
});
STAGES[29].finale = true;                      // 2막의 끝: 세 신화의 종착지
STAGES[STAGES.length - 1].bossMusic = 'finale2';   // 3막의 끝은 따로 한 곡 (3.3)

/* 전장 길이. 예전엔 모두 2000 이라 병사가 적과 부딪히기까지 40초 넘게 걸어야 했다.
 * 초반은 짧게 붙고, 뒤로 갈수록·보스 전장일수록 조금씩 길어진다. */
STAGES.forEach((st, i) => {
  if (st.len) return;
  // 레벨마다 조금씩 다르게: 뒤로 갈수록 길어지되, 사이사이 짧은 전장이 섞인다
  const wiggle = [0, -70, 50, -40, 80][i % 5];
  const base = i < 20 ? 900 + 20 * i : i < 30 ? 1180 + 18 * (i - 20) : 1300 + 12 * (i - 30);   // 3막은 조금 짧게 다시 시작
  st.len = base + wiggle + (st.boss ? 120 : 0);
});

/* =======================================================================
 *  이벤트 전장 (3.2) — 극악 난이도 도전 다섯.
 *
 *  보스마다 "언제 무엇을 하느냐" 를 묻는 기믹이 하나씩 있다. 카드를 나오는 대로 내고
 *  액티브를 쿨마다 눌러서는 잘 이기지 못한다(시뮬레이터 공략 편성 승률 50% 이하).
 *   - 흡혈 백작: 안개화 중엔 무적 — 액티브를 안개가 걷힌 뒤로 아낀다
 *   - 대지 거신: 핵이 85%를 막다가 내려찍은 뒤 6초만 드러난다 — 그때 액티브·왕명을 몰아 쓴다
 *   - 유령 선장: 출진 지점 포격 — 포탄이 떨어진 다음에 병사를 내보낸다
 *   - 공허의 군주: 반사 결계 중에 때리면 되돌아온다 — 결계 중엔 액티브를 참는다
 *   - 마왕: 세 얼굴(포격 → 반사 → 핵)을 차례로
 *  캠페인 진도와 따로 기록한다(save.events[id] = 별 수). 처음 넘으면 큰 보상.
 * ======================================================================= */
const EVENT_STAGES = [
  { name: '핏빛 월식', bossId: 'vampire', bossRole: 'caster', boss: true, look: 'graveyard', music: 'underworld',
    bossMusic: 'boss_lich', mods: ['curse'], baseHp: 36000, money: 520, rate: 58, reward: 0, enemyMul: 10, bossMul: { hp: 20, atk: 1.6 },
    fury: { per30: 0.1, max: 1.2 }, len: 1500,
    event: { id: 'eclipse', deck: ['thor','zeus','ra','odin','pyro','javelin','knight','spartan','frost','catapult'],
             unlock: 10, reward: 6000, stones: 12,
             mech: '안개화 중엔 무적 · 출진과 액티브는 안개가 걷힌 뒤에' },
    waves: [W(2,'bat',8,.6), W(14,'bloodthrall',3,2), W(30,'hexer',3,1.6), W(40,'vampire',1), W(44,'bloodthrall',3,1.6),
            W(70,'wraith',5,1.4), W(96,'bat',10,.5), W(120,'bloodthrall',4,1.6), W(150,'hexer',4,1.4), W(180,'wraith',6,1.2),
            W(210,'bloodthrall',5,1.4)] },
  { name: '거신의 망치', bossId: 'titan', bossRole: 'bruiser', boss: true, look: 'volcano', music: 'volcano',
    bossMusic: 'boss_troll', mods: ['ironclad'], baseHp: 42000, money: 540, rate: 60, reward: 0, enemyMul: 10, bossMul: { hp: 5.6, atk: 1.6 },
    fury: { per30: 0.1, max: 1.2 }, len: 1550,
    event: { id: 'titan', deck: ['thor','ra','odin','rapriest','venom','pyro','alchemist','javelin','shield','knight'],
             unlock: 15, reward: 9000, stones: 15,
             mech: '핵은 내려찍은 뒤 6초만 드러난다 · 그때 액티브와 왕명을' },
    waves: [W(2,'rockling',4,1.4), W(16,'stoneward',1), W(26,'orcspear',6,1), W(40,'titan',1), W(46,'stoneward',2,4),
            W(66,'rockling',6,1.2), W(92,'golem',2,5), W(120,'stoneward',2,4), W(146,'siegeram',2,5), W(176,'rockling',8,1),
            W(206,'golem',2,5)] },
  { name: '망령 함대', bossId: 'ghostcaptain', bossRole: 'caster', boss: true, look: 'blackriver', music: 'blackriver',
    bossMusic: 'boss_drake', mods: ['blitz'], baseHp: 44000, money: 560, rate: 62, reward: 0, enemyMul: 6, bossMul: { hp: 2, atk: 1.6 },
    fury: { per30: 0.1, max: 1.3 }, len: 1550,
    event: { id: 'fleet', deck: ['zeus','odin','thor','shield','spartan','frost','frostlancer','pyro','catapult','knight'],
             unlock: 20, reward: 12000, stones: 18,
             mech: '출진 지점에 포격 · 포탄이 떨어진 다음에 내보내기' },
    waves: [W(2,'ghostsailor',6,.8), W(18,'ghostgunner',2,3), W(34,'wraith',4,1.2), W(40,'ghostcaptain',1),
            W(46,'ghostsailor',5,.8), W(72,'ghostgunner',3,3), W(100,'ghostsailor',8,.7), W(128,'wraith',6,1),
            W(156,'ghostgunner',3,3), W(186,'ghostsailor',10,.6), W(216,'wraith',8,.9)] },
  { name: '혼돈의 균열', bossId: 'voidlord', bossRole: 'caster', boss: true, look: 'eclipse', music: 'eclipse',
    bossMusic: 'boss_spiderqueen', mods: ['horde'], baseHp: 48000, money: 580, rate: 64, reward: 0, enemyMul: 10, bossMul: { hp: 4.8, atk: 1.6 },
    fury: { per30: 0.1, max: 1.3 }, len: 1600,
    event: { id: 'rift', deck: ['zeus','odin','thor','pyro','catapult','frost','knight','shield','spear','mage'],
             unlock: 25, reward: 15000, stones: 20,
             mech: '반사 결계 중엔 액티브·왕명 금지 · 되돌아온다' },
    waves: [W(2,'voidspawn',6,.8), W(16,'riftcaller',1), W(30,'mirror',3,1.6), W(40,'voidlord',1), W(46,'voidspawn',6,.8),
            W(72,'riftcaller',2,4), W(98,'mirror',4,1.4), W(124,'voidspawn',10,.6), W(152,'souleater',2,4),
            W(180,'riftcaller',2,4), W(210,'voidspawn',12,.5)] },
  { name: '마왕 강림', bossId: 'demonking', bossRole: 'bruiser', boss: true, look: 'mythic', music: 'mythic',
    bossMusic: 'finale', mods: ['giantslayer', 'curse'], baseHp: 56000, money: 600, rate: 66, reward: 0, enemyMul: 10, bossMul: { hp: 2.5, atk: 1.7 },
    fury: { per30: 0.12, max: 1.5 }, len: 1650,
    event: { id: 'demonking', deck: ['spear','shield','javelin','venom','catapult','pyro','frost','knight','musketeer','sniper'],
             unlock: 30, reward: 25000, stones: 30,
             mech: '포격 → 반사 결계 → 핵 노출 · 페이즈마다 다른 타이밍' },
    waves: [W(2,'imp',8,.6), W(16,'demonknight',1), W(30,'hellhound',6,.9), W(40,'demonking',1), W(46,'imp',8,.6),
            W(70,'demonknight',2,4), W(96,'warchief',2,4), W(122,'imp',12,.5), W(150,'demonknight',2,4),
            W(180,'hellhound',10,.6), W(212,'demonknight',3,3)] }
];
EVENT_STAGES.forEach((st, k) => { st.eventIndex = k; st.opening = 'rush'; });
function eventOpen(s, k) { return !!EVENT_STAGES[k] && (s.cleared || 0) >= EVENT_STAGES[k].event.unlock; }
function eventCount(s) { let n = 0; for (const st of EVENT_STAGES) if (s.events && s.events[st.event.id]) n++; return n; }

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
const ENDLESS_BOSSES = ['lich', 'troll', 'frostgiant', 'drake', 'warlord'];

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
    name: '무한 전장', endless: true, infinite: !waveCount, len: 1250, look: 'endless',
    baseHp: 2000000,           // 3.2.1: 부술 수 있다 — 무너뜨리면 '요새 함락' 으로 끝나고 보상이 1.5배
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
  { id: 'hard40',   name: '심연도 꺾지 못한 왕국', desc: '하드코어 전장 40곳 모두 돌파', gold: 40000, stone: 30,
    test: s => hardCount(s) >= 40 },
  { id: 'event1',   name: '극악의 문턱', desc: '이벤트 전장 1곳 돌파',            gold: 3000, stone: 5,
    test: s => eventCount(s) >= 1 },
  { id: 'event5',   name: '마왕을 넘어선 자', desc: '이벤트 전장 5곳 모두 돌파',   gold: 30000, stone: 30,
    test: s => eventCount(s) >= 5 }
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

function applyEvolution(r, e) {
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
  if (e.cost) for (const k in e.cost) {
    if (k.indexOf('ab.') === 0) { const v = _getPath(r.ab, k.slice(3)); if (typeof v === 'number') _setPath(r.ab, k.slice(3), _r2(v * e.cost[k])); }
    else if (typeof r[k] === 'number') r[k] = k === 'interval' ? _r2(r[k] * e.cost[k]) : Math.round(r[k] * e.cost[k]);
  }
  r.evoMinus = evoCostText(e);
}

/* 레벨이 오를 때 체력·공격 말고 좋아지는 것들. k = 레벨 - 1 */
function growUnit(r, lv) {
  const k = Math.max(0, (lv || 1) - 1);
  if (!k) return;
  const ab = r.ab;
  if (r.ranged && r.range) r.range = Math.round(r.range * (1 + 0.008 * k));
  if (!ab) return;
  const support = ab.heal || ab.barrier || ab.haste || ab.cleanse || ab.rally || ab.summon || ab.ward || ab.pacify;
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
  armor: '갑주', life: '유지'
};
function unitRoleStats(r, pw) {
  const ab = r.ab || {}, L = STAT_LABELS, out = [];
  const pct = v => Math.round(v * 100) + '%';
  const support = ab.heal || ab.barrier || ab.haste || ab.cleanse || ab.rally || ab.summon || ab.ward || ab.pacify;
  if (ab.heal) out.push([L.heal, Math.round(ab.heal * pw)]);
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
  return out;
}

/* 레벨·진화를 반영한 병종. 전투·카드·훈련소가 모두 이것을 본다. */
const _resolved = {};
/* 3.4 영웅의 체급. 전설·신화는 역할로 값을 하되, 몸집과 힘도 일반 병사보다 한 수 위여야 한다.
 * 근접 영웅은 앞에서 맞으며 싸우니 체력과 갑주를 더 받는다(예전엔 뭘 해 보기도 전에 쓰러졌다). */
const HERO_POWER = { UR: { hp: 1.35, atk: 1.2 }, SSR: { hp: 1.25, atk: 1.15 } };
const HERO_MELEE = { hp: 1.3, armor: 0.1, revive: 0.3 };
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
  }
}
function resolveUnit(u, lv, evo) {
  if (!u) return u;
  lv = Math.max(1, lv || 1);
  const ev = !!(evo && EVOLUTIONS[u.id] && lv >= EVO_LEVEL);
  const key = u.id + '|' + lv + '|' + (ev ? 1 : 0);
  if (_resolved[key]) return _resolved[key];
  const r = Object.assign({}, u);
  r.base = u;
  r.level = lv;
  r.ab = u.ab ? JSON.parse(JSON.stringify(u.ab)) : null;
  if (u.active) r.active = Object.assign({}, u.active);
  if (ev) applyEvolution(r, EVOLUTIONS[u.id]);
  growUnit(r, lv);
  heroBuild(r);
  _resolved[key] = r;
  return r;
}
/* 저장에서 이 병종이 지금 진화 형태를 쓰는가 */
function usesEvo(save, id) {
  return !!(save && save.evo && save.evo[id] === true && (save.levels && save.levels[id] || 1) >= EVO_LEVEL);
}
function unitFor(save, id) {
  const u = UNIT_BY_ID[id];
  return resolveUnit(u, (save && save.levels && save.levels[id]) || 1, usesEvo(save, id));
}

/* =======================================================================
 *  하드코어. 돌파한 전장을 한 번 더, 훨씬 모질게.
 *   - 적 체력·공격 ×3.5(최소 ×5), 적 요새 체력 ×2(최소 40000), 전장 특성 하나가 더 붙는다 (3.1: ×1.5 → ×3.5)
 *   - 격앙: 싸움이 30초 길어질 때마다 새로 나오는 적이 15% 더 억세진다 (최대 2.5배)
 *   - 아군 성채 체력 60%, 왕의 명령 재사용 대기 1.5배, 모든 적 기절 저항 30%
 *   - 이기면 보상 골드 3배, 처음 이기면 소환석 5개와 왕관 기록
 *   다 키운 공략 편성으로도 30곳 중 절반 남짓만 넘는다 (`npm run balance` 가 검사).
 * ======================================================================= */
const HARDCORE = { enemyMul: 3.5, fortMul: 2, castleMul: 0.6, cmdMul: 1.5, reward: 3, stones: 5, stunResist: 0.3,
                   fury: { per30: 0.15, max: 1.5 },   // 3.1: 오래 끌수록 새로 나오는 적이 억세진다 (최대 2.5배)
                   // 앞쪽 전장도 모질게: 적 배율과 요새 체력에 바닥을 깐다 (2막 초입 수준)
                   mulFloor: 5, fortFloor: 40000,
                   twists: ['blitz', 'horde', 'ironclad', 'curse'] };
function hardcoreEnemyMul(st) { return Math.max((st.enemyMul || 1) * HARDCORE.enemyMul, HARDCORE.mulFloor); }
function hardcoreFortHp(st) { return Math.max(Math.round(st.baseHp * HARDCORE.fortMul), HARDCORE.fortFloor); }
function hardcoreMods(st, i) {
  const base = (st && st.mods) || [];
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
