const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};

test('History PDF text/OCR review confirms additive KB payload without source page text',async t=>{
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 let browser;try{browser=await chromium.launch({headless:true})}catch(error){if(/Executable doesn't exist/i.test(error.message)){t.skip('Chromium ist in dieser Umgebung nicht installiert.');return}throw error}t.after(()=>browser.close());
 const context=await browser.newContext();await context.addInitScript(()=>sessionStorage.setItem('kathleenAdminPass','test-admin-passphrase'));
 const page=await context.newPage();let confirmed=null;
 await page.route('https://cdnjs.cloudflare.com/**/pdf.min.js',route=>route.fulfill({contentType:'text/javascript',body:`window.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async n=>({getTextContent:async()=>({items:n===1?[{str:'KAPITEL 3: DIE FRANZÖSISCHE REVOLUTION. Quelle, Herrschaft, Ereignis, historische Entwicklung und politische Ordnung.'}]:[]}),getViewport:()=>({width:300,height:420}),render:()=>({promise:Promise.resolve()})})})})}`}));
 await page.route('https://cdn.jsdelivr.net/**/tesseract.min.js',route=>route.fulfill({contentType:'text/javascript',body:`window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{text:'Quelle M1: Herrschaft und Ereignisse im Mittelalter. Historische Entwicklung. S. 42',confidence:84}}),terminate:async()=>{}})}`}));
 await page.route('https://fzqxnjhuvgpgovcovosl.supabase.co/rest/v1/rpc/**',async route=>{const name=new URL(route.request().url()).pathname.split('/').pop();if(name==='history_import_list')return route.fulfill({contentType:'application/json',body:'[]'});const body=route.request().postDataJSON();confirmed=body.p_import;return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'imported',import_id:body.p_import.import_id,chapter_id:body.p_import.chapter_id,topics:body.p_import.payload.topics.length,sources:1})})});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/material-import/`);
 await page.locator('#file').setInputFiles({name:'history.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF mock test')});
 await page.locator('#reviewPanel:not([hidden])').waitFor();
 assert.equal(await page.locator('[data-page]').count(),2,'both PDF pages are reviewed');
 assert.match(await page.locator('.page-review').nth(0).innerText(),/Maschinenlesbarer PDF-Text/);
 assert.match(await page.locator('.page-review').nth(1).innerText(),/OCR · erkannte Sicherheit 84 %/);
 await page.locator('#allPages').click();
 await page.locator('[data-summary="0"]').fill('Die Quelle zeigt Konflikte um die politische Ordnung.');
 await page.locator('[data-summary="1"]').fill('Die Quelle beschreibt mittelalterliche Herrschaft und Machtverhältnisse.');
 await page.locator('#confirm').click();
 await page.locator('#report:not([hidden])').waitFor();
 assert.equal(confirmed.extractor_version,'2.0.0');
 assert.equal(confirmed.payload.topics.length,2);
 assert.equal(confirmed.payload.source_inventory.length,1);
 assert.ok(confirmed.payload.topics.every(x=>x.extraction_provenance.reviewed));
 assert.ok(!JSON.stringify(confirmed).includes('historische Entwicklung und politische Ordnung.'),'raw PDF page text is not persisted');
 assert.match(await page.locator('#report').innerText(),/2 geprüfte Inhalte/);
});
