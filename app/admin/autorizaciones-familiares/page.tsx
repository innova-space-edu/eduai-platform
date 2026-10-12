"use client"
import { useCallback, useEffect, useState } from "react"
import { familyPurposes } from "@/lib/family-consent/config"

type FamilyRequest = {
  id: string; student_user_id: string; institution_name: string; guardian_email: string
  status: string; issued_at: string; expires_at: string; submitted_at: string | null
  guardian_full_name: string | null; guardian_relationship: string | null
  student_name_declared: string | null; decisions: Record<string, boolean>
}
type FamilyStatistics = {
  totals: { invitations: number; answered: number; accessYes: number; accessNo: number;
    pendingReview: number; approved: number; rejected: number; revoked: number; awaitingResponse: number }
  byPurpose: { key: string; title: string; yes: number; no: number }[]
}
const PLATFORM = "eduai" as const

function ReviewControls({ row, busy, onAction }: {
  row: FamilyRequest; busy: boolean; onAction: (body: object) => Promise<void>
}) {
  const [evidenceRef, setEvidenceRef] = useState("")
  const [identityVerified, setIdentityVerified] = useState(false)
  const [capacityVerified, setCapacityVerified] = useState(false)
  const adultAuthorizedAccess = row.decisions?.platform_access === true
  const ready = adultAuthorizedAccess && !!row.submitted_at &&
    identityVerified && capacityVerified && evidenceRef.trim().length >= 5

  if (row.status === "approved") return (
    <button type="button" disabled={busy}
      onClick={() => { if (window.confirm("¿Revocar esta autorización? El acceso del menor quedará bloqueado.")) void onAction({action:"revoke",requestId:row.id}) }}
      className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-40">
      Revocar autorización
    </button>
  )
  if (row.status !== "submitted") return null

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold">Revisión institucional de esta solicitud</h3>
      {!adultAuthorizedAccess && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          El adulto respondió <strong>No</strong> al ingreso. No se puede aprobar el acceso.
          Registra el rechazo administrativo para cerrar la revisión.
        </p>
      )}
      {adultAuthorizedAccess && (
        <>
          <label className="block text-sm font-medium">
            Referencia de evidencia privada (folio, sin adjuntar documentos)
            <input value={evidenceRef} onChange={e=>setEvidenceRef(e.target.value)}
              placeholder="Folio o acta de verificación (mínimo 5 caracteres)"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" />
          </label>
          <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={identityVerified}
            onChange={e=>setIdentityVerified(e.target.checked)} className="mt-1" />
            Confirmo que verifiqué por un medio independiente la identidad del adulto firmante.
          </label>
          <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={capacityVerified}
            onChange={e=>setCapacityVerified(e.target.checked)} className="mt-1" />
            Confirmo que verifiqué el vínculo y la facultad legal del adulto para autorizar al estudiante.
          </label>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {adultAuthorizedAccess && (
          <button type="button" disabled={busy || !ready}
            onClick={() => { if (window.confirm("¿Aprobar este formulario y habilitar el acceso del menor?")) void onAction({action:"approve",requestId:row.id,identityVerified,legalCapacityVerified:capacityVerified,verifiedMethod:"manual_institution",evidenceRef:evidenceRef.trim()}) }}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Aprobar y habilitar acceso
          </button>
        )}
        <button type="button" disabled={busy}
          onClick={() => { if (window.confirm("¿Rechazar esta solicitud?")) void onAction({action:"reject",requestId:row.id}) }}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-700 disabled:opacity-40">
          Rechazar solicitud
        </button>
      </div>
    </div>
  )
}

export default function FamilyConsentAdminPage() {
  const [rows, setRows] = useState<FamilyRequest[]>([])
  const [statistics, setStatistics] = useState<FamilyStatistics | null>(null)
  const [statisticsComplete, setStatisticsComplete] = useState(true)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterResponse, setFilterResponse] = useState("all")
  const [search, setSearch] = useState("")
  const [studentEmail, setStudentEmail] = useState("")
  const [institutionName, setInstitutionName] = useState("")
  const [guardianEmail, setGuardianEmail] = useState("")
  const [link, setLink] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    const res = await fetch("/api/family-consent/admin", { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setStatus(json.error || "Acceso restringido"); return }
    setRows(json.requests || [])
    setStatistics(json.statistics || null)
    setStatisticsComplete(json.statisticsComplete !== false)
    setStatus("")
  }, [])
  useEffect(() => { void reload() }, [reload])

  async function action(body: object) {
    setLoading(true); setStatus("")
    try {
      const res = await fetch("/api/family-consent/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se completó la operación")
      setStatus("Operación registrada.")
      if (data.invitationUrl) setLink(data.invitationUrl)
      await reload()
    } catch (error) { setStatus(error instanceof Error ? error.message : "Error de red") }
    finally { setLoading(false) }
  }

  const visibleRows = rows.filter(row => {
    const matchesStatus = filterStatus === "all" || row.status === filterStatus
    const matchesResponse = filterResponse === "all" ||
      (filterResponse === "yes" && row.submitted_at && row.decisions?.platform_access === true) ||
      (filterResponse === "no" && row.submitted_at && row.decisions?.platform_access === false)
    const needle = search.trim().toLocaleLowerCase("es-CL")
    const matchesSearch = !needle || [row.student_name_declared, row.guardian_full_name,
      row.guardian_email, row.institution_name].some(value => String(value || "").toLocaleLowerCase("es-CL").includes(needle))
    return matchesStatus && matchesResponse && matchesSearch
  })

  const shareMessage = link
    ? `La institución ha solicitado tu revisión y firma de autorizaciones familiares. Accede únicamente mediante el enlace privado: ${link}. No reenvíes este mensaje a terceros. El enlace no reemplaza la verificación de representación legal.`
    : ""

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div><a href="/admin" className="text-sm text-blue-700 underline">← Volver al panel administrador</a></div>
        <header className="rounded-2xl bg-slate-900 p-6 text-white">
          <p className="text-xs uppercase tracking-widest text-cyan-300">Administración · Autorizaciones familiares</p>
          <h1 className="mt-1 text-2xl font-bold">Invitaciones, decisiones y verificación legal</h1>
          <p className="mt-2 text-sm text-slate-300">Cada invitación corresponde a un estudiante y una plataforma. No habilita funciones hasta la revisión institucional. El enlace puede enviarse por correo o WhatsApp autorizado.</p>
        </header>
        <section aria-label="Resumen de autorizaciones" className="space-y-4 rounded-2xl border bg-white p-5">
          <div>
            <h2 className="text-lg font-bold">Respuestas recibidas y decisiones de acceso</h2>
            <p className="text-xs text-slate-500 mt-1">Conteos de formularios, no de personas únicas. Una invitación sin firma no cuenta como respuesta «No». Las revocaciones conservan la respuesta histórica.</p>
          </div>
          {statistics ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                  {label:"Sí al ingreso",value:statistics.totals.accessYes,color:"text-emerald-700"},
                  {label:"No al ingreso",value:statistics.totals.accessNo,color:"text-red-700"},
                  {label:"Por revisar",value:statistics.totals.pendingReview,color:"text-amber-700"},
                  {label:"Accesos aprobados",value:statistics.totals.approved,color:"text-blue-700"},
                  {label:"Sin respuesta",value:statistics.totals.awaitingResponse,color:"text-slate-700"},
                  {label:"Formularios recibidos",value:statistics.totals.answered,color:"text-indigo-700"},
                ].map(metric => (
                  <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                    <p className="mt-1 text-xs text-slate-600">{metric.label}</p>
                  </div>
                ))}
              </div>
              <details className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Ver respuestas «Sí» y «No» para cada finalidad</summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[440px] text-sm">
                    <thead><tr className="border-b text-left text-slate-600"><th className="py-2 pr-2">Finalidad</th><th className="py-2 px-2 text-right">Sí</th><th className="py-2 px-2 text-right">No</th></tr></thead>
                    <tbody>{statistics.byPurpose.map(item => (
                      <tr key={item.key} className="border-b border-slate-100">
                        <td className="py-2 pr-2">{item.title}</td>
                        <td className="py-2 px-2 text-right font-semibold text-emerald-700">{item.yes}</td>
                        <td className="py-2 px-2 text-right font-semibold text-red-700">{item.no}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </details>
              {!statisticsComplete && <p className="text-xs text-amber-700">El resumen es parcial: hay más de 20.000 solicitudes. Contacta soporte para obtener un informe exhaustivo.</p>}
            </>
          ) : <p className="text-sm text-slate-600">Cargando respuestas autorizadas…</p>}
        </section>

        <section className="rounded-2xl border bg-white p-5 space-y-4">
          <h2 className="font-semibold">Nueva invitación</h2>
          <form onSubmit={e => { e.preventDefault(); void action({ action: "issue", studentEmail, guardianEmail, institutionName }) }} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Correo de la cuenta estudiante<input type="email" required value={studentEmail} onChange={e=>setStudentEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label className="text-sm">Correo del adulto responsable<input type="email" required value={guardianEmail} onChange={e=>setGuardianEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label className="text-sm sm:col-span-2">Institución<input required value={institutionName} onChange={e=>setInstitutionName(e.target.value)} className="mt-1 w-full rounded-lg border p-3" placeholder="Identificación institucional" /></label>
            <button disabled={loading} className="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2" type="submit">{loading ? "Procesando..." : "Crear invitación privada de 7 días"}</button>
          </form>
          {link && (
            <div className="space-y-2 rounded-xl border bg-blue-50 p-4">
              <p className="break-all font-mono text-xs">{link}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => navigator.clipboard.writeText(shareMessage)} className="rounded-lg border bg-white px-3 py-2 text-sm">Copiar mensaje</button>
                <a href={`mailto:${encodeURIComponent(guardianEmail)}?subject=${encodeURIComponent("Solicitud de autorización familiar")}&body=${encodeURIComponent(shareMessage)}`} className="rounded-lg border bg-white px-3 py-2 text-sm">Preparar correo</a>
                <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noreferrer" className="rounded-lg border bg-white px-3 py-2 text-sm">Compartir por WhatsApp</a>
              </div>
              <p className="text-xs text-slate-600">Se prepara el mensaje en la aplicación correspondiente, sin envío automático. Comprueba el destinatario antes de compartir. El correo o WhatsApp no acredita quién firma.</p>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Validación institucional</h2>
          <p className="text-sm text-slate-700">La firma simple registrada por la familia es solo una solicitud pendiente. Para aprobar, verifica por un canal independiente la identidad del firmante, su representación o cuidado personal y la vinculación con el estudiante. No subas documentos de identidad ni evidencias sensibles a esta página; usa una referencia al archivo privado institucional.</p>
          <p className="text-sm text-slate-700">Las verificaciones se documentan <strong>por cada solicitud</strong> en su ficha, nunca como una casilla global para todos los estudiantes. Una respuesta «No» al ingreso no puede ser sobreescrita.</p>
        </section>

        <section className="space-y-3 rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Solicitudes recientes (últimas 100)</h2><button type="button" onClick={() => void reload()} className="rounded-lg border px-3 py-2 text-xs">Actualizar</button></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-medium">Buscar estudiante o apoderado
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre, correo o institución" className="mt-1 w-full rounded-lg border p-2 text-sm" />
            </label>
            <label className="text-xs font-medium">Estado
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm">
                <option value="all">Todos</option><option value="submitted">Pendientes de revisión</option>
                <option value="invited">Invitados</option><option value="approved">Aprobados</option>
                <option value="rejected">Rechazados</option><option value="revoked">Revocados</option>
              </select>
            </label>
            <label className="text-xs font-medium">Respuesta al ingreso
              <select value={filterResponse} onChange={e=>setFilterResponse(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm">
                <option value="all">Todas</option><option value="yes">Sí</option><option value="no">No</option>
              </select>
            </label>
          </div>
          <div className="space-y-3">
            {visibleRows.length === 0 ? <p className="text-sm text-slate-500">No hay solicitudes que coincidan con los filtros.</p> : visibleRows.map(row => (
              <article key={row.id} className="space-y-2 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{row.student_name_declared || "Estudiante asociado"}</strong><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{row.status}</span></div>
                <p className="text-xs text-slate-600">Institución: {row.institution_name} · Contacto: {row.guardian_email}</p>
                <p className="text-xs text-slate-600">Firmante: {row.guardian_full_name || "Pendiente"} · Relación: {row.guardian_relationship || "Pendiente"}</p>
                <p className="text-sm font-semibold">{!row.submitted_at ? "Pendiente de respuesta" : row.decisions?.platform_access === true ? "Ingreso: Sí, autorizado por familia (falta aprobación institucional)" : row.decisions?.platform_access === false ? "Ingreso: No, acceso denegado por familia" : "Ingreso: no declarado"}</p>
                <p className="text-xs text-slate-600">{row.submitted_at ? `Respondido: ${new Date(row.submitted_at).toLocaleString("es-CL")}` : "Todavía no se recibió formulario firmado."}</p>
                {row.submitted_at && <details className="rounded-lg border p-3 text-xs">
                  <summary className="cursor-pointer font-semibold">Ver todas las respuestas del formulario</summary>
                  <dl className="mt-2 space-y-1">{familyPurposes(PLATFORM).map(purpose => (
                    <div key={purpose.key} className="flex items-start justify-between gap-3 border-b border-slate-100 py-1">
                      <dt>{purpose.title}</dt><dd className={row.decisions?.[purpose.key] === true ? "font-bold text-emerald-700" : "font-bold text-red-700"}>{row.decisions?.[purpose.key] === true ? "Sí" : row.decisions?.[purpose.key] === false ? "No" : "Sin respuesta"}</dd>
                    </div>
                  ))}</dl>
                </details>}
                <ReviewControls row={row} busy={loading} onAction={action} />
              </article>
            ))}
          </div>
        </section>
        {status && <p role="status" className="rounded-xl border bg-white p-4 text-sm">{status}</p>}
      </div>
    </main>
  )
}
