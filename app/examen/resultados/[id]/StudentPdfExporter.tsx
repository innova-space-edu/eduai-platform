"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"

type ExamQuestion = {
  type?: string
  question?: string
  options?: string[]
  correctAnswer?: number
  explanation?: string
  modelAnswer?: string
  rubric?: Array<{
    criteria?: string
    criterion?: string
    criterio?: string
    points?: number
    puntos?: number
    puntaje?: number
  }>
  maxPoints?: number
}

type SubmissionAnswer = {
  type?: string
  selectedAnswer?: number
  isCorrect?: boolean
  selectionCorrect?: boolean
  justification?: string
  justificationScore?: number
  justificationMaxPoints?: number
  justificationFeedback?: string
  devText?: string
  aiScore?: number
  manualScore?: number
  aiFeedback?: string
  manualFeedback?: string
  maxPoints?: number
}

type Submission = {
  student_name?: string
  student_course?: string
  student_rut?: string
  submitted_at?: string
  score?: number
  grade?: number
  total_questions?: number
  correct_count?: number
  earned_points?: number
  total_points?: number
  incident_count?: number
  manually_reviewed?: boolean
  answers?: SubmissionAnswer[]
}

type Exam = {
  title?: string
  code?: string
  questions?: ExamQuestion[]
  teacher_name?: string
  subject?: string
  logoUrl?: string
}

const PALETTE = {
  navy: [15, 23, 42] as const,
  blue: [37, 99, 235] as const,
  indigo: [99, 102, 241] as const,
  cyan: [6, 182, 212] as const,
  violet: [139, 92, 246] as const,
  green: [16, 185, 129] as const,
  amber: [245, 158, 11] as const,
  red: [239, 68, 68] as const,
  slate: [100, 116, 139] as const,
  light: [248, 250, 252] as const,
  softBlue: [239, 246, 255] as const,
  softGreen: [236, 253, 245] as const,
  softAmber: [255, 251, 235] as const,
  softRed: [254, 242, 242] as const,
  white: [255, 255, 255] as const,
  border: [226, 232, 240] as const,
  text: [30, 41, 59] as const,
  muted: [100, 116, 139] as const,
  grayBg: [244, 247, 251] as const,
}

const DEFAULT_LOGO_URL = "/logo.png"

function clean(text: unknown): string {
  if (text === null || text === undefined) return ""
  return String(text)
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function stripHtml(text: string): string {
  return clean(text.replace(/<[^>]*>/g, " "))
}

function normalizeQuestionType(type?: string): string {
  const t = clean(type).toLowerCase()
  if (t.includes("multiple")) return "Alternativa"
  if (t.includes("true") || t.includes("false")) return "Verdadero / Falso"
  if (t.includes("develop")) return "Desarrollo"
  return clean(type) || "Pregunta"
}

function levelFromScore(score: number): {
  label: string
  color: readonly number[]
  soft: readonly number[]
} {
  if (score >= 85) {
    return { label: "Logro destacado", color: PALETTE.green, soft: PALETTE.softGreen }
  }
  if (score >= 70) {
    return { label: "Buen nivel", color: PALETTE.blue, soft: PALETTE.softBlue }
  }
  if (score >= 50) {
    return { label: "En desarrollo", color: PALETTE.amber, soft: PALETTE.softAmber }
  }
  return { label: "Requiere apoyo", color: PALETTE.red, soft: PALETTE.softRed }
}

function recommendationFromScore(score: number): { title: string; body: string } {
  if (score >= 85) {
    return {
      title: "¡Felicitaciones por tu excelente desempeño!",
      body:
        "El estudiante demuestra un dominio sólido de los aprendizajes evaluados. Se recomienda continuar con actividades de profundización, nuevos desafíos y aplicación de los contenidos en situaciones más complejas y contextualizadas.",
    }
  }
  if (score >= 70) {
    return {
      title: "Muy buen trabajo realizado",
      body:
        "El estudiante evidencia una comprensión adecuada de los contenidos evaluados. Se sugiere reforzar algunos detalles específicos para consolidar completamente el aprendizaje y avanzar hacia un dominio más alto.",
    }
  }
  if (score >= 50) {
    return {
      title: "Aprendizaje en desarrollo",
      body:
        "El estudiante presenta avances importantes, pero aún requiere reforzar contenidos clave y mejorar la precisión en sus respuestas. Se recomienda repaso guiado, práctica adicional y retroalimentación constante.",
    }
  }
  return {
    title: "Se recomienda reforzamiento focalizado",
    body:
      "El estudiante necesita apoyo adicional para consolidar los aprendizajes evaluados. Se sugiere trabajar paso a paso los contenidos esenciales, acompañar con ejemplos resueltos y realizar actividades de refuerzo progresivo.",
  }
}

function safeFileName(text: string): string {
  return clean(text).replace(/[^\w\-]+/g, "_")
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "")
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function getImageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
    return "JPEG"
  }
  return "PNG"
}

export default function StudentPdfExporter({
  exam,
  submission,
}: {
  exam: Exam
  submission: Submission
}) {
  const [loading, setLoading] = useState(false)

  async function exportPDF() {
    setLoading(true)

    try {
      const { jsPDF } = await import("jspdf")
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

      const pageW = 210
      const pageH = 297
      const margin = 12
      const contentW = pageW - margin * 2
      let y = 0

      const questions: ExamQuestion[] = exam?.questions || []
      const answers: SubmissionAnswer[] = submission?.answers || []

      const score = Number(submission?.score || 0)
      const grade = Number(submission?.grade || 1)
      const totalQuestions = Number(submission?.total_questions || questions.length || 0)
      const correctCount = Number(submission?.correct_count || 0)
      const earnedPoints = Number(submission?.earned_points || 0)
      const totalPoints = Number(submission?.total_points || 0)

      const level = levelFromScore(score)
      const recommendation = recommendationFromScore(score)

      const logoUrl = clean(exam?.logoUrl || DEFAULT_LOGO_URL)
      const logoDataUrl = logoUrl ? await loadImageAsDataUrl(logoUrl) : null

      const setFont = (
        bold = false,
        size = 10,
        color: readonly number[] = PALETTE.text,
      ): void => {
        doc.setFont("helvetica", bold ? "bold" : "normal")
        doc.setFontSize(size)
        doc.setTextColor(color[0], color[1], color[2])
      }

      const fill = (
        x: number,
        yy: number,
        w: number,
        h: number,
        color: readonly number[],
        radius = 0,
      ): void => {
        doc.setFillColor(color[0], color[1], color[2])
        if (radius > 0 && (doc as jsPDF & { roundedRect?: Function }).roundedRect) {
          ;(doc as jsPDF & { roundedRect: Function }).roundedRect(x, yy, w, h, radius, radius, "F")
        } else {
          doc.rect(x, yy, w, h, "F")
        }
      }

      const drawBox = (
        x: number,
        yy: number,
        w: number,
        h: number,
        border: readonly number[] = PALETTE.border,
        bg?: readonly number[],
        radius = 3,
      ): void => {
        doc.setDrawColor(border[0], border[1], border[2])
        if (bg) doc.setFillColor(bg[0], bg[1], bg[2])

        if ((doc as jsPDF & { roundedRect?: Function }).roundedRect) {
          ;(doc as jsPDF & { roundedRect: Function }).roundedRect(
            x,
            yy,
            w,
            h,
            radius,
            radius,
            bg ? "FD" : "S",
          )
        } else {
          doc.rect(x, yy, w, h, bg ? "FD" : "S")
        }
      }

      const split = (text: string, w: number): string[] => {
        return doc.splitTextToSize(clean(text), w) as string[]
      }

      const addFooter = (): void => {
        setFont(false, 7.5, PALETTE.muted)
        doc.text(
          `EduAI Platform · Informe individual · ${new Date().toLocaleString("es-CL")}`,
          pageW - margin,
          pageH - 7,
          { align: "right" },
        )
      }

      const ensureSpace = (need = 18): void => {
        if (y + need > pageH - 16) {
          addFooter()
          doc.addPage()
          y = 16
        }
      }

      const justifiedParagraph = (
        text: string,
        x: number,
        yy: number,
        w: number,
        lineHeight = 5,
      ): number => {
        const lines: string[] = split(text, w)
        let cy = yy

        for (let i = 0; i < lines.length; i++) {
          const line: string = lines[i]
          ensureSpace(lineHeight + 2)

          const isLast = i === lines.length - 1
          const words: string[] = line.trim().split(/\s+/)

          if (isLast || words.length <= 1) {
            doc.text(line, x, cy)
          } else {
            const textWidth = doc.getTextWidth(words.join(" "))
            const gaps = words.length - 1
            const extra = Math.max(0, w - textWidth)
            const extraPerGap = gaps > 0 ? extra / gaps : 0
            let cursor = x

            words.forEach((word: string, index: number) => {
              doc.text(word, cursor, cy)
              if (index < gaps) {
                cursor += doc.getTextWidth(word + " ") + extraPerGap
              }
            })
          }

          cy += lineHeight
        }

        return cy
      }

      const sectionTitle = (title: string, subtitle?: string): void => {
        ensureSpace(14)
        fill(margin, y - 0.5, 5, 9, PALETTE.violet, 1.5)
        setFont(true, 12.5, PALETTE.navy)
        doc.text(clean(title), margin + 8, y + 5)

        if (subtitle) {
          setFont(false, 8.2, PALETTE.slate)
          doc.text(clean(subtitle), pageW - margin, y + 5, { align: "right" })
        }

        y += 12
      }

      const drawKpiCard = (
        x: number,
        yy: number,
        w: number,
        h: number,
        label: string,
        value: string,
        color: readonly number[],
      ): void => {
        drawBox(x, yy, w, h, PALETTE.border, PALETTE.white, 4)
        fill(x, yy, 4, h, color, 2)
        setFont(true, 7.5, PALETTE.slate)
        doc.text(clean(label).toUpperCase(), x + 8, yy + 6)
        setFont(true, 15, color)
        doc.text(clean(value), x + 8, yy + 14)
      }

      const drawProgressBar = (
        x: number,
        yy: number,
        w: number,
        value: number,
        color: readonly number[],
      ): void => {
        drawBox(x, yy, w, 5.5, PALETTE.border, [238, 242, 247], 2)
        fill(x, yy, Math.max(4, (w * Math.min(Math.max(value, 0), 100)) / 100), 5.5, color, 2)
      }

      const tableHeader = (headers: string[], widths: number[]): void => {
        ensureSpace(10)
        const totalW = widths.reduce((a: number, b: number) => a + b, 0)
        fill(margin, y, totalW, 8, PALETTE.navy, 2)
        setFont(true, 8, PALETTE.white)

        let x = margin
        headers.forEach((header: string, idx: number) => {
          doc.text(clean(header), x + 2, y + 5.2)
          x += widths[idx]
        })

        y += 8
      }

      const tableRow = (cols: string[], widths: number[], alt = false): void => {
        const prepared: string[][] = cols.map((col: string, i: number) => split(col || "—", widths[i] - 4))
        const maxLines = Math.max(...prepared.map((p: string[]) => p.length), 1)
        const rowH = Math.max(8, maxLines * 4.4 + 3)
        const totalW = widths.reduce((a: number, b: number) => a + b, 0)

        ensureSpace(rowH + 2)

        if (alt) {
          fill(margin, y, totalW, rowH, [250, 252, 255], 1.5)
        }

        doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2])
        doc.rect(margin, y, totalW, rowH)

        let x = margin
        setFont(false, 8, PALETTE.text)

        prepared.forEach((cell: string[], i: number) => {
          doc.line(x, y, x, y + rowH)
          let cy = y + 4.2
          cell.forEach((line: string) => {
            doc.text(line, x + 2, cy)
            cy += 4
          })
          x += widths[i]
        })

        doc.line(x, y, x, y + rowH)
        y += rowH
      }

      const questionBadge = (label: string, color: readonly number[]): void => {
        const badgeW = Math.max(18, doc.getTextWidth(label) + 6)
        fill(pageW - margin - badgeW, y - 1, badgeW, 6.5, color, 2)
        setFont(true, 7.3, PALETTE.white)
        doc.text(label, pageW - margin - badgeW / 2, y + 3.2, { align: "center" })
      }

      // PORTADA
      fill(0, 0, pageW, 48, PALETTE.navy)
      fill(0, 0, pageW, 8, PALETTE.violet)
      fill(0, 44, pageW, 4, PALETTE.cyan)
      fill(0, 0, 7, 48, PALETTE.blue)

      if (logoDataUrl) {
        try {
          const format = getImageFormatFromDataUrl(logoDataUrl)
          doc.addImage(logoDataUrl, format, pageW - 36, 10, 18, 18)
        } catch {
          // si falla el logo, el PDF sigue normal
        }
      }

      setFont(true, 20, PALETTE.white)
      const titleLines: string[] = split(exam?.title || "Informe individual del examen", contentW - 26)
      let titleY = 18
      titleLines.forEach((line: string) => {
        doc.text(line, margin + 5, titleY)
        titleY += 7.6
      })

      setFont(false, 10, [221, 226, 235])
      doc.text("Reporte individual del estudiante", margin + 5, 37)

      setFont(true, 9.5, PALETTE.white)
      doc.text(`Código: ${clean(exam?.code || "—")}`, pageW - margin, 18, { align: "right" })
      doc.text(`Asignatura: ${clean(exam?.subject || "—")}`, pageW - margin, 25, { align: "right" })
      doc.text(`Docente: ${clean(exam?.teacher_name || "—")}`, pageW - margin, 32, { align: "right" })

      y = 56

      // DATOS DEL ESTUDIANTE
      drawBox(margin, y, contentW, 29, PALETTE.border, PALETTE.white, 5)
      fill(margin, y, contentW, 6, PALETTE.grayBg, 4)

      setFont(true, 9, PALETTE.navy)
      doc.text("IDENTIFICACIÓN DEL ESTUDIANTE", margin + 4, y + 4.3)

      const leftX = margin + 4
      const rightX = margin + 107

      setFont(true, 8, PALETTE.slate)
      doc.text("Alumno", leftX, y + 11)
      setFont(false, 9.5, PALETTE.text)
      doc.text(clean(submission?.student_name || "Sin nombre"), leftX, y + 16)

      setFont(true, 8, PALETTE.slate)
      doc.text("Curso", leftX, y + 22)
      setFont(false, 9.5, PALETTE.text)
      doc.text(clean(submission?.student_course || "—"), leftX, y + 27)

      setFont(true, 8, PALETTE.slate)
      doc.text("RUT", rightX, y + 11)
      setFont(false, 9.5, PALETTE.text)
      doc.text(clean(submission?.student_rut || "—"), rightX, y + 16)

      setFont(true, 8, PALETTE.slate)
      doc.text("Fecha de envío", rightX, y + 22)
      setFont(false, 9.5, PALETTE.text)
      doc.text(
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
        y + 27,
      )

      y += 36

      // KPI
      const kpiW = (contentW - 9) / 4
      drawKpiCard(margin, y, kpiW, 24, "Nota final", grade.toFixed(1), PALETTE.blue)
      drawKpiCard(margin + kpiW + 3, y, kpiW, 24, "Logro", `${Math.round(score)}%`, level.color)
      drawKpiCard(
        margin + (kpiW + 3) * 2,
        y,
        kpiW,
        24,
        "Correctas",
        `${correctCount}/${totalQuestions}`,
        PALETTE.indigo,
      )
      drawKpiCard(
        margin + (kpiW + 3) * 3,
        y,
        kpiW,
        24,
        "Puntaje",
        `${earnedPoints}/${totalPoints}`,
        PALETTE.cyan,
      )

      y += 30

      // LOGRO GENERAL
      drawBox(margin, y, contentW, 22, PALETTE.border, level.soft, 4)
      setFont(true, 8.4, PALETTE.slate)
      doc.text("NIVEL DE LOGRO", margin + 4, y + 6)

      setFont(true, 13, level.color)
      doc.text(level.label, margin + 4, y + 13.2)

      drawProgressBar(margin + 95, y + 8, 82, score, level.color)

      setFont(true, 8.5, PALETTE.text)
      doc.text(`${Math.round(score)}%`, pageW - margin - 3, y + 12.2, { align: "right" })

      y += 28

      sectionTitle("Resumen del desempeño", "Visión global del resultado")

      setFont(false, 9.6, PALETTE.text)
      y = justifiedParagraph(
        `Este informe presenta el resultado individual del estudiante en el examen "${clean(exam?.title)}". Incluye el porcentaje de logro, el puntaje obtenido, el detalle de cada respuesta, la corrección correspondiente y la retroalimentación asociada, con el propósito de mantener una revisión clara, ordenada y pedagógicamente útil.`,
        margin,
        y,
        contentW,
      )
      y += 4

      if ((submission?.incident_count || 0) > 0) {
        ensureSpace(16)
        drawBox(margin, y, contentW, 14, PALETTE.red, PALETTE.softRed, 3)
        setFont(true, 8.8, PALETTE.red)
        doc.text(
          `Incidentes de seguridad registrados durante el examen: ${submission.incident_count}`,
          margin + 4,
          y + 8.6,
        )
        y += 19
      }

      sectionTitle("Detalle de respuestas", "Pregunta por pregunta")

      questions.forEach((q: ExamQuestion, qi: number) => {
        const a: SubmissionAnswer = answers[qi] || {}
        const questionType = normalizeQuestionType(a?.type || q?.type)
        const questionPoints = a?.maxPoints ?? q?.maxPoints ?? 0

        ensureSpace(28)

        drawBox(margin, y, contentW, 10, PALETTE.border, PALETTE.grayBg, 3)
        setFont(true, 10, PALETTE.navy)
        doc.text(`Pregunta ${qi + 1}`, margin + 4, y + 6.4)
        questionBadge(questionType, PALETTE.violet)

        setFont(false, 8.2, PALETTE.slate)
        doc.text(`${questionPoints} pts`, pageW - margin - 30, y + 6.4)

        y += 14

        setFont(true, 8.5, PALETTE.slate)
        doc.text("Enunciado", margin, y)
        setFont(false, 9.4, PALETTE.text)
        y = justifiedParagraph(stripHtml(q?.question || "Sin enunciado."), margin, y + 5, contentW)
        y += 3

        if (a?.type === "multiple_choice" || q?.type === "multiple_choice") {
          const selected =
            typeof a.selectedAnswer === "number"
              ? ["A", "B", "C", "D", "E"][a.selectedAnswer] || "—"
              : "—"

          const correct =
            typeof q.correctAnswer === "number"
              ? ["A", "B", "C", "D", "E"][q.correctAnswer] || "—"
              : "—"

          tableHeader(["Campo", "Detalle"], [45, contentW - 45])
          tableRow(["Respuesta del alumno", selected], [45, contentW - 45], false)
          tableRow(["Alternativa correcta", correct], [45, contentW - 45], true)
          tableRow(
            ["Resultado", a.isCorrect ? "Respuesta correcta" : "Respuesta incorrecta"],
            [45, contentW - 45],
            false,
          )

          if (Array.isArray(q?.options) && q.options.length > 0) {
            y += 3
            tableHeader(["Alternativa", "Contenido"], [26, contentW - 26])
            q.options.forEach((opt: string, idx: number) => {
              tableRow(
                [["A", "B", "C", "D", "E"][idx] || `Opción ${idx + 1}`, stripHtml(opt)],
                [26, contentW - 26],
                idx % 2 === 1,
              )
            })
          }

          if (q?.explanation) {
            y += 3
            setFont(true, 8.5, PALETTE.slate)
            doc.text("Explicación de referencia", margin, y)
            setFont(false, 9.2, PALETTE.text)
            y = justifiedParagraph(stripHtml(q.explanation), margin, y + 5, contentW)
            y += 3
          }
        }

        if (a?.type === "true_false" || q?.type === "true_false") {
          const tfOptions = q.options || ["Verdadero", "Falso"]

          tableHeader(["Campo", "Detalle"], [45, contentW - 45])
          tableRow(
            [
              "Selección del alumno",
              typeof a.selectedAnswer === "number" ? tfOptions[a.selectedAnswer] || "—" : "—",
            ],
            [45, contentW - 45],
            false,
          )
          tableRow(
            [
              "Respuesta correcta",
              typeof q.correctAnswer === "number" ? tfOptions[q.correctAnswer] || "—" : "—",
            ],
            [45, contentW - 45],
            true,
          )
          tableRow(
            ["Resultado selección", a.selectionCorrect ? "Correcta" : "Incorrecta"],
            [45, contentW - 45],
            false,
          )
          tableRow(
            ["Justificación del alumno", a.justification || "Sin justificación."],
            [45, contentW - 45],
            true,
          )
          tableRow(
            [
              "Puntaje justificación",
              `${a.justificationScore ?? 0}/${a.justificationMaxPoints ?? 0}`,
            ],
            [45, contentW - 45],
            false,
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

        if (a?.type === "development" || q?.type === "development") {
          tableHeader(["Campo", "Detalle"], [45, contentW - 45])
          tableRow(["Respuesta del alumno", a.devText || "Sin respuesta."], [45, contentW - 45], false)
          tableRow(
            [
              "Puntaje obtenido",
              `${a.manualScore ?? a.aiScore ?? 0}/${a.maxPoints || q.maxPoints || 0}`,
            ],
            [45, contentW - 45],
            true,
          )

          if (q?.modelAnswer) {
            y += 3
            setFont(true, 8.5, PALETTE.slate)
            doc.text("Respuesta modelo", margin, y)
            setFont(false, 9.2, PALETTE.text)
            y = justifiedParagraph(q.modelAnswer, margin, y + 5, contentW)
            y += 3
          }

          if (q?.rubric?.length) {
            tableHeader(["Criterio", "Puntaje"], [contentW - 30, 30])
            q.rubric.forEach(
              (
                r: {
                  criteria?: string
                  criterion?: string
                  criterio?: string
                  points?: number
                  puntos?: number
                  puntaje?: number
                },
                idx: number,
              ) => {
                tableRow(
                  [
                    r.criteria || r.criterion || r.criterio || "Criterio",
                    `${r.points || r.puntos || r.puntaje || 0} pts`,
                  ],
                  [contentW - 30, 30],
                  idx % 2 === 1,
                )
              },
            )
          }

          const finalFeedback = a.manualFeedback || a.aiFeedback
          if (finalFeedback) {
            y += 3
            setFont(true, 8.5, PALETTE.slate)
            doc.text("Retroalimentación", margin, y)
            setFont(false, 9.2, PALETTE.text)
            y = justifiedParagraph(finalFeedback, margin, y + 5, contentW)
            y += 3
          }
        }

        y += 4
      })

      sectionTitle("Cierre pedagógico", "Síntesis final del desempeño")

      drawBox(margin, y, contentW, 34, PALETTE.border, level.soft, 5)
      fill(margin, y, 5, 34, level.color, 3)

      setFont(true, 11, level.color)
      doc.text(recommendation.title, margin + 9, y + 8)

      setFont(false, 9.4, PALETTE.text)
      y = justifiedParagraph(recommendation.body, margin + 9, y + 15, contentW - 14)

      y += 10

      addFooter()

      const examName = safeFileName(exam?.title || "examen")
      const studentName = safeFileName(submission?.student_name || "alumno")
      doc.save(`${examName}_${studentName}.pdf`)
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
      title="Descargar informe PDF individual"
    >
      <FileDown size={12} />
      {loading ? "Generando..." : "PDF"}
    </button>
  )
}
