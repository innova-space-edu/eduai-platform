export const PLANNING_PREVIEW_SESSION_KEY = "eduai-planning-preview-v1"
export const PLANNING_PREVIEW_DRAFT_KEY = "eduai-planning-preview-draft-v2"

export type PlanningBlockType =
  | "heading"
  | "paragraph"
  | "list"
  | "table"
  | "quote"
  | "shape"
  | "image"
  | "divider"

export type PlanningTextAlign = "left" | "center" | "right" | "justify"
export type PlanningVerticalAlign = "top" | "middle" | "bottom"
export type PlanningShapeKind =
  | "rectangle"
  | "circle"
  | "pill"
  | "callout"
  | "triangle"
  | "arrow"
  | "line"
export type PlanningTheme = "professional" | "colorful" | "preschool" | "minimal"
export type PlanningPaper = "a4" | "letter" | "oficio"
export type PlanningOrientation = "portrait" | "landscape"
export type PlanningImageFit = "contain" | "cover" | "fill"

export interface PlanningElementStyle {
  fontFamily: string
  fontSize: number
  lineHeight: number
  letterSpacing: number
  color: string
  background: string
  fontWeight: number
  fontStyle: "normal" | "italic"
  textDecoration: "none" | "underline"
  textAlign: PlanningTextAlign
  verticalAlign: PlanningVerticalAlign
  borderColor: string
  borderWidth: number
  borderRadius: number
  padding: number
  opacity: number
  shadow: boolean
  imageFit: PlanningImageFit
}

export interface PlanningPreviewElement {
  id: string
  type: PlanningBlockType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked: boolean
  hidden: boolean
  groupId?: string
  text: string
  level?: 1 | 2 | 3
  items?: string[]
  ordered?: boolean
  rows?: string[][]
  shapeKind?: PlanningShapeKind
  src?: string
  alt?: string
  style: PlanningElementStyle
}

export type PlanningElementOverrides = Omit<Partial<PlanningPreviewElement>, "style"> & {
  style?: Partial<PlanningElementStyle>
}

export interface PlanningPreviewPage {
  id: string
  name: string
  paper: PlanningPaper
  orientation: PlanningOrientation
  background: string
  elements: PlanningPreviewElement[]
}

export interface PlanningPreviewPayload {
  version: 1
  id: string
  title: string
  subtitle: string
  content: string
  config: Record<string, unknown>
  createdAt: string
}

export interface PlanningPreviewDocument {
  version: 2
  sourceId: string
  title: string
  subtitle: string
  pages: PlanningPreviewPage[]
  activePageId: string
  settings: {
    accent: string
    fontFamily: string
    theme: PlanningTheme
    showGrid: boolean
    snapToGrid: boolean
    gridSize: number
  }
  metadata: Record<string, unknown>
  updatedAt: string
}

interface ParsedPlanningBlock {
  type: PlanningBlockType
  text?: string
  level?: 1 | 2 | 3
  items?: string[]
  ordered?: boolean
  rows?: string[][]
}

const uid = (prefix = "preview") => {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const transparent = "#ffffff00"

export const PAPER_DIMENSIONS: Record<PlanningPaper, { width: number; height: number; label: string }> = {
  a4: { width: 794, height: 1123, label: "A4" },
  letter: { width: 816, height: 1056, label: "Carta" },
  oficio: { width: 816, height: 1248, label: "Oficio" },
}

export function getPlanningPageDimensions(
  paper: PlanningPaper,
  orientation: PlanningOrientation
) {
  const base = PAPER_DIMENSIONS[paper]
  return orientation === "portrait"
    ? { width: base.width, height: base.height }
    : { width: base.height, height: base.width }
}

export function createPlanningElement(
  type: PlanningBlockType,
  overrides: PlanningElementOverrides = {}
): PlanningPreviewElement {
  const headingLevel = overrides.level || 2
  const headingSize = headingLevel === 1 ? 32 : headingLevel === 2 ? 25 : 20
  const defaultSize: Record<PlanningBlockType, { width: number; height: number }> = {
    heading: { width: 610, height: headingLevel === 1 ? 74 : 58 },
    paragraph: { width: 610, height: 96 },
    list: { width: 610, height: 132 },
    table: { width: 650, height: 190 },
    quote: { width: 610, height: 104 },
    shape: { width: 260, height: 130 },
    image: { width: 360, height: 240 },
    divider: { width: 610, height: 10 },
  }

  const baseStyle: PlanningElementStyle = {
    fontFamily: "Arial, sans-serif",
    fontSize: type === "heading" ? headingSize : type === "table" ? 13 : 16,
    lineHeight: 1.45,
    letterSpacing: 0,
    color: "#0f172a",
    background: type === "quote" ? "#ecfdf5" : type === "table" ? "#ffffff" : transparent,
    fontWeight: type === "heading" ? 800 : 400,
    fontStyle: "normal",
    textDecoration: "none",
    textAlign: "left",
    verticalAlign: "top",
    borderColor: type === "table" ? "#cbd5e1" : type === "quote" ? "#5eead4" : "#94a3b8",
    borderWidth: type === "table" || type === "quote" ? 1 : 0,
    borderRadius: type === "quote" ? 14 : 8,
    padding: type === "heading" ? 4 : type === "divider" ? 0 : 12,
    opacity: 1,
    shadow: false,
    imageFit: "contain",
  }

  const size = defaultSize[type]
  return {
    id: uid("element"),
    type,
    x: overrides.x ?? 70,
    y: overrides.y ?? 70,
    width: overrides.width ?? size.width,
    height: overrides.height ?? size.height,
    rotation: overrides.rotation ?? 0,
    zIndex: overrides.zIndex ?? 1,
    locked: overrides.locked ?? false,
    hidden: overrides.hidden ?? false,
    groupId: overrides.groupId,
    text:
      overrides.text ??
      (type === "heading"
        ? "Nuevo título"
        : type === "paragraph"
          ? "Escribe aquí el contenido de la planificación."
          : type === "quote"
            ? "Nota destacada"
            : type === "shape"
              ? "Figura"
              : ""),
    level: overrides.level,
    items: overrides.items,
    ordered: overrides.ordered,
    rows: overrides.rows,
    shapeKind: overrides.shapeKind,
    src: overrides.src,
    alt: overrides.alt,
    style: { ...baseStyle, ...(overrides.style || {}) },
  }
}

export function createPlanningPage(
  index: number,
  overrides: Partial<PlanningPreviewPage> = {}
): PlanningPreviewPage {
  return {
    id: overrides.id || uid("page"),
    name: overrides.name || `Página ${index + 1}`,
    paper: overrides.paper || "a4",
    orientation: overrides.orientation || "portrait",
    background: overrides.background || "#ffffff",
    elements: overrides.elements || [],
  }
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim()
}

function isTableSeparator(line: string) {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cleanInlineMarkdown(cell))
}

function startsSpecialBlock(lines: string[], index: number) {
  const line = lines[index] || ""
  const next = lines[index + 1] || ""
  return (
    /^#{1,3}\s+/.test(line) ||
    /^\s*([-*_])\1{2,}\s*$/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*([-*+]\s+|\d+[.)]\s+)/.test(line) ||
    (line.includes("|") && isTableSeparator(next))
  )
}

function parsePlanningMarkdown(content: string): ParsedPlanningBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const blocks: ParsedPlanningBlock[] = []
  let index = 0

  while (index < lines.length) {
    const raw = lines[index]
    const line = raw.trim()
    if (!line) {
      index += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: cleanInlineMarkdown(heading[2]),
      })
      index += 1
      continue
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: "divider" })
      index += 1
      continue
    }

    if (line.includes("|") && isTableSeparator(lines[index + 1] || "")) {
      const rows: string[][] = [parseTableRow(raw)]
      index += 2
      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(parseTableRow(lines[index]))
        index += 1
      }
      blocks.push({ type: "table", rows })
      continue
    }

    if (/^\s*([-*+]\s+|\d+[.)]\s+)/.test(raw)) {
      const ordered = /^\s*\d+[.)]\s+/.test(raw)
      const items: string[] = []
      while (index < lines.length) {
        const match = /^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+)$/.exec(lines[index])
        if (!match) break
        items.push(cleanInlineMarkdown(match[1]))
        index += 1
      }
      blocks.push({ type: "list", items, ordered })
      continue
    }

    if (/^\s*>\s?/.test(raw)) {
      const quote: string[] = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""))
        index += 1
      }
      blocks.push({ type: "quote", text: cleanInlineMarkdown(quote.join("\n")) })
      continue
    }

    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !startsSpecialBlock(lines, index)) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: "paragraph", text: cleanInlineMarkdown(paragraph.join(" ")) })
  }

  return blocks.length
    ? blocks
    : [
        { type: "heading", level: 1, text: "Planificación" },
        { type: "paragraph", text: "Escribe aquí el contenido de la planificación." },
      ]
}

function estimateHeight(block: ParsedPlanningBlock) {
  if (block.type === "heading") return block.level === 1 ? 72 : block.level === 2 ? 60 : 50
  if (block.type === "divider") return 22
  if (block.type === "quote") return Math.max(92, 54 + Math.ceil((block.text?.length || 0) / 85) * 24)
  if (block.type === "list") return Math.max(88, 38 + (block.items?.length || 1) * 29)
  if (block.type === "table") return Math.max(150, 42 + (block.rows?.length || 2) * 43)
  return Math.max(70, 40 + Math.ceil((block.text?.length || 0) / 95) * 25)
}

function parsedBlockToElement(block: ParsedPlanningBlock, y: number, zIndex: number) {
  const height = estimateHeight(block)
  return createPlanningElement(block.type, {
    x: block.type === "table" ? 48 : 70,
    y,
    width: block.type === "table" ? 698 : 654,
    height,
    zIndex,
    text: block.text || "",
    level: block.level,
    items: block.items,
    ordered: block.ordered,
    rows: block.rows,
    style:
      block.type === "heading"
        ? { color: "#0f172a", padding: 2 }
        : block.type === "table"
          ? { padding: 0 }
          : undefined,
  })
}

export function createPlanningPreviewDocument(
  payload: PlanningPreviewPayload
): PlanningPreviewDocument {
  const firstPage = createPlanningPage(0)
  const pages: PlanningPreviewPage[] = [firstPage]
  const dimensions = getPlanningPageDimensions(firstPage.paper, firstPage.orientation)
  let currentPage = firstPage
  let y = 48
  let zIndex = 1

  const title = createPlanningElement("heading", {
    x: 60,
    y,
    width: dimensions.width - 120,
    height: 68,
    level: 1,
    text: payload.title || "Planificación",
    zIndex: zIndex++,
    style: { color: "#0f766e", fontSize: 30, textAlign: "left" },
  })
  currentPage.elements.push(title)
  y += 76

  if (payload.subtitle) {
    currentPage.elements.push(
      createPlanningElement("paragraph", {
        x: 62,
        y,
        width: dimensions.width - 124,
        height: 42,
        text: payload.subtitle,
        zIndex: zIndex++,
        style: { color: "#64748b", fontSize: 14, padding: 0 },
      })
    )
    y += 48
  }

  currentPage.elements.push(
    createPlanningElement("divider", {
      x: 60,
      y,
      width: dimensions.width - 120,
      height: 4,
      zIndex: zIndex++,
      style: { background: "#0f766e", borderColor: "#0f766e", borderWidth: 0 },
    })
  )
  y += 34

  for (const block of parsePlanningMarkdown(payload.content)) {
    const blockHeight = estimateHeight(block)
    const currentDimensions = getPlanningPageDimensions(currentPage.paper, currentPage.orientation)
    if (y + blockHeight > currentDimensions.height - 58) {
      currentPage = createPlanningPage(pages.length)
      pages.push(currentPage)
      y = 58
    }
    currentPage.elements.push(parsedBlockToElement(block, y, zIndex++))
    y += blockHeight + 16
  }

  return {
    version: 2,
    sourceId: payload.id,
    title: payload.title,
    subtitle: payload.subtitle,
    pages,
    activePageId: firstPage.id,
    settings: {
      accent: "#0f766e",
      fontFamily: "Arial, sans-serif",
      theme: "professional",
      showGrid: false,
      snapToGrid: true,
      gridSize: 8,
    },
    metadata: payload.config,
    updatedAt: new Date().toISOString(),
  }
}

export function clonePlanningElement(element: PlanningPreviewElement): PlanningPreviewElement {
  return {
    ...element,
    id: uid("element"),
    x: element.x + 18,
    y: element.y + 18,
    groupId: undefined,
    items: element.items ? [...element.items] : undefined,
    rows: element.rows?.map((row) => [...row]),
    style: { ...element.style },
  }
}

export function planningDocumentToText(document: PlanningPreviewDocument) {
  return document.pages
    .flatMap((page) =>
      [...page.elements]
        .filter((element) => !element.hidden)
        .sort((a, b) => a.y - b.y || a.x - b.x || a.zIndex - b.zIndex)
    )
    .map((element) => {
      if (element.type === "heading") return `${"#".repeat(element.level || 2)} ${element.text}`
      if (element.type === "paragraph") return element.text
      if (element.type === "quote") return element.text.split("\n").map((line) => `> ${line}`).join("\n")
      if (element.type === "list") {
        return (element.items || [])
          .map((item, index) => `${element.ordered ? `${index + 1}.` : "-"} ${item}`)
          .join("\n")
      }
      if (element.type === "table") {
        const rows = element.rows || []
        if (!rows.length) return ""
        const separator = rows[0].map(() => "---")
        return [rows[0], separator, ...rows.slice(1)]
          .map((row) => `| ${row.join(" | ")} |`)
          .join("\n")
      }
      if (element.type === "shape") return element.text
      if (element.type === "image") return element.alt || "Imagen"
      if (element.type === "divider") return "---"
      return ""
    })
    .filter(Boolean)
    .join("\n\n")
}
