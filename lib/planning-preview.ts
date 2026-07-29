export const PLANNING_PREVIEW_SESSION_KEY = "eduai-planning-preview-v1"
export const PLANNING_PREVIEW_DRAFT_KEY = "eduai-planning-preview-draft-v1"

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
export type PlanningShapeKind = "rectangle" | "circle" | "pill" | "line" | "callout"
export type PlanningTheme = "professional" | "colorful" | "preschool" | "minimal"

export interface PlanningBlockStyle {
  fontFamily: string
  fontSize: number
  color: string
  background: string
  fontWeight: number
  fontStyle: "normal" | "italic"
  textDecoration: "none" | "underline"
  textAlign: PlanningTextAlign
  borderColor: string
  borderWidth: number
  borderRadius: number
  padding: number
  marginBottom: number
  width: number
  minHeight: number
}

export interface PlanningPreviewBlock {
  id: string
  type: PlanningBlockType
  text: string
  level?: 1 | 2 | 3
  items?: string[]
  ordered?: boolean
  rows?: string[][]
  shapeKind?: PlanningShapeKind
  src?: string
  alt?: string
  style: PlanningBlockStyle
}

export type PlanningBlockOverrides = Omit<Partial<PlanningPreviewBlock>, "style"> & {
  style?: Partial<PlanningBlockStyle>
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
  version: 1
  sourceId: string
  title: string
  subtitle: string
  blocks: PlanningPreviewBlock[]
  page: {
    paper: "a4" | "letter"
    orientation: "portrait" | "landscape"
    background: string
    accent: string
    fontFamily: string
    padding: number
    theme: PlanningTheme
  }
  metadata: Record<string, unknown>
  updatedAt: string
}

const uid = () => {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID()
  }
  return `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const transparent = "#ffffff00"

export function createPlanningBlock(
  type: PlanningBlockType,
  overrides: PlanningBlockOverrides = {}
): PlanningPreviewBlock {
  const headingLevel = overrides.level || 2
  const headingSize = headingLevel === 1 ? 30 : headingLevel === 2 ? 23 : 19
  const base: PlanningBlockStyle = {
    fontFamily: "inherit",
    fontSize: type === "heading" ? headingSize : type === "table" ? 13 : 15,
    color: "#0f172a",
    background: type === "quote" ? "#ecfdf5" : transparent,
    fontWeight: type === "heading" ? 800 : 400,
    fontStyle: "normal",
    textDecoration: "none",
    textAlign: "left",
    borderColor: type === "table" ? "#cbd5e1" : "#94a3b8",
    borderWidth: type === "table" || type === "quote" ? 1 : 0,
    borderRadius: type === "quote" ? 14 : 10,
    padding: type === "quote" || type === "table" ? 14 : 0,
    marginBottom: type === "heading" ? 16 : 13,
    width: 100,
    minHeight: type === "shape" ? 110 : 0,
  }

  return {
    id: uid(),
    type,
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
    style: { ...base, ...(overrides.style || {}) },
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

export function parsePlanningMarkdown(content: string): PlanningPreviewBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const blocks: PlanningPreviewBlock[] = []
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
      const level = heading[1].length as 1 | 2 | 3
      blocks.push(
        createPlanningBlock("heading", {
          level,
          text: cleanInlineMarkdown(heading[2]),
        })
      )
      index += 1
      continue
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(createPlanningBlock("divider"))
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
      blocks.push(
        createPlanningBlock("table", {
          rows,
          style: { background: "#ffffff", borderWidth: 1, padding: 0 },
        })
      )
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
      blocks.push(createPlanningBlock("list", { items, ordered }))
      continue
    }

    if (/^\s*>\s?/.test(raw)) {
      const quote: string[] = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""))
        index += 1
      }
      blocks.push(
        createPlanningBlock("quote", {
          text: cleanInlineMarkdown(quote.join("\n")),
        })
      )
      continue
    }

    const paragraph: string[] = [line]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() &&
      !startsSpecialBlock(lines, index)
    ) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push(
      createPlanningBlock("paragraph", {
        text: cleanInlineMarkdown(paragraph.join(" ")),
      })
    )
  }

  return blocks.length
    ? blocks
    : [
        createPlanningBlock("heading", { level: 1, text: "Planificación" }),
        createPlanningBlock("paragraph"),
      ]
}

export function createPlanningPreviewDocument(
  payload: PlanningPreviewPayload
): PlanningPreviewDocument {
  return {
    version: 1,
    sourceId: payload.id,
    title: payload.title,
    subtitle: payload.subtitle,
    blocks: parsePlanningMarkdown(payload.content),
    page: {
      paper: "a4",
      orientation: "portrait",
      background: "#ffffff",
      accent: "#0f766e",
      fontFamily: "Arial, sans-serif",
      padding: 54,
      theme: "professional",
    },
    metadata: payload.config,
    updatedAt: new Date().toISOString(),
  }
}

export function planningDocumentToText(document: PlanningPreviewDocument) {
  return document.blocks
    .map((block) => {
      if (block.type === "heading") return `${"#".repeat(block.level || 2)} ${block.text}`
      if (block.type === "paragraph") return block.text
      if (block.type === "quote") return block.text.split("\n").map((line) => `> ${line}`).join("\n")
      if (block.type === "list") {
        return (block.items || [])
          .map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${item}`)
          .join("\n")
      }
      if (block.type === "table") {
        const rows = block.rows || []
        if (!rows.length) return ""
        const separator = rows[0].map(() => "---")
        return [rows[0], separator, ...rows.slice(1)]
          .map((row) => `| ${row.join(" | ")} |`)
          .join("\n")
      }
      if (block.type === "shape") return block.text
      if (block.type === "image") return block.alt || "Imagen"
      if (block.type === "divider") return "---"
      return ""
    })
    .filter(Boolean)
    .join("\n\n")
}
