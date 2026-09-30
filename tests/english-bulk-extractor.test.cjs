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
 assert.equal(Core.isEnglishContentCandidate('Leistungserhebungen/old-test.doc'),false);
 assert.equal(Core.isEnglishContentCandidate('GL 1 Trainingsbuch/_html/images/start.jpg'),false);
 assert.equal(Core.isEnglishContentCandidate('Unterrichtsassistent/content/pages/page_1/Scale1.png'),false);
 assert.equal(Core.isEnglishContentCandidate('GL 2 Workbook/app/assets/hilfe.pdf'),false);
 assert.equal(Core.isEnglishContentCandidate('Unterrichtsassistent/app.js'),false);
 assert.equal(Core.isEnglishContentCandidate('Unterrichtsassistent/Lizenz.txt'),false);
 assert.equal(Core.isEnglishContentCandidate('Unterrichtsassistent/content/media/kv/._worksheet.pdf'),false);
 assert.equal(Core.isSystemShadow('GL 2 Workbook/.DS_Store'),true);
});

test('mass import removes technical debris and legacy duplicates before hashing',()=>{
 const entry=relativePath=>({relativePath,file:{name:relativePath.split('/').at(-1)}}),report=Core.prepareEnglishImport([
  entry('5. Klasse Englisch/Unit 2/Test.pdf'),
  entry('5. Klasse Englisch/Unit 2/Test.doc'),
  entry('5. Klasse Englisch/Unit 2/Worksheet.docx'),
  entry('5. Klasse Englisch/_html/images/start.jpg'),
  entry('5. Klasse Englisch/Lizenz.txt')
 ],{rootName:'5. Klasse Englisch'});
 assert.deepEqual(report.accepted.map(x=>x.relativePath),['5. Klasse Englisch/Unit 2/Test.pdf','5. Klasse Englisch/Unit 2/Worksheet.docx']);
 assert.equal(report.reasons.parallel_format,1);
 assert.equal(report.reasons.technical_or_unsupported,2);
});

test('classification reads German grade folders and compact unit folders from grades 5 to 12',()=>{
 for(const grade of [5,6,7,8,9,10,11,12]){
  const result=Core.classifyEnglish({relativePath:`${grade}. Klasse Englisch/0. Green Line/02_unit2/Grammar worksheet.pdf`});
  assert.equal(result.grade,grade);
  assert.equal(result.unit,2);
  assert.equal(result.section,'grammar');
 }
 const mixed=Core.classifyEnglish({relativePath:'11. + 12. Klasse/Material/worksheet.pdf'});
 assert.equal(mixed.grade,null);
 assert.equal(mixed.needs_review,true);
 const specific=Core.classifyEnglish({relativePath:'11. + 12. Klasse/12. Klasse/Unit 2/Grammar worksheet.pdf'});
 assert.equal(specific.grade,12);
});

test('root folder context classifies files without changing their stable relative path',()=>{
 const inventory=Core.inventoryRecord({name:'worksheet.txt',relativePath:'Grammar/worksheet.txt',rootLabel:'12. Klasse Englisch'}),record=Core.extractionRecord(inventory,{format:'text',rawText:'GRAMMAR\nComplete the sentences with the correct tense. '.repeat(8),blocks:[],headings:['GRAMMAR'],needsOcr:false});
 assert.equal(record.source.relativePath,'Grammar/worksheet.txt');
 assert.equal(record.classification.grade,12);
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
 assert.equal(record.provenance.extractorVersion,'3.0.0');
 assert.ok(['ready','needs_review'].includes(record.status));
});

test('ZIP safety blocks traversal, executables, nested archives and zip bombs',()=>{
 const audit=Core.inspectZipEntries([{name:'../escape.pdf'},{name:'run.exe'},{name:'nested.zip'},{name:'safe/worksheet.pdf',uncompressedSize:1000,compressedSize:500}]);
 assert.equal(audit.safe,false);
 assert.deepEqual(audit.accepted.map(x=>x.safePath),['safe/worksheet.pdf']);
 assert.deepEqual(audit.problems.map(x=>x.code),['unsafe_path','executable','nested_archive']);
 const bomb=Core.inspectZipEntries([{name:'huge.pdf',uncompressedSize:1000000,compressedSize:1}],{...Core.LIMITS,maxCompressionRatio:10});
 assert.equal(bomb.accepted.length,0);
});

test('content router creates Grammar and Assessment Reference objects from one document',()=>{
 const classification={section:'grammar',topic:'Conditionals',confidence:.9};
 const content={rawText:'GRAMMAR TEST\nRule: Use if for a condition.\nExample: If it rains, I stay home.\nTask 1: Complete the sentences (5 points)',blocks:[],pages:[{pageIndex:1}]};
 const objects=Core.buildContentObjects(content,classification);
 assert.ok(objects.some(x=>x.type==='grammar'&&x.rules.length));
 assert.ok(objects.some(x=>x.type==='assessment_reference'&&x.tasks[0].points===5));
});

test('bulk UI is local-first, resumable and exposes review/export controls',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../tools/english-bulk-extractor/index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../tools/english-bulk-extractor/english-bulk-extractor.js'),'utf8');
 assert.match(html,/English Bulk Extractor/);
 assert.match(html,/Originaldateien.*bleiben auf diesem Gerät/);
 assert.match(html,/Pause/);
 assert.match(html,/Zuerst den Quellordner auswählen/);
 assert.doesNotMatch(html,/id="start"[^>]*disabled/);
 assert.match(js,/function startAnalysis/);
 assert.match(js,/Needs OCR/);
 assert.match(js,/indexedDB\.open/);
 assert.match(js,/Core\.resumeDecision/);
 assert.match(js,/prepareEnglishImport/);
 assert.match(html,/Intelligenter Massenimport/);
 assert.match(html,/preflightSummary/);
 assert.match(html,/nacheinander auswählen/);
 assert.match(js,/record\.source\?\.rootLabel===state\.rootName/);
 assert.match(js,/state\.rootName\}\/\$\{relativePath/);
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
