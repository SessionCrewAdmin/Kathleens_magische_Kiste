(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KathleenEnglishRecognitionRulesCore=api})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const KINDS=['mapping','ignore_text','solution_page'];
const FIELDS=['grade','unit','topic','section','text'];
function text(value){return String(value??'').trim()}
function escapeRegExp(value){return text(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function normalize(rule={}){return{id:text(rule.id)||`rule-${Date.now().toString(36)}`,label:text(rule.label)||'Lokale Erkennungsregel',kind:KINDS.includes(rule.kind)?rule.kind:'mapping',pattern:text(rule.pattern),field:FIELDS.includes(rule.field)?rule.field:'topic',value:rule.value??'',enabled:rule.enabled!==false,createdAt:rule.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),source:'local-confirmed'} }
function valid(rule={}){const item=normalize(rule),errors=[];if(item.pattern.length<2)errors.push('Das Erkennungsmuster muss mindestens zwei Zeichen enthalten.');if(item.kind==='mapping'&&!text(item.value))errors.push('Für eine Zuordnung fehlt der Zielwert.');if(item.kind==='mapping'&&!FIELDS.includes(item.field))errors.push('Das Zielfeld ist ungültig.');return{valid:errors.length===0,errors,rule:item}}
function matches(rule,context={}){if(rule.enabled===false||!text(rule.pattern))return false;const hay=[context.fileName,context.relativePath,context.rawText].map(text).join('\n');try{return new RegExp(rule.pattern,'i').test(hay)}catch{return hay.toLocaleLowerCase('de').includes(text(rule.pattern).toLocaleLowerCase('de'))}}
function apply(records={},rules=[]){const result={classification:{...(records.classification||{})},rawText:String(records.rawText||''),matches:[],ignored:[]};for(const raw of rules){const check=valid(raw);if(!check.valid||!matches(check.rule,records))continue;const rule=check.rule;result.matches.push(rule.id);if(rule.kind==='mapping'){const value=rule.field==='grade'?Number(rule.value):rule.value;result.classification[rule.field]=value}else if(rule.kind==='ignore_text'){let expression;try{expression=new RegExp(rule.pattern,'gim')}catch{expression=new RegExp(escapeRegExp(rule.pattern),'gim')}const removed=result.rawText.match(expression)||[];result.rawText=result.rawText.replace(expression,' ').replace(/\n{3,}/g,'\n\n').trim();result.ignored.push(...removed.map(value=>({ruleId:rule.id,text:value})))}}
 return result
}
function suggestion(field,value,source={}){const name=text(source.fileName).replace(/\.[^.]+$/,'');const significant=(name.match(/(?:access|green[ _-]*line|red[ _-]*line|unit|klasse)[ _-]*[a-z0-9]+/i)||[])[0]||name.split(/[_\- ]+/).filter(x=>x.length>2).slice(0,3).join(' ');return normalize({label:`${significant||'Dateiname'} → ${field} ${value}`,kind:'mapping',pattern:escapeRegExp(significant||name),field,value})}
return{KINDS,FIELDS,normalize,valid,matches,apply,suggestion,escapeRegExp};
});
