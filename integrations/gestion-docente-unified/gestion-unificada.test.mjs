import test from 'node:test';
import assert from 'node:assert/strict';
import {GestionHub} from './hub-core.mjs';
import {createUnifiedApp} from './gestion-unificada.mjs';

const SITE='https://gestion-docente.innova-space-edu.cl';
const SCHOOL='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN='11111111-1111-4111-8111-111111111111';
const PIE='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const NOW=Date.parse('2026-11-20T12:00:00Z');
const CSRF='server-only-csrf-1234567890123';
const req=(route,opts={})=>new Request(SITE+route,opts);
function setup(){
 const principal={admin:[ADMIN,'aal2'],pie:[PIE,'aal1']};
 const hub=new GestionHub({
  platformOperators:[ADMIN],now:()=>NOW,
  verifySession:token=>principal[token]?{userId:principal[token][0],aal:principal[token][1],verified:true,expiresAt:NOW+86400000}:null,
  verifyUploadReceipt:async()=>null
 });
 hub.provisionSchool('admin',{id:SCHOOL,name:'Colegio Piloto',adminUserId:ADMIN});
 hub.addMember('admin',{schoolId:SCHOOL,userId:PIE,group:'pie',expiresAt:NOW+86400000});
 const seen=[];
 const legacy={
  async fetch(r){
   seen.push({path:new URL(r.url).pathname,method:r.method});
   const path=new URL(r.url).pathname;
   if(path==='/login'&&r.method==='POST')return new Response(null,{status:303,headers:{Location:'/'}});
   if(path==='/connect')return new Response('<h1>EDUAI Connect único</h1>',{status:200,headers:{'Content-Type':'text/html'}});
   if(path==='/login')return new Response('<h1>Iniciar sesión</h1>',{status:200});
   if(path==='/health')return Response.json({ready:true});
   if(path==='/')return new Response('<h1>Antiguo panel</h1>',{status:200});
   return new Response(null,{status:404});
  }
 };
 const app=createUnifiedApp({
  hub,legacy,storeAndScan:async()=>{throw Error('not installed')},
  validateEduai:async r=>{
   const token=(r.headers.get('cookie')||'').replace('test-session=','');
   return token==='admin'?{id:ADMIN,teacher:true}:token==='pie'?{id:PIE,teacher:true}:null;
  },
  verifyInstitutionalAccess:async({userId})=>{
   if(userId===ADMIN)return {schoolId:SCHOOL,hubToken:'admin',csrf:CSRF};
   if(userId===PIE)return {schoolId:SCHOOL,hubToken:'pie',csrf:CSRF};
   return null;
  },
  probeConfiguration:async()=>[
   {id:'identity',label:'Cuenta EDUAI',status:'pending',detail:'Verificación de producción no realizada'},
   {id:'storage',label:'Dell Storage',status:'blocked',detail:'ClamAV real pendiente'},
   {id:'napsis',label:'Napsis',status:'not_connected',detail:'Sin API confirmada'}
  ]
 });
 return {app,hub,seen};
}
const get=(app,path,who='pie')=>app.fetch(req(path,{headers:{cookie:'test-session='+who}}),{});
const post=(app,path,body,who='admin',csrf=CSRF)=>{
 const params=new URLSearchParams(body);params.set('_csrf',csrf);
 return app.fetch(req(path,{method:'POST',headers:{cookie:'test-session='+who,origin:SITE,'content-type':'application/x-www-form-urlencoded'},body:params}),{});
};
test('single login redirects to unified workspace, not old dashboard',async()=>{
 const {app}=setup();
 const result=await app.fetch(req('/login',{method:'POST',headers:{origin:SITE},body:new URLSearchParams({})}),{});
 assert.equal(result.status,303);assert.equal(result.headers.get('location'),'/workspace');
});
test('unified workspace is inaccessible without verified EduAI identity',async()=>{
 const {app}=setup();let r=await app.fetch(req('/workspace'),{});
 assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/login');
 r=await app.fetch(req('/workspace/admin/tasks',{method:'POST',headers:{origin:SITE},body:new URLSearchParams({_csrf:CSRF})}),{});
 assert.equal(r.status,401);
});
test('PIE sees single app nav, not separate port, and can create folder',async()=>{
 const {app,hub}=setup();
 const r=await get(app,'/workspace','pie');assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/Gestión Docente/);assert.match(html,/href="\/connect"/);assert.match(html,/href="\/workspace\?view=tareas"/);
 const archives=await (await get(app,'/workspace?view=archivos','pie')).text();
 assert.match(archives,/action="\/workspace\/folders"/);
 const f=await post(app,'/workspace/folders',{name:'Mis planificaciones'},'pie');
 assert.equal(f.status,303);assert.equal(f.headers.get('Location'),'/workspace');
 assert.equal(hub.listMyFolders('pie',SCHOOL).length,1);
});
test('only institutional admin with MFA can assign tasks',async()=>{
 const {app,hub}=setup();
 let r=await post(app,'/workspace/admin/tasks',{title:'Entregar planificación',due:'2026-11-27',template:'form',groups:'pie'},'pie');
 assert.equal(r.status,403);
 r=await post(app,'/workspace/admin/tasks',{title:'Entregar planificación',due:'2026-11-27',template:'form',groups:'pie'},'admin');
 assert.equal(r.status,303);
 assert.equal(hub.myTasks('pie',SCHOOL).length,1);
});
test('CSRF across unified and institutional routes is enforced',async()=>{
 const {app,hub}=setup();
 const r=await post(app,'/workspace/admin/tasks',{title:'No crear',due:'2026-11-27',template:'form',groups:'pie'},'admin','wrong');
 assert.equal(r.status,403);
 assert.equal(hub.myTasks('pie',SCHOOL).length,0);
});
test('Connect is served at same domain, preserving original protected API',async()=>{
 const {app,seen}=setup();
 const r=await get(app,'/connect');assert.equal(r.status,200);
 assert.match(await r.text(),/EDUAI Connect único/);
 assert.ok(seen.some(x=>x.path==='/connect'));
});
test('configuration only for institutional admin, shows truthful statuses',async()=>{
 const {app}=setup();
 let r=await get(app,'/workspace/configuration','pie');assert.equal(r.status,403);
 r=await get(app,'/workspace/configuration','admin');assert.equal(r.status,200);
 const content=await r.text();
 assert.match(content,/Dell Storage/);assert.match(content,/ClamAV real pendiente/);
 assert.match(content,/not_connected/);
 assert.doesNotMatch(content,/service_role|private_key|SUPABASE_SECRET/);
});
test('unknown public host rejected',async()=>{
 const {app}=setup();
 const r=await app.fetch(new Request('https://other.invalid/workspace'),{});
 assert.equal(r.status,404);
});
test('private file upload is not enabled without operational storage',async()=>{
 const {app,hub}=setup();
 await post(app,'/workspace/folders',{name:'Privada'},'pie');
 const folder=hub.listMyFolders('pie',SCHOOL)[0].id;
 const upload=new FormData();
 upload.set('_csrf',CSRF);upload.set('folderId',folder);
 upload.set('evidence',new File(['%PDF-1.4 demo'],'evidencia.pdf',{type:'application/pdf'}));
 const r=await app.fetch(req('/workspace/files/upload',{method:'POST',headers:{origin:SITE,cookie:'test-session=pie'},body:upload}),{});
 assert.equal(r.status,500);
 assert.match(await r.text(),/ERROR_INTERNO/);
 assert.equal(hub.listFiles('pie',{schoolId:SCHOOL,folderId:folder}).length,0);
});
