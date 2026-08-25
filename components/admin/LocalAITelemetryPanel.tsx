"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, Cpu, Gauge, RefreshCw, Trash2, Zap } from "lucide-react"
import {
  LOCAL_AI_TELEMETRY_EVENT,
  clearLocalAIEvents,
  readLocalAIEvents,
  summarizeLocalAIEvents,
  type LocalAIEvent,
} from "@/lib/ai/local/litert-telemetry"

function formatMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—"
  return value < 100 ? `${value.toFixed(1)} ms` : `${Math.round(value)} ms`
}
function formatPercent(value: number) { return `${Math.round(Math.max(0, Math.min(100, value)))}%` }

export default function LocalAITelemetryPanel() {
  const [events, setEvents] = useState<LocalAIEvent[]>([])
  function refresh() { setEvents(readLocalAIEvents()) }

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener(LOCAL_AI_TELEMETRY_EVENT, handler)
    window.addEventListener("storage", handler)
    return () => { window.removeEventListener(LOCAL_AI_TELEMETRY_EVENT, handler); window.removeEventListener("storage", handler) }
  }, [])

  const summary = useMemo(() => summarizeLocalAIEvents(events), [events])
  const recent = events.slice(0, 10)
  const cards = [
    { label: "Sesiones benchmark", value: summary.benchmarkSessions, detail: "comparaciones WebGPU/WASM" },
    { label: "Comparaciones INT8", value: summary.quantizationSessions, detail: "matrices FP32/INT8" },
    { label: "Inferencias medidas", value: summary.measuredRuns, detail: "corridas de laboratorio" },
    { label: "Cuota WebGPU", value: formatPercent(summary.webgpuShare), detail: `${summary.webgpuRuns} WebGPU · ${summary.wasmRuns} WASM` },
    { label: "E2E mediana", value: formatMs(summary.medianEndToEndMs), detail: "pipeline local registrado" },
    { label: "Latencia legacy", value: formatMs(summary.medianLatencyMs), detail: "compatibilidad histórica" },
    { label: "Runtime reutilizado", value: formatPercent(summary.runtimeReuseRate), detail: "sesiones con singleton" },
    { label: "Modelo reutilizado", value: formatPercent(summary.modelReuseRate), detail: "compiled model pool" },
  ]

  return (
    <section className="rounded-[30px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(3,18,23,0.98),rgba(2,8,18,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-emerald-300"><Activity className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.22em]">Local AI telemetry · pipeline v2</p></div><h2 className="mt-2 text-2xl font-black text-white">Actividad local del navegador</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Métricas locales separadas de AI Core: runtime, modelo compilado, compute, readback y end-to-end. No se atribuyen como ahorro de API hasta que una tarea real de EduAI use la ruta local.</p></div>
        <div className="flex gap-2"><button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs font-black text-slate-300"><RefreshCw className="h-3.5 w-3.5" /> Actualizar</button>{events.length ? <button type="button" onClick={() => { clearLocalAIEvents(); setEvents([]) }} className="inline-flex items-center gap-2 rounded-xl border border-red-400/15 bg-red-950/20 px-3 py-2 text-xs font-black text-red-200"><Trash2 className="h-3.5 w-3.5" /> Limpiar</button> : null}</div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">{cards.map(card => <article key={card.label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{card.label}</p><p className="mt-2 text-xl font-black text-white">{card.value}</p><p className="mt-1 text-[10px] leading-4 text-slate-600">{card.detail}</p></article>)}</div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-white">Distribución de backends</p><p className="mt-1 text-[10px] text-slate-600">Solo corridas locales medidas</p></div><Gauge className="h-4 w-4 text-cyan-300" /></div><div className="mt-5 space-y-4">{[["WebGPU", summary.webgpuRuns, "from-cyan-400 to-emerald-400"], ["WASM / CPU", summary.wasmRuns, "from-violet-500 to-cyan-400"]].map(([label, count, gradient]) => { const numeric = Number(count); const total = Math.max(1, summary.webgpuRuns + summary.wasmRuns); return <div key={String(label)}><div className="mb-1.5 flex items-center justify-between text-[10px]"><span className="font-black text-slate-400">{label}</span><span className="font-black text-slate-200">{numeric}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-900"><div className={`h-full rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${(numeric / total) * 100}%` }} /></div></div> })}</div><div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-3 text-[10px] leading-5 text-slate-500"><p className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5 text-emerald-300" /> Los benchmarks son pruebas técnicas; la reutilización de modelo corresponde al pool compilado de esta sesión.</p></div></article>

        <article className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><p className="text-xs font-black text-white">Eventos recientes</p><p className="mt-1 text-[10px] text-slate-600">Hasta 250 eventos locales en este navegador</p></div><Zap className="h-4 w-4 text-emerald-300" /></div>{recent.length ? <div className="divide-y divide-white/5">{recent.map(event => <div key={event.id} className="grid gap-2 px-4 py-3 text-[10px] sm:grid-cols-[110px_1fr_80px_90px_90px]"><span className="font-black uppercase tracking-wider text-slate-500">{event.kind}</span><span className="truncate font-bold text-slate-300">{event.modelId || event.note || "LiteRT"}</span><span className="font-black text-cyan-200">{event.backend ? event.backend.toUpperCase() : "—"}</span><span className="text-right font-black text-violet-200">{event.modelReused ? "POOL HIT" : event.runtimeReused ? "RUNTIME" : "COLD"}</span><span className="text-right font-black text-emerald-200">{typeof event.endToEndMs === "number" ? formatMs(event.endToEndMs) : event.latencyMs ? formatMs(event.latencyMs) : `${event.runCount || 0} runs`}</span></div>)}</div> : <div className="grid min-h-36 place-items-center p-6 text-center"><div><Activity className="mx-auto h-6 w-6 text-slate-700" /><p className="mt-2 text-xs font-black text-slate-400">Sin telemetría todavía</p><p className="mt-1 text-[10px] text-slate-600">Ejecuta Quantization Lab V3 o Benchmark V4.</p></div></div>}</article>
      </div>
    </section>
  )
}
