import test from 'node:test';
import assert from 'node:assert/strict';
import {GestionHub,GROUPS} from './hub-core.mjs';

const ids={
 a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222',
 pie:'33333333-3333-4333-8333-333333333333',utp:'44444444-4444-4444-8444-444444444444',
 ori:'55555555-5555-4555-8555-555555555555',doc:'66666666-6666-4666-8666-666666666666',
 other:'77777777-7777-4777-8777-777777777777',viewer:'88888888-8888-4888-8888-888888888888',
 schoolA:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',schoolB:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 fileA:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',fileB:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 fileX:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
};
const initial=Date.parse('2026-11-20T12:00:00Z');
const day=86400000;
function fixture(){
 let clock=initial;
 const tokens={adminA:[ids.a,'aal2'],adminB:[ids.b,'aal2'],pie:[ids.pie,'aal1'],utp:[ids.utp,'aal1'],orientacion:[ids.ori,'aal1'],docente:[ids.doc,'aal1'],externo:[ids.other,'aal1'],inspector:[ids.viewer,'aal1'],lowadmin:[ids.a,'aal1']};
 const receipts=new Map();
 const hub=new GestionHub({
   platformOperators:[ids.a,ids.b],now:()=>clock,
   verifySession:t=>tokens[t]?{userId:tokens[t][0],aal:tokens[t][1],verified:true,expiresAt:initial+90*day}:null,
   verifyUploadReceipt:async({uploadId})=>receipts.get(uploadId)
 });
 hub.provisionSchool('adminA',{id:ids.schoolA,name:'Colegio A',adminUserId:ids.a});
 hub.provisionSchool('adminB',{id:ids.schoolB,name:'Colegio B',adminUserId:ids.b});
 for(const [t,uid,g] of [['pie',ids.pie,'pie'],['utp',ids.utp,'utp'],['orientacion',ids.ori,'orientacion_convivencia'],['docente',ids.doc,'docentes'],['inspector',ids.viewer,'inspectoria']]){
  hub.addMember('adminA',{schoolId:ids.schoolA,userId:uid,group:g,expiresAt:initial+60*day});
 }
 hub.addMember('adminB',{schoolId:ids.schoolB,userId:ids.other,group:'pie',expiresAt:initial+60*day});
 const folder=hub.createFolder('pie',{schoolId:ids.schoolA,name:'Evidencias PIE'}).id;
 const folderB=hub.createFolder('externo',{schoolId:ids.schoolB,name:'Carpeta de B'}).id;
 function receipt(fileId,ownerId,schoolId,folderId,name='informe.pdf',options={}){
   receipts.set(fileId,{id:fileId,ownerId,schoolId,folderId,name,
      mediaType:'application/pdf',sizeBytes:1000,sha256:'a'.repeat(64),clean:true,stored:true,...options});
 }
 receipt(ids.fileA,ids.pie,ids.schoolA,folder);
 receipt(ids.fileB,ids.other,ids.schoolB,folderB);
 return {hub,folder,folderB,receipts,receipt,clock:()=>clock,advance:n=>{clock+=n}};
}
const schema=[{key:'fecha_revision',label:'Fecha revisión',type:'date',required:true},{key:'resultado',label:'Resultado',type:'select',required:true,options:['Cumplido','Pendiente']},{key:'observacion',label:'Observación',type:'long_text',required:false}];
const due=initial+7*day;
const answers={fecha_revision:'2026-11-20',resultado:'Cumplido',observacion:'Revisión completada'};
function create(hub,groups=['pie','utp','orientacion_convivencia'],users=[]){
 return hub.createTask('adminA',{schoolId:ids.schoolA,title:'Entrega de planificación mensual',description:'Completar registro y adjuntar PDF',dueAt:due,groups,users,form:schema,minFiles:1});
}
const deny=(fn,code)=>assert.throws(fn,e=>e.code===code);
const denyAsync=(fn,code)=>assert.rejects(fn,e=>e.code===code);

test('all requested recipient groups are available',()=>{
 assert.ok(['administrativos','pie','orientacion_convivencia','utp','docentes','inspectoria','contabilidad'].every(g=>GROUPS.includes(g)));
});
test('only administrative group with MFA creates tasks',()=>{
 const {hub}=fixture();
 deny(()=>hub.createTask('utp',{schoolId:ids.schoolA,title:'Hack',dueAt:due,groups:['pie'],form:schema,minFiles:1}),'MFA_REQUIRED');
 deny(()=>hub.createTask('lowadmin',{schoolId:ids.schoolA,title:'Hack',dueAt:due,groups:['pie'],form:schema,minFiles:1}),'MFA_REQUIRED');
 deny(()=>hub.createTask('adminB',{schoolId:ids.schoolA,title:'Hack',dueAt:due,groups:['pie'],form:schema,minFiles:1}),'NOT_A_MEMBER');
 assert.equal(create(hub).assigned,3);
});
test('administrativos may also receive tasks',()=>{
 const {hub}=fixture();
 const res=create(hub,['administrativos','pie']);
 assert.equal(res.assigned,2);
 assert.equal(hub.myTasks('adminA',ids.schoolA).length,1);
});
test('group task creates an independent state per recipient',()=>{
 const {hub}=fixture(),{taskId,assigned}=create(hub);
 assert.equal(assigned,3);
 assert.equal(hub.myTasks('pie',ids.schoolA)[0].status,'assigned');
 assert.equal(hub.myTasks('utp',ids.schoolA)[0].status,'assigned');
 assert.equal(hub.myTasks('orientacion',ids.schoolA)[0].status,'assigned');
 assert.equal(hub.searchTasks('adminA',{schoolId:ids.schoolA,status:'assigned'}).length,3);
});
test('recipient can save partial form, cannot submit incomplete',()=>{
 const {hub}=fixture(),{taskId}=create(hub);
 assert.equal(hub.saveDraft('pie',{taskId,answers:{observacion:'Iniciado'}}).status,'draft');
 deny(()=>hub.submitTask('pie',{taskId,answers:{observacion:'Iniciado'}}),'REQUIRED_FORM_FIELD');
 deny(()=>hub.submitTask('pie',{taskId,answers}),'EVIDENCE_REQUIRED');
 assert.equal(hub.myTasks('pie',ids.schoolA)[0].status,'draft');
});
test('form rejects extra fields and unsafe values',()=>{
 const {hub}=fixture(),{taskId}=create(hub);
 deny(()=>hub.saveDraft('pie',{taskId,answers:{otro:'x'}}),'UNEXPECTED_FORM_FIELD');
 deny(()=>hub.saveDraft('pie',{taskId,answers:{resultado:'Notas 7,0'}}),'INVALID_FORM_VALUE');
 deny(()=>hub.saveDraft('pie',{taskId,answers:{observacion:2}}),'INVALID_FORM_VALUE');
});
test('trusted verified clean upload can be attached to task',async()=>{
 const {hub,folder}=fixture(),{taskId}=create(hub);
 const f=await hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA});
 assert.equal(f.fileId,ids.fileA);
 assert.equal(hub.attachEvidence('pie',{taskId,fileId:ids.fileA}).attached,true);
 const submitted=hub.submitTask('pie',{taskId,answers});
 assert.deepEqual(submitted,{status:'submitted',approved:false});
 assert.equal(hub.myTasks('pie',ids.schoolA)[0].status,'submitted');
 assert.equal(hub.myTasks('utp',ids.schoolA)[0].status,'assigned');
});
test('site refuses upload not stored or not malware-scanned',async()=>{
 const {hub,folder,receipt}=fixture();
 receipt(ids.fileA,ids.pie,ids.schoolA,folder,'informe.pdf',{clean:false});
 await denyAsync(()=>hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA}),'INVALID_RECEIPT');
});
test('site refuses binary types and source path escape',async()=>{
 const {hub,folder,receipt}=fixture();
 receipt(ids.fileA,ids.pie,ids.schoolA,folder,'../../malware.exe');
 await denyAsync(()=>hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA}),'FILE_TYPE_UNSUPPORTED');
});
test('cannot reuse upload receipt',async()=>{
 const {hub,folder}=fixture();
 await hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA});
 await denyAsync(()=>hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA}),'INVALID_RECEIPT');
});
test('cross-school file is unavailable as task evidence',async()=>{
 const {hub,folderB}=fixture(),{taskId}=create(hub);
 await hub.attachFile('externo',{schoolId:ids.schoolB,folderId:folderB,uploadId:ids.fileB});
 deny(()=>hub.attachEvidence('pie',{taskId,fileId:ids.fileB}),'FILE_UNAVAILABLE');
});
test('unassigned users cannot deliver other group tasks',()=>{
 const {hub}=fixture(),{taskId}=create(hub,['pie']);
 deny(()=>hub.saveDraft('docente',{taskId,answers:{}}),'TASK_NOT_ASSIGNED');
 deny(()=>hub.submitTask('docente',{taskId,answers}),'TASK_NOT_ASSIGNED');
});
test('submitted evidence needs administrative review, not auto-approval',async()=>{
 const {hub,folder}=fixture(),{taskId}=create(hub);
 await hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA});
 hub.attachEvidence('pie',{taskId,fileId:ids.fileA});
 hub.submitTask('pie',{taskId,answers});
 const result=hub.reviewTask('adminA',{taskId,userId:ids.pie,decision:'approve'});
 assert.equal(result.status,'approved');
 deny(()=>hub.saveDraft('pie',{taskId,answers}),"TASK_READ_ONLY");
 assert.equal(hub.myTasks('pie',ids.schoolA)[0].status,'approved');
});
test('returned task can be corrected and resubmitted',async()=>{
 const {hub,folder}=fixture(),{taskId}=create(hub);
 await hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA});
 hub.attachEvidence('pie',{taskId,fileId:ids.fileA});
 hub.submitTask('pie',{taskId,answers});
 assert.equal(hub.reviewTask('adminA',{taskId,userId:ids.pie,decision:'return',returnReason:'Corregir sección 2'}).status,'returned');
 assert.equal(hub.myTasks('pie',ids.schoolA)[0].returnReason,'Corregir sección 2');
 assert.equal(hub.submitTask('pie',{taskId,answers:{...answers,observacion:'Corregida'}}).status,'submitted');
});
test('other school admin cannot read or review task',async()=>{
 const {hub,folder}=fixture(),{taskId}=create(hub);
 await hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA});
 hub.attachEvidence('pie',{taskId,fileId:ids.fileA});hub.submitTask('pie',{taskId,answers});
 deny(()=>hub.reviewTask('adminB',{taskId,userId:ids.pie,decision:'approve'}),'NOT_A_MEMBER');
 deny(()=>hub.readSubmission('adminB',{taskId,userId:ids.pie}),'NOT_A_MEMBER');
});
test('creator may read submitted task, not private draft',async()=>{
 const {hub,folder}=fixture(),{taskId}=create(hub);
 hub.saveDraft('pie',{taskId,answers:{observacion:'privado'}});
 deny(()=>hub.readSubmission('adminA',{taskId,userId:ids.pie}),'RESOURCE_UNAVAILABLE');
 await hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA});
 hub.attachEvidence('pie',{taskId,fileId:ids.fileA});hub.submitTask('pie',{taskId,answers});
 const response=hub.readSubmission('adminA',{taskId,userId:ids.pie});
 assert.equal(response.answers.resultado,'Cumplido');
});
test('UTP cannot inspect another user submission without delegation',async()=>{
 const {hub,folder}=fixture(),{taskId}=create(hub);
 await hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA});
 hub.attachEvidence('pie',{taskId,fileId:ids.fileA});hub.submitTask('pie',{taskId,answers});
 deny(()=>hub.readSubmission('utp',{taskId,userId:ids.pie}),'RESOURCE_UNAVAILABLE');
 assert.equal(hub.searchTasks('utp',{schoolId:ids.schoolA}).length,1);
});
test('delegated reviewer sees task but not content without separate grant',async()=>{
 const {hub,folder}=fixture(),{taskId}=create(hub);
 await hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA});
 hub.attachEvidence('pie',{taskId,fileId:ids.fileA});hub.submitTask('pie',{taskId,answers});
 hub.grantOversight('adminA',{schoolId:ids.schoolA,userId:ids.utp,scope:'seguimiento:leer',targetUserId:ids.pie,expiresAt:initial+7*day});
 assert.equal(hub.searchTasks('utp',{schoolId:ids.schoolA,userId:ids.pie}).length,1);
 deny(()=>hub.readSubmission('utp',{taskId,userId:ids.pie}),'RESOURCE_UNAVAILABLE');
 hub.grantOversight('adminA',{schoolId:ids.schoolA,userId:ids.utp,scope:'contenido:revisar',targetUserId:ids.pie,expiresAt:initial+7*day});
 assert.equal(hub.readSubmission('utp',{taskId,userId:ids.pie}).answers.resultado,'Cumplido');
});
test('oversight revocation blocks access in same session',async()=>{
 const {hub,folder}=fixture(),{taskId}=create(hub);
 await hub.attachFile('pie',{schoolId:ids.schoolA,folderId:folder,uploadId:ids.fileA});
 hub.attachEvidence('pie',{taskId,fileId:ids.fileA});hub.submitTask('pie',{taskId,answers});
 const grant=hub.grantOversight('adminA',{schoolId:ids.schoolA,userId:ids.utp,scope:'contenido:revisar',targetUserId:ids.pie,expiresAt:initial+7*day});
 assert.equal(hub.readSubmission('utp',{taskId,userId:ids.pie}).status,'submitted');
 hub.revokeOversight('adminA',{schoolId:ids.schoolA,grantId:grant.id});
 deny(()=>hub.readSubmission('utp',{taskId,userId:ids.pie}),'RESOURCE_UNAVAILABLE');
});
test('member revocation blocks task and folder in same session',()=>{
 const {hub,folder}=fixture(),{taskId}=create(hub);
 hub.revokeMember('adminA',{schoolId:ids.schoolA,userId:ids.pie});
 deny(()=>hub.myTasks('pie',ids.schoolA),'NOT_A_MEMBER');
 deny(()=>hub.listFiles('pie',{schoolId:ids.schoolA,folderId:folder}),'NOT_A_MEMBER');
});
test('folders default private and can be shared with editor/viewer',()=>{
 const {hub,folder}=fixture();
 assert.equal(hub.listMyFolders('pie',ids.schoolA).length,1);
 assert.equal(hub.listMyFolders('utp',ids.schoolA).length,0);
 hub.shareFolder('pie',{schoolId:ids.schoolA,folderId:folder,userId:ids.utp,permission:'viewer',expiresAt:initial+7*day});
 assert.equal(hub.listMyFolders('utp',ids.schoolA).length,1);
 deny(()=>hub.createFolder('utp',{schoolId:ids.schoolA,parentId:folder,name:'Invasión'}),'FOLDER_NOT_WRITABLE');
});
test('revoked folder sharing immediately blocks access',()=>{
 const {hub,folder}=fixture();
 hub.shareFolder('pie',{schoolId:ids.schoolA,folderId:folder,userId:ids.utp,permission:'viewer',expiresAt:initial+7*day});
 hub.revokeFolderShare('pie',{schoolId:ids.schoolA,folderId:folder,userId:ids.utp});
 deny(()=>hub.listFiles('utp',{schoolId:ids.schoolA,folderId:folder}),'FOLDER_UNAVAILABLE');
});
test('admin can publish group-specific banner',()=>{
 const {hub}=fixture();
 hub.publishBanner('adminA',{schoolId:ids.schoolA,title:'Entrega PIE',message:'Entregar evidencias',groups:['pie'],until:initial+day});
 assert.equal(hub.myBanners('pie',ids.schoolA).length,1);
 assert.equal(hub.myBanners('utp',ids.schoolA).length,0);
});
test('each user receives only own notifications',()=>{
 const {hub}=fixture();create(hub,['pie','utp']);
 assert.equal(hub.listNotifications('pie',ids.schoolA).length,1);
 assert.equal(hub.listNotifications('utp',ids.schoolA).length,1);
 assert.equal(hub.listNotifications('docente',ids.schoolA).length,0);
});
test('search returns authoritative status, not inferred official grades',()=>{
 const {hub}=fixture();
 hub.createTask('adminA',{schoolId:ids.schoolA,title:'Confirmar carga de notas en Napsis',dueAt:due,groups:['pie'],form:[{key:'evidencia',label:'Referencia interna',type:'short_text',required:true}]});
 const res=hub.searchTasks('adminA',{schoolId:ids.schoolA,textQuery:'notas'});
 assert.equal(res.length,1);assert.equal(res[0].status,'assigned');
 assert.equal(Object.hasOwn(res[0],'napsisOfficialGradeStatus'),false);
});
test('overdue uses UTC timestamp and does not auto-approve',()=>{
 const {hub,advance}=fixture();create(hub,['pie']);
 advance(8*day);
 const res=hub.searchTasks('adminA',{schoolId:ids.schoolA});
 assert.equal(res[0].overdue,true);
 assert.equal(res[0].status,'assigned');
});
test('source metadata links require HTTPS with no credentials',()=>{
 const {hub}=fixture();
 const l=hub.addPlatformLink('adminA',{schoolId:ids.schoolA,label:'EDUAI',url:'https://eduai.innova-space-edu.cl'});
 assert.ok(l.id);assert.equal(hub.myPlatformLinks('pie',ids.schoolA).length,1);
 deny(()=>hub.addPlatformLink('adminA',{schoolId:ids.schoolA,label:'Local',url:'http://localhost:3000'}),'INVALID_URL');
 deny(()=>hub.addPlatformLink('adminA',{schoolId:ids.schoolA,label:'Private',url:'https://user:pw@example.com'}),'INVALID_URL');
});
test('no admin list without MFA',()=>{
 const {hub}=fixture();
 deny(()=>hub.audit('lowadmin',ids.schoolA),'MFA_REQUIRED');
 assert.ok(hub.audit('adminA',ids.schoolA).length>0);
});
test('task cannot be created without required form or evidence',()=>{
 const {hub}=fixture();
 deny(()=>hub.createTask('adminA',{schoolId:ids.schoolA,title:'Ninguna',groups:['pie'],dueAt:due,form:[],minFiles:0}),'EVIDENCE_REQUIREMENT_MISSING');
});
test('invalid form schema and no recipients rejected',()=>{
 const {hub}=fixture();
 deny(()=>hub.createTask('adminA',{schoolId:ids.schoolA,title:'Solo',groups:[],users:[],dueAt:due,form:schema}),'NO_RECIPIENTS');
 deny(()=>hub.createTask('adminA',{schoolId:ids.schoolA,title:'X',groups:['pie'],dueAt:due,form:[{key:'q',label:'Q',type:'select',required:true,options:['A','A']}]}),'INVALID_FORM');
});
test('tasks cannot be assigned to an external school member',()=>{
 const {hub}=fixture();
 deny(()=>hub.createTask('adminA',{schoolId:ids.schoolA,title:'Foráneo',groups:[],users:[ids.other],dueAt:due,form:schema}),'NOT_A_MEMBER');
});
test('school suspension denies all access immediately',()=>{
 const {hub}=fixture();create(hub);
 hub.changeSchoolState('adminA',{schoolId:ids.schoolA,state:'suspended'});
 deny(()=>hub.myTasks('pie',ids.schoolA),'SCHOOL_UNAVAILABLE');
 deny(()=>hub.searchTasks('adminA',{schoolId:ids.schoolA}),'SCHOOL_UNAVAILABLE');
 assert.equal(hub.myTasks('externo',ids.schoolB).length,0);
});
