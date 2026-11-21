import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {randomBytes} from 'node:crypto';
import {createClamdScanner} from './clamav-adapter.mjs';
import {DellStorage} from './dell-storage.mjs';
const SCHOOL='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER='11111111-1111-4111-8111-111111111111';
const FOLDER='22222222-2222-4222-8222-222222222222';
const input=new File([Buffer.from('%PDF-1.4\n% real protocol mock\n')],'evidencia.pdf',{type:'application/pdf'});

async function setup(reply='stream: OK'){
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'gd-av-end2end-'));
 const sock=path.join(base,'clamd.sock'),storageRoot=path.join(base,'storage');
 let scanned=0;
 const server=net.createServer(socket=>{
  let b=Buffer.alloc(0),mode='start';
  socket.on('data',data=>{
   b=Buffer.concat([b,data]);
   if(mode==='start'){
    if(b.length>=9&&b.subarray(0,9).toString('utf8')==='zVERSION\0'){
     socket.end('ClamAV 1.4.3/27999/Fri Nov 20 2026\0');mode='done';return;
    }
    if(b.length<10)return;
    if(b.subarray(0,10).toString('utf8')!=='zINSTREAM\0'){socket.destroy();return}
    b=b.subarray(10);mode='stream';
   }
   if(mode!=='stream')return;
   while(b.length>=4){
    const n=b.readUInt32BE(0);
    if(b.length<4+n)return;
    b=b.subarray(4+n);
    if(n===0){
     scanned++;
     socket.end(reply+'\0');
     mode='done';return;
    }
   }
  });
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(sock,resolve)});
 const storage=await DellStorage.initialize({
  root:storageRoot,masterKey:randomBytes(32),
  scanWithClamAV:createClamdScanner({socketPath:sock,timeoutMs:1000})
 });
 return {storage,storageRoot,scans:()=>scanned,async cleanup(){await new Promise(resolve=>server.close(resolve));await fs.rm(base,{recursive:true,force:true})}};
}
const put=storage=>storage.put({blob:input,schoolId:SCHOOL,ownerId:OWNER,folderId:FOLDER});
test('INSTREAM scan → AES-GCM encryption → private PDF authorization',async()=>{
 const f=await setup();
 try{
  const u=await put(f.storage);
  assert.equal(u.scan,'clean');assert.equal(f.scans(),1);
  const enc=await fs.readFile(path.join(f.storageRoot,'objects',SCHOOL,u.uploadId+'.enc'));
  assert.doesNotMatch(enc.toString('utf8'),/%PDF-1/);
  const bytes=await f.storage.read({fileId:u.uploadId,schoolId:SCHOOL,authorize:async()=>true});
  assert.deepEqual(bytes.bytes,Buffer.from(await input.arrayBuffer()));
  const manifest=JSON.parse(await fs.readFile(path.join(f.storageRoot,'objects',SCHOOL,u.uploadId+'.json'),'utf8'));
  assert.equal(manifest.scanEngine,'clamav');
 }finally{await f.cleanup()}
});
test('INSTREAM detection blocks file without persisting bytes',async()=>{
 const f=await setup('stream: Eicar-Test-Signature FOUND');
 try{
  await assert.rejects(put(f.storage),e=>e.code==='MALWARE_FOUND');
  assert.equal(f.storage.usage().usedBytes,0);
  assert.deepEqual(await fs.readdir(path.join(f.storageRoot,'objects')),[]);
  assert.deepEqual(await fs.readdir(path.join(f.storageRoot,'quarantine')),[]);
 }finally{await f.cleanup()}
});
test('INSTREAM ERROR blocks file without persisted manifest',async()=>{
 const f=await setup('stream: File size limit exceeded ERROR');
 try{
  await assert.rejects(put(f.storage),e=>e.code==='CLAMD_SCAN_ERROR');
  assert.equal(f.storage.usage().usedBytes,0);
 }finally{await f.cleanup()}
});
