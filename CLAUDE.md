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
- 버전을 올리기 전에 그 태그의 릴리스가 이미 있는지 본다 (`gh api repos/imkr3/Towerdefense/releases/tags/v<버전>`). 다른 세션 · 브랜치가 같은 번호를 먼저 쓸 수 있고, 릴리스는 다시 덮어쓸 수 없다 (5.5.0 이 그랬다 → 5.6.0).
- 이 브랜치는 저장소의 기본 브랜치라, 버전이 바뀐 커밋을 올리면 CI(`npm test` 통과 시)가 그 버전으로 릴리스를 만든다. 작업 중 커밋에는 버전을 올리지 않는다.

## 작업 기록 (사용자 지시, 5.21 부터)
- **모든 작업은 `WORKLOG.md` 의 '작업 일지' 맨 아래에 한 항목씩 남기고 커밋 · 푸시한다** (요청 · 한 일 · 검사 결과 · 남은 일).
- 질문만 한 경우도 결론을 짧게 남긴다. 버전을 올리지 않는 문서 커밋이라 릴리스는 생기지 않는다.
