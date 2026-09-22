(()=>{'use strict';
if(window.KathleenTeacherShell)return;
const script=document.currentScript,TOOLS=new URL('./',script?.src||location.href),HOME=new URL('../',TOOLS).toString();
const isMobile=()=>matchMedia('(max-width:820px)').matches;
function go(path=''){location.href=new URL(path,HOME).toString()}
function setLang(lang){
  if(window.KathleenI18n){if(lang==='auto')window.KathleenI18n.auto();else window.KathleenI18n.setLanguage(lang,true);return}
  if(lang==='auto')localStorage.removeItem('kathleenUiLanguageOverrideV1');else localStorage.setItem('kathleenUiLanguageOverrideV1',lang);
  location.reload();
}
function presentation(){
  if(window.KathleenPresentation){window.KathleenPresentation.isActive()?window.KathleenPresentation.exit():window.KathleenPresentation.enter();return}
  const s=document.createElement('script');s.src=new URL('presentation-mode.js?v=20260922-1900',TOOLS);s.onload=()=>window.KathleenPresentation?.enter?.();document.head.appendChild(s);
}
function closeMore(){document.getElementById('kTeacherMore')?.remove()}
function openMore(){
  closeMore();const d=document.createElement('div');d.id='kTeacherMore';d.className='kts-sheet';d.innerHTML='<div class="kts-card"><div class="kts-grab"></div><div class="kts-head"><div><small>LEHRERWERKZEUGE</small><h2>Mehr</h2></div><button data-close>×</button></div><div class="kts-section"><b>Sprache</b><div class="kts-lang"><button data-lang="de">🇩🇪 Deutsch</button><button data-lang="en">🇬🇧 English</button><button data-lang="auto">A Automatisch</button></div></div><div class="kts-grid"><button data-action="present">⛶<span>Präsentieren</span></button><button data-go="tools/class-cockpit/">👥<span>Klasse</span></button><button data-go="tools/classroom-board/">✨<span>Board</span></button><button data-go="tools/timetable/">🗓<span>Stundenplan</span></button></div><button class="kts-home-wide" data-home>⌂ Zur Startseite</button></div>';document.body.appendChild(d);
  d.onclick=e=>{if(e.target===d)closeMore()};d.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeMore);d.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{setLang(b.dataset.lang);closeMore()});d.querySelector('[data-action="present"]').onclick=()=>{presentation();closeMore()};d.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));d.querySelector('[data-home]').onclick=()=>go();
}
function inject(){
  if(document.getElementById('kTeacherShell'))return;
  document.documentElement.classList.add('k-teacher-shell');
  const s=document.createElement('style');s.id='kTeacherShellStyle';s.textContent=`
  .k-teacher-shell .kathleen-lang-switch,.k-teacher-shell .k-present-btn{display:none!important}
  #kTeacherShell{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:23500;display:flex;gap:6px;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  #kTeacherShell button{border:1px solid #eadde9;background:rgba(255,255,255,.96);color:#654d69;border-radius:13px;min-height:42px;padding:9px 12px;font:900 10px/1 Inter,Arial;box-shadow:0 8px 24px rgba(80,57,82,.12);backdrop-filter:blur(10px)}
  #kTeacherShell .kts-home{font-size:18px;width:44px;padding:0}
  .kts-sheet{position:fixed;inset:0;z-index:29000;display:flex;align-items:flex-end;justify-content:center;background:rgba(62,44,64,.38);backdrop-filter:blur(9px);font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .kts-card{width:min(520px,100%);max-height:88dvh;overflow:auto;background:#fff;color:#58455b;border-radius:24px 24px 0 0;padding:10px 15px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -20px 70px rgba(70,46,72,.2)}
  .kts-grab{width:42px;height:4px;border-radius:99px;background:#e1d4e0;margin:0 auto 12px}.kts-head{display:flex;align-items:center;justify-content:space-between}.kts-head small{font-size:8px;font-weight:950;letter-spacing:.1em;color:#9d899f}.kts-head h2{margin:3px 0 0;font-size:22px}.kts-head>button{width:40px;height:40px;border:0;border-radius:50%;background:#f6eef5;color:#705873;font-size:22px}
  .kts-section{margin:18px 0 12px}.kts-section>b{display:block;font-size:10px;margin-bottom:7px}.kts-lang{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.kts-lang button,.kts-grid button,.kts-home-wide{border:1px solid #eadde9;background:#fffafd;color:#644f67;border-radius:13px;min-height:48px;font-weight:900}
  .kts-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kts-grid button{display:flex;align-items:center;gap:8px;padding:11px;text-align:left;font-size:18px}.kts-grid span{font-size:10px}.kts-home-wide{width:100%;margin-top:12px;background:#725778;color:#fff;border:0}
  .kts-mobile-nav{display:none}
  @media(max-width:820px){
    html.k-teacher-shell body{padding-bottom:calc(82px + env(safe-area-inset-bottom))!important}
    #kTeacherShell{display:none}
    .kts-mobile-nav{display:grid!important;position:fixed;left:8px;right:8px;bottom:calc(7px + env(safe-area-inset-bottom));z-index:26000;grid-template-columns:repeat(4,1fr);gap:3px;padding:5px;border:1px solid #eadde9;border-radius:19px;background:rgba(255,255,255,.96);box-shadow:0 14px 40px rgba(80,57,82,.18);backdrop-filter:blur(14px);font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .kts-mobile-nav button{min-height:52px;border:0;background:transparent;color:#7c687e;border-radius:14px;font-size:19px;font-weight:900}.kts-mobile-nav button span{display:block;margin-top:3px;font-size:7px;letter-spacing:.03em}.kts-mobile-nav .home{background:#f4eaf3;color:#654d69}
  }`;document.head.appendChild(s);
  const d=document.createElement('div');d.id='kTeacherShell';d.innerHTML='<button class="kts-home" title="Startseite">⌂</button><button class="kts-more">••• Mehr</button>';document.body.appendChild(d);d.querySelector('.kts-home').onclick=()=>go();d.querySelector('.kts-more').onclick=openMore;
  const nav=document.createElement('nav');nav.className='kts-mobile-nav';nav.innerHTML='<button class="home" data-home>⌂<span>Start</span></button><button data-go="tools/classroom-board/">✨<span>Board</span></button><button data-go="tools/class-cockpit/">👥<span>Klasse</span></button><button data-more>•••<span>Mehr</span></button>';document.body.appendChild(nav);nav.querySelector('[data-home]').onclick=()=>go();nav.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));nav.querySelector('[data-more]').onclick=openMore;
}
window.KathleenTeacherShell={home:()=>go(),more:openMore,presentation,setLanguage:setLang};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();