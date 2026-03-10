// src/app/examen/p/[code]/page.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import ExamMathText from "@/components/ui/ExamMathText"

function calcGrade(s: number, e = 60) {
  const p = Math.max(0, Math.min(100, s))
  return Math.round((p >= e ? 4 + ((p - e) * 3) / (100 - e) : 1 + (p * 3) / e) * 10) / 10
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}

function getQuestionMaxPoints(q: any) {
  if (!q) return 1
  if (typeof q.maxPoints === "number" && q.maxPoints > 0) return q.maxPoints

  if (q.type === "true_false") {
    return (
      (typeof q.selectionPoints === "number" ? q.selectionPoints : 1) +
      (typeof q.justificationMaxPoints === "number" ? q.justificationMaxPoints : 2)
    )
  }

  if (q.type === "development") {
    if (Array.isArray(q.rubric) && q.rubric.length > 0) {
      return q.rubric.reduce((acc: number, item: any) => acc + (Number(item?.points) || 0), 0)
    }
    return 5
  }

  return 1
}

type Phase = "loading" | "register" | "exam" | "submitting" | "review" | "error"

export default function ExamenPublicoPage() {
  const { code } = useParams() as { code: string }

  const [phase, setPhase] = useState<Phase>("loading")
  const [exam, setExam] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const [name, setName] = useState("")
  const [course, setCourse] = useState("")
  const [rut, setRut] = useState("")

  const [curQ, setCurQ] = useState(0)
  const [mcAnswers, setMcAnswers] = useState<Record<number, number>>({})
  const [devAnswers, setDevAnswers] = useState<Record<number, string>>({})
  const [tfJustifications, setTfJustifications] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [submission, setSubmission] = useState<any>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startRef = useRef(0)

  useEffect(() => {
    if (!code) return

    fetch(`/api/agents/examen-docente?code=${code}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setErrorMsg(d.error)
          setPhase("error")
          return
        }
        setExam(d.exam)
        setTimeLeft((d.exam.settings?.timeLimit || 30) * 60)
        setPhase("register")
      })
      .catch(() => {
        setErrorMsg("Error cargando examen")
        setPhase("error")
      })
  }, [code])

  useEffect(() => {
    if (phase !== "exam") return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          doSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  const startExam = () => {
    if (!name.trim() || !course.trim()) return
    startRef.current = Date.now()
    setPhase("exam")
  }

  const doSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current)

    setPhase("submitting")

    const qs = exam.questions || []
    const ansArr = qs.map((q: any, i: number) => {
      if (q.type === "development") {
        return {
          devText: devAnswers[i] || "",
          selectedAnswer: -1,
        }
      }

      if (q.type === "true_false") {
        return {
          selectedAnswer: mcAnswers[i] ?? -1,
          justification: tfJustifications[i] || "",
        }
      }

      return {
        selectedAnswer: mcAnswers[i] ?? -1,
      }
    })

    try {
      const res = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          examId: exam.id,
          studentName: name,
          studentCourse: course,
          studentRut: rut || null,
          answers: ansArr,
          questions: qs,
          timeSpent: Math.round((Date.now() - startRef.current) / 1000),
          examPercentage: exam.settings?.examPercentage || 60,
        }),
      })

      const d = await res.json()
      if (!d.success) throw new Error(d.error)

      setSubmission(d.submission)
      setPhase("review")
    } catch (e: any) {
      setErrorMsg(e.message)
      setPhase("error")
    }
  }

  const qs = exam?.questions || []
  const q = qs[curQ]
  const totalQ = qs.length

  const examTotalPoints = qs.reduce(
    (acc: number, item: any) => acc + getQuestionMaxPoints(item),
    0
  )

  const answeredCount = qs.filter((item: any, i: number) => {
    if (item.type === "development") {
      return Boolean(devAnswers[i] && devAnswers[i].trim().length > 0)
    }

    if (item.type === "true_false") {
      return (
        mcAnswers[i] !== undefined ||
        Boolean(tfJustifications[i] && tfJustifications[i].trim().length > 0)
      )
    }

    return mcAnswers[i] !== undefined
  }).length

  const showRes = exam?.settings?.showResultToStudent !== false

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="text-white font-bold text-lg mb-2">Examen no disponible</h2>
          <p className="text-gray-500 text-sm">{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (phase === "submitting") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-green-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Evaluando respuestas con IA...</p>
          <p className="text-gray-600 text-xs mt-1">Esto puede tomar unos segundos</p>
        </div>
      </div>
    )
  }

  if (phase === "register") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">📝</span>
            </div>
            <h1 className="text-xl font-bold text-white">{exam?.title}</h1>
            <p className="text-gray-500 text-sm mt-1">{exam?.topic}</p>

            <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
              <span>📋 {totalQ} preguntas</span>
              <span>⏱ {exam?.settings?.timeLimit || 30} min</span>
              <span>📊 {examTotalPoints} pts</span>
            </div>
          </div>

          {exam?.instructions && (
            <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-2xl p-4">
              <p className="text-blue-400 text-xs font-semibold mb-1">INSTRUCCIONES:</p>
              <div className="text-gray-400 text-sm">
                <ExamMathText text={exam.instructions} className="inline" />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">
                NOMBRE COMPLETO *
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Juan Pérez López"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">
                CURSO *
              </label>
              <input
                value={course}
                onChange={e => setCourse(e.target.value)}
                placeholder="8°A, 1° Medio B"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">
                RUT (opcional)
              </label>
              <input
                value={rut}
                onChange={e => setRut(e.target.value)}
                placeholder="12.345.678-9"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30"
              />
            </div>
          </div>

          <button
            onClick={startExam}
            disabled={!name.trim() || !course.trim()}
            className="w-full py-3.5 rounded-2xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-30"
          >
            Comenzar examen →
          </button>
        </div>
      </div>
    )
  }

  if (phase === "review" && submission) {
    const nota = submission.grade
    const pct = submission.score
    const graded = submission.answers || []

    return (
      <div className="min-h-screen bg-gray-950 px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">
              {nota >= 5.5 ? "🎉" : nota >= 4.0 ? "📚" : "💪"}
            </div>

            {showRes ? (
              <>
                <h2 className="text-3xl font-extrabold text-white">Nota: {nota}</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {nota >= 5.5
                    ? "¡Excelente trabajo!"
                    : nota >= 4.0
                      ? "Aprobado. Sigue practicando."
                      : "Repasa el material."}
                </p>

                <div className="flex justify-center gap-6 mt-3">
                  <div>
                    <p className="text-gray-600 text-xs">Puntaje</p>
                    <p className="text-blue-400 font-bold text-lg">
                      {submission.correct_count}/{examTotalPoints > 0 ? examTotalPoints : 0} pts
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-600 text-xs">Porcentaje</p>
                    <p className="text-blue-400 font-bold text-lg">{Math.round(pct)}%</p>
                  </div>

                  <div>
                    <p className="text-gray-600 text-xs">Tiempo</p>
                    <p className="text-gray-300 font-bold text-lg">
                      {submission.time_spent ? `${Math.round(submission.time_spent / 60)}m` : "—"}
                    </p>
                  </div>
                </div>

                <div className="w-full bg-gray-800 rounded-full h-3 mt-4">
                  <div
                    className={`h-full rounded-full ${nota >= 4.0 ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white">Examen enviado</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Tu docente revisará tus respuestas
                </p>
              </>
            )}
          </div>

          {showRes && (
            <div className="space-y-3">
              <h3 className="text-gray-400 text-xs font-semibold tracking-widest">
                REVISIÓN DETALLADA
              </h3>

              {qs.map((q: any, i: number) => {
                const g = graded[i] || {}
                const isDev = q.type === "development"
                const isTF = q.type === "true_false"
                const baseCorrect = g.isCorrect === true

                const tfSelectionPoints =
                  Number(g.selectionPoints ?? q.selectionPoints ?? 1) || 1
                const tfJustificationScore = Math.max(0, Number(g.justificationScore) || 0)
                const tfJustificationMax = Math.max(
                  0,
                  Number(g.justificationMaxPoints ?? q.justificationMaxPoints ?? 0) || 0
                )
                const tfEarned = (baseCorrect ? tfSelectionPoints : 0) + tfJustificationScore
                const tfTotal = tfSelectionPoints + tfJustificationMax
                const tfFull = isTF && tfTotal > 0 && tfEarned >= tfTotal
                const tfPartial = isTF && tfEarned > 0 && tfEarned < tfTotal

                const reviewState = isDev
                  ? "dev"
                  : isTF
                    ? tfFull
                      ? "full"
                      : tfPartial
                        ? "partial"
                        : "wrong"
                    : baseCorrect
                      ? "full"
                      : "wrong"

                return (
                  <div
                    key={i}
                    className={`rounded-2xl p-4 border ${
                      reviewState === "dev"
                        ? "bg-orange-500/[0.03] border-orange-500/10"
                        : reviewState === "full"
                          ? "bg-green-500/[0.03] border-green-500/10"
                          : reviewState === "partial"
                            ? "bg-yellow-500/[0.03] border-yellow-500/10"
                            : "bg-red-500/[0.03] border-red-500/10"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-sm ${
                          reviewState === "dev"
                            ? "text-orange-400"
                            : reviewState === "full"
                              ? "text-green-400"
                              : reviewState === "partial"
                                ? "text-yellow-400"
                                : "text-red-400"
                        }`}
                      >
                        {reviewState === "dev"
                          ? "✍️"
                          : reviewState === "full"
                            ? "✅"
                            : reviewState === "partial"
                              ? "◑"
                              : "❌"}
                      </span>

                      <span className="text-gray-400 text-xs font-semibold">P{i + 1}</span>

                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          q.type === "multiple_choice"
                            ? "bg-blue-500/10 text-blue-400"
                            : isTF
                              ? "bg-green-500/10 text-green-400"
                              : "bg-orange-500/10 text-orange-400"
                        }`}
                      >
                        {q.type === "multiple_choice"
                          ? "Alternativas"
                          : isTF
                            ? "V/F"
                            : "Desarrollo"}
                      </span>

                      {g.aiScore !== undefined && (
                        <span className="text-[10px] text-blue-400 ml-auto">
                          {g.aiScore}/{g.aiMaxScore} pts (IA)
                        </span>
                      )}

                      {isTF && (
                        <span className="text-[10px] text-blue-400 ml-auto">
                          {tfEarned}/{tfTotal} pts
                        </span>
                      )}
                    </div>

                    <div className="text-gray-200 text-sm mb-3">
                      <ExamMathText text={q.question} className="inline" />
                    </div>

                    {q.type === "multiple_choice" && (
                      <div className="space-y-1 mb-3">
                        {(q.options || []).map((opt: string, j: number) => {
                          const isStudent = g.selectedAnswer === j
                          const isRight = j === q.correctAnswer

                          return (
                            <div
                              key={j}
                              className={`text-xs px-3 py-1.5 rounded-lg ${
                                isRight
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                  : isStudent
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20 line-through"
                                    : "text-gray-600"
                              }`}
                            >
                              {String.fromCharCode(65 + j)}){" "}
                              <ExamMathText text={opt} className="inline" />{" "}
                              {isRight && "✓"} {isStudent && !isRight && "← tu respuesta"}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isTF && (
                      <div className="space-y-2 mb-3">
                        <div className="flex gap-2">
                          {(q.options || ["Verdadero", "Falso"]).map((opt: string, j: number) => (
                            <div
                              key={j}
                              className={`text-xs px-3 py-1.5 rounded-lg flex-1 text-center ${
                                j === q.correctAnswer
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                  : g.selectedAnswer === j
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "text-gray-600"
                              }`}
                            >
                              <ExamMathText text={opt} className="inline" />{" "}
                              {j === q.correctAnswer && "✓"}{" "}
                              {g.selectedAnswer === j && j !== q.correctAnswer && "✗"}
                            </div>
                          ))}
                        </div>

                        {g.justification && (
                          <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.06]">
                            <p className="text-gray-600 text-[10px] font-semibold">
                              TU JUSTIFICACIÓN:
                            </p>
                            <p className="text-gray-300 text-xs whitespace-pre-wrap">
                              {g.justification}
                            </p>
                          </div>
                        )}

                        {g.justificationFeedback && (
                          <div className="bg-blue-500/[0.05] rounded-lg p-2.5 border-l-2 border-blue-500/30">
                            <p className="text-blue-400 text-[10px] font-semibold">
                              EVALUACIÓN IA ({g.justificationScore}/
                              {g.justificationMaxPoints ?? q.justificationMaxPoints ?? 2} pts):
                            </p>
                            <p className="text-gray-400 text-xs whitespace-pre-wrap">
                              {g.justificationFeedback}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {isDev && (
                      <div className="space-y-2 mb-3">
                        <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.06]">
                          <p className="text-gray-600 text-[10px] font-semibold">
                            TU RESPUESTA:
                          </p>
                          <p className="text-gray-300 text-xs whitespace-pre-wrap">
                            {g.devText || "Sin respuesta"}
                          </p>
                        </div>

                        <div className="bg-green-500/[0.05] rounded-lg p-2.5 border border-green-500/10">
                          <p className="text-green-400 text-[10px] font-semibold">
                            RESPUESTA MODELO:
                          </p>
                          <div className="text-gray-300 text-xs">
                            <ExamMathText text={q.modelAnswer || ""} className="inline" />
                          </div>
                        </div>

                        {g.aiFeedback && (
                          <div className="bg-blue-500/[0.05] rounded-lg p-2.5 border-l-2 border-blue-500/30">
                            <p className="text-blue-400 text-[10px] font-semibold">
                              EVALUACIÓN IA ({g.aiScore}/{g.aiMaxScore} pts):
                            </p>
                            <p className="text-gray-400 text-xs whitespace-pre-wrap">
                              {g.aiFeedback}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {q.explanation && !isDev && (
                      <div className="bg-blue-500/[0.05] rounded-lg p-2.5 border-l-2 border-blue-500/30">
                        <p className="text-blue-400 text-[10px] font-semibold">
                          EXPLICACIÓN:
                        </p>
                        <div className="text-gray-400 text-xs">
                          <ExamMathText text={q.explanation} className="inline" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-center mt-6">
            <p className="text-gray-600 text-xs">
              {exam?.title} — {name} ({course})
            </p>
            <p className="text-gray-700 text-xs mt-1">Puedes cerrar esta ventana</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{name}</span>
            <span className="text-gray-700">|</span>
            <span className="text-gray-500 text-xs">
              {answeredCount}/{totalQ}
            </span>
          </div>

          <div
            className={`font-mono font-bold text-sm ${
              timeLeft < 60
                ? "text-red-400 animate-pulse"
                : timeLeft < 300
                  ? "text-yellow-400"
                  : "text-gray-400"
            }`}
          >
            ⏱ {fmt(timeLeft)}
          </div>
        </div>

        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${(answeredCount / totalQ) * 100}%` }}
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {q && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-blue-400 text-xs font-semibold">
                  Pregunta {curQ + 1} de {totalQ}
                </span>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    q.type === "multiple_choice"
                      ? "bg-blue-500/10 text-blue-400"
                      : q.type === "true_false"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-orange-500/10 text-orange-400"
                  }`}
                >
                  {q.type === "multiple_choice"
                    ? "Alternativas"
                    : q.type === "true_false"
                      ? "V/F + Justificación"
                      : "Desarrollo"}
                </span>

                {q.difficulty && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      q.difficulty === 3
                        ? "bg-red-500/10 text-red-400"
                        : q.difficulty === 2
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-green-500/10 text-green-400"
                    }`}
                  >
                    {q.difficulty === 3
                      ? "Difícil"
                      : q.difficulty === 2
                        ? "Media"
                        : "Fácil"}
                  </span>
                )}
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">
                {getQuestionMaxPoints(q)} pts
              </span>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
              <div className="text-white font-semibold text-sm leading-relaxed">
                <ExamMathText text={q.question} className="inline" />
              </div>
            </div>

            {q.type === "multiple_choice" && (
              <div className="space-y-2">
                {(q.options || []).map((opt: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setMcAnswers({ ...mcAnswers, [curQ]: i })}
                    className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all ${
                      mcAnswers[curQ] === i
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                        : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                    <ExamMathText text={opt} className="inline" />
                  </button>
                ))}
              </div>
            )}

            {q.type === "true_false" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(q.options || ["Verdadero", "Falso"]).map((opt: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setMcAnswers({ ...mcAnswers, [curQ]: i })}
                      className={`p-3.5 rounded-xl border text-sm font-semibold text-center transition-all ${
                        mcAnswers[curQ] === i
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                          : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06]"
                      }`}
                    >
                      <ExamMathText text={opt} className="inline" />
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-gray-500 text-xs font-semibold block mb-1">
                    JUSTIFICA TU RESPUESTA *
                  </label>
                  <textarea
                    value={tfJustifications[curQ] || ""}
                    onChange={e =>
                      setTfJustifications({
                        ...tfJustifications,
                        [curQ]: e.target.value,
                      })
                    }
                    placeholder="Explica por qué elegiste esa opción..."
                    className="w-full min-h-[80px] bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30 resize-vertical"
                  />
                  <p className="text-gray-600 text-[10px] mt-1">
                    La justificación vale {q.justificationMaxPoints ?? 2} punto
                    {(q.justificationMaxPoints ?? 2) === 1 ? "" : "s"} adicional
                    {(q.justificationMaxPoints ?? 2) === 1 ? "" : "es"} evaluado
                    {(q.justificationMaxPoints ?? 2) === 1 ? "" : "s"} por IA
                  </p>
                </div>
              </div>
            )}

            {q.type === "development" && (
              <div>
                <textarea
                  value={devAnswers[curQ] || ""}
                  onChange={e =>
                    setDevAnswers({
                      ...devAnswers,
                      [curQ]: e.target.value,
                    })
                  }
                  placeholder="Escribe tu respuesta aquí. Sé detallado y preciso..."
                  className="w-full min-h-[160px] bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30 resize-vertical"
                />
                <p className="text-gray-600 text-[10px] mt-1">
                  Puntaje máximo: {q.maxPoints || 5} puntos • Evaluado por IA
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {curQ > 0 && (
                <button
                  onClick={() => setCurQ(curQ - 1)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-500 text-sm"
                >
                  ← Anterior
                </button>
              )}

              <div className="flex-1" />

              {curQ < totalQ - 1 ? (
                <button
                  onClick={() => setCurQ(curQ + 1)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600/80 text-white text-sm font-semibold"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  onClick={doSubmit}
                  className="px-6 py-2.5 rounded-xl bg-green-600/90 text-white text-sm font-bold"
                >
                  ✅ Enviar examen
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 justify-center pt-3 border-t border-white/5">
              {qs.map((item: any, i: number) => {
                const answered =
                  item.type === "development"
                    ? Boolean(devAnswers[i] && devAnswers[i].trim().length > 0)
                    : item.type === "true_false"
                      ? mcAnswers[i] !== undefined ||
                        Boolean(tfJustifications[i] && tfJustifications[i].trim().length > 0)
                      : mcAnswers[i] !== undefined

                return (
                  <button
                    key={i}
                    onClick={() => setCurQ(i)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      i === curQ
                        ? "bg-blue-500 text-white"
                        : answered
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-white/[0.04] text-gray-600 border border-white/[0.06]"
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
