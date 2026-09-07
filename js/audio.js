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

  /* 잡음 (타격, 폭발) */
  noise: function (dur, freq, vol, q) {
    if (!this.on || !this.ready) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq || 900, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, (freq || 900) * 0.3), t + dur);
    f.Q.value = q || 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
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
