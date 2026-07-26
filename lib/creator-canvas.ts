export type CreatorCanvasElementType = "text" | "shape" | "image"
export type CreatorCanvasShape = "rectangle" | "circle" | "line"
export type CreatorCanvasTextAlign = "left" | "center" | "right" | "justify"

export type CreatorCanvasElementStyle = {
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  fontStyle?: "normal" | "italic"
  textDecoration?: "none" | "underline"
  color?: string
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  textAlign?: CreatorCanvasTextAlign
  opacity?: number
  lineHeight?: number
  padding?: number
  letterSpacing?: number
}

export type CreatorCanvasElement = {
  id: string
  type: CreatorCanvasElementType
  shape?: CreatorCanvasShape
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  zIndex: number
  text?: string
  src?: string
  binding?: string
  bindingMode?: "text" | "lines"
  hidden?: boolean
  locked?: boolean
  usesAccent?: boolean
  style: CreatorCanvasElementStyle
}

export type CreatorCanvasPage = {
  id: string
  name: string
  width: number
  height: number
  backgroundColor: string
  backgroundImageUrl?: string | null
  backgroundFileUrl?: string | null
  backgroundFit?: "cover" | "contain" | "stretch"
  elements: CreatorCanvasElement[]
}

export type CreatorCanvasState = {
  version: 1
  format: "infographic" | "ppt"
  pages: CreatorCanvasPage[]
}

export type CreatorTemplateReference = {
  id: string
  name?: string
  imageUrl?: string | null
  fileUrl?: string | null
  fileKind?: string | null
  accentColor?: string
  secondaryColor?: string
  instructions?: string | null
}

const uid = (prefix: string) =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function textElement(input: Omit<CreatorCanvasElement, "id" | "type" | "style"> & { style?: CreatorCanvasElementStyle }): CreatorCanvasElement {
  return {
    id: uid("text"),
    type: "text",
    style: {
      fontFamily: "Arial",
      fontSize: 28,
      fontWeight: 500,
      color: "#172033",
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
      borderRadius: 0,
      textAlign: "left",
      opacity: 1,
      lineHeight: 1.2,
      padding: 0,
      letterSpacing: 0,
      ...input.style,
    },
    ...input,
  }
}

function shapeElement(input: Omit<CreatorCanvasElement, "id" | "type" | "style"> & { style?: CreatorCanvasElementStyle }): CreatorCanvasElement {
  return {
    id: uid("shape"),
    type: "shape",
    shape: input.shape || "rectangle",
    style: {
      backgroundColor: "#ffffff",
      borderColor: "#d7dee8",
      borderWidth: 1,
      borderRadius: 24,
      opacity: 0.94,
      ...input.style,
    },
    ...input,
  }
}

function getPathParts(path: string) {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
}

export function getCreatorValueAtPath(source: any, path?: string) {
  if (!path) return undefined
  return getPathParts(path).reduce((current, key) => current?.[key], source)
}

export function setCreatorValueAtPath(source: any, path: string, value: unknown) {
  const parts = getPathParts(path)
  if (parts.length === 0) return source
  const root = structuredClone(source)
  let current = root
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index]
    const nextKey = parts[index + 1]
    if (current[key] == null || typeof current[key] !== "object") {
      current[key] = /^\d+$/.test(nextKey) ? [] : {}
    }
    current = current[key]
  }
  current[parts.at(-1)!] = value
  return root
}

function templateBackground(template?: CreatorTemplateReference | null) {
  return {
    backgroundImageUrl: template?.imageUrl || null,
    backgroundFileUrl: template?.fileUrl || null,
    backgroundFit: "stretch" as const,
  }
}

function buildInfographicPage(data: any, accentColor: string, template?: CreatorTemplateReference | null): CreatorCanvasPage {
  const sections = Array.isArray(data?.sections) ? data.sections.slice(0, 6) : []
  const elements: CreatorCanvasElement[] = []
  const hasTemplate = Boolean(template?.imageUrl)
  const titleColor = hasTemplate ? "#172033" : "#f8fafc"
  const bodyColor = hasTemplate ? "#334155" : "#d9e4f3"
  const cardBackground = hasTemplate ? "rgba(255,255,255,0.86)" : "rgba(19,35,57,0.93)"
  const canvasBackground = hasTemplate ? "#ffffff" : "#081426"

  if (!hasTemplate) {
    elements.push(shapeElement({
      name: "Fondo decorativo",
      x: 0,
      y: 0,
      width: 900,
      height: 250,
      zIndex: 0,
      locked: true,
      usesAccent: true,
      style: { backgroundColor: accentColor, borderColor: "transparent", borderWidth: 0, borderRadius: 0, opacity: 0.16 },
    }))
  }

  elements.push(textElement({
    name: "Título",
    x: 80,
    y: 62,
    width: 740,
    height: 100,
    zIndex: 20,
    text: data?.title || "Infografía",
    binding: "title",
    style: { fontFamily: "Arial", fontSize: 42, fontWeight: 800, color: titleColor, textAlign: "center", lineHeight: 1.05 },
  }))

  elements.push(textElement({
    name: "Subtítulo",
    x: 130,
    y: 172,
    width: 640,
    height: 58,
    zIndex: 21,
    text: data?.subtitle || "",
    binding: "subtitle",
    style: { fontFamily: "Arial", fontSize: 19, fontWeight: 400, color: bodyColor, textAlign: "center", lineHeight: 1.3 },
  }))

  if (data?.keyFact) {
    elements.push(shapeElement({
      name: "Fondo del dato destacado",
      x: 70,
      y: 252,
      width: 760,
      height: 112,
      zIndex: 10,
      usesAccent: true,
      style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.9)" : "rgba(24,42,67,0.94)", borderColor: accentColor, borderWidth: 2, borderRadius: 22, opacity: 1 },
    }))
    elements.push(textElement({
      name: "Dato destacado",
      x: 105,
      y: 277,
      width: 690,
      height: 64,
      zIndex: 22,
      text: data.keyFact,
      binding: "keyFact",
      usesAccent: false,
      style: { fontFamily: "Arial", fontSize: 18, fontWeight: 700, color: hasTemplate ? "#172033" : "#f8fafc", textAlign: "center", lineHeight: 1.25 },
    }))
  }

  const startY = data?.keyFact ? 398 : 270
  const columns = sections.length > 1 ? 2 : 1
  const cardWidth = columns === 2 ? 365 : 760
  const gapX = 30
  const rowHeight = 238

  sections.forEach((section: any, index: number) => {
    const column = columns === 2 ? index % 2 : 0
    const row = columns === 2 ? Math.floor(index / 2) : index
    const x = columns === 2 ? 70 + column * (cardWidth + gapX) : 70
    const y = startY + row * (rowHeight + 24)
    const points = Array.isArray(section?.points) ? section.points.join("\n") : ""

    elements.push(shapeElement({
      name: `Fondo sección ${index + 1}`,
      x,
      y,
      width: cardWidth,
      height: rowHeight,
      zIndex: 5 + index,
      locked: false,
      style: { backgroundColor: cardBackground, borderColor: hasTemplate ? "#d8dee8" : "rgba(255,255,255,0.16)", borderWidth: 1, borderRadius: 24, opacity: 1 },
    }))
    elements.push(textElement({
      name: `Ícono ${index + 1}`,
      x: x + 20,
      y: y + 18,
      width: 54,
      height: 48,
      zIndex: 30 + index * 5,
      text: section?.icon || "●",
      binding: `sections[${index}].icon`,
      style: { fontSize: 30, textAlign: "center", color: accentColor, backgroundColor: `${accentColor}18`, borderRadius: 14, padding: 6 },
    }))
    elements.push(textElement({
      name: `Encabezado ${index + 1}`,
      x: x + 88,
      y: y + 18,
      width: cardWidth - 108,
      height: 54,
      zIndex: 31 + index * 5,
      text: section?.heading || `Sección ${index + 1}`,
      binding: `sections[${index}].heading`,
      style: { fontSize: 19, fontWeight: 800, color: hasTemplate ? "#172033" : "#f8fafc", lineHeight: 1.15 },
    }))
    elements.push(textElement({
      name: `Cifra ${index + 1}`,
      x: x + 22,
      y: y + 83,
      width: cardWidth - 44,
      height: 52,
      zIndex: 32 + index * 5,
      text: section?.stat?.value || "",
      binding: `sections[${index}].stat.value`,
      usesAccent: true,
      style: { fontSize: 30, fontWeight: 900, color: accentColor, textAlign: "center", lineHeight: 1 },
    }))
    elements.push(textElement({
      name: `Ideas ${index + 1}`,
      x: x + 24,
      y: y + 138,
      width: cardWidth - 48,
      height: 80,
      zIndex: 33 + index * 5,
      text: points,
      binding: `sections[${index}].points`,
      bindingMode: "lines",
      style: { fontSize: 14, fontWeight: 400, color: hasTemplate ? "#334155" : "#d4deec", lineHeight: 1.35, padding: 2 },
    }))
  })

  const rows = Math.max(1, Math.ceil(sections.length / columns))
  const conclusionY = clamp(startY + rows * (rowHeight + 24) + 4, 980, 1080)
  if (data?.conclusion) {
    elements.push(textElement({
      name: "Conclusión",
      x: 85,
      y: conclusionY,
      width: 730,
      height: 82,
      zIndex: 70,
      text: data.conclusion,
      binding: "conclusion",
      style: { fontSize: 16, fontWeight: 500, fontStyle: "italic", color: hasTemplate ? "#334155" : "#cbd5e1", backgroundColor: hasTemplate ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.06)", borderColor: hasTemplate ? "#d8dee8" : "rgba(255,255,255,0.12)", borderWidth: 1, borderRadius: 18, textAlign: "center", padding: 18, lineHeight: 1.3 },
    }))
  }

  return {
    id: uid("page"),
    name: "Infografía",
    width: 900,
    height: 1200,
    backgroundColor: canvasBackground,
    ...templateBackground(template),
    elements,
  }
}

function buildPresentationPage(data: any, slide: any, slideIndex: number, accentColor: string, template?: CreatorTemplateReference | null): CreatorCanvasPage {
  const hasTemplate = Boolean(template?.imageUrl)
  const elements: CreatorCanvasElement[] = []
  const pageId = slide?.id || uid("slide")
  const titleBinding = `slides[${slideIndex}].title`
  const subtitleBinding = `slides[${slideIndex}].subtitle`
  const bulletsBinding = `slides[${slideIndex}].bullets`

  if (!hasTemplate) {
    elements.push(shapeElement({
      name: "Franja superior",
      x: 0,
      y: 0,
      width: 1280,
      height: 18,
      zIndex: 0,
      locked: true,
      usesAccent: true,
      style: { backgroundColor: accentColor, borderColor: "transparent", borderWidth: 0, borderRadius: 0, opacity: 1 },
    }))
    elements.push(shapeElement({
      name: "Decoración",
      x: 1000,
      y: -180,
      width: 420,
      height: 420,
      zIndex: 0,
      shape: "circle",
      locked: true,
      usesAccent: true,
      style: { backgroundColor: accentColor, borderColor: "transparent", borderWidth: 0, borderRadius: 999, opacity: 0.1 },
    }))
  }

  const isTitle = slideIndex === 0 || slide?.type === "title"
  if (isTitle) {
    elements.push(textElement({
      name: "Título de diapositiva",
      x: 130,
      y: 190,
      width: 1020,
      height: 150,
      zIndex: 20,
      text: slide?.title || data?.title || "Presentación",
      binding: titleBinding,
      style: { fontSize: 54, fontWeight: 850, color: hasTemplate ? "#172033" : "#f8fafc", textAlign: "center", lineHeight: 1.08 },
    }))
    elements.push(textElement({
      name: "Subtítulo de diapositiva",
      x: 210,
      y: 370,
      width: 860,
      height: 92,
      zIndex: 21,
      text: slide?.subtitle || "",
      binding: subtitleBinding,
      style: { fontSize: 25, fontWeight: 400, color: hasTemplate ? "#475569" : "#cbd5e1", textAlign: "center", lineHeight: 1.3 },
    }))
    if (data?.author) {
      elements.push(textElement({
        name: "Autor",
        x: 390,
        y: 525,
        width: 500,
        height: 50,
        zIndex: 22,
        text: data.author,
        binding: "author",
        usesAccent: true,
        style: { fontSize: 18, fontWeight: 700, color: accentColor, textAlign: "center", letterSpacing: 2 },
      }))
    }
  } else {
    elements.push(textElement({
      name: "Título de diapositiva",
      x: 90,
      y: 72,
      width: 1040,
      height: 90,
      zIndex: 20,
      text: slide?.title || `Diapositiva ${slideIndex + 1}`,
      binding: titleBinding,
      style: { fontSize: 38, fontWeight: 850, color: hasTemplate ? "#172033" : "#f8fafc", lineHeight: 1.12 },
    }))
    if (slide?.subtitle) {
      elements.push(textElement({
        name: "Subtítulo de diapositiva",
        x: 92,
        y: 164,
        width: 1030,
        height: 58,
        zIndex: 21,
        text: slide.subtitle,
        binding: subtitleBinding,
        style: { fontSize: 21, fontWeight: 400, color: hasTemplate ? "#475569" : "#cbd5e1", lineHeight: 1.3 },
      }))
    }
    elements.push(shapeElement({
      name: "Fondo del contenido",
      x: 86,
      y: 235,
      width: 1100,
      height: 390,
      zIndex: 8,
      style: { backgroundColor: hasTemplate ? "rgba(255,255,255,0.84)" : "rgba(255,255,255,0.07)", borderColor: hasTemplate ? "#d8dee8" : "rgba(255,255,255,0.13)", borderWidth: 1, borderRadius: 28, opacity: 1 },
    }))
    elements.push(textElement({
      name: "Contenido",
      x: 125,
      y: 270,
      width: 1020,
      height: 320,
      zIndex: 22,
      text: Array.isArray(slide?.bullets) ? slide.bullets.join("\n") : "",
      binding: bulletsBinding,
      bindingMode: "lines",
      style: { fontSize: 25, fontWeight: 450, color: hasTemplate ? "#334155" : "#dce5f2", lineHeight: 1.55, padding: 10 },
    }))
  }

  return {
    id: pageId,
    name: slide?.title || `Diapositiva ${slideIndex + 1}`,
    width: 1280,
    height: 720,
    backgroundColor: hasTemplate ? "#ffffff" : "#081426",
    ...templateBackground(template),
    elements,
  }
}

export function createVisualCanvasState(
  data: any,
  format: "infographic" | "ppt",
  accentColor: string,
  template?: CreatorTemplateReference | null,
): CreatorCanvasState {
  if (format === "infographic") {
    return { version: 1, format, pages: [buildInfographicPage(data, accentColor, template)] }
  }
  const slides = Array.isArray(data?.slides) ? data.slides : []
  return {
    version: 1,
    format,
    pages: slides.map((slide: any, index: number) => buildPresentationPage(data, slide, index, accentColor, template)),
  }
}

export function ensureVisualCanvasData(
  data: any,
  format: "infographic" | "ppt",
  accentColor: string,
  template?: CreatorTemplateReference | null,
) {
  if (!data || typeof data !== "object") return data
  if (data?._canvas?.version === 1 && Array.isArray(data?._canvas?.pages)) {
    return refreshVisualCanvasBindings(data)
  }
  return { ...data, _canvas: createVisualCanvasState(data, format, accentColor, template) }
}

export function refreshVisualCanvasBindings(data: any) {
  if (!data?._canvas?.pages) return data
  const next = structuredClone(data)
  next._canvas.pages = next._canvas.pages.map((page: CreatorCanvasPage) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (!element.binding) return element
      const bound = getCreatorValueAtPath(next, element.binding)
      const text = element.bindingMode === "lines"
        ? Array.isArray(bound) ? bound.join("\n") : String(bound || "")
        : String(bound ?? "")
      return { ...element, text }
    }),
  }))
  return next
}

export function updateCanvasElement(
  data: any,
  pageIndex: number,
  elementId: string,
  patch: Partial<CreatorCanvasElement>,
) {
  const next = structuredClone(data)
  const page = next?._canvas?.pages?.[pageIndex] as CreatorCanvasPage | undefined
  if (!page) return data
  const elementIndex = page.elements.findIndex((element) => element.id === elementId)
  if (elementIndex < 0) return data
  const previous = page.elements[elementIndex]
  const updated = { ...previous, ...patch, style: patch.style ? { ...previous.style, ...patch.style } : previous.style }
  page.elements[elementIndex] = updated

  if (patch.text !== undefined && updated.binding) {
    const value = updated.bindingMode === "lines"
      ? patch.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      : patch.text
    return setCreatorValueAtPath(next, updated.binding, value)
  }
  return next
}

export function updateCanvasPage(data: any, pageIndex: number, patch: Partial<CreatorCanvasPage>) {
  const next = structuredClone(data)
  const page = next?._canvas?.pages?.[pageIndex]
  if (!page) return data
  next._canvas.pages[pageIndex] = { ...page, ...patch }
  return next
}

export function addCanvasElement(data: any, pageIndex: number, element: CreatorCanvasElement) {
  const next = structuredClone(data)
  const page = next?._canvas?.pages?.[pageIndex]
  if (!page) return data
  page.elements.push(element)
  return next
}

export function removeCanvasElement(data: any, pageIndex: number, elementId: string) {
  const next = structuredClone(data)
  const page = next?._canvas?.pages?.[pageIndex]
  if (!page) return data
  page.elements = page.elements.filter((element: CreatorCanvasElement) => element.id !== elementId)
  return next
}

export function duplicateCanvasElement(data: any, pageIndex: number, elementId: string) {
  const next = structuredClone(data)
  const page = next?._canvas?.pages?.[pageIndex]
  if (!page) return data
  const source = page.elements.find((element: CreatorCanvasElement) => element.id === elementId)
  if (!source) return data
  page.elements.push({ ...structuredClone(source), id: uid(source.type), name: `${source.name} copia`, x: source.x + 24, y: source.y + 24, binding: undefined, zIndex: Math.max(...page.elements.map((element: CreatorCanvasElement) => element.zIndex), 0) + 1 })
  return next
}

export function reorderCanvasElement(data: any, pageIndex: number, elementId: string, direction: "front" | "back" | "forward" | "backward") {
  const next = structuredClone(data)
  const page = next?._canvas?.pages?.[pageIndex]
  if (!page) return data
  const elements = page.elements as CreatorCanvasElement[]
  const source = elements.find((element) => element.id === elementId)
  if (!source) return data
  const levels = elements.map((element) => element.zIndex)
  const min = Math.min(...levels, 0)
  const max = Math.max(...levels, 0)
  if (direction === "front") source.zIndex = max + 1
  if (direction === "back") source.zIndex = min - 1
  if (direction === "forward") source.zIndex += 1
  if (direction === "backward") source.zIndex -= 1
  return next
}

export function applyCanvasAccent(data: any, accentColor: string) {
  if (!data?._canvas?.pages) return data
  const next = structuredClone(data)
  next._canvas.pages = next._canvas.pages.map((page: CreatorCanvasPage) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (!element.usesAccent) return element
      const style = { ...element.style }
      if (element.type === "shape") style.backgroundColor = accentColor
      else style.color = accentColor
      if (style.borderColor && style.borderColor !== "transparent") style.borderColor = accentColor
      return { ...element, style }
    }),
  }))
  return next
}

export function applyCanvasTemplate(data: any, template?: CreatorTemplateReference | null) {
  if (!data?._canvas?.pages) return data
  const next = structuredClone(data)
  next._canvas.pages = next._canvas.pages.map((page: CreatorCanvasPage) => ({
    ...page,
    backgroundImageUrl: template?.imageUrl || null,
    backgroundFileUrl: template?.fileUrl || null,
    backgroundFit: "stretch",
    backgroundColor: template?.imageUrl ? "#ffffff" : page.backgroundColor,
  }))
  return next
}

export function createTextCanvasElement(page: CreatorCanvasPage): CreatorCanvasElement {
  const top = Math.max(...page.elements.map((element) => element.zIndex), 0) + 1
  return textElement({
    name: "Nuevo texto",
    x: Math.round(page.width * 0.25),
    y: Math.round(page.height * 0.25),
    width: Math.round(page.width * 0.5),
    height: 100,
    zIndex: top,
    text: "Escribe aquí",
    style: { fontSize: page.width > 1000 ? 34 : 26, fontWeight: 600, color: "#172033", backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 10, padding: 10, textAlign: "center" },
  })
}

export function createShapeCanvasElement(page: CreatorCanvasPage, shape: CreatorCanvasShape): CreatorCanvasElement {
  const top = Math.max(...page.elements.map((element) => element.zIndex), 0) + 1
  const size = shape === "line" ? { width: Math.round(page.width * 0.45), height: 8 } : { width: 220, height: 140 }
  return shapeElement({
    name: shape === "circle" ? "Círculo" : shape === "line" ? "Línea" : "Rectángulo",
    shape,
    x: Math.round((page.width - size.width) / 2),
    y: Math.round((page.height - size.height) / 2),
    width: size.width,
    height: size.height,
    zIndex: top,
    style: { backgroundColor: shape === "line" ? "#334155" : "rgba(255,255,255,0.82)", borderColor: "#334155", borderWidth: shape === "line" ? 0 : 2, borderRadius: shape === "circle" ? 999 : shape === "line" ? 0 : 18, opacity: 1 },
  })
}

export function createImageCanvasElement(page: CreatorCanvasPage, src: string): CreatorCanvasElement {
  const top = Math.max(...page.elements.map((element) => element.zIndex), 0) + 1
  return {
    id: uid("image"),
    type: "image",
    name: "Imagen",
    x: Math.round(page.width * 0.3),
    y: Math.round(page.height * 0.3),
    width: Math.round(page.width * 0.4),
    height: Math.round(page.height * 0.3),
    zIndex: top,
    src,
    style: { opacity: 1, borderColor: "transparent", borderWidth: 0, borderRadius: 14 },
  }
}
