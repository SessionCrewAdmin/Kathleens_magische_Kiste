const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};

test('collector copies only material files and preserves folders',async t=>{
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const installed=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
 let browser;try{browser=await chromium.launch({headless:true,...(installed?{executablePath:installed}:{})})}catch(error){if(/Executable doesn't exist/i.test(error.message)){t.skip('Chromium ist in dieser Umgebung nicht installiert.');return}throw error}t.after(()=>browser.close());
 const context=await browser.newContext();
 await context.addInitScript(()=>{
  const file=(name,body)=>({kind:'file',name,getFile:async()=>new File([body],name)});
  const directory=(name,entries)=>({kind:'directory',name,entries:async function*(){for(const entry of entries)yield[entry.name,entry]}});
  const source=directory('Quelle',[file('worksheet.pdf','PDF'),file('app.js','APP'),file('bundle.zip','ZIP'),directory('Klasse 9',[file('reading.docx','DOCX')]),directory('src',[file('hidden.pdf','HIDDEN')])]);
  source.isSameEntry=async()=>false;
  const makeDestination=(name,path='')=>{const entries=new Map();return{kind:'directory',name,entries,getDirectoryHandle:async child=>{if(!entries.has(child))entries.set(child,makeDestination(child,path?`${path}/${child}`:child));return entries.get(child)},getFileHandle:async(child,options={})=>{if(!options.create)throw new DOMException('missing','NotFoundError');return{createWritable:async()=>new WritableStream({write(){},close(){window.__copiedPaths.push(path?`${path}/${child}`:child)}})}}}};
  const destination=makeDestination('Ziel');window.__copiedPaths=[];let calls=0;window.showDirectoryPicker=async()=>calls++===0?source:destination;
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/material-file-collector/`);
 await page.locator('#chooseSource').click();
 await page.waitForFunction(()=>document.querySelector('#foundCount').textContent==='2');
 assert.deepEqual((await page.locator('#fileList').textContent()).trim().split('\n').sort(),['Klasse 9/reading.docx','worksheet.pdf']);
 assert.match(await page.locator('#scanStatus').innerText(),/2 App-\/sonstige Dateien und 1 App-Ordner/);
 await page.locator('#chooseDestination').click();
 await page.locator('#copy').click();
 await page.waitForFunction(()=>document.querySelector('#phase').textContent==='Sammlung abgeschlossen');
 assert.deepEqual((await page.evaluate(()=>window.__copiedPaths)).sort(),['Klasse 9/reading.docx','worksheet.pdf']);
 assert.deepEqual(errors,[]);
});
