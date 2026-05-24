"use client"

import { useState } from "react"
import { getPdfDesignStyle, pdfDesignFooterLabel } from "@/lib/design-templates/pdf-style"

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
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const maxWidth = pageWidth - margin * 2
    const design = getPdfDesignStyle("eduai-canva-classroom", "report")
    const setFill = (color: [number, number, number]) => doc.setFillColor(color[0], color[1], color[2])
    const setText = (color: [number, number, number]) => doc.setTextColor(color[0], color[1], color[2])
    let y = margin

    // Header con EduAI Design Engine
    setFill(design.background)
    doc.rect(0, 0, pageWidth, pageHeight, "F")
    setFill(design.primary)
    doc.rect(0, 0, pageWidth, 42, "F")
    if (design.template.export.useDecorations) {
      setFill(design.softAccent)
      doc.circle(pageWidth - 26, 11, 17, "F")
      setFill(design.softSecondary)
      doc.circle(pageWidth - 50, 36, 8, "F")
    }

    setText(design.headerText)
    doc.setFontSize(22)
    doc.setFont("helvetica", "bold")
    doc.text("EduAI Platform", margin, 17)

    doc.setFontSize(9.5)
    doc.setFont("helvetica", "normal")
    doc.text(`${pdfDesignFooterLabel(design)} · Tutor personal con IA`, margin, 26)

    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text(`Resumen: ${topic}`, margin, 36)

    y = 52

    // Fecha
    setText(design.muted)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(`Generado el ${new Date().toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, margin, y)
    y += 10

    // Score si hay quiz
    if (quizResults.length > 0) {
      const correct = quizResults.filter(r => r.isCorrect).length
      const score = Math.round((correct / quizResults.length) * 100)
      setFill(score >= 80 ? design.success : score >= 60 ? design.warning : design.danger)
      doc.roundedRect(margin, y, 60, 10, 2, 2, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.text(`Puntaje del quiz: ${score}% (${correct}/${quizResults.length})`, margin + 3, y + 6.5)
      y += 16
    }

    // Línea divisora
    doc.setDrawColor(design.line[0], design.line[1], design.line[2])
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

    setText(design.text)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")

    for (const line of lines) {
      if (y > 270) {
        doc.addPage()
        setFill(design.background)
        doc.rect(0, 0, pageWidth, pageHeight, "F")
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
        setText(design.primary)
        doc.text(trimmed, margin, y)
        y += 6
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10)
        setText(design.text)
      } else {
        const wrapped = doc.splitTextToSize(trimmed.startsWith("-") ? `  ${trimmed}` : trimmed, maxWidth)
        for (const wline of wrapped) {
          if (y > 270) {
            doc.addPage()
            setFill(design.background)
            doc.rect(0, 0, pageWidth, pageHeight, "F")
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
      setFill(design.surface)
      doc.rect(0, 285, pageWidth, 12, "F")
      setText(design.muted)
      doc.setFontSize(8)
      doc.text(pdfDesignFooterLabel(design), margin, 292)
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
          className="flex items-center gap-2 bg-card-soft-theme hover:bg-card-soft-theme border border-soft hover:border-blue-500 text-sub hover:text-main text-sm px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
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
        <div className="bg-card-theme border border-soft rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <span className="text-green-400 text-xs font-medium">ARe — Resumen listo</span>
            </div>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-500 text-main px-4 py-2 rounded-lg transition-colors font-medium"
            >
              ⬇ Descargar PDF
            </button>
          </div>

          <div className="bg-app rounded-xl p-4 text-sm text-sub whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {summary.replace(/[#*`]/g, "").trim()}
          </div>
        </div>
      )}
    </div>
  )
}
