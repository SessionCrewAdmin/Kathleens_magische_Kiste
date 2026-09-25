(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const base='../../data/history/';
let catalog=null,data=null,tab='topics',activeId='',activeGrade=7;
async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status+' '+url);return r.json()}
function gradeRecord(){return catalog?.grades?.find(g=>g.grade===activeGrade)}
function readyItems(){const g=gradeRecord();return [...(g?.chapters||[]),...(g?.supplements||[])].filter(c=>c.status==='ready'&&c.data)}
async function loadChapter(ch){
 if(!ch?.data)return;activeId=ch.id;$('#chapterView').innerHTML='<div class="empty">Kapitel wird geladen …</div>';
 data=await getJson(base+ch.data+'?v=20260925-editorial-7-9');tab='topics';renderGrades();renderChapters();render();
 const u=new URL(location.href);u.searchParams.set('grade',activeGrade);u.searchParams.set('chapter',ch.id);history.replaceState(null,'',u)
}
async function selectGrade(grade,wanted){
 activeGrade=grade;activeId='';data=null;renderGrades();renderChapters();
 const items=readyItems(),ch=items.find(c=>c.id===wanted)||items[0];
 if(!ch)throw new Error('Kein importiertes Kapitel für Klasse '+grade+' gefunden');
 await loadChapter(ch)
}
async function init(){
 try{
  catalog=await getJson(base+'catalog.json?v=20260925-editorial-7-9');
  const params=new URLSearchParams(location.search),requested=Number(params.get('grade'));
  activeGrade=catalog.grades.some(g=>g.grade===requested)?requested:(catalog.grades[0]?.grade||7);
  await selectGrade(activeGrade,params.get('chapter'));
  $('#search').oninput=render
 }catch(e){$('#chapterView').innerHTML='<div class="empty"><b>Daten konnten nicht geladen werden.</b><br><span style="font-size:10px">'+esc(e.message||e)+'</span></div>';console.error(e)}
}
function renderGrades(){
 $('#gradeSwitch').innerHTML=(catalog?.grades||[]).map(g=>'<button class="pill grade '+(g.grade===activeGrade?'active':'')+'" data-grade="'+g.grade+'">Klasse '+g.grade+'</button>').join('');
 document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>selectGrade(Number(b.dataset.grade)).catch(showError))
}
function renderChapters(){
 const items=[...(gradeRecord()?.chapters||[]),...(gradeRecord()?.supplements||[])];
 $('#chapters').innerHTML=items.map(c=>'<button class="chapter '+(c.status==='ready'?'ready':'')+' '+(c.id===activeId?'active':'')+'" data-id="'+esc(c.id)+'" '+(c.status!=='ready'||!c.data?'disabled':'')+'><b>'+esc(c.title)+'</b><span>'+(c.quality_status==='editorially_reviewed'?'✓ Redaktionell geprüft · ':c.status==='ready'?'Full Import · ':'Import vorbereitet · ')+esc(c.book_pages||'')+'</span></button>').join('');
 document.querySelectorAll('.chapter[data-id]:not(:disabled)').forEach(b=>b.onclick=()=>loadChapter(items.find(x=>x.id===b.dataset.id)).catch(showError))
}
function showError(e){$('#chapterView').innerHTML='<div class="empty">'+esc(e.message||e)+'</div>'}
function topics(){return data?.topics||data?.modules?.map(m=>({title:m.title,summary:(m.focus||[]).join(' · '),student_level_summary:(m.focus||[]).join(' · '),learning_objectives:m.focus||[]}))||[]}
function allQuestions(){return data?.question_bank||((data?.topics||[]).flatMap(t=>t.questions||[]))}
function setStats(){
 $('#sTopics').textContent=topics().length;$('#sTerms').textContent=(data.canonical_terms||[]).length;
 $('#sPeople').textContent=(data.people||[]).length;$('#sEvents').textContent=(data.events||[]).length;
 $('#sQuestions').textContent=allQuestions().length;$('#sAssignments').textContent=(data.assignments||[]).length;
 $('#sMedia').textContent=(data.visual_source_catalog||[]).length+(data.audiovisual_material||[]).length;
 const a=data.full_import_audit||{},quality=data.editorial_quality||{};$('#importState').textContent=quality.status==='editorially_reviewed'?'✓ Redaktionell geprüft · Full Import · '+(a.files_audited||0)+'/'+(a.files_expected||0)+' Quellen':data.import_status==='full_import'?'✓ Full Import · '+(a.files_audited||0)+'/'+(a.files_expected||0)+' Dateien':'Import läuft'
}
function match(v){const q=$('#search').value.trim().toLowerCase();return !q||JSON.stringify(v).toLowerCase().includes(q)}
function render(){
 if(!data)return;setStats();
 const tabs=[['topics','Themen'],['timeline','Timeline'],['terms','Begriffe'],['people','Personen'],['questions','Fragen'],['assignments','Aufgaben'],['media','Bilder & Medien'],['didactics','Didaktik'],['sources','Dateien'],['audit','Audit']];
 let body='';
 if(tab==='topics')body='<div class="cards">'+topics().filter(match).map(t=>'<article class="card"><h3>'+esc(t.title)+'</h3><p>'+esc(t.student_level_summary||t.summary)+'</p><div class="tags">'+(t.learning_objectives||[]).slice(0,3).map(x=>'<span class="tag">'+esc(x)+'</span>').join('')+'</div></article>').join('')+'</div>';
 if(tab==='timeline')body='<div class="timeline">'+(data.events||[]).filter(match).sort((a,b)=>(a.year||0)-(b.year||0)).map(e=>'<div class="event"><strong>'+esc(e.year)+'</strong><div><b>'+esc(e.title)+'</b><p>'+esc(e.summary)+'</p></div></div>').join('')+'</div>';
 if(tab==='terms')body=(data.canonical_terms||[]).filter(match).map(t=>'<div class="term"><b>'+esc(t.label)+'</b><p>'+esc(t.definition)+'</p></div>').join('');
 if(tab==='people')body='<div class="cards">'+(data.people||[]).filter(match).map(p=>'<article class="card"><h3>'+esc(p.name)+'</h3><p><b>'+esc(p.role||'')+'</b><br>'+esc(p.relevance||'')+'</p></article>').join('')+'</div>';
 if(tab==='questions')body=allQuestions().filter(match).map(q=>'<div class="question"><small>'+esc(q.difficulty||'standard')+' · '+esc(q.competency||q.type||'Frage')+(q.game_ready?' · SPIELBEREIT':'')+'</small><b>'+esc(q.prompt)+'</b><p>Antwort: '+esc(Array.isArray(q.answer)?q.answer.join(' → '):q.answer)+'</p>'+(q.choices?.length?'<div class="tags">'+q.choices.map(x=>'<span class="tag">'+esc(x)+'</span>').join('')+'</div>':'')+'</div>').join('');
 if(tab==='assignments')body=(data.assignments||[]).filter(match).map(a=>'<div class="assignment"><small>'+esc(a.locator)+' · '+esc(a.type||'Aufgabe')+'</small><b>'+esc(a.focus)+'</b><p>'+esc(a.solution_core||'')+'</p></div>').join('');
 if(tab==='media'){const media=[...(data.visual_source_catalog||[]),...(data.audiovisual_material||[])];body='<div class="cards">'+media.filter(match).map(m=>'<div class="media-card"><div class="media-icon">'+(m.type==='Film'||m.type==='Audio/Video'?'🎬':m.type==='Audio'?'🎧':m.kind==='Textquelle'?'📜':'🖼️')+'</div><div><b>'+esc(m.title)+'</b><p>'+esc(m.locator||'')+'<br>'+esc(m.learning_use||m.topic||'')+(m.binary_in_repo===false?'<br>Original nicht öffentlich gespeichert.':'')+'</p></div></div>').join('')+'</div>'}
 if(tab==='didactics')body='<div class="cards">'+(data.didactics||[]).filter(match).map(d=>'<article class="card"><h3>'+esc(d.method)+'</h3><p>'+esc(d.use||'')+(d.purpose?' · '+esc(d.purpose):'')+'</p></article>').join('')+'</div>';
 if(tab==='sources')body=(data.source_inventory||[]).filter(match).map(s=>'<div class="source"><b>'+esc(s.type)+' · '+esc(s.scope||s.file)+'</b><span>'+esc(s.pages?s.pages+' Seiten':s.file)+'</span><span>'+(s.audited?'✓ geprüft':'')+'</span></div>').join('');
 if(tab==='audit'){const a=data.full_import_audit||{},q=data.editorial_quality||{};body='<div class="card"><h3>'+(q.status==='editorially_reviewed'?'Redaktioneller Qualitäts-Audit':'Full-Import-Audit')+'</h3><p>'+esc(a.note||'')+'</p><div class="tags">'+(q.criteria||a.coverage||[]).map(x=>'<span class="tag">✓ '+esc(x)+'</span>').join('')+'</div></div><div class="auditrow"><b>Quellen</b><span>'+esc(a.files_audited||0)+' von '+esc(a.files_expected||0)+' geprüft</span></div>'+(q.questions_reviewed!=null?'<div class="auditrow"><b>Fragen</b><span>'+esc(q.questions_reviewed)+' redaktionell geprüft · '+esc(q.game_ready_questions||0)+' spielbereit</span></div><div class="auditrow"><b>Aufgaben</b><span>'+esc(q.assignments_reviewed||0)+' konkrete Erwartungshorizonte · '+esc(q.generic_solution_cores||0)+' pauschale Lösungen</span></div>':'')+'<div class="auditrow"><b>Originalmaterial</b><span>PDFs, Word-Dateien und Lehrwerksbilder bleiben außerhalb des öffentlichen Repositories.</span></div>'}
 const chapterLabel=/review/.test(data.id)?'ÜBUNGEN':('KAPITEL '+esc(String(data.id).split('-k')[1]||'?'));
 $('#chapterView').innerHTML='<div class="chapter-head"><div><div class="eyebrow">KLASSE '+data.grade+' · '+chapterLabel+' · S. '+esc(data.book_pages)+'</div><h2>'+esc(data.title)+'</h2><p>'+esc(data.chapter_summary)+'</p></div></div><div class="tabs">'+tabs.map(([id,label])=>'<button class="tab '+(tab===id?'active':'')+'" data-tab="'+id+'">'+label+'</button>').join('')+'</div>'+(body||'<div class="empty">Keine Treffer.</div>');
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()})
}
init()
})();
