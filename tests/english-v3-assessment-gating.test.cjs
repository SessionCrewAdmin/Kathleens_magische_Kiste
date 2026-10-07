const test=require('node:test');
const assert=require('node:assert/strict');
const V3=require('../tools/english-content-extractor-v3-core.js');
const Extractor=require('../tools/content-extractor-core.js');
const Model=require('../tools/english-kb-model.js');
const Manager=require('../tools/english-kb-manager-core.js');

test('V3 content enters KB only after subject review and explicit assessment release',()=>{
 const source=Extractor.inventoryRecord({name:'conditionals.pdf',relativePath:'Klasse 9/Unit 3/conditionals.pdf',sha256:'c'.repeat(64),modified:Date.UTC(2026,0,1),size:120});
 const content={format:'pdf',needsOcr:false,rawText:'Unit 3 Conditionals\nUse the first conditional.\nIf it rains, we will stay home.',pages:[{pageIndex:1,text:'Unit 3 Conditionals\nUse the first conditional.\nIf it rains, we will stay home.',lines:[{text:'Unit 3 Conditionals',zone:'header'},{text:'Use the first conditional.',zone:'body'},{text:'If it rains, we will stay home.',zone:'body'}]}]};
 const extracted=Extractor.extractionRecord(source,content);
 assert.equal(extracted.schemaVersion,'english-extracted-document/v3');
 assert.equal(extracted.content.objects[0].reviewStatus,'needs_review');
 assert.ok(!extracted.content.objects[0].approvedUses.includes('assessment'));
 assert.equal(Model.assessmentCandidates([extracted],{grade:9}).length,0);

 const reviewed=Manager.updateRecordUnit(extracted,`${extracted.id}:u1`,{reviewStatus:'approved',approvedUses:['practice','worksheet']});
 assert.equal(Model.assessmentCandidates([reviewed],{grade:9}).length,0,'subject review alone must not release assessment use');

 const released=Manager.updateRecordUnit(reviewed,`${extracted.id}:u1`,{reviewStatus:'approved',approvedUses:['practice','worksheet','assessment']});
 const candidates=Model.assessmentCandidates([released],{grade:9,type:'grammar'});
 assert.equal(candidates.length,1);
 assert.equal(candidates[0].id,`${extracted.id}:u1`);
 assert.equal(candidates[0].source.fileName,'conditionals.pdf');
});

test('assessment use cannot be released before approved subject review',()=>{
 const record={id:'sample',classification:{grade:9,unit:3,section:'grammar'},source:{fileName:'sample.pdf'},content:{objects:[{type:'grammar',title:'Conditionals',reviewStatus:'needs_review',approvedUses:['practice'],rules:['Use if.'],sourcePages:[1]}]},provenance:{reviewStatus:'needs_review',approvedUses:['practice']}};
 assert.throws(()=>Manager.updateRecordUnit(record,'sample:u1',{reviewStatus:'needs_review',approvedUses:['practice','assessment']}),/fachlicher Prüfung/);
 assert.equal(Model.assessmentCandidates([record]).length,0);
});
