(()=>{const NS='http://www.w3.org/2000/svg',paths={
spark:'<path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z"/><path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z"/>',
home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9.5 20v-6h5v6"/>',
calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/>',
users:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.4-4 2.5-6 6-6s5.6 2 6 6M15 15c3.5 0 5.5 1.7 6 5"/>',
board:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4M7 14l3-3 2 2 5-5"/>',
eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
game:'<path d="M7 9h10a5 5 0 0 1 4.7 6.7l-1 2.7a2 2 0 0 1-3.2.8L15 17H9l-2.5 2.2a2 2 0 0 1-3.2-.8l-1-2.7A5 5 0 0 1 7 9Z"/><path d="M7 12v4M5 14h4M16 13h.01M19 15h.01"/>',
settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3h4a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/>'
};function svg(k){const s=document.createElementNS(NS,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.innerHTML=paths[k]||paths.spark;return s}
function replace(el,k){if(!el)return;const old=el.querySelector(':scope > i, :scope > span');if(old)old.replaceWith(svg(k));else el.prepend(svg(k))}
function init(){const nav=[['home','home'],['timetable','calendar'],['class-cockpit','users'],['classroom-board','board'],['quest-mode','spark'],['mobile-observations','eye'],['library','doc'],['tools','game'],['manage','settings']];document.querySelectorAll('.start-sidebar nav a,.start-side-bottom a').forEach(a=>{const h=a.getAttribute('href')||'',v=a.dataset.startNav||'';const hit=nav.find(([x])=>h.includes(x)||v===x);replace(a,hit?.[1]||'spark')});const brand=document.querySelector('.start-brand');if(brand)replace(brand,'spark');
 const heads=document.querySelectorAll('.start-heading');replace(heads[0],'calendar');replace(heads[1],'check');
 const map={whiteboard:'board',classes:'users',quest:'spark',observations:'eye',material:'doc',games:'game'};document.querySelectorAll('[data-start-tool]').forEach(x=>replace(x,map[x.dataset.startTool]));
 const wb=document.querySelector('.start-hero-copy a');if(wb)wb.prepend(svg('board'));const custom=document.getElementById('startCustomize');if(custom)custom.prepend(svg('settings'))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,20));else setTimeout(init,20)})();