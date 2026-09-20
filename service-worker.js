const CACHE='kathleen-v24-seating-tags-20260921';
const CORE=[
  './','./index.html','./manifest.webmanifest',
  './tools/english-world-quiz/index.html','./tools/english-world-quiz/bonus.html','./tools/homework-vouchers/index.html',
  './tools/classroom-tools-shared.js','./tools/randomizer/index.html','./tools/classroom-timer/index.html','./tools/team-generator/index.html',
  './tools/class-lists/index.html','./tools/seating-plan/index.html','./tools/schulaufgabenrechner/index.html','./tools/homework-strikes/index.html','./tools/timetable/index.html','./tools/push-center/index.html','./tools/presentation-mode.js','./tools/classroom-board/index.html','./tools/classroom-board/board.css','./tools/classroom-board/widget-framework.js','./tools/classroom-board/board-app.js','./tools/classroom-board/student.html','./tools/classroom-board/present.html','./tools/live-poll/index.html','./tools/live-poll/student.html',
  './tools/kalter-krieg/index.html','./tools/kalter-krieg/lehrer.html',
  './assets/covers/cold-war.svg','./assets/covers/english-world.svg','./assets/reveal/kathleen-welcome-desktop.webp',
  './assets/icons/app-180.png','./assets/icons/app-512.png'
];
const REMOTE=[
  'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js',
  'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs',
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json',
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(CORE.map(url=>cache.add(url)));
    await Promise.allSettled(REMOTE.map(async url=>{
      const req=new Request(url,{mode:'cors',credentials:'omit'});
      const res=await fetch(req);
      if(res.ok) await cache.put(req,res.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('kathleen-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);

  if(REMOTE.includes(url.href)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const hit=await cache.match(req,{ignoreVary:true})||await cache.match(url.href,{ignoreVary:true});
      if(hit) return hit;
      try{
        const res=await fetch(req);
        if(res && (res.ok||res.type==='opaque')) await cache.put(req,res.clone());
        return res;
      }catch(e){
        return new Response('Offline asset unavailable',{status:503,statusText:'Offline'});
      }
    })());
    return;
  }

  if(url.origin===self.location.origin && req.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        if(fresh.ok) await cache.put(req,fresh.clone());
        return fresh;
      }catch(e){
        return await cache.match(req)||await cache.match('./index.html')||Response.error();
      }
    })());
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const hit=await cache.match(req);
      if(hit) return hit;
      try{
        const res=await fetch(req);
        if(res.ok) await cache.put(req,res.clone());
        return res;
      }catch(e){
        return Response.error();
      }
    })());
  }
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch(e){data={body:event.data?.text?.()||''}}
  const title=data.title||'Kathleens Kiste';
  const options={
    body:data.body||'',
    icon:'./assets/icons/app-180.png',
    badge:'./assets/icons/app-180.png',
    tag:data.tag||'kathleen-teacher-push',
    renotify:true,
    data:{url:data.url||'./'}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const raw=event.notification?.data?.url||'./';
    const target=new URL(raw,self.registration.scope).href;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const exact=windows.find(c=>c.url===target);
    if(exact){await exact.focus();return}
    const sameOrigin=windows.find(c=>{try{return new URL(c.url).origin===new URL(target).origin}catch(e){return false}});
    if(sameOrigin&&sameOrigin.navigate){await sameOrigin.navigate(target);await sameOrigin.focus();return}
    await self.clients.openWindow(target);
  })());
});
