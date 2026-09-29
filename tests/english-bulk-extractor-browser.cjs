const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const JSZip=require('jszip');

const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};

test('English Bulk Extractor inventories, classifies, persists and resumes a local text fixture',async t=>{
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const installed=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
 let browser;try{browser=await chromium.launch({headless:true,...(installed?{executablePath:installed}: {})})}catch(error){if(/Executable doesn't exist/i.test(error.message)){t.skip('Chromium ist in dieser Umgebung nicht installiert.');return}throw error}t.after(()=>browser.close());
 const page=await browser.newPage(),jszipBrowser=fs.readFileSync(require.resolve('jszip/dist/jszip.min.js'),'utf8');await page.route('https://**/*',route=>route.fulfill({contentType:'text/javascript',body:route.request().url().includes('/jszip@')?jszipBrowser:''}));
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/english-bulk-extractor/`);
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'english-bulk-')),folder=path.join(fixture,'Klasse 9','Unit 3','Grammar','Relative Clauses');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'worksheet.txt'),'RELATIVE CLAUSES\nWe use who for people. Exercise: combine the sentences. '.repeat(20));
 const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>RELATIVE CLAUSES</w:t></w:r></w:p><w:p><w:pPr><w:numPr/></w:pPr><w:r><w:t>Use who for people.</w:t></w:r></w:p><w:p><w:hyperlink r:id="rId1"><w:r><w:t>Reference link</w:t></w:r></w:hyperlink></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Rule</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Example</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>');zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="https://example.test/reference"/></Relationships>');zip.file('word/header1.xml','<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>English worksheet</w:t></w:r></w:p></w:hdr>');zip.file('word/media/image1.png',Buffer.from([137,80,78,71]));fs.writeFileSync(path.join(folder,'structured.docx'),await zip.generateAsync({type:'nodebuffer'}));t.after(()=>{assert.ok(fixture.startsWith(os.tmpdir()));fs.rmSync(fixture,{recursive:true,force:true})});
 await page.locator('#folderFallback').setInputFiles(fixture);
 await page.getByText(/Inventar vollständig/).waitFor();
 assert.match(await page.locator('#stats').innerText(),/Gefunden/);
 await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#phase')?.textContent==='Analyse abgeschlossen',null,{timeout:10000}).catch(async()=>{throw Error(await page.locator('body').innerText())});
 assert.match(await page.locator('#rows').innerText(),/Grammar/);
 assert.match(await page.locator('#rows').innerText(),/Kl\. 9/);
 await page.locator('[data-review]').first().click();
 await page.locator('#reviewAssessment').check();
 await page.locator('#reviewSave').click();
 const approved=await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('kathleen-english-bulk-extractor',3);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const get=req.result.transaction('documents').objectStore('documents').getAll();get.onerror=()=>reject(get.error);get.onsuccess=()=>resolve(get.result.find(x=>x.provenance?.reviewStatus==='approved'))}}));
 assert.ok(approved.provenance.approvedUses.includes('assessment'));
 const docx=await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('kathleen-english-bulk-extractor',3);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const get=req.result.transaction('documents').objectStore('documents').getAll();get.onerror=()=>reject(get.error);get.onsuccess=()=>resolve(get.result.find(x=>x.source.type==='docx'))}}));
 assert.equal(docx.status,'ready');assert.ok(docx.content.blocks.some(x=>x.type==='heading'));assert.ok(docx.content.blocks.some(x=>x.type==='list_item'));assert.deepEqual(docx.content.tables[0],[['Rule','Example']]);assert.equal(docx.content.hyperlinks[0].target,'https://example.test/reference');assert.equal(docx.content.images[0].fileName,'image1.png');assert.equal(docx.content.sections,1);
 await page.reload();
 assert.match(await page.locator('#rows').innerText(),/Relative Clauses/i);
 await page.locator('#folderFallback').setInputFiles(fixture);await page.getByText(/Inventar vollständig/).waitFor();assert.equal(await page.locator('#start').isDisabled(),true);assert.match(await page.locator('#stats').innerText(),/2\s+Übersprungen/);
});
