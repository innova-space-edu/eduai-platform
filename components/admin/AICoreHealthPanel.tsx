"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, CircleAlert, Database, RefreshCw, ServerCog, Sparkles } from "lucide-react"

type HealthResponse = {
  generatedAt: string
  ready: boolean
  configuration: {
    google: {
      text: boolean
      image: boolean
      video: boolean
      sharedKey: boolean
      dedicatedTextKey: boolean
      dedicatedImageKey: boolean
      dedicatedVideoKey: boolean
      textModel: string
      liteModel: string
      embeddingModel: string
      imageModel: string
      videoModel: string
    }
    groq: { configured: boolean }
    openrouter: { configured: boolean }
    together: { configured: boolean }
    cerebras: { configured: boolean }
    redis: { configured: boolean }
    research: { tavily: boolean; firecrawl: boolean; googleGrounding: boolean }
    video: { google: boolean; fallback: boolean; cronSecret: boolean; providerOrder: string }
  }
  supabase: {
    configured: boolean
    serviceRoleConfigured: boolean
    projectRef: string | null
    tables: Array<{ table: string; available: boolean; error?: string }>
    assetBucket: { available: boolean; error?: string }
  }
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <CircleAlert className="h-4 w-4 text-amber-300" />}
      <span className={ok ? "text-emerald-100" : "text-amber-100"}>{label}</span>
    </div>
  )
}

export default function AICoreHealthPanel() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [testingGoogle, setTestingGoogle] = useState(false)
  const [googleResult, setGoogleResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/ai-core/health", { cache: "no-store" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "No fue posible revisar AI Core")
      setData(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible revisar AI Core")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const missingTables = useMemo(
    () => data?.supabase.tables.filter(item => !item.available) || [],
    [data],
  )

  const testGoogle = async () => {
    setTestingGoogle(true)
    setGoogleResult(null)
    try {
      const response = await fetch("/api/admin/ai-core/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "Google no respondió")
      setGoogleResult(`Google ${body.status} · ${body.model || "modelo"} · ${body.latencyMs ?? 0} ms`)
    } catch (caught) {
      setGoogleResult(caught instanceof Error ? caught.message : "La prueba de Google falló")
    } finally {
      setTestingGoogle(false)
    }
  }

  return (
    <section className="rounded-[28px] border border-cyan-400/20 bg-cyan-500/[0.07] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Infraestructura</p>
          <h2 className="mt-2 text-xl font-black text-white">Estado de EduAI AI Core</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
            Verifica Vercel, Supabase, migraciones, reutilización de assets y proveedores sin mostrar ninguna API key.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
      ) : null}

      {loading && !data ? <p className="mt-5 text-sm text-slate-400">Comprobando infraestructura…</p> : null}

      {data ? (
        <div className="mt-5 space-y-4">
          <div className={`rounded-2xl border p-4 ${data.ready ? "border-emerald-400/25 bg-emerald-500/10" : "border-amber-400/25 bg-amber-500/10"}`}>
            <div className="flex items-center gap-3">
              {data.ready ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <CircleAlert className="h-5 w-5 text-amber-300" />}
              <div>
                <p className="font-black">{data.ready ? "AI Core listo" : "AI Core requiere configuración"}</p>
                <p className="mt-1 text-xs text-slate-300">Diagnóstico: {new Date(data.generatedAt).toLocaleString("es-CL")}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-cyan-200"><Database className="h-4 w-4" /><h3 className="font-black">Supabase</h3></div>
              <div className="mt-3 space-y-2">
                <Status ok={data.supabase.configured} label="URL + clave pública" />
                <Status ok={data.supabase.serviceRoleConfigured} label="Service role servidor" />
                <Status ok={data.supabase.assetBucket.available} label="Bucket eduai-assets" />
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Project ref usado por Vercel</p>
                <code className="mt-1 block break-all text-sm font-bold text-cyan-100">{data.supabase.projectRef || "No configurado"}</code>
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-violet-200"><Sparkles className="h-4 w-4" /><h3 className="font-black">Google AI</h3></div>
              <div className="mt-3 space-y-2">
                <Status ok={data.configuration.google.text} label="Texto / Gateway" />
                <Status ok={data.configuration.google.image} label="Imagen" />
                <Status ok={data.configuration.google.video} label="Video" />
              </div>
              <div className="mt-4 space-y-1 text-xs text-slate-400">
                <p>Texto: {data.configuration.google.textModel}</p>
                <p>Embeddings: {data.configuration.google.embeddingModel}</p>
                <p>Imagen: {data.configuration.google.imageModel}</p>
                <p>Video: {data.configuration.google.videoModel}</p>
              </div>
              <button
                type="button"
                onClick={() => void testGoogle()}
                disabled={testingGoogle || !data.configuration.google.text}
                className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-100 hover:bg-violet-500/20 disabled:opacity-40"
              >
                {testingGoogle ? "Probando…" : "Probar Google"}
              </button>
              {googleResult ? <p className="mt-2 text-xs text-slate-300">{googleResult}</p> : null}
            </article>

            <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-blue-200"><ServerCog className="h-4 w-4" /><h3 className="font-black">Servicios</h3></div>
              <div className="mt-3 space-y-2">
                <Status ok={data.configuration.groq.configured} label="Groq" />
                <Status ok={data.configuration.openrouter.configured} label="OpenRouter" />
                <Status ok={data.configuration.redis.configured} label="Redis / Upstash" />
                <Status ok={data.configuration.video.cronSecret} label="Cron de video" />
              </div>
              <p className="mt-4 text-xs text-slate-400">Video order: {data.configuration.video.providerOrder}</p>
            </article>
          </div>

          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-white">Migraciones y tablas requeridas</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${missingTables.length ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/15 text-emerald-200"}`}>
                {missingTables.length ? `${missingTables.length} pendientes` : "Todas disponibles"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.supabase.tables.map(item => (
                <div key={item.table} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  {item.available ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : <CircleAlert className="h-4 w-4 shrink-0 text-amber-300" />}
                  <span className="truncate text-xs font-bold text-slate-200" title={item.error || item.table}>{item.table}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}
