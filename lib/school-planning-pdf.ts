import jsPDF from "jspdf"

export interface SchoolPlanningPdfMeta {
  year: number
  periodLabel: string
  professor: string
  subject: string
  hours: string
  course: string
  establishment?: string
  city?: string
  baseCurricular?: string
  schedule?: Array<{ month: string; week: number }>
}

export interface SchoolPlanningPdfRow {
  week: string
  oa: string
  indicators: string
  objective: string
}

const PROVIDENCIA_LOGO = "data:image/png;base64,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"

const PEACH: [number, number, number] = [252, 228, 214]
const LILAC: [number, number, number] = [204, 192, 218]
const BLACK: [number, number, number] = [0, 0, 0]

function cleanCell(value: string) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/^[-*]\s+/gm, "• ")
    .trim()
}

function splitMarkdownRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cleanCell(cell))
}

export function parseSchoolPlanningRows(content: string): SchoolPlanningPdfRow[] {
  const lines = String(content || "").replace(/\r/g, "").split("\n")
  const headerIndex = lines.findIndex((line) => {
    const normalized = line.toUpperCase()
    return normalized.includes("SEMANA") && normalized.includes("INDICADORES") && normalized.includes("OBJETIVO")
  })
  if (headerIndex < 0) return []

  const rows: SchoolPlanningPdfRow[] = []
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line.startsWith("|")) {
      if (rows.length && line) break
      continue
    }
    if (/^\|?\s*:?-{2,}/.test(line)) continue
    const cells = splitMarkdownRow(line)
    if (cells.length < 4) continue
    rows.push({
      week: cells[0],
      oa: cells[1],
      indicators: cells[2],
      objective: cells[3],
    })
  }
  return rows
}

function wrapCell(doc: jsPDF, value: string, width: number) {
  const logicalLines = cleanCell(value).split("\n").filter((line) => line.trim().length > 0)
  const result: string[] = []
  for (const line of logicalLines.length ? logicalLines : [""]) {
    const wrapped = doc.splitTextToSize(line, width) as string[]
    result.push(...wrapped)
  }
  return result.length ? result : [""]
}

function drawCell(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  options: { bold?: boolean; center?: boolean; fill?: [number, number, number]; fontSize?: number } = {}
) {
  if (options.fill) {
    doc.setFillColor(...options.fill)
    doc.rect(x, y, width, height, "F")
  }
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.25)
  doc.rect(x, y, width, height)
  doc.setFont("helvetica", options.bold ? "bold" : "normal")
  doc.setFontSize(options.fontSize || 6.2)
  doc.setTextColor(...BLACK)

  const lines = wrapCell(doc, text, width - 3.4)
  const lineHeight = (options.fontSize || 6.2) * 0.43
  const totalTextHeight = Math.max(lineHeight, lines.length * lineHeight)
  const textY = options.center
    ? y + Math.max(lineHeight, (height - totalTextHeight) / 2 + lineHeight * 0.82)
    : y + 2.2 + lineHeight * 0.82
  if (options.center) {
    lines.forEach((line, index) => {
      doc.text(line, x + width / 2, textY + index * lineHeight, { align: "center" })
    })
  } else {
    doc.text(lines, x + 1.7, textY)
  }
}

function calculateRowHeight(doc: jsPDF, row: SchoolPlanningPdfRow, widths: number[]) {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.2)
  const values = [row.week, row.oa, row.indicators, row.objective]
  const lineCounts = values.map((value, index) => wrapCell(doc, value, widths[index] - 3.4).length)
  return Math.max(11, Math.max(...lineCounts) * 2.75 + 4.5)
}

function drawInstitutionHeader(doc: jsPDF, meta: SchoolPlanningPdfMeta, x: number, width: number) {
  try {
    doc.addImage(PROVIDENCIA_LOGO, "PNG", x + 4, 4.3, 14, 11.7)
  } catch {
    // Continue exporting if the browser cannot decode the embedded image.
  }
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...BLACK)
  doc.setFontSize(6.8)
  doc.text(meta.establishment || "Colegio Providencia", x + width / 2, 7.2, { align: "center" })
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.text((meta.city || "ANTOFAGASTA").toUpperCase(), x + width / 2, 11.2, { align: "center" })
}

function drawTableHeader(doc: jsPDF, meta: SchoolPlanningPdfMeta, x: number, y: number, width: number, widths: number[]) {
  const titleHeight = 7.2
  const periodHeight = 6.3
  const metaHeight = 6.4
  const colsHeight = 7.0

  drawCell(doc, x, y, width, titleHeight, `CRONOGRAMA ${meta.year}`, { bold: true, center: true, fontSize: 13.6 })
  y += titleHeight
  drawCell(doc, x, y, width, periodHeight, meta.periodLabel, { bold: true, center: true, fill: PEACH, fontSize: 11.3 })
  y += periodHeight

  const metaValues = [
    `PROFESOR: ${meta.professor || ""}`,
    `ASIGNATURA: ${meta.subject || ""}`,
    `HORAS: ${meta.hours || ""}`,
    `CURSO: ${meta.course || ""}`,
  ]
  let cursorX = x
  metaValues.forEach((value, index) => {
    drawCell(doc, cursorX, y, widths[index], metaHeight, value, { fontSize: 6.6 })
    cursorX += widths[index]
  })
  y += metaHeight

  const headers = ["SEMANA\nFECHA", "OA", "INDICADORES DE EVALUACIÓN", "OBJETIVO DE LA CLASE"]
  cursorX = x
  headers.forEach((value, index) => {
    drawCell(doc, cursorX, y, widths[index], colsHeight, value, { bold: true, center: true, fill: LILAC, fontSize: 7.0 })
    cursorX += widths[index]
  })

  return y + colsHeight
}

export async function exportSchoolPlanningPdf(meta: SchoolPlanningPdfMeta, content: string) {
  const rows = parseSchoolPlanningRows(content)
  if (!rows.length) throw new Error("La planificación no contiene la tabla institucional esperada.")

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 8
  const tableWidth = pageWidth - marginX * 2
  const widths = [tableWidth / 4, tableWidth / 4, tableWidth / 4, tableWidth / 4]

  drawInstitutionHeader(doc, meta, marginX, tableWidth)
  let y = drawTableHeader(doc, meta, marginX, 18.5, tableWidth, widths)

  rows.forEach((row, index) => {
    const height = calculateRowHeight(doc, row, widths)
    if (y + height > pageHeight - 10) {
      doc.addPage("a4", "landscape")
      y = 7
    }

    const scheduled = meta.schedule?.[index]
    const weekLabel = scheduled ? `${scheduled.week === 1 ? `${scheduled.month.charAt(0).toUpperCase() + scheduled.month.slice(1)}\n` : ""}${scheduled.week}` : row.week
    const values = [weekLabel, row.oa, row.indicators, row.objective]
    let cursorX = marginX
    values.forEach((value, colIndex) => {
      drawCell(doc, cursorX, y, widths[colIndex], height, value, {
        bold: colIndex === 0,
        center: colIndex === 0,
        fontSize: colIndex === 0 ? 6.6 : 6.1,
      })
      cursorX += widths[colIndex]
    })
    y += height

    if (index === rows.length - 1) {
      const base = meta.baseCurricular || `Base curricular utilizada: ${meta.subject} ${meta.course}, Currículum Nacional MINEDUC. Planificación organizada según los OA seleccionados para el período.`
      if (y + 6 > pageHeight - 5) {
        doc.addPage("a4", "landscape")
        y = 7
      }
      doc.setFont("helvetica", "italic")
      doc.setFontSize(5.4)
      doc.setTextColor(...BLACK)
      doc.text(doc.splitTextToSize(base, tableWidth), marginX, y + 3.2)
    }
  })

  const safe = `${meta.subject}-${meta.course}-${meta.year}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

  doc.save(`planificacion-${safe}.pdf`)
}
