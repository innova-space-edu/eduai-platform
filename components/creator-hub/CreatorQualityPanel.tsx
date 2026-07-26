"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, LoaderCircle, ShieldCheck, Sparkles, XCircle } from "lucide-react"

type QualityIssue = {
  severity: "critical" | "warning" | "suggestion"
  category: string
  path: string
  message: string
  suggestion: string
}

type QualityReview = {
  overallScore: number
  spellingScore: number
  pedagogyScore: number
  coherenceScore: number
  accessibilityScore: number
  factualRiskScore: number
  readingLevel: string
  summary: string
  strengths: string[]
  issues: QualityIssue[]
  checks: Array<{ label: string; status: "pass" | "warning" | "fail"; detail: string }>
}

function scoreColor(score: number) {
  if (score >= 85) return "#16a34a"
  if (score >= 70) return "#d97706"
  return "#dc2626"
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  const color = scoreColor(score)
  return (
    <div className="rounded-2xl border border-soft bg-card-soft-theme p-3 text-center">
      <p className="text-2xl font-black" style={{ color }}>{score}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-muted2">{label}</p>
    </div>
  )
}

export default function CreatorQualityPanel({ format, data }: { format: string; data: any }) {
  const [review, setReview] = useState<QualityReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const runReview = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/creator/quality-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, data }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.review) throw new Error(payload?.error || "No fue posible revisar el material.")
      setReview(payload.review)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible revisar el material.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-3xl border border-soft bg-card-theme p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600" /><h2 className="text-sm font-bold text-main">Control de calidad con IA</h2></div>
          <p className="mt-1 text-xs leading-5 text-muted2">Revisa ortografía, coherencia, pedagogía, accesibilidad, ambigüedades y riesgo factual antes de descargar.</p>
        </div>
        <button type="button" onClick={runReview} disabled={loading} className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{loading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}{loading ? "Revisando..." : review ? "Revisar nuevamente" : "Revisar material"}</button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-500">{error}</div>}

      {review && (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <ScoreCard label="General" score={review.overallScore} />
            <ScoreCard label="Ortografía" score={review.spellingScore} />
            <ScoreCard label="Pedagogía" score={review.pedagogyScore} />
            <ScoreCard label="Coherencia" score={review.coherenceScore} />
            <ScoreCard label="Accesibilidad" score={review.accessibilityScore} />
            <ScoreCard label="Seguridad factual" score={review.factualRiskScore} />
          </div>

          <div className="rounded-2xl border border-soft bg-card-soft-theme p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted2">Diagnóstico · nivel de lectura: {review.readingLevel}</p>
            <p className="mt-2 text-sm leading-6 text-sub">{review.summary}</p>
          </div>

          {review.strengths?.length > 0 && (
            <div><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted2">Fortalezas</p><div className="grid gap-2 sm:grid-cols-2">{review.strengths.map((strength, index) => <div key={index} className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs leading-5 text-emerald-700"><CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />{strength}</div>)}</div></div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wider text-muted2">Hallazgos y mejoras</p><span className="text-[10px] font-bold text-muted2">{review.issues?.length || 0}</span></div>
            {review.issues?.length ? <div className="space-y-2">{review.issues.map((issue, index) => { const critical = issue.severity === "critical"; const warning = issue.severity === "warning"; const color = critical ? "#dc2626" : warning ? "#d97706" : "#2563eb"; return <article key={index} className="rounded-2xl border p-3.5" style={{ borderColor: `${color}30`, background: `${color}08` }}><div className="flex items-start gap-2">{critical ? <XCircle size={14} style={{ color }} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={14} style={{ color }} className="mt-0.5 flex-shrink-0" />}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-black uppercase tracking-wider" style={{ color }}>{issue.severity}</span><span className="rounded-full border border-soft bg-card-theme px-2 py-0.5 font-mono text-[9px] text-muted2">{issue.path || "material"}</span><span className="text-[9px] font-bold text-muted2">{issue.category}</span></div><p className="mt-2 text-xs font-semibold leading-5 text-main">{issue.message}</p><p className="mt-1 text-xs leading-5 text-muted2"><strong>Sugerencia:</strong> {issue.suggestion}</p></div></div></article> })}</div> : <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-700">No se detectaron problemas relevantes.</div>}
          </div>
        </div>
      )}
    </section>
  )
}
