import type { SupabaseClient } from "@supabase/supabase-js"
import { EDUAI_FAMILY_PURPOSES } from "@/lib/family-consent/config"

/** Every download contains all matching records, or fails explicitly: never silent truncation. */
export const EXPORT_MAX_CATEGORY_ROWS = 25000
const PAGE_SIZE = 500
type DBRow = Record<string, any>
export type ExportRow = Record<string, string | number>
export type ExportSection = {
  name: string
  description: string
  columns: { key: string; title: string }[]
  rows: ExportRow[]
}
export type CompleteExport = {
  generatedAt: string
  requestedBy: string
  sections: ExportSection[]
  totals: Record<string, number>
}

export class ExportLimitError extends Error {}

export function chileDateTime(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "—"
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return "—"
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(parsed)
}
const displayed = (v: unknown) => v === null || v === undefined || v === "" ? "—" : String(v)
const yesNo = (v: unknown): string => v === true ? "Sí" : v === false ? "No" : "Sin responder"
const col = (key: string, title: string) => ({key, title})
const sortLatest = (records: DBRow[], key: string) =>
  records.sort((a,b)=>String(b[key]??"").localeCompare(String(a[key]??"")))

/** Reads in batches; the extra row prevents treating a capped response as complete. */
async function readRows(
  db: SupabaseClient,
  table: string,
  columns: string,
  orderBy: string,
  filter?: { column: string; value?: string; ids?: string[] },
): Promise<DBRow[]> {
  const collected: DBRow[] = []
  for (let start = 0; start <= EXPORT_MAX_CATEGORY_ROWS; start += PAGE_SIZE) {
    let query = db.from(table).select(columns)
    if (filter?.value) query = query.eq(filter.column, filter.value)
    if (filter?.ids) query = query.in(filter.column, filter.ids)
    const {data,error} = await query.order(orderBy,{ascending:false}).range(start,start+PAGE_SIZE-1)
    if (error) throw new Error("No se pudo leer el registro " + table)
    const page = (data??[]) as DBRow[]
    collected.push(...page)
    if (collected.length > EXPORT_MAX_CATEGORY_ROWS) {
      throw new ExportLimitError("Hay más de " + EXPORT_MAX_CATEGORY_ROWS +
        " filas en " + table + ". La descarga no se generó para evitar un archivo incompleto.")
    }
    if (page.length < PAGE_SIZE) return collected
  }
  throw new ExportLimitError("El informe supera la capacidad de generación completa.")
}

async function readIdBatches(db: SupabaseClient, table: string, columns: string,
  orderBy: string, foreignKey: string, ids: string[]): Promise<DBRow[]> {
  if(!ids.length) return []
  const all: DBRow[] = []
  for(let index=0;index<ids.length;index+=100){
    const chunk=await readRows(db,table,columns,orderBy,{column:foreignKey,ids:ids.slice(index,index+100)})
    all.push(...chunk)
    if(all.length>EXPORT_MAX_CATEGORY_ROWS) throw new ExportLimitError("El historial es demasiado extenso para generar un informe íntegro.")
  }
  return sortLatest(all,orderBy)
}
async function profilesById(db: SupabaseClient, ids: string[]) {
  const profiles = await readIdBatches(db,"profiles","id,name,email","id","id",ids)
  return new Map(profiles.map(item=>[item.id,{name:displayed(item.name),email:displayed(item.email)}]))
}
function section(name:string,description:string,columns:ExportSection["columns"],rows:ExportRow[]):ExportSection {
  return {name,description,columns,rows}
}

/** Confidential report for approved EDUAI administrators only. Never call from the browser. */
export async function collectAllAdminRecords(db: SupabaseClient,adminEmail:string):Promise<CompleteExport> {
  const [acts,requests,preferences,privacyEvents,oldExports] = await Promise.all([
    readRows(db,"eduai_family_approval_acts",
      "request_id,folio,student_user_id,student_name,guardian_name,guardian_relationship,institution_name,reviewer_user_id,approved_at,identity_verified_at,legal_capacity_verified_at,verified_method,evidence_reference,document_version",
      "approved_at"),
    readRows(db,"family_authorization_requests",
      "id,student_user_id,institution_name,guardian_email,status,issued_at,expires_at,submitted_at,guardian_full_name,guardian_relationship,student_name_declared,decisions,reviewed_at,reviewed_by,revoked_at,document_version",
      "issued_at",{column:"platform",value:"eduai"}),
    readRows(db,"eduai_privacy_choices",
      "user_id,policy_version,terms_acknowledged_at,data_warning_acknowledged_at,ai_generation,ai_documents,ai_voice,optional_analytics,updated_at",
      "updated_at"),
    readRows(db,"eduai_privacy_choice_events",
      "id,user_id,policy_version,choices,event_type,recorded_at",
      "recorded_at"),
    readRows(db,"eduai_admin_export_events","id,exported_by,file_format,dataset,counts,exported_at","exported_at"),
  ])
  const familyEvents = await readIdBatches(db,"family_authorization_events",
    "id,request_id,event_type,performed_by,created_at","created_at","request_id",
    requests.map(r=>r.id))
  const ids = [...new Set([
    ...acts.flatMap(a=>[a.student_user_id,a.reviewer_user_id]),
    ...requests.flatMap(r=>[r.student_user_id,r.reviewed_by]),
    ...preferences.map(p=>p.user_id),
    ...privacyEvents.map(ev=>ev.user_id),
    ...familyEvents.map(ev=>ev.performed_by),
    ...oldExports.map(ev=>ev.exported_by),
  ].filter((v):v is string=>typeof v==="string"&&v.length>0))]
  const profiles = await profilesById(db,ids)
  const userName=(id:unknown)=>profiles.get(String(id??""))?.name??"Sin perfil"
  const userEmail=(id:unknown)=>profiles.get(String(id??""))?.email??"—"
  const requestById=new Map(requests.map(r=>[r.id,r]))
  const actByRequest=new Map(acts.map(a=>[a.request_id,a]))
  // One row per signed purpose, never count an unanswered invitation as a negative vote.
  const decisions = requests.flatMap(request=>{
    if(!request.submitted_at||!request.decisions||typeof request.decisions!=="object")return []
    return EDUAI_FAMILY_PURPOSES.map(purpose=>({
      fecha:chileDateTime(request.submitted_at),folio:displayed(actByRequest.get(request.id)?.folio),
      estudiante:displayed(request.student_name_declared)||userName(request.student_user_id),
      apoderado:displayed(request.guardian_full_name),finalidad:purpose.title,
      respuesta:yesNo(request.decisions[purpose.key]),
      estado:displayed(request.status),version:displayed(request.document_version),
    }))
  })
  const statusCounts=Object.fromEntries(["invited","submitted","approved","rejected","revoked","expired"]
    .map(status=>[status,requests.filter(row=>row.status===status).length]))
  const submitted=requests.filter(row=>Boolean(row.submitted_at))
  const yes=submitted.filter(r=>r.decisions?.platform_access===true).length
  const no=submitted.filter(r=>r.decisions?.platform_access===false).length
  const generatedAt=new Date().toISOString()
  const sections:ExportSection[]=[
    section("Actas","Aprobaciones institucionales; historial permanente",[
      col("folio","Folio"),col("aprobado","Fecha y hora Chile"),col("estudiante","Estudiante"),
      col("apoderado","Apoderado firmante"),col("relacion","Relación"),
      col("revisor","Administrador"),col("institucion","Institución"),
      col("verificacion","Método"),col("referencia","Evidencia ref."),
      col("version","Versión del documento"),col("estado","Estado actual")
    ],acts.map(a=>({
      folio:displayed(a.folio),aprobado:chileDateTime(a.approved_at),
      estudiante:displayed(a.student_name),apoderado:displayed(a.guardian_name),
      relacion:displayed(a.guardian_relationship),revisor:userName(a.reviewer_user_id),
      institucion:displayed(a.institution_name),verificacion:displayed(a.verified_method),
      referencia:displayed(a.evidence_reference),version:displayed(a.document_version),
      estado:displayed(requestById.get(a.request_id)?.status)
    }))),
    section("Autorizaciones","Solicitudes y formularios, incluidas invitaciones sin respuesta",[
      col("emitido","Fecha emisión Chile"),col("estudiante","Estudiante"),col("emailEstudiante","Correo estudiante"),
      col("apoderado","Apoderado firmante"),col("correoApoderado","Correo apoderado"),
      col("estado","Estado"),col("respuestaIngreso","Ingreso Sí/No"),
      col("respondido","Presentación Chile"),col("revisado","Revisión Chile"),
      col("vencimiento","Vencimiento Chile"),col("folio","Acta asociada"),col("version","Versión")
    ],requests.map(r=>({
      emitido:chileDateTime(r.issued_at),estudiante:displayed(r.student_name_declared||userName(r.student_user_id)),
      emailEstudiante:userEmail(r.student_user_id),apoderado:displayed(r.guardian_full_name),
      correoApoderado:displayed(r.guardian_email),estado:displayed(r.status),
      respuestaIngreso:r.submitted_at?yesNo(r.decisions?.platform_access):"Sin responder",
      respondido:chileDateTime(r.submitted_at),revisado:chileDateTime(r.reviewed_at),
      vencimiento:chileDateTime(r.expires_at),folio:displayed(actByRequest.get(r.id)?.folio),
      version:displayed(r.document_version)
    }))),
    section("Respuestas","Decisiones Sí/No para cada finalidad firmada por el apoderado",[
      col("fecha","Presentación Chile"),col("folio","Folio"),col("estudiante","Estudiante"),
      col("apoderado","Apoderado"),col("finalidad","Finalidad"),col("respuesta","Respuesta"),
      col("estado","Estado"),col("version","Versión")
    ],decisions),
    section("Preferencias","Últimas opciones guardadas en cada cuenta",[
      col("nombre","Usuario"),col("email","Correo"),col("version","Versión"),
      col("aceptacion","Aceptación original Chile"),col("advertencia","Advertencia aceptada Chile"),
      col("ia","IA"),col("documentos","Documentos"),col("voz","Voz"),
      col("analitica","Analítica"),col("actualizacion","Última modificación Chile")
    ],preferences.map(p=>({
      nombre:userName(p.user_id),email:userEmail(p.user_id),version:displayed(p.policy_version),
      aceptacion:chileDateTime(p.terms_acknowledged_at),advertencia:chileDateTime(p.data_warning_acknowledged_at),
      ia:yesNo(p.ai_generation),documentos:yesNo(p.ai_documents),
      voz:yesNo(p.ai_voice),analitica:yesNo(p.optional_analytics),
      actualizacion:chileDateTime(p.updated_at)
    }))),
    section("Cambios privacidad","Registro histórico de decisiones de privacidad de cada cuenta",[
      col("fecha","Fecha y hora Chile"),col("usuario","Usuario"),col("correo","Correo"),
      col("tipo","Tipo de evento"),col("version","Versión"),
      col("ia","IA"),col("documentos","Documentos"),col("voz","Voz"),col("analitica","Analítica")
    ],privacyEvents.map(ev=>({
      fecha:chileDateTime(ev.recorded_at),usuario:userName(ev.user_id),correo:userEmail(ev.user_id),
      tipo:displayed(ev.event_type),version:displayed(ev.policy_version),
      ia:yesNo(ev.choices?.ai_generation),documentos:yesNo(ev.choices?.ai_documents),
      voz:yesNo(ev.choices?.ai_voice),analitica:yesNo(ev.choices?.optional_analytics)
    }))),
    section("Eventos familiares","Movimientos del proceso de autorización familiar",[
      col("fecha","Fecha y hora Chile"),col("estudiante","Estudiante"),col("apoderado","Apoderado"),
      col("evento","Evento"),col("responsable","Responsable"),col("folio","Folio")
    ],familyEvents.map(ev=>{
      const r=requestById.get(ev.request_id)
      return {fecha:chileDateTime(ev.created_at),estudiante:displayed(r?.student_name_declared),
        apoderado:displayed(r?.guardian_full_name),evento:displayed(ev.event_type),
        responsable:userName(ev.performed_by),folio:displayed(actByRequest.get(ev.request_id)?.folio)}
    })),
    section("Descargas","Auditoría de informes consolidados generados anteriormente",[
      col("fecha","Fecha y hora Chile"),col("responsable","Administrador"),
      col("formato","Formato"),col("tipo","Informe"),col("cantidad","Registros incluidos")
    ],oldExports.map(ev=>({
      fecha:chileDateTime(ev.exported_at),responsable:userName(ev.exported_by),
      formato:displayed(ev.file_format).toUpperCase(),tipo:displayed(ev.dataset),
      cantidad:typeof ev.counts?.total==="number"?ev.counts.total:"—"
    })))
  ]
  const totals=Object.fromEntries(sections.map(x=>[x.name,x.rows.length]))
  totals["Solicitudes sin respuesta"]=statusCounts.invited??0
  totals["Formularios recibidos"]=submitted.length
  totals["Ingreso Sí"]=yes
  totals["Ingreso No"]=no
  totals["Accesos aprobados"]=statusCounts.approved??0
  totals["Registros totales"]=sections.reduce((n,x)=>n+x.rows.length,0)
  if (totals["Registros totales"] > 125000) {
    throw new ExportLimitError("El informe supera 125.000 filas. Ninguna sección se exportó parcialmente.")
  }
  return {generatedAt,requestedBy:adminEmail,sections,totals}
}
