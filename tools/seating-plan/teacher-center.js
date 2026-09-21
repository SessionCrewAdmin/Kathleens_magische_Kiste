(()=>{
'use strict';
const K=window.KathleenClassLists;if(!K)return;
const OBS='grade-observation-periods-v1',HW='kathleenHomeworkStrikesV1';
const modal=document.getElementById('studentControlModal');if(!modal||document.getElementById('seatTeacherActions'))return;
const style=document.createElement('style');style.textContent='.seat-teacher-actions{margin-top:10px;padding-top:10px;border-top:1px solid #eadfea}.seat-teacher-actions h3{margin:0 0 7px;font-size:11px}.seat-teacher-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.seat-teacher-grid button{border:1px solid #e8dce8;background:#fffafd;border-radius:9px;min-height:36px;color:#654f68;font-weight:950;font-size:9px}.seat-teacher-grid button.good{color:#4e806b}.seat-teacher-grid button.bad{color:#a65a6d}.seat-teacher-row{display:flex;gap:5px;margin-top:6px}.seat-teacher-row button{flex:1;border:1px solid #e8dce8;background:#fff;border-radius:9px;min-height:35px;color:#654f68;font-weight:900;font-size:8px}.seat-teacher-status{font-size:8px;color:#8e7a90;margin-top:6px;min-height:12px}';document.head.appendChild(style);
const box=document.createElement('div');box.id='seatTeacherActions';box.className='seat-teacher-actions';box.innerHTML='<h3>Unterricht</h3><div class="seat-teacher-grid"><button class="good" data-obs="pp">++</button><button class="good" data-obs="p">+</button><button data-obs="n">•</button><button class="bad" data-obs="m">−</button><button class="bad" data-obs="mm">−−</button><button data-obs="note">✎ Notiz</button></div><div class="seat-teacher-row"><button id="seatHomework">✓ Hausaufgabe fehlt</button><button id="seatOpenObs">👁️ Verlauf</button></div><div class="seat-teacher-status" id="seatTeacherStatus"></div>';
modal.querySelector('.modalCard').appendChild(box);
const student=()=>document.getElementById('controlName')?.textContent?.trim()||'',classNow=()=>K.getGlobalClass?.(),subject=()=>localStorage.getItem('kathleenActiveSubjectV1')||'';
async function observation(mark){
 const name=student(),g=classNow();if(!name||!g)return;let db=await K.secureGet(OBS,{version:1,periods:[]})||{version:1,periods:[]},sub=subject(),p=(db.periods||[]).filter(x=>x.classId===g.id&&x.status==='open'&&(!sub||String(x.subject).toLowerCase()===sub.toLowerCase())).sort((a,b)=>String(b.start).localeCompare(String(a.start)))[0];
 if(!p){document.getElementById('seatTeacherStatus').textContent='Kein offener Beobachtungszeitraum für '+(sub||'dieses Fach')+'.';return}
 let note='';if(mark==='note'){note=prompt('Beobachtung zu '+name+':','')||'';if(!note.trim())return}
 p.events=p.events||[];p.events.push({id:'e-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),student:name,mark,note:note.trim(),at:new Date().toISOString()});p.updatedAt=new Date().toISOString();await K.secureSet(OBS,db);document.getElementById('seatTeacherStatus').textContent=(mark==='note'?'Notiz':mark)+' gespeichert.'
}
function homework(){
 const name=student(),g=classNow();if(!name||!g)return;let db;try{db=JSON.parse(localStorage.getItem(HW)||'{}')}catch(e){db={}}const key=g.id,entry=db[key]||{classId:g.id,className:g.name,students:{}};entry.students=entry.students||{};const s=entry.students[name]||{count:0,history:[]};s.count=Number(s.count||0)+1;s.history=s.history||[];s.history.push({at:new Date().toISOString(),reason:'Sitzplan Schnellaktion'});entry.students[name]=s;db[key]=entry;localStorage.setItem(HW,JSON.stringify(db));document.getElementById('seatTeacherStatus').textContent='Hausaufgaben-Strich gesetzt.'
}
box.querySelectorAll('[data-obs]').forEach(b=>b.onclick=()=>observation(b.dataset.obs));box.querySelector('#seatHomework').onclick=homework;box.querySelector('#seatOpenObs').onclick=()=>location.href='../schulaufgabenrechner/#observations';
})();