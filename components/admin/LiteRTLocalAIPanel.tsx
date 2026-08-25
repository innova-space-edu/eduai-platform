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
  Sparkles,
  Upload,
  Zap,
} from "lucide-react"
import {
  DEFAULT_LITERT_PROBE_MODEL_ID,
  EDUAI_LITERT_ESM_URL,
  EDUAI_LITERT_VERSION,
  EDUAI_LITERT_WASM_URL,
  LOCAL_AI_MODELS,
  getLocalAIModel,
} from "@/lib/ai/local/litert-models"

type RuntimeState = {
  webgpu: boolean
  webnn: boolean
  wasm: boolean
  initialized: boolean
  score: number
  backend: "webgpu" | "wasm"
  importMs: number
  initMs: number
  totalMs: number
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
  inferenceMs?: number
  totalMs?: number
  outputSize?: number
  inputShape?: number[]
  predictions?: Prediction[]
  error?: string
}

const IMAGENET_LABELS_URL = "https://huggingface.co/datasets/huggingface/label-files/resolve/main/imagenet-1k-id2label.json"
const IMAGE_SIZE = 224
const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatMs(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—"
  return value < 100 ? `${value.toFixed(1)} ms` : `${Math.round(value)} ms`
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
      const red = rgba[base] / 255
      const green = rgba[base + 1] / 255
      const blue = rgba[base + 2] / 255

      output[pixel] = (red - IMAGENET_MEAN[0]) / IMAGENET_STD[0]
      output[channelSize + pixel] = (green - IMAGENET_MEAN[1]) / IMAGENET_STD[1]
      output[(channelSize * 2) + pixel] = (blue - IMAGENET_MEAN[2]) / IMAGENET_STD[2]
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

function StatusDot({ ok, pending = false }: { ok: boolean; pending?: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${pending ? "animate-pulse bg-amber-300" : ok ? "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.85)]" : "bg-slate-600"}`}
    />
  )
}

function ReadinessGauge({ score, active }: { score: number; active: boolean }) {
  const circumference = 2 * Math.PI * 52
  const offset = circumference - (circumference * score) / 100

  return (
    <div className="relative grid h-40 w-40 place-items-center">
      <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={active ? "rgb(52 211 153)" : "rgb(71 85 105)"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-black text-white">{active ? score : "—"}</p>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">readiness</p>
      </div>
    </div>
  )
}

function CapabilityRadar({ runtime }: { runtime: RuntimeState | null }) {
  const values = runtime
    ? [runtime.initialized ? 1 : 0.15, runtime.webgpu ? 1 : 0.2, runtime.wasm ? 1 : 0.2, runtime.webnn ? 1 : 0.2]
    : [0.18, 0.18, 0.18, 0.18]
  const center = 80
  const radius = 54
  const points = [
    [center, center - radius * values[0]],
    [center + radius * values[1], center],
    [center, center + radius * values[2]],
    [center - radius * values[3], center],
  ].map(point => point.join(",")).join(" ")

  return (
    <div className="relative h-44 w-full max-w-[260px]">
      <svg viewBox="0 0 160 160" className="h-full w-full">
        {[18, 36, 54].map(r => (
          <polygon
            key={r}
            points={`${center},${center-r} ${center+r},${center} ${center},${center+r} ${center-r},${center}`}
            fill="none"
            stroke="rgba(148,163,184,0.12)"
            strokeWidth="1"
          />
        ))}
        <line x1="80" y1="20" x2="80" y2="140" stroke="rgba(148,163,184,0.1)" />
        <line x1="20" y1="80" x2="140" y2="80" stroke="rgba(148,163,184,0.1)" />
        <polygon
          points={points}
          fill="rgba(34,211,238,0.18)"
          stroke="rgb(34 211 238)"
          strokeWidth="2"
          className="transition-all duration-1000"
        />
        {[
          [80, 26], [134, 80], [80, 134], [26, 80],
        ].map(([cx, cy], index) => (
          <circle key={index} cx={cx} cy={cy} r="3.5" fill={runtime ? "rgb(52 211 153)" : "rgb(71 85 105)"} className={runtime ? "animate-pulse" : ""} />
        ))}
      </svg>
      <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Runtime</span>
      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-slate-500">WebGPU</span>
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider text-slate-500">WASM</span>
      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-slate-500">WebNN</span>
    </div>
  )
}

export default function LiteRTLocalAIPanel() {
  const [runtime, setRuntime] = useState<RuntimeState | null>(null)
  const [testing, setTesting] = useState(false)
  const [diagnosticPhase, setDiagnosticPhase] = useState(0)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [inference, setInference] = useState<InferenceState>({ status: "idle" })

  const litertRef = useRef<any>(null)
  const modelRef = useRef<any>(null)
  const modelBackendRef = useRef<"webgpu" | "wasm" | null>(null)

  const readyModels = useMemo(() => LOCAL_AI_MODELS.filter(model => model.status === "ready"), [])
  const probeModel = getLocalAIModel(DEFAULT_LITERT_PROBE_MODEL_ID)

  const initializeRuntime = async () => {
    setTesting(true)
    setDiagnosticPhase(1)
    const startedAt = performance.now()
    const webgpu = typeof navigator !== "undefined" && "gpu" in navigator
    const webnn = typeof navigator !== "undefined" && "ml" in navigator
    const wasm = typeof WebAssembly !== "undefined"

    try {
      await wait(140)
      setDiagnosticPhase(2)
      const importStartedAt = performance.now()
      const litert = litertRef.current || await import(/* webpackIgnore: true */ EDUAI_LITERT_ESM_URL)
      const importMs = performance.now() - importStartedAt
      litertRef.current = litert

      if (typeof litert.loadLiteRt !== "function" || typeof litert.loadAndCompile !== "function" || typeof litert.Tensor !== "function") {
        throw new Error("El módulo LiteRT.js cargó, pero no expone la API esperada.")
      }

      setDiagnosticPhase(3)
      const initStartedAt = performance.now()
      await litert.loadLiteRt(EDUAI_LITERT_WASM_URL)
      const initMs = performance.now() - initStartedAt
      const score = Math.min(100, 30 + (webgpu ? 30 : 0) + (wasm ? 25 : 0) + (webnn ? 15 : 0))
      const nextRuntime: RuntimeState = {
        webgpu,
        webnn,
        wasm,
        initialized: true,
        score,
        backend: webgpu ? "webgpu" : "wasm",
        importMs,
        initMs,
        totalMs: performance.now() - startedAt,
      }
      setRuntime(nextRuntime)
      setDiagnosticPhase(4)
      return { litert, runtime: nextRuntime }
    } catch (error) {
      const failed: RuntimeState = {
        webgpu,
        webnn,
        wasm,
        initialized: false,
        score: 0,
        backend: webgpu ? "webgpu" : "wasm",
        importMs: 0,
        initMs: 0,
        totalMs: performance.now() - startedAt,
        error: error instanceof Error ? error.message : "No fue posible iniciar LiteRT.js",
      }
      setRuntime(failed)
      setDiagnosticPhase(4)
      throw error
    } finally {
      setTesting(false)
    }
  }

  const probeRuntime = async () => {
    try {
      await initializeRuntime()
    } catch {
      // El error queda visible en el panel.
    }
  }

  const handleImage = (file: File | null) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : "")
    setInference({ status: "idle" })
  }

  const runInference = async () => {
    if (!imageFile || !probeModel) return
    const overallStart = performance.now()
    setInference({ status: "loading-model" })

    try {
      const ensured = runtime?.initialized && litertRef.current
        ? { litert: litertRef.current, runtime }
        : await initializeRuntime()
      const litert = ensured.litert
      let accelerator: "webgpu" | "wasm" = ensured.runtime.webgpu ? "webgpu" : "wasm"
      let model = modelRef.current
      let modelLoadMs = 0

      if (!model || modelBackendRef.current !== accelerator) {
        const modelLoadStart = performance.now()
        try {
          model = await litert.loadAndCompile(probeModel.modelUrl, { accelerator })
        } catch (webgpuError) {
          if (accelerator !== "webgpu") throw webgpuError
          accelerator = "wasm"
          model = await litert.loadAndCompile(probeModel.modelUrl, { accelerator })
        }
        modelLoadMs = performance.now() - modelLoadStart
        modelRef.current = model
        modelBackendRef.current = accelerator
      }

      const inputDetails = typeof model.getInputDetails === "function" ? model.getInputDetails() : []
      const inputShape = Array.isArray(inputDetails?.[0]?.shape) ? inputDetails[0].shape : [1, 3, IMAGE_SIZE, IMAGE_SIZE]
      const normalizedShape = inputShape.map((value: unknown) => Number(value))
      const supportedShape = normalizedShape.length === 4 && normalizedShape.join(",") === `1,3,${IMAGE_SIZE},${IMAGE_SIZE}`
      if (!supportedShape) {
        throw new Error(`MobileNet reportó una forma de entrada no esperada: [${normalizedShape.join(", ")}].`)
      }

      setInference({ status: "running", backend: accelerator, modelLoadMs, inputShape: normalizedShape })
      const inputData = await preprocessImage(imageFile)
      const inputTensor = new litert.Tensor(inputData, normalizedShape)
      const inferenceStart = performance.now()
      const outputs = await model.run(inputTensor)
      const inferenceMs = performance.now() - inferenceStart
      inputTensor.delete?.()

      const firstOutput = Array.isArray(outputs) ? outputs[0] : outputs?.[0]
      if (!firstOutput) throw new Error("LiteRT ejecutó el modelo, pero no devolvió tensor de salida.")
      const outputData = await firstOutput.data()
      const logits = Array.from(outputData as ArrayLike<number>, value => Number(value))
      firstOutput.delete?.()
      if (Array.isArray(outputs)) {
        outputs.slice(1).forEach(output => output?.delete?.())
      }

      const probabilities = softmax(logits)
      const labels = await getImagenetLabels()
      const predictions = probabilities
        .map((probability, index) => ({
          index,
          probability,
          label: labels[String(index)] || `Clase ImageNet ${index}`,
        }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3)

      setInference({
        status: "success",
        backend: accelerator,
        modelLoadMs,
        inferenceMs,
        totalMs: performance.now() - overallStart,
        outputSize: logits.length,
        inputShape: normalizedShape,
        predictions,
      })
    } catch (error) {
      setInference({
        status: "error",
        totalMs: performance.now() - overallStart,
        error: error instanceof Error ? error.message : "No fue posible ejecutar la inferencia local.",
      })
    }
  }

  const phases = [
    { label: "Hardware", description: "CPU, WASM y aceleradores", step: 1 },
    { label: "Runtime", description: `LiteRT.js ${EDUAI_LITERT_VERSION}`, step: 2 },
    { label: "Backend", description: runtime?.backend === "webgpu" ? "WebGPU seleccionado" : "WASM / CPU", step: 3 },
    { label: "Listo", description: runtime?.initialized ? "Inferencia habilitada" : "Pendiente", step: 4 },
  ]

  return (
    <section className="overflow-hidden rounded-[30px] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.13),transparent_28%),linear-gradient(180deg,rgba(2,20,24,0.96),rgba(2,12,19,0.98))] p-5 shadow-[0_22px_70px_rgba(2,44,34,0.18)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {runtime?.initialized ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" /> : null}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${runtime?.initialized ? "bg-emerald-300" : "bg-slate-600"}`} />
            </span>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Local-first AI · live diagnostics</p>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">LiteRT.js · IA local en el navegador</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
            Diagnóstico interactivo para medir compatibilidad del dispositivo, elegir WebGPU o WASM y ejecutar un modelo real sin enviar la imagen a una API externa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void probeRuntime()}
          disabled={testing}
          className="group inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-black text-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.12)] transition hover:-translate-y-0.5 hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4 transition group-hover:scale-110" />}
          {testing ? "Diagnosticando…" : runtime?.initialized ? "Volver a probar" : "Probar este dispositivo"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Compatibilidad local</p>
              <h3 className="mt-1 text-lg font-black text-white">Mapa de aceleración del dispositivo</h3>
              <p className="mt-1 text-xs text-slate-500">La visualización cambia con las capacidades detectadas en este navegador.</p>
            </div>
            <span className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${runtime?.initialized ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-slate-700 bg-slate-900/70 text-slate-400"}`}>
              {runtime?.initialized ? `Backend recomendado · ${runtime.backend === "webgpu" ? "WebGPU" : "WASM"}` : "Sin diagnóstico"}
            </span>
          </div>

          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[180px_1fr_240px]">
            <ReadinessGauge score={runtime?.score || 0} active={Boolean(runtime?.initialized)} />

            <div className="space-y-3">
              {phases.map(phase => {
                const complete = diagnosticPhase >= phase.step || Boolean(runtime?.initialized)
                const current = testing && diagnosticPhase === phase.step
                return (
                  <div key={phase.label} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-3 py-2.5">
                    <StatusDot ok={complete} pending={current} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-200">{phase.label}</p>
                      <p className="truncate text-[10px] text-slate-500">{phase.description}</p>
                    </div>
                    {complete && !current ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : null}
                  </div>
                )
              })}
            </div>

            <CapabilityRadar runtime={runtime} />
          </div>

          {runtime?.initialized ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {[
                ["Import runtime", formatMs(runtime.importMs)],
                ["Inicialización", formatMs(runtime.initMs)],
                ["Total", formatMs(runtime.totalMs)],
                ["CPU threads", String(navigator.hardwareConcurrency || "—")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/5 bg-slate-950/50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</p>
                  <p className="mt-1 text-sm font-black text-white">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-[26px] border border-cyan-400/15 bg-cyan-500/[0.045] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Prueba real</p>
              <h3 className="mt-1 text-lg font-black text-white">MobileNet V3 Small</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Sube una imagen. El preprocesamiento y la inferencia se ejecutan localmente en este navegador.</p>
            </div>
            <BrainCircuit className="h-8 w-8 text-cyan-300/80" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="group relative grid min-h-40 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-cyan-300/20 bg-slate-950/50 text-center transition hover:border-cyan-300/50 hover:bg-cyan-500/5">
              {imagePreview ? (
                <img src={imagePreview} alt="Vista previa para inferencia" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="p-4">
                  <Upload className="mx-auto h-6 w-6 text-cyan-300" />
                  <p className="mt-2 text-xs font-black text-slate-200">Subir imagen</p>
                  <p className="mt-1 text-[10px] text-slate-500">JPG, PNG o WebP</p>
                </div>
              )}
              {imagePreview ? <span className="absolute inset-x-2 bottom-2 rounded-xl bg-slate-950/80 px-2 py-1.5 text-[10px] font-black text-cyan-100 backdrop-blur">Cambiar imagen</span> : null}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={event => handleImage(event.target.files?.[0] || null)}
              />
            </label>

            <div className="flex min-h-40 flex-col rounded-2xl border border-white/5 bg-slate-950/45 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.025] p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Modelo</p>
                  <p className="mt-1 text-xs font-black text-white">{probeModel?.name || "MobileNet"}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.025] p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Descarga</p>
                  <p className="mt-1 text-xs font-black text-white">~{probeModel?.sizeMB || 10.2} MB</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void runInference()}
                disabled={!imageFile || inference.status === "loading-model" || inference.status === "running"}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {inference.status === "loading-model" || inference.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {inference.status === "loading-model" ? "Cargando modelo…" : inference.status === "running" ? "Ejecutando localmente…" : "Ejecutar inferencia"}
              </button>
            </div>
          </div>

          {inference.status === "success" ? (
            <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-200">
                  <Zap className="h-4 w-4" />
                  <span className="text-xs font-black">Inferencia local completada</span>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-200">{inference.backend?.toUpperCase()}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-950/40 p-2"><p className="text-[9px] uppercase text-slate-600">Modelo</p><p className="mt-1 text-xs font-black text-white">{formatMs(inference.modelLoadMs)}</p></div>
                <div className="rounded-xl bg-slate-950/40 p-2"><p className="text-[9px] uppercase text-slate-600">Inferencia</p><p className="mt-1 text-xs font-black text-white">{formatMs(inference.inferenceMs)}</p></div>
                <div className="rounded-xl bg-slate-950/40 p-2"><p className="text-[9px] uppercase text-slate-600">Salida</p><p className="mt-1 text-xs font-black text-white">{inference.outputSize || 0} clases</p></div>
              </div>
              <div className="mt-3 space-y-2">
                {inference.predictions?.map((prediction, index) => (
                  <div key={`${prediction.index}-${index}`} className="relative overflow-hidden rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2.5">
                    <div className="absolute inset-y-0 left-0 bg-emerald-400/10 transition-all duration-700" style={{ width: `${Math.max(3, prediction.probability * 100)}%` }} />
                    <div className="relative flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-bold text-slate-200">{index + 1}. {prediction.label}</span>
                      <span className="shrink-0 text-xs font-black text-emerald-300">{(prediction.probability * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {inference.status === "error" ? (
            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
              <p className="font-black">La prueba real no pudo completarse</p>
              <p className="mt-1 leading-relaxed text-amber-100/80">{inference.error}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Runtime", icon: Sparkles, ok: runtime?.initialized, value: `LiteRT.js ${EDUAI_LITERT_VERSION}`, detail: "Carga bajo demanda" },
          { label: "WebGPU", icon: Gauge, ok: runtime?.webgpu, value: runtime ? (runtime.webgpu ? "Disponible" : "No disponible") : "Sin probar", detail: "Aceleración GPU" },
          { label: "WASM / CPU", icon: Cpu, ok: runtime?.wasm, value: runtime ? (runtime.wasm ? "Disponible" : "No disponible") : "Sin probar", detail: "Fallback XNNPack" },
          { label: "WebNN", icon: Laptop, ok: runtime?.webnn, value: runtime ? (runtime.webnn ? "Detectado" : "No detectado") : "Sin probar", detail: "Ruta NPU emergente" },
        ].map(item => {
          const Icon = item.icon
          return (
            <article key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:-translate-y-0.5 hover:border-white/15">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-200"><Icon className="h-4 w-4 text-emerald-300" /><span className="text-xs font-black">{item.label}</span></div>
                <StatusDot ok={Boolean(item.ok)} />
              </div>
              <p className="mt-3 text-sm font-black text-white">{item.value}</p>
              <p className="mt-1 text-[10px] text-slate-500">{item.detail}</p>
            </article>
          )
        })}
      </div>

      {runtime ? (
        <div className={`mt-4 rounded-2xl border p-4 text-sm ${runtime.initialized ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100" : "border-amber-400/20 bg-amber-500/10 text-amber-100"}`}>
          {runtime.initialized
            ? `LiteRT.js está operativo. Este dispositivo obtuvo ${runtime.score}/100 y usará ${runtime.backend === "webgpu" ? "WebGPU" : "WASM / CPU"} como ruta local preferida.`
            : `LiteRT.js no pudo inicializar: ${runtime.error || "error desconocido"}`}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <HardDriveDownload className="h-4 w-4 text-emerald-300" />
          Catálogo local inicial
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">visión · voz · LLM local</span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {LOCAL_AI_MODELS.map(model => (
          <article key={model.id} className="group rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:-translate-y-0.5 hover:border-emerald-400/15 hover:bg-emerald-500/[0.025]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{model.runtime} · {model.format}</p>
                <h3 className="mt-1 font-black text-white">{model.name}</h3>
                <p className="mt-1 text-xs text-slate-400">{model.task} · ~{model.sizeMB} MB</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${model.status === "ready" ? "bg-emerald-500/15 text-emerald-200" : model.status === "candidate" ? "bg-blue-500/15 text-blue-200" : "bg-slate-500/15 text-slate-300"}`}>
                {model.status === "ready" ? "Primera prueba" : model.status === "candidate" ? "Candidato" : "Siguiente fase"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2"><span className="text-slate-600">Backend</span><p className="mt-0.5 font-black text-slate-300">{recommendedBackend(model.runtime, model.sizeMB)}</p></div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2"><span className="text-slate-600">Hardware</span><p className="mt-0.5 font-black text-slate-300">{hardwareTier(model.sizeMB)}</p></div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">{model.notes}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {model.recommendedFor.map(tag => <span key={tag} className="rounded-full border border-white/5 bg-slate-950/60 px-2 py-1 text-[9px] font-bold text-slate-500">{tag}</span>)}
            </div>
            <p className="mt-3 text-[10px] text-slate-600">HF: {model.sourceRepo}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Modelo de prueba: {DEFAULT_LITERT_PROBE_MODEL_ID}. Listos para primera validación: {readyModels.length}.</span>
        <span className="inline-flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Próximo: benchmark WebGPU vs WASM + cache persistente.</span>
      </div>
    </section>
  )
}
