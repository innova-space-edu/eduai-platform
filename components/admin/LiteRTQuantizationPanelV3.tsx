"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Loader2, PackageOpen, Play, Upload } from "lucide-react"
import { DEFAULT_LITERT_INT8_COMPARE_MODEL_ID, DEFAULT_LITERT_PROBE_MODEL_ID, getLocalAIModel } from "@/lib/ai/local/litert-models"
import { getCachedModelSource } from "@/lib/ai/local/litert-model-cache"
import { getLiteRTRuntime } from "@/lib/ai/local/litert-runtime"
import { saveLiteRTRouteProfile } from "@/lib/ai/local/litert-router"
import { recordLocalAIEvent } from "@/lib/ai/local/litert-telemetry"

type BackendName = "webgpu" | "wasm"
type Prediction = { index: number; label: string; probability: number }
type CellResult = {
  modelId: string
  modelName: string
  backend: BackendName
  supported: boolean
  pooled: boolean
  acquireMs: number
  computeMedianMs: number
  readbackMedianMs: number
  endToEndMedianMs: number
  endToEndP95Ms: number
  predictions: Prediction[]
  error?: string
}

const IMAGE_SIZE = 224
const INPUT_SHAPE = [1, 3, IMAGE_SIZE, IMAGE_SIZE]
const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]
const IMAGENET_LABELS_URL = "https://huggingface.co/datasets/huggingface/label-files/resolve/main/imagenet-1k-id2label.json"
const WARMUPS = 2
const RUNS = 5

function median(values: number[]) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const m = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2 }
function p95(values: number[]) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] }
function formatMs(value: number) { return !Number.isFinite(value) ? "—" : value < 100 ? `${value.toFixed(2)} ms` : `${Math.round(value)} ms` }
function softmax(values: number[]) { if (!values.length) return []; const max = Math.max(...values); const exps = values.map(v => Math.exp(v - max)); const sum = exps.reduce((a, b) => a + b, 0) || 1; return exps.map(v => v / sum) }
function firstOutput(outputs: any) { return Array.isArray(outputs) ? outputs[0] : outputs && typeof outputs === "object" ? Object.values(outputs)[0] as any : null }
function disposeOutputs(outputs: any) { if (Array.isArray(outputs)) outputs.forEach(output => output?.delete?.()); else if (outputs && typeof outputs === "object") Object.values(outputs).forEach(output => (output as any)?.delete?.()) }

async function getLabels() {
  try { const response = await fetch(IMAGENET_LABELS_URL, { cache: "force-cache" }); return response.ok ? await response.json() as Record<string, string> : {} }
  catch { return {} as Record<string, string> }
}

async function preprocessImage(file: File) {
  const started = performance.now()
  const bitmap = await createImageBitmap(file)
  try {
    const shortest = Math.min(bitmap.width, bitmap.height)
    const cropSize = shortest * (224 / 256)
    const sx = Math.max(0, (bitmap.width - cropSize) / 2)
    const sy = Math.max(0, (bitmap.height - cropSize) / 2)
    const canvas = document.createElement("canvas")
    canvas.width = IMAGE_SIZE; canvas.height = IMAGE_SIZE
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
    return { data: output, preprocessMs: performance.now() - started }
  } finally { bitmap.close() }
}

export default function LiteRTQuantizationPanelV3() {
  const fp32 = getLocalAIModel(DEFAULT_LITERT_PROBE_MODEL_ID)
  const int8 = getLocalAIModel(DEFAULT_LITERT_INT8_COMPARE_MODEL_ID)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState("")
  const [results, setResults] = useState<CellResult[]>([])
  const [error, setError] = useState("")
  const sizeRatio = useMemo(() => fp32 && int8 ? fp32.sizeMB / int8.sizeMB : 0, [fp32, int8])

  function chooseFile(next: File | null) {
    if (preview) URL.revokeObjectURL(preview)
    setFile(next); setPreview(next ? URL.createObjectURL(next) : ""); setResults([]); setError("")
  }

  async function measureCell(litert: any, modelDef: NonNullable<typeof fp32>, backend: BackendName, inputData: Float32Array, labels: Record<string, string>, preprocessMs: number): Promise<CellResult> {
    if (backend === "webgpu" && !("gpu" in navigator)) return { modelId: modelDef.id, modelName: modelDef.name, backend, supported: false, pooled: false, acquireMs: 0, computeMedianMs: 0, readbackMedianMs: 0, endToEndMedianMs: 0, endToEndP95Ms: 0, predictions: [], error: "WebGPU no disponible" }
    let source: Awaited<ReturnType<typeof getCachedModelSource>> | null = null
    let model: any = null
    try {
      setPhase(`${modelDef.name} · ${backend.toUpperCase()} · preparando…`)
      source = await getCachedModelSource(modelDef.modelUrl)
      const acquireStarted = performance.now()
      model = await litert.loadAndCompile(source.url, { accelerator: backend })
      const acquireMs = performance.now() - acquireStarted
      const pooled = Boolean(model?.__eduaiPoolReused)
      const details = typeof model.getInputDetails === "function" ? model.getInputDetails() : []
      const shape = Array.isArray(details?.[0]?.shape) ? details[0].shape.map((value: unknown) => Number(value)) : INPUT_SHAPE
      if (shape.join(",") !== INPUT_SHAPE.join(",")) throw new Error(`Entrada inesperada [${shape.join(", ")}]`)

      const runOnce = async () => {
        const tensor = new litert.Tensor(inputData, shape)
        const started = performance.now()
        const outputs = await model.run(tensor)
        const computeMs = performance.now() - started
        tensor.delete?.()
        const output = firstOutput(outputs)
        if (!output) { disposeOutputs(outputs); throw new Error("LiteRT no devolvió salida") }
        const readbackStarted = performance.now()
        const data = await output.data()
        const readbackMs = performance.now() - readbackStarted
        const endToEndMs = performance.now() - started
        const logits = Array.from(data as ArrayLike<number>, value => Number(value))
        disposeOutputs(outputs)
        return { computeMs, readbackMs, endToEndMs, logits }
      }

      for (let index = 0; index < WARMUPS; index += 1) { setPhase(`${modelDef.name} · ${backend.toUpperCase()} · warm-up ${index + 1}/${WARMUPS}`); await runOnce() }
      const measured = [] as Awaited<ReturnType<typeof runOnce>>[]
      for (let index = 0; index < RUNS; index += 1) { setPhase(`${modelDef.name} · ${backend.toUpperCase()} · E2E ${index + 1}/${RUNS}`); measured.push(await runOnce()) }
      const logits = measured[0]?.logits || []
      const postStarted = performance.now()
      const probabilities = softmax(logits)
      const predictions = probabilities.map((probability, index) => ({ index, probability, label: labels[String(index)] || `Clase ImageNet ${index}` })).sort((a, b) => b.probability - a.probability).slice(0, 3)
      const postprocessMs = performance.now() - postStarted
      const result: CellResult = {
        modelId: modelDef.id,
        modelName: modelDef.name,
        backend,
        supported: true,
        pooled,
        acquireMs,
        computeMedianMs: median(measured.map(item => item.computeMs)),
        readbackMedianMs: median(measured.map(item => item.readbackMs)),
        endToEndMedianMs: median(measured.map(item => item.endToEndMs)),
        endToEndP95Ms: p95(measured.map(item => item.endToEndMs)),
        predictions,
      }
      recordLocalAIEvent({ groupId: `quant-v3-${Date.now()}`, kind: "quantization", backend, modelId: modelDef.id, latencyMs: result.endToEndMedianMs, endToEndMs: result.endToEndMedianMs, compileMs: acquireMs, modelAcquireMs: acquireMs, preprocessMs, computeMs: result.computeMedianMs, readbackMs: result.readbackMedianMs, postprocessMs, modelReused: pooled, runtimeReused: true, runCount: RUNS, success: true, note: `V3 same-backend matrix · ${source.source}` })
      return result
    } catch (caught) {
      return { modelId: modelDef.id, modelName: modelDef.name, backend, supported: false, pooled: false, acquireMs: 0, computeMedianMs: 0, readbackMedianMs: 0, endToEndMedianMs: 0, endToEndP95Ms: 0, predictions: [], error: caught instanceof Error ? caught.message : "No disponible" }
    } finally { source?.cleanup(); model?.delete?.() }
  }

  async function compare() {
    if (!file || !fp32 || !int8 || running) return
    setRunning(true); setError(""); setResults([])
    try {
      const runtime = await getLiteRTRuntime()
      const { data, preprocessMs } = await preprocessImage(file)
      const labels = await getLabels()
      const matrix: CellResult[] = []
      for (const model of [fp32, int8]) for (const backend of ["wasm", "webgpu"] as BackendName[]) matrix.push(await measureCell(runtime.litert, model, backend, data, labels, preprocessMs))
      setResults(matrix)
      for (const model of [fp32, int8]) {
        const valid = matrix.filter(item => item.modelId === model.id && item.supported).sort((a, b) => a.endToEndMedianMs - b.endToEndMedianMs)
        if (!valid.length) continue
        saveLiteRTRouteProfile({ backend: valid[0].backend, modelId: model.id, medianEndToEndMs: valid[0].endToEndMedianMs, p95EndToEndMs: valid[0].endToEndP95Ms, alternativeMedianEndToEndMs: valid[1]?.endToEndMedianMs ?? null })
      }
      setPhase("Matriz FP32/INT8 completada")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible completar la matriz.") }
    finally { setRunning(false) }
  }

  const fastest = (modelId: string) => results.filter(item => item.modelId === modelId && item.supported).sort((a, b) => a.endToEndMedianMs - b.endToEndMedianMs)[0]
  const fpFast = fp32 ? fastest(fp32.id) : undefined
  const intFast = int8 ? fastest(int8.id) : undefined
  const top1Agreement = Boolean(fpFast?.predictions[0] && intFast?.predictions[0] && fpFast.predictions[0].index === intFast.predictions[0].index)
  const top3Overlap = fpFast && intFast ? fpFast.predictions.filter(item => intFast.predictions.some(other => other.index === item.index)).length : 0

  return (
    <section className="mt-4 rounded-[30px] border border-violet-400/15 bg-[linear-gradient(180deg,rgba(8,13,30,0.98),rgba(4,9,22,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-violet-300"><PackageOpen className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.2em]">Quantization Lab v3 · same-backend matrix</p></div><h2 className="mt-2 text-2xl font-black text-white">FP32 vs INT8 · WASM y WebGPU</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Misma imagen y preprocesamiento. Cada modelo se mide por separado en WASM y WebGPU; el Router V3 guarda el backend ganador por modelo.</p></div><div className="rounded-2xl border border-violet-400/15 bg-violet-950/20 px-4 py-3 text-right"><p className="text-[10px] font-black uppercase text-slate-500">Reducción teórica</p><p className="mt-1 text-xl font-black text-violet-200">{sizeRatio ? `${sizeRatio.toFixed(2)}×` : "—"}</p><p className="text-[10px] text-slate-500">{fp32?.sizeMB || 0} MB → {int8?.sizeMB || 0} MB</p></div></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]"><label className="group relative grid min-h-52 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-violet-400/20 bg-slate-950/65 text-center">{preview ? <img src={preview} alt="Imagen para matriz cuantizada" className="absolute inset-0 h-full w-full object-cover" /> : <div><Upload className="mx-auto h-7 w-7 text-violet-300" /><p className="mt-2 text-xs font-black text-white">Subir imagen</p></div>}{preview ? <span className="absolute inset-x-3 bottom-3 rounded-xl bg-slate-950/85 px-3 py-2 text-[10px] font-black text-violet-100">Cambiar imagen</span> : null}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => chooseFile(event.target.files?.[0] || null)} /></label><div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="grid gap-2 sm:grid-cols-2">{[fp32, int8].map(model => model ? <div key={model.id} className="rounded-xl bg-black/20 p-3"><p className="text-[10px] uppercase text-slate-500">{model.id.includes("int8") ? "INT8 weight-only" : "FP32"}</p><p className="mt-1 text-sm font-black text-white">{model.name}</p><p className="text-xs text-slate-500">~{model.sizeMB} MB</p></div> : null)}</div><button type="button" onClick={() => void compare()} disabled={!file || running} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-950/30 px-4 py-3 text-sm font-black text-violet-100 disabled:opacity-40">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? phase || "Midiendo…" : results.length ? "Repetir matriz" : "Ejecutar matriz FP32 / INT8"}</button>{error ? <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-950/25 p-3 text-xs text-amber-100">{error}</div> : null}</div></div>
      {results.length ? <div className="mt-5"><div className="grid gap-3 lg:grid-cols-2">{[fp32, int8].map(model => model ? <article key={model.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><h3 className="font-black text-white">{model.name}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{(["wasm", "webgpu"] as BackendName[]).map(backend => { const item = results.find(result => result.modelId === model.id && result.backend === backend); return <div key={backend} className={`rounded-xl border p-3 ${item?.supported ? "border-cyan-400/15 bg-cyan-950/15" : "border-white/5 bg-black/20"}`}><div className="flex items-center justify-between"><span className="text-xs font-black text-white">{backend.toUpperCase()}</span>{item?.pooled ? <span className="text-[9px] font-black text-emerald-300">POOL HIT</span> : null}</div>{item?.supported ? <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div><span className="text-slate-600">E2E p50</span><p className="font-black text-white">{formatMs(item.endToEndMedianMs)}</p></div><div><span className="text-slate-600">E2E p95</span><p className="font-black text-white">{formatMs(item.endToEndP95Ms)}</p></div><div><span className="text-slate-600">Compute</span><p className="font-black text-white">{formatMs(item.computeMedianMs)}</p></div><div><span className="text-slate-600">Readback</span><p className="font-black text-white">{formatMs(item.readbackMedianMs)}</p></div><div className="col-span-2"><span className="text-slate-600">Adquirir modelo</span><p className="font-black text-white">{formatMs(item.acquireMs)}</p></div></div> : <p className="mt-2 text-[10px] text-slate-500">{item?.error || "No medido"}</p>}</div> })}</div></article> : null)}</div><div className="mt-3 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-emerald-400/15 bg-emerald-950/20 p-4"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><p className="mt-2 text-[10px] uppercase text-slate-500">Top-1</p><p className="font-black text-white">{top1Agreement ? "Coincide" : "Difiere"}</p></div><div className="rounded-2xl border border-cyan-400/15 bg-cyan-950/20 p-4"><p className="text-[10px] uppercase text-slate-500">Top-3 overlap</p><p className="mt-2 font-black text-white">{top3Overlap}/3 clases</p></div><div className="rounded-2xl border border-violet-400/15 bg-violet-950/20 p-4"><p className="text-[10px] uppercase text-slate-500">FP32 ganador</p><p className="mt-2 font-black text-white">{fpFast?.backend.toUpperCase() || "—"} · {fpFast ? formatMs(fpFast.endToEndMedianMs) : "—"}</p></div><div className="rounded-2xl border border-violet-400/15 bg-violet-950/20 p-4"><p className="text-[10px] uppercase text-slate-500">INT8 ganador</p><p className="mt-2 font-black text-white">{intFast?.backend.toUpperCase() || "—"} · {intFast ? formatMs(intFast.endToEndMedianMs) : "—"}</p></div></div></div> : null}
    </section>
  )
}
