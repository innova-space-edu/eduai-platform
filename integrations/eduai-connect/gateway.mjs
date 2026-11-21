// Independent server-side gateway. No service role, no browser token storage, no upstream URL input.
import { createHash } from 'node:crypto';
const PROJECT_ORIGIN='https://jfytmdvcqrjbbtyuklyf.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS={exams:'exam',plannings:'planning',documents:'document'};
const SCOPES=new Set(['exams:read','exams:content','plannings:read','plannings:content','documents:read','documents:content']);
const HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Type':'application/json; charset=utf-8','Referrer-Policy':'no-referrer'};
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const bad=()=>{throw new HttpError(400,'Solicitud inválida');};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...HEADERS,...extra}});
function bounded(v,def,max,min=0){if(v===undefined||v===null)return def;if(typeof v==='string'&&!/^\d+$/.test(v))bad();if(typeof v!=='number'&&typeof v!=='string')bad();const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)bad();return n;}
function uuid(v){if(typeof v!=='string'||!UUID.test(v))bad();return v;}
function scopes(v){if(!Array.isArray(v)||v.length<1||v.length>6||new Set(v).size!==v.length||!v.every(x=>SCOPES.has(x)))bad();return v;}
function kind(v){if(!['exam','planning','document'].includes(v))bad();return v;}
async function body(request){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))bad();
  const declared=request.headers.get('content-length');
  if(declared&&Number(declared)>16384)throw new HttpError(413,'Solicitud demasiado extensa');
  if(!request.body)bad();
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new HttpError(413,'Solicitud demasiado extensa');}chunks.push(value);}}
  finally{reader.releaseLock();}
  let b;try{b=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{bad();}
  if(!b||typeof b!=='object'||Array.isArray(b))bad();
  return b;
}
function only(obj,keys){if(Object.keys(obj).some(k=>!keys.includes(k)))bad();}
function page(params,content=false){
  for(const key of params.keys()){if(!['offset','limit'].includes(key)||params.getAll(key).length!==1)bad();}
  return {p_offset:bounded(params.get('offset'),0,content?1000000:10000),p_limit:bounded(params.get('limit'),content?12000:25,content?12000:100,1)};
}
function publicKey(key){
  if(typeof key!=='string')throw Error('Publishable key required');
  if(key.startsWith('sb_publishable_')&&key.length<2048)return key;
  // Legacy anon JWT only. Never accept a secret/service role key.
  try{const payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));if(key.split('.').length===3&&payload.role==='anon'&&key.length<2048)return key;}catch{}
  throw Error('Only a publishable or legacy anon key is accepted');
}
export function createHandler({supabaseUrl=PROJECT_ORIGIN,publishableKey,fetchImpl=fetch,now=Date.now}){
  if(new URL(supabaseUrl).origin!==PROJECT_ORIGIN||new URL(supabaseUrl).href!==PROJECT_ORIGIN+'/')throw Error('Unexpected EduAI project origin');
  const key=publicKey(publishableKey);
  // Single-instance rate limit, bounded memory. A distributed limiter is required before public multi-instance deployment.
  let windowStart=now(),total=0;const buckets=new Map();
  function limit(token){const t=now();if(t-windowStart>=60000){windowStart=t;total=0;buckets.clear();}
    if(++total>1200)throw new HttpError(429,'Demasiadas solicitudes');
    const id=createHash('sha256').update(token).digest('hex');
    const n=(buckets.get(id)||0)+1;if(n>60)throw new HttpError(429,'Demasiadas solicitudes');buckets.set(id,n);
  }
  async function rpc(name,args,token){
    let r;try{r=await fetchImpl(PROJECT_ORIGIN+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'});}catch{throw new HttpError(503,'EduAI no disponible');}
    const reader=r.body?.getReader();if(!reader)throw new HttpError(502,'Respuesta no válida');
    let size=0;const chunks=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024){await reader.cancel();throw new HttpError(502,'Respuesta demasiado extensa');}chunks.push(value);}}
    catch(e){if(e instanceof HttpError)throw e;throw new HttpError(503,'EduAI no disponible');}finally{reader.releaseLock();}
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(502,'Respuesta no válida');}
    if(!r.ok){
      if(r.status===401)throw new HttpError(401,'Sesión no válida');
      if(r.status===403||data?.code==='42501')throw new HttpError(403,'Acceso no autorizado');
      if(data?.code==='23505')throw new HttpError(409,'Ya existe una solicitud pendiente');
      if(data?.code==='22023')throw new HttpError(400,'Solicitud inválida o no disponible');
      throw new HttpError(502,'No fue posible completar la consulta');
    }
    return data;
  }
  return async function handler(request){
    try{
      const u=new URL(request.url),method=request.method.toUpperCase();
      if(u.pathname==='/health'&&method==='GET')return json({service:'eduai-connect',version:'0.1.0',status:'ready'});
      if(!u.pathname.startsWith('/api/connect/v1/'))return json({error:'Ruta no disponible'},404);
      const auth=request.headers.get('authorization')||'';
      if(auth.length>8192||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth))throw new HttpError(401,'Sesión requerida');
      const token=auth.slice(7);limit(token);
      const path=u.pathname.slice('/api/connect/v1/'.length);
      let args,fn;
      if(method==='GET'&&path==='status'){fn='eduai_connect_status';args=page(u.searchParams);}
      else if(method==='GET'&&path==='document-candidates'){fn='eduai_connect_document_candidates';args=page(u.searchParams);}
      else if(method==='GET'&&Object.hasOwn(KINDS,path)){fn='eduai_connect_catalog';args={p_kind:KINDS[path],...page(u.searchParams)};}
      else if(method==='GET'&&/^(exams|plannings|documents)\/[^/]+$/.test(path)){
        const [category,id]=path.split('/');fn='eduai_connect_read_text';args={p_kind:KINDS[category],p_id:uuid(id),...page(u.searchParams,true)};
      }else if(method==='POST'&&path==='requests'){
        if(u.search)bad();const b=await body(request);only(b,['kind','scopes','source_id']);
        const type=b.kind??'access';fn='eduai_connect_request';
        if(type==='access'){if(b.source_id!==undefined&&b.source_id!==null)bad();args={p_kind:type,p_scopes:scopes(b.scopes)};}
        else {if(b.scopes!==undefined&&(!Array.isArray(b.scopes)||b.scopes.length))bad();args={p_kind:kind(type),p_source_id:uuid(b.source_id),p_scopes:[]};}
      }else if(method==='GET'&&path==='admin/requests'){fn='eduai_connect_admin';args={p_action:'list',...page(u.searchParams)};}
      else if(method==='POST'&&path==='admin/decisions'){
        if(u.search)bad();const b=await body(request);only(b,['action','request_id','days','scopes','teacher_id','kind','source_id']);fn='eduai_connect_admin';
        if(b.action==='approve'||b.action==='reject'){
          if(b.teacher_id!==undefined||b.kind!==undefined||b.source_id!==undefined)bad();
          args={p_action:b.action,p_request_id:uuid(b.request_id)};
          if(b.action==='approve'){args.p_days=bounded(b.days,90,365,1);args.p_scopes=b.scopes===undefined?[]:scopes(b.scopes);}
          else if(b.days!==undefined||b.scopes!==undefined)bad();
        }else if(b.action==='revoke'||b.action==='revoke_resource'){
          if(b.request_id!==undefined||b.days!==undefined||b.scopes!==undefined)bad();
          args={p_action:b.action,p_teacher_id:uuid(b.teacher_id)};
          if(b.action==='revoke_resource'){args.p_kind=kind(b.kind);args.p_source_id=uuid(b.source_id);}else if(b.kind!==undefined||b.source_id!==undefined)bad();
        }else bad();
      }else return json({error:'Ruta no disponible'},404);
      return json(await rpc(fn,args,token),path==='requests'&&method==='POST'?201:200);
    }catch(e){return json({error:e instanceof HttpError?e.message:'Error interno'},e instanceof HttpError?e.status:500);}
  };
}
