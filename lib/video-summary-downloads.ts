function cleanText(value: unknown) {
  return String(value || "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").trim()
  const full = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized.padEnd(6, "0").slice(0, 6)
  return [
    Number.parseInt(full.slice(0, 2), 16) || 239,
    Number.parseInt(full.slice(2, 4), 16) || 68,
    Number.parseInt(full.slice(4, 6), 16) || 68,
  ]
}

export async function downloadVideoSummaryAsPDF(data: any, fileName: string, accentColor = "#ef4444") {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 17
  const contentWidth = pageWidth - margin * 2
  const accent = hexToRgb(accentColor)
  let y = 0

  const paintBackground = () => {
    pdf.setFillColor(248, 250, 252)
    pdf.rect(0, 0, pageWidth, pageHeight, "F")
  }

  const addPage = () => {
    pdf.addPage()
    paintBackground()
    y = margin
  }

  const ensureSpace = (height = 18) => {
    if (y + height > pageHeight - 18) addPage()
  }

  const writeWrapped = (text: unknown, options?: { indent?: number; size?: number; bold?: boolean; color?: [number, number, number]; after?: number }) => {
    const value = cleanText(text)
    if (!value) return
    const indent = options?.indent || 0
    const size = options?.size || 10
    const color = options?.color || [51, 65, 85]
    pdf.setFont("helvetica", options?.bold ? "bold" : "normal")
    pdf.setFontSize(size)
    pdf.setTextColor(color[0], color[1], color[2])
    const lines = pdf.splitTextToSize(value, contentWidth - indent)
    for (const line of lines) {
      ensureSpace(size * 0.55 + 2)
      pdf.text(line, margin + indent, y)
      y += size * 0.48
    }
    y += options?.after ?? 2.5
  }

  const sectionTitle = (title: string) => {
    ensureSpace(15)
    pdf.setFillColor(accent[0], accent[1], accent[2])
    pdf.roundedRect(margin, y - 4, 4, 9, 1, 1, "F")
    writeWrapped(title, { indent: 8, size: 13, bold: true, color: [15, 23, 42], after: 4 })
  }

  const bullet = (text: unknown, index?: number) => {
    const value = cleanText(text)
    if (!value) return
    ensureSpace(12)
    pdf.setFillColor(accent[0], accent[1], accent[2])
    pdf.circle(margin + 3, y - 1.4, 2.2, "F")
    if (typeof index === "number") {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6.5)
      pdf.setTextColor(255, 255, 255)
      pdf.text(String(index + 1), margin + 3, y - 0.2, { align: "center" })
    }
    writeWrapped(value, { indent: 9, size: 9.5, after: 2.5 })
  }

  paintBackground()

  pdf.setFillColor(accent[0], accent[1], accent[2])
  pdf.rect(0, 0, pageWidth, 50, "F")
  pdf.setFillColor(255, 255, 255)
  pdf.circle(pageWidth - 24, 9, 17, "F")
  pdf.setFillColor(accent[0], accent[1], accent[2])
  pdf.circle(pageWidth - 24, 9, 11, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text("VIDEO", pageWidth - 24, 10.5, { align: "center" })

  pdf.setFontSize(21)
  const titleLines = pdf.splitTextToSize(cleanText(data?.title || "Resumen de video"), contentWidth - 28)
  let titleY = 18
  for (const line of titleLines.slice(0, 3)) {
    pdf.text(line, margin, titleY)
    titleY += 8.5
  }
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9.5)
  pdf.setTextColor(254, 226, 226)
  const metadata = [data?.channel, data?.duration, data?.settings?.language].filter(Boolean).join(" · ")
  if (metadata) pdf.text(cleanText(metadata), margin, Math.min(45, titleY + 1))
  y = 61

  if (data?.centralThesis) {
    pdf.setFillColor(254, 242, 242)
    pdf.setDrawColor(accent[0], accent[1], accent[2])
    const thesisLines = pdf.splitTextToSize(cleanText(data.centralThesis), contentWidth - 12)
    const thesisHeight = Math.max(22, thesisLines.length * 5 + 13)
    ensureSpace(thesisHeight + 4)
    pdf.roundedRect(margin, y, contentWidth, thesisHeight, 3, 3, "FD")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.setTextColor(accent[0], accent[1], accent[2])
    pdf.text("TESIS CENTRAL", margin + 6, y + 7)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    pdf.setTextColor(51, 65, 85)
    let thesisY = y + 14
    for (const line of thesisLines) {
      pdf.text(line, margin + 6, thesisY)
      thesisY += 5
    }
    y += thesisHeight + 7
  }

  sectionTitle("Resumen general")
  writeWrapped(data?.executiveSummary || "No se generó un resumen general.", { size: 10, after: 6 })

  const moments = Array.isArray(data?.keyMoments) ? data.keyMoments : []
  if (moments.length) {
    sectionTitle("Momentos clave")
    for (const moment of moments) {
      ensureSpace(19)
      pdf.setFillColor(255, 255, 255)
      pdf.setDrawColor(226, 232, 240)
      pdf.roundedRect(margin, y - 4, contentWidth, 14, 2, 2, "FD")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.5)
      pdf.setTextColor(accent[0], accent[1], accent[2])
      pdf.text(cleanText(moment?.timestamp || "00:00"), margin + 4, y + 1)
      pdf.setTextColor(15, 23, 42)
      const momentTitle = cleanText(moment?.title || "Momento destacado")
      pdf.text(pdf.splitTextToSize(momentTitle, contentWidth - 32)[0], margin + 25, y + 1)
      y += 13
      writeWrapped(moment?.summary, { indent: 4, size: 9, after: 4 })
    }
  }

  const concepts = Array.isArray(data?.concepts) ? data.concepts : []
  if (concepts.length) {
    sectionTitle("Conceptos principales")
    concepts.forEach((concept: any, index: number) => {
      ensureSpace(18)
      writeWrapped(`${index + 1}. ${concept?.name || "Concepto"}`, { size: 10.5, bold: true, color: [15, 23, 42], after: 1 })
      writeWrapped(concept?.explanation, { indent: 5, size: 9.5, after: 1 })
      if (concept?.example) writeWrapped(`Ejemplo: ${concept.example}`, { indent: 5, size: 8.5, color: [100, 116, 139], after: 4 })
    })
  }

  const takeaways = Array.isArray(data?.takeaways) ? data.takeaways : []
  if (takeaways.length) {
    sectionTitle("Aprendizajes esenciales")
    takeaways.forEach((item: unknown, index: number) => bullet(item, index))
    y += 3
  }

  const questions = Array.isArray(data?.questions) ? data.questions : []
  if (questions.length) {
    sectionTitle("Preguntas para profundizar")
    questions.forEach((item: unknown, index: number) => bullet(item, index))
    y += 3
  }

  const glossary = Array.isArray(data?.glossary) ? data.glossary : []
  if (glossary.length) {
    sectionTitle("Glosario")
    glossary.forEach((item: any) => {
      writeWrapped(item?.term, { size: 9.5, bold: true, color: [accent[0], accent[1], accent[2]], after: 0.5 })
      writeWrapped(item?.definition, { indent: 4, size: 9, after: 3 })
    })
  }

  const limitations = Array.isArray(data?.limitations) ? data.limitations : []
  if (limitations.length) {
    sectionTitle("Observaciones y límites")
    limitations.forEach((item: unknown) => bullet(item))
  }

  if (data?.sourceUrl) {
    sectionTitle("Fuente")
    writeWrapped(data.sourceUrl, { size: 8.5, color: [100, 116, 139], after: 2 })
  }

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFillColor(accent[0], accent[1], accent[2])
    pdf.rect(0, pageHeight - 9, pageWidth, 9, "F")
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(255, 255, 255)
    pdf.text("EduAI Creator Hub · Resumen multimodal de video", margin, pageHeight - 3.5)
    pdf.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 3.5, { align: "right" })
  }

  pdf.save(`${fileName}.pdf`)
}
