type EditableDocumentFormat = "cornell" | "glossary" | "lessonplan"

function clean(value: unknown) {
  return String(value || "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function hexToRgb(value: string): [number, number, number] {
  const normalized = value.replace("#", "")
  const hex = normalized.length === 3 ? normalized.split("").map((part) => part + part).join("") : normalized
  return [parseInt(hex.slice(0, 2), 16) || 37, parseInt(hex.slice(2, 4), 16) || 99, parseInt(hex.slice(4, 6), 16) || 235]
}

export async function downloadEditableDocumentAsPDF(data: any, format: EditableDocumentFormat, fileName: string, accentColor = "#2563eb") {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const [r, g, b] = hexToRgb(accentColor)
  const pageW = 210
  const pageH = 297
  const margin = 17
  const contentW = pageW - margin * 2
  let y = 0

  const pageBackground = () => {
    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, 0, pageW, pageH, "F")
  }

  const newPage = () => {
    pdf.addPage()
    pageBackground()
    y = margin
  }

  const checkPage = (needed = 18) => {
    if (y + needed > pageH - 18) newPage()
  }

  const header = (title: string, subtitle?: string) => {
    pageBackground()
    pdf.setFillColor(r, g, b)
    pdf.rect(0, 0, pageW, 38, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(21)
    const lines = pdf.splitTextToSize(clean(title), contentW)
    let titleY = 16
    for (const line of lines.slice(0, 2)) {
      pdf.text(line, margin, titleY)
      titleY += 8
    }
    if (subtitle) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      pdf.text(clean(subtitle), margin, Math.min(33, titleY + 1))
    }
    y = 49
  }

  const sectionTitle = (text: string) => {
    checkPage(12)
    pdf.setFillColor(r, g, b)
    pdf.roundedRect(margin, y - 4, 3, 8, 1, 1, "F")
    pdf.setTextColor(35, 42, 56)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(12)
    pdf.text(clean(text), margin + 7, y)
    y += 8
  }

  const paragraph = (text: unknown, indent = 0, color: [number, number, number] = [75, 85, 99]) => {
    const value = clean(text)
    if (!value) return
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9.5)
    pdf.setTextColor(...color)
    const lines = pdf.splitTextToSize(value, contentW - indent)
    for (const line of lines) {
      checkPage(6)
      pdf.text(line, margin + indent, y)
      y += 4.8
    }
    y += 2
  }

  const pill = (text: string, x: number, width: number) => {
    pdf.setFillColor(245, 247, 250)
    pdf.setDrawColor(224, 228, 235)
    pdf.roundedRect(x, y - 4, width, 7, 2, 2, "FD")
    pdf.setTextColor(80, 90, 105)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)
    pdf.text(clean(text), x + width / 2, y, { align: "center" })
  }

  if (format === "cornell") {
    header(data?.title || "Apuntes Cornell", `${data?.subject || "Asignatura"} · ${data?.date || "Sin fecha"}`)
    const keywords = Array.isArray(data?.keywords) ? data.keywords : []
    if (keywords.length) {
      sectionTitle("Palabras clave")
      let x = margin
      for (const keyword of keywords) {
        const width = Math.min(42, Math.max(20, clean(keyword).length * 2 + 8))
        if (x + width > pageW - margin) { y += 9; x = margin; checkPage(10) }
        pill(keyword, x, width)
        x += width + 3
      }
      y += 10
    }

    sectionTitle("Notas principales")
    for (const [index, note] of (Array.isArray(data?.mainNotes) ? data.mainNotes : []).entries()) {
      checkPage(24)
      pdf.setFillColor(248, 250, 252)
      pdf.setDrawColor(226, 232, 240)
      pdf.roundedRect(margin, y, contentW, 10, 2, 2, "FD")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10)
      pdf.setTextColor(r, g, b)
      pdf.text(`${index + 1}. ${clean(note?.topic || "Concepto")}`, margin + 4, y + 6.5)
      y += 15
      paragraph(note?.notes, 4)
      y += 2
    }
    sectionTitle("Resumen")
    paragraph(data?.summary)
  }

  if (format === "glossary") {
    const terms = Array.isArray(data?.terms) ? data.terms : []
    header(data?.title || "Glosario", `${data?.subject || "Área de estudio"} · ${terms.length} términos`)
    for (const [index, term] of terms.entries()) {
      checkPage(35)
      pdf.setFillColor(249, 250, 251)
      pdf.setDrawColor(226, 232, 240)
      pdf.roundedRect(margin, y, contentW, 10, 2, 2, "FD")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(12)
      pdf.setTextColor(r, g, b)
      pdf.text(`${String(index + 1).padStart(2, "0")}  ${clean(term?.term || "Concepto")}`, margin + 4, y + 6.5)
      if (term?.category) {
        pdf.setFontSize(7.5)
        pdf.setTextColor(100, 110, 125)
        pdf.text(clean(term.category), pageW - margin - 4, y + 6.5, { align: "right" })
      }
      y += 15
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8)
      pdf.setTextColor(80, 90, 105)
      pdf.text("DEFINICIÓN", margin + 4, y)
      y += 5
      paragraph(term?.definition, 4)
      if (term?.example) {
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(8)
        pdf.setTextColor(80, 90, 105)
        pdf.text("EJEMPLO", margin + 4, y)
        y += 5
        paragraph(term.example, 4, [95, 75, 120])
      }
      y += 4
    }
  }

  if (format === "lessonplan") {
    header(data?.title || "Plan de clase", `${data?.subject || "Asignatura"} · ${data?.grade || "Curso"} · ${data?.duration || "Duración"}`)
    sectionTitle("Objetivo de aprendizaje")
    paragraph(data?.objective)
    sectionTitle("Información pedagógica")
    checkPage(12)
    const info = [`Curso: ${data?.grade || "—"}`, `Duración: ${data?.duration || "—"}`, `Bloom: ${data?.bloom || "—"}`]
    let x = margin
    for (const item of info) {
      const width = contentW / info.length - 2
      pill(item, x, width)
      x += width + 3
    }
    y += 12

    sectionTitle("Secuencia de aprendizaje")
    for (const [index, phase] of (Array.isArray(data?.phases) ? data.phases : []).entries()) {
      checkPage(40)
      pdf.setFillColor(r, g, b)
      pdf.circle(margin + 5, y + 2, 4, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(9)
      pdf.text(String(index + 1), margin + 5, y + 3.2, { align: "center" })
      pdf.setTextColor(35, 42, 56)
      pdf.setFontSize(11)
      pdf.text(clean(phase?.name || `Momento ${index + 1}`), margin + 13, y + 1)
      pdf.setFontSize(8)
      pdf.setTextColor(r, g, b)
      pdf.text(clean(phase?.duration || ""), pageW - margin, y + 1, { align: "right" })
      y += 8
      paragraph(phase?.activity, 13)
      if (phase?.materials) {
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(8)
        pdf.setTextColor(80, 90, 105)
        pdf.text(`Materiales: ${clean(phase.materials)}`, margin + 13, y)
        y += 6
      }
      if (phase?.notes) {
        pdf.setFillColor(255, 251, 235)
        pdf.setDrawColor(253, 230, 138)
        const notes = pdf.splitTextToSize(`Nota docente: ${clean(phase.notes)}`, contentW - 22)
        const height = Math.max(10, notes.length * 4.2 + 5)
        checkPage(height + 3)
        pdf.roundedRect(margin + 13, y - 3, contentW - 13, height, 2, 2, "FD")
        pdf.setTextColor(146, 94, 15)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(8.5)
        let noteY = y + 2
        for (const line of notes) { pdf.text(line, margin + 17, noteY); noteY += 4.2 }
        y += height + 3
      }
      y += 4
    }

    sectionTitle("Evaluación")
    paragraph(data?.assessment)
    const resources = Array.isArray(data?.resources) ? data.resources : []
    if (resources.length) {
      sectionTitle("Recursos")
      for (const resource of resources) {
        pdf.setFillColor(r, g, b)
        pdf.circle(margin + 2, y - 1.2, 1.1, "F")
        paragraph(resource, 6)
      }
    }
  }

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page)
    pdf.setFillColor(r, g, b)
    pdf.rect(0, pageH - 9, pageW, 9, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.text("Generado por EduAI Creator Studio", margin, pageH - 3.5)
    pdf.text(`${page} / ${pageCount}`, pageW - margin, pageH - 3.5, { align: "right" })
  }

  pdf.save(`${fileName}.pdf`)
}
