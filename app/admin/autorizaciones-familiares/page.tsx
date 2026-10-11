"use client"
import { useCallback, useEffect, useState } from "react"

type FamilyRequest = {
  id: string; student_user_id: string; institution_name: string; guardian_email: string
  status: string; issued_at: string; expires_at: string; submitted_at: string | null
  guardian_full_name: string | null; guardian_relationship: string | null
  student_name_declared: string | null; decisions: Record<string, boolean>
}
export default function FamilyConsentAdminPage() {
  const [rows, setRows] = useState<FamilyRequest[]>([])
  const [studentEmail, setStudentEmail] = useState("")
  const [institutionName, setInstitutionName] = useState("")
  const [guardianEmail, setGuardianEmail] = useState("")
  const [link, setLink] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [proofRef, setProofRef] = useState("")
  const [identityVerified, setIdentityVerified] = useState(false)
  const [capacityVerified, setCapacityVerified] = useState(false)

  const reload = useCallback(async () => {
    const res = await fetch("/api/family-consent/admin", { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setStatus(json.error || "Acceso restringido"); return }
    setRows(json.requests || [])
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

  const shareMessage = link
    ? `La institución ha solicitado tu revisión y firma de autorizaciones familiares. Accede únicamente mediante el enlace privado: ${link}. No reenvíes este mensaje a terceros. El enlace no reemplaza la verificación de representación legal.`
    : ""

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl bg-slate-900 p-6 text-white">
          <p className="text-xs uppercase tracking-widest text-cyan-300">Administración · Autorizaciones familiares</p>
          <h1 className="mt-1 text-2xl font-bold">Invitaciones, decisiones y verificación legal</h1>
          <p className="mt-2 text-sm text-slate-300">Cada invitación corresponde a un estudiante y una plataforma. No habilita funciones hasta la revisión institucional. El enlace puede enviarse por correo o WhatsApp autorizado.</p>
        </header>
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
          <label className="block text-sm">Referencia de evidencia institucional privada
            <input value={proofRef} onChange={e => setProofRef(e.target.value)} placeholder="Folio de documento o acta interna" className="mt-1 w-full rounded-lg border p-3" />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={identityVerified} onChange={e=>setIdentityVerified(e.target.checked)} />He verificado por un canal independiente la identidad del firmante.</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={capacityVerified} onChange={e=>setCapacityVerified(e.target.checked)} />He comprobado su facultad legal para autorizar al estudiante.</label>
        </section>

        <section className="space-y-3 rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Solicitudes recientes</h2><button type="button" onClick={() => void reload()} className="rounded-lg border px-3 py-2 text-xs">Actualizar</button></div>
          <div className="space-y-3">
            {rows.length === 0 ? <p className="text-sm text-slate-500">Sin registros disponibles.</p> : rows.map(row => (
              <article key={row.id} className="space-y-2 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{row.student_name_declared || "Estudiante asociado"}</strong><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{row.status}</span></div>
                <p className="text-xs text-slate-600">Institución: {row.institution_name} · Contacto: {row.guardian_email}</p>
                <p className="text-xs text-slate-600">Firmante: {row.guardian_full_name || "Pendiente"} · Relación: {row.guardian_relationship || "Pendiente"}</p>
                <p className="text-xs text-slate-600">Decisiones: {Object.entries(row.decisions || {}).map(([key, val])=>`${key}: ${val ? "Sí" : "No"}`).join(" · ") || "Aún no presentadas"}</p>
                <div className="flex flex-wrap gap-2">
                  {row.status === "submitted" && (
                    <>
                      <button type="button" disabled={loading || !identityVerified || !capacityVerified || proofRef.trim().length < 5} onClick={()=>void action({action:"approve",requestId:row.id,identityVerified,legalCapacityVerified:capacityVerified,verifiedMethod:"manual_institution",evidenceRef:proofRef})} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white disabled:opacity-40">Aprobar verificación</button>
                      <button type="button" disabled={loading} onClick={()=>void action({action:"reject",requestId:row.id})} className="rounded-lg border px-3 py-2 text-xs">Rechazar</button>
                    </>
                  )}
                  {row.status === "approved" && <button type="button" disabled={loading} onClick={()=>void action({action:"revoke",requestId:row.id})} className="rounded-lg border border-red-300 px-3 py-2 text-xs text-red-700">Revocar</button>}
                </div>
              </article>
            ))}
          </div>
        </section>
        {status && <p role="status" className="rounded-xl border bg-white p-4 text-sm">{status}</p>}
      </div>
    </main>
  )
}
