(()=>{'use strict';if(window.KathleenBuzzerArenaV3)return;window.KathleenBuzzerArenaV3=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];let locked=null,seen='';
function active(){return document.body.dataset.qgpGame==='buzzer'||$('.qg-game.active')?.dataset.game==='buzzer'}
function stage(){return $('#stage')}
function score(){const cards=$$('.qg-score',stage()||document);return{a:cards[0]?.querySelector('strong')?.textContent||'0',b:cards[1]?.querySelector('strong')?.textContent||'0'}}
function question(){const s=stage();if(!s)return{};return{q:s.querySelector('h2')?.textContent||'',a:s.querySelector('.answer')?.textContent||'',label:s.querySelector('.label')?.textContent||''}}
function round(){return ($('#roundHud')?.textContent||'Runde 1').match(/\d+/)?.[0]||'1'}
function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mount(){if(!active())return;const s=stage();if(!s)return;const q=question(),sc=score(),sig=q.q+'|'+q.a+'|'+sc.a+'|'+sc.b+'|'+round();if(s.dataset.arena==='v3'&&sig===seen)return;seen=sig;s.dataset.arena='v3';locked=null;
s.innerHTML=`<div class="bz3-arena">
<div class="bz3-lights"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
<div class="bz3-top"><span class="bz3-live"><i></i> LIVE</span><span>BUZZER BATTLE</span><span class="bz3-round">ROUND ${round()}</span></div>
<div class="bz3-screen"><div class="bz3-kicker">QUESTION ${round()}</div><div class="bz3-question">${esc(q.q)}</div><div class="bz3-answer ${q.a?'show':''}">${q.a?esc(q.a):'BUZZ IN TO ANSWER'}</div></div>
<div class="bz3-floor"></div>
<div class="bz3-podium bz3-a" data-team="A"><div class="bz3-team"><span class="bz3-avatar">A</span><div><small>TEAM</small><strong>TEAM A</strong></div></div><div class="bz3-score">${esc(sc.a)}</div><button class="bz3-buzzer" data-buzz="A" aria-label="Team A buzzern"><i></i><span>BUZZ</span></button><div class="bz3-status">READY</div></div>
<div class="bz3-versus">VS</div>
<div class="bz3-podium bz3-b" data-team="B"><div class="bz3-team"><span class="bz3-avatar">B</span><div><small>TEAM</small><strong>TEAM B</strong></div></div><div class="bz3-score">${esc(sc.b)}</div><button class="bz3-buzzer" data-buzz="B" aria-label="Team B buzzern"><i></i><span>BUZZ</span></button><div class="bz3-status">READY</div></div>
<div class="bz3-shortcuts"><span><kbd>A</kbd> Team A</span><span><kbd>L</kbd> Team B</span></div>
</div>`;
$$('[data-buzz]',s).forEach(b=>b.onclick=()=>buzz(b.dataset.buzz));}
function buzz(team){if(locked)return;locked=team;const s=stage();s?.querySelector('.bz3-arena')?.classList.add('buzzed','buzz-'+team.toLowerCase());$$('.bz3-podium',s).forEach(p=>{const own=p.dataset.team===team;p.classList.toggle('active',own);p.classList.toggle('locked',!own);p.querySelector('.bz3-status').textContent=own?'BUZZED!':'LOCKED'});try{navigator.vibrate?.([35,20,60])}catch(_){}}
function unlock(){locked=null;const s=stage();s?.querySelector('.bz3-arena')?.classList.remove('buzzed','buzz-a','buzz-b');$$('.bz3-podium',s).forEach(p=>{p.classList.remove('active','locked');const st=p.querySelector('.bz3-status');if(st)st.textContent='READY'})}
function init(){document.addEventListener('keydown',e=>{if(!active()||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;if(e.key.toLowerCase()==='a')buzz('A');if(e.key.toLowerCase()==='l')buzz('B');if(e.key==='Escape')unlock()});document.addEventListener('click',e=>{if(e.target.closest('.qg-game[data-game="buzzer"]'))setTimeout(mount,20);if(e.target.closest('#controls button'))setTimeout(()=>{seen='';mount()},30)},true);const obs=new MutationObserver(()=>{if(!active())return;requestAnimationFrame(()=>{if(stage()?.dataset.arena!=='v3'){seen='';mount()}})});const boot=()=>{const s=stage();if(s)obs.observe(s,{childList:true});mount()};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot()}
init();})();