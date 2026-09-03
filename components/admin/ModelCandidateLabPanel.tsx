"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, CircleDot, ExternalLink, FlaskConical, Loader2, RefreshCw, Search, ShieldCheck, TestTube2, XCircle } from "lucide-react"

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

function tone(status: Candidate["status"]) {
  if (status === "implemented") return "border-emerald-400/20 bg-emerald-950/25 text-emerald-200"
  if (status === "validated") return "border-cyan-400/20 bg-cyan-950/25 text-cyan-200"
  if (status === "testing") return "border-violet-400/20 bg-violet-950/25 text-violet-200"
  if (status === "queued") return "border-amber-400/20 bg-amber-950/25 text-amber-200"
  if (status === "rejected") return "border-red-400/20 bg-red-950/25 text-red-200"
  return "border-white/10 bg-white/[0.04] text-slate-400"
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
      setMessage(`${payload.synced || 0} modelos activos sincronizados con el laboratorio.`)
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

  async function setCandidateStatus(candidate: Candidate, nextStatus: Candidate["status"]) {
    setBusy(`${nextStatus}:${candidate.id}`)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ai-core/model-candidates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: candidate.id, status: nextStatus }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudo cambiar el estado.")
      setMessage(`${candidate.label} → ${nextStatus}.`)
      await load()
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo cambiar el estado.")
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="rounded-[30px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,rgba(8,17,31,0.98),rgba(4,10,20,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-cyan-200"><FlaskConical className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-[0.2em]">Model Candidate Lab</span></div>
          <h2 className="mt-2 text-2xl font-black text-white">Probar modelos antes de implementarlos</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">La cola separa descubrimiento, prueba, validación e implementación. Los modelos de texto de Google, Groq, OpenRouter, Together y Cerebras pueden ejecutar un smoke test server-side sin exponer API keys. Audio, imagen, video y safety quedan identificados para suites específicas.</p>
        </div>
        <div className="flex gap-2">
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
        const smokeBusy = busy === `smoke:${candidate.id}`
        return <article key={candidate.id} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-white">{candidate.label}</p><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${tone(candidate.status)}`}>{candidate.status}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">{candidate.release_channel}</span></div>
            <p className="mt-1 break-all font-mono text-[10px] text-slate-600">{candidate.provider} · {candidate.model}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{(candidate.capabilities || []).map(capability => <span key={capability} className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1 text-[9px] font-bold text-slate-400">{capability}</span>)}</div>
          </div>
          <div className="text-[10px] leading-5 text-slate-500">
            {latest ? <><div className="flex items-center gap-2">{latest.status === "passed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : latest.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-300" /> : <CircleDot className="h-3.5 w-3.5 text-amber-300" />}<span className="font-black text-slate-300">Último {latest.suite}: {latest.status}</span></div><p className="mt-1">{latest.latency_ms != null ? `${latest.latency_ms} ms` : "sin latencia"} · {evaluations.length} evaluación(es)</p></> : <p>Sin evaluaciones todavía.</p>}
            {candidate.source_url ? <a href={candidate.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200">Fuente oficial <ExternalLink className="h-3 w-3" /></a> : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {candidate.status !== "implemented" ? <button type="button" disabled={Boolean(busy)} onClick={() => void runSmoke(candidate)} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-950/20 px-3 py-2 text-[10px] font-black text-violet-100 disabled:opacity-40">{smokeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />} Smoke test</button> : null}
            {candidate.status === "testing" ? <button type="button" disabled={Boolean(busy)} onClick={() => void setCandidateStatus(candidate, "validated")} className="rounded-xl border border-cyan-400/20 bg-cyan-950/20 px-3 py-2 text-[10px] font-black text-cyan-100 disabled:opacity-40">Validar</button> : null}
            {candidate.status !== "implemented" && candidate.status !== "rejected" ? <button type="button" disabled={Boolean(busy)} onClick={() => void setCandidateStatus(candidate, "rejected")} className="rounded-xl border border-red-400/15 bg-red-950/15 px-3 py-2 text-[10px] font-black text-red-200 disabled:opacity-40">Rechazar</button> : null}
          </div>
        </article>
      })}</div>}

      <p className="mt-4 text-[11px] leading-5 text-slate-500">Un smoke PASS confirma endpoint, credenciales y una respuesta mínima; no basta para producción. El paso siguiente es ejecutar suites de calidad, costo, latencia, seguridad y modalidad antes de mover un candidato a AI Core.</p>
    </section>
  )
}
