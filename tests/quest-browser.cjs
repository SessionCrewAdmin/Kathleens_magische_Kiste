// Run with NODE_PATH pointing to an installed Playwright package. Uses an isolated browser context.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.QUEST_BROWSER||'msedge'});
 const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
 await context.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8765/')?route.continue():route.abort());
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tools/quest-mode/');
 await page.getByRole('heading',{name:'Welche Klasse startet die Quest?'}).waitFor();
 assert.equal(await page.locator('.student-card').count(),0);
 await page.evaluate(()=>{
  // Deliberately artificial QA records live only in this fresh browser context.
  const classes=[{id:'qa-a',name:'QA A',students:Array.from({length:12},(_,i)=>'__qa_person_'+String(i+1).padStart(2,'0')+'__')},{id:'qa-b',name:'QA B',students:['__qa_other__']}];
  sessionStorage.setItem('kathleenClassRosterCacheV37',JSON.stringify({expiresAt:Date.now()+3600000,classes}));
  localStorage.setItem('kathleenClassMetaV1',JSON.stringify(classes.map(({id,name})=>({id,name}))));
  window.KathleenClassLists.setGlobalClass('qa-a','QA A');
 });
 await page.locator('.student-card').first().waitFor();assert.equal(await page.locator('.student-card').count(),12);
 await page.getByRole('button',{name:'Klasse: Mitarbeit +15 XP',exact:true}).click();
 assert.equal(await page.evaluate(()=>KathleenGamification.current().classXp),15);
 await page.locator('.student-card').first().getByRole('button',{name:/Mitarbeit/}).click();
 assert.equal(await page.evaluate(()=>Object.values(KathleenGamification.current().students)[0].xp),15);
 await page.getByRole('button',{name:'Letzte Aktion zurück'}).click();
 assert.equal(await page.evaluate(()=>Object.values(KathleenGamification.current().students)[0].xp),0);
 await page.getByRole('button',{name:'Boss-Challenge starten',exact:true}).click();
 await page.getByRole('button',{name:'Klasse: Quiz richtig +10 XP',exact:true}).click();
 assert.equal(await page.evaluate(()=>KathleenGamification.current().boss.progress),1);
 await page.getByRole('button',{name:'Letzte Aktion zurück'}).click();assert.equal(await page.evaluate(()=>KathleenGamification.current().boss.progress),0);
 const [beamer]=await Promise.all([context.waitForEvent('page'),page.getByRole('link',{name:'Beamer öffnen'}).click()]);await beamer.waitForLoadState();
 assert.equal(await beamer.locator('.student-card').count(),0);assert.ok(!(await beamer.locator('body').innerText()).includes('__qa_person'));
 await page.getByRole('button',{name:'Klasse: Quiz richtig +10 XP',exact:true}).click();await beamer.waitForFunction(()=>document.body.innerText.includes('1 / 10 Treffer'));
 await page.getByLabel('Aktive Klasse',{exact:true}).selectOption('qa-b');
 assert.equal(await page.locator('.student-card').count(),1);assert.equal(await page.evaluate(()=>KathleenGamification.current().classXp),0);
 assert.ok((await beamer.locator('body').innerText()).includes('QA A'));
 await page.getByLabel('Aktive Klasse',{exact:true}).selectOption('qa-a');
 assert.equal(await page.evaluate(()=>KathleenGamification.current().classXp),25);
 await page.reload();assert.equal(await page.evaluate(()=>KathleenGamification.current().classXp),25);
 await page.getByLabel('Schüler suchen').fill('__qa_person_01');assert.equal(await page.locator('.student-card:visible').count(),1);
 await page.getByLabel('Schüler suchen').fill('');
 fs.mkdirSync('test-results',{recursive:true});
 const layouts=[];for(const [width,height] of [[1440,1050],[1920,1080],[1024,768],[768,1024],[390,844],[320,700]]){
  await page.setViewportSize({width,height});await page.screenshot({path:`test-results/quest-${width}.png`,fullPage:true});
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));assert.ok(dimensions.scroll<=dimensions.inner,`Horizontal overflow at ${width}: ${dimensions.scroll}`);
  assert.ok(await page.getByRole('button',{name:'Klasse: Mitarbeit +15 XP',exact:true}).isVisible());layouts.push(width);
 }
 await page.setViewportSize({width:1440,height:1050});
 await page.goto('http://127.0.0.1:8765/?welcome=off');
 const link=page.locator('#questBetaOpen');assert.equal(await link.getAttribute('href'),'tools/quest-mode/');await link.click();await page.waitForURL('**/tools/quest-mode/');assert.equal(await page.locator('.student-card').count(),12);
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8765/?welcome=off');await page.locator('#mobileQuestOpen').click();await page.waitForURL('**/tools/quest-mode/');assert.equal(await page.locator('.student-card').count(),12);
 const beforeReset=await page.evaluate(()=>KathleenGamification.current().weekly.progress);
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Wochenziel zurücksetzen'}).click();assert.equal(await page.evaluate(()=>KathleenGamification.current().weekly.progress),beforeReset);
 page.once('dialog',async d=>{assert.ok(d.message().includes('Klasse QA A'));await d.accept()});await page.getByRole('button',{name:'Wochenziel zurücksetzen'}).click();assert.equal(await page.evaluate(()=>KathleenGamification.current().weekly.progress),0);assert.equal(await page.evaluate(()=>KathleenGamification.current().classXp),25);
 await page.reload();assert.equal(await page.evaluate(()=>KathleenGamification.current().weekly.progress),0);await page.getByRole('button',{name:'Letzte Aktion zurück'}).click();assert.equal(await page.evaluate(()=>KathleenGamification.current().weekly.progress),beforeReset);
 const screenshot=page.locator('.sidebar nav a');for(const a of await screenshot.all()){const href=await a.getAttribute('href');if(href){const res=await context.request.get(new URL(href,page.url()).href);assert.equal(res.status(),200,href)}}
 await page.evaluate(()=>{const classes=[{id:'qa-a',name:'QA A',students:['Alex NachnameQAeins','Alex NachnameQAzwei','Anna-Lena NachnameQAdrei']}];sessionStorage.setItem('kathleenClassRosterCacheV37',JSON.stringify({expiresAt:Date.now()+3600000,classes}));dispatchEvent(new Event('kathleen:classlists'))});
 assert.deepEqual(await page.locator('.student-name').allTextContents(),['Alex','Alex','Anna-Lena']);assert.ok(!(await page.locator('body').innerText()).includes('NachnameQA'));assert.ok(!(await page.locator('.student-card [aria-label]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')).join(' '))).includes('NachnameQA'));
 await page.locator('.student-card').nth(1).getByRole('button',{name:/Mitarbeit/}).click();const pupils=await page.evaluate(()=>Object.values(KathleenGamification.current().students));assert.equal(pupils[0].xp,0);assert.equal(pupils[1].xp,15);assert.equal(pupils[1].name,'Alex NachnameQAzwei');
 await page.locator('.student-card').nth(1).locator('summary').click();await page.getByRole('button',{name:'Klasse: Quiz richtig +10 XP',exact:true}).click();assert.equal(await page.locator('.student-card').nth(0).locator('details').getAttribute('open'),null);assert.equal(await page.locator('.student-card').nth(1).locator('details').getAttribute('open'),'');
 await page.goto('http://127.0.0.1:8765/tools/gamification-remote/');assert.ok(!(await page.locator('body').innerText()).includes('NachnameQA'));assert.deepEqual(await page.locator('.student b').allTextContents(),['Alex','Alex','Anna-Lena']);
 await page.goto('http://127.0.0.1:8765/tools/gamification-student/?student='+encodeURIComponent(pupils[1].id));assert.equal(await page.locator('#view h2').innerText(),'Alex');assert.ok(!(await page.locator('body').innerText()).includes('NachnameQA'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({browser:await browser.version(),platform:process.platform,layouts,checks:['empty state','home entry','class isolation','XP','undo','boss','beamer privacy','beamer live update','beamer class pin','reload persistence','search','navigation routes'],pageErrors:errors},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
