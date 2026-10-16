"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ExternalLink,
  Download,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mic2,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { uploadAudioResumable } from "@/lib/audio/resumable-upload"
import { callAudioEngine, currentSupabaseToken, streamAudioEngine } from "@/lib/audio/cloud-run-client"

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

type VoiceProfile = {
  id: string
  display_name: string
  source_kind: "self" | "authorized_third_party"
  status: "draft" | "processing" | "ready" | "disabled" | "deleted"
  sample_path: string | null
  consent_audio_path?: string | null
  canonical_audio_path?: string | null
  provider_voice_id?: string | null
  internal_use_enabled: boolean
  default_voice: boolean
  model_provider?: string | null
  processing_error?: string | null
  processing_progress?: number | null
  processing_stage?: string | null
  processed_at?: string | null
}

type KaggleAudio = {
  id: string
  profile_id: string
  created_at: string
  audio_url: string
}

const KAGGLE_URL_KEY = "eduai_voice_kaggle_notebook_url"
const KAGGLE_START_URL = "https://www.kaggle.com/code/new"
const KAGGLE_GUIDE_URL = "https://github.com/innova-space-edu/eduai-platform/blob/main/notebooks/eduai_chatterbox_kaggle.ipynb"

function validKaggleNotebookUrl(input: string) {
  try {
    const url = new URL(input.trim())
    return url.protocol === "https:" &&
      (url.hostname === "kaggle.com" || url.hostname === "www.kaggle.com") &&
      /^\/code\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/.test(url.pathname) &&
      !url.username && !url.password && !url.search && !url.hash
  } catch { return false }
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
  const consentInputRef = useRef<HTMLInputElement>(null)
  const kaggleInputRef = useRef<HTMLInputElement>(null)

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
  const [activeUploadKind, setActiveUploadKind] = useState<"reference" | "consent">("reference")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingVoiceId, setProcessingVoiceId] = useState("")
  const [playingVoiceId, setPlayingVoiceId] = useState("")
  const [voiceRenderProgress, setVoiceRenderProgress] = useState(0)
  const [voiceRenderLabel, setVoiceRenderLabel] = useState("")
  const [engineStatus, setEngineStatus] = useState<{ ok: boolean; message: string; provider: string } | null>(null)
  const [kaggleNotebookUrl, setKaggleNotebookUrl] = useState("")
  const [kaggleUrlInput, setKaggleUrlInput] = useState("")
  const [kaggleProfileId, setKaggleProfileId] = useState("")
  const [kaggleUploading, setKaggleUploading] = useState(false)
  const [kaggleAudios, setKaggleAudios] = useState<KaggleAudio[]>([])

  const refreshSecurity = useCallback(async () => {
    const response = await fetch("/api/agents/audio/voices/security", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      router.push("/login")
      return false
    }
    if (response.status === 403) {
      setUnlocked(false)
      setLoading(false)
      setError(data.error || "La clonación vocal requiere una cuenta administradora autorizada y mayor de edad.")
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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch("/api/agents/audio/voices/profiles", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setVoices(data.profiles || [])
        return true
      }
      if (response.status === 503) {
        setError(data.error || "El servicio de seguridad vocal está ocupado. Reintenta en unos segundos.")
        return false
      }
      if (response.status !== 401) {
        setError(data.error || "No se pudo cargar la biblioteca de voces")
        return false
      }

      await supabase.auth.refreshSession()
      if (attempt < 2) {
        await fetch("/api/agents/audio/voices/security", { method: "POST" }).catch(() => null)
        await sleep(300)
      }
    }

    const stillUnlocked = await refreshSecurity()
    if (!stillUnlocked) setUnlocked(false)
    return false
  }, [refreshSecurity, supabase])

  useEffect(() => {
    refreshSecurity()
  }, [refreshSecurity])
  useEffect(() => {
    const saved = window.localStorage.getItem(KAGGLE_URL_KEY) || ""
    if (validKaggleNotebookUrl(saved)) {
      setKaggleNotebookUrl(saved)
      setKaggleUrlInput(saved)
    }
  }, [])

  const loadKaggleAudios = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/audio/voices/kaggle-import", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json().catch(() => ({}))
      if (Array.isArray(data.audios)) setKaggleAudios(data.audios)
    } catch {
      // La biblioteca es opcional; la autenticación se comprueba en cada ruta.
    }
  }, [])

  useEffect(() => {
    if (unlocked) void loadKaggleAudios()
    else setKaggleAudios([])
  }, [unlocked, loadKaggleAudios])

  function saveKaggleUrl() {
    const url = kaggleUrlInput.trim()
    if (!url) {
      window.localStorage.removeItem(KAGGLE_URL_KEY)
      setKaggleNotebookUrl("")
      setSuccess("Enlace restablecido. El botón abrirá un notebook nuevo en Kaggle.")
      return
    }
    if (!validKaggleNotebookUrl(url)) {
      setError("Usa el enlace de tu notebook privado: https://www.kaggle.com/code/usuario/nombre")
      return
    }
    window.localStorage.setItem(KAGGLE_URL_KEY, url)
    setKaggleNotebookUrl(url)
    setError("")
    setSuccess("Enlace privado de Kaggle guardado en este navegador.")
  }

  async function importKaggleWav(file: File) {
    if (!kaggleProfileId) return setError("Elige primero un perfil vocal.")
    if (!/\.wav$/i.test(file.name) || file.size > 8 * 1024 * 1024) {
      return setError("El resultado de Kaggle debe ser WAV y pesar como máximo 8 MB.")
    }
    setError("")
    setKaggleUploading(true)
    try {
      const form = new FormData()
      form.set("profileId", kaggleProfileId)
      form.set("audio", file)
      const response = await fetch("/api/agents/audio/voices/kaggle-import", { method: "POST", body: form })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "No fue posible importar el audio")
      setSuccess(result.message || "Audio de Kaggle importado a tu biblioteca privada.")
      await loadKaggleAudios()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar el audio")
    } finally {
      setKaggleUploading(false)
      setKaggleProfileId("")
    }
  }


  useEffect(() => {
    if (!unlocked) { setEngineStatus(null); return }
    loadVoices()
    let cancelled = false
    void fetch("/api/agents/audio/voices/engine", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!cancelled) setEngineStatus({
          ok: response.ok && data.ok === true,
          message: String(data.message || "No se pudo consultar el motor vocal."),
          provider: String(data.provider || "Motor de voz"),
        })
      }).catch(() => {
        if (!cancelled) setEngineStatus({ ok: false, message: "No se pudo consultar el motor vocal.", provider: "Motor de voz" })
      })
    return () => { cancelled = true }
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
      setSuccess("Perfil vocal creado. Sube una muestra de referencia y la grabación de consentimiento para continuar.")
      await loadVoices()
    } catch (reason: any) {
      setError(reason?.message || "No se pudo crear el perfil")
    } finally {
      setCreatingVoice(false)
    }
  }

  async function uploadSample(file: File, kind: "reference" | "consent") {
    if (!activeUploadProfileId) return
    setUploading(true)
    setUploadProgress(0)
    setError("")

    try {
      const profileId = activeUploadProfileId
      const current = voices.find((voice) => voice.id === profileId)

      if (current?.provider_voice_id) {
        const token = await currentSupabaseToken(supabase)
        await callAudioEngine("/v1/voice/delete", token, { profile_id: profileId }).catch(() => null)
      }

      const prepareResponse = await fetch("/api/agents/audio/voices/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, filename: file.name, size: file.size, kind }),
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
        body: JSON.stringify({ profileId, filePath: prepared.filePath, kind }),
      })
      const confirmed = await confirmResponse.json().catch(() => ({}))
      if (!confirmResponse.ok) throw new Error(confirmed.error || "No se pudo confirmar el audio")

      setActiveUploadProfileId("")
      setSuccess(
        kind === "consent"
          ? "Consentimiento de voz guardado. Cuando la muestra de referencia también esté lista, podrás replicar la voz."
          : "Muestra de referencia guardada. Agrega también la grabación obligatoria de consentimiento."
      )
      await loadVoices()
    } catch (reason: any) {
      setError(reason?.message || "No se pudo subir el audio")
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  async function processVoice(profileId: string) {
    setProcessingVoiceId(profileId)
    setError("")
    setSuccess("Conectando con el motor de voz autorizado…")

    try {
      const response = await fetch("/api/agents/audio/voices/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "No se pudo preparar la voz")

      const token = await currentSupabaseToken(supabase)

      await streamAudioEngine("/v1/voice/prepare", token, { profile_id: profileId }, (type, event) => {
        const progress = typeof event.progress === "number" ? event.progress : 0
        const stage = typeof event.stage === "string" ? event.stage : "processing"
        const label = typeof event.label === "string" ? event.label : "Procesando voz"

        setSuccess(label)
        setVoices((current) => current.map((voice) => voice.id === profileId
          ? {
              ...voice,
              status: type === "complete" ? "ready" : "processing",
              processing_progress: progress,
              processing_stage: stage,
              processing_error: null,
            }
          : voice))
      })

      setSuccess("Voz lista. La muestra canónica está protegida y asociada al motor de voz configurado.")
      await loadVoices()
      return true
    } catch (reason: any) {
      setError(reason?.message || "No se pudo procesar la voz")
      await loadVoices()
      return false
    } finally {
      setProcessingVoiceId("")
    }
  }

  async function previewVoice(profileId: string) {
    const previewText = "Hola. Esta es una prueba de mi voz autorizada en EduAI."
    setPlayingVoiceId(profileId)
    setVoiceRenderProgress(3)
    setVoiceRenderLabel("Autorizando uso de la voz")
    setError("")

    try {
      const authorization = await fetch("/api/agents/audio/voices/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, text: previewText }),
      })
      const authorizationData = await authorization.json().catch(() => ({}))
      if (!authorization.ok) {
        throw new Error(authorizationData.error || "No se pudo autorizar la prueba de voz")
      }

      const token = await currentSupabaseToken(supabase)

      const completed = await streamAudioEngine(
        "/v1/voice/render",
        token,
        { profile_id: profileId, text: previewText },
        (_type, event) => {
          if (typeof event.progress === "number") setVoiceRenderProgress(event.progress)
          if (typeof event.label === "string") setVoiceRenderLabel(event.label)
        },
      )

      const bucket = typeof completed.bucket === "string" ? completed.bucket : "generated-voice-audio"
      const audioPath = typeof completed.audio_path === "string" ? completed.audio_path : ""
      if (!audioPath) throw new Error("Google Cloud terminó sin devolver el audio generado")

      const { data: signed, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(audioPath, 10 * 60)

      if (signedError || !signed?.signedUrl) {
        throw new Error(signedError?.message || "No se pudo abrir la prueba de voz")
      }

      setVoiceRenderProgress(100)
      setVoiceRenderLabel("Audio listo")

      const audio = new Audio(signed.signedUrl)
      audio.onended = () => {
        setPlayingVoiceId("")
        setVoiceRenderProgress(0)
        setVoiceRenderLabel("")
      }
      audio.onerror = () => {
        setPlayingVoiceId("")
        setVoiceRenderProgress(0)
        setVoiceRenderLabel("")
        setError("No se pudo reproducir la voz generada")
      }
      await audio.play()
    } catch (reason: any) {
      setPlayingVoiceId("")
      setVoiceRenderProgress(0)
      setVoiceRenderLabel("")
      setError(reason?.message || "No se pudo probar la voz")
    }
  }

  async function deleteVoice(profileId: string) {
    if (!window.confirm("¿Eliminar esta voz, sus muestras privadas y los adaptadores asociados?")) return
    setError("")

    try {
      const profile = voices.find((voice) => voice.id === profileId)
      if (profile?.provider_voice_id) {
        const token = await currentSupabaseToken(supabase)
        await callAudioEngine("/v1/voice/delete", token, { profile_id: profileId })
      }

      const response = await fetch("/api/agents/audio/voices/profiles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar la voz")

      setSuccess("Perfil vocal, muestras privadas y adaptadores eliminados.")
      await loadVoices()
    } catch (reason: any) {
      setError(reason?.message || "No se pudo eliminar la voz")
    }
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
              <p className="text-muted2 text-xs">Exclusivo para administradores mayores de 18 años · clonación privada con consentimiento, sin Hugging Face como servicio.</p>
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
            <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-600" /><div><p className="font-semibold text-sm">Zona protegida activa · administrador adulto</p><p className="text-muted2 text-xs">Permanecerá activa hasta cerrar sesión o bloquearla manualmente.</p></div></section>
            <section className={`rounded-2xl border px-4 py-3 text-sm ${engineStatus?.ok ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-700" : "border-amber-500/25 bg-amber-500/5 text-amber-700"}`}>
              <p className="font-semibold">Motor de voz: {engineStatus?.provider || "consultando proveedor"}</p>
              <p className="mt-1 text-xs">{engineStatus ? engineStatus.message : "Comprobando disponibilidad del motor privado..."}</p>
              <button type="button" onClick={async () => {
                setEngineStatus(null)
                try {
                  const response = await fetch("/api/agents/audio/voices/engine", { cache: "no-store" })
                  const data = await response.json().catch(() => ({}))
                  setEngineStatus({ ok: response.ok && data.ok === true, message: String(data.message || "Motor no disponible"), provider: String(data.provider || "Motor de voz") })
                } catch { setEngineStatus({ ok: false, message: "Motor no disponible", provider: "Motor de voz" }) }
              }} className="mt-2 text-xs font-semibold underline">Volver a comprobar motor</button>
            </section>
            <section className="rounded-3xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
              <div>
                <h2 className="font-semibold text-sm flex items-center gap-2"><ExternalLink size={15} className="text-purple-600" /> Kaggle GPU · clonación gratuita bajo demanda</h2>
                <p className="text-xs text-muted2 mt-1">Abre tu notebook privado, activa GPU T4 x2 e Internet y ejecútalo solo cuando lo necesites. Kaggle no es un servidor permanente y consume su cuota gratuita.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={kaggleNotebookUrl || KAGGLE_START_URL} target="_blank" rel="noopener noreferrer"
                  className="rounded-xl bg-purple-600 text-white px-4 py-2 text-xs font-semibold flex gap-2 items-center">
                  <ExternalLink size={13} /> {kaggleNotebookUrl ? "Abrir mi notebook de Kaggle" : "Crear notebook en Kaggle"}
                </a>
                <a href={KAGGLE_GUIDE_URL} target="_blank" rel="noopener noreferrer"
                  className="rounded-xl border border-purple-500/25 px-3 py-2 text-xs flex gap-2 items-center">
                  <Download size={13} /> Notebook EDUAI para importar
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                <input aria-label="Enlace de tu notebook privado de Kaggle" value={kaggleUrlInput}
                  onChange={(event) => setKaggleUrlInput(event.target.value)}
                  placeholder="https://www.kaggle.com/code/usuario/mi-notebook"
                  className="min-w-0 flex-1 rounded-xl border border-soft bg-app px-3 py-2 text-xs" />
                <button type="button" onClick={saveKaggleUrl} className="rounded-xl border border-purple-500/25 px-3 py-2 text-xs font-semibold">Guardar enlace</button>
              </div>
              <p className="text-[11px] text-muted2">La primera vez, importa el archivo de GitHub con File → Load from URL. Guarda el notebook como privado y pega aquí su dirección. El botón abrirá ese mismo notebook en sesiones futuras.</p>
              <p className="text-[11px] text-amber-700">Al cargar tu muestra en Kaggle, un proveedor externo procesará temporalmente tu voz. No publiques el notebook ni sus archivos. No introduzcas claves de EDUAI o Supabase.</p>
              {kaggleAudios.length > 0 && <div className="rounded-xl border border-purple-500/15 p-3 space-y-2">
                <h3 className="font-semibold text-xs">Audios importados de Kaggle · biblioteca privada</h3>
                {kaggleAudios.slice(0, 8).map((audio) => (
                  <div key={audio.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted2 min-w-32">{voices.find((v) => v.id === audio.profile_id)?.display_name || "Voz"} · {new Date(audio.created_at).toLocaleDateString("es-CL")}</span>
                    <audio controls preload="none" src={audio.audio_url} className="max-w-full h-8 flex-1" />
                    <a href={audio.audio_url} target="_blank" rel="noopener noreferrer" className="underline text-purple-700">Abrir WAV</a>
                  </div>
                ))}
              </div>}
            </section>
            <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-4">
              <h2 className="font-bold flex items-center gap-2"><Plus size={16} /> Agregar perfil vocal</h2>
              <div className="grid sm:grid-cols-2 gap-3"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nombre visible de la voz" className="rounded-xl border border-soft bg-transparent px-3 py-2 text-sm" /><select value={sourceKind} onChange={(event) => setSourceKind(event.target.value as "self" | "authorized_third_party")} className="rounded-xl border border-soft bg-app px-3 py-2 text-sm"><option value="self">Es mi propia voz</option><option value="authorized_third_party">Voz de tercero autorizado</option></select></div>
              <label className="flex gap-2 text-sm text-sub"><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} /> Confirmo que soy mayor de edad.</label>
              <label className="flex gap-2 text-sm text-sub"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} /> Autorizo el procesamiento y almacenamiento privado de esta muestra vocal.</label>
              {sourceKind === "authorized_third_party" && <label className="flex gap-2 text-sm text-sub"><input type="checkbox" checked={authorizationConfirmed} onChange={(event) => setAuthorizationConfirmed(event.target.checked)} /> Confirmo que poseo autorización expresa de la persona titular.</label>}
              <button onClick={createVoiceProfile} disabled={creatingVoice} className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2 w-fit">{creatingVoice ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear perfil</button>
            </section>
            <section className="rounded-3xl border border-soft p-5 bg-card-soft-theme space-y-3">
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 text-sm text-sub">
                <p className="font-semibold text-main">Grabación obligatoria de consentimiento</p>
                <p className="mt-1">La misma persona de la muestra debe leer exactamente:</p>
                <p className="mt-2 rounded-xl border border-purple-500/20 bg-app px-3 py-2 font-medium text-main">“Soy el propietario de esta voz y doy mi consentimiento para que Google la utilice para crear un modelo de voz sintética.”</p>
                <p className="mt-2 text-xs text-muted2">La referencia debe contener entre 10 y 30 segundos de habla natural limpia. Google recomienda WAV mono PCM de 16 bits a 24 kHz.</p>
              </div>
              <div className="flex items-center justify-between"><div><h2 className="font-bold">Biblioteca privada</h2><p className="text-muted2 text-sm">Guardamos la muestra canónica para que futuros motores creen su propio adaptador sin volver a pedirte la voz.</p></div><button onClick={loadVoices} className="rounded-xl border border-soft p-2"><RefreshCw size={14} /></button></div>
              {voices.length === 0 ? <p className="text-sm text-muted2">Todavía no existen perfiles vocales.</p> : voices.map((voice) => (
                <article key={voice.id} className="rounded-2xl border border-soft p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-2"><Volume2 size={14} className="text-purple-500" /> {voice.display_name}</p>
                    <p className="text-xs text-muted2 mt-1">
                      {voice.source_kind === "self" ? "Voz propia" : "Tercero autorizado"} · Estado: {voice.status} · {voice.sample_path ? "referencia lista" : "sin referencia"} · {voice.consent_audio_path ? "consentimiento grabado" : "sin consentimiento de voz"}
                      {voice.model_provider ? ` · ${voice.model_provider}` : ""}
                    </p>
                    {!voice.consent_audio_path && voice.sample_path && (
                      <p className="mt-1 max-w-xl text-xs text-amber-700">Falta grabar y subir el consentimiento vocal. La muestra anterior se conserva y no necesitas crear otro perfil.</p>
                    )}
                    {voice.processing_error && (/OpenVoice|hf\.co|Hugging Face|Voice replication requires Paid Quota Tier 1|Gemini Voice Replication respondió 403/i.test(voice.processing_error)
                      ? <p className="mt-1 max-w-xl text-xs text-amber-700">Intento anterior no completado: el proveedor rechazó la clonación. Se conservan la muestra y el consentimiento. Chatterbox está pendiente de cuota GPU; no vuelvas a intentar hasta que aparezca disponible.</p>
                      : <p className="mt-1 max-w-xl text-xs text-red-500">{voice.processing_error}</p>)}
                    {(voice.status === "processing" || processingVoiceId === voice.id) && (
                      <div className="mt-3 max-w-xl">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-purple-700">
                          <span>{voice.processing_stage ? voice.processing_stage.replaceAll("_", " ") : "Conectando con Google Voice Replication"}</span>
                          <span>{Math.max(0, Math.min(100, Math.round(voice.processing_progress || 5)))}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-purple-500/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-[width] duration-500" style={{ width: `${Math.max(3, Math.min(100, voice.processing_progress || 5))}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setActiveUploadProfileId(voice.id)
                        setActiveUploadKind("reference")
                        sampleInputRef.current?.click()
                      }}
                      disabled={processingVoiceId === voice.id}
                      className="rounded-xl border border-soft px-3 py-2 text-xs flex items-center gap-2 disabled:opacity-50"
                    >
                      <Upload size={13} /> {voice.sample_path ? "Reemplazar referencia" : "Subir referencia"}
                    </button>
                    <button
                      onClick={() => {
                        setActiveUploadProfileId(voice.id)
                        setActiveUploadKind("consent")
                        consentInputRef.current?.click()
                      }}
                      disabled={processingVoiceId === voice.id}
                      className="rounded-xl border border-soft px-3 py-2 text-xs flex items-center gap-2 disabled:opacity-50"
                    >
                      <ShieldCheck size={13} /> {voice.consent_audio_path ? "Reemplazar consentimiento" : "Subir consentimiento"}
                    </button>
                    {voice.sample_path && voice.consent_audio_path && voice.status !== "ready" && (
                      <button onClick={() => processVoice(voice.id)} disabled={processingVoiceId === voice.id || engineStatus?.ok !== true} className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-700 flex items-center gap-2 disabled:opacity-50">
                        {processingVoiceId === voice.id ? <Loader2 size={13} className="animate-spin" /> : <Mic2 size={13} />}
                        {processingVoiceId === voice.id ? "Preparando voz…" : "Replicar voz"}
                      </button>
                    )}
                    {voice.status === "ready" && (
                      <div className="flex flex-col gap-1">
                        <button onClick={() => previewVoice(voice.id)} disabled={playingVoiceId === voice.id} className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 flex items-center gap-2 disabled:opacity-50">
                          {playingVoiceId === voice.id ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                          {playingVoiceId === voice.id ? `${voiceRenderLabel || "Generando"} · ${Math.round(voiceRenderProgress)}%` : "Probar clon"}
                        </button>
                      </div>
                    )}
                    {voice.sample_path && voice.consent_audio_path && (
                      <button type="button" onClick={() => { setKaggleProfileId(voice.id); kaggleInputRef.current?.click() }}
                        disabled={kaggleUploading} className="rounded-xl border border-purple-500/25 px-3 py-2 text-xs text-purple-700 flex gap-2 items-center disabled:opacity-50">
                        <Upload size={13} /> {kaggleUploading && kaggleProfileId === voice.id ? "Importando…" : "Importar WAV de Kaggle"}
                      </button>
                    )}
                    <button onClick={() => deleteVoice(voice.id)} className="rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-500 flex items-center gap-2"><Trash2 size={13} /> Eliminar</button>
                  </div>
                </article>
              ))}
            </section>
          </>}
      </section>

      <input ref={sampleInputRef} type="file" accept=".mp3,.wav,.m4a,.webm,.ogg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadSample(file, "reference"); event.target.value = "" }} />
      <input ref={consentInputRef} type="file" accept=".mp3,.wav,.m4a,.webm,.ogg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadSample(file, "consent"); event.target.value = "" }} />
      <input ref={kaggleInputRef} type="file" accept=".wav,audio/wav" className="hidden"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void importKaggleWav(file); event.target.value = "" }} />
      {uploading && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center"><div className="rounded-2xl bg-app border border-soft p-5 space-y-3 w-72"><div className="flex items-center gap-3"><Loader2 className="animate-spin text-purple-500" /><span className="text-sm">Subiendo {activeUploadKind === "consent" ? "consentimiento" : "referencia"} privada… {uploadProgress}%</span></div><div className="h-2 rounded-full overflow-hidden bg-black/10"><div className="h-full bg-purple-500 transition-all" style={{ width: `${uploadProgress}%` }} /></div></div></div>}
    </main>
  )
}
