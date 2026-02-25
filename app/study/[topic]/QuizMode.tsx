"use client"

import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

interface Question {
  question: string
  type: string
  options: string[]
  correct: string
  explanation: string
  bloom: string
  difficulty: number
}

interface QuizResult {
  question: string
  userAnswer: string
  correct: string
  isCorrect: boolean
  feedback: string
}

interface Props {
  topic: string
  initialLevel: number
  onFinish: (results: QuizResult[], xpEarned: number) => void
  onExit: () => void
}

const TOTAL_QUESTIONS = 5

export default function QuizMode({ topic, initialLevel, onFinish, onExit }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")
  const [submitted, setSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<string>("")
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [levelChange, setLevelChange] = useState<string>("")

  const [questionNumber, setQuestionNumber] = useState(1)
  const [currentLevel, setCurrentLevel] = useState(initialLevel)
  const [streak, setStreak] = useState(0)
  const [results, setResults] = useState<QuizResult[]>([])
  const [totalXP, setTotalXP] = useState(0)

  useEffect(() => {
    loadQuestion()
  }, [])

  async function loadQuestion() {
    setLoading(true)
    setSelectedAnswer("")
    setSubmitted(false)
    setFeedback("")
    setIsCorrect(null)
    setLevelChange("")

    try {
      const res = await fetch("/api/agents/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level: currentLevel, questionNumber }),
      })
      if (!res.ok) throw new Error("Error generando pregunta")
      const q = await res.json()
      setCurrentQuestion(q)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer() {
    if (!selectedAnswer || !currentQuestion) return
    setFeedbackLoading(true)
    setSubmitted(true)

    const correct = selectedAnswer.startsWith(currentQuestion.correct)
    setIsCorrect(correct)

    try {
      const res = await fetch("/api/agents/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          question: currentQuestion.question,
          userAnswer: selectedAnswer,
          correctAnswer: currentQuestion.options.find(o => o.startsWith(currentQuestion.correct)) || "",
          explanation: currentQuestion.explanation,
          isCorrect: correct,
          currentLevel,
          streak: correct ? streak + 1 : 0,
        }),
      })

      const data = await res.json()
      setFeedback(data.feedback)
      setLevelChange(data.levelChange || "")
      setTotalXP(prev => prev + (data.xpGained || 0))

      // Actualizar nivel y racha
      setCurrentLevel(data.newLevel)
      setStreak(correct ? streak + 1 : 0)

      // Guardar resultado
      setResults(prev => [...prev, {
        question: currentQuestion.question,
        userAnswer: selectedAnswer,
        correct: currentQuestion.options.find(o => o.startsWith(currentQuestion.correct)) || "",
        isCorrect: correct,
        feedback: data.feedback,
      }])

    } catch (e) {
      setFeedback(currentQuestion.explanation)
    } finally {
      setFeedbackLoading(false)
    }
  }

  function nextQuestion() {
    if (questionNumber >= TOTAL_QUESTIONS) {
      onFinish(results, totalXP)
      return
    }
    setQuestionNumber(prev => prev + 1)
    loadQuestion()
  }

  const progressPercent = ((questionNumber - 1) / TOTAL_QUESTIONS) * 100

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Preparando pregunta {questionNumber}...</p>
      </div>
    )
  }

  if (!currentQuestion) return null

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">

      {/* Header del quiz */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
            <span className="text-purple-400 text-xs font-medium">AEv — Evaluación</span>
          </div>
          <span className="text-gray-600 text-xs">Nivel {currentLevel}/6</span>
        </div>
        <button
          onClick={onExit}
          className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
        >
          Salir del quiz
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>Pregunta {questionNumber} de {TOTAL_QUESTIONS}</span>
          <span className="text-amber-400">+{totalXP} XP</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="h-2 bg-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Pregunta */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
        <div className="prose prose-invert max-w-none prose-p:text-white prose-p:text-base">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {currentQuestion.question}
          </ReactMarkdown>
        </div>
      </div>

      {/* Opciones */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, i) => {
          const letter = option.split(")")[0]
          const isSelected = selectedAnswer === option
          const isCorrectOption = option.startsWith(currentQuestion.correct)

          let optionStyle = "bg-gray-900 border-gray-800 hover:border-gray-600 text-gray-300"
          if (submitted) {
            if (isCorrectOption) optionStyle = "bg-green-500/10 border-green-500 text-green-300"
            else if (isSelected && !isCorrectOption) optionStyle = "bg-red-500/10 border-red-500 text-red-300"
            else optionStyle = "bg-gray-900 border-gray-800 text-gray-600"
          } else if (isSelected) {
            optionStyle = "bg-blue-500/10 border-blue-500 text-white"
          }

          return (
            <button
              key={i}
              disabled={submitted}
              onClick={() => setSelectedAnswer(option)}
              className={`w-full border rounded-xl px-4 py-3 text-left transition-all text-sm ${optionStyle}`}
            >
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}
                components={{ p: ({ children }) => <span>{children}</span> }}>
                {option}
              </ReactMarkdown>
            </button>
          )
        })}
      </div>

      {/* Feedback */}
      {submitted && (
        <div className={`rounded-xl p-4 mb-4 border ${
          isCorrect
            ? "bg-green-500/10 border-green-500/30"
            : "bg-red-500/10 border-red-500/30"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{isCorrect ? "✅" : "❌"}</span>
            <span className={`font-semibold text-sm ${isCorrect ? "text-green-400" : "text-red-400"}`}>
              {isCorrect ? "¡Correcto!" : "Incorrecto"}
            </span>
            {levelChange && (
              <span className="text-xs text-amber-400 ml-auto">{levelChange}</span>
            )}
          </div>
          {feedbackLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400 text-xs">Generando feedback...</span>
            </div>
          ) : (
            <p className="text-gray-300 text-sm">{feedback}</p>
          )}
        </div>
      )}

      {/* Botones de acción */}
      {!submitted ? (
        <button
          onClick={submitAnswer}
          disabled={!selectedAnswer}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Responder
        </button>
      ) : (
        <button
          onClick={nextQuestion}
          disabled={feedbackLoading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {questionNumber >= TOTAL_QUESTIONS ? "Ver resultados →" : "Siguiente pregunta →"}
        </button>
      )}
    </div>
  )
}
