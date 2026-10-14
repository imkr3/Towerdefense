/* =======================================================================
 *  막대 왕국 전쟁 - 캔버스 렌더러 (졸라맨 스타일)
 * ======================================================================= */

/* 3.8: 병사마다 매 프레임 새로 만들던 표를 한 번만 */
const REACH_BY_STYLE = { thrust: 12, heavy: 9, slash: 7, cast: 2, shoot: -4 };
const PULL_BY_STYLE = { thrust: 5, heavy: 4, slash: 3, cast: 1, shoot: 1 };
const CROWD_NO_SHADOW = 24;      // 화면에 이보다 많이 서 있으면(자동 품질) 부품 그림자를 끈다 (3.10: 36 → 24)
const CROWD_ON = 26, CROWD_OFF = 20;   // 3.12: 자동 품질의 '빽빽함' (잉크 테두리 끄기 · 30fps)
function byRowX(a, b) { return (a.row - b.row) || (a.x - b.x); }

class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    // 3.16: 전장은 배경이 늘 화면을 다 덮는다 — 불투명 캔버스면 합성기가 뒤를 섞지 않는다 (GPU 부담↓)
    this.ctx = canvas.getContext('2d', { alpha: false });
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
    // 3.8: 자동은 1.75배까지 (2배보다 픽셀 23% 적다 — 폰 화면에선 차이가 거의 안 보이고 GPU 부담이 준다)
    const cap = q === 'high' ? 3 : q === 'low' ? 1.5 : 1.75;
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
    // 3.9: WebGL 연출 층도 언제나 같은 크기로. 예전엔 전투 화면이 보이기 전에 맞춘 크기(320×240)가
    // 남아 첫 전투의 파티클이 엉뚱한 곳·크기로 나왔다 (창 크기가 한 번 바뀌어야 바로잡혔다).
    this.syncGlSize();
  }

  /* WebGL 레이어를 2D 캔버스와 같은 크기로 맞춘다 */
  syncGlSize() {
    if (!this.glfx || !this.glfx.ok) return;
    this.glfx.resize(this.w, this.h, this.cv.width / this.w);
  }

  /* 전투가 새로 시작되면 남아 있던 연출을 비운다 */
  resetFx() {
    this.prevCam = undefined;
    this._glCam = undefined;
    if (this._drawList) this._drawList.length = 0;   // 지난 전투의 병사를 붙잡아 두지 않게
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
    if (this.idle || this.crowded) return;          // 일부러 늦춘 프레임은 '느려졌다' 로 치지 않는다
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
  /* 3.5: 배경은 두 겹. 먼 풍경(하늘·산·뒷배경)은 시차가 작아 천천히 움직이니
   * 따로 그려 두고 그 겹이 1px 이상 움직일 때만 다시 그린다 (해상도도 낮춰 — 흐릿해도 티가 안 난다).
   * 땅은 카메라와 1:1 로 움직이고 단색 면이 대부분이라 매 프레임 바로 그린다.
   * 예전엔 카메라가 움직일 때마다(전투 중엔 거의 매 프레임) 화면 전체를 처음부터 다시 칠했다. */
  drawBackground(look) {
    const far = Math.round(this.cam * BG_FAR_PAR);          // 먼 겹에서 가장 빠른 시차가 움직인 픽셀
    const key = look + '|' + this.w + 'x' + this.h + '|' + this.groundY + '|' + far;
    if (this._bgKey !== key) {
      if (!this._bg) {
        this._bg = document.createElement('canvas');
        this._bgCtx = this._bg.getContext('2d', { alpha: false });
      }
      const dpr = Math.min(this.cv.width / this.w, BG_FAR_DPR);
      const bw = Math.round(this.w * dpr), bh = Math.round(this.groundY * dpr) + 4;
      if (this._bg.width !== bw || this._bg.height !== bh) {
        this._bg.width = bw;
        this._bg.height = bh;
        this._bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._skyKey = null;                 // 그라디언트는 컨텍스트에 매여 있다
      }
      this.paintBackground(this._bgCtx, look, far / BG_FAR_PAR);
      this._bgKey = key;
    }
    this.ctx.drawImage(this._bg, 0, 0, this.w, this._bg.height * this.w / this._bg.width);
    this.paintGround(this.ctx, look, this.cam);
  }

  paintBackground(ctx, look, cam) {
    const w = this.w, h = this.h, gy = this.groundY;
    const pal = FIELD_LOOKS[look] || FIELD_LOOKS.meadow;

    // 하늘 그라디언트는 매 프레임 새로 만들 필요가 없다
    const key = look + gy;
    if (this._skyKey !== key) {
      const g = ctx.createLinearGradient(0, 0, 0, gy);
      g.addColorStop(0, pal.sky0);
      g.addColorStop(1, pal.sky1);
      this._sky = g;
      this._skyKey = key;
    }
    ctx.fillStyle = this._sky;
    ctx.fillRect(0, 0, w, h);

    if (pal.stars) {                                   // 별
      for (let i = 0; i < 70; i++) {
        const x = ((_h(i) * (w + 400) - cam * 0.02) % (w + 400) + w + 400) % (w + 400) - 200;
        const y = _h(i + 99) * gy * 0.6;
        ctx.globalAlpha = 0.3 + _h(i + 7) * 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, 1 + (_h(i + 3) > 0.85 ? 1 : 0), 1 + (_h(i + 3) > 0.85 ? 1 : 0));
      }
      ctx.globalAlpha = 1;
    }
    if (pal.aurora) {                                  // 오로라
      for (let k = 0; k < 3; k++) {
        const g = ctx.createLinearGradient(0, gy * 0.05, 0, gy * 0.45);
        const c = ['rgba(120,255,200,', 'rgba(140,160,255,', 'rgba(220,130,255,'][k];
        g.addColorStop(0, c + '0)'); g.addColorStop(0.5, c + '.22)'); g.addColorStop(1, c + '0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-20, gy * 0.35);
        for (let x = -20; x <= w + 40; x += 40) ctx.lineTo(x, gy * (0.18 + 0.08 * Math.sin(x * 0.006 + k * 2 - cam * 0.0008) + k * 0.05));
        ctx.lineTo(w + 40, gy * 0.5); ctx.lineTo(-20, gy * 0.5); ctx.closePath(); ctx.fill();
      }
    }

    // 해 / 달 / 일식
    if (!pal.noOrb) {
      const ox = ((this.w * 0.74 - cam * 0.05) % (this.w + 240) + this.w + 240) % (this.w + 240) - 120;
      const oy = gy * 0.2;
      if (pal.eclipse) {
        for (let k = 3; k >= 1; k--) {
          ctx.fillStyle = 'rgba(255,200,120,' + (0.12 * k) + ')';
          ctx.beginPath(); ctx.arc(ox, oy, 30 + k * 12, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = '#ffe0a0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ox, oy, 31, 0, 7); ctx.stroke();
        ctx.fillStyle = '#120a10';
        ctx.beginPath(); ctx.arc(ox, oy, 29, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = pal.orbGlow;
        ctx.beginPath(); ctx.arc(ox, oy, 44, 0, 7); ctx.fill();
        ctx.fillStyle = pal.orb;
        ctx.beginPath(); ctx.arc(ox, oy, 30, 0, 7); ctx.fill();
        if (pal.moon) {
          ctx.fillStyle = pal.sky0;
          ctx.beginPath(); ctx.arc(ox - 13, oy - 8, 27, 0, 7); ctx.fill();
        }
      }
    }

    // 구름
    if (pal.cloud) {
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
    }

    // 산 능선: 컨셉마다 모양이 다르다
    const ridge = (color, amp, step, par, base, seed, cap) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-step, gy + 4);
      const start = Math.floor(cam * par / step) - 2;
      const pts = [];
      for (let i = start; i < start + Math.ceil(w / step) + 5; i++) {
        const x = i * step - cam * par;
        const height = base + amp * (0.45 + 0.55 * Math.sin(i * 2.31 + seed) ** 2);
        pts.push([x, gy - height, height]);
      }
      const st = pal.ridgeStyle || 'sharp';
      pts.forEach(([x, y, hh], k) => {
        if (st === 'round') {
          const nx = pts[k + 1] ? pts[k + 1][0] : x + step;
          ctx.quadraticCurveTo(x, y, (x + nx) / 2, y + hh * 0.15);
        } else if (st === 'mesa') {
          ctx.lineTo(x, y + hh * 0.35); ctx.lineTo(x + step * 0.12, y); ctx.lineTo(x + step * 0.5, y); ctx.lineTo(x + step * 0.62, y + hh * 0.4);
        } else if (st === 'dune') {
          const nx = pts[k + 1] ? pts[k + 1][0] : x + step;
          ctx.quadraticCurveTo(x + step * 0.3, y, (x + nx) / 2, y + hh * 0.45);
        } else {
          ctx.lineTo(x, y); ctx.lineTo(x + step * 0.48, gy - hh * 0.64);
        }
      });
      ctx.lineTo(w + step, gy + 4);
      ctx.closePath(); ctx.fill();
      if (cap && st === 'sharp') {                      // 눈 덮인 봉우리
        ctx.fillStyle = 'rgba(250,252,255,.9)';
        pts.forEach(([x, y, hh]) => {
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + step * 0.13, y + hh * 0.2); ctx.lineTo(x + step * 0.05, y + hh * 0.16);
          ctx.lineTo(x - step * 0.02, y + hh * 0.24); ctx.lineTo(x - step * 0.1, y + hh * 0.14); ctx.closePath(); ctx.fill();
        });
      }
    };
    if (!pal.noRidge) ridge(pal.ridgeFar, gy * 0.42, 160, 0.12, 35, 4, pal.snowcap);
    const layers = pal.layers || [];
    layers.forEach(n => { const L = LOOK_LAYERS[n]; if (L && L.z === 'far') L.fn(this, ctx, pal, cam); });
    if (!pal.noRidge) ridge(pal.ridge, gy * 0.24, 110, 0.28, 16, 7, pal.snowcap);
    layers.forEach(n => { const L = LOOK_LAYERS[n]; if (L && L.z === 'back') L.fn(this, ctx, pal, cam); });

    const mist = ctx.createLinearGradient(0, gy - 60, 0, gy);
    mist.addColorStop(0, 'rgba(0,0,0,0)'); mist.addColorStop(1, pal.fog || pal.sky1);
    ctx.globalAlpha = pal.fog ? 1 : 0.2; ctx.fillStyle = mist;
    ctx.fillRect(0, gy - 60, w, 60); ctx.globalAlpha = 1;

  }

  /* 3.16: 땅 바탕(단색 · 어두운 띠 · 앞쪽 그늘 · 닳은 길)은 카메라와 상관없다. 예전엔 매 프레임 화면 너비로
   * 네 번(그중 하나는 그라디언트) 칠했다 — 한 번 그려 두고 1:1 로 옮겨 붙인다. 화면 크기·전장이 바뀔 때만 다시. */
  groundBase(look) {
    const w = this.w, h = this.h, gy = this.groundY, dpr = this.cv.width / this.w;
    const key = look + '|' + w + 'x' + h + '|' + gy + '|' + this.cv.width + '|' + this.cs;
    if (this._gbKey !== key) {
      const pal = FIELD_LOOKS[look] || FIELD_LOOKS.meadow;
      const c = this._gb || (this._gb = document.createElement('canvas'));
      const gh = h - gy - 2;
      c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(gh * dpr));
      const g = c.getContext('2d', { alpha: false });
      g.setTransform(dpr, 0, 0, dpr, 0, -(gy + 2) * dpr);     // 땅 좌표 그대로 그린다
      g.fillStyle = pal.ground; g.fillRect(0, gy + 2, w, h - gy);
      g.fillStyle = pal.groundDark; g.fillRect(0, gy + 2, w, 4);
      const grad = g.createLinearGradient(0, gy, 0, h);           // 앞쪽으로 갈수록 어둡게
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,.22)');
      g.fillStyle = grad; g.fillRect(0, gy + 2, w, h - gy);
      g.fillStyle = 'rgba(225,211,171,.12)';                       // 세 줄의 전열을 받치는 닳은 길
      g.fillRect(0, gy + 9, w, 21 * this.cs);
      this._gbKey = key;
    }
    return this._gb;
  }

  paintGround(ctx, look, cam) {
    const w = this.w, h = this.h, gy = this.groundY;
    const pal = FIELD_LOOKS[look] || FIELD_LOOKS.meadow;
    const layers = pal.layers || [];
    // 땅 바탕 (미리 그려 둔 것)
    ctx.drawImage(this.groundBase(look), 0, gy + 2, w, h - gy - 2);
    // 땅 무늬
    ctx.fillStyle = pal.speck;
    const step = 64;
    const off = ((-cam * this.zoom) % step + step) % step;
    for (let x = off - step; x < w + step; x += step) {
      const yy = gy + 26 + ((x * 7) % 44);
      ctx.fillRect(x, yy, 14, 3);
    }
    layers.forEach(n => { const L = LOOK_LAYERS[n]; if (L && L.z === 'ground') L.fn(this, ctx, pal, cam); });
    layers.forEach(n => { const L = LOOK_LAYERS[n]; if (L && L.z === 'top') L.fn(this, ctx, pal, cam); });
  }

  /* --------------------------- 소품 --------------------------- */
  drawProps(look) {
    const ctx = this.ctx, cs = this.cs;
    const pal = FIELD_LOOKS[look] || FIELD_LOOKS.meadow;
    const kinds = pal.props || ['tree', 'spear', 'rock'];
    const t = this.clock || 0;
    for (let i = 0; i < 24; i++) {
      const wx = 40 + i * 88 + ((i * 137) % 43);
      const x = this.screenX(wx);
      if (x < -70 || x > this.w + 70) continue;
      const kind = kinds[(i * 7) % kinds.length];
      const y = this.groundY - 4 + ((i * 31) % 8);
      const sc = cs * (0.7 + ((i * 13) % 5) / 10);
      const fn = PROP_DRAW[kind];
      if (!fn) continue;
      ctx.save();
      ctx.translate(x, y);
      if (i % 3 === 1) ctx.scale(-1, 1);
      fn(ctx, sc, pal, t + i);
      ctx.restore();
    }
  }

  /* --------------------------- 날씨 --------------------------- */
  drawWeather(look) {
    const pal = FIELD_LOOKS[look] || FIELD_LOOKS.meadow;
    const fn = WEATHER[pal.weather];
    if (!fn) return;
    const ctx = this.ctx;
    ctx.save();
    fn(ctx, this.w, this.h, this.groundY, this.clock || 0, this.cam * this.zoom, this.fxq < 0.5 ? 0.5 : 1, this.cs);
    ctx.restore();
  }

  /* 4.15 모래폭풍: 화면을 덮는 모래 장막 (켜지고 꺼질 때 부드럽게) */
  drawSandstorm(battle) {
    const want = battle.storming ? 1 : 0, cur = this._storm || 0;
    if (!want && !cur) return;
    const step = 2.4 * (this._fdt || 0.016);          // 4.18: 초당 같은 속도 (30fps 에서 두 배 느리던 것)
    const k = this._storm = cur + Math.max(-step, Math.min(step, want - cur));
    if (k <= 0.001) { this._storm = 0; return; }
    const ctx = this.ctx, W = this.w, H = this.h, t = this.clock || 0, q = this.fxq < 0.5 ? 0.5 : 1;
    ctx.save();
    ctx.fillStyle = 'rgba(200,140,70,' + 0.26 * k + ')'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70 * q; i++) {
      const x = wx(i + 200, t, -420 - _h(i + 2) * 260, W + 300) - 150, y = _h(i + 9) * H;
      ctx.fillStyle = 'rgba(240,200,140,' + (0.08 + _h(i + 3) * 0.14) * k + ')'; ctx.beginPath(); ctx.ellipse(x, y, 40 + _h(i) * 70, 3 + _h(i + 1) * 4, 0, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(170,110,50,' + 0.4 * k + ')';
    for (let i = 0; i < 120 * q; i++) { const x = wx(i + 400, t, -520 - _h(i + 5) * 300, W + 40) - 20, y = _h(i + 19) * H; ctx.fillRect(x, y, 4, 1.2); }
    ctx.restore();
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

    const tt = this.clock || 0;
    const hpK = c.maxHp ? Math.max(0, c.hp / c.maxHp) : 1;
    const INKC = 'rgba(12,16,24,.8)';
    const outline = w => { ctx.strokeStyle = INKC; ctx.lineWidth = w * s; ctx.stroke(); };
    const torch = (tx, ty) => {                           // 흔들리는 횃불
      ctx.fillStyle = '#4a3a28'; ctx.fillRect(tx - 1.5 * s, ty, 3 * s, 10 * s);
      const f = 1 + Math.sin(tt * 13 + tx) * 0.18;
      ctx.fillStyle = 'rgba(255,170,60,.28)';
      ctx.beginPath(); ctx.arc(tx, ty - 3 * s, 9 * s * f, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.ellipse(tx, ty - 3 * s, 3 * s, 5.5 * s * f, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff1b8';
      ctx.beginPath(); ctx.ellipse(tx, ty - 2 * s, 1.4 * s, 2.6 * s * f, 0, 0, 7); ctx.fill();
    };
    const cracks = (x0, y0, w, h) => {                    // 무너지는 정도만큼 금이 간다
      if (hpK > 0.66) return;
      ctx.strokeStyle = 'rgba(20,14,10,.7)'; ctx.lineWidth = 2 * s;
      const n = hpK > 0.33 ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const cx = x0 + w * (0.2 + 0.6 * ((i * 37) % 10) / 10), cy = y0 + h * (0.25 + (i % 3) * 0.2);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 7 * s, cy + 9 * s);
        ctx.lineTo(cx + 3 * s, cy + 17 * s); ctx.lineTo(cx + 10 * s, cy + 26 * s); ctx.stroke();
      }
    };
    const smoke = (sx, sy) => {                           // 거의 무너지면 연기
      if (hpK > 0.33) return;
      for (let i = 0; i < 4; i++) {
        const k = (tt * 0.4 + i / 4) % 1;
        ctx.fillStyle = 'rgba(60,56,54,' + (0.35 * (1 - k)) + ')';
        ctx.beginPath(); ctx.arc(sx + Math.sin(k * 5 + i) * 8 * s, sy - k * 60 * s, (6 + k * 14) * s, 0, 7); ctx.fill();
      }
    };

    if (!isEnemy) {
      /* 왕국 성채: 가운데 성벽 + 양옆 둥근 탑 */
      const tw = 30 * s, th = hgt + 22 * s;
      const stone = (x0, y0, w, h, base, lite) => {
        ctx.fillStyle = base; ctx.fillRect(x0, y0, w, h);
        const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);   // 왼쪽 위 빛
        g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)');
        ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
        ctx.fillStyle = lite;                                   // 돌 줄눈
        for (let r = 0; r * 16 * s < h - 8 * s; r++) {
          for (let k = 0; k * 22 * s < w; k++) {
            const bx = x0 + k * 22 * s + ((r % 2) ? 11 * s : 0);
            if (bx + 18 * s > x0 + w) continue;
            ctx.fillRect(bx + 1 * s, y0 + 6 * s + r * 16 * s, 18 * s, 2 * s);
          }
        }
        ctx.beginPath(); ctx.rect(x0, y0, w, h); outline(1.6);
      };
      const merlons = (x0, y0, w, col) => {
        ctx.fillStyle = col;
        for (let k = 0; k * 12 * s < w - 4 * s; k++) {
          ctx.beginPath(); ctx.rect(x0 + k * 12 * s, y0 - 10 * s, 8 * s, 10 * s); ctx.fill(); outline(1.2);
        }
      };
      // 가운데 성벽
      stone(-wdt / 2 + tw * 0.6, -hgt, wdt - tw * 1.2, hgt, '#8e8b84', 'rgba(60,58,54,.35)');
      merlons(-wdt / 2 + tw * 0.6 + 2 * s, -hgt, wdt - tw * 1.2, '#a5a29a');
      // 양옆 탑 (원뿔 지붕, 화살 구멍)
      for (const side of [-1, 1]) {
        const tx = side * (wdt / 2 - tw / 2);
        stone(tx - tw / 2, -th, tw, th, '#97948c', 'rgba(60,58,54,.35)');
        ctx.fillStyle = '#6f89b8';
        ctx.beginPath(); ctx.moveTo(tx - tw / 2 - 4 * s, -th); ctx.lineTo(tx, -th - 34 * s); ctx.lineTo(tx + tw / 2 + 4 * s, -th); ctx.closePath(); ctx.fill(); outline(1.6);
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.beginPath(); ctx.moveTo(tx, -th - 34 * s); ctx.lineTo(tx + tw / 2 + 4 * s, -th); ctx.lineTo(tx + 3 * s, -th); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3f5f96';                                 // 지붕 줄무늬
        for (let k = 1; k < 3; k++) ctx.fillRect(tx - tw / 2 + k * 2 * s, -th - k * 9 * s, tw - k * 4 * s, 2 * s);
        ctx.fillStyle = '#e8c65a';
        ctx.beginPath(); ctx.arc(tx, -th - 36 * s, 3 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#1c1a18';                                 // 화살 구멍
        for (const yy of [-th + 26 * s, -th + 62 * s]) { ctx.fillRect(tx - 1.8 * s, yy, 3.6 * s, 13 * s); ctx.fillRect(tx - 5 * s, yy + 4.5 * s, 10 * s, 3 * s); }
      }
      // 성문: 아치 + 나무문 + 쇠 징 + 창살
      ctx.fillStyle = '#6b5a46';
      ctx.beginPath(); ctx.moveTo(-23 * s, 0); ctx.lineTo(-23 * s, -36 * s); ctx.arc(0, -36 * s, 23 * s, Math.PI, 0); ctx.lineTo(23 * s, 0); ctx.closePath(); ctx.fill(); outline(1.6);
      ctx.fillStyle = '#3b3128';
      ctx.beginPath(); ctx.moveTo(-19 * s, 0); ctx.lineTo(-19 * s, -34 * s); ctx.arc(0, -34 * s, 19 * s, Math.PI, 0); ctx.lineTo(19 * s, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6b5c46'; ctx.lineWidth = 2 * s;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8 * s, 0); ctx.lineTo(i * 8 * s, -50 * s); ctx.stroke(); }
      ctx.strokeStyle = '#2a241e'; ctx.lineWidth = 2.4 * s;
      for (const yy of [-12, -30]) { ctx.beginPath(); ctx.moveTo(-19 * s, yy * s); ctx.lineTo(19 * s, yy * s); ctx.stroke(); }
      ctx.fillStyle = '#b8b3a8';
      for (const xx of [-16, -8, 0, 8, 16]) for (const yy of [-12, -30]) { ctx.beginPath(); ctx.arc(xx * s, yy * s, 1.3 * s, 0, 7); ctx.fill(); }
      torch(-30 * s, -52 * s); torch(30 * s, -52 * s);
      // 깃대와 휘날리는 왕국기
      ctx.strokeStyle = '#7d7468'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(0, -hgt - 10 * s); ctx.lineTo(0, -hgt - 54 * s); ctx.stroke();
      const wv = Math.sin(tt * 3) * 4 * s;
      ctx.fillStyle = '#3f6bb5';
      ctx.beginPath();
      ctx.moveTo(0, -hgt - 54 * s);
      ctx.quadraticCurveTo(20 * s, -hgt - 58 * s + wv, 40 * s, -hgt - 50 * s + wv * 0.4);
      ctx.lineTo(34 * s, -hgt - 42 * s + wv * 0.6); ctx.lineTo(40 * s, -hgt - 34 * s + wv * 0.4);
      ctx.quadraticCurveTo(20 * s, -hgt - 40 * s + wv, 0, -hgt - 34 * s);
      ctx.closePath(); ctx.fill(); outline(1.2);
      ctx.fillStyle = '#e8c65a';
      ctx.beginPath(); ctx.arc(15 * s, -hgt - 45 * s + wv * 0.8, 4 * s, 0, 7); ctx.fill();
      // 이끼 낀 밑단
      ctx.fillStyle = 'rgba(80,110,60,.5)';
      ctx.beginPath(); ctx.ellipse(-wdt * 0.3, -2 * s, 16 * s, 5 * s, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(wdt * 0.32, -2 * s, 12 * s, 4 * s, 0, Math.PI, 0); ctx.fill();
      cracks(-wdt / 2, -hgt, wdt, hgt);
      smoke(-wdt * 0.25, -hgt - 10 * s);
    } else {
      /* 오크 요새: 통나무 말뚝 방벽 + 망루 + 해골 토템 */
      // 망루 (방벽 뒤)
      ctx.fillStyle = '#3d2f20';
      ctx.fillRect(-wdt * 0.12, -hgt - 32 * s, 4 * s, 40 * s); ctx.fillRect(wdt * 0.26, -hgt - 32 * s, 4 * s, 40 * s);
      ctx.fillStyle = '#6b4f30';
      ctx.beginPath(); ctx.rect(-wdt * 0.16, -hgt - 38 * s, wdt * 0.48, 12 * s); ctx.fill(); outline(1.4);
      ctx.fillStyle = '#8a6a44';                                   // 가죽 지붕
      ctx.beginPath(); ctx.moveTo(-wdt * 0.2, -hgt - 38 * s); ctx.lineTo(wdt * 0.08, -hgt - 54 * s);
      ctx.lineTo(wdt * 0.36, -hgt - 38 * s); ctx.closePath(); ctx.fill(); outline(1.4);
      // 통나무 하나하나
      const logs = 7, lw = wdt / logs;
      for (let i = 0; i < logs; i++) {
        const bx = -wdt / 2 + i * lw, top = -hgt - ((i * 53) % 3) * 5 * s;
        const g = ctx.createLinearGradient(bx, 0, bx + lw, 0);
        g.addColorStop(0, '#6e5438'); g.addColorStop(0.45, '#57412a'); g.addColorStop(1, '#3a2c1c');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx + 1 * s, 0); ctx.lineTo(bx + 1 * s, top);
        ctx.lineTo(bx + lw / 2, top - 20 * s); ctx.lineTo(bx + lw - 1 * s, top); ctx.lineTo(bx + lw - 1 * s, 0);
        ctx.closePath(); ctx.fill(); outline(1.4);
        ctx.strokeStyle = 'rgba(30,20,12,.45)'; ctx.lineWidth = 1 * s;   // 나뭇결
        ctx.beginPath(); ctx.moveTo(bx + lw * 0.35, top + 10 * s); ctx.lineTo(bx + lw * 0.3, -10 * s); ctx.stroke();
        ctx.fillStyle = '#c9b48a';                                        // 잘린 끝
        ctx.beginPath(); ctx.moveTo(bx + lw / 2 - 2.5 * s, top - 13 * s); ctx.lineTo(bx + lw / 2, top - 20 * s); ctx.lineTo(bx + lw / 2 + 2.5 * s, top - 13 * s); ctx.closePath(); ctx.fill();
      }
      // 가로 묶음 밧줄
      ctx.strokeStyle = '#2a1e12'; ctx.lineWidth = 3.6 * s;
      for (const yy of [-hgt * 0.72, -hgt * 0.3]) { ctx.beginPath(); ctx.moveTo(-wdt / 2, yy); ctx.lineTo(wdt / 2, yy + 3 * s); ctx.stroke(); }
      // 입구
      ctx.fillStyle = '#1c1610';
      ctx.beginPath(); ctx.moveTo(-20 * s, 0); ctx.lineTo(-20 * s, -44 * s); ctx.lineTo(0, -54 * s); ctx.lineTo(20 * s, -44 * s); ctx.lineTo(20 * s, 0); ctx.closePath(); ctx.fill(); outline(1.6);
      ctx.fillStyle = '#e8dcc0';                                         // 입구 위 엄니
      for (const xx of [-14, 14]) { ctx.beginPath(); ctx.moveTo(xx * s, -46 * s); ctx.quadraticCurveTo(xx * 1.5 * s, -30 * s, xx * 0.6 * s, -24 * s); ctx.lineTo(xx * 0.8 * s, -44 * s); ctx.closePath(); ctx.fill(); }
      torch(-28 * s, -60 * s); torch(28 * s, -60 * s);
      // 해골 토템
      ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(0, -hgt - 2 * s); ctx.lineTo(0, -hgt - 24 * s); ctx.stroke();
      ctx.fillStyle = '#d8d2c2';
      ctx.beginPath(); ctx.arc(0, -hgt - 34 * s, 12 * s, 0, 7); ctx.fill(); outline(1.4);
      ctx.fillRect(-6 * s, -hgt - 26 * s, 12 * s, 6 * s);
      ctx.fillStyle = '#1c1610';
      ctx.beginPath(); ctx.arc(-4.5 * s, -hgt - 36 * s, 3.2 * s, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(4.5 * s, -hgt - 36 * s, 3.2 * s, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,80,40,' + (0.5 + Math.sin(tt * 4) * 0.3) + ')';   // 눈빛
      ctx.beginPath(); ctx.arc(-4.5 * s, -hgt - 36 * s, 1.4 * s, 0, 7); ctx.arc(4.5 * s, -hgt - 36 * s, 1.4 * s, 0, 7); ctx.fill();
      // 해진 붉은 깃발
      const wv = Math.sin(tt * 3.4) * 4 * s;
      ctx.strokeStyle = '#3d2f20'; ctx.lineWidth = 2.6 * s;
      ctx.beginPath(); ctx.moveTo(-wdt / 2 + 4 * s, -hgt + 6 * s); ctx.lineTo(-wdt / 2 + 4 * s, -hgt - 40 * s); ctx.stroke();
      ctx.fillStyle = '#8e2f3a';
      ctx.beginPath();
      ctx.moveTo(-wdt / 2 + 4 * s, -hgt - 40 * s);
      ctx.quadraticCurveTo(-wdt / 2 - 14 * s, -hgt - 40 * s + wv, -wdt / 2 - 32 * s, -hgt - 34 * s + wv);
      ctx.lineTo(-wdt / 2 - 24 * s, -hgt - 26 * s + wv * 0.6); ctx.lineTo(-wdt / 2 - 30 * s, -hgt - 16 * s + wv * 0.5);
      ctx.lineTo(-wdt / 2 + 4 * s, -hgt - 18 * s);
      ctx.closePath(); ctx.fill(); outline(1.2);
      ctx.fillStyle = '#1c1610';
      ctx.beginPath(); ctx.arc(-wdt / 2 - 12 * s, -hgt - 29 * s + wv * 0.8, 3.5 * s, 0, 7); ctx.fill();
      // 바닥 뼈
      ctx.fillStyle = '#d8d2c2';
      ctx.fillRect(-wdt * 0.4, -3 * s, 12 * s, 2.4 * s); ctx.fillRect(wdt * 0.25, -4 * s, 9 * s, 2.4 * s);
      cracks(-wdt / 2, -hgt, wdt, hgt);
      smoke(wdt * 0.2, -hgt - 10 * s);
      if (hpK < 0.5) {                                                   // 불붙은 말뚝
        for (let i = 0; i < 3; i++) {
          const fx = -wdt / 2 + (i * 2 + 1) * wdt / 7, f = 1 + Math.sin(tt * 11 + i * 2) * 0.2;
          ctx.fillStyle = 'rgba(255,140,40,.8)';
          ctx.beginPath(); ctx.ellipse(fx, -hgt - 4 * s, 5 * s, 10 * s * f, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,230,140,.9)';
          ctx.beginPath(); ctx.ellipse(fx, -hgt - 1 * s, 2.4 * s, 5 * s * f, 0, 0, 7); ctx.fill();
        }
      }
    }

    if (c.hitFlash > 0) {
      ctx.globalAlpha = 0.4 * Math.min(1, c.hitFlash / 0.15);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-wdt / 2, -hgt, wdt, hgt);
      ctx.globalAlpha = 1;
    }
    // 보스의 결계: 보스가 살아 있는 동안 요새는 무너지지 않는다
    const b = this._battle;
    if (isEnemy && b && b.wardUp && b.wardUp()) {
      const pulse = 0.75 + Math.sin(tt * 3) * 0.15 + (c.wardHit > 0 ? c.wardHit : 0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 * pulse;
      ctx.fillStyle = '#c98aff';
      ctx.beginPath(); ctx.ellipse(0, -hgt * 0.45, wdt * 0.85, hgt * 0.9, 0, Math.PI, 0); ctx.lineTo(wdt * 0.85, 0); ctx.lineTo(-wdt * 0.85, 0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.7 * pulse;
      ctx.strokeStyle = '#e2c4ff'; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.ellipse(0, -hgt * 0.45, wdt * 0.85, hgt * 0.9, 0, Math.PI, 0); ctx.stroke();
      for (let i = 0; i < 6; i++) {                                     // 결계 위를 도는 룬
        const a = Math.PI + (i / 6) * Math.PI + tt * 0.6;
        const rx = Math.cos(a) * wdt * 0.85, ry = -hgt * 0.45 + Math.sin(a) * hgt * 0.9;
        if (ry > 0) continue;
        ctx.beginPath(); ctx.moveTo(rx, ry - 5 * s); ctx.lineTo(rx + 4 * s, ry); ctx.lineTo(rx, ry + 5 * s); ctx.lineTo(rx - 4 * s, ry); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    // 본진 체력바
    const bw = 100 * s;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    rectPath(ctx, x - bw / 2, y - hgt - 66 * s, bw, 9 * s); ctx.fill();
    ctx.fillStyle = isEnemy ? '#c0392b' : '#3f8ed0';
    rectPath(ctx, x - bw / 2, y - hgt - 66 * s, bw * (c.hp / c.maxHp), 9 * s); ctx.fill();
    if (isEnemy && this._battle && this._battle.wardUp && this._battle.wardUp()) {
      ctx.font = 'bold ' + Math.round(11 * s) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3 * s; ctx.strokeStyle = 'rgba(0,0,0,.65)';
      const wt = tr('보스의 결계 · 보스를 쓰러뜨리세요');
      const half = ctx.measureText(wt).width / 2 + 6 * s;
      const lx = Math.max(half, Math.min(this.w - half, x));          // 화면 끝에 걸려도 다 보이게
      ctx.strokeText(wt, lx, y - hgt - 72 * s);
      ctx.fillStyle = '#e2c4ff'; ctx.fillText(wt, lx, y - hgt - 72 * s);
      ctx.textAlign = 'left';
    }
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
    const reach = REACH_BY_STYLE[style];
    const pull = PULL_BY_STYLE[style];
    const lunge = atk > 0 ? atk * reach * this.cs : -wind * pull * this.cs;
    // 멈춰 있을 때는 숨쉬기 (병사마다 박자가 다르다)
    if (f._seed === undefined) f._seed = Math.random() * 10;
    const clk = (this.clock || 0) + f._seed;
    const tired = f.maxHp > 0 && f.hp / f.maxHp < 0.3 && !f.isCastle;    // 4.13 체력이 바닥나면 숨이 가쁘고 몸이 숙여진다
    const breathe = (!moving && atk === 0 && wind === 0) ? Math.sin(clk * (tired ? 4.2 : 2.1)) * (tired ? 1.9 : 1.3) * this.cs : 0;
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
    // 4.3 탈것 3진(전차·구급 마차·비행접시)은 걷지 않는다. 키 큰 3진은 체력바·표식을 더 위로, 넓은 3진은 그림자를 넓게
    const vehicle = !!X3_VEHICLE[f.s.shape], wk = X3_WIDE[f.s.shape] || 1;
    const top = (X3_TOP[f.s.shape] || 72) * s;

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
    ctx.beginPath(); ctx.ellipse(0, 2, 20 * s * wk, 5 * s, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(0, 1, 17 * s * wk, 4.5 * s, 0, 0, 7); ctx.fill();
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
    if (f.s.evo) {                                         // 진화한 병사: 발밑 금빛 문양 (4.1 3진은 청록 + 도는 별 셋)
      const pulse = 0.85 + Math.sin(f.bob * 1.8) * 0.15;
      if (f.s.evo2) {
        ctx.fillStyle = f.s.evo3 ? '#ffd76a' : '#7ff0ff'; ctx.globalAlpha = 0.75;
        for (let i = 0; i < 3; i++) { const a = clk * 1.6 + i * 2.094, x = Math.cos(a) * 30 * s * wk, y = 1 + Math.sin(a) * 8 * s;
          ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.lineTo(x + 2 * s, y); ctx.lineTo(x, y + 3 * s); ctx.lineTo(x - 2 * s, y); ctx.closePath(); ctx.fill(); }
      }
      ctx.globalAlpha = 0.55 * pulse;
      ctx.strokeStyle = f.s.evo3 ? '#e0b0ff' : f.s.evo2 ? '#7ff0ff' : '#f6d365';
      ctx.lineWidth = 1.8 * s;
      ctx.beginPath(); ctx.ellipse(0, 1, 26 * s * wk, 7 * s, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 0.3 * pulse;
      ctx.beginPath(); ctx.ellipse(0, 1, 33 * s * pulse * wk, 9 * s * pulse, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (f.veilT > 0) {                                     // 안개화: 붉은 안개가 소용돌이친다
      ctx.fillStyle = '#e04b6a';
      for (let i = 0; i < 7; i++) {
        const a = clk * 1.3 + i * 0.9, rr = (26 + (i % 3) * 10) * s;
        ctx.globalAlpha = 0.16 + (i % 2) * 0.08;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * rr, -38 * s + Math.sin(a * 1.4) * 22 * s, 18 * s, 10 * s, a, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (f.shadow) {                                        // 4.6 그림자 분신: 보랏빛 연기가 몸을 감고 피어오른다
      ctx.fillStyle = '#7a3ab8';
      for (let i = 0; i < 5; i++) {
        const k = ((clk * 0.7 + i / 5) % 1);
        ctx.globalAlpha = 0.28 * (1 - k);
        ctx.beginPath(); ctx.arc(Math.sin(i * 2.3 + clk) * 12 * s, -(8 + k * 70) * s, (7 + k * 9) * s, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 0.5 + Math.sin(clk * 4) * 0.15;
      ctx.strokeStyle = '#c06aff'; ctx.lineWidth = 1.8 * s;
      ctx.beginPath(); ctx.ellipse(0, 1, 26 * s, 7 * s, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (f.reflectT > 0) {                                  // 반사 결계: 보랏빛 육각 막
      const pulse = 0.85 + Math.sin(clk * 8) * 0.15;
      ctx.globalAlpha = 0.28 * pulse;
      ctx.fillStyle = '#b784e0';
      ctx.beginPath(); ctx.ellipse(0, -40 * s, 44 * s, 56 * s, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#e8d0ff'; ctx.lineWidth = 2 * s;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 + clk * 0.8; const px = Math.cos(a) * 46 * s, py = -40 * s + Math.sin(a) * 58 * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (f.exposedT > 0) {                                  // 약점 노출: 핵 자리에 금빛 과녁
      const pulse = 0.75 + Math.sin(clk * 10) * 0.25;
      ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 3 * s;
      ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.arc(0, -40 * s, 22 * s * (1.1 - pulse * 0.2), 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -40 * s, 10 * s, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (f.enraged || f.furious) {                          // 광폭화·격노한 보스의 붉은 기운
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
    if (moving && !vehicle) {                              // 발자국 먼지: 발이 닿을 때마다 뒤로 퍼진다 (탈것은 스스로 먼지를 낸다)
      const ph = ((f.bob / Math.PI) % 1 + 1) % 1;
      const big = f.scale >= 1.3 || f.boss ? 1.8 : (f.s.speed > 70 ? 1.2 : 0.8);
      ctx.fillStyle = 'rgba(235,225,205,' + ((1 - ph) * 0.3 * Math.min(1, big)) + ')';
      ctx.beginPath();
      ctx.ellipse(-(6 + ph * 14) * s, -1.5 * s, (3 + ph * 6) * s * big, (1.6 + ph * 2) * s * big, 0, 0, 7);
      ctx.fill();
    }
    // Keep the ground shadow stable while the body strides, recoils and attacks.
    ctx.save();
    const stride = moving && !vehicle ? Math.abs(Math.sin(f.bob)) : 0;
    const recoil = Math.min(1, f.hitFlash / 0.18);
    const heavy = f.scale >= 1.3 || f.boss;
    // 걸을 때는 앞으로 기울이고(빠를수록 더), 큰 몸은 좌우로 흔들린다
    const lean = moving && !vehicle ? (f.s.speed > 70 ? 0.11 : 0.05) : 0;
    const sway = vehicle ? 0 : moving && heavy ? Math.sin(f.bob) * 0.05 : (moving ? Math.sin(f.bob) * 0.025 : 0);
    // 치는 순간 앞으로 숙였다가, 준비할 땐 뒤로 젖힌다
    const strike = atk * (style === 'heavy' ? 0.16 : style === 'thrust' ? 0.08 : style === 'shoot' ? -0.05 : 0.1);
    ctx.translate(-recoil * 2.5 * s - wind * 2 * s, -stride * (heavy ? 1.2 : 2.4) * s);
    // 기절하면 휘청이고, 둔화되면 몸이 굳어 흔들림이 준다
    const dizzy = f.stunT > 0 ? Math.sin(clk * 9) * 0.09 : 0;
    ctx.rotate(lean + sway + strike + dizzy - wind * 0.1 - recoil * 0.06 - kbK * 0.35 + (tired && !moving ? 0.07 : 0));
    // 맞으면 잠깐 눌렸다가 돌아온다, 준비 동작은 살짝 움츠리고, 치는 순간은 늘어난다
    const squash = recoil * 0.07 + wind * 0.04;
    const stretch = atk > 0.35 && (style === 'thrust' || style === 'heavy') ? (atk - 0.35) * 0.09 : 0;
    if (squash > 0) ctx.scale(1 + squash, 1 - squash);
    else if (stretch > 0) ctx.scale(1 + stretch, 1 - stretch * 0.5);
    // 눈 깜빡임(3~4초에 한 번), 싸울 때는 눈썹이 선다
    MODEL.blink = ((clk * 0.9) % 3.7) < 0.13 && f.stunT <= 0;
    MODEL.angry = f.engaged || atk > 0 || wind > 0;
    MODEL.time = clk;
    // 3.2 이벤트 보스: 안개화 중엔 반투명
    // 4.11 홀림불: 가까이 다가가기 전엔 흐릿하다 (멀리서 쏠 수 없다는 표시)
    const veiled = f.veilT > 0 || (f.ab.glamour && !f.unveiled);
    const alpha0 = ctx.globalAlpha;                   // 4.18: 출진 중 서서히 나타나는 투명도를 지우지 않게
    if (veiled) ctx.globalAlpha *= (f.veilT > 0 ? 0.32 : 0.4) + Math.sin(clk * 6) * 0.06;
    drawBody(ctx, f.s, s, false, f.kbTimer > 0, f.bob, moving, atk, wind, won);
    if (veiled) ctx.globalAlpha = alpha0;
    MODEL.blink = false; MODEL.angry = false;
    // 맞은 순간의 흰 번쩍임은 몸을 한 번 더 그린다. 빽빽할 땐(자동 품질) 건너뛴다 — 움찔(recoil)과 피해 숫자로 충분하다
    if (f.hitFlash > 0 && !this.crowded) {
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * Math.min(0.5, f.hitFlash * 3.2);
      drawBody(ctx, f.s, s, true, f.kbTimer > 0, f.bob, moving, atk, wind, won);
      ctx.globalAlpha = a0;
    }
    ctx.restore();

    ctx.restore();

    // 3.5: 모습이 바뀐 진화 병종은 몸 둘레로 금빛 불티가 천천히 떠오른다 (절전·느린 기기에선 생략)
    if (f.s.bigEvo && this.fxq >= 0.5) {
      const col = f.s.accent || '#ffe28a';
      ctx.fillStyle = col;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const q = ((clk * 0.45 + i * 0.25) % 1);
        const px = x + Math.sin(clk * 1.7 + i * 2.3) * 16 * s, py = y - 8 * s - q * 62 * s;
        ctx.globalAlpha = Math.sin(q * Math.PI) * 0.75;
        ctx.fillRect(px - 1.3 * s, py - 1.3 * s, 2.6 * s, 2.6 * s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    const bw = 32 * s;
    if (f.hp < f.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      rectPath(ctx, x - bw / 2, y - top, bw, 5 * s); ctx.fill();
      ctx.fillStyle = f.side === 'ally' ? '#4fa3e0' : '#c0392b';
      rectPath(ctx, x - bw / 2, y - top, bw * (f.hp / f.maxHp), 5 * s); ctx.fill();
    }
    // 엄호 없는 원거리 아군: 머리 위 주황 느낌표 (조준이 흐트러져 약하다)
    if (f.exposed && f.side === 'ally' && f.s.ranged) {
      const ey = y - top - 14 * s + Math.sin((this.clock || 0) * 5 + (f._seed || 0)) * 1.5 * s;
      ctx.fillStyle = '#ff9f43'; ctx.strokeStyle = 'rgba(12,16,24,.85)'; ctx.lineWidth = 1.2 * s;
      ctx.beginPath(); ctx.arc(x, ey, 5 * s, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1c1612'; ctx.fillRect(x - 0.9 * s, ey - 3.2 * s, 1.8 * s, 4 * s); ctx.fillRect(x - 0.9 * s, ey + 1.5 * s, 1.8 * s, 1.6 * s);
    }
    // 기절 면역(금빛)·저항(은빛) 표식: 체력바 왼쪽 작은 방패
    if (f.side === 'enemy' && (f.ab.stunImmune || f.ab.stunResist > 0)) {
      const bx = x - bw / 2 - 6 * s, by = y - top + 2 * s;
      ctx.fillStyle = f.ab.stunImmune ? '#f0c24a' : '#c8ced6';
      ctx.strokeStyle = 'rgba(12,16,24,.85)'; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(bx - 3.2 * s, by - 3.5 * s); ctx.lineTo(bx + 3.2 * s, by - 3.5 * s);
      ctx.lineTo(bx + 3.2 * s, by); ctx.lineTo(bx, by + 3.8 * s); ctx.lineTo(bx - 3.2 * s, by); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 전설·신화 표식: 머리 위 작은 마름모. 액티브가 준비되면 반짝이며 커진다.
    if (f.s.active && f.side === 'ally' && !f.summoned) {
      const ready = this._battle && this._battle.canHeroActive(f.s.id);
      const pulse = ready ? 1 + Math.sin((this.clock || 0) * 6) * 0.18 : 0.8;
      const my = y - top - 10 * s, r = 5 * s * pulse;
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
      const tk = top / (72 * s);
      ctx.beginPath(); ctx.ellipse(x, y - 30 * s * tk, 22 * s * wk, 34 * s * tk, 0, 0, 7); ctx.stroke();
    }
    if (f.ab.thorns) {
      ctx.strokeStyle='#efb388';ctx.lineWidth=1.7*s;
      for(let i=0;i<4;i++) { const yy=y-(18+i*10)*s;
        ctx.beginPath();ctx.moveTo(x+f.dir*17*s*wk,yy);ctx.lineTo(x+f.dir*(17*wk+8)*s,yy-5*s);ctx.stroke(); }
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
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 15 * s, y - top - 12 * s + Math.sin(a) * 4 * s, 2.2 * s, 0, 7); ctx.fill();
      }
    }
    if (f.burnT > 0) statusDot(ctx, x - 16 * s, y - top - 8 * s, s, '#ff984f');
    if (f.hasteT > 0) statusDot(ctx, x + 16 * s, y - top - 8 * s, s, '#f7e0a0');
    if (f.poisonT > 0) statusDot(ctx, x - 8 * s, y - top - 8 * s, s, '#9de08e');
    if (f.slowT > 0) statusDot(ctx, x, y - top - 8 * s, s, '#8fd8ff');
    if (f.stunT > 0) statusDot(ctx, x + 8 * s, y - top - 8 * s, s, '#ffd166');
    if (f.weakT > 0) statusDot(ctx, x - 24 * s, y - top - 8 * s, s, '#c77dff');
    if (f.charmT > 0) heart(ctx, x, y - top - 18 * s + Math.sin(f.bob * 3) * 2 * s, 5 * s, '#ff7ab8');
    const clk2 = (this.clock || 0) + (f._seed || 0);
    if (f.burnT > 0) {                                     // 몸에 붙은 불길
      for (let i = 0; i < 3; i++) {
        const k = (clk2 * 1.8 + i / 3) % 1, fx = x + (i - 1) * 7 * s, fy = y - (14 + i * 12) * s - k * 14 * s;
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.fillStyle = k < 0.5 ? '#ffb347' : '#ff6a2a';
        ctx.beginPath(); ctx.ellipse(fx, fy, 4.5 * s * (1 - k * 0.5), 7.5 * s * (1 - k * 0.4), 0, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (f.poisonT > 0) {                                   // 독 거품
      ctx.fillStyle = '#9de08e';
      for (let i = 0; i < 3; i++) {
        const k = (clk2 * 0.9 + i / 3) % 1;
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.beginPath(); ctx.arc(x + Math.sin(clk2 * 3 + i * 2) * 9 * s, y - (22 + k * 40) * s, (1.4 + k * 1.6) * s, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (f.slowT > 0) {                                     // 서리: 발밑 얼음과 도는 눈송이
      ctx.fillStyle = 'rgba(190,235,255,.45)';
      ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 18 * s, 4 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#dff6ff';
      for (let i = 0; i < 2; i++) {
        const a2 = clk2 * 2 + i * Math.PI;
        ctx.fillRect(x + Math.cos(a2) * 16 * s - 1.2 * s, y - 30 * s + Math.sin(a2) * 10 * s - 1.2 * s, 2.4 * s, 2.4 * s);
      }
    }
    if (f.spin > 0.05) {                                   // 예열: 굴뚝 위 열기 막대
      ctx.fillStyle = 'rgba(0,0,0,.4)'; rectPath(ctx, x - 16 * s, y - top - 8 * s, 32 * s, 3 * s); ctx.fill();
      ctx.fillStyle = '#ff8c42'; rectPath(ctx, x - 16 * s, y - top - 8 * s, 32 * s * Math.min(1, f.spin / f.ab.spinup.max), 3 * s); ctx.fill();
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

  /* 4.3 3진 투사체 (전차 포탄 · 내리꽂히는 드론). 그렸으면 true */
  drawShot3(ctx, cs, shot, sh, p) {
    const ink = 'rgba(12,16,24,.8)';
    if (shot === 'shell') {                       // 전차 포탄: 주황 예광 꼬리 · 구리 띠
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,170,60,.55)'; ctx.beginPath(); ctx.moveTo(-6 * cs, -2.6 * cs); ctx.lineTo(-30 * cs, 0); ctx.lineTo(-6 * cs, 2.6 * cs); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,.8)'; ctx.beginPath(); ctx.moveTo(-6 * cs, -1.2 * cs); ctx.lineTo(-18 * cs, 0); ctx.lineTo(-6 * cs, 1.2 * cs); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#4a4c54'; ctx.beginPath(); ctx.moveTo(-8 * cs, -3.6 * cs); ctx.lineTo(4 * cs, -3.6 * cs);
      ctx.quadraticCurveTo(12 * cs, 0, 4 * cs, 3.6 * cs); ctx.lineTo(-8 * cs, 3.6 * cs); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 1 * cs; ctx.stroke();
      ctx.fillStyle = '#c87a3a'; ctx.fillRect(-4.5 * cs, -3.6 * cs, 2.6 * cs, 7.2 * cs);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-7 * cs, -3 * cs, 10 * cs, 1.2 * cs);
      return true;
    }
    if (shot === 'snowball') {                    // 4.4 빙수 눈덩이: 흰 공 · 분홍 시럽 · 흩날리는 눈가루
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff';
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(-i * 6 * cs, Math.sin(i * 2 + p * 9) * 2 * cs, (2.4 - i * 0.5) * cs, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#fbfdff'; ctx.beginPath(); ctx.arc(0, 0, 6 * cs, 0, 7); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 1 * cs; ctx.stroke();
      ctx.fillStyle = sh.color; ctx.beginPath(); ctx.arc(1.5 * cs, -2 * cs, 3.4 * cs, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#e8203a'; ctx.beginPath(); ctx.arc(1.5 * cs, -5.2 * cs, 1.5 * cs, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(160,200,230,.6)'; ctx.beginPath(); ctx.arc(-1.5 * cs, 2.5 * cs, 1 * cs, 0, 7); ctx.fill();
      return true;
    }
    if (shot === 'rail') {                        // 4.4 레일건 탄: 길게 끌리는 푸른 빛 · 감기는 나선 · 하얀 심
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = sh.color; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.moveTo(4 * cs, -3.5 * cs); ctx.lineTo(-60 * cs, 0); ctx.lineTo(4 * cs, 3.5 * cs); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = sh.color; ctx.lineWidth = 1.2 * cs; ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const u = -i * 3.4 * cs, v = Math.sin(i * 1.2 + p * 30) * (4 - i * 0.2) * cs; i ? ctx.lineTo(u, v) : ctx.moveTo(u, v); }
      ctx.stroke();
      ctx.fillStyle = '#f4feff'; ctx.beginPath(); ctx.ellipse(0, 0, 9 * cs, 2 * cs, 0, 0, 7); ctx.fill();
      ctx.restore();
      return true;
    }
    if (shot === 'solar') {                       // 4.7 태양 위성: 작은 태양 · 도는 빛살
      const t = this.clock || 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,170,50,.35)'; ctx.beginPath(); ctx.arc(0, 0, 11 * cs, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,90,.8)'; ctx.lineWidth = 1.4 * cs;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + t * 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6 * cs, Math.sin(a) * 6 * cs); ctx.lineTo(Math.cos(a) * 11 * cs, Math.sin(a) * 11 * cs); ctx.stroke(); }
      ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(0, 0, 5 * cs, 0, 7); ctx.fill();
      ctx.restore();
      return true;
    }
    if (shot === 'star') {                        // 4.18 별의 대현자: 꼬리를 길게 끄는 금빛 별똥별 · 도는 오각 별 · 흩어지는 별가루
      const t = this.clock || 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, 0, -46 * cs, 0); g.addColorStop(0, 'rgba(255,230,150,.85)'); g.addColorStop(0.5, 'rgba(200,150,255,.4)'); g.addColorStop(1, 'rgba(200,150,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -6 * cs); ctx.quadraticCurveTo(-24 * cs, -3 * cs, -46 * cs, 0); ctx.quadraticCurveTo(-24 * cs, 3 * cs, 0, 6 * cs); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff6c8'; for (let i = 0; i < 5; i++) { const q = ((t * 3 + i * 0.2) % 1); ctx.globalAlpha = 1 - q; ctx.fillRect((-8 - q * 34) * cs, (Math.sin(i * 2.3 + t * 9) * 5 * q) * cs, 1.8 * cs, 1.8 * cs); }
      ctx.globalAlpha = 0.35; ctx.fillStyle = sh.color; ctx.beginPath(); ctx.arc(0, 0, 12 * cs, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.rotate(t * 8); ctx.fillStyle = '#ffd76a'; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 2.8 : 7) * cs; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 2.2 * cs, 0, 7); ctx.fill();
      ctx.restore();
      return true;
    }
    if (shot === 'plasma') {                      // 4.18 플라즈마 포탄: 하얀 심 · 푸른 플라즈마 덩어리 · 감기는 전기 고리 · 짧은 이온 꼬리
      const t = this.clock || 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(90,216,255,.45)'; ctx.beginPath(); ctx.moveTo(-4 * cs, -5 * cs); ctx.lineTo(-38 * cs, 0); ctx.lineTo(-4 * cs, 5 * cs); ctx.closePath(); ctx.fill();
      ctx.fillStyle = sh.color; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(0, 0, 13 * cs, 9 * cs, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#c8f6ff'; ctx.beginPath(); ctx.ellipse(1 * cs, 0, 7 * cs, 5 * cs, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(2 * cs, 0, 2.6 * cs, 0, 7); ctx.fill();
      ctx.strokeStyle = '#e8fcff'; ctx.lineWidth = 1 * cs;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 10 * cs, 4 * cs, t * 14 + i * 1.6, 0, 7); ctx.stroke(); }
      ctx.restore();
      return true;
    }
    if (shot === 'missile') {                     // 4.18 소형 미사일: 흰 몸통 · 붉은 탄두 · 꼬리 날개 · 불꽃과 연기 꼬리
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,190,90,.85)'; ctx.beginPath(); ctx.moveTo(-7 * cs, -2 * cs); ctx.lineTo(-17 * cs - Math.random() * 3 * cs, 0); ctx.lineTo(-7 * cs, 2 * cs); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(200,200,200,.35)'; for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(-(14 + i * 7) * cs, Math.sin(i * 1.7) * 2 * cs, (1.6 + i * 0.9) * cs, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#e8ecf0'; ctx.fillRect(-7 * cs, -1.8 * cs, 12 * cs, 3.6 * cs);
      ctx.fillStyle = '#e04a3a'; ctx.beginPath(); ctx.moveTo(5 * cs, -1.8 * cs); ctx.lineTo(10 * cs, 0); ctx.lineTo(5 * cs, 1.8 * cs); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a6270'; ctx.beginPath(); ctx.moveTo(-7 * cs, -1.8 * cs); ctx.lineTo(-10 * cs, -4.4 * cs); ctx.lineTo(-4 * cs, -1.8 * cs); ctx.moveTo(-7 * cs, 1.8 * cs); ctx.lineTo(-10 * cs, 4.4 * cs); ctx.lineTo(-4 * cs, 1.8 * cs); ctx.fill();
      return true;
    }
    if (shot === 'holo') {                        // 4.7 홀로그램 대마도사: 도는 육각 룬 구슬
      const t = this.clock || 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = sh.color; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(0, 0, 10 * cs, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.95; ctx.strokeStyle = sh.color; ctx.lineWidth = 1.4 * cs;
      ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 + t * 5; const px = Math.cos(a) * 8 * cs, py = Math.sin(a) * 8 * cs; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
      ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(0, 0, 3.2 * cs, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.fillStyle = sh.color; for (let i = 1; i <= 3; i++) ctx.fillRect(-i * 7 * cs, (i % 2 ? -1 : 1) * 2 * cs, 3 * cs, 1.4 * cs);
      ctx.restore();
      return true;
    }
    if (shot === 'laser') {                       // 4.7 레이저 활: 곧게 뻗은 빛 화살 · 초승달 촉
      ctx.rotate(sh.dir > 0 ? -(p - 0.5) * 1.4 : Math.PI + (p - 0.5) * 1.4);   // 포물선 회전을 되돌려 곧게
      if (sh.dir < 0) ctx.scale(-1, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = sh.color; ctx.globalAlpha = 0.4; ctx.fillRect(-46 * cs, -2.6 * cs, 50 * cs, 5.2 * cs);
      ctx.globalAlpha = 1; ctx.fillStyle = '#f4feff'; ctx.fillRect(-40 * cs, -0.9 * cs, 46 * cs, 1.8 * cs);
      ctx.strokeStyle = sh.color; ctx.lineWidth = 1.6 * cs; ctx.beginPath(); ctx.arc(2 * cs, 0, 5 * cs, -1.2, 1.2); ctx.stroke();
      ctx.restore();
      return true;
    }
    if (shot === 'drone') {                       // 내리꽂히는 드론: 앞으로 기운 기체 · 도는 날개 · 붉은 불 · 매단 미사일
      ctx.rotate(sh.dir > 0 ? -(p - 0.5) * 1.4 : Math.PI + (p - 0.5) * 1.4);    // 궤적 회전을 되돌리고
      ctx.rotate((sh.dir > 0 ? 1 : -1) * (0.25 + p * 0.5));                         // 앞으로 숙인다
      if (sh.dir < 0) ctx.scale(-1, 1);
      const t = this.clock || 0;
      ctx.strokeStyle = '#2a3038'; ctx.lineWidth = 1.6 * cs;
      ctx.beginPath(); ctx.moveTo(-9 * cs, -3 * cs); ctx.lineTo(9 * cs, -3 * cs); ctx.stroke();
      for (const d of [-1, 1]) {
        ctx.fillStyle = 'rgba(230,240,250,.5)'; ctx.beginPath(); ctx.ellipse(d * 9 * cs, -6 * cs, 7 * cs, 1.2 * cs, 0, 0, 7); ctx.fill();
        const w = Math.cos(t * 60 + d) * 6.5 * cs;
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.8 * cs; ctx.beginPath(); ctx.moveTo(d * 9 * cs - w, -6 * cs); ctx.lineTo(d * 9 * cs + w, -6 * cs); ctx.stroke();
      }
      ctx.fillStyle = '#3a4654'; ctx.beginPath(); roundRectPath(ctx, -6 * cs, -4.4 * cs, 12 * cs, 5.6 * cs, 2.4 * cs); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 0.9 * cs; ctx.stroke();
      ctx.fillStyle = sh.color; ctx.fillRect(-4.4 * cs, -3.6 * cs, 8.8 * cs, 1.3 * cs);
      ctx.fillStyle = '#d8dce4'; ctx.fillRect(-4 * cs, 1.6 * cs, 9 * cs, 2 * cs);                       // 미사일
      ctx.fillStyle = '#e8403a'; ctx.beginPath(); ctx.moveTo(5 * cs, 1.6 * cs); ctx.lineTo(8 * cs, 2.6 * cs); ctx.lineTo(5 * cs, 3.6 * cs); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,74,74,.9)'; ctx.beginPath(); ctx.arc(-5 * cs, -1.2 * cs, 1.2 * cs, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,74,74,.3)'; ctx.beginPath(); ctx.arc(-5 * cs, -1.2 * cs, 3.4 * cs, 0, 7); ctx.fill();
      ctx.restore();
      return true;
    }
    return false;
  }

  drawShots(battle) {
    const ctx = this.ctx, cs = this.cs;
    for (const s of battle.shots) {
      if (s.t < 0) continue;                       // 4.18 미사일은 차례로 솟는다 (아직 안 쏜 것)
      const p = s.t / s.dur, arcH = (s.missile ? 150 : 60) * cs;
      const wx = s.x + (s.tx - s.x) * p;
      const x = this.screenX(wx);
      const y = this.rowY(s.y0) - 36 * cs - Math.sin(p * Math.PI) * arcH;
      // A short trajectory trail makes both sides' projectiles readable at 3x speed.
      ctx.save();
      ctx.strokeStyle = s.color; ctx.lineWidth = (s.area ? 4 : 2) * cs;
      ctx.globalAlpha = 0.32;
      const tail = Math.max(0, p - 0.1);
      ctx.beginPath();
      ctx.moveTo(this.screenX(s.x + (s.tx - s.x) * tail), this.rowY(s.y0) - 36 * cs - Math.sin(tail * Math.PI) * arcH);
      ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      const tiltK = s.missile ? 2.6 : 1.4;
      ctx.rotate(s.dir > 0 ? (p - 0.5) * tiltK : Math.PI - (p - 0.5) * tiltK);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.4 * cs; ctx.lineCap = 'round';
      const magic = s.src && s.src.s && (s.src.s.rarity === 'UR' || s.src.s.rarity === 'SSR' || s.src.s.castFx);
      const shape = s.src && s.src.s && s.src.s.shape;
      const shot = s.missile ? 'missile' : s.src && s.src.s && s.src.s.shot;   // 4.1 3진: 투사체도 바뀐다 · 4.18 미사일
      if (shot && this.drawShot3(ctx, cs, shot, s, p)) { /* 그렸다 */ }
      else if (s.bossThrow) {                  // 4.12 근접 보스가 던진 기운 덩어리: 어두운 돌 · 보스 색 불꽃 테
        ctx.rotate(this.clock * 9);
        ctx.fillStyle = s.color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0, 0, 13 * cs, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#3a3036'; ctx.beginPath();
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, r = (7.5 + (i % 2) * 2) * cs; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.strokeStyle = s.color; ctx.lineWidth = 2 * cs; ctx.stroke();
      }
      else if (shape === 'javelin') {          // 투창: 긴 나무 자루와 넓은 창끝
        ctx.strokeStyle = 'rgba(12,16,24,.8)'; ctx.lineWidth = 4.2 * cs;
        ctx.beginPath(); ctx.moveTo(-20 * cs, 0); ctx.lineTo(12 * cs, 0); ctx.stroke();
        ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2.4 * cs;
        ctx.beginPath(); ctx.moveTo(-20 * cs, 0); ctx.lineTo(12 * cs, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20 * cs, 0); ctx.lineTo(10 * cs, -4.4 * cs); ctx.lineTo(10 * cs, 4.4 * cs); ctx.closePath();
        ctx.fillStyle = '#d6dbe0'; ctx.fill(); ctx.strokeStyle = 'rgba(12,16,24,.8)'; ctx.lineWidth = 1 * cs; ctx.stroke();
      } else if (shape === 'falconer') {  // 매: 날개를 접고 내리꽂힌다
        const fl = Math.sin(this.clock * 30) * 0.6;
        ctx.fillStyle = '#6b4a2e';
        ctx.beginPath(); ctx.moveTo(-2 * cs, 0); ctx.lineTo(-12 * cs, -6 * cs - fl * 6 * cs); ctx.lineTo(4 * cs, -1 * cs); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a6a44'; ctx.beginPath(); ctx.ellipse(0, 0, 7 * cs, 3.4 * cs, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(6 * cs, -1 * cs, 2.6 * cs, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.moveTo(8 * cs, -1.6 * cs); ctx.lineTo(11 * cs, 0); ctx.lineTo(8 * cs, 0.6 * cs); ctx.fill();
        ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.moveTo(-1 * cs, 1 * cs); ctx.lineTo(-10 * cs, 4 * cs + fl * 6 * cs); ctx.lineTo(3 * cs, 2 * cs); ctx.closePath(); ctx.fill();
      } else if (shape === 'axethrower') { // 4.9 손도끼: 빙글빙글 돌며 난다
        ctx.rotate(p * 18);
        ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 2.4 * cs; ctx.beginPath(); ctx.moveTo(-7 * cs, 0); ctx.lineTo(6 * cs, 0); ctx.stroke();
        ctx.fillStyle = '#c8ccd4'; ctx.beginPath(); ctx.moveTo(4 * cs, -1.5 * cs); ctx.lineTo(10 * cs, -6 * cs); ctx.quadraticCurveTo(12 * cs, 0, 10 * cs, 5 * cs); ctx.lineTo(4 * cs, 1.5 * cs); ctx.closePath(); ctx.fill();
      } else if (shape === 'siegebow') {   // 4.9 발리스타: 창만 한 화살
        ctx.strokeStyle = 'rgba(12,16,24,.8)'; ctx.lineWidth = 5 * cs; ctx.beginPath(); ctx.moveTo(-26 * cs, 0); ctx.lineTo(14 * cs, 0); ctx.stroke();
        ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 3 * cs; ctx.beginPath(); ctx.moveTo(-26 * cs, 0); ctx.lineTo(14 * cs, 0); ctx.stroke();
        ctx.fillStyle = '#d8dce4'; ctx.beginPath(); ctx.moveTo(24 * cs, 0); ctx.lineTo(12 * cs, -5 * cs); ctx.lineTo(12 * cs, 5 * cs); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.moveTo(-26 * cs, 0); ctx.lineTo(-32 * cs, -5 * cs); ctx.lineTo(-22 * cs, 0); ctx.lineTo(-32 * cs, 5 * cs); ctx.closePath(); ctx.fill();
      } else if (shape === 'zhugeliang') { // 4.15 제갈량: 빙글 도는 바람 칼날 (와룡 선생은 불씨를 싣는다)
        ctx.rotate(p * 16);
        ctx.strokeStyle = 'rgba(232,246,255,.9)'; ctx.lineWidth = 2.4 * cs;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, (5 + i * 2.6) * cs, i * 2.1, i * 2.1 + 2); ctx.stroke(); }
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(0, 0, 2.6 * cs, 0, 7); ctx.fill();
      } else if (shape === 'miko') {       // 4.9 무녀: 팔랑이는 부적
        ctx.rotate(Math.sin(p * 20) * 0.5);
        ctx.fillStyle = '#fbf6e8'; ctx.fillRect(-5 * cs, -3 * cs, 10 * cs, 6 * cs);
        ctx.fillStyle = '#e8505a'; ctx.fillRect(-3 * cs, -1.6 * cs, 6 * cs, 0.9 * cs); ctx.fillRect(-0.5 * cs, -2.6 * cs, 0.9 * cs, 5.2 * cs);
      } else if (shape === 'alchemist') { // 연금 플라스크: 빙글빙글 돌며 난다
        ctx.rotate(p * 12);
        ctx.fillStyle = '#d8e8e0'; ctx.fillRect(-1.5 * cs, -9 * cs, 3 * cs, 5 * cs);
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(0, 0, 5.5 * cs, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(12,16,24,.8)'; ctx.lineWidth = 1 * cs; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-1.6 * cs, -1.6 * cs, 1.6 * cs, 0, 7); ctx.fill();
      } else if (s.area || magic) {       // 마법탄·폭탄: 빛나는 구슬 + 후광
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
      } else {                            // 화살: 나무 자루 · 쇠 촉 · 색 깃 (2.8: 잉크 테두리)
        ctx.strokeStyle = 'rgba(12,16,24,.8)'; ctx.lineWidth = 3.8 * cs;
        ctx.beginPath(); ctx.moveTo(-10 * cs, 0); ctx.lineTo(8 * cs, 0); ctx.stroke();
        ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2 * cs;
        ctx.beginPath(); ctx.moveTo(-10 * cs, 0); ctx.lineTo(8 * cs, 0); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(13 * cs, 0); ctx.lineTo(6 * cs, -3.6 * cs); ctx.lineTo(7.5 * cs, 0); ctx.lineTo(6 * cs, 3.6 * cs);
        ctx.closePath(); ctx.fillStyle = '#d6dbe0'; ctx.fill();
        ctx.strokeStyle = 'rgba(12,16,24,.8)'; ctx.lineWidth = 1 * cs; ctx.stroke();
        ctx.fillStyle = s.color;
        for (const k of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(-5 * cs, 0); ctx.lineTo(-11 * cs, k * 4 * cs); ctx.lineTo(-13 * cs, k * 3.4 * cs); ctx.lineTo(-9 * cs, 0);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  drawFx(battle) {
    const ctx = this.ctx, cs = this.cs;
    const W = this.w, zoom = this.zoom;
    for (const e of battle.fx) {
      const p = e.t / e.life;
      const x = this.screenX(e.x);
      // 4.18: 한 점에 그리는 연출은 화면 밖이면 건너뛴다 (두 점 · 화면 전체 · GL 을 한 번 쏘는 연출은 제외)
      if (FX_LOCAL[e.type] && (x < -320 - (e.r || 0) * zoom || x > W + 320 + (e.r || 0) * zoom)) continue;
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
        }else if(e.kind==='staff'){                  // 여의봉: 하늘에서 내리꽂히는 거대한 봉
          const drop=Math.min(1,k*3.2),top=-260*cs*(1-drop)-40*cs;
          ctx.globalAlpha=Math.min(1,p*1.6);ctx.fillStyle='#b8322e';ctx.fillRect(-9*cs,top-150*cs,18*cs,150*cs);
          ctx.fillStyle='#ffd24a';ctx.fillRect(-11*cs,top-160*cs,22*cs,14*cs);ctx.fillRect(-11*cs,top-6*cs,22*cs,14*cs);
          ctx.fillStyle='rgba(244,241,232,.55)';for(let i=0;i<6;i++){const a=i/6*Math.PI*2+k;ctx.beginPath();ctx.arc(Math.cos(a)*radius*.6*drop,Math.sin(a)*radius*.14,(14+k*16)*cs,0,7);ctx.fill();}
          ctx.fillStyle=e.color;
        }else if(e.kind==='skybind'){                // 혼천릉: 적을 휘감아 끌어모으는 붉은 비단
          ctx.strokeStyle='#d8453a';ctx.lineWidth=5*cs;ctx.globalAlpha=Math.min(1,p*1.5);
          for(let j=0;j<3;j++){ctx.beginPath();for(let i=0;i<=24;i++){const t2=i/24,a=t2*Math.PI*3+j*2.1+k*4,rr=radius*(1-t2*.85)*(1-k*.3);
            const xx=Math.cos(a)*rr,yy=-45*cs+Math.sin(a)*rr*.3-t2*20*cs;if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}ctx.stroke();}
          ctx.strokeStyle=e.color;
        }else if(e.kind==='excalibur'){              // 엑스칼리버: 하늘에서 꽂히는 거대한 성검
          const drop=Math.min(1,k*3.4),tip=-30*cs*(1-drop)-(1-drop)*240*cs;
          ctx.globalAlpha=Math.min(1,p*1.6);
          ctx.fillStyle='rgba(255,236,160,.28)';ctx.fillRect(-24*cs,-300*cs,48*cs,300*cs);
          ctx.fillStyle='#eef3ff';ctx.beginPath();ctx.moveTo(0,tip);ctx.lineTo(-10*cs,tip-20*cs);ctx.lineTo(-10*cs,tip-170*cs);ctx.lineTo(10*cs,tip-170*cs);ctx.lineTo(10*cs,tip-20*cs);ctx.closePath();ctx.fill();
          ctx.fillStyle='#ffd24a';ctx.fillRect(-34*cs,tip-180*cs,68*cs,10*cs);ctx.fillRect(-5*cs,tip-215*cs,10*cs,36*cs);
          ctx.beginPath();ctx.arc(0,tip-220*cs,8*cs,0,7);ctx.fill();
          ctx.strokeStyle='#fff6c8';ctx.lineWidth=3*cs;
          for(let i=0;i<10;i++){const a=i/10*Math.PI*2+k;ctx.beginPath();ctx.moveTo(Math.cos(a)*20*cs,-20*cs+Math.sin(a)*8*cs);ctx.lineTo(Math.cos(a)*radius*drop,-20*cs+Math.sin(a)*radius*.22*drop);ctx.stroke();}
          ctx.fillStyle=e.color;ctx.strokeStyle=e.color;
        }else if(e.kind==='astral'){                 // 4.18 별의 심판: 하늘에 펼쳐진 별자리에서 별 다섯이 내리꽂히고 땅에 거대한 별 문양
          const q=Math.min(1,k*2.4);ctx.globalAlpha=Math.min(1,p*1.6);ctx.lineWidth=2*cs;
          const sky=-190*cs,pts=[];for(let i=0;i<5;i++){const b=-Math.PI/2+i*Math.PI*2/5;pts.push([Math.cos(b)*radius*.7,sky+Math.sin(b)*36*cs]);}
          ctx.strokeStyle='#ffd76a';ctx.beginPath();pts.concat([pts[0]]).forEach(([px,py],i)=>{if(i/5>q)return;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.stroke();
          pts.forEach(([px,py],i)=>{const d=Math.max(0,Math.min(1,(k-.25-i*.06)*3));ctx.strokeStyle='#fff6c8';ctx.lineWidth=(4*(1-d)+1)*cs;
            if(d>0){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px*(1-d)*.4+px*.6,py+(-py)*d);ctx.stroke();}
            ctx.fillStyle='#fff6c8';ctx.beginPath();ctx.arc(px,py,3*cs,0,7);ctx.fill();});
          ctx.strokeStyle=e.color;ctx.lineWidth=3*cs;ctx.beginPath();
          for(let i=0;i<=5;i++){const b=-Math.PI/2+i*Math.PI*4/5+k*.6;const px=Math.cos(b)*radius*.85*q,py=Math.sin(b)*radius*.2*q;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();
          ctx.fillStyle=e.color;ctx.strokeStyle=e.color;
        }else if(e.kind==='dragonblade'){            // 4.15 청룡언월 일섬: 땅을 가르는 거대한 초승달 · 그 위를 휘감는 청룡
          const sw=Math.min(1,k*3);ctx.globalAlpha=Math.min(1,p*1.6);ctx.lineWidth=12*cs*(1-k*.5);
          ctx.beginPath();ctx.arc(0,-30*cs,radius*.8,-Math.PI*.95,-Math.PI*.95+Math.PI*.9*sw);ctx.stroke();
          ctx.strokeStyle='#ffffff';ctx.lineWidth=3*cs;ctx.beginPath();ctx.arc(0,-30*cs,radius*.76,-Math.PI*.9,-Math.PI*.9+Math.PI*.8*sw);ctx.stroke();
          ctx.strokeStyle=e.color;ctx.lineWidth=7*cs;ctx.beginPath();
          for(let i=0;i<=30;i++){const u=i/30,a=-Math.PI+u*Math.PI*sw,rr=radius*(.45+.15*Math.sin(u*12+k*8));const xx=Math.cos(a)*rr,yy=-40*cs+Math.sin(a)*rr*.55;if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}
          ctx.stroke();
          const ha=-Math.PI+Math.PI*sw,hx=Math.cos(ha)*radius*.5,hy=-40*cs+Math.sin(ha)*radius*.28;
          ctx.beginPath();ctx.ellipse(hx,hy,12*cs,7*cs,ha+Math.PI/2,0,7);ctx.fill();
          ctx.fillStyle='#fff6c0';ctx.beginPath();ctx.arc(hx,hy-2*cs,2.4*cs,0,7);ctx.fill();ctx.fillStyle=e.color;
        }else if(e.kind==='eastwind'){               // 4.15 동남풍: 휘몰아치는 바람 소용돌이에 실린 불길
          ctx.globalAlpha=Math.min(1,p*1.5);ctx.lineWidth=3*cs;ctx.strokeStyle='#e8f6ff';
          for(let j=0;j<4;j++){ctx.beginPath();for(let i=0;i<=20;i++){const u=i/20,a=u*Math.PI*2.2+j*1.57+k*7,rr=radius*(.15+u*.75);const xx=Math.cos(a)*rr,yy=-30*cs-u*60*cs+Math.sin(a)*rr*.22;if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}ctx.stroke();}
          ctx.fillStyle='#ff7a2a';ctx.globalAlpha=p*.7;
          for(let i=0;i<12;i++){const a=i/12*Math.PI*2+k*5,rr=radius*(.3+.5*((i*.37+k)%1));ctx.beginPath();ctx.moveTo(Math.cos(a)*rr-6*cs,Math.sin(a)*rr*.22);ctx.quadraticCurveTo(Math.cos(a)*rr,Math.sin(a)*rr*.22-26*cs*(1-k*.4),Math.cos(a)*rr+6*cs,Math.sin(a)*rr*.22);ctx.fill();}
          ctx.fillStyle=e.color;ctx.strokeStyle=e.color;
        }else if(e.kind==='underworld'){
          ctx.globalAlpha=p*.65;ctx.lineWidth=5*cs;ctx.beginPath();ctx.ellipse(0,-55*cs,45*cs,65*cs,0,0,7);ctx.stroke();
          for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*20*cs,0);ctx.bezierCurveTo(i*50*cs,-30*cs,-i*15*cs,-70*cs,i*30*cs,-115*cs);ctx.stroke();}
        }else{
          for(let i=-1;i<=1;i++){const xx=i*radius*.5;ctx.beginPath();ctx.moveTo(xx-15*cs,-160*cs);ctx.lineTo(xx+10*cs,-105*cs);ctx.lineTo(xx-10*cs,-70*cs);ctx.lineTo(xx,0);ctx.stroke();}
        }
        ctx.globalAlpha=p*.8;
        for(let i=0;i<18;i++){const a=i*2.399,rr=radius*(.2+.8*k);ctx.beginPath();ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr*.2-k*(20+i%4*14)*cs,2*cs,0,7);ctx.fill();}
        ctx.restore();
      } else if (e.type === 'hit' && e.sty && !this.crowded) {
        // 4.13 공격 종류별 타격: 베기는 초승달 자국, 내려찍기는 땅 갈라짐과 흙먼지, 찌르기는 곧은 빛줄기
        const dir = e.dir || 1, q = 1 - p, col = e.color || '#ffffff';
        if (e.sty === 'melee') { const a = e.st ? attackStyle(e.st) : 'slash'; e.sty = a === 'shoot' || a === 'cast' ? 'slash' : a; }
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (e.sty === 'slash') {
          ctx.strokeStyle = 'rgba(255,255,255,' + p + ')'; ctx.lineWidth = (2 + p * 3) * cs;
          ctx.beginPath(); ctx.ellipse(x - dir * 4 * cs, y, (12 + q * 10) * cs, (16 + q * 8) * cs, dir * 0.5, -1.2, 1.0); ctx.stroke();
          ctx.strokeStyle = col; ctx.globalAlpha = p * 0.7; ctx.lineWidth = 1.5 * cs;
          ctx.beginPath(); ctx.ellipse(x - dir * 4 * cs, y, (9 + q * 10) * cs, (13 + q * 8) * cs, dir * 0.5, -1.0, 0.8); ctx.stroke();
        } else if (e.sty === 'heavy') {
          const gy = this.rowY(e.row ?? 1);
          ctx.fillStyle = 'rgba(255,240,200,' + (p * 0.5) + ')'; ctx.beginPath(); ctx.arc(x, y, (10 + q * 8) * cs, 0, 7); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = 'rgba(200,180,150,' + (p * 0.5) + ')';
          for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.ellipse(x + i * (8 + q * 22) * cs, gy - (2 + q * 4) * cs, (5 + q * 7) * cs, (2.5 + q * 3) * cs, 0, 0, 7); ctx.fill(); }
          ctx.strokeStyle = 'rgba(40,30,20,' + p * 0.7 + ')'; ctx.lineWidth = 1.6 * cs;
          ctx.beginPath(); ctx.moveTo(x - 10 * cs, gy); ctx.lineTo(x - 3 * cs, gy - 2 * cs); ctx.lineTo(x + 3 * cs, gy + 1 * cs); ctx.lineTo(x + 11 * cs, gy - 1 * cs); ctx.stroke();
        } else if (e.sty === 'thrust') {
          ctx.strokeStyle = 'rgba(255,255,255,' + p + ')'; ctx.lineWidth = (1.5 + p * 2.5) * cs;
          ctx.beginPath(); ctx.moveTo(x - dir * (14 - q * 6) * cs, y); ctx.lineTo(x + dir * (8 + q * 16) * cs, y); ctx.stroke();
          ctx.fillStyle = col; ctx.globalAlpha = p * 0.6; ctx.beginPath(); ctx.arc(x + dir * 4 * cs, y, (3 + q * 6) * cs, 0, 7); ctx.fill();
        } else {                                       // 쏘기 · 마법: 작은 빛 터짐과 사방 불똥
          ctx.fillStyle = col; ctx.globalAlpha = p * 0.55; ctx.beginPath(); ctx.arc(x, y, (5 + q * 9) * cs, 0, 7); ctx.fill();
          ctx.globalAlpha = p; ctx.strokeStyle = 'rgba(255,255,255,' + p + ')'; ctx.lineWidth = 1.4 * cs;
          for (let i = 0; i < 5; i++) { const a = i * 1.257 + (e.x % 7), d = (4 + q * 14) * cs;
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d * 0.5, y + Math.sin(a) * d * 0.5); ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.stroke(); }
        }
        ctx.restore();
      } else if (e.type === 'release') {               // 4.13 쏘는 순간: 시위 · 총구의 짧은 섬광
        const q = 1 - p, dir = e.dir || 1;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = e.color || '#ffffff'; ctx.globalAlpha = p * 0.6;
        ctx.beginPath(); ctx.arc(x, y, (3 + q * 6) * cs, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,' + p + ')'; ctx.lineWidth = 1.3 * cs;
        for (const a of [-0.45, 0, 0.45]) { ctx.beginPath(); ctx.moveTo(x + dir * Math.cos(a) * 4 * cs, y + Math.sin(a) * 4 * cs); ctx.lineTo(x + dir * Math.cos(a) * (7 + q * 9) * cs, y + Math.sin(a) * (7 + q * 9) * cs); ctx.stroke(); }
        ctx.restore();
      } else if (e.type === 'hit') {
        // 3.5: 맞는 순간 짧은 섬광. 무거운 일격(보스·영웅·큰 진화)은 불티도 튄다
        if (p > 0.55) {
          const q = (p - 0.55) / 0.45, rr = (e.big ? 15 : 9) * cs * (1.3 - q * 0.5);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255,240,200,' + (q * (e.big ? 0.55 : 0.4)) + ')';
          ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        if (e.big) this.glOnce(e, 'spark', x, y, e.color || '#ffd66e', 34);
        ctx.strokeStyle = 'rgba(255,255,255,' + p + ')';
        ctx.lineWidth = (e.big ? 3.2 : 2.5) * cs;
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
        const coinTxt = e.v < 0 ? String(e.v) : '+' + e.v;          // 도둑맞으면 붉게 -18
        ctx.strokeText(coinTxt, x + 14 * cs, y - 26 * cs - rise);
        if (e.v < 0) ctx.fillStyle = '#ff7a6a';
        ctx.fillText(coinTxt, x + 14 * cs, y - 26 * cs - rise);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      } else if (e.type === 'miss') {                  // 회피: 비껴간 공격
        ctx.globalAlpha = Math.min(1, p * 1.6);
        ctx.font = 'bold ' + Math.round(12 * cs) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3 * cs; ctx.strokeStyle = 'rgba(0,0,0,.6)';
        const my = y - 34 * cs - (1 - p) * 22 * cs, mt = tr(e.text || '회피');
        ctx.strokeText(mt, x, my); ctx.fillStyle = '#dff6ff'; ctx.fillText(mt, x, my);
        ctx.strokeStyle = 'rgba(223,246,255,' + (p * 0.7) + ')'; ctx.lineWidth = 2 * cs;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 14 * cs, y - (4 + i * 8) * cs); ctx.lineTo(x - (22 + (1 - p) * 10) * cs, y - (4 + i * 8) * cs); ctx.stroke(); }
        ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      } else if (e.type === 'chain') {                 // 사슬 간수: 날아가 휘감는 쇠사슬
        const x2 = this.screenX(e.x2), y2 = this.rowY(e.row2 || 0) - 28 * cs;
        const k = 1 - p, reach = Math.min(1, k * 3), back = k > 0.35 ? (k - 0.35) / 0.65 : 0;
        const ex = x + (x2 - x) * reach * (1 - back), ey = y + (y2 - y) * reach * (1 - back);
        ctx.globalAlpha = Math.min(1, p * 2);
        ctx.strokeStyle = '#9aa3ab'; ctx.lineWidth = 1.6 * cs;
        const n = 10;
        for (let i = 0; i < n; i++) {
          const t2 = i / n, px = x + (ex - x) * t2, py = y + (ey - y) * t2 - Math.sin(t2 * Math.PI) * 14 * cs;
          ctx.beginPath(); ctx.ellipse(px, py, 3 * cs, 1.8 * cs, i % 2 ? 0.6 : -0.6, 0, 7); ctx.stroke();
        }
        ctx.strokeStyle = '#d6dbe0'; ctx.lineWidth = 2.6 * cs;
        ctx.beginPath(); ctx.arc(ex, ey + 4 * cs, 5 * cs, -1.4, 2.4); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.type === 'mirror') {                // 거울 마녀: 튕겨 나가는 빛줄기
        const x2 = this.screenX(e.x2), y2 = this.rowY(e.row2 || 0) - 34 * cs;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p; ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 3 * cs;
        ctx.beginPath(); ctx.moveTo(x, y - 8 * cs); ctx.lineTo(x + (x2 - x) * (1 - p * 0.5), y2 + (y - y2) * p * 0.5); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y - 8 * cs, 7 * cs * p, 0, 7); ctx.fill();
        ctx.restore();
      } else if (e.type === 'soul') {                  // 흡혼귀에게 빨려 가는 넋
        const x2 = this.screenX(e.x2), y2 = this.rowY(e.row2 || 0) - 44 * cs;
        const k = 1 - p, px = x + (x2 - x) * k, py = y - 10 * cs + (y2 - y + 10 * cs) * k - Math.sin(k * Math.PI) * 40 * cs;
        ctx.globalAlpha = Math.min(1, p * 2) * 0.85;
        ctx.fillStyle = '#c9b6ff';
        ctx.beginPath(); ctx.arc(px, py, 6 * cs, 0, 7); ctx.fill();
        ctx.globalAlpha *= 0.4; ctx.beginPath(); ctx.arc(px, py, 12 * cs, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (e.type === 'bell') {                  // 종지기: 퍼지는 금빛 종소리
        const k = 1 - p;
        ctx.strokeStyle = e.color || '#f6d365';
        for (let i = 0; i < 3; i++) {
          const kk = Math.max(0, Math.min(1, k * 1.4 - i * 0.18));
          if (kk <= 0) continue;
          ctx.globalAlpha = (1 - kk) * 0.8; ctx.lineWidth = (3 - i * 0.6) * cs;
          const rr = e.r * this.zoom * kk;
          ctx.beginPath(); ctx.ellipse(x, y + 14 * cs, rr, rr * 0.28, 0, 0, 7); ctx.stroke();
        }
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
        if (k > 0.38 && k < 0.7 && !this.crowded) {     // 4.13 땅에 닿는 순간 흙먼지가 양옆으로 퍼진다
          const d = (k - 0.38) / 0.32;
          ctx.save(); ctx.rotate(ang); ctx.scale(e.dir, 1);
          ctx.fillStyle = 'rgba(220,205,180,' + (1 - d) * 0.45 + ')';
          for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * (10 + d * 26) * sc - 24 * sc * e.dir, -2 * sc, (5 + d * 9) * sc, (2.5 + d * 3) * sc, 0, 0, 7); ctx.fill(); }
          ctx.restore();
        }
        if (k < 0.12) {                                 // 쓰러지는 순간 하얗게 번쩍
          ctx.globalAlpha = (1 - k / 0.12) * 0.7;
          drawBody(ctx, e.st, sc, true, true, 0, false, 0);
        }
        ctx.restore();
        if (e.hero && k < 0.5) {                        // 3.5: 영웅이 쓰러지면 빛이 흩어진다
          this.glOnce(e, 'burst', x, this.rowY(e.row) - 30 * sc, '#ffe28a', 70 * sc);
          const q = k / 0.5;
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(255,226,138,' + (1 - q) * 0.8 + ')'; ctx.lineWidth = 3 * sc;
          ctx.beginPath(); ctx.ellipse(x, this.rowY(e.row), (14 + q * 60) * sc, (5 + q * 18) * sc, 0, 0, 7); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        if (k > 0.45) {                                 // 혼이 빠져나간다 (아군은 흰 빛, 적은 검은 연기)
          const q = (k - 0.45) / 0.55, ally = e.dir > 0;
          ctx.globalAlpha = Math.sin(q * Math.PI) * 0.5;
          ctx.fillStyle = ally ? '#eaf6ff' : '#2a2226';
          const gx = x - e.dir * 12 * sc + Math.sin(q * 9) * 4 * sc, gy2 = this.rowY(e.row) - (20 + q * 60) * sc;
          ctx.beginPath(); ctx.arc(gx, gy2, 6 * sc, Math.PI, 0);
          ctx.quadraticCurveTo(gx + 6 * sc, gy2 + 10 * sc, gx + 2 * sc, gy2 + 14 * sc);
          ctx.quadraticCurveTo(gx - 2 * sc, gy2 + 9 * sc, gx - 6 * sc, gy2 + 12 * sc); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }
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
        // 3.5: 튀어나오듯 커졌다가 자리 잡고 떠오른다. 치명타는 더 크고 흔들린다
        const k = 1 - p, ease = 1 - Math.pow(1 - Math.min(1, k / 0.6), 3);
        const rise = ease * 34 * cs + (e.dy || 0);
        let pop = k < 0.12 ? 1 + (k / 0.12) * 0.45 : 1.45 - Math.min(0.45, (k - 0.12) * 3);
        if (e.bump > 0) { pop += e.bump * 2.5; e.bump = Math.max(0, e.bump - (this._fdt || 0.016)); }   // 4.13 합쳐질 때 한 번 더 튄다
        const jx = e.crit && k < 0.3 ? Math.sin(k * 90) * 2 * cs : 0;
        ctx.globalAlpha = Math.min(1, p * 2.5);
        ctx.font = 'bold ' + Math.round((e.crit ? 18 : 13) * cs * pop) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = (e.crit ? 4 : 3) * cs;
        ctx.strokeStyle = e.crit ? 'rgba(90,30,0,.85)' : 'rgba(0,0,0,.65)';
        const label = e.crit ? e.v + '!' : e.v;
        ctx.strokeText(label, x + jx, y - rise);
        ctx.fillStyle = e.crit ? '#ffd166' : (e.ally ? '#ff9c8a' : '#f4ecd8');
        ctx.fillText(label, x + jx, y - rise);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      } else if (e.type === 'rally') {
        ctx.strokeStyle = 'rgba(255,209,102,' + p + ')';
        ctx.lineWidth = 3 * cs;
        const rr = (1 - p) * 26 * cs + 6;
        ctx.beginPath(); ctx.arc(x, y - 6 * cs, rr, 0, 7); ctx.stroke();
      } else if (e.type === 'herocall') {           // 3.14 필살 발동: 시전자 머리 위 기술 이름 + 발밑 빛 고리
        const k = 1 - p, gy = this.rowY(e.row || 0), sc = cs * (e.scale || 1);
        this.glOnce(e, 'holy', x, gy - 30 * sc, e.color, 34 * sc);
        ctx.globalAlpha = p * 0.9;
        ctx.strokeStyle = e.color; ctx.lineWidth = 3 * cs;
        const rr = (18 + k * 52) * sc;
        ctx.beginPath(); ctx.ellipse(x, gy + 2 * cs, rr, rr * 0.26, 0, 0, 7); ctx.stroke();
        ctx.globalAlpha = Math.min(1, p * 2.2);
        ctx.font = 'bold ' + Math.round(14 * cs) + 'px sans-serif';
        ctx.textAlign = 'center';
        // 키 큰 영웅(배율 1.4)도 가리지 않게 같은 높이에서, 함께 쓴 기술은 한 줄씩 위로
        const ty = this.rowY(0) - (150 + k * 26) * cs - (e.stack || 0) * 22 * cs;   // 줄(row)과 상관없이 같은 기준선
        ctx.lineWidth = 3.5 * cs; ctx.strokeStyle = 'rgba(0,0,0,.75)';
        const label = '⚡ ' + tr(e.name);
        ctx.strokeText(label, x, ty);
        ctx.fillStyle = '#fff4c8'; ctx.fillText(label, x, ty);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
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
      } else if (e.type === 'x3') {                     // 4.3 3진 전용 연출
        this.drawX3(e, x, p, cs);
      } else if (e.type === 'revive') {
        // 3.5: 불굴 — 쓰러졌던 자리에서 금빛 고리가 솟고 '불굴!' 이 뜬다
        const k = 1 - p, gy = this.rowY(e.row || 0), sc = cs * (e.scale || 1);
        this.glOnce(e, 'holy', x, gy, '#ffe28a', 46 * sc);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const q = Math.min(1, k * 1.6 - i * 0.25);
          if (q <= 0) continue;
          ctx.strokeStyle = 'rgba(255,226,138,' + (1 - q) * 0.9 + ')'; ctx.lineWidth = 3 * cs;
          ctx.beginPath(); ctx.ellipse(x, gy - q * 70 * sc, (18 + q * 10) * sc, (6 + q * 3) * sc, 0, 0, 7); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, p * 2.5);
        ctx.font = 'bold ' + Math.round(15 * cs) + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 3.5 * cs; ctx.strokeStyle = 'rgba(70,40,0,.85)';
        const ty = gy - 92 * sc - k * 18 * cs;
        ctx.strokeText(tr('불굴!'), x, ty); ctx.fillStyle = '#ffe28a'; ctx.fillText(tr('불굴!'), x, ty);
        ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      } else if (e.type === 'spawn') {
        if (e.grand) {                                 // 3.5: 큰 진화·영웅은 빛기둥 속에서 내려선다
          const gy = this.rowY(e.row), k = 1 - p, wv = (1 - k) * 18 * cs + 4 * cs;
          this.glOnce(e, 'holy', x, gy, e.color || '#ffe28a', 50 * cs);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255,236,170,' + (p * 0.5) + ')';
          ctx.fillRect(x - wv, gy - 170 * cs, wv * 2, 170 * cs);
          ctx.fillStyle = 'rgba(255,255,240,' + (p * 0.6) + ')';
          ctx.fillRect(x - wv * 0.35, gy - 170 * cs, wv * 0.7, 170 * cs);
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = 'rgba(255,226,138,' + p + ')'; ctx.lineWidth = 3 * cs;
          ctx.beginPath(); ctx.ellipse(x, gy + 2, k * 46 * cs, k * 14 * cs, 0, 0, 7); ctx.stroke();
        }
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
      big: !!e.big,
      dir: e.dir
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
      case 'tidal': {                      // 3.3 물보라: 솟구쳤다 부서지는 물기둥
        for (let i = 0, n = this.qn(12); i < n; i++) {
          const a = -Math.PI + i / (n - 1) * Math.PI;
          const d = R * (0.2 + k * 0.6);
          ctx.globalAlpha = p * 0.7;
          ctx.fillStyle = i % 3 ? e.color : '#e8faff';
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * d, gy - 8 * cs + Math.sin(a) * d * 0.55 - (1 - k) * 18 * cs, 7 * cs * big, 11 * cs * big, a, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = p * 0.6; ctx.strokeStyle = '#e8faff'; ctx.lineWidth = 3 * cs * big;
        ctx.beginPath(); ctx.ellipse(x, gy, R * (0.25 + k * 0.6), R * 0.12 * (0.5 + k), 0, 0, 7); ctx.stroke();
        break;
      }
      case 'harpoon': {                    // 3.3 작살: 날아가는 줄과 꽂히는 물보라
        ctx.globalAlpha = p; ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1.6 * cs;
        ctx.beginPath(); ctx.moveTo(x - 50 * cs * (1 - k), y - 10 * cs); ctx.quadraticCurveTo(x - 20 * cs, y - 22 * cs, x, y); ctx.stroke();
        ctx.fillStyle = e.color;
        for (let i = 0, n = this.qn(6); i < n; i++) {
          const a = -Math.PI * 0.9 + i / Math.max(1, n - 1) * Math.PI * 0.8;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * k * 22 * cs, y + Math.sin(a) * k * 22 * cs, 2.6 * cs, 0, 7); ctx.fill();
        }
        break;
      }
      case 'storm': {                      // 3.3 뇌우: 먹구름과 내리꽂는 벼락
        ctx.globalAlpha = p * 0.5; ctx.fillStyle = '#5a6a8a';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + (i - 1) * 22 * cs, y - 110 * cs, 26 * cs, 12 * cs, 0, 0, 7); ctx.fill(); }
        ctx.globalAlpha = p; ctx.strokeStyle = e.color; ctx.lineWidth = 3 * cs * big;
        ctx.beginPath(); let px = x, py = y - 100 * cs; ctx.moveTo(px, py);
        while (py < gy) { py += 18 * cs; px += Math.sin(py * 0.3 + e.x) * 9 * cs; ctx.lineTo(px, py); }
        ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, gy - 4 * cs, 8 * cs * (1 + k), 0, 7); ctx.fill();
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
      case 'staff': {                      // 여의봉: 황금 충격과 구름 연기
        ctx.globalAlpha = p;
        ctx.strokeStyle = e.color; ctx.lineWidth = 6 * cs * big;
        ctx.beginPath(); ctx.ellipse(x, gy, R * (0.3 + k * 0.8), R * 0.26 * (0.4 + k), 0, 0, 7); ctx.stroke();
        ctx.fillStyle = '#f4f1e8';
        for (let i = 0, n = this.qn(8); i < n; i++) {
          const a = -Math.PI + i / Math.max(1, n - 1) * Math.PI;
          ctx.globalAlpha = p * 0.35;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * 0.7 * k, gy - 16 * cs + Math.sin(a) * R * 0.3 * k, (10 + k * 16) * cs, 0, 7); ctx.fill();
        }
        break;
      }
      case 'firering': {                   // 풍화륜: 도는 불고리
        for (let i = 0, n = this.qn(14); i < n; i++) {
          const a = i / n * Math.PI * 2 + k * 6;
          const rr = R * (0.35 + k * 0.5);
          ctx.globalAlpha = p * 0.85;
          ctx.fillStyle = i % 3 ? e.color : '#fff2b0';
          ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rr, gy - 10 * cs + Math.sin(a) * rr * 0.3, 6 * cs * big, 9 * cs * big, 0, 0, 7); ctx.fill();
        }
        break;
      }
      /* 4.3 3진 여섯 (WebGL 이 없을 때의 대신 그림) */
      case 'shellblast': {                 // 포탄: 불덩이 · 흰 심 · 불티
        const cy = gy - 14 * cs;
        ctx.globalAlpha = p * 0.75; ctx.fillStyle = '#ff8a2a';
        ctx.beginPath(); ctx.ellipse(x, cy, R * (0.25 + k * 0.4), R * (0.2 + k * 0.3), 0, 0, 7); ctx.fill();
        ctx.globalAlpha = p; ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(x, cy, R * 0.15 * (1 - k * 0.5), 0, 7); ctx.fill();
        ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 2.4 * cs;
        for (let i = 0, n = this.qn(10); i < n; i++) {
          const a = -Math.PI * (0.05 + 0.9 * i / Math.max(1, n - 1)), r0 = R * (0.2 + k * 0.4), r1 = R * (0.35 + k * 0.7);
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
        }
        break;
      }
      case 'ufoburst': {                   // 비행접시: 초록 고리 셋 · 떠오르는 빛 알갱이
        ctx.strokeStyle = e.color;
        for (let i = 0; i < 3; i++) {
          const q = Math.min(1, k * 1.4 - i * 0.15), w = 0.6 + i * 0.3;
          if (q <= 0) continue;
          ctx.globalAlpha = (1 - q) * 0.9; ctx.lineWidth = (3 - i * 0.6) * cs;
          ctx.beginPath(); ctx.ellipse(x, gy - (4 + i * 8) * cs, R * q * w, R * q * 0.16 * w, 0, 0, 7); ctx.stroke();
        }
        ctx.fillStyle = '#d8ffe8'; ctx.globalAlpha = p;
        for (let i = 0, n = this.qn(8); i < n; i++) {
          const px = x + (i / Math.max(1, n - 1) - 0.5) * R * 0.8, py = gy - k * (60 + (i % 3) * 25) * cs;
          ctx.fillRect(px - 1.5 * cs, py - 1.5 * cs, 3 * cs, 3 * cs);
        }
        break;
      }
      case 'rocketpunch': {                // 로켓 주먹: 흰 섬광 · 금빛 충격 고리
        const cy = gy - 30 * cs;
        ctx.globalAlpha = p * 0.9; ctx.fillStyle = '#fff6d8';
        ctx.beginPath(); ctx.arc(x, cy, R * 0.2 * (1 - k * 0.6), 0, 7); ctx.fill();
        ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 4 * cs * p + 0.5;
        ctx.beginPath(); ctx.ellipse(x, cy, R * (0.2 + k * 0.8), R * (0.12 + k * 0.5), 0, 0, 7); ctx.stroke();
        for (let i = 0, n = this.qn(8); i < n; i++) {
          const a = i / n * Math.PI * 2 + 0.3;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.25, cy + Math.sin(a) * R * 0.2);
          ctx.lineTo(x + Math.cos(a) * R * (0.4 + k * 0.6), cy + Math.sin(a) * R * (0.3 + k * 0.45)); ctx.stroke();
        }
        break;
      }
      case 'drillspark': {                 // 드릴: 뒤로 튀는 불꽃 다발
        const cy = gy - 24 * cs, d = e.dir || 1;
        ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 2 * cs; ctx.globalAlpha = p;
        for (let i = 0, n = this.qn(9); i < n; i++) {
          const a = (d > 0 ? Math.PI : 0) + (i / Math.max(1, n - 1) - 0.5) * 1.6, r0 = (8 + k * 46 * (0.6 + (i % 3) * 0.25)) * cs;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0 * 0.5, cy + Math.sin(a) * r0 * 0.5 + k * k * 30 * cs);
          ctx.lineTo(x + Math.cos(a) * r0, cy + Math.sin(a) * r0 + k * k * 40 * cs); ctx.stroke();
        }
        ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(x, cy, 6 * cs * p, 0, 7); ctx.fill();
        break;
      }
      case 'dronestrike': {                // 드론 타격: 작은 불꽃 · 파란 전기
        const cy = gy - 14 * cs;
        ctx.globalAlpha = p * 0.85; ctx.fillStyle = '#ff9a3c';
        ctx.beginPath(); ctx.arc(x, cy, (10 + k * 22) * cs, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff1c0'; ctx.beginPath(); ctx.arc(x, cy, 7 * cs * p, 0, 7); ctx.fill();
        ctx.strokeStyle = '#8fe0ff'; ctx.lineWidth = 1.6 * cs;
        for (let i = 0, n = this.qn(6); i < n; i++) {
          const a = i / n * Math.PI * 2 + k, r0 = 12 * cs, r1 = (20 + k * 26) * cs;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
        }
        break;
      }
      case 'dozerpush': {                  // 4.4 불도저 (WebGL 없을 때): 앞으로 튀는 흙 줄기
        const d = e.dir || 1; ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#a88a5a'; ctx.lineWidth = 3 * cs; ctx.globalAlpha = p;
        for (let i = 0, n = this.qn(7); i < n; i++) { const a = d > 0 ? -(0.2 + i * 0.13) : Math.PI + 0.2 + i * 0.13, r0 = (10 + k * 40) * cs;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0 * 0.4, gy + Math.sin(a) * r0 * 0.4); ctx.lineTo(x + Math.cos(a) * r0, gy + Math.sin(a) * r0 + k * k * 20 * cs); ctx.stroke(); }
        break;
      }
      case 'snowburst': {                  // 4.4 눈덩이: 흰 고리 · 흩날리는 눈가루
        ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 3 * cs * p + 0.5; ctx.globalAlpha = p;
        ctx.beginPath(); ctx.ellipse(x, gy - 4 * cs, R * (0.2 + k * 0.7), R * (0.05 + k * 0.16), 0, 0, 7); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        for (let i = 0, n = this.qn(12); i < n; i++) { const a = -Math.PI * (i + 0.5) / n, r0 = R * (0.15 + k * 0.6);
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r0, gy - 10 * cs + Math.sin(a) * r0 * 0.7, 2.2 * cs, 0, 7); ctx.fill(); }
        break;
      }
      case 'sabercut': {                   // 4.4 광선검: 엇갈린 빛줄기
        const cy = gy - 26 * cs, L = (30 + k * 16) * cs;
        ctx.strokeStyle = e.color; ctx.lineWidth = 6 * cs * p + 0.5; ctx.globalAlpha = p * 0.7;
        for (const tl of [-0.7, 0.7]) { ctx.beginPath(); ctx.moveTo(x - Math.cos(tl) * L, cy - Math.sin(tl) * L); ctx.lineTo(x + Math.cos(tl) * L, cy + Math.sin(tl) * L); ctx.stroke(); }
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * cs; ctx.globalAlpha = p;
        for (const tl of [-0.7, 0.7]) { ctx.beginPath(); ctx.moveTo(x - Math.cos(tl) * L, cy - Math.sin(tl) * L); ctx.lineTo(x + Math.cos(tl) * L, cy + Math.sin(tl) * L); ctx.stroke(); }
        break;
      }
      case 'railhit': {                    // 4.4 레일건: 흰 섬광 · 푸른 고리
        const cy = gy - 20 * cs;
        ctx.globalAlpha = p; ctx.fillStyle = '#e8fcff'; ctx.beginPath(); ctx.arc(x, cy, R * 0.18 * (1 - k * 0.5), 0, 7); ctx.fill();
        ctx.strokeStyle = e.color; ctx.lineWidth = 3 * cs * p + 0.5;
        ctx.beginPath(); ctx.ellipse(x, cy, R * (0.15 + k * 0.6), R * (0.1 + k * 0.4), 0, 0, 7); ctx.stroke();
        break;
      }
      case 'mechstaff': {                  // 4.7 메카 대성 (WebGL 없을 때): 금빛 고리 · 튀는 돌
        ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 4 * cs * p + 0.5; ctx.globalAlpha = p;
        ctx.beginPath(); ctx.ellipse(x, gy - 2 * cs, R * (0.2 + k * 0.8), R * (0.06 + k * 0.2), 0, 0, 7); ctx.stroke();
        ctx.fillStyle = '#9a7a52';
        for (let i = 0, n = this.qn(8); i < n; i++) { const a = -Math.PI * (0.15 + i / n * 0.7), r0 = R * (0.1 + k * 0.6);
          ctx.fillRect(x + Math.cos(a) * r0 - 2 * cs, gy + Math.sin(a) * r0 * 0.8 + k * k * 30 * cs, 4 * cs, 4 * cs); }
        break;
      }
      case 'solarburn': {                  // 4.7 태양 위성: 태양 고리 · 빛기둥
        ctx.globalAlpha = p * 0.5; ctx.fillStyle = '#ffd35a';
        ctx.fillRect(x - 8 * cs * p, gy - 160 * cs, 16 * cs * p, 160 * cs);
        ctx.globalAlpha = p; ctx.strokeStyle = '#ffb83a'; ctx.lineWidth = 3 * cs * p + 0.5;
        ctx.beginPath(); ctx.ellipse(x, gy - 2 * cs, R * (0.2 + k * 0.7), R * (0.05 + k * 0.18), 0, 0, 7); ctx.stroke();
        break;
      }
      case 'boltstrike': {                 // 4.7 천둥 라이더: 꺾인 번개 한 줄기 · 푸른 고리
        ctx.strokeStyle = e.color; ctx.lineWidth = 4 * cs * p + 0.5; ctx.globalAlpha = p;
        ctx.beginPath(); ctx.moveTo(x + 10 * cs, gy - 200 * cs);
        for (let i = 1; i <= 6; i++) ctx.lineTo(x + (i % 2 ? -10 : 10) * cs * (1 - i / 7), gy - 200 * cs + i * 33 * cs);
        ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, gy - 2 * cs, R * (0.2 + k * 0.6), R * (0.05 + k * 0.16), 0, 0, 7); ctx.stroke();
        break;
      }
      case 'holoburst': {                  // 4.7 홀로그램: 퍼지는 육각형
        ctx.strokeStyle = e.color; ctx.lineWidth = 2.4 * cs * p + 0.5; ctx.globalAlpha = p;
        for (const sc0 of [0.5, 0.9]) { const rr = R * (0.15 + k * 0.6) * sc0;
          ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 + k; const px = x + Math.cos(a) * rr, py = gy - 24 * cs + Math.sin(a) * rr * 0.55; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
        break;
      }
      case 'divestrike': {                 // 4.7 제트팩 발키리: 흰 고리 · 금빛 깃털
        ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3 * cs * p + 0.5; ctx.globalAlpha = p;
        ctx.beginPath(); ctx.ellipse(x, gy - 2 * cs, R * (0.2 + k * 0.7), R * (0.05 + k * 0.18), 0, 0, 7); ctx.stroke();
        ctx.fillStyle = '#ffe48a';
        for (let i = 0, n = this.qn(8); i < n; i++) { const a = -Math.PI * (i + 0.5) / n, r0 = R * (0.1 + k * 0.5);
          ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r0, gy - 14 * cs + Math.sin(a) * r0 * 0.6 + k * 20 * cs, 4 * cs, 1.6 * cs, a, 0, 7); ctx.fill(); }
        break;
      }
      case 'starfall': {                   // 4.18 별의 대현자 착탄: 하늘에서 꽂히는 빛줄기 · 별 모양 충격 · 튀는 별 조각 · 금빛 고리
        const top = gy - 160 * cs, q = Math.min(1, k * 3);
        ctx.globalAlpha = p; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = (5 * (1 - q) + 1) * cs;
        ctx.beginPath(); ctx.moveTo(x - 30 * cs * (1 - q), top + (gy - top) * q * 0.2); ctx.lineTo(x, gy - 10 * cs); ctx.stroke();
        ctx.fillStyle = e.color; ctx.globalAlpha = p * 0.5;
        ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5 + k, rr = (i % 2 ? 0.35 : 1) * R * (0.25 + k * 0.5); ctx.lineTo(x + Math.cos(a) * rr, gy - 18 * cs + Math.sin(a) * rr * 0.6); } ctx.closePath(); ctx.fill();
        ctx.globalAlpha = p; ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2.4 * cs * p + 0.5;
        ctx.beginPath(); ctx.ellipse(x, gy - 2 * cs, R * (0.2 + k * 0.75), R * (0.05 + k * 0.18), 0, 0, 7); ctx.stroke();
        ctx.fillStyle = '#fff6c8';
        for (let i = 0, n = this.qn(10); i < n; i++) { const a = -Math.PI * (i + 0.5) / n, r0 = R * (0.12 + k * 0.7);
          ctx.fillRect(x + Math.cos(a) * r0 - 1.4 * cs, gy - 14 * cs + Math.sin(a) * r0 * 0.7 + k * k * 30 * cs - 1.4 * cs, 2.8 * cs, 2.8 * cs); }
        break;
      }
      case 'plasmablast': {                // 4.18 플라즈마 착탄: 하얀 섬광 구 · 푸른 충격 고리 둘 · 튀는 전기 가지
        const cy = gy - 16 * cs;
        ctx.globalAlpha = p; ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(x, cy, R * 0.3 * (1 - k * 0.6), 0, 7); ctx.fill();
        ctx.globalAlpha = p * 0.6; ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(x, cy, R * (0.3 + k * 0.5), 0, 7); ctx.fill();
        ctx.globalAlpha = p; ctx.strokeStyle = e.color; ctx.lineWidth = 3 * cs * p + 0.5;
        for (const w of [1, 0.6]) { ctx.beginPath(); ctx.ellipse(x, gy - 2 * cs, R * (0.25 + k * 0.85) * w, R * (0.06 + k * 0.2) * w, 0, 0, 7); ctx.stroke(); }
        ctx.strokeStyle = '#c8f6ff'; ctx.lineWidth = 1.4 * cs;
        for (let i = 0, n = this.qn(6); i < n; i++) { const a = -Math.PI * (0.1 + 0.8 * i / Math.max(1, n - 1)); let px = x, py = cy; ctx.beginPath(); ctx.moveTo(px, py);
          for (let j = 1; j <= 3; j++) { px = x + Math.cos(a) * R * 0.25 * j * (0.6 + k) + (j % 2 ? 4 : -4) * cs; py = cy + Math.sin(a) * R * 0.2 * j * (0.6 + k); ctx.lineTo(px, py); } ctx.stroke(); }
        break;
      }
      case 'missilehit': {                 // 4.18 미사일 착탄: 작은 주황 불덩이 · 흰 섬광 · 파편
        const cy = gy - 10 * cs;
        ctx.globalAlpha = p * 0.85; ctx.fillStyle = '#ff8a3c'; ctx.beginPath(); ctx.arc(x, cy, R * (0.25 + k * 0.35), 0, 7); ctx.fill();
        ctx.globalAlpha = p; ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(x, cy, R * 0.15 * (1 - k * 0.6), 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd35a'; for (let i = 0; i < 6; i++) { const a = -Math.PI * (i + 0.5) / 6, r0 = R * (0.1 + k * 0.6); ctx.fillRect(x + Math.cos(a) * r0, cy + Math.sin(a) * r0 + k * k * 20 * cs, 2 * cs, 2 * cs); }
        break;
      }
      case 'dragonslash': {                // 4.15 청룡 군신: 크게 휘도는 비취 초승달 · 흩어지는 용 비늘
        const cy = gy - 30 * cs, rr = R * (0.35 + k * 0.45), d = e.dir || 1, ox = x - d * rr * 0.3;
        const a0 = d > 0 ? -1.3 : Math.PI - 0.6, a1 = d > 0 ? 0.6 : Math.PI + 1.3;
        ctx.globalAlpha = p * 0.8; ctx.strokeStyle = e.color; ctx.lineWidth = 8 * cs * p + 0.5;
        ctx.beginPath(); ctx.arc(ox, cy, rr, a0, a1); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2 * cs; ctx.globalAlpha = p;
        ctx.beginPath(); ctx.arc(ox, cy, rr * 0.94, a0 + 0.2, a1 - 0.2); ctx.stroke();
        ctx.fillStyle = e.color;
        for (let i = 0, n = this.qn(8); i < n; i++) { const a = -Math.PI * (i + 0.5) / n, r0 = R * (0.15 + k * 0.6);
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r0, gy - 16 * cs + Math.sin(a) * r0 * 0.6 + k * k * 24 * cs, 2.6 * cs, 0, Math.PI); ctx.fill(); }
        break;
      }
      case 'laserhit': {                   // 4.7 레이저 활: 초승달 섬광
        ctx.strokeStyle = e.color; ctx.lineWidth = 4 * cs * p + 0.5; ctx.globalAlpha = p;
        ctx.beginPath(); ctx.arc(x, gy - 30 * cs, (12 + k * 16) * cs, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6 * cs; ctx.beginPath(); ctx.arc(x, gy - 30 * cs, (11 + k * 16) * cs, -0.9, 0.9); ctx.stroke();
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

  /* ---- 4.3 3진 여섯의 전용 연출 ('x3') ----
   * 어두운 연기·흙·갈라진 땅은 Canvas 로, 빛은 가산 합성(과 WebGL 한 번)으로 얹는다.
   * 몸에 붙은 자리(포구·접시 밑)는 몸 단위라 cs 로, 범위는 세계 단위라 zoom 으로 바꾼다. */
  drawX3(e, x, p, cs) {
    const ctx = this.ctx, k = 1 - p, gy = this.rowY(e.row || 0);
    const sc = cs * (e.scale || 1), dir = e.dir || 1;
    if (x < -360 || x > this.w + 360) return;
    if (e._sd === undefined) e._sd = Math.random() * 97;
    const rnd = i => { const v = Math.sin((e._sd + i) * 12.9898) * 43758.5453; return v - Math.floor(v); };
    const n = m => this.qn(m);
    ctx.save();
    ctx.lineCap = 'round';
    switch (e.kind) {
      case 'muzzle': {                                   // 전차 포성: 포구 섬광 · 앞으로 밀려 나가는 포연 · 바닥을 쓰는 먼지
        const mx = x + dir * e.ox * cs, my = gy - e.h * cs;
        if (k < 0.22) this.glOnce(e, 'spark', mx + dir * 6 * sc, my, '#ffd35a', 34 * sc);
        for (let i = 0, m = n(4); i < m; i++) {          // 바닥 먼지 (포구 압력)
          const q = Math.min(1, k * 1.6), r0 = rnd(i);
          x3Smoke(ctx, mx + dir * (-20 + i * 14 + q * (24 + r0 * 30)) * sc, gy - (2 + q * 7 * r0) * sc,
                  (4 + q * 11) * sc * (0.75 + r0 * 0.5), (1 - k) * 0.42, '#b8a888', '#ded2b8');
        }
        for (let i = 0, m = n(8); i < m; i++) {          // 포연 (앞으로 퍼지며 피어오른다)
          const r0 = rnd(i + 10), r1 = rnd(i + 20), q = Math.min(1, k * (1.2 + r0 * 0.8));
          const px = mx + dir * (4 + i * 4.5 + q * (18 + r0 * 34)) * sc;
          const py = my + (r1 - 0.5) * 16 * sc * q - q * (8 + r1 * 16) * sc;
          x3Smoke(ctx, px, py, (3 + q * 11) * sc * (0.7 + r1 * 0.6), Math.pow(1 - k, 1.4) * 0.62, '#77716a', '#a9a399');
        }
        if (k < 0.4) {                                   // 앞으로 터지는 충격 고리 · 섬광
          const q = k / 0.4;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - q) * 0.7; ctx.strokeStyle = '#fff1c0'; ctx.lineWidth = 2.6 * sc * (1 - q);
          ctx.beginPath(); ctx.ellipse(mx + dir * q * 16 * sc, my, (3 + q * 10) * sc, (6 + q * 22) * sc, 0, 0, 7); ctx.stroke();
          if (q < 0.5) {
            ctx.globalAlpha = (1 - q * 2) * 0.85; ctx.fillStyle = '#ffb03c';
            ctx.beginPath(); ctx.arc(mx + dir * 8 * sc, my, 16 * sc, 0, 7); ctx.fill();
            ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(mx + dir * 5 * sc, my, 7 * sc, 0, 7); ctx.fill();
          }
        }
        break;
      }
      case 'ufobeam': {                                  // 비행접시 광선: 접시 밑에서 과녁까지 내리꽂히는 초록 빛기둥
        const sx = x, sy = gy - e.h * cs, tx = this.screenX(e.x2), ty = this.rowY(e.row2 !== undefined ? e.row2 : e.row || 0);
        const a = Math.min(1, k * 7) * Math.min(1, p * 2.2), col = e.color || '#8affc0';
        const wTop = 4 * sc, wBot = (20 + Math.sin(k * 30) * 3) * sc;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.3; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(sx - wTop * 1.6, sy); ctx.lineTo(sx + wTop * 1.6, sy); ctx.lineTo(tx + wBot * 1.5, ty); ctx.lineTo(tx - wBot * 1.5, ty); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = a * 0.55;
        ctx.beginPath(); ctx.moveTo(sx - wTop, sy); ctx.lineTo(sx + wTop, sy); ctx.lineTo(tx + wBot * 0.7, ty); ctx.lineTo(tx - wBot * 0.7, ty); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#effff6';
        ctx.beginPath(); ctx.moveTo(sx - wTop * 0.35, sy); ctx.lineTo(sx + wTop * 0.35, sy); ctx.lineTo(tx + wBot * 0.22, ty); ctx.lineTo(tx - wBot * 0.22, ty); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5 * sc;
        for (let i = 0, m = n(4); i < m; i++) {          // 광선을 타고 내려가는 고리
          const q = (k * 2.4 + i / m) % 1, rx = wTop + (wBot * 1.1 - wTop) * q;
          ctx.globalAlpha = a * (0.4 + q * 0.5);
          ctx.beginPath(); ctx.ellipse(sx + (tx - sx) * q, sy + (ty - sy) * q, rx, rx * 0.28, 0, 0, 7); ctx.stroke();
        }
        ctx.fillStyle = '#d8ffe8';
        for (let i = 0, m = n(7); i < m; i++) {          // 끌려 올라가는 빛 알갱이
          const q = (k * 1.7 + rnd(i)) % 1, j = (rnd(i + 5) - 0.5) * wBot * 1.4 * (1 - q);
          ctx.globalAlpha = a * (1 - q) * 0.9;
          const px = tx + (sx - tx) * q + j, py = ty + (sy - ty) * q;
          ctx.fillRect(px - 1.3 * sc, py - 1.3 * sc, 2.6 * sc, 2.6 * sc);
        }
        ctx.globalAlpha = a * 0.5; ctx.fillStyle = col;  // 과녁 바닥의 빛 웅덩이
        ctx.beginPath(); ctx.ellipse(tx, ty, wBot * 1.7, wBot * 0.36, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#effff6';
        ctx.beginPath(); ctx.ellipse(tx, ty, wBot * 0.6, wBot * 0.14, 0, 0, 7); ctx.fill();
        break;
      }
      case 'boom': {                                     // 포탄 착탄: 그을린 땅 · 튀는 흙덩이 · 버섯처럼 오르는 검은 연기
        const R = Math.min(e.r * this.zoom, 150 * cs);
        ctx.globalAlpha = Math.min(1, k * 9) * Math.min(1, p * 2.6) * 0.5; ctx.fillStyle = '#2a2018';
        ctx.beginPath(); ctx.ellipse(x, gy + 1 * cs, R * 0.55, R * 0.13, 0, 0, 7); ctx.fill();
        if (k < 0.5) {                                   // 바닥을 쓰는 흙 고리
          const q = k / 0.5;
          ctx.globalAlpha = (1 - q) * 0.4; ctx.strokeStyle = '#d8c6a4'; ctx.lineWidth = 4 * cs * (1 - q) + 0.5;
          ctx.beginPath(); ctx.ellipse(x, gy, R * (0.25 + q * 0.6), R * (0.06 + q * 0.14), 0, 0, 7); ctx.stroke();
        }
        for (let i = 0, m = n(11); i < m; i++) {         // 흙덩이
          const r0 = rnd(i), r1 = rnd(i + 30), ang = -Math.PI * (0.12 + r0 * 0.76), v = (90 + r1 * 150) * cs;
          const tt = k * 1.1, px = x + Math.cos(ang) * v * tt, py = gy - 6 * cs + Math.sin(ang) * v * tt + 330 * cs * tt * tt;
          if (py > gy + 2 * cs) continue;
          ctx.globalAlpha = Math.min(1, p * 3);
          ctx.fillStyle = i % 3 ? '#5a4632' : '#7a6044';
          const sz = (1.8 + r1 * 2.6) * cs;
          ctx.save(); ctx.translate(px, py); ctx.rotate(k * 9 * (r0 - 0.5)); ctx.fillRect(-sz, -sz * 0.8, sz * 2, sz * 1.6); ctx.restore();
        }
        for (let i = 0, m = n(9); i < m; i++) {          // 버섯 연기 (늦게 피어 천천히 오른다)
          const r0 = rnd(i + 50), r1 = rnd(i + 70), q = Math.max(0, Math.min(1, (k - 0.04) * 1.15));
          if (q <= 0) continue;
          const stem = i < 3, h = stem ? (8 + i * 16) * q : (40 + r1 * 30) * q + 6;
          const px = x + (r0 - 0.5) * (stem ? 14 * cs : R * 0.9) * (0.5 + q * 0.7);
          x3Smoke(ctx, px, gy - h * cs, (stem ? 6 + q * 7 : 9 + q * 17) * cs * (0.75 + r1 * 0.5),
                  Math.pow(1 - q, 1.2) * 0.62, '#3a342e', '#6a6158');
        }
        break;
      }
      case 'quake': {                                    // 로켓 주먹: 쩍 갈라지는 땅 · 양옆으로 밀려나는 흙먼지 · 금빛 충격파
        const R = Math.min(e.r * this.zoom, 130 * cs) + 30 * cs, grow = Math.min(1, k * 6), fade = Math.min(1, p * 2.4);
        ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2.2 * cs; ctx.globalAlpha = fade * 0.75;
        for (let i = 0; i < 6; i++) {                    // 갈라진 금
          const a0 = (i / 6) * Math.PI * 2 + rnd(i) * 0.6, L = R * (0.45 + rnd(i + 9) * 0.45) * grow;
          ctx.beginPath(); ctx.moveTo(x, gy);
          for (let j = 1; j <= 4; j++) {
            const d = L * j / 4, jit = (rnd(i * 7 + j) - 0.5) * 0.5;
            ctx.lineTo(x + Math.cos(a0 + jit) * d, gy + Math.sin(a0 + jit) * d * 0.22);
          }
          ctx.stroke();
        }
        if (k < 0.45) {                                  // 갈라진 틈의 불빛 · 충격 고리
          const q = k / 0.45;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - q) * 0.8; ctx.strokeStyle = '#ffb03c'; ctx.lineWidth = 1 * cs;
          for (let i = 0; i < 6; i++) {
            const a0 = (i / 6) * Math.PI * 2 + rnd(i) * 0.6, L = R * (0.45 + rnd(i + 9) * 0.45) * grow * 0.7;
            ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + Math.cos(a0) * L, gy + Math.sin(a0) * L * 0.22); ctx.stroke();
          }
          ctx.globalAlpha = (1 - q) * 0.75; ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 4 * cs * (1 - q) + 0.5;
          ctx.beginPath(); ctx.ellipse(x, gy - 2 * cs, R * (0.2 + q * 1.1), R * (0.05 + q * 0.26), 0, 0, 7); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        for (let i = 0, m = n(10); i < m; i++) {         // 흙먼지 벽
          const side = i % 2 ? 1 : -1, r0 = rnd(i + 40), q = Math.min(1, k * 1.5);
          x3Smoke(ctx, x + side * (8 + q * R * (0.45 + r0 * 0.55)), gy - (3 + q * 14 * r0) * cs,
                  (5 + q * 15) * cs * (0.7 + r0 * 0.6), (1 - k) * 0.55, '#b0a088', '#d8ccb4');
        }
        for (let i = 0, m = n(7); i < m; i++) {          // 튀는 돌조각
          const r0 = rnd(i + 60), ang = -Math.PI * (0.15 + r0 * 0.7), v = (110 + rnd(i + 61) * 140) * cs, tt = k;
          const px = x + Math.cos(ang) * v * tt, py = gy - 10 * cs + Math.sin(ang) * v * tt + 420 * cs * tt * tt;
          if (py > gy + 2 * cs) continue;
          ctx.globalAlpha = 1; ctx.fillStyle = i % 2 ? '#6b6560' : '#8a827a';
          const sz = (1.6 + r0 * 2.2) * cs; ctx.fillRect(px - sz, py - sz, sz * 2, sz * 1.7);
        }
        break;
      }
      case 'smoke': {                                    // 드론 타격: 작은 검은 연기 · 파편
        for (let i = 0, m = n(5); i < m; i++) {
          const r0 = rnd(i), q = Math.min(1, k * 1.3);
          x3Smoke(ctx, x + (r0 - 0.5) * 22 * cs, gy - (8 + q * (20 + r0 * 22)) * cs, (4 + q * 9) * cs, (1 - k) * 0.55, '#3e3a36', '#6e6862');
        }
        for (let i = 0, m = n(4); i < m; i++) {
          const ang = -Math.PI * (0.2 + rnd(i + 9) * 0.6), v = (80 + rnd(i + 3) * 90) * cs;
          const px = x + Math.cos(ang) * v * k, py = gy - 12 * cs + Math.sin(ang) * v * k + 380 * cs * k * k;
          if (py > gy) continue;
          ctx.globalAlpha = 1; ctx.fillStyle = '#4a5260'; ctx.fillRect(px - 1.5 * cs, py - 1 * cs, 3 * cs, 2 * cs);
        }
        break;
      }
      case 'siren': {                                    // 구급 마차 사이렌: 경광등에서 퍼지는 빨강·파랑 소리 물결 · 바닥 고리
        const ly = gy - 60 * sc, R = e.r * this.zoom;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const q = k * 1.25 - i * 0.18;
          if (q <= 0 || q >= 1) continue;
          const rr = (8 + q * 46) * sc;
          ctx.lineWidth = 2.8 * sc * (1 - q * 0.6); ctx.globalAlpha = (1 - q) * 0.85;
          ctx.strokeStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(x - 3 * sc, ly, rr, Math.PI - 0.62, Math.PI + 0.62); ctx.stroke();
          ctx.strokeStyle = '#4a8aff'; ctx.beginPath(); ctx.arc(x + 3 * sc, ly, rr, -0.62, 0.62); ctx.stroke();
        }
        for (let j = 0; j < 2; j++) {
          const q = k * 1.15 - j * 0.22;
          if (q <= 0 || q >= 1) continue;
          ctx.globalAlpha = (1 - q) * 0.6; ctx.strokeStyle = j ? '#4a8aff' : '#ff4a4a'; ctx.lineWidth = 3 * sc * (1 - q) + 0.5;
          ctx.beginPath(); ctx.ellipse(x, gy + 1 * cs, R * q, R * q * 0.16, 0, 0, 7); ctx.stroke();
        }
        break;
      }
      case 'medic': {                                    // 나은 아군 머리 위로 떠오르는 붉은 십자
        const pop = easeOutBack(Math.min(1, k * 4)), u = sc * 0.62 * pop, cx = x, cy = gy - (70 + k * 26) * sc;
        if (u <= 0) break;
        ctx.globalAlpha = Math.min(1, p * 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 3.4 * u, cy - 8.4 * u, 6.8 * u, 16.8 * u); ctx.fillRect(cx - 8.4 * u, cy - 3.4 * u, 16.8 * u, 6.8 * u);
        ctx.fillStyle = '#e8403a';
        ctx.fillRect(cx - 2 * u, cy - 7 * u, 4 * u, 14 * u); ctx.fillRect(cx - 7 * u, cy - 2 * u, 14 * u, 4 * u);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#9dffb0';
        for (let i = 0; i < 3; i++) {                    // 초록 반짝이
          const q = (k * 1.4 + i / 3) % 1, px = cx + (i - 1) * 11 * sc, py = cy + 18 * sc - q * 26 * sc;
          ctx.globalAlpha = (1 - q) * 0.8 * Math.min(1, p * 3);
          ctx.fillRect(px - 2.2 * sc, py - 0.7 * sc, 4.4 * sc, 1.4 * sc); ctx.fillRect(px - 0.7 * sc, py - 2.2 * sc, 1.4 * sc, 4.4 * sc);
        }
        break;
      }
      case 'railflash': {                                // 4.4 레일건 총구: 푸른 충격 고리 셋 · 앞으로 뻗는 빛 · 전기 불티
        const mx = x + dir * e.ox * cs, my = gy - e.h * cs, col = e.color || '#5ae8ff';
        if (k < 0.2) this.glOnce(e, 'spark', mx, my, col, 30 * sc);
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col;
        for (let i = 0; i < 3; i++) {
          const q = Math.min(1, k * 2.4 - i * 0.2);
          if (q <= 0 || q >= 1) continue;
          ctx.globalAlpha = (1 - q) * 0.85; ctx.lineWidth = 2.4 * sc * (1 - q) + 0.5;
          ctx.beginPath(); ctx.ellipse(mx + dir * (4 + i * 9 + q * 10) * sc, my, (2 + q * 4) * sc, (5 + q * 9) * sc, 0, 0, 7); ctx.stroke();
        }
        if (k < 0.35) {
          const q = k / 0.35;
          ctx.globalAlpha = (1 - q) * 0.9; ctx.fillStyle = '#e8fcff';
          ctx.beginPath(); ctx.moveTo(mx, my - 2 * sc); ctx.lineTo(mx + dir * (40 + q * 30) * sc, my); ctx.lineTo(mx, my + 2 * sc); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = (1 - q) * 0.4; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx + dir * 4 * sc, my, 12 * sc, 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0, m = n(3); i < m; i++) {
          const q = Math.min(1, k * 1.3), r0 = rnd(i);
          x3Smoke(ctx, mx + dir * (6 + q * (10 + r0 * 16)) * sc, my - q * (6 + r0 * 10) * sc, (2.5 + q * 6) * sc, (1 - k) * 0.4, '#8a9098', '#c8d0d8');
        }
        break;
      }
      case 'dirtwave': {                                 // 4.4 불도저 삽: 앞으로 밀려 나가는 흙 벽 · 굴러가는 흙덩이
        const R = Math.min((e.r || 70) * this.zoom, 120 * cs), q = Math.min(1, k * 1.5);
        ctx.globalAlpha = Math.min(1, p * 2.5) * 0.4; ctx.fillStyle = '#5a4632';                    // 긁힌 땅
        ctx.beginPath(); ctx.ellipse(x - dir * 10 * cs, gy + 1 * cs, R * 0.6, R * 0.08, 0, 0, 7); ctx.fill();
        for (let i = 0, m = n(9); i < m; i++) {
          const r0 = rnd(i), r1 = rnd(i + 20);
          x3Smoke(ctx, x + dir * (q * R * (0.3 + r0 * 0.8)), gy - (3 + q * 14 * r1) * cs, (5 + q * 12) * cs * (0.7 + r1 * 0.6), (1 - k) * 0.6, '#9a7c56', '#cdb48c');
        }
        for (let i = 0, m = n(8); i < m; i++) {
          const r0 = rnd(i + 40), ang = dir > 0 ? -(0.2 + r0 * 0.9) : Math.PI + 0.2 + r0 * 0.9, v = (100 + rnd(i + 41) * 140) * cs;
          const px = x + Math.cos(ang) * v * k, py = gy - 6 * cs + Math.sin(ang) * v * k + 380 * cs * k * k;
          if (py > gy + 2 * cs) continue;
          ctx.globalAlpha = 1; ctx.fillStyle = i % 2 ? '#6a5238' : '#8a7050';
          const sz = (1.8 + r0 * 2.4) * cs; ctx.save(); ctx.translate(px, py); ctx.rotate(k * 7 * (r0 - 0.5)); ctx.fillRect(-sz, -sz * 0.8, sz * 2, sz * 1.6); ctx.restore();
        }
        break;
      }
      case 'frost': {                                    // 4.4 빙수 눈덩이: 쌓인 눈 · 솟는 얼음 조각 · 눈가루 구름
        const R = Math.min((e.r || 70) * this.zoom, 120 * cs), fade = Math.min(1, p * 2.4);
        ctx.globalAlpha = fade * 0.75; ctx.fillStyle = '#f2faff';
        ctx.beginPath(); ctx.ellipse(x, gy + 1 * cs, R * 0.55, R * 0.1, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#c8ecff'; ctx.globalAlpha = fade * 0.5;
        ctx.beginPath(); ctx.ellipse(x, gy + 2 * cs, R * 0.4, R * 0.06, 0, 0, 7); ctx.fill();
        const grow = Math.min(1, k * 6);
        for (let i = 0; i < 7; i++) {                     // 얼음 조각
          const r0 = rnd(i), px = x + (r0 - 0.5) * R * 0.9, h = (8 + rnd(i + 9) * 14) * cs * grow, w = (2.5 + rnd(i + 3) * 2.5) * cs;
          ctx.globalAlpha = fade * 0.9; ctx.fillStyle = i % 2 ? '#bfe8ff' : '#e8f8ff';
          ctx.beginPath(); ctx.moveTo(px - w, gy); ctx.lineTo(px + (r0 - 0.5) * 4 * cs, gy - h); ctx.lineTo(px + w, gy); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = fade * 0.6; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(px - w * 0.4, gy - 1 * cs); ctx.lineTo(px + (r0 - 0.5) * 4 * cs, gy - h); ctx.lineTo(px, gy - 1 * cs); ctx.closePath(); ctx.fill();
        }
        for (let i = 0, m = n(6); i < m; i++) {
          const r0 = rnd(i + 30), q = Math.min(1, k * 1.4);
          x3Smoke(ctx, x + (r0 - 0.5) * R * (0.6 + q * 0.6), gy - (6 + q * 20 * r0) * cs, (4 + q * 10) * cs, (1 - k) * 0.55, '#d8eef8', '#ffffff');
        }
        break;
      }
      case 'railscar': {                                 // 4.4 레일건 착탄: 그을린 자국 · 잦아드는 푸른 불씨 · 연기
        const fade = Math.min(1, p * 2.2), col = e.color || '#5ae8ff';
        ctx.globalAlpha = fade * 0.5; ctx.fillStyle = '#20242c';
        ctx.beginPath(); ctx.ellipse(x, gy + 1 * cs, 22 * cs, 4 * cs, 0, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade * (0.4 + 0.3 * Math.sin(k * 40)); ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(x, gy, 10 * cs * (1 - k * 0.5), 2 * cs, 0, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0, m = n(4); i < m; i++) {
          const r0 = rnd(i), q = Math.min(1, k * 1.2);
          x3Smoke(ctx, x + (r0 - 0.5) * 18 * cs, gy - (6 + q * (18 + r0 * 16)) * cs, (3 + q * 8) * cs, (1 - k) * 0.45, '#5a6068', '#8a929a');
        }
        break;
      }
      case 'solarray': {                                 // 4.7 태양 위성: 하늘에서 과녁으로 내리꽂는 빛기둥 · 기둥 둘레 도는 고리
        const a = Math.min(1, k * 8) * Math.min(1, p * 2.4), col = e.color || '#ffca3a', w = (10 + Math.sin(k * 40) * 2) * sc;
        if (k < 0.3) this.glOnce(e, 'solarburn', x, gy, col, (e.r || 90) * this.zoom, cs);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.3; ctx.fillStyle = col; ctx.fillRect(x - w * 1.8, 0, w * 3.6, gy);
        ctx.globalAlpha = a * 0.6; ctx.fillRect(x - w * 0.8, 0, w * 1.6, gy);
        ctx.globalAlpha = a * 0.9; ctx.fillStyle = '#fff8e0'; ctx.fillRect(x - w * 0.25, 0, w * 0.5, gy);
        ctx.strokeStyle = col; ctx.lineWidth = 1.6 * sc;
        for (let i = 0, m = n(4); i < m; i++) { const q = (k * 2 + i / m) % 1;
          ctx.globalAlpha = a * (1 - q) * 0.8; ctx.beginPath(); ctx.ellipse(x, gy - q * gy * 0.7, w * 2.2, w * 0.6, 0, 0, 7); ctx.stroke(); }
        ctx.globalAlpha = a * 0.5; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, gy, w * 3.4, w * 0.9, 0, 0, 7); ctx.fill();
        break;
      }
      case 'moonflash': {                                // 4.7 레이저 활: 시위를 놓는 자리의 초승달 · 앞으로 뻗는 빛
        const mx = x + dir * e.ox * cs, my = gy - e.h * cs, col = e.color || '#a8f0ff';
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p; ctx.strokeStyle = col; ctx.lineWidth = 3 * sc * p + 0.5;
        ctx.beginPath(); ctx.arc(mx, my, (8 + k * 12) * sc, dir > 0 ? -1.2 : Math.PI - 1.2, dir > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke();
        ctx.globalAlpha = p * 0.7; ctx.fillStyle = '#f4feff'; ctx.fillRect(Math.min(mx, mx + dir * 60 * sc * k), my - 1 * sc, 60 * sc * k, 2 * sc);
        break;
      }
      case 'starsigil': {                                // 4.18 별의 대현자가 쏘는 순간: 발밑에 펼쳐지는 별 마법진 · 지팡이 끝 별 문양
        const col = e.color || '#ffd76a', q = Math.min(1, k * 2.4), a = (1 - k) * Math.min(1, p * 3);
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.globalAlpha = a * 0.85;
        const rx = (18 + q * 26) * sc, ry = rx * 0.24, rot = k * 2.4;
        ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.ellipse(x, gy - 1 * sc, rx, ry, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); for (let i = 0; i <= 5; i++) { const b = rot + i * Math.PI * 4 / 5; const px = x + Math.cos(b) * rx * 0.86, py = gy - 1 * sc + Math.sin(b) * ry * 0.86; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
        const sx = x + dir * e.ox * cs, sy = gy - e.h * cs;   // 지팡이 끝
        ctx.globalAlpha = a; ctx.fillStyle = '#fff6c8';
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(-rot);
        ctx.beginPath(); for (let i = 0; i < 16; i++) { const b = i * Math.PI / 8, rr = (i % 2 ? 3 : 9 + q * 7) * sc; ctx.lineTo(Math.cos(b) * rr, Math.sin(b) * rr); } ctx.closePath(); ctx.fill();
        ctx.restore();
        if (k < 0.2) this.glOnce(e, 'spark', sx, sy, col, 26 * sc);
        break;
      }
      case 'plasmamuzzle': {                             // 4.18 플라즈마 포구: 모였다 터지는 푸른 구 · 앞으로 밀려 나가는 고리 셋 · 열기 아지랑이
        const col = e.color || '#5ad8ff', mx = x + dir * e.ox * cs, my = gy - e.h * cs;
        ctx.globalCompositeOperation = 'lighter';
        if (k < 0.3) { const q = k / 0.3; ctx.globalAlpha = 1 - q; ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(mx, my, (6 + q * 10) * sc, 0, 7); ctx.fill();
          ctx.fillStyle = col; ctx.globalAlpha = (1 - q) * 0.6; ctx.beginPath(); ctx.arc(mx, my, (12 + q * 16) * sc, 0, 7); ctx.fill(); this.glOnce(e, 'spark', mx, my, col, 30 * sc); }
        ctx.strokeStyle = col;
        for (let j = 0; j < 3; j++) { const q = Math.min(1, k * 1.8 - j * 0.15); if (q <= 0 || q >= 1) continue;
          ctx.globalAlpha = (1 - q) * 0.8; ctx.lineWidth = 2.2 * sc * (1 - q) + 0.4;
          ctx.beginPath(); ctx.ellipse(mx + dir * q * (20 + j * 14) * sc, my, (2 + q * 4) * sc, (5 + q * 12) * sc, 0, 0, 7); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0, m = n(4); i < m; i++) { const r0 = rnd(i), q = Math.min(1, k * (1.2 + r0)); x3Smoke(ctx, mx + dir * (6 + q * 30 * r0) * sc, my - q * 14 * sc, (3 + q * 8) * sc, (1 - k) * 0.35, '#8a9aa8', '#c8d4e0'); }
        break;
      }
      case 'starscar': {                                 // 4.18 별이 떨어진 자리: 땅에 새겨진 금빛 별 문양이 잦아든다
        const col = e.color || '#ffd76a', rr = e.r * this.zoom * 0.5;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * 0.6; ctx.strokeStyle = col; ctx.lineWidth = 1.6 * sc;
        ctx.beginPath(); for (let i = 0; i <= 5; i++) { const b = -Math.PI / 2 + i * Math.PI * 4 / 5; const px = x + Math.cos(b) * rr, py = gy + Math.sin(b) * rr * 0.22; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, gy, rr * 1.05, rr * 0.25, 0, 0, 7); ctx.stroke();
        break;
      }
      case 'plasmascar': {                               // 4.18 플라즈마가 녹인 자리: 유리처럼 녹은 땅 · 잦아드는 푸른 빛 · 김
        const col = e.color || '#5ad8ff', rr = e.r * this.zoom * 0.42;
        ctx.globalAlpha = (1 - k) * 0.55; ctx.fillStyle = '#1a2a34'; ctx.beginPath(); ctx.ellipse(x, gy + 1 * sc, rr, rr * 0.22, 0, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, gy + 1 * sc, rr * 0.6, rr * 0.12, 0, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0, m = n(3); i < m; i++) { const q = (k + i / 3) % 1; x3Smoke(ctx, x + (rnd(i) - 0.5) * rr, gy - q * 30 * sc, (3 + q * 6) * sc, (1 - q) * (1 - k) * 0.4, '#a8b4c0', '#e0e8f0'); }
        break;
      }
      case 'sunscar': {                                  // 4.7 태양광선 자국: 녹아내린 땅 · 잦아드는 주황 빛
        const fade = Math.min(1, p * 2), R = (e.r || 90) * this.zoom * 0.45;
        ctx.globalAlpha = fade * 0.45; ctx.fillStyle = '#3a2214';
        ctx.beginPath(); ctx.ellipse(x, gy + 1 * cs, R, R * 0.2, 0, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade * (0.45 + 0.2 * Math.sin(k * 30)); ctx.fillStyle = '#ff9a3a';
        ctx.beginPath(); ctx.ellipse(x, gy, R * 0.6 * (1 - k * 0.4), R * 0.1, 0, 0, 7); ctx.fill();
        break;
      }
      case 'arrive': this.drawX3Arrive(e, x, gy, k, p, sc, cs, dir, rnd, n); break;
    }
    ctx.restore();
  }

  /* 3진의 등장: 전차는 흙먼지를 일으키며 달려 들어오고, 거대 로봇은 하늘에서 쿵 떨어진다.
   * 비행접시는 빛기둥을 타고 내려오고, 구급 마차는 경광등을 번쩍이며 달려온다.
   * 드론 조종사는 홀로그램 발판에서 나타나고, 드릴 창병은 땅을 뚫고 솟아오른다. */
  drawX3Arrive(e, x, gy, k, p, sc, cs, dir, rnd, n) {
    const ctx = this.ctx, col = e.color || '#ffe28a';
    switch (e.sub) {
      case 'cloudjet': case 'jetdive': {                 // 4.7 하늘에서 비스듬히 내리꽂는다: 빛 꼬리 · 착지 고리 · 구름(대성) / 깃털(발키리)
        const q = Math.min(1, k * 3), land = k > 0.3;
        if (land) this.glOnce(e, e.sub === 'cloudjet' ? 'mechstaff' : 'divestrike', x, gy, col, 60 * sc, sc);
        ctx.globalCompositeOperation = 'lighter';
        const sx = x - dir * 160 * sc * (1 - q), sy = gy - 220 * sc * (1 - q);
        ctx.globalAlpha = (1 - q * 0.6) * Math.min(1, p * 2) * 0.7; ctx.strokeStyle = col; ctx.lineWidth = 8 * sc * (1 - q * 0.5);
        ctx.beginPath(); ctx.moveTo(x - dir * 170 * sc, gy - 230 * sc); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4 * sc; ctx.beginPath(); ctx.moveTo(x - dir * 170 * sc, gy - 230 * sc); ctx.lineTo(sx, sy); ctx.stroke();
        if (land) { const qq = (k - 0.3) / 0.7;
          for (let j = 0; j < 2; j++) { const r = qq - j * 0.15; if (r <= 0) continue;
            ctx.globalAlpha = (1 - r) * 0.8; ctx.lineWidth = 3 * sc * (1 - r) + 0.5; ctx.strokeStyle = col;
            ctx.beginPath(); ctx.ellipse(x, gy, (12 + r * 70) * sc, (3 + r * 14) * sc, 0, 0, 7); ctx.stroke(); }
          ctx.globalCompositeOperation = 'source-over';
          if (e.sub === 'cloudjet') for (let i = 0, m = n(6); i < m; i++) { const r0 = rnd(i), side = i % 2 ? 1 : -1;
            x3Smoke(ctx, x + side * (10 + qq * 50 * (0.5 + r0)) * sc, gy - (4 + qq * 10) * sc, (5 + qq * 10) * sc, (1 - qq) * 0.6, '#e8eef8', '#ffffff'); }
          else { ctx.fillStyle = '#ffe48a'; for (let i = 0, m = n(8); i < m; i++) { const r0 = rnd(i), a = -Math.PI * (0.1 + r0 * 0.8);
            ctx.globalAlpha = (1 - qq) * 0.9; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * qq * 70 * sc, gy - 10 * sc + Math.sin(a) * qq * 60 * sc + qq * qq * 50 * sc, 5 * sc, 1.8 * sc, a + qq * 4, 0, 7); ctx.fill(); } }
        }
        break;
      }
      case 'stargate': {                                 // 4.18 별의 대현자: 밤하늘이 열리듯 별자리 원이 그려지고, 그 가운데로 빛기둥과 별비가 내린다
        if (k > 0.35) this.glOnce(e, 'starfall', x, gy, col, 80 * sc, sc);
        ctx.globalCompositeOperation = 'lighter';
        const q = Math.min(1, k * 2), a = Math.min(1, p * 2);
        ctx.globalAlpha = a * 0.25; ctx.fillStyle = '#2a1a5a'; ctx.beginPath(); ctx.ellipse(x, gy - 70 * sc, 60 * sc * q, 60 * sc * q, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = a * 0.9; ctx.strokeStyle = col; ctx.lineWidth = 1.8 * sc;
        ctx.beginPath(); ctx.arc(x, gy - 70 * sc, 52 * sc, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); ctx.stroke();
        const pts = []; for (let i = 0; i < 7; i++) { const b = -Math.PI / 2 + i * Math.PI * 2 / 7, rr = (i % 2 ? 30 : 46) * sc; pts.push([x + Math.cos(b) * rr, gy - 70 * sc + Math.sin(b) * rr]); }
        ctx.beginPath(); pts.forEach(([px, py], i) => { if (i / 7 > q) return; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
        ctx.fillStyle = '#fff6c8'; pts.forEach(([px, py], i) => { if (i / 7 > q) return; ctx.beginPath(); ctx.arc(px, py, 2.4 * sc, 0, 7); ctx.fill(); });
        if (k > 0.3) { const r = (k - 0.3) / 0.7;
          ctx.globalAlpha = (1 - r) * 0.55; ctx.fillStyle = col; ctx.fillRect(x - 12 * sc, gy - 130 * sc, 24 * sc, 130 * sc);
          ctx.globalAlpha = (1 - r); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3 * sc, gy - 130 * sc, 6 * sc, 130 * sc);
          ctx.fillStyle = '#ffd76a'; for (let i = 0, m = n(10); i < m; i++) { const r0 = rnd(i), yy = gy - 140 * sc + ((r * 180 + r0 * 140) % 140) * sc; ctx.fillRect(x + (r0 - 0.5) * 90 * sc, yy, 2.4 * sc, 2.4 * sc); }
          ctx.strokeStyle = col; ctx.lineWidth = 3 * sc * (1 - r) + 0.5; ctx.beginPath(); ctx.ellipse(x, gy, (14 + r * 70) * sc, (3 + r * 14) * sc, 0, 0, 7); ctx.stroke(); }
        break;
      }
      case 'hoverdrop': {                                // 4.18 플라즈마 기동전차: 하늘에서 수직 강하 · 역추진 불꽃 · 착지 충격파와 먼지 · 반중력 고리
        const q = Math.min(1, k * 2.2), land = k > 0.45;
        if (land) this.glOnce(e, 'plasmablast', x, gy, col, 90 * sc, sc);
        ctx.globalCompositeOperation = 'lighter';
        const hy = gy - (1 - q) * 220 * sc - 30 * sc;
        if (!land) { ctx.globalAlpha = 0.85; for (const dx of [-26, 0, 24]) { const g = ctx.createLinearGradient(0, hy, 0, hy + 70 * sc);
          g.addColorStop(0, 'rgba(220,250,255,.9)'); g.addColorStop(1, 'rgba(90,200,255,0)'); ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x + (dx - 5) * sc, hy); ctx.lineTo(x + (dx + 5) * sc, hy); ctx.lineTo(x + dx * sc, hy + (50 + Math.sin(k * 60) * 10) * sc); ctx.closePath(); ctx.fill(); }
          ctx.globalAlpha = 0.3; ctx.fillStyle = col; ctx.fillRect(x - 40 * sc, hy - 30 * sc, 80 * sc, 30 * sc); }
        else { const r = (k - 0.45) / 0.55;
          ctx.strokeStyle = col; for (let j = 0; j < 3; j++) { const qq = Math.min(1, r * 1.6 - j * 0.2); if (qq <= 0 || qq >= 1) continue;
            ctx.globalAlpha = (1 - qq) * 0.85; ctx.lineWidth = 3 * sc * (1 - qq) + 0.5; ctx.beginPath(); ctx.ellipse(x, gy, (16 + qq * 90) * sc, (3 + qq * 16) * sc, 0, 0, 7); ctx.stroke(); }
          ctx.globalCompositeOperation = 'source-over';
          for (let i = 0, m = n(8); i < m; i++) { const r0 = rnd(i), side = i % 2 ? 1 : -1; x3Smoke(ctx, x + side * (20 + r * 70 * (0.5 + r0)) * sc, gy - (3 + r * 12 * r0) * sc, (5 + r * 12) * sc, (1 - r) * 0.55, '#a89c88', '#d8d0c0'); } }
        break;
      }
      case 'dragon': {                                   // 4.15 청룡 군신: 땅에서 솟구친 청룡이 몸을 휘감고 오른다 · 비취 고리
        this.glOnce(e, 'dragonslash', x, gy, col, 70 * sc, sc);
        ctx.globalCompositeOperation = 'lighter';
        const q = Math.min(1, k * 1.6), a = Math.min(1, p * 2);
        ctx.strokeStyle = col; ctx.lineWidth = 7 * sc * (1 - k * 0.5); ctx.globalAlpha = a * 0.8;
        ctx.beginPath();
        for (let i = 0; i <= 28; i++) { const u = i / 28 * q, ang = u * Math.PI * 4 + k * 3, rr = (34 - u * 14) * sc;
          const px = x + Math.cos(ang) * rr, py = gy - u * 150 * sc + Math.sin(ang) * rr * 0.3; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * sc; ctx.stroke();
        const ha = q * Math.PI * 4 + k * 3, hr = (34 - q * 14) * sc, hx = x + Math.cos(ha) * hr, hy = gy - q * 150 * sc + Math.sin(ha) * hr * 0.3;
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(hx, hy, 11 * sc, 6 * sc, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(hx + 4 * sc, hy - 1.5 * sc, 2 * sc, 0, 7); ctx.fill();
        for (let j = 0; j < 2; j++) { const r = Math.min(1, k * 1.5 - j * 0.2); if (r <= 0 || r >= 1) continue;
          ctx.globalAlpha = (1 - r) * 0.8; ctx.lineWidth = 3 * sc * (1 - r) + 0.5; ctx.strokeStyle = col;
          ctx.beginPath(); ctx.ellipse(x, gy, (14 + r * 70) * sc, (3 + r * 14) * sc, 0, 0, 7); ctx.stroke(); }
        break;
      }
      case 'orbit': {                                    // 4.7 태양 위성: 궤도에서 빛기둥을 타고 내려온다 · 땅에 태양 문양
        if (k > 0.5) this.glOnce(e, 'solarburn', x, gy, col, 80 * sc, sc);
        const a = Math.min(1, p * 2), q = Math.min(1, k * 2);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.3; ctx.fillStyle = col; ctx.fillRect(x - 16 * sc, 0, 32 * sc, gy);
        ctx.globalAlpha = a * 0.75; ctx.fillStyle = '#fff8e0'; ctx.fillRect(x - 3 * sc, 0, 6 * sc, gy);
        ctx.globalAlpha = a * 0.7; ctx.strokeStyle = col; ctx.lineWidth = 2 * sc;
        ctx.beginPath(); ctx.ellipse(x, gy, 40 * sc * q, 9 * sc * q, 0, 0, 7); ctx.stroke();
        for (let i = 0; i < 12; i++) { const aa = i / 12 * Math.PI * 2 + k * 2;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(aa) * 44 * sc * q, gy + Math.sin(aa) * 10 * sc * q); ctx.lineTo(x + Math.cos(aa) * 54 * sc * q, gy + Math.sin(aa) * 12.4 * sc * q); ctx.stroke(); }
        break;
      }
      case 'bike': {                                     // 4.7 천둥 라이더: 뒤에서 미끄러져 들어오는 바퀴 자국 · 떨어지는 번개
        if (k > 0.15) this.glOnce(e, 'boltstrike', x + dir * 10 * sc, gy, col, 60 * sc, sc);
        ctx.globalAlpha = 0.45 * Math.min(1, p * 2); ctx.fillStyle = '#20242c';
        const len = 110 * sc * Math.min(1, k * 3);
        ctx.fillRect(Math.min(x, x - dir * len), gy + 1 * sc, len, 2.4 * sc);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, p * 2) * 0.8; ctx.fillStyle = col;
        ctx.fillRect(Math.min(x, x - dir * len * 0.7), gy + 1.4 * sc, len * 0.7, 1.2 * sc);
        for (let i = 0, m = n(6); i < m; i++) { const r0 = rnd(i), q = (k * 2 + r0) % 1;
          ctx.globalAlpha = (1 - q) * 0.9; ctx.fillRect(x - dir * (20 + q * 90) * sc, gy - (2 + r0 * 16) * sc - q * 10 * sc, 2 * sc, 2 * sc); }
        break;
      }
      case 'holo': {                                     // 4.7 홀로그램: 위에서 아래로 훑는 주사선 · 육각 격자로 모습이 맞춰진다
        if (k > 0.6) this.glOnce(e, 'holoburst', x, gy, col, 50 * sc, sc);
        const a = Math.min(1, p * 2), scan = gy - 130 * sc * (1 - Math.min(1, k * 1.6));
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col;
        ctx.globalAlpha = a * 0.9; ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(x - 40 * sc, scan); ctx.lineTo(x + 40 * sc, scan); ctx.stroke();
        ctx.globalAlpha = a * 0.18; ctx.fillStyle = col; ctx.fillRect(x - 36 * sc, scan, 72 * sc, gy - scan);
        ctx.globalAlpha = a * 0.6; ctx.lineWidth = 1 * sc;
        for (let i = 0; i < 4; i++) { const yy = gy - i * 30 * sc; if (yy < scan) continue;
          ctx.beginPath(); for (let j = 0; j <= 6; j++) { const aa = j / 6 * Math.PI * 2; const px = x + Math.cos(aa) * 34 * sc, py = yy + Math.sin(aa) * 6 * sc; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
        break;
      }
      case 'moon': {                                     // 4.7 달빛: 머리 위로 떠오르는 초승달 · 내려앉는 빛 가루
        if (k > 0.4) this.glOnce(e, 'laserhit', x, gy, col, 40 * sc, sc);
        const a = Math.min(1, p * 2), q = Math.min(1, k * 2), my = gy - (60 + q * 70) * sc;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, my, 26 * sc, 0, 7); ctx.fill();
        ctx.globalAlpha = a * 0.9; ctx.fillStyle = '#f4feff';
        ctx.beginPath(); ctx.arc(x, my, 16 * sc, 0.5, Math.PI * 2 - 0.5); ctx.arc(x + 9 * sc, my, 13 * sc, Math.PI * 2 - 0.85, 0.85, true); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col;
        for (let i = 0, m = n(14); i < m; i++) { const r0 = rnd(i), yy = my + ((k * 160 + r0 * 160) % 160) * sc;
          ctx.globalAlpha = a * (0.4 + r0 * 0.5); ctx.fillRect(x + (r0 - 0.5) * 90 * sc, yy, 1.8 * sc, 1.8 * sc); }
        break;
      }
      case 'tank': case 'siren': {
        if (e.sub === 'tank') this.glOnce(e, 'dust', x - dir * 30 * sc, gy, '#e8dcc0', 70 * sc);
        ctx.globalAlpha = 0.4 * Math.min(1, p * 2); ctx.fillStyle = '#2e261c';    // 바퀴 자국
        const len = 80 * sc * Math.min(1, k * 3);
        for (let xx = 0; xx < len; xx += 5 * sc) {
          const px = x - dir * (40 * sc + xx);
          ctx.fillRect(px - 1.2 * sc, gy - 1.5 * sc, 2.4 * sc, 1.6 * sc); ctx.fillRect(px - 1.2 * sc, gy + 2 * sc, 2.4 * sc, 1.6 * sc);
        }
        for (let i = 0, m = n(9); i < m; i++) {          // 뒤로 치솟는 흙먼지
          const r0 = rnd(i), q = Math.min(1, k * 1.4);
          x3Smoke(ctx, x - dir * (24 + q * (30 + r0 * 50) + i * 5) * sc, gy - (3 + q * 22 * r0) * sc,
                  (5 + q * 13) * sc * (0.7 + r0 * 0.6), (1 - k) * 0.6, '#b8a888', '#e0d4bc');
        }
        if (k < 0.45) {                                  // 속도선
          const q = k / 0.45;
          ctx.globalAlpha = (1 - q) * 0.7; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6 * sc;
          for (let i = 0; i < 4; i++) {
            const yy = gy - (12 + i * 11) * sc, x0 = x - dir * (48 + rnd(i + 20) * 14) * sc;
            ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - dir * (24 + rnd(i + 30) * 30) * sc * (1 - q * 0.5), yy); ctx.stroke();
          }
        }
        if (e.sub === 'siren') {                         // 번쩍이는 경광 빛: 좌우로 쓸고 지나가는 빨강·파랑 빛줄기
          const on = Math.floor(k * 14) % 2, ly = gy - 60 * sc, a = k * 24, L = Math.cos(a) * 140 * sc;
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = on ? '#ff4a4a' : '#4a8aff';
          ctx.globalAlpha = p * (0.35 + Math.max(0, Math.sin(a)) * 0.35);
          ctx.beginPath(); ctx.arc(x, ly, (10 + Math.sin(k * 40) * 3) * sc, 0, 7); ctx.fill();
          ctx.globalAlpha = p * 0.2;
          ctx.beginPath(); ctx.moveTo(x, ly - 3 * sc); ctx.lineTo(x + L, ly - 16 * sc); ctx.lineTo(x + L, ly + 12 * sc); ctx.lineTo(x, ly + 3 * sc); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = p * 0.16;
          ctx.beginPath(); ctx.ellipse(x, gy + 1 * cs, 60 * sc, 9 * sc, 0, 0, 7); ctx.fill();
        }
        break;
      }
      case 'robot': {                                    // 하늘에서 떨어진다: 낙하 궤적 · 착지 충격 · 갈라진 땅
        this.glOnce(e, 'rocketpunch', x, gy + 20 * sc, '#ffd23a', 60, sc);
        if (k < 0.3) {
          const q = k / 0.3;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - q) * 0.75; ctx.fillStyle = '#bfe4ff';
          const top = gy - 600 * cs, bot = gy - 40 * sc;
          for (const o of [-14, 0, 14]) { const w = (o ? 1.4 : 3.2) * sc; ctx.fillRect(x + o * sc - w, top, w * 2, bot - top); }
          ctx.globalAlpha = (1 - q) * 0.9; ctx.fillStyle = '#ffb03c';                 // 발밑 역분사 불꽃
          for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + d * 12 * sc, gy - 4 * sc, (6 + q * 20) * sc, 4 * sc, 0, 0, 7); ctx.fill(); }
          ctx.globalCompositeOperation = 'source-over';
        }
        const fade = Math.min(1, p * 2.2), R = 90 * sc;
        ctx.globalAlpha = fade * 0.8; ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2.4 * cs;
        for (let i = 0; i < 7; i++) {
          const a0 = (i / 7) * Math.PI * 2 + rnd(i) * 0.5, L = R * (0.4 + rnd(i + 9) * 0.5) * Math.min(1, k * 7);
          ctx.beginPath(); ctx.moveTo(x, gy);
          for (let j = 1; j <= 4; j++) { const d = L * j / 4, jit = (rnd(i * 5 + j) - 0.5) * 0.5; ctx.lineTo(x + Math.cos(a0 + jit) * d, gy + Math.sin(a0 + jit) * d * 0.2); }
          ctx.stroke();
        }
        ctx.globalAlpha = fade * 0.35; ctx.fillStyle = '#2a2018';
        ctx.beginPath(); ctx.ellipse(x, gy + 1 * cs, R * 0.45, R * 0.09, 0, 0, 7); ctx.fill();
        if (k < 0.55) {
          const q = k / 0.55;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - q) * 0.8; ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 5 * sc * (1 - q) + 0.5;
          ctx.beginPath(); ctx.ellipse(x, gy - 2 * cs, R * (0.3 + q * 1.5), R * (0.07 + q * 0.3), 0, 0, 7); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        for (let i = 0, m = n(12); i < m; i++) {
          const side = i % 2 ? 1 : -1, r0 = rnd(i + 40), q = Math.min(1, k * 1.4);
          x3Smoke(ctx, x + side * (14 + q * R * (0.5 + r0 * 0.7)), gy - (4 + q * 20 * r0) * cs,
                  (6 + q * 18) * sc * (0.7 + r0 * 0.6), (1 - k) * 0.6, '#a8988a', '#d6cab6');
        }
        break;
      }
      case 'ufo': {                                      // 하늘에서 내려오는 빛기둥 · 기둥을 타고 내려가는 고리 · 도는 빛 알갱이
        this.glOnce(e, 'ufoburst', x, gy, col, 50, sc);
        const a = Math.min(1, k * 5) * Math.pow(p, 0.7), w = (20 + Math.sin(k * 26) * 3) * sc, top = -20;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.3; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(x - w * 0.7, top); ctx.lineTo(x + w * 0.7, top); ctx.lineTo(x + w * 1.5, gy); ctx.lineTo(x - w * 1.5, gy); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#effff6';
        ctx.fillRect(x - w * 0.22, top, w * 0.44, gy - top);
        ctx.strokeStyle = col; ctx.lineWidth = 1.8 * sc;
        for (let i = 0, m = n(5); i < m; i++) {
          const q = (k * 1.6 + i / m) % 1, yy = top + (gy - top) * q, rx = w * (0.8 + q * 0.8);
          ctx.globalAlpha = a * (0.3 + q * 0.6);
          ctx.beginPath(); ctx.ellipse(x, yy, rx, rx * 0.26, 0, 0, 7); ctx.stroke();
        }
        ctx.fillStyle = '#d8ffe8';
        for (let i = 0, m = n(10); i < m; i++) {
          const ang = k * 5 + i * 0.63, rr = (24 + (i % 3) * 10) * sc, py = gy - (10 + ((k * 90 + i * 17) % 110)) * sc;
          ctx.globalAlpha = a * 0.8;
          const px = x + Math.cos(ang) * rr; ctx.save(); ctx.translate(px, py); ctx.rotate(0.785);
          ctx.fillRect(-1.6 * sc, -1.6 * sc, 3.2 * sc, 3.2 * sc); ctx.restore();
        }
        ctx.globalAlpha = a * 0.55; ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(x, gy, w * 2.2, w * 0.4, 0, 0, 7); ctx.fill();
        break;
      }
      case 'drone': {                                    // 홀로그램 발판: 격자 원판 · 위로 훑는 스캔 · 날아드는 드론 궤적
        const a = Math.min(1, k * 6) * Math.min(1, p * 2), cyan = '#5ad8ff', R = 34 * sc;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = cyan;
        ctx.beginPath(); ctx.ellipse(x, gy, R, R * 0.24, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = a * 0.8; ctx.strokeStyle = cyan; ctx.lineWidth = 1.4 * sc;
        ctx.beginPath(); ctx.ellipse(x, gy, R, R * 0.24, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, gy, R * 0.62, R * 0.15, 0, 0, 7); ctx.stroke();
        ctx.lineWidth = 0.9 * sc; ctx.globalAlpha = a * 0.45;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * R * 0.36, gy - R * 0.2 * Math.sqrt(1 - (i * 0.36) * (i * 0.36))); ctx.lineTo(x + i * R * 0.36, gy + R * 0.2 * Math.sqrt(1 - (i * 0.36) * (i * 0.36))); ctx.stroke(); }
        const sy = gy - Math.min(1, k * 1.6) * 92 * sc;                             // 위로 훑는 스캔 막
        ctx.globalAlpha = a * 0.5; ctx.fillStyle = cyan;
        ctx.beginPath(); ctx.ellipse(x, sy, R * 0.85, R * 0.2, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = a * 0.12; ctx.fillRect(x - R * 0.85, sy, R * 1.7, gy - sy);
        for (let i = 0; i < 3; i++) {                    // 뒤에서 날아드는 드론 셋의 빛 궤적
          const q = Math.min(1, k * 2.2 - i * 0.12);
          if (q <= 0 || q >= 1) continue;
          const ex = x + (i - 1) * 16 * sc, ey = gy - (96 + i * 6) * sc;
          const sx2 = ex - dir * 220 * sc, sy2 = ey - 120 * sc;
          const hx = sx2 + (ex - sx2) * q, hy = sy2 + (ey - sy2) * q * (2 - q);
          ctx.globalAlpha = a * (1 - q * 0.5) * 0.8; ctx.strokeStyle = cyan; ctx.lineWidth = 2.2 * sc;
          ctx.beginPath(); ctx.moveTo(hx - dir * 26 * sc, hy - 12 * sc * (1 - q)); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(hx, hy, 2.4 * sc, 0, 7); ctx.fill();
        }
        break;
      }
      case 'dozer': {                                    // 4.4 불도저: 흙더미를 밀며 들어온다 · 바퀴 자국 · 흙먼지
        this.glOnce(e, 'dust', x + dir * 20 * sc, gy, '#e8dcc0', 70 * sc);
        ctx.globalAlpha = 0.4 * Math.min(1, p * 2); ctx.fillStyle = '#2e261c';
        const len = 70 * sc * Math.min(1, k * 3);
        for (let xx = 0; xx < len; xx += 5 * sc) { const px = x - dir * (34 * sc + xx); ctx.fillRect(px - 1.2 * sc, gy - 1.5 * sc, 2.4 * sc, 1.6 * sc); ctx.fillRect(px - 1.2 * sc, gy + 2 * sc, 2.4 * sc, 1.6 * sc); }
        const q = Math.min(1, k * 2), hx = x + dir * (44 + q * 8) * sc;
        ctx.globalAlpha = Math.min(1, p * 2.5); ctx.fillStyle = '#8a6e4a';          // 밀려온 흙더미
        ctx.beginPath(); ctx.moveTo(hx - 14 * sc, gy); ctx.quadraticCurveTo(hx, gy - 22 * sc * (0.6 + q * 0.4), hx + 16 * sc, gy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6a5236'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(hx + (i * 6 - 9) * sc, gy - (2 + (i % 2) * 4) * sc, 2 * sc, 0, 7); ctx.fill(); }
        for (let i = 0, m = n(9); i < m; i++) {
          const r0 = rnd(i), qq = Math.min(1, k * 1.4);
          x3Smoke(ctx, x + dir * (30 + qq * (20 + r0 * 40)) * sc, gy - (3 + qq * 20 * r0) * sc, (5 + qq * 12) * sc * (0.7 + r0 * 0.6), (1 - k) * 0.55, '#b8a888', '#e0d4bc');
        }
        break;
      }
      case 'snow': {                                     // 4.4 빙수 수레: 눈보라가 몰아치고 얼음 고리가 피어난다
        this.glOnce(e, 'snowburst', x, gy, '#bfe8ff', 40, sc);
        const a = Math.min(1, k * 5) * Math.min(1, p * 2);
        ctx.fillStyle = '#ffffff';
        for (let i = 0, m = n(26); i < m; i++) {
          const r0 = rnd(i), px = x + (r0 - 0.5) * 160 * sc + Math.sin(k * 6 + i) * 10 * sc, py = gy - 150 * sc + ((k * 180 + r0 * 150) % 150) * sc;
          ctx.globalAlpha = a * (0.5 + r0 * 0.5); ctx.beginPath(); ctx.arc(px, py, (1 + r0 * 1.6) * sc, 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#bfe8ff';
        for (let j = 0; j < 2; j++) {
          const q = Math.min(1, k * 1.6 - j * 0.25); if (q <= 0) continue;
          ctx.globalAlpha = (1 - q) * 0.8; ctx.lineWidth = 3 * sc * (1 - q) + 0.5;
          ctx.beginPath(); ctx.ellipse(x, gy, (14 + q * 60) * sc, (3 + q * 12) * sc, 0, 0, 7); ctx.stroke();
          for (let i = 0; i < 6; i++) {                   // 고리를 따라 돋는 얼음 별
            const aa = i / 6 * Math.PI * 2 + j, px = x + Math.cos(aa) * (14 + q * 60) * sc, py = gy + Math.sin(aa) * (3 + q * 12) * sc;
            ctx.beginPath(); ctx.moveTo(px - 3 * sc, py); ctx.lineTo(px + 3 * sc, py); ctx.moveTo(px, py - 3 * sc); ctx.lineTo(px, py + 3 * sc); ctx.stroke();
          }
        }
        break;
      }
      case 'saber': {                                    // 4.4 광선검: 칼날이 켜지는 빛기둥 · 웅 하고 퍼지는 고리
        this.glOnce(e, 'sabercut', x, gy, col, 40, sc);
        const a = Math.min(1, p * 1.8), q = Math.min(1, k * 4);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = col;
        ctx.fillRect(x - 5 * sc, gy - 140 * sc * q, 10 * sc, 140 * sc * q);
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#f4feff';
        ctx.fillRect(x - 1.5 * sc, gy - 140 * sc * q, 3 * sc, 140 * sc * q);
        ctx.strokeStyle = col;
        for (let j = 0; j < 3; j++) {
          const qq = Math.min(1, k * 1.8 - j * 0.2); if (qq <= 0 || qq >= 1) continue;
          ctx.globalAlpha = (1 - qq) * 0.8; ctx.lineWidth = 2.4 * sc * (1 - qq) + 0.5;
          ctx.beginPath(); ctx.ellipse(x, gy - 40 * sc, (10 + qq * 50) * sc, (10 + qq * 50) * sc, 0, 0, 7); ctx.stroke();
        }
        break;
      }
      case 'rail': {                                     // 4.4 레일건: 안으로 조여드는 충전 고리 · 마지막에 터지는 섬광
        const a = Math.min(1, p * 2);
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col;
        for (let j = 0; j < 4; j++) {
          const q = (k * 2.2 + j / 4) % 1, rr = (70 - q * 62) * sc;
          ctx.globalAlpha = a * q * 0.8; ctx.lineWidth = 2 * sc;
          ctx.beginPath(); ctx.ellipse(x, gy - 36 * sc, rr, rr * 0.9, 0, 0, 7); ctx.stroke();
        }
        if (k > 0.55) { this.glOnce(e, 'railhit', x, gy - 6 * sc, col, 40, sc);
          const q = (k - 0.55) / 0.45; ctx.globalAlpha = (1 - q) * 0.7; ctx.fillStyle = '#e8fcff';
          ctx.beginPath(); ctx.arc(x, gy - 36 * sc, (8 + q * 26) * sc, 0, 7); ctx.fill(); }
        ctx.globalAlpha = a * 0.5; ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(x, gy, 26 * sc, 5 * sc, 0, 0, 7); ctx.fill();
        break;
      }
      case 'drill': {                                    // 땅을 뚫고 솟아오른다: 구멍 · 튀는 흙덩이 · 불꽃
        this.glOnce(e, 'spark', x, gy - 8 * sc, '#ffd35a', 30 * sc);
        const fade = Math.min(1, p * 2.4);
        ctx.globalAlpha = fade * 0.6; ctx.fillStyle = '#2a2018';
        ctx.beginPath(); ctx.ellipse(x, gy + 1 * cs, 24 * sc, 5 * sc, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = fade * 0.8; ctx.strokeStyle = '#7a6044'; ctx.lineWidth = 3 * sc;
        ctx.beginPath(); ctx.ellipse(x, gy, 26 * sc, 5.5 * sc, 0, Math.PI, 0); ctx.stroke();
        for (let i = 0, m = n(12); i < m; i++) {
          const r0 = rnd(i), ang = -Math.PI * (0.22 + r0 * 0.56), v = (120 + rnd(i + 20) * 130) * sc, tt = k * 1.1;
          const px = x + Math.cos(ang) * v * tt, py = gy - 4 * sc + Math.sin(ang) * v * tt + 360 * sc * tt * tt;
          if (py > gy + 2 * sc) continue;
          ctx.globalAlpha = 1; ctx.fillStyle = i % 3 ? '#6a5238' : '#8a7050';
          const sz = (1.6 + rnd(i + 40) * 2.4) * sc;
          ctx.save(); ctx.translate(px, py); ctx.rotate(k * 8 * (r0 - 0.5)); ctx.fillRect(-sz, -sz * 0.8, sz * 2, sz * 1.6); ctx.restore();
        }
        for (let i = 0, m = n(6); i < m; i++) {
          const r0 = rnd(i + 70), q = Math.min(1, k * 1.5), side = i % 2 ? 1 : -1;
          x3Smoke(ctx, x + side * (8 + q * 30 * (0.5 + r0)) * sc, gy - (4 + q * 12 * r0) * sc, (4 + q * 10) * sc, (1 - k) * 0.55, '#a89070', '#d4c0a0');
        }
        break;
      }
    }
  }

  /* 4.18: 그리다가 한 번이라도 예외가 나면 save 가 풀리지 않은 채 쌓이고(흔들림 이동이 누적돼 화면이 흘러간다),
   * 그 프레임 뒤의 HUD · 결과 처리까지 건너뛰었다. 상태를 되돌리고 같은 오류는 한 번만 알린다. */
  render(battle, dt, fxDt) {
    try { this.renderFrame(battle, dt, fxDt); }
    catch (e) {
      const ctx = this.ctx;
      ctx._wrap = false; ctx._shadeRect = false; ctx._depth = false; ctx._noInk = false; ctx._skipInk = false;
      if (typeof ctx.reset === 'function') ctx.reset();
      else for (let i = 0; i < 64; i++) ctx.restore();
      const dpr = this.cv.width / (this.w || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const msg = String(e && e.stack || e);
      if (this._lastErr !== msg) { this._lastErr = msg; console.error(e); }
    }
  }

  renderFrame(battle, dt, fxDt) {
    this.trackFrame(dt);
    this._fdt = Math.min(0.1, dt || 0);
    this.outcome = battle.state === 'win' ? 'win' : (battle.state === 'play' ? null : 'lose');
    this._battle = battle;
    this.clock = (this.clock || 0) + dt;             // 전투가 끝나 시간이 멈춰도 도는 시계
    this.showDmg = typeof Settings === 'undefined' || Settings.get('dmgNums');
    const camBefore = this.cam;
    this.follow(battle, dt);
    const ctx = this.ctx;
    if (!this._rmq) this._rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = this._rmq.matches;
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
    const look = (battle.stage && battle.stage.look) || 'meadow';
    this.drawBackground(look);
    this.drawProps(look);
    this.drawCastle(battle.allyCastle, false);
    this.drawCastle(battle.enemyCastle, true);

    // 3.10: 그릴 순서 목록은 프레임마다 새로 만들지 않고 다시 쓴다
    const all = this._drawList || (this._drawList = []);
    all.length = 0;
    for (const f of battle.allies) all.push(f);
    for (const f of battle.enemies) all.push(f);
    all.sort(byRowX);
    let onScreen = 0;
    for (const f of all) { const sx = this.screenX(f.x); if (sx > -140 && sx < this.w + 140) onScreen++; }
    this._onScreen = onScreen;
    // 3.12: 자동 품질에서 병사가 빽빽하면(발열의 주범) 잉크 테두리를 끄고, 루프에 프레임을 늦추라고 알린다.
    // 켜고 끄는 문턱을 달리 둬 경계에서 깜빡이지 않게 한다.
    const auto = typeof Settings === 'undefined' || Settings.get('quality') === 'auto';
    if (!auto) this.crowded = false;
    else if (onScreen >= CROWD_ON) this.crowded = true;
    else if (onScreen <= CROWD_OFF) this.crowded = false;
    const ink = MODEL.ink;
    if (this.crowded) MODEL.ink = false;
    for (const f of all) this.drawFighter(f);
    MODEL.ink = ink;
    if (battle.burrowers) for (const b of battle.burrowers) this.drawBurrow(b);

    this.drawShots(battle);
    this.drawFx(battle);
    this.drawWeather(look);
    this.drawSandstorm(battle);

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
    if (this.glfx && this.glfx.ok) this.glfx.floorY = this.rowY(2) + 14 * this.cs;
    // 병사 그림자(부품마다 드리우는 짧은 그림자)는 절전·느린 기기에서 끈다. 잉크 테두리는 늘 켠다.
    // 3.8: 자동 품질에서 병사가 화면에 빽빽하면 그림자도 끈다 (그림자 있는 면은 두 번 칠해진다)
    const q = typeof Settings !== 'undefined' ? Settings.get('quality') : 'auto';
    // 3.10: 부품 그림자는 병사 그리는 값의 1/3 남짓을 먹는다. 자동 품질은 프레임이 한 번 밀리면 그림자부터 끈다
    // (예전엔 파티클을 두 단계 다 줄인 뒤에야 껐다). 높음은 그대로 켜 둔다.
    MODEL.depth = q === 'high' ? this.fxq >= 0.5 : (this.fxq >= 1 && (this._onScreen || 0) <= CROWD_NO_SHADOW);
    const g = this.glfx;
    if (!g || !g.ok) return;
    g.quality = this.fxq < 0.5 ? 0.45 : (this.fxq < 1 ? 0.7 : 1);
    g.setOffset(shakeX, shakeY);
    // 3.9: 파티클은 화면 좌표에 산다. 지난번 연출을 그렸을 때의 카메라에서 움직인 만큼 같이 민다
    // (손으로 끌어 옮긴 것까지 — 예전엔 렌더 안에서 움직인 만큼만 밀어 끌면 파티클이 화면에 붙어 있었다)
    const from = this._glCam === undefined ? camBefore : this._glCam;
    if (this._glZoom !== undefined && this._glZoom !== this.zoom) g.clear();   // 배율이 바뀌면 자리 계산이 틀어진다
    g.update(dt, (from - this.cam) * this.zoom);
    this._glCam = this.cam; this._glZoom = this.zoom;
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
      // 3.5: 폰 가로 화면(높이 390)에선 h*0.3 이 미니맵·보스 체력바와 겹쳤다. 그 아래로 내린다.
      const ty = Math.max(this.h * 0.3, 136 + this.safeTop + fs) - rise;
      ctx.strokeText(text, this.w / 2, ty);
      ctx.fillStyle = '#ffcf70';
      ctx.fillText(text, this.w / 2, ty);
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

/* ---------------- 4.3 3진 공용 부품 ----------------
 * 3진 여섯(드릴 창병 · 구급 마차 · 공성 전차 · 비행접시 · 거대 로봇 · 드론 조종사)만 쓰는 정밀 부품.
 * 큰 면은 '#rrggbb' 로 칠해 잉크 테두리와 그림자를 받고, 잔무늬·빛은 rgb()/rgba() 로 칠해 테두리 없이 얹는다. */
const _x3Hex = {};
function x3Hex(hex, k) {                     // shade 와 같지만 '#rrggbb' 로 돌려준다 (잉크 테두리를 받게)
  const key = hex + k;
  if (_x3Hex[key]) return _x3Hex[key];
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return (_x3Hex[key] = '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1));
}
/* 굴러가는 바퀴: 타이어 · 휠 · 바퀴살 · 윗면 빛 */
function x3Wheel(S, x, y, r, rot, tire, rim) {
  const { ctx } = S;
  ctx.fillStyle = S.flash ? '#fff' : tire;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = S.flash ? '#fff' : rim;
  ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, 7); ctx.fill();
  if (S.flash || !MODEL.ink) return;
  ctx.save(); ctx._skipInk = true;
  ctx.strokeStyle = shade(rim, -0.42); ctx.lineWidth = Math.max(0.8, r * 0.13);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + i * 1.2566;
    ctx.moveTo(x + Math.cos(a) * r * 0.16, y + Math.sin(a) * r * 0.16);
    ctx.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
  }
  ctx.stroke();
  ctx.fillStyle = shade(rim, 0.45); ctx.beginPath(); ctx.arc(x, y, r * 0.17, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = Math.max(0.8, r * 0.12);
  ctx.beginPath(); ctx.arc(x, y, r * 0.82, -2.7, -1.3); ctx.stroke();
  ctx.restore(); ctx._skipInk = false;
}
/* 은은한 빛 (가산 합성). a 는 세기 */
function x3Glow(S, x, y, r, color, a) {
  if (S.flash || a <= 0) return;
  const { ctx } = S;
  const ink0 = ctx._skipInk; ctx.save(); ctx._skipInk = true;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= Math.min(1, a);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.globalAlpha *= 0.45;
  ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 7); ctx.fill();
  ctx.restore(); ctx._skipInk = ink0;   // 4.18: 바깥 블록의 잉크 끔을 되살리지 않게
}
/* 연기 한 줌 */
function x3Puff(S, x, y, r, a, color) {
  if (S.flash || !S.live || a <= 0.01) return;
  const { ctx } = S;
  const ink0 = ctx._skipInk; ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= Math.min(0.85, a);
  ctx.fillStyle = color || '#d8d8d8';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7); ctx.arc(x + r * 0.75, y + r * 0.25, r * 0.7, 0, 7); ctx.arc(x - r * 0.65, y + r * 0.3, r * 0.6, 0, 7);
  ctx.fill();
  ctx.restore(); ctx._skipInk = ink0;   // 4.18: 바깥 블록의 잉크 끔을 되살리지 않게
}
/* 4.7 홀로그램 대마도사: 떠다니는 반투명 룬 판 (화면이 아니라 몸 좌표) */
function holoPanel(ctx, s, x, y, a, acc) {
  const ink0 = ctx._skipInk; ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= a;
  ctx.fillStyle = acc; ctx.globalAlpha *= 0.22; ctx.fillRect(x - 6 * s, y - 8 * s, 12 * s, 16 * s);
  ctx.globalAlpha /= 0.22; ctx.strokeStyle = acc; ctx.lineWidth = 1 * s; ctx.strokeRect(x - 6 * s, y - 8 * s, 12 * s, 16 * s);
  ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 4 * s); ctx.lineTo(x + 3 * s, y - 4 * s); ctx.moveTo(x, y - 4 * s); ctx.lineTo(x, y + 4 * s);
  ctx.moveTo(x - 3 * s, y + 1 * s); ctx.lineTo(x + 2 * s, y + 4 * s); ctx.stroke();
  ctx.restore(); ctx._skipInk = ink0;   // 4.18: 바깥 블록의 잉크 끔을 되살리지 않게
}
/* 4.7 제트팩 발키리: 제트팩에서 위로 펼친 금속 깃 날개 하나 (back 이면 뒤쪽, 어둡게) */
function valkWing(S, t, back) {
  const { ctx, s } = S;
  const flap = Math.sin(t * 3.2) * 0.08 + (S.moving ? 0.1 : 0);
  ctx.save(); ctx.translate(back ? -14 * s : -11 * s, -40 * s); ctx.rotate(back ? -0.35 - flap : -0.15 - flap * 0.8);
  for (let i = 0; i < 6; i++) {
    const L = (44 - i * 4.4) * s, a = -2.25 + i * 0.3;
    const x1 = Math.cos(a) * L, y1 = Math.sin(a) * L;
    ctx.fillStyle = S.flash ? '#fff' : (back ? (i % 2 ? '#7a828e' : '#8a929e') : (i % 2 ? '#c8ced6' : '#dfe4ea'));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.12) * L * 0.55, Math.sin(a - 0.12) * L * 0.55);
    ctx.quadraticCurveTo(Math.cos(a - 0.06) * L * 0.95, Math.sin(a - 0.06) * L * 0.95, x1, y1);
    ctx.lineTo(Math.cos(a + 0.16) * L * 0.6, Math.sin(a + 0.16) * L * 0.6); ctx.closePath(); ctx.fill();
  }
  if (!S.flash && !back && MODEL.ink) {                       // 깃 끝의 빛줄
    ctx.save(); ctx._skipInk = true; ctx.strokeStyle = S.acc; ctx.lineWidth = 1 * s; ctx.globalAlpha *= 0.8;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const L = (44 - i * 4.4) * s * 0.92, a = -2.25 + i * 0.3; ctx.moveTo(Math.cos(a) * L * 0.62, Math.sin(a) * L * 0.62); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); }
    ctx.stroke(); ctx.restore(); ctx._skipInk = false;
  }
  ctx.restore();
}
/* 연출용 연기 한 줌 (화면 좌표): 어두운 바탕 위에 밝은 윗면을 얹어 부피를 낸다 */
function x3Smoke(ctx, x, y, r, a, dark, light) {
  if (a <= 0.01 || r <= 0) return;
  ctx.globalAlpha = Math.min(0.9, a);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 7);
  ctx.moveTo(x + r * 1.52, y + r * 0.2); ctx.arc(x + r * 0.8, y + r * 0.2, r * 0.72, 0, 7);
  ctx.moveTo(x - r * 0.08, y + r * 0.28); ctx.arc(x - r * 0.7, y + r * 0.28, r * 0.62, 0, 7);
  ctx.fill();
  ctx.globalAlpha = Math.min(0.9, a) * 0.85;
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.48, y - r * 0.22); ctx.arc(x - r * 0.18, y - r * 0.22, r * 0.66, 0, 7);
  ctx.moveTo(x + r * 1.04, y - r * 0.02); ctx.arc(x + r * 0.62, y - r * 0.02, r * 0.42, 0, 7);
  ctx.fill();
}
/* 작은 드론 하나 (옆모습: 프로펠러 둘 · 몸통 · 카메라 · 깜빡이는 불) */
function x3Drone(S, x, y, k, tilt, t, acc) {
  const { ctx } = S;
  const s = S.s * k;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  ctx.strokeStyle = S.flash ? '#fff' : '#2a3038'; ctx.lineWidth = 1.6 * s;
  ctx.beginPath(); ctx.moveTo(-9 * s, -3 * s); ctx.lineTo(9 * s, -3 * s); ctx.stroke();          // 팔
  for (const d of [-1, 1]) {
    ctx.fillStyle = S.flash ? '#fff' : '#2a3038';
    ctx.fillRect(d * 9 * s - 1.2 * s, -6 * s, 2.4 * s, 3.4 * s);                                    // 모터
    if (!S.flash) {                                                                                // 돌아가는 날개
      ctx.save(); ctx._skipInk = true;
      ctx.fillStyle = 'rgba(230,240,250,.45)';
      ctx.beginPath(); ctx.ellipse(d * 9 * s, -6.6 * s, 7 * s, 1.2 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.8 * s;
      const w = Math.cos(t * 50 + d) * 6.5 * s;
      ctx.beginPath(); ctx.moveTo(d * 9 * s - w, -6.6 * s); ctx.lineTo(d * 9 * s + w, -6.6 * s); ctx.stroke();
      ctx.restore(); ctx._skipInk = false;
    }
  }
  ctx.fillStyle = S.flash ? '#fff' : '#3a4654';
  ctx.beginPath(); roundRectPath(ctx, -6 * s, -4.4 * s, 12 * s, 5.6 * s, 2.4 * s); ctx.fill();     // 몸통
  if (!S.flash) {
    ctx.save(); ctx._skipInk = true;
    ctx.fillStyle = acc; ctx.fillRect(-4.4 * s, -3.6 * s, 8.8 * s, 1.3 * s);                       // 띠
    ctx.fillStyle = '#1a1e24'; ctx.beginPath(); ctx.arc(1.5 * s, 2.4 * s, 2 * s, 0, 7); ctx.fill(); // 카메라
    ctx.fillStyle = '#7fe8ff'; ctx.beginPath(); ctx.arc(2.4 * s, 2.6 * s, 0.8 * s, 0, 7); ctx.fill();
    const on = Math.floor(t * 3 + x) % 2 === 0;
    ctx.fillStyle = on ? '#ff4a4a' : '#5aff7a'; ctx.beginPath(); ctx.arc(-5 * s, -1.2 * s, 0.9 * s, 0, 7); ctx.fill();
    ctx.restore(); ctx._skipInk = false;
    x3Glow(S, -5 * s, -1.2 * s, 1.2 * s, Math.floor(t * 3 + x) % 2 === 0 ? '#ff4a4a' : '#5aff7a', 0.5);
  }
  ctx.restore();
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
    lw: 3.6 * s
  };
  const col = S.col, acc = S.acc, tun = S.tun;
  const F3 = c => (flash ? '#ffffff' : c);          // 4.1 3진 그림: 맞으면 하얗게
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 2.8: 왼쪽 위에서 오는 빛. 부품마다 오른쪽 아래로 짧은 그림자를 드리워 겹친 부위가 떠 보인다.
  // 그림자 거리는 변환을 따르지 않으므로(캔버스 픽셀) 지금 배율을 읽어 맞춘다.
  if (!flash && MODEL.depth) {
    const m = ctx.getTransform();
    const px = Math.hypot(m.a, m.b) * s;
    ctx.shadowColor = 'rgba(6,10,18,.38)';
    ctx.shadowOffsetX = px * 0.9;
    ctx.shadowOffsetY = px * 1.1;
    ctx.shadowBlur = 0;
  } else if (ctx.shadowColor !== 'rgba(0, 0, 0, 0)') ctx.shadowColor = 'transparent';   // 4.5: 남은 그림자 설정이 새지 않게
  S.ink = flash ? '#ffffff' : INK;
  // 병종마다 직접 칠하는 부위(짐승·기계·보스 몸통)에도 같은 잉크 테두리를 두른다
  const autoInk = MODEL.ink && !flash;
  const depthOn = !flash && MODEL.depth;
  const wrapped = autoInk || depthOn;                // 4.2: 잉크가 꺼져도 그림자를 다루려고 감싼다
  // 4.18: 감싼 메서드는 컨텍스트마다 한 번만 붙이고 깃발로 켜고 끈다. 예전엔 병사마다 붙였다 delete 해서
  // 컨텍스트 객체가 느린 사전 모드로 떨어져 렌더러의 모든 ctx.* 호출이 느려졌다.
  if (!ctx._wrapped) installWrap(ctx);
  if (wrapped) { ctx._wrap = true; ctx._inkW = 0.95 * s; ctx._noInk = !autoInk; ctx._depth = depthOn; }
  if (depthOn) ctx._shadeRect = true;                // 4.5: 사각형도 같은 그림자 규칙으로
  if (HUMANOID[st.shape]) armSwing(S);
  if (st.evo && !st.bigEvo) (NO_CAPE[st.shape] ? evoBanner : evoCape)(S);   // 진화: 등 뒤로 망토, 기계·짐승은 군기

  switch (st.shape) {
    /* ---------------------- 왕국군 ---------------------- */
    /* ---------------------- 3.4 극적인 진화 ----------------------
     * 진화 전과 실루엣부터 달라지는 병종들. 탈것·후광·떠다니는 몸 등. */
    case 'knight_evo': {                                       // 성검 기사: 백마를 탄 기사
      const gait = S.moving ? phase * 1.4 : 0;
      const hc = S.flash ? '#fff' : '#eeeae0', hd = S.flash ? '#fff' : '#c9c2b0';
      ctx.strokeStyle = hd; ctx.lineWidth = 4 * s;              // 말 다리
      for (let i = 0; i < 4; i++) {
        const x = (i < 2 ? -14 : 12) * s + (i % 2) * 4 * s, sw = Math.sin(gait + i * 1.6) * (S.moving ? 7 : 1) * s;
        ctx.beginPath(); ctx.moveTo(x, -22 * s); ctx.lineTo(x + sw * 0.6, -11 * s); ctx.lineTo(x + sw, 0); ctx.stroke();
      }
      ctx.fillStyle = hc;                                       // 몸통
      ctx.beginPath(); ctx.ellipse(0, -27 * s, 21 * s, 10 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath();                                          // 목·머리
      ctx.moveTo(14 * s, -32 * s); ctx.lineTo(24 * s, -48 * s); ctx.lineTo(34 * s, -44 * s);
      ctx.lineTo(32 * s, -38 * s); ctx.lineTo(22 * s, -26 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#f0d27a';             // 갈기·꼬리
      ctx.beginPath(); ctx.moveTo(14 * s, -34 * s); ctx.lineTo(22 * s, -50 * s); ctx.lineTo(18 * s, -36 * s); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : '#f0d27a'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(-20 * s, -30 * s); ctx.quadraticCurveTo(-30 * s, -26 * s + Math.sin(phase) * 3 * s, -28 * s, -14 * s); ctx.stroke();
      ctx.fillStyle = S.flash ? '#fff' : '#8e2f3a';             // 마의
      ctx.beginPath(); ctx.moveTo(-14 * s, -34 * s); ctx.lineTo(10 * s, -34 * s); ctx.lineTo(12 * s, -20 * s); ctx.lineTo(-16 * s, -20 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = acc; ctx.fillRect(-16 * s, -22 * s, 28 * s, 2 * s);
      ctx.save(); ctx.translate(-2 * s, -18 * s);               // 기수
      cape(S, -1, '#f4f1e8', 1.2);
      torso(S, 4.6 * s); head(S, 'plume');
      armWeapon(S, -1.35 + atk * 2.1, () => {                   // 빛나는 대검
        if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.35; line(S, 6 * s, 0, 64 * s, 0, 11 * s, '#fff6c8'); ctx.restore(); ctx._skipInk = false; }
        line(S, 0, 0, 62 * s, 0, 6 * s, acc);
        line(S, 5 * s, -10 * s, 5 * s, 10 * s, 3.4 * s, S.flash ? '#fff' : '#c9a227');
      }, 8 * s);
      ctx.restore();
      break;
    }

    case 'archer_evo': {                                       // 명궁: 깃털 관, 빛나는 장궁, 떠 있는 화살
      cape(S, -1, S.flash ? '#fff' : '#1f4a2a', 1.3);
      legs(S); torso(S); head(S, 'hood');
      for (let i = 0; i < 3; i++) tri(S, (-6 + i * 5) * s, -60 * s, (-3 + i * 5) * s, (-72 - (i === 1 ? 5 : 0)) * s, (-1 + i * 5) * s, -60 * s, S.flash ? '#fff' : '#f4f1e8');
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.35; ctx.strokeStyle = acc; ctx.lineWidth = 8 * s;
        ctx.beginPath(); ctx.arc(14 * s, -34 * s, 26 * s, -1.2, 1.2); ctx.stroke(); ctx.restore(); ctx._skipInk = false; }
      bow(S, 20 * s, -34 * s, 26 * s, acc);
      arm(S, 20 * s, -34 * s);
      for (let i = 0; i < 3; i++) {                             // 주위를 맴도는 빛 화살
        const a = MODEL.time * 2 + i * 2.1, x = Math.cos(a) * 18 * s - 6 * s, y = -46 * s + Math.sin(a) * 8 * s;
        line(S, x - 7 * s, y, x + 7 * s, y, 1.6 * s, acc); tri(S, x + 9 * s, y, x + 5 * s, y - 2.5 * s, x + 5 * s, y + 2.5 * s, acc);
      }
      break;
    }

    case 'mage_evo': {                                         // 대현자: 룬 원 위에 떠서 별 구슬을 거느린다
      const fly = -10 * s + Math.sin(MODEL.time * 2) * 2 * s;
      if (!S.flash) {
        ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.55; ctx.strokeStyle = acc; ctx.lineWidth = 1.8 * s;
        ctx.beginPath(); ctx.ellipse(0, -2 * s, 24 * s, 6 * s, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -2 * s, 16 * s, 4 * s, 0, 0, 7); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = MODEL.time + i * Math.PI / 3; ctx.fillStyle = acc; ctx.fillRect(Math.cos(a) * 20 * s - 1.5 * s, -2 * s + Math.sin(a) * 5 * s - 1.5 * s, 3 * s, 3 * s); }
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.save(); ctx.translate(0, fly);
      robe(S, 22 * s, -46 * s, tun);
      ctx.fillStyle = S.flash ? '#fff' : '#ffe9a0';             // 별 무늬
      for (const [x, y] of [[-8, -14], [6, -24], [-2, -32], [10, -10]]) { ctx.beginPath(); ctx.arc(x * s, y * s, 1.4 * s, 0, 7); ctx.fill(); }
      head(S, 'wizard', 8 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#ffe9a0';
      ctx.beginPath(); ctx.arc(-2 * s, -66 * s, 2 * s, 0, 7); ctx.fill();
      armWeapon(S, -0.15, () => {
        line(S, 0, 0, 3 * s, -52 * s, 3.4 * s, S.flash ? '#fff' : '#3a3a6b');
        ctx.strokeStyle = acc; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(3 * s, -58 * s, 7 * s, 0, 7); ctx.stroke();
        orb(S, 3 * s, -58 * s, 5 * s + 3 * s * atk, acc);
      }, 4 * s);
      ctx.restore();
      for (let i = 0; i < 3; i++) {                             // 궤도 구슬
        const a = MODEL.time * 1.6 + i * 2.09;
        orb(S, Math.cos(a) * 24 * s, -40 * s + Math.sin(a) * 10 * s, 3 * s, i === 1 ? '#ff9a5a' : acc);
      }
      break;
    }

    case 'priest_evo': {                                       // 대사제: 천사 날개와 큰 후광
      const flap = Math.sin(MODEL.time * 2.4) * 0.15;
      ctx.fillStyle = S.flash ? '#fff' : '#fbf8ee';
      for (const d of [-1, 1]) {
        ctx.save(); ctx.translate(d * 3 * s, -38 * s); ctx.rotate(d * flap);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(d * 30 * s, -26 * s, d * 36 * s, -8 * s);
        ctx.quadraticCurveTo(d * 28 * s, -4 * s, d * 30 * s, 4 * s);
        ctx.quadraticCurveTo(d * 20 * s, 2 * s, d * 20 * s, 10 * s);
        ctx.quadraticCurveTo(d * 10 * s, 6 * s, 0, 8 * s); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      robe(S, 20 * s, -40 * s, tun);
      ctx.fillStyle = S.flash ? '#fff' : '#c9a227';
      ctx.fillRect(-2 * s, -34 * s, 4 * s, 16 * s); ctx.fillRect(-7 * s, -29 * s, 14 * s, 4 * s);
      torso(S, 3.6 * s); head(S, 'coif', 8 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.4; ctx.strokeStyle = acc; ctx.lineWidth = 7 * s;
        ctx.beginPath(); ctx.ellipse(0, -66 * s, 15 * s, 4.6 * s, 0, 0, 7); ctx.stroke(); ctx.restore(); ctx._skipInk = false; }
      ctx.strokeStyle = acc; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.ellipse(0, -66 * s, 15 * s, 4.6 * s, 0, 0, 7); ctx.stroke();
      armWeapon(S, -0.15, () => {
        line(S, 0, 0, 3 * s, -48 * s, 3 * s, S.flash ? '#fff' : '#e8d9a8');
        ctx.strokeStyle = acc; ctx.lineWidth = 2.4 * s;
        ctx.beginPath(); ctx.arc(3 * s, -54 * s, 6 * s, 0, 7); ctx.stroke();
        orb(S, 3 * s, -54 * s, 3 * s + 2 * s * atk, '#fff6c8');
      }, 4 * s);
      break;
    }

    case 'spear_evo':                                          // 근위 창병: 탑 방패, 깃장식 투구, 긴 장창
      cape(S, -1, '#8e2f3a', 1.1);
      legs(S); torso(S, 4.4 * s); head(S, 'corinth');
      ctx.fillStyle = S.flash ? '#fff' : '#d23a3a';             // 붉은 볏
      ctx.beginPath(); ctx.moveTo(-10 * s, -58 * s); ctx.quadraticCurveTo(0, -74 * s, 10 * s, -60 * s); ctx.lineTo(0, -60 * s); ctx.closePath(); ctx.fill();
      armWeapon(S, -0.35, () => {
        line(S, -12 * s, 2 * s, 64 * s, -12 * s, 3 * s, S.flash ? '#fff' : '#4a3a2a');
        tri(S, 70 * s, -13 * s, 56 * s, -19 * s, 56 * s, -6 * s, acc);
        ctx.fillStyle = S.flash ? '#fff' : '#d23a3a'; ctx.fillRect(50 * s, -12 * s, 4 * s, 7 * s);
      }, 10 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#8e2f3a';             // 탑 방패
      ctx.beginPath(); roundRectPath(ctx, 6 * s, -56 * s, 15 * s, 50 * s, 3 * s); ctx.fill();
      ctx.fillStyle = acc;
      ctx.beginPath(); ctx.arc(13.5 * s, -32 * s, 5 * s, 0, 7); ctx.fill();
      ctx.fillRect(7 * s, -55 * s, 13 * s, 2.4 * s); ctx.fillRect(7 * s, -9 * s, 13 * s, 2.4 * s);
      break;

    case 'catapult_evo': {                                     // 화염 투석기: 높은 트레뷰셋과 불타는 탄
      const wood = S.flash ? '#fff' : '#5c3d22';
      ctx.fillStyle = wood; ctx.fillRect(-30 * s, -12 * s, 58 * s, 6 * s);
      ctx.strokeStyle = wood; ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(-20 * s, -10 * s); ctx.lineTo(-2 * s, -58 * s); ctx.lineTo(16 * s, -10 * s);
      ctx.moveTo(-12 * s, -32 * s); ctx.lineTo(8 * s, -32 * s); ctx.stroke();
      ctx.save(); ctx.translate(-2 * s, -58 * s); ctx.rotate(-2.5 + atk * 2.2);
      ctx.strokeStyle = acc; ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.moveTo(-14 * s, 0); ctx.lineTo(48 * s, 0); ctx.stroke();
      ctx.fillStyle = S.flash ? '#fff' : '#4a4a52'; ctx.fillRect(-22 * s, -6 * s, 12 * s, 14 * s);   // 평형추
      if (atk < 0.5) {
        orb(S, 50 * s, -5 * s, 6 * s, S.flash ? '#fff' : '#ff6a2a');
        orb(S, 50 * s, -9 * s, 3.5 * s, S.flash ? '#fff' : '#ffd35a');
      }
      ctx.restore();
      for (const x of [-28, 26]) {                              // 깃발
        line(S, x * s, -12 * s, x * s, -44 * s, 2 * s, wood);
        const w = Math.sin(MODEL.time * 3 + x) * 2 * s;
        tri(S, x * s, -44 * s, (x - 13) * s, -40 * s + w, x * s, -35 * s, S.flash ? '#fff' : '#b03a3a');
      }
      wheels(S, [-20, 16], -8 * s, 10 * s, acc);
      const O = sub(S, 0.62, 2.6 * s);
      ctx.save(); ctx.translate(-38 * s, 0);
      legs(O); torso(O); head(O, 'cap'); arm(O, 12 * O.s, -34 * O.s);
      ctx.restore();
      break;
    }

    case 'colossus_evo': {                                     // 강철 요새: 등에 망루를 진 걸어 다니는 성
      const O = Object.assign({}, S, { lw: 8 * s });
      legs(O, 22 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#7a7266';             // 등의 망루
      ctx.fillRect(-28 * s, -84 * s, 18 * s, 40 * s);
      for (let i = 0; i < 3; i++) ctx.fillRect((-28 + i * 7) * s, -90 * s, 4 * s, 6 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#1c1828'; ctx.fillRect(-22 * s, -74 * s, 5 * s, 8 * s);
      line(S, -19 * s, -90 * s, -19 * s, -104 * s, 1.6 * s, S.flash ? '#fff' : '#3a3a3a');
      tri(S, -19 * s, -104 * s, -8 * s, -100 * s + Math.sin(MODEL.time * 3) * 2 * s, -19 * s, -96 * s, acc);
      ctx.fillStyle = tun;
      ctx.beginPath(); roundRectPath(ctx, -15 * s, -54 * s, 30 * s, 36 * s, 6 * s); ctx.fill();
      ctx.fillStyle = acc; ctx.fillRect(-15 * s, -38 * s, 30 * s, 3 * s);
      ctx.beginPath(); ctx.ellipse(-17 * s, -50 * s, 10 * s, 8 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(17 * s, -50 * s, 10 * s, 8 * s, 0, 0, 7); ctx.fill();
      head(O, 'greathelm', 10 * s);
      if (!S.flash) { ctx.fillStyle = '#ffb347'; ctx.fillRect(1 * s, -52 * s, 7 * s, 2 * s); }
      armWeapon(O, -0.9 + atk * 1.5, () => {                     // 성문 망치
        line(O, 0, 0, 36 * s, 0, 6 * s, '#4a3a2a');
        ctx.fillStyle = acc; ctx.fillRect(32 * s, -14 * s, 20 * s, 28 * s);
        ctx.fillStyle = S.flash ? '#fff' : '#4a5a6a'; ctx.fillRect(36 * s, -10 * s, 12 * s, 20 * s);
      }, 8 * s);
      shieldShape(S, -34 * s, -56 * s, 14 * s, 52 * s, acc);
      break;
    }

    case 'necro_evo': {                                        // 사령 군주: 떠다니는 리치, 해골 왕관, 맴도는 해골 셋
      const fly = -8 * s + Math.sin(MODEL.time * 1.8) * 2.5 * s;
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.3; ctx.fillStyle = acc;
        ctx.beginPath(); ctx.ellipse(0, -2 * s, 18 * s, 4 * s, 0, 0, 7); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      ctx.save(); ctx.translate(0, fly);
      ctx.fillStyle = tun;                                      // 너덜너덜한 옷자락
      ctx.beginPath(); ctx.moveTo(-8 * s, -44 * s); ctx.lineTo(8 * s, -44 * s); ctx.lineTo(18 * s, -6 * s);
      for (let i = 0; i < 5; i++) ctx.lineTo((14 - i * 8) * s, (i % 2 ? -4 : 4 + Math.sin(MODEL.time * 4 + i) * 2) * s);
      ctx.lineTo(-18 * s, -6 * s); ctx.closePath(); ctx.fill();
      skull(S, 0, -52 * s, 8.5 * s, S.flash ? '#fff' : '#e2ddcc', acc);
      for (let i = 0; i < 3; i++) tri(S, (-7 + i * 7) * s, -59 * s, (-5 + i * 7) * s, -68 * s, (-3 + i * 7) * s, -59 * s, S.flash ? '#fff' : '#c9a227');
      armWeapon(S, -0.2, () => {
        line(S, 0, 4 * s, 4 * s, -52 * s, 3 * s, S.flash ? '#fff' : '#2a2433');
        ctx.strokeStyle = S.flash ? '#fff' : '#2a2433'; ctx.lineWidth = 2.4 * s;
        ctx.beginPath(); ctx.arc(4 * s, -60 * s, 8 * s, 0.3, Math.PI - 0.3, true); ctx.stroke();
        orb(S, 4 * s, -58 * s, 4 * s + 2 * s * atk, acc);
      }, 4 * s);
      ctx.restore();
      for (let i = 0; i < 3; i++) {
        const a = MODEL.time * 1.3 + i * 2.09;
        skull(S, Math.cos(a) * 22 * s, -38 * s + Math.sin(a) * 12 * s, 4 * s, S.flash ? '#fff' : '#d8d2c0', acc);
      }
      break;
    }

    case 'thor_evo': {                                         // 천둥의 신: 번개 두른 몸, 빛나는 눈, 더 큰 묠니르
      if (!S.flash) {
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(154,216,255,.8)'; ctx.lineWidth = 1.6 * s;
        for (let i = 0; i < 4; i++) {
          const t = Math.floor(MODEL.time * 9) + i * 7, a = (t * 2.39) % 6.28, r1 = 18 * s, r2 = 30 * s;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, -36 * s + Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a + 0.3) * (r1 + r2) / 2, -36 * s + Math.sin(a - 0.2) * (r1 + r2) / 2);
          ctx.lineTo(Math.cos(a) * r2, -36 * s + Math.sin(a) * r2); ctx.stroke();
        }
        ctx.restore(); ctx._skipInk = false;
      }
      cape(S, -1, '#c0392b', 1.5);
      legs(S, 22 * s); torso(S, 6.4 * s); head(S, 'wingedhelm', 10 * s);
      beard(S, '#f0c46a');
      if (!S.flash) { ctx.fillStyle = '#d8f4ff'; ctx.beginPath(); ctx.arc(5 * s, -52 * s, 1.8 * s, 0, 7); ctx.fill(); }
      armWeapon(S, -1.35 + atk * 2.1, () => {
        line(S, 0, 0, 32 * s, 0, 5.5 * s, '#4a3a2a');
        ctx.fillStyle = acc;
        ctx.beginPath(); roundRectPath(ctx, 28 * s, -18 * s, 30 * s, 36 * s, 5 * s); ctx.fill();
        ctx.fillStyle = S.flash ? '#fff' : '#ffffff';
        ctx.fillRect(36 * s, -10 * s, 14 * s, 4 * s); ctx.fillRect(41 * s, -16 * s, 4 * s, 32 * s);
        if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.3; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(43 * s, 0, 26 * s, 0, 7); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      }, 9 * s);
      break;
    }

    case 'wukong_evo': {                                       // 투전승불: 금갑, 봉황 깃 관, 큰 구름
      if (!S.flash) {
        ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.85;
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = i % 2 ? '#ffe9a0' : '#fffaf0';
          ctx.beginPath(); ctx.arc((-24 + i * 8) * s, (-1 + Math.sin(MODEL.time * 2 + i) * 1.4) * s, (6 + (i % 3)) * s, 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffd35a';
        ctx.beginPath(); ctx.arc(0, -48 * s, 22 * s, 0, 7); ctx.fill();          // 등 뒤 광배
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.save(); ctx.translate(0, -6 * s);
      cape(S, -1, '#b03a3a', 1.3);
      ctx.strokeStyle = col; ctx.lineWidth = 3 * s;            // 꼬리
      ctx.beginPath(); ctx.moveTo(-4 * s, -22 * s); ctx.quadraticCurveTo(-22 * s, -18 * s + Math.sin(phase) * 3 * s, -20 * s, -36 * s); ctx.stroke();
      legs(S); torso(S, 5 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#c9a227';            // 금갑 견갑
      for (const x of [-7, 7]) { ctx.beginPath(); ctx.ellipse(x * s, -39 * s, 5 * s, 3.4 * s, 0, Math.PI, 0); ctx.fill(); }
      head(S, 'monkeyface');
      ctx.fillStyle = S.flash ? '#fff' : '#ffd35a';            // 금관
      ctx.fillRect(-8 * s, -60 * s, 16 * s, 3 * s);
      ctx.strokeStyle = S.flash ? '#fff' : '#d23a3a'; ctx.lineWidth = 2 * s;     // 봉황 깃
      for (const d of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(d * 4 * s, -60 * s);
        ctx.quadraticCurveTo(d * 18 * s, -80 * s + Math.sin(MODEL.time * 2) * 2 * s, d * 30 * s, -72 * s); ctx.stroke();
      }
      armWeapon(S, -1.1 + atk * 1.9, () => {                   // 여의봉
        line(S, -24 * s, 0, 56 * s, 0, 4 * s, S.flash ? '#fff' : '#b03a3a');
        ctx.fillStyle = S.flash ? '#fff' : '#ffd35a';
        ctx.fillRect(-26 * s, -3 * s, 7 * s, 6 * s); ctx.fillRect(51 * s, -3 * s, 7 * s, 6 * s);
      }, 6 * s);
      ctx.restore();
      break;
    }

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
    /* ---------------------- 3.0 새 전장 병종 ---------------------- */
    case 'javelin': {
      const J = S.flash ? '#fff' : '#7a5a34';
      for (let i = 0; i < 2; i++) {                            // 등에 멘 투창 묶음
        line(S, (-13 + i * 3) * s, -50 * s, (-5 + i * 3) * s, -14 * s, 2.2 * s, J);
        tri(S, (-14.5 + i * 3) * s, -49 * s, (-12.5 + i * 3) * s, -57 * s, (-10.5 + i * 3) * s, -48 * s, S.flash ? '#fff' : '#c8ced6');
      }
      legs(S); torso(S); head(S, 'feather');
      // 머리 위로 치켜들었다가 던진다. 던진 직후에는 손이 비어 있다.
      armWeapon(S, -0.35 - S.wind * 0.55 + atk * 0.9, () => {
        if (atk > 0.25) return;
        line(S, -18 * s, 0, 30 * s, 0, 2.6 * s, J);
        tri(S, 39 * s, 0, 29 * s, -3.8 * s, 29 * s, 3.8 * s, S.flash ? '#fff' : '#c8ced6');
      }, 6 * s);
      break;
    }
    case 'falconer': {
      legs(S); torso(S); head(S, 'wide');
      const gx = 13 * s, gy = -46 * s - S.wind * 4 * s;         // 가죽 장갑을 낀 팔을 치켜든다
      arm(S, gx, gy);
      ctx.fillStyle = S.flash ? '#fff' : '#8a5a2a';
      ctx.beginPath(); ctx.arc(gx, gy, 3.2 * s, 0, 7); ctx.fill();
      if (atk < 0.12) falcon(S, gx + 1 * s, gy - 6 * s, MODEL.time * (S.wind > 0 ? 18 : 3), acc, 1.45);
      else falcon(S, gx + (10 + atk * 24) * s, gy - (8 + atk * 14) * s, MODEL.time * 20, acc, 1.45);   // 날아가는 매
      if (st.evo) falcon(S, Math.cos(MODEL.time * 1.7) * 20 * s, -86 * s + Math.sin(MODEL.time * 3.4) * 4 * s, MODEL.time * 14, acc, 0.9);
      break;
    }
    case 'bellringer': {
      robe(S, 17 * s, -40 * s, tun); legsHidden(S); torso(S); head(S, 'coif');
      line(S, -16 * s, -45 * s, 24 * s, -50 * s, 3 * s, S.flash ? '#fff' : '#6b4b2a');   // 어깨에 멘 장대
      const ring = S.live ? Math.sin(MODEL.time * 5) * 0.3 : 0.15;
      ctx.save(); ctx.translate(21 * s, -49 * s); ctx.rotate(ring);
      line(S, 0, 0, 0, 5 * s, 1.6 * s, S.flash ? '#fff' : '#3a2a1a');
      bellShape(S, 0, 5 * s, 8 * s, 14 * s, S.flash ? '#fff' : acc);
      ctx.restore();
      hand(S, 4 * s, -46 * s);
      if (S.live && !S.flash) {                                 // 번지는 종소리
        const k = (MODEL.time * 0.8) % 1;
        ctx._skipInk = true; ctx.globalAlpha = (1 - k) * 0.4; ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * s;
        ctx.beginPath(); ctx.arc(21 * s, -36 * s, (6 + k * 16) * s, -1.2, 1.2); ctx.stroke();
        ctx.globalAlpha = 1; ctx._skipInk = false;
      }
      break;
    }
    case 'lancer': {
      const hc = S.flash ? '#fff' : '#8a6a4a', hd = S.flash ? '#fff' : '#4a3626';
      const gal = moving ? Math.sin(phase * 1.6) : 0;
      const sw = moving ? gal * 10 * s : 2 * s;
      ctx.save(); ctx.translate(0, moving ? -Math.abs(gal) * 3 * s : 0);
      beastLegs(S, [[-20, sw, 1], [-13, -sw, 0], [13, -sw, 0], [19, sw, 1]], -24 * s, 4.6 * s, hc);
      ctx.strokeStyle = hd; ctx.lineWidth = 3.6 * s;             // 꼬리
      ctx.beginPath(); ctx.moveTo(-25 * s, -34 * s); ctx.quadraticCurveTo(-37 * s, -30 * s + gal * 4 * s, -34 * s, -15 * s); ctx.stroke();
      ctx.fillStyle = hc;                                        // 몸통
      ctx.beginPath(); ctx.ellipse(0, -32 * s, 26 * s, 11 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = tun;                                       // 마갑
      ctx.beginPath(); ctx.moveTo(-22 * s, -39 * s); ctx.lineTo(18 * s, -39 * s); ctx.lineTo(20 * s, -24 * s);
      for (let i = 0; i <= 6; i++) ctx.lineTo((20 - i * 7) * s, (-21 - (i % 2) * 3) * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : acc;
      ctx.beginPath(); ctx.arc(-1 * s, -31 * s, 3 * s, 0, 7); ctx.fill();
      ctx.fillStyle = hc;                                        // 목과 머리
      ctx.beginPath(); ctx.moveTo(13 * s, -40 * s); ctx.quadraticCurveTo(21 * s, -56 * s, 30 * s, -61 * s);
      ctx.lineTo(36 * s, -54 * s); ctx.quadraticCurveTo(30 * s, -44 * s, 24 * s, -32 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(37 * s, -54 * s, 9 * s, 5 * s, 0.55, 0, 7); ctx.fill();
      tri(S, 28 * s, -60 * s, 30 * s, -69 * s, 33 * s, -60 * s, hc);
      ctx.fillStyle = hd;                                        // 갈기
      ctx.beginPath(); ctx.moveTo(29 * s, -62 * s); ctx.quadraticCurveTo(19 * s, -55 * s, 15 * s, -40 * s);
      ctx.lineTo(19 * s, -42 * s); ctx.quadraticCurveTo(23 * s, -55 * s, 31 * s, -59 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1c1612'; ctx.beginPath(); ctx.arc(38 * s, -56 * s, 1.4 * s, 0, 7); ctx.fill();
      const R = sub(S, 0.84, 3.2 * s);                           // 말 위의 기수
      ctx.save(); ctx.translate(-4 * s, -25 * s);
      torso(R); head(R, 'plume');
      armWeapon(R, -0.06, () => {
        line(R, -18 * R.s, 0, 62 * R.s, -1 * R.s, 3.6 * R.s, S.flash ? '#fff' : '#d8d0c0');
        tri(R, 73 * R.s, -1 * R.s, 60 * R.s, -5.5 * R.s, 60 * R.s, 3.5 * R.s, S.flash ? '#fff' : '#c8ced6');
        tri(R, 46 * R.s, -2 * R.s, 34 * R.s, -13 * R.s + Math.sin(MODEL.time * 6) * 2 * R.s, 30 * R.s, -2 * R.s, S.flash ? '#fff' : tun);
      }, 2 * R.s);
      ctx.restore();
      ctx.restore();
      break;
    }
    case 'alchemist':
      legs(S); torso(S); head(S, 'goggles');
      ctx.fillStyle = S.flash ? '#fff' : '#8a6a44';            // 가죽 앞치마
      ctx.beginPath(); roundRectPath(ctx, -6 * s, -35 * s, 12 * s, 21 * s, 2 * s); ctx.fill();
      ['#7fe0a0', '#e07fb0', '#7fb8e0'].forEach((c, i) => {     // 허리춤 약병
        ctx.fillStyle = S.flash ? '#fff' : c;
        ctx.beginPath(); roundRectPath(ctx, (-9 + i * 5) * s, -27 * s, 3.4 * s, 6 * s, 1.4 * s); ctx.fill();
      });
      armWeapon(S, -0.9 + atk * 1.8, () => {
        if (atk > 0.3) return;
        line(S, 0, 0, 6 * s, -2 * s, 2 * s, S.flash ? '#fff' : '#d8e8e0');
        orb(S, 11 * s, -3 * s, 5 * s, S.flash ? '#fff' : acc);
      }, 5 * s);
      if (S.live && !S.flash) {                                 // 피어오르는 약 김
        ctx._skipInk = true;
        for (let i = 0; i < 2; i++) {
          const k = (MODEL.time * 0.7 + i / 2) % 1;
          ctx.globalAlpha = (1 - k) * 0.5; ctx.fillStyle = acc;
          ctx.beginPath(); ctx.arc(14 * s + Math.sin(k * 6 + i) * 3 * s, -50 * s - k * 18 * s, (1.5 + k * 2) * s, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx._skipInk = false;
      }
      break;
    case 'monk':
      legs(S); torso(S); head(S, 'bald');
      line(S, -5 * s, -41 * s, 6 * s, -20 * s, 3 * s, S.flash ? '#fff' : acc);   // 가사 띠
      ctx._skipInk = true; ctx.fillStyle = S.flash ? '#fff' : '#6b3a1f';       // 염주
      for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.12); ctx.beginPath(); ctx.arc(Math.cos(a) * 6 * s, -41 * s + Math.sin(a) * 6 * s, 1.5 * s, 0, 7); ctx.fill(); }
      ctx._skipInk = false;
      armWeapon(S, -0.1 + atk * 0.15, () => {                   // 권: 주먹을 쭉 뻗는다
        ctx.fillStyle = S.flash ? '#fff' : shade(col, 0.15);
        ctx.beginPath(); ctx.arc(4 * s, 0, 3.9 * s, 0, 7); ctx.fill();
        ctx.fillStyle = S.flash ? '#fff' : '#efe6cf';
        ctx.fillRect(-1.2 * s, -2.8 * s, 2.4 * s, 5.6 * s);
        if (atk > 0.4 && S.live) {                               // 권풍
          ctx._skipInk = true; ctx.globalAlpha = (atk - 0.4) * 1.2; ctx.strokeStyle = '#fff6dc'; ctx.lineWidth = 1.6 * s;
          for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(10 * s + i * 7 * s, 0, (5 + i * 3) * s, -1, 1); ctx.stroke(); }
          ctx.globalAlpha = 1; ctx._skipInk = false;
        }
      }, 2 * s);
      break;

    /* ---------------------- 3.0 서유기 ---------------------- */
    case 'wukong':
    case 'monkeyclone': {
      const clone = st.shape === 'monkeyclone';
      if (clone && !S.flash) ctx.globalAlpha *= 0.72;
      if (!clone && !S.flash) {                                  // 근두운
        ctx._skipInk = true;
        const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * 0.8; ctx.fillStyle = '#f4f1e8';
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc((-16 + i * 8) * s, (-2 + Math.sin(MODEL.time * 2 + i) * 1.2) * s, (5 + (i % 2) * 2) * s, 0, 7); ctx.fill(); }
        ctx.globalAlpha = a0; ctx._skipInk = false;
      }
      ctx.strokeStyle = col; ctx.lineWidth = 3 * s;             // 꼬리
      ctx.beginPath(); ctx.moveTo(-4 * s, -22 * s); ctx.quadraticCurveTo(-22 * s, -18 * s + Math.sin(phase) * 3 * s, -20 * s, -36 * s); ctx.stroke();
      legs(S);
      ctx.fillStyle = S.flash ? '#fff' : '#e8b04a';             // 호피 치마
      ctx.beginPath(); ctx.moveTo(-8 * s, -24 * s); ctx.lineTo(8 * s, -24 * s); ctx.lineTo(10 * s, -13 * s); ctx.lineTo(-10 * s, -13 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#3a2a1a';
      for (let i = -1; i <= 1; i++) ctx.fillRect((i * 5 - 0.8) * s, -22 * s, 1.6 * s, 7 * s);
      torso(S); head(S, 'circlet');
      if (st.evo && !clone) {                                    // 봉황 깃: 머리 위로 휘어 뒤로 넘어간다
        ctx.strokeStyle = S.flash ? '#fff' : '#d8453a'; ctx.lineWidth = 1.8 * s;
        for (const k of [0, 1]) {
          const sway = Math.sin(MODEL.time * 3 + k) * 2 * s;
          ctx.beginPath(); ctx.moveTo((2 + k * 3) * s, -58 * s);
          ctx.quadraticCurveTo((4 + k * 4) * s, -76 * s, (-10 - k * 4) * s + sway, (-80 + k * 3) * s); ctx.stroke();
        }
      }
      armWeapon(S, -0.9 + atk * 1.8, () => {                     // 여의봉
        line(S, -24 * s, 0, 44 * s, 0, 4 * s, S.flash ? '#fff' : '#b8322e');
        ctx.fillStyle = S.flash ? '#fff' : acc;
        ctx.fillRect(-28 * s, -2.8 * s, 6 * s, 5.6 * s); ctx.fillRect(42 * s, -2.8 * s, 6 * s, 5.6 * s);
      }, 6 * s);
      break;
    }
    case 'nezha': {
      const spin = MODEL.time * 9;
      for (const wx2 of [-8, 8]) {                               // 풍화륜: 발밑의 불바퀴
        if (!S.flash) {
          ctx._skipInk = true;
          for (let i = 0; i < 3; i++) {
            const k = (MODEL.time * 2 + i / 3) % 1;
            ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = i % 2 ? '#ffb347' : acc;
            ctx.beginPath(); ctx.ellipse(wx2 * s - k * 10 * s, -5 * s - k * 6 * s, (4 - k * 2) * s, (3 - k) * s, 0, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 1; ctx._skipInk = false;
        }
        ctx.save(); ctx.translate(wx2 * s, -5 * s); ctx.rotate(spin);
        ctx.strokeStyle = S.flash ? '#fff' : '#e8c65a'; ctx.lineWidth = 2.4 * s;
        ctx.beginPath(); ctx.arc(0, 0, 5 * s, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-5 * s, 0); ctx.lineTo(5 * s, 0); ctx.stroke();
        ctx.restore();
      }
      ctx.save(); ctx.translate(0, -9 * s);                      // 바퀴 위에 떠 있다
      const wave = Math.sin(MODEL.time * 3) * 4 * s;             // 혼천릉 붉은 비단
      ctx.strokeStyle = S.flash ? '#fff' : '#d8453a'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(-5 * s, -40 * s);
      ctx.bezierCurveTo(-30 * s, -58 * s + wave, -36 * s, -18 * s - wave, -14 * s, -28 * s + wave); ctx.stroke();
      legs(S, 17 * s); torso(S); head(S, 'buns');
      ctx.strokeStyle = S.flash ? '#fff' : '#e8c65a'; ctx.lineWidth = 2.6 * s;   // 건곤권
      ctx.beginPath(); ctx.arc(-8 * s, -27 * s, 5 * s, 0, 7); ctx.stroke();
      armWeapon(S, -0.35, () => {                                // 화첨창
        line(S, 0, 0, 42 * s, -8 * s, 2.8 * s, S.flash ? '#fff' : '#6b4b2a');
        tri(S, 50 * s, -9.5 * s, 40 * s, -14 * s, 41 * s, -4 * s, S.flash ? '#fff' : '#e8e0d0');
        if (!S.flash) { ctx._skipInk = true; ctx.globalAlpha = 0.8; ctx.fillStyle = acc;
          ctx.beginPath(); ctx.ellipse(53 * s, -12 * s, 4 * s, 2.4 * s, -0.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx._skipInk = false; }
      }, 9 * s);
      ctx.restore();
      break;
    }
    case 'sanzang':
      if (!S.flash) {                                            // 등 뒤 은은한 광배
        ctx._skipInk = true; ctx.globalAlpha = 0.28; ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(0, -52 * s, 15 * s, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx._skipInk = false;
      }
      robe(S, 18 * s, -42 * s, tun);
      ctx.fillStyle = S.flash ? '#fff' : '#b8322e';              // 붉은 가사 띠
      ctx.beginPath(); ctx.moveTo(-8 * s, -42 * s); ctx.lineTo(-2 * s, -42 * s); ctx.lineTo(12 * s, -4 * s); ctx.lineTo(5 * s, -4 * s); ctx.closePath(); ctx.fill();
      legsHidden(S); head(S, 'vairocana');
      armWeapon(S, -0.2, () => {                                 // 석장: 고리 달린 지팡이
        line(S, 0, 10 * s, 3 * s, -44 * s, 2.4 * s, S.flash ? '#fff' : '#c9a227');
        ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 1.8 * s;
        ctx.beginPath(); ctx.ellipse(3 * s, -50 * s, 5 * s, 7 * s, 0, 0, 7); ctx.stroke();
        for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(3 * s + k * 5.5 * s, -46 * s + Math.sin(MODEL.time * 4 + k) * 1.2 * s, 2 * s, 0, 7); ctx.stroke(); }
      }, 6 * s);
      break;
    case 'bajie': {
      const O = Object.assign({}, S, { lw: 5 * s });
      legs(O, 18 * s);
      ctx.fillStyle = tun;                                       // 큰 배
      ctx.beginPath(); ctx.ellipse(1 * s, -30 * s, 13 * s, 14 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : shade(col, 0.2);
      ctx.beginPath(); ctx.ellipse(5 * s, -27 * s, 7 * s, 9 * s, 0, 0, 7); ctx.fill();
      const hy = -52 * s;                                        // 돼지 머리
      ctx.fillStyle = S.flash ? '#fff' : col;
      ctx.beginPath(); ctx.arc(0, hy, 10 * s, 0, 7); ctx.fill();
      tri(S, -8 * s, hy - 6 * s, -2 * s, hy - 10 * s, -12 * s, hy + 2 * s, S.flash ? '#fff' : shade(col, -0.15));
      tri(S, 2 * s, hy - 10 * s, 8 * s, hy - 7 * s, 4 * s, hy + 1 * s, S.flash ? '#fff' : shade(col, -0.15));
      ctx.fillStyle = S.flash ? '#fff' : shade(col, 0.25);       // 코
      ctx.beginPath(); ctx.ellipse(10 * s, hy + 2 * s, 5 * s, 4 * s, 0, 0, 7); ctx.fill();
      if (!S.flash) {
        ctx._skipInk = true; ctx.fillStyle = '#5a2e2a';
        ctx.beginPath(); ctx.arc(9 * s, hy + 2 * s, 1 * s, 0, 7); ctx.arc(12 * s, hy + 2 * s, 1 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#16181d'; ctx.beginPath(); ctx.arc(4 * s, hy - 3 * s, 1.4 * s, 0, 7); ctx.fill();
        ctx._skipInk = false;
      }
      armWeapon(O, -1.0 + atk * 1.7, () => {                     // 아홉 날 쇠스랑
        line(S, 0, 0, 36 * s, 0, 3.4 * s, S.flash ? '#fff' : '#6b4b2a');
        ctx.fillStyle = S.flash ? '#fff' : acc; ctx.fillRect(36 * s, -10 * s, 3.4 * s, 20 * s);
        for (let i = 0; i < 5; i++) line(S, 39 * s, (-8 + i * 4) * s, 47 * s, (-8 + i * 4) * s, 1.8 * s, S.flash ? '#fff' : acc);
      }, 8 * s);
      break;
    }
    case 'wujing':
      legs(S); torso(S, 4.6 * s); head(S, 'bald');
      beard(S, S.flash ? '#fff' : '#b8322e');
      for (let i = 0; i < 5; i++) {                              // 해골 목걸이
        const a = Math.PI * (0.2 + i * 0.15);
        skull(S, Math.cos(a) * 8 * s, -41 * s + Math.sin(a) * 6 * s, 2 * s, S.flash ? '#fff' : '#efe6cf', '#2b2118');
      }
      armWeapon(S, -0.9 + atk * 1.6, () => {                     // 월아산
        line(S, -18 * s, 0, 40 * s, 0, 3 * s, S.flash ? '#fff' : '#6b4b2a');
        ctx.fillStyle = S.flash ? '#fff' : acc;
        ctx.beginPath(); ctx.arc(44 * s, 0, 8.5 * s, -1.9, 1.9); ctx.arc(40 * s, 0, 6 * s, 1.6, -1.6, true); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-18 * s, -4 * s); ctx.lineTo(-27 * s, -5.5 * s); ctx.lineTo(-27 * s, 5.5 * s); ctx.lineTo(-18 * s, 4 * s); ctx.closePath(); ctx.fill();
      }, 7 * s);
      break;
    case 'monkey':
      ctx.strokeStyle = col; ctx.lineWidth = 2.6 * s;            // 꼬리
      ctx.beginPath(); ctx.moveTo(-4 * s, -22 * s); ctx.quadraticCurveTo(-20 * s, -20 * s + Math.sin(phase * 2) * 4 * s, -16 * s, -36 * s); ctx.stroke();
      legs(S, 17 * s); torso(S, 3.6 * s); head(S, 'monkeyface');
      armWeapon(S, -0.5 + atk * 1.5, () => {                     // 짧은 봉
        line(S, -8 * s, 0, 22 * s, 0, 3 * s, S.flash ? '#fff' : '#8a5a2a');
        ctx.fillStyle = S.flash ? '#fff' : acc; ctx.fillRect(20 * s, -2.4 * s, 4 * s, 4.8 * s);
      }, 6 * s);
      break;
    case 'celestial':
      legs(S); torso(S, 4.4 * s); head(S, 'winged');
      armWeapon(S, -0.3, () => {
        line(S, 0, 0, 44 * s, -9 * s, 3 * s, S.flash ? '#fff' : '#c9a227');
        tri(S, 50 * s, -10.5 * s, 40 * s, -15 * s, 41 * s, -4 * s, S.flash ? '#fff' : '#e8e0d0');
        ctx.fillStyle = S.flash ? '#fff' : '#c0392b'; ctx.beginPath(); ctx.arc(38 * s, -6 * s, 2.6 * s, 0, 7); ctx.fill();
      }, 10 * s);
      round_shield(S, 12 * s, -40 * s, 10 * s, S.flash ? '#fff' : acc);
      break;

    /* ---------------------- 3.0 특이한 적 ---------------------- */
    case 'ooze':
    case 'oozelet': {                                            // 분열 슬라임: 출렁이는 젤리
      const wob = Math.sin(phase * 2.2) * 0.08 + (moving ? Math.sin(phase * 4) * 0.05 : 0) + atk * 0.1;
      const W = 22 * s * (1 + wob), H = 24 * s * (1 - wob);
      ctx.fillStyle = S.flash ? '#fff' : col;
      ctx.beginPath();
      ctx.moveTo(-W, 0);
      ctx.quadraticCurveTo(-W * 1.05, -H * 1.1, 0, -H * 1.35);
      ctx.quadraticCurveTo(W * 1.05, -H * 1.1, W, 0);
      ctx.quadraticCurveTo(W * 0.5, 3 * s, 0, 1 * s); ctx.quadraticCurveTo(-W * 0.5, 3 * s, -W, 0);
      ctx.closePath(); ctx.fill();
      if (!S.flash) {
        ctx._skipInk = true;
        if (st.shape === 'ooze') skull(S, -3 * s, -H * 0.6, 4.6 * s, 'rgba(235,230,210,.55)', 'rgba(40,60,40,.6)');
        ctx.fillStyle = shade(col, 0.4);                         // 올라오는 거품
        for (let i = 0; i < 3; i++) {
          const k = (MODEL.time * 0.5 + i / 3) % 1;
          ctx.globalAlpha = 0.6 * (1 - k);
          ctx.beginPath(); ctx.arc((-7 + i * 7) * s, -k * H * 1.1, (1.5 + i * 0.5) * s, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,.4)';                  // 윤기
        ctx.beginPath(); ctx.ellipse(-W * 0.38, -H * 0.9, W * 0.2, H * 0.13, -0.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#f4f1ea';
        ctx.beginPath(); ctx.arc(W * 0.3, -H * 0.8, 3 * s, 0, 7); ctx.arc(W * 0.62, -H * 0.74, 2.6 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#16181d';
        ctx.beginPath(); ctx.arc(W * 0.34, -H * 0.79, 1.4 * s, 0, 7); ctx.arc(W * 0.66, -H * 0.73, 1.2 * s, 0, 7); ctx.fill();
        ctx._skipInk = false;
      }
      break;
    }
    case 'mirror':                                               // 거울 마녀: 커다란 손거울을 앞세운다
      robe(S, 17 * s, -42 * s, tun); head(S, 'witch', 8 * s);
      armWeapon(S, -0.1 + atk * 0.2, () => {
        line(S, 0, 0, 3 * s, 10 * s, 2 * s, S.flash ? '#fff' : '#6b4b2a');
        ctx.fillStyle = S.flash ? '#fff' : '#9aa3ab';
        ctx.beginPath(); ctx.ellipse(6 * s, -7 * s, 9 * s, 12 * s, 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = S.flash ? '#fff' : acc;
        ctx.beginPath(); ctx.ellipse(6 * s, -7 * s, 7 * s, 10 * s, 0.1, 0, 7); ctx.fill();
        if (!S.flash) { ctx._skipInk = true; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.4 * s;
          ctx.beginPath(); ctx.moveTo(3 * s, -13 * s); ctx.lineTo(8 * s, -3 * s); ctx.stroke(); ctx._skipInk = false; }
      }, 4 * s);
      break;
    case 'jailer': {                                             // 사슬 간수: 쇠 가면, 몸에 감은 사슬, 갈고리
      const O = Object.assign({}, S, { lw: 5.4 * s });
      legs(O, 20 * s); torso(O, 6 * s); head(O, 'tusk', 9.5 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#6b7178';
      ctx.fillRect(-1 * s, -57 * s, 11 * s, 9 * s);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(3 * s, -54 * s, 6 * s, 1.4 * s);
      ctx._skipInk = true; ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 1.6 * s;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse((-6 + i * 2.6) * s, (-40 + i * 3.4) * s, 2.2 * s, 1.3 * s, 0.6, 0, 7); ctx.stroke(); }
      ctx._skipInk = false;
      armWeapon(O, -0.6 + atk * 1.4, () => {
        const a = S.wind > 0 ? MODEL.time * 14 : 0.3;
        const hx = 6 * s + Math.cos(a) * 16 * s, hy = Math.sin(a) * 16 * s;
        ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 1.5 * s; ctx._skipInk = true;
        for (let i = 1; i <= 5; i++) { const t = i / 6; ctx.beginPath(); ctx.ellipse(hx * t, hy * t, 1.8 * s, 1.1 * s, a, 0, 7); ctx.stroke(); }
        ctx._skipInk = false;
        ctx.strokeStyle = S.flash ? '#fff' : '#c8ced6'; ctx.lineWidth = 2.6 * s;
        ctx.beginPath(); ctx.arc(hx, hy + 4 * s, 5 * s, -1.4, 2.4); ctx.stroke();
      }, 6 * s);
      break;
    }
    case 'thief':                                                // 금화 도둑: 복면, 불룩한 보따리
      ctx.fillStyle = S.flash ? '#fff' : '#8a6a44';
      ctx.beginPath(); ctx.ellipse(-12 * s, -34 * s, 9 * s, 10 * s, 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : acc;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((-15 + i * 3) * s, -44 * s + (i % 2) * 1.5 * s, 1.8 * s, 0, 7); ctx.fill(); }
      legs(S, 16 * s); torso(S, 3.4 * s); head(S, 'ears', 7.5 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22'; ctx.fillRect(-1 * s, -53 * s, 10 * s, 3 * s);
      armWeapon(S, -0.6 + atk * 1.6, () => line(S, 0, 0, 16 * s, -2 * s, 2.4 * s, S.flash ? '#fff' : '#c8ced6'), 7 * s);
      break;
    case 'chrono': {                                             // 시간 주술사: 떠서 도는 모래시계
      robe(S, 17 * s, -44 * s, tun); head(S, 'hood', 8 * s);
      const a = MODEL.time * 1.2;
      ctx.save(); ctx.translate(18 * s, -64 * s + Math.sin(a * 2) * 2 * s); ctx.rotate(Math.sin(a) * 0.5);
      ctx.fillStyle = S.flash ? '#fff' : '#c9a227';
      ctx.fillRect(-6 * s, -10 * s, 12 * s, 2.4 * s); ctx.fillRect(-6 * s, 8 * s, 12 * s, 2.4 * s);
      ctx._skipInk = true;
      ctx.fillStyle = S.flash ? '#fff' : 'rgba(190,235,255,.55)';
      ctx.beginPath(); ctx.moveTo(-5 * s, -8 * s); ctx.lineTo(5 * s, -8 * s); ctx.lineTo(0, 0); ctx.lineTo(5 * s, 8 * s); ctx.lineTo(-5 * s, 8 * s); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      const sand = (MODEL.time * 0.25) % 1;
      ctx.fillStyle = S.flash ? '#fff' : '#e8c65a';
      ctx.beginPath(); ctx.moveTo(-4 * s * (1 - sand), -8 * s + 8 * s * sand); ctx.lineTo(4 * s * (1 - sand), -8 * s + 8 * s * sand); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-4 * s * sand, 8 * s - 8 * s * sand * 0.8); ctx.lineTo(4 * s * sand, 8 * s - 8 * s * sand * 0.8); ctx.lineTo(5 * s, 8 * s); ctx.lineTo(-5 * s, 8 * s); ctx.closePath(); ctx.fill();
      ctx._skipInk = false;
      ctx.restore();
      armWeapon(S, -0.25 + atk * 0.5, () => {
        line(S, 0, 0, 3 * s, -40 * s, 2.6 * s, S.flash ? '#fff' : '#3a2a1a');
        orb(S, 3 * s, -45 * s, 4 * s, S.flash ? '#fff' : acc);
      }, 4 * s);
      break;
    }
    case 'souleater': {                                          // 흡혼귀: 커다란 입, 주변을 도는 넋
      const fl = Math.sin(phase * 0.8) * 3 * s;
      ctx.save(); ctx.translate(0, fl - 6 * s);
      ctx.fillStyle = S.flash ? '#fff' : col;
      ctx.beginPath();
      ctx.moveTo(0, -60 * s);
      ctx.quadraticCurveTo(26 * s, -34 * s, 19 * s, 0);
      ctx.lineTo(11 * s, -10 * s); ctx.lineTo(4 * s, 0); ctx.lineTo(-3 * s, -10 * s); ctx.lineTo(-10 * s, 0);
      ctx.lineTo(-19 * s, 0);
      ctx.quadraticCurveTo(-26 * s, -34 * s, 0, -60 * s);
      ctx.fill();
      if (!S.flash) {
        ctx._skipInk = true;
        ctx.fillStyle = '#0c0a12';
        ctx.beginPath(); ctx.ellipse(6 * s, -40 * s, 8 * s, (4 + atk * 5) * s, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#efe6d8';
        for (let i = 0; i < 4; i++) { const tx = (0 + i * 4) * s; ctx.beginPath(); ctx.moveTo(tx, -44 * s); ctx.lineTo(tx + 2 * s, -40 * s); ctx.lineTo(tx + 4 * s, -44 * s); ctx.fill(); }
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(2 * s, -50 * s, 2.2 * s, 0, 7); ctx.arc(9 * s, -50 * s, 2.2 * s, 0, 7); ctx.fill();
        ctx._skipInk = false;
        for (let i = 0; i < 3; i++) {
          const a = MODEL.time * 1.6 + i * 2.1;
          wisp(S, Math.cos(a) * 22 * s, -46 * s + Math.sin(a) * 9 * s, 2.6 * s, acc, phase + i);
        }
      }
      ctx.restore();
      break;
    }


    /* ---------------- 3.3 3막 '심연의 바다' ---------------- */
    case 'harpoon': {                                            // 작살병: 선원 모자, 미늘 작살과 밧줄
      legs(S); torso(S); head(S, 'cap');
      armWeapon(S, -0.25 - atk * 0.2, () => {
        line(S, -6 * s, 0, 40 * s, -6 * s, 2.6 * s, S.flash ? '#fff' : '#6b4b2a');
        tri(S, 46 * s, -7 * s, 37 * s, -12 * s, 38 * s, -2 * s, acc);
        line(S, 38 * s, -9 * s, 34 * s, -14 * s, 1.6 * s, acc);
        if (!S.flash) { ctx._skipInk = true; ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1.2 * s;
          ctx.beginPath(); ctx.moveTo(-6 * s, 0); ctx.quadraticCurveTo(-14 * s, 10 * s, -4 * s, 14 * s); ctx.stroke(); ctx._skipInk = false; }
      }, 9 * s);
      break;
    }
    case 'corsair': {                                            // 해적 검사: 두건, 안대, 휜 칼 두 자루
      cape(S, -1, tun, 0.8);
      legs(S); torso(S, 4 * s); head(S, 'wrap');
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = '#111'; ctx.fillRect(3 * s, -54 * s, 6 * s, 3 * s); ctx.fillRect(-6 * s, -55 * s, 9 * s, 1 * s); ctx._skipInk = false; }
      armWeapon(S, -0.7 + atk * 1.7, () => {
        ctx.strokeStyle = S.flash ? '#fff' : '#d8dde4'; ctx.lineWidth = 2.6 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(16 * s, 2 * s, 26 * s, -8 * s); ctx.stroke();
        line(S, -2 * s, -4 * s, -2 * s, 4 * s, 2.2 * s, acc);
      }, 6 * s);
      ctx.strokeStyle = S.flash ? '#fff' : '#c8ced6'; ctx.lineWidth = 2.2 * s;
      ctx.beginPath(); ctx.moveTo(-8 * s, -26 * s); ctx.quadraticCurveTo(-18 * s, -14 * s, -14 * s, -2 * s); ctx.stroke();
      break;
    }
    case 'beacon': {                                             // 등대지기: 두건, 장대 끝 등불
      robe(S, 17 * s, -42 * s, tun); legsHidden(S); torso(S); head(S, 'hood', 8 * s);
      armWeapon(S, 0.1, () => {
        line(S, 0, 6 * s, 4 * s, -38 * s, 2.4 * s, S.flash ? '#fff' : '#5c4326');
        ctx.fillStyle = S.flash ? '#fff' : '#3a3f48'; ctx.fillRect(-1 * s, -50 * s, 10 * s, 12 * s);
        if (!S.flash) {
          ctx._skipInk = true;
          const gl = 0.75 + Math.sin(MODEL.time * 3) * 0.25;
          ctx.fillStyle = acc; ctx.globalAlpha = gl; ctx.fillRect(1 * s, -48 * s, 6 * s, 8 * s);
          ctx.globalAlpha = gl * 0.25; ctx.beginPath(); ctx.arc(4 * s, -44 * s, 18 * s, 0, 7); ctx.fill();
          ctx.globalAlpha = 1; ctx._skipInk = false;
        }
      }, 4 * s);
      break;
    }
    case 'stormcaller': {                                        // 폭풍술사: 뾰족 모자, 먹구름이 맺힌 지팡이
      robe(S, 18 * s, -44 * s, tun); head(S, 'wizard', 8 * s);
      armWeapon(S, -0.3 + atk * 0.5, () => {
        line(S, 0, 0, 3 * s, -40 * s, 2.8 * s, S.flash ? '#fff' : '#2a2a3a');
        ctx.fillStyle = S.flash ? '#fff' : '#5a6a8a';
        for (const [cx, cy, r] of [[-3, -48, 6], [5, -50, 7], [11, -46, 5]]) { ctx.beginPath(); ctx.arc(cx * s, cy * s, r * s, 0, 7); ctx.fill(); }
        if (!S.flash && (atk > 0.3 || Math.sin(MODEL.time * 5) > 0.7)) {
          ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 1.6 * s;
          ctx.beginPath(); ctx.moveTo(4 * s, -44 * s); ctx.lineTo(1 * s, -36 * s); ctx.lineTo(6 * s, -34 * s); ctx.lineTo(2 * s, -26 * s); ctx.stroke(); ctx._skipInk = false;
        }
      }, 4 * s);
      break;
    }
    case 'anchorguard': {                                        // 닻 수호병: 큰 투구, 거대한 닻
      const O = Object.assign({}, S, { lw: 6.4 * s });
      legs(O, 21 * s); torso(O, 7 * s); head(O, 'greathelm', 10 * s);
      armWeapon(O, -1.1 + atk * 1.9, () => {
        const c = S.flash ? '#fff' : acc;
        line(O, 0, 0, 40 * s, 0, 4.4 * s, c);
        line(O, 10 * s, -9 * s, 10 * s, 9 * s, 3.4 * s, c);
        ctx.strokeStyle = c; ctx.lineWidth = 4.4 * s;
        ctx.beginPath(); ctx.arc(34 * s, 0, 13 * s, -1.3, 1.3); ctx.stroke();
        tri(O, 37 * s, -15 * s, 30 * s, -16 * s, 34 * s, -9 * s, c); tri(O, 37 * s, 15 * s, 30 * s, 16 * s, 34 * s, 9 * s, c);
      }, 9 * s);
      break;
    }
    case 'clawcrab': {                                           // 집게 게: 넓은 등딱지, 눈자루, 큰 집게
      const b = S.moving ? Math.abs(Math.sin(phase * 2)) * 2 * s : 0;
      ctx.strokeStyle = S.flash ? '#fff' : shade(col, -0.3); ctx.lineWidth = 2.2 * s;
      for (let i = 0; i < 3; i++) { const lx = (-14 + i * 9) * s, kk = Math.sin(phase * 2 + i) * 3 * s;
        ctx.beginPath(); ctx.moveTo(lx, -10 * s - b); ctx.lineTo(lx - 5 * s + kk, -4 * s); ctx.lineTo(lx - 7 * s + kk, 0); ctx.stroke(); }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -16 * s - b, 22 * s, 12 * s, 0, Math.PI, 0); ctx.lineTo(22 * s, -12 * s - b); ctx.lineTo(-22 * s, -12 * s - b); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : acc;
      for (const ex of [6, 12]) { line(S, ex * s, -26 * s - b, ex * s, -34 * s - b, 1.6 * s, col); ctx.beginPath(); ctx.arc(ex * s, -35 * s - b, 2.2 * s, 0, 7); ctx.fill(); }
      const snap = atk * 0.6;
      ctx.save(); ctx.translate(20 * s, -20 * s - b); ctx.rotate(-0.3 - snap);
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(10 * s, 0, 11 * s, 7 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(14 * s, -2 * s); ctx.lineTo(26 * s, -8 * s - snap * 10 * s); ctx.lineTo(18 * s, 2 * s); ctx.fill();
      ctx.restore();
      break;
    }
    case 'nagaspear': {                                          // 나가 창병: 뱀 꼬리, 지느러미, 삼지창
      ctx.fillStyle = tun;
      const sw = Math.sin(phase) * 4 * s;
      ctx.beginPath(); ctx.moveTo(-6 * s, -36 * s); ctx.quadraticCurveTo(-16 * s, -14 * s, -4 * s + sw, -6 * s);
      ctx.quadraticCurveTo(14 * s, 2 * s, -18 * s - sw, 0); ctx.lineTo(-22 * s - sw, -3 * s);
      ctx.quadraticCurveTo(4 * s, -4 * s, -10 * s, -14 * s); ctx.quadraticCurveTo(-4 * s, -26 * s, 6 * s, -36 * s); ctx.closePath(); ctx.fill();
      torso(S, 4 * s); head(S, 'bald', 8 * s);
      tri(S, -6 * s, -56 * s, -14 * s, -64 * s, -4 * s, -48 * s, acc);
      armWeapon(S, -0.35 - atk * 0.2, () => {
        line(S, -6 * s, 0, 44 * s, -8 * s, 2.4 * s, S.flash ? '#fff' : '#8a7a5a');
        for (const dy of [-5, 0, 5]) line(S, 42 * s, -8 * s + dy * s * 0.6, 52 * s, -9 * s + dy * s, 1.6 * s, acc);
      }, 10 * s);
      break;
    }
    case 'siren': {                                              // 세이렌: 물고기 꼬리, 긴 머리칼, 노래하는 음표
      ctx.fillStyle = tun;
      ctx.beginPath(); ctx.moveTo(-7 * s, -34 * s); ctx.quadraticCurveTo(-12 * s, -10 * s, 4 * s, -4 * s);
      ctx.lineTo(14 * s, -10 * s); ctx.lineTo(12 * s, 2 * s); ctx.lineTo(2 * s, 2 * s);
      ctx.quadraticCurveTo(-18 * s, -6 * s, 7 * s, -34 * s); ctx.closePath(); ctx.fill();
      torso(S, 3.6 * s); head(S, 'bald', 8 * s);
      ctx.fillStyle = S.flash ? '#fff' : acc;
      ctx.beginPath(); ctx.moveTo(-8 * s, -58 * s); ctx.quadraticCurveTo(-16 * s, -40 * s, -12 * s, -28 * s); ctx.lineTo(-6 * s, -40 * s); ctx.closePath(); ctx.fill();
      arm(S, 12 * s, -40 * s);
      if (!S.flash && S.live) {
        ctx._skipInk = true; ctx.fillStyle = acc;
        for (let i = 0; i < 2; i++) { const k = (MODEL.time * 0.8 + i * 0.5) % 1;
          ctx.globalAlpha = 1 - k; const nx = 16 * s + k * 18 * s, ny = -54 * s - k * 16 * s;
          ctx.beginPath(); ctx.ellipse(nx, ny, 2.4 * s, 1.8 * s, -0.4, 0, 7); ctx.fill(); ctx.fillRect(nx + 1.8 * s, ny - 7 * s, 1 * s, 7 * s); }
        ctx.globalAlpha = 1; ctx._skipInk = false;
      }
      break;
    }
    case 'deepone': {                                            // 심연 어인: 구부정, 커다란 눈, 지느러미, 발톱
      ctx.save(); ctx.rotate(0.1);
      legs(S, 17 * s); torso(S, 4.6 * s); head(S, 'bald', 9 * s);
      tri(S, -8 * s, -58 * s, -16 * s, -50 * s, -6 * s, -46 * s, acc);
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = '#e8ffd8'; ctx.beginPath(); ctx.arc(5 * s, -52 * s, 3 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(6 * s, -52 * s, 1.4 * s, 0, 7); ctx.fill(); ctx._skipInk = false; }
      armWeapon(S, -0.5 + atk * 1.4, () => { for (let j = 0; j < 3; j++) line(S, 2 * s, (j - 1) * 2.4 * s, 12 * s, (j - 1) * 3.4 * s - 2 * s, 1.6 * s, S.flash ? '#fff' : acc); }, 6 * s);
      ctx.restore();
      break;
    }
    case 'jelly': {                                              // 독 해파리: 반투명 갓, 늘어진 촉수
      const fl = Math.sin(phase * 1.3) * 4 * s;
      ctx.save(); ctx.translate(0, fl - 12 * s);
      if (!S.flash) { ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * s; ctx.globalAlpha = 0.8;
        for (let i = 0; i < 5; i++) { const x0 = (-10 + i * 5) * s; ctx.beginPath(); ctx.moveTo(x0, -16 * s);
          ctx.quadraticCurveTo(x0 + Math.sin(MODEL.time * 3 + i) * 5 * s, 0, x0 + Math.sin(MODEL.time * 2 + i) * 3 * s, 12 * s); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx._skipInk = false; }
      ctx.fillStyle = col; ctx.globalAlpha *= S.flash ? 1 : 0.85;
      ctx.beginPath(); ctx.ellipse(0, -18 * s, 15 * s, 13 * s, 0, Math.PI, 0); ctx.quadraticCurveTo(0, -12 * s, -15 * s, -18 * s); ctx.fill();
      ctx.globalAlpha = 1;
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-4 * s, -26 * s, 5 * s, 3 * s, -0.4, 0, 7); ctx.fill(); ctx._skipInk = false; }
      ctx.restore();
      break;
    }
    case 'tidecaller': {                                         // 조수 술사: 두건, 소라 지팡이, 물방울 구슬
      robe(S, 17 * s, -44 * s, tun); head(S, 'hood', 8 * s);
      armWeapon(S, -0.25 + atk * 0.5, () => {
        line(S, 0, 0, 3 * s, -36 * s, 2.6 * s, S.flash ? '#fff' : '#d8c8a0');
        ctx.fillStyle = S.flash ? '#fff' : '#f0d8c0';
        ctx.beginPath(); ctx.moveTo(-3 * s, -36 * s); ctx.quadraticCurveTo(3 * s, -50 * s, 10 * s, -38 * s); ctx.closePath(); ctx.fill();
        orb(S, 3 * s, -48 * s, 4 * s + atk * 2 * s, S.flash ? '#fff' : acc);
      }, 4 * s);
      break;
    }
    case 'seahook': {                                            // 작살 어부: 넓은 모자, 작살총
      legs(S, 18 * s); torso(S, 4.4 * s); head(S, 'wide', 8.5 * s);
      armWeapon(S, -0.15 - atk * 0.15, () => {
        ctx.fillStyle = S.flash ? '#fff' : '#5c4326'; ctx.fillRect(-6 * s, -3 * s, 30 * s, 6 * s);
        line(S, 22 * s, 0, 38 * s, -1 * s, 2 * s, S.flash ? '#fff' : '#c8ced6');
        tri(S, 42 * s, -1 * s, 35 * s, -5 * s, 35 * s, 3 * s, acc);
      }, 8 * s);
      break;
    }
    case 'eel': {                                                // 전기 장어: 땅을 기는 긴 몸, 빛나는 점, 불꽃
      ctx.strokeStyle = S.flash ? '#fff' : col; ctx.lineWidth = 8 * s; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const x = (-26 + i * 6) * s, y = -8 * s + Math.sin(phase * 2 + i * 0.9) * 5 * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.fillStyle = S.flash ? '#fff' : col; ctx.beginPath(); ctx.ellipse(24 * s, -8 * s + Math.sin(phase * 2 + 8 * 0.9) * 5 * s, 7 * s, 5.4 * s, 0, 0, 7); ctx.fill();
      if (!S.flash) {
        ctx._skipInk = true; ctx.fillStyle = acc;
        for (let i = 1; i < 8; i += 2) { const x = (-26 + i * 6) * s, y = -8 * s + Math.sin(phase * 2 + i * 0.9) * 5 * s; ctx.beginPath(); ctx.arc(x, y, 1.6 * s, 0, 7); ctx.fill(); }
        ctx.beginPath(); ctx.arc(27 * s, -10 * s, 1.6 * s, 0, 7); ctx.fill();
        if (atk > 0.3 || Math.sin(MODEL.time * 9) > 0.8) { ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * s;
          ctx.beginPath(); ctx.moveTo(30 * s, -12 * s); ctx.lineTo(36 * s, -18 * s); ctx.lineTo(34 * s, -10 * s); ctx.lineTo(40 * s, -14 * s); ctx.stroke(); }
        ctx._skipInk = false;
      }
      break;
    }
    case 'kraken': {                                             // 크라켄: 둥근 외투막, 큰 눈, 출렁이는 촉수
      ctx.strokeStyle = S.flash ? '#fff' : col;
      for (let i = 0; i < 6; i++) {
        const a = MODEL.time * 1.4 + i * 1.1, x0 = (-18 + i * 7) * s;
        ctx.lineWidth = (6 - Math.abs(i - 2.5)) * s;
        ctx.beginPath(); ctx.moveTo(x0, -20 * s);
        ctx.quadraticCurveTo(x0 + Math.sin(a) * 14 * s, -6 * s, x0 + Math.cos(a) * 18 * s + (i - 2.5) * 6 * s, 4 * s); ctx.stroke();
      }
      const lash = atk * 1.2;
      ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(14 * s, -30 * s);
      ctx.quadraticCurveTo(34 * s, -50 * s - lash * 10 * s, 46 * s + lash * 8 * s, -20 * s + lash * 14 * s); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -44 * s, 20 * s, 26 * s, 0.15, 0, 7); ctx.fill();
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(8 * s, -36 * s, 5 * s, 4 * s, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#111'; ctx.fillRect(7 * s, -38 * s, 3 * s, 4 * s);
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.ellipse(-6 * s, -56 * s, 7 * s, 4 * s, -0.4, 0, 7); ctx.fill(); ctx._skipInk = false; }
      break;
    }
    case 'tidequeen': {                                          // 해일 여왕: 큰 뱀 꼬리, 왕관, 삼지창
      const O = Object.assign({}, S, { lw: 5.6 * s });
      ctx.fillStyle = tun;
      const sw = Math.sin(phase * 0.8) * 5 * s;
      ctx.beginPath(); ctx.moveTo(-8 * s, -40 * s); ctx.quadraticCurveTo(-22 * s, -14 * s, -2 * s + sw, -6 * s);
      ctx.quadraticCurveTo(20 * s, 2 * s, -26 * s - sw, 0); ctx.lineTo(-30 * s - sw, -4 * s);
      ctx.quadraticCurveTo(6 * s, -6 * s, -12 * s, -16 * s); ctx.quadraticCurveTo(-4 * s, -30 * s, 8 * s, -40 * s); ctx.closePath(); ctx.fill();
      torso(O, 5.6 * s); head(O, 'crown', 10 * s);
      ctx.fillStyle = S.flash ? '#fff' : col;
      ctx.beginPath(); ctx.moveTo(-9 * s, -60 * s); ctx.quadraticCurveTo(-22 * s, -40 * s, -16 * s, -26 * s); ctx.lineTo(-6 * s, -44 * s); ctx.closePath(); ctx.fill();
      armWeapon(O, -0.5 - atk * 0.4, () => {
        line(O, -8 * s, 0, 48 * s, -8 * s, 3 * s, acc);
        for (const dy of [-6, 0, 6]) line(O, 46 * s, -8 * s + dy * s * 0.6, 58 * s, -9 * s + dy * s, 2 * s, acc);
      }, 10 * s);
      break;
    }
    case 'leviathan': {                                          // 리바이어던: 솟구치는 거대한 바다뱀
      const t = MODEL.time;
      ctx.strokeStyle = S.flash ? '#fff' : col; ctx.lineCap = 'round';
      const pts = [];
      for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([(-40 + u * 60) * s, (-6 - Math.sin(u * Math.PI) * 50 + Math.sin(t * 2 + u * 6) * 4) * s]); }
      for (let i = 0; i < pts.length - 1; i++) { ctx.lineWidth = (8 + Math.sin(i / 10 * Math.PI) * 10) * s;
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke(); }
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc;
        for (let i = 2; i < 9; i += 2) tri(S, pts[i][0] - 3 * s, pts[i][1] - 8 * s, pts[i][0] + 4 * s, pts[i][1] - 18 * s, pts[i][0] + 6 * s, pts[i][1] - 7 * s, acc);
        ctx._skipInk = false; }
      const hx = pts[10][0] + 6 * s, hy = pts[10][1] - 6 * s, jaw = atk * 0.5;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(hx, hy - 4 * s, 15 * s, 9 * s, -0.2 - jaw * 0.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx + 2 * s, hy + 6 * s, 13 * s, 5 * s, 0.25 + jaw * 0.5, 0, 7); ctx.fill();
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(hx + 4 * s, hy - 8 * s, 2.6 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#efe6d8'; for (let i = 0; i < 4; i++) tri(S, hx + (2 + i * 3) * s, hy + 1 * s, hx + (3.5 + i * 3) * s, hy + 5 * s, hx + (5 + i * 3) * s, hy + 1 * s, '#efe6d8');
        ctx._skipInk = false; }
      break;
    }
    /* ---------------- 3.2 이벤트 전장의 적 ---------------- */
    case 'bloodthrall': {                                        // 혈귀 노예: 구부정한 몸, 붉은 눈, 긴 손톱
      ctx.save(); ctx.rotate(0.12);
      legs(S, 17 * s); torso(S, 3.8 * s); head(S, 'bald', 8 * s);
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(4 * s, -52 * s, 1.8 * s, 0, 7); ctx.arc(9 * s, -52 * s, 1.8 * s, 0, 7); ctx.fill(); ctx._skipInk = false; }
      armWeapon(S, -0.5 + atk * 1.5, () => { for (let j = 0; j < 3; j++) line(S, 2 * s, (j - 1) * 2.4 * s, 14 * s, (j - 1) * 3.6 * s - 2 * s, 1.6 * s, S.flash ? '#fff' : '#efe6d8'); }, 6 * s);
      ctx.restore();
      break;
    }
    case 'stoneward': {                                          // 바위 수호자: 돌 몸, 룬이 빛나는 큰 방패
      const O = Object.assign({}, S, { lw: 6.2 * s });
      legs(O, 20 * s); torso(O, 7 * s); head(O, 'greathelm', 9 * s);
      shieldShape(S, 13 * s, -54 * s, 24 * s, 48 * s, col);
      if (!S.flash) {
        ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 2 * s;
        ctx.globalAlpha = 0.7 + Math.sin(MODEL.time * 3) * 0.3;
        ctx.beginPath(); ctx.moveTo(25 * s, -44 * s); ctx.lineTo(25 * s, -22 * s); ctx.moveTo(19 * s, -38 * s); ctx.lineTo(31 * s, -28 * s); ctx.moveTo(31 * s, -38 * s); ctx.lineTo(19 * s, -28 * s); ctx.stroke();
        ctx.globalAlpha = 1; ctx._skipInk = false;
      }
      break;
    }
    case 'rockling': {                                           // 바위 새끼: 울퉁불퉁한 돌덩이와 수정
      const b = S.moving ? Math.abs(Math.sin(phase)) * 2 * s : 0;
      ctx.fillStyle = S.flash ? '#fff' : shade(col, -0.3);
      ctx.fillRect(-9 * s, -8 * s, 6 * s, 8 * s); ctx.fillRect(3 * s, -8 * s, 6 * s, 8 * s);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-16 * s, -8 * s - b); ctx.lineTo(-18 * s, -26 * s - b); ctx.lineTo(-8 * s, -40 * s - b); ctx.lineTo(6 * s, -42 * s - b);
      ctx.lineTo(17 * s, -30 * s - b); ctx.lineTo(16 * s, -10 * s - b); ctx.closePath(); ctx.fill();
      tri(S, -6 * s, -40 * s - b, -2 * s, -54 * s - b, 3 * s, -41 * s - b, acc);
      tri(S, 4 * s, -41 * s - b, 10 * s, -50 * s - b, 12 * s, -36 * s - b, acc);
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = '#1a1a1a'; ctx.fillRect(4 * s, -30 * s - b, 3 * s, 2 * s); ctx.fillRect(10 * s, -30 * s - b, 3 * s, 2 * s); ctx._skipInk = false; }
      break;
    }
    case 'ghostsailor': {                                        // 유령 선원: 흐릿한 아랫몸, 두건, 굽은 칼
      const fl = Math.sin(phase * 0.9) * 3 * s;
      ctx.save(); ctx.translate(0, fl - 4 * s);
      ctx.fillStyle = tun;
      ctx.beginPath(); ctx.moveTo(-9 * s, -40 * s); ctx.lineTo(9 * s, -40 * s); ctx.quadraticCurveTo(14 * s, -14 * s, 6 * s, 0);
      ctx.lineTo(0, -8 * s); ctx.lineTo(-6 * s, 0); ctx.quadraticCurveTo(-14 * s, -14 * s, -9 * s, -40 * s); ctx.fill();
      head(S, 'wrap', 8 * s);
      armWeapon(S, -0.8 + atk * 1.8, () => {
        ctx.strokeStyle = S.flash ? '#fff' : '#c8ced6'; ctx.lineWidth = 2.6 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(14 * s, -2 * s, 22 * s, -10 * s); ctx.stroke();
      }, 6 * s);
      ctx.restore();
      break;
    }
    case 'ghostgunner': {                                        // 유령 포수: 넓은 모자, 어깨에 멘 대포
      robe(S, 16 * s, -42 * s, tun); head(S, 'wide', 8 * s);
      ctx.save(); ctx.translate(4 * s, -40 * s); ctx.rotate(-0.12 - atk * 0.15);
      ctx.fillStyle = S.flash ? '#fff' : '#3a3f48';
      ctx.fillRect(-14 * s, -5 * s, 40 * s, 10 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#23272e'; ctx.fillRect(24 * s, -6 * s, 5 * s, 12 * s);
      if (!S.flash && S.live) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.globalAlpha = 0.6 + Math.sin(MODEL.time * 9) * 0.4; ctx.beginPath(); ctx.arc(-15 * s, -6 * s, 2.2 * s, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx._skipInk = false; }
      ctx.restore();
      arm(S, 12 * s, -34 * s);
      break;
    }
    case 'voidspawn': {                                          // 공허 새끼: 떠다니는 어둠 덩어리, 외눈
      const fl = Math.sin(phase * 1.2) * 3 * s;
      ctx.save(); ctx.translate(0, fl - 10 * s);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, -18 * s, 15 * s, 0, 7); ctx.fill();
      for (let i = 0; i < 4; i++) { const a = MODEL.time * 2 + i * 1.6; line(S, (-9 + i * 6) * s, -6 * s, (-11 + i * 6) * s + Math.sin(a) * 3 * s, 6 * s, 2.4 * s, col); }
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(4 * s, -20 * s, 5 * s, 4 * s + atk * 2 * s, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#0c0a12'; ctx.beginPath(); ctx.arc(5 * s, -20 * s, 2 * s, 0, 7); ctx.fill(); ctx._skipInk = false; }
      ctx.restore();
      break;
    }
    case 'riftcaller': {                                         // 균열 소환사: 두건, 뒤에 도는 균열 고리
      if (!S.flash) {
        ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 2 * s;
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.ellipse(-8 * s, -52 * s, 18 * s, 24 * s, MODEL.time * 0.8, 0, 5); ctx.stroke();
        ctx.globalAlpha = 1; ctx._skipInk = false;
      }
      robe(S, 17 * s, -44 * s, tun); head(S, 'hood', 8 * s);
      armWeapon(S, -0.25 + atk * 0.5, () => {
        line(S, 0, 0, 3 * s, -40 * s, 2.6 * s, S.flash ? '#fff' : '#241a3a');
        orb(S, 3 * s, -46 * s, 5 * s + atk * 2 * s, S.flash ? '#fff' : acc);
      }, 4 * s);
      break;
    }
    case 'imp': {                                                // 화염 임프: 작은 뿔, 꼬리, 삼지창
      ctx.strokeStyle = S.flash ? '#fff' : col; ctx.lineWidth = 2.2 * s;
      ctx.beginPath(); ctx.moveTo(-5 * s, -22 * s); ctx.quadraticCurveTo(-22 * s, -18 * s + Math.sin(phase) * 4 * s, -20 * s, -34 * s); ctx.stroke();
      tri(S, -22 * s, -38 * s, -17 * s, -33 * s, -23 * s, -31 * s, S.flash ? '#fff' : col);
      legs(S, 15 * s); torso(S, 3.4 * s); head(S, 'devil', 8 * s);
      armWeapon(S, -0.5 + atk * 1.4, () => {
        line(S, -6 * s, 0, 24 * s, -6 * s, 2 * s, S.flash ? '#fff' : '#3a2a1a');
        for (let j = -1; j <= 1; j++) line(S, 22 * s, -6 * s + j * 3.5 * s, 30 * s, -7 * s + j * 4.5 * s, 1.6 * s, acc);
      }, 6 * s);
      break;
    }
    case 'demonknight': {                                        // 마계 기사: 뿔 투구, 찢긴 망토, 불붙은 대검
      const O = Object.assign({}, S, { lw: 6.4 * s });
      cape(O, -1, '#5a0e1e', 1.2);
      legs(O, 22 * s); torso(O, 7 * s); head(O, 'horn', 10 * s);
      armWeapon(O, -1.2 + atk * 2, () => {
        line(O, 0, 0, 10 * s, 0, 4 * s, '#2a1a1a');
        ctx.fillStyle = S.flash ? '#fff' : '#3a3f48';
        ctx.beginPath(); ctx.moveTo(8 * s, -4 * s); ctx.lineTo(50 * s, -3 * s); ctx.lineTo(56 * s, 0); ctx.lineTo(50 * s, 3 * s); ctx.lineTo(8 * s, 4 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.globalAlpha = 0.55; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse((18 + j * 10) * s, -6 * s - Math.sin(MODEL.time * 7 + j) * 2 * s, 4 * s, 6 * s, 0, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; ctx._skipInk = false; }
      }, 9 * s);
      break;
    }
    case 'vampire': {                                            // 흡혈 백작: 높은 깃 망토, 창백한 얼굴, 가는 검
      const O = Object.assign({}, S, { lw: 5 * s });
      cape(O, -1, S.flash ? '#fff' : tun, 1.5);
      legs(O, 22 * s); torso(O, 5.5 * s); head(O, 'bald', 9.5 * s);
      ctx.fillStyle = S.flash ? '#fff' : tun;                    // 치솟은 깃
      ctx.beginPath(); ctx.moveTo(-10 * s, -44 * s); ctx.lineTo(-14 * s, -66 * s); ctx.lineTo(-4 * s, -48 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10 * s, -44 * s); ctx.lineTo(14 * s, -64 * s); ctx.lineTo(5 * s, -48 * s); ctx.closePath(); ctx.fill();
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(4 * s, -52 * s, 1.9 * s, 0, 7); ctx.arc(10 * s, -52 * s, 1.9 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; tri(S, 6 * s, -46 * s, 7 * s, -43 * s, 8 * s, -46 * s, '#fff'); ctx._skipInk = false; }
      armWeapon(O, -0.4 + atk * 1.2, () => { line(O, 0, 0, 44 * s, -4 * s, 2 * s, S.flash ? '#fff' : '#d8dde4'); line(O, -2 * s, -5 * s, -2 * s, 5 * s, 2.4 * s, acc); }, 7 * s);
      break;
    }
    case 'titan': {                                              // 대지 거신: 바위 몸, 가슴의 용암 핵, 거대한 주먹
      const O = Object.assign({}, S, { lw: 9 * s });
      legs(O, 24 * s);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-18 * s, -22 * s); ctx.lineTo(-22 * s, -52 * s); ctx.lineTo(-8 * s, -64 * s); ctx.lineTo(10 * s, -64 * s);
      ctx.lineTo(22 * s, -50 * s); ctx.lineTo(18 * s, -22 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : shade(col, -0.2);
      ctx.beginPath(); ctx.arc(2 * s, -70 * s, 8 * s, 0, 7); ctx.fill();
      if (!S.flash) {
        ctx._skipInk = true;
        const hot = 0.6 + Math.sin(MODEL.time * 4) * 0.25;
        ctx.fillStyle = acc; ctx.globalAlpha = hot;
        ctx.beginPath(); ctx.arc(0, -42 * s, 8 * s, 0, 7); ctx.fill();
        ctx.globalAlpha = hot * 0.35; ctx.beginPath(); ctx.arc(0, -42 * s, 15 * s, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * s;
        ctx.beginPath(); ctx.moveTo(0, -34 * s); ctx.lineTo(-6 * s, -24 * s); ctx.moveTo(6 * s, -48 * s); ctx.lineTo(14 * s, -56 * s); ctx.stroke();
        ctx.fillStyle = acc; ctx.fillRect(0, -72 * s, 3 * s, 2 * s); ctx.fillRect(6 * s, -72 * s, 3 * s, 2 * s);
        ctx._skipInk = false;
      }
      armWeapon(O, -1.4 + atk * 2.2, () => {
        ctx.fillStyle = S.flash ? '#fff' : shade(col, -0.1);
        ctx.beginPath(); ctx.arc(26 * s, 0, 13 * s, 0, 7); ctx.fill();
      }, 12 * s);
      break;
    }
    case 'ghostcaptain': {                                       // 유령 선장: 삼각 모자, 긴 외투, 갈고리와 등불
      const fl = Math.sin(phase * 0.7) * 3 * s;
      ctx.save(); ctx.translate(0, fl - 4 * s);
      const O = Object.assign({}, S, { lw: 5.6 * s });
      ctx.fillStyle = tun;
      ctx.beginPath(); ctx.moveTo(-11 * s, -44 * s); ctx.lineTo(11 * s, -44 * s); ctx.quadraticCurveTo(18 * s, -16 * s, 9 * s, 0);
      ctx.lineTo(0, -10 * s); ctx.lineTo(-9 * s, 0); ctx.quadraticCurveTo(-18 * s, -16 * s, -11 * s, -44 * s); ctx.fill();
      torso(O, 6 * s); head(O, 'wide', 10 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#1c2430';
      ctx.beginPath(); ctx.moveTo(-16 * s, -60 * s); ctx.lineTo(0, -74 * s); ctx.lineTo(16 * s, -60 * s); ctx.closePath(); ctx.fill();
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.globalAlpha = 0.7 + Math.sin(MODEL.time * 3) * 0.3;
        ctx.beginPath(); ctx.arc(-16 * s, -24 * s, 4.5 * s, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx._skipInk = false; }
      armWeapon(O, -0.9 + atk * 1.8, () => {
        ctx.strokeStyle = S.flash ? '#fff' : '#c8ced6'; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(20 * s, -2 * s, 32 * s, -14 * s); ctx.stroke();
      }, 8 * s);
      ctx.restore();
      break;
    }
    case 'voidlord': {                                           // 공허의 군주: 떠 있는 법의, 가시 왕관, 촉수
      const fl = Math.sin(phase * 0.6) * 4 * s;
      ctx.save(); ctx.translate(0, fl - 8 * s);
      if (!S.flash) for (let i = 0; i < 4; i++) {
        const a = MODEL.time * 1.5 + i * 1.3;
        ctx.strokeStyle = tun; ctx.lineWidth = 3.4 * s;
        ctx.beginPath(); ctx.moveTo((-8 + i * 5) * s, -6 * s);
        ctx.quadraticCurveTo((-14 + i * 6) * s + Math.sin(a) * 8 * s, 6 * s, (-12 + i * 7) * s + Math.cos(a) * 10 * s, 14 * s); ctx.stroke();
      }
      robe(S, 22 * s, -50 * s, col); head(S, 'hood', 10 * s);
      for (let i = -2; i <= 2; i++) tri(S, i * 5 * s - 2 * s, -62 * s, i * 5 * s, -74 * s - Math.abs(i) * -2 * s, i * 5 * s + 2 * s, -62 * s, acc);
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(3 * s, -52 * s, 2 * s, 0, 7); ctx.arc(9 * s, -52 * s, 2 * s, 0, 7); ctx.fill(); ctx._skipInk = false; }
      armWeapon(S, -0.3 + atk * 0.6, () => { orb(S, 14 * s, -4 * s, 8 * s + atk * 3 * s, S.flash ? '#fff' : acc); }, 5 * s);
      ctx.restore();
      break;
    }
    case 'demonking': {                                          // 마왕: 박쥐 날개, 왕관 뿔, 불타는 대검
      const O = Object.assign({}, S, { lw: 8.5 * s });
      if (!S.flash) for (let i = 0; i < 2; i++) {                 // 날개
        const flap = Math.sin(MODEL.time * 2 + i) * 0.15;
        ctx.save(); ctx.translate(-6 * s, -50 * s); ctx.rotate(-0.4 - i * 0.35 + flap);
        ctx.fillStyle = shade(tun, i ? -0.2 : 0);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-42 * s, -24 * s); ctx.lineTo(-36 * s, -6 * s); ctx.lineTo(-44 * s, 4 * s);
        ctx.lineTo(-30 * s, 8 * s); ctx.lineTo(-30 * s, 20 * s); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      legs(O, 26 * s);
      ctx.fillStyle = tun; ctx.beginPath(); ctx.ellipse(0, -44 * s, 16 * s, 20 * s, 0, 0, 7); ctx.fill();
      torso(O, 9 * s); head(O, 'devil', 12 * s);
      for (let i = -1; i <= 1; i++) tri(O, i * 7 * s - 3 * s, -62 * s, i * 7 * s, -72 * s, i * 7 * s + 3 * s, -62 * s, '#c9a227');
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(4 * s, -52 * s, 2.4 * s, 0, 7); ctx.arc(11 * s, -52 * s, 2.4 * s, 0, 7); ctx.fill(); ctx._skipInk = false; }
      armWeapon(O, -1.3 + atk * 2.1, () => {
        line(O, 0, 0, 12 * s, 0, 5 * s, '#1a0e0e');
        ctx.fillStyle = S.flash ? '#fff' : '#2a2a30';
        ctx.beginPath(); ctx.moveTo(10 * s, -6 * s); ctx.lineTo(62 * s, -4 * s); ctx.lineTo(70 * s, 0); ctx.lineTo(62 * s, 4 * s); ctx.lineTo(10 * s, 6 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.globalAlpha = 0.6; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse((18 + j * 11) * s, -8 * s - Math.sin(MODEL.time * 8 + j) * 3 * s, 5 * s, 8 * s, 0, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; ctx._skipInk = false; }
      }, 12 * s);
      break;
    }
    case 'sapper':                                               // 성벽 파괴병: 등에 큰 화약통, 불붙은 심지
      barrel(S, -27 * s, -62 * s, 20 * s, 30 * s, S.flash ? '#fff' : '#6e4a24', true);
      ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(-23 * s, -52 * s); ctx.lineTo(-11 * s, -40 * s); ctx.moveTo(-11 * s, -52 * s); ctx.lineTo(-23 * s, -40 * s); ctx.stroke();
      legs(S, 16 * s); torso(S, 3.6 * s); head(S, 'pot', 7.5 * s);
      arm(S, 10 * s, -30 * s); hand(S, 10 * s, -30 * s);
      if (!S.flash && S.live) {                                  // 튀는 불똥
        ctx._skipInk = true; ctx.fillStyle = '#ffd35a';
        for (let i = 0; i < 3; i++) {
          const k = (MODEL.time * 3 + i / 3) % 1;
          ctx.globalAlpha = 1 - k;
          ctx.beginPath(); ctx.arc(-2 * s + Math.cos(i * 2 + k * 4) * k * 10 * s, -68 * s - k * 8 * s, 1.3 * s, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx._skipInk = false;
      }
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

    /* ---------------------- 4.3 3진: 여섯만, 공들여 ----------------------
     * 진화한 병종이 레벨 20 에 한 번 더 바뀐다. 엉뚱하지만 어울리게 — 투석기는 전차로, 사제는 구급차로.
     * 큰 면은 잉크 테두리와 그림자, 잔무늬·빛은 테두리 없이. hq(잉크가 켜진 품질)일 때만 잔무늬를 그린다. */
    case 'tank': {                                             // 공성 전차: 궤도 · 회전 포탑 · 반동하는 포신 · 고개 내민 지휘관
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash;
      const hullC = x3Hex(tun, 0), hullD = x3Hex(tun, -0.3);
      const mv = S.moving, roll = mv ? phase * 8 : 0, rc = atk * 8 * s, t = MODEL.time;
      const rum = mv && S.live ? Math.sin(t * 38) * 0.45 * s : 0;
      if (live) for (let i = 0; i < 3; i++) {                  // 배기 연기 (달리면 짙어진다)
        const q = (t * (mv ? 1.3 : 0.55) + i / 3) % 1;
        x3Puff(S, (-44 - q * 14) * s, (-31 - q * 24) * s, (2.2 + q * 5.5) * s, (1 - q) * (mv || atk > 0 ? 0.5 : 0.26), '#cfcac0');
      }
      if (live && mv) for (let i = 0; i < 2; i++) {            // 궤도가 차올리는 흙먼지
        const q = (t * 2.1 + i / 2) % 1;
        x3Puff(S, (-46 - q * 18) * s, (-3 - q * 7) * s, (2 + q * 4.5) * s, (1 - q) * 0.42, '#d8c8a8');
      }
      ctx.save(); ctx.translate(0, rum);
      ctx.fillStyle = F3('#34363c');                           // 궤도 띠
      ctx.beginPath(); ctx.moveTo(-36 * s, -17 * s); ctx.lineTo(31 * s, -17 * s);
      ctx.quadraticCurveTo(42 * s, -8.5 * s, 31 * s, 0); ctx.lineTo(-36 * s, 0);
      ctx.quadraticCurveTo(-46 * s, -8.5 * s, -36 * s, -17 * s); ctx.fill();
      if (hq) {                                                // 궤도 마디: 윗줄은 앞으로, 아랫줄은 뒤로 흐른다
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(160,162,170,.6)';
        const off = ((roll % 6) + 6) % 6;
        for (let x = -35 + off; x < 30; x += 6) ctx.fillRect(x * s, -17 * s, 2.6 * s, 2 * s);
        for (let x = 29 - off; x > -36; x -= 6) ctx.fillRect(x * s, -2 * s, 2.6 * s, 2 * s);
        ctx.restore(); ctx._skipInk = false;
      }
      for (const wx of [-25, -12.5, 0, 12.5]) x3Wheel(S, wx * s, -8.5 * s, 5.4 * s, roll * 0.7, '#26282c', '#8c927a');
      x3Wheel(S, 26 * s, -9.5 * s, 6 * s, roll * 0.65, '#26282c', '#a0a68e');        // 구동 바퀴
      x3Wheel(S, -37 * s, -9 * s, 4.6 * s, roll * 0.85, '#26282c', '#8c927a');       // 유도 바퀴
      ctx.fillStyle = F3(hullD);                               // 측면 장갑판
      ctx.beginPath(); ctx.moveTo(-41 * s, -14.5 * s); ctx.lineTo(35 * s, -14.5 * s); ctx.lineTo(38 * s, -21 * s); ctx.lineTo(-41 * s, -21 * s); ctx.closePath(); ctx.fill();
      if (hq) {
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = shade(hullD, 0.35);
        for (let x = -37; x < 34; x += 8) { ctx.beginPath(); ctx.arc(x * s, -17.7 * s, 0.9 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3(hullC);                               // 차체
      ctx.beginPath(); ctx.moveTo(-42 * s, -20 * s); ctx.lineTo(-37 * s, -31 * s); ctx.lineTo(27 * s, -31 * s); ctx.lineTo(43 * s, -20 * s); ctx.closePath(); ctx.fill();
      if (hq) {
        ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = shade(hullC, -0.24);                   // 위장 무늬
        for (const [x, y, rx, ry] of [[-27, -25, 7, 2.6], [-8, -24, 5, 2.2], [11, -27, 6, 2], [30, -23.5, 3.5, 1.8]]) {
          ctx.beginPath(); ctx.ellipse(x * s, y * s, rx * s, ry * s, 0.2, 0, 7); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,.2)';                // 앞 비탈에 비친 빛
        ctx.beginPath(); ctx.moveTo(27 * s, -31 * s); ctx.lineTo(43 * s, -20 * s); ctx.lineTo(39 * s, -20 * s); ctx.lineTo(25 * s, -29.5 * s); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.lineWidth = 1 * s;
        ctx.beginPath(); ctx.moveTo(-36 * s, -30.2 * s); ctx.lineTo(26 * s, -30.2 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3('#fff2c0'); ctx.beginPath(); ctx.arc(37 * s, -24.5 * s, 2 * s, 0, 7); ctx.fill();   // 전조등
      if (live) x3Glow(S, 37.5 * s, -24.5 * s, 2.6 * s, '#ffe8a0', 0.3);
      ctx.fillStyle = F3('#2a2a2e'); ctx.fillRect(-45 * s, -30 * s, 5 * s, 3.2 * s);                      // 배기관
      // 안테나: 달리면 뒤로 휘고, 쏘면 흔들린다
      const sway = Math.sin(t * 3.1) * 2.2 * s + (mv ? -3 * s : 0) - atk * 5 * s;
      ctx.strokeStyle = F3('#2a2a2e'); ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(-15 * s, -44 * s); ctx.quadraticCurveTo(-18 * s + sway * 0.4, -62 * s, -22 * s + sway, -80 * s); ctx.stroke();
      if (hq) { ctx.fillStyle = '#ff5a3c'; ctx.beginPath(); ctx.arc(-22 * s + sway, -80 * s, 1.3 * s, 0, 7); ctx.fill(); }
      // 포신 (반동으로 밀려난다) · 배연기 · 포구 제퇴기
      ctx.fillStyle = F3(hullD); ctx.fillRect(14 * s - rc, -40.5 * s, 50 * s, 5 * s);
      ctx.fillStyle = F3(hullC); ctx.fillRect(34 * s - rc, -42 * s, 9 * s, 8 * s);
      ctx.fillStyle = F3('#3a3c42'); ctx.fillRect(62 * s - rc, -42.5 * s, 8 * s, 9 * s);
      if (hq) {
        ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = '#1a1a1e'; ctx.fillRect(64 * s - rc, -41 * s, 1.6 * s, 6 * s); ctx.fillRect(67 * s - rc, -41 * s, 1.6 * s, 6 * s);
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(14 * s - rc, -40.5 * s, 50 * s, 1.4 * s);
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3(hullC);                               // 포탑
      ctx.beginPath(); ctx.moveTo(-20 * s, -31 * s); ctx.lineTo(-16 * s, -45 * s); ctx.quadraticCurveTo(-4 * s, -49 * s, 10 * s, -46 * s);
      ctx.lineTo(20 * s, -40 * s); ctx.lineTo(22 * s, -31 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(hullD); ctx.beginPath(); roundRectPath(ctx, 15 * s, -44 * s, 8 * s, 10 * s, 2 * s); ctx.fill();   // 포방패
      if (hq) {
        ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.moveTo(-16 * s, -44.6 * s); ctx.quadraticCurveTo(-4 * s, -48.4 * s, 9 * s, -45.6 * s); ctx.lineTo(8 * s, -43 * s);
        ctx.quadraticCurveTo(-4 * s, -45.6 * s, -15 * s, -42 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(hullC, -0.24); ctx.beginPath(); ctx.ellipse(-9 * s, -36.5 * s, 4.5 * s, 2 * s, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#f4f1e8'; ctx.beginPath();            // 흰 별
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 1.6 : 3.8) * s; ctx.lineTo(3 * s + Math.cos(a) * rr, -37 * s + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      // 해치에서 고개를 내민 지휘관 (이기면 손을 흔든다)
      const O = sub(S, 0.55, 2.2 * s);
      ctx.save(); ctx.translate(-7 * s, -35.5 * s);
      torso(O);
      if (S.cheer) arm(O, -5 * O.s, -64 * O.s); else arm(O, 9 * O.s, -36 * O.s);
      head(O, 'cap');
      if (hq) { ctx.fillStyle = '#2a2a2e'; ctx.fillRect(-6 * O.s, -54 * O.s, 13 * O.s, 3 * O.s);
        ctx.fillStyle = '#9fd8ff'; ctx.fillRect(1.5 * O.s, -53.4 * O.s, 4.5 * O.s, 1.8 * O.s); }
      ctx.restore();
      ctx.fillStyle = F3(hullD); ctx.beginPath(); ctx.ellipse(-7 * s, -46.5 * s, 7.5 * s, 2.2 * s, 0, 0, 7); ctx.fill();   // 해치 테
      if (live && atk > 0.45) {                                // 포구 섬광
        const k = (atk - 0.45) / 0.55, mx = 72 * s - rc;
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= k; ctx.fillStyle = '#ffd35a';
        ctx.beginPath(); ctx.moveTo(mx - 2 * s, -42 * s); ctx.lineTo(mx + 17 * s, -38 * s); ctx.lineTo(mx - 2 * s, -34 * s); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(mx, -38 * s); ctx.lineTo(mx + 6 * s, -49 * s); ctx.lineTo(mx + 3 * s, -38 * s); ctx.lineTo(mx + 6 * s, -27 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(mx + 2 * s, -38 * s, 5 * s, 0, 7); ctx.fill();
        ctx.globalAlpha *= 0.35; ctx.fillStyle = '#ffb03c'; ctx.beginPath(); ctx.arc(mx + 4 * s, -38 * s, 15 * s, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.restore();
      break;
    }

    case 'ambulance': {                                        // 구급 마차: 흰 구급차 · 번갈아 도는 경광등 · 창가의 사제
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const white = '#f6f3ea', red = acc;
      const mv = S.moving, roll = mv ? phase * 7 : 0;
      const bob = mv ? Math.sin(phase * 2.2) * 0.9 * s : Math.sin(t * 2) * 0.35 * s;
      const on = Math.floor(t * 5) % 2;                        // 빨강 · 파랑이 번갈아 켜진다
      if (live) {                                              // 경광등이 땅에 비친다
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.16;
        ctx.fillStyle = on ? '#ff3a3a' : '#3a7aff'; ctx.beginPath(); ctx.ellipse(0, -1 * s, 40 * s, 5 * s, 0, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.save(); ctx.translate(0, bob);
      ctx.fillStyle = F3(white);                               // 차체 (뒤 칸 + 운전석)
      ctx.beginPath();
      ctx.moveTo(-36 * s, -13 * s); ctx.lineTo(-36 * s, -49 * s); ctx.quadraticCurveTo(-36 * s, -53 * s, -32 * s, -53 * s);
      ctx.lineTo(9 * s, -53 * s); ctx.quadraticCurveTo(13 * s, -53 * s, 15 * s, -49 * s);
      ctx.lineTo(21 * s, -36 * s); ctx.lineTo(31 * s, -34 * s); ctx.quadraticCurveTo(36 * s, -33 * s, 36 * s, -28 * s);
      ctx.lineTo(36 * s, -15.5 * s); ctx.quadraticCurveTo(36 * s, -13 * s, 33 * s, -13 * s); ctx.closePath(); ctx.fill();
      if (hq) {                                                // 그늘 · 문틈 · 손잡이
        ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = 'rgba(40,40,60,.1)'; ctx.fillRect(-36 * s, -30 * s, 72 * s, 16 * s);
        ctx.strokeStyle = 'rgba(40,40,60,.32)'; ctx.lineWidth = 0.9 * s;
        ctx.beginPath(); ctx.moveTo(-26 * s, -51 * s); ctx.lineTo(-26 * s, -16 * s); ctx.moveTo(1 * s, -51 * s); ctx.lineTo(1 * s, -16 * s); ctx.stroke();
        ctx.fillStyle = 'rgba(40,40,60,.45)'; ctx.fillRect(-30 * s, -33 * s, 2.4 * s, 1.2 * s); ctx.fillRect(3 * s, -33 * s, 2.4 * s, 1.2 * s);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-34 * s, -51.5 * s, 46 * s, 1.4 * s);
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3(red);                                 // 빨간 띠 · 큰 십자
      ctx.fillRect(-36 * s, -25 * s, 58 * s, 3.4 * s);
      ctx.fillRect(-16.5 * s, -46 * s, 6 * s, 16 * s); ctx.fillRect(-21.5 * s, -41 * s, 16 * s, 6 * s);
      ctx.fillStyle = F3('#5a5e66'); ctx.fillRect(-36 * s, -15.5 * s, 72 * s, 3 * s);          // 아래 치마
      ctx.fillStyle = F3('#bfe4ff');                           // 운전석 창 · 앞유리
      ctx.beginPath(); ctx.moveTo(3 * s, -50 * s); ctx.lineTo(13 * s, -50 * s); ctx.lineTo(18.5 * s, -38 * s); ctx.lineTo(3 * s, -38 * s); ctx.closePath(); ctx.fill();
      const O = Object.assign(sub(S, 0.48, 2 * s), { acc: S.flash ? '#ffffff' : white });   // 운전석의 사제: 붉은 십자 흰 모자
      ctx.save(); ctx.translate(9.5 * s, -19.2 * s);
      head(O, 'cap');
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = red;
        ctx.fillRect(-1.3 * O.s, -60.5 * O.s, 2.6 * O.s, 7 * O.s); ctx.fillRect(-3.5 * O.s, -58.3 * O.s, 7 * O.s, 2.6 * O.s);
        ctx.restore(); ctx._skipInk = false; }
      ctx.restore();
      if (hq) {                                                // 유리에 비친 빛줄기
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.beginPath(); ctx.moveTo(10 * s, -50 * s); ctx.lineTo(12.5 * s, -50 * s); ctx.lineTo(7 * s, -38 * s); ctx.lineTo(4.5 * s, -38 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3('#3a3c42'); ctx.fillRect(-15 * s, -57.5 * s, 24 * s, 4.5 * s);      // 경광등 받침
      ctx.fillStyle = F3(on ? '#ff3a3a' : '#7a2020'); ctx.beginPath(); roundRectPath(ctx, -14 * s, -62 * s, 10 * s, 5 * s, 2 * s); ctx.fill();
      ctx.fillStyle = F3(on ? '#2a4a8a' : '#3a8aff'); ctx.beginPath(); roundRectPath(ctx, -2 * s, -62 * s, 10 * s, 5 * s, 2 * s); ctx.fill();
      if (live) {                                              // 도는 경광등: 옆에서 보면 빛줄기가 좌우로 쓸고 지나간다
        const lx = on ? -9 * s : 3 * s, col = on ? '#ff4a4a' : '#4a8aff', a = t * 9;
        const face = Math.max(0, Math.sin(a)), L = Math.cos(a) * 56 * s;   // 이쪽을 볼 때 밝고, 옆을 볼 때 길다
        x3Glow(S, lx, -59.5 * s, (3.4 + face * 2.6) * s, col, 0.42 + face * 0.4);
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
        ctx.globalAlpha *= 0.16;
        ctx.beginPath(); ctx.moveTo(lx, -61.5 * s); ctx.lineTo(lx + L, -68 * s); ctx.lineTo(lx + L, -51 * s); ctx.lineTo(lx, -57.5 * s); ctx.closePath(); ctx.fill();
        ctx.globalAlpha *= 1.6;
        ctx.beginPath(); ctx.moveTo(lx, -60.5 * s); ctx.lineTo(lx + L * 0.6, -64 * s); ctx.lineTo(lx + L * 0.6, -55 * s); ctx.lineTo(lx, -58.5 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3('#ffe8a0'); ctx.beginPath(); ctx.arc(34.5 * s, -27 * s, 2.2 * s, 0, 7); ctx.fill();   // 전조등 · 미등
      ctx.fillStyle = F3('#d83a3a'); ctx.fillRect(-37 * s, -24 * s, 2.4 * s, 4 * s);
      if (live) x3Glow(S, 35 * s, -27 * s, 2.8 * s, '#ffe8a0', 0.3);
      ctx.restore();
      ctx.fillStyle = F3('#3a3c42');                           // 바퀴집 (몸통이 흔들려도 바퀴는 땅에)
      for (const wx of [-21, 21]) { ctx.beginPath(); ctx.arc(wx * s, -12.5 * s + bob, 9.4 * s, Math.PI, 0); ctx.fill(); }
      x3Wheel(S, -21 * s, -7.6 * s, 7.6 * s, roll, '#26282c', '#c8ccd4');
      x3Wheel(S, 21 * s, -7.6 * s, 7.6 * s, roll, '#26282c', '#c8ccd4');
      break;
    }

    case 'ufo': {                                              // 비행접시 대현자: 떠 있는 접시 · 유리 덮개 속 마법사 · 견인 광선
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time, ga = ctx.globalAlpha;
      const hov = -38 * s + Math.sin(t * 2.2) * 3.5 * s;
      const tilt = S.moving ? 0.07 : Math.sin(t * 1.3) * 0.035;
      const metal = '#aab2c8', metalD = x3Hex('#aab2c8', -0.32);
      if (live) {                                              // 땅에 비치는 빛 · 견인 광선 · 내려가는 고리
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 0.16 + 0.08 * Math.sin(t * 4) + atk * 0.3;
        ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(0, -1 * s, (20 + atk * 12) * s, 4.5 * s, 0, 0, 7); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const bw = (7 + atk * 7) * s;
        ctx.globalAlpha *= 0.1 + atk * 0.32;
        ctx.fillStyle = acc;
        ctx.beginPath(); ctx.moveTo(-bw * 0.7, hov + 8 * s); ctx.lineTo(bw * 0.7, hov + 8 * s); ctx.lineTo(bw * 2.6, 0); ctx.lineTo(-bw * 2.6, 0); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = ga * 0.45 * (0.35 + atk); ctx.strokeStyle = acc; ctx.lineWidth = 1.2 * s;
        for (let i = 0; i < 3; i++) {
          const q = (t * 0.9 + i / 3) % 1, yy = hov + 8 * s + q * (-hov - 8 * s), w = bw * (0.7 + q * 1.9);
          ctx.beginPath(); ctx.ellipse(0, yy, w, w * 0.22, 0, 0, 7); ctx.stroke();
        }
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.save(); ctx.translate(0, hov); ctx.rotate(tilt);
      for (const d of [-1, 0, 1]) {                           // 밑면 분사구 셋 (가운데는 견인 광선 렌즈)
        ctx.fillStyle = F3(x3Hex(metal, -0.45));
        ctx.beginPath(); ctx.ellipse(d * 19 * s, 7.5 * s - Math.abs(d) * 2 * s, (d ? 4.6 : 6) * s, 3.4 * s, 0, 0, Math.PI); ctx.fill();
        if (live) x3Glow(S, d * 19 * s, (9 - Math.abs(d) * 2) * s, (d ? 2.2 : 3) * s, acc, 0.5 + 0.3 * Math.sin(t * 9 + d) + atk * 0.3);
      }
      ctx.fillStyle = F3(metalD);                              // 아래 동체
      ctx.beginPath(); ctx.ellipse(0, 3 * s, 27 * s, 8 * s, 0, 0, Math.PI); ctx.fill();
      if (live) {                                              // 엔진 고리 (숨 쉬듯 밝아진다)
        const pulse = 0.55 + 0.35 * Math.sin(t * 6) + atk * 0.4;
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= pulse;
        ctx.strokeStyle = acc; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.ellipse(0, 7.5 * s, 13 * s, 3 * s, 0, 0, 7); ctx.stroke();
        ctx.globalAlpha *= 0.4; ctx.lineWidth = 6 * s; ctx.stroke();
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3(metal);                               // 원반
      ctx.beginPath(); ctx.ellipse(0, 0, 43 * s, 9.5 * s, 0, 0, 7); ctx.fill();
      if (hq) {
        ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-4 * s, -3.4 * s, 34 * s, 4.2 * s, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(40,46,70,.45)'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.ellipse(0, 1.5 * s, 41 * s, 7.2 * s, 0, 0.15, Math.PI - 0.15); ctx.stroke();
        for (let i = 0; i < 9; i++) {                          // 둘레 불빛: 차례로 돌며 켜진다
          const a = 0.18 + i / 8 * (Math.PI - 0.36), lit = (Math.floor(t * 10) + i) % 3 === 0;
          const lx = Math.cos(a) * 37 * s, ly = Math.sin(a) * 6.4 * s + 1 * s;
          ctx.fillStyle = lit ? ['#ffe86a', '#8affc0', '#ff8ad8'][i % 3] : '#4a5068';
          ctx.beginPath(); ctx.arc(lx, ly, 1.7 * s, 0, 7); ctx.fill();
        }
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3(x3Hex(tun, 0));                       // 윗단
      ctx.beginPath(); ctx.ellipse(0, -5.5 * s, 24 * s, 6 * s, 0, 0, 7); ctx.fill();
      {                                                        // 덮개 속 마법사: 흰 수염 · 접힌 고깔모자 (덮개 안에 들어가게 끝이 뒤로 꺾인다)
        const skin = S.flash ? '#ffffff' : S.col, hat = S.flash ? '#ffffff' : x3Hex(tun, 0.12);
        ctx.fillStyle = S.flash ? '#ffffff' : '#efeade';        // 수염
        ctx.beginPath(); ctx.moveTo(-1 * s, -9 * s); ctx.lineTo(7 * s, -9 * s); ctx.quadraticCurveTo(6 * s, -2 * s, 2 * s, 0); ctx.quadraticCurveTo(0, -4 * s, -1 * s, -9 * s); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(2 * s, -12 * s, 5 * s, 0, 7); ctx.fill();   // 얼굴
        ctx.fillStyle = hat;                                   // 모자
        ctx.beginPath(); ctx.moveTo(-5 * s, -14.5 * s); ctx.lineTo(9 * s, -14.5 * s);
        ctx.quadraticCurveTo(4 * s, -19 * s, 1 * s, -23 * s); ctx.quadraticCurveTo(-5 * s, -26 * s, -9 * s, -22.5 * s);
        ctx.quadraticCurveTo(-4 * s, -21 * s, -2 * s, -19 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) {
          ctx.save(); ctx._skipInk = true;
          ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(-8.6 * s, -22.4 * s, 1.5 * s, 0, 7); ctx.fill();   // 모자 끝 방울
          ctx.fillStyle = shade(tun, -0.3); ctx.fillRect(-5 * s, -15.6 * s, 14 * s, 1.6 * s);               // 모자 띠
          ctx.fillStyle = '#ffe86a';                           // 별
          ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 0.7 : 1.6) * s; ctx.lineTo(2 * s + Math.cos(a) * rr, -18.5 * s + Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.arc(2 * s, -12 * s, 5 * s, Math.PI * 0.6, Math.PI * 1.4); ctx.fill();
          ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.ellipse(4.3 * s, -12.2 * s, 1.3 * s, 1.5 * s, 0, 0, 7); ctx.fill();   // 눈
          ctx.fillStyle = '#16181d'; ctx.beginPath(); ctx.arc(4.7 * s, -12.1 * s, 0.75 * s, 0, 7); ctx.fill();
          ctx.restore(); ctx._skipInk = false;
        }
      }
      ctx.save(); ctx._skipInk = true;                         // 유리 덮개
      ctx.fillStyle = S.flash ? '#ffffff' : 'rgba(170,225,255,.3)';
      ctx.beginPath(); ctx.ellipse(0, -7 * s, 16 * s, 20 * s, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      if (!S.flash) {
        ctx.strokeStyle = 'rgba(225,245,255,.85)'; ctx.lineWidth = 1.3 * s; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.8 * s;
        ctx.beginPath(); ctx.ellipse(0, -7 * s, 12 * s, 16 * s, 0, Math.PI + 0.5, Math.PI + 1.15); ctx.stroke();
      }
      ctx.restore(); ctx._skipInk = false;
      ctx.strokeStyle = F3('#5a6078'); ctx.lineWidth = 1 * s;  // 안테나
      ctx.beginPath(); ctx.moveTo(0, -27 * s); ctx.lineTo(0, -32 * s); ctx.stroke();
      if (!S.flash) { const b = (Math.floor(t * 2.5) % 2) ? '#ff4a6a' : '#ffe86a'; ctx.fillStyle = b; ctx.beginPath(); ctx.arc(0, -33 * s, 1.4 * s, 0, 7); ctx.fill(); if (live) x3Glow(S, 0, -33 * s, 1.6 * s, b, 0.6); }
      ctx.restore();
      break;
    }

    case 'megabot': {                                          // 거대 로봇: 무릎 관절로 걷는 강철 거인 · 가슴의 원자로 · 날아가는 로켓 주먹
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time, ga = ctx.globalAlpha;
      const white = '#eef1f8', whiteD = x3Hex('#eef1f8', -0.2), blue = x3Hex(tun, 0), blueD = x3Hex(tun, -0.35), red = '#d8343a', gold = acc;
      const mv = S.moving;
      const leg = (i) => {                                     // 넓적다리 · 정강이 · 발, 걸음에 맞춰 무릎이 접힌다
        const ph = phase + i * Math.PI, sw = mv ? Math.sin(ph) * 0.42 : 0.04 * (i ? -1 : 1);
        const bend = mv ? Math.max(0, Math.sin(ph + 1.2)) * 0.55 : 0.08;
        const hx = (i ? -6 : 6) * s, hy = -40 * s;
        const kx = hx + Math.sin(sw) * 17 * s, ky = hy + Math.cos(sw) * 17 * s;
        const ax = kx + Math.sin(sw - bend) * 17 * s, ay = Math.min(-3 * s, ky + Math.cos(sw - bend) * 17 * s);
        const dk = i ? -0.18 : 0;
        line(S, hx, hy, kx, ky, 9 * s, F3(x3Hex(white, dk)));
        line(S, kx, ky, ax, ay, 10.5 * s, F3(x3Hex(blue, dk)));
        ctx.fillStyle = F3(x3Hex(white, dk)); ctx.beginPath(); ctx.arc(kx, ky, 5 * s, 0, 7); ctx.fill();     // 무릎 보호대
        ctx.fillStyle = F3(x3Hex(blueD, dk));                  // 발
        ctx.beginPath(); ctx.moveTo(ax - 7 * s, ay - 2 * s); ctx.lineTo(ax + 6 * s, ay - 2 * s); ctx.lineTo(ax + 12 * s, ay + 3 * s); ctx.lineTo(ax - 8 * s, ay + 3 * s); ctx.closePath(); ctx.fill();
      };
      leg(1);
      // 뒤팔 (몸 뒤로 늘어진다)
      line(S, -13 * s, -74 * s, -19 * s, -60 * s, 7.5 * s, F3(whiteD));
      line(S, -19 * s, -60 * s, -18 * s, -47 * s, 8.5 * s, F3(blueD));
      ctx.fillStyle = F3(x3Hex(gold, -0.2)); ctx.beginPath(); roundRectPath(ctx, -23 * s, -50 * s, 10 * s, 9 * s, 2.5 * s); ctx.fill();
      // 등 분사구 · 불꽃 (걷거나 칠 때)
      ctx.fillStyle = F3('#4a4e5a'); ctx.fillRect(-21 * s, -80 * s, 6 * s, 10 * s); ctx.fillRect(-21 * s, -66 * s, 6 * s, 8 * s);
      if (live && (mv || atk > 0)) {
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        for (const [y, h] of [[-70, 10], [-58, 7]]) {
          const fl = h * (0.7 + 0.3 * Math.sin(t * 40 + y)) * (atk > 0 ? 1.5 : 1);
          ctx.globalAlpha = ga * 0.8; ctx.fillStyle = '#ffb03c';
          ctx.beginPath(); ctx.moveTo(-21 * s, y * s); ctx.lineTo(-15 * s, y * s); ctx.lineTo((-18 - fl * 0.4) * s, (y + fl) * s); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = ga * 0.9; ctx.fillStyle = '#fff3c0';
          ctx.beginPath(); ctx.moveTo(-20 * s, y * s); ctx.lineTo(-16 * s, y * s); ctx.lineTo((-18 - fl * 0.2) * s, (y + fl * 0.55) * s); ctx.closePath(); ctx.fill();
        }
        ctx.restore(); ctx._skipInk = false;
      }
      // 허리 · 몸통 · 가슴판 · 원자로
      ctx.fillStyle = F3(red); ctx.beginPath(); roundRectPath(ctx, -12 * s, -48 * s, 24 * s, 10 * s, 3 * s); ctx.fill();
      ctx.fillStyle = F3(gold); ctx.fillRect(-4 * s, -47 * s, 8 * s, 8 * s);
      ctx.fillStyle = F3(blue);
      ctx.beginPath(); ctx.moveTo(-18 * s, -82 * s); ctx.lineTo(18 * s, -82 * s); ctx.lineTo(15 * s, -50 * s); ctx.lineTo(-15 * s, -50 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(white);
      ctx.beginPath(); ctx.moveTo(-16 * s, -80 * s); ctx.lineTo(-2 * s, -80 * s); ctx.lineTo(-3 * s, -66 * s); ctx.lineTo(-14 * s, -62 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(16 * s, -80 * s); ctx.lineTo(2 * s, -80 * s); ctx.lineTo(3 * s, -66 * s); ctx.lineTo(14 * s, -62 * s); ctx.closePath(); ctx.fill();
      if (hq) {
        ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = shade(blue, -0.25);                    // 배 마디
        for (let i = 0; i < 3; i++) ctx.fillRect(-8 * s, (-59 + i * 3.4) * s, 16 * s, 1.6 * s);
        ctx.strokeStyle = 'rgba(30,40,70,.35)'; ctx.lineWidth = 0.8 * s;   // 판 이음새 · 리벳
        ctx.beginPath(); ctx.moveTo(-14 * s, -71 * s); ctx.lineTo(-4 * s, -71 * s); ctx.moveTo(14 * s, -71 * s); ctx.lineTo(4 * s, -71 * s); ctx.stroke();
        ctx.fillStyle = 'rgba(30,40,70,.4)';
        for (const [x, y] of [[-13, -78], [13, -78], [-12, -64], [12, -64]]) { ctx.beginPath(); ctx.arc(x * s, y * s, 0.8 * s, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-16 * s, -80.5 * s, 14 * s, 1.2 * s);
        ctx.restore(); ctx._skipInk = false;
      }
      const core = 0.6 + 0.4 * Math.sin(t * 5);
      ctx.fillStyle = F3('#2a3040'); ctx.beginPath(); ctx.arc(0, -68 * s, 5.4 * s, 0, 7); ctx.fill();
      ctx.fillStyle = F3('#7ff0ff'); ctx.beginPath(); ctx.arc(0, -68 * s, 3.4 * s, 0, 7); ctx.fill();
      if (live) x3Glow(S, 0, -68 * s, 4 * s, '#7ff0ff', 0.45 * core + atk * 0.4);
      leg(0);
      // 머리: 투구 · V자 뿔 · 빛나는 눈 · 입 가리개
      ctx.fillStyle = F3(gold);                                // V자 뿔 (넓은 날 두 개)
      ctx.beginPath(); ctx.moveTo(-0.5 * s, -95 * s); ctx.lineTo(-16 * s, -111 * s); ctx.lineTo(-13.5 * s, -105 * s); ctx.lineTo(-6.5 * s, -96.5 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0.5 * s, -95 * s); ctx.lineTo(16 * s, -111 * s); ctx.lineTo(13.5 * s, -105 * s); ctx.lineTo(6.5 * s, -96.5 * s); ctx.closePath(); ctx.fill();
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.beginPath(); ctx.moveTo(-2 * s, -96 * s); ctx.lineTo(-15 * s, -110 * s); ctx.lineTo(-12 * s, -104.5 * s); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(2 * s, -96 * s); ctx.lineTo(15 * s, -110 * s); ctx.lineTo(12 * s, -104.5 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = F3(white);
      ctx.beginPath(); ctx.moveTo(-8 * s, -82 * s); ctx.lineTo(-8 * s, -94 * s); ctx.lineTo(-4 * s, -98 * s); ctx.lineTo(4 * s, -98 * s); ctx.lineTo(8 * s, -94 * s); ctx.lineTo(8 * s, -82 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(blueD); ctx.beginPath(); roundRectPath(ctx, -5.5 * s, -88 * s, 11 * s, 6 * s, 1.5 * s); ctx.fill();
      ctx.fillStyle = F3(red); ctx.beginPath(); ctx.arc(-8.5 * s, -89 * s, 2.6 * s, 0, 7); ctx.arc(8.5 * s, -89 * s, 2.6 * s, 0, 7); ctx.fill();
      ctx.fillStyle = F3(red);                                 // 이마 보석
      ctx.beginPath(); ctx.moveTo(0, -100.5 * s); ctx.lineTo(3 * s, -97 * s); ctx.lineTo(0, -94.5 * s); ctx.lineTo(-3 * s, -97 * s); ctx.closePath(); ctx.fill();
      if (live) x3Glow(S, 0, -97.4 * s, 1.6 * s, '#ff6a6a', 0.35);
      ctx.fillStyle = F3('#ffe86a'); ctx.fillRect(-5.5 * s, -94 * s, 11 * s, 3 * s);
      if (live) {
        x3Glow(S, 2 * s, -92.5 * s, 4 * s, '#ffe86a', 0.4 + atk * 0.4);
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(255,255,255,.9)';     // 훑는 눈빛
        ctx.fillRect((-5 + ((t * 0.8) % 1) * 9) * s, -94 * s, 2 * s, 3 * s); ctx.restore(); ctx._skipInk = false;
      }
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = 'rgba(30,40,70,.5)'; ctx.lineWidth = 0.8 * s;
        ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(i * 2.6 * s, -87 * s); ctx.lineTo(i * 2.6 * s, -83 * s); } ctx.stroke(); ctx.restore(); ctx._skipInk = false; }
      // 어깨 보호대 (앞)
      ctx.fillStyle = F3(white);
      ctx.beginPath(); roundRectPath(ctx, 8 * s, -86 * s, 17 * s, 13 * s, 5 * s); ctx.fill();
      ctx.fillStyle = F3(red); ctx.fillRect(9 * s, -79.5 * s, 15 * s, 2.6 * s);
      // 앞팔: 칠 때 팔뚝째 불꽃을 뿜으며 날아간다 (로켓 주먹)
      const ext = atk * 30 * s;
      if (S.cheer && atk <= 0) {                               // 이기면 로켓 주먹을 번쩍 든다
        line(S, 16 * s, -75 * s, 26 * s, -88 * s, 7.5 * s, F3(white));
        ctx.fillStyle = F3('#4a4e5a'); ctx.beginPath(); ctx.arc(26 * s, -88 * s, 4 * s, 0, 7); ctx.fill();
        line(S, 26 * s, -88 * s, 27 * s, -100 * s, 8.5 * s, F3(blue));
        ctx.fillStyle = F3(gold); ctx.beginPath(); roundRectPath(ctx, 21 * s, -112 * s, 12 * s, 12 * s, 3 * s); ctx.fill();
        break;
      }
      line(S, 16 * s, -75 * s, 23 * s, -62 * s, 7.5 * s, F3(white));
      ctx.fillStyle = F3('#4a4e5a'); ctx.beginPath(); ctx.arc(23 * s, -62 * s, 4 * s, 0, 7); ctx.fill();   // 팔꿈치
      if (live && atk > 0.05) {                                // 주먹 뒤 불꽃
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        const fl = (8 + ext / s * 0.6) * s;
        ctx.globalAlpha = ga * 0.85; ctx.fillStyle = '#ffb03c';
        ctx.beginPath(); ctx.moveTo(24 * s + ext, -63.5 * s); ctx.lineTo(24 * s + ext - fl, -59 * s); ctx.lineTo(24 * s + ext, -54.5 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.moveTo(24 * s + ext, -61.5 * s); ctx.lineTo(24 * s + ext - fl * 0.55, -59 * s); ctx.lineTo(24 * s + ext, -56.5 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      line(S, 23 * s + ext, -59 * s, 33 * s + ext, -59 * s, 8.5 * s, F3(blue));        // 팔뚝
      ctx.fillStyle = F3(gold); ctx.beginPath(); roundRectPath(ctx, 32 * s + ext, -65 * s, 12 * s, 12 * s, 3 * s); ctx.fill();   // 주먹
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = 'rgba(90,60,0,.55)'; ctx.lineWidth = 0.9 * s;
        ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(41 * s + ext, (-62.5 + i * 3.2) * s); ctx.lineTo(44 * s + ext, (-62.5 + i * 3.2) * s); } ctx.stroke(); ctx.restore(); ctx._skipInk = false; }
      if (live && S.moving) x3Puff(S, -16 * s, -86 * s - ((t * 0.7) % 1) * 10 * s, 2.2 * s, 0.25 * (1 - (t * 0.7) % 1), '#e8eef4');   // 어깨 증기
      break;
    }

    case 'dronepilot': {                                       // 드론 조종사: 조종기 · 홀로그램 화면 · 머리 위 드론 편대
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time, ga = ctx.globalAlpha;
      legs(S); torso(S, 5 * s);
      ctx.fillStyle = F3(x3Hex(tun, -0.15));                   // 전술 조끼 · 주머니
      ctx.beginPath(); roundRectPath(ctx, -6.5 * s, -40 * s, 13 * s, 15 * s, 2.5 * s); ctx.fill();
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = shade(tun, -0.35);
        ctx.fillRect(-5 * s, -32 * s, 4 * s, 4.5 * s); ctx.fillRect(1 * s, -32 * s, 4 * s, 4.5 * s);
        ctx.fillStyle = acc; ctx.fillRect(-6.5 * s, -38 * s, 13 * s, 1.2 * s); ctx.restore(); ctx._skipInk = false; }
      head(S, 'goggles');
      ctx.fillStyle = F3('#2a2e36');                           // 헤드셋 · 마이크
      ctx.beginPath(); ctx.arc(0, -50 * s, 9.6 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 1.8 * s; ctx.strokeStyle = F3('#2a2e36'); ctx.stroke();
      ctx.fillRect(-10 * s, -52 * s, 3.4 * s, 6 * s);
      ctx.strokeStyle = F3('#2a2e36'); ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(-7 * s, -47 * s); ctx.quadraticCurveTo(-2 * s, -42 * s, 4 * s, -44 * s); ctx.stroke();
      if (live) x3Glow(S, 5 * s, -53 * s, 3 * s, acc, 0.35);   // 고글 화면 빛
      // 두 손으로 쥔 조종기 (안테나 끝이 깜빡인다)
      arm(S, 12 * s, -35 * s); arm(S, 9 * s, -33 * s);
      ctx.fillStyle = F3('#2a2e36'); ctx.beginPath(); roundRectPath(ctx, 7 * s, -38.5 * s, 13 * s, 6.5 * s, 2 * s); ctx.fill();
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#6a7080';
        ctx.beginPath(); ctx.arc(10.5 * s, -36 * s, 1.3 * s, 0, 7); ctx.arc(16.5 * s, -36 * s, 1.3 * s, 0, 7); ctx.fill();
        ctx.fillStyle = acc; ctx.fillRect(12.4 * s, -34.4 * s, 2.4 * s, 1 * s); ctx.restore(); ctx._skipInk = false; }
      ctx.strokeStyle = F3('#8a90a0'); ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.moveTo(18 * s, -38 * s); ctx.lineTo(20 * s, -47 * s); ctx.stroke();
      if (!S.flash) { const b = Math.floor(t * 3) % 2 ? '#ff4a4a' : '#ffe86a'; ctx.fillStyle = b; ctx.beginPath(); ctx.arc(20 * s, -47.5 * s, 1 * s, 0, 7); ctx.fill(); }
      if (live) {                                              // 홀로그램 화면 (격자 · 표적 점)
        const fl = 0.75 + 0.25 * Math.sin(t * 17);
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.32 * fl;
        ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(20 * s, -60 * s); ctx.lineTo(36 * s, -64 * s); ctx.lineTo(36 * s, -49 * s); ctx.lineTo(20 * s, -51 * s); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = ga * 0.6 * fl; ctx.strokeStyle = acc; ctx.lineWidth = 0.7 * s; ctx.stroke();
        ctx.beginPath(); for (let i = 1; i < 3; i++) { ctx.moveTo((20 + i * 5.3) * s, (-60 - i * 1.3) * s); ctx.lineTo((20 + i * 5.3) * s, (-51 + i * 0.6) * s); } ctx.stroke();
        ctx.fillStyle = '#ff6a6a'; ctx.beginPath(); ctx.arc((25 + Math.sin(t * 2) * 5) * s, (-56 + Math.cos(t * 2.6) * 2.5) * s, 1.2 * s, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      // 드론 편대: 머리 위를 맴돌고, 칠 때 맨 앞 하나가 앞으로 내리꽂힌다
      for (let i = 0; i < 3; i++) {
        const a = t * 1.1 + i * 2.094, lead = i === 0 ? atk : 0;
        const dx = (-2 + Math.cos(a) * 16) * s + lead * 34 * s, dy = (-84 + Math.sin(a * 1.7) * 3 + i * 4) * s + lead * 20 * s;
        const tilt = (S.moving ? 0.16 : 0.05) + lead * 0.6 + Math.sin(a) * 0.04;
        x3Drone(S, dx, dy, i === 0 ? 1 : 0.85, tilt, t + i, acc);
        if (live && MODEL.angry && hq) {                       // 겨누는 붉은 조준선
          ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.35; ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = 0.7 * s;
          ctx.setLineDash([2.5 * s, 2.5 * s]); ctx.beginPath(); ctx.moveTo(dx + 2 * s, dy + 4 * s); ctx.lineTo(dx + 34 * s, dy + 40 * s); ctx.stroke();
          ctx.setLineDash([]); ctx.restore(); ctx._skipInk = false;
        }
      }
      break;
    }

    case 'drillspear': {                                       // 드릴 창병: 안전모 전등 · 형광 띠 작업복 · 모터 달린 드릴 창
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const spin = t * (atk > 0 ? 22 : MODEL.angry ? 10 : 3);
      legs(S); torso(S, 5 * s);
      if (hq) { ctx.save(); ctx._skipInk = true;               // 멜빵 · 형광 띠
        ctx.fillStyle = shade(tun, -0.3); ctx.fillRect(-4.5 * s, -41 * s, 2 * s, 20 * s); ctx.fillRect(2.5 * s, -41 * s, 2 * s, 20 * s);
        ctx.fillStyle = '#e8ff5a'; ctx.fillRect(-5.6 * s, -29 * s, 11.2 * s, 1.8 * s); ctx.restore(); ctx._skipInk = false; }
      head(S, 'goggles');
      ctx.fillStyle = F3(acc);                                 // 안전모 · 챙 · 전등
      ctx.beginPath(); ctx.arc(0, -53 * s, 9.6 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-11 * s, -54 * s, 23 * s, 2.6 * s);
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(-2 * s, -56 * s, 5 * s, Math.PI * 1.1, Math.PI * 1.6); ctx.lineTo(-2 * s, -56 * s); ctx.fill();
        ctx.fillStyle = shade(acc, -0.3); ctx.fillRect(-1 * s, -62.5 * s, 2 * s, 9 * s); ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = F3('#3a3c42'); ctx.fillRect(6 * s, -59 * s, 4 * s, 4 * s);
      ctx.fillStyle = F3('#fff6c8'); ctx.beginPath(); ctx.arc(10 * s, -57 * s, 1.8 * s, 0, 7); ctx.fill();
      if (live) {                                              // 전등 빛줄기
        x3Glow(S, 10 * s, -57 * s, 2.2 * s, '#fff2b0', 0.5);
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= MODEL.angry ? 0.2 : 0.11; ctx.fillStyle = '#fff2b0';
        ctx.beginPath(); ctx.moveTo(10 * s, -57 * s); ctx.lineTo(44 * s, -66 * s); ctx.lineTo(44 * s, -44 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      armWeapon(S, -0.15, () => {
        line(S, -7 * s, 0, 16 * s, 0, 3.4 * s, F3('#4a4e56'));                       // 자루
        ctx.fillStyle = F3('#ffd23a');                         // 모터 상자 (노랑 · 검정 경고 줄)
        ctx.beginPath(); roundRectPath(ctx, 13 * s, -6.5 * s, 15 * s, 13 * s, 2.5 * s); ctx.fill();
        if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#26262a';
          for (let i = 0; i < 4; i++) { const x0 = (13.5 + i * 4) * s; ctx.beginPath(); ctx.moveTo(x0, 6 * s); ctx.lineTo(x0 + 2 * s, 6 * s); ctx.lineTo(x0 + 4.4 * s, 2 * s); ctx.lineTo(x0 + 2.4 * s, 2 * s); ctx.closePath(); ctx.fill(); }
          ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(14 * s, -5.6 * s, 13 * s, 1.2 * s); ctx.restore(); ctx._skipInk = false; }
        ctx.fillStyle = F3('#3a3c42'); ctx.fillRect(18 * s, -11 * s, 3 * s, 5 * s);   // 배기관
        if (live) for (let i = 0; i < 2; i++) { const q = (t * 1.6 + i / 2) % 1; x3Puff(S, (19 - q * 6) * s, (-12 - q * 12) * s, (1.4 + q * 3) * s, (1 - q) * (atk > 0 ? 0.55 : 0.25), '#d8d4cc'); }
        ctx.fillStyle = F3('#c8ced6');                         // 드릴 날
        ctx.beginPath(); ctx.moveTo(28 * s, -7.5 * s); ctx.lineTo(62 * s, 0); ctx.lineTo(28 * s, 7.5 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) {                                        // 나선 홈 (돌아간다)
          ctx.save(); ctx._skipInk = true;
          ctx.beginPath(); ctx.moveTo(28 * s, -7.5 * s); ctx.lineTo(62 * s, 0); ctx.lineTo(28 * s, 7.5 * s); ctx.closePath(); ctx.clip();
          ctx.strokeStyle = '#6a7078'; ctx.lineWidth = 1.5 * s;
          const off = (spin % 1) * 6;
          ctx.beginPath();
          for (let x = 22 + off; x < 64; x += 6) { ctx.moveTo(x * s, -8 * s); ctx.lineTo((x + 5) * s, 8 * s); }
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(28 * s, -7.5 * s); ctx.lineTo(62 * s, 0); ctx.lineTo(28 * s, -3.5 * s); ctx.closePath(); ctx.fill();
          ctx.restore(); ctx._skipInk = false;
        }
        if (live && atk > 0.2) {                               // 드릴 끝 불꽃
          ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 1.1 * s;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) { const a = -0.9 + ((i * 0.37 + t * 7) % 1.8), r1 = (3 + (i % 3) * 3) * s;
            ctx.moveTo(62 * s, 0); ctx.lineTo(62 * s + Math.cos(a) * r1 * 2, Math.sin(a) * r1 * 2); }
          ctx.stroke(); ctx.restore(); ctx._skipInk = false;
          x3Glow(S, 62 * s, 0, 3 * s, '#ffd35a', 0.5 * atk);
        }
      }, 8 * s);
      break;
    }

    /* ---------------------- 4.6 5막 '잊힌 밀림' ---------------------- */
    case 'lizardman': {                                        // 도마뱀 전사: 꼬리 · 비늘 · 둥근 가죽 방패 · 흑요석 곤봉
      const t = MODEL.time, sw = S.moving ? Math.sin(phase) * 0.35 : Math.sin(t * 2) * 0.08;
      ctx.save(); ctx.translate(-6 * s, -24 * s); ctx.rotate(0.5 + sw);       // 꼬리
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -4 * s); ctx.quadraticCurveTo(-18 * s, 2 * s, -26 * s, 14 * s); ctx.lineTo(-22 * s, 15 * s); ctx.quadraticCurveTo(-14 * s, 6 * s, 2 * s, 5 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
      legs(S); torso(S, 5 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = shade(col, 0.3);           // 배 비늘
        for (let i = 0; i < 4; i++) ctx.fillRect(-2.5 * s, (-42 + i * 5) * s, 6 * s, 2 * s); ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = col;                                      // 머리: 길쭉한 주둥이
      ctx.beginPath(); ctx.ellipse(1 * s, -51 * s, 8 * s, 7 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(5 * s, -55 * s); ctx.quadraticCurveTo(18 * s, -54 * s, 19 * s, -48 * s); ctx.lineTo(5 * s, -45 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = acc; tri(S, -6 * s, -56 * s, -1 * s, -66 * s, 3 * s, -57 * s, acc); tri(S, -9 * s, -52 * s, -7 * s, -61 * s, -3 * s, -54 * s, acc);   // 볏
      if (!S.flash) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = '#ffe85a'; ctx.beginPath(); ctx.arc(5 * s, -53 * s, 1.9 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(4.6 * s, -54.6 * s, 0.9 * s, 3.2 * s);
        ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(9 * s, -48.5 * s); ctx.lineTo(18 * s, -48.5 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false; }
      round_shield(S, -12 * s, -36 * s, 9 * s, S.flash ? '#fff' : tun);
      if (!S.flash) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(-12 * s, -36 * s, 3 * s, 0, 7); ctx.fill(); }
      armWeapon(S, -1.1 + atk * 2, () => {
        line(S, 0, 0, 26 * s, 0, 3.4 * s, F3('#6a4a2a'));
        ctx.fillStyle = F3('#1e1a24'); for (let i = 0; i < 4; i++) tri(S, (12 + i * 4) * s, -1.5 * s, (14 + i * 4) * s, -5.5 * s, (16 + i * 4) * s, -1.5 * s, F3('#1e1a24'));
        for (let i = 0; i < 4; i++) tri(S, (12 + i * 4) * s, 1.5 * s, (14 + i * 4) * s, 5.5 * s, (16 + i * 4) * s, 1.5 * s, F3('#1e1a24'));
      }, 6 * s);
      break;
    }
    case 'raptor': case 'raptorqueen': {                       // 랩터 (여왕은 크고, 붉은 깃 갈기 · 금 목걸이)
      const queen = st.shape === 'raptorqueen', t = MODEL.time;
      const gait = S.moving ? phase * 2.2 : 0, run = S.moving ? 1 : 0.2;
      const bodyY = -30 * s + (S.moving ? Math.abs(Math.sin(gait)) * -2 * s : 0);
      for (const [d, hind] of [[1, 1], [-1, 0]]) {             // 두 다리: 굽은 무릎 · 낫 발톱
        const a = Math.sin(gait + (d > 0 ? 0 : Math.PI)) * 0.7 * run;
        const hx = -2 * s, kx = hx + Math.sin(a) * 9 * s + 6 * s, ky = bodyY + 14 * s, fx = kx - 7 * s + Math.sin(a) * 6 * s;
        ctx.strokeStyle = hind ? shade(col, -0.25) : col; ctx.lineWidth = 5 * s;
        ctx.beginPath(); ctx.moveTo(hx, bodyY + 4 * s); ctx.lineTo(kx, ky); ctx.lineTo(fx, -2 * s); ctx.stroke();
        ctx.fillStyle = F3('#e8e0c8'); tri(S, fx + 1 * s, -3 * s, fx + 7 * s, -1 * s, fx + 1 * s, 0, F3('#e8e0c8'));
      }
      ctx.fillStyle = col;                                      // 몸통 · 꼬리 (곧게 뻗어 균형)
      ctx.beginPath(); ctx.moveTo(-40 * s, bodyY - 2 * s); ctx.quadraticCurveTo(-20 * s, bodyY - 10 * s, 0, bodyY - 9 * s);
      ctx.quadraticCurveTo(12 * s, bodyY - 8 * s, 14 * s, bodyY); ctx.quadraticCurveTo(8 * s, bodyY + 9 * s, -4 * s, bodyY + 8 * s);
      ctx.quadraticCurveTo(-20 * s, bodyY + 5 * s, -40 * s, bodyY - 2 * s); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = shade(col, -0.3);   // 줄무늬
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse((-20 + i * 7) * s, bodyY - 6 * s, 1.6 * s, 4 * s, 0.4, 0, 7); ctx.fill(); }
        ctx.fillStyle = shade(col, 0.35); ctx.beginPath(); ctx.ellipse(2 * s, bodyY + 5 * s, 9 * s, 2.5 * s, 0, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false; }
      const lunge = atk * 8 * s, hx = 16 * s + lunge, hy = bodyY - 12 * s - lunge * 0.3;
      line(S, 8 * s, bodyY - 4 * s, hx, hy, 6 * s, col);       // 목
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(hx + 4 * s, hy - 1 * s, 8 * s, 5 * s, 0.1, 0, 7); ctx.fill();   // 머리
      const jaw = atk > 0.2 ? atk * 0.6 : (MODEL.angry ? 0.15 : 0.05);
      ctx.save(); ctx.translate(hx + 3 * s, hy + 1 * s); ctx.rotate(jaw);        // 아래턱
      ctx.fillStyle = shade(col, -0.15); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12 * s, 1 * s); ctx.lineTo(10 * s, 3.5 * s); ctx.lineTo(0, 3 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (!S.flash) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) tri(S, hx + (4 + i * 2.4) * s, hy + 1.6 * s, hx + (5.2 + i * 2.4) * s, hy + 3.6 * s, hx + (6.4 + i * 2.4) * s, hy + 1.6 * s, '#ffffff');
        ctx.fillStyle = queen ? '#ffe85a' : '#ff6a3a'; ctx.beginPath(); ctx.arc(hx + 5 * s, hy - 2.5 * s, 1.4 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(hx + 5.4 * s, hy - 2.5 * s, 0.6 * s, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false; }
      line(S, 6 * s, bodyY + 2 * s, 12 * s, bodyY + 7 * s, 2 * s, col);   // 작은 앞발
      ctx.fillStyle = acc;                                      // 깃털 볏 (여왕은 갈기까지)
      for (let i = 0; i < (queen ? 7 : 3); i++) {
        const bx = hx - 3 * s - i * 4 * s, by = hy - 3 * s + i * 1.5 * s, wav = Math.sin(t * 6 + i) * 1.5 * s;
        tri(S, bx, by, bx - 6 * s + wav, by - (queen ? 9 : 6) * s, bx + 2 * s, by - 1 * s, acc);
      }
      if (queen && !S.flash) {
        ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(10 * s, bodyY - 6 * s, 2.4 * s, 0, 7); ctx.arc(13 * s, bodyY - 9 * s, 2 * s, 0, 7); ctx.fill();
        ctx.save(); ctx._skipInk = true; ctx.strokeStyle = 'rgba(40,10,0,.5)'; ctx.lineWidth = 1 * s;     // 흉터
        ctx.beginPath(); ctx.moveTo(-14 * s, bodyY - 7 * s); ctx.lineTo(-8 * s, bodyY + 1 * s); ctx.moveTo(-11 * s, bodyY - 8 * s); ctx.lineTo(-5 * s, bodyY); ctx.stroke();
        ctx.restore(); ctx._skipInk = false;
      }
      break;
    }
    case 'poisontoad': {                                       // 독두꺼비: 납작한 몸 · 보랏빛 독 사마귀 · 부푸는 목주머니
      const t = MODEL.time, puff = 1 + Math.max(atk, S.wind) * 0.5 + Math.sin(t * 3) * 0.05;
      const hop = S.moving ? Math.abs(Math.sin(phase * 1.5)) * 5 * s : 0;
      ctx.save(); ctx.translate(0, -hop);
      ctx.fillStyle = shade(col, -0.2) ; ctx.beginPath(); ctx.ellipse(-12 * s, -6 * s, 10 * s, 6 * s, -0.3, 0, 7); ctx.fill();   // 뒷다리
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -16 * s, 22 * s, 14 * s, 0, 0, 7); ctx.fill();              // 몸
      ctx.fillStyle = F3(x3Hex(st.body, 0.45)); ctx.beginPath(); ctx.ellipse(10 * s, -8 * s * puff, 9 * s * puff, 6.5 * s * puff, 0, 0, 7); ctx.fill();   // 목주머니
      line(S, 12 * s, -8 * s, 16 * s, 0, 3.4 * s, col);           // 앞다리
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(8 * s, -28 * s, 6 * s, 0, 7); ctx.arc(-2 * s, -29 * s, 5.4 * s, 0, 7); ctx.fill();   // 눈두덩
      if (!S.flash) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(9 * s, -29 * s, 3.4 * s, 0, 7); ctx.arc(-1 * s, -30 * s, 2.8 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#141414'; ctx.fillRect(7.4 * s, -29.8 * s, 3.4 * s, 1.4 * s); ctx.fillRect(-2.2 * s, -30.6 * s, 2.6 * s, 1.2 * s);
        ctx.fillStyle = acc; for (const [x, y, r] of [[-12, -22, 3], [-4, -24, 2.4], [-16, -14, 2.2], [2, -20, 2]]) { ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-4 * s, -24 * s, 10 * s, 3.5 * s, -0.2, 0, 7); ctx.fill();
        ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(4 * s, -14 * s); ctx.quadraticCurveTo(14 * s, -12 * s, 20 * s, -16 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false;
        if (S.live && (atk > 0 || S.wind > 0)) x3Glow(S, 21 * s, -16 * s, 3 * s, acc, 0.5);
      }
      ctx.restore();
      break;
    }
    case 'vineshaman': {                                       // 덩굴 주술사: 잎사귀 망토 · 나무 가면 · 씨앗이 빛나는 덩굴 지팡이
      const t = MODEL.time;
      robe(S, 18 * s, -44 * s, tun);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc;                 // 망토에 붙은 잎
        for (let i = 0; i < 6; i++) { const x = (-12 + i * 5) * s, y = (-30 + (i % 2) * 8) * s; ctx.beginPath(); ctx.ellipse(x, y, 2.4 * s, 4.2 * s, 0.6, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      head(S, 'bald', 8 * s);
      ctx.fillStyle = F3('#8a6a3a');                            // 나무 가면
      ctx.beginPath(); ctx.moveTo(-1 * s, -60 * s); ctx.lineTo(10 * s, -58 * s); ctx.lineTo(11 * s, -46 * s); ctx.lineTo(3 * s, -42 * s); ctx.lineTo(-1 * s, -48 * s); ctx.closePath(); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; ctx.fillRect(4 * s, -54 * s, 5 * s, 1.8 * s); ctx.fillRect(4 * s, -49 * s, 4 * s, 1.2 * s);
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(2 * s, -58.5 * s, 8 * s, 1.2 * s); ctx.restore(); ctx._skipInk = false;
        x3Glow(S, 6.5 * s, -53 * s, 1.6 * s, acc, 0.5); }
      for (let i = 0; i < 3; i++) tri(S, (-8 + i * 6) * s, -60 * s, (-6 + i * 6) * s, (-72 - (i % 2) * 4) * s, (-3 + i * 6) * s, -60 * s, acc);   // 잎 머리장식
      armWeapon(S, -1.4 + atk * 0.9, () => {
        ctx.strokeStyle = F3('#5a3a1a'); ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(-6 * s, 0); ctx.quadraticCurveTo(12 * s, -4 * s, 30 * s, 2 * s); ctx.stroke();
        if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 1.2 * s; ctx.beginPath();
          for (let i = 0; i <= 10; i++) { const u = i / 10; ctx.lineTo((-4 + u * 34) * s, Math.sin(u * 12 + t * 3) * 2.6 * s); } ctx.stroke(); ctx.restore(); ctx._skipInk = false; }
        orb(S, 32 * s, 2 * s, 3.6 * s, S.flash ? '#fff' : acc);
        if (S.live && !S.flash) x3Glow(S, 32 * s, 2 * s, 4 * s, acc, 0.4 + atk * 0.4);
      }, 8 * s);
      if (S.live && !S.flash) {                                 // 떠도는 꽃가루
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc;
        for (let i = 0; i < 4; i++) { const q = (t * 0.6 + i / 4) % 1; ctx.globalAlpha *= 1; ctx.beginPath(); ctx.arc((Math.sin(t + i * 2) * 14) * s, (-20 - q * 50) * s, 1.2 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false;
      }
      break;
    }
    case 'stoneidol': {                                        // 석상 수호자: 기둥 다리 · 큰 얼굴이 새겨진 돌 몸 · 빛나는 룬 · 이끼
      const t = MODEL.time, stomp = S.moving ? Math.abs(Math.sin(phase)) * 2 * s : 0, stone = col, dark = F3(x3Hex(st.body, -0.25));
      for (const d of [-1, 1]) { ctx.fillStyle = d < 0 ? dark : stone; ctx.fillRect((d * 8 - 5) * s, -22 * s - (d > 0 ? stomp : 0), 10 * s, 22 * s); }
      ctx.fillStyle = stone; ctx.beginPath(); roundRectPath(ctx, -17 * s, -64 * s, 34 * s, 44 * s, 4 * s); ctx.fill();     // 몸통
      ctx.fillStyle = dark; ctx.fillRect(-19 * s, -68 * s, 38 * s, 7 * s);                                             // 머리 장식
      for (const x of [-15, -5, 5]) tri(S, x * s, -68 * s, (x + 5) * s, -78 * s, (x + 10) * s, -68 * s, stone);
      if (!S.flash) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = shade(st.body, -0.4);                  // 새긴 얼굴: 눈썹 · 코 · 입
        ctx.fillRect(-11 * s, -56 * s, 9 * s, 2.4 * s); ctx.fillRect(2 * s, -56 * s, 9 * s, 2.4 * s);
        ctx.fillRect(-2 * s, -52 * s, 4 * s, 9 * s); ctx.fillRect(-8 * s, -38 * s, 16 * s, 3 * s);
        const g = 0.6 + 0.4 * Math.sin(t * 3) + (MODEL.angry ? 0.3 : 0);
        ctx.fillStyle = acc; ctx.globalAlpha *= Math.min(1, g); ctx.fillRect(-9 * s, -52 * s, 6 * s, 3 * s); ctx.fillRect(3 * s, -52 * s, 6 * s, 3 * s);
        ctx.globalAlpha = 1; ctx.strokeStyle = acc; ctx.lineWidth = 1 * s; ctx.globalAlpha = 0.6;        // 룬
        ctx.beginPath(); ctx.moveTo(-13 * s, -30 * s); ctx.lineTo(-9 * s, -26 * s); ctx.lineTo(-13 * s, -22 * s); ctx.moveTo(13 * s, -30 * s); ctx.lineTo(9 * s, -26 * s); ctx.lineTo(13 * s, -22 * s); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = '#5a7a3a'; ctx.beginPath(); ctx.ellipse(-12 * s, -62 * s, 6 * s, 2.4 * s, 0, 0, 7); ctx.ellipse(13 * s, -24 * s, 4 * s, 2 * s, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(-15 * s, -63 * s, 4 * s, 40 * s);
        ctx.restore(); ctx._skipInk = false;
        if (S.live) { x3Glow(S, -6 * s, -50.5 * s, 2 * s, acc, 0.35); x3Glow(S, 6 * s, -50.5 * s, 2 * s, acc, 0.35); }
      }
      const arm2 = -0.3 + atk * 1.2;                            // 돌 팔 (내려친다)
      ctx.save(); ctx.translate(17 * s, -56 * s); ctx.rotate(arm2);
      ctx.fillStyle = stone; ctx.fillRect(-4 * s, -2 * s, 9 * s, 26 * s); ctx.fillStyle = dark; ctx.fillRect(-5 * s, 22 * s, 11 * s, 9 * s);
      ctx.restore();
      break;
    }
    case 'triceratops': {                                      // 뿔 공룡: 넓은 목도리 · 세 뿔 · 부리 · 굵은 네 다리
      const sw = S.moving ? Math.sin(phase * 1.4) * 6 * s : 1 * s, ch = atk * 6 * s;
      beastLegs(S, [[-18, sw, 1], [-10, -sw, 0], [10, -sw, 1], [18, sw, 0]], -16 * s, 7 * s, col);
      ctx.fillStyle = col;                                      // 몸 · 꼬리
      ctx.beginPath(); ctx.moveTo(-40 * s, -20 * s); ctx.quadraticCurveTo(-28 * s, -42 * s, 2 * s, -42 * s); ctx.quadraticCurveTo(22 * s, -40 * s, 26 * s, -26 * s);
      ctx.quadraticCurveTo(20 * s, -12 * s, 0, -12 * s); ctx.quadraticCurveTo(-24 * s, -12 * s, -40 * s, -20 * s); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = shade(col, 0.25); ctx.beginPath(); ctx.ellipse(0, -16 * s, 20 * s, 4 * s, 0, 0, 7); ctx.fill();
        ctx.fillStyle = shade(col, -0.25); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse((-22 + i * 9) * s, -36 * s, 3 * s, 2 * s, 0, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      ctx.save(); ctx.translate(ch, ch * 0.3);
      ctx.fillStyle = acc;                                      // 목도리
      ctx.beginPath(); ctx.moveTo(14 * s, -24 * s); ctx.quadraticCurveTo(6 * s, -56 * s, 22 * s, -60 * s); ctx.quadraticCurveTo(32 * s, -50 * s, 30 * s, -30 * s); ctx.closePath(); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = shade(acc, -0.3);
        for (let i = 0; i < 5; i++) { const a = -2.4 + i * 0.35; ctx.beginPath(); ctx.arc(22 * s + Math.cos(a) * 15 * s, -40 * s + Math.sin(a) * 15 * s, 1.6 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(32 * s, -28 * s, 12 * s, 8 * s, 0.15, 0, 7); ctx.fill();          // 머리
      ctx.fillStyle = F3('#4a4038'); tri(S, 42 * s, -30 * s, 49 * s, -23 * s, 40 * s, -21 * s, F3('#4a4038'));        // 부리
      const horn = F3('#f4ecd8');
      tri(S, 28 * s, -34 * s, 46 * s, -50 * s, 32 * s, -31 * s, horn); tri(S, 34 * s, -32 * s, 52 * s, -44 * s, 37 * s, -29 * s, horn);   // 이마 뿔 둘
      tri(S, 40 * s, -30 * s, 46 * s, -38 * s, 43 * s, -28 * s, horn);                                                      // 코뿔
      if (!S.flash) { ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(33 * s, -31 * s, 1.4 * s, 0, 7); ctx.fill(); }
      ctx.restore();
      break;
    }
    case 'quetzal': {                                          // 깃털 뱀: 하늘에 뜬 긴 몸 · 무지갯빛 날개 · 깃털 볏 · 뒤의 태양 원반
      const t = MODEL.time, hov = -58 * s + Math.sin(t * 1.8) * 5 * s;
      if (S.live && !S.flash) {                                 // 태양 원반
        ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.16 + atk * 0.22;
        ctx.fillStyle = '#f0a020'; ctx.beginPath(); ctx.arc(-6 * s, hov - 14 * s, 24 * s, 0, 7); ctx.fill();
        ctx.globalAlpha *= 1.6; ctx.strokeStyle = '#e8901a'; ctx.lineWidth = 2 * s;
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * 0.4; ctx.beginPath(); ctx.moveTo(-6 * s + Math.cos(a) * 30 * s, hov - 14 * s + Math.sin(a) * 30 * s); ctx.lineTo(-6 * s + Math.cos(a) * 40 * s, hov - 14 * s + Math.sin(a) * 40 * s); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false;
      }
      const pts = [];                                           // 몸: 물결치는 S자
      for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([(-46 + u * 64) * s, hov + Math.sin(u * 7 - t * 4) * 8 * s * (1 - u * 0.5) + u * 4 * s]); }
      ctx.lineCap = 'round';
      for (let i = 0; i < pts.length - 1; i++) { const w = (5 + (i / pts.length) * 7) * s; line(S, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, i % 2 ? col : F3(x3Hex(st.body, -0.15))); }
      if (!S.flash) { ctx.save(); ctx._skipInk = true;          // 배의 금빛 비늘
        ctx.fillStyle = acc; for (let i = 2; i < pts.length - 1; i += 2) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1] + 3 * s, 1.6 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      const flap = Math.sin(t * 5) * 0.5, wx = -4 * s, wy = hov - 2 * s;
      const feath = [tun, acc, col, '#3a7ae8'];
      for (let i = 0; i < 6; i++) {                             // 날개 깃
        ctx.save(); ctx.translate(wx, wy); ctx.rotate(-1.9 + flap + i * 0.16);
        ctx.fillStyle = S.flash ? '#fff' : feath[i % 4]; ctx.beginPath(); ctx.ellipse(0, -18 * s, 4 * s, 18 * s, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
      const hx = pts[pts.length - 1][0], hy = pts[pts.length - 1][1];
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(hx + 6 * s, hy - 2 * s, 10 * s, 7 * s, 0, 0, 7); ctx.fill();     // 머리
      ctx.fillStyle = F3('#ffd23a'); tri(S, hx + 14 * s, hy - 5 * s, hx + 26 * s, hy - 1 * s + atk * 3 * s, hx + 14 * s, hy + 2 * s, F3('#ffd23a'));   // 부리
      for (let i = 0; i < 5; i++) {                             // 깃털 볏
        ctx.save(); ctx.translate(hx + 2 * s, hy - 7 * s); ctx.rotate(-1.2 - i * 0.28 + Math.sin(t * 3 + i) * 0.08);
        ctx.fillStyle = S.flash ? '#fff' : feath[(i + 1) % 4]; ctx.beginPath(); ctx.ellipse(0, -10 * s, 2.4 * s, 10 * s, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
      if (!S.flash) { ctx.fillStyle = '#ffe85a'; ctx.beginPath(); ctx.arc(hx + 9 * s, hy - 4 * s, 1.8 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(hx + 9.5 * s, hy - 4 * s, 0.8 * s, 0, 7); ctx.fill(); }
      if (S.live && !S.flash) {                                 // 땅에 비친 그림자
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(-8 * s, -1 * s, 34 * s, 5 * s, 0, 0, 7); ctx.fill(); ctx.restore(); ctx._skipInk = false;
      }
      break;
    }
    case 'jungletyrant': {                                     // 밀림의 폭군: 거대한 머리와 이빨 · 작은 앞발 · 용암 갈라짐 · 흉터
      const t = MODEL.time, gait = S.moving ? phase : 0, bodyY = -44 * s;
      for (const [d, hind] of [[1, 1], [-1, 0]]) {
        const a = Math.sin(gait + (d > 0 ? 0 : Math.PI)) * (S.moving ? 0.45 : 0.05);
        const hx = -6 * s, kx = hx + Math.sin(a) * 14 * s + 8 * s, ky = bodyY + 24 * s, fx = kx - 8 * s + Math.sin(a) * 8 * s;
        ctx.strokeStyle = hind ? shade(col, -0.25) : col; ctx.lineWidth = 11 * s;
        ctx.beginPath(); ctx.moveTo(hx, bodyY + 4 * s); ctx.lineTo(kx, ky); ctx.lineTo(fx, -3 * s); ctx.stroke();
        ctx.fillStyle = hind ? F3(x3Hex(st.body, -0.35)) : F3(x3Hex(st.body, -0.2)); ctx.beginPath(); ctx.ellipse(fx + 4 * s, -2 * s, 9 * s, 3 * s, 0, 0, 7); ctx.fill();
      }
      ctx.fillStyle = col;                                      // 몸 · 꼬리
      ctx.beginPath(); ctx.moveTo(-62 * s, bodyY + 2 * s); ctx.quadraticCurveTo(-30 * s, bodyY - 20 * s, 4 * s, bodyY - 18 * s);
      ctx.quadraticCurveTo(22 * s, bodyY - 16 * s, 24 * s, bodyY + 2 * s); ctx.quadraticCurveTo(16 * s, bodyY + 18 * s, -6 * s, bodyY + 16 * s);
      ctx.quadraticCurveTo(-30 * s, bodyY + 12 * s, -62 * s, bodyY + 2 * s); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = shade(col, 0.2); ctx.beginPath(); ctx.ellipse(0, bodyY + 10 * s, 16 * s, 4 * s, 0, 0, 7); ctx.fill();
        const glow = 0.45 + 0.35 * Math.sin(t * 3) + atk * 0.4;  // 용암 갈라짐
        ctx.strokeStyle = acc; ctx.globalAlpha *= Math.min(1, glow); ctx.lineWidth = 1.4 * s; ctx.beginPath();
        ctx.moveTo(-34 * s, bodyY - 6 * s); ctx.lineTo(-26 * s, bodyY + 2 * s); ctx.lineTo(-20 * s, bodyY - 4 * s); ctx.lineTo(-12 * s, bodyY + 4 * s);
        ctx.moveTo(-8 * s, bodyY - 12 * s); ctx.lineTo(-2 * s, bodyY - 4 * s); ctx.lineTo(6 * s, bodyY - 10 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false; }
      const bite = atk * 0.5, hx = 20 * s + atk * 10 * s, hy = bodyY - 22 * s;
      line(S, 10 * s, bodyY - 6 * s, hx, hy + 6 * s, 14 * s, col);   // 목
      ctx.fillStyle = col;                                      // 위턱 (머리)
      ctx.beginPath(); ctx.moveTo(hx - 6 * s, hy - 10 * s); ctx.quadraticCurveTo(hx + 14 * s, hy - 16 * s, hx + 32 * s, hy - 6 * s); ctx.lineTo(hx + 32 * s, hy + 2 * s);
      ctx.lineTo(hx - 4 * s, hy + 4 * s); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(hx, hy + 3 * s); ctx.rotate(bite + (MODEL.angry ? 0.08 : 0));        // 아래턱
      ctx.fillStyle = F3(x3Hex(st.body, -0.15)); ctx.beginPath(); ctx.moveTo(-4 * s, 0); ctx.lineTo(28 * s, 1 * s); ctx.lineTo(24 * s, 7 * s); ctx.lineTo(-2 * s, 8 * s); ctx.closePath(); ctx.fill();
      if (!S.flash) { ctx.fillStyle = '#f4ecd8'; for (let i = 0; i < 6; i++) tri(S, (2 + i * 4.4) * s, 1 * s, (4 + i * 4.4) * s, -3.5 * s, (6 + i * 4.4) * s, 1 * s, '#f4ecd8'); }
      ctx.restore();
      if (!S.flash) {
        ctx.fillStyle = '#f4ecd8'; for (let i = 0; i < 6; i++) tri(S, hx + (2 + i * 4.6) * s, hy + 2 * s, hx + (4 + i * 4.6) * s, hy + 7 * s, hx + (6 + i * 4.6) * s, hy + 2 * s, '#f4ecd8');
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(hx + 10 * s, hy - 7 * s, 2.4 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(hx + 9.5 * s, hy - 9 * s, 1 * s, 4 * s);
        if (S.live) x3Glow(S, hx + 10 * s, hy - 7 * s, 2.4 * s, acc, 0.5);
        ctx.save(); ctx._skipInk = true; ctx.strokeStyle = 'rgba(30,10,0,.5)'; ctx.lineWidth = 1.2 * s;       // 흉터
        ctx.beginPath(); ctx.moveTo(hx + 2 * s, hy - 12 * s); ctx.lineTo(hx + 8 * s, hy - 2 * s); ctx.moveTo(hx + 5 * s, hy - 13 * s); ctx.lineTo(hx + 11 * s, hy - 3 * s); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(hx + 12 * s, hy - 11 * s, 10 * s, 2.4 * s, 0.1, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      line(S, 14 * s, bodyY + 2 * s, 22 * s, bodyY + 8 * s, 3 * s, col); line(S, 22 * s, bodyY + 8 * s, 25 * s, bodyY + 6 * s, 2 * s, col);   // 작은 앞발
      for (let i = 0; i < 6; i++) tri(S, (-40 + i * 8) * s, bodyY - 10 * s + Math.abs(i - 3) * 1.4 * s, (-36 + i * 8) * s, bodyY - 18 * s + Math.abs(i - 3) * 1.4 * s, (-32 + i * 8) * s, bodyY - 10 * s + Math.abs(i - 3) * 1.4 * s, F3(x3Hex(st.body, -0.3)));   // 등 돌기
      break;
    }

    /* ---------------------- 4.6 도전 '폭주 기관차' ---------------------- */
    /* ---------------------- 4.11 6막 '홀린 요정 숲' ---------------------- */
    case 'pixie': {                                            // 장난꾸러기 요정: 잠자리 날개 · 짧은 꽃잎 치마 · 더듬이 · 별 지팡이
      const t = MODEL.time, bob = Math.sin(t * 6 + phase) * 3 * s, fl = Math.sin(t * 38) * 0.5 + 0.5;
      ctx.save(); ctx.translate(0, -16 * s + bob);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.55; ctx.fillStyle = acc;          // 날개 두 쌍
        for (const [a, l] of [[-0.5, 17], [-1.05, 13]]) { ctx.save(); ctx.translate(-2 * s, -37 * s); ctx.rotate(a - fl * 0.5); ctx.beginPath(); ctx.ellipse(-l * 0.5 * s, 0, l * 0.5 * s, 4 * s, 0, 0, 7); ctx.fill(); ctx.restore(); }
        ctx.restore(); ctx._skipInk = false; }
      line(S, -1 * s, -21 * s, -4 * s, -9 * s + Math.sin(t * 5) * s, 2.2 * s, col);            // 대롱대롱 다리
      line(S, 2 * s, -21 * s, 2 * s, -10 * s + Math.cos(t * 5) * s, 2.2 * s, F3(shade(st.body, -0.2)));
      ctx.save(); ctx.translate(0, -20 * s); robe(S, 8 * s, -20 * s, tun); ctx.restore();       // 꽃잎 치마
      head(S, 'bald', 7 * s);
      ctx.strokeStyle = F3('#3a2a4a'); ctx.lineWidth = 1 * s;                                     // 더듬이
      ctx.beginPath(); ctx.moveTo(2 * s, -56 * s); ctx.quadraticCurveTo(5 * s, -64 * s, 9 * s, -64 * s); ctx.moveTo(-2 * s, -56 * s); ctx.quadraticCurveTo(-3 * s, -65 * s, 1 * s, -67 * s); ctx.stroke();
      ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(9 * s, -64 * s, 1.4 * s, 0, 7); ctx.arc(1 * s, -67 * s, 1.4 * s, 0, 7); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#2a1a3a'; ctx.beginPath(); ctx.arc(4 * s, -51 * s, 1.2 * s, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,170,.6)'; ctx.beginPath(); ctx.arc(3 * s, -47.5 * s, 1.6 * s, 0, 7); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      armWeapon(S, -0.7 + atk * 0.9, () => {
        line(S, 0, 0, 13 * s, 0, 1.5 * s, F3('#f0e6c8'));
        ctx.fillStyle = S.flash ? '#fff' : '#ffe85a'; ctx.beginPath();                           // 별
        for (let i = 0; i < 10; i++) { const r = (i % 2 ? 1.6 : 3.8) * s, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(15 * s + Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
        if (S.live && !S.flash) x3Glow(S, 15 * s, 0, 3.5 * s, acc, 0.35 + atk * 0.5);
      }, 4 * s);
      ctx.restore();
      if (S.live && !S.flash) {                                  // 요정 가루
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc;
        for (let i = 0; i < 4; i++) { const q = (t * 0.9 + i / 4) % 1; ctx.globalAlpha = 0.7 * (1 - q); ctx.beginPath(); ctx.arc((-6 - q * 14 + Math.sin(i * 3) * 4) * s, (-20 + q * 14 + bob / s) * s, 1.1 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false;
      }
      break;
    }
    case 'sporecap': case 'mushking': {                        // 독버섯 병사 (왕은 왕관 · 망토 · 버섯 홀): 점박이 갓 · 통통한 자루 · 곤봉
      const king = st.shape === 'mushking', t = MODEL.time;
      if (king) cape(S, 1, F3('#5a2a6a'), 1.1);
      legs(S); torso(S, 6 * s);
      head(S, 'bald', 7.5 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#2a1a1a';              // 동그란 눈 · 입
        ctx.beginPath(); ctx.arc(3 * s, -50 * s, 1.3 * s, 0, 7); ctx.arc(7 * s, -50 * s, 1.3 * s, 0, 7); ctx.fill();
        ctx.fillRect(3.5 * s, -46 * s, 3.5 * s, 1 * s); ctx.restore(); ctx._skipInk = false; }
      const cw = (king ? 19 : 15) * s, ch = (king ? 13 : 10) * s, cy = -55 * s;
      ctx.fillStyle = tun;                                       // 갓
      ctx.beginPath(); ctx.ellipse(0, cy, cw, ch, 0, Math.PI, 0); ctx.quadraticCurveTo(0, cy + 4 * s, -cw, cy); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = '#fff4e0'; for (const [x, y, r] of [[-8, -3, 2.4], [-1, -7, 2.8], [6, -3, 2.2], [11, -7, 1.7], [-12, -7, 1.5]]) { ctx.beginPath(); ctx.arc(x * s * cw / (15 * s), cy + y * s * ch / (10 * s), r * s, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, cy + 1 * s, cw * 0.9, 2 * s, 0, 0, 7); ctx.fill();   // 주름 그늘
        ctx.restore(); ctx._skipInk = false; }
      if (king) {                                                // 버섯 왕관
        ctx.fillStyle = F3('#ffd23a'); ctx.beginPath(); ctx.moveTo(-8 * s, cy - ch + 2 * s);
        for (let i = 0; i <= 4; i++) { ctx.lineTo((-8 + i * 4) * s, cy - ch - (i % 2 ? 2 : 7) * s); } ctx.lineTo(8 * s, cy - ch + 2 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(0, cy - ch - 2 * s, 1.6 * s, 0, 7); ctx.fill(); }
      }
      armWeapon(S, (king ? -1.3 : -1.0) + atk * (king ? 1.0 : 2.0), () => {
        if (king) {                                              // 버섯 홀: 끝에 빛나는 보랏빛 버섯
          line(S, 0, 0, 30 * s, 0, 2.6 * s, F3('#e8d8c0'));
          ctx.fillStyle = S.flash ? '#fff' : acc; ctx.beginPath(); ctx.ellipse(32 * s, 0, 4 * s, 7 * s, 0, -Math.PI / 2, Math.PI / 2, true); ctx.fill();
          if (S.live && !S.flash) x3Glow(S, 31 * s, 0, 6 * s, acc, 0.35 + atk * 0.4);
        } else {                                                 // 옹이 곤봉
          line(S, 0, 0, 22 * s, 0, 3 * s, F3('#7a5a3a'));
          ctx.fillStyle = F3('#6a4a2a'); ctx.beginPath(); ctx.ellipse(22 * s, 0, 6 * s, 4.5 * s, 0, 0, 7); ctx.fill();
        }
      }, 6 * s);
      if (S.live && !S.flash) {                                  // 떠오르는 포자
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc;
        for (let i = 0; i < (king ? 6 : 3); i++) { const q = (t * 0.4 + i / (king ? 6 : 3)) % 1; ctx.globalAlpha = 0.6 * (1 - q); ctx.beginPath(); ctx.arc(Math.sin(t * 1.3 + i * 2) * cw, cy - ch - q * 26 * s, 1.5 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false;
      }
      break;
    }
    case 'treant': case 'eldertree': {                          // 나무 정령 (고목왕은 뿔 같은 가지관 · 이끼 수염 · 빛나는 심장)
      const elder = st.shape === 'eldertree', t = MODEL.time, stomp = S.moving ? Math.abs(Math.sin(phase)) * 2.5 * s : 0;
      const bark = col, dark = F3(x3Hex(st.body, -0.3));
      for (const d of [-1, 1]) {                                 // 뿌리 다리
        ctx.fillStyle = d < 0 ? dark : bark; const lift = d > 0 ? stomp : 0;
        ctx.beginPath(); ctx.moveTo(d * 3 * s, -24 * s); ctx.lineTo(d * 12 * s, -22 * s); ctx.lineTo(d * 15 * s, -lift); ctx.lineTo(d * 19 * s, -lift); ctx.lineTo(d * 8 * s, -lift - 1 * s); ctx.lineTo(d * 2 * s, -lift); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = bark;                                      // 줄기 몸통
      ctx.beginPath(); ctx.moveTo(-13 * s, -20 * s); ctx.lineTo(13 * s, -20 * s); ctx.lineTo(10 * s, -64 * s); ctx.lineTo(-10 * s, -64 * s); ctx.closePath(); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = shade(st.body, -0.35); ctx.lineWidth = 1.2 * s;   // 나무껍질 결
        ctx.beginPath(); for (const x of [-7, -2, 4, 8]) { ctx.moveTo(x * s, -22 * s); ctx.quadraticCurveTo((x + 2) * s, -40 * s, (x - 1) * s, -62 * s); } ctx.stroke();
        ctx.fillStyle = '#1a120a'; ctx.beginPath(); ctx.ellipse(4 * s, -40 * s, 4 * s, 2.5 * s, 0, 0, 7); ctx.fill();       // 입 (옹이 구멍)
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(1 * s, -51 * s, 1.8 * s, 0, 7); ctx.arc(7 * s, -51 * s, 1.8 * s, 0, 7); ctx.fill();
        x3Glow(S, 4 * s, -51 * s, 4 * s, acc, 0.45);
        if (elder) { ctx.fillStyle = '#7ab85a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo((-1 + i * 2) * s, -36 * s); ctx.lineTo((-2 + i * 2.4) * s, (-22 - (i % 2) * 4) * s); ctx.lineTo((0 + i * 2) * s, -36 * s); ctx.fill(); }   // 이끼 수염
          const beat = 0.5 + 0.5 * Math.sin(t * 3); ctx.fillStyle = '#ffe85a'; ctx.beginPath(); ctx.arc(-4 * s, -32 * s, (2 + beat) * s, 0, 7); ctx.fill(); x3Glow(S, -4 * s, -32 * s, 5 * s, '#ffe85a', 0.3 + beat * 0.4); }
        ctx.restore(); ctx._skipInk = false; }
      armWeapon(S, -0.9 + atk * 1.5, () => {                     // 가지 팔
        line(S, 0, 0, 24 * s, 2 * s, 5 * s, bark);
        line(S, 14 * s, 1 * s, 22 * s, -8 * s, 2.5 * s, bark); line(S, 18 * s, 2 * s, 28 * s, 8 * s, 2.5 * s, bark);
        if (!S.flash) { ctx.fillStyle = acc; for (const [x, y] of [[22, -9], [29, 9], [26, 1]]) { ctx.beginPath(); ctx.arc(x * s, y * s, 3.2 * s, 0, 7); ctx.fill(); } }
      }, 8 * s);
      const sway = Math.sin(t * 1.2) * 1.5 * s;                  // 잎 머리
      ctx.fillStyle = F3(x3Hex(st.accent, -0.35));
      for (const [x, y, r] of [[-9, -68, 9], [8, -70, 9], [0, -76, 10]]) { ctx.beginPath(); ctx.arc(x * s + sway, y * s, r * s, 0, 7); ctx.fill(); }
      ctx.fillStyle = acc;
      for (const [x, y, r] of [[-5, -72, 6], [6, -74, 6], [0, -80, 5]]) { ctx.beginPath(); ctx.arc(x * s + sway, y * s, r * s, 0, 7); ctx.fill(); }
      if (elder) {                                               // 가지관
        for (const d of [-1, 1]) { line(S, d * 6 * s, -76 * s, d * 16 * s, -96 * s, 3 * s, bark); line(S, d * 12 * s, -88 * s, d * 22 * s, -90 * s, 2 * s, bark); line(S, d * 14 * s, -93 * s, d * 12 * s, -103 * s, 2 * s, bark); }
        if (!S.flash) { ctx.fillStyle = '#ffb8e0'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(d * 22 * s, -90 * s, 2 * s, 0, 7); ctx.arc(d * 12 * s, -103 * s, 2 * s, 0, 7); ctx.fill(); } }
      }
      if (S.live && !S.flash && elder) {                         // 떨어지는 잎
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc;
        for (let i = 0; i < 4; i++) { const q = (t * 0.3 + i / 4) % 1; ctx.globalAlpha = 0.8 * (1 - q); ctx.beginPath(); ctx.ellipse((-14 + i * 9 + Math.sin(t * 2 + i) * 5) * s, (-80 + q * 70) * s, 2.4 * s, 1.2 * s, t + i, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false;
      }
      break;
    }
    case 'satyr': {                                            // 사티로스 피리꾼: 염소 다리 · 굽은 뿔 · 팬 플루트 · 떠도는 음표
      const t = MODEL.time;
      for (let i = 0; i < 2; i++) {                              // 뒤로 꺾인 염소 다리 · 발굽
        const ph = phase + i * Math.PI, sw = S.moving ? Math.sin(ph) * 6 * s : 0, lift = S.moving ? Math.max(0, Math.sin(ph + 1.1)) * 4 * s : 0;
        ctx.strokeStyle = i ? F3(shade(st.tunic, -0.2)) : tun; ctx.lineWidth = 4.2 * s;
        ctx.beginPath(); ctx.moveTo(0, -20 * s); ctx.lineTo(5 * s + sw * 0.5, -11 * s - lift); ctx.lineTo(-1 * s + sw, -4 * s - lift); ctx.lineTo(1 * s + sw, -1 * s - lift); ctx.stroke();
        ctx.fillStyle = F3('#2a2018'); ctx.fillRect(-1 * s + sw, -2 * s - lift, 4.5 * s, 2.4 * s);
      }
      torso(S, 5 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = shade(st.tunic, 0.1);    // 허리 털
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc((-5 + i * 2.5) * s, -21 * s, 2.2 * s, 0, 7); ctx.fill(); } ctx.restore(); ctx._skipInk = false; }
      head(S, 'bald', 8 * s);
      ctx.strokeStyle = F3('#e8d8b0'); ctx.lineWidth = 2.6 * s;  // 굽은 뿔
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(d * 4 * s - 1 * s, -61 * s, 4.5 * s, Math.PI * (d > 0 ? 1.1 : 1.9), Math.PI * (d > 0 ? 0.2 : 0.8), d < 0); ctx.stroke(); }
      tri(S, 3 * s, -44 * s, 8 * s, -44 * s, 5 * s, -37 * s, F3(shade(st.tunic, -0.1)));      // 염소수염
      arm(S, 8 * s, -46 * s);                                    // 팬 플루트를 입에
      ctx.fillStyle = acc; for (let i = 0; i < 5; i++) ctx.fillRect((8 + i * 1.8) * s, (-52 + i * 0.3) * s, 1.5 * s, (6 + i * 1.6) * s);
      if (S.live && !S.flash) {                                  // 음표
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; ctx.strokeStyle = acc; ctx.lineWidth = 0.9 * s;
        for (let i = 0; i < 3; i++) { const q = (t * 0.5 + i / 3) % 1, x = (16 + q * 16) * s, y = (-56 - q * 16 + Math.sin(t * 4 + i) * 3) * s;
          ctx.globalAlpha = 1 - q; ctx.beginPath(); ctx.ellipse(x, y, 1.8 * s, 1.3 * s, -0.4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 1.6 * s, y); ctx.lineTo(x + 1.6 * s, y - 6 * s); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false;
      }
      break;
    }
    case 'unicorn': {                                          // 일각수 기사: 하얀 말 · 무지갯빛 갈기 · 빛나는 뿔 · 등에 탄 기사의 창
      const t = MODEL.time, gait = S.moving ? phase * 2 : 0, run = S.moving ? 1 : 0.15, by = -30 * s + (S.moving ? Math.abs(Math.sin(gait)) * -2 * s : 0);
      for (const [lx, off, back] of [[-13, 0, 1], [-9, Math.PI, 0], [10, Math.PI, 1], [14, 0, 0]]) {   // 네 다리
        const a = Math.sin(gait + off) * 0.6 * run, kx = lx * s + Math.sin(a) * 6 * s, ky = by + 14 * s;
        ctx.strokeStyle = back ? F3(shade(st.body, -0.18)) : col; ctx.lineWidth = 3.6 * s;
        ctx.beginPath(); ctx.moveTo(lx * s, by + 4 * s); ctx.lineTo(kx, ky); ctx.lineTo(kx - Math.sin(a) * 3 * s, -2 * s); ctx.stroke();
        ctx.fillStyle = F3('#c8b878'); ctx.fillRect(kx - Math.sin(a) * 3 * s - 2 * s, -3 * s, 4.4 * s, 3 * s);
      }
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, by, 20 * s, 9 * s, 0, 0, 7); ctx.fill();          // 몸
      const nx = 17 * s, ny = by - 4 * s, hx = 24 * s + atk * 5 * s, hy = by - 20 * s + atk * 4 * s;
      ctx.beginPath(); ctx.moveTo(nx - 6 * s, ny + 4 * s); ctx.lineTo(hx - 2 * s, hy + 3 * s); ctx.lineTo(hx + 2 * s, hy - 2 * s); ctx.lineTo(nx + 3 * s, ny - 6 * s); ctx.closePath(); ctx.fill();   // 목
      ctx.beginPath(); ctx.ellipse(hx + 4 * s, hy, 7 * s, 4 * s, 0.35, 0, 7); ctx.fill();                       // 머리
      line(S, hx + 2 * s, hy - 4 * s, hx + 13 * s, hy - 15 * s, 2.2 * s, F3('#ffe8a8'));                      // 뿔
      if (!S.flash) { x3Glow(S, hx + 13 * s, hy - 15 * s, 3 * s, acc, 0.4 + atk * 0.5);
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#2a2a4a'; ctx.beginPath(); ctx.arc(hx + 5 * s, hy - 1.5 * s, 1 * s, 0, 7); ctx.fill();
        const rain = ['#ff8ad8', '#ffd25a', '#7ae8ff', '#a88aff'];                                           // 무지갯빛 갈기 · 꼬리
        for (let i = 0; i < 4; i++) { ctx.strokeStyle = rain[i]; ctx.lineWidth = 1.8 * s; ctx.beginPath(); ctx.moveTo(hx - 2 * s - i * 2 * s, hy - 3 * s + i * 3 * s); ctx.quadraticCurveTo(hx - 9 * s - i * 2 * s, hy + 2 * s + i * 3 * s + Math.sin(t * 5 + i) * 2 * s, hx - 10 * s - i * 3 * s, hy + 8 * s + i * 3 * s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-19 * s, by - 3 * s + i * 1.5 * s); ctx.quadraticCurveTo(-28 * s, by + i * 2 * s + Math.sin(t * 4 + i) * 2 * s, -31 * s, by + 10 * s + i * 2 * s); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false; }
      ctx.save(); ctx.translate(-3 * s, by + 16 * s);              // 기사
      torso(S, 5 * s); head(S, 'circlet', 7.5 * s);
      armWeapon(S, -0.35 + atk * 0.5, () => {
        line(S, -8 * s, 0, 30 * s, 0, 2.4 * s, F3('#e8e0f0'));
        tri(S, 30 * s, -3 * s, 38 * s, 0, 30 * s, 3 * s, acc);
      }, 4 * s);
      ctx.restore();
      break;
    }
    case 'wisp': {                                             // 홀림불: 떠도는 푸른 불꽃 · 하얀 심지 · 꼬리 · 반짝이는 눈
      const t = MODEL.time, bob = Math.sin(t * 3 + phase) * 4 * s, y0 = -34 * s + bob;
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.35; ctx.fillStyle = acc;
        ctx.beginPath(); ctx.arc(0, y0, 18 * s, 0, 7); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = tun;                                       // 꼬리
      ctx.beginPath(); ctx.moveTo(-6 * s, y0 + 4 * s); ctx.quadraticCurveTo(-18 * s, y0 + 8 * s + Math.sin(t * 5) * 3 * s, -26 * s, y0 + 2 * s + Math.sin(t * 5 + 1) * 4 * s); ctx.quadraticCurveTo(-16 * s, y0 - 2 * s, -6 * s, y0 - 6 * s); ctx.fill();
      ctx.fillStyle = acc;                                       // 불꽃 몸
      ctx.beginPath(); ctx.moveTo(-10 * s, y0 + 4 * s);
      for (let i = 0; i <= 6; i++) { const u = i / 6, x = (-10 + u * 20) * s, tip = (i % 2 ? 9 : 18) + Math.sin(t * 9 + i * 1.7) * 3; ctx.lineTo(x, y0 - tip * s); }
      ctx.lineTo(10 * s, y0 + 4 * s); ctx.quadraticCurveTo(0, y0 + 14 * s, -10 * s, y0 + 4 * s); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, y0 + 2 * s, 6 * s, 7 * s, 0, 0, 7); ctx.fill();      // 하얀 심지
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#0a3a2a';
        const blink = Math.sin(t * 2.3) > 0.95 ? 0.2 : 1; ctx.beginPath(); ctx.ellipse(2 * s, y0, 1.2 * s, 1.8 * s * blink, 0, 0, 7); ctx.ellipse(6 * s, y0, 1.2 * s, 1.8 * s * blink, 0, 0, 7); ctx.fill();
        x3Glow(S, 0, y0, 9 * s, acc, 0.3 + atk * 0.6); ctx.restore(); ctx._skipInk = false; }
      break;
    }
    case 'faequeen': {                                         // 요정 여왕: 큰 나비 날개 · 별빛 드레스 · 티아라 · 초승달 홀
      const t = MODEL.time, fl = Math.sin(t * 3) * 0.5 + 0.5, bob = Math.sin(t * 2) * 2 * s;
      ctx.save(); ctx.translate(0, -6 * s + bob);
      if (!S.flash) { ctx.save(); ctx._skipInk = true;                                        // 나비 날개
        for (const [a, rx, ry, c] of [[-0.35, 22, 15, acc], [0.55, 16, 11, st.tunic]]) {
          ctx.save(); ctx.translate(-3 * s, -40 * s); ctx.rotate(a - fl * 0.25); ctx.globalAlpha = 0.6; ctx.fillStyle = c;
          ctx.beginPath(); ctx.ellipse(-rx * s, -ry * 0.4 * s, rx * s, ry * s, 0.3, 0, 7); ctx.fill();
          ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8 * s; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-rx * 1.2 * s, -ry * 0.6 * s, 2.4 * s, 0, 7); ctx.fill(); ctx.restore(); }
        ctx.restore(); ctx._skipInk = false; }
      robe(S, 20 * s, -46 * s, tun);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#fff';                 // 드레스의 별빛
        for (let i = 0; i < 7; i++) { const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 2); ctx.globalAlpha = tw; ctx.beginPath(); ctx.arc((-12 + i * 4) * s, (-6 - (i * 7 % 22)) * s, 0.9 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      torso(S, 5 * s);
      head(S, 'circlet', 8 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#e8d8ff';             // 흘러내리는 머리칼
        ctx.beginPath(); ctx.moveTo(-6 * s, -56 * s); ctx.quadraticCurveTo(-14 * s, -44 * s, -10 * s, -30 * s); ctx.lineTo(-4 * s, -40 * s); ctx.closePath(); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = F3('#ffe85a');                             // 티아라
      ctx.beginPath(); ctx.moveTo(-6 * s, -57 * s); ctx.lineTo(-3 * s, -63 * s); ctx.lineTo(0, -58 * s); ctx.lineTo(3 * s, -66 * s); ctx.lineTo(6 * s, -58 * s); ctx.lineTo(8 * s, -62 * s); ctx.lineTo(8 * s, -56 * s); ctx.closePath(); ctx.fill();
      if (!S.flash) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(3 * s, -61 * s, 1.5 * s, 0, 7); ctx.fill(); }
      armWeapon(S, -1.45 + atk * 0.8, () => {                    // 초승달 홀
        line(S, -4 * s, 0, 32 * s, 0, 2 * s, F3('#f0e6c8'));
        ctx.fillStyle = S.flash ? '#fff' : '#fff6c8'; ctx.beginPath(); ctx.arc(36 * s, 0, 6 * s, 0, 7); ctx.arc(38.5 * s, -1.5 * s, 5 * s, 0, 7, true); ctx.fill('evenodd');
        if (S.live && !S.flash) x3Glow(S, 36 * s, 0, 7 * s, acc, 0.35 + atk * 0.5);
      }, 8 * s);
      ctx.restore();
      if (S.live && !S.flash) {                                  // 주위를 도는 빛 요정
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc;
        for (let i = 0; i < 3; i++) { const a = t * 1.8 + i * 2.1; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(Math.cos(a) * 24 * s, -40 * s + Math.sin(a) * 10 * s, 1.8 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false;
      }
      break;
    }
    /* ---------------------- 4.15 7막 '모래폭풍 사막' ---------------------- */
    case 'scorpion': case 'scorpking': {                       // 거대 전갈 (왕은 금관 · 보석 독침 · 갑각 무늬): 마디진 꼬리 · 집게 · 여섯 다리
      const king = st.shape === 'scorpking', t = MODEL.time, gait = S.moving ? phase * 2.4 : 0;
      const by = -14 * s, shell = col, dark = F3(x3Hex(st.body, -0.3));
      for (let i = 0; i < 3; i++) for (const d of [1, -1]) {   // 다리
        const lx = (-10 + i * 8) * s, sw = Math.sin(gait + i * 1.3 + (d > 0 ? 0 : Math.PI)) * 3 * s;
        ctx.strokeStyle = d < 0 ? dark : shell; ctx.lineWidth = 2.2 * s;
        ctx.beginPath(); ctx.moveTo(lx, by + 2 * s); ctx.lineTo(lx + sw - 4 * s, by + 7 * s); ctx.lineTo(lx + sw - 6 * s, -1 * s); ctx.stroke();
      }
      ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(-2 * s, by, 18 * s, 7 * s, 0, 0, 7); ctx.fill();          // 몸통
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = shade(st.body, -0.25);
        for (let i = 0; i < 4; i++) ctx.fillRect((-14 + i * 7) * s, by - 6 * s, 1.4 * s, 10 * s); ctx.restore(); ctx._skipInk = false; }
      const strike = atk;                                      // 꼬리: 마디마다 굽어 머리 위로 · 칠 때 앞으로 내리꽂는다
      let px = -18 * s, py = by - 2 * s;
      for (let i = 0; i < 6; i++) {
        const a = -1.9 + i * 0.42 + strike * (0.5 + i * 0.12) + Math.sin(t * 2 + i) * 0.04;
        const nx = px + Math.cos(a) * 7 * s, ny = py + Math.sin(a) * 7 * s;
        ctx.fillStyle = i % 2 ? dark : shell; ctx.beginPath(); ctx.arc(nx, ny, (4.6 - i * 0.35) * s, 0, 7); ctx.fill();
        px = nx; py = ny;
      }
      tri(S, px, py - 2 * s, px + 7 * s + strike * 4 * s, py + 3 * s, px, py + 3 * s, acc);   // 독침
      if (!S.flash) x3Glow(S, px + 3 * s, py + 1 * s, 3 * s, acc, 0.3 + strike * 0.6);
      for (const d of [1, -1]) {                               // 집게
        const cx = 16 * s, cy = by + d * 2 * s, open = 0.25 + Math.sin(t * 3 + d) * 0.1 + atk * 0.3;
        line(S, 10 * s, by, cx, cy, 3 * s, d < 0 ? dark : shell);
        ctx.fillStyle = d < 0 ? dark : shell;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-open * d * 0.6);
        ctx.beginPath(); ctx.ellipse(5 * s, -2 * s, 6 * s, 2.6 * s, -0.3, 0, 7); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(open * d * 0.6);
        ctx.beginPath(); ctx.ellipse(5 * s, 2 * s, 5 * s, 2 * s, 0.3, 0, 7); ctx.fill(); ctx.restore();
      }
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#1a1a1a';                     // 눈
        ctx.beginPath(); ctx.arc(10 * s, by - 4 * s, 1.2 * s, 0, 7); ctx.arc(7 * s, by - 5 * s, 1.1 * s, 0, 7); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      if (king) {                                              // 금관 · 갑각 보석
        ctx.fillStyle = F3('#ffd23a'); ctx.beginPath(); ctx.moveTo(2 * s, by - 6 * s);
        for (let i = 0; i <= 4; i++) ctx.lineTo((2 + i * 3) * s, by - (i % 2 ? 9 : 13) * s); ctx.lineTo(14 * s, by - 6 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) { ctx.fillStyle = acc; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((-10 + i * 7) * s, by - 2 * s, 1.6 * s, 0, 7); ctx.fill(); } }
      }
      break;
    }
    case 'mummy': {                                            // 미라 병사: 붕대 줄무늬 · 풀린 붕대 끝 · 빛나는 눈 · 낫칼
      const t = MODEL.time;
      legs(S); torso(S, 5 * s);
      head(S, 'bald', 8 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = shade(st.body, -0.22); ctx.lineWidth = 1.1 * s;   // 붕대 줄
        for (let i = 0; i < 6; i++) { const y = (-58 + i * 3) * s; ctx.beginPath(); ctx.moveTo(-8 * s, y + 1 * s); ctx.lineTo(8 * s, y - 1 * s); ctx.stroke(); }
        for (let i = 0; i < 5; i++) { const y = (-39 + i * 4) * s; ctx.beginPath(); ctx.moveTo(-6 * s, y + 1.5 * s); ctx.lineTo(6 * s, y - 1 * s); ctx.stroke(); }
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(4 * s, -51 * s, 1.5 * s, 0, 7); ctx.fill(); x3Glow(S, 4 * s, -51 * s, 2.5 * s, acc, 0.5);
        ctx.strokeStyle = st.body; ctx.lineWidth = 1.8 * s; ctx.beginPath();                                   // 풀린 붕대 끝
        ctx.moveTo(-6 * s, -30 * s); ctx.quadraticCurveTo(-14 * s, -24 * s + Math.sin(t * 3) * 2 * s, -20 * s, -18 * s + Math.sin(t * 3 + 1) * 3 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false; }
      armWeapon(S, -1.0 + atk * 1.6, () => {                    // 녹슨 낫칼 (코페시)
        line(S, 0, 0, 12 * s, 0, 2.4 * s, F3('#6a5a3a'));
        ctx.strokeStyle = F3('#8a8a7a'); ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(12 * s, 0); ctx.quadraticCurveTo(22 * s, -2 * s, 24 * s, 6 * s); ctx.stroke();
      }, 5 * s);
      break;
    }
    case 'sandworm': {                                         // 모래벌레: 모래에서 솟은 마디진 몸 · 둥근 이빨 입 · 모래 물결
      const t = MODEL.time, rise = S.moving ? Math.sin(phase * 1.2) * 3 * s : 0;
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(210,170,110,.8)';                // 모래 둔덕
        ctx.beginPath(); ctx.ellipse(-4 * s, 0, 24 * s, 5 * s, 0, Math.PI, 0); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      let px = -14 * s, py = 0;
      for (let i = 0; i < 6; i++) {                              // 몸 마디: 아래에서 위 · 앞으로 굽는다
        const a = -1.35 + i * 0.16 + atk * 0.25 + Math.sin(t * 1.6 + i * 0.6) * 0.05;
        const nx = px + Math.cos(a) * 9 * s, ny = py + Math.sin(a) * 9 * s - (i === 0 ? rise : 0);
        ctx.fillStyle = i % 2 ? F3(x3Hex(st.body, -0.15)) : col; ctx.beginPath(); ctx.arc(nx, ny, (10 - i * 0.6) * s, 0, 7); ctx.fill();
        if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = shade(st.body, -0.3); ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.arc(nx, ny, (10 - i * 0.6) * s, -2.2, -0.9); ctx.stroke(); ctx.restore(); ctx._skipInk = false; }
        px = nx; py = ny;
      }
      const mo = 0.4 + atk * 0.6;                                // 입: 둥근 이빨 고리
      ctx.fillStyle = F3('#3a1a12'); ctx.beginPath(); ctx.ellipse(px + 5 * s, py, 4 * s * (0.6 + mo), 7 * s, 0, 0, 7); ctx.fill();
      if (!S.flash) { ctx.fillStyle = '#f0e8d0'; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; tri(S, px + 5 * s + Math.cos(a) * 4 * s * (0.6 + mo), py + Math.sin(a) * 7 * s, px + 5 * s + Math.cos(a) * 2 * s, py + Math.sin(a) * 4 * s, px + 5 * s + Math.cos(a + 0.4) * 4 * s * (0.6 + mo), py + Math.sin(a + 0.4) * 7 * s, '#f0e8d0'); }
        x3Glow(S, px + 5 * s, py, 4 * s, acc, 0.25 + atk * 0.5); }
      break;
    }
    case 'dunerider': {                                        // 사막 약탈자: 낙타 · 터번과 얼굴 가리개 · 짧은 활
      const t = MODEL.time, gait = S.moving ? phase * 1.8 : 0, by = -26 * s + (S.moving ? Math.abs(Math.sin(gait)) * -2 * s : 0);
      for (const [lx, off] of [[-12, 0], [-8, Math.PI], [9, Math.PI], [13, 0]]) {
        const a = Math.sin(gait + off) * 0.5 * (S.moving ? 1 : 0.1), kx = lx * s + Math.sin(a) * 6 * s;
        ctx.strokeStyle = off ? F3(x3Hex(st.body, -0.2)) : col; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.moveTo(lx * s, by + 4 * s); ctx.lineTo(kx, by + 15 * s); ctx.lineTo(kx - Math.sin(a) * 2 * s, -1 * s); ctx.stroke();
      }
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, by, 17 * s, 8 * s, 0, 0, 7); ctx.fill();                     // 몸
      ctx.beginPath(); ctx.ellipse(-2 * s, by - 7 * s, 7 * s, 6 * s, 0, Math.PI, 0); ctx.fill();                          // 혹
      line(S, 14 * s, by - 2 * s, 22 * s, by - 16 * s, 5 * s, col);                                                    // 목
      ctx.beginPath(); ctx.ellipse(25 * s, by - 17 * s, 6 * s, 3.4 * s, 0.2, 0, 7); ctx.fill();                          // 머리
      if (!S.flash) { ctx.fillStyle = acc; ctx.fillRect(-10 * s, by - 4 * s, 18 * s, 3 * s); ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(26 * s, by - 18 * s, 0.8 * s, 0, 7); ctx.fill(); }
      ctx.save(); ctx.translate(-2 * s, by + 12 * s);              // 탄 사람
      torso(S, 5 * s); head(S, 'wrap', 7.5 * s);
      if (!S.flash) { ctx.fillStyle = tun; ctx.fillRect(1 * s, -50 * s, 8 * s, 3 * s); }
      armWeapon(S, -0.25, () => {
        ctx.strokeStyle = F3('#6a4a2a'); ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(4 * s, 0, 9 * s, -1.2, 1.2); ctx.stroke();
        ctx.strokeStyle = F3('#e8e0c8'); ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(4 * s + Math.cos(-1.2) * 9 * s, Math.sin(-1.2) * 9 * s); ctx.lineTo(4 * s - S.wind * 4 * s, 0); ctx.lineTo(4 * s + Math.cos(1.2) * 9 * s, Math.sin(1.2) * 9 * s); ctx.stroke();
      }, 4 * s);
      ctx.restore();
      break;
    }
    case 'sandmage': {                                         // 모래 술사: 긴 두건 로브 · 모래시계 지팡이 · 발밑 소용돌이
      const t = MODEL.time;
      if (S.live && !S.flash) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = 'rgba(220,180,110,.6)'; ctx.lineWidth = 1.4 * s;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, -2 * s - i * 3 * s, (12 - i * 3) * s, 3 * s, 0, t * 3 + i, t * 3 + i + 4); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false; }
      robe(S, 17 * s, -44 * s, tun);
      head(S, 'hood', 8 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(4 * s, -51 * s, 1.3 * s, 0, 7); ctx.arc(7 * s, -51 * s, 1.3 * s, 0, 7); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      armWeapon(S, -1.4 + atk * 0.8, () => {
        line(S, -4 * s, 0, 28 * s, 0, 2.2 * s, F3('#6a4a2a'));
        ctx.fillStyle = F3('#ffd23a'); ctx.fillRect(28 * s, -5 * s, 2 * s, 10 * s); ctx.fillRect(36 * s, -5 * s, 2 * s, 10 * s);       // 모래시계
        ctx.fillStyle = S.flash ? '#fff' : 'rgba(200,230,255,.8)'; ctx.beginPath(); ctx.moveTo(30 * s, -5 * s); ctx.lineTo(36 * s, -5 * s); ctx.lineTo(30 * s, 5 * s); ctx.lineTo(36 * s, 5 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) { ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(31 * s, 5 * s); ctx.lineTo(35 * s, 5 * s); ctx.lineTo(33 * s, 2 * s); ctx.fill(); x3Glow(S, 33 * s, 0, 5 * s, acc, 0.3 + atk * 0.5); }
      }, 8 * s);
      break;
    }
    case 'scarab_e': case 'scarablet': {                       // 황금 풍뎅이 (떼는 셋이 겹쳐 기어온다)
      const t = MODEL.time, swarm = st.shape === 'scarab_e';
      const bug = (ox, oy, k) => {
        const g = S.moving ? Math.sin(phase * 3 + ox) * 1.5 * s : 0;
        ctx.strokeStyle = F3('#3a2a12'); ctx.lineWidth = 1.2 * s;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(ox + (-4 + i * 4) * s * k, oy); ctx.lineTo(ox + (-6 + i * 4) * s * k + g, oy + 5 * s * k); ctx.stroke(); }
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(ox, oy - 3 * s * k, 8 * s * k, 5.5 * s * k, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = F3('#3a2a12'); ctx.beginPath(); ctx.arc(ox + 8 * s * k, oy - 2 * s * k, 2.6 * s * k, 0, 7); ctx.fill();
        if (!S.flash) { ctx.strokeStyle = acc; ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.moveTo(ox, oy - 8.5 * s * k); ctx.lineTo(ox, oy - 3 * s * k); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(ox - 3 * s * k, oy - 6 * s * k, 2.5 * s * k, 1.2 * s * k, -0.3, 0, 7); ctx.fill(); }
      };
      if (swarm) { bug(-10 * s, -2 * s, 0.85); bug(8 * s, -1 * s, 0.85); bug(-1 * s, 0, 1.05); }
      else bug(0, 0, 1);
      break;
    }
    case 'sphinx': {                                           // 스핑크스: 사자 몸 · 줄무늬 두건(네메스)의 사람 얼굴 · 날개 · 엎드렸다 일어선다
      const t = MODEL.time, by = -18 * s + (S.moving ? Math.sin(phase) * 1 * s : 0);
      for (const [lx, back] of [[-14, 1], [-9, 0], [10, 1], [15, 0]]) { ctx.fillStyle = back ? F3(x3Hex(st.body, -0.2)) : col; ctx.fillRect(lx * s - 2.5 * s, by + 4 * s, 5 * s, 14 * s); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, by, 20 * s, 9 * s, 0, 0, 7); ctx.fill();                        // 사자 몸
      ctx.strokeStyle = col; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.moveTo(-19 * s, by - 2 * s); ctx.quadraticCurveTo(-30 * s, by - 8 * s + Math.sin(t * 2) * 2 * s, -28 * s, by - 16 * s); ctx.stroke();   // 꼬리
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha = 0.85; ctx.fillStyle = acc;                          // 날개
        ctx.beginPath(); ctx.moveTo(-6 * s, by - 6 * s); ctx.quadraticCurveTo(-24 * s, by - 34 * s - Math.sin(t * 2) * 3 * s, -2 * s, by - 26 * s); ctx.quadraticCurveTo(-8 * s, by - 16 * s, 4 * s, by - 6 * s); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.8 * s; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-4 * s, by - 8 * s); ctx.lineTo((-16 + i * 5) * s, by - (28 - i * 3) * s); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false; }
      { const hx = 18 * s, hy = by - 15 * s, hr = 6.5 * s;                                                              // 사람 얼굴 (금빛 줄무늬 네메스)
        ctx.fillStyle = S.flash ? '#fff' : F3('#e0b040'); ctx.beginPath(); ctx.moveTo(hx - hr - 3 * s, hy + 11 * s); ctx.lineTo(hx - hr, hy - hr - 1 * s);
        ctx.lineTo(hx + hr, hy - hr - 1 * s); ctx.lineTo(hx + hr + 3 * s, hy + 11 * s); ctx.lineTo(hx + hr - 2 * s, hy + 4 * s); ctx.lineTo(hx - hr + 2 * s, hy + 4 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) { ctx.strokeStyle = F3(st.tunic); ctx.lineWidth = 1.2 * s; for (let i = 0; i < 3; i++) { const yy = hy - hr + 3 * s + i * 4 * s; ctx.beginPath(); ctx.moveTo(hx - hr - 1 * s - i * 0.8 * s, yy); ctx.lineTo(hx + hr + 1 * s + i * 0.8 * s, yy); ctx.stroke(); } }
        ctx.fillStyle = S.flash ? '#fff' : F3('#c89a5a'); ctx.beginPath(); ctx.arc(hx + 1.5 * s, hy + 0.5 * s, hr * 0.68, 0, 7); ctx.fill(); }
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(21.5 * s, by - 15.5 * s, 1.2 * s, 0, 7); ctx.fill(); x3Glow(S, 21.5 * s, by - 15.5 * s, 3 * s, acc, 0.4 + atk * 0.5); ctx.restore(); ctx._skipInk = false; }
      if (S.live && !S.flash && atk > 0.1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = acc; ctx.globalAlpha = atk * 0.5;   // 눈에서 뿜는 빛
        ctx.beginPath(); ctx.moveTo(22 * s, by - 15.5 * s); ctx.lineTo(44 * s, by - 22 * s); ctx.lineTo(44 * s, by - 9 * s); ctx.closePath(); ctx.fill(); ctx.restore(); }
      break;
    }
    case 'sandpharaoh': {                                      // 모래폭풍의 파라오: 금빛 네메스 · 붕대 몸 · 갈고리 지팡이와 도리깨 · 모래 회오리 망토
      const t = MODEL.time;
      if (S.live && !S.flash) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = 'rgba(220,180,110,.55)'; ctx.lineWidth = 2 * s;   // 발밑 모래 회오리
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, -4 * s - i * 6 * s, (20 - i * 3) * s, 4 * s, 0, t * 2.5 + i, t * 2.5 + i + 3.6); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false; }
      cape(S, 1, tun, 1.2);
      robe(S, 18 * s, -40 * s, F3('#e8dcb8'));
      torso(S, 6 * s);
      head(S, 'nemes', 9 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#ffd23a'; ctx.fillRect(-7 * s, -44 * s, 14 * s, 3 * s);            // 금 목걸이
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(4 * s, -52 * s, 1.6 * s, 0, 7); ctx.fill(); x3Glow(S, 4 * s, -52 * s, 3.5 * s, acc, 0.5);
        ctx.fillStyle = '#ffd23a'; tri(S, 0, -62 * s, 3 * s, -68 * s, 6 * s, -62 * s, '#ffd23a');                                       // 코브라 장식
        ctx.restore(); ctx._skipInk = false; }
      armWeapon(S, -1.2 + atk * 1.4, () => {                       // 갈고리 지팡이
        line(S, -6 * s, 0, 30 * s, 0, 2.6 * s, F3('#ffd23a'));
        ctx.strokeStyle = F3('#2a3a7a'); ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(30 * s, -5 * s, 5 * s, Math.PI * 0.5, Math.PI * 2.0); ctx.stroke();
        if (S.live && !S.flash) x3Glow(S, 34 * s, -5 * s, 6 * s, acc, 0.3 + atk * 0.5);
      }, 8 * s);
      break;
    }
    /* ---------------------- 4.15 도전 '파라오의 모래시계' ---------------------- */
    case 'hourglass': {                                        // 모래시계 토템: 돌 받침 · 금빛 틀 · 위에서 아래로 흐르는 모래 (18초에 한 번 뒤집힌다)
      const t = MODEL.time, lv = (t % 18) / 18, fl = S.flash;
      ctx.fillStyle = F3('#8a7a5a'); ctx.beginPath(); roundRectPath(ctx, -16 * s, -10 * s, 32 * s, 10 * s, 2 * s); ctx.fill();   // 받침
      ctx.fillStyle = F3('#6a5a3a'); ctx.fillRect(-12 * s, -14 * s, 24 * s, 4 * s);
      const top = -62 * s, mid = -38 * s, bot = -14 * s, w = 13 * s;
      ctx.fillStyle = fl ? '#fff' : 'rgba(220,240,255,.35)';                                                         // 유리
      ctx.beginPath(); ctx.moveTo(-w, top); ctx.quadraticCurveTo(-w, mid - 6 * s, -2 * s, mid); ctx.quadraticCurveTo(-w, mid + 6 * s, -w, bot);
      ctx.lineTo(w, bot); ctx.quadraticCurveTo(w, mid + 6 * s, 2 * s, mid); ctx.quadraticCurveTo(w, mid - 6 * s, w, top); ctx.closePath(); ctx.fill();
      if (!fl) {
        ctx.fillStyle = col;                                                                                          // 위쪽 모래 (줄어든다)
        const th = (1 - lv) * 18 * s; ctx.beginPath(); ctx.moveTo(-w * 0.8 * (1 - lv * 0.6), mid - 4 * s - th); ctx.lineTo(w * 0.8 * (1 - lv * 0.6), mid - 4 * s - th); ctx.lineTo(1 * s, mid - 1 * s); ctx.lineTo(-1 * s, mid - 1 * s); ctx.closePath(); ctx.fill();
        const bh = lv * 18 * s; ctx.beginPath(); ctx.moveTo(-w * 0.95, bot); ctx.lineTo(w * 0.95, bot); ctx.lineTo(w * 0.5, bot - bh); ctx.quadraticCurveTo(0, bot - bh - 5 * s, -w * 0.5, bot - bh); ctx.closePath(); ctx.fill();   // 아래쪽 모래 (쌓인다)
        ctx.fillRect(-0.6 * s, mid, 1.2 * s, bot - mid - bh);                                                          // 흐르는 모래줄기
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-w * 0.7, top + 4 * s, 2 * s, 14 * s);
      }
      ctx.fillStyle = F3(tun); ctx.fillRect(-w - 4 * s, top - 5 * s, (w + 4 * s) * 2, 5 * s); ctx.fillRect(-w - 4 * s, bot, (w + 4 * s) * 2, 4 * s);   // 위아래 판
      ctx.fillStyle = F3(acc); for (const d of [-1, 1]) ctx.fillRect(d * (w + 2 * s) - 1.6 * s, top - 2 * s, 3.2 * s, bot - top + 4 * s);   // 금 기둥
      ctx.beginPath(); ctx.arc(0, top - 8 * s, 4 * s, 0, 7); ctx.fill();
      if (!fl && S.live) x3Glow(S, 0, top - 8 * s, 5 * s, acc, 0.35 + 0.2 * Math.sin(t * 3));
      break;
    }
    case 'jackalgod': {                                        // 심판의 아누비스: 검은 자칼 머리 · 곧은 귀 · 금 줄무늬 네메스 · 금 목걸이 · 와스 지팡이 · 심판의 저울
      const t = MODEL.time, live = S.live && !S.flash;
      cape(S, -1, tun, 1.3);
      legs(S); torso(S, 6 * s);
      ctx.fillStyle = F3('#f0e8d0'); ctx.beginPath(); ctx.moveTo(-10 * s, -26 * s); ctx.lineTo(10 * s, -26 * s); ctx.lineTo(13 * s, -12 * s); ctx.lineTo(-13 * s, -12 * s); ctx.closePath(); ctx.fill();   // 흰 치마
      ctx.fillStyle = F3(tun); ctx.fillRect(-3 * s, -26 * s, 6 * s, 14 * s);
      ctx.fillStyle = F3(acc); ctx.beginPath(); ctx.ellipse(0, -41 * s, 12 * s, 5 * s, 0, 0, Math.PI); ctx.fill();   // 금 목걸이
      if (!S.flash) { ctx.strokeStyle = tun; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.ellipse(0, -41 * s, 9 * s, 3 * s, 0, 0.3, Math.PI - 0.3); ctx.stroke(); }
      ctx.fillStyle = F3(acc); for (const d of [-1, 1]) { ctx.fillRect(d * 10 * s - 2 * s, -36 * s, 4 * s, 3 * s); }
      // 자칼 머리
      ctx.fillStyle = F3(acc); ctx.beginPath(); ctx.moveTo(-10 * s, -38 * s); ctx.lineTo(-9 * s, -55 * s); ctx.lineTo(4 * s, -55 * s); ctx.lineTo(6 * s, -40 * s); ctx.closePath(); ctx.fill();   // 네메스 (뒤로 늘어진 두건)
      if (!S.flash) { ctx.fillStyle = tun; for (let i = 0; i < 4; i++) ctx.fillRect(-10 * s + i * 0.3 * s, -52 * s + i * 4 * s, 13 * s, 1.6 * s); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(1 * s, -52 * s, 8 * s, 7 * s, 0, 0, 7); ctx.fill();   // 머리
      ctx.beginPath(); ctx.moveTo(4 * s, -56 * s); ctx.lineTo(19 * s, -50 * s); ctx.lineTo(18 * s, -46.5 * s); ctx.lineTo(5 * s, -46 * s); ctx.closePath(); ctx.fill();   // 긴 주둥이
      for (const ex of [-4, 2]) { ctx.beginPath(); ctx.moveTo(ex * s, -57 * s); ctx.lineTo((ex + 2) * s, -74 * s); ctx.lineTo((ex + 6) * s, -57 * s); ctx.closePath(); ctx.fill(); }   // 곧은 귀
      if (!S.flash) { ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(4 * s, -71 * s); ctx.lineTo(5.5 * s, -60 * s); ctx.lineTo(7 * s, -60 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.ellipse(7 * s, -54 * s, 2 * s, 1 * s, -0.2, 0, 7); ctx.fill(); if (live) x3Glow(S, 7 * s, -54 * s, 2.4 * s, '#ffe08a', 0.5 + atk * 0.3); }
      if (!S.flash) {                                          // 다른 손: 심판의 저울
        const tip = Math.sin(t * 1.4) * 0.25;
        ctx.save(); ctx.translate(-20 * s, -26 * s);
        line(S, 6 * s, -10 * s, 0, -2 * s, 2.4 * s, col);                                                     // 저울을 든 팔
        ctx.strokeStyle = acc; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -14 * s); ctx.stroke();
        ctx.rotate(tip); ctx.beginPath(); ctx.moveTo(-10 * s, -14 * s); ctx.lineTo(10 * s, -14 * s); ctx.stroke();
        for (const d of [-1, 1]) { ctx.save(); ctx.translate(d * 10 * s, -14 * s); ctx.rotate(-tip);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-3 * s, 7 * s); ctx.moveTo(0, 0); ctx.lineTo(3 * s, 7 * s); ctx.stroke();
          ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(0, 7.5 * s, 4.5 * s, 1.6 * s, 0, 0, Math.PI); ctx.fill();
          if (d > 0) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 5.4 * s, 2 * s, 1 * s, 0.3, 0, 7); ctx.fill(); }   // 깃털
          else { ctx.fillStyle = '#d83a3a'; ctx.beginPath(); ctx.arc(0, 5.6 * s, 1.8 * s, 0, 7); ctx.fill(); }   // 심장
          ctx.restore(); }
        ctx.restore();
      }
      armWeapon(S, -1.3 + atk * 2.2, () => {                   // 와스 지팡이
        line(S, -18 * s, 0, 48 * s, 0, 3 * s, F3(acc));
        ctx.fillStyle = F3(acc); ctx.beginPath(); ctx.moveTo(48 * s, -2 * s); ctx.lineTo(54 * s, -8 * s); ctx.lineTo(58 * s, -6 * s); ctx.lineTo(52 * s, 2 * s); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = F3(acc); ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(-18 * s, 0); ctx.lineTo(-22 * s, -4 * s); ctx.moveTo(-18 * s, 0); ctx.lineTo(-22 * s, 4 * s); ctx.stroke();
        if (live && atk > 0.2) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.3 * atk; ctx.fillStyle = acc;
          ctx.beginPath(); ctx.moveTo(10 * s, 0); ctx.arc(10 * s, 0, 56 * s, -1.1 * atk, 0.25); ctx.closePath(); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      }, 8 * s);
      break;
    }
    case 'irontrain': {                                        // 폭주 기관차: 보일러 · 굴뚝 연기 · 연결봉으로 도는 큰 바퀴 · 소 밀어내기 · 전조등
      const t = MODEL.time, mv = S.moving, roll = mv ? t * 9 : 0, live = S.live && !S.flash, hq = MODEL.ink && !S.flash;
      const iron = col, red = F3('#a82a2a'), brass = F3('#d8a83a');
      if (live) for (let i = 0; i < 4; i++) {                  // 굴뚝 연기 (빠를수록 뒤로 눕는다)
        const q = (t * (mv ? 1.6 : 0.7) + i / 4) % 1;
        x3Puff(S, (20 - q * 46) * s, (-62 - q * 30) * s, (3 + q * 9) * s, (1 - q) * 0.6, i % 2 ? '#6a6660' : '#9a948a');
      }
      ctx.fillStyle = F3('#26262a'); ctx.fillRect(-44 * s, -14 * s, 84 * s, 4 * s);                                  // 받침
      ctx.fillStyle = iron; ctx.beginPath(); roundRectPath(ctx, -14 * s, -42 * s, 44 * s, 26 * s, 12 * s); ctx.fill();    // 보일러
      for (const x of [-4, 10, 22]) { ctx.fillStyle = brass; ctx.fillRect(x * s, -42 * s, 2.4 * s, 26 * s); }          // 놋쇠 띠
      ctx.fillStyle = red; ctx.fillRect(-46 * s, -50 * s, 34 * s, 36 * s);                                             // 운전실
      ctx.fillStyle = F3('#3a1a1a'); ctx.fillRect(-48 * s, -54 * s, 38 * s, 5 * s);
      ctx.fillStyle = F3('#ffcf6a'); ctx.fillRect(-40 * s, -45 * s, 11 * s, 11 * s);                                   // 창 (불빛)
      if (live) x3Glow(S, -34 * s, -39 * s, 5 * s, '#ffb03c', 0.25);
      ctx.fillStyle = iron; ctx.fillRect(16 * s, -60 * s, 9 * s, 20 * s); ctx.fillStyle = F3('#1e1e22'); ctx.fillRect(14 * s, -64 * s, 13 * s, 5 * s);   // 굴뚝
      ctx.fillStyle = brass; ctx.beginPath(); ctx.arc(4 * s, -44 * s, 4 * s, Math.PI, 0); ctx.fill();                        // 증기 돔
      ctx.fillStyle = F3('#2a2a2e');                            // 소 밀어내기 (앞의 쐐기)
      ctx.beginPath(); ctx.moveTo(32 * s, -20 * s); ctx.lineTo(46 * s, -2 * s); ctx.lineTo(30 * s, -2 * s); ctx.closePath(); ctx.fill();
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = '#5a5a60'; ctx.lineWidth = 1 * s;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo((33 + i * 3) * s, -18 * s + i * 4 * s); ctx.lineTo((32 + i * 3) * s, -2 * s); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-12 * s, -40 * s, 40 * s, 3 * s);
        ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = F3('#fff2c0'); ctx.beginPath(); ctx.arc(31 * s, -32 * s, 4.4 * s, 0, 7); ctx.fill();                    // 전조등
      if (live) { x3Glow(S, 31 * s, -32 * s, 5 * s, '#fff2c0', 0.6);
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.14; ctx.fillStyle = '#fff2c0';
        ctx.beginPath(); ctx.moveTo(31 * s, -35 * s); ctx.lineTo(110 * s, -46 * s); ctx.lineTo(110 * s, -10 * s); ctx.lineTo(31 * s, -29 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false; }
      for (const wx of [-30, -6, 16]) x3Wheel(S, wx * s, -9 * s, (wx === 16 ? 7 : 9) * s, roll, '#1e1e22', '#a82a2a');       // 바퀴
      const cr = Math.cos(roll) * 5 * s, sr = Math.sin(roll) * 5 * s;                                                     // 연결봉
      line(S, -30 * s + cr, -9 * s + sr, -6 * s + cr, -9 * s + sr, 2.4 * s, F3('#c8ccd4'));
      line(S, -6 * s + cr, -9 * s + sr, 12 * s, -20 * s, 2 * s, F3('#c8ccd4'));
      break;
    }
    case 'coalstoker': {                                       // 화부: 그을음 · 작업모 · 숯불 실린 삽
      legs(S); torso(S, 5 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-5 * s, -44 * s, 10 * s, 8 * s); ctx.restore(); ctx._skipInk = false; }
      head(S, 'kepi');
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(3 * s, -47 * s, 4 * s, 0, 7); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      armWeapon(S, -1.2 + atk * 2, () => {
        line(S, 0, 0, 22 * s, 0, 2.6 * s, F3('#6a4a2a'));
        ctx.fillStyle = F3('#4a4c54'); ctx.beginPath(); ctx.moveTo(20 * s, -5 * s); ctx.lineTo(32 * s, -6 * s); ctx.lineTo(32 * s, 6 * s); ctx.lineTo(20 * s, 5 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) { ctx.fillStyle = '#ff7a2a'; for (const [x, y] of [[24, -2], [28, 1], [26, 3]]) { ctx.beginPath(); ctx.arc(x * s, y * s, 1.8 * s, 0, 7); ctx.fill(); }
          if (S.live) x3Glow(S, 26 * s, 0, 4 * s, '#ff9a3a', 0.45); }
      }, 6 * s);
      break;
    }
    case 'handcar': {                                          // 수동차 포대: 레일 위 손수레 · 시소 손잡이를 누르는 둘 · 작은 대포
      const t = MODEL.time, pump = Math.sin(t * (S.moving ? 6 : 1.5)) * 0.35, roll = S.moving ? t * 6 : 0;
      ctx.fillStyle = F3('#5a4a3a'); ctx.fillRect(-26 * s, -16 * s, 52 * s, 7 * s);
      x3Wheel(S, -16 * s, -7 * s, 6 * s, roll, '#26262a', '#8a8a90'); x3Wheel(S, 16 * s, -7 * s, 6 * s, roll, '#26262a', '#8a8a90');
      ctx.fillStyle = F3('#3a3a42'); ctx.fillRect(-2 * s, -30 * s, 4 * s, 14 * s);
      ctx.save(); ctx.translate(0, -30 * s); ctx.rotate(pump); ctx.fillStyle = F3('#6a6a70'); ctx.fillRect(-18 * s, -2 * s, 36 * s, 3.4 * s); ctx.restore();
      for (const d of [-1, 1]) {                                 // 손잡이를 누르는 일꾼 둘
        const O = sub(S, 0.62, 2.6 * s);
        ctx.save(); ctx.translate(d * 14 * s, -14 * s + (d * pump) * 6 * s);
        torso(O); head(O, d < 0 ? 'kepi' : 'cap'); arm(O, -d * 6 * O.s, -36 * O.s);
        ctx.restore();
      }
      ctx.save(); ctx.translate(14 * s, -22 * s); ctx.rotate(-0.25 - atk * 0.2);       // 대포
      ctx.fillStyle = F3('#2a2a2e'); ctx.fillRect(-2 * s, -3.5 * s, 22 * s, 7 * s); ctx.fillStyle = acc; ctx.fillRect(18 * s, -4.5 * s, 4 * s, 9 * s);
      ctx.restore();
      break;
    }

    /* ---------------------- 4.6 도전 '그림자 가면무도회' ---------------------- */
    case 'masklord': {                                         // 가면 군주: 높은 모자 · 반은 웃고 반은 우는 큰 가면 · 떠도는 가면 셋 · 보랏빛 망토
      const t = MODEL.time, live = S.live && !S.flash, hov = Math.sin(t * 2) * 3 * s;
      ctx.save(); ctx.translate(0, hov - 6 * s);
      cape(S, -1, tun, 1.5);
      robe(S, 20 * s, -48 * s, col);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc;          // 옷의 마름모 무늬
        for (let i = 0; i < 5; i++) { const x = (-10 + i * 5) * s, y = (-20 + (i % 2) * 8) * s; ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.lineTo(x + 2 * s, y); ctx.lineTo(x, y + 3 * s); ctx.lineTo(x - 2 * s, y); ctx.closePath(); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = F3('#1a1420'); ctx.fillRect(-9 * s, -78 * s, 18 * s, 18 * s); ctx.fillRect(-14 * s, -62 * s, 28 * s, 4 * s);   // 높은 모자
      ctx.fillStyle = acc; ctx.fillRect(-9 * s, -66 * s, 18 * s, 3 * s);
      ctx.fillStyle = F3('#f4f0f8');                            // 큰 가면 (반쪽 흰)
      ctx.beginPath(); ctx.moveTo(-9 * s, -58 * s); ctx.quadraticCurveTo(0, -61 * s, 11 * s, -58 * s); ctx.quadraticCurveTo(13 * s, -46 * s, 6 * s, -40 * s); ctx.quadraticCurveTo(0, -38 * s, -6 * s, -40 * s); ctx.quadraticCurveTo(-11 * s, -48 * s, -9 * s, -58 * s); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = '#2a1a3a'; ctx.beginPath(); ctx.moveTo(1 * s, -60 * s); ctx.quadraticCurveTo(-11 * s, -48 * s, -6 * s, -40 * s); ctx.quadraticCurveTo(0, -38 * s, 1 * s, -39 * s); ctx.closePath(); ctx.fill();   // 검은 반쪽
        ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(5 * s, -52 * s, 2.6 * s, 1.6 * s, -0.3, 0, 7); ctx.fill();          // 웃는 눈
        ctx.beginPath(); ctx.ellipse(-4 * s, -52 * s, 2.4 * s, 1.4 * s, 0.3, 0, 7); ctx.fill();                                  // 우는 눈
        ctx.strokeStyle = '#2a1a3a'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.arc(5 * s, -47 * s, 3 * s, 0.2, Math.PI - 0.6); ctx.stroke();
        ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(-4 * s, -43 * s, 2.6 * s, Math.PI + 0.5, -0.4); ctx.stroke();
        ctx.fillStyle = acc; ctx.fillRect(-5 * s, -50 * s, 1 * s, 4 * s);                                                       // 눈물
        ctx.restore(); ctx._skipInk = false;
        if (live) { x3Glow(S, 5 * s, -52 * s, 2.4 * s, acc, 0.5); x3Glow(S, -4 * s, -52 * s, 2.2 * s, acc, 0.4); }
      }
      armWeapon(S, -1.3 + atk * 1.2, () => {                    // 지팡이 끝의 작은 가면
        line(S, 0, 0, 28 * s, 0, 2.6 * s, F3('#1a1420'));
        ctx.fillStyle = F3('#f4f0f8'); ctx.beginPath(); ctx.ellipse(32 * s, 0, 5 * s, 6 * s, 0, 0, 7); ctx.fill();
        if (!S.flash) { ctx.fillStyle = '#2a1a3a'; ctx.fillRect(30 * s, -2 * s, 1.6 * s, 1.6 * s); ctx.fillRect(33 * s, -2 * s, 1.6 * s, 1.6 * s);
          if (live) x3Glow(S, 32 * s, 0, 6 * s, acc, 0.3 + atk * 0.5); }
      }, 8 * s);
      ctx.restore();
      if (live) for (let i = 0; i < 3; i++) {                    // 떠도는 가면 셋
        const a = t * 1.2 + i * 2.094, mx = Math.cos(a) * 30 * s, my = -60 * s + Math.sin(a) * 12 * s;
        ctx.fillStyle = i === 0 ? '#f4f0f8' : i === 1 ? acc : '#ffd23a';
        ctx.beginPath(); ctx.ellipse(mx, my, 4 * s, 5 * s, Math.sin(a) * 0.3, 0, 7); ctx.fill();
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#2a1a3a'; ctx.fillRect(mx - 2.4 * s, my - 1.4 * s, 1.6 * s, 1.4 * s); ctx.fillRect(mx + 0.8 * s, my - 1.4 * s, 1.6 * s, 1.4 * s); ctx.restore(); ctx._skipInk = false;
      }
      break;
    }
    case 'dancer': {                                           // 가면 무희: 퍼지는 치마 · 눈가면 · 두 부채칼 · 빙글 도는 춤
      const t = MODEL.time, spin = S.moving ? Math.sin(phase * 2) * 0.25 : Math.sin(t * 3) * 0.12;
      legs(S);
      ctx.save(); ctx.translate(0, -22 * s); ctx.rotate(spin * 0.5);
      ctx.fillStyle = tun;                                      // 치마
      ctx.beginPath(); ctx.moveTo(-6 * s, -8 * s); ctx.lineTo(6 * s, -8 * s); ctx.quadraticCurveTo(20 * s + spin * 20 * s, 4 * s, 14 * s, 8 * s); ctx.lineTo(-14 * s, 8 * s); ctx.quadraticCurveTo(-20 * s + spin * 20 * s, 4 * s, -6 * s, -8 * s); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc((-11 + i * 5.5) * s, 6.5 * s, 1.6 * s, 0, 7); ctx.fill(); } ctx.restore(); ctx._skipInk = false; }
      ctx.restore();
      torso(S, 4 * s); head(S, 'bald', 7.5 * s);
      ctx.fillStyle = F3('#1a1420'); ctx.beginPath(); ctx.ellipse(3 * s, -51 * s, 7 * s, 2.6 * s, 0, 0, 7); ctx.fill();         // 눈가면
      if (!S.flash) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(5 * s, -51 * s, 1.2 * s, 0, 7); ctx.fill(); tri(S, -3 * s, -52 * s, -9 * s, -62 * s, -1 * s, -54 * s, acc); }
      for (const [d, ang] of [[1, -0.6 + atk * 2], [-1, 0.6 - atk * 1.4 + spin]]) {         // 부채칼
        ctx.save(); ctx.translate(d * 8 * s, -36 * s); ctx.rotate(ang);
        ctx.fillStyle = S.flash ? '#fff' : (d > 0 ? acc : shade(acc, -0.2));
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 13 * s, -0.5, 0.5); ctx.closePath(); ctx.fill();
        if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.8 * s; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 0.22) * 13 * s, Math.sin(i * 0.22) * 13 * s); ctx.stroke(); } ctx.restore(); ctx._skipInk = false; }
        ctx.restore();
      }
      break;
    }
    case 'jester': {                                           // 광대 폭탄꾼: 방울 달린 두 갈래 모자 · 마름모 옷 · 불붙은 폭죽 공
      const t = MODEL.time;
      legs(S); torso(S, 5 * s);
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc;
        for (const [x, y] of [[-3, -40], [3, -34], [-3, -28]]) { ctx.beginPath(); ctx.moveTo(x * s, (y - 3) * s); ctx.lineTo((x + 2.4) * s, y * s); ctx.lineTo(x * s, (y + 3) * s); ctx.lineTo((x - 2.4) * s, y * s); ctx.closePath(); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      head(S, 'bald', 8 * s);
      if (!S.flash) { ctx.fillStyle = '#fbf4ee'; ctx.beginPath(); ctx.arc(2 * s, -50 * s, 6.4 * s, 0, 7); ctx.fill();           // 하얀 분칠
        ctx.fillStyle = '#e8303a'; ctx.beginPath(); ctx.arc(7 * s, -49 * s, 1.8 * s, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(4 * s, -52 * s, 1 * s, 0, 7); ctx.fill(); }
      for (const [d, c] of [[-1, tun], [1, acc]]) {             // 두 갈래 모자 · 방울
        const sway = Math.sin(t * 4 + d) * 2 * s;
        ctx.fillStyle = S.flash ? '#fff' : c; ctx.beginPath(); ctx.moveTo(-7 * s, -56 * s); ctx.lineTo(7 * s, -56 * s);
        ctx.quadraticCurveTo(d * 10 * s, -66 * s, d * 16 * s + sway, -62 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = F3('#ffd23a'); ctx.beginPath(); ctx.arc(d * 16 * s + sway, -61 * s, 2.2 * s, 0, 7); ctx.fill();
      }
      armWeapon(S, -1.6 + atk * 1.8, () => {                    // 폭죽 공
        ctx.fillStyle = F3('#2a2a3a'); ctx.beginPath(); ctx.arc(8 * s, 0, 6 * s, 0, 7); ctx.fill();
        if (!S.flash) { ctx.fillStyle = acc; ctx.fillRect(4 * s, -1 * s, 8 * s, 2 * s);
          ctx.strokeStyle = '#c8b090'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(8 * s, -6 * s); ctx.quadraticCurveTo(10 * s, -10 * s, 7 * s, -12 * s); ctx.stroke();
          if (S.live) x3Glow(S, 7 * s, -12.5 * s, 1.8 * s, '#ffd23a', 0.7 + Math.sin(t * 20) * 0.3); }
      }, 4 * s);
      break;
    }

    /* ---------------------- 4.9 시즌 '벚꽃 전국' ---------------------- */
    case 'susanoo': {                                          // 스사노오: 귀 옆으로 묶은 머리 · 푸른 바람 띠 · 넓은 검 · 등 뒤로 감도는 폭풍
      const t = MODEL.time;
      if (!S.flash && S.live) {                                // 몸을 감도는 바람 띠
        ctx.save(); ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 1.6 * s;
        for (let i = 0; i < 3; i++) { const a = t * 2.4 + i * 2.1;
          ctx.globalAlpha = 0.35 + 0.2 * Math.sin(a);
          ctx.beginPath(); ctx.ellipse(0, -36 * s + i * 8 * s, (22 + i * 3) * s, 5 * s, 0, a, a + 2.2); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false;
      }
      cape(S, -1, tun, 1.35);
      legs(S); torso(S, 5.4 * s);
      ctx.fillStyle = F3('#f4f0e6');                          // 흰 웃옷 · 매듭 띠
      ctx.beginPath(); ctx.moveTo(-8 * s, -44 * s); ctx.lineTo(8 * s, -44 * s); ctx.lineTo(10 * s, -24 * s); ctx.lineTo(-10 * s, -24 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(tun); ctx.fillRect(-10 * s, -29 * s, 20 * s, 4 * s);
      head(S, 'bald');
      ctx.fillStyle = F3('#1a1a22');                          // 미즈라: 귀 옆 고리 머리 · 정수리 머리
      ctx.beginPath(); ctx.arc(0, -56 * s, 7 * s, Math.PI, 0); ctx.fill();
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * 9 * s, -47 * s, 3 * s, 5 * s, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = F3(acc); ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(-7 * s, -58 * s); ctx.lineTo(7 * s, -58 * s); ctx.stroke();
      armWeapon(S, -1.3 + atk * 2.1, () => {                   // 넓은 검 (도츠카노츠루기)
        line(S, -6 * s, 0, 8 * s, 0, 4 * s, F3('#3a2a1a'));
        ctx.fillStyle = F3('#e8eef4'); ctx.beginPath();
        ctx.moveTo(8 * s, -3.4 * s); ctx.lineTo(58 * s, -2 * s); ctx.lineTo(64 * s, 0); ctx.lineTo(58 * s, 2 * s); ctx.lineTo(8 * s, 3.4 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = F3(acc); ctx.fillRect(7 * s, -6 * s, 3 * s, 12 * s);
        if (!S.flash && S.live && atk > 0.2) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.3 * atk; ctx.fillStyle = acc;
          ctx.beginPath(); ctx.moveTo(8 * s, 0); ctx.arc(8 * s, 0, 58 * s, -1 * atk, 0.2); ctx.closePath(); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      }, 8 * s);
      break;
    }
    case 'tengu': {                                            // 텐구: 붉은 얼굴 · 긴 코 · 검은 깃 날개 · 도키에 모자 · 깃털 부채
      const t = MODEL.time, flap = Math.sin(t * (S.moving ? 9 : 3)) * (S.moving ? 0.25 : 0.1);
      for (const d of [0, 1]) {                                // 검은 날개 둘 (뒤 · 앞)
        ctx.save(); ctx.translate(-4 * s, -40 * s); ctx.rotate(-0.5 - flap - d * 0.2);
        ctx.fillStyle = F3(d ? '#1e1e24' : '#2e2e36');
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let i = 0; i <= 5; i++) { const a = -Math.PI * 0.9 + i * 0.22, L = (28 - i * 2) * s; ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.lineTo(Math.cos(a + 0.11) * L * 0.7, Math.sin(a + 0.11) * L * 0.7); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      legs(S); torso(S, 5 * s);
      ctx.fillStyle = F3(tun); ctx.beginPath(); ctx.moveTo(-9 * s, -44 * s); ctx.lineTo(9 * s, -44 * s); ctx.lineTo(11 * s, -22 * s); ctx.lineTo(-11 * s, -22 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3('#f0e8d8'); for (const y of [-40, -34, -28]) { ctx.beginPath(); ctx.arc(0, y * s, 1.6 * s, 0, 7); ctx.fill(); }   // 방울 술 (본텐)
      head(S, 'bald');
      ctx.fillStyle = F3(col); ctx.beginPath(); ctx.moveTo(6 * s, -51 * s); ctx.lineTo(19 * s, -49 * s); ctx.lineTo(6 * s, -47 * s); ctx.closePath(); ctx.fill();   // 긴 코
      ctx.fillStyle = F3('#1a1a1e'); ctx.beginPath(); roundRectPath(ctx, -3 * s, -64 * s, 7 * s, 6 * s, 1.4 * s); ctx.fill();   // 도키에 (작은 검은 모자)
      ctx.fillStyle = F3('#f0f0f0'); ctx.beginPath(); ctx.moveTo(-8 * s, -56 * s); ctx.quadraticCurveTo(-12 * s, -48 * s, -9 * s, -42 * s); ctx.lineTo(-6 * s, -50 * s); ctx.closePath(); ctx.fill();   // 흰 갈기
      if (!S.flash) { ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(4 * s, -52 * s, 1.3 * s, 0, 7); ctx.fill(); }
      armWeapon(S, -0.6 + atk * 1.6, () => {                   // 깃털 부채
        line(S, 0, 0, 12 * s, 0, 2.4 * s, F3('#5a3a2a'));
        for (let i = 0; i < 7; i++) { const a = -0.75 + i * 0.25; ctx.fillStyle = F3(i % 2 ? acc : '#ffffff');
          ctx.beginPath(); ctx.ellipse(12 * s + Math.cos(a) * 9 * s, Math.sin(a) * 9 * s, 7 * s, 2.4 * s, a, 0, 7); ctx.fill(); }
      }, 6 * s);
      break;
    }
    case 'ninja': {                                            // 닌자: 검은 복면 · 이마 띠 · 목도리 끝 · 거꾸로 쥔 단도 둘
      const t = MODEL.time;
      legs(S); torso(S, 4 * s);
      ctx.fillStyle = F3(tun); ctx.fillRect(-6 * s, -43 * s, 12 * s, 18 * s);
      ctx.fillStyle = F3('#5a4a6a'); ctx.fillRect(-7 * s, -30 * s, 14 * s, 3 * s);
      head(S, 'bald');
      ctx.fillStyle = F3('#1c1c24'); ctx.beginPath(); ctx.arc(0, -50 * s, 9.2 * s, 0, 7); ctx.fill();   // 복면
      ctx.fillStyle = F3('#e8d8c0'); ctx.fillRect(1 * s, -53 * s, 8 * s, 3 * s);                        // 눈 틈
      if (!S.flash) { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(5 * s, -52.4 * s, 1.6 * s, 1.6 * s); }
      ctx.fillStyle = F3(acc); ctx.fillRect(-9 * s, -57 * s, 18 * s, 2.4 * s);                             // 이마 띠
      const sw = Math.sin(t * 6) * 2 * s + (S.moving ? 4 * s : 0);
      ctx.strokeStyle = F3('#5a4a6a'); ctx.lineWidth = 2.4 * s;                                          // 휘날리는 목도리
      ctx.beginPath(); ctx.moveTo(-4 * s, -42 * s); ctx.quadraticCurveTo(-14 * s, -44 * s - sw, -24 * s - sw, -40 * s + sw * 0.5); ctx.stroke();
      armWeapon(S, 0.9 - atk * 2.2, () => {                    // 거꾸로 쥔 단도
        line(S, -2 * s, 0, 4 * s, 0, 3 * s, F3('#3a2a2a'));
        ctx.fillStyle = F3('#d8dce4'); ctx.beginPath(); ctx.moveTo(4 * s, -2 * s); ctx.lineTo(22 * s, 0); ctx.lineTo(4 * s, 2 * s); ctx.closePath(); ctx.fill();
      }, 4 * s);
      if (!S.flash) { ctx.save(); ctx.translate(-6 * s, -34 * s); ctx.rotate(1.2 + atk);                   // 다른 손의 단도
        ctx.fillStyle = '#c8ccd4'; ctx.beginPath(); ctx.moveTo(0, -1.4 * s); ctx.lineTo(14 * s, 0); ctx.lineTo(0, 1.4 * s); ctx.closePath(); ctx.fill(); ctx.restore(); }
      break;
    }
    case 'miko': {                                             // 무녀: 흰 저고리 · 붉은 하카마 · 긴 검은 머리와 흰 끈 · 방울 지팡이
      const t = MODEL.time;
      ctx.fillStyle = F3('#1a1a22');                          // 등 뒤 긴 머리
      ctx.beginPath(); ctx.moveTo(-6 * s, -56 * s); ctx.quadraticCurveTo(-14 * s, -40 * s, -9 * s, -24 * s); ctx.lineTo(-4 * s, -26 * s); ctx.lineTo(-2 * s, -48 * s); ctx.closePath(); ctx.fill();
      robe(S, 15 * s, -30 * s, acc);                           // 붉은 하카마
      torso(S, 4 * s);
      ctx.fillStyle = F3('#f8f6f0'); ctx.beginPath(); ctx.moveTo(-8 * s, -44 * s); ctx.lineTo(8 * s, -44 * s); ctx.lineTo(10 * s, -28 * s); ctx.lineTo(-10 * s, -28 * s); ctx.closePath(); ctx.fill();
      for (const d of [-1, 1]) { ctx.fillStyle = F3('#f8f6f0'); ctx.beginPath(); ctx.moveTo(d * 8 * s, -42 * s); ctx.lineTo(d * 16 * s, -34 * s); ctx.lineTo(d * 10 * s, -28 * s); ctx.closePath(); ctx.fill(); }   // 넓은 소매
      head(S, 'bald');
      ctx.fillStyle = F3('#1a1a22'); ctx.beginPath(); ctx.arc(0, -51 * s, 9 * s, Math.PI * 0.9, Math.PI * 2.05); ctx.lineTo(9 * s, -47 * s); ctx.lineTo(4 * s, -55 * s); ctx.lineTo(-8 * s, -46 * s); ctx.closePath(); ctx.fill();   // 앞머리
      ctx.fillStyle = F3('#ffffff'); ctx.fillRect(-9 * s, -50 * s, 3 * s, 4 * s);                    // 흰 머리끈
      if (!S.flash) { ctx.fillStyle = '#2a2a2a'; ctx.fillRect(4 * s, -51 * s, 1.6 * s, 1.6 * s); }
      armWeapon(S, -0.35 + atk * 0.5 + Math.sin(t * 6) * 0.08, () => {   // 가구라 방울
        line(S, 0, 4 * s, 4 * s, -30 * s, 2.2 * s, F3('#8a5a2a'));
        for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) { ctx.fillStyle = F3('#e8c65a'); ctx.beginPath(); ctx.arc((4 - i * 3 + j * 6) * s, (-32 + i * 4) * s, 1.8 * s, 0, 7); ctx.fill(); }
        ctx.strokeStyle = F3(acc); ctx.lineWidth = 1.4 * s;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(4 * s, -26 * s); ctx.quadraticCurveTo((8 + i * 3) * s, -18 * s, (6 + i * 4) * s, (-10 + i * 2) * s); ctx.stroke(); }
      }, 6 * s);
      break;
    }
    case 'samurai': {                                          // 사무라이: 투구의 초승달 장식 · 어깨 갑옷 · 붉은 끈 갑옷 · 곧은 칼
      legs(S); torso(S, 5 * s);
      ctx.fillStyle = F3(tun); ctx.beginPath(); roundRectPath(ctx, -9 * s, -44 * s, 18 * s, 20 * s, 3 * s); ctx.fill();   // 갑옷 몸통
      if (!S.flash && MODEL.ink) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1 * s;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-9 * s, (-44 + i * 5) * s); ctx.lineTo(9 * s, (-44 + i * 5) * s); ctx.stroke(); } ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = F3(tun); for (const d of [-1, 1]) { ctx.beginPath(); roundRectPath(ctx, (d > 0 ? 6 : -14) * s, -44 * s, 8 * s, 10 * s, 2 * s); ctx.fill(); }   // 소데 (어깨판)
      head(S, 'bald');
      ctx.fillStyle = F3('#2a2a30'); ctx.beginPath(); ctx.arc(0, -52 * s, 10 * s, Math.PI, 0); ctx.fill();        // 투구
      ctx.fillRect(-12 * s, -52 * s, 24 * s, 3 * s);
      ctx.strokeStyle = F3('#e8c65a'); ctx.lineWidth = 2 * s;                                                 // 쿠와가타 (초승달 장식)
      ctx.beginPath(); ctx.arc(0, -66 * s, 8 * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      armWeapon(S, -1.25 + atk * 2.1, () => {                  // 곧은 칼
        line(S, -6 * s, 0, 6 * s, 0, 3.4 * s, F3('#2a2a2a'));
        ctx.fillStyle = F3('#e8c65a'); ctx.beginPath(); ctx.ellipse(6 * s, 0, 1.4 * s, 3.6 * s, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = F3(acc); ctx.lineWidth = 2.6 * s; ctx.beginPath(); ctx.moveTo(7 * s, 0); ctx.quadraticCurveTo(30 * s, -3 * s, 52 * s, -6 * s); ctx.stroke();
      }, 8 * s);
      break;
    }
    case 'kyudo': {                                            // 궁도가: 흰 저고리 · 검은 하카마 · 키보다 긴 비대칭 활
      robe(S, 14 * s, -30 * s, tun);
      torso(S, 4 * s);
      ctx.fillStyle = F3('#f4f0e6'); ctx.beginPath(); ctx.moveTo(-8 * s, -44 * s); ctx.lineTo(8 * s, -44 * s); ctx.lineTo(9 * s, -28 * s); ctx.lineTo(-9 * s, -28 * s); ctx.closePath(); ctx.fill();
      head(S, 'bald');
      ctx.fillStyle = F3('#1a1a22'); ctx.beginPath(); ctx.arc(0, -53 * s, 8.6 * s, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(-7 * s, -56 * s, 3 * s, 0, 7); ctx.fill();   // 상투
      const pull = S.wind > 0 ? 9 * s * S.wind : 0;
      ctx.strokeStyle = F3('#6a3a1a'); ctx.lineWidth = 2.8 * s;                                    // 긴 활: 위쪽이 더 길다
      ctx.beginPath(); ctx.moveTo(22 * s, -86 * s); ctx.quadraticCurveTo(32 * s, -40 * s, 22 * s, -8 * s); ctx.stroke();
      ctx.strokeStyle = F3('#f0e8d0'); ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(22 * s, -86 * s); ctx.lineTo(20 * s - pull, -40 * s); ctx.lineTo(22 * s, -8 * s); ctx.stroke();
      if (S.wind > 0.05) line(S, 20 * s - pull, -40 * s, 40 * s, -40 * s, 1.4 * s, F3('#d8d0b8'));
      arm(S, 26 * s, -40 * s); arm(S, 20 * s - pull, -40 * s);
      break;
    }
    case 'ashigaru': {                                         // 아시가루: 납작한 진가사 삿갓 · 가벼운 갑옷 · 긴 창
      legs(S); torso(S, 4.4 * s);
      ctx.fillStyle = F3(tun); ctx.fillRect(-7 * s, -43 * s, 14 * s, 17 * s);
      ctx.fillStyle = F3(acc); ctx.fillRect(-7 * s, -36 * s, 14 * s, 2 * s);
      head(S, 'bald');
      ctx.fillStyle = F3('#3a3a40'); ctx.beginPath(); ctx.moveTo(-15 * s, -54 * s); ctx.lineTo(0, -62 * s); ctx.lineTo(15 * s, -54 * s); ctx.lineTo(13 * s, -52 * s); ctx.lineTo(-13 * s, -52 * s); ctx.closePath(); ctx.fill();   // 진가사
      if (!S.flash) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(0, -57 * s, 1.8 * s, 0, 7); ctx.fill(); }
      armWeapon(S, -0.12 + atk * 0.2, () => {                  // 긴 창
        line(S, -20 * s, 0, 58 * s, 0, 2.6 * s, F3('#7a5a34'));
        tri(S, 58 * s, -3 * s, 70 * s, 0, 58 * s, 3 * s, F3('#d8dce4'));
      }, 4 * s);
      break;
    }
    /* ---------------------- 4.18 4진 (궁극) ---------------------- */
    case 'starmerlin': {                                       // 별의 대현자 멀린: 별하늘 망토 · 금실 로브 · 휘어진 초승달 모자 · 은하를 담은 수정 지팡이 · 떠도는 마법서 · 발밑 마법진
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const charge = Math.max(S.wind || 0, atk > 0 ? 1 - atk : 0), pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      const sway = S.live ? Math.sin(S.moving ? phase * 2 : t * 1.5) * (S.moving ? 2.4 : 1.2) * s : 0;
      const gold = '#ffd76a', star = '#fff6c8';
      if (!S.flash) {                                          // 발밑 마법진: 두 겹 고리 · 룬 · 별 꼭짓점 (쏠 때 밝아지며 빨리 돈다)
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        const spin = t * (0.6 + charge * 2.2), a0 = 0.28 + charge * 0.45;
        ctx.globalAlpha = a0; ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * s;
        ctx.beginPath(); ctx.ellipse(0, -1 * s, 30 * s, 7.5 * s, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -1 * s, 22 * s, 5.5 * s, 0, 0, 7); ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) { const a = spin + i * Math.PI * 4 / 5; const px = Math.cos(a) * 22 * s, py = -1 * s + Math.sin(a) * 5.5 * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        ctx.fillStyle = star;
        for (let i = 0; i < 10; i++) { const a = -spin * 0.7 + i * Math.PI / 5; ctx.fillRect(Math.cos(a) * 26 * s - 0.8 * s, -1 * s + Math.sin(a) * 6.5 * s - 0.8 * s, 1.6 * s, 1.6 * s); }
        ctx.restore(); ctx._skipInk = false;
      }
      if (!S.flash) {                                          // 등 뒤 별자리 광배: 천천히 도는 고리와 이어진 별
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        const hx = -2 * s, hy = -54 * s, R0 = 19 * s, rot = t * 0.25;
        ctx.globalAlpha = 0.16 + charge * 0.2; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(hx, hy, R0 * 1.2, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.55; ctx.strokeStyle = gold; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.arc(hx, hy, R0, 0, 7); ctx.stroke();
        const pts = [0, 0.9, 1.7, 2.9, 3.7, 4.6, 5.5].map((a, i) => [hx + Math.cos(a + rot) * R0 * (i % 2 ? 0.78 : 1), hy + Math.sin(a + rot) * R0 * (i % 2 ? 0.78 : 1)]);
        ctx.globalAlpha = 0.45; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        ctx.fillStyle = star; pts.forEach(([x, y], i) => { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + i * 1.7); ctx.beginPath(); ctx.arc(x, y, (i % 3 ? 1.1 : 1.7) * s, 0, 7); ctx.fill(); });
        ctx.restore(); ctx._skipInk = false;
      }
      // 별하늘 망토 (뒤로 길게 나부낀다)
      ctx.fillStyle = F3('#141640');
      ctx.beginPath(); ctx.moveTo(-6 * s, -44 * s); ctx.quadraticCurveTo(-22 * s - sway * 2, -24 * s, -27 * s - sway * 3, 0);
      ctx.lineTo(-4 * s, 0); ctx.closePath(); ctx.fill();
      if (hq) { ctx.save(); ctx._skipInk = true;
        ctx.strokeStyle = gold; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(-6 * s, -44 * s); ctx.quadraticCurveTo(-22 * s - sway * 2, -24 * s, -27 * s - sway * 3, 0); ctx.stroke();
        for (let i = 0; i < 9; i++) { const u = _h(i * 3.1), v = _h(i * 7.7); ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
          ctx.fillStyle = star; ctx.fillRect((-8 - u * 16 - v * 2) * s - sway * 2 * v, (-38 + v * 34) * s, 1.3 * s, 1.3 * s); }
        ctx.restore(); ctx._skipInk = false; }
      robe(S, 21 * s, -47 * s, tun);                           // 금실 로브
      if (!S.flash) {
        ctx.save(); ctx._skipInk = !hq;
        ctx.fillStyle = gold; ctx.beginPath(); ctx.moveTo(-1.6 * s, -44 * s); ctx.lineTo(1.6 * s, -44 * s); ctx.lineTo(3.4 * s, -1 * s); ctx.lineTo(-3.4 * s, -1 * s); ctx.closePath(); ctx.fill();   // 앞섶 금띠
        ctx.strokeStyle = gold; ctx.lineWidth = 1.6 * s;        // 밑단 금실 물결
        ctx.beginPath(); for (let i = 0; i <= 12; i++) { const x = -19 * s + i * 3.2 * s + sway * 0.6, y = -2.5 * s - Math.abs(Math.sin(i * 1.2 + t * 2)) * 1.6 * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
        for (const [x0, y0, k] of [[-10, -30, 0], [8, -22, 1], [-6, -14, 2], [11, -36, 3], [-13, -8, 4]]) {   // 별 · 초승달 자수 (반짝인다)
          const tw = 0.55 + 0.45 * Math.sin(t * 3 + k * 1.9);
          ctx.globalAlpha = tw; ctx.fillStyle = k % 2 ? gold : star;
          if (k === 1) { ctx.beginPath(); ctx.arc(x0 * s, y0 * s, 2.6 * s, 0.6, 5.7); ctx.arc(x0 * s + 1.2 * s, y0 * s, 2 * s, 5.7, 0.6, true); ctx.fill(); }
          else { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = (i % 2 ? 0.7 : 2.2) * s; ctx.lineTo(x0 * s + Math.cos(a) * rr, y0 * s + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#6a3aa8'; ctx.fillRect(-11 * s, -28 * s, 22 * s, 3 * s);   // 허리띠 · 보석
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(0, -26.5 * s, 2.2 * s, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, 0, -26.5 * s, 2.4 * s, acc, 0.35 + pulse * 0.25);
      }
      for (const d of [-1, 1]) {                               // 넓은 소매
        ctx.fillStyle = F3(tun); ctx.beginPath(); ctx.moveTo(d * 7 * s, -43 * s); ctx.quadraticCurveTo(d * 17 * s, -36 * s, d * 15 * s, -27 * s); ctx.lineTo(d * 9 * s, -30 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) { ctx.strokeStyle = gold; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(d * 15 * s, -27 * s); ctx.lineTo(d * 9 * s, -30 * s); ctx.stroke(); }
      }
      head(S, 'bald', 8 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#f2efe8';            // 길게 흩날리는 흰 수염 · 콧수염
      ctx.beginPath(); ctx.moveTo(-3 * s, -47 * s); ctx.quadraticCurveTo(10 * s, -47 * s, 10 * s, -45 * s);
      ctx.quadraticCurveTo(9 * s + sway, -32 * s, 4 * s + sway * 1.6, -21 * s); ctx.quadraticCurveTo(0, -33 * s, -3 * s, -47 * s); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5 * s, -46.5 * s, 5 * s, 1.6 * s, -0.15, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#e8e4dc'; ctx.beginPath(); ctx.moveTo(-8 * s, -50 * s); ctx.quadraticCurveTo(-11 * s, -42 * s, -9 * s, -36 * s); ctx.lineTo(-6 * s, -44 * s); ctx.closePath(); ctx.fill();   // 뒷머리
      if (!S.flash) { ctx.fillStyle = '#e8e4dc'; ctx.fillRect(2 * s, -54.6 * s, 7 * s, 1.6 * s);          // 흰 눈썹 · 빛나는 눈
        ctx.fillStyle = charge > 0.2 ? gold : '#2b2118'; ctx.beginPath(); ctx.arc(5.5 * s, -51.8 * s, 1.1 * s, 0, 7); ctx.fill();
        if (live && charge > 0.2) x3Glow(S, 5.5 * s, -51.8 * s, 1.6 * s, gold, charge * 0.7); }
      {                                                        // 초승달 모자: 넓은 챙 · 뒤로 휘어 꺾인 끝 · 금띠 · 매달린 별
        const tipX = -12 * s - sway * 1.5, tipY = -98 * s + Math.sin(t * 1.8) * 1.5 * s;
        ctx.fillStyle = F3(tun);
        ctx.beginPath(); ctx.ellipse(0, -57 * s, 16 * s, 3.6 * s, -0.05, 0, 7); ctx.fill();          // 챙
        ctx.beginPath(); ctx.moveTo(-10 * s, -58 * s); ctx.quadraticCurveTo(-6 * s, -76 * s, 2 * s, -84 * s);
        ctx.quadraticCurveTo(-2 * s, -92 * s, tipX, tipY); ctx.quadraticCurveTo(4 * s, -88 * s, 7 * s, -80 * s);
        ctx.quadraticCurveTo(9 * s, -68 * s, 10 * s, -58 * s); ctx.closePath(); ctx.fill();
        if (!S.flash) {
          ctx.fillStyle = gold; ctx.beginPath(); ctx.moveTo(-10 * s, -59 * s); ctx.lineTo(10 * s, -59 * s); ctx.lineTo(9.6 * s, -62.5 * s); ctx.lineTo(-9.4 * s, -62.5 * s); ctx.closePath(); ctx.fill();
          ctx.fillStyle = star; ctx.beginPath(); ctx.arc(1 * s, -70 * s, 3.4 * s, 0.7, 5.6); ctx.arc(2.6 * s, -70 * s, 2.6 * s, 5.6, 0.7, true); ctx.fill();   // 초승달 문장
          for (const [x0, y0] of [[-4, -66], [5, -76], [-1, -82]]) { ctx.fillRect(x0 * s - 0.7 * s, y0 * s - 0.7 * s, 1.4 * s, 1.4 * s); }
          const bob = Math.sin(t * 3.2) * 2 * s;                // 모자 끝에 매달려 흔들리는 별
          ctx.strokeStyle = gold; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - 2 * s, tipY + 7 * s + bob); ctx.stroke();
          ctx.fillStyle = gold; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 1.2 : 2.8) * s; ctx.lineTo(tipX - 2 * s + Math.cos(a) * rr, tipY + 9 * s + bob + Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
          if (live) x3Glow(S, tipX - 2 * s, tipY + 9 * s + bob, 2.6 * s, gold, 0.3 + pulse * 0.3);
        }
      }
      if (!S.flash) {                                          // 앞에 떠도는 마법서: 넘어가는 장 · 피어오르는 글자
        const bx = -17 * s, by = -34 * s + Math.sin(t * 2.1) * 2.5 * s;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.15 + Math.sin(t * 1.3) * 0.05);
        ctx.fillStyle = '#4a2a6a'; ctx.fillRect(-7 * s, -1 * s, 14 * s, 6 * s);
        ctx.fillStyle = '#f4ecd8'; ctx.beginPath(); ctx.moveTo(-6.5 * s, 0); ctx.quadraticCurveTo(-3 * s, -2.5 * s, 0, 0); ctx.quadraticCurveTo(3 * s, -2.5 * s, 6.5 * s, 0); ctx.lineTo(6.5 * s, 4 * s); ctx.lineTo(-6.5 * s, 4 * s); ctx.closePath(); ctx.fill();
        const flip = (t * 0.9) % 1;                             // 장이 넘어간다
        ctx.fillStyle = 'rgba(244,236,216,.9)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(flip * Math.PI) * 6 * s, -Math.sin(flip * Math.PI) * 4 * s); ctx.lineTo(Math.cos(flip * Math.PI) * 6 * s, 3 * s - Math.sin(flip * Math.PI) * 4 * s); ctx.lineTo(0, 3.5 * s); ctx.closePath(); ctx.fill();
        if (hq) { ctx._skipInk = true; ctx.fillStyle = '#8a7aa8'; for (let i = 0; i < 3; i++) { ctx.fillRect(-5.5 * s, (0.6 + i * 1.1) * s, 4 * s, 0.4 * s); ctx.fillRect(1.5 * s, (0.6 + i * 1.1) * s, 4 * s, 0.4 * s); } ctx._skipInk = false; }
        ctx.restore();
        if (live) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) { const q = (t * 0.6 + i / 3) % 1; ctx.globalAlpha = (1 - q) * 0.8; ctx.fillStyle = i % 2 ? gold : acc;
            ctx.font = 'bold ' + Math.round(4.5 * s) + 'px serif'; ctx.fillText(['✶', '☾', '✧'][i], bx + (i - 1) * 4 * s, by - 4 * s - q * 14 * s); }
          ctx.restore(); ctx._skipInk = false; }
      }
      armWeapon(S, -0.22 + atk * 0.5 - charge * 0.35, () => {  // 수정 지팡이: 금 감긴 자루 · 초승달 테 · 은하가 도는 수정 구슬 · 도는 작은 별
        line(S, 0, 6 * s, 3 * s, -50 * s, 3.4 * s, F3('#4a3424'));
        if (!S.flash) { ctx.strokeStyle = gold; ctx.lineWidth = 1.1 * s; for (let i = 0; i < 6; i++) { const y = (-8 - i * 7) * s; ctx.beginPath(); ctx.moveTo(-1.4 * s, y); ctx.lineTo(4 * s, y - 2.2 * s); ctx.stroke(); } }
        const ox = 3.4 * s, oy = -59 * s, orR = (6.5 + charge * 1.6) * s;
        ctx.strokeStyle = F3(gold); ctx.lineWidth = 2 * s;     // 초승달 테
        ctx.beginPath(); ctx.arc(ox, oy, orR + 3 * s, 0.55 * Math.PI, 2.45 * Math.PI); ctx.stroke();
        ctx.fillStyle = F3(gold); tri(S, ox - 4 * s, oy + orR + 2 * s, ox + 4 * s, oy + orR + 2 * s, ox, oy + orR + 7 * s, F3(gold));
        if (S.flash) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox, oy, orR, 0, 7); ctx.fill(); }
        else {
          ctx.save(); ctx._skipInk = true;
          const g = ctx.createRadialGradient(ox - orR * 0.3, oy - orR * 0.3, orR * 0.1, ox, oy, orR);
          g.addColorStop(0, '#f6f0ff'); g.addColorStop(0.45, acc); g.addColorStop(1, '#3a2a8a');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, orR, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(ox, oy, orR, 0, 7); ctx.clip();          // 구슬 속 은하: 도는 나선 별
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 18; i++) { const arm = i % 2, u = (i >> 1) / 9, a = t * 1.6 + arm * Math.PI + u * 4.2, rr = u * orR * 0.95;
            ctx.globalAlpha = 0.9 - u * 0.5; ctx.fillStyle = arm ? '#fff6c8' : '#c8a8ff'; ctx.fillRect(ox + Math.cos(a) * rr - 0.6 * s, oy + Math.sin(a) * rr * 0.7 - 0.6 * s, 1.2 * s, 1.2 * s); }
          ctx.restore(); ctx._skipInk = false;
          x3Glow(S, ox, oy, orR * 0.9, acc, 0.25 + charge * 0.55 + pulse * 0.1);
          if (live) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = star;        // 도는 작은 별 셋
            for (let i = 0; i < 3; i++) { const a = t * 2.6 + i * 2.094; const px = ox + Math.cos(a) * (orR + 8 * s), py = oy + Math.sin(a) * (orR + 4 * s) * 0.6;
              ctx.beginPath(); for (let j = 0; j < 8; j++) { const b = j * Math.PI / 4, rr = (j % 2 ? 0.5 : 1.7) * s; ctx.lineTo(px + Math.cos(b) * rr, py + Math.sin(b) * rr); } ctx.closePath(); ctx.fill(); }
            ctx.restore(); ctx._skipInk = false; }
          if (live && atk > 0.25) {                               // 쏘는 순간: 구슬에서 뻗는 빛살
            ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = star; ctx.lineWidth = 1.4 * s; ctx.globalAlpha = atk * 0.8;
            for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t; ctx.beginPath(); ctx.moveTo(ox + Math.cos(a) * orR * 1.2, oy + Math.sin(a) * orR * 1.2); ctx.lineTo(ox + Math.cos(a) * orR * (2.4 + atk), oy + Math.sin(a) * orR * (2.4 + atk)); ctx.stroke(); }
            ctx.restore(); ctx._skipInk = false; }
        }
      }, 4 * s);
      if (live) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';   // 몸 둘레로 피어오르는 별가루
        for (let i = 0; i < 7; i++) { const q = (t * 0.35 + _h(i * 5.3)) % 1, px = (_h(i * 2.7) - 0.5) * 40 * s + Math.sin(t * 2 + i) * 3 * s, py = -4 * s - q * 70 * s;
          ctx.globalAlpha = Math.sin(q * Math.PI) * 0.8; ctx.fillStyle = i % 3 ? gold : acc; ctx.fillRect(px - 0.8 * s, py - 0.8 * s, 1.6 * s, 1.6 * s); }
        ctx.restore(); ctx._skipInk = false; }
      break;
    }
    case 'hovertank': {                                        // 플라즈마 기동전차: 반중력 부양 · 빛나는 이음선 장갑 · 쌍열 플라즈마 포 · 측면 미사일 포드 · 근접 방어 레이저 · 에너지 방벽
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const mv = S.moving, charge = Math.max(S.wind || 0, atk > 0 ? 0 : 0.25), rc = atk * 7 * s;
      const hover = -9 * s + Math.sin(t * 2.2) * 1.8 * s + (mv ? Math.sin(t * 9) * 0.5 * s : 0), tilt = mv ? -0.025 : Math.sin(t * 1.3) * 0.012;
      const plate = x3Hex(col, 0), plateD = x3Hex(tun, 0), seam = acc;
      if (!S.flash) {                                          // 땅: 반중력 물결 고리 · 흩어지는 먼지
        ctx.save(); ctx._skipInk = true;
        for (let i = 0; i < 3; i++) { const q = (t * 0.9 + i / 3) % 1;
          ctx.globalAlpha = (1 - q) * 0.45; ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * s;
          ctx.beginPath(); ctx.ellipse(0, -1 * s, (14 + q * 40) * s, (2 + q * 6) * s, 0, 0, 7); ctx.stroke(); }
        ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, -0.5 * s, 40 * s, 4 * s, 0, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
        if (live && mv) for (let i = 0; i < 2; i++) { const q = (t * 2.2 + i / 2) % 1; x3Puff(S, (-48 - q * 20) * s, (-3 - q * 6) * s, (2 + q * 5) * s, (1 - q) * 0.4, '#d8d0c0'); }
      }
      ctx.save(); ctx.translate(0, hover); ctx.rotate(tilt);
      if (!S.flash) {                                          // 반중력 패드 셋에서 땅으로 쏟아지는 푸른 빛
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        for (const px of [-26, 0, 24]) {
          const g = ctx.createLinearGradient(0, -2 * s, 0, -hover + 2 * s);
          g.addColorStop(0, 'rgba(120,230,255,.75)'); g.addColorStop(1, 'rgba(120,230,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo((px - 6) * s, -2 * s); ctx.lineTo((px + 6) * s, -2 * s); ctx.lineTo((px + 10) * s, -hover); ctx.lineTo((px - 10) * s, -hover); ctx.closePath(); ctx.fill();
        }
        ctx.restore(); ctx._skipInk = false;
      }
      for (const px of [-26, 0, 24]) {                         // 패드
        ctx.fillStyle = F3('#2a3038'); ctx.beginPath(); roundRectPath(ctx, (px - 8) * s, -6 * s, 16 * s, 5 * s, 2 * s); ctx.fill();
        if (!S.flash) { ctx.fillStyle = acc; ctx.fillRect((px - 6) * s, -2.4 * s, 12 * s, 1.4 * s); if (live) x3Glow(S, px * s, -1.5 * s, 3 * s, acc, 0.35 + 0.2 * Math.sin(t * 6 + px)); }
      }
      if (live) {                                              // 뒤 추진기 불꽃 (달리면 길어진다)
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        const L = (mv ? 18 : 7) * s * (0.85 + 0.15 * Math.sin(t * 40));
        for (const py of [-14, -22]) { const g = ctx.createLinearGradient(-44 * s, 0, -44 * s - L, 0);
          g.addColorStop(0, 'rgba(220,250,255,.95)'); g.addColorStop(0.4, 'rgba(90,200,255,.6)'); g.addColorStop(1, 'rgba(90,200,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-44 * s, (py - 2.6) * s); ctx.lineTo(-44 * s - L, py * s); ctx.lineTo(-44 * s, (py + 2.6) * s); ctx.closePath(); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3(plateD);                              // 아래 차체 (어두운 판)
      ctx.beginPath(); ctx.moveTo(-44 * s, -8 * s); ctx.lineTo(36 * s, -8 * s); ctx.lineTo(46 * s, -16 * s); ctx.lineTo(-46 * s, -18 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(plate);                               // 위 차체: 쐐기형 흰 장갑
      ctx.beginPath(); ctx.moveTo(-46 * s, -17 * s); ctx.lineTo(-40 * s, -30 * s); ctx.lineTo(18 * s, -31 * s); ctx.lineTo(48 * s, -17 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3('#2a3038'); ctx.fillRect(-47 * s, -27 * s, 5 * s, 15 * s);            // 추진기 노즐
      if (!S.flash) {                                          // 빛나는 이음선 (맥박 치듯)
        ctx.save(); ctx._skipInk = true;
        const glow = 0.55 + 0.45 * Math.sin(t * 3.4);
        ctx.strokeStyle = seam; ctx.lineWidth = 1.2 * s; ctx.globalAlpha = glow;
        ctx.beginPath(); ctx.moveTo(-42 * s, -18 * s); ctx.lineTo(44 * s, -17 * s);
        ctx.moveTo(-14 * s, -18 * s); ctx.lineTo(-10 * s, -30 * s); ctx.moveTo(10 * s, -17.5 * s); ctx.lineTo(14 * s, -30.5 * s);
        ctx.moveTo(-38 * s, -12 * s); ctx.lineTo(30 * s, -12 * s); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,.3)';
        ctx.beginPath(); ctx.moveTo(18 * s, -31 * s); ctx.lineTo(48 * s, -17 * s); ctx.lineTo(43 * s, -17 * s); ctx.lineTo(16 * s, -29.5 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff5a6a'; ctx.fillRect(40 * s, -21 * s, 4 * s, 1.6 * s);             // 앞 감지기
        ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, 42 * s, -20.2 * s, 2 * s, '#ff5a6a', 0.35);
      }
      {                                                        // 측면 미사일 포드: 쏠 때 덮개가 열리고 탄두가 보인다
        const open = Math.min(1, atk * 2.2);
        ctx.fillStyle = F3(plateD); ctx.beginPath(); roundRectPath(ctx, -36 * s, -42 * s, 20 * s, 12 * s, 2 * s); ctx.fill();
        if (!S.flash) {
          ctx.save(); ctx._skipInk = true;
          for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
            const hx = (-33 + c * 6) * s, hy = (-39.5 + r * 5) * s;
            ctx.fillStyle = '#12161c'; ctx.fillRect(hx, hy, 4.4 * s, 3.6 * s);
            if (open > 0.1) { ctx.fillStyle = '#ffb03c'; ctx.beginPath(); ctx.arc(hx + 2.2 * s, hy + 1.8 * s, 1.3 * s, 0, 7); ctx.fill(); }
            ctx.fillStyle = shade(plateD, 0.25); ctx.fillRect(hx, hy - open * 3.4 * s, 4.4 * s, 1.2 * s);   // 덮개
          }
          ctx.restore(); ctx._skipInk = false;
        }
      }
      {                                                        // 레이더 접시 (돈다)
        const ra = t * 3;
        line(S, -20 * s, -42 * s, -20 * s, -50 * s, 1.4 * s, F3('#3a4048'));
        ctx.fillStyle = F3('#c8d0d8'); ctx.beginPath(); ctx.ellipse(-20 * s, -51 * s, 6 * s * Math.abs(Math.cos(ra)) + 0.8 * s, 2.2 * s, 0, 0, 7); ctx.fill();
        if (live) x3Glow(S, -20 * s, -53.5 * s, 1.2 * s, '#ff5a6a', Math.sin(t * 5) > 0 ? 0.6 : 0.15);
      }
      // 쌍열 플라즈마 포: 코일 고리가 차례로 빛나고, 포구에 플라즈마가 모인다 · 쏘면 밀려난다
      for (const [py, bk] of [[-40.5, 1], [-36, 0]]) {
        ctx.fillStyle = F3(bk ? shade(plateD, -0.1) : plateD); ctx.fillRect(14 * s - rc, py * s, 52 * s, 3.4 * s);
        if (!S.flash) { ctx.save(); ctx._skipInk = true;
          for (let i = 0; i < 5; i++) { const lit = Math.max(0, Math.sin(t * 6 - i * 0.9)) * (0.35 + charge * 0.65);
            ctx.fillStyle = 'rgba(90,216,255,' + (0.25 + lit * 0.75) + ')'; ctx.fillRect((24 + i * 8) * s - rc, (py - 0.6) * s, 2.2 * s, 4.6 * s); }
          ctx.restore(); ctx._skipInk = false; }
      }
      ctx.fillStyle = F3('#2a3038'); ctx.fillRect(64 * s - rc, -42 * s, 6 * s, 10 * s);       // 포구 고리
      if (!S.flash && (charge > 0.05 || atk > 0)) {           // 포구에 모이는 플라즈마 구슬
        const cr = (2.5 + charge * 5) * s;
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#e8fcff'; ctx.beginPath(); ctx.arc(72 * s - rc, -37 * s, cr * 0.5, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.6; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(72 * s - rc, -37 * s, cr, 0, 7); ctx.fill();
        ctx.strokeStyle = '#c8f6ff'; ctx.lineWidth = 0.8 * s; ctx.globalAlpha = 0.8;
        for (let i = 0; i < 4; i++) { const a = t * 9 + i * 1.57; ctx.beginPath(); ctx.moveTo(72 * s - rc + Math.cos(a) * cr * 2.2, -37 * s + Math.sin(a) * cr * 2.2); ctx.lineTo(72 * s - rc + Math.cos(a) * cr * 1.1, -37 * s + Math.sin(a) * cr * 1.1); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3(plate);                               // 포탑: 각진 쐐기 · 눈 모양 조준경
      ctx.beginPath(); ctx.moveTo(-16 * s, -31 * s); ctx.lineTo(-12 * s, -46 * s); ctx.lineTo(10 * s, -48 * s); ctx.lineTo(22 * s, -40 * s); ctx.lineTo(24 * s, -31 * s); ctx.closePath(); ctx.fill();
      if (!S.flash) {
        ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(-12 * s, -46 * s); ctx.lineTo(10 * s, -48 * s); ctx.lineTo(9 * s, -45.6 * s); ctx.lineTo(-11 * s, -44 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#12161c'; ctx.beginPath(); roundRectPath(ctx, 6 * s, -43 * s, 12 * s, 4 * s, 2 * s); ctx.fill();
        const scan = (Math.sin(t * 2.2) * 0.5 + 0.5) * 9 * s;
        ctx.fillStyle = acc; ctx.fillRect(7 * s + scan, -42.4 * s, 2 * s, 2.8 * s);
        ctx.strokeStyle = seam; ctx.lineWidth = 1 * s; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(-14 * s, -37 * s); ctx.lineTo(22 * s, -37 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, 8 * s + scan, -41 * s, 2 * s, acc, 0.5);
      }
      {                                                        // 근접 방어 레이저: 포탑 뒤 작은 돔에서 하늘을 훑는 붉은 빔
        const la = -1.2 + Math.sin(t * 1.7) * 0.5;
        ctx.fillStyle = F3('#3a4048'); ctx.beginPath(); ctx.arc(-6 * s, -47 * s, 4 * s, Math.PI, 0); ctx.fill();
        line(S, -6 * s, -48 * s, -6 * s + Math.cos(la) * 7 * s, -48 * s + Math.sin(la) * 7 * s, 1.8 * s, F3('#5a6270'));
        if (live && Math.sin(t * 4.3) > 0.55) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(255,90,106,.75)'; ctx.lineWidth = 1 * s; ctx.beginPath();
          ctx.moveTo(-6 * s + Math.cos(la) * 7 * s, -48 * s + Math.sin(la) * 7 * s); ctx.lineTo(-6 * s + Math.cos(la) * 60 * s, -48 * s + Math.sin(la) * 60 * s); ctx.stroke();
          ctx.restore(); ctx._skipInk = false; }
      }
      if (live) {                                              // 에너지 방벽: 육각 무늬가 은은하게 일렁인다 (쏠 때 잠깐 밝아짐)
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        const a = 0.07 + 0.05 * Math.sin(t * 2.6) + atk * 0.12;
        ctx.globalAlpha = a; ctx.strokeStyle = acc; ctx.lineWidth = 1 * s;
        ctx.beginPath(); ctx.ellipse(2 * s, -26 * s, 54 * s, 32 * s, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
        for (let i = 0; i < 9; i++) { const u = i / 8, ang = Math.PI * (1.08 + u * 0.84), hx = 2 * s + Math.cos(ang) * 50 * s, hy = -26 * s + Math.sin(ang) * 28 * s;
          ctx.globalAlpha = a * (0.6 + 0.6 * Math.sin(t * 3 + i * 1.3));
          ctx.beginPath(); for (let j = 0; j <= 6; j++) { const b = j * Math.PI / 3; ctx.lineTo(hx + Math.cos(b) * 3.4 * s, hy + Math.sin(b) * 3.4 * s); } ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false;
      }
      if (live && atk > 0.15) {                                // 쏠 때 포탑 앞에 뜨는 조준 홀로그램
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = atk * 0.8; ctx.strokeStyle = acc; ctx.lineWidth = 1 * s;
        const cx = 86 * s, cy = -37 * s, rr = (8 + (1 - atk) * 6) * s;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.stroke();
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rr * 0.6, cy + Math.sin(a) * rr * 0.6); ctx.lineTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr * 1.4); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.restore();
      break;
    }
    /* ---------------------- 4.15 삼국지 ---------------------- */
    case 'guanyu': {                                           // 관우: 붉은 얼굴 · 길게 늘어진 검은 수염 · 녹색 두건과 전포 · 청룡언월도
      const t = MODEL.time, sway = S.live ? Math.sin(t * 2.2) * 1.2 * s + (S.moving ? 1.5 * s : 0) : 0;
      cape(S, -1, tun, 1.4);
      legs(S); torso(S, 6 * s);
      ctx.fillStyle = F3(tun); ctx.beginPath(); ctx.moveTo(-10 * s, -44 * s); ctx.lineTo(10 * s, -44 * s); ctx.lineTo(12 * s, -22 * s); ctx.lineTo(-12 * s, -22 * s); ctx.closePath(); ctx.fill();   // 녹색 전포
      ctx.fillStyle = F3('#c8a050'); ctx.fillRect(-12 * s, -28 * s, 24 * s, 3.4 * s);                                // 금 허리띠
      ctx.fillStyle = F3('#8a8e98'); for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * 10 * s, -41 * s, 5 * s, 3.4 * s, 0, Math.PI, 0); ctx.fill(); }   // 어깨 갑옷
      head(S, 'bald');
      ctx.fillStyle = F3('#c8463a'); ctx.beginPath(); ctx.arc(0.5 * s, -50 * s, 8.2 * s, 0, 7); ctx.fill();          // 붉은 얼굴
      ctx.fillStyle = F3('#16161c');                                                                                   // 가슴까지 늘어진 수염
      ctx.beginPath(); ctx.moveTo(1 * s, -45 * s); ctx.quadraticCurveTo(6 * s, -44 * s, 8.5 * s, -45.5 * s); ctx.quadraticCurveTo(8 * s, -33 * s + sway, 4 * s + sway, -25 * s); ctx.quadraticCurveTo(1.5 * s, -35 * s, 1 * s, -45 * s); ctx.fill();
      ctx.fillRect(3 * s, -47.6 * s, 6 * s, 1.1 * s);
      if (!S.flash) { ctx.strokeStyle = '#16161c'; ctx.lineWidth = 1.3 * s; ctx.beginPath(); ctx.moveTo(2 * s, -54 * s); ctx.lineTo(8.5 * s, -55.5 * s); ctx.stroke();   // 누에 눈썹 · 봉황 눈
        ctx.fillStyle = '#16161c'; ctx.beginPath(); ctx.ellipse(6 * s, -52 * s, 1.8 * s, 0.7 * s, -0.15, 0, 7); ctx.fill(); }
      ctx.fillStyle = F3(tun); ctx.beginPath(); ctx.arc(0, -52 * s, 9.4 * s, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(9 * s, -53 * s); ctx.lineTo(-9 * s, -53 * s); ctx.fill();   // 녹색 두건
      ctx.beginPath(); ctx.moveTo(-8 * s, -56 * s); ctx.quadraticCurveTo(-16 * s, -52 * s + sway * 0.5, -18 * s, -45 * s); ctx.lineTo(-14 * s, -46 * s); ctx.closePath(); ctx.fill();
      armWeapon(S, -1.2 + atk * 2.2, () => {                   // 청룡언월도: 긴 자루 · 초승달 날 · 용 머리 장식 · 붉은 술
        line(S, -22 * s, 0, 46 * s, 0, 3 * s, F3('#5a2a1a'));
        tri(S, -22 * s, -2 * s, -30 * s, 0, -22 * s, 2 * s, F3('#c8a050'));
        ctx.fillStyle = F3('#dfe6ee'); ctx.beginPath(); ctx.moveTo(44 * s, -2.5 * s); ctx.quadraticCurveTo(58 * s, -4 * s, 66 * s, -17 * s); ctx.quadraticCurveTo(71 * s, -2 * s, 60 * s, 6 * s); ctx.lineTo(44 * s, 4 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = F3(acc); ctx.beginPath(); ctx.arc(45 * s, 0, 3.6 * s, 0, 7); ctx.fill();
        ctx.strokeStyle = F3(x3Hex(acc, -0.3)); ctx.lineWidth = 1.4 * s; ctx.beginPath(); ctx.moveTo(48 * s, -1 * s); ctx.quadraticCurveTo(55 * s, -6 * s, 61 * s, -9 * s); ctx.stroke();
        ctx.fillStyle = F3('#c83a2a'); ctx.beginPath(); ctx.moveTo(43 * s, 2 * s); ctx.quadraticCurveTo(40 * s, 8 * s, 37 * s + sway, 12 * s); ctx.lineTo(41 * s, 2 * s); ctx.fill();
        if (!S.flash && S.live && atk > 0.2) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.32 * atk; ctx.fillStyle = acc;
          ctx.beginPath(); ctx.moveTo(10 * s, 0); ctx.arc(10 * s, 0, 62 * s, -1.1 * atk, 0.25); ctx.closePath(); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      }, 8 * s);
      break;
    }
    case 'zhugeliang': {                                       // 제갈량: 흰 학창의 · 검은 깃 · 윤건 · 학 깃털 부채 · 몸을 감도는 바람
      const t = MODEL.time;
      if (!S.flash && S.live) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = '#d8f0ff'; ctx.lineWidth = 1.3 * s;
        for (let i = 0; i < 2; i++) { const a = t * 1.8 + i * 3.1; ctx.globalAlpha = 0.3 + 0.15 * Math.sin(a);
          ctx.beginPath(); ctx.ellipse(0, -30 * s + i * 12 * s, 20 * s, 4.5 * s, 0, a, a + 2.4); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false; }
      robe(S, 16 * s, -32 * s, tun);
      torso(S, 4 * s);
      ctx.fillStyle = F3('#f8f6ee'); ctx.beginPath(); ctx.moveTo(-8 * s, -44 * s); ctx.lineTo(8 * s, -44 * s); ctx.lineTo(11 * s, -26 * s); ctx.lineTo(-11 * s, -26 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = F3('#2a2a3a'); ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(-3 * s, -44 * s); ctx.lineTo(4 * s, -30 * s); ctx.stroke();   // 검은 깃
      for (const d of [-1, 1]) { ctx.fillStyle = F3('#f8f6ee'); ctx.beginPath(); ctx.moveTo(d * 8 * s, -42 * s); ctx.lineTo(d * 17 * s, -32 * s); ctx.lineTo(d * 11 * s, -26 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = F3('#2a2a3a'); ctx.beginPath(); ctx.moveTo(d * 17 * s, -32 * s); ctx.lineTo(d * 11 * s, -26 * s); ctx.lineTo(d * 13 * s, -28 * s); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = F3(acc); ctx.fillRect(-11 * s, -30 * s, 22 * s, 2.4 * s);
      head(S, 'bald');
      ctx.fillStyle = F3('#1a1a22'); ctx.beginPath(); ctx.moveTo(3 * s, -45 * s); ctx.lineTo(7 * s, -45 * s); ctx.lineTo(5 * s, -38 * s); ctx.closePath(); ctx.fill();   // 가는 수염
      ctx.fillRect(3 * s, -47.4 * s, 6 * s, 1.2 * s);
      ctx.fillStyle = F3('#2a2a34'); ctx.beginPath(); roundRectPath(ctx, -7 * s, -67 * s, 13 * s, 12 * s, 3 * s); ctx.fill();   // 윤건
      ctx.fillRect(-9.5 * s, -57 * s, 18 * s, 3 * s);
      if (!S.flash) { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(4 * s, -51.5 * s, 1.6 * s, 1.4 * s); }
      armWeapon(S, -0.6 + atk * 1.3 + (S.live ? Math.sin(t * 2) * 0.06 : 0), () => {   // 학 깃털 부채
        line(S, 0, 0, 10 * s, 0, 2.4 * s, F3('#6a4a2a'));
        for (let i = 0; i < 9; i++) { const a = -0.95 + i * 0.24, cx = 10 * s + Math.cos(a) * 10 * s, cy = Math.sin(a) * 10 * s;
          ctx.fillStyle = F3('#fbfbf6'); ctx.beginPath(); ctx.ellipse(cx, cy, 8 * s, 2.6 * s, a, 0, 7); ctx.fill();
          ctx.fillStyle = F3('#22222a'); ctx.beginPath(); ctx.ellipse(10 * s + Math.cos(a) * 16 * s, Math.sin(a) * 16 * s, 2.4 * s, 1.8 * s, a, 0, 7); ctx.fill(); }
        if (!S.flash && S.live && atk > 0.2) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35 * atk; ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 2 * s;
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(14 * s, 0, (20 + i * 8) * s, -0.8, 0.8); ctx.stroke(); } ctx.restore(); ctx._skipInk = false; }
      }, 6 * s);
      break;
    }
    case 'zhaoyun': {                                          // 조운: 흰 말 · 은빛 갑옷 · 흰 망토 · 붉은 술 투구 · 용담창
      const t = MODEL.time, gait = S.moving ? phase * 2 : 0, by = -27 * s + (S.moving ? Math.abs(Math.sin(gait)) * -2.5 * s : 0);
      const hcol = F3('#f2f0ea'), hdk = F3('#c8c4bc');
      for (const [lx, off] of [[-13, 0], [-9, Math.PI], [10, Math.PI], [14, 0]]) {   // 다리 넷
        const a = Math.sin(gait + off) * 0.6 * (S.moving ? 1 : 0.1), kx = lx * s + Math.sin(a) * 7 * s;
        ctx.strokeStyle = off ? hdk : hcol; ctx.lineWidth = 3.2 * s;
        ctx.beginPath(); ctx.moveTo(lx * s, by + 4 * s); ctx.lineTo(kx, by + 15 * s); ctx.lineTo(kx - Math.sin(a) * 2 * s, -1 * s); ctx.stroke();
      }
      ctx.strokeStyle = hdk; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(-18 * s, by - 2 * s); ctx.quadraticCurveTo(-28 * s, by + 2 * s + Math.sin(t * 5) * 2 * s, -26 * s, by + 12 * s); ctx.stroke();   // 꼬리
      ctx.fillStyle = hcol; ctx.beginPath(); ctx.ellipse(0, by, 19 * s, 8.4 * s, 0, 0, 7); ctx.fill();               // 몸
      line(S, 14 * s, by - 3 * s, 21 * s, by - 17 * s, 6 * s, hcol);                                                 // 목
      ctx.fillStyle = hcol; ctx.beginPath(); ctx.ellipse(25 * s, by - 17 * s, 7 * s, 3.6 * s, 0.4, 0, 7); ctx.fill(); // 머리
      ctx.fillStyle = F3('#d8d8e0'); ctx.beginPath(); ctx.moveTo(13 * s, by - 6 * s); ctx.lineTo(19 * s, by - 20 * s); ctx.lineTo(16 * s, by - 6 * s); ctx.closePath(); ctx.fill();   // 갈기
      if (!S.flash) { ctx.fillStyle = '#c83a3a'; ctx.fillRect(-9 * s, by - 7 * s, 16 * s, 7 * s);                    // 붉은 안장 깔개
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(27 * s, by - 18.5 * s, 0.9 * s, 0, 7); ctx.fill(); }
      ctx.save(); ctx.translate(-2 * s, by + 12 * s);                                                                  // 탄 장수
      cape(S, -1, '#f4f4f8', 1.1);
      torso(S, 5 * s);
      ctx.fillStyle = F3('#c8d0dc'); ctx.beginPath(); roundRectPath(ctx, -7 * s, -44 * s, 14 * s, 16 * s, 3 * s); ctx.fill();   // 은빛 갑옷
      if (!S.flash) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(1 * s, -42 * s, 3 * s, 12 * s); }
      head(S, 'bald');
      ctx.fillStyle = F3('#c8d0dc'); ctx.beginPath(); ctx.arc(0, -52 * s, 9.6 * s, Math.PI, 0); ctx.fill(); ctx.fillRect(-10 * s, -53 * s, 6 * s, 8 * s);   // 투구
      ctx.fillStyle = F3('#d83a3a'); ctx.beginPath(); ctx.moveTo(0, -61 * s); ctx.quadraticCurveTo(-8 * s, -68 * s, -14 * s, -62 * s + Math.sin(t * 6) * 1.5 * s); ctx.lineTo(0, -58 * s); ctx.closePath(); ctx.fill();   // 붉은 술
      armWeapon(S, -0.1 + atk * 0.15, () => {                  // 용담창
        line(S, -18 * s, 0, 54 * s, 0, 2.6 * s, F3('#e8e8f0'));
        tri(S, 54 * s, -3.4 * s, 68 * s, 0, 54 * s, 3.4 * s, F3('#dfe8f4'));
        ctx.fillStyle = F3('#d83a3a'); ctx.beginPath(); ctx.moveTo(53 * s, 0); ctx.lineTo(47 * s, -5 * s); ctx.lineTo(49 * s, 0); ctx.lineTo(47 * s, 5 * s); ctx.closePath(); ctx.fill();
        if (!S.flash && S.live && atk > 0.2) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.4 * atk; ctx.fillStyle = acc;
          ctx.beginPath(); ctx.moveTo(56 * s, -4 * s); ctx.lineTo(84 * s, 0); ctx.lineTo(56 * s, 4 * s); ctx.closePath(); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      }, 4 * s);
      ctx.restore();
      break;
    }
    case 'zhangfei': {                                         // 장비: 덥수룩한 호랑이 수염 · 부릅뜬 눈 · 검은 갑옷과 금 징 · 장팔사모
      const t = MODEL.time;
      legs(S); torso(S, 6.4 * s);
      ctx.fillStyle = F3(tun); ctx.beginPath(); roundRectPath(ctx, -10 * s, -45 * s, 20 * s, 22 * s, 4 * s); ctx.fill();   // 검은 갑옷
      if (!S.flash) { ctx.fillStyle = acc; for (const [x, y] of [[-6, -40], [0, -40], [6, -40], [-6, -33], [0, -33], [6, -33]]) { ctx.beginPath(); ctx.arc(x * s, y * s, 1.2 * s, 0, 7); ctx.fill(); } }
      ctx.fillStyle = F3(acc); ctx.fillRect(-10 * s, -28 * s, 20 * s, 3 * s);
      ctx.fillStyle = F3('#4a4a52'); for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * 11 * s, -42 * s, 5.4 * s, 3.8 * s, 0, Math.PI, 0); ctx.fill(); }
      head(S, 'bald');
      ctx.fillStyle = F3('#c89878'); ctx.beginPath(); ctx.arc(0.5 * s, -51 * s, 7.8 * s, 0, 7); ctx.fill();          // 얼굴
      ctx.fillStyle = F3('#141418');                                                                                     // 사방으로 뻗친 호랑이 수염
      ctx.beginPath(); ctx.moveTo(9 * s, -47 * s);
      for (let i = 0; i <= 8; i++) { const a = 0.1 + i * 0.3, r1 = (i % 2 ? 6 : 10) * s; ctx.lineTo(3 * s + Math.cos(a) * r1, -46 * s + Math.sin(a) * r1); }
      ctx.lineTo(-3 * s, -46 * s); ctx.quadraticCurveTo(3 * s, -44 * s, 9 * s, -47 * s); ctx.fill();
      if (!S.flash) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(5.5 * s, -52.5 * s, 2 * s, 0, 7); ctx.fill();   // 부릅뜬 눈
        ctx.fillStyle = '#141418'; ctx.beginPath(); ctx.arc(6.3 * s, -52.5 * s, 1 * s, 0, 7); ctx.fill();
        ctx.lineWidth = 1.8 * s; ctx.strokeStyle = '#141418'; ctx.beginPath(); ctx.moveTo(2 * s, -57 * s); ctx.lineTo(9 * s, -55 * s); ctx.stroke(); }
      ctx.fillStyle = F3('#1c1c24'); ctx.beginPath(); ctx.arc(0, -53 * s, 9 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(8.5 * s, -55 * s); ctx.lineTo(-8.5 * s, -55 * s); ctx.fill();   // 검은 두건
      ctx.fillStyle = F3(acc); ctx.fillRect(-9 * s, -57 * s, 18 * s, 2 * s);
      if (!S.flash && S.live && atk > 0.3) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = 'rgba(255,240,200,' + (0.7 * atk) + ')'; ctx.lineWidth = 1.6 * s;   // 호통
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(10 * s, -47 * s, (6 + i * 5) * s * (1 + (1 - atk) * 0.5), -0.6, 0.6); ctx.stroke(); } ctx.restore(); ctx._skipInk = false; }
      armWeapon(S, -0.15 + atk * 0.2, () => {                  // 장팔사모: 뱀처럼 굽은 날
        line(S, -20 * s, 0, 52 * s, 0, 3 * s, F3('#3a2a1a'));
        ctx.fillStyle = F3('#d8dce4'); ctx.beginPath(); ctx.moveTo(52 * s, -2.4 * s);
        for (let i = 1; i <= 4; i++) ctx.lineTo((52 + i * 4.5) * s, (i % 2 ? -4.4 : -0.6) * s);
        ctx.lineTo(74 * s, 0); for (let i = 4; i >= 1; i--) ctx.lineTo((52 + i * 4.5) * s, (i % 2 ? 0.6 : 4.4) * s);
        ctx.lineTo(52 * s, 2.4 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = F3('#c83a2a'); ctx.beginPath(); ctx.moveTo(51 * s, 0); ctx.lineTo(45 * s, -5 * s); ctx.lineTo(47 * s, 0); ctx.lineTo(45 * s, 5 * s); ctx.closePath(); ctx.fill();
      }, 6 * s);
      break;
    }
    case 'huangzhong': {                                       // 황충: 흰 상투와 긴 흰 수염 · 붉은 전포 · 굵은 강궁
      legs(S); torso(S, 5 * s);
      ctx.fillStyle = F3(tun); ctx.beginPath(); ctx.moveTo(-9 * s, -44 * s); ctx.lineTo(9 * s, -44 * s); ctx.lineTo(11 * s, -22 * s); ctx.lineTo(-11 * s, -22 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3('#8a8e98'); ctx.fillRect(-9 * s, -44 * s, 18 * s, 6 * s);
      ctx.fillStyle = F3(acc); ctx.fillRect(-11 * s, -28 * s, 22 * s, 2.6 * s);
      head(S, 'bald');
      ctx.fillStyle = F3('#d8b090'); ctx.beginPath(); ctx.arc(0.5 * s, -50 * s, 7.8 * s, 0, 7); ctx.fill();
      ctx.fillStyle = F3('#f0f0ec'); ctx.beginPath(); ctx.arc(0, -53 * s, 8.8 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(-8 * s, -52 * s); ctx.fill();   // 흰 머리
      ctx.beginPath(); ctx.arc(-6 * s, -60 * s, 3.4 * s, 0, 7); ctx.fill();                                                       // 상투
      ctx.beginPath(); ctx.moveTo(0, -47 * s); ctx.quadraticCurveTo(9 * s, -47 * s, 8 * s, -42 * s); ctx.quadraticCurveTo(5 * s, -33 * s, 2 * s, -30 * s); ctx.quadraticCurveTo(1 * s, -40 * s, 0, -47 * s); ctx.fill();   // 긴 흰 수염
      if (!S.flash) { ctx.fillStyle = '#2a2a2a'; ctx.fillRect(4 * s, -52 * s, 2 * s, 1.2 * s); }
      const pull = S.wind > 0 ? 10 * s * S.wind : 0;
      ctx.strokeStyle = F3('#5a2a1a'); ctx.lineWidth = 3.6 * s;                                                           // 굵은 강궁
      ctx.beginPath(); ctx.moveTo(20 * s, -70 * s); ctx.quadraticCurveTo(34 * s, -44 * s, 20 * s, -14 * s); ctx.stroke();
      ctx.strokeStyle = F3(acc); ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(25 * s, -58 * s); ctx.lineTo(27.5 * s, -50 * s); ctx.moveTo(27.5 * s, -36 * s); ctx.lineTo(25 * s, -27 * s); ctx.stroke();
      ctx.strokeStyle = F3('#f0e8d0'); ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(20 * s, -70 * s); ctx.lineTo(18 * s - pull, -42 * s); ctx.lineTo(20 * s, -14 * s); ctx.stroke();
      if (S.wind > 0.05) { line(S, 18 * s - pull, -42 * s, 42 * s, -42 * s, 1.6 * s, F3('#d8d0b8')); tri(S, 42 * s, -44 * s, 47 * s, -42 * s, 42 * s, -40 * s, F3('#c8ccd4')); }
      arm(S, 28 * s, -42 * s); arm(S, 18 * s - pull, -42 * s);
      break;
    }
    case 'tengjia': {                                          // 등갑병: 엮은 등나무 갑옷 · 둥근 등패 · 굽은 칼 · 등나무 투구
      legs(S); torso(S, 5.4 * s);
      ctx.fillStyle = F3(tun); ctx.beginPath(); roundRectPath(ctx, -10 * s, -45 * s, 20 * s, 24 * s, 6 * s); ctx.fill();   // 등갑
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = 'rgba(90,60,20,.7)'; ctx.lineWidth = 1 * s;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-10 * s, (-42 + i * 5) * s); ctx.lineTo(10 * s, (-40 + i * 5) * s); ctx.stroke(); }
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo((-7 + i * 5) * s, -45 * s); ctx.lineTo((-8 + i * 5) * s, -21 * s); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false; }
      head(S, 'bald');
      ctx.fillStyle = F3(tun); ctx.beginPath(); ctx.arc(0, -53 * s, 10 * s, Math.PI, 0); ctx.lineTo(10 * s, -51 * s); ctx.lineTo(-10 * s, -51 * s); ctx.fill();   // 등나무 투구
      if (!S.flash) { ctx.strokeStyle = 'rgba(90,60,20,.7)'; ctx.lineWidth = 1 * s; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 5 * s, -62 * s); ctx.lineTo(i * 7 * s, -51 * s); ctx.stroke(); } }
      ctx.fillStyle = F3(acc); ctx.beginPath(); ctx.arc(0, -63.5 * s, 2 * s, 0, 7); ctx.fill();
      armWeapon(S, -1.1 + atk * 2, () => {                     // 굽은 칼
        line(S, -4 * s, 0, 6 * s, 0, 3 * s, F3('#3a2a1a'));
        ctx.fillStyle = F3('#d8dce4'); ctx.beginPath(); ctx.moveTo(6 * s, -2.4 * s); ctx.quadraticCurveTo(24 * s, -4 * s, 32 * s, -9 * s); ctx.quadraticCurveTo(28 * s, 1 * s, 6 * s, 2.4 * s); ctx.closePath(); ctx.fill();
      }, 6 * s);
      round_shield(S, 13 * s, -33 * s, 11 * s, F3(x3Hex(tun, 0.08)));                                                // 둥근 등패
      if (!S.flash) { ctx.strokeStyle = 'rgba(90,60,20,.75)'; ctx.lineWidth = 1 * s; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(13 * s, -33 * s, i * 2.6 * s, 0, 7); ctx.stroke(); }
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(13 * s, -33 * s, 2 * s, 0, 7); ctx.fill(); }
      break;
    }
    case 'jiqiang': {                                          // 창극병: 붉은 술 단 뾰족 투구 · 가벼운 갑옷 · 갈고리 날 달린 극
      legs(S); torso(S, 4.4 * s);
      ctx.fillStyle = F3(tun); ctx.fillRect(-7 * s, -43 * s, 14 * s, 17 * s);
      ctx.fillStyle = F3('#8a8e98'); ctx.fillRect(-7 * s, -43 * s, 14 * s, 4 * s);
      head(S, 'bald');
      ctx.fillStyle = F3('#6a6e78'); ctx.beginPath(); ctx.moveTo(-10 * s, -52 * s); ctx.quadraticCurveTo(-9 * s, -62 * s, 0, -66 * s); ctx.quadraticCurveTo(9 * s, -62 * s, 10 * s, -52 * s); ctx.closePath(); ctx.fill();   // 뾰족 투구
      ctx.fillStyle = F3(acc); ctx.beginPath(); ctx.moveTo(0, -66 * s); ctx.quadraticCurveTo(-6 * s, -70 * s, -9 * s, -64 * s); ctx.lineTo(0, -63 * s); ctx.closePath(); ctx.fill();   // 붉은 술
      armWeapon(S, -0.12 + atk * 0.2, () => {                  // 극: 창끝 + 옆의 초승달 갈고리
        line(S, -20 * s, 0, 60 * s, 0, 2.6 * s, F3('#7a5a34'));
        tri(S, 60 * s, -3 * s, 72 * s, 0, 60 * s, 3 * s, F3('#d8dce4'));
        ctx.fillStyle = F3('#d8dce4'); ctx.beginPath(); ctx.moveTo(56 * s, -1.4 * s); ctx.quadraticCurveTo(58 * s, -9 * s, 64 * s, -11 * s); ctx.quadraticCurveTo(60 * s, -6 * s, 60 * s, -1.4 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = F3(acc); ctx.fillRect(54 * s, 1 * s, 3 * s, 5 * s);
      }, 4 * s);
      break;
    }
    /* 4.15 관우의 3진 '청룡 군신': 등 뒤를 휘감고 오르는 푸른 용 · 비취 갑옷 · 빛나는 눈 · 빛의 언월도 */
    case 'azureguan': {
      const t = MODEL.time, live = S.live && !S.flash, sway = S.live ? Math.sin(t * 2.2) * 1.2 * s + (S.moving ? 1.5 * s : 0) : 0;
      if (!S.flash) {                                          // 용: 꼬리에서 머리까지 굵어졌다 가늘어지는 비늘 마디
        ctx.save(); ctx._skipInk = true;
        const N = 22, pts = [];
        for (let i = 0; i <= N; i++) { const u = i / N; pts.push([(-36 + u * 52) * s + Math.sin(u * 6 + t * 2.4) * 6 * s, (-12 - u * 70) * s + Math.sin(u * 9 + t * 3) * 6 * s, (2 + 5 * Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.9 + 0.15)) * s]); }
        ctx.globalAlpha = 0.25; ctx.fillStyle = acc;          // 은은한 빛
        for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 0.95;
        for (const [x, y, r] of pts) { ctx.fillStyle = x3Hex(acc, -0.25); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
        for (let i = 0; i < N; i += 2) { const [x, y, r] = pts[i]; ctx.fillStyle = x3Hex(acc, 0.35); ctx.beginPath(); ctx.arc(x + r * 0.2, y + r * 0.35, r * 0.5, 0, 7); ctx.fill();   // 배 비늘
          ctx.fillStyle = '#e8fff4'; ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.8); ctx.lineTo(x, y - r * 1.7); ctx.lineTo(x + r * 0.4, y - r * 0.8); ctx.fill(); }   // 등지느러미
        const [hx, hy] = pts[N], ang = Math.atan2(pts[N][1] - pts[N - 2][1], pts[N][0] - pts[N - 2][0]);
        ctx.translate(hx, hy); ctx.rotate(ang * 0.4);          // 용 머리: 긴 주둥이 · 뿔 · 수염 · 빛나는 눈
        ctx.fillStyle = x3Hex(acc, -0.2); ctx.beginPath(); ctx.ellipse(4 * s, 0, 9 * s, 5.4 * s, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(8 * s, -2 * s); ctx.lineTo(18 * s, -1 * s); ctx.lineTo(18 * s, 2.4 * s); ctx.lineTo(8 * s, 4 * s); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#f0e0a0'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(0, -4 * s); ctx.quadraticCurveTo(-6 * s, -12 * s, -12 * s, -12 * s); ctx.moveTo(3 * s, -4 * s); ctx.quadraticCurveTo(-1 * s, -13 * s, -6 * s, -15 * s); ctx.stroke();
        ctx.strokeStyle = x3Hex(acc, 0.4); ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(16 * s, 2 * s); ctx.quadraticCurveTo(20 * s, 8 * s + Math.sin(t * 4) * 2 * s, 26 * s, 6 * s); ctx.stroke();
        ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(8 * s, -2 * s, 1.6 * s, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, hx + 8 * s, hy - 2 * s, 3 * s, '#fff6c0', 0.5);
      }
      cape(S, -1, tun, 1.5);
      legs(S); torso(S, 6.4 * s);
      ctx.fillStyle = F3(tun); ctx.beginPath(); ctx.moveTo(-11 * s, -45 * s); ctx.lineTo(11 * s, -45 * s); ctx.lineTo(13 * s, -21 * s); ctx.lineTo(-13 * s, -21 * s); ctx.closePath(); ctx.fill();   // 비취 갑옷
      if (!S.flash) { ctx.fillStyle = x3Hex(acc, -0.1); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc((-6 + j * 6) * s, (-40 + i * 5) * s, 2.4 * s, 0, Math.PI); ctx.fill(); } }   // 비늘 갑편
      ctx.fillStyle = F3('#e0b040'); ctx.fillRect(-13 * s, -27 * s, 26 * s, 3.6 * s);
      ctx.fillStyle = F3('#e0b040'); for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * 11 * s, -42 * s, 6 * s, 4 * s, 0, Math.PI, 0); ctx.fill(); }   // 용머리 어깨
      head(S, 'bald');
      ctx.fillStyle = F3('#c8463a'); ctx.beginPath(); ctx.arc(0.5 * s, -50 * s, 8.2 * s, 0, 7); ctx.fill();
      ctx.fillStyle = F3('#16161c'); ctx.beginPath(); ctx.moveTo(1 * s, -45 * s); ctx.quadraticCurveTo(6 * s, -44 * s, 8.5 * s, -45.5 * s); ctx.quadraticCurveTo(8 * s, -31 * s + sway, 4 * s + sway, -23 * s); ctx.quadraticCurveTo(1.5 * s, -35 * s, 1 * s, -45 * s); ctx.fill();
      ctx.fillRect(3 * s, -47.6 * s, 6 * s, 1.1 * s);
      if (!S.flash) { ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(6 * s, -52 * s, 2 * s, 0.9 * s, -0.15, 0, 7); ctx.fill(); if (live) x3Glow(S, 6 * s, -52 * s, 2.6 * s, acc, 0.45); }   // 빛나는 눈
      ctx.fillStyle = F3('#e0b040'); ctx.beginPath(); ctx.arc(0, -52 * s, 9.6 * s, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(9 * s, -53 * s); ctx.lineTo(-9 * s, -53 * s); ctx.fill();   // 금관
      ctx.fillStyle = F3(acc); ctx.beginPath(); ctx.moveTo(-3 * s, -61 * s); ctx.lineTo(0, -68 * s); ctx.lineTo(3 * s, -61 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(tun); ctx.beginPath(); ctx.moveTo(-8 * s, -56 * s); ctx.quadraticCurveTo(-17 * s, -52 * s + sway * 0.5, -19 * s, -44 * s); ctx.lineTo(-15 * s, -45 * s); ctx.closePath(); ctx.fill();
      armWeapon(S, -1.2 + atk * 2.2, () => {                   // 빛의 언월도
        line(S, -24 * s, 0, 48 * s, 0, 3.2 * s, F3('#2a4a3a'));
        ctx.strokeStyle = F3('#e0b040'); ctx.lineWidth = 1.2 * s; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo((-16 + i * 10) * s, -1.6 * s); ctx.lineTo((-12 + i * 10) * s, 1.6 * s); ctx.stroke(); }
        ctx.fillStyle = F3('#e8fff6'); ctx.beginPath(); ctx.moveTo(46 * s, -3 * s); ctx.quadraticCurveTo(62 * s, -5 * s, 72 * s, -20 * s); ctx.quadraticCurveTo(78 * s, -2 * s, 64 * s, 7 * s); ctx.lineTo(46 * s, 5 * s); ctx.closePath(); ctx.fill();
        if (live) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.45 + 0.25 * Math.sin(t * 5); ctx.fillStyle = acc;
          ctx.beginPath(); ctx.moveTo(44 * s, -5 * s); ctx.quadraticCurveTo(62 * s, -8 * s, 74 * s, -26 * s); ctx.quadraticCurveTo(84 * s, -2 * s, 66 * s, 10 * s); ctx.lineTo(44 * s, 7 * s); ctx.closePath(); ctx.fill();
          if (atk > 0.2) { ctx.globalAlpha = 0.35 * atk; ctx.beginPath(); ctx.moveTo(10 * s, 0); ctx.arc(10 * s, 0, 70 * s, -1.2 * atk, 0.3); ctx.closePath(); ctx.fill(); }
          ctx.restore(); ctx._skipInk = false; }
        ctx.fillStyle = F3('#e0b040'); ctx.beginPath(); ctx.arc(47 * s, 0, 4 * s, 0, 7); ctx.fill();
      }, 8 * s);
      break;
    }
    /* ---------------------- 4.9 기본 병종 셋 ---------------------- */
    case 'maceman': {                                          // 철퇴병: 사슬 두건 · 둥근 방패 · 가시 박힌 철퇴
      legs(S); torso(S, 5.4 * s);
      ctx.fillStyle = F3(tun); ctx.fillRect(-8 * s, -43 * s, 16 * s, 18 * s);
      head(S, 'coif');
      round_shield(S, -14 * s, -32 * s, 10 * s, F3('#8a6a44'));
      armWeapon(S, -1.4 + atk * 2.3, () => {
        line(S, 0, 0, 26 * s, 0, 3.4 * s, F3('#5a3a24'));
        ctx.fillStyle = F3('#6a6e78'); ctx.beginPath(); ctx.arc(30 * s, 0, 7 * s, 0, 7); ctx.fill();
        ctx.fillStyle = F3('#4a4e58');
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; tri(S, 30 * s + Math.cos(a - 0.3) * 6 * s, Math.sin(a - 0.3) * 6 * s, 30 * s + Math.cos(a) * 11 * s, Math.sin(a) * 11 * s, 30 * s + Math.cos(a + 0.3) * 6 * s, Math.sin(a + 0.3) * 6 * s, F3('#4a4e58')); }
      }, 8 * s);
      break;
    }
    case 'axethrower': {                                       // 도끼 투척병: 털 조끼 · 허리에 찬 손도끼들 · 던지는 손도끼
      legs(S); torso(S, 4.4 * s);
      ctx.fillStyle = F3('#8a6a44'); ctx.beginPath(); roundRectPath(ctx, -8 * s, -44 * s, 16 * s, 18 * s, 4 * s); ctx.fill();   // 털 조끼
      ctx.fillStyle = F3(tun); ctx.fillRect(-4 * s, -44 * s, 8 * s, 18 * s);
      for (const x of [-8, -3]) { line(S, x * s, -26 * s, (x - 2) * s, -14 * s, 2 * s, F3('#5a3a24')); ctx.fillStyle = F3(acc); ctx.fillRect((x - 6) * s, -16 * s, 5 * s, 4 * s); }   // 허리 도끼
      head(S, 'furhood');
      armWeapon(S, -1.6 + atk * 2.6, () => {
        line(S, 0, 0, 14 * s, 0, 2.6 * s, F3('#5a3a24'));
        ctx.fillStyle = F3(acc); ctx.beginPath(); ctx.moveTo(10 * s, -2 * s); ctx.lineTo(18 * s, -8 * s); ctx.quadraticCurveTo(21 * s, -1 * s, 17 * s, 5 * s); ctx.lineTo(10 * s, 2 * s); ctx.closePath(); ctx.fill();
      }, 6 * s);
      break;
    }
    case 'siegebow': {                                         // 발리스타: 바퀴 달린 거대 쇠뇌 · 감는 손잡이 · 뒤에서 조준하는 사수
      const t = MODEL.time, charge = Math.max(S.wind, atk > 0 ? 0 : 0.6);
      x3Wheel(S, -16 * s, -8 * s, 8 * s, 0, '#4a3a24', '#8a6a44');
      x3Wheel(S, 14 * s, -8 * s, 8 * s, 0, '#4a3a24', '#8a6a44');
      ctx.fillStyle = F3(tun); ctx.beginPath(); roundRectPath(ctx, -24 * s, -20 * s, 46 * s, 8 * s, 2 * s); ctx.fill();   // 수레
      line(S, -6 * s, -20 * s, 2 * s, -32 * s, 4 * s, F3('#5a4a34'));                                                     // 받침
      ctx.save(); ctx.translate(2 * s, -34 * s); ctx.rotate(-0.08);
      ctx.fillStyle = F3('#6a5034'); ctx.beginPath(); roundRectPath(ctx, -26 * s, -3 * s, 54 * s, 6 * s, 2 * s); ctx.fill();   // 몸통
      ctx.strokeStyle = F3('#3a2a1a'); ctx.lineWidth = 4 * s;                                                              // 활 팔
      const bend = 4 * s * charge;
      ctx.beginPath(); ctx.moveTo(18 * s - bend, -22 * s); ctx.quadraticCurveTo(26 * s, -10 * s, 24 * s, 0); ctx.quadraticCurveTo(26 * s, 10 * s, 18 * s - bend, 22 * s); ctx.stroke();
      ctx.strokeStyle = F3('#e8e0c8'); ctx.lineWidth = 1.2 * s; const nock = (10 - 24 * charge) * s;
      ctx.beginPath(); ctx.moveTo(18 * s - bend, -22 * s); ctx.lineTo(nock, 0); ctx.lineTo(18 * s - bend, 22 * s); ctx.stroke();
      if (charge > 0.2) { line(S, nock, 0, 40 * s, 0, 2.6 * s, F3('#8a6a44')); tri(S, 40 * s, -3.4 * s, 48 * s, 0, 40 * s, 3.4 * s, F3(acc)); }
      ctx.fillStyle = F3('#8a929e'); ctx.beginPath(); ctx.arc(-22 * s, 0, 4 * s, 0, 7); ctx.fill();                          // 감는 손잡이
      line(S, -22 * s, 0, -22 * s + Math.cos(t * 3) * 6 * s, Math.sin(t * 3) * 6 * s, 1.6 * s, F3('#5a6270'));
      ctx.restore();
      ctx.save(); ctx.translate(-30 * s, 0); ctx.scale(0.8, 0.8);                                                        // 뒤의 사수
      legs(S); torso(S, 4 * s); head(S, 'cap'); arm(S, 14 * s, -36 * s);
      ctx.restore();
      break;
    }
    /* ---------------------- 4.7 소환 영웅의 3진 (신화 · 전설 · 영웅) ---------------------- */
    case 'mechwukong': {                                       // 메카 대성: 제트 근두운 · 금빛 강철 갑옷 · 긴고아 바이저 · 늘어나는 여의봉
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const hov = -12 * s + Math.sin(t * 2.6) * 2.4 * s;
      if (!S.flash) {                                          // 등 뒤 기계 광배: 눈금 박힌 금빛 고리
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 0.22; ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.arc(-2 * s, -48 * s + hov, 24 * s, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.75; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 1.6 * s;
        ctx.beginPath(); ctx.arc(-2 * s, -48 * s + hov, 21 * s, 0, 7); ctx.stroke();
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * 0.8;
          ctx.beginPath(); ctx.moveTo(-2 * s + Math.cos(a) * 21 * s, -48 * s + hov + Math.sin(a) * 21 * s); ctx.lineTo(-2 * s + Math.cos(a) * 25 * s, -48 * s + hov + Math.sin(a) * 25 * s); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false;
      }
      // 근두운 제트: 흰 구름 덩이 · 아래로 뿜는 두 분사구
      if (live) for (const nx of [-10, 10]) {
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        const fl = 0.7 + 0.3 * Math.sin(t * 40 + nx);
        ctx.fillStyle = 'rgba(120,200,255,.55)'; ctx.beginPath(); ctx.moveTo((nx - 3) * s, hov + 4 * s); ctx.lineTo(nx * s, hov + (14 + 6 * fl) * s); ctx.lineTo((nx + 3) * s, hov + 4 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(240,250,255,.85)'; ctx.beginPath(); ctx.moveTo((nx - 1.4) * s, hov + 4 * s); ctx.lineTo(nx * s, hov + (9 + 3 * fl) * s); ctx.lineTo((nx + 1.4) * s, hov + 4 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3('#5a5e68');
      for (const nx of [-10, 10]) { ctx.beginPath(); roundRectPath(ctx, (nx - 3.4) * s, hov - 1 * s, 6.8 * s, 5.4 * s, 1.6 * s); ctx.fill(); }
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = F3(i % 2 ? '#fff4d0' : '#ffffff');
        ctx.beginPath(); ctx.arc((-21 + i * 7) * s, hov - 2 * s + Math.sin(t * 2 + i) * 1.2 * s, (5.4 + (i % 3) * 1.2) * s, 0, 7); ctx.fill();
      }
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(255,214,120,.35)';
        ctx.beginPath(); ctx.ellipse(0, hov - 1 * s, 22 * s, 2.4 * s, 0, 0, 7); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      ctx.save(); ctx.translate(0, hov - 4 * s);
      // 기계 꼬리: 마디마디 이어진 금속 · 끝에서 빛나는 고리
      const tail = [[-6, -22], [-14, -20], [-20, -26], [-22, -34], [-18, -41]];
      for (let i = 0; i < tail.length; i++) {
        const [tx, ty] = tail[i], w = Math.sin(t * 3 + i) * 1.2;
        ctx.fillStyle = F3(i % 2 ? '#c9a227' : '#8a5a2a'); ctx.beginPath(); ctx.arc(tx * s, (ty + w) * s, (3 - i * 0.3) * s, 0, 7); ctx.fill();
      }
      x3Glow(S, -18 * s, -42 * s, 2.6 * s, '#7ff0ff', live ? 0.5 + 0.3 * Math.sin(t * 5) : 0.4);
      legs(S);
      ctx.fillStyle = F3('#c9a227');                          // 강철 정강이 · 발
      for (const lx of [-4, 4]) { ctx.beginPath(); roundRectPath(ctx, (lx - 3.4) * s, -12 * s, 6.8 * s, 9 * s, 1.6 * s); ctx.fill(); }
      torso(S, 5 * s);
      ctx.fillStyle = F3(tun); ctx.beginPath(); roundRectPath(ctx, -10 * s, -45 * s, 20 * s, 21 * s, 4 * s); ctx.fill();   // 가슴 장갑
      if (hq) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = '#ffd23a'; ctx.fillRect(-10 * s, -33 * s, 20 * s, 2.4 * s); ctx.fillRect(-1.2 * s, -45 * s, 2.4 * s, 21 * s);
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-8 * s, -43 * s, 7 * s, 2 * s);
        ctx.restore(); ctx._skipInk = false; }
      x3Glow(S, 0, -38 * s, 3 * s, '#7ff0ff', live ? 0.55 + 0.25 * Math.sin(t * 4) : 0.45);   // 가슴의 동력로
      ctx.fillStyle = F3('#7ff0ff'); ctx.beginPath(); ctx.arc(0, -38 * s, 2.2 * s, 0, 7); ctx.fill();
      ctx.fillStyle = F3('#c9a227');                          // 큼직한 견갑
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 9 * s, -43 * s, 6.4 * s, 4.4 * s, sx * 0.2, Math.PI, 0); ctx.fill(); }
      head(S, 'monkeyface');
      ctx.fillStyle = F3('#ffd23a'); ctx.fillRect(-8.5 * s, -56 * s, 17 * s, 3.2 * s);           // 긴고아 테
      ctx.fillStyle = F3('#2a3040'); ctx.beginPath(); roundRectPath(ctx, 0.5 * s, -54.5 * s, 9 * s, 3.4 * s, 1.4 * s); ctx.fill();   // 바이저
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#7ff0ff'; ctx.fillRect(2 * s, -53.6 * s, 6.4 * s, 1.5 * s); ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, 5 * s, -52.8 * s, 2 * s, '#7ff0ff', 0.45 + (MODEL.angry ? 0.3 : 0)); }
      ctx.strokeStyle = F3('#ff5a3a'); ctx.lineWidth = 1.8 * s;  // 봉황 깃 안테나
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 4 * s, -58 * s); ctx.quadraticCurveTo(d * 16 * s, -76 * s + Math.sin(t * 2) * 2 * s, d * 26 * s, -70 * s); ctx.stroke(); }
      const ext = 1 + Math.max(atk, S.wind * 0.3) * 0.45;   // 칠 때 여의봉이 쭉 늘어난다
      armWeapon(S, -1.15 + atk * 2, () => {
        const L = 54 * s * ext;
        line(S, -24 * s, 0, L, 0, 4.4 * s, F3('#b03a3a'));
        if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#ffd23a';
          for (let i = 1; i < 5; i++) ctx.fillRect((-24 + i * (L / s + 24) / 5) * s - 1 * s, -2.4 * s, 2 * s, 4.8 * s);
          ctx.restore(); ctx._skipInk = false; }
        ctx.fillStyle = F3('#ffd23a'); ctx.fillRect(-27 * s, -3.4 * s, 7 * s, 6.8 * s); ctx.fillRect(L - 3 * s, -3.4 * s, 8 * s, 6.8 * s);
        if (live) { x3Glow(S, L + 1 * s, 0, 4 * s, '#ffe9a0', 0.35 + atk * 0.6);
          if (atk > 0.2) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.28 * atk; ctx.fillStyle = '#ffd35a';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L, -0.9 * atk, 0); ctx.closePath(); ctx.fill(); ctx.restore(); ctx._skipInk = false; } }
      }, 6 * s);
      ctx.restore();
      break;
    }
    case 'solarsat': {                                         // 태양 위성 라: 궤도에 뜬 금빛 위성 · 태양 전지판 날개 · 유리 덮개 속 매의 신 · 아래의 집광 렌즈
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const charge = Math.max(S.wind, atk > 0 ? 1 - atk : 0);
      const hov = -28 * s + Math.sin(t * 1.8) * 3 * s;
      ctx.save(); ctx.translate(0, hov);
      if (!S.flash) {                                          // 등 뒤 태양 원반: 도는 빛살
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 0.25 + charge * 0.25; ctx.fillStyle = '#ffb83a'; ctx.beginPath(); ctx.arc(0, -64 * s, 17 * s, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 2 * s;
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * 0.6, r0 = 19 * s, r1 = (24 + (i % 2) * 5) * s;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, -64 * s + Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, -64 * s + Math.sin(a) * r1); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.strokeStyle = F3('#c9a466'); ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.arc(0, -64 * s, 14 * s, 0, 7); ctx.stroke();   // 태양 고리
      for (const d of [-1, 1]) {                               // 태양 전지판 날개
        const tilt = Math.sin(t * 1.2) * 0.06 * d;
        ctx.save(); ctx.translate(d * 12 * s, -30 * s); ctx.rotate(tilt);
        line(S, 0, 0, d * 8 * s, 0, 2.4 * s, F3('#8a8e96'));
        ctx.fillStyle = F3('#1e2a5a'); ctx.beginPath();
        ctx.moveTo(d * 8 * s, -11 * s); ctx.lineTo(d * 40 * s, -15 * s); ctx.lineTo(d * 40 * s, 9 * s); ctx.lineTo(d * 8 * s, 6 * s); ctx.closePath(); ctx.fill();
        if (hq) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = '#c9a466'; ctx.lineWidth = 0.9 * s;
          for (let j = 1; j < 4; j++) { const x0 = d * (8 + j * 8) * s; ctx.beginPath(); ctx.moveTo(x0, (-11 - j) * s); ctx.lineTo(x0, (6 + j * 0.75) * s); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(d * 8 * s, -2.5 * s); ctx.lineTo(d * 40 * s, -3 * s); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,170,255,' + (0.18 + 0.12 * Math.sin(t * 3 + d)) + ')';
          ctx.beginPath(); ctx.moveTo(d * 10 * s, -10 * s); ctx.lineTo(d * 22 * s, -12 * s); ctx.lineTo(d * 20 * s, -4 * s); ctx.lineTo(d * 10 * s, -3 * s); ctx.closePath(); ctx.fill();
          ctx.restore(); ctx._skipInk = false; }
        ctx.restore();
      }
      ctx.fillStyle = F3('#c9a466');                          // 위성 몸통: 금빛 원통
      ctx.beginPath(); roundRectPath(ctx, -12 * s, -42 * s, 24 * s, 26 * s, 6 * s); ctx.fill();
      if (hq) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = '#8a6a34'; ctx.fillRect(-12 * s, -24 * s, 24 * s, 2.4 * s); ctx.fillRect(-12 * s, -36 * s, 24 * s, 1.6 * s);
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-9 * s, -40 * s, 3 * s, 14 * s);
        ctx.fillStyle = '#1e2a5a'; for (let i = 0; i < 3; i++) ctx.fillRect((-6 + i * 5) * s, -33 * s, 3 * s, 6 * s);
        ctx.restore(); ctx._skipInk = false; }
      head(S, 'nemes');                                        // 유리 덮개 속 매의 신
      tri(S, 8 * s, -53 * s, 18 * s, -50 * s, 8 * s, -47 * s, F3(acc));
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(190,230,255,.22)'; ctx.strokeStyle = 'rgba(220,245,255,.7)'; ctx.lineWidth = 1.2 * s;
        ctx.beginPath(); ctx.arc(0, -50 * s, 13 * s, Math.PI * 1.02, Math.PI * 2 - 0.02); ctx.lineTo(13 * s, -44 * s); ctx.lineTo(-13 * s, -44 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-5 * s, -57 * s, 4 * s, 2 * s, -0.5, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false; }
      // 아래의 집광 렌즈: 쏘기 전에 차오른다
      ctx.fillStyle = F3('#6a6e78'); ctx.beginPath(); ctx.moveTo(-7 * s, -16 * s); ctx.lineTo(7 * s, -16 * s); ctx.lineTo(4 * s, -9 * s); ctx.lineTo(-4 * s, -9 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3('#fff4c0'); ctx.beginPath(); ctx.ellipse(0, -8.6 * s, 4.4 * s, 1.8 * s, 0, 0, 7); ctx.fill();
      if (live) { x3Glow(S, 0, -8 * s, (3 + charge * 4) * s, acc, 0.35 + charge * 0.55);
        if (atk > 0.2) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= atk * 0.6; ctx.fillStyle = acc;
          ctx.beginPath(); ctx.moveTo(-4 * s, -8 * s); ctx.lineTo(4 * s, -8 * s); ctx.lineTo(10 * s, 26 * s); ctx.lineTo(-10 * s, 26 * s); ctx.closePath(); ctx.fill(); ctx.restore(); ctx._skipInk = false; } }
      if (live) for (const d of [-1, 1]) x3Puff(S, d * 9 * s, -12 * s + Math.sin(t * 3 + d) * 1 * s, 1.8 * s, 0.25, '#fff4d0');   // 자세 제어 분사
      ctx.restore();
      break;
    }
    case 'thunderbike': {                                      // 천둥 라이더: 번개 바이크 · 붉은 덮개 · 전조등 · 앞으로 숙인 토르 · 내리치는 묠니르
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const rot = S.moving ? -t * 14 : 0, bump = S.moving ? Math.abs(Math.sin(t * 18)) * 0.8 * s : 0;
      if (live && S.moving) {                                  // 바퀴 뒤로 튀는 번개 불티
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * s;
        for (let i = 0; i < 3; i++) { const k = ((t * 3 + i / 3) % 1);
          ctx.globalAlpha = (1 - k) * 0.8; ctx.beginPath(); ctx.moveTo(-36 * s - k * 22 * s, -4 * s); ctx.lineTo(-40 * s - k * 22 * s, -9 * s - i * 2 * s); ctx.lineTo(-44 * s - k * 26 * s, -3 * s); ctx.stroke(); }
        ctx.restore(); ctx._skipInk = false;
      }
      x3Wheel(S, -26 * s, -11 * s, 11 * s, rot, '#1e2026', '#5a6270');
      x3Wheel(S, 28 * s, -11 * s, 11 * s, rot, '#1e2026', '#5a6270');
      if (live) for (const wx of [-26, 28]) x3Glow(S, wx * s, -11 * s, 5 * s, acc, S.moving ? 0.35 + 0.2 * Math.sin(t * 20 + wx) : 0.15);
      ctx.save(); ctx.translate(0, -bump);
      ctx.fillStyle = F3('#2a2e36');                          // 차체 뼈대
      ctx.beginPath(); ctx.moveTo(-26 * s, -11 * s); ctx.lineTo(-10 * s, -26 * s); ctx.lineTo(18 * s, -26 * s); ctx.lineTo(28 * s, -11 * s); ctx.lineTo(20 * s, -9 * s); ctx.lineTo(4 * s, -18 * s); ctx.lineTo(-18 * s, -9 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(tun);                                 // 붉은 덮개 (연료통 · 앞 덮개)
      ctx.beginPath(); ctx.moveTo(-4 * s, -24 * s); ctx.quadraticCurveTo(10 * s, -34 * s, 26 * s, -30 * s); ctx.lineTo(38 * s, -22 * s); ctx.lineTo(30 * s, -16 * s); ctx.lineTo(4 * s, -18 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3('#1a1c22'); ctx.beginPath(); roundRectPath(ctx, -20 * s, -30 * s, 18 * s, 5 * s, 2 * s); ctx.fill();   // 안장
      if (hq) { ctx.save(); ctx._skipInk = true;
        ctx.strokeStyle = acc; ctx.lineWidth = 1.6 * s; ctx.beginPath();     // 덮개 위 번개 무늬
        ctx.moveTo(6 * s, -27 * s); ctx.lineTo(13 * s, -29 * s); ctx.lineTo(11 * s, -25 * s); ctx.lineTo(20 * s, -27 * s); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(12 * s, -30 * s, 8 * s, 1.6 * s, -0.2, 0, 7); ctx.fill();
        ctx.fillStyle = '#5a6270'; ctx.fillRect(-28 * s, -20 * s, 12 * s, 3 * s);    // 뒤 배터리 통
        ctx.fillStyle = acc; ctx.fillRect(-26 * s, -19.4 * s, 8 * s * (live ? 0.6 + 0.4 * Math.sin(t * 4) : 1), 1.8 * s);
        ctx.restore(); ctx._skipInk = false; }
      line(S, 26 * s, -30 * s, 30 * s, -38 * s, 2.6 * s, F3('#8a929e'));   // 핸들
      ctx.fillStyle = F3('#e8f4ff'); ctx.beginPath(); ctx.ellipse(37 * s, -23 * s, 2.4 * s, 3.2 * s, 0, 0, 7); ctx.fill();   // 전조등
      if (live) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.22; ctx.fillStyle = '#e8f8ff';
        ctx.beginPath(); ctx.moveTo(38 * s, -25 * s); ctx.lineTo(80 * s, -32 * s); ctx.lineTo(80 * s, -12 * s); ctx.closePath(); ctx.fill(); ctx.restore(); ctx._skipInk = false; }
      // 탄 토르: 다리는 발판에, 몸은 앞으로
      ctx.strokeStyle = F3(col); ctx.lineWidth = S.lw;
      ctx.beginPath(); ctx.moveTo(-10 * s, -30 * s); ctx.lineTo(0, -22 * s); ctx.lineTo(-4 * s, -13 * s); ctx.stroke();
      ctx.save(); ctx.translate(-10 * s, -8 * s); ctx.rotate(0.22);
      cape(S, -1, '#c0392b', 1.4);
      torso(S, 6.4 * s); head(S, 'wingedhelm', 10 * s); beard(S, '#f0c46a');
      if (!S.flash) { ctx.fillStyle = '#d8f4ff'; ctx.beginPath(); ctx.arc(5 * s, -52 * s, 1.8 * s, 0, 7); ctx.fill(); }
      armWeapon(S, -1.4 + atk * 2.2, () => {
        line(S, 0, 0, 30 * s, 0, 5 * s, F3('#4a3a2a'));
        ctx.fillStyle = F3('#8a929e'); ctx.beginPath(); roundRectPath(ctx, 26 * s, -15 * s, 26 * s, 30 * s, 4 * s); ctx.fill();
        ctx.fillStyle = F3(acc); ctx.fillRect(33 * s, -9 * s, 12 * s, 3.4 * s); ctx.fillRect(37.4 * s, -13 * s, 3.4 * s, 26 * s);
        if (live) { x3Glow(S, 39 * s, 0, 14 * s, acc, 0.22 + atk * 0.5);
          ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = acc; ctx.lineWidth = 1.4 * s;
          for (let i = 0; i < 2; i++) { const a = ((t * 11 | 0) + i * 3) * 2.39;
            ctx.beginPath(); ctx.moveTo(39 * s + Math.cos(a) * 12 * s, Math.sin(a) * 12 * s); ctx.lineTo(39 * s + Math.cos(a + 0.4) * 18 * s, Math.sin(a - 0.3) * 18 * s); ctx.lineTo(39 * s + Math.cos(a) * 24 * s, Math.sin(a) * 24 * s); ctx.stroke(); }
          ctx.restore(); ctx._skipInk = false; }
      }, 9 * s);
      ctx.restore();
      ctx.restore();
      break;
    }
    case 'holomage': {                                         // 홀로그램 대마도사: 회로 무늬 로브 · AR 바이저 · 떠다니는 홀로그램 룬 판 · 데이터 수정 지팡이
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const charge = Math.max(S.wind, atk > 0 ? 1 - atk : 0);
      if (!S.flash) for (let i = 0; i < 3; i++) {              // 몸을 도는 홀로그램 판 셋
        const a = t * 0.9 + i * 2.094, px = Math.cos(a) * 26 * s, py = -40 * s + Math.sin(a) * 9 * s, front = Math.sin(a) > 0;
        if (front) continue;
        holoPanel(ctx, s, px, py, 0.55 + 0.2 * Math.sin(t * 3 + i), acc);
      }
      robe(S, 20 * s, -46 * s, tun);
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = acc; ctx.globalAlpha *= 0.75; ctx.lineWidth = 1 * s;   // 회로 무늬
        ctx.beginPath(); ctx.moveTo(-8 * s, -6 * s); ctx.lineTo(-8 * s, -16 * s); ctx.lineTo(-3 * s, -21 * s); ctx.lineTo(-3 * s, -30 * s);
        ctx.moveTo(6 * s, -4 * s); ctx.lineTo(6 * s, -14 * s); ctx.lineTo(11 * s, -19 * s); ctx.moveTo(1 * s, -10 * s); ctx.lineTo(1 * s, -24 * s); ctx.stroke();
        ctx.fillStyle = acc; for (const [cx, cy] of [[-3, -30], [11, -19], [1, -24], [-8, -6]]) { ctx.beginPath(); ctx.arc(cx * s, cy * s, 1.2 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      head(S, 'wizard');
      beard(S, '#f2f0ea');
      ctx.fillStyle = F3('#1a1e2e'); ctx.beginPath(); roundRectPath(ctx, -1 * s, -54 * s, 11 * s, 4 * s, 1.6 * s); ctx.fill();   // AR 바이저
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; ctx.globalAlpha *= 0.85; ctx.fillRect(0.5 * s, -53.2 * s, 8 * s, 2.2 * s);
        ctx.fillStyle = '#ffffff'; ctx.fillRect((2 + ((t * 6) % 5)) * s, -52.8 * s, 1 * s, 1.4 * s); ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, 5 * s, -52 * s, 2.4 * s, acc, 0.35 + charge * 0.3); }
      armWeapon(S, -0.5 + atk * 0.6, () => {
        line(S, 0, 10 * s, 6 * s, -40 * s, 3 * s, F3('#3a3e4e'));
        if (hq) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.moveTo(1 * s, 2 * s); ctx.lineTo(5 * s, -32 * s); ctx.stroke(); ctx.restore(); ctx._skipInk = false; }
        const cx = 6.6 * s, cy = -49 * s, rr = 6 * s * (1 + charge * 0.25), sp = t * 2;   // 데이터 수정: 도는 팔면체 뼈대
        if (live) x3Glow(S, cx, cy, rr * 1.4, acc, 0.3 + charge * 0.5);
        ctx.save(); ctx._skipInk = true; ctx.strokeStyle = F3(acc); ctx.lineWidth = 1.3 * s;
        const pts = [[0, -rr], [Math.cos(sp) * rr * 0.7, 0], [Math.cos(sp + 2.1) * rr * 0.7, 0], [Math.cos(sp + 4.2) * rr * 0.7, 0], [0, rr]];
        ctx.beginPath();
        for (let i = 1; i <= 3; i++) { ctx.moveTo(cx, cy + pts[0][1]); ctx.lineTo(cx + pts[i][0], cy); ctx.lineTo(cx, cy + pts[4][1]); }
        ctx.moveTo(cx + pts[1][0], cy); ctx.lineTo(cx + pts[2][0], cy); ctx.lineTo(cx + pts[3][0], cy); ctx.closePath();
        ctx.stroke(); ctx.restore(); ctx._skipInk = false;
        if (live && atk > 0.15) {                              // 쏘는 순간: 지팡이 끝 홀로그램 마법진
          ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= atk; ctx.strokeStyle = acc; ctx.lineWidth = 1.2 * s;
          ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 + t; const px = cx + Math.cos(a) * 14 * s, py = cy + Math.sin(a) * 14 * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, cy, 9 * s, 0, 7); ctx.stroke();
          ctx.restore(); ctx._skipInk = false; }
      }, 8 * s);
      if (!S.flash) for (let i = 0; i < 3; i++) {              // 앞쪽 판
        const a = t * 0.9 + i * 2.094, px = Math.cos(a) * 26 * s, py = -40 * s + Math.sin(a) * 9 * s;
        if (Math.sin(a) <= 0) continue;
        holoPanel(ctx, s, px, py, 0.75 + 0.2 * Math.sin(t * 3 + i), acc);
      }
      break;
    }
    case 'jetvalk': {                                          // 제트팩 발키리: 날개 달린 투구 · 은빛 갑옷 · 금속 깃 날개를 단 제트팩 · 빛나는 창
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const hov = -7 * s + Math.sin(t * 3) * 2 * s - (S.moving ? 3 * s : 0);
      ctx.save(); ctx.translate(0, hov);
      const thrust = S.moving ? 1 : 0.55;
      valkWing(S, t, true);                                    // 금속 깃 날개 (뒤쪽)
      if (live) for (const nx of [-14, -9]) {                  // 분사 불꽃
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter';
        const fl = (0.8 + 0.2 * Math.sin(t * 45 + nx)) * thrust;
        ctx.fillStyle = 'rgba(255,170,60,.6)'; ctx.beginPath(); ctx.moveTo((nx - 2.4) * s, -22 * s); ctx.lineTo(nx * s - 2 * s, (-4 + 14 * fl) * s); ctx.lineTo((nx + 2.4) * s, -22 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,245,210,.9)'; ctx.beginPath(); ctx.moveTo((nx - 1) * s, -22 * s); ctx.lineTo(nx * s - 1 * s, (-12 + 7 * fl) * s); ctx.lineTo((nx + 1) * s, -22 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = F3('#8a929e'); ctx.beginPath(); roundRectPath(ctx, -17 * s, -44 * s, 11 * s, 22 * s, 3 * s); ctx.fill();   // 제트팩
      ctx.fillStyle = F3('#4a5260'); for (const nx of [-14, -9]) { ctx.beginPath(); roundRectPath(ctx, (nx - 2.2) * s, -25 * s, 4.4 * s, 4 * s, 1 * s); ctx.fill(); }
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; ctx.fillRect(-15 * s, -40 * s, 7 * s, 1.6 * s); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-16 * s, -43 * s, 2 * s, 16 * s); ctx.restore(); ctx._skipInk = false; }
      legs(S);
      ctx.fillStyle = F3('#c8ced6'); for (const lx of [-4, 4]) { ctx.beginPath(); roundRectPath(ctx, (lx - 3) * s, -11 * s, 6 * s, 8 * s, 1.6 * s); ctx.fill(); }   // 은빛 정강이
      torso(S, 5 * s);
      ctx.fillStyle = F3('#c8ced6'); ctx.beginPath(); roundRectPath(ctx, -8 * s, -45 * s, 16 * s, 15 * s, 4 * s); ctx.fill();   // 흉갑
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = tun; ctx.fillRect(-8 * s, -36 * s, 16 * s, 2.4 * s); ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(0, -40 * s, 2 * s, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-6 * s, -43 * s, 5 * s, 1.6 * s); ctx.restore(); ctx._skipInk = false; }
      head(S, 'wingedhelm');
      ctx.fillStyle = F3('#f0d890'); ctx.beginPath(); ctx.moveTo(-6 * s, -50 * s); ctx.quadraticCurveTo(-14 * s, -38 * s, -10 * s, -30 * s); ctx.lineTo(-6 * s, -42 * s); ctx.closePath(); ctx.fill();   // 땋은 머리
      armWeapon(S, -0.25 + atk * 0.5, () => {                  // 에너지 창
        line(S, -18 * s, 0, 50 * s, 0, 3 * s, F3('#c8ced6'));
        ctx.fillStyle = F3(acc); ctx.beginPath(); ctx.moveTo(48 * s, -4 * s); ctx.lineTo(64 * s, 0); ctx.lineTo(48 * s, 4 * s); ctx.closePath(); ctx.fill();
        if (live) { x3Glow(S, 56 * s, 0, 5 * s, acc, 0.4 + atk * 0.5);
          if (atk > 0.2) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= atk * 0.5; line(S, 20 * s, 0, 70 * s, 0, 7 * s, acc); ctx.restore(); ctx._skipInk = false; } }
      }, 4 * s);
      valkWing(S, t, false);                                   // 앞쪽 날개
      ctx.restore();
      break;
    }
    case 'moonbow': {                                          // 달빛 레이저 궁수: 바이저 · 몸에 붙는 청록 옷 · 빛으로 된 초승달 활 · 어깨 위 달 드론
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const pull = S.wind > 0 ? S.wind : 0;
      cape(S, -1, x3Hex(tun, 0.1), 1.0);
      legs(S); torso(S, 4.4 * s);
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 1 * s; ctx.globalAlpha *= 0.8;   // 옷의 빛 선
        ctx.beginPath(); ctx.moveTo(-3 * s, -44 * s); ctx.lineTo(2 * s, -24 * s); ctx.moveTo(-4 * s, -20 * s); ctx.lineTo(-4 * s, -2 * s); ctx.moveTo(4 * s, -20 * s); ctx.lineTo(5 * s, -2 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false; }
      head(S, 'moon');
      ctx.fillStyle = F3('#1a2230'); ctx.beginPath(); roundRectPath(ctx, 0, -53.6 * s, 10 * s, 3.4 * s, 1.4 * s); ctx.fill();   // 조준 바이저
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; ctx.fillRect(1.4 * s, -52.8 * s, 7.4 * s, 1.6 * s); ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, 5 * s, -52 * s, 2 * s, acc, 0.4 + pull * 0.4); }
      // 어깨 위 달 드론: 작은 초승달 · 푸른 눈
      const dx = -14 * s + Math.cos(t * 1.6) * 4 * s, dy = -66 * s + Math.sin(t * 2.2) * 3 * s;
      ctx.fillStyle = F3('#e8f4ff'); ctx.beginPath(); ctx.arc(dx, dy, 5 * s, 0.6, Math.PI * 2 - 0.6); ctx.arc(dx + 3 * s, dy, 4 * s, Math.PI * 2 - 0.9, 0.9, true); ctx.closePath(); ctx.fill();
      if (live) x3Glow(S, dx - 1.6 * s, dy, 1.6 * s, acc, 0.6);
      // 초승달 레이저 활 (몸 앞)
      const bx = 20 * s, by = -36 * s, br = 22 * s;
      if (live) { ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.3; ctx.strokeStyle = acc; ctx.lineWidth = 7 * s;
        ctx.beginPath(); ctx.arc(bx - 8 * s, by, br, -1.15, 1.15); ctx.stroke(); ctx.restore(); ctx._skipInk = false; }
      ctx.strokeStyle = F3(acc); ctx.lineWidth = 3.4 * s;
      ctx.beginPath(); ctx.arc(bx - 8 * s, by, br, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = F3('#f4feff'); ctx.lineWidth = 1.2 * s;
      ctx.beginPath(); ctx.arc(bx - 8 * s, by, br - 1 * s, -1.05, 1.05); ctx.stroke();
      ctx.fillStyle = F3('#2a3a4a'); ctx.beginPath(); roundRectPath(ctx, bx + 10 * s, by - 4 * s, 4 * s, 8 * s, 1.4 * s); ctx.fill();   // 손잡이
      const ex = bx - 8 * s + Math.cos(1.15) * br, ey = Math.sin(1.15) * br, nock = bx - 4 * s - pull * 12 * s + (atk > 0 ? -Math.sin(atk * Math.PI * 3) * 2 * s * atk : 0);
      ctx.save(); ctx._skipInk = true;                         // 레이저 시위
      if (!S.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = acc; ctx.lineWidth = 1.6 * s; }
      else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2 * s; }
      ctx.beginPath(); ctx.moveTo(ex, by - ey); ctx.lineTo(nock, by); ctx.lineTo(ex, by + ey); ctx.stroke();
      if (live && pull > 0.05) {                               // 당기면 빛 화살이 맺힌다
        ctx.globalAlpha *= pull; ctx.strokeStyle = '#f4feff'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.moveTo(nock, by); ctx.lineTo(bx + 24 * s, by); ctx.stroke();
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(bx + 24 * s, by, 2.4 * s, 0, 7); ctx.fill();
      }
      ctx.restore(); ctx._skipInk = false;
      arm(S, bx + 12 * s, by); arm(S, nock, by);
      break;
    }
    /* ---------------------- 4.4 3진 넷 더 ---------------------- */
    case 'bulldozer': {                                        // 방패 불도저: 궤도 · 노란 차체 · 유압 팔에 달린 큰 삽 · 운전석의 방패병 · 경광등
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const body = x3Hex(tun, 0), bodyD = x3Hex(tun, -0.3), steel = '#5a5e68', steelD = '#3a3d44';
      const mv = S.moving, roll = mv ? phase * 8 : 0;
      const rum = mv && S.live ? Math.sin(t * 34) * 0.4 * s : 0;
      const lift = S.wind * 10 * s, push = atk * 9 * s;         // 준비: 삽을 들고, 칠 때: 땅에 붙여 밀어낸다
      if (live) for (let i = 0; i < 3; i++) {                  // 배기 연기
        const q = (t * (mv ? 1.4 : 0.6) + i / 3) % 1;
        x3Puff(S, (-20 - q * 10) * s, (-60 - q * 22) * s, (2 + q * 5) * s, (1 - q) * (mv || atk > 0 ? 0.55 : 0.28), '#c8c2b8');
      }
      if (live && mv) for (let i = 0; i < 2; i++) {            // 궤도 흙먼지
        const q = (t * 2 + i / 2) % 1;
        x3Puff(S, (-38 - q * 16) * s, (-3 - q * 7) * s, (2 + q * 4) * s, (1 - q) * 0.4, '#d8c8a8');
      }
      ctx.save(); ctx.translate(0, rum);
      ctx.fillStyle = F3('#34363c');                           // 궤도
      ctx.beginPath(); ctx.moveTo(-32 * s, -15 * s); ctx.lineTo(18 * s, -15 * s); ctx.quadraticCurveTo(27 * s, -7.5 * s, 18 * s, 0);
      ctx.lineTo(-32 * s, 0); ctx.quadraticCurveTo(-41 * s, -7.5 * s, -32 * s, -15 * s); ctx.fill();
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(160,162,170,.6)'; const off = ((roll % 6) + 6) % 6;
        for (let x = -31 + off; x < 17; x += 6) ctx.fillRect(x * s, -15 * s, 2.6 * s, 2 * s);
        for (let x = 16 - off; x > -32; x -= 6) ctx.fillRect(x * s, -2 * s, 2.6 * s, 2 * s);
        ctx.restore(); ctx._skipInk = false; }
      for (const wx of [-21, -9, 3]) x3Wheel(S, wx * s, -7.5 * s, 4.8 * s, roll * 0.7, '#26282c', '#8c8a80');
      x3Wheel(S, 14 * s, -8 * s, 5.4 * s, roll * 0.65, '#26282c', '#a09a88');
      x3Wheel(S, -32 * s, -7.5 * s, 4.4 * s, roll * 0.85, '#26282c', '#8c8a80');
      // 유압 팔 (삽은 몸통 앞에서 오르내린다)
      const bx = 25 * s + push, bot = -1 * s - lift, top = bot - 30 * s;
      line(S, 4 * s, -24 * s, bx + 2 * s, top + 9 * s, 4 * s, F3(steelD));
      line(S, 10 * s, -13 * s, bx + 2 * s, bot - 6 * s, 3.4 * s, F3(steelD));
      ctx.fillStyle = F3('#c8ccd4'); ctx.fillRect(10 * s, -24.5 * s, 9 * s, 2 * s);                   // 실린더 막대
      ctx.fillStyle = F3(body);                                // 차체 · 엔진 덮개
      ctx.beginPath(); ctx.moveTo(-36 * s, -15 * s); ctx.lineTo(16 * s, -15 * s); ctx.lineTo(16 * s, -31 * s); ctx.lineTo(-30 * s, -33 * s); ctx.lineTo(-36 * s, -28 * s); ctx.closePath(); ctx.fill();
      if (hq) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = shade(body, -0.22); ctx.fillRect(-36 * s, -19 * s, 52 * s, 4 * s);
        ctx.fillStyle = 'rgba(40,30,10,.45)'; for (let i = 0; i < 4; i++) ctx.fillRect((-28 + i * 5) * s, -30 * s, 3 * s, 8 * s);   // 방열 격자
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-30 * s, -32.4 * s, 44 * s, 1.3 * s);
        ctx.fillStyle = '#26262a';                             // 경고 줄무늬
        for (let i = 0; i < 5; i++) { const x0 = (-34 + i * 7) * s; ctx.beginPath(); ctx.moveTo(x0, -15 * s); ctx.lineTo(x0 + 3 * s, -15 * s); ctx.lineTo(x0 + 6 * s, -19 * s); ctx.lineTo(x0 + 3 * s, -19 * s); ctx.closePath(); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = F3('#3a3c42'); ctx.fillRect(-22 * s, -46 * s, 4 * s, 14 * s);                     // 배기관
      ctx.fillStyle = F3(body);                                // 운전석
      ctx.beginPath(); ctx.moveTo(-14 * s, -33 * s); ctx.lineTo(-12 * s, -56 * s); ctx.lineTo(8 * s, -56 * s); ctx.lineTo(13 * s, -33 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3('#bfe4ff'); ctx.beginPath(); ctx.moveTo(-9 * s, -36 * s); ctx.lineTo(-8 * s, -52 * s); ctx.lineTo(5.5 * s, -52 * s); ctx.lineTo(9.5 * s, -36 * s); ctx.closePath(); ctx.fill();
      const O = Object.assign(sub(S, 0.42, 2 * s), { acc: S.flash ? '#ffffff' : acc });   // 운전석의 방패병 (안전모)
      ctx.save(); ctx.translate(-0.5 * s, -21.5 * s); head(O, 'cap'); ctx.restore();
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.beginPath(); ctx.moveTo(2 * s, -52 * s); ctx.lineTo(4.5 * s, -52 * s); ctx.lineTo(-1 * s, -36 * s); ctx.lineTo(-3.5 * s, -36 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = F3(bodyD); ctx.fillRect(-14 * s, -58 * s, 23 * s, 3 * s);                           // 지붕
      ctx.fillStyle = F3(acc); ctx.beginPath(); roundRectPath(ctx, -5 * s, -63 * s, 6 * s, 5 * s, 2 * s); ctx.fill();   // 경광등
      if (live) {
        const a = t * 8, face = Math.max(0, Math.sin(a)), L = Math.cos(a) * 40 * s;
        x3Glow(S, -2 * s, -60.5 * s, (2.6 + face * 2) * s, acc, 0.4 + face * 0.4);
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.16; ctx.fillStyle = acc;
        ctx.beginPath(); ctx.moveTo(-2 * s, -62 * s); ctx.lineTo(-2 * s + L, -67 * s); ctx.lineTo(-2 * s + L, -54 * s); ctx.lineTo(-2 * s, -59 * s); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx._skipInk = false;
      }
      if (live && (mv || atk > 0)) {                           // 삽 앞에 밀려 쌓이는 흙더미
        const h = (6 + Math.abs(Math.sin(phase)) * 2 + atk * 4) * s;
        ctx.fillStyle = '#8a6e4a'; ctx.beginPath(); ctx.moveTo(bx + 10 * s, 0); ctx.quadraticCurveTo(bx + 18 * s, -h * 1.6, bx + 26 * s, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6a5236'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(bx + (15 + i * 4) * s, -(1.5 + (i % 2) * 2) * s, 1.3 * s, 0, 7); ctx.fill(); }
      }
      ctx.fillStyle = F3(bodyD);                               // 삽 옆판 (두께)
      ctx.beginPath(); ctx.moveTo(bx, top + 3 * s); ctx.lineTo(bx + 6 * s, top); ctx.lineTo(bx + 6 * s, bot); ctx.lineTo(bx, bot); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(steel);                               // 큰 삽: 휘어진 앞면
      ctx.beginPath(); ctx.moveTo(bx + 5 * s, top); ctx.lineTo(bx + 11 * s, top - 1 * s);
      ctx.quadraticCurveTo(bx + 19 * s, top + 13 * s, bx + 15 * s, bot); ctx.lineTo(bx + 5 * s, bot); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(body); ctx.beginPath(); ctx.moveTo(bx + 4 * s, top + 1 * s); ctx.lineTo(bx + 11.5 * s, top - 1.5 * s); ctx.lineTo(bx + 13 * s, top + 2.5 * s); ctx.lineTo(bx + 5 * s, top + 4.5 * s); ctx.closePath(); ctx.fill();   // 위 테두리
      ctx.fillStyle = F3('#d8dce4'); ctx.beginPath(); ctx.moveTo(bx + 5 * s, bot - 3 * s); ctx.lineTo(bx + 15.6 * s, bot - 3 * s); ctx.lineTo(bx + 17 * s, bot); ctx.lineTo(bx + 5 * s, bot); ctx.closePath(); ctx.fill();   // 날
      if (hq) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = 'rgba(255,255,255,.28)';               // 휜 면에 비친 빛
        ctx.beginPath(); ctx.moveTo(bx + 11 * s, top + 3 * s); ctx.quadraticCurveTo(bx + 16.5 * s, top + 13 * s, bx + 14 * s, bot - 4 * s); ctx.lineTo(bx + 12 * s, bot - 4 * s);
        ctx.quadraticCurveTo(bx + 14 * s, top + 13 * s, bx + 9 * s, top + 3 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(20,20,26,.35)'; ctx.fillRect(bx + 5 * s, top + 4 * s, 2.4 * s, bot - top - 7 * s);
        ctx.fillStyle = 'rgba(30,20,10,.4)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(bx + 3 * s, top + (6 + i * 6.5) * s, 0.9 * s, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(120,90,50,.45)';                 // 삽에 묻은 흙
        ctx.beginPath(); ctx.ellipse(bx + 12 * s, bot - 6 * s, 3 * s, 2 * s, 0.4, 0, 7); ctx.fill();
        ctx.restore(); ctx._skipInk = false; }
      ctx.restore();
      break;
    }

    case 'icecart': {                                          // 빙수 마도사: 줄무늬 파라솔 · 빙수 수레 · 산처럼 쌓인 빙수 · 국자 든 마도사
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const cart = x3Hex(tun, 0), cartD = x3Hex(tun, -0.28), pink = acc;
      const mv = S.moving, roll = mv ? phase * 6 : 0;
      const bob = mv ? Math.abs(Math.sin(phase)) * 0.8 * s : 0;
      legs(S); torso(S, 5 * s);
      ctx.fillStyle = F3(x3Hex(tun, 0.35));                    // 목도리
      ctx.fillRect(-5 * s, -43 * s, 11 * s, 3.4 * s); ctx.fillRect(-6 * s, -42 * s, 3 * s, 9 * s);
      head(S, 'furhood');
      ctx.save(); ctx.translate(0, -bob);
      // 파라솔
      line(S, 26 * s, -30 * s, 24 * s, -74 * s, 1.6 * s, F3('#8a8e98'));
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = F3(i % 2 ? '#fbf4ee' : pink);
        const a0 = -Math.PI + i * Math.PI / 6, a1 = a0 + Math.PI / 6;
        ctx.beginPath(); ctx.moveTo(24 * s, -76 * s);
        ctx.lineTo(24 * s + Math.cos(a0) * 26 * s, -66 * s + Math.sin(a0) * 2 * s); ctx.lineTo(24 * s + Math.cos(a1) * 26 * s, -66 * s + Math.sin(a1) * 2 * s); ctx.closePath(); ctx.fill();
      }
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = 'rgba(255,255,255,.3)';
        ctx.beginPath(); ctx.moveTo(24 * s, -76 * s); ctx.lineTo(4 * s, -67 * s); ctx.lineTo(12 * s, -67 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = pink; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc((-1 + i * 8.3) * s, -65.6 * s, 2 * s, 0, Math.PI); ctx.fill(); }   // 술 장식
        ctx.restore(); ctx._skipInk = false; }
      ctx.fillStyle = F3(cart);                                // 수레 몸통
      ctx.beginPath(); roundRectPath(ctx, 8 * s, -31 * s, 38 * s, 20 * s, 3 * s); ctx.fill();
      ctx.fillStyle = F3(cartD); ctx.fillRect(8 * s, -14 * s, 38 * s, 3 * s);
      if (hq) { ctx.save(); ctx._skipInk = true;
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(10 * s, -29.5 * s, 34 * s, 1.4 * s);
        ctx.fillStyle = '#fbf4ee'; ctx.beginPath(); ctx.arc(27 * s, -21.5 * s, 5.5 * s, 0, 7); ctx.fill();   // 눈송이 간판
        ctx.strokeStyle = cartD; ctx.lineWidth = 1 * s; ctx.beginPath();
        for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(27 * s + Math.cos(a) * 4 * s, -21.5 * s + Math.sin(a) * 4 * s); ctx.lineTo(27 * s - Math.cos(a) * 4 * s, -21.5 * s - Math.sin(a) * 4 * s); }
        ctx.stroke(); ctx.restore(); ctx._skipInk = false; }
      // 빙수 그릇 · 산처럼 쌓인 얼음 · 시럽 · 체리
      ctx.fillStyle = F3('#d8e8f4'); ctx.beginPath(); ctx.moveTo(15 * s, -31 * s); ctx.lineTo(39 * s, -31 * s); ctx.lineTo(36 * s, -36 * s); ctx.lineTo(18 * s, -36 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3('#fbfdff'); ctx.beginPath(); ctx.moveTo(17 * s, -36 * s); ctx.quadraticCurveTo(19 * s, -52 * s, 27 * s, -53 * s); ctx.quadraticCurveTo(35 * s, -52 * s, 37 * s, -36 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F3(pink); ctx.beginPath(); ctx.moveTo(20 * s, -44 * s); ctx.quadraticCurveTo(27 * s, -55 * s, 34 * s, -44 * s); ctx.quadraticCurveTo(31 * s, -40 * s, 30 * s, -43 * s);
      ctx.quadraticCurveTo(28 * s, -39 * s, 26 * s, -43 * s); ctx.quadraticCurveTo(23 * s, -40 * s, 20 * s, -44 * s); ctx.fill();
      ctx.fillStyle = F3('#e8203a'); ctx.beginPath(); ctx.arc(27 * s, -54.5 * s, 2.4 * s, 0, 7); ctx.fill();
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.strokeStyle = '#3a6a2a'; ctx.lineWidth = 0.8 * s;
        ctx.beginPath(); ctx.moveTo(27 * s, -56.5 * s); ctx.quadraticCurveTo(29 * s, -60 * s, 31 * s, -60 * s); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(26.2 * s, -55.4 * s, 0.7 * s, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(160,200,230,.5)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc((20 + i * 3) * s, (-38 - (i % 3) * 2) * s, 0.8 * s, 0, 7); ctx.fill(); }
        ctx.restore(); ctx._skipInk = false; }
      if (live) {                                              // 차가운 김 · 반짝이는 얼음 알갱이
        for (let i = 0; i < 3; i++) { const q = (t * 0.5 + i / 3) % 1; x3Puff(S, (22 + i * 5) * s, (-52 - q * 14) * s, (1.6 + q * 3) * s, (1 - q) * 0.3, '#eef8ff'); }
        ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#dff6ff';
        for (let i = 0; i < 4; i++) { const a = t * 1.3 + i * 1.57, q = (t * 0.7 + i / 4) % 1;
          ctx.globalAlpha = (1 - q) * 0.8; const px = (27 + Math.cos(a) * 16) * s, py = (-44 - q * 18) * s;
          ctx.fillRect(px - 1 * s, py - 0.3 * s, 2 * s, 0.6 * s); ctx.fillRect(px - 0.3 * s, py - 1 * s, 0.6 * s, 2 * s); }
        ctx.restore(); ctx._skipInk = false;
      }
      line(S, 8 * s, -27 * s, 1 * s, -30 * s, 2 * s, F3('#8a8e98'));          // 손잡이
      x3Wheel(S, 16 * s, -8 * s, 6.2 * s, roll, '#3a3c42', '#e8e4dc');
      x3Wheel(S, 38 * s, -8 * s, 6.2 * s, roll, '#3a3c42', '#e8e4dc');
      ctx.restore();
      arm(S, 3 * s, -31 * s);                                  // 손잡이를 잡은 손
      armWeapon(S, -0.6 - atk * 1.2, () => {                   // 얼음 국자: 칠 때 퍼서 던진다
        line(S, 0, 0, 16 * s, 0, 2 * s, F3('#c8ccd4'));
        ctx.fillStyle = F3('#c8ccd4'); ctx.beginPath(); ctx.arc(18 * s, 0, 4 * s, 0, Math.PI); ctx.fill();
        ctx.fillStyle = F3('#fbfdff'); ctx.beginPath(); ctx.arc(18 * s, -0.5 * s, 3.4 * s, Math.PI, 0); ctx.fill();
      }, 6 * s);
      break;
    }

    case 'lightsaber': {                                       // 광선검 검성: 두건 달린 겉옷 · 빛나는 눈 · 웅웅 떨리는 푸른 광선검
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      cape(S, -1, x3Hex(tun, 0.08), 1.25);
      legs(S); robe(S, 15 * s, -44 * s, tun);
      if (hq) { ctx.save(); ctx._skipInk = true;                 // 허리띠 · 앞섶
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-7 * s, -30 * s, 15 * s, 3 * s);
        ctx.fillStyle = '#c8b070'; ctx.fillRect(-1 * s, -30.4 * s, 3.4 * s, 3.8 * s);
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(1 * s, -44 * s); ctx.lineTo(-3 * s, -6 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false; }
      head(Object.assign({}, S, { acc: S.flash ? '#ffffff' : x3Hex(tun, 0.14) }), 'hood');   // 두건은 어두운 겉옷 색
      if (!S.flash) {                                          // 두건 그늘 속 빛나는 눈
        ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc;
        ctx.fillRect(3 * s, -51 * s, 3.2 * s, 1.3 * s);
        ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, 4.6 * s, -50.4 * s, 1.6 * s, acc, 0.5 + (MODEL.angry ? 0.3 : 0));
      }
      const hum = 1 + Math.sin(t * 37) * 0.06 + Math.sin(t * 23) * 0.04;
      armWeapon(S, -1.1 + atk * 2.2, () => {
        ctx.fillStyle = F3('#5a5e68'); ctx.beginPath(); roundRectPath(ctx, -6 * s, -2 * s, 14 * s, 4 * s, 1.4 * s); ctx.fill();   // 손잡이
        if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#26262a';
          for (let i = 0; i < 4; i++) ctx.fillRect((-4.5 + i * 2.6) * s, -2 * s, 1.1 * s, 4 * s);
          ctx.fillStyle = '#c8ccd4'; ctx.fillRect(6 * s, -2.8 * s, 3 * s, 5.6 * s);
          ctx.fillStyle = '#ff4a4a'; ctx.fillRect(1 * s, -2.6 * s, 1.4 * s, 0.9 * s);
          ctx.restore(); ctx._skipInk = false; }
        else { ctx.fillStyle = F3('#c8ccd4'); ctx.fillRect(6 * s, -2.8 * s, 3 * s, 5.6 * s); }
        // 날: 바깥 빛 · 색 · 흰 심
        ctx.save(); ctx._skipInk = true;
        if (!S.flash) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha *= 0.28 * hum; line(S, 9 * s, 0, 56 * s, 0, 9 * s * hum, acc);
          ctx.globalAlpha /= 0.28 * hum; ctx.globalAlpha *= 0.55; line(S, 9 * s, 0, 56 * s, 0, 5 * s * hum, acc);
          ctx.globalAlpha /= 0.55;
          ctx.globalCompositeOperation = 'source-over';
        }
        line(S, 9 * s, 0, 55 * s, 0, 2.4 * s, S.flash ? '#ffffff' : '#f4feff');
        ctx.restore(); ctx._skipInk = false;
        if (live && atk > 0.15) {                              // 휘두른 자리에 남는 빛 잔상
          ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.3 * atk; ctx.fillStyle = acc;
          ctx.beginPath(); ctx.moveTo(9 * s, 0); ctx.arc(9 * s, 0, 47 * s, -0.9 * atk, 0); ctx.closePath(); ctx.fill();
          ctx.restore(); ctx._skipInk = false;
        }
      }, 6 * s);
      if (live) x3Glow(S, 14 * s, -36 * s, 5 * s, acc, 0.12);    // 칼빛이 몸을 비춘다
      break;
    }

    case 'railgun': {                                          // 레일건 저격수: 전자 헬멧 · 등의 축전지와 전선 · 코일이 차례로 켜지는 두 줄 레일
      const hq = MODEL.ink && !S.flash, live = S.live && !S.flash, t = MODEL.time;
      const charge = Math.max(S.wind, atk > 0 ? 1 - atk : 0);   // 준비할 때 차오르고, 쏘면 비워진다
      ctx.fillStyle = F3('#3a4250');                           // 등의 축전지
      ctx.beginPath(); roundRectPath(ctx, -15 * s, -48 * s, 10 * s, 20 * s, 2 * s); ctx.fill();
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = '#1a1e26'; ctx.fillRect(-13 * s, -45 * s, 6 * s, 14 * s);
        ctx.fillStyle = acc; const lvl = 0.35 + 0.65 * (live ? (charge > 0 ? charge : 0.5 + 0.5 * Math.sin(t * 2)) : 1);
        ctx.fillRect(-12.2 * s, -31.6 * s - 12 * s * lvl, 4.4 * s, 12 * s * lvl);
        ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, -10 * s, -38 * s, 3 * s, acc, 0.25 + charge * 0.4); }
      legs(S); torso(S, 5 * s);
      if (hq) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = shade(tun, 0.3);   // 가슴 보호판 · 어깨끈
        ctx.fillRect(-4 * s, -42 * s, 9 * s, 7 * s); ctx.fillStyle = acc; ctx.fillRect(-3 * s, -37.6 * s, 7 * s, 1 * s);
        ctx.fillStyle = shade(tun, -0.35); ctx.save(); ctx.translate(0, -36 * s); ctx.rotate(0.6); ctx.fillRect(-1 * s, -9 * s, 2 * s, 18 * s); ctx.restore();
        ctx.restore(); ctx._skipInk = false; }
      head(S, 'cap');
      ctx.fillStyle = F3('#2a3038'); ctx.beginPath(); roundRectPath(ctx, 1 * s, -54 * s, 10 * s, 5 * s, 1.6 * s); ctx.fill();   // 조준 바이저
      if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; ctx.fillRect(3 * s, -52.8 * s, 7 * s, 2.2 * s); ctx.restore(); ctx._skipInk = false;
        if (live) x3Glow(S, 7 * s, -51.7 * s, 2 * s, acc, 0.4 + charge * 0.3); }
      if (!S.flash) {                                          // 전선: 축전지에서 총으로
        ctx.save(); ctx._skipInk = true; ctx.strokeStyle = '#1a1e26'; ctx.lineWidth = 1.4 * s;
        ctx.beginPath(); ctx.moveTo(-6 * s, -34 * s); ctx.quadraticCurveTo(0, -22 * s, 9 * s, -31 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false;
      }
      armWeapon(S, -0.04, () => {
        ctx.fillStyle = F3('#4a5260'); ctx.beginPath(); roundRectPath(ctx, -12 * s, -4 * s, 24 * s, 9 * s, 2 * s); ctx.fill();    // 몸통 · 개머리
        ctx.fillStyle = F3('#3a4250'); ctx.beginPath(); ctx.moveTo(-12 * s, -3 * s); ctx.lineTo(-20 * s, -1 * s); ctx.lineTo(-20 * s, 6 * s); ctx.lineTo(-12 * s, 5 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = F3('#2a3038'); ctx.fillRect(-2 * s, -9 * s, 12 * s, 4 * s);                            // 조준경
        if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.fillStyle = acc; ctx.fillRect(8.5 * s, -8.4 * s, 1.4 * s, 2.8 * s); ctx.restore(); ctx._skipInk = false; }
        ctx.fillStyle = F3('#8a929e');                         // 두 줄 레일
        ctx.fillRect(12 * s, -3.6 * s, 58 * s, 2.4 * s); ctx.fillRect(12 * s, 2.2 * s, 58 * s, 2.4 * s);
        if (!S.flash) {
          ctx.save(); ctx._skipInk = true;
          ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(12 * s, -3.6 * s, 58 * s, 0.8 * s);
          ctx.fillStyle = '#1a1e26'; ctx.fillRect(12 * s, -1.2 * s, 58 * s, 3.4 * s);          // 레일 사이 틈
          if (live) {                                          // 틈을 따라 흐르는 전기
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35 + charge * 0.6; ctx.fillStyle = acc;
            ctx.fillRect(12 * s, -0.4 * s, 58 * s, 1.8 * s);
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          }
          ctx.restore(); ctx._skipInk = false;
        }
        for (let i = 0; i < 5; i++) {                          // 코일 고리: 차례로 켜진다
          const cx = (18 + i * 11) * s, on = live && (charge > i / 5 || (((t * 4) % 5) | 0) === i);
          ctx.fillStyle = F3(on ? '#d8f8ff' : '#5a6270'); ctx.beginPath(); roundRectPath(ctx, cx - 1.8 * s, -5.6 * s, 3.6 * s, 12.2 * s, 1.2 * s); ctx.fill();
          if (on) x3Glow(S, cx, 0.5 * s, 3 * s, acc, 0.35 + charge * 0.4);
        }
        ctx.fillStyle = F3('#3a4250'); ctx.fillRect(68 * s, -5 * s, 4 * s, 11 * s);                         // 총구 틀
        if (live && atk > 0.3) {                               // 쏜 순간: 총구 섬광
          const k = (atk - 0.3) / 0.7;
          ctx.save(); ctx._skipInk = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= k;
          ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(76 * s, 0.5 * s, 9 * s, 4 * s, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(74 * s, 0.5 * s, 5 * s, 2 * s, 0, 0, 7); ctx.fill();
          ctx.restore(); ctx._skipInk = false;
        }
      }, 4 * s);
      break;
    }

    /* ---------------------- 4.0 원탁의 기사 ---------------------- */
    case 'arthur': {                                           // 아서왕: 왕관 · 푸른 망토 · 빛나는 엑스칼리버 · 붉은 용 방패
      cape(S, -1, tun, 1.3);
      legs(S); torso(S, 5 * s); head(S, 'crown');
      shieldShape(S, -30 * s, -50 * s, 13 * s, 38 * s, S.flash ? '#fff' : '#e8e0c8');
      if (!S.flash) { ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-26 * s, -40 * s); ctx.lineTo(-20 * s, -36 * s);
        ctx.lineTo(-24 * s, -30 * s); ctx.lineTo(-19 * s, -24 * s); ctx.lineTo(-25 * s, -26 * s); ctx.closePath(); ctx.fill(); }
      armWeapon(S, -1.35 + atk * 2.1, () => {
        if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.35 + 0.15 * Math.sin(MODEL.time * 4);
          line(S, 6 * s, 0, 60 * s, 0, 12 * s, '#fff6c8'); ctx.restore(); ctx._skipInk = false; }
        line(S, 0, 0, 58 * s, 0, 5.5 * s, S.flash ? '#fff' : '#f4f1e8');
        line(S, 5 * s, -10 * s, 5 * s, 10 * s, 3.6 * s, S.flash ? '#fff' : acc);
        orb(S, -2 * s, 0, 2.6 * s, S.flash ? '#fff' : '#4a7ae8');
      }, 8 * s);
      break;
    }
    case 'merlin': {                                           // 멀린: 별 무늬 로브 · 긴 흰 수염 · 푸른 구슬 지팡이
      robe(S, 20 * s, -46 * s, tun);
      if (!S.flash) { ctx.fillStyle = acc; for (const [x0, y0] of [[-8, -30], [6, -20], [-2, -12], [10, -36]]) {
        ctx.beginPath(); ctx.arc(x0 * s, y0 * s, 1.4 * s, 0, 7); ctx.fill(); } }
      head(S, 'wizard', 8 * s);
      tri(S, -1 * s, -46 * s, 9 * s, -46 * s, 3 * s, -30 * s, S.flash ? '#fff' : '#eceae4');   // 수염
      armWeapon(S, -0.15, () => {
        line(S, 0, 0, 3 * s, -48 * s, 3.2 * s, S.flash ? '#fff' : '#5a4630');
        orb(S, 3 * s, -54 * s, 6.5 * s + 2 * s * atk, acc);
        if (!S.flash && S.live) { ctx._skipInk = true; ctx.fillStyle = '#e8f6ff';
          for (let i = 0; i < 3; i++) { const a = MODEL.time * 2.2 + i * 2.1;
            ctx.fillRect(3 * s + Math.cos(a) * 12 * s - 1 * s, -54 * s + Math.sin(a) * 7 * s - 1 * s, 2 * s, 2 * s); }
          ctx._skipInk = false; }
      }, 4 * s);
      break;
    }
    case 'lancelot':                                           // 랜슬롯: 투구 · 푸른 망토 · 가늘고 긴 장검
      cape(S, -1, tun, 1.1);
      legs(S); torso(S, 4.8 * s); head(S, 'greathelm');
      armWeapon(S, -1.4 + atk * 2.2, () => {
        line(S, 0, 0, 56 * s, 0, 4 * s, S.flash ? '#fff' : '#e8eef4');
        line(S, 4 * s, -9 * s, 4 * s, 9 * s, 3 * s, S.flash ? '#fff' : acc);
      }, 8 * s);
      break;
    case 'morgana': {                                          // 모르가나: 검보라 두건 로브 · 손 위에 떠도는 저주 구슬
      robe(S, 18 * s, -44 * s, tun);
      head(S, 'hood', 8 * s);
      arm(S, 16 * s, -40 * s);
      const fl = Math.sin(MODEL.time * 3) * 2 * s;
      orb(S, 20 * s, -50 * s + fl, 5 * s + 1.5 * s * atk, S.flash ? '#fff' : acc);
      if (!S.flash && S.live) { ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 1.2 * s; ctx.globalAlpha = 0.6;
        for (let i = 0; i < 2; i++) { const k = (MODEL.time * 0.7 + i * 0.5) % 1;
          ctx.beginPath(); ctx.arc(20 * s, -50 * s + fl, (7 + k * 10) * s, 0, 7); ctx.globalAlpha = 0.6 * (1 - k); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx._skipInk = false; }
      break;
    }
    case 'tristan':                                            // 트리스탄: 깃털 모자 · 하프 줄을 단 활
      cape(S, -1, tun, 0.9);
      legs(S); torso(S); head(S, 'feather');
      bow(S, 20 * s, -34 * s, 21 * s, acc);
      if (!S.flash) { ctx.strokeStyle = 'rgba(255,240,200,.7)'; ctx.lineWidth = 0.8 * s;
        for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo((20 + i * 3) * s, -50 * s + i * 3 * s); ctx.lineTo((20 + i * 3) * s, -18 * s - i * 3 * s); ctx.stroke(); } }
      arm(S, 20 * s, -34 * s);
      break;
    case 'galahad':                                            // 갈라하드: 흰 망토 · 날개 투구 · 붉은 십자 방패 · 성배 후광
      cape(S, -1, '#f4f1e8', 1.1);
      legs(S); torso(S, 5.2 * s); head(S, 'winged');
      halo(S, acc);
      armWeapon(S, -1.1 + atk * 1.8, () => {
        line(S, 0, 0, 34 * s, 0, 4.2 * s, S.flash ? '#fff' : '#e8eef4');
        line(S, 3 * s, -7 * s, 3 * s, 7 * s, 3 * s, S.flash ? '#fff' : acc);
      }, 8 * s);
      shieldShape(S, -32 * s, -52 * s, 16 * s, 46 * s, S.flash ? '#fff' : '#f4f1e8');
      if (!S.flash) { ctx.fillStyle = '#c0392b'; ctx.fillRect(-26 * s, -46 * s, 4 * s, 26 * s); ctx.fillRect(-32 * s, -38 * s, 16 * s, 4 * s); }
      break;
    case 'camelotguard':                                       // 카멜롯 경비병: 냄비 투구 · 창 · 둥근 푸른 방패
      legs(S); torso(S); head(S, 'pot');
      armWeapon(S, -0.25 + atk * 0.5, () => {
        line(S, -10 * s, 0, 42 * s, 0, 2.6 * s, S.flash ? '#fff' : '#8a6a3a');
        tri(S, 42 * s, -3.2 * s, 52 * s, 0, 42 * s, 3.2 * s, S.flash ? '#fff' : '#c8ced6');
      }, 6 * s);
      ctx.fillStyle = S.flash ? '#fff' : acc; ctx.beginPath(); ctx.arc(-12 * s, -32 * s, 10 * s, 0, 7); ctx.fill();
      if (!S.flash) { ctx.fillStyle = '#e8c65a'; ctx.beginPath(); ctx.arc(-12 * s, -32 * s, 3 * s, 0, 7); ctx.fill(); }
      break;

    /* ---------------------- 4.0 천공 군단 ---------------------- */
    case 'harpy': {                                            // 하피: 떠서 날갯짓 · 깃털 머리 · 발톱
      const flap = Math.sin(MODEL.time * 12 + phase) * 0.6;
      ctx.save(); ctx.translate(0, -10 * s + Math.sin(MODEL.time * 6 + phase) * 3 * s);
      for (const d of [-1, 1]) {
        ctx.save(); ctx.translate(-2 * s, -40 * s); ctx.rotate(d < 0 ? -0.3 - flap : 0.2 + flap * 0.6);
        ctx.fillStyle = S.flash ? '#fff' : (d < 0 ? shade(tun, -0.15) : tun);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30 * s, -8 * s); ctx.lineTo(-26 * s, 2 * s); ctx.lineTo(-18 * s, 0); ctx.lineTo(-20 * s, 8 * s); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      torso(S, 3.4 * s); head(S, 'bald', 7.5 * s);
      tri(S, -6 * s, -58 * s, -14 * s, -64 * s, -2 * s, -56 * s, S.flash ? '#fff' : acc);
      for (const x0 of [-3, 3]) line(S, x0 * s, -20 * s, (x0 + 2) * s, -10 * s, 2 * s, S.flash ? '#fff' : acc);
      ctx.restore();
      break;
    }
    case 'griffinrider': {                                     // 그리폰 기수: 사자 몸 · 독수리 머리 · 날개, 등에 창든 기수
      const gait = S.moving ? phase * 1.4 : 0;
      ctx.strokeStyle = S.flash ? '#fff' : shade(col, -0.3); ctx.lineWidth = 3.6 * s;
      for (let i = 0; i < 4; i++) {
        const x = (i < 2 ? -14 : 10) * s + (i % 2) * 4 * s, sw = Math.sin(gait + i * 1.6) * (S.moving ? 6 : 1) * s;
        ctx.beginPath(); ctx.moveTo(x, -20 * s); ctx.lineTo(x + sw * 0.6, -10 * s); ctx.lineTo(x + sw, 0); ctx.stroke();
      }
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-2 * s, -25 * s, 20 * s, 9 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(18 * s, -38 * s, 7 * s, 8 * s, 0, 0, 7); ctx.fill();          // 머리
      tri(S, 23 * s, -40 * s, 31 * s, -36 * s, 23 * s, -34 * s, S.flash ? '#fff' : '#e8c65a');     // 부리
      const flap = Math.sin(MODEL.time * 7 + phase) * 0.4;
      ctx.save(); ctx.translate(-4 * s, -32 * s); ctx.rotate(-0.6 + flap);
      ctx.fillStyle = S.flash ? '#fff' : acc; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-26 * s, -14 * s); ctx.lineTo(-20 * s, -2 * s); ctx.lineTo(-24 * s, 6 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(-2 * s, -26 * s);
      const O = sub(S, 0.75, 2.8 * s);
      torso(O); head(O, 'tusk');
      armWeapon(O, -0.2 + atk * 0.5, () => { line(O, -8 * O.s, 0, 46 * O.s, 0, 2.6 * O.s, S.flash ? '#fff' : '#6b4b2a');
        tri(O, 46 * O.s, -3 * O.s, 56 * O.s, 0, 46 * O.s, 3 * O.s, S.flash ? '#fff' : '#c8ced6'); }, 6 * O.s);
      ctx.restore();
      break;
    }
    case 'stormwisp': {                                        // 폭풍 정령: 떠 있는 먹구름 덩이 · 눈 · 몸을 두른 번개
      const fl = Math.sin(MODEL.time * 2 + phase) * 3 * s;
      ctx.save(); ctx.translate(0, -30 * s + fl);
      ctx.fillStyle = col;
      for (const [x0, y0, r0] of [[-8, 2, 10], [7, 3, 9], [0, -6, 12], [-12, -4, 7], [12, -5, 7]]) { ctx.beginPath(); ctx.arc(x0 * s, y0 * s, r0 * s, 0, 7); ctx.fill(); }
      if (!S.flash) { ctx._skipInk = true; ctx.fillStyle = acc; ctx.fillRect(2 * s, -6 * s, 3 * s, 2.4 * s); ctx.fillRect(7 * s, -6 * s, 3 * s, 2.4 * s);
        if (S.live) { ctx.strokeStyle = '#fff7a8'; ctx.lineWidth = 1.6 * s; ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(MODEL.time * 9 + phase));
          ctx.beginPath(); ctx.moveTo(-6 * s, 8 * s); ctx.lineTo(-2 * s, 14 * s); ctx.lineTo(-6 * s, 16 * s); ctx.lineTo(-1 * s, 24 * s); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx._skipInk = false; }
      ctx.restore();
      break;
    }
    case 'cloudgiant': {                                       // 구름 거인: 굵은 다리 · 구름 덩이 몸 · 커다란 주먹
      const O = Object.assign({}, S, { lw: 6.4 * s });
      legs(O, 20 * s);
      ctx.fillStyle = col;
      for (const [x0, y0, r0] of [[-8, -30, 12], [8, -32, 12], [0, -42, 13], [-10, -44, 9], [10, -45, 9]]) { ctx.beginPath(); ctx.arc(x0 * s, y0 * s, r0 * s, 0, 7); ctx.fill(); }
      head(O, 'bald', 8 * s);
      if (!S.flash) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(-4 * s, -60 * s, 6 * s, 0, 7); ctx.arc(4 * s, -61 * s, 5 * s, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      armWeapon(O, -1.0 + atk * 1.7, () => { ctx.fillStyle = S.flash ? '#fff' : tun; ctx.beginPath(); ctx.arc(20 * s, 0, 9 * s, 0, 7); ctx.fill(); }, 6 * s);
      break;
    }
    case 'skycannon': {                                        // 천공 포대: 구름 받침 위 포신 · 프로펠러 · 포수
      const fl = Math.sin(MODEL.time * 1.6 + phase) * 2 * s;
      ctx.save(); ctx.translate(0, -8 * s + fl);
      ctx.fillStyle = S.flash ? '#fff' : '#d8e0ec';
      for (const [x0, r0] of [[-14, 8], [0, 10], [14, 8]]) { ctx.beginPath(); ctx.arc(x0 * s, 0, r0 * s, 0, 7); ctx.fill(); }
      ctx.fillStyle = S.flash ? '#fff' : tun; ctx.fillRect(-18 * s, -12 * s, 36 * s, 8 * s);
      ctx.save(); ctx.translate(4 * s, -16 * s); ctx.rotate(-0.35 - atk * 0.15);
      ctx.fillStyle = S.flash ? '#fff' : col; ctx.fillRect(-4 * s, -5 * s, 34 * s, 10 * s);
      ctx.fillStyle = S.flash ? '#fff' : acc; ctx.fillRect(28 * s, -6 * s, 5 * s, 12 * s);
      ctx.restore();
      const sp = MODEL.time * 20;
      line(S, -20 * s, -14 * s, -20 * s, -24 * s, 2 * s, S.flash ? '#fff' : '#3a3a3a');
      line(S, -20 * s - Math.cos(sp) * 9 * s, -24 * s, -20 * s + Math.cos(sp) * 9 * s, -24 * s, 2 * s, S.flash ? '#fff' : '#c8ced6');
      const O = sub(S, 0.6, 2.4 * s);
      ctx.save(); ctx.translate(-10 * s, -12 * s); torso(O); head(O, 'goggles'); arm(O, 10 * O.s, -30 * O.s); ctx.restore();
      ctx.restore();
      break;
    }
    case 'windcaller': {                                       // 바람 주술사: 청록 로브 · 소용돌이 지팡이 · 바람결
      robe(S, 17 * s, -44 * s, tun);
      head(S, 'hood', 8 * s);
      armWeapon(S, -0.15, () => {
        line(S, 0, 0, 3 * s, -42 * s, 2.6 * s, S.flash ? '#fff' : '#5a4630');
        ctx.strokeStyle = S.flash ? '#fff' : acc; ctx.lineWidth = 1.8 * s; ctx.beginPath();
        for (let k = 0; k < 18; k++) { const a = k * 0.6 + MODEL.time * 4, r0 = k * 0.45 * s; const x = 3 * s + Math.cos(a) * r0, y = -48 * s + Math.sin(a) * r0; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }, 4 * s);
      if (!S.flash && S.live) { ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 1.2 * s;
        for (let i = 0; i < 3; i++) { const k = (MODEL.time * 0.9 + i / 3) % 1; ctx.globalAlpha = (1 - k) * 0.6;
          ctx.beginPath(); ctx.moveTo((10 + k * 30) * s, (-20 - i * 10) * s); ctx.quadraticCurveTo((20 + k * 30) * s, (-26 - i * 10) * s, (30 + k * 30) * s, (-20 - i * 10) * s); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx._skipInk = false; }
      break;
    }
    case 'stormgriffin': {                                     // 폭풍 그리폰 왕: 큰 그리폰 · 번개 두른 날개 · 깃털 관
      const gait = S.moving ? phase * 1.2 : 0;
      ctx.strokeStyle = S.flash ? '#fff' : shade(col, -0.3); ctx.lineWidth = 4.4 * s;
      for (let i = 0; i < 4; i++) {
        const x = (i < 2 ? -16 : 12) * s + (i % 2) * 5 * s, sw = Math.sin(gait + i * 1.6) * (S.moving ? 6 : 1) * s;
        ctx.beginPath(); ctx.moveTo(x, -22 * s); ctx.lineTo(x + sw * 0.6, -11 * s); ctx.lineTo(x + sw, 0); ctx.stroke();
      }
      const flap = Math.sin(MODEL.time * 5 + phase) * 0.35 - atk * 0.4;
      ctx.save(); ctx.translate(-4 * s, -34 * s); ctx.rotate(-0.7 + flap);
      ctx.fillStyle = S.flash ? '#fff' : tun; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40 * s, -22 * s); ctx.lineTo(-30 * s, -4 * s); ctx.lineTo(-38 * s, 6 * s); ctx.lineTo(-22 * s, 6 * s); ctx.closePath(); ctx.fill();
      if (!S.flash && S.live) { ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 1.6 * s; ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(MODEL.time * 8));
        ctx.beginPath(); ctx.moveTo(-10 * s, -6 * s); ctx.lineTo(-18 * s, -2 * s); ctx.lineTo(-22 * s, -12 * s); ctx.lineTo(-32 * s, -8 * s); ctx.stroke(); ctx.globalAlpha = 1; ctx._skipInk = false; }
      ctx.restore();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-2 * s, -28 * s, 22 * s, 10 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(20 * s, -42 * s, 8 * s, 9 * s, 0, 0, 7); ctx.fill();
      tri(S, 26 * s, -45 * s, 36 * s, -40 * s, 26 * s, -37 * s, S.flash ? '#fff' : '#e8c65a');
      for (let i = 0; i < 3; i++) tri(S, (16 + i * 3) * s, -50 * s, (14 + i * 3) * s, (-60 - i * 2) * s, (19 + i * 3) * s, -50 * s, S.flash ? '#fff' : acc);
      if (!S.flash) { ctx.fillStyle = '#ffeb6a'; ctx.fillRect(22 * s, -45 * s, 2.4 * s, 2 * s); }
      break;
    }
    case 'cloudking': {                                        // 구름 왕: 구름 거인 + 왕관 · 구름 망토 · 홀
      const O = Object.assign({}, S, { lw: 6.8 * s });
      ctx.fillStyle = S.flash ? '#fff' : '#e8eef6';
      for (const [x0, y0, r0] of [[-18, -20, 10], [-22, -36, 9], [-16, -50, 8]]) { ctx.beginPath(); ctx.arc(x0 * s, y0 * s, r0 * s, 0, 7); ctx.fill(); }
      legs(O, 20 * s);
      ctx.fillStyle = col;
      for (const [x0, y0, r0] of [[-8, -30, 12], [8, -32, 12], [0, -42, 13]]) { ctx.beginPath(); ctx.arc(x0 * s, y0 * s, r0 * s, 0, 7); ctx.fill(); }
      head(O, 'crown', 8.5 * s);
      armWeapon(O, -0.3 + atk * 0.9, () => {
        line(O, 0, 0, 3 * s, -40 * s, 3.2 * s, S.flash ? '#fff' : '#c9a227');
        orb(O, 3 * s, -45 * s, 6 * s, S.flash ? '#fff' : acc);
      }, 5 * s);
      break;
    }
    case 'skylord': {                                          // 천공의 군주: 검은 날개 · 번개 후광 · 갑주 · 대검
      ctx.save(); ctx.translate(0, -36 * s);
      for (const d of [-1, 1]) { ctx.save(); ctx.rotate(d < 0 ? -0.5 : 0.1); ctx.fillStyle = S.flash ? '#fff' : shade(tun, d < 0 ? -0.2 : 0);
        ctx.beginPath(); ctx.moveTo(-2 * s, 0); ctx.lineTo(-34 * s, -26 * s); ctx.lineTo(-28 * s, -8 * s); ctx.lineTo(-38 * s, 0); ctx.lineTo(-26 * s, 4 * s); ctx.lineTo(-30 * s, 14 * s); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.restore();
      if (!S.flash && S.live) { ctx._skipInk = true; ctx.strokeStyle = acc; ctx.lineWidth = 1.8 * s; ctx.globalAlpha = 0.55 + 0.35 * Math.sin(MODEL.time * 6);
        ctx.beginPath(); ctx.arc(0, -52 * s, 14 * s, 0, 7); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + MODEL.time; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14 * s, -52 * s + Math.sin(a) * 14 * s); ctx.lineTo(Math.cos(a) * 19 * s, -52 * s + Math.sin(a) * 19 * s); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx._skipInk = false; }
      const O = Object.assign({}, S, { lw: 5.6 * s });
      legs(O, 20 * s); torso(O, 6 * s); head(O, 'horn', 8.5 * s);
      armWeapon(O, -1.3 + atk * 2.0, () => {
        line(O, 0, 0, 62 * s, 0, 6 * s, S.flash ? '#fff' : '#4a4a6a');
        line(O, 4 * s, -10 * s, 4 * s, 10 * s, 4 * s, S.flash ? '#fff' : acc);
        if (!S.flash) { ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.4; line(O, 8 * s, 0, 62 * s, 0, 2 * s, acc); ctx.restore(); ctx._skipInk = false; }
      }, 8 * s);
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
      const sw = moving ? Math.sin(phase * 1.7) * 8 * s : 3 * s;
      beastLegs(S, [[-16, sw, 1], [-10, -sw, 0], [10, -sw, 0], [16, sw, 1]], -18 * s, 4 * s, col);
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
      ctx.strokeStyle = col; ctx.lineWidth = 3.4 * s;
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
      // 2.8: 관절 있는 뒷다리, 배 비늘, 막 날개, 턱이 벌어지는 머리
      const fl = Math.sin(phase * 1.1) * 4 * s;
      const dark = S.flash ? '#fff' : shade(col, -0.3), belly = S.flash ? '#fff' : shade(acc, 0.25);
      ctx.save(); ctx.translate(0, fl);
      const flap = Math.sin(phase * 2.2) * 0.35;
      const wing = (k, c) => {                                  // 뼈대 + 막
        ctx.save(); ctx.translate(-6 * s, -46 * s); ctx.rotate(-0.5 + flap * k);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-10 * s, -26 * s); ctx.lineTo(-34 * s, -40 * s);
        ctx.quadraticCurveTo(-30 * s, -22 * s, -40 * s, -12 * s);
        ctx.quadraticCurveTo(-26 * s, -10 * s, -30 * s, 2 * s);
        ctx.quadraticCurveTo(-16 * s, 0, -8 * s, 12 * s);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = S.flash ? '#fff' : shade(col, -0.45); ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(-10 * s, -26 * s); ctx.lineTo(-40 * s, -12 * s);
        ctx.moveTo(-10 * s, -26 * s); ctx.lineTo(-30 * s, 2 * s);
        ctx.stroke();
        ctx.restore();
      };
      wing(0.8, S.flash ? '#fff' : shade(tun, -0.25));          // 먼 날개
      const sw = moving ? Math.sin(phase * 1.4) * 7 * s : 3 * s;
      const leg = (x, d, c) => {                                 // 허벅지 · 역관절 정강이 · 발톱
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(x, -26 * s, 8 * s, 10 * s, 0.3, 0, 7); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - 4 * s, -22 * s); ctx.lineTo(x + 4 * s + d * 0.3, -18 * s);
        ctx.lineTo(x - 2 * s + d, -2 * s); ctx.lineTo(x - 7 * s + d, -3 * s); ctx.closePath(); ctx.fill();
        ctx._skipInk = true;
        for (let k = 0; k < 3; k++) tri(S, x - 6 * s + d + k * 4 * s, -2 * s, x - 2 * s + d + k * 4 * s, -2 * s, x - 0.5 * s + d + k * 4 * s, 1.5 * s, S.flash ? '#fff' : '#efe6cf');
        ctx._skipInk = false;
      };
      leg(-8 * s, sw, dark);
      // 꼬리: 가늘어지다 창끝으로
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-18 * s, -44 * s);
      ctx.quadraticCurveTo(-46 * s, -34 * s, -58 * s, -54 * s);
      ctx.lineTo(-60 * s, -52 * s);
      ctx.quadraticCurveTo(-48 * s, -26 * s, -20 * s, -30 * s);
      ctx.closePath(); ctx.fill();
      tri(S, -58 * s, -54 * s, -70 * s, -62 * s, -64 * s, -48 * s, acc);
      // 몸통 + 배 비늘
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -36 * s, 24 * s, 17 * s, -0.08, 0, 7); ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath(); ctx.ellipse(4 * s, -28 * s, 17 * s, 8 * s, -0.08, 0, Math.PI); ctx.fill();
      if (!S.flash) {
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1 * s;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(4 * s + k * 6 * s, -28 * s); ctx.lineTo(4 * s + k * 5.4 * s, -21 * s); ctx.stroke(); }
      }
      leg(10 * s, -sw, col);
      // 등지느러미
      for (let i = 0; i < 4; i++) {
        tri(S, (-14 + i * 10) * s, -50 * s, (-9 + i * 10) * s, -66 * s + (i === 1 || i === 2 ? -3 * s : 0),
            (-4 + i * 10) * s, -50 * s, acc);
      }
      // 목: 굵기가 줄어드는 면
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(6 * s, -48 * s);
      ctx.quadraticCurveTo(22 * s, -60 * s, 26 * s, -78 * s);
      ctx.lineTo(36 * s, -74 * s);
      ctx.quadraticCurveTo(30 * s, -56 * s, 20 * s, -36 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.moveTo(18 * s, -38 * s); ctx.quadraticCurveTo(28 * s, -54 * s, 33 * s, -72 * s);
      ctx.lineTo(35 * s, -72 * s); ctx.quadraticCurveTo(30 * s, -54 * s, 21 * s, -36 * s); ctx.closePath(); ctx.fill();
      // 머리: 위턱 · 아래턱(칠 때 벌어진다) · 뿔 · 눈
      const jaw = 0.12 + atk * 0.45;
      ctx.save(); ctx.translate(30 * s, -76 * s);
      ctx.fillStyle = dark;
      ctx.save(); ctx.rotate(jaw);
      ctx.beginPath(); ctx.moveTo(-2 * s, 0); ctx.lineTo(22 * s, 3 * s); ctx.lineTo(18 * s, 7 * s); ctx.lineTo(-4 * s, 6 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-6 * s, -8 * s); ctx.quadraticCurveTo(8 * s, -12 * s, 24 * s, -2 * s);
      ctx.lineTo(24 * s, 2 * s); ctx.lineTo(-4 * s, 4 * s); ctx.closePath(); ctx.fill();
      ctx._skipInk = true;
      tri(S, 8 * s, 2 * s, 11 * s, 2 * s, 9.5 * s, 5 * s, S.flash ? '#fff' : '#efe6cf');
      tri(S, 15 * s, 1.5 * s, 18 * s, 1.5 * s, 16.5 * s, 4.5 * s, S.flash ? '#fff' : '#efe6cf');
      ctx._skipInk = false;
      tri(S, -4 * s, -7 * s, -16 * s, -20 * s, 2 * s, -10 * s, S.flash ? '#fff' : '#e8dcc0');   // 뿔
      tri(S, 2 * s, -9 * s, -6 * s, -22 * s, 7 * s, -10 * s, S.flash ? '#fff' : '#d8ccb0');
      ctx._skipInk = true;
      ctx.fillStyle = S.flash ? '#fff' : '#ffe14a';
      ctx.beginPath(); ctx.ellipse(6 * s, -4 * s, 3 * s, 2.2 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a0a05';
      ctx.fillRect(5.6 * s, -6 * s, 1 * s, 4 * s);
      ctx._skipInk = false;
      ctx.restore();
      wing(1, S.flash ? '#fff' : tun);                           // 가까운 날개
      // 불꽃
      if (atk > 0.1) {
        ctx.fillStyle = 'rgba(255,150,50,' + (0.5 + atk * 0.4) + ')';
        ctx.beginPath();
        ctx.moveTo(52 * s, -74 * s);
        ctx.lineTo(52 * s + 60 * s * atk, -70 * s);
        ctx.lineTo(52 * s + 56 * s * atk, -58 * s);
        ctx.lineTo(52 * s, -68 * s);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,236,150,' + (0.4 + atk * 0.4) + ')';
        ctx.beginPath();
        ctx.moveTo(52 * s, -72 * s); ctx.lineTo(52 * s + 34 * s * atk, -68 * s); ctx.lineTo(52 * s, -69 * s);
        ctx.closePath(); ctx.fill();
      } else if (!S.flash && S.live) {                            // 콧김
        ctx.fillStyle = 'rgba(80,70,70,.3)';
        ctx.beginPath(); ctx.arc(56 * s + Math.sin(phase * 3) * 2 * s, -80 * s - (phase * 6 % 8) * s, 2.4 * s, 0, 7); ctx.fill();
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
      const sw = moving ? Math.sin(phase * 1.8) * 9 * s : 3 * s;
      beastLegs(S, [[-18, sw, 1], [-10, -sw, 0], [12, -sw, 0], [20, sw, 1]], -20 * s, 4.8 * s, col);
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
      const sw = moving ? Math.sin(phase * 2) * 8 * s : 3 * s;
      beastLegs(S, [[-15, sw, 1], [-9, -sw, 0], [9, -sw, 0], [15, sw, 1]], -18 * s, 3.8 * s, col);
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

    case 'goldcart': {                                        // 3.7 황금 수레: 금화를 산더미로 실은 짐수레
      const wood = S.flash ? '#fff' : '#7a5a34', dark = S.flash ? '#fff' : '#4a3520';
      const bob = S.moving ? Math.sin(phase * 2) * 1.2 * s : 0;
      ctx.save(); ctx.translate(0, bob);
      ctx.fillStyle = wood; ctx.fillRect(-26 * s, -30 * s, 52 * s, 18 * s);          // 짐칸
      ctx.fillStyle = dark; for (let i = -1; i <= 1; i++) ctx.fillRect(i * 17 * s - 1 * s, -30 * s, 2 * s, 18 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#ffd35a';                                    // 금화 더미
      ctx.beginPath(); ctx.moveTo(-24 * s, -30 * s); ctx.quadraticCurveTo(-8 * s, -52 * s, 4 * s, -44 * s);
      ctx.quadraticCurveTo(16 * s, -54 * s, 24 * s, -30 * s); ctx.closePath(); ctx.fill();
      if (!S.flash) {
        ctx.fillStyle = '#fff1a8';
        for (const [x, y] of [[-12, -38], [2, -46], [12, -40], [-4, -34], [18, -34]]) { ctx.beginPath(); ctx.ellipse(x * s, y * s, 3 * s, 1.6 * s, 0, 0, 7); ctx.fill(); }
        const tw = (Math.sin((MODEL.time || 0) * 5) + 1) / 2;                          // 반짝
        ctx.save(); ctx._skipInk = true; ctx.globalAlpha *= 0.4 + tw * 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4 * s;
        ctx.beginPath(); ctx.moveTo(4 * s, -56 * s); ctx.lineTo(4 * s, -48 * s); ctx.moveTo(0, -52 * s); ctx.lineTo(8 * s, -52 * s); ctx.stroke();
        ctx.restore(); ctx._skipInk = false;
      }
      ctx.fillStyle = S.flash ? '#fff' : '#8e2f3a';                                    // 보물 상자
      ctx.fillRect(-20 * s, -42 * s, 12 * s, 9 * s);
      ctx.fillStyle = S.flash ? '#fff' : '#ffd35a'; ctx.fillRect(-15 * s, -40 * s, 2 * s, 3 * s);
      line(S, 26 * s, -20 * s, 40 * s, -24 * s, 2.6 * s, dark);                          // 끌채
      ctx.restore();
      wheels(S, [-16, 16], -9 * s, 9 * s, dark);
      const O = sub(S, 0.62, 2.6 * s);                                                  // 끄는 고블린
      ctx.save(); ctx.translate(46 * s, 0);
      legs(O); torso(O); head(O, 'ears'); arm(O, 10 * O.s, -32 * O.s);
      ctx.restore();
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

  if (st.evo) evoCrest(S);                        // 진화: 머리 위 금빛 문장

  if (wrapped) { ctx._wrap = false; ctx._depth = false; ctx._noInk = false; }
  if (depthOn) ctx._shadeRect = false;

  if (hurt) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(-14 * s, -70 * s); ctx.lineTo(-8 * s, -76 * s);
    ctx.moveTo(-2 * s, -74 * s); ctx.lineTo(-2 * s, -82 * s); ctx.stroke();
  }
  ctx.restore();
}

/* ---------------------- 진화 장식 ----------------------
 * 병종마다 따로 그리지 않고 공통 장식을 얹는다: 등 뒤 망토, 머리 위 금빛 문장.
 * 망토는 사람 모양이 아닌 병종(수레·짐승·기계)에는 두르지 않는다. */
const NO_CAPE = { catapult: 1, scarab: 1, fenrir: 1, airship: 1, steammech: 1, merchant: 1,
  medusa: 1, sniper: 1, turret: 1, barricade: 1, colossus: 1, lancer: 1, siegebow: 1 };
function evoCape(S) {
  const { ctx, s } = S;
  const w = Math.sin((S.phase || 0) * 1.3) * 3 * s + (S.moving ? 5 * s : 0);
  ctx.fillStyle = S.flash ? '#ffffff' : (S.raw.evoCape || '#8a1f2e');
  ctx.beginPath();
  ctx.moveTo(-4 * s, -42 * s); ctx.lineTo(4 * s, -42 * s);
  ctx.quadraticCurveTo(-5 * s, -24 * s, -12 * s - w, -5 * s);
  ctx.lineTo(-24 * s - w * 1.4, -8 * s);
  ctx.quadraticCurveTo(-15 * s, -27 * s, -4 * s, -42 * s);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = S.flash ? '#ffffff' : '#e8c65a';
  ctx.lineWidth = 1.8 * s;
  ctx.beginPath(); ctx.moveTo(-12 * s - w, -5 * s); ctx.lineTo(-24 * s - w * 1.4, -8 * s); ctx.stroke();
  ctx.fillStyle = S.flash ? '#ffffff' : '#e8c65a';
  ctx.beginPath(); ctx.arc(1 * s, -41 * s, 2.2 * s, 0, 7); ctx.fill();   // 망토 고리
}
function evoBanner(S) {
  const { ctx, s } = S;
  const wave = Math.sin((S.phase || 0) * 1.6) * 3 * s;
  const x = -20 * s, top = -78 * s;
  ctx.strokeStyle = S.flash ? '#ffffff' : '#6b4b2a';
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath(); ctx.moveTo(x, -2 * s); ctx.lineTo(x, top); ctx.stroke();
  ctx.fillStyle = S.flash ? '#ffffff' : (S.raw.evoCape || '#8a1f2e');
  ctx.beginPath();
  ctx.moveTo(x, top + 2 * s); ctx.lineTo(x - 22 * s, top + 6 * s + wave);
  ctx.lineTo(x - 15 * s, top + 12 * s + wave * 0.6); ctx.lineTo(x - 22 * s, top + 18 * s + wave);
  ctx.lineTo(x, top + 20 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = S.flash ? '#ffffff' : '#e8c65a'; ctx.lineWidth = 1.4 * s; ctx.stroke();
  ctx.fillStyle = S.flash ? '#ffffff' : '#f6d365';
  ctx.beginPath(); ctx.arc(x, top, 2.6 * s, 0, 7); ctx.fill();
}
/* 4.3 키 큰 3진(거대 로봇)·머리 위에 드론이 뜬 3진은 문장·체력바를 더 위로 */
const X3_CREST = { starmerlin: -122, hovertank: -92, megabot: -126, dronepilot: -110, ufo: -92, icecart: -94, solarsat: -128, mechwukong: -104, jetvalk: -92, thunderbike: -90 };
const X3_TOP = { starmerlin: 110, hovertank: 84, megabot: 114, dronepilot: 98, ufo: 80, icecart: 82, solarsat: 124, mechwukong: 104, jetvalk: 92, thunderbike: 86 };
const X3_WIDE = { hovertank: 2.0, tank: 1.9, ambulance: 1.7, ufo: 1.9, megabot: 1.35, bulldozer: 1.8, icecart: 1.5, thunderbike: 1.9, solarsat: 1.6, mechwukong: 1.2 };
/* 4.3 탈것 3진은 걷지 않는다: 걸음 들썩임·기울기 대신 차체가 스스로 흔들린다 */
const X3_VEHICLE = { hovertank: 1, tank: 1, ambulance: 1, ufo: 1, bulldozer: 1, irontrain: 1, handcar: 1, thunderbike: 1, solarsat: 1, mechwukong: 1, jetvalk: 1 };   // 4.6 기관차·손수레도 굴러간다
function evoCrest(S) {
  const { ctx, s } = S;
  const y = ((X3_CREST[S.raw.shape] || -86) + Math.sin((S.phase || 0) * 2) * 2) * s;
  const a0 = ctx.globalAlpha;
  const e2 = S.raw.evo2, e3 = S.raw.evo3;         // 4.1 3진: 청록 별에 작은 별 둘이 곁따른다 · 4.18 4진: 금빛 별에 보랏빛 별 넷이 돈다
  const glow = e3 ? '#ffe9a0' : e2 ? '#9ff6ff' : '#ffe28a', main = e3 ? '#ffd76a' : e2 ? '#7ff0ff' : '#f6d365';
  if (!S.flash) {
    ctx.globalAlpha = a0 * 0.35; ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, y, (e2 ? 10 : 8) * s, 0, 7); ctx.fill();
    ctx.globalAlpha = a0;
  }
  const star = (x, k) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 7 * k); ctx.lineTo(x + 2 * k, y - 2 * k); ctx.lineTo(x + 7 * k, y);
    ctx.lineTo(x + 2 * k, y + 2 * k); ctx.lineTo(x, y + 7 * k); ctx.lineTo(x - 2 * k, y + 2 * k);
    ctx.lineTo(x - 7 * k, y); ctx.lineTo(x - 2 * k, y - 2 * k); ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = S.flash ? '#ffffff' : main;
  star(0, e3 ? 1.35 * s : e2 ? 1.2 * s : s);
  if (e3) { const t = MODEL.time; ctx.fillStyle = S.flash ? '#ffffff' : '#d8a8ff';
    for (let i = 0; i < 4; i++) { const a = t * 1.6 + i * Math.PI / 2; ctx.save(); ctx.translate(Math.cos(a) * 14 * s, Math.sin(a) * 5 * s); star(0, 0.5 * s); ctx.restore(); } }
  else if (e2) { star(-11 * s, 0.55 * s); star(11 * s, 0.55 * s); }
  ctx.fillStyle = S.flash ? '#ffffff' : '#fff6d0';
  ctx.beginPath(); ctx.arc(0, y, 1.6 * s, 0, 7); ctx.fill();
}

/* 걸을 때 반대쪽 팔을 흔드는 인간형 병종 */
const HUMANOID = {
  skadi:1,bastet:1,runeguard:1, musketeer:1, purifier:1, frostlancer:1,
  susanoo: 1, tengu: 1, ninja: 1, samurai: 1, ashigaru: 1, maceman: 1, axethrower: 1,   // 4.9
  guanyu: 1, azureguan: 1, zhangfei: 1, tengjia: 1, jiqiang: 1, huangzhong: 1,         // 4.15
  drummer:1, assassin:1, burrower:1, boneguard:1,
  pojol:1, hwarang:1, dokkaebi:1, teslaknight:1, clocksoldier:1, mechanic:1, rifleman:1,
  spear: 1, shield: 1, archer: 1, venom: 1, bomber: 1, knight: 1, duelist: 1,
  longbow: 1, rogue: 1, engineer: 1, skeleton: 1,
  goblin: 1, orcspear: 1, ballista: 1, powder: 1, dark: 1, orcberserk: 1,
  javelin: 1, falconer: 1, alchemist: 1, monk: 1, wukong: 1, monkeyclone: 1, nezha: 1, bajie: 1,
  wujing: 1, monkey: 1, celestial: 1, jailer: 1, thief: 1, sapper: 1,
  bloodthrall: 1, stoneward: 1, imp: 1, demonknight: 1, vampire: 1, demonking: 1,
  harpoon: 1, corsair: 1, anchorguard: 1, deepone: 1, seahook: 1,
  knight_evo: 1, archer_evo: 1, spear_evo: 1, colossus_evo: 1, thor_evo: 1, wukong_evo: 1,
  // 4.3 3진 (드론 조종사는 두 손으로 조종기를 쥐어 팔을 흔들지 않는다)
  drillspear: 1, lightsaber: 1, railgun: 1
};

/* ---------------------- 부품 ---------------------- */
function sub(S, k, lw) {
  return Object.assign({}, S, { s: S.s * k, lw: lw });
}

/* ---------------- 2.8 모델 공용 ----------------
 * 모든 병사·적이 이 부품들로 그려진다. 여기를 다듬으면 전원이 함께 좋아진다.
 * - 잉크 테두리: 팔다리·몸통·머리·무기에 어두운 외곽선
 * - 명암: 빛은 왼쪽 위(앞쪽 위). 등 쪽 절반은 어둡게, 앞 가장자리에 밝은 테
 * - 팔다리는 굵기가 줄어들고(허벅지 > 정강이), 손과 장화가 있다 */
const INK = 'rgba(12,16,24,.82)';
/* 불투명한 면을 칠하면 잉크 테두리도 긋는다. 반투명 빛·그늘, 'lighter' 합성, 작은 장식은 건너뛴다. */
const _fill0 = CanvasRenderingContext2D.prototype.fill;
const _stroke0 = CanvasRenderingContext2D.prototype.stroke;
/* 굵고 불투명한 선(팔다리·무기 자루·바퀴)은 잉크를 한 겹 밑에 깐다 */
function inkedStroke(a) {
  // 4.2: 반투명 빛·'lighter' 합성에는 그림자를 끈다 — 그림자 밑에 깔린 빛은 보이지도 않는데,
  // 반투명 + 그림자는 브라우저가 따로 층을 만들어 합성해야 해서 모양 하나에 수 ms 씩 들었다
  if (this._depth && (this.globalAlpha < 0.9 || this.globalCompositeOperation !== 'source-over')) {
    const sc = this.shadowColor; this.shadowColor = 'transparent';
    _stroke0.apply(this, arguments);
    this.shadowColor = sc; return;
  }
  const ss = this.strokeStyle, lw = this.lineWidth;
  if (!this._noInk && !this._skipInk && lw >= this._inkW * 2.3 && typeof ss === 'string' && ss.charCodeAt(0) === 35 &&
      this.globalAlpha >= 0.9 && this.globalCompositeOperation === 'source-over') {
    this.strokeStyle = INK; this.lineWidth = lw + this._inkW * 1.6;
    if (a && typeof a === 'object') _stroke0.call(this, a); else _stroke0.call(this);
    this.strokeStyle = ss; this.lineWidth = lw;
  }
  return _stroke0.apply(this, arguments);
}
/* 4.5: 반투명('rgba(')·가산 합성 사각형도 그림자를 끈다. 4.2 에선 fill 만 챙겨서, fillRect 로 그린
 * 빛줄기(레일건 레일의 전기 · 궤도 마디 등)가 그림자를 단 채 합성돼 모양 하나에 100ms 가 넘게 걸렸다. */
const _fillRect0 = CanvasRenderingContext2D.prototype.fillRect;
function shadowless(ctx) {
  if (ctx.globalAlpha < 0.9 || ctx.globalCompositeOperation !== 'source-over') return true;
  const fs = ctx.fillStyle;
  return typeof fs !== 'string' || fs.charCodeAt(0) === 114 && fs.charCodeAt(3) === 97;   // 'rgba(' · 그라디언트
}
function shadedFillRect(x, y, w, h) {
  if (shadowless(this)) { const sc = this.shadowColor; this.shadowColor = 'transparent'; _fillRect0.call(this, x, y, w, h); this.shadowColor = sc; return; }
  _fillRect0.call(this, x, y, w, h);
}
function inkedFill(a) {
  if (this._depth && shadowless(this)) {
    const sc = this.shadowColor; this.shadowColor = 'transparent'; _fill0.apply(this, arguments); this.shadowColor = sc;
    return;                                          // 반투명·그라디언트에는 잉크 테두리도 없다
  }
  if (this.globalAlpha < 0.9 || this.globalCompositeOperation !== 'source-over') {
    if (this._depth) { const sc = this.shadowColor; this.shadowColor = 'transparent'; _fill0.apply(this, arguments); this.shadowColor = sc; }
    else _fill0.apply(this, arguments);
    return;
  }
  _fill0.apply(this, arguments);
  if (this._noInk || this._skipInk) return;
  const fs = this.fillStyle;
  if (typeof fs !== 'string' || fs.charCodeAt(0) !== 35) return;          // '#rrggbb' = 불투명
  const ss = this.strokeStyle, lw = this.lineWidth;
  this.strokeStyle = INK; this.lineWidth = this._inkW;
  if (a && typeof a === 'object') _stroke0.call(this, a); else _stroke0.call(this);
  this.strokeStyle = ss; this.lineWidth = lw;
}
function installWrap(ctx) {
  ctx._wrap = false; ctx._shadeRect = false; ctx._depth = false; ctx._noInk = false; ctx._skipInk = false; ctx._inkW = 1;
  ctx.fill = function () { return this._wrap ? inkedFill.apply(this, arguments) : _fill0.apply(this, arguments); };
  ctx.stroke = function () { return this._wrap ? inkedStroke.apply(this, arguments) : _stroke0.apply(this, arguments); };
  ctx.fillRect = function (x, y, w, h) { return this._shadeRect ? shadedFillRect.call(this, x, y, w, h) : _fillRect0.call(this, x, y, w, h); };
  ctx._wrapped = true;
}
const FX_LOCAL = { release: 1, warn: 1, aura: 1, charm: 1, coin: 1, miss: 1,          // GL 파티클을 쏘지 않는 것만
  bell: 1, reap: 1, chill: 1, stun: 1, dmg: 1, rally: 1 };
const MODEL = { depth: true, ink: true, blink: false, time: 0, angry: false };
const _shadeCache = {};
function shade(hex, k) {                     // k<0 어둡게, k>0 밝게
  const key = hex + k;
  if (_shadeCache[key]) return _shadeCache[key];
  let out = hex;
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (m) {
    const n = parseInt(m[1], 16);
    const f = c => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    out = 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  return (_shadeCache[key] = out);
}
/* 잉크 밑칠을 깐 선 */
function inkStroke(S, w) {          // 잉크는 drawBody 가 선마다 자동으로 깐다
  S.ctx.lineWidth = w;
}

function legs(S, hipY) {
  const { ctx, s } = S;
  const hy = -(hipY || 19 * s);
  const stride = S.moving ? 10 * s : 4 * s;
  const lift = S.moving ? 7 * s : 0;
  const boot = S.flash ? '#fff' : shade(S.col, -0.45);
  for (let i = 0; i < 2; i++) {
    const ph = S.phase + i * Math.PI;
    const fx = Math.sin(ph) * stride + (i ? -2 : 2) * s;
    const fy = -Math.max(0, Math.sin(ph + 1.1)) * lift;
    const bend = 3 * s + 3 * s * Math.max(0, Math.sin(ph + 0.6));
    const kx = fx * 0.5 + bend;
    const ky = (hy + fy) * 0.5;
    // 뒤쪽 다리는 조금 어둡게 — 두 다리가 겹쳐도 앞뒤가 읽힌다
    ctx.strokeStyle = S.flash ? '#fff' : (i ? shade(S.col, -0.22) : S.col);
    ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(kx, ky);          // 허벅지
    inkStroke(S, S.lw * 1.18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy - 2 * s);  // 정강이
    inkStroke(S, S.lw * 0.95); ctx.stroke();
    // 장화: 발목에서 앞으로 뻗은 둥근 신
    ctx.fillStyle = boot;
    ctx.beginPath();
    ctx.moveTo(fx - 2.2 * s, fy - 4 * s);
    ctx.lineTo(fx + 1.6 * s, fy - 4 * s);
    ctx.quadraticCurveTo(fx + 5.2 * s, fy - 2.4 * s, fx + 5 * s, fy + 0.4 * s);
    ctx.lineTo(fx - 2.6 * s, fy + 0.4 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.lineWidth = S.lw;
}

/* 네발짐승 다리: 어깨 → 관절(뒤로 꺾임) → 발. legsDef = [[x, 흔들림, 뒷다리?], ...] */
function beastLegs(S, legsDef, top, w, color) {
  const { ctx, s } = S;
  for (const [x0, sw, hind] of legsDef) {
    const x = x0 * s;
    ctx.strokeStyle = S.flash ? '#fff' : (hind ? shade(color, -0.2) : color);
    ctx.lineWidth = w;
    const kx = x + sw * 0.4 + (hind ? -4 : 3) * s, ky = top * 0.45;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(kx, ky); ctx.lineTo(x + sw, -1.5 * s); ctx.stroke();
    ctx.fillStyle = S.flash ? '#fff' : shade(color, -0.35);
    ctx.beginPath(); ctx.ellipse(x + sw + 1.5 * s, -1 * s, 3 * s, 1.8 * s, 0, 0, 7); ctx.fill();
  }
}

/* 손: 팔 끝의 주먹 */
function hand(S, x, y) {
  const { ctx, s } = S;
  ctx.fillStyle = S.flash ? '#fff' : shade(S.col, 0.12);
  ctx.beginPath(); ctx.arc(x, y, 2.3 * s, 0, 7); ctx.fill();
}

/* 무기를 들지 않은 쪽 팔은 걸음에 맞춰 흔든다 */
function armSwing(S) {
  const { ctx, s } = S;
  ctx.strokeStyle = S.flash ? '#fff' : shade(S.col, -0.2);   // 몸 뒤쪽 팔
  ctx.beginPath();
  ctx.moveTo(0, -38 * s);
  let hx, hy;
  if (S.cheer) {                                   // 만세
    ctx.quadraticCurveTo(-6 * s, -50 * s, -4 * s, -60 * s); hx = -4 * s; hy = -60 * s;
  } else {
    const sw = S.moving ? Math.sin(S.phase + Math.PI) * 9 * s
      : (S.atk > 0 ? -8 * s * S.atk : (S.wind ? -6 * s * S.wind : 2 * s));   // 치는 반대로 팔을 뒤로
    ctx.quadraticCurveTo(sw * 0.5, -31 * s, sw, -22 * s); hx = sw; hy = -22 * s;
  }
  inkStroke(S, S.lw * 0.85); ctx.stroke();
  hand(S, hx, hy);
}

function torso(S, lw) {
  const { ctx, s } = S;
  const armored = ['shield','knight','knight_evo','spear_evo','thor_evo','wukong_evo','paladin','colossus','dark','orcshield','warchief','warlord'].includes(S.raw.shape);
  const width = armored ? 8 * s : 5.5 * s;
  ctx.fillStyle = S.tun;
  ctx.beginPath();
  ctx.moveTo(-width * .8, -41 * s); ctx.lineTo(width * .8, -41 * s);
  ctx.lineTo(width, -19 * s); ctx.lineTo(-width, -19 * s); ctx.closePath(); ctx.fill();
  if (!S.flash) {
    const sc = ctx.shadowColor; ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(0,0,0,.2)';                          // 등 쪽 그늘
    ctx.beginPath();
    ctx.moveTo(-width * .8, -41 * s); ctx.lineTo(-width * .15, -41 * s);
    ctx.lineTo(-width * .1, -19 * s); ctx.lineTo(-width, -19 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1.3 * s;   // 앞 가장자리 빛
    ctx.beginPath(); ctx.moveTo(width * .7, -39.5 * s); ctx.lineTo(width * .88, -21 * s); ctx.stroke();
    ctx.fillStyle = shade(S.acc, -0.1);                          // 옷깃
    ctx.beginPath(); ctx.moveTo(-width * .55, -41 * s); ctx.lineTo(width * .55, -41 * s);
    ctx.lineTo(0, -36.5 * s); ctx.closePath(); ctx.fill();
    ctx.shadowColor = sc;
  }
  ctx.fillStyle = S.flash ? '#fff' : '#353d43';
  ctx.fillRect(-width, -25 * s, width * 2, 3 * s);
  ctx.fillStyle = S.acc; ctx.fillRect(-1.5 * s, -25.5 * s, 3 * s, 4 * s);
  if (armored) {                                               // 둥근 어깨 갑옷
    ctx.fillStyle = S.acc;
    for (const x of [-width - 0.5 * s, width - 1.5 * s]) {
      ctx.beginPath(); ctx.ellipse(x + 2 * s, -38.5 * s, 3.8 * s, 3 * s, 0, Math.PI, 0); ctx.fill();
    }
  }
}

function arm(S, hx, hy) {
  const { ctx, s } = S;
  ctx.strokeStyle = S.flash ? '#fff' : S.col;
  ctx.beginPath();
  ctx.moveTo(0, -38 * s);
  ctx.quadraticCurveTo(hx * 0.55, -38 * s + (hy + 38 * s) * 0.3, hx, hy);
  inkStroke(S, S.lw * 0.9); ctx.stroke();
}

function armWeapon(S, angle, drawWeapon, gripY) {
  const { ctx, s } = S;
  const st = S.style || 'slash';
  // 준비 동작: 내려찍기는 크게 뒤로, 마법은 지팡이를 치켜들고, 찌르기·쏘기는 조금만.
  const windK = { heavy: 1.15, cast: 0.9, slash: 0.6, thrust: 0.25, shoot: 0.12 }[st];
  angle -= S.wind * windK + (S.cheer ? 0.9 : 0);
  // 4.13 걸을 때는 걸음에 맞춰 무기를 든 팔이 흔들린다 (모두 같은 자세로 굳어 행진하던 것)
  if (S.live && S.moving && S.atk <= 0 && S.wind <= 0) angle += Math.sin(S.phase * 2) * 0.13;
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
  hand(S, gx, gy);                                       // 무기를 쥔 손은 자루 위에
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
  thrust: 'spear,spear_evo,pojol,frostlancer,valkyrie,hoplite,orcspear,runeguard,teslaknight,pharaoh,spartan,fenrir,bastet,lancer,nezha,celestial,monk,nagaspear,tidequeen',
  heavy: 'berserk,knight_evo,colossus_evo,thor_evo,wukong_evo,knight,colossus,thor,dokkaebi,ares,viking,ogre,troll,warlord,orcberserk,golem,dark,warchief,frostgiant,orcshield,haetae,shield,paladin,anubis,clocksoldier,mechanic,bajie,wujing,jailer,souleater,wukong,monkeyclone,stoneward,rockling,titan,demonknight,demonking,anchorguard,clawcrab,kraken,leviathan',
  cast: 'mage,mage_evo,priest_evo,necro_evo,frost,pyro,necro,priest,shaman,lich,hades,ra,gumiho,persephone,rapriest,runeseer,mudang,purifier,inventor,plaguer,zeus,herald,saja,odin,medusa,engineer,totem,sanzang,bellringer,chrono,mirror,riftcaller,voidlord,beacon,stormcaller,tidecaller,siren',
  shoot: 'archer,archer_evo,catapult_evo,venom,longbow,sniper,musketeer,rifleman,ballista,artemis,skadi,desertarcher,northarcher,catapult,orccatapult,airship,steammech,turret,javelin,falconer,alchemist,ghostgunner,harpoon,seahook'
};
// 4.3 3진
ATTACK_STYLES.thrust += ',drillspear';
ATTACK_STYLES.heavy += ',bulldozer'; ATTACK_STYLES.cast += ',icecart'; ATTACK_STYLES.shoot += ',railgun';   // 4.4
ATTACK_STYLES.heavy += ',megabot';
ATTACK_STYLES.cast += ',ambulance,ufo';
ATTACK_STYLES.shoot += ',tank,dronepilot';
// 4.13 4.6~4.11 의 새 병종 · 적도 공격 모양을 갖는다 (모두 기본 '베기' 로 휘두르던 것)
ATTACK_STYLES.heavy += ',maceman,stoneidol,triceratops,jungletyrant,raptorqueen,sporecap,mushking,treant,eldertree,irontrain,coalstoker';
ATTACK_STYLES.thrust += ',ashigaru,unicorn,lizardman';
ATTACK_STYLES.cast += ',miko,vineshaman,satyr,pixie,wisp,faequeen,quetzal,masklord';
ATTACK_STYLES.shoot += ',axethrower,siegebow,kyudo,poisontoad,handcar,jester,dunerider';
ATTACK_STYLES.heavy += ',scorpion,scorpking,sandworm,sandpharaoh,jackalgod';
ATTACK_STYLES.cast += ',sandmage,sphinx';
ATTACK_STYLES.heavy += ',guanyu,azureguan'; ATTACK_STYLES.cast += ',starmerlin'; ATTACK_STYLES.shoot += ',hovertank';   // 4.18 4진 ATTACK_STYLES.thrust += ',zhaoyun,zhangfei,jiqiang'; ATTACK_STYLES.cast += ',zhugeliang'; ATTACK_STYLES.shoot += ',huangzhong';   // 4.15 삼국지
const ATTACK_STYLE = {};
for (const k in ATTACK_STYLES) ATTACK_STYLES[k].split(',').forEach(id => { ATTACK_STYLE[id] = k; });
function attackStyle(st) { return ATTACK_STYLE[st.shape] || (st.ranged ? 'shoot' : 'slash'); }

function robe(S, w, top, color) {
  const { ctx, s } = S;
  ctx.fillStyle = color;
  ctx.beginPath();
  // 밑단이 걸음과 바람에 흔들린다
  const sway = S.live ? Math.sin((S.moving ? S.phase * 2 : MODEL.time * 1.6)) * (S.moving ? 3 : 1.4) * s : 0;
  ctx.moveTo(0, top);
  ctx.lineTo(w + sway, 0); ctx.quadraticCurveTo(sway * 0.5, 2.5 * s, -w + sway * 1.3, 0);
  ctx.closePath(); ctx.fill();
  if (!S.flash) {
    const sc = ctx.shadowColor; ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(0,0,0,.2)';                       // 등 쪽 그늘
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(-w * 0.1, 1 * s); ctx.lineTo(-w, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.2 * s;   // 주름
    ctx.beginPath(); ctx.moveTo(-w * .05, top * .55); ctx.lineTo(-w * .3, -1 * s);
    ctx.moveTo(w * .12, top * .5); ctx.lineTo(w * .28, -1 * s); ctx.stroke();
    ctx.strokeStyle = shade(S.acc, -0.05); ctx.lineWidth = 1.8 * s;  // 밑단 장식
    ctx.beginPath(); ctx.moveTo(w * 0.94, -1.6 * s); ctx.quadraticCurveTo(0, 0.9 * s, -w * 0.94, -1.6 * s); ctx.stroke();
    ctx.shadowColor = sc;
  }
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
  ctx.strokeStyle = S.flash ? '#fff' : INK;
  ctx.lineWidth = 1.6 * s;
  ctx.stroke();
  if (!S.flash) {                                          // 방패 면의 빛과 그늘
    const sc = ctx.shadowColor; ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.moveTo(x + 1.5 * s, y + 2 * s); ctx.lineTo(x + w * 0.5, y + 3 * s);
    ctx.lineTo(x + w * 0.5, y + h * 0.9); ctx.lineTo(x + 1.5 * s, y + h * 0.7); ctx.closePath(); ctx.fill();
    ctx.shadowColor = sc;
  }
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
  if (MODEL.ink) { ctx.strokeStyle = S.ink || INK; ctx.lineWidth = 1.1 * s; ctx.strokeRect(x, y, w, h); }
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
    ctx.beginPath(); ctx.arc(wx * s, y, r, 0, 7); inkStroke(S, 3.5 * s); ctx.stroke();
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

const HEAD_EYES = { cap: 1, wide: 1, pot: 1, kepi: 1, jeonrip: 1, hwarang: 1, gat: 1, plume: 1, winged: 1,
  laurel: 1, moon: 1, furhood: 1, wrap: 1, feather: 1, horn: 1, icehorn: 1, foxears: 1,
  bald: 1, circlet: 1, buns: 1, vairocana: 1, monkeyface: 1, witch: 1 };
const HEAD_VISOR = { greathelm: 1, corinth: 1, wingedhelm: 1 };
function head(S, type, radius) {
  const { ctx, s } = S;
  const r = radius || 8.5 * s;
  const cy = -50 * s;
  ctx.fillStyle = S.col;
  ctx.beginPath(); ctx.arc(0, cy, r, 0, 7); ctx.fill();
  if (!S.flash) {
    const sc = ctx.shadowColor; ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(0,0,0,.22)';                        // 뒤통수 그늘
    ctx.beginPath(); ctx.arc(0, cy, r, Math.PI * 0.55, Math.PI * 1.45); ctx.arc(r * 0.35, cy, r * 0.8, Math.PI * 1.35, Math.PI * 0.65, true); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)';                   // 이마 빛
    ctx.beginPath(); ctx.ellipse(r * 0.28, cy - r * 0.45, r * 0.38, r * 0.22, -0.5, 0, 7); ctx.fill();
    ctx.shadowColor = sc;
  }
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
    case 'bald':                                 // 민머리: 이마의 계인
      ctx._skipInk = true; ctx.fillStyle = S.flash ? '#fff' : S.acc;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((-2 + i * 3) * s, cy - r * 0.62, 0.9 * s, 0, 7); ctx.fill(); }
      ctx._skipInk = false;
      break;
    case 'circlet':                              // 손오공: 긴고아 + 원숭이 얼굴
      ctx.fillStyle = S.flash ? '#fff' : '#f0d4ae';
      ctx.beginPath(); ctx.ellipse(r * 0.35, cy + 1 * s, r * 0.62, r * 0.7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : S.col;
      ctx.beginPath(); ctx.arc(-r * 0.95, cy, 3.2 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = S.flash ? '#fff' : S.acc; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(0, cy, r + 0.4 * s, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.fillStyle = S.flash ? '#fff' : S.acc;
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.35 + k * 2.4 * s, cy - r - 0.6 * s, 1.5 * s, 0, 7); ctx.fill(); }
      break;
    case 'buns':                                 // 나타: 쌍상투
      ctx.fillStyle = S.flash ? '#fff' : '#1c1c22';
      ctx.beginPath(); ctx.arc(0, cy - 1 * s, r + 0.5 * s, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
      for (const bx of [-r * 0.55, r * 0.5]) { ctx.beginPath(); ctx.arc(bx, cy - r - 2 * s, 3.6 * s, 0, 7); ctx.fill(); }
      ctx.fillStyle = S.flash ? '#fff' : S.acc;
      for (const bx of [-r * 0.55, r * 0.5]) ctx.fillRect(bx - 3 * s, cy - r - 0.6 * s, 6 * s, 1.6 * s);
      break;
    case 'vairocana':                            // 삼장: 다섯 잎 비로관
      ctx.fillStyle = S.flash ? '#fff' : S.acc;
      for (let i = 0; i < 5; i++) {
        const px = (-8 + i * 4) * s, py = cy - r - (i === 2 ? 5 : i % 2 ? 3.4 : 2) * s;
        ctx.beginPath(); ctx.moveTo(px - 2 * s, cy - r + 2 * s); ctx.quadraticCurveTo(px, py - 4 * s, px + 2 * s, cy - r + 2 * s); ctx.closePath(); ctx.fill();
      }
      ctx.fillRect(-r - 0.5 * s, cy - r + 1 * s, (r + 0.5 * s) * 2, 2.4 * s);
      break;
    case 'monkeyface':                           // 원숭이: 밝은 얼굴과 붉은 머리띠
      ctx.fillStyle = S.flash ? '#fff' : '#f0d4ae';
      ctx.beginPath(); ctx.ellipse(r * 0.35, cy + 1 * s, r * 0.6, r * 0.66, 0, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : S.col;
      ctx.beginPath(); ctx.arc(-r * 0.95, cy, 2.8 * s, 0, 7); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : '#c0392b';
      ctx.fillRect(-r, cy - r * 0.6, r * 2, 2 * s);
      break;
    case 'witch':                                // 거울 마녀: 꺾인 뾰족 모자와 긴 머리
      ctx.fillStyle = S.flash ? '#fff' : '#2a2238';
      ctx.beginPath(); ctx.moveTo(-r * 0.6, cy - 2 * s); ctx.lineTo(-r - 5 * s, cy + 15 * s); ctx.lineTo(-r + 4 * s, cy + 11 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.tun;
      ctx.beginPath(); ctx.ellipse(0, cy - r * 0.55, r + 8 * s, 2.6 * s, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * 0.8, cy - r * 0.6); ctx.lineTo(r * 0.8, cy - r * 0.6);
      ctx.quadraticCurveTo(r * 0.2, cy - r - 12 * s, -7 * s, cy - r - 20 * s); ctx.quadraticCurveTo(-3 * s, cy - r - 8 * s, -r * 0.8, cy - r * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.flash ? '#fff' : S.acc;
      ctx.fillRect(-r * 0.75, cy - r * 0.95, r * 1.5, 2 * s);
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
  // 2.8: 얼굴이 가려지지 않는 머리에 눈을 그린다. 투구는 눈구멍에 빛만.
  if (!S.flash && HEAD_EYES[type]) {
    const sc = ctx.shadowColor; ctx.shadowColor = 'transparent';
    const ex = r * 0.5, ey = cy + r * 0.02;
    ctx._skipInk = true;
    if (MODEL.blink && S.live) {                          // 깜빡
      ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(ex - 1.8 * s, ey + 0.4 * s); ctx.lineTo(ex + 1.8 * s, ey + 0.4 * s); ctx.stroke();
    } else {
      ctx.fillStyle = '#f4f1ea';
      ctx.beginPath(); ctx.ellipse(ex, ey, 1.9 * s, 2.2 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#16181d';
      ctx.beginPath(); ctx.arc(ex + 0.6 * s, ey + 0.2 * s, 1.05 * s, 0, 7); ctx.fill();
    }
    if (MODEL.angry && S.live) {                          // 싸울 때 선 눈썹
      ctx.strokeStyle = '#0e0f12'; ctx.lineWidth = 1.2 * s;
      ctx.beginPath(); ctx.moveTo(ex - 2.4 * s, ey - 3.4 * s); ctx.lineTo(ex + 2.2 * s, ey - 2 * s); ctx.stroke();
    }
    ctx._skipInk = false;
    ctx.shadowColor = sc;
  } else if (!S.flash && HEAD_VISOR[type]) {
    ctx.fillStyle = 'rgba(255,240,200,.75)';
    ctx.fillRect(r * 0.35, cy + (type === 'greathelm' ? 2.4 : 1.2) * s, 3.4 * s, 1.3 * s);
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
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.stroke();
}

function tri(S, x1, y1, x2, y2, x3, y3, col) {
  const ctx = S.ctx;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
  ctx.closePath();
  // 큰 삼각형(칼날·창끝·망토)만 테두리 — 작은 장식까지 그으면 뭉개진다
  ctx._skipInk = Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) < 60 * S.s * S.s;
  ctx.fill();
  ctx._skipInk = false;
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

/* 매 (매 조련사). flap 은 날갯짓 위상, k 는 크기 */
function falcon(S, x, y, flap, color, k) {
  const { ctx, s } = S;
  const m = (k || 1) * s, wing = Math.sin(flap);
  ctx._skipInk = true;
  ctx.fillStyle = S.flash ? '#fff' : '#6b4a2e';
  ctx.beginPath(); ctx.moveTo(x - 2 * m, y - 1 * m); ctx.lineTo(x - 11 * m, y - 3 * m - wing * 8 * m); ctx.lineTo(x + 3 * m, y - 2 * m); ctx.closePath(); ctx.fill();
  ctx.fillStyle = S.flash ? '#fff' : '#8a6a44';
  ctx.beginPath(); ctx.ellipse(x, y, 6 * m, 3.4 * m, -0.2, 0, 7); ctx.fill();
  ctx.fillStyle = S.flash ? '#fff' : color;
  ctx.beginPath(); ctx.moveTo(x - 5 * m, y); ctx.lineTo(x - 11 * m, y + 2.4 * m); ctx.lineTo(x - 5 * m, y + 2.6 * m); ctx.closePath(); ctx.fill();
  ctx.fillStyle = S.flash ? '#fff' : '#e8dcc0';
  ctx.beginPath(); ctx.arc(x + 5 * m, y - 2 * m, 2.6 * m, 0, 7); ctx.fill();
  ctx.fillStyle = S.flash ? '#fff' : '#ffc94a';
  ctx.beginPath(); ctx.moveTo(x + 7 * m, y - 2.6 * m); ctx.lineTo(x + 10 * m, y - 1.2 * m); ctx.lineTo(x + 7 * m, y - 0.6 * m); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#16181d';
  ctx.beginPath(); ctx.arc(x + 5.8 * m, y - 2.6 * m, 0.8 * m, 0, 7); ctx.fill();
  ctx.fillStyle = S.flash ? '#fff' : '#5a3a22';
  ctx.beginPath(); ctx.moveTo(x - 1 * m, y); ctx.lineTo(x - 8 * m, y - 2 * m + wing * 7 * m); ctx.lineTo(x + 2 * m, y + 1 * m); ctx.closePath(); ctx.fill();
  ctx._skipInk = false;
}

/* 종 (종지기) */
function bellShape(S, x, y, w, h, color) {
  const { ctx, s } = S;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.45, y);
  ctx.quadraticCurveTo(x - w * 0.5, y + h * 0.6, x - w, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.6, x + w * 0.45, y);
  ctx.quadraticCurveTo(x, y - h * 0.22, x - w * 0.45, y);
  ctx.closePath(); ctx.fill();
  if (!S.flash) {
    ctx._skipInk = true;
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(x - w * 0.3, y + h * 0.45, w * 0.14, h * 0.3, 0.15, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(x - w, y + h - 2 * s, w * 2, 2 * s);
    ctx._skipInk = false;
  }
  ctx.fillStyle = S.flash ? '#fff' : '#5a4a2a';
  ctx.beginPath(); ctx.arc(x, y + h + 1.6 * s, 2.1 * s, 0, 7); ctx.fill();
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
/* 3.8: 아이콘은 한 번 그려 두고 복사만 한다. 편성·훈련소는 칸마다 80여 개를 다시 그리느라
 * 누를 때마다 끊겼다 (폰에서 수십~수백 ms). 모습이 같으면(이름·모양·색·진화·크기) 같은 그림이다. */
const _iconCache = new Map();
const ICON_WIDE = { catapult: 1, goldcart: 1, knight_evo: 1, catapult_evo: 1, colossus_evo: 1, wukong_evo: 1, wolf: 1, spider: 1, merchant: 1, sniper: 1, drake: 1, hellhound: 1, spiderqueen: 1, lancer: 1, griffinrider: 1, stormgriffin: 1, skycannon: 1,
  ambulance: 1, tank: 1, ufo: 1 };
/* 4.3 3진: 몸이 크거나 비대칭인 모습은 아이콘 칸에 맞춰 줄이고 옮긴다 [배율, 가로 자리, 세로 자리] */
const ICON_FIT = { tank: [0.68, 0.42, 0.9], ambulance: [0.78, 0.5, 0.92], ufo: [0.82, 0.5, 0.86], megabot: [0.62, 0.48, 0.96],
  dronepilot: [0.74, 0.46, 0.97], drillspear: [0.8, 0.33, 0.95],
  bulldozer: [0.78, 0.44, 0.9], icecart: [0.8, 0.3, 0.92], lightsaber: [0.82, 0.4, 0.95], railgun: [0.72, 0.28, 0.95] };
/* 화면 밖 아이콘은 보일 때 그린다 (훈련소는 카드가 80개 넘지만 한 화면엔 네댓 개) */
const _iconLazy = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        _iconLazy.unobserve(e.target);
        const job = e.target._icon; e.target._icon = null;
        if (job) paintUnitIcon(e.target, job.stats, job.px);
      }
    }, { rootMargin: '200px' })
  : null;
function drawUnitIcon(canvas, stats, size) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = size || 52;
  canvas.style.width = px + 'px';
  canvas.style.height = px + 'px';
  if (_iconLazy) {
    canvas.width = px * dpr; canvas.height = px * dpr;     // 자리만 먼저 잡아 둔다
    canvas._icon = { stats: stats, px: px };
    _iconLazy.observe(canvas);
    return;
  }
  paintUnitIcon(canvas, stats, px);
}
function paintUnitIcon(canvas, stats, px) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== px * dpr || canvas.height !== px * dpr) { canvas.width = px * dpr; canvas.height = px * dpr; }
  const key = [stats.id || '', stats.name, stats.shape, stats.body, stats.accent, stats.tunic, stats.evo ? 1 : 0, px, dpr].join('|');
  let img = _iconCache.get(key);
  if (!img) {
    img = document.createElement('canvas');
    img.width = px * dpr; img.height = px * dpr;
    const c = img.getContext('2d');
    // 아이콘은 한 번 그려 오래 쓴다. 전투가 남긴 그림자·테두리 끔 상태로 굳지 않게 늘 다 켜고 그린다.
    const depth = MODEL.depth, ink = MODEL.ink;
    MODEL.depth = true; MODEL.ink = true;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fit = ICON_FIT[stats.shape];
    const k = fit ? fit[0] : ICON_WIDE[stats.shape] ? 0.86 : 1;
    const s = (px / 96) * k;
    c.save();
    c.translate(px * (fit ? fit[1] : ICON_WIDE[stats.shape] ? 0.5 : 0.44), px * (fit ? fit[2] : 0.94));
    drawBody(c, stats, s, false, false, 0, false, 0);
    c.restore();
    MODEL.depth = depth; MODEL.ink = ink;
    if (_iconCache.size > 600) _iconCache.clear();
    _iconCache.set(key, img);
  }
  const ctx = canvas.getContext('2d');
  if (canvas._painted) ctx.clearRect(0, 0, canvas.width, canvas.height);   // 새 캔버스는 이미 비어 있다
  canvas._painted = true;
  ctx.drawImage(img, 0, 0);
}

/* 캔버스에 쓰는 글자 번역. i18n.js 가 없으면(비교판 등) 그대로 */
function tr(s) { return typeof t === 'function' ? t(s) : s; }

/* =======================================================================
 *  전장 모습 (2.9). 전장 컨셉(STAGES[i].look)마다 하늘·산·땅 색, 배경 층, 소품, 날씨가 다르다.
 *  ridge: 'sharp' 뾰족한 산 · 'round' 둥근 언덕 · 'mesa' 탁상지 · 'dune' 모래 언덕
 * ======================================================================= */
const FIELD_LOOKS = {
  meadow:    { sky0: '#8ec3e6', sky1: '#e6efd8', cloud: 'rgba(255,255,255,.85)', ridgeFar: '#86a7b6', ridge: '#5f8a5c', ridgeStyle: 'round',
               ground: '#7f9a4f', groundDark: '#5a7236', speck: '#6d8a42', prop: '#4d6a34', orb: '#fff3c4', orbGlow: 'rgba(255,250,220,.45)',
               layers: ['farTrees', 'flowers'], props: ['tree', 'bush', 'rock', 'flowerbush'], weather: 'petals' },
  wheat:     { sky0: '#e9b877', sky1: '#f8e7c0', cloud: 'rgba(255,245,225,.7)', ridgeFar: '#c9a26e', ridge: '#b0894e', ridgeStyle: 'round',
               ground: '#c9a55a', groundDark: '#8f7236', speck: '#b08a45', prop: '#7a5c2e', orb: '#ffe29a', orbGlow: 'rgba(255,220,150,.5)',
               layers: ['windmill', 'wheat'], props: ['sheaf', 'fence', 'rock'], weather: 'chaff' },
  river:     { sky0: '#9cc6e0', sky1: '#e3edea', cloud: 'rgba(255,255,255,.8)', ridgeFar: '#7f9fb3', ridge: '#5b7f6a', ridgeStyle: 'sharp',
               ground: '#7a8a5a', groundDark: '#566340', speck: '#6b7a4c', prop: '#445a3a', orb: '#fff6d0', orbGlow: 'rgba(255,250,220,.4)',
               layers: ['river', 'bridge'], props: ['reeds', 'rock', 'tree'] },
  forest:    { sky0: '#8fb3b8', sky1: '#dfe6d6', cloud: 'rgba(255,255,255,.6)', ridgeFar: '#6b8a86', ridge: '#3f6150', ridgeStyle: 'sharp',
               ground: '#5d6f3e', groundDark: '#3f4d2a', speck: '#4e5e34', prop: '#2f4a30', orb: '#f1f0d0', orbGlow: 'rgba(240,250,210,.35)',
               layers: ['pines'], props: ['pine', 'stump', 'rock'], weather: 'leaves' },
  graveyard: { sky0: '#2c3350', sky1: '#5e5a78', cloud: 'rgba(200,200,225,.22)', ridgeFar: '#3b3e5a', ridge: '#2a2a40', ridgeStyle: 'round',
               ground: '#434055', groundDark: '#2a2838', speck: '#383548', prop: '#1e1d2a', orb: '#e8ecff', orbGlow: 'rgba(210,220,255,.3)',
               moon: true, stars: true, fog: 'rgba(170,180,210,.2)', layers: ['tombs', 'deadTrees'], props: ['tomb', 'cross', 'deadtree'], weather: 'wisps' },
  cave:      { sky0: '#141319', sky1: '#352f40', cloud: null, ridgeFar: '#2d2a36', ridge: '#231f2b', ridgeStyle: 'sharp', noOrb: true,
               ground: '#3d3844', groundDark: '#27232d', speck: '#332f3a', prop: '#1a1720',
               layers: ['caveWall', 'crystals', 'caveCeiling'], props: ['stalagmite', 'crystal', 'web'], weather: 'drips' },
  hills:     { sky0: '#a9c2d6', sky1: '#eadfc6', cloud: 'rgba(255,255,255,.75)', ridgeFar: '#93a4a8', ridge: '#6f7f5a', ridgeStyle: 'round',
               ground: '#8a8456', groundDark: '#5e5a38', speck: '#77724a', prop: '#4f4c30', orb: '#fff0c0', orbGlow: 'rgba(255,245,210,.45)',
               layers: ['watchtowers'], props: ['rock', 'fence', 'arrows'] },
  camp:      { sky0: '#d9895a', sky1: '#f3c98c', cloud: 'rgba(255,220,190,.5)', ridgeFar: '#a5695a', ridge: '#6e4a3e', ridgeStyle: 'round',
               ground: '#8a6a48', groundDark: '#5c4430', speck: '#76593c', prop: '#3e2c20', orb: '#ffd08a', orbGlow: 'rgba(255,200,140,.5)',
               layers: ['tents'], props: ['totem', 'campfire', 'rock'], weather: 'sparks' },
  canyon:    { sky0: '#e28f55', sky1: '#f6d6a0', cloud: 'rgba(255,235,210,.5)', ridgeFar: '#c46a44', ridge: '#9a4a30', ridgeStyle: 'mesa',
               ground: '#b8764a', groundDark: '#7e4c2e', speck: '#a0633c', prop: '#6a3a22', orb: '#fff0c0', orbGlow: 'rgba(255,230,180,.5)',
               layers: ['arches'], props: ['cactus', 'rock', 'powder'], weather: 'dust' },
  fortress:  { sky0: '#8c9fb3', sky1: '#dcdfe0', cloud: 'rgba(255,255,255,.7)', ridgeFar: '#7a8794', ridge: '#5d6873', ridgeStyle: 'sharp',
               ground: '#7c7766', groundDark: '#57534a', speck: '#6b675a', prop: '#3f3c36', orb: '#f4f2e0', orbGlow: 'rgba(255,255,240,.35)',
               layers: ['walls'], props: ['banner', 'barricade', 'rock'] },
  darkforest:{ sky0: '#39475a', sky1: '#7d8a86', cloud: 'rgba(200,210,210,.25)', ridgeFar: '#384a4c', ridge: '#1f2f2c', ridgeStyle: 'sharp',
               ground: '#3d4a36', groundDark: '#28321f', speck: '#33402c', prop: '#16211a', orb: '#dfe6e0', orbGlow: 'rgba(220,230,225,.25)', moon: true,
               fog: 'rgba(160,180,170,.22)', layers: ['pinesDark'], props: ['pine', 'deadtree', 'stump'], weather: 'fireflies' },
  ruins:     { sky0: '#5b6a86', sky1: '#b3b3c4', cloud: 'rgba(230,230,240,.35)', ridgeFar: '#586079', ridge: '#3d4459', ridgeStyle: 'round',
               ground: '#6a6878', groundDark: '#48465a', speck: '#5a586a', prop: '#2e2c3c', orb: '#eef0ff', orbGlow: 'rgba(230,235,255,.3)',
               fog: 'rgba(200,200,230,.18)', layers: ['ruins'], props: ['column', 'rubble', 'deadtree'], weather: 'wisps' },
  swamp:     { sky0: '#56705c', sky1: '#a9b894', cloud: 'rgba(210,220,200,.35)', ridgeFar: '#4e6752', ridge: '#35493a', ridgeStyle: 'round',
               ground: '#4d5a3a', groundDark: '#323b25', speck: '#414d30', prop: '#222b1a', orb: '#e2e8c8', orbGlow: 'rgba(220,235,200,.3)',
               fog: 'rgba(160,190,140,.25)', layers: ['swampWater', 'deadTrees'], props: ['reeds', 'deadtree', 'mushroom'], weather: 'spores' },
  snow:      { sky0: '#a9c1d8', sky1: '#eef3f7', cloud: 'rgba(255,255,255,.85)', ridgeFar: '#a8b9ca', ridge: '#8196aa', ridgeStyle: 'sharp', snowcap: true,
               ground: '#dfe6ec', groundDark: '#aeb9c3', speck: '#c7d0d8', prop: '#5e6f80', orb: '#ffffff', orbGlow: 'rgba(255,255,255,.5)',
               layers: ['snowPines'], props: ['snowpine', 'snowrock', 'icecrystal'], weather: 'snow' },
  blizzard:  { sky0: '#8e9eae', sky1: '#d8dee4', cloud: 'rgba(240,244,248,.7)', ridgeFar: '#9aa8b6', ridge: '#76889a', ridgeStyle: 'sharp', snowcap: true,
               ground: '#d6dde4', groundDark: '#a3aeb9', speck: '#bec8d1', prop: '#566676', noOrb: true, fog: 'rgba(235,240,245,.35)',
               layers: ['snowPines'], props: ['snowpine', 'snowrock', 'icecrystal'], weather: 'blizzard' },
  volcano:   { sky0: '#3a1f24', sky1: '#a3462f', cloud: 'rgba(80,50,50,.45)', ridgeFar: '#4a2a2a', ridge: '#2b1a1c', ridgeStyle: 'sharp',
               ground: '#3b2a26', groundDark: '#231816', speck: '#5a2a1a', prop: '#1c1414', orb: '#ff9a5a', orbGlow: 'rgba(255,120,60,.35)',
               layers: ['volcano', 'lavaCracks'], props: ['obsidian', 'rock', 'bones'], weather: 'embers' },
  warcamp:   { sky0: '#5a2b2b', sky1: '#c2703f', cloud: 'rgba(90,50,45,.5)', ridgeFar: '#5a3a35', ridge: '#3a2622', ridgeStyle: 'sharp',
               ground: '#5a4634', groundDark: '#3a2c20', speck: '#4a3828', prop: '#241a12', orb: '#ff8a5a', orbGlow: 'rgba(255,120,80,.35)',
               layers: ['palisade', 'warBanners'], props: ['spikes', 'bones', 'orcbanner'], weather: 'ash' },
  blackriver:{ sky0: '#1f2d3a', sky1: '#4e6470', cloud: 'rgba(150,170,180,.25)', ridgeFar: '#2d3e48', ridge: '#1d2a30', ridgeStyle: 'round',
               ground: '#3a4034', groundDark: '#252a22', speck: '#30362c', prop: '#141a16', orb: '#e0f0f0', orbGlow: 'rgba(200,230,230,.3)',
               moon: true, stars: true, fog: 'rgba(150,180,180,.2)', layers: ['riverDark', 'deadTrees'], props: ['reeds', 'deadtree', 'lantern'], weather: 'fireflies' },
  underworld:{ sky0: '#1a1030', sky1: '#4a2a5a', cloud: 'rgba(120,90,160,.25)', ridgeFar: '#2a1a40', ridge: '#1a1028', ridgeStyle: 'sharp',
               ground: '#2c2436', groundDark: '#1a1522', speck: '#241d2e', prop: '#120d18', orb: '#b89aff', orbGlow: 'rgba(170,140,255,.3)',
               stars: true, fog: 'rgba(150,120,200,.22)', layers: ['spires', 'soulFires'], props: ['tomb', 'bonepile', 'soulflame'], weather: 'souls' },
  thorns:    { sky0: '#4a3a4a', sky1: '#a38a8a', cloud: 'rgba(200,170,170,.3)', ridgeFar: '#4a3a44', ridge: '#2e2430', ridgeStyle: 'sharp',
               ground: '#4a3e3a', groundDark: '#2e2624', speck: '#3e3430', prop: '#1e1616', orb: '#f0d0c0', orbGlow: 'rgba(240,200,190,.3)',
               layers: ['walls', 'thornVines'], props: ['thornbush', 'spikes', 'banner'], weather: 'ash' },
  desert:    { sky0: '#e6b36b', sky1: '#fbe7bb', cloud: 'rgba(255,245,220,.5)', ridgeFar: '#d9a868', ridge: '#c38c4f', ridgeStyle: 'dune',
               ground: '#dcb577', groundDark: '#b38a4f', speck: '#c9a060', prop: '#8a6434', orb: '#fff8d0', orbGlow: 'rgba(255,240,180,.6)',
               layers: ['pyramids'], props: ['cactus', 'obelisk', 'bones'], weather: 'dust' },
  eclipse:   { sky0: '#2a1a2e', sky1: '#a0603a', cloud: 'rgba(120,70,60,.35)', ridgeFar: '#5a3a2a', ridge: '#3a2418', ridgeStyle: 'dune',
               ground: '#8a6a44', groundDark: '#5a4428', speck: '#765a38', prop: '#2e2014', eclipse: true, stars: true,
               layers: ['obelisks'], props: ['obelisk', 'brazier', 'bones'], weather: 'dust' },
  mythic:    { sky0: '#0f1438', sky1: '#4a3a7a', cloud: 'rgba(140,120,220,.2)', ridgeFar: '#2a2a5a', ridge: '#1c1a3a', ridgeStyle: 'sharp',
               ground: '#3a3456', groundDark: '#241f3a', speck: '#302a4a', prop: '#15122a', orb: '#fff2c0', orbGlow: 'rgba(255,230,160,.35)',
               stars: true, aurora: true, layers: ['floating'], props: ['crystal', 'column', 'runestone'], weather: 'motes' },
  /* 3.3 3막 '심연의 바다' */
  shore:     { sky0: '#7fb4d6', sky1: '#f0e6cc', cloud: 'rgba(255,255,255,.8)', ridgeFar: '#7a9ab0', ridge: '#5e7f8a', ridgeStyle: 'round',
               ground: '#d6c08a', groundDark: '#a8925e', speck: '#c2ab76', prop: '#6b5434', orb: '#fff6d0', orbGlow: 'rgba(255,250,220,.5)',
               layers: ['sea', 'shipwrecks'], props: ['shell', 'plank', 'seaweed', 'rock'], weather: 'spray' },
  reef:      { sky0: '#5ec8d8', sky1: '#d8f4ec', cloud: 'rgba(255,255,255,.75)', ridgeFar: '#6ab0b8', ridge: '#3f8a90', ridgeStyle: 'round',
               ground: '#e2cf9c', groundDark: '#b8a06a', speck: '#d0b880', prop: '#c0604a', orb: '#ffffe0', orbGlow: 'rgba(255,255,230,.5)',
               layers: ['sea', 'coralReef'], props: ['coralbush', 'shell', 'seaweed'], weather: 'bubbles' },
  stormsea:  { sky0: '#2c3846', sky1: '#6a7a86', cloud: 'rgba(90,100,115,.7)', ridgeFar: '#3a4a58', ridge: '#28343f', ridgeStyle: 'sharp',
               ground: '#5a5e58', groundDark: '#3a3e3a', speck: '#4c504a', prop: '#22282a', noOrb: true, fog: 'rgba(160,175,190,.18)',
               layers: ['stormClouds', 'sea', 'shipwrecks'], props: ['anchorprop', 'plank', 'rock'], weather: 'rain' },
  lighthouse:{ sky0: '#3a4a64', sky1: '#a8a8b8', cloud: 'rgba(220,225,235,.4)', ridgeFar: '#4a5a70', ridge: '#34404e', ridgeStyle: 'sharp',
               ground: '#6a6a5e', groundDark: '#46463e', speck: '#5a5a50', prop: '#2a2a26', orb: '#f0f0ff', orbGlow: 'rgba(230,235,255,.3)', moon: true,
               fog: 'rgba(200,210,225,.28)', layers: ['sea', 'lighthouseTower'], props: ['buoy', 'rock', 'seaweed'], weather: 'spray' },
  sunken:    { sky0: '#0f3a4a', sky1: '#2f7a7a', cloud: null, ridgeFar: '#1f4a56', ridge: '#163842', ridgeStyle: 'round', noOrb: true,
               ground: '#3a5a52', groundDark: '#24403a', speck: '#30504a', prop: '#122a26', fog: 'rgba(120,200,190,.16)',
               layers: ['ruins', 'kelp'], props: ['column', 'seaweed', 'coralbush'], weather: 'bubbles' },
  abyss:     { sky0: '#04101c', sky1: '#0e2a3a', cloud: null, ridgeFar: '#0a1e2a', ridge: '#061622', ridgeStyle: 'sharp', noOrb: true,
               ground: '#1a2a30', groundDark: '#0e1a1e', speck: '#16242a', prop: '#04090c', stars: true, fog: 'rgba(80,200,180,.12)',
               layers: ['abyssVents', 'kelp'], props: ['bonepile', 'seaweed', 'crystal'], weather: 'bubbles' },
  /* 4.0 4막 '천공 요새' */
  skyisle:   { sky0: '#6fb0f0', sky1: '#eaf4ff', cloud: 'rgba(255,255,255,.92)', ridgeFar: '#a9c8e8', ridge: '#8fb4d8', ridgeStyle: 'round',
               ground: '#9ab86a', groundDark: '#6e8a48', speck: '#86a65a', prop: '#4f6e3a', orb: '#fffbe0', orbGlow: 'rgba(255,252,230,.55)',
               layers: ['skyIslands', 'cloudSea'], props: ['cloudpuff', 'windvane', 'rock'], weather: 'wind' },
  stormspire:{ sky0: '#232a44', sky1: '#5c6688', cloud: 'rgba(80,90,120,.6)', ridgeFar: '#36405e', ridge: '#283048', ridgeStyle: 'sharp',
               ground: '#5a6070', groundDark: '#3a3e4c', speck: '#4c5262', prop: '#1e2230', noOrb: true, fog: 'rgba(150,170,220,.18)',
               layers: ['stormClouds', 'skySpires', 'cloudSea'], props: ['lightrod', 'rubble', 'windvane'], weather: 'wind' },
  endless:   { sky0: '#44384e', sky1: '#c0885a', cloud: 'rgba(120,90,90,.35)', ridgeFar: '#4a3a48', ridge: '#2e2430', ridgeStyle: 'sharp',
               ground: '#5a4a3a', groundDark: '#3a2e24', speck: '#4c3e30', prop: '#221a14', orb: '#ffb070', orbGlow: 'rgba(255,160,100,.35)',
               layers: ['wreckage'], props: ['spear', 'banner', 'rock'], weather: 'ash' },
  /* 4.6 5막 '잊힌 밀림' */
  jungle:    { sky0: '#5f9a86', sky1: '#d6e8b8', cloud: 'rgba(240,255,235,.55)', ridgeFar: '#4f7f62', ridge: '#2f5a3c', ridgeStyle: 'round',
               ground: '#4f6a32', groundDark: '#33461e', speck: '#3f5626', prop: '#1f3d22', orb: '#fff6c8', orbGlow: 'rgba(255,250,200,.4)',
               fog: 'rgba(200,235,200,.3)', layers: ['jungleCanopy', 'jungleVines', 'jungleRoots'], props: ['fern', 'palm', 'mushroom', 'rock'], weather: 'fireflies' },
  temple:    { sky0: '#7a9a7a', sky1: '#e8e0b8', cloud: 'rgba(250,245,225,.5)', ridgeFar: '#62806a', ridge: '#3a5a40', ridgeStyle: 'round',
               ground: '#6a6a42', groundDark: '#46462a', speck: '#5a5a36', prop: '#2a3a24', orb: '#ffe9a8', orbGlow: 'rgba(255,230,160,.45)',
               fog: 'rgba(230,230,190,.28)', layers: ['templePyramids', 'jungleCanopy', 'templeSteps'], props: ['idolhead', 'fern', 'column', 'brazier'], weather: 'motes' },
  lavajungle:{ sky0: '#3a2228', sky1: '#b8603a', cloud: 'rgba(90,55,50,.45)', ridgeFar: '#4a3030', ridge: '#24281c', ridgeStyle: 'round',
               ground: '#3e3a22', groundDark: '#261f14', speck: '#4e2a18', prop: '#141a10', orb: '#ff9a5a', orbGlow: 'rgba(255,120,60,.35)',
               layers: ['volcano', 'jungleCanopy', 'lavaRiver', 'lavaCracks'], props: ['palm', 'obsidian', 'idolhead', 'fern'], weather: 'embers' },
  /* 4.11 6막 '홀린 요정 숲' */
  feywood:   { sky0: '#4a5a8a', sky1: '#e8c8e8', cloud: 'rgba(255,235,250,.5)', ridgeFar: '#5a5a8a', ridge: '#3a4a6a', ridgeStyle: 'round',
               ground: '#4a6a4a', groundDark: '#2e462e', speck: '#5a7a52', prop: '#24382a', orb: '#fff0fa', orbGlow: 'rgba(255,220,250,.45)',
               fog: 'rgba(230,200,250,.25)', layers: ['feyTrees', 'fairyRings'], props: ['mushroom', 'flowerbush', 'fern', 'lantern'], weather: 'fireflies' },
  mushgrove: { sky0: '#3a4a5a', sky1: '#c8b8a0', cloud: 'rgba(230,210,230,.4)', ridgeFar: '#5a4a5a', ridge: '#6a3a4a', ridgeStyle: 'round',
               ground: '#5a4a3a', groundDark: '#3a2e22', speck: '#6a5a44', prop: '#2a2018', orb: '#f0d8ff', orbGlow: 'rgba(220,180,255,.4)',
               fog: 'rgba(200,170,220,.28)', layers: ['giantShrooms', 'jungleRoots'], props: ['mushroom', 'stump', 'fern', 'bones'], weather: 'spores' },
  moonglade: { sky0: '#141a3a', sky1: '#4a4a7a', cloud: 'rgba(160,170,220,.3)', ridgeFar: '#2a2e5a', ridge: '#1e2444', ridgeStyle: 'round',
               ground: '#2e3e48', groundDark: '#1c2830', speck: '#3a4e58', prop: '#121c22', orb: '#f0f4ff', orbGlow: 'rgba(200,220,255,.35)', moon: true, stars: true,
               fog: 'rgba(150,200,255,.18)', layers: ['feyTrees', 'glowFlowers'], props: ['crystal', 'flowerbush', 'lantern'], weather: 'wisps' },
  /* 4.15 7막: 모래폭풍 사막 */
  dunes:     { sky0: '#e8a860', sky1: '#fbe2b0', cloud: 'rgba(255,240,215,.45)', ridgeFar: '#e0aa6a', ridge: '#c98e50', ridgeStyle: 'dune',
               ground: '#e0b878', groundDark: '#b88c50', speck: '#cfa262', prop: '#8a6434', orb: '#fff6c8', orbGlow: 'rgba(255,236,170,.65)',
               layers: ['duneWaves', 'sandColossi'], props: ['cactus', 'bones', 'rock', 'obelisk'], weather: 'sandgust' },
  tombvalley:{ sky0: '#b8603a', sky1: '#f0c080', cloud: 'rgba(255,220,180,.4)', ridgeFar: '#a8643e', ridge: '#7a4428', ridgeStyle: 'mesa',
               ground: '#c09060', groundDark: '#8a6038', speck: '#a87a4a', prop: '#4a2e18', orb: '#ffe0a0', orbGlow: 'rgba(255,200,130,.5)',
               layers: ['tombCliffs', 'sandColossi'], props: ['obelisk', 'brazier', 'bones', 'column'], weather: 'dust' },
  oasis:     { sky0: '#f0b878', sky1: '#fff0c8', cloud: 'rgba(255,250,230,.6)', ridgeFar: '#d8b07a', ridge: '#b89058', ridgeStyle: 'dune',
               ground: '#d8b47a', groundDark: '#a88650', speck: '#c8a46a', prop: '#5a4a24', orb: '#fffbe0', orbGlow: 'rgba(255,245,200,.7)',
               layers: ['duneWaves', 'oasisPalms', 'oasisPool'], props: ['palm', 'reeds', 'rock', 'cactus'], weather: 'heathaze' },
  /* 4.15 도전: 파라오의 모래시계 — 피라미드 속 금빛 묘실, 천장에서 모래가 폭포처럼 쏟아진다 */
  goldtomb:  { sky0: '#2a1e14', sky1: '#8a5e2a', cloud: null, ridgeFar: '#4a3420', ridge: '#3a2816', ridgeStyle: 'mesa', noOrb: true,
               ground: '#b08850', groundDark: '#7a5a30', speck: '#9a7444', prop: '#3a2614', fog: 'rgba(255,200,120,.12)',
               layers: ['tombCliffs', 'sandFalls'], props: ['obelisk', 'brazier', 'column', 'bones'], weather: 'sandgust' },
  /* 4.6 도전: 폭주 기관차 · 그림자 가면무도회 */
  railway:   { sky0: '#e07a48', sky1: '#f8d898', cloud: 'rgba(255,225,190,.55)', ridgeFar: '#b8664a', ridge: '#8a4a34', ridgeStyle: 'mesa',
               ground: '#8a6a44', groundDark: '#5e462c', speck: '#7a5a38', prop: '#3a2a1c', orb: '#fff0b0', orbGlow: 'rgba(255,230,150,.45)',
               layers: ['waterTower', 'telegraph', 'railTrack'], props: ['cactus', 'powder', 'rock', 'signpost'], weather: 'steam' },
  ballroom:  { sky0: '#1c1028', sky1: '#4a2a4e', cloud: null, ridgeFar: '#2a1838', ridge: '#24142e', ridgeStyle: 'round', noOrb: true, noRidge: true,
               ground: '#3a2a3e', groundDark: '#22162a', speck: '#2e2034', prop: '#120a18', fog: 'rgba(200,120,220,.16)',
               layers: ['ballroomHall', 'chandeliers', 'checkerFloor'], props: ['candelabra', 'maskprop', 'column'], weather: 'confetti' }
};
/* 예전 이름 (진군도 점 색 등) */
const FIELD_PALETTES = Object.keys(FIELD_LOOKS).map(k => FIELD_LOOKS[k]);
/* 시차를 두고 같은 모양을 반복해 그린다 */
const BG_FAR_PAR = 0.6, BG_FAR_DPR = 1.25;   // 먼 배경 겹: 가장 빠른 시차, 해상도 상한
function repL(R, cam, par, period, fn) {
  const o = cam * par;
  const k0 = Math.floor((o - 240) / period), k1 = Math.ceil((o + R.w + 240) / period);
  for (let k = k0; k <= k1; k++) fn(k * period - o, k);
}
function pineShape(ctx, x, y, h, col, snow) {
  ctx.fillStyle = col;
  for (let j = 0; j < 3; j++) {
    const ty = y - h * (0.35 + j * 0.28), bw = h * (0.34 - j * 0.07);
    ctx.beginPath(); ctx.moveTo(x, ty - h * 0.3); ctx.lineTo(x + bw, ty + h * 0.12); ctx.lineTo(x - bw, ty + h * 0.12); ctx.closePath(); ctx.fill();
    if (snow) { ctx.fillStyle = 'rgba(250,252,255,.85)'; ctx.beginPath(); ctx.moveTo(x, ty - h * 0.3); ctx.lineTo(x + bw * 0.5, ty - h * 0.08); ctx.lineTo(x - bw * 0.5, ty - h * 0.08); ctx.closePath(); ctx.fill(); ctx.fillStyle = col; }
  }
  ctx.fillRect(x - h * 0.03, y - h * 0.2, h * 0.06, h * 0.2);
}
function bareTree(ctx, x, y, h, col, seed) {
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.07;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.05, y - h); ctx.stroke();
  ctx.lineWidth = h * 0.035;
  for (let j = 0; j < 4; j++) {
    const by = y - h * (0.45 + j * 0.14), d = (j % 2 ? 1 : -1) * (0.2 + _h(seed + j) * 0.2) * h;
    ctx.beginPath(); ctx.moveTo(x + h * 0.03, by); ctx.lineTo(x + d, by - h * 0.18); ctx.stroke();
  }
}

/* 배경 층. z: far(먼 산 뒤) · back(가까운 산 뒤) · ground(땅 위) · top(맨 위) */
const LOOK_LAYERS = {
  farTrees: { z: 'back', fn: (R, ctx, pal, cam) => {
    const col = shade(pal.ridge, -0.18), gy = R.groundY;
    repL(R, cam, 0.4, 70, (x, k) => {
      const hh = 26 + _h(k) * 22;
      ctx.fillStyle = col;
      ctx.fillRect(x - 2, gy - hh * 0.5, 4, hh * 0.5);
      ctx.beginPath(); ctx.arc(x, gy - hh * 0.62, hh * 0.32, 0, 7); ctx.arc(x - hh * 0.2, gy - hh * 0.5, hh * 0.24, 0, 7); ctx.arc(x + hh * 0.22, gy - hh * 0.52, hh * 0.24, 0, 7); ctx.fill();
    });
  } },
  flowers: { z: 'ground', fn: (R, ctx, pal, cam) => {
    const cols = ['#f7d34a', '#f28ab2', '#ffffff', '#b98af0'];
    repL(R, cam, R.zoom, 23, (x, k) => {
      if (_h(k) < 0.45) return;
      ctx.fillStyle = cols[k % 4];
      ctx.beginPath(); ctx.arc(x, R.groundY + 12 + _h(k + 5) * (R.h - R.groundY - 20), 1.8, 0, 7); ctx.fill();
    });
  } },
  windmill: { z: 'back', fn: (R, ctx, pal, cam) => {
    const col = shade(pal.ridge, -0.25), gy = R.groundY;
    repL(R, cam, 0.25, 900, (x, k) => {
      const X = x + 300;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(X - 12, gy - 6); ctx.lineTo(X - 7, gy - 70); ctx.lineTo(X + 7, gy - 70); ctx.lineTo(X + 12, gy - 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(X - 10, gy - 68); ctx.lineTo(X, gy - 82); ctx.lineTo(X + 10, gy - 68); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      for (let j = 0; j < 4; j++) {
        const a = j * Math.PI / 2 + 0.4;
        ctx.beginPath(); ctx.moveTo(X, gy - 72); ctx.lineTo(X + Math.cos(a) * 40, gy - 72 + Math.sin(a) * 40); ctx.stroke();
        ctx.fillRect(X + Math.cos(a) * 14 - 3, gy - 72 + Math.sin(a) * 14 - 3, 6, 6);
      }
    });
  } },
  wheat: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    ctx.fillStyle = '#d8b25c'; ctx.fillRect(0, gy - 16, R.w, 20);
    ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 1.2;
    repL(R, cam, 0.6, 5, (x, k) => {
      const hh = 12 + _h(k) * 8;
      ctx.beginPath(); ctx.moveTo(x, gy + 2); ctx.lineTo(x + 1.5, gy - hh); ctx.stroke();
      if (k % 3 === 0) { ctx.fillStyle = '#f0d488'; ctx.fillRect(x, gy - hh - 3, 2.4, 4); }
    });
  } },
  river: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, g = ctx.createLinearGradient(0, gy - 26, 0, gy);
    g.addColorStop(0, '#5f93b8'); g.addColorStop(1, '#8cbad2');
    ctx.fillStyle = g; ctx.fillRect(0, gy - 24, R.w, 26);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    repL(R, cam, 0.34, 37, (x, k) => ctx.fillRect(x, gy - 20 + _h(k) * 18, 10 + _h(k + 2) * 18, 1.4));
    ctx.fillStyle = shade(pal.ground, -0.15); ctx.fillRect(0, gy - 5, R.w, 6);
  } },
  riverDark: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, g = ctx.createLinearGradient(0, gy - 26, 0, gy);
    g.addColorStop(0, '#16303a'); g.addColorStop(1, '#2a4a52');
    ctx.fillStyle = g; ctx.fillRect(0, gy - 24, R.w, 26);
    ctx.fillStyle = 'rgba(200,240,240,.35)';
    repL(R, cam, 0.34, 41, (x, k) => ctx.fillRect(x, gy - 20 + _h(k) * 18, 8 + _h(k + 2) * 14, 1.2));
  } },
  bridge: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.ridgeFar, -0.1);
    repL(R, cam, 0.34, 1100, (x) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, gy - 44, 170, 10);
      for (let j = 0; j < 3; j++) {
        ctx.fillRect(x + 8 + j * 58, gy - 34, 12, 30);
        ctx.beginPath(); ctx.arc(x + 43 + j * 58, gy - 34, 23, Math.PI, 0); ctx.lineTo(x + 66 + j * 58, gy - 34); ctx.fill();
      }
      ctx.fillStyle = pal.sky1;                                  // 무너진 틈
      ctx.beginPath(); ctx.moveTo(x + 100, gy - 46); ctx.lineTo(x + 118, gy - 30); ctx.lineTo(x + 130, gy - 46); ctx.closePath(); ctx.fill();
    });
  } },
  pines: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.32, 34, (x, k) => pineShape(ctx, x, gy - 2, 34 + _h(k) * 26, shade(pal.ridge, -0.1)));
    repL(R, cam, 0.5, 52, (x, k) => pineShape(ctx, x + 20, gy + 2, 46 + _h(k + 50) * 30, shade(pal.ridge, -0.3)));
  } },
  pinesDark: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.3, 30, (x, k) => pineShape(ctx, x, gy - 2, 40 + _h(k) * 30, shade(pal.ridge, 0.05)));
    repL(R, cam, 0.5, 46, (x, k) => pineShape(ctx, x + 14, gy + 2, 56 + _h(k + 30) * 34, shade(pal.ridge, -0.35)));
  } },
  snowPines: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.34, 44, (x, k) => pineShape(ctx, x, gy - 2, 36 + _h(k) * 24, '#46606f', true));
    repL(R, cam, 0.52, 70, (x, k) => pineShape(ctx, x + 20, gy + 2, 50 + _h(k + 9) * 26, '#324a58', true));
  } },
  tombs: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.ridge, -0.1);
    repL(R, cam, 0.45, 38, (x, k) => {
      const hh = 12 + _h(k) * 10;
      ctx.fillStyle = col;
      if (k % 3 === 0) { ctx.fillRect(x - 2, gy - hh - 6, 4, hh + 6); ctx.fillRect(x - 7, gy - hh + 1, 14, 4); }
      else { ctx.beginPath(); ctx.moveTo(x - 6, gy); ctx.lineTo(x - 6, gy - hh); ctx.arc(x, gy - hh, 6, Math.PI, 0); ctx.lineTo(x + 6, gy); ctx.fill(); }
    });
  } },
  deadTrees: { z: 'back', fn: (R, ctx, pal, cam) => {
    repL(R, cam, 0.38, 210, (x, k) => bareTree(ctx, x + _h(k) * 60, R.groundY, 50 + _h(k + 3) * 30, shade(pal.ridge, -0.3), k));
  } },
  caveWall: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.3, 120, (x, k) => {
      ctx.fillStyle = shade(pal.ridgeFar, -0.2);
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 14, gy * (0.2 + _h(k) * 0.3)); ctx.lineTo(x + 40, gy * (0.25 + _h(k + 1) * 0.3)); ctx.lineTo(x + 56, gy); ctx.fill();
    });
  } },
  crystals: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.42, 160, (x, k) => {
      const c = k % 2 ? '#7fe3ff' : '#c68aff', X = x + _h(k) * 80;
      ctx.fillStyle = c; ctx.globalAlpha = 0.18;
      ctx.beginPath(); ctx.arc(X, gy - 12, 26, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      for (let j = 0; j < 3; j++) {
        const hx = X + (j - 1) * 7, hh = 14 + j * 5 + _h(k + j) * 8;
        ctx.fillStyle = j === 1 ? c : shade(c, -0.25);
        ctx.beginPath(); ctx.moveTo(hx - 4, gy); ctx.lineTo(hx - 3, gy - hh); ctx.lineTo(hx + 1, gy - hh - 6); ctx.lineTo(hx + 4, gy - hh); ctx.lineTo(hx + 4, gy); ctx.fill();
      }
    });
  } },
  caveCeiling: { z: 'top', fn: (R, ctx, pal, cam) => {
    const top = R.groundY * 0.16;
    ctx.fillStyle = '#0e0d12';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R.w, 0); ctx.lineTo(R.w, top);
    repL(R, cam, 0.5, 26, () => {});
    const o = cam * 0.5;
    for (let x = R.w + 26; x >= -26; x -= 13) {
      const k = Math.floor((x + o) / 13), dip = _h(k) > 0.7 ? 24 + _h(k + 1) * 34 : 4 + _h(k + 2) * 10;
      ctx.lineTo(x, top + dip);
    }
    ctx.lineTo(0, top); ctx.closePath(); ctx.fill();
  } },
  watchtowers: { z: 'back', fn: (R, ctx, pal, cam) => {
    ctx.fillStyle = pal.prop; ctx.globalAlpha = 0.45;
    repL(R, cam, 0.4, 130, (x, i) => {
      const y = R.groundY - 10, h = 22 + (Math.abs(i) * 17 % 30);
      if (i % 5 === 0) { ctx.fillRect(x, y - h - 10, 16, h + 10); for (let j = 0; j < 3; j++) ctx.fillRect(x + j * 6, y - h - 15, 4, 6); }
      else { ctx.fillRect(x - 2, y - h, 4, h); ctx.beginPath(); ctx.moveTo(x, y - h - 20); ctx.lineTo(x - 17, y - 6); ctx.lineTo(x + 17, y - 6); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
  } },
  tents: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.42, 150, (x, k) => {
      const X = x + _h(k) * 40, hh = 26 + _h(k + 1) * 12;
      ctx.fillStyle = k % 2 ? '#7a4a34' : '#8a6a44';
      ctx.beginPath(); ctx.moveTo(X - hh * 0.9, gy); ctx.lineTo(X, gy - hh); ctx.lineTo(X + hh * 0.9, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.moveTo(X - 5, gy); ctx.lineTo(X, gy - hh * 0.5); ctx.lineTo(X + 5, gy); ctx.fill();
      ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, gy - hh); ctx.lineTo(X, gy - hh - 12); ctx.stroke();
      ctx.fillStyle = '#b8342a'; ctx.beginPath(); ctx.moveTo(X, gy - hh - 12); ctx.lineTo(X + 10, gy - hh - 9); ctx.lineTo(X, gy - hh - 6); ctx.fill();
      if (k % 3 === 0) { ctx.fillStyle = 'rgba(120,110,110,.2)'; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(X + 30 + j * 4, gy - 20 - j * 16, 6 + j * 3, 0, 7); ctx.fill(); } }
    });
  } },
  arches: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.2, 700, (x) => {
      ctx.fillStyle = shade(pal.ridgeFar, -0.08);
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 6, gy - 90); ctx.quadraticCurveTo(x + 70, gy - 130, x + 134, gy - 90); ctx.lineTo(x + 140, gy);
      ctx.lineTo(x + 112, gy); ctx.lineTo(x + 110, gy - 70); ctx.quadraticCurveTo(x + 70, gy - 100, x + 30, gy - 70); ctx.lineTo(x + 28, gy); ctx.closePath(); ctx.fill();
    });
  } },
  walls: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.ridgeFar, -0.15);
    ctx.fillStyle = col;
    repL(R, cam, 0.3, 520, (x, k) => {
      ctx.fillRect(x, gy - 40, 400, 40);
      for (let j = 0; j < 400; j += 16) ctx.fillRect(x + j, gy - 48, 10, 8);
      for (const tx of [0, 190, 380]) {
        ctx.fillRect(x + tx - 8, gy - 72, 36, 72);
        for (let j = 0; j < 36; j += 12) ctx.fillRect(x + tx - 8 + j, gy - 80, 8, 8);
        ctx.fillStyle = k % 2 ? '#3f6bb5' : '#8e2f3a';
        ctx.beginPath(); ctx.moveTo(x + tx + 10, gy - 96); ctx.lineTo(x + tx + 26, gy - 91); ctx.lineTo(x + tx + 10, gy - 86); ctx.fill();
        ctx.fillStyle = col; ctx.fillRect(x + tx + 9, gy - 96, 2, 16);
      }
    });
  } },
  /* ---------------- 3.3 바다 ---------------- */
  sea: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0, top = gy - 46;
    const g = ctx.createLinearGradient(0, top, 0, gy);
    g.addColorStop(0, shade(pal.ridgeFar, -0.05)); g.addColorStop(1, shade(pal.ridge, 0.15));
    ctx.fillStyle = g; ctx.fillRect(0, top, R.w, gy - top + 2);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    repL(R, cam, 0.3, 53, (x, k) => ctx.fillRect(x + Math.sin(t * 0.8 + k) * 6, top + 6 + _h(k) * 34, 12 + _h(k + 2) * 20, 1.4));
    ctx.fillStyle = 'rgba(255,255,255,.55)';                    // 밀려오는 물거품
    repL(R, cam, 0.45, 90, (x, k) => { const w = Math.sin(t * 1.2 + k * 0.7) * 8; ctx.beginPath(); ctx.ellipse(x + w, gy - 3, 26, 3, 0, 0, 7); ctx.fill(); });
  } },
  shipwrecks: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.16, 760, (x, k) => {
      ctx.fillStyle = shade(pal.ridgeFar, -0.25);
      const X = x + 200 + _h(k) * 200;
      ctx.beginPath(); ctx.moveTo(X - 90, gy - 40); ctx.quadraticCurveTo(X, gy - 6, X + 80, gy - 52); ctx.lineTo(X + 70, gy - 30); ctx.lineTo(X - 80, gy - 24); ctx.fill();
      ctx.fillRect(X - 6, gy - 150, 5, 120); ctx.save(); ctx.translate(X + 30, gy - 40); ctx.rotate(0.5); ctx.fillRect(-2, -100, 4, 100); ctx.restore();
      ctx.fillStyle = 'rgba(230,220,200,.35)'; ctx.beginPath(); ctx.moveTo(X - 4, gy - 146); ctx.lineTo(X + 40, gy - 120); ctx.lineTo(X - 2, gy - 96); ctx.fill();
    });
  } },
  coralReef: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.42, 120, (x, k) => {
      const c = ['#e06a5a', '#f0a050', '#c86ab0', '#5ac8b0'][k & 3];
      ctx.fillStyle = shade(c, -0.15);
      for (let j = 0; j < 4; j++) { const hh = 14 + _h(k * 5 + j) * 24; ctx.beginPath(); ctx.ellipse(x + j * 12, gy - hh * 0.5, 4, hh * 0.5, (j - 1.5) * 0.25, 0, 7); ctx.fill(); }
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 20, gy - 8, 10, Math.PI, 0); ctx.fill();
    });
  } },
  lighthouseTower: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0;
    repL(R, cam, 0.1, 1500, (x) => {
      const X = x + 600;
      ctx.fillStyle = shade(pal.ridgeFar, -0.2);
      ctx.beginPath(); ctx.moveTo(X - 90, gy); ctx.lineTo(X - 30, gy - 40); ctx.lineTo(X + 40, gy - 40); ctx.lineTo(X + 100, gy); ctx.fill();
      ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.moveTo(X - 14, gy - 40); ctx.lineTo(X - 8, gy - 190); ctx.lineTo(X + 8, gy - 190); ctx.lineTo(X + 14, gy - 40); ctx.fill();
      ctx.fillStyle = '#b84a3a'; for (let j = 0; j < 3; j++) ctx.fillRect(X - 12 + j, gy - 80 - j * 40, 24 - j * 2, 14);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(X - 12, gy - 206, 24, 16);
      const a = t * 0.9;
      const g = ctx.createLinearGradient(X, gy - 198, X + Math.cos(a) * 320, gy - 198);
      g.addColorStop(0, 'rgba(255,240,180,.55)'); g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X, gy - 198);
      ctx.lineTo(X + Math.cos(a) * 320, gy - 198 - 30); ctx.lineTo(X + Math.cos(a) * 320, gy - 198 + 30); ctx.fill();
      ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(X, gy - 198, 6, 0, 7); ctx.fill();
    });
  } },
  stormClouds: { z: 'far', fn: (R, ctx, pal, cam) => {
    const t = R.clock || 0, gy = R.groundY;
    ctx.fillStyle = 'rgba(40,48,60,.55)';
    repL(R, cam, 0.05, 300, (x, k) => { for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.ellipse(x + j * 60, gy * 0.18 + _h(k + j) * 30, 70, 26, 0, 0, 7); ctx.fill(); } });
    const f = (t * 0.37) % 4;
    if (f < 0.12) { ctx.fillStyle = 'rgba(220,235,255,' + (0.25 * (1 - f / 0.12)) + ')'; ctx.fillRect(0, 0, R.w, gy); }
  } },
  kelp: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0;
    ctx.strokeStyle = shade(pal.ridge, 0.25); ctx.lineWidth = 4;
    repL(R, cam, 0.4, 70, (x, k) => {
      const hh = 50 + _h(k) * 70;
      ctx.beginPath(); ctx.moveTo(x, gy);
      ctx.quadraticCurveTo(x + Math.sin(t + k) * 14, gy - hh * 0.5, x + Math.sin(t * 0.8 + k) * 10, gy - hh); ctx.stroke();
    });
  } },
  abyssVents: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0;
    repL(R, cam, 0.35, 380, (x, k) => {
      ctx.fillStyle = '#0a141a'; ctx.beginPath(); ctx.moveTo(x - 30, gy); ctx.lineTo(x - 8, gy - 46); ctx.lineTo(x + 8, gy - 46); ctx.lineTo(x + 30, gy); ctx.fill();
      const g = ctx.createRadialGradient(x, gy - 46, 2, x, gy - 46, 40);
      g.addColorStop(0, 'rgba(110,255,210,.7)'); g.addColorStop(1, 'rgba(110,255,210,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, gy - 46, 40, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(160,255,230,.5)';
      for (let j = 0; j < 4; j++) { const u = ((t * 0.5 + j * 0.25 + _h(k)) % 1); ctx.beginPath(); ctx.arc(x + Math.sin(t * 2 + j) * 6, gy - 50 - u * 120, 2 + j % 2, 0, 7); ctx.fill(); }
    });
  } },
  ruins: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.ridge, 0.1);
    repL(R, cam, 0.38, 260, (x, k) => {
      ctx.fillStyle = col;
      const n = 3 + (k % 2);
      for (let j = 0; j < n; j++) {
        const hh = 30 + _h(k * 7 + j) * 40;
        ctx.fillRect(x + j * 34, gy - hh, 12, hh);
        ctx.fillRect(x + j * 34 - 3, gy - hh - 4, 18, 5);
      }
      if (k % 2 === 0) { ctx.beginPath(); ctx.arc(x + 51, gy - 58, 17, Math.PI, 0); ctx.lineTo(x + 68, gy - 50); ctx.lineTo(x + 34, gy - 50); ctx.fill(); }
    });
  } },
  swampWater: { z: 'ground', fn: (R, ctx, pal, cam) => {
    repL(R, cam, R.zoom, 170, (x, k) => {
      const y = R.groundY + 20 + _h(k) * (R.h - R.groundY - 40), rw = 30 + _h(k + 1) * 40;
      ctx.fillStyle = 'rgba(40,60,40,.55)'; ctx.beginPath(); ctx.ellipse(x, y, rw, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(140,180,120,.25)'; ctx.fillRect(x - rw * 0.4, y - 1, rw * 0.5, 1.2);
    });
  } },
  volcano: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.08, 1400, (x) => {
      const X = x + 500;
      ctx.fillStyle = '#2a1414';
      ctx.beginPath(); ctx.moveTo(X - 260, gy); ctx.lineTo(X - 44, gy - 190); ctx.lineTo(X + 44, gy - 190); ctx.lineTo(X + 260, gy); ctx.fill();
      const g = ctx.createRadialGradient(X, gy - 190, 4, X, gy - 190, 90);
      g.addColorStop(0, 'rgba(255,170,60,.9)'); g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, gy - 190, 90, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 3;
      for (const d of [-1, 0.4, 1]) { ctx.beginPath(); ctx.moveTo(X + d * 20, gy - 188); ctx.quadraticCurveTo(X + d * 60, gy - 120, X + d * 110, gy - 40); ctx.stroke(); }
      ctx.fillStyle = 'rgba(60,40,40,.35)';
      for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(X - 10 + j * 14, gy - 214 - j * 22, 18 + j * 6, 0, 7); ctx.fill(); }
    });
  } },
  lavaCracks: { z: 'ground', fn: (R, ctx, pal, cam) => {
    ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 2;
    repL(R, cam, R.zoom, 140, (x, k) => {
      const y = R.groundY + 18 + _h(k) * (R.h - R.groundY - 30);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y + 4); ctx.lineTo(x + 26, y - 2); ctx.lineTo(x + 42, y + 3); ctx.stroke();
    });
  } },
  palisade: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    ctx.fillStyle = shade(pal.ridge, 0.1);
    repL(R, cam, 0.34, 11, (x, k) => {
      const hh = 26 + _h(k) * 8;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - hh); ctx.lineTo(x + 4.5, gy - hh - 7); ctx.lineTo(x + 9, gy - hh); ctx.lineTo(x + 9, gy); ctx.fill();
    });
  } },
  warBanners: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.5, 240, (x, k) => {
      ctx.fillStyle = '#1e140e'; ctx.fillRect(x, gy - 96, 3, 96);
      ctx.fillStyle = k % 2 ? '#8e2f3a' : '#6a1f24';
      ctx.beginPath(); ctx.moveTo(x + 3, gy - 94); ctx.lineTo(x + 30, gy - 90); ctx.lineTo(x + 24, gy - 74); ctx.lineTo(x + 30, gy - 58); ctx.lineTo(x + 3, gy - 62); ctx.fill();
      ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(x + 15, gy - 78, 5, 0, 7); ctx.fill();
    });
  } },
  spires: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.16, 90, (x, k) => {
      const hh = 70 + _h(k) * 110;
      ctx.fillStyle = shade(pal.ridgeFar, -0.1);
      ctx.beginPath(); ctx.moveTo(x - 16, gy); ctx.lineTo(x - 4, gy - hh); ctx.lineTo(x + 2, gy - hh - 14); ctx.lineTo(x + 18, gy); ctx.fill();
    });
  } },
  soulFires: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.42, 110, (x, k) => {
      const y = gy - 10 - _h(k) * 30;
      ctx.fillStyle = 'rgba(120,200,255,.18)'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#9fe0ff'; ctx.beginPath(); ctx.ellipse(x, y, 3.5, 6, 0, 0, 7); ctx.fill();
    });
  } },
  thornVines: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    ctx.strokeStyle = '#1e1414'; ctx.lineWidth = 3;
    repL(R, cam, 0.46, 90, (x, k) => {
      ctx.beginPath(); ctx.moveTo(x, gy);
      ctx.bezierCurveTo(x + 20, gy - 40, x - 10, gy - 60, x + 16, gy - 80 - _h(k) * 20); ctx.stroke();
      for (let j = 1; j < 5; j++) { const yy = gy - j * 16; ctx.beginPath(); ctx.moveTo(x + 6, yy); ctx.lineTo(x + 13, yy - 5); ctx.stroke(); }
    });
  } },
  pyramids: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.1, 900, (x) => {
      for (const [dx, sz] of [[0, 150], [210, 96]]) {
        ctx.fillStyle = shade(pal.ridgeFar, -0.05);
        ctx.beginPath(); ctx.moveTo(x + dx - sz, gy); ctx.lineTo(x + dx, gy - sz * 0.9); ctx.lineTo(x + dx + sz, gy); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.15)';
        ctx.beginPath(); ctx.moveTo(x + dx, gy - sz * 0.9); ctx.lineTo(x + dx + sz, gy); ctx.lineTo(x + dx + sz * 0.2, gy); ctx.fill();
      }
    });
  } },
  obelisks: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.3, 260, (x, k) => {
      const hh = 70 + _h(k) * 40;
      ctx.fillStyle = shade(pal.ridge, 0.1);
      ctx.beginPath(); ctx.moveTo(x - 9, gy); ctx.lineTo(x - 6, gy - hh); ctx.lineTo(x, gy - hh - 10); ctx.lineTo(x + 6, gy - hh); ctx.lineTo(x + 9, gy); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,110,.45)'; ctx.beginPath(); ctx.arc(x, gy - hh - 4, 7, 0, 7); ctx.fill();
    });
  } },
  floating: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.1, 480, (x, k) => {
      const y = gy * (0.3 + _h(k) * 0.25), rw = 40 + _h(k + 1) * 40;
      ctx.fillStyle = '#2e2a58';
      ctx.beginPath(); ctx.moveTo(x - rw, y); ctx.lineTo(x + rw, y); ctx.lineTo(x + rw * 0.3, y + rw * 0.8); ctx.lineTo(x - rw * 0.2, y + rw * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a6a5a'; ctx.fillRect(x - rw, y - 3, rw * 2, 4);
      ctx.fillStyle = 'rgba(150,200,255,.35)'; ctx.fillRect(x + rw * 0.5, y, 3, gy - y);
      ctx.fillStyle = '#9fe6ff'; ctx.beginPath(); ctx.moveTo(x - 6, y - 3); ctx.lineTo(x, y - 20); ctx.lineTo(x + 6, y - 3); ctx.fill();
    });
  } },
  /* 4.0 천공: 폭포가 흘러내리는 떠 있는 섬 */
  skyIslands: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, rock = shade(pal.ridgeFar, -0.35);
    repL(R, cam, 0.08, 420, (x, k) => {
      const y = gy * (0.22 + _h(k) * 0.3), rw = 34 + _h(k + 1) * 46;
      ctx.fillStyle = 'rgba(235,245,255,.55)'; ctx.fillRect(x + rw * 0.35, y + 4, 4, rw * 1.4);
      ctx.fillStyle = rock;
      ctx.beginPath(); ctx.moveTo(x - rw, y); ctx.lineTo(x + rw, y); ctx.lineTo(x + rw * 0.4, y + rw * 0.55); ctx.lineTo(x, y + rw * 0.95); ctx.lineTo(x - rw * 0.5, y + rw * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.ground; ctx.fillRect(x - rw, y - 4, rw * 2, 5);
      ctx.fillStyle = pal.prop; ctx.beginPath(); ctx.arc(x - rw * 0.4, y - 9, 8, 0, 7); ctx.arc(x - rw * 0.25, y - 12, 7, 0, 7); ctx.fill();
      if (k % 3 === 0) { ctx.fillStyle = shade(pal.ridgeFar, -0.15); ctx.fillRect(x + rw * 0.1, y - 26, 10, 22); ctx.beginPath(); ctx.moveTo(x + rw * 0.1 - 3, y - 26); ctx.lineTo(x + rw * 0.1 + 5, y - 36); ctx.lineTo(x + rw * 0.1 + 13, y - 26); ctx.fill(); }
    });
  } },
  /* 땅 뒤로 깔린 구름 바다 */
  cloudSea: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0;
    ctx.fillStyle = pal.cloud || 'rgba(255,255,255,.8)';
    repL(R, cam, 0.35, 90, (x, k) => {
      const r = 22 + _h(k) * 20, b = Math.sin(t * 0.5 + k) * 2;
      ctx.beginPath(); ctx.arc(x, gy - 4 + b, r, Math.PI, 0); ctx.arc(x + r * 0.9, gy - 2 + b, r * 0.7, Math.PI, 0); ctx.fill();
    });
    ctx.fillRect(0, gy - 4, R.w, 6);
  } },
  /* 번개를 받는 첨탑 */
  skySpires: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0, col = shade(pal.ridge, -0.25);
    repL(R, cam, 0.15, 360, (x, k) => {
      const hh = gy * (0.45 + _h(k) * 0.25), w = 14 + _h(k + 2) * 10;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x - w, gy); ctx.lineTo(x - w * 0.55, gy - hh); ctx.lineTo(x, gy - hh - 26); ctx.lineTo(x + w * 0.55, gy - hh); ctx.lineTo(x + w, gy); ctx.closePath(); ctx.fill();
      const g = 0.35 + 0.35 * Math.max(0, Math.sin(t * 3 + k * 1.7));
      ctx.fillStyle = 'rgba(150,200,255,' + g + ')'; ctx.beginPath(); ctx.arc(x, gy - hh - 28, 5, 0, 7); ctx.fill();
      ctx.fillRect(x - 1.5, gy - hh * 0.7, 3, 6);
    });
  } },
  wreckage: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.ridge, -0.1);
    repL(R, cam, 0.45, 330, (x, k) => {
      ctx.strokeStyle = col; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 30, gy - 30); ctx.lineTo(x + 60, gy); ctx.moveTo(x + 30, gy - 30); ctx.lineTo(x + 70, gy - 60); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 16, gy - 6, 8, 0, 7); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(x + 120, gy - 60, 3, 60);
      ctx.fillStyle = k % 2 ? '#8e2f3a' : '#3f6bb5';
      ctx.beginPath(); ctx.moveTo(x + 123, gy - 58); ctx.lineTo(x + 144, gy - 52); ctx.lineTo(x + 123, gy - 44); ctx.fill();
    });
  } },
  /* 4.6 밀림: 큰 나무 덩치와 늘어진 덩굴 */
  jungleCanopy: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.ridge, -0.18), lite = shade(pal.ridge, 0.05);
    repL(R, cam, 0.2, 170, (x, k) => {
      const hh = gy * (0.38 + _h(k) * 0.22), r = 34 + _h(k + 3) * 22;
      ctx.fillStyle = col; ctx.fillRect(x - 5, gy - hh, 10, hh);
      ctx.beginPath(); ctx.moveTo(x - 5, gy); ctx.lineTo(x - 18, gy); ctx.lineTo(x - 5, gy - 30); ctx.fill();
      ctx.beginPath(); ctx.arc(x, gy - hh, r, 0, 7); ctx.arc(x - r * 0.8, gy - hh + 10, r * 0.7, 0, 7); ctx.arc(x + r * 0.85, gy - hh + 8, r * 0.75, 0, 7); ctx.fill();
      ctx.fillStyle = lite; ctx.beginPath(); ctx.arc(x - r * 0.25, gy - hh - r * 0.35, r * 0.45, 0, 7); ctx.fill();
    });
  } },
  jungleVines: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.prop, 0.12);
    ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.fillStyle = col;
    repL(R, cam, 0.4, 70, (x, k) => {
      const L = gy * (0.25 + _h(k) * 0.35);
      ctx.beginPath(); ctx.moveTo(x, -4); ctx.quadraticCurveTo(x + 14 * (_h(k + 1) - 0.5), L * 0.5, x + 4, L); ctx.stroke();
      for (let j = 1; j < 5; j++) { const yy = L * j / 5; ctx.beginPath(); ctx.ellipse(x + 5, yy, 5, 2.4, 0.5, 0, 7); ctx.fill(); }
    });
    ctx.fillRect(0, 0, R.w, 6);
  } },
  jungleRoots: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    ctx.fillStyle = pal.prop;
    repL(R, cam, 0.5, 46, (x, k) => {
      const r = 12 + _h(k) * 16;
      ctx.beginPath(); ctx.arc(x, gy, r, Math.PI, 0); ctx.arc(x + r, gy + 2, r * 0.7, Math.PI, 0); ctx.fill();
      if (k % 3 === 0) { ctx.beginPath(); ctx.moveTo(x - 6, gy); ctx.quadraticCurveTo(x - 20, gy - r - 20, x - 2, gy - r - 34); ctx.quadraticCurveTo(x - 8, gy - r - 14, x + 6, gy); ctx.fill(); }
    });
  } },
  /* 4.11 요정 숲: 꼬인 나무 · 매달린 빛 방울 */
  feyTrees: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, trunk = shade(pal.ridge, -0.25), leaf = shade(pal.ridge, 0.08), glow = pal.orb || '#e8f0ff';
    repL(R, cam, 0.22, 160, (x, k) => {
      const hh = gy * (0.42 + _h(k) * 0.2), bend = (_h(k + 5) - 0.5) * 40;
      ctx.strokeStyle = trunk; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x, gy); ctx.bezierCurveTo(x + bend, gy - hh * 0.4, x - bend, gy - hh * 0.7, x + bend * 0.4, gy - hh); ctx.stroke();
      ctx.fillStyle = leaf; const cx = x + bend * 0.4, cy = gy - hh, r = 26 + _h(k + 2) * 18;
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.4, r * 0.8, 0, 0, 7); ctx.ellipse(cx - r, cy + 8, r * 0.8, r * 0.55, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.fillStyle = glow;
      for (let j = 0; j < 3; j++) { const lx = cx + (j - 1) * r * 0.8, ly = cy + r * 0.5 + 10 + _h(k + j) * 24;
        ctx.beginPath(); ctx.moveTo(lx, cy + r * 0.4); ctx.lineTo(lx, ly); ctx.stroke(); ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(lx, ly, 3, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    });
  } },
  /* 요정 고리: 둥글게 돋은 작은 버섯 · 위에서 내리는 빛줄기 */
  fairyRings: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.5, 260, (x, k) => {
      ctx.fillStyle = 'rgba(255,240,250,.07)'; ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 60, gy); ctx.lineTo(x - 30, gy); ctx.closePath(); ctx.fill();
      for (let j = 0; j < 7; j++) { const a = j / 7 * Math.PI * 2, mx = x + 15 + Math.cos(a) * 26, my = gy - 2 + Math.sin(a) * 4;
        ctx.fillStyle = '#e8dcc8'; ctx.fillRect(mx - 1, my - 5, 2, 5);
        ctx.fillStyle = j % 2 ? '#c84a5a' : '#b06ae8'; ctx.beginPath(); ctx.ellipse(mx, my - 5, 4, 3, 0, Math.PI, 0); ctx.fill(); }
    });
  } },
  /* 큰 버섯 숲 */
  giantShrooms: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, stem = shade(pal.sky1, -0.15), cap = pal.ridge, spot = 'rgba(255,240,225,.55)';
    repL(R, cam, 0.25, 190, (x, k) => {
      const hh = gy * (0.3 + _h(k) * 0.28), w = 34 + _h(k + 3) * 30;
      ctx.fillStyle = stem; ctx.beginPath(); ctx.moveTo(x - 8, gy); ctx.quadraticCurveTo(x - 4, gy - hh * 0.6, x - 6, gy - hh); ctx.lineTo(x + 6, gy - hh); ctx.quadraticCurveTo(x + 4, gy - hh * 0.6, x + 9, gy); ctx.fill();
      ctx.fillStyle = k % 3 ? cap : shade(cap, 0.2); ctx.beginPath(); ctx.ellipse(x, gy - hh, w, w * 0.55, 0, Math.PI, 0); ctx.quadraticCurveTo(x, gy - hh + 8, x - w, gy - hh); ctx.fill();
      ctx.fillStyle = spot; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(x + (j - 1.5) * w * 0.45, gy - hh - w * 0.25 - (j % 2) * 6, 3 + _h(k + j) * 3, 0, 7); ctx.fill(); }
    });
  } },
  /* 달빛 숲 바닥의 빛나는 꽃 */
  glowFlowers: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0;
    repL(R, cam, 0.5, 54, (x, k) => {
      const h = 14 + _h(k) * 22, c = k % 3 === 0 ? '160,230,255' : k % 3 === 1 ? '255,170,230' : '200,255,200';
      ctx.strokeStyle = shade(pal.prop, 0.25); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo(x + 5, gy - h * 0.5, x + 2, gy - h); ctx.stroke();
      const a = 0.55 + 0.35 * Math.sin(t * 1.5 + k);
      ctx.fillStyle = 'rgba(' + c + ',' + (a * 0.3) + ')'; ctx.beginPath(); ctx.arc(x + 2, gy - h, 7, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(' + c + ',' + a + ')'; ctx.beginPath(); ctx.arc(x + 2, gy - h, 2.6, 0, 7); ctx.fill();
    });
  } },
  /* 4.6 신전: 계단식 피라미드 */
  /* 4.15 사막: 겹겹이 물결치는 모래언덕 */
  duneWaves: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    for (const [par, per, hh, sh] of [[0.12, 520, 0.22, -0.02], [0.22, 380, 0.13, 0.06]]) {
      ctx.fillStyle = shade(pal.ridgeFar, sh);
      repL(R, cam, par, per, (x, k) => {
        const h = gy * hh * (0.7 + _h(k) * 0.5), w = per * 0.62;
        ctx.beginPath(); ctx.moveTo(x - w, gy); ctx.quadraticCurveTo(x - w * 0.35, gy - h * 1.1, x, gy - h); ctx.quadraticCurveTo(x + w * 0.2, gy - h * 0.9, x + w, gy); ctx.fill();
        ctx.fillStyle = 'rgba(120,70,30,.12)'; ctx.beginPath(); ctx.moveTo(x, gy - h); ctx.quadraticCurveTo(x + w * 0.2, gy - h * 0.9, x + w, gy); ctx.lineTo(x + w * 0.1, gy); ctx.fill();
        ctx.fillStyle = shade(pal.ridgeFar, sh);
      });
    }
  } },
  /* 반쯤 모래에 묻힌 거상 머리와 부러진 기둥 */
  sandColossi: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.ridge, 0.05), dk = shade(pal.ridge, -0.2);
    repL(R, cam, 0.32, 640, (x, k) => {
      if (k % 2) {                                            // 부러진 기둥 셋
        for (let j = 0; j < 3; j++) { const hh = 40 + _h(k + j) * 60, xx = x + j * 34; ctx.fillStyle = col; ctx.fillRect(xx - 8, gy - hh, 16, hh); ctx.fillStyle = dk; ctx.fillRect(xx - 11, gy - hh - 6, 22, 6); ctx.fillRect(xx + 3, gy - hh, 3, hh); }
        return;
      }
      ctx.fillStyle = col;                                    // 거상 머리 (네메스)
      ctx.beginPath(); ctx.moveTo(x - 46, gy); ctx.lineTo(x - 40, gy - 70); ctx.lineTo(x - 20, gy - 92); ctx.lineTo(x + 20, gy - 92); ctx.lineTo(x + 40, gy - 70); ctx.lineTo(x + 46, gy); ctx.fill();
      ctx.fillStyle = dk; for (let j = 0; j < 4; j++) ctx.fillRect(x - 42 + j * 2, gy - 62 + j * 14, 18, 4);
      ctx.fillStyle = shade(pal.ridge, 0.18); ctx.beginPath(); ctx.ellipse(x + 4, gy - 52, 16, 22, 0, 0, 7); ctx.fill();
      ctx.fillStyle = dk; ctx.fillRect(x - 4, gy - 58, 8, 3); ctx.fillRect(x + 8, gy - 58, 8, 3); ctx.fillRect(x + 2, gy - 38, 10, 2);
      ctx.fillStyle = pal.ground; ctx.beginPath(); ctx.ellipse(x, gy, 70, 14, 0, Math.PI, 0); ctx.fill();          // 쌓인 모래
    });
  } },
  /* 왕가의 계곡: 절벽에 새긴 무덤 문 */
  tombCliffs: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0;
    repL(R, cam, 0.18, 420, (x, k) => {
      const hh = gy * (0.42 + _h(k) * 0.16), w = 150;
      ctx.fillStyle = shade(pal.ridgeFar, -0.08); ctx.fillRect(x - w / 2, gy - hh, w, hh);
      ctx.fillStyle = shade(pal.ridgeFar, 0.08); ctx.fillRect(x - w / 2, gy - hh, w, 8);
      ctx.fillStyle = shade(pal.ridgeFar, -0.32); ctx.fillRect(x - 20, gy - hh * 0.55, 40, hh * 0.55);     // 문
      ctx.fillStyle = shade(pal.ridgeFar, 0.12); ctx.fillRect(x - 26, gy - hh * 0.55 - 8, 52, 8);
      ctx.fillStyle = shade(pal.ridgeFar, -0.22); ctx.fillRect(x - 46, gy - hh * 0.45, 12, hh * 0.45); ctx.fillRect(x + 34, gy - hh * 0.45, 12, hh * 0.45);   // 수호 석상
      ctx.beginPath(); ctx.arc(x - 40, gy - hh * 0.45 - 8, 8, 0, 7); ctx.arc(x + 40, gy - hh * 0.45 - 8, 8, 0, 7); ctx.fill();
      const a = 0.35 + 0.25 * Math.sin(t * 1.6 + k);
      ctx.fillStyle = 'rgba(255,190,90,' + a + ')'; ctx.beginPath(); ctx.arc(x, gy - hh * 0.3, 10, 0, 7); ctx.fill();
    });
  } },
  /* 묘실 천장에서 쏟아지는 모래 폭포 */
  sandFalls: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0;
    repL(R, cam, 0.36, 330, (x, k) => {
      const w = 10 + _h(k) * 14;
      ctx.fillStyle = 'rgba(230,190,120,.5)'; ctx.fillRect(x - w / 2, 0, w, gy);
      ctx.fillStyle = 'rgba(255,230,170,.45)';
      for (let j = 0; j < 6; j++) { const yy = ((t * 160 + j * gy / 6 + k * 37) % gy); ctx.fillRect(x - w / 2 + 2, yy, w - 4, 10); }
      ctx.fillStyle = 'rgba(230,190,120,.55)'; ctx.beginPath(); ctx.ellipse(x, gy, w * 2.6, 9, 0, Math.PI, 0); ctx.fill();
    });
  } },
  /* 오아시스: 야자수 그림자 */
  oasisPalms: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0, col = shade(pal.prop, 0.1), leaf = '#4a7a3a';
    repL(R, cam, 0.42, 150, (x, k) => {
      const hh = 70 + _h(k) * 60, lean = (_h(k + 4) - 0.5) * 40, tx = x + lean, ty = gy - hh, sw = Math.sin(t * 1.2 + k) * 3;
      ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo(x + lean * 0.2, gy - hh * 0.5, tx, ty); ctx.stroke();
      ctx.fillStyle = k % 2 ? leaf : shade(leaf, -0.15);
      for (let j = 0; j < 6; j++) { const a = -Math.PI + j * (Math.PI / 5) + (j > 2 ? 0.3 : -0.3), L = 38;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.6 - 10, tx + Math.cos(a) * L + sw, ty + Math.sin(a) * L * 0.5 + 12);
        ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.3, tx, ty); ctx.fill(); }
      ctx.fillStyle = '#6a4a20'; ctx.beginPath(); ctx.arc(tx - 3, ty + 3, 3, 0, 7); ctx.arc(tx + 3, ty + 4, 3, 0, 7); ctx.fill();
    });
  } },
  /* 반짝이는 오아시스 물웅덩이 */
  oasisPool: { z: 'ground', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, t = R.clock || 0;
    repL(R, cam, R.zoom, 700, (x, k) => {
      const w = 110 + _h(k) * 60, y = gy + 26;
      ctx.fillStyle = 'rgba(60,150,170,.55)'; ctx.beginPath(); ctx.ellipse(x, y, w, 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(160,230,240,.55)'; for (let j = 0; j < 4; j++) { const xx = x - w * 0.6 + j * w * 0.4 + Math.sin(t * 1.4 + j) * 6; ctx.fillRect(xx, y - 2, 16, 1.6); }
    });
  } },
  templePyramids: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    repL(R, cam, 0.1, 980, (x, k) => {
      for (const [dx, sz] of [[0, 1], [330, 0.6]]) {
        const X = x + dx, W0 = 190 * sz, H0 = 170 * sz, n = 6;
        ctx.fillStyle = shade(pal.ridgeFar, -0.08);
        for (let j = 0; j < n; j++) { const w = W0 * (1 - j / (n + 1)), hh = H0 / n; ctx.fillRect(X - w, gy - hh * (j + 1), w * 2, hh + 1); }
        ctx.fillStyle = shade(pal.ridgeFar, -0.22);
        ctx.fillRect(X - 14 * sz, gy - H0, 28 * sz, H0);                         // 가운데 계단
        const tw = W0 / (n + 1) * 1.3;
        ctx.fillStyle = shade(pal.ridgeFar, -0.12); ctx.fillRect(X - tw, gy - H0 - 30 * sz, tw * 2, 30 * sz);   // 꼭대기 사당
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(X - 8 * sz, gy - H0 - 22 * sz, 16 * sz, 22 * sz);
        ctx.fillStyle = 'rgba(255,210,120,.35)'; ctx.beginPath(); ctx.arc(X, gy - H0 - 12 * sz, 14 * sz, 0, 7); ctx.fill();
      }
    });
  } },
  templeSteps: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.ridge, 0.18), dark = shade(pal.ridge, -0.05);
    repL(R, cam, 0.42, 300, (x, k) => {
      for (let j = 0; j < 3; j++) { ctx.fillStyle = j % 2 ? dark : col; ctx.fillRect(x + j * 10, gy - 14 - j * 12, 90 - j * 20, 14); }
      ctx.fillStyle = col; ctx.fillRect(x + 150, gy - 52, 14, 52); ctx.fillRect(x + 146, gy - 58, 22, 7);
      ctx.fillStyle = 'rgba(40,70,40,.55)'; ctx.fillRect(x + 152, gy - 40, 4, 22); ctx.fillRect(x + 20, gy - 38, 30, 3);
      if (k % 2) { ctx.fillStyle = dark; ctx.fillRect(x + 200, gy - 22, 30, 22); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 206, gy - 14, 6, 4); ctx.fillRect(x + 218, gy - 14, 6, 4); }
    });
  } },
  /* 4.6 화산 정글: 땅 위로 흐르는 용암 줄기 (빛이 일렁인다) */
  lavaRiver: { z: 'ground', fn: (R, ctx, pal, cam) => {
    const t = R.clock || 0;
    repL(R, cam, R.zoom, 380, (x, k) => {
      const y = R.groundY + 30 + _h(k) * (R.h - R.groundY - 50), rw = 50 + _h(k + 2) * 50;
      ctx.fillStyle = 'rgba(255,110,40,' + (0.28 + 0.1 * Math.sin(t * 2 + k)) + ')';
      ctx.beginPath(); ctx.ellipse(x, y, rw + 10, 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.ellipse(x, y, rw, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(x - rw * 0.5 + Math.sin(t + k) * 10, y - 1, rw * 0.4, 1.6);
    });
  } },
  /* 4.6 철길: 먼 급수탑 · 전봇대 · 발밑을 가로지르는 선로 */
  waterTower: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.ridgeFar, -0.3);
    repL(R, cam, 0.14, 760, (x) => {
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 22, gy); ctx.lineTo(x - 14, gy - 70); ctx.moveTo(x + 22, gy); ctx.lineTo(x + 14, gy - 70);
      ctx.moveTo(x - 20, gy - 20); ctx.lineTo(x + 18, gy - 50); ctx.moveTo(x + 20, gy - 20); ctx.lineTo(x - 18, gy - 50); ctx.stroke();
      ctx.fillRect(x - 24, gy - 110, 48, 40);
      ctx.beginPath(); ctx.moveTo(x - 28, gy - 110); ctx.lineTo(x, gy - 128); ctx.lineTo(x + 28, gy - 110); ctx.fill();
      ctx.fillRect(x + 22, gy - 96, 16, 4);
    });
  } },
  telegraph: { z: 'back', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY, col = shade(pal.prop, 0.1), P = 200;
    ctx.strokeStyle = col; ctx.fillStyle = col;
    repL(R, cam, 0.44, P, (x) => {
      ctx.fillRect(x - 2, gy - 84, 4, 84); ctx.fillRect(x - 12, gy - 80, 24, 3);
      ctx.lineWidth = 1;
      for (const dy of [-80, -74]) { ctx.beginPath(); ctx.moveTo(x - 10, gy + dy); ctx.quadraticCurveTo(x + P / 2, gy + dy + 14, x + P - 10, gy + dy); ctx.stroke(); }
    });
  } },
  railTrack: { z: 'ground', fn: (R, ctx, pal, cam) => {
    const y = R.groundY + 30 * R.cs + 6, z = R.zoom;
    ctx.fillStyle = '#4a3420';
    repL(R, cam, z, 26 * z, (x) => ctx.fillRect(x, y - 3 * z, 12 * z, 12 * z));     // 침목
    ctx.fillStyle = '#8a8e96'; ctx.fillRect(0, y - 1 * z, R.w, 2.4 * z); ctx.fillRect(0, y + 6 * z, R.w, 2.4 * z);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, y - 1 * z, R.w, 0.8 * z);
  } },
  /* 4.6 무도회장: 아치 창 · 커튼 · 샹들리에 · 체스판 마루 */
  ballroomHall: { z: 'far', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY;
    ctx.fillStyle = '#2a1a34'; ctx.fillRect(0, 0, R.w, gy);
    repL(R, cam, 0.25, 180, (x, k) => {
      const top = gy * 0.22, w = 64, hh = gy * 0.6;
      ctx.fillStyle = '#120a1c'; ctx.fillRect(x - w / 2 - 6, top - 6, w + 12, hh + 12);
      const g = ctx.createLinearGradient(0, top, 0, top + hh);
      g.addColorStop(0, '#3a2a6a'); g.addColorStop(1, '#8a4a8a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, top + hh); ctx.lineTo(x - w / 2, top + w / 2); ctx.arc(x, top + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, top + hh); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,.75)'; ctx.beginPath(); ctx.arc(x + 14, top + 24, 7, 0, 7); ctx.fill();        // 창밖 달
      ctx.fillStyle = '#120a1c'; ctx.fillRect(x - 1.5, top, 3, hh); ctx.fillRect(x - w / 2, top + hh * 0.5, w, 3);
      ctx.fillStyle = '#6a1a3a';                                                                                       // 커튼
      ctx.beginPath(); ctx.moveTo(x + 90 - 22, 0); ctx.quadraticCurveTo(x + 90 - 8, gy * 0.5, x + 90 - 20, gy); ctx.lineTo(x + 90 + 20, gy); ctx.quadraticCurveTo(x + 90 + 8, gy * 0.5, x + 90 + 22, 0); ctx.fill();
      ctx.fillStyle = '#d8a84a'; ctx.fillRect(x + 90 - 22, 0, 44, 8);
    });
    ctx.fillStyle = '#3a2440'; ctx.fillRect(0, gy - 20, R.w, 20);
    ctx.fillStyle = '#d8a84a'; ctx.fillRect(0, gy - 20, R.w, 2);
  } },
  chandeliers: { z: 'top', fn: (R, ctx, pal, cam) => {
    const t = R.clock || 0, gy = R.groundY;
    repL(R, cam, R.zoom * 0.7, 420, (x, k) => {
      const y = gy * 0.18 + Math.sin(t * 0.8 + k) * 2;
      ctx.strokeStyle = '#8a6a2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,140,.12)'; ctx.beginPath(); ctx.arc(x, y + 10, 46, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d8a84a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(x, y + 12, 30, 7, 0, 0, Math.PI); ctx.stroke();
      ctx.fillStyle = '#ffe6a0';
      for (let j = -3; j <= 3; j++) { const cx = x + j * 9, cy = y + 12 + Math.cos(j / 3 * 1.4) * 6; ctx.fillRect(cx - 1, cy - 8, 2, 6); ctx.beginPath(); ctx.ellipse(cx, cy - 10, 1.6, 3 + Math.sin(t * 9 + j) * 0.6, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(200,230,255,.8)'; for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(x + j * 11, y + 16); ctx.lineTo(x + j * 11 - 2, y + 22); ctx.lineTo(x + j * 11, y + 27); ctx.lineTo(x + j * 11 + 2, y + 22); ctx.fill(); }
    });
  } },
  checkerFloor: { z: 'ground', fn: (R, ctx, pal, cam) => {
    const gy = R.groundY + 6, z = R.zoom, s = 34 * z, rows = Math.ceil((R.h - gy) / (s * 0.5));
    ctx.fillStyle = 'rgba(255,230,255,.07)';
    for (let r = 0; r < rows; r++) {
      const y = gy + r * s * 0.5;
      repL(R, cam, z, s * 2, (x) => ctx.fillRect(x + (r % 2) * s, y, s, s * 0.5));
    }
  } }
};

/* 땅 위 소품 (카메라와 같이 움직인다). (ctx, 배율, 모습, 시간) — 원점이 땅 */
const PROP_DRAW = {
  tree: (c, k, p) => { c.fillStyle = shade(p.prop, -0.1); c.fillRect(-3 * k, -30 * k, 6 * k, 30 * k); c.fillStyle = p.prop;
    c.beginPath(); c.arc(0, -40 * k, 16 * k, 0, 7); c.arc(-12 * k, -32 * k, 11 * k, 0, 7); c.arc(12 * k, -33 * k, 11 * k, 0, 7); c.fill(); },
  bush: (c, k, p) => { c.fillStyle = p.prop; c.beginPath(); c.arc(-7 * k, -7 * k, 9 * k, 0, 7); c.arc(5 * k, -9 * k, 10 * k, 0, 7); c.arc(13 * k, -5 * k, 7 * k, 0, 7); c.fill(); },
  flowerbush: (c, k, p) => { PROP_DRAW.bush(c, k, p); c.fillStyle = '#f28ab2'; for (const [x, y] of [[-8, -12], [4, -15], [12, -8]]) { c.beginPath(); c.arc(x * k, y * k, 2.2 * k, 0, 7); c.fill(); } },
  /* 3.3 바다 소품 */
  shell: (c, k) => { c.fillStyle = '#f0dcc8'; c.beginPath(); c.moveTo(-8 * k, 0); c.quadraticCurveTo(0, -14 * k, 8 * k, 0); c.closePath(); c.fill();
    c.strokeStyle = '#c8a890'; c.lineWidth = 1 * k; for (let j = -2; j <= 2; j++) { c.beginPath(); c.moveTo(0, -1 * k); c.lineTo(j * 3 * k, -9 * k); c.stroke(); } },
  plank: (c, k) => { c.fillStyle = '#7a5a34'; c.save(); c.rotate(-0.15); c.fillRect(-22 * k, -5 * k, 44 * k, 6 * k); c.fillStyle = '#5c4326'; c.fillRect(-12 * k, -5 * k, 2 * k, 6 * k); c.fillRect(10 * k, -5 * k, 2 * k, 6 * k); c.restore(); },
  seaweed: (c, k, p, t) => { c.strokeStyle = '#3a7a4a'; c.lineWidth = 2.4 * k; const tt = t || 0;
    for (let j = 0; j < 3; j++) { c.beginPath(); c.moveTo((j - 1) * 5 * k, 0); c.quadraticCurveTo((j - 1) * 5 * k + Math.sin(tt * 1.5 + j) * 6 * k, -14 * k, (j - 1) * 4 * k + Math.sin(tt + j) * 4 * k, -28 * k - j * 4 * k); c.stroke(); } },
  coralbush: (c, k) => { const cols = ['#e06a5a', '#f0a050', '#c86ab0']; for (let j = 0; j < 5; j++) { c.strokeStyle = cols[j % 3]; c.lineWidth = 3 * k;
    c.beginPath(); c.moveTo(0, 0); c.lineTo((j - 2) * 6 * k, -14 * k - (j % 2) * 8 * k); c.lineTo((j - 2) * 8 * k, -22 * k - (j % 2) * 8 * k); c.stroke(); } },
  anchorprop: (c, k, p) => { c.strokeStyle = p.prop; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -30 * k); c.moveTo(-8 * k, -24 * k); c.lineTo(8 * k, -24 * k); c.stroke();
    c.beginPath(); c.arc(0, -8 * k, 10 * k, 0.2, Math.PI - 0.2); c.stroke(); c.beginPath(); c.arc(0, -33 * k, 3 * k, 0, 7); c.stroke(); },
  buoy: (c, k, p, t) => { const b = Math.sin((t || 0) * 2) * 2 * k; c.fillStyle = '#c8402e'; c.beginPath(); c.moveTo(-8 * k, -2 * k + b); c.lineTo(-5 * k, -22 * k + b); c.lineTo(5 * k, -22 * k + b); c.lineTo(8 * k, -2 * k + b); c.fill();
    c.fillStyle = '#f0e8d8'; c.fillRect(-6 * k, -14 * k + b, 12 * k, 4 * k); c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(0, -25 * k + b, 3 * k, 0, 7); c.fill(); },
  cloudpuff: (c, k) => { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(-8 * k, -6 * k, 8 * k, 0, 7); c.arc(3 * k, -10 * k, 10 * k, 0, 7); c.arc(13 * k, -5 * k, 7 * k, 0, 7); c.fill(); },
  windvane: (c, k, p, t) => { c.fillStyle = shade(p.prop, 0.2); c.fillRect(-1.5 * k, -40 * k, 3 * k, 40 * k); c.save(); c.translate(0, -40 * k); c.rotate((t || 0) * 4);
    c.fillStyle = '#e8eef8'; for (let j = 0; j < 4; j++) { c.rotate(Math.PI / 2); c.fillRect(0, -2 * k, 12 * k, 4 * k); } c.restore(); },
  lightrod: (c, k, p, t) => { c.fillStyle = '#2a2e3a'; c.fillRect(-2 * k, -44 * k, 4 * k, 44 * k); c.fillRect(-7 * k, -8 * k, 14 * k, 8 * k);
    c.fillStyle = 'rgba(150,200,255,' + (0.4 + 0.4 * Math.max(0, Math.sin((t || 0) * 5))) + ')'; c.beginPath(); c.arc(0, -46 * k, 4 * k, 0, 7); c.fill(); },
  rock: (c, k, p) => { c.fillStyle = p.prop; c.beginPath(); c.moveTo(-14 * k, 0); c.lineTo(-9 * k, -12 * k); c.lineTo(3 * k, -15 * k); c.lineTo(13 * k, -5 * k); c.lineTo(12 * k, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(-9 * k, -12 * k); c.lineTo(3 * k, -15 * k); c.lineTo(-2 * k, -8 * k); c.fill(); },
  spear: (c, k, p) => { c.strokeStyle = p.prop; c.lineWidth = 3 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(-3 * k, 0); c.lineTo(6 * k, -30 * k); c.stroke();
    c.fillStyle = p.prop; c.beginPath(); c.moveTo(6 * k, -38 * k); c.lineTo(11 * k, -28 * k); c.lineTo(1 * k, -28 * k); c.closePath(); c.fill(); },
  sheaf: (c, k) => { c.strokeStyle = '#c9a050'; c.lineWidth = 2 * k; for (let j = -3; j <= 3; j++) { c.beginPath(); c.moveTo(j * k, 0); c.lineTo(j * 3 * k, -24 * k); c.stroke(); } c.fillStyle = '#8a6a30'; c.fillRect(-5 * k, -12 * k, 10 * k, 3 * k); },
  fence: (c, k, p) => { c.fillStyle = shade(p.prop, 0.1); for (const x of [-16, 0, 16]) c.fillRect(x * k - 2 * k, -18 * k, 4 * k, 18 * k); c.fillRect(-18 * k, -14 * k, 36 * k, 3 * k); c.fillRect(-18 * k, -7 * k, 36 * k, 3 * k); },
  reeds: (c, k) => { c.strokeStyle = '#5a6a3a'; c.lineWidth = 1.6 * k; for (let j = 0; j < 6; j++) { c.beginPath(); c.moveTo(j * 3 * k - 8 * k, 0); c.quadraticCurveTo(j * 3 * k - 6 * k, -12 * k, j * 4 * k - 10 * k, -24 * k - j * k); c.stroke(); }
    c.fillStyle = '#6a4a2a'; c.fillRect(-2 * k, -26 * k, 3 * k, 7 * k); },
  pine: (c, k, p) => pineShape(c, 0, 0, 56 * k, p.prop),
  snowpine: (c, k, p) => pineShape(c, 0, 0, 56 * k, p.prop, true),
  stump: (c, k, p) => { c.fillStyle = shade(p.prop, 0.15); c.fillRect(-7 * k, -10 * k, 14 * k, 10 * k); c.fillStyle = '#c9a878'; c.beginPath(); c.ellipse(0, -10 * k, 7 * k, 2.4 * k, 0, 0, 7); c.fill(); },
  tomb: (c, k, p) => { c.fillStyle = shade(p.prop, 0.35); c.beginPath(); c.moveTo(-8 * k, 0); c.lineTo(-8 * k, -18 * k); c.arc(0, -18 * k, 8 * k, Math.PI, 0); c.lineTo(8 * k, 0); c.fill();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-4 * k, -18 * k, 8 * k, 1.6 * k); c.fillRect(-4 * k, -13 * k, 8 * k, 1.6 * k); },
  cross: (c, k, p) => { c.fillStyle = shade(p.prop, 0.3); c.fillRect(-2 * k, -28 * k, 4 * k, 28 * k); c.fillRect(-9 * k, -21 * k, 18 * k, 4 * k); },
  deadtree: (c, k, p) => bareTree(c, 0, 0, 52 * k, p.prop, 3),
  stalagmite: (c, k, p) => { c.fillStyle = shade(p.prop, 0.25); c.beginPath(); c.moveTo(-9 * k, 0); c.lineTo(-2 * k, -34 * k); c.lineTo(3 * k, -30 * k); c.lineTo(9 * k, 0); c.fill(); },
  crystal: (c, k, p, t) => { const g = 0.25 + Math.sin(t * 2) * 0.1; c.fillStyle = 'rgba(160,220,255,' + g + ')'; c.beginPath(); c.arc(0, -12 * k, 16 * k, 0, 7); c.fill();
    c.fillStyle = '#8fe0ff'; c.beginPath(); c.moveTo(-5 * k, 0); c.lineTo(-3 * k, -22 * k); c.lineTo(0, -28 * k); c.lineTo(4 * k, -22 * k); c.lineTo(5 * k, 0); c.fill();
    c.fillStyle = '#c9a0ff'; c.beginPath(); c.moveTo(4 * k, 0); c.lineTo(8 * k, -14 * k); c.lineTo(12 * k, 0); c.fill(); },
  icecrystal: (c, k) => { c.fillStyle = 'rgba(200,235,255,.9)'; c.beginPath(); c.moveTo(-6 * k, 0); c.lineTo(-2 * k, -20 * k); c.lineTo(1 * k, -26 * k); c.lineTo(5 * k, -18 * k); c.lineTo(7 * k, 0); c.fill(); },
  web: (c, k) => { c.strokeStyle = 'rgba(230,230,240,.5)'; c.lineWidth = 0.8 * k; for (let j = 0; j < 6; j++) { const a = -Math.PI * j / 5; c.beginPath(); c.moveTo(0, -14 * k); c.lineTo(Math.cos(a) * 16 * k, -14 * k + Math.sin(a) * 16 * k); c.stroke(); }
    for (const r of [5, 10, 15]) { c.beginPath(); c.arc(0, -14 * k, r * k, Math.PI, Math.PI * 2); c.stroke(); } },
  arrows: (c, k, p) => { c.strokeStyle = p.prop; c.lineWidth = 1.6 * k; for (const a of [-0.3, 0.1, 0.4]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * 20 * k, -20 * k); c.stroke(); } },
  totem: (c, k) => { c.fillStyle = '#5a3a24'; c.fillRect(-4 * k, -40 * k, 8 * k, 40 * k); c.fillStyle = '#d8d2c2'; c.beginPath(); c.arc(0, -44 * k, 7 * k, 0, 7); c.fill();
    c.fillStyle = '#1c1610'; c.fillRect(-3.5 * k, -46 * k, 2.4 * k, 2.4 * k); c.fillRect(1.2 * k, -46 * k, 2.4 * k, 2.4 * k); c.fillStyle = '#b8342a'; c.fillRect(-7 * k, -30 * k, 14 * k, 3 * k); },
  campfire: (c, k, p, t) => { c.fillStyle = '#4a3020'; c.fillRect(-10 * k, -3 * k, 20 * k, 3 * k); const f = 1 + Math.sin(t * 12) * 0.15;
    c.fillStyle = 'rgba(255,160,60,.25)'; c.beginPath(); c.arc(0, -8 * k, 16 * k, 0, 7); c.fill();
    c.fillStyle = '#ff8a2a'; c.beginPath(); c.ellipse(0, -8 * k, 5 * k, 10 * k * f, 0, 0, 7); c.fill(); c.fillStyle = '#ffe08a'; c.beginPath(); c.ellipse(0, -6 * k, 2.4 * k, 5 * k * f, 0, 0, 7); c.fill(); },
  cactus: (c, k) => { c.fillStyle = '#4f7a3f'; c.fillRect(-3 * k, -30 * k, 6 * k, 30 * k); c.fillRect(-11 * k, -20 * k, 4 * k, 10 * k); c.fillRect(-11 * k, -12 * k, 9 * k, 3 * k); c.fillRect(7 * k, -24 * k, 4 * k, 10 * k); c.fillRect(2 * k, -16 * k, 9 * k, 3 * k); },
  powder: (c, k) => { c.fillStyle = '#6b4b2a'; c.fillRect(-7 * k, -14 * k, 14 * k, 14 * k); c.fillStyle = '#3a2618'; c.fillRect(-7 * k, -10 * k, 14 * k, 2 * k); c.fillRect(-7 * k, -5 * k, 14 * k, 2 * k); },
  banner: (c, k, p) => { c.fillStyle = shade(p.prop, 0.1); c.fillRect(-1.5 * k, -46 * k, 3 * k, 46 * k); c.fillStyle = '#3f6bb5'; c.beginPath(); c.moveTo(1.5 * k, -44 * k); c.lineTo(18 * k, -40 * k); c.lineTo(1.5 * k, -32 * k); c.fill(); },
  orcbanner: (c, k) => { c.fillStyle = '#2a1a10'; c.fillRect(-1.5 * k, -48 * k, 3 * k, 48 * k); c.fillStyle = '#8e2f3a'; c.beginPath(); c.moveTo(1.5 * k, -46 * k); c.lineTo(16 * k, -44 * k); c.lineTo(12 * k, -36 * k); c.lineTo(16 * k, -28 * k); c.lineTo(1.5 * k, -30 * k); c.fill(); },
  barricade: (c, k) => { c.strokeStyle = '#5a4630'; c.lineWidth = 3.4 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14 * k, 0); c.lineTo(8 * k, -22 * k); c.moveTo(14 * k, 0); c.lineTo(-8 * k, -22 * k); c.moveTo(-16 * k, -8 * k); c.lineTo(16 * k, -8 * k); c.stroke(); },
  spikes: (c, k) => { c.fillStyle = '#3a2a1a'; for (const x of [-10, 0, 10]) { c.beginPath(); c.moveTo(x * k - 3 * k, 0); c.lineTo(x * k + 6 * k, -24 * k); c.lineTo(x * k + 3 * k, 0); c.fill(); } },
  bones: (c, k) => { c.fillStyle = '#d8d2c2'; c.fillRect(-10 * k, -3 * k, 16 * k, 2.4 * k); c.beginPath(); c.arc(8 * k, -4 * k, 4.5 * k, 0, 7); c.fill(); c.fillStyle = '#1c1610'; c.fillRect(6.5 * k, -5.5 * k, 1.6 * k, 1.6 * k); },
  bonepile: (c, k) => { PROP_DRAW.bones(c, k); c.fillStyle = '#c8c2b2'; c.fillRect(-6 * k, -7 * k, 12 * k, 2 * k); c.fillRect(-2 * k, -10 * k, 10 * k, 2 * k); },
  column: (c, k, p) => { c.fillStyle = shade(p.prop, 0.35); c.fillRect(-6 * k, -34 * k, 12 * k, 34 * k); c.fillRect(-9 * k, -38 * k, 18 * k, 5 * k); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-1 * k, -34 * k, 2 * k, 34 * k); },
  rubble: (c, k, p) => { c.fillStyle = shade(p.prop, 0.3); c.fillRect(-12 * k, -6 * k, 10 * k, 6 * k); c.fillRect(0, -9 * k, 8 * k, 9 * k); c.fillRect(-4 * k, -12 * k, 6 * k, 4 * k); },
  mushroom: (c, k, p, t) => { c.fillStyle = '#d8d0b8'; c.fillRect(-2 * k, -9 * k, 4 * k, 9 * k); c.fillStyle = '#7fb85a'; c.beginPath(); c.arc(0, -9 * k, 7 * k, Math.PI, 0); c.fill();
    c.fillStyle = 'rgba(160,230,120,' + (0.25 + Math.sin(t * 2) * 0.1) + ')'; c.beginPath(); c.arc(0, -10 * k, 11 * k, 0, 7); c.fill(); },
  snowrock: (c, k, p) => { PROP_DRAW.rock(c, k, p); c.fillStyle = 'rgba(250,252,255,.9)'; c.beginPath(); c.moveTo(-9 * k, -12 * k); c.lineTo(3 * k, -15 * k); c.lineTo(10 * k, -8 * k); c.lineTo(-4 * k, -9 * k); c.fill(); },
  obsidian: (c, k) => { c.fillStyle = '#1a1018'; c.beginPath(); c.moveTo(-8 * k, 0); c.lineTo(-4 * k, -22 * k); c.lineTo(4 * k, -16 * k); c.lineTo(8 * k, 0); c.fill(); c.strokeStyle = '#ff7a2a'; c.lineWidth = 1.2 * k; c.beginPath(); c.moveTo(-4 * k, -22 * k); c.lineTo(0, -8 * k); c.stroke(); },
  lantern: (c, k, p, t) => { c.fillStyle = '#2a2018'; c.fillRect(-1 * k, -30 * k, 2 * k, 30 * k); c.fillRect(-1 * k, -30 * k, 9 * k, 2 * k);
    const f = 0.8 + Math.sin(t * 5) * 0.2; c.fillStyle = 'rgba(255,210,120,' + 0.3 * f + ')'; c.beginPath(); c.arc(8 * k, -24 * k, 10 * k, 0, 7); c.fill(); c.fillStyle = '#ffd88a'; c.fillRect(5.5 * k, -27 * k, 5 * k, 6 * k); },
  soulflame: (c, k, p, t) => { const f = 1 + Math.sin(t * 6) * 0.15; c.fillStyle = 'rgba(120,200,255,.25)'; c.beginPath(); c.arc(0, -12 * k, 14 * k, 0, 7); c.fill();
    c.fillStyle = '#8fd8ff'; c.beginPath(); c.ellipse(0, -10 * k, 4 * k, 9 * k * f, 0, 0, 7); c.fill(); c.fillStyle = '#e8f8ff'; c.beginPath(); c.ellipse(0, -8 * k, 1.8 * k, 4 * k * f, 0, 0, 7); c.fill(); },
  thornbush: (c, k) => { c.strokeStyle = '#2a1a1a'; c.lineWidth = 2 * k; for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo((j - 2) * 6 * k, -10 * k, (j - 2) * 9 * k, -20 * k); c.stroke(); } },
  obelisk: (c, k) => { c.fillStyle = '#a0824a'; c.beginPath(); c.moveTo(-6 * k, 0); c.lineTo(-4 * k, -40 * k); c.lineTo(0, -46 * k); c.lineTo(4 * k, -40 * k); c.lineTo(6 * k, 0); c.fill(); c.fillStyle = 'rgba(0,0,0,.25)'; for (let j = 0; j < 4; j++) c.fillRect(-2 * k, (-34 + j * 8) * k, 4 * k, 2 * k); },
  brazier: (c, k, p, t) => { c.fillStyle = '#3a2a1a'; c.fillRect(-2 * k, -20 * k, 4 * k, 20 * k); c.fillStyle = '#8a6a30'; c.fillRect(-8 * k, -24 * k, 16 * k, 5 * k); const f = 1 + Math.sin(t * 11) * 0.15;
    c.fillStyle = 'rgba(255,170,70,.28)'; c.beginPath(); c.arc(0, -30 * k, 14 * k, 0, 7); c.fill(); c.fillStyle = '#ff9a3a'; c.beginPath(); c.ellipse(0, -30 * k, 5 * k, 8 * k * f, 0, 0, 7); c.fill(); },
  runestone: (c, k, p, t) => { c.fillStyle = '#3a3a5a'; c.beginPath(); c.moveTo(-8 * k, 0); c.lineTo(-7 * k, -26 * k); c.lineTo(6 * k, -30 * k); c.lineTo(8 * k, 0); c.fill();
    c.strokeStyle = 'rgba(140,220,255,' + (0.6 + Math.sin(t * 3) * 0.3) + ')'; c.lineWidth = 1.4 * k; c.beginPath(); c.moveTo(-2 * k, -22 * k); c.lineTo(2 * k, -14 * k); c.lineTo(-2 * k, -8 * k); c.moveTo(0, -18 * k); c.lineTo(4 * k, -18 * k); c.stroke(); },
  /* 4.6 밀림 · 철길 · 무도회 소품 */
  fern: (c, k, p, t) => { c.strokeStyle = shade(p.prop, 0.35); c.lineWidth = 1.6 * k; const sw = Math.sin((t || 0) * 1.2) * 0.06;
    for (let j = -3; j <= 3; j++) { const a = -Math.PI / 2 + j * 0.38 + sw, L = (22 - Math.abs(j) * 2.5) * k;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.7, Math.cos(a + j * 0.12) * L, Math.sin(a) * L * 0.85 + Math.abs(j) * 2 * k); c.stroke();
      for (let m = 1; m < 4; m++) { const fx = Math.cos(a) * L * m / 4, fy = Math.sin(a) * L * 0.8 * m / 4; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + 3 * k, fy - 2 * k); c.moveTo(fx, fy); c.lineTo(fx - 3 * k, fy - 2 * k); c.stroke(); } } },
  palm: (c, k, p, t) => { c.strokeStyle = shade(p.prop, 0.25); c.lineWidth = 4 * k; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(6 * k, -26 * k, 2 * k, -52 * k); c.stroke();
    c.fillStyle = shade(p.prop, 0.4); const sw = Math.sin((t || 0) * 1.1) * 0.08;
    for (let j = 0; j < 6; j++) { const a = -Math.PI + j * Math.PI / 5 + sw; c.save(); c.translate(2 * k, -52 * k); c.rotate(a);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(12 * k, -6 * k, 26 * k, 4 * k); c.quadraticCurveTo(12 * k, 1 * k, 0, 2 * k); c.fill(); c.restore(); }
    c.fillStyle = '#5a3a1a'; c.beginPath(); c.arc(0, -50 * k, 2.6 * k, 0, 7); c.arc(4 * k, -50 * k, 2.6 * k, 0, 7); c.fill(); },
  idolhead: (c, k, p) => { c.fillStyle = '#7a7a62'; c.fillRect(-10 * k, -26 * k, 20 * k, 26 * k); c.fillRect(-12 * k, -30 * k, 24 * k, 5 * k);
    c.fillStyle = '#4a4a3a'; c.fillRect(-7 * k, -20 * k, 5 * k, 3 * k); c.fillRect(2 * k, -20 * k, 5 * k, 3 * k); c.fillRect(-2 * k, -16 * k, 4 * k, 6 * k); c.fillRect(-6 * k, -7 * k, 12 * k, 3 * k);
    c.fillStyle = 'rgba(70,110,50,.7)'; c.beginPath(); c.arc(-9 * k, -28 * k, 5 * k, 0, 7); c.arc(-4 * k, -30 * k, 4 * k, 0, 7); c.fill(); },
  signpost: (c, k) => { c.fillStyle = '#5a3a20'; c.fillRect(-1.5 * k, -34 * k, 3 * k, 34 * k); c.fillStyle = '#e8e0d0';
    c.save(); c.rotate(0.6); c.fillRect(-14 * k, -26 * k, 28 * k, 4 * k); c.restore(); c.save(); c.rotate(-0.6); c.fillRect(-14 * k, -26 * k, 28 * k, 4 * k); c.restore();
    c.fillStyle = '#2a2a2a'; c.fillRect(-1 * k, -28 * k, 2 * k, 2 * k); },
  candelabra: (c, k, p, t) => { c.fillStyle = '#c8962a'; c.fillRect(-1.5 * k, -32 * k, 3 * k, 32 * k); c.fillRect(-6 * k, -2 * k, 12 * k, 2 * k);
    c.strokeStyle = '#c8962a'; c.lineWidth = 2 * k; c.beginPath(); c.arc(0, -32 * k, 9 * k, 0, Math.PI); c.stroke();
    for (const x of [-9, 0, 9]) { const f = 1 + Math.sin((t || 0) * 9 + x) * 0.15; c.fillStyle = '#f0e8d8'; c.fillRect(x * k - 1.2 * k, (x ? -38 : -46) * k, 2.4 * k, 6 * k);
      c.fillStyle = 'rgba(255,210,120,.3)'; c.beginPath(); c.arc(x * k, (x ? -41 : -49) * k, 5 * k, 0, 7); c.fill();
      c.fillStyle = '#ffd36a'; c.beginPath(); c.ellipse(x * k, (x ? -41 : -49) * k, 1.4 * k, 2.6 * k * f, 0, 0, 7); c.fill(); } },
  maskprop: (c, k) => { c.fillStyle = '#3a2a1a'; c.fillRect(-1 * k, -22 * k, 2 * k, 22 * k);
    c.fillStyle = '#f0e8f8'; c.beginPath(); c.ellipse(0, -28 * k, 10 * k, 7 * k, 0, 0, 7); c.fill();
    c.fillStyle = '#1a1020'; c.beginPath(); c.ellipse(-4 * k, -29 * k, 2.6 * k, 1.6 * k, 0.2, 0, 7); c.ellipse(4 * k, -29 * k, 2.6 * k, 1.6 * k, -0.2, 0, 7); c.fill();
    c.fillStyle = '#c06aff'; c.beginPath(); c.moveTo(8 * k, -32 * k); c.quadraticCurveTo(18 * k, -44 * k, 14 * k, -50 * k); c.quadraticCurveTo(12 * k, -40 * k, 6 * k, -34 * k); c.fill(); }
};

/* 날씨: 매 프레임 시간으로만 계산한다 (상태를 들고 다니지 않는다) */
function wx(i, t, speed, W) { return ((_h(i) * W * 1.4 + t * speed) % W + W) % W; }
const WEATHER = {
  /* 4.18: 같은 색의 빗줄기 · 눈송이는 경로 하나에 모아 한 번에 긋는다 (눈보라는 프레임당 150번 → 1번) */
  /* 3.3 바다 날씨 */
  /* 4.0 하늘 바람: 옆으로 흐르는 바람결 */
  wind: (c, W, H, gy, t, cam, q) => { c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.3; c.beginPath(); for (let i = 0; i < 22 * q; i++) {
      const L = 30 + _h(i + 3) * 50, x = ((_h(i) * W * 1.5 - t * (260 + _h(i + 7) * 160) - cam * 0.4) % (W + 120) + W + 120) % (W + 120) - 60, y = _h(i + 11) * H * 0.85;
      c.moveTo(x, y); c.quadraticCurveTo(x + L * 0.5, y - 4, x + L, y); } c.stroke(); },
  rain: (c, W, H, gy, t, cam, q) => { c.strokeStyle = 'rgba(200,215,235,.55)'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 120 * q; i++) {
      const x = ((_h(i) * W * 1.3 - t * 140 - cam * 0.3) % (W + 40) + W + 40) % (W + 40) - 20, y = ((_h(i + 9) * H + t * (520 + _h(i + 4) * 160)) % H);
      c.moveTo(x, y); c.lineTo(x - 4, y + 14); } c.stroke(); },
  bubbles: (c, W, H, gy, t, cam, q) => { c.strokeStyle = 'rgba(200,245,255,.55)'; c.lineWidth = 1.1; c.beginPath(); for (let i = 0; i < 30 * q; i++) {
      const x = (_h(i) * W + Math.sin(t * 1.4 + i) * 10 - cam * 0.2 % W + W) % W, y = gy - ((t * (24 + _h(i + 3) * 30) + _h(i + 9) * gy) % gy);
      const r = 1.5 + _h(i + 1) * 2.5; c.moveTo(x + r, y); c.arc(x, y, r, 0, 7); } c.stroke(); },
  spray: (c, W, H, gy, t, cam, q) => { c.fillStyle = 'rgba(235,248,255,.6)'; for (let i = 0; i < 26 * q; i++) {
      const x = wx(i, t, 40 + _h(i + 2) * 40, W + 40) - 20, y = gy - 20 - ((_h(i + 9) * 80 + t * 30 + Math.sin(t * 2 + i) * 10) % 80);
      c.fillRect(x, y, 2, 1.4); } },
  snow: (c, W, H, gy, t, cam, q) => { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); for (let i = 0; i < 80 * q; i++) {
      const x = (wx(i, t, -8 - _h(i + 3) * 10, W + 40) + Math.sin(t * 1.3 + i) * 8 - cam * 0.2 % (W + 40) + W + 40) % (W + 40) - 20, y = ((_h(i + 9) * H + t * (28 + _h(i + 5) * 30)) % H);
      const r = 1 + _h(i + 1) * 1.8; c.moveTo(x + r, y); c.arc(x, y, r, 0, 7); } c.fill(); },
  blizzard: (c, W, H, gy, t, cam, q) => { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.4; c.beginPath(); for (let i = 0; i < 150 * q; i++) {
      const x = ((_h(i) * W * 1.5 - t * (260 + _h(i + 2) * 160)) % (W + 60) + W + 60) % (W + 60) - 30, y = ((_h(i + 9) * H + t * (90 + _h(i + 4) * 40)) % H);
      c.moveTo(x, y); c.lineTo(x + 9, y - 3); }
    c.stroke();
    c.fillStyle = 'rgba(230,236,242,.12)'; c.fillRect(0, 0, W, H); },
  embers: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 44 * q; i++) {
      const x = (wx(i, t, 6 + _h(i + 2) * 10, W) + Math.sin(t * 2 + i) * 6), y = H - ((_h(i + 9) * H + t * (30 + _h(i + 4) * 40)) % H);
      c.fillStyle = 'rgba(255,' + (120 + (_h(i + 6) * 100 | 0)) + ',40,' + (0.5 + Math.sin(t * 6 + i) * 0.3) + ')'; c.fillRect(x, y, 2, 2); } },
  sparks: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 18 * q; i++) {
      const x = wx(i, t, 4, W) + Math.sin(t * 2 + i) * 5, y = gy - ((_h(i + 9) * gy * 0.8 + t * 26) % (gy * 0.8));
      c.fillStyle = 'rgba(255,180,80,' + (0.4 + Math.sin(t * 7 + i) * 0.3) + ')'; c.fillRect(x, y, 1.8, 1.8); } },
  ash: (c, W, H, gy, t, cam, q) => { c.fillStyle = 'rgba(70,64,64,.5)'; for (let i = 0; i < 50 * q; i++) {
      const x = wx(i, t, -6 - _h(i + 2) * 8, W) + Math.sin(t + i) * 6, y = ((_h(i + 9) * H + t * (14 + _h(i + 4) * 12)) % H);
      c.fillRect(x, y, 2, 2); } },
  dust: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 26 * q; i++) {
      const x = wx(i, t, 40 + _h(i + 2) * 50, W + 200) - 100, y = gy - 40 + _h(i + 9) * (H - gy + 30);
      c.fillStyle = 'rgba(230,200,150,' + (0.08 + _h(i + 3) * 0.08) + ')'; c.beginPath(); c.ellipse(x, y, 20 + _h(i) * 30, 4, 0, 0, 7); c.fill(); } },
  fireflies: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 26 * q; i++) {
      const x = (_h(i) * W + Math.sin(t * 0.6 + i * 3) * 30 - cam * 0.3 % W + W) % W, y = gy - 20 - _h(i + 9) * gy * 0.5 + Math.cos(t * 0.8 + i) * 14;
      const a = Math.max(0, Math.sin(t * 2 + i * 1.7)); if (a < 0.1) continue;
      c.fillStyle = 'rgba(210,255,120,' + 0.25 * a + ')'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill();
      c.fillStyle = 'rgba(240,255,170,' + a + ')'; c.fillRect(x - 1, y - 1, 2, 2); } },
  spores: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 30 * q; i++) {
      const x = wx(i, t, 5, W) + Math.sin(t * 0.8 + i) * 10, y = H - ((_h(i + 9) * H + t * (10 + _h(i + 4) * 10)) % H);
      c.fillStyle = 'rgba(190,230,140,' + (0.35 + Math.sin(t * 3 + i) * 0.2) + ')'; c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); } },
  souls: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 16 * q; i++) {
      const x = wx(i, t, 3, W) + Math.sin(t * 1.1 + i) * 16, y = gy + 20 - ((_h(i + 9) * (gy + 20) + t * (18 + _h(i + 4) * 14)) % (gy + 20));
      c.fillStyle = 'rgba(150,210,255,.12)'; c.beginPath(); c.ellipse(x, y + 8, 4, 12, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(190,230,255,.55)'; c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); } },
  motes: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 40 * q; i++) {
      const x = (_h(i) * W + Math.sin(t * 0.4 + i) * 20) % W, y = (_h(i + 9) * H + Math.cos(t * 0.5 + i) * 14) % H;
      const a = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.4 + i * 2.3));
      c.fillStyle = 'rgba(255,230,160,' + a * 0.8 + ')'; c.fillRect(x - 0.8, y - 3, 1.6, 6); c.fillRect(x - 3, y - 0.8, 6, 1.6); } },
  wisps: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 10 * q; i++) {
      const x = wx(i, t, 10 + _h(i + 2) * 12, W + 200) - 100, y = gy - 30 - _h(i + 9) * gy * 0.4 + Math.sin(t + i) * 10;
      c.fillStyle = 'rgba(210,220,255,.08)'; c.beginPath(); c.ellipse(x, y, 40, 9, 0, 0, 7); c.fill(); } },
  drips: (c, W, H, gy, t, cam, q) => { c.fillStyle = 'rgba(160,200,230,.6)'; for (let i = 0; i < 14 * q; i++) {
      const x = (_h(i) * W - cam * 0.5 % W + W) % W, y = gy * 0.18 + ((t * 120 + _h(i + 9) * 400) % (gy * 1.1));
      c.fillRect(x, y, 1.4, 6); } },
  petals: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 20 * q; i++) {
      const x = wx(i, t, 20 + _h(i + 2) * 20, W + 40) - 20 + Math.sin(t * 2 + i) * 8, y = ((_h(i + 9) * H + t * (20 + _h(i + 4) * 14)) % H);
      c.fillStyle = i % 3 ? 'rgba(255,190,210,.8)' : 'rgba(255,255,255,.8)'; c.save(); c.translate(x, y); c.rotate(t * 2 + i); c.fillRect(-2.5, -1.2, 5, 2.4); c.restore(); } },
  chaff: (c, W, H, gy, t, cam, q) => { c.fillStyle = 'rgba(240,210,130,.7)'; for (let i = 0; i < 26 * q; i++) {
      const x = wx(i, t, 30 + _h(i + 2) * 30, W + 40) - 20, y = gy - 60 + ((_h(i + 9) * 120 + Math.sin(t * 1.5 + i) * 20 + t * 6) % 120);
      c.fillRect(x, y, 3, 1.2); } },
  leaves: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 18 * q; i++) {
      const x = wx(i, t, 16 + _h(i + 2) * 16, W + 40) - 20 + Math.sin(t * 1.8 + i) * 12, y = ((_h(i + 9) * H + t * (24 + _h(i + 4) * 16)) % H);
      c.fillStyle = ['rgba(120,160,70,.85)', 'rgba(200,150,60,.85)', 'rgba(170,90,50,.85)'][i % 3];
      c.save(); c.translate(x, y); c.rotate(t * 2.4 + i); c.beginPath(); c.ellipse(0, 0, 3.4, 1.6, 0, 0, 7); c.fill(); c.restore(); } },
  /* 4.15 사막: 낮게 휩쓸려 가는 모래바람 / 오아시스 아지랑이 */
  sandgust: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 34 * q; i++) {
      const x = wx(i, t, -90 - _h(i + 2) * 80, W + 200) - 100, y = gy - 70 + _h(i + 9) * (H - gy + 60);
      c.fillStyle = 'rgba(235,200,140,' + (0.06 + _h(i + 3) * 0.08) + ')'; c.beginPath(); c.ellipse(x, y, 26 + _h(i) * 40, 3.5, 0, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(210,160,90,.5)'; for (let i = 0; i < 40 * q; i++) { const x = wx(i + 50, t, -160 - _h(i + 5) * 120, W + 40) - 20, y = gy - 90 + _h(i + 19) * (H - gy + 80); c.fillRect(x, y, 3, 1); } },
  heathaze: (c, W, H, gy, t, cam, q) => { c.strokeStyle = 'rgba(255,250,235,.12)'; c.lineWidth = 2; for (let i = 0; i < 10 * q; i++) {
      const y = gy - 20 - _h(i + 9) * 70, x0 = _h(i) * W; c.beginPath();
      for (let j = 0; j <= 8; j++) { const xx = x0 + j * 16, yy = y + Math.sin(t * 3 + j + i) * 2.5; if (j) c.lineTo(xx, yy); else c.moveTo(xx, yy); } c.stroke(); } },
  /* 4.6 철길: 기관차 증기가 낮게 흘러간다 */
  steam: (c, W, H, gy, t, cam, q) => { for (let i = 0; i < 14 * q; i++) {
      const x = wx(i, t, -60 - _h(i + 2) * 40, W + 240) - 120, y = gy - 30 - _h(i + 9) * gy * 0.45 + Math.sin(t + i) * 6;
      c.fillStyle = 'rgba(250,240,230,' + (0.08 + _h(i + 3) * 0.08) + ')'; c.beginPath(); c.arc(x, y, 18 + _h(i) * 26, 0, 7); c.arc(x + 20, y + 4, 14 + _h(i + 1) * 16, 0, 7); c.fill(); } },
  /* 4.6 무도회: 빙글빙글 떨어지는 색종이 */
  confetti: (c, W, H, gy, t, cam, q) => { const cols = ['#ff6ab0', '#ffd36a', '#6ad8ff', '#c06aff', '#7aff9a'];
    for (let i = 0; i < 40 * q; i++) {
      const x = (_h(i) * W + Math.sin(t * 1.6 + i) * 16 - cam * 0.25 % W + W) % W, y = ((_h(i + 9) * H + t * (34 + _h(i + 4) * 30)) % H);
      c.fillStyle = cols[i % 5]; c.save(); c.translate(x, y); c.rotate(t * 3 + i); c.scale(1, Math.cos(t * 5 + i)); c.fillRect(-3, -1.6, 6, 3.2); c.restore(); } }
};
function lookOf(stage) { return FIELD_LOOKS[(stage && stage.look) || 'meadow'] || FIELD_LOOKS.meadow; }
function _h(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
