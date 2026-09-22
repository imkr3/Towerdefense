/* =======================================================================
 *  GLFx - 막대 왕국 전쟁 이펙트용 WebGL 파티클 레이어 (프로토타입)
 *
 *  외부 라이브러리 없음. 이미지 파일 없음. 오프라인 APK 그대로 유지.
 *  - 파티클 하나당 인스턴스 9개 float 만 올리고, 프레임당 그리기 호출 1번
 *  - 빛번짐은 셰이더에서 거리로 계산한다 (텍스처도, shadowBlur 도 없다)
 *  - 파티클 상태는 타입 배열 하나에 담아 매 프레임 새 객체를 만들지 않는다
 *
 *  쓰는 법:
 *    const fx = new GLFx(canvas);
 *    fx.resize(w, h, dpr);
 *    fx.emit('lightning', x, y, { color: [1, .88, .29], scale: 1 });
 *    fx.update(dt); fx.draw();
 * ======================================================================= */

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
out vec2 v_uv;
out vec4 v_color;
void main() {
  float c = cos(a_rot), s = sin(a_rot);
  vec2 off = vec2(a_corner.x * a_size.x, a_corner.y * a_size.y);
  vec2 rot = vec2(off.x * c - off.y * s, off.x * s + off.y * c);
  vec2 px = a_pos + rot;
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
  // 가산 합성이라 최종 기여는 rgb * alpha 다. 감쇠는 alpha 한 곳에만 건다.
  outColor = vec4(rgb, clamp(glow + core, 0.0, 1.0) * v_color.a);
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
    this.max = max || 20000;
    this.count = 0;
    this.data = new Float32Array(this.max * GLFX_STRIDE);
    this.inst = new Float32Array(this.max * GLFX_INST);
    this.w = canvas.width;
    this.h = canvas.height;
    this.dpr = 1;
    this.ok = this._init();
  }

  _init() {
    let gl = this.cv.getContext('webgl2', { alpha: true, antialias: false,
                                            premultipliedAlpha: true });
    this.gl2 = !!gl;
    if (!gl) gl = this.cv.getContext('webgl', { alpha: true, antialias: false,
                                                premultipliedAlpha: true });
    if (!gl) return false;
    this.gl = gl;

    if (!this.gl2) {
      this.angle = gl.getExtension('ANGLE_instanced_arrays');
      if (!this.angle) return false;              // 인스턴싱이 없으면 의미가 없다
    }

    const vsSrc = this.gl2 ? GLFX_VERT : glfxDowngrade(GLFX_VERT);
    const fsSrc = this.gl2 ? GLFX_FRAG : glfxDowngrade(GLFX_FRAG);
    const vs = this._shader(gl.VERTEX_SHADER, vsSrc);
    const fs = this._shader(gl.FRAGMENT_SHADER, fsSrc);
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
      res:    gl.getUniformLocation(prog, 'u_res')
    };

    if (this.gl2) {
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
    }
    this._bindAttribs();

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);          // 가산 합성
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
    this.cv.width = Math.round(w * this.dpr);
    this.cv.height = Math.round(h * this.dpr);
    if (this.ok) this.gl.viewport(0, 0, this.cv.width, this.cv.height);
  }

  clear() { this.count = 0; }

  /* 파티클 하나를 집어넣는다. 자리가 없으면 조용히 버린다. */
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
    d[i + P_A] = a === undefined ? 1 : a;
    d[i + P_GRAV] = grav || 0;
    d[i + P_FADE] = fade || 2;
    this.count++;
  }

  update(dt) {
    const d = this.data;
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
      d[b + P_X] += d[b + P_VX] * dt;
      d[b + P_Y] += d[b + P_VY] * dt;
      d[b + P_ROT] += d[b + P_SPIN] * dt;
      i++;
    }
    this.count = n;
  }

  draw() {
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
      // 끝으로 갈수록 사그라든다. fade 가 작을수록 오래 밝게 버틴다.
      const f = 1 - t;
      o[q + 8] = d[b + P_A] * Math.pow(f, d[b + P_FADE]);
    }

    gl.useProgram(this.prog);
    if (this.gl2) gl.bindVertexArray(this.vao);
    else this._bindAttribs();
    gl.uniform2f(this.loc.res, this.cv.width, this.cv.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, o.subarray(0, this.count * GLFX_INST));
    if (this.gl2) gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    else this.angle.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, this.count);
  }

  /* ------------------------------ 연출 ------------------------------ */
  /* 게임의 castFx 종류를 그대로 흉내낸다. density 로 파티클 양을 조절한다. */
  emit(kind, x, y, opt) {
    opt = opt || {};
    const col = opt.color || [1, 0.88, 0.29];
    const sc = opt.scale || 1;
    const q = opt.density === undefined ? 1 : opt.density;
    const R = (opt.radius || 110) * sc;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const N = n => Math.max(1, Math.round(n * q));

    switch (kind) {
      case 'lightning': {
        // 번개 줄기: 위에서 지면까지 잘게 늘린 파티클로 잇는다
        for (let b = 0; b < 3; b++) {
          const ox = (b - 1) * 26 * sc;
          let px = x + ox, py = y - 420 * sc;
          const segs = N(48);
          for (let i = 0; i < segs; i++) {
            const ny = py + (420 * sc) / segs;
            const nx = px + rnd(-14, 14) * sc;
            const ang = Math.atan2(ny - py, nx - px);
            const lf = rnd(0.4, 0.62);
            // 넓은 광채 + 가는 흰 심지. 심지가 있어야 여러 줄기가 겹쳐도
            // 지그재그가 뭉개지지 않는다. fade 0.7 로 거의 끝까지 밝게 남는다.
            this.add(px, py, 0, 0, lf, 30 * sc, 14 * sc, col, 0.5, 2.2, ang, 0, 0, 0.8);
            this.add(px, py, 0, 0, lf, 11 * sc, 6 * sc, [1, 1, 0.92], 1, 2.6, ang, 0, 0, 0.7);
            px = nx; py = ny;
          }
        }
        for (let i = 0, n = N(120); i < n; i++) {       // 착탄 불꽃
          const a = rnd(0, Math.PI * 2), sp = rnd(60, 620) * sc;
          this.add(x, y, Math.cos(a) * sp, -Math.abs(Math.sin(a)) * sp * 0.8,
                   rnd(0.35, 0.85), rnd(9, 22) * sc, 1, col, 1,
                   rnd(1, 2.4), a, rnd(-6, 6), 900);
        }
        for (let i = 0, n = N(40); i < n; i++) {        // 바닥 섬광
          const a = rnd(0, Math.PI * 2);
          this.add(x + Math.cos(a) * rnd(0, R), y + Math.sin(a) * rnd(0, R) * 0.25,
                   0, 0, rnd(0.35, 0.65), rnd(40, 90) * sc, 10 * sc, col, 0.9, 1, 0, 0, 0, 1.1);
        }
        break;
      }
      case 'firestorm': {
        for (let i = 0, n = N(220); i < n; i++) {
          const px = x + rnd(-R, R);
          // 불길은 바로 기둥으로 읽혀야 한다. 처음부터 높이를 흩어 두고 세게 띄운다.
          this.add(px, y - rnd(0, 150) * sc, rnd(-30, 30), rnd(-300, -130) * sc,
                   rnd(0.45, 1.1), rnd(14, 34) * sc, rnd(2, 6) * sc,
                   i % 4 ? col : [1, 0.95, 0.7], 1, 1, 0, rnd(-3, 3), -30);
        }
        for (let i = 0, n = N(50); i < n; i++) {        // 바닥 불씨
          this.add(x + rnd(-R, R), y + rnd(-4, 4), 0, 0, rnd(0.25, 0.6),
                   rnd(40, 80) * sc, 10 * sc, col, 0.7, 1.6, 0, 0, 0);
        }
        break;
      }
      case 'holy': {
        for (let i = 0, n = N(90); i < n; i++) {        // 뻗는 빛살
          const a = rnd(0, Math.PI * 2), sp = rnd(120, 420) * sc;
          this.add(x, y - 30 * sc, Math.cos(a) * sp, Math.sin(a) * sp,
                   rnd(0.3, 0.6), rnd(6, 16) * sc, 1, col, 1, 3, a, 0, 0);
        }
        for (let i = 0, n = N(60); i < n; i++) {        // 떠오르는 입자
          this.add(x + rnd(-R, R) * 0.7, y + rnd(-10, 10), rnd(-20, 20),
                   rnd(-120, -40) * sc, rnd(0.5, 1.1), rnd(4, 10) * sc, 1,
                   [1, 1, 0.85], 0.9, 1, 0, 0, 0);
        }
        this.add(x, y - 30 * sc, 0, 0, 0.35, 30 * sc, 150 * sc, col, 0.8, 1, 0, 0, 0);
        break;
      }
      case 'iceburst': {
        for (let i = 0, n = N(120); i < n; i++) {
          const a = rnd(0, Math.PI * 2), sp = rnd(80, 340) * sc;
          this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.4 - 60,
                   rnd(0.35, 0.8), rnd(5, 14) * sc, 1,
                   i % 3 ? col : [1, 1, 1], 1, 2.2, a, rnd(-2, 2), 420);
        }
        for (let i = 0, n = N(36); i < n; i++) {        // 서리 고리
          const a = i / n * Math.PI * 2;
          this.add(x + Math.cos(a) * R, y + Math.sin(a) * R * 0.3, 0, 0,
                   rnd(0.3, 0.6), 18 * sc, 2 * sc, [0.8, 0.95, 1], 0.9, 1, a, 0, 0);
        }
        break;
      }
      case 'shockwave': {
        for (let ring = 0; ring < 3; ring++) {
          const n = N(70);
          for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2;
            const sp = (260 + ring * 120) * sc;
            this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.3,
                     0.3 + ring * 0.1, (14 - ring * 3) * sc, 1,
                     ring ? col : [1, 1, 1], 0.9, 2, a, 0, 0);
          }
        }
        break;
      }
      case 'runes': {
        for (let i = 0, n = N(140); i < n; i++) {       // 맴도는 마력
          const a = rnd(0, Math.PI * 2), rr = rnd(R * 0.3, R);
          this.add(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.3,
                   -Math.sin(a) * 140 * sc, Math.cos(a) * 40 * sc - 50,
                   rnd(0.5, 1.2), rnd(4, 11) * sc, 1, col, 1, 1, 0, rnd(-4, 4), -30);
        }
        for (let i = 0, n = N(48); i < n; i++) {
          const a = i / n * Math.PI * 2;
          this.add(x + Math.cos(a) * R * 0.85, y + Math.sin(a) * R * 0.26, 0, 0,
                   rnd(0.4, 0.8), 16 * sc, 3 * sc, col, 0.9, 1, a, 0, 0);
        }
        break;
      }
      case 'pillar': {
        for (let i = 0, n = N(260); i < n; i++) {
          const px = x + rnd(-R * 0.34, R * 0.34);
          this.add(px, y - rnd(0, 380) * sc, rnd(-14, 14), rnd(-330, -130) * sc,
                   rnd(0.3, 0.8), rnd(6, 18) * sc, rnd(1, 4) * sc,
                   i % 5 ? col : [1, 1, 1], 1, 1, 0, 0, 0);
        }
        for (let i = 0, n = N(40); i < n; i++) {
          const a = i / n * Math.PI * 2;
          this.add(x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.2, 0, 0,
                   rnd(0.25, 0.5), 22 * sc, 4 * sc, col, 0.8, 1, a, 0, 0);
        }
        break;
      }
      case 'slash': {
        for (let s = 0; s < 2; s++) {
          const base = s ? -0.75 : 0.75;
          const n = N(60);
          for (let i = 0; i < n; i++) {
            const t = i / n - 0.5;
            this.add(x + Math.cos(base) * t * 150 * sc,
                     y - 30 * sc + Math.sin(base) * t * 150 * sc,
                     0, 0, rnd(0.15, 0.35), rnd(8, 22) * sc, 2 * sc,
                     i % 4 ? col : [1, 1, 1], 1, 2.4, base, 0, 0);
          }
        }
        for (let i = 0, n = N(50); i < n; i++) {
          const a = rnd(-1.3, 1.3), sp = rnd(120, 380) * sc;
          this.add(x, y - 30 * sc, Math.cos(a) * sp, Math.sin(a) * sp,
                   rnd(0.2, 0.45), rnd(4, 10) * sc, 1, col, 1, 2, a, 0, 300);
        }
        break;
      }
    }
  }
}

if (typeof module !== 'undefined') module.exports = { GLFx };
