(()=>{
'use strict';
const ENDPOINT='https://fzqxnjhuvgpgovcovosl.supabase.co/functions/v1/canva-connect';
const KEY='sb_publishable_GIyyWoyaQXipaA4S9OuTyQ_cZn7LUgV',SESSION='kathleenCanvaSession';
let dialog,target=null,busy=false,continuation=null,popup=null,popupTimer=null,controller=null,awaitingCanva=false;
const $=selector=>dialog.querySelector(selector);
const message=text=>{$('.canvaStatus').textContent=text;};
const setBusy=value=>{busy=value;dialog.querySelectorAll('button:not([data-close])').forEach(b=>b.disabled=value);};
async function api(action,body={},binary=false){
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,'x-canva-session':sessionStorage.getItem(SESSION)||''},body:JSON.stringify({action,...body}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])});
  if(!response.ok){let error;try{error=await response.json();}catch{}if(response.status===401){sessionStorage.removeItem(SESSION);$('.canvaConnect').hidden=false;$('.canvaDisconnect').hidden=true;}throw Error(error?.error||(response.status===404?'Die Canva-Anbindung muss noch einmalig eingerichtet werden.':'Canva ist momentan nicht erreichbar.'));}
  return binary?response.arrayBuffer():response.json();
}
function fail(error){if(error.name!=='AbortError' && dialog.open)message(error.message||'Canva konnte nicht geladen werden.');}
function resetPopup(){clearInterval(popupTimer);popupTimer=null;try{popup?.close();}catch{}popup=null;}
function closeLibrary(){controller?.abort();resetPopup();if(awaitingCanva){awaitingCanva=false;setBusy(false);}dialog.close();}
function createDialog(){
  dialog=document.createElement('dialog');dialog.className='canvaLibrary';dialog.setAttribute('aria-labelledby','canvaLibraryTitle');
  dialog.innerHTML=`<header><h2 id="canvaLibraryTitle">Canva fürs Whiteboard</h2><button type="button" data-close aria-label="Canva-Auswahl schließen">✕</button></header><p>Verbinde dein Konto und wähle eine Präsentation oder ein anderes Canva-Design aus.</p><div class="canvaAccountActions"><button type="button" class="canvaConnect">Canva-Konto verbinden</button><button type="button" class="canvaDisconnect" hidden>Verbindung trennen</button></div><form class="canvaSearch" hidden><input name="query" type="search" maxlength="255" aria-label="Canva-Designs suchen" placeholder="Präsentationen und Designs suchen"><button type="submit">Suchen</button></form><p class="canvaStatus" role="status" aria-live="polite"></p><div class="canvaSetup" hidden>Die Canva-Verbindung ist noch nicht freigeschaltet. Die einmalige Einrichtung erfolgt über <a href="../../docs/canva-setup.md" target="_blank" rel="noopener">die Einrichtungsanleitung</a>.</div><div class="canvaDesignGrid"></div><button type="button" class="canvaMore" hidden>Weitere Designs laden</button><p class="canvaImportNote">Die Folien werden als Bilder im Board gespeichert und an verbundene Beamer- und Schüleransichten übertragen. Animationen, Videos und Links sind im Import nicht aktiv. Änderungen in Canva über „Ersetzen / aktualisieren“ neu importieren. Maximal 60 Folien und 8 MB importierte Bilder.</p>`;
  document.body.append(dialog);
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  $('[data-close]').onclick=closeLibrary;
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeLibrary();});
  $('.canvaConnect').onclick=connect;
  $('.canvaDisconnect').onclick=async()=>{if(busy)return;setBusy(true);try{await api('disconnect');sessionStorage.removeItem(SESSION);$('.canvaDesignGrid').replaceChildren();$('.canvaSearch').hidden=true;$('.canvaMore').hidden=true;$('.canvaDisconnect').hidden=true;$('.canvaConnect').hidden=false;message('Verbindung getrennt. Bereits importierte Folien bleiben im Board.');}catch(e){fail(e);}finally{setBusy(false);}};
  $('.canvaSearch').onsubmit=e=>{e.preventDefault();if(!busy)loadDesigns(false);};
  $('.canvaMore').onclick=()=>{if(!busy)loadDesigns(true);};
}
async function open(element=null){
  if(!dialog)createDialog();if(dialog.open||busy)return;
  target=element;controller=new AbortController();$('.canvaDesignGrid').replaceChildren();$('.canvaMore').hidden=true;$('.canvaSetup').hidden=true;$('.canvaSearch').hidden=true;$('.canvaDisconnect').hidden=true;$('.canvaConnect').hidden=false;dialog.showModal();setBusy(true);message('Canva-Verbindung wird geprüft …');
  try{await api('config');const status=sessionStorage.getItem(SESSION)?await api('status'):{connected:false};if(status.connected){$('.canvaConnect').hidden=true;$('.canvaDisconnect').hidden=false;await loadDesigns(false);}else message('Verbinde dein Canva-Konto, um deine Designs auszuwählen.');}catch(e){fail(e);if(!sessionStorage.getItem(SESSION))$('.canvaSetup').hidden=false;}finally{setBusy(false);}
}
async function connect(){
  if(busy)return;const passphrase=sessionStorage.getItem('kathleenAdminPass')||prompt('Kisten-Adminpasswort für die Canva-Verbindung');if(!passphrase)return;
  popup=window.open('about:blank','kathleen-canva-connect','popup,width=640,height=760');
  if(!popup){message('Bitte Pop-ups für diese Seite erlauben und erneut auf „Canva-Konto verbinden“ klicken.');return;}
  setBusy(true);message('Bitte die Verbindung im Canva-Fenster bestätigen.');
  try{const data=await api('connect',{passphrase});sessionStorage.setItem(SESSION,data.session);popup.location.href=data.url;awaitingCanva=true;popupTimer=setInterval(()=>{if(popup?.closed){awaitingCanva=false;resetPopup();setBusy(false);message('Canva-Fenster geschlossen. Du kannst die Verbindung erneut starten.');}},600);}catch(e){resetPopup();setBusy(false);fail(e);}
}
window.addEventListener('message',async e=>{
  if(!dialog?.open || e.origin!==location.origin || e.source!==popup || e.data?.type!=='kathleen:canva-callback')return;
  clearInterval(popupTimer);popupTimer=null;awaitingCanva=false;
  try{if(e.data.error)throw Error('Die Canva-Anmeldung wurde abgebrochen.');await api('callback',{code:e.data.code,state:e.data.state});resetPopup();$('.canvaConnect').hidden=true;$('.canvaDisconnect').hidden=false;await loadDesigns(false);}catch(error){resetPopup();fail(error);}finally{setBusy(false);}
});
async function loadDesigns(more){
  setBusy(true);message('Deine Canva-Designs werden geladen …');
  try{
    const data=await api('designs',{query:$('.canvaSearch input').value,continuation:more?continuation:null});
    if(!more)$('.canvaDesignGrid').replaceChildren();continuation=data.continuation;
    for(const design of data.items||[]){const button=document.createElement('button');button.type='button';button.className='canvaDesignCard';const title=document.createElement('strong');title.textContent=design.title;button.append(title);try{const url=new URL(design.thumbnail);if(url.protocol==='https:'){const img=document.createElement('img');img.src=url.href;img.alt='';img.loading='lazy';button.prepend(img);}}catch{}const note=document.createElement('small');note.textContent='Als Folien aufs Whiteboard';button.append(note);button.onclick=()=>{if(!busy)importDesign(design);};$('.canvaDesignGrid').append(button);}
    $('.canvaSearch').hidden=false;$('.canvaMore').hidden=!continuation;message($('.canvaDesignGrid').children.length?'Wähle ein Design zum Importieren.':'Keine passenden Designs gefunden.');
  }catch(e){fail(e);}finally{setBusy(false);}
}
async function importDesign(design){
  setBusy(true);let pdf;
  try{
    message('Canva bereitet die Folien vor …');const {jobId}=await api('export',{designId:design.id});let ready=false;
    for(let n=0;n<60;n++){const result=await api('export-status',{jobId});if(result.status==='success'){ready=true;break;}await new Promise((resolve,reject)=>{const signal=controller.signal;if(signal.aborted)return reject(new DOMException('Abgebrochen','AbortError'));const cancel=()=>{clearTimeout(id);reject(new DOMException('Abgebrochen','AbortError'));};const id=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},1500);signal.addEventListener('abort',cancel,{once:true});});}
    if(!ready)throw Error('Canva benötigt länger als erwartet. Bitte den Import erneut starten.');
    const bytes=await api('download',{jobId},true);
    const lib=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
    pdf=await lib.getDocument({data:bytes,isEvalSupported:false}).promise;
    if(pdf.numPages>60)throw Error('Bitte in Canva eine kürzere Präsentation erstellen: maximal 60 Folien pro Import.');
    const slides=[];let size=0;
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
      if(controller.signal.aborted)throw new DOMException('Abgebrochen','AbortError');message(`Folie ${pageNumber} von ${pdf.numPages} wird importiert …`);
      const page=await pdf.getPage(pageNumber),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,1440/Math.max(base.width,base.height))}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;const src=canvas.toDataURL('image/jpeg',.82);size+=src.length;
      if(size>8*1024*1024)throw Error('Die importierten Folien sind größer als 8 MB. Bitte das Design in kleinere Präsentationen teilen.');slides.push(src);canvas.width=canvas.height=0;page.cleanup();
    }
    if(controller.signal.aborted)throw new DOMException('Abgebrochen','AbortError');
    const widgetData={title:design.title,designId:design.id,slides,page:0,importedAt:new Date().toISOString()};
    if(target?.isConnected)window.KathleenWidgetHost.replaceCanva(target,widgetData);else window.KathleenWidgetHost.add('canva',{widgetData});
    // Wait for durable storage before reporting success or leaving the picker.
    if(!await window.KathleenWidgetHost.save())throw Error('Die Folien sind auf dem Board, konnten aber nicht gespeichert werden. Bitte den Boardspeicher prüfen.');
    closeLibrary();
  }catch(e){fail(e);}finally{try{await pdf?.destroy();}catch{}setBusy(false);}
}
window.KathleenCanva=Object.freeze({open});
})();
