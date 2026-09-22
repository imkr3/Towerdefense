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
  gold:     function () { this.tone(880, 0.06, 'square', 0.12, 1320); },
  /* --- 3막 --- */
  // 연쇄 번개: 높은 곳에서 탁 튀고 짧게 지직거린다
  chain:    function () { this.tone(1500, 0.07, 'square', 0.12, 2400);
                          this.noise(0.09, 3200, 0.1, 6); },
  // 저주: 아래로 미끄러지는 낮은 소리
  curse:    function () { this.tone(220, 0.34, 'sine', 0.16, 90);
                          this.tone(311, 0.3, 'triangle', 0.08, 130); },
  // 보호막 파훼: 유리 깨지는 소리
  shatter:  function () { this.noise(0.16, 4200, 0.16, 8);
                          this.tone(1760, 0.1, 'triangle', 0.1, 880); },
  // 부식: 쉭 하고 녹는다
  sunder:   function () { this.noise(0.22, 1800, 0.11, 2); },
  // 회피: 스치는 바람
  evade:    function () { this.noise(0.1, 3000, 0.07, 5); },
  // 처형: 묵직하게 내리찍는다
  execute:  function () { this.noise(0.18, 900, 0.26, 2);
                          this.tone(160, 0.22, 'sawtooth', 0.18, 60); },
  // 약탈: 동전이 굴러 떨어진다
  steal:    function () { this.tone(760, 0.12, 'square', 0.12, 240); }
};
