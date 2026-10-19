/* =======================================================================
 *  막대 왕국 전쟁 - 전투 엔진 (라인 배틀 + 특수 능력)
 * ======================================================================= */

/* 전장 가로 길이(월드 좌표). 전장마다 다르다(STAGES[i].len).
 * 적 요새·적 출진 위치가 길이에 매여 있어서 전투를 만들 때 함께 맞춘다. */
// 전장 병력 상한 (직접 낸 병사 / 소환물 포함). 병종·전장과 상관없이 모두 같다.
// 3.12: 50 / 80 → 40 / 60. 화면에 병사가 쌓일수록 그리는 값이 늘어 폰이 뜨거워졌다.
const FIELD_CAP = 40, FIELD_TOTAL_CAP = 60;
const VANGUARD_LEAD = 60;
const HERO_SHARED_CD = 0;   // 3.13: 액티브 공용 대기 (예전 6초)    // 3.9: 근접 영웅이 전열보다 앞설 수 있는 거리

const WORLD_DEFAULT = 2000;
let WORLD = WORLD_DEFAULT;

function anyDead(list) { for (let i = 0; i < list.length; i++) if (list[i].dead) return true; return false; }
function coolCastle(c, dt) {
  if (c.hitFlash > 0) c.hitFlash = Math.max(0, c.hitFlash - dt);
  if (c.wardHit > 0) c.wardHit = Math.max(0, c.wardHit - dt);
}

const ALLY_BASE_X = 96;      // 아군 성채 위치
let ENEMY_BASE_X = WORLD - 96;
const ALLY_SPAWN_X = 150;
let ENEMY_SPAWN_X = WORLD - 150;
function setWorld(len) {
  WORLD = len || WORLD_DEFAULT;
  ENEMY_BASE_X = WORLD - 96;
  ENEMY_SPAWN_X = WORLD - 150;
}
const KILL_GOLD_RATE = 0.20; // 처치 보상 배율

/* 효과음 헬퍼: 브라우저에서만 동작하고, 같은 소리가 몰릴 때는 솎아낸다 */
const _sfxAt = {};
const _sfxGap = { quake: 400, slash: 90, hit: 90, arrow: 110, boom: 140, die: 120, deploy: 40, gold: 200, rally: 250,
                  cannon: 160, zap: 140, rocket: 160, drill: 120, drone: 140, siren: 900,
                  dozer: 200, freeze: 140, saber: 110, rail: 200 };
function sfx(name) {
  if (typeof SFX === 'undefined' || !SFX.ready || !SFX.on) return;
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  const gap = _sfxGap[name] || 0;
  if (gap && _sfxAt[name] && now - _sfxAt[name] < gap) return;
  _sfxAt[name] = now;
  const fn = SFX[name];
  if (fn) fn.call(SFX);
}

/* 4.12 보스: 밀치기는 1/3 만 먹고, 근접 보스는 칠 적이 없으면 던진다 */
const BOSS_PUSH_TAKEN = 0.35;
const BOSS_SHOVE_GAP = 1;          // 4.23 보스가 병사의 밀치기에 다시 밀릴 수 있기까지 (초)
const BOSS_ENTRY_GAP = 400;        // 4.23 보스 등장 충격파: 아군을 보스에게서 이만큼(+0~80) 떨어뜨린다
const BOSS_ENTRY_GAP_CAMPAIGN = 260;   //       진군 · 무한 전장
const BOSS_ENTRY_FLY = 0.65;       //       날아가는 시간 (초)
const HOLD_GAP = 12;          // 밀려나도 자기 요새 바로 앞에서 멈춘다 (근접 병사가 닿는 자리)
const BOSS_THROW = { first: 2, every: 4.5, range: 340, mul: 0.25, radius: 70 };
/* 4.13 보기 전용 난수: 효과의 흔들림 · 위치에만 쓴다. Math.random 을 쓰면 효과를 바꿀 때마다 전투 결과가 흔들린다 */
let _visSeed = 1234567;
function visRand() { _visSeed = (_visSeed * 1103515245 + 12345) & 0x7fffffff; return _visSeed / 0x7fffffff; }
const FX_LIMIT = 200;        // 이펙트가 무한정 쌓이지 않게
const X3_FX_LIMIT = 12;      // 4.3 3진 연출(포연·광선·사이렌)이 한꺼번에 떠 있을 수 있는 수
// 3진의 타격 연출 → 땅에 남는 Canvas 연출 (연기 · 흙 · 갈라진 땅 · 눈더미 · 그을린 자국)
const X3_GROUND = { shellblast: 'boom', rocketpunch: 'quake', dronestrike: 'smoke', dozerpush: 'dirtwave', snowburst: 'frost', railhit: 'railscar',
                    mechstaff: 'quake', boltstrike: 'railscar', solarburn: 'sunscar',   // 4.7
                    dragonslash: 'quake',   // 4.15
                    teslacoil: 'railscar', kusanagi: 'quake',   // 4.25
                    starfall: 'starscar', plasmablast: 'plasmascar',   // 4.18
                    gungnir: 'runescar', yggdrasil: 'rootscar', bagua: 'baguascar', petrify: 'stonescar', goldbat: 'quake', djinnblast: 'starscar' };   // 5.2
const REINFORCE_FIRST = 10;  // 대본 웨이브가 끝나고 첫 증원까지
const REINFORCE_MIN = 3.0;   // 증원 간격 하한
const REINFORCE_STEP = 0.06; // 증원 한 번마다 적이 세지는 폭
const REINFORCE_MAX = 1.9;   // 증원 강화 상한 (끝없이 세지면 이길 수가 없다)
const REINFORCE_CAP = 16;    // 증원으로 전장에 동시에 설 수 있는 적 수
/* 동시에 터지는 필살 연출 수. Canvas2D 로 그릴 때는 연출 수에 정비례해
 * 비용이 늘어나 4개에서 막아야 했다. WebGL 레이어가 살아 있으면 비용이
 * 거의 늘지 않으므로 화면 쪽에서 이 값을 올려 준다. */
let CAST_LIMIT = 4;
let CAST_BIG_LIMIT = 2;
function setCastLimits(n, big) {
  CAST_LIMIT = n;
  CAST_BIG_LIMIT = big;
}
const HUNT_COST = 350;        // 영웅 사냥꾼 특성이 노리는 비용
const HUNT_MUL = 4;
const CURSE_HEAL = 0.5;       // 저주: 아군 회복·흡혈 배율
const CURSE_WITHER = 0.1;     // 저주: 소환물이 초당 잃는 최대 체력 비율
const SLOW_SPEED_MUL = 0.45; // 둔화 시 이동
const SLOW_RATE_MUL = 1.7;   // 둔화 시 공격 간격
/* 3.0: 기절이 풀리면 잠깐은 다시 기절하지 않는다. 기절을 거는 병사를 줄지어 세워
 * 적을 영원히 굳히던 것(메두사 열 명)을 막는다. 보스는 짧게 기절하고 오래 버틴다. */
const STUN_GUARD = 1.8;
const STUN_DUR_MUL = 0.75;   // 3.0.2: 아군이 적에게 거는 기절은 모두 이만큼 짧다
/* 3.0.2: 원거리 도배 막기. 앞을 막아 주는 근접 아군이 없으면 원거리 병사는 조준이 흐트러져
 * 피해가 줄어든다. 근접과 섞은 편성은 그대로, 원거리만 몰아 넣은 편성만 약해진다. */
const COVER_SLACK = 30;      // 이만큼 뒤에 근접 아군이 서 있어도 엄호로 본다
const EXPOSED_MUL = 0.35;    // 엄호 없는 원거리 피해 배율
const FALLOFF_FROM = 0.5;    // 엄호 없는 원거리는 사거리의 이만큼부터 멀수록 더 약해져
const FALLOFF_MIN = 0.65;    // 사거리 끝에서는 이만큼만 들어간다
const RUSH_MUL = 2.0;        // 근접 전열이 통째로 비어 있으면 적이 이만큼 빨리 밀고 들어온다
/* 3.1: 어려운 전장은 확실히 어렵게.
 * - 보스 격노: 캠페인 보스가 나온 뒤 BOSS_ENRAGE_T 초가 지나도 살아 있으면 공격·속도가 오른다.
 *   보스를 뒤로 미뤄 두고 잡몹만 쓸어 담던 싸움을 끝낸다.
 * - 격앙(fury): 하드코어와 2막에서는 싸움이 길어질수록 새로 나오는 적이 더 억세진다. */

const OVERTIME_T = 240;          // 3.2.1 장기전: 이 시간이 지나면 (격앙이 없는 전장도) 새 적이 억세진다
const OVERTIME_RATE = 0.12;      // 30초마다 +12%, 상한 없음 — 버티기만 하는 싸움도 결국 끝난다
const TURRET_IDLE = 2.5;         // 포탑: 이만큼 놀면 앞으로 옮긴다
const TURRET_SPEED = 34;    // 3.2.1: 무한 전장 요새는 이 웨이브부터 무너뜨릴 수 있다
const BOSS_ENRAGE_T = 50;
const BOSS_ENRAGE = { atk: 1.6, speed: 1.3, rate: 0.8 };
const ACT2_FURY = { per30: 0.06, max: 0.6 };
const COVER_GRACE = 8;       // 근접 전열이 모두 쓰러져도 이 시간 동안은 다음 근접을 내보낼 틈으로 봐 준다
const STUN_GUARD_BOSS = 2.5;
const LAVA_FROST_MUL = 1.25;  // 5.3 9막 용암 군단: 둔화된 동안 받는 피해 (서리에 약하다)
const LAVA_BURN_MUL = 0.5;    // 5.3 용암 군단은 화상이 반만 듣는다
const WARD_FLOOR = 0.05;     // 보스가 살아 있는 동안 적 요새는 이 아래로 무너지지 않는다
const CHRONO_RATE = 0.6;     // 시간 주술사가 살아 있으면 카드 재사용 대기가 이 속도로 준다
const BOSS_MUL_EXP = 0.5;    // 캠페인 보스가 받는 전장 배율의 지수
const ENEMY_HEAL_GAP = 1.5;  // 적 하나가 다른 적의 치유를 받는 최소 간격
const BOSS_HEAL_TAKEN = 0.4; // 보스는 다른 적의 치유를 이만큼만 받는다 (주술사 떼가 보스를 영원히 살리지 못하게)

/* ------------------------------- 병사 ------------------------------- */
class Fighter {
  constructor(stats, side, x, buff) {
    this.s = stats;
    this.ab = stats.ab || {};
    this.side = side;                 // 'ally' | 'enemy'
    this.dir = side === 'ally' ? 1 : -1;
    this.x = x;
    this.row = Math.floor(Math.random() * 3);
    this.bob = Math.random() * Math.PI * 2;

    const hpMul = (buff && buff.hp) || 1;
    const atkMul = (buff && buff.atk) || 1;
    this.abMul = atkMul;
    this.maxHp = Math.round(stats.hp * hpMul);
    this.hp = this.maxHp;
    this.atk = Math.round(stats.atk * atkMul);

    this.cd = stats.interval * 0.35;
    this.kbLeft = stats.kb || 1;
    this.kbTimer = 0;
    this.hitFlash = 0;
    this.swing = 0;
    this.dead = false;
    this.moving = false;
    // 그림에만 쓰는 값: 나온 지 얼마나 됐나, 지금 누군가와 맞붙어 있나
    this.age = 0;
    this.engaged = false;
    this.healMul = 1;           // 저주 전장에서는 절반
    this.weakT = 0; this.weakMul = 1;   // 무당의 액막이: 이 적이 주는 피해가 준다
    this.charmT = 0;                    // 구미호의 홀림: 제 편을 친다
    this.spin = 0;                      // 증기 거상: 쏠수록 빨라진다
    this.scale = stats.scale || 1;
    this.radius = 26 * this.scale;

    // 상태이상 / 능력 타이머
    this.slowT = 0;
    this.stunT = 0;
    this.poisonT = 0;
    this.poisonDps = 0;
    this.burnT = 0;
    this.burnDps = 0;
    this.hasteT = 0;
    this.hasteMul = 1;
    this.barrier = 0;
    this.barrierMax = 0;
    this.usedRevive = false;
    this.abCd = 0;
    this.auraPulse = 0;

    // 전설·신화 고유 능력용
    this.rallyT = 0;        // 오딘의 지휘: 공격력이 오른 상태
    this.rallyMul = 1;
    this.vulnT = 0;         // 라의 낙인: 받는 피해가 늘어난 상태
    this.vulnMul = 1;
    this.reCd = 0;          // 하데스의 부활 대기

    // 보스 패턴용
    this.speedMul = 1;      // 광폭화로 빨라진다
    this.rateMul = 1;       // 공격 간격 배율 (작을수록 빠름)
    this.phaseIdx = 0;      // 지금까지 넘긴 페이즈
    this.specialCd = (stats.special && stats.special.first) || 6;
    this.enraged = false;

    // 3.0
    this.stunImm = 0;       // 기절 뒤 잠깐의 면역
    this.chargeDist = 0;    // 창기병: 쉬지 않고 달려온 거리
    this.baseAtk = this.atk;
    this.baseScale = this.scale;
    this.souls = 0;         // 흡혼귀가 삼킨 영혼
    this.stolen = 0;        // 금화 도둑이 훔친 군자금
    this.hookCd = 2.5;      // 사슬 간수 첫 갈고리

    // 3.2 이벤트 보스: 타이밍을 맞춰야 잡힌다
    this.veilT = 0;         // 안개화: 주변의 피를 빨고, 안개 속에 내보낸 병사를 홀린다 (4.12: 무적은 뺐다)
    this.reflectT = 0;      // 반사 결계: 받은 피해를 때린 자에게 되돌린다
    this.exposedT = 0;      // 약점 노출: 핵(core)이 드러나 피해가 몇 배로 들어간다
    this.curSpecial = null; // 페이즈에 따라 바뀐 고유 기술

    // 4.22: 전투 중에 덧붙던 속성을 처음부터 둔다 — 병사마다 모양(숨은 클래스)이 갈려 뜨거운 반복문의 속성 읽기가
    // 다형(megamorphic)으로 떨어졌다 (엔진 시간의 절반 남짓이 속성 읽기). 값의 뜻은 그대로: undefined 를 따지는 것은 undefined 로.
    this.kind = null; this.gold = 0; this.boss = false; this.mul = undefined; this.wave = undefined;
    this.summoned = false; this.summonedBy = null; this.raisedBy = null; this.creditTo = null; this.dotBy = null;
    this.shadow = false; this.exploded = false; this.vanish = false; this.reaped = false; this.exposed = false;
    this.furious = false; this.burrowed = false; this.unveiled = false; this.leapt = false; this.resistFx = false; this.reviveFx = false;
    this.lifeT = undefined; this.maskCd = undefined; this.bornT = undefined; this.healedAt = undefined; this.throwCd = undefined; this.trainCd = undefined;
    this.idleT = 0; this.podT = 0; this.salvoN = 0; this.chargeT = 0; this.ramCd = 0; this.horn = false; this.charmGuard = 0; this.reflectRatio = 0;
    // 4.21 보스 각인
    this.affixes = null; this.windT = 0; this.guardCut = 0; this.guardOf = null; this.wardCut = 0;
    this.cloneOf = null; this.cloneT = 0; this.cloneHeal = 0; this.cloneReturns = 0;
    // 4.23 보스 등장 충격파로 날아가는 속도(0 이면 보통 넉백) · 보스가 밀치기에 다시 밀릴 수 있는 때
    this.flyV = 0; this.flyT = 0; this.shoveT = 0;
    this.frenzyT = 0; this.frenzyRate = 1; this.frenzySpeed = 1;   // 4.23 광폭 각인
  }

  /* 기절. 면역 중이거나 부동심이면 걸리지 않는다. 걸렸으면 true */
  stun(d) {
    if (this.dead || !(d > 0) || this.ab.unshakable || this.stunImm > 0) return false;
    // 3.0.1: 몸이 무겁거나 정신이 굳은 적은 기절을 받지 않거나(stunImmune) 짧게 받는다(stunResist)
    if (this.ab.stunImmune) { this.resistFx = true; return false; }
    if (this.ab.stunResist) d *= 1 - this.ab.stunResist;
    if (this.side === 'enemy') d *= STUN_DUR_MUL;
    if (this.boss) d *= 0.5;
    this.stunT = Math.max(this.stunT, d);
    this.stunImm = d + (this.boss ? STUN_GUARD_BOSS : STUN_GUARD);
    return true;
  }

  get speedNow() { return this.s.speed * this.speedMul * (this.slowT > 0 ? SLOW_SPEED_MUL : 1); }

  get intervalNow() {
    let v = this.s.interval * this.rateMul;
    if (this.slowT > 0) v *= SLOW_RATE_MUL;
    if (this.hasteT > 0) v *= this.hasteMul;
    if (this.spin > 0) v /= (1 + this.spin);
    if (this.ab.enrage) {                       // 피가 깎일수록 빨라진다
      const missing = 1 - this.hp / this.maxHp;
      v /= (1 + (this.ab.enrage - 1) * missing);
    }
    return Math.max(0.12, v);
  }
  get attackRange() { return this.s.range; }

  heal(amount) {
    if (this.dead) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount * this.healMul);
    return this.hp - before;          // 3.15: 실제로 찬 만큼 (전투 기록의 회복량)
  }

  giveBarrier(amount) {
    if (this.dead) return;
    if (this.barrier < amount) {
      this.barrier = amount;
      this.barrierMax = Math.max(this.barrierMax, amount);
    }
  }

  takeDamage(dmg, pierceArmor) {
    if (this.dead) return 0;
    dmg = Math.max(0, dmg);
    // 핵: 평소엔 거의 막고, 약점이 드러난 동안에만 몇 배로 들어간다
    if (this.ab.core) dmg *= this.exposedT > 0 ? this.ab.core.mul : (1 - this.ab.core.armor);
    if (this.guardCut > 0) dmg *= 1 - this.guardCut;                  // 4.21 수호 토템이 선 동안
    if (this.vulnT > 0) dmg *= this.vulnMul;                          // 낙인
    if (this.ab.armor && !pierceArmor) dmg *= (1 - Math.min(0.75, this.ab.armor));   // 두꺼운 갑주
    if (this.barrier > 0) {
      const absorbed = Math.min(this.barrier, dmg);
      this.barrier -= absorbed;
      dmg -= absorbed;
      this.hitFlash = 0.15;
      if (dmg <= 0) return 0;
    }
    const dealt = Math.min(this.hp, Math.max(0, dmg));
    this.hp -= Math.max(0, dmg);
    this.hitFlash = 0.15;
    if (this.hp <= 0) {
      if (this.ab.revive && !this.usedRevive) {     // 1회 부활
        this.usedRevive = true;
        this.hp = Math.round(this.maxHp * this.ab.revive);
        this.kbTimer = 0.5;
        this.reviveFx = true;
        return dealt;
      }
      this.hp = 0;
      this.dead = true;
      return dealt;
    }
    if (this.ab.kbImmune) return dealt;                   // 넉백 면역
    const kbTotal = this.s.kb || 1;
    const stepsLeft = Math.ceil((this.hp / this.maxHp) * kbTotal);
    if (stepsLeft < this.kbLeft) {
      this.kbLeft = stepsLeft;
      this.kbTimer = 0.42;
    }
    return dealt;
  }
}

/* ------------------------------- 성채 ------------------------------- */
class Castle {
  constructor(side, hp, x) {
    this.side = side;
    this.maxHp = hp;
    this.hp = hp;
    this.x = x;
    this.dead = false;
    this.hitFlash = 0;
    this.isCastle = true;
    this.radius = 60;
    this.ab = {};
    this.floor = 0;           // 이 아래로는 무너지지 않는다 (보스의 결계)
    this.wardHit = 0;
  }
  takeDamage(d) {
    d = Math.max(0, d);
    // 보스의 결계: 보스를 쓰러뜨리기 전에는 요새가 끝까지 무너지지 않는다
    if (this.floor > 0 && this.hp - d < this.floor) { d = Math.max(0, this.hp - this.floor); this.wardHit = 0.35; }
    const dealt = Math.min(this.hp, d);
    this.hp -= d;
    this.hitFlash = 0.15;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    return dealt;
  }
  heal() {}
  giveBarrier() {}
}

/* ------------------------------ 전투 ------------------------------ */
class Battle {
  constructor(stageIndex, save, customStage, opts) {
    this.stageIndex = stageIndex;
    this.stage = customStage || STAGES[stageIndex];
    this.endless = !!this.stage.endless;
    this.save = save;
    // 하드코어: 돌파한 전장을 더 모질게 (적 ×3.5 · 격앙 · 특성 하나 더 · 성채 60% · 왕명 느림)
    this.hard = !!(opts && opts.hard) && !this.endless;
    this.enemyMulBase = this.hard ? hardcoreEnemyMul(this.stage) : (this.stage.enemyMul || 1);
    this.fury = this.endless ? null : this.hard ? HARDCORE.fury
      : (this.stage.fury || (this.stageIndex >= 20 && this.stageIndex < STAGES.length ? ACT2_FURY : null));
    this.event = this.stage.event || null;      // 3.2 이벤트 전장
    this.expedition = this.stage.expedition || null;   // 3.7 금화 원정

    const up = save.upgrades;
    this.buff = {
      hp: 1 + 0.08 * (up.vitality || 0),
      atk: 1 + 0.06 * (up.power || 0)
    };
    this.levels = save.levels || {};
    // 5.0 정벌: 축복 · 유물을 모은 효과(opts.run = conqEffects) · 이어 온 성채(opts.castle)
    const R = this.run = (opts && opts.run) || null;
    this.deckFixed = (opts && opts.deck) || null;
    this.conquest = this.stage.conquest || null;
    if (R) { this.buff.hp *= R.hp; this.buff.atk *= R.atk; }

    this.walletMax = 900 + 260 * (up.wallet || 0);
    this.income = this.stage.rate * (1 + 0.12 * (up.income || 0));
    this.cdMul = Math.max(0.4, 1 - 0.03 * (up.logistics || 0));
    this.goldMul = 1 + 0.08 * (up.spoils || 0);
    this.money = Math.min(this.walletMax,
                          this.stage.money + 60 * (up.treasury || 0));
    if (R) { this.walletMax += R.wallet; this.income *= R.income; this.cdMul *= R.cd; this.money = Math.min(this.walletMax, this.money + R.startMoney); }

    // 왕의 명령
    const cmdLv = up.command || 0;
    this.cmdMax = Math.max(25, COMMAND.baseCooldown - COMMAND.cooldownPerLv * cmdLv) * (this.hard ? HARDCORE.cmdMul : 1);
    if (R) this.cmdMax *= R.cmdCd;
    this.cmdCd = R && R.cmdStart ? 0 : this.cmdMax;   // 시작하자마자는 쓸 수 없다 (5.1 정벌 '선왕의 인장'은 바로)
    this.cmdHeal = COMMAND.healRatio + COMMAND.healPerLv * cmdLv + (R ? R.cmdHeal : 0);
    this.cmdUses = 0;
    this.heroCooldowns = {};
    this.heroGlobalCd = 0;

    setWorld(this.stage.len);
    const castleHp = Math.round(4000 * (1 + 0.10 * (up.castle || 0)) * (this.hard ? HARDCORE.castleMul : 1));
    this.allyCastle = new Castle('ally', castleHp, ALLY_BASE_X);
    this.enemyCastle = new Castle('enemy', this.hard ? hardcoreFortHp(this.stage) : this.stage.baseHp, ENEMY_BASE_X);
    if (R) {                     // 정벌: 성채 최대 체력 축복 · 지난 전투에서 남은 만큼으로 시작
      this.allyCastle.maxHp = Math.round(this.allyCastle.maxHp * R.castle * (this.stage.conquest ? CONQ.castleMul : 1));   // 5.1 원정 성채는 얇다
      if (R.fortHp !== 1) { this.enemyCastle.maxHp = Math.max(1, Math.round(this.enemyCastle.maxHp * R.fortHp)); this.enemyCastle.hp = this.enemyCastle.maxHp; }   // 5.1 공성
      this.allyCastle.hp = Math.max(1, Math.round(this.allyCastle.maxHp * Math.min(1, opts.castle === undefined ? 1 : opts.castle)));
    }

    this.allies = [];
    this.enemies = [];
    this.burrowers = [];        // 땅속을 기어 오는 적: 아무도 겨눌 수 없다
    this.sallyDone = 0;         // 요새 반격을 몇 번 했나
    this.shots = [];
    this.fx = [];

    this.time = 0;
    this.state = 'play';
    this.coins = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.dmgFxCount = 0;
    this.meter = {};            // 3.15: 병종별 전투 기록 { id: { dmg, taken, n } }
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.bossAlert = 0;
    this.patternName = '';
    this.patternT = 0;
    this.pending = [];          // 예고 후 떨어지는 공격
    this.cooldowns = {};
    this.speed = 1;

    // 보스는 반드시 쓰러뜨려야 한다. 원거리로 요새만 두드려 보스를 건너뛰던 것을 막는다.
    // 4.6 폭주 기관차처럼 요새만 부수면 끝나는 전장은 결계가 없다 (noWard)
    this.bossWard = !!(this.stage.bossId && !this.endless && !this.stage.noWard);
    this.sealed = {};           // 4.6 가면 군주가 봉인한 카드: id → 남은 초
    this.bossSpawned = false;
    this.bossDown = false;
    this.chronoOn = false;
    this.eruptN = 0;            // 5.3 9막 분화 횟수
    this.twinWait = [];         // 5.3 도전 '해와 달의 쌍왕': 되살아나기를 기다리는 쌍왕

    this.queue = [];
    this.mods = {};
    (this.hard ? hardcoreMods(this.stage, stageIndex) : (this.stage.mods || [])).forEach(m => { this.mods[m] = true; });
    this.stage.waves.forEach((w0, index) => {
      // 물량: 보스가 아닌 무리는 1.8배로, 더 촘촘하게
      const w = (this.mods.horde && !(ENEMIES[w0.e] && ENEMIES[w0.e].boss))
        ? Object.assign({}, w0, { n: Math.ceil(w0.n * 1.8), gap: w0.gap * 0.6 }) : w0;
      for (let i = 0; i < w.n; i++) this.queue.push({ t: w.t + i * w.gap, e: w.e, wave: w.wave !== undefined ? w.wave : index, mul: w.mul });
    });
    this.queue.sort((a, b) => a.t - b.t);
    this.qi = 0;
    // 끝없는 무한 전장: 대기열이 줄면 다음 웨이브를 이어 붙인다
    this.endlessW = 0;
    this.endlessT = 2;
    if (this.stage.infinite) this.extendEndless();

    // 증원: 대본 웨이브가 동나도 적 요새는 병력을 계속 토해낸다.
    // 버티기만 해서는 절대 끝나지 않고, 요새를 부수는 수밖에 없다.
    const seen = {}, pool = [], heavy = [];
    this.stage.waves.forEach(w => {
      if (seen[w.e]) return;
      seen[w.e] = true;
      const spec = ENEMIES[w.e];
      if (!spec || (spec.ab && spec.ab.hold)) return;    // 토템처럼 박혀 있는 건 제외
      const ab = spec.ab || {};
      // 보스는 증원으로 절대 다시 오지 않는다. 전장마다 하나뿐이다.
      if (spec.boss) return;
      // 시간술·갈고리·포식·자폭처럼 판을 비트는 적은 증원으로 끝없이 오면 풀 수가 없다
      if (spec.noReinf) return;
      // 장거리 공성은 증원에서 아예 뺀다. 전선이 닿지 않는 자리에서 쏘기만 하니
      // 죽지 않고 계속 쌓여 전장을 영영 멈춰 세운다.
      if (spec.range > 300) return;
      // 보스·갑주·넉백 면역은 상시 증원에서 빼고 이따금씩만 섞는다.
      // 끝없이 흘려보내면 뚫을 수 없는 벽이 된다.
      const wall = spec.boss || ab.armor || ab.kbImmune;
      (wall ? heavy : pool).push(w.e);
    });
    this.reinfPool = pool.length ? pool : ['orcspear'];
    this.reinfHeavy = heavy;
    this.reinfWave = 0;
    this.reinfT = REINFORCE_FIRST;
    this.reinfOn = false;

    this.roster = this.battleUnits();
    this.roster.forEach(u => { this.cooldowns[u.id] = 0; if(u.active) this.heroCooldowns[u.id] = R && R.heroStart ? 0 : 20; });   // 5.1 '전쟁 군기'는 바로
    // 4.4 각성 경계: 도전 전장은 편성한 3진 수만큼 적이 억세진다
    this.awakenN = (this.hard || this.event) ? this.roster.filter(u => u.evo2).length : 0;
    this.awakenMul = 1 + AWAKEN_TAX * this.awakenN;
    this.enemyMulBase *= this.awakenMul;
  }

  /* 해금된 병종 */
  unlockedUnits() {
    const owned = this.save.owned || {};
    return UNITS.filter(u =>
      rosterOpen(this.save, u) || (u.gacha && owned[u.id]));
  }

  /* 실제 출진 편성 (최대 LOADOUT_MAX) */
  battleUnits() {
    const unlocked = this.unlockedUnits();
    const picked = [...new Set(this.deckFixed || this.save.loadout || [])].filter(id => unlocked.some(u => u.id === id));   // 5.0 정벌은 출발할 때 묶인 편성
    const list = picked.length ? picked.map(id => UNIT_BY_ID[id]) : unlocked.slice(0, LOADOUT_MAX);
    // 전설·신화는 앞에서부터 HERO_SLOT_MAX 명까지만 데려간다
    let heroes = 0;
    return list.filter(u => !isHeroUnit(u) || ++heroes <= HERO_SLOT_MAX).slice(0, LOADOUT_MAX)
      .map(u => this.stats(u.id));
  }

  /* 레벨·진화를 반영한 이 판의 병종 스탯 */
  stats(id) {
    // 3.14: 전투 중엔 레벨·진화가 바뀌지 않는다. 예전엔 HUD·출진 판정이 매 프레임 카드마다 스탯을 새로 만들었다(쓰레기·발열)
    const c = this._stats || (this._stats = {});
    if (c[id]) return c[id];
    let st = unitFor(this.save, id);
    // 5.0 정벌: 보급 마차(비용) · 활시위(사거리) — 공용 스탯을 건드리지 않게 복사본에
    if (st && this.run && (this.run.cost !== 1 || this.run.range)) {
      st = Object.assign({}, st, { cost: Math.round(st.cost * this.run.cost) });
      if (st.ranged && this.run.range) st.range += this.run.range;
    }
    return (c[id] = st);
  }

  /* 3.5: 전장 병력 상한. 오래 끄는 싸움(무한 전장 등)에서 병력이 100명 넘게 쌓여
   * 기기가 버거워했다. 직접 낸 병사 FIELD_CAP, 소환물까지 합쳐 FIELD_TOTAL_CAP. */
  fieldCount() { let n = 0; for (const a of this.allies) if (!a.dead && !a.summoned) n++; return n; }
  fieldFull() { return this.fieldCount() >= FIELD_CAP; }
  roomForSummon() { return this.allies.length < FIELD_TOTAL_CAP; }
  /* 4.2: 직접 낸 병사가 들어올 때 소환물까지 합쳐 FIELD_TOTAL_CAP 이면 가장 오래 선 소환물(해골·방벽 등)이
   * 연기로 자리를 비켜 준다. 전엔 소환물이 먼저 60까지 차오른 뒤 직접 낸 병사가 40까지 더 들어와
   * 77명까지 쌓였다(발열). 출진 자체는 막지 않는다. */
  makeRoom() {
    let alive = 0, oldest = null;
    for (const a of this.allies) {
      if (a.dead) continue;
      alive++;
      if (a.summoned && (!oldest || a.age > oldest.age)) oldest = a;
    }
    if (alive >= FIELD_TOTAL_CAP && oldest) { oldest.dead = true; oldest.vanish = true; }
  }

  canDeploy(id) {
    const u = this.stats(id);
    return !!u && this.state === 'play' && this.roster.some(r => r.id === id) && !this.fieldFull() &&
      this.cooldowns[id] <= 0 && this.money >= u.cost && !(this.sealed[id] > 0) &&
      (!u.maxActive || this.activeCount(id) < u.maxActive);
  }
  // 4.2: HUD 가 매 프레임 카드마다 부른다 — 배열을 새로 만들지 않고 센다
  activeCount(id) { let n = 0; for (const a of this.allies) if (!a.dead && a.s.id === id) n++; return n; }

  /* 3.12: 자동 출진이 낼 만한가. 제한 없는 값싼 병종은 예전 상한(stackCap)까지만 자동으로 낸다 —
   * 끝없이 사들이면 돈이 바닥나 비싼 주력을 영영 못 낸다. 손으로 누르면 공통 상한까지 얼마든지. */
  autoWants(id) {
    if (!this.canDeploy(id)) return false;
    const u = this.stats(id);
    if (!u.noStackCap) return true;
    let n = 0;
    for (const a of this.allies) if (!a.dead && a.s.id === id) n++;
    return n < stackCap(u.cost);
  }

  /* owner 가 있으면 소환물이다. 소환한 병종 레벨의 절반만큼 자란다. */
  makeAlly(u, x, owner) {
    let st, lm;
    if (owner) {
      const lv = (owner.s && owner.s.level) || 1;
      st = resolveUnit(u.base || u, 1, false);
      lm = 1 + UNIT_LEVEL_GAIN * 0.35 * (lv - 1);
    } else {
      st = u.base ? u : this.stats(u.id);
      lm = unitLevelMul(st.level || this.levels[u.id] || 1);
    }
    const buff = { hp: this.buff.hp * lm, atk: this.buff.atk * lm };
    if (this.run && !owner) {    // 5.0 정벌: 근접 · 원거리 · 영웅 · 값싼 병종 축복
      const R = this.run, melee = !st.ranged, cheap = st.cost <= 150;
      buff.hp *= (melee ? R.meleeHp : 1) * (cheap ? R.cheapHp : 1);
      buff.atk *= (melee ? R.meleeAtk : R.rangedAtk) * (isHeroUnit(st) ? R.heroAtk : 1) * (cheap ? R.cheapAtk : 1);
    }
    const f = new Fighter(st, 'ally', x, buff);
    if (owner && owner.s) f.creditTo = owner.creditTo || owner.s.id;
    if (this.mods && this.mods.curse) f.healMul = CURSE_HEAL;
    return f;
  }

  /* 3.15 전투 기록: 소환물(해골·분신·포탑)이 넣은 딜은 부른 병종의 몫으로 센다 */
  meterRow(f) {
    const id = f.creditTo || f.s.id;
    return this.meter[id] || (this.meter[id] = { dmg: 0, taken: 0, n: 0 });
  }

  deploy(id) {
    if (!this.canDeploy(id)) return false;
    const u = this.stats(id);
    this.money -= u.cost;
    this.cooldowns[id] = u.cooldown * this.cdMul;
    const f = this.makeAlly(u, ALLY_SPAWN_X + Math.random() * 40);
    this.meterRow(f).n++;
    f.giveBarrier(25 * Math.min(5, this.save.upgrades.deployment || 0) + (this.run ? this.run.barrier : 0));
    // 안개 속으로 들어온 병사는 백작에게 홀린다 (안개가 걷힌 뒤에 내보내야 한다)
    const vb = this.veiledBoss();
    if (vb && vb.s.special && vb.s.special.charm !== undefined) {
      f.charmT = vb.s.special.charm;
      this.fx.push({ type: 'charm', x: f.x, row: f.row, t: 0.7, life: 0.7 });
    }
    this.makeRoom();
    this.allies.push(f);
    // 3.5: 모습이 통째로 바뀐 진화 병종·영웅은 빛기둥과 함께 내려선다
    const grand = !!(f.s.bigEvo || f.s.gacha);
    if (f.s.arrive) this.x3Arrive(f);                 // 4.3 3진은 저마다의 방식으로 등장한다
    else this.fx.push({ type: 'spawn', x: f.x, row: f.row, t: grand ? 0.75 : 0.4, life: grand ? 0.75 : 0.4, grand: grand, color: f.s.accent });
    sfx('deploy');
    return true;
  }

  /* ---- 4.3 3진 여섯의 전용 연출 ----
   * 전차는 흙먼지를 일으키며 들어오고, 거대 로봇은 쿵 내려앉고, 비행접시는 빛을 타고 내려온다.
   * 연출은 모두 'x3' 효과 하나로 모아 그린다 (밝은 부분은 WebGL, 어두운 연기·흙은 Canvas). */
  x3Live() {
    let n = 0;
    for (const e of this.fx) if (e.type === 'x3') n++;
    return n;
  }
  x3Arrive(f) {
    const sub = f.s.arrive;
    this.fx.push({ type: 'x3', kind: 'arrive', sub: sub, x: f.x, row: f.row, dir: f.dir, scale: f.scale,
                   color: f.s.accent, t: 1.1, life: 1.1 });
    if (sub === 'robot') { this.shake = Math.max(this.shake, 8); sfx('boom'); }
    else if (sub === 'tank' || sub === 'dozer') { this.shake = Math.max(this.shake, 4); if (sub === 'dozer') sfx('dozer'); }
    else if (sub === 'siren') sfx('siren');
    else if (sub === 'saber') sfx('saber');
    else if (sub === 'rail') sfx('rail');
    else if (sub === 'snow') sfx('freeze');
    // 4.7 소환 영웅의 3진
    else if (sub === 'cloudjet' || sub === 'jetdive') sfx('jet');
    else if (sub === 'orbit') sfx('solar');
    else if (sub === 'bike') { this.shake = Math.max(this.shake, 5); sfx('thunder'); }
    else if (sub === 'holo') sfx('holo');
    else if (sub === 'moon') sfx('laser');
    else if (sub === 'dragon') { this.shake = Math.max(this.shake, 5); sfx('saber'); }   // 4.15 청룡 군신
    else if (sub === 'ninetail') sfx('holo');                                            // 4.25 천호 여제
    else if (sub === 'forge') { this.shake = Math.max(this.shake, 7); sfx('boom'); }      // 4.25 태엽 신공방
    else if (sub === 'stormcloud') { this.shake = Math.max(this.shake, 6); sfx('thunder'); }   // 4.25 천총운 폭풍신
    else if (sub === 'stargate') { this.shake = Math.max(this.shake, 4); sfx('holo'); }   // 4.18 별의 대현자
    else if (sub === 'hoverdrop') { this.shake = Math.max(this.shake, 8); sfx('boom'); }   // 4.18 플라즈마 기동전차
    else if (sub === 'bifrost') { this.shake = Math.max(this.shake, 5); sfx('solar'); }     // 5.2 슬레이프니르 기수
    else if (sub === 'lamp') { this.shake = Math.max(this.shake, 5); sfx('holo'); }         // 5.2 마신왕 지니
    else if (sub === 'bagua') sfx('holo');                                                   // 5.2 팔진도 와룡
    else if (sub === 'wisp') { this.shake = Math.max(this.shake, 4); sfx('boom'); }          // 5.2 도깨비 대왕
    else if (sub === 'snakes') sfx('freeze');                                                // 5.2 석화의 여제
    else if (sub === 'gatling') { this.shake = Math.max(this.shake, 3); sfx('cannon'); }     // 5.2 개틀링 사수
    else if (sub === 'worldtree') { this.shake = Math.max(this.shake, 6); sfx('holo'); }    // 5.2 세계수의 만물부
    if (sub === 'jetdive' || sub === 'cloudjet') this.shake = Math.max(this.shake, 4);
  }
  /* 공격하는 순간: 전차 포구의 섬광·연기 고리, 비행접시가 내리쏘는 광선 */
  x3AttackFx(f, target) {
    const kind = f.s.atkFx, sc = f.scale || 1;
    if (kind === 'muzzle') sfx('cannon');
    else if (kind === 'ufobeam') sfx('zap');
    else if (kind === 'railflash') sfx('rail');
    else if (kind === 'solarray') sfx('solar');
    else if (kind === 'moonflash') sfx('laser');
    else if (kind === 'starsigil') sfx('holo');
    else if (kind === 'plasmamuzzle') sfx('rail');
    else if (kind === 'yggsigil') sfx('holo');
    else if (kind === 'gatling') sfx('arrow');
    if (this.x3Live() >= X3_FX_LIMIT) return;
    if (kind === 'solarray') {                          // 4.7 태양 위성: 하늘에서 과녁으로 내리꽂는 빛기둥 (과녁 자리)
      const tx = target && target.x !== undefined ? target.x : f.x + f.dir * f.attackRange;
      this.fx.push({ type: 'x3', kind: 'solarray', x: tx, row: target && target.row !== undefined ? target.row : f.row, r: f.s.areaRadius || 90,
                     dir: f.dir, scale: sc, color: f.s.accent, t: 0.6, life: 0.6 });
      return;
    }
    if (kind === 'starsigil') {                         // 4.18 별의 대현자: 발밑 마법진 · 지팡이 끝 별 문양 (몸 단위)
      this.fx.push({ type: 'x3', kind: 'starsigil', x: f.x, ox: 6 * sc, h: 66 * sc, row: f.row, dir: f.dir, scale: sc, color: f.s.accent, t: 0.7, life: 0.7 });
      return;
    }
    if (kind === 'gatling') {                           // 5.2 개틀링: 총구 섬광 · 튀는 탄피 (몸 단위)
      this.fx.push({ type: 'x3', kind: 'gatling', x: f.x, ox: 44 * sc, h: 34 * sc, row: f.row, dir: f.dir, scale: sc, t: 0.5, life: 0.5 });
      return;
    }
    if (kind === 'yggsigil') {                          // 5.2 세계수의 만물부: 발밑 룬 고리 · 궁니르 끝 빛살 (몸 단위)
      this.fx.push({ type: 'x3', kind: 'yggsigil', x: f.x, ox: 62 * sc, h: 46 * sc, row: f.row, dir: f.dir, scale: sc, color: f.s.accent, t: 0.7, life: 0.7 });
      return;
    }
    if (kind === 'plasmamuzzle') {                      // 4.18 플라즈마 포: 포구 앞에 모였다 터지는 푸른 고리 (몸 단위)
      this.fx.push({ type: 'x3', kind: 'plasmamuzzle', x: f.x, ox: 76 * sc, h: 44 * sc, row: f.row, dir: f.dir, scale: sc, color: f.s.accent, t: 0.55, life: 0.55 });
      return;
    }
    if (kind === 'moonflash') {                         // 4.7 레이저 활: 시위 자리의 초승달 섬광 (몸 단위)
      this.fx.push({ type: 'x3', kind: 'moonflash', x: f.x, ox: 22 * sc, h: 38 * sc, row: f.row, dir: f.dir, scale: sc,
                     color: f.s.accent, t: 0.4, life: 0.4 });
      return;
    }
    if (kind === 'railflash') {                         // 4.4 레일건 총구: 푸른 고리 · 빛줄기 (몸 단위)
      this.fx.push({ type: 'x3', kind: 'railflash', x: f.x, ox: 80 * sc, h: 34 * sc, row: f.row, dir: f.dir, scale: sc,
                     color: f.s.accent, t: 0.6, life: 0.6 });
    } else if (kind === 'muzzle') {
      // 포구 자리는 몸 단위(ox·h)로 넘긴다: 화면 확대와 몸 크기는 따로 움직인다
      this.fx.push({ type: 'x3', kind: 'muzzle', x: f.x, ox: 71 * sc, h: 38 * sc, row: f.row, dir: f.dir, scale: sc,
                     t: 0.9, life: 0.9 });
    } else if (kind === 'ufobeam') {
      const tx = target && target.x !== undefined ? target.x : f.x + f.dir * f.attackRange;
      this.fx.push({ type: 'x3', kind: 'ufobeam', x: f.x, x2: tx, row: f.row, row2: target && target.row !== undefined ? target.row : f.row,
                     h: 30 * sc, dir: f.dir, scale: sc, color: f.s.accent, t: 0.55, life: 0.55 });
    }
  }
  /* 맞는 자리: 포탄은 흙기둥과 검은 연기, 로켓 주먹은 땅이 갈라지는 충격 */
  x3Impact(f, kind, x, row) {
    if (kind === 'shellblast') { this.shake = Math.max(this.shake, 5); sfx('boom'); }
    else if (kind === 'rocketpunch') { this.shake = Math.max(this.shake, 6); sfx('rocket'); }
    else if (kind === 'drillspark') sfx('drill');
    else if (kind === 'dronestrike') sfx('drone');
    else if (kind === 'dozerpush') { this.shake = Math.max(this.shake, 3); sfx('dozer'); }
    else if (kind === 'snowburst') sfx('freeze');
    else if (kind === 'sabercut') sfx('saber');
    else if (kind === 'mechstaff') { this.shake = Math.max(this.shake, 5); sfx('rocket'); }
    else if (kind === 'boltstrike') { this.shake = Math.max(this.shake, 5); sfx('thunder'); }
    else if (kind === 'divestrike') { this.shake = Math.max(this.shake, 3); sfx('jet'); }
    else if (kind === 'holoburst') sfx('holo');
    else if (kind === 'dragonslash') { this.shake = Math.max(this.shake, 3); sfx('saber'); }
    else if (kind === 'foxstorm') sfx('holo');                                           // 4.25
    else if (kind === 'teslacoil') { this.shake = Math.max(this.shake, 2); sfx('zap'); }
    else if (kind === 'kusanagi') { this.shake = Math.max(this.shake, 4); sfx('thunder'); }
    else if (kind === 'starfall') { this.shake = Math.max(this.shake, 3); sfx('zap'); }
    else if (kind === 'plasmablast') { this.shake = Math.max(this.shake, 6); sfx('boom'); }
    else if (kind === 'gungnir') { this.shake = Math.max(this.shake, 2); sfx('rail'); }      // 5.2
    else if (kind === 'djinnblast') { this.shake = Math.max(this.shake, 2); sfx('holo'); }
    else if (kind === 'bagua') sfx('holo');
    else if (kind === 'goldbat') { this.shake = Math.max(this.shake, 4); sfx('boom'); }
    else if (kind === 'petrify') sfx('freeze');
    else if (kind === 'yggdrasil') { this.shake = Math.max(this.shake, 3); sfx('holo'); }
    const ground = X3_GROUND[kind];
    if (!ground) return;
    if (this.x3Live() >= X3_FX_LIMIT) return;
    this.fx.push({ type: 'x3', kind: ground, x: x, row: row || 0, r: f.s.areaRadius || 70, dir: f.dir, scale: f.scale || 1,
                   color: f.s.accent, t: kind === 'dronestrike' ? 0.8 : 1.2, life: kind === 'dronestrike' ? 0.8 : 1.2 });
  }
  /* 구급 마차: 사이렌이 울리면 빨강·파랑 고리가 퍼지고, 나은 아군 머리 위로 붉은 십자가 떠오른다 */
  x3Siren(f, radius, healed) {
    if (healed.length) sfx('siren');
    if (this.x3Live() >= X3_FX_LIMIT) return;
    this.fx.push({ type: 'x3', kind: 'siren', x: f.x, row: f.row, r: radius, scale: f.scale || 1, t: 0.9, life: 0.9 });
    for (let i = 0; i < healed.length && i < 5; i++) {
      const m = healed[i];
      this.fx.push({ type: 'x3', kind: 'medic', x: m.x, row: m.row, scale: m.scale || 1, t: 0.9 + i * 0.06, life: 0.9 + i * 0.06 });
    }
  }

  /* 왕의 명령: 전군 회복 + 가속 */
  heroCaster(id) {
    return this.allies.find(f=>!f.dead && !f.summoned && f.s.id===id) || null;
  }
  heroTarget(f) {
    let best = null, bd = f.attackRange + 180;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.abs(e.x - f.x);
      if (d < bd || (d === bd && !best)) { best = e; bd = d; }
    }
    return best;
  }
  canHeroActive(id) {
    const f=this.heroCaster(id), u=this.stats(id);
    return !!(this.state==='play' && u && u.active && this.roster.some(r=>r.id===id) && f &&
      f.stunT<=0 && f.kbTimer<=0 && (this.heroCooldowns[id]||0)<=0 && this.heroGlobalCd<=0 &&
      (u.active.barrier || u.active.haste || this.heroTarget(f)));
  }
  /* 3.14: 자동 출진이 필살도 쓸 때 — 안개(흡수)·반사 결계·핵이 닫힌 보스 앞에선 아낀다 */
  autoActiveOk(id) {
    if (!this.canHeroActive(id)) return false;
    const u = this.stats(id);
    if (u.active.barrier || u.active.haste) return true;
    if (this.reflectingBoss()) return false;
    // 핵이 닫힌 보스: 피해가 절반만 들어가니 드러난 뒤로 아낀다
    for (const e of this.enemies) if (!e.dead && e.boss && e.ab.core && !(e.exposedT > 0)) return false;
    return true;
  }
  useHeroActive(id) {
    if(!this.canHeroActive(id)) return false;
    const f=this.heroCaster(id), a=f.s.active, buff=a.barrier||a.haste, target=buff?f:this.heroTarget(f);
    // 3.13: 영웅끼리 묶인 공용 대기(6초)를 없앴다 — 각자 자기 재사용 대기만 본다. 여럿을 한꺼번에 써도 된다
    this.heroCooldowns[id]=a.cd*(this.run?this.run.heroCd:1); this.heroGlobalCd=HERO_SHARED_CD;
    if(buff) {
      for(const m of this.allies) if(!m.dead && Math.abs(m.x-f.x)<=a.radius) {
        if(a.barrier){m.giveBarrier(a.barrier*f.abMul);m.poisonT=0;m.poisonDps=0;m.burnT=0;m.burnDps=0;}
        if(a.haste){m.hasteMul=m.hasteT>0?Math.min(m.hasteMul,a.haste.mul):a.haste.mul;m.hasteT=Math.max(m.hasteT,a.haste.dur);m.stunT=0;}
      }
    } else if (this.reflectingBoss() && Math.abs(this.reflectingBoss().x - target.x) <= 450) {
      // 공허 반사: 결계 곁에 쓴 액티브는 시전자에게 돌아온다
      const rb = this.reflectingBoss();
      f.takeDamage(f.atk * a.mul * (rb.reflectRatio || 0.85));
      this.announce('공허가 기술을 되돌렸다', 1.6);
      this.fx.push({ type: 'mirror', x: rb.x, x2: f.x, row: rb.row, row2: f.row, t: 0.4, life: 0.4 });
    } else {
      this._chaining = true;          // 액티브의 광역 타격이 대상마다 연쇄를 다시 일으키지 않게
      for(const e of this.enemies) if(!e.dead && Math.abs(e.x-target.x)<=a.radius) {
        this.hitOne(f.atk*a.mul,e,f,false);
        if(!e.dead) {
          if(a.slow)e.slowT=Math.max(e.slowT,a.slow);
          if(a.stun)e.stun(a.stun);
          if(a.charm&&!e.boss){e.charmT=Math.max(e.charmT,a.charm*(1-(e.ab.charmResist||0)));this.fx.push({type:'charm',x:e.x,row:e.row,t:.7,life:.7});}
          if(a.execute)this.tryExecute(e,a.execute);
          if(a.push&&!e.ab.kbImmune&&!e.dead){e.x+=f.dir*a.push*(e.boss?BOSS_PUSH_TAKEN:1);this.holdLine(e);e.kbTimer=Math.max(e.kbTimer,.3);}
          if(a.burn){e.dotBy=f.creditTo||f.s.id;if(e.burnT<=0)e.burnDps=0;e.burnT=Math.max(e.burnT,a.burn);e.burnDps=Math.max(e.burnDps,24*f.abMul);}
          // 혼천릉: 붉은 비단으로 묶어 한곳에 끌어모은다 (보스·넉백 면역은 버틴다)
          if(a.pull&&!e.dead&&!e.ab.kbImmune&&!e.boss){const dx=target.x-e.x;e.x+=Math.sign(dx)*Math.min(Math.abs(dx),a.pull);e.kbTimer=Math.max(e.kbTimer,.2);}
        }
      }
      this._chaining = false;
      // 4.18 별의 심판: 적을 치고, 시전자 둘레 아군에게 보호막과 가속을 건다 (돕는 법사이자 딜러)
      if (a.ally) {
        for (const m of this.allies) if (!m.dead && Math.abs(m.x - f.x) <= a.ally.radius) {
          if (a.ally.barrier) m.giveBarrier(a.ally.barrier * f.abMul);
          if (a.ally.haste) { m.hasteMul = m.hasteT > 0 ? Math.min(m.hasteMul, a.ally.haste.mul) : a.ally.haste.mul; m.hasteT = Math.max(m.hasteT, a.ally.haste.dur); }
          if (a.ally.cleanse) { m.poisonT = 0; m.poisonDps = 0; m.burnT = 0; m.burnDps = 0; m.slowT = 0; }   // 5.2 세계수의 심판
        }
        this.fx.push({ type: 'aura', x: f.x, row: f.row, r: a.ally.radius, t: 0.8, life: 0.8, color: f.s.accent });
      }
      // 5.2 세 가지 소원: 군자금도 하나의 소원
      if (a.gold) {
        this.money = Math.min(this.walletMax, this.money + a.gold);
        this.fx.push({ type: 'coin', x: f.x, row: f.row, v: a.gold, t: 0.9, life: 0.9 });
      }
      // 여의봉 강타: 분신이 곧바로 튀어나온다
      if (a.clones && f.ab.summon) {
        const u = UNIT_BY_ID[f.ab.summon.id];
        for (let k = 0; u && k < a.clones && this.roomForSummon(); k++) {
          const m = this.makeAlly(u, f.x + f.dir * (30 + k * 24), f);
          m.summoned = true; m.summonedBy = f; m.lifeT = f.ab.summon.life || 8;
          this.allies.push(m);
          this.fx.push({ type: 'spawn', x: m.x, row: m.row, t: 0.4, life: 0.4 });
        }
      }
    }
    this.fx.push({type:'mythic',kind:a.kind,x:target.x,row:target.row,r:a.radius,color:f.s.accent,t:1.15,life:1.15});
    // 3.14: 시전자 머리 위에 기술 이름, 발밑에 빛 고리 — 여럿을 한꺼번에 써도 누가 무엇을 썼는지 보이게
    let stack=0; for(const e of this.fx) if(e.type==='herocall'&&e.t>0.5&&Math.abs(e.x-f.x)<160) stack++;   // 붙어 서서 함께 쓰면 이름을 층층이
    this.fx.push({type:'herocall',name:a.name,x:f.x,row:f.row,color:f.s.accent,scale:f.s.scale||1,stack:stack,t:1.1,life:1.1});
    this.shake=Math.max(this.shake,5);f.swing=.22;
    return true;
  }

  canCommand() { return this.state === 'play' && this.cmdCd <= 0 && this.allies.length > 0; }

  useCommand() {
    if (!this.canCommand()) return false;
    this.cmdCd = this.cmdMax;
    this.cmdUses++;
    // 공허 반사 중에는 왕명마저 삼켜진다
    if (this.reflectingBoss()) {
      this.announce('공허가 왕명을 삼켰다', 1.8);
      sfx('command');
      return true;
    }
    for (const a of this.allies) {
      a.heal(a.maxHp * this.cmdHeal);
      a.hasteT = Math.max(a.hasteT, COMMAND.hasteDur);
      a.hasteMul = COMMAND.hasteMul;
      a.stunT = 0;
      a.slowT = 0;
      this.fx.push({ type: 'rally', x: a.x, row: a.row, t: 0.6, life: 0.6 });
    }
    this.shake = Math.max(this.shake, 9);
    this.fx.push({ type: 'banner', x: this.frontline(), row: 0, t: 1.2, life: 1.2 });
    sfx('command');
    return true;
  }

  update(dtRaw) {
    if (this.state !== 'play') { this.updateFx(dtRaw); return; }
    let remaining = Math.max(0, Math.min(0.1, dtRaw)) * this.speed;
    while (remaining > 1e-8 && this.state === 'play') {
      const step = Math.min(1 / 30, remaining);
      this.tick(step);
      remaining -= step;
    }
    this.updateFx(dtRaw);
  }

  tick(dt) {
    this.time += dt;
    // 5.0 정벌 축성술: 성채가 조금씩 스스로 고쳐진다
    if (this.run && this.run.regen && !this.allyCastle.dead) { const c = this.allyCastle; c.hp = Math.min(c.maxHp, c.hp + c.maxHp * this.run.regen * dt); }
    // 4.15 7막 모래폭풍: every 초마다 dur 초 동안 모래가 불어 원거리 사거리가 줄어든다 (양쪽 모두). 2초 전에 알린다.
    const sto = this.stage.storm;
    if (sto) {
      const ph = this.time - sto.first, k = ph >= 0 ? ph % sto.every : -1;
      const was = this.storming;
      this.storming = k >= 0 && k < sto.dur;
      if (this.storming && !was) { this.announce('모래폭풍! 원거리 사거리가 줄어듭니다', 2.2); sfx('siren'); }
      const soon = ph >= -2 && (ph < 0 ? true : sto.every - k <= 2);
      if (soon && !this.storming && !this.stormWarned) { this.stormWarned = true; this.announce('모래폭풍이 다가옵니다', 1.6); }
      if (this.storming) this.stormWarned = false;
    }

    // 5.3 9막 '불의 산맥': first 초부터 every 초마다 땅이 갈라져 용암이 솟는다 — 예고 뒤 양쪽 병사 모두에게 최대 체력 비율 피해 (용암 군단은 멀쩡하다)
    const vol = this.stage.volcano;
    if (vol && this.time >= vol.first + this.eruptN * vol.every) { this.eruptN++; this.erupt(vol); }
    if (this.twinWait.length) this.twinTick(dt);

    // 4.15 도전 '파라오의 모래시계': 제한 시간 · 모래시계 토템
    if (this.stage.hourglass) this.hourglassTick(this.stage.hourglass, dt);

    // 전투가 길어지면 자금이 더 빨리 찬다. 적도 증원으로 계속 불어나므로
    // 이쪽 보급이 더 가파르게 올라야 교착이 풀린다.
    const ramp = 1 + Math.min(1.4, Math.max(0, (this.time - 60) / 180) * 1.4);
    this.money = Math.min(this.walletMax, this.money + this.income * ramp * dt);
    for(const id in this.heroCooldowns)this.heroCooldowns[id]=Math.max(0,this.heroCooldowns[id]-dt);
    this.heroGlobalCd=Math.max(0,this.heroGlobalCd-dt);
    if (this.cmdCd > 0) this.cmdCd = Math.max(0, this.cmdCd - dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.4);
    if (this.bossAlert > 0) this.bossAlert -= dt;
    if (this.patternT > 0) this.patternT -= dt;
    this.updatePending(dt);
    coolCastle(this.allyCastle, dt);
    coolCastle(this.enemyCastle, dt);
    // 시간 주술사가 하나라도 살아 있으면 카드가 느리게 찬다
    this.chronoOn = false;
    for (const e of this.enemies) if (!e.dead && e.ab.chrono) { this.chronoOn = true; break; }
    const cdStep = dt * (this.chronoOn ? CHRONO_RATE : 1);
    for (const k in this.cooldowns) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - cdStep);
    }
    for (const k in this.sealed) if (this.sealed[k] > 0) this.sealed[k] = Math.max(0, this.sealed[k] - dt);

    // 보스의 결계: 보스를 쓰러뜨릴 때까지 요새는 끝까지 무너지지 않는다.
    // 보스가 나오기 전에 요새를 결계까지 깎으면 보스가 먼저 뛰쳐나온다.
    if (this.bossWard) {
      this.enemyCastle.floor = this.bossDown ? 0 : this.enemyCastle.maxHp * WARD_FLOOR;
      if (!this.bossSpawned && this.wardUp()) this.callBoss();
    }
    while (this.qi < this.queue.length && this.queue[this.qi].t <= this.time) {
      const entry = this.queue[this.qi];
      this.spawnEnemy(entry.e, undefined, entry.mul).wave = entry.wave;
      this.qi++;
    }
    // 3.7 금화 원정: 웨이브가 다 나오고 황금 수레가 다 지나갈 때까지 요새는 결계로 버틴다
    // (요새부터 부숴 수레를 건너뛰지 못하게). 요새를 결계까지 깎고 전장이 비면 다음 웨이브를 당겨 온다.
    if (this.expedition) {
      const pending = this.qi < this.queue.length;
      let cart = false, alive = 0;
      for (const e of this.enemies) if (!e.dead) { alive++; if (e.ab.flee) cart = true; }
      this.expWard = pending || cart;
      const floor = this.expWard ? this.enemyCastle.maxHp * WARD_FLOOR : 0;
      if (!this.bossWard || this.bossDown) this.enemyCastle.floor = floor;
      else this.enemyCastle.floor = Math.max(this.enemyCastle.floor, floor);
      if (pending && !alive && this.enemyCastle.hp <= this.enemyCastle.maxHp * (WARD_FLOOR + 0.001)) {
        const lead = this.queue[this.qi].t - this.time;
        if (lead > 0) for (let i = this.qi; i < this.queue.length; i++) this.queue[i].t -= lead;
      }
    }
    if (this.stage.infinite) this.extendEndless();
    // 4.16 무한 전장의 요새는 끝까지 결계로 버틴다 — 정말로 끝이 없다
    if (this.endless) this.enemyCastle.floor = this.enemyCastle.maxHp * WARD_FLOOR;
    this.tickReinforce(dt);
    this.checkEnrage();
    if (!this.endless && !this.fury && !this.overtimeSaid && this.time > OVERTIME_T) {
      this.overtimeSaid = true;
      this.announce('장기전 · 적이 점점 억세집니다', 2.6);
    }

    this.updateCover(dt);
    // 4.22: 수호 토템이 서 있을 때만 원거리 병사가 토템을 먼저 찾는다 (없으면 병사마다 적을 한 번 더 훑지 않는다)
    this.totemUp = false;
    for (const e of this.enemies) if (e.guardOf && !e.dead) { this.totemUp = true; break; }
    this.step(this.allies, this.enemies, this.enemyCastle, dt, true);
    this.step(this.enemies, this.allies, this.allyCastle, dt, false);
    if (this.burrowers.length) this.stepBurrowers(dt);
    if (this.stage.sally && !this.endless) this.checkSally();

    this.updateShots(dt);
    // 사망 폭발이 연쇄를 멈출 때까지 양쪽을 정리한다. 보상은 한 번만 준다.
    // 매 판정마다 배열을 새로 합치면 틱마다 쓰레기가 쌓이므로 그냥 훑는다.
    while (this.hasUnreaped()) {
      this.reap(this.enemies, this.allies, this.allyCastle, true);
      this.reap(this.allies, this.enemies, this.enemyCastle, false);
    }
    // 3.10: 아무도 안 쓰러진 틱(대부분)에는 배열을 새로 만들지 않는다 (틱마다 쓰레기 두 개)
    if (anyDead(this.enemies)) this.enemies = this.enemies.filter(e => !e.dead);
    if (anyDead(this.allies)) this.allies = this.allies.filter(a => !a.dead);

    // 무한 전장도 적 요새를 무너뜨리면 끝난다 (요새 함락 · 웨이브 보상에 덤)
    if (this.enemyCastle.dead) { this.shake = 16; this.finish('win'); }
    else if (this.allyCastle.dead && this.run && this.run.phoenix > 0 && !this.phoenixUsed) {
      // 5.0 불사조 깃털: 한 번 되살아난다 (원정에서 쓰면 사라진다)
      this.phoenixUsed = true; this.allyCastle.dead = false; this.allyCastle.hp = Math.round(this.allyCastle.maxHp * 0.5);
      this.shake = 12; this.flash = 0.6; this.flashColor = '#ffb347';
      this.fx.push({ type: 'aura', x: this.allyCastle.x, row: 1, r: 260, t: 1.2, life: 1.2, color: '#ffb347' });
      this.announce('불사조 깃털 · 성채가 되살아났다!', 2.6); sfx('win');
    }
    else if (this.allyCastle.dead) { this.shake = 16; this.finish(this.endless ? 'over' : 'lose'); }
    // 웨이브 수가 정해진 무한 전장(검사용)만 다 버티면 끝. 진짜 무한 전장은 성채가 무너질 때까지.
    else if (this.endless && !this.stage.infinite && this.qi >= this.queue.length && this.enemies.length === 0) {
      this.finish('over');
    }
  }

  /* 원거리 엄호: 가장 앞에 선 근접 아군(방벽 포함, 소환물·싸우지 않는 지원병 제외).
   * 그보다 앞에 나선 원거리 병사는 엄호가 없다 (exposed). */
  updateCover(dt = 0) {
    let front = -Infinity;
    // 3.9 선봉: 살아 있는 근접 영웅 (곁의 아군이 받는 피해를 줄인다)
    const vg = this.vanguards || (this.vanguards = []);
    vg.length = 0;
    let line = -Infinity;            // 영웅이 아닌 근접 전열의 맨 앞 (선봉이 너무 앞서 나가지 않게)
    for (const a of this.allies) {
      if (a.dead) continue;
      if (a.ab.vanguard) { vg.push(a); continue; }
      if (!a.s.ranged && !a.ab.noAttack && !a.summoned && a.x > line) line = a.x;
    }
    this.lineFront = line;
    for (const a of this.allies) {
      // 불려 나온 해골·미라·분신은 엄호가 못 된다 (방벽은 된다). 직접 내보낸 근접 병사만.
      if (a.dead || a.s.ranged || (a.ab.noAttack && !a.ab.kbImmune) || (a.summoned && !a.ab.hold)) continue;
      if (a.x > front) front = a.x;
    }
    this.allyFront = front;
    // 전열이 통째로 비었을 때: 잠깐은 봐 주고(다음 근접이 오는 중), 오래 비어 있으면 엄호 없음
    this.bareT = front > -Infinity ? 0 : (this.bareT || 0) + dt;
    const graced = front === -Infinity && this.bareT < COVER_GRACE;
    // 막아 서는 병사가 없으면 적이 돌격해 들어온다 (원거리만으로 멀찍이 쏘기만 하는 것을 막는다)
    this.rush = front === -Infinity && !graced ? RUSH_MUL : 1;
    let bare = 0;
    for (const a of this.allies) {
      a.exposed = !graced && !!a.s.ranged && !a.dead && a.x > front + COVER_SLACK;
      if (a.exposed) bare++;
      // 불려 나온 해골·미라도 살아 있는 근접 전열 없이 싸우면 흐트러진다 (원거리 소환사만 몰아 넣는 편성)
      else if (a.summoned && !a.ab.hold && front === -Infinity && !graced) a.exposed = true;
    }
    // 처음으로 원거리 셋 이상이 엄호 없이 서면 한 번 알려 준다
    if (bare >= 3 && !this.coverWarned) { this.coverWarned = true; this.announce('엄호 없음 · 원거리 병사 앞에 근접 병사를 세우세요', 2.6); }
  }

  /* 3.2: 안개화·반사 결계 중인 보스 (없으면 null) */
  veiledBoss() { for (const e of this.enemies) if (e.boss && !e.dead && e.veilT > 0) return e; return null; }
  reflectingBoss() { for (const e of this.enemies) if (e.boss && !e.dead && e.reflectT > 0) return e; return null; }

  /* 보스 격노: 나온 지 오래된 캠페인 보스는 더 세고 빨라진다 (한 번만) */
  checkEnrage() {
    if (this.endless || !this.stage.bossId || this.bossDown) return;
    for (const e of this.enemies) {
      if (!e.boss || e.dead || e.furious || e.bornT === undefined || this.time - e.bornT < BOSS_ENRAGE_T) continue;
      e.furious = true;                            // 페이즈 광폭화(enraged)와 따로 센다
      e.atk = Math.round(e.atk * BOSS_ENRAGE.atk);
      e.baseAtk = Math.round(e.baseAtk * BOSS_ENRAGE.atk);
      e.speedMul *= BOSS_ENRAGE.speed;
      e.rateMul = (e.rateMul || 1) * BOSS_ENRAGE.rate;
      this.announce(e.s.name + ' 격노! 공격과 속도가 오릅니다', 2.6);
      this.shake = Math.max(this.shake, 12);
      this.fx.push({ type: 'cast', kind: 'shockwave', x: e.x, row: e.row, color: '#ff5a3c', r: 110, big: true, dir: -1, t: 0.6, life: 0.6 });
      sfx('bossIn');
    }
  }

  /* 보스를 앞당겨 부른다 (호위는 원래 오던 때에 온다) */
  callBoss() {
    const id = this.stage.bossId;
    let hit = null;
    for (let j = this.qi; j < this.queue.length; j++) if (this.queue[j].e === id) { hit = this.queue[j]; break; }
    if (!hit) { this.bossSpawned = true; return; }
    hit.t = this.time;
    const rest = this.queue.slice(this.qi).sort((a, b) => a.t - b.t);
    this.queue.length = this.qi;
    rest.forEach(q => this.queue.push(q));
    this.announce('보스가 요새에서 뛰쳐나온다!', 2.4);
    this.shake = Math.max(this.shake, 12);
  }

  /* 보스가 버티고 있어 요새가 무너지지 않는 중인가 (화면 표시용) */
  wardUp() { return (this.bossWard && !this.bossDown || (this.endless && this.enemyCastle.floor > 0) || this.expWard) && this.enemyCastle.hp <= this.enemyCastle.maxHp * (WARD_FLOOR + 0.001); }

  spawnEnemy(id, atX, mul) {
    const spec = ENEMIES[id];
    const st = Object.assign({ range: 60, speed: 40, interval: 1.2, kb: 1, scale: 1 }, spec);
    const mods = this.mods || {};
    if (mods.blitz) { st.speed *= 1.45; st.interval *= 0.83; }
    // 중갑: 방어 60%. 보스는 이제 반드시 쓰러뜨려야 하므로 30%까지만 두른다.
    if (mods.ironclad) st.ab = Object.assign({}, st.ab, { armor: Math.max(spec.boss ? 0.3 : 0.6, (st.ab && st.ab.armor) || 0) });
    // 하드코어: 모든 적이 기절에 30% 버틴다
    if (this.hard) st.ab = Object.assign({}, st.ab, { stunResist: Math.max(HARDCORE.stunResist, (st.ab && st.ab.stunResist) || 0),
                                                     charmResist: HARDCORE.charmResist || 0 });   // 4.25: 홀림도 버틴다 (홀림 편성이 하드코어 몇 곳을 통째로 쓸었다)
    // 전장 자체가 거느린 강화 배율(2막처럼 같은 적이 더 억센 곳)과
    // 증원 배율을 함께 얹는다.
    let total = this.enemyMulBase * (mul && mul > 1 ? mul : 1);
    // 격앙: 오래 끌수록 새로 나오는 적이 억세진다 (보스는 따로 격노한다)
    if (this.fury && !spec.boss) total *= 1 + Math.min(this.fury.max, this.fury.per30 * this.time / 30);
    else if (!this.endless && !spec.boss && this.time > OVERTIME_T) total *= 1 + OVERTIME_RATE * (this.time - OVERTIME_T) / 30;
    // 보스는 이제 반드시 쓰러뜨려야 하니, 전장 배율을 그대로 받으면 뒤쪽 보스가 끝없이 버틴다.
    // 배율을 누그러뜨려 받는다 (보스 자체 배율 BOSS_HP_MUL 은 따로 곱한다).
    if (spec.boss && this.stage.bossId && !this.endless && total > 1) total = Math.pow(total, BOSS_MUL_EXP);
    let buff = total > 1 ? { hp: total, atk: total } : null;
    // 4.16 무한 전장의 보스: 체력·공격을 기준값 쪽으로 당겨 맞춘 뒤 웨이브 배율을 곱한다
    if (this.endless && spec.boss) { const nb = endlessBossNorm(spec), m = Math.max(1, total); buff = { hp: m * nb.hp, atk: m * nb.atk }; }
    const f = new Fighter(st, 'enemy', atX !== undefined ? atX : ENEMY_SPAWN_X - Math.random() * 40, buff);
    f.gold = spec.gold || 0;
    f.kind = id;
    f.mul = mul;
    f.boss = !!spec.boss;
    if (f.boss) this.bossSpawned = true;
    if (mods.horde && !f.boss) { f.maxHp = Math.round(f.maxHp * 0.6); f.hp = f.maxHp; }
    // 캠페인의 보스는 전장에 하나뿐이라 훨씬 강하다 (무한 전장은 그대로)
    if (f.boss && this.stage.bossId && !this.endless) {
      f.maxHp = Math.round(f.maxHp * BOSS_HP_MUL); f.hp = f.maxHp;
      f.atk = Math.round(f.atk * BOSS_ATK_MUL);
      // 이벤트 보스는 따로 더 억세다 (전장마다 bossMul)
      const bm = this.stage.bossMul;
      if (bm) { f.maxHp = Math.round(f.maxHp * (bm.hp || 1)); f.hp = f.maxHp; f.atk = Math.round(f.atk * (bm.atk || 1)); }
      if (this.hard) { f.maxHp = Math.round(f.maxHp * HARDCORE.boss.hp * (this.stage.hardBoss || 1)); f.hp = f.maxHp; f.atk = Math.round(f.atk * HARDCORE.boss.atk); }
      f.baseAtk = f.atk;
    }
    // 5.0 정벌: 쇠약 · 역병 · 거울(모든 적) · 처형인(보스) — 보스의 정벌 덤 체력도 여기서
    if (this.run) {
      const R = this.run, bm = f.boss ? R.bossHp * (this.stage.conqBossHp || 1) : 1;
      f.maxHp = Math.max(1, Math.round(f.maxHp * R.enemyHp * bm)); f.hp = f.maxHp;
      f.atk = Math.round(f.atk * R.enemyAtk);
      if (f.baseAtk !== undefined) f.baseAtk = f.atk;
    }
    // 4.21 보스 각인: 하드코어 · 도전의 보스는 기술 둘을 더 쓴다 (5.0 정벌 보스도 — 막마다 각인 수가 다르다)
    if (f.boss && this.stage.bossId && !this.endless && (this.hard || this.event || this.stage.runAffix)) {
      const keys = bossAffixes(this.stage, this.stageIndex, this.hard);
      if (keys.length) f.affixes = keys.map(k => ({ k: k, a: BOSS_AFFIXES[k], cd: BOSS_AFFIXES[k].first }));
    }
    if (f.boss) { this.bossAlert = 2.6; this.bossName = spec.name; this.shake = 10; sfx('bossIn'); f.bornT = this.time; this.bossSeq = (this.bossSeq || 0) + 1; this.lastBossKind = id; this.bossEntry(f); }
    if (f.ab.burrow) { f.burrowed = true; this.burrowers.push(f); return f; }
    this.enemies.push(f);
    return f;
  }

  /* 4.23 보스 등장 충격파: 요새 앞에 붙어 성채만 두들기던 병사들을 보스에게서 멀리 날려 보내고 시작한다.
   * 피해는 없다. 붙박이(hold)만 그 자리에 남는다. 날아가는 동안은 넉백과 같아 싸우지 못한다. */
  bossEntry(boss) {
    const bx = boss.x;
    // 진군은 조금 덜 멀리 (충격파에 밀려 다시 걸어오는 동안 보스 전장이 꽤 어려워졌다) — 하드코어 · 도전은 보정에 반영된 거리 그대로
    const gap = this.hard || this.event ? BOSS_ENTRY_GAP : BOSS_ENTRY_GAP_CAMPAIGN;
    let n = 0;
    for (const a of this.allies) {
      if (a.dead || a.ab.hold || a.burrowed) continue;
      const tx = Math.min(a.x, bx - gap - Math.random() * 80);
      const d = a.x - Math.max(ALLY_BASE_X + HOLD_GAP, tx);
      if (d <= 4) continue;
      a.flyV = d / BOSS_ENTRY_FLY; a.flyT = BOSS_ENTRY_FLY; a.kbTimer = Math.max(a.kbTimer, BOSS_ENTRY_FLY);
      n++;
    }
    this.fx.push({ type: 'cast', kind: 'shockwave', x: bx, row: boss.row, color: '#ffcf6a', r: 260, big: true, dir: -1, t: 0.7, life: 0.7 });
    if (n) this.shake = Math.max(this.shake, 14);
  }

  /* 하데스의 명계: 근처에서 쓰러진 적을 해골 병사로 일으킨다.
   * 싸움이 길어질수록 불어나지만, 혼자서는 시체를 만들 힘이 없다. */
  reanimate(corpse) {
    if (corpse.summoned) return;                // 소환물로는 소환물을 만들지 않는다
    for (const h of this.allies) {
      const r = h.ab.reanimate;
      if (!r || h.dead || h.reCd > 0) continue;
      if (Math.abs(h.x - corpse.x) > r.radius) continue;
      let raised = 0;
      for (const a of this.allies) if (!a.dead && a.raisedBy === h) raised++;
      if (raised >= r.max || !this.roomForSummon()) continue;
      const u = UNIT_BY_ID[r.id];
      if (!u) return;
      const m = this.makeAlly(u, corpse.x, h);
      m.summoned = true;
      m.raisedBy = h;
      this.allies.push(m);
      h.reCd = r.cd;
      this.fx.push({ type: 'spawn', x: corpse.x, row: m.row, t: 0.4, life: 0.4 });
      return;
    }
  }

  feedSouls(dead) {
    for (const e of this.enemies) {
      const se = e.ab.souleater;
      if (!se || e.dead || Math.abs(e.x - dead.x) > se.radius || e.souls >= se.max) continue;
      e.souls++;
      e.atk = Math.round(e.baseAtk * (1 + se.atk * e.souls));
      e.scale = e.baseScale * (1 + 0.025 * e.souls);
      e.radius = 26 * e.scale;
      e.heal(e.maxHp * 0.08);
      this.fx.push({ type: 'soul', x: dead.x, x2: e.x, row: dead.row, row2: e.row, t: 0.6, life: 0.6 });
    }
  }

  /* 아직 정리하지 않은 시체가 남았는가 */
  hasUnreaped() {
    for (const f of this.allies) if (f.dead && !f.reaped) return true;
    for (const f of this.enemies) if (f.dead && !f.reaped) return true;
    return false;
  }

  /* 사망 처리 (죽을 때 터지는 능력 포함) */
  reap(list, foes, foeCastle, isEnemySide) {
    for (const f of list) {
      if (!f.dead || f.reaped) continue;
      f.reaped = true;
      // 분신처럼 시간이 다 되어 사라지는 것은 연기만 남긴다
      if (f.vanish) {
        this.fx.push({ type: 'poof', x: f.x, row: f.row, t: 0.45, life: 0.45, color: '#f3e6c8' });
        continue;
      }
      if (f.ab.deathBomb) {
        const b = f.ab.deathBomb;
        this.areaHit(b.dmg * f.abMul, f.x, b.radius, foes, foeCastle, null, false);
        // 4.11 독버섯: 터지며 포자를 흩뿌려 둘레의 병사를 중독시킨다 (정화로 풀린다)
        if (b.poison) for (const a of foes) {
          if (a.dead || a.burrowed || Math.abs(a.x - f.x) > b.radius + a.radius) continue;
          if (a.poisonT <= 0) a.poisonDps = 0;
          a.poisonT = Math.max(a.poisonT, b.poison.dur);
          a.poisonDps = Math.max(a.poisonDps, b.poison.dps * f.abMul);
        }
        if (b.poison) this.fx.push({ type: 'aura', x: f.x, row: f.row, r: b.radius, t: 0.8, life: 0.8, color: '#b06ae8' });
        else this.fx.push({ type: 'boom', x: f.x, r: b.radius, t: 0.35, life: 0.35 });
      }
      if (isEnemySide && !f.exploded) {
        if (f.ab.flee) this.caught = (this.caught || 0) + 1;      // 3.7 잡은 황금 수레
        const got = Math.round((f.gold || 0) * KILL_GOLD_RATE * this.goldMul);
        this.coins += got;
        // 4.13 정예 · 보스를 쓰러뜨리면 금화가 튀어 오른다 (졸개마다 띄우면 화면이 금화투성이가 된다)
        if (got >= 20 && this.fx.length < FX_LIMIT * 0.6) this.fx.push({ type: 'coin', x: f.x, row: f.row, v: got, t: 0.9, life: 0.9 });
        this.kills++;
        if (this.run && this.run.killGold) this.money = Math.min(this.walletMax, this.money + this.run.killGold);   // 5.0 전리품 사냥
        this.reanimate(f);
        if (f.stolen > 0) {                       // 도둑이 훔친 군자금을 되찾는다
          this.money = Math.min(this.walletMax, this.money + f.stolen);
          this.fx.push({ type: 'coin', x: f.x, row: f.row, v: Math.round(f.stolen), t: 0.9, life: 0.9 });
          f.stolen = 0;
        }
        if (f.ab.split) {                         // 분열: 작은 것 둘로 갈라진다
          const sp = f.ab.split, n = sp.n || 2;
          for (let k = 0; k < n; k++) {
            const m = this.spawnEnemy(sp.id, Math.max(80, Math.min(WORLD - 80, f.x + (k - (n - 1) / 2) * 30)), f.mul);
            m.summoned = true; m.wave = f.wave; m.row = f.row; m.age = 0;
          }
          this.fx.push({ type: 'poof', x: f.x, row: f.row, t: 0.45, life: 0.45, color: f.s.accent, big: true });
        }
      }
      if (f.boss && isEnemySide && !this.twinHold(f)) { this.bossDown = true; this.enemyCastle.floor = 0; }   // 결계가 걷힌다 (5.3 쌍왕은 둘 다 쓰러져야)
      // 흡혼귀: 근처에서 쓰러진 아군의 넋을 삼킨다 (불려 나온 것은 넋이 없다)
      if (!isEnemySide && !f.summoned) this.feedSouls(f);
      // 쓰러지는 연출 + 먼지
      this.fx.push({ type: 'corpse', st: f.s, x: f.x, row: f.row, dir: f.dir,
                     scale: f.scale, t: 0.9, life: 0.9, hero: !!(f.s.gacha && !f.summoned) });
      this.fx.push({ type: 'poof', x: f.x, row: f.row, t: 0.4, life: 0.4,
                     color: f.s.body, big: f.boss });
      if (f.boss) {
        this.shake = Math.max(this.shake, 12);
        sfx('bossDie');
        if (isEnemySide) this.bossKills = (this.bossKills || 0) + 1;
      }
      else sfx('die');
    }
  }

  finish(result) {
    if (this.state !== 'play') return;
    this.state = result;
    this.resultTime = 0;
    this.stars = 0;
    sfx(result === 'win' ? 'win' : 'lose');
    this.recordTrials(result);

    if (this.conquest) {
      // 5.0 정벌: 이기면 전장 보상, 지면 절반. 소환석은 원정이 끝날 때 한꺼번에 (conqFinish)
      if (result === 'win') {
        const ratio = this.allyCastle.hp / this.allyCastle.maxHp;
        this.stars = ratio >= 0.9 ? 3 : (ratio >= 0.5 ? 2 : 1);
        this.coins += this.stage.reward;
      } else this.coins = Math.floor(this.coins * 0.5);
      this.coins = Math.round(this.coins * (this.run ? this.run.coinMul : 1));
      this.stoneGain = 0;
      this.save.coins += this.coins;
      this.save.totalKills = (this.save.totalKills || 0) + this.kills;
      saveGame(this.save);
      return;
    }
    if (this.endless) {
      this.wavesCleared = this.wavesDone();
      const best = this.save.endlessBest || 0;
      this.newRecord = this.wavesCleared > best;
      if (this.newRecord) this.save.endlessBest = this.wavesCleared;
      // 웨이브 수에 따른 보상 (4.16: 뒤 웨이브일수록 더 · 쓰러뜨린 보스마다 덤)
      const W = this.wavesCleared;
      this.coins += W * 100 + W * W * 6 + (this.bossKills || 0) * 400;
      this.stoneGain = Math.floor(W / 4) + Math.floor((this.bossKills || 0) / 3);
      if (result === 'win') {                    // 요새 함락: 웨이브 보상 1.5배 + 소환석 2
        this.fortFell = true;
        this.coins = Math.round(this.coins * 1.5);
        this.stoneGain += 2;
      }
      this.save.stones = (this.save.stones || 0) + this.stoneGain;
      this.save.coins += this.coins;
      this.save.totalKills = (this.save.totalKills || 0) + this.kills;
      saveGame(this.save);
      return;
    }
    if (this.expedition) {
      // 3.7 금화 원정: 이기면 정해진 금화 + 잡은 만큼. 몇 번이고 다시 돈다. 소환석은 없다.
      const ex = this.expedition;
      if (!this.save.expeditions || typeof this.save.expeditions !== 'object') this.save.expeditions = {};
      if (result === 'win') {
        const ratio = this.allyCastle.hp / this.allyCastle.maxHp;
        this.stars = ratio >= 0.9 ? 3 : (ratio >= 0.5 ? 2 : 1);
        this.coins += ex.reward;
        const prev = this.save.expeditions[ex.id] || 0;
        if (this.stars > prev) this.save.expeditions[ex.id] = this.stars;
        this.save.expRuns = (this.save.expRuns || 0) + 1;
      } else {
        this.coins = Math.floor(this.coins * 0.5);
      }
      this.stoneGain = 0;
      this.save.coins += this.coins;
      this.save.totalKills = (this.save.totalKills || 0) + this.kills;
      saveGame(this.save);
      return;
    }
    if (result === 'win' && this.event) {
      // 이벤트 전장: 별 대신 돌파 기록(별 수), 처음 넘으면 큰 보상
      const ev = this.event, ratio = this.allyCastle.hp / this.allyCastle.maxHp;
      this.stars = ratio >= 0.9 ? 3 : (ratio >= 0.5 ? 2 : 1);
      if (!this.save.events || typeof this.save.events !== 'object') this.save.events = {};
      const prev = this.save.events[ev.id] || 0;
      this.firstEvent = !prev;
      this.coins += ev.reward;
      this.stoneGain = this.firstEvent ? ev.stones : 0;
      if (this.stars > prev) this.save.events[ev.id] = this.stars;
      this.save.stones = (this.save.stones || 0) + this.stoneGain;
      this.save.coins += this.coins;
      this.save.totalKills = (this.save.totalKills || 0) + this.kills;
      saveGame(this.save);
      return;
    }
    if (result === 'win' && this.hard) {
      // 하드코어는 별 대신 왕관 하나. 보상 골드 두 배, 처음 이기면 소환석.
      const ratio = this.allyCastle.hp / this.allyCastle.maxHp;
      this.stars = ratio >= 0.9 ? 3 : (ratio >= 0.5 ? 2 : 1);
      this.coins += this.stage.reward * HARDCORE.reward;
      if (!this.save.hard || typeof this.save.hard !== 'object') this.save.hard = {};
      this.firstHard = !this.save.hard[this.stageIndex];
      this.save.hard[this.stageIndex] = true;
      this.stoneGain = this.firstHard ? HARDCORE.stones : 0;
      this.save.stones = (this.save.stones || 0) + this.stoneGain;
      this.save.coins += this.coins;
      this.save.totalKills = (this.save.totalKills || 0) + this.kills;
      saveGame(this.save);
      return;
    }
    if (result === 'win') {
      const ratio = this.allyCastle.hp / this.allyCastle.maxHp;
      this.stars = ratio >= 0.9 ? 3 : (ratio >= 0.5 ? 2 : 1);
      this.coins += this.stage.reward;

      // 새로 딴 별마다 보너스
      const prev = (this.save.stars && this.save.stars[this.stageIndex]) || 0;
      this.newStars = Math.max(0, this.stars - prev);
      this.starBonus = this.newStars * (60 + this.stageIndex * 12);
      this.coins += this.starBonus;
      if (!this.save.stars) this.save.stars = {};
      if (this.stars > prev) this.save.stars[this.stageIndex] = this.stars;

      // 소환석: 첫 돌파 2개 + 새로 딴 별 1개당 1개
      this.stoneGain = this.newStars;
      if (this.stageIndex >= this.save.cleared) {
        this.save.cleared = this.stageIndex + 1;
        this.stoneGain += 2;
      }
      this.save.stones = (this.save.stones || 0) + this.stoneGain;
      this.save.coins += this.coins;
      this.save.totalKills = (this.save.totalKills || 0) + this.kills;
      saveGame(this.save);
    } else {
      this.coins = Math.floor(this.coins * 0.5);
      this.save.coins += this.coins;
      this.save.totalKills = (this.save.totalKills || 0) + this.kills;
      saveGame(this.save);
    }
  }

  /* 4.4 3진 시련 기록: 병종별 누적 피해·치유, 전장 최단 돌파 시간, 성채 100% 돌파 */
  recordTrials(result) {
    const s = this.save;
    if (!s.life || typeof s.life !== 'object') s.life = {};
    for (const id in this.meter) {
      if (!UNIT_BY_ID[id]) continue;
      const m = this.meter[id], L = s.life[id] || (s.life[id] = { d: 0, h: 0 });
      L.d = Math.round((L.d || 0) + (m.dmg || 0));
      L.h = Math.round((L.h || 0) + (m.heal || 0));
    }
    if (result !== 'win' || this.hard || this.event || this.endless || this.expedition) return;
    if (this.stageIndex >= STAGES.length || this.stage !== STAGES[this.stageIndex]) return;
    if (!s.best || typeof s.best !== 'object') s.best = {};
    this.clearTime = Math.round(this.time * 10) / 10;
    this.prevBest = s.best[this.stageIndex];
    if (this.prevBest === undefined || this.clearTime < this.prevBest) s.best[this.stageIndex] = this.clearTime;
    if (this.allyCastle.hp >= this.allyCastle.maxHp) {
      if (!s.perfect || typeof s.perfect !== 'object') s.perfect = {};
      s.perfect[this.stageIndex] = true;
    }
  }

  /* ---- 4.6 도전: 폭주 기관차 ----
   * 기관차는 싸우지 않고 아군 성채로 달린다. 닿으면 성채가 그대로 무너진다(패배).
   * 둔화되면 느려지고 기절하면 선다(기절 뒤엔 잠깐 면역). every 초마다 경적을 울리고 warn 초 뒤 dur 초 동안 mul 배로 돌진한다.
   * 닿은 아군은 ram 초마다 치여서 피해를 입는다(돌진 중엔 두 배 + 잠깐 기절). 막을 수는 없고 넘고 지나간다.
   * 요새를 먼저 부수면 이긴다. */
  trainTick(f, foes, dt) {
    const tr = f.ab.train;
    if (f.trainCd === undefined) f.trainCd = tr.first || tr.every;
    f.trainCd -= dt;
    if (!f.horn && f.trainCd <= tr.warn) {
      f.horn = true;
      this.announce('경적! 기관차가 돌진합니다', tr.warn);
      this.fx.push({ type: 'warn', x: f.x - (tr.warn + tr.dur) * f.s.speed * tr.mul * 0.5, r: 160, t: tr.warn, life: tr.warn, color: '#ffb03c' });
      sfx('siren');
    }
    if (f.trainCd <= 0) { f.trainCd = tr.every; f.horn = false; f.chargeT = tr.dur; this.shake = Math.max(this.shake, 6); sfx('cannon'); }
    if (f.chargeT > 0) f.chargeT -= dt;
    const charging = f.chargeT > 0;
    const sp = f.speedNow * (charging ? tr.mul : 1);
    f.moving = sp > 0; f.engaged = false;
    f.x = Math.max(60, f.x + f.dir * sp * dt);
    // 치기: 앞(성채 쪽)에 닿은 아군
    f.ramCd = (f.ramCd || 0) - dt;
    if (f.ramCd <= 0) {
      let hit = false;
      for (const a of foes) {
        if (a.dead || a.burrowed) continue;
        const gap = (f.x - a.x) * -f.dir;              // 앞쪽이면 0 이상
        if (gap < -a.radius - 10 || gap > f.radius + a.radius + 6) continue;
        this.hitOne(f.atk * (charging ? 2 : 1), a, f, false);
        if (charging) a.stun && a.stun(0.6);              // 돌진에 치이면 잠깐 넘어진다 (밀려나진 않는다 — 기관차는 넘고 지나간다)
        hit = true;
      }
      f.ramCd = tr.ram;
      if (hit) { f.swing = 0.22; this.fx.push({ type: 'hit', x: f.x + f.dir * f.radius, row: f.row, dir: f.dir, t: 0.22, life: 0.22 }); }
    }
    if (f.x <= this.allyCastle.x + 40 + f.radius && !this.allyCastle.dead) {
      this.allyCastle.takeDamage(this.allyCastle.hp + 1);
      this.announce('기관차가 성채를 들이받았습니다', 2.4);
      this.shake = 16; sfx('boom');
    }
  }

  /* ---- 4.15 도전: 파라오의 모래시계 ----
   * 시작할 때 전장 at(아군 성채 0 ~ 요새 1) 자리에 모래시계 토템을 세운다. every 초마다 모래시계가 뒤집히고,
   * 그때 살아 있는 토템 하나마다 요새가 최대 체력의 heal 만큼 아문다. limit 초가 지나면 모래가 다 떨어져 패배. */
  hourglassLeft() { const hg = this.stage.hourglass; return hg ? Math.max(0, hg.limit - this.time) : Infinity; }
  hourglassTick(hg, dt) {
    if (!this.hgInit) {
      this.hgInit = true; this.hgFlip = hg.every;
      for (const fr of hg.at) {
        const m = this.spawnEnemy(hg.id, ALLY_BASE_X + (ENEMY_BASE_X - ALLY_BASE_X) * fr);
        this.fx.push({ type: 'spawn', x: m.x, row: m.row, t: 0.5, life: 0.5, grand: true, color: '#ffd23a' });
      }
    }
    const left = hg.limit - this.time;
    if (left <= 20 && !this.hgWarned) { this.hgWarned = true; this.announce('모래가 20초 남았습니다', 2); sfx('siren'); }
    if (left <= 0) {
      if (!this.allyCastle.dead && !this.enemyCastle.dead) {
        this.allyCastle.takeDamage(this.allyCastle.hp + 1);
        this.announce('모래시계의 모래가 다 떨어졌습니다', 2.4);
        this.shake = 12; sfx('boom');
      }
      return;
    }
    this.hgFlip -= dt;
    if (this.hgFlip > 0) return;
    this.hgFlip = hg.every;
    let n = 0;
    for (const e of this.enemies) if (!e.dead && e.kind === hg.id) { n++; this.fx.push({ type: 'aura', x: e.x, row: e.row, r: 90, t: 0.6, life: 0.6, color: '#ffd23a' }); }
    const c = this.enemyCastle;
    if (!n || c.dead) { this.announce('모래시계가 뒤집혔다 · 토템이 없어 요새가 아물지 못합니다', 1.8); return; }
    c.hp = Math.min(c.maxHp, c.hp + c.maxHp * hg.heal * n);
    this.announce('모래시계가 뒤집혔다 · 요새 +' + Math.round(hg.heal * n * 100) + '%', 2);
    this.fx.push({ type: 'aura', x: c.x, row: 1, r: 160, t: 0.8, life: 0.8, color: '#ffd23a' });
    sfx('zap');
  }

  /* ---- 4.6 도전: 그림자 가면무도회 ----
   * 가면 군주는 every 초마다 전장에 가장 많이 선 아군 병종(같으면 비싼 쪽)을 골라
   * 그 카드를 seal 초 동안 봉인하고, 그 병종의 그림자를 n 명까지 적으로 보낸다(원본 힘 × mul).
   * 같은 병종만 쏟아부으면 제 칼에 베인다 — 고르게 섞어 내야 한다. */
  maskTick(f, dt) {
    const m = f.ab.mask;
    if (f.maskCd === undefined) f.maskCd = m.first || m.every;
    if (f.stunT > 0) return;
    f.maskCd -= dt;
    if (f.maskCd > 0) return;
    f.maskCd = m.every;
    const cnt = {};
    for (const a of this.allies) if (!a.dead && !a.summoned && a.s.id && UNIT_BY_ID[a.s.id]) cnt[a.s.id] = (cnt[a.s.id] || 0) + 1;
    // 가장 많이 선 병종 (같으면 비싼 쪽). 고르게 섞어 냈다면 하나만 베껴 간다.
    let best = null, bn = 0;
    for (const id in cnt) if (cnt[id] > bn || (cnt[id] === bn && UNIT_BY_ID[id].cost > UNIT_BY_ID[best].cost)) { best = id; bn = cnt[id]; }
    if (!best) return;
    this.sealed[best] = m.seal;
    const st = this.stats(best);
    const name = st.name;
    this.announce('그림자 가면: ' + name + ' 봉인', 2.2);
    sfx('zap');
    const n = Math.min(m.n, bn);
    for (let i = 0; i < n; i++) this.spawnShadow(st, f.x + f.dir * (30 + i * 26), m.mul || 1);
    this.fx.push({ type: 'aura', x: f.x, row: f.row, r: 220, t: 0.7, life: 0.7, color: '#c06aff' });
  }
  /* 아군 병종의 그림자: 같은 모습 · 같은 힘의 적. 소환 · 금화 같은 아군 전용 능력은 뗀다. */
  spawnShadow(st, x, mul) {
    const ab = Object.assign({}, st.ab || {});
    for (const k of ['summon', 'gold', 'reanimate', 'sapper', 'hook', 'rally', 'ward', 'vanguard']) delete ab[k];
    const sh = Object.assign({}, st, { ab: ab, shadow: true, active: null, arrive: null, healFx: null, gold: 0,
                                       body: '#2a2238', tunic: '#3a2a52', accent: '#c06aff' });
    const e = new Fighter(sh, 'enemy', Math.max(80, Math.min(WORLD - 80, x)), mul !== 1 ? { hp: mul, atk: mul } : null);
    e.gold = 0; e.kind = 'shadow'; e.summoned = true; e.shadow = true;
    this.enemies.push(e);
    this.fx.push({ type: 'spawn', x: e.x, row: e.row, t: 0.5, life: 0.5, grand: true, color: '#c06aff' });
    return e;
  }

  /* ------------------- 한 진영의 행동 ------------------- */
  step(list, foes, foeCastle, dt, isAlly) {
    for (const f of list) {
      if (f.dead) continue;
      f.moving = false;
      f.engaged = false;
      f.age += dt;
      if (f.hitFlash > 0) f.hitFlash -= dt;
      if (f.swing > 0) f.swing -= dt;
      if (f.slowT > 0) f.slowT -= dt;
      if (f.hasteT > 0) f.hasteT -= dt;
      if (f.auraPulse > 0) f.auraPulse -= dt;
      if (f.rallyT > 0) { f.rallyT -= dt; if (f.rallyT <= 0) f.rallyMul = 1; }
      if (f.vulnT > 0) { f.vulnT -= dt; if (f.vulnT <= 0) f.vulnMul = 1; }
      if (f.reCd > 0) f.reCd -= dt;
      if (f.weakT > 0) { f.weakT -= dt; if (f.weakT <= 0) f.weakMul = 1; }
      if (f.stunImm > 0) f.stunImm -= dt;
      if (f.ab.unshakable) { f.stunT = 0; f.slowT = 0; }          // 무승: 흔들리지 않는다
      // 분신은 잠깐만 머문다
      if (f.lifeT !== undefined) { f.lifeT -= dt; if (f.lifeT <= 0) { f.dead = true; f.vanish = true; continue; } }
      // 3.7 금화 원정: 황금 수레는 아군 성채까지 가면 짐을 싣고 달아난다 (금화는 못 받는다)
      if (f.ab.flee && f.side === 'enemy' && f.x <= this.allyCastle.x + f.ab.flee) {
        f.dead = true; f.vanish = true; this.fled = (this.fled || 0) + 1;
        this.announce('황금 수레가 달아났습니다', 1.6);
        continue;
      }
      f.bob += dt * (f.speedNow / 22);

      const burning = f.burnT > 0;
      // 중독 / 화상 피해
      let dot = 0;
      if (f.poisonT > 0) { dot += f.poisonDps * Math.min(dt, f.poisonT); f.poisonT = Math.max(0, f.poisonT - dt); }
      if (f.burnT > 0) { dot += f.burnDps * Math.min(dt, f.burnT) * (f.ab.lavaborn ? LAVA_BURN_MUL : 1); f.burnT = Math.max(0, f.burnT - dt); }
      if (isAlly) dot *= 1 - 0.05 * Math.min(5, this.save.upgrades.resistance || 0);
      if (dot > 0) {
        if (!isAlly && f.dotBy) { const m = this.meter[f.dotBy] || (this.meter[f.dotBy] = { dmg: 0, taken: 0, n: 0 }); m.dmg += Math.min(dot, Math.max(0, f.hp)); }
        f.hp -= dot;
        if (f.hp <= 0) {
          if (f.ab.revive && !f.usedRevive) {
            f.usedRevive = true; f.hp = Math.round(f.maxHp * f.ab.revive); f.reviveFx = true;
          } else { f.hp = 0; f.dead = true; continue; }
        }
      }
      // 3.5: 부활(불굴)이 화면에 보이게 한다 — 전엔 표시만 해 두고 아무도 읽지 않았다
      if (f.reviveFx) {
        f.reviveFx = false;
        this.fx.push({ type: 'revive', x: f.x, row: f.row, t: 0.9, life: 0.9, scale: f.scale, hero: !!f.s.gacha });
        sfx('rally');
      }

      if (f.ab.regen && !burning) f.heal(f.ab.regen * dt);
      // 저주: 불려 나온 아군(해골·미라·방벽)은 서서히 시든다
      if (isAlly && f.summoned && this.mods.curse) {
        f.hp -= f.maxHp * CURSE_WITHER * dt;
        if (f.hp <= 0) { f.hp = 0; f.dead = true; continue; }
      }

      // 보스 패턴
      if (f.s.phases || f.s.special || f.affixes) this.bossTick(f, dt);
      if (f.cloneOf || f.guardOf) {                          // 4.21 분신 · 수호 토템: 주인이 쓰러지면 함께 사라진다, 분신은 시간이 다 되면 보스에게 돌아간다
        const o = f.cloneOf || f.guardOf;
        if (f.cloneOf) f.cloneT -= dt;
        if (o.dead || (f.cloneOf && f.cloneT <= 0)) {
          // 4.22: 돌아올 때마다 덜 채운다 (×0.7) — 화력이 약한 편성이면 분신이 보스를 끝없이 채워 판이 끝나지 않았다
          if (!o.dead && f.cloneOf) { o.heal(o.maxHp * f.cloneHeal * Math.pow(0.7, o.cloneReturns || 0)); o.cloneReturns = (o.cloneReturns || 0) + 1; this.fx.push({ type: 'aura', x: o.x, row: o.row, r: 110, t: 0.6, life: 0.6, color: '#c06aff' }); this.announce('분신이 보스에게 돌아갔다', 1.6); }
          this.fx.push({ type: 'poof', x: f.x, row: f.row, t: 0.45, life: 0.45, color: f.cloneOf ? '#c06aff' : '#ffd76a', big: true });
          f.exploded = true; f.hp = 0; f.dead = true; continue;
        }
      }
      if (f.ab.mask && !isAlly) this.maskTick(f, dt);       // 4.6 가면 군주
      if (f.ab.glamour) {                                    // 4.11 홀림불: 가까이 선 적이 있으면 장막이 걷힌 모습 (그리기용)
        let near = false;
        for (const a of foes) if (!a.dead && Math.abs(a.x - f.x) <= f.ab.glamour + a.radius + f.radius) { near = true; break; }
        f.unveiled = near;
      }

      // 기절
      if (f.stunT > 0) { f.stunT -= dt; continue; }
      if (f.windT > 0) { f.windT -= dt; continue; }        // 4.21 돌진 준비: 제자리에서 힘을 모은다

      // 넉백
      if (f.kbTimer > 0) {
        f.kbTimer -= dt;
        if (f.flyT > 0) { f.flyT -= dt; f.x -= f.dir * f.flyV * dt; } else f.x -= f.dir * 150 * dt;
        if (f.kbTimer <= 0) f.flyT = 0;     // 5.5: 날아가다 짧은 넉백에 덮이면 남은 비행 시간이 다음 넉백을 멀리 날렸다
        f.x = Math.max(60, Math.min(WORLD - 60, f.x));
        this.holdLine(f);
        continue;
      }

      // 홀린 적은 제 편을 친다. 앞으로 나가지도 않는다.
      if (f.charmT > 0) {
        f.charmT -= dt;
        this.charmedTick(f, list, dt);
        continue;
      }

      if (f.ab.leap && !f.leapt) this.tryLeap(f, foes);
      if (f.ab.hook) this.tryHook(f, foes, dt);

      // 지원 능력 (표적과 무관하게 주기적으로 발동)
      this.supportTick(f, list, dt, isAlly);

      // 4.6 폭주 기관차: 멈추지 않고 성채로 달린다 · 앞을 막은 병사는 치여 밀려난다
      if (f.ab.train && !isAlly) { this.trainTick(f, foes, dt); continue; }
      // 3.7 황금 수레: 싸우지 않고 아군 성채 쪽으로 계속 굴러간다 (앞을 막아도 비집고 지나간다)
      if (f.ab.flee && !isAlly) {
        f.engaged = false; f.moving = true;
        f.x = Math.max(60, f.x + f.dir * f.speedNow * dt);
        continue;
      }
      const target = this.findTarget(f, foes, foeCastle);
      if (!target && !isAlly && f.boss && !f.s.ranged) this.bossThrow(f, foes, dt);
      if (target) {
        f.engaged = true;
        f.idleT = 0;
        f.cd -= dt;
        if (f.cd <= 0) {
          f.cd = f.intervalNow;
          f.swing = 0.22;
          this.attack(f, target, foes, foeCastle);
          if (f.ab.spinup) f.spin = Math.min(f.ab.spinup.max, f.spin + f.ab.spinup.per);
        }
      } else if (isAlly && f.ab.hold && f.summoned && f.s.ranged) {
        // 포탑: 쏠 적이 없는 채로 전열이 앞으로 나가 버리면 바퀴를 굴려 따라간다
        f.idleT = (f.idleT || 0) + dt;
        if (f.idleT > TURRET_IDLE && !(this.allyFront > -Infinity && f.x >= this.allyFront - 40)) {
          f.moving = true;
          f.x = Math.min(WORLD - 60, f.x + f.dir * TURRET_SPEED * dt);
        }
      } else if (!f.ab.hold && this.canAdvance(f, foes) &&
                 // 3.9 선봉: 근접 영웅은 전열을 이끌되 혼자 멀리 앞서 나가지 않는다 (홀로 둘러싸여 쓰러지던 것)
                 !(isAlly && f.ab.vanguard && this.lineFront > -Infinity && f.x >= this.lineFront + VANGUARD_LEAD) &&
                 // 원거리 아군은 근접 전열이 있으면 그 뒤에서 기다린다 (앞질러 나가 엄호를 잃지 않게)
                 !(isAlly && f.s.ranged && this.allyFront > -Infinity && f.x >= this.allyFront + COVER_SLACK * 0.5)) {
        f.spin = 0;                                 // 걸으면 식는다
        f.moving = f.speedNow > 0;
        f.x += f.dir * f.speedNow * dt * (isAlly ? 1 : this.rush || 1);
        f.x = Math.max(60, Math.min(WORLD - 60, f.x));
        if (f.ab.charge) f.chargeDist += f.speedNow * dt;   // 달려온 만큼 창끝이 무거워진다
      }
    }
  }

  /* 4.12 밀려나는 한계: 넉백 · 밀치기로도 자기 요새 바로 앞보다 뒤로는 밀리지 않는다.
   * 예전엔 적이 요새 뒤까지 밀려나 근접 병사가 닿지 못하고, 그 적도 아무도 못 치는 채로 굳었다. */
  holdLine(f) {
    if (f.side === 'enemy') { if (f.x > ENEMY_BASE_X - HOLD_GAP) f.x = ENEMY_BASE_X - HOLD_GAP; }
    else if (f.x < ALLY_BASE_X + HOLD_GAP) f.x = ALLY_BASE_X + HOLD_GAP;
    if (f.x < 60) f.x = 60; else if (f.x > WORLD - 60) f.x = WORLD - 60;
  }
  /* 4.12 근접 보스의 던지기: 앞에 칠 병사가 없으면 every 초마다 사거리 안의 가장 가까운 병사에게
   * 바위 · 기운을 던진다 (공격력의 mul 배, 작은 범위). 멀리서 쏘기만 하는 편성도 보스를 마냥 두들기지 못한다. */
  bossThrow(f, foes, dt) {
    if (f.throwCd === undefined) f.throwCd = BOSS_THROW.first;
    f.throwCd -= dt;
    if (f.throwCd > 0) return;
    let best = null, bd = Infinity;
    for (const a of foes) {
      if (a.dead || a.burrowed) continue;
      const d = (a.x - f.x) * f.dir;
      if (d > 0 && d <= BOSS_THROW.range && d < bd) { bd = d; best = a; }
    }
    if (!best) { f.throwCd = 0.5; return; }
    f.throwCd = BOSS_THROW.every;
    f.swing = 0.22;
    this.shots.push({
      x: f.x, y0: f.row, tx: best.x, side: f.side, t: 0, dur: Math.max(0.3, bd / 700),
      color: f.s.accent, dmg: this.rollDamage(f).dmg * BOSS_THROW.mul, crit: false, src: f,
      area: true, areaRadius: BOSS_THROW.radius, dir: f.dir, bossThrow: true
    });
    sfx('arrow');
  }

  /* 사제·나팔수처럼 공격하지 않는 병종은 적과 일정 거리를 두고 멈춘다.
   * 그대로 두면 혼자 적진까지 걸어 들어가 죽는다. */
  canAdvance(f, foes) {
    if (!f.ab.noAttack) return true;
    const keep = f.ab.standoff || 200;
    for (const e of foes) {
      if (e.dead) continue;
      if ((e.x - f.x) * f.dir < keep) return false;
    }
    // 3.2.1: 적이 다 쓰러져도 적 성채까지 걸어 들어가 겹쳐 서지 않는다
    const fort = f.side === 'ally' ? this.enemyCastle : this.allyCastle;
    if (!fort.dead && (fort.x - f.x) * f.dir < keep + fort.radius) return false;
    // 아군 지원병은 근접 전열 뒤에 선다 (전열이 있으면)
    if (f.side === 'ally' && this.allyFront > -Infinity && f.x >= this.allyFront - 20) return false;
    return true;
  }

  supportTick(f, mates, dt, isAlly) {
    const ab = f.ab;
    if (!ab.heal && !ab.gold && !ab.summon && !ab.barrier && !ab.haste && !ab.cleanse &&
        !ab.rally && !ab.ward && !ab.pacify && !ab.wish) return;
    if (ab.gold && isAlly) {
      this.money = Math.min(this.walletMax, this.money + ab.gold * dt);
    }
    f.abCd -= dt;
    if (f.abCd > 0) return;
    f.abCd = ab.interval || 3;

    if (ab.rally) {
      // 지휘: 주변 아군의 공격력을 올린다. 본인은 받지 않는다 — 혼자서는 약하다.
      for (const m of mates) {
        if (m.dead || m === f) continue;
        if (Math.abs(m.x - f.x) > ab.rally.radius) continue;
        m.rallyT = Math.max(m.rallyT, (ab.interval || 3) + 0.6);
        m.rallyMul = Math.max(m.rallyMul, 1 + ab.rally.atk);
      }
      f.auraPulse = 0.5;
      this.fx.push({ type: 'aura', x: f.x, row: f.row, r: ab.rally.radius,
                     t: 0.5, life: 0.5, color: f.s.accent });
    }

    if (ab.ward) {
      // 종지기: 종소리가 닿은 아군은 기절·둔화가 풀리고 잠깐 기절하지 않는다
      for (const m of mates) if (!m.dead && Math.abs(m.x - f.x) <= ab.radius) {
        m.stunT = 0; m.slowT = 0; m.stunImm = Math.max(m.stunImm, ab.ward.dur);
        m.charmT = 0; m.charmGuard = this.time + ab.ward.dur;      // 3.3: 세이렌의 노래도 풀린다
      }
      f.auraPulse = 0.5;
      this.fx.push({ type: 'bell', x: f.x, row: f.row, r: ab.radius, t: 0.7, life: 0.7, color: '#f6d365' });
    }
    if (ab.wish) {
      // 5.2 지니의 소원: 주기마다 하나씩, 차례로 — 회복(최대 체력 비율) → 보호막 → 가속
      const w = f.wishN = ((f.wishN === undefined ? -1 : f.wishN) + 1) % 3, W = ab.wish;
      for (const m of mates) {
        if (m.dead || Math.abs(m.x - f.x) > ab.radius) continue;
        if (w === 0) { if (m !== f) { const filled = m.heal(m.maxHp * W.heal); if (isAlly && filled > 0) { const row = this.meterRow(f); row.heal = (row.heal || 0) + filled; } } }
        else if (w === 1) m.giveBarrier(W.barrier * f.abMul);
        else if (m !== f) { m.hasteMul = m.hasteT > 0 ? Math.min(m.hasteMul, W.haste.mul) : W.haste.mul; m.hasteT = Math.max(m.hasteT, W.haste.dur); }
      }
      f.auraPulse = 0.5;
      this.fx.push({ type: 'aura', x: f.x, row: f.row, r: ab.radius, t: 0.6, life: 0.6, color: w === 0 ? '#7fe08e' : w === 1 ? '#8fd8ff' : '#ffd166' });
      this.fx.push({ type: 'wish', x: f.x, row: f.row, w: w, scale: f.scale || 1, t: 0.9, life: 0.9 });
    }
    if (ab.pacify) {
      // 삼장법사: 경을 읊으면 주변 적의 살기가 누그러진다
      for (const e of this.foesOf(f.side)) if (!e.dead && Math.abs(e.x - f.x) <= ab.radius) {
        e.weakT = Math.max(e.weakT, ab.pacify.dur);
        e.weakMul = Math.min(e.weakMul, ab.pacify.mul);
      }
      this.fx.push({ type: 'aura', x: f.x, row: f.row, r: ab.radius, t: 0.6, life: 0.6, color: '#f6e6a0' });
    }
    if (ab.cleanse) {
      for (const m of mates) if (!m.dead && Math.abs(m.x - f.x) <= ab.radius) {
        m.poisonT = 0; m.poisonDps = 0; m.burnT = 0; m.burnDps = 0; m.slowT = 0;
      }
      if (!f.s.healFx) this.fx.push({type:'aura',x:f.x,row:f.row,r:ab.radius,color:'#a4f6cc',t:.5,life:.5});
    }
    if (ab.heal) {
      let healed = false;
      const siren = isAlly && f.s.healFx === 'siren' ? [] : null;
      for (const m of mates) {
        if (m.dead || m === f) continue;
        if (Math.abs(m.x - f.x) > ab.radius) continue;
        if (m.hp >= m.maxHp) continue;
        // 적의 치유는 겹치지 않는다: 주술사가 떼로 서도 한 적은 1.5초에 한 번만 낫는다 (끝없는 교착 방지)
        if (!isAlly) { if (m.healedAt !== undefined && this.time - m.healedAt < ENEMY_HEAL_GAP) continue; m.healedAt = this.time; }
        const filled = m.heal(ab.heal * f.abMul * (isAlly ? 1 + .06 * Math.min(5, this.save.upgrades.medicine || 0) : (m.boss ? BOSS_HEAL_TAKEN : 1)));
        if (isAlly && filled > 0) { const row = this.meterRow(f); row.heal = (row.heal || 0) + filled; }
        if (siren && filled > 0) siren.push(m);
        healed = true;
      }
      if (siren) { f.auraPulse = 0.5; this.x3Siren(f, ab.radius, siren); }
      else if (healed) {
        f.auraPulse = 0.5;
        this.fx.push({ type: 'aura', x: f.x, row: f.row, r: ab.radius,
                       t: 0.5, life: 0.5, color: '#7fe08e' });
      }
    }
    if (ab.barrier) {
      for (const m of mates) {
        if (m.dead) continue;
        if (Math.abs(m.x - f.x) > ab.radius) continue;
        m.giveBarrier(ab.barrier * f.abMul);
      }
      f.auraPulse = 0.5;
      if (!f.s.healFx) this.fx.push({ type: 'aura', x: f.x, row: f.row, r: ab.radius,
                                      t: 0.5, life: 0.5, color: '#8fd8ff' });
    }
    if (ab.haste) {
      for (const m of mates) {
        if (m.dead || m === f) continue;
        if (Math.abs(m.x - f.x) > ab.radius) continue;
        m.hasteT = Math.max(m.hasteT, ab.haste.dur);
        m.hasteMul = ab.haste.mul;
      }
      f.auraPulse = 0.5;
      this.fx.push({ type: 'aura', x: f.x, row: f.row, r: ab.radius,
                     t: 0.5, life: 0.5, color: '#ffd166' });
    }
    if (ab.summon) {
      for (let i = 0; i < (ab.summon.n || 1); i++) {
        const sx = f.x - f.dir * (20 + i * 22);
        if (isAlly) {
          const u = UNIT_BY_ID[ab.summon.id];
          if (u && !this.roomForSummon()) break;
          if (u) {
            // 포탑처럼 수가 정해진 소환물은 그 이상 세우지 않는다
            if (ab.summon.max) {
              let mine = 0;
              for (const a of this.allies) if (!a.dead && a.summonedBy === f) mine++;
              if (mine >= ab.summon.max) break;
            }
            // 포탑처럼 서서 쏘는 소환물은 발명가 발밑이 아니라 근접 전열 바로 뒤에 세운다
            let px = sx;
            if (u.ab && u.ab.hold && u.ranged && this.allyFront > -Infinity) px = Math.max(sx, Math.min(f.x + 160, this.allyFront - 40 - i * 22));
            const m = this.makeAlly(u, px, f);
            m.summoned = true;
            m.summonedBy = f;
            if (ab.summon.life) m.lifeT = ab.summon.life;       // 분신은 잠깐만 머문다
            this.allies.push(m);
          }
        } else {
          const m = this.spawnEnemy(ab.summon.id, sx); m.summoned = true; m.wave = f.wave;
        }
      }
      this.fx.push({ type: 'spawn', x: f.x - f.dir * 24, row: f.row, t: 0.4, life: 0.4 });
    }
  }

  /* ------------------- 끝없는 증원 -------------------
   * 대본 웨이브를 다 막아도 적 요새는 병력을 계속 내보낸다. 시간이 갈수록
   * 간격이 좁아지고 한 마리 한 마리가 세진다. 버티기만 하는 전략은 반드시
   * 무너지므로, 결국 요새를 부수러 나가야 한다. */
  tickReinforce(dt) {
    if (this.endless) return;                   // 무한 전장은 자체 웨이브로 돈다
    if (this.qi < this.queue.length) return;    // 대본 웨이브가 남아 있으면 아직
    if (this.enemyCastle.dead) return;

    this.reinfT -= dt;
    if (this.reinfT > 0) return;

    if (!this.reinfOn) {                        // 첫 증원은 경보와 함께
      this.reinfOn = true;
      this.announce('적 증원 시작');
      sfx('bossIn');
    }
    this.reinfWave++;
    this.reinfT = Math.max(REINFORCE_MIN, REINFORCE_FIRST - this.reinfWave * 0.25);

    // 숫자로 밀어붙이면 화면도 프레임도 무너진다. 머릿수는 묶어 두고
    // 대신 한 마리 한 마리를 계속 세게 만든다.
    if (this.enemies.length >= REINFORCE_CAP) return;
    const mul = this.reinfMul();
    const n = 1 + Math.min(2, Math.floor(this.reinfWave / 5));
    let healers = 0;
    for (const e of this.enemies) if (!e.dead && e.ab.heal) healers++;
    for (let i = 0; i < n; i++) {
      const id = this.reinfPool[(this.reinfWave * 3 + i) % this.reinfPool.length];
      // 치유사가 이미 둘 서 있으면 더 보내지 않는다 — 치유사만 쌓이면 싸움이 끝나지 않는다
      if (ENEMIES[id].ab && ENEMIES[id].ab.heal && healers >= 2) continue;
      if (ENEMIES[id].ab && ENEMIES[id].ab.heal) healers++;
      this.spawnEnemy(id, ENEMY_SPAWN_X - Math.random() * 70, mul);
    }
    // 여섯 번에 한 번은 중장 병력도 딸려 온다. 다만 이미 버티고 선 보스가
    // 있으면 보내지 않는다. 겹쳐 쌓이면 아무도 뚫을 수 없는 벽이 된다.
    if (this.reinfWave % 6 === 0 && this.reinfHeavy.length) {
      let heavies = 0;
      for (const e of this.enemies) {
        if (!e.dead && (e.boss || (e.ab.armor || e.ab.kbImmune))) heavies++;
      }
      if (heavies < 2) {
        const b = this.reinfHeavy[(this.reinfWave / 6 - 1) % this.reinfHeavy.length];
        this.spawnEnemy(b, ENEMY_SPAWN_X, mul);
      }
    }
  }

  /* 증원이 거듭될수록 붙는 강화 배율 */
  reinfMul() { return Math.min(REINFORCE_MAX, 1 + this.reinfWave * REINFORCE_STEP); }

  /* 증원이 돌기 시작했는가 (HUD 에서 남은 적 대신 ∞ 를 띄운다) */
  reinforcing() { return this.reinfOn && !this.enemyCastle.dead; }

  /* ------------------- 보스 패턴 -------------------
   * phases: 체력이 특정 비율 아래로 떨어질 때 한 번씩 터지는 연출 겸 기술.
   * special: 일정 주기로 반복하는 고유 기술.
   * 두 가지 모두 bossAct 하나로 처리한다. */
  bossTick(f, dt) {
    if (f.veilT > 0) f.veilT -= dt;
    if (f.reflectT > 0) f.reflectT -= dt;
    if (f.exposedT > 0) f.exposedT -= dt;
    const ph = f.s.phases;
    if (ph) {
      const ratio = f.hp / f.maxHp;
      while (f.phaseIdx < ph.length && ratio <= ph[f.phaseIdx].at) {
        this.bossAct(f, ph[f.phaseIdx]);
        f.phaseIdx++;
      }
    }
    const sp = f.curSpecial || f.s.special;
    if (sp && f.stunT <= 0) {
      f.specialCd -= dt;
      if (f.specialCd <= 0) {
        f.specialCd = sp.cd || 10;
        this.bossAct(f, sp);
      }
    }
    if (f.guardCut > 0 || f.affixes) {                 // 4.21 수호 토템이 하나라도 서 있으면 받는 피해가 준다
      f.guardCut = 0;
      for (const e of this.enemies) if (!e.dead && e.guardOf === f) { f.guardCut = e.wardCut || 0; break; }
    }
    if (f.frenzyT > 0) {                               // 4.23 광폭: 시간이 다 되거나 기절하면 풀린다
      f.frenzyT -= dt;
      if (f.frenzyT <= 0 || f.stunT > 0) {
        if (f.stunT > 0) { this.announce('광폭이 풀렸다!', 1.4); this.fx.push({ type: 'poof', x: f.x, row: f.row, t: 0.45, life: 0.45, color: '#ff6b3c', big: true }); }
        f.frenzyT = 0; f.rateMul /= f.frenzyRate; f.speedMul /= f.frenzySpeed; f.frenzyRate = f.frenzySpeed = 1;
      }
    }
    if (f.affixes) {                                   // 4.21 보스 각인
      for (const ax of f.affixes) {
        if (f.stunT > 0 || f.windT > 0) continue;
        ax.cd -= dt;
        if (ax.cd <= 0) { ax.cd = ax.a.cd; this.bossAct(f, ax.a); }
      }
    }
  }

  announce(name, dur) {
    if (!name) return;
    this.patternName = name;
    this.patternT = dur || 1.7;
  }

  /* 보스 기술 한 방. 아군 보스도 같은 코드로 돌아간다. */
  bossAct(f, a) {
    const foes = this.foesOf(f.side);
    const r = a.r || 300;
    if (f.boss || f.side === 'ally') this.announce(a.name);      // 잡몹의 기술(조수 술사의 밀물)은 큰 글씨를 띄우지 않는다

    switch (a.t) {
      case 'roar': {                       // 포효: 밀어내고 기절
        for (const e of foes) {
          if (e.dead || Math.abs(e.x - f.x) > r) continue;
          if (a.stun) e.stun(a.stun);
          if (a.push && !e.ab.kbImmune) {
            e.x += f.dir * a.push; this.holdLine(e);
            e.kbTimer = Math.max(e.kbTimer, 0.2);
          }
          if (a.dmg) e.takeDamage(a.dmg);
        }
        this.fx.push({ type: 'cast', kind: f.boss ? 'shockwave' : 'tidal', x: f.x, row: f.row,
                       color: f.s.accent, r: r * 0.6, big: !!f.boss, dir: f.dir,
                       t: 0.7, life: 0.7 });
        this.shake = Math.max(this.shake, f.boss ? 14 : 5);
        if (f.boss) sfx('bossIn');
        break;
      }
      case 'enrage': {                     // 광폭화: 영구 강화
        f.enraged = true;
        if (a.atk) f.atk = Math.round(f.atk * a.atk);
        if (a.rate) f.rateMul *= a.rate;
        if (a.speed) f.speedMul *= a.speed;
        if (a.armor) f.ab = Object.assign({}, f.ab, { armor: a.armor });
        f.auraPulse = 1;
        this.fx.push({ type: 'cast', kind: 'firestorm', x: f.x, row: f.row,
                       color: '#ff6b3c', r: 120, big: true, dir: f.dir, t: 0.7, life: 0.7 });
        this.shake = Math.max(this.shake, 10);
        break;
      }
      case 'summon': {                     // 증원
        const n = a.n || 2;
        for (let i = 0; i < n; i++) {
          const sx = f.x - f.dir * (30 + i * 26);
          if (f.side === 'ally') {
            const u = UNIT_BY_ID[a.id];
            if (u && this.roomForSummon()) { const m = this.makeAlly(u, sx, f); m.summoned = true; this.allies.push(m); }
          } else {
            const m = this.spawnEnemy(a.id, sx); m.summoned = true; m.wave = f.wave;
          }
          this.fx.push({ type: 'spawn', x: sx, row: f.row, t: 0.4, life: 0.4 });
        }
        break;
      }
      case 'shield': {                     // 보호막
        f.giveBarrier(f.maxHp * (a.ratio || 0.15));
        this.fx.push({ type: 'aura', x: f.x, row: f.row, r: 90, t: 0.6, life: 0.6,
                       color: '#8fd8ff' });
        break;
      }
      case 'heal': {                       // 재생
        f.heal(f.maxHp * (a.ratio || 0.15));
        this.fx.push({ type: 'aura', x: f.x, row: f.row, r: 110, t: 0.6, life: 0.6,
                       color: '#7fe08e' });
        break;
      }
      case 'frost': {                      // 한파: 광역 둔화
        for (const e of foes) {
          if (e.dead || Math.abs(e.x - f.x) > r) continue;
          e.slowT = Math.max(e.slowT, a.dur || 4);
          this.fx.push({ type: 'chill', x: e.x, row: e.row, t: 0.4, life: 0.4 });
        }
        this.fx.push({ type: 'cast', kind: 'iceburst', x: f.x, row: f.row,
                       color: '#bfe9ff', r: r * 0.5, big: true, dir: f.dir, t: 0.6, life: 0.6 });
        break;
      }
      case 'drain': {                      // 흡수: 주변 적의 피를 빨아들인다
        let sum = 0;
        for (const e of foes) {
          if (e.dead || Math.abs(e.x - f.x) > r) continue;
          const d = a.dmg || 120;
          e.takeDamage(d);
          sum += d;
        }
        f.heal(sum * (a.ratio || 0.6));
        this.fx.push({ type: 'cast', kind: 'runes', x: f.x, row: f.row,
                       color: '#a06be0', r: r * 0.5, big: true, dir: f.dir, t: 0.6, life: 0.6 });
        break;
      }
      /* ---- 3.2 이벤트 보스 ---- */
      case 'veil': {                       // 안개화: 잠깐 안개가 되어 주변의 피를 빤다 (4.12: 무적은 없다)
        f.veilT = a.dur || 4;
        if (a.dmg) {
          let sum = 0;
          for (const e of foes) {
            if (e.dead || Math.abs(e.x - f.x) > r) continue;
            e.takeDamage(a.dmg); sum += a.dmg;
          }
          f.heal(Math.min(sum * (a.ratio || 0.5), f.maxHp * 0.05));   // 머릿수만큼 끝없이 차오르지 않게
        }
        this.fx.push({ type: 'cast', kind: 'runes', x: f.x, row: f.row, color: '#c0392b', r: r * 0.5, big: true, dir: f.dir, t: 0.7, life: 0.7 });
        break;
      }
      case 'reflect': {                    // 반사 결계: 이 동안 때리면 그대로 돌아온다
        f.reflectT = a.dur || 4;
        f.reflectRatio = a.ratio || 0.8;
        this.fx.push({ type: 'aura', x: f.x, row: f.row, r: 120, t: 0.7, life: 0.7, color: '#b784e0' });
        break;
      }
      case 'slam': {                       // 거대한 내려찍기: 예고 뒤 전열을 쓸고, 그 뒤 핵이 드러난다
        const front = this.frontline();
        const tx = Math.max(120, Math.min(WORLD - 120, Math.min(front, f.x - 40)));
        this.queueStrike(f, { x: tx, r: a.radius || 200, dmg: a.dmg || 800, warn: a.warn || 2.2,
                              stun: a.stun, kind: a.kind || 'shockwave', expose: a.expose });
        break;
      }
      case 'barrage': {                    // 출진 지점 포격: 막 나온 병사를 노린다
        const n = a.n || 4;
        for (let i = 0; i < n; i++) {
          // 성채(반경 60) 바로 앞부터 — 성채 자체는 맞히지 않는다. 노리는 건 갓 나온 병사다.
          const tx = (f.side === 'enemy' ? ALLY_SPAWN_X : ENEMY_SPAWN_X) + (f.side === 'enemy' ? 1 : -1) * (90 + i * (a.gap || 90));
          this.queueStrike(f, { x: Math.max(80, Math.min(WORLD - 80, tx)), r: a.radius || 90, dmg: a.dmg || 600,
                                warn: (a.warn || 2) + i * 0.1, burn: a.burn, stun: a.stun, kind: a.kind || 'firestorm', noCastle: true });
        }
        break;
      }
      case 'swap': {                       // 페이즈가 바뀌면 고유 기술도 바뀐다
        f.curSpecial = a.special;
        f.specialCd = (a.special && a.special.first) || 4;
        if (a.atk) f.atk = Math.round(f.atk * a.atk);
        if (a.speed) f.speedMul *= a.speed;
        if (a.core) f.ab = Object.assign({}, f.ab, { core: a.core });     // 마왕: 마지막 얼굴은 핵
        this.fx.push({ type: 'cast', kind: 'firestorm', x: f.x, row: f.row, color: '#ff3c3c', r: 140, big: true, dir: f.dir, t: 0.8, life: 0.8 });
        this.shake = Math.max(this.shake, 14);
        sfx('bossIn');
        break;
      }
      /* ---- 4.21 보스 각인 ---- */
      case 'charge': {                     // 돌진: 붉은 길 예고 → 내달려 길 위를 쓸고 밀쳐 낸다
        const dist = a.dist || 320;
        const x1 = f.side === 'enemy' ? Math.max(this.allyCastle.x + 260, f.x + f.dir * dist) : Math.min(this.enemyCastle.x - 260, f.x + f.dir * dist);   // 성채 코앞까지는 오지 않는다
        f.windT = a.warn || 1.6;
        // 피해는 보스 공격력이 아니라 맞는 병사 최대 체력의 비율 — 공격력이 큰 보스(거신)의 돌진이 전열을 통째로 지웠다
        this.pending.push({ t: f.windT, side: f.side, charge: true, src: f, x: x1, r: 0, ratio: a.ratio || 0.35, push: a.push || 70, stun: a.stun, row: f.row });
        this.fx.push({ type: 'chargeline', x: f.x, x2: x1, row: f.row, t: f.windT, life: f.windT, color: '#ff5a3c' });
        sfx('bossIn');
        break;
      }
      case 'clone': {                      // 분신: 약한 보스 둘 — 시간 안에 못 베면 보스에게 돌아가 체력을 채운다
        const st = Object.assign({}, f.s, { boss: false, phases: null, special: null, ab: { kbImmune: true }, gold: 0 });
        for (let i = 0; i < (a.n || 2); i++) {
          const c = this.spawnShadow(st, f.x + f.dir * (60 + i * 46), 1);
          c.maxHp = c.hp = Math.max(1, Math.round(f.maxHp * (a.hp || 0.07)));
          c.atk = c.baseAtk = Math.round(f.atk * (a.atk || 0.35));
          c.scale = c.baseScale = f.scale * 0.78; c.radius = 26 * c.scale;
          c.cloneOf = f; c.cloneT = a.life || 9; c.cloneHeal = a.heal || 0.06; c.kind = 'bossclone'; c.row = (f.row + 1 + i) % 3;
        }
        break;
      }
      case 'totem': {                      // 수호 토템: 보스 뒤에 박혀 서 있는 동안 보스가 받는 피해를 줄인다
        let have = 0;
        for (const e of this.enemies) if (!e.dead && e.guardOf === f) have++;
        for (let i = have; i < (a.n || 2); i++) {
          const home = f.side === 'enemy' ? this.enemyCastle.x - 50 : this.allyCastle.x + 50;   // 요새 뒤로는 박지 않는다 (닿을 수 없다)
          const x = f.side === 'enemy' ? Math.min(home, f.x - f.dir * (110 + i * 80)) : Math.max(home, f.x - f.dir * (110 + i * 80));
          const t = new Fighter(ENEMIES.wardtotem, f.side, x, null);
          t.maxHp = t.hp = Math.max(1, Math.round(f.maxHp * (a.hp || 0.05)));
          t.gold = 0; t.kind = 'wardtotem'; t.summoned = true; t.guardOf = f; t.wardCut = a.cut || 0.5; t.row = i % 3; t.side = f.side; t.dir = f.dir;
          f.guardCut = Math.max(f.guardCut || 0, t.wardCut);
          this.enemies.push(t);
          this.fx.push({ type: 'spawn', x: x, row: t.row, t: 0.5, life: 0.5, grand: true, color: '#ffd76a' });
        }
        break;
      }
      case 'doom': {                       // 사형 선고: 가장 강한 아군 하나에 낙인 — 시간이 되면 큰 피해
        let tgt = null, best = -1;
        for (const e of foes) {
          if (e.dead || e.summoned || e.burrowed) continue;
          const v = ((e.s.cost || 0) + 1) * e.maxHp;
          if (v > best) { best = v; tgt = e; }
        }
        if (!tgt) break;
        this.pending.push({ t: a.delay || 4, side: f.side, doom: true, src: f, tgt: tgt, ratio: a.ratio || 0.85, x: tgt.x, r: 0, row: tgt.row });
        this.fx.push({ type: 'doom', tgt: tgt, x: tgt.x, row: tgt.row, t: a.delay || 4, life: a.delay || 4 });
        this.announce('사형 선고: ' + tgt.s.name, 2.2);
        break;
      }
      case 'tax': {                        // 군자금 탈취: 몇 초 뒤 쌓인 군자금을 빼앗는다
        if (f.side !== 'enemy') break;
        this.pending.push({ t: a.delay || 3, side: f.side, tax: true, src: f, ratio: a.ratio || 0.5, x: this.allyCastle.x, r: 0, row: 1 });
        this.fx.push({ type: 'taxwarn', x: this.allyCastle.x + 40, row: 1, t: a.delay || 3, life: a.delay || 3 });
        this.announce('군자금 탈취 ' + (a.delay || 3) + '초 전! 지금 출진하라', 2.2);
        break;
      }
      case 'pull': {                       // 끌어당김: 앞의 병사를 보스 앞으로 끌어온 뒤 내려찍는다
        const r = a.r || 380;
        for (const e of foes) {
          if (e.dead || e.burrowed || e.ab.kbImmune || e.ab.hold) continue;
          const d = (e.x - f.x) * f.dir;
          if (d < 0 || d > r) continue;
          e.x = Math.max(60, Math.min(WORLD - 60, f.x + f.dir * (40 + Math.random() * 130)));   // 한 점에 뭉치지 않게 흩어 놓는다
          e.kbTimer = 0; e.flyT = 0; e.stun(0.5);
        }
        this.fx.push({ type: 'pullwave', x: f.x, row: f.row, r: r, dir: f.dir, t: 0.7, life: 0.7, color: f.s.accent });
        this.queueStrike(f, { x: Math.max(120, Math.min(WORLD - 120, f.x + f.dir * 80)), r: a.radius || 150, ratio: a.ratio || 0.3, dmg: 0,
                              warn: a.warn || 1.3, kind: 'shockwave', noCastle: true });
        break;
      }
      case 'starfall': {                   // 4.23 유성우: 아군이 모인 자리에 예고 → 최대 체력 비율 피해
        const xs = [];
        for (const e of foes) if (!e.dead && !e.burrowed && !e.isCastle) xs.push(e.x);
        if (!xs.length) break;
        xs.sort((p, q) => p - q);
        const rad = a.radius || 85, picks = [];
        // 가장 붐비는 자리부터: 둘레 rad 안의 병사 수가 많은 곳, 이미 고른 곳과는 2rad 떨어지게
        const score = x => { let n = 0; for (const v of xs) if (Math.abs(v - x) <= rad) n++; return n; };
        const cand = xs.map(x => [x, score(x)]).sort((p, q) => q[1] - p[1]);
        for (const [x] of cand) { if (picks.length >= (a.n || 4)) break; if (picks.every(p => Math.abs(p - x) >= rad * 2)) picks.push(x); }
        picks.forEach((x, i) => this.queueStrike(f, { x: Math.max(120, Math.min(WORLD - 120, x)), r: rad, ratio: a.ratio || 0.22, dmg: 0,
                                                     warn: (a.warn || 1.8) + i * 0.15, kind: 'firestorm', noCastle: true, star: true }));
        break;
      }
      case 'seal': {                       // 4.23 봉인: 가장 비싼 출진 카드 둘을 잠깐 묶는다
        if (f.side !== 'enemy') break;
        const ids = this.roster.map(r => r.id).filter(id => !(this.sealed[id] > 0) && this.stats(id))
          .sort((p, q) => this.stats(q).cost - this.stats(p).cost).slice(0, a.n || 2);
        if (!ids.length) break;
        for (const id of ids) this.sealed[id] = a.dur || 7;
        this.announce('봉인: ' + ids.map(id => this.stats(id).name).join(' · '), 2.2);
        this.fx.push({ type: 'aura', x: f.x, row: f.row, r: 120, t: 0.6, life: 0.6, color: '#9aa7ff' });
        sfx('zap');
        break;
      }
      case 'frenzy': {                     // 4.23 광폭: 잠깐 빨라진다 — 기절시키면 풀린다
        if (f.frenzyT > 0) break;
        f.frenzyT = a.dur || 7; f.frenzyRate = a.rate || 0.6; f.frenzySpeed = a.speed || 1.4;
        f.rateMul *= f.frenzyRate; f.speedMul *= f.frenzySpeed;
        this.fx.push({ type: 'aura', x: f.x, row: f.row, r: 100, t: 0.6, life: 0.6, color: '#ff6b3c' });   // 몸을 가리지 않게 작게 — 광폭은 몸에 감기는 불꽃으로 보인다
        this.shake = Math.max(this.shake, 6);
        break;
      }
      case 'inferno': {                    // 5.3 수르트: 불꽃 검을 치켜든다 — wind 초 안에 기절시키지 못하면 전장 전체가 불탄다
        if (f.side !== 'enemy') break;
        f.windT = a.wind || 4; f.stunImm = 0;          // 기절 보호를 걷는다 — 끊을 틈은 늘 있다
        this.pending.push({ t: f.windT, side: f.side, inferno: true, src: f, ratio: a.ratio || 0.4, burn: a.burn, x: f.x, r: 0, row: f.row });
        this.fx.push({ type: 'inferno', src: f, x: f.x, row: f.row, t: f.windT, life: f.windT, color: '#ff5a1e' });
        this.announce(a.name + ' — 기절로 끊으세요!', f.windT);
        this.shake = Math.max(this.shake, 6);
        sfx('bossIn');
        break;
      }
      case 'meteor': {                     // 예고 후 떨어지는 폭격
        const n = a.n || 3;
        const front = this.frontline();
        for (let i = 0; i < n; i++) {
          const tx = front + (i - (n - 1) / 2) * (a.gap || 130) + (Math.random() - 0.5) * 40;
          this.queueStrike(f, {
            x: Math.max(120, Math.min(WORLD - 120, tx)),
            r: a.radius || 110, dmg: (a.dmg || 300) * (this.endless ? Math.sqrt(Math.max(1, f.mul || 1)) : 1),   // 4.16 무한 전장은 웨이브만큼 아프다
            warn: (a.warn || 1.0) + i * 0.12,
            burn: a.burn, poison: a.poison, stun: a.stun, kind: a.kind || 'firestorm'
          });
        }
        break;
      }
    }
  }

  /* 5.3 9막 분화: 병사가 선 자리 몇 곳에 붉은 원 → 용암이 솟는다. 양쪽 모두 맞지만 용암 군단(lavaborn)은 멀쩡하다. */
  erupt(v) {
    const xs = [];
    for (const f of this.allies) if (!f.dead && !f.burrowed) xs.push(f.x);
    for (const f of this.enemies) if (!f.dead && !f.burrowed && !f.ab.hold) xs.push(f.x);
    const picks = [];
    for (let k = 0; k < 12 && picks.length < (v.n || 3); k++) {
      const x = xs.length ? xs[Math.floor(Math.random() * xs.length)] + (Math.random() - 0.5) * 60
                          : this.allyCastle.x + 300 + Math.random() * Math.max(200, this.enemyCastle.x - this.allyCastle.x - 600);
      if (picks.every(p => Math.abs(p - x) >= (v.r || 85) * 2)) picks.push(Math.max(this.allyCastle.x + 140, Math.min(this.enemyCastle.x - 140, x)));
    }
    picks.forEach((x, i) => {
      const w = (v.warn || 1.6) + i * 0.15;
      this.pending.push({ t: w, side: 'none', erupt: true, x: x, r: v.r || 85, ratio: v.ratio || 0.16, bossRatio: v.bossRatio || 0.03, burn: v.burn, row: 1 });
      this.fx.push({ type: 'warn', x: x, r: v.r || 85, t: w, life: w, lava: true, color: '#ff7a1e' });
    });
    if (picks.length && this.eruptN <= 1) this.announce('분화! 붉게 갈라진 땅을 조심하세요', 2.0);
    sfx('quake');
  }
  eruptLand(s) {
    for (const list of [this.allies, this.enemies]) for (const f of list) {
      if (f.dead || f.burrowed || f.ab.lavaborn || f.ab.hold || Math.abs(f.x - s.x) > s.r + f.radius) continue;
      f.takeDamage(f.maxHp * (f.boss ? s.bossRatio : s.ratio), true);
      if (s.burn) { if (f.burnT <= 0) f.burnDps = 0; f.burnT = Math.max(f.burnT, s.burn.dur); f.burnDps = Math.max(f.burnDps, s.burn.dps); }
    }
    this.fx.push({ type: 'cast', kind: 'eruption', x: s.x, row: 1, color: '#ff7a1e', r: s.r, big: true, dir: 1, t: 0.7, life: 0.7 });
    this.fx.push({ type: 'boom', x: s.x, r: s.r, t: 0.32, life: 0.32 });
  }
  /* 5.3 수르트의 불꽃 검이 내리꽂힌다: 아군 모두 최대 체력 비율 피해 + 화상 (성채는 멀쩡) */
  infernoLand(s) {
    const f = s.src;
    if (!f || f.dead) return;
    f.windT = 0;
    for (const a of this.allies) {
      if (a.dead || a.burrowed) continue;
      a.takeDamage(a.maxHp * s.ratio, true);
      if (s.burn) { if (a.burnT <= 0) a.burnDps = 0; a.burnT = Math.max(a.burnT, s.burn.dur); a.burnDps = Math.max(a.burnDps, s.burn.dps); }
    }
    this.fx.push({ type: 'firewave', x: f.x, row: f.row, dir: f.dir, t: 1.0, life: 1.0 });
    this.flash = Math.max(this.flash, 0.6);
    this.announce('무스펠의 불길이 전장을 덮었다', 1.8);
  }
  /* 끊었다: 불꽃이 꺼지고 거인이 비틀거린다 (3초 기절) */
  infernoBroken(f) {
    f.windT = 0;
    f.stunT = Math.max(f.stunT, 3); f.stunImm = Math.max(f.stunImm, 3 + STUN_GUARD_BOSS);
    this.fx.push({ type: 'poof', x: f.x, row: f.row, t: 0.6, life: 0.6, color: '#ffb35a', big: true });
    this.announce('끊었다! 불꽃이 꺼지고 거인이 비틀거린다', 2.0);
    sfx('zap');
  }
  /* 5.3 쌍왕: 한쪽이 쓰러졌는데 짝이 살아 있으면 window 초 뒤 되살아난다 — 둘을 함께 쓰러뜨려야 결계가 걷힌다 */
  twinHold(f) {
    const tw = f.ab.twin;
    if (!tw) return false;
    const mate = this.enemies.find(e => !e.dead && e.kind === tw.partner);
    if (!mate) { this.twinWait = this.twinWait.filter(w => w.id !== tw.partner); return false; }   // 둘 다 쓰러졌다
    this.twinWait.push({ id: f.kind, t: tw.window || 10, x: f.x, revive: tw.revive || 0.6 });
    mate.atk = Math.round(mate.atk * (tw.rage || 1.25));
    this.announce(f.s.name + ' 쓰러짐 — ' + (tw.window || 10) + '초 안에 ' + mate.s.name + '도 쓰러뜨려야 한다!', 2.4);
    return true;
  }
  twinTick(dt) {
    for (const w of this.twinWait) {
      w.t -= dt;
      if (w.t > 0) continue;
      w.done = true;
      const g = this.spawnEnemy(w.id, Math.min(this.enemyCastle.x - 120, Math.max(this.allyCastle.x + 300, w.x)));
      g.hp = Math.round(g.maxHp * w.revive);
      const nm = g.s.name, c = nm.charCodeAt(nm.length - 1);
      this.announce(nm + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이' : '가') + ' 되살아났다!', 2.2);   // 받침이 있으면 '이'
    }
    this.twinWait = this.twinWait.filter(w => !w.done);
  }

  /* 4.21 보스 각인의 예고가 끝났을 때. 크게 터졌으면 true (흔들림 · 폭음) */
  resolveAffix(s) {
    const f = s.src;
    if (!f || f.dead) return false;                  // 보스가 먼저 쓰러지면 없던 일
    if (s.charge) {
      // 들이받기: 예고한 길을 따라 달리다 맨 앞 병사에 부딪히면 거기서 멈추고, 부딪힌 자리 둘레를 치고 흩어지게 밀어낸다
      // (처음엔 길 위 병사를 모두 보스 코앞 한 점으로 밀어 넣어, 다음 범위 공격 한 방에 전열이 통째로 지워졌다)
      const foes = this.foesOf(f.side);
      let x1 = (s.x - f.x) * f.dir > 0 ? s.x : f.x;
      for (const e of foes) {
        if (e.dead || e.burrowed) continue;
        const d = (e.x - f.x) * f.dir;
        if (d > 0 && (x1 - f.x) * f.dir > d - f.radius) x1 = e.x - f.dir * f.radius;
      }
      if ((x1 - f.x) * f.dir < 0) x1 = f.x;                // 바로 앞에 붙어 있으면 뒤로 물러나지 않고 그 자리에서 부딪힌다
      for (const e of foes) {
        if (e.dead || e.burrowed || Math.abs(e.x - x1) > 140 + e.radius) continue;
        e.takeDamage(e.maxHp * s.ratio, true);
        if (!e.ab.kbImmune && !e.ab.hold) { e.x = Math.max(60, Math.min(WORLD - 60, e.x + f.dir * (40 + Math.random() * s.push))); e.kbTimer = 0.3; }
        if (s.stun) e.stun(s.stun);
      }
      f.x = x1;
      this.fx.push({ type: 'cast', kind: 'shockwave', x: x1, row: f.row, color: '#ff5a3c', r: 140, big: true, dir: f.dir, t: 0.6, life: 0.6 });
      this.fx.push({ type: 'boom', x: x1, r: 110, t: 0.32, life: 0.32 });
      return true;
    }
    if (s.doom) {
      const tg = s.tgt;
      if (!tg || tg.dead) return false;
      tg.takeDamage(tg.maxHp * s.ratio, true);
      this.fx.push({ type: 'cast', kind: 'runes', x: tg.x, row: tg.row, color: '#ff3c5a', r: 90, big: true, dir: 1, t: 0.6, life: 0.6 });
      this.fx.push({ type: 'boom', x: tg.x, r: 70, t: 0.32, life: 0.32 });
      return true;
    }
    if (s.tax) {
      const got = Math.floor(this.money * s.ratio);
      if (got <= 0) { this.announce('빼앗길 군자금이 없다!', 1.4); return false; }
      this.money -= got;
      this.fx.push({ type: 'coin', x: this.allyCastle.x + 40, row: 1, v: -got, t: 1.1, life: 1.1 });
      this.announce('군자금 -' + got, 1.6);
      sfx('zap');
      return false;
    }
    return false;
  }

  /* 예고 표시를 띄우고, 시간이 되면 그 자리에 내리꽂는다.
   * 무작정 터지지 않으니 피할 틈이 있다. */
  queueStrike(f, o) {
    this.pending.push({
      t: o.warn, side: f.side, x: o.x, r: o.r, dmg: o.dmg, ratio: o.ratio,
      burn: o.burn, poison: o.poison, stun: o.stun, kind: o.kind, color: f.s.accent, row: f.row,
      expose: o.expose, src: o.expose ? f : null, noCastle: !!o.noCastle,
      by: f.side === 'ally' ? (f.creditTo || f.s.id) : null
    });
    this.fx.push({ type: 'warn', x: o.x, r: o.r, t: o.warn, life: o.warn, star: !!o.star,
                   color: f.side === 'ally' ? '#6fc0ff' : '#e0503c' });
  }

  updatePending(dt) {
    if (!this.pending.length) return;
    let landed = false, quiet = false;      // quiet: 터지지 않고 끝난 예고(군자금 탈취 등)도 목록에서 빼야 한다
    for (const s of this.pending) {
      // 5.3 수르트의 불꽃 검: 치켜든 동안 기절시키면 끊긴다
      if (s.inferno && s.src && (s.src.dead || s.src.stunT > 0)) { s.done = quiet = true; if (!s.src.dead) this.infernoBroken(s.src); continue; }
      // 5.5 돌진: 힘을 모으는 동안 기절하면 끊긴다 (불꽃 검과 같이)
      if (s.charge && s.src && !s.src.dead && s.src.stunT > 0) {
        s.done = quiet = true; s.src.windT = 0;
        for (const e of this.fx) if (e.type === 'chargeline' && e.row === s.row && e.x2 === s.x) e.t = 0;
        continue;
      }
      s.t -= dt;
      if (s.t > 0) continue;
      if (s.erupt) { s.done = landed = true; this.eruptLand(s); continue; }
      if (s.inferno) { s.done = landed = true; this.infernoLand(s); continue; }
      if (s.charge || s.doom || s.tax) { s.done = true; quiet = true; if (this.resolveAffix(s)) landed = true; continue; }   // 4.21 보스 각인
      s.done = landed = true;
      const foes = this.foesOf(s.side);
      const castle = this.castleOf(s.side);
      for (const e of foes) {
        if (e.dead || Math.abs(e.x - s.x) > s.r + e.radius) continue;
        const got = e.takeDamage(s.ratio ? e.maxHp * s.ratio : s.dmg, !!s.ratio) || 0;   // 4.21 끌어당김: 최대 체력 비율
        if (s.by && got > 0) (this.meter[s.by] || (this.meter[s.by] = { dmg: 0, taken: 0, n: 0 })).dmg += got;
        if (s.burn) {
          if (e.burnT <= 0) e.burnDps = 0;
          e.burnT = Math.max(e.burnT, s.burn.dur);
          e.burnDps = Math.max(e.burnDps, s.burn.dps);
        }
        if (s.poison) {                  // 4.11 버섯 왕의 포자 폭탄
          if (e.poisonT <= 0) e.poisonDps = 0;
          e.poisonT = Math.max(e.poisonT, s.poison.dur);
          e.poisonDps = Math.max(e.poisonDps, s.poison.dps);
        }
        if (s.stun) e.stun(s.stun);
      }
      if (!s.noCastle && !castle.dead && Math.abs(castle.x - s.x) <= s.r + castle.radius) {
        const got = castle.takeDamage(s.dmg) || 0;
        if (s.by && got > 0) (this.meter[s.by] || (this.meter[s.by] = { dmg: 0, taken: 0, n: 0 })).dmg += got;
      }
      this.fx.push({ type: 'cast', kind: s.kind, x: s.x, row: s.row,
                     color: s.color, r: s.r, big: true, dir: 1, t: 0.6, life: 0.6 });
      this.fx.push({ type: 'boom', x: s.x, r: s.r, t: 0.32, life: 0.32 });
      // 내려찍은 뒤 잠깐 핵이 드러난다 — 액티브와 왕명을 아껴 둘 순간
      if (s.expose && s.src && !s.src.dead) {
        s.src.exposedT = s.expose;
        this.announce('약점 노출! 지금 집중 공격', 2.2);
      }
    }
    if (quiet && !landed) this.pending = this.pending.filter(s => !s.done);
    if (landed) {
      this.pending = this.pending.filter(s => !s.done);
      this.shake = Math.max(this.shake, 12);
      sfx('boom');
    }
  }

  /* 진영 기준으로 지금 살아 있는 적 목록과 성채를 돌려준다.
   * 발사체가 배열 참조를 들고 있으면 그 사이에 갈린 목록을 놓치게 된다. */
  foesOf(side) { return side === 'ally' ? this.enemies : this.allies; }
  castleOf(side) { return side === 'ally' ? this.enemyCastle : this.allyCastle; }

  findTarget(f, foes, foeCastle) {
    if (f.ab.noAttack) return null;
    const reach = f.attackRange * (this.storming && f.s.ranged && this.stage.storm ? this.stage.storm.range : 1) + f.radius;   // 4.15 모래폭풍
    // 성벽 파괴병: 병사는 거들떠보지 않고 성채만 노린다
    if (f.ab.sapper) {
      return (!foeCastle.dead && (foeCastle.x - f.x) * f.dir <= reach + foeCastle.radius) ? foeCastle : null;
    }
    let best = null, bestD = Infinity;
    // 비행선 폭격: 사거리 안에서 가장 먼(뒷줄) 적을 노린다
    const back = !!f.ab.backline;
    // 4.21 수호 토템: 원거리 병사는 사거리 안의 토템을 먼저 쏜다 (안내대로 '사거리 긴 병종' 이 받아치는 길) — 전엔 늘 가까운 보스만 쏴서
    // 범위 공격이 우연히 닿지 않으면 토템이 한 판 내내 서 있었다
    if (this.totemUp && f.s.ranged && f.side === 'ally') {
      let tot = null, td = Infinity;
      for (const e of foes) {
        if (e.dead || !e.guardOf) continue;
        const d = (e.x - f.x) * f.dir;
        if (d >= -f.radius && d <= reach + e.radius && d < td) { td = d; tot = e; }
      }
      if (tot) return tot;
    }
    for (const e of foes) {
      if (e.dead) continue;
      const d = (e.x - f.x) * f.dir;
      if (d < -f.radius || d > reach + e.radius) continue;
      // 4.11 홀림 장막(요정 숲): 가까이 다가와야만 보인다 — 멀리서 쏘는 병사는 고를 수 없다 (범위 피해는 그대로 맞는다)
      if (e.ab.glamour && d > e.ab.glamour + e.radius + f.radius) continue;
      if (back ? (best === null || d > -bestD) : d < bestD) { bestD = back ? -d : d; best = e; }
    }
    if (best) return best;
    if (!foeCastle.dead) {
      const d = (foeCastle.x - f.x) * f.dir;
      if (d <= reach + foeCastle.radius) return foeCastle;
    }
    return null;
  }

  rollDamage(f) {
    let dmg = f.atk;
    if (f.rallyT > 0) dmg *= f.rallyMul;                // 오딘의 지휘
    if (f.weakT > 0) dmg *= f.weakMul;                  // 액막이에 걸린 적
    let crit = false;
    if (f.ab.crit && Math.random() < f.ab.crit.chance) {
      dmg = Math.round(dmg * f.ab.crit.mul);
      crit = true;
    }
    return { dmg: dmg, crit: crit };
  }

  /* 병종별 필살 연출. 전설 병종은 화면 섬광까지 터진다. */
  castFx(f, x, row, crit) {
    const kind = f.s.castFx;
    if (!kind) return;
    const big = f.s.rarity === 'SSR';
    // 4.3 3진의 연출은 따로 센다: 보통 병사들의 연출에 밀려 전용 연출이 사라지면 안 된다
    const x3 = !!f.s.evo2;
    if (x3) this.x3Impact(f, kind, x, row);
    // 같은 순간에 연출이 몰리면 프레임이 무너진다. 살아 있는 수를 세어 막는다.
    let live = 0, liveBig = 0;
    for (const e of this.fx) {
      if (e.type !== 'cast' || !e.x3 !== !x3) continue;
      live++;
      if (e.big) liveBig++;
    }
    if (live >= CAST_LIMIT) return;
    if (big && liveBig >= CAST_BIG_LIMIT) return;
    this.fx.push({
      type: 'cast', kind: kind, x: x, row: row || 0,
      color: f.s.accent, r: f.s.areaRadius || 90, big: big, dir: f.dir, x3: x3,
      t: big ? 0.7 : 0.45, life: big ? 0.7 : 0.45
    });
    if (big) {
      // 섬광이 매 타격마다 덧씌워지면 화면이 계속 하얘지고 무거워진다
      if ((this.flash || 0) < 0.12) {
        this.flash = 0.28;
        this.flashColor = f.s.accent;
      }
      this.shake = Math.max(this.shake, 10);
    } else if (crit) {
      this.shake = Math.max(this.shake, 4);
    }
  }

  attack(f, target, foes, foeCastle) {
    if (f.ab.sapper) { this.sapperBlast(f, foes, foeCastle); return; }
    if (f.s.atkFx) this.x3AttackFx(f, target);
    const r = this.rollDamage(f);
    if (f.side === 'ally' && f.exposed) {
      r.dmg *= EXPOSED_MUL;                                      // 엄호 없는 원거리
      // 엄호 없이 멀리 쏠수록 더 빗나간다: 앞을 비워 두고 사거리 끝에서 두드리기만 하는 것을 누그러뜨린다
      const dist = Math.abs(target.x - f.x), k = dist / Math.max(1, f.attackRange);
      if (k > FALLOFF_FROM) r.dmg *= 1 - (1 - FALLOFF_MIN) * Math.min(1, (k - FALLOFF_FROM) / (1 - FALLOFF_FROM));
    }
    // 창기병 돌격: 달려온 첫 일격이 몇 배로 들어가고 적을 밀쳐 낸다
    let charged = false;
    if (f.ab.charge) {
      if (f.chargeDist >= f.ab.charge.dist) { r.dmg *= f.ab.charge.mul; charged = true; }
      f.chargeDist = 0;
    }
    if (charged && !target.isCastle) {
      if (!target.ab.kbImmune && !target.boss) {
        target.x += f.dir * f.ab.charge.push; this.holdLine(target);
        target.kbTimer = Math.max(target.kbTimer, 0.3);
      }
      this.fx.push({ type: 'cast', kind: 'shockwave', x: target.x, row: target.row, color: f.s.accent, r: 70,
                     big: false, dir: f.dir, t: 0.45, life: 0.45 });
      this.shake = Math.max(this.shake, 6);
    }
    if (f.s.ranged) {
      if (!f.s.atkFx) sfx('arrow');                       // 전차는 포성이 따로 울린다
      // 4.13 쏘는 순간의 섬광 (손 높이) — 빽빽할 땐 아낀다
      if (this.fx.length < FX_LIMIT * 0.6) this.fx.push({ type: 'release', x: f.x + f.dir * 16 * (f.scale || 1), row: f.row, dir: f.dir, color: f.s.accent, t: 0.13, life: 0.13 });
      this.shots.push({
        x: f.x, y0: f.row, tx: target.x, side: f.side, t: 0,
        dur: Math.max(0.18, Math.abs(target.x - f.x) / 900),
        color: f.s.accent, dmg: r.dmg, crit: r.crit, src: f, toCastle: !!target.isCastle,
        area: f.s.area, areaRadius: f.s.areaRadius, dir: f.dir
      });
      if (f.ab.salvo) this.fireSalvo(f, r.dmg, foes);
    } else {
      const cx = f.x + f.dir * f.attackRange * 0.6;
      if (f.s.area) this.areaHit(r.dmg, cx, f.s.areaRadius, foes, foeCastle, f, r.crit, f.side === 'ally' || !!target.isCastle);
      else this.hitOne(r.dmg, target, f, r.crit);
      this.castFx(f, target.x !== undefined ? target.x : cx, target.row, r.crit);
      this.fx.push({ type: r.crit ? 'crit' : 'hit', x: target.x, row: target.row ?? 1,
                     dir: f.dir, t: 0.22, life: 0.22, sty: 'melee', st: f.s, color: f.s.accent });
      sfx(f.s.area ? 'hit' : 'slash');
    }
  }

  /* 4.18 플라즈마 기동전차: every 번째 포격마다 측면 포드에서 미사일 n 발이 차례로 솟아 사거리 안의 적(보스 · 단단한 적 먼저)에게 꽂힌다 */
  fireSalvo(f, dmg, foes) {
    const sv = f.ab.salvo;
    f.salvoN = (f.salvoN || 0) + 1;
    if (f.salvoN % sv.every) return;
    const reach = f.attackRange * 1.1, pool = [];
    for (const e of foes) if (!e.dead && !e.burrowed && Math.abs(e.x - f.x) <= reach) pool.push(e);
    if (!pool.length) return;
    pool.sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || b.hp - a.hp);
    for (let k = 0; k < sv.n; k++) {
      const e = pool[k % pool.length];
      this.shots.push({ x: f.x - f.dir * 10, y0: f.row, tx: e.x + (k - (sv.n - 1) / 2) * 12, side: f.side, t: -k * 0.09,
                        dur: 0.55 + Math.abs(e.x - f.x) / 1400, color: f.s.accent, dmg: dmg * sv.mul, crit: false, src: f,
                        missile: true, area: true, areaRadius: sv.radius, dir: f.dir, toCastle: false });
    }
    f.podT = 0.6;                                     // 그림: 미사일 포드 덮개가 열린다
    sfx('rocket');
  }

  /* 성벽 파괴병: 성채에 닿으면 짊어진 화약을 터뜨린다. 보상도 없다. */
  sapperBlast(f, foes, foeCastle) {
    const sp = f.ab.sapper, dmg = sp.dmg * f.abMul;
    foeCastle.takeDamage(dmg);
    for (const a of foes) if (!a.dead && Math.abs(a.x - f.x) <= sp.radius + a.radius) a.takeDamage(dmg * 0.3);
    this.fx.push({ type: 'cast', kind: 'firestorm', x: f.x, row: f.row, color: '#ff8a3c', r: sp.radius * 1.4,
                   big: true, dir: f.dir, t: 0.6, life: 0.6 });
    this.fx.push({ type: 'boom', x: f.x, r: sp.radius, t: 0.4, life: 0.4 });
    this.shake = Math.max(this.shake, 14);
    sfx('boom');
    f.hp = 0; f.dead = true; f.exploded = true;
  }

  /* 사슬 간수: 뒤에서 쏘는 아군을 갈고리로 끌어와 기절시킨다 */
  tryHook(f, foes, dt) {
    f.hookCd -= dt;
    if (f.hookCd > 0) return;
    const hk = f.ab.hook;
    let best = null, bd = 120;
    for (const e of foes) {
      if (e.dead || !e.s.ranged || e.ab.kbImmune || e.ab.hold) continue;
      const d = (e.x - f.x) * f.dir;
      if (d > bd && d <= hk.range) { bd = d; best = e; }
    }
    if (!best) { f.hookCd = 1; return; }
    f.hookCd = hk.cd;
    const from = best.x;
    best.x = Math.max(60, Math.min(WORLD - 60, f.x + f.dir * 40));
    best.stun(hk.stun);
    f.swing = 0.22;
    this.fx.push({ type: 'chain', x: f.x, x2: from, row: f.row, row2: best.row, t: 0.45, life: 0.45 });
    this.fx.push({ type: 'poof', x: best.x, row: best.row, t: 0.35, life: 0.35, color: '#9aa3ab' });
    this.shake = Math.max(this.shake, 4);
    sfx('slash');
  }

  /* 단일 대상 타격 + 부가 효과 */
  hitOne(dmg, target, src, crit) {
    // 회피: 원숭이·분신·무승은 가끔 몸을 빼 흘려보낸다
    if (!target.isCastle && target.ab.dodge && src && Math.random() < target.ab.dodge) {
      this.fx.push({ type: 'miss', x: target.x, row: target.row, t: 0.5, life: 0.5 });
      return;
    }
    let pierce = false;
    // 매 조련사: 뒤에서 쏘는 적을 더 세게 친다
    if (src && src.ab.hunter && !target.isCastle && target.s.ranged) dmg *= src.ab.hunter;
    // 거울 마녀: 원거리 공격은 반쯤 막고 일부를 되쏜다
    let mirror = null;
    if (src && src.s.ranged && !target.isCastle && target.ab.mirror && src.side !== target.side) {
      mirror = target.ab.mirror;
      dmg *= 1 - mirror.cut;
    }
    if (src && src.ab.breaker && !target.isCastle) {
      // 파쇄: 갑주를 무시하고, 보스·중장갑·넉백 면역에게는 더 세게 들어간다
      pierce = true;
      const ta = target.ab;
      if (target.boss || ta.armor || ta.kbImmune) dmg *= src.ab.breaker;
    }
    if (!target.isCastle && target.ab.lavaborn && target.slowT > 0 && src && src.side !== target.side) dmg *= LAVA_FROST_MUL;   // 5.3 식은 용암은 부서진다
    // 영웅 사냥꾼: 적이 비싼(비용 350 이상) 아군 — 영웅·전설·신화 — 을 골라 두 배로 친다
    // 3.9: 사냥꾼은 영웅을 잡는 데 이골이 나 있다 — 갑주를 꿰뚫고, 선봉의 보호도 통하지 않는다
    // 4.2: 병종 본래 비용으로 본다 — 3진의 출진 비용 +30% 때문에 전차·레일건 같은 전장 병종이 '영웅' 으로 잡혀 4배로 맞았다
    const hunted = this.mods && this.mods.giantslayer && src && src.side === 'enemy' &&
        !target.isCastle && target.side === 'ally' && ((target.s.base || target.s).cost || 0) >= HUNT_COST;
    if (hunted) { dmg *= HUNT_MUL; pierce = true; }
    // 3.9 선봉: 근접 영웅 곁의 아군은 적에게 덜 아프게 맞는다 (영웅 자신 포함)
    if (!hunted && src && src.side === 'enemy' && !target.isCastle && target.side === 'ally' && this.vanguards && this.vanguards.length) {
      for (const v of this.vanguards) {
        if (!v.dead && Math.abs(v.x - target.x) <= v.ab.vanguard.r) { dmg *= 1 - v.ab.vanguard.cut; break; }
      }
    }
    // 반사 결계: 결계가 선 동안 때린 만큼 때린 자에게 돌아간다 (보스는 조금만 받는다)
    if (target.reflectT > 0 && src && src.side !== target.side && !src.dead && !target.isCastle) {
      const ab = target.reflectRatio || 0.8;
      src.takeDamage(dmg * ab);
      dmg *= 1 - ab;
      if (!this._reflFx || this._reflFx < this.time) {
        this._reflFx = this.time + 0.12;
        this.fx.push({ type: 'mirror', x: target.x, x2: src.x, row: target.row, row2: src.row, t: 0.3, life: 0.3 });
      }
    }
    const dealt = target.takeDamage(dmg, pierce) || 0;
    if (dealt > 0) {
      if (src && src.side === 'ally' && src.s) this.meterRow(src).dmg += dealt;
      if (target.side === 'ally' && !target.isCastle) this.meterRow(target).taken += dealt;
    }
    if (mirror && dealt > 0 && !src.dead) {
      src.takeDamage(Math.min(120, dealt * mirror.reflect));
      this.fx.push({ type: 'mirror', x: target.x, x2: src.x, row: target.row, row2: src.row, t: 0.3, life: 0.3 });
    }
    // 금화 도둑: 때릴 때마다 군자금을 훔친다 (쓰러뜨리면 돌려받는다)
    if (src && src.ab.thief && src.side === 'enemy' && target.side === 'ally' && !src.dead) {
      const take = Math.min(this.money, src.ab.thief.steal);
      if (take > 0) {
        this.money -= take; src.stolen += take;
        this.fx.push({ type: 'coin', x: target.x, row: target.row === undefined ? 1 : target.row, v: -Math.round(take), t: 0.8, life: 0.8 });
      }
    }
    // 저팔계: 쓰러뜨린 만큼 배를 채운다
    if (src && src.ab.feast && dealt > 0 && target.dead && !target.isCastle) src.heal(src.maxHp * src.ab.feast);
    if (src && src.ab.sunmark && !target.isCastle && !target.dead) {
      target.vulnT = Math.max(target.vulnT, src.ab.sunmark.dur);
      target.vulnMul = Math.max(target.vulnMul, 1 + src.ab.sunmark.vuln);
    }
    if (src && src.ab.chain && !target.isCastle && !this._chaining) this.chainFrom(src, target, dmg);
    if (target.isCastle) {
      if (target.side === 'ally') this.shake = Math.max(this.shake, 8);
    } else if (dealt >= 1 && this.dmgFxCount < 14) {
      // 4.13 방금 같은 적에게 뜬 숫자가 있으면 거기에 더한다 (범위 공격 · 여럿이 한꺼번에 칠 때 숫자 탑이 쌓이지 않게)
      // 4.13 숫자 자리 흔들기는 보기용 난수(visRand)로 — 표시 방식이 바뀌어도 전투의 난수 흐름(=결과)은 그대로다
      const jx = visRand(), jy = visRand();
      let merged = null;
      for (const e of this.fx) if (e.type === 'dmg' && e.tgt === target && e.t > 0.55 && e.crit === !!crit) { merged = e; break; }
      if (merged) { merged.v += Math.round(dealt); merged.bump = 0.12; }
      else {
        this.dmgFxCount++;
        // 3.14: 같은 순간 같은 적에게 들어간 숫자는 한 줄씩 위로 (예전엔 '261999' 처럼 겹쳐 읽혔다)
        // 4.13 옆에 붙어 선 다른 적의 숫자도 피해 위로 쌓고, 좌우로 번갈아 비켜 놓는다
        let lift = 0;
        for (const e of this.fx) if (e.type === 'dmg' && e.t > 0.4 && Math.abs(e.x - target.x) < 34) lift++;
        this.fx.push({ type: 'dmg', x: target.x + (jx - 0.5) * 16 + (lift ? (lift % 2 ? 14 : -14) : 0),
                       row: target.row, v: Math.round(dealt), dy: jy * 6 + Math.min(lift, 4) * 15,
                       crit: !!crit, ally: target.side === 'ally', tgt: target, t: 0.65, life: 0.65 });
      }
    }
    if (!src) return;
    if (!target.isCastle && target.ab.thorns && !src.s.ranged && !src.dead && dealt > 0) {
      src.takeDamage(Math.min(80, dealt * target.ab.thorns));
      this.fx.push({type:'hit',x:src.x,row:src.row,dir:target.dir,t:.18,life:.18});
    }
    const ab = src.ab;
    if (ab.lifesteal) src.heal(dealt * ab.lifesteal);
    if (target.isCastle || target.dead) return;
    if (ab.slow) {
      target.slowT = Math.max(target.slowT, ab.slow);
      this.fx.push({ type: 'chill', x: target.x, row: target.row, t: 0.4, life: 0.4 });
    }
    if ((ab.poison || ab.burn) && src.side === 'ally') target.dotBy = src.creditTo || src.s.id;
    if (ab.poison) {
      if (target.poisonT <= 0) target.poisonDps = 0;
      target.poisonT = Math.max(target.poisonT, ab.poison.dur);
      target.poisonDps = Math.max(target.poisonDps, ab.poison.dps * src.abMul);
    }
    if (ab.burn) {
      if (target.burnT <= 0) target.burnDps = 0;
      target.burnT = Math.max(target.burnT, ab.burn.dur);
      target.burnDps = Math.max(target.burnDps, ab.burn.dps * src.abMul);
    }
    if (ab.stun && Math.random() < ab.stun.chance) {
      if (target.stun(ab.stun.dur)) {
        this.fx.push({ type: 'stun', x: target.x, row: target.row, t: 0.5, life: 0.5 });
        if (ab.petrify) target.petrifyUntil = this.time + ab.stun.dur;   // 5.2 석화의 여제: 굳은 적은 잿빛 돌이 된다 (보기)
      }
      else if (target.resistFx && this.dmgFxCount < 14) this.fx.push({ type: 'miss', text: '기절 면역', x: target.x, row: target.row, t: 0.5, life: 0.5 });
      target.resistFx = false;
    }
    if (ab.push && !target.ab.kbImmune && !target.isCastle) {
      if (!target.boss) {
        target.x += src.dir * ab.push * 0.01 * 60;
        this.holdLine(target);
        target.kbTimer = Math.max(target.kbTimer, 0.12);
      } else if (this.time >= target.shoveT) {
        // 4.23 보스는 버틴다: 밀치기는 1초에 한 번만, 밀려도 공격은 끊기지 않는다.
        // 예전엔 드릴 창병이 여럿 붙어 칠 때마다 0.12초씩 넉백이 걸려 보스가 거의 때리지 못하고 뒤로만 밀렸다
        target.x += src.dir * ab.push * 0.01 * 60 * BOSS_PUSH_TAKEN;
        this.holdLine(target);
        target.shoveT = this.time + BOSS_SHOVE_GAP;
      }
    }
    if (ab.weaken) {                              // 액막이: 이 적이 주는 피해가 준다
      target.weakT = Math.max(target.weakT, ab.weaken.dur);
      target.weakMul = Math.min(target.weakMul, ab.weaken.mul);
    }
    if (ab.charm && !target.boss && !(target.charmGuard > this.time) && Math.random() < ab.charm.chance * (1 - (target.ab.charmResist || 0))) {
      target.charmT = Math.max(target.charmT, ab.charm.dur);
      this.fx.push({ type: 'charm', x: target.x, row: target.row, t: 0.7, life: 0.7 });
    }
    if (ab.bounty && src.side === 'ally' && Math.random() < ab.bounty.chance) {
      this.money = Math.min(this.walletMax, this.money + ab.bounty.gold);
      this.fx.push({ type: 'coin', x: target.x, row: target.row, v: ab.bounty.gold, t: 0.8, life: 0.8 });
    }
    if (ab.execute) this.tryExecute(target, ab.execute);
  }

  /* 저승사자: 명부에 오른(체력이 낮은) 적은 그 자리에서 거둔다. 보스는 예외. */
  tryExecute(target, pct) {
    if (target.dead || target.isCastle || target.boss) return false;
    if (target.hp > target.maxHp * pct) return false;
    target.hp = 0;
    target.dead = true;
    this.fx.push({ type: 'reap', x: target.x, row: target.row, t: 0.6, life: 0.6 });
    return true;
  }

  /* 홀린 적: 가장 가까운 제 편을 친다 */
  charmedTick(f, list, dt) {
    f.cd -= dt;
    let best = null, bd = Infinity;
    const reach = Math.max(80, f.attackRange);
    for (const e of list) {
      if (e === f || e.dead) continue;
      const d = Math.abs(e.x - f.x);
      if (d <= reach && d < bd) { bd = d; best = e; }
    }
    if (!best || f.cd > 0) return;
    f.cd = f.intervalNow;
    f.swing = 0.22;
    this.hitOne(f.atk, best, null, false);
    this.fx.push({ type: 'hit', x: best.x, row: best.row, dir: -f.dir, t: 0.2, life: 0.2,
                   big: !!(f.boss || f.s.gacha || f.s.bigEvo || f.scale >= 1.4), color: f.s.accent });
  }

  /* 제우스의 연쇄 번개. 맞은 적에서 가까운 적으로 줄줄이 옮겨 가며 약해진다.
   * 떼에는 강하고 단단한 한 놈에게는 약하다. */
  chainFrom(src, first, dmg) {
    const c = src.ab.chain;
    const foes = this.foesOf(src.side);
    const hit = [first];
    let from = first, d = dmg;
    this._chaining = true;
    for (let k = 0; k < c.n; k++) {
      d *= c.fall;
      let best = null, bd = Infinity;
      for (const e of foes) {
        if (e.dead || hit.indexOf(e) >= 0) continue;
        const dist = Math.abs(e.x - from.x);
        if (dist <= c.range && dist < bd) { bd = dist; best = e; }
      }
      if (!best) break;
      this.hitOne(d, best, src, false);
      this.fx.push({ type: 'beam', x: from.x, x2: best.x, row: best.row, t: 0.16, life: 0.16,
                     color: src.s.accent });
      hit.push(best);
      from = best;
    }
    this._chaining = false;
  }

  /* castleOk: 성채까지 튀김 피해를 줄지. 적이 아군 병사를 노린 범위 공격은 바로 뒤 성채까지
   * 번지지 않는다 (3.2.1: 갓 나온 병사를 노린 투석이 성채를 갉아 별 3개를 못 받던 것) */
  areaHit(dmg, cx, radius, foes, foeCastle, src, crit, castleOk = true) {
    for (const e of foes) {
      if (e.dead) continue;
      if (Math.abs(e.x - cx) <= radius + e.radius) this.hitOne(dmg, e, src, crit);
    }
    if (castleOk && foeCastle && !foeCastle.dead && Math.abs(foeCastle.x - cx) <= radius + foeCastle.radius) {
      foeCastle.takeDamage(dmg);
    }
    this.fx.push({ type: 'boom', x: cx, r: radius, t: 0.32, life: 0.32 });
    sfx('boom');
    if (radius > 120) this.shake = Math.max(this.shake, 7);
  }

  /* 관통: 사수와 착탄점 사이의 모든 적을 꿰뚫는다 */
  pierceHit(shot) {
    const from = Math.min(shot.x, shot.tx), to = Math.max(shot.x, shot.tx);
    const foes = this.foesOf(shot.side);
    const castle = this.castleOf(shot.side);
    let hits = 0;
    for (const e of foes) {
      if (e.dead) continue;
      if (e.x >= from - 30 && e.x <= to + 30) { this.hitOne(shot.dmg, e, shot.src, shot.crit); hits++; }
    }
    if (!castle.dead && castle.x >= from - 40 && castle.x <= to + 40) {
      castle.takeDamage(shot.dmg);
    }
    this.fx.push({ type: 'beam', x: shot.x, x2: shot.tx, row: shot.y0, t: 0.22, life: 0.22,
                   color: shot.color });
    return hits;
  }

  updateShots(dt) {
    let anyDone = false;
    for (const s of this.shots) {
      s.t += dt;
      if (s.t < s.dur) continue;
      s.done = anyDone = true;
      const ab = (s.src && s.src.ab) || {};
      const foes = this.foesOf(s.side);
      const castle = this.castleOf(s.side);
      if (s.missile) { if (this.fx.length < FX_LIMIT * 0.7) this.fx.push({ type: 'cast', kind: 'missilehit', x: s.tx, row: s.y0, color: s.color, r: s.areaRadius, big: false, dir: s.dir, t: 0.4, life: 0.4 }); sfx('hit'); }
      else if (s.src) this.castFx(s.src, s.tx, s.y0, s.crit);
      if (ab.pierce) { this.pierceHit(s); continue; }
      if (s.area) {
        this.areaHit(s.dmg, s.tx, s.areaRadius, foes, castle, s.src, s.crit, s.side === 'ally' || s.toCastle);
        continue;
      }
      let hit = null, bd = Infinity;
      for (const e of foes) {
        if (e.dead) continue;
        const d = Math.abs(e.x - s.tx);
        if (d < bd && d < 90) { bd = d; hit = e; }
      }
      // 노린 병사가 날아가는 사이 쓰러졌을 때: 적의 화살은 성채로 새지 않는다
      if (!hit && !castle.dead && Math.abs(castle.x - s.tx) < 110 && (s.side === 'ally' || s.toCastle)) hit = castle;
      if (hit) this.hitOne(s.dmg, hit, s.src, s.crit);
      this.fx.push({ type: s.crit ? 'crit' : 'hit', x: hit ? hit.x : s.tx, row: hit ? (hit.row ?? s.y0) : s.y0, dir: s.dir, t: 0.22, life: 0.22, sty: 'shoot', color: s.color });
    }
    if (anyDone) this.shots = this.shots.filter(s => !s.done);
  }

  updateFx(dt) {
    // 5.5: 매 프레임 새 배열을 만들지 않고 제자리에서 줄인다
    const fx = this.fx;
    let n = 0, dmg = 0;
    for (let i = 0; i < fx.length; i++) {
      const e = fx[i];
      e.t -= dt;
      if (e.t > 0) { fx[n++] = e; if (e.type === 'dmg') dmg++; }
    }
    fx.length = n;
    if (n > FX_LIMIT) {
      fx.splice(0, n - FX_LIMIT);
      dmg = 0;
      for (const e of fx) if (e.type === 'dmg') dmg++;
    }
    this.dmgFxCount = dmg;
    if (this.state !== 'play') this.resultTime = (this.resultTime || 0) + dt;
  }

  /* 무한 전장: 앞으로 나올 적이 이만큼 줄면 다음 웨이브를 붙인다 */
  extendEndless() {
    while (this.queue.length - this.qi < 24) {
      const spec = endlessWave(this.endlessW, this.endlessT);
      const add = [];
      spec.waves.forEach(w => {
        for (let i = 0; i < w.n; i++) add.push({ t: w.t + i * w.gap, e: w.e, wave: w.wave, mul: w.mul });
      });
      add.sort((a, b) => a.t - b.t);
      add.forEach(x => this.queue.push(x));
      this.endlessT = spec.next;
      this.endlessW++;
    }
  }

  /* 지금 싸우는 무한 전장 웨이브 (1부터) */
  currentWave() {
    const e = this.queue[Math.max(0, this.qi - 1)];
    return e ? e.wave + 1 : 1;
  }

  /* 무한 전장에서 지금까지 넘긴 웨이브 수 */
  wavesDone() {
    if (!this.endless) return 0;
    const pending = new Set(this.queue.slice(this.qi).map(e => e.wave));
    const alive = new Set(this.enemies.concat(this.burrowers).filter(e => !e.dead).map(e => e.wave));
    let cleared = 0;
    for (const wave of new Set(this.queue.map(e => e.wave))) {
      if (pending.has(wave) || alive.has(wave)) break;
      cleared++;
    }
    return cleared;
  }

  nextWave() {
    const entry = this.queue[this.qi];
    if (entry) {
      return { name: ENEMIES[entry.e].name, boss: !!ENEMIES[entry.e].boss,
               seconds: Math.max(0, Math.ceil(entry.t - this.time)) };
    }
    // 대본 웨이브가 동나면 그 다음은 언제나 증원이다. 끝이 아니라는 걸 알려 준다.
    if (this.endless || this.enemyCastle.dead) return null;
    const heavy = this.reinfHeavy.length && (this.reinfWave + 1) % 6 === 0;
    const id = heavy
      ? this.reinfHeavy[((this.reinfWave + 1) / 6 - 1) % this.reinfHeavy.length]
      : this.reinfPool[((this.reinfWave + 1) * 3) % this.reinfPool.length];
    const spec = ENEMIES[id];
    return { name: (spec ? spec.name : '적') + ' 증원', boss: heavy, reinforce: true,
             seconds: Math.max(0, Math.ceil(this.reinfT)) };
  }

  /* 남은 적 = 아직 등장하지 않은 적 + 전장에 있는 적 */
  foesLeft() { return (this.queue.length - this.qi) + this.enemies.length + this.burrowers.length; }

  /* 땅굴 고블린: 땅속으로 기어 오다가 아군 전열(또는 성채) 코앞에서 튀어나온다.
   * 튀어나오며 주변 아군을 잠깐 기절시키고, 그때부터는 여느 적과 같다. */
  stepBurrowers(dt) {
    const keep = [];
    for (const b of this.burrowers) {
      b.bob += dt * 3;
      b.x += b.dir * b.speedNow * dt;
      let near = Math.abs(b.x - this.allyCastle.x) <= 90;
      for (const a of this.allies) if (!a.dead && Math.abs(a.x - b.x) <= 70) { near = true; break; }
      if (!near) { keep.push(b); continue; }
      b.burrowed = false;
      const bw = b.ab.burrow;
      for (const a of this.allies) {
        if (a.dead || a.ab.kbImmune || Math.abs(a.x - b.x) > bw.radius) continue;
        a.stun(bw.stun);
      }
      this.fx.push({ type: 'boom', x: b.x, r: bw.radius, t: 0.35, life: 0.35 });
      this.fx.push({ type: 'poof', x: b.x, row: b.row, t: 0.5, life: 0.5, color: '#8a6a3a', big: true });
      this.shake = Math.max(this.shake, 5);
      this.enemies.push(b);
    }
    this.burrowers = keep;
  }

  /* 요새 반격: 요새 체력이 정해진 선 아래로 떨어지면 충격파로 가까운 아군을
   * 밀어내고 숨겨 둔 수비대를 쏟아낸다. 한 선마다 한 번. */
  checkSally() {
    const list = this.stage.sally;
    const c = this.enemyCastle;
    while (this.sallyDone < list.length && !c.dead && c.hp / c.maxHp <= list[this.sallyDone].at) {
      const sy = list[this.sallyDone++];
      for (const a of this.allies) {
        if (a.dead || a.ab.hold || Math.abs(c.x - a.x) > 380) continue;
        a.stun(0.4);
        if (a.ab.kbImmune) continue;
        a.x -= 140; this.holdLine(a);
        a.kbTimer = Math.max(a.kbTimer, 0.42);
      }
      sy.group.forEach(([id, n]) => {
        // 4.18 하드코어: 수비대도 하드코어 배율을 받으니 머릿수는 줄인다 (다 키운 편성 40명이 몇 초 만에 쓸려 나갔다)
        const cnt = this.hard ? Math.max(1, Math.round(n * HARDCORE.sally)) : n;
        for (let k = 0; k < cnt; k++) this.spawnEnemy(id, ENEMY_SPAWN_X - k * 24 - Math.random() * 20);
      });
      this.fx.push({ type: 'cast', kind: 'shockwave', x: c.x - 60, row: 1, color: '#ffb45a', r: 260,
                     big: true, dir: -1, t: 0.7, life: 0.7 });
      this.shake = Math.max(this.shake, 12);
      this.announce('요새 반격!', 2);
      sfx('bossIn');
    }
  }

  /* 고블린 암살자: 전열 가까이 오면 한 번 뛰어올라 뒤쪽의 원거리 병사 곁에 내려앉는다 */
  tryLeap(f, foes) {
    const lp = f.ab.leap;
    let front = Infinity;
    for (const e of foes) {
      if (e.dead) continue;
      const d = (e.x - f.x) * f.dir;
      if (d > 0 && d < front) front = d;
    }
    if (front > lp.trigger) return;
    f.leapt = true;
    let target = null, td = -1;
    for (const e of foes) {
      if (e.dead || !e.s.ranged || e.ab.hold) continue;
      const d = (e.x - f.x) * f.dir;
      if (d > front && d <= lp.range && d > td) { td = d; target = e; }
    }
    if (!target) return;
    const from = f.x;
    f.x = target.x - f.dir * 30;
    f.cd = Math.min(f.cd, 0.2);
    this.fx.push({ type: 'leap', x: from, x2: f.x, row: f.row, t: 0.35, life: 0.35 });
    this.fx.push({ type: 'poof', x: f.x, row: f.row, t: 0.35, life: 0.35, color: '#c0392b' });
  }
  foesTotal() { return this.queue.length; }

  aliveBoss() {
    let best = null;
    for (const e of this.enemies) {
      if (e.boss && !e.dead && (!best || e.maxHp > best.maxHp)) best = e;
    }
    return best;
  }

  frontline() {
    let front = ALLY_SPAWN_X + 260;
    for (const a of this.allies) front = Math.max(front, a.x);
    let back = ENEMY_SPAWN_X;
    for (const e of this.enemies) back = Math.min(back, e.x);
    if (this.enemies.length) return (front + back) / 2;
    return front;
  }
}
