"use client"

import { useState } from "react"

// ─── Paleta de colores del reporte ────────────────────────────────────────────
const PALETTE = {
  primary:   [30,  64, 175],   // azul oscuro
  accent:    [99, 102, 241],   // indigo
  success:   [16, 185, 129],   // verde
  warning:   [245, 158, 11],   // ámbar
  danger:    [239, 68,  68],   // rojo
  text:      [15,  23,  42],   // slate-900
  textMuted: [100, 116, 139],  // slate-500
  bg:        [248, 250, 252],  // slate-50
  white:     [255, 255, 255],
  donut: [
    [99, 102, 241],   // 7-6
    [16, 185, 129],   // 5-6
    [245, 158, 11],   // 4-5
    [239, 68,  68],   // <4
  ],
}

const rgb = (c: number[]) => `rgb(${c.join(",")})`

// ─── Canvas donut chart (genera base64) ──────────────────────────────────────
function drawDonut(
  slices: { value: number; color: number[] }[],
  size = 200,
  hole = 0.62
): string {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const cx = size / 2, cy = size / 2, r = (size / 2) - 4

  const total = slices.reduce((a, s) => a + s.value, 0) || 1
  let start = -Math.PI / 2

  // Sombra sutil
  ctx.shadowColor = "rgba(0,0,0,0.10)"
  ctx.shadowBlur  = 8

  slices.forEach(sl => {
    if (sl.value === 0) return
    const sweep = (sl.value / total) * 2 * Math.PI
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, start, start + sweep)
    ctx.closePath()
    ctx.fillStyle = rgb(sl.color)
    ctx.fill()
    start += sweep
  })

  // Agujero interior
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.arc(cx, cy, r * hole, 0, 2 * Math.PI)
  ctx.fillStyle = rgb(PALETTE.white)
  ctx.fill()

  return canvas.toDataURL("image/png")
}

// ─── Canvas bar chart horizontal ─────────────────────────────────────────────
function drawBars(
  items: { label: string; value: number; max: number; color: number[] }[],
  w = 360, h = 160
): string {
  const canvas = document.createElement("canvas")
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext("2d")!
  const barH = Math.min(22, (h - 10) / items.length - 6)
  const labelW = 120, gap = 4, maxBarW = w - labelW - 50

  ctx.font = "11px system-ui, sans-serif"
  items.forEach((item, i) => {
    const y = 10 + i * (barH + gap + 4)
    // Label
    ctx.fillStyle = rgb(PALETTE.textMuted)
    ctx.textAlign = "left"
    const label = item.label.length > 22 ? item.label.slice(0, 21) + "…" : item.label
    ctx.fillText(label, 0, y + barH - 4)
    // Fondo barra
    ctx.fillStyle = "rgba(226,232,240,0.5)"
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(labelW, y, maxBarW, barH, 4)
    else ctx.rect(labelW, y, maxBarW, barH)
    ctx.fill()
    // Barra de valor
    const barW = Math.max(4, (item.value / item.max) * maxBarW)
    const grad = ctx.createLinearGradient(labelW, 0, labelW + barW, 0)
    grad.addColorStop(0, rgb(item.color))
    grad.addColorStop(1, `rgba(${item.color.join(",")},0.7)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(labelW, y, barW, barH, 4)
    else ctx.rect(labelW, y, barW, barH)
    ctx.fill()
    // Valor
    ctx.fillStyle = rgb(PALETTE.text)
    ctx.textAlign = "left"
    ctx.fillText(`${item.value}%`, labelW + barW + 6, y + barH - 4)
  })
  return canvas.toDataURL("image/png")
}

// ─── Helpers jsPDF ───────────────────────────────────────────────────────────
function setFont(doc: any, bold = false, size = 10, color = PALETTE.text) {
  doc.setFont("helvetica", bold ? "bold" : "normal")
  doc.setFontSize(size)
  doc.setTextColor(...color)
}

function fillRect(doc: any, x: number, y: number, w: number, h: number, color: number[], r = 0) {
  doc.setFillColor(...color)
  if (r > 0 && doc.roundedRect) doc.roundedRect(x, y, w, h, r, r, "F")
  else doc.rect(x, y, w, h, "F")
}

function splitText(doc: any, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text, maxW)
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ReportExporter({
  exam, submissions,
}: {
  exam: any
  submissions: any[]
}) {
  const [generatingPDF,   setGeneratingPDF]   = useState(false)
  const [generatingXLSX,  setGeneratingXLSX]  = useState(false)
  const [analysisCache,   setAnalysisCache]   = useState<any>(null)

  // ── Obtener análisis IA (con cache) ─────────────────────────────────────
  async function getAnalysis() {
    if (analysisCache) return analysisCache
    const res  = await fetch("/api/exam-report", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ exam, submissions }),
    })
    const data = await res.json()
    if (data.success) { setAnalysisCache(data.analysis); return data.analysis }
    return null
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const total     = submissions.length
  const avgGrade  = total > 0 ? submissions.reduce((a, s) => a + s.grade, 0) / total : 0
  const avgScore  = total > 0 ? submissions.reduce((a, s) => a + s.score, 0) / total : 0
  const passCount = submissions.filter(s => s.grade >= 4.0).length
  const maxGrade  = total > 0 ? Math.max(...submissions.map(s => s.grade)) : 0
  const minGrade  = total > 0 ? Math.min(...submissions.map(s => s.grade)) : 0
  const passRate  = total > 0 ? Math.round((passCount / total) * 100) : 0
  const dist = [
    { label: "7.0 – 6.0", count: submissions.filter(s => s.grade >= 6.0).length, color: PALETTE.donut[0] },
    { label: "5.9 – 5.0", count: submissions.filter(s => s.grade >= 5.0 && s.grade < 6.0).length, color: PALETTE.donut[1] },
    { label: "4.9 – 4.0", count: submissions.filter(s => s.grade >= 4.0 && s.grade < 5.0).length, color: PALETTE.donut[2] },
    { label: "< 4.0",     count: submissions.filter(s => s.grade < 4.0).length,  color: PALETTE.donut[3] },
  ]
  const levelLabel = avgGrade >= 5.5 ? "ALTO" : avgGrade >= 4.0 ? "MEDIO" : "BAJO"
  const levelColor = avgGrade >= 5.5 ? PALETTE.success : avgGrade >= 4.0 ? PALETTE.warning : PALETTE.danger

  // ── Análisis de preguntas ────────────────────────────────────────────────
  const questions: any[] = exam?.questions || []
  const qStats = questions.map((q: any, qi: number) => {
    const maxPts = q.maxPoints || 1; let earned = 0; let count = 0
    submissions.forEach(s => {
      const a = s.answers?.[qi]; if (!a) return; count++
      if (a.type === "multiple_choice") earned += a.isCorrect ? maxPts : 0
      else if (a.type === "true_false") { if (a.selectionCorrect) earned += a.selectionPoints || 1; earned += Math.min(a.justificationMaxPoints || 0, a.justificationScore || 0) }
      else earned += Math.min(maxPts, a.manualScore ?? a.aiScore ?? 0)
    })
    return { label: `P${qi+1}: ${q.question?.slice(0,35)}…`, pct: count > 0 ? Math.round((earned/count/maxPts)*100) : 0, type: q.type }
  }).sort((a, b) => a.pct - b.pct)

  const today = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })

  // ════════════════════════════════════════════════════════════════════════
  // PDF REPORT
  // ════════════════════════════════════════════════════════════════════════
  async function exportPDF() {
    setGeneratingPDF(true)
    try {
      const [{ jsPDF }, analysis] = await Promise.all([
        import("jspdf"),
        getAnalysis(),
      ])

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const W = 210, PL = 16, PR = 16, CW = W - PL - PR
      let y = 0

      // ── PÁGINA 1: Portada + resumen ──────────────────────────────────────

      // Header degradado
      fillRect(doc, 0, 0, W, 52, PALETTE.primary)
      // Acento lateral izquierdo
      fillRect(doc, 0, 0, 5, 52, PALETTE.accent)
      // Título del examen
      setFont(doc, true, 20, PALETTE.white)
      doc.text(doc.splitTextToSize(exam.title || "Informe de Evaluación", CW - 10), PL + 6, 20)
      setFont(doc, false, 10, [180, 200, 255])
      doc.text(`${exam.topic || ""}  ·  ${today}  ·  Código: ${exam.code || "—"}`, PL + 6, 35)
      setFont(doc, false, 9, [150, 170, 230])
      doc.text(`${total} estudiante${total !== 1 ? "s" : ""}  ·  ${questions.length} pregunta${questions.length !== 1 ? "s" : ""}  ·  Exigencia: ${exam.settings?.examPercentage || 60}%`, PL + 6, 43)

      y = 62

      // ── Tarjetas de estadísticas (2 filas × 3) ────────────────────────
      const cards = [
        { label: "Promedio del curso", value: avgGrade.toFixed(1), sub: "Escala 1.0 – 7.0", color: PALETTE.accent },
        { label: "Tasa de aprobación", value: `${passRate}%`, sub: `${passCount} de ${total} aprobados`, color: PALETTE.success },
        { label: "Rendimiento",        value: levelLabel, sub: "Nivel general del curso", color: levelColor },
        { label: "Nota máxima",        value: maxGrade.toFixed(1), sub: "Mejor desempeño", color: PALETTE.primary },
        { label: "Nota mínima",        value: minGrade.toFixed(1), sub: "Desempeño más bajo", color: PALETTE.danger },
        { label: "Promedio %",         value: `${Math.round(avgScore)}%`, sub: "Porcentaje de logro", color: PALETTE.warning },
      ]
      const cW = (CW - 8) / 3
      cards.forEach((card, i) => {
        const col = i % 3, row = Math.floor(i / 3)
        const cx = PL + col * (cW + 4), cy = y + row * 26
        fillRect(doc, cx, cy, cW, 22, PALETTE.bg, 3)
        // Línea de acento izquierda
        fillRect(doc, cx, cy, 3, 22, card.color, 1.5)
        setFont(doc, true, 14, card.color)
        doc.text(card.value, cx + 8, cy + 13)
        setFont(doc, true, 7, PALETTE.text)
        doc.text(card.label.toUpperCase(), cx + 8, cy + 6)
        setFont(doc, false, 7, PALETTE.textMuted)
        doc.text(card.sub, cx + 8, cy + 19)
      })

      y += 58

      // ── Gráfico donut + tabla distribución ───────────────────────────
      const donutImg = drawDonut(dist.map(d => ({ value: d.count, color: d.color })), 180)
      doc.addImage(donutImg, "PNG", PL, y, 52, 52)

      // Leyenda al lado del donut
      setFont(doc, true, 9, PALETTE.text)
      doc.text("Distribución de notas", PL + 58, y + 6)
      dist.forEach((d, i) => {
        const ly = y + 14 + i * 9
        fillRect(doc, PL + 58, ly - 3.5, 5, 5, d.color, 1)
        setFont(doc, true, 9, PALETTE.text)
        doc.text(d.label, PL + 66, ly)
        setFont(doc, false, 9, PALETTE.textMuted)
        doc.text(`${d.count} alumn${d.count !== 1 ? "os" : "o"} (${total > 0 ? Math.round(d.count/total*100) : 0}%)`, PL + 90, ly)
      })

      y += 60

      // ── Gráfico de barras: rendimiento por pregunta ───────────────────
      const worst5 = qStats.slice(0, Math.min(5, qStats.length))
      if (worst5.length > 0) {
        setFont(doc, true, 9, PALETTE.text)
        doc.text("Preguntas con menor rendimiento", PL, y + 5)
        const barsImg = drawBars(
          worst5.map(q => ({ label: q.label, value: q.pct, max: 100, color: q.pct < 50 ? PALETTE.danger : PALETTE.warning })),
          380, worst5.length * 28 + 10
        )
        const bH = Math.min(45, worst5.length * 9 + 6)
        doc.addImage(barsImg, "PNG", PL, y + 8, CW, bH)
        y += bH + 16
      }

      // ── PÁGINA 2: Análisis + tabla de notas ─────────────────────────
      doc.addPage()
      y = 16

      // Sub-header
      fillRect(doc, 0, 0, W, 14, PALETTE.primary)
      setFont(doc, true, 10, PALETTE.white)
      doc.text("ANÁLISIS PEDAGÓGICO DEL CURSO", PL + 6, 9)
      y = 22

      if (analysis?.paragraphs?.length > 0) {
        const titles = ["Análisis General", "Contenidos Críticos", "Recomendaciones Pedagógicas"]
        const icons  = ["📊", "⚠️", "✅"]
        analysis.paragraphs.forEach((para: string, pi: number) => {
          if (y > 250) { doc.addPage(); y = 16 }
          // Título de sección
          fillRect(doc, PL, y, CW, 8, [...PALETTE.accent.map(c => c), 0.08] as any, 2)
          fillRect(doc, PL, y, 3, 8, PALETTE.accent, 1)
          setFont(doc, true, 9, PALETTE.accent)
          doc.text(`${icons[pi] || ""} ${titles[pi] || `Sección ${pi+1}`}`, PL + 6, y + 5.5)
          y += 12

          setFont(doc, false, 9, PALETTE.text)
          const lines = splitText(doc, para, CW)
          // Justificado visual (espaciado extra)
          lines.forEach((line: string) => {
            doc.text(line, PL, y, { align: "justify", maxWidth: CW })
            y += 5.5
          })
          y += 6
        })
      } else {
        setFont(doc, false, 9, PALETTE.textMuted)
        doc.text("No se pudo generar el análisis automático.", PL, y)
        y += 10
      }

      // ── PÁGINA 3: Tabla completa de estudiantes ───────────────────────
      doc.addPage()
      y = 0

      // Header
      fillRect(doc, 0, 0, W, 14, PALETTE.primary)
      setFont(doc, true, 10, PALETTE.white)
      doc.text("REGISTRO COMPLETO DE EVALUACIONES", PL + 6, 9)
      y = 20

      // Tabla
      const cols = [
        { h: "#",       w: 8  },
        { h: "Nombre",  w: 46 },
        { h: "Curso",   w: 24 },
        { h: "RUT",     w: 24 },
        { h: "Correc.", w: 18 },
        { h: "Puntaje", w: 20 },
        { h: "%",       w: 14 },
        { h: "Nota",    w: 14 },
        { h: "Rev.",    w: 10 },
      ]
      const totalW = cols.reduce((a, c) => a + c.w, 0)
      const scale  = CW / totalW

      // Header de tabla
      fillRect(doc, PL, y, CW, 7, PALETTE.primary)
      let cx = PL
      setFont(doc, true, 7, PALETTE.white)
      cols.forEach(col => {
        doc.text(col.h, cx + 1.5, y + 5)
        cx += col.w * scale
      })
      y += 7

      submissions.forEach((s, idx) => {
        if (y > 270) {
          doc.addPage()
          y = 16
          fillRect(doc, PL, y, CW, 7, PALETTE.primary)
          cx = PL
          setFont(doc, true, 7, PALETTE.white)
          cols.forEach(col => { doc.text(col.h, cx + 1.5, y + 5); cx += col.w * scale })
          y += 7
        }
        const isEven   = idx % 2 === 0
        const isPassed = s.grade >= 4.0
        fillRect(doc, PL, y, CW, 6.5, isEven ? PALETTE.bg : PALETTE.white)
        cx = PL
        const row = [
          String(idx + 1),
          (s.student_name || "").slice(0, 22),
          (s.student_course || "").slice(0, 12),
          s.student_rut || "—",
          `${s.correct_count}/${s.total_questions}`,
          s.earned_points != null ? `${s.earned_points}/${s.total_points}` : "—",
          `${Math.round(s.score)}%`,
          String(s.grade),
          s.manually_reviewed ? "✓" : "—",
        ]
        row.forEach((val, vi) => {
          const col = cols[vi]
          if (vi === 7) {
            // Nota con color
            const noteColor = s.grade >= 6 ? PALETTE.success : s.grade >= 4 ? PALETTE.primary : PALETTE.danger
            setFont(doc, true, 7, noteColor)
          } else {
            setFont(doc, false, 7, PALETTE.text)
          }
          doc.text(val, cx + 1.5, y + 4.5)
          cx += col.w * scale
        })
        y += 6.5
      })

      // Footer en todas las páginas
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        fillRect(doc, 0, 287, W, 10, PALETTE.primary)
        setFont(doc, false, 7, [180, 200, 255])
        doc.text(`${exam.title} · EduAI Platform · Generado el ${today}`, PL, 293)
        doc.text(`Página ${p} de ${pageCount}`, W - PR, 293, { align: "right" })
      }

      doc.save(`${(exam.title || "examen").replace(/\s+/g, "_")}_reporte.pdf`)
    } finally {
      setGeneratingPDF(false)
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // EXCEL REPORT
  // ════════════════════════════════════════════════════════════════════════
  async function exportXLSX() {
    setGeneratingXLSX(true)
    try {
      const [XLSXmod, analysis] = await Promise.all([
        import("xlsx"),
        getAnalysis(),
      ])
      const XLSX = XLSXmod

      const wb = XLSX.utils.book_new()

      // ── Hoja 1: Resumen general ──────────────────────────────────────
      const summary = [
        ["INFORME DE EVALUACIÓN — EduAI Platform"],
        [],
        ["Examen:",     exam.title],
        ["Tema:",       exam.topic],
        ["Código:",     exam.code],
        ["Fecha:",      today],
        ["Exigencia:",  `${exam.settings?.examPercentage || 60}%`],
        [],
        ["ESTADÍSTICAS DEL CURSO"],
        ["Total alumnos",       total],
        ["Promedio (1.0-7.0)",  avgGrade.toFixed(2)],
        ["Nota máxima",         maxGrade],
        ["Nota mínima",         minGrade],
        ["Aprobados",           passCount],
        ["Reprobados",          total - passCount],
        ["Tasa aprobación",     `${passRate}%`],
        ["Nivel rendimiento",   levelLabel],
        [],
        ["DISTRIBUCIÓN DE NOTAS"],
        ["Rango",   "Cantidad", "Porcentaje"],
        ...dist.map(d => [d.label, d.count, `${total > 0 ? Math.round(d.count/total*100) : 0}%`]),
        [],
        ["ANÁLISIS PEDAGÓGICO"],
        ...(analysis?.paragraphs?.length > 0
          ? analysis.paragraphs.map((p: string, i: number) => [
              ["Análisis General", "Contenidos Críticos", "Recomendaciones"][i] || `Sección ${i+1}`,
              p
            ])
          : [["Sin análisis", "No se pudo generar el análisis automático."]]),
      ]
      const ws1 = XLSX.utils.aoa_to_sheet(summary)
      ws1["!cols"] = [{ wch: 30 }, { wch: 80 }]
      XLSX.utils.book_append_sheet(wb, ws1, "Resumen")

      // ── Hoja 2: Resultados individuales ─────────────────────────────
      const headers = ["#", "Nombre", "Curso", "RUT", "Correctas", "Total Preguntas", "Puntaje Obtenido", "Puntaje Total", "Porcentaje", "Nota", "Estado", "Revisado", "Incidentes", "Tiempo (min)", "Fecha"]
      const rows = submissions.map((s, i) => [
        i + 1,
        s.student_name,
        s.student_course,
        s.student_rut || "—",
        s.correct_count,
        s.total_questions,
        s.earned_points ?? "—",
        s.total_points ?? "—",
        `${Math.round(s.score)}%`,
        s.grade,
        s.grade >= 4.0 ? "Aprobado" : "Reprobado",
        s.manually_reviewed ? "Sí" : "No",
        s.incident_count ?? 0,
        s.time_spent ? Math.round(s.time_spent / 60) : "—",
        new Date(s.submitted_at).toLocaleString("es-CL"),
      ])
      const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws2["!cols"] = [
        { wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 14 },
        { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
        { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 },
        { wch: 12 }, { wch: 14 }, { wch: 20 },
      ]
      XLSX.utils.book_append_sheet(wb, ws2, "Notas por alumno")

      // ── Hoja 3: Análisis por pregunta ────────────────────────────────
      const qHeaders = ["Pregunta", "Tipo", "Habilidad", "% Logro", "Clasificación"]
      const qRows = qStats.map(q => [
        q.label.replace(/…$/, ""),
        (({ multiple_choice: "Alternativas", true_false: "V/F", development: "Desarrollo" } as Record<string, string>)[q.type] ?? q.type),
        questions[parseInt(q.label.split(":")[0].slice(1)) - 1]?.ability || "—",
        `${q.pct}%`,
        q.pct >= 70 ? "Logrado" : q.pct >= 40 ? "Por mejorar" : "No logrado",
      ])
      const ws3 = XLSX.utils.aoa_to_sheet([qHeaders, ...qRows])
      ws3["!cols"] = [{ wch: 60 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(wb, ws3, "Rendimiento por pregunta")

      XLSX.writeFile(wb, `${(exam.title || "examen").replace(/\s+/g, "_")}_reporte.xlsx`)
    } finally {
      setGeneratingXLSX(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={exportXLSX}
        disabled={generatingXLSX || submissions.length === 0}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}
        title="Descargar reporte Excel con 3 hojas: resumen, notas y análisis por pregunta"
      >
        {generatingXLSX
          ? <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" /> Generando...</>
          : <>📊 Excel</>
        }
      </button>
      <button
        onClick={exportPDF}
        disabled={generatingPDF || submissions.length === 0}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", boxShadow: "0 2px 8px rgba(239,68,68,0.3)" }}
        title="Descargar reporte PDF Canva con análisis IA, gráficas y tabla completa"
      >
        {generatingPDF
          ? <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" /> Generando...</>
          : <>📄 PDF Reporte</>
        }
      </button>
    </div>
  )
}
