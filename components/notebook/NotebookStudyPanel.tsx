"use client"

import { useEffect, useRef, useState } from "react"
import {
  BookOpenText,
  Check,
  Clipboard,
  Download,
  Headphones,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Save,
  Volume2,
} from "lucide-react"
import { CornellRenderer, PodcastRenderer } from "@/components/creator-hub/renderers"

type StudyTab = "notes" | "podcast"
type PodcastMode = "brief" | "deep" | "critique"

type GeneratedOutput = Record<string, unknown>

interface NotebookStudyPanelProps {
  notebookId: string
  hasContent: boolean
}

const PODCAST_MODES: Array<{ id: PodcastMode; label: string; description: string }> = [
  { id: "brief", label: "Breve", description: "Ideas centrales en pocos minutos" },
  { id: "deep", label: "Profundo", description: "Explicación detallada y conectada" },
  { id: "critique", label: "Crítico", description: "Fortalezas, límites y preguntas abiertas" },
]

function notesStorageKey(notebookId: string) {
  return `eduai-notebook-notes:${notebookId}`
}

export default function NotebookStudyPanel({ notebookId, hasContent }: NotebookStudyPanelProps) {
  const [tab, setTab] = useState<StudyTab>("notes")
  const [personalNotes, setPersonalNotes] = useState("")
  const [notesSaved, setNotesSaved] = useState(false)
  const [topicHint, setTopicHint] = useState("")
  const [podcastMode, setPodcastMode] = useState<PodcastMode>("deep")
  const [notesOutput, setNotesOutput] = useState<GeneratedOutput | null>(null)
  const [podcastOutput, setPodcastOutput] = useState<GeneratedOutput | null>(null)
  const [generating, setGenerating] = useState<"cornell" | "podcast" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      setPersonalNotes(localStorage.getItem(notesStorageKey(notebookId)) || "")
    } catch {
      setPersonalNotes("")
    }

    fetch(`/api/notebooks/${notebookId}/generate?formats=cornell,podcast`)
      .then((response) => response.json())
      .then((data) => {
        if (data?.outputs?.cornell) setNotesOutput(data.outputs.cornell)
        if (data?.outputs?.podcast) setPodcastOutput(data.outputs.podcast)
      })
      .catch(() => {})
  }, [notebookId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(notesStorageKey(notebookId), personalNotes)
        setNotesSaved(true)
        window.setTimeout(() => setNotesSaved(false), 1200)
      } catch {
        // El cuaderno sigue funcionando aunque el navegador bloquee almacenamiento local.
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [notebookId, personalNotes])

  const generate = async (format: "cornell" | "podcast") => {
    if (!hasContent) {
      setError("Activa y procesa al menos una fuente antes de generar contenido.")
      return
    }

    setGenerating(format)
    setError(null)
    try {
      const response = await fetch(`/api/notebooks/${notebookId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          topicHint: topicHint.trim() || undefined,
          podcastMode: format === "podcast" ? podcastMode : undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "No fue posible generar el contenido")
      if (format === "cornell") setNotesOutput(data.output)
      else setPodcastOutput(data.output)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible generar el contenido")
    } finally {
      setGenerating(null)
    }
  }

  const copyNotes = async () => {
    await navigator.clipboard.writeText(personalNotes)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const downloadNotes = () => {
    const blob = new Blob([personalNotes], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "notas-cuaderno-eduai.txt"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-soft p-4">
        <p className="text-sm font-semibold text-main">Estudio</p>
        <p className="mt-0.5 text-xs text-muted2">Notas personales y podcast desde tus fuentes</p>
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-soft p-2">
        <button
          type="button"
          onClick={() => setTab("notes")}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition ${
            tab === "notes" ? "bg-violet-500/12 text-violet-500" : "text-muted2 hover:bg-card-soft-theme"
          }`}
        >
          <BookOpenText size={14} /> Notas
        </button>
        <button
          type="button"
          onClick={() => setTab("podcast")}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition ${
            tab === "podcast" ? "bg-amber-500/12 text-amber-500" : "text-muted2 hover:bg-card-soft-theme"
          }`}
        >
          <Headphones size={14} /> Podcast
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-500">
            {error}
          </div>
        )}

        {tab === "notes" ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-soft bg-card-soft-theme p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-main">Mis notas</p>
                  <p className="text-[10px] text-muted2">Se guardan automáticamente en este navegador.</p>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                  {notesSaved ? <Check size={11} /> : <Save size={11} />}
                  {notesSaved ? "Guardado" : "Auto"}
                </span>
              </div>
              <textarea
                value={personalNotes}
                onChange={(event) => setPersonalNotes(event.target.value)}
                placeholder="Escribe ideas, dudas, citas, conclusiones o tareas pendientes..."
                rows={10}
                className="w-full resize-y rounded-xl border border-soft bg-input-theme px-3 py-2 text-xs leading-relaxed text-main outline-none focus:border-violet-400"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyNotes}
                  disabled={!personalNotes.trim()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-card-theme px-2 py-2 text-xs font-semibold text-sub disabled:opacity-40"
                >
                  {copied ? <Check size={13} /> : <Clipboard size={13} />} {copied ? "Copiado" : "Copiar"}
                </button>
                <button
                  type="button"
                  onClick={downloadNotes}
                  disabled={!personalNotes.trim()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-card-theme px-2 py-2 text-xs font-semibold text-sub disabled:opacity-40"
                >
                  <Download size={13} /> TXT
                </button>
              </div>
            </section>

            <section>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted2">
                Enfoque de las notas automáticas
              </label>
              <input
                value={topicHint}
                onChange={(event) => setTopicHint(event.target.value)}
                placeholder="Opcional: metodología, resultados, conceptos principales..."
                className="w-full rounded-xl border border-soft bg-input-theme px-3 py-2 text-xs text-main outline-none focus:border-violet-400"
              />
              <button
                type="button"
                onClick={() => generate("cornell")}
                disabled={generating !== null || !hasContent}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-45"
              >
                {generating === "cornell" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {notesOutput ? "Regenerar notas Cornell" : "Generar notas Cornell"}
              </button>
            </section>

            {notesOutput && (
              <section className="rounded-2xl border border-soft bg-card-theme p-3">
                <CornellRenderer data={notesOutput} />
              </section>
            )}
          </div>
        ) : (
          <PodcastSection
            hasContent={hasContent}
            topicHint={topicHint}
            setTopicHint={setTopicHint}
            mode={podcastMode}
            setMode={setPodcastMode}
            output={podcastOutput}
            generating={generating === "podcast"}
            onGenerate={() => generate("podcast")}
          />
        )}
      </div>
    </div>
  )
}

function PodcastSection({
  hasContent,
  topicHint,
  setTopicHint,
  mode,
  setMode,
  output,
  generating,
  onGenerate,
}: {
  hasContent: boolean
  topicHint: string
  setTopicHint: (value: string) => void
  mode: PodcastMode
  setMode: (value: PodcastMode) => void
  output: GeneratedOutput | null
  generating: boolean
  onGenerate: () => void
}) {
  return (
    <div className="space-y-4">
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted2">Formato</p>
        <div className="space-y-2">
          {PODCAST_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                mode === item.id
                  ? "border-amber-400/40 bg-amber-500/10"
                  : "border-soft bg-card-soft-theme hover:bg-input-theme"
              }`}
            >
              <p className="text-xs font-semibold text-main">{item.label}</p>
              <p className="text-[10px] text-muted2">{item.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted2">
          Enfoque del episodio
        </label>
        <textarea
          value={topicHint}
          onChange={(event) => setTopicHint(event.target.value)}
          placeholder="Opcional: compara autores, explica resultados, revisa limitaciones..."
          rows={3}
          className="w-full resize-none rounded-xl border border-soft bg-input-theme px-3 py-2 text-xs text-main outline-none focus:border-amber-400"
        />
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !hasContent}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-45"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          {output ? "Regenerar podcast" : "Crear podcast"}
        </button>
      </section>

      {output && (
        <section className="space-y-3 rounded-2xl border border-soft bg-card-theme p-3">
          <PodcastRenderer data={output} />
          <PodcastAudio output={output} />
        </section>
      )}
    </div>
  )
}

function PodcastAudio({ output }: { output: GeneratedOutput }) {
  const segments = Array.isArray(output._podcastWavSegments)
    ? output._podcastWavSegments as Array<{ speaker: "A" | "B"; text: string }>
    : []
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  const generateAudio = async () => {
    if (!segments.length) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/agents/podcast-wav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments }),
      })
      if (!response.ok) throw new Error(`El audio respondió HTTP ${response.status}`)
      setAudioUrl(URL.createObjectURL(await response.blob()))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible generar el audio")
    } finally {
      setLoading(false)
    }
  }

  const toggle = async () => {
    if (!audioRef.current) return
    if (playing) audioRef.current.pause()
    else await audioRef.current.play()
    setPlaying(!playing)
  }

  if (!segments.length) return null

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3">
      {error && <p className="mb-2 text-[10px] text-red-500">{error}</p>}
      {!audioUrl ? (
        <button
          type="button"
          onClick={generateAudio}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Headphones size={13} />}
          {loading ? "Generando audio..." : "Generar audio del episodio"}
        </button>
      ) : (
        <div className="space-y-2">
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white"
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? "Pausar" : "Reproducir"}
          </button>
          <a href={audioUrl} download="podcast-cuaderno-eduai.mp3" className="block text-center text-[10px] text-amber-500 hover:underline">
            Descargar audio
          </a>
        </div>
      )}
    </div>
  )
}
