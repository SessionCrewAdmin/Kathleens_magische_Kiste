(()=>{'use strict';
const KEY='kathleenTeachingContextV1',FIELDS=['classId','className','subject','grade','unit','source'];
const text=value=>String(value??'').trim();
function read(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');return value&&typeof value==='object'?value:{}}catch{return{}}}
function lesson(){try{return window.KathleenLessonMode?.get?.()||{}}catch{return{}}}
function activeClass(){try{return window.KathleenClassLists?.getGlobalClass?.()||{}}catch{return{}}}
function normalise(value={}){const out={};for(const key of FIELDS){if(key==='grade'){const grade=Number(value.grade);if(Number.isInteger(grade)&&grade>=5&&grade<=13)out.grade=grade;continue}const item=text(value[key]);if(item)out[key]=item}return out}
function get(){const saved=read(),currentLesson=lesson(),currentClass=activeClass();return normalise({...saved,classId:currentLesson.classId||currentClass.id||saved.classId,className:currentLesson.className||currentClass.name||saved.className,subject:currentLesson.subject||saved.subject})}
function publish(value){localStorage.setItem(KEY,JSON.stringify(value));window.dispatchEvent(new CustomEvent('kathleen:teachingcontext',{detail:value}));return value}
function set(patch={}){const next=normalise({...get(),...normalise(patch)});for(const key of FIELDS)if(Object.prototype.hasOwnProperty.call(patch,key)&&(patch[key]===null||text(patch[key])===''))delete next[key];next.updatedAt=new Date().toISOString();return publish(next)}
function clear(){localStorage.removeItem(KEY);window.dispatchEvent(new CustomEvent('kathleen:teachingcontext',{detail:null}));return null}
function label(value=get()){return[value.className,value.subject,value.grade?`Klasse ${value.grade}`:'',value.unit?`Unit ${value.unit}`:''].filter(Boolean).join(' · ')}
function syncRuntime(){const before=read(),now=get();const changed=['classId','className','subject'].some(key=>String(before[key]||'')!==String(now[key]||''));if(changed)publish({...before,...now,updatedAt:new Date().toISOString()})}
window.KathleenTeachingContext={get,set,clear,label,key:KEY,version:1};
for(const event of ['kathleen:globalclass','kathleen:lessonmode','kathleen:classroom'])window.addEventListener(event,syncRuntime);
syncRuntime();
})();
