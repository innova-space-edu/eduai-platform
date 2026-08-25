"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Loader2, PackageOpen, Play, Upload } from "lucide-react"
import {
  DEFAULT_LITERT_INT8_COMPARE_MODEL_ID,
  DEFAULT_LITERT_PROBE_MODEL_ID,
  getLocalAIModel,
} from "@/lib/ai/local/litert-models"
import { getLiteRTRuntime } from "@/lib/ai/local/litert-runtime"
import { recordLocalAIEvent } from "@/lib/ai/local/litert-telemetry"

type BackendName = "webgpu" | "wasm"
type Prediction = { index: number; label: string; probability: number }
type ModelResult = {
  id: string
  name: string
  sizeMB: number
  backend: BackendName
  compileMs: number
  warmups: number[]
  runs: number[]
  averageMs: number
  medianMs: number
  predictions: Prediction[]
}
type CompareResult = {
  fp32: ModelResult
  int8: ModelResult
  runtimeReused: boolean
  runtimeAcquireMs: number
  top1Agreement: boolean
  top3Overlap: number
  sizeReduction: number
}

const IMAGE_SIZE = 224
const INPUT_SHAPE = [1, 3, IMAGE_SIZE, IMAGE_SIZE]
const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]
const IMAGENET_LABELS_URL = "https://huggingface.co/datasets/huggingface/label-files/resolve/main/imagenet-1k-id2label.json"
const WARMUPS = 2
const RUNS = 5

function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const m = Math.floor(sorted.length / 2); return !sorted.length ? 0 : sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2 }
function formatMs(value: number) { return !Number.isFinite(value) || value <= 0 ? "—" : value < 100 ? `${value.toFixed(2)} ms` : `${Math.round(value)} ms` }
function softmax(values: number[]) { if (!values.length) return []; const max = Math.max(...values); const exps = values.map(value => Math.exp(value - max)); const sum = exps.reduce((total, value) => total + value, 0) || 1; return exps.map(value => value / sum) }

async function getLabels() {
  try {
    const response = await fetch(IMAGENET_LABELS_URL, { cache: "force-cache" })
    return response.ok ? await response.json() as Record<string, string> : {}
  } catch { return {} as Record<string, string> }
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
    if (!context) throw new Error("No fue posible crear el canvas de comparación.")
    context.drawImage(bitmap, sx, sy, cropSize, cropSize, 0, 0, IMAGE_SIZE, IMAGE_SIZE)
    const rgba = context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data
    const pixels = IMAGE_SIZE * IMAGE_SIZE
    const output = new Float32Array(pixels * 3)
    for (let pixel = 0; pixel < pixels; pixel += 1) {
      const base = pixel * 4
      output[pixel] = (rgba[base] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0]
      output[pixels + pixel] = (rgba[base + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1]
      output[pixels * 2 + pixel] = (rgba[base + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2]
    }
    return output
  } finally { bitmap.close() }
}

function disposeOutputs(outputs: any) {
  if (Array.isArray(outputs)) { outputs.forEach(output => output?.delete?.()); return }
  if (outputs && typeof outputs === "object") Object.values(outputs).forEach(output => (output as any)?.delete?.())
}
function firstOutput(outputs: any) { return Array.isArray(outputs) ? outputs[0] : outputs && typeof outputs === "object" ? Object.values(outputs)[0] as any : null }

export default function LiteRTQuantizationPanelV2() {
  const fp32Model = getLocalAIModel(DEFAULT_LITERT_PROBE_MODEL_ID)
  const int8Model = getLocalAIModel(DEFAULT_LITERT_INT8_COMPARE_MODEL_ID)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState("")
  const [result, setResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState("")

  const sizeRatio = useMemo(() => fp32Model && int8Model ? fp32Model.sizeMB / int8Model.sizeMB : 0, [fp32Model, int8Model])

  function chooseFile(next: File | null) {
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(next ? URL.createObjectURL(next) : "")
    setResult(null)
    setError("")
  }

  async function runOne(litert: any, modelDef: NonNullable<typeof fp32Model>, inputData: Float32Array, labelMap: Record<string, string>): Promise<ModelResult> {
    let backend: BackendName = "gpu" in navigator ? "webgpu" : "wasm"
    let model: any = null
    try {
      setPhase(`Compilando ${modelDef.name}…`)
      const compileStarted = performance.now()
      try { model = await litert.loadAndCompile(modelDef.modelUrl, { accelerator: backend }) }
      catch (webgpuError) { if (backend !== "webgpu") throw webgpuError; backend = "wasm"; model = await litert.loadAndCompile(modelDef.modelUrl, { accelerator: backend }) }
      const compileMs = performance.now() - compileStarted
      const details = typeof model.getInputDetails === "function" ? model.getInputDetails() : []
      const shape = Array.isArray(details?.[0]?.shape) ? details[0].shape.map((value: unknown) => Number(value)) : INPUT_SHAPE
      if (shape.join(",") !== INPUT_SHAPE.join(",")) throw new Error(`${modelDef.name} reportó entrada [${shape.join(", ")}].`)

      const warmups: number[] = []
      for (let index = 0; index < WARMUPS; index += 1) {
        setPhase(`${modelDef.name} · warm-up ${index + 1}/${WARMUPS}`)
        const tensor = new litert.Tensor(inputData, shape)
        const started = performance.now()
        const outputs = await model.run(tensor)
        warmups.push(performance.now() - started)
        tensor.delete?.(); disposeOutputs(outputs)
      }

      const runs: number[] = []
      let logits: number[] = []
      for (let index = 0; index < RUNS; index += 1) {
        setPhase(`${modelDef.name} · medición ${index + 1}/${RUNS}`)
        const tensor = new litert.Tensor(inputData, shape)
        const started = performance.now()
        const outputs = await model.run(tensor)
        runs.push(performance.now() - started)
        tensor.delete?.()
        if (index === 0) {
          const output = firstOutput(outputs)
          if (output) { const data = await output.data(); logits = Array.from(data as ArrayLike<number>, value => Number(value)) }
        }
        disposeOutputs(outputs)
      }

      const probabilities = softmax(logits)
      const predictions = probabilities.map((probability, index) => ({ index, probability, label: labelMap[String(index)] || `Clase ImageNet ${index}` })).sort((a, b) => b.probability - a.probability).slice(0, 3)
      return { id: modelDef.id, name: modelDef.name, sizeMB: modelDef.sizeMB, backend, compileMs, warmups, runs, averageMs: average(runs), medianMs: median(runs), predictions }
    } finally { model?.delete?.() }
  }

  async function compare() {
    if (!file || !fp32Model || !int8Model || running) return
    setRunning(true); setError(""); setResult(null)
    try {
      setPhase("Adquiriendo runtime compartido…")
      const runtime = await getLiteRTRuntime()
      const inputData = await preprocessImage(file)
      const labelMap = await getLabels()
      const fp32 = await runOne(runtime.litert, fp32Model, inputData, labelMap)
      const int8 = await runOne(runtime.litert, int8Model, inputData, labelMap)
      const fpTop = fp32.predictions.map(item => item.index)
      const intTop = int8.predictions.map(item => item.index)
      const groupId = `${Date.now()}`
      const comparison: CompareResult = {
        fp32, int8, runtimeReused: runtime.reused, runtimeAcquireMs: runtime.acquireMs,
        top1Agreement: fpTop[0] === intTop[0],
        top3Overlap: fpTop.filter(index => intTop.includes(index)).length,
        sizeReduction: fp32.sizeMB / int8.sizeMB,
      }
      setResult(comparison)
      for (const item of [fp32, int8]) {
        recordLocalAIEvent({ groupId, kind: "quantization", backend: item.backend, modelId: item.id, latencyMs: item.medianMs, compileMs: item.compileMs, runCount: item.runs.length, runtimeReused: runtime.reused, success: true, note: item.id === fp32.id ? "FP32 baseline" : "INT8 weight-only" })
      }
      setPhase("Comparación completada")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible comparar los modelos."); setPhase("") }
    finally { setRunning(false) }
  }

  return (
    <section className="mt-4 rounded-[30px] border border-violet-400/15 bg-[linear-gradient(180deg,rgba(8,13,30,0.98),rgba(4,9,22,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-violet-300"><PackageOpen className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.2em]">Quantization Lab v2</p></div><h2 className="mt-2 text-2xl font-black text-white">MobileNet FP32 vs INT8 weight-only</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Misma imagen, mismo preprocesamiento, {WARMUPS} warm-ups y {RUNS} mediciones por modelo. Compara tamaño, backend, compilación, mediana y acuerdo de clases.</p></div>
        <div className="rounded-2xl border border-violet-400/15 bg-violet-950/20 px-4 py-3 text-right"><p className="text-[10px] font-black uppercase text-slate-500">Reducción teórica</p><p className="mt-1 text-xl font-black text-violet-200">{sizeRatio ? `${sizeRatio.toFixed(2)}×` : "—"}</p><p className="text-[10px] text-slate-500">{fp32Model?.sizeMB || 0} MB → {int8Model?.sizeMB || 0} MB</p></div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <label className="group relative grid min-h-52 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-violet-400/20 bg-slate-950/65 text-center hover:border-violet-300/40">
          {preview ? <img src={preview} alt="Imagen para comparación cuantizada" className="absolute inset-0 h-full w-full object-cover" /> : <div><Upload className="mx-auto h-7 w-7 text-violet-300" /><p className="mt-2 text-xs font-black text-white">Subir imagen</p><p className="mt-1 text-[10px] text-slate-500">Se procesa solo en este navegador</p></div>}
          {preview ? <span className="absolute inset-x-3 bottom-3 rounded-xl bg-slate-950/85 px-3 py-2 text-[10px] font-black text-violet-100">Cambiar imagen</span> : null}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => chooseFile(event.target.files?.[0] || null)} />
        </label>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <div className="grid gap-3 sm:grid-cols-2">{[fp32Model, int8Model].map(model => model ? <div key={model.id} className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] font-black uppercase text-slate-500">{model.id === DEFAULT_LITERT_PROBE_MODEL_ID ? "FP32" : "INT8 weight-only"}</p><p className="mt-1 text-sm font-black text-white">{model.name}</p><p className="mt-1 text-xs text-slate-500">~{model.sizeMB} MB</p></div> : null)}</div>
          <button type="button" onClick={() => void compare()} disabled={!file || running} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-950/30 px-4 py-3 text-sm font-black text-violet-100 disabled:opacity-40">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? phase || "Comparando…" : result ? "Repetir comparación" : "Comparar FP32 vs INT8"}</button>
          {error ? <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-950/25 p-3 text-xs text-amber-100">{error}</div> : null}
        </div>
      </div>

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            {[result.fp32, result.int8].map(item => <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-slate-500">{item.id === DEFAULT_LITERT_PROBE_MODEL_ID ? "FP32" : "INT8 weight-only"}</p><h3 className="mt-1 font-black text-white">{item.name}</h3></div><span className="rounded-full border border-cyan-400/15 bg-cyan-950/25 px-2.5 py-1 text-[10px] font-black text-cyan-200">{item.backend.toUpperCase()}</span></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-black/25 p-2"><p className="text-[9px] uppercase text-slate-600">Carga + comp.</p><p className="mt-1 text-xs font-black text-white">{formatMs(item.compileMs)}</p></div><div className="rounded-xl bg-black/25 p-2"><p className="text-[9px] uppercase text-slate-600">Mediana</p><p className="mt-1 text-xs font-black text-white">{formatMs(item.medianMs)}</p></div><div className="rounded-xl bg-black/25 p-2"><p className="text-[9px] uppercase text-slate-600">Tamaño</p><p className="mt-1 text-xs font-black text-white">{item.sizeMB} MB</p></div></div><div className="mt-3 space-y-2">{item.predictions.map((prediction, index) => <div key={`${item.id}-${prediction.index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2"><span className="min-w-0 text-xs font-bold text-slate-300">{index + 1}. {prediction.label}</span><span className="shrink-0 text-xs font-black text-emerald-300">{(prediction.probability * 100).toFixed(1)}%</span></div>)}</div></article>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-950/20 p-4"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><p className="mt-2 text-[10px] font-black uppercase text-slate-500">Top-1</p><p className="mt-1 font-black text-white">{result.top1Agreement ? "Coincide" : "Difiere"}</p></div>
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-950/20 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Top-3 overlap</p><p className="mt-2 font-black text-white">{result.top3Overlap}/3 clases</p></div>
            <div className="rounded-2xl border border-violet-400/15 bg-violet-950/20 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Tamaño</p><p className="mt-2 font-black text-white">{result.sizeReduction.toFixed(2)}× menor</p></div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-950/20 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Runtime</p><p className="mt-2 font-black text-white">{result.runtimeReused ? "Reutilizado" : "Inicializado"}</p><p className="mt-1 text-[10px] text-slate-600">adquisición {formatMs(result.runtimeAcquireMs)}</p></div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
