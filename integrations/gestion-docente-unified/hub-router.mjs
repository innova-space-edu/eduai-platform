/**
 * Management HUB BFF route contract — isolated, not deployable without real auth,
 * object storage and scanning. Caller injects trusted authenticate() and storeAndScan()
 * adapters. Browser-supplied userId, schoolId and upload receipt are NEVER trusted.
 */
import {renderWorkspace} from './hub-ui.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const H={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=(content,status=200)=>new Response(content,{status,headers:{...H,'Content-Type':'text/html; charset=utf-8'}});
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...H,'Content-Type':'application/json; charset=utf-8'}});
const redirect=()=>new Response(null,{status:303,headers:{...H,Location:'/'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status,publicCode:message})};
const getId=v=>{if(typeof v!=='string'||!UUID.test(v))fail('ID_INVALIDO');return v};
const getText=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('CAMPO_INVALIDO');return v.trim()};
const getDue=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('FECHA_INVALIDA');const n=Date.parse(v+'T23:59:59Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==v)fail('FECHA_INVALIDA');return n};
function parseTemplate(template){
 if(template==='evidence')return {form:[],minFiles:1};
 if(template==='form')return {form:[
  {key:'resultado',label:'Resultado de la actividad',type:'select',options:['Realizado','En progreso','No realizado'],required:true},
  {key:'observacion',label:'Descripción de lo realizado',type:'long_text',required:true}
 ],minFiles:0};
 if(template==='mixed')return {form:[
  {key:'descripcion',label:'Descripción de actividades',type:'long_text',required:true},
  {key:'fecha_realizacion',label:'Fecha de realización',type:'date',required:true}
 ],minFiles:1};
 fail('PLANTILLA_INVALIDA');
}
async function readForm(request,maxBytes){
 const declared=request.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes))fail('ARCHIVO_DEMASIADO_GRANDE',413);
 const reader=request.body?.getReader();
 if(!reader)fail('FORMULARIO_VACIO');
 const chunks=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>maxBytes){await reader.cancel();fail('ARCHIVO_DEMASIADO_GRANDE',413)}chunks.push(r.value)}}finally{reader.releaseLock()}
 const content=new Uint8Array(size);let position=0;for(const chunk of chunks){content.set(chunk,position);position+=chunk.byteLength}
 const req=new Request(request.url,{method:'POST',headers:request.headers,body:content});
 const type=request.headers.get('content-type')||'';
 if(type.startsWith('application/x-www-form-urlencoded'))return new URLSearchParams(new TextDecoder().decode(content));
 if(type.startsWith('multipart/form-data;'))return req.formData();
 fail('TIPO_NO_ADMITIDO',415);
}
function readAnswerValue(field,form){
 const s=form.get(field.key);
 if(s===null||s==='')return undefined;
 if(typeof s!=='string')fail('RESPUESTA_INVALIDA');
 if(field.type==='checkbox')return s==='true';
 if(field.type==='number'){const v=Number(s);if(!Number.isFinite(v))fail('RESPUESTA_INVALIDA');return v}
 return s;
}
function answersForTask(hub,token,schoolId,taskId,form){
 const task=hub.myTasks(token,schoolId).find(t=>t.id===taskId);
 if(!task)fail('TAREA_NO_ASIGNADA',403);
 const fields=new Set(['_csrf','action',...task.form.map(f=>f.key)]);
 for(const k of form.keys())if(!fields.has(k)||form.getAll(k).length!==1)fail('RESPUESTA_INVALIDA');
 return Object.fromEntries(task.form.map(f=>[f.key,readAnswerValue(f,form)]).filter(([,v])=>v!==undefined));
}
function renderReview(submission,taskId,userId,csrf){
 return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisar entrega · Gestión Docente</title><style>body{font:15px system-ui;max-width:800px;margin:40px auto;padding:20px;color:#192940}main{padding:24px;border:1px solid #d9e0ed;border-radius:14px}label{display:block;margin:12px 0 5px}textarea{width:100%;min-height:85px}button{background:#2f51a0;border:0;color:white;border-radius:8px;padding:9px 15px;margin-top:14px}pre{white-space:pre-wrap;word-break:break-word}</style></head><body><main><h1>Revisión de evidencia</h1><p>Estado: '+escape(submission.status)+'</p><h2>Respuestas</h2><pre>'+escape(JSON.stringify(submission.answers,null,2))+'</pre><h2>Archivos de evidencia</h2><p>Referencias registradas: '+submission.fileIds.length+'</p><p>Para abrir archivos reales se requerirá descarga autorizada desde el almacenamiento protegido.</p><form method="post" action="/admin/review"><input type="hidden" name="_csrf" value="'+escape(csrf)+'"><input type="hidden" name="taskId" value="'+escape(taskId)+'"><input type="hidden" name="userId" value="'+escape(userId)+'"><label>Observación si se devuelve</label><textarea name="returnReason" maxlength="500"></textarea><button name="decision" value="approve">Aprobar</button> <button name="decision" value="return">Devolver para corrección</button></form><p><a href="/?view=administrar">Volver a administración</a></p></main></body></html>';
}
export function createHubRouter({hub,authenticate,storeAndScan,readFromDell=null,sourceRegistry=null,origin='https://gestion-docente.innova-space-edu.cl'}){
 if(!hub||typeof authenticate!=='function'||typeof storeAndScan!=='function')throw new Error('Trusted adapters required');
 return async function handle(request){
  try{
   const u=new URL(request.url);
   if(u.origin!==origin)return json({error:'Host no autorizado'},403);
   if(!['GET','POST'].includes(request.method))return json({error:'Método no admitido'},405);
   const auth=await authenticate(request);
   if(!auth||typeof auth.token!=='string'||typeof auth.schoolId!=='string'||typeof auth.csrf!=='string'||auth.csrf.length<12)fail('SESION_REQUERIDA',401);
   const token=auth.token,schoolId=auth.schoolId;
   // Every hub method checks live verified session + school membership on each call.
   if(request.method==='GET'){
    const download=u.pathname.match(/^\/files\/([0-9a-f-]{36})\/download$/);
    if(download){
     if(typeof readFromDell!=='function')fail('ALMACENAMIENTO_NO_DISPONIBLE',503);
     if(u.search)fail('RUTA_INVALIDA',400);
     const fileId=getId(download[1]);
     const scope=hub.assertFileReadable(token,{schoolId,fileId});
     const result=await readFromDell({
      fileId:scope.fileId,schoolId:scope.schoolId,
      authorize:meta=>meta.fileId===scope.fileId&&meta.schoolId===scope.schoolId&&meta.folderId===scope.folderId&&meta.ownerId===scope.ownerId
     });
     if(!result||!Buffer.isBuffer(result.bytes)||result.bytes.length>20*1024*1024||typeof result.name!=='string'||!/^[^/\\\r\n"\x00-\x1f]{1,160}$/.test(result.name))fail('DESCARGA_NO_DISPONIBLE',503);
     const ascii=result.name.replace(/[^A-Za-z0-9._-]/g,'_');
     return new Response(result.bytes,{status:200,headers:{...H,'Content-Type':result.mediaType||'application/octet-stream','Content-Disposition':'attachment; filename="'+ascii+'"; filename*=UTF-8\'\''+encodeURIComponent(result.name),'Content-Length':String(result.bytes.length),'Content-Security-Policy':'sandbox'}});
    }
    if(u.pathname==='/admin/review'){
     if([...u.searchParams.keys()].some(k=>!['taskId','userId'].includes(k)))fail('FILTROS_INVALIDOS');
     const taskId=getId(u.searchParams.get('taskId')),userId=getId(u.searchParams.get('userId'));
     const submission=hub.readSubmission(token,{taskId,userId});
     return html(renderReview(submission,taskId,userId,auth.csrf));
    }
    if(u.pathname!=='/')return json({error:'Ruta inexistente'},404);
    const view=u.searchParams.get('view')||'inicio',query=u.searchParams.get('q')||'';
    if(query.length>100)fail('BUSQUEDA_INVALIDA');
    return html(renderWorkspace(hub,token,schoolId,{view,query,csrfToken:auth.csrf,sourceRegistry}));
   }
   if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')fail('ORIGEN_NO_AUTORIZADO',403);
   const isUpload=u.pathname==='/files/upload'||/^\/tasks\/[0-9a-f-]{36}\/upload$/.test(u.pathname);
   const form=await readForm(request,isUpload?20*1024*1024+16384:16384);
   if(form.get('_csrf')!==auth.csrf||form.getAll('_csrf').length!==1)fail('CSRF_INVALIDO',403);
   if(u.pathname==='/folders'){
    hub.createFolder(token,{schoolId,name:getText(form.get('name'),120)});return redirect();
   }
   if(u.pathname==='/admin/tasks'){
    const template=parseTemplate(form.get('template'));
    const keys=new Set(['_csrf','title','description','due','template','groups']);
    for(const k of form.keys())if(!keys.has(k))fail('FORMULARIO_INVALIDO');
    hub.createTask(token,{schoolId,title:getText(form.get('title'),160),description:form.get('description')||'',dueAt:getDue(form.get('due')),groups:form.getAll('groups'),...template});
    return redirect();
   }
   if(u.pathname==='/admin/banners'){
    for(const k of form.keys())if(!['_csrf','title','message','until','groups'].includes(k))fail('FORMULARIO_INVALIDO');
    hub.publishBanner(token,{schoolId,title:getText(form.get('title'),120),message:getText(form.get('message'),500),groups:form.getAll('groups'),until:getDue(form.get('until'))});
    return redirect();
   }
   if(u.pathname==='/admin/platforms'){
    for(const k of form.keys())if(!['_csrf','label','url'].includes(k)||form.getAll(k).length!==1)fail('FORMULARIO_INVALIDO');
    hub.addPlatformLink(token,{schoolId,label:getText(form.get('label'),80),url:getText(form.get('url'),1200)});
    return redirect();
   }
   if(u.pathname==='/admin/review'){
    for(const k of form.keys())if(!['_csrf','taskId','userId','decision','returnReason'].includes(k)||form.getAll(k).length!==1)fail('FORMULARIO_INVALIDO');
    const decision=form.get('decision');
    hub.reviewTask(token,{taskId:getId(form.get('taskId')),userId:getId(form.get('userId')),decision,returnReason:decision==='return'?getText(form.get('returnReason'),500):null});
    return redirect();
   }
   const match=u.pathname.match(/^\/tasks\/([0-9a-f-]{36})\/(save|upload)$/);
   if(!match&&u.pathname!=='/files/upload')return json({error:'Ruta inexistente'},404);
   const taskId=match?getId(match[1]):null;
   if(match?.[2]==='save'){
    const answers=answersForTask(hub,token,schoolId,taskId,form);
    const action=form.get('action');
    if(action==='save')hub.saveDraft(token,{taskId,answers});
    else if(action==='submit')hub.submitTask(token,{taskId,answers});
    else fail('ACCION_INVALIDA');
    return redirect();
   }
   if(!(form instanceof FormData))fail('ADJUNTO_REQUERIDO');
   for(const k of form.keys())if(!['_csrf','folderId','evidence'].includes(k)||form.getAll(k).length!==1)fail('FORMULARIO_INVALIDO');
   const folderId=getId(form.get('folderId'));
   const file=form.get('evidence');
   if(!(file instanceof File)||file.size===0||file.size>20*1024*1024)fail('ADJUNTO_INVALIDO');
   // Both task assignment and folder write permissions must be valid BEFORE storage.
   if(taskId)hub.assertTaskEvidenceWritable(token,taskId);
   const scope=hub.assertFolderWritable(token,{schoolId,folderId});
   const result=await storeAndScan({blob:file,schoolId:scope.schoolId,ownerId:scope.ownerId,folderId:scope.folderId});
   if(!result||typeof result.uploadId!=='string')fail('ALMACENAMIENTO_NO_DISPONIBLE',503);
   await hub.attachFile(token,{schoolId,folderId,uploadId:result.uploadId});
   if(taskId)hub.attachEvidence(token,{taskId,fileId:result.uploadId});
   return redirect();
  }catch(e){
   // Never expose system messages, paths, secrets or internal stack details.
   const candidate=typeof e?.publicCode==='string'?e.publicCode:
     typeof e?.code==='string'&&e.code.includes('_')?e.code:'';
   const msg=/^[A-Z][A-Z_0-9]{2,64}$/.test(candidate)?candidate:'ERROR_INTERNO';
   const status=msg==='ERROR_INTERNO'?500:
     Number.isInteger(e?.status)?e.status:
     msg.includes('SESSION')?401:
     msg.includes('CSRF')||msg.includes('NOT_')||msg.includes('ADMIN')||msg.includes('MFA')||msg.includes('ACCESS')?403:400;
   return json({error:msg},status);
  }
 };
}
