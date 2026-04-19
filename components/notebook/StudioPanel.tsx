"use client"
// components/notebook/StudioPanel.tsx
// Panel derecho: Studio de creaciones desde el notebook

import { useState } from "react"
import { Loader2, ChevronRight, ArrowLeft, Download } from "lucide-react"
import { RENDERERS } from "@/components/creator-hub/renderers"

const FORMATS = [
  { id: "infographic", icon: "📊", label: "Infografía",    color: "#3b82f6" },
  { id: "mindmap",     icon: "🧠", label: "Mapa Mental",   color: "#10b981" },
  { id: "quiz",        icon: "✅", label: "Quiz",          color: "#22c55e" },
  { id: "flashcards",  icon: "📇", label: "Flashcards",    color: "#06b6d4" },
  { id: "timeline",    icon: "⏳", label: "Timeline",      color: "#f97316" },
  { id: "podcast",     icon: "🎙️", label: "Podcast",       color: "#f59e0b" },
  { id: "presentation",icon: "📑", label: "Presentación",  color: "#8b5cf6" },
  { id: "cornell",     icon: "📓", label: "Notas Cornell", color: "#a78bfa" },
]

interface StudioPanelProps {
  notebookId: string
  hasContent: boolean
}

export default function StudioPanel({ notebookId, hasContent }: StudioPanelProps) {
  const [generating, setGenerating]   = useState<string | null>(null)
  const [activeOutput, setActiveOutput] = useState<{
    format: string
    data:   Record<string, unknown>
  } | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [topicHint, setTopicHint]     = useState("")
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)

  const generate = async (format: string) => {
    if (!hasContent) {
      setError("Agrega y procesa fuentes antes de generar.")
      return
    }
    setGenerating(format)
    setError(null)
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ format, topicHint: topicHint.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error generando")
      setActiveOutput({ format, data: data.output })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setGenerating(null)
      setSelectedFormat(null)
    }
  }

  // ─── Vista de output ─────────────────────────────────────────────────────────

  if (activeOutput) {
    const Renderer = (RENDERERS as Record<string, React.ComponentType<{ data: unknown }>>)[activeOutput.format]
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-soft flex items-center gap-3">
          <button
            onClick={() => setActiveOutput(null)}
            className="flex items-center gap-1 text-xs text-muted2 hover:text-main transition-colors"
          >
            <ArrowLeft size={13} />
            Volver
          </button>
          <span className="text-xs font-semibold text-main flex-1 capitalize">
            {activeOutput.format}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {Renderer
            ? <Renderer data={activeOutput.data} />
            : (
              <pre
                className="text-xs rounded-xl p-3 overflow-auto"
                style={{
                  background: "var(--bg-card-soft)",
                  color:      "var(--text-primary)",
                }}
              >
                {JSON.stringify(activeOutput.data, null, 2)}
              </pre>
            )
          }
        </div>
      </div>
    )
  }

  // ─── Grid de formatos ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-soft">
        <p className="text-main font-semibold text-sm mb-1">Studio</p>
        <p className="text-xs text-muted2">
          Genera materiales desde tus fuentes
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!hasContent && (
          <div
            className="mb-3 px-3 py-2 rounded-xl text-xs text-amber-400"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}
          >
            Procesa al menos una fuente para activar el Studio.
          </div>
        )}

        {error && (
          <div
            className="mb-3 px-3 py-2 rounded-xl text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
          >
            {error}
          </div>
        )}

        {/* Topic hint opcional */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Enfoque específico (opcional)..."
            value={topicHint}
            onChange={(e) => setTopicHint(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs outline-none"
            style={{
              background: "var(--bg-input)",
              border:     "1px solid var(--border-soft)",
              color:      "var(--text-primary)",
            }}
          />
        </div>

        {/* Format grid */}
        <div className="flex flex-col gap-2">
          {FORMATS.map((fmt) => {
            const isGenerating = generating === fmt.id

            return (
              <button
                key={fmt.id}
                onClick={() => {
                  setSelectedFormat(fmt.id)
                  generate(fmt.id)
                }}
                disabled={!!generating || !hasContent}
                className="flex items-center gap-3 p-3 rounded-xl border transition-all text-left disabled:cursor-not-allowed"
                style={{
                  background:   "var(--bg-card)",
                  borderColor:  selectedFormat === fmt.id ? fmt.color + "50" : "var(--border-soft)",
                  opacity:      !hasContent ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (hasContent && !generating) {
                    e.currentTarget.style.background   = `${fmt.color}0c`
                    e.currentTarget.style.borderColor  = `${fmt.color}30`
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background  = "var(--bg-card)"
                  e.currentTarget.style.borderColor = selectedFormat === fmt.id
                    ? fmt.color + "50"
                    : "var(--border-soft)"
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `${fmt.color}12`, border: `1px solid ${fmt.color}20` }}
                >
                  {isGenerating
                    ? <Loader2 size={14} className="animate-spin" style={{ color: fmt.color }} />
                    : fmt.icon
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-main">{fmt.label}</p>
                  {isGenerating && (
                    <p className="text-[10px] text-muted2">Generando...</p>
                  )}
                </div>
                <ChevronRight size={13} className="text-muted2 flex-shrink-0" />
              </button>
            )
          })}
        </div>

        {/* Tip */}
        <div
          className="mt-4 px-3 py-2.5 rounded-xl text-[10px] leading-relaxed"
          style={{
            background:  "rgba(37,99,235,0.04)",
            borderLeft:  "2px solid rgba(37,99,235,0.3)",
            color:       "var(--text-muted)",
          }}
        >
          Todo el contenido se genera desde las fuentes activas. No se inventa información.
        </div>
      </div>
    </div>
  )
}
