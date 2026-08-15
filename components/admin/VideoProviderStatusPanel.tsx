"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, CircleAlert, RefreshCw, Video } from "lucide-react"

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

  return (
    <section className="rounded-[28px] border border-fuchsia-400/20 bg-fuchsia-500/[0.06] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-fuchsia-200">
            <Video className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">Video Router</p>
          </div>
          <h2 className="mt-2 text-xl font-black text-white">Proveedores de video</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Reutilización primero; después proveedores gratuitos/cuota y Google Veo únicamente como premium opcional.
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

      {data ? (
        <div className="mt-5 space-y-4">
          <div className={`rounded-2xl border p-4 ${data.freeConfigured ? "border-emerald-400/25 bg-emerald-500/10" : "border-amber-400/25 bg-amber-500/10"}`}>
            <div className="flex items-center gap-3">
              {data.freeConfigured ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <CircleAlert className="h-5 w-5 text-amber-300" />}
              <div>
                <p className="font-black text-white">
                  {data.freeConfigured ? "Hay un proveedor no premium configurado" : "Falta conectar un proveedor gratuito/cuota"}
                </p>
                <p className="mt-1 text-xs text-slate-300">Orden efectivo: {data.effectiveOrder.join(" → ") || "sin proveedores"}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.providers.map(provider => (
              <article key={provider.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-white">{provider.label}</h3>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{tierLabel(provider.tier)}</p>
                  </div>
                  {provider.configured
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    : <CircleAlert className="h-5 w-5 text-amber-300" />}
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-300">
                  <p>{provider.configured ? "Configurado" : "No configurado"}</p>
                  <p>Texto→video: {provider.textToVideo ? "sí" : "no"}</p>
                  <p>Imagen→video: {provider.imageToVideo ? "sí" : "no"}</p>
                  {provider.model ? <p className="break-all text-slate-400">{provider.model}</p> : null}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{provider.note}</p>
              </article>
            ))}
          </div>

          {data.recentFailures.length ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h3 className="font-black text-white">Fallos recientes clasificados</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {data.recentFailures.map((failure, index) => (
                  <div key={`${failure.provider}-${failure.at}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                    <span className="font-bold text-slate-100">{failure.provider || "sin proveedor"}</span>
                    {failure.model ? <span> · {failure.model}</span> : null}
                    <span> · {failure.category || "error"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
