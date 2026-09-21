(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const room=$('#room'),viewport=$('#roomViewport'),wrap=viewport?.querySelector('.roomWrap');
if(!room||!viewport||!wrap)return;
const META_STORE='seating-plan-v27-meta-v1',TAG_STORE='seating-plan-tags-v1',CUSTOM_TAG_STORE='seating-plan-custom-tags-v1';
let zoom=Number(localStorage.getItem('kathleenSeatZoomV27')||1),multi=new Set(),groupDrag=null,metaDb={},tagDb={},customTags=[],saveTimer=null,zoneDrag=null,zoneResize=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const classId=()=>$('#classSelect')?.value||window.KathleenClassLists?.getGlobalClass?.()?.id||'default';
const currentClass=()=>window.KathleenClassLists?.get(classId())||null;
const toast=t=>{const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1700)};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function classMeta(){const id=classId();metaDb[id]=metaDb[id]||{zones:[],groups:{}};return metaDb[id]}
async function loadStores(){
 try{if(window.KathleenClassLists?.isUnlocked?.()){metaDb=await KathleenClassLists.secureGet(META_STORE,{})||{};tagDb=await KathleenClassLists.secureGet(TAG_STORE,{})||{};customTags=await KathleenClassLists.secureGet(CUSTOM_TAG_STORE,[])||[]}}catch(e){console.warn('Sitzplan V27 Speicher',e)}
}
function queueMetaSave(){clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{try{if(KathleenClassLists?.isUnlocked?.())await KathleenClassLists.secureSet(META_STORE,metaDb)}catch(e){console.warn(e)}},250)}
function applyZoom(next){zoom=clamp(Number(next)||1,.45,1.35);localStorage.setItem('kathleenSeatZoomV27',String(zoom));wrap.style.zoom=String(zoom);if(!('zoom' in wrap.style)){wrap.style.transform='scale('+zoom+')';wrap.style.transformOrigin='0 0'}$('#v27ZoomLabel').textContent=Math.round(zoom*100)+'%'}
function fitRoom(){const z=Math.min((viewport.clientWidth-6)/1600,(Math.min(650,window.innerHeight*.62)-6)/650);applyZoom(clamp(z,.45,1.05));viewport.scrollTo({left:0,top:0,behavior:'smooth'})}
function injectUi(){
 if($('#v27Toolbar'))return;
 const bar=document.createElement('div');bar.id='v27Toolbar';bar.className='v27-toolbar';bar.innerHTML='<span class="v27-multi-status" id="v27MultiStatus">1 Tisch auswählen</span><button class="btn" id="v27Group">🏷 Gruppe</button><button class="btn" id="v27AddZone">＋ Gang / Zone</button><span class="spacer"></span><div class="v27-zoom"><button class="btn" id="v27ZoomOut">−</button><strong id="v27ZoomLabel">100%</strong><button class="btn" id="v27ZoomIn">＋</button><button class="btn" id="v27Fit">⛶ Einpassen</button></div>';
 $('.boardTools')?.after(bar);
 const lp=$('[data-pane="layout"]');if(lp){const s=document.createElement('div');s.className='v27-section';s.innerHTML='<h3>V27 · Raumvorlagen</h3><div class="v27-actions"><button class="v27-template" data-v27-template="normal">▰ Normal</button><button class="v27-template" data-v27-template="group">▦ Gruppenarbeit</button><button class="v27-template" data-v27-template="exam">▰ Prüfung</button><button class="v27-template" data-v27-template="fit">⛶ Raum einpassen</button></div><p class="v27-help">Mehrfachauswahl: Strg/Cmd oder Shift + Tisch. Markierte Tische lassen sich gemeinsam verschieben und benennen.</p>';lp.appendChild(s)}
 const op=$('[data-pane="options"]');if(op){const s=document.createElement('div');s.className='v27-section';s.innerHTML='<h3>Intelligente Sitzordnung</h3><div class="v27-actions"><button class="btn primary wide" id="v27AutoTags">✨ Nach Tags anordnen</button><button class="btn" id="v27ClearZones">Zonen löschen</button><button class="btn" id="v27ClearGroups">Gruppenlabels löschen</button></div><p class="v27-help">Berücksichtigt Nähe Tafel, Ruheplatz, Nicht zusammen, Förderbedarf und Helfer. Die Tags bleiben ausschließlich in der Lehreransicht.</p>';op.appendChild(s)}
 $('#v27ZoomOut').onclick=()=>applyZoom(zoom-.1);$('#v27ZoomIn').onclick=()=>applyZoom(zoom+.1);$('#v27Fit').onclick=fitRoom;$('#v27Group').onclick=setGroupLabel;$('#v27AddZone').onclick=()=>addZone();
 $$('[data-v27-template]').forEach(b=>b.onclick=()=>applyTemplate(b.dataset.v27Template));
 $('#v27AutoTags').onclick=autoArrangeTags;$('#v27ClearZones').onclick=()=>{if(confirm('Alle Gänge / Zonen dieser Klasse löschen?')){classMeta().zones=[];renderZones();queueMetaSave()}};
 $('#v27ClearGroups').onclick=()=>{classMeta().groups={};applyGroupLabels();queueMetaSave()};
 applyZoom(zoom)
}
function updateMultiStatus(){const n=multi.size,$s=$('#v27MultiStatus');if($s)$s.textContent=n?n+' Tische markiert':'Mehrfachauswahl';$$('.desk').forEach(d=>d.classList.toggle('v27-multi',multi.has(d)))}
function clearMulti(){multi.clear();updateMultiStatus()}
function selectedDesks(){if(multi.size)return[...multi].filter(x=>x.isConnected);const core=$('.desk.selected');return core?[core]:[]}
function setGroupLabel(){const ds=selectedDesks();if(!ds.length)return toast('Erst Tisch oder Tische auswählen');const cur=classMeta().groups?.[ds[0].dataset.id]||'',label=prompt('Name der Tischgruppe:',cur||'Gruppe 1');if(label===null)return;classMeta().groups=classMeta().groups||{};ds.forEach(d=>{if(label.trim())classMeta().groups[d.dataset.id]=label.trim().slice(0,28);else delete classMeta().groups[d.dataset.id]});applyGroupLabels();queueMetaSave()}
function applyGroupLabels(){
 const groups=classMeta().groups||{};$$('.desk').forEach(d=>{d.querySelector('.v27-group-label')?.remove();const label=groups[d.dataset.id];if(label){const e=document.createElement('span');e.className='v27-group-label';e.textContent=label;d.appendChild(e)}})
}
function zoneData(el){return{id:el.dataset.zoneId,label:el.dataset.label||'Zone',x:parseFloat(el.style.left)||0,y:parseFloat(el.style.top)||0,w:el.offsetWidth,h:el.offsetHeight}}
function syncZones(){classMeta().zones=$$('.v27-zone').map(zoneData);queueMetaSave()}
function addZone(data=null){
 const z=data||{id:'z'+uid(),label:(prompt('Bezeichnung der freien Fläche:','Gang')||'Gang').slice(0,28),x:650,y:300,w:250,h:90};if(!z.label)return;
 const el=document.createElement('div');el.className='v27-zone';el.dataset.zoneId=z.id||('z'+uid());el.dataset.label=z.label||'Zone';el.style.left=(z.x??650)+'px';el.style.top=(z.y??300)+'px';el.style.width=(z.w??250)+'px';el.style.height=(z.h??90)+'px';el.innerHTML='<span>'+esc(z.label||'Zone')+'</span><button class="del" title="Zone löschen">×</button><i class="resize">↘</i>';
 const firstDesk=$('.desk');room.insertBefore(el,firstDesk||null);bindZone(el);if(!data){syncZones();selectZone(el)}return el
}
function selectZone(el){$$('.v27-zone').forEach(z=>z.classList.toggle('selected',z===el))}
function bindZone(el){
 el.addEventListener('pointerdown',e=>{if(e.target.closest('.resize')||e.target.closest('.del'))return;e.preventDefault();e.stopPropagation();selectZone(el);zoneDrag={el,x:e.clientX,y:e.clientY,left:parseFloat(el.style.left)||0,top:parseFloat(el.style.top)||0}});
 el.querySelector('.resize').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();selectZone(el);zoneResize={el,x:e.clientX,y:e.clientY,w:el.offsetWidth,h:el.offsetHeight}});
 el.querySelector('.del').onclick=e=>{e.stopPropagation();el.remove();syncZones()}
}
function renderZones(){$$('.v27-zone').forEach(x=>x.remove());(classMeta().zones||[]).forEach(addZone)}
document.addEventListener('pointermove',e=>{
 if(zoneDrag){const dx=(e.clientX-zoneDrag.x)/zoom,dy=(e.clientY-zoneDrag.y)/zoom;zoneDrag.el.style.left=clamp(zoneDrag.left+dx,5,1600-zoneDrag.el.offsetWidth-5)+'px';zoneDrag.el.style.top=clamp(zoneDrag.top+dy,72,650-zoneDrag.el.offsetHeight-5)+'px'}
 if(zoneResize){const dw=(e.clientX-zoneResize.x)/zoom,dh=(e.clientY-zoneResize.y)/zoom;zoneResize.el.style.width=clamp(zoneResize.w+dw,110,700)+'px';zoneResize.el.style.height=clamp(zoneResize.h+dh,52,350)+'px'}
 if(groupDrag){const dx=(e.clientX-groupDrag.x)/zoom,dy=(e.clientY-groupDrag.y)/zoom;for(const [d,p] of groupDrag.pos){d.style.left=clamp(p.x+dx,8,1600-d.offsetWidth-8)+'px';d.style.top=clamp(p.y+dy,78,650-d.offsetHeight-8)+'px'}showSnapGuides(groupDrag.primary)}
});
document.addEventListener('pointerup',()=>{
 if(zoneDrag||zoneResize){zoneDrag=null;zoneResize=null;syncZones()}
 if(groupDrag){snapDesk(groupDrag.primary,true);groupDrag=null;hideGuides();$('#save')?.click()}
});
room.addEventListener('pointerdown',e=>{
 const d=e.target.closest('.desk');if(!d){if(!e.target.closest('.v27-zone'))clearMulti();return}
 const modifier=e.ctrlKey||e.metaKey||e.shiftKey;
 if(modifier){e.preventDefault();e.stopImmediatePropagation();if(multi.has(d))multi.delete(d);else multi.add(d);updateMultiStatus();return}
 if(multi.size>1&&multi.has(d)&&!e.target.closest('.seat,.handle')){e.preventDefault();e.stopImmediatePropagation();groupDrag={primary:d,x:e.clientX,y:e.clientY,pos:new Map([...multi].map(x=>[x,{x:parseFloat(x.style.left)||0,y:parseFloat(x.style.top)||0}]))};return}
 if(multi.size)clearMulti()
},true);
window.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&multi.size>1&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();e.stopImmediatePropagation();[...multi].forEach(d=>d.remove());clearMulti();$('#save')?.click()}},true);
function guide(which,pos){let el=$('#v27Guide'+which);if(!el){el=document.createElement('i');el.id='v27Guide'+which;el.className='v27-guide '+(which==='V'?'v':'h');room.appendChild(el)}if(which==='V')el.style.left=pos+'px';else el.style.top=pos+'px';el.style.display='block'}
function hideGuides(){$('#v27GuideV')?.style.setProperty('display','none');$('#v27GuideH')?.style.setProperty('display','none')}
function nearestAlignment(d){
 const x=parseFloat(d.style.left)||0,y=parseFloat(d.style.top)||0,w=d.offsetWidth,h=d.offsetHeight,others=$$('.desk').filter(o=>o!==d&&!multi.has(o));let bx=null,by=null;
 for(const o of others){const ox=parseFloat(o.style.left)||0,oy=parseFloat(o.style.top)||0,ow=o.offsetWidth,oh=o.offsetHeight;
  for(const [a,b] of [[x,ox],[x+w/2,ox+ow/2],[x+w,ox+ow]]){const diff=b-a;if(Math.abs(diff)<=10&&(!bx||Math.abs(diff)<Math.abs(bx.diff)))bx={diff,line:b}}
  for(const [a,b] of [[y,oy],[y+h/2,oy+oh/2],[y+h,oy+oh]]){const diff=b-a;if(Math.abs(diff)<=10&&(!by||Math.abs(diff)<Math.abs(by.diff)))by={diff,line:b}}
 }return{bx,by}
}
function showSnapGuides(d){if(!d)return;const{bx,by}=nearestAlignment(d);if(bx)guide('V',bx.line);else $('#v27GuideV')?.style.setProperty('display','none');if(by)guide('H',by.line);else $('#v27GuideH')?.style.setProperty('display','none')}
function snapDesk(d,moveGroup=false){if(!d)return;const{bx,by}=nearestAlignment(d);if(!bx&&!by)return;const dx=bx?.diff||0,dy=by?.diff||0,targets=moveGroup&&multi.size?[...multi]:[d];targets.forEach(x=>{x.style.left=clamp((parseFloat(x.style.left)||0)+dx,8,1600-x.offsetWidth-8)+'px';x.style.top=clamp((parseFloat(x.style.top)||0)+dy,78,650-x.offsetHeight-8)+'px'})}
const observer=new MutationObserver(ms=>{for(const m of ms){const d=m.target.closest?.('.desk');if(d?.classList.contains('dragging')){showSnapGuides(d);break}}});observer.observe(room,{subtree:true,attributes:true,attributeFilter:['style']});
document.addEventListener('pointerup',e=>{const d=e.target?.closest?.('.desk.dragging');if(d){snapDesk(d);hideGuides()}},true);
function removeDesks(){$$('.desk').forEach(x=>x.remove());clearMulti()}
function addDeskByCore(type,x,y){
 const before=new Set($$('.desk'));const b=$('[data-add="'+type+'"]');if(!b)return null;b.click();const d=$$('.desk').find(x=>!before.has(x));if(d){d.style.left=x+'px';d.style.top=y+'px'}return d
}
function seats(){return $$('.seat')}
function seatCenter(seat){const d=seat.closest('.desk'),all=[...d.querySelectorAll('.seat')],i=all.indexOf(seat),type=d.dataset.type,x=parseFloat(d.style.left)||0,y=parseFloat(d.style.top)||0,w=d.offsetWidth,h=d.offsetHeight;let cx=x+w/2,cy=y+h/2;
 if(type==='two'){cx=x+(i?0.72:0.28)*w}
 else if(type==='row4'){cx=x+(i+.5)/4*w}
 else if(type==='four'){cx=x+(i%2?0.72:0.28)*w;cy=y+(i>1?.72:.28)*h}
 return{x:cx,y:cy}
}
function firstName(n){return String(n||'').trim().split(/\s+/)[0]||''}
function tagsFor(name){return(tagDb?.[classId()]?.[name]||[])}
function tagDots(name){
 const ids=tagsFor(name),colors={support:'#e77ca3',classrep:'#8b6bd3',front:'#6ba8df',quiet:'#65b68f',apart:'#e2a14d',helper:'#c9ad34'};return ids.map(id=>{const c=colors[id]||customTags.find(t=>t.id===id)?.color||'#9b7bd3';return'<span class="seatTagDot" style="background:'+esc(c)+'"></span>'}).join('')
}
function setSeat(seat,name){seat.dataset.name=name||'';seat.title=name||'';seat.classList.toggle('empty',!name);seat.draggable=!!name;seat.innerHTML=name?'<span class="seatStatusDot"></span><span class="seatName">'+esc(firstName(name))+'</span><span class="seatTags">'+tagDots(name)+'</span>':'<span class="seatName">Frei</span>'}
function assignNames(names){const ss=seats().sort((a,b)=>{const A=seatCenter(a),B=seatCenter(b);return A.y-B.y||A.x-B.x});ss.forEach(s=>setSeat(s,''));names.slice(0,ss.length).forEach((n,i)=>setSeat(ss[i],n));$('#save')?.click()}
function templateNormal(){const b=$('[data-layout="rows"]');if(b){b.click();setTimeout(()=>{applyGroupLabels();renderZones();fitRoom()},60)}}
function templateGroup(){
 const cls=currentClass(),names=cls?.students||[];removeDesks();const count=Math.max(1,Math.ceil(names.length/4)),cols=Math.min(4,count),x0=130,y0=180,xGap=330,yGap=205;
 for(let i=0;i<count;i++){const c=i%cols,r=Math.floor(i/cols);addDeskByCore('four',x0+c*xGap,y0+r*yGap)}
 assignNames(names);fitRoom()
}
function templateExam(){
 const cls=currentClass(),names=cls?.students||[];removeDesks();const cols=8,w=92,x0=65,gap=76,y0=175,rowGap=122;
 for(let i=0;i<names.length;i++){const c=i%cols,r=Math.floor(i/cols),aisle=c>=4?70:0;addDeskByCore('single',x0+c*(w+gap)+aisle,y0+r*rowGap)}
 assignNames(names);fitRoom()
}
function applyTemplate(type){if(type==='fit')return fitRoom();if(!confirm('Aktuelles Tischlayout durch Vorlage ersetzen? Die Schüler werden neu verteilt.'))return;if(type==='normal')templateNormal();if(type==='group')templateGroup();if(type==='exam')templateExam();toast(type==='exam'?'Prüfungsordnung erstellt':type==='group'?'Gruppenarbeits-Layout erstellt':'Normales Layout erstellt')}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
async function autoArrangeTags(){
 const cls=currentClass();if(!cls)return toast('Keine Klasse gewählt');try{tagDb=await KathleenClassLists.secureGet(TAG_STORE,{})||tagDb;customTags=await KathleenClassLists.secureGet(CUSTOM_TAG_STORE,[])||customTags}catch(e){}
 const names=[...cls.students],ss=seats(),free=new Set(ss),assigned=new Map(),info=new Map(ss.map(s=>[s,seatCenter(s)]));
 const choose=(name,sorter)=>{const arr=[...free].sort(sorter);if(!arr.length)return null;const s=arr[0];free.delete(s);assigned.set(name,s);return s};
 const has=(n,t)=>tagsFor(n).includes(t);
 const front=names.filter(n=>has(n,'front')||has(n,'support'));front.forEach(n=>choose(n,(a,b)=>info.get(a).y-info.get(b).y||Math.abs(info.get(a).x-800)-Math.abs(info.get(b).x-800)));
 const quiet=names.filter(n=>has(n,'quiet')&&!assigned.has(n));quiet.forEach(n=>choose(n,(a,b)=>Math.min(info.get(a).x,1600-info.get(a).x)-Math.min(info.get(b).x,1600-info.get(b).x)||info.get(a).y-info.get(b).y));
 const apart=names.filter(n=>has(n,'apart')&&!assigned.has(n)),apartSeats=[...assigned.entries()].filter(([n])=>has(n,'apart')).map(([,s])=>s);
 for(const n of apart){const candidates=[...free];if(!candidates.length)break;const s=candidates.sort((a,b)=>{const da=apartSeats.length?Math.min(...apartSeats.map(x=>dist(info.get(a),info.get(x)))):9999,db=apartSeats.length?Math.min(...apartSeats.map(x=>dist(info.get(b),info.get(x)))):9999;return db-da})[0];free.delete(s);assigned.set(n,s);apartSeats.push(s)}
 const helpers=names.filter(n=>has(n,'helper')&&!assigned.has(n)),supportSeats=[...assigned.entries()].filter(([n])=>has(n,'support')).map(([,s])=>s);
 helpers.forEach(n=>choose(n,(a,b)=>{const da=supportSeats.length?Math.min(...supportSeats.map(x=>dist(info.get(a),info.get(x)))):info.get(a).y,db=supportSeats.length?Math.min(...supportSeats.map(x=>dist(info.get(b),info.get(x)))):info.get(b).y;return da-db}));
 const rest=names.filter(n=>!assigned.has(n)).sort(()=>Math.random()-.5);for(const n of rest){const arr=[...free];if(!arr.length)break;const s=arr[Math.floor(Math.random()*arr.length)];free.delete(s);assigned.set(n,s)}
 ss.forEach(s=>setSeat(s,''));for(const[n,s]of assigned)setSeat(s,n);$('#save')?.click();toast('Sitzordnung nach Tags erstellt')
}
async function restoreMeta(){clearMulti();await loadStores();renderZones();applyGroupLabels()}
$('#classSelect')?.addEventListener('change',()=>setTimeout(restoreMeta,80));
window.addEventListener('kathleen:globalclass',()=>setTimeout(restoreMeta,80));
const mo=new MutationObserver(()=>{applyGroupLabels()});mo.observe(room,{childList:true});
(async()=>{injectUi();for(let i=0;i<40&&!KathleenClassLists?.isUnlocked?.();i++)await new Promise(r=>setTimeout(r,100));await restoreMeta();setTimeout(fitRoom,180)})();
})();