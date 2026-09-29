const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Model=require('../tools/english-kb-model.js');

function record(overrides={}){return{id:'eng-'+'a'.repeat(16),classification:{grade:9,unit:3,section:'grammar',topic:'Conditionals'},content:{objects:[{type:'grammar',title:'Conditionals',confidence:.92,rules:['Use if for a condition.'],examples:['If it rains, I stay home.'],sourcePages:[2]}]},quality:{score:.9},source:{fileName:'conditionals.pdf',relativePath:'Klasse 9/Unit 3/conditionals.pdf',sha256:'b'.repeat(64)},provenance:{reviewedAt:'2026-09-29T00:00:00Z',reviewStatus:'approved',approvedUses:['practice','assessment']},...overrides}}

test('reviewed documents become typed content units with provenance',()=>{const units=Model.units(record());assert.equal(units.length,1);assert.equal(units[0].type,'grammar');assert.equal(units[0].source.pages[0],2);assert.equal(units[0].provenance.entryId,'eng-'+'a'.repeat(16))});
test('assessment candidates require explicit approval and assessment use',()=>{assert.equal(Model.assessmentCandidates([record()],{grade:9,type:'grammar'}).length,1);const practice=record({provenance:{reviewedAt:'2026-09-29T00:00:00Z',reviewStatus:'reviewed',approvedUses:['practice']}});assert.equal(Model.assessmentCandidates([practice],{grade:9,type:'grammar'}).length,0)});
test('task context keeps grammar rules, examples and source reference',()=>{const context=Model.taskContext(Model.units(record())[0]);assert.match(context.promptContext,/Use if/);assert.equal(context.examples.length,1);assert.equal(context.source.fileName,'conditionals.pdf')});
test('migration creates private content units and task blueprints',()=>{const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609290001_english_kb_content_units.sql'),'utf8');for(const name of ['english_kb_content_units','english_kb_task_blueprints','approved_for_assessment','competency_refs'])assert.ok(sql.includes(name));assert.match(sql,/revoke all on public\.english_kb_content_units from public,anon,authenticated/i)});
