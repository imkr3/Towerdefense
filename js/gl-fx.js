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

const GLFX_STRIDE = 18;          // 파티클 한 개가 쓰는 float 수
const GLFX_INST = 10;            // GPU 로 올리는 인스턴스 속성 수 (5.2: 모양 하나 더)

/* 파티클 배열 안에서의 자리 */
const P_X = 0, P_Y = 1, P_VX = 2, P_VY = 3, P_LIFE = 4, P_MAX = 5,
      P_S0 = 6, P_S1 = 7, P_STRETCH = 8, P_ROT = 9, P_SPIN = 10,
      P_R = 11, P_G = 12, P_B = 13, P_A = 14, P_GRAV = 15, P_FADE = 16, P_SHAPE = 17;
/* 5.2 고퀄 모드의 파티클 모양 (절전 모드는 모두 0 처럼 그린다).
 * 정수 부분이 모양, 소수 부분은 연기 무늬 씨앗 */
const SH_GLOW = 0, SH_RING = 1, SH_STAR = 2, SH_SMOKE = 3, SH_STREAK = 4, SH_SHARD = 6;

const GLFX_VERT = `#version 300 es
in vec2 a_corner;
in vec2 a_pos;
in vec2 a_size;
in float a_rot;
in vec4 a_color;
in float a_shape;
uniform vec2 u_res;
uniform vec2 u_offset;
out vec2 v_uv;
out vec4 v_color;
out float v_shape;
void main() {
  float c = cos(a_rot), s = sin(a_rot);
  vec2 off = vec2(a_corner.x * a_size.x, a_corner.y * a_size.y);
  vec2 rot = vec2(off.x * c - off.y * s, off.x * s + off.y * c);
  vec2 px = a_pos + rot + u_offset;
  vec2 clip = vec2(px.x / u_res.x * 2.0 - 1.0, 1.0 - px.y / u_res.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_corner;
  v_color = a_color;
  v_shape = a_shape;
}`;

/* 가운데가 희게 타오르고 가장자리로 부드럽게 사라진다.
 * shadowBlur 이 하던 일을 픽셀당 거리 계산으로 대신한다. */
const GLFX_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_color;
in float v_shape;
uniform float u_hq;
out vec4 outColor;
// 연기 무늬: 사인 몇 겹 (해시 노이즈는 휴대폰의 mediump 에서 깨져 네모지게 보인다 — 작은 각도만 쓴다)
float billow(vec2 p, float sd) {
  return 0.5 + 0.22 * sin(p.x * 4.7 + sd * 2.3) * sin(p.y * 3.9 - sd * 1.7)
             + 0.16 * sin((p.x - p.y) * 7.3 + sd * 4.1) + 0.12 * sin((p.x + p.y) * 11.0 - sd * 3.3);
}
void main() {
  float d = length(v_uv);
  if (u_hq < 0.5) {
    // 절전(예전 모습): 가운데가 희게 타오르고 가장자리로 부드럽게 사라진다
    if (d > 1.0) discard;
    float fall = 1.0 - d;
    float glow = fall * fall;            // 넓게 퍼지는 빛
    float core = pow(fall, 8.0);         // 가운데 흰 심지
    vec3 rgb = mix(v_color.rgb, vec3(1.0), core * 0.9);
    float a = clamp(glow + core, 0.0, 1.0) * v_color.a;
    // 미리 곱한 색으로 내보낸다. 합성식이 dst = src + dst*(1-src) 라서
    // 여러 개가 겹쳐도 1 을 넘지 않고 부드럽게 포화한다.
    outColor = vec4(rgb * a, a);
    return;
  }
  // 5.2 고퀄: 모양마다 다르게. 빛은 알파를 덜 내보내 더해지는 느낌으로, 연기 · 파편은 덮어 칠한다
  float sh = floor(v_shape + 0.001), seed = fract(v_shape) * 9.0;
  vec3 col = v_color.rgb, white = vec3(1.0);
  if (sh < 0.5) {                        // 빛: 흰 심지 + 넓고 부드러운 번짐
    if (d > 1.0) discard;
    // 색은 몸통에 살리고 흰빛은 가운데 작은 심지에만 — 예전보다 색이 또렷하고 덜 하얗게 뭉친다
    float halo = max(exp(-d * d * 6.0) - 0.0025, 0.0);
    float body = (1.0 - d) * (1.0 - d);
    float core = pow(1.0 - d, 10.0);
    vec3 rgb = mix(col, white, core * 0.9);
    float a = clamp(halo * 0.22 + body * 0.86 + core, 0.0, 1.0) * v_color.a;
    outColor = vec4(rgb * a, a);
  } else if (sh < 1.5) {                 // 고리: 날 선 띠 + 바깥 번짐
    if (d > 1.0) discard;
    float r = 0.8, w = 0.075;
    float e1 = (d - r) / w, e2 = e1 / 3.5;   // pow 는 음수 밑을 못 받는다 — 제곱은 곱으로
    float band = exp(-e1 * e1);
    float soft = exp(-e2 * e2) * 0.45;
    float a = clamp(band + soft, 0.0, 1.0) * v_color.a * (1.0 - smoothstep(0.93, 1.0, d));
    vec3 rgb = mix(col, white, band * 0.55);
    outColor = vec4(rgb * a, a * 0.8);
  } else if (sh < 2.5) {                 // 별빛: 십자 빛살 + 작은 심지
    vec2 q = abs(v_uv);
    float ray = exp(-q.x * 16.0) * exp(-q.y * 2.2) + exp(-q.y * 16.0) * exp(-q.x * 2.2);
    float diag = exp(-abs(q.x - q.y) * 22.0) * exp(-d * 4.0) * 0.45;
    float core = exp(-d * d * 28.0);
    float a = clamp(ray * 0.9 + diag + core, 0.0, 1.0) * v_color.a * (1.0 - smoothstep(0.8, 1.0, d));
    vec3 rgb = mix(col, white, clamp(core + ray * 0.35, 0.0, 1.0));
    outColor = vec4(rgb * a, a * 0.8);
  } else if (sh < 3.5) {                 // 연기: 뭉게뭉게 (덮어 칠한다)
    float n = billow(v_uv, seed);
    float m = 1.0 - smoothstep(0.35, 1.0, d + (n - 0.5) * 0.6);
    if (m <= 0.0) discard;
    float lit = 1.0 - v_uv.y * 0.25;     // 위쪽이 조금 밝다
    float a = m * v_color.a;
    outColor = vec4(col * lit * a, a);
  } else if (sh < 4.5) {                 // 꼬리 불똥: +x 쪽이 머리, 뒤로 가늘게 꺼진다
    float head = smoothstep(-1.0, 0.75, v_uv.x) * (1.0 - smoothstep(0.75, 1.0, v_uv.x));
    float thin = exp(-v_uv.y * v_uv.y * (9.0 + (1.0 - v_uv.x) * 12.0));
    float hx = v_uv.x - 0.55;
    float core = exp(-(hx * hx * 10.0 + v_uv.y * v_uv.y * 30.0));
    float a = clamp(head * thin + core, 0.0, 1.0) * v_color.a;
    vec3 rgb = mix(col, white, core * 0.85);
    outColor = vec4(rgb * a, a * 0.85);
  } else {                               // 파편: 모난 조각 (덮어 칠한다)
    float m = abs(v_uv.x) + abs(v_uv.y) * 1.35;
    if (m > 1.0) discard;
    float edge = smoothstep(1.0, 0.82, m);
    float facet = step(0.0, v_uv.x * 0.6 + v_uv.y);   // 빛 받는 면 / 그늘진 면
    vec3 rgb = mix(col * 0.62, mix(col, white, 0.45), facet);
    float a = edge * v_color.a;
    outColor = vec4(rgb * a, a);
  }
}`;

/* WebGL1 로 떨어질 때 쓰는 문법 */
function glfxDowngrade(src) {
  return src
    .replace('#version 300 es\n', '')
    .replace(/\bout (vec2|vec4|float) (v_\w+);/g, 'varying $1 $2;')        // 정점 → 조각으로 넘기는 값
    .replace(/\bin (vec2|vec4|float) (v_\w+);/g, 'varying $1 $2;')
    .replace(/\bin vec/g, 'attribute vec').replace(/\bin float/g, 'attribute float')
    .replace(/\bout vec4 outColor;\n/, '')
    .replace(/\boutColor\b/g, 'gl_FragColor');
}

/* 5.2 고퀄 덧칠 계열 (없는 연출은 덧칠하지 않는다) */
const GLFX_HQ_CAT = {};
for (const [cat, kinds] of Object.entries({
  fire: 'firestorm firering shellblast plasmablast missilehit solarburn eastwind rocketpunch burst dronestrike starfall eruption',
  bolt: 'lightning tesla teslacoil boltstrike storm railhit kusanagi',
  light: 'holy pillar excalibur astral runes holoburst laserhit sabercut divestrike slash dragonslash dragonblade inkslash ufoburst gungnir runeveil',
  ice: 'iceburst snowburst',
  water: 'tidal harpoon',
  dust: 'shockwave dust dozerpush drillspark mechstaff staff rocdive goldbat',
  spirit: 'foxfire foxbead foxstorm reaproll skybind overdrive goldburst wishburst threewish yggdrasil djinnblast bagua petrify',
  steam: 'steamburst',
  spark: 'spark bulletpuff'
})) for (const k of kinds.split(' ')) GLFX_HQ_CAT[k] = cat;

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
    this.lights = [];              // 5.2 고퀄: 연출이 땅 · 병사를 비추는 빛 (렌더러가 2D 로 그린다)
    this.floorY = 0;               // 땅 높이(화면 좌표). 렌더러가 매 프레임 넣는다
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
      shape:  gl.getAttribLocation(prog, 'a_shape'),
      hq:     gl.getUniformLocation(prog, 'u_hq'),
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

    for (const loc of [L.pos, L.size, L.rot, L.color, L.shape]) { if (loc < 0) continue; gl.enableVertexAttribArray(loc); div(loc, 1); }
    this._instPtr(0);
  }
  /* 인스턴스 속성이 버퍼의 first 번째 파티클부터 읽게 한다 (5.2: 연기 · 빛을 두 번에 나눠 그린다) */
  _instPtr(first) {
    const gl = this.gl, L = this.loc, B = GLFX_INST * 4, o = first * B;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.vertexAttribPointer(L.pos, 2, gl.FLOAT, false, B, o);
    gl.vertexAttribPointer(L.size, 2, gl.FLOAT, false, B, o + 8);
    gl.vertexAttribPointer(L.rot, 1, gl.FLOAT, false, B, o + 16);
    gl.vertexAttribPointer(L.color, 4, gl.FLOAT, false, B, o + 20);
    if (L.shape >= 0) gl.vertexAttribPointer(L.shape, 1, gl.FLOAT, false, B, o + 36);
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

  clear() { this.count = 0; this._empty = false; this.lights.length = 0; }
  setOffset(x, y) { this.offX = x || 0; this.offY = y || 0; }

  /* 파티클 하나. 자리가 없으면 조용히 버린다 (연출이 끊기는 게 렉보다 낫다). */
  add(x, y, vx, vy, life, s0, s1, col, a, stretch, rot, spin, grav, fade, shape) {
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
    // 5.2 고퀄: 예전 연출의 '길쭉하게 날아가는 빛 알갱이' 는 꼬리 달린 불똥으로 그린다 (rot 이 날아가는 방향이다)
    d[i + P_SHAPE] = shape || (this.hq && stretch >= 1.7 && (vx || vy) ? SH_STREAK : 0);
    this.count++;
  }

  /* scrollX: 이번 프레임에 카메라가 움직인 화면 픽셀.
   * 파티클은 화면 좌표로 살기 때문에, 카메라가 흐르면 같이 밀어 줘야
   * 터진 자리에 붙어 있는 것처럼 보인다. */
  update(dt, scrollX) {
    const d = this.data;
    const sx = scrollX || 0;
    if (this.lights.length) {                     // 5.2 고퀄 조명: 짧게 번쩍이고 사라진다
      for (const L of this.lights) { L.t += dt; L.x += sx; }
      this.lights = this.lights.filter(L => L.t < L.life);
    }
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
        // 땅(floorY) 아래로 떨어지는 파티클도 버린다. 안 그러면 불티가 화면 아래
        // 카드 줄까지 흘러내려 '이펙트가 화면 밑에서 나오는' 것처럼 보인다.
        const sunk = this.floorY && py > this.floorY && d[b + P_VY] > 0;
        if (sunk || py < -60 || py > this.h + 80 || px < -240 || px > this.w + 240) {
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
    // 3.5: 파티클이 없으면 한 번만 비우고 그 뒤로는 손대지 않는다 (빈 화면을 매 프레임 합성하지 않게)
    if (!this.count && this._empty) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this._empty = !this.count;
    if (!this.count) return;

    const d = this.data, o = this.inst, dpr = this.dpr, hq = !!this.hq;
    // 5.2 고퀄: 덮어 칠하는 것(연기 · 파편)을 앞에 모아 먼저 그리고, 빛은 그 위에 더한다
    let w = 0, nOver = 0;
    const put = b => {
      const q = w * GLFX_INST;
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
      const f = d[b + P_FADE];                            // 음수면 (5.2 고퀄 연기) 처음 20% 동안 서서히 짙어진다
      o[q + 8] = d[b + P_A] * (f > 0 ? Math.pow(1 - t, f) : Math.pow(1 - t, -f) * Math.min(1, t * 5));
      o[q + 9] = d[b + P_SHAPE];
      w++;
    };
    if (hq) {
      for (let i = 0; i < this.count; i++) { const b = i * GLFX_STRIDE, sh = d[b + P_SHAPE]; if (sh >= SH_SMOKE && sh < SH_STREAK || sh >= SH_SHARD) put(b); }
      nOver = w;
      for (let i = 0; i < this.count; i++) { const b = i * GLFX_STRIDE, sh = d[b + P_SHAPE]; if (!(sh >= SH_SMOKE && sh < SH_STREAK || sh >= SH_SHARD)) put(b); }
    } else for (let i = 0; i < this.count; i++) put(i * GLFX_STRIDE);

    gl.useProgram(this.prog);
    if (this.gl2) gl.bindVertexArray(this.vao);
    else this._bindAttribs();
    gl.uniform2f(this.loc.res, this.cv.width, this.cv.height);
    gl.uniform2f(this.loc.offset, this.offX * dpr, this.offY * dpr);
    gl.uniform1f(this.loc.hq, hq ? 1 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, o.subarray(0, this.count * GLFX_INST));
    const drawN = (first, n) => {
      if (n <= 0) return;
      this._instPtr(first);
      if (this.gl2) gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
      else this.angle.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, n);
    };
    if (nOver) {                                   // 덮어 칠하기 (미리 곱한 알파)
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      drawN(0, nOver);
    }
    // 부드럽게 포화하는 가산 합성 (soft additive) — 절전은 이것 하나로 전부 그린다
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    drawN(nOver, this.count - nOver);
  }

  /* 연출 하나를 터뜨린다. 5.2: 고퀄이면 맨 바깥 호출에만 계열별 덧칠을 얹는다
   * (연출 안에서 다른 연출을 부르는 것 — 엑스칼리버 = 빛기둥 + 성광 — 은 한 번만 덧칠) */
  emit(kind, x, y, opt) {
    if (!this.ok) return;
    opt = opt || {};
    const top = !this._depth;
    this._depth = (this._depth | 0) + 1;
    this._emit(kind, x, y, opt);
    this._depth--;
    if (top && this.hq) this.hqAugment(kind, x, y, opt);
  }

  /* ------------------------------ 5.2 고퀄 덧칠 ------------------------------
   * 계열(GLFX_HQ_CAT)마다: 섬광 · 땅 위 충격파 고리 + 불길은 연기와 꼬리 불똥, 번개는 별빛과 튀는 전기,
   * 빛은 별가루와 빛기둥, 얼음은 파편과 서리 안개, 물은 물방울, 흙은 먼지구름과 돌 조각, 혼은 떠도는 불빛. */
  hqAugment(kind, x, y, opt) {
    const cat = GLFX_HQ_CAT[kind];
    if (!cat) return;
    const sc = opt.scale || 1, big = opt.big ? 1.2 : 1, R = Math.min(320 * sc, (opt.radius || 110) * sc);
    const q = (opt.density === undefined ? 1 : opt.density) * this.quality;
    const N = n => Math.max(1, Math.round(n * q));
    const rnd = (a, b) => a + Math.random() * (b - a);
    const col = opt.color || [1, 0.88, 0.29], W = [1, 1, 0.96];
    const soft = [col[0] * 0.55 + 0.45, col[1] * 0.55 + 0.45, col[2] * 0.55 + 0.45];
    const cy = y - 34 * sc;
    if (cat === 'spark') {                          // 작은 타격: 별빛 하나 + 꼬리 불똥
      this.add(x, y, 0, 0, 0.14, 22 * sc, 34 * sc, soft, 0.9, 1, Math.random(), 0, 0, 1.2, SH_STAR);
      for (let i = 0, n = N(6); i < n; i++) { const a = rnd(-Math.PI, 0.3), sp = rnd(220, 520) * sc;
        this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.16, 0.3), 9 * sc, 4 * sc, i % 2 ? col : W, 1, 3, a, 0, 700, 1.4, SH_STREAK); }
      return;
    }
    // 1) 섬광: 크게 번졌다가 빨리 꺼진다
    // 여러 연출이 한꺼번에 터지면(필살 셋을 같이 쓰는 등) 섬광을 줄인다 — 겹친 섬광이 화면을 하얗게 덮지 않게
    const dull = cat === 'dust' || cat === 'steam', busy = this.lights.length, fk = busy >= 2 ? 0.4 : busy ? 0.7 : 1;
    this.add(x, cy, 0, 0, 0.24, R * 0.4, R * (dull ? 0.8 : 1) * big, col, (dull ? 0.16 : 0.24) * fk, 1, 0, 0, 0, 1.8, SH_GLOW);
    if (!dull && busy < 2) this.add(x, cy, 0, 0, 0.1, 10 * sc, R * 0.4, W, 0.3 * fk, 1, 0, 0, 0, 1.4, SH_GLOW);
    // 2) 땅 위 충격파 고리 둘 (원근 때문에 옆으로 눌린 타원)
    this.add(x, y, 0, 0, 0.5, R * 0.1, R * 0.42 * big, soft, 0.85, 3.3, 0, 0, 0, 1.3, SH_RING);
    this.add(x, y, 0, 0, 0.75, R * 0.06, R * 0.3 * big, col, 0.5, 3.3, 0, 0, 0, 1.1, SH_RING);
    // 3) 조명: 터진 자리 둘레의 땅 · 병사가 잠깐 그 빛으로 물든다 (렌더러가 2D 로 그린다)
    if (this.lights.length < 10) this.lights.push({ x: x, y: cy, gy: y, r: R * 1.7 * big, col: col, t: 0, life: cat === 'fire' ? 0.7 : 0.45, a: dull ? 0.35 : 0.7 });
    if (cat === 'fire') {
      for (let i = 0, n = N(6 + R / 40); i < n; i++) {            // 불길 위로 피어오르는 잿빛 연기 (서서히 짙어졌다 흩어진다)
        const g = rnd(0.3, 0.42);
        this.add(x + rnd(-R, R) * 0.45, cy - rnd(10, 60) * sc, rnd(-30, 30) * sc, rnd(-80, -35) * sc, rnd(1.2, 2),
                 R * rnd(0.12, 0.18), R * rnd(0.34, 0.5), [g * 1.06, g * 0.97, g * 0.9], 0.5, 1, rnd(0, 6), rnd(-0.5, 0.5), -14, -1.3, SH_SMOKE + Math.random() * 0.9);
      }
      for (let i = 0, n = N(18); i < n; i++) {                     // 꼬리 불똥
        const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), sp = rnd(180, 520) * sc;
        this.add(x + rnd(-R, R) * 0.2, cy, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.5, 1.05), rnd(8, 13) * sc, 3 * sc,
                 i % 3 ? [1, 0.62 + Math.random() * 0.25, 0.25] : W, 1, 3.4, a, 0, 560, 1.5, SH_STREAK);
      }
      this.add(x, y - 6 * sc, 0, 0, 0.6, R * 0.22, R * 0.34, [1, 0.5, 0.18], 0.45, 3, 0, 0, 0, 1.6, SH_GLOW);   // 달아오른 땅
    } else if (cat === 'bolt') {
      for (let k = 0, n = N(5); k < n; k++) {                      // 땅을 기는 갈래 번개
        let px = x, py = y - 4 * sc;
        const dir = k % 2 ? 1 : -1, segs = 6, len = R * rnd(0.5, 1) / segs;
        for (let i = 0; i < segs; i++) {
          const nx = px + dir * len * rnd(0.7, 1.2), ny = py + rnd(-10, 10) * sc;
          const ang = Math.atan2(ny - py, nx - px), lf = rnd(0.12, 0.28);
          this.add((px + nx) / 2, (py + ny) / 2, 0, 0, lf, len * 0.55, 3 * sc, col, 0.9, 1, ang, 0, 0, 1.2, SH_GLOW);
          this.add((px + nx) / 2, (py + ny) / 2, 0, 0, lf, len * 0.5, 1.4 * sc, W, 1, 1, ang, 0, 0, 1.1, SH_GLOW);
          px = nx; py = ny;
        }
      }
      this.add(x, cy, 0, 0, 0.16, R * 0.5, R * 0.9, W, 0.9, 1, Math.random(), 0, 0, 1.3, SH_STAR);   // 큰 별빛 섬광
      for (let i = 0, n = N(6); i < n; i++)                        // 번쩍이는 별빛
        this.add(x + rnd(-R, R) * 0.7, cy + rnd(-60, 20) * sc, 0, 0, rnd(0.14, 0.3), rnd(26, 46) * sc, rnd(10, 18) * sc, i % 2 ? W : soft, 1, 1, rnd(0, 1), 0, 0, 1.2, SH_STAR);
      for (let i = 0, n = N(16); i < n; i++) {                     // 튀는 전기
        const a = rnd(-Math.PI, 0.2), sp = rnd(260, 680) * sc;
        this.add(x, cy + 20 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.18, 0.4), rnd(9, 15) * sc, 3 * sc, i % 2 ? W : col, 1, 3.6, a, 0, 380, 1.4, SH_STREAK);
      }
    } else if (cat === 'light') {
      this.add(x, y - R * 0.5, 0, -40 * sc, 0.4, R * 0.9, R * 1.2, soft, 0.42, 0.22, 0, 0, 0, 1.6, SH_GLOW);   // 솟는 빛기둥
      for (let i = 0, n = N(5); i < n; i++) {                      // 하늘에서 내리꽂히는 가는 빛줄기
        const px = x + rnd(-R, R) * 0.8, h = rnd(140, 260) * sc;
        this.add(px, y - h * 0.5, 0, 0, rnd(0.25, 0.45), h * 0.5, h * 0.55, i % 2 ? soft : W, 0.5, 0.06, 0, 0, 0, 1.5, SH_GLOW);
      }
      this.add(x, cy, 0, 0, 0.2, R * 0.45, R * 0.8, W, 0.8, 1, Math.random(), 0, 0, 1.3, SH_STAR);   // 큰 별빛 섬광
      for (let i = 0, n = N(10); i < n; i++)                       // 떠오르는 별가루
        this.add(x + rnd(-R, R) * 0.6, cy + rnd(-40, 30) * sc, rnd(-20, 20) * sc, rnd(-110, -35) * sc, rnd(0.5, 1), rnd(12, 24) * sc, rnd(4, 8) * sc, i % 3 ? soft : W, 1, 1, rnd(0, 1), rnd(-2, 2), 0, 1.3, SH_STAR);
      for (let i = 0, n = N(14); i < n; i++)
        this.add(x + rnd(-R, R) * 0.7, y + rnd(-6, 6) * sc, rnd(-14, 14) * sc, rnd(-160, -60) * sc, rnd(0.6, 1.2), rnd(4, 8) * sc, 2 * sc, col, 0.9, 1, 0, 0, 40, 1.6, SH_GLOW);
    } else if (cat === 'ice') {
      for (let i = 0, n = N(14); i < n; i++) {                     // 튀는 얼음 파편
        const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), sp = rnd(160, 420) * sc;
        this.add(x, cy + 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.5, 0.95), rnd(7, 13) * sc, rnd(4, 7) * sc, i % 3 ? [0.72, 0.9, 1] : W, 0.95, 1.7, rnd(0, 6), rnd(-9, 9), 760, 1.2, SH_SHARD);
      }
      for (let i = 0, n = N(5); i < n; i++)                        // 서리 안개
        this.add(x + rnd(-R, R) * 0.5, y - rnd(0, 26) * sc, rnd(-40, 40) * sc, rnd(-20, -5) * sc, rnd(1, 1.6), R * 0.14, R * 0.4, [0.86, 0.94, 1], 0.32, 1.4, rnd(0, 6), rnd(-0.3, 0.3), 0, -1.2, SH_SMOKE + Math.random() * 0.9);
    } else if (cat === 'water') {
      for (let i = 0, n = N(18); i < n; i++) {                     // 튀는 물방울
        const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), sp = rnd(200, 460) * sc;
        this.add(x + rnd(-R, R) * 0.3, y - 6 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.45, 0.85), rnd(5, 9) * sc, 3 * sc, i % 3 ? [0.55, 0.82, 1] : W, 0.95, 1.3, rnd(0, 6), 0, 980, 1.2, SH_SHARD);
      }
      for (let i = 0, n = N(4); i < n; i++)
        this.add(x + rnd(-R, R) * 0.5, y - 10 * sc, rnd(-50, 50) * sc, rnd(-30, -10) * sc, rnd(0.9, 1.4), R * 0.15, R * 0.38, [0.82, 0.92, 1], 0.3, 1.5, rnd(0, 6), 0, 0, -1.2, SH_SMOKE + Math.random() * 0.9);
    } else if (cat === 'dust') {
      for (let i = 0, n = N(8); i < n; i++) {                      // 땅을 따라 번지는 흙먼지
        const d = Math.random() < 0.5 ? -1 : 1, g = rnd(0.5, 0.66);
        this.add(x + d * rnd(0, R) * 0.4, y - rnd(2, 14) * sc, d * rnd(60, 170) * sc, rnd(-30, -8) * sc, rnd(0.9, 1.6), R * rnd(0.1, 0.15), R * rnd(0.3, 0.42),
                 [g, g * 0.88, g * 0.72], 0.55, 1.5, rnd(0, 6), rnd(-0.4, 0.4), 0, -1.2, SH_SMOKE + Math.random() * 0.9);
      }
      for (let i = 0, n = N(12); i < n; i++) {                     // 튀어 오르는 돌 조각
        const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), sp = rnd(200, 460) * sc, g = rnd(0.32, 0.46);
        this.add(x + rnd(-R, R) * 0.3, y - 4 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.5, 0.9), rnd(6, 11) * sc, rnd(5, 9) * sc, [g, g * 0.85, g * 0.7], 1, 1.2, rnd(0, 6), rnd(-10, 10), 1150, 1, SH_SHARD);
      }
    } else if (cat === 'spirit') {
      for (let i = 0, n = N(6); i < n; i++)
        this.add(x + rnd(-R, R) * 0.6, cy + rnd(-50, 20) * sc, 0, rnd(-50, -15) * sc, rnd(0.3, 0.6), rnd(18, 32) * sc, rnd(8, 14) * sc, i % 2 ? W : soft, 1, 1, rnd(0, 1), rnd(-1, 1), 0, 1.3, SH_STAR);
      for (let i = 0, n = N(12); i < n; i++) {                     // 휘돌며 떠오르는 혼불
        const a = rnd(0, Math.PI * 2), rr = rnd(0.2, 0.8) * R;
        this.add(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.25 - 10 * sc, -Math.sin(a) * 90 * sc, rnd(-140, -50) * sc, rnd(0.7, 1.3), rnd(6, 11) * sc, 3 * sc, col, 1, 1, 0, 0, 30, 1.5, SH_GLOW);
      }
    } else if (cat === 'steam') {
      for (let i = 0, n = N(8); i < n; i++) {                      // 하얀 김
        const g = rnd(0.82, 0.95);
        this.add(x + rnd(-R, R) * 0.4, cy, rnd(-90, 90) * sc, rnd(-90, -30) * sc, rnd(0.9, 1.5), R * 0.12, R * 0.42, [g, g, g * 0.97], 0.42, 1.2, rnd(0, 6), rnd(-0.5, 0.5), -10, -1.3, SH_SMOKE + Math.random() * 0.9);
      }
    }
  }

  /* 5.2 고퀄: 자주 일어나는 작은 연출 (렌더러가 부른다). 절전이면 부르지 않는다 */
  accent(type, x, y, col, sc) {
    if (!this.ok) return;
    sc = sc || 1;
    const rnd = (a, b) => a + Math.random() * (b - a), W = [1, 1, 0.96];
    const q = this.quality;
    if (type === 'hit' || type === 'bighit') {               // 맞는 순간: 별빛 · 꼬리 불똥 몇
      const k = type === 'bighit' ? 1.5 : 1;
      this.add(x, y, 0, 0, 0.12 * k, 16 * sc * k, 28 * sc * k, col, 0.9, 1, Math.random(), 0, 0, 1.2, SH_STAR);
      const n = Math.max(2, Math.round((type === 'bighit' ? 7 : 4) * q));
      for (let i = 0; i < n; i++) { const a = rnd(-Math.PI, 0.4), sp = rnd(200, 460) * sc * k;
        this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.12, 0.26), 8 * sc * k, 3 * sc, i % 2 ? col : W, 1, 3, a, 0, 650, 1.4, SH_STREAK); }
      if (type === 'bighit') this.add(x, y + 6 * sc, 0, 0, 0.3, 6 * sc, 22 * sc, col, 0.7, 2.6, 0, 0, 0, 1.2, SH_RING);
    } else if (type === 'death') {                           // 쓰러질 때: 흙먼지 둘
      for (let i = 0; i < 2; i++) { const g = rnd(0.55, 0.68);
        this.add(x + rnd(-14, 14) * sc, y - rnd(2, 10) * sc, rnd(-40, 40) * sc, rnd(-26, -8) * sc, rnd(0.7, 1.1), 10 * sc, 26 * sc, [g, g * 0.9, g * 0.76], 0.4, 1.6, rnd(0, 6), rnd(-0.4, 0.4), 0, -1.2, SH_SMOKE + Math.random() * 0.9); }
    } else if (type === 'spawn') {                           // 내려설 때: 빛기둥 · 별가루 · 바닥 고리
      this.add(x, y - 60 * sc, 0, -30 * sc, 0.35, 70 * sc, 90 * sc, col, 0.4, 0.22, 0, 0, 0, 1.4, SH_GLOW);
      this.add(x, y, 0, 0, 0.45, 8 * sc, 22 * sc, col, 0.8, 3.2, 0, 0, 0, 1.2, SH_RING);
      for (let i = 0, n = Math.max(2, Math.round(5 * q)); i < n; i++)
        this.add(x + rnd(-22, 22) * sc, y - rnd(10, 70) * sc, rnd(-12, 12) * sc, rnd(-90, -30) * sc, rnd(0.4, 0.8), rnd(9, 16) * sc, 4 * sc, i % 2 ? W : col, 1, 1, rnd(0, 1), 0, 0, 1.3, SH_STAR);
    } else if (type === 'trail') {                           // 날아가는 것의 꼬리 빛
      this.add(x, y, 0, 0, 0.18, 8 * sc, 2.5 * sc, col, 0.6, 1, 0, 0, 0, 1.2, SH_GLOW);
    } else if (type === 'trail2') {                          // 화살: 옅은 바람 자국
      this.add(x, y, 0, 0, 0.12, 5 * sc, 2 * sc, [1, 1, 1], 0.22, 1, 0, 0, 0, 1.4, SH_GLOW);
    } else if (type === 'heal') {                            // 치유: 떠오르는 빛 알갱이
      for (let i = 0, n = Math.max(2, Math.round(4 * q)); i < n; i++)
        this.add(x + rnd(-16, 16) * sc, y - rnd(0, 30) * sc, rnd(-10, 10) * sc, rnd(-80, -40) * sc, rnd(0.5, 0.9), rnd(5, 9) * sc, 2 * sc, i % 2 ? col : W, 0.9, 1, 0, 0, 0, 1.5, i % 3 ? SH_GLOW : SH_STAR);
    } else if (type === 'coin') {
      this.add(x, y, 0, -30 * sc, 0.3, 14 * sc, 22 * sc, [1, 0.86, 0.35], 1, 1, Math.random(), 2, 0, 1.3, SH_STAR);
    } else if (type === 'poof') {                            // 연기처럼 사라질 때
      for (let i = 0; i < 3; i++)
        this.add(x + rnd(-12, 12) * sc, y - rnd(10, 40) * sc, rnd(-30, 30) * sc, rnd(-40, -10) * sc, rnd(0.6, 1), 10 * sc, 28 * sc, col, 0.45, 1, rnd(0, 6), rnd(-0.5, 0.5), 0, -1.2, SH_SMOKE + Math.random() * 0.9);
    }
  }

  /* ------------------------------ 연출 ------------------------------
   * 게임의 castFx 종류 8가지. x, y 는 화면 좌표(y 는 지면).
   * opt: color [r,g,b] 0~1 / scale / radius / density / big */
  _emit(kind, x, y, opt) {
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

      /* 5.3 분화: 좁은 용암 기둥이 높이 솟고, 돌덩이와 불똥이 포물선으로 떨어진다 */
      case 'eruption': {
        for (let i = 0, n = N(150); i < n; i++) {
          this.add(x + rnd(-R, R) * 0.25, y - rnd(0, 30) * sc, rnd(-50, 50), rnd(-560, -320) * sc,
                   rnd(0.5, 1.0), rnd(12, 28) * sc * big, rnd(2, 5) * sc,
                   i % 3 ? col : white, 1, 1, 0, rnd(-3, 3), 520, 1.4);
        }
        for (let i = 0, n = N(40); i < n; i++) {        // 돌덩이 (어둡게, 무겁게 떨어진다)
          this.add(x + rnd(-20, 20) * sc, y - rnd(20, 60) * sc, rnd(-220, 220) * sc, rnd(-460, -260) * sc,
                   rnd(0.7, 1.1), rnd(5, 9) * sc, 1, '#5a2a1a', 0.95, 1, 0, 0, 900, 1);
        }
        for (let i = 0, n = N(36); i < n; i++) {        // 바닥에 번지는 용암
          this.add(x + rnd(-R, R), y + rnd(-4, 4), 0, 0, rnd(0.3, 0.7), rnd(40, 90) * sc, 10 * sc, col, 0.75, 1.6, 0, 0, 0, 1.2);
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
        this.add(x, y, 0, 0, 0.3, 30 * sc, 150 * sc * big, white, this.hq ? 0.42 : 0.8, 2.6, 0, 0, 0, 1.5);
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

      /* 4.0 엑스칼리버: 빛기둥 위에 성광이 터진다 (아서) */
      case 'excalibur': {
        this.emit('pillar', x, y, opt);
        this.emit('holy', x, y, opt);
        break;
      }

      /* 치명타 불꽃: 작고 빠르게 튄다 */
      case 'spark': {
        for (let i = 0, n = N(14); i < n; i++) {
          const a = rnd(-Math.PI, Math.PI * 0.2), sp = rnd(160, 380) * sc;
          this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.15, 0.32), rnd(4, 8) * sc, 1,
                   i % 3 ? col : white, 1, 2.6, a, 0, 500, 2);
        }
        this.add(x, y, 0, 0, 0.14, 10 * sc, 44 * sc, white, 0.9, 1, 0, 0, 0, 1.4);
        break;
      }

      /* 광역 폭발: 불꽃 고리와 흩어지는 불씨 */
      case 'burst': {
        for (let i = 0, n = N(30); i < n; i++) {
          const a = i / n * TAU, sp = rnd(140, 260) * sc;
          this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.35, rnd(0.25, 0.45),
                   rnd(10, 18) * sc, 3 * sc, i % 2 ? col : [1, 0.62, 0.25], 0.9, 1.8, a, 0, 0, 1.4);
        }
        for (let i = 0, n = N(18); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(120, 360) * sc;
          this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.3, 0.6), rnd(4, 8) * sc, 1,
                   white, 1, 1.8, a, 0, 700, 2);
        }
        this.add(x, y - 6 * sc, 0, 0, 0.22, 20 * sc, R * 1.2, [1, 0.8, 0.5], 0.7, 1, 0, 0, 0, 1.5);
        break;
      }

      /* 큰 몸이 쓰러질 때 이는 흙먼지 */
      case 'dust': {
        const dirt = [0.85, 0.78, 0.62];
        for (let i = 0, n = N(40); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(60, 220) * sc;
          this.add(x + rnd(-R, R) * 0.4, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.5,
                   rnd(0.6, 1.1), rnd(14, 24) * sc, rnd(40, 70) * sc, dirt, 0.28, 1, 0, 0, -30, 1.3);
        }
        for (let i = 0, n = N(24); i < n; i++) {
          const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), sp = rnd(200, 420) * sc;
          this.add(x, y - 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.4, 0.8), rnd(5, 10) * sc, 2 * sc,
                   col, 1, 1.4, a, rnd(-6, 6), 900, 2);
        }
        break;
      }

      /* 여우불: 나선을 그리며 피어오르는 분홍 불꽃 (구미호) */
      case 'foxfire':
      case 'foxbead': {
        const bead = kind === 'foxbead';
        const rings = bead ? 3 : 2;
        for (let r0 = 0; r0 < rings; r0++) {
          const n = N(bead ? 40 : 26);
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU + r0;
            const rr = R * (0.35 + r0 * 0.3);
            this.add(x + Math.cos(a) * rr, y - 20 * sc + Math.sin(a) * rr * 0.3,
                     -Math.sin(a) * 90 * sc, rnd(-180, -60) * sc,
                     rnd(0.5, 1.0), rnd(12, 22) * sc * big, 2 * sc,
                     i % 3 ? col : white, 0.9, 1.3, 0, rnd(-4, 4), -40, 1.6);
          }
        }
        for (let i = 0, n = N(bead ? 9 : 5); i < n; i++) {     // 떠도는 도깨비불 구슬
          const a = rnd(0, TAU);
          this.add(x + Math.cos(a) * R * 0.5, y - rnd(30, 90) * sc, Math.cos(a) * 30, rnd(-60, -20),
                   rnd(0.8, 1.3), 16 * sc * big, 6 * sc, white, 1, 1, 0, 0, 0, 1.2);
          this.add(x + Math.cos(a) * R * 0.5, y - rnd(30, 90) * sc, Math.cos(a) * 30, rnd(-60, -20),
                   rnd(0.8, 1.3), 34 * sc * big, 10 * sc, col, 0.7, 1, 0, 0, 0, 1.2);
        }
        if (bead) this.add(x, y - 50 * sc, 0, 0, 0.6, 30 * sc, 200 * sc, col, 0.8, 1, 0, 0, 0, 1.5);
        break;
      }

      /* 먹선 일섬: 가로로 긋는 푸른 넋의 선과 흩어지는 혼불 (저승사자) */
      case 'inkslash':
      case 'reaproll': {
        const roll = kind === 'reaproll';
        const cy = y - 30 * sc;
        const L = (roll ? R * 1.1 : 110 * sc) * big;
        for (let s2 = 0; s2 < (roll ? 3 : 1); s2++) {
          const n = N(40), yy = cy + (s2 - (roll ? 1 : 0)) * 22 * sc;
          for (let i = 0; i < n; i++) {
            const t = i / (n - 1) * 2 - 1;
            this.add(x + t * L, yy + t * 6 * sc, 0, 0, rnd(0.25, 0.45),
                     22 * sc * (1 - Math.abs(t) * 0.7), 4 * sc, i % 2 ? col : white, 0.9, 3, 0.05, 0, 0, 1.4);
          }
        }
        for (let i = 0, n = N(roll ? 60 : 26); i < n; i++) {   // 올라가는 혼불
          this.add(x + rnd(-L, L), cy + rnd(-10, 20) * sc, rnd(-20, 20), rnd(-160, -60) * sc,
                   rnd(0.6, 1.2), rnd(6, 13) * sc, 2 * sc, i % 3 ? white : col, 0.85, 1, 0, 0, -30, 1.8);
        }
        break;
      }

      /* 금화 분수 (도깨비) */
      case 'goldburst': {
        const gold = [1, 0.82, 0.3];
        for (let i = 0, n = N(60); i < n; i++) {
          const a = rnd(-Math.PI * 0.85, -Math.PI * 0.15), sp = rnd(160, 420) * sc;
          this.add(x, y - 20 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.5, 0.9),
                   rnd(7, 12) * sc * big, rnd(5, 9) * sc, i % 4 ? gold : white, 1, 0.55, 0, rnd(-9, 9), 900, 3);
        }
        this.add(x, y - 20 * sc, 0, 0, 0.25, 20 * sc, 110 * sc * big, col, 0.8, 1, 0, 0, 0, 1.3);
        break;
      }

      /* 테슬라 방전: 옆으로 갈라지는 전광 (대발명가 · 테슬라 기사) */
      case 'tesla': {
        const cy = y - 40 * sc;
        for (let b = 0; b < 4; b++) {
          let px = x, py = cy;
          const dir = b % 2 ? 1 : -1, segs = N(18);
          for (let k = 0; k < segs; k++) {
            const nx = px + dir * rnd(6, 14) * sc * big, ny = py + rnd(-12, 12) * sc;
            const steps = 3;
            for (let t = 0; t < steps; t++) {
              this.add(px + (nx - px) * t / steps, py + (ny - py) * t / steps, 0, 0,
                       rnd(0.12, 0.25), 9 * sc, 3 * sc, t ? col : white, 1, 1, 0, 0, 0, 1);
            }
            px = nx; py = ny;
          }
        }
        for (let i = 0, n = N(36); i < n; i++) {
          const a = rnd(0, TAU), sp = rnd(100, 320) * sc;
          this.add(x, cy, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.2, 0.45), rnd(4, 8) * sc, 1,
                   white, 1, 2.4, a, 0, 300, 2);
        }
        this.add(x, cy, 0, 0, 0.2, 18 * sc, 90 * sc * big, col, 0.9, 1, 0, 0, 0, 1.3);
        break;
      }

      /* 증기 폭발: 퍼지는 흰 김과 주황 불티 (증기 거상) */
      case 'steamburst':
      case 'overdrive': {
        const steam = [0.92, 0.92, 0.9];
        const od = kind === 'overdrive';
        for (let i = 0, n = N(od ? 50 : 70); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(80, 260) * sc;
          this.add(x + rnd(-R, R) * 0.3, y - 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.6,
                   rnd(0.6, 1.2), rnd(18, 30) * sc * big, rnd(50, 80) * sc, od ? col : steam, 0.35, 1, 0, 0, -40, 1.3);
        }
        for (let i = 0, n = N(50); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(200, 520) * sc;
          this.add(x, y - 16 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.3, 0.7),
                   rnd(4, 9) * sc, 1, i % 3 ? col : white, 1, 2.2, a, 0, 700, 2);
        }
        if (od) {                                          // 과부하: 톱니 고리
          for (let i = 0, n = N(48); i < n; i++) {
            const a = i / n * TAU;
            this.add(x + Math.cos(a) * R, y - 30 * sc + Math.sin(a) * R * 0.3,
                     -Math.sin(a) * R * 1.4, Math.cos(a) * R * 0.4, rnd(0.5, 0.8),
                     (i % 2 ? 16 : 8) * sc, 3 * sc, col, 0.9, 1.6, a, 0, 0, 1.2);
          }
        }
        this.add(x, y - 20 * sc, 0, 0, 0.35, 30 * sc, 160 * sc * big, white, 0.6, 1.8, 0, 0, 0, 1.5);
        break;
      }

      /* 여의봉: 황금 충격 고리와 뭉게구름 (손오공) */
      case 'staff': {
        const gold = [1, 0.82, 0.3], cloud = [0.96, 0.95, 0.9];
        for (let ring = 0; ring < 2; ring++) {
          const n = N(52), sp = (320 + ring * 170) * sc;
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU;
            this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.28, 0.36 + ring * 0.1,
                     (20 - ring * 6) * sc * big, 2 * sc, ring ? gold : white, 0.95, 2.4, a, 0, 0, 1.3);
          }
        }
        for (let i = 0, n = N(40); i < n; i++) {        // 근두운 연기
          const a = rnd(-Math.PI, 0), sp = rnd(60, 200) * sc;
          this.add(x + rnd(-R, R) * 0.4, y - 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.5,
                   rnd(0.6, 1.1), rnd(20, 34) * sc, rnd(50, 80) * sc, cloud, 0.3, 1, 0, 0, -30, 1.3);
        }
        for (let i = 0, n = N(40); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(200, 480) * sc;
          this.add(x, y - 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.3, 0.7), rnd(5, 10) * sc, 1,
                   i % 3 ? col : white, 1, 2.2, a, 0, 800, 2);
        }
        break;
      }

      /* 풍화륜: 돌며 번지는 불고리 (나타) */
      case 'firering': {
        const fire = [1, 0.55, 0.2];
        for (let i = 0, n = N(70); i < n; i++) {
          const a = i / n * TAU, rr = R * rnd(0.4, 0.9);
          this.add(x + Math.cos(a) * rr, y - 10 * sc + Math.sin(a) * rr * 0.3,
                   -Math.sin(a) * rr * 2, rnd(-160, -60) * sc, rnd(0.35, 0.7),
                   rnd(12, 24) * sc * big, 3 * sc, i % 4 ? (i % 2 ? col : fire) : white, 0.9, 1.3, 0, rnd(-4, 4), -60, 1.5);
        }
        break;
      }

      /* 혼천릉: 소용돌이치며 조여드는 붉은 비단 (나타) */
      case 'skybind': {
        const silk = [0.85, 0.27, 0.23];
        for (let j = 0; j < 3; j++) {
          const n = N(60);
          for (let i = 0; i < n; i++) {
            const t = i / n, a = t * Math.PI * 3 + j * 2.1, rr = R * (1 - t * 0.85);
            this.add(x + Math.cos(a) * rr, y - 45 * sc + Math.sin(a) * rr * 0.3 - t * 20 * sc,
                     -Math.cos(a) * rr * 0.8, -Math.sin(a) * rr * 0.25, rnd(0.5, 0.9),
                     rnd(10, 18) * sc * big, 4 * sc, i % 5 ? silk : white, 0.9, 2, a, 0, 0, 1.3);
          }
        }
        this.add(x, y - 45 * sc, 0, 0, 0.5, 30 * sc, 160 * sc, col, 0.6, 1, 0, 0, 0, 1.4);
        break;
      }

      /* 3.3 물보라: 솟구쳤다 쏟아지는 물기둥 */
      case 'tidal': {
        const foam = [0.9, 0.98, 1];
        for (let i = 0, n = N(90); i < n; i++) {
          const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), sp = rnd(160, 520) * sc;
          this.add(x + rnd(-R * 0.3, R * 0.3), y, Math.cos(a) * sp * 0.6, Math.sin(a) * sp,
                   rnd(0.45, 0.9), rnd(8, 18) * sc * big, 3 * sc, i % 3 ? col : foam, 0.85, 1.5, a, 0, 1300, 1.1);
        }
        for (let i = 0, n = N(48); i < n; i++) {
          const a = i / n * TAU;
          this.add(x, y, Math.cos(a) * R * 1.6, Math.sin(a) * R * 0.35, rnd(0.35, 0.6), 16 * sc, 4 * sc, foam, 0.8, 2, a, 0, 0, 1.2);
        }
        break;
      }
      /* 3.3 작살: 꽂히며 튀는 물방울 */
      case 'harpoon': {
        for (let i = 0, n = N(36); i < n; i++) {
          const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), sp = rnd(120, 360) * sc;
          this.add(x, y - 20 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.25, 0.5), rnd(5, 10) * sc, 1, i % 2 ? col : white, 1, 2, a, 0, 900);
        }
        break;
      }
      /* 3.3 뇌우: 먹구름에서 내리꽂는 벼락 */
      case 'storm': {
        const cloud = [0.35, 0.4, 0.52];
        for (let i = 0, n = N(26); i < n; i++)
          this.add(x + rnd(-60, 60) * sc, y - 260 * sc + rnd(-14, 14) * sc, rnd(-20, 20), 0, rnd(0.5, 0.8), rnd(30, 50) * sc, 50 * sc, cloud, 0.35, 1, 0, 0, 0, 1);
        let px = x, py = y - 250 * sc;
        const segs = N(30);
        for (let i = 0; i < segs; i++) {
          const ny = py + (250 * sc) / segs, nx = px + rnd(-12, 12) * sc, ang = Math.atan2(ny - py, nx - px);
          this.add(px, py, 0, 0, rnd(0.3, 0.45), 22 * sc * big, 10 * sc, col, 0.6, 2.2, ang, 0, 0, 0.8);
          this.add(px, py, 0, 0, rnd(0.3, 0.45), 8 * sc * big, 4 * sc, white, 1, 2.6, ang, 0, 0, 0.7);
          px = nx; py = ny;
        }
        for (let i = 0, n = N(40); i < n; i++) {
          const a = rnd(0, TAU), sp = rnd(80, 380) * sc;
          this.add(x, y, Math.cos(a) * sp, -Math.abs(Math.sin(a)) * sp, rnd(0.25, 0.6), rnd(6, 14) * sc, 1, col, 1, 2, a, 0, 700);
        }
        break;
      }

      /* 교차 참격 */
      /* ---- 4.3 3진 여섯의 연출 ---- */
      /* 공성 전차 포탄: 섬광 · 불덩이 · 바닥을 쓰는 충격 고리 · 불티 (어두운 흙·연기는 Canvas 가 맡는다) */
      case 'shellblast': {
        const fire = [1, 0.6, 0.18], hot = [1, 0.92, 0.62];
        this.add(x, y - 12 * sc, 0, -20 * sc, 0.3, 34 * sc * big, 120 * sc * big, hot, 0.9, 1, 0, 0, 0, 1.3);
        for (let i = 0, n = N(26); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(50, 210) * sc;
          this.add(x + rnd(-10, 10) * sc, y - 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.8, rnd(0.35, 0.7),
                   rnd(18, 30) * sc * big, rnd(30, 54) * sc, i % 3 ? fire : hot, 0.85, 1, 0, 0, -70, 1.6);
        }
        for (let i = 0, n = N(40); i < n; i++) {
          const a = i / n * TAU, sp = R * 2.8;
          this.add(x, y - 3 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.22, 0.28, 11 * sc, 3 * sc, hot, 0.75, 3.2, a, 0, 0, 1.2);
        }
        for (let i = 0, n = N(26); i < n; i++) {
          const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), sp = rnd(240, 560) * sc;
          this.add(x, y - 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.3, 0.6), rnd(3, 5) * sc, 1, hot, 1, 2.8, a, 0, 760, 2);
        }
        break;
      }
      /* 비행접시: 초록 고리 셋 · 위로 빨려 올라가는 빛 알갱이 */
      case 'ufoburst': {
        const lite = [0.75, 1, 0.85];
        for (let ring = 0; ring < 3; ring++) {
          const n = N(30), sp = (120 + ring * 90) * sc;
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU;
            this.add(x, y - 4 * sc - ring * 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.24, 0.32 + ring * 0.08,
                     (12 - ring * 2) * sc, 3 * sc, ring === 1 ? lite : col, 0.85, 2.2, a, 0, 0, 1.3);
          }
        }
        for (let i = 0, n = N(34); i < n; i++) {
          this.add(x + rnd(-R, R) * 0.5, y - rnd(0, 20) * sc, rnd(-12, 12) * sc, rnd(-260, -120) * sc, rnd(0.5, 0.9),
                   rnd(5, 10) * sc, 1, i % 2 ? col : lite, 0.95, 1.6, -Math.PI / 2, 0, -60, 1.6);
        }
        this.add(x, y - 10 * sc, 0, 0, 0.35, 26 * sc, 120 * sc * big, col, 0.7, 1, 0, 0, 0, 1.4);
        break;
      }
      /* 로켓 주먹: 흰 섬광 · 금빛 충격 고리 · 쇳조각 불티 */
      case 'rocketpunch': {
        const gold = [1, 0.84, 0.3], hot = [1, 0.95, 0.8];
        this.add(x, y - 30 * sc, 0, 0, 0.22, 26 * sc, 110 * sc * big, hot, 1, 1, 0, 0, 0, 1.2);
        for (let i = 0, n = N(44); i < n; i++) {
          const a = i / n * TAU, sp = R * 3;
          this.add(x, y - 30 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, 0.26, 12 * sc, 3 * sc, gold, 0.9, 3, a, 0, 0, 1.2);
        }
        for (let i = 0, n = N(30); i < n; i++) {
          const a = rnd(-Math.PI * 0.9, Math.PI * 0.2) * (i % 2 ? 1 : -1) - Math.PI / 2 * 0.2, sp = rnd(260, 620) * sc;
          this.add(x, y - 30 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.25, 0.5), rnd(3, 5) * sc, 1, i % 3 ? gold : hot, 1, 3, a, 0, 600, 2);
        }
        break;
      }
      /* 드릴: 앞으로 튀는 불꽃 다발 */
      case 'drillspark': {
        const spark = [1, 0.8, 0.35], hot = [1, 0.96, 0.8];
        const dir = opt.dir || 1;
        for (let i = 0, n = N(30); i < n; i++) {
          const a = (dir > 0 ? Math.PI : 0) + rnd(-0.9, 0.9) - 0.25 * dir, sp = rnd(160, 420) * sc;
          this.add(x, y - 24 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.2, 0.45), rnd(3, 5) * sc, 1, i % 3 ? spark : hot, 1, 3.2, a, 0, 700, 2);
        }
        this.add(x, y - 24 * sc, 0, 0, 0.18, 14 * sc, 50 * sc, hot, 0.8, 1, 0, 0, 0, 1.2);
        break;
      }
      /* 드론 타격: 작은 폭발 · 파란 전기 불티 */
      case 'dronestrike': {
        const fire = [1, 0.62, 0.22], elec = [0.55, 0.88, 1];
        this.add(x, y - 14 * sc, 0, 0, 0.26, 18 * sc, 70 * sc, fire, 0.9, 1, 0, 0, 0, 1.3);
        for (let i = 0, n = N(22); i < n; i++) {
          const a = rnd(0, TAU), sp = rnd(120, 340) * sc;
          this.add(x, y - 14 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.18, 0.4), rnd(3, 5) * sc, 1, i % 2 ? elec : fire, 1, 2.6, a, 0, 400, 2);
        }
        break;
      }

      /* ---- 4.4 3진 넷 ---- */
      /* 불도저 삽: 앞으로 튀는 흙덩이 · 먼지 (흙빛은 어두워 Canvas 가 맡고, 여기선 불티 같은 돌 조각만) */
      case 'dozerpush': {
        const dir = opt.dir || 1, dirt = [0.95, 0.82, 0.6], hot = [1, 0.95, 0.8];
        for (let i = 0, n = N(24); i < n; i++) {
          const a = dir > 0 ? -rnd(0.15, 1.1) : Math.PI + rnd(0.15, 1.1), sp = rnd(160, 380) * sc;   // 앞쪽 위로
          this.add(x, y - 8 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.3, 0.6), rnd(3, 6) * sc, 1, i % 4 ? dirt : hot, 0.9, 1.6, a, rnd(-8, 8), 820, 2);
        }
        this.add(x, y - 12 * sc, 0, 0, 0.22, 16 * sc, 60 * sc, dirt, 0.45, 1, 0, 0, 0, 1.4);
        break;
      }
      /* 빙수 눈덩이: 흰 눈가루 고리 · 퍼지는 얼음 결정 · 분홍 시럽 방울 */
      case 'snowburst': {
        const snow = [0.92, 0.98, 1], ice = [0.6, 0.88, 1], pink = [1, 0.6, 0.75];
        for (let i = 0, n = N(34); i < n; i++) {
          const a = i / n * TAU, sp = R * 2.6;
          this.add(x, y - 6 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.28, 0.4, 9 * sc, 3 * sc, i % 2 ? snow : ice, 0.8, 2, a, 0, 0, 1.3);
        }
        for (let i = 0, n = N(30); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(80, 300) * sc;
          this.add(x, y - 14 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.4, 0.9), rnd(3, 7) * sc, 1, i % 5 === 0 ? pink : snow, 0.95, 1, 0, rnd(-6, 6), 420, 1.6);
        }
        this.add(x, y - 14 * sc, 0, 0, 0.3, 20 * sc, 90 * sc, snow, 0.6, 1, 0, 0, 0, 1.4);
        break;
      }
      /* 광선검: 엇갈린 두 줄기 빛 · 튀는 푸른 불티 */
      case 'sabercut': {
        const dir = opt.dir || 1, hot = [0.9, 1, 1];
        for (let k = 0; k < 2; k++) {
          const tilt = (k ? 0.7 : -0.7) * dir;
          for (let i = 0, n = N(16); i < n; i++) {
            const u = (i / (n - 1) - 0.5) * 70 * sc;
            this.add(x + Math.cos(tilt) * u, y - 34 * sc + Math.sin(tilt) * u, 0, 0, 0.22 + k * 0.05, 7 * sc, 2 * sc, i % 3 ? col : hot, 1, 1.2, tilt, 0, 0, 1.2);
          }
        }
        for (let i = 0, n = N(22); i < n; i++) {
          const a = rnd(0, TAU), sp = rnd(160, 420) * sc;
          this.add(x, y - 34 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.15, 0.35), rnd(3, 5) * sc, 1, i % 2 ? col : hot, 1, 3, a, 0, 500, 2);
        }
        break;
      }
      /* 레일건 착탄: 하얀 섬광 · 도는 푸른 나선 · 사방 불티 */
      case 'railhit': {
        const hot = [0.92, 1, 1];
        this.add(x, y - 30 * sc, 0, 0, 0.2, 18 * sc, 90 * sc * big, hot, 1, 1, 0, 0, 0, 1.2);
        for (let i = 0, n = N(36); i < n; i++) {
          const a = i / n * TAU * 2, sp = (60 + i * 6) * sc;
          this.add(x, y - 30 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, 0.35, 6 * sc, 2 * sc, i % 3 ? col : hot, 0.9, 1.4, a, 4, 0, 1.3);
        }
        for (let i = 0, n = N(24); i < n; i++) {
          const a = rnd(0, TAU), sp = rnd(240, 560) * sc;
          this.add(x, y - 30 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.2, 0.4), rnd(3, 5) * sc, 1, hot, 1, 3, a, 0, 300, 2);
        }
        break;
      }

      /* 4.7 메카 대성: 금빛 충격 고리 · 위로 튀는 바위 조각 · 하늘색 불꽃 */
      case 'mechstaff': {
        const gold = [1, 0.84, 0.32], hot = [1, 0.97, 0.8], cy = [0.5, 0.94, 1];
        this.add(x, y - 10 * sc, 0, 0, 0.25, 20 * sc, 110 * sc * big, hot, 0.9, 1, 0, 0, 0, 1.3);
        for (let i = 0, n = N(30); i < n; i++) {
          const a = i / n * TAU, sp = R * 2.4;
          this.add(x, y - 4 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.25, 0.45, 8 * sc, 3 * sc, i % 3 ? gold : hot, 0.85, 1.6, a, 0, 0, 1.3);
        }
        for (let i = 0, n = N(18); i < n; i++) {
          const a = rnd(-Math.PI * 0.85, -Math.PI * 0.15), sp = rnd(160, 380) * sc;
          this.add(x + rnd(-20, 20) * sc, y - 6 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.4, 0.7), rnd(4, 7) * sc, 2 * sc, i % 4 ? [0.6, 0.48, 0.32] : cy, 1, 1, rnd(0, TAU), rnd(-8, 8), 900, 1.5);
        }
        break;
      }
      /* 태양 위성: 위에서 내리꽂힌 빛이 땅에 번지는 태양 고리 · 피어오르는 불씨 */
      case 'solarburn': {
        const sun = [1, 0.8, 0.25], hot = [1, 0.98, 0.85];
        this.add(x, y - 16 * sc, 0, 0, 0.3, 24 * sc, R * 1.1 * big, hot, 0.85, 1, 0, 0, 0, 1.2);
        for (let i = 0, n = N(28); i < n; i++) {
          const a = i / n * TAU, sp = R * 2;
          this.add(x, y - 4 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.22, 0.5, 9 * sc, 2 * sc, i % 2 ? sun : hot, 0.8, 1.4, a, 0, 0, 1.4);
        }
        for (let i = 0, n = N(26); i < n; i++)
          this.add(x + rnd(-1, 1) * R * 0.6, y - 4 * sc, rnd(-20, 20) * sc, -rnd(60, 180) * sc, rnd(0.5, 1), rnd(3, 5) * sc, 1, i % 3 ? sun : [1, 0.5, 0.2], 0.9, 1, 0, 0, -60, 1.6);
        break;
      }
      /* 천둥 라이더: 하늘에서 떨어지는 번개 기둥 · 푸른 고리 · 사방 불티 */
      case 'boltstrike': {
        const hot = [0.9, 0.98, 1];
        for (let i = 0, n = N(14); i < n; i++) {
          const yy = y - 30 * sc - i * 22 * sc, xx = x + Math.sin(i * 2.7) * 9 * sc;
          this.add(xx, yy, 0, 0, 0.18 + i * 0.006, 10 * sc, 4 * sc, i % 2 ? col : hot, 1, 3, Math.PI / 2 + Math.sin(i * 1.9) * 0.4, 0, 0, 1.2);
        }
        this.add(x, y - 20 * sc, 0, 0, 0.22, 22 * sc, 100 * sc * big, hot, 1, 1, 0, 0, 0, 1.2);
        for (let i = 0, n = N(30); i < n; i++) {
          const a = rnd(0, TAU), sp = rnd(180, 460) * sc;
          this.add(x, y - 20 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.7, rnd(0.18, 0.4), rnd(3, 6) * sc, 1, i % 2 ? col : hot, 1, 3, a, 0, 300, 2);
        }
        break;
      }
      /* 홀로그램 대마도사: 퍼지는 육각 격자 · 위로 흩어지는 룬 조각 */
      case 'holoburst': {
        const cy = [0.45, 0.95, 1], hot = [0.9, 1, 1];
        for (let k = 0; k < 6; k++) {
          const a0 = k / 6 * TAU, a1 = (k + 1) / 6 * TAU;
          for (let i = 0, n = N(6); i < n; i++) {
            const u = i / n, a = a0 + (a1 - a0) * u;
            this.add(x, y - 22 * sc, Math.cos(a) * R * 1.8, Math.sin(a) * R * 1.8 * 0.5, 0.42, 6 * sc, 2 * sc, k % 2 ? cy : hot, 0.85, 1.2, a, 0, 0, 1.3);
          }
        }
        for (let i = 0, n = N(20); i < n; i++)
          this.add(x + rnd(-1, 1) * R * 0.5, y - rnd(10, 40) * sc, rnd(-30, 30) * sc, -rnd(40, 140) * sc, rnd(0.5, 0.9), rnd(3, 6) * sc, 2 * sc, cy, 0.9, 1, Math.PI / 4, 0, -40, 1.5);
        this.add(x, y - 22 * sc, 0, 0, 0.25, 16 * sc, 80 * sc * big, cy, 0.7, 1, 0, 0, 0, 1.3);
        break;
      }
      /* 제트팩 발키리: 내리꽂힌 자리의 금빛 깃털 · 흰 충격 고리 */
      case 'divestrike': {
        const gold = [1, 0.9, 0.55], hot = [1, 1, 0.92];
        this.add(x, y - 14 * sc, 0, 0, 0.22, 16 * sc, 90 * sc * big, hot, 0.85, 1, 0, 0, 0, 1.3);
        for (let i = 0, n = N(24); i < n; i++) {
          const a = i / n * TAU, sp = R * 2.2;
          this.add(x, y - 4 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.25, 0.4, 7 * sc, 2 * sc, hot, 0.8, 1.4, a, 0, 0, 1.3);
        }
        for (let i = 0, n = N(16); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(80, 240) * sc;
          this.add(x, y - 20 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.6, 1.1), rnd(5, 8) * sc, 3 * sc, gold, 0.9, 2.4, a, rnd(-4, 4), 160, 1.6);
        }
        break;
      }
      /* 4.18 별의 대현자 착탄: 위에서 꽂히는 금빛 줄기 · 사방으로 튀는 별 조각 · 퍼지는 금빛 고리 */
      case 'starfall': {
        const gold = [1, 0.85, 0.42], hot = [1, 0.97, 0.85], vio = [0.8, 0.6, 1];
        for (let i = 0, n = N(12); i < n; i++) this.add(x + rnd(-6, 6) * sc, y - (150 - i * 11) * sc, 0, 0, 0.22, 8 * sc, 2 * sc, hot, 0.9, 1, Math.PI / 2, 0, 0, 1.3);
        for (let i = 0, n = N(28); i < n; i++) { const a = rnd(-Math.PI, 0), sp = rnd(140, 380) * sc;
          this.add(x, y - 18 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.4, 0.8), rnd(3, 6) * sc, 1.5 * sc, i % 3 ? gold : vio, 1, 2, a, rnd(-6, 6), 420, 1.7); }
        for (let i = 0, n = N(30); i < n; i++) { const a = i / n * TAU; this.add(x, y - 2 * sc, Math.cos(a) * R * 2, Math.sin(a) * R * 0.5, 0.45, 6 * sc, 2 * sc, gold, 0.8, 1.3, a, 0, 0, 1.3); }
        this.add(x, y - 18 * sc, 0, 0, 0.22, 14 * sc, 80 * sc * big, hot, 0.7, 1, 0, 0, 0, 1.3);
        break;
      }
      /* 4.18 플라즈마 착탄: 하얀 섬광 · 푸른 플라즈마 구름 · 사방으로 튀는 전기 불티 */
      case 'plasmablast': {
        const hot = [0.92, 1, 1];
        this.add(x, y - 16 * sc, 0, 0, 0.25, 20 * sc, 110 * sc * big, hot, 0.85, 1, 0, 0, 0, 1.2);
        for (let i = 0, n = N(40); i < n; i++) { const a = rnd(-Math.PI, 0.2), sp = rnd(180, 520) * sc;
          this.add(x, y - 16 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.2, 0.5), rnd(3, 6) * sc, 1, i % 2 ? col : hot, 1, 3, a, 0, 300, 2); }
        for (let i = 0, n = N(24); i < n; i++) { const a = i / n * TAU; this.add(x, y - 2 * sc, Math.cos(a) * R * 2.4, Math.sin(a) * R * 0.5, 0.4, 8 * sc, 2 * sc, col, 0.8, 1.4, a, 0, 0, 1.3); }
        break;
      }
      /* 4.18 미사일 착탄: 작은 불덩이와 불티 */
      case 'missilehit': {
        const fire = [1, 0.6, 0.22], hot = [1, 0.95, 0.75];
        this.add(x, y - 10 * sc, 0, 0, 0.2, 10 * sc, 46 * sc, hot, 0.8, 1, 0, 0, 0, 1.3);
        for (let i = 0, n = N(12); i < n; i++) { const a = rnd(-Math.PI, 0), sp = rnd(120, 300) * sc;
          this.add(x, y - 10 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.25, 0.5), rnd(3, 5) * sc, 1, i % 2 ? fire : hot, 1, 2.4, a, 0, 500, 2); }
        break;
      }
      /* 4.18 별의 심판 (멀린 4진): 별 다섯이 꽂히고 거대한 금빛 고리 */
      case 'astral': {
        for (let i = 0; i < 5; i++) this.emit('starfall', x + (i - 2) * R * 0.35, y, opt);
        this.emit('holy', x, y, opt);
        break;
      }
      /* 4.15 청룡 군신: 비취 초승달을 따라 늘어선 빛 · 흩어지는 용 비늘 */
      case 'dragonslash': {
        const hot = [0.9, 1, 0.95], dir = opt.dir || 1;
        for (let i = 0, n = N(22); i < n; i++) {
          const a = -1.3 + i / (n - 1) * 1.9;
          this.add(x + Math.cos(a) * R * 0.7 * dir, y - 30 * sc + Math.sin(a) * R * 0.7, 0, 0, 0.3, 9 * sc, 2 * sc, i % 3 ? col : hot, 1, 1.2, a + Math.PI / 2, 0, 0, 1.3);
        }
        for (let i = 0, n = N(20); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(120, 320) * sc;
          this.add(x, y - 24 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.4, 0.8), rnd(4, 7) * sc, 2 * sc, i % 2 ? col : hot, 0.95, 1.6, a, rnd(-5, 5), 380, 1.6);
        }
        this.add(x, y - 24 * sc, 0, 0, 0.2, 14 * sc, 80 * sc * big, hot, 0.6, 1, 0, 0, 0, 1.3);
        break;
      }
      /* 4.25 천호 여제: 사방으로 흩어지는 분홍 여우불 아홉 · 흰 심 · 위로 오르는 불티 */
      case 'foxstorm': {
        const hot = [1, 0.95, 0.98];
        for (let i = 0, n = N(18); i < n; i++) {
          const a = i / n * TAU, sp = rnd(140, 260) * sc;
          this.add(x, y - 26 * sc, Math.cos(a) * sp, Math.sin(a) * sp * 0.5, rnd(0.45, 0.8), rnd(6, 10) * sc, 3 * sc, i % 2 ? col : hot, 0.95, 1.4, 0, 0, -40, 1.5);
        }
        for (let i = 0, n = N(16); i < n; i++) this.add(x + rnd(-R, R) * 0.5, y - 10 * sc, rnd(-30, 30) * sc, -rnd(80, 200) * sc, rnd(0.5, 1), rnd(3, 6) * sc, 2 * sc, col, 0.8, 1.6, 0, 0, -30, 1.4);
        this.add(x, y - 26 * sc, 0, 0, 0.25, 12 * sc, 60 * sc * big, hot, 0.6, 1, 0, 0, 0, 1.3);
        break;
      }
      /* 4.25 태엽 신공방: 테슬라 코일 방전 — 푸른 불꽃이 튀고 하얀 섬광 */
      case 'teslacoil': {
        const hot = [0.85, 0.97, 1], blue = [0.62, 0.9, 1];
        for (let i = 0, n = N(24); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(160, 380) * sc;
          this.add(x, y - 20 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.25, 0.5), rnd(5, 9) * sc, 1.6 * sc, i % 3 ? blue : hot, 1, 1.6, a, 0, 300, 1.5);
        }
        this.add(x, y - 20 * sc, 0, 0, 0.18, 10 * sc, 70 * sc * big, hot, 0.7, 1, 0, 0, 0, 1.4);
        this.emit('spark', x, y - 20 * sc, opt);
        break;
      }
      /* 4.25 천총운 폭풍신: 길게 그은 푸른 일섬을 따라 늘어선 빛 · 번개 불티 · 바람 */
      case 'kusanagi': {
        const hot = [0.92, 0.98, 1], dir = opt.dir || 1;
        for (let i = 0, n = N(24); i < n; i++) {
          const u = i / (n - 1) - 0.5;
          this.add(x + u * R * 1.4 * dir, y - 30 * sc - u * 36 * sc, 0, 0, 0.3, 9 * sc, 2 * sc, i % 3 ? col : hot, 1, 1.2, -0.45 * dir, 0, 0, 1.3);
        }
        for (let i = 0, n = N(18); i < n; i++) {
          const a = rnd(-Math.PI, 0), sp = rnd(140, 320) * sc;
          this.add(x, y - 24 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.35, 0.7), rnd(4, 7) * sc, 2 * sc, i % 2 ? col : hot, 0.95, 1.6, a, rnd(-5, 5), 360, 1.6);
        }
        this.emit('shockwave', x, y, opt);
        break;
      }
      /* 4.15 청룡언월 일섬 (관우): 거대한 초승달 빛 + 비늘 폭발 */
      case 'dragonblade': {
        this.emit('dragonslash', x, y, opt);
        this.emit('shockwave', x, y, opt);
        break;
      }
      /* 4.15 동남풍 (제갈량): 위로 감아 오르는 바람 + 불티 */
      case 'eastwind': {
        const wind = [0.92, 0.97, 1], fire = [1, 0.55, 0.2];
        for (let i = 0, n = N(60); i < n; i++) {
          const a = rnd(0, TAU), rr = rnd(0.2, 1) * R;
          this.add(x + Math.cos(a) * rr, y - 10 * sc, -Math.sin(a) * 220 * sc, -rnd(60, 200) * sc, rnd(0.6, 1.1), rnd(4, 8) * sc, 2 * sc, i % 3 ? wind : fire, 0.7, 2, a, 0, -60, 1.5);
        }
        this.emit('firestorm', x, y, opt);
        break;
      }
      /* 달빛 레이저 궁수: 초승달 섬광 · 꿰뚫고 가는 빛 조각 */
      case 'laserhit': {
        const hot = [0.92, 1, 1], dir = opt.dir || 1;
        for (let i = 0, n = N(14); i < n; i++) {
          const a = -1.1 + i / (n - 1) * 2.2;
          this.add(x + Math.cos(a) * 18 * sc * dir, y - 30 * sc + Math.sin(a) * 18 * sc, 0, 0, 0.3, 6 * sc, 2 * sc, i % 2 ? col : hot, 1, 1, 0, 0, 0, 1.3);
        }
        for (let i = 0, n = N(14); i < n; i++) {
          const sp = rnd(240, 520) * sc;
          this.add(x, y - 30 * sc, sp * dir, rnd(-40, 40) * sc, rnd(0.15, 0.3), rnd(3, 5) * sc, 1, i % 2 ? col : hot, 1, 4, 0, 0, 0, 2);
        }
        break;
      }

      /* 5.2 지니의 램프 마법: 푸른 구슬이 터지며 금빛 별가루가 소용돌이친다 */
      case 'wishburst': {
        const blue = [0.48, 0.85, 1], gold = [1, 0.84, 0.32], hot = [0.92, 0.98, 1], cy = y - 24 * sc;
        this.add(x, cy, 0, 0, 0.22, 10 * sc, 70 * sc * big, blue, 0.75, 1, 0, 0, 0, 1.4);
        this.add(x, cy, 0, 0, 0.12, 6 * sc, 30 * sc * big, hot, 0.9, 1, 0, 0, 0, 1.2);
        for (let i = 0, n = N(22); i < n; i++) {                   // 금빛 별가루 소용돌이
          const a = i / n * TAU, sp = rnd(90, 200) * sc;
          this.add(x + Math.cos(a) * 10 * sc, cy + Math.sin(a) * 6 * sc, Math.cos(a + 1.2) * sp, Math.sin(a + 1.2) * sp * 0.55 - 40 * sc,
                   rnd(0.4, 0.75), rnd(4, 7) * sc, 1.5 * sc, i % 3 ? gold : hot, 1, 1, 0, rnd(-4, 4), -30, 1.5);
        }
        for (let i = 0, n = N(8); i < n; i++)                      // 푸른 연기 방울
          this.add(x + rnd(-R, R) * 0.35, cy + rnd(-8, 8) * sc, rnd(-30, 30) * sc, -rnd(40, 90) * sc, rnd(0.5, 0.9), rnd(8, 12) * sc, rnd(14, 20) * sc, blue, 0.45, 1, 0, 0, 0, 1.6);
        break;
      }
      /* 5.2 세 가지 소원: 초록 · 파랑 · 금빛 소원 셋이 나선으로 솟아 터지고, 금화가 쏟아진다 */
      case 'threewish': {
        const wc = [[0.5, 1, 0.62], [0.55, 0.85, 1], [1, 0.84, 0.32]], hot = [1, 1, 0.94], cy = y - 40 * sc;
        for (let w = 0; w < 3; w++) {
          const c3 = wc[w], a0 = w / 3 * TAU;
          for (let i = 0, n = N(24); i < n; i++) {                 // 나선으로 솟는 소원 꼬리
            const u = i / n, a = a0 + u * TAU * 1.5, rr = R * (0.15 + u * 0.55);
            this.add(x + Math.cos(a) * rr, y - 10 * sc - u * 120 * sc + Math.sin(a) * rr * 0.22, Math.cos(a + 1.57) * 60 * sc, -40 * sc,
                     0.35 + u * 0.5, (9 - u * 4) * sc, 2 * sc, c3, 1, 1, 0, 0, 0, 1.5);
          }
          const bx = x + Math.cos(a0) * R * 0.45, by = cy - 30 * sc + Math.sin(a0) * 20 * sc;
          this.add(bx, by, 0, 0, 0.45, 16 * sc, 46 * sc * big, c3, 0.8, 1, 0, 0, 0, 1.5);   // 터지는 소원 구슬
          this.add(bx, by, 0, 0, 0.3, 8 * sc, 22 * sc, hot, 0.9, 1, 0, 0, 0, 1.3);
        }
        for (let i = 0, n = N(40); i < n; i++) {                   // 쏟아지는 금화 (뒤집히며 떨어진다)
          const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), sp = rnd(160, 380) * sc;
          this.add(x + rnd(-R, R) * 0.2, cy, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.6, 1.1), rnd(6, 9) * sc * big, rnd(4, 6) * sc, i % 3 ? wc[2] : hot, 1, 0.55, 0, rnd(-9, 9), 900, 3);
        }
        this.add(x, y - 6 * sc, 0, 0, 0.5, R * 0.3, R * 1.1, wc[1], 0.5, 3.2, 0, 0, 0, 1.5);
        this.add(x, cy, 0, 0, 0.3, 30 * sc, 160 * sc * big, hot, 0.55, 1, 0, 0, 0, 1.6);
        break;
      }
      /* 5.2 로크의 습격: 거대한 새가 내리꽂힌 자리 — 흙먼지 고리 · 흩날리는 깃털 · 튀는 흙 */
      case 'rocdive': {
        const dust = [0.86, 0.76, 0.6], feather = [0.96, 0.92, 0.84], hot = [1, 0.97, 0.9];
        for (let ring = 0; ring < 2; ring++) {
          const n = N(48), sp = (260 + ring * 160) * sc;
          for (let i = 0; i < n; i++) { const a = i / n * TAU;
            this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.26, 0.4 + ring * 0.12, (16 - ring * 4) * sc * big, 3 * sc, ring ? dust : hot, 0.8, 2.2, a, 0, 0, 1.4); }
        }
        for (let i = 0, n = N(26); i < n; i++) {                   // 흩날리는 깃털 (천천히 떨어진다)
          const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), sp = rnd(120, 300) * sc;
          this.add(x + rnd(-R, R) * 0.3, y - rnd(20, 70) * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.9, 1.6), rnd(9, 14) * sc, rnd(7, 11) * sc, i % 3 ? feather : col, 0.95, 1.6, a, rnd(-6, 6), 160, 1.6);
        }
        for (let i = 0, n = N(24); i < n; i++) {                   // 튀는 흙 · 돌
          const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), sp = rnd(200, 460) * sc;
          this.add(x, y - 6 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.4, 0.8), rnd(5, 9) * sc, 2 * sc, dust, 1, 1.2, 0, rnd(-8, 8), 1000, 1.2);
        }
        this.add(x, y - 20 * sc, 0, 0, 0.3, 20 * sc, 140 * sc * big, hot, 0.6, 1, 0, 0, 0, 1.5);
        break;
      }
      /* 5.2 운명의 룬 (오딘): 아군 둘레에 룬 조각이 떠오르며 푸른 고리가 퍼진다 */
      case 'runeveil': {
        const rune = [0.54, 0.91, 1], hot = [0.92, 0.99, 1], gold = [1, 0.86, 0.45];
        for (let j = 0; j < 2; j++) for (let i = 0, n = N(28); i < n; i++) { const a = i / n * TAU;
          this.add(x + Math.cos(a) * R * (0.35 + j * 0.3), y - 4 * sc + Math.sin(a) * R * (0.09 + j * 0.07), 0, -16 * sc, 0.5 + j * 0.15, 5 * sc, 2 * sc, j ? rune : hot, 0.9, 1, 0, 0, 0, 1.4); }
        for (let i = 0, n = N(16); i < n; i++)                                                        // 떠오르는 룬 조각
          this.add(x + rnd(-R, R) * 0.6, y - rnd(0, 30) * sc, 0, -rnd(50, 110) * sc, rnd(0.6, 1.1), rnd(6, 9) * sc, rnd(3, 5) * sc, i % 3 ? rune : gold, 0.95, 0.5, rnd(-0.4, 0.4), rnd(-2, 2), 0, 1.5);
        this.add(x, y - 40 * sc, 0, 0, 0.35, R * 0.4, R * 1.2, rune, 0.35, 1, 0, 0, 0, 1.6);
        break;
      }
      /* 5.2 마신왕 지니: 남보랏빛 구슬이 터지며 금고리가 퍼지고 별가루가 소용돌이친다 */
      case 'djinnblast': {
        const vio = [0.55, 0.5, 1], gold = [1, 0.84, 0.32], hot = [0.95, 0.95, 1], cy = y - 26 * sc;
        this.add(x, cy, 0, 0, 0.25, 12 * sc, 90 * sc * big, vio, 0.75, 1, 0, 0, 0, 1.4);
        this.add(x, cy, 0, 0, 0.14, 8 * sc, 40 * sc * big, hot, 0.9, 1, 0, 0, 0, 1.2);
        for (let j = 0; j < 2; j++) for (let i = 0, n = N(20); i < n; i++) { const a = i / n * TAU;     // 금고리 두 겹 (기울어 퍼진다)
          const sp = (150 + j * 70) * sc, tilt = j ? 0.5 : -0.4;
          this.add(x, cy, Math.cos(a) * sp, (Math.sin(a) * 0.3 + Math.cos(a) * tilt * 0.3) * sp, 0.4 + j * 0.1, 6 * sc, 2 * sc, j ? gold : hot, 0.9, 1, 0, 0, 0, 1.4); }
        for (let i = 0, n = N(24); i < n; i++) {                                                     // 별가루 소용돌이
          const a = i / n * TAU, sp = rnd(80, 220) * sc;
          this.add(x + Math.cos(a) * 12 * sc, cy + Math.sin(a) * 6 * sc, Math.cos(a + 1.3) * sp, Math.sin(a + 1.3) * sp * 0.5 - 50 * sc, rnd(0.5, 0.9), rnd(4, 7) * sc, 1.5 * sc, i % 3 ? gold : hot, 1, 1, 0, rnd(-4, 4), -30, 1.5);
        }
        break;
      }
      /* 5.2 팔진도: 땅 위에 팔각 진이 빛나고, 바람 칼날이 휘돌며 불씨가 흩날린다 */
      case 'bagua': {
        const gold = [1, 0.82, 0.48], wind = [0.9, 0.96, 1], ember = [1, 0.6, 0.25];
        for (let i = 0, n = N(32); i < n; i++) { const u = i / n, side = Math.floor(u * 8), f = u * 8 - side;   // 팔각 테두리
          const a0 = side * Math.PI / 4 + Math.PI / 8, a1 = a0 + Math.PI / 4, rr = R * 0.6;
          const px = x + (Math.cos(a0) * (1 - f) + Math.cos(a1) * f) * rr, py = y - 2 * sc + (Math.sin(a0) * (1 - f) + Math.sin(a1) * f) * rr * 0.24;
          this.add(px, py, 0, -10 * sc, rnd(0.45, 0.7), 5 * sc, 2 * sc, gold, 0.95, 1, 0, 0, 0, 1.3); }
        for (let i = 0, n = N(22); i < n; i++) { const a = i / n * TAU, sp = rnd(160, 300) * sc;          // 휘도는 바람 칼날
          this.add(x + Math.cos(a) * 14 * sc, y - 26 * sc + Math.sin(a) * 8 * sc, Math.cos(a + 1.4) * sp, Math.sin(a + 1.4) * sp * 0.35, rnd(0.3, 0.5), rnd(8, 12) * sc, 2 * sc, wind, 0.85, 2.4, a + 1.4, 0, 0, 1.4); }
        for (let i = 0, n = N(12); i < n; i++) this.add(x + rnd(-R, R) * 0.4, y - rnd(10, 40) * sc, rnd(-60, 60) * sc, -rnd(60, 140) * sc, rnd(0.5, 0.9), rnd(4, 6) * sc, 2 * sc, ember, 1, 1, 0, 0, -20, 1.6);
        this.add(x, y - 24 * sc, 0, 0, 0.22, 10 * sc, 70 * sc * big, gold, 0.6, 1, 0, 0, 0, 1.4);
        break;
      }
      /* 5.2 도깨비 대왕: 금빛 방망이가 내리친 자리 — 금빛 충격 고리 · 쏟아지는 금화 · 튀는 푸른 도깨비불 */
      case 'goldbat': {
        const gold = [1, 0.84, 0.3], hot = [1, 0.98, 0.85], wisp = [0.36, 0.85, 1];
        for (let i = 0, n = N(40); i < n; i++) { const a = i / n * TAU, sp = 300 * sc * big;
          this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.26, 0.38, 14 * sc * big, 3 * sc, i % 4 ? gold : hot, 0.9, 2.2, a, 0, 0, 1.3); }
        for (let i = 0, n = N(30); i < n; i++) { const a = rnd(-Math.PI * 0.85, -Math.PI * 0.15), sp = rnd(160, 420) * sc;
          this.add(x, y - 16 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.5, 0.9), rnd(6, 9) * sc * big, rnd(4, 6) * sc, i % 3 ? gold : hot, 1, 0.55, 0, rnd(-9, 9), 900, 3); }
        for (let i = 0, n = N(6); i < n; i++) { const a = rnd(-Math.PI, 0), sp = rnd(80, 160) * sc;
          this.add(x, y - 30 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.6, 1), rnd(7, 10) * sc, 4 * sc, wisp, 0.9, 1, 0, 0, -60, 1.5); }
        this.add(x, y - 20 * sc, 0, 0, 0.25, 20 * sc, 110 * sc * big, gold, 0.7, 1, 0, 0, 0, 1.3);
        break;
      }
      /* 5.2 석화의 시선: 녹빛 섬광 · 퍼지는 잿빛 돌먼지 · 튀는 돌 조각 */
      case 'petrify': {
        const green = [0.62, 1, 0.42], hot = [0.92, 1, 0.85], stone = [0.62, 0.62, 0.58];
        this.add(x, y - 24 * sc, 0, 0, 0.22, 10 * sc, 70 * sc * big, green, 0.7, 1, 0, 0, 0, 1.4);
        this.add(x, y - 24 * sc, 0, 0, 0.12, 6 * sc, 30 * sc * big, hot, 0.9, 1, 0, 0, 0, 1.2);
        for (let i = 0, n = N(16); i < n; i++) { const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), sp = rnd(120, 300) * sc;
          this.add(x, y - 18 * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.5, 0.9), rnd(4, 7) * sc, rnd(3, 5) * sc, stone, 1, 1.2, 0, rnd(-8, 8), 900, 1.2); }
        for (let i = 0, n = N(12); i < n; i++) { const a = i / n * TAU;
          this.add(x + Math.cos(a) * R * 0.4, y - 4 * sc + Math.sin(a) * R * 0.1, Math.cos(a) * 40 * sc, -20 * sc, rnd(0.4, 0.7), rnd(5, 8) * sc, 2 * sc, i % 2 ? green : hot, 0.9, 1, 0, 0, 0, 1.5); }
        break;
      }
      /* 5.2 개틀링 탄착: 작은 금빛 불꽃 · 튀는 불티 (자주 터지니 가볍게) */
      case 'bulletpuff': {
        const gold = [1, 0.84, 0.4], hot = [1, 0.98, 0.85], cy = y - 30 * sc;
        this.add(x, cy, 0, 0, 0.1, 4 * sc, 14 * sc, hot, 0.8, 1, 0, 0, 0, 1.2);
        for (let i = 0, n = N(4); i < n; i++) { const a = rnd(-Math.PI, 0.2), sp = rnd(120, 260) * sc;
          this.add(x, cy, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.12, 0.22), rnd(4, 6) * sc, 1.4 * sc, i % 2 ? gold : hot, 1, 2, a, 0, 400, 1.4); }
        break;
      }
      /* 5.2 궁니르가 꽂힌 자리: 하얀 섬광 · 앞으로 뻗는 빛창 · 룬빛 고리 · 튀는 푸른 불티 */
      case 'gungnir': {
        const rune = [0.54, 0.91, 1], hot = [0.95, 0.99, 1], dir = opt.dir || 1, cy = y - 30 * sc, rot = dir > 0 ? 0 : Math.PI;
        this.add(x, cy, 0, 0, 0.18, 8 * sc, 60 * sc * big, hot, 0.85, 1, 0, 0, 0, 1.3);
        this.add(x, cy, 0, 0, 0.24, 5 * sc, 3 * sc, hot, 1, 18 * big, rot, 0, 0, 1.2);          // 꿰뚫고 지나가는 빛창
        this.add(x, cy, 0, 0, 0.3, 7 * sc, 5 * sc, rune, 0.7, 14 * big, rot, 0, 0, 1.4);
        for (let i = 0, n = N(20); i < n; i++) { const a = i / n * TAU;                              // 룬빛 고리 (땅 위 타원)
          this.add(x + Math.cos(a) * R * 0.55, y - 4 * sc + Math.sin(a) * R * 0.14, 0, -20 * sc, rnd(0.35, 0.55), rnd(4, 6) * sc, 2 * sc, i % 4 ? rune : hot, 0.95, 1, 0, 0, 0, 1.4); }
        for (let i = 0, n = N(16); i < n; i++) {                                                     // 튀는 푸른 불티
          const a = rnd(-Math.PI, 0), sp = rnd(160, 380) * sc;
          this.add(x, cy, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.25, 0.5), rnd(6, 10) * sc, 2 * sc, i % 2 ? rune : hot, 1, 2.2, a, 0, 420, 1.5);
        }
        break;
      }
      /* 5.2 세계수: 땅에서 솟는 빛의 뿌리 · 흩날리는 금록빛 잎 · 룬 고리 · 아홉 빛 열매 */
      case 'yggdrasil': {
        const leafC = [0.78, 0.94, 0.48], gold = [1, 0.88, 0.5], hot = [1, 1, 0.92], runeC = [0.62, 0.94, 1];
        const worlds = [[1, 0.88, 0.54], [0.62, 0.94, 1], [1, 0.6, 0.42], [0.72, 1, 0.6], [0.85, 0.69, 1], [1, 1, 1], [0.42, 0.78, 1], [1, 0.42, 0.54], [0.91, 0.88, 0.78]];
        for (let r = 0, nr = N(opt.big ? 7 : 4); r < nr; r++) {                                     // 솟는 뿌리 (구불구불 위로)
          let px = x + rnd(-R, R) * 0.5, py = y;
          const ang0 = -Math.PI / 2 + rnd(-0.5, 0.5);
          for (let i = 0; i < 7; i++) {
            const a = ang0 + Math.sin(i * 1.3 + r) * 0.5, L = (14 - i) * sc * big, nx = px + Math.cos(a) * L, ny = py + Math.sin(a) * L;
            this.add((px + nx) / 2, (py + ny) / 2, 0, 0, 0.4 + i * 0.03, L * 0.6, (4.5 - i * 0.45) * sc, i % 2 ? gold : leafC, 0.9, 1, a, 0, 0, 1.3);
            px = nx; py = ny;
          }
        }
        for (let i = 0, n = N(opt.big ? 34 : 18); i < n; i++) {                                      // 흩날리는 잎 (솟았다가 팔랑이며 떨어진다)
          const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), sp = rnd(120, 300) * sc;
          this.add(x + rnd(-R, R) * 0.4, y - rnd(10, 50) * sc, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.8, 1.4), rnd(6, 9) * sc, rnd(4, 6) * sc, i % 3 ? leafC : gold, 1, 0.55, rnd(0, 6), rnd(-6, 6), 260, 2);
        }
        for (let i = 0, n = N(22); i < n; i++) { const a = i / n * TAU;                              // 룬 고리
          this.add(x + Math.cos(a) * R * 0.6, y - 3 * sc + Math.sin(a) * R * 0.15, 0, -14 * sc, rnd(0.45, 0.7), rnd(4, 6) * sc, 2 * sc, i % 3 ? runeC : hot, 0.95, 1, 0, 0, 0, 1.4); }
        for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.08 + i * 0.105);                         // 아홉 빛 열매
          this.add(x + Math.cos(a) * R * 0.5, y - 60 * sc + Math.sin(a) * R * 0.35, 0, -20 * sc, 0.7, 6 * sc, 9 * sc, worlds[i], 0.9, 1, 0, 0, 0, 1.6); }
        this.add(x, y - 30 * sc, 0, 0, 0.3, 20 * sc, 130 * sc * big, gold, 0.6, 1, 0, 0, 0, 1.5);
        break;
      }
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
