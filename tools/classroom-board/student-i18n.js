(()=>{
'use strict';
const KEY='sb_publishable_GIyyWoyaQXipaA4S9OuTyQ_cZn7LUgV',SB='https://fzqxnjhuvgpgovcovosl.supabase.co/rest/v1/rpc/';
let lang='de',busy=false,timer=null;
const D={
'Schüler · Classroom Board · V23.4':'Student · Classroom Board',
'Präsentation · Classroom Board':'Presentation · Classroom Board',
'Präsentation':'Presentation','Raum':'Room','Raum offline':'Room offline','Vollbild':'Fullscreen','Vollbild verlassen':'Exit fullscreen','verbindet neu …':'reconnecting …','Verbunden':'Connected',
'Verbinden':'Join','Raumcode':'Room code','Dein Name':'Your name','Name':'Name','Klasse wird geladen …':'Loading class …','Schüler suchen …':'Search students …','bereits verbunden':'already connected',
'Nur ansehen':'View only','Freie Ansicht':'Free view','Frau Müllers Ansicht':"Mrs Müller's view",'Workspace freigegeben':'Workspace enabled','Unterricht beendet':'Lesson ended','Du kannst dieses Fenster schließen.':'You can close this window.','Session ungültig':'Session invalid','Verbindung fehlgeschlagen':'Connection failed','wieder online':'back online','offline · Änderungen bleiben lokal':'offline · changes stay local','live · lokal geändert':'live · local changes','live · Anzeigeproblem':'live · display issue',
'Erklärung':'Explanation','Einzelarbeit':'Individual work','Gruppenarbeit':'Group work','Klassenaufgabe':'Class task','Pause':'Break','Freie Phase':'Free phase','Unterricht':'Lesson',
'Material':'Materials','Materialien':'Materials','Hochladen':'Upload','Löschen':'Delete','Schließen':'Close','Stift':'Pen','Marker':'Highlighter','Radierer':'Eraser','Auswahl':'Select','Text':'Text','Notiz':'Note','Rückgängig':'Undo','Wiederholen':'Redo','Farbe':'Color','Schriftgröße':'Font size','Fett':'Bold','Zentriert':'Centered','Links':'Left','Rechts':'Right',
'PDF wird verarbeitet …':'Processing PDF …','PDF Seite':'PDF page','Seite':'Page','Seiten':'pages','eingefügt':'added','Fehler bei':'Error with',
'Frau Müller: ':'Mrs Müller: ','Serverfehler':'Server error','nicht verbunden':'not connected','Noch niemand verbunden.':'Nobody connected yet.'
};
const reps=[[/\bErklärung\b/g,'Explanation'],[/\bEinzelarbeit\b/g,'Individual work'],[/\bGruppenarbeit\b/g,'Group work'],[/\bKlassenaufgabe\b/g,'Class task'],[/\bUnterricht beendet\b/g,'Lesson ended'],[/\bVollbild verlassen\b/g,'Exit fullscreen'],[/\bVollbild\b/g,'Fullscreen'],[/\bRaum offline\b/g,'Room offline'],[/\bRaum\b/g,'Room'],[/\bSchüler\b/g,'Students'],[/\bMaterial\b/g,'Materials'],[/\bSeite\b/g,'Page'],[/\bSeiten\b/g,'pages'],[/\bLöschen\b/g,'Delete'],[/\bSchließen\b/g,'Close'],[/\bPause\b/g,'Break'],[/\bUnterricht\b/g,'Lesson']];
function tr(s){if(lang!=='en'||!s)return s;if(D[s]!=null)return D[s];let o=String(s),core=o.trim();if(D[core]!=null)return o.replace(core,D[core]);for(const[r,v]of reps)o=o.replace(r,v);return o}
function skip(el){return !el||['SCRIPT','STYLE','TEXTAREA'].includes(el.tagName)||el.closest?.('canvas,svg,[contenteditable="true"]')}
function apply(root=document.body){
 document.documentElement.lang=lang;if(!root)return;
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue?.trim()&&!skip(n.parentElement)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}),nodes=[];while(w.nextNode())nodes.push(w.currentNode);
 for(const n of nodes){if(n.__studentLangOriginal==null)n.__studentLangOriginal=n.nodeValue;n.nodeValue=lang==='en'?tr(n.__studentLangOriginal):n.__studentLangOriginal}
 for(const el of root.querySelectorAll?.('[placeholder],[title],[aria-label]')||[]){for(const a of['placeholder','title','aria-label'])if(el.hasAttribute(a)){const k='studentLang'+a.replace('-','');if(el.dataset[k]==null)el.dataset[k]=el.getAttribute(a);el.setAttribute(a,lang==='en'?tr(el.dataset[k]):el.dataset[k])}}
 if(document.title){if(document.documentElement.dataset.originalTitle==null)document.documentElement.dataset.originalTitle=document.title;document.title=lang==='en'?tr(document.documentElement.dataset.originalTitle):document.documentElement.dataset.originalTitle}
}
function setLang(v){v=v==='en'?'en':'de';if(v===lang)return;lang=v;apply()}
async function rpc(name,body){const r=await fetch(SB+name,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify(body||{})});if(!r.ok)throw Error(String(r.status));return r.json()}
function room(){return(new URLSearchParams(location.search).get('room')||localStorage.getItem('kathleenLastRoom')||'').toUpperCase()}
function token(){return sessionStorage.getItem('kathleenStudentToken')||''}
async function poll(){if(busy)return;const t=token(),r=room();if(!t&&!r)return;busy=true;try{const s=t?await rpc('classroom_student_language',{p_student_token:t}):await rpc('classroom_language',{p_room_code:r});if(s?.ok)setLang(s.language)}catch(e){/* SQL patch may not be deployed yet */}finally{busy=false}}
const obs=new MutationObserver(ms=>{if(lang!=='en')return;for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)apply(n);else if(n.nodeType===3&&n.parentElement&&!skip(n.parentElement)){if(n.__studentLangOriginal==null)n.__studentLangOriginal=n.nodeValue;n.nodeValue=tr(n.__studentLangOriginal)}});
function init(){apply();obs.observe(document.body,{childList:true,subtree:true});poll();timer=setInterval(()=>{if(document.visibilityState==='visible')poll()},2200);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});window.KathleenStudentI18n={get language(){return lang},apply,poll}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();