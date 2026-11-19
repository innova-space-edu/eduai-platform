// Gestión Docente independent Cloudflare Worker. No admin key, no token in HTML or URLs.
const HOST='gestion-docente.innova-space-edu.cl', ORIGIN='https://'+HOST, EDU='https://eduai.innova-space-edu.cl', DB='https://jfytmdvcqrjbbtyuklyf.supabase.co';
const POLICY='2026-10-11-v1', COOKIE='__Host-gestion_session', UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds={exams:'exam',plannings:'planning',documents:'document'};
const scopes=['exams:read','exams:content','plannings:read','plannings:content','documents:read','documents:content'];
const labels={'exams:read':'Listar evaluaciones','exams:content':'Leer evaluaciones cerradas','plannings:read':'Listar planificaciones','plannings:content':'Leer planificaciones','documents:read':'Listar documentos','documents:content':'Leer documentos'};
const levels=[['parvularia','Educación parvularia',2],['basica','Enseñanza básica',8],['media','Enseñanza media',4]];
const periods=[['semestre_1','Primer semestre'],['semestre_2','Segundo semestre'],['anual','Anual'],['trimestre_1','Primer trimestre'],['trimestre_2','Segundo trimestre'],['trimestre_3','Tercer trimestre']];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'Strict-Transport-Security':'max-age=31536000','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
const cookie=(value,age=900)=>COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age;
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...H,'Content-Type':'application/json; charset=utf-8'}});
const redirect=(path,token)=>new Response(null,{status:303,headers:{...H,Location:path,...(token!==undefined?{'Set-Cookie':cookie(token,token?900:0)}:{})}});
const style="*{box-sizing:border-box}body{margin:0;background:#f5f7fc;color:#18243b;font:15px/1.55 system-ui,sans-serif}header{background:#fff;border-bottom:1px solid #e0e6f0;display:flex;align-items:center;justify-content:space-between;padding:16px 5vw;gap:12px;flex-wrap:wrap}a{color:#354da5;text-decoration:none}a:hover{text-decoration:underline}.brand{font-weight:800;color:#243d89;font-size:20px}.shell{max-width:1160px;margin:36px auto;padding:0 20px}.hero{background:linear-gradient(125deg,#243d89,#5265bd);color:white;border-radius:20px;padding:28px;margin-bottom:20px}.hero p{color:#e4e9ff}.hero h1{margin:0;font-size:30px}.panel{background:white;border:1px solid #dce3ef;border-radius:16px;padding:22px;margin:16px 0;overflow-wrap:anywhere}.login{max-width:460px;margin:40px auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}label{display:block;font-weight:600;margin:10px 0 4px}input,select,button{font:inherit}input:not([type=checkbox]),select{width:100%;padding:10px;border:1px solid #bcc7da;border-radius:8px;background:white;color:#17243d}button,.btn{display:inline-block;border:0;border-radius:8px;padding:10px 16px;background:#354da5;color:white;font-weight:650;cursor:pointer}button:hover,.btn:hover{background:#243d89;text-decoration:none}.muted{color:#5e6b81;font-size:13px}.notice{background:#eef2ff;border:1px solid #cdd8ff;border-radius:9px;padding:12px}.err{color:#a12020;background:#fff1f1;padding:12px;border-radius:8px}nav{display:flex;gap:14px;flex-wrap:wrap}table{width:100%;border-collapse:collapse}td,th{padding:11px 8px;text-align:left;border-bottom:1px solid #edf0f5}th{font-size:12px;color:#5c6980}.scroll{overflow:auto}h2{font-size:20px;margin:0 0 12px}h3{font-size:16px;margin:12px 0 5px}footer{padding:15px;text-align:center;color:#68758c;font-size:12px}form.inline{display:inline}pre{white-space:pre-wrap;word-break:break-word}.tag{display:inline-block;background:#e8edfb;color:#304696;padding:3px 9px;border-radius:999px;font-size:12px}";
function html(title,body,{status=200,logged=false}={}){return new Response('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+escape(title)+' · Gestión Docente</title><style>'+style+'</style></head><body><header><a class="brand" href="/">EDUAI · Gestión Docente</a><nav><a href="'+EDU+'/dashboard">Volver a EduAI</a>'+(logged?'<a href="/connect">Connect</a><form class="inline" action="/logout" method="post"><button>Cerrar sesión</button></form>':'')+'</nav></header><main class="shell">'+body+'</main><footer>Innova Space Education · <a href="'+EDU+'/privacidad">Privacidad</a> · <a href="'+EDU+'/terminos">Condiciones</a></footer></body></html>',{status,headers:{...H,'Content-Type':'text/html; charset=utf-8'}});}
function login(message='',status=200){return html('Ingresar','<section class="hero"><h1>Tu espacio de gestión docente</h1><p>Cursos, evaluaciones, planificaciones y recursos en un entorno privado.</p></section><section class="panel login"><h2>Iniciar sesión con EduAI</h2><p class="muted">Usa tu cuenta docente existente. La sesión de esta aplicación es independiente y dura hasta 15 minutos.</p>'+(message?'<p class="err">'+escape(message)+'</p>':'')+'<form action="/login" method="post"><label for="email">Correo</label><input id="email" name="email" type="email" autocomplete="username" maxlength="254" required><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="1024" required><label for="totp">Código de autenticador (si tienes MFA)</label><input id="totp" name="totp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"><p class="muted">Si debes actualizar tu perfil o tus condiciones, hazlo primero en <a href="'+EDU+'/login">EduAI</a>.</p><button>Ingresar</button></form></section>',{status});}
class E extends Error{constructor(status,msg){super(msg);this.status=status;}}
async function upstream(env,path,{token,method='GET',body,prefer}={}){
 if(!env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'))throw new E(503,'Configuración no disponible');
 const headers={apikey:env.SUPABASE_PUBLISHABLE_KEY,accept:'application/json',...(token?{authorization:'Bearer '+token}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})};
 let r;try{r=await fetch(DB+path,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw new E(503,'EduAI no disponible');}
 if(!r.ok){if(r.status===401)throw new E(401,'Sesión no válida');if(r.status===403)throw new E(403,'Acceso no autorizado');if(r.status===429)throw new E(429,'Demasiados intentos');if(r.status===409)throw new E(409,'Ya existe un registro o solicitud');if(r.status===400||r.status===422)throw new E(400,'Solicitud no disponible');throw new E(502,'No fue posible consultar EduAI');}
 if(r.status===204)return null;
 const reader=r.body?.getReader();if(!reader)throw new E(502,'Respuesta no disponible');
 let n=0;const chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>1024*1024){await reader.cancel();throw new E(502,'Respuesta demasiado extensa');}chunks.push(value);}}finally{reader.releaseLock();}
 const b=new Uint8Array(n);let o=0;for(const c of chunks){b.set(c,o);o+=c.length;}try{return JSON.parse(new TextDecoder().decode(b));}catch{throw new E(502,'Respuesta no válida');}
}
const rpc=(env,t,name,body={})=>upstream(env,'/rest/v1/rpc/'+name,{token:t,method:'POST',body});
const rows=(env,t,table,query)=>upstream(env,'/rest/v1/'+table+'?'+new URLSearchParams(query),{token:t});
function tokenOf(req){const raw=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));if(raw.length!==1)return '';const t=raw[0].slice(COOKIE.length+1);return t.length<=7800&&/^[\w-]+\.[\w-]+\.[\w-]+$/.test(t)?t:'';}
function claims(t){try{const p=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(p));}catch{return {};}}
async function userState(env,t){
 if(!t)throw new E(401,'Inicia sesión');
 const user=await upstream(env,'/auth/v1/user',{token:t});
 if(!UUID.test(user?.id||'')||!user.email_confirmed_at||user.is_anonymous||user.deleted_at)throw new E(403,'Cuenta no habilitada');
 const verified=(user.factors||[]).filter(f=>f.status==='verified');
 if(verified.length&&claims(t).aal!=='aal2')throw new E(403,'Se requiere doble factor');
 const [access,privacy,admins]=await Promise.all([
   rows(env,t,'eduai_user_access',{select:'account_type,age_band,access_tier,birth_date',user_id:'eq.'+user.id,limit:'1'}),
   rows(env,t,'eduai_privacy_choices',{select:'policy_version,terms_acknowledged_at,data_warning_acknowledged_at',user_id:'eq.'+user.id,limit:'1'}),
   rows(env,t,'admin_emails',{select:'email',email:'eq.'+user.email,limit:'1'}).catch(()=>[])
 ]);
 const a=access[0],p=privacy[0];
 if(p?.policy_version!==POLICY||!p.terms_acknowledged_at||!p.data_warning_acknowledged_at)throw new E(403,'Actualiza primero las condiciones de privacidad en EduAI.');
 const teacher=a?.account_type==='teacher'&&a.age_band==='adult'&&['standard','teacher','admin'].includes(a.access_tier);
 const admin=admins.length===1&&claims(t).aal==='aal2';
 if(!teacher&&!admin)throw new E(403,'Acceso reservado a docentes o administradores autorizados.');
 let status=null;if(teacher)status=await rpc(env,t,'eduai_connect_status',{p_offset:0,p_limit:25});
 // Admin RPC independently checks live session and MFA before every privileged action.
 return {user,teacher,admin,status,t};
}
async function form(req){
 const type=req.headers.get('content-type')||'';
 if(!type.startsWith('application/x-www-form-urlencoded'))throw new E(400,'Formulario inválido');
 const length=Number(req.headers.get('content-length')||0);if(length>16384)throw new E(413,'Formulario demasiado extenso');
 const r=req.body?.getReader();if(!r)throw new E(400,'Formulario vacío');
 const chunks=[];let size=0;try{while(true){const {done,value}=await r.read();if(done)break;size+=value.byteLength;if(size>16384){await r.cancel();throw new E(413,'Formulario demasiado extenso');}chunks.push(value);}}finally{r.releaseLock();}
 const data=new Uint8Array(size);let o=0;for(const c of chunks){data.set(c,o);o+=c.length;}return new URLSearchParams(new TextDecoder().decode(data));
}
function validateId(id){if(!UUID.test(id||''))throw new E(400,'Identificador inválido');return id;}
function context(form){
 const level=form.get('level'),l=levels.find(x=>x[0]===level),g=Number(form.get('grade')),year=Number(form.get('year')),section=(form.get('section')||'').trim().toUpperCase(),institution=(form.get('institution')||'').trim(),subject=(form.get('subject')||'').trim(),period=form.get('period');
 if(!l||!Number.isInteger(g)||g<1||g>l[2]||!/^\d{4}$/.test(form.get('year')||'')||year<2000||year>2100||!institution||institution.length>160||!subject||subject.length>120||!/^[A-Z0-9]{0,12}$/.test(section)||!periods.some(x=>x[0]===period))throw new E(400,'Revisa los datos del curso.');
 return {institution_label:institution,academic_year:year,education_level:level,grade:g,section,subject,period};
}
function formContext(){return '<form method="post" action="/contexts"><div class="grid"><div><label>Establecimiento</label><input name="institution" required maxlength="160"></div><div><label>Año</label><input name="year" type="number" min="2000" max="2100" required value="'+new Date().getUTCFullYear()+'"></div><div><label>Nivel</label><select name="level">'+levels.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></div><div><label>Grado (NT1=1, NT2=2)</label><input name="grade" type="number" min="1" max="8" required value="1"></div><div><label>Sección</label><input name="section" maxlength="12" placeholder="A"></div><div><label>Asignatura</label><input name="subject" maxlength="120" required></div><div><label>Periodo</label><select name="period">'+periods.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></div></div><p><button>Crear curso</button></p></form>';}
const gradeLabel=r=>r.education_level==='parvularia'?'NT'+r.grade:r.grade+'° '+(r.education_level==='basica'?'Básico':'Medio');
async function home(env,s){
 let content='<section class="hero"><h1>Gestión Docente</h1><p>Organiza tu actividad académica y consulta tus recursos de EduAI.</p><span class="tag">Versión inicial · Contextos personales</span></section>';
 if(s.admin)content+='<section class="panel"><h2>Administración de Connect</h2><a class="btn" href="/admin">Revisar solicitudes</a></section>';
 if(s.teacher){
 const list=await rows(env,s.t,'eduai_teacher_contexts',{select:'id,institution_label,academic_year,education_level,grade,section,subject,period',teacher_id:'eq.'+s.user.id,archived_at:'is.null',order:'academic_year.desc,created_at.desc',limit:'100'});
 content+='<section class="panel"><h2>Mis cursos</h2><p class="muted">Contextos privados. No habilitan acceso a un establecimiento ni a estudiantes.</p><div class="scroll"><table><thead><tr><th>Establecimiento</th><th>Año</th><th>Curso</th><th>Asignatura</th><th>Periodo</th><th></th></tr></thead><tbody>'+list.map(r=>'<tr><td>'+escape(r.institution_label)+'</td><td>'+escape(r.academic_year)+'</td><td>'+escape(gradeLabel(r)+' '+r.section)+'</td><td>'+escape(r.subject)+'</td><td>'+escape(periods.find(x=>x[0]===r.period)?.[1])+'</td><td><form method="post" action="/contexts/archive"><input type="hidden" name="id" value="'+escape(r.id)+'"><button>Archivar</button></form></td></tr>').join('')+'</tbody></table></div>'+(list.length?'':'<p class="muted">Aún no has creado cursos.</p>')+'<h3>Nuevo contexto académico</h3>'+formContext()+'</section><section class="panel"><h2>EDUAI Connect</h2><p>Consulta evaluaciones, planificaciones y documentos mediante permisos independientes.</p><a class="btn" href="/connect">Probar integración</a></section>';
 }
 return html('Inicio',content,{logged:true});
}
async function connect(env,s){
 if(!s.teacher)throw new E(403,'Cuenta docente requerida');
 const a=s.status.access;const active=a?.active===true;
 let h='<section class="hero"><h1>EDUAI Connect</h1><p>Prueba privada de la API de consulta. No concede acceso a otros docentes ni a notas.</p></section><section class="panel"><h2>Autorización</h2><p>'+ (active?'<span class="tag">Activa</span>':'<span class="tag">Sin autorización activa</span>')+'</p>';
 if(active)h+='<p>'+escape((a.scopes||[]).map(x=>labels[x]||x).join(' · '))+'</p><p class="muted">Vence: '+escape(a.expires_at)+'</p>';
 h+='<form action="/connect/request" method="post"><h3>Solicitar acceso</h3>'+scopes.map(x=>'<label><input type="checkbox" name="scope" value="'+x+'"> '+escape(labels[x])+'</label>').join('')+'<p><button>Enviar solicitud</button></p></form><h3>Mis solicitudes</h3>'+s.status.requests.map(r=>'<p>'+escape(r.kind)+' · '+escape(r.status)+' · '+escape(r.created_at)+'</p>').join('')+'</section>';
 if(active){for(const [path,k] of Object.entries(kinds)){const prefix=path==='exams'?'exams':path==='plannings'?'plannings':'documents';if(!a.scopes.includes(prefix+':read')&&!a.scopes.includes(prefix+':content'))continue;let list=[];try{const q=path==='documents'&&a.scopes.includes('documents:content')?await rpc(env,s.t,'eduai_connect_document_candidates',{p_offset:0,p_limit:25}):await rpc(env,s.t,'eduai_connect_catalog',{p_kind:k,p_offset:0,p_limit:25});list=q.items||[];}catch{}
 h+='<section class="panel"><h2>'+escape(path==='exams'?'Evaluaciones':path==='plannings'?'Planificaciones':'Documentos')+'</h2><p><a href="/api/connect/v1/'+path+'">Consultar JSON de la API</a></p>'+list.map(r=>'<div><h3>'+escape(r.title)+'</h3><p class="muted">'+escape(r.status||r.subject||r.asset_type||'')+'</p>'+(a.scopes.includes(prefix+':content')&&(k!=='exam'||r.status==='closed')?'<form method="post" action="/connect/resource"><input type="hidden" name="kind" value="'+k+'"><input type="hidden" name="id" value="'+escape(r.id)+'"><button>Solicitar lectura</button> <a href="/api/connect/v1/'+path+'/'+escape(r.id)+'">Leer JSON</a></form>':'')+'</div>').join('')+'</section>';}}
 return html('Connect',h,{logged:true});
}
async function adminPage(env,s){
 if(!s.admin)throw new E(403,'Administrador con MFA requerido');
 const data=await rpc(env,s.t,'eduai_connect_admin',{p_action:'list',p_offset:0,p_limit:100});
 const h='<section class="hero"><h1>Administrar Connect</h1><p>Autorizaciones por docente y recurso · MFA obligatorio</p></section><section class="panel"><h2>Solicitudes</h2>'+data.items.map(r=>'<div class="panel"><h3>'+escape(r.email)+' · '+escape(r.kind)+'</h3><p>'+escape(r.status)+' · '+escape(r.source_id||'')+'</p>'+(r.status==='pending'?'<form method="post" action="/admin/decision"><input type="hidden" name="request_id" value="'+escape(r.id)+'">'+(r.kind==='access'?r.scopes.map(x=>'<label><input type="checkbox" name="scope" value="'+escape(x)+'" checked> '+escape(labels[x]||x)+'</label>').join(''):'')+'<label>Vigencia (días)</label><input type="number" name="days" min="1" max="365" value="90"><p><button name="action" value="approve">Aprobar</button> <button name="action" value="reject">Rechazar</button></p></form>':'')+(r.access_expires_at&&!r.access_revoked_at?'<form method="post" action="/admin/decision"><input type="hidden" name="teacher_id" value="'+escape(r.teacher_id)+'"><button name="action" value="revoke">Revocar acceso docente</button></form>':'')+(r.kind!=='access'&&r.status==='approved'?'<form method="post" action="/admin/decision"><input type="hidden" name="teacher_id" value="'+escape(r.teacher_id)+'"><input type="hidden" name="kind" value="'+escape(r.kind)+'"><input type="hidden" name="source_id" value="'+escape(r.source_id)+'"><button name="action" value="revoke_resource">Revocar recurso</button></form>':'')+'</div>').join('')+(data.items.length?'':'<p>No hay solicitudes.</p>')+'</section>';
 return html('Administración',h,{logged:true});
}
function pagination(u,content=false){const keys=[...u.searchParams.keys()];if(keys.some(k=>!['offset','limit'].includes(k)||u.searchParams.getAll(k).length!==1))throw new E(400,'Parámetros inválidos');const read=(k,d,max,min)=>{const v=u.searchParams.get(k);if(v===null)return d;if(!/^\d+$/.test(v)||Number(v)>max||Number(v)<min)throw new E(400,'Parámetros inválidos');return Number(v);};return {p_offset:read('offset',0,content?1000000:10000,0),p_limit:read('limit',content?12000:25,content?12000:100,1)};}
export default {async fetch(req,env){
 const u=new URL(req.url),path=u.pathname,isApi=path.startsWith('/api/connect/v1/');
 if(u.hostname!==HOST)return json({error:'Host no autorizado'},404);
 try{
  if(req.method!=='GET'&&req.method!=='POST')return json({error:'Método no permitido'},405);
  if(req.method==='POST'&&req.headers.get('origin')!==ORIGIN)throw new E(403,'Origen no autorizado');
  if(isApi&&((req.headers.has('origin')&&req.headers.get('origin')!==ORIGIN)||['cross-site','same-site'].includes(req.headers.get('sec-fetch-site'))))throw new E(403,'Origen no autorizado');
  if(path==='/health'&&req.method==='GET')return json({service:'gestion-docente',version:'0.1.0',status:'ready',connect:'pilot'});
  if(path==='/login'&&req.method==='GET')return login();
  if(path==='/login'&&req.method==='POST'){
    const f=await form(req),email=(f.get('email')||'').trim(),password=f.get('password')||'',code=f.get('totp')||'';
    if(!email||email.length>254||!password||password.length>1024||code&&!/^\d{6}$/.test(code))return login('Revisa tus credenciales.',400);
    let t='';
    try{
      const auth=await upstream(env,'/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
      t=auth.access_token;
      const user=await upstream(env,'/auth/v1/user',{token:t});
      const factors=(user.factors||[]).filter(x=>x.status==='verified');
      if(factors.length){
        const totp=factors.find(x=>x.factor_type==='totp'&&UUID.test(x.id));
        if(!totp||!code)throw new E(403,'Introduce el código de tu autenticador TOTP. Otros factores aún no están disponibles aquí.');
        const challenge=await upstream(env,'/auth/v1/factors/'+totp.id+'/challenge',{token:t,method:'POST',body:{}});
        const verified=await upstream(env,'/auth/v1/factors/'+totp.id+'/verify',{token:t,method:'POST',body:{challenge_id:challenge.id,code}});
        t=verified.access_token;
      }
      await userState(env,t);
      return redirect('/',t);
    }catch(e){if(t)await upstream(env,'/auth/v1/logout?scope=local',{token:t,method:'POST'}).catch(()=>null);return login(e.status===403?e.message:e.status===429?'Demasiados intentos.':'No fue posible iniciar sesión. Revisa tus credenciales y el código MFA.',e.status===429?429:403);}
  }
  const t=tokenOf(req);
  if(path==='/logout'&&req.method==='POST'){if(t)await upstream(env,'/auth/v1/logout?scope=local',{token:t,method:'POST'}).catch(()=>null);return redirect('/login','');}
  if(!t){if(isApi)return json({error:'Sesión requerida'},401);return redirect('/login');}
  const s=await userState(env,t);
  if(req.method==='GET'&&path==='/')return home(env,s);
  if(req.method==='GET'&&path==='/connect')return connect(env,s);
  if(req.method==='GET'&&path==='/admin')return adminPage(env,s);
  if(req.method==='POST'&&path==='/contexts'&&s.teacher){const b=context(await form(req));await upstream(env,'/rest/v1/eduai_teacher_contexts',{method:'POST',token:t,body:b,prefer:'return=minimal'});return redirect('/');}
  if(req.method==='POST'&&path==='/contexts/archive'&&s.teacher){const id=validateId((await form(req)).get('id'));await upstream(env,'/rest/v1/eduai_teacher_contexts?'+new URLSearchParams({id:'eq.'+id,teacher_id:'eq.'+s.user.id,archived_at:'is.null'}),{method:'PATCH',token:t,body:{archived_at:new Date().toISOString()},prefer:'return=minimal'});return redirect('/');}
  if(req.method==='POST'&&path==='/connect/request'&&s.teacher){const v=[...new Set((await form(req)).getAll('scope'))];if(!v.length||v.some(x=>!scopes.includes(x)))throw new E(400,'Selecciona permisos válidos');await rpc(env,t,'eduai_connect_request',{p_scopes:v});return redirect('/connect');}
  if(req.method==='POST'&&path==='/connect/resource'&&s.teacher){const f=await form(req),k=f.get('kind');if(!Object.values(kinds).includes(k))throw new E(400,'Recurso inválido');await rpc(env,t,'eduai_connect_request',{p_kind:k,p_source_id:validateId(f.get('id')),p_scopes:[]});return redirect('/connect');}
  if(req.method==='POST'&&path==='/admin/decision'&&s.admin){const f=await form(req),action=f.get('action');let args={p_action:action};if(action==='approve'||action==='reject'){args.p_request_id=validateId(f.get('request_id'));if(action==='approve'){const d=Number(f.get('days')),v=[...new Set(f.getAll('scope'))];if(!Number.isInteger(d)||d<1||d>365||v.some(x=>!scopes.includes(x)))throw new E(400,'Permisos inválidos');args.p_days=d;args.p_scopes=v;}}else if(action==='revoke'||action==='revoke_resource'){args.p_teacher_id=validateId(f.get('teacher_id'));if(action==='revoke_resource'){args.p_kind=f.get('kind');args.p_source_id=validateId(f.get('source_id'));}}else throw new E(400,'Decisión inválida');await rpc(env,t,'eduai_connect_admin',args);return redirect('/admin');}
  if(isApi&&req.method==='GET'&&s.teacher){
   const p=path.slice('/api/connect/v1/'.length);
   if(p==='status')return json(await rpc(env,t,'eduai_connect_status',pagination(u)));
   if(Object.hasOwn(kinds,p))return json(await rpc(env,t,'eduai_connect_catalog',{p_kind:kinds[p],...pagination(u)}));
   const [kind,id,...rest]=p.split('/');if(!rest.length&&Object.hasOwn(kinds,kind)&&id)return json(await rpc(env,t,'eduai_connect_read_text',{p_kind:kinds[kind],p_id:validateId(id),...pagination(u,true)}));
  }
  return isApi?json({error:'Ruta no disponible'},404):html('No disponible','<section class="panel"><h2>Página no disponible</h2><a href="/">Volver</a></section>',{status:404,logged:true});
 }catch(e){const status=e instanceof E?e.status:500,msg=e instanceof E?e.message:'Error interno';if(isApi)return json({error:msg},status);if(status===401)return redirect('/login','');return html('Aviso','<section class="panel"><h2>No fue posible completar la operación</h2><p class="err">'+escape(msg)+'</p><a href="/">Volver</a> · <a href="'+EDU+'/login">Ir a EduAI</a></section>',{status,logged:true});}
}};
