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
  win:      function () { [523, 659, 784, 1046].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.2, 'square', 0.22), i * 130)); },
  lose:     function () { [440, 370, 294, 196].forEach((f, i) =>
                setTimeout(() => this.tone(f, 0.24, 'sawtooth', 0.18), i * 150)); },
  gold:     function () { this.tone(880, 0.06, 'square', 0.12, 1320); }
};

/* =======================================================================
 *  배경 음악 - 역시 음원 파일 없이 즉석 합성한다.
 *
 *  16분음표 단위 시퀀서. 0.1초마다 깨어나 앞으로 0.3초 분량의 음을 미리
 *  예약한다(WebAudio 시계로 예약하므로 프레임이 튀어도 박자가 밀리지 않는다).
 *  곡마다 코드 진행 · 선율 · 베이스 · 북 패턴만 글로 적어 둔다.
 * ======================================================================= */
const BGM_TRACKS = {
  // 타이틀: 느린 단조, 류트 같은 선율
  title: { bpm: 76, style: 'calm', chords: ['Dm', 'C', 'Bb', 'A'], lead: [
    'D5 - - - A4 - - - F4 - G4 - A4 - - -',
    'G4 - - - E4 - - - C4 - D4 - E4 - - -',
    'F4 - - - D4 - F4 - A4 - - - G4 - F4 -',
    'E4 - - - - - - - . . . . . . . .'] },
  // 진군도·병영: 밝은 행진
  map: { bpm: 104, style: 'march', chords: ['G', 'D', 'Em', 'D', 'C', 'G', 'Am', 'D'], lead: [
    'B4 - D5 - G5 - D5 - B4 - G4 - A4 - B4 -',
    'A4 - - - F#4 - A4 - D5 - - - C5 - B4 -',
    'G4 - B4 - E5 - - - D5 - B4 - G4 - B4 -',
    'A4 - - - - - G4 - F#4 - - - . . . .',
    'E5 - - - C5 - E5 - G5 - - - E5 - C5 -',
    'D5 - - - B4 - G4 - B4 - D5 - - - . .',
    'C5 - - - A4 - C5 - E5 - D5 - C5 - A4 -',
    'B4 - - - A4 - - - F#4 - - - D4 - - -'] },
  // 전투: 빠른 단조, 8분 베이스
  battle: { bpm: 132, style: 'drive', chords: ['Am', 'F', 'G', 'E', 'Dm', 'Am', 'F', 'E'], lead: [
    'A4 - C5 - E5 - C5 - A4 - B4 - C5 - D5 -',
    'C5 - - - A4 - F4 - A4 - C5 - F5 - E5 -',
    'D5 - - - B4 - G4 - B4 - D5 - G5 - F5 -',
    'E5 - - - - - D5 - C5 - B4 - G#4 - - -',
    'F5 - E5 - D5 - - - A4 - - - D5 - - -',
    'E5 - D5 - C5 - - - A4 - - - C5 - - -',
    'A4 - C5 - F5 - - - E5 - D5 - C5 - - -',
    'B4 - - - G#4 - - - E4 - - - . . . .'] },
  // 보스: 더 빠르고 낮고 무겁게
  boss: { bpm: 150, style: 'heavy', chords: ['Dm', 'Bb', 'Gm', 'A'], lead: [
    'D4 - - - D4 - F4 - E4 - - - D4 - C#4 -',
    'D4 - - - F4 - A4 - Bb4 - - - A4 - - -',
    'G4 - - - Bb4 - D5 - C5 - Bb4 - A4 - G4 -',
    'A4 - - - C#5 - - - E5 - - - A4 - - -'] }
};

const BGM_DRUMS = {
  calm:  { kick: 'x.......x.......', snare: '................', hat: '................', bass: 'x.......x.......' },
  march: { kick: 'x.......x.......', snare: '....x.......x.x.', hat: '..x...x...x...x.', bass: 'x...x...x...x...' },
  drive: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.x.x.x.x.x.x.x.' },
  heavy: { kick: 'x.x...x.x.x...x.', snare: '....x.......x..x', hat: '..x...x...x...x.', bass: 'x.xx..x.x.xx..x.' }
};

function bgmNote(name) {
  const m = /^([A-G])([b#]?)(\d)$/.exec(name);
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return 12 * (Number(m[3]) + 1) + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function bgmChord(name) {
  const m = /^([A-G][b#]?)(m?)$/.exec(name);
  const root = bgmNote(m[1] + '3');
  return { root: root, notes: [root, root + (m[2] ? 3 : 4), root + 7] };
}
function bgmFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

const BGM = {
  out: null, vol: 0.5, name: null, track: null, timer: null,
  step: 0, nextT: 0, parsed: {},

  ensure: function () {
    if (this.out || !SFX.ready) return !!this.out;
    this.out = SFX.ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(SFX.ctx.destination);
    return true;
  },

  setVolume: function (v) {
    this.vol = v;
    if (!this.out) return;
    const t = SFX.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(this.name ? v * 0.55 : 0, t, 0.08);
    if (v <= 0) this.halt();
    else if (this.name && !this.timer) this.start();
  },

  parse: function (name) {
    if (this.parsed[name]) return this.parsed[name];
    const tr = BGM_TRACKS[name];
    const lead = tr.lead.map(bar => bar.split(/\s+/));
    return (this.parsed[name] = { bpm: tr.bpm, style: tr.style, lead: lead,
      chords: tr.chords.map(bgmChord), drums: BGM_DRUMS[tr.style] });
  },

  /* 곡을 바꾼다. 같은 곡이면 그대로 둔다. */
  play: function (name) {
    if (!BGM_TRACKS[name]) return;
    if (this.name === name && this.timer) return;
    this.name = name;
    if (!this.ensure()) return;           // 오디오가 아직 안 열렸으면 열릴 때 시작
    this.track = this.parse(name);
    this.step = 0;
    this.nextT = SFX.ctx.currentTime + 0.12;
    const t = SFX.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(this.vol * 0.55, t + 0.8);
    this.start();
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

  /* 서서히 끈다 (승패 연주 전에) */
  stop: function (fade) {
    this.name = null;
    if (!this.out) { this.halt(); return; }
    const t = SFX.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, (fade || 0.4) / 3);
    setTimeout(() => { if (!this.name) this.halt(); }, (fade || 0.4) * 1000 + 50);
  },

  /* 오디오가 뒤늦게 열렸을 때 미뤄 둔 곡을 튼다 */
  resume: function () {
    if (this.name && !this.timer) { const n = this.name; this.name = null; this.play(n); }
  },

  tick: function () {
    if (!this.track || !SFX.ctx) return;
    const ctx = SFX.ctx;
    if (ctx.state !== 'running') { this.nextT = ctx.currentTime + 0.1; return; }
    const tr = this.track;
    const dt = 60 / tr.bpm / 4;
    if (this.nextT < ctx.currentTime - 0.3) this.nextT = ctx.currentTime + 0.05;   // 오래 멈췄다 돌아오면 건너뛴다
    while (this.nextT < ctx.currentTime + 0.3) {
      this.playStep(tr, this.step, this.nextT, dt);
      this.nextT += dt;
      this.step++;
    }
  },

  playStep: function (tr, step, t, dt) {
    const bars = tr.lead.length;
    const bar = Math.floor(step / 16) % bars;
    const s = step % 16;
    const chord = tr.chords[bar % tr.chords.length];
    const d = tr.drums;

    // 선율: 다음 '-' 개수만큼 늘인다
    const tok = tr.lead[bar][s];
    if (tok && tok !== '-' && tok !== '.') {
      let len = 1;
      while (s + len < 16 && tr.lead[bar][s + len] === '-') len++;
      const n = bgmNote(tok);
      if (n) this.voice(bgmFreq(n), t, len * dt, tr.style === 'heavy' ? 'sawtooth' : 'square',
                        tr.style === 'calm' ? 0.05 : 0.045, tr.style === 'calm' ? 1600 : 2400);
    }
    // 화음: 마디 첫 박에 길게
    if (s === 0) {
      for (const n of chord.notes) this.voice(bgmFreq(n + 12), t, 16 * dt, 'triangle', 0.018, 1200, 0.25);
    }
    // 베이스
    if (d.bass[s] === 'x') {
      const oct = (tr.style === 'drive' || tr.style === 'heavy') && s % 4 === 2 ? 12 : 0;
      this.voice(bgmFreq(chord.root - 12 + oct), t, dt * 1.8, 'triangle', 0.13, 700);
    }
    if (d.kick[s] === 'x') this.kick(t);
    if (d.snare[s] === 'x') this.hit(t, 1800, 0.13, 0.08);
    if (d.hat[s] === 'x') this.hit(t, 7000, 0.035, 0.028);
  },

  voice: function (freq, t, dur, type, vol, cutoff, attack) {
    const ctx = SFX.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass';
    f.frequency.value = cutoff || 2000;
    const a = attack || 0.012;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(vol * 0.55, t + a + Math.min(0.2, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(f); f.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.1);
  },

  kick: function (t) {
    const ctx = SFX.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + 0.22);
  },

  hit: function (t, freq, dur, vol) {
    if (!SFX.noiseBuf) return;
    const ctx = SFX.ctx;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = SFX.noiseBuf;
    f.type = freq > 4000 ? 'highpass' : 'bandpass';
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t, Math.random() * 0.5, dur + 0.02);
    src.stop(t + dur + 0.03);
  }
};

/* 효과음 크기. 0 이면 끈 것과 같다. */
SFX.setVolume = function (v) {
  this.vol = v;
  this.on = v > 0;
  if (this.master) this.master.gain.value = 0.28 * v;
};
