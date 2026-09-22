// Isolated Windows Edge/Chrome test. Serve repository on 127.0.0.1:8765.
// npm dependency: playwright. Place pdfjs-dist@4.8.69's pdf.min.mjs and
// pdf.worker.min.mjs in test-results/canva-pdf*.mjs (ignored by Git).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const BASE='http://127.0.0.1:8765',SESSION_TOKEN=require('node:crypto').randomBytes(48).toString('base64url');
function pdfFixture(){
 const streams=['1 0.7 0.8 rg 0 0 640 360 re f','0.7 0.8 1 rg 0 0 640 360 re f'];
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Resources << >> /Contents 4 0 R >>`,`<< /Length ${streams[0].length} >>\nstream\n${streams[0]}\nendstream`,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Resources << >> /Contents 6 0 R >>`,`<< /Length ${streams[1].length} >>\nstream\n${streams[1]}\nendstream`];
 let file='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(file));file+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const start=Buffer.byteLength(file);file+=`xref\n0 7\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(file);
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.CANVA_BROWSER||'msedge'});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 let configured=false,connected=false,boardState=null,exportFail=false,holdLogin=false;const actions=[],errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url.includes('/functions/v1/canva-connect')){
   const input=route.request().postDataJSON();actions.push(input);
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Headers':'content-type,apikey,x-canva-session'},body:JSON.stringify(data)});
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Headers':'content-type,apikey,x-canva-session'}});
   if(!configured)return json({error:'Die Canva-Anbindung muss noch einmalig eingerichtet werden.'},503);
   switch(input.action){
    case 'config':return json({ready:true});
    case 'connect':return json({session:SESSION_TOKEN,url:'https://www.canva.com/api/oauth/authorize?state=TEST_STATE'});
    case 'callback':assert.equal(input.state,'TEST_STATE');assert.equal(input.code,'TEST_CODE');connected=true;return json({connected:true});
    case 'status':return json({connected});
    case 'designs':return json({items:[{id:input.continuation?'TEST_2':'TEST_1',title:input.continuation?'Weitere Testfolien':'Testfolien <Unterricht>',thumbnail:'',pageCount:2}],continuation:input.continuation?null:'next'});
    case 'export':return json({jobId:'TEST_JOB'});
    case 'export-status':return exportFail?json({error:'Dieses Design lässt sich nicht als Folien importieren.'},422):json({status:'success'});
    case 'download':return route.fulfill({contentType:'application/pdf',headers:{'Access-Control-Allow-Origin':BASE},body:pdfFixture()});
    case 'disconnect':connected=false;return json({connected:false});
    default:throw Error('Unexpected Canva action '+input.action);
   }
  }
  if(url.startsWith('https://www.canva.com/api/oauth/authorize'))return route.fulfill({contentType:'text/html',body:holdLogin?'<p>Test login pending</p>':`<script>location.href=${JSON.stringify(BASE+'/tools/classroom-board/canva-callback.html?code=TEST_CODE&state=TEST_STATE')}<\/script>`});
  if(url.endsWith('/pdf.min.mjs'))return route.fulfill({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:fs.readFileSync('test-results/canva-pdf.min.mjs')});
  if(url.endsWith('/pdf.worker.min.mjs'))return route.fulfill({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:fs.readFileSync('test-results/canva-pdf.worker.min.mjs')});
  if(url.includes('/rest/v1/rpc/classroom_presentation_state')||url.includes('/rest/v1/rpc/classroom_student_state'))return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,board_state:boardState,viewport:{scale:.8,tx:0,ty:0},phase:'free',traffic:'green',follow_teacher:true,session_state:'open',messages:[]})});
  if(url.includes('/rest/v1/rpc/'))return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{}'});
  if(url.startsWith(BASE))return route.continue();
  return route.abort();
 });
 const page=await context.newPage();await page.goto(BASE+'/tools/classroom-board/');await page.waitForFunction(()=>window.KathleenWidgetHost);
 const open=async()=>{await page.locator('#widgetBtn').click();await page.locator('[data-island-widget="canva"]').click();await page.locator('.canvaLibrary').waitFor();};
 await open();await page.locator('.canvaSetup:not([hidden])').waitFor();assert.match(await page.locator('.canvaStatus').innerText(),/eingerichtet/);await page.locator('[data-close]').click();
 configured=true;await page.evaluate(()=>sessionStorage.setItem('kathleenAdminPass','TEST_ONLY'));await open();
 await page.getByRole('button',{name:'Canva-Konto verbinden',exact:true}).click();await page.locator('.canvaDesignCard').first().waitFor();assert(connected);
 await page.getByRole('button',{name:'Weitere Designs laden'}).click();await page.waitForFunction(()=>document.querySelectorAll('.canvaDesignCard').length===2);assert(actions.some(a=>a.continuation==='next'));
 await page.getByRole('searchbox',{name:'Canva-Designs suchen'}).fill('Unterricht');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.canvaDesignCard').length===1);assert(actions.some(a=>a.query==='Unterricht'));
 await page.screenshot({path:'test-results/canva-library-desktop.png'});
 await page.locator('.canvaDesignCard').click();await page.locator('.canvaLibrary').waitFor({state:'hidden',timeout:30000});
 assert.equal(await page.locator('.item[data-widget-type="canva"]').count(),1);
 assert.equal(await page.locator('.canvaSlideImage img').getAttribute('alt'),'Testfolien <Unterricht> – Folie 1');
 await page.getByRole('button',{name:'Nächste Folie',exact:true}).click();assert.match(await page.locator('.canvaSlideImage img').getAttribute('alt'),/Folie 2$/);
 await page.evaluate(()=>KathleenWidgetHost.save());await page.reload();await page.locator('.canvaSlideImage img').waitFor();assert.match(await page.locator('.canvaSlideImage img').getAttribute('alt'),/Folie 2$/);
 const record=await page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('KathleenClassroomBoards',1);q.onsuccess=()=>r(q.result);q.onerror=j;});return new Promise(r=>{const q=db.transaction('boards').objectStore('boards').get(localStorage.getItem('kathleenCurrentBoardId'));q.onsuccess=()=>r(q.result);});});
 assert(!JSON.stringify(record).includes('TEST_ONLY'));assert(!JSON.stringify(record).includes(SESSION_TOKEN));assert.equal(record.data.items[0].html,'');assert.equal(record.data.items[0].widgetData.slides.length,2);
 // Failed replacement must leave the current presentation intact.
 await page.getByRole('button',{name:'Ersetzen / aktualisieren'}).click();await page.locator('.canvaDesignCard').waitFor();exportFail=true;await page.locator('.canvaDesignCard').click();await page.waitForFunction(()=>document.querySelector('.canvaStatus').textContent.includes('nicht als Folien'));assert.match(await page.locator('.canvaSlideImage img').getAttribute('alt'),/Folie 2$/);exportFail=false;await page.locator('[data-close]').click();
 await page.screenshot({path:'test-results/canva-board-desktop.png'});
 boardState=structuredClone(record.data);boardState.items[0].x=20;boardState.items[0].y=20;
 const beamer=await context.newPage();await beamer.goto(BASE+'/tools/classroom-board/present.html?room=TEST');await beamer.locator('.canvaSlideImage img').waitFor();assert.match(await beamer.locator('.canvaSlideImage img').getAttribute('alt'),/Folie 2$/);assert.equal(await beamer.locator('[data-kw-action="canva-next"]').count(),0);
 boardState.items[0].widgetData.page=0;await beamer.waitForFunction(()=>document.querySelector('.canvaSlideImage img')?.alt.endsWith('Folie 1'));
 const student=await context.newPage();await student.addInitScript(()=>sessionStorage.setItem('kathleenStudentToken','TEST_STUDENT'));await student.goto(BASE+'/tools/classroom-board/student.html');await student.locator('.canvaSlideImage img').waitFor();assert.equal(await student.locator('[data-kw-action="canva-choose"]').count(),0);boardState.items[0].widgetData.page=1;await student.waitForFunction(()=>document.querySelector('.canvaSlideImage img')?.alt.endsWith('Folie 2'));
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>KathleenCanva.open());await page.locator('.canvaDesignCard').waitFor();const rect=await page.locator('.canvaLibrary').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=391);assert(await page.locator('.canvaLibrary').evaluate(e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:'test-results/canva-library-mobile.png'});
 await page.getByRole('button',{name:'Verbindung trennen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.canvaStatus').textContent.includes('Verbindung getrennt'));assert.equal(await page.evaluate(()=>sessionStorage.getItem('kathleenCanvaSession')),null);await page.locator('[data-close]').click();assert.equal(await page.locator('.canvaSlideImage img').count(),1);
 // Closing either the OAuth popup or the picker must not leave the feature busy.
 holdLogin=true;await page.evaluate(()=>KathleenCanva.open());await page.getByRole('button',{name:'Canva-Konto verbinden',exact:true}).waitFor();
 const [cancelled]=await Promise.all([page.waitForEvent('popup'),page.getByRole('button',{name:'Canva-Konto verbinden',exact:true}).click()]);await cancelled.waitForURL('https://www.canva.com/**');await cancelled.close();await page.waitForFunction(()=>document.querySelector('.canvaStatus').textContent.includes('Fenster geschlossen'));
 const [pending]=await Promise.all([page.waitForEvent('popup'),page.getByRole('button',{name:'Canva-Konto verbinden',exact:true}).click()]);await pending.waitForURL('https://www.canva.com/**');await page.locator('[data-close]').click();await page.evaluate(()=>KathleenCanva.open());await page.locator('.canvaLibrary').waitFor();await page.locator('[data-close]').click();
 assert.deepEqual(errors,[]);
 console.log('PASS: setup state, OAuth popup, search/pagination, real PDF rendering, import, reload, failed replacement, beamer/student sync, mobile layout, disconnect, no credentials in board.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
