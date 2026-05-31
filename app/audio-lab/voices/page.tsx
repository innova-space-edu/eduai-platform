"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Copy, KeyRound, Loader2, LockKeyhole, Mic2, Plus, RefreshCw, ShieldCheck, Trash2, Upload, Volume2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const TERMS_VERSION = "voice-cloning-v1"
const SESSION_SECONDS = 180

interface VoiceProfile {
  id: string
  display_name: string
  source_kind: "self" | "authorized_third_party"
  status: "draft" | "processing" | "ready" | "disabled" | "deleted"
  sample_path: string | null
  model_provider: string | null
  provider_voice_id: string | null
  internal_use_enabled: boolean
  default_voice: boolean
  adult_confirmed: boolean
  consent_confirmed: boolean
  authorization_confirmed: boolean
  consented_at: string | null
  created_at: string
}

interface SecurityProfile {
  birth_date: string | null
  rut: string | null
  voice_cloning_terms_accepted_at: string | null
  voice_cloning_terms_version: string | null
}

export default function AudioLabVoicesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [profile, setProfile] = useState<SecurityProfile | null>(null)
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

  const refreshSecurity = useCallback(async () => {
    const response = await fetch("/api/agents/audio/voices/security", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      router.push("/login")
      return
    }
    setUnlocked(data.unlocked === true)
    setProfile(data.profile || null)
    if (data.profile?.birth_date) setBirthDate(data.profile.birth_date)
    if (data.profile?.rut) setRut(data.profile.rut)
    setLoading(false)
  }, [router])

  const loadVoices = useCallback(async () => {
    const response = await fetch("/api/agents/audio/voices/profiles", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401) setUnlocked(false)
      return
    }
    setVoices(data.profiles || [])
  }, [])

  useEffect(() => {
    refreshSecurity()
  }, [refreshSecurity])

  useEffect(() => {
    if (!unlocked) return
    setSecondsLeft(SESSION_SECONDS)
    loadVoices()
  }, [unlocked, loadVoices])

  useEffect(() => {
    if (!unlocked) return
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval)
          fetch("/api/agents/audio/voices/security", { method: "DELETE" }).finally(() => setUnlocked(false))
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [unlocked])

  useEffect(() => {
    if (!unlocked) return
    let timeout: number | null = null
    const touch = () => {
      setSecondsLeft(SESSION_SECONDS)
      if (timeout) window.clearTimeout(timeout)
      timeout = window.setTimeout(async () => {
        const response = await fetch("/api/agents/audio/voices/security", { method: "PATCH" })
        if (!response.ok) setUnlocked(false)
      }, 600)
    }

    const events = ["click", "keydown", "input", "change", "pointerdown"]
    events.forEach((event) => window.addEventListener(event, touch))
    return () => {
      events.forEach((event) => window.removeEventListener(event, touch))
      if (timeout) window.clearTimeout(timeout)
    }
  }, [unlocked])

  async function acceptTerms() {
    setError("")
    const response = await fetch("/api/agents/audio/voices/terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthDate, rut, accepted: termsAccepted }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.error || "No se pudo registrar el consentimiento")
    setSuccess("Términos registrados. Ahora activa o verifica el segundo factor.")
    await refreshSecurity()
  }

  async function enrollMfa() {
    setError("")
    setMfaLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "EduAI Voice Cloning" })
      if (error) throw error
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
    } catch (reason: any) {
      setError(reason?.message || "No se pudo activar el segundo factor")
    } finally {
      setMfaLoading(false)
    }
  }

  async function listTotpFactor() {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw error
    const verified = data.totp.find((factor) => factor.status === "verified")
    const pending = data.totp.find((factor) => factor.status === "unverified")
    return verified?.id || pending?.id || ""
  }

  async function verifyAndUnlock() {
    setError("")
    setMfaLoading(true)
    try {
      const selectedFactorId = factorId || await listTotpFactor()
      if (!selectedFactorId) throw new Error("Primero configura una aplicación autenticadora")
      if (!totpCode.trim()) throw new Error("Escribe el código temporal de seis dígitos")

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: selectedFactorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: selectedFactorId,
        challengeId: challenge.id,
        code: totpCode.trim(),
      })
      if (verifyError) throw verifyError

      const response = await fetch("/api/agents/audio/voices/security", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "No se pudo desbloquear la zona protegida")

      setTotpCode("")
      setUnlocked(true)
      setSecondsLeft(SESSION_SECONDS)
      setSuccess("Zona protegida desbloqueada durante tres minutos renovables por actividad.")
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
    setSecondsLeft(0)
  }

  async function createVoiceProfile() {
    setCreatingVoice(true)
    setError("")
    try {
      const response = await fetch("/api/agents/audio/voices/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          sourceKind,
          adultConfirmed,
          consentConfirmed,
          authorizationConfirmed,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "No se pudo crear el perfil")
      setDisplayName("")
      setAdultConfirmed(false)
      setConsentConfirmed(false)
      setAuthorizationConfirmed(false)
      setSuccess("Perfil vocal creado. Sube una muestra limpia de voz para continuar.")
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
    setError("")
    try {
      const prepare = await fetch("/api/agents/audio/voices/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: activeUploadProfileId, filename: file.name, size: file.size }),
      })
      const prepared = await prepare.json().catch(() => ({}))
      if (!prepare.ok) throw new Error(prepared.error || "No se pudo preparar la carga")

      const { error: uploadError } = await supabase.storage
        .from(prepared.bucket)
        .upload(prepared.filePath, file, { upsert: false, contentType: file.type || "audio/wav" })
      if (uploadError) throw uploadError

      const confirm = await fetch("/api/agents/audio/voices/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: activeUploadProfileId, filePath: prepared.filePath }),
      })
      const confirmed = await confirm.json().catch(() => ({}))
      if (!confirm.ok) throw new Error(confirmed.error || "No se pudo confirmar la muestra")

      setSuccess("Muestra privada subida. Quedará lista para procesarse cuando conectemos el motor OpenVoice.")
      setActiveUploadProfileId("")
      await loadVoices()
    } catch (reason: any) {
      setError(reason?.message || "No se pudo subir la muestra")
    } finally {
      setUploading(false)
    }
  }

  const sessionLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
  const termsRegistered = !!profile?.voice_cloning_terms_accepted_at

  return (
    <main className="min-h-screen bg-app px-4 py-8 text-main">
      <section className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/audio-lab" className="w-9 h-9 rounded-xl border border-soft flex items-center justify-center text-sub hover:text-main"><ArrowLeft size={15} /></Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2"><ShieldCheck size={18} className="text-purple-500" /> Audio Lab · Mis voces</h1>
              <p className="text-muted2 text-xs">Biblioteca privada, consentimiento verificable y sesión sensible limitada.</p>
            </div>
          </div>
          {unlocked && <button onClick={lockSensitiveArea} className="rounded-xl border border-soft px-3 py-2 text-xs text-sub flex items-center gap-2"><LockKeyhole size={14} /> Bloquear ahora · {sessionLabel}</button>}
        </div>

        {error && <p className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-500">{error}</p>}
        {success && <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-600">{success}</p>}

        {loading ? (
          <div className="rounded-3xl border border-soft p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : !termsRegistered ? (
          <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-4">
            <div><h2 className="font-bold">1. Registro y consentimiento específico</h2><p className="text-muted2 text-sm mt-1">La clonación se restringe a mayores de edad y exige consentimiento separado para cada voz.</p></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="rounded-xl border border-soft bg-transparent px-3 py-2 text-sm" />
              <input value={rut} onChange={(event) => setRut(event.target.value)} placeholder="RUT opcional" className="rounded-xl border border-soft bg-transparent px-3 py-2 text-sm" />
            </div>
            <label className="flex items-start gap-2 text-sm text-sub"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1" /> Declaro que usaré esta función únicamente con mi propia voz o con autorización expresa de la persona titular, y acepto el registro auditable de las operaciones sensibles.</label>
            <button onClick={acceptTerms} className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm font-semibold">Registrar consentimiento</button>
          </section>
        ) : !unlocked ? (
          <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-4">
            <div><h2 className="font-bold">2. Verificación reforzada</h2><p className="text-muted2 text-sm mt-1">Solo esta zona usa segundo factor. Tu sesión general de EduAI permanece abierta.</p></div>
            {!qrCode && <button onClick={enrollMfa} disabled={mfaLoading} className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-700 flex items-center gap-2"><KeyRound size={15} /> Configurar aplicación autenticadora</button>}
            {qrCode && <div className="rounded-2xl border border-soft p-4 space-y-3"><p className="text-sm text-sub">Escanea este QR con Google Authenticator, Microsoft Authenticator, Authy o una aplicación compatible con TOTP.</p><img src={qrCode} alt="QR TOTP" className="w-48 h-48 bg-white p-2 rounded-xl" /></div>}
            <div className="flex gap-2"><input value={totpCode} onChange={(event) => setTotpCode(event.target.value)} placeholder="Código de 6 dígitos" inputMode="numeric" className="flex-1 rounded-xl border border-soft bg-transparent px-3 py-2 text-sm" /><button onClick={verifyAndUnlock} disabled={mfaLoading} className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm font-semibold">Verificar y desbloquear</button></div>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-600" /><div><p className="font-semibold text-sm">Zona protegida activa</p><p className="text-muted2 text-xs">Se bloqueará solo esta sección tras tres minutos sin actividad.</p></div></section>

            <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-4">
              <div><h2 className="font-bold flex items-center gap-2"><Plus size={16} /> Agregar perfil vocal</h2><p className="text-muted2 text-sm mt-1">La muestra se almacena de forma privada. La clonación real se activará al conectar OpenVoice.</p></div>
              <div className="grid sm:grid-cols-2 gap-3"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nombre visible de la voz" className="rounded-xl border border-soft bg-transparent px-3 py-2 text-sm" /><select value={sourceKind} onChange={(event) => setSourceKind(event.target.value as "self" | "authorized_third_party")} className="rounded-xl border border-soft bg-app px-3 py-2 text-sm"><option value="self">Es mi propia voz</option><option value="authorized_third_party">Voz de tercero autorizado</option></select></div>
              <label className="flex gap-2 text-sm text-sub"><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} /> Confirmo que soy mayor de edad.</label>
              <label className="flex gap-2 text-sm text-sub"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} /> Autorizo el procesamiento y almacenamiento privado de esta muestra vocal.</label>
              {sourceKind === "authorized_third_party" && <label className="flex gap-2 text-sm text-sub"><input type="checkbox" checked={authorizationConfirmed} onChange={(event) => setAuthorizationConfirmed(event.target.checked)} /> Confirmo que poseo autorización expresa de la persona titular de la voz.</label>}
              <button onClick={createVoiceProfile} disabled={creatingVoice} className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2 w-fit">{creatingVoice ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear perfil</button>
            </section>

            <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-3">
              <div className="flex items-center justify-between"><div><h2 className="font-bold">Biblioteca privada</h2><p className="text-muted2 text-sm mt-1">Tus voces quedan separadas por usuario y no se publican.</p></div><button onClick={loadVoices} className="rounded-xl border border-soft p-2"><RefreshCw size={14} /></button></div>
              {voices.length === 0 ? <p className="text-sm text-muted2">Todavía no existen perfiles vocales.</p> : voices.map((voice) => <article key={voice.id} className="rounded-2xl border border-soft p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-sm flex items-center gap-2"><Volume2 size={14} className="text-purple-500" /> {voice.display_name}</p><p className="text-xs text-muted2 mt-1">{voice.source_kind === "self" ? "Voz propia" : "Tercero autorizado"} · Estado: {voice.status} · {voice.sample_path ? "muestra subida" : "sin muestra"}</p></div><div className="flex gap-2"><button onClick={() => { setActiveUploadProfileId(voice.id); fileInputRef.current?.click() }} className="rounded-xl border border-soft px-3 py-2 text-xs flex items-center gap-2"><Upload size={13} /> {voice.sample_path ? "Reemplazar muestra" : "Subir muestra"}</button><button disabled className="rounded-xl border border-soft px-3 py-2 text-xs opacity-50 flex items-center gap-2" title="Disponible cuando se conecte OpenVoice"><Mic2 size={13} /> Usar internamente</button></div></article>)}
            </section>
          </>
        )}
      </section>

      <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.webm,.ogg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadSample(file); event.target.value = "" }} />
      {uploading && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center"><div className="rounded-2xl bg-app border border-soft p-5 flex items-center gap-3"><Loader2 className="animate-spin text-purple-500" /><span className="text-sm">Subiendo muestra privada…</span></div></div>}
    </main>
  )
}
