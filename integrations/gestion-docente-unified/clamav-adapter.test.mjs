import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createClamdScanner} from './clamav-adapter.mjs';

async function mockClamd({version='ClamAV 1.4.3/27999/Fri Nov 20 2026',scan='stream: OK',silent=false,disconnect=false,responseRaw=null}={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'gdclam-'));
 const sock=path.join(dir,'clamd.sock');
 const file=path.join(dir,'example.pdf');
 const content=Buffer.from('%PDF-1.4\n% OFFLINE TEST FILE\n');
 await writeFile(file,content);
 let payloads=[];
 const server=createServer(socket=>{
  let incoming=Buffer.alloc(0),mode=null,data=[],total=0;
  socket.on('data',chunk=>{
   incoming=Buffer.concat([incoming,chunk]);
   if(mode===null){
    if(incoming.length<2)return;
    if(incoming.subarray(0,9).equals(Buffer.from('zVERSION\0'))){
     if(disconnect){socket.destroy();return}
     if(!silent){socket.write(Buffer.from((responseRaw??version)+'\0'));socket.end()}
     incoming=Buffer.alloc(0);mode='done';return;
    }
    if(incoming.length>=10&&incoming.subarray(0,10).equals(Buffer.from('zINSTREAM\0'))){
     incoming=incoming.subarray(10);mode='stream';
    }else if(incoming.length>=10){socket.destroy();return}
   }
   if(mode!=='stream')return;
   while(incoming.length>=4){
    const size=incoming.readUInt32BE(0);
    if(size>1000000){socket.destroy();return}
    if(incoming.length<4+size)return;
    incoming=incoming.subarray(4);
    if(size===0){
     payloads.push(Buffer.concat(data).toString('utf8'));
     if(disconnect){socket.destroy();return}
     if(!silent){socket.write(Buffer.from((responseRaw??scan)+'\0'));socket.end()}
     mode='done';return;
    }
    data.push(incoming.subarray(0,size));total+=size;
    incoming=incoming.subarray(size);
   }
  });
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(sock,resolve)});
 const scanner=createClamdScanner({socketPath:sock,timeoutMs:400});
 return {scanner,file,content,dir,payloads,close:async()=>{
  await new Promise(resolve=>server.close(resolve));
  await rm(dir,{recursive:true,force:true});
 }};
}
const denied=(fn,code)=>assert.rejects(fn,e=>e.code===code);
test('ClamAV real-protocol scanner streams PDF and validates daemon VERSION',async()=>{
 const f=await mockClamd();
 try{
  const r=await f.scanner({path:f.file,sizeBytes:f.content.length});
  assert.deepEqual(r,{clean:true,engine:'clamav',signatureVersion:'27999'});
  assert.deepEqual(f.payloads,[f.content.toString('utf8')]);
 }finally{await f.close()}
});
test('malware FOUND causes fail closed',async()=>{
 const f=await mockClamd({scan:'stream: Eicar-Test-Signature FOUND'});
 try{await denied(()=>f.scanner({path:f.file,sizeBytes:f.content.length}),'MALWARE_FOUND')}
 finally{await f.close()}
});
test('daemon ERROR not classified as clean',async()=>{
 const f=await mockClamd({scan:'stream: File size limit exceeded ERROR'});
 try{await denied(()=>f.scanner({path:f.file,sizeBytes:f.content.length}),'CLAMD_SCAN_ERROR')}
 finally{await f.close()}
});
test('fake version denied, not accepted as genuine scanner',async()=>{
 const f=await mockClamd({version:'Test mock antivirus version 2'});
 try{await denied(()=>f.scanner({path:f.file,sizeBytes:f.content.length}),'CLAMD_VERSION_INVALID')}
 finally{await f.close()}
});
test('incomplete no-response daemon must fail closed',async()=>{
 const f=await mockClamd({silent:true});
 try{await denied(()=>f.scanner({path:f.file,sizeBytes:f.content.length}),'CLAMD_TIMEOUT')}
 finally{await f.close()}
});
test('abrupt disconnect denied',async()=>{
 const f=await mockClamd({disconnect:true});
 try{
  await assert.rejects(()=>f.scanner({path:f.file,sizeBytes:f.content.length}),e=>['CLAMD_NO_REPLY','CLAMD_DISCONNECTED','CLAMD_UNAVAILABLE'].includes(e.code));
 }finally{await f.close()}
});
test('oversized daemon response denied',async()=>{
 const f=await mockClamd({responseRaw:'x'.repeat(3000)});
 try{await denied(()=>f.scanner({path:f.file,sizeBytes:f.content.length}),'CLAMD_REPLY_TOO_LARGE')}
 finally{await f.close()}
});
test('file size must exactly match source',async()=>{
 const f=await mockClamd();
 try{await denied(()=>f.scanner({path:f.file,sizeBytes:f.content.length+1}),'CLAMD_FILE_INVALID')}
 finally{await f.close()}
});
test('scanner cannot point to public remote host',()=>{
 for(const opts of [{host:'8.8.8.8',port:3310},{host:'evil.invalid',port:3310},{socketPath:'clam.sock'},{socketPath:'../../evil'},{host:'intranet-antivirus',port:4321}]){
  assert.throws(()=>createClamdScanner(opts),e=>e.code==='CLAMD_ENDPOINT_INVALID');
 }
});
test('scanner only allows fixed Docker service or local daemon endpoint',()=>{
 assert.equal(typeof createClamdScanner({host:'intranet-antivirus',port:3310}),'function');
 assert.equal(typeof createClamdScanner({host:'127.0.0.1',port:3310}),'function');
});
test('scanner refuses symlink to user-controlled file',async()=>{
 const f=await mockClamd();
 try{
  const {symlink}=await import('node:fs/promises');
  const link=path.join(f.dir,'link.pdf');await symlink(f.file,link);
  await denied(()=>f.scanner({path:link,sizeBytes:f.content.length}),'CLAMD_FILE_INVALID');
 }finally{await f.close()}
});
