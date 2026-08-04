"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Clock3,
  Database,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react"

export type PaperHistoryItem = {
  id: string | null
  title: string
  bucket: string
  filePath: string
  summary: string
  pageCount: number
  extractionMethod: string
  parserUsed: string
  ocrUsed: boolean
  fileSizeBytes: number
  uploadedAt: string
  processed: boolean
}

type HistoryResponse = {
  items?: PaperHistoryItem[]
  error?: string
  warning?: string
}

type PaperHistoryPanelProps = {
  open: boolean
  refreshKey: number
  busy?: boolean
  onClose: () => void
  onOpenItem: (item: PaperHistoryItem) => void | Promise<void>
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Tamaño no disponible"
  const mb = bytes / 1024 / 1024
  if (mb >= 1) return mb.toFixed(mb >= 10 ? 0 : 1) + " MB"
  return Math.max(1, Math.round(bytes / 1024)) + " KB"
}

function formatHistoryDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Fecha no disponible"

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

async function readErrorResponse(response: Response) {
  try {
    const data = await response.json()
    return data?.error || data?.message || "No se pudo cargar el historial."
  } catch {
    return "No se pudo cargar el historial."
  }
}

export default function PaperHistoryPanel({
  open,
  refreshKey,
  busy = false,
  onClose,
  onOpenItem,
}: PaperHistoryPanelProps) {
  const [items, setItems] = useState<PaperHistoryItem[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [warning, setWarning] = useState("")

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError("")
    setWarning("")

    try {
      const response = await fetch("/api/agents/paper/extract", {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) throw new Error(await readErrorResponse(response))

      const data: HistoryResponse = await response.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      setWarning(data.warning || "")
    } catch (loadError: unknown) {
      console.error("[Paper][history]", loadError)
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el historial.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadHistory()
  }, [open, refreshKey, loadHistory])

  useEffect(() => {
    if (!open) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [open, onClose])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    if (!normalizedQuery) return items

    return items.filter((item) =>
      [item.title, item.summary, item.parserUsed, item.extractionMethod]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(normalizedQuery),
    )
  }, [items, query])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar historial de materiales"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]"
      />

      <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(90vw,380px)] flex-col border-r border-soft bg-app shadow-2xl shadow-black/25">
        <div className="border-b border-soft px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-main">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-violet-500/10">
                  <FolderOpen size={17} className="text-pink-400" />
                </span>
                <div>
                  <div>Materiales guardados</div>
                  <div className="mt-0.5 text-[10px] font-normal text-muted2">
                    Más nuevos primero · {items.length} archivos
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-sub">
                Abre un PDF anterior para continuar trabajando sin repetir su extracción ni OCR.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-soft bg-card-soft-theme text-sub transition hover:text-main"
              title="Cerrar panel"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <label className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar material…"
                className="w-full rounded-xl border border-soft bg-card-soft-theme py-2.5 pl-9 pr-3 text-xs text-main placeholder:text-muted2 focus:border-pink-500/40 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft bg-card-soft-theme text-sub transition hover:text-main disabled:opacity-50"
              title="Actualizar historial"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {warning && (
            <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-400">
              {warning}
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {loading && !items.length ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-sub">
              <Loader2 size={15} className="animate-spin text-pink-400" />
              Cargando materiales…
            </div>
          ) : filteredItems.length ? (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <button
                  type="button"
                  key={item.filePath}
                  disabled={busy}
                  onClick={() => void onOpenItem(item)}
                  className="w-full rounded-2xl border border-soft bg-card-soft-theme p-3 text-left transition hover:border-pink-500/35 hover:bg-pink-500/[0.04] disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-pink-500/15 bg-gradient-to-br from-pink-500/10 to-violet-500/10">
                      <FileText size={18} className="text-pink-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-sm font-semibold text-main">
                          {item.title}
                        </div>
                        <span
                          className={
                            "flex-shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold " +
                            (item.processed
                              ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/15 bg-amber-500/10 text-amber-400")
                          }
                        >
                          {item.processed ? "Listo · caché" : "Pendiente"}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted2">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={9} /> {formatHistoryDate(item.uploadedAt)}
                        </span>
                        <span>{formatFileSize(item.fileSizeBytes)}</span>
                        {item.pageCount > 0 && <span>{item.pageCount} páginas</span>}
                      </div>

                      {item.processed && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
                          <Database size={9} />
                          Reutiliza el análisis guardado
                        </div>
                      )}

                      {item.summary && (
                        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-sub">
                          {item.summary}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-soft py-14 text-center">
              <FolderOpen size={26} className="mx-auto mb-2 text-muted2" />
              <p className="text-xs text-sub">
                {query ? "No hay materiales que coincidan." : "Todavía no has subido materiales."}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
