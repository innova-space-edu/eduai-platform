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

type JsPdfWithRoundedRect = {
  roundedRect?: (
    x: number,
    y: number,
    w: number,
    h: number,
    rx: number,
    ry: number,
    style?: string,
  ) => void
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
  short: string
  color: readonly number[]
  soft: readonly number[]
} {
  if (score >= 85) {
    return {
      label: "Logro destacado",
      short: "APROBADO DESTACADO",
      color: PALETTE.green,
      soft: PALETTE.softGreen,
    }
  }
  if (score >= 70) {
    return {
      label: "Buen nivel",
      short: "BUEN NIVEL",
      color: PALETTE.blue,
      soft: PALETTE.softBlue,
    }
  }
  if (score >= 50) {
    return {
      label: "En desarrollo",
      short: "EN DESARROLLO",
      color: PALETTE.amber,
      soft: PALETTE.softAmber,
    }
  }
  return {
    label: "Requiere apoyo",
    short: "REQUIERE APOYO",
    color: PALETTE.red,
    soft: PALETTE.softRed,
  }
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

function normalizeFeedback(text?: string): string {
  const t = clean(text)
  if (!t) return ""
  if (t.toLowerCase().includes("pendiente de revisión manual")) {
    return "Revisión docente aún no registrada."
  }
  return t
}

function getQuestionScore(answer: SubmissionAnswer, question: ExamQuestion): number {
  if (typeof answer.manualScore === "number") return answer.manualScore
  if (typeof answer.aiScore === "number") return answer.aiScore
  if (typeof answer.justificationScore === "number") {
    const base = answer.selectionCorrect ? 1 : 0
    return base + answer.justificationScore
  }
  if (typeof answer.isCorrect === "boolean") return answer.isCorrect ? Number(answer.maxPoints ?? question.maxPoints ?? 0) : 0
  return 0
}

function buildAnalyticSummary(
  questions: ExamQuestion[],
  answers: SubmissionAnswer[],
  score: number,
): { strengths: string; weak: string; profile: string } {
  let mc = 0
  let tf = 0
  let dev = 0
  let mcOk = 0
  let tfOk = 0
  let devOk = 0

  questions.forEach((q: ExamQuestion, i: number) => {
    const a = answers[i] || {}
    const type = (a.type || q.type || "").toLowerCase()

    if (type.includes("multiple")) {
      mc++
      if (a.isCorrect) mcOk++
    } else if (type.includes("true") || type.includes("false")) {
      tf++
      if (a.selectionCorrect) tfOk++
    } else if (type.includes("develop")) {
      dev++
      const maxPts = Number(a.maxPoints ?? q.maxPoints ?? 0)
      const pts = Number(a.manualScore ?? a.aiScore ?? 0)
      if (maxPts > 0 && pts / maxPts >= 0.7) devOk++
    }
  })

  const parts: string[] = []
  if (mc > 0) parts.push(`alternativas (${mcOk}/${mc})`)
  if (tf > 0) parts.push(`verdadero/falso (${tfOk}/${tf})`)
  if (dev > 0) parts.push(`desarrollo (${devOk}/${dev})`)

  let strengths = "Desempeño equilibrado en los distintos tipos de preguntas."
  if (score >= 85) {
    strengths = `Muestra dominio sólido en ${parts.join(", ")}.`
  } else if (score >= 70) {
    strengths = `Evidencia buen manejo general, especialmente en ${parts.join(", ")}.`
  }

  let weak = "No se observan debilidades críticas en este informe."
  if (score < 85 && dev > 0 && devOk < dev) {
    weak = "Conviene reforzar la profundidad y precisión en respuestas de desarrollo."
  } else if (score < 70 && tf > 0 && tfOk < tf) {
    weak = "Se recomienda fortalecer la justificación conceptual en ítems de verdadero/falso."
  } else if (score < 70 && mc > 0 && mcOk < mc) {
    weak = "Sería útil reforzar reconocimiento de conceptos clave en preguntas de selección."
  }

  let profile = "Perfil de logro alto con proyección de profundización."
  if (score < 85 && score >= 70) profile = "Perfil sólido, con espacio para consolidar algunos detalles."
  if (score < 70 && score >= 50) profile = "Perfil en desarrollo, requiere práctica guiada."
  if (score < 50) profile = "Perfil que requiere apoyo focalizado y reforzamiento."

  return { strengths, weak, profile }
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
      const docWithRounded = doc as unknown as JsPdfWithRoundedRect

      const pageW = 210
      const pageH = 297
      const margin = 12
      const contentW = pageW - margin * 2
      let y = 0
      let pageNumber = 1

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
      const analytics = buildAnalyticSummary(questions, answers, score)

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
        if (radius > 0 && docWithRounded.roundedRect) {
          docWithRounded.roundedRect(x, yy, w, h, radius, radius, "F")
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

        if (docWithRounded.roundedRect) {
          docWithRounded.roundedRect(x, yy, w, h, radius, radius, bg ? "FD" : "S")
        } else {
          doc.rect(x, yy, w, h, bg ? "FD" : "S")
        }
      }

      const split = (text: string, w: number): string[] => {
        return doc.splitTextToSize(clean(text), w) as string[]
      }

      const addFooter = (): void => {
        setFont(false, 7.2, PALETTE.muted)
        doc.text(`EduAI Platform · Informe individual`, margin, pageH - 7)
        doc.text(`Página ${pageNumber}`, pageW - margin, pageH - 7, { align: "right" })
      }

      const newPage = (): void => {
        addFooter()
        doc.addPage()
        pageNumber += 1
        y = 14
      }

      const ensureSpace = (need = 18): void => {
        if (y + need > pageH - 16) {
          newPage()
        }
      }

      const justifiedParagraph = (
        text: string,
        x: number,
        yy: number,
        w: number,
        lineHeight = 4.5,
      ): number => {
        const lines: string[] = split(text, w)
        let cy = yy

        for (let i = 0; i < lines.length; i++) {
          const line: string = lines[i]
          ensureSpace(lineHeight + 1.5)

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
        ensureSpace(10)
        fill(margin, y - 0.5, 4.5, 8, PALETTE.violet, 1.2)
        setFont(true, 11.5, PALETTE.navy)
        doc.text(clean(title), margin + 7, y + 4.5)

        if (subtitle) {
          setFont(false, 7.8, PALETTE.slate)
          doc.text(clean(subtitle), pageW - margin, y + 4.5, { align: "right" })
        }

        y += 9.5
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
        setFont(true, 7.2, PALETTE.slate)
        doc.text(clean(label).toUpperCase(), x + 7.5, yy + 5.5)
        setFont(true, 13.5, color)
        doc.text(clean(value), x + 7.5, yy + 12.8)
      }

      const drawProgressBar = (
        x: number,
        yy: number,
        w: number,
        value: number,
        color: readonly number[],
      ): void => {
        drawBox(x, yy, w, 5, PALETTE.border, [238, 242, 247], 2)
        fill(x, yy, Math.max(4, (w * Math.min(Math.max(value, 0), 100)) / 100), 5, color, 2)
      }

      const tableHeader = (headers: string[], widths: number[]): void => {
        ensureSpace(8)
        const totalW = widths.reduce((a: number, b: number) => a + b, 0)
        fill(margin, y, totalW, 7, PALETTE.navy, 2)
        setFont(true, 7.6, PALETTE.white)

        let x = margin
        headers.forEach((header: string, idx: number) => {
          doc.text(clean(header), x + 2, y + 4.6)
          x += widths[idx]
        })

        y += 7
      }

      const tableRow = (cols: string[], widths: number[], alt = false): void => {
        const prepared: string[][] = cols.map((col: string, i: number) => split(col || "—", widths[i] - 4))
        const maxLines = Math.max(...prepared.map((p: string[]) => p.length), 1)
        const rowH = Math.max(7, maxLines * 3.9 + 2.5)
        const totalW = widths.reduce((a: number, b: number) => a + b, 0)

        ensureSpace(rowH + 1)

        if (alt) {
          fill(margin, y, totalW, rowH, [250, 252, 255], 1.5)
        }

        doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2])
        doc.rect(margin, y, totalW, rowH)

        let x = margin
        setFont(false, 7.8, PALETTE.text)

        prepared.forEach((cell: string[], i: number) => {
          doc.line(x, y, x, y + rowH)
          let cy = y + 4
          cell.forEach((line: string) => {
            doc.text(line, x + 2, cy)
            cy += 3.7
          })
          x += widths[i]
        })

        doc.line(x, y, x, y + rowH)
        y += rowH
      }

      const questionBadge = (label: string, color: readonly number[]): void => {
        const badgeW = Math.max(18, doc.getTextWidth(label) + 6)
        fill(pageW - margin - badgeW, y - 0.5, badgeW, 6, color, 2)
        setFont(true, 7, PALETTE.white)
        doc.text(label, pageW - margin - badgeW / 2, y + 3.5, { align: "center" })
      }

      // PORTADA
      fill(0, 0, pageW, 44, PALETTE.navy)
      fill(0, 0, pageW, 7, PALETTE.violet)
      fill(0, 40, pageW, 4, PALETTE.cyan)
      fill(0, 0, 6, 44, PALETTE.blue)

      if (logoDataUrl) {
        try {
          const format = getImageFormatFromDataUrl(logoDataUrl)
          doc.addImage(logoDataUrl, format, pageW - 34, 9, 16, 16)
        } catch {
          // sigue sin romper
        }
      }

      setFont(true, 18, PALETTE.white)
      const titleLines: string[] = split(exam?.title || "Informe individual del examen", contentW - 26)
      let titleY = 17
      titleLines.forEach((line: string) => {
        doc.text(line, margin + 5, titleY)
        titleY += 7
      })

      setFont(false, 9.5, [221, 226, 235])
      doc.text("Reporte individual del estudiante", margin + 5, 34)

      const headerMeta: string[] = [`Código: ${clean(exam?.code || "—")}`]
      if (clean(exam?.subject)) headerMeta.push(`Asignatura: ${clean(exam.subject)}`)
      if (clean(exam?.teacher_name)) headerMeta.push(`Docente: ${clean(exam.teacher_name)}`)

      setFont(true, 8.8, PALETTE.white)
      let headerMetaY = 16
      headerMeta.forEach((item: string) => {
        doc.text(item, pageW - margin, headerMetaY, { align: "right" })
        headerMetaY += 6
      })

      y = 50

      // DATOS ESTUDIANTE
      drawBox(margin, y, contentW, 27, PALETTE.border, PALETTE.white, 5)
      fill(margin, y, contentW, 5.5, PALETTE.grayBg, 4)

      setFont(true, 8.8, PALETTE.navy)
      doc.text("IDENTIFICACIÓN DEL ESTUDIANTE", margin + 4, y + 3.9)

      const leftX = margin + 4
      const rightX = margin + 107

      setFont(true, 7.7, PALETTE.slate)
      doc.text("Alumno", leftX, y + 10)
      setFont(false, 9.2, PALETTE.text)
      doc.text(clean(submission?.student_name || "Sin nombre"), leftX, y + 14.8)

      setFont(true, 7.7, PALETTE.slate)
      doc.text("Curso", leftX, y + 20)
      setFont(false, 9.2, PALETTE.text)
      doc.text(clean(submission?.student_course || "—"), leftX, y + 24.6)

      setFont(true, 7.7, PALETTE.slate)
      doc.text("RUT", rightX, y + 10)
      setFont(false, 9.2, PALETTE.text)
      doc.text(clean(submission?.student_rut || "—"), rightX, y + 14.8)

      setFont(true, 7.7, PALETTE.slate)
      doc.text("Fecha de envío", rightX, y + 20)
      setFont(false, 9.2, PALETTE.text)
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
        y + 24.6,
      )

      y += 31

      // BADGE ESTADO
      {
        const badgeW = doc.getTextWidth(level.short) + 10
        fill(margin, y, badgeW, 7.5, level.color, 3)
        setFont(true, 8, PALETTE.white)
        doc.text(level.short, margin + badgeW / 2, y + 4.9, { align: "center" })
      }

      y += 10

      const kpiW = (contentW - 9) / 4
      drawKpiCard(margin, y, kpiW, 20, "Nota final", grade.toFixed(1), PALETTE.blue)
      drawKpiCard(margin + kpiW + 3, y, kpiW, 20, "Logro", `${Math.round(score)}%`, level.color)
      drawKpiCard(
        margin + (kpiW + 3) * 2,
        y,
        kpiW,
        20,
        "Correctas",
        `${correctCount}/${totalQuestions}`,
        PALETTE.indigo,
      )
      drawKpiCard(
        margin + (kpiW + 3) * 3,
        y,
        kpiW,
        20,
        "Puntaje",
        `${earnedPoints}/${totalPoints}`,
        PALETTE.cyan,
      )

      y += 24

      drawBox(margin, y, contentW, 18, PALETTE.border, level.soft, 4)
      setFont(true, 7.8, PALETTE.slate)
      doc.text("NIVEL DE LOGRO", margin + 4, y + 5.2)

      setFont(true, 11.5, level.color)
      doc.text(level.label, margin + 4, y + 11.6)

      drawProgressBar(margin + 92, y + 6.8, 84, score, level.color)

      setFont(true, 8, PALETTE.text)
      doc.text(`${Math.round(score)}%`, pageW - margin - 3, y + 10.8, { align: "right" })

      y += 22

      sectionTitle("Resumen del desempeño", "Visión global del resultado")
      setFont(false, 9, PALETTE.text)
      y = justifiedParagraph(
        `Este informe presenta el resultado individual del estudiante en el examen "${clean(exam?.title)}". Incluye el porcentaje de logro, el puntaje obtenido, el detalle de cada respuesta, la corrección correspondiente y la retroalimentación asociada, con el propósito de mantener una revisión clara, ordenada y pedagógicamente útil.`,
        margin,
        y,
        contentW,
      )
      y += 2

      if ((submission?.incident_count || 0) > 0) {
        ensureSpace(14)
        drawBox(margin, y, contentW, 12, PALETTE.red, PALETTE.softRed, 3)
        setFont(true, 8.2, PALETTE.red)
        doc.text(
          `Incidentes de seguridad registrados durante el examen: ${submission.incident_count}`,
          margin + 4,
          y + 7.5,
        )
        y += 15
      }

      sectionTitle("Resumen analítico del estudiante", "Síntesis automática")
      drawBox(margin, y, contentW, 28, PALETTE.border, PALETTE.white, 4)

      setFont(true, 8, PALETTE.navy)
      doc.text("Fortalezas observadas", margin + 4, y + 6)
      setFont(false, 8.4, PALETTE.text)
      y = justifiedParagraph(analytics.strengths, margin + 4, y + 10, contentW - 8, 4.2)

      setFont(true, 8, PALETTE.navy)
      doc.text("Aspectos a reforzar", margin + 4, y + 2)
      setFont(false, 8.4, PALETTE.text)
      y = justifiedParagraph(analytics.weak, margin + 4, y + 6, contentW - 8, 4.2)

      setFont(true, 8, PALETTE.navy)
      doc.text("Perfil general", margin + 4, y + 2)
      setFont(false, 8.4, PALETTE.text)
      y = justifiedParagraph(analytics.profile, margin + 4, y + 6, contentW - 8, 4.2)

      y += 4

      sectionTitle("Detalle de respuestas", "Pregunta por pregunta")

      questions.forEach((q: ExamQuestion, qi: number) => {
        const a: SubmissionAnswer = answers[qi] || {}
        const questionType = normalizeQuestionType(a?.type || q?.type)
        const questionPoints = a?.maxPoints ?? q?.maxPoints ?? 0
        const questionScore = getQuestionScore(a, q)

        const estimatedNeed =
          26 +
          split(stripHtml(q?.question || "Sin enunciado."), contentW).length * 4 +
          12

        ensureSpace(Math.min(Math.max(estimatedNeed, 32), 70))

        drawBox(margin, y, contentW, 8.5, PALETTE.border, PALETTE.grayBg, 3)
        setFont(true, 9.2, PALETTE.navy)
        doc.text(`Pregunta ${qi + 1}`, margin + 4, y + 5.5)
        questionBadge(questionType, PALETTE.violet)

        setFont(false, 7.6, PALETTE.slate)
        doc.text(`${questionScore}/${questionPoints} pts`, pageW - margin - 30, y + 5.5)

        y += 11.5

        setFont(true, 8, PALETTE.slate)
        doc.text("Enunciado", margin, y)
        setFont(false, 8.8, PALETTE.text)
        y = justifiedParagraph(stripHtml(q?.question || "Sin enunciado."), margin, y + 4.3, contentW, 4.2)
        y += 2

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
            y += 2
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
            y += 2
            setFont(true, 8, PALETTE.slate)
            doc.text("Explicación de referencia", margin, y)
            setFont(false, 8.7, PALETTE.text)
            y = justifiedParagraph(stripHtml(q.explanation), margin, y + 4.3, contentW, 4.1)
            y += 2
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

          const feedback = normalizeFeedback(a.justificationFeedback)
          if (feedback) {
            y += 2
            setFont(true, 8, PALETTE.slate)
            doc.text("Retroalimentación", margin, y)
            setFont(false, 8.7, PALETTE.text)
            y = justifiedParagraph(feedback, margin, y + 4.3, contentW, 4.1)
            y += 2
          }

          if (q?.explanation) {
            setFont(true, 8, PALETTE.slate)
            doc.text("Explicación de referencia", margin, y)
            setFont(false, 8.7, PALETTE.text)
            y = justifiedParagraph(stripHtml(q.explanation), margin, y + 4.3, contentW, 4.1)
            y += 2
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
            y += 2
            setFont(true, 8, PALETTE.slate)
            doc.text("Respuesta modelo", margin, y)
            setFont(false, 8.7, PALETTE.text)
            y = justifiedParagraph(q.modelAnswer, margin, y + 4.3, contentW, 4.1)
            y += 2
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

          const finalFeedback = normalizeFeedback(a.manualFeedback || a.aiFeedback)
          if (finalFeedback) {
            y += 2
            setFont(true, 8, PALETTE.slate)
            doc.text("Retroalimentación", margin, y)
            setFont(false, 8.7, PALETTE.text)
            y = justifiedParagraph(finalFeedback, margin, y + 4.3, contentW, 4.1)
            y += 2
          }
        }

        y += 2
      })

      sectionTitle("Cierre pedagógico", "Síntesis final del desempeño")

      const closingTextHeight =
        split(recommendation.body, contentW - 14).length * 4.3 + 18
      drawBox(margin, y, contentW, Math.max(26, closingTextHeight), PALETTE.border, level.soft, 5)
      fill(margin, y, 5, Math.max(26, closingTextHeight), level.color, 3)

      setFont(true, 10.5, level.color)
      doc.text(recommendation.title, margin + 9, y + 7)

      setFont(false, 8.9, PALETTE.text)
      y = justifiedParagraph(recommendation.body, margin + 9, y + 13, contentW - 14, 4.2)

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
