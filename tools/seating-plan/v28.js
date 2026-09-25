(()=>{'use strict';
if(window.KathleenSeatingV28)return;window.KathleenSeatingV28=true;
let scheduled=false;
function apply(){scheduled=false;const room=document.querySelector('.room');if(room)room.classList.add('v28-teacher-view');document.querySelectorAll('.seatName').forEach(el=>{const n=(el.textContent||'').trim().length;el.classList.toggle('v28-long',n>15&&n<=22);el.classList.toggle('v28-xlong',n>22)})}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply)}
function boot(){apply();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();