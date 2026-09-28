/* =======================================================================
 *  막대 왕국 전쟁 - 효과음 (WebAudio 로 즉석 합성, 음원 파일 없음)
 * ======================================================================= */

const SFX = {
  ctx: null,
  master: null,
  on: true,
  ready: false,

  init: function () {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = this.makeNoise(1.0);
      this.ready = true;
    } catch (e) { this.ready = false; }
  },

  resume: function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  /* 짧은 음정 */
  tone: function (freq, dur, type, vol, slideTo) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  /* 잡음 원본을 한 번만 만들어 두고 계속 돌려 쓴다.
   * 타격마다 버퍼를 새로 채우면 그 순간 프레임이 튄다. */
  makeNoise: function (dur) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  },

  /* 잡음 (타격, 폭발) */
  noise: function (dur, freq, vol, q) {
    if (!this.on || !this.ready || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    // 매번 다른 구간에서 시작해 같은 소리로 들리지 않게 한다
    const maxOff = Math.max(0, this.noiseBuf.duration - dur - 0.02);
    const off = maxOff > 0 ? Math.random() * maxOff : 0;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq || 900, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, (freq || 900) * 0.3), t + dur);
    f.Q.value = q || 1;
    const g = this.ctx.createGain();
    // 원본은 일정한 잡음이라, 줄어드는 소리는 게인으로 만든다
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, off, dur + 0.02);
    src.stop(t + dur + 0.02);
  },

  /* --- 상황별 --- */
  ui:       function () { this.tone(520, 0.06, 'square', 0.16); },
  deploy:   function () { this.tone(320, 0.09, 'square', 0.2, 640); },
  hit:      function () { this.noise(0.07, 1400, 0.16); },
  slash:    function () { this.noise(0.09, 2600, 0.13, 4); },
  arrow:    function () { this.tone(1200, 0.06, 'triangle', 0.09, 500); },
  boom:     function () { this.noise(0.34, 700, 0.34); this.tone(90, 0.3, 'sine', 0.22, 40); },
  die:      function () { this.tone(300, 0.14, 'sawtooth', 0.12, 90); },
  bossDie:  function () { this.noise(0.6, 500, 0.4); this.tone(150, 0.5, 'sawtooth', 0.25, 45); },
  bossIn:   function () { this.tone(120, 0.5, 'sawtooth', 0.26, 260); this.noise(0.5, 400, 0.24); },
  levelUp:  function () { [523, 659, 784].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.12, 'square', 0.18), i * 70)); },
  command:  function () { [392, 523, 659, 880].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.16, 'square', 0.2), i * 60)); },
  // 음악이 켜져 있으면 관현악 팡파르·애가(BGM.sting)가 대신 울린다
  win:      function () { if (typeof BGM !== 'undefined' && BGM.vol > 0 && BGM.out) return; [523, 659, 784, 1046].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.2, 'square', 0.22), i * 130)); },
  lose:     function () { if (typeof BGM !== 'undefined' && BGM.vol > 0 && BGM.out) return; [440, 370, 294, 196].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.24, 'sawtooth', 0.18), i * 150)); },
  gold:     function () { this.tone(880, 0.06, 'square', 0.12, 1320); }
};

/* =======================================================================
 *  배경 음악 - 음원 파일 없이 즉석 합성하는 작은 오케스트라 (2.9)
 *
 *  - 악기: 현악(합주·패드·피치카토), 금관(트럼펫·호른·저음 금관), 합창,
 *          플루트·오보에, 하프, 종, 콘트라베이스, 팀파니·타이코·스네어·심벌·징·프레임 드럼
 *  - 홀 잔향(컨볼버)과 압축기를 거쳐 나간다. 잔향이 오케스트라 느낌의 절반이다.
 *  - 곡은 music.js 에 코드 진행 + 선율 + 스타일로 적는다. 스타일이 반주를 짠다.
 *  16분음표 시퀀서가 0.1초마다 깨어나 0.3초 앞까지 미리 예약한다.
 * ======================================================================= */
function bgmNote(name) {
  const m = /^([A-G])([b#]?)(\d)$/.exec(name);
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return 12 * (Number(m[3]) + 1) + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const BGM_CHORD_Q = {
  '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7],
  '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '5': [0, 7], m6: [0, 3, 7, 9], add9: [0, 4, 7, 14]
};
function bgmChord(name) {
  const m = /^([A-G][b#]?)(.*)$/.exec(name);
  if (!m || !BGM_CHORD_Q[m[2]]) return null;
  const root = bgmNote(m[1] + '3');
  return { root: root, iv: BGM_CHORD_Q[m[2]], minor: m[2] === 'm' || m[2] === 'm7' || m[2] === 'm6' || m[2] === 'dim' };
}
function bgmFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
/* 'D5*4 A4*2 .*2' → 16칸 ('*n' 은 그만큼 늘인다) */
function bgmBar(str, steps) {
  const out = [];
  for (const tok of str.trim().split(/\s+/)) {
    const m = /^([^*]+)\*(\d+)$/.exec(tok);
    if (!m) { out.push(tok); continue; }
    const n = +m[2];
    out.push(m[1]);
    for (let i = 1; i < n; i++) out.push(m[1] === '.' ? '.' : '-');
  }
  while (out.length < steps) out.push('.');
  return out.slice(0, steps);
}

/* 악기. osc: [파형, 음정 어긋남(센트)] · cut 저역 통과 · fenv 필터가 열리는 폭(금관의 '빠앙')
 * a/d/s/r 엔벌로프 · vib 비브라토 · formant 합창 모음 · pluck 튕기는 소리 */
const BGM_INST = {
  strings: { osc: [['sawtooth', -7], ['sawtooth', 7]], cut: 2400, a: 0.09, d: 0.25, s: 0.8, r: 0.3, vib: 1, gain: 0.05 },
  lowstr:  { osc: [['sawtooth', -5], ['sawtooth', 5]], cut: 1300, a: 0.03, d: 0.12, s: 0.7, r: 0.12, gain: 0.05 },
  pad:     { osc: [['sawtooth', -10], ['sawtooth', 10]], cut: 1500, a: 0.6, d: 0.4, s: 0.9, r: 1.0, vib: 1, gain: 0.024 },
  trumpet: { osc: [['sawtooth', -4], ['sawtooth', 4]], cut: 900, fenv: 2600, a: 0.04, d: 0.2, s: 0.85, r: 0.18, vib: 0.6, gain: 0.05 },
  horn:    { osc: [['sawtooth', 0], ['triangle', 3]], cut: 850, fenv: 700, a: 0.08, d: 0.3, s: 0.9, r: 0.3, vib: 0.4, gain: 0.06 },
  lowbrass:{ osc: [['sawtooth', -3], ['square', 3]], cut: 520, fenv: 900, a: 0.05, d: 0.2, s: 0.8, r: 0.2, gain: 0.055 },
  choir:   { osc: [['sawtooth', -9], ['sawtooth', 9]], formant: [720, 1180], a: 0.35, d: 0.4, s: 0.9, r: 0.7, vib: 1, gain: 0.11 },
  flute:   { osc: [['sine', 0], ['triangle', 1200]], cut: 3400, a: 0.05, d: 0.2, s: 0.85, r: 0.15, vib: 1, gain: 0.06, mix: [1, 0.25] },
  oboe:    { osc: [['sawtooth', 0], ['square', 2]], bp: 1300, a: 0.04, d: 0.2, s: 0.85, r: 0.12, vib: 1, gain: 0.07 },
  harp:    { osc: [['triangle', 0], ['sine', 1200]], cut: 2800, a: 0.004, d: 1.3, s: 0, r: 0.5, gain: 0.06, pluck: 1 },
  pizz:    { osc: [['triangle', 0], ['sawtooth', 0]], cut: 1500, a: 0.004, d: 0.25, s: 0, r: 0.1, gain: 0.07, pluck: 1, mix: [1, 0.35] },
  lute:    { osc: [['triangle', 0], ['sawtooth', 1200]], cut: 2000, a: 0.004, d: 0.7, s: 0, r: 0.3, gain: 0.06, pluck: 1, mix: [1, 0.2] },
  bass:    { osc: [['sawtooth', 0], ['sine', 0]], cut: 480, a: 0.02, d: 0.2, s: 0.8, r: 0.14, gain: 0.08 },
  bell:    { bell: 1, gain: 0.05 },
  celesta: { bell: 2, gain: 0.04 }
};

const BGM = {
  out: null, bus: null, vol: 0.5, name: null, track: null, timer: null, vib: null,
  step: 0, nextT: 0, parsed: {}, onEnd: null,

  ensure: function () {
    if (this.out || !SFX.ready) return !!this.out;
    const ctx = SFX.ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.out.connect(comp); comp.connect(ctx.destination);
    this.bus = ctx.createGain(); this.bus.gain.value = 1;
    const dry = ctx.createGain(); dry.gain.value = 0.82;
    this.bus.connect(dry); dry.connect(this.out);
    // 홀 잔향: 2.6초 동안 잦아드는 잡음으로 만든 임펄스
    try {
      const len = Math.floor(ctx.sampleRate * 2.6);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4) * (i < 240 ? i / 240 : 1);
      }
      const rev = ctx.createConvolver(); rev.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.42;
      this.bus.connect(rev); rev.connect(wet); wet.connect(this.out);
    } catch (e) { /* 잔향 없이도 돈다 */ }
    // 모든 현·관이 함께 쓰는 비브라토 (5.2Hz, ±9센트)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
    this.vib = ctx.createGain(); this.vib.gain.value = 9;
    lfo.connect(this.vib); lfo.start();
    return true;
  },

  setVolume: function (v) {
    this.vol = v;
    if (!this.out) return;
    const t = SFX.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(this.name ? v * 0.6 : 0, t, 0.08);
    if (v <= 0) this.halt();
    else if (this.name && !this.timer) this.start();
  },

  parse: function (name) {
    if (this.parsed[name]) return this.parsed[name];
    const tr = BGM_TRACKS[name];
    const steps = tr.steps || 16;
    const secs = tr.sections.map(sec => {
      const chords = sec.chords.trim().split(/\s+/).map(bgmChord);
      return Object.assign({}, sec, {
        chords: chords,
        mel: (sec.mel || []).map(b => bgmBar(b, steps)),
        cm: sec.cm ? sec.cm.map(b => bgmBar(b, steps)) : null,
        bars: chords.length
      });
    });
    const total = secs.reduce((n, s) => n + s.bars, 0);
    return (this.parsed[name] = { name: name, bpm: tr.bpm, style: tr.style, steps: steps, secs: secs,
      total: total, once: !!tr.once, swing: tr.swing || 0 });
  },

  /* 곡을 바꾼다. 같은 곡이면 그대로 둔다. */
  play: function (name, onEnd) {
    if (!BGM_TRACKS[name]) return;
    if (this.name === name && this.timer) return;
    this.name = name;
    this.onEnd = onEnd || null;
    if (!this.ensure()) return;           // 오디오가 아직 안 열렸으면 열릴 때 시작
    this.track = this.parse(name);
    this.bus.gain.setValueAtTime((typeof BGM_GAIN !== 'undefined' && BGM_GAIN[name]) || 1, SFX.ctx.currentTime);
    this.step = 0;
    this.nextT = SFX.ctx.currentTime + 0.12;
    const t = SFX.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(this.vol * 0.6, t + 0.6);
    this.start();
  },

  /* 한 번만 울리는 곡(승리·패배) */
  sting: function (name) {
    if (!BGM_TRACKS[name]) return;
    this.name = null; this.halt();
    this.play(name);
  },

  start: function () {
    if (this.timer || this.vol <= 0 || !this.track) return;
    this.timer = setInterval(() => this.tick(), 100);
    this.tick();
  },

  halt: function () {
    clearInterval(this.timer);
    this.timer = null;
  },

  stop: function (fade) {
    this.name = null;
    if (!this.out) { this.halt(); return; }
    const t = SFX.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, (fade || 0.4) / 3);
    setTimeout(() => { if (!this.name) this.halt(); }, (fade || 0.4) * 1000 + 50);
  },

  resume: function () {
    if (this.name && !this.timer) { const n = this.name; this.name = null; this.play(n); }
  },

  tick: function () {
    if (!this.track || !SFX.ctx) return;
    const ctx = SFX.ctx;
    if (ctx.state !== 'running') { this.nextT = ctx.currentTime + 0.1; return; }
    const tr = this.track;
    const dt = 60 / tr.bpm / 4;
    if (this.nextT < ctx.currentTime - 0.3) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.3) {
      if (tr.once && this.step >= tr.total * tr.steps) {
        const done = this.onEnd; this.onEnd = null;
        this.halt(); this.track = null; this.name = null;
        if (done) setTimeout(done, 1600);            // 마지막 울림이 잦아든 뒤
        return;
      }
      const swing = (this.step % 2 === 1) ? tr.swing * dt : 0;
      this.playStep(tr, this.step, this.nextT + swing, dt);
      this.nextT += dt;
      this.step++;
    }
  },

  /* 지금 몇 번째 구간의 몇 번째 마디인가 */
  where: function (tr, step) {
    let bar = Math.floor(step / tr.steps) % tr.total;
    const s = step % tr.steps;
    for (let i = 0; i < tr.secs.length; i++) {
      const sec = tr.secs[i];
      if (bar < sec.bars) return { sec: sec, si: i, bar: bar, s: s };
      bar -= sec.bars;
    }
    return { sec: tr.secs[0], si: 0, bar: 0, s: s };
  },

  playStep: function (tr, step, t, dt) {
    const w = this.where(tr, step);
    const sec = w.sec, chord = sec.chords[w.bar], s = w.s;
    const nextChord = sec.chords[(w.bar + 1) % sec.bars];
    // 선율과 대선율
    this.melody(sec.mel[w.bar], s, t, dt, sec.lead || 'strings', sec.dbl, sec.oct || 0, sec.vel || 1);
    if (sec.cm) this.melody(sec.cm[w.bar], s, t, dt, sec.cmi || 'horn', null, 0, 0.8);
    // 반주는 스타일이 짠다
    const fn = BGM_STYLES[sec.style || tr.style];
    if (fn) fn(this, { t: t, dt: dt, s: s, steps: tr.steps, bar: w.bar, bars: sec.bars, chord: chord,
                       next: nextChord, int: sec.int || 1, first: w.bar === 0, last: w.bar === sec.bars - 1,
                       sec: sec, si: w.si });
  },

  melody: function (row, s, t, dt, inst, dbl, oct, vel) {
    if (!row) return;
    const tok = row[s];
    if (!tok || tok === '-' || tok === '.') return;
    let len = 1;
    while (s + len < row.length && row[s + len] === '-') len++;
    const n = bgmNote(tok);
    if (n === null) return;
    this.note(inst, n + oct, t, len * dt, vel);
    if (dbl) this.note(dbl, n + oct - 12, t, len * dt, vel * 0.8);
  },

  /* 화음 전체를 한 악기로 */
  chordNotes: function (chord, base, spread) {
    const out = [];
    for (let i = 0; i < chord.iv.length; i++) out.push(chord.root + base + chord.iv[i] + (spread && i === 1 ? 12 : 0));
    return out;
  },

  note: function (inst, midi, t, dur, vel) {
    const I = BGM_INST[inst];
    if (!I) return;
    const ctx = SFX.ctx, f = bgmFreq(midi), v = I.gain * (vel || 1);
    if (I.bell) { this.bell(f, t, v, I.bell === 2); return; }
    const g = ctx.createGain();
    let into;
    if (I.formant) {                                   // 합창: 두 모음 대역
      into = ctx.createGain();
      for (const fq of I.formant) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 5;
        into.connect(bp); bp.connect(g);
      }
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      into.connect(lp); lp.connect(g);
    } else {
      into = ctx.createBiquadFilter();
      into.type = I.bp ? 'bandpass' : 'lowpass';
      const cut = I.bp || I.cut || 2000;
      if (I.bp) into.Q.value = 1.4;
      into.connect(g);
      if (I.fenv) {                                    // 금관: 필터가 확 열렸다 가라앉는다
        into.frequency.setValueAtTime(cut * 0.6, t);
        into.frequency.linearRampToValueAtTime(cut + I.fenv * (0.6 + 0.4 * (vel || 1)), t + I.a * 1.6);
        into.frequency.exponentialRampToValueAtTime(cut * 1.3, t + I.a * 1.6 + 0.35);
      } else into.frequency.value = cut;
    }
    const oscs = [];
    I.osc.forEach((o, i) => {
      const osc = ctx.createOscillator();
      osc.type = o[0];
      osc.frequency.setValueAtTime(f, t);
      osc.detune.value = o[1];
      if (I.vib && this.vib && dur > 0.25) this.vib.connect(osc.detune);
      if (I.mix && I.mix[i] !== 1) {
        const mg = ctx.createGain(); mg.gain.value = I.mix[i]; osc.connect(mg); mg.connect(into);
      } else osc.connect(into);
      oscs.push(osc);
    });
    // 엔벌로프
    const a = I.a, peak = v, end = t + (I.pluck ? I.d : dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (I.pluck) {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + I.d);
    } else {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * I.s), t + a + I.d);
      g.gain.setValueAtTime(Math.max(0.0002, peak * I.s), Math.max(t + a + I.d, end));
      g.gain.exponentialRampToValueAtTime(0.0001, Math.max(t + a + I.d, end) + I.r);
    }
    g.connect(this.bus);
    const stopAt = (I.pluck ? t + a + I.d : Math.max(t + a + I.d, end) + I.r) + 0.05;
    for (const o of oscs) { o.start(t); o.stop(stopAt); }
    if (I.vib && this.vib) setTimeout(() => { for (const o of oscs) { try { this.vib.disconnect(o.detune); } catch (e) {} } },
      Math.max(0, (stopAt - ctx.currentTime) * 1000 + 50));
  },

  bell: function (f, t, v, soft) {
    const ctx = SFX.ctx;
    const parts = soft ? [[1, 1, 1.2], [2, 0.3, 0.6], [4, 0.1, 0.3]] : [[1, 1, 2.2], [2.76, 0.45, 1.2], [5.4, 0.22, 0.6], [8.9, 0.1, 0.3]];
    for (const [m, a, d] of parts) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * a, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + d + 0.05);
    }
  },

  /* ---------------- 타악기 ---------------- */
  noiseHit: function (t, type, freq, q, vol, dur, off) {
    if (!SFX.noiseBuf) return;
    const ctx = SFX.ctx;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = SFX.noiseBuf;
    f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.bus);
    const len = Math.min(dur + 0.02, SFX.noiseBuf.duration - 0.01);
    src.start(t, off !== undefined ? off : Math.random() * Math.max(0, SFX.noiseBuf.duration - len), len);
    src.stop(t + len);
  },
  thump: function (t, f0, f1, vol, dur) {
    const ctx = SFX.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
  },
  timp: function (t, midi, vel) {                    // 팀파니: 음정 있는 북
    const f = bgmFreq(midi);
    this.thump(t, f * 1.02, f, 0.34 * (vel || 1), 1.1);
    this.thump(t, f * 1.5, f * 1.49, 0.08 * (vel || 1), 0.5);
    this.noiseHit(t, 'lowpass', 500, 0.7, 0.12 * (vel || 1), 0.09);
  },
  taiko: function (t, vel) {
    this.thump(t, 95, 44, 0.5 * (vel || 1), 0.55);
    this.noiseHit(t, 'bandpass', 220, 1.2, 0.2 * (vel || 1), 0.16);
  },
  frame: function (t, vel) {                          // 프레임 드럼 (사막·야영지)
    this.thump(t, 160, 95, 0.22 * (vel || 1), 0.28);
    this.noiseHit(t, 'bandpass', 900, 1.5, 0.08 * (vel || 1), 0.1);
  },
  snare: function (t, vel) {
    this.noiseHit(t, 'bandpass', 2300, 0.8, 0.16 * (vel || 1), 0.15);
    this.thump(t, 210, 170, 0.07 * (vel || 1), 0.09);
  },
  crash: function (t, vel) { this.noiseHit(t, 'highpass', 5200, 0, 0.09 * (vel || 1), 2.2); },
  hat: function (t, vel) { this.noiseHit(t, 'highpass', 8200, 0, 0.03 * (vel || 1), 0.045); },
  tamb: function (t, vel) {
    this.noiseHit(t, 'highpass', 7200, 0, 0.05 * (vel || 1), 0.09);
    this.noiseHit(t, 'bandpass', 9800, 3, 0.04 * (vel || 1), 0.12);
  },
  gong: function (t, vel) {
    const ctx = SFX.ctx;
    for (const [f, a, d] of [[92, 0.25, 4.2], [147, 0.12, 3.2], [233, 0.07, 2.4], [361, 0.04, 1.6]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f * 1.03, t); o.frequency.exponentialRampToValueAtTime(f, t + 1.2);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a * (vel || 1), t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + d + 0.05);
    }
    this.noiseHit(t, 'lowpass', 1800, 0.5, 0.1 * (vel || 1), 1.4);
  },
  /* 북 연타(크레셴도). from~to 칸 동안 32분음표 */
  roll: function (x, kind, from, to, midi) {
    if (x.s < from || x.s > to) return;
    const k = (x.s - from + 1) / (to - from + 1);
    for (let h = 0; h < 2; h++) {
      const tt = x.t + h * x.dt / 2, v = 0.25 + 0.75 * k;
      if (kind === 'timp') this.timp(tt, midi, v * 0.7); else this.snare(tt, v * 0.8);
    }
  },
  pat: function (str, s) { return str[s % str.length] === 'x'; }
};

/* =======================================================================
 *  스타일: 코드 한 마디를 받아 반주를 짠다. x = { t, dt, s, chord, int, first, last, ... }
 *  int 1 = 잔잔 · 2 = 본격 · 3 = 절정
 * ======================================================================= */
const BGM_STYLES = {
  /* 웅장한 보스곡: 16분 현 오스티나토 + 금관 + 합창 + 팀파니·타이코·심벌 */
  epic: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    const tones = [0, c.iv[1], c.iv[2], 12];
    if (x.s === 0) {
      B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 1));
      if (x.int >= 2) B.chordNotes(c, 12, false).forEach(n => B.note('choir', n + 12, x.t, 16 * d, x.int >= 3 ? 1 : 0.7));
      B.note('lowbrass', r - 12, x.t, 7 * d, x.int >= 2 ? 1 : 0.6);
      if (x.first) { B.crash(x.t, 1); if (x.int >= 3) B.gong(x.t, 0.7); }
      else if (x.int >= 3 && x.bar % 2 === 0) B.crash(x.t, 0.6);
    }
    if (x.s === 8) {
      B.note('lowbrass', r - 12 + (x.int >= 3 ? 7 : 0), x.t, 7 * d, 0.8);
      if (x.int >= 2) B.chordNotes(c, 12, false).forEach(n => B.note('horn', n, x.t, 7 * d, 0.55));
    }
    // 현 오스티나토
    B.note('lowstr', r + tones[[0, 2, 1, 2][x.s % 4]], x.t, d * 0.9, x.s % 4 === 0 ? 1 : 0.7);
    if (x.int >= 3) B.note('lowstr', r + 12 + tones[[3, 1, 2, 1][x.s % 4]], x.t, d * 0.9, 0.55);
    // 저음
    if (x.s % 2 === 0) B.note('bass', r - 12 + (x.s % 8 === 6 ? 12 : 0), x.t, d * 1.8, 1);
    // 북
    if (x.s === 0 || x.s === 8) B.timp(x.t, r - 12 + (x.s === 8 ? 7 : 0), 1);
    if (x.int >= 2 && B.pat('x..x..x.x.x...x.', x.s)) B.taiko(x.t, x.s === 0 ? 1 : 0.65);
    if (x.int >= 3 && (x.s === 4 || x.s === 12)) B.snare(x.t, 1);
    if (x.last) B.roll(x, 'timp', 10, 15, r - 12);
  },
  /* 일반 전투: 8분 현 오스티나토, 호른 화음, 스네어 백비트 */
  action: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) {
      B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 0.9));
      if (x.first) B.crash(x.t, 0.8);
    }
    if (x.int >= 2 && (x.s === 0 || x.s === 8)) B.chordNotes(c, 12, false).forEach(n => B.note('horn', n, x.t, 6 * d, 0.45));
    if (x.s % 2 === 0) B.note('lowstr', r + 12 + [0, c.iv[2], 12, c.iv[2]][(x.s / 2) % 4], x.t, d * 1.6, 0.8);
    if (x.s % 4 === 0) B.note('bass', r - 12, x.t, d * 3, 1);
    if (x.s === 0 || x.s === 10) B.taiko(x.t, 0.7);
    if (x.s === 4 || x.s === 12) B.snare(x.t, 0.8);
    if (x.int >= 2 && x.s % 2 === 1) B.hat(x.t, 0.8);
    if (x.last) B.roll(x, 'snare', 12, 15);
  },
  /* 행진: 스네어 루디먼트, 피치카토 베이스, 호른 엇박 화음 */
  march: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) {
      B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 0.8));
      if (x.bar % 2 === 0) B.crash(x.t, 0.5);
    }
    if (x.s % 4 === 0) { B.note('pizz', r, x.t, d, 1); B.note('bass', r - 12 + (x.s === 8 ? 7 : 0), x.t, d * 2, 0.8); }
    if (x.s % 8 === 4) B.chordNotes(c, 12, false).forEach(n => B.note(x.int >= 2 ? 'horn' : 'pizz', n, x.t, 2 * d, 0.45));
    if (B.pat('x.xxx.x.x.xxx.x.', x.s)) B.snare(x.t, x.s % 4 === 0 ? 0.9 : 0.45);
    if (x.s === 0 || x.s === 8) B.timp(x.t, r - 12, 0.6);
    if (x.last) B.roll(x, 'snare', 8, 15);
  },
  /* 전원: 하프 아르페지오, 부드러운 현, 피치카토 */
  pastoral: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 0.7));
    if (x.s % 2 === 0) B.note('harp', r + 12 + [0, c.iv[1], c.iv[2], 12, c.iv[2] + 12, 12, c.iv[2], c.iv[1]][(x.s / 2) % 8], x.t, d, 0.8);
    if (x.s === 0 || x.s === 8) B.note('pizz', r - 12 + (x.s === 8 ? 7 : 0), x.t, d, 1);
    if (x.int >= 2 && (x.s === 4 || x.s === 12)) B.tamb(x.t, 0.8);
    if (x.int >= 2 && x.s === 0) B.timp(x.t, r - 12, 0.4);
  },
  /* 민속 춤곡: 탬버린 · 프레임 드럼 · 류트 */
  folk: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 0.6));
    if (x.s % 4 === 0) B.note('bass', r - 12 + (x.s === 8 ? 7 : 0), x.t, d * 2, 0.8);
    if (x.s % 4 === 2) B.chordNotes(c, 12, false).forEach(n => B.note('lute', n, x.t, d, 0.5));
    if (B.pat('x..x..x.x..x..x.', x.s)) B.frame(x.t, 0.9);
    if (x.s % 2 === 1) B.tamb(x.t, 0.6);
  },
  /* 신비: 합창 패드, 하프, 종 */
  mystic: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) {
      B.chordNotes(c, 12, false).forEach(n => B.note('choir', n + 12, x.t, 16 * d, 0.8));
      B.chordNotes(c, 0, true).forEach(n => B.note('pad', n + 12, x.t, 16 * d, 0.6));
      B.note('bass', r - 12, x.t, 16 * d, 0.6);
      if (x.first) B.gong(x.t, 0.4);
    }
    if (x.s % 4 === 0) B.note('harp', r + 24 + [0, c.iv[1], c.iv[2], 12][(x.s / 4) % 4], x.t, d, 0.7);
    if (x.s === 6 || x.s === 14) B.note('celesta', r + 36 + c.iv[2], x.t, d, 0.6);
    if (x.int >= 2 && x.s === 0) B.timp(x.t, r - 12, 0.4);
  },
  /* 으스스: 낮은 현 트레몰로, 종소리, 심장 박동 같은 팀파니 */
  eerie: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) {
      B.chordNotes(c, 0, false).forEach(n => B.note('pad', n + 12, x.t, 16 * d, 0.8));
      B.note('choir', r + 24, x.t, 16 * d, 0.5);
      if (x.bar % 2 === 0) B.note('bell', r + 36, x.t, d, 0.8);
    }
    B.note('lowstr', r + (x.s % 2 ? c.iv[1] : 0), x.t, d * 0.8, 0.35);      // 트레몰로
    if (x.s === 0 || x.s === 3) B.timp(x.t, r - 12, x.s === 0 ? 0.7 : 0.4);
    if (x.int >= 2 && x.s % 4 === 2) B.note('pizz', r + 12 + c.iv[2], x.t, d, 0.7);
    if (x.int >= 2 && (x.s === 8)) B.taiko(x.t, 0.5);
  },
  /* 부족 전쟁: 타이코 · 프레임 드럼 · 낮은 현 8분 */
  tribal: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) { B.note('pad', r + 12, x.t, 16 * d, 0.8); B.note('pad', r + 19, x.t, 16 * d, 0.7); }
    if (x.s % 2 === 0) B.note('lowstr', r + (x.s % 8 === 6 ? 12 : 0), x.t, d * 1.5, 0.8);
    if (B.pat('x.x...x.x.x..xx.', x.s)) B.taiko(x.t, x.s % 8 === 0 ? 1 : 0.6);
    if (B.pat('..x...x...x..x.x', x.s)) B.frame(x.t, 0.8);
    if (x.int >= 2 && x.s === 0) B.note('lowbrass', r - 12, x.t, 12 * d, 0.8);
    if (x.s % 4 === 0) B.note('bass', r - 12, x.t, d * 3, 0.9);
  },
  /* 얼음: 첼레스타 아르페지오, 느린 현, 하프 */
  ice: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) {
      B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 0.8));
      B.note('bass', r - 12, x.t, 8 * d, 0.7);
    }
    if (x.s === 8) B.note('bass', r - 5, x.t, 8 * d, 0.6);
    if (x.s % 2 === 0) B.note('celesta', r + 24 + [0, c.iv[1], c.iv[2], 12, c.iv[2], c.iv[1], 0, c.iv[2]][(x.s / 2) % 8], x.t, d, 0.7);
    if (x.int >= 2 && x.s % 4 === 0) B.note('harp', r + 12 + c.iv[x.s / 4 % c.iv.length], x.t, d, 0.6);
    if (x.int >= 2 && (x.s === 0 || x.s === 8)) B.timp(x.t, r - 12, 0.5);
    if (x.int >= 2 && x.s % 2 === 1) B.hat(x.t, 0.5);
  },
  /* 사막: 드론, 프레임 드럼, 탬버린, 피치카토 */
  desert: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) { B.note('pad', r, x.t, 16 * d, 0.9); B.note('pad', r + 7, x.t, 16 * d, 0.8); B.note('bass', r - 12, x.t, 16 * d, 0.6); }
    if (B.pat('x..x..x...x.x...', x.s)) B.frame(x.t, x.s === 0 ? 1 : 0.7);
    if (x.s % 4 === 2) B.tamb(x.t, 0.7);
    if (x.s % 2 === 0) B.note('pizz', r + 12 + [0, 7, 12, 7, c.iv[1] + 12, 7, 12, 7][(x.s / 2) % 8], x.t, d, 0.6);
    if (x.int >= 2 && (x.s === 0 || x.s === 8)) B.taiko(x.t, 0.6);
  },
  /* 어둠·용암: 저음 금관 오스티나토, 무거운 타이코, 합창 */
  dark: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) {
      B.chordNotes(c, 0, false).forEach(n => B.note('pad', n + 12, x.t, 16 * d, 0.9));
      if (x.int >= 2) B.note('choir', r + 12, x.t, 16 * d, 0.7);
      if (x.first) B.crash(x.t, 0.7);
    }
    if (B.pat('x.x.x..xx.x.x...', x.s)) B.note('lowbrass', r - 12 + (x.s === 7 ? 3 : 0), x.t, d * 1.5, 0.8);
    if (x.s % 2 === 0) B.note('lowstr', r + (x.s % 4 === 2 ? 7 : 0), x.t, d, 0.6);
    if (B.pat('x..x..x.x.x.x..x', x.s)) B.taiko(x.t, x.s % 8 === 0 ? 1 : 0.6);
    if (x.s === 4 || x.s === 12) B.snare(x.t, 0.6);
    if (x.last) B.roll(x, 'timp', 12, 15, r - 12);
  },
  /* 병영·편성: 가벼운 피치카토와 목관 */
  light: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 0.5));
    if (x.s % 2 === 0) B.note('pizz', r + [0, 12, c.iv[2] + 12, 12][(x.s / 2) % 4], x.t, d, x.s % 4 === 0 ? 1 : 0.6);
    if (x.s % 8 === 4) B.chordNotes(c, 12, false).forEach(n => B.note('harp', n + 12, x.t, d, 0.5));
    if (x.s === 0) B.timp(x.t, r - 12, 0.25);
  },
  /* 한 번 울리는 팡파르 */
  fanfare: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) {
      B.chordNotes(c, 12, true).forEach(n => { B.note('pad', n, x.t, 16 * d, 1); B.note('horn', n, x.t, 12 * d, 0.6); });
      B.note('lowbrass', r - 12, x.t, 12 * d, 1);
      B.crash(x.t, 1); B.timp(x.t, r - 12, 1);
    }
    if (x.last && x.s === 0) B.gong(x.t, 0.4);
    if (!x.last) B.roll(x, 'timp', 12, 15, r - 12);
  },
  lament: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt;
    if (x.s === 0) {
      B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 1));
      B.note('horn', r, x.t, 14 * d, 0.6);
      B.note('bass', r - 12, x.t, 16 * d, 0.8);
      B.timp(x.t, r - 12, 0.6);
    }
  }
};

/* 효과음 크기. 0 이면 끈 것과 같다. */
SFX.setVolume = function (v) {
  this.vol = v;
  this.on = v > 0;
  if (this.master) this.master.gain.value = 0.28 * v;
};
