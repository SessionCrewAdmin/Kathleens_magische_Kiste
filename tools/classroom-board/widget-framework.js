(function(){
'use strict';
const VERSION='22.0';
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

// First wave registrations. Rendering remains intentionally neutral in V22.0;
// feature-specific behavior is layered on in V22.1+ without changing board storage.
[
 ['timer','⌛','Timer / Countdown',{w:340,h:220},{seconds:300,running:false}],
 ['random','🎯','Zufallsgenerator',{w:360,h:240},{mode:'student',excludeDrawn:true,drawn:[]}],
 ['teams','👥','Teamgenerator',{w:420,h:300},{teamCount:4,teams:[]}],
 ['poll','📊','Live-Abstimmung',{w:430,h:300},{question:'',options:[],open:false,showResults:true}],
 ['traffic','🚦','Ampel',{w:360,h:260},{active:'green',variant:'classic',labels:{red:'Nicht reden',yellow:'Flüsterstimme',green:'Innenstimme'},showLabels:true,labelPosition:'right'}],
 ['sticker','💖','Sticker',{w:220,h:180},{stickerId:'',sheet:'',label:''}],
 ['sound','🎙️','Sound-Pegel',{w:400,h:310},{threshold:65,sensitivity:1,smoothing:1,counter:0,theme:'dark'}]
].forEach(([type,icon,title,defaultSize,defaultData])=>register({type,icon,title,defaultSize,defaultData}));

window.KathleenWidgets=Object.freeze({
  VERSION,SCHEMA,register,definition,list,create,normalizeData,renderHtml,mount,
  itemFromElement,writeToElement,setData,migrate
});
})();