"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music2,
  RefreshCw,
  Search,
  Sparkles,
  Video,
  X,
} from "lucide-react"

type AIAsset = {
  id: string
  asset_type: string
  title: string | null
  mime_type: string | null
  text_content: string | null
  content_json: Record<string, unknown> | null
  source_module: string | null
  version: number
  created_at: string
  access_url: string | null
  metadata?: Record<string, unknown> | null
}

type Props = {
  open: boolean
  onClose: () => void
}

const TYPES = [
  { value: "", label: "Todos" },
  { value: "image", label: "Imágenes" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "text", label: "Texto" },
  { value: "document", label: "Documentos" },
]

function iconFor(asset: AIAsset) {
  const type = asset.asset_type.toLowerCase()
  if (type.includes("image")) return <ImageIcon size={18} />
  if (type.includes("video")) return <Video size={18} />
  if (type.includes("audio") || type.includes("music")) return <Music2 size={18} />
  return <FileText size={18} />
}

function typeMatches(asset: AIAsset, type: string) {
  if (!type) return true
  const value = asset.asset_type.toLowerCase()
  if (type === "document") return value.includes("document") || value.includes("pdf") || value.includes("presentation") || value.includes("worksheet")
  return value.includes(type)
}

function prettyModule(value: string | null) {
  if (!value) return "EduAI"
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function AIAssetLibraryModal({ open, onClose }: Props) {
  const [assets, setAssets] = useState<AIAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [type, setType] = useState("")
  const [copied, setCopied] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/assets?limit=100", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudieron cargar los recursos IA.")
      setAssets(Array.isArray(payload?.assets) ? payload.assets : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los recursos IA.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return assets.filter((asset) => {
      if (!typeMatches(asset, type)) return false
      if (!query) return true
      return [asset.title, asset.asset_type, asset.source_module]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [assets, search, type])

  if (!open) return null

  const copyId = async (asset: AIAsset) => {
    try {
      await navigator.clipboard.writeText(asset.id)
      setCopied(asset.id)
      window.setTimeout(() => setCopied((current) => current === asset.id ? "" : current), 1500)
    } catch {
      setCopied("")
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-blue-600"><Sparkles size={18} /><span className="text-xs font-black uppercase tracking-[0.18em]">EduAI Reuse</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-900">Mis recursos IA reutilizables</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Resultados privados guardados una sola vez. Las solicitudes idénticas se reutilizan automáticamente; aquí puedes recuperar manualmente lo que ya generaste.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Cerrar"><X size={19} /></button>
        </header>

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título, tipo o módulo..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {TYPES.map((item) => (
              <button key={item.value} type="button" onClick={() => setType(item.value)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition ${type === item.value ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{item.label}</button>
            ))}
            <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100" aria-label="Actualizar"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Sparkles size={26} /></div>
              <h3 className="mt-4 font-bold text-slate-900">Aún no hay recursos para este filtro</h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">Cuando Image Studio, Video Studio, Creator Hub u otros módulos guarden resultados en AI Core, aparecerán aquí.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-40 items-center justify-center overflow-hidden bg-slate-100">
                    {asset.asset_type.toLowerCase().includes("image") && asset.access_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.access_url} alt={asset.title || "Recurso IA"} className="h-full w-full object-cover" />
                    ) : asset.asset_type.toLowerCase().includes("video") && asset.access_url ? (
                      <video src={asset.access_url} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : asset.asset_type.toLowerCase().includes("audio") && asset.access_url ? (
                      <div className="flex w-full flex-col items-center gap-3 px-5 text-blue-600"><Music2 size={36} /><audio src={asset.access_url} controls className="w-full" /></div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">{iconFor(asset)}</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900">{asset.title || `${asset.asset_type} sin título`}</h3>
                        <p className="mt-1 truncate text-xs text-slate-500">{prettyModule(asset.source_module)} · v{asset.version}</p>
                      </div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{iconFor(asset)}</div>
                    </div>

                    {asset.text_content && <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">{asset.text_content}</p>}
                    <p className="mt-3 text-[11px] text-slate-400">{new Date(asset.created_at).toLocaleString("es-CL")}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {asset.access_url && (
                        <a href={asset.access_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-2 text-xs font-bold text-white hover:bg-blue-700"><ExternalLink size={13} /> Abrir</a>
                      )}
                      {asset.access_url && (
                        <a href={asset.access_url} download className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Download size={13} /> Descargar</a>
                      )}
                      <button type="button" onClick={() => void copyId(asset)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Copy size={13} /> {copied === asset.id ? "Copiado" : "ID recurso"}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">Mostrando {filtered.length} de {assets.length} recursos privados. Los enlaces firmados son temporales; el archivo original permanece en Supabase Storage.</footer>
      </section>
    </div>
  )
}
