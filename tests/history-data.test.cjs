const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),history=path.join(root,'data','history');
const read=rel=>JSON.parse(fs.readFileSync(path.join(history,rel),'utf8'));
test('history catalog exposes complete imports for grades 7, 9, 10 and 12',()=>{
 const c=read('catalog.json'),audit=read('audit.json');
 assert.deepEqual(c.grades.map(g=>g.grade),[7,9,10,12]);assert.equal(c.status,'audited');assert.deepEqual(c.full_import_grades,[7,9,10,12]);assert.equal(audit.result,'pass');
 assert.deepEqual(Object.fromEntries(Object.entries(audit.grades).map(([g,x])=>[g,[x.files_audited,x.files_expected]])),{'9':[49,49],'10':[38,38],'12':[46,46]});
 assert.equal(audit.totals.files,133);assert.equal(audit.totals.topics,130);assert.ok(audit.totals.questions>=300)
});
test('every new history chapter is structurally complete and fully audited',()=>{
 const c=read('catalog.json'),sourceFiles=new Set(),ids=new Set();
 for(const grade of c.grades.filter(g=>[9,10,12].includes(g.grade))){
  for(const ref of grade.chapters){
   const d=read(ref.data);assert.equal(d.grade,grade.grade);assert.equal(d.import_status,'full_import');assert.equal(d.full_import_audit.files_audited,d.full_import_audit.files_expected);assert.ok(d.topics.length>=7);assert.ok(d.canonical_terms.length>=7);assert.ok(d.people.length>=5);assert.ok(d.events.length>=6);assert.ok(d.question_bank.length>=18);assert.ok(d.assignments.length>=d.source_inventory.length-1);
   for(const source of d.source_inventory){assert.equal(source.audited,true);assert.ok(source.characters_extracted>0);assert.ok(!sourceFiles.has(source.file),'duplicate source '+source.file);sourceFiles.add(source.file)}
   for(const field of ['topics','canonical_terms','people','events','question_bank','assignments'])for(const item of d[field]){assert.ok(item.id);assert.ok(!ids.has(item.id),'duplicate id '+item.id);ids.add(item.id)}
   const sourceIds=new Set(d.source_inventory.map(x=>x.id)),termIds=new Set(d.canonical_terms.map(x=>x.id)),personIds=new Set(d.people.map(x=>x.id)),eventIds=new Set(d.events.map(x=>x.id)),topicIds=new Set(d.topics.map(x=>x.id));for(const t of d.topics){for(const id of t.terms)assert.ok(termIds.has(id),id);for(const id of t.people)assert.ok(personIds.has(id),id);for(const id of t.events)assert.ok(eventIds.has(id),id);for(const ref of t.source_refs)assert.ok(sourceIds.has(ref.source_id),ref.source_id)}for(const q of d.question_bank){assert.ok(topicIds.has(q.topic),q.topic);assert.ok(q.prompt&&q.answer)}for(const payload of d.game_payloads){for(const id of payload.event_ids||[])assert.ok(eventIds.has(id),id);for(const id of payload.assets||[])assert.ok(d.visual_source_catalog.some(x=>x.id===id),id)}
  }
  for(const ref of grade.supplements||[]){const d=read(ref.data);assert.equal(d.import_status,'full_import');assert.ok(d.modules.length>=3);for(const source of d.source_inventory){assert.equal(source.audited,true);assert.ok(!sourceFiles.has(source.file),'duplicate source '+source.file);sourceFiles.add(source.file)}}
 }
 assert.equal(sourceFiles.size,133)
});
test('history source binaries stay private and every published dataset is offline cached',()=>{
 const all=[];function walk(dir){for(const x of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,x.name);x.isDirectory()?walk(p):all.push(p)}}walk(history);
 assert.equal(all.filter(x=>/\.(pdf|docx|png|jpe?g|webp)$/i.test(x)).length,0);
 const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),c=read('catalog.json');
 for(const grade of c.grades)for(const ref of [...(grade.chapters||[]),...(grade.supplements||[])])assert.ok(sw.includes(ref.data),ref.data+' missing from cache');
 for(const file of ['data/history/audit.json','tools/history-content-center/history-content-center.js'])assert.ok(sw.includes(file),file+' missing from cache')
});
