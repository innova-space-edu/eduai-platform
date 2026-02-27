"use client"

import { useState } from "react"

interface Message {
  role: "ai" | "user"
  content: string
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
  messages: Message[]
  quizResults: QuizResult[]
}

export default function SummaryDownload({ topic, messages, quizResults }: Props) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState("")
  const [generated, setGenerated] = useState(false)

  async function generateSummary() {
    setLoading(true)
    try {
      const res = await fetch("/api/agents/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, messages, quizResults }),
      })
      const data = await res.json()
      setSummary(data.summary)
      setGenerated(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function downloadPDF() {
    const content = `RESUMEN DE ESTUDIO — ${topic.toUpperCase()}
${"=".repeat(50)}
Generado por EduAI Platform
Fecha: ${new Date().toLocaleDateString("es-CL")}
${"=".repeat(50)}

${summary.replace(/[#*`]/g, "").replace(/\n{3,}/g, "\n\n")}

${"=".repeat(50)}
EduAI Platform — Tu tutor personal con IA
https://eduai-pl.netlify.app`

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `resumen-${topic.replace(/\s+/g, "-").toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function downloadMarkdown() {
    const content = `# Resumen: ${topic}

> Generado por EduAI Platform — ${new Date().toLocaleDateString("es-CL")}

${summary}

---
*EduAI Platform — Tu tutor personal con IA*`

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `resumen-${topic.replace(/\s+/g, "-").toLowerCase()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (messages.length < 2) return null

  return (
    <div className="mt-4">
      {!generated ? (
        <button
          onClick={generateSummary}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 text-gray-300 hover:text-white text-sm px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Generando resumen...
            </>
          ) : (
            <>📄 Generar resumen de la sesión</>
          )}
        </button>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <span className="text-green-400 text-xs font-medium">ARe — Resumen listo</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadMarkdown}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                ⬇ .md
              </button>
              <button
                onClick={downloadPDF}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                ⬇ .txt
              </button>
            </div>
          </div>

          <div className="bg-gray-950 rounded-xl p-4 text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
            {summary.replace(/[#*`]/g, "").trim()}
          </div>
        </div>
      )}
    </div>
  )
}
