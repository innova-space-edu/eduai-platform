/**
 * Gestión Docente HUB V2 — offline domain model, never deploy directly.
 * Sessions, receipt verification, actual file storage and malware checks MUST be
 * provided by trusted services in production. No credentials/binaries stored.
 */
import {randomUUID} from "node:crypto";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const GROUPS=Object.freeze(["administrativos","pie","orientacion_convivencia","utp","docentes","inspectoria","contabilidad","estudiantes","apoderados","otros"]);
const FORM_TYPES=new Set(["short_text","long_text","number","date","select","checkbox"]);
const SCOPES=new Set(["seguimiento:leer","contenido:revisar"]);
const TASK_STATES=new Set(["assigned","draft","submitted","returned","approved","cancelled"]);
const MIME_EXT=new Map([["pdf","application/pdf"],["docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],["xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],["csv","text/csv"],["png","image/png"],["jpg","image/jpeg"],["jpeg","image/jpeg"],["txt","text/plain"]]);
const err=(code)=>{throw new HubError(code)};
const validId=s=>typeof s==="string"&&UUID.test(s);
const vid=s=>{if(!validId(s))err("INVALID_ID");return s.toLowerCase()};
const text=(s,max=160)=>{if(typeof s!=="string"||!s.trim()||s.trim().length>max||/[\u0000-\u001f\u007f]/.test(s))err("INVALID_TEXT");return s.trim()};
const check=(v,code)=>{if(!v)err(code)};
const pair=(a,b)=>a+"|"+b;
const status=(task)=>task.status;
const fresh=(obj)=>structuredClone(obj);
const validateDate=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const HASH=/^[0-9a-f]{64}$/;
export class HubError extends Error{constructor(code){super(code);this.name="HubError";this.code=code}}

function normalizeSchema(fields){
 check(Array.isArray(fields)&&fields.length<=20,"INVALID_FORM");
 const used=new Set();
 return fields.map(f=>{
  check(f&&typeof f==="object"&&!Array.isArray(f)&&Object.keys(f).every(k=>["key","label","type","required","options"].includes(k)),"INVALID_FORM");
  const key=text(f.key,48);
  check(/^[a-z][a-z0-9_]*$/.test(key)&&!used.has(key),"INVALID_FORM");
  used.add(key);
  check(FORM_TYPES.has(f.type)&&typeof f.required==="boolean","INVALID_FORM");
  const label=text(f.label,100);
  let opts=[];
  if(f.type==="select"){
   check(Array.isArray(f.options)&&f.options.length>=2&&f.options.length<=20,"INVALID_FORM");
   opts=f.options.map(v=>text(v,80));
   check(new Set(opts).size===opts.length,"INVALID_FORM");
  }else check(f.options===undefined,"INVALID_FORM");
  return {key,label,type:f.type,required:f.required,options:opts};
 });
}
function validateResponses(schema,input){
 check(input&&typeof input==="object"&&!Array.isArray(input),"INVALID_RESPONSES");
 const keys=new Set(schema.map(f=>f.key));
 check(Object.keys(input).every(k=>keys.has(k)),"UNEXPECTED_FORM_FIELD");
 const answers={};
 for(const field of schema){
  const val=input[field.key],missing=val===undefined||val===null||val==="";
  if(missing){check(!field.required,"REQUIRED_FORM_FIELD");continue}
  if(["short_text","long_text"].includes(field.type)){
   check(typeof val==="string"&&val.length<=(field.type==="short_text"?200:4000)&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(val),"INVALID_FORM_VALUE");
  }else if(field.type==="number"){
   check(typeof val==="number"&&Number.isFinite(val)&&Math.abs(val)<=1e9,"INVALID_FORM_VALUE");
  }else if(field.type==="date"){
   check(validateDate(val),"INVALID_FORM_VALUE");
  }else if(field.type==="select"){
   check(field.options.includes(val),"INVALID_FORM_VALUE");
  }else if(field.type==="checkbox"){
   check(typeof val==="boolean","INVALID_FORM_VALUE");
   if(field.required)check(val===true,"REQUIRED_FORM_FIELD");
  }
  answers[field.key]=val;
 }
 return answers;
}
function validateReceipt(r,owner,school,folder){
 check(r&&typeof r==="object"&&!Array.isArray(r),"INVALID_RECEIPT");
 const keys=["id","ownerId","schoolId","folderId","name","mediaType","sizeBytes","sha256","clean","stored"];
 const allowed=[...keys,"scanEngine","scanSignatureVersion"];
 check(keys.every(k=>Object.hasOwn(r,k))&&Object.keys(r).every(k=>allowed.includes(k)),"INVALID_RECEIPT");
 if(Object.hasOwn(r,"scanEngine"))check(r.scanEngine==="clamav"&&typeof r.scanSignatureVersion==="string"&&r.scanSignatureVersion.length>=1&&r.scanSignatureVersion.length<=128,"INVALID_RECEIPT");
 check(vid(r.ownerId)===owner&&vid(r.schoolId)===school&&vid(r.folderId)===folder,"INVALID_RECEIPT");
 check(validId(r.id)&&r.clean===true&&r.stored===true,"INVALID_RECEIPT");
 check(typeof r.sizeBytes==="number"&&Number.isSafeInteger(r.sizeBytes)&&r.sizeBytes>0&&r.sizeBytes<=20*1024*1024,"FILE_LIMIT");
 check(typeof r.sha256==="string"&&HASH.test(r.sha256),"INVALID_RECEIPT");
 const name=text(r.name,160),ext=name.includes(".")?name.split(".").pop().toLowerCase():"";
 check(MIME_EXT.get(ext)===r.mediaType&&/^[^/\\]+$/.test(name)&&!name.startsWith("."),"FILE_TYPE_UNSUPPORTED");
 return {id:r.id,ownerId:owner,schoolId:school,folderId:folder,name,mediaType:r.mediaType,sizeBytes:r.sizeBytes,sha256:r.sha256};
}
export class GestionHub {
 #auth;#verifyUpload;#now;#operators;
 #schools=new Map();#members=new Map();#grants=[];
 #folders=new Map();#files=new Map();#usedReceipts=new Set();
 #tasks=new Map();#deliveries=new Map();#banners=new Map();#links=new Map();#notifications=[];#audit=[];
 constructor({verifySession,verifyUploadReceipt,platformOperators=[],now=()=>Date.now()}){
  check(typeof verifySession==="function"&&typeof verifyUploadReceipt==="function"&&typeof now==="function"&&Array.isArray(platformOperators),"INVALID_CONFIG");
  this.#auth=verifySession;this.#verifyUpload=verifyUploadReceipt;this.#now=now;
  this.#operators=new Set(platformOperators.map(vid));
 }
 #session(token,requireMfa=false){
  check(typeof token==="string"&&token.length>=3&&token.length<=4000,"SESSION_REQUIRED");
  const s=this.#auth(token);
  check(s&&s.verified===true&&validId(s.userId)&&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>this.#now(),"SESSION_INVALID");
  if(requireMfa)check(s.aal==="aal2","MFA_REQUIRED");
  return s.userId.toLowerCase();
 }
 #membership(actor,schoolId){
  const school=this.#schools.get(vid(schoolId));
  check(school?.state==="active","SCHOOL_UNAVAILABLE");
  const m=this.#members.get(pair(school.id,actor));
  check(m?.active===true&&m.expiresAt>this.#now(),"NOT_A_MEMBER");
  return {school,member:m};
 }
 #actor(token,schoolId){
  const actor=this.#session(token),{school,member}=this.#membership(actor,schoolId);
  return {actor,school,member};
 }
 #admin(token,schoolId){
  const actor=this.#session(token,true),{school,member}=this.#membership(actor,schoolId);
  check(member.group==="administrativos","ADMIN_REQUIRED");
  return {actor,school,member};
 }
 #log(event,actor,schoolId,meta={}){
  // Metadata-only audit: no answers, file bytes or private emails.
  this.#audit.push({id:randomUUID(),at:this.#now(),event,actorId:actor,schoolId,...meta});
 }
 #notify(userId,schoolId,type,referenceId){
  this.#notifications.push({id:randomUUID(),userId,schoolId,type,referenceId,createdAt:this.#now(),readAt:null});
 }
 provisionSchool(token,{id,name,adminUserId}){
  const actor=this.#session(token,true);
  check(this.#operators.has(actor),"PLATFORM_ADMIN_REQUIRED");
  const sid=vid(id),uid=vid(adminUserId);
  check(!this.#schools.has(sid),"SCHOOL_EXISTS");
  const school={id:sid,name:text(name,120),state:"active"};
  this.#schools.set(sid,school);
  this.#members.set(pair(sid,uid),{userId:uid,schoolId:sid,group:"administrativos",active:true,expiresAt:Number.MAX_SAFE_INTEGER});
  this.#log("school_provisioned",actor,sid);
  return {schoolId:sid};
 }
 addMember(token,{schoolId,userId,group,expiresAt}){
  const {actor,school}=this.#admin(token,schoolId),user=vid(userId);
  check(GROUPS.includes(group),"INVALID_GROUP");
  if(group==="administrativos")check(this.#operators.has(actor),"PLATFORM_ADMIN_REQUIRED");
  check(Number.isSafeInteger(expiresAt)&&expiresAt>this.#now()&&expiresAt<=this.#now()+366*86400000,"INVALID_EXPIRY");
  const key=pair(school.id,user),prior=this.#members.get(key);
  check(!prior?.active,"MEMBERSHIP_EXISTS");
  this.#members.set(key,{userId:user,schoolId:school.id,group,active:true,expiresAt});
  this.#log("member_added",actor,school.id,{memberId:user,group});
  return {ok:true};
 }
 revokeMember(token,{schoolId,userId}){
  const {actor,school}=this.#admin(token,schoolId),uid=vid(userId),m=this.#members.get(pair(school.id,uid));
  check(m?.active===true&&m.group!=="administrativos","MEMBERSHIP_NOT_REVOCABLE");
  m.active=false;this.#log("member_revoked",actor,school.id,{memberId:uid});
  return {revoked:true};
 }
 changeSchoolState(token,{schoolId,state}){
  const actor=this.#session(token,true);
  check(this.#operators.has(actor)&&["active","suspended"].includes(state),"PLATFORM_ADMIN_REQUIRED");
  const school=this.#schools.get(vid(schoolId));check(school,"SCHOOL_UNAVAILABLE");
  school.state=state;this.#log("school_state_changed",actor,school.id);
  return {state};
 }
 grantOversight(token,{schoolId,userId,scope,targetUserId=null,expiresAt}){
  const {actor,school}=this.#admin(token,schoolId),user=vid(userId),target=targetUserId?vid(targetUserId):null;
  check(SCOPES.has(scope),"INVALID_SCOPE");
  this.#membership(user,school.id);
  if(target)this.#membership(target,school.id);
  check(Number.isSafeInteger(expiresAt)&&expiresAt>this.#now()&&expiresAt<=this.#now()+366*86400000,"INVALID_EXPIRY");
  const g={id:randomUUID(),schoolId:school.id,userId:user,scope,targetUserId:target,expiresAt,revokedAt:null};
  this.#grants.push(g);this.#log("oversight_granted",actor,school.id,{grantId:g.id});
  return {id:g.id};
 }
 revokeOversight(token,{schoolId,grantId}){
  const {actor,school}=this.#admin(token,schoolId),g=this.#grants.find(g=>g.id===vid(grantId)&&g.schoolId===school.id&&g.revokedAt===null);
  check(g,"GRANT_NOT_FOUND");g.revokedAt=this.#now();this.#log("oversight_revoked",actor,school.id,{grantId:g.id});
  return {revoked:true};
 }
 #canOversee(actor,school,owner,scope){
  if(actor===owner)return true;
  return this.#grants.some(g=>g.schoolId===school&&g.userId===actor&&g.scope===scope&&g.revokedAt===null&&g.expiresAt>this.#now()&&(g.targetUserId===null||g.targetUserId===owner));
 }
 createFolder(token,{schoolId,name,parentId=null}){
  const {actor,school}=this.#actor(token,schoolId);
  const parent=parentId?this.#folders.get(vid(parentId)):null;
  if(parentId){
   check(parent?.schoolId===school.id&&this.#canWriteFolder(actor,parent),"FOLDER_NOT_WRITABLE");
   check(parent.depth<5,"FOLDER_DEPTH_LIMIT");
  }
  check(this.#folders.size<10000,"FOLDER_LIMIT");
  const folder={id:randomUUID(),schoolId:school.id,ownerId:actor,name:text(name,120),parentId:parent?.id||null,depth:parent?parent.depth+1:0,shares:[]};
  this.#folders.set(folder.id,folder);this.#log("folder_created",actor,school.id,{folderId:folder.id});
  return {id:folder.id};
 }
 #canReadFolder(actor,f){
  if(f.ownerId===actor)return true;
  const acl=f.shares.find(s=>s.userId===actor&&s.expiresAt>this.#now()&&s.revokedAt===null);
  if(acl)return true;
  if(f.parentId){const parent=this.#folders.get(f.parentId);return parent?this.#canReadFolder(actor,parent):false}
  return false;
 }
 #canWriteFolder(actor,f){
  if(f.ownerId===actor)return true;
  const acl=f.shares.find(s=>s.userId===actor&&s.permission==="editor"&&s.expiresAt>this.#now()&&s.revokedAt===null);
  if(acl)return true;
  if(f.parentId){const parent=this.#folders.get(f.parentId);return parent?this.#canWriteFolder(actor,parent):false}
  return false;
 }
 shareFolder(token,{schoolId,folderId,userId,permission,expiresAt}){
  const {actor,school}=this.#actor(token,schoolId),folder=this.#folders.get(vid(folderId)),uid=vid(userId);
  check(folder?.schoolId===school.id&&folder.ownerId===actor,"SHARE_NOT_ALLOWED");
  this.#membership(uid,school.id);
  check(permission==="viewer"||permission==="editor","INVALID_PERMISSION");
  check(Number.isSafeInteger(expiresAt)&&expiresAt>this.#now()&&expiresAt<=this.#now()+366*86400000,"INVALID_EXPIRY");
  check(!folder.shares.some(s=>s.userId===uid&&s.revokedAt===null),"SHARE_ALREADY_EXISTS");
  folder.shares.push({userId:uid,permission,expiresAt,revokedAt:null});
  this.#log("folder_shared",actor,school.id,{folderId:folder.id,sharedWith:uid});
  this.#notify(uid,school.id,"folder_shared",folder.id);
  return {shared:true};
 }
 revokeFolderShare(token,{schoolId,folderId,userId}){
  const {actor,school}=this.#actor(token,schoolId),f=this.#folders.get(vid(folderId)),uid=vid(userId);
  check(f?.schoolId===school.id&&f.ownerId===actor,"SHARE_NOT_ALLOWED");
  const g=f.shares.find(s=>s.userId===uid&&s.revokedAt===null);
  check(g,"SHARE_NOT_FOUND");g.revokedAt=this.#now();
  this.#log("folder_share_revoked",actor,school.id,{folderId:f.id,sharedWith:uid});
  return {revoked:true};
 }
 assertFolderWritable(token,{schoolId,folderId}){
  const {actor,school}=this.#actor(token,schoolId),folder=this.#folders.get(vid(folderId));
  check(folder?.schoolId===school.id&&this.#canWriteFolder(actor,folder),"FOLDER_NOT_WRITABLE");
  return {schoolId:school.id,folderId:folder.id,ownerId:actor};
 }
 async attachFile(token,{schoolId,folderId,uploadId}){
  const {actor,school}=this.#actor(token,schoolId),folder=this.#folders.get(vid(folderId));
  check(folder?.schoolId===school.id&&this.#canWriteFolder(actor,folder),"FOLDER_NOT_WRITABLE");
  const receipt=await this.#verifyUpload({uploadId:vid(uploadId),actorId:actor,schoolId:school.id,folderId:folder.id});
  const safe=validateReceipt(receipt,actor,school.id,folder.id);
  check(safe.id===vid(uploadId)&&!this.#usedReceipts.has(safe.id),"INVALID_RECEIPT");
  this.#usedReceipts.add(safe.id);
  const file={...safe,createdAt:this.#now()};this.#files.set(safe.id,file);
  this.#log("file_attached",actor,school.id,{fileId:safe.id,folderId:folder.id});
  return {fileId:safe.id,name:safe.name};
 }
 listMyFolders(token,schoolId){
  const {actor,school}=this.#actor(token,schoolId);
  return [...this.#folders.values()].filter(f=>f.schoolId===school.id&&this.#canReadFolder(actor,f)).map(f=>({id:f.id,name:f.name,parentId:f.parentId,ownerId:f.ownerId,writable:this.#canWriteFolder(actor,f)}));
 }
 #fileAccess(actor,school,fileId){
  const file=this.#files.get(vid(fileId));
  check(file?.schoolId===school,"FILE_UNAVAILABLE");
  const folder=this.#folders.get(file.folderId);
  check(folder&&this.#canReadFolder(actor,folder),"FILE_UNAVAILABLE");
  return file;
 }
 assertFileReadable(token,{schoolId,fileId}){
  const {actor,school}=this.#actor(token,schoolId),f=this.#files.get(vid(fileId));
  check(f?.schoolId===school.id,"FILE_UNAVAILABLE");
  this.#membership(f.ownerId,school.id);
  const folder=this.#folders.get(f.folderId);
  const access=folder&&(
    this.#canReadFolder(actor,folder)||
    this.#canOversee(actor,school.id,f.ownerId,"contenido:revisar")
  );
  check(access,"FILE_UNAVAILABLE");
  this.#log("file_read_authorized",actor,school.id,{fileId:f.id,ownerId:f.ownerId});
  return {fileId:f.id,schoolId:school.id,folderId:f.folderId,ownerId:f.ownerId,actorId:actor};
 }
 listFiles(token,{schoolId,folderId}){
  const {actor,school}=this.#actor(token,schoolId),f=this.#folders.get(vid(folderId));
  check(f?.schoolId===school.id&&this.#canReadFolder(actor,f),"FOLDER_UNAVAILABLE");
  return [...this.#files.values()].filter(x=>x.folderId===f.id).map(x=>({id:x.id,name:x.name,mediaType:x.mediaType,sizeBytes:x.sizeBytes,ownerId:x.ownerId}));
 }
 searchFiles(token,{schoolId,query="",ownerId=null}){
  const {actor,school}=this.#actor(token,schoolId),owner=ownerId?vid(ownerId):null;
  if(owner)this.#membership(owner,school.id);
  check(typeof query==="string"&&query.length<=100,"INVALID_QUERY");
  const needle=query.toLocaleLowerCase("es-CL").trim(),result=[];
  for(const file of this.#files.values()){
   if(file.schoolId!==school.id)continue;
   if(owner&&file.ownerId!==owner)continue;
   const member=this.#members.get(pair(school.id,file.ownerId));
   if(!member?.active||member.expiresAt<=this.#now())continue;
   const folder=this.#folders.get(file.folderId);
   if(!folder)continue;
   if(!this.#canReadFolder(actor,folder)&&!this.#canOversee(actor,school.id,file.ownerId,"contenido:revisar"))continue;
   if(needle&&!file.name.toLocaleLowerCase("es-CL").includes(needle))continue;
   result.push({id:file.id,name:file.name,mediaType:file.mediaType,ownerId:file.ownerId,folderId:file.folderId,sizeBytes:file.sizeBytes});
   if(result.length>=100)break;
  }
  this.#log("file_search",actor,school.id,{resultCount:result.length});
  return result;
 }
  createTask(token,{schoolId,title,description="",dueAt,groups=[],users=[],form=[],minFiles=0}){
  const {actor,school}=this.#admin(token,schoolId);
  check(Number.isSafeInteger(dueAt)&&dueAt>this.#now()&&dueAt<=this.#now()+366*86400000,"INVALID_DUE");
  check(Array.isArray(groups)&&groups.length<=GROUPS.length&&groups.every(g=>GROUPS.includes(g)),"INVALID_GROUP");
  check(Array.isArray(users)&&users.length<=300&&users.every(validId),"INVALID_RECIPIENT");
  check(Number.isInteger(minFiles)&&minFiles>=0&&minFiles<=5,"INVALID_FILE_REQUIREMENT");
  check(this.#tasks.size<5000,"TASK_LIMIT");
  const schema=normalizeSchema(form),recipientIds=new Set(users.map(vid));
  for(const m of this.#members.values()){
   if(m.schoolId===school.id&&m.active&&m.expiresAt>this.#now()&&groups.includes(m.group))recipientIds.add(m.userId);
  }
  check(recipientIds.size>=1&&recipientIds.size<=300,"NO_RECIPIENTS");
  for(const uid of recipientIds)this.#membership(uid,school.id);
  check(schema.length+minFiles>0,"EVIDENCE_REQUIREMENT_MISSING");
  const task={id:randomUUID(),schoolId:school.id,createdBy:actor,title:text(title,160),description:description?text(description,2000):"",dueAt,createdAt:this.#now(),form:schema,minFiles,groups:[...new Set(groups)]};
  this.#tasks.set(task.id,task);
  for(const userId of recipientIds){
   const submission={taskId:task.id,schoolId:school.id,userId,status:"assigned",answers:{},fileIds:[],submittedAt:null,reviewedAt:null,reviewerId:null,revision:0,returnReason:null};
   this.#deliveries.set(pair(task.id,userId),submission);this.#notify(userId,school.id,"task_assigned",task.id);
  }
  this.#log("task_created",actor,school.id,{taskId:task.id,recipientCount:recipientIds.size});
  return {taskId:task.id,assigned:recipientIds.size};
 }
 #delivery(token,taskId,{admin=false}={}){
  const id=vid(taskId),task=this.#tasks.get(id);
  check(task,"TASK_NOT_FOUND");
  const scope=admin?this.#admin(token,task.schoolId):this.#actor(token,task.schoolId);
  const del=this.#deliveries.get(pair(task.id,scope.actor));
  if(!admin)check(del,"TASK_NOT_ASSIGNED");
  return {task,delivery:del,actor:scope.actor,schoolId:scope.school.id};
 }
 saveDraft(token,{taskId,answers}){
  const {task,delivery,actor,schoolId}=this.#delivery(token,taskId);
  check(["assigned","draft","returned"].includes(status(delivery)),"TASK_READ_ONLY");
  // Draft may be incomplete, but any supplied field must still have valid type.
  const draftSchema=task.form.map(f=>({...f,required:false}));
  const valid=validateResponses(draftSchema,answers);
  delivery.answers=valid;delivery.status="draft";delivery.revision++;
  this.#log("task_draft_saved",actor,schoolId,{taskId:task.id});
  return {status:"draft",revision:delivery.revision};
 }
 assertTaskEvidenceWritable(token,taskId){
  const {task,delivery}=this.#delivery(token,taskId);
  check(["assigned","draft","returned"].includes(delivery.status),"TASK_READ_ONLY");
  return {taskId:task.id};
 }
  attachEvidence(token,{taskId,fileId}){
  const {task,delivery,actor,schoolId}=this.#delivery(token,taskId);
  check(["assigned","draft","returned"].includes(delivery.status),"TASK_READ_ONLY");
  const file=this.#fileAccess(actor,schoolId,fileId);
  check(file.ownerId===actor,"FILE_NOT_OWNED");
  check(delivery.fileIds.length<20&&!delivery.fileIds.includes(file.id),"EVIDENCE_LIMIT");
  delivery.fileIds.push(file.id);delivery.status="draft";delivery.revision++;
  this.#log("task_evidence_added",actor,schoolId,{taskId:task.id,fileId:file.id});
  return {attached:true};
 }
 submitTask(token,{taskId,answers}){
  const {task,delivery,actor,schoolId}=this.#delivery(token,taskId);
  check(["assigned","draft","returned"].includes(delivery.status),"TASK_READ_ONLY");
  const valid=validateResponses(task.form,answers);
  check(delivery.fileIds.length>=task.minFiles,"EVIDENCE_REQUIRED");
  // Recheck evidence ownership, live share and storage status in caller adapter before real production submission.
  for(const fileId of delivery.fileIds){const file=this.#fileAccess(actor,schoolId,fileId);check(file.ownerId===actor,"FILE_NOT_OWNED");}
  delivery.answers=valid;delivery.status="submitted";delivery.submittedAt=this.#now();delivery.returnReason=null;delivery.revision++;
  this.#notify(task.createdBy,schoolId,"task_submitted",task.id);
  this.#log("task_submitted",actor,schoolId,{taskId:task.id});
  return {status:"submitted",approved:false};
 }
 reviewTask(token,{taskId,userId,decision,returnReason=null}){
  const {task,actor,schoolId}=this.#delivery(token,taskId,{admin:true}),uid=vid(userId);
  check(decision==="approve"||decision==="return","INVALID_DECISION");
  const delivery=this.#deliveries.get(pair(task.id,uid));
  check(delivery?.schoolId===schoolId&&delivery.status==="submitted","TASK_NOT_REVIEWABLE");
  this.#membership(uid,schoolId);
  check(task.createdBy===actor||this.#canOversee(actor,schoolId,uid,"contenido:revisar"),"REVIEW_NOT_ALLOWED");
  if(decision==="return")delivery.returnReason=text(returnReason,500);
  else check(returnReason===null,"INVALID_DECISION");
  delivery.status=decision==="approve"?"approved":"returned";delivery.reviewedAt=this.#now();delivery.reviewerId=actor;delivery.revision++;
  this.#notify(uid,schoolId,decision==="approve"?"task_approved":"task_returned",task.id);
  this.#log(decision==="approve"?"task_approved":"task_returned",actor,schoolId,{taskId:task.id,assigneeId:uid});
  return {status:delivery.status};
 }
 #visibleTask(actor,schoolId,task,delivery){
  if(delivery?.userId===actor)return true;
  if(task.createdBy===actor)return true;
  return delivery?this.#canOversee(actor,schoolId,delivery.userId,"seguimiento:leer"):false;
 }
 myProfile(token,schoolId){
  const {actor,school,member}=this.#actor(token,schoolId);
  return {userId:actor,schoolId:school.id,schoolName:school.name,group:member.group,isAdministrative:member.group==="administrativos"};
 }
 myTasks(token,schoolId){
  const {actor,school}=this.#actor(token,schoolId);
  return [...this.#deliveries.values()].filter(d=>d.schoolId===school.id&&d.userId===actor).map(d=>{
   const t=this.#tasks.get(d.taskId);
   return {id:t.id,title:t.title,description:t.description,dueAt:t.dueAt,form:fresh(t.form),minFiles:t.minFiles,status:d.status,fileCount:d.fileIds.length,revision:d.revision,returnReason:d.returnReason};
  });
 }
 searchTasks(token,{schoolId,status:filterStatus=null,group=null,userId=null,textQuery=""}){
  const {actor,school}=this.#actor(token,schoolId);
  if(filterStatus!==null)check(TASK_STATES.has(filterStatus),"INVALID_STATE");
  if(group!==null)check(GROUPS.includes(group),"INVALID_GROUP");
  const target=userId?vid(userId):null,query=typeof textQuery==="string"?textQuery.trim().toLowerCase():"";
  check(query.length<=100,"INVALID_QUERY");
  if(target)this.#membership(target,school.id);
  const out=[];
  for(const d of this.#deliveries.values()){
   if(d.schoolId!==school.id)continue;
   const task=this.#tasks.get(d.taskId),m=this.#members.get(pair(school.id,d.userId));
   if(!m?.active||m.expiresAt<=this.#now())continue;
   if(!this.#visibleTask(actor,school.id,task,d))continue;
   if(filterStatus&&d.status!==filterStatus)continue;
   if(group&&m.group!==group)continue;
   if(target&&d.userId!==target)continue;
   if(query&&!task.title.toLowerCase().includes(query)&&!task.description.toLowerCase().includes(query))continue;
   out.push({taskId:task.id,title:task.title,assigneeId:d.userId,group:m.group,status:d.status,dueAt:task.dueAt,submittedAt:d.submittedAt,reviewedAt:d.reviewedAt,overdue:task.dueAt<this.#now()&&!["approved","cancelled"].includes(d.status),reviewable:d.status==="submitted"&&task.createdBy===actor});
  }
  this.#log("task_search",actor,school.id,{resultCount:out.length});
  return out;
 }
 readSubmission(token,{taskId,userId}){
  const task=this.#tasks.get(vid(taskId));check(task,"TASK_NOT_FOUND");
  const {actor,school}=this.#actor(token,task.schoolId),schoolId=school.id,uid=vid(userId);
  const d=this.#deliveries.get(pair(task.id,uid));
  check(d?.schoolId===schoolId,"RESOURCE_UNAVAILABLE");
  this.#membership(uid,schoolId);
  const own=uid===actor,creator=task.createdBy===actor;
  const delegated=this.#canOversee(actor,schoolId,uid,"contenido:revisar");
  check(own||creator||delegated,"RESOURCE_UNAVAILABLE");
  if(!own)check(["submitted","returned","approved"].includes(d.status),"RESOURCE_UNAVAILABLE");
  this.#log("submission_content_read",actor,schoolId,{taskId:task.id,assigneeId:uid});
  return {taskId:task.id,userId:uid,status:d.status,answers:fresh(d.answers),fileIds:[...d.fileIds],returnReason:d.returnReason,revision:d.revision};
 }
 listNotifications(token,schoolId){
  const {actor,school}=this.#actor(token,schoolId);
  return this.#notifications.filter(x=>x.userId===actor&&x.schoolId===school.id).map(x=>({...x}));
 }
 publishBanner(token,{schoolId,title,message,groups=[],until}){
  const {actor,school}=this.#admin(token,schoolId);
  check(Array.isArray(groups)&&groups.length<=GROUPS.length&&groups.every(x=>GROUPS.includes(x)),"INVALID_GROUP");
  check(Number.isSafeInteger(until)&&until>this.#now()&&until<=this.#now()+90*86400000,"INVALID_EXPIRY");
  const b={id:randomUUID(),schoolId:school.id,title:text(title,120),message:text(message,500),groups:[...new Set(groups)],until,createdBy:actor};
  this.#banners.set(b.id,b);this.#log("banner_published",actor,school.id,{bannerId:b.id});
  return {id:b.id};
 }
 myBanners(token,schoolId){
  const {school,member}=this.#actor(token,schoolId);
  return [...this.#banners.values()].filter(x=>x.schoolId===school.id&&x.until>this.#now()&&(x.groups.length===0||x.groups.includes(member.group))).map(x=>({title:x.title,message:x.message,id:x.id}));
 }
 addPlatformLink(token,{schoolId,label,url}){
  const {actor,school}=this.#admin(token,schoolId);
  check(typeof url==="string"&&url.length<=1200,"INVALID_URL");
  let u;try{u=new URL(url)}catch{err("INVALID_URL")}
  check(u.protocol==="https:"&&u.hostname.includes(".")&&!u.username&&!u.password&&!u.hash&&!["localhost","127.0.0.1","0.0.0.0"].includes(u.hostname),"INVALID_URL");
  const row={id:randomUUID(),schoolId:school.id,label:text(label,80),url:u.toString()};
  this.#links.set(row.id,row);this.#log("platform_link_added",actor,school.id,{linkId:row.id});
  return {id:row.id};
 }
 myPlatformLinks(token,schoolId){
  const {school}=this.#actor(token,schoolId);
  return [...this.#links.values()].filter(x=>x.schoolId===school.id).map(x=>({id:x.id,label:x.label,url:x.url}));
 }
 audit(token,schoolId){
  const {actor,school}=this.#admin(token,schoolId);
  return this.#audit.filter(x=>x.schoolId===school.id).map(fresh);
 }
}
