/* =======================================================================
 *  막대 왕국 전쟁 - 설정 (언어 · 소리 · 진동 · 화면)
 *
 *  게임 저장과 따로 둔다. 백업을 옮겨도 그 기기의 소리 크기·언어는 그대로다.
 * ======================================================================= */

const SETTINGS_KEY = 'stick-kingdom-settings-v1';

const Settings = {
  d: null,

  defaults: function () {
    let lang = 'ko';
    try {
      // 이미 한국어로 하던 저장이 있으면 한국어, 처음 받은 사람은 기기 언어를 따른다
      const hasSave = !!localStorage.getItem('stick-kingdom-save-v1');
      const nav = (navigator.language || 'ko').toLowerCase();
      if (!hasSave && nav.indexOf('ko') !== 0) lang = 'en';
    } catch (e) { /* 저장소를 못 쓰면 한국어 */ }
    return {
      lang: lang,
      bgm: 0.5,          // 배경 음악 크기 0~1
      sfx: 0.8,          // 효과음 크기 0~1
      vibrate: true,
      dmgNums: true,     // 피해 숫자
      shake: true,       // 화면 흔들림
      art: 'stick',      // 5.20 그림체: 'stick' 막대 | 'r3d' 3D 렌더 (시험)
      quality: 'hq',     // 5.2: 'hq' 고퀄 | 'auto' 절전(예전 모습) | 'low' 최소   (예전 'high' 는 고퀄로)
      fxv: 52,
      keepSpeed: true,   // 전투 속도 기억
      autoActive: true,  // 3.14: 자동 출진일 때 필살도 자동
      keepAwake: true,   // 5.7: 전투 중 화면이 꺼지지 않게 (Wake Lock)
      speed: 1
    };
  },

  load: function () {
    const d = this.defaults();
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { raw = null; }
    if (raw && typeof raw === 'object') {
      if (raw.lang === 'ko' || raw.lang === 'en') d.lang = raw.lang;
      for (const k of ['bgm', 'sfx']) {
        if (typeof raw[k] === 'number' && raw[k] >= 0 && raw[k] <= 1) d[k] = raw[k];
      }
      for (const k of ['vibrate', 'dmgNums', 'shake', 'keepSpeed', 'autoActive', 'keepAwake']) {
        if (typeof raw[k] === 'boolean') d[k] = raw[k];
      }
      if (['hq', 'auto', 'high', 'low'].indexOf(raw.quality) >= 0) d.quality = raw.quality;
      // 5.2: 고퀄 이펙트가 생겼다 — 예전 '자동 · 높음' 은 한 번 고퀄로 옮긴다 (그 뒤에 고른 '절전' 은 그대로 둔다)
      if (raw.fxv !== 52 && (d.quality === 'auto' || d.quality === 'high')) d.quality = 'hq';
      if (d.quality === 'high') d.quality = 'hq';
      if (raw.art === 'stick' || raw.art === 'r3d') d.art = raw.art;
      if ([1, 2, 3, 5].indexOf(raw.speed) >= 0) d.speed = raw.speed;   // 5 는 5.4 개발자 모드 배속
    }
    this.d = d;
  },

  get: function (k) { return this.d[k]; },

  set: function (k, v) {
    this.d[k] = v;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.d)); } catch (e) { /* 무시 */ }
  }
};
Settings.load();

/* 짧은 진동. 설정에서 끌 수 있고, 지원하지 않는 기기에서는 조용히 넘어간다. */
function buzz(ms) {
  if (!Settings.get('vibrate')) return;
  try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) { /* 무시 */ }
}
