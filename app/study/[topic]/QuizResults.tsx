"use client"

import { useEffect, useState } from "react"
import DiagnosisReport from "./DiagnosisReport"

interface QuizResult {
  question: string
  userAnswer: string
  correct: string
  isCorrect: boolean
  feedback: string
}

interface Diagnosis {
  hasGaps: boolean
  message?: string
  gaps: any[]
  recommendations: string[]
  summary?: string
}

interface Props {
  topic: string
  results: QuizResult[]
  xpEarned: number
  onStudyMore: () => void
  onRetry: () => void
}

export default function QuizResults({ topic, results, xpEarned, onStudyMore, onRetry }: Props) {
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false)

  const correct = results.filter(r => r.isCorrect).length
  const total = results.length
  const percent = Math.round((correct / total) * 100)

  useEffect(() => {
    runDiagnosis()
  }, [])

  async function runDiagnosis() {
    setLoadingDiagnosis(true)
    try {
      const res = await fetch("/api/agents/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, quizResults: results }),
      })
      if (!res.ok) return
      const data = await res.json()
      setDiagnosis(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDiagnosis(false)
    }
  }

  const getMessage = () => {
    if (percent === 100) return { text: "¡Perfecto! Dominas este tema 🏆", color: "text-amber-400" }
    if (percent >= 80)  return { text: "¡Muy bien! Casi lo tienes 🎯",     color: "text-green-400" }
    if (percent >= 60)  return { text: "Buen intento, sigue practicando 💪", color: "text-blue-400" }
    return { text: "Necesitas repasar este tema 📚", color: "text-red-400" }
  }

  const msg = getMessage()

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">

      {/* Resultado principal */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center mb-6">
        <div className="text-6xl mb-4">
          {percent === 100 ? "🏆" : percent >= 80 ? "🎯" : percent >= 60 ? "💪" : "📚"}
        </div>
        <h2 className={`text-2xl font-bold mb-1 ${msg.color}`}>{msg.text}</h2>
        <p className="text-gray-500 text-sm mb-6">{topic}</p>

        <div className="flex items-center justify-center gap-8">
          <div>
            <p className="text-4xl font-bold text-white">{correct}/{total}</p>
            <p className="text-gray-500 text-xs mt-1">correctas</p>
          </div>
          <div className="w-px h-12 bg-gray-800" />
          <div>
            <p className="text-4xl font-bold text-amber-400">+{xpEarned}</p>
            <p className="text-gray-500 text-xs mt-1">XP ganado</p>
          </div>
          <div className="w-px h-12 bg-gray-800" />
          <div>
            <p className="text-4xl font-bold text-blue-400">{percent}%</p>
            <p className="text-gray-500 text-xs mt-1">puntuación</p>
          </div>
        </div>
      </div>

      {/* Detalle de respuestas */}
      <div className="space-y-3 mb-4">
        <h3 className="text-sm font-medium text-gray-400">Detalle de respuestas</h3>
        {results.map((r, i) => (
          <div key={i} className={`border rounded-xl p-4 ${
            r.isCorrect ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">{r.isCorrect ? "✅" : "❌"}</span>
              <div className="flex-1">
                <p className="text-gray-300 text-sm mb-1">{r.question}</p>
                {!r.isCorrect && (
                  <p className="text-gray-500 text-xs mb-1">
                    Correcta: <span className="text-green-400">{r.correct}</span>
                  </p>
                )}
                <p className="text-gray-500 text-xs">{r.feedback}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Diagnóstico de lagunas */}
      <DiagnosisReport diagnosis={diagnosis} loading={loadingDiagnosis} />

      {/* Acciones */}
      <div className="flex gap-3 mt-6">
        <button onClick={onStudyMore}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">
          Seguir estudiando
        </button>
        <button onClick={onRetry}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors">
          Reintentar quiz
        </button>
      </div>
    </div>
  )
}
