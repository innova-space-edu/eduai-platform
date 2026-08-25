"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, HardDriveDownload, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { LOCAL_AI_MODELS } from "@/lib/ai/local/litert-models"
import {
  clearLiteRTModelCache,
  getLiteRTModelCacheAnalytics,
  getLiteRTModelCacheSize,
  precacheLiteRTModel,
  type LiteRTCacheAnalytics,
} from "@/lib/ai/local/litert-model-cache"

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB"
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function LiteRTCacheAnalyticsPanel() {
  const [size, setSize] = useState({ entries: 0, bytes: 0 })
  const [analytics, setAnalytics] = useState<LiteRTCacheAnalytics>(() => ({ requests: 0, hits: 0, misses: 0, networkBytes: 0, lastSource: null, lastAccessAt: null, hitRate: 0 }))
  const [busyModel, setBusyModel] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const preloadable = useMemo(() => LOCAL_AI_MODELS.filter(model => model.runtime === "litertjs" && model.sizeMB <= 50 && model.status !== "next"), [])

  async function refresh() {
    setSize(await getLiteRTModelCacheSize())
    setAnalytics(getLiteRTModelCacheAnalytics())
  }

  useEffect(() => {
    void refresh()
    const handler = () => void refresh()
    window.addEventListener("eduai:litert-cache-analytics", handler)
    return () => window.removeEventListener("eduai:litert-cache-analytics", handler)
  }, [])

  async function preload(modelId: string) {
    const model = preloadable.find(item => item.id === modelId)
    if (!model || busyModel) return
    setBusyModel(model.id); setMessage("")
    try {
      const result = await precacheLiteRTModel(model.modelUrl)
      setMessage(`${model.name}: ${result.cacheHit ? "ya estaba en caché" : "guardado localmente"}.`)
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible precargar el modelo.")
    } finally { setBusyModel(null) }
  }

  async function clearCache() {
    await clearLiteRTModelCache()
    setMessage("Caché LiteRT limpiada.")
    await refresh()
  }

  return (
    <section className="rounded-[28px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(3,15,24,0.98),rgba(2,9,18,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-cyan-300"><HardDriveDownload className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.2em]">Cache Lab</p></div><h3 className="mt-2 text-xl font-black text-white">Caché persistente de modelos</h3><p className="mt-2 max-w-3xl text-sm text-slate-400">Mide NETWORK → CACHE HIT y permite precargar modelos pequeños para reducir la descarga de la siguiente sesión.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs font-black text-slate-300"><RefreshCw className="h-3.5 w-3.5" /> Actualizar</button><button type="button" onClick={() => void clearCache()} className="inline-flex items-center gap-2 rounded-xl border border-red-400/15 bg-red-950/20 px-3 py-2 text-xs font-black text-red-200"><Trash2 className="h-3.5 w-3.5" /> Limpiar caché</button></div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Archivos", size.entries],
          ["Almacenado", formatBytes(size.bytes)],
          ["Hit rate", `${analytics.hitRate.toFixed(0)}%`],
          ["Cache hits", analytics.hits],
          ["Red descargada", formatBytes(analytics.networkBytes)],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-white">{value}</p></div>)}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {preloadable.map(model => <article key={model.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><p className="text-[10px] font-black uppercase text-slate-600">{model.task}</p><p className="mt-1 text-sm font-black text-white">{model.name}</p><p className="mt-1 text-[10px] text-slate-500">~{model.sizeMB} MB · {model.status}</p><button type="button" onClick={() => void preload(model.id)} disabled={Boolean(busyModel)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-950/25 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-50">{busyModel === model.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Precargar</button></article>)}
      </div>
      {message ? <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">{message}</div> : null}
      <p className="mt-3 text-[10px] text-slate-600">Última fuente: {analytics.lastSource ? analytics.lastSource.toUpperCase() : "—"} · solicitudes de caché: {analytics.requests} · misses: {analytics.misses}</p>
    </section>
  )
}
