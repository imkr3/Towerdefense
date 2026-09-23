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
  // 기본 흐름은 한국어로 돈다. 영어는 맨 끝에 따로 확인한다.
  await page.evaluate(() => localStorage.setItem('stick-kingdom-settings-v1', JSON.stringify({ lang: 'ko' })));
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
  // 진군도는 장(章)마다 10개씩 보여 준다. 2막 첫 전장이 열리고 다음은 잠겨야 한다.
  const expansionMap=await page.evaluate(()=>{
    save.cleared=20;mapChapter=2;mapSel=-1;renderMap();const cards=[...document.querySelectorAll('#stage-list .stage')];
    const res={count:cards.length,open:!cards[0].disabled&&cards[0].dataset.stage==='20',locked:cards[1].disabled};
    mapChapter=3;renderMap();res.endless=!!document.querySelector('#endless-slot .e-btn');
    return res;
  });
  if(expansionMap.count!==10||!expansionMap.open||!expansionMap.locked||!expansionMap.endless)throw Error('Expansion progression or endless unlock broken: '+JSON.stringify(expansionMap));
  await page.evaluate(n=>{save.cleared=n;mapChapter=-1;mapSel=-1;renderMap();},originalProgress);
  const mapFit=await page.evaluate(()=>{
    const r=document.querySelector('#btn-sortie').getBoundingClientRect(), d=document.querySelector('#stage-detail').getBoundingClientRect();
    const nodes=[...document.querySelectorAll('#stage-list .stage')].map(n=>n.getBoundingClientRect()), t=document.querySelector('#trail').getBoundingClientRect();
    return {go:r.bottom<=d.bottom+1&&r.height>20,nodes:nodes.every(n=>n.left>=t.left-2&&n.right<=t.right+2&&n.top>=t.top-2&&n.bottom<=t.bottom+2)};
  });
  if(!mapFit.go)failures.push(size.name+': 출진 버튼이 전장 정보 칸 밖으로 밀렸다');
  if(!mapFit.nodes)failures.push(size.name+': 진군로 전장이 칸 밖으로 나갔다');


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
  // 편성: 칸끼리 끌면 자리가 바뀌고, 보유 카드를 칸에 끌어 놓으면 들어가고, 칸을 끌어내면 빠진다.
  await page.click('#btn-open-formation');
  await page.waitForTimeout(150);
  await shot(page, 'formation-' + size.w);
  const drag=async(from,to)=>{
    const a=await page.locator(from).boundingBox(), b=await page.locator(to).boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
    await page.mouse.move(a.x+a.width/2+12,a.y+a.height/2+4,{steps:2});
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:6}); await page.mouse.up();
    await page.waitForTimeout(60);
  };
  const beforeOrder=await page.evaluate(()=>save.loadout.slice());
  await drag('.f-slot[data-slot="0"]','.f-slot[data-slot="1"]');
  if(!await page.evaluate(ids=>save.loadout[1]===ids[0]&&save.loadout[0]===ids[1],beforeOrder))throw Error('Loadout drag reorder failed');
  await drag('.f-tile[data-unit="knight"]','.f-slot[data-slot="2"]');
  if(!await page.evaluate(()=>save.loadout[2]==='knight'))throw Error('Drag from pool into slot failed');
  await drag('.f-slot[data-slot="2"]','#formation-pool');
  if(await page.evaluate(()=>save.loadout.includes('knight')))throw Error('Dragging a slot out did not remove it');
  await page.click('.f-tile[data-unit="knight"]');
  if(!await page.evaluate(()=>save.loadout.includes('knight')))throw Error('Tapping a pool card did not add it');
  await page.click('.f-slot[data-slot="0"] .fs-remove');
  if(await page.evaluate(ids=>save.loadout.includes(ids[1]),beforeOrder))throw Error('Slot remove button failed');
  await page.evaluate(()=>{save.loadout=['spear','shield','archer','venom','mage'];saveGame(save);renderFormation();});
  await page.click('.fp-row:nth-child(1) .fp-btn:nth-of-type(2)');
  await page.evaluate(()=>{save.loadout=['spear'];saveGame(save);renderFormation();});
  await page.click('.fp-row:nth-child(1) .fp-btn:nth-of-type(1)');
  if(!await page.evaluate(()=>save.loadout.length===5))throw Error('Preset save/load failed');
  const slotsFit=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#formation-slots').getBoundingClientRect().right<=innerWidth);
  if(!slotsFit)failures.push(size.name+': 편성 칸이 화면을 넘친다');
  await page.reload(); await page.click('#btn-start'); await page.click('#btn-units');
  if(!await page.evaluate(()=>save.loadout.length===5&&save.presets[0].length===5))throw Error('Loadout or preset lost after reload');
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
  // 설정: 크기와 스위치가 기기에 남는다
  await page.click('#btn-map-settings');
  await page.fill('#set-bgm', '30');
  await page.click('#set-shake');
  await page.click('#modal-settings [data-close]');
  if(!await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('stick-kingdom-settings-v1'));return d.bgm===0.3&&d.shake===false;}))failures.push(size.name+': 설정이 저장되지 않았다');
  await page.evaluate(()=>{Settings.set('shake',true);});

  // 전장을 한 번 누르면 고르고, 출진 버튼으로 나간다 (고른 전장을 또 누르면 바로 출진)
  await page.evaluate(()=>{mapChapter=-1;mapSel=12;renderMap();});
  await page.click('#stage-list .stage[data-stage="13"]');
  if(!await page.evaluate(()=>mapSel===13&&$('#scr-map').classList.contains('active')))failures.push(size.name+': 전장 선택 오류');
  await page.click('#btn-sortie');
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
  // 액티브 칸은 하단 HUD 안에서 카드 줄·왕의 명령과 나란히 서야 한다.
  // 전장 위로 떠서도, 카드나 왕의 명령을 덮어서도 안 된다.
  const layout=await page.evaluate(()=>{
    const r=el=>document.querySelector(el).getBoundingClientRect();
    const a=r('#hero-abilities'),c=r('#cards'),k=r('#btn-command'),h=r('.hud-bottom');
    const hit=(p,q)=>p.left<q.right-1&&q.left<p.right-1&&p.top<q.bottom-1&&q.top<p.bottom-1;
    return {inHud:a.top>=h.top-1&&a.bottom<=h.bottom+1,overCards:hit(a,c),overCmd:hit(a,k),w:a.width,h:a.height};
  });
  if(!layout.inHud)throw Error('Hero abilities float over the battlefield');
  if(layout.overCards||layout.overCmd)throw Error('Hero abilities overlap cards or command: '+JSON.stringify(layout));
  if(layout.w<40||layout.h<40)throw Error('Hero abilities collapsed: '+JSON.stringify(layout));
  for(const id of ['hades','odin','ra']){
    await page.evaluate(()=>{battle.heroGlobalCd=0;updateHud();});
    await page.click('[data-hero="'+id+'"]');
    if(!await page.evaluate(id=>battle.heroCooldowns[id]>0,id))throw Error('Active button failed: '+id);
    await page.evaluate(()=>{renderer.render(battle,1/60);});
    await shot(page,'active-'+id+'-'+size.w);
  }

  // 영어: 화면에 한글이 남지 않고, 번역이 전투를 멈추지 않는다
  await page.evaluate(()=>{Settings.set('lang','en');});
  await page.reload();
  await page.waitForTimeout(250);
  const hangulLeft=async()=>page.evaluate(()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
    while((n=w.nextNode()))if(/[가-힣]/.test(n.nodeValue)&&n.parentElement.offsetParent!==null)out.push(n.nodeValue.trim());return out;});
  let left=await hangulLeft();
  await page.click('#btn-start'); await page.waitForTimeout(150); left=left.concat(await hangulLeft());
  await page.click('#btn-formation'); await page.waitForTimeout(150); left=left.concat(await hangulLeft());
  await shot(page,'formation-en-'+size.w);
  await page.click('#btn-formation-back');
  await page.click('#btn-sortie');
  await page.waitForTimeout(1200);
  left=left.concat(await hangulLeft());
  const enAlive=await page.evaluate(()=>battle.time>0.5);
  if(!enAlive)failures.push(size.name+': 영어로 전투가 돌지 않는다');
  if(left.length)failures.push(size.name+': 영어 화면에 한글이 남았다 '+JSON.stringify([...new Set(left)].slice(0,8)));
  await shot(page,'battle-en-'+size.w);

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
