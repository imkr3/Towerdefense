/* =======================================================================
 *  달콤 방어전 - 캔버스 렌더러
 * ======================================================================= */

class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = ALLY_SPAWN_X;
    this.camTarget = this.cam;
    this.drag = null;
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
    // zoom : 월드 좌표 -> 화면 가로 매핑 (한 화면에 약 780 월드유닛)
    this.zoom = Math.max(0.40, Math.min(0.95, this.w / 720));
    // cs : 캐릭터 크기 배율 (세로 여유에 맞춤)
    this.cs = Math.max(0.75, Math.min(1.35, this.h / 700));
    this.groundY = Math.round(Math.min(this.h * 0.76, this.h - 185));
  }

  viewWidth() { return this.w / this.zoom; }

  clampCam(x) {
    const half = this.viewWidth() / 2;
    return Math.max(half, Math.min(WORLD - half, x));
  }

  screenX(worldX) { return (worldX - this.cam) * this.zoom + this.w / 2; }
  worldX(sx) { return (sx - this.w / 2) / this.zoom + this.cam; }
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

    // 해
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.arc(w * 0.78, this.groundY * 0.22, 46, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,.9)';
    ctx.beginPath(); ctx.arc(w * 0.78, this.groundY * 0.22, 32, 0, 7); ctx.fill();


    // 구름 (느린 시차)
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    const cpar = this.cam * 0.12;
    for (let i = 0; i < 9; i++) {
      const cx = ((i * 260 - cpar) % 2340 + 2340) % 2340 - 260;
      const cy = 44 + ((i * 53) % 5) * 26;
      const cr = 22 + (i % 3) * 9;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, 7);
      ctx.arc(cx + cr * 0.9, cy + 5, cr * 0.72, 0, 7);
      ctx.arc(cx - cr * 0.9, cy + 6, cr * 0.62, 0, 7);
      ctx.fill();
    }

    // 먼 언덕 (시차 스크롤) - 두 겹
    ctx.fillStyle = pal.hillFar || pal.hill;
    const par2 = this.cam * 0.16;
    for (let i = -1; i < 10; i++) {
      const cx = ((i * 300 - par2) % 3000 + 3000) % 3000 - 300;
      ctx.beginPath();
      ctx.ellipse(cx, this.groundY + 4, 250, 210, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = pal.hill;
    const par = this.cam * 0.32;
    for (let i = -1; i < 10; i++) {
      const cx = ((i * 360 - par) % 3600 + 3600) % 3600 - 360;
      ctx.beginPath();
      ctx.ellipse(cx, this.groundY + 6, 285, 140, 0, Math.PI, 0);
      ctx.fill();
    }

    // 땅
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, this.groundY + 4, w, h - this.groundY);
    ctx.fillStyle = pal.groundDark;
    ctx.fillRect(0, this.groundY + 4, w, 5);

    // 땅 무늬
    ctx.fillStyle = pal.speck;
    const step = 70;
    const off = ((-this.cam * this.zoom) % step + step) % step;
    for (let x = off - step; x < w + step; x += step) {
      const yy = this.groundY + 30 + ((x * 7) % 40);
      ctx.fillRect(x, yy, 16, 4);
    }
  }

  /* --------------------------- 소품 --------------------------- */
  drawProps() {
    const ctx = this.ctx, cs = this.cs;
    for (let i = 0; i < 22; i++) {
      const wx = 40 + i * 92 + ((i * 137) % 47);
      const x = this.screenX(wx);
      if (x < -80 || x > this.w + 80) continue;
      const kind = (i * 7) % 3;
      const y = this.groundY - 6 + ((i * 31) % 9);
      const sc = cs * (0.7 + ((i * 13) % 5) / 10);
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = 0.9;
      if (kind === 0) {              // 막대사탕 나무
        ctx.strokeStyle = '#e8dcc8'; ctx.lineWidth = 4 * sc;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46 * sc); ctx.stroke();
        ctx.fillStyle = '#ff9ec4';
        ctx.beginPath(); ctx.arc(0, -56 * sc, 15 * sc, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * sc;
        ctx.beginPath(); ctx.arc(0, -56 * sc, 8 * sc, 0.4, 3.6); ctx.stroke();
      } else if (kind === 1) {       // 덤불
        ctx.fillStyle = 'rgba(120,175,110,.85)';
        ctx.beginPath(); ctx.arc(-10 * sc, -8 * sc, 11 * sc, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(3 * sc, -13 * sc, 14 * sc, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(15 * sc, -7 * sc, 10 * sc, 0, 7); ctx.fill();
      } else {                       // 작은 돌
        ctx.fillStyle = 'rgba(0,0,0,.13)';
        ctx.beginPath(); ctx.ellipse(0, -4 * sc, 13 * sc, 7 * sc, 0, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------- 본진 --------------------------- */
  drawCastle(c, isEnemy) {
    const ctx = this.ctx;
    const x = this.screenX(c.x);
    if (x < -220 || x > this.w + 220) return;
    const y = this.groundY + 10;
    const s = this.cs;
    const wdt = 108 * s, hgt = 132 * s;

    ctx.save();
    ctx.translate(x, y);
    if (c.hitFlash > 0) { ctx.globalAlpha = 0.9; }

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(0, 4, wdt * 0.62, 12 * s, 0, 0, 7); ctx.fill();

    if (!isEnemy) {
      // 아군: 케이크 성
      ctx.fillStyle = '#fff2df';
      roundRect(ctx, -wdt / 2, -hgt, wdt, hgt, 12 * s); ctx.fill();
      ctx.fillStyle = '#ffd9e6';
      roundRect(ctx, -wdt / 2, -hgt, wdt, 26 * s, 12 * s); ctx.fill();
      ctx.fillStyle = '#e0728f';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(-wdt / 2 + 16 * s + i * 25 * s, -hgt + 26 * s, 7 * s, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = '#c78a52';
      ctx.fillRect(-16 * s, -46 * s, 32 * s, 46 * s);
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath(); ctx.arc(0, -46 * s, 16 * s, Math.PI, 0); ctx.fill();
      // 깃발
      ctx.strokeStyle = '#9b6a3d'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(0, -hgt); ctx.lineTo(0, -hgt - 34 * s); ctx.stroke();
      ctx.fillStyle = '#ff9ec4';
      ctx.beginPath();
      ctx.moveTo(0, -hgt - 34 * s); ctx.lineTo(34 * s, -hgt - 24 * s); ctx.lineTo(0, -hgt - 14 * s);
      ctx.closePath(); ctx.fill();
    } else {
      // 적: 채소 요새
      ctx.fillStyle = '#4d7a3a';
      roundRect(ctx, -wdt / 2, -hgt, wdt, hgt, 10 * s); ctx.fill();
      ctx.fillStyle = '#3c6130';
      ctx.fillRect(-wdt / 2, -hgt * 0.42, wdt, 10 * s);
      ctx.fillStyle = '#2f4d26';
      ctx.fillRect(-18 * s, -50 * s, 36 * s, 50 * s);
      ctx.fillStyle = '#78a75f';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-wdt / 2 + i * 36 * s, -hgt);
        ctx.lineTo(-wdt / 2 + 18 * s + i * 36 * s, -hgt - 22 * s);
        ctx.lineTo(-wdt / 2 + 36 * s + i * 36 * s, -hgt);
        ctx.closePath(); ctx.fill();
      }
      // 눈
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(-20 * s, -hgt * 0.66, 6 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(20 * s, -hgt * 0.66, 6 * s, 0, 7); ctx.fill();
    }

    if (c.hitFlash > 0) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#fff';
      roundRect(ctx, -wdt / 2, -hgt, wdt, hgt, 12 * s); ctx.fill();
    }
    ctx.restore();

    // 본진 체력바
    const bw = 96 * s;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    roundRect(ctx, x - bw / 2, y - hgt - 52 * s, bw, 9 * s, 4 * s); ctx.fill();
    ctx.fillStyle = isEnemy ? '#ff6b6b' : '#66d17a';
    roundRect(ctx, x - bw / 2, y - hgt - 52 * s, bw * (c.hp / c.maxHp), 9 * s, 4 * s); ctx.fill();
  }

  /* --------------------------- 유닛 --------------------------- */
  drawFighter(f) {
    const ctx = this.ctx;
    const x = this.screenX(f.x);
    if (x < -120 || x > this.w + 120) return;
    const s = this.cs * f.scale;
    const y = this.rowY(f.row);
    const walkable = f.kbTimer <= 0;
    const bob = walkable ? Math.sin(f.bob) * 2.2 * s : 0;
    const lean = f.swing > 0 ? f.dir * 6 * s * (f.swing / 0.22) : 0;

    ctx.save();
    ctx.translate(x + lean, y + bob);
    ctx.scale(f.dir, 1);

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(0, 2 - bob, 22 * s, 6 * s, 0, 0, 7); ctx.fill();

    const flash = f.hitFlash > 0;
    drawBody(ctx, f.s.shape, f.s.body, f.s.accent, s, flash, f.kbTimer > 0);
    ctx.restore();

    // 체력바
    if (f.hp < f.maxHp) {
      const bw = 34 * s;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      roundRect(ctx, x - bw / 2, y - 62 * s, bw, 5 * s, 2.5 * s); ctx.fill();
      ctx.fillStyle = f.side === 'ally' ? '#7fe08e' : '#ff7676';
      roundRect(ctx, x - bw / 2, y - 62 * s, bw * (f.hp / f.maxHp), 5 * s, 2.5 * s); ctx.fill();
    }
  }

  drawShots(battle) {
    const ctx = this.ctx;
    for (const s of battle.shots) {
      const p = s.t / s.dur;
      const wx = s.x + (s.tx - s.x) * p;
      const x = this.screenX(wx);
      const y = this.rowY(s.y0) - 26 * this.cs - Math.sin(p * Math.PI) * 46 * this.cs;
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(x, y, 5 * this.cs, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.arc(x - s.dir * 6, y + 2, 2.4 * this.cs, 0, 7); ctx.fill();
    }
  }

  drawFx(battle) {
    const ctx = this.ctx;
    for (const e of battle.fx) {
      const p = e.t / e.life;
      const x = this.screenX(e.x);
      const y = this.rowY(e.row || 0) - 24 * this.cs;
      if (e.type === 'hit') {
        ctx.strokeStyle = 'rgba(255,255,255,' + p + ')';
        ctx.lineWidth = 3 * this.cs;
        ctx.beginPath(); ctx.arc(x, y, (1 - p) * 26 * this.cs + 6, 0, 7); ctx.stroke();
      } else if (e.type === 'boom') {
        const r = e.r * this.zoom * (1.05 - p * 0.35);
        ctx.fillStyle = 'rgba(255,214,120,' + (p * 0.5) + ')';
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55 * (this.cs / this.zoom) * 0.7, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,' + p + ')';
        ctx.lineWidth = 2.5 * this.cs;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55 * (this.cs / this.zoom) * 0.7, 0, 0, 7); ctx.stroke();
      } else if (e.type === 'poof') {
        const n = e.big ? 10 : 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const d = (1 - p) * (e.big ? 60 : 34) * this.cs;
          ctx.fillStyle = e.color || '#fff';
          ctx.globalAlpha = p;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 5 * this.cs, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'spawn') {
        ctx.strokeStyle = 'rgba(255,255,255,' + p + ')';
        ctx.lineWidth = 3 * this.cs;
        ctx.beginPath();
        ctx.ellipse(x, this.rowY(e.row) + 2, (1 - p) * 34 * this.cs, (1 - p) * 12 * this.cs, 0, 0, 7);
        ctx.stroke();
      }
    }
  }

  render(battle, dt) {
    this.follow(battle, dt);
    this.drawBackground(battle.stageIndex);
    this.drawProps();
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
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    roundRect(ctx, x0, y0, w, h, 4); ctx.fill();
    const put = (wx, color, r) => {
      const px = x0 + (wx / WORLD) * w;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, y0 + h / 2, r, 0, 7); ctx.fill();
    };
    battle.allies.forEach(a => put(a.x, '#ffd166', 2));
    battle.enemies.forEach(e => put(e.x, e.boss ? '#ff3b3b' : '#7be07b', e.boss ? 4 : 2));
    put(ALLY_BASE_X, '#ffffff', 3.5);
    put(ENEMY_BASE_X, '#2f4d26', 3.5);
    // 카메라 범위 표시
    const vw = (this.viewWidth() / WORLD) * w;
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5;
    roundRect(ctx, x0 + (this.cam / WORLD) * w - vw / 2, y0 - 2, vw, h + 4, 4); ctx.stroke();
  }
}

/* ----------------------- 캐릭터 몸통 그리기 ----------------------- */
function drawBody(ctx, shape, body, accent, s, flash, hurt) {
  ctx.save();
  const main = flash ? '#ffffff' : body;

  const face = (ex, ey, r) => {
    ctx.fillStyle = '#2b2118';
    ctx.beginPath(); ctx.arc(-ex, ey, r, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    if (hurt) { ctx.arc(0, ey + 10 * s, 4 * s, Math.PI, 0); }
    else { ctx.arc(0, ey + 5 * s, 5 * s, 0.15 * Math.PI, 0.85 * Math.PI); }
    ctx.stroke();
  };

  ctx.fillStyle = main;
  switch (shape) {
    case 'dome': // 푸딩
      ctx.beginPath();
      ctx.moveTo(-20 * s, 0); ctx.lineTo(20 * s, 0);
      ctx.quadraticCurveTo(16 * s, -40 * s, 0, -40 * s);
      ctx.quadraticCurveTo(-16 * s, -40 * s, -20 * s, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      ctx.beginPath();
      ctx.ellipse(0, -38 * s, 15 * s, 6 * s, 0, 0, 7); ctx.fill();
      face(7 * s, -20 * s, 3 * s);
      break;
    case 'blob': // 마시멜로 / 콩알
      ctx.beginPath();
      roundRect(ctx, -21 * s, -42 * s, 42 * s, 42 * s, 16 * s); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      ctx.fillRect(-21 * s, -22 * s, 42 * s, 3 * s);
      face(7 * s, -26 * s, 3.2 * s);
      break;
    case 'disc': // 쿠키
      ctx.beginPath(); ctx.arc(0, -22 * s, 21 * s, 0, 7); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      [[-9, -30], [8, -28], [-2, -14], [11, -14]].forEach(p => {
        ctx.beginPath(); ctx.arc(p[0] * s, p[1] * s, 3.2 * s, 0, 7); ctx.fill();
      });
      face(7 * s, -23 * s, 2.8 * s);
      break;
    case 'twin': // 마카롱
      ctx.beginPath(); ctx.ellipse(-6 * s, -18 * s, 15 * s, 12 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6 * s, -32 * s, 15 * s, 12 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      ctx.fillRect(-20 * s, -26 * s, 30 * s, 4 * s);
      face(6 * s, -32 * s, 2.6 * s);
      break;
    case 'cup': // 슈크림
      ctx.beginPath();
      ctx.moveTo(-16 * s, 0); ctx.lineTo(16 * s, 0);
      ctx.lineTo(12 * s, -22 * s); ctx.lineTo(-12 * s, -22 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      ctx.beginPath(); ctx.arc(0, -30 * s, 15 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(-9 * s, -24 * s, 9 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(9 * s, -24 * s, 9 * s, 0, 7); ctx.fill();
      face(6 * s, -12 * s, 2.6 * s);
      break;
    case 'ring': // 도넛
      ctx.beginPath(); ctx.arc(0, -24 * s, 23 * s, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(0, -24 * s, 7 * s, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = flash ? '#fff' : accent;
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        ctx.fillRect(Math.cos(a) * 15 * s, -24 * s + Math.sin(a) * 15 * s, 5 * s, 2.4 * s);
      }
      face(8 * s, -30 * s, 2.8 * s);
      break;
    case 'cake':
      ctx.beginPath(); roundRect(ctx, -22 * s, -34 * s, 44 * s, 34 * s, 5 * s); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      ctx.beginPath(); roundRect(ctx, -22 * s, -42 * s, 44 * s, 12 * s, 5 * s); ctx.fill();
      ctx.fillStyle = '#e2483f';
      ctx.beginPath(); ctx.arc(0, -48 * s, 5 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(14 * s, -30 * s, 26 * s, 7 * s);   // 포신
      face(8 * s, -20 * s, 2.8 * s);
      break;
    case 'cone': // 아이스크림
      ctx.fillStyle = flash ? '#fff' : accent;
      ctx.beginPath();
      ctx.moveTo(-15 * s, -24 * s); ctx.lineTo(15 * s, -24 * s); ctx.lineTo(0, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = main;
      ctx.beginPath(); ctx.arc(0, -34 * s, 17 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(-8 * s, -46 * s, 11 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(7 * s, -50 * s, 9 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();                                  // 왕관
      ctx.moveTo(-12 * s, -58 * s); ctx.lineTo(-12 * s, -66 * s); ctx.lineTo(-5 * s, -60 * s);
      ctx.lineTo(0, -68 * s); ctx.lineTo(5 * s, -60 * s); ctx.lineTo(12 * s, -66 * s);
      ctx.lineTo(12 * s, -58 * s); ctx.closePath(); ctx.fill();
      face(7 * s, -34 * s, 3 * s);
      break;
    /* ----- 적 ----- */
    case 'spike': // 당근
      ctx.beginPath();
      ctx.moveTo(-14 * s, -44 * s); ctx.lineTo(14 * s, -44 * s); ctx.lineTo(0, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(i * 9 * s, -50 * s, 4 * s, 10 * s, i * 0.4, 0, 7); ctx.fill();
      }
      face(6 * s, -32 * s, 2.6 * s);
      break;
    case 'tree': // 브로콜리
      ctx.fillStyle = flash ? '#fff' : accent;
      ctx.fillRect(-7 * s, -26 * s, 14 * s, 26 * s);
      ctx.fillStyle = main;
      ctx.beginPath(); ctx.arc(0, -38 * s, 19 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(-15 * s, -30 * s, 12 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(15 * s, -30 * s, 12 * s, 0, 7); ctx.fill();
      face(8 * s, -38 * s, 3 * s);
      break;
    case 'chili': // 고추
      ctx.beginPath();
      ctx.ellipse(0, -22 * s, 12 * s, 22 * s, 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      ctx.fillRect(-4 * s, -50 * s, 8 * s, 10 * s);
      face(6 * s, -24 * s, 2.6 * s);
      break;
    case 'corn':
      ctx.beginPath(); ctx.ellipse(0, -26 * s, 14 * s, 26 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      for (let r = 0; r < 5; r++) ctx.fillRect(-12 * s, (-44 + r * 9) * s, 24 * s, 2 * s);
      ctx.fillStyle = '#5aa84a';
      ctx.beginPath(); ctx.ellipse(-15 * s, -20 * s, 6 * s, 18 * s, 0.4, 0, 7); ctx.fill();
      face(6 * s, -28 * s, 2.6 * s);
      break;
    case 'onion':
      ctx.beginPath();
      ctx.moveTo(0, -46 * s);
      ctx.bezierCurveTo(22 * s, -34 * s, 20 * s, 0, 0, 0);
      ctx.bezierCurveTo(-20 * s, 0, -22 * s, -34 * s, 0, -46 * s);
      ctx.fill();
      ctx.strokeStyle = flash ? '#fff' : accent; ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.moveTo(0, -44 * s); ctx.lineTo(0, -4 * s); ctx.stroke();
      face(7 * s, -26 * s, 2.8 * s);
      break;
    case 'egg': // 가지
      ctx.beginPath(); ctx.ellipse(0, -24 * s, 16 * s, 26 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5aa84a';
      ctx.beginPath(); ctx.ellipse(0, -50 * s, 11 * s, 6 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      ctx.fillRect(-18 * s, -34 * s, 36 * s, 4 * s);
      face(7 * s, -28 * s, 3 * s);
      break;
    case 'pumpkin':
      ctx.beginPath(); ctx.ellipse(0, -28 * s, 30 * s, 26 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = flash ? '#fff' : accent; ctx.lineWidth = 2 * s;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(i * 12 * s, -28 * s, 9 * s, 26 * s, 0, 0, 7); ctx.stroke();
      }
      ctx.fillStyle = '#3f6b2a';
      ctx.fillRect(-4 * s, -60 * s, 8 * s, 10 * s);
      ctx.fillStyle = '#2b2118';                    // 무서운 눈
      ctx.beginPath();
      ctx.moveTo(-16 * s, -36 * s); ctx.lineTo(-4 * s, -30 * s); ctx.lineTo(-16 * s, -26 * s);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(16 * s, -36 * s); ctx.lineTo(4 * s, -30 * s); ctx.lineTo(16 * s, -26 * s);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-12 * s, -18 * s); ctx.lineTo(12 * s, -18 * s); ctx.lineTo(0, -10 * s);
      ctx.closePath(); ctx.fill();
      break;
    case 'garlic':
      ctx.beginPath();
      ctx.moveTo(0, -56 * s);
      ctx.bezierCurveTo(30 * s, -40 * s, 26 * s, 0, 0, 0);
      ctx.bezierCurveTo(-26 * s, 0, -30 * s, -40 * s, 0, -56 * s);
      ctx.fill();
      ctx.strokeStyle = flash ? '#fff' : accent; ctx.lineWidth = 2 * s;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 11 * s, -50 * s); ctx.lineTo(i * 15 * s, -4 * s); ctx.stroke();
      }
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-16 * s, -60 * s); ctx.lineTo(-16 * s, -72 * s); ctx.lineTo(-6 * s, -64 * s);
      ctx.lineTo(0, -76 * s); ctx.lineTo(6 * s, -64 * s); ctx.lineTo(16 * s, -72 * s);
      ctx.lineTo(16 * s, -60 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b33';
      ctx.beginPath(); ctx.arc(-9 * s, -34 * s, 4 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(9 * s, -34 * s, 4 * s, 0, 7); ctx.fill();
      break;
    case 'radish': // 무
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(20 * s, -20 * s, 16 * s, -44 * s, 0, -46 * s);
      ctx.bezierCurveTo(-16 * s, -44 * s, -20 * s, -20 * s, 0, 0);
      ctx.fill();
      ctx.fillStyle = flash ? '#fff' : accent;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(i * 10 * s, -54 * s, 5 * s, 12 * s, i * 0.5, 0, 7); ctx.fill();
      }
      face(8 * s, -30 * s, 3 * s);
      break;
    default:
      ctx.beginPath(); ctx.arc(0, -22 * s, 20 * s, 0, 7); ctx.fill();
      face(7 * s, -24 * s, 3 * s);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FIELD_PALETTES = [
  { sky0: '#bfe9ff', sky1: '#ffeccf', hill: '#a8dd8f', hillFar: '#cbe9b6', ground: '#c9a06a', groundDark: '#8f6c42', speck: '#b98f5c' },
  { sky0: '#ffd9c0', sky1: '#fff2d8', hill: '#e2b06a', hillFar: '#f0cf9c', ground: '#b98a52', groundDark: '#856038', speck: '#a87c48' },
  { sky0: '#c6e7c9', sky1: '#f3ffe3', hill: '#79c46a', hillFar: '#a9dd97', ground: '#8f9c58', groundDark: '#6a743f', speck: '#7e8b4c' },
  { sky0: '#d5c9ff', sky1: '#ffe3f3', hill: '#a58fd6', hillFar: '#c9b8ef', ground: '#8f7fa8', groundDark: '#6a5c80', speck: '#7f7096' },
  { sky0: '#cfe9ff', sky1: '#eef7ff', hill: '#a9c9e8', hillFar: '#cfe2f4', ground: '#dfe9f2', groundDark: '#adbecd', speck: '#c7d6e2' }
];
