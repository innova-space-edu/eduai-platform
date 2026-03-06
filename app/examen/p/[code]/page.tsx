// src/app/examen/p/[code]/page.tsx
"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"

function calcGrade(score: number, exigencia = 60): number {
  const pct = Math.max(0, Math.min(100, score))
  let nota: number
  if (pct >= exigencia) nota = 4.0 + ((pct - exigencia) * 3.0) / (100 - exigencia)
  else nota = 1.0 + (pct * 3.0) / exigencia
  return Math.round(nota * 10) / 10
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function ExamenPublicoPage() {
  const params = useParams()
  const code = params.code as string

  const [phase, setPhase] = useState<"loading" | "register" | "exam" | "submitting" | "result" | "error">("loading")
  const [exam, setExam] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState("")

  // Student data
  const [name, setName] = useState("")
  const [course, setCourse] = useState("")
  const [rut, setRut] = useState("")

  // Exam state
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // Result
  const [submission, setSubmission] = useState<any>(null)

  // Load exam
  useEffect(() => {
    if (!code) return
    fetch(`/api/agents/examen-docente?code=${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setErrorMsg(data.error); setPhase("error"); return }
        setExam(data.exam)
        setTimeLeft((data.exam.settings?.timeLimit || 30) * 60)
        setPhase("register")
      })
      .catch(() => { setErrorMsg("Error cargando examen"); setPhase("error") })
  }, [code])

  // Timer
  useEffect(() => {
    if (phase !== "exam") return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  const startExam = () => {
    if (!name.trim() || !course.trim()) return
    startTimeRef.current = Date.now()
    setPhase("exam")
  }

  const selectAnswer = (qIdx: number, optIdx: number) => {
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }))
  }

  const handleSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase("submitting")

    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000)
    const questions = exam.questions || []
    const answerArray = questions.map((_: any, i: number) => ({
      selectedAnswer: answers[i] ?? -1,
    }))

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
          answers: answerArray,
          questions,
          timeSpent,
          examPercentage: exam.settings?.examPercentage || 60,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setSubmission(data.submission)
      setPhase("result")
    } catch (err: any) {
      setErrorMsg(err.message)
      setPhase("error")
    }
  }

  const questions = exam?.questions || []
  const q = questions[currentQ]
  const answeredCount = Object.keys(answers).length
  const totalQ = questions.length
  const showResultEnabled = exam?.settings?.showResultToStudent !== false

  // ── LOADING ──
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando examen...</p>
        </div>
      </div>
    )
  }

  // ── ERROR ──
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="text-white font-bold text-lg mb-2">Examen no disponible</h2>
          <p className="text-gray-500 text-sm">{errorMsg}</p>
        </div>
      </div>
    )
  }

  // ── REGISTER ──
  if (phase === "register") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-3">📝</div>
            <h1 className="text-xl font-bold text-white">{exam?.title}</h1>
            <p className="text-gray-500 text-sm mt-1">{exam?.topic}</p>
            <div className="flex justify-center gap-4 mt-3">
              <span className="text-xs text-gray-500">{totalQ} preguntas</span>
              <span className="text-xs text-gray-500">{exam?.settings?.timeLimit || 30} minutos</span>
            </div>
          </div>

          {exam?.instructions && (
            <div className="bg-blue-500/[0.06] border border-blue-500/20 rounded-2xl p-4">
              <p className="text-blue-400 text-xs font-semibold mb-1">INSTRUCCIONES:</p>
              <p className="text-gray-400 text-sm">{exam.instructions}</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">NOMBRE COMPLETO *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ej: Juan Pérez López"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">CURSO *</label>
              <input value={course} onChange={e => setCourse(e.target.value)}
                placeholder="Ej: 8°A, 1° Medio B, 3° Medio"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-semibold block mb-1">RUT (opcional)</label>
              <input value={rut} onChange={e => setRut(e.target.value)}
                placeholder="Ej: 12.345.678-9"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-blue-500/30" />
            </div>
          </div>

          <button onClick={startExam} disabled={!name.trim() || !course.trim()}
            className="w-full py-3.5 rounded-2xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-30 transition-all">
            Comenzar examen →
          </button>
        </div>
      </div>
    )
  }

  // ── SUBMITTING ──
  if (phase === "submitting") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-green-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Enviando respuestas...</p>
        </div>
      </div>
    )
  }

  // ── RESULT ──
  if (phase === "result" && submission) {
    const nota = submission.grade
    const pct = submission.score
    const correct = submission.correct_count
    const total = submission.total_questions

    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="text-5xl">{nota >= 4.0 ? "🎉" : nota >= 3.0 ? "📚" : "💪"}</div>

          {showResultEnabled ? (
            <>
              <h2 className="text-2xl font-extrabold text-white">Tu nota: {nota}</h2>
              <div className="flex justify-center gap-6">
                <div>
                  <p className="text-gray-600 text-xs">Correctas</p>
                  <p className="text-green-400 font-bold text-lg">{correct}/{total}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-xs">Porcentaje</p>
                  <p className="text-blue-400 font-bold text-lg">{Math.round(pct)}%</p>
                </div>
                <div>
                  <p className="text-gray-600 text-xs">Nota</p>
                  <p className={`font-bold text-lg ${nota >= 4.0 ? "text-green-400" : "text-red-400"}`}>{nota}</p>
                </div>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div className={`h-full rounded-full transition-all ${nota >= 4.0 ? "bg-green-500" : "bg-red-500"}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white">Examen enviado</h2>
              <p className="text-gray-500 text-sm">Tu docente revisará tus respuestas</p>
            </>
          )}

          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]">
            <p className="text-gray-500 text-xs">Examen: {exam?.title}</p>
            <p className="text-gray-400 text-sm font-semibold">{name} — {course}</p>
          </div>

          <p className="text-gray-600 text-xs">Puedes cerrar esta ventana</p>
        </div>
      </div>
    )
  }

  // ── EXAM ──
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{name}</span>
            <span className="text-gray-700">|</span>
            <span className="text-gray-500 text-xs">{answeredCount}/{totalQ}</span>
          </div>
          <div className={`font-mono font-bold text-sm ${timeLeft < 60 ? "text-red-400 animate-pulse" : timeLeft < 300 ? "text-yellow-400" : "text-gray-400"}`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${(answeredCount / totalQ) * 100}%` }} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Question */}
        {q && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-blue-400 text-xs font-semibold">Pregunta {currentQ + 1} de {totalQ}</span>
              {q.difficulty && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  q.difficulty === 3 ? "bg-red-500/10 text-red-400" :
                  q.difficulty === 2 ? "bg-yellow-500/10 text-yellow-400" :
                  "bg-green-500/10 text-green-400"
                }`}>
                  {q.difficulty === 3 ? "Difícil" : q.difficulty === 2 ? "Media" : "Fácil"}
                </span>
              )}
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-white font-semibold text-sm leading-relaxed">{q.question}</p>
            </div>

            <div className="space-y-2">
              {(q.options || []).map((opt: string, i: number) => {
                const selected = answers[currentQ] === i
                return (
                  <button key={i} onClick={() => selectAnswer(currentQ, i)}
                    className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all ${
                      selected
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                        : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06]"
                    }`}>
                    <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                )
              })}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {currentQ > 0 && (
                <button onClick={() => setCurrentQ(currentQ - 1)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-500 text-sm">← Anterior</button>
              )}
              <div className="flex-1" />
              {currentQ < totalQ - 1 ? (
                <button onClick={() => setCurrentQ(currentQ + 1)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600/80 text-white text-sm font-semibold">
                  Siguiente →
                </button>
              ) : (
                <button onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-xl bg-green-600/90 text-white text-sm font-bold">
                  ✅ Enviar examen ({answeredCount}/{totalQ})
                </button>
              )}
            </div>

            {/* Question navigator */}
            <div className="flex flex-wrap gap-1.5 justify-center pt-3 border-t border-white/5">
              {questions.map((_: any, i: number) => (
                <button key={i} onClick={() => setCurrentQ(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    i === currentQ ? "bg-blue-500 text-white" :
                    answers[i] !== undefined ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                    "bg-white/[0.04] text-gray-600 border border-white/[0.06]"
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
