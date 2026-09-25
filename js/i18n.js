/* =======================================================================
 *  막대 왕국 전쟁 - 번역 (한국어 원문 → English)
 *
 *  게임은 한국어로 쓰여 있고, 영어를 고르면 세 곳을 바꾼다.
 *   1) 병종·적·전장 같은 자료(data.js)의 글자를 시작할 때 한 번 바꾼다
 *   2) 화면에 붙는 글자는 MutationObserver 로 지켜보다가 바꾼다
 *      - 통째로 맞는 문장이 있으면 그것을
 *      - 없으면 숫자 붙은 말(12초, 5전장)을 먼저, 나머지는 아는 구절끼리 바꾼다
 *   3) 캔버스에 직접 쓰는 몇 마디는 render.js 가 t() 로 부른다
 *  한국어일 때는 아무 일도 하지 않는다.
 * ======================================================================= */

const I18N_EN = {
  /* ---------------- 병종 ---------------- */
  '창병': 'Spearman', '근접': 'Melee',
  '값싸고 빨리 나오는 징집병. 창이 길어 한 방은 먼저 내지른다.': 'Cheap, fast conscript. The long spear lands the first blow.',
  '방패병': 'Shieldman', '방어': 'Defense',
  '두꺼운 방패로 전선을 버틴다. 오래 버티며 조금씩 갉는다.': 'Holds the line behind a thick shield, chipping away slowly.',
  '궁수': 'Archer', '원거리': 'Ranged',
  '뒤에서 활을 쏜다. 앞줄이 뚫리면 순식간에 쓰러진다.': 'Shoots from the back. Falls fast once the front line breaks.',
  '싸우지 않는 대신 2.4초마다 주변 아군의 상처를 꿰맨다.': 'Never fights; mends nearby allies every 2.4s.',
  '주변 아군 회복 · 공격 안 함': 'Heals nearby allies · no attack',
  '사제': 'Priest', '치유': 'Healer',
  '쌍도끼를 미친 듯이 휘두른다. 방패병 뒤에 세워야 산다.': 'Swings twin axes like mad. Keep a shield in front of him.',
  '광전사': 'Berserker', '돌격': 'Assault',
  '독을 바른 화살을 쏜다. 체력 큰 적일수록 독이 잘 듣는다.': 'Fires poisoned arrows. Poison hurts big foes the most.',
  '중독 48/초 · 5초': 'Poison 48/s · 5s', '독침궁수': 'Venom Archer', '독침 궁수': 'Venom Archer', '중독': 'Poison',
  '적진까지 달려가 화약통을 터뜨린다. 한 방이 아주 아프다.': 'Runs into the enemy and lights a powder keg. One huge blast.',
  '범위 폭발': 'Area blast', '화약병': 'Bomber', '자폭형': 'Kamikaze',
  '성문 앞에 자리를 잡고 물자를 판다. 살아 있는 동안 군자금이 더 빨리 찬다.': 'Sets up shop by the gate. War funds fill faster while alive.',
  '초당 군자금 +12 · 최대 3명 · 공격 강화 미적용': 'Funds +12/s · max 3 · no attack upgrades',
  '상인': 'Merchant', '종군 상인': 'Camp Merchant', '보급': 'Supply',
  '대검을 휘둘러 앞의 여럿을 함께 벤다. 왕국군의 중핵.': 'Cleaves several foes with a greatsword. Core of the army.',
  '범위 공격': 'Area attack', '기사': 'Knight', '주력': 'Mainline',
  '서리를 흩뿌려 적 무리의 발과 공격을 함께 늦춘다.': 'Scatters frost that slows both movement and attacks.',
  '범위 · 2.5초 둔화': 'Area · 2.5s slow', '마도사': 'Frost Mage', '서리 마도사': 'Frost Mage', '둔화': 'Slow',
  '전장 반대편까지 바위를 던진다. 몰려오는 적을 통째로 정리.': 'Hurls boulders across the field and flattens crowds.',
  '초장거리 범위': 'Very long range area', '투석기': 'Catapult', '공성': 'Siege',
  '급소만 노리고 벤 만큼 회복한다. 오래 살아남을수록 무서워진다.': 'Aims for vitals and heals from cuts. Deadlier the longer he lives.',
  '30% 치명타 2.6배 · 흡혈 35%': '30% crit ×2.6 · lifesteal 35%', '결투가': 'Duelist', '암살': 'Assassin',
  '거대 석궁으로 전선을 꿰뚫는다. 한 발이 줄 서 있는 적 전부를 관통한다.': 'A giant crossbow bolt pierces every foe in a line.',
  '일직선 관통 · 사거리 520': 'Line pierce · range 520', '저격수': 'Sniper', '석궁 저격수': 'Crossbow Sniper', '관통': 'Pierce',
  '왕국의 최종 카드. 폭발에 휘말린 적은 종종 얼어붙는다.': "The kingdom's trump card. Blasts often freeze foes solid.",
  '광역 폭발 · 20% 기절': 'Wide blast · 20% stun', '대마법사': 'Archmage', '섬멸': 'Annihilate',
  '밀리지 않는 강철 덩어리. 6초마다 주변 아군에게 보호막을 씌운다.': 'An unshakable lump of steel. Shields nearby allies every 6s.',
  '넉백 면역 · 주변 아군 보호막 280': 'Knockback immune · ally shield 280', '거인': 'Golem', '강철 거인': 'Iron Golem', '불굴': 'Unyielding',
  '쓰러진 병사를 다시 세운다. 소환된 해골은 공짜로 전선을 채운다.': 'Raises the fallen. Summoned skeletons fill the line for free.',
  '6초마다 해골 병사 2기 소환': '2 skeletons every 6s', '사령술사': 'Necromancer', '소환': 'Summon',
  '진군 나팔을 분다. 싸우지 않지만 주변 아군이 훨씬 빨리 때린다.': 'Sounds the march. Never fights, but allies nearby strike much faster.',
  '주변 아군 공격 간격 30% 감소': 'Nearby ally attack interval -30%', '나팔수': 'Bugler', '지휘': 'Command',
  '장궁으로 전선 훨씬 뒤에서 쏜다. 사거리 하나로 먹고산다.': 'Fires a longbow from far behind the line. Lives on range alone.',
  '사거리 400 · 뒤에서 안전하게': 'Range 400 · safe at the back', '대궁병': 'Longbowman', '장거리': 'Long range',
  '불덩이를 던져 넓게 태운다. 몰려 있을수록 잘 듣는다.': 'Throws fireballs that burn wide. Best against crowds.',
  '범위 화염 · 화상 70/초 4초': 'Area fire · burn 70/s 4s', '불꽃술사': 'Pyromancer', '화염': 'Fire',
  '한 번 쓰러져도 다시 일어난다. 버티면서 주변을 치유하는 전선의 기둥.': 'Rises once after falling. A pillar that heals those around.',
  '쓰러져도 1회 부활 · 주변 아군 회복': 'Revives once · heals nearby allies', '성기사': 'Paladin',
  '전진하며 나무 방벽을 세운다. 방벽은 움직이지 않고 얻어맞아 준다.': 'Builds wooden barricades that soak up hits.',
  '9초마다 방벽 설치': 'Barricade every 9s', '공병': 'Engineer', '축성': 'Fortify',
  '눈에 안 보일 속도로 두 자루를 번갈아 찌른다.': 'Stabs with two blades faster than the eye can follow.',
  '초당 3회 연타 · 치명타 22%': '3 hits/s · crit 22%', '쌍검 도적': 'Twin Blade Rogue', '연타': 'Flurry',
  '룬 방패로 좁은 전선을 지킨다. 보호막은 중첩되지 않고 더 큰 값으로 갱신된다.': "Guards a narrow front with a rune shield. Shields don't stack; the larger one wins.",
  '6초마다 주변 보호막 95 · 최대 2명': 'Shield 95 nearby every 6s · max 2', '룬 수호병': 'Rune Guard', '보호막': 'Shield',
  '긴 총신으로 밀집 대열을 관통한다. 빠른 적에게 접근을 허용하지 말자.': "A long barrel that pierces packed ranks. Don't let fast foes close in.",
  '사선 위 적 관통 · 느린 장전': 'Pierces along the line · slow reload', '왕실 총사': 'Royal Musketeer',
  '향로의 빛으로 상태이상을 씻는다. 직접 공격하지 않으며 기절은 해제하지 못한다.': "Cleanses ailments with censer light. No attack; can't cure stun.",
  '4초마다 중독·화상·둔화 해제 및 회복 · 최대 2명': 'Cleanse poison/burn/slow + heal every 4s · max 2',
  '새벽 정화사': 'Dawn Purifier', '정화': 'Cleanse',
  '긴 얼음 창으로 돌격을 저지한다. 방패 뒤에서 늑대 기수를 견제하자.': 'Stops charges with a long ice lance. Great against wolf riders.',
  '타격 시 1.6초 둔화': 'Slows 1.6s on hit', '서리 창기사': 'Frost Lancer',
  '공병이 세운 방벽. 때리지는 못해도 오래 버틴다.': "An engineer's barricade. Can't hit, but lasts.",
  '나무 방벽': 'Barricade', '구조물': 'Structure',
  '사령술사가 불러낸 해골. 오래 버티지는 못한다.': "A necromancer's skeleton. Doesn't last long.",
  '해골 병사': 'Skeleton', '소환수': 'Summoned',
  '번개가 적에서 적으로 옮겨 붙는다. 떼로 몰려올수록 무섭지만, 단단한 한 놈 앞에서는 약하고 몸도 가볍다. 앞을 지켜 줄 병력이 있어야 산다.': 'Lightning leaps from foe to foe. Terrifying against swarms, weak against one tough target and frail. Needs a front line.',
  '연쇄 번개 · 4번 튕김 · 몸이 약함': 'Chain lightning · 4 bounces · frail',
  '제우스': 'Zeus', '뇌신': 'Thunder God', '천둥의 칙령': 'Decree of Thunder',
  '가장 가까운 적 주변 번개 피해·0.8초 기절.': 'Lightning around the nearest foe · 0.8s stun.',
  '전쟁 그 자체. 상처가 깊어질수록 창은 더 빨라진다.': 'War itself. The deeper his wounds, the faster his spear.',
  '범위 · 피가 깎일수록 가속 · 흡혈 12%': 'Area · faster when hurt · lifesteal 12%', '아레스': 'Ares', '전신': 'War God',
  '달의 사냥꾼. 화살 한 발이 줄지어 선 적을 전부 꿰뚫는다.': 'Huntress of the moon. One arrow pierces a whole line.',
  '일직선 관통 · 1.15초마다 사격': 'Line pierce · shoots every 1.15s', '아르테미스': 'Artemis', '사냥': 'Hunt',
  '눈을 마주친 자는 돌이 된다. 전선을 통째로 굳혀 버린다.': 'Meet her gaze and turn to stone. Freezes the whole front.',
  '50% 석화(기절) · 둔화': '50% petrify (stun) · slow', '메두사': 'Medusa', '석화': 'Petrify',
  '한 발도 물러서지 않는다. 방패를 맞대고 버티는 것이 임무다.': 'Never takes a step back. Locking shields is the job.',
  '넉백 면역 · 밀리지 않는 방진': 'Knockback immune · immovable phalanx', '스파르타': 'Spartan', '스파르타 전사': 'Spartan', '밀집': 'Phalanx',
  '묠니르는 갑옷도 성벽도 가리지 않는다. 보스와 중장갑을 깨는 데는 따를 자가 없지만, 한 번에 하나밖에 못 친다. 떼는 다른 병력이 맡아야 한다.': "Mjolnir cares for no armor or wall. Unmatched against bosses and heavy armor, but hits one at a time. Leave swarms to others.",
  '파쇄 · 갑주 무시 · 보스·중장갑에게 1.8배 · 단일 대상': 'Breaker · ignores armor · ×1.8 vs bosses/armor · single target',
  '토르': 'Thor', '묠니르 강타': 'Mjolnir Smash',
  '가장 가까운 적 주변 충격파 피해·0.6초 기절.': 'Shockwave around the nearest foe · 0.6s stun.',
  '쓰러진 자를 거두는 전장의 처녀. 자기 자신도 한 번은 일어난다.': 'Chooser of the slain. She rises once herself.',
  '1회 부활 · 주변 아군 회복': 'Revives once · heals nearby allies', '발키리': 'Valkyrie', '전선': 'Frontline',
  '사슬을 끊고 나온 늑대. 물어뜯은 만큼 스스로 회복한다.': 'The wolf that broke its chains. Heals by biting.',
  '초고속 돌진 · 흡혈 25%': 'Blazing charge · lifesteal 25%', '펜리르': 'Fenrir', '맹수': 'Beast',
  '피를 볼수록 웃는다. 죽기 직전이 가장 강하다.': 'Laughs at the sight of blood. Strongest near death.',
  '광폭화 · 25% 치명타': 'Frenzy · 25% crit', '바이킹': 'Viking', '바이킹 전사': 'Viking', '광전': 'Frenzy',
  '룬을 새겨 아군을 감싼다. 싸우지 않지만 없으면 아쉽다.': 'Carves runes that ward allies. Never fights, always missed.',
  '주변 아군 가속 + 보호막 190': 'Nearby haste + shield 190', '룬술사': 'Rune Shaman', '룬 주술사': 'Rune Shaman', '지원': 'Support',
  '미라를 세워 전열을 대신 막게 한다. 스스로는 거의 싸우지 못하니, 미라 뒤에서 때려 줄 병력과 함께 써야 한다.': 'Raises mummies to hold the line. Barely fights himself; pair with damage dealers behind the mummies.',
  '8초마다 미라 1기 · 본인 화력 약함': '1 mummy every 8s · weak attack', '아누비스': 'Anubis', '사자': 'Psychopomp',
  '사자의 결계': 'Ward of the Dead', '주변 아군에게 보호막·중독과 화상 정화.': 'Shields nearby allies · cleanses poison and burn.',
  '태양을 조각내 던진다. 맞은 자리는 한참을 탄다.': 'Hurls shards of the sun. The ground keeps burning.',
  '태양광 범위 · 화상 60/초 5초': 'Sunlight area · burn 60/s 5s', '라사제': 'Sun Priest', '라의 사제': 'Priest of Ra', '태양': 'Sun',
  '황금 껍질을 두른 풍뎅이. 굴러다니며 금화를 흘린다.': 'A golden-shelled beetle that drops coins as it rolls.',
  '빠름 · 살아 있는 동안 군자금 +8/초': 'Fast · funds +8/s while alive', '스카라베': 'Scarab', '황금 스카라베': 'Golden Scarab', '보물': 'Treasure',
  '모래바람 속에서 자란 궁수. 싸고 빠르게 자리를 채운다.': 'An archer raised in sandstorms. Cheap and quick.',
  '값싼 원거리': 'Cheap ranged', '사막궁수': 'Desert Archer', '사막 궁수': 'Desert Archer',
  '도시국가의 시민병. 싸고 빠르게 전열을 채운다.': 'A citizen soldier. Fills the line cheaply and quickly.',
  '값싼 창방패 보병': 'Cheap spear-and-shield', '아테네창': 'Athenian', '아테네 창병': 'Athenian Hoplite', '방진': 'Phalanx',
  '얼음 바람 속에서 활을 당기는 사냥꾼.': 'A hunter who draws the bow in icy winds.',
  '북방궁수': 'Northern Archer', '북방 궁수': 'Northern Archer',
  '왕의 무덤을 지키던 창병. 한 걸음도 밀리지 않는다.': "The pharaoh's tomb guard. Won't give an inch.",
  '넉백 면역 · 주변 아군 보호막 200': 'Knockback immune · ally shield 200', '근위대': 'Tomb Guard', '파라오 근위대': "Pharaoh's Guard", '수호': 'Guardian',
  '아누비스가 일으킨 미라. 느리지만 밀리지 않는다.': 'A mummy raised by Anubis. Slow but immovable.', '미라': 'Mummy',
  '근처에서 쓰러진 적을 해골 병사로 일으킨다. 싸움이 길어질수록 군세가 불어나지만, 스스로는 시체를 만들 힘이 없다. 적을 쓰러뜨려 줄 주력과 함께여야 한다.': "Raises fallen foes nearby as skeletons. His army grows as the fight drags on, but he can't make corpses himself. Needs a main force.",
  '명계 · 주변에서 쓰러진 적을 해골로 일으킴(최대 8) · 명계의 문': 'Underworld · raises nearby fallen foes (max 8) · Gate of Hades',
  '하데스': 'Hades', '명계': 'Underworld', '명계의 문': 'Gate of Hades',
  '가장 가까운 적 주변 피해·3초 둔화. 성채에는 피해 없음.': 'Damage around the nearest foe · 3s slow. No fort damage.',
  '궁니르를 들어 전군을 지휘한다. 곁에 선 병사들이 한층 세게 친다. 혼자서는 평범한 창잡이일 뿐 — 거느린 군대가 강할수록 오딘도 강해진다.': 'Raises Gungnir and commands the host. Allies beside him hit harder. Alone he is just a spearman; the stronger his army, the stronger Odin.',
  '지휘 · 주변 아군 공격력 +35% (자신 제외) · 운명의 룬': 'Command · nearby allies ATK +35% (not self) · Rune of Fate',
  '오딘': 'Odin', '룬의 지배자': 'Rune Lord', '운명의 룬': 'Rune of Fate',
  '주변 아군 보호막·중독과 화상 정화. 보호막 중첩 없음.': "Shields nearby allies · cleanses poison and burn. Shields don't stack.",
  '태양빛으로 적을 낙인찍는다. 낙인 찍힌 적은 누구에게 맞든 더 아프다. 라 혼자서는 약하지만, 주력의 화력을 한 단계 끌어올린다.': 'Brands foes with sunlight; branded foes take more damage from everyone. Weak alone, but lifts your main force a whole step.',
  '태양 낙인 · 맞은 적은 4초간 모든 피해 +30% · 태양의 심판': 'Sun brand · hit foes take +30% damage for 4s · Judgment of Ra',
  '라': 'Ra', '태양신': 'Sun God', '태양의 심판': 'Judgment of Ra',
  '가장 가까운 적 주변 피해·5초 화상·낙인. 성채에는 피해 없음.': 'Damage around the nearest foe · 5s burn · brand. No fort damage.',
  '석류와 꽃관을 지닌 봄의 여왕. 명계의 군대에도 생명을 되돌린다.': 'Queen of spring with pomegranate and garland. Brings life even to the underworld.',
  '주변 회복 · 꽃잎 탄환': 'Area heal · petal shots', '페르세포네': 'Persephone', '봄과 명계': 'Spring & Underworld',
  '털 망토를 두른 산의 사냥꾼. 서리 활로 돌격의 발걸음을 묶는다.': 'A fur-cloaked mountain huntress. Her frost bow pins charges in place.',
  '1.2초 둔화 · 서리 화살': '1.2s slow · frost arrows', '스카디': 'Skadi', '겨울 사냥꾼': 'Winter Huntress',
  '고양이 귀와 황금 발톱을 지닌 수호신. 낮은 자세로 전선의 빈틈을 파고든다.': 'Cat-eared guardian with golden claws. Slips low through gaps in the line.',
  '치명타 20% · 흡혈 12%': 'Crit 20% · lifesteal 12%', '바스테트': 'Bastet', '고양이 수호신': 'Cat Guardian',

  /* ---------------- 요괴록 ---------------- */
  '아홉 꼬리의 여우. 여우불에 홀린 적은 잠시 제 편을 친다. 몰려오는 무리를 서로 싸우게 만들지만, 스스로 적을 쓰러뜨리는 힘은 크지 않다.': 'The nine-tailed fox. Foes bewitched by her foxfire turn on their own side for a while. She makes hordes fight each other, but kills little herself.',
  '여우불 · 맞은 적 25%를 3초 홀림(제 편을 침, 보스 제외) · 여우 구슬': 'Foxfire · 25% of hit foes charmed for 3s (attack their allies; not bosses) · Fox Bead',
  '구미호': 'Gumiho', '홀림': 'Charm', '여우 구슬': 'Fox Bead',
  '가장 가까운 적 주변 피해·4초 홀림(보스 제외). 성채에는 피해 없음.': 'Damage around the nearest foe · 4s charm (not bosses). No fort damage.',
  '검은 갓을 쓴 저승의 관리. 명부에 이름이 오른 적은 한 번의 손짓으로 데려간다. 단단한 적을 깎아 줄 동료가 있어야 제 몫을 한다.': 'An underworld official in a black gat. Anyone whose name is in the ledger is taken with a single gesture. Needs allies to wear tough foes down first.',
  '명부 · 체력 20% 이하인 적을 즉시 거둠(보스 제외) · 명부 호명': 'Ledger · instantly reaps foes at 20% HP or less (not bosses) · Roll Call',
  '저승사자': 'Grim Reaper', '명부': 'Ledger', '명부 호명': 'Roll Call',
  '가장 가까운 적 주변 피해 뒤, 체력 35% 이하는 즉시 거둠(보스 제외).': 'Damage around the nearest foe, then reap all at 35% HP or less (not bosses).',
  '"금 나와라 뚝딱!" 방망이를 휘두를 때마다 이따금 금이 쏟아진다.': '"Gold, come out! Thwack!" Gold now and then spills from every swing of his club.',
  '범위 · 때릴 때 30% 확률로 군자금 +18': 'Area · 30% chance per hit for +18 war funds',
  '도깨비': 'Dokkaebi', '방망이': 'Magic Club',
  '옳고 그름을 가리는 상상의 짐승. 밀리지 않고, 저를 친 자에게 그대로 돌려준다.': 'A mythical beast that judges right from wrong. Immovable, and repays whoever strikes it.',
  '넉백 면역 · 근접 피해 30% 되돌림': 'Knockback immune · reflects 30% melee damage',
  '해치': 'Haetae', '수호수': 'Guardian Beast',
  '방울과 부채로 액을 막는다. 무서운 적일수록 이 방울 소리가 반갑다.': 'Wards off misfortune with bells and a fan. The scarier the foe, the sweeter the bells.',
  '액막이 방울 · 맞은 적의 공격력 -30% (4초)': 'Warding bells · hit foes deal -30% damage (4s)',
  '무당': 'Mudang', '액막이': 'Warding',
  '꽃처럼 차려입은 젊은 검객. 빠르게 파고들어 벤 만큼 회복한다.': 'A young swordsman dressed like a flower. Darts in fast and heals from each cut.',
  '빠른 검 · 흡혈 15%': 'Quick blade · lifesteal 15%', '화랑': 'Hwarang', '풍류 검객': 'Flower Knight',
  '고을을 지키던 포졸. 싸고 빠르게 전열을 채운다.': 'A village constable. Fills the line cheaply and quickly.',
  '값싼 창 · 긴 사거리': 'Cheap spear · long reach', '포졸': 'Constable', '육모방망이': 'Baton',

  /* ---------------- 태엽 공방 ---------------- */
  '톱니와 증기로 전장을 설계한다. 제자리에 박힌 포탑이 쉬지 않고 쏜다. 앞줄이 버텨 주면 포탑이 늘고, 무너지면 아무것도 못 세운다.': 'Engineers the battlefield with gears and steam. Rooted turrets fire nonstop. Hold the front and turrets pile up; lose it and nothing gets built.',
  '7초마다 포탑 설치(최대 3) · 과부하': 'Builds a turret every 7s (max 3) · Overdrive',
  '대발명가': 'Grand Inventor', '공방장': 'Workshop Master', '과부하': 'Overdrive',
  '주변 아군 공격 속도 크게 증가(6초)·기절 해제.': 'Nearby allies attack much faster (6s) · clears stuns.',
  '굴뚝에서 연기를 뿜는 걸어 다니는 포대. 처음엔 느리지만 멈춰 서서 쏠수록 불을 뿜는다. 전선이 자주 흔들리면 영영 예열되지 않는다.': 'A walking battery belching smoke. Slow at first, it spits fire the longer it stands and shoots. A wobbly front line never lets it warm up.',
  '예열 · 쏠수록 빨라짐(최대 2.2배) · 걸으면 식음 · 증기 폭발': 'Spin-up · fires faster the longer it shoots (up to 2.2×) · cools when walking · Steam Burst',
  '증기 거상': 'Steam Colossus', '예열 포격': 'Spin-up Artillery', '증기 폭발': 'Steam Burst',
  '가장 가까운 적 주변 피해·크게 밀쳐 냄.': 'Damage around the nearest foe · big knockback.',
  '하늘에서 폭탄을 떨군다. 앞줄 너머의 주술사와 투석기를 노린다.': 'Drops bombs from the sky, targeting shamans and catapults behind the front.',
  '뒷줄 폭격 · 사거리 안 가장 먼 적 · 화상': 'Backline bombing · farthest foe in range · burn',
  '비행선': 'Airship', '비행선 폭격수': 'Airship Bomber', '뒷줄 폭격': 'Backline Bomber',
  '등에 코일을 짊어진 기사. 창끝에서 튄 전기가 옆의 적까지 태운다.': 'A knight with a coil on his back. Sparks from his lance jump to the next foe.',
  '방전 · 2번 튕김 · 12% 기절': 'Discharge · 2 bounces · 12% stun',
  '테슬라': 'Tesla', '테슬라 기사': 'Tesla Knight', '방전': 'Discharge',
  '태엽을 감아 움직이는 병정. 부서질 때 톱니가 사방으로 튄다.': 'A wind-up soldier. When it breaks, gears fly everywhere.',
  '쓰러지면 톱니 폭발(범위 160)': 'Explodes in gears when destroyed (160 area)',
  '태엽병정': 'Wind-up', '태엽 병정': 'Wind-up Soldier', '자폭 톱니': 'Gear Bomb',
  '렌치 하나로 사람도 기계도 고친다. 포탑과 거상 곁에 두면 오래 버틴다.': 'Fixes people and machines alike with one wrench. Keep near turrets and colossi.',
  '주변 아군 수리(회복) · 약한 렌치': 'Repairs (heals) nearby allies · weak wrench',
  '정비공': 'Mechanic', '수리': 'Repair',
  '공방에서 찍어 낸 소총을 든 민병. 싸고 멀리 쏜다.': 'A militiaman with a workshop rifle. Cheap and long-ranged.',
  '소총수': 'Rifleman', '대발명가가 세운 포탑. 움직이지 않고 쏘기만 한다.': 'A turret built by the Grand Inventor. It never moves; it only shoots.',
  '증기 포탑': 'Steam Turret', '소환물': 'Summon',
  '요괴록': 'Yokai Tales', '한국 설화': 'Korean folklore', '달 밝은 밤, 옛이야기 속 요괴와 저승의 관리들이 왕국 편에 섰다.': 'On a moonlit night, spirits and reapers of old tales take the kingdom\'s side.',
  '태엽 공방': 'Clockwork Workshop', '증기와 톱니': 'Steam & gears', '연기 자욱한 공방에서 발명가들이 기계 군단을 끌고 나왔다.': 'From a smoky workshop, inventors roll out their mechanical legion.',
  '전설·신화는 편성에 5명까지다': 'A squad can bring at most 5 Legend+ units',

  /* 2.5 새 잡몹 */
  '고블린 투석병': 'Goblin Slinger', '값싼 원거리 · 초반부터 뒤에서 돌을 던진다': 'Cheap ranged · hurls stones from the back early on',
  '오크 북잡이': 'Orc Drummer', '전쟁 북 · 주변 적 공격력 +30%': 'War drums · nearby foes ATK +30%',
  '저주 주술사': 'Hexer', '저주 · 맞은 아군의 공격력 -30% (4초)': 'Hex · hit allies deal -30% damage (4s)',
  '해골 궁수': 'Skeleton Archer', '한 번 쓰러져도 다시 일어난다': 'Gets back up once after falling',
  '해골 방패병': 'Bone Guard', '갑주 10% · 한 번 쓰러져도 다시 일어난다': 'Armor 10% · gets back up once',
  '고블린 암살자': 'Goblin Assassin', '도약 · 전열을 뛰어넘어 궁수와 마법사를 노린다': 'Leap · jumps your front line to hunt archers and mages',
  '땅굴 고블린': 'Goblin Burrower', '땅굴 · 땅속으로 다가와 전열 밑에서 튀어나오며 기절': 'Burrow · tunnels in and bursts out under your line, stunning',
  '오크 전차': 'Orc Chariot', '돌격 전차 · 넉백 면역 · 들이받아 밀쳐 낸다': 'War chariot · knockback immune · rams units aside',
  '암살 · 궁수 곁에 방패병이나 근접을 한 명 두자': 'Assassin · keep a shield or melee next to your archers',
  '땅굴 · 전열을 두껍게, 기절 뒤 왕명으로 수습': "Burrower · thicken the front, recover with the King's Command",
  '지휘 · 북잡이부터 원거리로 끊어라': 'Commander · snipe the drummer first',
  '저주 · 정화사로 해제, 멀리서 먼저 쓰러뜨려라': 'Hex · cleanse it, and drop the hexer from range',
  '부활 · 한 번 더 쓰러뜨려야 한다, 범위 공격이 유리': 'Revive · must be felled twice, area damage helps',
  '도약': 'Leap', '땅굴': 'Burrow', '부활': 'Revive',
  '분열': 'Split', '활공': 'Glide', '그림자 이동': 'Shadow step', '성채 돌격': 'Castle rush',
  '사령': 'Necromancy', '기치': 'Standard', '빙결': 'Freeze', '갑주': 'Armor', '침묵': 'Silence',
  /* ---------------- 2.6 왕국군 증원 ---------------- */
  '왕기 기수': 'Bannerman', '기수': 'Bannerman', '고무': 'Inspire',
  '왕기 · 주변 아군 공격력 +28% · 최대 2명': 'Royal banner · nearby allies ATK +28% · max 2',
  '왕국기를 세우고 전열을 북돋운다. 스스로도 창을 들지만, 값어치는 깃발에 있다.': 'Plants the royal banner and lifts the line. He fights too, but the banner is his worth.',
  '덫 공병': 'Trapper', '설치': 'Deploy', '8초마다 쇠덫 설치(최대 3)': 'Sets an iron trap every 8s (max 3)',
  '길목에 쇠덫을 심는다. 덫은 움직이지 않지만 걸려든 적의 발을 묶는다.': 'Plants iron traps on the path. They never move, but they pin whatever steps in.',
  '쇠덫': 'Iron Trap', '덫 공병이 심은 쇠덫. 밟은 적의 발을 2초 동안 묶는다.': "A trapper's snare. Holds whatever steps on it for 2s.",
  '흑마술사': 'Warlock', '범위 저주 · 적 공격력 -32% · 중독 55/초': 'Area curse · foe ATK -32% · poison 55/s',
  '금서의 저주를 퍼붓는다. 맞은 적은 힘이 빠지고 살이 썩어 들어간다.': 'Pours out curses from a forbidden book. Foes weaken and rot.',
  '용기병': 'Dragoon', '도약': 'Leap',
  '도약 · 적 전열을 뛰어넘어 뒷줄 사수를 덮친다': 'Leap · vaults the enemy line onto their shooters',
  '창을 짚고 단번에 뛰어오른다. 적 궁수와 주술사를 먼저 끊는 것이 임무다.': 'Vaults on his lance in one bound. His job is cutting down archers and casters first.',
  '강노병': 'Arbalest', '파갑': 'Armor Breaker',
  '관통 · 맞을 때마다 적 갑주 12% 파괴(최대 40%)': 'Pierce · shreds 12% of a foe\'s armor per hit (max 40%)',
  '쇠뇌살이 갑주를 벗겨 낸다. 쏠수록 단단하던 적이 물러진다.': 'Bolts peel armor away. The longer he shoots, the softer they get.',
  '호국 무승': 'Warrior Monk', '무승': 'Monk', '수행': 'Discipline',
  '연타 · 5초마다 주변 상태이상 해제와 회복 · 흡혈 18%': 'Flurry · cleanses and heals nearby every 5s · lifesteal 18%',
  '봉을 든 채 전열에 선다. 싸우면서 주변의 독과 저주를 함께 씻어 낸다.': 'Stands in the line with a staff, washing away poison and curses as he fights.',

  /* ---------------- 심연의 해역 ---------------- */
  '용왕': 'Dragon King', '심해의 주인': 'Lord of the Deep', '해일': 'Tidal Surge',
  '비호 · 주변 병졸이 받는 피해 -24% (비용 350 이상 제외) · 해일': 'Aegis · nearby rank-and-file take -24% damage (not units costing 350+) · Tidal Surge',
  '바다 밑에서 올라온 옛 주인. 곁에 선 병졸들이 받는 피해를 대신 흩뜨린다. 다만 값비싼 영웅과 신은 감싸 주지 않는다 — 거느린 군세가 평범할수록 용왕은 값을 한다.': 'An old lord risen from the seabed. He scatters the blows aimed at the common soldiers beside him — but never shelters costly heroes or gods. The plainer your army, the more he is worth.',
  '가장 가까운 적 주변 피해·크게 밀쳐 내고 3초 둔화. 성채에는 피해 없음.': 'Damage around the nearest foe · big knockback and 3s slow. No fort damage.',
  '심해 크라켄': 'Deep Kraken', '크라켄': 'Kraken', '촉수': 'Tentacles',
  '촉수 셋 · 사거리 안 서로 다른 적 셋을 동시에 후려친다 · 둔화': 'Three tentacles · strikes three separate foes in range at once · slow',
  '긴 촉수가 한 번에 셋을 후려친다. 뭉쳐 있지 않아도 닿지만, 넷째부터는 닿지 않는다. 떼를 갈아 내는 몫은 범위 병종에게 맡겨야 한다.': 'Long tentacles strike three at once — they need not be bunched up, but a fourth is out of reach. Leave grinding down hordes to area units.',
  '해원 인어': 'Sea Siren', '인어': 'Siren', '노래': 'Song',
  '노래 · 맞은 적은 3초간 능력을 쓰지 못한다 (보스 기술도 멎는다)': 'Song · foes hit cannot use abilities for 3s (boss skills too)',
  '물빛 노래가 주문과 북소리를 지운다. 치유하는 주술사도, 기술을 꺼내려는 보스도 잠시 입을 다문다.': 'Her song erases spells and war drums alike. Healing shamans and skill-casting bosses both fall silent.',
  '현무 수호병': 'Turtle Guard', '현무': 'Turtle', '도발': 'Taunt',
  '도발 · 주변 적이 이쪽부터 친다 · 넉백 면역 · 근접 피해 25% 반사': 'Taunt · nearby foes strike him first · knockback immune · reflects 25% melee',
  '등껍질을 앞세워 적의 눈을 끈다. 뒤에 선 궁수와 술사가 맞을 일이 줄어든다.': 'Holds his shell forward and draws every eye, so the archers and casters behind him stay untouched.',
  '작살 포수': 'Harpooner', '작살': 'Harpoon',
  '관통 작살 · 맞을 때마다 적 갑주 15% 파괴(최대 45%)': 'Piercing harpoon · shreds 15% of armor per hit (max 45%)',
  '미늘 달린 작살이 갑주를 통째로 뜯어낸다. 중갑 전장에서 값을 한다.': 'A barbed harpoon rips armor clean off. Worth his cost on armored fields.',
  '진주 술사': 'Pearl Mage', '진주': 'Pearl',
  '주변 아군 회복 75 + 보호막 130 · 공격 안 함': 'Heals nearby 75 + shield 130 · no attack',
  '진주에 담은 물빛으로 상처를 덮는다. 싸우지 않지만 전열이 오래 버틴다.': 'Seals wounds with the light held in a pearl. Never fights, but the line holds longer.',
  '해적 검사': 'Corsair', '해적': 'Corsair', '연격': 'Flurry',
  '빠른 곡도 · 치명타 24% · 흡혈 16%': 'Quick cutlass · crit 24% · lifesteal 16%',
  '뱃전에서 익힌 칼질. 빠르게 파고들어 벤 만큼 회복한다.': 'Swordplay learned on a deck. Darts in fast and heals from every cut.',
  '어창병': 'Fisher Spear', '값싼 장창 · 긴 사거리': 'Cheap long spear · good reach',
  '작살 창을 든 어부들. 싸고 빠르게 전열을 채운다.': 'Fishermen with harpoon spears. Cheap and quick to fill the line.',
  '심연의 해역': 'Abyssal Tide', '바다의 옛 주인': 'Old lords of the sea',
  '조수가 갈라지고, 바다 밑에 잠들어 있던 옛 주인들이 뭍으로 올라왔다.': 'The tide splits, and the old lords asleep beneath the sea come ashore.',

  /* ---------------- 2.6 심연의 군세 ---------------- */
  '작은 점액': 'Slimelet', '갈라져 나온 점액 · 약한 독': 'Split-off slime · weak poison',
  '점액 군주': 'Slime Lord', '쓰러지면 작은 점액 셋으로 갈라진다 · 범위 공격으로 한꺼번에': 'Splits into three slimelets when felled · hit them together with area damage',
  '오크 군기병': 'Orc Standard', '방어 기치 · 주변 적에게 갑주 28% · 기수부터 끊어라': 'War standard · gives nearby foes 28% armor · drop the bearer first',
  '결계 사제': 'Ward Priest', '결계 · 주변 적에게 보호막 900 · 중독과 화상은 결계를 뚫는다': 'Ward · shields nearby foes for 900 · poison and burn pass straight through',
  '하피': 'Harpy', '활공 · 날아오는 화살 45%를 흘려 낸다 · 근접으로 잡아라': 'Glide · shrugs off 45% of arrows · catch it with melee',
  '그림자 암습자': 'Shadow Stalker', '그림자 이동 · 몇 번이고 전열을 넘어 뒷줄로 스며든다': 'Shadow step · slips past your line again and again',
  '서리 마녀': 'Frost Witch', '서리 저주 · 이미 둔화된 아군을 얼려 기절시킨다 · 정화로 끊어라': 'Frost hex · freezes already-slowed allies solid · cleanse breaks it',
  '공성 폭파병': 'Sapper', '병사를 무시하고 성채로 달린다 · 쓰러질 때 크게 터진다': 'Ignores soldiers and runs for the castle · explodes when destroyed',
  '부패 사령관': 'Rot Commander', '쓰러진 아군 병사를 제 편의 해골로 일으킨다 · 먼저 끊어라': 'Raises your fallen as its own skeletons · cut it down first',
  '흑요석 파수꾼': 'Obsidian Warden', '갑주 32% · 근접 피해 22% 반사 · 중독과 화상이 잘 듣는다': 'Armor 32% · reflects 22% melee · poison and burn work well',
  '히드라 머리': 'Hydra Head', '잘린 머리 · 독을 뿜고 스스로 아문다': 'Severed head · spits venom and heals itself',
  '파멸의 흑기사': 'Doom Knight', '영혼 착취': 'Soul Harvest', '망자 기사단': 'Dead Knights',
  '절망의 외침': 'Cry of Despair', '파멸의 맹세': 'Oath of Ruin',
  '삼두 히드라': 'Three-Headed Hydra', '맹독 분사': 'Venom Spray', '재생하는 살': 'Regrowing Flesh',
  '부식의 안개': 'Corroding Mist', '세 머리의 분노': 'Fury of Three Heads',
  '심연의 마왕': 'Abyss Demon Lord', '심연의 균열': 'Abyssal Rift', '마계의 부름': 'Call of the Abyss',
  '심연의 포효': 'Abyssal Roar', '암흑의 장막': 'Veil of Darkness', '멸망의 선고': 'Sentence of Ruin',
  '분열 · 쓰러지면 갈라진다, 범위 공격으로 한꺼번에': 'Splits · felling it makes more, so use area damage',
  '성채 돌격 · 병사를 무시한다, 멀리서 끊어라': 'Castle rush · ignores your soldiers, drop it at range',
  '사령 · 아군 시체를 일으킨다, 먼저 쓰러뜨려라': 'Necromancer · raises your dead, kill it first',
  '활공 · 화살을 흘린다, 근접으로 붙잡아라': 'Glide · shrugs off arrows, pin it with melee',
  '그림자 이동 · 뒷줄에도 지킬 병력을 남겨라': 'Shadow step · keep a guard in the back rank',
  '기치 · 주변에 갑주를 나눠 준다, 기수부터 끊어라': 'Standard · hands out armor, drop the bearer first',
  '빙결 · 둔화된 아군을 얼린다, 정화로 끊어라': 'Freeze · freezes slowed allies, cleanse breaks it',
  '결계 · 중독과 화상은 보호막을 지나친다': 'Ward · poison and burn pass through shields',
  '도발 · 시선을 끈다, 뒤쪽부터 정리': 'Taunt · it draws fire, clear the back first',

  /* ---------------- 3막 전장 ---------------- */
  '3막': 'Act III', '심연의 문': 'Gate of the Abyss',
  '갈라진 조수길': 'Sundered Tideway', '갈라지는 점액은 범위 공격으로 한꺼번에': 'Clear splitting slimes with area damage',
  '버려진 채석장': 'Abandoned Quarry', '성채로 달리는 폭파병을 먼저 끊어라': 'Drop the sappers running for your castle',
  '★ 흑기사의 재림': '★ Return of the Doom Knight',
  '뒷줄로 스며드는 흑기사, 원거리 곁에 근접을 남겨 두어라': 'The knight steps behind your line — keep melee beside your shooters',
  '독사의 늪지': 'Viper Marsh', '독무가 몇 초마다 전장을 훑는다 · 정화와 해독을 챙겨라': 'Venom fog sweeps the field · bring cleansing and antidotes',
  '그림자 회랑': 'Shadow Gallery', '맞바람에 화살이 짧아진다 · 암습자가 뒷줄로 스며든다': 'Headwind shortens your arrows · stalkers slip behind you',
  '★ 삼두 히드라의 소굴': '★ Lair of the Hydra', '머리를 자르면 둘이 남는다 · 화상으로 재생을 끊어라': 'Cut one head and two remain · burn to stop the regrowth',
  '부패한 전선': 'Rotting Front', '쓰러진 아군이 적의 해골로 일어선다 · 사령관을 먼저': 'Your fallen rise as their skeletons · kill the commander first',
  '결계의 첨탑': 'Spire of Wards', '적의 결계는 중독과 화상으로 뚫는다': 'Break enemy wards with poison and burn',
  '마왕의 문턱': 'Threshold of the Demon Lord', '모든 숙제가 한꺼번에 온다 · 편성의 균형을 보라': 'Every problem at once · balance your squad',
  '★ 심연의 마왕': '★ The Abyss Demon Lord', '균열을 피해 물러서고, 장막이 걷히면 모든 것을 쏟아라': 'Back away from the rifts, then pour everything in once the veil drops',

  /* ---------------- 새 전장 특성 ---------------- */
  '결계': 'Wards', '모든 적이 최대 체력 22%의 보호막을 두르고, 7초마다 다시 두른다': 'Every foe wears a shield worth 22% of its max HP, renewed every 7s',
  '중독 · 화상 · 명부(즉사) — 결계를 지나쳐 몸에 닿는 피해': 'Poison · burn · execute — damage that goes straight past shields',
  '독무': 'Venom Fog', '7초마다 독안개가 전장을 훑고 지나가며 아군을 중독시킨다': 'Every 7s a venom fog sweeps the field and poisons your units',
  '새벽 정화사 · 호국 무승 · 해독 훈련 · 회복': 'Dawn Purifier · Warrior Monk · Antidote Drill · healing',
  '삭풍': 'Headwind', '맞바람에 아군 원거리 사거리가 25% 줄어든다': 'Headwind cuts your ranged units\' reach by 25%',
  '근접 주력 · 아주 긴 사거리 · 앞에서 버티는 전열': 'Melee core · very long range · a front line that holds',

  /* ---------------- 새 임무 · 업적 ---------------- */
  '보스 3체 처치': 'Defeat 3 bosses', '적 300명 처치': 'Defeat 300 enemies', '왕의 명령 5회 사용': "Use the King's Command 5 times",
  '심연의 종결자': 'Abyss Ender', '40전장 모두 돌파': 'Clear all 40 stages',
  '여섯 전설': 'Six Legends', '여섯 시즌에서 전설 이상을 각각 보유': 'Own a Legend+ from each of the six seasons',
  '왕국의 정예': 'Realm Elite', '병종 하나를 20레벨로': 'Train one unit to Lv 20',
  '왕국 방어선 · 전 40 전장': 'Realm Defense · 40 battlefields',

  /* ---------------- 시즌 · 등급 ---------------- */
  '올림포스': 'Olympus', '그리스 신화': 'Greek myth', '번개와 창의 신들이 왕국의 부름에 응했다.': 'The gods of thunder and spear answer the call.',
  '라그나로크': 'Ragnarok', '북유럽 신화': 'Norse myth', '최후의 전투를 앞둔 북방의 전사들이 내려왔다.': 'Northern warriors arrive on the eve of the final battle.',
  '나일의 왕가': 'House of the Nile', '이집트 신화': 'Egyptian myth', '모래 아래 잠들어 있던 사자의 신과 사제들이 깨어났다.': 'The god of the dead and his priests wake beneath the sand.',
  '일반': 'Common', '희귀': 'Rare', '영웅': 'Epic', '전설': 'Legend', '신화': 'Mythic',

  /* ---------------- 적 ---------------- */
  '고블린 졸개': 'Goblin Grunt', '오크 창병': 'Orc Spearman', '오우거': 'Ogre',
  '초당 체력 18 재생 · 화상 중에는 재생 중단': 'Regen 18 HP/s · stops while burning',
  '늑대 기수': 'Wolf Rider', '석궁 사수': 'Orc Crossbow', '독거미': 'Venom Spider',
  '독과 거미줄 · 정화로 해제': 'Poison and webs · cleanse removes', '오크 주술사': 'Orc Shaman', '화약통 고블린': 'Powder Goblin',
  '방패 오크': 'Shield Orc', '근접 피해 12% 반격 · 원거리 공격으로 대응': 'Reflects 12% melee damage · use ranged',
  '망령': 'Wraith', '흑기사': 'Black Knight', '트롤 대장': 'Troll Chief', '바위 투척': 'Boulder Toss',
  '대지 포효': 'Earth Roar', '피의 격노': 'Blood Rage', '트롤의 재생': 'Troll Regeneration',
  '리치': 'Lich', '망자 소환': 'Raise the Dead', '생명 흡수': 'Life Drain', '영혼 보호막': 'Soul Barrier', '죽음의 군세': 'Legion of Death',
  '서리 거인': 'Frost Giant', '한파': 'Cold Snap', '얼음 포효': 'Ice Roar', '빙하 낙하': 'Glacier Fall', '서리의 분노': 'Frost Fury',
  '오크 광전사': 'Orc Berserker', '흡혈박쥐': 'Vampire Bat', '돌 골렘': 'Stone Golem', '저주 토템': 'Cursed Totem',
  '화룡': 'Fire Drake', '화염 브레스': 'Fire Breath', '분노의 불길': 'Flames of Wrath', '용의 포효': 'Dragon Roar', '멸화': 'Inferno',
  '오크 투석기': 'Orc Catapult', '오크 사령관': 'Orc Warchief', '역병 술사': 'Plague Caster', '지옥견': 'Hellhound', '파성추': 'Battering Ram',
  '거미 여왕': 'Spider Queen', '알주머니': 'Egg Sac', '독액 분사': 'Venom Spray', '거미 떼': 'Spider Swarm', '여왕의 광란': "Queen's Frenzy",
  '오크 대군주': 'Orc Warlord', '대군주의 일격': "Warlord's Strike", '친위대 소집': 'Call the Guard', '전장의 포효': 'Battle Roar',
  '대군주의 분노': "Warlord's Fury", '최후의 군세': 'Final Legion',

  /* ---------------- 전장 ---------------- */
  '국경 초소': 'Border Outpost', '밀밭 오솔길': 'Wheatfield Path', '무너진 돌다리': 'Broken Bridge', '늑대 골짜기': 'Wolf Valley',
  '★ 리치의 무덤가': "★ Lich's Graveyard", '거미 굴': 'Spider Den', '석궁수의 언덕': "Crossbow Hill", '주술사의 야영지': "Shaman's Camp",
  '화약 골짜기': 'Powder Gorge', '★ 트롤 대장의 요새': "★ Troll Chief's Fort", '흑기사의 숲': "Black Knight's Wood", '망령의 폐허': 'Wraith Ruins',
  '리치의 재림': 'Return of the Lich', '방패벽 관문': 'Shieldwall Gate', '★ 거대 트롤의 문': '★ Gate of the Giant Troll', '역병의 늪': 'Plague Marsh',
  '★ 서리 거인의 고개': "★ Frost Giant's Pass", '★ 화룡의 둥지': "★ Drake's Nest", '대군주의 전조': "Warlord's Omen", '★ 오크 대군주의 왕좌': "★ Throne of the Orc Warlord",
  '검은 강의 나루': 'Black River Ford', '망령 폭발에 대비해 전열을 분산': 'Spread out for wraith explosions',
  '망자의 행렬': 'March of the Dead', '소환 병력은 관통과 범위 공격으로 처리': 'Clear summons with pierce and area attacks',
  '가시 왕관의 성문': 'Gate of the Thorn Crown', '가시 반격은 원거리 병종으로 대응': 'Answer thorn reflect with ranged units',
  '★ 명계의 삼중 봉인': '★ Triple Seal of the Underworld', '근접 벽 뒤에서 해골을 부르는 리치를 먼저 노려라': 'Strike the lich raising skeletons behind its melee wall',
  '눈보라 추격전': 'Blizzard Chase', '빠른 늑대 기수를 둔화로 저지': 'Slow the fast wolf riders',
  '얼어붙은 공성로': 'Frozen Siege Road', '공성 병기를 막을 보호막 전열 필요': 'Needs a shielded front against siege engines',
  '★ 영원의 겨울 왕좌': '★ Throne of Endless Winter', '연속 광역 공격 뒤 왕명으로 회복': "Heal with the King's Command after area barrages",
  '불타는 태양 회랑': 'Burning Sun Corridor', '화상을 정화하며 화룡을 견제': 'Cleanse burns while holding off the drake',
  '황금 일식의 제단': 'Altar of the Golden Eclipse', '치유·가속 토템을 범위 공격으로 압박': 'Press healing and haste totems with area attacks',
  '★ 세 신화의 종착지': "★ The Three Myths' End", '원거리 호위를 먼저 걷어 내고, 대군주에게 액티브와 왕명을 몰아 쓰라': "Clear the ranged escort first, then pour actives and the King's Command into the Warlord",

  /* ---------------- 임무 · 업적 · 강화 ---------------- */
  '적 60명 처치': 'Defeat 60 enemies', '적 150명 처치': 'Defeat 150 enemies', '전장 2회 승리': 'Win 2 battles', '전장 4회 승리': 'Win 4 battles',
  '별 3개로 승리 1회': 'Win once with 3 stars', '소환 3회': 'Summon 3 times', '왕의 명령 2회 사용': "Use the King's Command twice",
  '병종 훈련 2회': 'Train units twice', '보스 1체 처치': 'Defeat 1 boss', '무한 전장 5웨이브 돌파': 'Survive 5 waves in Endless',
  '첫 승리': 'First Victory', '전장을 하나 돌파한다': 'Clear one battlefield', '국경 수호': 'Border Warden', '5전장 돌파': 'Clear stage 5',
  '왕국의 방패': 'Shield of the Realm', '10전장 돌파': 'Clear stage 10', '대군주 토벌': 'Warlord Slayer', '20전장 전부 돌파': 'Clear all 20 stages',
  '별 수집가': 'Star Collector', '별 30개 획득': 'Earn 30 stars', '완전 제압': 'Total Victory', '모든 전장 별 3개': '3 stars on every stage',
  '천 명의 적': 'A Thousand Foes', '누적 1000 처치': '1000 total kills', '전장의 주인': 'Master of War', '누적 5000 처치': '5000 total kills',
  '제단의 손님': 'Altar Guest', '소환 10회': '10 summons', '제단의 단골': 'Altar Regular', '소환 100회': '100 summons',
  '신화의 계약': 'Mythic Pact', '전설 이상 병종 보유': 'Own a Legend or better', '세 신화': 'Three Myths', '세 시즌에서 전설 이상을 각각 보유': 'Own a Legend+ from each season',
  '정예 조련': 'Elite Drill', '병종 하나를 15레벨로': 'Train one unit to Lv 15', '세 신화의 정복자': 'Conqueror of Myths', '30전장 모두 돌파': 'Clear all 30 stages',
  '끝없는 전장': 'Endless Field', '무한 전장 10웨이브 돌파': 'Survive 10 waves in Endless', '불굴의 성채': 'Unbreakable Fort', '무한 전장 25웨이브 돌파': 'Survive 25 waves in Endless',
  '야전 의무대': 'Field Medics', '아군 지원병의 회복량 +6%/레벨 (왕명 제외)': "Support healing +6%/lv (not the King's Command)",
  '해독 훈련': 'Antidote Drill', '아군 중독·화상 피해 -5%/레벨': 'Ally poison/burn damage -5%/lv',
  '출진 보호진': 'Deployment Ward', '직접 출진한 병사에게 보호막 25/레벨 (소환수 제외)': 'Deployed units get a 25/lv shield (not summons)',
  '군자금 금고': 'War Chest', '전투 중 보유할 수 있는 군자금 한도가 늘어난다.': 'Raises the max war funds in battle.',
  '세금 징수': 'Taxation', '전투 중 군자금이 차는 속도가 빨라진다.': 'War funds fill faster in battle.',
  '무기 연마': 'Whetstone', '모든 아군 병사의 공격력 +6%/레벨': 'All ally ATK +6%/lv',
  '갑옷 강화': 'Armor Plating', '모든 아군 병사의 체력 +8%/레벨': 'All ally HP +8%/lv',
  '성벽 보수': 'Wall Repair', '아군 성채 체력 +10%/레벨': 'Castle HP +10%/lv',
  '병참': 'Logistics', '모든 병종의 쿨타임 -3%/레벨': 'All unit cooldowns -3%/lv',
  '전시 국고': 'War Treasury', '전투 시작 군자금 +60/레벨': 'Starting funds +60/lv',
  '전리품 수거': 'Spoils', '적 처치 골드 +8%/레벨': 'Gold from kills +8%/lv',
  '사관학교': 'Academy', '병종 레벨 상한 +1/레벨 (최대 20레벨까지)': 'Unit level cap +1/lv (up to Lv 20)',
  '왕의 명령': "King's Command", '왕명 재사용 -8초, 회복량 +8%/레벨': 'Command cooldown -8s, healing +8%/lv',
  '무한 전장': 'Endless Siege',

  /* ---------------- 화면 ---------------- */
  '막대 왕국 전쟁': 'Stick Kingdom War', '왕국의 마지막 방어선': "The realm's last line", '왕국군': 'Kingdom', '오크 군단': 'Orc Horde',
  '출 진': 'MARCH', '교전 수칙': 'How to Play', '⚙ 설정 · 언어 / 소리': '⚙ Settings · Language / Sound',
  '전체화면 · 가로 고정': 'Fullscreen · Landscape', '저장 관리 · 백업 / 복원': 'Save · Backup / Restore', '기록 초기화': 'Reset Progress',
  '왕국 진군도': 'Campaign Map', '타이틀로': 'To title', '장 선택': 'Chapters', '설정': 'Settings',
  '국경 전선': 'Border Front', '왕도 수호': 'Royal Capital', '신화의 끝': 'End of Myths', '끝없는 웨이브': 'Endless waves',
  '1장': 'Ch.1', '2장': 'Ch.2', '2막': 'Act II', '무한': 'Endless',
  '짧은 전장': 'Short field', '보통 전장': 'Medium field', '긴 전장': 'Long field',
  '보스 전장': 'Boss stage', '출진 ▶': 'March ▶', '잠김': 'Locked',
  '이전 장을 먼저 돌파해야 한다.': 'Clear the previous chapter first.',
  '웨이브가 끝없이 온다. 웨이브마다 적이 강해지고 5웨이브마다 보스가 나온다. 성채가 무너질 때까지 몇 웨이브를 버티는지 겨룬다.': 'Waves never stop. Enemies grow stronger every wave, with a boss every 5. How long can your castle hold?',
  '끝이 없는 웨이브. 웨이브마다 적이 강해진다. 성채가 무너질 때까지 버텨라.': 'Endless waves, each stronger than the last. Hold until your castle falls.',
  '🔒 무한 전장은 20전장을 모두 돌파하면 열린다': '🔒 Endless opens after clearing all 20 stages',
  '도전': 'Challenge', '최고 기록': 'Best',
  '강화 병영': 'Barracks', '훈련소': 'Training', '소환의 제단': 'Summon Altar', '임무 · 업적': 'Missions',
  '편성': 'Squad', '뒤로': 'Back', '출진 편성': 'Battle squad', '보유 병종': 'Your units', '병종 분류': 'Unit filter',
  '카드를 끌어 위 칸에 놓는다 · 칸끼리 끌면 순서가 바뀐다 · 칸을 아래로 끌어내면 뺀다': 'Drag cards into the slots above · drag between slots to reorder · drag a slot down to remove',
  '편성 화면 열기 · 끌어서 배치': 'Open squad screen · drag & drop',
  '병종 목록 필터': 'Unit list filter', '전체': 'All', '내 편성': 'My squad', '적 도감': 'Bestiary',
  '평균 비용': 'Avg cost', '전설·신화': 'Legend+', '빈 칸 채우기': 'Fill empty', '비우기': 'Clear',
  '불러오기': 'Load', '저장': 'Save', '비어 있음': 'Empty', '해당하는 병종이 없다': 'No matching units',
  '병종을 누르면 여기에 정보가 나온다.': 'Tap a unit to see details here.',
  '첫 칸만 남겼다': 'Kept only the first slot', '채울 칸이 없다': 'Nothing to fill', '불러올 병종이 없다': 'No units to load',
  '칸이 가득 찼다': 'Squad is full', '칸이 가득 찼다. 칸 위에 끌어 놓으면 바꾼다': 'Squad is full. Drop onto a slot to swap',
  '최소 한 병종은 편성해야 한다': 'Keep at least one unit', ' 편성을 불러왔다': ' squad loaded', ' 에 기록했다': ' saved',
  '번 칸 비어 있음': ' slot empty', '번 칸 ': ' slot ', ' 빼기': ' remove', ' 편성됨': ' in squad', ' 대신 ': ' → ',
  '일일 임무': 'Daily', '매일 갱신': 'Resets daily', '업적': 'Achievements', '한 번만': 'One time', '기록': 'Records', '누적 전과': 'Lifetime stats',
  '전설 확정까지': 'Legend guaranteed in', '1회 소환 · 🔮 1': 'Summon ×1 · 🔮 1', '10회 소환 · 🔮 9': 'Summon ×10 · 🔮 9',
  '💰 2000 → 소환석 1': '💰 2000 → 1 Stone', '소환 결과': 'Results', '확인': 'OK',
  '전투 나가기': 'Leave battle', '처치': 'Kills', '남은 적': 'Foes left', '자동 꺼짐': 'Auto off', '자동 켜짐': 'Auto on', '일시정지': 'Paused',
  '▶ 또는 Space로 재개': 'Press ▶ or Space to resume', '왕국': 'Kingdom', '적 요새': 'Enemy fort',
  '전설·신화 액티브 능력': 'Legend actives', '왕의': "King's", '명령': 'Command',
  '승 리': 'VICTORY', '패 배': 'DEFEAT', '다시 싸운다': 'Retry', '다음 전장으로': 'Next stage', '진군도로': 'To map',
  '첫 출진': 'First March', '알겠다, 진군!': 'Got it, march!', '그렇게 한다': 'Do it', '아니다': 'No', '알겠다': 'Got it',
  '저장 관리': 'Save manager', '백업 내보내기': 'Export backup', '백업 파일 열기': 'Open backup file', '이전 저장 복원': 'Restore previous save',
  '백업 JSON': 'Backup JSON', '백업 내용을 복사하거나 여기에 붙여 넣을 수 있습니다.': 'Copy the backup or paste one here.',
  '붙여 넣은 백업 복원': 'Restore pasted backup', '닫기': 'Close',
  '가로로 돌려주세요': 'Please rotate to landscape',
  '언어 · Language': 'Language · 언어', '배경 음악': 'Music', '효과음': 'Sound effects', '이펙트 품질': 'Effects quality',
  '자동': 'Auto', '높음': 'High', '절전': 'Battery saver', '진동': 'Vibration', '피해 숫자': 'Damage numbers',
  '화면 흔들림': 'Screen shake', '전투 속도 기억': 'Remember battle speed',
  '전투 중에는 언어를 바꿀 수 없다': "Can't change language during battle",

  /* 전장 특성 */
  '중갑': 'Armored', '모든 적이 방어 60% — 받는 피해가 크게 준다 (중독·화상은 그대로)': 'All foes have 60% armor — damage is heavily cut (poison and burn ignore it)',
  '토르(파쇄) · 중독 · 화상 · 태양 낙인': 'Thor (breaker) · poison · burn · sun brand',
  '물량': 'Horde', '적이 1.8배 많이 몰려온다 (하나하나는 약하다)': '1.8× more foes (each one weaker)',
  '범위 공격 · 연쇄 번개 · 값싼 방패 벽': 'Area attacks · chain lightning · cheap shield walls',
  '영웅 사냥꾼': 'Hero Hunters', '적이 비용 350 이상인 아군(영웅·전설·신화)에게 3배 피해': 'Foes deal 3× damage to allies costing 350+ (Epic/Legend/Mythic)',
  '값싼 병력을 많이 · 소환물 · 비싼 병종은 뒤에': 'Many cheap troops · summons · keep pricey units back',
  '저주': 'Curse', '소환된 아군이 초당 10%씩 시들고, 회복·흡혈이 절반': 'Summoned allies wither 10%/s; healing and lifesteal halved',
  '소환·치유에 기대지 않는 진짜 병력': 'Real troops that need no summons or healing',
  '질주': 'Blitz', '적 이동 속도 +45% · 공격 속도 +20%': 'Foe move speed +45% · attack speed +20%',
  '둔화 · 넉백 면역 방패 · 튼튼한 앞줄': 'Slows · knockback-immune shields · a sturdy front',
  '전장 특성 · ': 'Battlefield traits · ', '대응 · ': 'Counter · ',
  '적 ×': 'Foes ×',

  /* 동적 문구 */
  '레벨 상한': 'Level cap', ' (전장을 돌파하면 상승)': ' (rises with progress)', ' (최대)': ' (max)',
  '카드는 편성한 병종만 나온다': 'Only squad units appear as cards',
  '미합류 병종': 'Not yet joined', '에 도달하면 합류한다.': ' — joins when reached.',
  '레벨': 'Lv', '비용': 'Cost', '체력': 'HP', '공격': 'ATK', '사거리': 'Range', '속도': 'Speed', '대기': 'Cooldown',
  '동시 출진': 'Max on field', '동시': 'Max', '액티브': 'Active',
  '최대 레벨': 'Max level', '상한 도달': 'At cap', '편성 해제': 'Remove', '자리 없음': 'Full', '훈련 완료': 'trained',
  '골드가 부족하다': 'Not enough gold', '군자금이 부족하다': 'Not enough funds', '소환석이 부족하다': 'Not enough stones',
  '넉백 면역': 'Knockback immune', '사망 시 폭발': 'Explodes on death', '아군 회복': 'Heals allies', '범위': 'Area', '보스': 'Boss', '적': 'Foe',
  '보상 받기': 'Claim', '보상을 받았다': 'Reward claimed', '수령 완료': 'Claimed', '달성': 'Done', '미달성': 'Locked', '진행 중': 'In progress',
  '임무는 날짜가 바뀌면 새로 뽑힌다.': 'Missions reroll each day.',
  '돌파한 전장': 'Stages cleared', '모은 별': 'Stars', '누적 처치': 'Total kills', '보스 처치': 'Bosses slain', '치른 전투': 'Battles',
  '소환 횟수': 'Summons', '훈련 횟수': 'Trainings', '총 전투 시간': 'Time in battle', '무한 전장 최고 기록': 'Endless best', '달성 업적': 'Achievements',
  '업적 달성: ': 'Achievement: ', '새 병종 해금: ': 'New unit: ', '신규': 'NEW', '보유 소환 병종': 'Summoned units',
  '기본 확률 (확정 제외)': 'Base rates (no guarantees)', '신화 확정까지': 'Mythic guaranteed in',
  '신화 강림!!': 'MYTHIC DESCENDS!!', '전설 강림!': 'LEGEND DESCENDS!', '영웅 등장': 'EPIC!', '소환석을 하나 얻었다': 'Got 1 summon stone',
  '출진 필요': 'Deploy first', '대상 없음': 'No target', '사용': 'Use', '준비': 'Ready', '아직 쿨타임이다': 'Still on cooldown', '쿨타임': 'Cooldown',
  '동시 출진 한도에 도달했다': 'Field limit reached', '왕명은 아직 준비되지 않았다': 'Command not ready yet',
  '자동 출진을 켰다': 'Auto deploy on', '자동 출진을 껐다': 'Auto deploy off', '재개': 'Resumed',
  '전투 포기': 'Abandon battle', '지금까지의 전과를 버리고 진군도로 돌아갈까?': 'Abandon this battle and return to the map?',
  '전투 재개': 'Keep fighting', '전투 종료': 'Battle over', '승리': 'Victory', '다시 도전': 'Try again',
  '강화를 올리거나 편성을 바꿔 보자.': 'Upgrade or change your squad.', '성채를 더 지키면 별 3개를 받는다.': 'Protect the castle better for 3 stars.',
  '왕국 방어전 전 전장 제패!': 'Every battlefield conquered!', '신기록!': 'New record!',
  '끝없는 증원 · ': 'Endless reinforcements · ', '다음 증원 · ': 'Next reinforcements · ', '보스 예고 · ': 'Boss incoming · ',
  '마지막 웨이브 · 남은 적을 처치하라': 'Final wave · defeat the rest',
  '적 증원 시작': 'Reinforcements begin', ' 증원': ' reinforcements', '보스 등장': 'BOSS', '왕 의 명 령': "KING'S COMMAND",
  '획득 골드 💰 ': 'Gold 💰 ', '  ·  남은 성채 ': '  ·  Castle ', '  (별 보너스 ': '  (star bonus ', '  ·  소환석 🔮 ': '  ·  Stones 🔮 ',
  '무한 전장 · 최고 ': 'Endless · best ', '최대 강화 완료': 'Fully upgraded', ' 골드로 강화': ' gold to upgrade',
  '기록을 초기화했다': 'Progress reset', '진행도와 소환한 병종까지 전부 사라진다. 정말 지울까?': 'All progress and summoned units will be erased. Really delete?',
  '진행도 복원': 'Restore progress', '진행도를 복원했습니다.': 'Progress restored.', '이전 자동 백업으로 진행도를 복구했습니다.': 'Recovered progress from the previous auto-backup.',
  '남아 있는 이전 백업이 없습니다.': 'No previous backup left.', '이전 백업을 읽지 못했습니다.': "Couldn't read the previous backup.",
  '백업 파일을 읽지 못했습니다. 다른 파일을 선택해 주세요.': "Couldn't read that backup. Pick another file.",
  '1MB 이하의 백업 파일을 선택해 주세요.': 'Choose a backup file under 1MB.', '복원하지 않았습니다: ': 'Not restored: ', '백업을 만들지 못했습니다: ': "Couldn't create backup: ",
  '. 이 데이터로 교체할까요? 현재 저장은 자동 백업에 남깁니다.': '. Replace with this data? Your current save stays in the auto-backup.',
  '전체화면을 지원하지 않는 기기다': "This device doesn't support fullscreen",
  '백업 파일은 앱 밖에 보관됩니다. 앱을 삭제하기 전에 백업을 따로 저장해 주세요.': 'Backups are stored outside the app. Save one before uninstalling.',
  '▶ 이어하기': '▶ Continue', '필살': 'ULT', '충전': 'CHARGE', '발동!': 'GO!', '초 남음': 's left', '(출전 중에 한 번 더 누르면 발동)': '(tap again while deployed to use)', '시즌 변경 시 누적 유지 · 신화 획득 시 두 누적 초기화': 'Kept when switching seasons · both reset on a Mythic', '회': '', '보상': 'Reward', '출진': 'Deploy', '돌파': 'Cleared', '웨이브': 'waves', '전장': 'Stage', '병종': 'units', '개 칸을 채웠다': ' slots filled',
  '단축키': 'Key', '보유': 'owned', '분': 'm', '레벨 +1 · 💰': 'Lv +1 · 💰'
};

/* 목록 문단처럼 굵은 글씨가 섞인 덩어리는 통째로 바꾼다 */
const I18N_EN_HTML = {
  '왼쪽 아래 <b>군자금 막대</b>가 시간이 지나면 저절로 찬다.': 'The <b>war funds bar</b> at the bottom left fills over time.',
  '아래 <b>카드</b>를 눌러 병사를 내보낸다. 숫자는 비용, 어두우면 쿨타임 중이다.': 'Tap a <b>card</b> below to deploy. The number is the cost; dark cards are on cooldown.',
  '병사는 알아서 전진한다. <b>오른쪽 끝 적 요새</b>를 무너뜨리면 승리다.': 'Soldiers advance on their own. Destroy the <b>enemy fort on the right</b> to win.',
  '왼쪽 끝 <b>아군 성채</b>가 무너지면 패배다. 성채를 많이 지킬수록 별을 더 받는다.': 'Lose if <b>your castle on the left</b> falls. Keep it healthier for more stars.',
  '화면을 좌우로 밀면 전장을 살펴볼 수 있다.': 'Swipe left and right to look around the field.',
  '군자금은 시간이 지나면 저절로 찬다. 아래쪽 막대가 현재 보유량이다.': 'War funds fill over time. The bar at the bottom shows what you have.',
  '아래 카드를 눌러 병사를 출진시킨다. 카드마다 비용과 쿨타임이 있다.': 'Tap cards to deploy soldiers. Each card has a cost and a cooldown.',
  '병사는 알아서 전진해 적과 싸운다. <b>적 요새를 무너뜨리면 승리</b>.': 'Soldiers advance and fight on their own. <b>Destroy the enemy fort to win</b>.',
  '아군 성채가 무너지면 패배. 화면을 좌우로 밀어 전장을 살필 수 있다.': 'Lose if your castle falls. Swipe to scan the field.',
  '체력이 일정 비율 아래로 떨어지면 병사가 뒤로 밀린다. 방패병으로 버티고 뒤에서 화살을 퍼부어라.': 'Units get knocked back at certain HP thresholds. Hold with shields and rain arrows from behind.',
  '키보드: <b>1~0</b> 출진 · <b>Q</b> 왕명 · <b>Space</b> 정지 · <b>A</b> 자동 · <b>F</b> 전선 추적.': 'Keys: <b>1~0</b> deploy · <b>Q</b> command · <b>Space</b> pause · <b>A</b> auto · <b>F</b> follow front.',
  '전투로 얻은 골드로 병영에서 무기·갑옷·성벽을 강화한다.': 'Spend battle gold in the Barracks on weapons, armor and walls.',
  '훈련소에서 병종별로 레벨을 올린다. 레벨당 체력과 공격력이 기본 능력치의 10%씩 오른다.': 'Level units in Training. Each level adds 10% of base HP and ATK.',
  '레벨 상한은 기본 5이며 전장 돌파와 사관학교 강화로 오른다. 기본 최대 15, 사관학교를 모두 강화하면 최대 20레벨.': 'The level cap starts at 5 and rises with progress and the Academy: 15 normally, 20 with a maxed Academy.',
  '전장을 돌파할수록 새로운 병종이 합류한다.': 'New units join as you clear stages.',
  '우측 하단 <b>왕의 명령</b>은 전군을 회복시키고 공격 속도를 끌어올린다.': "The <b>King's Command</b> at the bottom right heals everyone and boosts attack speed.",
  '성채 체력을 많이 남길수록 별을 더 받는다. 별은 처음 딸 때 골드를 준다.': 'More castle HP left means more stars. First-time stars give gold.',
  '이 전장은 가로 화면 전용이다.<br>기기를 눕히면 바로 시작한다.': 'This game is landscape only.<br>Turn your device sideways to start.'
};

/* 숫자가 붙은 말. 구절 치환보다 먼저 한다. */
const I18N_EN_PATTERNS = [
  [/(\d+)\s*전장 돌파/g, 'Stage $1 cleared'],
  [/전장 (\d+)/g, 'Stage $1'],
  [/(\d+)\s*전장/g, 'Stage $1'],
  [/(\d+)\s*레벨/g, 'Lv $1'],
  [/레벨 (\d+)/g, 'Lv $1'],
  [/(\d+)초 남음/g, '$1s left'],
  [/(\d+(?:\.\d+)?)\s*초/g, '$1s'],
  [/(\d+)\s*웨이브/g, '$1 waves'],
  [/웨이브 (\d+)/g, 'Wave $1'],
  [/(\d+)\s*병종/g, '$1 units'],
  [/(\d+)\s*회/g, '$1×'],
  [/(\d+)\s*명/g, '$1'],
  [/(\d+)\s*체/g, '$1'],
  [/(\d+)\s*개/g, '$1'],
  [/저장 (\d)/g, 'Save $1']
];

const I18N = {
  lang: (typeof Settings !== 'undefined' && Settings.get('lang')) || 'ko',
  cache: new Map(),
  re: null,
  hangul: /[가-힣]/
};

function i18nPhraseRe() {
  if (I18N.re) return I18N.re;
  // 한 글자 말(적, 라, 분)은 다른 낱말 속에 끼어 있으니 통째로 맞을 때만 바꾼다
  const keys = Object.keys(I18N_EN).filter(k => k.trim().length >= 2 && /[가-힣]/.test(k))
    .sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  I18N.re = new RegExp(keys.join('|'), 'g');
  return I18N.re;
}

/* 한국어 문구 → 현재 언어 */
function t(s) {
  if (I18N.lang !== 'en' || typeof s !== 'string' || !I18N.hangul.test(s)) return s;
  const hit = I18N.cache.get(s);
  if (hit !== undefined) return hit;
  let out;
  const core = s.trim();
  if (Object.prototype.hasOwnProperty.call(I18N_EN, s)) out = I18N_EN[s];
  else if (core && Object.prototype.hasOwnProperty.call(I18N_EN, core)) out = s.replace(core, I18N_EN[core]);
  else {
    out = s;
    for (const [re, rep] of I18N_EN_PATTERNS) out = out.replace(re, rep);
    out = out.replace(i18nPhraseRe(), m => I18N_EN[m]);
  }
  if (I18N.cache.size > 4000) I18N.cache.clear();
  I18N.cache.set(s, out);
  return out;
}

/* 자료의 글자를 한 번에 바꾼다. 통째로 맞는 것만 — 자료 문장은 전부 사전에 있다. */
function i18nData(o, depth) {
  if (!o || typeof o !== 'object' || depth > 6) return;
  for (const k in o) {
    const v = o[k];
    if (typeof v === 'string') {
      if (I18N.hangul.test(v) && Object.prototype.hasOwnProperty.call(I18N_EN, v)) o[k] = I18N_EN[v];
    } else if (v && typeof v === 'object') i18nData(v, depth + 1);
  }
}

const I18N_ATTRS = ['aria-label', 'title', 'placeholder'];

function i18nNode(node) {
  if (node.nodeType === 3) {
    const v = node.nodeValue;
    if (I18N.hangul.test(v)) { const n = t(v); if (n !== v) node.nodeValue = n; }
    return;
  }
  if (node.nodeType !== 1) return;
  if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'TEXTAREA') return;
  for (const a of I18N_ATTRS) {
    const v = node.getAttribute(a);
    // 같은 값을 다시 쓰면 그것도 변경으로 잡혀 끝없이 돈다
    if (v && I18N.hangul.test(v)) { const n = t(v); if (n !== v) node.setAttribute(a, n); }
  }
  if ((node.tagName === 'LI' || node.tagName === 'P') && I18N_EN_HTML[node.innerHTML.trim()]) {
    node.innerHTML = I18N_EN_HTML[node.innerHTML.trim()];
    return;
  }
  for (let c = node.firstChild; c; c = c.nextSibling) i18nNode(c);
}

function i18nStart() {
  if (I18N.lang !== 'en') return;
  document.documentElement.lang = 'en';
  document.title = t(document.title);
  i18nNode(document.body);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') i18nNode(m.target);
      else if (m.type === 'attributes') {
        const v = m.target.getAttribute(m.attributeName);
        if (v && I18N.hangul.test(v)) { const n = t(v); if (n !== v) m.target.setAttribute(m.attributeName, n); }
      } else m.addedNodes.forEach(i18nNode);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true,
                               attributes: true, attributeFilter: I18N_ATTRS });
}

if (I18N.lang === 'en') {
  [UNITS, ENEMIES, STAGES, SEASONS, MISSION_DEFS, ACHIEVEMENTS, UPGRADES, COMMAND, RARITY, STAGE_MODS]
    .forEach(o => i18nData(o, 0));
  // 무한 전장은 부를 때마다 새로 만든다
  const makeEndlessKo = makeEndlessStage;
  makeEndlessStage = function (n) { const st = makeEndlessKo(n); st.name = t(st.name); return st; };
  if (document.body) i18nStart();
  else document.addEventListener('DOMContentLoaded', i18nStart);
}
