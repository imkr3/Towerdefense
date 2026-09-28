#!/usr/bin/env node
/* =======================================================================
 *  막대 왕국 전쟁 - 악보 점검
 *  모든 곡의 코드가 읽히는지, 마디마다 정확히 16칸인지, 음 이름이 맞는지,
 *  스타일·악기가 있는지 확인한다. 브라우저 없이 audio.js + music.js 만 읽는다.
 * ======================================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console, Math, JSON, setTimeout, setInterval, clearInterval });
for (const f of ['js/audio.js', 'js/music.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const { BGM_TRACKS, BGM_STYLES, BGM_INST, bgmChord, bgmNote } = vm.runInContext('({BGM_TRACKS, BGM_STYLES, BGM_INST, bgmChord, bgmNote})', ctx);
const bad = [];
for (const [name, tr] of Object.entries(BGM_TRACKS)) {
  const steps = tr.steps || 16;
  if (!BGM_STYLES[tr.style]) bad.push(name + ': 스타일 없음 ' + tr.style);
  tr.sections.forEach((sec, si) => {
    const at = name + '#' + si;
    const chords = sec.chords.trim().split(/\s+/);
    chords.forEach(c => { if (!bgmChord(c)) bad.push(at + ': 코드를 못 읽음 ' + c); });
    if (sec.style && !BGM_STYLES[sec.style]) bad.push(at + ': 스타일 없음 ' + sec.style);
    for (const k of ['lead', 'dbl', 'cmi']) if (sec[k] && !BGM_INST[sec[k]]) bad.push(at + ': 악기 없음 ' + sec[k]);
    for (const key of ['mel', 'cm']) {
      const rows = sec[key];
      if (!rows) continue;
      if (rows.length !== chords.length) bad.push(at + ' ' + key + ': 마디 수 ' + rows.length + ' ≠ 코드 ' + chords.length);
      rows.forEach((row, bi) => {
        let n = 0;
        for (const tok of row.trim().split(/\s+/)) {
          const m = /^([^*]+)(?:\*(\d+))?$/.exec(tok);
          if (!m) { bad.push(at + ' 마디' + (bi + 1) + ': 이상한 칸 ' + tok); continue; }
          n += m[2] ? +m[2] : 1;
          if (m[1] !== '.' && m[1] !== '-' && bgmNote(m[1]) === null) bad.push(at + ' 마디' + (bi + 1) + ': 음 이름 ' + m[1]);
        }
        if (n !== steps) bad.push(at + ' ' + key + ' 마디' + (bi + 1) + ': ' + n + '칸 (' + steps + '칸이어야)');
      });
    }
  });
}
if (bad.length) { bad.forEach(b => console.error('  ✗ ' + b)); console.error('\n악보 점검 실패 (' + bad.length + '건)'); process.exit(1); }
console.log('  ✓ 곡 ' + Object.keys(BGM_TRACKS).length + '개 악보 이상 없음');
