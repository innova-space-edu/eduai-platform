import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
const base='https://gestion-docente.innova-space-edu.cl',env={SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const id='00000000-0000-4000-8000-000000000001';
const jwt='eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({aal:'aal1'})).toString('base64url')+'.test';
const cookie='__Host-gestion_session='+jwt;
function req(path,init={}){return new Request(base+path,init)}
const body=(obj)=>new URLSearchParams(obj);
function installMock({teacher=true,privacy=true,approved=false,deny=false,mfa=false}={}){
 const calls=[];globalThis.fetch=async(url,opts={})=>{
  const u=new URL(url);calls.push({path:u.pathname,query:u.search,body:opts.body?JSON.parse(opts.body):null,auth:opts.headers?.authorization});
  let data=[],status=200;
  if(u.pathname==='/auth/v1/user')data={id,email:'teacher@example.invalid',email_confirmed_at:'2026-01-01',factors:mfa?[{status:'verified',factor_type:'totp',id}]:[]};
  else if(u.pathname==='/auth/v1/token')data={access_token:jwt,refresh_token:'do-not-leak'};
  else if(u.pathname.endsWith('/eduai_user_access'))data=[{account_type:teacher?'teacher':'other',age_band:'adult',access_tier:'standard'}];
  else if(u.pathname.endsWith('/eduai_privacy_choices'))data=[{policy_version:privacy?'2026-10-11-v1':'old',terms_acknowledged_at:'2026-01-01',data_warning_acknowledged_at:'2026-01-01'}];
  else if(u.pathname.endsWith('/admin_emails'))data=[];
  else if(u.pathname.endsWith('/eduai_connect_status'))data={access:approved?{active:true,scopes:['exams:read'],expires_at:'2027-01-01'}:null,requests:[]};
  else if(u.pathname.endsWith('/eduai_connect_catalog')){if(deny){status=403;data={message:'internal'};}else data={items:[{id,title:'<script>bad</script>',status:'closed'}]};}
  else if(u.pathname.endsWith('/eduai_teacher_contexts')){if(opts.method==='POST'||opts.method==='PATCH')return new Response(null,{status:204});data=[];}
  else if(u.pathname.endsWith('/eduai_connect_request'))data=id;
  else if(u.pathname.endsWith('/logout'))return new Response(null,{status:204});
  return new Response(JSON.stringify(data),{status});
 };return calls;
}
test('public login and health disclose no user data',async()=>{let r=await worker.fetch(req('/login'),env);assert.equal(r.status,200);assert.match(await r.text(),/Iniciar sesión con EduAI/);r=await worker.fetch(req('/health'),env);assert.equal((await r.json()).connect,'pilot');});
test('unauthenticated API denied',async()=>{let r=await worker.fetch(req('/api/connect/v1/exams'),env);assert.equal(r.status,401);assert.match(r.headers.get('cache-control'),/no-store/);});
test('unknown host denied',async()=>assert.equal((await worker.fetch(new Request('https://other.invalid/health'),env)).status,404));
test('CSRF and cross-origin API denied',async()=>{assert.equal((await worker.fetch(req('/contexts',{method:'POST',headers:{origin:'https://other.invalid',cookie},body:body({})}),env)).status,403);assert.equal((await worker.fetch(req('/api/connect/v1/status',{headers:{cookie,origin:'https://other.invalid'}}),env)).status,403);});
test('teacher login creates host-only http-only session',async()=>{installMock();const r=await worker.fetch(req('/login',{method:'POST',headers:{origin:base},body:body({email:'teacher@example.invalid',password:'test-password'})}),env);assert.equal(r.status,303);const c=r.headers.get('set-cookie');assert.match(c,/HttpOnly/);assert.match(c,/SameSite=Strict/);assert.match(c,/Secure/);assert.doesNotMatch(c,/Domain=|do-not-leak/);});
test('nonteacher denied',async()=>{installMock({teacher:false});const r=await worker.fetch(req('/api/connect/v1/status',{headers:{cookie}}),env);assert.equal(r.status,403);});
test('privacy version required',async()=>{installMock({privacy:false});assert.equal((await worker.fetch(req('/api/connect/v1/status',{headers:{cookie}}),env)).status,403);});
test('MFA cannot be bypassed by aal1',async()=>{installMock({mfa:true});assert.equal((await worker.fetch(req('/api/connect/v1/status',{headers:{cookie}}),env)).status,403);});
test('catalog uses caller JWT and maps authorization denial',async()=>{const calls=installMock({deny:true});const r=await worker.fetch(req('/api/connect/v1/exams',{headers:{cookie}}),env);assert.equal(r.status,403);assert.equal(calls.at(-1).auth,'Bearer '+jwt);assert.deepEqual(calls.at(-1).body,{p_kind:'exam',p_offset:0,p_limit:25});});
test('no foreign teacher filters',async()=>{const calls=installMock();const r=await worker.fetch(req('/api/connect/v1/exams?teacher_id='+id,{headers:{cookie}}),env);assert.equal(r.status,400);assert.ok(!calls.some(x=>x.path.endsWith('eduai_connect_catalog')));});
test('context insert has no user-supplied owner',async()=>{const calls=installMock();const r=await worker.fetch(req('/contexts',{method:'POST',headers:{origin:base,cookie},body:body({institution:'Colegio de prueba',year:'2026',level:'media',grade:'1',section:'a',subject:'Matemática',period:'semestre_2',teacher_id:'other'})}),env);assert.equal(r.status,303);const q=calls.at(-1).body;assert.equal(q.section,'A');assert.equal(q.teacher_id,undefined);});
test('invalid context rejected before insert',async()=>{const calls=installMock();const r=await worker.fetch(req('/contexts',{method:'POST',headers:{origin:base,cookie},body:body({institution:'Test',year:'2026',level:'media',grade:'8',section:'a',subject:'Matemática',period:'semestre_2'})}),env);assert.equal(r.status,400);assert.ok(!calls.some(x=>x.path.endsWith('eduai_teacher_contexts')));});
test('admin access denied for teachers',async()=>{installMock();assert.equal((await worker.fetch(req('/admin',{headers:{cookie}}),env)).status,403);});
test('escaping and CSP on Connect page',async()=>{installMock({approved:true});const r=await worker.fetch(req('/connect',{headers:{cookie}}),env);const h=await r.text();assert.equal(r.status,200);assert.match(h,/&lt;script&gt;bad&lt;\/script&gt;/);assert.doesNotMatch(h,/<script>/);assert.match(r.headers.get('content-security-policy'),/default-src 'none'/);});
