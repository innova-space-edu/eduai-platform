/**
 * Spawn a bundled, fixed Python OOXML validator. No shell and no user arguments
 * beyond a quarantine file path; output is a minimal Boolean verdict.
 * This checker rejects macros, external relationships and ZIP bombs; ClamAV
 * scanning of the same file remains mandatory and separate.
 */
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

const deny=code=>{throw Object.assign(new Error(code),{code})};
export function createOOXMLInspector({scriptPath,quarantineRoot,python='python3',timeoutMs=15000}={}){
 if(typeof scriptPath!=='string'||!path.isAbsolute(scriptPath)||typeof quarantineRoot!=='string'||!path.isAbsolute(quarantineRoot))deny('OOXML_CONFIG_INVALID');
 if(python!=='python3'||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000)deny('OOXML_CONFIG_INVALID');
 const root=path.resolve(quarantineRoot),script=path.resolve(scriptPath);
 return async function inspectOOXML({path:filename,extension}){
  if(typeof filename!=='string'||!path.isAbsolute(filename)||path.dirname(path.resolve(filename))!==root||!['docx','xlsx'].includes(extension))deny('OOXML_SCOPE_INVALID');
  const dir=await fs.lstat(root),f=await fs.lstat(filename);
  if(!dir.isDirectory()||dir.isSymbolicLink()||!f.isFile()||f.isSymbolicLink())deny('OOXML_SCOPE_INVALID');
  const child=spawn(python,['-I','-B',script,filename,extension],{shell:false,stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},windowsHide:true});
  let output='',errors='',finished=false;
  let time;
  try{
   const code=await new Promise((resolve,reject)=>{
    time=setTimeout(()=>{child.kill('SIGKILL');reject(Object.assign(new Error('OOXML_INSPECT_TIMEOUT'),{code:'OOXML_INSPECT_TIMEOUT'}))},timeoutMs);
    child.on('error',()=>reject(Object.assign(new Error('OOXML_INSPECT_UNAVAILABLE'),{code:'OOXML_INSPECT_UNAVAILABLE'})));
    child.stdout.on('data',x=>{output+=x.toString('utf8');if(output.length>2048){child.kill('SIGKILL');reject(Object.assign(new Error('OOXML_INSPECT_FAILED'),{code:'OOXML_INSPECT_FAILED'}))}});
    child.stderr.on('data',x=>{errors+=x.toString('utf8');if(errors.length>1024)child.kill('SIGKILL')});
    child.on('close',resolve);
   });
   if(code!==0)deny('OOXML_REJECTED');
   let verdict;
   try{verdict=JSON.parse(output)}catch{deny('OOXML_INSPECT_FAILED')}
   if(JSON.stringify(verdict)!=='{"verified":true,"macroFree":true,"noExternalLinks":true,"safeSize":true}')deny('OOXML_INSPECT_FAILED');
   return verdict;
  }finally{clearTimeout(time);if(child.exitCode===null)child.kill('SIGKILL')}
 };
}
