"use client"
// components/notebook/StudioPanel.tsx  v3
// Mejoras: 
// - Podcast: botón "Generar audio" que llama al agente podcast-wav
// - Infografía: botón "Generar imagen" cuando _hasImageSuggestion = true
// - Estado por formato (guardado del último output)

import { useState, useRef } from "react"
import { Loader2, ChevronRight, ArrowLeft, Volume2, Image, Play, Pause } from "lucide-react"
import { RENDERERS } from "@/components/creator-hub/renderers"

const FORMATS = [
  { id: "infographic",  icon: "📊", label: "Infografía",    color: "#3b82f6" },
  { id: "mindmap",      icon: "🧠", label: "Mapa Mental",   color: "#10b981" },
  { id: "quiz",         icon: "✅", label: "Quiz",          color: "#22c55e" },
  { id: "flashcards",   icon: "📇", label: "Flashcards",    color: "#06b6d4" },
  { id: "timeline",     icon: "⏳", label: "Timeline",      color: "#f97316" },
  { id: "podcast",      icon: "🎙️", label: "Podcast",       color: "#f59e0b" },
  { id: "presentation", icon: "📑", label: "Presentación",  color: "#8b5cf6" },
  { id: "cornell",      icon: "📓", label: "Notas Cornell", color: "#a78bfa" },
]

interface StudioPanelProps {
  notebookId: string
  hasContent: boolean
}

export default function StudioPanel({ notebookId, hasContent }: StudioPanelProps) {
  const [generating,    setGenerating]    = useState<string | null>(null)
  const [activeOutput,  setActiveOutput]  = useState<{ format: string; data: Record<string, unknown> } | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [topicHint,     setTopicHint]     = useState("")

  const generate = async (format: string) => {
    if (!hasContent) { setError("Procesa al menos una fuente para activar el Studio."); return }
    setGenerating(format); setError(null)
    try {
      const res  = await fetch(`/api/notebooks/${notebookId}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ format, topicHint: topicHint.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error generando")
      setActiveOutput({ format, data: data.output })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally { setGenerating(null) }
  }

  if (activeOutput) {
    return (
      <OutputView
        notebookId={notebookId}
        format={activeOutput.format}
        data={activeOutput.data}
        onBack={() => setActiveOutput(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-soft">
        <p className="text-main font-semibold text-sm mb-1">Studio</p>
        <p className="text-xs text-muted2">Genera materiales desde tus fuentes</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!hasContent && (
          <div className="mb-3 px-3 py-2 rounded-xl text-xs text-amber-400"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
            Procesa al menos una fuente para activar el Studio.
          </div>
        )}
        {error && (
          <div className="mb-3 px-3 py-2 rounded-xl text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
            {error}
          </div>
        )}

        <div className="mb-3">
          <input type="text" placeholder="Enfoque específico (opcional)..."
            value={topicHint} onChange={(e) => setTopicHint(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)", color: "var(--text-primary)" }} />
        </div>

        <div className="flex flex-col gap-2">
          {FORMATS.map((fmt) => (
            <button key={fmt.id}
              onClick={() => generate(fmt.id)}
              disabled={!!generating || !hasContent}
              className="flex items-center gap-3 p-3 rounded-xl border transition-all text-left disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)" }}
              onMouseEnter={(e) => {
                if (hasContent && !generating) {
                  e.currentTarget.style.background  = `${fmt.color}0c`
                  e.currentTarget.style.borderColor = `${fmt.color}30`
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background  = "var(--bg-card)"
                e.currentTarget.style.borderColor = "var(--border-soft)"
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${fmt.color}12`, border: `1px solid ${fmt.color}20` }}>
                {generating === fmt.id
                  ? <Loader2 size={14} className="animate-spin" style={{ color: fmt.color }} />
                  : fmt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-main">{fmt.label}</p>
                {generating === fmt.id && <p className="text-[10px] text-muted2">Generando...</p>}
              </div>
              <ChevronRight size={13} className="text-muted2 flex-shrink-0" />
            </button>
          ))}
        </div>

        <div className="mt-4 px-3 py-2.5 rounded-xl text-[10px] leading-relaxed"
          style={{ background: "rgba(37,99,235,0.04)", borderLeft: "2px solid rgba(37,99,235,0.3)", color: "var(--text-muted)" }}>
          Todo se genera desde las fuentes activas del cuaderno. Sin inventar información.
        </div>
      </div>
    </div>
  )
}

// ─── OutputView: muestra el output generado ───────────────────────────────────

function OutputView({ notebookId, format, data, onBack }: {
  notebookId: string
  format:     string
  data:       Record<string, unknown>
  onBack:     () => void
}) {
  const Renderer = (RENDERERS as Record<string, React.ComponentType<{ data: unknown }>>)[format]

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-soft flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted2 hover:text-main transition-colors">
          <ArrowLeft size={13} />
          Volver
        </button>
        <span className="text-xs font-semibold text-main flex-1 capitalize">{format}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Acciones especiales según formato */}
        {format === "podcast" && data._podcastWavSegments && (
          <PodcastPlayer
            segments={data._podcastWavSegments as Array<{ speaker: "A" | "B"; text: string }>}
          />
        )}

        {format === "infographic" && data._hasImageSuggestion && (
          <InfographicImageButton
            notebookId={notebookId}
            imagePrompt={data._imagePrompt as string}
          />
        )}

        {/* Renderer estándar */}
        {Renderer
          ? <Renderer data={data} />
          : (
            <pre className="text-xs rounded-xl p-3 overflow-auto"
              style={{ background: "var(--bg-card-soft)", color: "var(--text-primary)" }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          )
        }
      </div>
    </div>
  )
}

// ─── PodcastPlayer: genera audio con podcast-wav ──────────────────────────────

function PodcastPlayer({ segments }: { segments: Array<{ speaker: "A" | "B"; text: string }> }) {
  const [loading,   setLoading]   = useState(false)
  const [audioUrl,  setAudioUrl]  = useState<string | null>(null)
  const [playing,   setPlaying]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const generateAudio = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/agents/podcast-wav", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ segments }),
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      setAudioUrl(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error generando audio")
    } finally { setLoading(false) }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else         { audioRef.current.play();  setPlaying(true)  }
  }

  return (
    <div className="rounded-2xl p-4 border"
      style={{ background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.2)" }}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg">🎙️</span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-main">Podcast con audio</p>
          <p className="text-[10px] text-muted2">Álvaro y Elvira narran el contenido</p>
        </div>
      </div>

      {error && <p className="text-[10px] text-red-400 mb-2">{error}</p>}

      {!audioUrl ? (
        <button onClick={generateAudio} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "#f59e0b" }}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
          {loading ? "Generando audio (~20s)..." : "Generar audio"}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
          <button onClick={togglePlay}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-white"
            style={{ background: "#f59e0b" }}>
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? "Pausar" : "Reproducir podcast"}
          </button>
          <a href={audioUrl} download="notebook-podcast.mp3"
            className="text-[10px] text-center text-amber-500 hover:underline">
            Descargar MP3
          </a>
        </div>
      )}
    </div>
  )
}

// ─── InfographicImageButton ───────────────────────────────────────────────────

function InfographicImageButton({ notebookId: _n, imagePrompt }: {
  notebookId:  string
  imagePrompt: string
}) {
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generateImage = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/agents/imagenes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          prompt:   imagePrompt,
          style:    "infographic",
          size:     "landscape",
          provider: "auto",
        }),
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      const url  = data.imageUrl ?? data.url ?? data.image
      if (url) setImageUrl(url)
      else throw new Error("No se recibió imagen")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally { setLoading(false) }
  }

  return (
    <div className="rounded-2xl p-3 border"
      style={{ background: "rgba(59,130,246,0.04)", borderColor: "rgba(59,130,246,0.15)" }}>
      <p className="text-xs font-semibold text-main mb-2 flex items-center gap-1.5">
        <Image size={12} style={{ color: "var(--accent-blue)" }} />
        Imagen sugerida para la infografía
      </p>
      {error && <p className="text-[10px] text-red-400 mb-2">{error}</p>}
      {imageUrl ? (
        <img src={imageUrl} alt="Imagen infografía" className="w-full rounded-xl" style={{ maxHeight: 200, objectFit: "cover" }} />
      ) : (
        <button onClick={generateImage} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent-blue)" }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Image size={12} />}
          {loading ? "Generando imagen..." : "Agregar imagen a la infografía"}
        </button>
      )}
    </div>
  )
}
