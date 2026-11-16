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
  learningContext?: {profile:string;objective:string;area:string}
  topic: string
  initialLevel: number
  onFinish: (results: QuizResult[]) => void
  onExit: () => void
}

const TOTAL_QUESTIONS = 5

export default function QuizMode({ topic, initialLevel, onFinish, onExit, learningContext }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")
  const [submitted, setSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<string>("")
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  const [questionNumber, setQuestionNumber] = useState(1)
  const [currentLevel, setCurrentLevel] = useState(initialLevel)
  const [streak, setStreak] = useState(0)
  const [results, setResults] = useState<QuizResult[]>([])

  useEffect(() => {
    loadQuestion()
  }, [])

  async function loadQuestion(nextNumber = questionNumber) {
    setLoading(true)
    setCurrentQuestion(null)
    setSelectedAnswer("")
    setSubmitted(false)
    setFeedback("")
    setIsCorrect(null)

    try {
      const res = await fetch("/api/agents/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level: currentLevel, questionNumber: nextNumber, learningContext }),
      })
      if (!res.ok) throw new Error("Error generando pregunta")
      const q = await res.json()
      if(typeof q?.question!=="string"||typeof q?.correct!=="string"||!Array.isArray(q.options)||q.options.length!==4||!q.options.every((o:unknown)=>typeof o==="string")||!q.options.some((o:string)=>o.startsWith(q.correct)))throw Error("Pregunta inválida")
      setCurrentQuestion(q)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer() {
    if (!selectedAnswer || !currentQuestion || submitted || feedbackLoading) return
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
          learningContext, rewardPoints:false,
        }),
      })

      if (!res.ok) throw Error("No se pudo generar retroalimentación")
      const data = await res.json()
      setFeedback(data.feedback || currentQuestion.explanation)

      // Actualizar nivel y racha
      setCurrentLevel(Number.isFinite(data.newLevel) ? Math.max(1,Math.min(6,data.newLevel)) : currentLevel)
      setStreak(correct ? streak + 1 : 0)

      // Guardar resultado
      setResults(prev => [...prev, {
        question: currentQuestion.question,
        userAnswer: selectedAnswer,
        correct: currentQuestion.options.find(o => o.startsWith(currentQuestion.correct)) || "",
        isCorrect: correct,
        feedback: data.feedback || currentQuestion.explanation,
      }])

    } catch (e) {
      setFeedback(currentQuestion.explanation)
      setResults(prev=>[...prev,{question:currentQuestion.question,userAnswer:selectedAnswer,correct:currentQuestion.options.find(o=>o.startsWith(currentQuestion.correct))||"",isCorrect:correct,feedback:currentQuestion.explanation}])
    } finally {
      setFeedbackLoading(false)
    }
  }

  function nextQuestion() {
    if (questionNumber >= TOTAL_QUESTIONS) {
      onFinish(results)
      return
    }
    const next = questionNumber + 1
    setQuestionNumber(next)
    void loadQuestion(next)
  }

  const progressPercent = (results.length / TOTAL_QUESTIONS) * 100

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sub text-sm">Preparando pregunta {questionNumber}...</p>
      </div>
    )
  }

  if (!currentQuestion) return <div className="mx-auto max-w-lg p-8 text-center"><p role="alert">No se pudo preparar la pregunta.</p><button type="button" onClick={()=>void loadQuestion()} className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-white">Reintentar</button><button type="button" onClick={onExit} className="ml-3 underline">Volver al estudio</button></div>

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">

      {/* Header del quiz */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
            <span className="text-purple-400 text-xs font-medium">AEv — Evaluación</span>
          </div>
        </div>
        <button
          onClick={onExit}
          className="text-muted2 hover:text-sub text-xs transition-colors"
        >
          Salir del quiz
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted2 mb-2">
          <span>Pregunta {questionNumber} de {TOTAL_QUESTIONS}</span>
        </div>
        <div className="w-full bg-card-soft-theme rounded-full h-2">
          <div
            className="h-2 bg-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Pregunta */}
      <div className="bg-card-theme border border-soft rounded-2xl p-6 mb-4">
        <div className="prose max-w-none prose-p:text-main prose-p:text-base">
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

          let optionStyle = "bg-card-theme border-soft hover:border-medium text-sub"
          if (submitted) {
            if (isCorrectOption) optionStyle = "bg-green-500/10 border-green-500 text-green-700"
            else if (isSelected && !isCorrectOption) optionStyle = "bg-red-500/10 border-red-500 text-red-700"
            else optionStyle = "bg-card-theme border-soft text-muted2"
          } else if (isSelected) {
            optionStyle = "bg-blue-500/10 border-blue-500 text-main"
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
          </div>
          {feedbackLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-soft border-t-transparent rounded-full animate-spin" />
              <span className="text-sub text-xs">Generando feedback...</span>
            </div>
          ) : (
            <p className="text-sub text-sm">{feedback}</p>
          )}
        </div>
      )}

      {/* Botones de acción */}
      {!submitted ? (
        <button
          onClick={submitAnswer}
          disabled={!selectedAnswer}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-card-soft-theme disabled:text-muted2 text-main font-semibold py-3 rounded-xl transition-colors"
        >
          Responder
        </button>
      ) : (
        <button
          onClick={nextQuestion}
          disabled={feedbackLoading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-card-soft-theme text-main font-semibold py-3 rounded-xl transition-colors"
        >
          {questionNumber >= TOTAL_QUESTIONS ? "Ver resultados →" : "Siguiente pregunta →"}
        </button>
      )}
    </div>
  )
}
