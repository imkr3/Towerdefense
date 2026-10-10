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
  /* 한꺼번에 울리는 소리 수를 묶어 둔다. 큰 싸움에서 노드가 수백 개 쌓이면
   * 오디오 스레드가 밀려 소리가 지직거리고 끊긴다. */
  voices: [],
  slot: function (dur) {
    const t = this.ctx.currentTime, v = this.voices;
    for (let i = v.length - 1; i >= 0; i--) if (v[i] <= t) v.splice(i, 1);
    if (v.length >= SFX_MAX_VOICES) return false;
    v.push(t + dur + 0.03);
    return true;
  },

  tone: function (freq, dur, type, vol, slideTo) {
    if (!this.on || !this.ready || !this.slot(dur)) return;
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
    if (!this.on || !this.ready || !this.noiseBuf || !this.slot(dur)) return;
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
  // 3.5: 함성(rally)·불굴 부활. 엔진은 예전부터 불렀지만 소리가 없었다
  rally:    function () { [440, 587, 784].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.14, 'triangle', 0.2, f * 1.06), i * 55)); },
  command:  function () { [392, 523, 659, 880].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.16, 'square', 0.2), i * 60)); },
  // 음악이 켜져 있으면 관현악 팡파르·애가(BGM.sting)가 대신 울린다
  win:      function () { if (typeof BGM !== 'undefined' && BGM.vol > 0 && BGM.out) return; [523, 659, 784, 1046].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.2, 'square', 0.22), i * 130)); },
  lose:     function () { if (typeof BGM !== 'undefined' && BGM.vol > 0 && BGM.out) return; [440, 370, 294, 196].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.24, 'sawtooth', 0.18), i * 150)); },
  gold:     function () { this.tone(880, 0.06, 'square', 0.12, 1320); }
};

/* 동시에 울릴 수 있는 효과음 수 (같은 소리 솎아내기는 game.js 의 sfx 가 한다) */
const SFX_MAX_VOICES = 14;

/* =======================================================================
 *  배경 음악 - 음원 파일 없이 즉석 합성하는 작은 오케스트라 (2.9)
 *
 *  - 악기: 현악(합주·패드·피치카토), 금관(트럼펫·호른·저음 금관), 합창,
 *          플루트·오보에, 하프, 종, 콘트라베이스, 팀파니·타이코·스네어·심벌·징·프레임 드럼
 *  - 홀 잔향(컨볼버)과 압축기를 거쳐 나간다. 잔향이 오케스트라 느낌의 절반이다.
 *  - 곡은 music.js 에 코드 진행 + 선율 + 스타일로 적는다. 스타일이 반주를 짠다.
 *  곡은 처음 부를 때 뒤에서 한 번 녹음(OfflineAudioContext)해 두고, 그 버퍼를 되풀이해 튼다.
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
/* 일그러짐 곡선 (tanh). 세기마다 한 번만 만든다 */
const _bgmDrive = {};
function bgmDrive(k) {
  if (_bgmDrive[k]) return _bgmDrive[k];
  const n = 1024, c = new Float32Array(n), norm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
  return (_bgmDrive[k] = c);
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
  lowstr:  { osc: [['sawtooth', 0]], cut: 1300, a: 0.03, d: 0.12, s: 0.7, r: 0.12, gain: 0.05 },
  pad:     { osc: [['sawtooth', -10], ['sawtooth', 10]], cut: 1500, a: 0.6, d: 0.4, s: 0.9, r: 1.0, vib: 1, gain: 0.024 },
  trumpet: { osc: [['sawtooth', -4], ['sawtooth', 4]], cut: 900, fenv: 2600, a: 0.04, d: 0.2, s: 0.85, r: 0.18, vib: 0.6, gain: 0.05 },
  horn:    { osc: [['sawtooth', 0], ['triangle', 3]], cut: 850, fenv: 700, a: 0.08, d: 0.3, s: 0.9, r: 0.3, vib: 0.4, gain: 0.06 },
  lowbrass:{ osc: [['sawtooth', 0]], cut: 520, fenv: 900, a: 0.05, d: 0.2, s: 0.8, r: 0.2, gain: 0.055 },
  choir:   { osc: [['sawtooth', 0]], formant: [720, 1180], a: 0.35, d: 0.4, s: 0.9, r: 0.7, vib: 1, gain: 0.11 },
  flute:   { osc: [['sine', 0], ['triangle', 1200]], cut: 3400, a: 0.05, d: 0.2, s: 0.85, r: 0.15, vib: 1, gain: 0.06, mix: [1, 0.25] },
  oboe:    { osc: [['sawtooth', 0], ['square', 2]], bp: 1300, a: 0.04, d: 0.2, s: 0.85, r: 0.12, vib: 1, gain: 0.07 },
  harp:    { osc: [['triangle', 0]], cut: 2800, a: 0.004, d: 1.3, s: 0, r: 0.5, gain: 0.06, pluck: 1 },
  pizz:    { osc: [['sawtooth', 0]], cut: 1100, a: 0.004, d: 0.25, s: 0, r: 0.1, gain: 0.06, pluck: 1 },
  lute:    { osc: [['triangle', 0], ['sawtooth', 1200]], cut: 2000, a: 0.004, d: 0.7, s: 0, r: 0.3, gain: 0.06, pluck: 1, mix: [1, 0.2] },
  bass:    { osc: [['sawtooth', 0]], cut: 480, a: 0.02, d: 0.2, s: 0.8, r: 0.14, gain: 0.08 },
  bell:    { bell: 1, gain: 0.05 },
  // 3.20 배틀 록: 일그러진 기타(drive = 웨이브셰이퍼) · 밝은 신스 · 신스 베이스
  gtr:     { osc: [['sawtooth', -6], ['sawtooth', 6], ['square', -1200]], drive: 7, cut: 4200, a: 0.005, d: 0.16, s: 0.75, r: 0.08, gain: 0.06, mix: [1, 1, 0.5] },
  gtrlead: { osc: [['sawtooth', -5], ['sawtooth', 5]], drive: 4, cut: 5200, a: 0.01, d: 0.2, s: 0.85, r: 0.16, vib: 1, gain: 0.065 },
  synlead: { osc: [['square', 0], ['sawtooth', 1200]], cut: 6400, a: 0.004, d: 0.12, s: 0.65, r: 0.1, vib: 0.6, gain: 0.042, mix: [1, 0.4] },
  sbass:   { osc: [['sawtooth', 0], ['square', -1200]], cut: 650, fenv: 1400, a: 0.004, d: 0.16, s: 0.55, r: 0.06, gain: 0.05 },
  celesta: { bell: 2, gain: 0.04 }
};

/* 2.9.1: 곡을 실시간으로 연주하지 않는다. 처음 부를 때 한 번만 OfflineAudioContext 로
 * 뒤에서 녹음해 두고(버퍼), 그 버퍼를 되풀이해 튼다. 연주 중 CPU 를 거의 쓰지 않고,
 * 화면이 잠깐 멈춰도 소리가 끊기지 않는다. 잔향 꼬리는 곡 앞에 겹쳐 이음매 없이 돈다. */
const BGM_RATE = 22050;        // 배경음 녹음 품질 (모노)
const BGM_TAIL = 2.2;          // 잔향 꼬리
const BGM_CACHE = 7;           // 기억해 두는 곡 수
const BGM_GROUP = 6;           // 음 합성 묶음 크기

const BGM = {
  out: null, vol: 0.5, name: null, onEnd: null,
  parsed: {}, cache: {}, lru: [], queue: [], busy: false, waiters: {},
  src: null, srcGain: null,
  // 녹음 중에만 쓰는 그래프
  ac: null, bus: null, vib: null, noise: null,

  ensure: function () {
    if (this.out || !SFX.ready) return !!this.out;
    this.out = SFX.ctx.createGain();
    this.out.gain.value = this.vol * 0.6;
    this.out.connect(SFX.ctx.destination);
    return true;
  },

  setVolume: function (v) {
    const was = this.vol;
    this.vol = v;
    if (!this.out) return;
    this.out.gain.setTargetAtTime(v * 0.6, SFX.ctx.currentTime, 0.08);
    if (was <= 0 && v > 0 && this.name && !this.src) this.resume();
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

  /* ---------------- 녹음 ---------------- */
  graph: function (ac, gain, wetMix) {
    this.ac = ac;
    const out = ac.createDynamicsCompressor();
    out.threshold.value = -16; out.ratio.value = 3.5; out.attack.value = 0.01; out.release.value = 0.25;
    out.connect(ac.destination);
    this.bus = ac.createGain(); this.bus.gain.value = gain;
    const dry = ac.createGain(); dry.gain.value = 0.82;
    this.bus.connect(dry); dry.connect(out);
    const len = Math.floor(ac.sampleRate * 1.9);            // 홀 잔향 (모노, 1.9초)
    const ir = ac.createBuffer(1, len, ac.sampleRate), d = ir.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4) * (i < 120 ? i / 120 : 1);
    const rev = ac.createConvolver(); rev.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = wetMix === undefined ? 0.42 : wetMix;   // 3.20: 록 곡은 잔향을 줄여 또렷하게
    this.bus.connect(rev); rev.connect(wet); wet.connect(out);
    const lfo = ac.createOscillator(); lfo.frequency.value = 5.2;
    this.vib = ac.createGain(); this.vib.gain.value = 9;
    lfo.connect(this.vib); lfo.start();
    const nlen = ac.sampleRate, nb = ac.createBuffer(1, nlen, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
  },

  render: function (name) {
    const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC) return Promise.reject(new Error('no offline audio'));
    return this.makeKit().then(() => this.renderTrack(name, AC));
  },
  renderTrack: function (name, AC) {
    const tr = this.parse(name);
    const dt = 60 / tr.bpm / 4, steps = tr.total * tr.steps;
    const SR = BGM_RATE, loopLen = Math.round(steps * dt * SR), total = loopLen + Math.round(BGM_TAIL * SR);
    // 1) 악보를 훑어 칠 음만 받아 적는다 (노드는 아직 만들지 않는다)
    const ev = [];
    this.rec = ev;
    try { for (let st = 0; st < steps; st++) this.playStep(tr, st, st * dt + ((st % 2) ? tr.swing * dt : 0), dt); }
    finally { this.rec = null; }
    // 2) 서로 다른 음만 합성한다 (보스곡은 같은 음이 네 번꼴로 되풀이된다).
    //    오프라인 녹음은 아직 안 울린 노드까지 매 순간 계산하므로, 몇 음씩 작은 묶음으로 나눠 녹음한다.
    const groups = [];
    const bank = new Map();
    for (const e of ev) {
      if (!e.key) continue;
      let b = bank.get(e.key);
      if (!b) {
        let g = groups[groups.length - 1];
        if (!g || g.notes.length >= BGM_GROUP) groups.push(g = { notes: [], len: 0, data: null });
        b = { e: e, g: g, at: g.len, len: Math.round(this.noteLen(e.inst, e.dur) * SR) };
        g.notes.push(b); g.len += b.len + 64;
        bank.set(e.key, b);
      }
      e.slot = b;
    }
    const keep = { ac: this.ac, bus: this.bus, vib: this.vib, noise: this.noise };
    const renderGroup = g => {
      const gac = new AC(1, Math.max(1, g.len), SR);
      try {
        this.ac = gac; this.bus = gac.createGain(); this.bus.connect(gac.destination);
        const lfo = gac.createOscillator(); lfo.frequency.value = 5.2;
        this.vib = gac.createGain(); this.vib.gain.value = 9; lfo.connect(this.vib); lfo.start();
        g.notes.forEach(b => this.voice(b.e.inst, b.e.midi, b.at / SR, b.e.dur, b.e.rv));
      } finally { Object.assign(this, keep); }
      return gac.startRendering().then(buf => { g.data = buf.getChannelData(0); });
    };
    return groups.reduce((p, g) => p.then(() => renderGroup(g)), Promise.resolve()).then(() => {
      // 3) 받아 적은 대로 표본을 제자리에 섞는다 (그냥 더하기라 빠르다)
      const dry = new Float32Array(total);
      const late = [];
      for (const e of ev) {
        const at = Math.round(e.t * SR);
        let d, off, n;
        if (e.slot) { d = e.slot.g.data; off = e.slot.at; n = e.slot.len; }
        else if (e.buf) { d = e.buf.getChannelData(0); off = 0; n = d.length; }
        else { late.push(e); continue; }
        n = Math.min(n, total - at, d.length - off);
        for (let i = 0; i < n; i++) dry[at + i] += d[off + i] * e.g;
      }
      // 4) 섞은 소리에 잔향·압축만 입힌다
      const ac = new AC(1, total, SR);
      const keep2 = { ac: this.ac, bus: this.bus, vib: this.vib, noise: this.noise };
      try {
        this.graph(ac, (typeof BGM_GAIN !== 'undefined' && BGM_GAIN[name]) || 1, BGM_TRACKS[name].wet);
        const dbuf = ac.createBuffer(1, total, SR);
        dbuf.getChannelData(0).set(dry);
        const s = ac.createBufferSource(); s.buffer = dbuf; s.connect(this.bus); s.start(0);
        for (const e of late) this.synth[e.fn].call(this, e.t, e.a, e.b);   // 북 표본이 없을 때만
      } finally { Object.assign(this, keep2); }
      return ac.startRendering();
    }).then(buf => {
        // 3.20: 부드러운 리미터 — 0.9 를 넘는 순간(록 곡의 킥이 겹칠 때)만 둥글게 눌러 1 을 넘지 않게 한다
        const pk = buf.getChannelData(0);
        for (let i = 0; i < pk.length; i++) {
          const v = pk[i], a = v < 0 ? -v : v;
          if (a > 0.9) pk[i] = (v < 0 ? -1 : 1) * (0.9 + 0.1 * Math.tanh((a - 0.9) / 0.1));
        }
        if (tr.once) return buf;
        // 꼬리를 앞에 겹쳐 되풀이 이음매를 없앤다
        const d = buf.getChannelData(0), out = SFX.ctx.createBuffer(1, loopLen, BGM_RATE), o = out.getChannelData(0);
        o.set(d.subarray(0, loopLen));
        for (let i = loopLen; i < d.length; i++) o[i - loopLen] += d[i];
        return out;
      });
  },

  /* 곡 버퍼를 달라. 없으면 줄을 세워 하나씩 녹음한다 (urgent 면 맨 앞에) */
  want: function (name, urgent) {
    if (this.cache[name]) { this.touch(name); return Promise.resolve(this.cache[name]); }
    if (!this.waiters[name]) {
      this.waiters[name] = [];
      if (urgent) this.queue.unshift(name); else this.queue.push(name);
      this.pump();
    } else if (urgent) {
      const i = this.queue.indexOf(name);
      if (i > 0) { this.queue.splice(i, 1); this.queue.unshift(name); }
    }
    return new Promise((res, rej) => this.waiters[name].push([res, rej]));
  },
  prefetch: function (names) {
    if (!SFX.ready || this.vol <= 0) return;
    for (const n of names) if (n && BGM_TRACKS[n] && !this.cache[n] && !this.waiters[n]) this.want(n, false).catch(() => {});
  },
  pump: function () {
    if (this.busy || !this.queue.length || !SFX.ready) return;
    const name = this.queue.shift();
    this.busy = true;
    const done = (err, buf) => {
      this.busy = false;
      const ws = this.waiters[name] || []; delete this.waiters[name];
      if (buf) { this.cache[name] = buf; this.touch(name); }
      ws.forEach(([res, rej]) => err ? rej(err) : res(buf));
      setTimeout(() => this.pump(), 30);
    };
    this.render(name).then(buf => done(null, buf), err => done(err));
  },
  touch: function (name) {
    this.lru = this.lru.filter(n => n !== name); this.lru.push(name);
    while (this.lru.length > BGM_CACHE) {
      const old = this.lru.shift();
      if (old !== this.name) delete this.cache[old]; else this.lru.push(old);
      if (this.lru.length <= BGM_CACHE) break;
    }
  },

  /* ---------------- 재생 ---------------- */
  play: function (name, onEnd) {
    if (!BGM_TRACKS[name]) return;
    if (this.name === name && (this.src || this.waiters[name])) return;
    this.name = name;
    this.onEnd = onEnd || null;
    if (!this.ensure() || this.vol <= 0) return;           // 오디오가 열리거나 소리를 켜면 그때
    this.want(name, true).then(buf => { if (this.name === name) this.startBuffer(buf, name); }).catch(() => {});
  },

  startBuffer: function (buf, name) {
    const ctx = SFX.ctx, t = ctx.currentTime;
    this.fadeOut(0.5);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    src.loop = !BGM_TRACKS[name].once;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.5);
    src.connect(g); g.connect(this.out);
    src.start(t + 0.02);
    if (!src.loop) src.onended = () => {
      if (this.src !== src) return;
      this.src = null; this.srcGain = null;
      if (this.name === name) this.name = null;
      const done = this.onEnd; this.onEnd = null;
      if (done) done();
    };
    this.src = src; this.srcGain = g;
  },

  fadeOut: function (fade) {
    if (!this.src) return;
    const ctx = SFX.ctx, t = ctx.currentTime, src = this.src, g = this.srcGain;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    try { src.stop(t + fade + 0.05); } catch (e) { /* 이미 멈춤 */ }
    this.src = null; this.srcGain = null;
  },

  /* 한 번만 울리는 곡(승리·패배) */
  sting: function (name) {
    if (!BGM_TRACKS[name]) return;
    this.name = null;
    this.play(name);
  },

  stop: function (fade) {
    this.name = null;
    if (this.out) this.fadeOut(fade || 0.4);
  },

  /* 오디오가 뒤늦게 열렸을 때 미뤄 둔 곡을 튼다 */
  resume: function () {
    if (this.name && !this.src) { const n = this.name; this.name = null; this.play(n, this.onEnd); }
    this.pump();
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

  /* 녹음 중에는 음을 적어만 둔다. 같은 음은 나중에 한 번만 합성해 되풀이해 쓴다 */
  note: function (inst, midi, t, dur, vel) {
    const I = BGM_INST[inst];
    if (!I) return;
    vel = vel || 1;
    if (!this.rec) return this.voice(inst, midi, t, dur, vel);
    const rv = I.fenv ? Math.round(vel * 10) / 10 || 0.1 : 1;   // 금관은 세기에 따라 음색이 바뀐다
    this.rec.push({ key: inst + '|' + midi + '|' + dur.toFixed(3) + '|' + rv,
                    inst: inst, midi: midi, dur: dur, rv: rv, t: t, g: vel / rv });
  },
  noteLen: function (inst, dur) {
    const I = BGM_INST[inst];
    if (I.bell) return (I.bell === 2 ? 1.2 : 2.2) + 0.05;
    return (I.pluck ? I.a + I.d : Math.max(I.a + I.d, dur) + I.r) + 0.05;
  },

  voice: function (inst, midi, t, dur, vel) {
    const I = BGM_INST[inst];
    const ctx = this.ac, f = bgmFreq(midi), v = I.gain * (vel || 1);
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
    if (I.drive) {                                   // 일그러짐: 진동기 → 웨이브셰이퍼 → 필터
      const ws = ctx.createWaveShaper(); ws.curve = bgmDrive(I.drive); ws.oversample = 'none';
      ws.connect(into); into = ws;
    }
    const oscs = [];
    I.osc.forEach((o, i) => {
      const osc = ctx.createOscillator();
      osc.type = o[0];
      osc.frequency.setValueAtTime(f, t);
      osc.detune.value = o[1];
      if (I.vib && this.vib && dur > 0.6) this.vib.connect(osc.detune);
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
  },

  bell: function (f, t, v, soft) {
    const ctx = this.ac;
    const parts = soft ? [[1, 1, 1.2], [2, 0.3, 0.6], [4, 0.1, 0.3]] : [[1, 1, 2.2], [2.76, 0.45, 1.2], [5.4, 0.22, 0.6], [8.9, 0.1, 0.3]];
    for (const [m, a, d] of parts) {
      if (f * m > ctx.sampleRate * 0.45) continue;           // 나이퀴스트 위 배음은 안 들림
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
    if (!this.noise) return;
    const ctx = this.ac;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise;
    f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.bus);
    const len = Math.min(dur + 0.02, this.noise.duration - 0.01);
    src.start(t, off !== undefined ? off : Math.random() * Math.max(0, this.noise.duration - len), len);
    src.stop(t + len);
  },
  thump: function (t, f0, f1, vol, dur) {
    const ctx = this.ac;
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
  kick: function (t, vel) {                          // 3.20 록 킥: 짧고 단단한 저음 + 딸깍
    this.thump(t, 160, 50, 0.48 * (vel || 1), 0.24);
    this.noiseHit(t, 'highpass', 2800, 0, 0.07 * (vel || 1), 0.012);
  },
  clap: function (t, vel) {                          // 3.20 박수: 짧은 잡음 세 번 + 꼬리
    for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.011, 'bandpass', 1350, 0.9, 0.12 * (vel || 1), 0.03);
    this.noiseHit(t + 0.033, 'bandpass', 1300, 0.8, 0.1 * (vel || 1), 0.14);
  },
  crash: function (t, vel) { this.noiseHit(t, 'highpass', 5200, 0, 0.09 * (vel || 1), 2.2); },
  hat: function (t, vel) { this.noiseHit(t, 'highpass', 8200, 0, 0.03 * (vel || 1), 0.045); },
  tamb: function (t, vel) {
    this.noiseHit(t, 'highpass', 7200, 0, 0.05 * (vel || 1), 0.09);
    this.noiseHit(t, 'bandpass', 9800, 3, 0.04 * (vel || 1), 0.12);
  },
  gong: function (t, vel) {
    const ctx = this.ac;
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

/* 북 소리는 처음 한 번만 합성해 짧은 표본으로 두고, 곡을 녹음할 때는 그 표본을 튼다.
 * 타악기가 곡 녹음 시간의 절반 가까이를 먹던 것을 줄인다. */
const BGM_DRUM_KEYS = ['timp', 'taiko', 'frame', 'snare', 'crash', 'hat', 'tamb', 'gong', 'kick', 'clap'];
BGM.synth = {};
BGM_DRUM_KEYS.forEach(k => {
  BGM.synth[k] = BGM[k];
  BGM[k] = function (t, a, b) {
    const vel = (k === 'timp' ? b : a) || 1;
    const buf = this.kit && this.kit[k === 'timp' ? 'timp' + Math.round(a) : k];
    if (this.rec) { this.rec.push(buf ? { buf: buf, t: t, g: vel } : { fn: k, t: t, a: a, b: b }); return; }
    if (!buf) return this.synth[k].call(this, t, a, b);
    const src = this.ac.createBufferSource(), g = this.ac.createGain();
    src.buffer = buf; g.gain.value = vel;
    src.connect(g); g.connect(this.bus); src.start(t);
  };
});
BGM.makeKit = function () {
  if (this.kitP) return this.kitP;
  const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const jobs = [['taiko', 0.6], ['frame', 0.35], ['snare', 0.2], ['crash', 2.3], ['hat', 0.08], ['tamb', 0.15], ['gong', 4.3], ['kick', 0.35], ['clap', 0.2]];
  for (let m = 28; m <= 64; m++) jobs.push(['timp' + m, 1.2, m]);
  const kit = {};
  const noiseAc = new AC(1, BGM_RATE, BGM_RATE), noise = noiseAc.createBuffer(1, BGM_RATE, BGM_RATE), nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  this.kitP = jobs.reduce((p, [key, len, midi]) => p.then(() => {
    const ac = new AC(1, Math.ceil(len * BGM_RATE), BGM_RATE);
    const saved = { ac: this.ac, bus: this.bus, noise: this.noise };
    this.ac = ac; this.bus = ac.createGain(); this.bus.connect(ac.destination); this.noise = noise;
    try { if (midi) this.synth.timp.call(this, 0, midi, 1); else this.synth[key].call(this, 0, 1); }
    finally { Object.assign(this, saved); }
    return ac.startRendering().then(buf => { kit[key] = buf; });
  }), Promise.resolve()).then(() => { this.kit = kit; }, () => { this.kit = null; });
  return this.kitP;
};

/* =======================================================================
 *  스타일: 코드 한 마디를 받아 반주를 짠다. x = { t, dt, s, chord, int, first, last, ... }
 *  int 1 = 잔잔 · 2 = 본격 · 3 = 절정
 * ======================================================================= */
const BGM_STYLES = {
  /* 3.20 배틀 록: '왜 이렇게 차분하냐' — 관현악 위주를 갈아엎었다. 일그러진 기타 파워코드 8분 · 신스 베이스 ·
   * 킥 4박 · 박수 스네어 · 하이햇 16분 · 신스 아르페지오 · 금관 찌르기. 팀파니 · 타이코 · 합창은 절정에만 얹어 웅장함을 남긴다. */
  rock: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt, I = x.int;
    const t3 = c.iv[1], t5 = c.iv[2];
    const pw = [r - 12, r - 5, r];                               // 파워코드: 근음 · 5도 · 옥타브
    if (x.s === 0) {
      B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 0.3));
      if (I >= 3) B.chordNotes(c, 12, false).forEach(n => B.note('choir', n + 12, x.t, 16 * d, 0.6));
      if (x.first) { B.crash(x.t, 1); if (I >= 3) B.gong(x.t, 0.5); }
      else if (I >= 3 || (I >= 2 && x.bar % 2 === 0)) B.crash(x.t, 0.75);
    }
    // 기타: 세기 1 은 길게 울리는 파워코드, 2~3 은 8분으로 몰아치는 뮤트 · 마디 머리는 크게 내려친다
    if (I <= 1) { if (x.s === 0 || x.s === 8) pw.forEach(n => B.note('gtr', n, x.t, 7 * d, 0.8)); }
    else {
      const hit = B.pat('x.x.xxx.x.x.x.xx', x.s);
      if (hit) {
        const big = x.s === 0 || (I >= 3 && x.s === 8);
        pw.forEach(n => B.note('gtr', n, x.t, (big ? 3 : 0.8) * d, big ? 1 : 0.75));
      }
    }
    // 신스 베이스: 8분 옥타브 (절정은 16분)
    if (I >= 3 || x.s % 2 === 0) B.note('sbass', r - 12 + ((x.s >> (I >= 3 ? 0 : 1)) % 2 ? 12 : 0), x.t, d * (I >= 3 ? 0.9 : 1.7), x.s % 4 === 0 ? 1 : 0.75);
    // 신스 아르페지오: 16분으로 화음을 두 옥타브 오르내린다
    if (I >= 2) B.note('synlead', r + 24 + [0, t3, t5, 12, t3 + 12, t5 + 12, 24, t5 + 12, 12, t5, t3, 0, t3, t5, 12, t5][x.s], x.t, d * 0.8, I >= 3 ? 0.55 : 0.42);
    // 금관 찌르기
    if (I >= 2 && B.pat('...x..x...x...x.', x.s)) {
      B.chordNotes(c, 12, false).forEach(n => B.note('horn', n, x.t, d, 0.5));
      B.note('trumpet', r + 24 + t5, x.t, d, 0.6);
    }
    // 북
    if (B.pat(I >= 3 ? 'x..xx...x..xx.x.' : I >= 2 ? 'x...x...x...x.x.' : 'x...x...x...x...', x.s)) B.kick(x.t, x.s % 8 === 0 ? 1 : 0.85);
    if (x.s === 4 || x.s === 12) { B.snare(x.t, 0.9); B.clap(x.t, 0.9); }
    if (I >= 3 && (x.s === 14 || x.s === 15)) B.snare(x.t, 0.45);
    B.hat(x.t, I >= 2 ? (x.s % 4 === 2 ? 1.1 : 0.55) : (x.s % 2 === 0 ? 0.6 : 0));
    if (I >= 2 && (x.s === 0 || x.s === 8)) B.timp(x.t, r - 12 + (x.s === 8 ? 7 : 0), 0.8);
    if (I >= 3 && (x.s === 0 || x.s === 8)) B.taiko(x.t, 0.8);
    if (x.last) B.roll(x, I >= 3 ? 'snare' : 'timp', 12, 15, r - 12);
  },
  /* 3.17 보스곡 리믹스: '장엄하고 짜릿하고 빠르게, 악기 많이'.
   * epic 위에 금관 엇박 찌르기 · 두 옥타브 현 16분 · 8분 저음 · 하프 상행 아르페지오 · 플루트 대선율 ·
   * 첼레스타 반짝임 · 스네어 장식음 · 하이햇 16분 · 탬버린을 더 얹는다. 세기(int)가 오를수록 겹이 늘어난다. */
  grand: function (B, x) {
    const c = x.chord, r = c.root, d = x.dt, I = x.int;
    const t3 = c.iv[1], t5 = c.iv[2];
    if (x.s === 0) {
      B.chordNotes(c, 12, true).forEach(n => B.note('pad', n, x.t, 16 * d, 1));
      B.chordNotes(c, 12, false).forEach(n => B.note('choir', n + 12, x.t, 16 * d, I >= 3 ? 1 : (I >= 2 ? 0.8 : 0.5)));
      B.note('lowbrass', r - 12, x.t, 6 * d, I >= 2 ? 1 : 0.7);
      if (x.first) { B.crash(x.t, 1); if (I >= 2) B.gong(x.t, I >= 3 ? 0.8 : 0.5); }
      else if (I >= 2 && x.bar % 2 === 0) B.crash(x.t, 0.7);
    }
    // 금관 찌르기: 엇박으로 몰아친다 (호른 화음 + 트럼펫 꼭대기)
    if (I >= 2 && B.pat('x..x..x...x.x...', x.s)) {
      const v = x.s === 0 ? 0.75 : 0.55;
      B.chordNotes(c, 12, false).forEach(n => B.note('horn', n, x.t, 1.5 * d, v));
      B.note('trumpet', r + 24 + t5, x.t, 1.5 * d, v * (I >= 3 ? 0.9 : 0.7));
      B.note('lowbrass', r - 12 + (x.s === 6 ? 7 : 0), x.t, 1.5 * d, v);
    }
    // 현 16분 오스티나토: 낮은 현 + 한 옥타브 위 (세기 3 은 두 옥타브 위까지)
    const ost = [0, t5, 12, t5];
    B.note('lowstr', r + ost[x.s % 4], x.t, d * 0.9, x.s % 4 === 0 ? 1 : 0.7);
    if (I >= 2) B.note('lowstr', r + 12 + [12, t5, t3, t5][x.s % 4], x.t, d * 0.9, 0.6);
    if (I >= 3) B.note('lowstr', r + 24 + [t3, t5, 12, t5][x.s % 4], x.t, d * 0.9, 0.45);
    // 8분 저음
    if (x.s % 2 === 0) B.note('bass', r - 12 + (x.s % 4 === 2 ? 12 : 0), x.t, d * 1.8, x.s % 4 === 0 ? 1 : 0.75);
    // 하프: 마디 뒤 절반에 화음을 두 옥타브 타고 오른다
    if (I >= 2 && x.s >= 8) {
      const up = [0, t3, t5, 12, 12 + t3, 12 + t5, 24, 24 + t3];
      B.note('harp', r + 12 + up[x.s - 8], x.t, d, 0.55 + (x.s - 8) * 0.04);
    }
    // 플루트 대선율: 높은 화음음을 8분으로 (세기 3)
    if (I >= 3 && x.s % 2 === 1) B.note('flute', r + 24 + [12, t5, t3 + 12, t5, 12, t5 + 12, t3 + 12, t5][(x.s - 1) / 2], x.t, d * 1.6, 0.5);
    // 첼레스타 반짝임
    if (I >= 2 && (x.s === 6 || x.s === 14)) B.note('celesta', r + 36 + (x.s === 6 ? t5 : 12), x.t, d, 0.55);
    // 북: 팀파니 · 타이코 · 스네어(장식음) · 하이햇 · 탬버린
    if (x.s === 0 || x.s === 8) B.timp(x.t, r - 12 + (x.s === 8 ? 7 : 0), 1);
    if (B.pat('x..x..x.x.x...x.', x.s)) B.taiko(x.t, x.s === 0 ? 1 : (I >= 2 ? 0.7 : 0.5));
    if (I >= 2 && (x.s === 4 || x.s === 12)) B.snare(x.t, 1);
    if (I >= 3 && B.pat('.......x.....x.x', x.s)) B.snare(x.t, 0.45);
    if (I >= 2) B.hat(x.t, x.s % 4 === 2 ? 1 : 0.55);
    if (I >= 3 && x.s % 4 === 2) B.tamb(x.t, 0.7);
    if (x.last) B.roll(x, I >= 3 ? 'snare' : 'timp', 10, 15, r - 12);
  },
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
