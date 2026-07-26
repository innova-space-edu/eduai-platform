import type { CreatorCanvasElement, CreatorCanvasPage } from "@/lib/creator-canvas"

function safeName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60) || "eduai-lienzo"
}

function parseColor(value?: string | null, fallback = "#ffffff") {
  const source = value || fallback
  const hex = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split("").map((part) => part + part).join("") : hex[1]
    return { r: parseInt(raw.slice(0, 2), 16), g: parseInt(raw.slice(2, 4), 16), b: parseInt(raw.slice(4, 6), 16), alpha: 1 }
  }
  const rgba = source.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)/i)
  if (rgba) return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), alpha: rgba[4] === undefined ? 1 : Number(rgba[4]) }
  return parseColor(fallback, "#ffffff")
}

function hexColor(value?: string | null, fallback = "FFFFFF") {
  const color = parseColor(value, `#${fallback}`)
  return [color.r, color.g, color.b].map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0")).join("").toUpperCase()
}

function transparency(value?: string | null, opacity = 1) {
  const color = parseColor(value, "#ffffff")
  return Math.max(0, Math.min(100, Math.round((1 - color.alpha * opacity) * 100)))
}

async function sourceToDataUrl(source?: string | null) {
  if (!source) return null
  if (source.startsWith("data:")) return source
  try {
    const response = await fetch(source, { cache: "no-store" })
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function pdfFont(font?: string) {
  const value = (font || "Arial").toLowerCase()
  if (value.includes("times") || value.includes("georgia")) return "times"
  if (value.includes("courier")) return "courier"
  return "helvetica"
}

function visibleElements(page: CreatorCanvasPage) {
  return [...(page.elements || [])].filter((element) => !element.hidden).sort((a, b) => a.zIndex - b.zIndex)
}

export async function downloadCreatorCanvasAsPDF(data: any, title: string) {
  const pages = (data?._canvas?.pages || []) as CreatorCanvasPage[]
  if (!pages.length) throw new Error("No hay páginas en el lienzo")
  const { jsPDF } = await import("jspdf")
  const first = pages[0]
  const pdf = new jsPDF({ orientation: first.width >= first.height ? "landscape" : "portrait", unit: "px", format: [first.width, first.height], compress: true })

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]
    if (pageIndex > 0) pdf.addPage([page.width, page.height], page.width >= page.height ? "landscape" : "portrait")
    const background = parseColor(page.backgroundColor, "#ffffff")
    pdf.setFillColor(background.r, background.g, background.b)
    pdf.rect(0, 0, page.width, page.height, "F")

    const backgroundData = await sourceToDataUrl(page.backgroundImageUrl)
    if (backgroundData) pdf.addImage(backgroundData, "PNG", 0, 0, page.width, page.height, undefined, "FAST")

    for (const element of visibleElements(page)) {
      const style = element.style || {}
      const opacity = style.opacity ?? 1
      if (element.type === "shape") {
        const fill = parseColor(style.backgroundColor, "#ffffff")
        const line = parseColor(style.borderColor, "#000000")
        pdf.setFillColor(fill.r, fill.g, fill.b)
        pdf.setDrawColor(line.r, line.g, line.b)
        pdf.setLineWidth(style.borderWidth || 0)
        if (element.shape === "circle") pdf.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, element.height / 2, style.borderWidth ? "FD" : "F")
        else if (element.shape === "line") {
          pdf.setLineWidth(Math.max(1, element.height))
          pdf.line(element.x, element.y + element.height / 2, element.x + element.width, element.y + element.height / 2)
        } else {
          const radius = Math.min(style.borderRadius || 0, element.width / 2, element.height / 2)
          if (radius > 0) pdf.roundedRect(element.x, element.y, element.width, element.height, radius, radius, style.borderWidth ? "FD" : "F")
          else pdf.rect(element.x, element.y, element.width, element.height, style.borderWidth ? "FD" : "F")
        }
        continue
      }

      if (element.type === "image" && element.src) {
        const image = await sourceToDataUrl(element.src)
        if (image) pdf.addImage(image, "PNG", element.x, element.y, element.width, element.height, undefined, "FAST", element.rotation || 0)
        continue
      }

      if (element.type === "text") {
        const fill = parseColor(style.backgroundColor, "#ffffff")
        const line = parseColor(style.borderColor, "#000000")
        if (style.backgroundColor && style.backgroundColor !== "transparent") {
          pdf.setFillColor(fill.r, fill.g, fill.b)
          pdf.setDrawColor(line.r, line.g, line.b)
          pdf.setLineWidth(style.borderWidth || 0)
          const radius = Math.min(style.borderRadius || 0, element.width / 2, element.height / 2)
          if (radius > 0) pdf.roundedRect(element.x, element.y, element.width, element.height, radius, radius, style.borderWidth ? "FD" : "F")
          else pdf.rect(element.x, element.y, element.width, element.height, style.borderWidth ? "FD" : "F")
        }
        const textColor = parseColor(style.color, "#172033")
        pdf.setTextColor(textColor.r, textColor.g, textColor.b)
        pdf.setFont(pdfFont(style.fontFamily), style.fontStyle === "italic" ? (Number(style.fontWeight || 400) >= 700 ? "bolditalic" : "italic") : Number(style.fontWeight || 400) >= 700 ? "bold" : "normal")
        pdf.setFontSize(Math.max(6, (style.fontSize || 24) * 0.75))
        const padding = style.padding || 0
        const lines = pdf.splitTextToSize(element.text || "", Math.max(10, element.width - padding * 2))
        const align = style.textAlign === "center" ? "center" : style.textAlign === "right" ? "right" : "left"
        const x = align === "center" ? element.x + element.width / 2 : align === "right" ? element.x + element.width - padding : element.x + padding
        const lineHeight = (style.fontSize || 24) * (style.lineHeight || 1.25) * 0.75
        let y = element.y + padding + Math.max(lineHeight, (style.fontSize || 24) * 0.8)
        for (const lineText of lines) {
          if (y > element.y + element.height) break
          pdf.text(lineText, x, y, { align, angle: element.rotation || 0 })
          y += lineHeight
        }
      }
    }
  }

  pdf.save(`${safeName(title)}.pdf`)
}

export async function downloadCreatorCanvasAsPPTX(data: any, title: string) {
  const pages = (data?._canvas?.pages || []) as CreatorCanvasPage[]
  if (!pages.length) throw new Error("No hay diapositivas en el lienzo")
  const PptxGenJS = (await import("pptxgenjs")).default
  const pptx = new PptxGenJS()
  pptx.layout = "LAYOUT_WIDE"
  pptx.author = "EduAI"
  pptx.title = title
  const slideW = 13.333
  const slideH = 7.5

  for (const page of pages) {
    const slide = pptx.addSlide()
    slide.background = { color: hexColor(page.backgroundColor, "FFFFFF") }
    const sx = slideW / page.width
    const sy = slideH / page.height
    const background = await sourceToDataUrl(page.backgroundImageUrl)
    if (background) slide.addImage({ data: background, x: 0, y: 0, w: slideW, h: slideH })

    for (const element of visibleElements(page)) {
      const style = element.style || {}
      const x = element.x * sx
      const y = element.y * sy
      const w = element.width * sx
      const h = element.height * sy
      if (element.type === "shape") {
        const type = element.shape === "circle" ? "ellipse" : element.shape === "line" ? "line" : "rect"
        slide.addShape(type as any, {
          x,
          y,
          w,
          h,
          rotate: element.rotation || 0,
          fill: { color: hexColor(style.backgroundColor, "FFFFFF"), transparency: transparency(style.backgroundColor, style.opacity ?? 1) },
          line: { color: hexColor(style.borderColor, "FFFFFF"), width: Math.max(0, (style.borderWidth || 0) * 0.75), transparency: transparency(style.borderColor, style.opacity ?? 1) },
          radius: style.borderRadius ? Math.min(style.borderRadius * sx, 0.4) : undefined,
        } as any)
        continue
      }

      if (element.type === "image" && element.src) {
        const image = await sourceToDataUrl(element.src)
        if (image) slide.addImage({ data: image, x, y, w, h, rotate: element.rotation || 0 })
        continue
      }

      if (element.type === "text") {
        slide.addText(element.text || "", {
          x,
          y,
          w,
          h,
          rotate: element.rotation || 0,
          fontFace: style.fontFamily || "Arial",
          fontSize: Math.max(6, (style.fontSize || 24) * 0.56),
          bold: Number(style.fontWeight || 400) >= 700,
          italic: style.fontStyle === "italic",
          underline: style.textDecoration === "underline" ? { style: "sng" } : undefined,
          color: hexColor(style.color, "172033"),
          align: style.textAlign === "center" ? "center" : style.textAlign === "right" ? "right" : "left",
          valign: "mid",
          margin: (style.padding || 0) * sx,
          breakLine: false,
          fill: style.backgroundColor && style.backgroundColor !== "transparent" ? { color: hexColor(style.backgroundColor, "FFFFFF"), transparency: transparency(style.backgroundColor, style.opacity ?? 1) } : undefined,
          line: style.borderWidth ? { color: hexColor(style.borderColor, "D7DEE8"), width: style.borderWidth * 0.5, transparency: transparency(style.borderColor, style.opacity ?? 1) } : undefined,
          transparency: Math.round((1 - (style.opacity ?? 1)) * 100),
        } as any)
      }
    }
  }

  await pptx.writeFile({ fileName: `${safeName(title)}.pptx` })
}
