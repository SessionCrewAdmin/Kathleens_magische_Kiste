(()=>{'use strict';
if(window.KathleenHomeGreeting)return;
function greetingFor(date=new Date()){
  const h=date.getHours();
  if(h<5)return'Gute Nacht, Kathleen.';
  if(h<11)return'Guten Morgen, Kathleen.';
  if(h<14)return'Mahlzeit, Kathleen.';
  if(h<18)return'Einen schönen Nachmittag, Kathleen.';
  return'Guten Abend, Kathleen.';
}
function render(){
  const heading=document.querySelector('.home47-hero h1');
  if(!heading)return false;
  heading.textContent=greetingFor();
  heading.dataset.dynamicGreeting='1';
  return true;
}
function init(){
  render();
  const observer=new MutationObserver(()=>render());
  const home=document.getElementById('view-home')||document.body;
  observer.observe(home,{childList:true,subtree:true});
  window.addEventListener('focus',render);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
  setInterval(render,5*60*1000);
}
window.KathleenHomeGreeting={render,greetingFor};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();