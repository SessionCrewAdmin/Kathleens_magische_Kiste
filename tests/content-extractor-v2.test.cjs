const test=require('node:test');
const assert=require('node:assert/strict');
const {cleanLines,detectHeadings,printedPage,classify,confidenceName,confidenceClass,needsOcr,mapError}=require('../tools/material-import/material-import.js');
const {merge}=require('../tools/history-import-client.js');

test('PDF page structure detects headings and printed page markers without persisting source text',()=>{
 const text='KAPITEL 3: DIE FRANZÖSISCHE REVOLUTION\nDie Revolution verändert die politische Ordnung.\nS. 42';
 assert.deepEqual(cleanLines(text).length,3);
 assert.match(detectHeadings(text)[0],/KAPITEL 3/);
 assert.equal(printedPage(text),42);
});

test('text-layer fallback and confidence bands are deterministic and explainable',()=>{
 assert.equal(needsOcr(''),true);
 assert.equal(needsOcr('Die französische Revolution verändert Herrschaft, Gesellschaft und politische Ordnung nachhaltig.'),false);
 const page={text:'Die Quelle berichtet über Revolution, Herrschaft und politische Ordnung in Frankreich. '.repeat(5),method:'pdf_text',charCount:450,headings:['KAPITEL 3: REVOLUTION']};
 assert.ok(classify(page)>=.82);
 const weak={text:'',method:'ocr',ocrConfidence:18,charCount:0,headings:[]};
 assert.ok(classify(weak)<.55);
 assert.equal(confidenceName(.91),'Sicher');assert.equal(confidenceClass(.91),'green');
 assert.equal(confidenceName(.61),'Prüfen');assert.equal(confidenceClass(.61),'yellow');
 assert.equal(confidenceName(.3),'Problematisch');assert.equal(confidenceClass(.3),'red');
});

test('PDF failures are converted into clear teacher-facing messages',()=>{
 assert.match(mapError(Error('Password required')),/passwortgeschützt/);
 assert.match(mapError(Error('Invalid PDF structure')),/beschädigt/);
 assert.match(mapError(Error('worker network fetch failed')),/Internetverbindung/);
});

test('reviewed import overlay adds content to existing History KB without replacing canonical data',()=>{
 const original={id:'g7-k1',topics:[{id:'topic-1',title:'Kanonisch'}],source_inventory:[{id:'src-1'}],events:[{id:'event-1'}]};
 const extension={import_id:'IMP-TEST-SESSION',payload:{topics:[{id:'ext-1',title:'Neue Fundstelle'}],source_inventory:[{id:'src-import'}]}};
 const merged=merge(original,[extension,extension]);
 assert.deepEqual(merged.topics.map(x=>x.id),['topic-1','ext-1']);
 assert.deepEqual(merged.source_inventory.map(x=>x.id),['src-1','src-import']);
 assert.deepEqual(merged.events,original.events);
});

test('the existing Assessment History Adapter exposes reviewed imports as chapter topics',async()=>{
 const oldWindow=global.window,oldFetch=global.fetch;
 global.window={KathleenHistoryImports:{loadAndMerge:async chapter=>({available:true,chapter:merge(chapter,[{payload:{topics:[{id:'ext-2',title:'Aus PDF geprüft'}],source_inventory:[]}}])})}};
 global.fetch=async()=>({ok:true,json:async()=>({id:'g7-k1',topics:[{id:'topic-1',title:'Kanonisch'}]})});
 try{delete require.cache[require.resolve('../tools/assessments/assessment-adapters.js')];const {HistoryAssessmentAdapter}=require('../tools/assessments/assessment-adapters.js');const chapter=await HistoryAssessmentAdapter.chapter('grade-7/chapter-1.json');assert.deepEqual(HistoryAssessmentAdapter.topics(chapter).map(x=>x.id),['topic-1','ext-2'])}
 finally{if(oldWindow===undefined)delete global.window;else global.window=oldWindow;global.fetch=oldFetch}
});

test('History games consume reviewed imported topics through the same Knowledge Base overlay',()=>{
 const quick= require('node:fs').readFileSync(require('node:path').join(__dirname,'../tools/quick-games/knowledge-source-v1.js'),'utf8');
 const hunt=require('node:fs').readFileSync(require('node:path').join(__dirname,'../tools/quick-games/history-hunt/index.html'),'utf8');
 assert.match(quick,/loadAndMerge\(d\)/);assert.match(quick,/extraction_provenance\?\.reviewed/);
 assert.match(hunt,/loadHistoryImports\(data\)/);assert.match(hunt,/label:'Themenjagd'/);
});

test('migration persists only reviewed structured history content and restricts direct table access',()=>{
 const sql=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supabase/migrations/202609250001_history_content_imports.sql'),'utf8');
 assert.match(sql,/toolbox_verify_admin\(p_passphrase\)/);
 assert.match(sql,/unique \(chapter_id, source_sha256\)/);
 assert.match(sql,/revoke all on public\.history_content_imports from public, anon, authenticated/i);
 assert.match(sql,/extraction_provenance/);
 assert.doesNotMatch(sql,/pdf_bytes|page_text|original_pdf/i);
});
