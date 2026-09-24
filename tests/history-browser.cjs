const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');let server,browser;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
async function start(){server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let rel=decodeURIComponent(u.pathname).replace(/^\//,'');if(!rel)rel='index.html';else if(u.pathname.endsWith('/'))rel=path.join(rel,'index.html');const p=path.resolve(root,rel);if(!p.startsWith(root)){res.writeHead(403).end();return}fs.readFile(p,(e,b)=>{if(e){res.writeHead(404).end();return}res.setHeader('content-type',mime[path.extname(p)]||'application/octet-stream');res.end(b)})});await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});return 'http://127.0.0.1:'+server.address().port}
test.after(async()=>{await browser?.close();await new Promise(r=>server?.close(r))});
test('history UI switches all grades and History Hunt consumes every chapter',async()=>{
 const base=await start(),page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(base+'/tools/history-content-center/',{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-grade]');
 assert.deepEqual(await page.locator('[data-grade]').allTextContents(),['Klasse 7','Klasse 9','Klasse 10','Klasse 12']);
 for(const [grade,count,title] of [[9,6,'Weimarer Republik'],[10,3,'geteilte Deutschland'],[12,7,'Partizipation']]){
  await page.click('[data-grade="'+grade+'"]');await page.waitForFunction(g=>new URL(location.href).searchParams.get('grade')===String(g),grade);
  assert.equal(await page.locator('#chapters .chapter').count(),count);assert.match(await page.locator('#chapterView h2').innerText(),new RegExp(title,'i'));assert.match(await page.locator('#importState').innerText(),/Full Import/)
 }
 const hunt=await browser.newPage({viewport:{width:1440,height:1000}});await hunt.goto(base+'/tools/quick-games/history-hunt/',{waitUntil:'domcontentloaded'});await hunt.waitForFunction(()=>document.querySelectorAll('#chapter option').length===21);
 assert.equal(await hunt.locator('#chapter option').count(),21);assert.ok((await hunt.locator('#chapter option').allTextContents()).some(x=>x.includes('Klasse 12')));
 await hunt.selectOption('#chapter','g12-k7');await hunt.selectOption('#mode','question');await hunt.click('#startBtn');await hunt.waitForSelector('#game:not(.hidden)');
 assert.match(await hunt.locator('#chapterLabel').innerText(),/KLASSE 12/);assert.equal(await hunt.locator('#answers .answer').count(),4)
});
