"use client"

import { useMemo, useRef, useState } from "react"
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Gauge,
  HardDriveDownload,
  ImageIcon,
  Laptop,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from "lucide-react"
import {
  DEFAULT_LITERT_PROBE_MODEL_ID,
  DEFAULT_LITERT_WEBNN_PROBE_MODEL_ID,
  EDUAI_LITERT_VERSION,
  LOCAL_AI_MODELS,
  getLocalAIModel,
} from "@/lib/ai/local/litert-models"
import {
  explainWebNNStatus,
  probeLiteRTCapabilities,
  type LiteRTCapabilitySnapshot,
} from "@/lib/ai/local/litert-capabilities"
import { getLiteRTRuntime } from "@/lib/ai/local/litert-runtime"
import { selectLiteRTRoute, type LiteRTRouteDecision } from "@/lib/ai/local/litert-router"
import {
  clearLiteRTModelCache,
  getCachedModelSource,
  getLiteRTModelCacheSize,
} from "@/lib/ai/local/litert-model-cache"
import { recordLocalAIEvent } from "@/lib/ai/local/litert-telemetry"

type RuntimeState = {
  capabilities: LiteRTCapabilitySnapshot
  route: LiteRTRouteDecision
  initialized: boolean
  score: number
  importMs: number
  initMs: number
  totalMs: number
  reused: boolean
  error?: string
}

type Prediction = {
  index: number
  label: string
  probability: number
}

type InferenceState = {
  status: "idle" | "loading-model" | "running" | "success" | "error"
  backend?: "webgpu" | "wasm"
  modelLoadMs?: number
  computeMs?: number
  readbackMs?: number
  endToEndMs?: number
  totalMs?: number
  outputSize?: number
  predictions?: Prediction[]
  cacheHit?: boolean
  cacheSource?: "cache" | "network" | "direct" | "memory"
  modelReused?: boolean
  error?: string
}

type WebNNTestState = {
  status: "idle" | "running" | "success" | "error"
  compileMs?: number
  endToEndMs?: number
  outputSize?: number
  cacheHit?: boolean
  error?: string
}

const IMAGENET_LABELS_URL = "https://huggingface.co/datasets/huggingface/label-files/resolve/main/imagenet-1k-id2label.json"
const IMAGE_SIZE = 224
const INPUT_SHAPE = [1, 3, IMAGE_SIZE, IMAGE_SIZE]
const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]

function formatMs(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—"
  return value < 100 ? `${value.toFixed(2)} ms` : `${Math.round(value)} ms`
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB"
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function hardwareTier(sizeMB: number) {
  if (sizeMB <= 50) return "Bajo"
  if (sizeMB <= 700) return "Medio"
  return "Alto"
}

function recommendedBackend(runtime: string, sizeMB: number) {
  if (runtime === "litert-lm") return "WebGPU"
  if (sizeMB < 5) return "WASM / WebGPU"
  return "WebGPU"
}

function softmax(values: number[]) {
  if (!values.length) return []
  const max = Math.max(...values)
  const exps = values.map(value => Math.exp(value - max))
  const sum = exps.reduce((total, value) => total + value, 0) || 1
  return exps.map(value => value / sum)
}

async function preprocessImage(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const shortest = Math.min(bitmap.width, bitmap.height)
    const cropSize = shortest * (224 / 256)
    const sx = Math.max(0, (bitmap.width - cropSize) / 2)
    const sy = Math.max(0, (bitmap.height - cropSize) / 2)
    const canvas = document.createElement("canvas")
    canvas.width = IMAGE_SIZE
    canvas.height = IMAGE_SIZE
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("El navegador no pudo crear el canvas de preprocesamiento.")
    context.drawImage(bitmap, sx, sy, cropSize, cropSize, 0, 0, IMAGE_SIZE, IMAGE_SIZE)
    const rgba = context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data
    const channelSize = IMAGE_SIZE * IMAGE_SIZE
    const output = new Float32Array(3 * channelSize)
    for (let pixel = 0; pixel < channelSize; pixel += 1) {
      const base = pixel * 4
      output[pixel] = (rgba[base] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0]
      output[channelSize + pixel] = (rgba[base + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1]
      output[channelSize * 2 + pixel] = (rgba[base + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2]
    }
    return output
  } finally {
    bitmap.close()
  }
}

async function getImagenetLabels() {
  try {
    const response = await fetch(IMAGENET_LABELS_URL, { cache: "force-cache" })
    if (!response.ok) throw new Error("No labels")
    return await response.json() as Record<string, string>
  } catch {
    return {} as Record<string, string>
  }
}

function disposeOutputs(outputs: any) {
  if (Array.isArray(outputs)) {
    for (const output of outputs) output?.delete?.()
    return
  }
  if (outputs && typeof outputs === "object") {
    for (const output of Object.values(outputs)) (output as any)?.delete?.()
  }
}

function firstOutput(outputs: any) {
  if (Array.isArray(outputs)) return outputs[0]
  if (outputs && typeof outputs === "object") return Object.values(outputs)[0] as any
  return null
}

function StatusDot({ ok, pending = false }: { ok: boolean; pending?: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${pending ? "animate-pulse bg-amber-300" : ok ? "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.85)]" : "bg-slate-600"}`} />
}

function ReadinessGauge({ score, active }: { score: number; active: boolean }) {
  const circumference = 2 * Math.PI * 52
  const offset = circumference - (circumference * score) / 100
  return (
    <div className="relative grid h-40 w-40 place-items-center">
      <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="8" />
        <circle cx="60" cy="60" r="52" fill="none" stroke={active ? "rgb(52 211 153)" : "rgb(71 85 105)"} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute text-center"><p className="text-3xl font-black text-white">{active ? score : "—"}</p><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">readiness</p></div>
    </div>
  )
}

function CapabilityRadar({ capabilities }: { capabilities: LiteRTCapabilitySnapshot | null }) {
  const values = capabilities
    ? [1, capabilities.webgpu ? 1 : 0.2, capabilities.wasm ? 1 : 0.2, capabilities.webnnContext ? 1 : capabilities.webnnApi ? 0.55 : 0.2]
    : [0.18, 0.18, 0.18, 0.18]
  const center = 80
  const radius = 54
  const points = [[center, center - radius * values[0]], [center + radius * values[1], center], [center, center + radius * values[2]], [center - radius * values[3], center]].map(point => point.join(",")).join(" ")
  return (
    <div className="relative h-44 w-full max-w-[260px]">
      <svg viewBox="0 0 160 160" className="h-full w-full">
        {[18, 36, 54].map(r => <polygon key={r} points={`${center},${center-r} ${center+r},${center} ${center},${center+r} ${center-r},${center}`} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />)}
        <line x1="80" y1="20" x2="80" y2="140" stroke="rgba(148,163,184,0.1)" /><line x1="20" y1="80" x2="140" y2="80" stroke="rgba(148,163,184,0.1)" />
        <polygon points={points} fill="rgba(34,211,238,0.18)" stroke="rgb(34 211 238)" strokeWidth="2" className="transition-all duration-1000" />
      </svg>
      <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[9px] font-bold uppercase text-slate-500">Runtime</span><span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase text-slate-500">WebGPU</span><span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase text-slate-500">WASM</span><span className="absolute left-0 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase text-slate-500">WebNN</span>
    </div>
  )
}

export default function LiteRTLocalAIPanel() {
  const [runtime, setRuntime] = useState<RuntimeState | null>(null)
  const [testing, setTesting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [inference, setInference] = useState<InferenceState>({ status: "idle" })
  const [webnnTest, setWebnnTest] = useState<WebNNTestState>({ status: "idle" })
  const [cacheStats, setCacheStats] = useState({ entries: 0, bytes: 0 })
  const litertRef = useRef<any>(null)
  const modelRef = useRef<any>(null)
  const modelBackendRef = useRef<"webgpu" | "wasm" | null>(null)

  const probeModel = getLocalAIModel(DEFAULT_LITERT_PROBE_MODEL_ID)
  const webnnProbeModel = getLocalAIModel(DEFAULT_LITERT_WEBNN_PROBE_MODEL_ID)
  const readyModels = useMemo(() => LOCAL_AI_MODELS.filter(model => model.status === "ready"), [])

  async function refreshCacheStats() {
    setCacheStats(await getLiteRTModelCacheSize())
  }

  async function initializeRuntime() {
    setTesting(true)
    const startedAt = performance.now()
    try {
      const capabilities = await probeLiteRTCapabilities()
      const lease = await getLiteRTRuntime()
      const route = selectLiteRTRoute(capabilities)
      litertRef.current = lease.litert
      const score = Math.min(100, 30 + (capabilities.webgpu ? 30 : 0) + (capabilities.wasm ? 25 : 0) + (capabilities.webnnContext ? 15 : 0))
      const next: RuntimeState = {
        capabilities,
        route,
        initialized: true,
        score,
        importMs: lease.importMs,
        initMs: lease.initMs,
        totalMs: performance.now() - startedAt,
        reused: lease.reused,
      }
      setRuntime(next)
      await refreshCacheStats()
      return next
    } catch (error) {
      const capabilities = await probeLiteRTCapabilities().catch(() => null)
      if (capabilities) {
        setRuntime({ capabilities, route: selectLiteRTRoute(capabilities), initialized: false, score: 0, importMs: 0, initMs: 0, totalMs: performance.now() - startedAt, reused: false, error: error instanceof Error ? error.message : "No fue posible iniciar LiteRT.js" })
      }
      throw error
    } finally {
      setTesting(false)
    }
  }

  async function ensureRuntime() {
    if (runtime?.initialized && litertRef.current) return runtime
    return initializeRuntime()
  }

  function handleImage(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : "")
    setInference({ status: "idle" })
  }

  async function runInference() {
    if (!imageFile || !probeModel) return
    const overallStart = performance.now()
    setInference({ status: "loading-model" })
    try {
      const activeRuntime = await ensureRuntime()
      const litert = litertRef.current
      let accelerator: "webgpu" | "wasm" = activeRuntime.route.production === "webgpu" ? "webgpu" : "wasm"
      let model = modelRef.current
      let modelLoadMs = 0
      let cacheHit = false
      let cacheSource: InferenceState["cacheSource"] = "memory"
      const modelReused = Boolean(model && modelBackendRef.current === accelerator)

      if (!modelReused) {
        const source = await getCachedModelSource(probeModel.modelUrl)
        cacheHit = source.cacheHit
        cacheSource = source.source
        const modelLoadStart = performance.now()
        try {
          try {
            model = await litert.loadAndCompile(source.url, { accelerator })
          } catch (webgpuError) {
            if (accelerator !== "webgpu") throw webgpuError
            accelerator = "wasm"
            model = await litert.loadAndCompile(source.url, { accelerator })
          }
        } finally {
          source.cleanup()
        }
        modelLoadMs = performance.now() - modelLoadStart
        modelRef.current = model
        modelBackendRef.current = accelerator
        await refreshCacheStats()
      }

      const details = typeof model.getInputDetails === "function" ? model.getInputDetails() : []
      const shape = Array.isArray(details?.[0]?.shape) ? details[0].shape.map((value: unknown) => Number(value)) : INPUT_SHAPE
      if (shape.join(",") !== INPUT_SHAPE.join(",")) throw new Error(`MobileNet reportó una entrada inesperada [${shape.join(", ")}].`)

      setInference({ status: "running", backend: accelerator, modelLoadMs, cacheHit, cacheSource, modelReused })
      const inputData = await preprocessImage(imageFile)
      const inputTensor = new litert.Tensor(inputData, shape)
      const executionStart = performance.now()
      const outputs = await model.run(inputTensor)
      const computeMs = performance.now() - executionStart
      inputTensor.delete?.()
      const output = firstOutput(outputs)
      if (!output) throw new Error("LiteRT ejecutó el modelo, pero no devolvió salida.")
      const readbackStart = performance.now()
      const outputData = await output.data()
      const readbackMs = performance.now() - readbackStart
      const endToEndMs = performance.now() - executionStart
      const logits = Array.from(outputData as ArrayLike<number>, value => Number(value))
      disposeOutputs(outputs)

      const probabilities = softmax(logits)
      const labels = await getImagenetLabels()
      const predictions = probabilities.map((probability, index) => ({ index, probability, label: labels[String(index)] || `Clase ImageNet ${index}` })).sort((a, b) => b.probability - a.probability).slice(0, 3)

      setInference({ status: "success", backend: accelerator, modelLoadMs, computeMs, readbackMs, endToEndMs, totalMs: performance.now() - overallStart, outputSize: logits.length, predictions, cacheHit, cacheSource: modelReused ? "memory" : cacheSource, modelReused })
      recordLocalAIEvent({ groupId: `inference-${Date.now()}`, kind: "inference", backend: accelerator, modelId: probeModel.id, latencyMs: endToEndMs, compileMs: modelLoadMs, runCount: 1, runtimeReused: activeRuntime.reused || modelReused, success: true, note: modelReused ? "compiled model reused" : `model source: ${cacheSource}` })
    } catch (error) {
      setInference({ status: "error", totalMs: performance.now() - overallStart, error: error instanceof Error ? error.message : "No fue posible ejecutar la inferencia local." })
    }
  }

  async function runWebNNProbe() {
    if (!webnnProbeModel || webnnTest.status === "running") return
    setWebnnTest({ status: "running" })
    let model: any = null
    let source: Awaited<ReturnType<typeof getCachedModelSource>> | null = null
    try {
      const activeRuntime = await ensureRuntime()
      if (!activeRuntime.capabilities.webnnContext) throw new Error("navigator.ml no ofrece un contexto WebNN utilizable en este navegador/equipo.")
      if (!activeRuntime.capabilities.jspi) throw new Error("WebNN requiere JSPI para LiteRT.js y este navegador no lo expone.")
      source = await getCachedModelSource(webnnProbeModel.modelUrl)
      const compileStart = performance.now()
      model = await litertRef.current.loadAndCompile(source.url, { accelerator: "webnn" })
      const compileMs = performance.now() - compileStart
      const details = typeof model.getInputDetails === "function" ? model.getInputDetails() : []
      const shape = Array.isArray(details?.[0]?.shape) ? details[0].shape.map((value: unknown) => Number(value)) : INPUT_SHAPE
      const data = new Float32Array(shape.reduce((total: number, value: number) => total * value, 1))
      const tensor = new litertRef.current.Tensor(data, shape)
      const started = performance.now()
      const outputs = await model.run(tensor)
      tensor.delete?.()
      const output = firstOutput(outputs)
      const outputData = output ? await output.data() : []
      const endToEndMs = performance.now() - started
      disposeOutputs(outputs)
      setWebnnTest({ status: "success", compileMs, endToEndMs, outputSize: Number((outputData as ArrayLike<number>).length || 0), cacheHit: source.cacheHit })
      await refreshCacheStats()
    } catch (error) {
      setWebnnTest({ status: "error", error: error instanceof Error ? error.message : "La prueba WebNN no pudo completarse." })
    } finally {
      source?.cleanup()
      model?.delete?.()
    }
  }

  async function clearCache() {
    await clearLiteRTModelCache()
    await refreshCacheStats()
  }

  const capabilities = runtime?.capabilities || null
  const webnnReady = Boolean(capabilities?.webnnContext && capabilities?.jspi)

  return (
    <section className="overflow-hidden rounded-[30px] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.13),transparent_28%),linear-gradient(180deg,rgba(2,20,24,0.96),rgba(2,12,19,0.98))] p-5 shadow-[0_22px_70px_rgba(2,44,34,0.18)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-emerald-300"><Activity className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.22em]">Local-first AI · diagnostics v2</p></div><h2 className="mt-2 text-2xl font-black text-white">LiteRT.js · IA local en el navegador</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">Diagnóstico de aceleradores, routing automático, caché persistente y latencia end-to-end real. WebNN se mantiene experimental; WebGPU/WASM son las rutas estables.</p></div>
        <button type="button" onClick={() => void initializeRuntime()} disabled={testing} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-950/30 px-4 py-2.5 text-sm font-black text-emerald-100 disabled:opacity-60">{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{testing ? "Diagnosticando…" : runtime ? "Volver a probar" : "Probar este dispositivo"}</button>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[26px] border border-white/10 bg-black/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Compatibilidad local</p><h3 className="mt-1 text-lg font-black text-white">Mapa de aceleración del dispositivo</h3></div><span className="rounded-full border border-emerald-400/20 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-black text-emerald-200">{runtime ? `Producción · ${runtime.route.production.toUpperCase()}` : "Sin diagnóstico"}</span></div>
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[180px_1fr_240px]"><ReadinessGauge score={runtime?.score || 0} active={Boolean(runtime?.initialized)} /><div className="space-y-3">{[
            ["Runtime", runtime?.initialized, `LiteRT.js ${EDUAI_LITERT_VERSION}`],
            ["WebGPU", capabilities?.webgpu, capabilities?.webgpu ? "Aceleración disponible" : "No disponible"],
            ["WASM", capabilities?.wasm, "Fallback XNNPack"],
            ["JSPI", capabilities?.jspi, capabilities?.jspi ? "Partición mixta habilitable" : "No expuesto"],
          ].map(([label, ok, detail]) => <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-3 py-2.5"><StatusDot ok={Boolean(ok)} /><div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-200">{label}</p><p className="truncate text-[10px] text-slate-500">{detail}</p></div>{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : null}</div>)}</div><CapabilityRadar capabilities={capabilities} /></div>
          {runtime ? <div className="mt-4 grid gap-2 sm:grid-cols-4">{[["Import runtime", formatMs(runtime.importMs)], ["Inicialización", formatMs(runtime.initMs)], ["Total", formatMs(runtime.totalMs)], ["Runtime", runtime.reused ? "Reutilizado" : "Inicializado"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/5 bg-slate-950/50 px-3 py-3"><p className="text-[10px] font-black uppercase text-slate-600">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>)}</div> : null}
        </div>

        <div className="rounded-[26px] border border-cyan-400/15 bg-cyan-950/15 p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Prueba real</p><h3 className="mt-1 text-lg font-black text-white">MobileNet V3 Small</h3><p className="mt-1 text-xs text-slate-400">La imagen nunca sale del navegador.</p></div><BrainCircuit className="h-8 w-8 text-cyan-300/80" /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr]"><label className="group relative grid min-h-40 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-cyan-300/20 bg-slate-950/50 text-center">{imagePreview ? <img src={imagePreview} alt="Vista previa" className="absolute inset-0 h-full w-full object-cover" /> : <div><Upload className="mx-auto h-6 w-6 text-cyan-300" /><p className="mt-2 text-xs font-black">Subir imagen</p></div>}{imagePreview ? <span className="absolute inset-x-2 bottom-2 rounded-xl bg-slate-950/85 px-2 py-1.5 text-[10px] font-black">Cambiar imagen</span> : null}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => handleImage(event.target.files?.[0] || null)} /></label><div className="flex min-h-40 flex-col rounded-2xl border border-white/5 bg-slate-950/45 p-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-black/20 p-2"><p className="text-[9px] uppercase text-slate-600">Modelo</p><p className="mt-1 text-xs font-black">{probeModel?.name}</p></div><div className="rounded-xl bg-black/20 p-2"><p className="text-[9px] uppercase text-slate-600">Tamaño</p><p className="mt-1 text-xs font-black">~{probeModel?.sizeMB} MB</p></div></div><button type="button" onClick={() => void runInference()} disabled={!imageFile || inference.status === "loading-model" || inference.status === "running"} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-950/30 px-3 py-2.5 text-xs font-black text-cyan-100 disabled:opacity-40">{inference.status === "loading-model" || inference.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Ejecutar inferencia</button></div></div>
          {inference.status === "success" ? <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-950/25 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-emerald-200"><Zap className="h-4 w-4" /><span className="text-xs font-black">Inferencia local completada</span></div><div className="flex gap-1.5"><span className="rounded-full bg-emerald-950/50 px-2 py-1 text-[10px] font-black">{inference.backend?.toUpperCase()}</span><span className="rounded-full bg-slate-950/60 px-2 py-1 text-[10px] font-black text-slate-300">{inference.cacheSource === "memory" ? "MEMORIA" : inference.cacheHit ? "CACHE HIT" : inference.cacheSource?.toUpperCase()}</span></div></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Carga + comp.", formatMs(inference.modelLoadMs)], ["Compute", formatMs(inference.computeMs)], ["Readback", formatMs(inference.readbackMs)], ["End-to-end", formatMs(inference.endToEndMs)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-950/45 p-2"><p className="text-[9px] uppercase text-slate-600">{label}</p><p className="mt-1 text-xs font-black text-white">{value}</p></div>)}</div><div className="mt-3 space-y-2">{inference.predictions?.map((prediction, index) => <div key={prediction.index} className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2.5"><span className="text-xs font-bold text-slate-200">{index + 1}. {prediction.label}</span><span className="shrink-0 text-xs font-black text-emerald-300">{(prediction.probability * 100).toFixed(1)}%</span></div>)}</div></div> : null}
          {inference.status === "error" ? <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-950/25 p-3 text-xs text-amber-100">{inference.error}</div> : null}
        </div>
      </div>

      <div className="mt-5 rounded-[26px] border border-violet-400/15 bg-violet-950/15 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-violet-200"><Laptop className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.18em]">WebNN experimental</p></div><h3 className="mt-2 text-lg font-black text-white">Diagnóstico NPU / acelerador del sistema</h3><p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">LiteRT.js requiere JSPI para WebNN. EduAI no lo usa como ruta de producción mientras siga en preview; si el navegador expone navigator.ml, podemos ejecutar una prueba separada con MobileNet V2.</p></div><span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${webnnReady ? "border-emerald-400/20 bg-emerald-950/30 text-emerald-200" : "border-slate-700 bg-slate-950/60 text-slate-400"}`}>{capabilities ? explainWebNNStatus(capabilities) : "Sin diagnóstico"}</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">{[["HTTPS", capabilities?.secureContext, "Contexto seguro"], ["JSPI", capabilities?.jspi, "Requerido por LiteRT WebNN"], ["navigator.ml", capabilities?.webnnApi, "API WebNN"], ["MLContext", capabilities?.webnnContext, "Contexto acelerado"]].map(([label, ok, detail]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><p className="text-xs font-black text-white">{label}</p><StatusDot ok={Boolean(ok)} /></div><p className="mt-1 text-[10px] text-slate-600">{detail}</p></div>)}</div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]"><div className="rounded-2xl border border-amber-400/10 bg-amber-950/15 p-3 text-[11px] leading-5 text-slate-400"><p className="font-black text-amber-200">Requisitos del preview en Windows</p><p className="mt-1">Microsoft documenta Windows 11 21H2+; Edge Beta para GPU y Edge Canary + driver NPU compatible para la ruta NPU. Si navigator.ml no existe, EduAI no puede forzar WebNN desde JavaScript.</p></div><button type="button" onClick={() => void runWebNNProbe()} disabled={!webnnReady || webnnTest.status === "running"} className="inline-flex min-w-52 items-center justify-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-950/30 px-4 py-3 text-xs font-black text-violet-100 disabled:cursor-not-allowed disabled:opacity-40">{webnnTest.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Probar MobileNet V2 WebNN</button></div>
        {webnnTest.status === "success" ? <div className="mt-3 grid gap-2 sm:grid-cols-4">{[["Estado", "WebNN operativo"], ["Carga + comp.", formatMs(webnnTest.compileMs)], ["End-to-end", formatMs(webnnTest.endToEndMs)], ["Salida", `${webnnTest.outputSize || 0} valores`]].map(([label, value]) => <div key={label} className="rounded-xl border border-emerald-400/10 bg-emerald-950/20 p-3"><p className="text-[9px] uppercase text-slate-600">{label}</p><p className="mt-1 text-xs font-black text-emerald-100">{value}</p></div>)}</div> : null}
        {webnnTest.status === "error" ? <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-950/25 p-3 text-xs text-amber-100">{webnnTest.error}</div> : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        { label: "Runtime", icon: Sparkles, ok: runtime?.initialized, value: `LiteRT.js ${EDUAI_LITERT_VERSION}`, detail: "Singleton + JSPI solicitado" },
        { label: "WebGPU", icon: Gauge, ok: capabilities?.webgpu, value: capabilities ? (capabilities.webgpu ? "Disponible" : "No disponible") : "Sin probar", detail: "Ruta estable preferida" },
        { label: "WASM / CPU", icon: Cpu, ok: capabilities?.wasm, value: capabilities ? (capabilities.wasm ? "Disponible" : "No disponible") : "Sin probar", detail: "Fallback XNNPack" },
        { label: "WebNN", icon: Laptop, ok: capabilities?.webnnContext, value: capabilities ? explainWebNNStatus(capabilities) : "Sin probar", detail: "Preview / NPU emergente" },
      ].map(item => { const Icon = item.icon; return <article key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-300" /><span className="text-xs font-black">{item.label}</span></div><StatusDot ok={Boolean(item.ok)} /></div><p className="mt-3 text-sm font-black text-white">{item.value}</p><p className="mt-1 text-[10px] text-slate-500">{item.detail}</p></article> })}</div>

      {runtime ? <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-950/25 p-4 text-sm text-emerald-100"><p className="font-black">Router local: {runtime.route.production.toUpperCase()}</p><p className="mt-1 text-xs text-emerald-100/70">{runtime.route.reason}</p></div> : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4"><div className="flex items-center gap-3"><HardDriveDownload className="h-5 w-5 text-cyan-300" /><div><p className="text-xs font-black text-white">Caché persistente de modelos</p><p className="mt-1 text-[10px] text-slate-500">{cacheStats.entries} archivos · {formatBytes(cacheStats.bytes)} guardados en este navegador</p></div></div><div className="flex gap-2"><button type="button" onClick={() => void refreshCacheStats()} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[10px] font-black text-slate-300">Actualizar</button><button type="button" onClick={() => void clearCache()} disabled={!cacheStats.entries} className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/15 bg-red-950/20 px-3 py-2 text-[10px] font-black text-red-200 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" />Limpiar cache</button></div></div>

      <div className="mt-6 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-black text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" />Catálogo local</div><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">visión · voz · LLM local</span></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">{LOCAL_AI_MODELS.map(model => <article key={model.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{model.runtime} · {model.format}</p><h3 className="mt-1 font-black text-white">{model.name}</h3><p className="mt-1 text-xs text-slate-400">{model.task} · ~{model.sizeMB} MB</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${model.status === "ready" ? "bg-emerald-950/40 text-emerald-200" : model.status === "candidate" ? "bg-blue-950/40 text-blue-200" : "bg-slate-900 text-slate-300"}`}>{model.status === "ready" ? "Primera prueba" : model.status === "candidate" ? "Candidato" : "Siguiente fase"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl border border-white/5 bg-slate-950/50 px-2.5 py-2"><span className="text-slate-600">Backend</span><p className="mt-0.5 font-black text-slate-300">{recommendedBackend(model.runtime, model.sizeMB)}</p></div><div className="rounded-xl border border-white/5 bg-slate-950/50 px-2.5 py-2"><span className="text-slate-600">Hardware</span><p className="mt-0.5 font-black text-slate-300">{hardwareTier(model.sizeMB)}</p></div></div><p className="mt-3 text-xs leading-relaxed text-slate-300">{model.notes}</p><div className="mt-3 flex flex-wrap gap-1.5">{model.recommendedFor.map(tag => <span key={tag} className="rounded-full border border-white/5 bg-slate-950/60 px-2 py-1 text-[9px] font-bold text-slate-500">{tag}</span>)}</div></article>)}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Modelo principal: {DEFAULT_LITERT_PROBE_MODEL_ID}. Listos: {readyModels.length}.</span><span className="inline-flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Próximo: router real en tareas EduAI + Whisper local.</span></div>
    </section>
  )
}
