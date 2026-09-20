import jsPDF from "jspdf"
import { parseParvulariaPlanningDocument, type ParvulariaPlanningRow } from "@/lib/parvularia-planning"

const PEACH: [number, number, number] = [251, 228, 213]
const BLACK: [number, number, number] = [0, 0, 0]

function clean(value: string) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .trim()
}

function wrap(doc: jsPDF, value: string, width: number, fontSize = 7.4) {
  doc.setFont("times", "normal")
  doc.setFontSize(fontSize)
  const out: string[] = []
  for (const logical of clean(value).split("\n")) {
    if (!logical.trim()) {
      out.push("")
      continue
    }
    const lines = doc.splitTextToSize(logical, Math.max(4, width)) as string[]
    out.push(...(lines.length ? lines : [""]))
  }
  return out.length ? out : [""]
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, fill?: [number, number, number]) {
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.25)
  if (fill) {
    doc.setFillColor(...fill)
    doc.rect(x, y, w, h, "FD")
  } else {
    doc.rect(x, y, w, h)
  }
}

function drawTextLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  options?: { bold?: boolean; center?: boolean; fontSize?: number }
) {
  doc.setFont("times", options?.bold ? "bold" : "normal")
  doc.setFontSize(options?.fontSize || 7.4)
  doc.setTextColor(...BLACK)
  lines.forEach((line, index) => {
    doc.text(line, options?.center ? x : x, y + index * lineHeight, options?.center ? { align: "center" } : undefined)
  })
}

function drawTitleAndMeta(doc: jsPDF, content: ReturnType<typeof parseParvulariaPlanningDocument>, margin: number, tableWidth: number) {
  let y = 12
  doc.setFont("times", "bold")
  doc.setFontSize(14)
  const title = clean(content.titulo) || "Planificación de Educación Parvularia"
  doc.text(title, margin + tableWidth / 2, y, { align: "center" })
  const titleWidth = doc.getTextWidth(title)
  doc.setLineWidth(0.3)
  doc.line(margin + tableWidth / 2 - titleWidth / 2, y + 1, margin + tableWidth / 2 + titleWidth / 2, y + 1)
  y += 8

  doc.setFontSize(9.5)
  const meta = [
    ["Nivel Educativo", content.nivelEducativo],
    ["Fechas", content.fechas],
    ["Educadora de Párvulos", content.educadoraParvulos],
    ["Asistentes de Párvulos", content.asistentesParvulos],
  ]
  for (const [label, value] of meta) {
    doc.setFont("times", "bold")
    doc.text(`${label}:`, margin, y)
    const labelWidth = doc.getTextWidth(`${label}: `)
    doc.setFont("times", "normal")
    doc.text(clean(value), margin + labelWidth, y)
    y += 4.5
  }
  y += 1.5

  const leftWidth = tableWidth * 0.35
  const rightWidth = tableWidth - leftWidth
  const summaryRows = [
    ["Objetivo de aprendizaje:", content.objetivoAprendizaje],
    ["Principio de Juego:", content.principioJuego],
    ["Principio de actividad:", content.principioActividad],
    ["Foco de experiencia:", content.focoExperiencia],
  ]

  for (const [label, value] of summaryRows) {
    const leftLines = wrap(doc, label, leftWidth - 4, 8.5)
    const rightLines = wrap(doc, value, rightWidth - 4, 8.5)
    const lineHeight = 3.5
    const height = Math.max(7, Math.max(leftLines.length, rightLines.length) * lineHeight + 3)
    drawRect(doc, margin, y, leftWidth, height, PEACH)
    drawRect(doc, margin + leftWidth, y, rightWidth, height)
    drawTextLines(doc, leftLines, margin + 2, y + 3.5, lineHeight, { bold: true, fontSize: 8.5 })
    drawTextLines(doc, rightLines, margin + leftWidth + 2, y + 3.5, lineHeight, { fontSize: 8.5 })
    y += height
  }

  return y
}

function mainWidths(total: number) {
  const ratios = [0.134, 0.134, 0.257, 0.157, 0.101, 0.085, 0.132]
  const widths = ratios.map((ratio) => total * ratio)
  const used = widths.reduce((sum, value) => sum + value, 0)
  widths[widths.length - 1] += total - used
  return widths
}

function drawMainHeader(doc: jsPDF, x: number, y: number, widths: number[]) {
  const labels = [
    "Ámbito\nNúcleo",
    "Objetivos de\nAprendizajes",
    "Experiencia de aprendizaje",
    "Orientaciones Relevantes",
    "Rol del equipo pedagógico y rol de la familia",
    "Recursos",
    "Evaluación",
  ]
  const height = 13
  let cursor = x
  labels.forEach((label, index) => {
    drawRect(doc, cursor, y, widths[index], height, PEACH)
    const lines = wrap(doc, label, widths[index] - 3, 7.4)
    const lineHeight = 3
    const block = lines.length * lineHeight
    drawTextLines(doc, lines, cursor + widths[index] / 2, y + (height - block) / 2 + 2.7, lineHeight, { bold: true, center: true, fontSize: 7.4 })
    cursor += widths[index]
  })
  return y + height
}

function rowValues(row: ParvulariaPlanningRow) {
  return [
    row.ambitoNucleo,
    row.objetivosAprendizajes,
    row.experienciaAprendizaje,
    row.orientacionesRelevantes,
    row.rolEquipoFamilia,
    row.recursos,
    row.evaluacion,
  ]
}

export async function exportParvulariaPlanningPdf(content: string) {
  const planning = parseParvulariaPlanningDocument(content)
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [355.6, 215.9] })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  const tableWidth = pageWidth - margin * 2
  const widths = mainWidths(tableWidth)
  const bottom = pageHeight - 9
  const lineHeight = 3
  const fontSize = 7.2

  let y = drawTitleAndMeta(doc, planning, margin, tableWidth)
  y = drawMainHeader(doc, margin, y, widths)

  const newContinuationPage = () => {
    doc.addPage([355.6, 215.9], "landscape")
    doc.setFont("times", "bold")
    doc.setFontSize(9)
    doc.text(planning.titulo, margin, 9)
    return drawMainHeader(doc, margin, 12, widths)
  }

  for (const row of planning.filas) {
    const values = rowValues(row)
    const linesByCell = values.map((value, index) => wrap(doc, value, widths[index] - 3.4, fontSize))
    const offsets = new Array(linesByCell.length).fill(0)

    while (offsets.some((offset, index) => offset < linesByCell[index].length)) {
      const remainingHeight = bottom - y
      const availableLines = Math.floor((remainingHeight - 4) / lineHeight)

      if (availableLines < 4) {
        y = newContinuationPage()
        continue
      }

      const chunks = linesByCell.map((lines, index) => lines.slice(offsets[index], offsets[index] + availableLines))
      const maxChunkLines = Math.max(1, ...chunks.map((chunk) => chunk.length))
      const rowHeight = Math.min(remainingHeight, maxChunkLines * lineHeight + 4)

      let cursorX = margin
      chunks.forEach((chunk, index) => {
        drawRect(doc, cursorX, y, widths[index], rowHeight)
        drawTextLines(doc, chunk, cursorX + 1.7, y + 3.2, lineHeight, { fontSize })
        offsets[index] += chunk.length
        cursorX += widths[index]
      })
      y += rowHeight

      if (offsets.some((offset, index) => offset < linesByCell[index].length)) {
        y = newContinuationPage()
      }
    }
  }

  const safe = (planning.titulo || "planificacion-parvularia")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 70)

  doc.save(`${safe || "planificacion-parvularia"}.pdf`)
}
