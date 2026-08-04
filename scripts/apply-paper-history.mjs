import fs from "node:fs"

function read(path) {
  return fs.readFileSync(path, "utf8")
}

function write(path, content) {
  fs.writeFileSync(path, content)
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`[paper-history] No se encontró: ${label}`)
  }
  return source.replace(search, replacement)
}

const componentPath = "components/paper/PaperHistoryPanel.tsx"
const component = `"use client"

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
`
write(componentPath, component)

const pagePath = "app/paper/page.tsx"
let page = read(pagePath)

page = replaceOnce(
  page,
  `import PdfPreview from "@/components/paper/PdfPreview"`,
  `import PdfPreview from "@/components/paper/PdfPreview"\nimport PaperHistoryPanel, { type PaperHistoryItem } from "@/components/paper/PaperHistoryPanel"`,
  "importar panel",
)

page = replaceOnce(
  page,
  `  Hash,\n  X,\n} from "lucide-react"`,
  `  Hash,\n  X,\n  FolderOpen,\n} from "lucide-react"`,
  "icono de carpeta",
)

page = replaceOnce(
  page,
  `  const [error, setError] = useState("")\n  const [docPanelOpen, setDocPanelOpen] = useState(false)`,
  `  const [error, setError] = useState("")\n  const [docPanelOpen, setDocPanelOpen] = useState(false)\n  const [historyOpen, setHistoryOpen] = useState(false)\n  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)`,
  "estado del panel",
)

page = replaceOnce(
  page,
  `    setChunkCount(0)\n    setDocPanelOpen(false)`,
  `    setChunkCount(0)\n    setDocPanelOpen(false)\n    setHistoryOpen(false)`,
  "cerrar panel al subir",
)

page = replaceOnce(
  page,
  `        setMessages([{\n          role: "assistant",\n          content: welcomeLines,\n          isOverview: true,\n        }])`,
  `        setMessages([{\n          role: "assistant",\n          content: welcomeLines,\n          isOverview: true,\n        }])\n        setHistoryRefreshKey((value) => value + 1)`,
  "refrescar historial",
)

page = replaceOnce(
  page,
  `  async function handleAsk(customQuestion?: string) {`,
  `  async function handleOpenHistoryItem(item: PaperHistoryItem) {\n    if (uploading || extracting) return\n\n    setHistoryOpen(false)\n    setDocPanelOpen(false)\n    setMessages([])\n    setQuestion("")\n    setError("")\n    setPaperText("")\n    setPaperSummary("")\n    setPaperPageCount(0)\n    setChunkCount(0)\n    setDocumentId(item.id)\n    setStorageBucket(item.bucket || STORAGE_BUCKET)\n    setStoragePath(item.filePath)\n    setPaperTitle(item.title || "Documento")\n\n    await runExtraction({\n      bucket: item.bucket || STORAGE_BUCKET,\n      filePath: item.filePath,\n      filename: item.title,\n      forceRefresh: false,\n    })\n  }\n\n  async function handleAsk(customQuestion?: string) {`,
  "abrir material histórico",
)

page = replaceOnce(
  page,
  `      <DropOverlay onDrop={handleUploadFile} />`,
  `      <DropOverlay onDrop={handleUploadFile} />\n      <PaperHistoryPanel\n        open={historyOpen}\n        refreshKey={historyRefreshKey}\n        busy={uploading || extracting}\n        onClose={() => setHistoryOpen(false)}\n        onOpenItem={handleOpenHistoryItem}\n      />`,
  "renderizar panel",
)

page = replaceOnce(
  page,
  `          <input\n            ref={fileInputRef}`,
  `          <button\n            type="button"\n            onClick={() => {\n              setHistoryOpen((value) => !value)\n              setDocPanelOpen(false)\n            }}\n            className="flex items-center gap-1.5 rounded-xl border border-soft bg-card-soft-theme px-3 py-1.5 text-xs text-sub hover:border-pink-500/30 hover:text-main transition"\n            title="Abrir materiales guardados"\n            aria-expanded={historyOpen}\n          >\n            <FolderOpen size={12} />\n            <span className="hidden sm:inline">Historial</span>\n          </button>\n\n          <input\n            ref={fileInputRef}`,
  "botón del panel",
)

page = replaceOnce(
  page,
  `            onClick={() => fileInputRef.current?.click()}\n            disabled={uploading || extracting}`,
  `            onClick={() => {\n              setHistoryOpen(false)\n              fileInputRef.current?.click()\n            }}\n            disabled={uploading || extracting}`,
  "cerrar panel al elegir PDF",
)

write(pagePath, page)

const routePath = "app/api/agents/paper/extract/route.ts"
let route = read(routePath)

route = replaceOnce(
  route,
  `export async function POST(req: Request) {`,
  `type StoredPaperDocument = {\n  id?: string | null\n  bucket?: string | null\n  file_path?: string | null\n  title?: string | null\n  summary?: string | null\n  page_count?: number | null\n  extraction_method?: string | null\n  parser_used?: string | null\n  ocr_used?: boolean | null\n  source_file_size_bytes?: number | null\n}\n\ntype StorageHistoryEntry = {\n  name?: string | null\n  created_at?: string | null\n  updated_at?: string | null\n  metadata?: Record<string, unknown> | null\n}\n\nfunction titleFromStorageName(name: string) {\n  return String(name || "Documento")\n    .replace(/^\\d{10,}-/, "")\n    .replace(/\\.pdf$/i, "")\n    .replace(/[-_]+/g, " ")\n    .trim() || "Documento"\n}\n\nfunction uploadedAtFromPath(filePath: string, fallback = "") {\n  const filename = filePath.split("/").pop() || ""\n  const timestamp = Number(filename.match(/^(\\d{10,})-/)?.[1] || 0)\n  if (Number.isFinite(timestamp) && timestamp > 0) {\n    return new Date(timestamp).toISOString()\n  }\n  return fallback || new Date(0).toISOString()\n}\n\nfunction storageEntrySize(entry: StorageHistoryEntry) {\n  const metadata = entry.metadata || {}\n  const candidates = [\n    metadata.size,\n    metadata.contentLength,\n    metadata.content_length,\n  ]\n\n  for (const candidate of candidates) {\n    const size = Number(candidate || 0)\n    if (Number.isFinite(size) && size > 0) return size\n  }\n\n  return 0\n}\n\nexport async function GET() {\n  const supabase = await createClient()\n  const {\n    data: { user },\n  } = await supabase.auth.getUser()\n\n  if (!user) {\n    return Response.json(\n      { error: "Sesión no válida. Vuelve a iniciar sesión." },\n      { status: 401 },\n    )\n  }\n\n  try {\n    const adminClient = getAdminClient()\n    const dataClient: any = adminClient || supabase\n    let warning = ""\n\n    const { data: storedFiles, error: storageError } = await dataClient.storage\n      .from(STORAGE_BUCKET)\n      .list(user.id, {\n        limit: 100,\n        offset: 0,\n        sortBy: { column: "created_at", order: "desc" },\n      })\n\n    if (storageError) {\n      warning = "No se pudo consultar completamente Supabase Storage: " + storageError.message\n      console.warn("[Paper][history][storage]", storageError)\n    }\n\n    const { data: documents, error: documentsError } = await dataClient\n      .from("paper_documents")\n      .select(\n        "id,bucket,file_path,title,summary,page_count,extraction_method,parser_used,ocr_used,source_file_size_bytes",\n      )\n      .eq("user_id", user.id)\n      .eq("bucket", STORAGE_BUCKET)\n      .limit(200)\n\n    if (documentsError) {\n      warning = warning || "Los archivos están disponibles, pero no se pudo leer el estado de la caché."\n      console.warn("[Paper][history][documents]", documentsError)\n    }\n\n    const documentMap = new Map<string, StoredPaperDocument>()\n    for (const document of (documents || []) as StoredPaperDocument[]) {\n      if (document.file_path) documentMap.set(document.file_path, document)\n    }\n\n    const items = ((storedFiles || []) as StorageHistoryEntry[])\n      .filter((entry) => !!entry.name && entry.name.toLowerCase().endsWith(".pdf"))\n      .map((entry) => {\n        const filePath = user.id + "/" + entry.name\n        const document = documentMap.get(filePath)\n        const uploadedAt = uploadedAtFromPath(\n          filePath,\n          entry.created_at || entry.updated_at || "",\n        )\n\n        return {\n          id: document?.id || null,\n          title: document?.title || titleFromStorageName(entry.name || "Documento"),\n          bucket: STORAGE_BUCKET,\n          filePath,\n          summary: document?.summary || "",\n          pageCount: Number(document?.page_count || 0),\n          extractionMethod: document?.extraction_method || "",\n          parserUsed: document?.parser_used || "",\n          ocrUsed: !!document?.ocr_used,\n          fileSizeBytes: Number(\n            document?.source_file_size_bytes || storageEntrySize(entry) || 0,\n          ),\n          uploadedAt,\n          processed: !!document?.id,\n        }\n      })\n      .sort(\n        (left, right) =>\n          new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),\n      )\n\n    return Response.json({\n      items,\n      newestFirst: true,\n      warning: warning || undefined,\n    })\n  } catch (error: unknown) {\n    console.error("[Paper][history] error:", error)\n    return Response.json(\n      { error: getErrorMessage(error) || "No se pudo cargar el historial." },\n      { status: 500 },\n    )\n  }\n}\n\nexport async function POST(req: Request) {`,
  "endpoint GET del historial",
)

write(routePath, route)

const testPath = "scripts/test-paper-pipeline.mjs"
let test = read(testPath)

test = replaceOnce(
  test,
  `const paperPage = read("app/paper/page.tsx")`,
  `const paperPage = read("app/paper/page.tsx")\nconst historyPanel = read("components/paper/PaperHistoryPanel.tsx")`,
  "cargar componente en pruebas",
)

test = replaceOnce(
  test,
  `assert(\n  paperPage.includes("PdfPreview"),\n  "Chat Paper no incluye la vista previa bajo demanda.",\n)`,
  `assert(\n  paperPage.includes("PdfPreview"),\n  "Chat Paper no incluye la vista previa bajo demanda.",\n)\nassert(\n  paperPage.includes("PaperHistoryPanel") && paperPage.includes("historyOpen"),\n  "Chat Paper no incluye el panel lateral de materiales guardados.",\n)\nassert(\n  historyPanel.includes("fixed inset-y-0 left-0") && historyPanel.includes("Más nuevos primero"),\n  "El historial no está implementado como panel lateral izquierdo ordenado por novedad.",\n)\nassert(\n  historyPanel.includes("Listo · caché") && historyPanel.includes("Reutiliza el análisis guardado"),\n  "El historial no informa la reutilización de la caché.",\n)`,
  "pruebas de interfaz del historial",
)

test = replaceOnce(
  test,
  `assert(\n  extractRoute.includes('body?.action === "prepare-upload"'),`,
  `assert(\n  extractRoute.includes("export async function GET()") && extractRoute.includes("newestFirst: true"),\n  "La ruta consolidada no entrega el historial ordenado desde el más nuevo.",\n)\nassert(\n  extractRoute.includes('body?.action === "prepare-upload"'),`,
  "prueba del endpoint de historial",
)

write(testPath, test)

console.log("[paper-history] Panel lateral izquierdo y caché de materiales aplicados.")
