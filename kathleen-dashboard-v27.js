(()=>{'use strict';
const $=s=>document.querySelector(s);
function icon(t){return '<span class="k-icon">'+t+'</span>'}
function init(){
 document.body.classList.add('k-exact');
 const shell=$('.shell'),home=$('#view-home');if(!shell||!home)return;
 // Remove previous injected approximation and build the reference shell.
 document.querySelector('.k-side')?.remove();document.querySelector('.k-top')?.remove();document.querySelector('.k-hero')?.remove();
 const side=document.createElement('aside');side.className='kx-side';side.innerHTML=
 '<a class="kx-brand" href="#home"><b>✦</b><span>Kathleens<strong>magische Kiste</strong></span></a>'+
 '<div class="kx-label">MEIN UNTERRICHT</div><nav>'+
 '<a class="active" data-kview="home">'+icon('⌂')+'Start</a>'+
 '<a href="tools/timetable/">'+icon('▦')+'Stundenplan</a>'+
 '<a href="tools/class-cockpit/">'+icon('♧')+'Meine Klassen</a>'+
 '<a href="tools/classroom-board/">'+icon('▣')+'Whiteboard</a>'+
 '<a href="tools/quest-mode/">'+icon('✦')+'Quest Mode</a>'+
 '<a href="tools/mobile-observations/">'+icon('◉')+'Beobachtungen</a>'+
 '<a data-kview="library">'+icon('▤')+'Material & Aufgaben</a>'+
 '<a data-kview="tools">'+icon('⌘')+'Quiz & Spiele</a></nav>'+
 '<div class="kx-bottom"><a data-kview="manage">'+icon('⚙')+'Einstellungen</a><small>Gemeinsam lernen.<br>Gemeinsam wachsen.</small><i>✦ ✧</i></div>';
 document.body.prepend(side);
 const top=document.createElement('header');top.className='kx-top';top.innerHTML='<div><strong>Meine Kiste</strong><span>/</span><b>Start</b></div><div class="kx-top-actions"><label>⌕ <input placeholder="In deiner Kiste suchen..."></label><em></em><span class="kx-avatar">K</span><b>Kathleen⌄</b><button>Layoutvorschau</button></div>';shell.prepend(top);
 const hero=document.createElement('section');hero.className='kx-hero';hero.innerHTML='<div class="kx-hero-art" aria-hidden="true"><span class="mountains">⌁⌁⌁</span><span class="castle">♜</span></div><button class="kx-custom">⚙　Startseite anpassen</button><div class="kx-hero-copy"><h1>Hallo Kathleen.</h1><p>Dein Unterricht. Alles an einem Ort.</p><a href="tools/classroom-board/">▣　Whiteboard öffnen</a></div>';home.prepend(hero);
 // Turn existing workbench into exact two-card middle row.
 const work=$('.home-workbench');if(work){
   const cards=work.querySelectorAll('.home-widget');
   if(cards[0]){cards[0].classList.add('kx-schedule');const head=cards[0].querySelector('.home-widget-head');if(head)head.innerHTML='<div class="kx-card-title"><span>▦</span><div><h2>Dein Stundenplan</h2><small>Dein Tag auf einen Blick.</small></div></div><div class="kx-schedule-tabs"><button class="active">Heute</button><button>Woche</button><a href="tools/timetable/">▦　Vorschau</a><b>⚑</b></div>'}
   if(cards[1]){cards[1].classList.add('kx-todos');const head=cards[1].querySelector('.home-widget-head');if(head)head.innerHTML='<div class="kx-card-title"><span>✓</span><div><h2>Deine To-dos</h2><h3>Heute im Blick</h3><small>Behalte deine Aufgaben im Blick und starte entspannt in den Tag.</small></div></div><div class="kx-example">Beispielansicht　⚑</div>';const add=cards[1].querySelector('.todo-add');if(add){add.querySelector('input').placeholder='Aufgabe hinzufügen';add.querySelector('button').textContent='＋  Aufgabe hinzufügen'}}
 }
 // Build exact bottom tile panel using real destinations.
 let exact=$('#kxTools');if(!exact){exact=document.createElement('section');exact.id='kxTools';exact.className='kx-tools';exact.innerHTML='<div class="kx-tools-head"><span>✦</span><div><h2>Deine Kiste, wie du sie brauchst</h2><p>Werkzeuge hinzufügen und nach Wunsch anordnen.</p></div></div><div class="kx-toolgrid">'+
 tile('purple','▣','Whiteboard','Gemeinsam gestalten<br>und Ideen sammeln.','tools/classroom-board/')+
 tile('green','♧','Meine Klassen','Übersicht, Notizen<br>und Materialien.','tools/class-cockpit/')+
 tile('pink','✦','Quest Mode','Motivation und<br>Abwechslung im Unterricht.','tools/quest-mode/')+
 tile('yellow','◉','Beobachtungen','Entwicklungen festhalten<br>und sichtbar machen.','tools/mobile-observations/')+
 tile('blue','▤','Material & Aufgaben','Alles, was du für deinen<br>Unterricht brauchst.','#library','library')+
 tile('peach','⚄','Quiz & Spiele','Spielerisch lernen<br>und wiederholen.','#tools','tools')+
 '<button class="kx-add"><span>＋</span><b>Bereich hinzufügen</b><small>Eigene Werkzeuge<br>ergänzen und anordnen.</small></button></div>';home.appendChild(exact)}
 // Hide old home-only blocks that are not in the approved reference.
 ['#nextLessonCard','#questBetaCard','.dashboard-grid.v21','.board-home-card','.subject-launchers'].forEach(s=>{const e=$(s);if(e)e.classList.add('kx-hidden')});
 const oldKicker=[...home.querySelectorAll(':scope > .view-kicker')];oldKicker.forEach(e=>e.classList.add('kx-hidden'));
 hero.querySelector('.kx-custom').onclick=()=>document.getElementById('homeLayoutEdit')?.click();
 document.querySelectorAll('[data-kview]').forEach(a=>a.onclick=e=>{e.preventDefault();document.querySelector('.nav-btn[data-view="'+a.dataset.kview+'"]')?.click()});
 top.querySelector('input').oninput=e=>{const search=$('#search');if(search){search.value=e.target.value;search.dispatchEvent(new Event('input'));if(e.target.value.trim())document.querySelector('.nav-btn[data-view="library"]')?.click()}};
}
function tile(cls,ico,title,sub,href,view){return '<a class="kx-tool '+cls+'" href="'+href+'" '+(view?'data-kview="'+view+'"':'')+'><span class="kx-tool-ico">'+ico+'</span><span><b>'+title+'</b><small>'+sub+'</small></span><i>⋮</i><em>›</em></a>'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();