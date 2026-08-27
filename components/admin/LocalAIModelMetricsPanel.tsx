"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, BrainCircuit, Gauge, Mic, RefreshCw } from "lucide-react"
import {
  LOCAL_AI_TELEMETRY_EVENT,
  readLocalAIEvents,
  type LocalAIEvent,
} from "@/lib/ai/local/litert-telemetry"

type ModelSummary = {
  modelId: string
  events: number
  medianMs: number
  p95Ms: number
  backend: string
  runtimeReuseRate: number
  modelReuseRate: number
  latestAt: string
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

function summarizeModel(modelId: string, events: LocalAIEvent[]): ModelSummary {
  const successful = events.filter(event => event.success && event.modelId === modelId)
  const latencies = successful
    .map(event => event.endToEndMs ?? event.latencyMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0)
  const backends = new Map<string, number>()
  successful.forEach(event => {
    if (!event.backend) return
    backends.set(event.backend, (backends.get(event.backend) || 0) + 1)
  })
  const backend = [...backends.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—"
  const runtimeEligible = successful.filter(event => typeof event.runtimeReused === "boolean")
  const modelEligible = successful.filter(event => typeof event.modelReused === "boolean")
  return {
    modelId,
    events: successful.length,
    medianMs: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    backend,
    runtimeReuseRate: runtimeEligible.length ? runtimeEligible.filter(event => event.runtimeReused).length / runtimeEligible.length * 100 : 0,
    modelReuseRate: modelEligible.length ? modelEligible.filter(event => event.modelReused).length / modelEligible.length * 100 : 0,
    latestAt: successful[0]?.createdAt || "",
  }
}

function formatLatency(modelId: string, ms: number) {
  if (!Number.isFinite(ms)) return "—"
  if (modelId.includes("whisper") || ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)} s`
  return `${ms.toFixed(ms < 10 ? 1 : 0)} ms`
}

function modelLabel(modelId: string) {
  if (modelId === "whisper-tiny-int8") return "Whisper Tiny INT8"
  if (modelId === "mobilenet-v3-small-fp32") return "MobileNet V3 Small FP32"
  if (modelId === "mobilenet-v3-small-int8") return "MobileNet V3 Small INT8"
  return modelId
}

export default function LocalAIModelMetricsPanel() {
  const [events, setEvents] = useState<LocalAIEvent[]>([])

  function refresh() {
    setEvents(readLocalAIEvents())
  }

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener(LOCAL_AI_TELEMETRY_EVENT, handler as EventListener)
    return () => window.removeEventListener(LOCAL_AI_TELEMETRY_EVENT, handler as EventListener)
  }, [])

  const summaries = useMemo(() => {
    const ids = [...new Set(events.filter(event => event.success && event.modelId).map(event => event.modelId as string))]
    return ids
      .map(id => summarizeModel(id, events))
      .filter(summary => summary.events > 0)
      .sort((a, b) => Date.parse(b.latestAt || "1970-01-01") - Date.parse(a.latestAt || "1970-01-01"))
  }, [events])

  return (
    <section className="overflow-hidden rounded-[28px] border border-cyan-400/15 bg-[#03121a] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            <Activity className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">Local AI · por modelo</p>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Latencia comparable por workload</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Evita mezclar modelos de milisegundos con ASR de varios segundos. Cada tarjeta usa solamente eventos locales del mismo modelo.</p>
        </div>
        <button onClick={refresh} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#07111f] px-4 py-2 text-xs font-black text-slate-300 hover:bg-[#0b1727]"><RefreshCw className="h-3.5 w-3.5" /> Actualizar</button>
      </div>

      {summaries.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {summaries.map(summary => {
            const isWhisper = summary.modelId.includes("whisper")
            const Icon = isWhisper ? Mic : BrainCircuit
            return (
              <article key={summary.modelId} className="rounded-[24px] border border-white/10 bg-[#06101d] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-cyan-400/15 bg-cyan-950/25 text-cyan-300"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0"><h3 className="truncate text-sm font-black text-white">{modelLabel(summary.modelId)}</h3><p className="truncate text-[10px] text-slate-500">{summary.modelId}</p></div>
                  </div>
                  <span className="rounded-full border border-emerald-400/15 bg-emerald-950/25 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-200">{summary.backend}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/5 bg-black/15 p-3"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">E2E mediana</p><p className="mt-1 text-xl font-black text-white">{formatLatency(summary.modelId, summary.medianMs)}</p></div>
                  <div className="rounded-2xl border border-white/5 bg-black/15 p-3"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">E2E P95</p><p className="mt-1 text-xl font-black text-white">{formatLatency(summary.modelId, summary.p95Ms)}</p></div>
                  <div className="rounded-2xl border border-white/5 bg-black/15 p-3"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">Runtime reuse</p><p className="mt-1 text-sm font-black text-emerald-200">{summary.runtimeReuseRate.toFixed(0)}%</p></div>
                  <div className="rounded-2xl border border-white/5 bg-black/15 p-3"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">Model pool</p><p className="mt-1 text-sm font-black text-cyan-200">{summary.modelReuseRate.toFixed(0)}%</p></div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>{summary.events} eventos</span><span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" /> misma escala por modelo</span></div>
              </article>
            )
          })}
        </div>
      ) : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Ejecuta una inferencia o benchmark local para crear métricas por modelo.</div>}
    </section>
  )
}
