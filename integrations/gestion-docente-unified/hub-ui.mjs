/**
 * Server-rendered presentation for Gestión Docente HUB V2.
 * Has no client-side auth and must be called ONLY after trusted session verification
 * by the application server. Forms specify future BFF routes, not deployed endpoints.
 */
import {GROUPS} from './hub-core.mjs';

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const STATUS={assigned:"Asignada",draft:"En preparación",submitted:"Entregada",returned:"Devuelta",approved:"Aprobada",cancelled:"Cancelada"};
const GROUP_LABELS={administrativos:"Administración",pie:"PIE",orientacion_convivencia:"Orientación / Convivencia",utp:"UTP",docentes:"Docentes",inspectoria:"Inspectoría",contabilidad:"Contabilidad",estudiantes:"Estudiantes",apoderados:"Apoderados",otros:"Otros"};
const TYPES={short_text:"text",long_text:"textarea",number:"number",date:"date",select:"select",checkbox:"checkbox"};
const CSS="*{box-sizing:border-box}body{margin:0;font:15px/1.55 system-ui,sans-serif;color:#1d2b45;background:#f5f7fc}a{color:#294f99}header{background:#142e63;color:white;padding:20px max(20px,calc((100vw - 1180px)/2));}header h1{margin:0;font-size:24px}header p{margin:0;color:#d3def4}.container{max-width:1180px;margin:24px auto;padding:0 20px}.columns{display:grid;grid-template-columns:minmax(190px,245px) minmax(0,1fr);gap:18px}.side,.panel{background:white;border:1px solid #dee5f0;border-radius:14px;padding:20px}.side{height:fit-content}.side a{display:block;padding:10px;border-radius:8px;text-decoration:none}.side a:hover{background:#edf1fa}h2{font-size:20px;margin:0 0 12px}h3{font-size:16px;margin:14px 0 8px}.muted{color:#627089;font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:16px}.stat{background:#fff;border:1px solid #e0e5ef;border-radius:14px;padding:18px}.stat strong{display:block;font-size:25px;color:#2d50a0}.stat span{font-size:12px;color:#5c6880}.task{border:1px solid #e3e9f3;border-radius:12px;padding:14px;margin:12px 0}.task header{padding:0;background:none;color:#1b2b44}.pill{display:inline-block;border-radius:20px;background:#e9eefb;padding:3px 9px;font-size:12px;color:#294b98}.warn{padding:12px;border:1px solid #f3d7a5;background:#fff9ea;border-radius:10px;font-size:13px}label{display:block;font-weight:600;margin:10px 0 5px}input,textarea,select{font:inherit;width:100%;border:1px solid #bfcbe0;border-radius:8px;padding:9px;background:white;color:#1d2b45}textarea{min-height:85px}input[type=checkbox]{width:auto;margin-right:7px}.check{font-weight:400}.btn,button{display:inline-block;background:#2f51a0;color:white;border:0;border-radius:8px;padding:10px 15px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}.btn:hover,button:hover{background:#193775}form{margin:8px 0 16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}.items{padding:0;list-style:none}.items li{padding:10px 0;border-bottom:1px solid #edf0f6}.items span{font-size:12px;color:#68768d}.table{width:100%;border-collapse:collapse}.scroll{overflow:auto}.table td,.table th{border-bottom:1px solid #e5ebf3;padding:10px;text-align:left}.badge{display:inline-block;background:#e6edff;color:#234b93;border-radius:40px;padding:3px 10px;font-size:12px}.help{color:#657186;font-size:12px}@media(max-width:700px){.columns{grid-template-columns:1fr}.side{display:flex;gap:6px;flex-wrap:wrap}.side a{display:inline-block}.container{padding:0 12px}}";
function wrap(profile,inner){
 const nav=[["inicio","Inicio"],["tareas","Mis tareas"],["archivos","Carpetas y archivos"],["buscar","Buscar y seguimiento"],["plataformas","Plataformas y nube"],...(profile.isAdministrative?[["administrar","Administrar tareas"]]:[])];
 const aside='<nav class="side">'+nav.map(([view,label])=>'<a href="/?view='+view+'">'+label+'</a>').join('')+'</nav>';
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gestión Docente · '+esc(profile.schoolName)+'</title><style>'+CSS+'</style></head><body><header><h1>Gestión Docente</h1><p>'+esc(profile.schoolName)+' · '+esc(GROUP_LABELS[profile.group])+'</p></header><main class="container"><div class="columns">'+aside+'<div><p class="warn"><strong>Prototipo aislado.</strong> Formularios y botones preparados para integrar con el backend autenticado. No cargar archivos ni datos reales aquí.</p>'+inner+'</div></div></main></body></html>';
}
function renderField(field){
 const required=field.required?' required':'';
 const label='<label for="f_'+esc(field.key)+'">'+esc(field.label)+(field.required?' *':'')+'</label>';
 let input='';
 switch(field.type){
 case 'long_text':input='<textarea id="f_'+esc(field.key)+'" name="'+esc(field.key)+'" maxlength="4000"'+required+'></textarea>';break;
 case 'select':input='<select id="f_'+esc(field.key)+'" name="'+esc(field.key)+'"'+required+'><option value="">Seleccionar</option>'+field.options.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select>';break;
 case 'checkbox':input='<input id="f_'+esc(field.key)+'" type="checkbox" name="'+esc(field.key)+'" value="true"'+required+'>';break;
 default:input='<input id="f_'+esc(field.key)+'" type="'+esc(TYPES[field.type]||'text')+'" name="'+esc(field.key)+'"'+(field.type==='short_text'?' maxlength="200"':'')+required+'>';
 }
 return '<div class="field">'+label+input+'</div>';
}
function taskCard(t,folders){
 const percent=t.status==='approved'?"Completada":t.status==="returned"?"Corrección solicitada":STATUS[t.status]||"Pendiente";
 const f=t.form.map(renderField).join('');
 const canEdit=["assigned","draft","returned"].includes(t.status);
 const writable=folders.filter(f=>f.writable);
 const folderSelect=writable.length?'<label>Carpeta de almacenamiento</label><select name="folderId">'+writable.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.name)+'</option>').join('')+'</select>':'<p class="warn">Antes de adjuntar una evidencia, crea una carpeta en Archivos.</p>';
 const controls=canEdit?'<form method="post" action="/tasks/'+esc(t.id)+'/save"><div class="grid">'+f+'</div><button name="action" value="save">Guardar borrador</button> <button name="action" value="submit">Entregar tarea</button></form><form enctype="multipart/form-data" method="post" action="/tasks/'+esc(t.id)+'/upload">'+folderSelect+'<label>Adjuntar evidencia PDF, DOCX, XLSX o imagen</label><input type="file" name="evidence" accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.txt" required><p class="help">El servidor definitivo exigirá verificación de tipo, tamaño, antivirus y almacenamiento seguro antes de adjuntar.</p><button>Subir evidencia</button></form>':'<p class="muted">Esta entrega no se puede modificar hasta recibir una devolución.</p>';
 return '<article class="task"><header><strong>'+esc(t.title)+'</strong> <span class="pill">'+esc(percent)+'</span></header><p>'+esc(t.description)+'</p><p class="muted">Vence: '+esc(new Date(t.dueAt).toLocaleDateString('es-CL',{timeZone:'UTC'}))+' · '+t.fileCount+' archivo(s) · '+t.minFiles+' mínimo</p>'+(t.returnReason?'<p class="warn">Observación de revisión: '+esc(t.returnReason)+'</p>':'')+controls+'</article>';
}
function createTaskForm(){
 const groups=GROUPS.map(g=>'<label class="check"><input type="checkbox" name="groups" value="'+esc(g)+'"> '+esc(GROUP_LABELS[g])+'</label>').join('');
 return '<section class="panel"><h2>Crear y asignar tarea</h2><p class="muted">Solo Administración. Se creará una entrega independiente para cada destinatario activo.</p><form action="/admin/tasks" method="post"><label>Título</label><input name="title" required maxlength="160" placeholder="Entrega mensual de planificaciones"><label>Instrucciones</label><textarea name="description" maxlength="2000" placeholder="Describe los requisitos y evidencias"></textarea><div class="grid"><div><label>Fecha de vencimiento</label><input type="date" name="due" required></div><div><label>Plantilla</label><select name="template"><option value="evidence">Entrega de evidencias</option><option value="form">Formulario de cumplimiento</option><option value="mixed">Formulario + evidencias</option></select></div></div><h3>Asignar a grupos</h3><div class="grid">'+groups+'</div><p class="help">También se podrán seleccionar personas individualmente desde el directorio autorizado. No se enviará información a grupos de otro establecimiento.</p><button>Crear asignación</button></form></section>';
}
function renderFolders(folders,filesByFolder){
 const list=folders.map(f=>{
  const files=filesByFolder.get(f.id)||[];
  return '<li><strong>'+esc(f.name)+'</strong> <span>'+esc(f.ownerId)+'</span> '+(f.writable?'<span class="badge">Editor</span>':'<span class="badge">Lectura</span>')+
  '<ul class="items">'+files.map(x=>'<li><a href="/files/'+esc(x.id)+'/download">'+esc(x.name)+'</a> <span>'+esc(x.mediaType)+'</span></li>').join('')+'</ul></li>';
 }).join('');
 const writable=folders.filter(f=>f.writable);
 const options=writable.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.name)+'</option>').join('');
 const upload=writable.length?'<h3>Subir archivo a la nube del establecimiento</h3><form action="/files/upload" method="post" enctype="multipart/form-data"><label>Carpeta de destino</label><select name="folderId">'+options+'</select><label>Archivo PDF, DOCX, XLSX, CSV o imagen</label><input type="file" name="evidence" accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.txt" required><p class="help">El almacenamiento real exigirá autorización, análisis antivirus y archivo privado.</p><button>Adjuntar archivo</button></form>':'<p class="muted">Crea una carpeta para activar la carga de archivos.</p>';
 return '<section class="panel"><h2>Mis carpetas y archivos</h2><form action="/folders" method="post"><label>Nueva carpeta</label><input name="name" required maxlength="120" placeholder="Planificaciones 2026"><button>Crear carpeta</button></form>'+upload+'<ul class="items">'+(list||'<li class="muted">Aún no tienes carpetas.</li>')+'</ul><p class="help">Las carpetas son privadas por defecto y requieren permisos explícitos para compartir.</p></section>';
}
function renderSearch(rows){
 return '<section class="panel"><h2>Motor de búsqueda y seguimiento</h2><form action="/" method="get"><input type="hidden" name="view" value="buscar"><label>Buscar por nombre de tarea o descripción</label><input name="q" maxlength="100" placeholder="Ej.: planificación pendiente"><button>Buscar</button></form><div class="scroll"><table class="table"><thead><tr><th>Tarea</th><th>Destinatario</th><th>Grupo</th><th>Estado</th><th>Vencimiento</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.title)+(r.reviewable?'<p><a href="/admin/review?taskId='+esc(r.taskId)+'&userId='+esc(r.assigneeId)+'">Revisar entrega</a></p>':'')+'</td><td>'+esc(r.assigneeId)+'</td><td>'+esc(GROUP_LABELS[r.group])+'</td><td>'+esc(STATUS[r.status])+(r.overdue?' · atrasada':'')+'</td><td>'+esc(new Date(r.dueAt).toLocaleDateString('es-CL',{timeZone:'UTC'}))+'</td></tr>').join('')+'</tbody></table></div><p class="help">El cumplimiento de notas oficiales, matrícula o asistencia solo se verificará al conectar una API autorizada. Una tarea entregada no prueba que los datos estén cargados en Napsis.</p></section>';
}
function renderPlatformLinks(links,providers=[]){
 const statusText={not_connected:'Sin conexión',connected:'Conectado',authorization_required:'Reautorizar',stale:'Datos desactualizados',error:'Error de sincronización'};
 const rows=providers.map(p=>'<li><strong>'+esc(p.provider.replaceAll('_',' '))+'</strong> <span class="pill">'+esc(statusText[p.state]||p.state)+'</span></li>').join('');
 return '<section class="panel"><h2>Plataformas y nube</h2><h3>Enlaces de acceso</h3><ul class="items">'+links.map(l=>'<li><a href="'+esc(l.url)+'" rel="noopener noreferrer" target="_blank">'+esc(l.label)+'</a></li>').join('')+'</ul><h3>Estado de conectores personales</h3><ul class="items">'+(rows||'<li>Conexiones pendientes de configuración</li>')+'</ul><p class="muted">Google Drive, Docs, Sheets, Gmail y Calendar necesitan autenticación y consentimiento real. Napsis permanece sin API oficial conectada.</p></section>';
}
function renderAdminExtras(){
 const groups=GROUPS.map(g=>'<label class="check"><input type="checkbox" name="groups" value="'+esc(g)+'">'+esc(GROUP_LABELS[g])+'</label>').join('');
 return '<section class="panel"><h2>Banner y avisos institucionales</h2><form method="post" action="/admin/banners"><label>Título</label><input name="title" maxlength="120" required><label>Mensaje</label><textarea name="message" maxlength="500" required></textarea><label>Vigencia hasta</label><input type="date" name="until" required><h3>Grupos destinatarios (sin selección = todos)</h3><div class="grid">'+groups+'</div><button>Crear banner</button></form></section><section class="panel"><h2>Botones de acceso a plataformas</h2><form method="post" action="/admin/platforms"><label>Nombre de la plataforma</label><input name="label" maxlength="80" required><label>Enlace HTTPS autorizado</label><input name="url" type="url" placeholder="https://..." required><button>Guardar acceso</button></form></section>';
}
export function renderWorkspace(hub,token,schoolId,{view="inicio",query="",csrfToken="",sourceRegistry=null}={}){
 const profile=hub.myProfile(token,schoolId),tasks=hub.myTasks(token,schoolId),banners=hub.myBanners(token,schoolId),notifications=hub.listNotifications(token,schoolId);
 const intro='<section class="panel"><h2>Resumen de mi espacio</h2><div class="cards"><div class="stat"><strong>'+tasks.length+'</strong><span>Tareas asignadas</span></div><div class="stat"><strong>'+tasks.filter(t=>t.status==='submitted').length+'</strong><span>Pendientes de revisión</span></div><div class="stat"><strong>'+tasks.filter(t=>t.status==='approved').length+'</strong><span>Aprobadas</span></div><div class="stat"><strong>'+notifications.length+'</strong><span>Notificaciones</span></div></div>'+banners.map(b=>'<p class="warn"><strong>'+esc(b.title)+'</strong> · '+esc(b.message)+'</p>').join('')+'<h3>Notificaciones recientes</h3><ul class="items">'+notifications.slice(-12).reverse().map(n=>'<li>'+esc(n.type.replaceAll('_',' '))+' · '+esc(new Date(n.createdAt).toLocaleDateString('es-CL',{timeZone:'UTC'}))+'</li>').join('')+'</ul></section>';
 const myFolders=hub.listMyFolders(token,schoolId);
 const myTasks='<section class="panel"><h2>Mis tareas y evidencias</h2>'+(tasks.length?tasks.map(t=>taskCard(t,myFolders)).join(''):'<p class="muted">No tienes tareas asignadas.</p>')+'</section>';
 let content;
 switch(view){
 case 'tareas':content=myTasks;break;
 case 'archivos':content=renderFolders(myFolders,new Map(myFolders.map(f=>[f.id,hub.listFiles(token,{schoolId,folderId:f.id})])));break;
 case 'buscar':content=renderSearch(hub.searchTasks(token,{schoolId,textQuery:query}));break;
 case 'plataformas':content=renderPlatformLinks(hub.myPlatformLinks(token,schoolId),sourceRegistry?sourceRegistry.status(token,schoolId):[]);break;
 case 'administrar':content=profile.isAdministrative?createTaskForm()+renderAdminExtras()+renderSearch(hub.searchTasks(token,{schoolId,textQuery:query})):'<section class="panel"><h2>Acceso no disponible</h2></section>';break;
 default:content=intro+myTasks;
 }
 const markup=wrap(profile,content);
 return markup.replace(/(<form\b[^>]*>)/g,(_,tag)=>tag+'<input type="hidden" name="_csrf" value="'+esc(csrfToken)+'">');
}
