(()=>{
'use strict';
const LANG_KEY='kathleenUiLanguageV1',OVERRIDE_KEY='kathleenUiLanguageOverrideV1',SUBJECT_KEY='kathleenActiveSubjectV1',SNAP='kathleenTimetableSnapshotV1';
const TEXT={
'Kathleens magische Tool und Aufgaben Kiste':"Kathleen's Magic Tool & Task Box",'Kathleens magische Kiste':"Kathleen's Magic Box",'Kathleens Kiste':"Kathleen's Box",
'Was möchtest du als Nächstes machen?':'What would you like to do next?','Aktive Klasse':'Active class','Klasse wählen …':'Choose class …','keine Klasse':'no class','Klasse':'Class','Klassen':'Classes','Klassenlisten':'Class lists','Klassenliste':'Class list','Schüler':'Students','Schüleransicht':'Student view','Schüleransicht testen':'Test student view','Schülerlink':'Student link','Schülerlink kopieren':'Copy student link',
'Stundenplan':'Timetable','Stunde hinzufügen':'Add lesson','Stunde bearbeiten':'Edit lesson','Keine Stunde':'No lesson','Keine Stunde eingetragen.':'No lesson entered.','Keine weitere Stunde eingetragen':'No further lesson scheduled','Unterrichtsfrei / nicht eingetragen':'No lesson / not scheduled','Keine weitere Stunde eingetragen.':'No further lesson scheduled.','Unterrichtsstunde':'lesson','Unterrichtsstunden':'lessons',
'Gerade jetzt':'Right now','Nächste Stunde':'Next lesson','Heute':'Today','Morgen':'Tomorrow','Montag':'Monday','Dienstag':'Tuesday','Mittwoch':'Wednesday','Donnerstag':'Thursday','Freitag':'Friday','Zurück zu heute':'Back to today','Vorherige Woche':'Previous week','Nächste Woche':'Next week',
'Whiteboard öffnen':'Open whiteboard','Sitzplan':'Seating plan','Zufall':'Random','Zufallsgenerator':'Random student','Teams':'Teams','Teamgenerator':'Team generator','Hausaufgaben':'Homework','Noten':'Grades','Notenzentrale':'Grade center','Beobachtungen':'Observations','Beobachtungszeiträume':'Observation periods','Klasse öffnen':'Open class',
'Tools':'Tools','Widget':'Widget','Widgets':'Widgets','Material':'Materials','Bild':'Image','Text':'Text','Textkarte':'Text card','Notiz':'Note','Stift':'Pen','Marker':'Highlighter','Radierer':'Eraser','Auswahl':'Select','Hand':'Pan','Lasso':'Lasso','Löschen':'Delete','Speichern':'Save','Gespeichert':'Saved','Neu geladen':'Reloaded','Schließen':'Close','Abbrechen':'Cancel','Fertig':'Done','Bearbeiten':'Edit','Öffnen':'Open','Starten':'Start','Beenden':'End','Weiter':'Continue','Zurück':'Back','Drucken':'Print','Vollbild':'Fullscreen','Sperren':'Lock','Entsperren':'Unlock','Offen':'Open','Geschlossen':'Closed',
'Klassenraum starten':'Start classroom','Classroom starten':'Start classroom','Klassenraum ist bereit':'Classroom is ready','Raumcode':'Room code','Mit iPad oder Handy scannen':'Scan with iPad or phone','Raumcode ist im Schülerlink bereits eingetragen. Danach nur noch den eigenen Namen auswählen.':'The room code is already included in the student link. Students only need to select their own name.','Wähle die Klasse. Die Schüler scannen danach nur noch den QR-Code und wählen ihren Namen aus.':'Choose the class. Students then scan the QR code and select their name.',
'Mein Board':'My board','Board-Bibliothek öffnen':'Open board library','Neues Board':'New board','bereit':'ready','Ampel':'Traffic light','Timer':'Timer','Zufälliger Schüler':'Random student','Gruppen':'Groups','Gruppenarbeit':'Group work','Klassenarbeit':'Test','Englisch normal':'English lesson','Geschichte':'History','Unterrichts-Presets':'Lesson presets',
'Tafel':'Board','Lehrertisch':'Teacher desk','Layout':'Layout','Optionen':'Options','Notizen':'Notes','Freies Verschieben':'Free move','Tische fixiert':'Desks locked','Tisch':'Desk','Tische':'Desks','Einzeltisch':'Single desk','Doppeltisch':'Double desk','Vierertisch':'Four-person table','Reihen':'Rows','U-Form':'U-shape','Normal':'Standard','Prüfung':'Exam','Raum einpassen':'Fit room','Gang / Zone':'Aisle / zone','Nach Tags anordnen':'Arrange by tags','Gruppe':'Group','Gruppenlabels löschen':'Remove group labels','Zonen löschen':'Remove zones',
'To-do':'To-do','Aufgabe':'Task','Aufgaben':'Tasks','offen':'open','Überfällig':'Overdue','Alle':'All','Fälligkeit':'Due date','Priorität':'Priority','Priorität: normal':'Priority: normal','Priorität: hoch':'Priority: high','Priorität: niedrig':'Priority: low','Einmalig':'Once','Täglich':'Daily','Werktags':'Weekdays','Wöchentlich':'Weekly','Push zum Termin':'Push at due time','ohne Termin':'no due date',
'Fach':'Subject','Zeitraum':'Period','Bezeichnung':'Title','Von':'From','Bis':'To','Zeitraum anlegen':'Create period','Zeitraum schließen':'Close period','Zeitraum wieder öffnen':'Reopen period','nur heute':'today only','Schüler suchen …':'Search students …','Kurze Notiz hinzufügen …':'Add a short note …','Notiz hinzufügen':'Add note',
'Live Poll':'Live Poll','Frage':'Question','Frage starten':'Start question','Abstimmung schließen':'Close voting','Ergebnis zeigen':'Show results','Ergebnis verbergen':'Hide results','Noch keine Antworten.':'No answers yet.','Noch keine Antwort':'No answer yet','Antworten':'Answers','Einfachauswahl':'Single choice','Mehrfachauswahl':'Multiple choice','Freitext':'Open response',
'Montag':'Monday','Dienstag':'Tuesday','Mittwoch':'Wednesday','Donnerstag':'Thursday','Freitag':'Friday','Deutsch':'German','Englisch':'English'
};
const ATTR={
'Werkzeuge':'Tools','Klasse wählen':'Choose class','Schüler suchen …':'Search students …','Löschen':'Delete','Bearbeiten':'Edit','Schnellaktionen':'Quick actions','Board-Bibliothek öffnen':'Open board library','Widgets':'Widgets','Material':'Materials','Bild':'Image','Text':'Text','Notiz':'Note','Stift':'Pen','Marker':'Highlighter','Radierer':'Eraser','Auswahl':'Select'
};
const norm=s=>String(s||'').trim().toLocaleLowerCase('de-DE');
function timetable(){try{const x=JSON.parse(localStorage.getItem(SNAP)||'null');return Array.isArray(x?.entries)?x.entries:[]}catch(e){return[]}}
function globalClass(){try{return JSON.parse(localStorage.getItem('kathleenGlobalClassV1')||'null')}catch(e){return null}}
function activeLesson(now=new Date()){
 const day=now.getDay()===0?7:now.getDay(),m=now.getHours()*60+now.getMinutes(),mins=t=>{const[a,b]=String(t||'0:0').split(':').map(Number);return a*60+b};
 return timetable().filter(e=>Number(e.day)===day).find(e=>mins(e.start)<=m&&mins(e.end)>m)||null
}
function subjectForClass(){
 const g=globalClass(),rows=timetable();if(!g)return'';
 const hits=rows.filter(e=>(g.id&&String(e.classId||'')===String(g.id))||(g.name&&norm(e.className)===norm(g.name)));
 const live=activeLesson();if(live&&hits.some(e=>String(e.id)===String(live.id)))return live.subject||'';
 const subjects=[...new Set(hits.map(e=>String(e.subject||'').trim()).filter(Boolean))];return subjects.length===1?subjects[0]:''
}
function languageForSubject(subject){return norm(subject).startsWith('engl')?'en':norm(subject).startsWith('gesch')?'de':''}
function resolve(){
 const override=localStorage.getItem(OVERRIDE_KEY);if(override==='de'||override==='en')return override;
 const live=activeLesson(),liveLang=languageForSubject(live?.subject);if(liveLang){setSubject(live.subject,false);return liveLang}
 const saved=localStorage.getItem(SUBJECT_KEY)||'',savedLang=languageForSubject(saved);if(savedLang)return savedLang;
 const byClass=subjectForClass(),classLang=languageForSubject(byClass);if(classLang){setSubject(byClass,false);return classLang}
 return localStorage.getItem(LANG_KEY)||'de'
}
function setSubject(subject,announce=true){subject=String(subject||'').trim();if(!subject)return;localStorage.setItem(SUBJECT_KEY,subject);const l=languageForSubject(subject);if(l&&!localStorage.getItem(OVERRIDE_KEY)){localStorage.setItem(LANG_KEY,l);if(announce)window.dispatchEvent(new CustomEvent('kathleen:language',{detail:{lang:l,subject}}))}}
function setLanguage(lang,manual=false){lang=lang==='en'?'en':'de';localStorage.setItem(LANG_KEY,lang);if(manual)localStorage.setItem(OVERRIDE_KEY,lang);else localStorage.removeItem(OVERRIDE_KEY);apply();window.dispatchEvent(new CustomEvent('kathleen:language',{detail:{lang,manual}}));return lang}
function auto(){localStorage.removeItem(OVERRIDE_KEY);const lang=resolve();localStorage.setItem(LANG_KEY,lang);apply();return lang}
function translateString(s,lang=resolve()){
 if(lang!=='en'||!s)return s;
 let out=String(s);
 if(TEXT[out]!=null)return TEXT[out];
 const lead=out.match(/^\s*/)?.[0]||'',trail=out.match(/\s*$/)?.[0]||'',core=out.trim();
 if(TEXT[core]!=null)return lead+TEXT[core]+trail;
 const reps=[
  [/\bKlassenraum starten\b/g,'Start classroom'],[/\bClassroom starten\b/g,'Start classroom'],[/\bSitzplan\b/g,'Seating plan'],[/\bZufallsgenerator\b/g,'Random student'],[/\bHausaufgaben\b/g,'Homework'],[/\bNoten\b/g,'Grades'],[/\bSchüler\b/g,'Students'],[/\bKlasse\b/g,'Class'],[/\bStundenplan\b/g,'Timetable'],[/\bGerade jetzt\b/g,'Right now'],[/\bNächste Stunde\b/g,'Next lesson'],[/\bHeute\b/g,'Today'],[/\bMorgen\b/g,'Tomorrow'],[/\bSpeichern\b/g,'Save'],[/\bLöschen\b/g,'Delete'],[/\bAbbrechen\b/g,'Cancel'],[/\bSchließen\b/g,'Close'],[/\bÖffnen\b/g,'Open'],[/\bEnglisch\b/g,'English'],[/\bGeschichte\b/g,'History'],[/\boffen\b/g,'open']
 ];for(const[r,v]of reps)out=out.replace(r,v);return out
}
function shouldSkip(el){return !el||el.nodeType!==1||['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(el.tagName)||el.closest?.('[contenteditable="true"],canvas,svg')}
function translateNode(root=document.body,lang=resolve()){
 if(lang!=='en'||!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;if(!p||shouldSkip(p)||!n.nodeValue?.trim())return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT}});
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 for(const n of nodes){if(n.__kathleenOriginal==null)n.__kathleenOriginal=n.nodeValue;const v=translateString(n.__kathleenOriginal,'en');if(n.nodeValue!==v)n.nodeValue=v}
 const els=root.querySelectorAll?.('[placeholder],[title],[aria-label]')||[];for(const el of els){for(const a of['placeholder','title','aria-label'])if(el.hasAttribute(a)){const k='kathleenOriginal'+a.replace('-','');if(el.dataset[k]==null)el.dataset[k]=el.getAttribute(a);const raw=el.dataset[k],v=ATTR[raw]||translateString(raw,'en');if(v)el.setAttribute(a,v)}}
}
function restoreNode(root=document.body){
 if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes)if(n.__kathleenOriginal!=null){n.nodeValue=n.__kathleenOriginal;delete n.__kathleenOriginal}
 const els=root.querySelectorAll?.('[placeholder],[title],[aria-label]')||[];for(const el of els){for(const a of['placeholder','title','aria-label']){const k='kathleenOriginal'+a.replace('-','');if(el.dataset[k]!=null){el.setAttribute(a,el.dataset[k]);delete el.dataset[k]}}}
}
let observer=null,queued=false;
function observe(){if(observer||!document.body)return;observer=new MutationObserver(ms=>{if(resolve()!=='en')return;if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;for(const m of ms){for(const n of m.addedNodes)if(n.nodeType===1)translateNode(n);else if(n.nodeType===3&&n.parentElement&&!shouldSkip(n.parentElement)){if(n.__kathleenOriginal==null)n.__kathleenOriginal=n.nodeValue;n.nodeValue=translateString(n.__kathleenOriginal,'en')}}})});observer.observe(document.body,{subtree:true,childList:true})}
function ensureSwitcher(){
 if(document.getElementById('kathleenLangSwitch'))return;
 const s=document.createElement('style');s.textContent='.kathleen-lang-switch{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:24000;display:flex;gap:3px;padding:4px;border:1px solid #e8dbe7;border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 10px 30px rgba(80,57,82,.16);backdrop-filter:blur(10px)}.kathleen-lang-switch button{border:0;border-radius:999px;background:transparent;color:#806b82;padding:7px 9px;font:900 9px/1 Inter,Arial,sans-serif;min-height:32px}.kathleen-lang-switch button.active{background:#725778;color:#fff}.kathleen-lang-switch .auto{padding-inline:8px}@media(max-width:600px){.kathleen-lang-switch{bottom:max(9px,env(safe-area-inset-bottom));right:max(9px,env(safe-area-inset-right))}.kathleen-lang-switch button{min-height:36px}}';document.head.appendChild(s);
 const d=document.createElement('div');d.id='kathleenLangSwitch';d.className='kathleen-lang-switch';d.innerHTML='<button data-lang="de">🇩🇪 DE</button><button data-lang="en">🇬🇧 EN</button><button class="auto" data-lang="auto">A</button>';document.body.appendChild(d);d.querySelector('[data-lang="de"]').onclick=()=>setLanguage('de',true);d.querySelector('[data-lang="en"]').onclick=()=>setLanguage('en',true);d.querySelector('[data-lang="auto"]').onclick=()=>auto()
}
function updateSwitcher(){const d=document.getElementById('kathleenLangSwitch');if(!d)return,lang=resolve(),ov=localStorage.getItem(OVERRIDE_KEY);d.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.lang===(ov?lang:'auto')));d.querySelector('.auto').title=lang==='en'?'Automatic · English':'Automatisch · Deutsch'}
function apply(){
 const lang=resolve();localStorage.setItem(LANG_KEY,lang);document.documentElement.lang=lang;if(document.body){if(lang==='en')translateNode(document.body,lang);else restoreNode(document.body);ensureSwitcher();updateSwitcher();observe()}return lang
}
function init(){apply();setInterval(()=>{const l=resolve();if(l!==localStorage.getItem(LANG_KEY)){localStorage.setItem(LANG_KEY,l);apply()}},30000);window.addEventListener('storage',e=>{if([LANG_KEY,OVERRIDE_KEY,SUBJECT_KEY,SNAP,'kathleenGlobalClassV1'].includes(e.key))apply()});window.addEventListener('kathleen:globalclass',()=>apply())}
window.KathleenI18n={resolve,apply,setLanguage,setSubject,auto,t:translateString,activeLesson,subjectForClass};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();