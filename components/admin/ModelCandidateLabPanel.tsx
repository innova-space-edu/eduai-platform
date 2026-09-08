"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, CircleDot, ExternalLink, FlaskConical, Gauge, Layers3, Loader2, RefreshCw, Rocket, Search, ShieldCheck, TestTube2, XCircle } from "lucide-react"

type Evaluation = {
  id: string
  status: string
  suite: string
  latency_ms: number | null
  quality_score: number | null
  reliability_score: number | null
  cost_score: number | null
  created_at: string
  completed_at: string | null
}

type Candidate = {
  id: string
  provider: string
  model: string
  label: string
  capabilities: string[]
  source_url: string | null
  release_channel: "stable" | "preview" | "experimental" | "unknown"
  status: "discovered" | "queued" | "testing" | "validated" | "rejected" | "implemented"
  priority: number
  notes: string | null
  metadata: Record<string, unknown>
  last_evaluated_at: string | null
  ai_model_evaluations?: Evaluation[]
}

const STATUS_ORDER = ["queued", "testing", "validated", "implemented", "discovered", "rejected"] as const
const TEXT_CAPABILITIES = new Set(["text", "structured", "long_context", "code", "research", "agentic", "reasoning", "tools"])

function tone(status: Candidate["status"]) {
  if (status === "implemented") return "border-emerald-400/20 bg-emerald-950/25 text-emerald-200"
  if (status === "validated") return "border-cyan-400/20 bg-cyan-950/25 text-cyan-200"
  if (status === "testing") return "border-violet-400/20 bg-violet-950/25 text-violet-200"
  if (status === "queued") return "border-amber-400/20 bg-amber-950/25 text-amber-200"
  if (status === "rejected") return "border-red-400/20 bg-red-950/25 text-red-200"
  return "border-white/10 bg-white/[0.04] text-slate-400"
}

function percent(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`
}

function supportsText(candidate: Candidate) {
  return (candidate.capabilities || []).some(item => TEXT_CAPABILITIES.has(item))
}

export default function ModelCandidateLabPanel() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [query, setQuery] = useState("")
  const [provider, setProvider] = useState("all")
  const [status, setStatus] = useState("all")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/ai-core/model-candidates", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudo leer Model Candidate Lab.")
      setCandidates(Array.isArray(payload?.candidates) ? payload.candidates : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo leer Model Candidate Lab.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const providers = useMemo(() => [...new Set(candidates.map(item => item.provider))].sort(), [candidates])
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return candidates.filter(item => {
      if (provider !== "all" && item.provider !== provider) return false
      if (status !== "all" && item.status !== status) return false
      if (!normalized) return true
      return [item.provider, item.model, item.label, ...(item.capabilities || [])].join(" ").toLowerCase().includes(normalized)
    }).sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.priority - b.priority)
  }, [candidates, provider, query, status])

  const stats = useMemo(() => ({
    total: candidates.length,
    queued: candidates.filter(item => item.status === "queued").length,
    testing: candidates.filter(item => item.status === "testing").length,
    validated: candidates.filter(item => item.status === "validated").length,
    implemented: candidates.filter(item => item.status === "implemented").length,
  }), [candidates])

  async function syncRegistry() {
    setBusy("sync")
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ai-core/model-candidates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync_registry" }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudo sincronizar el registro.")
      setMessage(`${payload.synced || 0} modelos del AI Core sincronizados con el laboratorio.`)
      await load()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "No se pudo sincronizar el registro.")
    } finally {
      setBusy("")
    }
  }

  async function runSmoke(candidate: Candidate) {
    setBusy(`smoke:${candidate.id}`)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ai-core/model-candidates/smoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: candidate.id }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "Smoke test falló.")
      const result = payload.result
      setMessage(`${candidate.label}: ${result?.supported ? (result?.passed ? "smoke PASS" : "smoke FAIL") : "requiere benchmark específico"}${result?.latencyMs ? ` · ${result.latencyMs} ms` : ""}.`)
      await load()
    } catch (smokeError) {
      setError(smokeError instanceof Error ? smokeError.message : "Smoke test falló.")
    } finally {
      setBusy("")
    }
  }

  async function runBenchmark(candidate: Candidate) {
    setBusy(`benchmark:${candidate.id}`)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ai-core/model-candidates/benchmark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: candidate.id }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "Benchmark falló.")
      const result = payload.result
      setMessage(`${candidate.label}: ${result?.passed ? "BENCHMARK PASS → validado" : "benchmark no aprobado"} · calidad ${percent(result?.qualityScore ?? null)} · confiabilidad ${percent(result?.reliabilityScore ?? null)}${result?.averageLatencyMs ? ` · ${result.averageLatencyMs} ms` : ""}.`)
      await load()
    } catch (benchmarkError) {
      setError(benchmarkError instanceof Error ? benchmarkError.message : "Benchmark falló.")
    } finally {
      setBusy("")
    }
  }

  async function runBatch() {
    setBusy("batch")
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ai-core/model-candidates/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 4, provider: provider === "all" ? "" : provider, stableOnly: true }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudo ejecutar el lote.")
      const passed = Array.isArray(payload?.results) ? payload.results.filter((item: any) => item?.status === "passed").length : 0
      setMessage(`Lote terminado: ${payload.tested || 0} modelo(s) probado(s), ${passed} validado(s). Máximo 4 modelos por ejecución para controlar costo y rate limits.`)
      await load()
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "No se pudo ejecutar el lote.")
    } finally {
      setBusy("")
    }
  }

  async function promote(candidate: Candidate) {
    setBusy(`promote:${candidate.id}`)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ai-core/model-candidates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "promote", candidateId: candidate.id }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudo promover el modelo.")
      setMessage(`${candidate.label} agregado al AI Core DESACTIVADO. No recibe tráfico hasta habilitarlo por separado en el registro.`)
      await load()
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : "No se pudo promover el modelo.")
    } finally {
      setBusy("")
    }
  }

  async function reject(candidate: Candidate) {
    setBusy(`rejected:${candidate.id}`)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ai-core/model-candidates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: candidate.id, status: "rejected" }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudo rechazar el candidato.")
      setMessage(`${candidate.label} → rejected.`)
      await load()
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo rechazar el candidato.")
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="rounded-[30px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,rgba(8,17,31,0.98),rgba(4,10,20,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-cyan-200"><FlaskConical className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-[0.2em]">Model Candidate Lab · Benchmark V1</span></div>
          <h2 className="mt-2 text-2xl font-black text-white">Probar muchos modelos sin mandarlos directo a producción</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">El flujo ahora es <strong className="text-slate-200">smoke → benchmark determinista → validated → AI Core OFF → habilitación separada</strong>. El benchmark text-v1 prueba instrucciones, aritmética, JSON estructurado y español educativo. Los lotes están limitados para controlar costo y rate limits.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void runBatch()} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-950/25 px-3 py-2 text-xs font-black text-violet-100 disabled:opacity-40">{busy === "batch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />} Probar lote estable</button>
          <button type="button" onClick={() => void syncRegistry()} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-950/20 px-3 py-2 text-xs font-black text-emerald-200 disabled:opacity-40"><ShieldCheck className="h-4 w-4" /> Sincronizar activos</button>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{[
        ["Total", stats.total], ["En cola", stats.queued], ["Testing", stats.testing], ["Validados", stats.validated], ["Implementados", stats.implemented],
      ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>)}</div>

      <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_180px_180px]">
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5"><Search className="h-4 w-4 text-slate-600" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar modelo, proveedor o capacidad…" className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none" /></label>
        <select value={provider} onChange={event => setProvider(event.target.value)} className="rounded-2xl border border-white/10 bg-[#07101d] px-3 py-2.5 text-xs text-slate-300 outline-none"><option value="all">Todos los proveedores</option>{providers.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <select value={status} onChange={event => setStatus(event.target.value)} className="rounded-2xl border border-white/10 bg-[#07101d] px-3 py-2.5 text-xs text-slate-300 outline-none"><option value="all">Todos los estados</option>{["discovered","queued","testing","validated","implemented","rejected"].map(item => <option key={item} value={item}>{item}</option>)}</select>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-950/20 p-3 text-xs text-red-200">{error}</div> : null}
      {message ? <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-3 text-xs text-emerald-100">{message}</div> : null}

      {loading && !candidates.length ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div> : <div className="mt-5 space-y-2">{filtered.map(candidate => {
        const evaluations = [...(candidate.ai_model_evaluations || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const latest = evaluations[0]
        const latestBenchmark = evaluations.find(item => item.suite === "model-lab-text-v1")
        const smokeBusy = busy === `smoke:${candidate.id}`
        const benchmarkBusy = busy === `benchmark:${candidate.id}`
        const promoteBusy = busy === `promote:${candidate.id}`
        return <article key={candidate.id} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-white">{candidate.label}</p><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${tone(candidate.status)}`}>{candidate.status}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">{candidate.release_channel}</span></div>
            <p className="mt-1 break-all font-mono text-[10px] text-slate-600">{candidate.provider} · {candidate.model}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{(candidate.capabilities || []).map(capability => <span key={capability} className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1 text-[9px] font-bold text-slate-400">{capability}</span>)}</div>
          </div>
          <div className="text-[10px] leading-5 text-slate-500">
            {latest ? <><div className="flex items-center gap-2">{latest.status === "passed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : latest.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-300" /> : <CircleDot className="h-3.5 w-3.5 text-amber-300" />}<span className="font-black text-slate-300">Último {latest.suite}: {latest.status}</span></div><p className="mt-1">{latest.latency_ms != null ? `${latest.latency_ms} ms` : "sin latencia"} · {evaluations.length} evaluación(es)</p></> : <p>Sin evaluaciones todavía.</p>}
            {latestBenchmark ? <p className="mt-1 inline-flex items-center gap-1.5 text-cyan-200/75"><Gauge className="h-3 w-3" /> calidad {percent(latestBenchmark.quality_score)} · confiabilidad {percent(latestBenchmark.reliability_score)}</p> : null}
            {candidate.source_url ? <a href={candidate.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200">Fuente oficial <ExternalLink className="h-3 w-3" /></a> : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {candidate.status !== "implemented" ? <button type="button" disabled={Boolean(busy)} onClick={() => void runSmoke(candidate)} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-950/20 px-3 py-2 text-[10px] font-black text-violet-100 disabled:opacity-40">{smokeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />} Smoke</button> : null}
            {candidate.status !== "implemented" && supportsText(candidate) ? <button type="button" disabled={Boolean(busy)} onClick={() => void runBenchmark(candidate)} className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-950/20 px-3 py-2 text-[10px] font-black text-cyan-100 disabled:opacity-40">{benchmarkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gauge className="h-3.5 w-3.5" />} Benchmark</button> : null}
            {candidate.status === "validated" ? <button type="button" disabled={Boolean(busy)} onClick={() => void promote(candidate)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-950/25 px-3 py-2 text-[10px] font-black text-emerald-100 disabled:opacity-40">{promoteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />} AI Core · OFF</button> : null}
            {candidate.status !== "implemented" && candidate.status !== "rejected" ? <button type="button" disabled={Boolean(busy)} onClick={() => void reject(candidate)} className="rounded-xl border border-red-400/15 bg-red-950/15 px-3 py-2 text-[10px] font-black text-red-200 disabled:opacity-40">Rechazar</button> : null}
          </div>
        </article>
      })}</div>}

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-2xl border border-violet-400/10 bg-violet-950/10 p-3"><p className="text-[10px] font-black text-violet-200">1 · Smoke</p><p className="mt-1 text-[10px] leading-5 text-slate-500">Confirma endpoint, credenciales y respuesta mínima.</p></div>
        <div className="rounded-2xl border border-cyan-400/10 bg-cyan-950/10 p-3"><p className="text-[10px] font-black text-cyan-200">2 · Benchmark V1</p><p className="mt-1 text-[10px] leading-5 text-slate-500">Exige ≥75% de calidad y confiabilidad para pasar a validated.</p></div>
        <div className="rounded-2xl border border-emerald-400/10 bg-emerald-950/10 p-3"><p className="text-[10px] font-black text-emerald-200">3 · Staged promotion</p><p className="mt-1 text-[10px] leading-5 text-slate-500">Se agrega al AI Core con is_enabled=false. Habilitar producción sigue siendo una decisión aparte.</p></div>
      </div>
    </section>
  )
}
