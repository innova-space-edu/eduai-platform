"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { familyPurposes, FAMILY_CONSENT_VERSION } from "@/lib/family-consent/config"

const PLATFORM = "eduai" as const
const purposes = familyPurposes(PLATFORM)
type RequestInfo = { institutionName?: string; expiresAt?: string; documentVersion: string; status: string }

export default function FamilyAuthorizationForm() {
  const params = useParams<{ token: string }>()
  const token = params?.token || ""
  const [requestInfo, setRequestInfo] = useState<RequestInfo | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [receipt, setReceipt] = useState("")
  const [revoked, setRevoked] = useState(false)
  const [revokeConfirm, setRevokeConfirm] = useState(false)
  const [guardianName, setGuardianName] = useState("")
  const [studentName, setStudentName] = useState("")
  const [guardianEmail, setGuardianEmail] = useState("")
  const [relationship, setRelationship] = useState("")
  const [signatureName, setSignatureName] = useState("")
  const [legalDeclaration, setLegalDeclaration] = useState(false)
  const [signatureConfirmation, setSignatureConfirmation] = useState(false)
  const [choices, setChoices] = useState<Record<string, boolean | null>>(
    Object.fromEntries(purposes.map(p => [p.key, null])),
  )

  useEffect(() => {
    if (!token) return
    let active = true
    fetch(`/api/family-consent?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Invitación no disponible")
        if (active) setRequestInfo(data)
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Error de acceso") })
      .finally(() => { if (active) setFetching(false) })
    return () => { active = false }
  }, [token])

  const complete = useMemo(
    () => purposes.every(p => typeof choices[p.key] === "boolean"),
    [choices],
  )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    if (!requestInfo || !complete || !legalDeclaration || !signatureConfirmation) {
      setError("Debes seleccionar sí o no para cada finalidad, declarar tu vínculo y confirmar la firma.")
      return
    }
    setSending(true)
    try {
      const response = await fetch("/api/family-consent", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({
          token, guardianName, studentName, guardianEmail, relationship, signatureName,
          guardianDeclaration: legalDeclaration,
          acceptsElectronicSignature: signatureConfirmation,
          documentVersion: FAMILY_CONSENT_VERSION, decisions: choices,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No fue posible firmar")
      setReceipt(result.receipt)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inténtalo nuevamente")
    } finally { setSending(false) }
  }

  async function withdraw(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    if (!revokeConfirm || !guardianEmail || !signatureName) {
      setError("Para revocar, confirma tu correo, nombre de firma y voluntad expresa.")
      return
    }
    setSending(true)
    try {
      const response = await fetch("/api/family-consent", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, guardianEmail, signatureName, confirmRevocation: true }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo retirar la autorización")
      setRevoked(true)
    } catch (err) { setError(err instanceof Error ? err.message : "Error de revocación") }
    finally { setSending(false) }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl bg-slate-900 p-6 text-white">
          <p className="text-xs uppercase tracking-widest text-cyan-300">Innova Space Edu SpA · {PLATFORM === "eduai" ? "EDUAI" : "Sello Tecnológico"}</p>
          <h1 className="mt-2 text-2xl font-bold">Autorización familiar de uso y tratamiento de datos</h1>
          <p className="mt-2 text-sm text-slate-200">Formulario individual y privado para madres, padres, representantes legales y quienes ejercen el cuidado personal de un menor.</p>
        </header>
        {fetching ? <p role="status" className="rounded-xl bg-white p-5">Validando invitación…</p> : null}
        {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p> : null}
        {revoked || requestInfo?.status === "revoked" ? (
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">Autorizaciones retiradas</h2>
            <p className="mt-2 text-sm">Se registró la revocación. El establecimiento recibirá la constancia de estado al revisar la solicitud. Solicita asistencia si hay otras cuentas o formularios vinculados.</p>
          </section>
        ) : receipt ? (
          <section className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-6">
            <h2 className="font-semibold">Formulario firmado y recibido</h2>
            <p className="text-sm">Tu firma electrónica simple y tus elecciones quedaron presentadas. La institución debe verificar la identidad y las facultades legales antes de aprobarlas. Un enlace recibido o una firma escrita no acreditan por sí solos la representación legal.</p>
            <p className="break-all font-mono text-xs">Comprobante: {receipt}</p>
            <p className="text-xs">Puedes solicitar copia, consultar el estado o revocar autorizaciones a través del establecimiento y de contacto@innova-space-edu.cl.</p>
            <button type="button" onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">Imprimir comprobante</button>
            <button type="button" onClick={() => setRequestInfo({ documentVersion: FAMILY_CONSENT_VERSION, status: "submitted" })} className="ml-2 rounded-lg border px-4 py-2 text-sm">Revocar permisos</button>
          </section>
        ) : requestInfo?.status === "submitted" || requestInfo?.status === "approved" ? (
          <form onSubmit={withdraw} className="space-y-3 rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">Retirar autorizaciones presentadas</h2>
            <p className="text-sm">Puedes retirar tus permisos mediante este mismo enlace privado. El cambio bloqueará las finalidades opcionales aprobadas; puede requerirse nueva verificación para futuras autorizaciones.</p>
            <label className="block text-sm">Correo del firmante<input required type="email" value={guardianEmail} onChange={e=>setGuardianEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label className="block text-sm">Nombre completo utilizado en la firma<input required value={signatureName} onChange={e=>setSignatureName(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={revokeConfirm} onChange={e=>setRevokeConfirm(e.target.checked)} />Confirmo que deseo revocar los permisos opcionales asociados a este formulario.</label>
            <button disabled={sending || !revokeConfirm} className="rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{sending ? "Revocando..." : "Revocar autorización"}</button>
          </form>
        ) : requestInfo ? (
          <form onSubmit={submit} className="space-y-5">
            <section className="space-y-3 rounded-2xl border bg-white p-5">
              <p className="text-xs text-slate-600">Institución: <strong>{requestInfo.institutionName}</strong> · Documento: {requestInfo.documentVersion}</p>
              <p className="text-xs text-slate-600">Invitación válida hasta {new Date(requestInfo.expiresAt).toLocaleString("es-CL")}. El uso de ClaveÚnica no forma parte de este formulario: si una entidad habilitada permite tal autenticación en el futuro, se integrará por un canal independiente y autorizado.</p>
              <h2 className="font-semibold">1. Identificación y declaración del adulto</h2>
              <label className="block text-sm">Nombre completo del estudiante <input required maxLength={180} value={studentName} onChange={e => setStudentName(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
              <label className="block text-sm">Nombre completo del adulto que firma <input required maxLength={180} value={guardianName} onChange={e => setGuardianName(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
              <label className="block text-sm">Correo autorizado para recibir esta invitación <input type="email" required maxLength={254} value={guardianEmail} onChange={e => setGuardianEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
              <label className="block text-sm">Vínculo legal declarado
                <select required value={relationship} onChange={e => setRelationship(e.target.value)} className="mt-1 w-full rounded-lg border p-3">
                  <option value="">Seleccionar</option>
                  <option value="madre">Madre</option><option value="padre">Padre</option>
                  <option value="representante_legal">Representante legal</option>
                  <option value="cuidador_personal">Persona con cuidado personal</option>
                </select>
              </label>
            </section>
            <section className="space-y-4 rounded-2xl border bg-white p-5">
              <h2 className="font-semibold">2. Decisión individual por finalidad</h2>
              <p className="text-sm text-slate-700">Marca expresamente Sí o No en cada caso. Rechazar una finalidad opcional no autoriza a sustituirla por otro uso. Los tratamientos necesarios por obligación legal o por una base contractual válida se documentan separadamente.</p>
              {purposes.map(purpose => (
                <fieldset key={purpose.key} className="rounded-xl border p-4">
                  <legend className="px-1 text-sm font-semibold">{purpose.title}</legend>
                  <p className="mb-3 text-xs text-slate-600">{purpose.description}</p>
                  <div className="flex gap-6 text-sm">
                    <label className="flex items-center gap-2"><input type="radio" name={purpose.key} checked={choices[purpose.key] === true} onChange={() => setChoices(prev => ({ ...prev, [purpose.key]: true }))} />Sí, autorizo</label>
                    <label className="flex items-center gap-2"><input type="radio" name={purpose.key} checked={choices[purpose.key] === false} onChange={() => setChoices(prev => ({ ...prev, [purpose.key]: false }))} />No autorizo</label>
                  </div>
                </fieldset>
              ))}
              <p className="text-xs text-slate-600">No se solicita autorización general para analizar expedientes médicos, datos PIE/NEE, perfilamiento ni clonación de voz. Tales operaciones requieren procesos especiales si correspondieran.</p>
            </section>
            <section className="space-y-4 rounded-2xl border bg-white p-5">
              <h2 className="font-semibold">3. Declaración y firma electrónica simple</h2>
              <p className="text-xs leading-5 text-slate-700">La información del estudiante está protegida. El formulario se asocia a una cuenta de estudiante sin mostrar sus datos en el enlace público. La firma electrónica simple y el enlace no verifican por sí mismos identidad ni autoridad parental. El establecimiento podrá solicitar antecedentes por un canal seguro, únicamente cuando sea necesario.</p>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={legalDeclaration} onChange={e => setLegalDeclaration(e.target.checked)} className="mt-1" />Declaro actuar con la facultad legal necesaria respecto del estudiante y que las decisiones anteriores son expresas y voluntarias.</label>
              <label className="block text-sm">Escribe tu nombre completo como firma <input required maxLength={180} value={signatureName} onChange={e => setSignatureName(e.target.value)} className="mt-1 w-full rounded-lg border p-3" placeholder="Debe coincidir con el nombre declarado" /></label>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={signatureConfirmation} onChange={e => setSignatureConfirmation(e.target.checked)} className="mt-1" />Confirmo que esta firma electrónica simple corresponde a mi declaración y deseo remitir este documento para validación.</label>
              <p className="text-xs text-slate-600">Puedes rechazar todos los permisos opcionales y presentar el formulario. Posteriormente podrás pedir la revocación de las autorizaciones otorgadas.</p>
              <button type="submit" disabled={sending || !complete} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{sending ? "Enviando..." : "Firmar y enviar para verificación"}</button>
            </section>
          </form>
        ) : !fetching ? <p className="rounded-xl bg-white p-4 text-sm">Solicita una nueva invitación a la institución.</p> : null}
      </div>
    </main>
  )
}
