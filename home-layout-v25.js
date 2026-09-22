(()=>{'use strict';
const DESKTOP='kathleenHomeLayoutDesktopV1',MOBILE='kathleenHomeLayoutMobileV1';
const DEFAULT=['workbench','next','quest','dashboard','board','subjects'];
const LABEL={workbench:'Stundenplan & To-do',next:'Nächste Stunde',quest:'Quest Mode',dashboard:'Zuletzt & Favoriten',board:'Classroom Board',subjects:'Bereiche'};
const mobile=()=>matchMedia('(max-width:700px)').matches;
const key=()=>mobile()?MOBILE:DESKTOP;
const read=()=>{try{const x=JSON.parse(localStorage.getItem(key())||'null');if(x&&Array.isArray(x.order))return x}catch(e){}return{order:[...DEFAULT],sizes:{}}};
const write=s=>{try{localStorage.setItem(key(),JSON.stringify(s))}catch(e){}};
function toast(t){const e=document.getElementById('toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1700)}
function setup(){
 const view=document.getElementById('view-home');if(!view||document.getElementById('homeLayoutToolbar'))return;
 const map={
  workbench:view.querySelector('.home-workbench'),next:document.getElementById('nextLessonCard'),quest:document.getElementById('questBetaCard'),
  dashboard:view.querySelector('.dashboard-grid.v21'),board:view.querySelector('.board-home-card'),subjects:view.querySelector('.subject-launchers')
 };
 if(Object.values(map).some(x=>!x))return;
 const anchor=map.workbench;
 const host=document.createElement('div');host.className='home-layout-host';host.id='homeLayoutHost';anchor.parentNode.insertBefore(host,anchor);
 DEFAULT.forEach(id=>{const el=map[id];el.dataset.homeBlock=id;el.classList.add('home-block');host.appendChild(el)});
 const bar=document.createElement('div');bar.className='home-layout-toolbar';bar.id='homeLayoutToolbar';
 bar.innerHTML='<div><strong>Startseite</strong><small>Desktop und Handy werden getrennt gespeichert.</small></div><div class="home-layout-actions"><button id="homeLayoutReset" type="button">↺ Standard</button><button class="primary" id="homeLayoutEdit" type="button">✦ Anpassen</button></div>';
 host.parentNode.insertBefore(bar,host);
 DEFAULT.forEach(id=>controls(map[id],id));
 let editing=false,dragged='';
 function apply(){
  const s=read(),known=s.order.filter(id=>map[id]),missing=DEFAULT.filter(id=>!known.includes(id));[...known,...missing].forEach(id=>host.appendChild(map[id]));
  DEFAULT.forEach(id=>{const size=s.sizes?.[id]||'normal';map[id].dataset.homeSize=size;const sel=map[id].querySelector('.home-size');if(sel)sel.value=size});
 }
 function move(id,delta){
  const s=read(),order=s.order.filter(x=>map[x]),i=order.indexOf(id);if(i<0)return;const j=Math.max(0,Math.min(order.length-1,i+delta));if(i===j)return;order.splice(j,0,order.splice(i,1)[0]);s.order=order;write(s);apply()
 }
 function controls(el,id){
  const c=document.createElement('div');c.className='home-block-controls';c.innerHTML='<button class="grab" type="button" title="Ziehen" aria-label="'+LABEL[id]+' ziehen">⠿</button><button class="up" type="button" aria-label="'+LABEL[id]+' nach oben">↑</button><button class="down" type="button" aria-label="'+LABEL[id]+' nach unten">↓</button><select class="home-size" aria-label="Größe für '+LABEL[id]+'"><option value="compact">Kompakt</option><option value="normal">Normal</option><option value="wide">Breit</option></select>';
  el.prepend(c);c.querySelector('.up').onclick=e=>{e.preventDefault();e.stopPropagation();move(id,-1)};c.querySelector('.down').onclick=e=>{e.preventDefault();e.stopPropagation();move(id,1)};
  c.querySelector('.home-size').onchange=e=>{const s=read();s.sizes=s.sizes||{};s.sizes[id]=e.target.value;write(s);apply()};
  el.draggable=false;
  el.addEventListener('dragstart',e=>{if(!editing||mobile()){e.preventDefault();return}dragged=id;el.classList.add('home-dragging');e.dataTransfer.effectAllowed='move'});
  el.addEventListener('dragend',()=>{dragged='';el.classList.remove('home-dragging');host.querySelectorAll('.home-drop-target').forEach(x=>x.classList.remove('home-drop-target'))});
  el.addEventListener('dragover',e=>{if(!dragged||dragged===id)return;e.preventDefault();el.classList.add('home-drop-target')});
  el.addEventListener('dragleave',()=>el.classList.remove('home-drop-target'));
  el.addEventListener('drop',e=>{if(!dragged||dragged===id)return;e.preventDefault();const s=read(),o=s.order.filter(x=>map[x]),a=o.indexOf(dragged),b=o.indexOf(id);if(a<0||b<0)return;o.splice(b,0,o.splice(a,1)[0]);s.order=o;write(s);apply()});
 }
 document.getElementById('homeLayoutEdit').onclick=()=>{
  editing=!editing;view.classList.toggle('home-layout-editing',editing);document.getElementById('homeLayoutEdit').textContent=editing?'✓ Fertig':'✦ Anpassen';
  DEFAULT.forEach(id=>map[id].draggable=editing&&!mobile());toast(editing?'Startseite anpassen':'Anordnung gespeichert')
 };
 document.getElementById('homeLayoutReset').onclick=()=>{if(!confirm((mobile()?'Handy':'Desktop')+'-Anordnung auf Standard zurücksetzen?'))return;localStorage.removeItem(key());apply();toast('Standard wiederhergestellt')};
 let wasMobile=mobile();addEventListener('resize',()=>{const now=mobile();if(now!==wasMobile){wasMobile=now;editing=false;view.classList.remove('home-layout-editing');document.getElementById('homeLayoutEdit').textContent='✦ Anpassen';DEFAULT.forEach(id=>map[id].draggable=false);apply()}});
 apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();