// src/lib/creator-downloads.ts
// Utilidades de descarga para Creator Studio

import type { jsPDF } from "jspdf"

// ============================================================
// PNG / JPG Export (desde elemento HTML renderizado)
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
    backgroundColor: "#030712", // gray-950
    pixelRatio: 2, // alta resolución
  })

  const link = document.createElement("a")
  link.download = `${fileName}.${format}`
  link.href = dataUrl
  link.click()
}

// ============================================================
// PDF Export (genérico desde contenido)
// ============================================================

async function getJsPDF(): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf")
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
}

function wrapText(pdf: jsPDF, text: string, x: number, maxWidth: number, lineHeight: number): number {
  const lines = pdf.splitTextToSize(text, maxWidth)
  let y = 0
  for (const line of lines) {
    pdf.text(line, x, y)
    y += lineHeight
  }
  return y
}

export async function downloadAsPDF(data: any, format: string, fileName: string) {
  const pdf = await getJsPDF()
  const pageW = 210
  const margin = 20
  const contentW = pageW - margin * 2
  let y = margin

  const addTitle = (text: string) => {
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text(text, margin, y)
    y += 10
  }

  const addSubtitle = (text: string) => {
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100)
    pdf.text(text, margin, y)
    pdf.setTextColor(0)
    y += 8
  }

  const addHeading = (text: string) => {
    pdf.setFontSize(13)
    pdf.setFont("helvetica", "bold")
    pdf.text(text, margin, y)
    y += 7
  }

  const addBody = (text: string) => {
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    const lines = pdf.splitTextToSize(text, contentW)
    for (const line of lines) {
      if (y > 275) { pdf.addPage(); y = margin }
      pdf.text(line, margin, y)
      y += 5
    }
    y += 3
  }

  const addBullet = (text: string) => {
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    const lines = pdf.splitTextToSize(text, contentW - 8)
    pdf.text("•", margin, y)
    for (const line of lines) {
      if (y > 275) { pdf.addPage(); y = margin }
      pdf.text(line, margin + 6, y)
      y += 5
    }
    y += 2
  }

  const addSeparator = () => {
    pdf.setDrawColor(200)
    pdf.line(margin, y, pageW - margin, y)
    y += 6
  }

  const checkPage = () => {
    if (y > 270) { pdf.addPage(); y = margin }
  }

  switch (format) {
    case "infographic": {
      addTitle(data.title || "Infografía")
      if (data.subtitle) addSubtitle(data.subtitle)
      if (data.keyFact) {
        y += 3
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "bolditalic")
        pdf.text(`💡 ${data.keyFact}`, margin, y)
        pdf.setFont("helvetica", "normal")
        y += 10
      }
      for (const sec of data.sections || []) {
        checkPage()
        addHeading(`${sec.icon || "📌"} ${sec.heading}`)
        for (const p of sec.points || []) addBullet(p)
        if (sec.stat) {
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "bold")
          pdf.text(`${sec.stat.value} — ${sec.stat.label}`, margin + 6, y)
          pdf.setFont("helvetica", "normal")
          y += 7
        }
        y += 3
      }
      if (data.conclusion) { addSeparator(); addBody(data.conclusion) }
      break
    }

    case "poster": {
      pdf.setFontSize(24)
      pdf.setFont("helvetica", "bold")
      const titleLines = pdf.splitTextToSize(data.headline || "Poster", contentW)
      for (const line of titleLines) { pdf.text(line, margin, y); y += 12 }
      if (data.tagline) addSubtitle(data.tagline)
      y += 5
      for (const pt of data.mainPoints || []) {
        checkPage()
        addHeading(`${pt.icon || "•"} ${pt.title}`)
        addBody(pt.description)
        y += 2
      }
      if (data.callToAction) {
        addSeparator()
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        pdf.text(data.callToAction, margin, y)
      }
      break
    }

    case "podcast": {
      addTitle(`🎙️ ${data.title || "Podcast"}`)
      addSubtitle(`Duración: ${data.duration || "5 min"} — Guión del episodio`)
      y += 5
      for (const seg of data.segments || []) {
        checkPage()
        pdf.setFontSize(10)
        pdf.setFont("helvetica", "bold")
        const speaker = seg.speaker === "A" ? "Host A" : "Host B"
        pdf.text(`[${speaker}]`, margin, y)
        y += 5
        pdf.setFont("helvetica", "normal")
        const lines = pdf.splitTextToSize(seg.text, contentW - 4)
        for (const line of lines) {
          if (y > 275) { pdf.addPage(); y = margin }
          pdf.text(line, margin + 2, y)
          y += 5
        }
        y += 3
      }
      break
    }

    case "mindmap": {
      addTitle(`🧠 ${data.centralTopic || "Mapa Mental"}`)
      y += 5
      for (const n of data.nodes || []) {
        checkPage()
        const prefix = n.category === "main" ? "●" : n.category === "sub" ? "  ○" : "    ▸"
        pdf.setFontSize(n.category === "main" ? 12 : 10)
        pdf.setFont("helvetica", n.category === "main" ? "bold" : "normal")
        pdf.text(`${prefix} ${n.label}`, margin, y)
        y += 5
        if (n.description) {
          pdf.setFontSize(9)
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(100)
          const descLines = pdf.splitTextToSize(n.description, contentW - 12)
          for (const line of descLines) {
            pdf.text(line, margin + 10, y)
            y += 4
          }
          pdf.setTextColor(0)
          y += 2
        }
      }
      break
    }

    case "flashcards": {
      addTitle(`📇 ${data.deckTitle || "Flashcards"}`)
      addSubtitle(`${(data.cards || []).length} tarjetas — ${data.topic || ""}`)
      y += 5
      for (let i = 0; i < (data.cards || []).length; i++) {
        const card = data.cards[i]
        checkPage()
        // Card box
        pdf.setDrawColor(180)
        pdf.roundedRect(margin, y - 3, contentW, 30, 3, 3)
        pdf.setFontSize(9)
        pdf.setTextColor(100)
        pdf.text(`Tarjeta ${i + 1}`, margin + 3, y + 1)
        pdf.setTextColor(0)

        pdf.setFontSize(11)
        pdf.setFont("helvetica", "bold")
        const qLines = pdf.splitTextToSize(`P: ${card.front}`, contentW - 6)
        let cardY = y + 6
        for (const line of qLines) { pdf.text(line, margin + 3, cardY); cardY += 5 }

        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(60)
        const aLines = pdf.splitTextToSize(`R: ${card.back}`, contentW - 6)
        for (const line of aLines) { pdf.text(line, margin + 3, cardY); cardY += 5 }
        pdf.setTextColor(0)

        y = Math.max(y + 33, cardY + 5)
      }
      break
    }

    case "quiz": {
      addTitle(`✅ ${data.title || "Quiz"}`)
      addSubtitle(`${(data.questions || []).length} preguntas — ${data.topic || ""}`)
      y += 5
      for (let i = 0; i < (data.questions || []).length; i++) {
        const q = data.questions[i]
        checkPage()
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "bold")
        const qLines = pdf.splitTextToSize(`${i + 1}. ${q.question}`, contentW)
        for (const line of qLines) {
          if (y > 275) { pdf.addPage(); y = margin }
          pdf.text(line, margin, y); y += 5
        }
        y += 1
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(10)
        for (let j = 0; j < (q.options || []).length; j++) {
          const letter = String.fromCharCode(65 + j)
          const isCorrect = j === q.correctAnswer
          if (isCorrect) pdf.setFont("helvetica", "bold")
          pdf.text(`  ${letter}) ${q.options[j]}${isCorrect ? " ✓" : ""}`, margin + 2, y)
          if (isCorrect) pdf.setFont("helvetica", "normal")
          y += 5
        }
        if (q.explanation) {
          pdf.setFontSize(9)
          pdf.setTextColor(80)
          const expLines = pdf.splitTextToSize(`→ ${q.explanation}`, contentW - 8)
          for (const line of expLines) {
            if (y > 275) { pdf.addPage(); y = margin }
            pdf.text(line, margin + 4, y); y += 4
          }
          pdf.setTextColor(0)
        }
        y += 5
      }
      break
    }

    case "timeline": {
      addTitle(`⏳ ${data.title || "Timeline"}`)
      if (data.period) addSubtitle(data.period)
      y += 5
      for (const evt of data.events || []) {
        checkPage()
        pdf.setFontSize(10)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(50, 100, 200)
        pdf.text(`${evt.icon || "📅"} ${evt.date}`, margin, y)
        pdf.setTextColor(0)
        y += 5
        pdf.setFontSize(11)
        pdf.text(evt.title, margin + 4, y)
        y += 5
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(9)
        pdf.setTextColor(80)
        const descLines = pdf.splitTextToSize(evt.description, contentW - 8)
        for (const line of descLines) { pdf.text(line, margin + 4, y); y += 4 }
        pdf.setTextColor(0)
        y += 5
      }
      break
    }
  }

  // Footer
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(150)
    pdf.text("Generado por EduAI Creator Studio", margin, 290)
    pdf.text(`${i} / ${pageCount}`, pageW - margin - 10, 290)
  }

  pdf.save(`${fileName}.pdf`)
}

// ============================================================
// PPTX Export
// ============================================================

export async function downloadAsPPTX(data: any, fileName: string) {
  const PptxGenJS = (await import("pptxgenjs")).default
  const pptx = new PptxGenJS()

  pptx.author = "EduAI"
  pptx.title = data.title || "Presentación"

  const slides = data.slides || []

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i]
    const slide = pptx.addSlide()

    if (i === 0) {
      // Title slide
      slide.background = { fill: "1E1B4B" }
      slide.addText(s.title || data.title, {
        x: 0.8, y: 1.5, w: 8.4, h: 1.5,
        fontSize: 32, fontFace: "Arial",
        color: "FFFFFF", bold: true,
        align: "center",
      })
      slide.addText(data.author || "EduAI", {
        x: 0.8, y: 3.2, w: 8.4, h: 0.6,
        fontSize: 14, fontFace: "Arial",
        color: "94A3B8", align: "center",
      })
    } else {
      // Content slide
      slide.background = { fill: "0F172A" }
      slide.addText(s.title, {
        x: 0.6, y: 0.3, w: 8.8, h: 0.8,
        fontSize: 22, fontFace: "Arial",
        color: "FFFFFF", bold: true,
      })

      const bullets = (s.bullets || []).map((b: string) => ({
        text: b,
        options: { fontSize: 14, color: "CBD5E1", bullet: { code: "25CF", color: "3B82F6" } },
      }))

      if (bullets.length > 0) {
        slide.addText(bullets, {
          x: 0.8, y: 1.4, w: 8.4, h: 3.5,
          fontFace: "Arial",
          lineSpacingMultiple: 1.5,
          valign: "top",
        })
      }

      // Speaker notes
      if (s.notes) {
        slide.addNotes(s.notes)
      }
    }
  }

  await pptx.writeFile({ fileName: `${fileName}.pptx` })
}

// ============================================================
// HELPER: Descargar imagen del render actual
// ============================================================

export async function downloadRenderedAsImage(
  elementId: string,
  fileName: string,
  format: "png" | "jpeg" = "png"
) {
  try {
    await downloadAsImage(elementId, fileName, format)
    return true
  } catch {
    // Fallback: intentar con todo el contenedor de resultado
    try {
      await downloadAsImage("creator-result-container", fileName, format)
      return true
    } catch (err) {
      console.error("Error exportando imagen:", err)
      return false
    }
  }
}
