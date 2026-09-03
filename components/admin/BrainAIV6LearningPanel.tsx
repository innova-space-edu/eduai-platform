"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BrainCircuit,
  CheckCircle2,
  Database,
  FlaskConical,
  Loader2,
  MoonStar,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { buildBrainAIV6Cycle, type BrainAIV6CycleReport } from "@/lib/brain-ai/lifelong-learning"
import {
  BRAIN_AI_TRACE_EVENT,
  getBrainAIStoredTraces,
  type BrainAIStoredTrace,
} from "@/lib/brain-ai/telemetry"

type PersistentCycle = {
  id: string
  generated_at: string
  mode: string
  readiness: number
  experience_count: number
  reflection_count: number
  dream_count: number
  skill_candidate_count: number
}

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

export default function BrainAIV6LearningPanel() {
  const [traces, setTraces] = useState<BrainAIStoredTrace[]>([])
  const [report, setReport] = useState<BrainAIV6CycleReport | null>(null)
  const [persistedShadowTraces, setPersistedShadowTraces] = useState(0)
  const [cycles, setCycles] = useState<PersistentCycle[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const refreshTraces = useCallback(() => {
    setTraces(getBrainAIStoredTraces())
  }, [])

  const loadPersistentStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/brain-ai/v6/experience-store", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) return
      setPersistedShadowTraces(Number(payload?.persistedShadowTraces || 0))
      setCycles(Array.isArray(payload?.cycles) ? payload.cycles : [])
    } catch {
      // Model Lab remains usable locally when the persistent store is unavailable.
    }
  }, [])

  useEffect(() => {
    refreshTraces()
    void loadPersistentStatus()
    window.addEventListener(BRAIN_AI_TRACE_EVENT, refreshTraces)
    return () => window.removeEventListener(BRAIN_AI_TRACE_EVENT, refreshTraces)
  }, [loadPersistentStatus, refreshTraces])

  const lastTraceAt = useMemo(() => traces[0]?.createdAt || null, [traces])

  function runOfflineCycle() {
    setError("")
    setMessage("Ciclo local generado. Para aprendizaje entre sesiones, consolídalo en Supabase.")
    setReport(buildBrainAIV6Cycle(getBrainAIStoredTraces()))
  }

  async function persistCycle() {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/brain-ai/v6/experience-store", { method: "POST" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudo persistir el ciclo V6.")
      setReport(payload.report as BrainAIV6CycleReport)
      setMessage(`Ciclo ${String(payload.cycleId || "").slice(0, 8)} guardado en Experience Store. Dream permanece aislado de memoria factual.`)
      await loadPersistentStatus()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo persistir el ciclo V6.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-[30px] border border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.12),transparent_30%),linear-gradient(180deg,rgba(8,17,31,0.99),rgba(4,10,20,0.99))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.38)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-violet-200"><MoonStar className="h-4 w-4" /> Brain AI v6</span>
            <span className="rounded-full border border-violet-400/20 bg-violet-950/30 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-violet-200">Lifelong Learning Lab</span>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-950/30 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-cyan-200">Persistent Experience Store</span>
            <span className="rounded-full border border-emerald-400/15 bg-emerald-950/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-emerald-200">No weight updates</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Consolidación, reflexión e imaginación computacional</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">V6 puede trabajar localmente o consolidar en Supabase las trazas Shadow resumidas. La persistencia guarda experiencias, reflexiones, hipótesis Dream y skills candidatas por separado. Los “sueños” siguen marcados como simulación: no son hechos, no entran a memoria factual y no pueden promoverse solos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={runOfflineCycle} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-slate-200 transition hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Simular local</button>
          <button type="button" disabled={saving || persistedShadowTraces === 0} onClick={() => void persistCycle()} className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-950/30 px-4 py-2.5 text-xs font-black text-violet-100 transition hover:bg-violet-950/45 disabled:cursor-not-allowed disabled:opacity-45">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Consolidar en Supabase</button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-2 text-emerald-200"><Database className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.12em]">Shadow persistidas</span></div><p className="mt-2 text-2xl font-black text-white">{persistedShadowTraces}</p><p className="mt-1 text-[10px] text-slate-600">Supabase · sin prompt</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-2 text-emerald-200"><Database className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.12em]">Experiencias</span></div><p className="mt-2 text-2xl font-black text-white">{report?.experiences.length ?? traces.length}</p><p className="mt-1 text-[10px] text-slate-600">Local / consolidada</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-2 text-cyan-200"><BrainCircuit className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.12em]">Reflexiones</span></div><p className="mt-2 text-2xl font-black text-white">{report?.reflections.length ?? 0}</p><p className="mt-1 text-[10px] text-slate-600">Reforzar / reparar</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-2 text-violet-200"><MoonStar className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.12em]">Dream</span></div><p className="mt-2 text-2xl font-black text-white">{report?.dreams.length ?? 0}</p><p className="mt-1 text-[10px] text-slate-600">Simulado ≠ real</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-2 text-fuchsia-200"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.12em]">Skills</span></div><p className="mt-2 text-2xl font-black text-white">{report?.skillCandidates.length ?? 0}</p><p className="mt-1 text-[10px] text-slate-600">Candidate only</p></div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-2 text-amber-200"><FlaskConical className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.12em]">Readiness</span></div><p className="mt-2 text-2xl font-black text-white">{report ? percent(report.readiness) : cycles[0] ? percent(cycles[0].readiness) : "—"}</p><p className="mt-1 text-[10px] text-slate-600">{cycles.length} ciclo(s) guardados</p></div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-950/20 p-3 text-xs text-red-200">{error}</div> : null}
      {message ? <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-3 text-xs text-emerald-100">{message}</div> : null}

      {!report ? (
        <div className="mt-4 rounded-[24px] border border-dashed border-violet-400/15 bg-violet-950/10 p-5 text-center">
          <MoonStar className="mx-auto h-7 w-7 text-violet-300/70" />
          <p className="mt-3 text-xs font-black text-slate-300">Genera un ciclo local o consolida las trazas persistidas para aprendizaje entre sesiones.</p>
          <p className="mt-1 text-[10px] text-slate-600">{lastTraceAt ? `Última traza local: ${new Date(lastTraceAt).toLocaleString()}` : persistedShadowTraces ? `${persistedShadowTraces} trazas Shadow disponibles en Supabase.` : "Primero genera algunas trazas en Brain AI Shadow Mode."}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MoonStar className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-black text-white">Dream Cycle · {report.mode}</h3></div><span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">{new Date(report.generatedAt).toLocaleTimeString()}</span></div>
            {report.dreams.length ? <div className="mt-3 space-y-2">{report.dreams.slice(0, 4).map(dream => <article key={dream.id} className="rounded-2xl border border-violet-400/10 bg-violet-950/10 p-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-violet-400/15 px-2 py-0.5 text-[9px] font-black uppercase text-violet-200">SIMULATED</span><span className="rounded-full border border-amber-400/15 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200">HYPOTHESIS</span><span className="text-[9px] text-slate-600">conf. {percent(dream.confidence)}</span></div><p className="mt-2 text-xs leading-5 text-slate-300">{dream.hypothesis}</p><p className="mt-2 text-[10px] leading-5 text-violet-200/75">{dream.counterfactual}</p></article>)}</div> : <p className="mt-4 text-xs text-slate-500">Aún no hay experiencias suficientes para simular escenarios.</p>}
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /><h3 className="text-sm font-black text-white">V6 Safety & Production Gates</h3></div>
            <div className="mt-3 space-y-2">{report.gates.map(gate => <div key={gate.id} className="rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex items-center gap-2">{gate.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <TriangleAlert className="h-4 w-4 text-amber-300" />}<p className="text-[11px] font-black text-slate-200">{gate.label}</p></div><p className="mt-1 pl-6 text-[10px] leading-5 text-slate-600">{gate.detail}</p></div>)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl border border-red-400/10 bg-red-950/15 p-2.5"><p className="text-[9px] text-red-200/70">Factual memory from Dream</p><p className="mt-1 text-xs font-black text-red-200">BLOQUEADO</p></div><div className="rounded-xl border border-red-400/10 bg-red-950/15 p-2.5"><p className="text-[9px] text-red-200/70">Weight updates</p><p className="mt-1 text-xs font-black text-red-200">BLOQUEADO</p></div></div>
          </div>
        </div>
      )}

      {report?.skillCandidates.length ? <div className="mt-4 rounded-[24px] border border-fuchsia-400/10 bg-fuchsia-950/10 p-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-fuchsia-300" /><h3 className="text-sm font-black text-white">Procedural candidates</h3></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{report.skillCandidates.map(skill => <div key={skill.id} className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-200">{skill.intent}</p><p className="mt-2 text-xs font-black text-white">{skill.route}</p><p className="mt-1 text-[10px] text-slate-600">{skill.evidenceCount} experiencias · gate {percent(skill.averageGatePassRate)} · confianza {percent(skill.averageConfidence)}</p><span className="mt-2 inline-flex rounded-full border border-amber-400/15 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200">candidate only</span></div>)}</div></div> : null}
    </section>
  )
}
