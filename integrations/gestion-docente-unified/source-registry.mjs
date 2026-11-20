/**
 * Optional source-index adapters for Gestión Docente. OFFLINE DESIGN CONTRACT.
 * No OAuth implementation, no email fetching, and no Napsis connection here.
 * Authorization, consent ticket verification, token custody and upstream checks
 * must be implemented by a trusted server before calling these methods.
 */
const PROVIDERS=Object.freeze({
 eduai_connect:{type:"educational",content:true,officialGrades:false},
 google_drive:{type:"cloud",content:true,officialGrades:false},
 google_docs:{type:"cloud",content:true,officialGrades:false},
 google_sheets:{type:"cloud",content:true,officialGrades:false},
 gmail:{type:"mail",content:false,officialGrades:false},
 google_calendar:{type:"calendar",content:false,officialGrades:false},
 napsis:{type:"school_system",content:false,officialGrades:true}
});
const TYPES=new Set(["evaluation","planning","folder","file","rubric","guide","document","other"]);
const SAFE=/^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const id=v=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v)&&v.length===36;
const key=(...x)=>x.join("|");
const error=code=>{throw Object.assign(new Error(code),{code})};
const secureTitle=v=>{if(typeof v!=="string"||!v.trim()||v.length>180||/[\u0000-\u001f\u007f]/.test(v))error("INVALID_METADATA");return v.trim()};
function urlOk(value){
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&u.hostname.includes(".")&&!["localhost","127.0.0.1"].includes(u.hostname)}catch{return false}
}
function cleanItem(raw,ownerId,provider){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>!["id","title","type","url","modifiedAt","ownerId"].includes(k)))error("INVALID_METADATA");
 if(!SAFE.test(raw.id)||raw.ownerId!==ownerId||!TYPES.has(raw.type)||!urlOk(raw.url)||!Number.isSafeInteger(raw.modifiedAt)||raw.modifiedAt<=0)error("INVALID_METADATA");
 return {id:raw.id,ownerId,provider,title:secureTitle(raw.title),type:raw.type,url:raw.url,modifiedAt:raw.modifiedAt};
}
export class SourceRegistry {
 #hub;#verifyConsent;#fetchMeta;#now;#connections=new Map();#items=new Map();
 constructor({hub,verifyConsentTicket,fetchMetadata,now=()=>Date.now()}){
  if(!hub||typeof verifyConsentTicket!=="function"||typeof fetchMetadata!=="function")error("TRUSTED_ADAPTER_REQUIRED");
  this.#hub=hub;this.#verifyConsent=verifyConsentTicket;this.#fetchMeta=fetchMetadata;this.#now=now;
 }
 availableProviders(){
  return Object.entries(PROVIDERS).map(([provider,v])=>({provider,type:v.type,officialGrades:v.officialGrades,content:v.content}));
 }
 #user(token,schoolId){
  const p=this.#hub.myProfile(token,schoolId);return {ownerId:p.userId,schoolId:p.schoolId};
 }
 async link(token,schoolId,{provider,consentTicket}){
  const {ownerId}=this.#user(token,schoolId);
  if(!Object.hasOwn(PROVIDERS,provider))error("INVALID_PROVIDER");
  if(provider==="napsis")error("OFFICIAL_API_NOT_CONNECTED");
  if(typeof consentTicket!=="string"||consentTicket.length<12||consentTicket.length>4096)error("CONSENT_REQUIRED");
  // Returns only a handle to a secret-store credential, never raw OAuth tokens.
  const granted=await this.#verifyConsent({ownerId,schoolId,provider,consentTicket});
  if(!granted?.verified||typeof granted.handle!=="string"||granted.handle.length<8||!Number.isSafeInteger(granted.expiresAt)||granted.expiresAt<=this.#now())error("CONSENT_REQUIRED");
  const k=key(schoolId,ownerId,provider);
  this.#connections.set(k,{handle:granted.handle,provider,ownerId,schoolId,expiresAt:granted.expiresAt,state:"connected",syncedAt:null,error:null});
  this.#items.delete(k);
  return {provider,connected:true};
 }
 unlink(token,schoolId,provider){
  const {ownerId}=this.#user(token,schoolId),k=key(schoolId,ownerId,provider);
  const entry=this.#connections.get(k);
  if(!entry)error("NOT_CONNECTED");
  this.#connections.delete(k);this.#items.delete(k);
  // In production the provider token must be revoked via the secret store.
  return {disconnected:true,provider};
 }
 async sync(token,schoolId,provider){
  const {ownerId}=this.#user(token,schoolId),k=key(schoolId,ownerId,provider),c=this.#connections.get(k);
  if(!c||!Object.hasOwn(PROVIDERS,provider))error("NOT_CONNECTED");
  if(c.expiresAt<=this.#now()){c.state="authorization_required";this.#items.delete(k);error("AUTHORIZATION_EXPIRED")}
  if(provider==="gmail"||provider==="google_calendar"){
   // Mail and calendar are not indexed until a separately approved integration
   // provides only necessary metadata; never collect message bodies here.
   return {provider,status:"connected",indexed:0,restricted:true};
  }
  const metadata=await this.#fetchMeta({provider,ownerId,schoolId,credentialHandle:c.handle});
  if(!Array.isArray(metadata)||metadata.length>500)error("INVALID_UPSTREAM");
  const items=metadata.map(r=>cleanItem(r,ownerId,provider));
  if(new Set(items.map(x=>x.id)).size!==items.length)error("INVALID_UPSTREAM");
  this.#items.set(k,items);c.syncedAt=this.#now();c.state="connected";c.error=null;
  return {provider,indexed:items.length,syncedAt:c.syncedAt};
 }
 status(token,schoolId){
  const {ownerId}=this.#user(token,schoolId);
  return Object.keys(PROVIDERS).map(provider=>{
   const c=this.#connections.get(key(schoolId,ownerId,provider));
   if(provider==="napsis")return {provider,state:"not_connected",officialData:"not_verifiable",syncedAt:null};
   if(!c)return {provider,state:"not_connected",syncedAt:null};
   if(c.expiresAt<=this.#now())return {provider,state:"authorization_required",syncedAt:c.syncedAt};
   const stale=c.syncedAt!==null&&this.#now()-c.syncedAt>24*3600000;
   return {provider,state:stale?"stale":c.state,syncedAt:c.syncedAt};
  });
 }
 searchOwn(token,schoolId,{query="",type=null}={}){
  const {ownerId}=this.#user(token,schoolId);
  if(typeof query!=="string"||query.length>100||type!==null&&!TYPES.has(type))error("INVALID_SEARCH");
  const needle=query.trim().toLocaleLowerCase("es-CL"),out=[];
  for(const provider of Object.keys(PROVIDERS)){
   const k=key(schoolId,ownerId,provider),c=this.#connections.get(k);
   if(!c||c.expiresAt<=this.#now()||c.state!=="connected")continue;
   if(PROVIDERS[provider].type==="mail"||PROVIDERS[provider].type==="calendar")continue;
   for(const item of this.#items.get(k)||[]){
    if(type&&item.type!==type)continue;
    if(needle&&!item.title.toLocaleLowerCase("es-CL").includes(needle))continue;
    out.push({...item});
    if(out.length>=100)return out;
   }
  }
  return out;
 }
 /* Do not convert task completion into an official Napsis status. */
 externalVerification(token,schoolId,{provider,kind}){
  this.#user(token,schoolId);
  if(provider!=="napsis"||!["grades","attendance","enrollment","course_reports"].includes(kind))error("INVALID_VERIFICATION");
  return {provider,kind,verified:false,status:"not_verifiable",reason:"official_api_not_connected"};
 }
}
