/**
 * ClamAV clamd INSTREAM adapter for trusted Dell internal Docker network or
 * a Unix socket. No shell commands, user-supplied endpoints, or host file-path
 * submission. A result is CLEAN only if BOTH the clamd VERSION and INSTREAM
 * transactions succeeded. Fail closed on socket/timeouts/daemon ERROR.
 *
 * Production: configure an isolated private network to intranet-antivirus:3310
 * (verify clamd listens there). Never expose port 3310 to the Internet.
 */
import {createConnection} from 'node:net';
import {createReadStream} from 'node:fs';
import {lstat} from 'node:fs/promises';
import {once} from 'node:events';

const MAX_FILE = 20 * 1024 * 1024;
const MAX_REPLY = 2048;
const MAX_FRAME = 64 * 1024;
const timeoutError=code=>Object.assign(new Error(code),{code});
const reject=code=>{throw timeoutError(code)};
function validateEndpoint({socketPath,host,port}){
 if(socketPath!==undefined){
  if(typeof socketPath!=='string'||!socketPath.startsWith('/')||socketPath.length>180||socketPath.includes('\0')||host!==undefined||port!==undefined)reject('CLAMD_ENDPOINT_INVALID');
  return {path:socketPath};
 }
 if(!['intranet-antivirus','127.0.0.1'].includes(host)||port!==3310)reject('CLAMD_ENDPOINT_INVALID');
 return {host,port};
}
function responseReader(socket,timeoutMs){
 let onData,onError,onClose,onEnd;
 let timeout;
 const response = new Promise((resolve,rejectPromise)=>{
  const fail=code=>{cleanup();rejectPromise(timeoutError(code))};
  let fragments=[],count=0,ended=false;
  onData=(chunk)=>{
   count+=chunk.length;
   if(count>MAX_REPLY)return fail('CLAMD_REPLY_TOO_LARGE');
   fragments.push(chunk);
   const b=Buffer.concat(fragments);
   const zero=b.indexOf(0);
   if(zero<0)return;
   if(zero!==b.length-1)return fail('CLAMD_PROTOCOL_ERROR');
   ended=true;
   const answer=b.subarray(0,zero).toString('utf8');
   cleanup();resolve(answer);
  };
  onError=()=>fail('CLAMD_UNAVAILABLE');
  onEnd=()=>{if(!ended)fail('CLAMD_NO_REPLY')};
  onClose=()=>{if(!ended)fail('CLAMD_DISCONNECTED')};
  timeout=setTimeout(()=>{socket.destroy();fail('CLAMD_TIMEOUT')},timeoutMs);
  socket.on('data',onData);socket.on('error',onError);
  socket.on('end',onEnd);socket.on('close',onClose);
  function cleanup(){
   clearTimeout(timeout);
   socket.off('data',onData);socket.off('error',onError);
   socket.off('end',onEnd);socket.off('close',onClose);
  }
 });
 // Prevent unhandled early rejection before we finish writing the file.
 response.catch(()=>{});
 return response;
}
async function write(socket,buf){
 if(socket.destroyed)reject('CLAMD_DISCONNECTED');
 try{await new Promise((resolve,rejectPromise)=>socket.write(buf,err=>err?rejectPromise(err):resolve()))}
 catch{reject('CLAMD_UNAVAILABLE')}
}
async function connect(endpoint,timeoutMs){
 const socket=createConnection(endpoint);
 socket.setTimeout(timeoutMs,()=>socket.destroy(timeoutError('CLAMD_TIMEOUT')));
 try{await once(socket,'connect');return socket}
 catch{socket.destroy();reject('CLAMD_UNAVAILABLE')}
}
async function version(endpoint,timeoutMs){
 const socket=await connect(endpoint,timeoutMs);
 try{
  const response=responseReader(socket,timeoutMs);
  await write(socket,Buffer.from('zVERSION\0'));
  const result=await response;
  const match=/^ClamAV [A-Za-z0-9.+_~-]{1,50}\/([0-9]{2,10})(?:\/[^\r\n\x00]{1,128})?$/.exec(result);
  if(!match)reject('CLAMD_VERSION_INVALID');
  return match[1];
 }finally{socket.destroy()}
}
async function scan(endpoint,filename,sizeBytes,timeoutMs){
 const st=await lstat(filename);
 if(st.isSymbolicLink()||!st.isFile()||st.size!==sizeBytes||sizeBytes<=0||sizeBytes>MAX_FILE)reject('CLAMD_FILE_INVALID');
 const socket=await connect(endpoint,timeoutMs);
 try{
  const response=responseReader(socket,timeoutMs);
  await write(socket,Buffer.from('zINSTREAM\0'));
  let sent=0;
  for await (const frame of createReadStream(filename,{highWaterMark:MAX_FRAME})){
   sent+=frame.length;
   if(sent>sizeBytes||sent>MAX_FILE)reject('CLAMD_FILE_CHANGED');
   const length=Buffer.alloc(4);
   length.writeUInt32BE(frame.length);
   await write(socket,length);
   await write(socket,frame);
  }
  if(sent!==sizeBytes)reject('CLAMD_FILE_CHANGED');
  await write(socket,Buffer.alloc(4));
  const result=await response;
  if(result==='stream: OK')return true;
  if(/^stream: .{1,180} FOUND$/.test(result))reject('MALWARE_FOUND');
  reject('CLAMD_SCAN_ERROR');
 }finally{socket.destroy()}
}
export function createClamdScanner({socketPath,host,port,timeoutMs=120000}={}){
 const endpoint=validateEndpoint({socketPath,host,port});
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>300000)reject('CLAMD_TIMEOUT_INVALID');
 return async function scanWithClamAV({path:filename,sizeBytes}){
  if(typeof filename!=='string'||!filename.startsWith('/')||!Number.isSafeInteger(sizeBytes))reject('CLAMD_FILE_INVALID');
  const versionNumber=await version(endpoint,timeoutMs);
  await scan(endpoint,filename,sizeBytes,timeoutMs);
  return {clean:true,engine:'clamav',signatureVersion:versionNumber};
 };
}
