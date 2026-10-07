const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Extractor=require('../tools/content-extractor-core.js');
const V3=require('../tools/english-content-extractor-v3-core.js');

const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/english-extracted/schema-v1.json'),'utf8'));
function fixture(){return{format:'pdf',needsOcr:false,rawText:'Unit 1 Simple past\nComplete the sentences.\nTom ______ (go) home.',pages:[{pageIndex:1,text:'Unit 1 Simple past\nComplete the sentences.',lines:[{text:'Unit 1 Simple past',zone:'header'},{text:'Complete the sentences.',zone:'body'},{text:'Tom ______ (go) home.',zone:'body'}]},{pageIndex:2,text:'Solutions\nTom went (go) home.',lines:[{text:'Solutions',zone:'header'},{text:'Tom went (go) home.',zone:'body'}]}]}}
function inventory(){return Extractor.inventoryRecord({name:'simple-past.pdf',relativePath:'Klasse 6/Unit 1/simple-past.pdf',sha256:'a'.repeat(64),modified:Date.UTC(2026,0,1),size:123})}
function schemaErrors(value,definition=schema,root=schema,trail='$'){
 const errors=[];if(definition.$ref){const target=definition.$ref.split('/').slice(1).reduce((node,key)=>node?.[key.replace(/~1/g,'/').replace(/~0/g,'~')],root);return schemaErrors(value,target,root,trail)}
 for(const branch of definition.allOf||[])errors.push(...schemaErrors(value,branch,root,trail));
 if(definition.if){const matched=schemaErrors(value,definition.if,root,trail).length===0;if(matched&&definition.then)errors.push(...schemaErrors(value,definition.then,root,trail))}
 if(definition.anyOf&&!definition.anyOf.some(branch=>schemaErrors(value,branch,root,trail).length===0))errors.push(`${trail}: anyOf`);
 if(definition.oneOf&&definition.oneOf.filter(branch=>schemaErrors(value,branch,root,trail).length===0).length!==1)errors.push(`${trail}: oneOf`);
 if(definition.const!==undefined&&!Object.is(value,definition.const))errors.push(`${trail}: const`);
 if(definition.enum&&!definition.enum.includes(value))errors.push(`${trail}: enum`);
 const expected=definition.type==null?[]:Array.isArray(definition.type)?definition.type:[definition.type];
 const matchesType=type=>type==='null'?value===null:type==='array'?Array.isArray(value):type==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):type==='integer'?Number.isInteger(value):type==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===type;
 if(expected.length&&!expected.some(matchesType))return errors.concat(`${trail}: type ${expected.join('|')}`);
 if(typeof value==='string'){if(value.length<(definition.minLength||0))errors.push(`${trail}: minLength`);if(definition.pattern&&!new RegExp(definition.pattern).test(value))errors.push(`${trail}: pattern`);if(definition.format==='date-time'&&!Number.isFinite(Date.parse(value)))errors.push(`${trail}: date-time`)}
 if(typeof value==='number'){if(definition.minimum!==undefined&&value<definition.minimum)errors.push(`${trail}: minimum`);if(definition.maximum!==undefined&&value>definition.maximum)errors.push(`${trail}: maximum`)}
 if(Array.isArray(value)&&definition.items)value.forEach((item,index)=>errors.push(...schemaErrors(item,definition.items,root,`${trail}[${index}]`)));
 if(value&&typeof value==='object'&&!Array.isArray(value)){for(const key of definition.required||[])if(!Object.hasOwn(value,key))errors.push(`${trail}: required ${key}`);for(const [key,child]of Object.entries(definition.properties||{}))if(Object.hasOwn(value,key))errors.push(...schemaErrors(value[key],child,root,`${trail}.${key}`))}
 return errors;
}

test('schema retains the v1 identity and legacy inventory contract',()=>{
 assert.equal(schema.$id,'english-extracted-document/v1');
 assert.ok(schema.properties.schemaVersion.enum.includes('english-extracted-document/v1'));
 const legacy=inventory();
 assert.equal(legacy.schemaVersion,'english-extracted-document/v1');
 assert.deepEqual(schemaErrors(legacy),[]);
 const olderPayload={...legacy,content:{blocks:[{kind:'legacy-custom',value:7}]},provenance:{extractorVersion:'0.x',reviewedAt:'legacy timestamp'}};
 assert.deepEqual(schemaErrors(olderPayload),[],'v3-only nested constraints must not narrow the v1 payload contract');
 for(const key of schema.required)assert.ok(Object.hasOwn(legacy,key),`missing legacy ${key}`);
 assert.equal(legacy.content,null);
});

test('v3 schema documents every structure emitted by the real extractor',()=>{
 assert.ok(schema.properties.schemaVersion.enum.includes('english-extracted-document/v3'));
 const record=Extractor.extractionRecord(inventory(),fixture());
 assert.deepEqual(schemaErrors(record),[]);
 const analysis=record.content.analysisV3;
 assert.equal(record.schemaVersion,'english-extracted-document/v3');
 assert.equal(analysis.schemaVersion,'english-content-analysis/v3');
 assert.ok(schema.allOf.some(rule=>rule.then?.properties?.content?.required?.includes('analysisV3')));
 for(const key of ['sourceDocument','metadata','pages','ignored','taskGroups','tasks','warnings'])assert.ok(Object.hasOwn(schema.$defs.analysisV3.properties,key));
 for(const key of ['type','title','taskId','taskGroupId','taskType','instruction','sourceText','blocks','solution','subtasks','gaps','difficulty','confidence','fieldConfidence','sourcePages','position','reviewStatus','approvedUses','provenance'])assert.ok(Object.hasOwn(schema.$defs.contentObject.properties,key),`schema missing Content Object field ${key}`);
 for(const task of analysis.tasks){assert.ok(schema.$defs.analyzedTask.properties.type.enum.includes(task.type));assert.ok(task.id&&task.groupId);assert.ok(Array.isArray(task.subtasks)&&Array.isArray(task.gaps));}
 for(const object of record.content.objects){assert.ok(schema.$defs.contentObject.properties.type.enum.includes(object.type));assert.equal(object.reviewStatus,'needs_review');assert.ok(!object.approvedUses.includes('assessment'));}
 assert.equal(schema.$defs.analysisV3.properties.schemaVersion.const,'english-content-analysis/v3');
});

test('v3 output preserves original-local provenance and requires analysis payload',()=>{
 const record=Extractor.extractionRecord(inventory(),fixture());
 assert.equal(record.content.analysisV3.sourceDocument.originalRemainsLocal,true);
 assert.equal(record.content.analysisV3.sourceDocument.fileName,record.source.fileName);
 const missing={...record,content:{...record.content}};delete missing.content.analysisV3;
 assert.ok(schemaErrors(missing).some(error=>error.includes('required analysisV3')));
 const v3Rule=schema.allOf.find(rule=>rule.if?.properties?.schemaVersion?.const==='english-extracted-document/v3');
 assert.ok(v3Rule.then.required.includes('content'));
 assert.ok(v3Rule.then.properties.content.required.includes('analysisV3'));
 assert.equal(schemaErrors({...record,content:{...record.content,objects:[{...record.content.objects[0],type:'unknown'}]}}).some(error=>error.includes('enum')),true);
});
