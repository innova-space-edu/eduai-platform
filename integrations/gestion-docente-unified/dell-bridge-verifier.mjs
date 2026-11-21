/**
 * Dell side verification of signed Cloudflare → Dell request.
 * This is a protocol verifier, not a user session or a membership lookup.
 * Real runtime must store nonce in PostgreSQL with UNIQUE + 2m TTL, verify
 * Cloudflare Access before reaching handler and check institutional grants.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{code})};
const text=s=>new TextEncoder().encode(s);
const fromBase64url=s=>{
 if(typeof s!=='string'||!/^[A-Za-z0-9_-]{42,48}$/.test(s))fail('BRIDGE_SIGNATURE_INVALID');
 const raw=s.replace(/-/g,'+').replace(/_/g,'/');
 try{return Uint8Array.from(atob(raw),c=>c.charCodeAt(0))}
 catch{fail('BRIDGE_SIGNATURE_INVALID')}
};
async function hash(bytes){
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
async function hmacVerify(key,signature,canonical){
 const k=await crypto.subtle.importKey('raw',text(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',k,signature,text(canonical));
}
export function createDellBridgeVerifier({secret,consumeNonce,now=()=>Date.now(),maxSkewMs=120000,maxBodyBytes=20*1024*1024+16384}={}){
 if(typeof secret!=='string'||secret.length<32||typeof consumeNonce!=='function'||!Number.isInteger(maxSkewMs)||maxSkewMs<30000||maxSkewMs>300000)fail('BRIDGE_CONFIG_INVALID');
 return async function verify(request){
  if(!(request instanceof Request))fail('BRIDGE_REQUEST_INVALID');
  const time=request.headers.get('x-gestion-timestamp');
  const nonce=request.headers.get('x-gestion-nonce'),user=request.headers.get('x-gestion-user');
  const digest=request.headers.get('x-gestion-body-sha256');
  const signature=request.headers.get('x-gestion-signature');
  if(!/^\d{13}$/.test(time||'')||!UUID.test(nonce||'')||!UUID.test(user||'')||!HEX.test(digest||''))fail('BRIDGE_AUTH_INVALID');
  const t=Number(time);
  if(!Number.isSafeInteger(t)||Math.abs(now()-t)>maxSkewMs)fail('BRIDGE_EXPIRED');
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(bytes.length>maxBodyBytes)fail('BRIDGE_BODY_LIMIT');
  if(await hash(bytes)!==digest)fail('BRIDGE_BODY_MISMATCH');
  const u=new URL(request.url);
  if(!u.pathname.startsWith('/workspace')||(u.pathname!=='/workspace'&&!u.pathname.startsWith('/workspace/')))fail('BRIDGE_ROUTE_INVALID');
  const canonical=[time,nonce,request.method,u.pathname+u.search,digest,user].join('\n');
  if(!await hmacVerify(secret,fromBase64url(signature),canonical))fail('BRIDGE_AUTH_INVALID');
  // Consume only after verifying signature; in production this is atomic
  // INSERT ON CONFLICT DO NOTHING in a dedicated Postgres nonce table.
  const consumed=await consumeNonce({nonce,userId:user,expiresAt:t+maxSkewMs});
  if(consumed!==true)fail('BRIDGE_REPLAY');
  return {userId:user,nonce,method:request.method,pathname:u.pathname,body:bytes};
 };
}
