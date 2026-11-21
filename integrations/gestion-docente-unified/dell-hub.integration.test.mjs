import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {GestionHub} from './hub-core.mjs';
import {DellStorage} from './dell-storage.mjs';
import {createHubRouter} from './hub-router.mjs';

const ORIGIN='https://gestion-docente.innova-space-edu.cl';
const SCHOOL='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 ADMIN='11111111-1111-4111-8111-111111111111',PIE='22222222-2222-4222-8222-222222222222',UTP='33333333-3333-4333-8333-333333333333',
 CSRF='staging-fixed-csrf-do-not-use-production';
const now=Date.parse('2026-11-20T12:00:00Z'),day=86400000;
const formPost=(router,path,data,who)=>router(new Request(ORIGIN+path,{method:'POST',headers:{origin:ORIGIN,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...data,_csrf:CSRF})}));
const filePost=(router,path,folderId,name='evidencia.pdf',who)=>{const fd=new FormData();fd.set('_csrf',CSRF);fd.set('folderId',folderId);fd.set('evidence',new File(['%PDF-1.4 fake educational fixture'],name,{type:'application/pdf'}));return router(new Request(ORIGIN+path,{method:'POST',headers:{origin:ORIGIN},body:fd}))};
async function setup({scan=async()=>({clean:true,engine:'clamav',signatureVersion:'TEST-ONLY'})}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gestion-hub-dell-integrated-')),key=randomBytes(32);
 const storage=await DellStorage.initialize({root,masterKey:key,scanWithClamAV:scan});
 let who='admin',host=ORIGIN;
 const hub=new GestionHub({
  now:()=>now,platformOperators:[ADMIN],
  verifySession:t=>{
   const values={admin:[ADMIN,'aal2'],pie:[PIE,'aal1'],utp:[UTP,'aal1'],outsider:[UTP,'aal1']};
   const x=values[t];return x?{userId:x[0],aal:x[1],verified:true,expiresAt:now+day}:null;
  },
  verifyUploadReceipt:async q=>storage.verifyReceipt(q)
 });
 hub.provisionSchool('admin',{id:SCHOOL,name:'Colegio ficticio',adminUserId:ADMIN});
 hub.addMember('admin',{schoolId:SCHOOL,userId:PIE,group:'pie',expiresAt:now+day});
 hub.addMember('admin',{schoolId:SCHOOL,userId:UTP,group:'utp',expiresAt:now+day});
 const router=createHubRouter({
  hub,origin:ORIGIN,
  authenticate:async()=>({token:who,schoolId:SCHOOL,csrf:CSRF}),
  storeAndScan:({blob,schoolId,ownerId,folderId})=>storage.put({blob,schoolId,ownerId,folderId}),
  readFromDell:options=>storage.read(options)
 });
 const req=path=>router(new Request(ORIGIN+path));
 return {root,key,hub,storage,router,req,setWho:t=>{who=t},async clean(){await fs.rm(root,{recursive:true,force:true})}};
}
test('end-to-end PDF: Dell encrypted bytes → task evidence → approved → authorized download',async()=>{
 const f=await setup();
 try{
  await formPost(f.router,'/admin/tasks',{title:'Planificación de noviembre',description:'Adjuntar',due:'2026-11-27',template:'evidence',groups:'pie'});
  const taskId=f.hub.myTasks('pie',SCHOOL)[0].id;
  f.setWho('pie');
  assert.equal((await formPost(f.router,'/folders',{name:'Mi carpeta privada'})).status,303);
  const folderId=f.hub.listMyFolders('pie',SCHOOL)[0].id;
  assert.equal((await filePost(f.router,'/tasks/'+taskId+'/upload',folderId)).status,303);
  const items=f.hub.listFiles('pie',{schoolId:SCHOOL,folderId});
  assert.equal(items.length,1);
  const fileId=items[0].id;
  const raw=await fs.readFile(path.join(f.root,'objects',SCHOOL,fileId+'.enc'));
  assert.doesNotMatch(raw.toString('utf8'),/%PDF-1\.4/);
  assert.equal((await formPost(f.router,'/tasks/'+taskId+'/save',{action:'submit'})).status,303);
  f.setWho('admin');
  assert.equal((await formPost(f.router,'/admin/review',{taskId,userId:PIE,decision:'approve'})).status,303);
  f.setWho('pie');
  const result=await f.req('/files/'+fileId+'/download');
  assert.equal(result.status,200);
  assert.match(result.headers.get('content-disposition'),/attachment/);
  assert.match(result.headers.get('cache-control'),/no-store/);
  assert.match(await result.text(),/%PDF-1\.4/);
 }finally{await f.clean()}
});
test('admin cannot download private PIE file merely by role',async()=>{
 const f=await setup();
 try{
  f.setWho('pie');await formPost(f.router,'/folders',{name:'Privada'});
  const folderId=f.hub.listMyFolders('pie',SCHOOL)[0].id;
  await filePost(f.router,'/files/upload',folderId);
  const fileId=f.hub.listFiles('pie',{schoolId:SCHOOL,folderId})[0].id;
  f.setWho('admin');
  const r=await f.req('/files/'+fileId+'/download');
  assert.notEqual(r.status,200);
  assert.doesNotMatch(await r.text(),/PDF-1\.4/);
 }finally{await f.clean()}
});
test('ACL grant then revoke controls Dell decrypt access immediately',async()=>{
 const f=await setup();
 try{
  f.setWho('pie');await formPost(f.router,'/folders',{name:'Privada'});
  const folderId=f.hub.listMyFolders('pie',SCHOOL)[0].id;
  await filePost(f.router,'/files/upload',folderId);
  const fileId=f.hub.listFiles('pie',{schoolId:SCHOOL,folderId})[0].id;
  f.setWho('utp');assert.notEqual((await f.req('/files/'+fileId+'/download')).status,200);
  f.hub.shareFolder('pie',{schoolId:SCHOOL,folderId,userId:UTP,permission:'viewer',expiresAt:now+day});
  assert.equal((await f.req('/files/'+fileId+'/download')).status,200);
  f.hub.revokeFolderShare('pie',{schoolId:SCHOOL,folderId,userId:UTP});
  assert.notEqual((await f.req('/files/'+fileId+'/download')).status,200);
 }finally{await f.clean()}
});
test('membership revocation blocks encrypted object immediately',async()=>{
 const f=await setup();
 try{
  f.setWho('pie');await formPost(f.router,'/folders',{name:'Planificaciones'});
  const folderId=f.hub.listMyFolders('pie',SCHOOL)[0].id;
  await filePost(f.router,'/files/upload',folderId);
  const fileId=f.hub.listFiles('pie',{schoolId:SCHOOL,folderId})[0].id;
  assert.equal((await f.req('/files/'+fileId+'/download')).status,200);
  f.hub.revokeMember('admin',{schoolId:SCHOOL,userId:PIE});
  assert.notEqual((await f.req('/files/'+fileId+'/download')).status,200);
 }finally{await f.clean()}
});
test('antivirus rejection never enters task folder and leaves no plaintext',async()=>{
 const f=await setup({scan:async()=>({clean:false,engine:'clamav',signatureVersion:'TEST'})});
 try{
  f.setWho('pie');await formPost(f.router,'/folders',{name:'Evidencias'});
  const folderId=f.hub.listMyFolders('pie',SCHOOL)[0].id;
  assert.notEqual((await filePost(f.router,'/files/upload',folderId)).status,303);
  assert.deepEqual(f.hub.listFiles('pie',{schoolId:SCHOOL,folderId}),[]);
  assert.deepEqual(await fs.readdir(path.join(f.root,'quarantine')),[]);
 }finally{await f.clean()}
});
test('file metadata stays on Dell; no Supabase storage calls',async()=>{
 const f=await setup();
 try{
  f.setWho('pie');await formPost(f.router,'/folders',{name:'Recursos'});
  const folderId=f.hub.listMyFolders('pie',SCHOOL)[0].id;
  await filePost(f.router,'/files/upload',folderId);
  const item=f.hub.listFiles('pie',{schoolId:SCHOOL,folderId})[0];
  const meta=JSON.parse(await fs.readFile(path.join(f.root,'objects',SCHOOL,item.id+'.json'),'utf8'));
  assert.equal(meta.ownerId,PIE);
  assert.equal(meta.schoolId,SCHOOL);
  assert.equal(meta.name,'evidencia.pdf');
  assert.ok(!Object.hasOwn(meta,'supabaseBucket'));
 }finally{await f.clean()}
});
