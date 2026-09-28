const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../tools/content-extractor-core.js');

test('inventory recognises supported and inventoried-only file types',()=>{
 assert.equal(Core.fileType('worksheet.PDF'),'pdf');
 assert.equal(Core.fileType('relative-clauses.docx'),'docx');
 assert.equal(Core.fileType('slides.pptx'),'pptx');
 assert.equal(Core.fileType('recording.mp3'),'audio');
 assert.equal(Core.fileType('legacy.pages'),'other');
 const row=Core.inventoryRecord({name:'Grammar.docx',relativePath:'Klasse 9/Unit 3/Grammar.docx',size:42,modified:1});
 assert.equal(row.schemaVersion,'english-extracted-document/v1');
 assert.equal(row.source.relativePath,'Klasse 9/Unit 3/Grammar.docx');
 assert.equal(row.provenance.originalRemainsLocal,true);
});

test('content scan ignores DUA app debris but keeps real documents',()=>{
 assert.equal(Core.isEnglishContentCandidate('Leistungsmessung/Unit 1/Test.pdf'),true);
 assert.equal(Core.isEnglishContentCandidate('Unterrichtsassistent/content/media/kv/worksheet.docx'),true);
 assert.equal(Core.isEnglishContentCandidate('Leistungserhebungen/old-test.doc'),true);
 assert.equal(Core.isEnglishContentCandidate('Unterrichtsassistent/content/pages/page_1/Scale1.png'),false);
 assert.equal(Core.isEnglishContentCandidate('GL 2 Workbook/app/assets/hilfe.pdf'),false);
 assert.equal(Core.isEnglishContentCandidate('Unterrichtsassistent/app.js'),false);
 assert.equal(Core.isEnglishContentCandidate('Unterrichtsassistent/Lizenz.txt'),false);
 assert.equal(Core.isEnglishContentCandidate('Unterrichtsassistent/content/media/kv/._worksheet.pdf'),false);
 assert.equal(Core.isSystemShadow('GL 2 Workbook/.DS_Store'),true);
});

test('English classification prioritises folder, filename and headings with review confidence',()=>{
 const result=Core.classifyEnglish({relativePath:'Englisch/Klasse 9/Unit 3/Grammar/Relative Clauses/worksheet.docx',fileName:'worksheet.docx',headings:['RELATIVE CLAUSES'],text:'Complete the grammar exercises.'});
 assert.equal(result.subject,'english');
 assert.equal(result.grade,9);
 assert.equal(result.unit,3);
 assert.equal(result.section,'grammar');
 assert.match(result.topic,/Relative Clauses/i);
 assert.ok(result.confidence>=.8);
 assert.equal(result.needs_review,false);
 const uncertain=Core.classifyEnglish({relativePath:'misc/file.docx',fileName:'file.docx'});
 assert.equal(uncertain.section,'other');
 assert.equal(uncertain.needs_review,true);
});

test('resume decisions distinguish unchanged, changed, failed and new files',()=>{
 const previous={source:{size:100,modified:new Date(1234).toISOString()},status:'ready'};
 assert.equal(Core.resumeDecision(previous,{size:100,modified:1234}),'unchanged');
 assert.equal(Core.resumeDecision(previous,{size:101,modified:1234}),'changed');
 assert.equal(Core.resumeDecision({...previous,status:'error'},{size:100,modified:1234}),'retry');
 assert.equal(Core.resumeDecision(null,{size:100,modified:1234}),'new');
});

test('exact duplicates retain one canonical source and mark later paths',()=>{
 const records=[
  {id:'a',source:{relativePath:'A/original.pdf',sha256:'f'.repeat(64)}},
  {id:'b',source:{relativePath:'B/copy.pdf',sha256:'f'.repeat(64)}},
  {id:'c',source:{relativePath:'C/other.pdf',sha256:'e'.repeat(64)}}
 ];
 const duplicates=Core.canonicalDuplicates(records);
 assert.equal(duplicates.get('b'),'a');
 assert.equal(duplicates.has('c'),false);
});

test('structured extraction keeps original text, quality and provenance',()=>{
 const inventory=Core.inventoryRecord({name:'relative-clauses.txt',relativePath:'Klasse 9/Unit 3/Grammar/relative-clauses.txt',size:200,modified:1234,sha256:'a'.repeat(64)});
 const content={format:'text',rawText:'RELATIVE CLAUSES\nWe use who for people.\nExercise: Combine the sentences.'.repeat(8),blocks:[{type:'heading',text:'RELATIVE CLAUSES'},{type:'paragraph',text:'We use who for people.'}],headings:['RELATIVE CLAUSES'],needsOcr:false};
 const record=Core.extractionRecord(inventory,content);
 assert.equal(record.classification.grade,9);
 assert.equal(record.classification.section,'grammar');
 assert.equal(record.content.semantic.kind,'grammar');
 assert.equal(record.provenance.extractorVersion,'2.1.1');
 assert.ok(['ready','needs_review'].includes(record.status));
});

test('bulk UI is local-first, resumable and exposes review/export controls',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../tools/english-bulk-extractor/index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../tools/english-bulk-extractor/english-bulk-extractor.js'),'utf8');
 assert.match(html,/English Bulk Extractor/);
 assert.match(html,/Originaldateien.*bleiben auf diesem Gerät/);
 assert.match(html,/Pause/);
 assert.match(js,/Needs OCR/);
 assert.match(js,/indexedDB\.open/);
 assert.match(js,/Core\.resumeDecision/);
 assert.match(js,/canonicalDuplicates/);
 assert.match(js,/extractDocx/);
 assert.match(js,/application\/x-ndjson/);
 assert.doesNotMatch(js,/supabase\.co|openai\.com|anthropic\.com/i);
});

test('existing English Assessment Adapter exposes the reviewed local-library query without replacing Vocabulary KB',async()=>{
 const {EnglishAssessmentAdapter}=require('../tools/assessments/assessment-adapters.js');
 assert.equal(typeof EnglishAssessmentAdapter.bulkMaterials,'function');
 assert.deepEqual(await EnglishAssessmentAdapter.bulkMaterials({grade:9,unit:3,section:'grammar'}),[]);
 assert.equal(typeof EnglishAssessmentAdapter.entries,'function');
});
