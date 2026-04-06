import jsPDF from "jspdf"

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
}

type RGB = [number, number, number]

const COLORS = {
  ink: [38, 46, 66] as RGB,
  muted: [101, 116, 139] as RGB,
  emerald: [16, 185, 129] as RGB,
  teal: [20, 184, 166] as RGB,
  cyan: [14, 165, 233] as RGB,
  slateBg: [248, 250, 252] as RGB,
  line: [226, 232, 240] as RGB,
  softGreen: [236, 253, 245] as RGB,
  softBlue: [239, 246, 255] as RGB,
  softAmber: [255, 251, 235] as RGB,
  white: [255, 255, 255] as RGB,
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
  return String(text || "").replace(/\*\*/g, "").replace(/__/g, "").trim()
}

function stripMarkdown(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .trim()
}

function justifyParagraph(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 6) {
  const clean = stripMarkdown(text)
  const lines = doc.splitTextToSize(clean, width) as string[]
  lines.forEach((line, idx) => {
    const words = line.trim().split(/\s+/).filter(Boolean)
    const isLast = idx === lines.length - 1 || words.length < 2

    if (isLast) {
      doc.text(line, x, y)
      y += lineHeight
      return
    }

    const lineWidth = doc.getTextWidth(line)
    const wordsWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0)
    const gaps = words.length - 1
    const extraSpace = gaps > 0 ? (width - wordsWidth) / gaps : 0
    let cursorX = x

    words.forEach((word, wordIdx) => {
      doc.text(word, cursorX, y)
      cursorX += doc.getTextWidth(word) + (wordIdx < gaps ? extraSpace : 0)
    })

    y += lineHeight
  })

  return y
}

function drawRoundedBox(doc: jsPDF, x: number, y: number, w: number, h: number, fill: RGB, border = COLORS.line) {
  setFill(doc, fill)
  setDraw(doc, border)
  doc.roundedRect(x, y, w, h, 5, 5, "FD")
}

function drawTag(doc: jsPDF, label: string, x: number, y: number, fill: RGB) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  const textWidth = doc.getTextWidth(label)
  drawRoundedBox(doc, x, y - 5, textWidth + 10, 8, fill, fill)
  setText(doc, COLORS.ink)
  doc.text(label, x + 5, y)
}

function ensurePage(doc: jsPDF, y: number, needed = 20) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed <= pageHeight - 14) return y
  doc.addPage()
  return 18
}

function parseBlocks(content: string) {
  const lines = content.replace(/\r/g, "").split("\n")
  const blocks: Array<{ type: string; text?: string; level?: number; rows?: string[][] }> = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

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
        const row = lines[i]
          .trim()
          .slice(1, -1)
          .split("|")
          .map((cell) => stripMarkdown(cell.trim()))
        rows.push(row)
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
      if (/^(#{1,6})\s+/.test(next) || /^\|.+\|$/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next)) {
        break
      }
      paragraph.push(next)
      i += 1
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") })
  }

  return blocks
}

function drawTable(doc: jsPDF, rows: string[][], x: number, y: number, width: number) {
  if (!rows.length) return y

  const colCount = Math.max(...rows.map((row) => row.length))
  const colWidth = width / Math.max(colCount, 1)
  let currentY = y

  rows.forEach((row, rowIndex) => {
    const normalized = [...row]
    while (normalized.length < colCount) normalized.push("")

    const heights = normalized.map((cell) => {
      doc.setFont("helvetica", rowIndex === 0 ? "bold" : "normal")
      doc.setFontSize(9)
      const lines = doc.splitTextToSize(stripMarkdown(cell), colWidth - 6) as string[]
      return Math.max(12, lines.length * 5 + 6)
    })

    const rowHeight = Math.max(...heights)
    currentY = ensurePage(doc, currentY, rowHeight + 6)

    normalized.forEach((cell, colIndex) => {
      const cellX = x + colIndex * colWidth
      const fill = rowIndex === 0 ? COLORS.softBlue : rowIndex % 2 === 0 ? COLORS.white : COLORS.slateBg
      drawRoundedBox(doc, cellX, currentY, colWidth - 1.5, rowHeight, fill)
      doc.setFont("helvetica", rowIndex === 0 ? "bold" : "normal")
      doc.setFontSize(9)
      setText(doc, rowIndex === 0 ? COLORS.ink : COLORS.muted)
      const lines = doc.splitTextToSize(stripMarkdown(cell), colWidth - 6) as string[]
      let lineY = currentY + 6
      lines.forEach((line) => {
        doc.text(line, cellX + 3, lineY)
        lineY += 4.6
      })
    })

    currentY += rowHeight + 2
  })

  return currentY + 2
}

export async function exportPlanningPdf(meta: PlanningPdfMeta, content: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const contentWidth = pageWidth - margin * 2
  let y = 16

  setFill(doc, COLORS.white)
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), "F")

  drawRoundedBox(doc, margin, y, contentWidth, 26, COLORS.slateBg)
  setFill(doc, COLORS.emerald)
  doc.roundedRect(margin, y, 5, 26, 3, 3, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  setText(doc, COLORS.ink)
  doc.text(safe(meta.title || "Planificación pedagógica"), margin + 10, y + 10)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  setText(doc, COLORS.muted)
  doc.text(safe(meta.subtitle || "Documento generado desde el planificador curricular"), margin + 10, y + 17)

  drawTag(doc, safe(meta.nivel || "Planificación"), pageWidth - margin - 35, y + 10, COLORS.softGreen)
  drawTag(doc, safe(meta.horizonte || "Aula"), pageWidth - margin - 35, y + 20, COLORS.softBlue)
  y += 34

  const cards = [
    { label: "Curso", value: meta.curso || "—", fill: COLORS.softBlue },
    { label: "Asignatura", value: meta.asignatura || "—", fill: COLORS.softGreen },
    { label: "Mes", value: meta.mes || "—", fill: COLORS.softAmber },
    {
      label: "Sesiones",
      value: `${meta.sesiones || 0} · ${meta.duracionMinutos || 0} min`,
      fill: COLORS.slateBg,
    },
  ]

  const cardGap = 4
  const cardW = (contentWidth - cardGap * 3) / 4
  cards.forEach((card, idx) => {
    const x = margin + idx * (cardW + cardGap)
    drawRoundedBox(doc, x, y, cardW, 18, card.fill)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    setText(doc, COLORS.muted)
    doc.text(card.label.toUpperCase(), x + 3, y + 5.5)
    doc.setFontSize(10)
    setText(doc, COLORS.ink)
    const lines = doc.splitTextToSize(safe(card.value), cardW - 6) as string[]
    doc.text(lines[0] || "—", x + 3, y + 11.5)
    if (lines[1]) doc.text(lines[1], x + 3, y + 16)
  })
  y += 24

  if (meta.contexto) {
    drawRoundedBox(doc, margin, y, contentWidth, 18, COLORS.white)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    setText(doc, COLORS.teal)
    doc.text("CONTEXTO PEDAGÓGICO", margin + 4, y + 6)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.5)
    setText(doc, COLORS.ink)
    y = justifyParagraph(doc, meta.contexto, margin + 4, y + 11, contentWidth - 8, 4.8)
    y += 3
  }

  const blocks = parseBlocks(content)

  blocks.forEach((block) => {
    y = ensurePage(doc, y, 18)

    if (block.type === "heading") {
      const level = block.level || 2
      const size = level === 1 ? 16 : level === 2 ? 13 : 11
      const fill = level <= 2 ? COLORS.softGreen : COLORS.softBlue
      const h = level <= 2 ? 11 : 9
      drawRoundedBox(doc, margin, y, contentWidth, h, fill)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(size)
      setText(doc, level <= 2 ? COLORS.ink : COLORS.teal)
      doc.text(stripMarkdown(block.text || ""), margin + 4, y + (level <= 2 ? 7 : 5.8))
      y += h + 4
      return
    }

    if (block.type === "paragraph") {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10.2)
      setText(doc, COLORS.ink)
      y = justifyParagraph(doc, block.text || "", margin, y, contentWidth, 5.3)
      y += 2
      return
    }

    if (block.type === "list") {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      setText(doc, COLORS.ink)
      ;(block.rows || []).forEach((row) => {
        y = ensurePage(doc, y, 10)
        setFill(doc, COLORS.emerald)
        doc.circle(margin + 2, y - 1.5, 0.8, "F")
        y = justifyParagraph(doc, stripMarkdown(row[0] || ""), margin + 5, y, contentWidth - 5, 5)
      })
      y += 1
      return
    }

    if (block.type === "table") {
      y = drawTable(doc, block.rows || [], margin, y, contentWidth)
    }
  })

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    const pageHeight = doc.internal.pageSize.getHeight()
    setDraw(doc, COLORS.line)
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    setText(doc, COLORS.muted)
    doc.text(`EduAI Platform · ${safe(meta.title)} · Página ${page} de ${totalPages}`, margin, pageHeight - 5.5)
    doc.text(safe(meta.fechaCreacion || new Date().toLocaleString("es-CL")), pageWidth - margin, pageHeight - 5.5, { align: "right" })
  }

  const fileName = `${safe(meta.title || "planificacion").toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, "-")}.pdf`
  doc.save(fileName)
}
