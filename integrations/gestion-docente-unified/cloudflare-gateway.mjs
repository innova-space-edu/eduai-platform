/**
 * Cloudflare Worker entry candidate for ONE Gestión Docente.
 * Browser sees ONE hostname. Worker keeps EDUAI Auth/Connect and proxies /workspace
 * exclusively to a private Dell API via a signed server-to-server request.
 * No Node filesystem/Postgres/ClamAV code may be imported into Cloudflare.
 *
 * NOT DEPLOYED. Requires:
 * - GESTION_DELL_ORIGIN: approved HTTPS tunnel origin
 * - GESTION_BRIDGE_HMAC_KEY: long random secret installed on Dell and Cloudflare
 * - GESTION_ACCESS_CLIENT_ID/SECRET: Cloudflare Access service token
 * - Dell verifier with timestamp, HMAC, nonce replay DB + fresh membership ACL
 * - real login/session routing, rate limit, logs without personal data
 */
const HOST='https://gestion-docente.innova-space-edu.cl';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX=20*1024*1024+16384;
const FLAGS={'Cache-Control':'private, no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const textEncode=s=>new TextEncoder().encode(s);
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const base64url=buffer=>{
 const bytes=new Uint8Array(buffer);
 let s='';for(const b of bytes)s+=String.fromCharCode(b);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
};
async function digest(bytes){return hex(await crypto.subtle.digest('SHA-256',bytes))}
async function sign(key,value){
 const secret=await crypto.subtle.importKey('raw',textEncode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return base64url(await crypto.subtle.sign('HMAC',secret,textEncode(value)));
}
function privateOrigin(config){
 try{
  const u=new URL(config);
  if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||u.pathname!=='/'||u.origin===HOST||
    !u.hostname.includes('.')||u.hostname==='localhost')return null;
  return u.origin;
 }catch{return null}
}
function fail(code,status){return Response.json({error:code},{status,headers:FLAGS})}
function safeRedirect(response){
 if(response.status>=300&&response.status<400){
  const loc=response.headers.get('location');
  if(loc==='/')return new Response(null,{status:303,headers:{...FLAGS,Location:'/workspace'}});
 }
 return response;
}
async function readBodyBounded(request){
 if(request.method!=='POST')return new Uint8Array(0);
 const contentLength=request.headers.get('content-length');
 if(contentLength && (!/^\d+$/.test(contentLength)||Number(contentLength)>MAX))throw Object.assign(new Error('BODY_LIMIT'),{code:'BODY_LIMIT'});
 const reader=request.body?.getReader();
 if(!reader)return new Uint8Array(0);
 const chunks=[];let size=0;
 try{
  while(true){
   const r=await reader.read();
   if(r.done)break;
   size+=r.value.length;
   if(size>MAX){await reader.cancel();throw Object.assign(new Error('BODY_LIMIT'),{code:'BODY_LIMIT'})}
   chunks.push(r.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;
 for(const part of chunks){bytes.set(part,offset);offset+=part.length}
 return bytes;
}
export function createCloudflareUnifiedWorker({legacy,verifyIdentity,fetchDell=fetch,now=()=>Date.now(),makeNonce=()=>crypto.randomUUID()}){
 if(!legacy||typeof legacy.fetch!=='function'||typeof verifyIdentity!=='function'||typeof fetchDell!=='function')throw Error('TRUSTED_INTEGRATIONS_REQUIRED');
 return {async fetch(request,env){
  try{
   const url=new URL(request.url);
   if(url.origin!==HOST)return fail('INVALID_HOST',403);
   if(url.pathname==='/'&&request.method==='GET')return new Response(null,{status:303,headers:{...FLAGS,Location:'/workspace'}});
   if(url.pathname!=='/workspace'&&!url.pathname.startsWith('/workspace/')){
    return safeRedirect(await legacy.fetch(request,env));
   }
   if(!['GET','POST'].includes(request.method))return fail('METHOD_NOT_ALLOWED',405);
   const identity=await verifyIdentity(request,env);
   if(!identity?.id||!UUID.test(identity.id))return request.method==='GET'
    ?new Response(null,{status:303,headers:{...FLAGS,Location:'/login'}}):fail('SESSION_REQUIRED',401);
   const backend=privateOrigin(env?.GESTION_DELL_ORIGIN),secret=env?.GESTION_BRIDGE_HMAC_KEY;
   if(!backend||typeof secret!=='string'||secret.length<32||!env.GESTION_ACCESS_CLIENT_ID||!env.GESTION_ACCESS_CLIENT_SECRET)
    return fail('DELL_BACKEND_NOT_CONFIGURED',503);
   let body;
   try{body=await readBodyBounded(request)}catch{return fail('BODY_LIMIT',413)}
   const hash=await digest(body),stamp=String(now()),nonce=makeNonce();
   if(!UUID.test(nonce))return fail('INTERNAL_ERROR',500);
   const canonical=[stamp,nonce,request.method,url.pathname+url.search,hash,identity.id].join('\n');
   const signature=await sign(secret,canonical);
   const headers=new Headers();
   for(const header of ['content-type','accept']){const v=request.headers.get(header);if(v)headers.set(header,v)}
   headers.set('X-Gestion-Timestamp',stamp);
   headers.set('X-Gestion-Nonce',nonce);
   headers.set('X-Gestion-User',identity.id);
   headers.set('X-Gestion-Body-Sha256',hash);
   headers.set('X-Gestion-Signature',signature);
   headers.set('CF-Access-Client-Id',env.GESTION_ACCESS_CLIENT_ID);
   headers.set('CF-Access-Client-Secret',env.GESTION_ACCESS_CLIENT_SECRET);
   const target=backend+url.pathname+url.search;
   let upstream;
   try{upstream=await fetchDell(target,{method:request.method,headers,
      ...(request.method==='POST'?{body}:{}),redirect:'manual'})}
   catch{return fail('DELL_BACKEND_UNAVAILABLE',503)}
   if(upstream.status>=300&&upstream.status<400){
    const to=upstream.headers.get('location');
    if(!to||!to.startsWith('/')||to.startsWith('//')||to.includes('\\'))return fail('UNSAFE_REDIRECT',502);
    return new Response(null,{status:303,headers:{...FLAGS,Location:to}});
   }
   const returned=new Headers(FLAGS);
   for(const k of ['content-type','content-disposition']){const v=upstream.headers.get(k);if(v)returned.set(k,v)}
   return new Response(upstream.body,{status:upstream.status,headers:returned});
  }catch{return fail('INTERNAL_ERROR',500)}
 }};
}
