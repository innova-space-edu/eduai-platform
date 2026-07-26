import type {
  CreatorCanvasElement,
  CreatorCanvasElementStyle,
  CreatorCanvasPage,
  CreatorTemplateReference,
} from "@/lib/creator-canvas"

export type DirectDocumentFormat = "cornell" | "glossary" | "lessonplan"

type CanvasElementInput = Omit<CreatorCanvasElement, "id" | "style"> & {
  style?: CreatorCanvasElementStyle
}

const uid = (prefix: string) =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

function text(input: CanvasElementInput): CreatorCanvasElement {
  return {
    id: uid("text"),
    ...input,
    type: "text",
    style: {
      fontFamily: "Arial",
      fontSize: 20,
      fontWeight: 400,
      color: "#172033",
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
      borderRadius: 0,
      textAlign: "left",
      opacity: 1,
      lineHeight: 1.3,
      padding: 0,
      letterSpacing: 0,
      ...input.style,
    },
  }
}

function shape(input: CanvasElementInput): CreatorCanvasElement {
  return {
    id: uid("shape"),
    ...input,
    type: "shape",
    shape: input.shape || "rectangle",
    style: {
      backgroundColor: "#ffffff",
      borderColor: "#d7dee8",
      borderWidth: 1,
      borderRadius: 18,
      opacity: 1,
      ...input.style,
    },
  }
}

function templatePage(template?: CreatorTemplateReference | null) {
  return {
    backgroundImageUrl: template?.imageUrl || null,
    backgroundFileUrl: template?.fileUrl || null,
    backgroundFit: "stretch" as const,
  }
}

function pageBase(name: string, template?: CreatorTemplateReference | null): Omit<CreatorCanvasPage, "id" | "elements"> {
  return {
    name,
    width: 900,
    height: 1200,
    backgroundColor: template?.imageUrl ? "#ffffff" : "#f8fafc",
    ...templatePage(template),
  }
}

function buildCornell(data: any, accent: string, template?: CreatorTemplateReference | null): CreatorCanvasPage {
  const notes = Array.isArray(data?.mainNotes) ? data.mainNotes.slice(0, 10) : []
  const keywords = Array.isArray(data?.keywords) ? data.keywords.slice(0, 8).join(" · ") : ""
  const hasTemplate = Boolean(template?.imageUrl)
  const elements: CreatorCanvasElement[] = []

  elements.push(shape({
    name: "Encabezado",
    type: "shape",
    shape: "rectangle",
    x: 45,
    y: 42,
    width: 810,
    height: 160,
    zIndex: 1,
    style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.88)" : "#ffffff", borderColor: accent, borderWidth: 2, borderRadius: 22, opacity: 0.97 },
  }))
  elements.push(text({
    name: "Título",
    type: "text",
    x: 75,
    y: 70,
    width: 750,
    height: 66,
    zIndex: 20,
    text: data?.title || "Apuntes Cornell",
    binding: "title",
    style: { fontSize: 38, fontWeight: 900, color: "#172033", textAlign: "center", lineHeight: 1.05 },
  }))
  elements.push(text({
    name: "Asignatura",
    type: "text",
    x: 75,
    y: 146,
    width: 360,
    height: 28,
    zIndex: 21,
    text: data?.subject || "Asignatura",
    binding: "subject",
    usesAccent: true,
    style: { fontSize: 15, fontWeight: 800, color: accent },
  }))
  elements.push(text({
    name: "Fecha",
    type: "text",
    x: 465,
    y: 146,
    width: 360,
    height: 28,
    zIndex: 22,
    text: data?.date || "",
    binding: "date",
    style: { fontSize: 15, fontWeight: 650, color: "#475569", textAlign: "right" },
  }))
  if (keywords) {
    elements.push(text({
      name: "Palabras clave",
      type: "text",
      x: 75,
      y: 178,
      width: 750,
      height: 24,
      zIndex: 23,
      text: keywords,
      binding: "keywords",
      bindingMode: "lines",
      style: { fontSize: 11, color: "#64748b", textAlign: "center", letterSpacing: 1 },
    }))
  }

  elements.push(shape({
    name: "Columna de preguntas",
    type: "shape",
    shape: "rectangle",
    x: 45,
    y: 225,
    width: 250,
    height: 700,
    zIndex: 2,
    style: { backgroundColor: hasTemplate ? "rgba(248,250,252,0.9)" : "#eef2f7", borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 18, opacity: 0.97 },
  }))
  elements.push(shape({
    name: "Columna de notas",
    type: "shape",
    shape: "rectangle",
    x: 315,
    y: 225,
    width: 540,
    height: 700,
    zIndex: 2,
    style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.9)" : "#ffffff", borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 18, opacity: 0.97 },
  }))
  elements.push(text({ name: "Etiqueta preguntas", type: "text", x: 67, y: 245, width: 205, height: 28, zIndex: 10, text: "PREGUNTAS CLAVE", style: { fontSize: 11, fontWeight: 900, color: accent, letterSpacing: 1.5 } }))
  elements.push(text({ name: "Etiqueta notas", type: "text", x: 340, y: 245, width: 480, height: 28, zIndex: 10, text: "NOTAS PRINCIPALES", style: { fontSize: 11, fontWeight: 900, color: accent, letterSpacing: 1.5 } }))

  const startY = 292
  const rowHeight = Math.min(114, Math.max(66, 610 / Math.max(1, notes.length)))
  notes.forEach((note: any, index: number) => {
    const y = startY + index * rowHeight
    elements.push(text({
      name: `Pregunta ${index + 1}`,
      type: "text",
      x: 67,
      y,
      width: 205,
      height: rowHeight - 12,
      zIndex: 30 + index * 2,
      text: note?.topic || `Concepto ${index + 1}`,
      binding: `mainNotes[${index}].topic`,
      style: { fontSize: 14, fontWeight: 800, color: "#334155", lineHeight: 1.25, padding: 6 },
    }))
    elements.push(text({
      name: `Nota ${index + 1}`,
      type: "text",
      x: 338,
      y,
      width: 490,
      height: rowHeight - 12,
      zIndex: 31 + index * 2,
      text: note?.notes || "",
      binding: `mainNotes[${index}].notes`,
      style: { fontSize: 13, color: "#475569", lineHeight: 1.35, padding: 6, borderColor: "#e2e8f0", borderWidth: 0 },
    }))
  })

  elements.push(shape({
    name: "Resumen",
    type: "shape",
    shape: "rectangle",
    x: 45,
    y: 952,
    width: 810,
    height: 190,
    zIndex: 2,
    style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.9)" : "#ffffff", borderColor: accent, borderWidth: 2, borderRadius: 20, opacity: 0.97 },
  }))
  elements.push(text({ name: "Etiqueta resumen", type: "text", x: 72, y: 974, width: 750, height: 26, zIndex: 20, text: "RESUMEN", usesAccent: true, style: { fontSize: 11, fontWeight: 900, color: accent, letterSpacing: 1.5 } }))
  elements.push(text({
    name: "Texto del resumen",
    type: "text",
    x: 72,
    y: 1007,
    width: 755,
    height: 110,
    zIndex: 21,
    text: data?.summary || "",
    binding: "summary",
    style: { fontSize: 15, color: "#334155", lineHeight: 1.4, padding: 5 },
  }))

  return { id: uid("cornell"), ...pageBase("Cornell", template), elements }
}

function buildGlossary(data: any, accent: string, template?: CreatorTemplateReference | null): CreatorCanvasPage {
  const terms = Array.isArray(data?.terms) ? data.terms.slice(0, 12) : []
  const hasTemplate = Boolean(template?.imageUrl)
  const elements: CreatorCanvasElement[] = []

  elements.push(text({
    name: "Título",
    type: "text",
    x: 80,
    y: 58,
    width: 740,
    height: 70,
    zIndex: 50,
    text: data?.title || "Glosario",
    binding: "title",
    style: { fontSize: 42, fontWeight: 900, color: "#172033", textAlign: "center" },
  }))
  elements.push(text({
    name: "Asignatura",
    type: "text",
    x: 180,
    y: 134,
    width: 540,
    height: 34,
    zIndex: 51,
    text: data?.subject || "Área de estudio",
    binding: "subject",
    usesAccent: true,
    style: { fontSize: 16, fontWeight: 800, color: accent, textAlign: "center", letterSpacing: 1 },
  }))

  const columns = 2
  const cardWidth = 372
  const cardHeight = 150
  const startY = 205
  const gapX = 30
  const gapY = 22
  terms.forEach((term: any, index: number) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = 63 + column * (cardWidth + gapX)
    const y = startY + row * (cardHeight + gapY)
    elements.push(shape({
      name: `Fondo término ${index + 1}`,
      type: "shape",
      shape: "rectangle",
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      zIndex: 5 + index,
      style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.9)" : "#ffffff", borderColor: accent, borderWidth: 1, borderRadius: 22, opacity: 0.97 },
    }))
    elements.push(text({
      name: `Término ${index + 1}`,
      type: "text",
      x: x + 20,
      y: y + 16,
      width: cardWidth - 40,
      height: 30,
      zIndex: 30 + index * 4,
      text: term?.term || `Concepto ${index + 1}`,
      binding: `terms[${index}].term`,
      usesAccent: true,
      style: { fontSize: 19, fontWeight: 900, color: accent },
    }))
    elements.push(text({
      name: `Categoría ${index + 1}`,
      type: "text",
      x: x + 220,
      y: y + 17,
      width: cardWidth - 240,
      height: 24,
      zIndex: 31 + index * 4,
      text: term?.category || "",
      binding: `terms[${index}].category`,
      style: { fontSize: 10, fontWeight: 800, color: "#64748b", textAlign: "right" },
    }))
    elements.push(text({
      name: `Definición ${index + 1}`,
      type: "text",
      x: x + 20,
      y: y + 52,
      width: cardWidth - 40,
      height: 54,
      zIndex: 32 + index * 4,
      text: term?.definition || "",
      binding: `terms[${index}].definition`,
      style: { fontSize: 13, color: "#475569", lineHeight: 1.3 },
    }))
    elements.push(text({
      name: `Ejemplo ${index + 1}`,
      type: "text",
      x: x + 20,
      y: y + 108,
      width: cardWidth - 40,
      height: 30,
      zIndex: 33 + index * 4,
      text: term?.example || "",
      binding: `terms[${index}].example`,
      style: { fontSize: 11, fontStyle: "italic", color: "#64748b", lineHeight: 1.2 },
    }))
  })

  return { id: uid("glossary"), ...pageBase("Glosario", template), elements }
}

function buildLessonPlan(data: any, accent: string, template?: CreatorTemplateReference | null): CreatorCanvasPage {
  const phases = Array.isArray(data?.phases) ? data.phases.slice(0, 7) : []
  const resources = Array.isArray(data?.resources) ? data.resources.join(" · ") : ""
  const hasTemplate = Boolean(template?.imageUrl)
  const elements: CreatorCanvasElement[] = []

  elements.push(shape({
    name: "Encabezado",
    type: "shape",
    shape: "rectangle",
    x: 0,
    y: 0,
    width: 900,
    height: 205,
    zIndex: 0,
    locked: true,
    usesAccent: true,
    style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.88)" : accent, borderColor: "transparent", borderWidth: 0, borderRadius: 0, opacity: 0.97 },
  }))
  elements.push(text({
    name: "Título",
    type: "text",
    x: 70,
    y: 46,
    width: 760,
    height: 82,
    zIndex: 30,
    text: data?.title || "Plan de clase",
    binding: "title",
    style: { fontSize: 38, fontWeight: 900, color: hasTemplate ? "#172033" : "#ffffff", textAlign: "center", lineHeight: 1.05 },
  }))
  const meta = [data?.subject, data?.grade, data?.duration, data?.bloom].filter(Boolean).join(" · ")
  elements.push(text({
    name: "Datos de la clase",
    type: "text",
    x: 95,
    y: 142,
    width: 710,
    height: 35,
    zIndex: 31,
    text: meta,
    style: { fontSize: 15, fontWeight: 700, color: hasTemplate ? accent : "#e2e8f0", textAlign: "center", letterSpacing: 0.5 },
  }))

  elements.push(shape({ name: "Fondo objetivo", type: "shape", shape: "rectangle", x: 55, y: 232, width: 382, height: 170, zIndex: 2, style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.9)" : "#ffffff", borderColor: accent, borderWidth: 1, borderRadius: 20, opacity: 0.97 } }))
  elements.push(shape({ name: "Fondo evaluación", type: "shape", shape: "rectangle", x: 463, y: 232, width: 382, height: 170, zIndex: 2, style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.9)" : "#ffffff", borderColor: accent, borderWidth: 1, borderRadius: 20, opacity: 0.97 } }))
  elements.push(text({ name: "Etiqueta objetivo", type: "text", x: 78, y: 252, width: 330, height: 24, zIndex: 20, text: "OBJETIVO DE APRENDIZAJE", usesAccent: true, style: { fontSize: 10, fontWeight: 900, color: accent, letterSpacing: 1.2 } }))
  elements.push(text({ name: "Objetivo", type: "text", x: 78, y: 286, width: 330, height: 94, zIndex: 21, text: data?.objective || "", binding: "objective", style: { fontSize: 14, fontWeight: 600, color: "#334155", lineHeight: 1.35 } }))
  elements.push(text({ name: "Etiqueta evaluación", type: "text", x: 486, y: 252, width: 330, height: 24, zIndex: 20, text: "EVALUACIÓN", usesAccent: true, style: { fontSize: 10, fontWeight: 900, color: accent, letterSpacing: 1.2 } }))
  elements.push(text({ name: "Evaluación", type: "text", x: 486, y: 286, width: 330, height: 94, zIndex: 21, text: data?.assessment || "", binding: "assessment", style: { fontSize: 14, color: "#475569", lineHeight: 1.35 } }))

  elements.push(text({ name: "Etiqueta secuencia", type: "text", x: 58, y: 435, width: 784, height: 30, zIndex: 30, text: "SECUENCIA DE APRENDIZAJE", usesAccent: true, style: { fontSize: 13, fontWeight: 900, color: accent, letterSpacing: 1.5 } }))

  const startY = 478
  const phaseHeight = Math.min(120, Math.max(88, 610 / Math.max(1, phases.length)))
  phases.forEach((phase: any, index: number) => {
    const y = startY + index * (phaseHeight + 8)
    elements.push(shape({
      name: `Fondo momento ${index + 1}`,
      type: "shape",
      shape: "rectangle",
      x: 55,
      y,
      width: 790,
      height: phaseHeight,
      zIndex: 5 + index,
      style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.9)" : "#ffffff", borderColor: "#d7dee8", borderWidth: 1, borderRadius: 18, opacity: 0.97 },
    }))
    elements.push(shape({
      name: `Número ${index + 1}`,
      type: "shape",
      shape: "circle",
      x: 75,
      y: y + 18,
      width: 54,
      height: 54,
      zIndex: 30 + index * 5,
      usesAccent: true,
      style: { backgroundColor: accent, borderColor: "transparent", borderWidth: 0, borderRadius: 999 },
    }))
    elements.push(text({ name: `Número texto ${index + 1}`, type: "text", x: 88, y: y + 32, width: 28, height: 25, zIndex: 31 + index * 5, text: String(index + 1), style: { fontSize: 18, fontWeight: 900, color: "#ffffff", textAlign: "center" } }))
    elements.push(text({ name: `Nombre momento ${index + 1}`, type: "text", x: 150, y: y + 15, width: 240, height: 28, zIndex: 32 + index * 5, text: phase?.name || `Momento ${index + 1}`, binding: `phases[${index}].name`, usesAccent: true, style: { fontSize: 17, fontWeight: 900, color: accent } }))
    elements.push(text({ name: `Duración ${index + 1}`, type: "text", x: 650, y: y + 16, width: 160, height: 26, zIndex: 33 + index * 5, text: phase?.duration || "", binding: `phases[${index}].duration`, style: { fontSize: 11, fontWeight: 800, color: "#64748b", textAlign: "right" } }))
    elements.push(text({ name: `Actividad ${index + 1}`, type: "text", x: 150, y: y + 45, width: 470, height: phaseHeight - 55, zIndex: 34 + index * 5, text: phase?.activity || "", binding: `phases[${index}].activity`, style: { fontSize: 13, color: "#475569", lineHeight: 1.3 } }))
    elements.push(text({ name: `Materiales ${index + 1}`, type: "text", x: 640, y: y + 48, width: 170, height: phaseHeight - 60, zIndex: 35 + index * 5, text: phase?.materials || "", binding: `phases[${index}].materials`, style: { fontSize: 10, color: "#64748b", textAlign: "right", lineHeight: 1.25 } }))
  })

  if (resources) {
    elements.push(text({
      name: "Recursos",
      type: "text",
      x: 65,
      y: 1135,
      width: 770,
      height: 36,
      zIndex: 80,
      text: resources,
      binding: "resources",
      bindingMode: "lines",
      style: { fontSize: 11, color: "#64748b", textAlign: "center", backgroundColor: hasTemplate ? "rgba(255,255,255,0.85)" : "transparent", borderRadius: 10, padding: 6 },
    }))
  }

  return { id: uid("lessonplan"), ...pageBase("Plan de clase", template), elements }
}

export function createDirectDocumentCanvas(
  data: any,
  format: DirectDocumentFormat,
  accent: string,
  template?: CreatorTemplateReference | null,
) {
  const page = format === "cornell"
    ? buildCornell(data, accent, template)
    : format === "glossary"
      ? buildGlossary(data, accent, template)
      : buildLessonPlan(data, accent, template)
  return { version: 1, format, pages: [page] }
}

export function ensureDirectDocumentCanvasData(
  data: any,
  format: DirectDocumentFormat,
  accent: string,
  template?: CreatorTemplateReference | null,
) {
  if (!data || typeof data !== "object") return data
  if (data?._canvas?.version === 1 && Array.isArray(data?._canvas?.pages)) return data
  return { ...data, _canvas: createDirectDocumentCanvas(data, format, accent, template) }
}
