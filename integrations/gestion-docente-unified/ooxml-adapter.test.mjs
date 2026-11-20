import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createOOXMLInspector} from './ooxml-adapter.mjs';
import {DellStorage} from './dell-storage.mjs';

const SCRIPT=fileURLToPath(new URL('./inspect-ooxml.py',import.meta.url));
const SCHOOL='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 OWNER='11111111-1111-4111-8111-111111111111',
 FOLDER='22222222-2222-4222-8222-222222222222';
const DOCX='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gestion-ooxml-node-'));
 const quarantine=path.join(root,'quarantine');
 await fs.mkdir(quarantine);
 const inspector=createOOXMLInspector({scriptPath:SCRIPT,quarantineRoot:quarantine});
 const code=String.raw`
import sys,zipfile
filename,kind,mode=sys.argv[1:]
part='word/document.xml' if kind=='docx' else 'xl/workbook.xml'
mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml' if kind=='docx' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
content='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/'+part+'" ContentType="'+mime+'"/></Types>'
rels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="'+part+'"/></Relationships>'
with zipfile.ZipFile(filename,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('[Content_Types].xml',content)
  z.writestr('_rels/.rels',rels)
  z.writestr(part,'<root/>')
  if mode=='macro':z.writestr('word/vbaProject.bin',b'bad')
`;
 async function make(kind,mode='clean'){
  const filename=path.join(quarantine,mode+'-'+kind+'.'+kind);
  const p=spawnSync('python3',['-c',code,filename,kind,mode],{timeout:5000});
  assert.equal(p.status,0,p.stderr.toString());
  return filename;
 }
 return {root,quarantine,inspector,make,async close(){await fs.rm(root,{recursive:true,force:true})}};
}
const denied=(fn,code)=>assert.rejects(fn,e=>e.code===code);
test('isolated Python subprocess validates DOCX and XLSX',async()=>{
 const f=await fixture();
 try{
  const doc=await f.make('docx'),xlsx=await f.make('xlsx');
  assert.equal((await f.inspector({path:doc,extension:'docx'})).verified,true);
  assert.equal((await f.inspector({path:xlsx,extension:'xlsx'})).safeSize,true);
 }finally{await f.close()}
});
test('rejects macro ZIP and never reports safe file',async()=>{
 const f=await fixture();
 try{
  const doc=await f.make('docx','macro');
  await denied(()=>f.inspector({path:doc,extension:'docx'}),'OOXML_REJECTED');
 }finally{await f.close()}
});
test('cannot inspect files outside the protected quarantine root',async()=>{
 const f=await fixture();
 try{
  const doc=await f.make('docx');
  const out=path.join(f.root,'outside.docx');
  await fs.copyFile(doc,out);
  await denied(()=>f.inspector({path:out,extension:'docx'}),'OOXML_SCOPE_INVALID');
 }finally{await f.close()}
});
test('DellStorage accepts clean DOCX with inspector and encrypted output',async()=>{
 const f=await fixture();
 try{
  const doc=await f.make('docx'),file=new File([await fs.readFile(doc)],'planificacion.docx',{type:DOCX});
  const dir=path.join(f.root,'storage');
  const ins=createOOXMLInspector({scriptPath:SCRIPT,quarantineRoot:path.join(dir,'quarantine')});
  const storage=await DellStorage.initialize({root:dir,masterKey:randomBytes(32),inspectOOXML:ins,scanWithClamAV:async()=>({clean:true,engine:'clamav',signatureVersion:'SIMULATED'})});
  const up=await storage.put({blob:file,schoolId:SCHOOL,ownerId:OWNER,folderId:FOLDER});
  assert.equal(up.encrypted,true);
  const read=await storage.read({fileId:up.uploadId,schoolId:SCHOOL,authorize:async()=>true});
  assert.equal(Buffer.compare(read.bytes,await fs.readFile(doc)),0);
 }finally{await f.close()}
});
test('DellStorage accepts clean XLSX with inspector',async()=>{
 const f=await fixture();
 try{
  const xlsx=await f.make('xlsx'),file=new File([await fs.readFile(xlsx)],'planilla.xlsx',{type:XLSX});
  const dir=path.join(f.root,'storage');
  const ins=createOOXMLInspector({scriptPath:SCRIPT,quarantineRoot:path.join(dir,'quarantine')});
  const storage=await DellStorage.initialize({root:dir,masterKey:randomBytes(32),inspectOOXML:ins,scanWithClamAV:async()=>({clean:true,engine:'clamav',signatureVersion:'SIMULATED'})});
  const up=await storage.put({blob:file,schoolId:SCHOOL,ownerId:OWNER,folderId:FOLDER});
  assert.equal(up.encrypted,true);
  assert.equal((await storage.read({fileId:up.uploadId,schoolId:SCHOOL,authorize:async()=>true})).mediaType,XLSX);
 }finally{await f.close()}
});
