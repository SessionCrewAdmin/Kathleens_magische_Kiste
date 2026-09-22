const API = 'https://api.canva.com/rest/v1/';
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const unb64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const url64 = bytes => b64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const digest = async text => url64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))));
const random = () => url64(crypto.getRandomValues(new Uint8Array(48)));
class Failure extends Error { constructor(message, status=400) { super(message); this.status=status; } }
export async function encrypt(value, secret) {
  const key = await crypto.subtle.importKey('raw',unb64(secret),'AES-GCM',false,['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(value)));
  return {iv:b64(iv),body:b64(new Uint8Array(body))};
}
export async function decrypt(value, secret) {
  const key = await crypto.subtle.importKey('raw',unb64(secret),'AES-GCM',false,['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(value.iv)},key,unb64(value.body))));
}
export function createHandler({store,env,fetch:request}) {
  return async req => {
    const redirect = env('CANVA_REDIRECT_URI') || '';
    let origin=''; try { origin=new URL(redirect).origin; } catch {}
    const headers = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type, apikey, x-canva-session','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
    const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json'}});
    if (!origin || req.headers.get('Origin') !== origin) return json({error:'Diese Herkunft ist nicht freigeschaltet.'},403);
    if (req.method==='OPTIONS') return new Response(null,{status:204,headers});
    if (req.method!=='POST') return json({error:'POST erforderlich.'},405);
    let locked='';
    try {
      const client=env('CANVA_CLIENT_ID'),secret=env('CANVA_CLIENT_SECRET'),key=env('CANVA_TOKEN_KEY');
      if (!client || !secret || !key || unb64(key).length!==32) throw new Failure('Die Canva-Anbindung muss noch einmalig eingerichtet werden.',503);
      if (Number(req.headers.get('content-length'))>16000) throw new Failure('Anfrage zu groß.',413);
      const raw=await req.text(); if(raw.length>16000) throw new Failure('Anfrage zu groß.',413);
      let input; try { input=JSON.parse(raw); } catch { throw new Failure('Ungültige Anfrage.'); }
      const {action}=input || {};
      if(action==='config') return json({ready:true});
      const call = async (path,options={}) => {
        const response=await request(API+path,{...options,signal:AbortSignal.timeout(20000)});
        if (!response.ok) {
          if(path==='oauth/token' && response.status===400){const detail=await response.json().catch(()=>({}));if(detail.error==='invalid_grant')throw new Failure('Die Canva-Verbindung ist abgelaufen. Bitte das Konto erneut verbinden.',401);}
          if(response.status===429) throw new Failure('Canva ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.',429);
          if(response.status===401 || response.status===403) throw new Failure('Canva-Zugriff abgelaufen oder nicht erlaubt. Bitte das Konto erneut verbinden.',401);
          throw new Failure('Canva konnte die Anfrage nicht ausführen. Bitte erneut versuchen.',502);
        }
        return response.json();
      };
      const token = async params => call('oauth/token',{method:'POST',headers:{Authorization:'Basic '+btoa(client+':'+secret),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
      if(action==='connect') {
        if(typeof input.passphrase!=='string' || !await store.authenticate(input.passphrase)) throw new Failure('Das Kisten-Adminpasswort ist nicht korrekt.',403);
        const session=random(),hash=await digest(session),state=random(),verifier=random(),now=Date.now();
        await store.cleanup(now);
        await store.insert({token_hash:hash,expires_at:now+8*3600000,lock_until:0,state_hash:await digest(state),verifier,pending_until:now+10*60000,credentials:null,export_id:null});
        const url=new URL('https://www.canva.com/api/oauth/authorize');
        url.search=new URLSearchParams({response_type:'code',client_id:client,redirect_uri:redirect,scope:'design:meta:read design:content:read',state,code_challenge:await digest(verifier),code_challenge_method:'s256'}).toString();
        return json({session,url:url.href});
      }
      const session=req.headers.get('x-canva-session') || '';
      if(!/^[A-Za-z0-9_-]{64}$/.test(session)) throw new Failure('Bitte Canva verbinden.',401);
      const hash=await digest(session); let row=await store.get(hash);
      if(!row || row.expires_at<=Date.now()) throw new Failure('Die Verbindung ist abgelaufen. Bitte Canva erneut verbinden.',401);
      if(action==='status') return json({connected:!!row.credentials});
      if(!await store.lock(hash,Date.now())) throw new Failure('Canva wird gerade geladen. Bitte kurz warten.',409);
      locked=hash; row=await store.get(hash);
      if(!row || row.expires_at<=Date.now()) throw new Failure('Die Verbindung ist abgelaufen.',401);
      const saveTokens = async data => {
        if(!data.access_token || !data.refresh_token || !Number(data.expires_in)) throw new Failure('Canva hat keine gültige Verbindung geliefert.',502);
        const tokens={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+Number(data.expires_in)*1000};
        await store.update(hash,{credentials:await encrypt(tokens,key)}); return tokens;
      };
      if(action==='callback') {
        if(typeof input.state!=='string' || typeof input.code!=='string' || !input.code || !row.state_hash || row.pending_until<Date.now() || await digest(input.state)!==row.state_hash) throw new Failure('Die Canva-Anmeldung ist abgelaufen oder ungültig. Bitte erneut verbinden.');
        await store.update(hash,{state_hash:null,verifier:null,pending_until:null});
        await saveTokens(await token({grant_type:'authorization_code',code:input.code,code_verifier:row.verifier,redirect_uri:redirect}));
        return json({connected:true});
      }
      if(action==='disconnect') {
        // Revoke first: retain the local connection if Canva is temporarily unreachable.
        if(row.credentials) { const data=await decrypt(row.credentials,key); const result=await request(API+'oauth/revoke',{method:'POST',headers:{Authorization:'Basic '+btoa(client+':'+secret),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:data.refresh_token}),signal:AbortSignal.timeout(20000)}); if(!result.ok && result.status!==401) throw new Failure('Canva konnte die Verbindung noch nicht trennen. Bitte erneut versuchen.',502); }
        await store.remove(hash); return json({connected:false});
      }
      if(!row.credentials) throw new Failure('Bitte die Anmeldung bei Canva abschließen.',401);
      let tokens=await decrypt(row.credentials,key);
      if(tokens.expires_at<Date.now()+60000) tokens=await saveTokens(await token({grant_type:'refresh_token',refresh_token:tokens.refresh_token}));
      const auth={Authorization:'Bearer '+tokens.access_token};
      if(action==='designs') {
        const params=new URLSearchParams({limit:'24',sort_by:'modified_descending'});
        if(input.query) params.set('query',String(input.query).slice(0,255));
        if(input.continuation) params.set('continuation',String(input.continuation).slice(0,4096));
        const data=await call('designs?'+params,{headers:auth});
        // Private, temporary view/edit URLs never enter a shared board.
        return json({items:(data.items||[]).map(d=>({id:d.id,title:d.title||'Unbenanntes Design',thumbnail:d.thumbnail?.url||'',pageCount:d.page_count||null})),continuation:data.continuation||null});
      }
      if(action==='export') {
        if(!/^[A-Za-z0-9_-]{1,100}$/.test(input.designId||'')) throw new Failure('Ungültiges Design.');
        const data=await call('exports',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({design_id:input.designId,format:{type:'pdf',export_quality:'regular'}})});
        if(!data.job?.id) throw new Failure('Canva konnte den Export nicht starten.',502);
        await store.update(hash,{export_id:data.job.id}); return json({jobId:data.job.id});
      }
      if(action==='export-status' || action==='download') {
        if(!row.export_id || input.jobId!==row.export_id) throw new Failure('Dieser Import gehört nicht zu deiner Verbindung.',403);
        const data=await call('exports/'+encodeURIComponent(row.export_id),{headers:auth}),job=data.job;
        if(job?.status==='failed') throw new Failure('Dieses Design lässt sich nicht als Folien importieren. Prüfe in Canva die Exportrechte und eventuell verwendete Premium-Inhalte.',422);
        if(action==='export-status') return json({status:job?.status||'in_progress'});
        if(job?.status!=='success' || !job.urls?.[0]) throw new Failure('Der Canva-Export ist noch nicht fertig.',409);
        const url=new URL(job.urls[0]); if(url.protocol!=='https:') throw new Failure('Ungültiger Export.',502);
        // URL comes exclusively from the authenticated Canva job, never from browser input.
        const download=await request(url.href,{redirect:'error',signal:AbortSignal.timeout(20000)});
        if(!download.ok) throw new Failure('Der Download ist abgelaufen. Bitte erneut importieren.',502);
        const max=25*1024*1024;
        if(Number(download.headers.get('content-length'))>max) throw new Failure('Die Präsentation ist zu groß (maximal 25 MB PDF).',413);
        const reader=download.body.getReader(),chunks=[];let size=0;
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Failure('Die Präsentation ist zu groß (maximal 25 MB PDF).',413);}chunks.push(value);}
        const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw new Failure('Canva hat keine PDF-Datei geliefert.',502);
        return new Response(bytes,{headers:{...headers,'Content-Type':'application/pdf'}});
      }
      throw new Failure('Unbekannte Aktion.');
    } catch(error) {
      return json({error:error instanceof Failure?error.message:'Canva ist momentan nicht erreichbar oder noch nicht eingerichtet.'},error instanceof Failure?error.status:503);
    } finally { if(locked) { try { await store.update(locked,{lock_until:0}); } catch {} } }
  };
}
