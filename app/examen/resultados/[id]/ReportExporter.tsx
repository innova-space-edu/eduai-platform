"use client"

import { useState } from "react"

const PALETTE = {
  navy: [20, 37, 84],
  blue: [37, 99, 235],
  indigo: [99, 102, 241],
  cyan: [6, 182, 212],
  emerald: [16, 185, 129],
  amber: [245, 158, 11],
  red: [239, 68, 68],
  slate900: [15, 23, 42],
  slate700: [51, 65, 85],
  slate500: [100, 116, 139],
  slate300: [203, 213, 225],
  slate200: [226, 232, 240],
  slate100: [241, 245, 249],
  white: [255, 255, 255],
  donut: [
    [99, 102, 241],
    [16, 185, 129],
    [245, 158, 11],
    [239, 68, 68],
  ],
} as const

const rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`

function setFont(doc: any, opts?: { bold?: boolean; size?: number; color?: readonly number[] }) {
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal")
  doc.setFontSize(opts?.size ?? 10)
  const color = opts?.color ?? PALETTE.slate900
  doc.setTextColor(color[0], color[1], color[2])
}

function fillRect(doc: any, x: number, y: number, w: number, h: number, color: readonly number[], r = 0) {
  doc.setFillColor(color[0], color[1], color[2])
  if (r > 0 && typeof doc.roundedRect === "function") {
    doc.roundedRect(x, y, w, h, r, r, "F")
  } else {
    doc.rect(x, y, w, h, "F")
  }
}

function strokeRect(doc: any, x: number, y: number, w: number, h: number, color: readonly number[], r = 0, lineWidth = 0.25) {
  doc.setDrawColor(color[0], color[1], color[2])
  doc.setLineWidth(lineWidth)
  if (r > 0 && typeof doc.roundedRect === "function") {
    doc.roundedRect(x, y, w, h, r, r, "S")
  } else {
    doc.rect(x, y, w, h, "S")
  }
}

function formatDate(dateLike?: string | Date) {
  try {
    return new Date(dateLike || new Date()).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  } catch {
    return new Date().toLocaleDateString("es-CL")
  }
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function gradeColor(grade: number) {
  if (grade >= 6) return PALETTE.emerald
  if (grade >= 4) return PALETTE.blue
  return PALETTE.red
}

function performanceLabel(avgGrade: number) {
  if (avgGrade >= 5.5) return { text: "ALTO", color: PALETTE.emerald }
  if (avgGrade >= 4.0) return { text: "MEDIO", color: PALETTE.amber }
  return { text: "BAJO", color: PALETTE.red }
}

function cleanPdfText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u2190-\u21FF]/g, "")
    .replace(/[\u2600-\u26FF]/g, "")
    .replace(/[\u2700-\u27BF]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/✓/g, "SI")
    .replace(/—/g, "-")
    .replace(/…/g, "...")
    .trim()
}

function truncate(text: unknown, max = 28) {
  const t = cleanPdfText(text)
  return t.length > max ? `${t.slice(0, Math.max(0, max - 3))}...` : t
}

function splitText(doc: any, text: string, maxW: number): string[] {
  return doc.splitTextToSize(cleanPdfText(text), maxW)
}

function drawDonut(slices: { value: number; color: readonly number[] }[], size = 220, hole = 0.63): string {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8
  const total = slices.reduce((acc, item) => acc + Math.max(0, item.value), 0) || 1
  let start = -Math.PI / 2

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = "rgba(255,255,255,0)"
  ctx.fillRect(0, 0, size, size)

  slices.forEach((slice) => {
    if (slice.value <= 0) return
    const sweep = (slice.value / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, start, start + sweep)
    ctx.closePath()
    ctx.fillStyle = rgb(slice.color)
    ctx.fill()
    start += sweep
  })

  ctx.beginPath()
  ctx.arc(cx, cy, r * hole, 0, Math.PI * 2)
  ctx.fillStyle = rgb(PALETTE.white)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, r * hole * 0.72, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(241,245,249,0.9)"
  ctx.fill()

  return canvas.toDataURL("image/png")
}

function drawBars(items: { label: string; value: number; max: number; color: readonly number[] }[], w = 520, h = 230): string {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  ctx.clearRect(0, 0, w, h)
  ctx.font = "13px Arial"
  ctx.textBaseline = "middle"

  const top = 16
  const rowH = Math.max(28, Math.floor((h - top * 2) / Math.max(1, items.length)))
  const labelW = 190
  const maxBarW = w - labelW - 72

  items.forEach((item, idx) => {
    const y = top + idx * rowH
    const val = Math.max(0, Math.min(item.max, item.value))
    const barW = maxBarW * (val / Math.max(1, item.max))

    ctx.fillStyle = rgb(PALETTE.slate700)
    ctx.fillText(truncate(item.label, 28), 0, y + rowH / 2)

    ctx.fillStyle = "rgba(226,232,240,0.95)"
    if (typeof (ctx as any).roundRect === "function") {
      ctx.beginPath()
      ;(ctx as any).roundRect(labelW, y + 5, maxBarW, rowH - 10, 8)
      ctx.fill()
    } else {
      ctx.fillRect(labelW, y + 5, maxBarW, rowH - 10)
    }

    const grad = ctx.createLinearGradient(labelW, 0, labelW + Math.max(barW, 1), 0)
    grad.addColorStop(0, rgb(item.color))
    grad.addColorStop(1, `rgba(${item.color[0]},${item.color[1]},${item.color[2]},0.72)`)
    ctx.fillStyle = grad
    if (typeof (ctx as any).roundRect === "function") {
      ctx.beginPath()
      ;(ctx as any).roundRect(labelW, y + 5, Math.max(barW, 8), rowH - 10, 8)
      ctx.fill()
    } else {
      ctx.fillRect(labelW, y + 5, Math.max(barW, 8), rowH - 10)
    }

    ctx.fillStyle = rgb(PALETTE.slate900)
    ctx.fillText(`${Math.round(val)}%`, labelW + maxBarW + 12, y + rowH / 2)
  })

  return canvas.toDataURL("image/png")
}

function drawProgressPill(doc: any, x: number, y: number, w: number, h: number, pct: number, color: readonly number[]) {
  fillRect(doc, x, y, w, h, PALETTE.slate200, 2.5)
  fillRect(doc, x, y, Math.max(3, Math.min(w, (w * Math.max(0, Math.min(100, pct))) / 100)), h, color, 2.5)
}

function statCard(doc: any, x: number, y: number, w: number, h: number, title: string, value: string, subtitle: string, color: readonly number[]) {
  fillRect(doc, x, y, w, h, PALETTE.white, 3)
  strokeRect(doc, x, y, w, h, PALETTE.slate200, 3)
  fillRect(doc, x, y, 3.5, h, color, 2)
  setFont(doc, { bold: true, size: 7.5, color: PALETTE.slate700 })
  doc.text(cleanPdfText(title).toUpperCase(), x + 6.5, y + 6)
  setFont(doc, { bold: true, size: 16, color })
  doc.text(cleanPdfText(value), x + 6.5, y + 14)
  setFont(doc, { size: 7.2, color: PALETTE.slate500 })
  doc.text(cleanPdfText(subtitle), x + 6.5, y + h - 4)
}

export default function ReportExporter({ exam, submissions }: { exam: any; submissions: any[] }) {
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [generatingXLSX, setGeneratingXLSX] = useState(false)
  const [analysisCache, setAnalysisCache] = useState<any>(null)

  async function getAnalysis() {
    if (analysisCache) return analysisCache
    const res = await fetch("/api/exam-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exam, submissions }),
    })
    const data = await res.json()
    if (data.success) {
      setAnalysisCache(data.analysis)
      return data.analysis
    }
    return null
  }

  const total = submissions.length
  const avgGrade = total > 0 ? submissions.reduce((a, s) => a + safeNumber(s.grade), 0) / total : 0
  const avgScore = total > 0 ? submissions.reduce((a, s) => a + safeNumber(s.score), 0) / total : 0
  const passCount = submissions.filter((s) => safeNumber(s.grade) >= 4).length
  const maxGrade = total > 0 ? Math.max(...submissions.map((s) => safeNumber(s.grade))) : 0
  const minGrade = total > 0 ? Math.min(...submissions.map((s) => safeNumber(s.grade))) : 0
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0
  const perf = performanceLabel(avgGrade)
  const examPct = exam?.settings?.examPercentage || 60

  const dist = [
    { label: "7.0 - 6.0", count: submissions.filter((s) => safeNumber(s.grade) >= 6).length, color: PALETTE.donut[0] },
    { label: "5.9 - 5.0", count: submissions.filter((s) => safeNumber(s.grade) >= 5 && safeNumber(s.grade) < 6).length, color: PALETTE.donut[1] },
    { label: "4.9 - 4.0", count: submissions.filter((s) => safeNumber(s.grade) >= 4 && safeNumber(s.grade) < 5).length, color: PALETTE.donut[2] },
    { label: "Menor a 4.0", count: submissions.filter((s) => safeNumber(s.grade) < 4).length, color: PALETTE.donut[3] },
  ]

  const questions: any[] = Array.isArray(exam?.questions) ? exam.questions : []
  const qStats = questions
    .map((q: any, qi: number) => {
      const maxPts = safeNumber(q?.maxPoints, 1)
      let earned = 0
      let count = 0
      submissions.forEach((s) => {
        const answer = s?.answers?.[qi]
        if (!answer) return
        count += 1
        if (answer.type === "multiple_choice") {
          earned += answer.isCorrect ? maxPts : 0
        } else if (answer.type === "true_false") {
          earned += safeNumber(answer.selectionCorrect ? answer.selectionPoints : 0)
          earned += Math.min(safeNumber(answer.justificationMaxPoints), safeNumber(answer.justificationScore))
        } else {
          earned += Math.min(maxPts, safeNumber(answer.manualScore ?? answer.aiScore))
        }
      })
      const pct = count > 0 ? Math.round((earned / count / Math.max(maxPts, 1)) * 100) : 0
      return {
        index: qi,
        label: `P${qi + 1}: ${truncate(q?.question || "Pregunta", 48)}`,
        pct,
        type: q?.type || "development",
        ability: q?.ability || "-",
      }
    })
    .sort((a, b) => a.pct - b.pct)

  const ranked = [...submissions].sort((a, b) => safeNumber(b.grade) - safeNumber(a.grade))
  const topStudent = ranked[0]
  const needsSupportStudent = ranked[ranked.length - 1]
  const reviewPending = submissions.filter((s) => !s?.manually_reviewed).length
  const incidents = submissions.reduce((acc, s) => acc + safeNumber(s?.incident_count), 0)
  const today = formatDate(new Date())

  async function exportPDF() {
    setGeneratingPDF(true)
    try {
      const [{ jsPDF }, analysis] = await Promise.all([import("jspdf"), getAnalysis()])
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const W = 210
      const H = 297
      const PL = 14
      const PR = 14
      const CW = W - PL - PR
      let y = 0

      const addFooter = (page: number, pageCount: number) => {
        fillRect(doc, 0, H - 10, W, 10, PALETTE.navy)
        setFont(doc, { size: 7, color: [191, 219, 254] })
        doc.text(`${cleanPdfText(exam?.title || "Informe de evaluación")} · EduAI Platform · Generado el ${today}`, PL, H - 4)
        doc.text(`Página ${page} de ${pageCount}`, W - PR, H - 4, { align: "right" })
      }

      // Página 1
      fillRect(doc, 0, 0, W, 54, PALETTE.navy)
      fillRect(doc, 0, 0, 7, 54, PALETTE.cyan)
      fillRect(doc, W - 30, 0, 30, 54, PALETTE.blue)
      fillRect(doc, W - 12, 0, 12, 54, PALETTE.indigo)

      setFont(doc, { bold: true, size: 21, color: PALETTE.white })
      const titleLines = splitText(doc, exam?.title || "Informe general de evaluación", CW - 8)
      doc.text(titleLines, PL + 4, 18)

      setFont(doc, { size: 9.5, color: [219, 234, 254] })
      doc.text(cleanPdfText(`${exam?.topic || "Evaluación docente"} · ${today} · Código: ${exam?.code || "-"}`), PL + 4, 34)
      doc.text(cleanPdfText(`${total} estudiantes · ${questions.length} preguntas · Exigencia: ${examPct}%`), PL + 4, 41)

      fillRect(doc, PL, 60, CW, 22, PALETTE.white, 4)
      strokeRect(doc, PL, 60, CW, 22, PALETTE.slate200, 4)
      setFont(doc, { bold: true, size: 10, color: PALETTE.slate900 })
      doc.text("Resumen ejecutivo", PL + 6, 69)
      setFont(doc, { size: 8.5, color: PALETTE.slate500 })
      doc.text(
        splitText(
          doc,
          `Este reporte sintetiza el desempeño global del curso, la distribución de notas, las preguntas con menor logro y los hallazgos pedagógicos principales para apoyar la toma de decisiones docentes.`,
          CW - 12,
        ),
        PL + 6,
        75,
      )

      y = 88
      const cardW = (CW - 8) / 3
      const cards = [
        ["Promedio del curso", avgGrade.toFixed(1), "Escala 1.0 a 7.0", PALETTE.indigo],
        ["Tasa de aprobación", `${passRate}%`, `${passCount} de ${total} aprobados`, PALETTE.emerald],
        ["Rendimiento general", perf.text, "Nivel global del curso", perf.color],
        ["Nota máxima", maxGrade.toFixed(1), truncate(topStudent?.student_name || "Sin registro", 26), PALETTE.blue],
        ["Nota mínima", minGrade.toFixed(1), truncate(needsSupportStudent?.student_name || "Sin registro", 26), PALETTE.red],
        ["Promedio de logro", `${Math.round(avgScore)}%`, `${reviewPending} pendientes de revisión`, PALETTE.amber],
      ] as const

      cards.forEach((card, i) => {
        const row = Math.floor(i / 3)
        const col = i % 3
        statCard(doc, PL + col * (cardW + 4), y + row * 28, cardW, 24, card[0], card[1], card[2], card[3])
      })

      y += 62
      fillRect(doc, PL, y, 74, 68, PALETTE.white, 4)
      strokeRect(doc, PL, y, 74, 68, PALETTE.slate200, 4)
      setFont(doc, { bold: true, size: 10, color: PALETTE.slate900 })
      doc.text("Distribución de notas", PL + 6, y + 8)
      const donutImg = drawDonut(dist.map((d) => ({ value: d.count, color: d.color })))
      if (donutImg) doc.addImage(donutImg, "PNG", PL + 4, y + 12, 42, 42)

      setFont(doc, { bold: true, size: 10, color: PALETTE.slate900 })
      doc.text(total > 0 ? `${Math.round(avgScore)}%` : "0%", PL + 51, y + 27)
      setFont(doc, { size: 7.5, color: PALETTE.slate500 })
      doc.text("Logro promedio", PL + 51, y + 32)

      dist.forEach((item, idx) => {
        const ly = y + 43 + idx * 5.5
        fillRect(doc, PL + 48, ly - 2.5, 4, 4, item.color, 1)
        setFont(doc, { size: 7.2, color: PALETTE.slate700 })
        doc.text(`${item.label}: ${item.count}`, PL + 55, ly)
      })

      fillRect(doc, PL + 78, y, CW - 78, 68, PALETTE.white, 4)
      strokeRect(doc, PL + 78, y, CW - 78, 68, PALETTE.slate200, 4)
      setFont(doc, { bold: true, size: 10, color: PALETTE.slate900 })
      doc.text("Indicadores clave", PL + 84, y + 8)

      const indicators = [
        { label: "Mejor estudiante", value: truncate(topStudent?.student_name || "Sin registro", 32), sub: topStudent ? `${safeNumber(topStudent.grade).toFixed(1)} de nota` : "-" },
        { label: "Mayor apoyo requerido", value: truncate(needsSupportStudent?.student_name || "Sin registro", 32), sub: needsSupportStudent ? `${safeNumber(needsSupportStudent.grade).toFixed(1)} de nota` : "-" },
        { label: "Incidentes registrados", value: `${incidents}`, sub: incidents > 0 ? "Revisar conducta de examen" : "Sin incidentes" },
      ]
      indicators.forEach((item, idx) => {
        const iy = y + 15 + idx * 16
        fillRect(doc, PL + 84, iy - 5.5, CW - 90, 12, PALETTE.slate100, 2.5)
        setFont(doc, { bold: true, size: 7.4, color: PALETTE.slate700 })
        doc.text(item.label.toUpperCase(), PL + 87, iy - 0.8)
        setFont(doc, { bold: true, size: 9.2, color: PALETTE.slate900 })
        doc.text(item.value, PL + 87, iy + 4.5)
        setFont(doc, { size: 7.1, color: PALETTE.slate500 })
        doc.text(item.sub, W - PR - 3, iy + 4.5, { align: "right" })
      })

      y += 76
      const weakest = qStats.slice(0, Math.min(5, qStats.length))
      fillRect(doc, PL, y, CW, 52, PALETTE.white, 4)
      strokeRect(doc, PL, y, CW, 52, PALETTE.slate200, 4)
      setFont(doc, { bold: true, size: 10, color: PALETTE.slate900 })
      doc.text("Preguntas con menor rendimiento", PL + 6, y + 8)
      setFont(doc, { size: 7.8, color: PALETTE.slate500 })
      doc.text("Estas preguntas requieren refuerzo o revisión metodológica.", PL + 6, y + 13)
      const barsImg = drawBars(
        weakest.map((q) => ({
          label: q.label,
          value: q.pct,
          max: 100,
          color: q.pct < 50 ? PALETTE.red : PALETTE.amber,
        })),
        520,
        150,
      )
      if (barsImg) doc.addImage(barsImg, "PNG", PL + 5, y + 16, CW - 10, 30)

      // Página 2
      doc.addPage()
      y = 0
      fillRect(doc, 0, 0, W, 18, PALETTE.navy)
      fillRect(doc, 0, 18, W, 6, PALETTE.blue)
      setFont(doc, { bold: true, size: 11, color: PALETTE.white })
      doc.text("ANÁLISIS PEDAGÓGICO DEL CURSO", PL, 11)
      y = 30

      const paragraphs: string[] = Array.isArray(analysis?.paragraphs) ? analysis.paragraphs.map(cleanPdfText) : []
      const sectionTitles = ["Análisis general", "Contenidos críticos", "Recomendaciones pedagógicas"]
      const sectionColors = [PALETTE.blue, PALETTE.amber, PALETTE.emerald]

      if (paragraphs.length > 0) {
        paragraphs.forEach((paragraph, idx) => {
          const lines = splitText(doc, paragraph, CW - 14)
          const sectionHeight = Math.max(30, 16 + lines.length * 4.8)
          if (y + sectionHeight > 274) {
            doc.addPage()
            fillRect(doc, 0, 0, W, 18, PALETTE.navy)
            fillRect(doc, 0, 18, W, 6, PALETTE.blue)
            setFont(doc, { bold: true, size: 11, color: PALETTE.white })
            doc.text("ANÁLISIS PEDAGÓGICO DEL CURSO", PL, 11)
            y = 30
          }

          fillRect(doc, PL, y, CW, sectionHeight, PALETTE.white, 4)
          strokeRect(doc, PL, y, CW, sectionHeight, PALETTE.slate200, 4)
          fillRect(doc, PL, y, 4, sectionHeight, sectionColors[idx] || PALETTE.indigo, 2)
          setFont(doc, { bold: true, size: 10, color: PALETTE.slate900 })
          doc.text(sectionTitles[idx] || `Sección ${idx + 1}`, PL + 8, y + 8)

          let ty = y + 15
          setFont(doc, { size: 8.7, color: PALETTE.slate700 })
          lines.forEach((line) => {
            doc.text(line, PL + 8, ty)
            ty += 4.8
          })
          y += sectionHeight + 8
        })
      } else {
        fillRect(doc, PL, y, CW, 26, PALETTE.white, 4)
        strokeRect(doc, PL, y, CW, 26, PALETTE.slate200, 4)
        setFont(doc, { bold: true, size: 10, color: PALETTE.slate900 })
        doc.text("Sin análisis disponible", PL + 8, y + 8)
        setFont(doc, { size: 8.7, color: PALETTE.slate500 })
        doc.text("No fue posible generar el análisis automático en esta ocasión.", PL + 8, y + 16)
        y += 34
      }

      const strongest = [...qStats].sort((a, b) => b.pct - a.pct).slice(0, 4)
      if (strongest.length > 0 && y < 230) {
        fillRect(doc, PL, y, CW, 44, PALETTE.white, 4)
        strokeRect(doc, PL, y, CW, 44, PALETTE.slate200, 4)
        setFont(doc, { bold: true, size: 10, color: PALETTE.slate900 })
        doc.text("Preguntas mejor logradas", PL + 8, y + 8)
        strongest.forEach((item, idx) => {
          const rowY = y + 14 + idx * 7.2
          setFont(doc, { size: 8, color: PALETTE.slate700 })
          doc.text(truncate(item.label, 58), PL + 8, rowY)
          drawProgressPill(doc, W - PR - 64, rowY - 3.3, 44, 4.5, item.pct, PALETTE.emerald)
          setFont(doc, { bold: true, size: 7.5, color: PALETTE.slate900 })
          doc.text(`${item.pct}%`, W - PR - 16, rowY + 0.2, { align: "right" })
        })
      }

      // Página 3
      doc.addPage()
      y = 0
      fillRect(doc, 0, 0, W, 18, PALETTE.navy)
      fillRect(doc, 0, 18, W, 6, PALETTE.blue)
      setFont(doc, { bold: true, size: 11, color: PALETTE.white })
      doc.text("REGISTRO COMPLETO DE EVALUACIONES", PL, 11)
      y = 30

      const cols = [
        { key: "n", label: "#", width: 7 },
        { key: "name", label: "Nombre", width: 43 },
        { key: "course", label: "Curso", width: 18 },
        { key: "rut", label: "RUT", width: 23 },
        { key: "corr", label: "Correc.", width: 16 },
        { key: "score", label: "Puntaje", width: 20 },
        { key: "pct", label: "%", width: 11 },
        { key: "grade", label: "Nota", width: 12 },
        { key: "rev", label: "Rev.", width: 10 },
      ]
      const rawTotalW = cols.reduce((acc, c) => acc + c.width, 0)
      const scale = CW / rawTotalW

      const drawTableHeader = () => {
        fillRect(doc, PL, y, CW, 8, PALETTE.slate900, 2)
        let cx = PL
        cols.forEach((col) => {
          setFont(doc, { bold: true, size: 7.3, color: PALETTE.white })
          doc.text(col.label, cx + 1.5, y + 5.2)
          cx += col.width * scale
        })
        y += 9
      }

      drawTableHeader()

      submissions.forEach((s, idx) => {
        if (y > 274) {
          doc.addPage()
          fillRect(doc, 0, 0, W, 18, PALETTE.navy)
          fillRect(doc, 0, 18, W, 6, PALETTE.blue)
          setFont(doc, { bold: true, size: 11, color: PALETTE.white })
          doc.text("REGISTRO COMPLETO DE EVALUACIONES", PL, 11)
          y = 30
          drawTableHeader()
        }

        const grade = safeNumber(s.grade)
        const rowBg = idx % 2 === 0 ? PALETTE.white : PALETTE.slate100
        fillRect(doc, PL, y, CW, 7, rowBg)
        strokeRect(doc, PL, y, CW, 7, PALETTE.slate200)

        const row = [
          String(idx + 1),
          truncate(s.student_name || "", 24),
          truncate(s.student_course || "", 11),
          truncate(s.student_rut || "-", 14),
          `${safeNumber(s.correct_count)}/${safeNumber(s.total_questions)}`,
          s.earned_points != null && s.total_points != null ? `${safeNumber(s.earned_points)}/${safeNumber(s.total_points)}` : "-",
          `${Math.round(safeNumber(s.score))}%`,
          grade.toFixed(1),
          s.manually_reviewed ? "SI" : "NO",
        ]

        let cx = PL
        row.forEach((value, valueIdx) => {
          const col = cols[valueIdx]
          if (valueIdx === 7) {
            setFont(doc, { bold: true, size: 7.5, color: gradeColor(grade) })
          } else if (valueIdx === 8) {
            setFont(doc, { bold: true, size: 7.2, color: s.manually_reviewed ? PALETTE.emerald : PALETTE.red })
          } else {
            setFont(doc, { size: 7.1, color: PALETTE.slate700 })
          }
          doc.text(cleanPdfText(value), cx + 1.5, y + 4.7)
          cx += col.width * scale
        })

        y += 7.4
      })

      const pageCount = doc.internal.getNumberOfPages()
      for (let p = 1; p <= pageCount; p += 1) {
        doc.setPage(p)
        addFooter(p, pageCount)
      }

      doc.save(`${cleanPdfText(exam?.title || "examen").replace(/\s+/g, "_")}_reporte.pdf`)
    } finally {
      setGeneratingPDF(false)
    }
  }

  async function exportXLSX() {
    setGeneratingXLSX(true)
    try {
      const [XLSXmod, analysis] = await Promise.all([import("xlsx"), getAnalysis()])
      const XLSX = XLSXmod
      const wb = XLSX.utils.book_new()

      const summary = [
        ["INFORME DE EVALUACIÓN - EduAI Platform"],
        [],
        ["Examen:", exam?.title || "-"],
        ["Tema:", exam?.topic || "-"],
        ["Código:", exam?.code || "-"],
        ["Fecha:", today],
        ["Exigencia:", `${examPct}%`],
        [],
        ["ESTADÍSTICAS DEL CURSO"],
        ["Total estudiantes", total],
        ["Promedio (1.0-7.0)", avgGrade.toFixed(2)],
        ["Nota máxima", maxGrade.toFixed(1)],
        ["Nota mínima", minGrade.toFixed(1)],
        ["Aprobados", passCount],
        ["Tasa aprobación", `${passRate}%`],
        ["Rendimiento general", perf.text],
        ["Pendientes de revisión", reviewPending],
        ["Incidentes", incidents],
        [],
        ["DISTRIBUCIÓN DE NOTAS"],
        ["Rango", "Cantidad", "Porcentaje"],
        ...dist.map((d) => [d.label, d.count, `${total > 0 ? Math.round((d.count / total) * 100) : 0}%`]),
        [],
        ["ANÁLISIS PEDAGÓGICO"],
        ...(Array.isArray(analysis?.paragraphs) && analysis.paragraphs.length > 0
          ? analysis.paragraphs.map((p: string, i: number) => [sectionTitlesForExcel(i), p])
          : [["Sin análisis", "No fue posible generar el análisis automático."]]),
      ]
      const ws1 = XLSX.utils.aoa_to_sheet(summary)
      ws1["!cols"] = [{ wch: 28 }, { wch: 90 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(wb, ws1, "Resumen")

      const headers = ["#", "Nombre", "Curso", "RUT", "Correctas", "Total preguntas", "Puntaje obtenido", "Puntaje total", "Porcentaje", "Nota", "Estado", "Revisado", "Incidentes", "Tiempo (min)", "Fecha"]
      const rows = submissions.map((s, i) => [
        i + 1,
        s.student_name || "",
        s.student_course || "",
        s.student_rut || "-",
        safeNumber(s.correct_count),
        safeNumber(s.total_questions),
        s.earned_points ?? "-",
        s.total_points ?? "-",
        `${Math.round(safeNumber(s.score))}%`,
        safeNumber(s.grade).toFixed(1),
        safeNumber(s.grade) >= 4 ? "Aprobado" : "Reprobado",
        s.manually_reviewed ? "Sí" : "No",
        safeNumber(s.incident_count),
        s.time_spent ? Math.round(s.time_spent / 60) : "-",
        s.submitted_at ? new Date(s.submitted_at).toLocaleString("es-CL") : "-",
      ])
      const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws2["!cols"] = [
        { wch: 5 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 10 },
        { wch: 14 }, { wch: 16 }, { wch: 13 }, { wch: 12 }, { wch: 8 },
        { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 20 },
      ]
      XLSX.utils.book_append_sheet(wb, ws2, "Notas por alumno")

      const qHeaders = ["Pregunta", "Tipo", "Habilidad", "% logro", "Clasificación"]
      const qRows = qStats.map((q) => [
        q.label,
        ({ multiple_choice: "Alternativas", true_false: "V/F", development: "Desarrollo" } as Record<string, string>)[q.type] ?? q.type,
        q.ability,
        `${q.pct}%`,
        q.pct >= 70 ? "Logrado" : q.pct >= 40 ? "Por mejorar" : "Crítico",
      ])
      const ws3 = XLSX.utils.aoa_to_sheet([qHeaders, ...qRows])
      ws3["!cols"] = [{ wch: 60 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(wb, ws3, "Rendimiento por pregunta")

      XLSX.writeFile(wb, `${cleanPdfText(exam?.title || "examen").replace(/\s+/g, "_")}_reporte.xlsx`)
    } finally {
      setGeneratingXLSX(false)
    }
  }

  function sectionTitlesForExcel(index: number) {
    return ["Análisis general", "Contenidos críticos", "Recomendaciones pedagógicas"][index] || `Sección ${index + 1}`
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={exportXLSX}
        disabled={generatingXLSX || submissions.length === 0}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}
        title="Descargar reporte Excel con resumen, notas y análisis por pregunta"
      >
        {generatingXLSX ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Generando...
          </>
        ) : (
          <>📊 Excel</>
        )}
      </button>

      <button
        onClick={exportPDF}
        disabled={generatingPDF || submissions.length === 0}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", boxShadow: "0 2px 8px rgba(239,68,68,0.3)" }}
        title="Descargar reporte PDF general con visual mejorada"
      >
        {generatingPDF ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Generando...
          </>
        ) : (
          <>📄 PDF Reporte</>
        )}
      </button>
    </div>
  )
}
