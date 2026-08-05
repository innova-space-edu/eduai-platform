import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/repositorio/page.tsx"
const MARKER = "REPOSITORY_SHARING_V1"

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[repository-sharing] No se encontró ${label}`)
  return source.replace(from, to)
}

if (!existsSync(PAGE)) throw new Error(`[repository-sharing] No existe ${PAGE}`)

let source = readFileSync(PAGE, "utf8")

if (!source.includes(MARKER)) {
  source = replaceRequired(
    source,
    `  RefreshCw,
  Search,
  Upload,`,
    `  RefreshCw,
  Search,
  Share2,
  Check,
  Copy,
  Upload,`,
    "importaciones de iconos",
  )

  source = replaceRequired(
    source,
    `  const [urlError, setUrlError] = useState("")`,
    `  const [urlError, setUrlError] = useState("")
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState("")
  const [shareCopied, setShareCopied] = useState(false)`,
    "estados del enlace compartido",
  )

  source = replaceRequired(
    source,
    `  const counts = useMemo(() => ({ files: items.filter((item) => item.source_type === "file").length, videos: items.filter((item) => item.source_type === "youtube").length }), [items])`,
    `  const createShareLink = async (item: RepositoryItem) => {
    setShareOpen(true)
    setShareLoading(true)
    setShareError("")
    setShareUrl("")
    setShareCopied(false)
    try {
      const response = await fetch("/api/repository/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "No fue posible crear el enlace compartido.")
      setShareUrl(data.shareUrl)
    } catch (caught) {
      setShareError(caught instanceof Error ? caught.message : "No fue posible crear el enlace compartido.")
    } finally {
      setShareLoading(false)
    }
  }

  const copyShareUrl = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1800)
    } catch {
      setShareError("No fue posible copiar el enlace. Selecciónalo manualmente.")
    }
  }

  const counts = useMemo(() => ({ files: items.filter((item) => item.source_type === "file").length, videos: items.filter((item) => item.source_type === "youtube").length }), [items])

  // ${MARKER}`,
    "funciones para compartir",
  )

  source = replaceRequired(
    source,
    `                <div className="flex shrink-0 items-center gap-1">
                  {selectedItem.source_type === "youtube" && selectedItem.youtube_url && (`,
    `                <div className="flex shrink-0 items-center gap-1">
                  {selectedItem.created_by === userId && (
                    <button
                      type="button"
                      onClick={() => void createShareLink(selectedItem)}
                      className="rounded-xl p-2.5 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
                      aria-label="Compartir documento"
                      title="Compartir documento"
                    >
                      <Share2 size={17} />
                    </button>
                  )}
                  {selectedItem.source_type === "youtube" && selectedItem.youtube_url && (`,
    "botón compartir",
  )

  source = replaceRequired(
    source,
    `      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={onCreated} userId={userId} />`,
    `      {shareOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-400/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="repository-share-title">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl shadow-blue-200/60">
            <div className="flex items-start justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-sky-50 to-violet-50 px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Enlace permanente</p>
                <h2 id="repository-share-title" className="mt-1 text-xl font-black text-slate-900">Compartir documento</h2>
                <p className="mt-1 line-clamp-1 text-sm text-slate-500">{selectedItem.title}</p>
              </div>
              <button type="button" onClick={() => setShareOpen(false)} className="rounded-xl bg-white p-2 text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-slate-600">
                Cualquier persona que reciba este enlace podrá ver únicamente este material y descargarlo. El enlace no tiene fecha de vencimiento.
              </div>

              {shareLoading ? (
                <div className="flex min-h-28 items-center justify-center gap-3 text-sm font-bold text-blue-700">
                  <Loader2 size={20} className="animate-spin" /> Generando enlace…
                </div>
              ) : shareError ? (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" /> {shareError}
                </div>
              ) : shareUrl ? (
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Enlace para compartir</span>
                    <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => void copyShareUrl()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">
                      {shareCopied ? <Check size={17} /> : <Copy size={17} />}
                      {shareCopied ? "Enlace copiado" : "Copiar enlace"}
                    </button>
                    <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-50">
                      <ExternalLink size={17} /> Ver página compartida
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={onCreated} userId={userId} />`,
    "diálogo para compartir",
  )

  writeFileSync(PAGE, source)
}

const verified = readFileSync(PAGE, "utf8")
for (const required of [
  MARKER,
  "createShareLink",
  "Compartir documento",
  "/api/repository/share",
  "El enlace no tiene fecha de vencimiento",
  "Ver página compartida",
]) {
  if (!verified.includes(required)) throw new Error(`[repository-sharing] Falta ${required}`)
}

console.log("[repository-sharing] enlaces permanentes y diálogo de compartir aplicados")
