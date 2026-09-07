/* =======================================================================
 *  막대 왕국 전쟁 - 캔버스 렌더러 (졸라맨 스타일)
 * ======================================================================= */

class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = ALLY_SPAWN_X;
    this.camTarget = this.cam;
    this.dragUntil = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.cv.getBoundingClientRect();
    this.w = Math.max(320, r.width);
    this.h = Math.max(240, r.height);
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // zoom: 월드 -> 화면 가로 배율 (한 화면에 약 720 월드유닛)
    this.zoom = Math.max(0.40, Math.min(0.95, this.w / 720));
    // cs: 캐릭터 크기 배율
    this.cs = Math.max(0.8, Math.min(1.45, this.h / 640));
    this.groundY = Math.round(Math.min(this.h * 0.76, this.h - 185));
  }

  viewWidth() { return this.w / this.zoom; }
  clampCam(x) {
    const half = this.viewWidth() / 2;
    return Math.max(half, Math.min(WORLD - half, x));
  }
  screenX(worldX) { return (worldX - this.cam) * this.zoom + this.w / 2; }
  rowY(row) { return this.groundY + (row || 0) * 10 * this.cs; }

  panBy(dxScreen) {
    this.camTarget = this.clampCam(this.camTarget - dxScreen / this.zoom);
    this.cam = this.camTarget;
    this.dragUntil = performance.now() + 2600;
  }

  follow(battle, dt) {
    if (performance.now() < this.dragUntil) return;
    this.camTarget = this.clampCam(battle.frontline());
    const k = 1 - Math.pow(0.001, dt);
    this.cam += (this.camTarget - this.cam) * k;
    this.cam = this.clampCam(this.cam);
  }

  /* --------------------------- 배경 --------------------------- */
  drawBackground(stageIndex) {
    const ctx = this.ctx, w = this.w, h = this.h;
    const pal = FIELD_PALETTES[stageIndex % FIELD_PALETTES.length];

    const sky = ctx.createLinearGradient(0, 0, 0, this.groundY);
    sky.addColorStop(0, pal.sky0);
    sky.addColorStop(1, pal.sky1);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // 해 / 달
    const ox = ((this.w * 0.74 - this.cam * 0.05) % (this.w + 240) + this.w + 240) % (this.w + 240) - 120;
    ctx.fillStyle = pal.orbGlow;
    ctx.beginPath(); ctx.arc(ox, this.groundY * 0.2, 44, 0, 7); ctx.fill();
    ctx.fillStyle = pal.orb;
    ctx.beginPath(); ctx.arc(ox, this.groundY * 0.2, 30, 0, 7); ctx.fill();
    if (pal.moon) {
      ctx.fillStyle = pal.sky0;
      ctx.beginPath(); ctx.arc(ox - 13, this.groundY * 0.2 - 8, 27, 0, 7); ctx.fill();
    }

    // 구름
    ctx.fillStyle = pal.cloud;
    const cpar = this.cam * 0.12;
    for (let i = 0; i < 9; i++) {
      const cx = ((i * 260 - cpar) % 2340 + 2340) % 2340 - 260;
      const cy = 46 + ((i * 53) % 5) * 24;
      const cr = 20 + (i % 3) * 9;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, 7);
      ctx.arc(cx + cr * 0.9, cy + 5, cr * 0.7, 0, 7);
      ctx.arc(cx - cr * 0.9, cy + 6, cr * 0.6, 0, 7);
      ctx.fill();
    }

    // 먼 산맥 (뾰족하게)
    const ridge = (color, amp, step, par, base) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-10, this.groundY + 10);
      const off = ((-this.cam * par) % (step * 2) + step * 2) % (step * 2);
      for (let x = -off - step; x < w + step * 2; x += step) {
        ctx.lineTo(x, this.groundY - base);
        ctx.lineTo(x + step / 2, this.groundY - base - amp);
      }
      ctx.lineTo(w + 20, this.groundY + 10);
      ctx.closePath();
      ctx.fill();
    };
    ridge(pal.ridgeFar, 120, 190, 0.14, 40);
    ridge(pal.ridge, 76, 130, 0.30, 10);

    // 땅
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, this.groundY + 2, w, h - this.groundY);
    ctx.fillStyle = pal.groundDark;
    ctx.fillRect(0, this.groundY + 2, w, 4);

    // 땅 무늬
    ctx.fillStyle = pal.speck;
    const step = 64;
    const off = ((-this.cam * this.zoom) % step + step) % step;
    for (let x = off - step; x < w + step; x += step) {
      const yy = this.groundY + 26 + ((x * 7) % 44);
      ctx.fillRect(x, yy, 14, 3);
    }
  }

  /* --------------------------- 소품 --------------------------- */
  drawProps(stageIndex) {
    const ctx = this.ctx, cs = this.cs;
    const pal = FIELD_PALETTES[stageIndex % FIELD_PALETTES.length];
    for (let i = 0; i < 24; i++) {
      const wx = 40 + i * 88 + ((i * 137) % 43);
      const x = this.screenX(wx);
      if (x < -70 || x > this.w + 70) continue;
      const kind = (i * 7) % 3;
      const y = this.groundY - 4 + ((i * 31) % 8);
      const sc = cs * (0.7 + ((i * 13) % 5) / 10);
      ctx.save();
      ctx.translate(x, y);
      if (kind === 0) {                 // 마른 나무
        ctx.strokeStyle = pal.prop; ctx.lineWidth = 4 * sc; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -44 * sc);
        ctx.moveTo(0, -28 * sc); ctx.lineTo(-14 * sc, -42 * sc);
        ctx.moveTo(0, -34 * sc); ctx.lineTo(13 * sc, -46 * sc);
        ctx.moveTo(0, -20 * sc); ctx.lineTo(11 * sc, -30 * sc);
        ctx.stroke();
      } else if (kind === 1) {          // 땅에 꽂힌 부러진 창
        ctx.strokeStyle = pal.prop; ctx.lineWidth = 3 * sc; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-3 * sc, 0); ctx.lineTo(6 * sc, -30 * sc); ctx.stroke();
        ctx.fillStyle = pal.prop;
        ctx.beginPath();
        ctx.moveTo(6 * sc, -38 * sc); ctx.lineTo(11 * sc, -28 * sc);
        ctx.lineTo(1 * sc, -28 * sc); ctx.closePath(); ctx.fill();
      } else {                          // 바위
        ctx.fillStyle = pal.prop;
        ctx.beginPath();
        ctx.moveTo(-14 * sc, 0); ctx.lineTo(-9 * sc, -12 * sc); ctx.lineTo(3 * sc, -15 * sc);
        ctx.lineTo(13 * sc, -5 * sc); ctx.lineTo(12 * sc, 0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* --------------------------- 본진 --------------------------- */
  drawCastle(c, isEnemy) {
    const ctx = this.ctx;
    const x = this.screenX(c.x);
    if (x < -240 || x > this.w + 240) return;
    const y = this.groundY + 8;
    const s = this.cs;
    const wdt = 112 * s, hgt = 150 * s;

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.20)';
    ctx.beginPath(); ctx.ellipse(0, 4, wdt * 0.6, 11 * s, 0, 0, 7); ctx.fill();

    if (!isEnemy) {
      /* 왕국 성채: 돌탑 */
      ctx.fillStyle = '#8e8b84';
      ctx.fillRect(-wdt / 2, -hgt, wdt, hgt);
      ctx.fillStyle = '#7a776f';
      for (let r = 0; r < 6; r++) {
        for (let col = 0; col < 4; col++) {
          const bx = -wdt / 2 + ((r % 2) ? 14 * s : 0) + col * 28 * s;
          ctx.fillRect(bx, -hgt + 14 * s + r * 22 * s, 24 * s, 3 * s);
        }
      }
      ctx.fillStyle = '#a5a29a';                       // 흉벽
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(-wdt / 2 + i * 24 * s, -hgt - 14 * s, 16 * s, 16 * s);
      }
      ctx.fillStyle = '#3b3128';                       // 성문
      ctx.beginPath();
      ctx.moveTo(-19 * s, 0); ctx.lineTo(-19 * s, -34 * s);
      ctx.arc(0, -34 * s, 19 * s, Math.PI, 0);
      ctx.lineTo(19 * s, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6b5c46'; ctx.lineWidth = 2 * s;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * 8 * s, 0); ctx.lineTo(i * 8 * s, -44 * s); ctx.stroke();
      }
      ctx.strokeStyle = '#7d7468'; ctx.lineWidth = 3 * s;   // 깃대
      ctx.beginPath(); ctx.moveTo(0, -hgt - 14 * s); ctx.lineTo(0, -hgt - 52 * s); ctx.stroke();
      ctx.fillStyle = '#3f6bb5';                            // 왕국기
      ctx.beginPath();
      ctx.moveTo(0, -hgt - 52 * s); ctx.lineTo(38 * s, -hgt - 44 * s);
      ctx.lineTo(0, -hgt - 30 * s); ctx.closePath(); ctx.fill();
    } else {
      /* 오크 요새: 통나무 방벽 */
      ctx.fillStyle = '#4a3a28';
      ctx.fillRect(-wdt / 2, -hgt, wdt, hgt);
      ctx.strokeStyle = '#33261a'; ctx.lineWidth = 3 * s;
      for (let i = 0; i < 6; i++) {
        const bx = -wdt / 2 + 10 * s + i * 18 * s;
        ctx.beginPath(); ctx.moveTo(bx, -hgt); ctx.lineTo(bx, 0); ctx.stroke();
      }
      ctx.fillStyle = '#5c4830';                        // 뾰족한 말뚝
      for (let i = 0; i < 6; i++) {
        const bx = -wdt / 2 + i * 19 * s;
        ctx.beginPath();
        ctx.moveTo(bx, -hgt); ctx.lineTo(bx + 9 * s, -hgt - 22 * s);
        ctx.lineTo(bx + 18 * s, -hgt); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#1c1610';                        // 어두운 입구
      ctx.fillRect(-18 * s, -46 * s, 36 * s, 46 * s);
      ctx.fillStyle = '#d8d2c2';                        // 해골 토템
      ctx.beginPath(); ctx.arc(0, -hgt - 34 * s, 12 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#1c1610';
      ctx.beginPath(); ctx.arc(-4.5 * s, -hgt - 36 * s, 3.2 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(4.5 * s, -hgt - 36 * s, 3.2 * s, 0, 7); ctx.fill();
      ctx.fillRect(-4 * s, -hgt - 28 * s, 8 * s, 5 * s);
      ctx.fillStyle = '#8e2f3a';                        // 붉은 깃발
      ctx.beginPath();
      ctx.moveTo(-wdt / 2, -hgt - 6 * s); ctx.lineTo(-wdt / 2 - 30 * s, -hgt + 2 * s);
      ctx.lineTo(-wdt / 2, -hgt + 18 * s); ctx.closePath(); ctx.fill();
    }

    if (c.hitFlash > 0) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-wdt / 2, -hgt, wdt, hgt);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 본진 체력바
    const bw = 100 * s;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    rectPath(ctx, x - bw / 2, y - hgt - 66 * s, bw, 9 * s); ctx.fill();
    ctx.fillStyle = isEnemy ? '#c0392b' : '#3f8ed0';
    rectPath(ctx, x - bw / 2, y - hgt - 66 * s, bw * (c.hp / c.maxHp), 9 * s); ctx.fill();
  }

  /* --------------------------- 병사 --------------------------- */
  drawFighter(f) {
    const ctx = this.ctx;
    const x = this.screenX(f.x);
    if (x < -140 || x > this.w + 140) return;
    const s = this.cs * f.scale;
    const y = this.rowY(f.row);
    const moving = f.kbTimer <= 0 && f.swing <= 0;
    const atk = f.swing > 0 ? (f.swing / 0.22) : 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f.dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(0, 1, 17 * s, 4.5 * s, 0, 0, 7); ctx.fill();
    drawBody(ctx, f.s.shape, f.s.body, f.s.accent, s,
             false, f.kbTimer > 0, f.bob, moving, atk);
    if (f.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.55, f.hitFlash * 3.5);
      drawBody(ctx, f.s.shape, f.s.body, f.s.accent, s,
               true, f.kbTimer > 0, f.bob, moving, atk);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (f.hp < f.maxHp) {
      const bw = 32 * s;
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      rectPath(ctx, x - bw / 2, y - 72 * s, bw, 5 * s); ctx.fill();
      ctx.fillStyle = f.side === 'ally' ? '#4fa3e0' : '#c0392b';
      rectPath(ctx, x - bw / 2, y - 72 * s, bw * (f.hp / f.maxHp), 5 * s); ctx.fill();
    }
  }

  drawShots(battle) {
    const ctx = this.ctx, cs = this.cs;
    for (const s of battle.shots) {
      const p = s.t / s.dur;
      const wx = s.x + (s.tx - s.x) * p;
      const x = this.screenX(wx);
      const y = this.rowY(s.y0) - 36 * cs - Math.sin(p * Math.PI) * 60 * cs;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.dir > 0 ? (p - 0.5) * 1.4 : Math.PI - (p - 0.5) * 1.4);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.4 * cs; ctx.lineCap = 'round';
      if (s.area) {                       // 투석기 바위
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(0, 0, 6 * cs, 0, 7); ctx.fill();
      } else {                            // 화살
        ctx.beginPath(); ctx.moveTo(-9 * cs, 0); ctx.lineTo(8 * cs, 0); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12 * cs, 0); ctx.lineTo(6 * cs, -3.5 * cs); ctx.lineTo(6 * cs, 3.5 * cs);
        ctx.closePath(); ctx.fillStyle = s.color; ctx.fill();
      }
      ctx.restore();
    }
  }

  drawFx(battle) {
    const ctx = this.ctx, cs = this.cs;
    for (const e of battle.fx) {
      const p = e.t / e.life;
      const x = this.screenX(e.x);
      const y = this.rowY(e.row || 0) - 28 * cs;
      if (e.type === 'hit') {
        ctx.strokeStyle = 'rgba(255,255,255,' + p + ')';
        ctx.lineWidth = 2.5 * cs;
        for (let i = 0; i < 3; i++) {
          const a = -0.6 + i * 0.7;
          const d = (1 - p) * 22 * cs + 6;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * d * 0.4, y + Math.sin(a) * d * 0.4);
          ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
          ctx.stroke();
        }
      } else if (e.type === 'boom') {
        const r = e.r * this.zoom * (1.05 - p * 0.35);
        ctx.fillStyle = 'rgba(240,190,110,' + (p * 0.45) + ')';
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,210,' + p + ')';
        ctx.lineWidth = 2.5 * cs;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, 7); ctx.stroke();
      } else if (e.type === 'poof') {
        const n = e.big ? 12 : 7;
        ctx.strokeStyle = e.color || '#fff';
        ctx.lineWidth = 2.4 * cs;
        ctx.globalAlpha = p;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const d = (1 - p) * (e.big ? 62 : 34) * cs;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * d * 0.55, y + Math.sin(a) * d * 0.35);
          ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'spawn') {
        ctx.strokeStyle = 'rgba(255,255,255,' + p + ')';
        ctx.lineWidth = 2.5 * cs;
        ctx.beginPath();
        ctx.ellipse(x, this.rowY(e.row) + 2, (1 - p) * 30 * cs, (1 - p) * 10 * cs, 0, 0, 7);
        ctx.stroke();
      }
    }
  }

  render(battle, dt) {
    this.follow(battle, dt);
    this.drawBackground(battle.stageIndex);
    this.drawProps(battle.stageIndex);
    this.drawCastle(battle.allyCastle, false);
    this.drawCastle(battle.enemyCastle, true);

    const all = battle.allies.concat(battle.enemies);
    all.sort((a, b) => (a.row - b.row) || (a.x - b.x));
    for (const f of all) this.drawFighter(f);

    this.drawShots(battle);
    this.drawFx(battle);
    this.drawMiniMap(battle);
  }

  drawMiniMap(battle) {
    const ctx = this.ctx;
    const w = Math.min(280, this.w - 40), h = 8;
    const x0 = (this.w - w) / 2, y0 = 8;
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    rectPath(ctx, x0, y0, w, h); ctx.fill();
    const put = (wx, color, r) => {
      const px = x0 + (wx / WORLD) * w;
      ctx.fillStyle = color;
      ctx.fillRect(px - r / 2, y0 + h / 2 - r / 2, r, r);
    };
    battle.allies.forEach(a => put(a.x, '#6fc0ff', 4));
    battle.enemies.forEach(e => put(e.x, e.boss ? '#ff4a3a' : '#8ec26a', e.boss ? 7 : 4));
    put(ALLY_BASE_X, '#ffffff', 7);
    put(ENEMY_BASE_X, '#2a1c14', 7);
    const vw = (this.viewWidth() / WORLD) * w;
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + (this.cam / WORLD) * w - vw / 2, y0 - 2, vw, h + 4);
  }
}

/* =======================================================================
 *  졸라맨 캐릭터 드로잉
 *  발끝 y = 0, 머리 꼭대기 ≈ -54*s. 항상 +x 방향(앞)을 본다.
 * ======================================================================= */
function drawBody(ctx, shape, body, accent, s, flash, hurt, phase, moving, atk) {
  const col = flash ? '#ffffff' : body;
  const acc = flash ? '#ffffff' : accent;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const S = {
    ctx: ctx, s: s, col: col, acc: acc, phase: phase, moving: moving,
    atk: atk, hurt: hurt, lw: 3.4 * s
  };

  switch (shape) {
    /* ------------------ 왕국군 ------------------ */
    case 'spear':
      legs(S); torso(S); head(S, 'cap');
      armWeapon(S, -0.35, () => {                     // 창
        line(S, 0, 0, 46 * s, -10 * s, 3.2 * s, flash ? '#fff' : '#6b4b2a');
        tri(S, 46 * s, -10 * s, 36 * s, -16 * s, 36 * s, -3 * s, S.acc);
      }, 10 * s);
      break;

    case 'shield':
      legs(S); torso(S); head(S, 'pot');
      armWeapon(S, -0.1, () => {                      // 짧은 검
        line(S, 0, 0, 26 * s, -6 * s, 3 * s, '#c8ced6');
      }, 6 * s);
      // 방패
      ctx.fillStyle = S.acc;
      ctx.beginPath();
      ctx.moveTo(13 * s, -48 * s); ctx.lineTo(30 * s, -44 * s);
      ctx.lineTo(30 * s, -16 * s); ctx.lineTo(21 * s, -6 * s);
      ctx.lineTo(13 * s, -16 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = flash ? '#fff' : '#e0d3b8'; ctx.lineWidth = 2 * s;
      ctx.stroke();
      break;

    case 'archer':
      legs(S); torso(S); head(S, 'hood');
      ctx.strokeStyle = S.acc; ctx.lineWidth = 3 * s;   // 활
      ctx.beginPath();
      ctx.arc(20 * s, -34 * s, 19 * s, -1.3, 1.3); ctx.stroke();
      ctx.strokeStyle = flash ? '#fff' : '#e6e0d0'; ctx.lineWidth = 1.4 * s;
      const pull = 7 * s * atk;
      const bx = 20 * s + Math.cos(1.3) * 19 * s, by = 19 * s * Math.sin(1.3);
      ctx.beginPath();
      ctx.moveTo(bx, -34 * s - by);
      ctx.lineTo(11 * s - pull, -34 * s);
      ctx.lineTo(bx, -34 * s + by); ctx.stroke();
      if (atk > 0.15) {                                  // 시위에 걸린 화살
        ctx.strokeStyle = flash ? '#fff' : '#6b4b2a'; ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(11 * s - pull, -34 * s); ctx.lineTo(34 * s, -34 * s); ctx.stroke();
      }
      arm(S, 20 * s, -34 * s);
      break;

    case 'berserk':
      legs(S); torso(S); head(S, 'horn');
      armWeapon(S, -1.2 + atk * 1.8, () => axe(S, 1), 0);
      armWeapon(S, 1.0 - atk * 1.6, () => axe(S, -1), 0);
      break;

    case 'bomber':
      legs(S); torso(S); head(S, 'cap');
      // 머리 위 화약통
      ctx.fillStyle = S.acc;
      ctx.fillRect(-11 * s, -90 * s, 22 * s, 20 * s);
      ctx.strokeStyle = flash ? '#fff' : '#2b2b2b'; ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(-11 * s, -84 * s); ctx.lineTo(11 * s, -84 * s);
      ctx.moveTo(-11 * s, -76 * s); ctx.lineTo(11 * s, -76 * s); ctx.stroke();
      ctx.strokeStyle = flash ? '#fff' : '#d9b45a'; ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(2 * s, -90 * s); ctx.quadraticCurveTo(8 * s, -100 * s, 14 * s, -96 * s); ctx.stroke();
      ctx.fillStyle = '#ffcf5c';
      ctx.beginPath(); ctx.arc(15 * s, -96 * s, 3.4 * s, 0, 7); ctx.fill();
      arm(S, 10 * s, -72 * s); arm(S, -10 * s, -72 * s);
      break;

    case 'knight':
      // 망토
      ctx.fillStyle = flash ? '#fff' : '#8e2f3a';
      ctx.beginPath();
      ctx.moveTo(-3 * s, -48 * s); ctx.lineTo(-20 * s, -10 * s);
      ctx.lineTo(-4 * s, -14 * s); ctx.closePath(); ctx.fill();
      legs(S); torso(S, 4.4 * s); head(S, 'plume');
      armWeapon(S, -1.35 + atk * 2.1, () => {          // 대검
        ctx.strokeStyle = S.acc; ctx.lineWidth = 5 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(50 * s, 0); ctx.stroke();
        ctx.strokeStyle = flash ? '#fff' : '#6b5a3f'; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.moveTo(4 * s, -8 * s); ctx.lineTo(4 * s, 8 * s); ctx.stroke();
      }, 8 * s);
      break;

    case 'catapult': {
      // 나무 프레임
      ctx.strokeStyle = col; ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(-24 * s, -8 * s); ctx.lineTo(22 * s, -8 * s);
      ctx.moveTo(-16 * s, -8 * s); ctx.lineTo(-2 * s, -38 * s);
      ctx.moveTo(10 * s, -8 * s); ctx.lineTo(-2 * s, -38 * s); ctx.stroke();
      // 던지는 팔
      ctx.save();
      ctx.translate(-2 * s, -38 * s);
      ctx.rotate(-2.4 + atk * 2.0);
      ctx.strokeStyle = acc; ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40 * s, 0); ctx.stroke();
      ctx.fillStyle = flash ? '#fff' : '#7a7a72';
      ctx.beginPath(); ctx.arc(42 * s, -4 * s, 6 * s, 0, 7); ctx.fill();
      ctx.restore();
      // 바퀴
      ctx.strokeStyle = acc; ctx.lineWidth = 3.5 * s;
      [-16, 12].forEach(wx => {
        ctx.beginPath(); ctx.arc(wx * s, -8 * s, 9 * s, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(wx * s - 6 * s, -8 * s); ctx.lineTo(wx * s + 6 * s, -8 * s);
        ctx.moveTo(wx * s, -14 * s); ctx.lineTo(wx * s, -2 * s); ctx.stroke();
      });
      // 조작병
      const O = Object.assign({}, S, { s: s * 0.62, lw: 2.6 * s, moving: false });
      ctx.save(); ctx.translate(-30 * s, 0);
      legs(O); torso(O); head(O, 'cap'); arm(O, 12 * O.s, -34 * O.s);
      ctx.restore();
      break;
    }

    case 'mage':
      // 로브
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -46 * s); ctx.lineTo(19 * s, 0); ctx.lineTo(-19 * s, 0);
      ctx.closePath(); ctx.fill();
      // 머리 + 뾰족 모자
      ctx.fillStyle = flash ? '#fff' : '#e8d9bd';
      ctx.beginPath(); ctx.arc(0, -54 * s, 8 * s, 0, 7); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-13 * s, -60 * s); ctx.lineTo(13 * s, -60 * s); ctx.lineTo(3 * s, -92 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : '#3a2f22';       // 눈
      ctx.beginPath(); ctx.arc(3 * s, -55 * s, 1.8 * s, 0, 7); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : '#efeade';       // 수염
      ctx.beginPath();
      ctx.moveTo(-7 * s, -50 * s); ctx.lineTo(7 * s, -50 * s); ctx.lineTo(0, -30 * s);
      ctx.closePath(); ctx.fill();
      // 지팡이
      ctx.strokeStyle = flash ? '#fff' : '#6b5a3f'; ctx.lineWidth = 3.4 * s;
      ctx.beginPath(); ctx.moveTo(16 * s, -4 * s); ctx.lineTo(20 * s, -70 * s); ctx.stroke();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(20 * s, -76 * s, 7 * s + 2 * s * atk, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.35 + 0.4 * atk;
      ctx.beginPath(); ctx.arc(20 * s, -76 * s, 13 * s + 6 * s * atk, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      break;

    /* ------------------ 오크 군단 ------------------ */
    case 'goblin':
      legs(S); torso(S); head(S, 'ears');
      armWeapon(S, -0.9 + atk * 1.5, () => {           // 몽둥이
        line(S, 0, 0, 22 * s, 0, 4.5 * s, S.acc);
        ctx.fillStyle = S.acc;
        ctx.beginPath(); ctx.arc(24 * s, 0, 6 * s, 0, 7); ctx.fill();
      }, 6 * s);
      break;

    case 'orcspear':
      legs(S); torso(S); head(S, 'tusk');
      armWeapon(S, -0.25, () => {
        line(S, 0, 0, 42 * s, -8 * s, 3.2 * s, '#6b4b2a');
        tri(S, 44 * s, -8 * s, 34 * s, -14 * s, 34 * s, -2 * s, S.acc);
      }, 10 * s);
      break;

    case 'ogre': {
      const O = Object.assign({}, S, { lw: 6 * s });
      legs(O, 20 * s);
      ctx.fillStyle = col;                              // 배
      ctx.beginPath(); ctx.ellipse(0, -30 * s, 11 * s, 13 * s, 0, 0, 7); ctx.fill();
      torso(O, 6 * s); head(O, 'tusk', 10 * s);
      armWeapon(O, -1.0 + atk * 1.6, () => {            // 큰 몽둥이
        line(O, 0, 0, 34 * s, 0, 8 * s, O.acc);
        ctx.fillStyle = O.acc;
        ctx.beginPath(); ctx.arc(36 * s, 0, 10 * s, 0, 7); ctx.fill();
      }, 8 * s);
      break;
    }

    case 'wolf': {
      // 늑대: 몸통
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-24 * s, -30 * s);
      ctx.quadraticCurveTo(0, -40 * s, 20 * s, -32 * s);
      ctx.quadraticCurveTo(24 * s, -18 * s, 8 * s, -16 * s);
      ctx.quadraticCurveTo(-10 * s, -13 * s, -24 * s, -18 * s);
      ctx.closePath(); ctx.fill();
      // 다리
      ctx.strokeStyle = col; ctx.lineWidth = 3.6 * s;
      const sw = moving ? Math.sin(phase * 1.7) * 8 * s : 3 * s;
      ctx.beginPath();
      ctx.moveTo(-16 * s, -18 * s); ctx.lineTo(-18 * s + sw, 0);
      ctx.moveTo(-10 * s, -18 * s); ctx.lineTo(-8 * s - sw, 0);
      ctx.moveTo(10 * s, -18 * s); ctx.lineTo(8 * s - sw, 0);
      ctx.moveTo(16 * s, -18 * s); ctx.lineTo(18 * s + sw, 0);
      ctx.stroke();
      // 덥수룩한 꼬리
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-22 * s, -28 * s); ctx.lineTo(-44 * s, -44 * s);
      ctx.lineTo(-38 * s, -30 * s); ctx.lineTo(-22 * s, -20 * s);
      ctx.closePath(); ctx.fill();
      // 머리 + 주둥이
      ctx.beginPath();
      ctx.moveTo(16 * s, -40 * s);
      ctx.lineTo(30 * s, -42 * s); ctx.lineTo(44 * s, -32 * s);
      ctx.lineTo(30 * s, -26 * s); ctx.lineTo(18 * s, -28 * s);
      ctx.closePath(); ctx.fill();
      // 귀
      tri(S, 18 * s, -42 * s, 20 * s, -56 * s, 28 * s, -44 * s, col);
      tri(S, 28 * s, -44 * s, 33 * s, -56 * s, 36 * s, -42 * s, col);
      // 눈 / 이빨
      ctx.fillStyle = '#f5e96a';
      ctx.beginPath(); ctx.arc(29 * s, -37 * s, 2.4 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#efe6cf';
      tri(S, 36 * s, -30 * s, 40 * s, -30 * s, 37 * s, -24 * s, '#efe6cf');
      // 기수
      const R = Object.assign({}, S, { s: s * 0.78, lw: 3 * s, moving: false });
      ctx.save(); ctx.translate(-2 * s, -31 * s);
      ctx.strokeStyle = R.col; ctx.lineWidth = R.lw;   // 앉은 다리
      ctx.beginPath();
      ctx.moveTo(0, -19 * R.s); ctx.lineTo(14 * R.s, -12 * R.s);
      ctx.lineTo(10 * R.s, 2 * R.s); ctx.stroke();
      torso(R); head(R, 'tusk');
      armWeapon(R, -0.7 + atk * 1.2,
                () => line(R, 0, 0, 34 * R.s, -8 * R.s, 3.2 * R.s, '#b0b6bd'), 6 * R.s);
      ctx.restore();
      break;
    }

    case 'ballista':
      legs(S); torso(S); head(S, 'tusk');
      // 석궁
      ctx.strokeStyle = S.acc; ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(6 * s, -34 * s); ctx.lineTo(30 * s, -34 * s); ctx.stroke();
      ctx.strokeStyle = flash ? '#fff' : '#8a8f96'; ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(24 * s, -46 * s); ctx.lineTo(24 * s, -22 * s); ctx.stroke();
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      ctx.moveTo(24 * s, -46 * s); ctx.lineTo(10 * s + 6 * s * atk, -34 * s);
      ctx.lineTo(24 * s, -22 * s); ctx.stroke();
      arm(S, 18 * s, -34 * s);
      break;

    case 'powder':
      legs(S); torso(S); head(S, 'ears');
      ctx.fillStyle = S.acc;                             // 등에 진 통
      ctx.fillRect(-26 * s, -52 * s, 20 * s, 26 * s);
      ctx.strokeStyle = flash ? '#fff' : '#2b2b2b'; ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(-26 * s, -44 * s); ctx.lineTo(-6 * s, -44 * s);
      ctx.moveTo(-26 * s, -34 * s); ctx.lineTo(-6 * s, -34 * s); ctx.stroke();
      ctx.fillStyle = '#ffcf5c';
      ctx.beginPath(); ctx.arc(-16 * s, -56 * s, 3.4 * s, 0, 7); ctx.fill();
      arm(S, 12 * s, -30 * s);
      break;

    case 'dark':
      ctx.fillStyle = flash ? '#fff' : accent;           // 붉은 망토
      ctx.beginPath();
      ctx.moveTo(-3 * s, -50 * s); ctx.lineTo(-22 * s, -8 * s);
      ctx.lineTo(-4 * s, -14 * s); ctx.closePath(); ctx.fill();
      legs(S); torso(S, 4.6 * s); head(S, 'devil');
      armWeapon(S, -1.4 + atk * 2.2, () => {             // 흑검
        ctx.strokeStyle = flash ? '#fff' : '#4a4a55'; ctx.lineWidth = 5.5 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(52 * s, 0); ctx.stroke();
        ctx.strokeStyle = flash ? '#fff' : accent; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.moveTo(4 * s, -9 * s); ctx.lineTo(4 * s, 9 * s); ctx.stroke();
      }, 8 * s);
      break;

    case 'troll': {
      const O = Object.assign({}, S, { lw: 7 * s });
      legs(O, 24 * s);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -40 * s, 14 * s, 17 * s, 0, 0, 7); ctx.fill();
      torso(O, 7 * s); head(O, 'tusk', 12 * s);
      // 긴 팔 + 통나무 몽둥이
      armWeapon(O, -1.1 + atk * 1.7, () => {
        line(O, 0, 0, 46 * s, 0, 11 * s, O.acc);
        ctx.fillStyle = O.acc;
        ctx.beginPath(); ctx.arc(48 * s, 0, 13 * s, 0, 7); ctx.fill();
        ctx.strokeStyle = flash ? '#fff' : '#8a7a5a'; ctx.lineWidth = 2.5 * s;
        for (let i = 0; i < 4; i++) {
          const a = i * 1.4;
          ctx.beginPath();
          ctx.moveTo(48 * s + Math.cos(a) * 11 * s, Math.sin(a) * 11 * s);
          ctx.lineTo(48 * s + Math.cos(a) * 17 * s, Math.sin(a) * 17 * s);
          ctx.stroke();
        }
      }, 10 * s);
      break;
    }

    case 'warlord': {
      const O = Object.assign({}, S, { lw: 7.5 * s });
      ctx.fillStyle = flash ? '#fff' : accent;           // 망토
      ctx.beginPath();
      ctx.moveTo(-4 * s, -58 * s); ctx.lineTo(-30 * s, -6 * s);
      ctx.lineTo(-4 * s, -16 * s); ctx.closePath(); ctx.fill();
      legs(O, 26 * s);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -42 * s, 15 * s, 18 * s, 0, 0, 7); ctx.fill();
      torso(O, 8 * s); head(O, 'crown', 12 * s);
      armWeapon(O, -1.3 + atk * 2.0, () => {             // 양날 도끼
        line(O, 0, 0, 46 * s, 0, 5 * s, '#6b4b2a');
        ctx.fillStyle = flash ? '#fff' : '#b0b6bd';
        ctx.beginPath();
        ctx.moveTo(36 * s, -4 * s); ctx.lineTo(56 * s, -22 * s); ctx.lineTo(58 * s, -2 * s);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(36 * s, 4 * s); ctx.lineTo(56 * s, 22 * s); ctx.lineTo(58 * s, 2 * s);
        ctx.closePath(); ctx.fill();
      }, 10 * s);
      break;
    }

    case 'lich': {
      // 떠 있는 로브 (다리 없음)
      const fl = Math.sin(phase * 0.8) * 3 * s;
      ctx.save(); ctx.translate(0, fl - 6 * s);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -50 * s);
      ctx.quadraticCurveTo(20 * s, -20 * s, 12 * s, 0);
      ctx.quadraticCurveTo(0, -8 * s, -12 * s, 0);
      ctx.quadraticCurveTo(-20 * s, -20 * s, 0, -50 * s);
      ctx.fill();
      ctx.fillStyle = flash ? '#fff' : '#efeade';        // 해골
      ctx.beginPath(); ctx.arc(0, -58 * s, 9 * s, 0, 7); ctx.fill();
      ctx.fillRect(-5 * s, -52 * s, 10 * s, 6 * s);
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(-3.5 * s, -60 * s, 2.6 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(3.5 * s, -60 * s, 2.6 * s, 0, 7); ctx.fill();
      ctx.fillStyle = col;                                // 후드
      ctx.beginPath();
      ctx.moveTo(-13 * s, -56 * s); ctx.lineTo(0, -78 * s); ctx.lineTo(13 * s, -56 * s);
      ctx.lineTo(9 * s, -60 * s); ctx.lineTo(-9 * s, -60 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = flash ? '#fff' : '#4a3a2a'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(17 * s, -6 * s); ctx.lineTo(20 * s, -66 * s); ctx.stroke();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(20 * s, -72 * s, 6 * s + 2 * s * atk, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(20 * s, -72 * s, 12 * s + 5 * s * atk, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }

    default:
      legs(S); torso(S); head(S, 'cap');
  }

  if (hurt) {                                            // 넉백 중 표시
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(-14 * s, -70 * s); ctx.lineTo(-8 * s, -76 * s);
    ctx.moveTo(-2 * s, -74 * s); ctx.lineTo(-2 * s, -82 * s); ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------- 졸라맨 부품 ---------------------- */
function legs(S, hipY) {
  const { ctx, s } = S;
  const hy = -(hipY || 19 * s);
  const sw = S.moving ? Math.sin(S.phase) * 8 * s : 2 * s;
  ctx.strokeStyle = S.col; ctx.lineWidth = S.lw;
  ctx.beginPath();
  ctx.moveTo(0, hy); ctx.lineTo(5 * s + sw, 0);
  ctx.moveTo(0, hy); ctx.lineTo(-5 * s - sw, 0);
  ctx.stroke();
}

function torso(S, lw) {
  const { ctx, s } = S;
  ctx.strokeStyle = S.col; ctx.lineWidth = lw || S.lw;
  ctx.beginPath();
  ctx.moveTo(0, -19 * s); ctx.lineTo(0, -42 * s);
  ctx.stroke();
}

function arm(S, hx, hy) {
  const { ctx, s } = S;
  ctx.strokeStyle = S.col; ctx.lineWidth = S.lw * 0.85;
  ctx.beginPath();
  ctx.moveTo(0, -38 * s);
  ctx.quadraticCurveTo(hx * 0.55, -38 * s + (hy + 38 * s) * 0.3, hx, hy);
  ctx.stroke();
}

/* 어깨에서 뻗은 팔 + 회전하는 무기 */
function armWeapon(S, angle, drawWeapon, gripY) {
  const { ctx, s } = S;
  const gx = 12 * s, gy = -34 * s - (gripY || 0) * 0.15;
  arm(S, gx, gy);
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(angle);
  drawWeapon();
  ctx.restore();
}

function head(S, type, radius) {
  const { ctx, s } = S;
  const r = radius || 8.5 * s;
  const cy = -50 * s;
  ctx.fillStyle = S.col;
  ctx.beginPath(); ctx.arc(0, cy, r, 0, 7); ctx.fill();

  ctx.fillStyle = S.acc;
  ctx.strokeStyle = S.acc;
  switch (type) {
    case 'cap':                                   // 철모
      ctx.beginPath();
      ctx.arc(0, cy - 1 * s, r + 1.5 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 3 * s, cy - 2 * s, (r + 3 * s) * 2, 2.6 * s);
      break;
    case 'pot':                                   // 투구 (얼굴 가림)
      ctx.beginPath();
      ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 6 * s);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-r, cy + 1 * s, r * 2, 2 * s);
      break;
    case 'hood':                                  // 두건
      ctx.beginPath();
      ctx.moveTo(-r - 2 * s, cy + 2 * s); ctx.lineTo(0, cy - r - 8 * s);
      ctx.lineTo(r + 2 * s, cy + 2 * s); ctx.closePath(); ctx.fill();
      break;
    case 'plume':                                 // 깃털 투구
      ctx.beginPath();
      ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 5 * s);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(-2 * s, cy - r - 2 * s);
      ctx.quadraticCurveTo(-14 * s, cy - r - 14 * s, -16 * s, cy - r + 4 * s);
      ctx.quadraticCurveTo(-8 * s, cy - r - 4 * s, 2 * s, cy - r - 2 * s);
      ctx.fill();
      break;
    case 'horn':                                  // 뿔 투구
      ctx.beginPath();
      ctx.arc(0, cy - 1 * s, r + 1.5 * s, Math.PI, 0); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r, cy - 4 * s); ctx.lineTo(-r - 9 * s, cy - 14 * s);
      ctx.lineTo(-r + 1 * s, cy - 10 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r, cy - 4 * s); ctx.lineTo(r + 9 * s, cy - 14 * s);
      ctx.lineTo(r - 1 * s, cy - 10 * s); ctx.closePath(); ctx.fill();
      break;
    case 'devil':                                 // 흑기사 투구
      ctx.beginPath();
      ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 7 * s);
      ctx.beginPath();
      ctx.moveTo(-r, cy - 6 * s); ctx.lineTo(-r - 4 * s, cy - 18 * s);
      ctx.lineTo(-r + 3 * s, cy - 9 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r, cy - 6 * s); ctx.lineTo(r + 4 * s, cy - 18 * s);
      ctx.lineTo(r - 3 * s, cy - 9 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e04b3a';
      ctx.fillRect(-r * 0.7, cy + 1 * s, r * 1.4, 2.2 * s);
      break;
    case 'ears':                                  // 고블린 귀
      ctx.fillStyle = S.col;
      ctx.beginPath();
      ctx.moveTo(-r + 1 * s, cy - 2 * s); ctx.lineTo(-r - 11 * s, cy - 9 * s);
      ctx.lineTo(-r + 1 * s, cy + 4 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r - 1 * s, cy - 2 * s); ctx.lineTo(r + 11 * s, cy - 9 * s);
      ctx.lineTo(r - 1 * s, cy + 4 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f5e96a';
      ctx.beginPath(); ctx.arc(3 * s, cy - 1 * s, 2 * s, 0, 7); ctx.fill();
      break;
    case 'tusk':                                  // 오크 엄니
      ctx.fillStyle = '#efe6cf';
      ctx.beginPath();
      ctx.moveTo(-4 * s, cy + r * 0.5); ctx.lineTo(-6 * s, cy + r + 5 * s);
      ctx.lineTo(-1 * s, cy + r * 0.6); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4 * s, cy + r * 0.5); ctx.lineTo(6 * s, cy + r + 5 * s);
      ctx.lineTo(1 * s, cy + r * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f5e96a';
      ctx.beginPath(); ctx.arc(4 * s, cy - 1 * s, 2.2 * s, 0, 7); ctx.fill();
      break;
    case 'crown':                                 // 대군주 관
      ctx.fillStyle = '#efe6cf';
      ctx.beginPath();
      ctx.moveTo(-5 * s, cy + r * 0.5); ctx.lineTo(-8 * s, cy + r + 7 * s);
      ctx.lineTo(-1 * s, cy + r * 0.6); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5 * s, cy + r * 0.5); ctx.lineTo(8 * s, cy + r + 7 * s);
      ctx.lineTo(1 * s, cy + r * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9a227';
      ctx.beginPath();
      ctx.moveTo(-r - 2 * s, cy - r + 1 * s); ctx.lineTo(-r - 2 * s, cy - r - 12 * s);
      ctx.lineTo(-r * 0.4, cy - r - 3 * s); ctx.lineTo(0, cy - r - 16 * s);
      ctx.lineTo(r * 0.4, cy - r - 3 * s); ctx.lineTo(r + 2 * s, cy - r - 12 * s);
      ctx.lineTo(r + 2 * s, cy - r + 1 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e04b3a';
      ctx.beginPath(); ctx.arc(4 * s, cy - 1 * s, 2.4 * s, 0, 7); ctx.fill();
      break;
  }
}

function axe(S, side) {
  const { ctx, s } = S;
  ctx.strokeStyle = '#6b4b2a'; ctx.lineWidth = 3.2 * s;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28 * s, 0); ctx.stroke();
  ctx.fillStyle = '#b0b6bd';
  ctx.beginPath();
  ctx.moveTo(19 * s, -2 * s * side);
  ctx.lineTo(31 * s, -13 * s * side);
  ctx.lineTo(37 * s, -6 * s * side);
  ctx.lineTo(30 * s, 3 * s * side);
  ctx.closePath(); ctx.fill();
}

function line(S, x1, y1, x2, y2, w, col) {
  const ctx = S.ctx;
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function tri(S, x1, y1, x2, y2, x3, y3, col) {
  const ctx = S.ctx;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
  ctx.closePath(); ctx.fill();
}

function rectPath(ctx, x, y, w, h) {
  ctx.beginPath(); ctx.rect(x, y, w, h);
}

/* 카드/도감용 아이콘 렌더 */
function drawUnitIcon(canvas, stats, size) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = size || 52;
  canvas.width = px * dpr;
  canvas.height = px * dpr;
  canvas.style.width = px + 'px';
  canvas.style.height = px + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, px, px);
  const s = (px / 96) * (stats.shape === 'catapult' ? 1.15 : 1);
  ctx.save();
  ctx.translate(px * 0.44, px * 0.94);
  drawBody(ctx, stats.shape, stats.body, stats.accent, s, false, false, 0, false, 0);
  ctx.restore();
}

const FIELD_PALETTES = [
  { sky0: '#9dc4dd', sky1: '#e4e2cf', cloud: 'rgba(255,255,255,.8)',
    ridgeFar: '#7e94a0', ridge: '#5f7a63', ground: '#8a7a55', groundDark: '#5f5238', speck: '#7a6b48' },
  { sky0: '#d8b98a', sky1: '#f2e3c4', cloud: 'rgba(255,255,255,.6)',
    ridgeFar: '#b09468', ridge: '#8a7048', ground: '#a08a5e', groundDark: '#6f5c38', speck: '#8e7a50' },
  { sky0: '#7fa48c', sky1: '#d7dfc4', cloud: 'rgba(255,255,255,.55)',
    ridgeFar: '#5c7a5e', ridge: '#3d5a40', ground: '#5f6b42', groundDark: '#424a2c', speck: '#546038' },
  { sky0: '#3f4463', sky1: '#7c6e86', cloud: 'rgba(220,215,235,.4)',
    ridgeFar: '#4a4a66', ridge: '#332f47', ground: '#453e50', groundDark: '#2c2735', speck: '#3a3444' },
  { sky0: '#b9cbd8', sky1: '#eef3f6', cloud: 'rgba(255,255,255,.9)',
    ridgeFar: '#9cb0c0', ridge: '#7d94a4', ground: '#c6cdd2', groundDark: '#98a2a9', speck: '#b3bcc2' }
];
FIELD_PALETTES[0].orb = '#f6e7b0'; FIELD_PALETTES[0].orbGlow = 'rgba(255,250,220,.45)';
FIELD_PALETTES[1].orb = '#f7d489'; FIELD_PALETTES[1].orbGlow = 'rgba(255,230,180,.5)';
FIELD_PALETTES[2].orb = '#e9edc4'; FIELD_PALETTES[2].orbGlow = 'rgba(240,250,210,.4)';
FIELD_PALETTES[3].orb = '#dfe0f0'; FIELD_PALETTES[3].orbGlow = 'rgba(210,214,245,.28)';
FIELD_PALETTES[3].moon = true;
FIELD_PALETTES[4].orb = '#ffffff'; FIELD_PALETTES[4].orbGlow = 'rgba(255,255,255,.55)';
FIELD_PALETTES.forEach(p => { p.prop = p.groundDark; });
