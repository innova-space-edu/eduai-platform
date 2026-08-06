import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/repositorio/page.tsx"
const MARKER = "REPOSITORY_PUBLIC_ACCESS_V1"

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[repository-public-access] No se encontró ${label}`)
  return source.replace(from, to)
}

if (!existsSync(PAGE)) throw new Error(`[repository-public-access] No existe ${PAGE}`)

let source = readFileSync(PAGE, "utf8")

if (!source.includes(MARKER)) {
  source = replaceRequired(
    source,
    `  Share2,
  Check,
  Copy,
  Upload,`,
    `  Share2,
  Check,
  Copy,
  Globe2,
  ShieldCheck,
  Upload,`,
    "iconos del acceso público",
  )

  source = replaceRequired(
    source,
    `  const [shareCopied, setShareCopied] = useState(false)`,
    `  const [shareCopied, setShareCopied] = useState(false)
  const [isRepositoryAdmin, setIsRepositoryAdmin] = useState(false)
  const [publicAccessOpen, setPublicAccessOpen] = useState(false)
  const [publicAccessUrl, setPublicAccessUrl] = useState("")
  const [publicAccessLoading, setPublicAccessLoading] = useState(false)
  const [publicAccessError, setPublicAccessError] = useState("")
  const [publicAccessCopied, setPublicAccessCopied] = useState(false)`,
    "estados del acceso público",
  )

  source = replaceRequired(
    source,
    `  }, [loadItems, router, supabase])

  const filteredItems = useMemo(() => {`,
    `  }, [loadItems, router, supabase])

  useEffect(() => {
    let cancelled = false
    const verifyAdmin = async () => {
      try {
        const response = await fetch("/api/repository/public-access/admin-link", { cache: "no-store" })
        const data = await response.json().catch(() => null)
        if (!cancelled) setIsRepositoryAdmin(Boolean(response.ok && data?.isAdmin))
      } catch {
        if (!cancelled) setIsRepositoryAdmin(false)
      }
    }
    void verifyAdmin()
    return () => { cancelled = true }
  }, [])

  const filteredItems = useMemo(() => {`,
    "verificación del administrador",
  )

  source = replaceRequired(
    source,
    `  const counts = useMemo(() => ({ files: items.filter((item) => item.source_type === "file").length, videos: items.filter((item) => item.source_type === "youtube").length }), [items])

  // REPOSITORY_SHARING_V1`,
    `  const openPublicAccess = async () => {
    setPublicAccessOpen(true)
    setPublicAccessError("")
    setPublicAccessCopied(false)
    if (publicAccessUrl) return
    setPublicAccessLoading(true)
    try {
      const response = await fetch("/api/repository/public-access/admin-link", { method: "POST" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "No fue posible crear el acceso público.")
      setPublicAccessUrl(data.publicUrl)
    } catch (caught) {
      setPublicAccessError(caught instanceof Error ? caught.message : "No fue posible crear el acceso público.")
    } finally {
      setPublicAccessLoading(false)
    }
  }

  const copyPublicAccessUrl = async () => {
    if (!publicAccessUrl) return
    try {
      await navigator.clipboard.writeText(publicAccessUrl)
      setPublicAccessCopied(true)
      window.setTimeout(() => setPublicAccessCopied(false), 1800)
    } catch {
      setPublicAccessError("No fue posible copiar el enlace. Selecciónalo manualmente.")
    }
  }

  const counts = useMemo(() => ({ files: items.filter((item) => item.source_type === "file").length, videos: items.filter((item) => item.source_type === "youtube").length }), [items])

  // REPOSITORY_SHARING_V1
  // ${MARKER}`,
    "funciones del acceso público",
  )

  source = replaceRequired(
    source,
    `          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/biblioteca"`,
    `          <div className="flex items-center gap-1 sm:gap-2">
            {isRepositoryAdmin && (
              <button type="button" onClick={() => void openPublicAccess()} className="hidden items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-black text-sky-700 transition hover:bg-sky-100 sm:flex">
                <Globe2 size={16} /> Compartir a público
              </button>
            )}
            <Link href="/biblioteca"`,
    "botón Compartir a público",
  )

  source = replaceRequired(
    source,
    `      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={onCreated} userId={userId} />`,
    `      {publicAccessOpen && isRepositoryAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-400/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="repository-public-access-title">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl shadow-blue-200/60">
            <div className="flex items-start justify-between gap-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 via-blue-50 to-violet-50 px-6 py-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-sky-700"><ShieldCheck size={17} /> Solo administrador</div>
                <h2 id="repository-public-access-title" className="mt-2 text-xl font-black text-slate-900">Compartir Nube EduAI a público</h2>
                <p className="mt-1 text-sm text-slate-500">Crea un enlace de ingreso sin registro para esta sección.</p>
              </div>
              <button type="button" onClick={() => setPublicAccessOpen(false)} className="rounded-xl bg-white p-2 text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm leading-6 text-slate-700">
                Cualquier persona que tenga este enlace podrá entrar únicamente a Nube EduAI sin crear una cuenta. Podrá consultar, subir, descargar y compartir material educativo.
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Este enlace funciona como una llave pública y no tiene vencimiento. Compártelo solo con comunidades educativas de confianza.
              </div>

              {publicAccessLoading ? (
                <div className="flex min-h-24 items-center justify-center gap-3 text-sm font-black text-sky-700"><Loader2 size={20} className="animate-spin" /> Preparando acceso público…</div>
              ) : publicAccessError ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" />{publicAccessError}</div>
              ) : publicAccessUrl ? (
                <div className="space-y-4">
                  <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Enlace de ingreso público</span><input readOnly value={publicAccessUrl} onFocus={(event) => event.currentTarget.select()} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" /></label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => void copyPublicAccessUrl()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700">{publicAccessCopied ? <Check size={17} /> : <Copy size={17} />}{publicAccessCopied ? "Enlace copiado" : "Copiar enlace público"}</button>
                    <a href={publicAccessUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-black text-sky-700 transition hover:bg-sky-50"><ExternalLink size={17} /> Abrir acceso público</a>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={onCreated} userId={userId} />`,
    "diálogo del acceso público",
  )

  writeFileSync(PAGE, source)
}

const verified = readFileSync(PAGE, "utf8")
for (const required of [
  MARKER,
  "Compartir a público",
  "Solo administrador",
  "/api/repository/public-access/admin-link",
  "sin crear una cuenta",
  "consultar, subir, descargar y compartir",
  "Abrir acceso público",
]) {
  if (!verified.includes(required)) throw new Error(`[repository-public-access] Falta ${required}`)
}

console.log("[repository-public-access] acceso público exclusivo del administrador aplicado")
