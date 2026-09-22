(()=>{
'use strict';
const LEGACY_KEY='kathleenClassListsV1';
const VAULT_KEY='kathleenClassListsVaultV2';
const KDF_ITERATIONS=250000;
const AUTO_LOCK_MS=60*60*1000;
const TEACHER_SESSION_KEY='kathleenTeacherUnlockV36',TEACHER_SESSION_MS=60*60*1000;
const SUPABASE_URL='https://fzqxnjhuvgpgovcovosl.supabase.co';
const SUPABASE_KEY='sb_publishable_GIyyWoyaQXipaA4S9OuTyQ_cZn7LUgV';
const CLOUD_VAULT_ID='schoolyear-2026-27';
const CLASS_META_KEY='kathleenClassMetaV1';
const GLOBAL_CLASS_KEY='kathleenGlobalClassV1';
const CLASSROOM_STATE_KEY='kathleenClassroomSharedV1';
const enc=new TextEncoder(),dec=new TextDecoder(),AAD=enc.encode('KathleenClassListsVaultV2');
let key=null,cache=[],guardPromise=null,guardResolve=null,lockTimer=null,activityBound=false;
function teacherSession(){try{const x=JSON.parse(sessionStorage.getItem(TEACHER_SESSION_KEY)||'null');return x&&Date.now()<Number(x.expiresAt||0)?x:null}catch(e){return null}}
function rememberTeacherPin(pin){try{sessionStorage.setItem(TEACHER_SESSION_KEY,JSON.stringify({pin:String(pin),expiresAt:Date.now()+TEACHER_SESSION_MS}))}catch(e){}}
function clearTeacherSession(){try{sessionStorage.removeItem(TEACHER_SESSION_KEY)}catch(e){}}
function refreshTeacherSession(){const x=teacherSession();if(x)rememberTeacherPin(x.pin)}

function uid(){return 'class-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
function cleanStudents(v){
  const a=Array.isArray(v)?v:String(v||'').split(/[\n,;]+/),seen=new Set(),out=[];
  for(const raw of a){const n=String(raw).trim().replace(/\s+/g,' ');if(!n)continue;const k=n.toLocaleLowerCase('de');if(seen.has(k))continue;seen.add(k);out.push(n)}
  return out
}
function sanitizeLists(v){
  if(!Array.isArray(v))return[];
  return v.map(x=>({id:String(x?.id||uid()),name:String(x?.name||'').trim(),students:cleanStudents(x?.students||[]),updatedAt:x?.updatedAt||new Date().toISOString()}))
    .filter(x=>x.name)
    .sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true}))
}
function bytesToB64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function b64ToBytes(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function randomBytes(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return a}
function vaultIterations(v){const n=Number(v?.iterations)||KDF_ITERATIONS;return Math.max(100000,Math.min(1000000,n))}
async function deriveKey(pin,salt,iterations=KDF_ITERATIONS){
  const material=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])
}
async function cloudRpc(name,body){const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body||{})});if(!r.ok)throw new Error(name+' '+r.status+' '+await r.text());return r.json()}
async function cloudPull(passphrase){if(!navigator.onLine||!passphrase)return false;try{const d=await cloudRpc('class_vault_get',{p_passphrase:passphrase,p_vault_id:CLOUD_VAULT_ID});if(!d?.exists||!validateVault(d.vault))return false;localStorage.setItem(VAULT_KEY,JSON.stringify(d.vault));window.dispatchEvent(new CustomEvent('kathleen:classlists-cloud',{detail:{action:'pull',updatedAt:d.updated_at}}));return true}catch(e){console.warn('Klassenlisten-Cloud konnte nicht geladen werden.',e);return false}}
async function cloudPush(passphrase){if(!navigator.onLine||!passphrase)return false;const raw=localStorage.getItem(VAULT_KEY);if(!raw)return false;try{const vault=JSON.parse(raw);if(!validateVault(vault))return false;await cloudRpc('class_vault_save',{p_passphrase:passphrase,p_vault_id:CLOUD_VAULT_ID,p_vault:vault});window.dispatchEvent(new CustomEvent('kathleen:classlists-cloud',{detail:{action:'push',updatedAt:vault.updatedAt}}));return true}catch(e){console.warn('Klassenlisten-Cloud konnte nicht gespeichert werden.',e);return false}}
function hasVault(){return !!localStorage.getItem(VAULT_KEY)}
function hasLegacy(){return !!localStorage.getItem(LEGACY_KEY)}
function isUnlocked(){return !!key}
function publishClassMeta(){try{localStorage.setItem(CLASS_META_KEY,JSON.stringify(cache.map(c=>({id:c.id,name:c.name,updatedAt:c.updatedAt||''}))))}catch(e){}}
function classMeta(){try{const x=JSON.parse(localStorage.getItem(CLASS_META_KEY)||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
function getGlobalClass(){try{const x=JSON.parse(localStorage.getItem(GLOBAL_CLASS_KEY)||'null');if(x?.id){const id=String(x.id),name=String(x.name||'');if(key&&name&&!cache.some(c=>c.id===id)){const hit=cache.find(c=>c.name.toLocaleLowerCase('de-DE')===name.toLocaleLowerCase('de-DE'));if(hit)return{id:hit.id,name:hit.name}}return{id,name}}}catch(e){}const id=localStorage.getItem('kathleenGlobalClassId')||'',name=localStorage.getItem('kathleenGlobalClassName')||'';if(key&&name&&!cache.some(c=>c.id===id)){const hit=cache.find(c=>c.name.toLocaleLowerCase('de-DE')===name.toLocaleLowerCase('de-DE'));if(hit)return{id:hit.id,name:hit.name}}return id?{id,name}:null}
function setGlobalClass(id,name=''){id=String(id||'');name=String(name||'');if(!id){localStorage.removeItem(GLOBAL_CLASS_KEY);localStorage.removeItem('kathleenGlobalClassId');localStorage.removeItem('kathleenGlobalClassName');window.dispatchEvent(new CustomEvent('kathleen:globalclass',{detail:null}));return null}const hit=cache.find(c=>c.id===id),value={id,name:hit?.name||name||classMeta().find(c=>c.id===id)?.name||'',updatedAt:new Date().toISOString()};localStorage.setItem(GLOBAL_CLASS_KEY,JSON.stringify(value));localStorage.setItem('kathleenGlobalClassId',value.id);localStorage.setItem('kathleenGlobalClassName',value.name);window.dispatchEvent(new CustomEvent('kathleen:globalclass',{detail:value}));return value}

function getClassroomSummary(){
  try{const x=JSON.parse(localStorage.getItem(CLASSROOM_STATE_KEY)||'null');return x?.session_id?x:null}catch(e){return null}
}
function getClassroomState(){
  let runtime=null;
  try{runtime=JSON.parse(sessionStorage.getItem('kathleenClassroom')||'null')}catch(e){}
  if(!runtime?.session_id||!runtime?.teacher_token)return null;
  const summary=getClassroomSummary()||{};
  return{...summary,...runtime}
}
function setClassroomState(room,meta={}){
  if(!room?.session_id||!room?.teacher_token)return null;
  const global=getGlobalClass(),value={...room,...meta,classId:meta.classId||global?.id||room.classId||'',className:meta.className||global?.name||room.className||'',sessionState:meta.sessionState||room.sessionState||'open',connectedCount:Number(meta.connectedCount??room.connectedCount??0),rosterCount:Number(meta.rosterCount??room.rosterCount??0),updatedAt:new Date().toISOString()};
  sessionStorage.setItem('kathleenClassroom',JSON.stringify(value));
  const {teacher_token,...summary}=value;
  localStorage.setItem(CLASSROOM_STATE_KEY,JSON.stringify(summary));
  window.dispatchEvent(new CustomEvent('kathleen:classroom',{detail:summary}));
  return value
}
function updateClassroomState(patch={}){
  const cur=getClassroomState();if(!cur)return null;return setClassroomState(cur,{...cur,...patch})
}
function clearClassroomState(){
  localStorage.removeItem(CLASSROOM_STATE_KEY);sessionStorage.removeItem('kathleenClassroom');
  window.dispatchEvent(new CustomEvent('kathleen:classroom',{detail:null}));
}
function ensureTeacherUx(){
  if(typeof document==='undefined'||document.getElementById('kclTeacherUxStyle'))return;
  const path=location.pathname||'',isBoard=/\/classroom-board\/(?:index\.html)?$/.test(path),isStudent=/\/(?:student|present)\.html$/.test(path);
  if(isStudent)return;
  const standalone=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
  if(standalone)document.documentElement.classList.add('kcl-pwa');
  const s=document.createElement('style');s.id='kclTeacherUxStyle';s.textContent=`
  .kcl-context-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;border:1px solid #eadde9;background:rgba(255,255,255,.94);color:#654d69;border-radius:12px;padding:8px 11px;font:900 10px/1 Inter,ui-rounded,Arial,sans-serif;white-space:nowrap;box-shadow:0 7px 20px rgba(94,63,99,.08);cursor:pointer}
  .kcl-context-chip .kcl-live{width:7px;height:7px;border-radius:50%;background:#66b08f;box-shadow:0 0 0 4px rgba(102,176,143,.12)}
  .kcl-context-overlay{position:fixed;inset:0;z-index:25000;display:grid;place-items:center;padding:18px;background:rgba(58,41,60,.34);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .kcl-context-card{width:min(430px,94vw);background:#fff;border:1px solid #eadde9;border-radius:22px;padding:17px;box-shadow:0 28px 90px rgba(70,46,72,.25);color:#503d51}
  .kcl-context-card h3{margin:0 0 4px;font:950 18px/1.15 Inter,ui-rounded,Arial}.kcl-context-card p{margin:0 0 13px;color:#8d788f;font:500 10px/1.45 Inter,Arial}
  .kcl-context-card label{display:block;margin:8px 0 5px;color:#8d788f;font:950 9px/1 Inter,Arial;text-transform:uppercase;letter-spacing:.08em}
  .kcl-context-card select{width:100%;min-height:46px;border:1px solid #eadde9;border-radius:12px;background:#fffafd;color:#503d51;padding:10px;font-size:16px}
  .kcl-context-livebox{margin:11px 0;padding:10px 11px;border:1px solid #d7ebe3;background:#f3fbf8;border-radius:12px;font:800 10px/1.45 Inter,Arial;color:#527b69}
  .kcl-context-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.kcl-context-actions button,.kcl-context-actions a{min-height:42px;border:1px solid #eadde9;border-radius:11px;background:#fff;color:#503d51;padding:9px 10px;text-decoration:none;text-align:center;font:900 10px/1.2 Inter,Arial}.kcl-context-actions .primary{border:0;color:#fff;background:linear-gradient(135deg,#d790b5,#aa8cde)}
  @media(max-width:820px){html.kcl-pwa,html.kcl-pwa body{max-width:100%;overflow-x:hidden}html.kcl-pwa .shell{padding-top:calc(12px + env(safe-area-inset-top));padding-bottom:calc(24px + env(safe-area-inset-bottom))}html.kcl-pwa .top{gap:10px;flex-wrap:wrap}html.kcl-pwa .top .actions,html.kcl-pwa .top .topActions,html.kcl-pwa .top-actions{max-width:100%}html.kcl-pwa button,html.kcl-pwa .btn,html.kcl-pwa select{min-height:44px}html.kcl-pwa input:not([type=checkbox]):not([type=radio]):not([type=color]),html.kcl-pwa textarea,html.kcl-pwa select{font-size:16px!important}html.kcl-pwa .modal,html.kcl-pwa .kcl-context-overlay{align-items:end;padding:0}html.kcl-pwa .modalCard,html.kcl-pwa .modal-card,html.kcl-pwa .kcl-context-card{width:100%;max-width:none;max-height:88dvh;overflow:auto;border-radius:22px 22px 0 0;padding-bottom:calc(18px + env(safe-area-inset-bottom))}.kcl-context-actions{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
  if(isBoard)return;
  const chip=document.createElement('button');chip.type='button';chip.id='kclContextChip';chip.className='kcl-context-chip';chip.onclick=openGlobalClassChooser;
  const host=document.querySelector('.top .actions,.top .topActions,.top-actions,.top,.hero');if(host)host.appendChild(chip);else{chip.style.cssText='position:fixed;right:10px;top:calc(10px + env(safe-area-inset-top));z-index:18000';document.body.appendChild(chip)}
  renderContextChip()
}
function renderContextChip(){
  const chip=document.getElementById('kclContextChip');if(!chip)return;const g=getGlobalClass(),room=getClassroomState()||getClassroomSummary(),live=room?.sessionState!=='closed'&&room?.session_id;
  chip.innerHTML=(live?'<span class="kcl-live"></span>':'')+'👥 '+(g?.name||room?.className||'Klasse')+(live?' · '+Number(room.connectedCount||0)+' live':'')
}
async function openGlobalClassChooser(){
  if(document.getElementById('kclContextOverlay'))return;
  try{if(!key)await requireUnlock()}catch(e){return}
  const lists=load(),g=getGlobalClass(),room=getClassroomState()||getClassroomSummary(),o=document.createElement('div');o.id='kclContextOverlay';o.className='kcl-context-overlay';
  o.innerHTML='<div class="kcl-context-card"><h3>Aktive Klasse</h3><p>Diese Auswahl wird von den Lehrer-Tools gemeinsam verwendet.</p><label>Klasse</label><select id="kclContextSelect">'+lists.map(c=>'<option value="'+String(c.id).replace(/"/g,'&quot;')+'"'+(g?.id===c.id?' selected':'')+'>'+String(c.name).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</option>').join('')+'</select>'+(room?'<div class="kcl-context-livebox">● Classroom '+String(room.className||g?.name||'')+' aktiv · Raum '+String(room.room_code||'')+' · '+Number(room.connectedCount||0)+' / '+Number(room.rosterCount||0)+' verbunden</div>':'')+'<div class="kcl-context-actions"><button class="primary" id="kclContextApply">Übernehmen</button><button id="kclContextClose">Schließen</button><a href="'+new URL('../seating-plan/',location.href)+'">🪑 Sitzplan</a><a href="'+new URL('../classroom-board/',location.href)+'">✨ Whiteboard</a></div></div>';
  document.body.appendChild(o);o.querySelector('#kclContextClose').onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove()};o.querySelector('#kclContextApply').onclick=()=>{const id=o.querySelector('#kclContextSelect').value,c=lists.find(x=>x.id===id);if(c)setGlobalClass(c.id,c.name);o.remove();renderContextChip()}
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureTeacherUx,{once:true});else setTimeout(ensureTeacherUx,0);window.addEventListener('kathleen:globalclass',renderContextChip);window.addEventListener('kathleen:classroom',renderContextChip);window.addEventListener('kathleen:classlists-unlocked',renderContextChip)}
function load(){return key?cache.map(c=>({...c,students:[...c.students]})):[]}
function get(id){return key?(cache.find(x=>x.id===id)||null):null}
function assertUnlocked(){if(!key)throw new Error('Klassenlisten sind gesperrt.')}
function readLegacy(){try{return sanitizeLists(JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]'))}catch(e){return[]}}
async function persist(lists=cache){
  assertUnlocked();cache=sanitizeLists(lists);publishClassMeta();
  let vault;try{vault=JSON.parse(localStorage.getItem(VAULT_KEY)||'null')}catch(e){vault=null}
  if(!vault?.salt)throw new Error('Verschlüsselung ist nicht eingerichtet.');
  const iv=randomBytes(12),payload=enc.encode(JSON.stringify({version:2,classes:cache}));
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD},key,payload));
  const next={version:2,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:KDF_ITERATIONS,salt:vault.salt,iv:bytesToB64(iv),data:bytesToB64(cipher),updatedAt:new Date().toISOString()};
  localStorage.setItem(VAULT_KEY,JSON.stringify(next));localStorage.removeItem(LEGACY_KEY);touch();
  window.dispatchEvent(new CustomEvent('kathleen:classlists'));const admin=sessionStorage.getItem('kathleenAdminPass')||'';if(admin)await cloudPush(admin);return true
}
async function setup(pin){
  pin=String(pin||'');if(pin.length<8)throw new Error('Die Lehrer-PIN muss mindestens 8 Zeichen haben.');
  if(!crypto?.subtle)throw new Error('Dieser Browser unterstützt die benötigte Verschlüsselung nicht.');
  const salt=randomBytes(16);key=await deriveKey(pin,salt);cache=readLegacy();
  localStorage.setItem(VAULT_KEY,JSON.stringify({version:2,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:KDF_ITERATIONS,salt:bytesToB64(salt),iv:'',data:'',updatedAt:new Date().toISOString()}));
  try{await persist(cache)}catch(e){localStorage.removeItem(VAULT_KEY);key=null;cache=[];throw e}
  bindActivity();rememberTeacherPin(pin);window.dispatchEvent(new CustomEvent('kathleen:classlists-unlocked'));return true
}
async function unlock(pin){
  pin=String(pin||'');if(!hasVault())return setup(pin);
  if(!crypto?.subtle)throw new Error('Dieser Browser unterstützt die benötigte Verschlüsselung nicht.');
  let vault;try{vault=JSON.parse(localStorage.getItem(VAULT_KEY)||'null')}catch(e){throw new Error('Der verschlüsselte Speicher ist beschädigt.')}
  if(!vault?.salt||!vault?.iv||!vault?.data)throw new Error('Der verschlüsselte Speicher ist unvollständig.');
  const candidate=await deriveKey(pin,b64ToBytes(vault.salt),vaultIterations(vault));
  try{
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(vault.iv),additionalData:AAD},candidate,b64ToBytes(vault.data));
    const parsed=JSON.parse(dec.decode(plain));key=candidate;cache=sanitizeLists(parsed?.classes||[]);publishClassMeta();localStorage.removeItem(LEGACY_KEY);bindActivity();
    rememberTeacherPin(pin);window.dispatchEvent(new CustomEvent('kathleen:classlists-unlocked'));return true
  }catch(e){key=null;cache=[];throw new Error('Lehrer-PIN falsch oder Backup beschädigt.')}
}
function lock(reload=false){clearTeacherSession();key=null;cache=[];clearTimeout(lockTimer);lockTimer=null;window.dispatchEvent(new CustomEvent('kathleen:classlists-locked'));if(reload)setTimeout(()=>location.reload(),20)}
function touch(){if(!key)return;refreshTeacherSession();clearTimeout(lockTimer);lockTimer=setTimeout(()=>lock(true),AUTO_LOCK_MS)}
function bindActivity(){touch();if(activityBound)return;activityBound=true;['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,touch,{passive:true}))}
async function upsert(data){
  assertUnlocked();const lists=load(),id=data.id||uid(),item={id,name:String(data.name||'').trim(),students:cleanStudents(data.students),updatedAt:new Date().toISOString()};
  if(!item.name)throw new Error('Klassenname fehlt');const i=lists.findIndex(x=>x.id===id);if(i>=0)lists[i]=item;else lists.push(item);await persist(lists);return item
}
async function remove(id){assertUnlocked();await persist(load().filter(x=>x.id!==id))}
function shuffle(input){const a=[...input];for(let i=a.length-1;i>0;i--){let j;if(window.crypto&&crypto.getRandomValues){const u=new Uint32Array(1);crypto.getRandomValues(u);j=u[0]%(i+1)}else j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function detectDelimiter(line){const counts={';':0,',':0,'\t':0};let quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(line[i+1]==='"')i++;else quoted=!quoted}else if(!quoted&&Object.prototype.hasOwnProperty.call(counts,ch))counts[ch]++}return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]}
function parseDelimited(text){
  text=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();if(!text)return[];
  const delimiter=detectDelimiter(text.split('\n')[0]),rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(ch===delimiter&&!quoted){row.push(field);field=''}else if(ch==='\n'&&!quoted){row.push(field);rows.push(row);row=[];field=''}else field+=ch}
  row.push(field);rows.push(row);return rows.filter(r=>r.some(v=>String(v).trim()))
}
function normalizeHeader(s){return String(s||'').trim().toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'_')}
async function importCsv(text,{replace=false}={}){
  assertUnlocked();const rows=parseDelimited(text);if(rows.length<2)throw new Error('Die CSV enthält keine Datenzeilen.');
  const header=rows[0].map(normalizeHeader),classAliases=['class_name','klasse','class','klassenname'],studentAliases=['student_name','schueler','schuler','student','name'];
  const ci=header.findIndex(h=>classAliases.includes(h)),si=header.findIndex(h=>studentAliases.includes(h));if(ci<0||si<0)throw new Error('Erwartete Spalten: class_name und student_name.');
  const grouped=new Map();for(const r of rows.slice(1)){const cn=String(r[ci]||'').trim(),sn=String(r[si]||'').trim();if(!cn||!sn)continue;if(!grouped.has(cn))grouped.set(cn,[]);grouped.get(cn).push(sn)}
  if(!grouped.size)throw new Error('Keine gültigen Schülerdaten gefunden.');let lists=replace?[]:load();
  for(const [name,students] of grouped){const existing=lists.find(x=>x.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'));if(existing)existing.students=cleanStudents([...existing.students,...students]),existing.updatedAt=new Date().toISOString();else lists.push({id:uid(),name,students:cleanStudents(students),updatedAt:new Date().toISOString()})}
  await persist(lists);return {classes:grouped.size,students:[...grouped.values()].reduce((n,a)=>n+a.length,0)}
}
function csvEscape(v,del=';'){const s=String(v??'');return /["\n\r;,\t]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function exportCsv(lists=load(),delimiter=';'){assertUnlocked();const rows=[['class_name','student_name']];for(const c of lists)for(const s of c.students)rows.push([c.name,s]);return '\uFEFF'+rows.map(r=>r.map(v=>csvEscape(v,delimiter)).join(delimiter)).join('\r\n')}
function templateCsv(){return '\uFEFFclass_name;student_name\r\n9a;Anna M.\r\n9a;Ben K.\r\n10b;Carla S.\r\n'}
async function importPlainJson(text,{replace=false}={}){
  assertUnlocked();const d=JSON.parse(text),incoming=Array.isArray(d)?d:Array.isArray(d.classes)?d.classes:null;if(!incoming)throw new Error('Ungültiges JSON-Format.');let lists=replace?[]:load();
  for(const raw of incoming){const name=String(raw.name||'').trim(),students=cleanStudents(raw.students);if(!name||!students.length)continue;const existing=lists.find(x=>x.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'));if(existing)existing.students=cleanStudents([...existing.students,...students]),existing.updatedAt=new Date().toISOString();else lists.push({id:uid(),name,students,updatedAt:new Date().toISOString()})}
  await persist(lists);return {classes:lists.length,students:lists.reduce((n,c)=>n+c.students.length,0)}
}
function exportSecureBackup(){
  const raw=localStorage.getItem(VAULT_KEY);if(!raw)throw new Error('Noch kein verschlüsselter Speicher vorhanden.');
  return JSON.stringify({format:'kathleen-class-vault',version:2,exportedAt:new Date().toISOString(),vault:JSON.parse(raw)},null,2)
}
function validateVault(v){return !!(v&&v.version===2&&v.cipher==='AES-256-GCM'&&typeof v.salt==='string'&&typeof v.iv==='string'&&typeof v.data==='string')}
async function importSecureBackup(text,pin){
  const d=JSON.parse(text),v=d?.format==='kathleen-class-vault'?d.vault:null;if(!validateVault(v))throw new Error('Kein gültiges verschlüsseltes Klassenlisten-Backup.');
  const candidate=await deriveKey(String(pin||''),b64ToBytes(v.salt),vaultIterations(v));let restored;
  try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(v.iv),additionalData:AAD},candidate,b64ToBytes(v.data));restored=sanitizeLists(JSON.parse(dec.decode(plain))?.classes||[])}catch(e){throw new Error('Backup-PIN falsch oder Backup beschädigt.')}
  localStorage.setItem(VAULT_KEY,JSON.stringify(v));localStorage.removeItem(LEGACY_KEY);key=candidate;cache=restored;bindActivity();window.dispatchEvent(new CustomEvent('kathleen:classlists'));return true
}
async function changePin(newPin){
  assertUnlocked();
  newPin=String(newPin||'');
  if(newPin.length<8)throw new Error('Die neue Lehrer-PIN muss mindestens 8 Zeichen haben.');

  const lists=load(),oldKey=key,oldVault=localStorage.getItem(VAULT_KEY),oldSecure=new Map(),securePlain=new Map();
  const secureNames=[];
  for(let i=0;i<localStorage.length;i++){
    const storageKey=localStorage.key(i);
    if(storageKey?.startsWith('kathleenSecure:'))secureNames.push(storageKey.slice('kathleenSecure:'.length));
  }

  // Decrypt every teacher-only secure store with the OLD key before rotating it.
  for(const name of secureNames){
    const storageKey='kathleenSecure:'+name,raw=localStorage.getItem(storageKey);
    oldSecure.set(storageKey,raw);
    if(!raw)continue;
    try{
      const box=JSON.parse(raw),aad=enc.encode('KathleenSecureStore:'+name);
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(box.iv),additionalData:aad},oldKey,b64ToBytes(box.data));
      securePlain.set(name,JSON.parse(dec.decode(plain))?.value??null);
    }catch(e){
      throw new Error('PIN-Wechsel abgebrochen: Geschützter Zusatzspeicher "'+name+'" konnte nicht gelesen werden.');
    }
  }

  const salt=randomBytes(16),newKey=await deriveKey(newPin,salt);

  // Prepare the new class vault in memory first.
  const classIv=randomBytes(12),classPayload=enc.encode(JSON.stringify({version:2,classes:lists}));
  const classCipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:classIv,additionalData:AAD},newKey,classPayload));
  const nextVault={version:2,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:KDF_ITERATIONS,salt:bytesToB64(salt),iv:bytesToB64(classIv),data:bytesToB64(classCipher),updatedAt:new Date().toISOString()};

  // Prepare re-encrypted additional stores before writing anything.
  const nextSecure=new Map();
  for(const [name,value] of securePlain){
    const iv=randomBytes(12),aad=enc.encode('KathleenSecureStore:'+name),payload=enc.encode(JSON.stringify({version:1,value}));
    const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},newKey,payload));
    nextSecure.set('kathleenSecure:'+name,JSON.stringify({version:1,iv:bytesToB64(iv),data:bytesToB64(cipher),updatedAt:new Date().toISOString()}));
  }

  try{
    localStorage.setItem(VAULT_KEY,JSON.stringify(nextVault));
    for(const [storageKey,raw] of nextSecure)localStorage.setItem(storageKey,raw);
    key=newKey;cache=sanitizeLists(lists);localStorage.removeItem(LEGACY_KEY);touch();
    window.dispatchEvent(new CustomEvent('kathleen:classlists'));
    window.dispatchEvent(new CustomEvent('kathleen:secure-store-rekeyed',{detail:{stores:nextSecure.size}}));
    const admin=sessionStorage.getItem('kathleenAdminPass')||'';
    if(admin)await cloudPush(admin);
    return true;
  }catch(e){
    key=oldKey;
    if(oldVault)localStorage.setItem(VAULT_KEY,oldVault);
    else localStorage.removeItem(VAULT_KEY);
    for(const name of secureNames){
      const storageKey='kathleenSecure:'+name,raw=oldSecure.get(storageKey);
      if(raw==null)localStorage.removeItem(storageKey);else localStorage.setItem(storageKey,raw);
    }
    throw e;
  }
}
async function secureSet(namespace,value){
  assertUnlocked();
  const name=String(namespace||'').trim();
  if(!name)throw new Error('Speichername fehlt.');
  const iv=randomBytes(12),aad=enc.encode('KathleenSecureStore:'+name),payload=enc.encode(JSON.stringify({version:1,value}));
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,payload));
  localStorage.setItem('kathleenSecure:'+name,JSON.stringify({version:1,iv:bytesToB64(iv),data:bytesToB64(cipher),updatedAt:new Date().toISOString()}));
  touch();return true
}
async function secureGet(namespace,fallback=null){
  assertUnlocked();
  const name=String(namespace||'').trim(),raw=localStorage.getItem('kathleenSecure:'+name);
  if(!raw)return fallback;
  try{
    const box=JSON.parse(raw),aad=enc.encode('KathleenSecureStore:'+name);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(box.iv),additionalData:aad},key,b64ToBytes(box.data));
    return JSON.parse(dec.decode(plain))?.value??fallback
  }catch(e){throw new Error('Geschützter Zusatzspeicher konnte nicht entschlüsselt werden.')}
}
function secureRemove(namespace){
  assertUnlocked();
  localStorage.removeItem('kathleenSecure:'+String(namespace||'').trim());
  touch();return true
}
function ensureGuardStyles(){
  if(document.getElementById('kclGuardStyle'))return;
  const s=document.createElement('style');s.id='kclGuardStyle';
  s.textContent='.kcl-guard{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:18px;background:rgba(58,41,60,.42);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}.kcl-guard-card{width:min(470px,94vw);background:#fff;border:1px solid #eadde9;border-radius:24px;padding:20px;box-shadow:0 30px 100px rgba(70,46,72,.28);color:#503d51}.kcl-lock-icon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:27px;background:linear-gradient(145deg,#ffe4f0,#ece6ff);margin-bottom:12px}.kcl-guard h2{margin:0;font:950 22px/1.1 Inter,ui-rounded,"SF Pro Rounded",Arial,sans-serif;color:#684d6b}.kcl-guard p{font:500 11px/1.55 Inter,Arial,sans-serif;color:#8d788f;margin:8px 0 13px}.kcl-guard label{display:block;font:950 9px/1 Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#8d788f;margin:10px 0 5px}.kcl-guard input{width:100%;min-height:46px;border:1px solid #eadde9;border-radius:12px;background:#fffafd;padding:11px;font:inherit;font-size:16px;color:#503d51;outline:none}.kcl-guard input:focus{border-color:#d5a7c5;box-shadow:0 0 0 4px rgba(239,181,210,.13)}.kcl-guard-actions{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:14px}.kcl-guard button{border:1px solid #eadde9;background:#fff;color:#503d51;border-radius:12px;padding:11px 13px;font-weight:900;min-height:44px;cursor:pointer}.kcl-guard .primary{border:0;color:#fff;background:linear-gradient(135deg,#d790b5,#aa8cde)}.kcl-guard-msg{min-height:16px;margin-top:9px!important;color:#a8556a!important;font-weight:800!important}.kcl-security-note{padding:9px 10px;border-radius:11px;background:#f4f9f7;color:#5b806f!important;border:1px solid #dceee7}@media(max-width:560px){.kcl-guard{align-items:end;padding:0}.kcl-guard-card{width:100%;max-width:none;border-radius:24px 24px 0 0;padding:18px 14px calc(18px + env(safe-area-inset-bottom))}.kcl-guard-actions{grid-template-columns:1fr}.kcl-guard button{width:100%}}';
  document.head.appendChild(s)
}
function closeGuard(){document.getElementById('kclGuard')?.remove();const r=guardResolve;guardPromise=null;guardResolve=null;if(r)r(true)}
async function requireUnlock(){
  if(key){touch();return true}
  const remembered=teacherSession();if(remembered?.pin){try{await unlock(remembered.pin);touch();return true}catch(e){clearTeacherSession()}}
  const admin=sessionStorage.getItem('kathleenAdminPass')||'';
  if(!hasVault()&&admin)await cloudPull(admin);
  if(hasVault()&&admin){try{await unlock(admin);return true}catch(e){}}
  if(guardPromise)return guardPromise;ensureGuardStyles();guardPromise=new Promise(resolve=>{guardResolve=resolve});
  const setupMode=!hasVault(),g=document.createElement('div');g.id='kclGuard';g.className='kcl-guard';
  g.innerHTML='<div class="kcl-guard-card"><div class="kcl-lock-icon">🔐</div><h2>'+(setupMode?'Klassenlisten schützen':'Klassenlisten entsperren')+'</h2><p>'+(setupMode?'Lege einmalig eine lokale Lehrer-PIN fest. Vorhandene unverschlüsselte Listen werden automatisch verschlüsselt und danach aus dem alten Speicher entfernt.':'Die Namen sind auf diesem Gerät AES-256-GCM-verschlüsselt. Zum Verwenden der Klassenlisten bitte entsperren.')+'</p><p class="kcl-security-note">🔒 Ende-zu-Ende verschlüsselt · Supabase speichert nur Ciphertext · automatische Sperre nach 60 Minuten Inaktivität.</p><label>Lehrer-PIN</label><input id="kclPin" type="password" autocomplete="'+(setupMode?'new-password':'current-password')+'" placeholder="Mindestens 8 Zeichen">'+(setupMode?'<label>PIN wiederholen</label><input id="kclPin2" type="password" autocomplete="new-password" placeholder="PIN wiederholen">':'')+'<div class="kcl-guard-msg" id="kclMsg"></div><div class="kcl-guard-actions"><button class="primary" id="kclUnlock">'+(setupMode?'Verschlüsselung aktivieren':'Entsperren')+'</button><button id="kclBack">← Tools</button></div>'+(setupMode?'<p>Die PIN wird nicht gespeichert und kann nicht wiederhergestellt werden. Du kannst dieselbe wie dein Kisten-Admin-Passwort verwenden.</p>':'')+'</div>';
  document.body.appendChild(g);
  const pin=g.querySelector('#kclPin'),msg=g.querySelector('#kclMsg'),submit=g.querySelector('#kclUnlock');
  const run=async()=>{msg.textContent='';submit.disabled=true;try{if(setupMode){const p2=g.querySelector('#kclPin2').value;if(pin.value!==p2)throw new Error('Die beiden PINs stimmen nicht überein.');const pulled=await cloudPull(pin.value);if(pulled)await unlock(pin.value);else await setup(pin.value)}else await unlock(pin.value);closeGuard()}catch(e){msg.textContent=e.message||'Entsperren fehlgeschlagen.';submit.disabled=false;pin.focus()}};
  submit.onclick=run;pin.addEventListener('keydown',e=>{if(e.key==='Enter')run()});g.querySelector('#kclPin2')?.addEventListener('keydown',e=>{if(e.key==='Enter')run()});g.querySelector('#kclBack').onclick=()=>{location.href=new URL('../../#tools',location.href).toString()};setTimeout(()=>pin.focus(),60);
  return guardPromise
}
window.KathleenClassLists={load,persist,upsert,remove,get,cleanStudents,shuffle,parseDelimited,importCsv,exportCsv,templateCsv,importPlainJson,exportSecureBackup,importSecureBackup,changePin,setup,unlock,lock,requireUnlock,isUnlocked,hasVault,hasLegacy,autoLockMinutes:AUTO_LOCK_MS/60000,secureSet,secureGet,secureRemove,cloudPull,cloudPush,classMeta,getGlobalClass,setGlobalClass,getClassroomSummary,getClassroomState,setClassroomState,updateClassroomState,clearClassroomState,openGlobalClassChooser,renderContextChip,cloudVaultId:CLOUD_VAULT_ID,key:VAULT_KEY,legacyKey:LEGACY_KEY};
})();