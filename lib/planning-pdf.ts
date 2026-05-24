import jsPDF from "jspdf"
import { getPdfDesignStyle, pdfDesignFooterLabel } from "@/lib/design-templates/pdf-style"

export interface PlanningPdfMeta {
  title: string
  subtitle?: string
  curso?: string
  asignatura?: string
  nivel?: string
  mes?: string
  horizonte?: string
  sesiones?: number
  duracionMinutos?: number
  fechaCreacion?: string
  contexto?: string
  designTemplateId?: string
}

type RGB = [number, number, number]

const COLORS = {
  ink: [15, 23, 42] as RGB,
  body: [30, 41, 59] as RGB,
  muted: [71, 85, 105] as RGB,
  softMuted: [100, 116, 139] as RGB,
  emerald: [5, 150, 105] as RGB,
  emeraldDark: [4, 120, 87] as RGB,
  teal: [13, 148, 136] as RGB,
  blue: [37, 99, 235] as RGB,
  amber: [180, 83, 9] as RGB,
  violet: [109, 40, 217] as RGB,
  white: [255, 255, 255] as RGB,
  page: [248, 250, 252] as RGB,
  line: [226, 232, 240] as RGB,
  slateBg: [241, 245, 249] as RGB,
  softGreen: [236, 253, 245] as RGB,
  softBlue: [239, 246, 255] as RGB,
  softAmber: [255, 251, 235] as RGB,
  softViolet: [245, 243, 255] as RGB,
} satisfies Record<string, RGB>

function setFill(doc: jsPDF, color: RGB) {
  doc.setFillColor(color[0], color[1], color[2])
}

function setDraw(doc: jsPDF, color: RGB) {
  doc.setDrawColor(color[0], color[1], color[2])
}

function setText(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2])
}

function safe(text?: string | null) {
  return String(text || "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function stripMarkdown(text: string) {
  return safe(
    text
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^>\s?/gm, "")
      .replace(/\[([^\]]+)\]\((.*?)\)/g, "$1")
  )
}

function drawRoundedBox(doc: jsPDF, x: number, y: number, w: number, h: number, fill: RGB, border = COLORS.line, radius = 5) {
  setFill(doc, fill)
  setDraw(doc, border)
  doc.roundedRect(x, y, w, h, radius, radius, "FD")
}

function ensurePage(doc: jsPDF, y: number, needed = 20) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed <= pageHeight - 16) return y
  doc.addPage()
  setFill(doc, COLORS.page)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), pageHeight, "F")
  return 18
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5, options?: { bold?: boolean; size?: number; color?: RGB }) {
  doc.setFont("helvetica", options?.bold ? "bold" : "normal")
  doc.setFontSize(options?.size || 10)
  setText(doc, options?.color || COLORS.body)
  const lines = doc.splitTextToSize(stripMarkdown(text), width) as string[]
  lines.forEach((line) => {
    y = ensurePage(doc, y, lineHeight + 3)
    doc.text(line, x, y)
    y += lineHeight
  })
  return y
}

function writeJustified(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5.2) {
  const clean = stripMarkdown(text)
  const lines = doc.splitTextToSize(clean, width) as string[]
  lines.forEach((line, idx) => {
    y = ensurePage(doc, y, lineHeight + 3)
    const words = line.trim().split(/\s+/).filter(Boolean)
    const isLast = idx === lines.length - 1 || words.length < 4

    if (isLast) {
      doc.text(line, x, y)
      y += lineHeight
      return
    }

    const wordsWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0)
    const gaps = words.length - 1
    const extraSpace = Math.max(1.6, (width - wordsWidth) / gaps)
    let cursorX = x

    words.forEach((word, wordIdx) => {
      doc.text(word, cursorX, y)
      cursorX += doc.getTextWidth(word) + (wordIdx < gaps ? extraSpace : 0)
    })
    y += lineHeight
  })

  return y
}

function parseBlocks(content: string) {
  const lines = content.replace(/\r/g, "").split("\n")
  const blocks: Array<{ type: "heading" | "paragraph" | "list" | "table"; text?: string; level?: number; rows?: string[][] }> = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() })
      i += 1
      continue
    }

    if (/^\|.+\|$/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        rows.push(
          lines[i]
            .trim()
            .slice(1, -1)
            .split("|")
            .map((cell) => stripMarkdown(cell.trim()))
        )
        i += 1
      }
      const filtered = rows.filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell)))
      if (filtered.length) blocks.push({ type: "table", rows: filtered })
      continue
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length) {
        const li = lines[i].trim()
        if (/^[-*]\s+/.test(li) || /^\d+\.\s+/.test(li)) {
          items.push(li.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
          i += 1
        } else if (!li) {
          i += 1
          break
        } else {
          break
        }
      }
      blocks.push({ type: "list", rows: items.map((item) => [item]) })
      continue
    }

    const paragraph: string[] = [line]
    i += 1
    while (i < lines.length) {
      const next = lines[i].trim()
      if (!next) {
        i += 1
        break
      }
      if (/^(#{1,6})\s+/.test(next) || /^\|.+\|$/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next)) break
      paragraph.push(next)
      i += 1
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") })
  }

  return blocks
}

function drawMetaCard(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, fill: RGB, accent: RGB) {
  drawRoundedBox(doc, x, y, w, 18, fill)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.8)
  setText(doc, accent)
  doc.text(label.toUpperCase(), x + 3, y + 5.2)
  doc.setFontSize(9.6)
  setText(doc, COLORS.body)
  const lines = doc.splitTextToSize(safe(value), w - 6) as string[]
  doc.text(lines.slice(0, 2), x + 3, y + 11)
}

function drawTable(doc: jsPDF, rows: string[][], x: number, y: number, width: number) {
  if (!rows.length) return y
  const colCount = Math.min(Math.max(...rows.map((row) => row.length)), 5)
  const colWidth = width / Math.max(colCount, 1)

  rows.forEach((row, rowIndex) => {
    const normalized = [...row].slice(0, colCount)
    while (normalized.length < colCount) normalized.push("")

    const heights = normalized.map((cell) => {
      doc.setFont("helvetica", rowIndex === 0 ? "bold" : "normal")
      doc.setFontSize(8.4)
      const lines = doc.splitTextToSize(stripMarkdown(cell), colWidth - 6) as string[]
      return Math.max(12, lines.length * 4.4 + 6)
    })

    const rowHeight = Math.max(...heights)
    y = ensurePage(doc, y, rowHeight + 6)

    normalized.forEach((cell, colIndex) => {
      const cellX = x + colIndex * colWidth
      const fill = rowIndex === 0 ? COLORS.softBlue : rowIndex % 2 === 0 ? COLORS.white : COLORS.page
      drawRoundedBox(doc, cellX, y, colWidth - 1.4, rowHeight, fill, COLORS.line, 3)
      doc.setFont("helvetica", rowIndex === 0 ? "bold" : "normal")
      doc.setFontSize(8.4)
      setText(doc, rowIndex === 0 ? COLORS.ink : COLORS.body)
      const lines = doc.splitTextToSize(stripMarkdown(cell), colWidth - 6) as string[]
      doc.text(lines, cellX + 3, y + 5.2)
    })

    y += rowHeight + 2
  })

  return y + 2
}

function drawFooter(doc: jsPDF, meta: PlanningPdfMeta, designLabel = "EduAI Platform") {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const totalPages = doc.getNumberOfPages()

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    setDraw(doc, COLORS.line)
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.6)
    setText(doc, COLORS.softMuted)
    const footerTitle = safe(meta.title).slice(0, 95)
    doc.text(`${designLabel} · ${footerTitle} · Página ${page} de ${totalPages}`, margin, pageHeight - 5.8)
    doc.text(safe(meta.fechaCreacion || new Date().toLocaleString("es-CL")), pageWidth - margin, pageHeight - 5.8, { align: "right" })
  }
}

function shouldSkipDuplicate(blockText: string | undefined, meta: PlanningPdfMeta, index: number) {
  if (index > 2 || !blockText) return false
  const a = safe(blockText).toLowerCase()
  const b = safe(meta.title).toLowerCase()
  return Boolean(a && b && (a === b || b.includes(a) || a.includes(b)))
}

export async function exportPlanningPdf(meta: PlanningPdfMeta, content: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2
  let y = 14
  const design = getPdfDesignStyle(meta.designTemplateId, "planning")

  setFill(doc, design.background)
  doc.rect(0, 0, pageWidth, pageHeight, "F")

  drawRoundedBox(doc, margin, y, contentWidth, 34, design.surface, design.line, 6)
  setFill(doc, design.primary)
  doc.roundedRect(margin, y, 5, 34, 3, 3, "F")
  if (design.template.export.useDecorations) {
    setFill(doc, design.softAccent)
    doc.circle(pageWidth - 28, y + 8, 13, "F")
    setFill(doc, design.softSecondary)
    doc.circle(pageWidth - 48, y + 25, 6, "F")
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(17)
  setText(doc, design.text)
  const titleLines = doc.splitTextToSize(safe(meta.title || "Planificación pedagógica"), contentWidth - 28) as string[]
  doc.text(titleLines.slice(0, 2), margin + 10, y + 10)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.4)
  setText(doc, design.muted)
  doc.text(safe(meta.subtitle || `Documento generado con plantilla ${design.template.shortName}`), margin + 10, y + 25)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.6)
  setText(doc, design.primary)
  doc.text(safe(design.template.name), pageWidth - margin - 4, y + 29, { align: "right" })
  y += 42

  const cardGap = 4
  const cardW = (contentWidth - cardGap * 3) / 4
  drawMetaCard(doc, margin, y, cardW, "Curso", meta.curso || "-", design.softPrimary, design.primary)
  drawMetaCard(doc, margin + cardW + cardGap, y, cardW, "Asignatura", meta.asignatura || "-", design.softSecondary, design.secondary)
  drawMetaCard(doc, margin + (cardW + cardGap) * 2, y, cardW, "Mes", meta.mes || "-", design.softAccent, design.accent)
  drawMetaCard(doc, margin + (cardW + cardGap) * 3, y, cardW, "Sesiones", `${meta.sesiones || 1} · ${meta.duracionMinutos || 45} min`, COLORS.softViolet, design.primary)
  y += 25

  if (meta.contexto) {
    const contextLines = doc.splitTextToSize(stripMarkdown(meta.contexto), contentWidth - 8) as string[]
    const boxHeight = Math.min(32, Math.max(18, 11 + contextLines.slice(0, 4).length * 4.8))
    drawRoundedBox(doc, margin, y, contentWidth, boxHeight, COLORS.white, COLORS.line, 5)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9.6)
    setText(doc, design.primary)
    doc.text("CONTEXTO PEDAGOGICO", margin + 4, y + 6)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.4)
    setText(doc, COLORS.body)
    doc.text(contextLines.slice(0, 4), margin + 4, y + 12)
    y += boxHeight + 8
  }

  const blocks = parseBlocks(content)

  blocks.forEach((block, index) => {
    if (shouldSkipDuplicate(block.text, meta, index)) return
    y = ensurePage(doc, y, 18)

    if (block.type === "heading") {
      const level = block.level || 2
      const isMajor = level <= 2
      const fill = isMajor ? COLORS.softGreen : COLORS.softBlue
      const accent = isMajor ? COLORS.emeraldDark : COLORS.blue
      const text = stripMarkdown(block.text || "")
      const lines = doc.splitTextToSize(text, contentWidth - 8) as string[]
      const h = Math.max(isMajor ? 11 : 9, lines.length * 5 + 6)
      y = ensurePage(doc, y, h + 5)
      drawRoundedBox(doc, margin, y, contentWidth, h, fill, COLORS.line, 4)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(isMajor ? 12.5 : 10.5)
      setText(doc, isMajor ? COLORS.ink : accent)
      doc.text(lines, margin + 4, y + 6)
      y += h + 4
      return
    }

    if (block.type === "paragraph") {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9.8)
      setText(doc, COLORS.body)
      y = writeJustified(doc, block.text || "", margin, y, contentWidth, 5.1)
      y += 2
      return
    }

    if (block.type === "list") {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9.8)
      setText(doc, COLORS.body)
      ;(block.rows || []).forEach((row) => {
        y = ensurePage(doc, y, 10)
        setFill(doc, design.primary)
        doc.circle(margin + 2.2, y - 1.6, 0.85, "F")
        y = writeWrapped(doc, stripMarkdown(row[0] || ""), margin + 6, y, contentWidth - 6, 5.1, { size: 9.8, color: COLORS.body })
      })
      y += 1
      return
    }

    if (block.type === "table") {
      y = drawTable(doc, block.rows || [], margin, y, contentWidth)
    }
  })

  drawFooter(doc, meta, pdfDesignFooterLabel(design))

  const fileName = `${safe(meta.title || "planificacion").toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, "-")}.pdf`
  doc.save(fileName)
}
