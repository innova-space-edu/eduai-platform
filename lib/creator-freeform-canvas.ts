import type {
  CreatorCanvasElement,
  CreatorCanvasElementStyle,
  CreatorCanvasPage,
  CreatorTemplateReference,
} from "@/lib/creator-canvas"

export type FreeformVisualFormat = "poster" | "mindmap" | "timeline"

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
      fontSize: 24,
      fontWeight: 500,
      color: "#172033",
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
      borderRadius: 0,
      textAlign: "left",
      opacity: 1,
      lineHeight: 1.25,
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
      borderRadius: 20,
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

function buildPoster(data: any, accent: string, template?: CreatorTemplateReference | null): CreatorCanvasPage {
  const points = Array.isArray(data?.mainPoints) ? data.mainPoints.slice(0, 8) : []
  const hasTemplate = Boolean(template?.imageUrl)
  const elements: CreatorCanvasElement[] = []

  if (!hasTemplate) {
    elements.push(shape({
      name: "Fondo superior",
      type: "shape",
      shape: "rectangle",
      x: 0,
      y: 0,
      width: 900,
      height: 310,
      zIndex: 0,
      locked: true,
      usesAccent: true,
      style: { backgroundColor: accent, borderColor: "transparent", borderWidth: 0, borderRadius: 0, opacity: 0.95 },
    }))
  }

  elements.push(text({
    name: "Título principal",
    type: "text",
    x: 70,
    y: 70,
    width: 760,
    height: 130,
    zIndex: 20,
    text: data?.headline || "Afiche educativo",
    binding: "headline",
    style: { fontSize: 48, fontWeight: 900, color: hasTemplate ? "#172033" : "#ffffff", textAlign: "center", lineHeight: 1.05 },
  }))

  elements.push(text({
    name: "Bajada",
    type: "text",
    x: 120,
    y: 210,
    width: 660,
    height: 72,
    zIndex: 21,
    text: data?.tagline || "",
    binding: "tagline",
    style: { fontSize: 21, color: hasTemplate ? "#475569" : "#e2e8f0", textAlign: "center", lineHeight: 1.3 },
  }))

  const columns = points.length > 1 ? 2 : 1
  const cardWidth = columns === 2 ? 365 : 760
  const startY = 350
  const rowHeight = 205
  points.forEach((point: any, index: number) => {
    const column = columns === 2 ? index % 2 : 0
    const row = columns === 2 ? Math.floor(index / 2) : index
    const x = columns === 2 ? 70 + column * 395 : 70
    const y = startY + row * 230
    elements.push(shape({
      name: `Fondo bloque ${index + 1}`,
      type: "shape",
      shape: "rectangle",
      x,
      y,
      width: cardWidth,
      height: rowHeight,
      zIndex: 5 + index,
      style: {
        backgroundColor: hasTemplate ? "rgba(255,255,255,0.88)" : "#ffffff",
        borderColor: `${accent}`,
        borderWidth: 1,
        borderRadius: 24,
        opacity: 0.96,
      },
    }))
    elements.push(text({
      name: `Ícono ${index + 1}`,
      type: "text",
      x: x + 20,
      y: y + 18,
      width: 58,
      height: 55,
      zIndex: 30 + index * 4,
      text: point?.icon || "✦",
      binding: `mainPoints[${index}].icon`,
      usesAccent: true,
      style: { fontSize: 31, color: accent, textAlign: "center", backgroundColor: `${accent}18`, borderRadius: 14, padding: 6 },
    }))
    elements.push(text({
      name: `Título bloque ${index + 1}`,
      type: "text",
      x: x + 90,
      y: y + 18,
      width: cardWidth - 110,
      height: 58,
      zIndex: 31 + index * 4,
      text: point?.title || `Punto ${index + 1}`,
      binding: `mainPoints[${index}].title`,
      style: { fontSize: 19, fontWeight: 800, color: "#172033", lineHeight: 1.15 },
    }))
    elements.push(text({
      name: `Descripción ${index + 1}`,
      type: "text",
      x: x + 22,
      y: y + 83,
      width: cardWidth - 44,
      height: 78,
      zIndex: 32 + index * 4,
      text: point?.description || "",
      binding: `mainPoints[${index}].description`,
      style: { fontSize: 14, color: "#475569", lineHeight: 1.35 },
    }))
    elements.push(text({
      name: `Dato ${index + 1}`,
      type: "text",
      x: x + 22,
      y: y + 160,
      width: cardWidth - 44,
      height: 32,
      zIndex: 33 + index * 4,
      text: point?.stat || "",
      binding: `mainPoints[${index}].stat`,
      usesAccent: true,
      style: { fontSize: 18, fontWeight: 900, color: accent, textAlign: "center" },
    }))
  })

  if (data?.callToAction) {
    elements.push(shape({
      name: "Fondo llamado",
      type: "shape",
      shape: "rectangle",
      x: 90,
      y: 1070,
      width: 720,
      height: 78,
      zIndex: 80,
      usesAccent: true,
      style: { backgroundColor: accent, borderColor: "transparent", borderWidth: 0, borderRadius: 28 },
    }))
    elements.push(text({
      name: "Llamado a la acción",
      type: "text",
      x: 125,
      y: 1087,
      width: 650,
      height: 45,
      zIndex: 81,
      text: data.callToAction,
      binding: "callToAction",
      style: { fontSize: 22, fontWeight: 850, color: "#ffffff", textAlign: "center" },
    }))
  }

  return {
    id: uid("poster"),
    name: "Afiche",
    width: 900,
    height: 1200,
    backgroundColor: hasTemplate ? "#ffffff" : "#f8fafc",
    ...templatePage(template),
    elements,
  }
}

function buildMindmap(data: any, accent: string, template?: CreatorTemplateReference | null): CreatorCanvasPage {
  const nodes = Array.isArray(data?.nodes) ? data.nodes.slice(0, 14) : []
  const hasTemplate = Boolean(template?.imageUrl)
  const centerX = 640
  const centerY = 430
  const elements: CreatorCanvasElement[] = []
  const mainNode = nodes.find((node: any) => node?.category === "main") || nodes[0]
  const secondary = nodes.filter((node: any) => node !== mainNode)

  elements.push(text({
    name: "Título del mapa",
    type: "text",
    x: 170,
    y: 35,
    width: 940,
    height: 70,
    zIndex: 100,
    text: data?.centralTopic || data?.title || "Mapa mental",
    binding: data?.centralTopic ? "centralTopic" : "title",
    style: { fontSize: 37, fontWeight: 900, color: hasTemplate ? "#172033" : "#0f172a", textAlign: "center" },
  }))

  secondary.forEach((node: any, index: number) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, secondary.length) - Math.PI / 2
    const radiusX = secondary.length > 8 ? 465 : 420
    const radiusY = secondary.length > 8 ? 300 : 270
    const width = 215
    const height = 105
    const x = centerX + Math.cos(angle) * radiusX - width / 2
    const y = centerY + Math.sin(angle) * radiusY - height / 2
    const nodeColor = node?.color || accent

    elements.push(shape({
      name: `Conexión ${index + 1}`,
      type: "shape",
      shape: "line",
      x: Math.min(centerX, x + width / 2),
      y: Math.min(centerY, y + height / 2),
      width: Math.abs(x + width / 2 - centerX),
      height: 5,
      rotation: Math.atan2(y + height / 2 - centerY, x + width / 2 - centerX) * 180 / Math.PI,
      zIndex: 1,
      locked: true,
      style: { backgroundColor: `${nodeColor}`, borderColor: "transparent", borderWidth: 0, borderRadius: 0, opacity: 0.45 },
    }))
    elements.push(shape({
      name: `Fondo nodo ${index + 1}`,
      type: "shape",
      shape: "rectangle",
      x,
      y,
      width,
      height,
      zIndex: 10 + index,
      style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.9)" : "#ffffff", borderColor: nodeColor, borderWidth: 2, borderRadius: 22, opacity: 0.97 },
    }))
    elements.push(text({
      name: `Concepto ${index + 1}`,
      type: "text",
      x: x + 18,
      y: y + 18,
      width: width - 36,
      height: 34,
      zIndex: 30 + index * 2,
      text: node?.label || `Concepto ${index + 1}`,
      binding: `nodes[${nodes.indexOf(node)}].label`,
      style: { fontSize: 17, fontWeight: 850, color: nodeColor, textAlign: "center", lineHeight: 1.1 },
    }))
    elements.push(text({
      name: `Descripción ${index + 1}`,
      type: "text",
      x: x + 17,
      y: y + 54,
      width: width - 34,
      height: 38,
      zIndex: 31 + index * 2,
      text: node?.description || "",
      binding: `nodes[${nodes.indexOf(node)}].description`,
      style: { fontSize: 11, color: "#475569", textAlign: "center", lineHeight: 1.2 },
    }))
  })

  elements.push(shape({
    name: "Fondo del concepto central",
    type: "shape",
    shape: "circle",
    x: centerX - 145,
    y: centerY - 95,
    width: 290,
    height: 190,
    zIndex: 70,
    usesAccent: true,
    style: { backgroundColor: accent, borderColor: "#ffffff", borderWidth: 5, borderRadius: 999, opacity: 0.98 },
  }))
  elements.push(text({
    name: "Concepto central",
    type: "text",
    x: centerX - 115,
    y: centerY - 50,
    width: 230,
    height: 100,
    zIndex: 72,
    text: mainNode?.label || data?.centralTopic || "Tema central",
    binding: mainNode ? `nodes[${nodes.indexOf(mainNode)}].label` : "centralTopic",
    style: { fontSize: 24, fontWeight: 900, color: "#ffffff", textAlign: "center", lineHeight: 1.15 },
  }))

  return {
    id: uid("mindmap"),
    name: "Mapa mental",
    width: 1280,
    height: 850,
    backgroundColor: hasTemplate ? "#ffffff" : "#f1f5f9",
    ...templatePage(template),
    elements,
  }
}

function buildTimeline(data: any, accent: string, template?: CreatorTemplateReference | null): CreatorCanvasPage {
  const events = Array.isArray(data?.events) ? data.events.slice(0, 10) : []
  const hasTemplate = Boolean(template?.imageUrl)
  const elements: CreatorCanvasElement[] = []

  elements.push(text({
    name: "Título",
    type: "text",
    x: 90,
    y: 55,
    width: 720,
    height: 80,
    zIndex: 60,
    text: data?.title || "Línea de tiempo",
    binding: "title",
    style: { fontSize: 40, fontWeight: 900, color: "#172033", textAlign: "center" },
  }))
  elements.push(text({
    name: "Periodo",
    type: "text",
    x: 220,
    y: 140,
    width: 460,
    height: 42,
    zIndex: 61,
    text: data?.period || "",
    binding: "period",
    usesAccent: true,
    style: { fontSize: 17, fontWeight: 800, color: accent, textAlign: "center", letterSpacing: 1 },
  }))
  elements.push(shape({
    name: "Eje temporal",
    type: "shape",
    shape: "line",
    x: 445,
    y: 220,
    width: 10,
    height: 850,
    zIndex: 1,
    locked: true,
    usesAccent: true,
    style: { backgroundColor: accent, borderColor: "transparent", borderWidth: 0, borderRadius: 999, opacity: 0.4 },
  }))

  const startY = 230
  const gap = events.length > 7 ? 95 : 112
  events.forEach((event: any, index: number) => {
    const left = index % 2 === 0
    const cardWidth = 330
    const x = left ? 70 : 500
    const y = startY + index * gap
    const eventColor = event?.importance === "high" ? "#b91c1c" : event?.importance === "medium" ? "#a16207" : accent

    elements.push(shape({
      name: `Marcador ${index + 1}`,
      type: "shape",
      shape: "circle",
      x: 427,
      y: y + 28,
      width: 46,
      height: 46,
      zIndex: 40,
      style: { backgroundColor: eventColor, borderColor: "#ffffff", borderWidth: 5, borderRadius: 999 },
    }))
    elements.push(shape({
      name: `Fondo evento ${index + 1}`,
      type: "shape",
      shape: "rectangle",
      x,
      y,
      width: cardWidth,
      height: 100,
      zIndex: 10 + index,
      style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.91)" : "#ffffff", borderColor: eventColor, borderWidth: 1, borderRadius: 20, opacity: 0.98 },
    }))
    elements.push(text({
      name: `Fecha ${index + 1}`,
      type: "text",
      x: x + 18,
      y: y + 13,
      width: cardWidth - 36,
      height: 24,
      zIndex: 30 + index * 3,
      text: event?.date || "Fecha",
      binding: `events[${index}].date`,
      style: { fontSize: 12, fontWeight: 900, color: eventColor, textAlign: left ? "right" : "left" },
    }))
    elements.push(text({
      name: `Título evento ${index + 1}`,
      type: "text",
      x: x + 18,
      y: y + 38,
      width: cardWidth - 36,
      height: 28,
      zIndex: 31 + index * 3,
      text: event?.title || `Evento ${index + 1}`,
      binding: `events[${index}].title`,
      style: { fontSize: 17, fontWeight: 850, color: "#172033", textAlign: left ? "right" : "left" },
    }))
    elements.push(text({
      name: `Descripción evento ${index + 1}`,
      type: "text",
      x: x + 18,
      y: y + 66,
      width: cardWidth - 36,
      height: 28,
      zIndex: 32 + index * 3,
      text: event?.description || "",
      binding: `events[${index}].description`,
      style: { fontSize: 11, color: "#475569", textAlign: left ? "right" : "left", lineHeight: 1.15 },
    }))
  })

  return {
    id: uid("timeline"),
    name: "Timeline",
    width: 900,
    height: 1200,
    backgroundColor: hasTemplate ? "#ffffff" : "#f8fafc",
    ...templatePage(template),
    elements,
  }
}

export function createFreeformVisualCanvas(
  data: any,
  format: FreeformVisualFormat,
  accent: string,
  template?: CreatorTemplateReference | null,
) {
  const page = format === "poster"
    ? buildPoster(data, accent, template)
    : format === "mindmap"
      ? buildMindmap(data, accent, template)
      : buildTimeline(data, accent, template)
  return {
    version: 1,
    format,
    pages: [page],
  }
}

export function ensureFreeformVisualCanvasData(
  data: any,
  format: FreeformVisualFormat,
  accent: string,
  template?: CreatorTemplateReference | null,
) {
  if (!data || typeof data !== "object") return data
  if (data?._canvas?.version === 1 && Array.isArray(data?._canvas?.pages)) return data
  return {
    ...data,
    _canvas: createFreeformVisualCanvas(data, format, accent, template),
  }
}
