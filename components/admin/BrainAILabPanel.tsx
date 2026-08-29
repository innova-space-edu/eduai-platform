"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  AudioLines,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Cloud,
  Cpu,
  Database,
  Gauge,
  ImageIcon,
  Layers3,
  Play,
  Route,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  Wrench,
} from "lucide-react"
import { BRAIN_AI_CAPABILITIES } from "@/lib/brain-ai/capabilities"
import { runBrainAIShadow } from "@/lib/brain-ai/brain-core"
import { clearBrainAITraceTelemetry, getBrainAITraceSummary, recordBrainAITrace } from "@/lib/brain-ai/telemetry"
import type {
  BrainAIBrowserSnapshot,
  BrainAICapability,
  BrainAIModality,
  BrainAIProductionStage,
  BrainAITrace,
  BrainAITraceSummary,
} from "@/lib/brain-ai/types"

const MODALITIES: Array<{ id: BrainAIModality; label: string; icon: typeof Sparkles }> = [
  { id: "text", label: "Texto", icon: Sparkles },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "image", label: "Imagen", icon: ImageIcon },
  { id: "video", label: "Video", icon: Video },
  { id: "tool", label: "Tools", icon: Wrench },
]

const REGIONS: Array<{ id: BrainAICapability["region"]; label: string }> = [
  { id: "brain", label: "Brain Core" },
  { id: "memory", label: "Memory" },
  { id: "text", label: "Text" },
  { id: "audio", label: "Audio" },
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "router", label: "Router" },
  { id: "tools", label: "Tools" },
  { id: "multimodal", label: "Multimodal" },
]

const EMPTY_SUMMARY: BrainAITraceSummary = {
  total: 0,
  fastMemory: 0,
  standardReasoning: 0,
  deepCognition: 0,
  multimodal: 0,
  lastIntent: null,
  lastRoute: null,
  lastRunAt: null,
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

function stageTone(stage: BrainAIProductionStage) {
  if (stage === "PRODUCTION_READY" || stage === "VALIDATED") return "border-emerald-400/20 bg-emerald-950/30 text-emerald-200"
  if (stage === "VALIDATING") return "border-cyan-400/20 bg-cyan-950/30 text-cyan-200"
  if (stage === "CANDIDATE") return "border-amber-400/20 bg-amber-950/25 text-amber-200"
  return "border-violet-400/20 bg-violet-950/25 text-violet-200"
}

function capabilityTone(state: BrainAICapability["state"]) {
  if (state === "ready") return "border-emerald-400/15 bg-emerald-950/20 text-emerald-200"
  if (state === "candidate") return "border-amber-400/15 bg-amber-950/20 text-amber-200"
  if (state === "blocked") return "border-red-400/15 bg-red-950/20 text-red-200"
  return "border-violet-400/15 bg-violet-950/20 text-violet-200"
}

function localityIcon(locality: BrainAICapability["locality"]) {
  return locality === "cloud" ? Cloud : locality === "local" ? Cpu : Layers3
}

function nodeTone(status: BrainAITrace["nodes"][number]["status"]) {
  if (status === "success") return "border-emerald-400/25 bg-emerald-950/30 text-emerald-100"
  if (status === "warning") return "border-amber-400/25 bg-amber-950/25 text-amber-100"
  if (status === "blocked") return "border-red-400/25 bg-red-950/25 text-red-100"
  if (status === "planned" || status === "running") return "border-cyan-400/25 bg-cyan-950/25 text-cyan-100"
  return "border-white/10 bg-slate-950/60 text-slate-400"
}

function browserSnapshot(): BrainAIBrowserSnapshot {
  if (typeof window === "undefined") {
    return { webgpu: false, webnn: false, wasm: false, cacheStorage: false, microphone: false, mediaRecorder: false, speechSynthesis: false, hardwareConcurrency: 0, deviceMemoryGB: null }
  }
  const nav = navigator as Navigator & { gpu?: unknown; ml?: unknown; deviceMemory?: number }
  return {
    webgpu: Boolean(nav.gpu),
    webnn: Boolean(nav.ml),
    wasm: typeof WebAssembly !== "undefined",
    cacheStorage: "caches" in window,
    microphone: Boolean(nav.mediaDevices?.getUserMedia),
    mediaRecorder: typeof MediaRecorder !== "undefined",
    speechSynthesis: "speechSynthesis" in window,
    hardwareConcurrency: nav.hardwareConcurrency || 0,
    deviceMemoryGB: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
  }
}

export default function BrainAILabPanel() {
  const [input, setInput] = useState("Escucha esta clase y crea una evaluación de 10 preguntas alineada con el contenido.")
  const [modalities, setModalities] = useState<BrainAIModality[]>(["text", "audio"])
  const [trace, setTrace] = useState<BrainAITrace | null>(null)
  const [summary, setSummary] = useState<BrainAITraceSummary>(EMPTY_SUMMARY)
  const [browser, setBrowser] = useState<BrainAIBrowserSnapshot | null>(null)

  useEffect(() => {
    setBrowser(browserSnapshot())
    const refresh = () => setSummary(getBrainAITraceSummary())
    refresh()
    window.addEventListener("eduai:brain-ai-shadow-trace", refresh)
    return () => window.removeEventListener("eduai:brain-ai-shadow-trace", refresh)
  }, [])

  const grouped = useMemo(() => REGIONS.map(region => ({
    ...region,
    capabilities: BRAIN_AI_CAPABILITIES.filter(capability => capability.region === region.id),
  })).filter(region => region.capabilities.length), [])

  function toggleModality(id: BrainAIModality) {
    setModalities(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  function runShadow() {
    const next = runBrainAIShadow({ input, modalities: modalities.length ? modalities : ["text"], shadowMode: true })
    setTrace(next)
    recordBrainAITrace(next)
    setSummary(getBrainAITraceSummary())
  }

  function clearTelemetry() {
    clearBrainAITraceTelemetry()
    setSummary(EMPTY_SUMMARY)
  }

  return (
    <section className="overflow-hidden rounded-[30px] border border-fuchsia-400/15 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.10),transparent_32%),linear-gradient(180deg,rgba(8,17,31,0.99),rgba(4,10,20,0.99))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.38)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200"><BrainCircuit className="h-4 w-4" /> Brain AI v5</span>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-950/30 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-cyan-200">Shadow Mode</span>
            <span className="rounded-full border border-emerald-400/15 bg-emerald-950/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-emerald-200">No prompt storage</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Cognitive OS · laboratorio multimodal</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Brain AI observa la señal, detecta intención, decide memoria, construye un plan, selecciona rutas cognitivas y evalúa riesgos antes de ejecutar modelos o tools. En esta fase compara decisiones sin sustituir todavía el flujo productivo de EduAI.</p>
        </div>
        <div className="grid min-w-[260px] grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5"><span className="text-slate-600">Shadow traces</span><p className="mt-1 text-lg font-black text-white">{summary.total}</p></div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5"><span className="text-slate-600">Multimodal</span><p className="mt-1 text-lg font-black text-white">{summary.multimodal}</p></div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-fuchsia-300" /><h3 className="text-sm font-black text-white">Signal Gateway</h3></div>
          <textarea value={input} onChange={event => setInput(event.target.value)} rows={5} className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm leading-6 text-slate-200 outline-none transition focus:border-fuchsia-400/30" placeholder="Escribe una tarea para observar cómo Brain AI la enruta…" />
          <div className="mt-3 flex flex-wrap gap-2">{MODALITIES.map(({ id, label, icon: Icon }) => {
            const selected = modalities.includes(id)
            return <button key={id} type="button" onClick={() => toggleModality(id)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black transition ${selected ? "border-fuchsia-400/25 bg-fuchsia-950/30 text-fuchsia-100" : "border-white/10 bg-black/20 text-slate-500 hover:text-slate-300"}`}><Icon className="h-3.5 w-3.5" />{label}</button>
          })}</div>
          <button type="button" onClick={runShadow} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-950/30 px-4 py-3 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-950/45"><Play className="h-4 w-4" />Ejecutar Brain AI · Shadow</button>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><p className="text-[9px] text-slate-600">FAST_MEMORY</p><p className="mt-1 text-sm font-black text-emerald-200">{summary.fastMemory}</p></div>
            <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><p className="text-[9px] text-slate-600">STANDARD</p><p className="mt-1 text-sm font-black text-cyan-200">{summary.standardReasoning}</p></div>
            <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><p className="text-[9px] text-slate-600">DEEP</p><p className="mt-1 text-sm font-black text-violet-200">{summary.deepCognition}</p></div>
            <button type="button" onClick={clearTelemetry} className="rounded-xl border border-red-400/10 bg-red-950/15 p-2.5 text-left text-[9px] font-black text-red-200/80"><Trash2 className="mb-1 h-3.5 w-3.5" />Limpiar trazas</button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-black text-white">Cognitive Trace</h3></div>{trace ? <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${stageTone(trace.productionStage)}`}>{trace.productionStage}</span> : null}</div>
          {!trace ? <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center"><BrainCircuit className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-3 text-xs font-black text-slate-400">Ejecuta una señal para visualizar el cerebro.</p><p className="mt-1 text-[10px] text-slate-600">No se llamará a modelos ni se modificará memoria en Shadow Mode.</p></div> : <>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><span className="text-[9px] text-slate-600">Intent</span><p className="mt-1 break-words text-[11px] font-black text-white">{trace.intent}</p></div>
              <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><span className="text-[9px] text-slate-600">Route</span><p className="mt-1 break-words text-[11px] font-black text-cyan-200">{trace.route}</p></div>
              <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><span className="text-[9px] text-slate-600">Complexity</span><p className="mt-1 text-[11px] font-black text-violet-200">{percent(trace.complexity)}</p></div>
              <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><span className="text-[9px] text-slate-600">Locality</span><p className="mt-1 text-[11px] font-black text-emerald-200">{trace.estimatedLocality} · {trace.expectedLatencyClass}</p></div>
            </div>
            <div className="mt-3 rounded-xl border border-fuchsia-400/10 bg-fuchsia-950/10 p-3"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-fuchsia-200">Goal</p><p className="mt-1 text-xs leading-5 text-slate-300">{trace.goal}</p></div>
          </>}
        </div>
      </div>

      {trace ? <>
        <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center gap-2"><Route className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-black text-white">Grafo de activación</h3></div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">{trace.nodes.map((node, index) => <div key={node.id} className="flex shrink-0 items-center gap-2"><div className={`w-[150px] rounded-xl border p-3 ${nodeTone(node.status)}`}><p className="text-[9px] font-black uppercase tracking-[0.12em] opacity-60">{node.region}</p><p className="mt-1 text-[11px] font-black">{node.label}</p><p className="mt-1 line-clamp-2 text-[9px] leading-4 opacity-70">{node.detail}</p></div>{index < trace.nodes.length - 1 ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-700" /> : null}</div>)}</div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-center gap-2"><Database className="h-4 w-4 text-emerald-300" /><h3 className="text-sm font-black text-white">Memory Controller</h3></div>
            <div className="mt-3 flex flex-wrap gap-1.5">{trace.memoryPolicy.read.map(memory => <span key={memory} className="rounded-lg border border-emerald-400/10 bg-emerald-950/20 px-2 py-1 text-[9px] font-black text-emerald-200">READ · {memory}</span>)}</div>
            <p className="mt-3 text-[10px] leading-5 text-slate-500">{trace.memoryPolicy.reason}</p>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-white/5 bg-black/20 p-2.5"><span className="text-[10px] text-slate-500">Memory write decision</span><span className="text-[10px] font-black text-amber-200">{trace.memoryPolicy.decision}</span></div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-black text-white">World Model · predicciones</h3></div>
            <div className="mt-3 space-y-2">{trace.predictions.map(prediction => <div key={prediction.id} className="rounded-xl border border-white/5 bg-black/20 p-3"><div className="flex items-start justify-between gap-3"><p className="text-[10px] font-black text-slate-200">{prediction.label}</p><span className="text-[9px] font-black text-violet-200">{percent(prediction.probability)}</span></div><p className="mt-1 text-[9px] leading-4 text-slate-600">{prediction.mitigation}</p></div>)}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-sky-300" /><h3 className="text-sm font-black text-white">Execution Plan</h3></div>
            <div className="mt-3 space-y-2">{trace.plan.map(step => <div key={step.id} className="grid grid-cols-[28px_1fr_auto] items-start gap-3 rounded-xl border border-white/5 bg-black/20 p-3"><span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-slate-950 text-[10px] font-black text-slate-300">{step.order}</span><div><p className="text-[10px] font-black text-slate-200">{step.label}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{step.detail}</p></div><span className="rounded-lg border border-cyan-400/10 bg-cyan-950/15 px-2 py-1 text-[8px] font-black text-cyan-200">{step.route}</span></div>)}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-amber-300" /><h3 className="text-sm font-black text-white">Production Gate</h3></div>
            <div className="mt-3 space-y-2">{trace.gates.map(gate => <div key={gate.id} className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/20 p-2.5">{gate.passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />}<div><p className="text-[10px] font-black text-slate-200">{gate.label}</p><p className="mt-0.5 text-[9px] leading-4 text-slate-600">{gate.detail}</p></div></div>)}</div>
          </div>
        </div>
      </> : null}

      <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-fuchsia-300" /><h3 className="text-sm font-black text-white">Capability Registry · multimodal</h3></div><p className="text-[9px] text-slate-600">ready → candidate → validating → production ready</p></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{grouped.flatMap(region => region.capabilities.map(capability => {
          const LocalityIcon = localityIcon(capability.locality)
          return <article key={capability.id} className="rounded-2xl border border-white/8 bg-black/20 p-3.5"><div className="flex items-start justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-600">{region.label}</p><h4 className="mt-1 text-[11px] font-black text-white">{capability.label}</h4></div><span className={`rounded-lg border px-2 py-1 text-[8px] font-black ${capabilityTone(capability.state)}`}>{capability.state}</span></div><p className="mt-2 text-[9px] leading-4 text-slate-500">{capability.description}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1 text-[8px] font-black text-slate-500"><LocalityIcon className="h-3 w-3" />{capability.locality}</span><span className={`rounded-lg border px-2 py-1 text-[8px] font-black ${stageTone(capability.productionStage)}`}>{capability.productionStage}</span></div></article>
        }))}</div>
      </div>

      <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
        <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-emerald-300" /><h3 className="text-sm font-black text-white">Runtime del navegador</h3></div>
        {!browser ? <p className="mt-3 text-xs text-slate-600">Detectando dispositivo…</p> : <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{[
          ["WebGPU", browser.webgpu], ["WebNN", browser.webnn], ["WASM", browser.wasm], ["Cache", browser.cacheStorage],
          ["Mic", browser.microphone], ["Recorder", browser.mediaRecorder], ["TTS", browser.speechSynthesis], ["CPU", `${browser.hardwareConcurrency}t`],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-white/5 bg-black/20 p-2.5"><p className="text-[9px] text-slate-600">{String(label)}</p><div className="mt-1 flex items-center gap-1.5">{typeof value === "boolean" ? value ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Circle className="h-3.5 w-3.5 text-slate-700" /> : null}<span className={`text-[10px] font-black ${value ? "text-slate-200" : "text-slate-600"}`}>{typeof value === "boolean" ? value ? "Sí" : "No" : value}</span></div></div>)}</div>}
      </div>
    </section>
  )
}
