/* =======================================================================
 *  막대 왕국 전쟁 - 필살 연출용 WebGL 파티클 레이어
 *
 *  외부 라이브러리 없음. 이미지 파일 없음. 오프라인 APK 그대로 유지.
 *  - 파티클 하나당 float 9개만 올리고, 프레임당 그리기 호출 1번 (인스턴싱)
 *  - 빛번짐은 셰이더에서 거리로 계산한다 (shadowBlur 도, 텍스처도 없다)
 *  - 파티클 상태는 Float32Array 하나. 매 프레임 객체를 만들지 않는다
 *  - WebGL2 우선, 안 되면 WebGL1 + ANGLE_instanced_arrays,
 *    그것도 없으면 ok === false 로 두고 Canvas2D 연출이 그대로 돈다
 *
 *  쓰는 법:
 *    const fx = new GLFx(canvas);
 *    fx.resize(w, h, dpr);
 *    fx.emit('lightning', screenX, groundY, { color: [1, .88, .29] });
 *    fx.update(dt, scrollX);   // scrollX: 카메라가 움직인 화면 픽셀
 *    fx.setOffset(shakeX, shakeY);
 *    fx.draw();
 * ======================================================================= */

/* 이 레이어가 그릴 줄 아는 연출 목록. 여기에 없는 연출은 Canvas2D 가 맡는다. */
const GLFX_KINDS = ['lightning', 'firestorm', 'holy', 'iceburst', 'shockwave',
                    'runes', 'pillar', 'slash', 'stormchain', 'acid', 'execute', 'voidrift'];

const GLFX_STRIDE = 17;          // 파티클 한 개가 쓰는 float 수
const GLFX_INST = 9;             // GPU 로 올리는 인스턴스 속성 수

/* 파티클 배열 안에서의 자리 */
const P_X = 0, P_Y = 1, P_VX = 2, P_VY = 3, P_LIFE = 4, P_MAX = 5,
      P_S0 = 6, P_S1 = 7, P_STRETCH = 8, P_ROT = 9, P_SPIN = 10,
      P_R = 11, P_G = 12, P_B = 13, P_A = 14, P_GRAV = 15, P_FADE = 16;

const GLFX_VERT = `#version 300 es
in vec2 a_corner;
in vec2 a_pos;
in vec2 a_size;
in float a_rot;
in vec4 a_color;
uniform vec2 u_res;
uniform vec2 u_offset;
out vec2 v_uv;
out vec4 v_color;
void main() {
  float c = cos(a_rot), s = sin(a_rot);
  vec2 off = vec2(a_corner.x * a_size.x, a_corner.y * a_size.y);
  vec2 rot = vec2(off.x * c - off.y * s, off.x * s + off.y * c);
  vec2 px = a_pos + rot + u_offset;
  vec2 clip = vec2(px.x / u_res.x * 2.0 - 1.0, 1.0 - px.y / u_res.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_corner;
  v_color = a_color;
}`;

/* 가운데가 희게 타오르고 가장자리로 부드럽게 사라진다.
 * shadowBlur 이 하던 일을 픽셀당 거리 계산으로 대신한다. */
const GLFX_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_color;
out vec4 outColor;
void main() {
  float d = length(v_uv);
  if (d > 1.0) discard;
  float fall = 1.0 - d;
  float glow = fall * fall;            // 넓게 퍼지는 빛
  float core = pow(fall, 8.0);         // 가운데 흰 심지
  vec3 rgb = mix(v_color.rgb, vec3(1.0), core * 0.9);
  float a = clamp(glow + core, 0.0, 1.0) * v_color.a;
  // 미리 곱한 색으로 내보낸다. 합성식이 dst = src + dst*(1-src) 라서
  // 여러 개가 겹쳐도 1 을 넘지 않고 부드럽게 포화한다.
  outColor = vec4(rgb * a, a);
}`;

/* WebGL1 로 떨어질 때 쓰는 문법 */
function glfxDowngrade(src) {
  return src
    .replace('#version 300 es\n', '')
    .replace(/\bin vec/g, 'attribute vec').replace(/\bin float/g, 'attribute float')
    .replace(/\bout vec2 v_uv;/, 'varying vec2 v_uv;')
    .replace(/\bout vec4 v_color;/, 'varying vec4 v_color;')
    .replace(/\bin vec2 v_uv;/, 'varying vec2 v_uv;')
    .replace(/\bin vec4 v_color;/, 'varying vec4 v_color;')
    .replace(/\bout vec4 outColor;\n/, '')
    .replace(/\boutColor\b/g, 'gl_FragColor');
}

class GLFx {
  constructor(canvas, max) {
    this.cv = canvas;
    this.max = max || 16000;
    this.count = 0;
    this.data = new Float32Array(this.max * GLFX_STRIDE);
    this.inst = new Float32Array(this.max * GLFX_INST);
    this.w = canvas.width;
    this.h = canvas.height;
    this.dpr = 1;
    this.offX = 0;
    this.offY = 0;
    this.quality = 1;              // 프레임이 밀리면 렌더러가 낮춘다
    // 전체 밝기. 전장이 밝은 낮 배경이라 가산 광채가 묻히기 쉽다.
    // 합성식이 포화형이어서 1 을 넘겨도 흰 덩어리로 터지지는 않는다.
    this.gain = 1.15;
    this.ok = this._init();
  }

  _init() {
    let gl = null;
    const opt = { alpha: true, antialias: false, premultipliedAlpha: true,
                  depth: false, stencil: false, powerPreference: 'high-performance' };
    try { gl = this.cv.getContext('webgl2', opt); } catch (e) { gl = null; }
    this.gl2 = !!gl;
    if (!gl) {
      try { gl = this.cv.getContext('webgl', opt); } catch (e) { gl = null; }
    }
    if (!gl) { this.error = 'WebGL 컨텍스트를 만들 수 없다'; return false; }
    this.gl = gl;

    if (!this.gl2) {
      this.angle = gl.getExtension('ANGLE_instanced_arrays');
      if (!this.angle) { this.error = '인스턴싱을 쓸 수 없다'; return false; }
    }

    const vs = this._shader(gl.VERTEX_SHADER, this.gl2 ? GLFX_VERT : glfxDowngrade(GLFX_VERT));
    const fs = this._shader(gl.FRAGMENT_SHADER, this.gl2 ? GLFX_FRAG : glfxDowngrade(GLFX_FRAG));
    if (!vs || !fs) return false;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.error = gl.getProgramInfoLog(prog);
      return false;
    }
    this.prog = prog;
    gl.useProgram(prog);

    // 정적인 사각형 하나를 모든 파티클이 돌려 쓴다
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
       1, -1,  1,  1,  -1, 1
    ]), gl.STATIC_DRAW);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.inst.byteLength, gl.DYNAMIC_DRAW);

    this.loc = {
      corner: gl.getAttribLocation(prog, 'a_corner'),
      pos:    gl.getAttribLocation(prog, 'a_pos'),
      size:   gl.getAttribLocation(prog, 'a_size'),
      rot:    gl.getAttribLocation(prog, 'a_rot'),
      color:  gl.getAttribLocation(prog, 'a_color'),
      res:    gl.getUniformLocation(prog, 'u_res'),
      offset: gl.getUniformLocation(prog, 'u_offset')
    };

    if (this.gl2) {
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
    }
    this._bindAttribs();

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // 부드럽게 포화하는 가산 합성 (soft additive)
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR,
                         gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  _shader(type, src) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      this.error = gl.getShaderInfoLog(sh);
      return null;
    }
    return sh;
  }

  _bindAttribs() {
    const gl = this.gl, L = this.loc;
    const div = (loc, n) => {
      if (this.gl2) gl.vertexAttribDivisor(loc, n);
      else this.angle.vertexAttribDivisorANGLE(loc, n);
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(L.corner);
    gl.vertexAttribPointer(L.corner, 2, gl.FLOAT, false, 0, 0);
    div(L.corner, 0);

    const B = GLFX_INST * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(L.pos);
    gl.vertexAttribPointer(L.pos, 2, gl.FLOAT, false, B, 0);
    div(L.pos, 1);
    gl.enableVertexAttribArray(L.size);
    gl.vertexAttribPointer(L.size, 2, gl.FLOAT, false, B, 8);
    div(L.size, 1);
    gl.enableVertexAttribArray(L.rot);
    gl.vertexAttribPointer(L.rot, 1, gl.FLOAT, false, B, 16);
    div(L.rot, 1);
    gl.enableVertexAttribArray(L.color);
    gl.vertexAttribPointer(L.color, 4, gl.FLOAT, false, B, 20);
    div(L.color, 1);
  }

  resize(w, h, dpr) {
    this.dpr = dpr || 1;
    this.w = w; this.h = h;
    const cw = Math.round(w * this.dpr), ch = Math.round(h * this.dpr);
    if (this.cv.width !== cw || this.cv.height !== ch) {
      this.cv.width = cw; this.cv.height = ch;
    }
    if (this.ok) this.gl.viewport(0, 0, cw, ch);
  }

  clear() { this.count = 0; }
  setOffset(x, y) { this.offX = x || 0; this.offY = y || 0; }

  /* 파티클 하나. 자리가 없으면 조용히 버린다 (연출이 끊기는 게 렉보다 낫다). */
  add(x, y, vx, vy, life, s0, s1, col, a, stretch, rot, spin, grav, fade) {
    if (this.count >= this.max) return;
    const d = this.data, i = this.count * GLFX_STRIDE;
    d[i + P_X] = x; d[i + P_Y] = y;
    d[i + P_VX] = vx; d[i + P_VY] = vy;
    d[i + P_LIFE] = life; d[i + P_MAX] = life;
    d[i + P_S0] = s0; d[i + P_S1] = s1;
    d[i + P_STRETCH] = stretch === undefined ? 1 : stretch;
    d[i + P_ROT] = rot || 0; d[i + P_SPIN] = spin || 0;
    d[i + P_R] = col[0]; d[i + P_G] = col[1]; d[i + P_B] = col[2];
    d[i + P_A] = (a === undefined ? 1 : a) * this.gain;
    d[i + P_GRAV] = grav || 0;
    d[i + P_FADE] = fade || 2;
    this.count++;
  }

  /* scrollX: 이번 프레임에 카메라가 움직인 화면 픽셀.
   * 파티클은 화면 좌표로 살기 때문에, 카메라가 흐르면 같이 밀어 줘야
   * 터진 자리에 붙어 있는 것처럼 보인다. */
  update(dt, scrollX) {
    const d = this.data;
    const sx = scrollX || 0;
    let n = this.count;
    for (let i = 0; i < n; ) {
      const b = i * GLFX_STRIDE;
      d[b + P_LIFE] -= dt;
      if (d[b + P_LIFE] <= 0) {                  // 죽은 자리에 마지막 것을 채운다
        n--;
        if (i !== n) d.copyWithin(b, n * GLFX_STRIDE, n * GLFX_STRIDE + GLFX_STRIDE);
        continue;
      }
      d[b + P_VY] += d[b + P_GRAV] * dt;
      d[b + P_X] += d[b + P_VX] * dt + sx;
      d[b + P_Y] += d[b + P_VY] * dt;
      d[b + P_ROT] += d[b + P_SPIN] * dt;
      // 움직이는 파티클이 화면 밖으로 나가면 버린다. 제자리에 있는 것(번개 줄기
      // 같은 정적 파티클)은 화면 위에서 시작하므로 건드리지 않는다.
      if (d[b + P_VX] !== 0 || d[b + P_VY] !== 0) {
        const px = d[b + P_X], py = d[b + P_Y];
        if (py < -60 || py > this.h + 80 || px < -240 || px > this.w + 240) {
          n--;
          if (i !== n) d.copyWithin(b, n * GLFX_STRIDE, n * GLFX_STRIDE + GLFX_STRIDE);
          continue;
        }
      }
      i++;
    }
    this.count = n;
  }

  draw() {
    if (!this.ok) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.count) return;

    const d = this.data, o = this.inst, dpr = this.dpr;
    for (let i = 0; i < this.count; i++) {
      const b = i * GLFX_STRIDE, q = i * GLFX_INST;
      const t = 1 - d[b + P_LIFE] / d[b + P_MAX];        // 0 -> 1 진행
      const size = d[b + P_S0] + (d[b + P_S1] - d[b + P_S0]) * t;
      o[q]     = d[b + P_X] * dpr;
      o[q + 1] = d[b + P_Y] * dpr;
      o[q + 2] = size * d[b + P_STRETCH] * dpr;
      o[q + 3] = size * dpr;
      o[q + 4] = d[b + P_ROT];
      o[q + 5] = d[b + P_R];
      o[q + 6] = d[b + P_G];
      o[q + 7] = d[b + P_B];
      o[q + 8] = d[b + P_A] * Math.pow(1 - t, d[b + P_FADE]);
    }

    gl.useProgram(this.prog);
    if (this.gl2) gl.bindVertexArray(this.vao);
    else this._bindAttribs();
    gl.uniform2f(this.loc.res, this.cv.width, this.cv.height);
    gl.uniform2f(this.loc.offset, this.offX * dpr, this.offY * dpr);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, o.subarray(0, this.count * GLFX_INST));
    if (this.gl2) gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    else this.angle.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, this.count);
  }

  /* ------------------------------ 연출 ------------------------------
   * 게임의 castFx 종류 8가지. x, y 는 화면 좌표(y 는 지면).
   * opt: color [r,g,b] 0~1 / scale / radius / density / big */
  /* 이 레이어가 아는 연출인가. 모르는 연출은 호출한 쪽이 캔버스로 그려야
   * 한다. 조용히 아무것도 그리지 않으면 기술이 통째로 사라진다. */
  supports(kind) { return GLFX_KINDS.indexOf(kind) >= 0; }

  emit(kind, x, y, opt) {
    if (!this.ok) return;
    opt = opt || {};
    const col = opt.color || [1, 0.88, 0.29];
    const white = [1, 1, 0.94];
    const sc = opt.scale || 1;
    const big = opt.big ? 1.25 : 1;
    const R = (opt.radius || 110) * sc;
    // 품질 단계와 호출자의 요청을 곱해 파티클 양을 정한다
    // 밝기(gain)는 add() 에서 한 번에 곱한다. 여러 연출이 겹쳐도 전장이 보여야 한다.
    const q = (opt.density === undefined ? 1 : opt.density) * this.quality;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const N = n => Math.max(1, Math.round(n * q));
    const TAU = Math.PI * 2;

    switch (kind) {
      /* 하늘에서 내리꽂는 번개 */
      case 'lightning': {
        for (let b = 0; b < 3; b++) {
          const ox = (b - 1) * 26 * sc;
          const top = y - 420 * sc;
          let px = x + ox, py = top;
          const segs = N(44);
          for (let i = 0; i < segs; i++) {
            const ny = py + (420 * sc) / segs;
            const nx = px + rnd(-13, 13) * sc;
            const ang = Math.atan2(ny - py, nx - px);
            const lf = rnd(0.4, 0.62);
            // 넓은 광채 + 가는 흰 심지. 심지가 있어야 여러 줄기가 겹쳐도
            // 지그재그가 뭉개지지 않는다.
            this.add(px, py, 0, 0, lf, 30 * sc * big, 14 * sc, col, 0.5, 2.2, ang, 0, 0, 0.8);
            this.add(px, py, 0, 0, lf, 11 * sc * big, 6 * sc, white, 1, 2.6, ang, 0, 0, 0.7);
            px = nx; py = ny;
          }
        }
        for (let i = 0, n = N(110); i < n; i++) {       // 착탄 불티
          const a = rnd(0, TAU), sp = rnd(60, 620) * sc;
          this.add(x, y, Math.cos(a) * sp, -Math.abs(Math.sin(a)) * sp * 0.8,
                   rnd(0.35, 0.85), rnd(9, 22) * sc, 1, col, 1,
                   rnd(1, 2.4), a, rnd(-6, 6), 900);
        }
        for (let i = 0, n = N(36); i < n; i++) {        // 바닥 섬광
          const a = rnd(0, TAU);
          this.add(x + Math.cos(a) * rnd(0, R), y + Math.sin(a) * rnd(0, R) * 0.25,
                   0, 0, rnd(0.35, 0.65), rnd(40, 90) * sc, 10 * sc, col, 0.9, 1, 0, 0, 0, 1.1);
        }
        break;
      }

      /* 치솟는 불길 */
      case 'firestorm': {
        for (let i = 0, n = N(200); i < n; i++) {
          const px = x + rnd(-R, R);
          this.add(px, y - rnd(0, 150) * sc, rnd(-30, 30), rnd(-300, -130) * sc,
                   rnd(0.45, 1.1), rnd(14, 34) * sc * big, rnd(2, 6) * sc,
                   i % 4 ? col : white, 1, 1, 0, rnd(-3, 3), 190, 1.5);
        }
        for (let i = 0, n = N(44); i < n; i++) {        // 바닥 불씨
          this.add(x + rnd(-R, R), y + rnd(-4, 4), 0, 0, rnd(0.25, 0.6),
                   rnd(40, 80) * sc, 10 * sc, col, 0.7, 1.6, 0, 0, 0, 1.2);
        }
        for (let i = 0, n = N(30); i < n; i++) {        // 떠오르는 잔불
          this.add(x + rnd(-R, R), y, rnd(-40, 40), rnd(-420, -260) * sc,
                   rnd(0.5, 0.9), rnd(4, 9) * sc, 1, white, 0.85, 1, 0, 0, 260, 2.2);
        }
        break;
      }

      /* 성스러운 빛 */
      case 'holy': {
        const cy = y - 46 * sc;
        for (let i = 0, n = N(16); i < n; i++) {        // 뻗는 빛살 (방사)
          const a = i / n * TAU + rnd(-0.05, 0.05);
          const len = rnd(0.55, 1) * R * 1.5;
          const steps = N(7);
          for (let k = 1; k <= steps; k++) {
            const rr = len * k / steps;
            this.add(x + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0, 0,
                     rnd(0.3, 0.5), (26 - k * 2) * sc * big, 4 * sc,
                     k < 3 ? white : col, 0.85, 3.2, a, 0, 0, 1.1);
          }
        }
        for (let i = 0, n = N(70); i < n; i++) {        // 떠오르는 성체
          this.add(x + rnd(-R, R) * 0.8, y + rnd(-10, 10), rnd(-24, 24),
                   rnd(-170, -60) * sc, rnd(0.55, 1.2), rnd(5, 12) * sc, 1,
                   white, 0.9, 1, 0, 0, 120, 1.8);
        }
        // 가운데 후광
        this.add(x, cy, 0, 0, 0.45, 40 * sc, 170 * sc * big, col, 0.85, 1, 0, 0, 0, 1.4);
        this.add(x, cy, 0, 0, 0.3, 20 * sc, 70 * sc, white, 1, 1, 0, 0, 0, 1.2);
        break;
      }

      /* 얼음 파편 */
      case 'iceburst': {
        for (let i = 0, n = N(24); i < n; i++) {        // 솟는 고드름
          const a = i / n * TAU;
          const rr = R * rnd(0.35, 0.95);
          const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.3;
          const hgt = rnd(26, 62) * sc * big;
          const steps = N(4);
          for (let k = 0; k < steps; k++) {
            const t = k / steps;
            this.add(px, py - hgt * t, 0, 0, rnd(0.45, 0.8),
                     (16 - k * 3) * sc, 3 * sc, k ? col : white, 0.95,
                     1, 0, 0, 0, 1.1);
          }
        }
        for (let i = 0, n = N(90); i < n; i++) {        // 튀는 서리 조각
          const a = rnd(0, TAU), sp = rnd(90, 360) * sc;
          this.add(x, y - 12 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.45 - 90,
                   rnd(0.4, 0.85), rnd(5, 13) * sc, 1,
                   i % 3 ? col : white, 1, 2.2, a, rnd(-3, 3), 480);
        }
        for (let i = 0, n = N(40); i < n; i++) {        // 서리 고리
          const a = i / n * TAU;
          this.add(x + Math.cos(a) * R, y + Math.sin(a) * R * 0.3, 0, 0,
                   rnd(0.35, 0.65), 20 * sc, 3 * sc, [0.82, 0.95, 1], 0.9, 1.8, a, 0, 0, 1.2);
        }
        break;
      }

      /* 대지를 흔드는 충격파 */
      case 'shockwave': {
        for (let ring = 0; ring < 3; ring++) {
          const n = N(64);
          const sp = (300 + ring * 150) * sc;
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU;
            this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.28,
                     0.34 + ring * 0.1, (18 - ring * 4) * sc * big, 2 * sc,
                     ring ? col : white, 0.95, 2.4, a, 0, 0, 1.3);
          }
        }
        for (let i = 0, n = N(70); i < n; i++) {        // 튀어오르는 흙과 돌
          const a = rnd(-Math.PI, 0), sp = rnd(120, 460) * sc;
          this.add(x + rnd(-R * 0.4, R * 0.4), y, Math.cos(a) * sp, Math.sin(a) * sp,
                   rnd(0.35, 0.8), rnd(6, 16) * sc, 2 * sc, col, 0.9, 1.4, 0, rnd(-5, 5), 1100);
        }
        this.add(x, y, 0, 0, 0.3, 30 * sc, 150 * sc * big, white, 0.8, 2.6, 0, 0, 0, 1.5);
        break;
      }

      /* 회전하는 마법진 */
      case 'runes': {
        for (let layer = 0; layer < 2; layer++) {       // 두 겹 고리
          const n = N(56), rr = R * (0.55 + layer * 0.42);
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU;
            const spin = layer ? 1.1 : -1.4;
            this.add(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.28,
                     -Math.sin(a) * rr * spin, Math.cos(a) * rr * 0.28 * spin,
                     rnd(0.55, 0.95), (layer ? 12 : 18) * sc * big, 3 * sc,
                     layer ? col : white, 0.9, 2, a, 0, 0, 1.2);
          }
        }
        for (let i = 0, n = N(16); i < n; i++) {        // 고리 위 룬 문자
          const a = i / n * TAU;
          const px = x + Math.cos(a) * R * 0.85, py = y + Math.sin(a) * R * 0.24;
          for (let k = 0; k < 3; k++) {
            this.add(px, py - k * 9 * sc, 0, rnd(-60, -20) * sc, rnd(0.5, 0.9),
                     11 * sc, 2 * sc, white, 0.95, 1, a, 0, 0, 1.1);
          }
        }
        for (let i = 0, n = N(100); i < n; i++) {       // 솟아오르는 마력
          const a = rnd(0, TAU), rr = rnd(R * 0.2, R);
          this.add(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.28,
                   -Math.sin(a) * 150 * sc, rnd(-190, -70) * sc,
                   rnd(0.6, 1.3), rnd(4, 11) * sc, 1, col, 1, 1, 0, rnd(-4, 4), 150, 1.8);
        }
        break;
      }

      /* 솟구치는 빛기둥 */
      case 'pillar': {
        const hgt = 400 * sc;
        for (let i = 0, n = N(240); i < n; i++) {
          const px = x + rnd(-R * 0.32, R * 0.32);
          this.add(px, y - rnd(0, hgt), rnd(-16, 16), rnd(-360, -150) * sc,
                   rnd(0.35, 0.85), rnd(8, 22) * sc * big, rnd(1, 4) * sc,
                   i % 5 ? col : white, 1, 1, 0, 0, 0, 1.6);
        }
        for (let k = 0, n = N(12); k < n; k++) {        // 기둥 심지
          this.add(x, y - hgt * (k / n), 0, rnd(-120, -40) * sc, rnd(0.3, 0.6),
                   26 * sc * big, 8 * sc, white, 0.9, 1, 0, 0, 0, 1.2);
        }
        for (let i = 0, n = N(44); i < n; i++) {        // 바닥 고리
          const a = i / n * TAU;
          this.add(x + Math.cos(a) * R * 0.62, y + Math.sin(a) * R * 0.2,
                   Math.cos(a) * 60 * sc, Math.sin(a) * 18 * sc,
                   rnd(0.3, 0.55), 24 * sc, 4 * sc, col, 0.85, 1.6, a, 0, 0, 1.2);
        }
        break;
      }

      /* 옮겨붙는 벼락 */
      case 'stormchain': {
        for (let b = 0; b < 4; b++) {
          const dir = b % 2 ? 1 : -1;
          const reach = R * (0.7 + (b >> 1) * 0.5) * dir;
          const segs = N(18);
          let px = x, py = y - 14 * sc;
          for (let i = 1; i <= segs; i++) {
            const nx = x + reach * (i / segs);
            const ny = y - 14 * sc + Math.sin(i * 1.7 + b) * 18 * sc;
            const ang = Math.atan2(ny - py, nx - px);
            this.add(px, py, 0, 0, rnd(0.25, 0.5), 22 * sc * big, 9 * sc, col, 0.6, 2.4, ang, 0, 0, 0.9);
            this.add(px, py, 0, 0, rnd(0.2, 0.42), 9 * sc * big, 4 * sc, white, 1, 2.8, ang, 0, 0, 0.8);
            px = nx; py = ny;
          }
          for (let i = 0, n = N(10); i < n; i++) {     // 갈라지는 끝에서 튀는 불티
            const a = rnd(0, TAU), sp = rnd(80, 320) * sc;
            this.add(px, py, Math.cos(a) * sp, Math.sin(a) * sp * 0.6,
                     rnd(0.2, 0.5), rnd(5, 11) * sc, 1, col, 1, 2, a, 0, 520);
          }
        }
        for (let i = 0, n = N(34); i < n; i++) {       // 바닥으로 퍼지는 전류
          const a = i / n * TAU;
          this.add(x, y, Math.cos(a) * 320 * sc, Math.sin(a) * 90 * sc,
                   rnd(0.3, 0.55), 16 * sc, 3 * sc, i % 3 ? col : white, 0.9, 2.2, a, 0, 0, 1.2);
        }
        break;
      }

      /* 녹아내리는 산성 */
      case 'acid': {
        for (let i = 0, n = N(90); i < n; i++) {       // 튀어 오르는 방울
          const a = rnd(-Math.PI, 0), sp = rnd(70, 330) * sc;
          this.add(x, y - 16 * sc, Math.cos(a) * sp, Math.sin(a) * sp,
                   rnd(0.4, 0.95), rnd(6, 15) * sc * big, rnd(2, 5) * sc,
                   i % 4 ? col : white, 0.95, 1.2, 0, rnd(-4, 4), 620);
        }
        for (let i = 0, n = N(40); i < n; i++) {       // 지면에 고이는 웅덩이
          const a = rnd(0, TAU);
          this.add(x + Math.cos(a) * rnd(0, R), y + Math.sin(a) * rnd(0, R) * 0.28,
                   0, 0, rnd(0.5, 1.1), rnd(26, 58) * sc, 12 * sc, col, 0.55, 1, 0, 0, 0, 1.5);
        }
        for (let i = 0, n = N(24); i < n; i++) {       // 피어오르는 연기
          this.add(x + rnd(-R, R) * 0.7, y, rnd(-20, 20), rnd(-140, -60) * sc,
                   rnd(0.6, 1.2), rnd(8, 18) * sc, 26 * sc, col, 0.35, 1, 0, 0, 90, 1.8);
        }
        break;
      }

      /* 내리꽂는 처형 참격 */
      case 'execute': {
        const segs = N(26);
        for (let i = 0; i < segs; i++) {
          const t = i / segs;
          const px = x - 14 * sc + t * 34 * sc;
          const py = y - 86 * sc + t * 104 * sc;
          const taper = 1 - Math.abs(t - 0.5) * 1.1;
          this.add(px, py, 0, 0, rnd(0.2, 0.42), 30 * sc * big * taper, 6 * sc,
                   white, 0.9, 3, 1.25, 0, 0, 0.9);
          this.add(px, py, 0, 0, rnd(0.25, 0.5), 16 * sc * taper, 4 * sc,
                   col, 0.8, 2.6, 1.25, 0, 0, 1);
        }
        for (let i = 0, n = N(50); i < n; i++) {       // 갈라진 자리에서 튀는 조각
          const a = rnd(-2.6, -0.5), sp = rnd(130, 420) * sc;
          this.add(x, y - 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp,
                   rnd(0.25, 0.55), rnd(5, 12) * sc, 1, i % 3 ? col : white, 1, 2.2, a, 0, 700);
        }
        break;
      }

      /* 심연의 균열 */
      case 'voidrift': {
        for (let c = -1; c <= 1; c++) {                // 솟구치는 기둥
          const cx = x + c * R * 0.45;
          const steps = N(16);
          for (let k = 0; k < steps; k++) {
            const t = k / steps;
            this.add(cx + Math.sin(t * 6 + c) * 10 * sc, y - t * 150 * sc,
                     rnd(-12, 12), rnd(-160, -60) * sc, rnd(0.4, 0.9),
                     (26 - t * 14) * sc * big, 6 * sc, k % 3 ? col : white,
                     0.75, 1.6, 0, rnd(-2, 2), -40, 1.4);
          }
        }
        for (let i = 0, n = N(56); i < n; i++) {       // 안쪽으로 빨려드는 재
          const a = rnd(0, TAU), rr = R * rnd(0.6, 1.2);
          this.add(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.3,
                   -Math.cos(a) * 200 * sc, -Math.sin(a) * 60 * sc,
                   rnd(0.4, 0.8), rnd(6, 14) * sc, 2 * sc, col, 0.9, 2, a, 0, 0, 1.3);
        }
        for (let i = 0, n = N(30); i < n; i++) {       // 갈라진 바닥 고리
          const a = i / n * TAU;
          this.add(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.24, 0, 0,
                   rnd(0.35, 0.7), 24 * sc, 4 * sc, i % 4 ? col : white, 0.8, 2, a, 0, 0, 1.2);
        }
        break;
      }

      /* 교차 참격 */
      case 'slash': {
        const cy = y - 34 * sc;
        for (let s = 0; s < 2; s++) {
          const a = (s ? -0.78 : 0.78);
          const L = 130 * sc * big;
          const n = N(34);
          for (let i = 0; i < n; i++) {
            const t = (i / (n - 1) - 0.5) * 2;          // -1 .. 1
            const px = x + Math.cos(a) * t * L;
            const py = cy + Math.sin(a) * t * L;
            const taper = 1 - Math.abs(t) * 0.75;       // 가운데가 굵다
            this.add(px, py, 0, 0, rnd(0.22, 0.4), 26 * sc * taper, 5 * sc,
                     col, 0.6, 2.6, a, 0, 0, 1);
            this.add(px, py, 0, 0, rnd(0.2, 0.36), 9 * sc * taper, 2 * sc,
                     white, 1, 3, a, 0, 0, 0.9);
          }
        }
        for (let i = 0, n = N(56); i < n; i++) {        // 튀는 불꽃
          const a = rnd(-1.4, 1.4), sp = rnd(150, 430) * sc;
          this.add(x, cy, Math.cos(a) * sp, Math.sin(a) * sp,
                   rnd(0.2, 0.5), rnd(5, 12) * sc, 1, col, 1, 2.2, a, 0, 340);
        }
        break;
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GLFx };
