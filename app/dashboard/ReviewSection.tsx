"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface ReviewItem {
  id: string
  topic: string
  next_review: string
  last_score: number
  interval: number
  repetitions: number
}

interface QuizQuestion {
  question: string
  options: string[]
  correct: string
  explanation: string
}

type ReviewState = "list" | "quiz-loading" | "quiz" | "quiz-result"

// ── Mini Quiz Modal ────────────────────────────────────────────────────────────
function QuizModal({
  item,
  onClose,
  onComplete,
}: {
  item: ReviewItem
  onClose: () => void
  onComplete: (score: number) => void
}) {
  const [quizState, setQuizState] = useState<"loading" | "active" | "result">("loading")
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [current, setCurrent]     = useState(0)
  const [selected, setSelected]   = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [correct, setCorrect]     = useState(0)
  const [answers, setAnswers]     = useState<{ q: string; sel: string; ok: boolean; exp: string }[]>([])
  const [error, setError]         = useState("")

  useEffect(() => {
    loadQuiz()
  }, [])

  async function loadQuiz() {
    setQuizState("loading")
    try {
      const res = await fetch("/api/agents/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: item.topic,
          level: Math.min(Math.max(Math.ceil((item.last_score || 50) / 20), 1), 5),
          count: 3,
          mode: "review",
        }),
      })
      if (!res.ok) throw new Error("Error al cargar preguntas")
      const data = await res.json()

      // Soporta formato {questions:[...]} o array directo
      const qs: QuizQuestion[] = Array.isArray(data) ? data : data.questions || []
      if (!qs.length) throw new Error("Sin preguntas")

      setQuestions(qs.slice(0, 3))
      setQuizState("active")
    } catch (e: any) {
      setError(e.message)
      setQuizState("result") // Mostrar error, igual permitir marcar
    }
  }

  function confirmAnswer() {
    if (!selected) return
    const q    = questions[current]
    const isOk = selected === q.correct
    if (isOk) setCorrect(c => c + 1)
    setAnswers(prev => [...prev, { q: q.question, sel: selected, ok: isOk, exp: q.explanation }])
    setConfirmed(true)
  }

  function nextQuestion() {
    if (current + 1 >= questions.length) {
      setQuizState("result")
    } else {
      setCurrent(c => c + 1)
      setSelected(null)
      setConfirmed(false)
    }
  }

  const scorePercent = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0

  // ── Loading ──
  if (quizState === "loading") return (
    <ModalWrapper onClose={onClose}>
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sub text-sm">Preparando repaso de <span className="text-main font-medium">{item.topic}</span>...</p>
      </div>
    </ModalWrapper>
  )

  // ── Error / completar directo ──
  if (quizState === "result" && error) return (
    <ModalWrapper onClose={onClose}>
      <div className="text-center py-6 space-y-4">
        <p className="text-5xl">⚠️</p>
        <p className="text-main font-semibold">No se pudo cargar el quiz</p>
        <p className="text-muted2 text-sm">{error}</p>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-medium text-sub hover:text-main text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={() => onComplete(item.last_score || 60)} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors">
            Marcar igual
          </button>
        </div>
      </div>
    </ModalWrapper>
  )

  // ── Quiz activo ──
  if (quizState === "active" && questions[current]) {
    const q     = questions[current]
    const total = questions.length

    return (
      <ModalWrapper onClose={onClose}>
        {/* Progress */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-muted2 mb-2">
            <span>Repaso: <span className="text-amber-400 font-medium">{item.topic}</span></span>
            <span>{current + 1}/{total}</span>
          </div>
          <div className="w-full bg-card-soft-theme rounded-full h-1.5">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((current + (confirmed ? 1 : 0)) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Pregunta */}
        <p className="text-main font-medium text-sm leading-relaxed mb-4">{q.question}</p>

        {/* Opciones */}
        <div className="space-y-2 mb-4">
          {q.options.map((opt, i) => {
            let cls = "border-medium bg-card-soft-theme text-sub hover:border-amber-500/50 hover:bg-card-soft-theme"
            if (confirmed) {
              if (opt === q.correct) cls = "border-green-500 bg-green-500/10 text-green-700"
              else if (opt === selected) cls = "border-red-500 bg-red-500/10 text-red-700"
              else cls = "border-soft bg-card-theme text-muted2 opacity-50"
            } else if (opt === selected) {
              cls = "border-amber-500 bg-amber-500/10 text-amber-700"
            }

            return (
              <button
                key={i}
                onClick={() => !confirmed && setSelected(opt)}
                disabled={confirmed}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${cls}`}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {/* Explicación */}
        {confirmed && (
          <div className={`rounded-xl px-4 py-3 text-xs mb-4 ${selected === q.correct ? "bg-green-500/10 border border-green-500/20 text-green-700" : "bg-red-500/10 border border-red-500/20 text-red-700"}`}>
            <span className="font-semibold">{selected === q.correct ? "✓ Correcto" : "✗ Incorrecto"}</span>
            {q.explanation && <span> — {q.explanation}</span>}
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-2">
          {!confirmed ? (
            <button
              onClick={confirmAnswer}
              disabled={!selected}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-card-soft-theme disabled:text-muted2 text-black font-semibold text-sm transition-colors"
            >
              Confirmar
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-main font-semibold text-sm transition-colors"
            >
              {current + 1 >= total ? "Ver resultado →" : "Siguiente →"}
            </button>
          )}
        </div>
      </ModalWrapper>
    )
  }

  // ── Resultado ──
  const grade = scorePercent >= 80 ? "🏆" : scorePercent >= 60 ? "✅" : "📖"
  const gradeText = scorePercent >= 80 ? "¡Excelente repaso!" : scorePercent >= 60 ? "Buen trabajo" : "Necesitas repasar más"
  const gradeColor = scorePercent >= 80 ? "text-green-400" : scorePercent >= 60 ? "text-amber-400" : "text-red-400"

  return (
    <ModalWrapper onClose={onClose}>
      <div className="text-center mb-6">
        <p className="text-4xl mb-2">{grade}</p>
        <h3 className={`text-xl font-bold ${gradeColor}`}>{gradeText}</h3>
        <p className="text-muted2 text-sm mt-1">{correct}/{questions.length} correctas · {scorePercent}%</p>
      </div>

      {/* Resumen de respuestas */}
      <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
        {answers.map((a, i) => (
          <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${a.ok ? "bg-green-500/5 border border-green-500/20" : "bg-red-500/5 border border-red-500/20"}`}>
            <span className={`mt-0.5 flex-shrink-0 ${a.ok ? "text-green-400" : "text-red-400"}`}>{a.ok ? "✓" : "✗"}</span>
            <div>
              <p className={a.ok ? "text-green-700" : "text-red-700"}>{a.q}</p>
              {!a.ok && a.exp && <p className="text-muted2 mt-0.5">{a.exp}</p>}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => onComplete(scorePercent)}
        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors"
      >
        Guardar repaso y actualizar SM-2
      </button>
    </ModalWrapper>
  )
}

// ── Wrapper modal ──────────────────────────────────────────────────────────────
function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-card-theme border border-medium rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="text-muted2 hover:text-sub text-lg transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ReviewSection() {
  const [reviews, setReviews]       = useState<ReviewItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeItem, setActiveItem] = useState<ReviewItem | null>(null)
  const [saving, setSaving]         = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/spaced-repetition")
      .then(r => r.json())
      .then(data => setReviews(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleQuizComplete(item: ReviewItem, score: number) {
    setActiveItem(null)
    setSaving(item.id)
    try {
      // Usar POST (no PATCH) para registrar el score real con SM-2
      await fetch("/api/spaced-repetition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: item.topic, score }),
      })
      setReviews(prev => prev.filter(r => r.id !== item.id))
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(null)
    }
  }

  if (loading || reviews.length === 0) return null

  return (
    <>
      {/* Quiz Modal */}
      {activeItem && (
        <QuizModal
          item={activeItem}
          onClose={() => setActiveItem(null)}
          onComplete={(score) => handleQuizComplete(activeItem, score)}
        />
      )}

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔔</span>
          <h3 className="text-lg font-semibold text-main">Repasos pendientes</h3>
          <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
            {reviews.length}
          </span>
          <span className="text-muted2 text-xs ml-auto">SM-2 · Repaso espaciado</span>
        </div>

        <div className="grid gap-2">
          {reviews.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 bg-card-theme border border-soft hover:border-amber-500/40 rounded-xl px-4 py-3 transition-all"
            >
              {/* Info del tema */}
              <button
                onClick={() => router.push(`/study/${encodeURIComponent(item.topic)}`)}
                className="flex-1 text-left group"
              >
                <p className="text-main font-medium group-hover:text-amber-400 transition-colors capitalize">
                  {item.topic}
                </p>
                <p className="text-muted2 text-xs mt-0.5">
                  Último: {item.last_score}% · Repaso #{item.repetitions + 1} · próx. en {item.interval}d
                </p>
              </button>

              {/* Acciones */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => router.push(`/study/${encodeURIComponent(item.topic)}`)}
                  className="text-xs text-muted2 hover:text-sub border border-medium hover:border-medium rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  Estudiar
                </button>
                <button
                  onClick={() => setActiveItem(item)}
                  disabled={saving === item.id}
                  className="text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/60 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {saving === item.id ? (
                    <>
                      <div className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
                      Guardando
                    </>
                  ) : (
                    <>🎯 Repasar</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-muted2 text-xs mt-3 text-center">
          El botón "Repasar" abre un mini-quiz de 3 preguntas para activar tu memoria
        </p>
      </div>
    </>
  )
}
