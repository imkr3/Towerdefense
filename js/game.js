/* =======================================================================
 *  막대 왕국 전쟁 - 전투 엔진 (라인 배틀 + 특수 능력)
 * ======================================================================= */

const WORLD = 2000;          // 전장 가로 길이(월드 좌표)
const ALLY_BASE_X = 96;      // 아군 성채 위치
const ENEMY_BASE_X = WORLD - 96;
const ALLY_SPAWN_X = 150;
const ENEMY_SPAWN_X = WORLD - 150;
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
const REINFORCE_FIRST = 10;  // 대본 파도가 끝나고 첫 증원까지
const REINFORCE_MIN = 3.0;   // 증원 간격 하한
const REINFORCE_STEP = 0.06; // 증원 한 번마다 적이 세지는 폭
const REINFORCE_MAX = 2.2;   // 증원 강화 상한 (끝없이 세지면 이길 수가 없다)
const REINFORCE_CAP = 24;    // 전장에 동시에 서 있을 수 있는 적 수
const CAST_LIMIT = 4;        // 동시에 터지는 필살 연출 수 (렉 방지)
const CAST_BIG_LIMIT = 2;    // 그중 전설 대형 연출
const SLOW_SPEED_MUL = 0.45; // 둔화 시 이동
const SLOW_RATE_MUL = 1.7;   // 둔화 시 공격 간격

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

    // 보스 패턴용
    this.speedMul = 1;      // 광폭화로 빨라진다
    this.rateMul = 1;       // 공격 간격 배율 (작을수록 빠름)
    this.phaseIdx = 0;      // 지금까지 넘긴 페이즈
    this.specialCd = (stats.special && stats.special.first) || 6;
    this.enraged = false;
  }

  get speedNow() { return this.s.speed * this.speedMul * (this.slowT > 0 ? SLOW_SPEED_MUL : 1); }

  get intervalNow() {
    let v = this.s.interval * this.rateMul;
    if (this.slowT > 0) v *= SLOW_RATE_MUL;
    if (this.hasteT > 0) v *= this.hasteMul;
    if (this.ab.enrage) {                       // 피가 깎일수록 빨라진다
      const missing = 1 - this.hp / this.maxHp;
      v /= (1 + (this.ab.enrage - 1) * missing);
    }
    return Math.max(0.12, v);
  }
  get attackRange() { return this.s.range; }

  heal(amount) {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  giveBarrier(amount) {
    if (this.dead) return;
    if (this.barrier < amount) {
      this.barrier = amount;
      this.barrierMax = Math.max(this.barrierMax, amount);
    }
  }

  takeDamage(dmg) {
    if (this.dead) return;
    if (this.ab.armor) dmg *= (1 - Math.min(0.75, this.ab.armor));   // 두꺼운 갑주
    if (this.barrier > 0) {
      const absorbed = Math.min(this.barrier, dmg);
      this.barrier -= absorbed;
      dmg -= absorbed;
      this.hitFlash = 0.15;
      if (dmg <= 0) return;
    }
    this.hp -= dmg;
    this.hitFlash = 0.15;
    if (this.hp <= 0) {
      if (this.ab.revive && !this.usedRevive) {     // 1회 부활
        this.usedRevive = true;
        this.hp = Math.round(this.maxHp * this.ab.revive);
        this.kbTimer = 0.5;
        this.reviveFx = true;
        return;
      }
      this.hp = 0;
      this.dead = true;
      return;
    }
    if (this.ab.kbImmune) return;                   // 넉백 면역
    const kbTotal = this.s.kb || 1;
    const stepsLeft = Math.ceil((this.hp / this.maxHp) * kbTotal);
    if (stepsLeft < this.kbLeft) {
      this.kbLeft = stepsLeft;
      this.kbTimer = 0.42;
    }
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
  }
  takeDamage(d) {
    this.hp -= d;
    this.hitFlash = 0.15;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }
  heal() {}
  giveBarrier() {}
}

/* ------------------------------ 전투 ------------------------------ */
class Battle {
  constructor(stageIndex, save, customStage) {
    this.stageIndex = stageIndex;
    this.stage = customStage || STAGES[stageIndex];
    this.endless = !!this.stage.endless;
    this.save = save;

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
    this.cmdMax = Math.max(25, COMMAND.baseCooldown - COMMAND.cooldownPerLv * cmdLv);
    this.cmdCd = this.cmdMax;   // 시작하자마자는 쓸 수 없다
    this.cmdHeal = COMMAND.healRatio + COMMAND.healPerLv * cmdLv;
    this.cmdUses = 0;

    const castleHp = Math.round(4000 * (1 + 0.10 * (up.castle || 0)));
    this.allyCastle = new Castle('ally', castleHp, ALLY_BASE_X);
    this.enemyCastle = new Castle('enemy', this.stage.baseHp, ENEMY_BASE_X);

    this.allies = [];
    this.enemies = [];
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

    this.queue = [];
    this.stage.waves.forEach(w => {
      for (let i = 0; i < w.n; i++) this.queue.push({ t: w.t + i * w.gap, e: w.e });
    });
    this.queue.sort((a, b) => a.t - b.t);
    this.qi = 0;

    // 증원: 대본 파도가 동나도 적 요새는 병력을 계속 토해낸다.
    // 버티기만 해서는 절대 끝나지 않고, 요새를 부수는 수밖에 없다.
    const seen = {}, pool = [], heavy = [];
    this.stage.waves.forEach(w => {
      if (seen[w.e]) return;
      seen[w.e] = true;
      const spec = ENEMIES[w.e];
      if (!spec || (spec.ab && spec.ab.hold)) return;    // 토템처럼 박혀 있는 건 제외
      const ab = spec.ab || {};
      // 보스·갑주·넉백 면역·장거리 공성은 상시 증원에서 뺀다.
      // 계속 흘려보내면 뚫을 수 없는 벽이 되어 전선이 영영 멈춘다.
      const wall = spec.boss || ab.armor || ab.kbImmune || spec.range > 300;
      (wall ? heavy : pool).push(w.e);
    });
    this.reinfPool = pool.length ? pool : ['orcspear'];
    this.reinfHeavy = heavy;
    this.reinfWave = 0;
    this.reinfT = REINFORCE_FIRST;
    this.reinfOn = false;

    this.roster = this.battleUnits();
    this.roster.forEach(u => { this.cooldowns[u.id] = 0; });
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
    const picked = (this.save.loadout || []).filter(id => unlocked.some(u => u.id === id));
    const list = picked.length ? picked.map(id => UNIT_BY_ID[id]) : unlocked.slice(0, LOADOUT_MAX);
    return list.slice(0, LOADOUT_MAX);
  }

  canDeploy(id) {
    const u = UNIT_BY_ID[id];
    return this.state === 'play' && this.cooldowns[id] <= 0 && this.money >= u.cost;
  }

  makeAlly(u, x) {
    const lm = unitLevelMul(this.levels[u.id] || 1);
    const buff = { hp: this.buff.hp * lm, atk: this.buff.atk * lm };
    return new Fighter(u, 'ally', x, buff);
  }

  deploy(id) {
    if (!this.canDeploy(id)) return false;
    const u = UNIT_BY_ID[id];
    this.money -= u.cost;
    this.cooldowns[id] = u.cooldown * this.cdMul;
    const f = this.makeAlly(u, ALLY_SPAWN_X + Math.random() * 40);
    this.allies.push(f);
    this.fx.push({ type: 'spawn', x: f.x, row: f.row, t: 0.4, life: 0.4 });
    sfx('deploy');
    return true;
  }

  /* 왕의 명령: 전군 회복 + 가속 */
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
    const dt = dtRaw * this.speed;
    this.time += dt;

    // 전투가 길어지면 자금이 더 빨리 찬다. 적도 증원으로 계속 불어나므로
    // 이쪽 보급이 더 가파르게 올라야 교착이 풀린다.
    const ramp = 1 + Math.min(1.4, Math.max(0, (this.time - 60) / 180) * 1.4);
    this.money = Math.min(this.walletMax, this.money + this.income * ramp * dt);
    if (this.cmdCd > 0) this.cmdCd = Math.max(0, this.cmdCd - dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.4);
    if (this.bossAlert > 0) this.bossAlert -= dt;
    if (this.patternT > 0) this.patternT -= dt;
    this.updatePending(dt);
    for (const k in this.cooldowns) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }

    while (this.qi < this.queue.length && this.queue[this.qi].t <= this.time) {
      this.spawnEnemy(this.queue[this.qi].e);
      this.qi++;
    }
    this.tickReinforce(dt);

    this.step(this.allies, this.enemies, this.enemyCastle, dt, true);
    this.step(this.enemies, this.allies, this.allyCastle, dt, false);

    this.reap(this.enemies, this.allies, this.enemyCastle, true);
    this.reap(this.allies, this.enemies, this.allyCastle, false);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.allies = this.allies.filter(a => !a.dead);

    this.updateShots(dt);
    this.updateFx(dtRaw);

    if (!this.endless && this.enemyCastle.dead) { this.shake = 16; this.finish('win'); }
    else if (this.allyCastle.dead) { this.shake = 16; this.finish(this.endless ? 'over' : 'lose'); }
    // 무한 전장은 모든 파도를 버텨내면 그것으로 끝
    else if (this.endless && this.qi >= this.queue.length && this.enemies.length === 0) {
      this.finish('over');
    }
  }

  spawnEnemy(id, atX, mul) {
    const spec = ENEMIES[id];
    const st = Object.assign({ range: 60, speed: 40, interval: 1.2, kb: 1, scale: 1 }, spec);
    const buff = mul && mul > 1 ? { hp: mul, atk: mul } : null;
    const f = new Fighter(st, 'enemy', atX !== undefined ? atX : ENEMY_SPAWN_X - Math.random() * 40, buff);
    f.gold = spec.gold || 0;
    f.boss = !!spec.boss;
    if (f.boss) { this.bossAlert = 2.6; this.bossName = spec.name; this.shake = 10; sfx('bossIn'); }
    this.enemies.push(f);
    return f;
  }

  /* 사망 처리 (죽을 때 터지는 능력 포함) */
  reap(list, foes, foeCastle, isEnemySide) {
    for (const f of list) {
      if (!f.dead) continue;
      if (f.ab.deathBomb) {
        const b = f.ab.deathBomb;
        this.areaHit(b.dmg * f.abMul, f.x, b.radius, foes, foeCastle, null, false);
        this.fx.push({ type: 'boom', x: f.x, r: b.radius, t: 0.35, life: 0.35 });
      }
      if (isEnemySide) {
        this.coins += Math.round((f.gold || 0) * KILL_GOLD_RATE * this.goldMul);
        this.kills++;
      }
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
    this.state = result;
    this.resultTime = 0;
    this.stars = 0;
    sfx(result === 'win' ? 'win' : 'lose');

    if (this.endless) {
      this.wavesCleared = this.wavesDone();
      const best = this.save.endlessBest || 0;
      this.newRecord = this.wavesCleared > best;
      if (this.newRecord) this.save.endlessBest = this.wavesCleared;
      // 파도 수에 따른 보상
      this.coins += this.wavesCleared * 120;
      this.stoneGain = Math.floor(this.wavesCleared / 5);
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
      if (f.hitFlash > 0) f.hitFlash -= dt;
      if (f.swing > 0) f.swing -= dt;
      if (f.slowT > 0) f.slowT -= dt;
      if (f.hasteT > 0) f.hasteT -= dt;
      if (f.auraPulse > 0) f.auraPulse -= dt;
      f.bob += dt * (f.speedNow / 22);

      // 중독 / 화상 피해
      let dot = 0;
      if (f.poisonT > 0) { f.poisonT -= dt; dot += f.poisonDps; }
      if (f.burnT > 0) { f.burnT -= dt; dot += f.burnDps; }
      if (dot > 0) {
        f.hp -= dot * dt;
        if (f.hp <= 0) {
          if (f.ab.revive && !f.usedRevive) {
            f.usedRevive = true; f.hp = Math.round(f.maxHp * f.ab.revive); f.reviveFx = true;
          } else { f.hp = 0; f.dead = true; continue; }
        }
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

      // 지원 능력 (표적과 무관하게 주기적으로 발동)
      this.supportTick(f, list, dt, isAlly);

      const target = this.findTarget(f, foes, foeCastle);
      if (target) {
        f.cd -= dt;
        if (f.cd <= 0) {
          f.cd = f.intervalNow;
          f.swing = 0.22;
          this.attack(f, target, foes, foeCastle);
        }
      } else if (!f.ab.hold && this.canAdvance(f, foes)) {
        f.x += f.dir * f.speedNow * dt;
        f.x = Math.max(60, Math.min(WORLD - 60, f.x));
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
    if (!ab.heal && !ab.gold && !ab.summon && !ab.barrier && !ab.haste) return;
    if (ab.gold && isAlly) {
      this.money = Math.min(this.walletMax, this.money + ab.gold * f.abMul * dt);
    }
    f.abCd -= dt;
    if (f.abCd > 0) return;
    f.abCd = ab.interval || 3;

    if (ab.heal) {
      let healed = false;
      for (const m of mates) {
        if (m.dead || m === f) continue;
        if (Math.abs(m.x - f.x) > ab.radius) continue;
        if (m.hp >= m.maxHp) continue;
        m.heal(ab.heal * f.abMul);
        healed = true;
      }
      if (healed || true) {
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
            const m = this.makeAlly(u, sx);
            m.summoned = true;
            this.allies.push(m);
          }
        } else {
          this.spawnEnemy(ab.summon.id, sx).summoned = true;
        }
      }
      this.fx.push({ type: 'spawn', x: f.x - f.dir * 24, row: f.row, t: 0.4, life: 0.4 });
    }
  }

  /* ------------------- 끝없는 증원 -------------------
   * 대본 파도를 다 막아도 적 요새는 병력을 계속 내보낸다. 시간이 갈수록
   * 간격이 좁아지고 한 마리 한 마리가 세진다. 버티기만 하는 전략은 반드시
   * 무너지므로, 결국 요새를 부수러 나가야 한다. */
  tickReinforce(dt) {
    if (this.endless) return;                   // 무한 전장은 자체 파도로 돈다
    if (this.qi < this.queue.length) return;    // 대본 파도가 남아 있으면 아직
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
    // 여섯 번에 한 번은 보스급도 딸려 온다
    if (this.reinfWave % 6 === 0 && this.reinfHeavy.length) {
      const b = this.reinfHeavy[(this.reinfWave / 6 - 1) % this.reinfHeavy.length];
      this.spawnEnemy(b, ENEMY_SPAWN_X, mul);
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

  announce(name) {
    if (!name) return;
    this.patternName = name;
    this.patternT = 1.7;
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
          if (a.stun) e.stunT = Math.max(e.stunT, a.stun);
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
            if (u) { const m = this.makeAlly(u, sx); m.summoned = true; this.allies.push(m); }
          } else {
            this.spawnEnemy(a.id, sx).summoned = true;
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
          e.burnT = Math.max(e.burnT, s.burn.dur);
          e.burnDps = Math.max(e.burnDps, s.burn.dps);
        }
        if (s.stun) e.stunT = Math.max(e.stunT, s.stun);
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
    let best = null, bestD = Infinity;
    for (const e of foes) {
      if (e.dead) continue;
      const d = (e.x - f.x) * f.dir;
      if (d < -f.radius || d > reach + e.radius) continue;
      if (d < bestD) { bestD = d; best = e; }
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
    const r = this.rollDamage(f);
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
      this.fx.push({ type: r.crit ? 'crit' : 'hit', x: target.x, row: target.row || 1,
                     t: 0.22, life: 0.22 });
      sfx(f.s.area ? 'hit' : 'slash');
    }
  }

  /* 단일 대상 타격 + 부가 효과 */
  hitOne(dmg, target, src, crit) {
    target.takeDamage(dmg);
    if (target.isCastle) {
      if (target.side === 'ally') this.shake = Math.max(this.shake, 8);
    } else if (this.dmgFxCount < 14) {
      this.dmgFxCount++;
      this.fx.push({ type: 'dmg', x: target.x + (Math.random() - 0.5) * 26,
                     row: target.row, v: Math.round(dmg), dy: Math.random() * 10,
                     crit: !!crit, ally: target.side === 'ally', t: 0.65, life: 0.65 });
    }
    if (!src) return;
    const ab = src.ab;
    if (ab.lifesteal) src.heal(dmg * ab.lifesteal);
    if (target.isCastle || target.dead) return;
    if (ab.slow) {
      target.slowT = Math.max(target.slowT, ab.slow);
      this.fx.push({ type: 'chill', x: target.x, row: target.row, t: 0.4, life: 0.4 });
    }
    if (ab.poison) {
      target.poisonT = Math.max(target.poisonT, ab.poison.dur);
      target.poisonDps = Math.max(target.poisonDps, ab.poison.dps * src.abMul);
    }
    if (ab.burn) {
      target.burnT = Math.max(target.burnT, ab.burn.dur);
      target.burnDps = Math.max(target.burnDps, ab.burn.dps * src.abMul);
    }
    if (ab.stun && Math.random() < ab.stun.chance) {
      target.stunT = Math.max(target.stunT, ab.stun.dur);
      this.fx.push({ type: 'stun', x: target.x, row: target.row, t: 0.5, life: 0.5 });
    }
    if (ab.push && !target.ab.kbImmune) {
      target.x += src.dir * ab.push * 0.01 * 60;
      target.kbTimer = Math.max(target.kbTimer, 0.12);
    }
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
      this.fx.push({ type: s.crit ? 'crit' : 'hit', x: s.tx, row: s.y0, t: 0.22, life: 0.22 });
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

  /* 무한 전장에서 지금까지 넘긴 파도 수 */
  wavesDone() {
    if (!this.endless) return 0;
    let n = 0, lastT = -1;
    for (let i = 0; i < this.qi; i++) {
      if (this.queue[i].t !== lastT) { lastT = this.queue[i].t; }
    }
    // 파도 = 등장 시각 묶음. 대략 등장 완료한 그룹 수를 센다
    const seen = {};
    for (let i = 0; i < this.qi; i++) seen[Math.round(this.queue[i].t)] = true;
    n = Object.keys(seen).length;
    return n;
  }

  /* 남은 적 = 아직 등장하지 않은 적 + 전장에 있는 적 */
  foesLeft() { return (this.queue.length - this.qi) + this.enemies.length; }
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
