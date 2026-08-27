"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, BrainCircuit, CheckCircle2, Cpu, Gauge, HardDrive, RefreshCw, ShieldCheck } from "lucide-react"

type HardwareState = {
  webgpu: boolean
  adapter: boolean
  maxBufferSizeMb: number | null
  memoryGb: number | null
  cores: number
  loading: boolean
}

type WebGPUAdapterLike = {
  limits?: {
    maxBufferSize?: number
  }
}

type WebGPUApiLike = {
  requestAdapter: (options?: { powerPreference?: "low-power" | "high-performance" }) => Promise<WebGPUAdapterLike | null>
}

const MODELS = [
  {
    id: "qwen3-0.6b-dynamic-int4",
    label: "Qwen3 0.6B · dynamic INT4",
    size: "~328 MB",
    context: "4096",
    status: "blocked" as const,
    detail: "Artefacto LiteRT-LM disponible, pero la API JS web aún no lista Qwen3 como modelo oficialmente soportado.",
  },
  {
    id: "qwen3-0.6b-mixed-int4",
    label: "Qwen3 0.6B · mixed INT4",
    size: "~474.6 MiB",
    context: "2048",
    status: "blocked" as const,
    detail: "Candidato interesante por tamaño, pero se mantiene sin descarga automática hasta soporte web oficial.",
  },
  {
    id: "gemma-4-e2b-web",
    label: "Gemma 4 E2B Web",
    size: "~2.0 GB",
    context: "web",
    status: "supported" as const,
    detail: "Modelo listado oficialmente por LiteRT-LM JS para ejecución text-in/text-out con WebGPU.",
  },
  {
    id: "gemma-4-e4b-web",
    label: "Gemma 4 E4B Web",
    size: "~3.0 GB",
    context: "web",
    status: "supported" as const,
    detail: "Compatible con la API JS oficial, pero requiere un equipo con bastante memoria disponible.",
  },
]

function readDeviceMemory() {
  if (typeof navigator === "undefined") return null
  const value = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export default function LocalLLMReadinessPanel() {
  const [hardware, setHardware] = useState<HardwareState>({ webgpu: false, adapter: false, maxBufferSizeMb: null, memoryGb: null, cores: 0, loading: true })

  async function probe() {
    if (typeof navigator === "undefined") return
    const gpu = (navigator as Navigator & { gpu?: WebGPUApiLike }).gpu
    let adapter: WebGPUAdapterLike | null = null
    try {
      adapter = gpu ? await gpu.requestAdapter({ powerPreference: "high-performance" }) : null
    } catch {
      adapter = null
    }
    const rawMaxBuffer = adapter?.limits?.maxBufferSize
    const maxBuffer = typeof rawMaxBuffer === "number" ? rawMaxBuffer / 1024 / 1024 : null
    setHardware({
      webgpu: Boolean(gpu),
      adapter: Boolean(adapter),
      maxBufferSizeMb: maxBuffer && Number.isFinite(maxBuffer) ? maxBuffer : null,
      memoryGb: readDeviceMemory(),
      cores: navigator.hardwareConcurrency || 0,
      loading: false,
    })
  }

  useEffect(() => { void probe() }, [])

  const memoryGate = hardware.memoryGb === null ? "desconocida" : hardware.memoryGb >= 8 ? "adecuada" : hardware.memoryGb >= 4 ? "limitada" : "insuficiente"
  const qwenGate = hardware.webgpu && hardware.adapter ? "Hardware listo; falta soporte JS oficial" : "WebGPU no disponible para LLM web"

  return (
    <section className="overflow-hidden rounded-[28px] border border-violet-400/15 bg-[#0b0b1b] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.3)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-violet-300"><BrainCircuit className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.2em]">LiteRT-LM · readiness lab</p></div>
          <h2 className="mt-2 text-2xl font-black text-white">LLM local · Qwen y Gemma</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Diagnóstico previo a cualquier descarga pesada. Qwen3 permanece como candidato bloqueado hasta que la API LiteRT-LM JS lo soporte oficialmente; Gemma 4 Web queda como ruta compatible de laboratorio.</p>
        </div>
        <button onClick={() => void probe()} disabled={hardware.loading} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111127] px-4 py-2 text-xs font-black text-slate-300 hover:bg-[#171735] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${hardware.loading ? "animate-spin" : ""}`} /> Recalibrar hardware</button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-cyan-300"><Gauge className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.15em]">WebGPU</p></div><p className="mt-2 text-lg font-black text-white">{hardware.adapter ? "Adaptador listo" : hardware.webgpu ? "API presente" : "No disponible"}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-emerald-300"><Cpu className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.15em]">CPU</p></div><p className="mt-2 text-lg font-black text-white">{hardware.cores || "—"} threads</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-amber-300"><HardDrive className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.15em]">RAM navegador</p></div><p className="mt-2 text-lg font-black text-white">{hardware.memoryGb ? `~${hardware.memoryGb} GB` : "No expuesta"}</p><p className="mt-1 text-[10px] text-slate-500">Gate: {memoryGate}</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-violet-300"><ShieldCheck className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.15em]">GPU buffer</p></div><p className="mt-2 text-lg font-black text-white">{hardware.maxBufferSizeMb ? `${hardware.maxBufferSizeMb.toFixed(0)} MB` : "—"}</p><p className="mt-1 text-[10px] text-slate-500">{qwenGate}</p></div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {MODELS.map(model => {
          const supported = model.status === "supported"
          return (
            <article key={model.id} className={`rounded-[24px] border p-4 ${supported ? "border-emerald-400/15 bg-emerald-950/10" : "border-amber-400/15 bg-amber-950/10"}`}>
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-sm font-black text-white">{model.label}</h3><p className="mt-1 text-[10px] text-slate-500">{model.size} · contexto {model.context}</p></div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${supported ? "border-emerald-400/20 bg-emerald-950/25 text-emerald-200" : "border-amber-400/20 bg-amber-950/25 text-amber-200"}`}>{supported ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{supported ? "JS soportado" : "Bloqueado"}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">{model.detail}</p>
              <div className="mt-3 rounded-xl border border-white/5 bg-black/15 px-3 py-2 text-[10px] text-slate-500">Descarga automática: <strong className="text-slate-300">desactivada</strong> · Model Lab admin only</div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
