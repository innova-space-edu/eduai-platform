// A checkpoint contains no identity or credential. Its contents can only be
// decrypted after the server re-verifies the student and returns the attempt key.
export type AttemptCheckpoint = {
  baseSavedAt: string | null;
  saveId: string;
  parentSaveId: string | null;
  answers: {
    mcAnswers: Record<number, number>;
    devAnswers: Record<number, string>;
    tfJustifications: Record<number, string>;
    developmentArtifacts: Record<number, any>;
  };
  currentQuestionIndex: number;
  timeLeft: number;
};
const versions=new Map<string,number>();
const storageKey=(examId:string,attemptId:string)=>"eduai-exam-checkpoint-v2:"+examId+":"+attemptId;
function encode(bytes:Uint8Array){let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
function decode(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function key(credential:string){
  return crypto.subtle.importKey("raw",await crypto.subtle.digest("SHA-256",new TextEncoder().encode("eduai-checkpoint-v2:"+credential)),"AES-GCM",false,["encrypt","decrypt"]);
}
export async function saveCheckpoint(examId:string,attemptId:string,credential:string,value:AttemptCheckpoint):Promise<boolean>{
  if(!credential)return false;
  const id=storageKey(examId,attemptId),revision=(versions.get(id)||0)+1;
  versions.set(id,revision);
  try{
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(id)},await key(credential),new TextEncoder().encode(JSON.stringify(value)));
    if(versions.get(id)!==revision)return false;
    localStorage.setItem(id,JSON.stringify({iv:encode(iv),data:encode(new Uint8Array(ciphertext)),expires:Date.now()+24*60*60*1000}));
    return true;
  }catch{return false}
}
export async function recoverCheckpoint(examId:string,attemptId:string,credential:string,serverSavedAt:string|null,serverSaveId:string|null):Promise<AttemptCheckpoint|null>{
  try{
    const id=storageKey(examId,attemptId),raw=localStorage.getItem(id);
    if(!raw||!credential)return null;
    const envelope=JSON.parse(raw);
    if(envelope.expires<Date.now()){localStorage.removeItem(id);return null}
    const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(envelope.iv),additionalData:new TextEncoder().encode(id)},await key(credential),decode(envelope.data));
    const saved=JSON.parse(new TextDecoder().decode(plaintext)) as AttemptCheckpoint;
    if(!saved.answers||typeof saved.saveId!=="string"||saved.saveId===serverSaveId)return null;
    // Never overwrite newer server progress from a different session.
    if(saved.baseSavedAt!==serverSavedAt&&(!serverSaveId||saved.parentSaveId!==serverSaveId))return null;
    return saved;
  }catch{return null}
}
export function clearCheckpoint(examId:string,attemptId:string){
  const id=storageKey(examId,attemptId);versions.set(id,(versions.get(id)||0)+1);
  try{localStorage.removeItem(id)}catch{}
}
