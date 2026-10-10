/* Preserve the existing storage key and previous valid snapshot across updates. */
/* 3.1: 저장 슬롯 셋. 1번은 예전 키를 그대로 써서 기존 진행도가 1번 슬롯이 된다.
 * 어느 슬롯을 쓰는지는 따로 적어 두고, 슬롯마다 자기 백업·복원 지점을 가진다. */
const SAVE_BASE_KEY = 'stick-kingdom-save-v1';
const SaveStore = {
  slotKey: 'stick-kingdom-slot', slotCount: 3, slot: 1,
  keyOf(n) { return n === 1 ? SAVE_BASE_KEY : SAVE_BASE_KEY + '-s' + n; },
  get key() { return this.keyOf(this.slot); },
  get backupKey() { return this.key + '-backup'; },
  /* 다른 슬롯으로 옮긴다. 읽기 상태(막힘·복구)는 슬롯마다 새로 */
  useSlot(n) {
    if (!(n >= 1 && n <= this.slotCount)) return false;
    this.slot = n; this.blocked = false; this.recovered = false; this.error = '';
    try { localStorage.setItem(this.slotKey, String(n)); } catch (e) { /* 저장소를 못 쓰면 이번 실행만 */ }
    return true;
  },
  /* 슬롯 요약을 본다 (아무것도 고치지 않는다). 비었으면 null, 못 읽으면 {broken:true} */
  peek(n) {
    try {
      const raw = localStorage.getItem(this.keyOf(n)) || localStorage.getItem(this.keyOf(n) + '-backup');
      if (!raw) return null;
      return this.parse(raw);
    } catch (e) { return { broken: true }; }
  },
  blocked: false, recovered: false, error: '',
  validate(s) {
    const obj = v => v && typeof v === 'object' && !Array.isArray(v);
    const num = v => Number.isFinite(v) && v >= 0;
    if (!obj(s) || !Number.isInteger(s.cleared) || s.cleared < 0 || s.cleared > STAGES.length || !num(s.coins)) throw Error('게임 저장 데이터가 아닙니다.');
    for (const k of ['levels','upgrades','owned','stars','achv','stats','events','expeditions']) if (s[k] !== undefined && !obj(s[k])) throw Error('저장 항목 형식 오류: ' + k);
    for (const k of ['stones','pity','mythPity','pulls','totalKills','endlessBest']) if (s[k] !== undefined && !num(s[k])) throw Error('저장 숫자 오류: ' + k);
    for (const k of ['levels','upgrades','stars','stats']) for (const v of Object.values(s[k] || {})) if (!num(v)) throw Error('저장 능력치 오류: ' + k);
    if (s.evo !== undefined && (!obj(s.evo) || Object.values(s.evo).some(v => typeof v !== 'boolean'))) throw Error('진화 데이터 오류');
    if (s.evo2 !== undefined && (!obj(s.evo2) || Object.values(s.evo2).some(v => typeof v !== 'boolean'))) throw Error('3진 데이터 오류');
    if (s.loadout !== undefined && (!Array.isArray(s.loadout) || s.loadout.some(v => typeof v !== 'string'))) throw Error('편성 데이터 오류');
    if (s.daily != null && (!obj(s.daily) || !Array.isArray(s.daily.list) || s.daily.list.some(m => !obj(m) || !missionById(m.id) || !num(m.got)))) throw Error('일일 임무 데이터 오류');
    return s;
  },
  parse(raw) {
    if (typeof raw !== 'string' || raw.length > 1048576) throw Error('백업은 1MB 이하의 JSON 파일이어야 합니다.');
    const value = JSON.parse(raw);
    if (value && value.format === 'stick-kingdom-save') {
      if (value.version !== 1) throw Error('지원하지 않는 백업 버전입니다.');
      return this.validate(value.data);
    }
    return this.validate(value);
  },
  read() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw === null) {
        const fallback = localStorage.getItem(this.backupKey);
        if (fallback) { const s = this.parse(fallback); this.recovered = true; return s; }
        return null;
      }
      try { return this.parse(raw); } catch (e) {
        // Retain the damaged source before attempting any automatic repair.
        localStorage.setItem(this.key + '-damaged', raw);
        const fallback = localStorage.getItem(this.backupKey);
        const s = this.parse(fallback);
        localStorage.setItem(this.key, JSON.stringify(s));
        this.recovered = true;
        return s;
      }
    } catch (e) {
      this.blocked = true;
      this.error = '기존 저장을 읽지 못해 덮어쓰기를 막았습니다. 저장 관리에서 원본을 백업하거나 복원해 주세요.';
      return null;
    }
  },
  write(s, explicitRestore = false) {
    if (this.blocked && !explicitRestore) return false;
    try {
      this.validate(s);
      const raw = JSON.stringify(s), previous = localStorage.getItem(this.key);
      if (previous === raw) { this.blocked = false; this.error = ''; return true; }
      if (previous) {
        let valid = true;
        try { this.parse(previous); } catch (e) { valid = false; }
        if (valid) {
          if (explicitRestore) localStorage.setItem(this.key + '-restore-point', previous);
          localStorage.setItem(this.backupKey, previous);
        }
        else {
          if (!explicitRestore) throw Error('Invalid existing save');
          localStorage.setItem(this.key + '-damaged', previous);
        }
      }
      localStorage.setItem(this.key, raw);
      this.blocked = false; this.error = '';
      return true;
    } catch (e) {
      this.error = '저장에 실패했습니다. 저장 관리에서 백업을 내보내 주세요.';
      return false;
    }
  },
  export(s) {
    return JSON.stringify({format:'stick-kingdom-save', version:1, exportedAt:new Date().toISOString(), data:this.validate(s)}, null, 2);
  }
};
try {
  const n = +localStorage.getItem(SaveStore.slotKey);
  if (n >= 1 && n <= SaveStore.slotCount) SaveStore.slot = n;
} catch (e) { /* 1번 슬롯 */ }
