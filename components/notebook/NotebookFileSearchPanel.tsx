"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Cloud, Loader2, RefreshCw, Trash2 } from "lucide-react"
import type { NotebookSource } from "@/lib/notebook/types"

type FileSearchDocument = {
  id: string
  source_id: string
  display_name: string
  status: string
  error_message?: string | null
  indexed_at?: string | null
}

type FileSearchResponse = {
  documents?: FileSearchDocument[]
  document?: FileSearchDocument | null
  error?: string
  reused?: boolean
  generationAvoided?: boolean
}

const POLL_MS = 5_000

function statusLabel(status?: string | null) {
  switch (status) {
    case "ready": return "Lista"
    case "queued":
    case "indexing": return "Indexando"
    case "failed": return "Error"
    case "deleting": return "Eliminando"
    default: return "No indexada"
  }
}

function statusClass(status?: string | null) {
  switch (status) {
    case "ready": return "bg-emerald-500/10 text-emerald-500"
    case "queued":
    case "indexing":
    case "deleting": return "bg-blue-500/10 text-blue-500"
    case "failed": return "bg-red-500/10 text-red-500"
    default: return "bg-card-soft-theme text-muted2"
  }
}

export default function NotebookFileSearchPanel({ notebookId, sources }: {
  notebookId: string
  sources: NotebookSource[]
}) {
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState<Record<string, FileSearchDocument>>({})
  const [busySourceId, setBusySourceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const readySources = useMemo(
    () => sources.filter((source) => source.status === "ready"),
    [sources],
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/notebooks/${notebookId}/file-search`, { cache: "no-store" })
      const data = await response.json().catch(() => ({})) as FileSearchResponse
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`)
      const next: Record<string, FileSearchDocument> = {}
      for (const document of data.documents || []) next[document.source_id] = document
      setDocuments(next)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo consultar File Search")
    } finally {
      setLoading(false)
    }
  }, [notebookId])

  const pollPending = useCallback(async () => {
    const pending = Object.values(documents).filter((document) => ["queued", "indexing"].includes(document.status))
    if (!pending.length) return

    const results = await Promise.all(pending.map(async (document) => {
      try {
        const response = await fetch(
          `/api/notebooks/${notebookId}/file-search?sourceId=${encodeURIComponent(document.source_id)}`,
          { cache: "no-store" },
        )
        const data = await response.json().catch(() => ({})) as FileSearchResponse
        return response.ok && data.document ? data.document : null
      } catch {
        return null
      }
    }))

    setDocuments((current) => {
      const next = { ...current }
      for (const document of results) if (document) next[document.source_id] = document
      return next
    })
  }, [documents, notebookId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    const hasPending = Object.values(documents).some((document) => ["queued", "indexing"].includes(document.status))
    if (!hasPending) return
    pollTimer.current = setTimeout(() => void pollPending(), POLL_MS)
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [documents, pollPending])

  const syncSource = async (sourceId: string) => {
    setBusySourceId(sourceId)
    setError(null)
    try {
      const response = await fetch(`/api/notebooks/${notebookId}/file-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      })
      const data = await response.json().catch(() => ({})) as FileSearchResponse
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`)
      if (data.document) {
        setDocuments((current) => ({ ...current, [sourceId]: data.document as FileSearchDocument }))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo indexar la fuente")
    } finally {
      setBusySourceId(null)
    }
  }

  const removeSource = async (sourceId: string) => {
    setBusySourceId(sourceId)
    setError(null)
    try {
      const response = await fetch(
        `/api/notebooks/${notebookId}/file-search?sourceId=${encodeURIComponent(sourceId)}`,
        { method: "DELETE" },
      )
      const data = await response.json().catch(() => ({})) as FileSearchResponse
      if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`)
      setDocuments((current) => {
        const next = { ...current }
        delete next[sourceId]
        return next
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo quitar el índice")
    } finally {
      setBusySourceId(null)
    }
  }

  const readyIndexed = Object.values(documents).filter((document) => document.status === "ready").length
  const pending = Object.values(documents).filter((document) => ["queued", "indexing"].includes(document.status)).length

  return (
    <section className="shrink-0 border-b border-soft bg-card-theme">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-card-soft-theme"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-500">
          <Cloud size={13} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-main">Índice IA Google</span>
          <span className="block text-[9px] text-muted2">
            {readyIndexed} listas{pending ? ` · ${pending} indexando` : ""} · opcional
          </span>
        </span>
        {loading ? <Loader2 size={12} className="animate-spin text-muted2" /> : open ? <ChevronUp size={13} className="text-muted2" /> : <ChevronDown size={13} className="text-muted2" />}
      </button>

      {open && (
        <div className="max-h-64 space-y-1.5 overflow-y-auto border-t border-soft px-2.5 py-2">
          <p className="px-1 text-[9px] leading-relaxed text-muted2">
            File Search es una capa adicional para investigación profunda. El chat normal sigue usando el RAG privado de EduAI aunque no indexes nada aquí.
          </p>

          {error && <p className="rounded-lg bg-red-500/10 px-2 py-1.5 text-[9px] text-red-500">{error}</p>}

          {!readySources.length && (
            <p className="rounded-lg bg-card-soft-theme px-2 py-2 text-center text-[9px] text-muted2">No hay fuentes listas para indexar.</p>
          )}

          {readySources.map((source) => {
            const document = documents[source.id]
            const status = document?.status || "none"
            const busy = busySourceId === source.id || ["queued", "indexing", "deleting"].includes(status)
            return (
              <article key={source.id} className="rounded-lg border border-soft bg-card-soft-theme p-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold text-main">{source.title || source.url || "Fuente"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${statusClass(status)}`}>
                        {statusLabel(status)}
                      </span>
                      {!source.is_active && <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-amber-500">Fuera del chat</span>}
                    </div>
                    {document?.error_message && <p className="mt-1 line-clamp-2 text-[8px] text-red-500">{document.error_message}</p>}
                  </div>

                  {status === "ready" ? (
                    <button
                      type="button"
                      onClick={() => void removeSource(source.id)}
                      disabled={busy}
                      className="rounded-lg p-1.5 text-muted2 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-35"
                      title="Quitar de File Search"
                    >
                      {busySourceId === source.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void syncSource(source.id)}
                      disabled={busy}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-1 text-[9px] font-semibold text-violet-500 disabled:opacity-35"
                    >
                      {busy ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                      {status === "failed" ? "Reintentar" : status === "none" ? "Indexar" : "Procesando"}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
