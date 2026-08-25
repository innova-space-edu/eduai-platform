"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, Cpu, Gauge, History, Loader2, Play, Trophy, Zap } from "lucide-react"
import {
  DEFAULT_LITERT_PROBE_MODEL_ID,
  EDUAI_LITERT_ESM_URL,
  EDUAI_LITERT_WASM_URL,
  getLocalAIModel,
} from "@/lib/ai/local/litert-models"

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
}

const STORAGE_KEY = "eduai_litert_benchmark_v1"
const BENCHMARK_RUNS = 4
const INPUT_SHAPE = [1, 3, 224, 224]
const INPUT_SIZE = INPUT_SHAPE.reduce((total, value) => total * value, 1)

function formatMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—"
  return value < 100 ? `${value.toFixed(1)} ms` : `${Math.round(value)} ms`
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

function makeInput() {
  const data = new Float32Array(INPUT_SIZE)
  for (let index = 0; index < data.length; index += 1) {
    data[index] = ((index % 251) / 250 - 0.5) * 2
  }
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

function resultSummary(result: BackendResult) {
  if (!result.supported) return result.error || "No disponible"
  return `${formatMs(result.averageMs)} promedio`
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full overflow-visible">
      <polyline points={points} fill="none" stroke="rgb(34 211 238)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((value, index) => {
        const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
        const y = height - Math.max(4, (value / max) * (height - 8))
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.5" fill="rgb(52 211 153)" />
      })}
    </svg>
  )
}

export default function LiteRTBenchmarkPanel() {
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState("")
  const [latest, setLatest] = useState<BenchmarkSnapshot | null>(null)
  const [history, setHistory] = useState<BenchmarkSnapshot[]>([])
  const [error, setError] = useState("")

  const probeModel = getLocalAIModel(DEFAULT_LITERT_PROBE_MODEL_ID)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as BenchmarkSnapshot[]
      if (Array.isArray(saved)) {
        setHistory(saved.slice(0, 5))
        setLatest(saved[0] || null)
      }
    } catch {
      // Un historial corrupto no debe bloquear el laboratorio.
    }
  }, [])

  const maxGraphValue = useMemo(() => {
    if (!latest) return 0
    return Math.max(...latest.webgpu.runs, ...latest.wasm.runs, 1)
  }, [latest])

  async function runBackend(litert: any, backend: BackendName): Promise<BackendResult> {
    if (!probeModel) {
      return { backend, supported: false, compileMs: 0, warmupMs: 0, runs: [], averageMs: 0, minMs: 0, maxMs: 0, error: "Modelo de prueba no configurado" }
    }

    if (backend === "webgpu" && !("gpu" in navigator)) {
      return { backend, supported: false, compileMs: 0, warmupMs: 0, runs: [], averageMs: 0, minMs: 0, maxMs: 0, error: "WebGPU no está disponible en este navegador" }
    }

    let model: any = null
    try {
      setPhase(`Compilando ${backend === "webgpu" ? "WebGPU" : "WASM"}…`)
      const compileStart = performance.now()
      model = await litert.loadAndCompile(probeModel.modelUrl, { accelerator: backend })
      const compileMs = performance.now() - compileStart

      const details = typeof model.getInputDetails === "function" ? model.getInputDetails() : []
      const shape = Array.isArray(details?.[0]?.shape) ? details[0].shape.map((value: unknown) => Number(value)) : INPUT_SHAPE
      if (shape.join(",") !== INPUT_SHAPE.join(",")) {
        throw new Error(`Forma de entrada inesperada [${shape.join(", ")}]`)
      }

      const baseInput = makeInput()
      setPhase(`Calentando ${backend === "webgpu" ? "WebGPU" : "WASM"}…`)
      const warmupTensor = new litert.Tensor(baseInput, shape)
      const warmupStart = performance.now()
      const warmupOutputs = await model.run(warmupTensor)
      const warmupMs = performance.now() - warmupStart
      warmupTensor.delete?.()
      disposeOutputs(warmupOutputs)

      const runs: number[] = []
      for (let run = 0; run < BENCHMARK_RUNS; run += 1) {
        setPhase(`${backend === "webgpu" ? "WebGPU" : "WASM"} · corrida ${run + 1}/${BENCHMARK_RUNS}`)
        const tensor = new litert.Tensor(baseInput, shape)
        const started = performance.now()
        const outputs = await model.run(tensor)
        runs.push(performance.now() - started)
        tensor.delete?.()
        disposeOutputs(outputs)
        await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
      }

      return {
        backend,
        supported: true,
        compileMs,
        warmupMs,
        runs,
        averageMs: average(runs),
        minMs: Math.min(...runs),
        maxMs: Math.max(...runs),
      }
    } catch (backendError) {
      return {
        backend,
        supported: false,
        compileMs: 0,
        warmupMs: 0,
        runs: [],
        averageMs: 0,
        minMs: 0,
        maxMs: 0,
        error: backendError instanceof Error ? backendError.message : "Benchmark no disponible",
      }
    } finally {
      model?.delete?.()
    }
  }

  async function runBenchmark() {
    if (!probeModel || running) return
    setRunning(true)
    setError("")
    setPhase("Inicializando LiteRT.js…")

    try {
      const litert = await import(/* webpackIgnore: true */ EDUAI_LITERT_ESM_URL)
      if (typeof litert.loadLiteRt !== "function" || typeof litert.loadAndCompile !== "function" || typeof litert.Tensor !== "function") {
        throw new Error("LiteRT.js no expone la API de benchmark esperada.")
      }
      await litert.loadLiteRt(EDUAI_LITERT_WASM_URL)

      // WASM primero deja una base CPU estable. La comparación usa solo tiempo de inferencia,
      // no tiempo de descarga/compilación del modelo.
      const wasm = await runBackend(litert, "wasm")
      const webgpu = await runBackend(litert, "webgpu")

      let winner: BenchmarkSnapshot["winner"] = "none"
      let speedup: number | null = null
      if (webgpu.supported && wasm.supported) {
        if (Math.abs(webgpu.averageMs - wasm.averageMs) < 0.5) winner = "tie"
        else winner = webgpu.averageMs < wasm.averageMs ? "webgpu" : "wasm"
        const faster = Math.min(webgpu.averageMs, wasm.averageMs)
        const slower = Math.max(webgpu.averageMs, wasm.averageMs)
        speedup = faster > 0 ? slower / faster : null
      } else if (webgpu.supported || wasm.supported) {
        winner = "single"
      }

      const snapshot: BenchmarkSnapshot = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        webgpu,
        wasm,
        winner,
        speedup,
        threads: navigator.hardwareConcurrency || null,
      }
      const nextHistory = [snapshot, ...history].slice(0, 5)
      setLatest(snapshot)
      setHistory(nextHistory)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory))
      setPhase("Benchmark completado")
    } catch (benchmarkError) {
      setError(benchmarkError instanceof Error ? benchmarkError.message : "No fue posible ejecutar el benchmark.")
      setPhase("")
    } finally {
      setRunning(false)
    }
  }

  const winnerLabel = latest?.winner === "webgpu"
    ? "WebGPU"
    : latest?.winner === "wasm"
      ? "WASM / CPU"
      : latest?.winner === "tie"
        ? "Empate técnico"
        : latest?.winner === "single"
          ? "Solo un backend disponible"
          : "Sin resultado"

  return (
    <section className="rounded-[30px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_30%),linear-gradient(180deg,rgba(4,13,29,0.98),rgba(5,10,24,0.98))] p-5 shadow-[0_22px_70px_rgba(8,47,73,0.16)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            <Gauge className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.22em]">Performance Lab</p>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Benchmark WebGPU vs WASM</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Ejecuta el mismo MobileNet V3 Small con ambos backends, descarta una corrida de calentamiento y compara {BENCHMARK_RUNS} inferencias medidas. Menor latencia es mejor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runBenchmark()}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? phase || "Midiendo…" : latest ? "Repetir benchmark" : "Comparar backends"}
        </button>
      </div>

      {running ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.05] p-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-300" /></span>
            <div className="flex-1">
              <p className="text-xs font-black text-cyan-100">{phase}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300" /></div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-xs text-amber-100">{error}</div> : null}

      {latest ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
            {[latest.webgpu, latest.wasm].map(result => {
              const Icon = result.backend === "webgpu" ? Gauge : Cpu
              const isWinner = latest.winner === result.backend
              return (
                <article key={result.backend} className={`rounded-[24px] border p-4 ${isWinner ? "border-emerald-400/25 bg-emerald-500/[0.06]" : "border-white/10 bg-black/20"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-cyan-300" /><h3 className="font-black text-white">{result.backend === "webgpu" ? "WebGPU" : "WASM / CPU"}</h3></div>
                    {isWinner ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-200"><Trophy className="h-3 w-3" /> Ganador</span> : null}
                  </div>
                  <p className={`mt-3 text-3xl font-black ${result.supported ? "text-white" : "text-slate-600"}`}>{result.supported ? formatMs(result.averageMs) : "N/D"}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">promedio de inferencia</p>
                  <div className="mt-3"><Sparkline values={result.runs} max={maxGraphValue} /></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="rounded-xl bg-slate-950/50 p-2"><p className="text-slate-600">Min</p><p className="mt-1 font-black text-slate-300">{formatMs(result.minMs)}</p></div>
                    <div className="rounded-xl bg-slate-950/50 p-2"><p className="text-slate-600">Max</p><p className="mt-1 font-black text-slate-300">{formatMs(result.maxMs)}</p></div>
                    <div className="rounded-xl bg-slate-950/50 p-2"><p className="text-slate-600">Compile</p><p className="mt-1 font-black text-slate-300">{formatMs(result.compileMs)}</p></div>
                  </div>
                  {!result.supported ? <p className="mt-3 text-xs leading-relaxed text-amber-300/80">{result.error}</p> : null}
                </article>
              )
            })}

            <article className="rounded-[24px] border border-violet-400/15 bg-violet-500/[0.045] p-4">
              <div className="flex items-center gap-2 text-violet-200"><Trophy className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-wider">Resultado</span></div>
              <p className="mt-4 text-2xl font-black text-white">{winnerLabel}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {latest.speedup ? `El backend más rápido fue aproximadamente ${latest.speedup.toFixed(2)}× más veloz en este benchmark.` : "No hay dos backends válidos para calcular un factor de aceleración."}
              </p>
              <div className="mt-4 rounded-2xl border border-white/5 bg-slate-950/50 p-3 text-[10px] text-slate-500">
                <p>CPU threads: <span className="font-black text-slate-300">{latest.threads || "—"}</span></p>
                <p className="mt-1">Modelo: <span className="font-black text-slate-300">{probeModel?.name || DEFAULT_LITERT_PROBE_MODEL_ID}</span></p>
                <p className="mt-1">Corridas medidas: <span className="font-black text-slate-300">{BENCHMARK_RUNS} por backend</span></p>
              </div>
            </article>
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300" /><p className="text-xs font-black text-white">Comparación visual · menos es mejor</p></div>
            <div className="mt-3 space-y-3">
              {[latest.webgpu, latest.wasm].filter(item => item.supported).map(result => {
                const slowest = Math.max(latest.webgpu.averageMs, latest.wasm.averageMs, 1)
                const width = Math.max(8, (result.averageMs / slowest) * 100)
                return (
                  <div key={`bar-${result.backend}`}>
                    <div className="mb-1 flex items-center justify-between text-[10px]"><span className="font-black uppercase text-slate-500">{result.backend}</span><span className="font-black text-slate-300">{formatMs(result.averageMs)}</span></div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-1000" style={{ width: `${width}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><Gauge className="h-5 w-5 text-cyan-300" /><p className="mt-3 text-sm font-black text-white">WebGPU</p><p className="mt-1 text-xs text-slate-500">GPU del navegador cuando está disponible.</p></div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><Cpu className="h-5 w-5 text-violet-300" /><p className="mt-3 text-sm font-black text-white">WASM / CPU</p><p className="mt-1 text-xs text-slate-500">Fallback universal acelerado por kernels LiteRT.</p></div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><Zap className="h-5 w-5 text-emerald-300" /><p className="mt-3 text-sm font-black text-white">Misma carga</p><p className="mt-1 text-xs text-slate-500">Mismo modelo, forma de entrada y número de corridas.</p></div>
        </div>
      )}

      {history.length > 1 ? (
        <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-slate-300"><History className="h-4 w-4" /><p className="text-xs font-black">Historial local reciente</p></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {history.slice(1, 5).map(snapshot => (
              <div key={snapshot.id} className="rounded-xl border border-white/5 bg-slate-950/45 p-3 text-[10px]">
                <p className="font-black text-slate-300">{new Date(snapshot.createdAt).toLocaleString("es-CL")}</p>
                <p className="mt-2 text-slate-500">WebGPU: <span className="font-black text-slate-300">{resultSummary(snapshot.webgpu)}</span></p>
                <p className="mt-1 text-slate-500">WASM: <span className="font-black text-slate-300">{resultSummary(snapshot.wasm)}</span></p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-[10px] leading-relaxed text-slate-600">
        Este benchmark usa un tensor sintético y se ejecuta localmente. Los tiempos dependen del navegador, drivers, temperatura, energía y carga del equipo; sirven para elegir backend en ese dispositivo, no como benchmark universal.
      </p>
    </section>
  )
}
