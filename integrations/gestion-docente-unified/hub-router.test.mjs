import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {GestionHub} from './hub-core.mjs';
import {createHubRouter} from './hub-router.mjs';

const ORIGIN='https://gestion-docente.innova-space-edu.cl';
const SCHOOL='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER='11111111-1111-4111-8111-111111111111';
const PIE='22222222-2222-4222-8222-222222222222';
const UTP='33333333-3333-4333-8333-333333333333';
const CSRF='very-long-server-generated-csrf-1234';
const clock=Date.parse('2026-11-20T12:00:00Z');
const due='2026-11-27';
function fixture(){
 let actor='admin',lastUpload=null;const receipts=new Map();
 const principal={admin:[OWNER,'aal2'],pie:[PIE,'aal1'],utp:[UTP,'aal1'],lowadmin:[OWNER,'aal1']};
 const hub=new GestionHub({
  platformOperators:[OWNER],
  now:()=>clock,
  verifySession:t=>principal[t]?{userId:principal[t][0],aal:principal[t][1],verified:true,expiresAt:clock+86400000}:null,
  verifyUploadReceipt:async({uploadId})=>receipts.get(uploadId)
 });
 hub.provisionSchool('admin',{id:SCHOOL,name:'Colegio Ficticio',adminUserId:OWNER});
 hub.addMember('admin',{schoolId:SCHOOL,userId:PIE,group:'pie',expiresAt:clock+86400000});
 hub.addMember('admin',{schoolId:SCHOOL,userId:UTP,group:'utp',expiresAt:clock+86400000});
 const router=createHubRouter({
  hub,origin:ORIGIN,
  authenticate:async()=>({token:actor,schoolId:SCHOOL,csrf:CSRF}),
  storeAndScan:async({blob,schoolId,ownerId,folderId})=>{
   lastUpload={schoolId,ownerId,folderId,name:blob.name};
   const id=randomUUID();
   receipts.set(id,{id,schoolId,ownerId,folderId,name:blob.name,
    mediaType:blob.type,sizeBytes:blob.size,sha256:'b'.repeat(64),clean:true,stored:true});
   return {uploadId:id};
  }
 });
 return {hub,router,setActor:t=>{actor=t},lastUpload:()=>lastUpload};
}
const req=(path,init={})=>new Request(ORIGIN+path,init);
const get=(router,path)=>router(req(path));
const post=(router,path,data,{origin=ORIGIN,csrf=CSRF}={})=>{
 const form=new URLSearchParams();
 for(const [k,v] of Object.entries({...data,_csrf:csrf})){
  if(Array.isArray(v)){for(const item of v)form.append(k,item)}else{form.append(k,v)}
 }
 return router(req(path,{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:form}));
};
test('dashboard renders distinct member session and group labels',async()=>{
 const {router,setActor}=fixture();
 let r=await get(router,'/');assert.equal(r.status,200);
 const admin=await r.text();assert.match(admin,/Crear y asignar tarea|Mis tareas/);
 setActor('pie');r=await get(router,'/');assert.equal(r.status,200);
 const html=await r.text();assert.match(html,/PIE/);assert.doesNotMatch(html,/Crear y asignar tarea/);
});
test('admin panel only appears for administradores',async()=>{
 const {router,setActor}=fixture();
 assert.match(await (await get(router,'/?view=administrar')).text(),/Crear y asignar tarea/);
 setActor('pie');
 assert.doesNotMatch(await (await get(router,'/?view=administrar')).text(),/Crear y asignar tarea/);
});
test('CSRF and cross-origin task creation blocked',async()=>{
 const {router}=fixture();
 assert.equal((await post(router,'/admin/tasks',{title:'Prueba',due,template:'form',groups:['pie']},{csrf:'bad'})).status,403);
 assert.equal((await post(router,'/admin/tasks',{title:'Prueba',due,template:'form',groups:['pie']},{origin:'https://evil.invalid'})).status,403);
});
test('admin creates task for PIE, UTP and Orientación only when enrolled',async()=>{
 const {router,hub}=fixture();
 let r=await post(router,'/admin/tasks',{title:'Formulario mensual',due,template:'form',groups:['pie','utp']});
 assert.equal(r.status,303);assert.equal(hub.myTasks('pie',SCHOOL).length,1);
 assert.equal(hub.myTasks('utp',SCHOOL).length,1);
 r=await post(router,'/admin/tasks',{title:'No asignado',due,template:'form',groups:['orientacion_convivencia']});
 assert.equal(r.status,400);
});
test('PIE cannot create administrative tasks even by direct POST',async()=>{
 const {router,setActor}=fixture();setActor('pie');
 const r=await post(router,'/admin/tasks',{title:'Intento',due,template:'form',groups:['utp']});
 assert.equal(r.status,403);
});
test('all nonadministrative users can create their own folders',async()=>{
 const {router,hub,setActor}=fixture();setActor('pie');
 assert.equal((await post(router,'/folders',{name:'Reportes PIE'})).status,303);
 assert.equal(hub.listMyFolders('pie',SCHOOL).length,1);
 setActor('utp');assert.equal(hub.listMyFolders('utp',SCHOOL).length,0);
});
test('form-only task can be completed without PDF',async()=>{
 const {router,hub,setActor}=fixture();
 await post(router,'/admin/tasks',{title:'Formulario mensual',due,template:'form',groups:['pie']});
 const taskId=hub.myTasks('pie',SCHOOL)[0].id;
 setActor('pie');
 let r=await post(router,'/tasks/'+taskId+'/save',{action:'submit',resultado:'Realizado',observacion:'Actividad finalizada'});
 assert.equal(r.status,303);
 assert.equal(hub.myTasks('pie',SCHOOL)[0].status,'submitted');
});
test('evidence template requires uploaded file, not just text',async()=>{
 const {router,hub,setActor}=fixture();
 await post(router,'/admin/tasks',{title:'Entrega mensual',due,template:'evidence',groups:['pie']});
 const taskId=hub.myTasks('pie',SCHOOL)[0].id;
 setActor('pie');
 const result=await post(router,'/tasks/'+taskId+'/save',{action:'submit'});
 assert.equal(result.status,400);
 assert.equal(hub.myTasks('pie',SCHOOL)[0].status,'assigned');
});
test('same-page PDF upload can be checked, attached, submitted and approved in mock harness',async()=>{
 const {router,hub,setActor,lastUpload}=fixture();
 await post(router,'/admin/tasks',{title:'Informe PIE',due,template:'mixed',groups:['pie']});
 const taskId=hub.myTasks('pie',SCHOOL)[0].id;
 setActor('pie');
 await post(router,'/folders',{name:'Evidencias del semestre'});
 const folderId=hub.listMyFolders('pie',SCHOOL)[0].id;
 const file=new File(['%PDF-1.4 fixture'], 'evidencia.pdf',{type:'application/pdf'});
 const form=new FormData();
 form.set('_csrf',CSRF);form.set('folderId',folderId);form.set('evidence',file);
 let r=await router(req('/tasks/'+taskId+'/upload',{method:'POST',headers:{origin:ORIGIN},body:form}));
 assert.equal(r.status,303);assert.equal(lastUpload().ownerId,PIE);
 assert.equal(hub.myTasks('pie',SCHOOL)[0].fileCount,1);
 r=await post(router,'/tasks/'+taskId+'/save',{action:'submit',descripcion:'Informe completo',fecha_realizacion:'2026-11-20'});
 assert.equal(r.status,303);
 setActor('admin');
 const review=await get(router,'/admin/review?taskId='+taskId+'&userId='+PIE);
 assert.equal(review.status,200);
 const markup=await review.text();assert.match(markup,/Informe completo/);assert.match(markup,/Aprobar/);
 r=await post(router,'/admin/review',{taskId,userId:PIE,decision:'approve'});
 assert.equal(r.status,303);
 assert.equal(hub.myTasks('pie',SCHOOL)[0].status,'approved');
});
test('file upload without folder permission rejected BEFORE scanning',async()=>{
 const {router,hub,setActor,lastUpload}=fixture();
 await post(router,'/admin/tasks',{title:'Informe PIE',due,template:'evidence',groups:['pie']});
 const taskId=hub.myTasks('pie',SCHOOL)[0].id;
 setActor('utp');await post(router,'/folders',{name:'Privada UTP'});
 const folderId=hub.listMyFolders('utp',SCHOOL)[0].id;
 setActor('pie');const form=new FormData();
 form.set('_csrf',CSRF);form.set('folderId',folderId);form.set('evidence',new File(['fake'],'evidencia.pdf',{type:'application/pdf'}));
 const r=await router(req('/tasks/'+taskId+'/upload',{method:'POST',headers:{origin:ORIGIN},body:form}));
 assert.equal(r.status,403);assert.equal(lastUpload(),null);
});
test('submissions can be returned for correction and resubmitted',async()=>{
 const {router,hub,setActor}=fixture();
 await post(router,'/admin/tasks',{title:'Formulario',due,template:'form',groups:['pie']});
 const taskId=hub.myTasks('pie',SCHOOL)[0].id;
 setActor('pie');await post(router,'/tasks/'+taskId+'/save',{action:'submit',resultado:'En progreso',observacion:'Primer avance'});
 setActor('admin');await post(router,'/admin/review',{taskId,userId:PIE,decision:'return',returnReason:'Completar actividades'});
 setActor('pie');
 assert.equal(hub.myTasks('pie',SCHOOL)[0].status,'returned');
 assert.equal((await post(router,'/tasks/'+taskId+'/save',{action:'submit',resultado:'Realizado',observacion:'Completado'})).status,303);
 assert.equal(hub.myTasks('pie',SCHOOL)[0].status,'submitted');
});
test('unassigned UTP cannot read PIE response using same-page endpoint',async()=>{
 const {router,hub,setActor}=fixture();
 await post(router,'/admin/tasks',{title:'Informe PIE',due,template:'form',groups:['pie']});
 const taskId=hub.myTasks('pie',SCHOOL)[0].id;
 setActor('pie');await post(router,'/tasks/'+taskId+'/save',{action:'submit',resultado:'Realizado',observacion:'Privado'});
 setActor('utp');const response=await get(router,'/admin/review?taskId='+taskId+'&userId='+PIE);
 assert.notEqual(response.status,200);assert.doesNotMatch(await response.text(),/Privado/);
});
test('no public export of completed submissions or raw email',async()=>{
 const {router}=fixture();
 assert.equal((await get(router,'/api/unsecured-submissions')).status,404);
 assert.equal((await get(router,'/api/gmail/all')).status,404);
});

test('each group may upload files directly to its own folder in same page',async()=>{
 const {router,hub,setActor}=fixture();
 setActor('pie');
 assert.equal((await post(router,'/folders',{name:'Mis planificaciones'})).status,303);
 const folderId=hub.listMyFolders('pie',SCHOOL)[0].id;
 const form=new FormData();form.set('_csrf',CSRF);form.set('folderId',folderId);
 form.set('evidence',new File(['%PDF-1.4 demo'],'planificacion.pdf',{type:'application/pdf'}));
 const r=await router(req('/files/upload',{method:'POST',headers:{origin:ORIGIN},body:form}));
 assert.equal(r.status,303);
 assert.deepEqual(hub.listFiles('pie',{schoolId:SCHOOL,folderId}).map(x=>x.name),['planificacion.pdf']);
 assert.match(await (await get(router,'/?view=archivos')).text(),/planificacion\.pdf/);
 setActor('utp');assert.equal(hub.searchFiles('utp',{schoolId:SCHOOL,query:'planificacion'}).length,0);
});
test('unassigned task upload denied before calling storage adapter',async()=>{
 const {router,hub,setActor,lastUpload}=fixture();
 await post(router,'/admin/tasks',{title:'PIE',due,template:'evidence',groups:['pie']});
 const taskId=hub.myTasks('pie',SCHOOL)[0].id;
 setActor('utp');await post(router,'/folders',{name:'UTP'});
 const folderId=hub.listMyFolders('utp',SCHOOL)[0].id;
 const form=new FormData();form.set('_csrf',CSRF);form.set('folderId',folderId);
 form.set('evidence',new File(['not real'],'informe.pdf',{type:'application/pdf'}));
 const r=await router(req('/tasks/'+taskId+'/upload',{method:'POST',headers:{origin:ORIGIN},body:form}));
 assert.equal(r.status,403);
 assert.equal(lastUpload(),null);
});

test('administrativos create a banner targeted only to PIE',async()=>{
 const {router,setActor}=fixture();
 assert.equal((await post(router,'/admin/banners',{title:'Reunión PIE',message:'Subir evidencias',until:'2026-11-27',groups:['pie']})).status,303);
 setActor('pie');const pie=await (await get(router,'/')).text();assert.match(pie,/Reunión PIE/);
 setActor('utp');const utp=await (await get(router,'/')).text();assert.doesNotMatch(utp,/Reunión PIE/);
});
test('nonadministrator cannot publish banners or institutional shortcuts',async()=>{
 const {router,setActor}=fixture();setActor('pie');
 assert.equal((await post(router,'/admin/banners',{title:'No autorizado',message:'Mensaje',until:'2026-11-27'})).status,403);
 assert.equal((await post(router,'/admin/platforms',{label:'Falso',url:'https://example.com'})).status,403);
});
test('admin creates platform access without exposing credentials',async()=>{
 const {router,setActor}=fixture();
 assert.equal((await post(router,'/admin/platforms',{label:'EDUAI',url:'https://eduai.innova-space-edu.cl/dashboard'})).status,303);
 setActor('pie');
 const html=await (await get(router,'/?view=plataformas')).text();
 assert.match(html,/EDUAI/);assert.match(html,/eduai\.innova-space-edu\.cl\/dashboard/);
 assert.doesNotMatch(html,/access_token|refresh_token|client_secret/i);
});

test('internal storage error messages do not disclose server paths',async()=>{
 const f=fixture();
 const dangerous=createHubRouter({
  hub:f.hub,origin:ORIGIN,
  authenticate:async()=>({token:'pie',schoolId:SCHOOL,csrf:CSRF}),
  storeAndScan:async()=>{throw new Error('EACCES /srv/innova-gestion/storage/key-secret')},
 });
 await post(dangerous,'/folders',{name:'Personal'});
 const folderId=f.hub.listMyFolders('pie',SCHOOL)[0].id;
 const data=new FormData();data.set('_csrf',CSRF);data.set('folderId',folderId);
 data.set('evidence',new File(['%PDF-1.4'],'evidencia.pdf',{type:'application/pdf'}));
 const result=await dangerous(req('/files/upload',{method:'POST',headers:{origin:ORIGIN},body:data}));
 assert.equal(result.status,500);
 const body=await result.text();
 assert.match(body,/ERROR_INTERNO/);
 assert.doesNotMatch(body,/srv|key-secret|EACCES/);
});
