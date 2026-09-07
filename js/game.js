/* =======================================================================
 *  달콤 방어전 - 전투 엔진 (라인 배틀)
 * ======================================================================= */

const WORLD = 2000;          // 전장 가로 길이(월드 좌표)
const ALLY_BASE_X = 96;      // 아군 본진 위치
const ENEMY_BASE_X = WORLD - 96;
const ALLY_SPAWN_X = 150;
const ENEMY_SPAWN_X = WORLD - 150;
const KILL_GOLD_RATE = 0.35;  // 처치 보상 배율

/* ------------------------------- 유닛 ------------------------------- */
class Fighter {
  constructor(stats, side, x, buff) {
    this.s = stats;
    this.side = side;                 // 'ally' | 'enemy'
    this.dir = side === 'ally' ? 1 : -1;
    this.x = x;
    this.row = Math.floor(Math.random() * 3);
    this.bob = Math.random() * Math.PI * 2;

    const hpMul = (buff && buff.hp) || 1;
    const atkMul = (buff && buff.atk) || 1;
    this.maxHp = Math.round(stats.hp * hpMul);
    this.hp = this.maxHp;
    this.atk = Math.round(stats.atk * atkMul);

    this.cd = stats.interval * 0.35;  // 등장 직후 약간의 준비 시간
    this.kbLeft = stats.kb || 1;
    this.kbTimer = 0;
    this.hitFlash = 0;
    this.swing = 0;
    this.dead = false;
    this.scale = stats.scale || 1;
    this.radius = 26 * this.scale;
  }

  get attackRange() { return this.s.range; }

  takeDamage(dmg) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hitFlash = 0.15;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; return; }
    // 넉백: 체력 구간을 넘길 때마다 뒤로 밀린다
    const kbTotal = this.s.kb || 1;
    const stepsLeft = Math.ceil((this.hp / this.maxHp) * kbTotal);
    if (stepsLeft < this.kbLeft) {
      this.kbLeft = stepsLeft;
      this.kbTimer = 0.42;
    }
  }
}

/* ------------------------------- 본진 ------------------------------- */
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
  }
  takeDamage(d) {
    this.hp -= d;
    this.hitFlash = 0.15;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }
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
    this.state = 'play';            // play | win | lose
    this.coins = 0;
    this.cooldowns = {};
    this.speed = 1;

    // 웨이브 큐 펼치기
    this.queue = [];
    this.stage.waves.forEach(w => {
      for (let i = 0; i < w.n; i++) this.queue.push({ t: w.t + i * w.gap, e: w.e });
    });
    this.queue.sort((a, b) => a.t - b.t);
    this.qi = 0;

    UNITS.forEach(u => { this.cooldowns[u.id] = 0; });
  }

  unlockedUnits() {
    const cleared = this.save.cleared;
    return UNITS.filter(u => u.unlockStage <= cleared + 1);
  }

  canDeploy(id) {
    const u = UNIT_BY_ID[id];
    return this.state === 'play' && this.cooldowns[id] <= 0 && this.money >= u.cost;
  }

  deploy(id) {
    if (!this.canDeploy(id)) return false;
    const u = UNIT_BY_ID[id];
    this.money -= u.cost;
    this.cooldowns[id] = u.cooldown;
    const lm = unitLevelMul(this.levels[id] || 1);
    const buff = { hp: this.buff.hp * lm, atk: this.buff.atk * lm };
    const f = new Fighter(u, 'ally', ALLY_SPAWN_X + Math.random() * 40, buff);
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

    // 적 등장
    while (this.qi < this.queue.length && this.queue[this.qi].t <= this.time) {
      const spec = ENEMIES[this.queue[this.qi].e];
      const st = Object.assign({ range: 60, speed: 40, interval: 1.2, kb: 1, scale: 1 }, spec);
      const f = new Fighter(st, 'enemy', ENEMY_SPAWN_X - Math.random() * 40, null);
      f.gold = spec.gold || 0;
      f.boss = !!spec.boss;
      this.enemies.push(f);
      this.qi++;
    }

    this.step(this.allies, this.enemies, this.enemyCastle, dt);
    this.step(this.enemies, this.allies, this.allyCastle, dt);

    // 사망 처리
    this.enemies = this.enemies.filter(e => {
      if (e.dead) {
        this.coins += Math.round((e.gold || 0) * KILL_GOLD_RATE);
        this.fx.push({ type: 'poof', x: e.x, row: e.row, t: 0.45, life: 0.45,
                       color: e.s.body, big: e.boss });
        return false;
      }
      return true;
    });
    this.allies = this.allies.filter(a => {
      if (a.dead) {
        this.fx.push({ type: 'poof', x: a.x, row: a.row, t: 0.45, life: 0.45, color: a.s.body });
        return false;
      }
      return true;
    });

    this.updateShots(dt);
    this.updateFx(dtRaw);

    if (this.enemyCastle.dead) this.finish('win');
    else if (this.allyCastle.dead) this.finish('lose');
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
      // 패배해도 처치 보상의 절반은 가져간다
      this.coins = Math.floor(this.coins * 0.5);
      this.save.coins += this.coins;
      saveGame(this.save);
    }
  }

  /* 한 진영의 행동 처리 */
  step(list, foes, foeCastle, dt) {
    for (const f of list) {
      if (f.dead) continue;
      if (f.hitFlash > 0) f.hitFlash -= dt;
      if (f.swing > 0) f.swing -= dt;
      f.bob += dt * (f.s.speed / 22);

      // 넉백 중이면 뒤로 밀림
      if (f.kbTimer > 0) {
        f.kbTimer -= dt;
        f.x -= f.dir * 150 * dt;
        f.x = Math.max(60, Math.min(WORLD - 60, f.x));
        continue;
      }

      const target = this.findTarget(f, foes, foeCastle);
      if (target) {
        f.cd -= dt;
        if (f.cd <= 0) {
          f.cd = f.s.interval;
          f.swing = 0.22;
          this.attack(f, target, foes, foeCastle);
        }
      } else {
        f.x += f.dir * f.s.speed * dt;
        f.x = Math.max(60, Math.min(WORLD - 60, f.x));
      }
    }
  }

  findTarget(f, foes, foeCastle) {
    const reach = f.attackRange + f.radius;
    let best = null, bestD = Infinity;
    for (const e of foes) {
      if (e.dead) continue;
      const d = (e.x - f.x) * f.dir;                 // 앞쪽이 양수
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

  attack(f, target, foes, foeCastle) {
    if (f.s.ranged) {
      this.shots.push({
        x: f.x, y0: f.row, tx: target.x, side: f.side, t: 0,
        dur: Math.max(0.18, Math.abs(target.x - f.x) / 900),
        color: f.s.accent, atk: f.atk, area: f.s.area, areaRadius: f.s.areaRadius,
        foes: foes, castle: foeCastle, dir: f.dir
      });
    } else {
      this.applyDamage(f.atk, target, f.x + f.dir * f.attackRange * 0.6,
                       f.s.area, f.s.areaRadius, foes, foeCastle);
      this.fx.push({ type: 'hit', x: target.x, row: target.row || 1, t: 0.2, life: 0.2 });
    }
  }

  applyDamage(atk, target, cx, area, radius, foes, foeCastle) {
    if (!area) {
      target.takeDamage(atk);
      return;
    }
    for (const e of foes) {
      if (e.dead) continue;
      if (Math.abs(e.x - cx) <= radius + e.radius) e.takeDamage(atk);
    }
    if (foeCastle && !foeCastle.dead && Math.abs(foeCastle.x - cx) <= radius + foeCastle.radius) {
      foeCastle.takeDamage(atk);
    }
    this.fx.push({ type: 'boom', x: cx, r: radius, t: 0.32, life: 0.32 });
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.t += dt;
      if (s.t >= s.dur) {
        s.done = true;
        // 도착 지점 주변에서 가장 가까운 적을 때린다
        let hit = null, bd = Infinity;
        for (const e of s.foes) {
          if (e.dead) continue;
          const d = Math.abs(e.x - s.tx);
          if (d < bd && d < 90) { bd = d; hit = e; }
        }
        if (!hit && s.castle && !s.castle.dead && Math.abs(s.castle.x - s.tx) < 110) hit = s.castle;
        if (hit || s.area) {
          this.applyDamage(s.atk, hit || { takeDamage: function () {} }, s.tx,
                           s.area, s.areaRadius, s.foes, s.castle);
        }
        this.fx.push({ type: 'hit', x: s.tx, row: s.y0, t: 0.2, life: 0.2 });
      }
    }
    this.shots = this.shots.filter(s => !s.done);
  }

  updateFx(dt) {
    for (const e of this.fx) e.t -= dt;
    this.fx = this.fx.filter(e => e.t > 0);
    if (this.state !== 'play') this.resultTime = (this.resultTime || 0) + dt;
  }

  /* 카메라가 따라갈 전선 위치 */
  frontline() {
    let front = ALLY_SPAWN_X + 260;
    for (const a of this.allies) front = Math.max(front, a.x);
    let back = ENEMY_SPAWN_X;
    for (const e of this.enemies) back = Math.min(back, e.x);
    if (this.enemies.length) return (front + back) / 2;
    return front;
  }
}
