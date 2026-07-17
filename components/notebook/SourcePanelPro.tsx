"use client"

import { useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  FileText,
  Globe2,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import type { NotebookSource, WebSearchResult } from "@/lib/notebook/types"

interface SourcePanelProProps {
  notebookId: string
  sources: NotebookSource[]
  onSourcesChange: () => void | Promise<void>
}

type AddMode = "url" | "text" | "file" | "web" | null

type LinkCheck = {
  ok: boolean
  status: number
  finalUrl: string
  title: string
  description?: string
  contentType?: string | null
  contentLength?: number | null
  kind: "paper" | "pdf" | "web"
  elapsedMs: number
  warning?: string | null
}

type SourceDetail = NotebookSource & {
  raw_text?: string | null
  extracted_text?: string | null
}

const TYPE_ICON: Record<string, string> = {
  url: "🔗",
  pdf: "📄",
  docx: "📎",
  txt: "📃",
  text: "📝",
  search_result: "🌐",
}

function normalizeUrl(input: string) {
  try {
    const url = new URL(input.trim())
    url.hash = ""
    if (url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1)
    return url.toString()
  } catch {
    return input.trim()
  }
}

function bytesLabel(value?: number | null) {
  if (!value) return null
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function sourceText(detail: SourceDetail | null) {
  return detail?.extracted_text || detail?.raw_text || ""
}

export default function SourcePanelPro({ notebookId, sources, onSourcesChange }: SourcePanelProProps) {
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [urlInput, setUrlInput] = useState("")
  const [textTitle, setTextTitle] = useState("")
  const [textInput, setTextInput] = useState("")
  const [webQuery, setWebQuery] = useState("")
  const [webResults, setWebResults] = useState<WebSearchResult[]>([])
  const [webLoading, setWebLoading] = useState(false)
  const [busySourceId, setBusySourceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingUrl, setCheckingUrl] = useState(false)
  const [checkResult, setCheckResult] = useState<LinkCheck | null>(null)
  const [detail, setDetail] = useState<SourceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const existingUrls = useMemo(
    () => new Set(sources.map((source) => source.url ? normalizeUrl(source.url) : "").filter(Boolean)),
    [sources],
  )

  const readyCount = sources.filter((source) => source.status === "ready").length
  const activeCount = sources.filter((source) => source.is_active && source.status === "ready").length

  const clearFeedback = () => {
    setError(null)
    setMessage(null)
  }

  const resetAdd = () => {
    setAddMode(null)
    setUrlInput("")
    setTextTitle("")
    setTextInput("")
    setWebQuery("")
    setWebResults([])
    setCheckResult(null)
    clearFeedback()
  }

  const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, init)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data?.error || data?.message || `Error HTTP ${response.status}`)
    return data as T
  }

  const checkUrl = async (rawUrl = urlInput): Promise<LinkCheck> => {
    const value = rawUrl.trim()
    if (!value) throw new Error("Escribe un enlace para revisarlo.")
    setCheckingUrl(true)
    clearFeedback()
    try {
      const data = await requestJson<LinkCheck>(`/api/notebooks/${notebookId}/sources/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      })
      setCheckResult(data)
      return data
    } finally {
      setCheckingUrl(false)
    }
  }

  const addSourceRecord = async (payload: Record<string, unknown>) => {
    const response = await fetch(`/api/notebooks/${notebookId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 409) throw new Error("Esta fuente ya está en el cuaderno.")
    if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`)
    return data.source as NotebookSource
  }

  const ingest = async (sourceId: string, fileBase64?: string) => {
    const result = await requestJson<{ ok: boolean; chunkCount: number; error?: string }>(
      `/api/notebooks/${notebookId}/ingest`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, fileBase64 }),
      },
    )

    void fetch(`/api/notebooks/${notebookId}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    }).catch(() => {})

    return result
  }

  const addUrlValue = async (rawUrl: string, suggestedTitle?: string) => {
    const normalized = normalizeUrl(rawUrl)
    if (existingUrls.has(normalized)) throw new Error("Esta fuente ya está en el cuaderno.")

    const checked = await checkUrl(rawUrl)
    const finalUrl = checked.finalUrl || rawUrl
    if (existingUrls.has(normalizeUrl(finalUrl))) throw new Error("Esta fuente ya está en el cuaderno.")

    const source = await addSourceRecord({
      type: "url",
      url: finalUrl,
      title: suggestedTitle || checked.title,
      metadata: {
        link_check: checked,
        source_kind: checked.kind,
        verified_at: new Date().toISOString(),
      },
    })
    const result = await ingest(source.id)
    await Promise.resolve(onSourcesChange())
    setMessage(`Fuente procesada: ${source.title || checked.title} · ${result.chunkCount} fragmentos.`)
    return source
  }

  const addUrl = async () => {
    if (!urlInput.trim()) return
    setLoading(true)
    clearFeedback()
    try {
      await addUrlValue(urlInput)
      resetAdd()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible agregar el enlace")
    } finally {
      setLoading(false)
    }
  }

  const addText = async () => {
    if (!textInput.trim()) return
    setLoading(true)
    clearFeedback()
    try {
      const source = await addSourceRecord({
        type: "text",
        title: textTitle.trim() || "Texto pegado",
        raw_text: textInput.trim(),
      })
      const result = await ingest(source.id)
      await Promise.resolve(onSourcesChange())
      setMessage(`Texto procesado en ${result.chunkCount} fragmentos.`)
      resetAdd()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible agregar el texto")
    } finally {
      setLoading(false)
    }
  }

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "")
    reader.onerror = () => reject(new Error("No fue posible leer el archivo"))
    reader.readAsDataURL(file)
  })

  const addFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || ""
    const isPlainText = ["txt", "md", "csv"].includes(extension)
    const type = extension === "pdf" ? "pdf" : extension === "docx" ? "docx" : "txt"
    if (!["pdf", "docx", "txt", "md", "csv"].includes(extension)) {
      throw new Error("Formato no compatible. Usa PDF, DOCX, TXT, MD o CSV.")
    }
    if (file.size > 20 * 1024 * 1024) throw new Error("El archivo supera el límite de 20 MB.")

    const rawText = isPlainText ? await file.text() : undefined
    const source = await addSourceRecord({ type, title: file.name, raw_text: rawText })
    const base64 = isPlainText ? undefined : await fileToBase64(file)
    const result = await ingest(source.id, base64)
    await Promise.resolve(onSourcesChange())
    setMessage(`${file.name} procesado en ${result.chunkCount} fragmentos.`)
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    clearFeedback()
    try {
      await addFile(file)
      resetAdd()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible procesar el archivo")
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const searchWeb = async () => {
    if (!webQuery.trim()) return
    setWebLoading(true)
    clearFeedback()
    setWebResults([])
    try {
      const data = await requestJson<{ results?: WebSearchResult[] }>("/api/web/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: webQuery.trim() }),
      })
      setWebResults(data.results || [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible investigar en la web")
    } finally {
      setWebLoading(false)
    }
  }

  const addWebResult = async (result: WebSearchResult) => {
    setLoading(true)
    clearFeedback()
    try {
      await addUrlValue(result.url, result.title)
      setWebResults((current) => current.filter((item) => item.url !== result.url))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible agregar el resultado")
    } finally {
      setLoading(false)
    }
  }

  const patchSource = async (sourceId: string, isActive: boolean) => {
    await requestJson(`/api/notebooks/${notebookId}/sources`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, is_active: isActive }),
    })
    await Promise.resolve(onSourcesChange())
  }

  const deleteSource = async (sourceId: string) => {
    if (!window.confirm("¿Eliminar esta fuente y sus fragmentos del cuaderno?")) return
    setBusySourceId(sourceId)
    try {
      await requestJson(`/api/notebooks/${notebookId}/sources?sourceId=${encodeURIComponent(sourceId)}`, { method: "DELETE" })
      await Promise.resolve(onSourcesChange())
      if (detail?.id === sourceId) setDetail(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible eliminar la fuente")
    } finally {
      setBusySourceId(null)
    }
  }

  const reprocessSource = async (sourceId: string) => {
    setBusySourceId(sourceId)
    clearFeedback()
    try {
      const result = await ingest(sourceId)
      await Promise.resolve(onSourcesChange())
      setMessage(`Fuente reprocesada: ${result.chunkCount} fragmentos.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible reprocesar la fuente")
    } finally {
      setBusySourceId(null)
    }
  }

  const openReader = async (source: NotebookSource) => {
    setDetailLoading(true)
    clearFeedback()
    try {
      const data = await requestJson<{ source: SourceDetail }>(
        `/api/notebooks/${notebookId}/sources/${source.id}`,
      )
      setDetail(data.source)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible abrir la lectura")
    } finally {
      setDetailLoading(false)
    }
  }

  const recheckSource = async (source: NotebookSource) => {
    if (!source.url) return
    setBusySourceId(source.id)
    clearFeedback()
    try {
      const result = await checkUrl(source.url)
      setMessage(`Enlace revisado: HTTP ${result.status} · ${result.elapsedMs} ms.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible revisar el enlace")
    } finally {
      setBusySourceId(null)
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <header className="border-b border-soft p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-main">Fuentes y lecturas</p>
            <p className="mt-0.5 text-[10px] text-muted2">{activeCount} activas · {readyCount} procesadas · {sources.length} total</p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
            Base del chat
          </span>
        </div>

        {!addMode && (
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: "url", label: "Enlace", icon: Link2 },
              { id: "file", label: "Archivo", icon: Upload },
              { id: "text", label: "Texto", icon: FileText },
              { id: "web", label: "Investigar", icon: Globe2 },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setAddMode(item.id as AddMode); clearFeedback() }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-soft bg-card-soft-theme px-2 py-2 text-xs font-medium text-sub transition hover:border-blue-400/30 hover:bg-blue-500/5 hover:text-blue-500"
                >
                  <Icon size={13} /> {item.label}
                </button>
              )
            })}
          </div>
        )}
      </header>

      {(error || message) && (
        <div className="border-b border-soft px-3 py-2">
          {error ? (
            <p className="rounded-lg bg-red-500/10 px-2 py-1.5 text-[11px] text-red-500">{error}</p>
          ) : (
            <p className="rounded-lg bg-blue-500/8 px-2 py-1.5 text-[11px] text-blue-500">{message}</p>
          )}
        </div>
      )}

      {addMode && (
        <section className="border-b border-soft p-3">
          <button type="button" onClick={resetAdd} className="mb-3 flex items-center gap-1 text-[11px] text-muted2 hover:text-main">
            <ChevronLeft size={12} /> Volver
          </button>

          {addMode === "url" && (
            <div className="space-y-2">
              <input
                value={urlInput}
                onChange={(event) => { setUrlInput(event.target.value); setCheckResult(null) }}
                onKeyDown={(event) => event.key === "Enter" && void addUrl()}
                placeholder="https://..., DOI, arXiv o PDF"
                className="w-full rounded-xl border border-soft bg-input-theme px-3 py-2 text-xs text-main outline-none focus:border-blue-400"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void checkUrl().catch((caught) => setError(caught instanceof Error ? caught.message : "Error"))}
                  disabled={checkingUrl || !urlInput.trim()}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-soft bg-card-soft-theme px-2 py-2 text-xs font-semibold text-sub disabled:opacity-40"
                >
                  {checkingUrl ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                  Revisar
                </button>
                <button
                  type="button"
                  onClick={() => void addUrl()}
                  disabled={loading || checkingUrl || !urlInput.trim()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Agregar
                </button>
              </div>
              {checkResult && <LinkCheckCard result={checkResult} />}
            </div>
          )}

          {addMode === "text" && (
            <div className="space-y-2">
              <input
                value={textTitle}
                onChange={(event) => setTextTitle(event.target.value)}
                placeholder="Título del texto"
                className="w-full rounded-xl border border-soft bg-input-theme px-3 py-2 text-xs text-main outline-none"
              />
              <textarea
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                placeholder="Pega aquí apuntes, transcripción o contenido..."
                rows={7}
                className="w-full resize-none rounded-xl border border-soft bg-input-theme px-3 py-2 text-xs leading-relaxed text-main outline-none"
              />
              <button
                type="button"
                onClick={() => void addText()}
                disabled={loading || !textInput.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Guardar y procesar
              </button>
            </div>
          )}

          {addMode === "file" && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv"
                className="hidden"
                onChange={(event) => void handleFile(event)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-soft bg-card-soft-theme px-4 py-7 text-center transition hover:border-blue-400/40"
              >
                {loading ? <Loader2 size={24} className="animate-spin text-blue-500" /> : <Upload size={24} className="text-blue-500" />}
                <span className="mt-2 text-xs font-semibold text-main">Seleccionar archivo</span>
                <span className="mt-1 text-[10px] text-muted2">PDF, DOCX, TXT, MD o CSV · máximo 20 MB</span>
              </button>
            </div>
          )}

          {addMode === "web" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={webQuery}
                  onChange={(event) => setWebQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void searchWeb()}
                  placeholder="Busca artículos, papers o documentación..."
                  className="min-w-0 flex-1 rounded-xl border border-soft bg-input-theme px-3 py-2 text-xs text-main outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void searchWeb()}
                  disabled={webLoading || !webQuery.trim()}
                  className="rounded-xl bg-blue-600 px-3 text-white disabled:opacity-40"
                >
                  {webLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {webResults.map((result) => {
                  const alreadyAdded = existingUrls.has(normalizeUrl(result.url))
                  return (
                    <article key={result.url} className="rounded-xl border border-soft bg-card-soft-theme p-2.5">
                      <p className="line-clamp-2 text-xs font-semibold text-main">{result.title}</p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted2">{result.snippet}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[9px] text-blue-500">{result.url}</span>
                        <button
                          type="button"
                          onClick={() => void addWebResult(result)}
                          disabled={loading || alreadyAdded}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-500 disabled:opacity-40"
                        >
                          {alreadyAdded ? <CheckCircle2 size={11} /> : <Plus size={11} />}
                          {alreadyAdded ? "Agregada" : "Agregar"}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {sources.length === 0 && (
          <div className="px-4 py-12 text-center">
            <BookOpenText size={30} className="mx-auto text-blue-400" />
            <p className="mt-3 text-xs font-semibold text-main">Agrega tu primera lectura</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted2">Puedes usar páginas web, DOI, arXiv, PDFs, documentos o texto pegado.</p>
          </div>
        )}

        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            busy={busySourceId === source.id || detailLoading}
            onRead={() => void openReader(source)}
            onCheck={() => void recheckSource(source)}
            onReprocess={() => void reprocessSource(source.id)}
            onToggle={() => void patchSource(source.id, !source.is_active)}
            onDelete={() => void deleteSource(source.id)}
          />
        ))}
      </div>

      {detail && (
        <ReaderDrawer source={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

function LinkCheckCard({ result }: { result: LinkCheck }) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/7 p-2.5">
      <div className="flex items-start gap-2">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold text-main">{result.title}</p>
          <p className="mt-0.5 text-[10px] text-muted2">HTTP {result.status} · {result.kind === "paper" ? "paper" : result.kind === "pdf" ? "PDF" : "web"} · {result.elapsedMs} ms{bytesLabel(result.contentLength) ? ` · ${bytesLabel(result.contentLength)}` : ""}</p>
          {result.description && <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-muted2">{result.description}</p>}
          {result.warning && <p className="mt-1 text-[10px] text-amber-500">{result.warning}</p>}
        </div>
      </div>
    </div>
  )
}

function SourceCard({ source, busy, onRead, onCheck, onReprocess, onToggle, onDelete }: {
  source: NotebookSource
  busy: boolean
  onRead: () => void
  onCheck: () => void
  onReprocess: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const status = source.status || "pending"
  return (
    <article className={`rounded-xl border p-2.5 transition ${source.is_active ? "border-soft bg-card-theme" : "border-soft bg-card-soft-theme opacity-65"}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-sm">{TYPE_ICON[source.type] || "📄"}</span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold leading-tight text-main">{source.title || source.url || "Fuente"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-muted2">
            {status === "ready" ? <CheckCircle2 size={10} className="text-emerald-500" /> : status === "error" ? <AlertCircle size={10} className="text-red-500" /> : <Loader2 size={10} className="animate-spin text-blue-500" />}
            <span>{status === "ready" ? "Lista" : status === "error" ? "Error" : "Procesando"}</span>
            {source.url && <span className="truncate">· {new URL(source.url).hostname}</span>}
          </div>
        </div>
        <button type="button" onClick={onToggle} title={source.is_active ? "Excluir del chat" : "Incluir en el chat"}>
          {source.is_active ? <ToggleRight size={17} className="text-blue-500" /> : <ToggleLeft size={17} className="text-muted2" />}
        </button>
      </div>

      {source.error_message && <p className="mt-2 rounded-lg bg-red-500/8 px-2 py-1 text-[9px] text-red-500">{source.error_message}</p>}

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={onRead} disabled={busy || status !== "ready"} className="flex items-center justify-center gap-1 rounded-lg bg-blue-500/8 px-2 py-1.5 text-[10px] font-semibold text-blue-500 disabled:opacity-35">
          <BookOpenText size={11} /> Leer
        </button>
        {source.url ? (
          <button type="button" onClick={onCheck} disabled={busy} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/8 px-2 py-1.5 text-[10px] font-semibold text-emerald-500 disabled:opacity-35">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />} Revisar
          </button>
        ) : (
          <button type="button" onClick={onReprocess} disabled={busy} className="flex items-center justify-center gap-1 rounded-lg bg-amber-500/8 px-2 py-1.5 text-[10px] font-semibold text-amber-500 disabled:opacity-35">
            <RefreshCw size={11} /> Reprocesar
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-end gap-2">
        {source.url && (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[9px] text-muted2 hover:text-blue-500">
            <ExternalLink size={10} /> Original
          </a>
        )}
        <button type="button" onClick={onReprocess} disabled={busy} className="text-[9px] text-muted2 hover:text-amber-500 disabled:opacity-35">Reprocesar</button>
        <button type="button" onClick={onDelete} disabled={busy} className="text-muted2 hover:text-red-500 disabled:opacity-35" title="Eliminar fuente"><Trash2 size={11} /></button>
      </div>
    </article>
  )
}

function ReaderDrawer({ source, onClose }: { source: SourceDetail; onClose: () => void }) {
  const text = sourceText(source)
  const wordCount = text ? text.trim().split(/\s+/).length : 0
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-app">
      <header className="flex items-start gap-2 border-b border-soft p-3">
        <button type="button" onClick={onClose} className="rounded-lg bg-card-soft-theme p-1.5 text-muted2 hover:text-main"><X size={14} /></button>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold text-main">{source.title || "Lectura"}</p>
          <p className="mt-0.5 text-[9px] text-muted2">{wordCount.toLocaleString("es-CL")} palabras · {source.type.toUpperCase()}</p>
        </div>
        {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-blue-500/8 p-1.5 text-blue-500"><ExternalLink size={13} /></a>}
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {text ? (
          <article className="whitespace-pre-wrap text-xs leading-7 text-sub">{text}</article>
        ) : (
          <div className="py-12 text-center text-xs text-muted2">La fuente no tiene texto extraído disponible.</div>
        )}
      </div>
    </div>
  )
}
