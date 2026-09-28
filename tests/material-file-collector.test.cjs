const test=require('node:test');
const assert=require('node:assert/strict');
const Collector=require('../tools/material-file-collector/material-file-collector.js');

test('material collector keeps teaching files and rejects app files',()=>{
 for(const file of ['worksheet.pdf','test.docx','slides.pptx','marks.xlsx','photo.JPG','listening.mp3','video.mp4'])assert.equal(Collector.isMaterialFile(file),true,file);
 for(const file of ['index.html','app.js','theme.css','package.json','migration.sql','service-worker.js','program.exe','app-bundle.zip'])assert.equal(Collector.isMaterialFile(file),false,file);
 assert.equal(Collector.isMaterialFile('README.md'),false);
});

test('app folders are excluded without hiding ordinary teaching folders',()=>{
 for(const dir of ['node_modules','.git','src','dist','tools','tests','assets','supabase'])assert.equal(Collector.shouldSkipDirectory(dir,true),true,dir);
 for(const dir of ['Klasse 9','Unit 3','Grammar','Relative Clauses','Arbeitsblätter'])assert.equal(Collector.shouldSkipDirectory(dir,true),false,dir);
 assert.equal(Collector.shouldSkipDirectory('assets',false),false);
 assert.equal(Collector.shouldSkipDirectory('node_modules',false),true);
});

test('material groups are predictable',()=>{
 assert.equal(Collector.classify('book.pdf'),'Dokumente');
 assert.equal(Collector.classify('lesson.pptx'),'Präsentationen');
 assert.equal(Collector.classify('scores.csv'),'Tabellen');
 assert.equal(Collector.classify('map.png'),'Bilder');
 assert.equal(Collector.classify('dialogue.wav'),'Medien');
});
