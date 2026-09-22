// Run against a repository server at http://127.0.0.1:8765 using isolated Edge/Chrome contexts.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const BASE='http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.LESSON_BROWSER||'msedge'});
 try{
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  for(const button of ['finish','prep']){
   for(const failure of [false,true]){
    const context=await browser.newContext({viewport:size,serviceWorkers:'block'}),errors=[];
    await context.route('**/*',route=>route.request().url().startsWith(BASE)?route.continue():route.abort());
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(BASE+'/tools/classroom-board/');await page.waitForFunction(()=>window.KathleenLessonMode);
    if(!await page.evaluate(()=>!!window.KathleenGamification))await page.addScriptTag({url:BASE+'/tools/gamification-preview.js'});
    await page.evaluate(failure=>{
     const cls={id:'qa-finish-class',name:'QA Abschluss',students:['QA Testperson']};
     sessionStorage.setItem('kathleenClassRosterCacheV37',JSON.stringify({expiresAt:Date.now()+3600000,classes:[cls]}));
     localStorage.setItem('kathleenClassMetaV1',JSON.stringify([{id:cls.id,name:cls.name}]));
     KathleenClassLists.setGlobalClass(cls.id,cls.name);KathleenGamification.activate();
     KathleenLessonMode.start({id:'qa-slot',classId:cls.id,className:cls.name,subject:'QA Unterricht',room:'QA Raum',start:'08:00',end:'09:00'},{navigate:false});
     KathleenLessonMode.log('observation',{student:'QA Testperson',mark:'plus'});KathleenLessonMode.log('homework',{student:'QA Testperson',subject:'QA Unterricht'});KathleenLessonMode.render();
     window.lessonEndEvents=0;window.addEventListener('kathleen:lessonevent',e=>{if(e.detail.type==='lesson_end'){window.lessonEndEvents++;if(localStorage.getItem('kathleenLessonModeV1')!==null)throw Error('Lesson still active during notification');}});
     if(failure){const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='kathleenGamificationV3')throw Error('QA gamification storage failure');return set.call(this,key,value);};}
    },failure);
    await page.locator('#lessonModeBar [data-lm="end"]').click();await page.locator('#lessonEndModal').waitFor();
    if(size.width===390 && !failure && button==='finish'){fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/lesson-finish-mobile.png'});}
    await page.locator(`[data-le="${button}"]`).click();
    if(button==='prep')await page.waitForURL(BASE+'/');else{await page.locator('#lessonEndModal').waitFor({state:'detached'});assert.equal(page.url(),BASE+'/tools/classroom-board/');assert.equal(await page.locator('#lessonModeBar').evaluate(e=>e.classList.contains('show')),false);assert.equal(await page.evaluate(()=>window.lessonEndEvents),1);}
    const state=await page.evaluate(()=>({active:localStorage.getItem('kathleenLessonModeV1'),last:JSON.parse(localStorage.getItem('kathleenLastLessonV1')),events:JSON.parse(localStorage.getItem('kathleenLessonEventsV1')),game:JSON.parse(localStorage.getItem('kathleenGamificationV3'))}));
    assert.equal(state.active,null);assert.equal(state.last.status,'ended');assert.equal(state.last.summary.x.id,state.last.id);assert.equal(state.last.summary.x.summary,undefined);assert.equal(state.last.summary.observations,1);assert.equal(state.last.summary.homework,1);assert.equal(state.events.filter(e=>e.type==='lesson_end').length,1);assert.equal(state.game.classes['qa-finish-class'].streak,failure?0:1);assert.deepEqual(errors,[]);
    console.log(`PASS ${size.width}px ${button}, gamification ${failure?'fails':'works'}`);await context.close();
   }
  }
 }
 // A genuine lesson-save error must not navigate away or lose the active lesson.
 const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());const page=await context.newPage();await page.goto(BASE+'/tools/classroom-board/');await page.waitForFunction(()=>window.KathleenLessonMode);
 await page.evaluate(()=>{KathleenLessonMode.start({id:'qa-storage',className:'QA',subject:'Speichertest'},{navigate:false});KathleenLessonMode.end();window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='kathleenLastLessonV1')throw Error('QA lesson storage failure');return window.qaSetItem.call(this,k,v);};});
 await page.locator('[data-le="prep"]').click();await page.getByRole('alert').waitFor();assert.equal(page.url(),BASE+'/tools/classroom-board/');assert.equal(await page.evaluate(()=>KathleenLessonMode.get().status),'active');assert.equal(await page.evaluate(()=>KathleenLessonMode.events().filter(e=>e.type==='lesson_end').length),0);
 await page.evaluate(()=>Storage.prototype.setItem=window.qaSetItem);await page.locator('[data-le="finish"]').click();await page.locator('#lessonEndModal').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>KathleenLessonMode.get()),null);await context.close();console.log('PASS storage failure and retry');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
