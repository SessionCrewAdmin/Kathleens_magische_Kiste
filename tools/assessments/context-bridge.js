(()=>{'use strict';
function sync(){try{const subject=document.getElementById('subject')?.value,grade=Number(document.getElementById('grade')?.value),unit=document.getElementById('unit')?.value;window.KathleenTeachingContext?.set?.({subject,grade,unit:unit?.startsWith('local:')?'':unit||'',source:'assessments'})}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('#subject,#grade,#unit').forEach(node=>node.addEventListener('change',()=>setTimeout(sync,0)));setTimeout(sync,0)},{once:true});else{document.querySelectorAll('#subject,#grade,#unit').forEach(node=>node.addEventListener('change',()=>setTimeout(sync,0)));setTimeout(sync,0)}
})();
