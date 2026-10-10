/* =======================================================================
 *  막대 왕국 전쟁 - 악보 (2.9)
 *
 *  곡마다: 빠르기 · 스타일(반주 짜는 방식, audio.js 의 BGM_STYLES) · 구간들.
 *  구간마다: 코드 진행(한 마디에 하나) · 선율(한 마디 16칸) · 선율 악기 · 겹침 악기 · 세기(int 1~3).
 *  선율 적는 법: 'D5*4' = D5 를 4칸(4분음표) · '.*2' = 2칸 쉼 · 한 마디는 16칸.
 *
 *  전장 곡은 전장 컨셉(STAGE_THEMES)마다 하나씩, 보스곡은 보스마다 하나씩,
 *  마지막 전장은 따로 한 곡. 같은 곡을 두 곳에서 쓰지 않는다.
 * ======================================================================= */
const BGM_TRACKS = {
  /* ---------------- 메뉴 ---------------- */
  title: { bpm: 84, style: 'mystic', sections: [
    { chords: 'Dm Bb F C Dm Bb Gm A', lead: 'horn', int: 1, mel: [
      'D4*6 E4*2 F4*4 A4*4', 'G4*6 F4*2 D4*8', 'F4*4 A4*4 C5*6 Bb4*2', 'A4*8 G4*8',
      'D5*6 C5*2 A4*4 F4*4', 'G4*4 Bb4*4 D5*8', 'C5*4 Bb4*4 A4*4 G4*4', 'A4*12 .*4'] },
    { chords: 'F C Dm Bb Gm C F A', style: 'epic', lead: 'trumpet', dbl: 'strings', int: 2, mel: [
      'A4*4 C5*4 F5*8', 'E5*4 D5*2 C5*2 G4*8', 'F5*6 E5*2 D5*4 A4*4', 'Bb4*4 D5*4 F5*8',
      'G5*6 F5*2 D5*4 Bb4*4', 'C5*4 E5*4 G5*8', 'A5*6 G5*2 F5*4 C5*4', 'E5*4 C#5*4 A4*8'] }] },

  map: { bpm: 108, style: 'march', sections: [
    { chords: 'G D Em D C G Am D', lead: 'trumpet', int: 1, mel: [
      'B4*2 D5*2 G5*2 D5*2 B4*2 G4*2 A4*2 B4*2', 'A4*4 F#4*2 A4*2 D5*4 C5*2 B4*2',
      'G4*2 B4*2 E5*4 D5*2 B4*2 G4*2 B4*2', 'A4*6 G4*2 F#4*4 .*4',
      'E5*4 C5*2 E5*2 G5*4 E5*2 C5*2', 'D5*4 B4*2 G4*2 B4*2 D5*4 .*2',
      'C5*4 A4*2 C5*2 E5*2 D5*2 C5*2 A4*2', 'B4*4 A4*4 F#4*4 D4*4'] },
    { chords: 'C G Am Em F C D D', lead: 'horn', dbl: 'strings', int: 2, mel: [
      'E5*4 D5*2 C5*2 G4*8', 'D5*4 B4*4 G4*8', 'C5*2 D5*2 E5*4 A4*8', 'B4*4 G4*4 E4*8',
      'A4*4 C5*4 F5*6 E5*2', 'E5*4 D5*4 C5*8', 'D5*4 E5*2 F#5*2 A5*8', 'F#5*4 D5*4 A4*4 D5*4'] }] },

  barracks: { bpm: 112, style: 'light', sections: [
    { chords: 'F C Dm Bb F C Bb C', lead: 'flute', int: 1, mel: [
      'C5*2 A4*2 F4*2 A4*2 C5*4 F5*4', 'E5*2 D5*2 C5*2 E5*2 G5*8', 'F5*2 E5*2 D5*2 C5*2 A4*4 D5*4',
      'D5*2 C5*2 Bb4*2 A4*2 G4*8', 'A4*2 C5*2 F5*2 C5*2 A4*4 F4*4', 'G4*2 A4*2 Bb4*2 C5*2 E5*8',
      'D5*4 Bb4*4 F4*4 D5*4', 'C5*4 E5*4 G5*4 E5*4'] },
    { chords: 'Bb F Gm C Bb F C F', lead: 'oboe', int: 1, mel: [
      'D5*4 F5*4 Bb5*8', 'A5*4 F5*4 C5*8', 'Bb4*4 D5*4 G5*8', 'E5*4 G5*4 C5*8',
      'F5*2 E5*2 D5*2 C5*2 Bb4*8', 'A4*4 C5*4 F5*8', 'G5*4 E5*4 C5*4 E5*4', 'F5*12 .*4'] }] },

  altar: { bpm: 70, style: 'mystic', sections: [
    { chords: 'Em C G D Em Am B7 Em', lead: 'flute', int: 1, mel: [
      'E5*8 G5*4 F#5*4', 'E5*8 C5*8', 'D5*6 B4*2 G4*8', 'A4*8 F#4*8',
      'G4*4 A4*4 B4*8', 'C5*8 E5*8', 'D#5*8 F#5*8', 'E5*16'] },
    { chords: 'C D Bm Em Am D B7 B7', lead: 'choir', int: 2, mel: [
      'G5*8 E5*8', 'F#5*8 A5*8', 'B5*8 F#5*8', 'G5*16', 'E5*8 A5*8', 'F#5*8 D5*8', 'D#5*8 F#5*8', 'B4*16'] }] },

  /* ---------------- 전장 (컨셉마다 하나) ---------------- */
  meadow: { bpm: 128, style: 'action', sections: [
    { chords: 'G C D G Em C D D', lead: 'trumpet', int: 1, mel: [
      'G4*2 B4*2 D5*4 B4*2 G4*2 D5*4', 'E5*4 D5*2 C5*2 E5*8', 'D5*2 C5*2 B4*2 A4*2 F#4*4 A4*4', 'G4*12 .*4',
      'B4*2 C5*2 D5*4 E5*4 G5*4', 'E5*4 C5*4 G4*8', 'A4*2 B4*2 C5*4 D5*4 F#5*4', 'A5*8 F#5*4 D5*4'] },
    { chords: 'C D Bm Em Am D G G', lead: 'horn', dbl: 'strings', int: 2, mel: [
      'E5*4 G5*4 C5*8', 'D5*4 F#5*4 A5*8', 'B5*6 A5*2 F#5*4 D5*4', 'E5*8 B4*8',
      'C5*4 E5*4 A5*4 G5*4', 'F#5*4 E5*4 D5*4 C5*4', 'B4*4 D5*4 G5*8', 'G5*12 .*4'] }] },

  wheat: { bpm: 124, style: 'folk', sections: [
    { chords: 'D G A D Bm G A D', lead: 'flute', int: 1, mel: [
      'D5*2 F#5*2 A5*2 F#5*2 D5*4 A4*4', 'B4*2 D5*2 G5*2 D5*2 B4*8', 'A4*2 C#5*2 E5*4 G5*4 E5*4', 'F#5*4 E5*4 D5*8',
      'B4*2 D5*2 F#5*4 D5*4 B4*4', 'G4*2 B4*2 D5*4 G5*8', 'E5*2 F#5*2 G5*2 E5*2 C#5*4 A4*4', 'D5*12 .*4'] },
    { chords: 'G D Em A G D A D', lead: 'oboe', int: 2, mel: [
      'G5*4 F#5*2 E5*2 D5*8', 'F#5*4 E5*2 D5*2 A4*8', 'G5*2 F#5*2 E5*2 D5*2 B4*8', 'C#5*4 E5*4 A5*8',
      'B5*4 A5*2 G5*2 D5*8', 'A5*4 F#5*4 D5*8', 'E5*2 F#5*2 G5*2 A5*2 C#5*4 E5*4', 'D5*12 .*4'] }] },

  river: { bpm: 118, style: 'pastoral', sections: [
    { chords: 'Em C G D Em C B7 Em', lead: 'strings', dbl: 'flute', int: 1, mel: [
      'E5*6 F#5*2 G5*4 B5*4', 'A5*4 G5*4 E5*8', 'D5*4 B4*4 G4*4 B4*4', 'A4*8 F#4*8',
      'E4*2 G4*2 B4*4 E5*4 G5*4', 'E5*4 C5*4 G4*8', 'F#4*4 A4*4 D#5*8', 'E5*12 .*4'] },
    { chords: 'Am Em C D Am Em B7 B7', lead: 'flute', int: 2, mel: [
      'C5*4 E5*4 A5*8', 'G5*4 E5*4 B4*8', 'C5*2 D5*2 E5*4 G5*4 E5*4', 'D5*4 F#5*4 A5*8',
      'A5*4 G5*4 E5*4 C5*4', 'B4*4 E5*4 G5*8', 'F#5*4 D#5*4 B4*8', 'B4*8 D#5*8'] }] },

  wolfwood: { bpm: 124, style: 'tribal', sections: [
    { chords: 'Am Am G Am F G Am Am', lead: 'horn', int: 1, mel: [
      'A4*4 C5*2 A4*2 E5*8', 'D5*2 C5*2 B4*2 A4*2 E4*8', 'G4*4 B4*2 G4*2 D5*8', 'C5*2 B4*2 A4*4 .*8',
      'F4*4 A4*2 C5*2 F5*8', 'G5*4 F5*2 E5*2 D5*8', 'E5*4 C5*4 A4*4 E5*4', 'A5*12 .*4'] },
    { chords: 'F G Em Am Dm Em F E', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'A5*6 G5*2 F5*8', 'G5*6 F5*2 D5*8', 'E5*4 G5*4 B5*8', 'A5*8 E5*8',
      'F5*4 D5*4 A4*8', 'G4*4 B4*4 E5*8', 'F5*4 E5*4 D5*4 C5*4', 'B4*8 G#4*8'] }] },

  graveyard: { bpm: 96, style: 'eerie', sections: [
    { chords: 'Dm Dm Bb A Gm Dm A Dm', lead: 'oboe', int: 1, mel: [
      'D5*8 F5*4 E5*4', 'D5*4 C#5*4 D5*8', 'F5*6 E5*2 D5*4 Bb4*4', 'A4*16',
      'G4*4 Bb4*4 D5*8', 'F5*4 E5*4 D5*4 A4*4', 'C#5*8 E5*8', 'D5*16'] },
    { chords: 'Bb F Gm Dm Bb A Dm Dm', lead: 'choir', int: 2, mel: [
      'D5*8 F5*8', 'C5*8 A4*8', 'Bb4*8 D5*8', 'A4*16', 'F5*8 D5*8', 'E5*8 C#5*8', 'D5*8 A4*8', 'D5*16'] }] },

  cave: { bpm: 100, style: 'eerie', sections: [
    { chords: 'C#m A C#m G#7 F#m C#m G#7 C#m', lead: 'flute', int: 1, mel: [
      'C#5*4 E5*4 G#5*8', 'A5*4 G#5*4 E5*8', 'C#5*2 D#5*2 E5*4 C#5*8', 'C5*8 G#4*8',
      'F#5*4 A5*4 C#5*8', 'E5*4 D#5*4 C#5*8', 'C5*4 D#5*4 G#5*8', 'C#5*16'] },
    { chords: 'A B E C#m A B G#7 G#7', lead: 'oboe', int: 2, mel: [
      'E5*4 A5*4 C#6*8', 'D#6*4 B5*4 F#5*8', 'G#5*4 E5*4 B4*8', 'C#5*8 E5*8',
      'A5*4 G#5*4 F#5*4 E5*4', 'D#5*4 F#5*4 B5*8', 'C5*8 D#5*8', 'G#5*16'] }] },

  hills: { bpm: 116, style: 'march', sections: [
    { chords: 'Cm Ab Eb Bb Cm Ab G G', lead: 'trumpet', int: 1, mel: [
      'C5*4 Eb5*2 C5*2 G5*8', 'Ab5*4 G5*2 F5*2 Eb5*8', 'G5*4 F5*2 Eb5*2 Bb4*8', 'D5*4 F5*4 Bb5*8',
      'C5*2 D5*2 Eb5*4 G5*4 C6*4', 'Ab5*4 F5*4 C5*8', 'B4*4 D5*4 G5*8', 'G5*8 B4*8'] },
    { chords: 'Fm Cm Ab Eb Fm Cm G Cm', lead: 'horn', dbl: 'strings', int: 2, mel: [
      'F5*4 Ab5*4 C6*8', 'G5*4 Eb5*4 C5*8', 'Ab4*4 C5*4 Eb5*8', 'G5*4 Bb5*4 Eb6*8',
      'F5*4 G5*4 Ab5*8', 'G5*4 Eb5*4 C5*8', 'D5*4 F5*4 B4*8', 'C5*16'] }] },

  camp: { bpm: 118, style: 'tribal', sections: [
    { chords: 'Dm G Dm C Dm G Am Dm', lead: 'oboe', int: 1, mel: [
      'D5*2 F5*2 A5*4 G5*2 F5*2 D5*4', 'B4*4 D5*4 G5*8', 'A5*2 G5*2 F5*2 E5*2 D5*8', 'E5*4 G5*4 C5*8',
      'D5*2 E5*2 F5*4 A5*8', 'G5*4 F5*2 E5*2 B4*8', 'C5*4 E5*4 A4*8', 'D5*16'] },
    { chords: 'F C G Dm F C Am Dm', lead: 'horn', int: 2, mel: [
      'F5*4 A5*4 C6*8', 'G5*4 E5*4 C5*8', 'B4*4 D5*4 G5*8', 'F5*4 E5*4 D5*8',
      'A5*4 C6*4 F5*8', 'E5*4 G5*4 C5*8', 'C5*4 A4*4 E5*8', 'D5*16'] }] },

  canyon: { bpm: 132, style: 'dark', sections: [
    { chords: 'Em F Em F G F Em Em', lead: 'trumpet', int: 1, mel: [
      'E5*2 F5*2 E5*2 B4*2 E5*8', 'F5*2 G5*2 F5*2 C5*2 A4*8', 'E5*4 G5*4 B5*8', 'C6*4 A5*4 F5*8',
      'D5*2 E5*2 G5*4 B5*8', 'A5*4 F5*4 C5*8', 'B4*4 E5*4 G5*4 F5*4', 'E5*12 .*4'] },
    { chords: 'Am F G Em Dm F E E', lead: 'strings', dbl: 'trumpet', int: 2, mel: [
      'A5*6 G5*2 E5*8', 'F5*6 E5*2 C5*8', 'D5*4 G5*4 B5*8', 'E5*8 B4*8',
      'D5*4 F5*4 A5*8', 'C6*4 A5*4 F5*8', 'G#5*4 E5*4 B4*8', 'E5*16'] }] },

  fortress: { bpm: 112, style: 'march', sections: [
    { chords: 'Dm Dm C C Bb Bb A A', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'D4*4 F4*4 A4*6 D5*2', 'C5*4 A4*4 F4*8', 'E4*4 G4*4 C5*6 E5*2', 'D5*4 C5*4 G4*8',
      'F4*4 Bb4*4 D5*6 F5*2', 'E5*4 D5*4 Bb4*8', 'A4*4 C#5*4 E5*8', 'A5*8 E5*8'] },
    { chords: 'Gm Dm Bb F Gm Dm A Dm', lead: 'strings', dbl: 'trumpet', int: 2, mel: [
      'G4*4 Bb4*4 D5*8', 'F5*4 E5*4 D5*8', 'D5*4 F5*4 Bb5*8', 'A5*4 F5*4 C5*8',
      'Bb4*4 D5*4 G5*8', 'F5*4 D5*4 A4*8', 'C#5*4 E5*4 A5*8', 'D5*16'] }] },

  darkwood: { bpm: 124, style: 'action', sections: [
    { chords: 'Fm Db Eb Fm Bbm Db C C', lead: 'horn', int: 1, mel: [
      'F4*4 Ab4*4 C5*6 Db5*2', 'Db5*4 C5*4 Ab4*8', 'Bb4*4 G4*4 Eb4*8', 'F4*12 .*4',
      'Bb4*4 Db5*4 F5*8', 'Ab5*4 F5*4 Db5*8', 'C5*4 E5*4 G5*8', 'E5*8 C5*8'] },
    { chords: 'Db Eb Fm Fm Db Eb C C', lead: 'strings', dbl: 'horn', int: 2, mel: [
      'F5*4 Ab5*4 Db6*8', 'Bb5*4 G5*4 Eb5*8', 'C6*6 Bb5*2 Ab5*8', 'F5*16',
      'Ab5*4 F5*4 Db5*8', 'G5*4 Bb5*4 Eb6*8', 'E5*4 G5*4 C6*8', 'C6*8 G5*8'] }] },

  ruins: { bpm: 88, style: 'mystic', sections: [
    { chords: 'Bm G D A Bm G Em F#', lead: 'flute', int: 1, mel: [
      'B4*8 D5*4 F#5*4', 'G5*8 E5*8', 'F#5*6 E5*2 D5*8', 'C#5*8 A4*8',
      'B4*4 D5*4 F#5*8', 'G5*4 F#5*4 D5*8', 'E5*4 G5*4 B5*8', 'A#5*8 F#5*8'] },
    { chords: 'G A F#m Bm G A F# F#', lead: 'strings', dbl: 'oboe', int: 2, mel: [
      'D5*8 G5*8', 'E5*8 A5*8', 'F#5*6 A5*2 C#6*8', 'B5*16',
      'G5*6 F#5*2 E5*8', 'A5*6 G5*2 E5*8', 'F#5*4 E5*4 C#5*8', 'A#4*16'] }] },

  swamp: { bpm: 92, style: 'eerie', sections: [
    { chords: 'Gm Eb Gm D Cm Gm D Gm', lead: 'oboe', int: 1, mel: [
      'G4*4 Bb4*2 A4*2 G4*8', 'Eb5*4 D5*2 C5*2 Bb4*8', 'D5*4 C5*2 Bb4*2 G4*8', 'F#4*16',
      'Eb5*4 C5*4 G4*8', 'Bb4*4 D5*4 G5*8', 'F#5*4 D5*4 A4*8', 'G4*16'] },
    { chords: 'Cm Ab Eb Bb Cm Ab D D', lead: 'horn', int: 2, mel: [
      'C5*8 Eb5*8', 'F5*4 Eb5*4 C5*8', 'G5*8 Eb5*8', 'D5*8 F5*8',
      'G5*4 F5*4 Eb5*8', 'C5*4 Eb5*4 Ab5*8', 'F#5*8 A5*8', 'D5*16'] }] },

  snowpass: { bpm: 104, style: 'ice', sections: [
    { chords: 'Am F C G Am F E E', lead: 'flute', int: 1, mel: [
      'E5*4 A5*4 C6*8', 'A5*4 F5*4 C5*8', 'E5*4 G5*4 C6*8', 'B5*4 G5*4 D5*8',
      'C5*4 E5*4 A5*8', 'A5*4 C6*4 F5*8', 'E5*4 G#5*4 B5*8', 'B5*8 G#5*8'] },
    { chords: 'F G Em Am F G E E', lead: 'strings', dbl: 'flute', int: 2, mel: [
      'A5*6 G5*2 F5*8', 'G5*6 F5*2 D5*8', 'E5*6 D5*2 B4*8', 'C5*8 E5*8',
      'F5*4 A5*4 C6*8', 'B5*4 D6*4 G5*8', 'G#5*8 B5*8', 'E5*16'] }] },

  blizzard: { bpm: 152, style: 'action', sections: [
    { chords: 'Dm Bb C A Dm Bb Gm A', lead: 'strings', dbl: 'trumpet', int: 2, mel: [
      'D5*2 E5*2 F5*2 D5*2 A5*8', 'Bb5*2 A5*2 G5*2 F5*2 D5*8', 'E5*2 F5*2 G5*2 E5*2 C5*8', 'C#5*4 E5*4 A5*8',
      'F5*2 G5*2 A5*4 D6*8', 'D6*2 C6*2 Bb5*4 F5*8', 'G5*2 A5*2 Bb5*4 D6*8', 'C#6*8 A5*8'] },
    { chords: 'Bb F C Dm Bb F A A', lead: 'trumpet', int: 2, mel: [
      'F5*4 D5*4 Bb4*8', 'C5*4 F5*4 A5*8', 'G5*4 E5*4 C5*8', 'D5*4 F5*4 A5*8',
      'Bb5*4 A5*4 F5*8', 'A5*4 C6*4 F5*8', 'E5*4 C#5*4 A4*8', 'A4*16'] }] },

  winterthrone: { bpm: 96, style: 'ice', sections: [
    { chords: 'Em C D Bm Em Am B B', lead: 'horn', int: 1, mel: [
      'E4*8 G4*4 B4*4', 'C5*8 E5*8', 'D5*6 C5*2 A4*8', 'B4*16',
      'E5*4 G5*4 B5*8', 'A5*4 E5*4 C5*8', 'D#5*4 F#5*4 B5*8', 'B5*16'] },
    { chords: 'C G D Em C G B B', lead: 'strings', dbl: 'horn', int: 2, mel: [
      'G5*8 E5*8', 'D5*8 B4*8', 'A4*4 D5*4 F#5*8', 'G5*8 E5*8',
      'E5*4 G5*4 C6*8', 'B5*4 G5*4 D5*8', 'D#5*8 F#5*8', 'B4*16'] }] },

  volcano: { bpm: 138, style: 'dark', sections: [
    { chords: 'Cm Cm Ab Bb Cm Cm Fm G', lead: 'trumpet', int: 2, mel: [
      'C5*2 C5*2 Eb5*2 C5*2 G5*8', 'F5*2 Eb5*2 D5*2 Eb5*2 C5*8', 'Ab5*4 G5*4 Eb5*8', 'F5*4 D5*4 Bb4*8',
      'G5*2 G5*2 Ab5*2 G5*2 Eb5*8', 'C6*4 Bb5*4 G5*8', 'Ab5*4 F5*4 C5*8', 'B4*8 D5*8'] },
    { chords: 'Ab Bb Cm Cm Ab Bb G G', lead: 'strings', dbl: 'trumpet', int: 2, mel: [
      'Eb5*4 Ab5*4 C6*8', 'D6*4 Bb5*4 F5*8', 'G5*6 Eb5*2 C5*8', 'C6*16',
      'Ab5*4 C6*4 Eb6*8', 'D6*4 Bb5*4 F5*8', 'G5*4 B5*4 D6*8', 'G5*16'] }] },

  warcamp: { bpm: 128, style: 'tribal', sections: [
    { chords: 'Fm Fm Db Eb Fm Fm C C', lead: 'horn', dbl: 'lowbrass', int: 2, mel: [
      'F4*2 F4*2 Ab4*2 F4*2 C5*8', 'Bb4*2 Ab4*2 G4*2 Ab4*2 F4*8', 'Db5*4 C5*4 Ab4*8', 'Bb4*4 G4*4 Eb4*8',
      'F4*2 Ab4*2 C5*4 F5*8', 'Eb5*4 Db5*4 C5*8', 'E4*4 G4*4 C5*8', 'C5*8 E4*8'] },
    { chords: 'Db Eb Fm Fm Bbm C Fm Fm', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'F5*4 Db5*4 Ab4*8', 'G4*4 Bb4*4 Eb5*8', 'F5*6 Eb5*2 C5*8', 'Ab4*16',
      'Bb4*4 Db5*4 F5*8', 'E5*4 G5*4 C6*8', 'Ab5*4 G5*4 F5*8', 'F5*16'] }] },

  blackriver: { bpm: 104, style: 'pastoral', sections: [
    { chords: 'Bbm Gb Db Ab Bbm Gb F F', lead: 'strings', dbl: 'flute', int: 1, mel: [
      'Bb4*4 Db5*4 F5*8', 'Gb5*4 F5*4 Db5*8', 'F5*4 Ab5*4 Db6*8', 'C6*4 Ab5*4 Eb5*8',
      'Db5*4 F5*4 Bb5*8', 'Bb5*4 Gb5*4 Db5*8', 'C5*4 F5*4 A5*8', 'A5*8 F5*8'] },
    { chords: 'Gb Ab Bbm Bbm Gb Ab F F', style: 'eerie', lead: 'oboe', int: 2, mel: [
      'Db5*8 Gb5*8', 'Eb5*8 Ab5*8', 'F5*8 Db5*8', 'Bb4*16',
      'Gb5*6 F5*2 Db5*8', 'Ab5*6 Gb5*2 Eb5*8', 'A5*8 F5*8', 'F5*16'] }] },

  underworld: { bpm: 90, style: 'mystic', sections: [
    { chords: 'F#m D A E F#m D C# C#', lead: 'choir', int: 1, mel: [
      'F#4*8 A4*8', 'D5*8 A4*8', 'C#5*8 E5*8', 'B4*8 G#4*8',
      'A4*6 C#5*2 F#5*8', 'F#5*4 E5*4 D5*8', 'F5*8 C#5*8', 'C#5*16'] },
    { chords: 'Bm F#m D C# Bm F#m C# C#', style: 'eerie', lead: 'oboe', int: 2, mel: [
      'D5*4 F#5*4 B5*8', 'A5*4 F#5*4 C#5*8', 'D5*4 F#5*4 A5*8', 'G#5*8 F5*8',
      'B5*6 A5*2 F#5*8', 'A5*6 G#5*2 F#5*8', 'F5*4 G#5*4 C#6*8', 'C#6*16'] }] },

  thorngate: { bpm: 120, style: 'march', sections: [
    { chords: 'Gm Eb F D Gm Eb D D', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'G4*4 Bb4*2 D5*2 G5*8', 'Eb5*4 D5*2 C5*2 Bb4*8', 'C5*4 F5*4 A5*8', 'F#5*4 D5*4 A4*8',
      'G5*2 F5*2 Eb5*2 D5*2 Bb4*8', 'C5*4 Eb5*4 G5*8', 'F#5*4 A5*4 D6*8', 'D6*8 A5*8'] },
    { chords: 'Cm Gm Eb Bb Cm Gm D Gm', lead: 'strings', dbl: 'trumpet', int: 2, mel: [
      'Eb5*4 G5*4 C6*8', 'Bb5*4 G5*4 D5*8', 'Eb5*4 G5*4 Bb5*8', 'D6*4 Bb5*4 F5*8',
      'G5*4 Eb5*4 C5*8', 'D5*4 G5*4 Bb5*8', 'A5*4 F#5*4 D5*8', 'G5*16'] }] },

  desert: { bpm: 116, style: 'desert', sections: [
    { chords: 'D D Eb D Gm Eb D D', lead: 'oboe', int: 1, mel: [
      'D5*2 Eb5*2 F#5*2 G5*2 A5*8', 'G5*2 F#5*2 Eb5*2 F#5*2 D5*8', 'Eb5*4 G5*4 Bb5*8', 'A5*4 F#5*4 D5*8',
      'G5*2 A5*2 Bb5*4 D6*8', 'C6*2 Bb5*2 A5*2 G5*2 Eb5*8', 'F#5*2 G5*2 A5*2 G5*2 F#5*2 Eb5*2 D5*4', 'D5*16'] },
    { chords: 'Gm Cm D D Eb D Cm D', lead: 'strings', dbl: 'oboe', int: 2, mel: [
      'Bb5*6 A5*2 G5*8', 'C6*6 Bb5*2 G5*8', 'A5*4 F#5*4 D5*8', 'Eb5*2 D5*2 C5*4 D5*8',
      'Bb4*4 Eb5*4 G5*8', 'A5*4 F#5*4 D5*8', 'C5*4 Eb5*4 G5*8', 'F#5*8 D5*8'] }] },

  eclipse: { bpm: 100, style: 'mystic', sections: [
    { chords: 'E F E Dm E F E E', lead: 'choir', int: 1, mel: [
      'E5*8 F5*4 G#5*4', 'A5*8 F5*8', 'G#5*6 F5*2 E5*8', 'D5*8 F5*8',
      'E5*4 G#5*4 B5*8', 'C6*4 B5*4 A5*8', 'G#5*4 F5*4 E5*8', 'E5*16'] },
    { chords: 'Am F E E Dm F E E', style: 'desert', lead: 'oboe', int: 2, mel: [
      'A4*2 B4*2 C5*4 E5*8', 'F5*2 E5*2 D5*2 C5*2 A4*8', 'B4*2 C5*2 D5*2 C5*2 B4*2 A4*2 G#4*4', 'E4*16',
      'D5*2 E5*2 F5*4 A5*8', 'C6*4 A5*4 F5*8', 'G#5*4 F5*4 E5*4 D5*4', 'E5*16'] }] },

  mythic: { bpm: 108, style: 'epic', sections: [
    { chords: 'Cm Ab Eb Bb Fm Cm G G', lead: 'choir', int: 1, mel: [
      'C5*8 Eb5*8', 'Ab5*8 G5*8', 'G5*6 F5*2 Eb5*8', 'D5*8 F5*8',
      'F5*4 Ab5*4 C6*8', 'Eb5*4 G5*4 C6*8', 'B5*8 D6*8', 'G5*16'] },
    { chords: 'Ab Bb Eb Cm Ab Bb G G', lead: 'trumpet', dbl: 'strings', int: 2, mel: [
      'Ab5*4 C6*4 Eb6*8', 'D6*4 Bb5*4 F5*8', 'G5*4 Bb5*4 Eb6*8', 'C6*16',
      'Ab5*4 Eb5*4 C6*8', 'Bb5*4 F5*4 D6*8', 'D6*4 B5*4 G5*8', 'G5*16'] }] },

  endless: { bpm: 146, style: 'action', sections: [
    { chords: 'Em C D B7 Em C Am B', lead: 'trumpet', dbl: 'strings', int: 2, mel: [
      'E5*2 G5*2 B5*4 E6*4 D6*2 B5*2', 'C6*4 B5*2 A5*2 G5*8', 'A5*2 F#5*2 D5*4 A5*8', 'F#5*4 D#5*4 B4*8',
      'E5*2 F#5*2 G5*4 B5*8', 'C6*2 B5*2 A5*2 G5*2 E5*8', 'A5*4 C6*4 E6*8', 'D#6*8 B5*8'] },
    { chords: 'C D Em Em Am B Em Em', style: 'epic', lead: 'strings', dbl: 'trumpet', int: 3, mel: [
      'G5*4 C6*4 E6*8', 'F#6*4 D6*4 A5*8', 'B5*6 A5*2 G5*4 E5*4', 'E6*16',
      'C6*4 A5*4 E5*8', 'D#5*4 F#5*4 B5*8', 'G5*4 B5*4 E6*8', 'E6*16'] }] },


  /* 같은 컨셉을 두 전장이 나눠 쓰는 곳도 곡은 따로 */
  return: { bpm: 104, style: 'mystic', sections: [
    { chords: 'Am Dm E Am F Dm E E', lead: 'strings', dbl: 'oboe', int: 1, mel: [
      'A4*4 C5*4 E5*8', 'F5*4 E5*4 D5*8', 'G#4*4 B4*4 E5*8', 'A4*16',
      'C5*4 F5*4 A5*8', 'A5*4 F5*4 D5*8', 'G#5*4 E5*4 B4*8', 'E5*16'] },
    { chords: 'Dm Am E Am Dm Am B E', style: 'eerie', lead: 'choir', int: 2, mel: [
      'D5*8 F5*8', 'E5*8 C5*8', 'B4*8 G#4*8', 'A4*16', 'F5*8 A5*8', 'E5*8 C5*8', 'D#5*8 F#5*8', 'E5*16'] }] },

  shieldwall: { bpm: 110, style: 'march', sections: [
    { chords: 'Eb Bb Cm Ab Eb Bb Ab Bb', lead: 'horn', int: 1, mel: [
      'Eb5*4 G5*2 F5*2 Eb5*8', 'D5*4 F5*4 Bb5*8', 'C5*4 Eb5*4 G5*8', 'Ab5*4 G5*2 F5*2 C5*8',
      'Bb4*4 Eb5*4 G5*8', 'F5*4 D5*4 Bb4*8', 'C5*4 Eb5*4 Ab5*8', 'F5*8 D5*8'] },
    { chords: 'Ab Bb Gm Cm Ab Bb Eb Eb', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'C6*6 Bb5*2 Ab5*8', 'Bb5*6 Ab5*2 F5*8', 'G5*4 Bb5*4 D6*8', 'Eb6*8 C6*8',
      'Ab5*4 C6*4 Eb6*8', 'D6*4 Bb5*4 F5*8', 'G5*4 Bb5*4 Eb6*8', 'Eb6*16'] }] },

  gate: { bpm: 120, style: 'dark', sections: [
    { chords: 'Bm Bm G F# Bm Bm Em F#', lead: 'horn', dbl: 'lowbrass', int: 1, mel: [
      'B3*4 D4*4 F#4*8', 'E4*4 D4*2 C#4*2 B3*8', 'G4*4 F#4*4 D4*8', 'C#4*8 A#3*8',
      'B3*2 C#4*2 D4*4 F#4*8', 'B4*4 A4*4 F#4*8', 'G4*4 E4*4 B3*8', 'A#3*8 C#4*8'] },
    { chords: 'G A Bm Bm G A F# F#', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'D5*4 G5*4 B5*8', 'C#6*4 A5*4 E5*8', 'F#5*6 E5*2 D5*8', 'B4*16',
      'G5*4 B5*4 D6*8', 'E6*4 C#6*4 A5*8', 'A#5*4 C#6*4 F#5*8', 'F#5*16'] }] },

  throne: { bpm: 124, style: 'dark', sections: [
    { chords: 'Em Em C D Em Em Am B', lead: 'horn', dbl: 'lowbrass', int: 1, mel: [
      'E4*2 E4*2 G4*2 E4*2 B4*8', 'A4*2 G4*2 F#4*2 G4*2 E4*8', 'C5*4 B4*4 G4*8', 'A4*4 F#4*4 D4*8',
      'E4*2 G4*2 B4*4 E5*8', 'D5*4 C5*4 B4*8', 'A4*4 C5*4 E5*8', 'D#5*8 B4*8'] },
    { chords: 'C D Em Em C D B B', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'E5*4 G5*4 C6*8', 'D6*4 A5*4 F#5*8', 'G5*6 F#5*2 E5*8', 'B4*16',
      'G5*4 C6*4 E6*8', 'F#6*4 D6*4 A5*8', 'D#6*4 B5*4 F#5*8', 'B5*16'] }] },

  seal: { bpm: 96, style: 'mystic', sections: [
    { chords: 'Ebm Cb Gb Db Ebm Cb Bb Bb', lead: 'choir', int: 1, mel: [
      'Eb5*8 Gb5*8', 'F5*8 Eb5*8', 'Db5*8 Bb4*8', 'Ab4*8 F4*8',
      'Gb4*4 Bb4*4 Eb5*8', 'Eb5*4 Gb5*4 B5*8', 'D5*8 F5*8', 'Bb4*16'] },
    { chords: 'Cb Db Ebm Ebm Cb Db Bb Bb', style: 'eerie', lead: 'strings', dbl: 'oboe', int: 2, mel: [
      'Gb5*8 Eb5*8', 'F5*8 Ab5*8', 'Gb5*6 F5*2 Eb5*8', 'Bb4*16',
      'Eb5*4 Gb5*4 B5*8', 'Ab5*4 F5*4 Db5*8', 'D5*4 F5*4 Bb5*8', 'Bb4*16'] }] },

  siege: { bpm: 118, style: 'march', sections: [
    { chords: 'Fm Db Eb C Fm Db Bbm C', lead: 'trumpet', int: 2, mel: [
      'F4*4 Ab4*2 C5*2 F5*8', 'Db5*4 C5*2 Bb4*2 Ab4*8', 'Bb4*4 Eb5*4 G5*8', 'E5*4 C5*4 G4*8',
      'F5*2 Eb5*2 Db5*2 C5*2 Ab4*8', 'F4*4 Ab4*4 Db5*8', 'Bb4*4 Db5*4 F5*8', 'E5*8 C5*8'] },
    { chords: 'Db Eb Fm Fm Db Eb C C', style: 'ice', lead: 'strings', dbl: 'horn', int: 2, mel: [
      'Ab5*8 F5*8', 'G5*8 Eb5*8', 'F5*6 G5*2 Ab5*8', 'C6*16',
      'Db6*6 C6*2 Ab5*8', 'Bb5*6 Ab5*2 G5*8', 'E5*4 G5*4 C6*8', 'C6*16'] }] },

  /* ---------------- 보스 (웅장한 관현악 · 3.17 grand 리믹스) ---------------- */
  boss_lich: { bpm: 142, style: 'grand', sections: [
    { chords: 'Dm Dm Bb A', lead: 'choir', int: 1, mel: ['D5*16', 'F5*8 E5*8', 'D5*16', 'C#5*16'] },
    { chords: 'Dm Bb Gm A Dm Bb C A', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'D5*4 F5*2 E5*2 D5*4 A4*4', 'Bb4*4 D5*4 F5*8', 'G5*4 F5*2 E5*2 D5*4 Bb4*4', 'A4*4 C#5*4 E5*8',
      'F5*4 A5*4 D6*8', 'D6*4 C6*2 Bb5*2 F5*8', 'E5*4 G5*4 C6*8', 'C#6*8 A5*8'] },
    { chords: 'Gm Dm Bb F Gm Dm A A', lead: 'strings', dbl: 'trumpet', int: 3, mel: [
      'G5*6 Bb5*2 D6*8', 'F6*4 E6*2 D6*2 A5*8', 'Bb5*6 D6*2 F6*8', 'F6*4 E6*2 C6*2 A5*8',
      'G5*4 Bb5*4 D6*8', 'F6*4 D6*4 A5*8', 'C#6*4 E6*4 A5*8', 'A5*8 E5*8'] }] },

  boss_troll: { bpm: 136, style: 'grand', sections: [
    { chords: 'Cm Cm Ab G', lead: 'lowbrass', int: 1, mel: ['C3*4 .*4 C3*2 Eb3*2 G3*4', 'C3*16', 'Ab2*8 C3*8', 'G2*8 B2*8'] },
    { chords: 'Cm Ab Fm G Cm Ab Bb G', lead: 'horn', dbl: 'lowbrass', int: 2, mel: [
      'C4*4 Eb4*2 G4*2 C5*8', 'Ab4*4 G4*2 F4*2 Eb4*8', 'F4*4 Ab4*4 C5*8', 'B4*4 D5*4 G5*8',
      'C5*2 Bb4*2 Ab4*2 G4*2 Eb4*8', 'Ab4*4 C5*4 Eb5*8', 'D5*4 F5*4 Bb5*8', 'G5*8 B4*8'] },
    { chords: 'Fm Cm Ab Eb Fm Cm G G', lead: 'trumpet', dbl: 'horn', int: 3, mel: [
      'F5*4 Ab5*4 C6*8', 'Eb6*4 D6*2 C6*2 G5*8', 'Ab5*4 C6*4 Eb6*8', 'D6*4 Bb5*4 G5*8',
      'F5*4 Ab5*4 C6*8', 'G5*4 Eb5*4 C5*8', 'B4*4 D5*4 F5*4 G5*4', 'G5*16'] }] },

  boss_frostgiant: { bpm: 128, style: 'grand', sections: [
    { chords: 'Em C Am B', style: 'ice', lead: 'celesta', int: 1, mel: [
      'E6*4 B5*4 G5*4 E5*4', 'C6*4 G5*4 E5*8', 'A5*4 E5*4 C5*8', 'B5*4 F#5*4 D#5*8'] },
    { chords: 'Em C G D Am Em B B', lead: 'horn', dbl: 'strings', int: 2, mel: [
      'E4*6 G4*2 B4*8', 'C5*6 B4*2 G4*8', 'D5*6 C5*2 B4*8', 'A4*6 F#4*2 D4*8',
      'C5*4 E5*4 A5*8', 'G5*4 E5*4 B4*8', 'D#5*4 F#5*4 B5*8', 'B5*16'] },
    { chords: 'C D Em Em C D B B', lead: 'trumpet', dbl: 'horn', cm: [
      'E5*16', 'F#5*16', 'G5*16', 'B4*16', 'C5*16', 'D5*16', 'D#5*16', 'B4*16'], cmi: 'choir', int: 3, mel: [
      'G5*4 C6*4 E6*8', 'F#6*4 D6*4 A5*8', 'B5*6 A5*2 G5*8', 'E5*16',
      'E6*6 D6*2 C6*8', 'D6*6 C6*2 A5*8', 'B5*4 D#6*4 F#6*8', 'B5*16'] }] },

  boss_drake: { bpm: 152, style: 'grand', sections: [
    { chords: 'Gm Gm Eb D', lead: 'trumpet', int: 1, mel: [
      'G4*2 .*2 G4*2 .*2 Bb4*2 .*2 D5*4', 'G4*2 .*2 G4*2 .*2 C5*2 .*2 Bb4*4', 'Eb5*8 D5*8', 'D5*8 F#5*8'] },
    { chords: 'Gm Eb Bb F Gm Eb D D', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'G5*2 F5*2 D5*2 Bb4*2 G4*8', 'Eb5*4 D5*2 C5*2 Bb4*8', 'D5*2 F5*2 Bb5*4 A5*4 F5*4', 'C5*4 F5*4 A5*8',
      'G5*2 A5*2 Bb5*4 D6*8', 'Eb6*4 D6*2 C6*2 G5*8', 'F#5*4 A5*4 D6*8', 'D6*8 A5*8'] },
    { chords: 'Cm Gm Eb D Cm Gm D Gm', lead: 'strings', dbl: 'trumpet', int: 3, mel: [
      'C6*6 Bb5*2 G5*8', 'D6*6 C6*2 Bb5*8', 'Eb6*4 D6*4 C6*4 Bb5*4', 'A5*16',
      'C6*4 Eb6*4 G5*8', 'F5*4 D5*4 Bb5*8', 'A5*4 C6*4 F#5*8', 'G5*16'] }] },

  boss_spiderqueen: { bpm: 148, style: 'grand', sections: [
    { chords: 'F#m D F#m C#', style: 'eerie', lead: 'strings', int: 1, mel: [
      'F#4*2 A4*2 C#5*2 A4*2 F#4*2 A4*2 C#5*4', 'D5*2 F#5*2 A5*2 F#5*2 D5*8', 'F#5*2 E5*2 D5*2 C#5*2 A4*8', 'G#4*8 F4*8'] },
    { chords: 'F#m D E C# F#m Bm C# C#', lead: 'oboe', dbl: 'strings', int: 2, mel: [
      'C#5*4 D5*2 C#5*2 A4*8', 'F#5*4 E5*2 D5*2 A4*8', 'G#4*4 B4*4 E5*8', 'F5*4 G#5*4 C#6*8',
      'A5*4 G#5*2 F#5*2 C#5*8', 'D5*4 F#5*4 B5*8', 'C#6*4 B5*4 G#5*8', 'F5*8 C#5*8'] },
    { chords: 'Bm F#m D C# Bm F#m C# F#m', lead: 'trumpet', dbl: 'horn', int: 3, mel: [
      'D5*4 F#5*4 B5*8', 'A5*4 F#5*4 C#5*8', 'F#5*4 A5*4 D6*8', 'C#6*16',
      'B5*4 D6*4 F#6*8', 'E6*4 C#6*4 A5*8', 'G#5*4 F5*4 C#5*8', 'F#5*16'] }] },

  boss_warlord: { bpm: 140, style: 'grand', sections: [
    { chords: 'Am Am F E', lead: 'lowbrass', int: 1, mel: ['A2*4 .*4 A2*2 C3*2 E3*4', 'A2*16', 'F2*8 A2*8', 'E2*8 G#2*8'] },
    { chords: 'Am F G E Am F Dm E', lead: 'horn', dbl: 'lowbrass', int: 2, mel: [
      'A4*4 C5*2 B4*2 A4*4 E4*4', 'F4*4 A4*4 C5*8', 'D5*4 B4*4 G4*8', 'G#4*4 B4*4 E5*8',
      'A5*4 G5*2 F5*2 E5*8', 'F5*4 C5*4 A4*8', 'D5*4 F5*4 A5*8', 'G#5*8 E5*8'] },
    { chords: 'F G Am Am F G E E', lead: 'trumpet', dbl: 'strings', int: 3, mel: [
      'C6*6 B5*2 A5*8', 'B5*6 A5*2 G5*8', 'A5*4 C6*4 E6*8', 'E6*16',
      'F6*4 E6*4 C6*8', 'D6*4 B5*4 G5*8', 'G#5*4 B5*4 E6*8', 'E6*16'] }] },

  /* 마지막 전장: 네 악장처럼 쌓아 올려 장조로 끝난다 */
  finale: { bpm: 138, style: 'grand', sections: [
    { chords: 'Dm Bb F C Gm Dm A A', lead: 'choir', int: 1, mel: [
      'D5*16', 'D5*8 F5*8', 'C5*16', 'E5*16', 'G5*8 Bb5*8', 'A5*8 F5*8', 'E5*8 C#5*8', 'A4*16'] },
    { chords: 'Dm Bb Gm A Dm Bb C A', lead: 'horn', dbl: 'lowbrass', int: 2, mel: [
      'D4*4 F4*4 A4*6 G4*2', 'F4*4 D4*4 Bb3*8', 'G4*4 Bb4*4 D5*6 C5*2', 'C#5*16',
      'D5*4 F5*4 A5*6 G5*2', 'F5*4 D5*4 Bb4*8', 'C5*4 E5*4 G5*8', 'E5*8 C#5*8'] },
    { chords: 'Gm Dm Bb F Gm Dm A A', lead: 'trumpet', dbl: 'strings', int: 3, mel: [
      'G5*4 Bb5*4 D6*8', 'D6*4 C6*2 Bb5*2 A5*8', 'Bb5*4 D6*4 F6*8', 'F6*4 E6*2 D6*2 C6*8',
      'Bb5*4 D6*4 G6*8', 'F6*4 E6*2 D6*2 A5*8', 'C#6*4 E6*4 A5*8', 'A5*16'] },
    { chords: 'D G A D Bm G A D', lead: 'trumpet', dbl: 'horn', cm: [
      'A4*16', 'B4*16', 'C#5*16', 'D5*16', 'D5*16', 'B4*16', 'C#5*16', 'A4*16'], cmi: 'choir', int: 3, mel: [
      'F#5*4 A5*4 D6*8', 'D6*4 B5*4 G5*8', 'A5*4 C#6*4 E6*8', 'D6*16',
      'B5*4 D6*4 F#6*8', 'G6*4 F#6*2 E6*2 D6*8', 'E6*4 C#6*4 A5*8', 'D6*16'] }] },

  /* ---------------- 한 번 울리는 곡 ---------------- */
  victory: { bpm: 100, style: 'fanfare', once: true, sections: [
    { chords: 'C G C', lead: 'trumpet', dbl: 'horn', int: 3, mel: [
      'C5*2 E5*2 G5*4 C6*8', 'B5*2 A5*2 G5*2 F5*2 D5*8', 'C6*16'] }] },
  defeat: { bpm: 66, style: 'lament', once: true, sections: [
    { chords: 'Dm Bb A Dm', lead: 'strings', int: 1, mel: [
      'D5*8 C5*4 Bb4*4', 'A4*8 F4*8', 'E4*8 C#4*8', 'D4*16'] }] },

  /* ---------------- 3.3 3막 '심연의 바다': 전장 열 곡 · 보스 둘 · 마지막 곡 ---------------- */
  shore: { bpm: 118, style: 'folk', sections: [
    { chords: 'D G A D Bm G A D', lead: 'flute', int: 1, mel: [
      'F#5*2 G5*2 A5*4 F#5*4 D5*4',
      'B4*6 A4*2 G4*8',
      'A4*3 D5 E5*4 C#5*4 E5*4',
      'F#5*4 A5*4 F#5*8',
      'D5*6 E5*2 F#5*4 D5*4',
      'B4*2 A4*2 G4*2 B4*2 D5*4 G5*4',
      'A5*2 G5*2 E5*4 C#5*4 A4*4',
      'D5*12 .*4'] },
    { chords: 'G D Em A G D A D', lead: 'oboe', dbl: 'strings', int: 2, mel: [
      'G5*2 A5*2 G5*4 D5*8',
      'A4*6 D5*2 F#5*8',
      'G5*4 E5*4 G5*8',
      'E5*2 D5*2 A4*4 C#5*4 A4*4',
      'B4*2 E5*2 B4*2 C#5*2 D5*4 G5*4',
      'A5*2 E5*2 D5*4 A4*4 D5*4',
      'E5*4 C#5*4 E5*8',
      'D5*12 .*4'] }] },

  coral: { bpm: 126, style: 'light', sections: [
    { chords: 'F C Dm Bb F C Bb C', lead: 'celesta', int: 1, mel: [
      'F5*2 E5*2 F5*4 A5*4 C6*4',
      'G5*4 E5*4 G5*4 E5*4',
      'D5*2 C5*2 A4*4 D5*8',
      'F5*4 E5*2 C5*2 D5*8',
      'F5*3 C5 A4*4 C5*4 F5*4',
      'G5*4 Bb5*2 C6*2 G5*8',
      'F5*6 E5*2 F5*8',
      'C5*12 .*4'] },
    { chords: 'Bb F Gm C Bb F C F', lead: 'flute', dbl: 'harp', int: 2, mel: [
      'F5*6 G5*2 F5*8',
      'C5*4 F5*4 A5*4 F5*4',
      'D5*2 Bb4*2 G4*2 A4*2 D5*4 G5*4',
      'E5*4 A5*2 G5*2 E5*8',
      'F5*6 G5*2 D5*8',
      'A4*2 G4*2 C5*4 F5*8',
      'E5*4 D5*2 Bb4*2 G4*8',
      'F5*12 .*4'] }] },

  krakenbay: { bpm: 112, style: 'dark', sections: [
    { chords: 'Dm Bb C A Dm Gm A A', lead: 'lowbrass', int: 1, mel: [
      'F4*8 A4*4 F4*4',
      'D4*6 C4*2 Bb3*8',
      'C4*4 Bb3*2 A3*2 G3*8',
      'A3*3 C4 E4*4 A4*4 E4*4',
      'D4*6 C4*2 A3*4 D4*4',
      'Bb3*6 G3*2 Bb3*4 D4*4',
      'E4*4 A4*4 E4*4 A4*4',
      'A4*12 .*4'] },
    { chords: 'Gm Dm Bb A Gm Dm Bb A', lead: 'horn', dbl: 'strings', int: 2, mel: [
      'Bb4*8 D5*4 Bb4*4',
      'D5*2 E5*2 D5*4 A4*4 D5*4',
      'Bb4*4 F4*2 E4*2 D4*8',
      'E4*2 G4*2 A4*2 C5*2 C#5*4 E5*4',
      'D5*2 C5*2 Bb4*4 G4*8',
      'A4*4 D5*4 A4*8',
      'F4*6 A4*2 Bb4*8',
      'A4*12 .*4'] }] },

  lighthouse: { bpm: 84, style: 'mystic', sections: [
    { chords: 'Em C G D Em C B7 B7', lead: 'oboe', int: 1, mel: [
      'E5*4 G5*4 E5*4 G5*4',
      'E5*8 C5*4 E5*4',
      'D5*6 F#5*2 G5*8',
      'D5*4 A4*4 D5*8',
      'B4*4 G4*4 B4*4 G4*4',
      'C5*4 E5*4 G5*4 E5*4',
      'Eb5*8 B4*4 A4*4',
      'B4*12 .*4'] },
    { chords: 'C G Am Em C D B7 Em', lead: 'strings', dbl: 'choir', int: 2, mel: [
      'G5*8 E5*4 G5*4',
      'D5*6 B4*2 D5*8',
      'E5*8 A5*4 E5*4',
      'G5*6 F#5*2 G5*8',
      'E5*4 C5*4 G4*8',
      'A4*4 D5*4 F#5*8',
      'Eb5*4 B4*4 A4*8',
      'E5*12 .*4'] }] },

  sirensong: { bpm: 92, style: 'eerie', sections: [
    { chords: 'Am F C G Am F E E', lead: 'choir', int: 1, mel: [
      'E5*8 A5*4 E5*4',
      'C5*6 G4*2 C5*8',
      'E5*6 C5*2 G4*8',
      'B4*4 D5*4 G5*8',
      'E5*4 C5*4 E5*8',
      'A5*4 F5*4 C5*8',
      'Ab4*6 C5*2 E5*8',
      'E5*12 .*4'] },
    { chords: 'F G Am Am Dm F E E', lead: 'flute', dbl: 'harp', int: 2, mel: [
      'F5*2 G5*2 F5*4 C5*4 A4*4',
      'G4*4 B4*2 D5*2 G5*8',
      'A5*6 F5*2 C5*8',
      'A4*4 C5*2 D5*2 E5*8',
      'F5*6 A5*2 F5*4 A5*4',
      'F5*4 G5*2 A5*2 F5*8',
      'E5*6 C5*2 Ab4*8',
      'E5*12 .*4'] }] },

  tidetemple: { bpm: 100, style: 'mystic', sections: [
    { chords: 'Gm Eb Bb F Gm Eb D D', lead: 'harp', int: 1, mel: [
      'G5*4 D5*4 Bb4*4 G4*4',
      'Bb4*4 Eb5*4 G5*8',
      'D5*8 F5*4 D5*4',
      'C5*2 G4*2 A4*4 C5*4 A4*4',
      'G4*2 Bb4*2 G4*4 Bb4*8',
      'Eb5*6 G5*2 Eb5*8',
      'D5*2 Bb4*2 A4*4 D5*8',
      'D5*12 .*4'] },
    { chords: 'Cm Gm Eb D Cm Gm D D', lead: 'choir', dbl: 'strings', int: 2, mel: [
      'G5*8 Eb5*4 C5*4',
      'D5*4 G5*4 D5*8',
      'G5*6 A5*2 G5*8',
      'A5*4 F#5*4 D5*8',
      'C5*6 G4*2 C5*8',
      'Bb4*6 Eb5*2 Bb4*8',
      'D5*8 F#5*4 A5*4',
      'D5*12 .*4'] }] },

  sunken: { bpm: 88, style: 'lament', sections: [
    { chords: 'Cm Ab Eb Bb Cm Fm G G', lead: 'oboe', int: 1, mel: [
      'Eb5*6 G5*2 Eb5*4 C5*4',
      'Ab4*6 Bb4*2 Ab4*8',
      'Bb4*4 G4*4 Bb4*4 Eb5*4',
      'F5*8 D5*4 F5*4',
      'G5*6 Ab5*2 G5*4 Eb5*4',
      'C5*4 F5*4 Ab5*8',
      'G5*6 Eb5*2 G5*8',
      'G5*12 .*4'] },
    { chords: 'Ab Eb Fm Cm Ab Bb G G', lead: 'strings', dbl: 'horn', int: 2, mel: [
      'Eb5*8 Ab5*4 Eb5*4',
      'G5*4 Eb5*4 Bb4*8',
      'C5*6 Eb5*2 F5*8',
      'G5*8 Eb5*4 C5*4',
      'Eb5*4 Ab5*4 Eb5*8',
      'Bb4*8 F5*4 D5*4',
      'B4*8 G4*4 B4*4',
      'G4*12 .*4'] }] },

  strait: { bpm: 140, style: 'action', sections: [
    { chords: 'Em C D B7 Em C D B7', lead: 'trumpet', int: 2, mel: [
      'G5*2 A5*2 E5*4 B4*4 G4*4',
      'C5*2 D5*2 G5*4 E5*8',
      'F#5*3 A5 F#5*4 A5*4 F#5*4',
      'Eb5*2 D5*2 A4*2 G4*2 A4*4 B4*4',
      'E5*3 G5 E5*4 B4*4 E5*4',
      'C5*3 D5 C5*4 E5*4 G5*4',
      'A5*2 F#5*2 G5*2 D5*2 A4*4 D5*4',
      'B4*12 .*4'] },
    { chords: 'C D Em Em Am B7 Em Em', lead: 'horn', dbl: 'strings', int: 3, mel: [
      'G5*2 A5*2 E5*4 C5*4 G4*4',
      'A4*4 D5*4 F#5*4 A5*4',
      'E5*2 C5*2 E5*4 G5*4 E5*4',
      'G5*2 E5*2 G5*4 E5*4 G5*4',
      'A5*2 F#5*2 E5*2 D5*2 A4*4 C5*4',
      'B4*2 E5*2 B4*4 A4*4 B4*4',
      'E5*3 A5 E5*4 B4*4 G4*4',
      'E5*12 .*4'] }] },

  abyssgate: { bpm: 104, style: 'dark', sections: [
    { chords: 'Cm Cm Ab G Cm Fm G G', lead: 'lowbrass', int: 1, mel: [
      'Eb4*8 G4*4 Eb4*4',
      'C4*4 G3*4 C4*8',
      'Ab3*8 C4*4 Eb4*4',
      'G4*8 D4*4 G4*4',
      'Eb4*8 C4*4 G3*4',
      'Ab3*4 C4*4 F4*8',
      'G4*6 Ab4*2 G4*8',
      'G4*12 .*4'] },
    { chords: 'Ab Bb Cm Cm Fm G Cm Cm', lead: 'choir', dbl: 'lowstr', int: 2, mel: [
      'Eb5*2 C5*2 Eb5*4 Ab5*4 Eb5*4',
      'F5*3 G5 D5*4 Bb4*4 D5*4',
      'C5*2 Ab4*2 C5*4 Eb5*8',
      'G5*4 Ab5*2 F5*2 C5*8',
      'Ab4*2 Bb4*2 C5*4 F5*8',
      'D5*2 C5*2 G4*4 B4*4 D5*4',
      'Eb5*4 Bb4*2 Ab4*2 C5*8',
      'C5*12 .*4'] }] },

  leviathan: { bpm: 120, style: 'epic', sections: [
    { chords: 'Dm F C Gm Dm Bb A A', lead: 'horn', int: 2, mel: [
      'F5*2 G5*2 A5*2 E5*2 D5*4 A4*4',
      'C5*2 F5*2 A5*4 F5*4 C5*4',
      'G4*6 C5*2 E5*8',
      'G5*2 A5*2 G5*2 E5*2 G5*4 D5*4',
      'A4*2 G4*2 A4*4 D5*8',
      'F5*2 G5*2 F5*4 D5*8',
      'C#5*2 Bb4*2 A4*4 C#5*4 E5*4',
      'A5*12 .*4'] },
    { chords: 'Bb C Dm Dm Gm A Dm Dm', lead: 'trumpet', dbl: 'strings', int: 3, mel: [
      'F5*4 D5*4 Bb4*8',
      'G4*4 A4*2 C5*2 E5*8',
      'A5*2 F5*2 C5*2 Bb4*2 A4*4 D5*4',
      'A4*4 D5*4 A4*8',
      'G4*2 A4*2 Bb4*2 D5*2 G5*4 D5*4',
      'E5*2 C5*2 A4*4 C#5*8',
      'D5*4 F5*2 A5*2 F5*8',
      'D5*12 .*4'] }] },

  /* ---------------- 3.18 새 보스곡 (grand): 이벤트 보스 · 황금룡 — 다른 보스곡을 빌려 쓰지 않게 ---------------- */
  boss_vampire: { bpm: 150, style: 'grand', sections: [            // E1 흡혈 백작: 고딕 · 라단조
    { chords: 'Dm Dm Bb A', lead: 'choir', int: 1, mel: [
      'D5*8 F5*4 E5*4', 'D5*4 C#5*4 D5*8', 'Bb4*8 D5*4 F5*4', 'E5*8 C#5*8'] },
    { chords: 'Dm Gm A Dm Bb Gm A A', lead: 'trumpet', dbl: 'strings', int: 2, mel: [
      'D5*2 E5*2 F5*2 A5*2 D6*4 A5*4', 'Bb5*4 A5*2 G5*2 F5*4 D5*4', 'E5*2 F5*2 G5*2 A5*2 C#6*8', 'D6*6 C6*2 A5*8',
      'F5*2 G5*2 A5*2 Bb5*2 D6*4 Bb5*4', 'G5*4 Bb5*4 D6*4 G5*4', 'A5*2 Bb5*2 C#6*2 E6*2 A5*8', 'E6*4 D6*2 C#6*2 A5*8'] },
    { chords: 'Bb C Dm Dm Gm A Dm Dm', lead: 'trumpet', dbl: 'horn', int: 3,
      cm: ['D5*16', 'E5*16', 'F5*16', 'F5*16', 'D5*16', 'C#5*16', 'D5*16', 'D5*16'], cmi: 'choir', mel: [
      'F5*4 Bb5*4 D6*8', 'E6*4 C6*4 G5*8', 'A5*2 D6*2 F6*4 E6*4 D6*4', 'A5*6 D6*2 F6*8',
      'G5*4 Bb5*4 D6*4 G6*4', 'A5*4 C#6*4 E6*4 G6*4', 'F6*4 E6*2 D6*2 C#6*4 E6*4', 'D6*12 .*4'] }] },

  boss_titan: { bpm: 136, style: 'grand', sections: [              // E2 거신: 무거운 다단조
    { chords: 'Cm Cm Ab G', lead: 'lowbrass', int: 1, mel: [
      'C3*4 C3*2 C3*2 Eb3*4 G3*4', 'C3*2 .*2 C3*2 .*2 Bb2*8', 'Ab2*8 C3*4 Eb3*4', 'G2*8 B2*8'] },
    { chords: 'Cm Fm Ab G Cm Fm Bb G', lead: 'horn', dbl: 'lowbrass', int: 2, mel: [
      'C5*4 G4*2 C5*2 Eb5*4 D5*4', 'F5*4 Eb5*2 D5*2 C5*8', 'Ab4*2 C5*2 Eb5*4 Ab5*8', 'G5*4 F5*2 Eb5*2 D5*8',
      'C5*2 D5*2 Eb5*2 G5*2 C6*8', 'Ab5*4 G5*2 F5*2 C5*8', 'Bb4*2 D5*2 F5*4 Bb5*8', 'B4*4 D5*4 G5*8'] },
    { chords: 'Ab Bb Cm Cm Fm G Cm Cm', lead: 'trumpet', dbl: 'horn', int: 3, mel: [
      'Eb5*4 Ab5*4 C6*8', 'D6*4 Bb5*4 F5*8', 'G5*2 C6*2 Eb6*4 D6*4 C6*4', 'C6*16',
      'Ab5*4 C6*4 F6*8', 'G5*4 B5*4 D6*4 F6*4', 'Eb6*4 D6*2 C6*2 B5*4 D6*4', 'C6*12 .*4'] }] },

  boss_ghostfleet: { bpm: 154, style: 'grand', sections: [         // E3 망령 함대: 질주하는 뱃노래 · 마단조
    { chords: 'Em Em C B', lead: 'flute', int: 1, mel: [
      'E5*2 .*2 E5*2 G5*2 B5*4 G5*4', 'A5*2 G5*2 F#5*2 E5*2 B4*8', 'C5*2 E5*2 G5*2 E5*2 C5*8', 'B4*4 D#5*4 F#5*8'] },
    { chords: 'Em D C B Em G Am B', lead: 'horn', dbl: 'strings', int: 2, mel: [
      'E5*2 F#5*2 G5*2 E5*2 B5*4 G5*4', 'A5*2 F#5*2 D5*2 F#5*2 A5*8', 'G5*2 E5*2 C5*2 E5*2 G5*8', 'F#5*4 D#5*4 B4*8',
      'E5*2 G5*2 B5*2 G5*2 E6*8', 'D6*4 B5*2 G5*2 D5*8', 'C6*2 B5*2 A5*2 G5*2 E5*8', 'F#5*4 A5*4 D#6*8'] },
    { chords: 'C D Em Em Am B Em Em', lead: 'trumpet', dbl: 'horn', int: 3,
      cm: ['E4*16', 'D4*16', 'E4*16', 'B3*16', 'C4*16', 'B3*16', 'E4*16', 'E4*16'], cmi: 'choir', mel: [
      'G4*4 C5*4 E5*8', 'F#5*4 D5*4 A4*8', 'B4*2 E5*2 G5*4 F#5*4 E5*4', 'E5*16',
      'C5*4 E5*4 A5*8', 'B4*4 D#5*4 F#5*8', 'G5*4 F#5*2 E5*2 D#5*4 F#5*4', 'E5*12 .*4'] }] },

  boss_voidlord: { bpm: 146, style: 'grand', sections: [           // E4 공허 군주: 감7 화음이 섞인 올림바단조
    { chords: 'F#m F#dim D C#', lead: 'choir', int: 1, mel: [
      'F#5*8 A5*4 G#5*4', 'F#5*4 C5*4 F#5*8', 'D5*8 F#5*4 A5*4', 'G#5*8 F5*8'] },
    { chords: 'F#m D Bm C# F#m D E C#', lead: 'oboe', dbl: 'strings', int: 2, mel: [
      'F#5*2 G#5*2 A5*2 C#6*2 F#6*4 C#6*4', 'D6*4 C#6*2 B5*2 A5*8', 'B5*2 A5*2 F#5*2 D5*2 B4*8', 'C#5*4 F5*4 G#5*8',
      'A5*2 G#5*2 F#5*2 C#5*2 F#5*8', 'F#5*2 A5*2 D6*4 C#6*4 A5*4', 'B5*4 G#5*4 E5*8', 'F5*4 G#5*4 C#6*8'] },
    { chords: 'D E F#m F#m Bm C# F#m F#m', lead: 'trumpet', dbl: 'horn', int: 3, mel: [
      'A4*4 D5*4 F#5*8', 'G#5*4 E5*4 B4*8', 'C#5*2 F#5*2 A5*4 G#5*4 F#5*4', 'F#5*16',
      'D5*4 F#5*4 B5*8', 'C#5*4 F5*4 G#5*8', 'A5*4 G#5*2 F#5*2 F5*4 G#5*4', 'F#5*12 .*4'] }] },

  boss_demonking: { bpm: 156, style: 'grand', sections: [          // E5 마왕: 가장 빠르고 사나운 나단조
    { chords: 'Bm Bm G F#', lead: 'lowbrass', int: 1, mel: [
      'B2*4 B2*2 D3*2 F#3*4 B3*4', 'A3*4 F#3*4 D3*8', 'G2*8 B2*4 D3*4', 'F#2*8 A#2*8'] },
    { chords: 'Bm G D F# Bm Em F# F#', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'B4*2 C#5*2 D5*2 F#5*2 B5*4 F#5*4', 'G5*4 F#5*2 E5*2 D5*8', 'A5*2 F#5*2 D5*2 F#5*2 A5*8', 'A#5*4 C#6*4 F#6*8',
      'B5*2 A5*2 F#5*2 D5*2 B4*8', 'E5*2 G5*2 B5*4 A5*4 G5*4', 'F#5*4 A#5*4 C#6*4 E6*4', 'F#6*8 C#6*8'] },
    { chords: 'G A Bm Bm Em F# Bm Bm', lead: 'strings', dbl: 'trumpet', int: 3,
      cm: ['B4*16', 'C#5*16', 'D5*16', 'D5*16', 'E5*16', 'C#5*16', 'D5*16', 'B4*16'], cmi: 'choir', mel: [
      'D5*4 G5*4 B5*8', 'C#5*4 E5*4 A5*8', 'B5*4 A5*2 F#5*2 D5*8', 'B4*16',
      'E5*4 G5*4 B5*8', 'F#5*4 A#5*4 C#6*8', 'B5*4 A5*2 F#5*2 D5*4 F#5*4', 'B5*12 .*4'] }] },

  boss_goldwyrm: { bpm: 150, style: 'grand', sections: [           // G3 황금룡: 보물산의 승부 · 가단조에서 밝게
    { chords: 'Am Am F E', lead: 'horn', int: 1, mel: [
      'A4*4 C5*4 E5*8', 'D5*4 C5*2 B4*2 A4*8', 'F4*4 A4*4 C5*8', 'B4*8 G#4*8'] },
    { chords: 'Am F C G Am F E E', lead: 'trumpet', dbl: 'strings', int: 2, mel: [
      'A4*2 B4*2 C5*2 E5*2 A5*4 E5*4', 'F5*4 E5*2 D5*2 C5*8', 'E5*2 D5*2 C5*2 G4*2 C5*8', 'B4*4 D5*4 G5*8',
      'A5*2 G5*2 E5*2 C5*2 A4*8', 'C5*2 F5*2 A5*4 G5*4 F5*4', 'E5*4 G#5*4 B5*8', 'G#5*8 E5*8'] },
    { chords: 'F G Am Am F G E E', lead: 'trumpet', dbl: 'horn', int: 3, mel: [
      'C5*4 F5*4 A5*8', 'B5*4 G5*4 D5*8', 'E5*2 A5*2 C6*4 B5*4 A5*4', 'A5*16',
      'A5*4 C6*4 F5*8', 'G5*4 B5*4 D6*8', 'E6*4 D6*2 C6*2 B5*4 G#5*4', 'A5*12 .*4'] }] },

  /* ---------------- 3.19 하드코어 곡 (grand): 신나고 웅장하고 빠르게 — 막마다 하나 + 하드코어 보스 ---------------- */
  hc_iron: { bpm: 160, style: 'grand', sections: [               // 1막 하드코어: 나단조에서 라장조로 치고 나간다
    { chords: 'Bm Bm G A', lead: 'horn', int: 1, mel: [
      'B4*4 D5*4 F#5*8', 'E5*4 D5*4 B4*8', 'G4*4 B4*4 D5*8', 'C#5*8 E5*8'] },
    { chords: 'Bm G D A Bm G A A', lead: 'trumpet', dbl: 'horn', int: 2, mel: [
      'B4*2 D5*2 F#5*2 B5*2 A5*4 F#5*4', 'G5*2 F#5*2 E5*2 D5*2 B4*8', 'A4*2 D5*2 F#5*2 A5*2 D6*8', 'C#6*4 A5*4 E5*8',
      'B5*2 A5*2 F#5*2 D5*2 B4*4 D5*4', 'E5*2 G5*2 B5*4 A5*4 G5*4', 'F#5*4 A5*4 C#6*8', 'E6*8 C#6*8'] },
    { chords: 'G A F#m Bm G A D D', lead: 'strings', dbl: 'trumpet', int: 3,
      cm: ['B4*16', 'C#5*16', 'C#5*16', 'B4*16', 'B4*16', 'C#5*16', 'A4*16', 'A4*16'], cmi: 'choir', mel: [
      'D5*4 G5*4 B5*8', 'C#5*4 E5*4 A5*8', 'C#5*2 F#5*2 A5*4 G5*4 F#5*4', 'D5*4 F#5*4 B5*8',
      'B5*4 A5*2 G5*2 D5*8', 'E5*4 A5*4 C#6*8', 'D6*6 C#6*2 A5*8', 'D6*12 .*4'] }] },

  hc_storm: { bpm: 164, style: 'grand', sections: [              // 2막 하드코어: 몰아치는 마단조, 사장조로 들어 올린다
    { chords: 'Em Em C D', lead: 'lowbrass', int: 1, mel: [
      'E3*2 E3*2 .*2 E3*2 G3*4 B3*4', 'E3*2 E3*2 .*2 E3*2 D3*8', 'C3*4 E3*4 G3*8', 'D3*8 F#3*8'] },
    { chords: 'Em C G D Em C D B', lead: 'horn', dbl: 'strings', int: 2, mel: [
      'E5*2 G5*2 B5*2 G5*2 E5*4 B4*4', 'C5*2 E5*2 G5*2 C6*2 B5*8', 'D5*2 G5*2 B5*4 A5*4 G5*4', 'F#5*4 A5*4 D6*8',
      'E6*2 D6*2 B5*2 G5*2 E5*8', 'C6*4 B5*2 A5*2 G5*8', 'A5*2 B5*2 C6*2 D6*2 F#6*8', 'D#6*8 B5*8'] },
    { chords: 'C D G Em C D B B', lead: 'trumpet', dbl: 'horn', int: 3, mel: [
      'E5*4 G5*4 C6*8', 'F#5*4 A5*4 D6*8', 'G5*2 B5*2 D6*4 B5*4 G5*4', 'E5*4 G5*4 B5*8',
      'C6*4 E6*4 G5*8', 'A5*4 D6*4 F#5*8', 'B5*4 D#6*4 F#5*8', 'B5*12 .*4'] }] },

  hc_abyss: { bpm: 158, style: 'grand', sections: [              // 3막 하드코어: 다단조에서 내림마장조의 영웅 주제로
    { chords: 'Cm Ab Eb Bb', lead: 'choir', int: 1, mel: [
      'C5*8 Eb5*4 G5*4', 'Ab5*8 G5*4 Eb5*4', 'G5*8 Bb5*4 G5*4', 'F5*8 D5*8'] },
    { chords: 'Cm Ab Eb Bb Cm Ab Bb G', lead: 'trumpet', dbl: 'strings', int: 2, mel: [
      'C5*2 Eb5*2 G5*2 C6*2 Bb5*4 G5*4', 'Ab5*2 G5*2 F5*2 Eb5*2 C5*8', 'Eb5*2 G5*2 Bb5*4 Ab5*4 G5*4', 'F5*4 Bb5*4 D6*8',
      'C6*2 Bb5*2 G5*2 Eb5*2 C5*8', 'Ab4*2 C5*2 Eb5*4 Ab5*8', 'Bb5*4 D6*4 F5*8', 'B5*4 D6*4 G5*8'] },
    { chords: 'Ab Bb Eb Cm Ab Bb G G', lead: 'strings', dbl: 'trumpet', int: 3,
      cm: ['C5*16', 'D5*16', 'Eb5*16', 'C5*16', 'C5*16', 'D5*16', 'B4*16', 'B4*16'], cmi: 'choir', mel: [
      'Eb5*4 Ab5*4 C6*8', 'F5*4 Bb5*4 D6*8', 'G5*2 Bb5*2 Eb6*4 D6*4 Bb5*4', 'C6*4 G5*4 Eb5*8',
      'Ab5*4 C6*4 Eb6*8', 'D6*4 Bb5*4 F5*8', 'B5*4 D6*4 G5*8', 'G5*12 .*4'] }] },

  hc_boss: { bpm: 168, style: 'grand', sections: [               // 하드코어 보스: 가장 빠른 가단조 (화성 단음계)
    { chords: 'Am Am F E', lead: 'lowbrass', dbl: 'horn', int: 2, mel: [
      'A2*2 A2*2 C3*2 E3*2 A3*4 G#3*4', 'A2*2 A2*2 E3*2 A2*2 C3*8', 'F2*2 F2*2 A2*2 C3*2 F3*8', 'E3*8 G#2*8'] },
    { chords: 'Am Dm E Am F Dm E E', lead: 'trumpet', dbl: 'strings', int: 2, mel: [
      'A4*2 C5*2 E5*2 A5*2 G#5*4 E5*4', 'F5*2 A5*2 D6*4 C6*4 A5*4', 'G#5*2 B5*2 E6*4 D6*4 B5*4', 'C6*4 B5*2 A5*2 E5*8',
      'F5*2 A5*2 C6*2 F6*2 E6*4 C6*4', 'D6*4 F6*4 A5*8', 'B5*2 D6*2 E6*2 G#5*2 B5*8', 'G#5*8 E5*8'] },
    { chords: 'F G Am Am Dm E Am Am', lead: 'strings', dbl: 'trumpet', int: 3,
      cm: ['A4*16', 'B4*16', 'C5*16', 'C5*16', 'A4*16', 'B4*16', 'A4*16', 'A4*16'], cmi: 'choir', mel: [
      'C5*4 F5*4 A5*8', 'D5*4 G5*4 B5*8', 'E5*2 A5*2 C6*4 B5*4 A5*4', 'A5*16',
      'F5*4 A5*4 D6*8', 'E5*4 G#5*4 B5*8', 'C6*4 B5*2 A5*2 G#5*4 B5*4', 'A5*12 .*4'] }] },

  boss_kraken: { bpm: 146, style: 'grand', sections: [
    { chords: 'Em Em C B', lead: 'lowbrass', int: 1, mel: [
      'E4*4 G4*2 D4*2 G4*8',
      'E4*3 F#4 E4*4 B3*4 G3*4',
      'E3*6 A3*2 E3*4 G3*4',
      'B3*12 .*4'] },
    { chords: 'Em C D B Em C Am B', lead: 'horn', dbl: 'lowbrass', int: 2, mel: [
      'E5*2 G5*2 D5*2 E5*2 G5*4 E5*4',
      'G5*3 A5 E5*4 C5*4 G4*4',
      'A4*8 D5*4 A4*4',
      'B4*4 A4*2 G4*2 B4*8',
      'E5*4 G5*2 A5*2 E5*8',
      'C5*4 G4*4 C5*8',
      'E5*2 G5*2 E5*4 C5*4 A4*4',
      'B4*12 .*4'] },
    { chords: 'C D Em Em C D B B', lead: 'trumpet', dbl: 'strings', int: 3, mel: [
      'E5*3 F#5 G5*4 E5*4 C5*4',
      'A4*2 G4*2 A4*2 G4*2 A4*4 D5*4',
      'E5*2 G5*2 A5*2 E5*2 G5*4 E5*4',
      'B4*2 C5*2 E5*4 G5*4 E5*4',
      'C5*2 B4*2 G4*4 C5*4 G4*4',
      'A4*2 D5*2 F#5*4 A5*4 F#5*4',
      'Eb5*4 B4*4 Eb5*4 F#5*4',
      'B4*12 .*4'] }] },

  boss_tidequeen: { bpm: 136, style: 'grand', sections: [
    { chords: 'Gm Gm Eb D', lead: 'choir', int: 1, mel: [
      'G5*4 D5*4 G5*8',
      'D5*2 F5*2 G5*2 A5*2 G5*4 D5*4',
      'Eb5*4 Bb4*4 G4*4 Bb4*4',
      'D5*12 .*4'] },
    { chords: 'Gm Eb F D Gm Eb Cm D', lead: 'horn', dbl: 'strings', int: 2, mel: [
      'G5*3 A5 G5*4 D5*4 Bb4*4',
      'G4*4 Bb4*4 Eb5*4 G5*4',
      'A5*6 G5*2 A5*4 F5*4',
      'D5*4 A4*4 D5*4 A4*4',
      'D5*2 F5*2 Eb5*2 D5*2 Bb4*4 G4*4',
      'Bb4*2 Eb5*2 G5*4 Eb5*4 G5*4',
      'Eb5*2 C5*2 G4*4 C5*4 G4*4',
      'D5*12 .*4'] },
    { chords: 'Eb F Gm Gm Eb F D D', lead: 'trumpet', dbl: 'choir', int: 3, mel: [
      'Eb5*6 F5*2 Eb5*4 G5*4',
      'F5*3 A5 F5*4 C5*4 A4*4',
      'G4*4 Bb4*4 D5*4 Bb4*4',
      'G4*4 A4*2 Bb4*2 D5*8',
      'G5*2 A5*2 G5*4 Eb5*4 G5*4',
      'A5*2 G5*2 F5*4 A5*8',
      'F#5*6 G5*2 A5*8',
      'D5*12 .*4'] }] },

  finale2: { bpm: 136, style: 'grand', sections: [
    { chords: 'Cm Ab Eb Bb Fm Cm G G', lead: 'choir', int: 1, mel: [
      'Eb5*4 G5*4 Eb5*8',
      'C5*4 Eb5*4 Ab5*8',
      'Eb5*6 Bb4*2 Eb5*8',
      'F5*4 D5*4 F5*8',
      'Ab5*8 F5*4 C5*4',
      'G4*8 C5*4 G4*4',
      'B4*8 D5*4 G5*4',
      'G5*12 .*4'] },
    { chords: 'Cm Ab Fm G Cm Ab Bb G', lead: 'horn', dbl: 'lowbrass', int: 2, mel: [
      'Eb5*6 Ab5*2 G5*8',
      'Ab5*2 G5*2 D5*2 G5*2 Ab5*4 Eb5*4',
      'C5*3 F5 Ab5*4 F5*4 C5*4',
      'G4*2 C5*2 F5*2 Ab5*2 G5*4 D5*4',
      'Eb5*2 Bb4*2 C5*4 Eb5*8',
      'Ab5*4 G5*2 D5*2 C5*8',
      'Bb4*2 C5*2 F5*2 G5*2 F5*4 D5*4',
      'G5*12 .*4'] },
    { chords: 'Fm Cm Ab Eb Fm Cm G G', lead: 'trumpet', dbl: 'strings', int: 3, mel: [
      'F5*4 Ab5*4 F5*4 C5*4',
      'G4*2 C5*2 G4*4 C5*8',
      'Eb5*6 D5*2 Eb5*8',
      'G5*6 Ab5*2 Eb5*4 G5*4',
      'F5*6 Eb5*2 C5*4 Ab4*4',
      'G4*6 Ab4*2 C5*8',
      'D5*2 Bb4*2 D5*4 B4*4 D5*4',
      'G5*12 .*4'] },
    { chords: 'C F G C Am F G C', lead: 'trumpet', dbl: 'horn', int: 3, mel: [
      'E5*4 G5*4 E5*4 G5*4',
      'A5*4 F5*4 C5*4 A4*4',
      'G4*2 C5*2 D5*4 B4*4 G4*4',
      'C5*2 Bb4*2 C5*4 E5*4 C5*4',
      'A4*8 C5*4 A4*4',
      'C5*8 A4*4 C5*4',
      'D5*4 G5*4 D5*8',
      'C5*12 .*4'] }] },

  /* ---------------- 4.0 4막 '천공 요새': 구름 위 전장 · 바람 · 번개 ---------------- */
  cloudbridge: { bpm: 124, style: 'light', sections: [            // 41 구름 다리: 탁 트인 라장조
    { chords: 'D A Bm G D A G A', lead: 'flute', int: 1, mel: [
      'A5*2 F#5*2 D5*4 A5*4 F#5*4', 'E5*2 C#5*2 A4*4 E5*8', 'F#5*2 D5*2 B4*4 D5*4 F#5*4', 'G5*4 B5*4 G5*8',
      'A5*2 B5*2 A5*4 F#5*4 D5*4', 'E5*4 A5*4 E5*8', 'D5*2 E5*2 G5*4 B5*4 G5*4', 'A5*12 .*4'] },
    { chords: 'G D Em A G D A D', lead: 'celesta', dbl: 'strings', int: 2, mel: [
      'B5*4 G5*4 D5*8', 'A5*4 F#5*4 D5*8', 'G5*2 E5*2 B4*4 E5*8', 'C#5*4 E5*4 A5*8',
      'D6*4 B5*4 G5*8', 'F#5*2 A5*2 D6*4 A5*8', 'E5*2 F#5*2 A5*4 C#6*8', 'D6*12 .*4'] }] },

  windcliff: { bpm: 132, style: 'pastoral', sections: [          // 42 바람의 절벽: 바람 부는 가단조
    { chords: 'Am F C G Am F E E', lead: 'oboe', int: 1, mel: [
      'E5*4 A5*4 E5*8', 'F5*2 E5*2 C5*4 A4*8', 'G4*2 C5*2 E5*4 G5*8', 'D5*4 B4*4 G4*8',
      'C5*2 E5*2 A5*4 G5*4 E5*4', 'F5*4 A5*4 C6*8', 'B5*2 G#5*2 E5*4 B4*8', 'E5*12 .*4'] },
    { chords: 'F G Am Am Dm E Am Am', lead: 'flute', dbl: 'strings', int: 2, mel: [
      'A5*2 C6*2 A5*4 F5*8', 'G5*2 B5*2 D6*4 B5*8', 'C6*4 A5*4 E5*8', 'A5*2 G5*2 E5*4 C5*8',
      'D5*2 F5*2 A5*4 F5*8', 'E5*2 G#5*2 B5*4 E6*8', 'C6*4 B5*2 A5*2 E5*8', 'A5*12 .*4'] }] },

  griffinnest: { bpm: 138, style: 'action', sections: [          // 43 폭풍 그리폰의 둥지: 날개 치는 마단조
    { chords: 'Em C D B Em C D Em', lead: 'trumpet', int: 2, mel: [
      'E5*2 G5*2 B5*4 G5*4 E5*4', 'C5*2 E5*2 G5*4 E5*8', 'F#5*2 A5*2 D6*4 A5*8', 'D#5*4 F#5*4 B5*8',
      'G5*2 B5*2 E6*4 B5*4 G5*4', 'E5*2 G5*2 C6*4 G5*8', 'A5*2 F#5*2 D5*4 F#5*8', 'E5*12 .*4'] },
    { chords: 'Am Em B Em C D B B', lead: 'horn', dbl: 'strings', int: 3, mel: [
      'A5*4 C6*4 E6*8', 'B5*4 G5*4 E5*8', 'F#5*2 D#5*2 B4*4 F#5*8', 'G5*4 B5*4 E6*8',
      'E6*2 C6*2 G5*4 C6*8', 'D6*2 A5*2 F#5*4 A5*8', 'B5*4 A5*2 F#5*2 D#5*8', 'B4*12 .*4'] }] },

  skybattery: { bpm: 128, style: 'march', sections: [            // 44 천공 포대: 포성이 울리는 다단조 행진
    { chords: 'Cm Cm Ab G Cm Fm G G', lead: 'lowbrass', int: 2, mel: [
      'C5*4 C5*2 D5*2 Eb5*8', 'G5*4 Eb5*4 C5*8', 'Ab4*4 C5*4 Eb5*8', 'D5*4 B4*4 G4*8',
      'C5*2 Eb5*2 G5*4 C6*8', 'Ab5*4 F5*4 C5*8', 'D5*2 F5*2 B4*4 D5*8', 'G4*12 .*4'] },
    { chords: 'Ab Bb Eb Cm Fm G Cm Cm', lead: 'horn', dbl: 'trumpet', int: 3, mel: [
      'C6*4 Ab5*4 Eb5*8', 'D6*4 Bb5*4 F5*8', 'Eb6*4 Bb5*4 G5*8', 'C6*2 G5*2 Eb5*4 G5*8',
      'F5*2 Ab5*2 C6*4 Ab5*8', 'G5*2 B5*2 D6*4 B5*8', 'C6*4 G5*2 Eb5*2 C5*8', 'C5*12 .*4'] }] },

  thunderspire: { bpm: 146, style: 'action', sections: [         // 45 번개 첨탑: 몰아치는 나단조
    { chords: 'Bm G A F# Bm G A Bm', lead: 'trumpet', int: 2, mel: [
      'B4*2 D5*2 F#5*4 B5*8', 'G5*2 F#5*2 D5*4 B4*8', 'C#5*2 E5*2 A5*4 E5*8', 'F#5*2 A#5*2 C#6*4 A#5*8',
      'D6*2 B5*2 F#5*4 B5*8', 'B5*2 G5*2 D5*4 G5*8', 'A5*4 C#6*4 E6*8', 'B5*12 .*4'] },
    { chords: 'G D A Bm G D F# F#', lead: 'strings', dbl: 'horn', int: 3, mel: [
      'B5*4 D6*4 G5*8', 'A5*4 F#5*4 D5*8', 'E5*2 A5*2 C#6*4 A5*8', 'B5*4 D6*4 F#6*8',
      'G6*4 D6*2 B5*2 G5*8', 'F#5*2 A5*2 D6*4 F#6*8', 'E6*2 C#6*2 A#5*4 F#5*8', 'F#5*12 .*4'] }] },

  cloudthrone: { bpm: 110, style: 'epic', sections: [            // 46 구름 왕의 옥좌: 장엄한 내림마장조
    { chords: 'Eb Bb Cm Ab Eb Bb Ab Bb', lead: 'horn', int: 2, mel: [
      'G5*4 Bb5*4 Eb6*8', 'F5*4 D5*4 Bb4*8', 'Eb5*2 G5*2 C6*4 G5*8', 'Ab5*4 C6*4 Eb5*8',
      'Bb5*2 G5*2 Eb5*4 G5*8', 'D5*2 F5*2 Bb5*4 F5*8', 'C6*4 Ab5*4 Eb5*8', 'F5*12 .*4'] },
    { chords: 'Ab Eb Fm Bb Cm Ab Bb Eb', lead: 'trumpet', dbl: 'strings', int: 3, mel: [
      'C6*4 Eb6*4 Ab5*8', 'Bb5*4 G5*4 Eb5*8', 'F5*2 Ab5*2 C6*4 Ab5*8', 'D6*4 Bb5*4 F5*8',
      'Eb6*2 C6*2 G5*4 C6*8', 'Ab5*2 C6*2 Eb6*4 C6*8', 'D6*2 F6*2 Bb5*4 D6*8', 'Eb6*12 .*4'] }] },

  skygarden: { bpm: 100, style: 'mystic', sections: [            // 47 하늘 정원: 꽃잎이 떠다니는 바장조
    { chords: 'F C Dm Bb F C Bb C', lead: 'harp', int: 1, mel: [
      'A5*2 C6*2 A5*4 F5*8', 'G5*2 E5*2 C5*4 G5*8', 'F5*2 A5*2 D6*4 A5*8', 'Bb5*4 D6*4 F5*8',
      'C6*2 A5*2 F5*4 C6*8', 'E5*2 G5*2 C6*4 G5*8', 'D6*2 Bb5*2 F5*4 D5*8', 'E5*12 .*4'] },
    { chords: 'Dm Bb F C Dm Bb C F', lead: 'celesta', dbl: 'pad', int: 1, mel: [
      'F5*4 A5*4 D6*8', 'D6*2 Bb5*2 F5*4 Bb5*8', 'A5*2 C6*2 F6*4 C6*8', 'G5*4 E5*4 C5*8',
      'A5*2 F5*2 D5*4 F5*8', 'Bb5*2 D6*2 F6*4 D6*8', 'E6*2 C6*2 G5*4 E5*8', 'F5*12 .*4'] }] },

  stormeye: { bpm: 150, style: 'dark', sections: [               // 48 폭풍의 눈: 휘몰아치는 라단조
    { chords: 'Dm Dm Bb A Dm Gm A A', lead: 'lowbrass', int: 2, mel: [
      'D5*2 F5*2 A5*4 D5*8', 'A5*2 F5*2 D5*4 F5*8', 'Bb4*2 D5*2 F5*4 Bb5*8', 'A5*4 E5*4 C#5*8',
      'F5*2 A5*2 D6*4 A5*8', 'G5*2 Bb5*2 D6*4 Bb5*8', 'A5*2 C#6*2 E6*4 C#6*8', 'A5*12 .*4'] },
    { chords: 'Gm Dm A Dm Bb C A A', lead: 'strings', dbl: 'trumpet', int: 3, mel: [
      'Bb5*4 D6*4 G6*8', 'A5*4 F5*4 D5*8', 'E5*2 A5*2 C#6*4 E6*8', 'D6*4 A5*4 F5*8',
      'F5*2 Bb5*2 D6*4 F6*8', 'E6*2 C6*2 G5*4 C6*8', 'C#6*2 E6*2 A6*4 E6*8', 'A5*12 .*4'] }] },

  citadelgate: { bpm: 120, style: 'epic', sections: [            // 49 천공 성채의 문: 성문 앞의 사단조
    { chords: 'Gm Eb Bb F Gm Eb D D', lead: 'lowbrass', int: 2, mel: [
      'G4*4 Bb4*4 D5*8', 'Eb5*4 G5*4 Bb4*8', 'D5*2 F5*2 Bb5*4 F5*8', 'C5*4 A4*4 F4*8',
      'G4*2 Bb4*2 D5*4 G5*8', 'Bb5*4 G5*4 Eb5*8', 'F#5*2 A5*2 D6*4 A5*8', 'D5*12 .*4'] },
    { chords: 'Cm Gm Eb Bb Cm D Gm Gm', lead: 'trumpet', dbl: 'horn', int: 3, mel: [
      'Eb5*4 G5*4 C6*8', 'D6*4 Bb5*4 G5*8', 'G5*2 Bb5*2 Eb6*4 Bb5*8', 'F5*4 D5*4 Bb4*8',
      'C5*2 Eb5*2 G5*4 C6*8', 'A5*2 F#5*2 D5*4 F#5*8', 'G5*4 Bb5*4 D6*8', 'G5*12 .*4'] }] },

  skythrone: { bpm: 132, style: 'epic', sections: [              // 50 천공의 군주 (보스 전): 다단조에서 다장조로
    { chords: 'Cm Ab Eb G Cm Ab Bb G', lead: 'choir', int: 1, mel: [
      'G5*4 Eb5*4 C5*8', 'C5*4 Eb5*4 Ab5*8', 'Bb5*4 G5*4 Eb5*8', 'D5*4 G5*4 B5*8',
      'C6*4 G5*4 Eb5*8', 'Eb5*2 Ab5*2 C6*4 Ab5*8', 'F5*2 Bb5*2 D6*4 Bb5*8', 'B5*12 .*4'] },
    { chords: 'C G Am F C G F G', lead: 'trumpet', dbl: 'strings', int: 3, mel: [
      'E5*4 G5*4 C6*8', 'D6*4 B5*4 G5*8', 'C6*2 E6*2 A5*4 E6*8', 'F6*4 C6*4 A5*8',
      'G5*2 C6*2 E6*4 G6*8', 'D6*4 B5*4 G5*8', 'A5*2 C6*2 F6*4 C6*8', 'D6*12 .*4'] }] },

  /* ---------------- 4.0 4막 보스곡 · 피날레 · 하드코어 (배틀 록) ---------------- */
  boss_stormgriffin: { bpm: 156, style: 'grand', sections: [      // 폭풍 그리폰: 급강하하는 마단조
    { chords: 'Em Em C B', lead: 'lowbrass', int: 1, mel: [
      'E4*4 G4*2 B4*2 E5*8', 'D5*2 B4*2 G4*4 E4*8', 'C5*4 E5*4 G5*8', 'F#5*4 D#5*4 B4*8'] },
    { chords: 'Em C D B Em C B B', lead: 'horn', int: 2, mel: [
      'B5*2 G5*2 E5*2 G5*2 B5*4 E6*4', 'C6*2 B5*2 G5*2 E5*2 C5*8', 'D5*2 F#5*2 A5*2 D6*2 C6*4 A5*4', 'B5*4 F#5*4 D#5*8',
      'E5*2 G5*2 B5*2 E6*2 D6*4 B5*4', 'C6*4 G5*4 E5*8', 'F#5*2 A5*2 B5*4 D#6*8', 'E6*8 B5*8'] },
    { chords: 'C D Em Em Am B Em Em', lead: 'trumpet', int: 3, cm: ['G4*16', 'A4*16', 'B4*16', 'B4*16', 'A4*16', 'B4*16', 'G4*16', 'G4*16'], cmi: 'choir', mel: [
      'E6*4 C6*4 G5*8', 'F#6*4 D6*4 A5*8', 'G6*4 E6*2 B5*2 G5*8', 'B5*2 E6*2 G6*4 E6*8',
      'C6*4 E6*4 A6*8', 'F#6*2 D#6*2 B5*4 F#6*8', 'G6*4 F#6*2 E6*2 B5*8', 'E6*12 .*4'] }] },

  boss_cloudking: { bpm: 140, style: 'grand', sections: [         // 구름 왕: 육중한 사단조
    { chords: 'Gm Gm Eb D', lead: 'lowbrass', int: 1, mel: [
      'G4*6 Bb4*2 D5*8', 'C5*4 Bb4*4 G4*8', 'Eb5*4 G5*4 Bb4*8', 'A4*4 F#4*4 D4*8'] },
    { chords: 'Gm Cm D Gm Eb Bb D D', lead: 'horn', int: 2, mel: [
      'D5*2 G5*2 Bb5*4 A5*4 G5*4', 'Eb5*2 G5*2 C6*4 Bb5*4 G5*4', 'F#5*2 A5*2 D6*4 C6*4 A5*4', 'Bb5*4 G5*4 D5*8',
      'Eb5*2 G5*2 Bb5*4 Eb6*8', 'D6*2 Bb5*2 F5*4 D5*8', 'F#5*4 A5*4 C6*8', 'D6*8 A5*8'] },
    { chords: 'Eb F Bb Gm Cm D Gm Gm', lead: 'trumpet', int: 3, cm: ['Bb4*16', 'C5*16', 'D5*16', 'D5*16', 'Eb5*16', 'D5*16', 'D5*16', 'D5*16'], cmi: 'choir', mel: [
      'G5*4 Bb5*4 Eb6*8', 'A5*4 C6*4 F6*8', 'F6*4 D6*2 Bb5*2 F5*8', 'G5*2 Bb5*2 D6*4 G6*8',
      'Eb6*4 C6*4 G5*8', 'F#6*4 D6*2 A5*2 F#5*8', 'G5*4 D6*4 Bb5*8', 'G5*12 .*4'] }] },

  boss_skylord: { bpm: 160, style: 'grand', sections: [           // 천공의 군주: 번개처럼 빠른 라단조
    { chords: 'Dm Dm Bb A', lead: 'lowbrass', int: 1, mel: [
      'D4*2 F4*2 A4*2 D5*2 C5*4 A4*4', 'D5*4 F5*4 A5*8', 'Bb4*2 D5*2 F5*4 D5*8', 'A4*4 C#5*4 E5*8'] },
    { chords: 'Dm Gm C F Bb Gm A A', lead: 'horn', int: 2, mel: [
      'A5*2 F5*2 D5*2 F5*2 A5*4 D6*4', 'Bb5*2 G5*2 D5*2 G5*2 Bb5*8', 'C6*2 G5*2 E5*2 G5*2 C6*8', 'A5*4 F5*4 C5*8',
      'D5*2 F5*2 Bb5*4 D6*8', 'G5*2 Bb5*2 D6*4 G6*8', 'E6*2 C#6*2 A5*4 E5*8', 'A5*8 C#6*8'] },
    { chords: 'Bb C Dm Dm Gm A Dm Dm', lead: 'trumpet', int: 3, cm: ['D5*16', 'E5*16', 'F5*16', 'F5*16', 'D5*16', 'C#5*16', 'D5*16', 'D5*16'], cmi: 'choir', mel: [
      'F6*4 D6*4 Bb5*8', 'G6*4 E6*4 C6*8', 'A6*4 F6*2 D6*2 A5*8', 'D6*2 F6*2 A6*4 F6*8',
      'Bb5*4 D6*4 G6*8', 'E6*2 C#6*2 A5*4 E6*8', 'F6*4 E6*2 D6*2 A5*8', 'D6*12 .*4'] }] },

  finale3: { bpm: 140, style: 'grand', sections: [                // 4막의 끝: 다단조의 결전에서 다장조의 승리로
    { chords: 'Cm Ab Eb Bb Fm Cm G G', lead: 'choir', int: 1, mel: [
      'G5*4 C6*4 G5*8', 'Ab5*4 C6*4 Eb6*8', 'G5*6 Bb5*2 Eb6*8', 'F5*4 D5*4 Bb4*8',
      'C5*4 F5*4 Ab5*8', 'G5*4 Eb5*4 C5*8', 'B4*4 D5*4 G5*8', 'G5*12 .*4'] },
    { chords: 'Cm Fm Bb Eb Ab Fm G G', lead: 'horn', int: 2, mel: [
      'C6*2 G5*2 Eb5*2 G5*2 C6*4 Eb6*4', 'C6*2 Ab5*2 F5*2 Ab5*2 C6*8', 'D6*2 Bb5*2 F5*2 Bb5*2 D6*8', 'Eb6*4 Bb5*4 G5*8',
      'Ab5*2 C6*2 Eb6*4 C6*8', 'F5*2 Ab5*2 C6*4 F6*8', 'D6*2 B5*2 G5*4 D6*8', 'G6*8 D6*8'] },
    { chords: 'Ab Bb Cm Cm Fm G Cm G', lead: 'trumpet', int: 3, cm: ['C5*16', 'D5*16', 'Eb5*16', 'Eb5*16', 'C5*16', 'B4*16', 'C5*16', 'B4*16'], cmi: 'choir', mel: [
      'Eb6*4 C6*4 Ab5*8', 'F6*4 D6*4 Bb5*8', 'G6*4 Eb6*2 C6*2 G5*8', 'C6*2 Eb6*2 G6*4 Eb6*8',
      'Ab6*4 F6*4 C6*8', 'G6*4 D6*2 B5*2 G5*8', 'C6*4 Eb6*4 G6*8', 'B5*4 D6*4 G6*8'] },
    { chords: 'C F G C Am F G C', lead: 'trumpet', int: 3, mel: [
      'E6*4 G6*4 C6*8', 'F6*4 A6*4 C6*8', 'G6*4 D6*4 B5*8', 'C6*2 E6*2 G6*4 E6*8',
      'A5*2 C6*2 E6*4 A6*8', 'F6*4 C6*4 A5*8', 'B5*2 D6*2 G6*4 D6*8', 'C6*12 .*4'] }] },

  hc_sky: { bpm: 166, style: 'grand', sections: [                 // 4막 하드코어: 올림바단조에서 가장조로 솟구친다
    { chords: 'F#m F#m D E', lead: 'horn', int: 1, mel: [
      'F#4*4 A4*4 C#5*8', 'E5*4 C#5*4 A4*8', 'D5*4 F#5*4 A5*8', 'G#5*8 B5*8'] },
    { chords: 'F#m D A E F#m D E E', lead: 'trumpet', int: 2, mel: [
      'C#5*2 F#5*2 A5*2 C#6*2 B5*4 A5*4', 'A5*2 F#5*2 D5*2 F#5*2 A5*8', 'E5*2 A5*2 C#6*2 E6*2 C#6*8', 'B5*4 G#5*4 E5*8',
      'F#5*2 A5*2 C#6*4 F#6*8', 'D6*2 A5*2 F#5*4 A5*8', 'G#5*4 B5*4 E6*8', 'E6*8 B5*8'] },
    { chords: 'D E A F#m D E A A', lead: 'strings', int: 3, cm: ['F#5*16', 'G#5*16', 'A5*16', 'A5*16', 'F#5*16', 'G#5*16', 'E5*16', 'E5*16'], cmi: 'choir', mel: [
      'A5*4 D6*4 F#6*8', 'B5*4 E6*4 G#6*8', 'A6*4 E6*2 C#6*2 A5*8', 'C#6*4 F#6*4 A6*8',
      'F#6*4 D6*2 A5*2 F#5*8', 'G#5*2 B5*2 E6*4 G#6*8', 'A6*6 G#6*2 E6*8', 'A6*12 .*4'] }] }

};

/* 곡마다 들리는 크기를 맞춘다 (오프라인 렌더로 잰 RMS 기준: 일반 0.026, 보스 0.042) */
const BGM_GAIN = {
  title: 0.7, map: 1.27, barracks: 2.0, altar: 0.74, meadow: 1.04, wheat: 1.35,
  river: 1.72, wolfwood: 0.79, graveyard: 1.52, cave: 1.35, hills: 1.27, camp: 0.81,
  canyon: 0.81, fortress: 1.07, darkwood: 0.96, ruins: 0.96, swamp: 1.54, snowpass: 1.41,
  blizzard: 0.91, winterthrone: 1.42, volcano: 0.77, warcamp: 0.7, blackriver: 1.77, underworld: 0.7,
  thorngate: 1.02, desert: 1.35, eclipse: 0.7, mythic: 0.7, endless: 0.88, return: 0.82,
  shieldwall: 1.23, gate: 0.79, throne: 0.79, seal: 0.7, siege: 1.2, boss_lich: 1.01,
  boss_troll: 1.01, boss_frostgiant: 1.02, boss_drake: 0.99, boss_spiderqueen: 0.99, boss_warlord: 1.02, finale: 0.99,
  victory: 1.5, defeat: 1.32,
  // 3.3
  shore: 1.1, coral: 1.2, krakenbay: 0.9, lighthouse: 1.3, sirensong: 1.2, tidetemple: 1.1, sunken: 1.3,
  strait: 0.85, abyssgate: 0.95, leviathan: 0.85,
  // 3.18 새 보스곡 (렌더해 재서 맞춤)
  boss_vampire: 0.96, boss_titan: 1.02, boss_ghostfleet: 0.92, boss_voidlord: 0.97, boss_demonking: 0.96, boss_goldwyrm: 0.97,
  hc_iron: 0.98, hc_storm: 0.93, hc_abyss: 0.97, hc_boss: 0.9,
  boss_kraken: 1.0, boss_tidequeen: 1.0, finale2: 1.0,
  // 4.0 4막 (렌더해 재서 맞춤)
  cloudbridge: 1.6, windcliff: 1.5, griffinnest: 0.95, skybattery: 1.15, thunderspire: 1.0, cloudthrone: 0.7,
  skygarden: 1.0, stormeye: 0.75, citadelgate: 0.7, skythrone: 0.7,
  boss_stormgriffin: 0.93, boss_cloudking: 0.97, boss_skylord: 0.92, finale3: 0.98, hc_sky: 0.94
};

/* 3.17 보스곡 리믹스 → 3.20 배틀 록 재편곡. 보스곡 · 마지막 전장 · 이벤트 보스 · 하드코어 곡 전부.
 * 선율(주제)은 그대로, 반주를 rock 으로, 잔향을 줄이고(0.42 → 0.2), 선율 악기를 바꾼다:
 *   도입(세기 1): 합창·호른 → 일그러진 기타 리드, 플루트 → 신스 리드, 낮은 금관 리프 → 기타 리프
 *   본격(세기 2): 기타 리드 + 한 옥타브 아래 트럼펫
 *   절정(세기 3): 신스 리드 + 한 옥타브 아래 기타 리드 (합창 대선율은 그대로) */
const BGM_ROCK = ['boss_lich', 'boss_troll', 'boss_frostgiant', 'boss_drake', 'boss_spiderqueen', 'boss_warlord',
  'boss_kraken', 'boss_tidequeen', 'finale', 'finale2',
  'boss_vampire', 'boss_titan', 'boss_ghostfleet', 'boss_voidlord', 'boss_demonking', 'boss_goldwyrm',
  'hc_iron', 'hc_storm', 'hc_abyss', 'hc_boss',
  'boss_stormgriffin', 'boss_cloudking', 'boss_skylord', 'finale3', 'hc_sky'];
BGM_ROCK.forEach(k => {
  const tr = BGM_TRACKS[k];
  tr.style = 'rock'; tr.wet = 0.2;
  for (const sec of tr.sections) {
    delete sec.style;
    const I = sec.int || 1;
    if (I <= 1) {
      sec.lead = sec.lead === 'lowbrass' ? 'gtr' : (sec.lead === 'flute' || sec.lead === 'celesta') ? 'synlead' : 'gtrlead';
      delete sec.dbl;
    } else if (I === 2) { sec.lead = 'gtrlead'; sec.dbl = 'trumpet'; }
    else { sec.lead = 'synlead'; sec.dbl = 'gtrlead'; }
  }
});

/* 전장 컨셉 → 전장 곡. 보스가 나오면 보스곡, 마지막 전장은 finale. */
function stageMusic(stage, hard) {
  if (stage && stage.endless) return 'endless';
  // 3.19 하드코어: 막마다 신나고 빠른 전용 곡 (1막 · 2막 · 3막 · 4.0 4막)
  if (hard) { const i = STAGES.indexOf(stage); return typeof ACT4_FROM !== 'undefined' && i >= ACT4_FROM ? 'hc_sky' : i >= ACT3_FROM ? 'hc_abyss' : i >= 15 ? 'hc_storm' : 'hc_iron'; }
  return (stage && stage.music && BGM_TRACKS[stage.music]) ? stage.music : 'meadow';
}
function bossTrack(stage, bossId, hard) {
  if (hard) return 'hc_boss';                                     // 3.19 하드코어 보스는 모두 이 곡
  if (stage && stage.finale) return 'finale';
  if (stage && stage.bossMusic && BGM_TRACKS[stage.bossMusic]) return stage.bossMusic;   // 이벤트 보스
  return BGM_TRACKS['boss_' + bossId] ? 'boss_' + bossId : 'boss_warlord';
}
