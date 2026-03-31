"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Shield,
  X,
  AlertTriangle,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Save,
  Trash2,
  Loader2,
} from "lucide-react"
import ReportExporter from "./ReportExporter"
import StudentPdfExporter from "./StudentPdfExporter"

function RiskBadge({ level, count }: { level: string; count: number }) {
  if (count === 0 || level === "clean") {
    return <span className="text-gray-700 text-xs">—</span>
  }

  const cfg =
    {
      low: {
        color: "#fbbf24",
        bg: "rgba(251,191,36,0.1)",
        border: "rgba(251,191,36,0.25)",
        label: "Leve",
      },
      medium: {
        color: "#f97316",
        bg: "rgba(249,115,22,0.1)",
        border: "rgba(249,115,22,0.25)",
        label: "Medio",
      },
      high: {
        color: "#ef4444",
        bg: "rgba(239,68,68,0.1)",
        border: "rgba(239,68,68,0.25)",
        label: "Alto",
      },
    }[level] || {
      color: "#9ca3af",
      bg: "rgba(156,163,175,0.1)",
      border: "rgba(156,163,175,0.2)",
      label: "?",
    }

  return (
    <span
      className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
      }}
    >
      ⚑ {count} {cfg.label}
    </span>
  )
}

const EVENT_LABELS: Record<string, string> = {
  fullscreen_exit: "🖥 Salió de pantalla completa",
  window_blur: "🪟 Perdió foco de ventana",
  tab_hidden: "📑 Cambió de pestaña",
  copy_attempt: "📋 Intentó copiar",
  paste_attempt: "📋 Intentó pegar",
  cut_attempt: "✂️ Intentó cortar",
  contextmenu_attempt: "🖱 Abrió menú contextual",
  blocked_shortcut: "⌨️ Tecla bloqueada",
  print_attempt: "🖨 Intentó imprimir",
  reload_attempt: "🔄 Intentó recargar",
}

function IncidentModal({
  submission,
  examId,
  onClose,
}: {
  submission: any
  examId: string
  onClose: () => void
}) {
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/exam-security/event?examId=${examId}&submissionId=${submission.id}`)
      .then((r) => r.json())
      .then((d) => setIncidents(d.incidents || []))
      .finally(() => setLoading(false))
  }, [submission.id, examId])

  const SEV: Record<string, string> = {
    high: "#ef4444",
    medium: "#f97316",
    low: "#fbbf24",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-sm">Incidentes — {submission.student_name}</h3>
            <p className="text-gray-500 text-xs">
              {incidents.length} evento{incidents.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-red-400 animate-spin" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-8">
              <Shield size={28} className="text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Sin incidentes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc: any, i: number) => (
                <div
                  key={inc.id || i}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: SEV[inc.severity] || "#9ca3af" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-gray-200 text-xs font-medium">
                        #{inc.incident_number} — {EVENT_LABELS[inc.event_type] || inc.event_type}
                      </p>
                      <span className="text-gray-600 text-[10px] flex items-center gap-1">
                        <Clock size={9} />
                        {new Date(inc.created_at).toLocaleTimeString("es-CL", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {inc.question_index != null && (
                        <span className="text-gray-600 text-[10px]">
                          Pregunta {inc.question_index + 1}
                        </span>
                      )}
                      {inc.client_time_left != null && (
                        <span className="text-gray-600 text-[10px]">
                          {Math.floor(inc.client_time_left / 60)}:
                          {String(inc.client_time_left % 60).padStart(2, "0")} rest.
                        </span>
                      )}
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

function DeleteSubmissionModal({
  submission,
  deleting,
  onClose,
  onConfirm,
}: {
  submission: any
  deleting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <Trash2 size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Eliminar registro</h3>
              <p className="text-gray-500 text-xs">Esta acción no se puede deshacer.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            ¿Estás seguro de quitar a{" "}
            <span className="font-bold text-white">{submission.student_name || "este estudiante"}</span>?
          </p>

          <div
            className="rounded-xl px-4 py-3 text-xs"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-gray-400">
              Curso: <span className="text-gray-200">{submission.student_course || "—"}</span>
            </p>
            <p className="text-gray-400 mt-1">
              RUT: <span className="text-gray-200">{submission.student_rut || "—"}</span>
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#9ca3af",
              }}
            >
              Cancelar
            </button>

            <button
              onClick={onConfirm}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              style={{
                background: deleting ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.2)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#fca5a5",
              }}
            >
              {deleting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Sí, quitar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewModal({
  submission,
  exam,
  onClose,
  onSave,
}: {
  submission: any
  exam: any
  onClose: () => void
  onSave: (updated: any) => void
}) {
  const questions: any[] = exam?.questions || []
  const answers: any[] = submission?.answers || []

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
      if (a.type === "development") init[i] = a.manualFeedback || a.aiFeedback || ""
      if (a.type === "true_false") init[i] = a.justificationFeedback || ""
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

  const getLiveQuestionState = (answer: any, question: any, index: number) => {
    if (answer?.type === "multiple_choice") {
      const liveCorrect = mcOverrides[index] ?? answer?.isCorrect
      return {
        reviewed: true,
        correct: !!liveCorrect,
        score: liveCorrect ? Number(answer?.maxPoints || question?.maxPoints || 0) : 0,
      }
    }

    if (answer?.type === "true_false") {
      const hasScore = scores[index] != null
      const liveScore = Number(hasScore ? scores[index] : answer?.justificationScore ?? 0)
      const selPts = answer?.selectionCorrect || answer?.isCorrect ? Number(answer?.selectionPoints || 1) : 0
      return {
        reviewed: hasScore || answer?.justificationScore != null,
        correct: (answer?.selectionCorrect || answer?.isCorrect) && liveScore > 0,
        score: selPts + liveScore,
      }
    }

    if (answer?.type === "development") {
      const hasScore = scores[index] != null
      const liveScore = Number(hasScore ? scores[index] : answer?.manualScore ?? answer?.aiScore ?? 0)
      return {
        reviewed: hasScore || answer?.manualScore != null || answer?.aiEvaluated,
        correct: false,
        score: liveScore,
      }
    }

    return { reviewed: true, correct: false, score: 0 }
  }

  const previewGrade = (() => {
    let earned = 0
    let total = 0

    answers.forEach((a: any, i: number) => {
      const q = questions[i]
      const max = Number(a.maxPoints || q?.maxPoints || 0)
      total += max

      const live = getLiveQuestionState(a, q, i)
      earned += Math.min(max, Math.max(0, Number(live.score || 0)))
    })

    const pct = total > 0 ? (earned / total) * 100 : 0
    const ex = exam?.settings?.examPercentage || 60
    const g = pct >= ex ? 4 + ((pct - ex) * 3) / (100 - ex) : 1 + (pct * 3) / ex

    return {
      earned: Math.round(earned * 10) / 10,
      total: Math.round(total * 10) / 10,
      pct: Math.round(pct),
      grade: Math.round(g * 10) / 10,
    }
  })()

  const needsReview = (ans: any, idx: number) => {
    const live = getLiveQuestionState(ans, questions[idx], idx)
    if (ans?.type === "development") return !live.reviewed
    if (ans?.type === "true_false") return !live.reviewed
    return false
  }

  const pendingCount = answers.filter((ans: any, idx: number) => needsReview(ans, idx)).length

  async function handleSave() {
    setSaving(true)

    try {
      const updatedAnswers = answers.map((a: any, i: number) => {
        if (a.type === "multiple_choice") {
          return { ...a, isCorrect: mcOverrides[i] ?? a.isCorrect }
        }
        if (a.type === "true_false") {
          return {
            ...a,
            justificationScore: scores[i] ?? a.justificationScore,
            justificationFeedback: feedbacks[i] ?? a.justificationFeedback,
          }
        }
        if (a.type === "development") {
          return {
            ...a,
            manualScore: scores[i] ?? a.aiScore,
            aiScore: scores[i] ?? a.aiScore,
            manualFeedback: feedbacks[i] ?? a.aiFeedback,
            aiEvaluated: true,
          }
        }
        return a
      })

      const res = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_submission",
          submissionId: submission.id,
          updatedAnswers,
          examPercentage: exam?.settings?.examPercentage || 60,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data?.error || "No se pudo guardar la revisión")
      }

      const updatedSubmission = {
        ...submission,
        answers: updatedAnswers,
        score: data.score,
        grade: data.grade,
        correct_count: data.correct_count,
        earned_points: data.earned_points,
        total_points: data.total_points,
        manually_reviewed: true,
      }

      onSave(updatedSubmission)
      onClose()
    } catch (error: any) {
      alert(error?.message || "No se pudo guardar la revisión")
    } finally {
      setSaving(false)
    }
  }

  const q = questions[activeQ]
  const a = answers[activeQ]

  const typeLabel = (t: string) =>
    t === "multiple_choice" ? "Alternativas" : t === "true_false" ? "V/F" : "Desarrollo"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-4xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0a0f1a", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div>
            <h2 className="text-white font-bold text-base">Revisión — {submission.student_name}</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {submission.student_course} · {submission.student_rut || "Sin RUT"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <StudentPdfExporter exam={exam} submission={submission} />

            <div
              className="text-center px-3 py-1.5 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-gray-500 text-[10px] mb-0.5">Nota actual</p>
              <p
                className={`text-lg font-bold leading-none ${
                  previewGrade.grade >= 6
                    ? "text-green-400"
                    : previewGrade.grade >= 4
                      ? "text-blue-400"
                      : "text-red-400"
                }`}
              >
                {previewGrade.grade}
              </p>
              <p className="text-gray-600 text-[10px]">
                {previewGrade.earned}/{previewGrade.total} pts
              </p>
            </div>

            {pendingCount > 0 && (
              <span
                className="px-2 py-1 rounded-lg text-[10px] font-bold"
                style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}
              >
                {pendingCount} sin revisar
              </span>
            )}

            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            className="w-40 flex-shrink-0 border-r border-white/[0.06] overflow-y-auto py-2"
            style={{ background: "rgba(0,0,0,0.3)" }}
          >
            {questions.map((qq: any, i: number) => {
              const aa = answers[i]
              const isActive = i === activeQ
              const live = getLiveQuestionState(aa, qq, i)

              return (
                <button
                  key={i}
                  onClick={() => setActiveQ(i)}
                  className="w-full text-left px-3 py-2.5 transition-all"
                  style={{
                    background: isActive ? "rgba(59,130,246,0.15)" : "transparent",
                    borderRight: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: isActive ? "#93c5fd" : "#6b7280" }}>
                      P{i + 1}
                    </span>

                    {aa?.type === "multiple_choice" &&
                      (live.correct ? (
                        <CheckCircle2 size={12} className="text-green-400" />
                      ) : (
                        <XCircle size={12} className="text-red-400" />
                      ))}

                    {(aa?.type === "development" || aa?.type === "true_false") &&
                      (live.reviewed ? (
                        <CheckCircle2 size={12} className="text-blue-400" />
                      ) : (
                        <AlertTriangle size={12} className="text-amber-400" />
                      ))}
                  </div>

                  <p className="text-[10px] text-gray-600 mt-0.5 truncate">{typeLabel(qq?.type || "")}</p>
                  <p
                    className="text-[10px] font-semibold"
                    style={{
                      color:
                        aa?.type === "development" || aa?.type === "true_false"
                          ? live.reviewed
                            ? "#60a5fa"
                            : "#fbbf24"
                          : live.correct
                            ? "#4ade80"
                            : "#f87171",
                    }}
                  >
                    {aa?.type === "development"
                      ? `${live.score}/${aa?.maxPoints || qq?.maxPoints || 0} pts`
                      : aa?.type === "true_false"
                        ? live.reviewed
                          ? `${live.score}/${aa?.maxPoints || qq?.maxPoints || 0} pts`
                          : "Pendiente"
                        : live.correct
                          ? "Correcta"
                          : "Incorrecta"}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {q && a && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                        style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd" }}
                      >
                        Pregunta {activeQ + 1} de {questions.length}
                      </span>

                      <span
                        className="px-2 py-0.5 rounded-lg text-[10px]"
                        style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}
                      >
                        {typeLabel(a.type)} · {a.maxPoints || q.maxPoints || 0} pts máx
                      </span>
                    </div>

                    <p className="text-white text-sm leading-relaxed">{q.question}</p>
                  </div>
                </div>

                {a.type === "multiple_choice" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {(q.options || []).map((opt: string, oi: number) => {
                        const isStudentAnswer = a.selectedAnswer === oi
                        const isCorrectAnswer = q.correctAnswer === oi

                        return (
                          <div
                            key={oi}
                            className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                            style={{
                              background: isCorrectAnswer
                                ? "rgba(34,197,94,0.08)"
                                : isStudentAnswer
                                  ? "rgba(239,68,68,0.08)"
                                  : "rgba(255,255,255,0.03)",
                              border: `1px solid ${
                                isCorrectAnswer
                                  ? "rgba(34,197,94,0.3)"
                                  : isStudentAnswer
                                    ? "rgba(239,68,68,0.3)"
                                    : "rgba(255,255,255,0.06)"
                              }`,
                            }}
                          >
                            <span
                              className="text-xs font-bold mt-0.5 flex-shrink-0"
                              style={{
                                color: isCorrectAnswer ? "#4ade80" : isStudentAnswer ? "#f87171" : "#6b7280",
                              }}
                            >
                              {["A", "B", "C", "D"][oi]}.
                            </span>

                            <span
                              className="text-sm flex-1"
                              style={{
                                color: isCorrectAnswer ? "#86efac" : isStudentAnswer ? "#fca5a5" : "#9ca3af",
                              }}
                            >
                              {opt}
                            </span>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isStudentAnswer && (
                                <span className="text-[10px] font-bold text-blue-400">← estudiante</span>
                              )}
                              {isCorrectAnswer && (
                                <span className="text-[10px] font-bold text-green-400">✓ correcta</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {q.explanation && (
                      <div
                        className="rounded-xl px-4 py-3 text-xs"
                        style={{
                          background: "rgba(59,130,246,0.06)",
                          border: "1px solid rgba(59,130,246,0.15)",
                        }}
                      >
                        <p className="text-blue-300 font-semibold mb-1">💡 Explicación</p>
                        <p className="text-gray-400">{q.explanation}</p>
                      </div>
                    )}

                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <p className="text-gray-400 text-xs font-semibold mb-2">Revisión del docente</p>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setMcOverrides((p) => ({ ...p, [activeQ]: true }))}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background:
                              mcOverrides[activeQ] === true
                                ? "rgba(34,197,94,0.2)"
                                : "rgba(255,255,255,0.04)",
                            border: `1px solid ${
                              mcOverrides[activeQ] === true
                                ? "rgba(34,197,94,0.4)"
                                : "rgba(255,255,255,0.08)"
                            }`,
                            color: mcOverrides[activeQ] === true ? "#4ade80" : "#6b7280",
                          }}
                        >
                          ✓ Correcta
                        </button>

                        <button
                          onClick={() => setMcOverrides((p) => ({ ...p, [activeQ]: false }))}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background:
                              mcOverrides[activeQ] === false
                                ? "rgba(239,68,68,0.2)"
                                : "rgba(255,255,255,0.04)",
                            border: `1px solid ${
                              mcOverrides[activeQ] === false
                                ? "rgba(239,68,68,0.4)"
                                : "rgba(255,255,255,0.08)"
                            }`,
                            color: mcOverrides[activeQ] === false ? "#f87171" : "#6b7280",
                          }}
                        >
                          ✗ Incorrecta
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {a.type === "true_false" && (
                  <div className="space-y-3">
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <p className="text-gray-500 text-xs font-semibold mb-2">
                        SELECCIÓN ({a.selectionPoints || 1} pt)
                      </p>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                            a.selectionCorrect
                              ? "bg-green-500/15 text-green-400"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {a.selectionCorrect ? "✓" : "✗"} Estudiante eligió:{" "}
                          {(q.options || ["Verdadero", "Falso"])[a.selectedAnswer]}
                        </span>

                        <span className="text-gray-600 text-xs">
                          Correcta: {(q.options || ["Verdadero", "Falso"])[q.correctAnswer]}
                        </span>
                      </div>
                    </div>

                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <p className="text-gray-500 text-xs font-semibold mb-2">
                        JUSTIFICACIÓN (máx {a.justificationMaxPoints || 0} pts)
                      </p>

                      <div
                        className="rounded-lg px-3 py-2.5 mb-3"
                        style={{
                          background: "rgba(59,130,246,0.06)",
                          border: "1px solid rgba(59,130,246,0.15)",
                        }}
                      >
                        <p className="text-blue-300 text-xs font-semibold mb-1">Respuesta del estudiante</p>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {a.justification || <span className="text-gray-600 italic">Sin justificación</span>}
                        </p>
                      </div>

                      {q.explanation && (
                        <div
                          className="rounded-lg px-3 py-2.5 mb-3"
                          style={{
                            background: "rgba(34,197,94,0.05)",
                            border: "1px solid rgba(34,197,94,0.15)",
                          }}
                        >
                          <p className="text-green-400 text-xs font-semibold mb-1">
                            Explicación correcta (referencia)
                          </p>
                          <p className="text-gray-400 text-sm">{q.explanation}</p>
                        </div>
                      )}

                      {a.aiFeedback && a.aiFeedback !== "Pendiente de revisión manual" && (
                        <div
                          className="rounded-lg px-3 py-2.5 mb-3"
                          style={{
                            background: "rgba(139,92,246,0.06)",
                            border: "1px solid rgba(139,92,246,0.15)",
                          }}
                        >
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
                          onChange={(e) =>
                            setScores((p) => ({
                              ...p,
                              [activeQ]: Math.max(
                                0,
                                Math.min(a.justificationMaxPoints || 0, Number(e.target.value)),
                              ),
                            }))
                          }
                          className="w-20 text-center rounded-xl px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.15)",
                          }}
                        />

                        <span className="text-gray-600 text-xs">/ {a.justificationMaxPoints || 0} pts</span>
                      </div>

                      <textarea
                        placeholder="Retroalimentación opcional..."
                        value={feedbacks[activeQ] || ""}
                        onChange={(e) => setFeedbacks((p) => ({ ...p, [activeQ]: e.target.value }))}
                        rows={2}
                        className="w-full mt-3 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none resize-none"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {a.type === "development" && (
                  <div className="space-y-3">
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: "rgba(59,130,246,0.06)",
                        border: "1px solid rgba(59,130,246,0.15)",
                      }}
                    >
                      <p className="text-blue-300 text-xs font-semibold mb-2">Respuesta del estudiante</p>
                      <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                        {a.devText || <span className="text-gray-600 italic">Sin respuesta</span>}
                      </p>
                    </div>

                    {q.modelAnswer && (
                      <div
                        className="rounded-xl px-4 py-3"
                        style={{
                          background: "rgba(34,197,94,0.05)",
                          border: "1px solid rgba(34,197,94,0.15)",
                        }}
                      >
                        <p className="text-green-400 text-xs font-semibold mb-2">
                          ✓ Respuesta modelo (referencia)
                        </p>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {q.modelAnswer}
                        </p>
                      </div>
                    )}

                    {q.rubric && q.rubric.length > 0 && (
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div className="px-4 py-3 border-b border-white/[0.06]">
                          <p className="text-gray-400 text-xs font-semibold">Rúbrica</p>
                        </div>
                        <div className="divide-y divide-white/[0.05]">
                          {q.rubric.map((r: any, idx: number) => (
                            <div key={idx} className="px-4 py-2.5 flex items-center justify-between gap-4">
                              <p className="text-sm text-gray-300">
                                {r.criteria || r.criterion || r.criterio || "Criterio"}
                              </p>
                              <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">
                                {r.points || r.puntos || r.puntaje || 0} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {a.aiFeedback && a.aiFeedback !== "Pendiente de revisión manual" && (
                      <div
                        className="rounded-xl px-4 py-3"
                        style={{
                          background: "rgba(139,92,246,0.06)",
                          border: "1px solid rgba(139,92,246,0.15)",
                        }}
                      >
                        <p className="text-purple-300 text-xs font-semibold mb-2">🤖 Evaluación IA</p>
                        <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                          {a.aiFeedback}
                        </p>
                      </div>
                    )}

                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <label className="text-gray-400 text-xs font-semibold whitespace-nowrap">
                          Puntaje:
                        </label>

                        <input
                          type="number"
                          min={0}
                          max={a.maxPoints || q.maxPoints || 0}
                          step={0.5}
                          value={scores[activeQ] ?? a.manualScore ?? a.aiScore ?? 0}
                          onChange={(e) =>
                            setScores((p) => ({
                              ...p,
                              [activeQ]: Math.max(
                                0,
                                Math.min(a.maxPoints || q.maxPoints || 0, Number(e.target.value)),
                              ),
                            }))
                          }
                          className="w-20 text-center rounded-xl px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.15)",
                          }}
                        />

                        <span className="text-gray-600 text-xs">/ {a.maxPoints || q.maxPoints || 0} pts</span>
                      </div>

                      <textarea
                        placeholder="Retroalimentación del docente..."
                        value={feedbacks[activeQ] || ""}
                        onChange={(e) => setFeedbacks((p) => ({ ...p, [activeQ]: e.target.value }))}
                        rows={4}
                        className="w-full mt-3 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none resize-y"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div
          className="px-5 py-4 border-t border-white/[0.07] flex items-center justify-between gap-3"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="text-xs text-gray-500">
            Guarda los cambios para actualizar nota, puntajes y retroalimentación.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#9ca3af",
              }}
            >
              Cerrar
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              style={{
                background: "rgba(59,130,246,0.2)",
                border: "1px solid rgba(59,130,246,0.35)",
                color: "#93c5fd",
              }}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={15} />
                  Guardar revisión
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResultadosExamenPage() {
  const params = useParams()
  const examId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [exam, setExam] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [incidentSub, setIncidentSub] = useState<any>(null)
  const [reviewSub, setReviewSub] = useState<any>(null)
  const [deleteSub, setDeleteSub] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  const fetchData = async () => {
    const res = await fetch(`/api/agents/examen-docente?examId=${examId}`)
    const data = await res.json()
    if (data.exam) setExam(data.exam)
    if (data.submissions) setSubmissions(data.submissions)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else setUser(user)
    })

    fetchData().then(() => setLoading(false))

    const interval = setInterval(() => {
      setRefreshing(true)
      fetchData().then(() => setRefreshing(false))
    }, 15000)

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

  const handleDeleteSubmission = async () => {
    if (!deleteSub) return

    setDeletingId(deleteSub.id)

    try {
      const res = await fetch(`/api/examen/submission/${deleteSub.id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar el registro")
      }

      setSubmissions((prev) => prev.filter((s) => s.id !== deleteSub.id))

      if (reviewSub?.id === deleteSub.id) setReviewSub(null)
      if (incidentSub?.id === deleteSub.id) setIncidentSub(null)

      setDeleteSub(null)
    } catch (error: any) {
      alert(error?.message || "No se pudo eliminar el registro")
    } finally {
      setDeletingId(null)
    }
  }

  const totalStudents = submissions.length
  const avgGrade =
    totalStudents > 0 ? submissions.reduce((a, s) => a + Number(s.grade || 0), 0) / totalStudents : 0
  const avgScore =
    totalStudents > 0 ? submissions.reduce((a, s) => a + Number(s.score || 0), 0) / totalStudents : 0
  const passCount = submissions.filter((s) => Number(s.grade || 0) >= 4.0).length
  const maxGrade = totalStudents > 0 ? Math.max(...submissions.map((s) => Number(s.grade || 0))) : 0
  const minGrade = totalStudents > 0 ? Math.min(...submissions.map((s) => Number(s.grade || 0))) : 0

  const pendingReview = submissions.filter(
    (s) =>
      !s.manually_reviewed &&
      (exam?.questions || []).some((q: any) => q.type === "development" || q.type === "true_false"),
  ).length

  const riskTotals = useMemo(() => {
    let low = 0
    let medium = 0
    let high = 0

    submissions.forEach((s) => {
      const lvl = s.risk_level || "clean"
      if (lvl === "low") low += 1
      if (lvl === "medium") medium += 1
      if (lvl === "high") high += 1
    })

    return { low, medium, high }
  }, [submissions])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-start gap-3">
            <Link
              href="/examen/docente"
              className="mt-1 text-gray-500 hover:text-white transition-colors"
            >
              ←
            </Link>

            <div>
              <h1 className="text-2xl font-bold text-white">{exam?.title || "Resultados del examen"}</h1>
              <p className="text-gray-500 text-sm mt-1">
                Código: {exam?.code || "—"} · Estado:{" "}
                <span className={exam?.status === "active" ? "text-green-400" : "text-red-400"}>
                  {exam?.status === "active" ? "Activo" : "Cerrado"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleStatus}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background:
                  exam?.status === "active" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                border:
                  exam?.status === "active"
                    ? "1px solid rgba(239,68,68,0.25)"
                    : "1px solid rgba(34,197,94,0.25)",
                color: exam?.status === "active" ? "#fca5a5" : "#86efac",
              }}
            >
              {exam?.status === "active" ? "Cerrar examen" : "Reabrir examen"}
            </button>

            <ReportExporter exam={exam} submissions={submissions} />

            <span className="text-[10px] text-gray-600">
              {refreshing ? "Actualizando..." : "Auto refresh 15s"}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Rindieron", value: totalStudents, color: "#93c5fd" },
            { label: "Promedio nota", value: avgGrade.toFixed(1), color: "#c4b5fd" },
            { label: "Promedio logro", value: `${Math.round(avgScore)}%`, color: "#67e8f9" },
            { label: "Aprobados", value: `${passCount}/${totalStudents}`, color: "#86efac" },
            { label: "Máxima", value: maxGrade.toFixed(1), color: "#f9a8d4" },
            { label: "Mínima", value: minGrade.toFixed(1), color: "#fca5a5" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-gray-500 text-xs font-semibold mb-1">{card.label}</p>
              <p className="text-xl font-bold" style={{ color: card.color }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[2fr_1fr] gap-4 mb-8">
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-white font-semibold text-sm mb-3">Resumen de revisión</p>

            <div className="flex flex-wrap gap-3">
              <span
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd" }}
              >
                {pendingReview} pendientes de revisión manual
              </span>

              <span
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
              >
                Riesgo leve: {riskTotals.low}
              </span>

              <span
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(249,115,22,0.12)", color: "#fb923c" }}
              >
                Riesgo medio: {riskTotals.medium}
              </span>

              <span
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}
              >
                Riesgo alto: {riskTotals.high}
              </span>
            </div>
          </div>

          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-white font-semibold text-sm mb-1">Acciones</p>
            <p className="text-gray-500 text-xs">
              Revisa, exporta PDF individual o elimina registros erróneos.
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr
                  className="text-left text-[11px] uppercase tracking-wide"
                  style={{ background: "rgba(255,255,255,0.03)", color: "#6b7280" }}
                >
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-3">Curso</th>
                  <th className="py-3 px-3">RUT</th>
                  <th className="py-3 px-3 text-center">Nota</th>
                  <th className="py-3 px-3 text-center">Logro</th>
                  <th className="py-3 px-3 text-center">Puntaje</th>
                  <th className="py-3 px-3 text-center">Riesgo</th>
                  <th className="py-3 px-3 text-center">Revisión</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-500 text-sm">
                      Aún no hay estudiantes que hayan rendido este examen.
                    </td>
                  </tr>
                ) : (
                  submissions.map((s: any) => (
                    <tr
                      key={s.id}
                      className="border-t border-white/[0.05]"
                      style={{ background: "rgba(255,255,255,0.01)" }}
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{s.student_name || "Sin nombre"}</p>
                          <p className="text-[11px] text-gray-500">
                            {s.submitted_at
                              ? new Date(s.submitted_at).toLocaleString("es-CL", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </p>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-sm text-gray-300">{s.student_course || "—"}</td>
                      <td className="py-3 px-3 text-sm text-gray-400">{s.student_rut || "—"}</td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-sm font-bold ${
                            Number(s.grade || 0) >= 6
                              ? "text-green-400"
                              : Number(s.grade || 0) >= 4
                                ? "text-blue-400"
                                : "text-red-400"
                          }`}
                        >
                          {Number(s.grade || 0).toFixed(1)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center text-sm font-semibold text-cyan-300">
                        {Math.round(Number(s.score || 0))}%
                      </td>

                      <td className="py-3 px-3 text-center text-sm text-gray-300">
                        {Number(s.earned_points || 0)}/{Number(s.total_points || 0)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <RiskBadge level={s.risk_level || "clean"} count={Number(s.incident_count || 0)} />
                          {Number(s.incident_count || 0) > 0 && (
                            <button
                              onClick={() => setIncidentSub(s)}
                              className="text-xs font-semibold px-2 py-1 rounded-lg transition-all"
                              style={{
                                background: "rgba(239,68,68,0.12)",
                                border: "1px solid rgba(239,68,68,0.2)",
                                color: "#fca5a5",
                              }}
                            >
                              Ver
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {s.manually_reviewed ? (
                          <span
                            className="px-2 py-1 rounded-lg text-[10px] font-bold"
                            style={{ background: "rgba(34,197,94,0.12)", color: "#86efac" }}
                          >
                            Revisado
                          </span>
                        ) : (
                          <span
                            className="px-2 py-1 rounded-lg text-[10px] font-bold"
                            style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}
                          >
                            Pendiente
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setReviewSub(s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                            style={{
                              background: s.manually_reviewed
                                ? "rgba(34,197,94,0.08)"
                                : "rgba(59,130,246,0.1)",
                              border: `1px solid ${
                                s.manually_reviewed
                                  ? "rgba(34,197,94,0.2)"
                                  : "rgba(59,130,246,0.25)"
                              }`,
                              color: s.manually_reviewed ? "#4ade80" : "#93c5fd",
                            }}
                          >
                            {s.manually_reviewed ? (
                              <>
                                <CheckCircle2 size={11} />
                                Ver
                              </>
                            ) : (
                              <>
                                <Eye size={11} />
                                Revisar
                              </>
                            )}
                          </button>

                          <StudentPdfExporter exam={exam} submission={s} />

                          <button
                            onClick={() => setDeleteSub(s)}
                            disabled={deletingId === s.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                            style={{
                              background: "rgba(239,68,68,0.10)",
                              border: "1px solid rgba(239,68,68,0.22)",
                              color: "#fca5a5",
                              opacity: deletingId === s.id ? 0.65 : 1,
                            }}
                          >
                            {deletingId === s.id ? (
                              <>
                                <Loader2 size={11} className="animate-spin" />
                                Eliminando
                              </>
                            ) : (
                              <>
                                <Trash2 size={11} />
                                Eliminar
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {incidentSub && (
        <IncidentModal submission={incidentSub} examId={examId} onClose={() => setIncidentSub(null)} />
      )}

      {reviewSub && (
        <ReviewModal
          submission={reviewSub}
          exam={exam}
          onClose={() => setReviewSub(null)}
          onSave={(updated) => {
            setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
            setReviewSub(updated)
          }}
        />
      )}

      {deleteSub && (
        <DeleteSubmissionModal
          submission={deleteSub}
          deleting={deletingId === deleteSub.id}
          onClose={() => {
            if (!deletingId) setDeleteSub(null)
          }}
          onConfirm={handleDeleteSubmission}
        />
      )}
    </div>
  )
}
