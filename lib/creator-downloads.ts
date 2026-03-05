// src/lib/creator-downloads.ts
// v2 — Fix encoding, better formatting, Canva-style PDFs

// Strip emojis that jsPDF can't render
function clean(text: string): string {
  if (!text) return ""
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{E000}-\u{F8FF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

// Hex color to RGB array
function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace("#", "")
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return [r, g, b]
}

// ============================================================
// PNG / JPG Export
// ============================================================

export async function downloadAsImage(
  elementId: string,
  fileName: string,
  format: "png" | "jpeg" = "png"
) {
  const { toPng, toJpeg } = await import("html-to-image")
  const element = document.getElementById(elementId)
  if (!element) throw new Error("Elemento no encontrado")
  const fn = format === "png" ? toPng : toJpeg
  const dataUrl = await fn(element, {
    quality: 0.95,
    backgroundColor: "#030712",
    pixelRatio: 2,
  })
  const link = document.createElement("a")
  link.download = `${fileName}.${format === "jpeg" ? "jpg" : format}`
  link.href = dataUrl
  link.click()
}

export async function downloadRenderedAsImage(
  elementId: string,
  fileName: string,
  format: "png" | "jpeg" = "png"
) {
  try {
    await downloadAsImage(elementId, fileName, format)
    return true
  } catch {
    try {
      await downloadAsImage("creator-result-container", fileName, format)
      return true
    } catch (err) {
      console.error("Error exportando imagen:", err)
      return false
    }
  }
}

// ============================================================
// PDF Export — Canva-style formatting
// ============================================================

export async function downloadAsPDF(data: any, format: string, fileName: string, accentColor = "#3b82f6") {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = 210
  const pageH = 297
  const margin = 18
  const contentW = pageW - margin * 2
  const accent = hexToRgb(accentColor)
  let y = 0

  // ── Helpers ──

  const newPage = () => { pdf.addPage(); y = margin }
  const checkPage = (need = 20) => { if (y + need > pageH - 20) newPage() }

  const drawHeader = (title: string, subtitle?: string) => {
    // Accent bar at top
    pdf.setFillColor(accent[0], accent[1], accent[2])
    pdf.rect(0, 0, pageW, 38, "F")

    // Title
    pdf.setFontSize(22)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(255, 255, 255)
    const titleLines = pdf.splitTextToSize(clean(title), contentW)
    let ty = 16
    for (const line of titleLines) { pdf.text(line, margin, ty); ty += 9 }

    // Subtitle
    if (subtitle) {
      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(255, 255, 255, 180)
      pdf.text(clean(subtitle), margin, ty + 1)
    }

    pdf.setTextColor(0, 0, 0)
    y = 48
  }

  const drawSectionTitle = (text: string) => {
    checkPage(15)
    // Accent left bar
    pdf.setFillColor(accent[0], accent[1], accent[2])
    pdf.rect(margin, y - 4, 3, 8, "F")
    pdf.setFontSize(13)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(30, 30, 30)
    pdf.text(clean(text), margin + 7, y)
    y += 8
  }

  const drawBody = (text: string, indent = 0) => {
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(60, 60, 60)
    const lines = pdf.splitTextToSize(clean(text), contentW - indent)
    for (const line of lines) {
      checkPage(6)
      pdf.text(line, margin + indent, y)
      y += 5
    }
    y += 2
  }

  const drawBullet = (text: string, indent = 4) => {
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(60, 60, 60)
    // Colored bullet
    pdf.setFillColor(accent[0], accent[1], accent[2])
    pdf.circle(margin + indent, y - 1.2, 1.2, "F")
    const lines = pdf.splitTextToSize(clean(text), contentW - indent - 6)
    for (const line of lines) {
      checkPage(6)
      pdf.text(line, margin + indent + 4, y)
      y += 5
    }
    y += 1.5
  }

  const drawStatBox = (value: string, label: string) => {
    checkPage(18)
    const boxW = contentW / 2
    const boxX = margin + (contentW - boxW) / 2
    pdf.setFillColor(accent[0], accent[1], accent[2], 0.08)
    pdf.setDrawColor(accent[0], accent[1], accent[2])
    pdf.roundedRect(boxX, y, boxW, 14, 2, 2, "FD")
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(accent[0], accent[1], accent[2])
    pdf.text(clean(value), boxX + boxW / 2, y + 6, { align: "center" })
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)
    pdf.text(clean(label), boxX + boxW / 2, y + 11, { align: "center" })
    pdf.setTextColor(0, 0, 0)
    y += 18
  }

  const drawKeyFact = (text: string) => {
    checkPage(16)
    pdf.setFillColor(accent[0], accent[1], accent[2], 0.06)
    pdf.setDrawColor(accent[0], accent[1], accent[2])
    pdf.roundedRect(margin, y, contentW, 12, 2, 2, "FD")
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bolditalic")
    pdf.setTextColor(accent[0], accent[1], accent[2])
    pdf.text(clean(text), margin + contentW / 2, y + 7, { align: "center" })
    pdf.setTextColor(0, 0, 0)
    y += 16
  }

  const drawDivider = () => {
    checkPage(6)
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.3)
    pdf.line(margin + 20, y, pageW - margin - 20, y)
    y += 6
  }

  // ── Format-specific layouts ──

  switch (format) {
    case "infographic": {
      drawHeader(data.title || "Infografia", data.subtitle)
      if (data.keyFact) drawKeyFact(data.keyFact)
      for (const sec of data.sections || []) {
        drawSectionTitle(sec.heading)
        for (const p of sec.points || []) drawBullet(p)
        if (sec.stat) drawStatBox(sec.stat.value, sec.stat.label)
        y += 2
      }
      if (data.conclusion) { drawDivider(); drawBody(data.conclusion) }
      break
    }

    case "poster": {
      // Full color header
      pdf.setFillColor(accent[0], accent[1], accent[2])
      pdf.rect(0, 0, pageW, 60, "F")
      pdf.setFontSize(28)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(255, 255, 255)
      const headLines = pdf.splitTextToSize(clean(data.headline || "Poster"), contentW - 10)
      let hy = 25
      for (const line of headLines) { pdf.text(line, margin + 5, hy); hy += 12 }
      if (data.tagline) {
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "normal")
        pdf.text(clean(data.tagline), margin + 5, hy + 2)
      }
      y = 70
      pdf.setTextColor(0, 0, 0)

      for (let i = 0; i < (data.mainPoints || []).length; i++) {
        const pt = data.mainPoints[i]
        checkPage(25)
        // Numbered circle
        pdf.setFillColor(accent[0], accent[1], accent[2])
        pdf.circle(margin + 5, y, 5, "F")
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(255, 255, 255)
        pdf.text(String(i + 1), margin + 5, y + 1.5, { align: "center" })
        pdf.setTextColor(30, 30, 30)
        pdf.setFontSize(13)
        pdf.text(clean(pt.title), margin + 14, y + 1)
        y += 7
        drawBody(pt.description, 14)
        y += 4
      }
      if (data.callToAction) {
        drawDivider()
        checkPage(20)
        pdf.setFillColor(accent[0], accent[1], accent[2])
        pdf.roundedRect(margin, y, contentW, 16, 3, 3, "F")
        pdf.setFontSize(13)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(255, 255, 255)
        pdf.text(clean(data.callToAction), margin + contentW / 2, y + 10, { align: "center" })
      }
      break
    }

    case "podcast": {
      drawHeader(data.title || "Podcast", `Duracion: ${data.duration || "5 min"} - Guion del episodio`)
      for (const seg of data.segments || []) {
        checkPage(12)
        const isA = seg.speaker === "A"
        pdf.setFillColor(isA ? accent[0] : 200, isA ? accent[1] : 150, isA ? accent[2] : 50)
        pdf.roundedRect(margin, y - 3, 20, 6, 1, 1, "F")
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(255, 255, 255)
        pdf.text(isA ? "Host A" : "Host B", margin + 10, y, { align: "center" })
        y += 5
        drawBody(seg.text, 2)
        y += 1
      }
      break
    }

    case "mindmap": {
      drawHeader(data.centralTopic || "Mapa Mental")
      const mainNodes = (data.nodes || []).filter((n: any) => n.category === "main")
      const subNodes = (data.nodes || []).filter((n: any) => n.category === "sub")
      const detailNodes = (data.nodes || []).filter((n: any) => n.category === "detail")

      if (mainNodes.length) {
        drawSectionTitle("Conceptos Principales")
        for (const n of mainNodes) {
          checkPage(14)
          pdf.setFontSize(11)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(accent[0], accent[1], accent[2])
          pdf.text(clean(n.label), margin + 4, y)
          y += 5
          if (n.description) drawBody(n.description, 4)
          y += 2
        }
      }
      if (subNodes.length) {
        drawSectionTitle("Subconceptos")
        for (const n of subNodes) {
          checkPage(12)
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(80, 80, 80)
          pdf.text(clean(`- ${n.label}`), margin + 6, y)
          y += 5
          if (n.description) drawBody(n.description, 8)
        }
      }
      if (detailNodes.length) {
        drawSectionTitle("Detalles")
        for (const n of detailNodes) { drawBullet(`${n.label}${n.description ? ": " + n.description : ""}`, 8) }
      }
      break
    }

    case "flashcards": {
      drawHeader(data.deckTitle || "Flashcards", `${(data.cards || []).length} tarjetas - ${clean(data.topic || "")}`)
      for (let i = 0; i < (data.cards || []).length; i++) {
        const card = data.cards[i]
        checkPage(32)
        // Card container
        pdf.setFillColor(248, 248, 252)
        pdf.setDrawColor(200, 200, 210)
        pdf.roundedRect(margin, y, contentW, 26, 3, 3, "FD")

        // Card number badge
        pdf.setFillColor(accent[0], accent[1], accent[2])
        pdf.roundedRect(margin + 3, y + 2, 12, 5, 1, 1, "F")
        pdf.setFontSize(7)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(255, 255, 255)
        pdf.text(`#${i + 1}`, margin + 9, y + 5.5, { align: "center" })

        // Question
        pdf.setFontSize(10)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(30, 30, 30)
        const qLines = pdf.splitTextToSize(clean(card.front), contentW - 10)
        let cardY = y + 11
        for (const line of qLines) { pdf.text(line, margin + 5, cardY); cardY += 4.5 }

        // Answer
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(accent[0], accent[1], accent[2])
        const aLines = pdf.splitTextToSize(clean(card.back), contentW - 10)
        for (const line of aLines) { pdf.text(line, margin + 5, cardY); cardY += 4.5 }

        y += Math.max(28, cardY - y + 4)
      }
      break
    }

    case "quiz": {
      drawHeader(data.title || "Quiz", `${(data.questions || []).length} preguntas - ${clean(data.topic || "")}`)
      for (let i = 0; i < (data.questions || []).length; i++) {
        const q = data.questions[i]
        checkPage(35)

        // Question number
        pdf.setFillColor(accent[0], accent[1], accent[2])
        pdf.circle(margin + 4, y, 4, "F")
        pdf.setFontSize(10)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(255, 255, 255)
        pdf.text(String(i + 1), margin + 4, y + 1.2, { align: "center" })

        // Question text
        pdf.setTextColor(30, 30, 30)
        pdf.setFontSize(11)
        const qLines = pdf.splitTextToSize(clean(q.question), contentW - 14)
        let qY = y - 1
        for (const line of qLines) { pdf.text(line, margin + 12, qY); qY += 5 }
        y = qY + 3

        // Options
        pdf.setFontSize(10)
        for (let j = 0; j < (q.options || []).length; j++) {
          checkPage(7)
          const letter = String.fromCharCode(65 + j)
          const isCorrect = j === q.correctAnswer

          if (isCorrect) {
            pdf.setFillColor(220, 252, 231)
            pdf.roundedRect(margin + 8, y - 3.5, contentW - 12, 6.5, 1, 1, "F")
            pdf.setFont("helvetica", "bold")
            pdf.setTextColor(22, 163, 74)
          } else {
            pdf.setFont("helvetica", "normal")
            pdf.setTextColor(80, 80, 80)
          }
          pdf.text(clean(`${letter}) ${q.options[j]}${isCorrect ? "  [Correcta]" : ""}`), margin + 12, y)
          y += 6
        }

        // Explanation
        if (q.explanation) {
          checkPage(10)
          pdf.setFillColor(240, 242, 255)
          const expText = clean(q.explanation)
          const expLines = pdf.splitTextToSize(expText, contentW - 18)
          const expH = expLines.length * 4 + 6
          pdf.roundedRect(margin + 8, y - 2, contentW - 12, expH, 1, 1, "F")
          pdf.setFontSize(9)
          pdf.setFont("helvetica", "italic")
          pdf.setTextColor(80, 80, 120)
          for (const line of expLines) { pdf.text(line, margin + 12, y + 2); y += 4 }
          y += 6
        }
        y += 4
      }
      break
    }

    case "timeline": {
      drawHeader(data.title || "Timeline", data.period)
      const events = data.events || []
      for (let i = 0; i < events.length; i++) {
        const evt = events[i]
        checkPage(22)

        // Timeline line
        if (i < events.length - 1) {
          pdf.setDrawColor(accent[0], accent[1], accent[2])
          pdf.setLineWidth(0.8)
          pdf.line(margin + 5, y + 5, margin + 5, y + 30)
        }

        // Circle node
        const imp = evt.importance
        if (imp === "high") pdf.setFillColor(239, 68, 68)
        else if (imp === "medium") pdf.setFillColor(245, 158, 11)
        else pdf.setFillColor(accent[0], accent[1], accent[2])
        pdf.circle(margin + 5, y + 1, 3.5, "F")

        // Date badge
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(accent[0], accent[1], accent[2])
        pdf.text(clean(evt.date), margin + 13, y)
        y += 5

        // Title
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(30, 30, 30)
        pdf.text(clean(evt.title), margin + 13, y)
        y += 5

        // Description
        drawBody(evt.description, 13)
        y += 4
      }
      break
    }
  }

  // ── Footer on all pages ──
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFillColor(accent[0], accent[1], accent[2])
    pdf.rect(0, pageH - 10, pageW, 10, "F")
    pdf.setFontSize(7)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(255, 255, 255)
    pdf.text("Generado por EduAI Creator Studio", margin, pageH - 4)
    pdf.text(`${i} / ${pageCount}`, pageW - margin - 8, pageH - 4)
  }

  pdf.save(`${fileName}.pdf`)
}

// ============================================================
// PPTX Export
// ============================================================

export async function downloadAsPPTX(data: any, fileName: string, accentColor = "#3b82f6") {
  const PptxGenJS = (await import("pptxgenjs")).default
  const pptx = new PptxGenJS()
  const accent = accentColor.replace("#", "")

  pptx.author = "EduAI"
  pptx.title = data.title || "Presentacion"

  const slides = data.slides || []

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i]
    const slide = pptx.addSlide()

    if (i === 0) {
      slide.background = { fill: accent }
      slide.addText(clean(s.title || data.title), {
        x: 0.8, y: 1.2, w: 8.4, h: 1.8,
        fontSize: 34, fontFace: "Arial",
        color: "FFFFFF", bold: true, align: "center",
      })
      slide.addText("EduAI Creator Studio", {
        x: 0.8, y: 3.5, w: 8.4, h: 0.5,
        fontSize: 12, fontFace: "Arial",
        color: "FFFFFF", align: "center", italic: true,
      })
    } else if (i === slides.length - 1) {
      // Conclusion slide
      slide.background = { fill: "0F172A" }
      slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: accent } })
      slide.addText(clean(s.title), {
        x: 0.6, y: 0.4, w: 8.8, h: 0.7,
        fontSize: 24, fontFace: "Arial", color: "FFFFFF", bold: true,
      })
      const bullets = (s.bullets || []).map((b: string) => ({
        text: clean(b),
        options: { fontSize: 15, color: "94A3B8", bullet: { code: "2713", color: accent } },
      }))
      if (bullets.length) {
        slide.addText(bullets, {
          x: 0.8, y: 1.5, w: 8.4, h: 3.5,
          fontFace: "Arial", lineSpacingMultiple: 1.6, valign: "top",
        })
      }
    } else {
      slide.background = { fill: "0F172A" }
      // Top accent bar
      slide.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: accent } })
      // Slide number
      slide.addText(String(i), {
        x: 9, y: 0.2, w: 0.6, h: 0.4,
        fontSize: 10, fontFace: "Arial", color: "475569", align: "right",
      })
      slide.addText(clean(s.title), {
        x: 0.6, y: 0.3, w: 8.8, h: 0.8,
        fontSize: 22, fontFace: "Arial", color: "FFFFFF", bold: true,
      })
      const bullets = (s.bullets || []).map((b: string) => ({
        text: clean(b),
        options: { fontSize: 14, color: "CBD5E1", bullet: { code: "25CF", color: accent }, lineSpacingMultiple: 1.5 },
      }))
      if (bullets.length) {
        slide.addText(bullets, {
          x: 0.8, y: 1.4, w: 8.4, h: 3.5,
          fontFace: "Arial", valign: "top",
        })
      }
      if (s.notes) slide.addNotes(clean(s.notes))
    }
  }

  await pptx.writeFile({ fileName: `${fileName}.pptx` })
}
