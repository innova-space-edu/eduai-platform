import test from 'node:test';
import assert from 'node:assert/strict';
import {GestionHub} from './hub-core.mjs';
import {SourceRegistry} from './source-registry.mjs';
import {searchHub,taskProgress} from './hub-search.mjs';

const SCHOOL='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const A='11111111-1111-4111-8111-111111111111',PIE='22222222-2222-4222-8222-222222222222',UTP='33333333-3333-4333-8333-333333333333';
const FILE='cccccccc-cccc-4ccc-8ccc-cccccccccccc',now=Date.parse('2026-11-20T12:00:00Z'),day=86400000;
function init(){
 const receipts=new Map();
 const hub=new GestionHub({
   now:()=>now,platformOperators:[A],
   verifySession:t=>t==='admin'?{userId:A,verified:true,aal:'aal2',expiresAt:now+day}:t==='pie'?{userId:PIE,verified:true,aal:'aal1',expiresAt:now+day}:t==='utp'?{userId:UTP,verified:true,aal:'aal1',expiresAt:now+day}:null,
   verifyUploadReceipt:async({uploadId})=>receipts.get(uploadId)
 });
 hub.provisionSchool('admin',{id:SCHOOL,name:'Colegio Ficticio',adminUserId:A});
 hub.addMember('admin',{schoolId:SCHOOL,userId:PIE,group:'pie',expiresAt:now+day});
 hub.addMember('admin',{schoolId:SCHOOL,userId:UTP,group:'utp',expiresAt:now+day});
 const registry=new SourceRegistry({
   hub,now:()=>now,
   verifyConsentTicket:async()=>({verified:true,handle:'reference-to-oauth-store',expiresAt:now+day}),
   fetchMetadata:async({ownerId})=>[{id:'plan-01',ownerId,title:'Planificación de noviembre',type:'planning',url:'https://drive.google.com/file/d/a/view',modifiedAt:now}]
 });
 return {hub,registry,receipts};
}
const build=(hub)=>hub.createTask('admin',{schoolId:SCHOOL,title:'Verificar ingreso de notas',dueAt:now+day/2,groups:['pie','utp'],form:[{key:'constancia',label:'Constancia',type:'short_text',required:true}]});
test('search is empty without grants or documents',()=>{
 const {hub,registry}=init();const x=searchHub({hub,registry,token:'pie',schoolId:SCHOOL,query:'plan'});
 assert.deepEqual(x.counts,{tasks:0,files:0,external:0});
});
test('administrative task search shows assignments, not inferred official status',()=>{
 const {hub,registry}=init();build(hub);
 const x=searchHub({hub,registry,token:'admin',schoolId:SCHOOL,query:'notas'});
 assert.equal(x.counts.tasks,2);
 assert.equal(x.officialVerification.status,'not_verifiable');
 assert.equal(x.officialVerification.verified,false);
 assert.match(x.explanation,/NO prueban/);
});
test('PIE cannot see UTP recipients in task search',()=>{
 const {hub,registry}=init();build(hub);
 const x=searchHub({hub,registry,token:'pie',schoolId:SCHOOL,query:'notas'});
 assert.equal(x.counts.tasks,1);
 assert.equal(x.tasks[0].assigneeId,PIE);
});
test('progress report counts pending evidence rather than official grades',()=>{
 const {hub}=init();build(hub);
 let p=taskProgress({hub,token:'admin',schoolId:SCHOOL,query:'notas'});
 assert.equal(p.pendingEvidence.length,2);
 assert.equal(p.counts.assigned,2);
 assert.match(p.meaning,/no indicadores oficiales/);
 const id=p.pendingEvidence[0].taskId;
 hub.submitTask('pie',{taskId:id,answers:{constancia:'Registrado'}});
 p=taskProgress({hub,token:'admin',schoolId:SCHOOL,query:'notas'});
 assert.equal(p.counts.submitted,1);assert.equal(p.counts.approved,0);assert.equal(p.awaitingReview.length,1);
});
test('private file not visible to admin by role alone',async()=>{
 const {hub,registry,receipts}=init();
 const folderId=hub.createFolder('pie',{schoolId:SCHOOL,name:'Privada'}).id;
 receipts.set(FILE,{id:FILE,ownerId:PIE,schoolId:SCHOOL,folderId,name:'Informe privado.pdf',mediaType:'application/pdf',sizeBytes:100,sha256:'a'.repeat(64),clean:true,stored:true});
 await hub.attachFile('pie',{schoolId:SCHOOL,folderId,uploadId:FILE});
 assert.equal(searchHub({hub,registry,token:'pie',schoolId:SCHOOL,kind:'files',query:'informe'}).counts.files,1);
 assert.equal(searchHub({hub,registry,token:'admin',schoolId:SCHOOL,kind:'files',query:'informe'}).counts.files,0);
});
test('supervisor can search only expressly delegated user files',async()=>{
 const {hub,registry,receipts}=init();
 const folderId=hub.createFolder('pie',{schoolId:SCHOOL,name:'Privada'}).id;
 receipts.set(FILE,{id:FILE,ownerId:PIE,schoolId:SCHOOL,folderId,name:'Informe privado.pdf',mediaType:'application/pdf',sizeBytes:100,sha256:'a'.repeat(64),clean:true,stored:true});
 await hub.attachFile('pie',{schoolId:SCHOOL,folderId,uploadId:FILE});
 const grant=hub.grantOversight('admin',{schoolId:SCHOOL,userId:UTP,scope:'contenido:revisar',targetUserId:PIE,expiresAt:now+day});
 assert.equal(searchHub({hub,registry,token:'utp',schoolId:SCHOOL,kind:'files',query:'informe'}).counts.files,1);
 hub.revokeOversight('admin',{schoolId:SCHOOL,grantId:grant.id});
 assert.equal(searchHub({hub,registry,token:'utp',schoolId:SCHOOL,kind:'files',query:'informe'}).counts.files,0);
});
test('Google Drive metadata only for connected owner',async()=>{
 const {hub,registry}=init();
 await registry.link('pie',SCHOOL,{provider:'google_drive',consentTicket:'approved-ticket-2026'});
 await registry.sync('pie',SCHOOL,'google_drive');
 assert.equal(searchHub({hub,registry,token:'pie',schoolId:SCHOOL,kind:'external',query:'Planificación'}).counts.external,1);
 assert.equal(searchHub({hub,registry,token:'admin',schoolId:SCHOOL,kind:'external',query:'Planificación'}).counts.external,0);
});
test('query about attendance never invents real attendance data',()=>{
 const {hub,registry}=init();
 const x=searchHub({hub,registry,token:'admin',schoolId:SCHOOL,query:'asistencia'});
 assert.equal(x.officialVerification.status,'not_verifiable');
 assert.equal(x.counts.tasks,0);
});
