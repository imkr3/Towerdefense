/* =======================================================================
 *  막대 왕국 전쟁 - 전투 엔진 (라인 배틀 + 특수 능력)
 * ======================================================================= */

const WORLD = 2000;          // 전장 가로 길이(월드 좌표)
const ALLY_BASE_X = 96;      // 아군 성채 위치
const ENEMY_BASE_X = WORLD - 96;
const ALLY_SPAWN_X = 150;
const ENEMY_SPAWN_X = WORLD - 150;
const KILL_GOLD_RATE = 0.35; // 처치 보상 배율

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
    this.barrier = 0;
    this.barrierMax = 0;
    this.usedRevive = false;
    this.abCd = 0;
    this.auraPulse = 0;
  }

  get speedNow() { return this.s.speed * (this.slowT > 0 ? SLOW_SPEED_MUL : 1); }
  get intervalNow() { return this.s.interval * (this.slowT > 0 ? SLOW_RATE_MUL : 1); }
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
  constructor(stageIndex, save) {
    this.stageIndex = stageIndex;
    this.stage = STAGES[stageIndex];
    this.save = save;

    const up = save.upgrades;
    this.buff = {
      hp: 1 + 0.08 * (up.vitality || 0),
      atk: 1 + 0.06 * (up.power || 0)
    };
    this.levels = save.levels || {};

    this.walletMax = 900 + 260 * (up.wallet || 0);
    this.income = this.stage.rate * (1 + 0.12 * (up.income || 0));
    this.money = Math.min(this.stage.money, this.walletMax);

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
    this.cooldowns = {};
    this.speed = 1;

    this.queue = [];
    this.stage.waves.forEach(w => {
      for (let i = 0; i < w.n; i++) this.queue.push({ t: w.t + i * w.gap, e: w.e });
    });
    this.queue.sort((a, b) => a.t - b.t);
    this.qi = 0;

    this.roster = this.battleUnits();
    this.roster.forEach(u => { this.cooldowns[u.id] = 0; });
  }

  /* 해금된 병종 */
  unlockedUnits() {
    const cleared = this.save.cleared;
    return UNITS.filter(u => u.unlockStage <= cleared + 1);
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
    this.cooldowns[id] = u.cooldown;
    const f = this.makeAlly(u, ALLY_SPAWN_X + Math.random() * 40);
    this.allies.push(f);
    this.fx.push({ type: 'spawn', x: f.x, row: f.row, t: 0.4, life: 0.4 });
    return true;
  }

  update(dtRaw) {
    if (this.state !== 'play') { this.updateFx(dtRaw); return; }
    const dt = dtRaw * this.speed;
    this.time += dt;

    this.money = Math.min(this.walletMax, this.money + this.income * dt);
    for (const k in this.cooldowns) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }

    while (this.qi < this.queue.length && this.queue[this.qi].t <= this.time) {
      this.spawnEnemy(this.queue[this.qi].e);
      this.qi++;
    }

    this.step(this.allies, this.enemies, this.enemyCastle, dt, true);
    this.step(this.enemies, this.allies, this.allyCastle, dt, false);

    this.reap(this.enemies, this.allies, this.enemyCastle, true);
    this.reap(this.allies, this.enemies, this.allyCastle, false);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.allies = this.allies.filter(a => !a.dead);

    this.updateShots(dt);
    this.updateFx(dtRaw);

    if (this.enemyCastle.dead) this.finish('win');
    else if (this.allyCastle.dead) this.finish('lose');
  }

  spawnEnemy(id, atX) {
    const spec = ENEMIES[id];
    const st = Object.assign({ range: 60, speed: 40, interval: 1.2, kb: 1, scale: 1 }, spec);
    const f = new Fighter(st, 'enemy', atX !== undefined ? atX : ENEMY_SPAWN_X - Math.random() * 40, null);
    f.gold = spec.gold || 0;
    f.boss = !!spec.boss;
    this.enemies.push(f);
    return f;
  }

  /* 사망 처리 (죽을 때 터지는 능력 포함) */
  reap(list, foes, foeCastle, isEnemySide) {
    for (const f of list) {
      if (!f.dead) continue;
      if (f.ab.deathBomb) {
        const b = f.ab.deathBomb;
        this.areaHit(b.dmg * f.abMul, f.x, b.radius, foes, foeCastle, null);
        this.fx.push({ type: 'boom', x: f.x, r: b.radius, t: 0.35, life: 0.35 });
      }
      if (isEnemySide) this.coins += Math.round((f.gold || 0) * KILL_GOLD_RATE);
      this.fx.push({ type: 'poof', x: f.x, row: f.row, t: 0.45, life: 0.45,
                     color: f.s.body, big: f.boss });
    }
  }

  finish(result) {
    this.state = result;
    this.resultTime = 0;
    if (result === 'win') {
      this.coins += this.stage.reward;
      if (this.stageIndex >= this.save.cleared) this.save.cleared = this.stageIndex + 1;
      this.save.coins += this.coins;
      saveGame(this.save);
    } else {
      this.coins = Math.floor(this.coins * 0.5);
      this.save.coins += this.coins;
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
      if (f.auraPulse > 0) f.auraPulse -= dt;
      f.bob += dt * (f.speedNow / 22);

      // 중독 피해
      if (f.poisonT > 0) {
        f.poisonT -= dt;
        f.hp -= f.poisonDps * dt;
        if (f.hp <= 0) {
          if (f.ab.revive && !f.usedRevive) {
            f.usedRevive = true; f.hp = Math.round(f.maxHp * f.ab.revive); f.reviveFx = true;
          } else { f.hp = 0; f.dead = true; continue; }
        }
      }

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
      } else if (!f.ab.hold) {
        f.x += f.dir * f.speedNow * dt;
        f.x = Math.max(60, Math.min(WORLD - 60, f.x));
      }
    }
  }

  supportTick(f, mates, dt, isAlly) {
    const ab = f.ab;
    if (!ab.heal && !ab.gold && !ab.summon && !ab.barrier) return;
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

  attack(f, target, foes, foeCastle) {
    const r = this.rollDamage(f);
    if (f.s.ranged) {
      this.shots.push({
        x: f.x, y0: f.row, tx: target.x, side: f.side, t: 0,
        dur: Math.max(0.18, Math.abs(target.x - f.x) / 900),
        color: f.s.accent, dmg: r.dmg, crit: r.crit, src: f,
        area: f.s.area, areaRadius: f.s.areaRadius,
        foes: foes, castle: foeCastle, dir: f.dir
      });
    } else {
      const cx = f.x + f.dir * f.attackRange * 0.6;
      if (f.s.area) this.areaHit(r.dmg, cx, f.s.areaRadius, foes, foeCastle, f);
      else this.hitOne(r.dmg, target, f);
      this.fx.push({ type: r.crit ? 'crit' : 'hit', x: target.x, row: target.row || 1,
                     t: 0.22, life: 0.22 });
    }
  }

  /* 단일 대상 타격 + 부가 효과 */
  hitOne(dmg, target, src) {
    target.takeDamage(dmg);
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
    if (ab.stun && Math.random() < ab.stun.chance) {
      target.stunT = Math.max(target.stunT, ab.stun.dur);
      this.fx.push({ type: 'stun', x: target.x, row: target.row, t: 0.5, life: 0.5 });
    }
    if (ab.push && !target.ab.kbImmune) {
      target.x += src.dir * ab.push * 0.01 * 60;
      target.kbTimer = Math.max(target.kbTimer, 0.12);
    }
  }

  areaHit(dmg, cx, radius, foes, foeCastle, src) {
    for (const e of foes) {
      if (e.dead) continue;
      if (Math.abs(e.x - cx) <= radius + e.radius) this.hitOne(dmg, e, src);
    }
    if (foeCastle && !foeCastle.dead && Math.abs(foeCastle.x - cx) <= radius + foeCastle.radius) {
      foeCastle.takeDamage(dmg);
    }
    this.fx.push({ type: 'boom', x: cx, r: radius, t: 0.32, life: 0.32 });
  }

  /* 관통: 사수와 착탄점 사이의 모든 적을 꿰뚫는다 */
  pierceHit(shot) {
    const from = Math.min(shot.x, shot.tx), to = Math.max(shot.x, shot.tx);
    let hits = 0;
    for (const e of shot.foes) {
      if (e.dead) continue;
      if (e.x >= from - 30 && e.x <= to + 30) { this.hitOne(shot.dmg, e, shot.src); hits++; }
    }
    if (shot.castle && !shot.castle.dead &&
        shot.castle.x >= from - 40 && shot.castle.x <= to + 40) shot.castle.takeDamage(shot.dmg);
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
      if (ab.pierce) { this.pierceHit(s); continue; }
      if (s.area) {
        this.areaHit(s.dmg, s.tx, s.areaRadius, s.foes, s.castle, s.src);
        continue;
      }
      let hit = null, bd = Infinity;
      for (const e of s.foes) {
        if (e.dead) continue;
        const d = Math.abs(e.x - s.tx);
        if (d < bd && d < 90) { bd = d; hit = e; }
      }
      if (!hit && s.castle && !s.castle.dead && Math.abs(s.castle.x - s.tx) < 110) hit = s.castle;
      if (hit) this.hitOne(s.dmg, hit, s.src);
      this.fx.push({ type: s.crit ? 'crit' : 'hit', x: s.tx, row: s.y0, t: 0.22, life: 0.22 });
    }
    this.shots = this.shots.filter(s => !s.done);
  }

  updateFx(dt) {
    for (const e of this.fx) e.t -= dt;
    this.fx = this.fx.filter(e => e.t > 0);
    if (this.state !== 'play') this.resultTime = (this.resultTime || 0) + dt;
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
