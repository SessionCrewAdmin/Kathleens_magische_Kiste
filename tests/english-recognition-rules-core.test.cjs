const test=require('node:test');
const assert=require('node:assert/strict');
const Rules=require('../tools/english-recognition-rules-core.js');

test('confirmed mapping rules apply transparently to matching files',()=>{const rule=Rules.suggestion('grade',6,{fileName:'Access 6 Unit 1.pdf'}),result=Rules.apply({fileName:'Access 6 Unit 1 worksheet.pdf',rawText:'Simple past'},[rule]);assert.equal(result.classification.grade,6);assert.deepEqual(result.matches,[rule.id])});
test('disabled rules and invalid rules never alter an analysis',()=>{const result=Rules.apply({fileName:'Access 6.pdf',rawText:'footer'},[{kind:'mapping',pattern:'Access 6',field:'grade',value:6,enabled:false},{kind:'mapping',pattern:'',field:'unit',value:1}]);assert.deepEqual(result.classification,{});assert.equal(result.matches.length,0)});
test('ignore rules remove only the explicitly matched text and remain auditable',()=>{const rule=Rules.normalize({id:'footer',label:'Lernwolf-Fußtext',kind:'ignore_text',pattern:'Weitere anspruchsvolle Proben[^\\n]*',enabled:true}),result=Rules.apply({rawText:'Task one\nWeitere anspruchsvolle Proben auf Lernwolf\nTask two'},[rule]);assert.match(result.rawText,/Task one/);assert.doesNotMatch(result.rawText,/Lernwolf/);assert.equal(result.ignored[0].ruleId,'footer')});
