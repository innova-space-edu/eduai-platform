import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudflareUnifiedWorker} from './cloudflare-gateway.mjs';
import {createDellBridgeVerifier} from './dell-bridge-verifier.mjs';

const USER='11111111-1111-4111-8111-111111111111';
const SITE='https://gestion-docente.innova-space-edu.cl';
const NOW=1795204800000;
const SECRET='test-only-not-a-production-secret-1234567890';
const env={
 GESTION_DELL_ORIGIN:'https://gestion-dell.innova-space-edu.cl',
 GESTION_BRIDGE_HMAC_KEY:SECRET,
 GESTION_ACCESS_CLIENT_ID:'demo-identity',
 GESTION_ACCESS_CLIENT_SECRET:'demo-secret'
};
const request=(route,options={})=>new Request(SITE+route,options);
function pair(){
 let calls=0,seen=[],last;
 const consumed=new Set();
 const verify=createDellBridgeVerifier({secret:SECRET,now:()=>NOW,
  consumeNonce:async({nonce})=>{
   if(consumed.has(nonce))return false;
   consumed.add(nonce);return true;
  }});
 const legacy={fetch:async req=>new Response('Legacy route: '+new URL(req.url).pathname,{status:200})};
 const proxy=createCloudflareUnifiedWorker({
  legacy,now:()=>NOW,
  verifyIdentity:async req=>req.headers.get('cookie')==='valid-session'?{id:USER}:null,
  fetchDell:async(url,options)=>{
   calls++;last={url,options};seen.push(options.headers);
   const trusted=await verify(new Request(url,options));
   return new Response(JSON.stringify({userId:trusted.userId,method:trusted.method,size:trusted.body.length}),{
    headers:{'Content-Type':'application/json','Set-Cookie':'backend-admin-secret=hidden'}
   });
  }
 });
 return {proxy,verify,seen,last:()=>last,calls:()=>calls};
}
test('single login keeps legacy Connect same domain but proxies workspace',async()=>{
 const p=pair();
 let res=await p.proxy.fetch(request('/connect'),env);
 assert.equal(res.status,200);
 assert.match(await res.text(),/Legacy route/);
 res=await p.proxy.fetch(request('/workspace',{headers:{cookie:'valid-session'}}),env);
 assert.equal(res.status,200);
 assert.equal(p.calls(),1);
 assert.match(await res.text(),/11111111/);
});
test('proxy rejects unauthenticated users before contacting Dell',async()=>{
 const p=pair();
 const res=await p.proxy.fetch(request('/workspace'),env);
 assert.equal(res.status,303);
 assert.equal(res.headers.get('Location'),'/login');
 assert.equal(p.calls(),0);
});
test('private HMAC bridge signs method path query body user and timestamp',async()=>{
 const p=pair();
 const headers={cookie:'valid-session','content-type':'application/x-www-form-urlencoded',origin:SITE};
 const r=await p.proxy.fetch(request('/workspace/tasks?view=1',{method:'POST',headers,body:'report=demo'}),env);
 assert.equal(r.status,200);
 const data=await r.json();
 assert.deepEqual(data,{userId:USER,method:'POST',size:11});
 assert.equal(p.last().url,'https://gestion-dell.innova-space-edu.cl/workspace/tasks?view=1');
 assert.equal(p.last().options.headers.has('Cookie'),false);
 assert.equal(p.last().options.headers.get('CF-Access-Client-Secret'),'demo-secret');
});
test('Dell backend drops response cookies and caches sensitive data nowhere',async()=>{
 const p=pair();
 const res=await p.proxy.fetch(request('/workspace',{headers:{cookie:'valid-session'}}),env);
 assert.equal(res.headers.get('Set-Cookie'),null);
 assert.match(res.headers.get('cache-control'),/no-store/);
});
test('configured private backend required: cannot silently fall back to Supabase',async()=>{
 const p=pair();
 const bad={...env,GESTION_BRIDGE_HMAC_KEY:undefined};
 const r=await p.proxy.fetch(request('/workspace',{headers:{cookie:'valid-session'}}),bad);
 assert.equal(r.status,503);
 assert.match(await r.text(),/DELL_BACKEND_NOT_CONFIGURED/);
 assert.equal(p.calls(),0);
});
test('prevents recursive proxy and insecure Dell origins',async()=>{
 const p=pair();
 for(const origin of ['http://gestion-dell.innova-space-edu.cl',SITE,'https://user:pw@example.com','https://localhost']){
  const r=await p.proxy.fetch(request('/workspace',{headers:{cookie:'valid-session'}}),{...env,GESTION_DELL_ORIGIN:origin});
  assert.equal(r.status,503);
 }
});
test('old login and redirect support only one workspace path',async()=>{
 const legacy={fetch:async()=>new Response(null,{status:303,headers:{Location:'/'}})};
 const proxy=createCloudflareUnifiedWorker({legacy,verifyIdentity:async()=>null,now:()=>NOW,fetchDell:async()=>{throw Error('should not call')}});
 const r=await proxy.fetch(request('/login',{method:'POST'}),env);
 assert.equal(r.status,303);assert.equal(r.headers.get('Location'),'/workspace');
});
test('bridge verifier rejects modified body after signing',async()=>{
 const p=pair();
 await p.proxy.fetch(request('/workspace',{method:'POST',headers:{cookie:'valid-session'},body:'one'}),env);
 const {url,options}=p.last();
 const bad=new Request(url,{...options,body:'two'});
 await assert.rejects(p.verify(bad),e=>e.code==='BRIDGE_BODY_MISMATCH');
});
test('bridge verifier rejects replay of same authenticated request',async()=>{
 const p=pair();
 await p.proxy.fetch(request('/workspace',{headers:{cookie:'valid-session'}}),env);
 const {url,options}=p.last();
 await assert.rejects(p.verify(new Request(url,options)),e=>e.code==='BRIDGE_REPLAY');
});
test('expired timestamp rejected',async()=>{
 const p=pair();
 await p.proxy.fetch(request('/workspace',{headers:{cookie:'valid-session'}}),env);
 const {url,options}=p.last();
 const req=new Request(url,options);
 const wrong=new Headers(req.headers);
 wrong.set('X-Gestion-Timestamp',String(NOW-1000000));
 await assert.rejects(p.verify(new Request(url,{method:'GET',headers:wrong})),e=>e.code==='BRIDGE_EXPIRED');
});
test('public POST cannot submit without authenticated identity',async()=>{
 const p=pair();
 const res=await p.proxy.fetch(request('/workspace/files/upload',{method:'POST',body:'x'}),env);
 assert.equal(res.status,401);assert.equal(p.calls(),0);
});
test('origin validation and disallowed methods enforce boundaries',async()=>{
 const p=pair();
 assert.equal((await p.proxy.fetch(new Request('https://evil.invalid/workspace'),env)).status,403);
 assert.equal((await p.proxy.fetch(request('/workspace',{method:'DELETE',headers:{cookie:'valid-session'}}),env)).status,405);
});
test('does not leak Dell internal error messages',async()=>{
 const legacy={fetch:async()=>new Response('public')};
 const proxy=createCloudflareUnifiedWorker({legacy,now:()=>NOW,
 verifyIdentity:async()=>({id:USER}),
 fetchDell:async()=>{throw Error('/srv/innova-gestion/secret/password')}});
 const res=await proxy.fetch(request('/workspace',{headers:{cookie:'valid-session'}}),env);
 assert.equal(res.status,503);
 assert.doesNotMatch(await res.text(),/secret|srv|password/);
});
