/* Preserve the existing storage key and previous valid snapshot across updates. */
const SaveStore = {
  key: 'stick-kingdom-save-v1', backupKey: 'stick-kingdom-save-v1-backup',
  blocked: false, recovered: false, error: '',
  validate(s) {
    const obj = v => v && typeof v === 'object' && !Array.isArray(v);
    const num = v => Number.isFinite(v) && v >= 0;
    if (!obj(s) || !Number.isInteger(s.cleared) || s.cleared < 0 || s.cleared > STAGES.length || !num(s.coins)) throw Error('게임 저장 데이터가 아닙니다.');
    for (const k of ['levels','upgrades','owned','stars','achv','stats']) if (s[k] !== undefined && !obj(s[k])) throw Error('저장 항목 형식 오류: ' + k);
    for (const k of ['stones','pity','mythPity','pulls','totalKills','endlessBest']) if (s[k] !== undefined && !num(s[k])) throw Error('저장 숫자 오류: ' + k);
    for (const k of ['levels','upgrades','stars','stats']) for (const v of Object.values(s[k] || {})) if (!num(v)) throw Error('저장 능력치 오류: ' + k);
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
