/**
 * DellStorage V1 — offline staging adapter for HUB V2.
 * Uses private local filesystem and AES-256-GCM; authentication, permissions and
 * real ClamAV scanning MUST be injected by a trusted server before any deployment.
 * IMPORTANT: in-memory quota mutex only handles one process; use Dell PostgreSQL
 * transactions/locks for multi-process production. Never expose raw disk paths.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {randomBytes,randomUUID,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {TextDecoder} from 'node:util';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64=/^[a-f0-9]{64}$/;
const MIME={
 pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 csv:'text/csv',txt:'text/plain'
};
const LIMIT=20*1024*1024;
const NAME_BAD=/[/\\\u0000-\u001f\u007f]/;
function reject(code){throw Object.assign(new Error(code),{code})}
function id(x){if(typeof x!=='string'||!UUID.test(x))reject('INVALID_ID');return x.toLowerCase()}
function validName(x){
 if(typeof x!=='string'||!x||x.length>160||NAME_BAD.test(x)||x.trim()!==x||x.startsWith('.')||x.includes('..'))reject('BAD_FILENAME');
 const ext=x.split('.').at(-1).toLowerCase();
 if(!Object.hasOwn(MIME,ext))reject('FORMAT_UNSUPPORTED');
 return {name:x,ext,mediaType:MIME[ext]};
}
function protectDir(p){
 return fsp.lstat(p).then(s=>{if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o077)!==0)reject('UNSAFE_STORAGE_PATH')});
}
const sha=data=>createHash('sha256').update(data).digest('hex');
async function verifyMagic(file,ext){
 const fh=await fsp.open(file,'r');
 let first=Buffer.alloc(16),n;
 try{({bytesRead:n}=await fh.read(first,0,first.length,0))}
 finally{await fh.close()}
 if(ext==='pdf'){if(n<5||!first.subarray(0,5).equals(Buffer.from('%PDF-')))reject('CONTENT_MISMATCH')}
 else if(ext==='png'){if(n<8||!first.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))reject('CONTENT_MISMATCH')}
 else if(ext==='jpg'||ext==='jpeg'){if(n<4||first[0]!==255||first[1]!==216||first[2]!==255)reject('CONTENT_MISMATCH')}
 else if(ext==='xlsx'||ext==='docx'){if(n<4||!first.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04])))reject('CONTENT_MISMATCH')}
 else if(ext==='txt'||ext==='csv'){
  const b=await fsp.readFile(file);
  if(b.includes(0))reject('CONTENT_MISMATCH');
  try{new TextDecoder('utf-8',{fatal:true}).decode(b)}
  catch{reject('CONTENT_MISMATCH')}
 }
}
async function atomicWrite(target,data){
 const tmp=target+'.tmp-'+randomUUID();
 try{
  await fsp.writeFile(tmp,data,{flag:'wx',mode:0o600});
  await fsp.rename(tmp,target);
 }finally{await fsp.rm(tmp,{force:true}).catch(()=>{})}
}
export class DellStorage {
 #root;#scan;#inspectOOXML;#key;#maxFile;#maxSchool;#maxTotal;#now;
 #receipts=new Map();#gate=Promise.resolve();#used=0;#bySchool=new Map();
 constructor({root,masterKey,scanWithClamAV,inspectOOXML=null,maxFileBytes=LIMIT,maxSchoolBytes=5*1024**3,maxTotalBytes=80*1024**3,now=()=>Date.now()}){
  if(typeof root!=='string'||!path.isAbsolute(root)||root==='/'||!Buffer.isBuffer(masterKey)||masterKey.byteLength!==32||typeof scanWithClamAV!=='function'||typeof now!=='function')reject('STORAGE_CONFIG_REQUIRED');
  if(!Number.isSafeInteger(maxFileBytes)||maxFileBytes<=0||maxFileBytes>LIMIT||!Number.isSafeInteger(maxSchoolBytes)||maxSchoolBytes<maxFileBytes||!Number.isSafeInteger(maxTotalBytes)||maxTotalBytes<maxSchoolBytes)reject('INVALID_QUOTA');
  this.#root=path.resolve(root);this.#key=Buffer.from(masterKey);this.#scan=scanWithClamAV;this.#inspectOOXML=inspectOOXML;this.#maxFile=maxFileBytes;this.#maxSchool=maxSchoolBytes;this.#maxTotal=maxTotalBytes;this.#now=now;
 }
 static async initialize(cfg){
  const s=new DellStorage(cfg);
  await fsp.mkdir(s.#root,{recursive:true,mode:0o700});
  await protectDir(s.#root);
  for(const p of ['quarantine','objects']){const full=path.join(s.#root,p);await fsp.mkdir(full,{recursive:true,mode:0o700});await protectDir(full)}
  const schools=await fsp.readdir(path.join(s.#root,'objects'),{withFileTypes:true});
  for(const ent of schools){
   if(!ent.isDirectory()||!UUID.test(ent.name))reject('UNSAFE_STORAGE_PATH');
   const folder=path.join(s.#root,'objects',ent.name);
   await protectDir(folder);
   const entries=await fsp.readdir(folder,{withFileTypes:true});
   const encrypted=new Set(entries.filter(o=>o.isFile()&&o.name.endsWith('.enc')).map(o=>o.name.slice(0,-4)));
   const manifests=new Set();
   for(const obj of entries){
    if(!obj.isFile()||!obj.name.endsWith('.json')||!UUID.test(obj.name.slice(0,-5))) {
      if(obj.isFile()&&obj.name.endsWith('.enc')&&UUID.test(obj.name.slice(0,-4)))continue;
      reject('UNSAFE_STORAGE_PATH');
    }
    const meta=JSON.parse(await fsp.readFile(path.join(folder,obj.name),'utf8'));
    if(meta.schoolId!==ent.name||meta.id!==obj.name.slice(0,-5)||!Number.isSafeInteger(meta.sizeBytes)||meta.sizeBytes<1||meta.sizeBytes>s.#maxFile||!HEX64.test(meta.sha256)||meta.aadVersion!==1||!UUID.test(meta.ownerId)||!UUID.test(meta.folderId)||!encrypted.has(meta.id))reject('INVALID_MANIFEST');
    if(Buffer.from(meta.iv||'','base64url').length!==12||Buffer.from(meta.tag||'','base64url').length!==16)reject('INVALID_MANIFEST');
    const enc=path.join(folder,meta.id+'.enc'),stat=await fsp.lstat(enc);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==meta.sizeBytes)reject('INVALID_MANIFEST');
    manifests.add(meta.id);
    s.#used+=meta.sizeBytes;s.#bySchool.set(ent.name,(s.#bySchool.get(ent.name)||0)+meta.sizeBytes);
   }
   if(encrypted.size!==manifests.size)reject('ORPHAN_OBJECT_REQUIRES_RECONCILIATION');
  }
  return s;
 }
 async #lock(fn){
  const before=this.#gate;let done;
  this.#gate=new Promise(resolve=>{done=resolve});
  await before;
  try{return await fn()}finally{done()}
 }
 #objectDir(schoolId){return path.join(this.#root,'objects',schoolId)}
 async #prepareSchool(schoolId){
  const dir=this.#objectDir(schoolId);
  await fsp.mkdir(dir,{recursive:true,mode:0o700});await protectDir(dir);
  return dir;
 }
 async put({blob,schoolId,ownerId,folderId}){
  const school=id(schoolId),owner=id(ownerId),folder=id(folderId);
  if(!(blob instanceof Blob)||!blob.size||blob.size>this.#maxFile)reject('FILE_LIMIT');
  const {name,ext,mediaType}=validName(blob.name);
  if(blob.type&&blob.type!==mediaType)reject('MIME_MISMATCH');
  const uploadId=randomUUID();
  const tmp=path.join(this.#root,'quarantine',uploadId+'.pending');
  let fileHash=createHash('sha256'),bytes=0;
  try{
   const count=new Transform({transform(chunk,_enc,cb){bytes+=chunk.length;if(bytes>LIMIT)return cb(Object.assign(new Error('FILE_LIMIT'),{code:'FILE_LIMIT'}));fileHash.update(chunk);cb(null,chunk)}});
   await pipeline(Readable.fromWeb(blob.stream()),count,fs.createWriteStream(tmp,{flags:'wx',mode:0o600}));
   if(bytes!==blob.size||bytes<1)reject('FILE_TRUNCATED');
   await verifyMagic(tmp,ext);
   if(['docx','xlsx'].includes(ext)){
    if(typeof this.#inspectOOXML!=='function')reject('OOXML_INSPECTOR_REQUIRED');
    const ok=await this.#inspectOOXML({path:tmp,extension:ext,expectedMime:mediaType});
    if(ok?.verified!==true||ok.macroFree!==true||ok.noExternalLinks!==true||ok.safeSize!==true)reject('OOXML_REJECTED');
   }
   const digest=fileHash.digest('hex');
   const verdict=await this.#scan({path:tmp,sha256:digest,mediaType,sizeBytes:bytes});
   if(verdict?.clean!==true||verdict.engine!=='clamav'||typeof verdict.signatureVersion!=='string'||!verdict.signatureVersion.trim())reject('SCAN_REQUIRED');
   const result=await this.#lock(async()=>{
    if(this.#used+bytes>this.#maxTotal||(this.#bySchool.get(school)||0)+bytes>this.#maxSchool)reject('QUOTA_EXCEEDED');
    const dir=await this.#prepareSchool(school),iv=randomBytes(12),enc=path.join(dir,uploadId+'.enc');
    const cipher=createCipheriv('aes-256-gcm',this.#key,iv);
    cipher.setAAD(Buffer.from(JSON.stringify([school,uploadId,owner,folder,name,mediaType,bytes,digest])));
    try{
     await pipeline(fs.createReadStream(tmp),cipher,fs.createWriteStream(enc,{flags:'wx',mode:0o600}));
     const meta={id:uploadId,schoolId:school,ownerId:owner,folderId:folder,name,mediaType,sizeBytes:bytes,sha256:digest,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),createdAt:this.#now(),scanEngine:'clamav',scanSignatureVersion:verdict.signatureVersion,aadVersion:1};
     await atomicWrite(path.join(dir,uploadId+'.json'),JSON.stringify(meta));
     this.#used+=bytes;this.#bySchool.set(school,(this.#bySchool.get(school)||0)+bytes);
     this.#receipts.set(uploadId,{...meta,expiresAt:this.#now()+10*60*1000});
     return {uploadId,sha256:digest,sizeBytes:bytes,scan:'clean',encrypted:true};
    }catch(err){await fsp.rm(enc,{force:true}).catch(()=>{});throw err}
   });
   return result;
  }finally{await fsp.rm(tmp,{force:true}).catch(()=>{})}
 }
 async verifyReceipt({uploadId,actorId,schoolId,folderId}){
  const file=id(uploadId),owner=id(actorId),school=id(schoolId),folder=id(folderId);
  const item=this.#receipts.get(file);
  if(!item||item.ownerId!==owner||item.schoolId!==school||item.folderId!==folder||item.expiresAt<=this.#now())reject('RECEIPT_UNAVAILABLE');
  const dir=this.#objectDir(school);
  const record=JSON.parse(await fsp.readFile(path.join(dir,file+'.json'),'utf8'));
  if(record.sha256!==item.sha256||record.ownerId!==owner||record.folderId!==folder||record.schoolId!==school||
     record.scanEngine!=='clamav'||!record.scanSignatureVersion||record.scanSignatureVersion!==item.scanSignatureVersion)reject('RECEIPT_UNAVAILABLE');
  return {id:file,ownerId:owner,schoolId:school,folderId:folder,name:item.name,mediaType:item.mediaType,
    sizeBytes:item.sizeBytes,sha256:item.sha256,scanEngine:'clamav',scanSignatureVersion:record.scanSignatureVersion,
    clean:true,stored:true};
 }
 async consumeReceipt(uploadId){this.#receipts.delete(id(uploadId))}
 async read({fileId,schoolId,authorize}){
  const file=id(fileId),school=id(schoolId);
  if(typeof authorize!=='function')reject('AUTHORIZATION_REQUIRED');
  const dir=this.#objectDir(school),meta=JSON.parse(await fsp.readFile(path.join(dir,file+'.json'),'utf8'));
  if(meta.id!==file||meta.schoolId!==school)reject('FILE_UNAVAILABLE');
  const authorized=await authorize({fileId:file,schoolId:school,folderId:meta.folderId,ownerId:meta.ownerId});
  if(authorized!==true)reject('ACCESS_DENIED');
  const iv=Buffer.from(meta.iv,'base64url'),tag=Buffer.from(meta.tag,'base64url');
  if(iv.length!==12||tag.length!==16)reject('INVALID_MANIFEST');
  const encrypted=await fsp.readFile(path.join(dir,file+'.enc'));
  if(encrypted.length!==meta.sizeBytes||meta.aadVersion!==1)reject('INTEGRITY_FAILED');
  let plain;
  try{
   const dec=createDecipheriv('aes-256-gcm',this.#key,iv);dec.setAAD(Buffer.from(JSON.stringify([school,file,meta.ownerId,meta.folderId,meta.name,meta.mediaType,meta.sizeBytes,meta.sha256])));dec.setAuthTag(tag);
   plain=Buffer.concat([dec.update(encrypted),dec.final()]);
  }catch{reject('INTEGRITY_FAILED')}
  if(sha(plain)!==meta.sha256)reject('INTEGRITY_FAILED');
  return {name:meta.name,mediaType:meta.mediaType,bytes:plain,sha256:meta.sha256};
 }
 usage(){return {usedBytes:this.#used,bySchool:Object.fromEntries(this.#bySchool)}}
};
