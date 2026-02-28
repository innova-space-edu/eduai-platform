"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import MathRenderer from "@/components/ui/MathRenderer"

type ExamState = "config" | "loading" | "active" | "evaluating" | "results"

interface Question {
  id: number
  type: "multiple" | "truefalse" | "short" | "problem"
  question: string
  options?: string[]
  correctAnswer: string
  explanation: string
  points: number
  difficulty: string
}

interface Exam {
  title: string
  topic: string
  level: string
  totalPoints: number
  timeMinutes: number
  questions: Question[]
}

interface EvalResult {
  totalScore: number
  maxScore: number
  percentage: number
  grade: string
  feedback: string
  weakAreas: string[]
  strongAreas: string[]
  results: Array<{ questionId: number; correct: boolean | "partial"; pointsEarned: number; pointsMax: number; feedback: string }>
  studyRecommendations: string[]
}

const LEVELS = ["básico", "intermedio", "avanzado", "universitario"]
const TOPICS_SUGGEST = ["Matemáticas", "Física", "Historia de Chile", "Biología", "Química", "Inglés", "Filosofía", "Economía"]

export default function ExamenPage() {
  const [state, setState]       = useState<ExamState>("config")
  const [topic, setTopic]       = useState("")
  const [level, setLevel]       = useState("intermedio")
  const [numQ, setNumQ]         = useState(10)
  const [exam, setExam]         = useState<Exam | null>(null)
  const [answers, setAnswers]   = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [evaluation, setEval]   = useState<EvalResult | null>(null)
  const [currentQ, setCurrentQ] = useState(0)
  const timerRef = useRef<NodeJS.Timeout>()
  const router   = useRouter()

  // Timer
  useEffect(() => {
    if (state === "active" && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { handleSubmit(); return 0 }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [state, timeLeft])

  const formatTime = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`

  async function generateExam() {
    if (!topic.trim()) return
    setState("loading")
    try {
      const res = await fetch("/api/agents/examen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", topic, level, numQuestions: numQ }),
      })
      const data = await res.json()
      setExam(data)
      setTimeLeft(data.timeMinutes * 60)
      setCurrentQ(0)
      setAnswers({})
      setState("active")
    } catch {
      setState("config")
      alert("Error generando el examen. Intenta de nuevo.")
    }
  }

  async function handleSubmit() {
    if (!exam) return
    clearInterval(timerRef.current)
    setState("evaluating")
    try {
      const res = await fetch("/api/agents/examen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate", questions: exam.questions, answers, topic }),
      })
      const data = await res.json()
      setEval(data)
      setState("results")
    } catch {
      setState("results")
    }
  }

  const answered = Object.keys(answers).length
  const scoreColor = (pct: number) =>
    pct >= 90 ? "text-green-400" : pct >= 70 ? "text-blue-400" : pct >= 50 ? "text-yellow-400" : "text-red-400"

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm">←</button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-lg">📝</div>
            <div>
              <h1 className="text-white font-semibold text-sm">Modo Examen</h1>
              <p className="text-gray-500 text-xs">
                {state === "active" ? `${exam?.title} · ${answered}/${exam?.questions.length} respondidas` : "Simulacro de examen con evaluación"}
              </p>
            </div>
          </div>
          {state === "active" && (
            <div className={`font-mono font-bold text-sm px-3 py-1.5 rounded-lg ${timeLeft < 120 ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-gray-300"}`}>
              ⏱ {formatTime(timeLeft)}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full flex-1 px-4 py-6">

        {/* CONFIG */}
        {state === "config" && (
          <div className="flex flex-col gap-5">
            <div className="bg-gradient-to-br from-red-500/10 to-rose-500/5 border border-red-500/20 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">📝</div>
              <h2 className="text-white font-semibold text-lg">Preparación de Examen</h2>
              <p className="text-gray-400 text-sm mt-1">Genera un examen personalizado, respóndelo con tiempo límite y recibe retroalimentación detallada</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
              <div>
                <label className="text-gray-500 text-xs mb-2 block">Tema del examen</label>
                <input value={topic} onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && generateExam()}
                  placeholder="Ej: Derivadas e integrales, Segunda Guerra Mundial..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-red-500/50 placeholder-gray-600" />
                <div className="flex flex-wrap gap-2 mt-2">
                  {TOPICS_SUGGEST.map(t => (
                    <button key={t} onClick={() => setTopic(t)}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-gray-300 px-3 py-1 rounded-full transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs mb-2 block">Nivel de dificultad</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LEVELS.map(l => (
                      <button key={l} onClick={() => setLevel(l)}
                        className={`py-2 rounded-xl text-xs font-medium capitalize border transition-all ${
                          level === l ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600"
                        }`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-gray-500 text-xs mb-2 block">Número de preguntas</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 10, 15].map(n => (
                      <button key={n} onClick={() => setNumQ(n)}
                        className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                          numQ === n ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600"
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={generateExam} disabled={!topic.trim()}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white py-3 rounded-xl font-semibold transition-colors">
                Generar examen →
              </button>
            </div>
          </div>
        )}

        {/* LOADING */}
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-medium">Generando examen de {numQ} preguntas...</p>
            <p className="text-gray-500 text-sm">Preparando preguntas sobre: {topic}</p>
          </div>
        )}

        {/* ACTIVE EXAM */}
        {state === "active" && exam && (
          <div className="flex flex-col gap-4">
            {/* Progress bar */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Pregunta {currentQ + 1} de {exam.questions.length}</span>
                <span>{answered} respondidas · {exam.totalPoints} pts totales</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 to-rose-500 rounded-full transition-all"
                  style={{ width: `${((currentQ) / exam.questions.length) * 100}%` }} />
              </div>
            </div>

            {/* Question */}
            {exam.questions[currentQ] && (() => {
              const q = exam.questions[currentQ]
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs bg-gray-800 text-gray-500 px-2 py-1 rounded-lg">
                      {q.type === "multiple" ? "Opción múltiple" : q.type === "truefalse" ? "V/F" : q.type === "short" ? "Respuesta corta" : "Problema"}
                    </span>
                    <span className="text-xs text-yellow-500">{q.points} {q.points === 1 ? "punto" : "puntos"}</span>
                    <span className={`text-xs ml-auto ${q.difficulty === "hard" ? "text-red-400" : q.difficulty === "medium" ? "text-yellow-400" : "text-green-400"}`}>
                      {q.difficulty === "hard" ? "Difícil" : q.difficulty === "medium" ? "Medio" : "Fácil"}
                    </span>
                  </div>

                  <div className="mb-5">
                    <MathRenderer content={`**${currentQ + 1}.** ${q.question}`} />
                  </div>

                  {/* Multiple choice */}
                  {q.type === "multiple" && q.options && (
                    <div className="flex flex-col gap-2">
                      {q.options.map((opt, i) => (
                        <button key={i} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                          className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                            answers[q.id] === opt
                              ? "bg-red-500/20 border-red-500/40 text-white"
                              : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white"
                          }`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* True/False */}
                  {q.type === "truefalse" && (
                    <div className="flex gap-3">
                      {["Verdadero", "Falso"].map(opt => (
                        <button key={opt} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                          className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                            answers[q.id] === opt
                              ? "bg-red-500/20 border-red-500/40 text-white"
                              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                          }`}>
                          {opt === "Verdadero" ? "✓ Verdadero" : "✗ Falso"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Short / Problem */}
                  {(q.type === "short" || q.type === "problem") && (
                    <textarea
                      value={answers[q.id] || ""}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Escribe tu respuesta aquí..."
                      rows={4}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 text-sm focus:outline-none focus:border-red-500/50 resize-none placeholder-gray-600"
                    />
                  )}
                </div>
              )
            })()}

            {/* Navigation */}
            <div className="flex gap-3">
              <button onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                disabled={currentQ === 0}
                className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 py-3 rounded-xl text-sm transition-colors">
                ← Anterior
              </button>
              {currentQ < exam.questions.length - 1 ? (
                <button onClick={() => setCurrentQ(prev => prev + 1)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl text-sm transition-colors">
                  Siguiente →
                </button>
              ) : (
                <button onClick={handleSubmit}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
                  Entregar examen ✓
                </button>
              )}
            </div>

            {/* Question dots */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {exam.questions.map((q, i) => (
                <button key={i} onClick={() => setCurrentQ(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                    i === currentQ ? "bg-red-600 text-white scale-110" :
                    answers[q.id] ? "bg-green-500/20 border border-green-500/40 text-green-400" :
                    "bg-gray-800 text-gray-500 hover:bg-gray-700"
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EVALUATING */}
        {state === "evaluating" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-medium">Evaluando tus respuestas...</p>
            <p className="text-gray-500 text-sm">Analizando {answered} respuestas</p>
          </div>
        )}

        {/* RESULTS */}
        {state === "results" && evaluation && exam && (
          <div className="flex flex-col gap-5">
            {/* Score card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
              <div className={`text-6xl font-black mb-2 ${scoreColor(evaluation.percentage)}`}>
                {evaluation.percentage}%
              </div>
              <div className={`text-xl font-bold mb-1 ${scoreColor(evaluation.percentage)}`}>
                {evaluation.grade}
              </div>
              <p className="text-gray-500 text-sm">
                {evaluation.totalScore} / {evaluation.maxScore} puntos
              </p>
              <div className="mt-4 h-3 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${
                  evaluation.percentage >= 70 ? "bg-gradient-to-r from-green-500 to-emerald-500" : "bg-gradient-to-r from-red-500 to-rose-500"
                }`} style={{ width: `${evaluation.percentage}%` }} />
              </div>
            </div>

            {/* Feedback */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-gray-300 text-sm leading-relaxed">{evaluation.feedback}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {evaluation.strongAreas.length > 0 && (
                  <div>
                    <p className="text-green-400 text-xs font-medium mb-2">✓ Puntos fuertes</p>
                    {evaluation.strongAreas.map(a => (
                      <p key={a} className="text-gray-400 text-xs mb-1">• {a}</p>
                    ))}
                  </div>
                )}
                {evaluation.weakAreas.length > 0 && (
                  <div>
                    <p className="text-red-400 text-xs font-medium mb-2">↑ Por mejorar</p>
                    {evaluation.weakAreas.map(a => (
                      <p key={a} className="text-gray-400 text-xs mb-1">• {a}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Per-question results */}
            <div className="flex flex-col gap-3">
              <h3 className="text-white font-semibold">Revisión pregunta por pregunta</h3>
              {exam.questions.map((q, i) => {
                const r = evaluation.results.find(r => r.questionId === q.id)
                if (!r) return null
                const isCorrect = r.correct === true
                const isPartial = r.correct === "partial"
                return (
                  <div key={i} className={`bg-gray-900 border rounded-2xl p-4 ${
                    isCorrect ? "border-green-500/30" : isPartial ? "border-yellow-500/30" : "border-red-500/30"
                  }`}>
                    <div className="flex items-start gap-3">
                      <span className={`text-lg flex-shrink-0 ${isCorrect ? "text-green-400" : isPartial ? "text-yellow-400" : "text-red-400"}`}>
                        {isCorrect ? "✓" : isPartial ? "◑" : "✗"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-300 text-sm font-medium mb-1">{q.question}</p>
                        <p className="text-gray-600 text-xs mb-1">
                          Tu respuesta: <span className="text-gray-400">{answers[q.id] || "Sin responder"}</span>
                        </p>
                        {!isCorrect && (
                          <p className="text-gray-600 text-xs mb-1">
                            Correcta: <span className="text-green-400">{q.correctAnswer}</span>
                          </p>
                        )}
                        <p className="text-gray-500 text-xs italic">{r.feedback}</p>
                        <p className="text-xs mt-1">
                          <span className={isCorrect ? "text-green-400" : isPartial ? "text-yellow-400" : "text-red-400"}>
                            {r.pointsEarned}/{r.pointsMax} pts
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Recommendations */}
            {evaluation.studyRecommendations.length > 0 && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
                <p className="text-blue-400 font-medium text-sm mb-3">📚 Recomendaciones de estudio</p>
                {evaluation.studyRecommendations.map(r => (
                  <p key={r} className="text-gray-400 text-sm mb-1.5">• {r}</p>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => { setState("config"); setExam(null); setEval(null) }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl text-sm transition-colors">
                Nuevo examen
              </button>
              <button onClick={() => { setState("config"); setLevel("avanzado") }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                Repetir más difícil
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
