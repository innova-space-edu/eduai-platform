// app/examen/resultados/[id]/page.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Shield, X, AlertTriangle, Clock, Eye, CheckCircle2, XCircle, Pencil, Save } from "lucide-react"
import ReportExporter from "./ReportExporter"
import StudentPdfExporter from "./StudentPdfExporter"

// ── Semáforo de riesgo ────────────────────────────────────────────────────────
function RiskBadge({ level, count }: { level: string; count: number }) {
  if (count === 0 || level === "clean") return <span className="text-gray-700 text-xs">—</span>
  const cfg = {
    low:    { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)",  label: "Leve"   },
    medium: { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)",  label: "Medio"  },
    high:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   label: "Alto"   },
  }[level] || { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)", label: "?" }
  return (
    <span className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      ⚑ {count} {cfg.label}
    </span>
  )
}

// ── Labels de eventos de seguridad ───────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  fullscreen_exit:     "🖥 Salió de pantalla completa",
  window_blur:         "🪟 Perdió foco de ventana",
  tab_hidden:          "📑 Cambió de pestaña",
  copy_attempt:        "📋 Intentó copiar",
  paste_attempt:       "📋 Intentó pegar",
  cut_attempt:         "✂️ Intentó cortar",
  contextmenu_attempt: "🖱 Abrió menú contextual",
  blocked_shortcut:    "⌨️ Tecla bloqueada",
  print_attempt:       "🖨 Intentó imprimir",
  reload_attempt:      "🔄 Intentó recargar",
}

// ── Modal de incidentes ───────────────────────────────────────────────────────
function IncidentModal({ submission, examId, onClose }: { submission: any; examId: string; onClose: () => void }) {
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/exam-security/event?examId=${examId}&submissionId=${submission.id}`)
      .then(r => r.json()).then(d => setIncidents(d.incidents || []))
      .finally(() => setLoading(false))
  }, [submission.id, examId])
  const SEV: Record<string, string> = { high: "#ef4444", medium: "#f97316", low: "#fbbf24" }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-sm">Incidentes — {submission.student_name}</h3>
            <p className="text-gray-500 text-xs">{incidents.length} evento{incidents.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-red-400 animate-spin" /></div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-8"><Shield size={28} className="text-gray-700 mx-auto mb-2" /><p className="text-gray-500 text-sm">Sin incidentes</p></div>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc, i) => (
                <div key={inc.id || i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                     style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: SEV[inc.severity] || "#9ca3af" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-gray-200 text-xs font-medium">#{inc.incident_number} — {EVENT_LABELS[inc.event_type] || inc.event_type}</p>
                      <span className="text-gray-600 text-[10px] flex items-center gap-1">
                        <Clock size={9} />{new Date(inc.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {inc.question_index != null && <span className="text-gray-600 text-[10px]">Pregunta {inc.question_index + 1}</span>}
                      {inc.client_time_left != null && <span className="text-gray-600 text-[10px]">{Math.floor(inc.client_time_left / 60)}:{String(inc.client_time_left % 60).padStart(2,"0")} rest.</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal de revisión manual ──────────────────────────────────────────────────
function ReviewModal({
  submission, exam, onClose, onSave,
}: {
  submission: any
  exam: any
  onClose: () => void
  onSave: (updated: any) => void
}) {
  const questions: any[] = exam?.questions || []
  const answers:   any[] = submission?.answers || []

  // Estado local de puntajes manuales — inicializar con los valores actuales
  const [scores, setScores] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {}
    answers.forEach((a: any, i: number) => {
      if (a.type === "development") {
        init[i] = Number(a.manualScore ?? a.aiScore ?? 0)
      } else if (a.type === "true_false") {
        init[i] = Number(a.justificationScore ?? 0)
      }
    })
    return init
  })

  const [feedbacks, setFeedbacks] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    answers.forEach((a: any, i: number) => {
      if (a.type === "development")  init[i] = a.manualFeedback || a.aiFeedback || ""
      if (a.type === "true_false")   init[i] = a.justificationFeedback || ""
    })
    return init
  })

  const [mcOverrides, setMcOverrides] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {}
    answers.forEach((a: any, i: number) => {
      if (a.type === "multiple_choice") init[i] = a.isCorrect
    })
    return init
  })

  const [saving, setSaving] = useState(false)
  const [activeQ, setActiveQ] = useState(0)

  // Calcular preview de nota en tiempo real
  const previewGrade = (() => {
    let earned = 0
    let total  = 0
    answers.forEach((a: any, i: number) => {
      const q   = questions[i]
      const max = Number(a.maxPoints || q?.maxPoints || 0)
      total += max
      if (a.type === "multiple_choice") {
        if (mcOverrides[i]) earned += max
      } else if (a.type === "true_false") {
        const selPts  = Number(a.selectionPoints) || 1
        const justMax = Number(a.justificationMaxPoints) || Math.max(0, max - selPts)
        if (a.selectionCorrect || a.isCorrect) earned += selPts
        earned += Math.min(justMax, Math.max(0, scores[i] || 0))
      } else if (a.type === "development") {
        earned += Math.min(max, Math.max(0, scores[i] || 0))
      }
    })
    const pct = total > 0 ? (earned / total) * 100 : 0
    const ex  = exam?.settings?.examPercentage || 60
    const g   = pct >= ex ? 4 + ((pct - ex) * 3) / (100 - ex) : 1 + (pct * 3) / ex
    return { earned: Math.round(earned * 10) / 10, total: Math.round(total * 10) / 10, pct: Math.round(pct), grade: Math.round(g * 10) / 10 }
  })()

  async function handleSave() {
    setSaving(true)
    // Construir updatedAnswers con los cambios manuales
    const updatedAnswers = answers.map((a: any, i: number) => {
      if (a.type === "multiple_choice") {
        return { ...a, isCorrect: mcOverrides[i] ?? a.isCorrect }
      }
      if (a.type === "true_false") {
        return { ...a, justificationScore: scores[i] ?? a.justificationScore, justificationFeedback: feedbacks[i] ?? a.justificationFeedback }
      }
      if (a.type === "development") {
        return { ...a, manualScore: scores[i] ?? a.aiScore, aiScore: scores[i] ?? a.aiScore, manualFeedback: feedbacks[i] ?? a.aiFeedback, aiEvaluated: true }
      }
      return a
    })

    const res = await fetch("/api/agents/examen-docente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:        "update_submission",
        submissionId:  submission.id,
        updatedAnswers,
        examPercentage: exam?.settings?.examPercentage || 60,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      onSave({ ...submission, answers: updatedAnswers, score: data.score, grade: data.grade, correct_count: data.correct_count, earned_points: data.earned_points, total_points: data.total_points, manually_reviewed: true })
    }
  }

  const q = questions[activeQ]
  const a = answers[activeQ]

  const typeLabel = (t: string) => t === "multiple_choice" ? "Alternativas" : t === "true_false" ? "V/F" : "Desarrollo"
  const needsReview = (ans: any) => {
    if (ans?.type === "development") return !ans?.manualScore && !ans?.aiEvaluated
    if (ans?.type === "true_false")  return ans?.justificationScore == null
    return false
  }
  const pendingCount = answers.filter(needsReview).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: "#0a0f1a", border: "1px solid rgba(255,255,255,0.1)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0"
             style={{ background: "rgba(255,255,255,0.02)" }}>
          <div>
            <h2 className="text-white font-bold text-base">Revisión — {submission.student_name}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{submission.student_course} · {submission.student_rut || "Sin RUT"}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Preview nota */}
            <div className="text-center px-3 py-1.5 rounded-xl"
                 style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-gray-500 text-[10px] mb-0.5">Nota actual</p>
              <p className={`text-lg font-bold leading-none ${
                previewGrade.grade >= 6 ? "text-green-400" : previewGrade.grade >= 4 ? "text-blue-400" : "text-red-400"
              }`}>{previewGrade.grade}</p>
              <p className="text-gray-600 text-[10px]">{previewGrade.earned}/{previewGrade.total} pts</p>
            </div>
            {pendingCount > 0 && (
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}>
                {pendingCount} sin revisar
              </span>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Lista de preguntas */}
          <div className="w-40 flex-shrink-0 border-r border-white/[0.06] overflow-y-auto py-2"
               style={{ background: "rgba(0,0,0,0.3)" }}>
            {questions.map((qq: any, i: number) => {
              const aa = answers[i]
              const isActive = i === activeQ
              const hasManual = aa?.type === "development" ? (aa?.manualScore != null || aa?.aiEvaluated) : aa?.type === "true_false" ? aa?.justificationScore != null : true
              const isCorrect = aa?.type === "multiple_choice" ? (mcOverrides[i] ?? aa?.isCorrect) : null
              return (
                <button key={i} onClick={() => setActiveQ(i)}
                  className="w-full text-left px-3 py-2.5 transition-all"
                  style={{
                    background: isActive ? "rgba(59,130,246,0.15)" : "transparent",
                    borderRight: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: isActive ? "#93c5fd" : "#6b7280" }}>
                      P{i + 1}
                    </span>
                    {aa?.type === "multiple_choice" && (
                      isCorrect
                        ? <CheckCircle2 size={12} className="text-green-400" />
                        : <XCircle size={12} className="text-red-400" />
                    )}
                    {(aa?.type === "development" || aa?.type === "true_false") && (
                      hasManual
                        ? <CheckCircle2 size={12} className="text-blue-400" />
                        : <AlertTriangle size={12} className="text-amber-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5 truncate">{typeLabel(qq?.type || "")}</p>
                  <p className="text-[10px] text-gray-700">{aa?.type === "development" ? `${scores[i] ?? aa?.aiScore ?? 0}/${aa?.maxPoints || qq?.maxPoints || 0} pts` : aa?.type === "true_false" ? `${aa?.selectionCorrect ? "✓" : "✗"} sel.` : ""}</p>
                </button>
              )
            })}
          </div>

          {/* Panel de pregunta activa */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {q && a && (
              <>
                {/* Encabezado pregunta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                            style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd" }}>
                        Pregunta {activeQ + 1} de {questions.length}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg text-[10px]"
                            style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>
                        {typeLabel(a.type)} · {a.maxPoints || q.maxPoints || 0} pts máx
                      </span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{q.question}</p>
                  </div>
                </div>

                {/* ── ALTERNATIVAS ────────────────────────────────────── */}
                {a.type === "multiple_choice" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {(q.options || []).map((opt: string, oi: number) => {
                        const isStudentAnswer  = a.selectedAnswer === oi
                        const isCorrectAnswer  = q.correctAnswer === oi
                        return (
                          <div key={oi} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                               style={{
                                 background: isCorrectAnswer ? "rgba(34,197,94,0.08)" : isStudentAnswer ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
                                 border: `1px solid ${isCorrectAnswer ? "rgba(34,197,94,0.3)" : isStudentAnswer ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
                               }}>
                            <span className="text-xs font-bold mt-0.5 flex-shrink-0"
                                  style={{ color: isCorrectAnswer ? "#4ade80" : isStudentAnswer ? "#f87171" : "#6b7280" }}>
                              {["A","B","C","D"][oi]}.
                            </span>
                            <span className="text-sm flex-1" style={{ color: isCorrectAnswer ? "#86efac" : isStudentAnswer ? "#fca5a5" : "#9ca3af" }}>
                              {opt}
                            </span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isStudentAnswer  && <span className="text-[10px] font-bold text-blue-400">← estudiante</span>}
                              {isCorrectAnswer  && <span className="text-[10px] font-bold text-green-400">✓ correcta</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Explicación */}
                    {q.explanation && (
                      <div className="rounded-xl px-4 py-3 text-xs"
                           style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                        <p className="text-blue-300 font-semibold mb-1">💡 Explicación</p>
                        <p className="text-gray-400">{q.explanation}</p>
                      </div>
                    )}

                    {/* Override manual */}
                    <div className="rounded-xl px-4 py-3"
                         style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="text-gray-400 text-xs font-semibold mb-2">Revisión del docente</p>
                      <div className="flex gap-3">
                        <button onClick={() => setMcOverrides(p => ({ ...p, [activeQ]: true }))}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background: mcOverrides[activeQ] === true ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${mcOverrides[activeQ] === true ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
                            color: mcOverrides[activeQ] === true ? "#4ade80" : "#6b7280",
                          }}>
                          ✓ Correcta
                        </button>
                        <button onClick={() => setMcOverrides(p => ({ ...p, [activeQ]: false }))}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background: mcOverrides[activeQ] === false ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${mcOverrides[activeQ] === false ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                            color: mcOverrides[activeQ] === false ? "#f87171" : "#6b7280",
                          }}>
                          ✗ Incorrecta
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── VERDADERO/FALSO ──────────────────────────────────── */}
                {a.type === "true_false" && (
                  <div className="space-y-3">
                    {/* Selección */}
                    <div className="rounded-xl px-4 py-3"
                         style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="text-gray-500 text-xs font-semibold mb-2">SELECCIÓN ({a.selectionPoints || 1} pt)</p>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${a.selectionCorrect ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                          {a.selectionCorrect ? "✓" : "✗"} Estudiante eligió: {(q.options || ["Verdadero","Falso"])[a.selectedAnswer]}
                        </span>
                        <span className="text-gray-600 text-xs">
                          Correcta: {(q.options || ["Verdadero","Falso"])[q.correctAnswer]}
                        </span>
                      </div>
                    </div>

                    {/* Justificación */}
                    <div className="rounded-xl px-4 py-3"
                         style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="text-gray-500 text-xs font-semibold mb-2">JUSTIFICACIÓN (máx {a.justificationMaxPoints || 0} pts)</p>
                      <div className="rounded-lg px-3 py-2.5 mb-3"
                           style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                        <p className="text-blue-300 text-xs font-semibold mb-1">Respuesta del estudiante</p>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {a.justification || <span className="text-gray-600 italic">Sin justificación</span>}
                        </p>
                      </div>
                      {q.explanation && (
                        <div className="rounded-lg px-3 py-2.5 mb-3"
                             style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
                          <p className="text-green-400 text-xs font-semibold mb-1">Explicación correcta (referencia)</p>
                          <p className="text-gray-400 text-sm">{q.explanation}</p>
                        </div>
                      )}
                      {a.aiFeedback && a.aiFeedback !== "Pendiente de revisión manual" && (
                        <div className="rounded-lg px-3 py-2.5 mb-3"
                             style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
                          <p className="text-purple-300 text-xs font-semibold mb-1">🤖 Evaluación IA</p>
                          <p className="text-gray-400 text-sm">{a.aiFeedback}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <label className="text-gray-400 text-xs font-semibold whitespace-nowrap">
                          Puntaje justificación:
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={a.justificationMaxPoints || 0}
                          step={0.5}
                          value={scores[activeQ] ?? a.justificationScore ?? 0}
                          onChange={e => setScores(p => ({ ...p, [activeQ]: Math.max(0, Math.min(a.justificationMaxPoints || 0, Number(e.target.value))) }))}
                          className="w-20 text-center rounded-xl px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                        />
                        <span className="text-gray-600 text-xs">/ {a.justificationMaxPoints || 0} pts</span>
                      </div>
                      <textarea
                        placeholder="Retroalimentación opcional..."
                        value={feedbacks[activeQ] || ""}
                        onChange={e => setFeedbacks(p => ({ ...p, [activeQ]: e.target.value }))}
                        rows={2}
                        className="w-full mt-3 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none resize-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      />
                    </div>
                  </div>
                )}

                {/* ── DESARROLLO ───────────────────────────────────────── */}
                {a.type === "development" && (
                  <div className="space-y-3">
                    {/* Respuesta del estudiante */}
                    <div className="rounded-xl px-4 py-3"
                         style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                      <p className="text-blue-300 text-xs font-semibold mb-2">Respuesta del estudiante</p>
                      <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                        {a.devText || <span className="text-gray-600 italic">Sin respuesta</span>}
                      </p>
                    </div>

                    {/* Respuesta modelo */}
                    {q.modelAnswer && (
                      <div className="rounded-xl px-4 py-3"
                           style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
                        <p className="text-green-400 text-xs font-semibold mb-2">✓ Respuesta modelo (referencia)</p>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{q.modelAnswer}</p>
                      </div>
                    )}

                    {/* Rúbrica */}
                    {q.rubric && q.rubric.length > 0 && (
                      <div className="rounded-xl px-4 py-3"
                           style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <p className="text-gray-400 text-xs font-semibold mb-3">📋 Rúbrica de evaluación</p>
                        <div className="space-y-2">
                          {q.rubric.map((r: any, ri: number) => (
                            <div key={ri} className="flex items-start justify-between gap-3">
                              <p className="text-gray-300 text-xs flex-1">{r.criteria || r.criterion || r.criterio}</p>
                              <span className="text-amber-400 text-xs font-bold flex-shrink-0 whitespace-nowrap">
                                {r.points || r.puntos || r.puntaje} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evaluación IA */}
                    {a.aiFeedback && a.aiFeedback !== "Pendiente de revisión manual" && (
                      <div className="rounded-xl px-4 py-3"
                           style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-purple-300 text-xs font-semibold">🤖 Evaluación IA</p>
                          <span className="text-purple-300 text-xs">{a.aiScore ?? 0}/{a.maxPoints || q.maxPoints || 0} pts sugerido</span>
                        </div>
                        <p className="text-gray-400 text-sm">{a.aiFeedback}</p>
                      </div>
                    )}

                    {/* Puntaje manual */}
                    <div className="rounded-xl px-4 py-4"
                         style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <p className="text-gray-300 text-xs font-semibold mb-3">Puntaje del docente</p>
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          min={0}
                          max={a.maxPoints || q.maxPoints || 0}
                          step={0.5}
                          value={scores[activeQ] ?? a.manualScore ?? a.aiScore ?? 0}
                          onChange={e => setScores(p => ({ ...p, [activeQ]: Math.max(0, Math.min(a.maxPoints || q.maxPoints || 0, Number(e.target.value))) }))}
                          className="w-24 text-center rounded-xl px-3 py-2.5 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)" }}
                        />
                        <div>
                          <p className="text-gray-500 text-xs">de {a.maxPoints || q.maxPoints || 0} pts máximo</p>
                          {/* Barra de progreso */}
                          <div className="w-32 h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div className="h-full rounded-full transition-all"
                                 style={{
                                   width: `${Math.min(100, ((scores[activeQ] ?? 0) / (a.maxPoints || q.maxPoints || 1)) * 100)}%`,
                                   background: (scores[activeQ] ?? 0) >= (a.maxPoints || q.maxPoints || 0) * 0.6 ? "#4ade80" : "#f97316",
                                 }} />
                          </div>
                        </div>
                      </div>
                      <textarea
                        placeholder="Retroalimentación para el estudiante (opcional)..."
                        value={feedbacks[activeQ] || ""}
                        onChange={e => setFeedbacks(p => ({ ...p, [activeQ]: e.target.value }))}
                        rows={3}
                        className="w-full mt-3 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none resize-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      />
                    </div>
                  </div>
                )}

                {/* Nav entre preguntas */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <button onClick={() => setActiveQ(Math.max(0, activeQ - 1))}
                    disabled={activeQ === 0}
                    className="px-4 py-2 rounded-xl text-sm text-gray-400 border border-white/[0.08] disabled:opacity-30 hover:bg-white/[0.04] transition-all">
                    ← Anterior
                  </button>
                  <span className="text-gray-600 text-xs">{activeQ + 1} / {questions.length}</span>
                  <button onClick={() => setActiveQ(Math.min(questions.length - 1, activeQ + 1))}
                    disabled={activeQ === questions.length - 1}
                    className="px-4 py-2 rounded-xl text-sm text-gray-400 border border-white/[0.08] disabled:opacity-30 hover:bg-white/[0.04] transition-all">
                    Siguiente →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer con botón guardar */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.07] flex-shrink-0"
             style={{ background: "rgba(255,255,255,0.02)" }}>
          <div>
            <p className="text-gray-400 text-sm font-semibold">
              Nota final: <span className={`font-bold ${previewGrade.grade >= 6 ? "text-green-400" : previewGrade.grade >= 4 ? "text-blue-400" : "text-red-400"}`}>
                {previewGrade.grade}
              </span>
            </p>
            <p className="text-gray-600 text-xs">{previewGrade.earned}/{previewGrade.total} pts · {previewGrade.pct}%</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-gray-400 border border-white/[0.08] hover:bg-white/[0.04] transition-all">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}>
              {saving ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Guardando...</>
              ) : (
                <><Save size={15} /> Guardar revisión</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ResultadosExamenPage() {
  const params = useParams()
  const examId = params.id as string
  const [user,        setUser]        = useState<any>(null)
  const [exam,        setExam]        = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [incidentSub, setIncidentSub] = useState<any>(null)
  const [reviewSub,   setReviewSub]   = useState<any>(null)   // ← nuevo
  const supabase = createClient()
  const router   = useRouter()

  const fetchData = async () => {
    const res  = await fetch(`/api/agents/examen-docente?examId=${examId}`)
    const data = await res.json()
    if (data.exam)        setExam(data.exam)
    if (data.submissions) setSubmissions(data.submissions)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else setUser(user)
    })
    fetchData().then(() => setLoading(false))
    const interval = setInterval(() => { setRefreshing(true); fetchData().then(() => setRefreshing(false)) }, 15000)
    return () => clearInterval(interval)
  }, [examId])

  const toggleStatus = async () => {
    if (!exam || !user) return
    const action = exam.status === "active" ? "close" : "reopen"
    await fetch("/api/agents/examen-docente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, examId, teacherId: user.id }),
    })
    fetchData()
  }

  // ── Stats ──
  const totalStudents = submissions.length
  const avgGrade   = totalStudents > 0 ? submissions.reduce((a, s) => a + s.grade, 0) / totalStudents : 0
  const avgScore   = totalStudents > 0 ? submissions.reduce((a, s) => a + s.score, 0) / totalStudents : 0
  const passCount  = submissions.filter(s => s.grade >= 4.0).length
  const maxGrade   = totalStudents > 0 ? Math.max(...submissions.map(s => s.grade)) : 0
  const minGrade   = totalStudents > 0 ? Math.min(...submissions.map(s => s.grade)) : 0
  const pendingReview = submissions.filter(s => !s.manually_reviewed && (exam?.questions || []).some((q: any) => q.type === "development" || q.type === "true_false")).length

  const dist = { "7.0-6.0": 0, "5.9-5.0": 0, "4.9-4.0": 0, "3.9-3.0": 0, "2.9-1.0": 0 }
  submissions.forEach(s => {
    if      (s.grade >= 6.0) dist["7.0-6.0"]++
    else if (s.grade >= 5.0) dist["5.9-5.0"]++
    else if (s.grade >= 4.0) dist["4.9-4.0"]++
    else if (s.grade >= 3.0) dist["3.9-3.0"]++
    else                     dist["2.9-1.0"]++
  })

  const examUrl = exam ? `${typeof window !== "undefined" ? window.location.origin : ""}/examen/p/${exam.code}` : ""

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-wrap items-start gap-3 mb-6">
          <Link href="/examen/docente" className="text-gray-500 hover:text-white mt-1">←</Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{exam?.title}</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {exam?.topic} · Código: <span className="font-mono text-blue-400">{exam?.code}</span>
              {refreshing && <span className="ml-2 text-blue-400 animate-pulse">actualizando...</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={toggleStatus}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                exam?.status === "active"
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-gray-500/10 border-gray-500/30 text-gray-400"
              }`}>
              {exam?.status === "active" ? "🟢 Activo" : "⭕ Cerrado"}
            </button>
            <button onClick={toggleStatus}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/[0.08] bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] transition-all">
              {exam?.status === "active" ? "Cerrar" : "Reabrir"}
            </button>
          </div>
        </div>

        {/* Alert de pendientes */}
        {pendingReview > 0 && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
               style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-sm">
              <strong>{pendingReview} alumno{pendingReview !== 1 ? "s" : ""}</strong> con preguntas de desarrollo o V/F pendientes de revisión manual.
              Haz clic en <strong>Revisar</strong> para asignar puntajes.
            </p>
          </div>
        )}

        {/* Stats */}
        {totalStudents > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {[
              { label: "Alumnos",   value: totalStudents },
              { label: "Promedio",  value: avgGrade.toFixed(1) },
              { label: "Aprobados", value: `${passCount}/${totalStudents}` },
              { label: "Nota máx",  value: maxGrade },
              { label: "Nota mín",  value: minGrade },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-3 text-center"
                   style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-white text-xl font-bold">{s.value}</p>
                <p className="text-gray-600 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Distribución + exports */}
        {totalStudents > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex flex-wrap gap-2">
              {Object.entries(dist).map(([range, count]) => (
                <div key={range} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                     style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-gray-400 text-xs font-mono">{range}</span>
                  <span className="text-white text-xs font-bold">{count}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <ReportExporter exam={exam} submissions={submissions} />
            </div>
          </div>
        )}

        {/* Tabla */}
        {totalStudents === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-white/[0.06]"
               style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="text-4xl mb-3">⏳</div>
            <h3 className="text-white font-bold mb-1">Esperando alumnos...</h3>
            <p className="text-gray-500 text-sm mb-3">Comparte el link para que tus estudiantes rindan el examen</p>
            <p className="text-blue-400 text-xs font-mono">{examUrl}</p>
            <p className="text-gray-600 text-xs mt-2">La tabla se actualiza automáticamente cada 15 segundos</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06]"
               style={{ background: "rgba(255,255,255,0.01)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-3 text-gray-500 text-xs font-semibold">#</th>
                  <th className="text-left py-3 px-3 text-gray-500 text-xs font-semibold">Nombre</th>
                  <th className="text-left py-3 px-3 text-gray-500 text-xs font-semibold">Curso</th>
                  <th className="text-left py-3 px-3 text-gray-500 text-xs font-semibold">RUT</th>
                  <th className="text-center py-3 px-3 text-gray-500 text-xs font-semibold">Correctas</th>
                  <th className="text-center py-3 px-3 text-gray-500 text-xs font-semibold">%</th>
                  <th className="text-center py-3 px-3 text-gray-500 text-xs font-semibold">Nota</th>
                  <th className="text-center py-3 px-3 text-gray-500 text-xs font-semibold">Revisado</th>
                  <th className="text-center py-3 px-3 text-gray-500 text-xs font-semibold">Incidentes</th>
                  <th className="text-center py-3 px-3 text-gray-500 text-xs font-semibold">Acciones</th>
                  <th className="text-right py-3 px-3 text-gray-500 text-xs font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => (
                  <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 text-gray-600 text-xs">{i + 1}</td>
                    <td className="py-3 px-3 text-gray-200 font-medium text-sm">{s.student_name}</td>
                    <td className="py-3 px-3 text-gray-400 text-xs">{s.student_course}</td>
                    <td className="py-3 px-3 text-gray-500 font-mono text-xs">{s.student_rut || "—"}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-gray-300 text-xs font-medium">{s.correct_count}/{s.total_questions}</span>
                      {s.earned_points != null && s.total_points != null && (
                        <span className="block text-[10px] text-gray-600">{s.earned_points}/{s.total_points} pts</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-xs font-semibold ${s.score >= 60 ? "text-green-400" : "text-red-400"}`}>
                        {Math.round(s.score)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-bold text-sm px-2 py-0.5 rounded-lg ${
                        s.grade >= 6.0 ? "bg-green-500/10 text-green-400" :
                        s.grade >= 4.0 ? "bg-blue-500/10 text-blue-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>{s.grade}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {s.manually_reviewed
                        ? <span className="text-green-400 text-xs font-semibold">✓ Revisado</span>
                        : <span className="text-gray-600 text-xs">—</span>
                      }
                    </td>
                    <td className="py-3 px-3 text-center">
                      {(s.incident_count ?? 0) > 0 ? (
                        <button onClick={() => setIncidentSub(s)} className="mx-auto block">
                          <RiskBadge level={s.incident_level || "clean"} count={s.incident_count || 0} />
                        </button>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setReviewSub(s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={{
                            background: s.manually_reviewed ? "rgba(34,197,94,0.08)" : "rgba(59,130,246,0.1)",
                            border: `1px solid ${s.manually_reviewed ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.25)"}` ,
                            color: s.manually_reviewed ? "#4ade80" : "#93c5fd",
                          }}>
                          {s.manually_reviewed ? <><CheckCircle2 size={11} /> Ver</> : <><Eye size={11} /> Revisar</>}
                        </button>

                        <StudentPdfExporter exam={exam} submission={s} />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600 text-xs">
                      {new Date(s.submitted_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modal de incidentes */}
      {incidentSub && (
        <IncidentModal submission={incidentSub} examId={examId} onClose={() => setIncidentSub(null)} />
      )}

      {/* Modal de revisión manual */}
      {reviewSub && exam && (
        <ReviewModal
          submission={reviewSub}
          exam={exam}
          onClose={() => setReviewSub(null)}
          onSave={(updated) => {
            setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s))
            setReviewSub(null)
          }}
        />
      )}
    </div>
  )
}
