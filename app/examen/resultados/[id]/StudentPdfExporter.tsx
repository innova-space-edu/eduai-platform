"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"

const PALETTE = {
  navy: [15, 23, 42],
  blue: [37, 99, 235],
  indigo: [99, 102, 241],
  cyan: [6, 182, 212],
  green: [16, 185, 129],
  amber: [245, 158, 11],
  red: [239, 68, 68],
  slate: [100, 116, 139],
  light: [248, 250, 252],
  white: [255, 255, 255],
  border: [226, 232, 240],
  text: [30, 41, 59],
  muted: [100, 116, 139],
}

function clean(text: string | undefined | null) {
  if (!text) return ""
  return String(text)
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function levelFromScore(score: number) {
  if (score >= 85) return { label: "Logro destacado", color: PALETTE.green }
  if (score >= 70) return { label: "Buen nivel", color: PALETTE.blue }
  if (score >= 50) return { label: "En desarrollo", color: PALETTE.amber }
  return { label: "Requiere apoyo", color: PALETTE.red }
}

function recommendationFromScore(score: number) {
  if (score >= 85) {
    return {
      title: "Felicitaciones por tu excelente desempeño",
      body: "El estudiante demuestra un dominio sólido de los aprendizajes evaluados. Se recomienda continuar con actividades de profundización, nuevos desafíos y aplicación de los contenidos en contextos más complejos.",
    }
  }
  if (score >= 70) {
    return {
      title: "Muy buen trabajo",
      body: "El estudiante evidencia una comprensión adecuada de los contenidos evaluados. Se sugiere reforzar algunos detalles específicos para consolidar completamente el aprendizaje y alcanzar un dominio más alto.",
    }
  }
  if (score >= 50) {
    return {
      title: "Aprendizaje en desarrollo",
      body: "El estudiante presenta avances importantes, pero aún requiere reforzar contenidos clave y mejorar la precisión en sus respuestas. Se recomienda repaso guiado, práctica adicional y retroalimentación constante.",
    }
  }
  return {
    title: "Se recomienda reforzamiento focalizado",
    body: "El estudiante necesita apoyo adicional para consolidar los aprendizajes evaluados. Se sugiere trabajar paso a paso los contenidos esenciales, acompañar con ejemplos resueltos y realizar actividades de refuerzo progresivo.",
  }
}

function stripHtml(text: string) {
  return clean(text.replace(/<[^>]*>/g, " "))
}

export default function StudentPdfExporter({
  exam,
  submission,
}: {
  exam: any
  submission: any
}) {
  const [loading, setLoading] = useState(false)

  async function exportPDF() {
    setLoading(true)
    try {
      const { jsPDF } = await import("jspdf")

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

      const pageW = 210
      const pageH = 297
      const margin = 14
      const contentW = pageW - margin * 2
      let y = 0

      const questions = exam?.questions || []
      const answers = submission?.answers || []
      const score = Number(submission?.score || 0)
      const grade = Number(submission?.grade || 1)
      const totalQuestions = Number(submission?.total_questions || questions.length || 0)
      const correctCount = Number(submission?.correct_count || 0)
      const earnedPoints = Number(submission?.earned_points || 0)
      const totalPoints = Number(submission?.total_points || 0)
      const level = levelFromScore(score)
      const recommendation = recommendationFromScore(score)

      const setFont = (bold = false, size = 10, color = PALETTE.text) => {
        doc.setFont("helvetica", bold ? "bold" : "normal")
        doc.setFontSize(size)
        doc.setTextColor(color[0], color[1], color[2])
      }

      const fill = (x: number, yy: number, w: number, h: number, color: number[], r = 0) => {
        doc.setFillColor(color[0], color[1], color[2])
        if (r > 0 && (doc as any).roundedRect) {
          ;(doc as any).roundedRect(x, yy, w, h, r, r, "F")
        } else {
          doc.rect(x, yy, w, h, "F")
        }
      }

      const strokeBox = (x: number, yy: number, w: number, h: number, color = PALETTE.border, fillColor?: number[], r = 3) => {
        doc.setDrawColor(color[0], color[1], color[2])
        if (fillColor) doc.setFillColor(fillColor[0], fillColor[1], fillColor[2])
        if ((doc as any).roundedRect) {
          ;(doc as any).roundedRect(x, yy, w, h, r, r, fillColor ? "FD" : "S")
        } else {
          doc.rect(x, yy, w, h, fillColor ? "FD" : "S")
        }
      }

      const split = (text: string, w: number) => doc.splitTextToSize(clean(text), w)

      const ensureSpace = (need = 20) => {
        if (y + need > pageH - 18) {
          doc.addPage()
          y = 18
        }
      }

      const justifiedParagraph = (text: string, x: number, yy: number, w: number, lineHeight = 5.2) => {
        const lines = split(text, w)
        let cy = yy

        lines.forEach((line: string, idx: number) => {
          ensureSpace(lineHeight + 2)
          const isLast = idx === lines.length - 1
          const words = line.trim().split(/\s+/)

          if (isLast || words.length <= 1) {
            doc.text(line, x, cy)
          } else {
            const lineText = words.join(" ")
            const lineWidth = doc.getTextWidth(lineText)
            const gaps = words.length - 1
            const extra = Math.max(0, w - lineWidth)
            const add = extra / gaps
            let cursor = x

            words.forEach((word, wi) => {
              doc.text(word, cursor, cy)
              if (wi < gaps) cursor += doc.getTextWidth(word + " ") + add
            })
          }
          cy += lineHeight
        })

        return cy
      }

      const sectionTitle = (title: string) => {
        ensureSpace(12)
        fill(margin, y - 1.5, 4, 8, PALETTE.blue, 1.5)
        setFont(true, 12, PALETTE.navy)
        doc.text(clean(title), margin + 8, y + 4)
        y += 12
      }

      const infoRow = (label: string, value: string, x: number, yy: number, w: number) => {
        setFont(true, 8, PALETTE.slate)
        doc.text(clean(label).toUpperCase(), x, yy)
        setFont(false, 9.5, PALETTE.text)
        const lines = split(value || "—", w)
        let cy = yy + 5
        lines.forEach((line: string) => {
          doc.text(line, x, cy)
          cy += 4.5
        })
        return cy
      }

      const drawProgress = (label: string, value: number, max = 100, color = PALETTE.blue) => {
        ensureSpace(14)
        setFont(true, 8.5, PALETTE.slate)
        doc.text(label, margin, y)
        setFont(true, 8.5, PALETTE.text)
        doc.text(`${Math.round(value)}%`, margin + contentW - 2, y, { align: "right" })

        const barY = y + 3
        strokeBox(margin, barY, contentW, 5.2, PALETTE.border, PALETTE.light, 2)
        fill(margin, barY, Math.max(4, (contentW * Math.min(value, max)) / max), 5.2, color, 2)
        y += 13
      }

      const drawTableHeader = (headers: string[], widths: number[]) => {
        ensureSpace(10)
        let x = margin
        fill(margin, y, widths.reduce((a, b) => a + b, 0), 8, PALETTE.navy, 2)
        setFont(true, 8, PALETTE.white)
        headers.forEach((h, i) => {
          doc.text(clean(h), x + 2, y + 5.3)
          x += widths[i]
        })
        y += 8
      }

      const drawTableRow = (cols: string[], widths: number[], alt = false) => {
        const prepared = cols.map((c, i) => split(c || "—", widths[i] - 4))
        const maxLines = Math.max(...prepared.map((p: string[]) => p.length), 1)
        const rowH = Math.max(8, maxLines * 4.5 + 3)

        ensureSpace(rowH + 2)

        if (alt) {
          fill(margin, y, widths.reduce((a, b) => a + b, 0), rowH, [250, 252, 255], 1.5)
        }
        doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2])
        doc.rect(margin, y, widths.reduce((a, b) => a + b, 0), rowH)

        let x = margin
        setFont(false, 8, PALETTE.text)
        prepared.forEach((cell: string[], i) => {
          doc.line(x, y, x, y + rowH)
          let cy = y + 4.5
          cell.forEach((line: string) => {
            doc.text(line, x + 2, cy)
            cy += 4.1
          })
          x += widths[i]
        })
        doc.line(x, y, x, y + rowH)
        y += rowH
      }

      // Portada
      fill(0, 0, pageW, 48, PALETTE.navy)
      fill(0, 0, 6, 48, PALETTE.cyan)

      setFont(true, 20, PALETTE.white)
      const titleLines = split(exam?.title || "Informe individual de evaluación", contentW - 10)
      let titleY = 18
      titleLines.forEach((line: string) => {
        doc.text(line, margin + 6, titleY)
        titleY += 8
      })

      setFont(false, 10, [209, 213, 219])
      doc.text(`Informe individual del estudiante · Código ${clean(exam?.code || "—")}`, margin + 6, 37)

      y = 58

      // Bloque alumno
      strokeBox(margin, y, contentW, 26, PALETTE.border, PALETTE.white, 4)
      const leftX = margin + 4
      const rightX = margin + 104

      infoRow("Alumno", submission?.student_name || "Sin nombre", leftX, y + 6, 88)
      infoRow("Curso", submission?.student_course || "—", leftX, y + 16, 88)
      infoRow("RUT", submission?.student_rut || "—", rightX, y + 6, 50)
      infoRow(
        "Fecha",
        submission?.submitted_at
          ? new Date(submission.submitted_at).toLocaleString("es-CL", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        rightX,
        y + 16,
        78
      )

      y += 34

      // Tarjetas KPI
      const cards = [
        { label: "Nota final", value: grade.toFixed(1), color: PALETTE.blue },
        { label: "Porcentaje de logro", value: `${Math.round(score)}%`, color: level.color },
        { label: "Correctas", value: `${correctCount}/${totalQuestions}`, color: PALETTE.indigo },
        { label: "Puntaje", value: `${earnedPoints}/${totalPoints}`, color: PALETTE.cyan },
      ]
      const cardW = (contentW - 9) / 4

      cards.forEach((card, i) => {
        const x = margin + i * (cardW + 3)
        strokeBox(x, y, cardW, 23, PALETTE.border, PALETTE.white, 4)
        fill(x, y, 4, 23, card.color, 2)
        setFont(true, 14, card.color)
        doc.text(card.value, x + 8, y + 12)
        setFont(true, 7.5, PALETTE.slate)
        doc.text(card.label.toUpperCase(), x + 8, y + 6)
      })

      y += 31

      // Estado + barra
      strokeBox(margin, y, contentW, 20, PALETTE.border, [245, 247, 250], 4)
      setFont(true, 9, PALETTE.slate)
      doc.text("NIVEL DE LOGRO", margin + 4, y + 6)
      setFont(true, 13, level.color)
      doc.text(level.label, margin + 4, y + 13)

      doc.setFillColor(229, 231, 235)
      ;(doc as any).roundedRect(margin + 98, y + 8, 84, 5.2, 2, 2, "F")
      fill(margin + 98, y + 8, Math.max(5, (84 * Math.min(score, 100)) / 100), 5.2, level.color, 2)
      setFont(true, 8.5, PALETTE.text)
      doc.text(`${Math.round(score)}%`, margin + 186, y + 12.2, { align: "right" })

      y += 28

      sectionTitle("Resumen del desempeño")
      setFont(false, 10, PALETTE.text)
      y = justifiedParagraph(
        `Este informe presenta el resultado individual del estudiante en el examen "${clean(exam?.title)}". Incluye su nivel de logro, el detalle completo de sus respuestas, la corrección asociada, la retroalimentación entregada y el puntaje obtenido en cada pregunta, con el objetivo de mantener una revisión clara, ordenada y pedagógicamente útil.`,
        margin,
        y,
        contentW
      )
      y += 4

      drawProgress("Porcentaje de logro general", score, 100, level.color)

      if ((submission?.incident_count || 0) > 0) {
        ensureSpace(16)
        strokeBox(margin, y, contentW, 14, PALETTE.red, [254, 242, 242], 3)
        setFont(true, 9, PALETTE.red)
        doc.text(`Incidentes de seguridad registrados: ${submission.incident_count}`, margin + 4, y + 8.5)
        y += 20
      }

      sectionTitle("Detalle por pregunta")

      questions.forEach((q: any, qi: number) => {
        const a = answers[qi] || {}
        ensureSpace(24)

        strokeBox(margin, y, contentW, 10, PALETTE.border, [248, 250, 252], 3)
        setFont(true, 10, PALETTE.navy)
        doc.text(`Pregunta ${qi + 1}`, margin + 4, y + 6.5)
        setFont(false, 8.5, PALETTE.slate)
        doc.text(`${q?.type || "—"} · ${a?.maxPoints || q?.maxPoints || 0} pts`, margin + contentW - 4, y + 6.5, { align: "right" })
        y += 14

        setFont(true, 8.5, PALETTE.slate)
        doc.text("Enunciado", margin, y)
        setFont(false, 9.5, PALETTE.text)
        y = justifiedParagraph(stripHtml(q?.question || "Sin enunciado"), margin, y + 5, contentW)
        y += 3

        if (a?.type === "multiple_choice") {
          const selected = typeof a.selectedAnswer === "number" ? ["A", "B", "C", "D"][a.selectedAnswer] : "—"
          const correct = typeof q.correctAnswer === "number" ? ["A", "B", "C", "D"][q.correctAnswer] : "—"

          drawTableHeader(["Campo", "Detalle"], [42, contentW - 42])
          drawTableRow(["Respuesta del alumno", selected], [42, contentW - 42], false)
          drawTableRow(["Alternativa correcta", correct], [42, contentW - 42], true)
          drawTableRow(["Resultado", a.isCorrect ? "Correcta" : "Incorrecta"], [42, contentW - 42], false)

          if (q?.explanation) {
            y += 3
            setFont(true, 8.5, PALETTE.slate)
            doc.text("Explicación", margin, y)
            setFont(false, 9.2, PALETTE.text)
            y = justifiedParagraph(stripHtml(q.explanation), margin, y + 5, contentW)
            y += 3
          }
        }

        if (a?.type === "true_false") {
          drawTableHeader(["Campo", "Detalle"], [42, contentW - 42])
          drawTableRow(
            ["Selección del alumno", (q.options || ["Verdadero", "Falso"])[a.selectedAnswer] || "—"],
            [42, contentW - 42],
            false
          )
          drawTableRow(
            ["Respuesta correcta", (q.options || ["Verdadero", "Falso"])[q.correctAnswer] || "—"],
            [42, contentW - 42],
            true
          )
          drawTableRow(
            ["Justificación", a.justification || "Sin justificación"],
            [42, contentW - 42],
            false
          )
          drawTableRow(
            ["Puntaje justificación", `${a.justificationScore ?? 0}/${a.justificationMaxPoints ?? 0}`],
            [42, contentW - 42],
            true
          )

          if (a.justificationFeedback) {
            y += 3
            setFont(true, 8.5, PALETTE.slate)
            doc.text("Retroalimentación", margin, y)
            setFont(false, 9.2, PALETTE.text)
            y = justifiedParagraph(a.justificationFeedback, margin, y + 5, contentW)
            y += 3
          }

          if (q?.explanation) {
            setFont(true, 8.5, PALETTE.slate)
            doc.text("Explicación de referencia", margin, y)
            setFont(false, 9.2, PALETTE.text)
            y = justifiedParagraph(stripHtml(q.explanation), margin, y + 5, contentW)
            y += 3
          }
        }

        if (a?.type === "development") {
          drawTableHeader(["Campo", "Detalle"], [42, contentW - 42])
          drawTableRow(["Respuesta del alumno", a.devText || "Sin respuesta"], [42, contentW - 42], false)
          drawTableRow(["Puntaje", `${a.manualScore ?? a.aiScore ?? 0}/${a.maxPoints || q.maxPoints || 0}`], [42, contentW - 42], true)

          if (q?.modelAnswer) {
            y += 3
            setFont(true, 8.5, PALETTE.slate)
            doc.text("Respuesta modelo", margin, y)
            setFont(false, 9.2, PALETTE.text)
            y = justifiedParagraph(q.modelAnswer, margin, y + 5, contentW)
            y += 3
          }

          if (q?.rubric?.length) {
            drawTableHeader(["Criterio", "Puntaje"], [contentW - 30, 30])
            q.rubric.forEach((r: any, idx: number) => {
              drawTableRow(
                [r.criteria || r.criterion || r.criterio || "Criterio", `${r.points || r.puntos || r.puntaje || 0} pts`],
                [contentW - 30, 30],
                idx % 2 === 1
              )
            })
          }

          const feedback = a.manualFeedback || a.aiFeedback
          if (feedback) {
            y += 3
            setFont(true, 8.5, PALETTE.slate)
            doc.text("Retroalimentación", margin, y)
            setFont(false, 9.2, PALETTE.text)
            y = justifiedParagraph(feedback, margin, y + 5, contentW)
            y += 3
          }
        }

        y += 4
      })

      sectionTitle("Cierre pedagógico")
      strokeBox(margin, y, contentW, 30, PALETTE.border, [248, 250, 252], 4)
      setFont(true, 11, level.color)
      doc.text(recommendation.title, margin + 4, y + 8)
      setFont(false, 9.5, PALETTE.text)
      y = justifiedParagraph(recommendation.body, margin + 4, y + 14, contentW - 8)
      y += 10

      setFont(false, 8, PALETTE.muted)
      doc.text(
        `Generado por EduAI Platform · ${new Date().toLocaleString("es-CL")}`,
        pageW - margin,
        pageH - 8,
        { align: "right" }
      )

      const safeStudent = clean(submission?.student_name || "alumno").replace(/[^\w\-]+/g, "_")
      const safeExam = clean(exam?.title || "examen").replace(/[^\w\-]+/g, "_")
      doc.save(`${safeExam}_${safeStudent}.pdf`)
    } catch (error) {
      console.error("Error generando PDF individual:", error)
      alert("No se pudo generar el PDF del alumno.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={exportPDF}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
      style={{
        background: "rgba(99,102,241,0.10)",
        borderColor: "rgba(99,102,241,0.25)",
        color: "#c7d2fe",
      }}
    >
      <FileDown size={12} />
      {loading ? "Generando..." : "PDF"}
    </button>
  )
}
