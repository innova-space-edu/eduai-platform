"use client"

import { useEffect, useMemo, useState } from "react"
import { Cpu, Gauge, Loader2, Play, Trash2, Trophy } from "lucide-react"
import { DEFAULT_LITERT_PROBE_MODEL_ID, getLocalAIModel } from "@/lib/ai/local/litert-models"
import { getCachedModelSource } from "@/lib/ai/local/litert-model-cache"
import { getLiteRTRuntime } from "@/lib/ai/local/litert-runtime"
import { saveLiteRTRouteProfile } from "@/lib/ai/local/litert-router"
import { recordLocalAIEvent } from "@/lib/ai/local/litert-telemetry"

type BackendName = "webgpu" | "wasm"
type RunMeasurement = { computeMs: number; readbackMs: number; endToEndMs: number }
type MetricSummary = { averageMs: number; medianMs: number; p95Ms: number; minMs: number; maxMs: number; stdDevMs: number; cvPercent: number }
type BackendResult = {
  backend: BackendName
  supported: boolean
  compileMs: number
  cacheSource: "cache" | "network" | "direct" | null
  warmups: RunMeasurement[]
  runs: RunMeasurement[]
  compute: MetricSummary
  readback: MetricSummary
  endToEnd: MetricSummary
  error?: string
}
type BenchmarkSnapshot = {
  id: string
  createdAt: string
  webgpu: BackendResult
  wasm: BackendResult
  winner: BackendName | "tie" | "single" | "none"
  speedup: number | null
  threads: number | null
  runtimeReused: boolean
  runtimeAcquireMs: number
  routeSaved: boolean
}

const STORAGE_KEY = "eduai_litert_benchmark_v4"
const WARMUP_RUNS = 3
const MEASURED_RUNS = 20
const INPUT_SHAPE = [1, 3, 224, 224]
const INPUT_SIZE = INPUT_SHAPE.reduce((total, value) => total * value, 1)

function formatMs(value: number) {
  if (!Number.isFinite(value) || value < 0) return "—"
  return value < 100 ? `${value.toFixed(2)} ms` : `${Math.round(value)} ms`
}
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
function percentile(values: number[], fraction: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))]
}
function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
function standardDeviation(values: number[]) {
  if (values.length < 2) return 0
  const mean = average(values)
  return Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length)
}
function summarize(values: number[]): MetricSummary {
  const averageMs = average(values)
  const stdDevMs = standardDeviation(values)
  return {
    averageMs,
    medianMs: median(values),
    p95Ms: percentile(values, 0.95),
    minMs: values.length ? Math.min(...values) : 0,
    maxMs: values.length ? Math.max(...values) : 0,
    stdDevMs,
    cvPercent: averageMs > 0 ? (stdDevMs / averageMs) * 100 : 0,
  }
}
function emptyMetric(): MetricSummary { return { averageMs: 0, medianMs: 0, p95Ms: 0, minMs: 0, maxMs: 0, stdDevMs: 0, cvPercent: 0 } }
function emptyResult(backend: BackendName, error: string): BackendResult {
  return { backend, supported: false, compileMs: 0, cacheSource: null, warmups: [], runs: [], compute: emptyMetric(), readback: emptyMetric(), endToEnd: emptyMetric(), error }
}
function makeInput() {
  const data = new Float32Array(INPUT_SIZE)
  for (let index = 0; index < data.length; index += 1) data[index] = ((index % 251) / 250 - 0.5) * 2
  return data
}
function firstOutput(outputs: any) {
  if (Array.isArray(outputs)) return outputs[0]
  if (outputs && typeof outputs === "object") return Object.values(outputs)[0] as any
  return null
}
function disposeOutputs(outputs: any) {
  if (Array.isArray(outputs)) outputs.forEach(output => output?.delete?.())
  else if (outputs && typeof outputs === "object") Object.values(outputs).forEach(output => (output as any)?.delete?.())
}
function Sparkline({ values, max }: { values: number[]; max: number }) {
  if (!values.length || max <= 0) return <div className="h-12" />
  const width = 220
  const height = 48
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
    const y = height - Math.max(5, (value / max) * (height - 10))
    return `${x},${y}`
  }).join(" ")
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full overflow-visible"><polyline points={points} fill="none" stroke="rgb(34 211 238)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export default function LiteRTBenchmarkPanelV4() {
  const probeModel = getLocalAIModel(DEFAULT_LITERT_PROBE_MODEL_ID)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState("")
  const [latest, setLatest] = useState<BenchmarkSnapshot | null>(null)
  const [history, setHistory] = useState<BenchmarkSnapshot[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as BenchmarkSnapshot[]
      if (Array.isArray(saved)) { setHistory(saved.slice(0, 5)); setLatest(saved[0] || null) }
    } catch { /* historial opcional */ }
  }, [])

  const graphMax = useMemo(() => latest ? Math.max(...latest.webgpu.runs.map(run => run.endToEndMs), ...latest.wasm.runs.map(run => run.endToEndMs), 1) : 0, [latest])

  async function measureRun(litert: any, model: any, shape: number[], baseInput: Float32Array): Promise<RunMeasurement> {
    const tensor = new litert.Tensor(baseInput, shape)
    const started = performance.now()
    const outputs = await model.run(tensor)
    const computeMs = performance.now() - started
    tensor.delete?.()
    const output = firstOutput(outputs)
    if (!output) { disposeOutputs(outputs); throw new Error("LiteRT no devolvió salida para medir readback.") }
    const readbackStarted = performance.now()
    await output.data()
    const readbackMs = performance.now() - readbackStarted
    const endToEndMs = performance.now() - started
    disposeOutputs(outputs)
    return { computeMs, readbackMs, endToEndMs }
  }

  async function runBackend(litert: any, backend: BackendName): Promise<BackendResult> {
    if (!probeModel) return emptyResult(backend, "Modelo de prueba no configurado")
    if (backend === "webgpu" && !("gpu" in navigator)) return emptyResult(backend, "WebGPU no está disponible")
    let model: any = null
    let source: Awaited<ReturnType<typeof getCachedModelSource>> | null = null
    try {
      setPhase(`Preparando ${backend.toUpperCase()}…`)
      source = await getCachedModelSource(probeModel.modelUrl)
      const compileStarted = performance.now()
      model = await litert.loadAndCompile(source.url, { accelerator: backend, __eduaiModelId: probeModel.id })
      const compileMs = performance.now() - compileStarted
      const details = typeof model.getInputDetails === "function" ? model.getInputDetails() : []
      const shape = Array.isArray(details?.[0]?.shape) ? details[0].shape.map((value: unknown) => Number(value)) : INPUT_SHAPE
      if (shape.join(",") !== INPUT_SHAPE.join(",")) throw new Error(`Forma de entrada inesperada [${shape.join(", ")}]`)
      const baseInput = makeInput()
      const warmups: RunMeasurement[] = []
      for (let index = 0; index < WARMUP_RUNS; index += 1) {
        setPhase(`${backend.toUpperCase()} · warm-up E2E ${index + 1}/${WARMUP_RUNS}`)
        warmups.push(await measureRun(litert, model, shape, baseInput))
        await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
      }
      const runs: RunMeasurement[] = []
      for (let index = 0; index < MEASURED_RUNS; index += 1) {
        setPhase(`${backend.toUpperCase()} · E2E ${index + 1}/${MEASURED_RUNS}`)
        runs.push(await measureRun(litert, model, shape, baseInput))
        if ((index + 1) % 5 === 0) await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
      }
      return {
        backend,
        supported: true,
        compileMs,
        cacheSource: source.source,
        warmups,
        runs,
        compute: summarize(runs.map(run => run.computeMs)),
        readback: summarize(runs.map(run => run.readbackMs)),
        endToEnd: summarize(runs.map(run => run.endToEndMs)),
      }
    } catch (caught) {
      return emptyResult(backend, caught instanceof Error ? caught.message : "Benchmark no disponible")
    } finally {
      source?.cleanup()
      model?.delete?.()
    }
  }

  async function runBenchmark() {
    if (!probeModel || running) return
    setRunning(true); setError(""); setPhase("Adquiriendo runtime compartido…")
    try {
      const runtime = await getLiteRTRuntime()
      const wasm = await runBackend(runtime.litert, "wasm")
      const webgpu = await runBackend(runtime.litert, "webgpu")
      let winner: BenchmarkSnapshot["winner"] = "none"
      let speedup: number | null = null
      if (webgpu.supported && wasm.supported) {
        const faster = Math.min(webgpu.endToEnd.medianMs, wasm.endToEnd.medianMs)
        const slower = Math.max(webgpu.endToEnd.medianMs, wasm.endToEnd.medianMs)
        const relativeDelta = faster > 0 ? (slower - faster) / faster : 0
        winner = relativeDelta < 0.05 ? "tie" : webgpu.endToEnd.medianMs < wasm.endToEnd.medianMs ? "webgpu" : "wasm"
        speedup = faster > 0 ? slower / faster : null
      } else if (webgpu.supported || wasm.supported) winner = "single"

      let routeSaved = false
      if (winner === "webgpu" || winner === "wasm") {
        const selected = winner === "webgpu" ? webgpu : wasm
        const alternative = winner === "webgpu" ? wasm : webgpu
        saveLiteRTRouteProfile({
          backend: winner,
          modelId: probeModel.id,
          medianEndToEndMs: selected.endToEnd.medianMs,
          p95EndToEndMs: selected.endToEnd.p95Ms,
          alternativeMedianEndToEndMs: alternative.supported ? alternative.endToEnd.medianMs : null,
        })
        routeSaved = true
      }

      const snapshot: BenchmarkSnapshot = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        webgpu,
        wasm,
        winner,
        speedup,
        threads: navigator.hardwareConcurrency || null,
        runtimeReused: runtime.reused,
        runtimeAcquireMs: runtime.acquireMs,
        routeSaved,
      }
      const next = [snapshot, ...history].slice(0, 5)
      setLatest(snapshot); setHistory(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next))

      for (const result of [webgpu, wasm]) {
        if (!result.supported) continue
        recordLocalAIEvent({
          groupId: snapshot.id,
          kind: "benchmark",
          backend: result.backend,
          modelId: probeModel.id,
          latencyMs: result.endToEnd.medianMs,
          compileMs: result.compileMs,
          runCount: result.runs.length,
          runtimeReused: runtime.reused,
          success: true,
          note: `E2E p95 ${formatMs(result.endToEnd.p95Ms)} · compute ${formatMs(result.compute.medianMs)} · readback ${formatMs(result.readback.medianMs)} · ${result.cacheSource}`,
        })
      }
      setPhase("Benchmark V4 end-to-end completado")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible ejecutar el benchmark.")
      setPhase("")
    } finally { setRunning(false) }
  }

  function clearHistory() { localStorage.removeItem(STORAGE_KEY); setLatest(null); setHistory([]); setError("") }
  const winnerLabel = latest?.winner === "webgpu" ? "WebGPU" : latest?.winner === "wasm" ? "WASM / CPU" : latest?.winner === "tie" ? "Empate técnico" : latest?.winner === "single" ? "Solo un backend" : "Sin resultado"

  return (
    <section className="rounded-[30px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(4,13,29,0.99),rgba(3,8,20,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-cyan-300"><Gauge className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.22em]">Performance Lab · end-to-end v4</p></div><h2 className="mt-2 text-2xl font-black text-white">Benchmark WebGPU vs WASM</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Mide compute, readback y end-to-end con {WARMUP_RUNS} warm-ups y {MEASURED_RUNS} corridas. Router V3 guarda la ruta ganadora por modelo usando la mediana end-to-end.</p></div>
        <div className="flex gap-2">{history.length ? <button type="button" onClick={clearHistory} disabled={running} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs font-black text-slate-400"><Trash2 className="h-3.5 w-3.5" /> Limpiar</button> : null}<button type="button" onClick={() => void runBenchmark()} disabled={running} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-950/25 px-4 py-2 text-sm font-black text-cyan-100 disabled:opacity-50">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? phase || "Midiendo…" : latest ? "Repetir benchmark V4" : "Ejecutar benchmark V4"}</button></div>
      </div>
      {running ? <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-950/20 p-4"><p className="text-xs font-black text-cyan-100">{phase}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" /></div></div> : null}
      {error ? <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-950/25 p-4 text-xs text-amber-100">{error}</div> : null}
      {latest ? <>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_0.75fr]">
          {[latest.webgpu, latest.wasm].map(result => {
            const Icon = result.backend === "webgpu" ? Gauge : Cpu
            const isWinner = latest.winner === result.backend
            return <article key={result.backend} className={`rounded-[24px] border p-4 ${isWinner ? "border-emerald-400/25 bg-emerald-950/20" : "border-white/10 bg-slate-950/55"}`}>
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-cyan-300" /><h3 className="font-black text-white">{result.backend === "webgpu" ? "WebGPU" : "WASM / CPU"}</h3></div>{isWinner ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 px-2 py-1 text-[10px] font-black text-emerald-200"><Trophy className="h-3 w-3" /> Ganador E2E</span> : null}</div>
              <p className="mt-3 text-3xl font-black text-white">{result.supported ? formatMs(result.endToEnd.medianMs) : "N/D"}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">end-to-end mediana · {MEASURED_RUNS} corridas</p>
              <div className="mt-3"><Sparkline values={result.runs.map(run => run.endToEndMs)} max={graphMax} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-3">{[
                ["Compute p50", formatMs(result.compute.medianMs)], ["Readback p50", formatMs(result.readback.medianMs)], ["E2E p95", formatMs(result.endToEnd.p95Ms)], ["E2E media", formatMs(result.endToEnd.averageMs)], ["E2E desv.", formatMs(result.endToEnd.stdDevMs)], ["E2E CV", result.supported ? `${result.endToEnd.cvPercent.toFixed(1)}%` : "—"],
              ].map(([label, value]) => <div key={label} className="rounded-xl bg-black/25 p-2"><p className="text-slate-600">{label}</p><p className="mt-1 font-black text-slate-300">{value}</p></div>)}</div>
              <div className="mt-2 rounded-xl bg-black/20 p-2 text-[10px] text-slate-500">Carga + compilación: <span className="font-black text-slate-300">{formatMs(result.compileMs)}</span> · fuente <span className="font-black text-slate-300">{result.cacheSource || "—"}</span></div>{!result.supported ? <p className="mt-3 text-xs text-amber-300">{result.error}</p> : null}
            </article>
          })}
          <article className="rounded-[24px] border border-violet-400/15 bg-violet-950/20 p-4"><div className="flex items-center gap-2 text-violet-200"><Trophy className="h-4 w-4" /><span className="text-xs font-black uppercase">Router V3 · por modelo</span></div><p className="mt-4 text-2xl font-black text-white">{winnerLabel}</p><p className="mt-2 text-xs leading-relaxed text-slate-400">{latest.speedup ? `La mediana end-to-end del ganador es ${latest.speedup.toFixed(2)}× más rápida en este dispositivo.` : "No hay dos backends válidos para calcular aceleración."}</p><div className="mt-4 rounded-2xl border border-white/5 bg-black/25 p-3 text-[10px] leading-5 text-slate-500"><p>Modelo: <span className="font-black text-slate-300">{probeModel?.id || "—"}</span></p><p>Perfil guardado: <span className="font-black text-slate-300">{latest.routeSaved ? "sí" : "no"}</span></p><p>Runtime: <span className="font-black text-slate-300">{latest.runtimeReused ? "reutilizado" : "inicializado"}</span></p><p>Adquisición: <span className="font-black text-slate-300">{formatMs(latest.runtimeAcquireMs)}</span></p><p>CPU threads: <span className="font-black text-slate-300">{latest.threads || "—"}</span></p></div></article>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4"><p className="text-xs font-black text-white">Comparación visual · menor end-to-end es mejor</p><div className="mt-4 space-y-3">{[latest.webgpu, latest.wasm].map(result => { const maxMedian = Math.max(latest.webgpu.endToEnd.medianMs || 0, latest.wasm.endToEnd.medianMs || 0, 1); return <div key={result.backend}><div className="mb-1 flex justify-between text-[10px]"><span className="font-black text-slate-500">{result.backend.toUpperCase()}</span><span className="font-black text-slate-300">{formatMs(result.endToEnd.medianMs)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${Math.max(3, (result.endToEnd.medianMs / maxMedian) * 100)}%` }} /></div></div> })}</div></div>
      </> : null}
    </section>
  )
}