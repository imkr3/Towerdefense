# 막대 왕국 전쟁 — 작업 규칙

## 밸런스 (5.3 부터, 사용자 지시)
- **이미 있는 전장 · 하드코어 · 도전의 난이도는 5.2 가 기준이다.** 이 곳들을 손볼 때는 5.2 값에서 출발하고, 더 어렵게 만들지 않는다.
  - 기준표: `tools/balance-baseline.json` (전장 1~80 · 도전 E1~E8 · 그 곳에 나오는 적 · 하드코어 전역 값).
  - `node tools/balance-baseline.js` 로 확인 (회귀 검사에도 들어 있다). 쉬워지는 쪽으로 고쳤을 때만 `--write` 로 다시 쓴다 (어려워진 곳이 있으면 거부한다).
- **난이도를 올리고 싶으면 새 전장(새 막) · 그 하드코어 · 새 도전으로 만든다.** 기존 곳의 적 배율 · 요새 · 보스 · 특성 · 적 능력치를 올리지 않는다.
- 새 병종이 너무 세서 검사(`sim.js --check`)가 깨지면 기존 전장을 어렵게 하지 말고 그 병종을 고친다.
- 새 전장 · 새 도전은 기준표 밖이라 자유롭게 맞춘다 (`sim.js --check` 범위 안에서).

## 릴리스
- 버전: package.json · android/app/build.gradle(versionCode) · .github/workflows/android.yml · sw.js 캐시 · js/main.js APP_VERSION.
- README 맨 위 변경 기록 + .github/release-notes.md.
- 검사: `npm run lint` · `node tools/check-assets.js` · `node tools/check-music.js` · `node tools/regression.js` · `node tools/save-regression.js` · `CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/smoke.js` · `node tools/sim.js --check`.
