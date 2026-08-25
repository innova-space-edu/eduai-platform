"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, CircleAlert, RefreshCw, Route, ShieldCheck, Video } from "lucide-react"

type Provider = {
  id: string
  label: string
  configured: boolean
  tier: string
  textToVideo: boolean
  imageToVideo: boolean
  model: string | null
  note: string
}

type VideoProvidersResponse = {
  generatedAt: string
  freeConfigured: boolean
  premiumConfigured: boolean
  configuredOrder: string | null
  effectiveOrder: string[]
  providers: Provider[]
  personalMarketplace: {
    enabled: boolean
    masterKeyConfigured: boolean
    credentialCount: number
    spendEventCount: number
    supportedProviders: string[]
    generationProviders: string[]
    billingOwner: string
  }
  recentFailures: Array<{
    provider: string | null
    model: string | null
    category: string | null
    at: string | null
  }>
}

function tierLabel(tier: string) {
  if (tier === "free_quota") return "Cuota gratuita"
  if (tier === "shared_free") return "Compartido / gratis"
  if (tier === "premium") return "Premium"
  return "Externo"
}

export default function VideoProviderStatusPanel() {
  const [data, setData] = useState<VideoProvidersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/ai-core/video-providers", { cache: "no-store" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "No se pudo revisar Video Router")
      setData(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo revisar Video Router")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => {
    if (!data) return null
    return {
      configured: data.providers.filter(provider => provider.configured).length,
      total: data.providers.length,
      textToVideo: data.providers.filter(provider => provider.configured && provider.textToVideo).length,
      imageToVideo: data.providers.filter(provider => provider.configured && provider.imageToVideo).length,
      failures: data.recentFailures.length,
    }
  }, [data])

  return (
    <section className="rounded-[30px] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.10),transparent_28%),rgba(88,28,135,0.08)] p-5 shadow-[0_22px_70px_rgba(88,28,135,0.12)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-fuchsia-200">
            <Video className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">Video Router</p>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Cobertura y proveedores de video</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Reutilización primero; después proveedores gratuitos/cuota. Premium Personal usa la cuenta del usuario y Google Veo queda como ruta premium opcional.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      {data && stats ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Configurados", `${stats.configured}/${stats.total}`],
              ["Texto → video", stats.textToVideo],
              ["Imagen → video", stats.imageToVideo],
              ["Ruta gratuita", data.freeConfigured ? "Lista" : "Pendiente"],
              ["Fallos recientes", stats.failures],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{label}</p>
                <p className="mt-1 text-lg font-black text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className={`rounded-2xl border p-4 ${data.freeConfigured ? "border-emerald-400/25 bg-emerald-500/10" : "border-amber-400/25 bg-amber-500/10"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {data.freeConfigured ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <CircleAlert className="h-5 w-5 text-amber-300" />}
                <div>
                  <p className="font-black text-white">
                    {data.freeConfigured ? "Hay un proveedor no premium configurado" : "Falta conectar un proveedor gratuito/cuota"}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">Orden configurado: {data.configuredOrder || "automático"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Route className="h-4 w-4 text-fuchsia-200" />
                {data.effectiveOrder.length ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {data.effectiveOrder.map((provider, index) => (
                      <span key={`${provider}-${index}`} className="inline-flex items-center gap-1.5">
                        <span className="rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 font-black text-slate-200">{provider}</span>
                        {index < data.effectiveOrder.length - 1 ? <span className="text-slate-600">→</span> : null}
                      </span>
                    ))}
                  </div>
                ) : <span className="text-slate-500">sin proveedores</span>}
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${data.personalMarketplace.masterKeyConfigured ? "border-emerald-400/25 bg-emerald-500/10" : "border-amber-400/25 bg-amber-500/10"}`}>
            <div className="flex items-start gap-3">
              <ShieldCheck className={`mt-0.5 h-5 w-5 ${data.personalMarketplace.masterKeyConfigured ? "text-emerald-300" : "text-amber-300"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-white">Premium Personal · gasto del usuario</p>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${data.personalMarketplace.masterKeyConfigured ? "border-emerald-400/15 bg-emerald-500/10 text-emerald-200" : "border-amber-400/15 bg-amber-500/10 text-amber-200"}`}>
                    {data.personalMarketplace.masterKeyConfigured ? "Bóveda lista" : "Bóveda pendiente"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  fal.ai y Replicate generan con la cuenta personal del usuario. Hugging Face permanece como catálogo/conexión beta.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">Credenciales: {data.personalMarketplace.credentialCount}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">Eventos de gasto: {data.personalMarketplace.spendEventCount}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">Cobro: usuario</span>
                </div>
                {!data.personalMarketplace.masterKeyConfigured ? (
                  <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                    Antes de producción configura EDUAI_CREDENTIALS_MASTER_KEY en Vercel. No bloquea Preview, pero la bóveda de producción debe usar una llave independiente.
                  </p>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-emerald-200">Bóveda personal lista con clave maestra dedicada.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.providers.map(provider => (
              <article key={provider.id} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${provider.configured ? "border-emerald-400/15 bg-emerald-500/[0.035]" : "border-white/10 bg-black/20"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-white">{provider.label}</h3>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{tierLabel(provider.tier)}</p>
                  </div>
                  {provider.configured
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    : <CircleAlert className="h-5 w-5 text-amber-300" />}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                  <span className={`rounded-full border px-2 py-1 font-bold ${provider.configured ? "border-emerald-400/15 bg-emerald-500/10 text-emerald-200" : "border-white/8 bg-white/[0.03] text-slate-600"}`}>{provider.configured ? "Configurado" : "No configurado"}</span>
                  <span className={`rounded-full border px-2 py-1 font-bold ${provider.textToVideo ? "border-cyan-400/15 bg-cyan-500/10 text-cyan-200" : "border-white/8 bg-white/[0.03] text-slate-600"}`}>Texto→video</span>
                  <span className={`rounded-full border px-2 py-1 font-bold ${provider.imageToVideo ? "border-violet-400/15 bg-violet-500/10 text-violet-200" : "border-white/8 bg-white/[0.03] text-slate-600"}`}>Imagen→video</span>
                </div>
                {provider.model ? <p className="mt-3 break-all font-mono text-[10px] text-slate-500">{provider.model}</p> : null}
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{provider.note}</p>
              </article>
            ))}
          </div>

          {data.recentFailures.length ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-white">Fallos recientes clasificados</h3>
                <span className="rounded-full border border-red-400/15 bg-red-500/10 px-2.5 py-1 text-[10px] font-black text-red-200">{data.recentFailures.length} eventos</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {data.recentFailures.map((failure, index) => (
                  <div key={`${failure.provider}-${failure.at}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-bold text-slate-100">{failure.provider || "sin proveedor"}</span>
                      {failure.model ? <span className="text-slate-500">· {failure.model}</span> : null}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-black text-amber-300">{failure.category || "error"}</span>
                      <span className="text-slate-600">{failure.at ? new Date(failure.at).toLocaleString("es-CL") : "sin fecha"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-500/[0.035] p-4 text-xs text-emerald-100/70">No hay fallos recientes clasificados en Video Router.</div>
          )}
        </div>
      ) : null}
    </section>
  )
}
