(()=>{'use strict';
const URL_BASE='https://fzqxnjhuvgpgovcovosl.supabase.co/rest/v1/rpc/';
const API_KEY='sb_publishable_GIyyWoyaQXipaA4S9OuTyQ_cZn7LUgV';
async function rpc(name,body){
 const response=await fetch(URL_BASE+name,{method:'POST',headers:{apikey:API_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw new Error(`${name} ${response.status}`);
 return response.json();
}
async function importsForChapter(chapterId){
 const value=await rpc('history_import_list',{p_chapter_id:chapterId});
 return Array.isArray(value)?value:[];
}
function merge(chapter,imports=[]){
 const topics=[...(chapter.topics||[])],sources=[...(chapter.source_inventory||[])];
 for(const item of imports){
  for(const source of item.payload?.source_inventory||[])if(!sources.some(x=>x.id===source.id))sources.push(source);
  for(const topic of item.payload?.topics||[])if(!topics.some(x=>x.id===topic.id))topics.push(topic);
 }
 return {...chapter,topics,source_inventory:sources,content_imports:imports};
}
async function loadAndMerge(chapter){
 try{return {chapter:merge(chapter,await importsForChapter(chapter.id)),available:true,error:''}}
 catch(error){return {chapter,available:false,error:error.message||String(error)}}
}
async function confirm(passphrase,payload){return rpc('history_import_confirm',{p_passphrase:passphrase,p_import:payload})}
async function rollback(passphrase,importId){return rpc('history_import_rollback',{p_passphrase:passphrase,p_import_id:importId})}
const api={importsForChapter,merge,loadAndMerge,confirm,rollback};
if(typeof window!=='undefined')window.KathleenHistoryImports=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})();
