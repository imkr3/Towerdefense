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
    // 이펙트 품질 (1 = 최상). 프레임이 밀리면 스스로 낮춘다.
    this.fxq = 1;
    this._frameMs = 16.7;
    this._qCool = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    // 해상도는 설정의 품질을 따른다: 높음은 3배까지 선명하게, 절전은 1.5배
    const q = (typeof Settings !== 'undefined') ? Settings.get('quality') : 'auto';
    const cap = q === 'high' ? 3 : q === 'low' ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    // 노치 여백. 매 프레임 getComputedStyle 을 부르면 스타일 재계산이 걸린다.
    this.safeTop = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--st')) || 0;
    const r = this.cv.getBoundingClientRect();
    this.w = Math.max(320, r.width);
    this.h = Math.max(240, r.height);
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // zoom: 월드 -> 화면 가로 배율 (한 화면에 약 760 월드유닛)
    this.zoom = Math.max(0.40, Math.min(1.0, this.w / 760));
    // 지면: 하단 HUD 바로 위에 오도록
    const hud = document.querySelector('.hud-bottom');
    const hudH = (hud && hud.offsetHeight) ? hud.offsetHeight : Math.round(this.h * 0.24);
    // 뒷줄(row 오프셋)까지 HUD 위에 오도록 여유를 둔다
    this._skyKey = null;
    this.groundY = Math.round(Math.max(this.h * 0.45,
                     Math.min(this.h * 0.86, this.h - hudH - 26)));
    // cs: 지면 위 여유 높이에 맞춘 캐릭터 배율
    this.cs = Math.max(0.70, Math.min(1.45, this.groundY / 350));
  }

  /* WebGL 레이어를 2D 캔버스와 같은 크기로 맞춘다 */
  syncGlSize() {
    if (!this.glfx || !this.glfx.ok) return;
    this.glfx.resize(this.w, this.h, this.cv.width / this.w);
  }

  /* 전투가 새로 시작되면 남아 있던 연출을 비운다 */
  resetFx() {
    this.prevCam = undefined;
    if (this.glfx && this.glfx.ok) this.glfx.clear();
  }

  viewWidth() { return this.w / this.zoom; }
  clampCam(x) {
    const half = this.viewWidth() / 2;
    return Math.max(half, Math.min(WORLD - half, x));
  }
  screenX(worldX) { return (worldX - this.cam) * this.zoom + this.w / 2; }
  rowY(row) { return this.groundY + (row || 0) * 10 * this.cs; }

  /* 프레임 시간을 지켜보며 이펙트 품질(파티클 수)을 조절한다. */
  trackFrame(dt) {
    // 설정에서 품질을 못 박았으면 따라간다
    const q = (typeof Settings !== 'undefined') ? Settings.get('quality') : 'auto';
    if (q === 'high') { this.fxq = 1; return; }
    if (q === 'low') { this.fxq = 0; return; }
    const ms = Math.min(120, dt * 1000);
    this._frameMs += (ms - this._frameMs) * 0.12;
    if (this._qCool > 0) { this._qCool -= dt; return; }
    if (this._frameMs > 26 && this.fxq > 0) {
      this.fxq = this.fxq > 0.5 ? 0.5 : 0;
      this._qCool = 1.5;
    } else if (this._frameMs < 18.5 && this.fxq < 1) {
      this.fxq = this.fxq < 0.5 ? 0.5 : 1;
      this._qCool = 3;
    }
  }

  /* 품질에 따라 반복 횟수를 깎는다 */
  qn(n) { return this.fxq >= 1 ? n : Math.max(1, Math.round(n * (this.fxq >= 0.5 ? 0.6 : 0.35))); }

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
  /* 배경은 카메라에만 따라 움직이는 정지 화면이다. 카메라는 대부분의 프레임에서
   * 1픽셀도 채 움직이지 않으므로, 한 번 그려 두고 다시 쓰면 그만이다.
   * 가장 빨리 흐르는 층(땅 무늬)이 1픽셀 움직일 때마다만 다시 그린다. */
  drawBackground(stageIndex) {
    const camQ = Math.round(this.cam * this.zoom);
    const key = stageIndex + '|' + this.w + 'x' + this.h + '|' + this.groundY + '|' + camQ;
    if (this._bgKey !== key) {
      if (!this._bg) {
        this._bg = document.createElement('canvas');
        this._bgCtx = this._bg.getContext('2d');
      }
      if (this._bg.width !== this.cv.width || this._bg.height !== this.cv.height) {
        this._bg.width = this.cv.width;
        this._bg.height = this.cv.height;
        const dpr = this.cv.width / this.w;
        this._bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._skyKey = null;                 // 그라디언트는 컨텍스트에 매여 있다
      }
      this.paintBackground(this._bgCtx, stageIndex, camQ / this.zoom);
      this._bgKey = key;
    }
    this.ctx.drawImage(this._bg, 0, 0, this.w, this.h);
  }

  paintBackground(ctx, stageIndex, cam) {
    const w = this.w, h = this.h;
    const pal = fieldPalette(stageIndex);

    // 하늘 그라디언트는 매 프레임 새로 만들 필요가 없다
    const key = pal.sky0 + this.groundY;
    if (this._skyKey !== key) {
      const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
      g.addColorStop(0, pal.sky0);
      g.addColorStop(1, pal.sky1);
      this._sky = g;
      this._skyKey = key;
    }
    ctx.fillStyle = this._sky;
    ctx.fillRect(0, 0, w, h);

    // 해 / 달
    const ox = ((this.w * 0.74 - cam * 0.05) % (this.w + 240) + this.w + 240) % (this.w + 240) - 120;
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
    const cpar = cam * 0.12;
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

    // Layered, irregular silhouettes; deterministic scenery stays still while panning.
    const ridge = (color, amp, step, par, base, seed) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-step, this.groundY + 4);
      const start = Math.floor(cam * par / step) - 2;
      for (let i = start; i < start + Math.ceil(w / step) + 5; i++) {
        const x = i * step - cam * par;
        const height = base + amp * (0.45 + 0.55 * Math.sin(i * 2.31 + seed) ** 2);
        ctx.lineTo(x, this.groundY - height);
        ctx.lineTo(x + step * 0.48, this.groundY - height * 0.64);
      }
      ctx.lineTo(w + step, this.groundY + 4);
      ctx.closePath(); ctx.fill();
    };
    ridge(pal.ridgeFar, this.groundY * 0.42, 160, 0.12, 35, 4);
    ridge(pal.ridge, this.groundY * 0.24, 110, 0.28, 16, 7);
    // Distant watchtowers and woodland create scale without hiding the fighters.
    ctx.fillStyle = pal.prop;
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < 22; i++) {
      const x = i * 130 - cam * 0.4;
      if (x < -70 || x > w + 70) continue;
      const y = this.groundY - 10;
      const h = 22 + (i * 17 % 30);
      if (i % 5 === 0) {
        ctx.fillRect(x, y - h, 16, h);
        for (let j = 0; j < 3; j++) ctx.fillRect(x + j * 6, y - h - 5, 4, 6);
      } else {
        ctx.fillRect(x - 2, y - h, 4, h);
        ctx.beginPath(); ctx.moveTo(x, y - h - 20);
        ctx.lineTo(x - 17, y - 6); ctx.lineTo(x + 17, y - 6); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    const mist = ctx.createLinearGradient(0, this.groundY - 45, 0, this.groundY);
    mist.addColorStop(0, 'transparent'); mist.addColorStop(1, pal.sky1);
    ctx.globalAlpha = 0.2; ctx.fillStyle = mist;
    ctx.fillRect(0, this.groundY - 45, w, 45); ctx.globalAlpha = 1;

    // 땅
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, this.groundY + 2, w, h - this.groundY);
    ctx.fillStyle = pal.groundDark;
    ctx.fillRect(0, this.groundY + 2, w, 4);

    // A worn road anchors the three combat rows.
    ctx.fillStyle = 'rgba(225,211,171,.12)';
    ctx.fillRect(0, this.groundY + 9, w, 21 * this.cs);
    // 땅 무늬
    ctx.fillStyle = pal.speck;
    const step = 64;
    const off = ((-cam * this.zoom) % step + step) % step;
    for (let x = off - step; x < w + step; x += step) {
      const yy = this.groundY + 26 + ((x * 7) % 44);
      ctx.fillRect(x, yy, 14, 3);
    }
  }

  /* --------------------------- 소품 --------------------------- */
  drawProps(stageIndex) {
    const ctx = this.ctx, cs = this.cs;
    const pal = fieldPalette(stageIndex);
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
    const moving = !!f.moving && f.stunT <= 0;
    // 공격 자세: 친 순간부터 0.22초. 빠르게 휘둘러 끝까지 가고(20%), 천천히 거둔다.
    const swingT = f.swing > 0 ? 1 - Math.min(1, f.swing / 0.22) : -1;
    const atk = swingT < 0 ? 0 : attackPose(swingT);
    const style = attackStyle(f.s);
    // 휘두르기 직전 뒤로 젖히는 준비 동작. 공격 간격이 짧은 병종은 짧게.
    const windLen = Math.min(0.3, (f.intervalNow || f.s.interval || 1) * 0.35);
    const wind = (f.engaged && !moving && f.swing <= 0 && f.stunT <= 0 && f.kbTimer <= 0 && f.s.atk > 0 && f.cd < windLen)
      ? 1 - Math.max(0, f.cd) / windLen : 0;
    // 치는 순간 몸이 따라 나간다. 찌르기는 길게, 내려찍기는 무겁게, 쏘기는 반동으로 뒤로.
    const reach = { thrust: 12, heavy: 9, slash: 7, cast: 2, shoot: -4 }[style];
    const pull = { thrust: 5, heavy: 4, slash: 3, cast: 1, shoot: 1 }[style];
    const lunge = atk > 0 ? atk * reach * this.cs : -wind * pull * this.cs;
    // 멈춰 있을 때는 숨쉬기
    const breathe = (!moving && atk === 0 && wind === 0) ? Math.sin(f.bob * 0.9) * 1.2 * this.cs : 0;
    // 막 나온 병사는 땅에서 튀어 오르듯 커진다
    const age = f.age === undefined ? 9 : f.age;
    const spawnK = Math.min(1, age / 0.3);
    const pop = spawnK < 1 ? easeOutBack(spawnK) : 1;
    // 승패가 갈리면 이긴 쪽이 제자리에서 뛴다
    const won = this.outcome && ((this.outcome === 'win') === (f.side === 'ally'));
    const hop = won ? Math.abs(Math.sin(this.clock * 7 + f.bob)) * 9 * this.cs : 0;
    // 넉백: 뒤로 튕기며 살짝 뜬다
    const kbK = f.kbTimer > 0 ? Math.min(1, f.kbTimer / 0.42) : 0;
    const kbLift = kbK > 0 ? Math.sin(kbK * Math.PI) * 7 * this.cs : 0;

    if (age < 0.4) {                                     // 출진 먼지 고리
      const k = age / 0.4;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.55;
      ctx.strokeStyle = f.side === 'ally' ? '#e8f4ff' : '#f3d2c2';
      ctx.lineWidth = 2.5 * this.cs;
      ctx.beginPath(); ctx.ellipse(x, y + 1, (12 + k * 30) * s, (3 + k * 6) * s, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x + f.dir * lunge, y + breathe - hop - kbLift);
    ctx.scale(f.dir, 1);
    if (spawnK < 1) {
      ctx.globalAlpha = Math.min(1, spawnK * 2.5);
      ctx.scale(pop, pop);
    }
    ctx.strokeStyle = f.side === 'ally' ? '#9cdef0' : '#efab91';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.ellipse(0, 2, 20 * s, 5 * s, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(0, 1, 17 * s, 4.5 * s, 0, 0, 7); ctx.fill();
    if (f.s.rarity === 'UR' || f.s.rarity === 'SSR' || f.s.rarity === 'SR') {      // 상위 등급 발밑 오라
        // 신화가 전설보다 흐리게 빛나면 안 된다
        const glow = f.s.rarity === 'UR' ? 0.62
                   : (f.s.rarity === 'SSR' ? 0.5 : 0.28);
        const pulse = 0.85 + Math.sin(f.bob * 1.4) * 0.15;
        ctx.globalAlpha = glow * pulse;
        ctx.fillStyle = f.s.accent;
        ctx.beginPath();
        ctx.ellipse(0, 1, 24 * s * pulse, 6.5 * s * pulse, 0, 0, 7);
        ctx.fill();
        ctx.globalAlpha = glow * 0.55;
        ctx.strokeStyle = f.s.accent;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.ellipse(0, 1, 30 * s * pulse, 8 * s * pulse, 0, 0, 7);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    if (f.enraged) {                                       // 광폭화한 보스의 붉은 기운
      const pulse = 0.8 + Math.sin(f.bob * 3.2) * 0.2;
      ctx.globalAlpha = 0.45 * pulse;
      ctx.strokeStyle = '#ff5a3c';
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.ellipse(0, 1, 34 * s * pulse, 9 * s * pulse, 0, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 0.3 * pulse;
      for (let i = 0; i < 3; i++) {
        const a = f.bob * 1.6 + i * 2.1;
        ctx.beginPath();
        ctx.arc(Math.sin(a) * 22 * s, -30 * s - ((a * 9) % 34) * s, 3.2 * s, 0, 7);
        ctx.fillStyle = '#ff7a4c';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (moving && f.s.speed > 70) {                        // 발밑 먼지
      const d = (Math.sin(f.bob * 2) + 1) * 0.5;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.12 + d * 0.12) + ')';
      ctx.beginPath();
      ctx.ellipse(-14 * s - d * 8 * s, -2 * s, (4 + d * 5) * s, (2 + d * 2) * s, 0, 0, 7);
      ctx.fill();
    }
    // Keep the ground shadow stable while the body strides, recoils and attacks.
    ctx.save();
    const stride = moving ? Math.abs(Math.sin(f.bob)) : 0;
    const recoil = Math.min(1, f.hitFlash / 0.18);
    const heavy = f.scale >= 1.3 || f.boss;
    // 걸을 때는 앞으로 기울이고(빠를수록 더), 큰 몸은 좌우로 흔들린다
    const lean = moving ? (f.s.speed > 70 ? 0.11 : 0.05) : 0;
    const sway = moving && heavy ? Math.sin(f.bob) * 0.05 : (moving ? Math.sin(f.bob) * 0.025 : 0);
    // 치는 순간 앞으로 숙였다가, 준비할 땐 뒤로 젖힌다
    const strike = atk * (style === 'heavy' ? 0.16 : style === 'thrust' ? 0.08 : style === 'shoot' ? -0.05 : 0.1);
    ctx.translate(-recoil * 2.5 * s - wind * 2 * s, -stride * (heavy ? 1.2 : 2.4) * s);
    ctx.rotate(lean + sway + strike - wind * 0.1 - recoil * 0.06 - kbK * 0.35);
    // 맞으면 잠깐 눌렸다가 돌아온다, 준비 동작은 살짝 움츠린다
    const squash = recoil * 0.07 + wind * 0.04;
    if (squash > 0) ctx.scale(1 + squash, 1 - squash);
    drawBody(ctx, f.s, s, false, f.kbTimer > 0, f.bob, moving, atk, wind, won);
    if (f.hitFlash > 0) {
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * Math.min(0.5, f.hitFlash * 3.2);
      drawBody(ctx, f.s, s, true, f.kbTimer > 0, f.bob, moving, atk, wind, won);
      ctx.globalAlpha = a0;
    }
    ctx.restore();

    ctx.restore();

    const bw = 32 * s;
    if (f.hp < f.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      rectPath(ctx, x - bw / 2, y - 72 * s, bw, 5 * s); ctx.fill();
      ctx.fillStyle = f.side === 'ally' ? '#4fa3e0' : '#c0392b';
      rectPath(ctx, x - bw / 2, y - 72 * s, bw * (f.hp / f.maxHp), 5 * s); ctx.fill();
    }
    // 전설·신화 표식: 머리 위 작은 마름모. 액티브가 준비되면 반짝이며 커진다.
    if (f.s.active && f.side === 'ally' && !f.summoned) {
      const ready = this._battle && this._battle.canHeroActive(f.s.id);
      const pulse = ready ? 1 + Math.sin((this.clock || 0) * 6) * 0.18 : 0.8;
      const my = y - 82 * s, r = 5 * s * pulse;
      ctx.save();
      if (ready) { ctx.globalAlpha = 0.35; ctx.fillStyle = f.s.accent; ctx.beginPath(); ctx.arc(x, my, r * 2.2, 0, 7); ctx.fill(); }
      ctx.globalAlpha = ready ? 1 : 0.75;
      ctx.fillStyle = f.s.accent; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 * s;
      ctx.beginPath(); ctx.moveTo(x, my - r); ctx.lineTo(x + r * 0.8, my); ctx.lineTo(x, my + r); ctx.lineTo(x - r * 0.8, my); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (f.barrier > 0) {                                   // 보호막
      ctx.strokeStyle = 'rgba(143,216,255,.85)';
      ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.ellipse(x, y - 30 * s, 22 * s, 34 * s, 0, 0, 7); ctx.stroke();
    }
    if (f.ab.thorns) {
      ctx.strokeStyle='#efb388';ctx.lineWidth=1.7*s;
      for(let i=0;i<4;i++) { const yy=y-(18+i*10)*s;
        ctx.beginPath();ctx.moveTo(x+f.dir*17*s,yy);ctx.lineTo(x+f.dir*25*s,yy-5*s);ctx.stroke(); }
    }
    if (f.ab.regen && f.burnT<=0 && f.hp<f.maxHp) {
      ctx.fillStyle='#8bdfa2'; const rise=(f.bob%2)/2;
      ctx.globalAlpha=1-rise;ctx.fillRect(x-3*s,y-(55+rise*18)*s,6*s,2*s);
      ctx.fillRect(x-s,y-(57+rise*18)*s,2*s,6*s);ctx.globalAlpha=1;
    }
    if (f.stunT > 0) {
      ctx.fillStyle = '#ffe085';
      for (let i = 0; i < 3; i++) {
        const a = f.bob * 1.5 + i * Math.PI * 2 / 3;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 15 * s, y - 84 * s + Math.sin(a) * 4 * s, 2.2 * s, 0, 7); ctx.fill();
      }
    }
    if (f.burnT > 0) statusDot(ctx, x - 16 * s, y - 80 * s, s, '#ff984f');
    if (f.hasteT > 0) statusDot(ctx, x + 16 * s, y - 80 * s, s, '#f7e0a0');
    if (f.poisonT > 0) statusDot(ctx, x - 8 * s, y - 80 * s, s, '#9de08e');
    if (f.slowT > 0) statusDot(ctx, x, y - 80 * s, s, '#8fd8ff');
    if (f.stunT > 0) statusDot(ctx, x + 8 * s, y - 80 * s, s, '#ffd166');
    if (f.weakT > 0) statusDot(ctx, x - 24 * s, y - 80 * s, s, '#c77dff');
    if (f.charmT > 0) heart(ctx, x, y - 90 * s + Math.sin(f.bob * 3) * 2 * s, 5 * s, '#ff7ab8');
    if (f.spin > 0.05) {                                   // 예열: 굴뚝 위 열기 막대
      ctx.fillStyle = 'rgba(0,0,0,.4)'; rectPath(ctx, x - 16 * s, y - 80 * s, 32 * s, 3 * s); ctx.fill();
      ctx.fillStyle = '#ff8c42'; rectPath(ctx, x - 16 * s, y - 80 * s, 32 * s * Math.min(1, f.spin / f.ab.spinup.max), 3 * s); ctx.fill();
    }
  }

  /* 땅속을 기어 오는 적: 흙더미와 튀는 흙 */
  drawBurrow(b) {
    const ctx = this.ctx, x = this.screenX(b.x);
    if (x < -60 || x > this.w + 60) return;
    const s = this.cs, y = this.rowY(b.row);
    const bump = Math.abs(Math.sin(b.bob * 2)) * 2 * s;
    ctx.fillStyle = '#6b5638';
    ctx.beginPath(); ctx.ellipse(x, y - bump * 0.5, 16 * s, 6 * s + bump, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#8a7048';
    for (let i = 0; i < 3; i++) {
      const k = (b.bob * 0.7 + i / 3) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.arc(x - b.dir * (6 + k * 16) * s, y - 4 * s - Math.sin(k * Math.PI) * 12 * s, 2 * s, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawShots(battle) {
    const ctx = this.ctx, cs = this.cs;
    for (const s of battle.shots) {
      const p = s.t / s.dur;
      const wx = s.x + (s.tx - s.x) * p;
      const x = this.screenX(wx);
      const y = this.rowY(s.y0) - 36 * cs - Math.sin(p * Math.PI) * 60 * cs;
      // A short trajectory trail makes both sides' projectiles readable at 3x speed.
      ctx.save();
      ctx.strokeStyle = s.color; ctx.lineWidth = (s.area ? 4 : 2) * cs;
      ctx.globalAlpha = 0.32;
      const tail = Math.max(0, p - 0.1);
      ctx.beginPath();
      ctx.moveTo(this.screenX(s.x + (s.tx - s.x) * tail), this.rowY(s.y0) - 36 * cs - Math.sin(tail * Math.PI) * 60 * cs);
      ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.dir > 0 ? (p - 0.5) * 1.4 : Math.PI - (p - 0.5) * 1.4);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.4 * cs; ctx.lineCap = 'round';
      const magic = s.src && s.src.s && (s.src.s.rarity === 'UR' || s.src.s.rarity === 'SSR' || s.src.s.castFx);
      if (s.area || magic) {              // 마법탄·폭탄: 빛나는 구슬 + 후광
        const r0 = (s.area ? 6 : 5) * cs;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(0, 0, r0 * 2.3, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(0, 0, r0, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-r0 * 0.25, -r0 * 0.25, r0 * 0.45, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {                            // 화살: 촉과 깃
        ctx.beginPath(); ctx.moveTo(-9 * cs, 0); ctx.lineTo(8 * cs, 0); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(12 * cs, 0); ctx.lineTo(6 * cs, -3.5 * cs); ctx.lineTo(6 * cs, 3.5 * cs);
        ctx.closePath(); ctx.fillStyle = s.color; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.4 * cs;
        ctx.beginPath(); ctx.moveTo(-9 * cs, 0); ctx.lineTo(-12 * cs, -3 * cs);
        ctx.moveTo(-9 * cs, 0); ctx.lineTo(-12 * cs, 3 * cs); ctx.stroke();
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
      if(e.type==='mythic') {
        const k=1-p, radius=Math.min(e.r*this.zoom,260*cs), ground=this.rowY(e.row);
        // WebGL 이 살아 있으면 같은 자리에 파티클 폭발을 한 번 얹는다
        if (this.glfx && this.glfx.ok && !e._emitted) {
          e._emitted = true;
          this.glfx.emit(e.kind, x, ground, { color: this.rgbOf(e.color), radius: e.r * this.zoom, scale: cs, big: true });
        }
        ctx.save();ctx.translate(x,ground);ctx.strokeStyle=e.color;ctx.fillStyle=e.color;ctx.globalAlpha=Math.min(1,p*2);
        // Ground seals and rising sparks are bounded, with no full-screen flash.
        for(let ring=0;ring<3;ring++){
          const rr=radius*(.45+ring*.24)*Math.min(1,k*5);
          ctx.lineWidth=(3-ring*.7)*cs;ctx.beginPath();ctx.ellipse(0,0,rr,rr*.22,k*(ring-1)*.2,0,Math.PI*2);ctx.stroke();
        }
        if(e.kind==='sunfall'){
          const cy=-110*cs-k*28*cs;ctx.lineWidth=4*cs;ctx.beginPath();ctx.arc(0,cy,32*cs,0,7);ctx.stroke();
          for(let i=0;i<12;i++){const a=i*Math.PI/6+k;ctx.beginPath();ctx.moveTo(Math.cos(a)*40*cs,cy+Math.sin(a)*40*cs);ctx.lineTo(Math.cos(a)*55*cs,cy+Math.sin(a)*55*cs);ctx.stroke();}
          ctx.globalAlpha=p*.25;ctx.beginPath();ctx.moveTo(-25*cs,cy);ctx.lineTo(-radius,0);ctx.lineTo(radius,0);ctx.lineTo(25*cs,cy);ctx.fill();
        }else if(e.kind==='runeveil'){
          for(let i=0;i<8;i++){const a=i*Math.PI/4+k*.7,xx=Math.cos(a)*radius*.7,yy=-45*cs+Math.sin(a)*22*cs;
            ctx.beginPath();ctx.moveTo(xx,yy-10*cs);ctx.lineTo(xx-5*cs,yy);ctx.lineTo(xx+5*cs,yy+5*cs);ctx.lineTo(xx,yy+10*cs);ctx.stroke();}
        }else if(e.kind==='foxbead'){                // 여우 구슬: 도는 구슬 아홉
          for(let i=0;i<9;i++){const a=i*Math.PI*2/9+k*3,rr=radius*.55;ctx.beginPath();ctx.arc(Math.cos(a)*rr,-50*cs+Math.sin(a)*rr*.25,(5+Math.sin(k*9+i)*2)*cs,0,7);ctx.fill();}
          ctx.globalAlpha=p*.3;ctx.beginPath();ctx.arc(0,-50*cs,26*cs*(1+k),0,7);ctx.fill();
        }else if(e.kind==='reaproll'){               // 명부: 펼쳐지는 두루마리
          const w=radius*1.2*Math.min(1,k*2.5);ctx.globalAlpha=p*.85;ctx.fillStyle='#efe3c4';ctx.fillRect(-w/2,-120*cs,w,34*cs);
          ctx.fillStyle='#17171d';for(let i=0;i<Math.floor(w/(14*cs));i++)ctx.fillRect(-w/2+6*cs+i*14*cs,-114*cs,3*cs,22*cs);
          ctx.fillStyle=e.color;
        }else if(e.kind==='overdrive'){              // 과부하: 도는 톱니
          ctx.save();ctx.translate(0,-60*cs);ctx.rotate(k*6);ctx.beginPath();
          for(let i=0;i<20;i++){const a=i/20*Math.PI*2,rr=i%2?30*cs:40*cs;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
          ctx.closePath();ctx.lineWidth=4*cs;ctx.stroke();ctx.restore();
        }else if(e.kind==='steamburst'){             // 증기 폭발: 뭉게구름
          ctx.globalAlpha=p*.4;ctx.fillStyle='#e8e6e0';
          for(let i=0;i<7;i++){const a=-Math.PI+i/6*Math.PI;ctx.beginPath();ctx.arc(Math.cos(a)*radius*.7*k,-20*cs+Math.sin(a)*radius*.35*k,(20+k*30)*cs,0,7);ctx.fill();}
          ctx.fillStyle=e.color;
        }else if(e.kind==='tidewave'){               // 해일: 밀려와 부서지는 큰 물결
          ctx.globalAlpha=p*.45;
          for(let i=0;i<3;i++){const rr=radius*(.4+k*(.7+i*.3));
            ctx.beginPath();ctx.ellipse(0,-i*14*cs,rr,rr*.26,0,0,7);ctx.fill();}
          ctx.globalAlpha=p*.9;ctx.lineWidth=4*cs;
          for(let i=0;i<6;i++){const a=-2.6+i*.42,d=radius*(.3+k*.8);
            ctx.beginPath();ctx.moveTo(Math.cos(a)*d*.35,Math.sin(a)*d*.3);
            ctx.lineTo(Math.cos(a)*d,Math.sin(a)*d*.55);ctx.stroke();}
        }else if(e.kind==='underworld'){
          ctx.globalAlpha=p*.65;ctx.lineWidth=5*cs;ctx.beginPath();ctx.ellipse(0,-55*cs,45*cs,65*cs,0,0,7);ctx.stroke();
          for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*20*cs,0);ctx.bezierCurveTo(i*50*cs,-30*cs,-i*15*cs,-70*cs,i*30*cs,-115*cs);ctx.stroke();}
        }else{
          for(let i=-1;i<=1;i++){const xx=i*radius*.5;ctx.beginPath();ctx.moveTo(xx-15*cs,-160*cs);ctx.lineTo(xx+10*cs,-105*cs);ctx.lineTo(xx-10*cs,-70*cs);ctx.lineTo(xx,0);ctx.stroke();}
        }
        ctx.globalAlpha=p*.8;
        for(let i=0;i<18;i++){const a=i*2.399,rr=radius*(.2+.8*k);ctx.beginPath();ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr*.2-k*(20+i%4*14)*cs,2*cs,0,7);ctx.fill();}
        ctx.restore();
      } else if (e.type === 'hit') {
        ctx.strokeStyle = 'rgba(255,255,255,' + p + ')';
        ctx.lineWidth = 2.5 * cs;
        for (let i = 0; i < 3; i++) {
          const a = -0.6 + i * 0.7;
          const d = (1 - p) * 22 * cs + 6;
          ctx.beginPath();
          ctx.moveTo(x + (e.dir || 1) * Math.cos(a) * d * 0.4, y + Math.sin(a) * d * 0.4);
          ctx.lineTo(x + (e.dir || 1) * Math.cos(a) * d, y + Math.sin(a) * d);
          ctx.stroke();
        }
      } else if (e.type === 'warn') {
        // 낙하 예고: 원이 좁혀들며 곧 떨어질 자리를 알려준다
        const r = e.r * this.zoom;
        const gy = this.rowY(1) + 6 * cs;
        const blink = 0.45 + 0.55 * Math.abs(Math.sin((1 - p) * 18));
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = 0.75 * blink;
        ctx.lineWidth = 3 * cs;
        ctx.beginPath(); ctx.ellipse(x, gy, r, r * 0.32, 0, 0, 7); ctx.stroke();
        ctx.globalAlpha = 0.5 * blink;
        ctx.beginPath();
        ctx.ellipse(x, gy, r * (0.15 + p * 0.85), r * 0.32 * (0.15 + p * 0.85), 0, 0, 7);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.type === 'boom') {
        this.glOnce(e, 'burst', x, y, '#ffb45a', e.r * this.zoom);
        const r = e.r * this.zoom * (1.05 - p * 0.35);
        ctx.fillStyle = 'rgba(240,190,110,' + (p * 0.45) + ')';
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,210,' + p + ')';
        ctx.lineWidth = 2.5 * cs;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, 7); ctx.stroke();
      } else if (e.type === 'poof') {
        if (e.big) this.glOnce(e, 'dust', x, this.rowY(e.row || 0), e.color || '#d8ccb0', 120 * this.zoom);
        const n = e.big ? 12 : 7;
        ctx.strokeStyle = e.color || '#fff';
        ctx.lineWidth = 2.4 * cs;
        ctx.globalAlpha = p;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const d = (1 - p) * (e.big ? 62 : 34) * cs;
          ctx.beginPath();
          ctx.moveTo(x + (e.dir || 1) * Math.cos(a) * d * 0.55, y + Math.sin(a) * d * 0.35);
          ctx.lineTo(x + (e.dir || 1) * Math.cos(a) * d, y + Math.sin(a) * d * 0.6);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'crit') {
        this.glOnce(e, 'spark', x, y, '#ffd66e', 40);
        ctx.strokeStyle = 'rgba(255,214,110,' + p + ')';
        ctx.lineWidth = 3.4 * cs;
        for (let i = 0; i < 4; i++) {
          const a = -0.9 + i * 0.6;
          const d = (1 - p) * 30 * cs + 8;
          ctx.beginPath();
          ctx.moveTo(x + (e.dir || 1) * Math.cos(a) * d * 0.35, y + Math.sin(a) * d * 0.35);
          ctx.lineTo(x + (e.dir || 1) * Math.cos(a) * d, y + Math.sin(a) * d);
          ctx.stroke();
        }
      } else if (e.type === 'aura') {
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = p * 0.8;
        ctx.lineWidth = 2.4 * cs;
        const rr = e.r * this.zoom * (1 - p);
        ctx.beginPath(); ctx.ellipse(x, y + 14 * cs, rr, rr * 0.28, 0, 0, 7); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.type === 'leap') {                  // 암살자의 도약 궤적
        const x2 = this.screenX(e.x2), gy = this.rowY(e.row || 0) - 20 * cs;
        ctx.globalAlpha = p * 0.8;
        ctx.strokeStyle = '#ff8a7a'; ctx.lineWidth = 2.4 * cs; ctx.setLineDash([6 * cs, 5 * cs]);
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo((x + x2) / 2, gy - 90 * cs, x2, gy); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      } else if (e.type === 'charm') {                 // 홀림: 떠오르는 하트
        ctx.globalAlpha = Math.min(1, p * 1.5);
        heart(ctx, x, y - 40 * cs - (1 - p) * 26 * cs, 7 * cs * (1 + (1 - p) * 0.4), '#ff7ab8');
        ctx.globalAlpha = 1;
      } else if (e.type === 'coin') {                  // 도깨비 방망이: 금화와 +금액
        const rise = (1 - p) * 34 * cs;
        ctx.globalAlpha = Math.min(1, p * 2);
        ctx.fillStyle = '#ffd35a';
        ctx.beginPath(); ctx.ellipse(x, y - 30 * cs - rise, 6 * cs, 5 * cs, 0, 0, 7); ctx.fill();
        ctx.font = 'bold ' + Math.round(12 * cs) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3 * cs; ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.strokeText('+' + e.v, x + 14 * cs, y - 26 * cs - rise);
        ctx.fillText('+' + e.v, x + 14 * cs, y - 26 * cs - rise);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      } else if (e.type === 'reap') {                  // 저승사자: 거둬 가는 넋
        const k2 = 1 - p;
        ctx.globalAlpha = p;
        ctx.strokeStyle = '#9fd3ff';
        ctx.lineWidth = 3 * cs;
        ctx.beginPath(); ctx.moveTo(x - 20 * cs, y - 10 * cs); ctx.lineTo(x + 20 * cs, y - 34 * cs); ctx.stroke();
        ctx.fillStyle = 'rgba(210,235,255,.8)';
        ctx.beginPath(); ctx.ellipse(x, y - 40 * cs - k2 * 50 * cs, 7 * cs, 10 * cs, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (e.type === 'freeze') {                // 빙결: 얼어붙었다 깨지는 결정
        const k2 = 1 - p;
        ctx.globalAlpha = p;
        ctx.fillStyle = 'rgba(200,238,255,.55)';
        ctx.beginPath();
        ctx.moveTo(x, y - 40 * cs); ctx.lineTo(x + 15 * cs, y - 10 * cs);
        ctx.lineTo(x, y + 14 * cs); ctx.lineTo(x - 15 * cs, y - 10 * cs);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#e8faff'; ctx.lineWidth = 2.2 * cs;
        for (let i = 0; i < 5; i++) {                   // 깨져 튀는 조각
          const a = i * 1.26 + 0.3, d = k2 * 34 * cs;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * d * 0.4, y - 12 * cs + Math.sin(a) * d * 0.4);
          ctx.lineTo(x + Math.cos(a) * d, y - 12 * cs + Math.sin(a) * d);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'mute') {                  // 침묵: 지워지는 음표
        ctx.globalAlpha = p;
        ctx.strokeStyle = '#8fe8d8'; ctx.lineWidth = 2.4 * cs;
        const my = y - 30 * cs - (1 - p) * 18 * cs;
        ctx.beginPath(); ctx.arc(x - 3 * cs, my + 5 * cs, 4 * cs, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 1 * cs, my + 5 * cs); ctx.lineTo(x + 1 * cs, my - 9 * cs); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,120,120,.9)';
        ctx.beginPath();
        ctx.moveTo(x - 10 * cs, my - 10 * cs); ctx.lineTo(x + 10 * cs, my + 8 * cs); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.type === 'sunder') {                // 파갑: 벗겨져 나가는 갑주 조각
        ctx.globalAlpha = p;
        ctx.fillStyle = '#d8dde3';
        for (let i = 0; i < 3; i++) {
          const a = -0.5 - i * 0.7, d = (1 - p) * 26 * cs;
          ctx.save();
          ctx.translate(x + Math.cos(a) * d, y - 6 * cs + Math.sin(a) * d);
          ctx.rotate(a + (1 - p) * 3);
          ctx.fillRect(-3 * cs, -2 * cs, 6 * cs, 4 * cs);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'deflect') {               // 활공: 빗겨 나가는 화살
        ctx.globalAlpha = p;
        ctx.strokeStyle = '#e8d9a8'; ctx.lineWidth = 2.6 * cs;
        ctx.beginPath();
        ctx.arc(x, y - 8 * cs, 16 * cs * (1.1 - p * 0.3), -1, 1);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.type === 'split') {                 // 분열: 사방으로 튀는 덩어리
        const k2 = 1 - p;
        ctx.globalAlpha = p * 0.85;
        ctx.fillStyle = e.color || '#9de08e';
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * k2 * 40 * cs, y + Math.sin(a) * k2 * 18 * cs,
                      (7 - k2 * 3) * cs, (6 - k2 * 2) * cs, 0, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'blink') {                 // 그림자 이동: 남은 자리와 새 자리
        const x2 = this.screenX(e.x2), gy2 = this.rowY(e.row || 0) - 22 * cs;
        ctx.globalAlpha = p * 0.7;
        ctx.strokeStyle = e.color || '#a07ae0'; ctx.lineWidth = 2.2 * cs;
        ctx.setLineDash([4 * cs, 7 * cs]);
        ctx.beginPath(); ctx.moveTo(x, gy2); ctx.lineTo(x2, gy2); ctx.stroke();
        ctx.setLineDash([]);
        for (const px of [x, x2]) {
          ctx.beginPath();
          ctx.ellipse(px, gy2 + 20 * cs, (1 - p) * 20 * cs + 6, (1 - p) * 7 * cs + 2, 0, 0, 7);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'tentacle') {              // 크라켄의 촉수가 뻗는 자국
        const x2 = this.screenX(e.x2);
        ctx.globalAlpha = p;
        ctx.strokeStyle = e.color || '#c98ae0';
        ctx.lineWidth = 4 * cs;
        ctx.beginPath();
        ctx.moveTo(x, y + 6 * cs);
        ctx.quadraticCurveTo((x + x2) / 2, y - 26 * cs, x2, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.type === 'fog') {                   // 전장을 훑고 지나가는 독무
        const k2 = 1 - p;
        ctx.globalAlpha = p * 0.32;
        ctx.fillStyle = '#9de08e';
        for (let i = 0; i < 9; i++) {
          const px = x + (i - 4) * 64 * cs - k2 * 90 * cs;
          ctx.beginPath();
          ctx.ellipse(px, this.groundY - 40 * cs + Math.sin(i + k2 * 3) * 16 * cs,
                      (48 + k2 * 26) * cs, (24 + k2 * 10) * cs, 0, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'chill') {
        ctx.strokeStyle = 'rgba(143,216,255,' + p + ')';
        ctx.lineWidth = 2.2 * cs;
        for (let i = 0; i < 3; i++) {
          const a = i * Math.PI / 3;
          const r2 = 12 * cs;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(a) * r2, y - Math.sin(a) * r2);
          ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
          ctx.stroke();
        }
      } else if (e.type === 'stun') {
        ctx.strokeStyle = 'rgba(255,209,102,' + p + ')';
        ctx.lineWidth = 2.4 * cs;
        const rr = 14 * cs;
        ctx.beginPath();
        ctx.ellipse(x, y - 26 * cs, rr, rr * 0.4, (1 - p) * 6, 0, 7);
        ctx.stroke();
      } else if (e.type === 'beam') {
        const x2 = this.screenX(e.x2);
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = p;
        ctx.lineWidth = 3 * cs;
        ctx.beginPath();
        ctx.moveTo(x, y - 6 * cs); ctx.lineTo(x2, y - 6 * cs); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.type === 'corpse') {
        // 쓰러지는 연출
        const k = 1 - p;                              // 0 -> 1 로 진행
        // 뒤로 밀리며 넘어가고(가속), 바닥에 닿으면 한 번 튄 뒤 가라앉는다
        const fallT = Math.min(1, k / 0.42);
        let ang = fallT * fallT * 1.5;
        if (k > 0.42) ang = 1.5 - Math.sin(Math.min(1, (k - 0.42) / 0.2) * Math.PI) * 0.12;
        const sink = k > 0.6 ? (k - 0.6) / 0.4 : 0;
        const sc = cs * (e.scale || 1);
        ctx.save();
        ctx.globalAlpha = Math.min(1, p * 1.8);
        ctx.translate(x - e.dir * fallT * 10 * sc, this.rowY(e.row) + sink * 6 * sc);
        ctx.scale(e.dir, 1);
        ctx.rotate(-ang);
        drawBody(ctx, e.st, sc, false, true, 0, false, 0);
        ctx.restore();
        if (k > 0.4 && k < 0.7) {                       // 쓰러질 때 이는 흙먼지
          const d = (k - 0.4) / 0.3;
          ctx.globalAlpha = (1 - d) * 0.4;
          ctx.fillStyle = '#d8ccb0';
          ctx.beginPath();
          ctx.ellipse(x - e.dir * 38 * sc, this.rowY(e.row), (10 + d * 22) * sc, (3 + d * 4) * sc, 0, 0, 7);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.globalAlpha = 1;
      } else if (e.type === 'dmg') {
        if (!this.showDmg) continue;
        const rise = (1 - p) * 34 * cs + (e.dy || 0);
        ctx.globalAlpha = Math.min(1, p * 2);
        ctx.font = 'bold ' + Math.round((e.crit ? 17 : 13) * cs) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3 * cs;
        ctx.strokeStyle = 'rgba(0,0,0,.65)';
        ctx.strokeText(e.v, x, y - rise);
        ctx.fillStyle = e.crit ? '#ffd166' : (e.ally ? '#ff9c8a' : '#f4ecd8');
        ctx.fillText(e.v, x, y - rise);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      } else if (e.type === 'rally') {
        ctx.strokeStyle = 'rgba(255,209,102,' + p + ')';
        ctx.lineWidth = 3 * cs;
        const rr = (1 - p) * 26 * cs + 6;
        ctx.beginPath(); ctx.arc(x, y - 6 * cs, rr, 0, 7); ctx.stroke();
      } else if (e.type === 'banner') {
        ctx.globalAlpha = Math.min(1, p * 1.4);
        ctx.fillStyle = 'rgba(201,162,39,.22)';
        ctx.fillRect(0, this.groundY - 120 * cs, this.w, 150 * cs);
        ctx.fillStyle = '#ffe9a8';
        ctx.font = 'bold ' + Math.round(26 * cs) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(tr('왕 의 명 령'), this.w / 2, this.groundY - 60 * cs);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      } else if (e.type === 'cast') {
        if (this.glfx && this.glfx.ok) this.emitCast(e, x, cs);
        else this.drawCast(e, x, y, p, cs);
      } else if (e.type === 'spawn') {
        ctx.strokeStyle = 'rgba(255,255,255,' + p + ')';
        ctx.lineWidth = 2.5 * cs;
        ctx.beginPath();
        ctx.ellipse(x, this.rowY(e.row) + 2, (1 - p) * 30 * cs, (1 - p) * 10 * cs, 0, 0, 7);
        ctx.stroke();
      }
    }
  }

  /* cast 연출을 WebGL 파티클로 넘긴다. 연출 하나는 한 번만 터진다. */
  emitCast(e, x, cs) {
    if (e._emitted) return;
    e._emitted = true;
    this.glfx.emit(e.kind, x, this.rowY(e.row || 0), {
      color: this.rgbOf(e.color),
      radius: (e.r || 110) * this.zoom,
      scale: cs,
      big: !!e.big
    });
  }

  /* 한 번만 터뜨리는 GL 파티클. WebGL 이 없거나 절전이면 아무것도 안 한다. */
  glOnce(e, kind, x, y, color, radius, scale) {
    if (e._emitted || !this.glfx || !this.glfx.ok || this.fxq <= 0) return false;
    e._emitted = true;
    this.glfx.emit(kind, x, y, { color: this.rgbOf(color), radius: radius || 60, scale: scale || this.cs });
    return true;
  }

  /* '#rrggbb' -> [r,g,b] 0~1. 같은 색이 계속 오므로 표에 담아 둔다. */
  rgbOf(hex) {
    if (!this._rgbCache) this._rgbCache = {};
    let v = this._rgbCache[hex];
    if (v) return v;
    const h = (typeof hex === 'string' && hex.charAt(0) === '#') ? hex : '#ffe14a';
    v = [parseInt(h.slice(1, 3), 16) / 255,
         parseInt(h.slice(3, 5), 16) / 255,
         parseInt(h.slice(5, 7), 16) / 255];
    if (!(v[0] >= 0)) v = [1, 0.88, 0.29];
    this._rgbCache[hex] = v;
    return v;
  }

  /* 병종별 필살 연출. 가산 합성으로 화면 위에서 빛난다. */
  drawCast(e, x, y, p, cs) {
    const ctx = this.ctx;
    const k = 1 - p;                       // 0 -> 1 진행
    const R = Math.max(60, e.r * this.zoom);
    const big = e.big ? 1.6 : 1;
    const gy = y + 16 * cs;                // 지면 근처
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';

    switch (e.kind) {
      case 'lightning': {
        const top = -20;
        for (let b = 0; b < (e.big ? this.qn(3) : 1); b++) {
          const off = (b - 1) * 30 * cs;
          const pts = [];
          let cy = top, cx2 = x + off;
          pts.push([cx2, cy]);
          while (cy < gy) {
            cy += (gy - top) / 7;
            cx2 += (Math.sin(cy * 0.11 + b * 2.7 + e.x) * 26 - 5) * cs;
            pts.push([cx2, cy]);
          }
          const stroke = (w, col, a) => {
            ctx.globalAlpha = a * p;
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let n = 1; n < pts.length; n++) ctx.lineTo(pts[n][0], pts[n][1]);
            ctx.stroke();
          };
          // 품질을 낮췄을 때는 바깥 광채부터 뺀다
          if (this.fxq >= 1) stroke(30 * cs * big, e.color, 0.10);   // 바깥 광채
          if (this.fxq >= 0.5) stroke(16 * cs * big, e.color, 0.28); // 안쪽 광채
          stroke(7 * cs * big, e.color, 0.8);         // 본체
          stroke(2.6 * cs * big, '#ffffff', 1);       // 흰 심지
        }
        // 착탄 폭발
        ctx.globalAlpha = p * 0.85;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(x, gy, R * (0.5 + k * 1.1), R * 0.3 * (0.5 + k), 0, 0, 7);
        ctx.fill();
        ctx.globalAlpha = p;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, gy, R * (0.16 + k * 0.4), R * 0.12 * (0.5 + k), 0, 0, 7);
        ctx.fill();
        // 튀는 잔전기
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3 * cs;
        ctx.globalAlpha = p * 0.9;
        for (let i = 0, n = this.qn(8); i < n; i++) {
          const a = i * 0.8 + k;
          const d = R * (0.3 + k * 0.8);
          ctx.beginPath();
          ctx.moveTo(x, gy);
          ctx.lineTo(x + (e.dir || 1) * Math.cos(a) * d, gy - Math.abs(Math.sin(a)) * d * 0.55);
          ctx.stroke();
        }
        break;
      }
      case 'shockwave': {
        for (let i = 0, n = this.qn(4); i < n; i++) {
          const rr = R * (0.2 + k * (0.8 + i * 0.4));
          ctx.globalAlpha = p * (1 - i * 0.2);
          ctx.strokeStyle = i === 0 ? '#ffffff' : e.color;
          ctx.lineWidth = (8 - i * 1.6) * cs * big;
          ctx.beginPath();
          ctx.ellipse(x, gy, rr, rr * 0.32, 0, 0, 7);
          ctx.stroke();
        }
        ctx.globalAlpha = p;
        ctx.lineWidth = 3.4 * cs;
        ctx.strokeStyle = e.color;
        for (let i = 0, n = this.qn(7); i < n; i++) {
          const a = i * 0.9 + k * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * R * 0.25, gy + Math.sin(a) * R * 0.1);
          ctx.lineTo(x + Math.cos(a) * R * (0.7 + k * 0.6),
                     gy - 20 * cs + Math.sin(a) * R * 0.2);
          ctx.stroke();
        }
        break;
      }
      case 'pillar': {
        const h = (this.groundY - 10) * Math.min(1, k * 1.7);
        const g = ctx.createLinearGradient(x, gy, x, gy - h);
        g.addColorStop(0, e.color);
        g.addColorStop(0.5, e.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = p * 0.9;
        ctx.fillStyle = g;
        ctx.fillRect(x - R * 0.4, gy - h, R * 0.8, h);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = p * 0.8;
        ctx.fillRect(x - R * 0.1, gy - h, R * 0.2, h);
        ctx.globalAlpha = p;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 5 * cs;
        ctx.beginPath();
        ctx.ellipse(x, gy, R * (0.35 + k * 0.7), R * 0.22, 0, 0, 7);
        ctx.stroke();
        ctx.fillStyle = e.color;
        for (let i = 0, n = this.qn(7); i < n; i++) {
          const yy = gy - ((k * 140 + i * 30) % (h + 30));
          ctx.globalAlpha = p * 0.9;
          ctx.beginPath();
          ctx.arc(x + Math.sin(i * 2.1 + k * 5) * R * 0.35, yy, 5 * cs, 0, 7);
          ctx.fill();
        }
        break;
      }
      case 'runes': {
        const rr = R * (0.35 + k * 0.8);
        ctx.globalAlpha = p * 0.55;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(x, gy, rr, rr * 0.34, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = p;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.4 * cs;
        ctx.beginPath();
        ctx.ellipse(x, gy, rr, rr * 0.34, 0, 0, 7); ctx.stroke();
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2.8 * cs;
        ctx.beginPath();
        ctx.ellipse(x, gy, rr * 0.6, rr * 0.2, 0, 0, 7); ctx.stroke();
        for (let i = 0, n = this.qn(10); i < n; i++) {
          const a = i * Math.PI / 5 + k * 3;
          const px = x + Math.cos(a) * rr * 0.82;
          const py = gy + Math.sin(a) * rr * 0.28;
          ctx.beginPath();
          ctx.moveTo(px, py - 10 * cs); ctx.lineTo(px, py + 10 * cs);
          ctx.moveTo(px - 6 * cs, py - 3 * cs); ctx.lineTo(px + 6 * cs, py + 3 * cs);
          ctx.stroke();
        }
        // 솟아오르는 마력
        ctx.fillStyle = e.color;
        for (let i = 0, n = this.qn(8); i < n; i++) {
          const a = i * 0.9;
          ctx.globalAlpha = p * 0.8;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * rr * 0.7, gy - k * 70 * cs - i * 6 * cs, 4.5 * cs, 0, 7);
          ctx.fill();
        }
        break;
      }
      case 'firestorm': {
        for (let i = 0, n = this.qn(18); i < n; i++) {
          const seed = i * 7.3 + Math.floor(e.x);
          const fx2 = x + Math.sin(seed) * R * 0.85;
          const rise = (k * 95 + (seed % 26)) * cs;
          const rad = (10 - (i % 5)) * cs * (1.1 - k * 0.35) * big;
          ctx.globalAlpha = p * (i % 3 ? 0.85 : 1);
          ctx.fillStyle = i % 3 ? e.color : '#fff2b0';
          ctx.beginPath();
          ctx.ellipse(fx2, gy - rise, rad, rad * 1.7, 0, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = p * 0.8;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(x, gy, R * (0.5 + k * 0.6), R * 0.26, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = p;
        ctx.fillStyle = '#fff2b0';
        ctx.beginPath();
        ctx.ellipse(x, gy, R * (0.2 + k * 0.3), R * 0.1, 0, 0, 7); ctx.fill();
        break;
      }
      case 'iceburst': {
        ctx.globalAlpha = p;
        for (let i = 0, n = this.qn(11); i < n; i++) {
          const a = i * 0.58 + 0.15;
          const d = R * (0.2 + k * 0.85);
          const px = x + (e.dir || 1) * Math.cos(a) * d;
          const py = gy + Math.sin(a) * d * 0.35;
          ctx.fillStyle = i % 2 ? e.color : '#ffffff';
          ctx.beginPath();
          ctx.moveTo(px, py - 18 * cs * big);
          ctx.lineTo(px + 7 * cs, py);
          ctx.lineTo(px, py + 8 * cs);
          ctx.lineTo(px - 7 * cs, py);
          ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 4.5 * cs;
        ctx.beginPath();
        ctx.ellipse(x, gy, R * (0.35 + k * 0.75), R * 0.24, 0, 0, 7); ctx.stroke();
        ctx.globalAlpha = p * 0.5;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(x, gy, R * (0.4 + k * 0.6), R * 0.2, 0, 0, 7); ctx.fill();
        break;
      }
      case 'slash': {
        const L = 46 * cs * big;
        for (let i = 0; i < 2; i++) {
          const a = (i ? -0.75 : 0.75) + k * 0.5;
          ctx.globalAlpha = p * 0.5;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 12 * cs * big;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L);
          ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
          ctx.stroke();
          ctx.globalAlpha = p;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3.4 * cs * big;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L);
          ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
          ctx.stroke();
        }
        ctx.globalAlpha = p * 0.8;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3 * cs;
        ctx.beginPath();
        ctx.arc(x, y, L * (0.55 + k * 0.7), -1.3, 1.3);
        ctx.stroke();
        break;
      }
      case 'tide': {                       // 밀려왔다 빠지는 물결
        ctx.globalAlpha = p * 0.6;
        ctx.fillStyle = e.color;
        for (let i = 0; i < 3; i++) {
          const rr = R * (0.3 + k * (0.8 + i * 0.25));
          ctx.beginPath();
          ctx.ellipse(x, gy - i * 8 * cs, rr, rr * 0.22, 0, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = p;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.6 * cs;
        for (let i = 0, n = this.qn(7); i < n; i++) {
          const a = -0.3 - i * 0.4, d = R * (0.2 + k * 0.9);
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * d * 0.4, gy + Math.sin(a) * d * 0.3);
          ctx.lineTo(x + Math.cos(a) * d, gy + Math.sin(a) * d * 0.5);
          ctx.stroke();
        }
        break;
      }
      case 'bubble': {                     // 떠오르는 물거품
        for (let i = 0, n = this.qn(10); i < n; i++) {
          const a = i * 1.7 + k * 2;
          ctx.globalAlpha = p * 0.7;
          ctx.strokeStyle = i % 2 ? e.color : '#ffffff';
          ctx.lineWidth = 2 * cs;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * R * 0.5, y - k * 42 * cs + Math.sin(a) * R * 0.25,
                  (4 + (i % 3) * 3) * cs * big, 0, 7);
          ctx.stroke();
        }
        break;
      }
      case 'songwave': {                   // 퍼지는 노랫결
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3 * cs;
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = p * (1 - i * 0.25);
          const rr = R * (0.2 + k * 0.5) + i * 16 * cs;
          ctx.beginPath();
          ctx.arc(x, y - 10 * cs, rr, -1.1, 1.1);
          ctx.stroke();
        }
        break;
      }
      case 'harpoon': {                    // 꿰뚫고 남은 자국
        ctx.globalAlpha = p;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.4 * cs * big;
        ctx.beginPath();
        ctx.moveTo(x - (e.dir || 1) * R * 0.9, y - 4 * cs);
        ctx.lineTo(x + (e.dir || 1) * 12 * cs, y - 4 * cs);
        ctx.stroke();
        ctx.globalAlpha = p * 0.5;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 9 * cs * big;
        ctx.stroke();
        break;
      }
      case 'hex': {                        // 피어오르는 저주의 연기
        for (let i = 0, n = this.qn(9); i < n; i++) {
          const a = i * 0.7 + k;
          ctx.globalAlpha = p * 0.45;
          ctx.fillStyle = i % 3 ? e.color : '#ffffff';
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * R * 0.45, gy - k * (20 + (i % 4) * 16) * cs,
                  (6 + k * 10) * cs * big, 0, 7);
          ctx.fill();
        }
        break;
      }
      case 'foxfire': {                    // 나선 여우불
        for (let i = 0, n = this.qn(10); i < n; i++) {
          const a = i / n * Math.PI * 2 + k * 4;
          const rr = R * (0.2 + k * 0.5);
          ctx.globalAlpha = p * 0.8;
          ctx.fillStyle = i % 2 ? e.color : '#ffffff';
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * rr, y - k * 40 * cs + Math.sin(a) * rr * 0.35, (5 + (i % 3) * 2) * cs * big, 0, 7);
          ctx.fill();
        }
        break;
      }
      case 'inkslash': {                   // 푸른 넋의 일섬
        const L = 60 * cs * big;
        ctx.globalAlpha = p * 0.6; ctx.strokeStyle = e.color; ctx.lineWidth = 10 * cs * big;
        ctx.beginPath(); ctx.moveTo(x - L, y + 4 * cs); ctx.lineTo(x + L * (0.4 + k), y - 4 * cs); ctx.stroke();
        ctx.globalAlpha = p; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.6 * cs * big;
        ctx.beginPath(); ctx.moveTo(x - L, y + 4 * cs); ctx.lineTo(x + L * (0.4 + k), y - 4 * cs); ctx.stroke();
        break;
      }
      case 'goldburst': {                  // 금화 분수
        ctx.fillStyle = '#ffd35a';
        for (let i = 0, n = this.qn(12); i < n; i++) {
          const a = -Math.PI * 0.15 - i / n * Math.PI * 0.7;
          const d = k * 60 * cs;
          ctx.globalAlpha = p;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d + k * k * 40 * cs, 4 * cs, 3 * cs, a, 0, 7);
          ctx.fill();
        }
        break;
      }
      case 'tesla': {                      // 갈라지는 전광
        ctx.strokeStyle = e.color; ctx.lineWidth = 3 * cs * big;
        for (let b = 0; b < 3; b++) {
          ctx.globalAlpha = p;
          ctx.beginPath(); ctx.moveTo(x, y);
          let px = x, py = y;
          for (let j = 0; j < 5; j++) {
            px += (b - 1) * 10 * cs + 8 * cs; py += (Math.sin(j * 3.1 + b + k * 20) * 12) * cs;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = p; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, 7 * cs * (1 + k), 0, 7); ctx.fill();
        break;
      }
      case 'steamburst': {                 // 증기 뭉게
        ctx.fillStyle = '#e8e6e0';
        for (let i = 0, n = this.qn(8); i < n; i++) {
          const a = -Math.PI + i / (n - 1) * Math.PI;
          ctx.globalAlpha = p * 0.35;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * R * 0.6 * k, gy - 20 * cs + Math.sin(a) * R * 0.3 * k, (14 + k * 22) * cs, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = p; ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(x, gy - 20 * cs, 9 * cs * (1 - k), 0, 7); ctx.fill();
        break;
      }
      case 'holy': {
        ctx.globalAlpha = p * 0.55;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(x, y, R * (0.3 + k * 0.5), R * (0.3 + k * 0.5), 0, 0, 7); ctx.fill();
        ctx.globalAlpha = p;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4 * cs * big;
        for (let i = 0, n = this.qn(10); i < n; i++) {
          const a = i * Math.PI / 5 + k * 1.2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * R * 0.15, y + Math.sin(a) * R * 0.15);
          ctx.lineTo(x + Math.cos(a) * R * (0.55 + k * 0.7),
                     y + Math.sin(a) * R * (0.55 + k * 0.7));
          ctx.stroke();
        }
        ctx.globalAlpha = p;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, R * 0.14 * (1 + k), 0, 7); ctx.fill();
        break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  render(battle, dt, fxDt) {
    this.trackFrame(dt);
    this.outcome = battle.state === 'win' ? 'win' : (battle.state === 'play' ? null : 'lose');
    this._battle = battle;
    this.clock = (this.clock || 0) + dt;             // 전투가 끝나 시간이 멈춰도 도는 시계
    this.showDmg = typeof Settings === 'undefined' || Settings.get('dmgNums');
    const camBefore = this.cam;
    this.follow(battle, dt);
    const ctx = this.ctx;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shakeOn = typeof Settings === 'undefined' || Settings.get('shake');
    const sh = (reduced || !shakeOn) ? 0 : (battle.shake || 0);
    this.sceneTime = battle.time;
    let shakeX = 0, shakeY = 0;
    ctx.save();
    if (sh > 0.2) {
      shakeX = (Math.random() - 0.5) * sh;
      shakeY = (Math.random() - 0.5) * sh * 0.6;
      ctx.translate(shakeX, shakeY);
    }
    this.drawBackground(battle.stageIndex);
    this.drawProps(battle.stageIndex);
    this.drawCastle(battle.allyCastle, false);
    this.drawCastle(battle.enemyCastle, true);

    const all = battle.allies.concat(battle.enemies);
    all.sort((a, b) => (a.row - b.row) || (a.x - b.x));
    for (const f of all) this.drawFighter(f);
    if (battle.burrowers) for (const b of battle.burrowers) this.drawBurrow(b);

    this.drawShots(battle);
    this.drawFx(battle);

    // 전설 병종의 필살기 섬광
    if (!reduced && battle.flash > 0) {
      ctx.globalAlpha = Math.min(0.45, battle.flash);
      ctx.fillStyle = battle.flashColor || '#ffffff';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    this.drawMiniMap(battle);
    this.drawBossBar(battle);
    this.drawGlFx(battle, fxDt === undefined ? dt : fxDt, camBefore, shakeX, shakeY);
  }

  /* WebGL 연출 레이어. 파티클은 화면 좌표로 살기 때문에 카메라가 흐른 만큼
   * 같이 밀어 주고, 화면 흔들림도 같은 값으로 따라가게 한다. */
  drawGlFx(battle, dt, camBefore, shakeX, shakeY) {
    const g = this.glfx;
    if (!g || !g.ok) return;
    g.quality = this.fxq < 0.5 ? 0.45 : (this.fxq < 1 ? 0.7 : 1);
    g.setOffset(shakeX, shakeY);
    g.update(dt, (camBefore - this.cam) * this.zoom);
    g.draw();
  }

  /* 보스 체력바 + 등장 경보 */
  drawBossBar(battle) {
    const ctx = this.ctx;
    const boss = battle.aliveBoss();
    if (boss) {
      const w = Math.min(300, this.w - 80), h = 10;
      const x0 = (this.w - w) / 2, y0 = 106 + this.safeTop;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
      ctx.fillStyle = '#8e2f3a';
      ctx.fillRect(x0, y0, w * (boss.hp / boss.maxHp), h);
      ctx.fillStyle = '#ffedc9';
      for (const phase of boss.s.phases || []) ctx.fillRect(x0 + w * phase.at - 1, y0, 2, h);
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 - 2.5, y0 - 2.5, w + 5, h + 5);
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(boss.s.name, this.w / 2, y0 + h + 13);
      ctx.fillStyle = '#f0e6c8';
      ctx.fillText(boss.s.name, this.w / 2, y0 + h + 13);
      ctx.textAlign = 'left';
    }
    // 보스 패턴 이름
    if (battle.patternT > 0) {
      const q = Math.min(1, battle.patternT / 1.7);
      const rise = (1 - q) * 18;
      ctx.globalAlpha = Math.min(1, q * 2.2);
      // 테두리와 글자를 같은 문구로 그린다 (번역 전/후가 섞이면 글자가 뭉개진다)
      const text = tr(battle.patternName);
      let fs = Math.round(this.h * 0.052);
      ctx.font = 'bold ' + fs + 'px sans-serif';
      const tw = ctx.measureText(text).width;
      if (tw > this.w * 0.86) { fs = Math.floor(fs * this.w * 0.86 / tw); ctx.font = 'bold ' + fs + 'px sans-serif'; }
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(text, this.w / 2, this.h * 0.3 - rise);
      ctx.fillStyle = '#ffcf70';
      ctx.fillText(text, this.w / 2, this.h * 0.3 - rise);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    if (battle.bossAlert > 0) {
      const p = Math.min(1, battle.bossAlert / 2.6);
      ctx.fillStyle = 'rgba(142,47,58,' + (0.35 * p) + ')';
      ctx.fillRect(0, this.h * 0.3, this.w, this.h * 0.22);
      ctx.fillStyle = 'rgba(255,235,210,' + p + ')';
      ctx.font = 'bold ' + Math.round(this.h * 0.075) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tr('보스 등장'), this.w / 2, this.h * 0.44);
      ctx.font = 'bold ' + Math.round(this.h * 0.045) + 'px sans-serif';
      ctx.fillText(battle.bossName || '', this.w / 2, this.h * 0.5);
      ctx.textAlign = 'left';
    }
  }

  drawMiniMap(battle) {
    const ctx = this.ctx;
    const w = Math.min(280, this.w - 40), h = 8;
    const x0 = (this.w - w) / 2, y0 = 88 + this.safeTop;
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
 *  발끝 y = 0, 머리 꼭대기 ≈ -58*s. 항상 +x 방향(앞)을 본다.
 * ======================================================================= */
function easeOutBack(k) {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
}

function drawBody(ctx, st, s, flash, hurt, phase, moving, atk, wind, cheer) {
  const S = {
    ctx: ctx, s: s, wind: wind || 0, cheer: !!cheer, style: attackStyle(st),
    live: wind !== undefined,          // 전투 중인 병사만 잔상을 그린다 (도감·배너 제외)
    col: flash ? '#ffffff' : st.body,
    acc: flash ? '#ffffff' : st.accent,
    tun: flash ? '#ffffff' : (st.tunic || st.body),
    raw: st, flash: flash,
    phase: phase, moving: moving, atk: atk, hurt: hurt,
    lw: 3.2 * s
  };
  const col = S.col, acc = S.acc, tun = S.tun;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (HUMANOID[st.shape]) armSwing(S);

  switch (st.shape) {
    /* ---------------------- 왕국군 ---------------------- */
    case 'hades':
      robe(S,23*s,-42*s,tun);legsHidden(S);torso(S,4*s);head(S,'crown');
      armWeapon(S,-.2,()=>{line(S,0,10*s,5*s,-46*s,3*s,acc);line(S,-3*s,-45*s,-3*s,-57*s,3*s,acc);line(S,12*s,-45*s,12*s,-57*s,3*s,acc);line(S,-3*s,-45*s,12*s,-45*s,3*s,acc);},8*s);break;
    case 'odin':
      robe(S,21*s,-40*s,tun);legsHidden(S);torso(S);head(S,'wide');
      line(S,-5*s,-62*s,2*s,-62*s,3*s,'#17232c');
      armWeapon(S,-.15,()=>{line(S,0,8*s,35*s,-47*s,3*s,acc);tri(S,40*s,-55*s,28*s,-46*s,37*s,-41*s,acc);},5*s);
      for(let i=-1;i<=1;i+=2){const yy=-72*s+Math.sin(phase+i)*3*s;line(S,i*19*s,yy,i*27*s,yy-5*s,3*s,col);line(S,i*27*s,yy-5*s,i*35*s,yy,3*s,col);}break;
    case 'ra':
      robe(S,20*s,-40*s,tun);legsHidden(S);torso(S);head(S,'nemes');
      tri(S,8*s,-63*s,22*s,-60*s,8*s,-57*s,acc);
      ctx.strokeStyle=acc;ctx.lineWidth=3*s;ctx.beginPath();ctx.arc(0,-84*s,11*s,0,7);ctx.stroke();
      for(let i=-1;i<=1;i+=2)for(let j=0;j<4;j++)line(S,i*8*s,-42*s,i*(30+j*5)*s,(-55+j*7)*s,3*s,acc);break;
    case 'persephone':
      robe(S,20*s,-40*s,tun);legsHidden(S);torso(S);head(S,'laurel');
      ctx.fillStyle=acc;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(i*7*s,-70*s,4*s,0,7);ctx.fill();}
      armWeapon(S,0,()=>{ctx.fillStyle=acc;ctx.beginPath();ctx.arc(8*s,-3*s,6*s,0,7);ctx.fill();},6*s);break;
    case 'skadi':
      legs(S);torso(S);head(S,'furhood');bow(S,21*s,-34*s,23*s,acc);arm(S,20*s,-34*s);
      line(S,-12*s,-42*s,-20*s,-22*s,6*s,tun);break;
    case 'bastet':
      legs(S);torso(S);head(S,'ears');
      line(S,-9*s,-26*s,-24*s,-17*s,3*s,acc);line(S,-24*s,-17*s,-27*s,-28*s,3*s,acc);
      armWeapon(S,-.3+atk,()=>{for(let j=0;j<3;j++)line(S,5*s,j*3*s,19*s,(-5+j*3)*s,2*s,acc);},6*s);break;
    case 'runeguard':
      legs(S); torso(S, 4.5*s); head(S,'greathelm');
      shieldShape(S,14*s,-50*s,20*s,43*s,acc);
      line(S,12*s,-44*s,24*s,-32*s,2*s,tun); line(S,24*s,-44*s,12*s,-32*s,2*s,tun);
      armWeapon(S,-.2,()=>line(S,0,0,25*s,-8*s,4*s,acc),5*s);
      break;
    case 'musketeer':
      legs(S); torso(S); head(S,'wide');
      armWeapon(S,-.15-atk*.15,()=>{
        line(S,-8*s,0,38*s,-3*s,5*s,tun); line(S,10*s,-3*s,43*s,-4*s,3*s,acc);
        if(atk>.65){tri(S,46*s,-4*s,58*s,-10*s,56*s,3*s,acc);}
      },8*s);
      break;
    case 'purifier':
      robe(S,17*s,-39*s,tun); legsHidden(S); torso(S); head(S,'coif'); halo(S,acc);
      armWeapon(S,.2,()=>{line(S,0,0,10*s,16*s,1.5*s,acc);
        ctx.fillStyle=acc;ctx.beginPath();ctx.arc(10*s,20*s,6*s,0,7);ctx.fill();},5*s);
      break;
    case 'frostlancer':
      legs(S); torso(S,3.8*s); head(S,'icehorn');
      armWeapon(S,-.2,()=>{line(S,0,0,49*s,-12*s,3*s,acc);
        tri(S,56*s,-14*s,41*s,-23*s,43*s,-5*s,acc);},9*s);
      break;
    /* ---------------------- 2.6 왕국군 증원 ---------------------- */
    case 'banneret':                               // 왕기 기수: 등 뒤로 펄럭이는 큰 깃발
      legs(S); torso(S, 4.6 * s); head(S, 'plume'); cape(S, -1, tun, .9);
      armWeapon(S, -1.38, () => {
        line(S, -14 * s, 0, 50 * s, 0, 3.4 * s, '#6b4b2a');
        ctx.fillStyle = S.flash ? '#fff' : tun;
        ctx.beginPath();
        ctx.moveTo(46 * s, 2 * s);
        ctx.quadraticCurveTo(38 * s, 16 * s + Math.sin(phase * 1.7) * 3 * s, 42 * s, 30 * s);
        ctx.lineTo(24 * s, 26 * s);
        ctx.quadraticCurveTo(22 * s, 12 * s, 24 * s, 2 * s);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(34 * s, 15 * s, 4 * s, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(52 * s, 0, 3 * s, 0, 7); ctx.fill();
      }, 7 * s);
      break;
    case 'trapper':                                // 덫 공병: 어깨에 감은 사슬, 손에 쇠덫
      legs(S); torso(S); head(S, 'cap');
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 1.8 * s;
      ctx.beginPath(); ctx.arc(-4 * s, -34 * s, 9 * s, -0.4, 2.6); ctx.stroke();
      armWeapon(S, .35, () => {
        ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2.4 * s;
        ctx.beginPath(); ctx.arc(10 * s, 4 * s, 7 * s, Math.PI, 0); ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const tx = (4 + i * 4) * s;
          line(S, tx, 4 * s, tx + 1.5 * s, -1 * s, 1.6 * s, S.flash ? '#fff' : '#d8dde3');
        }
      }, 5 * s);
      break;
    case 'warlock':                                // 흑마술사: 해골 지팡이와 보랏빛 연기
      robe(S, 19 * s, -40 * s, tun); legsHidden(S); torso(S); head(S, 'hood');
      armWeapon(S, -.5 - atk * .3, () => {
        line(S, 0, 6 * s, 2 * s, -44 * s, 3 * s, '#2a2230');
        skull(S, 2 * s, -50 * s, 5.5 * s, S.flash ? '#fff' : '#d8d2c0', S.flash ? '#fff' : acc);
      }, 8 * s);
      ctx.globalAlpha = .55;
      for (let i = 0; i < 4; i++) {
        const a = phase * .9 + i * 1.6;
        orb(S, Math.cos(a) * 17 * s, -30 * s + Math.sin(a * 1.3) * 12 * s, 2.4 * s, S.flash ? '#fff' : acc);
      }
      ctx.globalAlpha = 1;
      break;
    case 'dragoon':                                // 용기병: 날개 투구와 긴 창, 뛰어오를 자세
      legs(S); torso(S, 4.2 * s); head(S, 'wingedhelm'); cape(S, -1, tun, .8);
      armWeapon(S, -.18, () => {
        line(S, -16 * s, 4 * s, 46 * s, -10 * s, 3.4 * s, '#6b4b2a');
        tri(S, 58 * s, -13 * s, 44 * s, -20 * s, 44 * s, -5 * s, acc);
        line(S, 34 * s, -14 * s, 34 * s, -3 * s, 2 * s, acc);
      }, 8 * s);
      break;
    case 'arbalest': {                             // 강노병: 바닥에 괴어 쏘는 쇠뇌
      legs(S); torso(S, 4 * s); head(S, 'coif');
      const draw = 1 - Math.min(1, S.wind);
      ctx.save(); ctx.translate(6 * s, -32 * s); ctx.rotate(-.12 - atk * .1);
      ctx.fillStyle = S.flash ? '#fff' : tun;
      ctx.fillRect(-18 * s, -3 * s, 46 * s, 6 * s);
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 3.4 * s;
      ctx.beginPath();
      ctx.moveTo(20 * s, -20 * s); ctx.quadraticCurveTo(28 * s, 0, 20 * s, 20 * s); ctx.stroke();
      ctx.strokeStyle = S.flash ? '#fff' : '#e6e0d0'; ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      ctx.moveTo(20 * s, -20 * s); ctx.lineTo(-2 * s - draw * 14 * s, 0); ctx.lineTo(20 * s, 20 * s);
      ctx.stroke();
      if (S.wind > .2) line(S, -4 * s, 0, 30 * s, 0, 2.4 * s, S.flash ? '#fff' : '#b9c2cc');
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.moveTo(-6 * s, 3 * s); ctx.lineTo(-14 * s, 30 * s); ctx.stroke();
      ctx.restore();
      arm(S, 12 * s, -30 * s);
      break;
    }
    case 'warmonk':                                // 호국 무승: 민머리와 염주, 긴 봉
      legs(S); torso(S, 4 * s);
      head(S, 'wrap');
      ctx.fillStyle = S.flash ? '#fff' : acc;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.arc(i * 4 * s, -38 * s + Math.abs(i) * 1.5 * s, 1.8 * s, 0, 7); ctx.fill();
      }
      armWeapon(S, -.9 + atk * 2.2, () => {
        line(S, -30 * s, 0, 34 * s, 0, 3.2 * s, S.flash ? '#fff' : '#8a6a3a');
        line(S, 30 * s, -3 * s, 30 * s, 3 * s, 4 * s, acc);
        line(S, -26 * s, -3 * s, -26 * s, 3 * s, 4 * s, acc);
      }, 5 * s);
      break;
    case 'snaretrap': {                            // 쇠덫: 벌린 톱니 턱과 말뚝에 묶인 사슬
      const open = 0.9 + Math.sin(phase * 2) * 0.12;
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2.4 * s;
      ctx.beginPath();                             // 말뚝에 이어진 사슬
      ctx.moveTo(-30 * s, -2 * s);
      ctx.quadraticCurveTo(-18 * s, -10 * s, -6 * s, -6 * s); ctx.stroke();
      line(S, -30 * s, -14 * s, -30 * s, 2 * s, 4 * s, S.flash ? '#fff' : col);
      ctx.fillStyle = S.flash ? '#fff' : col;      // 바닥 판
      ctx.beginPath(); ctx.ellipse(0, -4 * s, 20 * s, 7 * s, 0, 0, 7); ctx.fill();
      for (let d = -1; d <= 1; d += 2) {           // 벌어진 턱 두 짝
        ctx.save(); ctx.translate(d * 15 * s, -6 * s); ctx.rotate(-d * open);
        ctx.fillStyle = S.flash ? '#fff' : acc;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let i = 0; i < 5; i++) ctx.lineTo(-d * (i * 5 + 2) * s, (i % 2 ? -14 : -4) * s);
        ctx.lineTo(-d * 26 * s, 3 * s);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = S.flash ? '#fff' : '#d8dde3';   // 가운데 발판
      ctx.beginPath(); ctx.arc(0, -6 * s, 6 * s, 0, 7); ctx.fill();
      break;
    }
    /* ---------------------- 심연의 해역 ---------------------- */
    case 'ryujin': {                               // 용왕: 용 머리와 긴 수염, 감도는 물줄기
      robe(S, 22 * s, -44 * s, tun); legsHidden(S); torso(S, 4 * s);
      ctx.fillStyle = S.flash ? '#fff' : col;      // 용의 두상
      ctx.beginPath(); ctx.ellipse(3 * s, -54 * s, 12 * s, 9 * s, -.15, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10 * s, -52 * s); ctx.lineTo(24 * s, -48 * s); ctx.lineTo(10 * s, -44 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : acc;      // 뿔과 눈
      tri(S, -2 * s, -62 * s, -10 * s, -78 * s, 4 * s, -66 * s, acc);
      tri(S, 6 * s, -62 * s, 4 * s, -80 * s, 12 * s, -64 * s, acc);
      ctx.beginPath(); ctx.arc(10 * s, -55 * s, 2.2 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2 * s;
      for (let i = -1; i <= 1; i += 2) {           // 수염
        ctx.beginPath(); ctx.moveTo(18 * s, -48 * s + i * 3 * s);
        ctx.quadraticCurveTo(34 * s, -44 * s + i * 12 * s, 26 * s, -24 * s + i * 8 * s); ctx.stroke();
      }
      ctx.globalAlpha = .5;                        // 감도는 물줄기
      ctx.lineWidth = 3 * s;
      for (let i = 0; i < 3; i++) {
        const a = phase * 1.1 + i * 2.1;
        ctx.beginPath();
        ctx.ellipse(0, -34 * s + Math.sin(a) * 10 * s, (26 + i * 5) * s, 6 * s, Math.sin(a) * .3, 0, 7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'kraken': {                               // 크라켄: 둥근 몸통과 휘감기는 촉수 셋
      ctx.strokeStyle = S.flash ? '#fff' : col; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = phase * 1.3 + i * 1.6, reach = (26 + i * 9) * s * (1 + atk * .5);
        ctx.beginPath();
        ctx.moveTo(-6 * s, -24 * s);
        ctx.quadraticCurveTo(reach * .6, -34 * s + Math.sin(a) * 14 * s,
                             reach, -8 * s + Math.cos(a) * 16 * s);
        ctx.stroke();
      }
      ctx.fillStyle = S.flash ? '#fff' : col;      // 몸통
      ctx.beginPath(); ctx.ellipse(-10 * s, -40 * s, 18 * s, 22 * s, .1, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : tun;
      ctx.beginPath(); ctx.ellipse(-10 * s, -30 * s, 15 * s, 11 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : acc;      // 눈
      ctx.beginPath(); ctx.ellipse(0, -44 * s, 6 * s, 4.5 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22';
      ctx.beginPath(); ctx.ellipse(1 * s, -44 * s, 1.6 * s, 4 * s, 0, 0, 7); ctx.fill();
      break;
    }
    case 'siren': {                                // 해원 인어: 비늘 꼬리와 퍼지는 노랫결
      ctx.fillStyle = S.flash ? '#fff' : tun;      // 비늘 꼬리: 앞으로 굽어 내려간다
      ctx.beginPath();
      ctx.moveTo(-7 * s, -24 * s);
      ctx.quadraticCurveTo(14 * s + Math.sin(phase) * 5 * s, -18 * s, 10 * s, -2 * s);
      ctx.lineTo(-6 * s, -4 * s); ctx.lineTo(-9 * s, -16 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 1.4 * s;
      for (let i = 0; i < 3; i++) {                // 비늘 결
        ctx.beginPath();
        ctx.arc(-2 * s + i * 4 * s, -18 * s + i * 5 * s, 5 * s, -0.4, 2.2); ctx.stroke();
      }
      tri(S, 11 * s, -4 * s, 24 * s, 2 * s, 6 * s, 6 * s, S.flash ? '#fff' : acc);
      torso(S, 3.4 * s); head(S, 'moon');
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2 * s;
      ctx.globalAlpha = .6;                        // 노랫결
      for (let i = 0; i < 3; i++) {
        const r = (12 + i * 9) * s + atk * 12 * s;
        ctx.beginPath(); ctx.arc(14 * s, -48 * s, r, -1, 1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      arm(S, 14 * s, -44 * s);
      break;
    }
    case 'turtleguard':                            // 현무 수호병: 등에 인 커다란 껍질
      legs(S, 18 * s);
      ctx.fillStyle = S.flash ? '#fff' : col;
      ctx.beginPath(); ctx.ellipse(-12 * s, -36 * s, 20 * s, 17 * s, .15, 0, 7); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 1.8 * s;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.ellipse(-12 * s, -36 * s, (7 + i * 6) * s, (6 + i * 5) * s, .15, 0, 7); ctx.stroke();
      }
      torso(S, 4.5 * s); head(S, 'pot');
      shieldShape(S, 14 * s, -48 * s, 22 * s, 44 * s, acc);
      armWeapon(S, -.25, () => line(S, 0, 0, 24 * s, -6 * s, 4 * s, S.flash ? '#fff' : tun), 5 * s);
      break;
    case 'harpooner':                              // 작살 포수: 밧줄 감긴 작살포
      legs(S); torso(S); head(S, 'wrap');
      armWeapon(S, -.12 - atk * .1, () => {
        line(S, -12 * s, 0, 40 * s, -4 * s, 4.4 * s, S.flash ? '#fff' : tun);
        tri(S, 54 * s, -5 * s, 38 * s, -12 * s, 38 * s, 2 * s, acc);
        line(S, 44 * s, -8 * s, 40 * s, -14 * s, 2 * s, acc);
        line(S, 44 * s, -2 * s, 40 * s, 4 * s, 2 * s, acc);
        ctx.strokeStyle = S.flash ? '#fff' : '#d8c8a8'; ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(-10 * s, 2 * s);
        ctx.quadraticCurveTo(6 * s, 16 * s, 24 * s, 2 * s); ctx.stroke();
      }, 7 * s);
      break;
    case 'pearlmage':                              // 진주 술사: 손 위에 떠 있는 진주
      robe(S, 18 * s, -40 * s, tun); legsHidden(S); torso(S); head(S, 'coif');
      ctx.globalAlpha = .8;
      orb(S, 16 * s, -40 * s + Math.sin(phase * 1.4) * 4 * s, 6 * s, S.flash ? '#fff' : acc);
      ctx.globalAlpha = 1;
      arm(S, 14 * s, -36 * s);
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 1.6 * s;
      ctx.globalAlpha = .5;
      ctx.beginPath(); ctx.ellipse(0, -30 * s, 24 * s, 7 * s, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    case 'corsair':                                // 해적 검사: 삼각모와 곡도
      legs(S); torso(S); head(S, 'kepi');
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22';
      ctx.fillRect(2 * s, -52 * s, 8 * s, 2.4 * s);
      armWeapon(S, -.8 + atk * 1.7, () => {
        ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(22 * s, -10 * s, 34 * s, 4 * s); ctx.stroke();
        line(S, -4 * s, 0, 4 * s, 0, 4 * s, S.flash ? '#fff' : tun);
      }, 5 * s);
      break;
    case 'fisher':                                 // 어창병: 삿갓과 작살 창
      legs(S); torso(S); head(S, 'wide');
      armWeapon(S, -.2, () => {
        line(S, -16 * s, 0, 40 * s, 0, 3 * s, S.flash ? '#fff' : '#8a6a3a');
        for (let i = -1; i <= 1; i++) line(S, 40 * s, 0, 52 * s, i * 6 * s, 2.2 * s, acc);
      }, 6 * s);
      break;
    /* ---------------------- 2.6 심연의 군세 ---------------------- */
    case 'slimelet':
    case 'slimeking': {                            // 점액: 물컹이는 덩어리와 뜬 눈
      const big = st.shape === 'slimeking';
      const w = (big ? 26 : 17) * s, h = (big ? 24 : 15) * s;
      const squish = 1 + Math.sin(phase * 2.2) * .08;
      ctx.fillStyle = S.flash ? '#fff' : col;
      ctx.globalAlpha = .9;
      ctx.beginPath();
      ctx.ellipse(0, -h * .9 / squish, w * squish, h / squish, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = S.flash ? '#fff' : acc;      // 안에 비치는 덩어리
      ctx.beginPath(); ctx.ellipse(-w * .3, -h * .8, w * .22, h * .2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22';
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.arc(i * w * .3, -h * 1.1, (big ? 3.4 : 2.4) * s, 0, 7); ctx.fill();
      }
      if (big) {                                    // 군주의 관
        ctx.fillStyle = S.flash ? '#fff' : '#e8c65a';
        ctx.beginPath();
        ctx.moveTo(-12 * s, -h * 1.9); ctx.lineTo(-8 * s, -h * 2.4); ctx.lineTo(-2 * s, -h * 2);
        ctx.lineTo(4 * s, -h * 2.4); ctx.lineTo(10 * s, -h * 2); ctx.lineTo(12 * s, -h * 1.9);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'bannerorc':                              // 오크 군기병: 방어 기치
      legs(S); torso(S, 5 * s); head(S, 'tusk');
      armWeapon(S, -1.38, () => {
        line(S, -12 * s, 0, 48 * s, 0, 3.4 * s, '#4a3520');
        ctx.fillStyle = S.flash ? '#fff' : tun;
        ctx.beginPath();
        ctx.moveTo(44 * s, 2 * s); ctx.lineTo(44 * s, 28 * s);
        ctx.lineTo(22 * s, 32 * s + Math.sin(phase * 1.5) * 3 * s); ctx.lineTo(22 * s, 2 * s);
        ctx.closePath(); ctx.fill();
        skull(S, 33 * s, 14 * s, 5 * s, S.flash ? '#fff' : acc, '#2a2230');
      }, 7 * s);
      break;
    case 'wardpriest': {                           // 결계 사제: 머리 위로 도는 결계 고리
      robe(S, 19 * s, -42 * s, tun); legsHidden(S); torso(S); head(S, 'hood');
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2.2 * s;
      for (let i = 0; i < 2; i++) {
        const r = (13 + i * 7) * s, a = phase * .8 + i;
        ctx.beginPath(); ctx.ellipse(2 * s, -66 * s, r, r * .32, Math.sin(a) * .5, 0, 7); ctx.stroke();
      }
      armWeapon(S, -.4, () => {
        line(S, 0, 8 * s, 0, -40 * s, 2.6 * s, S.flash ? '#fff' : '#2a4450');
        ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2.4 * s;
        ctx.beginPath(); ctx.arc(0, -46 * s, 7 * s, 0, 7); ctx.stroke();
      }, 7 * s);
      break;
    }
    case 'harpy': {                                // 하피: 깃 날개와 갈고리 발톱
      const flap = Math.sin(phase * 2.4);
      ctx.fillStyle = S.flash ? '#fff' : acc;
      for (let i = -1; i <= 1; i += 2) {
        ctx.save(); ctx.translate(-4 * s, -40 * s); ctx.rotate(-.4 + flap * .5 * i);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-34 * s, -18 * s); ctx.lineTo(-24 * s, -2 * s);
        ctx.lineTo(-36 * s, 6 * s); ctx.lineTo(-4 * s, 14 * s);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = S.flash ? '#fff' : col;      // 몸
      ctx.beginPath(); ctx.ellipse(0, -36 * s, 9 * s, 15 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2.6 * s;
      for (let i = -1; i <= 1; i += 2) {           // 발톱
        ctx.beginPath();
        ctx.moveTo(i * 4 * s, -24 * s); ctx.lineTo(i * 7 * s, -8 * s);
        ctx.lineTo(i * 12 * s, -2 * s); ctx.stroke();
      }
      head(S, 'feather', 8 * s);
      tri(S, 8 * s, -50 * s, 20 * s, -46 * s, 8 * s, -43 * s, S.flash ? '#fff' : '#e8c65a');
      break;
    }
    case 'stalker': {                              // 그림자 암습자: 연기처럼 흐려지는 몸
      ctx.globalAlpha = .55 + Math.sin(phase * 1.6) * .12;
      ctx.fillStyle = S.flash ? '#fff' : col;
      for (let i = 1; i <= 2; i++) {                // 잔상
        ctx.globalAlpha = .18 / i;
        ctx.beginPath();
        ctx.ellipse(-i * 12 * s, -30 * s, 10 * s, 22 * s, 0, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      legs(S); torso(S, 4 * s); head(S, 'hood');
      ctx.fillStyle = S.flash ? '#fff' : acc;      // 보랏빛 눈
      ctx.beginPath(); ctx.arc(4 * s, -50 * s, 2 * s, 0, 7); ctx.fill();
      armWeapon(S, -.6 + atk * 1.5, () => {
        line(S, 0, 0, 20 * s, -6 * s, 2.6 * s, acc);
        line(S, 0, 4 * s, 16 * s, 10 * s, 2.2 * s, acc);
      }, 5 * s);
      break;
    }
    case 'frostwitch':                             // 서리 마녀: 뾰족 모자와 얼음 지팡이
      robe(S, 19 * s, -40 * s, tun); legsHidden(S); torso(S); head(S, 'wizard');
      armWeapon(S, -.55 - atk * .35, () => {
        line(S, 0, 8 * s, 0, -42 * s, 2.8 * s, S.flash ? '#fff' : '#3f5f80');
        snowflake(S, 0, -50 * s, 9 * s, S.flash ? '#fff' : acc);
      }, 8 * s);
      ctx.globalAlpha = .6;
      for (let i = 0; i < 4; i++) {
        const a = phase * 1.2 + i * 1.6;
        snowflake(S, Math.cos(a) * 22 * s, -30 * s + Math.sin(a) * 12 * s, 3 * s, S.flash ? '#fff' : acc);
      }
      ctx.globalAlpha = 1;
      break;
    case 'sapper': {                               // 공성 폭파병: 등에 진 거대한 화약통
      legs(S); torso(S, 4 * s); head(S, 'pot');
      barrel(S, -30 * s, -44 * s, 20 * s, 28 * s, S.flash ? '#fff' : '#6b4b2a', true);
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.moveTo(-10 * s, -38 * s); ctx.lineTo(4 * s, -34 * s); ctx.stroke();
      arm(S, 14 * s, -26 * s);
      break;
    }
    case 'necroorc':                               // 부패 사령관: 뼈 지팡이와 떠도는 넋
      robe(S, 21 * s, -42 * s, tun); legsHidden(S); torso(S, 4.5 * s); head(S, 'tusk');
      armWeapon(S, -.45 - atk * .3, () => {
        line(S, 0, 10 * s, 0, -46 * s, 3.2 * s, S.flash ? '#fff' : '#d8d2c0');
        skull(S, 0, -54 * s, 7 * s, S.flash ? '#fff' : '#e8e2d0', S.flash ? '#fff' : acc);
      }, 9 * s);
      for (let i = 0; i < 3; i++) {
        wisp(S, (-22 + i * 18) * s, -62 * s, 3.4 * s, S.flash ? '#fff' : acc, phase + i * 2);
      }
      break;
    case 'obsidian': {                             // 흑요석 파수꾼: 각진 흑요석 덩어리
      ctx.fillStyle = S.flash ? '#fff' : col;
      ctx.beginPath();
      ctx.moveTo(-18 * s, 0); ctx.lineTo(-22 * s, -34 * s); ctx.lineTo(-8 * s, -52 * s);
      ctx.lineTo(12 * s, -54 * s); ctx.lineTo(22 * s, -32 * s); ctx.lineTo(16 * s, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(-10 * s, -2 * s); ctx.lineTo(-2 * s, -30 * s); ctx.lineTo(10 * s, -14 * s);
      ctx.moveTo(-2 * s, -30 * s); ctx.lineTo(8 * s, -48 * s); ctx.stroke();
      for (let i = -1; i <= 1; i += 2) {           // 솟은 결정
        tri(S, i * 12 * s, -50 * s, i * 18 * s, -74 * s, i * 22 * s, -44 * s, S.flash ? '#fff' : acc);
      }
      ctx.fillStyle = S.flash ? '#fff' : '#ffd6a0';
      ctx.beginPath(); ctx.arc(6 * s, -40 * s, 3 * s, 0, 7); ctx.fill();
      const A = sub(S, .9, 3.4 * s);
      armWeapon(A, -.9 + atk * 1.8, () => line(A, 0, 0, 30 * A.s, 6 * A.s, 7 * A.s, S.flash ? '#fff' : col), 6 * s);
      break;
    }
    case 'hydrahead':
    case 'hydra': {                                // 히드라: 굽이치는 목과 독을 뿜는 머리
      const heads = st.shape === 'hydra' ? 3 : 1;
      ctx.fillStyle = S.flash ? '#fff' : col;      // 몸통
      ctx.beginPath(); ctx.ellipse(-14 * s, -22 * s, 24 * s, 16 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : col; ctx.lineWidth = 3.4 * s;
      const sw2 = moving ? Math.sin(phase * 1.8) * 6 * s : 2 * s;
      for (let i = 0; i < 2; i++) {                // 다리
        ctx.beginPath();
        ctx.moveTo((-24 + i * 22) * s, -14 * s);
        ctx.lineTo((-26 + i * 22) * s + (i ? sw2 : -sw2), 0); ctx.stroke();
      }
      for (let h = 0; h < heads; h++) {            // 목: 부채꼴로 갈라져 나온다
        const lean = (h - (heads - 1) / 2);
        const sway = Math.sin(phase * 1.3 + h * 2) * 5 * s + atk * 10 * s;
        const hx = (10 + lean * 22) * s + sway;
        const hy = -54 * s - (28 - Math.abs(lean) * 12) * s;
        ctx.strokeStyle = S.flash ? '#fff' : col; ctx.lineWidth = (heads > 1 ? 6 : 8) * s;
        ctx.beginPath();
        ctx.moveTo(-4 * s, -30 * s);
        ctx.quadraticCurveTo((hx - 4 * s) * .5, -50 * s - Math.abs(lean) * 6 * s, hx, hy);
        ctx.stroke();
        ctx.fillStyle = S.flash ? '#fff' : col;
        ctx.beginPath(); ctx.ellipse(hx + 5 * s, hy, 12 * s, 7 * s, .15, 0, 7); ctx.fill();
        tri(S, hx + 14 * s, hy - 3 * s, hx + 26 * s, hy + 1 * s, hx + 14 * s, hy + 4 * s, S.flash ? '#fff' : col);
        ctx.fillStyle = S.flash ? '#fff' : acc;
        ctx.beginPath(); ctx.arc(hx + 9 * s, hy - 3 * s, 2.2 * s, 0, 7); ctx.fill();
        tri(S, hx + 2 * s, hy - 6 * s, hx - 6 * s, hy - 18 * s, hx + 8 * s, hy - 8 * s, S.flash ? '#fff' : acc);
      }
      break;
    }
    case 'deathknight': {                          // 파멸의 흑기사: 검은 판금과 붉은 넋
      ctx.globalAlpha = .3;                        // 발밑에 깔린 어둠
      ctx.fillStyle = S.flash ? '#fff' : acc;
      ctx.beginPath(); ctx.ellipse(0, -4 * s, 30 * s, 8 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      cape(S, -1, '#1a1118', 1.3);
      legs(S, 22 * s); torso(S, 9 * s);
      ctx.fillStyle = S.flash ? '#fff' : col;      // 어깨 판금
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.ellipse(i * 12 * s, -44 * s, 9 * s, 7 * s, 0, 0, 7); ctx.fill();
        tri(S, i * 14 * s, -50 * s, i * 20 * s, -68 * s, i * 20 * s, -44 * s, S.flash ? '#fff' : acc);
      }
      head(S, 'greathelm', 10 * s);
      ctx.fillStyle = S.flash ? '#fff' : acc;      // 투구 틈의 붉은 눈
      ctx.fillRect(0, -53 * s, 9 * s, 2.4 * s);
      armWeapon(S, -1.5 + atk * 2.6, () => {
        line(S, -8 * s, 0, 62 * s, 0, 6 * s, S.flash ? '#fff' : '#5a5f66');
        line(S, -4 * s, -6 * s, -4 * s, 6 * s, 4 * s, S.flash ? '#fff' : acc);
        ctx.globalAlpha = .6;
        line(S, 10 * s, 0, 60 * s, 0, 2 * s, S.flash ? '#fff' : acc);
        ctx.globalAlpha = 1;
      }, 10 * s);
      break;
    }
    case 'demonlord': {                            // 심연의 마왕: 뿔과 날개, 불타는 대검
      const flap = Math.sin(phase * 1.2) * .2;
      ctx.fillStyle = S.flash ? '#fff' : '#1a1016';
      for (let i = -1; i <= 1; i += 2) {           // 박쥐 날개
        ctx.save(); ctx.translate(-10 * s, -70 * s); ctx.rotate(-1.05 + flap * i);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-24 * s, -26 * s, -44 * s, -20 * s);
        ctx.lineTo(-33 * s, -8 * s); ctx.lineTo(-40 * s, 4 * s);
        ctx.lineTo(-26 * s, 1 * s); ctx.lineTo(-30 * s, 14 * s);
        ctx.lineTo(-5 * s, 8 * s);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      legs(S, 26 * s); torso(S, 10 * s);
      ctx.fillStyle = S.flash ? '#fff' : col;
      ctx.beginPath(); ctx.ellipse(0, -46 * s, 16 * s, 13 * s, 0, 0, 7); ctx.fill();
      head(S, 'devil', 11 * s);
      ctx.fillStyle = S.flash ? '#fff' : acc;      // 타오르는 눈
      for (let i = 0; i < 2; i++) {
        ctx.beginPath(); ctx.arc((2 + i * 7) * s, -52 * s, 2.4 * s, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = .5;                        // 몸을 감싸는 불길
      for (let i = 0; i < 5; i++) {
        const a = phase * 2 + i * 1.3;
        orb(S, Math.cos(a) * 26 * s, -30 * s + Math.sin(a * 1.4) * 18 * s, 3 * s, S.flash ? '#fff' : acc);
      }
      ctx.globalAlpha = 1;
      armWeapon(S, -1.6 + atk * 2.8, () => {
        line(S, -10 * s, 0, 74 * s, 0, 8 * s, S.flash ? '#fff' : '#2a1a22');
        ctx.globalAlpha = .75;
        line(S, 4 * s, 0, 72 * s, 0, 3.4 * s, S.flash ? '#fff' : acc);
        ctx.globalAlpha = 1;
        line(S, -6 * s, -9 * s, -6 * s, 9 * s, 5 * s, S.flash ? '#fff' : acc);
      }, 12 * s);
      break;
    }
    /* ---------------------- 요괴록 ---------------------- */
    case 'gumiho': {
      // 아홉 꼬리: 뒤로 부채꼴, 천천히 살랑인다
      for (let i = 0; i < 9; i++) {
        const a = -2.2 + i * 0.16 + Math.sin(phase * 0.9 + i) * 0.06;
        ctx.strokeStyle = S.flash ? '#fff' : (i % 2 ? '#fff4ea' : acc);
        ctx.lineWidth = 5 * s;
        ctx.beginPath();
        ctx.moveTo(-6 * s, -24 * s);
        ctx.quadraticCurveTo(Math.cos(a) * 22 * s - 6 * s, -24 * s + Math.sin(a) * 22 * s,
                             Math.cos(a) * 38 * s - 6 * s, -24 * s + Math.sin(a) * 34 * s);
        ctx.stroke();
      }
      robe(S, 19 * s, -42 * s, tun);
      ctx.fillStyle = S.flash ? '#fff' : '#f3e6da';          // 저고리
      ctx.fillRect(-7 * s, -42 * s, 14 * s, 12 * s);
      legsHidden(S); head(S, 'foxears', 8.5 * s);
      armWeapon(S, -0.3 + atk * 0.8, () => orb(S, 8 * s, -2 * s, 5 * s, S.flash ? '#fff' : acc), 6 * s);
      ctx.globalAlpha = 0.6;                                   // 떠도는 여우불
      for (let i = 0; i < 3; i++) {
        const a = phase * 1.3 + i * 2.1;
        orb(S, Math.cos(a) * 20 * s, -62 * s + Math.sin(a) * 6 * s, 2.6 * s, S.flash ? '#fff' : acc);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'saja':
      robe(S, 17 * s, -44 * s, tun);
      ctx.fillStyle = S.flash ? '#fff' : '#2c2c36';            // 도포 깃
      ctx.fillRect(-2 * s, -42 * s, 4 * s, 30 * s);
      legsHidden(S); torso(S, 3 * s);
      head(S, 'gat', 8.5 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#f4f1ea';            // 흰 얼굴
      ctx.beginPath(); ctx.arc(1 * s, -49 * s, 6.5 * s, 0, 7); ctx.fill();
      armWeapon(S, -0.2 + atk * 1.2, () => {                   // 명부 두루마리
        ctx.fillStyle = S.flash ? '#fff' : '#efe3c4';
        ctx.fillRect(2 * s, -10 * s, 7 * s, 20 * s);
        ctx.fillStyle = S.flash ? '#fff' : '#8e2f3a';
        ctx.fillRect(1 * s, -12 * s, 9 * s, 3 * s); ctx.fillRect(1 * s, 9 * s, 9 * s, 3 * s);
      }, 4 * s);
      break;
    case 'dokkaebi':
      legs(S, 20 * s); torso(S, 6 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#d9b36b';            // 호피 두렁이
      ctx.fillRect(-9 * s, -24 * s, 18 * s, 7 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#3a2a1a';
      for (let i = -1; i <= 1; i++) ctx.fillRect((i * 5 - 1) * s, -24 * s, 2 * s, 7 * s);
      head(S, 'horn', 10 * s);
      armWeapon(S, -1.1 + atk * 1.9, () => {                   // 도깨비방망이
        line(S, 0, 0, 22 * s, 0, 5 * s, S.flash ? '#fff' : '#7b4a2a');
        ctx.fillStyle = S.flash ? '#fff' : '#8a5a2a';
        ctx.beginPath(); ctx.ellipse(32 * s, 0, 13 * s, 8 * s, 0, 0, 7); ctx.fill();
        ctx.fillStyle = S.flash ? '#fff' : acc;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((26 + i * 6) * s, -6 * s + (i % 2) * 10 * s, 1.8 * s, 0, 7); ctx.fill(); }
      }, 8 * s);
      break;
    case 'haetae': {
      // 네 발 짐승: 몸통 + 갈기 + 뿔 하나
      const st2 = moving ? Math.sin(phase * 2) * 5 * s : 0;
      ctx.strokeStyle = col; ctx.lineWidth = 5 * s;
      for (const lx of [-16, -8, 10, 18]) {
        const off = (lx < 0 ? st2 : -st2);
        ctx.beginPath(); ctx.moveTo(lx * s, -16 * s); ctx.lineTo(lx * s + off, 0); ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -24 * s, 26 * s, 13 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : acc;                  // 비늘 무늬
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 8 * s, -30 * s, 3 * s, 0, 7); ctx.fill(); }
      ctx.fillStyle = tun;                                     // 갈기
      ctx.beginPath(); ctx.arc(22 * s, -36 * s, 13 * s, 0, 7); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(27 * s, -36 * s, 9 * s, 0, 7); ctx.fill();
      tri(S, 26 * s, -45 * s, 30 * s, -58 * s, 32 * s, -44 * s, S.flash ? '#fff' : acc);
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(31 * s, -38 * s, 1.8 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = tun; ctx.lineWidth = 4 * s;           // 꼬리
      ctx.beginPath(); ctx.moveTo(-24 * s, -28 * s);
      ctx.quadraticCurveTo(-36 * s, -40 * s + Math.sin(phase) * 3 * s, -30 * s, -48 * s); ctx.stroke();
      break;
    }
    case 'mudang':
      robe(S, 18 * s, -40 * s, S.flash ? '#fff' : '#f2e3c6');
      ctx.fillStyle = S.flash ? '#fff' : acc;                  // 붉은 쾌자
      ctx.beginPath(); ctx.moveTo(-9 * s, -40 * s); ctx.lineTo(9 * s, -40 * s);
      ctx.lineTo(12 * s, -14 * s); ctx.lineTo(-12 * s, -14 * s); ctx.closePath(); ctx.fill();
      legsHidden(S); head(S, 'jeonrip', 8 * s);
      armWeapon(S, -0.6 + atk * 1.2, () => {                   // 방울
        line(S, 0, 0, 10 * s, -8 * s, 2 * s, S.flash ? '#fff' : '#c9a227');
        ctx.fillStyle = S.flash ? '#fff' : '#e8c65a';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((10 + i * 3) * s, (-12 + i * 3) * s, 2.4 * s, 0, 7); ctx.fill(); }
      }, 5 * s);
      break;
    case 'hwarang':
      legs(S); torso(S); head(S, 'hwarang');
      armWeapon(S, -0.6 + atk * 1.7, () => {
        line(S, 0, 0, 38 * s, -4 * s, 2.6 * s, S.flash ? '#fff' : '#dfe6ee');
        line(S, -2 * s, -4 * s, -2 * s, 4 * s, 3 * s, S.flash ? '#fff' : acc);
      }, 7 * s);
      break;
    case 'pojol':
      legs(S); torso(S); head(S, 'jeonrip');
      armWeapon(S, -0.35, () => {
        line(S, 0, 0, 44 * s, -9 * s, 3 * s, S.flash ? '#fff' : '#6b4b2a');
        ctx.fillStyle = S.flash ? '#fff' : acc;                // 붉은 술
        ctx.beginPath(); ctx.arc(38 * s, -6 * s, 3 * s, 0, 7); ctx.fill();
        tri(S, 46 * s, -9 * s, 38 * s, -14 * s, 38 * s, -4 * s, S.flash ? '#fff' : '#c8ced6');
      }, 10 * s);
      break;

    /* ---------------------- 태엽 공방 ---------------------- */
    case 'inventor':
      cape(S, -1, S.flash ? '#fff' : '#3b2a1e', 1.1);
      ctx.save();                                              // 등의 톱니
      ctx.translate(-12 * s, -38 * s); ctx.rotate(phase * 0.8);
      gear(S, 0, 0, 8 * s, S.flash ? '#fff' : acc);
      ctx.restore();
      legs(S); torso(S, 4.6 * s); head(S, 'goggles', 9 * s);
      armWeapon(S, -0.5 + atk * 1.0, () => {                   // 번개 렌치
        line(S, 0, 0, 22 * s, -4 * s, 4 * s, S.flash ? '#fff' : '#9aa3ab');
        ctx.strokeStyle = S.flash ? '#fff' : '#9aa3ab'; ctx.lineWidth = 4 * s;
        ctx.beginPath(); ctx.arc(26 * s, -5 * s, 5 * s, -2.2, 2.2); ctx.stroke();
        if (atk > 0.2) orb(S, 30 * s, -5 * s, 3 * s, S.flash ? '#fff' : '#9fe6ff');
      }, 6 * s);
      break;
    case 'steammech': {
      const O = Object.assign({}, S, { lw: 7 * s });
      legs(O, 22 * s);
      ctx.fillStyle = tun;                                     // 보일러 몸통
      ctx.beginPath(); roundRectPath(ctx, -16 * s, -54 * s, 32 * s, 36 * s, 8 * s); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#b08d57';            // 리벳 띠
      ctx.fillRect(-16 * s, -40 * s, 32 * s, 4 * s);
      ctx.fillStyle = S.flash ? '#fff' : (S.raw && atk > 0 ? '#ffd27a' : acc);  // 화구
      ctx.beginPath(); ctx.arc(0, -30 * s, 5 * s, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#3a332c';            // 굴뚝
      ctx.fillRect(-12 * s, -70 * s, 7 * s, 18 * s);
      ctx.fillStyle = 'rgba(220,220,220,.5)';                 // 연기
      for (let i = 0; i < 3; i++) {
        const k = ((phase * 0.6 + i / 3) % 1);
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.beginPath(); ctx.arc(-9 * s - k * 10 * s, -72 * s - k * 22 * s, (4 + k * 7) * s, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;                                     // 조종석
      ctx.beginPath(); ctx.arc(8 * s, -58 * s, 7 * s, 0, 7); ctx.fill();
      armWeapon(O, -0.15 - atk * 0.2, () => {                  // 포신
        ctx.fillStyle = S.flash ? '#fff' : '#4a4038';
        ctx.fillRect(0, -6 * s, 36 * s, 12 * s);
        ctx.fillStyle = S.flash ? '#fff' : acc;
        ctx.fillRect(34 * s, -7 * s, 5 * s, 14 * s);
      }, 6 * s);
      break;
    }
    case 'airship': {
      const bobY = Math.sin(phase * 1.1) * 3 * s - 40 * s;     // 떠 있다
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(0, 0, 20 * s, 4 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#b8a27a';            // 기구
      ctx.beginPath(); ctx.ellipse(0, bobY - 22 * s, 30 * s, 14 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : '#6b4b2a'; ctx.lineWidth = 1.6 * s;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(0, bobY - 22 * s, 30 * s * (1 - Math.abs(i) * 0.45), 14 * s, 0, -1.57, 1.57); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-12 * s, bobY - 10 * s); ctx.lineTo(-8 * s, bobY);
      ctx.moveTo(12 * s, bobY - 10 * s); ctx.lineTo(8 * s, bobY); ctx.stroke();
      ctx.fillStyle = col;                                      // 곤돌라
      ctx.beginPath(); roundRectPath(ctx, -12 * s, bobY, 24 * s, 9 * s, 3 * s); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#2b3038';            // 조종사
      ctx.beginPath(); ctx.arc(2 * s, bobY - 3 * s, 4 * s, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(-30 * s, bobY - 22 * s); ctx.rotate(phase * 6);  // 프로펠러
      line(S, 0, -7 * s, 0, 7 * s, 2.2 * s, S.flash ? '#fff' : acc); ctx.restore();
      if (atk > 0.3) { ctx.fillStyle = S.flash ? '#fff' : '#2b2118';          // 떨어지는 폭탄
        ctx.beginPath(); ctx.arc(4 * s, bobY + 14 * s + (1 - atk) * 20 * s, 3.4 * s, 0, 7); ctx.fill(); }
      break;
    }
    case 'teslaknight':
      legs(S, 20 * s); torso(S, 6 * s); head(S, 'greathelm', 9.5 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#6b7a8a';            // 등 코일
      ctx.fillRect(-14 * s, -48 * s, 6 * s, 20 * s);
      ctx.strokeStyle = S.flash ? '#fff' : '#b08d57'; ctx.lineWidth = 1.6 * s;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-15 * s, (-46 + i * 5) * s); ctx.lineTo(-7 * s, (-44 + i * 5) * s); ctx.stroke(); }
      orb(S, -11 * s, -52 * s, 2.6 * s, S.flash ? '#fff' : acc);
      armWeapon(S, -0.45 + atk * 1.5, () => {
        line(S, 0, 0, 40 * s, -8 * s, 3.4 * s, S.flash ? '#fff' : '#9aa3ab');
        tri(S, 46 * s, -9 * s, 36 * s, -15 * s, 37 * s, -3 * s, S.flash ? '#fff' : acc);
        if (atk > 0.1 || Math.sin(phase * 5) > 0.7) {
          ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 1.5 * s;
          ctx.beginPath(); ctx.moveTo(44 * s, -9 * s); ctx.lineTo(50 * s, -15 * s); ctx.lineTo(48 * s, -6 * s); ctx.lineTo(55 * s, -10 * s); ctx.stroke();
        }
      }, 9 * s);
      break;
    case 'clocksoldier':
      legs(S); torso(S, 5 * s);
      ctx.save(); ctx.translate(-9 * s, -34 * s); ctx.rotate(phase * 1.4);   // 태엽 열쇠
      line(S, 0, 0, -8 * s, 0, 2.6 * s, S.flash ? '#fff' : acc);
      ctx.fillStyle = S.flash ? '#fff' : acc; ctx.fillRect(-12 * s, -4 * s, 4 * s, 8 * s);
      ctx.restore();
      head(S, 'kepi', 8.5 * s);
      armWeapon(S, -0.3 + atk * 1.3, () => {
        line(S, 0, 0, 30 * s, -4 * s, 3 * s, S.flash ? '#fff' : '#9aa3ab');
      }, 7 * s);
      break;
    case 'mechanic':
      legs(S); torso(S); head(S, 'goggles', 8.5 * s);
      armWeapon(S, -0.7 + atk * 1.4, () => {                   // 렌치
        line(S, 0, 0, 20 * s, -2 * s, 3.4 * s, S.flash ? '#fff' : '#9aa3ab');
        ctx.strokeStyle = S.flash ? '#fff' : '#9aa3ab'; ctx.lineWidth = 3.4 * s;
        ctx.beginPath(); ctx.arc(24 * s, -3 * s, 4.5 * s, -2.3, 2.3); ctx.stroke();
      }, 5 * s);
      ctx.fillStyle = S.flash ? '#fff' : acc;                  // 공구 가방
      ctx.fillRect(-12 * s, -26 * s, 7 * s, 8 * s);
      break;
    case 'rifleman':
      legs(S); torso(S); head(S, 'kepi');
      armWeapon(S, -0.12 - atk * 0.12, () => {
        line(S, -6 * s, 0, 34 * s, -2 * s, 4 * s, S.flash ? '#fff' : '#6b4b2a');
        line(S, 12 * s, -2 * s, 40 * s, -3 * s, 2.4 * s, S.flash ? '#fff' : '#4a4f55');
        if (atk > 0.6) tri(S, 42 * s, -3 * s, 52 * s, -8 * s, 51 * s, 2 * s, S.flash ? '#fff' : '#ffd166');
      }, 8 * s);
      break;
    case 'turret':
      ctx.fillStyle = S.flash ? '#fff' : '#4a4038';            // 받침
      ctx.beginPath(); ctx.moveTo(-18 * s, 0); ctx.lineTo(18 * s, 0); ctx.lineTo(10 * s, -16 * s); ctx.lineTo(-10 * s, -16 * s); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(0, -8 * s); ctx.rotate(phase * 0.5);
      gear(S, 0, 0, 7 * s, S.flash ? '#fff' : '#b08d57'); ctx.restore();
      ctx.fillStyle = col;                                      // 포탑 머리
      ctx.beginPath(); ctx.arc(0, -24 * s, 11 * s, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#2f2a24';
      ctx.fillRect(4 * s, -28 * s - atk * 1 * s, 24 * s - atk * 5 * s, 8 * s);
      if (atk > 0.5) orb(S, 30 * s, -24 * s, 3.4 * s, S.flash ? '#fff' : acc);
      break;
    case 'spear':
      legs(S); torso(S); head(S, 'cap');
      armWeapon(S, -0.35, () => {
        line(S, 0, 0, 46 * s, -10 * s, 3 * s, S.flash ? '#fff' : '#6b4b2a');
        tri(S, 47 * s, -10 * s, 37 * s, -16 * s, 37 * s, -3 * s, acc);
      }, 10 * s);
      break;

    case 'shield':
      legs(S); torso(S, 4.4 * s); head(S, 'pot');
      armWeapon(S, -0.1, () => line(S, 0, 0, 24 * s, -6 * s, 3 * s, '#c8ced6'), 6 * s);
      shieldShape(S, 14 * s, -50 * s, 17 * s, 44 * s, acc);
      break;

    case 'archer':
      legs(S); torso(S); head(S, 'hood');
      bow(S, 20 * s, -34 * s, 19 * s, acc);
      arm(S, 20 * s, -34 * s);
      break;

    case 'priest':
      robe(S, 18 * s, -40 * s, tun);
      ctx.fillStyle = S.flash ? '#fff' : '#b03a3a';        // 붉은 문장
      ctx.fillRect(-2 * s, -34 * s, 4 * s, 14 * s);
      ctx.fillRect(-7 * s, -29 * s, 14 * s, 4 * s);
      legsHidden(S);
      torso(S, 3.6 * s);
      head(S, 'coif', 8 * s);
      halo(S, acc);
      armWeapon(S, -0.2, () => {                       // 십자 지팡이
        line(S, 0, 0, 4 * s, -40 * s, 3 * s, S.flash ? '#fff' : '#8a6a3a');
        line(S, -4 * s, -30 * s, 12 * s, -30 * s, 3 * s, acc);
      }, 4 * s);
      break;

    case 'berserk':
      legs(S); torso(S); head(S, 'horn');
      armWeapon(S, -1.2 + atk * 1.8, () => axe(S, 1), 0);
      armWeapon(S, 1.0 - atk * 1.6, () => axe(S, -1), 0);
      break;

    case 'venom':
      legs(S); torso(S); head(S, 'hood');
      bow(S, 20 * s, -34 * s, 19 * s, acc);
      arm(S, 20 * s, -34 * s);
      ctx.fillStyle = acc;                              // 허리춤 독병
      ctx.beginPath(); ctx.arc(-11 * s, -26 * s, 5 * s, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#3f5a2f';
      ctx.fillRect(-12.5 * s, -34 * s, 3 * s, 4 * s);
      break;

    case 'bomber':
      legs(S); torso(S); head(S, 'cap');
      arm(S, 15 * s, -56 * s); arm(S, -15 * s, -56 * s);
      barrel(S, 8 * s, -62 * s, 20 * s, 22 * s, acc, true);
      break;

    case 'merchant': {
      legs(S); torso(S); head(S, 'wide');
      // 좌판
      ctx.fillStyle = S.flash ? '#fff' : '#7a5a34';
      ctx.fillRect(12 * s, -30 * s, 34 * s, 5 * s);
      ctx.strokeStyle = S.flash ? '#fff' : '#5c4326'; ctx.lineWidth = 2.6 * s;
      ctx.beginPath();
      ctx.moveTo(16 * s, -25 * s); ctx.lineTo(16 * s, 0);
      ctx.moveTo(42 * s, -25 * s); ctx.lineTo(42 * s, 0); ctx.stroke();
      barrel(S, 20 * s, -44 * s, 14 * s, 14 * s, '#8a6a3a', false);
      ctx.fillStyle = acc;                                 // 금화 더미
      [[34, -34], [40, -34], [37, -39]].forEach(c => {
        ctx.beginPath(); ctx.arc(c[0] * s, c[1] * s, 3.4 * s, 0, 7); ctx.fill();
      });
      arm(S, 14 * s, -32 * s);
      break;
    }

    case 'knight':
      cape(S, -1, '#8e2f3a');
      legs(S); torso(S, 4.6 * s); head(S, 'plume');
      armWeapon(S, -1.35 + atk * 2.1, () => {
        line(S, 0, 0, 50 * s, 0, 5 * s, acc);
        line(S, 4 * s, -8 * s, 4 * s, 8 * s, 3 * s, S.flash ? '#fff' : '#6b5a3f');
      }, 8 * s);
      break;

    case 'frost':
      robe(S, 19 * s, -46 * s, tun);
      head(S, 'wizard', 8 * s);
      armWeapon(S, -0.15, () => {
        line(S, 0, 0, 3 * s, -44 * s, 3 * s, S.flash ? '#fff' : '#6b5a3f');
        snowflake(S, 3 * s, -50 * s, 8 * s + 2 * s * atk, acc);
      }, 4 * s);
      break;

    case 'catapult': {
      ctx.strokeStyle = col; ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(-24 * s, -8 * s); ctx.lineTo(22 * s, -8 * s);
      ctx.moveTo(-16 * s, -8 * s); ctx.lineTo(-2 * s, -38 * s);
      ctx.moveTo(10 * s, -8 * s); ctx.lineTo(-2 * s, -38 * s); ctx.stroke();
      ctx.save();
      ctx.translate(-2 * s, -38 * s);
      ctx.rotate(-2.4 + atk * 2.0);
      ctx.strokeStyle = acc; ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40 * s, 0); ctx.stroke();
      ctx.fillStyle = S.flash ? '#fff' : '#7a7a72';
      ctx.beginPath(); ctx.arc(42 * s, -4 * s, 6 * s, 0, 7); ctx.fill();
      ctx.restore();
      wheels(S, [-16, 12], -8 * s, 9 * s, acc);
      const O = sub(S, 0.62, 2.6 * s);
      ctx.save(); ctx.translate(-30 * s, 0);
      legs(O); torso(O); head(O, 'cap'); arm(O, 12 * O.s, -34 * O.s);
      ctx.restore();
      break;
    }

    case 'duelist':
      cape(S, -1, '#4a3a6b');
      legs(S); torso(S); head(S, 'feather');
      armWeapon(S, -0.6 + atk * 1.5, () => {              // 레이피어
        line(S, 0, 0, 48 * s, 0, 2.4 * s, acc);
        ctx.strokeStyle = S.flash ? '#fff' : '#c9a227'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.arc(5 * s, 0, 5 * s, -1.2, 1.2); ctx.stroke();
      }, 6 * s);
      break;

    case 'sniper': {
      // 한쪽 무릎 꿇은 자세
      ctx.strokeStyle = col; ctx.lineWidth = S.lw;
      ctx.beginPath();
      ctx.moveTo(0, -20 * s); ctx.lineTo(14 * s, -10 * s); ctx.lineTo(16 * s, 0);
      ctx.moveTo(0, -20 * s); ctx.lineTo(-12 * s, 0);
      ctx.stroke();
      torso(S); head(S, 'cap');
      // 거대 석궁
      ctx.strokeStyle = S.flash ? '#fff' : '#5c4326'; ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(2 * s, -36 * s); ctx.lineTo(40 * s, -40 * s); ctx.stroke();
      ctx.strokeStyle = acc; ctx.lineWidth = 3.4 * s;
      ctx.beginPath();
      ctx.moveTo(32 * s, -54 * s); ctx.lineTo(34 * s, -26 * s); ctx.stroke();
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      ctx.moveTo(32 * s, -54 * s); ctx.lineTo(14 * s + 8 * s * atk, -38 * s);
      ctx.lineTo(34 * s, -26 * s); ctx.stroke();
      // 받침대
      ctx.strokeStyle = col; ctx.lineWidth = 2.6 * s;
      ctx.beginPath();
      ctx.moveTo(26 * s, -38 * s); ctx.lineTo(22 * s, 0);
      ctx.moveTo(26 * s, -38 * s); ctx.lineTo(32 * s, 0); ctx.stroke();
      arm(S, 16 * s, -36 * s);
      break;
    }

    case 'mage':
      robe(S, 19 * s, -46 * s, tun);
      head(S, 'wizard', 8 * s);
      armWeapon(S, -0.15, () => {
        line(S, 0, 0, 3 * s, -46 * s, 3.4 * s, S.flash ? '#fff' : '#6b5a3f');
        orb(S, 3 * s, -52 * s, 7 * s + 2 * s * atk, acc);
      }, 4 * s);
      break;

    case 'colossus': {
      const O = Object.assign({}, S, { lw: 7 * s });
      legs(O, 22 * s);
      // 갑주 몸통
      ctx.fillStyle = tun;
      ctx.beginPath();
      roundRectPath(ctx, -13 * s, -50 * s, 26 * s, 32 * s, 6 * s); ctx.fill();
      ctx.fillStyle = acc;                                   // 견갑
      ctx.beginPath(); ctx.ellipse(-15 * s, -46 * s, 9 * s, 7 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(15 * s, -46 * s, 9 * s, 7 * s, 0, 0, 7); ctx.fill();
      head(O, 'greathelm', 10 * s);
      armWeapon(O, -0.9 + atk * 1.5, () => {                 // 대형 망치
        line(O, 0, 0, 34 * s, 0, 5 * s, '#6b4b2a');
        ctx.fillStyle = acc;
        ctx.fillRect(32 * s, -11 * s, 16 * s, 22 * s);
      }, 8 * s);
      shieldShape(S, -30 * s, -52 * s, 12 * s, 46 * s, acc);
      break;
    }

    case 'necro':
      robe(S, 19 * s, -46 * s, tun);
      head(S, 'hood', 8 * s);
      armWeapon(S, -0.2, () => {
        line(S, 0, 0, 4 * s, -44 * s, 3 * s, S.flash ? '#fff' : '#4a3a2a');
        skull(S, 4 * s, -52 * s, 7 * s, '#e2ddcc', acc);
      }, 4 * s);
      wisp(S, -18 * s, -54 * s, 4 * s, acc, phase);
      wisp(S, 20 * s, -62 * s, 3 * s, acc, phase + 2);
      break;

    case 'skeleton':
      legs(S); 
      ctx.strokeStyle = col; ctx.lineWidth = S.lw;
      ctx.beginPath();
      ctx.moveTo(0, -19 * s); ctx.lineTo(0, -42 * s); ctx.stroke();
      ctx.lineWidth = 1.8 * s;                                // 갈비뼈
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-6 * s, -36 * s + i * 6 * s); ctx.lineTo(6 * s, -36 * s + i * 6 * s);
        ctx.stroke();
      }
      skull(S, 0, -50 * s, 8 * s, col, '#2b2118');
      armWeapon(S, -0.7 + atk * 1.4,
                () => line(S, 0, 0, 24 * s, -4 * s, 2.6 * s, acc), 6 * s);
      break;

    /* ---------------------- 오크 군단 ---------------------- */
    /* ---------------------- 2.5 새 잡몹 ---------------------- */
    case 'slinger':                               // 고블린 투석병: 머리 위로 돌리는 투석끈
      legs(S); torso(S); head(S, 'ears');
      {
        const a = S.wind > 0 ? S.phase * 12 : -1.4 + S.atk * 2.2;
        const hx = 10 * s, hy = -40 * s;
        arm(S, hx, hy);
        ctx.strokeStyle = S.flash ? '#fff' : '#6b4b2a'; ctx.lineWidth = 1.6 * s;
        const ex = hx + Math.cos(a) * 16 * s, ey = hy + Math.sin(a) * 16 * s;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = S.flash ? '#fff' : '#9a9a8a';
        if (S.atk < 0.3) { ctx.beginPath(); ctx.arc(ex, ey, 3.2 * s, 0, 7); ctx.fill(); }
      }
      break;
    case 'drummer':                               // 오크 북잡이: 배에 큰 북, 두 손 북채
      legs(S, 20 * s); torso(S, 6 * s); head(S, 'tusk');
      ctx.fillStyle = S.flash ? '#fff' : tun;
      ctx.beginPath(); ctx.ellipse(8 * s, -30 * s, 11 * s, 13 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.ellipse(8 * s, -30 * s, 11 * s, 13 * s, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2 * s, -38 * s); ctx.lineTo(18 * s, -22 * s); ctx.moveTo(-2 * s, -22 * s); ctx.lineTo(18 * s, -38 * s); ctx.stroke();
      {
        const beat = Math.abs(Math.sin(S.phase * 4));
        line(S, 4 * s, -40 * s, 16 * s, -48 * s + beat * 10 * s, 2.4 * s, S.flash ? '#fff' : '#d8c8a8');
        line(S, 0, -38 * s, 10 * s, -52 * s + (1 - beat) * 10 * s, 2.4 * s, S.flash ? '#fff' : '#d8c8a8');
      }
      break;
    case 'hexer':                                 // 저주 주술사: 해골 지팡이, 보라 연기
      robe(S, 17 * s, -44 * s, tun);
      head(S, 'hood', 8 * s);
      armWeapon(S, -0.15, () => {
        line(S, 0, 0, 3 * s, -40 * s, 2.6 * s, S.flash ? '#fff' : '#3a2a1a');
        skull(S, 3 * s, -45 * s, 5 * s, S.flash ? '#fff' : '#e8e0c8', acc);
      }, 4 * s);
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 3; i++) {
        const k = (S.phase * 0.5 + i / 3) % 1;
        ctx.fillStyle = S.flash ? '#fff' : acc;
        ctx.beginPath(); ctx.arc(-6 * s + Math.sin(k * 6 + i) * 6 * s, -20 * s - k * 40 * s, (2 + k * 3) * s, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    case 'skelarcher':                            // 해골 궁수: 뼈 몸통, 낡은 활
      legs(S); head(S, 'skullface', 7.5 * s);
      ctx.strokeStyle = col; ctx.lineWidth = 2 * s;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-5 * s, (-38 + i * 5) * s); ctx.lineTo(5 * s, (-38 + i * 5) * s); ctx.stroke(); }
      line(S, 0, -42 * s, 0, -19 * s, 2.4 * s, col);
      bow(S, 20 * s, -34 * s, 18 * s, S.flash ? '#fff' : acc);
      arm(S, 20 * s, -34 * s);
      break;
    case 'boneguard':                             // 해골 방패병: 녹슨 방패와 칼
      legs(S); head(S, 'skullface', 8 * s);
      ctx.strokeStyle = col; ctx.lineWidth = 2.2 * s;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6 * s, (-38 + i * 5) * s); ctx.lineTo(6 * s, (-38 + i * 5) * s); ctx.stroke(); }
      line(S, 0, -42 * s, 0, -19 * s, 2.6 * s, col);
      armWeapon(S, -0.9 + atk * 1.5, () => line(S, 0, 0, 26 * s, 0, 3 * s, S.flash ? '#fff' : '#8a8f96'), 6 * s);
      shieldShape(S, 12 * s, -48 * s, 16 * s, 34 * s, S.flash ? '#fff' : acc);
      break;
    case 'assassin':                              // 고블린 암살자: 두건, 쌍단검, 낮은 자세
      legs(S, 16 * s); torso(S, 3.4 * s); head(S, 'hood', 7.5 * s);
      ctx.fillStyle = S.flash ? '#fff' : acc;      // 붉은 눈
      ctx.fillRect(3 * s, -51 * s, 3 * s, 1.6 * s);
      armWeapon(S, -0.6 + atk * 1.6, () => {
        line(S, 0, 0, 18 * s, -3 * s, 2.4 * s, S.flash ? '#fff' : '#c8ced6');
        line(S, 0, 4 * s, 16 * s, 8 * s, 2.4 * s, S.flash ? '#fff' : '#c8ced6');
      }, 7 * s);
      break;
    case 'burrower':                              // 땅굴 고블린: 곡괭이와 헬멧 등불
      legs(S); torso(S); head(S, 'pot', 8 * s);
      orb(S, 4 * s, -60 * s, 2.4 * s, S.flash ? '#fff' : '#ffd166');
      armWeapon(S, -1.0 + atk * 1.7, () => {
        line(S, 0, 0, 24 * s, 0, 3 * s, S.flash ? '#fff' : '#6b4b2a');
        ctx.strokeStyle = S.flash ? '#fff' : '#9aa3ab'; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.arc(24 * s, 8 * s, 10 * s, -2.2, -0.6); ctx.stroke();
      }, 6 * s);
      break;
    case 'chariot': {                             // 오크 전차: 바퀴 달린 수레 + 창 든 오크
      const spin = moving ? S.phase * 3 : 0;
      ctx.fillStyle = S.flash ? '#fff' : tun;
      ctx.beginPath(); ctx.moveTo(-26 * s, -30 * s); ctx.lineTo(20 * s, -30 * s); ctx.lineTo(26 * s, -12 * s); ctx.lineTo(-26 * s, -12 * s); ctx.closePath(); ctx.fill();
      tri(S, 26 * s, -22 * s, 42 * s, -18 * s, 26 * s, -14 * s, S.flash ? '#fff' : '#c8ced6');   // 앞 충각
      ctx.save(); ctx.translate(-14 * s, -10 * s); ctx.rotate(spin); wheels(S, [0], 0, 10 * s, S.flash ? '#fff' : acc); ctx.restore();
      ctx.save(); ctx.translate(14 * s, -10 * s); ctx.rotate(spin); wheels(S, [0], 0, 10 * s, S.flash ? '#fff' : acc); ctx.restore();
      ctx.save(); ctx.translate(-4 * s, -12 * s);         // 수레 위에 선 오크
      const O = Object.assign({}, S);
      torso(O, 5 * s); head(O, 'tusk', 8 * s);
      armWeapon(O, -0.3 + atk * 0.6, () => {
        line(S, 0, 0, 40 * s, -4 * s, 3 * s, S.flash ? '#fff' : '#6b4b2a');
        tri(S, 44 * s, -4 * s, 34 * s, -10 * s, 34 * s, 2 * s, S.flash ? '#fff' : '#c8ced6');
      }, 8 * s);
      ctx.restore();
      break;
    }
    case 'goblin':
      legs(S); torso(S); head(S, 'ears');
      armWeapon(S, -0.9 + atk * 1.5, () => {
        line(S, 0, 0, 22 * s, 0, 4.5 * s, acc);
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(24 * s, 0, 6 * s, 0, 7); ctx.fill();
      }, 6 * s);
      break;

    case 'orcspear':
      legs(S); torso(S); head(S, 'tusk');
      armWeapon(S, -0.25, () => {
        line(S, 0, 0, 42 * s, -8 * s, 3.2 * s, '#6b4b2a');
        tri(S, 44 * s, -8 * s, 34 * s, -14 * s, 34 * s, -2 * s, acc);
      }, 10 * s);
      break;

    case 'ogre': {
      const O = Object.assign({}, S, { lw: 6 * s });
      legs(O, 20 * s);
      ctx.fillStyle = tun;
      ctx.beginPath(); ctx.ellipse(0, -32 * s, 12 * s, 15 * s, 0, 0, 7); ctx.fill();
      torso(O, 6 * s); head(O, 'tusk', 10 * s);
      armWeapon(O, -1.0 + atk * 1.6, () => {
        line(O, 0, 0, 34 * s, 0, 8 * s, acc);
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(36 * s, 0, 10 * s, 0, 7); ctx.fill();
      }, 8 * s);
      break;
    }

    case 'orcshield':
      legs(S, 20 * s); torso(S, 5 * s); head(S, 'tusk', 9 * s);
      armWeapon(S, -0.1, () => line(S, 0, 0, 22 * s, -6 * s, 3.4 * s, '#b0b6bd'), 6 * s);
      // 땅에 박은 대형 방패
      ctx.fillStyle = acc;
      ctx.beginPath();
      roundRectPath(ctx, 14 * s, -58 * s, 20 * s, 58 * s, 5 * s); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : '#3d2b18'; ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(24 * s, -56 * s); ctx.lineTo(24 * s, -2 * s); ctx.stroke();
      break;

    case 'wolf': {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-24 * s, -30 * s);
      ctx.quadraticCurveTo(0, -40 * s, 20 * s, -32 * s);
      ctx.quadraticCurveTo(24 * s, -18 * s, 8 * s, -16 * s);
      ctx.quadraticCurveTo(-10 * s, -13 * s, -24 * s, -18 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3.6 * s;
      const sw = moving ? Math.sin(phase * 1.7) * 8 * s : 3 * s;
      ctx.beginPath();
      ctx.moveTo(-16 * s, -18 * s); ctx.lineTo(-18 * s + sw, 0);
      ctx.moveTo(-10 * s, -18 * s); ctx.lineTo(-8 * s - sw, 0);
      ctx.moveTo(10 * s, -18 * s); ctx.lineTo(8 * s - sw, 0);
      ctx.moveTo(16 * s, -18 * s); ctx.lineTo(18 * s + sw, 0);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-22 * s, -28 * s); ctx.lineTo(-44 * s, -44 * s);
      ctx.lineTo(-38 * s, -30 * s); ctx.lineTo(-22 * s, -20 * s);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(16 * s, -40 * s);
      ctx.lineTo(30 * s, -42 * s); ctx.lineTo(44 * s, -32 * s);
      ctx.lineTo(30 * s, -26 * s); ctx.lineTo(18 * s, -28 * s);
      ctx.closePath(); ctx.fill();
      tri(S, 18 * s, -42 * s, 20 * s, -56 * s, 28 * s, -44 * s, col);
      tri(S, 28 * s, -44 * s, 33 * s, -56 * s, 36 * s, -42 * s, col);
      ctx.fillStyle = '#f5e96a';
      ctx.beginPath(); ctx.arc(29 * s, -37 * s, 2.4 * s, 0, 7); ctx.fill();
      tri(S, 36 * s, -30 * s, 40 * s, -30 * s, 37 * s, -24 * s, '#efe6cf');
      const R = sub(S, 0.78, 3 * s);
      ctx.save(); ctx.translate(-2 * s, -31 * s);
      ctx.strokeStyle = R.col; ctx.lineWidth = R.lw;
      ctx.beginPath();
      ctx.moveTo(0, -19 * R.s); ctx.lineTo(14 * R.s, -12 * R.s);
      ctx.lineTo(10 * R.s, 2 * R.s); ctx.stroke();
      torso(R); head(R, 'tusk');
      armWeapon(R, -0.7 + atk * 1.2,
                () => line(R, 0, 0, 34 * R.s, -8 * R.s, 3.2 * R.s, '#b0b6bd'), 6 * R.s);
      ctx.restore();
      break;
    }

    case 'spider': {
      ctx.strokeStyle = col; ctx.lineWidth = 2.8 * s;
      const lw2 = moving ? Math.sin(phase * 2.2) * 5 * s : 0;
      for (let i = 0; i < 4; i++) {
        const bx = (-10 + i * 7) * s;
        const dir = i % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(bx, -24 * s);
        ctx.lineTo(bx - (14 + i * 3) * s, -34 * s);
        ctx.lineTo(bx - (18 + i * 4) * s + lw2 * dir, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, -24 * s);
        ctx.lineTo(bx + (14 + i * 3) * s, -34 * s);
        ctx.lineTo(bx + (18 + i * 4) * s - lw2 * dir, 0);
        ctx.stroke();
      }
      ctx.fillStyle = col;                                    // 배
      ctx.beginPath(); ctx.ellipse(-12 * s, -26 * s, 16 * s, 13 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.ellipse(-14 * s, -30 * s, 6 * s, 4 * s, -0.4, 0, 7); ctx.fill();
      ctx.fillStyle = col;                                    // 머리
      ctx.beginPath(); ctx.ellipse(10 * s, -22 * s, 10 * s, 8 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e04b3a';
      ctx.beginPath(); ctx.arc(14 * s, -25 * s, 2.2 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(16 * s, -20 * s, 2 * s, 0, 7); ctx.fill();
      break;
    }

    case 'ballista':
      legs(S); torso(S); head(S, 'tusk');
      ctx.strokeStyle = acc; ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(6 * s, -34 * s); ctx.lineTo(30 * s, -34 * s); ctx.stroke();
      ctx.strokeStyle = S.flash ? '#fff' : '#8a8f96'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(24 * s, -46 * s); ctx.lineTo(24 * s, -22 * s); ctx.stroke();
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      ctx.moveTo(24 * s, -46 * s); ctx.lineTo(10 * s + 6 * s * atk, -34 * s);
      ctx.lineTo(24 * s, -22 * s); ctx.stroke();
      arm(S, 18 * s, -34 * s);
      break;

    case 'shaman':
      robe(S, 18 * s, -44 * s, tun);
      head(S, 'tusk', 8 * s);
      feathers(S, acc);
      armWeapon(S, -0.2, () => {
        line(S, 0, 0, 4 * s, -42 * s, 3 * s, S.flash ? '#fff' : '#5c4326');
        orb(S, 4 * s, -48 * s, 6 * s + 2 * s * atk, acc);
      }, 4 * s);
      break;

    case 'powder':
      legs(S); torso(S); head(S, 'ears');
      barrel(S, -28 * s, -54 * s, 20 * s, 26 * s, acc, true);
      arm(S, 12 * s, -30 * s);
      break;

    case 'wraith': {
      const fl = Math.sin(phase * 0.9) * 3 * s;
      ctx.save(); ctx.translate(0, fl - 4 * s);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = col;                                   // 너덜너덜한 로브
      ctx.beginPath();
      ctx.moveTo(0, -52 * s);
      ctx.quadraticCurveTo(20 * s, -26 * s, 16 * s, -2 * s);
      ctx.lineTo(9 * s, -12 * s); ctx.lineTo(3 * s, -2 * s);
      ctx.lineTo(-3 * s, -12 * s); ctx.lineTo(-9 * s, -2 * s);
      ctx.lineTo(-16 * s, -2 * s);
      ctx.quadraticCurveTo(-20 * s, -26 * s, 0, -52 * s);
      ctx.fill();
      ctx.fillStyle = '#1a1c22';                             // 어두운 얼굴
      ctx.beginPath(); ctx.arc(0, -50 * s, 9 * s, 0, 7); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(-3.5 * s, -51 * s, 2.4 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(3.5 * s, -51 * s, 2.4 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = acc; ctx.lineWidth = 2.4 * s;        // 갈퀴손
      const g = 0.5 + atk * 0.6;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(12 * s, -36 * s);
        ctx.lineTo(26 * s + i * 2 * s, -36 * s + i * 7 * s * g);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }

    case 'dark':
      cape(S, -1, acc);
      legs(S); torso(S, 4.6 * s); head(S, 'devil');
      armWeapon(S, -1.4 + atk * 2.2, () => {
        line(S, 0, 0, 52 * s, 0, 5.5 * s, S.flash ? '#fff' : '#4a4a55');
        line(S, 4 * s, -9 * s, 4 * s, 9 * s, 3 * s, acc);
      }, 8 * s);
      break;

    case 'troll': {
      const O = Object.assign({}, S, { lw: 7 * s });
      legs(O, 24 * s);
      ctx.fillStyle = tun;
      ctx.beginPath(); ctx.ellipse(0, -40 * s, 14 * s, 17 * s, 0, 0, 7); ctx.fill();
      torso(O, 7 * s); head(O, 'tusk', 12 * s);
      armWeapon(O, -1.1 + atk * 1.7, () => {
        line(O, 0, 0, 46 * s, 0, 11 * s, acc);
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(48 * s, 0, 13 * s, 0, 7); ctx.fill();
        ctx.strokeStyle = S.flash ? '#fff' : '#8a7a5a'; ctx.lineWidth = 2.5 * s;
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

    case 'frostgiant': {
      const O = Object.assign({}, S, { lw: 7 * s });
      legs(O, 24 * s);
      ctx.fillStyle = tun;
      ctx.beginPath(); ctx.ellipse(0, -42 * s, 15 * s, 18 * s, 0, 0, 7); ctx.fill();
      torso(O, 7 * s); head(O, 'icehorn', 12 * s);
      armWeapon(O, -1.0 + atk * 1.6, () => {                 // 얼음 몽둥이
        line(O, 0, 0, 40 * s, 0, 7 * s, acc);
        ctx.fillStyle = acc;                              // 얼음 덩어리
        ctx.beginPath();
        ctx.moveTo(36 * s, -15 * s); ctx.lineTo(56 * s, -12 * s);
        ctx.lineTo(64 * s, 0); ctx.lineTo(56 * s, 12 * s);
        ctx.lineTo(36 * s, 15 * s);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(120,180,210,.55)';
        ctx.beginPath();
        ctx.moveTo(40 * s, 2 * s); ctx.lineTo(56 * s, 6 * s);
        ctx.lineTo(52 * s, 12 * s); ctx.lineTo(40 * s, 13 * s);
        ctx.closePath(); ctx.fill();
      }, 10 * s);
      // 냉기
      ctx.strokeStyle = 'rgba(200,235,255,.7)'; ctx.lineWidth = 2 * s;
      for (let i = 0; i < 3; i++) {
        const a = phase * 0.6 + i * 2.1;
        ctx.beginPath();
        ctx.arc(0, -40 * s, (26 + i * 6) * s, a, a + 1.1);
        ctx.stroke();
      }
      break;
    }

    case 'lich': {
      const fl = Math.sin(phase * 0.8) * 3 * s;
      ctx.save(); ctx.translate(0, fl - 6 * s);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -50 * s);
      ctx.quadraticCurveTo(20 * s, -20 * s, 12 * s, 0);
      ctx.quadraticCurveTo(0, -8 * s, -12 * s, 0);
      ctx.quadraticCurveTo(-20 * s, -20 * s, 0, -50 * s);
      ctx.fill();
      skull(S, 0, -58 * s, 9 * s, S.flash ? '#fff' : '#efeade', acc);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-13 * s, -56 * s); ctx.lineTo(0, -78 * s); ctx.lineTo(13 * s, -56 * s);
      ctx.lineTo(9 * s, -60 * s); ctx.lineTo(-9 * s, -60 * s); ctx.closePath(); ctx.fill();
      line(S, 17 * s, -6 * s, 20 * s, -66 * s, 3 * s, S.flash ? '#fff' : '#4a3a2a');
      orb(S, 20 * s, -72 * s, 6 * s + 2 * s * atk, acc);
      ctx.restore();
      break;
    }

    case 'warlord': {
      const O = Object.assign({}, S, { lw: 7.5 * s });
      cape(O, -1, acc, 1.4);
      legs(O, 26 * s);
      ctx.fillStyle = tun;
      ctx.beginPath(); ctx.ellipse(0, -42 * s, 15 * s, 18 * s, 0, 0, 7); ctx.fill();
      torso(O, 8 * s); head(O, 'crown', 12 * s);
      armWeapon(O, -1.3 + atk * 2.0, () => {
        line(O, 0, 0, 46 * s, 0, 5 * s, '#6b4b2a');
        ctx.fillStyle = S.flash ? '#fff' : '#b0b6bd';
        ctx.beginPath();
        ctx.moveTo(36 * s, -4 * s); ctx.lineTo(56 * s, -22 * s); ctx.lineTo(58 * s, -2 * s);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(36 * s, 4 * s); ctx.lineTo(56 * s, 22 * s); ctx.lineTo(58 * s, 2 * s);
        ctx.closePath(); ctx.fill();
      }, 10 * s);
      break;
    }

    case 'herald':
      legs(S); torso(S); head(S, 'feather');
      armWeapon(S, -0.55, () => {                       // 나팔
        ctx.strokeStyle = acc; ctx.lineWidth = 3.4 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(30 * s, -6 * s); ctx.stroke();
        ctx.fillStyle = acc;
        ctx.beginPath();
        ctx.moveTo(30 * s, -6 * s); ctx.lineTo(46 * s, -18 * s);
        ctx.lineTo(46 * s, 6 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = S.flash ? '#fff' : '#8e2f3a';     // 깃발
        ctx.fillRect(28 * s, -4 * s, 12 * s, 12 * s);
      }, 8 * s);
      break;

    case 'longbow':
      legs(S); torso(S); head(S, 'hood');
      bow(S, 16 * s, -34 * s, 27 * s, acc);
      arm(S, 16 * s, -34 * s);
      break;

    case 'pyro':
      robe(S, 19 * s, -44 * s, tun);
      head(S, 'wizard', 8 * s);
      armWeapon(S, -0.3, () => {
        line(S, 0, 0, 3 * s, -40 * s, 3 * s, S.flash ? '#fff' : '#5c4326');
        const r = 8 * s + 3 * s * atk;
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(3 * s, -46 * s, r, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,120,.75)';
        ctx.beginPath(); ctx.arc(3 * s, -46 * s, r * 0.55, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(3 * s, -46 * s, r * 1.9, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }, 4 * s);
      break;

    case 'paladin':
      cape(S, -1, '#f0e6c8');
      legs(S); torso(S, 5 * s); head(S, 'winged');
      armWeapon(S, -1.2 + atk * 1.9, () => {             // 철퇴
        line(S, 0, 0, 34 * s, 0, 4.4 * s, '#8a7a5a');
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(38 * s, 0, 9 * s, 0, 7); ctx.fill();
      }, 8 * s);
      shieldShape(S, -32 * s, -50 * s, 14 * s, 42 * s, acc);
      ctx.fillStyle = S.flash ? '#fff' : '#c0392b';       // 방패 문장
      ctx.fillRect(-27 * s, -44 * s, 4 * s, 22 * s);
      ctx.fillRect(-33 * s, -36 * s, 16 * s, 4 * s);
      break;

    case 'engineer':
      legs(S); torso(S); head(S, 'cap');
      ctx.fillStyle = S.flash ? '#fff' : '#7a5a34';       // 등에 진 널빤지
      ctx.save(); ctx.translate(-14 * s, -34 * s); ctx.rotate(-0.5);
      ctx.fillRect(-4 * s, -18 * s, 8 * s, 36 * s);
      ctx.restore();
      armWeapon(S, -1.0 + atk * 1.6, () => {              // 망치
        line(S, 0, 0, 26 * s, 0, 3.4 * s, '#6b4b2a');
        ctx.fillStyle = acc;
        ctx.fillRect(24 * s, -8 * s, 12 * s, 16 * s);
      }, 6 * s);
      break;

    case 'rogue':
      legs(S); torso(S); head(S, 'hood');
      armWeapon(S, -0.4 + atk * 1.6,
                () => line(S, 0, 0, 26 * s, -3 * s, 2.6 * s, acc), 4 * s);
      armWeapon(S, 0.9 - atk * 1.5,
                () => line(S, 0, 0, 24 * s, 3 * s, 2.6 * s, acc), 0);
      break;

    case 'barricade': {
      ctx.fillStyle = col;
      ctx.fillRect(-22 * s, -52 * s, 44 * s, 52 * s);
      ctx.strokeStyle = S.flash ? '#fff' : acc;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(-22 * s, -52 * s); ctx.lineTo(22 * s, 0);
      ctx.moveTo(22 * s, -52 * s); ctx.lineTo(-22 * s, 0);
      ctx.moveTo(-22 * s, -34 * s); ctx.lineTo(22 * s, -34 * s);
      ctx.stroke();
      ctx.fillStyle = acc;                                 // 위쪽 말뚝
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-20 * s + i * 15 * s, -52 * s);
        ctx.lineTo(-13 * s + i * 15 * s, -66 * s);
        ctx.lineTo(-6 * s + i * 15 * s, -52 * s);
        ctx.closePath(); ctx.fill();
      }
      break;
    }

    case 'orcberserk':
      legs(S); torso(S, 4.4 * s); head(S, 'tusk');
      ctx.fillStyle = S.flash ? '#fff' : acc;              // 전투 문신
      ctx.fillRect(-9 * s, -46 * s, 18 * s, 2.4 * s);
      armWeapon(S, -1.3 + atk * 2.0, () => axe(S, 1), 0);
      armWeapon(S, 1.1 - atk * 1.8, () => axe(S, -1), 0);
      break;

    case 'bat': {
      const fl = Math.sin(phase * 2.2) * 5 * s;
      ctx.save(); ctx.translate(0, -18 * s + fl);
      const flap = Math.sin(phase * 6) * 0.5;
      ctx.fillStyle = col;
      for (let i = -1; i <= 1; i += 2) {                   // 날개
        ctx.save(); ctx.scale(i, 1); ctx.rotate(flap * i);
        ctx.beginPath();
        ctx.moveTo(4 * s, -6 * s);
        ctx.lineTo(26 * s, -18 * s); ctx.lineTo(22 * s, -4 * s);
        ctx.lineTo(28 * s, 2 * s); ctx.lineTo(6 * s, 4 * s);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.beginPath(); ctx.ellipse(0, -2 * s, 9 * s, 11 * s, 0, 0, 7); ctx.fill();
      tri(S, -7 * s, -10 * s, -3 * s, -22 * s, 1 * s, -10 * s, col);
      tri(S, 7 * s, -10 * s, 3 * s, -22 * s, -1 * s, -10 * s, col);
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(3 * s, -4 * s, 2.2 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#efe6cf';
      tri(S, 2 * s, 4 * s, 6 * s, 4 * s, 4 * s, 10 * s, '#efe6cf');
      ctx.restore();
      break;
    }

    case 'golem': {
      const O = Object.assign({}, S, { lw: 8 * s });
      legs(O, 20 * s);
      ctx.fillStyle = col;                                  // 돌덩이 몸통
      ctx.beginPath();
      roundRectPath(ctx, -18 * s, -54 * s, 36 * s, 36 * s, 5 * s); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath();
      roundRectPath(ctx, -24 * s, -52 * s, 12 * s, 14 * s, 3 * s); ctx.fill();
      ctx.beginPath();
      roundRectPath(ctx, 12 * s, -52 * s, 12 * s, 14 * s, 3 * s); ctx.fill();
      ctx.fillStyle = col;                                  // 머리
      ctx.beginPath();
      roundRectPath(ctx, -12 * s, -74 * s, 24 * s, 20 * s, 4 * s); ctx.fill();
      ctx.fillStyle = '#ff8a3c';
      ctx.beginPath(); ctx.arc(-4 * s, -64 * s, 2.6 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(5 * s, -64 * s, 2.6 * s, 0, 7); ctx.fill();
      armWeapon(O, -0.8 + atk * 1.4, () => {                // 돌주먹
        line(O, 0, 0, 26 * s, 0, 7 * s, col);
        ctx.fillStyle = col;
        ctx.beginPath();
        roundRectPath(ctx, 24 * s, -11 * s, 20 * s, 22 * s, 4 * s); ctx.fill();
      }, 8 * s);
      break;
    }

    case 'totem': {
      ctx.fillStyle = col;
      ctx.fillRect(-13 * s, -64 * s, 26 * s, 64 * s);
      ctx.strokeStyle = S.flash ? '#fff' : '#3a2818';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(-13 * s, -44 * s); ctx.lineTo(13 * s, -44 * s);
      ctx.moveTo(-13 * s, -24 * s); ctx.lineTo(13 * s, -24 * s);
      ctx.stroke();
      ctx.fillStyle = acc;                                   // 새겨진 얼굴
      [[-56], [-36], [-16]].forEach(v => {
        ctx.beginPath(); ctx.arc(-5 * s, v[0] * s, 2.6 * s, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(5 * s, v[0] * s, 2.6 * s, 0, 7); ctx.fill();
      });
      ctx.fillStyle = acc;                                   // 뿔
      tri(S, -13 * s, -64 * s, -24 * s, -78 * s, -6 * s, -70 * s, acc);
      tri(S, 13 * s, -64 * s, 24 * s, -78 * s, 6 * s, -70 * s, acc);
      ctx.strokeStyle = 'rgba(201,138,224,.6)';              // 저주 기운
      ctx.lineWidth = 2 * s;
      for (let i = 0; i < 3; i++) {
        const a = phase * 0.7 + i * 2.1;
        ctx.beginPath();
        ctx.arc(0, -32 * s, (24 + i * 7) * s, a, a + 1.2);
        ctx.stroke();
      }
      break;
    }

    case 'drake': {
      const fl = Math.sin(phase * 1.1) * 4 * s;
      ctx.save(); ctx.translate(0, fl);
      // 날개
      ctx.fillStyle = tun;
      const flap = Math.sin(phase * 2.2) * 0.35;
      ctx.save(); ctx.translate(-6 * s, -46 * s); ctx.rotate(-0.5 + flap);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-30 * s, -34 * s); ctx.lineTo(-16 * s, -8 * s);
      ctx.lineTo(-34 * s, -6 * s); ctx.lineTo(-8 * s, 10 * s);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      // 다리
      ctx.strokeStyle = col; ctx.lineWidth = 6 * s;
      const sw = moving ? Math.sin(phase * 1.4) * 7 * s : 3 * s;
      ctx.beginPath();
      ctx.moveTo(-8 * s, -26 * s); ctx.lineTo(-12 * s + sw, 0);
      ctx.moveTo(10 * s, -26 * s); ctx.lineTo(14 * s - sw, 0);
      ctx.stroke();
      // 몸통
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -36 * s, 24 * s, 17 * s, 0, 0, 7); ctx.fill();
      // 꼬리
      ctx.beginPath();
      ctx.moveTo(-20 * s, -36 * s);
      ctx.quadraticCurveTo(-52 * s, -30 * s, -60 * s, -54 * s);
      ctx.lineTo(-52 * s, -50 * s);
      ctx.quadraticCurveTo(-46 * s, -34 * s, -18 * s, -44 * s);
      ctx.closePath(); ctx.fill();
      // 목과 머리
      ctx.strokeStyle = col; ctx.lineWidth = 11 * s;
      ctx.beginPath();
      ctx.moveTo(12 * s, -42 * s);
      ctx.quadraticCurveTo(30 * s, -66 * s, 34 * s, -74 * s);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(26 * s, -84 * s); ctx.lineTo(52 * s, -74 * s);
      ctx.lineTo(26 * s, -64 * s);
      ctx.closePath(); ctx.fill();
      tri(S, 28 * s, -84 * s, 22 * s, -98 * s, 34 * s, -86 * s, col);
      ctx.fillStyle = '#ffe14a';
      ctx.beginPath(); ctx.arc(33 * s, -78 * s, 2.8 * s, 0, 7); ctx.fill();
      // 등지느러미
      ctx.fillStyle = acc;
      for (let i = 0; i < 4; i++) {
        tri(S, (-14 + i * 10) * s, -50 * s, (-9 + i * 10) * s, -64 * s,
            (-4 + i * 10) * s, -50 * s, acc);
      }
      // 불꽃
      if (atk > 0.1) {
        ctx.fillStyle = 'rgba(255,150,50,' + (0.5 + atk * 0.4) + ')';
        ctx.beginPath();
        ctx.moveTo(50 * s, -78 * s);
        ctx.lineTo(50 * s + 60 * s * atk, -74 * s);
        ctx.lineTo(50 * s + 56 * s * atk, -62 * s);
        ctx.lineTo(50 * s, -70 * s);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      break;
    }

    /* ---------------------- 시즌: 올림포스 ---------------------- */
    case 'zeus':
      robe(S, 22 * s, -46 * s, tun);
      ctx.fillStyle = S.flash ? '#fff' : '#d8d2c0';        // 토가 주름
      ctx.beginPath();
      ctx.moveTo(-10 * s, -40 * s); ctx.lineTo(14 * s, -14 * s); ctx.lineTo(-2 * s, -10 * s);
      ctx.closePath(); ctx.fill();
      head(S, 'laurel', 9 * s);
      beard(S, '#efeade');
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(4 * s, -52 * s, 1.9 * s, 0, 7); ctx.fill();
      armWeapon(S, -0.9 + atk * 1.4, () => bolt(S, acc), 8 * s);
      ctx.strokeStyle = 'rgba(255,225,74,.5)';             // 방전
      ctx.lineWidth = 2 * s;
      for (let i = 0; i < 3; i++) {
        const a = phase * 1.4 + i * 2.1;
        ctx.beginPath();
        ctx.arc(0, -42 * s, (26 + i * 8) * s, a, a + 0.9);
        ctx.stroke();
      }
      break;

    case 'ares':
      cape(S, -1, '#8e2f3a');
      legs(S); torso(S, 5 * s); head(S, 'corinth');
      armWeapon(S, -0.4 + atk * 1.5, () => {
        line(S, 0, 0, 48 * s, -8 * s, 3.4 * s, S.flash ? '#fff' : '#6b4b2a');
        tri(S, 50 * s, -9 * s, 38 * s, -16 * s, 38 * s, -1 * s, '#c8ced6');
      }, 8 * s);
      round_shield(S, -28 * s, -40 * s, 15 * s, acc);
      break;

    case 'artemis':
      ctx.fillStyle = S.flash ? '#fff' : '#6b4b2a';         // 등에 멘 화살통
      ctx.save(); ctx.translate(-15 * s, -38 * s); ctx.rotate(-0.45);
      ctx.fillRect(-3.5 * s, -14 * s, 7 * s, 26 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#e8dcc0';
      for (let i = -1; i <= 1; i++) ctx.fillRect(i * 2.6 * s - 1 * s, -20 * s, 1.6 * s, 8 * s);
      ctx.restore();
      legs(S); torso(S); head(S, 'moon');
      bow(S, 22 * s, -34 * s, 24 * s, acc);
      arm(S, 22 * s, -34 * s);
      break;

    case 'medusa': {
      // 똬리 튼 뱀 하반신
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-8 * s, -30 * s);
      ctx.bezierCurveTo(22 * s, -26 * s, 26 * s, -6 * s, 4 * s, -4 * s);
      ctx.bezierCurveTo(-18 * s, -2 * s, -34 * s, -8 * s, -40 * s, -18 * s);
      ctx.lineTo(-34 * s, -20 * s);
      ctx.bezierCurveTo(-26 * s, -12 * s, -12 * s, -10 * s, 2 * s, -12 * s);
      ctx.bezierCurveTo(14 * s, -14 * s, 12 * s, -24 * s, 0, -26 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : acc;              // 비늘
      ctx.lineWidth = 1.6 * s;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(-6 * s + i * 8 * s, -18 * s, 5 * s, 0.3, 2.6);
        ctx.stroke();
      }
      torso(S, 4.2 * s);
      ctx.fillStyle = col;                                   // 머리
      ctx.beginPath(); ctx.arc(0, -50 * s, 8.5 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = acc; ctx.lineWidth = 2.6 * s;        // 뱀 머리카락
      for (let i = 0; i < 6; i++) {
        const a = -2.7 + i * 0.55;
        const wob = Math.sin(phase * 1.8 + i) * 3.5 * s;
        const ex = Math.cos(a) * 21 * s + wob;
        const ey = -56 * s + Math.sin(a) * 13 * s;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 7 * s, -50 * s + Math.sin(a) * 7 * s);
        ctx.quadraticCurveTo(Math.cos(a) * 15 * s, -62 * s + Math.sin(a) * 12 * s, ex, ey);
        ctx.stroke();
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(ex, ey, 2.4 * s, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#ffe14a';
      ctx.beginPath(); ctx.arc(4 * s, -51 * s, 2.6 * s, 0, 7); ctx.fill();
      if (atk > 0.1) {
        ctx.strokeStyle = 'rgba(157,224,142,' + (0.35 + atk * 0.5) + ')';
        ctx.lineWidth = 3.4 * s;
        ctx.beginPath();
        ctx.moveTo(9 * s, -51 * s); ctx.lineTo(9 * s + 52 * s * atk, -51 * s); ctx.stroke();
      }
      break;
    }

    case 'spartan':
      legs(S); torso(S, 5 * s); head(S, 'corinth');
      armWeapon(S, -0.3, () => {
        line(S, 0, 0, 44 * s, -8 * s, 3.2 * s, S.flash ? '#fff' : '#6b4b2a');
        tri(S, 46 * s, -8 * s, 36 * s, -14 * s, 36 * s, -2 * s, '#c8ced6');
      }, 9 * s);
      round_shield(S, 16 * s, -42 * s, 18 * s, acc);
      ctx.strokeStyle = S.flash ? '#fff' : '#2b3038';        // 람다 문양
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(10 * s, -32 * s); ctx.lineTo(16 * s, -50 * s); ctx.lineTo(23 * s, -32 * s);
      ctx.stroke();
      break;

    /* ---------------------- 시즌: 라그나로크 ---------------------- */
    case 'thor':
      cape(S, -1, tun, 1.3);
      legs(S, 22 * s); torso(S, 6 * s); head(S, 'wingedhelm', 10 * s);
      beard(S, '#e8b25a');
      armWeapon(S, -1.35 + atk * 2.1, () => {               // 묠니르
        line(S, 0, 0, 30 * s, 0, 5 * s, '#6b4b2a');
        ctx.fillStyle = acc;
        ctx.beginPath();
        roundRectPath(ctx, 28 * s, -14 * s, 24 * s, 28 * s, 4 * s); ctx.fill();
        ctx.fillStyle = 'rgba(127,216,255,.85)';
        ctx.fillRect(34 * s, -8 * s, 12 * s, 4 * s);
      }, 9 * s);
      ctx.strokeStyle = 'rgba(127,216,255,.65)';
      ctx.lineWidth = 2.4 * s;
      for (let i = 0; i < 3; i++) {
        const a = -phase * 1.5 + i * 2.1;
        ctx.beginPath();
        ctx.arc(0, -44 * s, (28 + i * 9) * s, a, a + 0.8);
        ctx.stroke();
      }
      break;

    case 'valkyrie':
      wings(S, acc, phase);
      legs(S); torso(S, 4.6 * s); head(S, 'wingedhelm');
      armWeapon(S, -0.5 + atk * 1.6, () => {
        line(S, 0, 0, 46 * s, -6 * s, 3.2 * s, S.flash ? '#fff' : '#8a7a5a');
        tri(S, 48 * s, -7 * s, 36 * s, -14 * s, 36 * s, 0, '#dfe6ee');
      }, 8 * s);
      break;

    case 'fenrir': {
      ctx.fillStyle = col;                                   // 거대 늑대
      ctx.beginPath();
      ctx.moveTo(-28 * s, -34 * s);
      ctx.quadraticCurveTo(0, -46 * s, 24 * s, -36 * s);
      ctx.quadraticCurveTo(28 * s, -18 * s, 8 * s, -16 * s);
      ctx.quadraticCurveTo(-12 * s, -12 * s, -28 * s, -20 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 4.4 * s;
      const sw = moving ? Math.sin(phase * 1.8) * 9 * s : 3 * s;
      ctx.beginPath();
      ctx.moveTo(-18 * s, -20 * s); ctx.lineTo(-20 * s + sw, 0);
      ctx.moveTo(-10 * s, -20 * s); ctx.lineTo(-8 * s - sw, 0);
      ctx.moveTo(12 * s, -20 * s); ctx.lineTo(10 * s - sw, 0);
      ctx.moveTo(20 * s, -20 * s); ctx.lineTo(22 * s + sw, 0);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-26 * s, -32 * s); ctx.lineTo(-52 * s, -52 * s);
      ctx.lineTo(-44 * s, -32 * s); ctx.lineTo(-26 * s, -22 * s);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();                                       // 머리
      ctx.moveTo(18 * s, -46 * s);
      ctx.lineTo(34 * s, -48 * s); ctx.lineTo(52 * s, -34 * s);
      ctx.lineTo(32 * s, -26 * s); ctx.lineTo(18 * s, -30 * s);
      ctx.closePath(); ctx.fill();
      tri(S, 20 * s, -48 * s, 22 * s, -64 * s, 32 * s, -50 * s, col);
      tri(S, 32 * s, -50 * s, 39 * s, -64 * s, 42 * s, -47 * s, col);
      ctx.fillStyle = acc;                                   // 빛나는 눈
      ctx.beginPath(); ctx.arc(32 * s, -40 * s, 3.2 * s, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(32 * s, -40 * s, 7 * s, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#efe6cf';                             // 송곳니
      tri(S, 42 * s, -30 * s, 47 * s, -30 * s, 44 * s, -22 * s, '#efe6cf');
      break;
    }

    case 'viking':
      legs(S); torso(S, 4.4 * s); head(S, 'horn');
      beard(S, '#c98a3a');
      armWeapon(S, -1.2 + atk * 1.9, () => axe(S, 1), 0);
      round_shield(S, -30 * s, -42 * s, 14 * s, '#8a5a2a');
      break;

    case 'runeseer':
      robe(S, 19 * s, -44 * s, tun);
      head(S, 'hood', 8 * s);
      armWeapon(S, -0.2, () => {
        line(S, 0, 0, 4 * s, -42 * s, 3 * s, S.flash ? '#fff' : '#5c4326');
        ctx.strokeStyle = acc; ctx.lineWidth = 2.4 * s;      // 룬 문양
        ctx.beginPath();
        ctx.moveTo(-6 * s, -50 * s); ctx.lineTo(14 * s, -50 * s);
        ctx.moveTo(4 * s, -58 * s); ctx.lineTo(4 * s, -42 * s);
        ctx.moveTo(-4 * s, -58 * s); ctx.lineTo(12 * s, -42 * s);
        ctx.stroke();
      }, 4 * s);
      ctx.fillStyle = acc;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) {
        const a = phase * 0.9 + i * 2.1;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 22 * s, -40 * s + Math.sin(a) * 10 * s, 3 * s, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;

    /* ---------------------- 시즌: 나일 ---------------------- */
    case 'anubis':
      legs(S, 20 * s); torso(S, 5.4 * s);
      ctx.fillStyle = tun;                                   // 킬트
      ctx.beginPath();
      ctx.moveTo(-12 * s, -26 * s); ctx.lineTo(12 * s, -26 * s);
      ctx.lineTo(9 * s, -6 * s); ctx.lineTo(-9 * s, -6 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = acc;                                   // 목장식
      ctx.beginPath(); ctx.ellipse(0, -40 * s, 13 * s, 6 * s, 0, 0, 7); ctx.fill();
      jackalHead(S, col, acc);
      armWeapon(S, -0.9 + atk * 1.5, () => {                 // 코페시
        ctx.strokeStyle = acc; ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(24 * s, -4 * s);
        ctx.quadraticCurveTo(46 * s, -10 * s, 40 * s, -26 * s);
        ctx.stroke();
      }, 8 * s);
      break;

    case 'mummy':
      legs(S); torso(S, 5 * s); 
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, -50 * s, 8.5 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : acc;              // 붕대
      ctx.lineWidth = 1.6 * s;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-9 * s, (-44 + i * 7) * s); ctx.lineTo(9 * s, (-46 + i * 7) * s);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-8 * s, -52 * s); ctx.lineTo(8 * s, -49 * s); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = S.lw;           // 앞으로 뻗은 팔
      ctx.beginPath();
      ctx.moveTo(0, -38 * s); ctx.lineTo(22 * s, -36 * s);
      ctx.moveTo(0, -36 * s); ctx.lineTo(21 * s, -30 * s);
      ctx.stroke();
      break;

    case 'rapriest':
      robe(S, 18 * s, -42 * s, tun);
      head(S, 'nemes', 8 * s);
      armWeapon(S, -0.35, () => {
        line(S, 0, 0, 3 * s, -38 * s, 3 * s, S.flash ? '#fff' : '#8a6a3a');
        const r = 9 * s + 3 * s * atk;
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(3 * s, -46 * s, r, 0, 7); ctx.fill();
        ctx.strokeStyle = acc; ctx.lineWidth = 2 * s;        // 태양 광선
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + phase * 0.5;
          ctx.beginPath();
          ctx.moveTo(3 * s + Math.cos(a) * (r + 2 * s), -46 * s + Math.sin(a) * (r + 2 * s));
          ctx.lineTo(3 * s + Math.cos(a) * (r + 8 * s), -46 * s + Math.sin(a) * (r + 8 * s));
          ctx.stroke();
        }
      }, 4 * s);
      break;

    case 'scarab': {
      ctx.strokeStyle = acc; ctx.lineWidth = 2.6 * s;     // 다리
      const lw3 = moving ? Math.sin(phase * 2.4) * 4 * s : 0;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 8 * s, -14 * s);
        ctx.lineTo(i * 8 * s - 12 * s + lw3, 0);
        ctx.moveTo(i * 8 * s, -14 * s);
        ctx.lineTo(i * 8 * s + 12 * s - lw3, 0);
        ctx.stroke();
      }
      ctx.fillStyle = col;                                    // 껍질
      ctx.beginPath(); ctx.ellipse(0, -20 * s, 20 * s, 15 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = acc; ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(0, -34 * s); ctx.lineTo(0, -6 * s); ctx.stroke();
      ctx.fillStyle = acc;                                    // 머리
      ctx.beginPath(); ctx.ellipse(18 * s, -18 * s, 8 * s, 7 * s, 0, 0, 7); ctx.fill();
      tri(S, 22 * s, -24 * s, 30 * s, -30 * s, 24 * s, -18 * s, acc);
      ctx.fillStyle = '#fff2c0';
      ctx.beginPath(); ctx.arc(20 * s, -20 * s, 2 * s, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.3;                                  // 금빛
      ctx.fillStyle = '#ffe14a';
      ctx.beginPath(); ctx.ellipse(0, -20 * s, 26 * s, 20 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }

    case 'desertarcher':
      legs(S); torso(S); head(S, 'wrap');
      bow(S, 20 * s, -34 * s, 18 * s, acc);
      arm(S, 20 * s, -34 * s);
      break;

    case 'hoplite':
      legs(S); torso(S); head(S, 'corinth');
      armWeapon(S, -0.3, () => {
        line(S, 0, 0, 40 * s, -8 * s, 3 * s, S.flash ? '#fff' : '#6b4b2a');
        tri(S, 42 * s, -8 * s, 33 * s, -13 * s, 33 * s, -2 * s, acc);
      }, 8 * s);
      round_shield(S, 15 * s, -40 * s, 15 * s, tun);
      break;

    case 'northarcher':
      legs(S); torso(S); head(S, 'furhood');
      bow(S, 20 * s, -34 * s, 19 * s, acc);
      arm(S, 20 * s, -34 * s);
      break;

    case 'pharaoh':
      legs(S, 20 * s); torso(S, 5 * s); head(S, 'nemes', 9 * s);
      ctx.fillStyle = tun;                                   // 킬트
      ctx.beginPath();
      ctx.moveTo(-11 * s, -26 * s); ctx.lineTo(11 * s, -26 * s);
      ctx.lineTo(8 * s, -6 * s); ctx.lineTo(-8 * s, -6 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.ellipse(0, -40 * s, 12 * s, 5 * s, 0, 0, 7); ctx.fill();
      armWeapon(S, -0.25, () => {
        line(S, 0, 0, 42 * s, -8 * s, 3.2 * s, S.flash ? '#fff' : '#8a6a3a');
        tri(S, 44 * s, -8 * s, 34 * s, -14 * s, 34 * s, -2 * s, acc);
      }, 9 * s);
      shieldShape(S, -30 * s, -48 * s, 13 * s, 40 * s, acc);
      break;

    case 'orccatapult': {
      ctx.strokeStyle = col; ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(-22 * s, -8 * s); ctx.lineTo(24 * s, -8 * s);
      ctx.moveTo(-14 * s, -8 * s); ctx.lineTo(2 * s, -40 * s);
      ctx.moveTo(12 * s, -8 * s); ctx.lineTo(2 * s, -40 * s); ctx.stroke();
      ctx.save();
      ctx.translate(2 * s, -40 * s);
      ctx.rotate(2.4 - atk * 2.0);
      ctx.strokeStyle = acc; ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40 * s, 0); ctx.stroke();
      ctx.fillStyle = S.flash ? '#fff' : '#6b6b62';
      ctx.beginPath(); ctx.arc(-42 * s, -4 * s, 7 * s, 0, 7); ctx.fill();
      ctx.restore();
      wheels(S, [-14, 14], -8 * s, 9 * s, acc);
      const O = sub(S, 0.6, 2.6 * s);
      ctx.save(); ctx.translate(30 * s, 0);
      legs(O); torso(O); head(O, 'tusk'); arm(O, -12 * O.s, -34 * O.s);
      ctx.restore();
      break;
    }

    case 'warchief':
      cape(S, -1, '#8e2f3a', 1.2);
      legs(S, 20 * s); torso(S, 5.4 * s); head(S, 'crown', 10 * s);
      armWeapon(S, -1.2 + atk * 1.9, () => axe(S, 1), 8 * s);
      // 등에 꽂은 군기
      ctx.strokeStyle = S.flash ? '#fff' : '#5c4326'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(-16 * s, -10 * s); ctx.lineTo(-22 * s, -78 * s); ctx.stroke();
      ctx.fillStyle = acc;
      ctx.beginPath();
      ctx.moveTo(-22 * s, -78 * s); ctx.lineTo(-48 * s, -70 * s);
      ctx.lineTo(-22 * s, -56 * s); ctx.closePath(); ctx.fill();
      break;

    case 'plaguer':
      robe(S, 19 * s, -44 * s, tun);
      head(S, 'hood', 8 * s);
      armWeapon(S, -0.3, () => {
        line(S, 0, 0, 4 * s, -40 * s, 3 * s, S.flash ? '#fff' : '#4a3a2a');
        const r = 9 * s + 3 * s * atk;
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(4 * s, -46 * s, r, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(4 * s, -46 * s, r * 2, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }, 4 * s);
      // 흘러나오는 역병 기운
      ctx.fillStyle = acc;
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 4; i++) {
        const a = phase * 0.8 + i * 1.6;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 20 * s, -20 * s + Math.sin(a) * 8 * s, 3.4 * s, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;

    case 'hellhound': {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-22 * s, -30 * s);
      ctx.quadraticCurveTo(0, -40 * s, 20 * s, -32 * s);
      ctx.quadraticCurveTo(24 * s, -18 * s, 6 * s, -16 * s);
      ctx.quadraticCurveTo(-10 * s, -13 * s, -22 * s, -19 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3.4 * s;
      const sw = moving ? Math.sin(phase * 2) * 8 * s : 3 * s;
      ctx.beginPath();
      ctx.moveTo(-15 * s, -18 * s); ctx.lineTo(-17 * s + sw, 0);
      ctx.moveTo(-9 * s, -18 * s); ctx.lineTo(-7 * s - sw, 0);
      ctx.moveTo(9 * s, -18 * s); ctx.lineTo(7 * s - sw, 0);
      ctx.moveTo(15 * s, -18 * s); ctx.lineTo(17 * s + sw, 0);
      ctx.stroke();
      // 불타는 갈기와 꼬리
      ctx.fillStyle = acc;
      for (let i = 0; i < 5; i++) {
        const fx2 = -18 * s + i * 8 * s;
        const h = (10 + Math.sin(phase * 3 + i) * 5) * s;
        ctx.beginPath();
        ctx.moveTo(fx2, -32 * s);
        ctx.lineTo(fx2 + 4 * s, -32 * s - h);
        ctx.lineTo(fx2 + 8 * s, -32 * s);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(-22 * s, -28 * s); ctx.lineTo(-40 * s, -44 * s);
      ctx.lineTo(-34 * s, -26 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(16 * s, -40 * s); ctx.lineTo(30 * s, -42 * s);
      ctx.lineTo(44 * s, -32 * s); ctx.lineTo(28 * s, -26 * s);
      ctx.lineTo(16 * s, -28 * s); ctx.closePath(); ctx.fill();
      tri(S, 18 * s, -42 * s, 20 * s, -54 * s, 28 * s, -44 * s, col);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(28 * s, -36 * s, 2.8 * s, 0, 7); ctx.fill();
      ctx.fillStyle = acc;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(28 * s, -36 * s, 6 * s, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }

    case 'siegeram': {
      // 지붕
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-30 * s, -44 * s); ctx.lineTo(30 * s, -44 * s);
      ctx.lineTo(24 * s, -58 * s); ctx.lineTo(-24 * s, -58 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : '#3d2b18'; ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(-26 * s, -44 * s); ctx.lineTo(-20 * s, -14 * s);
      ctx.moveTo(26 * s, -44 * s); ctx.lineTo(20 * s, -14 * s);
      ctx.stroke();
      // 통나무 파성추
      const ram = atk * 14 * s;
      ctx.strokeStyle = S.flash ? '#fff' : '#5c4326'; ctx.lineWidth = 11 * s;
      ctx.beginPath();
      ctx.moveTo(-18 * s + ram, -30 * s); ctx.lineTo(34 * s + ram, -30 * s); ctx.stroke();
      ctx.fillStyle = acc;                                  // 철제 머리
      ctx.beginPath();
      ctx.moveTo(32 * s + ram, -40 * s); ctx.lineTo(50 * s + ram, -30 * s);
      ctx.lineTo(32 * s + ram, -20 * s); ctx.closePath(); ctx.fill();
      // 매단 쇠사슬
      ctx.strokeStyle = S.flash ? '#fff' : '#8a8880'; ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(-8 * s, -44 * s); ctx.lineTo(-8 * s + ram, -34 * s);
      ctx.moveTo(16 * s, -44 * s); ctx.lineTo(16 * s + ram, -34 * s);
      ctx.stroke();
      wheels(S, [-20, 18], -8 * s, 10 * s, acc);
      break;
    }

    case 'spiderqueen': {
      ctx.strokeStyle = col; ctx.lineWidth = 4 * s;
      const lw4 = moving ? Math.sin(phase * 2) * 6 * s : 0;
      for (let i = 0; i < 4; i++) {
        const bx = (-8 + i * 6) * s;
        const dir = i % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(bx, -34 * s);
        ctx.lineTo(bx - (18 + i * 5) * s, -50 * s);
        ctx.lineTo(bx - (24 + i * 6) * s + lw4 * dir, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, -34 * s);
        ctx.lineTo(bx + (18 + i * 5) * s, -50 * s);
        ctx.lineTo(bx + (24 + i * 6) * s - lw4 * dir, 0);
        ctx.stroke();
      }
      ctx.fillStyle = col;                                   // 배
      ctx.beginPath(); ctx.ellipse(-18 * s, -34 * s, 24 * s, 20 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.ellipse(-22 * s, -40 * s, 9 * s, 6 * s, -0.4, 0, 7); ctx.fill();
      ctx.fillStyle = col;                                   // 머리
      ctx.beginPath(); ctx.ellipse(12 * s, -32 * s, 14 * s, 11 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e04b3a';
      [[16, -36], [21, -30], [12, -38], [24, -35]].forEach(e2 => {
        ctx.beginPath(); ctx.arc(e2[0] * s, e2[1] * s, 2.4 * s, 0, 7); ctx.fill();
      });
      ctx.fillStyle = '#d9a227';                             // 관
      ctx.beginPath();
      ctx.moveTo(2 * s, -42 * s); ctx.lineTo(2 * s, -56 * s); ctx.lineTo(10 * s, -48 * s);
      ctx.lineTo(16 * s, -60 * s); ctx.lineTo(22 * s, -48 * s); ctx.lineTo(28 * s, -56 * s);
      ctx.lineTo(28 * s, -42 * s); ctx.closePath(); ctx.fill();
      // 독니
      ctx.fillStyle = '#efe6cf';
      tri(S, 22 * s, -26 * s, 26 * s, -26 * s, 24 * s, -16 * s, '#efe6cf');
      break;
    }

    default:
      legs(S); torso(S); head(S, 'cap');
  }

  if (hurt) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(-14 * s, -70 * s); ctx.lineTo(-8 * s, -76 * s);
    ctx.moveTo(-2 * s, -74 * s); ctx.lineTo(-2 * s, -82 * s); ctx.stroke();
  }
  ctx.restore();
}

/* 걸을 때 반대쪽 팔을 흔드는 인간형 병종 */
const HUMANOID = {
  banneret:1, trapper:1, warlock:1, dragoon:1, arbalest:1, warmonk:1,
  siren:1, turtleguard:1, harpooner:1, pearlmage:1, corsair:1, fisher:1,
  bannerorc:1, wardpriest:1, stalker:1, frostwitch:1, sapper:1, necroorc:1, deathknight:1,
  skadi:1,bastet:1,runeguard:1, musketeer:1, purifier:1, frostlancer:1,
  drummer:1, assassin:1, burrower:1, boneguard:1,
  pojol:1, hwarang:1, dokkaebi:1, teslaknight:1, clocksoldier:1, mechanic:1, rifleman:1,
  spear: 1, shield: 1, archer: 1, venom: 1, bomber: 1, knight: 1, duelist: 1,
  longbow: 1, rogue: 1, engineer: 1, skeleton: 1,
  goblin: 1, orcspear: 1, ballista: 1, powder: 1, dark: 1, orcberserk: 1
};

/* ---------------------- 부품 ---------------------- */
function sub(S, k, lw) {
  return Object.assign({}, S, { s: S.s * k, lw: lw });
}

function legs(S, hipY) {
  const { ctx, s } = S;
  const hy = -(hipY || 19 * s);
  const stride = S.moving ? 10 * s : 4 * s;
  const lift = S.moving ? 7 * s : 0;
  ctx.strokeStyle = S.col;
  ctx.lineWidth = S.lw;
  for (let i = 0; i < 2; i++) {
    const ph = S.phase + i * Math.PI;
    const fx = Math.sin(ph) * stride + (i ? -2 : 2) * s;
    const fy = -Math.max(0, Math.sin(ph + 1.1)) * lift;
    const bend = 3 * s + 3 * s * Math.max(0, Math.sin(ph + 0.6));
    const kx = fx * 0.5 + bend;
    const ky = (hy + fy) * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, hy);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    // Boots make the planted foot readable at small scales.
    ctx.lineWidth = S.lw * 1.4;
    ctx.beginPath(); ctx.moveTo(fx - s, fy); ctx.lineTo(fx + 3 * s, fy); ctx.stroke();
    ctx.lineWidth = S.lw;
  }
}

/* 무기를 들지 않은 쪽 팔은 걸음에 맞춰 흔든다 */
function armSwing(S) {
  const { ctx, s } = S;
  ctx.strokeStyle = S.col;
  ctx.lineWidth = S.lw * 0.85;
  ctx.beginPath();
  ctx.moveTo(0, -38 * s);
  if (S.cheer) {                                   // 만세
    ctx.quadraticCurveTo(-6 * s, -50 * s, -4 * s, -60 * s);
  } else {
    const sw = S.moving ? Math.sin(S.phase + Math.PI) * 9 * s
      : (S.atk > 0 ? -8 * s * S.atk : (S.wind ? -6 * s * S.wind : 2 * s));   // 치는 반대로 팔을 뒤로
    ctx.quadraticCurveTo(sw * 0.5, -31 * s, sw, -22 * s);
  }
  ctx.stroke();
}

function torso(S, lw) {
  const { ctx, s } = S;
  const armored = ['shield','knight','paladin','colossus','dark','orcshield','warchief','warlord'].includes(S.raw.shape);
  const width = armored ? 8 * s : 5.5 * s;
  ctx.fillStyle = S.tun;
  ctx.beginPath();
  ctx.moveTo(-width * .8, -41 * s); ctx.lineTo(width * .8, -41 * s);
  ctx.lineTo(width, -19 * s); ctx.lineTo(-width, -19 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = S.flash ? '#fff' : '#15273355'; ctx.lineWidth = s; ctx.stroke();
  ctx.fillStyle = S.flash ? '#fff' : '#ffffff26';
  ctx.fillRect(-width * .5, -39 * s, 2 * s, 15 * s);
  ctx.fillStyle = S.flash ? '#fff' : '#353d43';
  ctx.fillRect(-width, -25 * s, width * 2, 3 * s);
  ctx.fillStyle = S.acc; ctx.fillRect(-1.5 * s, -25.5 * s, 3 * s, 4 * s);
  if (armored) {
    ctx.fillStyle = S.acc;
    ctx.fillRect(-width - 2 * s, -41 * s, 5 * s, 5 * s);
    ctx.fillRect(width - 3 * s, -41 * s, 5 * s, 5 * s);
  }
}

function arm(S, hx, hy) {
  const { ctx, s } = S;
  ctx.strokeStyle = S.col; ctx.lineWidth = S.lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -38 * s);
  ctx.quadraticCurveTo(hx * 0.55, -38 * s + (hy + 38 * s) * 0.3, hx, hy);
  ctx.stroke();
}

function armWeapon(S, angle, drawWeapon, gripY) {
  const { ctx, s } = S;
  const st = S.style || 'slash';
  // 준비 동작: 내려찍기는 크게 뒤로, 마법은 지팡이를 치켜들고, 찌르기·쏘기는 조금만.
  const windK = { heavy: 1.15, cast: 0.9, slash: 0.6, thrust: 0.25, shoot: 0.12 }[st];
  angle -= S.wind * windK + (S.cheer ? 0.9 : 0);
  if (st === 'heavy') angle += S.atk * 0.22;             // 내려찍고 조금 더 넘어간다
  let gx = 12 * s, gy = -34 * s - (gripY || 0) * 0.15;
  // 찌르기: 무기 방향으로 쭉 뻗었다가 당긴다. 쏘기: 반동으로 뒤로.
  if (st === 'thrust') {
    const push = (S.atk * 15 - S.wind * 7) * s;
    gx += Math.cos(angle) * push; gy += Math.sin(angle) * push;
  } else if (st === 'shoot') {
    gx -= S.atk * 4 * s;
  }
  swingTrail(S, st, angle, gx, gy);
  arm(S, gx, gy);
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(angle);
  drawWeapon();
  ctx.restore();
}

/* 공격 잔상. 모양마다 다르다. */
function swingTrail(S, st, angle, gx, gy) {
  const { ctx, s } = S;
  if (S.flash || !S.live) return;
  if (st === 'cast') {                                   // 손끝에 모이는 빛
    const g = S.wind * 0.55 + S.atk * 0.9;
    if (g < 0.05) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = S.acc;
    ctx.globalAlpha = 0.25 * g;
    ctx.beginPath(); ctx.arc(gx, gy, (7 + S.wind * 6 + S.atk * 10) * s, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.6 * g;
    ctx.beginPath(); ctx.arc(gx, gy, 3.5 * s, 0, 7); ctx.fill();
    for (let i = 0; i < 3 && S.wind > 0.2; i++) {        // 모여드는 불티
      const a = S.phase * 3 + i * 2.1, r = (14 - S.wind * 8) * s;
      ctx.beginPath(); ctx.arc(gx + Math.cos(a) * r, gy + Math.sin(a) * r, 1.6 * s, 0, 7); ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (S.atk < 0.08 || st === 'shoot') return;
  ctx.save();
  ctx.lineCap = 'round';
  if (st === 'thrust') {                                 // 곧게 뻗는 찌르기 선
    const L = 58 * s;
    for (const [w, a, c] of [[7, 0.28, S.acc], [2.4, 0.8, '#ffffff']]) {
      ctx.globalAlpha = a * S.atk;
      ctx.strokeStyle = c; ctx.lineWidth = w * s;
      ctx.beginPath();
      ctx.moveTo(gx + Math.cos(angle) * 20 * s, gy + Math.sin(angle) * 20 * s);
      ctx.lineTo(gx + Math.cos(angle) * (20 * s + L * S.atk), gy + Math.sin(angle) * (20 * s + L * S.atk));
      ctx.stroke();
    }
  } else {                                               // 휘두르기: 두꺼운 초승달 잔상
    const heavy = st === 'heavy';
    const R = (heavy ? 42 : 36) * s, sweep = (heavy ? 1.7 : 1.15) * S.atk;
    for (const [w, a, c, rr] of [[heavy ? 12 : 8, 0.22, S.acc, 1], [heavy ? 6 : 4, 0.38, S.acc, 0.97], [2, 0.75, '#ffffff', 1.02]]) {
      ctx.globalAlpha = a * S.atk;
      ctx.strokeStyle = c; ctx.lineWidth = w * s;
      ctx.beginPath();
      ctx.arc(gx, gy, R * rr, angle - sweep, angle + 0.12);
      ctx.stroke();
    }
    if (heavy && S.atk > 0.85) {                         // 내려찍는 순간 땅이 울린다
      ctx.globalAlpha = (S.atk - 0.85) * 4;
      ctx.strokeStyle = '#fff5dc'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.ellipse(gx + 26 * s, 0, 18 * s * S.atk, 4 * s, 0, 0, 7); ctx.stroke();
    }
  }
  ctx.restore();
}

/* 공격 자세 곡선: t 0(친 순간) → 1(끝). 앞 20% 에 빠르게 휘둘러 끝까지, 나머지는 부드럽게 거둔다. */
function attackPose(t) {
  if (t < 0.2) { const k = t / 0.2; return 1 - (1 - k) * (1 - k) * (1 - k); }
  const k = (t - 0.2) / 0.8;
  return 1 - (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
}

/* 공격 모양. 병종을 몇 무리로 나눠 움직임을 다르게 준다. */
const ATTACK_STYLES = {
  thrust: 'spear,pojol,frostlancer,valkyrie,hoplite,orcspear,runeguard,teslaknight,pharaoh,spartan,fenrir,bastet,' +
          'fisher,dragoon,turtleguard,bannerorc,banneret',
  heavy: 'berserk,knight,colossus,thor,dokkaebi,ares,viking,ogre,troll,warlord,orcberserk,golem,dark,warchief,frostgiant,orcshield,haetae,shield,paladin,anubis,clocksoldier,mechanic,' +
         'deathknight,demonlord,obsidian,warmonk,slimeking,slimelet,hydra,hydrahead',
  cast: 'mage,frost,pyro,necro,priest,shaman,lich,hades,ra,gumiho,persephone,rapriest,runeseer,mudang,purifier,inventor,plaguer,zeus,herald,saja,odin,medusa,engineer,totem,' +
        'warlock,wardpriest,frostwitch,necroorc,pearlmage,siren,ryujin',
  shoot: 'archer,venom,longbow,sniper,musketeer,rifleman,ballista,artemis,skadi,desertarcher,northarcher,catapult,orccatapult,airship,steammech,turret,' +
         'arbalest,harpooner'
};
const ATTACK_STYLE = {};
for (const k in ATTACK_STYLES) ATTACK_STYLES[k].split(',').forEach(id => { ATTACK_STYLE[id] = k; });
function attackStyle(st) { return ATTACK_STYLE[st.shape] || (st.ranged ? 'shoot' : 'slash'); }

function robe(S, w, top, color) {
  const { ctx, s } = S;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(w, 0); ctx.lineTo(-w, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = S.flash ? '#fff' : '#ffffff35'; ctx.lineWidth = 1.5 * s;
  ctx.beginPath();ctx.moveTo(0, top + 5 * s);ctx.lineTo(w * .35, -4 * s);ctx.stroke();
}

function cape(S, dir, color, k) {
  const { ctx, s } = S;
  const m = k || 1;
  ctx.fillStyle = S.flash ? '#fff' : color;
  ctx.beginPath();
  ctx.moveTo(dir * 3 * s, -50 * s);
  ctx.lineTo(dir * (22 + Math.sin(S.phase * .8) * (S.moving ? 4 : 1.5)) * s * m, -6 * s);
  ctx.lineTo(dir * 4 * s, -14 * s);
  ctx.closePath(); ctx.fill();
}

function shieldShape(S, x, y, w, h, color) {
  const { ctx, s } = S;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y + 4 * s);
  ctx.lineTo(x + w, y + h * 0.72); ctx.lineTo(x + w * 0.5, y + h);
  ctx.lineTo(x, y + h * 0.72);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = S.flash ? '#fff' : 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1.8 * s;
  ctx.stroke();
  ctx.strokeStyle = S.flash ? '#fff' : '#e8d4a0';ctx.lineWidth = 2 * s;
  ctx.beginPath();ctx.moveTo(x + w * .5, y + h * .2);ctx.lineTo(x + w * .5, y + h * .74);
  ctx.moveTo(x + w * .23, y + h * .4);ctx.lineTo(x + w * .77, y + h * .4);ctx.stroke();
}

function bow(S, x, y, r, color) {
  const { ctx, s } = S;
  ctx.strokeStyle = color; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.arc(x, y, r, -1.3, 1.3); ctx.stroke();
  const bx = x + Math.cos(1.3) * r, by = r * Math.sin(1.3);
  // 쏘기 전에 시위를 당기고, 놓는 순간 튕겨 돌아온다
  const pull = S.wind > 0 ? 9 * s * S.wind : -2 * s * Math.sin(S.atk * Math.PI * 3) * S.atk;
  ctx.strokeStyle = S.flash ? '#fff' : '#e6e0d0'; ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(bx, y - by); ctx.lineTo(x - r * 0.5 - pull, y); ctx.lineTo(bx, y + by);
  ctx.stroke();
  if (S.wind > 0.15) {
    ctx.strokeStyle = S.flash ? '#fff' : '#6b4b2a'; ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5 - pull, y); ctx.lineTo(x + r * 0.8, y); ctx.stroke();
  }
}

function barrel(S, x, y, w, h, color, fuse) {
  const { ctx, s } = S;
  ctx.fillStyle = S.flash ? '#fff' : color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = S.flash ? '#fff' : 'rgba(0,0,0,.55)'; ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.32); ctx.lineTo(x + w, y + h * 0.32);
  ctx.moveTo(x, y + h * 0.68); ctx.lineTo(x + w, y + h * 0.68);
  ctx.stroke();
  if (fuse) {
    ctx.strokeStyle = S.flash ? '#fff' : '#d9b45a'; ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.6, y);
    ctx.quadraticCurveTo(x + w * 0.9, y - 10 * s, x + w * 1.2, y - 6 * s);
    ctx.stroke();
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath(); ctx.arc(x + w * 1.25, y - 6 * s, 3.2 * s, 0, 7); ctx.fill();
  }
}

function wheels(S, xs, y, r, color) {
  const { ctx, s } = S;
  ctx.strokeStyle = color; ctx.lineWidth = 3.5 * s;
  xs.forEach(wx => {
    ctx.beginPath(); ctx.arc(wx * s, y, r, 0, 7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx * s - r * 0.7, y); ctx.lineTo(wx * s + r * 0.7, y);
    ctx.moveTo(wx * s, y - r * 0.7); ctx.lineTo(wx * s, y + r * 0.7);
    ctx.stroke();
  });
}

function orb(S, x, y, r, color) {
  const { ctx } = S;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}

function snowflake(S, x, y, r, color) {
  const { ctx, s } = S;
  ctx.strokeStyle = color; ctx.lineWidth = 2 * s;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}

function halo(S, color) {
  const { ctx, s } = S;
  ctx.strokeStyle = color; ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.ellipse(0, -64 * s, 11 * s, 3.4 * s, 0, 0, 7); ctx.stroke();
}

function skull(S, x, y, r, face, eye) {
  const { ctx, s } = S;
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillRect(x - r * 0.55, y + r * 0.5, r * 1.1, r * 0.7);
  ctx.fillStyle = eye;
  ctx.beginPath(); ctx.arc(x - r * 0.38, y - r * 0.12, r * 0.26, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.38, y - r * 0.12, r * 0.26, 0, 7); ctx.fill();
}

function wisp(S, x, y, r, color, phase) {
  const { ctx } = S;
  const dy = Math.sin(phase) * 4 * S.s;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.arc(x, y + dy, r, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(x, y + dy, r * 2.2, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}

function feathers(S, color) {
  const { ctx, s } = S;
  ctx.fillStyle = color;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(i * 7 * s, -62 * s, 3 * s, 9 * s, i * 0.45, 0, 7);
    ctx.fill();
  }
}

function legsHidden() {}

function head(S, type, radius) {
  const { ctx, s } = S;
  const r = radius || 8.5 * s;
  const cy = -50 * s;
  ctx.fillStyle = S.col;
  ctx.beginPath(); ctx.arc(0, cy, r, 0, 7); ctx.fill();
  ctx.fillStyle = S.acc;
  ctx.strokeStyle = S.acc;

  switch (type) {
    case 'skullface':                            // 해골 얼굴
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22';
      ctx.beginPath(); ctx.arc(2 * s, cy - 1 * s, 1.8 * s, 0, 7); ctx.arc(6 * s, cy - 1 * s, 1.8 * s, 0, 7); ctx.fill();
      ctx.fillRect(2 * s, cy + 3 * s, 5 * s, 1.2 * s);
      break;
    case 'gat':                                  // 검은 갓
      ctx.fillStyle = S.flash ? '#fff' : '#111116';
      ctx.fillRect(-r - 9 * s, cy - 6 * s, (r + 9 * s) * 2, 2.4 * s);
      ctx.beginPath(); roundRectPath(ctx, -r * 0.7, cy - 15 * s, r * 1.4, 10 * s, 2 * s); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : '#111116'; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(-r * 0.6, cy - 4 * s); ctx.lineTo(-2 * s, cy + 9 * s); ctx.stroke();
      break;
    case 'jeonrip':                              // 전립 (붉은 술)
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22';
      ctx.beginPath(); ctx.ellipse(0, cy - 5 * s, r + 7 * s, 3 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, cy - 6 * s, r * 0.85, Math.PI, 0); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#c0392b';
      ctx.beginPath(); ctx.arc(0, cy - 6 * s - r * 0.85, 2.6 * s, 0, 7); ctx.fill();
      break;
    case 'foxears':
      tri(S, -r * 0.9, cy - r * 0.4, -r * 0.2, cy - r * 0.9, -r * 0.8, cy - r * 1.9, S.flash ? '#fff' : '#f3e6da');
      tri(S, r * 0.2, cy - r * 0.9, r * 0.9, cy - r * 0.4, r * 0.8, cy - r * 1.9, S.flash ? '#fff' : '#f3e6da');
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22';            // 흑단 머리
      ctx.beginPath(); ctx.arc(0, cy - 1 * s, r + 1 * s, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      ctx.fillRect(-r - 1 * s, cy - 1 * s, 4 * s, 16 * s);
      ctx.fillStyle = S.flash ? '#fff' : S.acc;
      ctx.beginPath(); ctx.arc(r * 0.5, cy - r * 0.6, 2 * s, 0, 7); ctx.fill();
      break;
    case 'hwarang':                              // 상투 + 꽃
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22';
      ctx.beginPath(); ctx.arc(0, cy - 1 * s, r + 0.5 * s, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(-1 * s, cy - r - 2 * s, 3.4 * s, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#f08aa8';
      for (let i = 0; i < 5; i++) { const a = i * 1.256; ctx.beginPath(); ctx.arc(-6 * s + Math.cos(a) * 2.4 * s, cy - r + Math.sin(a) * 2.4 * s, 1.8 * s, 0, 7); ctx.fill(); }
      break;
    case 'goggles':
      ctx.fillStyle = S.flash ? '#fff' : '#5a3b26';            // 가죽 모자
      ctx.beginPath(); ctx.arc(0, cy - 1 * s, r + 1 * s, Math.PI, 0); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#b08d57';
      ctx.fillRect(-r - 1 * s, cy - 4 * s, (r + 1 * s) * 2, 3 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#9fe6ff';            // 고글 렌즈
      ctx.beginPath(); ctx.arc(2 * s, cy - 3 * s, 3 * s, 0, 7); ctx.arc(8 * s, cy - 3 * s, 3 * s, 0, 7); ctx.fill();
      break;
    case 'kepi':
      ctx.fillStyle = S.flash ? '#fff' : S.tun;
      ctx.beginPath(); roundRectPath(ctx, -r, cy - r - 3 * s, r * 2, r * 0.9, 2 * s); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22';
      ctx.fillRect(0, cy - 3 * s, r + 4 * s, 2.2 * s);
      ctx.fillStyle = S.flash ? '#fff' : S.acc;
      ctx.beginPath(); ctx.arc(0, cy - r + 0.5 * s, 1.8 * s, 0, 7); ctx.fill();
      break;
    case 'cap':
      ctx.beginPath(); ctx.arc(0, cy - 1 * s, r + 1.5 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 3 * s, cy - 2 * s, (r + 3 * s) * 2, 2.6 * s);
      break;
    case 'coif':
      ctx.fillStyle = S.tun;
      ctx.beginPath(); ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 7 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#e8d9bd';
      ctx.beginPath(); ctx.arc(1 * s, cy + 1 * s, r * 0.62, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(3 * s, cy, 1.7 * s, 0, 7); ctx.fill();
      break;
    case 'wide':
      ctx.beginPath(); ctx.arc(0, cy - 2 * s, r + 1 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 8 * s, cy - 4 * s, (r + 8 * s) * 2, 3 * s);
      break;
    case 'pot':
      ctx.beginPath(); ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 6 * s);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-r, cy + 1 * s, r * 2, 2 * s);
      break;
    case 'greathelm':
      ctx.beginPath(); ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 9 * s);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-r, cy + 2 * s, r * 2, 2.4 * s);
      ctx.fillStyle = S.acc;
      ctx.fillRect(-1.5 * s, cy - r - 8 * s, 3 * s, 9 * s);
      break;
    case 'hood':
      ctx.beginPath();
      ctx.moveTo(-r - 2 * s, cy + 3 * s); ctx.lineTo(0, cy - r - 9 * s);
      ctx.lineTo(r + 2 * s, cy + 3 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#20242b';
      ctx.beginPath(); ctx.arc(1 * s, cy - 1 * s, r * 0.55, 0, 7); ctx.fill();
      break;
    case 'wizard':
      ctx.fillStyle = S.tun;
      ctx.beginPath();
      ctx.moveTo(-13 * s, cy - 6 * s); ctx.lineTo(13 * s, cy - 6 * s);
      ctx.lineTo(3 * s, cy - 40 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.acc;
      ctx.beginPath(); ctx.arc(3 * s, cy - 40 * s, 3 * s, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#efeade';
      ctx.beginPath();
      ctx.moveTo(-7 * s, cy + 1 * s); ctx.lineTo(7 * s, cy + 1 * s);
      ctx.lineTo(0, cy + 20 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(3 * s, cy - 3 * s, 1.8 * s, 0, 7); ctx.fill();
      break;
    case 'plume':
      ctx.beginPath(); ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 5 * s);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(-2 * s, cy - r - 2 * s);
      ctx.quadraticCurveTo(-14 * s, cy - r - 14 * s, -16 * s, cy - r + 4 * s);
      ctx.quadraticCurveTo(-8 * s, cy - r - 4 * s, 2 * s, cy - r - 2 * s);
      ctx.fill();
      break;
    case 'winged':
      ctx.beginPath(); ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 6 * s);
      ctx.fillStyle = '#efeade';
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(i * (r + 1 * s), cy - 2 * s);
        ctx.lineTo(i * (r + 14 * s), cy - 12 * s);
        ctx.lineTo(i * (r + 4 * s), cy - 10 * s);
        ctx.closePath(); ctx.fill();
      }
      break;
    case 'laurel':
      ctx.fillStyle = '#8fc86a';
      for (let i = -1; i <= 1; i += 2) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.ellipse(i * (5 + k * 5) * s, cy - r - 1 * s - k * 2 * s,
                      4 * s, 2.4 * s, i * (0.4 + k * 0.3), 0, 7);
          ctx.fill();
        }
      }
      break;
    case 'corinth':
      ctx.beginPath(); ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 9 * s);
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(2 * s, cy - 1 * s); ctx.lineTo(r + 2 * s, cy - 1 * s);
      ctx.lineTo(r + 2 * s, cy + 7 * s); ctx.lineTo(2 * s, cy + 7 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c0392b';                          // 붉은 볏
      ctx.beginPath();
      ctx.moveTo(-2 * s, cy - r - 2 * s);
      ctx.quadraticCurveTo(0, cy - r - 16 * s, -18 * s, cy - r - 10 * s);
      ctx.quadraticCurveTo(-10 * s, cy - r - 6 * s, -4 * s, cy - r - 2 * s);
      ctx.fill();
      break;
    case 'moon':
      ctx.fillStyle = S.tun;
      ctx.beginPath(); ctx.arc(0, cy - 1 * s, r + 1 * s, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#dfe8f2';                            // 초승달 관
      ctx.beginPath();
      ctx.arc(0, cy - r - 6 * s, 10 * s, Math.PI * 1.15, Math.PI * 1.85);
      ctx.arc(0, cy - r - 10 * s, 10 * s, Math.PI * 1.85, Math.PI * 1.15, true);
      ctx.fill();
      break;
    case 'wingedhelm':
      ctx.beginPath(); ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy, (r + 2 * s) * 2, 5 * s);
      ctx.fillStyle = '#efeade';
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(i * (r + 1 * s), cy - 2 * s);
        ctx.lineTo(i * (r + 16 * s), cy - 16 * s);
        ctx.lineTo(i * (r + 5 * s), cy - 10 * s);
        ctx.closePath(); ctx.fill();
      }
      break;
    case 'nemes':
      ctx.fillStyle = S.acc;
      ctx.beginPath();
      ctx.moveTo(-r - 5 * s, cy + 12 * s); ctx.lineTo(-r - 2 * s, cy - r - 2 * s);
      ctx.lineTo(r + 2 * s, cy - r - 2 * s); ctx.lineTo(r + 5 * s, cy + 12 * s);
      ctx.lineTo(r - 2 * s, cy + 4 * s); ctx.lineTo(-r + 2 * s, cy + 4 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#e0c090';
      ctx.beginPath(); ctx.arc(1 * s, cy + 1 * s, r * 0.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b6b8e';
      ctx.fillRect(-r - 2 * s, cy - r + 1 * s, (r + 2 * s) * 2, 3 * s);
      break;
    case 'furhood':
      ctx.fillStyle = S.tun;
      ctx.beginPath();
      ctx.moveTo(-r - 4 * s, cy + 4 * s); ctx.lineTo(0, cy - r - 8 * s);
      ctx.lineTo(r + 4 * s, cy + 4 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.acc;                                // 털 테두리
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * 4.5 * s, cy + 2 * s, 3.2 * s, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#20242b';
      ctx.beginPath(); ctx.arc(2 * s, cy - 1 * s, r * 0.5, 0, 7); ctx.fill();
      break;
    case 'wrap':
      ctx.fillStyle = S.acc;
      ctx.beginPath(); ctx.arc(0, cy - 1 * s, r + 2 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r - 2 * s, cy - 2 * s, (r + 2 * s) * 2, 6 * s);
      ctx.beginPath();
      ctx.moveTo(-r - 2 * s, cy + 2 * s); ctx.lineTo(-r - 10 * s, cy + 16 * s);
      ctx.lineTo(-r + 2 * s, cy + 4 * s); ctx.closePath(); ctx.fill();
      break;
    case 'feather':
      ctx.beginPath();
      ctx.ellipse(0, cy - r - 1 * s, r + 5 * s, 3.4 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath();
      ctx.arc(0, cy - r - 2 * s, r * 0.8, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#e8c65a';
      ctx.beginPath();
      ctx.moveTo(-4 * s, cy - r - 4 * s);
      ctx.quadraticCurveTo(-16 * s, cy - r - 16 * s, -20 * s, cy - r - 4 * s);
      ctx.quadraticCurveTo(-12 * s, cy - r - 8 * s, -4 * s, cy - r - 4 * s);
      ctx.fill();
      break;
    case 'horn':
      ctx.beginPath(); ctx.arc(0, cy - 1 * s, r + 1.5 * s, Math.PI, 0); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r, cy - 4 * s); ctx.lineTo(-r - 9 * s, cy - 14 * s);
      ctx.lineTo(-r + 1 * s, cy - 10 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r, cy - 4 * s); ctx.lineTo(r + 9 * s, cy - 14 * s);
      ctx.lineTo(r - 1 * s, cy - 10 * s); ctx.closePath(); ctx.fill();
      break;
    case 'icehorn':
      ctx.fillStyle = S.acc;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, cy - r * 0.6); ctx.lineTo(-r - 8 * s, cy - r - 16 * s);
      ctx.lineTo(-r * 0.2, cy - r); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.7, cy - r * 0.6); ctx.lineTo(r + 8 * s, cy - r - 16 * s);
      ctx.lineTo(r * 0.2, cy - r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b3a44';
      ctx.beginPath(); ctx.arc(4 * s, cy - 1 * s, 2.6 * s, 0, 7); ctx.fill();
      break;
    case 'devil':
      ctx.beginPath(); ctx.arc(0, cy, r + 2 * s, Math.PI, 0); ctx.fill();
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
    case 'ears':
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
    case 'tusk':
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
    case 'crown':
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


function beard(S, color) {
  const { ctx, s } = S;
  ctx.fillStyle = S.flash ? '#fff' : color;
  ctx.beginPath();
  ctx.moveTo(-7 * s, -47 * s); ctx.lineTo(7 * s, -47 * s); ctx.lineTo(0, -28 * s);
  ctx.closePath(); ctx.fill();
}

function bolt(S, color) {
  const { ctx, s } = S;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -6 * s); ctx.lineTo(26 * s, -18 * s); ctx.lineTo(18 * s, -4 * s);
  ctx.lineTo(40 * s, -10 * s); ctx.lineTo(14 * s, 14 * s); ctx.lineTo(20 * s, 0);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.arc(20 * s, -4 * s, 16 * s, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}

function round_shield(S, x, y, r, color) {
  const { ctx, s } = S;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y + r, r, 0, 7); ctx.fill();
  ctx.strokeStyle = S.flash ? '#fff' : 'rgba(0,0,0,.4)';
  ctx.lineWidth = 2 * s;
  ctx.stroke();
}

function wings(S, color, phase) {
  const { ctx, s } = S;
  const flap = Math.sin(phase * 1.6) * 0.25;
  ctx.fillStyle = S.flash ? '#fff' : color;
  for (let i = -1; i <= 1; i += 2) {
    ctx.save();
    ctx.translate(-4 * s, -44 * s);
    ctx.rotate(-0.5 + flap * i);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-26 * s, -16 * s); ctx.lineTo(-18 * s, -2 * s);
    ctx.lineTo(-30 * s, 4 * s); ctx.lineTo(-6 * s, 12 * s);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function jackalHead(S, col, acc) {
  const { ctx, s } = S;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(2 * s, -52 * s, 9 * s, 10 * s, 0, 0, 7); ctx.fill();
  ctx.beginPath();                                     // 주둥이
  ctx.moveTo(8 * s, -56 * s); ctx.lineTo(26 * s, -50 * s);
  ctx.lineTo(8 * s, -44 * s); ctx.closePath(); ctx.fill();
  tri(S, -4 * s, -60 * s, -2 * s, -78 * s, 5 * s, -60 * s, col);   // 귀
  tri(S, 6 * s, -60 * s, 12 * s, -78 * s, 12 * s, -58 * s, col);
  ctx.fillStyle = acc;
  ctx.beginPath(); ctx.arc(8 * s, -54 * s, 2.4 * s, 0, 7); ctx.fill();
}

function axe(S, side) {
  const { ctx, s } = S;
  ctx.strokeStyle = '#6b4b2a'; ctx.lineWidth = 3.2 * s;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28 * s, 0); ctx.stroke();
  ctx.fillStyle = S.flash ? '#fff' : '#c3cad2';
  ctx.beginPath();
  ctx.moveTo(21 * s, -2 * s * side);
  ctx.lineTo(26 * s, -15 * s * side);
  ctx.lineTo(40 * s, -13 * s * side);
  ctx.lineTo(38 * s, -1 * s * side);
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

/* 하트 (홀림) */
function heart(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.8, y - r * 1.4, x, y - r * 0.5);
  ctx.bezierCurveTo(x + r * 0.8, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r);
  ctx.fill();
}

/* 톱니바퀴 */
function gear(S, x, y, r, color) {
  const { ctx, s } = S;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, rr = i % 2 ? r : r * 1.3;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, 7); ctx.fill();
}

function rectPath(ctx, x, y, w, h) { ctx.beginPath(); ctx.rect(x, y, w, h); }

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function statusDot(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 3 * s, 0, 7); ctx.fill();
}

/* 카드/도감용 아이콘 */
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
  const wide = { catapult: 1, wolf: 1, spider: 1, merchant: 1, sniper: 1 };
  const k = wide[stats.shape] ? 0.86 : 1;
  const s = (px / 96) * k;
  ctx.save();
  ctx.translate(px * (wide[stats.shape] ? 0.5 : 0.44), px * 0.94);
  drawBody(ctx, stats, s, false, false, 0, false, 0);
  ctx.restore();
}

/* 캔버스에 쓰는 글자 번역. i18n.js 가 없으면(비교판 등) 그대로 */
function tr(s) { return typeof t === 'function' ? t(s) : s; }

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
    ridgeFar: '#9cb0c0', ridge: '#7d94a4', ground: '#c6cdd2', groundDark: '#98a2a9', speck: '#b3bcc2' },
  // 3막 · 심연: 조수가 빠진 갯벌과 푸른 안개
  { sky0: '#1f3b4a', sky1: '#5f8a94', cloud: 'rgba(190,225,235,.35)',
    ridgeFar: '#2f5560', ridge: '#1d3a45', ground: '#3f5a5c', groundDark: '#26383a', speck: '#33484a' },
  // 3막 · 마계: 재가 내리는 붉은 하늘
  { sky0: '#4a2430', sky1: '#a8603f', cloud: 'rgba(255,200,170,.3)',
    ridgeFar: '#5c3038', ridge: '#3a1e26', ground: '#5a3a32', groundDark: '#37221e', speck: '#4a2e28' }
];
FIELD_PALETTES[0].orb = '#f6e7b0'; FIELD_PALETTES[0].orbGlow = 'rgba(255,250,220,.45)';
FIELD_PALETTES[1].orb = '#f7d489'; FIELD_PALETTES[1].orbGlow = 'rgba(255,230,180,.5)';
FIELD_PALETTES[2].orb = '#e9edc4'; FIELD_PALETTES[2].orbGlow = 'rgba(240,250,210,.4)';
FIELD_PALETTES[3].orb = '#dfe0f0'; FIELD_PALETTES[3].orbGlow = 'rgba(210,214,245,.28)';
FIELD_PALETTES[3].moon = true;
FIELD_PALETTES[4].orb = '#ffffff'; FIELD_PALETTES[4].orbGlow = 'rgba(255,255,255,.55)';
FIELD_PALETTES[5].orb = '#bfe9ff'; FIELD_PALETTES[5].orbGlow = 'rgba(160,225,250,.3)';
FIELD_PALETTES[5].moon = true;
FIELD_PALETTES[6].orb = '#ffb86b'; FIELD_PALETTES[6].orbGlow = 'rgba(255,140,80,.4)';
FIELD_PALETTES.forEach(p => { p.prop = p.groundDark; });

/* 전장 배경. 1~2막은 다섯 팔레트를 돌려 쓰고, 3막(31전장부터)은 심연과 마계
 * 전용 팔레트를 번갈아 쓴다. 같은 막 안에서도 전장마다 하늘이 달라진다. */
const ABYSS_PALETTES = [5, 6];
function fieldPalette(stageIndex) {
  const i = stageIndex | 0;
  if (i >= 30) return FIELD_PALETTES[ABYSS_PALETTES[i % ABYSS_PALETTES.length]];
  return FIELD_PALETTES[i % (FIELD_PALETTES.length - ABYSS_PALETTES.length)];
}
