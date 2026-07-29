"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Disc3,
  Download,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Mic2,
  Music2,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react"

type InputMode = "prompt" | "lyrics"

type VoiceProfile = {
  id: string
  display_name: string
  status: string
  sample_path: string | null
  internal_use_enabled: boolean
  source_kind: "self" | "authorized_third_party"
}

type SongJob = {
  id: string
  title: string
  prompt: string
  caption: string
  lyrics: string
  genre: string
  mood: string
  vocal_language: string
  duration_seconds: number
  bpm: number | null
  key_scale: string
  time_signature: string
  instrumental: boolean
  vocal_style: string
  voice_profile_id: string | null
  status: "queued" | "composing" | "generating" | "uploading" | "completed" | "failed"
  progress: number
  provider: string
  audio_url: string | null
  metadata: Record<string, unknown> | null
  error: string | null
  created_at: string
  completed_at: string | null
}

const GENRES = [
  "Pop educativo",
  "Rock suave",
  "Hip hop",
  "Balada",
  "Electrónica",
  "Acústica",
  "Reggaetón suave",
  "Cumbia",
  "Folclore latino",
  "Cinemática",
]

const MOODS = [
  "Motivadora",
  "Alegre",
  "Emotiva",
  "Épica",
  "Relajada",
  "Divertida",
  "Reflexiva",
  "Energética",
]

const VOCAL_STYLES = [
  { id: "automatic", label: "Voz automática", detail: "El motor escoge la voz más adecuada" },
  { id: "female_warm", label: "Femenina cálida", detail: "Expresiva y clara" },
  { id: "female_bright", label: "Femenina brillante", detail: "Joven y enérgica" },
  { id: "male_warm", label: "Masculina cálida", detail: "Natural y expresiva" },
  { id: "male_deep", label: "Masculina grave", detail: "Profunda y resonante" },
  { id: "youthful", label: "Voz juvenil", detail: "Amable y educativa" },
  { id: "choir", label: "Coro mixto", detail: "Armonías masculinas y femeninas" },
]

const LANGUAGES = [
  { id: "es", label: "Español" },
  { id: "en", label: "Inglés" },
  { id: "pt", label: "Portugués" },
  { id: "fr", label: "Francés" },
  { id: "it", label: "Italiano" },
]

const DURATION_OPTIONS = [20, 30, 45, 60, 90, 120]

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return ""
  }
}

function statusLabel(status: SongJob["status"]) {
  if (status === "queued") return "En cola"
  if (status === "composing") return "Componiendo letra"
  if (status === "generating") return "Generando música y canto"
  if (status === "uploading") return "Guardando canción"
  if (status === "completed") return "Completada"
  return "Error"
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted2">{children}</span>
}

export default function AudioSongStudioPage() {
  const [inputMode, setInputMode] = useState<InputMode>("prompt")
  const [prompt, setPrompt] = useState("")
  const [lyrics, setLyrics] = useState("")
  const [genre, setGenre] = useState("Pop educativo")
  const [customGenre, setCustomGenre] = useState("")
  const [mood, setMood] = useState("Motivadora")
  const [language, setLanguage] = useState("es")
  const [duration, setDuration] = useState(45)
  const [bpm, setBpm] = useState("")
  const [keyScale, setKeyScale] = useState("")
  const [timeSignature, setTimeSignature] = useState("4")
  const [instrumental, setInstrumental] = useState(false)
  const [vocalStyle, setVocalStyle] = useState("automatic")
  const [voiceProfileId, setVoiceProfileId] = useState("")
  const [voiceConsent, setVoiceConsent] = useState(false)
  const [seed, setSeed] = useState("")

  const [jobs, setJobs] = useState<SongJob[]>([])
  const [activeJob, setActiveJob] = useState<SongJob | null>(null)
  const [voices, setVoices] = useState<VoiceProfile[]>([])
  const [voiceAreaLocked, setVoiceAreaLocked] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [stage, setStage] = useState(0)
  const [error, setError] = useState("")
  const [systemNotice, setSystemNotice] = useState("")

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === voiceProfileId) || null,
    [voices, voiceProfileId]
  )

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true)
    try {
      const response = await fetch("/api/agents/audio/songs", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSystemNotice(data.error || "No se pudo cargar el historial")
        setJobs([])
        return
      }
      const nextJobs = Array.isArray(data.jobs) ? data.jobs : []
      setJobs(nextJobs)
      setSystemNotice("")
      setActiveJob((current) => {
        if (!current) return nextJobs.find((job: SongJob) => job.status === "completed") || nextJobs[0] || null
        return nextJobs.find((job: SongJob) => job.id === current.id) || current
      })
    } catch {
      setSystemNotice("No se pudo conectar con el historial de canciones")
    } finally {
      setLoadingJobs(false)
    }
  }, [])

  const loadVoices = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/audio/voices/profiles", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        setVoiceAreaLocked(true)
        setVoices([])
        return
      }
      if (!response.ok) return
      const readyVoices = (Array.isArray(data.profiles) ? data.profiles : []).filter(
        (voice: VoiceProfile) => voice.status === "ready" && voice.sample_path && voice.internal_use_enabled
      )
      setVoices(readyVoices)
      setVoiceAreaLocked(false)
    } catch {
      setVoices([])
    }
  }, [])

  useEffect(() => {
    void loadJobs()
    void loadVoices()
  }, [loadJobs, loadVoices])

  useEffect(() => {
    if (!generating) return
    const timer = window.setInterval(() => setStage((value) => Math.min(value + 1, 4)), 15_000)
    return () => window.clearInterval(timer)
  }, [generating])

  async function generateSong() {
    if (!prompt.trim() && !lyrics.trim()) {
      setError("Escribe una idea o una letra para comenzar.")
      return
    }
    if (inputMode === "lyrics" && !instrumental && !lyrics.trim()) {
      setError("Pega la letra que quieres convertir en canción.")
      return
    }
    if (voiceProfileId && !voiceConsent) {
      setError("Confirma la autorización específica para usar esa voz en una interpretación cantada.")
      return
    }

    setGenerating(true)
    setStage(0)
    setError("")

    try {
      const response = await fetch("/api/agents/audio/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMode,
          prompt,
          lyrics,
          genre: customGenre.trim() || genre,
          mood,
          vocalLanguage: language,
          duration,
          bpm: bpm.trim() ? Number(bpm) : null,
          keyScale,
          timeSignature,
          instrumental,
          vocalStyle,
          voiceProfileId: voiceProfileId || null,
          voiceConsentConfirmed: voiceConsent,
          seed: seed.trim() ? Number(seed) : -1,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo generar la canción")

      const job = data.job as SongJob
      setActiveJob(job)
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)])
      setSystemNotice("")
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "No se pudo generar la canción")
      await loadJobs()
    } finally {
      setGenerating(false)
      setStage(0)
    }
  }

  async function deleteJob(job: SongJob) {
    if (!window.confirm(`¿Eliminar “${job.title}” y su archivo de audio?`)) return
    const response = await fetch(`/api/agents/audio/songs?id=${encodeURIComponent(job.id)}`, { method: "DELETE" })
    if (!response.ok) return
    setJobs((current) => current.filter((item) => item.id !== job.id))
    setActiveJob((current) => current?.id === job.id ? null : current)
  }

  const generationStages = [
    "Preparando la idea musical",
    "Componiendo y organizando la letra",
    "Generando instrumentos y melodía",
    "Interpretando la voz cantada",
    "Mezclando y guardando en Supabase",
  ]

  return (
    <main className="min-h-screen bg-app text-main">
      <header className="border-b border-soft bg-app/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/audio-lab" className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft bg-card-soft-theme text-sub transition hover:text-main">
              <ArrowLeft size={16} />
            </Link>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-cyan-400 text-white shadow-lg shadow-purple-500/20">
              <Music2 size={21} />
            </div>
            <div>
              <h1 className="text-lg font-black leading-tight">Estudio de canciones IA</h1>
              <p className="text-xs text-muted2">Idea o letra → composición → música → voz cantada</p>
            </div>
          </div>
          <button onClick={() => void loadJobs()} disabled={loadingJobs} className="inline-flex items-center gap-2 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs font-semibold text-sub transition hover:text-main disabled:opacity-50">
            <RefreshCw size={14} className={loadingJobs ? "animate-spin" : ""} />
            Actualizar historial
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="overflow-hidden rounded-3xl border border-purple-400/20 bg-card shadow-xl shadow-purple-500/5">
          <div className="border-b border-soft bg-gradient-to-r from-purple-500/10 via-fuchsia-500/5 to-cyan-500/10 px-5 py-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-purple-600">
              <Sparkles size={14} /> Compositor EduAI
            </p>
            <h2 className="mt-1 text-xl font-black">Crea una canción completa</h2>
            <p className="mt-1 text-sm text-muted2">Groq prepara la letra y ACE-Step 1.5 genera melodía, instrumentos y canto.</p>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-soft bg-card-soft-theme p-1.5">
              <button onClick={() => setInputMode("prompt")} className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${inputMode === "prompt" ? "bg-purple-600 text-white shadow" : "text-sub hover:text-main"}`}>
                <Wand2 size={15} className="mr-2 inline" />Crear desde una idea
              </button>
              <button onClick={() => setInputMode("lyrics")} className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${inputMode === "lyrics" ? "bg-purple-600 text-white shadow" : "text-sub hover:text-main"}`}>
                <BookOpen size={15} className="mr-2 inline" />Usar mi letra
              </button>
            </div>

            <label className="block space-y-2">
              <FieldLabel>{inputMode === "prompt" ? "Idea de la canción" : "Instrucción para la letra"}</FieldLabel>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={inputMode === "prompt" ? 5 : 3}
                placeholder={inputMode === "prompt"
                  ? "Ej: Crea una canción motivadora para aprender la ley de conservación de la materia, con un coro fácil de recordar para estudiantes de 1° medio."
                  : "Ej: Mejora la métrica, conserva el mensaje educativo y crea un coro pegadizo."}
                className="w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm text-main outline-none transition focus:border-purple-500/50"
              />
            </label>

            {inputMode === "lyrics" && !instrumental && (
              <label className="block space-y-2">
                <FieldLabel>Letra</FieldLabel>
                <textarea
                  value={lyrics}
                  onChange={(event) => setLyrics(event.target.value)}
                  rows={10}
                  placeholder="Pega aquí tu letra. Puedes incluir [Verso], [Coro], [Puente] o dejar que la IA la organice."
                  className="w-full resize-y rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 font-mono text-sm text-main outline-none transition focus:border-purple-500/50"
                />
              </label>
            )}

            <div className="space-y-2">
              <FieldLabel>Género musical</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((item) => (
                  <button key={item} onClick={() => { setGenre(item); setCustomGenre("") }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${genre === item && !customGenre ? "border-purple-500/40 bg-purple-500/12 text-purple-700" : "border-soft bg-card-soft-theme text-sub"}`}>
                    {item}
                  </button>
                ))}
              </div>
              <input value={customGenre} onChange={(event) => setCustomGenre(event.target.value)} placeholder="Otro género o combinación, por ejemplo: pop andino electrónico" className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm outline-none focus:border-purple-500/50" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <FieldLabel>Emoción</FieldLabel>
                <select value={mood} onChange={(event) => setMood(event.target.value)} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm outline-none">
                  {MOODS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <FieldLabel>Idioma de canto</FieldLabel>
                <select value={language} onChange={(event) => setLanguage(event.target.value)} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-sm outline-none">
                  {LANGUAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
              <div className="mb-3 flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-cyan-600" />
                <p className="text-sm font-bold">Configuración musical</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-2">
                  <FieldLabel>Duración</FieldLabel>
                  <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm">
                    {DURATION_OPTIONS.map((item) => <option key={item} value={item}>{item} segundos</option>)}
                  </select>
                </label>
                <label className="space-y-2">
                  <FieldLabel>BPM</FieldLabel>
                  <input type="number" min={30} max={300} value={bpm} onChange={(event) => setBpm(event.target.value)} placeholder="Automático" className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm" />
                </label>
                <label className="space-y-2">
                  <FieldLabel>Tonalidad</FieldLabel>
                  <input value={keyScale} onChange={(event) => setKeyScale(event.target.value)} placeholder="Ej: C Major" className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm" />
                </label>
                <label className="space-y-2">
                  <FieldLabel>Compás</FieldLabel>
                  <select value={timeSignature} onChange={(event) => setTimeSignature(event.target.value)} className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm">
                    <option value="4">4/4</option>
                    <option value="3">3/4</option>
                    <option value="6">6/8</option>
                    <option value="2">2/4</option>
                  </select>
                </label>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-soft bg-card-soft-theme p-4">
              <div>
                <p className="text-sm font-bold">Canción instrumental</p>
                <p className="text-xs text-muted2">Genera música sin letra ni voz.</p>
              </div>
              <input type="checkbox" checked={instrumental} onChange={(event) => { setInstrumental(event.target.checked); if (event.target.checked) setVoiceProfileId("") }} className="h-5 w-5 accent-purple-600" />
            </label>

            {!instrumental && (
              <div className="space-y-4 rounded-2xl border border-purple-400/20 bg-purple-500/5 p-4">
                <div className="flex items-start gap-3">
                  <Mic2 size={18} className="mt-0.5 text-purple-600" />
                  <div>
                    <p className="text-sm font-bold">Voz cantada</p>
                    <p className="text-xs text-muted2">Las voces Edge TTS de narración no se usan aquí: el motor musical necesita voces preparadas para canto.</p>
                  </div>
                </div>

                <label className="block space-y-2">
                  <FieldLabel>Estilo vocal generado</FieldLabel>
                  <select value={vocalStyle} onChange={(event) => setVocalStyle(event.target.value)} className="w-full rounded-xl border border-soft bg-card px-3 py-2.5 text-sm">
                    {VOCAL_STYLES.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.detail}</option>)}
                  </select>
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>Mi voz autorizada, opcional</FieldLabel>
                    <button onClick={() => void loadVoices()} className="text-xs font-semibold text-purple-600">Actualizar</button>
                  </div>

                  {voiceAreaLocked ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs text-amber-700">
                      <p className="flex items-center gap-2 font-bold"><LockKeyhole size={14} /> La biblioteca privada está bloqueada</p>
                      <p className="mt-1">Desbloquea Mis voces con tu segundo factor y vuelve a esta página.</p>
                      <Link href="/audio-lab/voices" className="mt-2 inline-flex items-center gap-1 font-bold underline">Abrir Mis voces <ExternalLink size={12} /></Link>
                    </div>
                  ) : (
                    <select value={voiceProfileId} onChange={(event) => { setVoiceProfileId(event.target.value); setVoiceConsent(false) }} className="w-full rounded-xl border border-soft bg-card px-3 py-2.5 text-sm">
                      <option value="">No usar una voz privada</option>
                      {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.display_name} · {voice.source_kind === "self" ? "Mi voz" : "Tercero autorizado"}</option>)}
                    </select>
                  )}

                  {selectedVoice && (
                    <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/8 p-3">
                      <p className="flex items-center gap-2 text-xs font-bold text-cyan-800"><ShieldCheck size={14} /> Referencia vocal experimental</p>
                      <p className="mt-1 text-xs text-sub">ACE-Step intentará aproximar el timbre de “{selectedVoice.display_name}”. No garantiza una copia exacta de la identidad vocal.</p>
                      <label className="mt-3 flex items-start gap-2 text-xs text-sub">
                        <input type="checkbox" checked={voiceConsent} onChange={(event) => setVoiceConsent(event.target.checked)} className="mt-0.5 accent-purple-600" />
                        <span>Autorizo expresamente usar esta muestra para crear una interpretación cantada con IA y confirmo que tengo derecho a utilizarla.</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            <details className="rounded-2xl border border-soft bg-card-soft-theme p-4">
              <summary className="cursor-pointer text-sm font-bold">Opciones avanzadas</summary>
              <label className="mt-3 block space-y-2">
                <FieldLabel>Semilla reproducible</FieldLabel>
                <input type="number" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Aleatoria" className="w-full rounded-xl border border-soft bg-transparent px-3 py-2.5 text-sm" />
              </label>
            </details>

            {error && <div className="flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/8 p-3 text-sm text-red-600"><CircleAlert size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
            {systemNotice && <div className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3 text-sm text-amber-700"><CircleAlert size={17} className="mt-0.5 shrink-0" /><span>{systemNotice}</span></div>}

            <button onClick={() => void generateSong()} disabled={generating} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-cyan-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-purple-500/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? generationStages[stage] : "Crear canción con IA"}
            </button>

            {generating && (
              <div className="rounded-2xl border border-purple-400/20 bg-purple-500/5 p-4">
                <div className="flex items-center justify-between text-xs font-semibold"><span>{generationStages[stage]}</span><span>Puede tardar varios minutos</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-purple-500/10"><div className="h-full animate-pulse rounded-full bg-gradient-to-r from-purple-500 to-cyan-400" style={{ width: `${Math.min(18 + stage * 18, 90)}%` }} /></div>
                <p className="mt-2 text-xs text-muted2">Puedes mantener esta pestaña abierta mientras el motor GPU termina la mezcla.</p>
              </div>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-card shadow-xl shadow-cyan-500/5">
            <div className="border-b border-soft bg-gradient-to-r from-cyan-500/10 to-purple-500/10 px-5 py-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700"><Disc3 size={14} /> Resultado</p>
              <h2 className="mt-1 text-lg font-black">Canción generada</h2>
            </div>

            {!activeJob ? (
              <div className="flex min-h-[330px] flex-col items-center justify-center px-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500/15 to-cyan-500/15 text-purple-600"><Music2 size={30} /></div>
                <p className="mt-4 font-bold">Aquí aparecerá tu canción</p>
                <p className="mt-1 max-w-sm text-sm text-muted2">Crea una canción educativa, una canción para un proyecto o una pista instrumental.</p>
              </div>
            ) : (
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{activeJob.title}</p>
                    <p className="mt-1 text-xs text-muted2">{formatDate(activeJob.created_at)} · {activeJob.duration_seconds}s · {activeJob.provider}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${activeJob.status === "completed" ? "bg-emerald-500/10 text-emerald-700" : activeJob.status === "failed" ? "bg-red-500/10 text-red-600" : "bg-purple-500/10 text-purple-700"}`}>
                    {statusLabel(activeJob.status)}
                  </span>
                </div>

                {activeJob.status === "completed" && activeJob.audio_url ? (
                  <>
                    <audio key={activeJob.audio_url} controls preload="metadata" className="w-full" src={activeJob.audio_url} />
                    <a href={activeJob.audio_url} download className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/8 px-4 py-2.5 text-sm font-bold text-cyan-800"><Download size={15} /> Descargar canción</a>
                  </>
                ) : activeJob.status === "failed" ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-3 text-sm text-red-600">{activeJob.error || "La generación no pudo completarse."}</div>
                ) : (
                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/8 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-purple-700"><Loader2 size={16} className="animate-spin" /> {statusLabel(activeJob.status)}</div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-purple-500/10"><div className="h-full rounded-full bg-purple-500" style={{ width: `${activeJob.progress}%` }} /></div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-soft bg-card-soft-theme p-3"><span className="text-muted2">Género</span><p className="mt-1 font-bold">{activeJob.genre || "Automático"}</p></div>
                  <div className="rounded-xl border border-soft bg-card-soft-theme p-3"><span className="text-muted2">Emoción</span><p className="mt-1 font-bold">{activeJob.mood || "Automática"}</p></div>
                  <div className="rounded-xl border border-soft bg-card-soft-theme p-3"><span className="text-muted2">BPM</span><p className="mt-1 font-bold">{activeJob.bpm || "Automático"}</p></div>
                  <div className="rounded-xl border border-soft bg-card-soft-theme p-3"><span className="text-muted2">Tonalidad</span><p className="mt-1 font-bold">{activeJob.key_scale || "Automática"}</p></div>
                </div>

                {activeJob.caption && <details className="rounded-xl border border-soft bg-card-soft-theme p-3"><summary className="cursor-pointer text-sm font-bold">Descripción musical</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-sub">{activeJob.caption}</p></details>}
                {activeJob.lyrics && <details className="rounded-xl border border-soft bg-card-soft-theme p-3"><summary className="cursor-pointer text-sm font-bold">Letra creada</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-sub">{activeJob.lyrics}</pre></details>}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-soft bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-black"><Clock3 size={15} /> Mis canciones</p>
                <p className="mt-0.5 text-xs text-muted2">Guardadas en tu biblioteca privada de Supabase.</p>
              </div>
              <span className="rounded-full bg-card-soft-theme px-2.5 py-1 text-xs font-bold text-sub">{jobs.length}</span>
            </div>

            {loadingJobs ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-purple-500" /></div>
            ) : jobs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-soft p-5 text-center text-sm text-muted2">Todavía no hay canciones guardadas.</p>
            ) : (
              <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                {jobs.map((job) => (
                  <div key={job.id} className={`rounded-2xl border p-3 transition ${activeJob?.id === job.id ? "border-purple-500/35 bg-purple-500/7" : "border-soft bg-card-soft-theme"}`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => setActiveJob(job)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-bold">{job.title}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted2">
                          {job.status === "completed" ? <CheckCircle2 size={12} className="text-emerald-600" /> : job.status === "failed" ? <CircleAlert size={12} className="text-red-500" /> : <Loader2 size={12} className="animate-spin text-purple-500" />}
                          {statusLabel(job.status)} · {formatDate(job.created_at)}
                        </p>
                      </button>
                      <button onClick={() => void deleteJob(job)} title="Eliminar canción" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted2 transition hover:bg-red-500/10 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
