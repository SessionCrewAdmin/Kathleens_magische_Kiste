const test=require('node:test');
const assert=require('node:assert/strict');
const V3=require('../tools/english-content-extractor-v3-core.js');
const Core=require('../tools/content-extractor-core.js');

function sample(){return{format:'pdf',needsOcr:false,pages:[
 {pageIndex:1,lines:[
  {text:'Arbeitsblatt für das Fach Englisch',zone:'header'},
  {text:'Access 6: Unit 1 Simple past',zone:'header'},
  {text:'Use the simple past.',zone:'body'},
  {text:"The Blackwells' last weekend.",zone:'body'},
  {text:'Mr Blackwell __________ (have) to work on Saturday.',zone:'body'},
  {text:'Complete the sentences. Find verbs and use the simple past.',zone:'body'},
  {text:'Last Friday Abby and her friend Maya __________ on the sofa.',zone:'body'},
  {text:'Weitere anspruchsvolle Proben findest Du auf unserer Partnerseite www.example.test.',zone:'footer'},
  {text:'Seite 1 von 2 Dokument Nr. 596',zone:'footer'}],text:'Access 6: Unit 1 Simple past\nUse the simple past.\nComplete the sentences.'},
 {pageIndex:2,lines:[
  {text:'Lösung',zone:'header'},
  {text:'Access 6: Unit 1 Simple past',zone:'header'},
  {text:'Mr Blackwell had (have) to work on Saturday.',zone:'body'},
  {text:"Watching a film at the Blackwells'",zone:'body'},
  {text:'Last Friday Abby and her friend Maya sat on the sofa.',zone:'body'},
  {text:'Seite 2 von 2',zone:'footer'}],text:'Lösung\nAccess 6: Unit 1 Simple past'}
 ],rawText:'Access 6: Unit 1 Simple past'} }

test('V3 reference structure detects metadata, two tasks, solution page and boilerplate',()=>{const result=V3.analyzeDocument(sample(),{}, {fileName:'596-access-6-englisch-gymnasium-kostenloses-arbeitsblatt.pdf',sha256:'a'.repeat(64)});assert.equal(result.metadata.grade,6);assert.equal(result.metadata.unit,1);assert.equal(result.metadata.topic,'Simple past');assert.equal(result.tasks.length,2);assert.equal(result.tasks[0].type,'grammar');assert.equal(result.tasks[0].taskType,'gap_fill');assert.ok(result.tasks[0].solution.answers.some(x=>x.answer==='had'&&x.baseForm==='have'));assert.equal(result.pages[1].isSolution,true);assert.ok(result.ignored.some(x=>/Partnerseite/.test(x.text)));assert.ok(!result.tasks.some(x=>/Partnerseite/.test(x.title)))});
test('V3 uses a matching solution heading instead of a generic instruction title',()=>{const result=V3.analyzeDocument(sample(),{}, {fileName:'sample.pdf'});assert.match(result.tasks[1].title,/Watching a film at the Blackwells/);assert.match(result.tasks[1].title,/Simple past/)});
test('V3 content objects keep each task separate with stable source provenance',()=>{const analysis=V3.analyzeDocument(sample(),{}, {fileName:'sample.pdf'}),objects=V3.toContentObjects(analysis);assert.equal(objects.length,2);assert.notEqual(objects[0].taskId,objects[1].taskId);assert.deepEqual(objects[0].sourcePages,[1]);assert.equal(objects[0].solution.sourcePages[0],2)});
test('existing extraction pipeline emits v3 records without automatic approval',()=>{const inv=Core.inventoryRecord({name:'access-6.pdf',relativePath:'Access 6/Unit 1/access-6.pdf',sha256:'b'.repeat(64),modified:1,size:100});const record=Core.extractionRecord(inv,sample());assert.equal(record.schemaVersion,'english-extracted-document/v3');assert.equal(record.provenance.extractorVersion,'3.0.0');assert.equal(record.content.objects.length,2);assert.equal(record.classification.grade,6);assert.ok(record.content.objects.every(x=>x.reviewStatus==='needs_review'&&!x.approvedUses.includes('assessment')))});
test('reanalysis comparison identifies added, removed and changed tasks',()=>{const analysis=V3.analyzeDocument(sample(),{}, {fileName:'sample.pdf'}),objects=V3.toContentObjects(analysis),record={content:{objects:[{...objects[0],title:'Manual title'}]}};const diff=V3.compareReanalysis(record,analysis);assert.equal(diff.added.length,1);assert.equal(diff.changed.length,1);assert.equal(diff.removed.length,0)});
test('second solution check creates transparent points and an expectation horizon',()=>{const task={title:'Simple past',instruction:'Complete the sentences.',sourceText:'Tom ___ (go) home.',gaps:[{id:'gap-1'}],confidence:{title:.8,assignment:.9},solution:{text:'Solutions\nTom went (go) home.',answers:[{answer:'went',baseForm:'go'}],sourcePages:[2]}};V3.enrichSolution(task);assert.equal(task.solution.plausibility.status,'plausible');assert.equal(task.solution.totalPoints,1);assert.deepEqual(task.solution.partialPoints,[{id:'answer-1',criterion:'went',points:1}]);assert.equal(task.solution.expectationHorizon.provenance.automaticSuggestion,true)});
test('unrelated or incomplete solutions remain visibly unsafe',()=>{const check=V3.solutionPlausibility({title:'Simple past',instruction:'Complete the sentences.',sourceText:'Tom ___ home.',gaps:[{id:'gap-1'}],solution:{text:'Bananas are yellow.',answers:[]}});assert.equal(check.status,'uncertain');assert.ok(check.issues.some(x=>/kaum gemeinsame/.test(x)));assert.ok(check.issues.some(x=>/keine strukturierten Antworten/.test(x)))});
