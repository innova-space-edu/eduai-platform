/**
 * One Gestión Docente application, one domain, one login.
 * Combines the legacy EDUAI Worker identity/Connect and HUB V2 workflow under
 * a single same-origin facade. Candidate architecture, NOT DEPLOYED.
 *
 * Security: the EDUAI identity is verified on EVERY private request. A separate
 * trusted Dell membership adapter must resolve the current institutional role,
 * tenant, and a server-only Hub token. Neither UI role nor client school ID grants
 * permission. Only the Dell private API may persist files/tasks.
 */
import eduaiWorker,{requireEduaiIdentity} from '../gestion-docente-worker/worker.mjs';
import {createHubRouter} from './hub-router.mjs';
import {getConfigurationStatus} from './configuration-probes.mjs';

const SITE='https://gestion-docente.innova-space-edu.cl';
const HEADERS={
 'Cache-Control':'private, no-store, max-age=0',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses=new Set(['ready','pending','blocked','not_connected','stale']);
const defaultStatus=()=>[
 {id:'identity',label:'Cuenta EDUAI',status:'pending',detail:'Integración pendiente de prueba end-to-end'},
 {id:'membership',label:'Permisos institucionales',status:'pending',detail:'Validación Dell pendiente'},
 {id:'tasks',label:'Tareas y formularios',status:'pending',detail:'Persistencia PostgreSQL pendiente'},
 {id:'storage',label:'Archivos y carpetas Dell',status:'pending',detail:'Integración real de almacenamiento pendiente'},
 {id:'clamav',label:'Antivirus Dell',status:'pending',detail:'Conexión al proceso real pendiente'},
 {id:'eduai_connect',label:'EDUAI Connect',status:'pending',detail:'Verificación de permisos y contenido pendiente'},
 {id:'google',label:'Google Workspace',status:'not_connected',detail:'OAuth y sincronización no configurados'},
 {id:'napsis',label:'Napsis',status:'not_connected',detail:'Sin API oficial autorizada'},
 {id:'backup',label:'Respaldos y restauración',status:'pending',detail:'Restauración real pendiente'}
];
function json(o,status){return new Response(JSON.stringify(o),{status,headers:{...HEADERS,'Content-Type':'application/json; charset=utf-8'}})}
function html(o,status=200){return new Response(o,{status,headers:{...HEADERS,'Content-Type':'text/html; charset=utf-8'}})}
function configPage(profile,checks){
 const rows=checks.map(c=>'<tr><td>'+esc(c.label)+'</td><td><span class="state state-'+esc(c.status)+'">'+esc(c.status)+'</span></td><td>'+esc(c.detail)+'</td></tr>').join('');
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configuración · Gestión Docente</title><style>*{box-sizing:border-box}body{font:15px/1.6 system-ui;background:#f5f7fc;color:#192742;margin:0}header{background:#192e66;color:#fff;padding:22px max(18px,calc((100vw - 1000px)/2))}main{max-width:1000px;margin:24px auto;padding:0 18px}.panel{padding:22px;background:white;border:1px solid #dce3ed;border-radius:14px}.state{padding:4px 9px;border-radius:12px;background:#e8eef7}.state-ready{color:#126844;background:#e4f7ed}.state-blocked{color:#983b32;background:#fff0ee}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid #e5e8f0}a{color:#3150a5}.note{font-size:13px;color:#64718a}.scroll{overflow:auto}</style></head><body><header><h1>Gestión Docente</h1><p>Centro de configuración · '+esc(profile.schoolName)+'</p></header><main><p><a href="/workspace">Volver al panel</a> · <a href="/connect">EDUAI Connect</a></p><section class="panel"><h2>Estado de integración</h2><p class="note">Los estados proceden del backend o de verificaciones explícitas. Pendiente no significa conectado. No se exponen credenciales ni archivos privados.</p><div class="scroll"><table><thead><tr><th>Componente</th><th>Estado</th><th>Observación</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="note">Napsis se incorporará únicamente cuando exista una API oficial autorizada; no se replicará matrícula, asistencia ni notas oficiales.</p></section></main></body></html>';
}
function adaptHtml(raw){
 const nav='<div style="display:flex;flex-wrap:wrap;gap:14px;margin:8px 0 12px"><a href="/workspace">Inicio</a><a href="/workspace?view=tareas">Tareas</a><a href="/workspace?view=archivos">Archivos</a><a href="/connect">EDUAI Connect</a><a href="/workspace/configuration">Configuración</a><form method="post" action="/logout" style="display:inline"><button type="submit">Salir</button></form></div>';
 // Rewrite ONLY generated local absolute routes. No links to other origins.
 return raw.replace(/(href|action)="\/(?!\/)/g,(_,a)=>a+'="/workspace/').replace(/"\/workspace\/\?view/g,'"/workspace?view').replace(/"\/workspace\/"/g,'"/workspace"').replace('<main class="container">','<main class="container">'+nav);
}
async function adaptResponse(res,{workerResponse=false}={}){
 const h=new Headers(res.headers);h.set('Cache-Control','private, no-store, max-age=0');
 if(res.status===303&&h.get('Location')==='/'){h.set('Location','/workspace');return new Response(null,{status:303,headers:h})}
 if(workerResponse)return res;
 const type=h.get('content-type')||'';
 if(type.startsWith('text/html')){
  const raw=await res.text();
  const source=adaptHtml(raw);
  return new Response(source,{status:res.status,headers:h});
 }
 return res;
}
export function createUnifiedApp({
 hub,
 verifyInstitutionalAccess,
 storeAndScan,
 readFromDell,
 sourceRegistry=null,
 legacy=eduaiWorker,
 validateEduai=requireEduaiIdentity,
 probeConfiguration=getConfigurationStatus,
 origin=SITE
}={}){
 if(!hub||typeof verifyInstitutionalAccess!=='function'||typeof storeAndScan!=='function'||typeof validateEduai!=='function')throw new Error('Trusted backend adapters missing');
 async function trustedAuth(req,env){
  const identity=await validateEduai(req,env);
  if(!identity?.id)return null;
  const membership=await verifyInstitutionalAccess({userId:identity.id,identity});
  if(!membership||typeof membership.schoolId!=='string'||typeof membership.hubToken!=='string'||typeof membership.csrf!=='string')return null;
  return {token:membership.hubToken,schoolId:membership.schoolId,csrf:membership.csrf,identity};
 }
 const hubRouter=createHubRouter({
  hub,origin,storeAndScan,readFromDell,sourceRegistry,
  authenticate:async req=>{
   const env=envByRequest.get(req);
   // Exact trusted mapping is server-owned; never read institution from headers.
   const result=await trustedAuth(req,env);
   return result&&{token:result.token,schoolId:result.schoolId,csrf:result.csrf};
  }
 });
 // Local request scope only; no cross-request user records, credentials or token persistence.
 const envByRequest=new WeakMap();
 return {
  async fetch(request,env){
   const url=new URL(request.url),pathname=url.pathname;
   if(url.origin!==origin)return json({error:'ORIGEN_NO_AUTORIZADO'},404);
   const isWorkspace=pathname==='/workspace'||pathname.startsWith('/workspace/');
   if(!isWorkspace){
    if(pathname==='/'&&request.method==='GET'){
      return new Response(null,{status:303,headers:{...HEADERS,Location:'/workspace'}});
    }
    const r=await legacy.fetch(request,env);
    return adaptResponse(r,{workerResponse:true});
   }
   let auth;
   try{auth=await trustedAuth(request,env)}
   catch{return request.method==='GET'?new Response(null,{status:303,headers:{...HEADERS,Location:'/login'}}):json({error:'SESION_REQUERIDA'},401)}
   if(!auth)return request.method==='GET'?new Response(null,{status:303,headers:{...HEADERS,Location:'/login'}}):json({error:'SESION_REQUERIDA'},401);
   let role;
   try{role=hub.myProfile(auth.token,auth.schoolId)}catch{return json({error:'MEMBRESIA_NO_DISPONIBLE'},403)}
   if(pathname==='/workspace/configuration'){
    if(request.method!=='GET')return json({error:'METODO_NO_ADMITIDO'},405);
    if(!role.isAdministrative)return html('<h1>Acceso restringido</h1>',403);
    const observed=await probeConfiguration({identity:auth.identity,schoolId:auth.schoolId});
    const checks=Array.isArray(observed)&&observed.length<=25?observed:defaultStatus();
    if(!checks.every(c=>typeof c.id==='string'&&typeof c.label==='string'&&statuses.has(c.status)&&typeof c.detail==='string'))return json({error:'ESTADO_NO_DISPONIBLE'},503);
    return html(configPage({schoolName:role.schoolName},checks));
   }
   // The old Worker handles Connect and contexts; the HUB owns all /workspace routes.
   const routedPath=pathname==='/workspace'?'/':pathname.slice('/workspace'.length);
   const target=new URL(request.url);
   target.pathname=routedPath;
   const revised=new Request(target,{method:request.method,headers:request.headers,
     ...(request.method==='GET'||request.method==='HEAD'?{}:{body:request.body,duplex:'half'})});
   envByRequest.set(revised,env);
   return adaptResponse(await hubRouter(revised));
  }
 };
}
