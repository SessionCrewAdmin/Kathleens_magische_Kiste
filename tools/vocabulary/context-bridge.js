(()=>{'use strict';
function sync(){try{const grade=document.querySelector('[data-grade].active')?.dataset.grade,unit=document.getElementById('unit')?.value;window.KathleenTeachingContext?.set?.({subject:'Englisch',grade:Number(grade),unit:unit==='all'?'':unit,source:'vocabulary-studio'})}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-grade],#unit').forEach(node=>node.addEventListener('change',sync));sync()},{once:true});else{document.querySelectorAll('[data-grade],#unit').forEach(node=>node.addEventListener('change',sync));sync()}
})();
