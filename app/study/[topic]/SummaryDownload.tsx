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

  async function downloadPDF() {
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - margin * 2
    let y = margin

    // Header
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, pageWidth, 40, "F")

    doc.setTextColor(96, 165, 250)
    doc.setFontSize(22)
    doc.setFont("helvetica", "bold")
    doc.text("EduAI Platform", margin, 18)

    doc.setTextColor(148, 163, 184)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text("Tu tutor personal con IA", margin, 26)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text(`Resumen: ${topic}`, margin, 35)

    y = 50

    // Fecha
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(`Generado el ${new Date().toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, margin, y)
    y += 10

    // Score si hay quiz
    if (quizResults.length > 0) {
      const correct = quizResults.filter(r => r.isCorrect).length
      const score = Math.round((correct / quizResults.length) * 100)
      doc.setFillColor(score >= 80 ? 34 : score >= 60 ? 245 : 239, score >= 80 ? 197 : score >= 60 ? 158 : 68, score >= 80 ? 94 : score >= 60 ? 11 : 68)
      doc.roundedRect(margin, y, 60, 10, 2, 2, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.text(`Puntaje del quiz: ${score}% (${correct}/${quizResults.length})`, margin + 3, y + 6.5)
      y += 16
    }

    // Línea divisora
    doc.setDrawColor(51, 65, 85)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    // Contenido del resumen
    const cleanSummary = summary
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      .trim()

    const lines = cleanSummary.split("\n")

    doc.setTextColor(30, 41, 59)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")

    for (const line of lines) {
      if (y > 270) {
        doc.addPage()
        y = margin
      }

      const trimmed = line.trim()
      if (!trimmed) {
        y += 4
        continue
      }

      // Detectar si es título de sección (termina en :)
      if (trimmed.endsWith(":") || trimmed.match(/^\d\./)) {
        y += 2
        doc.setFont("helvetica", "bold")
        doc.setFontSize(11)
        doc.setTextColor(15, 23, 42)
        doc.text(trimmed, margin, y)
        y += 6
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10)
        doc.setTextColor(30, 41, 59)
      } else {
        const wrapped = doc.splitTextToSize(trimmed.startsWith("-") ? `  ${trimmed}` : trimmed, maxWidth)
        for (const wline of wrapped) {
          if (y > 270) {
            doc.addPage()
            y = margin
          }
          doc.text(wline, margin, y)
          y += 5.5
        }
      }
    }

    // Footer
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFillColor(248, 250, 252)
      doc.rect(0, 285, pageWidth, 12, "F")
      doc.setTextColor(148, 163, 184)
      doc.setFontSize(8)
      doc.text("EduAI Platform — eduai-pl.netlify.app", margin, 292)
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 20, 292)
    }

    doc.save(`resumen-${topic.replace(/\s+/g, "-").toLowerCase()}.pdf`)
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
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <span className="text-green-400 text-xs font-medium">ARe — Resumen listo</span>
            </div>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              ⬇ Descargar PDF
            </button>
          </div>

          <div className="bg-gray-950 rounded-xl p-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {summary.replace(/[#*`]/g, "").trim()}
          </div>
        </div>
      )}
    </div>
  )
}
