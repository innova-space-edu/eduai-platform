"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, Cpu, Gauge, History, Loader2, Play, Trash2, Trophy, Zap } from "lucide-react"
import { DEFAULT_LITERT_PROBE_MODEL_ID, getLocalAIModel } from "@/lib/ai/local/litert-models"
import { getLiteRTRuntime } from "@/lib/ai/local/litert-runtime"

type BackendName = "webgpu" | "wasm"

type BackendResult = {
  backend: BackendName
  supported: boolean
  compileMs: number
  warmupMs: number
  runs: number[]
  averageMs: number
  minMs: number
  maxMs: number
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
}

const STORAGE_KEY = "eduai_litert_benchmark_v2"
const RUNS = 5
const INPUT_SHAPE = [1, 3, 224, 224]
const INPUT_SIZE = INPUT_SHAPE.reduce((total, value) => total * value, 1)

function formatMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—"
  return value < 100 ? `${value.toFixed(1)} ms` : `${Math.round(value)} ms`
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0
  const mean = average(values)
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

function stabilityScore(result: BackendResult) {
  if (!result.supported || !result.runs.length || result.averageMs <= 0) return 0
  const coefficient = standardDeviation(result.runs) / result.averageMs
  return Math.max(0, Math.min(100, Math.round(100 - coefficient * 250)))
}

function makeInput() {
  const data = new Float32Array(INPUT_SIZE)
  for (let index = 0; index < data.length; index += 1) data[index] = ((index % 251) / 250 - 0.5) * 2
  return data
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

function Sparkline({ values, max }: { values: number[]; max: number }) {
  if (!values.length || max <= 0) return <div className="h-10" />
  const width = 180
  const height = 40
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
    const y = height - Math.max(4, (value / max) * (height - 8))
    return `${x},${y}`
  }).join(" ")
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full overflow-visible"><polyline points={points} fill="none" stroke="rgb(34 211 238)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />{values.map((value, index) => { const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width; const y = height - Math.max(4, (value / max) * (height - 8)); return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.5" fill="rgb(52 211 153)" /> })}</svg>
}

export default function LiteRTBenchmarkPanelV2() {
  const probeModel = getLocalAIModel(DEFAULT_LITERT_PROBE_MODEL_ID)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState("")
  const [latest, setLatest] = useState<BenchmarkSnapshot | null>(null)
  const [history, setHistory] = useState<BenchmarkSnapshot[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as BenchmarkSnapshot[]
      if (Array.isArray(saved)) {
        setHistory(saved.slice(0, 5))
        setLatest(saved[0] || null)
      }
    } catch {
      // No bloquear por historial corrupto.
    }
  }, [])

  const maxGraphValue = useMemo(() => latest ? Math.max(...latest.webgpu.runs, ...latest.wasm.runs, 1) : 0, [latest])

  async function runBackend(litert: any, backend: BackendName): Promise<BackendResult> {
    if (!probeModel) return { backend, supported: false, compileMs: 0, warmupMs: 0, runs: [], averageMs: 0, minMs: 0, maxMs: 0, error: "Modelo de prueba no configurado" }
    if (backend === "webgpu" && !("gpu" in navigator)) return { backend, supported: false, compileMs: 0, warmupMs: 0, runs: [], averageMs: 0, minMs: 0, maxMs: 0, error: "WebGPU no disponible" }

    let model: any = null
    try {
      setPhase(`Compilando ${backend.toUpperCase()}…`)
      const compileStart = performance.now()
      model = await litert.loadAndCompile(probeModel.modelUrl, { accelerator: backend })
      const compileMs = performance.now() - compileStart
      const details = typeof model.getInputDetails === "function" ? model.getInputDetails() : []
      const shape = Array.isArray(details?.[0]?.shape) ? details[0].shape.map((value: unknown) => Number(value)) : INPUT_SHAPE
      if (shape.join(",") !== INPUT_SHAPE.join(",")) throw new Error(`Forma de entrada inesperada [${shape.join(", ")}]`)

      const baseInput = makeInput()
      setPhase(`Warm-up ${backend.toUpperCase()}…`)
      const warmTensor = new litert.Tensor(baseInput, shape)
      const warmStart = performance.now()
      const warmOutputs = await model.run(warmTensor)
      const warmupMs = performance.now() - warmStart
      warmTensor.delete?.()
      disposeOutputs(warmOutputs)

      const runs: number[] = []
      for (let index = 0; index < RUNS; index += 1) {
        setPhase(`${backend.toUpperCase()} · corrida ${index + 1}/${RUNS}`)
        const tensor = new litert.Tensor(baseInput, shape)
        const started = performance.now()
        const outputs = await model.run(tensor)
        runs.push(performance.now() - started)
        tensor.delete?.()
        disposeOutputs(outputs)
        await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
      }

      return { backend, supported: true, compileMs, warmupMs, runs, averageMs: average(runs), minMs: Math.min(...runs), maxMs: Math.max(...runs) }
    } catch (caught) {
      return { backend, supported: false, compileMs: 0, warmupMs: 0, runs: [], averageMs: 0, minMs: 0, maxMs: 0, error: caught instanceof Error ? caught.message : "Benchmark no disponible" }
    } finally {
      model?.delete?.()
    }
  }

  async function runBenchmark() {
    if (!probeModel || running) return
    setRunning(true)
    setError("")
    setPhase("Adquiriendo runtime compartido…")
    try {
      const runtime = await getLiteRTRuntime()
      const wasm = await runBackend(runtime.litert, "wasm")
      const webgpu = await runBackend(runtime.litert, "webgpu")

      let winner: BenchmarkSnapshot["winner"] = "none"
      let speedup: number | null = null
      if (webgpu.supported && wasm.supported) {
        if (Math.abs(webgpu.averageMs - wasm.averageMs) < 0.5) winner = "tie"
        else winner = webgpu.averageMs < wasm.averageMs ? "webgpu" : "wasm"
        const faster = Math.min(webgpu.averageMs, wasm.averageMs)
        const slower = Math.max(webgpu.averageMs, wasm.averageMs)
        speedup = faster > 0 ? slower / faster : null
      } else if (webgpu.supported || wasm.supported) winner = "single"

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
      }
      const next = [snapshot, ...history].slice(0, 5)
      setLatest(snapshot)
      setHistory(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setPhase("Benchmark completado")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible ejecutar el benchmark.")
      setPhase("")
    } finally {
      setRunning(false)
    }
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY)
    setLatest(null)
    setHistory([])
    setError("")
  }

  const winnerLabel = latest?.winner === "webgpu" ? "WebGPU" : latest?.winner === "wasm" ? "WASM / CPU" : latest?.winner === "tie" ? "Empate técnico" : latest?.winner === "single" ? "Solo un backend" : "Sin resultado"

  return (
    <section className="rounded-[30px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(4,13,29,0.99),rgba(3,8,20,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-cyan-300"><Gauge className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.22em]">Performance Lab</p></div><h2 className="mt-2 text-2xl font-black text-white">Benchmark WebGPU vs WASM</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Reutiliza el runtime LiteRT compartido, compila el mismo MobileNet en ambos backends y compara {RUNS} inferencias calientes por backend.</p></div>
        <div className="flex flex-wrap gap-2">{history.length ? <button type="button" onClick={clearHistory} disabled={running} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-xs font-black text-slate-400"><Trash2 className="h-3.5 w-3.5" /> Limpiar historial</button> : null}<button type="button" onClick={() => void runBenchmark()} disabled={running} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-950/25 px-4 py-2.5 text-sm font-black text-cyan-100 disabled:opacity-50">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? phase || "Midiendo…" : latest ? "Repetir benchmark" : "Comparar backends"}</button></div>
      </div>

      {running ? <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-950/20 p-4"><div className="flex items-center gap-3"><span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" /><span className="relative h-3 w-3 rounded-full bg-cyan-300" /></span><div className="flex-1"><p className="text-xs font-black text-cyan-100">{phase}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" /></div></div></div></div> : null}
      {error ? <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-950/25 p-4 text-xs text-amber-100">{error}</div> : null}

      {latest ? <>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
          {[latest.webgpu, latest.wasm].map(result => { const Icon = result.backend === "webgpu" ? Gauge : Cpu; const isWinner = latest.winner === result.backend; return <article key={result.backend} className={`rounded-[24px] border p-4 ${isWinner ? "border-emerald-400/25 bg-emerald-950/20" : "border-white/10 bg-slate-950/55"}`}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-cyan-300" /><h3 className="font-black text-white">{result.backend === "webgpu" ? "WebGPU" : "WASM / CPU"}</h3></div>{isWinner ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 px-2 py-1 text-[10px] font-black text-emerald-200"><Trophy className="h-3 w-3" /> Ganador</span> : null}</div><p className="mt-3 text-3xl font-black text-white">{result.supported ? formatMs(result.averageMs) : "N/D"}</p><p className="mt-1 text-[10px] uppercase text-slate-600">warm average</p><div className="mt-3"><Sparkline values={result.runs} max={maxGraphValue} /></div><div className="mt-3 grid grid-cols-3 gap-2 text-[10px]"><div className="rounded-xl bg-black/25 p-2"><p className="text-slate-600">Min</p><p className="mt-1 font-black text-slate-300">{formatMs(result.minMs)}</p></div><div className="rounded-xl bg-black/25 p-2"><p className="text-slate-600">Cold</p><p className="mt-1 font-black text-slate-300">{formatMs(result.compileMs)}</p></div><div className="rounded-xl bg-black/25 p-2"><p className="text-slate-600">Estabilidad</p><p className="mt-1 font-black text-slate-300">{stabilityScore(result)}/100</p></div></div>{!result.supported ? <p className="mt-3 text-xs text-amber-300">{result.error}</p> : null}</article> })}
          <article className="rounded-[24px] border border-violet-400/15 bg-violet-950/20 p-4"><div className="flex items-center gap-2 text-violet-200"><Trophy className="h-4 w-4" /><span className="text-xs font-black uppercase">Resultado</span></div><p className="mt-4 text-2xl font-black text-white">{winnerLabel}</p><p className="mt-2 text-xs leading-relaxed text-slate-400">{latest.speedup ? `El backend más rápido fue ${latest.speedup.toFixed(2)}× más veloz en este dispositivo.` : "No hay dos backends válidos para calcular aceleración."}</p><div className="mt-4 rounded-2xl border border-white/5 bg-black/25 p-3 text-[10px] text-slate-500"><p>Runtime: <span className="font-black text-slate-300">{latest.runtimeReused ? "reutilizado" : "inicializado"}</span></p><p className="mt-1">Adquisición: <span className="font-black text-slate-300">{formatMs(latest.runtimeAcquireMs)}</span></p><p className="mt-1">CPU threads: <span className="font-black text-slate-300">{latest.threads || "—"}</span></p></div></article>
        </div>
        <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/55 p-4"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300" /><p className="text-xs font-black text-white">Comparación visual · menos es mejor</p></div><div className="mt-3 space-y-3">{[latest.webgpu, latest.wasm].filter(item => item.supported).map(result => { const slowest = Math.max(latest.webgpu.averageMs, latest.wasm.averageMs, 1); const width = Math.max(8, (result.averageMs / slowest) * 100); return <div key={result.backend}><div className="mb-1 flex items-center justify-between text-[10px]"><span className="font-black uppercase text-slate-500">{result.backend}</span><span className="font-black text-slate-300">{formatMs(result.averageMs)}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-1000" style={{ width: `${width}%` }} /></div></div> })}</div></div>
      </> : <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4"><Gauge className="h-5 w-5 text-cyan-300" /><p className="mt-3 text-sm font-black text-white">WebGPU</p><p className="mt-1 text-xs text-slate-500">GPU del navegador.</p></div><div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4"><Cpu className="h-5 w-5 text-violet-300" /><p className="mt-3 text-sm font-black text-white">WASM / CPU</p><p className="mt-1 text-xs text-slate-500">Fallback CPU.</p></div><div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4"><Zap className="h-5 w-5 text-emerald-300" /><p className="mt-3 text-sm font-black text-white">Runtime único</p><p className="mt-1 text-xs text-slate-500">Sin doble inicialización.</p></div></div>}

      {history.length > 1 ? <div className="mt-5 rounded-2xl border border-white/8 bg-slate-950/55 p-4"><div className="flex items-center gap-2 text-slate-300"><History className="h-4 w-4" /><p className="text-xs font-black">Historial local</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{history.slice(1, 5).map(snapshot => <div key={snapshot.id} className="rounded-xl border border-white/5 bg-black/20 p-3 text-[10px]"><p className="font-black text-slate-300">{new Date(snapshot.createdAt).toLocaleString("es-CL")}</p><p className="mt-2 text-slate-500">WebGPU: <span className="font-black text-slate-300">{formatMs(snapshot.webgpu.averageMs)}</span></p><p className="mt-1 text-slate-500">WASM: <span className="font-black text-slate-300">{formatMs(snapshot.wasm.averageMs)}</span></p></div>)}</div></div> : null}
    </section>
  )
}
