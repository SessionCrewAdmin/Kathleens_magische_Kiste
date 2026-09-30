const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const fixture=path.join(__dirname,'fixtures','relink-source.txt');
const sha256=crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};

test('local rules are editable and a missing source reconnects only by hash',async t=>{
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(error,bytes)=>{if(error)return res.writeHead(404).end();res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const browser=await chromium.launch({channel:'msedge',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.addInitScript(()=>{localStorage.setItem('kathleenHelpNeverV1',JSON.stringify({'english-kb':true}));Object.defineProperty(window,'showOpenFilePicker',{value:undefined,configurable:true})});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/english-knowledge-base/`);await page.evaluate(()=>{window.showOpenFilePicker=undefined});
 await page.evaluate(hash=>new Promise((resolve,reject)=>{const req=indexedDB.open('kathleen-english-bulk-extractor',3);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const tx=req.result.transaction('documents','readwrite');tx.objectStore('documents').put({id:'missing-source',status:'needs_review',classification:{grade:6,unit:1,section:'grammar',topic:'Simple past'},content:{objects:[{type:'grammar',title:'Missing source',instruction:'Complete.',sourceText:'Text',confidence:.8,sourcePages:[1],reviewStatus:'needs_review',approvedUses:['practice']}]},source:{fileName:'relink-source.txt',relativePath:'relink-source.txt',sha256:hash,missing:true,originalAvailable:false},provenance:{originalRemainsLocal:true}});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)}}),sha256);
 await page.reload();await page.locator('[data-open]').click();await page.waitForSelector('#detailDialog[open]');await page.waitForFunction(()=>!document.querySelector('#relinkSource').hidden);assert.match(await page.locator('#readiness').innerText(),/Quelle nicht mehr erreichbar/);
 const chooser=page.waitForEvent('filechooser');await page.click('#relinkSource');(await chooser).setFiles(fixture);await page.waitForFunction(()=>!document.querySelector('#detailDialog').open);
 const reconnected=await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('kathleen-english-bulk-extractor',3);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const get=req.result.transaction('documents').objectStore('documents').get('missing-source');get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error)}}));assert.equal(reconnected.source.missing,false);assert.equal(reconnected.source.relinkPersistent,false);
 await page.click('#rulesManage');await page.waitForSelector('#rulesDialog[open]');await page.fill('#ruleLabel','Access 6 ist Klasse 6');await page.fill('#rulePattern','Access[ _-]*6');await page.selectOption('#ruleField','grade');await page.fill('#ruleValue','6');await page.click('#ruleForm button[type="submit"]');await page.waitForFunction(()=>document.querySelector('#rulesList')?.textContent.includes('Access 6 ist Klasse 6'));
 const rules=await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('kathleen-english-bulk-extractor',3);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const get=req.result.transaction('recognition-rules').objectStore('recognition-rules').getAll();get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error)}}));assert.equal(rules.length,1);assert.equal(rules[0].enabled,true);assert.equal(rules[0].field,'grade');
});
