import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {DellStorage} from './dell-storage.mjs';
const SCHOOL='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 OWNER='11111111-1111-4111-8111-111111111111',INTRUDER='22222222-2222-4222-8222-222222222222',
 FOLDER='33333333-3333-4333-8333-333333333333',FOLDER2='44444444-4444-4444-8444-444444444444';
const PDF=new File([Buffer.from('%PDF-1.4\n% synthetic data\n')],'evidencia.pdf',{type:'application/pdf'});
const TXT=new File([Buffer.from('Planificación de ejemplo')],'planificacion.txt',{type:'text/plain'});
const scan=async()=>({clean:true,engine:'clamav',signatureVersion:'SIMULATED-NOT-REAL'});
async function fixture(opts={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gestion-dell-storage-'));
 const key=randomBytes(32);
 const storage=await DellStorage.initialize({root,masterKey:key,scanWithClamAV:scan,...opts});
 return {root,key,storage,async clean(){await fs.rm(root,{recursive:true,force:true})}};
}
const upload=(storage,blob=PDF,ownerId=OWNER,schoolId=SCHOOL,folderId=FOLDER)=>storage.put({blob,ownerId,schoolId,folderId});
const verify=(storage,uploadId,actorId=OWNER,schoolId=SCHOOL,folderId=FOLDER)=>storage.verifyReceipt({uploadId,actorId,schoolId,folderId});
const read=(storage,fileId,schoolId=SCHOOL,authorize=async()=>true)=>storage.read({fileId,schoolId,authorize});
const denies=(promise,code)=>assert.rejects(promise,e=>e.code===code);
test('encrypts PDF on disk but reads verified bytes',async()=>{
 const f=await fixture();
 try{
  const o=await upload(f.storage);
  assert.equal(o.encrypted,true);
  const stored=await fs.readFile(path.join(f.root,'objects',SCHOOL,o.uploadId+'.enc'));
  assert.notEqual(stored.toString('utf8').includes('%PDF-1.4'),true);
  assert.notDeepEqual(stored,await PDF.arrayBuffer());
  const r=await read(f.storage,o.uploadId);
  assert.equal(r.bytes.toString('utf8'),await PDF.text());
  assert.equal(r.mediaType,'application/pdf');
  assert.equal(f.storage.usage().usedBytes,PDF.size);
 }finally{await f.clean()}
});
test('scanner unavailable fails closed',async()=>{
 const f=await fixture({scanWithClamAV:async()=>{throw Error('offline')}});
 try{await assert.rejects(upload(f.storage));assert.deepEqual(await fs.readdir(path.join(f.root,'quarantine')),[]);assert.equal(f.storage.usage().usedBytes,0)}
 finally{await f.clean()}
});
test('malware scanner dirty rejects file',async()=>{
 const f=await fixture({scanWithClamAV:async()=>({clean:false,engine:'clamav',signatureVersion:'test'})});
 try{await denies(upload(f.storage),'SCAN_REQUIRED');assert.equal(f.storage.usage().usedBytes,0)}
 finally{await f.clean()}
});
test('must have actual scanner engine result, not boolean',async()=>{
 const f=await fixture({scanWithClamAV:async()=>({clean:true})});
 try{await denies(upload(f.storage),'SCAN_REQUIRED')}
 finally{await f.clean()}
});
test('content mismatch blocks forged PDF',async()=>{
 const f=await fixture();
 try{await denies(upload(f.storage,new File(['fake'],'fake.pdf',{type:'application/pdf'})),'CONTENT_MISMATCH')}
 finally{await f.clean()}
});
test('extension and mime must match',async()=>{
 const f=await fixture();
 try{
  await denies(upload(f.storage,new File(['x'],'virus.exe',{type:'application/octet-stream'})),'FORMAT_UNSUPPORTED');
  await denies(upload(f.storage,new File(['%PDF-1.4'],'evidencia.pdf',{type:'text/plain'})),'MIME_MISMATCH');
 }finally{await f.clean()}
});
test('path traversal in filenames blocked',async()=>{
 const f=await fixture();
 try{
  for(const name of ['../../etc/passwd.pdf','/tmp/evil.pdf','..hidden.pdf','bad\\name.pdf']){
   await denies(upload(f.storage,new File(['%PDF-1.4'],name,{type:'application/pdf'})),'BAD_FILENAME');
  }
 }finally{await f.clean()}
});
test('OOXML requires dedicated inspected ZIP, not just PK header',async()=>{
 const f=await fixture();
 try{await denies(upload(f.storage,new File([Buffer.from([80,75,3,4,1,2,3,4])],'documento.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})),'OOXML_INSPECTOR_REQUIRED')}
 finally{await f.clean()}
});
test('PDF receipt matches owner, school and folder',async()=>{
 const f=await fixture();
 try{
  const o=await upload(f.storage);
  const r=await verify(f.storage,o.uploadId);
  assert.deepEqual(Object.keys(r).sort(),['clean','folderId','id','mediaType','name','ownerId','schoolId','sha256','sizeBytes','stored','scanEngine','scanSignatureVersion'].sort());
  await denies(verify(f.storage,o.uploadId,INTRUDER),'RECEIPT_UNAVAILABLE');
  await denies(verify(f.storage,o.uploadId,OWNER,OTHER),'RECEIPT_UNAVAILABLE');
  await denies(verify(f.storage,o.uploadId,OWNER,SCHOOL,FOLDER2),'RECEIPT_UNAVAILABLE');
 }finally{await f.clean()}
});
test('receipts are short-lived and consumable',async()=>{
 let clock=Date.now();
 const f=await fixture({now:()=>clock});
 try{
  const a=await upload(f.storage);
  await verify(f.storage,a.uploadId);
  await f.storage.consumeReceipt(a.uploadId);
  await denies(verify(f.storage,a.uploadId),'RECEIPT_UNAVAILABLE');
  const b=await upload(f.storage);
  clock+=11*60*1000;
  await denies(verify(f.storage,b.uploadId),'RECEIPT_UNAVAILABLE');
 }finally{await f.clean()}
});
test('download requires explicit authorize callback each time',async()=>{
 const f=await fixture();
 try{
  const o=await upload(f.storage);
  await denies(read(f.storage,o.uploadId,SCHOOL,async()=>false),'ACCESS_DENIED');
  await denies(f.storage.read({fileId:o.uploadId,schoolId:SCHOOL}),'AUTHORIZATION_REQUIRED');
  assert.equal((await read(f.storage,o.uploadId)).bytes.length,PDF.size);
 }finally{await f.clean()}
});
test('object is not accessible through different tenant',async()=>{
 const f=await fixture();
 try{
  const o=await upload(f.storage);
  await assert.rejects(read(f.storage,o.uploadId,OTHER));
 }finally{await f.clean()}
});
test('encrypted content integrity verified against tampering',async()=>{
 const f=await fixture();
 try{
  const o=await upload(f.storage);
  const p=path.join(f.root,'objects',SCHOOL,o.uploadId+'.enc');
  const data=await fs.readFile(p);data[0]^=15;await fs.writeFile(p,data);
  await denies(read(f.storage,o.uploadId),'INTEGRITY_FAILED');
 }finally{await f.clean()}
});
test('wrong encryption key cannot decrypt object',async()=>{
 const f=await fixture();
 try{
  const o=await upload(f.storage);
  const other=await DellStorage.initialize({root:f.root,masterKey:randomBytes(32),scanWithClamAV:scan});
  await denies(read(other,o.uploadId),'INTEGRITY_FAILED');
 }finally{await f.clean()}
});
test('metadata and usage survive process restart',async()=>{
 const f=await fixture();
 try{
  const o=await upload(f.storage);
  const reopened=await DellStorage.initialize({root:f.root,masterKey:f.key,scanWithClamAV:scan});
  assert.equal(reopened.usage().usedBytes,PDF.size);
  assert.equal((await read(reopened,o.uploadId)).bytes.toString(),await PDF.text());
 }finally{await f.clean()}
});
test('school quota rejects large upload and leaves no object',async()=>{
 const f=await fixture({maxFileBytes:PDF.size,maxSchoolBytes:PDF.size,maxTotalBytes:2*PDF.size});
 try{
  await upload(f.storage);
  await denies(upload(f.storage),'QUOTA_EXCEEDED');
  const list=await fs.readdir(path.join(f.root,'objects',SCHOOL));
  assert.equal(list.length,2);
 }finally{await f.clean()}
});
test('independent school usage tracked',async()=>{
 const f=await fixture();
 try{
  await upload(f.storage,PDF,OWNER,SCHOOL,FOLDER);
  await upload(f.storage,TXT,INTRUDER,OTHER,FOLDER2);
  const usage=f.storage.usage();
  assert.equal(usage.bySchool[SCHOOL],PDF.size);
  assert.equal(usage.bySchool[OTHER],TXT.size);
 }finally{await f.clean()}
});
test('parallel writes never bypass in-process quota',async()=>{
 const f=await fixture({maxFileBytes:PDF.size,maxSchoolBytes:PDF.size,maxTotalBytes:2*PDF.size});
 try{
  const [a,b]=await Promise.allSettled([upload(f.storage),upload(f.storage)]);
  assert.equal([a,b].filter(x=>x.status==='fulfilled').length,1);
  assert.equal([a,b].filter(x=>x.status==='rejected').length,1);
  assert.equal(f.storage.usage().usedBytes,PDF.size);
 }finally{await f.clean()}
});
test('no plaintext residue remains in staging quarantine',async()=>{
 const f=await fixture();
 try{
  await upload(f.storage);
  assert.deepEqual(await fs.readdir(path.join(f.root,'quarantine')),[]);
  const bins=await fs.readdir(path.join(f.root,'objects',SCHOOL));
  assert.equal(bins.filter(x=>x.endsWith('.enc')).length,1);
  assert.equal(bins.filter(x=>x.endsWith('.json')).length,1);
 }finally{await f.clean()}
});
test('invalid configuration is rejected before write',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gestion-dell-bad-'));
 try{
  await denies(DellStorage.initialize({root,masterKey:randomBytes(8),scanWithClamAV:scan}),'STORAGE_CONFIG_REQUIRED');
  await denies(DellStorage.initialize({root:'/',masterKey:randomBytes(32),scanWithClamAV:scan}),'STORAGE_CONFIG_REQUIRED');
 }finally{await fs.rm(root,{recursive:true,force:true})}
});

test('tampering with owner or folder metadata invalidates GCM AAD',async()=>{
 const f=await fixture();
 try{
  const a=await upload(f.storage);
  const p=path.join(f.root,'objects',SCHOOL,a.uploadId+'.json');
  const m=JSON.parse(await fs.readFile(p,'utf8'));
  m.ownerId=INTRUDER;
  await fs.writeFile(p,JSON.stringify(m),{mode:0o600});
  await denies(read(f.storage,a.uploadId),'INTEGRITY_FAILED');
 }finally{await f.clean()}
});
test('encrypted backup + separate key restores bytes and metadata',async()=>{
 const f=await fixture();const backup=await fs.mkdtemp(path.join(os.tmpdir(),'gestion-dell-restore-'));
 try{
  const a=await upload(f.storage);
  await fs.cp(f.root,backup,{recursive:true,force:true});
  const restore=await DellStorage.initialize({root:backup,masterKey:f.key,scanWithClamAV:scan});
  assert.equal(restore.usage().usedBytes,PDF.size);
  const got=await read(restore,a.uploadId);
  assert.equal(got.bytes.toString('utf8'),await PDF.text());
 }finally{await f.clean();await fs.rm(backup,{recursive:true,force:true})}
});
test('manifest permissions are private to service user',async()=>{
 const f=await fixture();
 try{
  const a=await upload(f.storage);
  const item=path.join(f.root,'objects',SCHOOL,a.uploadId+'.json');
  const bin=path.join(f.root,'objects',SCHOOL,a.uploadId+'.enc');
  assert.equal((await fs.stat(item)).mode&0o077,0);
  assert.equal((await fs.stat(bin)).mode&0o077,0);
 }finally{await f.clean()}
});

test('restart detects orphan encrypted object after interrupted commit',async()=>{
 const f=await fixture();
 try{
  const up=await upload(f.storage);
  const manifest=path.join(f.root,'objects',SCHOOL,up.uploadId+'.json');
  await fs.rm(manifest);
  await denies(DellStorage.initialize({root:f.root,masterKey:f.key,scanWithClamAV:scan}),'ORPHAN_OBJECT_REQUIRES_RECONCILIATION');
 }finally{await f.clean()}
});
test('storage refuses group-readable root directory',async()=>{
 const f=await fixture();
 try{
  await fs.chmod(f.root,0o750);
  await denies(DellStorage.initialize({root:f.root,masterKey:f.key,scanWithClamAV:scan}),'UNSAFE_STORAGE_PATH');
 }finally{await f.clean()}
});
