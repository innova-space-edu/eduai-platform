"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mic2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { uploadAudioResumable } from "@/lib/audio/resumable-upload"

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

type VoiceProfile = {
  id: string
  display_name: string
  source_kind: "self" | "authorized_third_party"
  status: "draft" | "processing" | "ready" | "disabled" | "deleted"
  sample_path: string | null
  internal_use_enabled: boolean
  default_voice: boolean
}

type SecurityProfile = {
  birth_date: string | null
  rut: string | null
  voice_cloning_terms_accepted_at: string | null
}

export default function AudioLabVoicesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const sampleInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [securityProfile, setSecurityProfile] = useState<SecurityProfile | null>(null)
  const [voices, setVoices] = useState<VoiceProfile[]>([])
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [birthDate, setBirthDate] = useState("")
  const [rut, setRut] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [factorId, setFactorId] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [mfaLoading, setMfaLoading] = useState(false)

  const [displayName, setDisplayName] = useState("")
  const [sourceKind, setSourceKind] = useState<"self" | "authorized_third_party">("self")
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false)
  const [creatingVoice, setCreatingVoice] = useState(false)
  const [activeUploadProfileId, setActiveUploadProfileId] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const refreshSecurity = useCallback(async () => {
    const response = await fetch("/api/agents/audio/voices/security", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      router.push("/login")
      return false
    }
    const isUnlocked = data.unlocked === true
    setUnlocked(isUnlocked)
    setSecurityProfile(data.profile || null)
    if (data.profile?.birth_date) setBirthDate(data.profile.birth_date)
    if (data.profile?.rut) setRut(data.profile.rut)
    setLoading(false)
    return isUnlocked
  }, [router])

  const loadVoices = useCallback(async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch("/api/agents/audio/voices/profiles", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setVoices(data.profiles || [])
        return
      }
      if (response.status !== 401) return
      await supabase.auth.refreshSession()
      await sleep(300)
    }
    await refreshSecurity()
  }, [refreshSecurity, supabase])

  useEffect(() => {
    refreshSecurity()
  }, [refreshSecurity])

  useEffect(() => {
    if (!unlocked) return
    loadVoices()
  }, [unlocked, loadVoices])

  async function acceptTerms() {
    setError("")
    const response = await fetch("/api/agents/audio/voices/terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthDate, rut, accepted: termsAccepted }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.error || "No se pudo registrar el consentimiento")
    setSuccess("Términos registrados. Ahora configura o verifica el segundo factor.")
    await refreshSecurity()
  }

  async function enrollMfa() {
    setError("")
    setMfaLoading(true)
    try {
      const mfa = supabase.auth.mfa as any
      const { data, error: enrollError } = await mfa.enroll({
        factorType: "totp",
        friendlyName: "EduAI Voice Cloning",
      })
      if (enrollError) throw enrollError
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
    } catch (reason: any) {
      setError(reason?.message || "No se pudo activar el segundo factor")
    } finally {
      setMfaLoading(false)
    }
  }

  async function getTotpFactorId() {
    const mfa = supabase.auth.mfa as any
    const { data, error: listError } = await mfa.listFactors()
    if (listError) throw listError
    const factors = Array.isArray(data?.totp) ? data.totp : []
    return factors.find((factor: any) => factor.status === "verified")?.id
      || factors.find((factor: any) => factor.status === "unverified")?.id
      || ""
  }

  async function openSensitiveSession() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch("/api/agents/audio/voices/security", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (response.ok) return
      if (attempt === 2) throw new Error(data.error || "No se pudo desbloquear la zona protegida")
      await supabase.auth.refreshSession()
      await sleep(300)
    }
  }

  async function verifyAndUnlock() {
    setError("")
    setMfaLoading(true)
    try {
      const selectedFactorId = factorId || await getTotpFactorId()
      if (!selectedFactorId) throw new Error("Primero configura una aplicación autenticadora")
      if (!totpCode.trim()) throw new Error("Escribe el código temporal de seis dígitos")

      const mfa = supabase.auth.mfa as any
      const { data: challenge, error: challengeError } = await mfa.challenge({ factorId: selectedFactorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await mfa.verify({
        factorId: selectedFactorId,
        challengeId: challenge.id,
        code: totpCode.trim(),
      })
      if (verifyError) throw verifyError

      await supabase.auth.refreshSession()
      await sleep(300)
      await openSensitiveSession()

      setTotpCode("")
      setQrCode("")
      setUnlocked(true)
      setSuccess("Zona protegida desbloqueada para esta sesión.")
      await loadVoices()
    } catch (reason: any) {
      setError(reason?.message || "No se pudo verificar el segundo factor")
    } finally {
      setMfaLoading(false)
    }
  }

  async function lockSensitiveArea() {
    await fetch("/api/agents/audio/voices/security", { method: "DELETE" })
    setUnlocked(false)
  }

  async function createVoiceProfile() {
    setCreatingVoice(true)
    setError("")
    try {
      const response = await fetch("/api/agents/audio/voices/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, sourceKind, adultConfirmed, consentConfirmed, authorizationConfirmed }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "No se pudo crear el perfil")
      setDisplayName("")
      setAdultConfirmed(false)
      setConsentConfirmed(false)
      setAuthorizationConfirmed(false)
      setSuccess("Perfil vocal creado. Sube una muestra limpia para continuar.")
      await loadVoices()
    } catch (reason: any) {
      setError(reason?.message || "No se pudo crear el perfil")
    } finally {
      setCreatingVoice(false)
    }
  }

  async function uploadSample(file: File) {
    if (!activeUploadProfileId) return
    setUploading(true)
    setUploadProgress(0)
    setError("")
    try {
      const prepareResponse = await fetch("/api/agents/audio/voices/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: activeUploadProfileId, filename: file.name, size: file.size }),
      })
      const prepared = await prepareResponse.json().catch(() => ({}))
      if (!prepareResponse.ok) throw new Error(prepared.error || "No se pudo preparar la carga")

      await uploadAudioResumable({
        supabase,
        bucket: prepared.bucket,
        objectName: prepared.filePath,
        file,
        onProgress: ({ percentage }) => setUploadProgress(percentage),
      })

      const confirmResponse = await fetch("/api/agents/audio/voices/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: activeUploadProfileId, filePath: prepared.filePath }),
      })
      const confirmed = await confirmResponse.json().catch(() => ({}))
      if (!confirmResponse.ok) throw new Error(confirmed.error || "No se pudo confirmar la muestra")

      setSuccess("Muestra privada subida. Quedó preparada para el motor OpenVoice.")
      setActiveUploadProfileId("")
      await loadVoices()
    } catch (reason: any) {
      setError(reason?.message || "No se pudo subir la muestra")
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  async function deleteVoice(profileId: string) {
    if (!window.confirm("¿Eliminar esta voz y su muestra privada?")) return
    setError("")
    const response = await fetch("/api/agents/audio/voices/profiles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.error || "No se pudo eliminar la voz")
    setSuccess("Perfil vocal y muestra privada eliminados.")
    await loadVoices()
  }

  const termsRegistered = Boolean(securityProfile?.voice_cloning_terms_accepted_at)

  return (
    <main className="min-h-screen bg-app px-4 py-8 text-main">
      <section className="max-w-5xl mx-auto space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/audio-lab" className="w-9 h-9 rounded-xl border border-soft flex items-center justify-center text-sub hover:text-main"><ArrowLeft size={15} /></Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2"><ShieldCheck size={18} className="text-purple-500" /> Audio Lab · Mis voces</h1>
              <p className="text-muted2 text-xs">Biblioteca privada, consentimiento verificable y sesión sensible vinculada a tu acceso.</p>
            </div>
          </div>
          {unlocked && <button onClick={lockSensitiveArea} className="rounded-xl border border-soft px-3 py-2 text-xs text-sub flex items-center gap-2"><LockKeyhole size={14} /> Bloquear ahora</button>}
        </header>

        {error && <p className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-500">{error}</p>}
        {success && <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-600">{success}</p>}

        {loading ? <div className="rounded-3xl border border-soft p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        : !termsRegistered ? <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-4">
            <h2 className="font-bold">1. Registro y consentimiento específico</h2>
            <p className="text-muted2 text-sm">La clonación se restringe a mayores de edad y exige consentimiento separado.</p>
            <div className="grid sm:grid-cols-2 gap-3"><input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="rounded-xl border border-soft bg-transparent px-3 py-2 text-sm" /><input value={rut} onChange={(event) => setRut(event.target.value)} placeholder="RUT opcional" className="rounded-xl border border-soft bg-transparent px-3 py-2 text-sm" /></div>
            <label className="flex items-start gap-2 text-sm text-sub"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1" /> Declaro que usaré esta función únicamente con mi propia voz o con autorización expresa de la persona titular.</label>
            <button onClick={acceptTerms} className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm font-semibold">Registrar consentimiento</button>
          </section>
        : !unlocked ? <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-4">
            <h2 className="font-bold">2. Verificación reforzada</h2>
            <p className="text-muted2 text-sm">Solo esta zona usa segundo factor. Tu sesión general de EduAI permanece abierta.</p>
            {!qrCode && <button onClick={enrollMfa} disabled={mfaLoading} className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-700 flex items-center gap-2"><KeyRound size={15} /> Configurar aplicación autenticadora</button>}
            {qrCode && <div className="rounded-2xl border border-soft p-4 space-y-3"><p className="text-sm text-sub">Escanea este QR con una aplicación autenticadora TOTP.</p><img src={qrCode} alt="QR TOTP" className="w-48 h-48 bg-white p-2 rounded-xl" /></div>}
            <div className="flex gap-2"><input value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" className="flex-1 rounded-xl border border-soft bg-transparent px-3 py-2 text-sm" /><button onClick={verifyAndUnlock} disabled={mfaLoading || totpCode.length !== 6} className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{mfaLoading ? "Verificando…" : "Verificar y desbloquear"}</button></div>
          </section>
        : <>
            <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-600" /><div><p className="font-semibold text-sm">Zona protegida activa</p><p className="text-muted2 text-xs">Permanecerá activa hasta cerrar sesión o bloquearla manualmente.</p></div></section>
            <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-4">
              <h2 className="font-bold flex items-center gap-2"><Plus size={16} /> Agregar perfil vocal</h2>
              <div className="grid sm:grid-cols-2 gap-3"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nombre visible de la voz" className="rounded-xl border border-soft bg-transparent px-3 py-2 text-sm" /><select value={sourceKind} onChange={(event) => setSourceKind(event.target.value as "self" | "authorized_third_party")} className="rounded-xl border border-soft bg-app px-3 py-2 text-sm"><option value="self">Es mi propia voz</option><option value="authorized_third_party">Voz de tercero autorizado</option></select></div>
              <label className="flex gap-2 text-sm text-sub"><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} /> Confirmo que soy mayor de edad.</label>
              <label className="flex gap-2 text-sm text-sub"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} /> Autorizo el procesamiento y almacenamiento privado de esta muestra vocal.</label>
              {sourceKind === "authorized_third_party" && <label className="flex gap-2 text-sm text-sub"><input type="checkbox" checked={authorizationConfirmed} onChange={(event) => setAuthorizationConfirmed(event.target.checked)} /> Confirmo que poseo autorización expresa de la persona titular.</label>}
              <button onClick={createVoiceProfile} disabled={creatingVoice} className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2 w-fit">{creatingVoice ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear perfil</button>
            </section>
            <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-3">
              <div className="flex items-center justify-between"><div><h2 className="font-bold">Biblioteca privada</h2><p className="text-muted2 text-sm">Tus voces quedan separadas por usuario.</p></div><button onClick={loadVoices} className="rounded-xl border border-soft p-2"><RefreshCw size={14} /></button></div>
              {voices.length === 0 ? <p className="text-sm text-muted2">Todavía no existen perfiles vocales.</p> : voices.map((voice) => <article key={voice.id} className="rounded-2xl border border-soft p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-sm flex items-center gap-2"><Volume2 size={14} className="text-purple-500" /> {voice.display_name}</p><p className="text-xs text-muted2 mt-1">{voice.source_kind === "self" ? "Voz propia" : "Tercero autorizado"} · Estado: {voice.status} · {voice.sample_path ? "muestra subida" : "sin muestra"}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => { setActiveUploadProfileId(voice.id); sampleInputRef.current?.click() }} className="rounded-xl border border-soft px-3 py-2 text-xs flex items-center gap-2"><Upload size={13} /> {voice.sample_path ? "Reemplazar" : "Subir muestra"}</button><button disabled className="rounded-xl border border-soft px-3 py-2 text-xs opacity-50 flex items-center gap-2" title="Disponible al conectar OpenVoice"><Mic2 size={13} /> Usar internamente</button><button onClick={() => deleteVoice(voice.id)} className="rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-500 flex items-center gap-2"><Trash2 size={13} /> Eliminar</button></div></article>)}
            </section>
          </>}
      </section>

      <input ref={sampleInputRef} type="file" accept=".mp3,.wav,.m4a,.webm,.ogg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadSample(file); event.target.value = "" }} />
      {uploading && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center"><div className="rounded-2xl bg-app border border-soft p-5 space-y-3 w-72"><div className="flex items-center gap-3"><Loader2 className="animate-spin text-purple-500" /><span className="text-sm">Subiendo muestra privada… {uploadProgress}%</span></div><div className="h-2 rounded-full overflow-hidden bg-black/10"><div className="h-full bg-purple-500 transition-all" style={{ width: `${uploadProgress}%` }} /></div></div></div>}
    </main>
  )
}
