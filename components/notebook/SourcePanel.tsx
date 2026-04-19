"use client"
// components/notebook/SourcePanel.tsx
// Panel izquierdo: gestión de fuentes del notebook

import { useState, useRef, useCallback } from "react"
import {
  Link2, FileText, Upload, Globe, Plus, Trash2,
  CheckCircle2, Clock, AlertCircle, Loader2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Search,
} from "lucide-react"
import type { NotebookSource, WebSearchResult } from "@/lib/notebook/types"

const TYPE_ICONS: Record<string, string> = {
  url:           "🔗",
  pdf:           "📄",
  docx:          "📎",
  txt:           "📃",
  text:          "📝",
  search_result: "🌐",
}

type AddMode = "url" | "text" | "file" | "web" | null

interface SourcePanelProps {
  notebookId: string
  sources:    NotebookSource[]
  onSourcesChange: () => void
}

export default function SourcePanel({ notebookId, sources, onSourcesChange }: SourcePanelProps) {
  const [addMode,      setAddMode]      = useState<AddMode>(null)
  const [urlInput,     setUrlInput]     = useState("")
  const [textInput,    setTextInput]    = useState("")
  const [textTitle,    setTextTitle]    = useState("")
  const [webQuery,     setWebQuery]     = useState("")
  const [webResults,   setWebResults]   = useState<WebSearchResult[]>([])
  const [webLoading,   setWebLoading]   = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const resetAdd = () => {
    setAddMode(null)
    setUrlInput("")
    setTextInput("")
    setTextTitle("")
    setWebQuery("")
    setWebResults([])
    setError(null)
  }

  // ─── Agregar URL ────────────────────────────────────────────────────────────

  const addUrl = async () => {
    if (!urlInput.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/notebooks/${notebookId}/sources`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "url", url: urlInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error")
      // Ingestar automáticamente
      await ingestSource(data.source.id)
      onSourcesChange()
      resetAdd()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  // ─── Agregar texto ───────────────────────────────────────────────────────────

  const addText = async () => {
    if (!textInput.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/notebooks/${notebookId}/sources`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          type:     "text",
          title:    textTitle.trim() || "Texto pegado",
          raw_text: textInput.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error")
      await ingestSource(data.source.id)
      onSourcesChange()
      resetAdd()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  // ─── Agregar archivo ─────────────────────────────────────────────────────────

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)

    try {
      const ext  = file.name.split(".").pop()?.toLowerCase() ?? ""
      const type = ext === "pdf" ? "pdf" : ext === "docx" ? "docx" : "txt"

      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload  = () => res((r.result as string).split(",")[1])
        r.onerror = () => rej(new Error("Error leyendo archivo"))
        r.readAsDataURL(file)
      })

      // Crear fuente primero
      const createRes  = await fetch(`/api/notebooks/${notebookId}/sources`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, title: file.name }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error ?? "Error")

      // Ingestar con base64
      await ingestSource(createData.source.id, b64)
      onSourcesChange()
      resetAdd()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }, [notebookId, onSourcesChange])

  // ─── Buscar web ──────────────────────────────────────────────────────────────

  const searchWeb = async () => {
    if (!webQuery.trim()) return
    setWebLoading(true)
    setWebResults([])
    try {
      const res  = await fetch("/api/web/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: webQuery.trim() }),
      })
      const data = await res.json()
      setWebResults(data.results ?? [])
    } catch {
      setWebResults([])
    } finally {
      setWebLoading(false)
    }
  }

  const addWebResult = async (result: WebSearchResult) => {
    setLoading(true)
    try {
      const res  = await fetch("/api/web/ingest", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: result.url, notebookId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error")
      await ingestSource(data.source.id)
      onSourcesChange()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  // ─── Ingestar fuente ─────────────────────────────────────────────────────────

  const ingestSource = async (sourceId: string, fileBase64?: string) => {
    await fetch(`/api/notebooks/${notebookId}/ingest`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sourceId, fileBase64 }),
    })
  }

  // ─── Toggle activo ───────────────────────────────────────────────────────────

  const toggleSource = async (sourceId: string, isActive: boolean) => {
    await fetch(`/api/notebooks/${notebookId}/sources`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sourceId, is_active: !isActive }),
    })
    onSourcesChange()
  }

  // ─── Eliminar fuente ─────────────────────────────────────────────────────────

  const deleteSource = async (sourceId: string) => {
    await fetch(`/api/notebooks/${notebookId}/sources?sourceId=${sourceId}`, {
      method: "DELETE",
    })
    onSourcesChange()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-soft">
        <div className="flex items-center justify-between mb-3">
          <p className="text-main font-semibold text-sm">Fuentes</p>
          <span className="text-xs text-muted2">{sources.length}</span>
        </div>

        {/* Botones de tipo */}
        {!addMode && (
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: "url",  icon: <Link2   size={12} />, label: "URL"      },
              { id: "text", icon: <FileText size={12} />, label: "Texto"   },
              { id: "file", icon: <Upload   size={12} />, label: "Archivo" },
              { id: "web",  icon: <Globe    size={12} />, label: "Web"     },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setAddMode(btn.id as AddMode)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background:   "var(--bg-card-soft)",
                  color:        "var(--text-muted)",
                  border:       "1px solid var(--border-soft)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background   = "rgba(37,99,235,0.08)"
                  e.currentTarget.style.borderColor  = "rgba(37,99,235,0.2)"
                  e.currentTarget.style.color        = "var(--accent-blue)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background   = "var(--bg-card-soft)"
                  e.currentTarget.style.borderColor  = "var(--border-soft)"
                  e.currentTarget.style.color        = "var(--text-muted)"
                }}
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add mode forms */}
      {addMode && (
        <div className="p-4 border-b border-soft">
          {error && (
            <p className="text-xs text-red-400 mb-2 px-2 py-1 rounded-lg bg-red-500/10">
              {error}
            </p>
          )}

          {/* URL */}
          {addMode === "url" && (
            <div className="flex flex-col gap-2">
              <input
                type="url"
                placeholder="https://..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{
                  background:  "var(--bg-input)",
                  border:      "1px solid var(--border-medium)",
                  color:       "var(--text-primary)",
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={addUrl} disabled={loading}
                  className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--accent-blue)" }}>
                  {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Agregar"}
                </button>
                <button onClick={resetAdd} className="px-3 py-1.5 rounded-xl text-xs"
                  style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Texto */}
          {addMode === "text" && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Título (opcional)"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)", border: "1px solid var(--border-medium)",
                  color: "var(--text-primary)",
                }}
              />
              <textarea
                placeholder="Pega tu texto aquí..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-none"
                style={{
                  background: "var(--bg-input)", border: "1px solid var(--border-medium)",
                  color: "var(--text-primary)",
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={addText} disabled={loading || !textInput.trim()}
                  className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--accent-blue)" }}>
                  {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Guardar fuente"}
                </button>
                <button onClick={resetAdd} className="px-3 py-1.5 rounded-xl text-xs"
                  style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Archivo */}
          {addMode === "file" && (
            <div className="flex flex-col gap-2">
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all"
                style={{ borderColor: "var(--border-medium)" }}
                onClick={() => fileRef.current?.click()}
              >
                {loading
                  ? <Loader2 size={20} className="animate-spin mx-auto text-blue-400" />
                  : (
                    <>
                      <Upload size={20} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        PDF, DOCX o TXT
                      </p>
                    </>
                  )
                }
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFile}
                className="hidden"
              />
              <button onClick={resetAdd} className="py-1.5 rounded-xl text-xs text-center"
                style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}>
                Cancelar
              </button>
            </div>
          )}

          {/* Web search */}
          {addMode === "web" && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Buscar en la web..."
                  value={webQuery}
                  onChange={(e) => setWebQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchWeb()}
                  className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                  style={{
                    background: "var(--bg-input)", border: "1px solid var(--border-medium)",
                    color: "var(--text-primary)",
                  }}
                  autoFocus
                />
                <button
                  onClick={searchWeb}
                  disabled={webLoading}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ background: "var(--accent-blue)" }}
                >
                  {webLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                </button>
              </div>

              {/* Resultados */}
              {webResults.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {webResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-xl text-xs"
                      style={{ background: "var(--bg-card-soft)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-main truncate">{r.title}</p>
                        <p className="text-muted2 line-clamp-2 mt-0.5">{r.snippet}</p>
                      </div>
                      <button
                        onClick={() => addWebResult(r)}
                        disabled={loading}
                        className="flex-shrink-0 p-1 rounded-lg transition-all"
                        style={{ background: "rgba(37,99,235,0.1)", color: "var(--accent-blue)" }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={resetAdd} className="py-1.5 rounded-xl text-xs text-center"
                style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Source list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {sources.length === 0 && (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">📂</p>
            <p className="text-xs text-muted2">
              Agrega fuentes para comenzar.<br />URL, texto, PDF o busca en la web.
            </p>
          </div>
        )}

        {sources.map((src) => (
          <SourceCard
            key={src.id}
            source={src}
            onToggle={() => toggleSource(src.id, src.is_active)}
            onDelete={() => deleteSource(src.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── SourceCard ───────────────────────────────────────────────────────────────

function SourceCard({
  source,
  onToggle,
  onDelete,
}: {
  source:   NotebookSource
  onToggle: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = {
    pending:    <Clock size={10} className="text-amber-400" />,
    processing: <Loader2 size={10} className="text-blue-400 animate-spin" />,
    ready:      <CheckCircle2 size={10} className="text-green-400" />,
    error:      <AlertCircle size={10} className="text-red-400" />,
  }[source.status]

  return (
    <div
      className="rounded-xl border p-2.5 transition-all"
      style={{
        background:   source.is_active ? "var(--bg-card)" : "var(--bg-card-soft)",
        borderColor:  source.is_active ? "var(--border-medium)" : "var(--border-soft)",
        opacity:      source.is_active ? 1 : 0.65,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm flex-shrink-0">
          {TYPE_ICONS[source.type] ?? "📄"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-main truncate leading-tight">
            {source.title ?? source.url ?? "Fuente"}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {statusIcon}
            <span className="text-[10px] text-muted2 capitalize">{source.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Toggle activo */}
          <button onClick={onToggle} title={source.is_active ? "Desactivar" : "Activar"}>
            {source.is_active
              ? <ToggleRight size={16} style={{ color: "var(--accent-blue)" }} />
              : <ToggleLeft  size={16} style={{ color: "var(--text-muted)" }} />
            }
          </button>
          {/* Expandir */}
          {source.extracted_text && (
            <button onClick={() => setExpanded(!expanded)}>
              {expanded
                ? <ChevronUp   size={13} style={{ color: "var(--text-muted)" }} />
                : <ChevronDown size={13} style={{ color: "var(--text-muted)" }} />
              }
            </button>
          )}
          {/* Eliminar */}
          <button onClick={onDelete}>
            <Trash2 size={13} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
      </div>

      {/* Preview del texto */}
      {expanded && source.extracted_text && (
        <div
          className="mt-2 p-2 rounded-lg text-[10px] leading-relaxed max-h-24 overflow-y-auto"
          style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}
        >
          {source.extracted_text.slice(0, 400)}...
        </div>
      )}

      {source.status === "error" && source.error_message && (
        <p className="mt-1 text-[10px] text-red-400 px-1">
          {source.error_message}
        </p>
      )}
    </div>
  )
}
