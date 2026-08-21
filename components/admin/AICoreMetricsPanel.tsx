"use client"

import { useEffect, useState } from "react"
import { Activity, Coins, Database, Gauge, Loader2, RefreshCw, Repeat2, Sparkles, Users } from "lucide-react"

type Metrics = {
  periodDays: number
  summary: {
    requests: number
    realGenerations: number
    generationsAvoided: number
    failures: number
    cacheHitRate: number
    persistentCacheHits: number
    activeUsers: number
    assetsCreated: number
    estimatedRecordedCostUsd: number
  }
  byCapability: Array<{
    capability: string
    requests: number
    generated: number
    reused: number
    failed: number
    cacheHitRate: number
    avgLatencyMs: number
  }>
  byProvider: Array<{
    provider: string
    requests: number
    generated: number
    reused: number
    failed: number
    avgLatencyMs: number
    estimatedRecordedCostUsd: number
  }>
}

function number(value: number) {
  return new Intl.NumberFormat("es-CL").format(value || 0)
}

function money(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value || 0)
}

export default function AICoreMetricsPanel() {
  const [days, setDays] = useState(30)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load(nextDays = days) {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/ai-core?days=${nextDays}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudieron cargar las métricas.")
      if (payload?.migrationRequired) throw new Error(payload?.message || "Faltan migraciones del AI Core.")
      setMetrics(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las métricas.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(days)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const cards = metrics ? [
    { label: "Solicitudes IA", value: number(metrics.summary.requests), icon: Activity },
    { label: "Generaciones reales", value: number(metrics.summary.realGenerations), icon: Sparkles },
    { label: "Generaciones evitadas", value: number(metrics.summary.generationsAvoided), icon: Repeat2 },
    { label: "Cache hit", value: `${metrics.summary.cacheHitRate}%`, icon: Gauge },
    { label: "Recursos guardados", value: number(metrics.summary.assetsCreated), icon: Database },
    { label: "Usuarios activos IA", value: number(metrics.summary.activeUsers), icon: Users },
    { label: "Hits persistentes", value: number(metrics.summary.persistentCacheHits), icon: Repeat2 },
    { label: "Costo registrado", value: money(metrics.summary.estimatedRecordedCostUsd), icon: Coins },
  ] : []

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">Observabilidad</p>
          <h2 className="mt-2 text-xl font-black text-white">Uso, reutilización y costo</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Mide cuánto trabajo realiza realmente la IA y cuánto evita EduAI gracias al Reuse Engine.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 outline-none">
            <option value={1}>24 horas</option>
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
            <option value={365}>1 año</option>
          </select>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 hover:bg-white/10" aria-label="Actualizar métricas"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 size={26} className="animate-spin text-violet-300" /></div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : metrics ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ label, value, icon: Icon }) => (
              <article key={label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-slate-400"><Icon size={15} /><span className="text-[11px] font-black uppercase tracking-[0.14em]">{label}</span></div>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
              <div className="border-b border-white/10 px-4 py-3 text-sm font-black text-white">Por capacidad</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="text-slate-500"><tr><th className="px-4 py-2">Capacidad</th><th>Solic.</th><th>Generadas</th><th>Reuso</th><th>Hit</th><th>Latencia</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {metrics.byCapability.slice(0, 12).map((row) => (
                      <tr key={row.capability} className="text-slate-300"><td className="px-4 py-2.5 font-bold text-white">{row.capability}</td><td>{row.requests}</td><td>{row.generated}</td><td>{row.reused}</td><td>{row.cacheHitRate}%</td><td>{row.avgLatencyMs} ms</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
              <div className="border-b border-white/10 px-4 py-3 text-sm font-black text-white">Por proveedor</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="text-slate-500"><tr><th className="px-4 py-2">Proveedor</th><th>Solic.</th><th>Generadas</th><th>Reuso</th><th>Latencia</th><th>Costo</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {metrics.byProvider.slice(0, 12).map((row) => (
                      <tr key={row.provider} className="text-slate-300"><td className="px-4 py-2.5 font-bold text-white">{row.provider}</td><td>{row.requests}</td><td>{row.generated}</td><td>{row.reused}</td><td>{row.avgLatencyMs} ms</td><td>{money(row.estimatedRecordedCostUsd)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <p className="text-[11px] leading-5 text-slate-500">El costo mostrado corresponde solo a llamadas que registran una estimación. “Generaciones evitadas” cuenta solicitudes servidas desde reutilización persistente.</p>
        </div>
      ) : null}
    </section>
  )
}