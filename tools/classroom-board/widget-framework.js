(function(){
'use strict';
const VERSION='22.1';
const SCHEMA=1;
const defs=new Map();
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function register(def){
  if(!def||!def.type) throw Error('Widget type required');
  defs.set(def.type,Object.freeze({
    type:def.type,
    title:def.title||def.type,
    icon:def.icon||'◇',
    defaultSize:{w:320,h:200,...(def.defaultSize||{})},
    defaultData:clone(def.defaultData||{}),
    capabilities:{teacher:true,presentation:true,studentView:true,studentInteract:false,...(def.capabilities||{})},
    render:typeof def.render==='function'?def.render:null
  }));
}
function definition(type){return defs.get(type)||null}
function list(){return [...defs.values()].map(d=>({...d,defaultData:clone(d.defaultData),capabilities:{...d.capabilities}}))}
function normalizeData(type,data){
  const d=definition(type);
  return {...clone(d?.defaultData||{}),...(data&&typeof data==='object'?clone(data):{})};
}
function create(type,overrides={}){
  const d=definition(type);
  if(!d) throw Error('Unknown widget: '+type);
  return {
    type:'widget',
    widgetType:type,
    widgetVersion:VERSION,
    widgetSchema:SCHEMA,
    widgetData:normalizeData(type,overrides.widgetData),
    w:overrides.w||d.defaultSize.w,
    h:overrides.h||d.defaultSize.h,
    ...overrides
  };
}
function fallbackHtml(item){
  const d=definition(item.widgetType);
  return '<div class="kwShell" data-kw-type="'+esc(item.widgetType)+'"><div class="kwShellHead"><span>'+esc(d?.icon||'◇')+'</span><b>'+esc(d?.title||item.widgetType||'Widget')+'</b><small>V'+VERSION+'</small></div><div class="kwShellBody"><span>Widget bereit</span></div></div>';
}
function renderHtml(item,ctx={}){
  const d=definition(item.widgetType);
  const data=normalizeData(item.widgetType,item.widgetData);
  if(d?.render) return d.render(data,{...ctx,item,definition:d,esc});
  return fallbackHtml({...item,widgetData:data});
}
function mount(container,item,ctx={}){
  if(!container||!item?.widgetType) return false;
  container.classList.add('kwHost');
  container.dataset.widgetType=item.widgetType;
  container.dataset.widgetVersion=item.widgetVersion||VERSION;
  container.dataset.widgetSchema=String(item.widgetSchema||SCHEMA);
  container.innerHTML=renderHtml(item,ctx);
  container.querySelectorAll('[data-kw-action]').forEach(btn=>{
    btn.addEventListener('click',ev=>{
      ev.stopPropagation();
      container.dispatchEvent(new CustomEvent('kathleen:widget-action',{bubbles:true,detail:{
        type:item.widgetType,
        action:btn.dataset.kwAction,
        value:btn.dataset.kwValue??null
      }}));
    });
  });
  container.querySelectorAll('[data-kw-field]').forEach(input=>{
    input.addEventListener('change',ev=>{
      ev.stopPropagation();
      container.dispatchEvent(new CustomEvent('kathleen:widget-action',{bubbles:true,detail:{
        type:item.widgetType,
        action:'field',
        field:input.dataset.kwField,
        value:input.type==='checkbox'?input.checked:input.value
      }}));
    });
    input.addEventListener('click',ev=>ev.stopPropagation());
  });
  startRuntime(container,item,ctx);
  return true;
}
function itemFromElement(el){
  if(!el) return null;
  const type=el.dataset.widgetType||'';
  if(!type) return null;
  let data={};try{data=JSON.parse(el.dataset.widgetData||'{}')}catch(e){}
  return {
    widgetType:type,
    widgetVersion:el.dataset.widgetVersion||VERSION,
    widgetSchema:+(el.dataset.widgetSchema||SCHEMA),
    widgetData:normalizeData(type,data)
  };
}
function writeToElement(el,item){
  if(!el||!item?.widgetType) return;
  el.dataset.widgetType=item.widgetType;
  el.dataset.widgetVersion=item.widgetVersion||VERSION;
  el.dataset.widgetSchema=String(item.widgetSchema||SCHEMA);
  el.dataset.widgetData=JSON.stringify(normalizeData(item.widgetType,item.widgetData));
}
function setData(el,patch,ctx={}){
  const item=itemFromElement(el);if(!item)return null;
  item.widgetData={...item.widgetData,...clone(patch||{})};
  writeToElement(el,item);
  mount(el.querySelector('.body')||el,item,ctx);
  el.dispatchEvent(new CustomEvent('kathleen:widget-change',{bubbles:true,detail:clone(item)}));
  return item;
}
function migrate(item){
  if(!item||item.type!=='widget'||!item.widgetType)return item;
  return {...item,widgetVersion:item.widgetVersion||VERSION,widgetSchema:item.widgetSchema||SCHEMA,widgetData:normalizeData(item.widgetType,item.widgetData)};
}

function padTime(sec){
  sec=Math.max(0,Math.round(Number(sec)||0));
  const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  return h>0?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function timerRemaining(data){
  if(data.running&&data.endsAt){
    return Math.max(0,Math.ceil((Number(data.endsAt)-Date.now())/1000));
  }
  return Math.max(0,Number(data.remaining??data.seconds??300)||0);
}
function renderTimer(data,{mode,esc}){
  const sec=timerRemaining(data),duration=Math.max(1,Number(data.duration??data.seconds??300)||300),pct=Math.max(0,Math.min(100,sec/duration*100));
  const interactive=mode==='teacher';
  return '<div class="kwTimer'+(sec===0?' finished':'')+'">'+
    '<div class="kwWidgetTop"><span class="kwWidgetIcon">⌛</span><b>'+esc(data.title||'Timer')+'</b><span class="kwWidgetState">'+(data.running?'LÄUFT':'BEREIT')+'</span></div>'+
    '<div class="kwTimerTime" data-kw-timer-time>'+padTime(sec)+'</div>'+
    '<div class="kwTimerTrack"><i data-kw-timer-progress style="width:'+pct+'%"></i></div>'+
    (interactive?'<div class="kwTimerPresets"><button data-kw-action="timer-add" data-kw-value="-60">−1 min</button><button data-kw-action="timer-add" data-kw-value="60">+1 min</button><button data-kw-action="timer-add" data-kw-value="300">+5 min</button></div><div class="kwTimerActions"><button class="primary" data-kw-action="timer-toggle">'+(data.running?'⏸ Pause':'▶ Start')+'</button><button data-kw-action="timer-reset">↺ Reset</button></div>':'')+
  '</div>';
}
function trafficLabels(data){
  return {...{red:'Nicht reden',yellow:'Flüsterstimme',green:'Innenstimme'},...(data.labels||{})};
}
function trafficHousing(variant){
  const v=['classic','rounded','yellow','school'].includes(variant)?variant:'classic';
  return 'kwTrafficHousing '+v;
}
function renderTraffic(data,{mode,esc}){
  const labels=trafficLabels(data),active=['red','yellow','green'].includes(data.active)?data.active:'green',interactive=mode==='teacher';
  const lights=['red','yellow','green'].map(c=>'<button class="kwTrafficLight '+c+(active===c?' on':'')+'" '+(interactive?'data-kw-action="traffic-set" data-kw-value="'+c+'"':'disabled')+' aria-label="'+esc(labels[c])+'"></button>').join('');
  const rows=data.showLabels===false?'':('<div class="kwTrafficLabels">'+['red','yellow','green'].map(c=>'<div class="'+(active===c?'active':'')+'"><span class="dot '+c+'"></span><b>'+esc(labels[c])+'</b></div>').join('')+'</div>');
  const settings=interactive?'<details class="kwTrafficSettings"><summary>⚙ Einstellungen</summary><label>Design<select data-kw-field="variant"><option value="classic"'+(data.variant==='classic'?' selected':'')+'>Klassisch</option><option value="rounded"'+(data.variant==='rounded'?' selected':'')+'>Abgerundet</option><option value="yellow"'+(data.variant==='yellow'?' selected':'')+'>Gelb</option><option value="school"'+(data.variant==='school'?' selected':'')+'>Schule</option></select></label><label>Rot<input data-kw-field="label_red" value="'+esc(labels.red)+'"></label><label>Gelb<input data-kw-field="label_yellow" value="'+esc(labels.yellow)+'"></label><label>Grün<input data-kw-field="label_green" value="'+esc(labels.green)+'"></label><label class="check"><input type="checkbox" data-kw-field="showLabels"'+(data.showLabels!==false?' checked':'')+'> Beschriftungen anzeigen</label></details>':'';
  return '<div class="kwTraffic"><div class="kwWidgetTop"><span class="kwWidgetIcon">🚦</span><b>'+esc(data.title||'Ampel')+'</b><span class="kwWidgetState">'+esc(labels[active])+'</span></div><div class="kwTrafficMain"><div class="'+trafficHousing(data.variant)+'">'+lights+'</div>'+rows+'</div>'+settings+'</div>';
}
function startRuntime(container,item,ctx){
  if(container._kwTimer){clearInterval(container._kwTimer);container._kwTimer=null}
  if(item.widgetType!=='timer')return;
  const tick=()=>{
    const data=normalizeData('timer',item.widgetData),sec=timerRemaining(data),duration=Math.max(1,Number(data.duration??data.seconds??300)||300);
    const out=container.querySelector('[data-kw-timer-time]'),bar=container.querySelector('[data-kw-timer-progress]');
    if(out)out.textContent=padTime(sec);
    if(bar)bar.style.width=Math.max(0,Math.min(100,sec/duration*100))+'%';
    container.querySelector('.kwTimer')?.classList.toggle('finished',sec===0);
    if(sec===0&&data.running&&container._kwTimer){clearInterval(container._kwTimer);container._kwTimer=null}
  };
  tick();
  if(item.widgetData?.running)container._kwTimer=setInterval(tick,250);
}

// First wave registrations. V22.1 ships Timer + Traffic Light as full widgets; the rest stay framework-ready.
// feature-specific behavior is layered on in V22.1+ without changing board storage.
register({type:'timer',icon:'⌛',title:'Timer / Countdown',defaultSize:{w:380,h:270},defaultData:{title:'Timer',seconds:300,duration:300,remaining:300,running:false,endsAt:null},render:renderTimer});
register({type:'traffic',icon:'🚦',title:'Ampel',defaultSize:{w:430,h:320},defaultData:{title:'Ampel',active:'green',variant:'classic',labels:{red:'Nicht reden',yellow:'Flüsterstimme',green:'Innenstimme'},showLabels:true,labelPosition:'right'},render:renderTraffic});
[
 ['random','🎯','Zufallsgenerator',{w:360,h:240},{mode:'student',excludeDrawn:true,drawn:[]}],
 ['teams','👥','Teamgenerator',{w:420,h:300},{teamCount:4,teams:[]}],
 ['poll','📊','Live-Abstimmung',{w:430,h:300},{question:'',options:[],open:false,showResults:true}],
 ['sticker','💖','Sticker',{w:220,h:180},{stickerId:'',sheet:'',label:''}],
 ['sound','🎙️','Sound-Pegel',{w:400,h:310},{threshold:65,sensitivity:1,smoothing:1,counter:0,theme:'dark'}]
].forEach(([type,icon,title,defaultSize,defaultData])=>register({type,icon,title,defaultSize,defaultData}));

window.KathleenWidgets=Object.freeze({
  VERSION,SCHEMA,register,definition,list,create,normalizeData,renderHtml,mount,
  itemFromElement,writeToElement,setData,migrate,timerRemaining,padTime
});
})();