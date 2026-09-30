const test=require('node:test');
const assert=require('node:assert/strict');
const ImageCore=require('../tools/english-image-preprocess-core.js');

function image(width,height,quad){const data=new Uint8ClampedArray(width*height*4);for(let i=0;i<data.length;i+=4){data[i]=data[i+1]=data[i+2]=35;data[i+3]=255}for(let y=quad.top;y<=quad.bottom;y++){const t=(y-quad.top)/(quad.bottom-quad.top),left=Math.round(quad.leftTop+(quad.leftBottom-quad.leftTop)*t),right=Math.round(quad.rightTop+(quad.rightBottom-quad.rightTop)*t);for(let x=left;x<=right;x++){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=238;data[i+3]=255}}return data}
test('detects a photographed worksheet and its perspective',()=>{const data=image(1000,1400,{top:100,bottom:1320,leftTop:150,leftBottom:80,rightTop:850,rightBottom:930}),result=ImageCore.detectPageQuad(data,1000,1400);assert.equal(result.found,true);assert.ok(result.confidence>.55);assert.ok(result.perspective>.08);assert.ok(result.output.width>650);assert.ok(result.output.height>1100)});
test('warns when no page or a cropped edge can be identified',()=>{const dark=new Uint8ClampedArray(400*600*4).fill(20),missing=ImageCore.detectPageQuad(dark,400,600);assert.equal(missing.found,false);assert.match(ImageCore.qualityWarnings({mean:20,sharpness:2},missing).join(' '),/dunkel|Seitenrand/)});
test('bilinear mapping keeps destination corners attached to detected corners',()=>{const quad=[{x:10,y:20},{x:90,y:15},{x:95,y:120},{x:5,y:110}];assert.deepEqual(ImageCore.mapBilinear(quad,0,0),quad[0]);assert.deepEqual(ImageCore.mapBilinear(quad,1,1),quad[2])});
