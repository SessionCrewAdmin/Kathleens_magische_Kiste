(()=>{'use strict';
function init(){
 document.body.classList.add('kathleen-dashboard');
 const shell=document.querySelector('.shell'),home=document.getElementById('view-home');if(!shell||!home)return;
 if(!document.querySelector('.k-side')){
  const side=document.createElement('aside');side.className='k-side';side.innerHTML='<div class="k-brand"><i>✧</i><span>Kathleens<b>magische Kiste</b></span></div><div class="k-side-label">MEIN UNTERRICHT</div><nav><a class="active" href="../../#home"><span>⌂</span>Start</a><a href="tools/timetable/"><span>▦</span>Stundenplan</a><a href="tools/class-cockpit/"><span>♧</span>Meine Klassen</a><a href="tools/classroom-board/"><span>▣</span>Whiteboard</a><a href="tools/quest-mode/"><span>✧</span>Quest Mode</a><a href="tools/mobile-observations/"><span>◉</span>Beobachtungen</a><a href="#library"><span>▤</span>Material & Aufgaben</a><a href="#tools"><span>⌘</span>Quiz & Spiele</a></nav><div class="k-side-foot"><a href="#manage"><span>⚙</span>Einstellungen</a><div class="k-side-motto">Gemeinsam lernen.<br>Gemeinsam wachsen.　✦</div></div>';document.body.prepend(side)
 }
 if(!document.querySelector('.k-top')){const top=document.createElement('div');top.className='k-top';top.innerHTML='<span><strong>Meine Kiste</strong>　/　Start</span><span class="k-top-user"><span class="k-avatar">K</span>Kathleen　⌄</span>';shell.prepend(top)}
 if(!document.querySelector('.k-hero')){const hero=document.createElement('section');hero.className='k-hero';hero.innerHTML='<button class="k-customize" type="button">⚙　Startseite anpassen</button><h1>Hallo Kathleen.</h1><p>Dein Unterricht. Alles an einem Ort.</p><a class="k-whiteboard" href="tools/classroom-board/">▣　Whiteboard öffnen</a>';home.prepend(hero);hero.querySelector('.k-customize').onclick=()=>document.getElementById('homeLayoutEdit')?.click()}
 document.querySelectorAll('.k-side a[href^="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();const v=a.getAttribute('href').slice(1);document.querySelector('.nav-btn[data-view="'+v+'"]')?.click()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();