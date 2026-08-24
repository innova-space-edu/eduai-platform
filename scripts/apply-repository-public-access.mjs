import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/repositorio/page.tsx"
const MARKER = "REPOSITORY_PUBLIC_ACCESS_V2"

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[repository-public-access] No se encontró ${label}`)
  return source.replace(from, to)
}

if (!existsSync(PAGE)) throw new Error(`[repository-public-access] No existe ${PAGE}`)

let source = readFileSync(PAGE, "utf8")

if (!source.includes(MARKER)) {
  source = replaceRequired(
    source,
    `  Share2,\n  Check,\n  Copy,\n  Upload,`,
    `  Share2,\n  Check,\n  Copy,\n  Globe2,\n  ShieldCheck,\n  Upload,`,
    "iconos del acceso público",
  )

  source = replaceRequired(
    source,
    `  const [shareCopied, setShareCopied] = useState(false)`,
    `  const [shareCopied, setShareCopied] = useState(false)\n  const [isRepositoryAdmin, setIsRepositoryAdmin] = useState(false)\n  const [publicAccessOpen, setPublicAccessOpen] = useState(false)\n  const [publicAccessUrl, setPublicAccessUrl] = useState("")\n  const [publicAccessLoading, setPublicAccessLoading] = useState(false)\n  const [publicAccessError, setPublicAccessError] = useState("")\n  const [publicAccessCopied, setPublicAccessCopied] = useState(false)`,
    "estados del acceso público",
  )

  source = replaceRequired(
    source,
    `  }, [loadItems, router, supabase])\n\n  const filteredItems = useMemo(() => {`,
    `  }, [loadItems, router, supabase])\n\n  useEffect(() => {\n    let cancelled = false\n    const verifyAdmin = async () => {\n      try {\n        const response = await fetch("/api/repository/public-access/admin-link", { cache: "no-store" })\n        const data = await response.json().catch(() => null)\n        if (!cancelled) {\n          const isAdmin = Boolean(response.ok && data?.isAdmin)\n          setIsRepositoryAdmin(isAdmin)\n          if (isAdmin && data?.publicUrl) setPublicAccessUrl(String(data.publicUrl))\n        }\n      } catch {\n        if (!cancelled) setIsRepositoryAdmin(false)\n      }\n    }\n    void verifyAdmin()\n    return () => { cancelled = true }\n  }, [])\n\n  const filteredItems = useMemo(() => {`,
    "verificación del administrador",
  )

  source = replaceRequired(
    source,
    `  const counts = useMemo(() => ({ files: items.filter((item) => item.source_type === "file").length, videos: items.filter((item) => item.source_type === "youtube").length }), [items])\n\n  // REPOSITORY_SHARING_V1`,
    `  const openPublicAccess = async () => {\n    setPublicAccessOpen(true)\n    setPublicAccessError("")\n    setPublicAccessCopied(false)\n    if (publicAccessUrl) return\n    setPublicAccessLoading(true)\n    try {\n      const response = await fetch("/api/repository/public-access/admin-link", { method: "POST" })\n      const data = await response.json().catch(() => null)\n      if (!response.ok) throw new Error(data?.error || "No fue posible crear el acceso público.")\n      setPublicAccessUrl(data.publicUrl)\n    } catch (caught) {\n      setPublicAccessError(caught instanceof Error ? caught.message : "No fue posible crear el acceso público.")\n    } finally {\n      setPublicAccessLoading(false)\n    }\n  }\n\n  const copyPublicAccessUrl = async () => {\n    if (!publicAccessUrl) return\n    try {\n      await navigator.clipboard.writeText(publicAccessUrl)\n      setPublicAccessCopied(true)\n      window.setTimeout(() => setPublicAccessCopied(false), 1800)\n    } catch {\n      setPublicAccessError("No fue posible copiar el enlace. Selecciónalo manualmente.")\n    }\n  }\n\n  const counts = useMemo(() => ({ files: items.filter((item) => item.source_type === "file").length, videos: items.filter((item) => item.source_type === "youtube").length }), [items])\n\n  // REPOSITORY_SHARING_V1\n  // ${MARKER}`,
    "funciones del acceso público",
  )

  source = replaceRequired(
    source,
    `          <div className="flex items-center gap-1 sm:gap-2">\n            <Link href="/biblioteca"`,
    `          <div className="flex items-center gap-1 sm:gap-2">\n            {isRepositoryAdmin && publicAccessUrl && (\n              <a href={publicAccessUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100" title="Abrir Nube EduAI pública">\n                <Globe2 size={16} /> <span className="hidden sm:inline">Nube pública</span>\n              </a>\n            )}\n            {isRepositoryAdmin && (\n              <button type="button" aria-label="Compartir a público" onClick={() => void openPublicAccess()} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-2 text-sm font-black text-sky-700 transition hover:bg-sky-100" title="Administrar enlace público">\n                <Share2 size={16} /> <span className="hidden sm:inline">{publicAccessUrl ? "Enlace público" : "Activar público"}</span>\n              </button>\n            )}\n            <Link href="/biblioteca"`,
    "botones visibles de Nube pública",
  )

  source = replaceRequired(
    source,
    `      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={onCreated} userId={userId} />`,
    `      {publicAccessOpen && isRepositoryAdmin && (\n        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-400/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="repository-public-access-title">\n          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl shadow-blue-200/60">\n            <div className="flex items-start justify-between gap-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 via-blue-50 to-violet-50 px-6 py-5">\n              <div>\n                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-sky-700"><ShieldCheck size={17} /> Solo administrador</div>\n                <h2 id="repository-public-access-title" className="mt-2 text-xl font-black text-slate-900">Acceso público de Nube EduAI</h2>\n                <p className="mt-1 text-sm text-slate-500">Abre, copia o administra el enlace de ingreso sin registro.</p>\n              </div>\n              <button type="button" onClick={() => setPublicAccessOpen(false)} className="rounded-xl bg-white p-2 text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900" aria-label="Cerrar"><X size={18} /></button>\n            </div>\n\n            <div className="space-y-5 p-6">\n              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm leading-6 text-slate-700">\n                Cualquier persona que tenga este enlace podrá entrar únicamente a Nube EduAI sin crear una cuenta. Podrá consultar, subir, descargar y compartir material educativo.\n              </div>\n              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">\n                El acceso público está activo cuando aparece el botón <strong>Nube pública</strong> en la cabecera. El enlace no tiene vencimiento mientras permanezca habilitado.\n              </div>\n\n              {publicAccessLoading ? (\n                <div className="flex min-h-24 items-center justify-center gap-3 text-sm font-black text-sky-700"><Loader2 size={20} className="animate-spin" /> Preparando acceso público…</div>\n              ) : publicAccessError ? (\n                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" />{publicAccessError}</div>\n              ) : publicAccessUrl ? (\n                <div className="space-y-4">\n                  <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Enlace de ingreso público activo</span><input readOnly value={publicAccessUrl} onFocus={(event) => event.currentTarget.select()} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" /></label>\n                  <div className="grid gap-3 sm:grid-cols-2">\n                    <button type="button" onClick={() => void copyPublicAccessUrl()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700">{publicAccessCopied ? <Check size={17} /> : <Copy size={17} />}{publicAccessCopied ? "Enlace copiado" : "Copiar enlace público"}</button>\n                    <a href={publicAccessUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"><ExternalLink size={17} /> Entrar a Nube pública</a>\n                  </div>\n                </div>\n              ) : null}\n            </div>\n          </div>\n        </div>\n      )}\n\n      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={onCreated} userId={userId} />`,
    "diálogo del acceso público",
  )

  writeFileSync(PAGE, source)
}

const verified = readFileSync(PAGE, "utf8")
for (const required of [
  MARKER,
  "Compartir a público",
  "Nube pública",
  "Activar público",
  "Solo administrador",
  "/api/repository/public-access/admin-link",
  "sin crear una cuenta",
  "consultar, subir, descargar y compartir",
  "Entrar a Nube pública",
]) {
  if (!verified.includes(required)) throw new Error(`[repository-public-access] Falta ${required}`)
}

console.log("[repository-public-access] acceso público visible, activo y administrable aplicado")
