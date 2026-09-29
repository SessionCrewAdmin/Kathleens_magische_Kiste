const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};

test('approved Grammar KB unit feeds the English assessment generator with provenance',async t=>{
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(error,bytes)=>{if(error)return res.writeHead(404).end();res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections?.();server.close(resolve)}));
 const browser=await chromium.launch({channel:'msedge',headless:true});t.after(()=>browser.close());const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/assessments/`);
 await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('kathleen-english-bulk-extractor',1);req.onupgradeneeded=()=>{const s=req.result.createObjectStore('documents',{keyPath:'id'});s.createIndex('status','status');s.createIndex('sha256','source.sha256');s.createIndex('grade','classification.grade');s.createIndex('unit','classification.unit');s.createIndex('category','classification.category')};req.onerror=()=>reject(req.error);req.onsuccess=()=>{const tx=req.result.transaction('documents','readwrite');tx.objectStore('documents').put({id:'eng-aaaaaaaaaaaaaaaa',status:'ready',classification:{grade:7,unit:1,section:'grammar',topic:'Simple present',difficulty:'A1'},content:{objects:[{type:'grammar',title:'Simple present',confidence:.96,rules:['Use -s in the third person singular.'],examples:['She plays football.'],sourcePages:[4]}]},quality:{score:.96},source:{fileName:'simple-present.pdf',relativePath:'Klasse 7/Unit 1/simple-present.pdf',sha256:'b'.repeat(64)},provenance:{reviewedAt:new Date().toISOString(),reviewStatus:'approved',approvedUses:['practice','assessment']}});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)}}));
 await page.selectOption('#subject','Englisch');await page.waitForFunction(()=>document.querySelector('#contentTitle')?.textContent==='Vocabulary Knowledge Base'&&document.querySelectorAll('[data-content]').length>1&&document.querySelector('[data-kb-unit]'));
 await page.locator('.step-panel.active [data-next]').click();await page.locator('[data-content]').nth(0).check();await page.locator('[data-content]').nth(1).check();await page.locator('#areas input[value="grammar"]').check();await page.locator('.step-panel.active [data-next]').click();
 await page.fill('#duration','20');await page.click('#buildPlan');assert.match(await page.locator('#globalWarnings').innerText(),/kein sichtbarer, fachlich geprüfter und freigegebener Knowledge-Base-Baustein ausgewählt/i);
 await page.locator('.step-panel.active [data-back]').click();await page.locator('[data-kb-unit]').check();await page.locator('.step-panel.active [data-next]').click();await page.click('#buildPlan');await page.waitForSelector('.task-card');const grammar=page.locator('.task-card').filter({hasText:'Grammar'});assert.equal(await grammar.count(),1);assert.match(await grammar.textContent(),/third person singular/);assert.match(await grammar.textContent(),/English Grammar Knowledge Base|simple-present\.pdf/);
});
