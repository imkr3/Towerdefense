#!/usr/bin/env node
/* =======================================================================
 *  막대 왕국 전쟁 - 브라우저 스모크 테스트
 *
 *  실제 브라우저에서 게임을 띄워 주요 화면과 전투를 한 바퀴 돌린다.
 *  콘솔 오류가 하나라도 나면 실패로 끝난다.
 *
 *    node tools/smoke.js                 기본 (헤드리스)
 *    node tools/smoke.js --shots out/    화면 캡처도 남긴다
 *
 *  playwright 가 필요하다:  npm i -D playwright
 * ======================================================================= */

const path = require('path');
const fs = require('fs');

let chromium;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  console.error('playwright 가 없다. npm i -D playwright 후 다시 실행하라.');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'index.html');
const shotDir = process.argv.indexOf('--shots') >= 0
  ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shotDir && !fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });

const SIZES = [
  { w: 844, h: 390, name: '아이폰 가로' },
  { w: 740, h: 360, name: '소형폰 가로' },
  { w: 1180, h: 820, name: '태블릿 가로' }
];

const failures = [];

async function shot(page, name) {
  if (shotDir) await page.screenshot({ path: path.join(shotDir, name + '.png') });
}

async function runSize(browser, size) {
  const page = await browser.newPage({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(PAGE);
  // 어느 정도 진행한 저장 상태를 심어 모든 화면을 확인한다
  await page.evaluate(() => localStorage.setItem('stick-kingdom-save-v1', JSON.stringify({
    cleared: 13, coins: 60000, stones: 30, tutorial: true,
    upgrades: { wallet: 3, income: 3, power: 3, vitality: 3, castle: 3 },
    levels: {spear:3,shield:3,archer:3,mage:3,venom:3}, loadout: ['spear','shield','archer','venom','mage'], stars: { 0: 3, 1: 2 }, owned: {}
  })));
  await page.reload();
  await page.waitForTimeout(350);
  await shot(page, 'title-' + size.w);
  // Export, validation, cancellation, restore, and reload must preserve earned progress.
  const backup = await page.evaluate(() => SaveStore.export(save));
  await page.click('#btn-save-manager');
  await page.fill('#save-text', '{bad json');
  await page.click('#btn-restore-text');
  if (await page.evaluate(() => save.coins) !== 60000) throw Error('Invalid import changed progress');
  await page.fill('#save-text', backup);
  await page.click('#btn-restore-text');
  await page.click('#confirm-no');
  await page.click('#btn-restore-text');
  await page.click('#confirm-yes');
  await page.reload();
  if (!await page.evaluate(() => save.cleared === 13 && save.coins === 60000 && save.stones === 30)) throw Error('Restore did not survive reload');


  await page.click('#btn-start');
  await page.waitForTimeout(250);
  await shot(page, 'map-' + size.w);
  const originalProgress=await page.evaluate(()=>save.cleared);
  const expansionMap=await page.evaluate(()=>{
    save.cleared=20;renderMap();const cards=[...document.querySelectorAll('#stage-list .stage')];
    return {count:cards.length,open:!cards[20].disabled,locked:cards[21].disabled,endless:!!document.querySelector('#endless-slot .e-btn')};
  });
  if(expansionMap.count!==30||!expansionMap.open||!expansionMap.locked||!expansionMap.endless)throw Error('Expansion progression or endless unlock broken');
  await page.evaluate(n=>{save.cleared=n;renderMap();},originalProgress);


  // 병영
  await page.click('#btn-shop');
  await page.waitForTimeout(250);
  const upgrades = await page.$$eval('#shop-list .up-card', e => e.length);
  if (upgrades < 5) failures.push(size.name + ': 강화 항목이 부족하다 (' + upgrades + ')');
  await page.click('#scr-shop [data-goto]');

  // 훈련소
  await page.click('#btn-units');
  await page.waitForTimeout(350);
  await shot(page, 'training-' + size.w);
  const beforeOrder=await page.evaluate(()=>save.loadout.slice());
  await page.getByRole('button',{name:'창병 뒤로',exact:true}).click();
  if(!await page.evaluate(ids=>save.loadout[1]===ids[0]&&save.loadout[0]===ids[1],beforeOrder))throw Error('Loadout reorder failed');
  await page.reload(); await page.click('#btn-start'); await page.click('#btn-units');
  if(!await page.evaluate(ids=>save.loadout[1]===ids[0],beforeOrder))throw Error('Loadout order lost after reload');
  await page.evaluate(()=>{for(const id of ['runeguard','musketeer','purifier','frostlancer']){const cv=document.createElement('canvas');drawUnitIcon(cv,UNIT_BY_ID[id],60);}});

  const cards = await page.$$eval('#units-list .unit-card', e => e.length);
  if (cards < 20) failures.push(size.name + ': 훈련소 목록이 부족하다 (' + cards + ')');
  await page.click('[data-filter="enemy"]');
  const wrong = await page.$$eval('#units-list .unit-card:not([hidden])', es => es.some(e => e.dataset.kind !== 'enemy'));
  if (wrong) failures.push(size.name + ': 적 도감 필터 오류');
  await page.click('[data-filter="all"]');
  // Removing a card must survive navigation and save/reload.
  await page.evaluate(() => { save.loadout = save.loadout.filter(id => id !== 'archer'); saveGame(save); });
  await page.click('#scr-units [data-goto]');
  if (await page.evaluate(() => save.loadout.includes('archer'))) failures.push(size.name + ': 편성 해제가 취소되었다');

  // 소환
  await page.click('#btn-gacha');
  await page.waitForTimeout(350);
  await shot(page, 'gacha-' + size.w);
  await page.click('#btn-pull10');
  await page.waitForTimeout(450);
  const pulled = await page.$$eval('#pull-grid .pull-card', e => e.length);
  if (pulled !== 10) failures.push(size.name + ': 10회 소환 결과가 ' + pulled + '개다');
  const owned = await page.evaluate(() => Object.keys(save.owned).length);
  if (owned < 1) failures.push(size.name + ': 소환했는데 보유 병종이 없다');
  await page.click('#btn-pull-close');
  await page.click('#scr-gacha [data-goto]');
  await page.waitForTimeout(150);

  // Android navigation uses the same JS bridge as the packaged WebView.
  await page.click('#btn-quest');
  await page.evaluate(() => window.__androidBack());
  if (!(await page.$eval('#scr-map', e => e.classList.contains('active')))) failures.push(size.name + ': 임무 뒤로 가기 오류');

  // 전투
  await page.click('#stage-list .stage:nth-child(14)');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__androidBack());
  if (!(await page.$eval('#modal-confirm', e => e.classList.contains('show')))) failures.push(size.name + ': Android 전투 포기 확인 누락');
  await page.evaluate(() => window.__androidBack());
  if (!(await page.$eval('#scr-battle', e => e.classList.contains('active')))) failures.push(size.name + ': 취소했는데 전투가 끝났다');
  await page.evaluate(() => window.__androidPause());
  const beforePause = await page.evaluate(() => { battle.cmdCd=0; return {money:battle.money,n:battle.allies.length,t:battle.time}; });
  await page.evaluate(() => { document.querySelector('#cards .card').click(); document.querySelector('#btn-command').click(); });
  await page.waitForTimeout(100);
  const afterPause = await page.evaluate(() => ({money:battle.money,n:battle.allies.length,t:battle.time}));
  if (JSON.stringify(beforePause)!==JSON.stringify(afterPause)) failures.push(size.name + ': 정지 중 전투 상태가 바뀌었다');
  await page.keyboard.press('Space');
  await page.keyboard.press('1');
  if (!(await page.evaluate(() => battle.allies.length))) failures.push(size.name + ': 출진 단축키 오류');
  await page.click('#btn-speed');
  await page.click('#btn-speed');
  const overlap = await page.evaluate(() => {
    const a=document.querySelector('.hud-top').getBoundingClientRect();
    const b=document.querySelector('.battle-intel').getBoundingClientRect();
    const c=document.querySelector('.hud-bottom').getBoundingClientRect();
    return a.bottom>b.top || b.bottom>c.top || document.documentElement.scrollWidth>innerWidth;
  });
  if (overlap) failures.push(size.name + ': 전투 HUD 겹침 또는 가로 넘침');
  await page.waitForTimeout(100);
  let usedCommand = false;
  if (await page.evaluate(() => battle.canCommand())) {
    await page.click('#btn-command');
    usedCommand = true;
  }
  // Inputs above use the real UI. Advance combat deterministically in chunks so
  // browser scheduling and unavailable-card click timeouts cannot stall CI.
  await page.evaluate(() => { paused = true; battle.speed = 1; });
  // 증원이 끊이지 않으므로 결판이 날 때까지는 예전보다 오래 걸린다.
  for (let i = 0; i < 300; i++) {
    const done = await page.evaluate(() => {
      for (let t=0; t<30 && battle.state==='play'; t++) {
        for (const u of battle.roster) if (battle.canDeploy(u.id)) battle.deploy(u.id);
        battle.update(1/30);
      }
      renderer.render(battle, 1/60);
      updateHud();
      return battle.state !== 'play';
    });
    if (i === 60) await shot(page, 'battle-' + size.w);
    if (done) break;
  }
  const st = await page.evaluate(() => ({
    state: battle.state, allies: battle.allies.length, kills: battle.kills
  }));
  if (st.kills < 1) failures.push(size.name + ': 전투에서 처치가 0이다');
  if (st.state === 'play') failures.push(size.name + ': 5분 안에 전투가 끝나지 않았다');

  // Exercise new shapes, genuine skill buttons, pause guards, and bounded effects.
  await page.evaluate(()=>{
    for(const id of ['hades','odin','ra','persephone','skadi','bastet']){const c=document.createElement('canvas');drawUnitIcon(c,UNIT_BY_ID[id],64);}
    const heroSave={...save,owned:{...save.owned,hades:true,odin:true,ra:true},loadout:['hades','odin','ra']};
    battle=new Battle(0,heroSave,{baseHp:99999,money:900,rate:0,waves:[],reward:0});
    for(const id of heroSave.loadout){battle.money=900;battle.deploy(id);battle.heroCooldowns[id]=0;}
    battle.allies.forEach(f=>{f.x=600;});battle.spawnEnemy('ogre',800);buildCards();paused=true;updateHud();
  });
  if(!await page.locator('[data-hero="hades"]').isDisabled())throw Error('Paused hero input enabled');
  await page.evaluate(()=>{paused=false;updateHud();});
  const skillsOverlap=await page.evaluate(()=>document.querySelector('#hero-abilities').getBoundingClientRect().bottom>document.querySelector('.hud-bottom').getBoundingClientRect().top);
  if(skillsOverlap)throw Error('Hero abilities overlap deployment cards');
  for(const id of ['hades','odin','ra']){
    await page.evaluate(()=>{battle.heroGlobalCd=0;updateHud();});
    await page.click('[data-hero="'+id+'"]');
    if(!await page.evaluate(id=>battle.heroCooldowns[id]>0,id))throw Error('Active button failed: '+id);
    await page.evaluate(()=>{renderer.render(battle,1/60);});
    await shot(page,'active-'+id+'-'+size.w);
  }

  errors.forEach(e => failures.push(size.name + ': ' + e));
  console.log('  ' + (errors.length ? '✗' : '✓') + ' ' + size.name +
              ' (' + size.w + 'x' + size.h + ')  상태 ' + st.state +
              ' · 처치 ' + st.kills + ' · 소환 ' + owned + '종' +
              (usedCommand ? ' · 왕명 사용' : ''));
  await page.close();
}

(async () => {
  const exe = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  console.log('\n  브라우저 스모크 테스트');
  console.log('  ' + '-'.repeat(58));
  for (const s of SIZES) await runSize(browser, s);
  await browser.close();
  console.log('  ' + '-'.repeat(58));
  if (failures.length) {
    console.error('\n실패 ' + failures.length + '건');
    failures.forEach(f => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\n스모크 테스트 통과\n');
})();
