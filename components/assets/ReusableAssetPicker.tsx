"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, ImageIcon, Loader2, Music2, RefreshCw, Search, Video } from "lucide-react"

export type ReusableAsset = {
  id: string
  asset_type: string
  title: string | null
  mime_type: string | null
  access_url: string | null
  source_module: string | null
  source_id: string | null
  visibility: "private" | "workspace" | "shared" | "public"
  version: number
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

type Props = {
  assetType?: string
  sourceModule?: string
  selectedId?: string | null
  onSelect: (asset: ReusableAsset) => void
  className?: string
  emptyText?: string
}

function IconForType({ type }: { type: string }) {
  if (type.includes("image")) return <ImageIcon size={18} />
  if (type.includes("video")) return <Video size={18} />
  if (type.includes("audio") || type.includes("podcast") || type.includes("music")) return <Music2 size={18} />
  return <FileText size={18} />
}

function AssetPreview({ asset }: { asset: ReusableAsset }) {
  if (asset.asset_type.toLowerCase().includes("image") && asset.access_url) {
    return (
      <span className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.access_url}
          alt={asset.title || "Imagen reutilizable"}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    )
  }

  return (
    <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <IconForType type={asset.asset_type} />
    </span>
  )
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(value))
  } catch {
    return ""
  }
}

export default function ReusableAssetPicker({
  assetType,
  sourceModule,
  selectedId,
  onSelect,
  className = "",
  emptyText = "Aún no hay recursos reutilizables de este tipo.",
}: Props) {
  const [assets, setAssets] = useState<ReusableAsset[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [migrationRequired, setMigrationRequired] = useState(false)

  async function load() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ limit: "60" })
      if (assetType) params.set("type", assetType)
      if (sourceModule) params.set("source_module", sourceModule)
      const response = await fetch(`/api/assets?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || "No se pudo cargar la biblioteca")
      setAssets(Array.isArray(payload?.assets) ? payload.assets : [])
      setMigrationRequired(Boolean(payload?.migrationRequired))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la biblioteca")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [assetType, sourceModule])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return assets
    return assets.filter((asset) =>
      `${asset.title || ""} ${asset.asset_type} ${asset.source_module || ""}`.toLowerCase().includes(normalized),
    )
  }, [assets, query])

  if (migrationRequired) {
    return (
      <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 ${className}`}>
        La biblioteca reutilizable se activará cuando se apliquen las migraciones EduAI AI Core en Supabase.
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar algo que ya generaste…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          aria-label="Actualizar biblioteca"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          {emptyText}
        </div>
      )}

      <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {filtered.map((asset) => {
          const active = selectedId === asset.id
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => onSelect(asset)}
              className={`min-w-0 rounded-xl border p-3 text-left transition ${
                active
                  ? "border-violet-500 bg-violet-50 ring-1 ring-violet-400 dark:bg-violet-950/30"
                  : "border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              }`}
            >
              <div className="flex items-start gap-3">
                <AssetPreview asset={asset} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{asset.title || "Recurso sin título"}</span>
                  <span className="mt-1 block truncate text-[11px] text-slate-500">
                    {asset.asset_type} · {asset.source_module || "EduAI"}
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    v{asset.version} · {formatDate(asset.updated_at || asset.created_at)}
                  </span>
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
