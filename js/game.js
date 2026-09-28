/* =======================================================================
 *  막대 왕국 전쟁 - 전투 엔진 (라인 배틀 + 특수 능력)
 * ======================================================================= */

/* 전장 가로 길이(월드 좌표). 전장마다 다르다(STAGES[i].len).
 * 적 요새·적 출진 위치가 길이에 매여 있어서 전투를 만들 때 함께 맞춘다. */
const WORLD_DEFAULT = 2000;
let WORLD = WORLD_DEFAULT;
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
const _sfxGap = { slash: 90, hit: 90, arrow: 110, boom: 140, die: 120, deploy: 40, gold: 200 };
function sfx(name) {
  if (typeof SFX === 'undefined' || !SFX.ready || !SFX.on) return;
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  const gap = _sfxGap[name] || 0;
  if (gap && _sfxAt[name] && now - _sfxAt[name] < gap) return;
  _sfxAt[name] = now;
  const fn = SFX[name];
  if (fn) fn.call(SFX);
}

const FX_LIMIT = 200;        // 이펙트가 무한정 쌓이지 않게
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
const HUNT_MUL = 3;
const CURSE_HEAL = 0.5;       // 저주: 아군 회복·흡혈 배율
const CURSE_WITHER = 0.1;     // 저주: 소환물이 초당 잃는 최대 체력 비율
const SLOW_SPEED_MUL = 0.45; // 둔화 시 이동
const SLOW_RATE_MUL = 1.7;   // 둔화 시 공격 간격
/* 3.0: 기절이 풀리면 잠깐은 다시 기절하지 않는다. 기절을 거는 병사를 줄지어 세워
 * 적을 영원히 굳히던 것(메두사 열 명)을 막는다. 보스는 짧게 기절하고 오래 버틴다. */
const STUN_GUARD = 1.2;
const STUN_GUARD_BOSS = 2.5;
const WARD_FLOOR = 0.05;     // 보스가 살아 있는 동안 적 요새는 이 아래로 무너지지 않는다
const CHRONO_RATE = 0.6;     // 시간 주술사가 살아 있으면 카드 재사용 대기가 이 속도로 준다
const BOSS_MUL_EXP = 0.5;    // 캠페인 보스가 받는 전장 배율의 지수
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
  }

  /* 기절. 면역 중이거나 부동심이면 걸리지 않는다. 걸렸으면 true */
  stun(d) {
    if (this.dead || !(d > 0) || this.ab.unshakable || this.stunImm > 0) return false;
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
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount * this.healMul);
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
    // 하드코어: 돌파한 전장을 더 모질게 (적 ×1.5 · 특성 하나 더 · 성채 60% · 왕명 느림)
    this.hard = !!(opts && opts.hard) && !this.endless;
    this.enemyMulBase = this.hard ? hardcoreEnemyMul(this.stage) : (this.stage.enemyMul || 1);

    const up = save.upgrades;
    this.buff = {
      hp: 1 + 0.08 * (up.vitality || 0),
      atk: 1 + 0.06 * (up.power || 0)
    };
    this.levels = save.levels || {};

    this.walletMax = 900 + 260 * (up.wallet || 0);
    this.income = this.stage.rate * (1 + 0.12 * (up.income || 0));
    this.cdMul = Math.max(0.4, 1 - 0.03 * (up.logistics || 0));
    this.goldMul = 1 + 0.08 * (up.spoils || 0);
    this.money = Math.min(this.walletMax,
                          this.stage.money + 60 * (up.treasury || 0));

    // 왕의 명령
    const cmdLv = up.command || 0;
    this.cmdMax = Math.max(25, COMMAND.baseCooldown - COMMAND.cooldownPerLv * cmdLv) * (this.hard ? HARDCORE.cmdMul : 1);
    this.cmdCd = this.cmdMax;   // 시작하자마자는 쓸 수 없다
    this.cmdHeal = COMMAND.healRatio + COMMAND.healPerLv * cmdLv;
    this.cmdUses = 0;
    this.heroCooldowns = {};
    this.heroGlobalCd = 0;

    setWorld(this.stage.len);
    const castleHp = Math.round(4000 * (1 + 0.10 * (up.castle || 0)) * (this.hard ? HARDCORE.castleMul : 1));
    this.allyCastle = new Castle('ally', castleHp, ALLY_BASE_X);
    this.enemyCastle = new Castle('enemy', this.hard ? hardcoreFortHp(this.stage) : this.stage.baseHp, ENEMY_BASE_X);

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
    this.bossWard = !!(this.stage.bossId && !this.endless);
    this.bossSpawned = false;
    this.bossDown = false;
    this.chronoOn = false;

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
    this.roster.forEach(u => { this.cooldowns[u.id] = 0; if(u.active) this.heroCooldowns[u.id]=20; });
  }

  /* 해금된 병종 */
  unlockedUnits() {
    const cleared = this.save.cleared;
    const owned = this.save.owned || {};
    return UNITS.filter(u =>
      u.unlockStage <= cleared + 1 || (u.gacha && owned[u.id]));
  }

  /* 실제 출진 편성 (최대 LOADOUT_MAX) */
  battleUnits() {
    const unlocked = this.unlockedUnits();
    const picked = [...new Set(this.save.loadout || [])].filter(id => unlocked.some(u => u.id === id));
    const list = picked.length ? picked.map(id => UNIT_BY_ID[id]) : unlocked.slice(0, LOADOUT_MAX);
    // 전설·신화는 앞에서부터 HERO_SLOT_MAX 명까지만 데려간다
    let heroes = 0;
    return list.filter(u => !isHeroUnit(u) || ++heroes <= HERO_SLOT_MAX).slice(0, LOADOUT_MAX)
      .map(u => this.stats(u.id));
  }

  /* 레벨·진화를 반영한 이 판의 병종 스탯 */
  stats(id) {
    return unitFor(this.save, id);
  }

  canDeploy(id) {
    const u = this.stats(id);
    return !!u && this.state === 'play' && this.roster.some(r => r.id === id) &&
      this.cooldowns[id] <= 0 && this.money >= u.cost &&
      (!u.maxActive || this.allies.filter(a => !a.dead && a.s.id === id).length < u.maxActive);
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
    const f = new Fighter(st, 'ally', x, buff);
    if (this.mods && this.mods.curse) f.healMul = CURSE_HEAL;
    return f;
  }

  deploy(id) {
    if (!this.canDeploy(id)) return false;
    const u = this.stats(id);
    this.money -= u.cost;
    this.cooldowns[id] = u.cooldown * this.cdMul;
    const f = this.makeAlly(u, ALLY_SPAWN_X + Math.random() * 40);
    f.giveBarrier(25 * Math.min(5, this.save.upgrades.deployment || 0));
    this.allies.push(f);
    this.fx.push({ type: 'spawn', x: f.x, row: f.row, t: 0.4, life: 0.4 });
    sfx('deploy');
    return true;
  }

  /* 왕의 명령: 전군 회복 + 가속 */
  heroCaster(id) {
    return this.allies.find(f=>!f.dead && !f.summoned && f.s.id===id) || null;
  }
  heroTarget(f) {
    return this.enemies.filter(e=>!e.dead && Math.abs(e.x-f.x)<=f.attackRange+180)
      .sort((a,b)=>Math.abs(a.x-f.x)-Math.abs(b.x-f.x))[0] || null;
  }
  canHeroActive(id) {
    const f=this.heroCaster(id), u=this.stats(id);
    return !!(this.state==='play' && u && u.active && this.roster.some(r=>r.id===id) && f &&
      f.stunT<=0 && f.kbTimer<=0 && (this.heroCooldowns[id]||0)<=0 && this.heroGlobalCd<=0 &&
      (u.active.barrier || u.active.haste || this.heroTarget(f)));
  }
  useHeroActive(id) {
    if(!this.canHeroActive(id)) return false;
    const f=this.heroCaster(id), a=f.s.active, buff=a.barrier||a.haste, target=buff?f:this.heroTarget(f);
    this.heroCooldowns[id]=a.cd; this.heroGlobalCd=6;
    if(buff) {
      for(const m of this.allies) if(!m.dead && Math.abs(m.x-f.x)<=a.radius) {
        if(a.barrier){m.giveBarrier(a.barrier*f.abMul);m.poisonT=0;m.poisonDps=0;m.burnT=0;m.burnDps=0;}
        if(a.haste){m.hasteMul=m.hasteT>0?Math.min(m.hasteMul,a.haste.mul):a.haste.mul;m.hasteT=Math.max(m.hasteT,a.haste.dur);m.stunT=0;}
      }
    } else {
      this._chaining = true;          // 액티브의 광역 타격이 대상마다 연쇄를 다시 일으키지 않게
      for(const e of this.enemies) if(!e.dead && Math.abs(e.x-target.x)<=a.radius) {
        this.hitOne(f.atk*a.mul,e,f,false);
        if(!e.dead) {
          if(a.slow)e.slowT=Math.max(e.slowT,a.slow);
          if(a.stun)e.stun(a.stun);
          if(a.charm&&!e.boss){e.charmT=Math.max(e.charmT,a.charm);this.fx.push({type:'charm',x:e.x,row:e.row,t:.7,life:.7});}
          if(a.execute)this.tryExecute(e,a.execute);
          if(a.push&&!e.ab.kbImmune&&!e.dead){e.x=Math.max(60,Math.min(WORLD-60,e.x+f.dir*a.push));e.kbTimer=Math.max(e.kbTimer,.3);}
          if(a.burn){if(e.burnT<=0)e.burnDps=0;e.burnT=Math.max(e.burnT,a.burn);e.burnDps=Math.max(e.burnDps,24*f.abMul);}
          // 혼천릉: 붉은 비단으로 묶어 한곳에 끌어모은다 (보스·넉백 면역은 버틴다)
          if(a.pull&&!e.dead&&!e.ab.kbImmune&&!e.boss){const dx=target.x-e.x;e.x+=Math.sign(dx)*Math.min(Math.abs(dx),a.pull);e.kbTimer=Math.max(e.kbTimer,.2);}
        }
      }
      this._chaining = false;
      // 여의봉 강타: 분신이 곧바로 튀어나온다
      if (a.clones && f.ab.summon) {
        const u = UNIT_BY_ID[f.ab.summon.id];
        for (let k = 0; u && k < a.clones; k++) {
          const m = this.makeAlly(u, f.x + f.dir * (30 + k * 24), f);
          m.summoned = true; m.summonedBy = f; m.lifeT = f.ab.summon.life || 8;
          this.allies.push(m);
          this.fx.push({ type: 'spawn', x: m.x, row: m.row, t: 0.4, life: 0.4 });
        }
      }
    }
    this.fx.push({type:'mythic',kind:a.kind,x:target.x,row:target.row,r:a.radius,color:f.s.accent,t:1.15,life:1.15});
    this.shake=Math.max(this.shake,5);f.swing=.22;
    return true;
  }

  canCommand() { return this.state === 'play' && this.cmdCd <= 0 && this.allies.length > 0; }

  useCommand() {
    if (!this.canCommand()) return false;
    this.cmdCd = this.cmdMax;
    this.cmdUses++;
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
    for (const c of [this.allyCastle, this.enemyCastle]) {
      if (c.hitFlash > 0) c.hitFlash = Math.max(0, c.hitFlash - dt);
      if (c.wardHit > 0) c.wardHit = Math.max(0, c.wardHit - dt);
    }
    // 시간 주술사가 하나라도 살아 있으면 카드가 느리게 찬다
    this.chronoOn = false;
    for (const e of this.enemies) if (!e.dead && e.ab.chrono) { this.chronoOn = true; break; }
    const cdStep = dt * (this.chronoOn ? CHRONO_RATE : 1);
    for (const k in this.cooldowns) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - cdStep);
    }

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
    if (this.stage.infinite) this.extendEndless();
    this.tickReinforce(dt);

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
    this.enemies = this.enemies.filter(e => !e.dead);
    this.allies = this.allies.filter(a => !a.dead);

    if (!this.endless && this.enemyCastle.dead) { this.shake = 16; this.finish('win'); }
    else if (this.allyCastle.dead) { this.shake = 16; this.finish(this.endless ? 'over' : 'lose'); }
    // 웨이브 수가 정해진 무한 전장(검사용)만 다 버티면 끝. 진짜 무한 전장은 성채가 무너질 때까지.
    else if (this.endless && !this.stage.infinite && this.qi >= this.queue.length && this.enemies.length === 0) {
      this.finish('over');
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
  wardUp() { return this.bossWard && !this.bossDown && this.enemyCastle.hp <= this.enemyCastle.maxHp * (WARD_FLOOR + 0.001); }

  spawnEnemy(id, atX, mul) {
    const spec = ENEMIES[id];
    const st = Object.assign({ range: 60, speed: 40, interval: 1.2, kb: 1, scale: 1 }, spec);
    const mods = this.mods || {};
    if (mods.blitz) { st.speed *= 1.45; st.interval *= 0.83; }
    // 중갑: 방어 60%. 보스는 이제 반드시 쓰러뜨려야 하므로 30%까지만 두른다.
    if (mods.ironclad) st.ab = Object.assign({}, st.ab, { armor: Math.max(spec.boss ? 0.3 : 0.6, (st.ab && st.ab.armor) || 0) });
    // 전장 자체가 거느린 강화 배율(2막처럼 같은 적이 더 억센 곳)과
    // 증원 배율을 함께 얹는다.
    let total = this.enemyMulBase * (mul && mul > 1 ? mul : 1);
    // 보스는 이제 반드시 쓰러뜨려야 하니, 전장 배율을 그대로 받으면 뒤쪽 보스가 끝없이 버틴다.
    // 배율을 누그러뜨려 받는다 (보스 자체 배율 BOSS_HP_MUL 은 따로 곱한다).
    if (spec.boss && this.stage.bossId && !this.endless && total > 1) total = Math.pow(total, BOSS_MUL_EXP);
    const buff = total > 1 ? { hp: total, atk: total } : null;
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
    }
    if (f.boss) { this.bossAlert = 2.6; this.bossName = spec.name; this.shake = 10; sfx('bossIn'); }
    if (f.ab.burrow) { f.burrowed = true; this.burrowers.push(f); return f; }
    this.enemies.push(f);
    return f;
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
      if (raised >= r.max) continue;
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
        this.fx.push({ type: 'boom', x: f.x, r: b.radius, t: 0.35, life: 0.35 });
      }
      if (isEnemySide && !f.exploded) {
        this.coins += Math.round((f.gold || 0) * KILL_GOLD_RATE * this.goldMul);
        this.kills++;
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
      if (f.boss && isEnemySide) { this.bossDown = true; this.enemyCastle.floor = 0; }   // 결계가 걷힌다
      // 흡혼귀: 근처에서 쓰러진 아군의 넋을 삼킨다 (불려 나온 것은 넋이 없다)
      if (!isEnemySide && !f.summoned) this.feedSouls(f);
      // 쓰러지는 연출 + 먼지
      this.fx.push({ type: 'corpse', st: f.s, x: f.x, row: f.row, dir: f.dir,
                     scale: f.scale, t: 0.9, life: 0.9 });
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

    if (this.endless) {
      this.wavesCleared = this.wavesDone();
      const best = this.save.endlessBest || 0;
      this.newRecord = this.wavesCleared > best;
      if (this.newRecord) this.save.endlessBest = this.wavesCleared;
      // 웨이브 수에 따른 보상
      this.coins += this.wavesCleared * 120;
      this.stoneGain = Math.floor(this.wavesCleared / 5);
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
      f.bob += dt * (f.speedNow / 22);

      const burning = f.burnT > 0;
      // 중독 / 화상 피해
      let dot = 0;
      if (f.poisonT > 0) { dot += f.poisonDps * Math.min(dt, f.poisonT); f.poisonT = Math.max(0, f.poisonT - dt); }
      if (f.burnT > 0) { dot += f.burnDps * Math.min(dt, f.burnT); f.burnT = Math.max(0, f.burnT - dt); }
      if (isAlly) dot *= 1 - 0.05 * Math.min(5, this.save.upgrades.resistance || 0);
      if (dot > 0) {
        f.hp -= dot;
        if (f.hp <= 0) {
          if (f.ab.revive && !f.usedRevive) {
            f.usedRevive = true; f.hp = Math.round(f.maxHp * f.ab.revive); f.reviveFx = true;
          } else { f.hp = 0; f.dead = true; continue; }
        }
      }

      if (f.ab.regen && !burning) f.heal(f.ab.regen * dt);
      // 저주: 불려 나온 아군(해골·미라·방벽)은 서서히 시든다
      if (isAlly && f.summoned && this.mods.curse) {
        f.hp -= f.maxHp * CURSE_WITHER * dt;
        if (f.hp <= 0) { f.hp = 0; f.dead = true; continue; }
      }

      // 보스 패턴
      if (f.s.phases || f.s.special) this.bossTick(f, dt);

      // 기절
      if (f.stunT > 0) { f.stunT -= dt; continue; }

      // 넉백
      if (f.kbTimer > 0) {
        f.kbTimer -= dt;
        f.x -= f.dir * 150 * dt;
        f.x = Math.max(60, Math.min(WORLD - 60, f.x));
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

      const target = this.findTarget(f, foes, foeCastle);
      if (target) {
        f.engaged = true;
        f.cd -= dt;
        if (f.cd <= 0) {
          f.cd = f.intervalNow;
          f.swing = 0.22;
          this.attack(f, target, foes, foeCastle);
          if (f.ab.spinup) f.spin = Math.min(f.ab.spinup.max, f.spin + f.ab.spinup.per);
        }
      } else if (!f.ab.hold && this.canAdvance(f, foes)) {
        f.spin = 0;                                 // 걸으면 식는다
        f.moving = f.speedNow > 0;
        f.x += f.dir * f.speedNow * dt;
        f.x = Math.max(60, Math.min(WORLD - 60, f.x));
        if (f.ab.charge) f.chargeDist += f.speedNow * dt;   // 달려온 만큼 창끝이 무거워진다
      }
    }
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
    return true;
  }

  supportTick(f, mates, dt, isAlly) {
    const ab = f.ab;
    if (!ab.heal && !ab.gold && !ab.summon && !ab.barrier && !ab.haste && !ab.cleanse &&
        !ab.rally && !ab.ward && !ab.pacify) return;
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
      }
      f.auraPulse = 0.5;
      this.fx.push({ type: 'bell', x: f.x, row: f.row, r: ab.radius, t: 0.7, life: 0.7, color: '#f6d365' });
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
      this.fx.push({type:'aura',x:f.x,row:f.row,r:ab.radius,color:'#a4f6cc',t:.5,life:.5});
    }
    if (ab.heal) {
      let healed = false;
      for (const m of mates) {
        if (m.dead || m === f) continue;
        if (Math.abs(m.x - f.x) > ab.radius) continue;
        if (m.hp >= m.maxHp) continue;
        m.heal(ab.heal * f.abMul * (isAlly ? 1 + .06 * Math.min(5, this.save.upgrades.medicine || 0) : (m.boss ? BOSS_HEAL_TAKEN : 1)));
        healed = true;
      }
      if (healed) {
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
      this.fx.push({ type: 'aura', x: f.x, row: f.row, r: ab.radius,
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
          if (u) {
            // 포탑처럼 수가 정해진 소환물은 그 이상 세우지 않는다
            if (ab.summon.max) {
              let mine = 0;
              for (const a of this.allies) if (!a.dead && a.summonedBy === f) mine++;
              if (mine >= ab.summon.max) break;
            }
            const m = this.makeAlly(u, sx, f);
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
    for (let i = 0; i < n; i++) {
      const id = this.reinfPool[(this.reinfWave * 3 + i) % this.reinfPool.length];
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
    const ph = f.s.phases;
    if (ph) {
      const ratio = f.hp / f.maxHp;
      while (f.phaseIdx < ph.length && ratio <= ph[f.phaseIdx].at) {
        this.bossAct(f, ph[f.phaseIdx]);
        f.phaseIdx++;
      }
    }
    const sp = f.s.special;
    if (sp && f.stunT <= 0) {
      f.specialCd -= dt;
      if (f.specialCd <= 0) {
        f.specialCd = sp.cd || 10;
        this.bossAct(f, sp);
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
    this.announce(a.name);

    switch (a.t) {
      case 'roar': {                       // 포효: 밀어내고 기절
        for (const e of foes) {
          if (e.dead || Math.abs(e.x - f.x) > r) continue;
          if (a.stun) e.stun(a.stun);
          if (a.push && !e.ab.kbImmune) {
            e.x = Math.max(60, Math.min(WORLD - 60, e.x + f.dir * a.push));
            e.kbTimer = Math.max(e.kbTimer, 0.2);
          }
          if (a.dmg) e.takeDamage(a.dmg);
        }
        this.fx.push({ type: 'cast', kind: 'shockwave', x: f.x, row: f.row,
                       color: f.s.accent, r: r * 0.6, big: true, dir: f.dir,
                       t: 0.7, life: 0.7 });
        this.shake = Math.max(this.shake, 14);
        sfx('bossIn');
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
            if (u) { const m = this.makeAlly(u, sx, f); m.summoned = true; this.allies.push(m); }
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
      case 'meteor': {                     // 예고 후 떨어지는 폭격
        const n = a.n || 3;
        const front = this.frontline();
        for (let i = 0; i < n; i++) {
          const tx = front + (i - (n - 1) / 2) * (a.gap || 130) + (Math.random() - 0.5) * 40;
          this.queueStrike(f, {
            x: Math.max(120, Math.min(WORLD - 120, tx)),
            r: a.radius || 110, dmg: a.dmg || 300,
            warn: (a.warn || 1.0) + i * 0.12,
            burn: a.burn, stun: a.stun, kind: a.kind || 'firestorm'
          });
        }
        break;
      }
    }
  }

  /* 예고 표시를 띄우고, 시간이 되면 그 자리에 내리꽂는다.
   * 무작정 터지지 않으니 피할 틈이 있다. */
  queueStrike(f, o) {
    this.pending.push({
      t: o.warn, side: f.side, x: o.x, r: o.r, dmg: o.dmg,
      burn: o.burn, stun: o.stun, kind: o.kind, color: f.s.accent, row: f.row
    });
    this.fx.push({ type: 'warn', x: o.x, r: o.r, t: o.warn, life: o.warn,
                   color: f.side === 'ally' ? '#6fc0ff' : '#e0503c' });
  }

  updatePending(dt) {
    if (!this.pending.length) return;
    let landed = false;
    for (const s of this.pending) {
      s.t -= dt;
      if (s.t > 0) continue;
      s.done = landed = true;
      const foes = this.foesOf(s.side);
      const castle = this.castleOf(s.side);
      for (const e of foes) {
        if (e.dead || Math.abs(e.x - s.x) > s.r + e.radius) continue;
        e.takeDamage(s.dmg);
        if (s.burn) {
          if (e.burnT <= 0) e.burnDps = 0;
          e.burnT = Math.max(e.burnT, s.burn.dur);
          e.burnDps = Math.max(e.burnDps, s.burn.dps);
        }
        if (s.stun) e.stun(s.stun);
      }
      if (!castle.dead && Math.abs(castle.x - s.x) <= s.r + castle.radius) {
        castle.takeDamage(s.dmg);
      }
      this.fx.push({ type: 'cast', kind: s.kind, x: s.x, row: s.row,
                     color: s.color, r: s.r, big: true, dir: 1, t: 0.6, life: 0.6 });
      this.fx.push({ type: 'boom', x: s.x, r: s.r, t: 0.32, life: 0.32 });
    }
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
    const reach = f.attackRange + f.radius;
    // 성벽 파괴병: 병사는 거들떠보지 않고 성채만 노린다
    if (f.ab.sapper) {
      return (!foeCastle.dead && (foeCastle.x - f.x) * f.dir <= reach + foeCastle.radius) ? foeCastle : null;
    }
    let best = null, bestD = Infinity;
    // 비행선 폭격: 사거리 안에서 가장 먼(뒷줄) 적을 노린다
    const back = !!f.ab.backline;
    for (const e of foes) {
      if (e.dead) continue;
      const d = (e.x - f.x) * f.dir;
      if (d < -f.radius || d > reach + e.radius) continue;
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
    // 같은 순간에 연출이 몰리면 프레임이 무너진다. 살아 있는 수를 세어 막는다.
    let live = 0, liveBig = 0;
    for (const e of this.fx) {
      if (e.type !== 'cast') continue;
      live++;
      if (e.big) liveBig++;
    }
    if (live >= CAST_LIMIT) return;
    if (big && liveBig >= CAST_BIG_LIMIT) return;
    this.fx.push({
      type: 'cast', kind: kind, x: x, row: row || 0,
      color: f.s.accent, r: f.s.areaRadius || 90, big: big, dir: f.dir,
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
    const r = this.rollDamage(f);
    // 창기병 돌격: 달려온 첫 일격이 몇 배로 들어가고 적을 밀쳐 낸다
    let charged = false;
    if (f.ab.charge) {
      if (f.chargeDist >= f.ab.charge.dist) { r.dmg *= f.ab.charge.mul; charged = true; }
      f.chargeDist = 0;
    }
    if (charged && !target.isCastle) {
      if (!target.ab.kbImmune && !target.boss) {
        target.x = Math.max(60, Math.min(WORLD - 60, target.x + f.dir * f.ab.charge.push));
        target.kbTimer = Math.max(target.kbTimer, 0.3);
      }
      this.fx.push({ type: 'cast', kind: 'shockwave', x: target.x, row: target.row, color: f.s.accent, r: 70,
                     big: false, dir: f.dir, t: 0.45, life: 0.45 });
      this.shake = Math.max(this.shake, 6);
    }
    if (f.s.ranged) {
      sfx('arrow');
      this.shots.push({
        x: f.x, y0: f.row, tx: target.x, side: f.side, t: 0,
        dur: Math.max(0.18, Math.abs(target.x - f.x) / 900),
        color: f.s.accent, dmg: r.dmg, crit: r.crit, src: f,
        area: f.s.area, areaRadius: f.s.areaRadius, dir: f.dir
      });
    } else {
      const cx = f.x + f.dir * f.attackRange * 0.6;
      if (f.s.area) this.areaHit(r.dmg, cx, f.s.areaRadius, foes, foeCastle, f, r.crit);
      else this.hitOne(r.dmg, target, f, r.crit);
      this.castFx(f, target.x !== undefined ? target.x : cx, target.row, r.crit);
      this.fx.push({ type: r.crit ? 'crit' : 'hit', x: target.x, row: target.row ?? 1,
                     dir: f.dir, t: 0.22, life: 0.22 });
      sfx(f.s.area ? 'hit' : 'slash');
    }
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
    // 영웅 사냥꾼: 적이 비싼(비용 350 이상) 아군 — 영웅·전설·신화 — 을 골라 두 배로 친다
    if (this.mods && this.mods.giantslayer && src && src.side === 'enemy' &&
        !target.isCastle && target.side === 'ally' && (target.s.cost || 0) >= HUNT_COST) dmg *= HUNT_MUL;
    const dealt = target.takeDamage(dmg, pierce) || 0;
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
      this.dmgFxCount++;
      this.fx.push({ type: 'dmg', x: target.x + (Math.random() - 0.5) * 26,
                     row: target.row, v: Math.round(dealt), dy: Math.random() * 10,
                     crit: !!crit, ally: target.side === 'ally', t: 0.65, life: 0.65 });
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
    if (ab.stun && Math.random() < ab.stun.chance && target.stun(ab.stun.dur)) {
      this.fx.push({ type: 'stun', x: target.x, row: target.row, t: 0.5, life: 0.5 });
    }
    if (ab.push && !target.ab.kbImmune) {
      target.x += src.dir * ab.push * 0.01 * 60;
      target.kbTimer = Math.max(target.kbTimer, 0.12);
    }
    if (ab.weaken) {                              // 액막이: 이 적이 주는 피해가 준다
      target.weakT = Math.max(target.weakT, ab.weaken.dur);
      target.weakMul = Math.min(target.weakMul, ab.weaken.mul);
    }
    if (ab.charm && !target.boss && Math.random() < ab.charm.chance) {
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
    this.fx.push({ type: 'hit', x: best.x, row: best.row, dir: -f.dir, t: 0.2, life: 0.2 });
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

  areaHit(dmg, cx, radius, foes, foeCastle, src, crit) {
    for (const e of foes) {
      if (e.dead) continue;
      if (Math.abs(e.x - cx) <= radius + e.radius) this.hitOne(dmg, e, src, crit);
    }
    if (foeCastle && !foeCastle.dead && Math.abs(foeCastle.x - cx) <= radius + foeCastle.radius) {
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
    for (const s of this.shots) {
      s.t += dt;
      if (s.t < s.dur) continue;
      s.done = true;
      const ab = (s.src && s.src.ab) || {};
      const foes = this.foesOf(s.side);
      const castle = this.castleOf(s.side);
      if (s.src) this.castFx(s.src, s.tx, s.y0, s.crit);
      if (ab.pierce) { this.pierceHit(s); continue; }
      if (s.area) {
        this.areaHit(s.dmg, s.tx, s.areaRadius, foes, castle, s.src, s.crit);
        continue;
      }
      let hit = null, bd = Infinity;
      for (const e of foes) {
        if (e.dead) continue;
        const d = Math.abs(e.x - s.tx);
        if (d < bd && d < 90) { bd = d; hit = e; }
      }
      if (!hit && !castle.dead && Math.abs(castle.x - s.tx) < 110) hit = castle;
      if (hit) this.hitOne(s.dmg, hit, s.src, s.crit);
      this.fx.push({ type: s.crit ? 'crit' : 'hit', x: hit ? hit.x : s.tx, row: hit ? (hit.row ?? s.y0) : s.y0, dir: s.dir, t: 0.22, life: 0.22 });
    }
    this.shots = this.shots.filter(s => !s.done);
  }

  updateFx(dt) {
    for (const e of this.fx) e.t -= dt;
    this.fx = this.fx.filter(e => e.t > 0);
    if (this.fx.length > FX_LIMIT) this.fx.splice(0, this.fx.length - FX_LIMIT);
    this.dmgFxCount = 0;
    for (const e of this.fx) if (e.type === 'dmg') this.dmgFxCount++;
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
        a.x = Math.max(60, a.x - 140);
        a.kbTimer = Math.max(a.kbTimer, 0.42);
      }
      sy.group.forEach(([id, n]) => {
        for (let k = 0; k < n; k++) this.spawnEnemy(id, ENEMY_SPAWN_X - k * 24 - Math.random() * 20);
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
