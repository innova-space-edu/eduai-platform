"use client"

import { toPng } from "html-to-image"
import { jsPDF } from "jspdf"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  PAPER_DIMENSIONS,
  PLANNING_PREVIEW_DRAFT_KEY,
  PLANNING_PREVIEW_SESSION_KEY,
  clonePlanningElement,
  createPlanningElement,
  createPlanningPage,
  createPlanningPreviewDocument,
  getPlanningPageDimensions,
  planningDocumentToText,
  type PlanningBlockType,
  type PlanningElementOverrides,
  type PlanningElementStyle,
  type PlanningImageFit,
  type PlanningOrientation,
  type PlanningPaper,
  type PlanningPreviewDocument,
  type PlanningPreviewElement,
  type PlanningPreviewPage,
  type PlanningPreviewPayload,
  type PlanningShapeKind,
  type PlanningTextAlign,
  type PlanningTheme,
} from "@/lib/planning-preview"
import styles from "./editor.module.css"

type PanelId = "select" | "insert" | "text" | "style" | "arrange" | "pages" | "export"
type EditorMode = "select" | "hand"
type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

type Interaction =
  | {
      kind: "drag"
      pageId: string
      startX: number
      startY: number
      ids: string[]
      origins: Record<string, { x: number; y: number }>
      snapshot: PlanningPreviewDocument
      moved: boolean
    }
  | {
      kind: "resize"
      pageId: string
      startX: number
      startY: number
      handle: ResizeHandle
      element: PlanningPreviewElement
      snapshot: PlanningPreviewDocument
      moved: boolean
    }
  | {
      kind: "rotate"
      pageId: string
      centerX: number
      centerY: number
      startAngle: number
      startRotation: number
      elementId: string
      snapshot: PlanningPreviewDocument
      moved: boolean
    }
  | {
      kind: "marquee"
      pageId: string
      startX: number
      startY: number
      additive: boolean
    }
  | {
      kind: "pan"
      startClientX: number
      startClientY: number
      scrollLeft: number
      scrollTop: number
    }

interface MarqueeState {
  pageId: string
  x: number
  y: number
  width: number
  height: number
}

const PANELS: Array<{ id: PanelId; label: string; icon: string }> = [
  { id: "select", label: "Seleccionar", icon: "↖" },
  { id: "insert", label: "Agregar", icon: "+" },
  { id: "text", label: "Texto", icon: "T" },
  { id: "style", label: "Diseño", icon: "◉" },
  { id: "arrange", label: "Organizar", icon: "▦" },
  { id: "pages", label: "Páginas", icon: "▤" },
  { id: "export", label: "Descargar", icon: "⇩" },
]

const COLOR_PALETTE = [
  "#000000", "#111827", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#ffffff",
  "#7f1d1d", "#dc2626", "#f87171", "#fb7185", "#be123c", "#9f1239",
  "#7c2d12", "#ea580c", "#fb923c", "#f59e0b", "#facc15", "#fde047",
  "#365314", "#65a30d", "#84cc16", "#16a34a", "#22c55e", "#86efac",
  "#064e3b", "#059669", "#14b8a6", "#2dd4bf", "#67e8f9", "#0891b2",
  "#075985", "#0284c7", "#38bdf8", "#1d4ed8", "#3b82f6", "#818cf8",
  "#4c1d95", "#7c3aed", "#a78bfa", "#c026d3", "#e879f9", "#db2777",
  "#fdf2f8", "#fff7ed", "#fefce8", "#f0fdf4", "#ecfeff", "#eff6ff", "#f5f3ff",
]

const FONT_OPTIONS = [
  "Arial, sans-serif",
  "Aptos, Arial, sans-serif",
  "Calibri, Arial, sans-serif",
  "Verdana, sans-serif",
  "Trebuchet MS, sans-serif",
  "Tahoma, sans-serif",
  "Century Gothic, sans-serif",
  "Georgia, serif",
  "Times New Roman, serif",
  "Garamond, serif",
  "Cambria, serif",
  "Courier New, monospace",
  "Comic Sans MS, cursive",
  "Brush Script MT, cursive",
  "Lucida Handwriting, cursive",
]

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 84, 96]

const THEME_PRESETS: Record<
  PlanningTheme,
  { label: string; accent: string; page: string; font: string; heading: string; quote: string }
> = {
  professional: {
    label: "Profesional",
    accent: "#0f766e",
    page: "#ffffff",
    font: "Arial, sans-serif",
    heading: "#0f172a",
    quote: "#ecfdf5",
  },
  colorful: {
    label: "Colorido",
    accent: "#7c3aed",
    page: "#fffdf7",
    font: "Trebuchet MS, sans-serif",
    heading: "#5b21b6",
    quote: "#f3e8ff",
  },
  preschool: {
    label: "Parvularia",
    accent: "#db2777",
    page: "#fff7ed",
    font: "Comic Sans MS, cursive",
    heading: "#be185d",
    quote: "#fce7f3",
  },
  minimal: {
    label: "Minimalista",
    accent: "#334155",
    page: "#ffffff",
    font: "Aptos, Arial, sans-serif",
    heading: "#111827",
    quote: "#f8fafc",
  },
}

const SHAPES: Array<{ kind: PlanningShapeKind; label: string; icon: string }> = [
  { kind: "rectangle", label: "Rectángulo", icon: "▭" },
  { kind: "circle", label: "Círculo", icon: "○" },
  { kind: "pill", label: "Etiqueta", icon: "▰" },
  { kind: "callout", label: "Llamado", icon: "▱" },
  { kind: "triangle", label: "Triángulo", icon: "△" },
  { kind: "arrow", label: "Flecha", icon: "➜" },
]

const HANDLE_POSITIONS: Record<ResizeHandle, string> = {
  nw: styles.handleNW,
  n: styles.handleN,
  ne: styles.handleNE,
  e: styles.handleE,
  se: styles.handleSE,
  s: styles.handleS,
  sw: styles.handleSW,
  w: styles.handleW,
}

const cloneDocument = (value: PlanningPreviewDocument) => {
  if (typeof structuredClone === "function") return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as PlanningPreviewDocument
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function snap(value: number, size: number, enabled: boolean) {
  return enabled ? Math.round(value / size) * size : value
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(
    element?.isContentEditable ||
      element?.closest("[contenteditable='true']") ||
      element?.tagName === "INPUT" ||
      element?.tagName === "TEXTAREA" ||
      element?.tagName === "SELECT"
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "planificacion"
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function asPayload(value: unknown): PlanningPreviewPayload | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<PlanningPreviewPayload>
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.content !== "string" ||
    !candidate.config ||
    typeof candidate.config !== "object"
  ) {
    return null
  }
  return {
    version: 1,
    id: candidate.id,
    title: candidate.title,
    subtitle: typeof candidate.subtitle === "string" ? candidate.subtitle : "Vista previa editable",
    content: candidate.content,
    config: candidate.config as Record<string, unknown>,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
  }
}

function asDocument(value: unknown): PlanningPreviewDocument | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<PlanningPreviewDocument>
  if (
    candidate.version !== 2 ||
    typeof candidate.sourceId !== "string" ||
    typeof candidate.title !== "string" ||
    !Array.isArray(candidate.pages) ||
    !candidate.settings
  ) {
    return null
  }
  return candidate as PlanningPreviewDocument
}

function elementHtml(element: PlanningPreviewElement) {
  const style = element.style
  const common = [
    "position:absolute",
    `left:${element.x}px`,
    `top:${element.y}px`,
    `width:${element.width}px`,
    `height:${element.height}px`,
    `transform:rotate(${element.rotation}deg)`,
    `z-index:${element.zIndex}`,
    `font-family:${style.fontFamily}`,
    `font-size:${style.fontSize}px`,
    `line-height:${style.lineHeight}`,
    `letter-spacing:${style.letterSpacing}px`,
    `color:${style.color}`,
    `background:${style.background}`,
    `font-weight:${style.fontWeight}`,
    `font-style:${style.fontStyle}`,
    `text-decoration:${style.textDecoration}`,
    `text-align:${style.textAlign}`,
    `border:${style.borderWidth}px solid ${style.borderColor}`,
    `border-radius:${style.borderRadius}px`,
    `padding:${style.padding}px`,
    `opacity:${style.opacity}`,
    "box-sizing:border-box",
    "overflow:hidden",
  ].join(";")

  if (element.type === "image") {
    return `<div style="${common}"><img src="${element.src || ""}" alt="${escapeHtml(element.alt || "Imagen")}" style="width:100%;height:100%;object-fit:${style.imageFit};display:block" /></div>`
  }
  if (element.type === "divider") {
    return `<div style="${common};height:${Math.max(2, element.height)}px"></div>`
  }
  if (element.type === "list") {
    const tag = element.ordered ? "ol" : "ul"
    return `<div style="${common}"><${tag}>${(element.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}></div>`
  }
  if (element.type === "table") {
    return `<div style="${common};padding:0"><table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed">${(element.rows || [])
      .map(
        (row, rowIndex) =>
          `<tr>${row
            .map((cell) => `<${rowIndex === 0 ? "th" : "td"} style="border:1px solid ${style.borderColor};padding:7px">${escapeHtml(cell)}</${rowIndex === 0 ? "th" : "td"}>`)
            .join("")}</tr>`
      )
      .join("")}</table></div>`
  }
  return `<div style="${common}">${escapeHtml(element.text).replaceAll("\n", "<br>")}</div>`
}

export default function PlanningPreviewEditorPage() {
  const router = useRouter()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const canvasScrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef(new Map<string, HTMLDivElement>())
  const interactionRef = useRef<Interaction | null>(null)
  const historyRef = useRef<PlanningPreviewDocument[]>([])
  const futureRef = useRef<PlanningPreviewDocument[]>([])
  const clipboardRef = useRef<PlanningPreviewElement[]>([])
  const documentRef = useRef<PlanningPreviewDocument | null>(null)
  const selectedRef = useRef<string[]>([])
  const zoomRef = useRef(78)
  const spacePressedRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [documentState, setDocumentState] = useState<PlanningPreviewDocument | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState("")
  const [activePanel, setActivePanel] = useState<PanelId | null>("select")
  const [mode, setMode] = useState<EditorMode>("select")
  const [zoom, setZoom] = useState(78)
  const [status, setStatus] = useState("")
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    documentRef.current = documentState
  }, [documentState])

  useEffect(() => {
    selectedRef.current = selectedIds
  }, [selectedIds])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const flash = useCallback((message: string) => {
    setStatus(message)
    window.setTimeout(() => setStatus(""), 2500)
  }, [])

  useEffect(() => {
    try {
      const rawPayload = sessionStorage.getItem(PLANNING_PREVIEW_SESSION_KEY)
      const rawDraft = localStorage.getItem(PLANNING_PREVIEW_DRAFT_KEY)
      const payload = rawPayload ? asPayload(JSON.parse(rawPayload)) : null
      const draft = rawDraft ? asDocument(JSON.parse(rawDraft)) : null
      const next = payload && draft?.sourceId === payload.id ? draft : payload ? createPlanningPreviewDocument(payload) : draft
      setDocumentState(next)
      documentRef.current = next
      const activePage = next?.pages.find((page) => page.id === next.activePageId) || next?.pages[0]
      setSelectedIds(activePage?.elements[0]?.id ? [activePage.elements[0].id] : [])
    } catch {
      setDocumentState(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    if (!documentState) return
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(PLANNING_PREVIEW_DRAFT_KEY, JSON.stringify(documentState))
      } catch {
        // El guardado manual informará si el navegador no tiene espacio disponible.
      }
    }, 550)
    return () => window.clearTimeout(timer)
  }, [documentState])

  const activePage = useMemo(() => {
    if (!documentState) return null
    return documentState.pages.find((page) => page.id === documentState.activePageId) || documentState.pages[0] || null
  }, [documentState])

  const selectedElements = useMemo(() => {
    if (!activePage) return []
    return activePage.elements.filter((element) => selectedIds.includes(element.id))
  }, [activePage, selectedIds])

  const primaryElement = selectedElements[0] || null

  const pushHistory = useCallback((snapshot: PlanningPreviewDocument) => {
    historyRef.current.push(cloneDocument(snapshot))
    if (historyRef.current.length > 60) historyRef.current.shift()
    futureRef.current = []
  }, [])

  const commit = useCallback(
    (updater: (current: PlanningPreviewDocument) => PlanningPreviewDocument) => {
      setDocumentState((current) => {
        if (!current) return current
        pushHistory(current)
        const next = updater(cloneDocument(current))
        next.updatedAt = new Date().toISOString()
        documentRef.current = next
        return next
      })
    },
    [pushHistory]
  )

  const transientFrom = useCallback(
    (snapshot: PlanningPreviewDocument, updater: (current: PlanningPreviewDocument) => PlanningPreviewDocument) => {
      const next = updater(cloneDocument(snapshot))
      next.updatedAt = new Date().toISOString()
      documentRef.current = next
      setDocumentState(next)
    },
    []
  )

  const updateActivePage = useCallback(
    (updater: (page: PlanningPreviewPage) => PlanningPreviewPage) => {
      commit((current) => ({
        ...current,
        pages: current.pages.map((page) =>
          page.id === current.activePageId ? updater(page) : page
        ),
      }))
    },
    [commit]
  )

  const updateSelected = useCallback(
    (updater: (element: PlanningPreviewElement) => PlanningPreviewElement) => {
      const ids = new Set(selectedRef.current)
      if (!ids.size) return
      updateActivePage((page) => ({
        ...page,
        elements: page.elements.map((element) => (ids.has(element.id) ? updater(element) : element)),
      }))
    },
    [updateActivePage]
  )

  const updateSelectedStyle = useCallback(
    (patch: Partial<PlanningElementStyle>) => {
      updateSelected((element) => ({ ...element, style: { ...element.style, ...patch } }))
    },
    [updateSelected]
  )

  const undo = useCallback(() => {
    const current = documentRef.current
    const previous = historyRef.current.pop()
    if (!current || !previous) return
    futureRef.current.push(cloneDocument(current))
    documentRef.current = previous
    setDocumentState(previous)
    const page = previous.pages.find((item) => item.id === previous.activePageId) || previous.pages[0]
    setSelectedIds((currentIds) => currentIds.filter((id) => page?.elements.some((element) => element.id === id)))
    flash("Cambio deshecho")
  }, [flash])

  const redo = useCallback(() => {
    const current = documentRef.current
    const next = futureRef.current.pop()
    if (!current || !next) return
    historyRef.current.push(cloneDocument(current))
    documentRef.current = next
    setDocumentState(next)
    flash("Cambio rehecho")
  }, [flash])

  const saveDraft = useCallback(() => {
    const current = documentRef.current
    if (!current) return
    try {
      localStorage.setItem(PLANNING_PREVIEW_DRAFT_KEY, JSON.stringify(current))
      flash("Borrador guardado en este dispositivo")
    } catch {
      flash("No fue posible guardar el borrador")
    }
  }, [flash])

  const pointInPage = useCallback((event: PointerEvent | ReactPointerEvent, pageId: string) => {
    const pageNode = pageRefs.current.get(pageId)
    if (!pageNode) return { x: 0, y: 0 }
    const rect = pageNode.getBoundingClientRect()
    const scale = zoomRef.current / 100
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    }
  }, [])

  const selectPage = useCallback((pageId: string) => {
    const current = documentRef.current
    if (!current || current.activePageId === pageId) return
    commit((document) => ({ ...document, activePageId: pageId }))
    setSelectedIds([])
    setEditingId("")
  }, [commit])

  const insertElement = useCallback(
    (type: PlanningBlockType, overrides: PlanningElementOverrides = {}) => {
      const current = documentRef.current
      const page = current?.pages.find((item) => item.id === current.activePageId)
      if (!current || !page) return
      const dimensions = getPlanningPageDimensions(page.paper, page.orientation)
      const highest = Math.max(0, ...page.elements.map((element) => element.zIndex))
      const element = createPlanningElement(type, {
        x: overrides.x ?? 70,
        y: overrides.y ?? 90,
        zIndex: highest + 1,
        ...overrides,
      })
      element.x = clamp(element.x, 0, Math.max(0, dimensions.width - element.width))
      element.y = clamp(element.y, 0, Math.max(0, dimensions.height - element.height))
      commit((document) => ({
        ...document,
        pages: document.pages.map((item) =>
          item.id === document.activePageId
            ? { ...item, elements: [...item.elements, element] }
            : item
        ),
      }))
      setSelectedIds([element.id])
      setEditingId(type === "heading" || type === "paragraph" ? element.id : "")
      flash("Elemento agregado")
    },
    [commit, flash]
  )

  const deleteSelection = useCallback(() => {
    const ids = new Set(selectedRef.current)
    if (!ids.size) return
    updateActivePage((page) => ({
      ...page,
      elements: page.elements.filter((element) => !ids.has(element.id)),
    }))
    setSelectedIds([])
    setEditingId("")
    flash("Elemento eliminado")
  }, [flash, updateActivePage])

  const copySelection = useCallback(() => {
    const current = documentRef.current
    const page = current?.pages.find((item) => item.id === current.activePageId)
    const ids = new Set(selectedRef.current)
    if (!page || !ids.size) return
    clipboardRef.current = page.elements
      .filter((element) => ids.has(element.id))
      .map((element) => cloneDocument({
        version: 2,
        sourceId: "clipboard",
        title: "",
        subtitle: "",
        pages: [{ ...page, elements: [element] }],
        activePageId: page.id,
        settings: current.settings,
        metadata: {},
        updatedAt: "",
      }).pages[0].elements[0])
    flash(`${clipboardRef.current.length} elemento(s) copiado(s)`)
  }, [flash])

  const pasteSelection = useCallback(() => {
    const current = documentRef.current
    const page = current?.pages.find((item) => item.id === current.activePageId)
    if (!current || !page || !clipboardRef.current.length) return
    const maxZ = Math.max(0, ...page.elements.map((element) => element.zIndex))
    const pasted = clipboardRef.current.map((element, index) => ({
      ...clonePlanningElement(element),
      zIndex: maxZ + index + 1,
    }))
    updateActivePage((active) => ({ ...active, elements: [...active.elements, ...pasted] }))
    setSelectedIds(pasted.map((element) => element.id))
    flash(`${pasted.length} elemento(s) pegado(s)`)
  }, [flash, updateActivePage])

  const duplicateSelection = useCallback(() => {
    const current = documentRef.current
    const page = current?.pages.find((item) => item.id === current.activePageId)
    const ids = new Set(selectedRef.current)
    if (!current || !page || !ids.size) return
    const maxZ = Math.max(0, ...page.elements.map((element) => element.zIndex))
    const duplicates = page.elements
      .filter((element) => ids.has(element.id))
      .map((element, index) => ({ ...clonePlanningElement(element), zIndex: maxZ + index + 1 }))
    updateActivePage((active) => ({ ...active, elements: [...active.elements, ...duplicates] }))
    setSelectedIds(duplicates.map((element) => element.id))
    flash("Selección duplicada")
  }, [flash, updateActivePage])

  const cutSelection = useCallback(() => {
    copySelection()
    window.setTimeout(deleteSelection, 0)
  }, [copySelection, deleteSelection])

  const selectAll = useCallback(() => {
    const current = documentRef.current
    const page = current?.pages.find((item) => item.id === current.activePageId)
    if (!page) return
    setSelectedIds(page.elements.filter((element) => !element.hidden).map((element) => element.id))
  }, [])

  const nudgeSelection = useCallback(
    (dx: number, dy: number) => {
      const current = documentRef.current
      const page = current?.pages.find((item) => item.id === current.activePageId)
      const ids = new Set(selectedRef.current)
      if (!current || !page || !ids.size) return
      const dimensions = getPlanningPageDimensions(page.paper, page.orientation)
      updateActivePage((active) => ({
        ...active,
        elements: active.elements.map((element) =>
          ids.has(element.id) && !element.locked
            ? {
                ...element,
                x: clamp(element.x + dx, 0, Math.max(0, dimensions.width - element.width)),
                y: clamp(element.y + dy, 0, Math.max(0, dimensions.height - element.height)),
              }
            : element
        ),
      }))
    },
    [updateActivePage]
  )

  const setLayer = useCallback(
    (action: "front" | "back" | "forward" | "backward") => {
      const current = documentRef.current
      const page = current?.pages.find((item) => item.id === current.activePageId)
      const ids = new Set(selectedRef.current)
      if (!page || !ids.size) return
      const minZ = Math.min(0, ...page.elements.map((element) => element.zIndex))
      const maxZ = Math.max(0, ...page.elements.map((element) => element.zIndex))
      updateActivePage((active) => ({
        ...active,
        elements: active.elements.map((element) => {
          if (!ids.has(element.id)) return element
          if (action === "front") return { ...element, zIndex: maxZ + 1 }
          if (action === "back") return { ...element, zIndex: minZ - 1 }
          if (action === "forward") return { ...element, zIndex: element.zIndex + 1 }
          return { ...element, zIndex: element.zIndex - 1 }
        }),
      }))
    },
    [updateActivePage]
  )

  const alignSelection = useCallback(
    (alignment: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
      const current = documentRef.current
      const page = current?.pages.find((item) => item.id === current.activePageId)
      const ids = new Set(selectedRef.current)
      const items = page?.elements.filter((element) => ids.has(element.id)) || []
      if (!page || !items.length) return
      const dimensions = getPlanningPageDimensions(page.paper, page.orientation)
      const left = Math.min(...items.map((element) => element.x))
      const right = Math.max(...items.map((element) => element.x + element.width))
      const top = Math.min(...items.map((element) => element.y))
      const bottom = Math.max(...items.map((element) => element.y + element.height))
      const usePage = items.length === 1
      updateActivePage((active) => ({
        ...active,
        elements: active.elements.map((element) => {
          if (!ids.has(element.id) || element.locked) return element
          if (alignment === "left") return { ...element, x: usePage ? 0 : left }
          if (alignment === "center") return { ...element, x: usePage ? (dimensions.width - element.width) / 2 : (left + right - element.width) / 2 }
          if (alignment === "right") return { ...element, x: usePage ? dimensions.width - element.width : right - element.width }
          if (alignment === "top") return { ...element, y: usePage ? 0 : top }
          if (alignment === "middle") return { ...element, y: usePage ? (dimensions.height - element.height) / 2 : (top + bottom - element.height) / 2 }
          return { ...element, y: usePage ? dimensions.height - element.height : bottom - element.height }
        }),
      }))
    },
    [updateActivePage]
  )

  const distributeSelection = useCallback(
    (axis: "horizontal" | "vertical") => {
      const current = documentRef.current
      const page = current?.pages.find((item) => item.id === current.activePageId)
      const ids = new Set(selectedRef.current)
      const items = page?.elements.filter((element) => ids.has(element.id) && !element.locked) || []
      if (!page || items.length < 3) return
      const ordered = [...items].sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y))
      const first = ordered[0]
      const last = ordered[ordered.length - 1]
      const totalSize = ordered.reduce((sum, element) => sum + (axis === "horizontal" ? element.width : element.height), 0)
      const span = axis === "horizontal"
        ? last.x + last.width - first.x
        : last.y + last.height - first.y
      const gap = (span - totalSize) / (ordered.length - 1)
      const positions = new Map<string, number>()
      let cursor = axis === "horizontal" ? first.x : first.y
      for (const element of ordered) {
        positions.set(element.id, cursor)
        cursor += (axis === "horizontal" ? element.width : element.height) + gap
      }
      updateActivePage((active) => ({
        ...active,
        elements: active.elements.map((element) =>
          positions.has(element.id)
            ? axis === "horizontal"
              ? { ...element, x: positions.get(element.id)! }
              : { ...element, y: positions.get(element.id)! }
            : element
        ),
      }))
    },
    [updateActivePage]
  )

  const groupSelection = useCallback(() => {
    if (selectedRef.current.length < 2) return
    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2)}`
    updateSelected((element) => ({ ...element, groupId }))
    flash("Elementos agrupados")
  }, [flash, updateSelected])

  const ungroupSelection = useCallback(() => {
    updateSelected((element) => ({ ...element, groupId: undefined }))
    flash("Grupo separado")
  }, [flash, updateSelected])

  const applyTheme = useCallback(
    (theme: PlanningTheme) => {
      const preset = THEME_PRESETS[theme]
      commit((current) => ({
        ...current,
        settings: { ...current.settings, theme, accent: preset.accent, fontFamily: preset.font },
        pages: current.pages.map((page) => ({
          ...page,
          background: preset.page,
          elements: page.elements.map((element) => ({
            ...element,
            style: {
              ...element.style,
              fontFamily: preset.font,
              color: element.type === "heading" ? preset.heading : element.style.color,
              background: element.type === "quote" ? preset.quote : element.style.background,
            },
          })),
        })),
      }))
      flash(`Diseño ${preset.label} aplicado`)
    },
    [commit, flash]
  )

  const addPage = useCallback(
    (paper: PlanningPaper = "a4") => {
      const current = documentRef.current
      if (!current) return
      const page = createPlanningPage(current.pages.length, { paper })
      commit((document) => ({ ...document, pages: [...document.pages, page], activePageId: page.id }))
      setSelectedIds([])
      flash("Página agregada")
    },
    [commit, flash]
  )

  const duplicatePage = useCallback(() => {
    const current = documentRef.current
    const page = current?.pages.find((item) => item.id === current.activePageId)
    if (!current || !page) return
    const duplicate = createPlanningPage(current.pages.length, {
      paper: page.paper,
      orientation: page.orientation,
      background: page.background,
      elements: page.elements.map((element) => ({ ...clonePlanningElement(element), x: element.x, y: element.y })),
    })
    commit((document) => ({ ...document, pages: [...document.pages, duplicate], activePageId: duplicate.id }))
    setSelectedIds([])
    flash("Página duplicada")
  }, [commit, flash])

  const deletePage = useCallback(() => {
    const current = documentRef.current
    if (!current || current.pages.length <= 1) {
      flash("El documento debe conservar al menos una página")
      return
    }
    const index = current.pages.findIndex((page) => page.id === current.activePageId)
    const nextPage = current.pages[index + 1] || current.pages[index - 1]
    commit((document) => ({
      ...document,
      pages: document.pages.filter((page) => page.id !== document.activePageId),
      activePageId: nextPage.id,
    }))
    setSelectedIds([])
    flash("Página eliminada")
  }, [commit, flash])

  const movePage = useCallback(
    (direction: -1 | 1) => {
      const current = documentRef.current
      if (!current) return
      const index = current.pages.findIndex((page) => page.id === current.activePageId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.pages.length) return
      commit((document) => {
        const pages = [...document.pages]
        ;[pages[index], pages[target]] = [pages[target], pages[index]]
        return { ...document, pages: pages.map((page, pageIndex) => ({ ...page, name: `Página ${pageIndex + 1}` })) }
      })
    },
    [commit]
  )

  const updatePageFormat = useCallback(
    (patch: Partial<Pick<PlanningPreviewPage, "paper" | "orientation" | "background">>) => {
      updateActivePage((page) => {
        const next = { ...page, ...patch }
        const dimensions = getPlanningPageDimensions(next.paper, next.orientation)
        return {
          ...next,
          elements: next.elements.map((element) => ({
            ...element,
            x: clamp(element.x, 0, Math.max(0, dimensions.width - element.width)),
            y: clamp(element.y, 0, Math.max(0, dimensions.height - element.height)),
          })),
        }
      })
    },
    [updateActivePage]
  )

  const startElementDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, page: PlanningPreviewPage, element: PlanningPreviewElement) => {
      if (editingId === element.id || element.locked || mode === "hand" || spacePressedRef.current) return
      event.preventDefault()
      event.stopPropagation()
      const current = documentRef.current
      if (!current) return
      let ids: string[]
      const groupIds = element.groupId
        ? page.elements.filter((item) => item.groupId === element.groupId).map((item) => item.id)
        : []
      if (event.shiftKey) {
        ids = selectedRef.current.includes(element.id)
          ? selectedRef.current.filter((id) => id !== element.id)
          : [...selectedRef.current, ...(groupIds.length ? groupIds : [element.id])]
      } else if (selectedRef.current.includes(element.id)) {
        ids = selectedRef.current
      } else {
        ids = groupIds.length ? groupIds : [element.id]
      }
      ids = [...new Set(ids)]
      setSelectedIds(ids)
      setEditingId("")
      const point = pointInPage(event, page.id)
      const origins: Record<string, { x: number; y: number }> = {}
      for (const item of page.elements) {
        if (ids.includes(item.id)) origins[item.id] = { x: item.x, y: item.y }
      }
      interactionRef.current = {
        kind: "drag",
        pageId: page.id,
        startX: point.x,
        startY: point.y,
        ids,
        origins,
        snapshot: cloneDocument(current),
        moved: false,
      }
    },
    [editingId, mode, pointInPage]
  )

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, pageId: string, element: PlanningPreviewElement, handle: ResizeHandle) => {
      event.preventDefault()
      event.stopPropagation()
      const current = documentRef.current
      if (!current || element.locked) return
      const point = pointInPage(event, pageId)
      interactionRef.current = {
        kind: "resize",
        pageId,
        startX: point.x,
        startY: point.y,
        handle,
        element: cloneDocument({
          version: 2,
          sourceId: "resize",
          title: "",
          subtitle: "",
          pages: [{ ...createPlanningPage(0), elements: [element] }],
          activePageId: "",
          settings: current.settings,
          metadata: {},
          updatedAt: "",
        }).pages[0].elements[0],
        snapshot: cloneDocument(current),
        moved: false,
      }
    },
    [pointInPage]
  )

  const startRotate = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, pageId: string, element: PlanningPreviewElement) => {
      event.preventDefault()
      event.stopPropagation()
      const current = documentRef.current
      if (!current || element.locked) return
      const point = pointInPage(event, pageId)
      const centerX = element.x + element.width / 2
      const centerY = element.y + element.height / 2
      interactionRef.current = {
        kind: "rotate",
        pageId,
        centerX,
        centerY,
        startAngle: Math.atan2(point.y - centerY, point.x - centerX) * (180 / Math.PI),
        startRotation: element.rotation,
        elementId: element.id,
        snapshot: cloneDocument(current),
        moved: false,
      }
    },
    [pointInPage]
  )

  const startPageInteraction = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, page: PlanningPreviewPage) => {
      if (event.target !== event.currentTarget) return
      selectPage(page.id)
      const scroll = canvasScrollRef.current
      if ((mode === "hand" || spacePressedRef.current) && scroll) {
        event.preventDefault()
        interactionRef.current = {
          kind: "pan",
          startClientX: event.clientX,
          startClientY: event.clientY,
          scrollLeft: scroll.scrollLeft,
          scrollTop: scroll.scrollTop,
        }
        return
      }
      const point = pointInPage(event, page.id)
      if (!event.shiftKey) setSelectedIds([])
      setEditingId("")
      interactionRef.current = {
        kind: "marquee",
        pageId: page.id,
        startX: point.x,
        startY: point.y,
        additive: event.shiftKey,
      }
      setMarquee({ pageId: page.id, x: point.x, y: point.y, width: 0, height: 0 })
    },
    [mode, pointInPage, selectPage]
  )

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const interaction = interactionRef.current
      if (!interaction) return

      if (interaction.kind === "pan") {
        const scroll = canvasScrollRef.current
        if (!scroll) return
        scroll.scrollLeft = interaction.scrollLeft - (event.clientX - interaction.startClientX)
        scroll.scrollTop = interaction.scrollTop - (event.clientY - interaction.startClientY)
        return
      }

      const point = pointInPage(event, interaction.pageId)
      if (interaction.kind === "marquee") {
        const x = Math.min(interaction.startX, point.x)
        const y = Math.min(interaction.startY, point.y)
        setMarquee({
          pageId: interaction.pageId,
          x,
          y,
          width: Math.abs(point.x - interaction.startX),
          height: Math.abs(point.y - interaction.startY),
        })
        return
      }

      if (interaction.kind === "drag") {
        const dx = point.x - interaction.startX
        const dy = point.y - interaction.startY
        if (Math.abs(dx) + Math.abs(dy) > 1) interaction.moved = true
        transientFrom(interaction.snapshot, (document) => ({
          ...document,
          pages: document.pages.map((page) => {
            if (page.id !== interaction.pageId) return page
            const dimensions = getPlanningPageDimensions(page.paper, page.orientation)
            return {
              ...page,
              elements: page.elements.map((element) => {
                const origin = interaction.origins[element.id]
                if (!origin || element.locked) return element
                return {
                  ...element,
                  x: clamp(
                    snap(origin.x + dx, document.settings.gridSize, document.settings.snapToGrid && !event.altKey),
                    0,
                    Math.max(0, dimensions.width - element.width)
                  ),
                  y: clamp(
                    snap(origin.y + dy, document.settings.gridSize, document.settings.snapToGrid && !event.altKey),
                    0,
                    Math.max(0, dimensions.height - element.height)
                  ),
                }
              }),
            }
          }),
        }))
        return
      }

      if (interaction.kind === "resize") {
        const dx = point.x - interaction.startX
        const dy = point.y - interaction.startY
        if (Math.abs(dx) + Math.abs(dy) > 1) interaction.moved = true
        const original = interaction.element
        let x = original.x
        let y = original.y
        let width = original.width
        let height = original.height
        if (interaction.handle.includes("e")) width = original.width + dx
        if (interaction.handle.includes("s")) height = original.height + dy
        if (interaction.handle.includes("w")) {
          width = original.width - dx
          x = original.x + dx
        }
        if (interaction.handle.includes("n")) {
          height = original.height - dy
          y = original.y + dy
        }
        const keepRatio = event.shiftKey || original.type === "image"
        if (keepRatio) {
          const ratio = original.width / Math.max(1, original.height)
          if (Math.abs(dx) > Math.abs(dy)) height = width / ratio
          else width = height * ratio
          if (interaction.handle.includes("w")) x = original.x + original.width - width
          if (interaction.handle.includes("n")) y = original.y + original.height - height
        }
        const minWidth = original.type === "divider" ? 30 : 42
        const minHeight = original.type === "divider" ? 2 : 28
        width = Math.max(minWidth, width)
        height = Math.max(minHeight, height)
        transientFrom(interaction.snapshot, (document) => ({
          ...document,
          pages: document.pages.map((page) => {
            if (page.id !== interaction.pageId) return page
            const dimensions = getPlanningPageDimensions(page.paper, page.orientation)
            return {
              ...page,
              elements: page.elements.map((element) =>
                element.id === original.id
                  ? {
                      ...element,
                      x: clamp(x, 0, dimensions.width - minWidth),
                      y: clamp(y, 0, dimensions.height - minHeight),
                      width: clamp(width, minWidth, dimensions.width - clamp(x, 0, dimensions.width - minWidth)),
                      height: clamp(height, minHeight, dimensions.height - clamp(y, 0, dimensions.height - minHeight)),
                    }
                  : element
              ),
            }
          }),
        }))
        return
      }

      const angle = Math.atan2(point.y - interaction.centerY, point.x - interaction.centerX) * (180 / Math.PI)
      const rotation = interaction.startRotation + angle - interaction.startAngle
      interaction.moved = true
      transientFrom(interaction.snapshot, (document) => ({
        ...document,
        pages: document.pages.map((page) =>
          page.id === interaction.pageId
            ? {
                ...page,
                elements: page.elements.map((element) =>
                  element.id === interaction.elementId
                    ? { ...element, rotation: event.shiftKey ? Math.round(rotation / 15) * 15 : Math.round(rotation) }
                    : element
                ),
              }
            : page
        ),
      }))
    }

    function handlePointerUp() {
      const interaction = interactionRef.current
      if (!interaction) return
      if (interaction.kind === "marquee") {
        const current = documentRef.current
        const page = current?.pages.find((item) => item.id === interaction.pageId)
        const box = marquee
        if (page && box && box.width > 3 && box.height > 3) {
          const ids = page.elements
            .filter((element) => {
              const intersects =
                element.x < box.x + box.width &&
                element.x + element.width > box.x &&
                element.y < box.y + box.height &&
                element.y + element.height > box.y
              return intersects && !element.hidden
            })
            .flatMap((element) =>
              element.groupId
                ? page.elements.filter((item) => item.groupId === element.groupId).map((item) => item.id)
                : [element.id]
            )
          setSelectedIds((previous) => [...new Set(interaction.additive ? [...previous, ...ids] : ids)])
        }
        setMarquee(null)
      } else if ("moved" in interaction && interaction.moved) {
        pushHistory(interaction.snapshot)
      }
      interactionRef.current = null
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [marquee, pointInPage, pushHistory, transientFrom])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const typing = isTypingTarget(event.target)
      const modifier = event.ctrlKey || event.metaKey
      if (event.code === "Space" && !typing) {
        spacePressedRef.current = true
        event.preventDefault()
      }
      if (typing) {
        if (event.key === "Escape") {
          ;(event.target as HTMLElement)?.blur?.()
          setEditingId("")
        }
        return
      }
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault()
        saveDraft()
      } else if (modifier && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if ((modifier && event.key.toLowerCase() === "y") || (modifier && event.shiftKey && event.key.toLowerCase() === "z")) {
        event.preventDefault()
        redo()
      } else if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault()
        selectAll()
      } else if (modifier && event.key.toLowerCase() === "c") {
        event.preventDefault()
        copySelection()
      } else if (modifier && event.key.toLowerCase() === "x") {
        event.preventDefault()
        cutSelection()
      } else if (modifier && event.key.toLowerCase() === "v") {
        event.preventDefault()
        pasteSelection()
      } else if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault()
        duplicateSelection()
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        deleteSelection()
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        nudgeSelection(event.shiftKey ? -10 : -1, 0)
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        nudgeSelection(event.shiftKey ? 10 : 1, 0)
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        nudgeSelection(0, event.shiftKey ? -10 : -1)
      } else if (event.key === "ArrowDown") {
        event.preventDefault()
        nudgeSelection(0, event.shiftKey ? 10 : 1)
      } else if (event.key === "Escape") {
        setSelectedIds([])
        setEditingId("")
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") spacePressedRef.current = false
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [copySelection, cutSelection, deleteSelection, duplicateSelection, nudgeSelection, pasteSelection, redo, saveDraft, selectAll, undo])

  useEffect(() => {
    if (!editingId) return
    window.requestAnimationFrame(() => {
      const node = window.document.querySelector<HTMLElement>(`[data-edit-id="${editingId}"]`)
      node?.focus()
    })
  }, [editingId])

  const handleImageUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return
      if (!file.type.startsWith("image/")) {
        flash("Selecciona un archivo de imagen")
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const src = typeof reader.result === "string" ? reader.result : ""
        if (!src) return
        const image = new Image()
        image.onload = () => {
          const maxWidth = 420
          const ratio = image.naturalWidth / Math.max(1, image.naturalHeight)
          const width = Math.min(maxWidth, image.naturalWidth || maxWidth)
          const height = width / Math.max(0.1, ratio)
          insertElement("image", {
            src,
            alt: file.name,
            width,
            height: clamp(height, 80, 440),
            style: { padding: 0, borderWidth: 0, imageFit: "contain", background: "#ffffff00" },
          })
        }
        image.src = src
      }
      reader.readAsDataURL(file)
    },
    [flash, insertElement]
  )

  const updateText = useCallback(
    (elementId: string, text: string) => {
      const current = documentRef.current
      if (!current) return
      commit((document) => ({
        ...document,
        pages: document.pages.map((page) =>
          page.id === document.activePageId
            ? {
                ...page,
                elements: page.elements.map((element) =>
                  element.id === elementId ? { ...element, text } : element
                ),
              }
            : page
        ),
      }))
    },
    [commit]
  )

  const updateListItem = useCallback(
    (elementId: string, itemIndex: number, value: string) => {
      const current = documentRef.current
      const page = current?.pages.find((item) => item.id === current.activePageId)
      const element = page?.elements.find((item) => item.id === elementId)
      if (!element) return
      const items = [...(element.items || [])]
      items[itemIndex] = value
      commit((document) => ({
        ...document,
        pages: document.pages.map((item) =>
          item.id === document.activePageId
            ? {
                ...item,
                elements: item.elements.map((entry) =>
                  entry.id === elementId ? { ...entry, items } : entry
                ),
              }
            : item
        ),
      }))
    },
    [commit]
  )

  const updateTableCell = useCallback(
    (elementId: string, rowIndex: number, columnIndex: number, value: string) => {
      const current = documentRef.current
      const page = current?.pages.find((item) => item.id === current.activePageId)
      const element = page?.elements.find((item) => item.id === elementId)
      if (!element) return
      const rows = (element.rows || []).map((row) => [...row])
      if (!rows[rowIndex]) rows[rowIndex] = []
      rows[rowIndex][columnIndex] = value
      commit((document) => ({
        ...document,
        pages: document.pages.map((item) =>
          item.id === document.activePageId
            ? {
                ...item,
                elements: item.elements.map((entry) =>
                  entry.id === elementId ? { ...entry, rows } : entry
                ),
              }
            : item
        ),
      }))
    },
    [commit]
  )

  const addListItem = useCallback(() => {
    updateSelected((element) =>
      element.type === "list" ? { ...element, items: [...(element.items || []), "Nuevo elemento"] } : element
    )
  }, [updateSelected])

  const addTableRow = useCallback(() => {
    updateSelected((element) => {
      if (element.type !== "table") return element
      const rows = element.rows || [["Encabezado"]]
      const columns = Math.max(1, rows[0]?.length || 1)
      return { ...element, rows: [...rows, Array.from({ length: columns }, () => "Contenido")] }
    })
  }, [updateSelected])

  const addTableColumn = useCallback(() => {
    updateSelected((element) => {
      if (element.type !== "table") return element
      const rows = element.rows || [["Encabezado"]]
      return {
        ...element,
        rows: rows.map((row, index) => [...row, index === 0 ? "Encabezado" : "Contenido"]),
      }
    })
  }, [updateSelected])

  const exportPdf = useCallback(async () => {
    const current = documentRef.current
    if (!current || exporting) return
    setExporting(true)
    const previousSelection = selectedRef.current
    setSelectedIds([])
    setEditingId("")
    try {
      await window.document.fonts?.ready
      await new Promise((resolve) => window.setTimeout(resolve, 120))
      let pdf: jsPDF | null = null
      for (let index = 0; index < current.pages.length; index += 1) {
        const page = current.pages[index]
        const node = pageRefs.current.get(page.id)
        if (!node) continue
        const dimensions = getPlanningPageDimensions(page.paper, page.orientation)
        const dataUrl = await toPng(node, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: page.background,
          filter: (element) => !(element instanceof HTMLElement && element.dataset.editorChrome === "true"),
        })
        if (!pdf) {
          pdf = new jsPDF({
            orientation: dimensions.width > dimensions.height ? "landscape" : "portrait",
            unit: "px",
            format: [dimensions.width, dimensions.height],
            compress: true,
            hotfixes: ["px_scaling"],
          })
        } else {
          pdf.addPage([dimensions.width, dimensions.height], dimensions.width > dimensions.height ? "landscape" : "portrait")
        }
        pdf.addImage(dataUrl, "PNG", 0, 0, dimensions.width, dimensions.height, undefined, "FAST")
      }
      pdf?.save(`${safeFileName(current.title)}.pdf`)
      flash("PDF descargado")
    } catch (error) {
      console.error("Error al exportar PDF:", error)
      flash("No se pudo generar el PDF")
    } finally {
      setExporting(false)
      setSelectedIds(previousSelection)
    }
  }, [exporting, flash])

  const exportWord = useCallback(() => {
    const current = documentRef.current
    if (!current) return
    const pages = current.pages
      .map((page, index) => {
        const dimensions = getPlanningPageDimensions(page.paper, page.orientation)
        const content = [...page.elements]
          .filter((element) => !element.hidden)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map(elementHtml)
          .join("")
        return `<section style="position:relative;width:${dimensions.width}px;height:${dimensions.height}px;background:${page.background};overflow:hidden;page-break-after:${index === current.pages.length - 1 ? "auto" : "always"};box-sizing:border-box">${content}</section>`
      })
      .join("")
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(current.title)}</title><style>@page{margin:0}body{margin:0;background:#fff}table{border-collapse:collapse}</style></head><body>${pages}</body></html>`
    downloadBlob(new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" }), `${safeFileName(current.title)}.doc`)
    flash("Documento Word descargado")
  }, [flash])

  const copyAsText = useCallback(async () => {
    const current = documentRef.current
    if (!current) return
    await navigator.clipboard.writeText(planningDocumentToText(current))
    flash("Contenido copiado como texto")
  }, [flash])

  const resetDraft = useCallback(() => {
    const rawPayload = sessionStorage.getItem(PLANNING_PREVIEW_SESSION_KEY)
    if (!rawPayload) return
    try {
      const payload = asPayload(JSON.parse(rawPayload))
      if (!payload) return
      const next = createPlanningPreviewDocument(payload)
      pushHistory(documentRef.current || next)
      documentRef.current = next
      setDocumentState(next)
      setSelectedIds(next.pages[0]?.elements[0]?.id ? [next.pages[0].elements[0].id] : [])
      localStorage.removeItem(PLANNING_PREVIEW_DRAFT_KEY)
      flash("Vista previa restaurada")
    } catch {
      flash("No se pudo restaurar la planificación")
    }
  }, [flash, pushHistory])

  function renderElement(page: PlanningPreviewPage, element: PlanningPreviewElement) {
    if (element.hidden) return null
    const selected = selectedIds.includes(element.id)
    const editing = editingId === element.id
    const style = element.style
    const wrapperStyle: CSSProperties = {
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      transform: `rotate(${element.rotation}deg)`,
      zIndex: element.zIndex,
      opacity: style.opacity,
      borderColor: style.borderColor,
      borderWidth: style.borderWidth,
      borderRadius: style.borderRadius,
      background: style.background,
      boxShadow: style.shadow ? "0 12px 28px rgba(15,23,42,.18)" : undefined,
    }
    const bodyStyle: CSSProperties = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      color: style.color,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      textDecoration: style.textDecoration,
      textAlign: style.textAlign,
      padding: style.padding,
      justifyContent: style.verticalAlign === "top" ? "flex-start" : style.verticalAlign === "middle" ? "center" : "flex-end",
    }

    const commonEditable = {
      contentEditable: editing,
      suppressContentEditableWarning: true,
      onDoubleClick: (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation()
        if (!element.locked) setEditingId(element.id)
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape") {
          event.currentTarget.blur()
          setEditingId("")
        }
      },
    }

    let content: React.ReactNode
    if (element.type === "image") {
      content = (
        <img
          src={element.src || ""}
          alt={element.alt || "Imagen"}
          draggable={false}
          className={styles.imageElement}
          style={{ objectFit: style.imageFit }}
        />
      )
    } else if (element.type === "divider") {
      content = <div className={styles.dividerElement} style={{ background: style.background === "#ffffff00" ? style.borderColor : style.background }} />
    } else if (element.type === "table") {
      content = (
        <table className={styles.tableElement} style={{ fontFamily: style.fontFamily, fontSize: style.fontSize, color: style.color }}>
          <tbody>
            {(element.rows || []).map((row, rowIndex) => (
              <tr key={`${element.id}-row-${rowIndex}`}>
                {row.map((cell, columnIndex) => {
                  const Tag = rowIndex === 0 ? "th" : "td"
                  return (
                    <Tag
                      key={`${element.id}-${rowIndex}-${columnIndex}`}
                      contentEditable={editing}
                      suppressContentEditableWarning
                      onDoubleClick={(event) => {
                        event.stopPropagation()
                        if (!element.locked) setEditingId(element.id)
                      }}
                      onBlur={(event) => updateTableCell(element.id, rowIndex, columnIndex, event.currentTarget.innerText)}
                      style={{ borderColor: style.borderColor, textAlign: style.textAlign, padding: Math.max(4, style.padding / 2) }}
                    >
                      {cell}
                    </Tag>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )
    } else if (element.type === "list") {
      const Tag = element.ordered ? "ol" : "ul"
      content = (
        <Tag className={styles.listElement} style={bodyStyle}>
          {(element.items || []).map((item, index) => (
            <li
              key={`${element.id}-item-${index}`}
              contentEditable={editing}
              suppressContentEditableWarning
              onDoubleClick={(event) => {
                event.stopPropagation()
                if (!element.locked) setEditingId(element.id)
              }}
              onBlur={(event) => updateListItem(element.id, index, event.currentTarget.innerText)}
            >
              {item}
            </li>
          ))}
        </Tag>
      )
    } else {
      const shapeClass = element.type === "shape" ? styles[`shape_${element.shapeKind || "rectangle"}`] : ""
      content = (
        <div
          {...commonEditable}
          data-edit-id={element.id}
          className={`${styles.textElement} ${shapeClass}`}
          style={bodyStyle}
          onBlur={(event) => updateText(element.id, event.currentTarget.innerText)}
        >
          {element.text}
        </div>
      )
    }

    return (
      <div
        key={element.id}
        className={`${styles.element} ${selected ? styles.selectedElement : ""} ${element.locked ? styles.lockedElement : ""} ${editing ? styles.editingElement : ""}`}
        style={wrapperStyle}
        onPointerDown={(event) => startElementDrag(event, page, element)}
        onClick={(event) => event.stopPropagation()}
        data-element-id={element.id}
      >
        {content}
        {selected && selectedIds.length === 1 && !element.locked && !exporting && (
          <div data-editor-chrome="true">
            {(Object.keys(HANDLE_POSITIONS) as ResizeHandle[]).map((handle) => (
              <button
                key={handle}
                type="button"
                aria-label={`Redimensionar ${handle}`}
                className={`${styles.resizeHandle} ${HANDLE_POSITIONS[handle]}`}
                onPointerDown={(event) => startResize(event, page.id, element, handle)}
              />
            ))}
            <button
              type="button"
              aria-label="Girar elemento"
              className={styles.rotateHandle}
              onPointerDown={(event) => startRotate(event, page.id, element)}
            >
              ↻
            </button>
          </div>
        )}
        {element.locked && selected && <span className={styles.lockBadge}>🔒</span>}
      </div>
    )
  }

  function colorPalette(value: string, onChange: (color: string) => void) {
    return (
      <div className={styles.palette}>
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={`${styles.swatch} ${value.toLowerCase() === color.toLowerCase() ? styles.activeSwatch : ""}`}
            style={{ background: color }}
            title={color}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    )
  }

  function panelHeader(title: string, description: string) {
    return (
      <div className={styles.flyoutHeader}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button type="button" onClick={() => setActivePanel(null)} aria-label="Cerrar panel">×</button>
      </div>
    )
  }

  function renderPanel() {
    if (!activePanel || !documentState || !activePage) return null
    const selectedCount = selectedElements.length
    const hasTextSelection = selectedElements.some((element) => element.type !== "image" && element.type !== "divider")

    if (activePanel === "select") {
      return (
        <div className={styles.flyoutContent}>
          {panelHeader("Seleccionar y mover", "Controla elementos con cursor, teclado o selección múltiple.")}
          <section className={styles.panelSection}>
            <h3>Herramienta activa</h3>
            <div className={styles.twoColumns}>
              <button className={mode === "select" ? styles.primaryButton : styles.toolButton} onClick={() => setMode("select")}>↖ Seleccionar</button>
              <button className={mode === "hand" ? styles.primaryButton : styles.toolButton} onClick={() => setMode("hand")}>✋ Mover vista</button>
            </div>
            <p className={styles.helpText}>Mantén presionada la barra espaciadora para mover temporalmente el lienzo.</p>
          </section>
          <section className={styles.panelSection}>
            <h3>Selección · {selectedCount}</h3>
            <div className={styles.twoColumns}>
              <button className={styles.toolButton} onClick={selectAll}>Seleccionar todo</button>
              <button className={styles.toolButton} onClick={() => setSelectedIds([])}>Deseleccionar</button>
              <button className={styles.toolButton} disabled={!selectedCount} onClick={duplicateSelection}>Duplicar</button>
              <button className={styles.dangerButton} disabled={!selectedCount} onClick={deleteSelection}>Eliminar</button>
              <button className={styles.toolButton} disabled={!selectedCount} onClick={copySelection}>Copiar</button>
              <button className={styles.toolButton} disabled={!clipboardRef.current.length} onClick={pasteSelection}>Pegar</button>
            </div>
          </section>
          <section className={styles.panelSection}>
            <h3>Historial</h3>
            <div className={styles.twoColumns}>
              <button className={styles.toolButton} onClick={undo}>↶ Deshacer</button>
              <button className={styles.toolButton} onClick={redo}>↷ Rehacer</button>
            </div>
          </section>
          <section className={styles.panelSection}>
            <h3>Atajos principales</h3>
            <div className={styles.shortcutGrid}>
              <span><kbd>Supr</kbd> eliminar</span><span><kbd>Flechas</kbd> mover</span>
              <span><kbd>Shift</kbd> selección múltiple</span><span><kbd>Ctrl A</kbd> todo</span>
              <span><kbd>Ctrl C/V</kbd> copiar/pegar</span><span><kbd>Ctrl D</kbd> duplicar</span>
              <span><kbd>Ctrl Z/Y</kbd> deshacer/rehacer</span><span><kbd>Ctrl S</kbd> guardar</span>
            </div>
          </section>
        </div>
      )
    }

    if (activePanel === "insert") {
      return (
        <div className={styles.flyoutContent}>
          {panelHeader("Agregar elementos", "Inserta contenido nuevo en la página activa.")}
          <section className={styles.panelSection}>
            <h3>Texto y contenido</h3>
            <div className={styles.elementGrid}>
              <button onClick={() => insertElement("heading", { level: 1, text: "Nuevo título" })}><b>T1</b><span>Título</span></button>
              <button onClick={() => insertElement("heading", { level: 2, text: "Nuevo subtítulo" })}><b>T2</b><span>Subtítulo</span></button>
              <button onClick={() => insertElement("paragraph")}><b>¶</b><span>Texto</span></button>
              <button onClick={() => insertElement("quote")}><b>❝</b><span>Nota</span></button>
              <button onClick={() => insertElement("list", { items: ["Nuevo elemento", "Otro elemento"], ordered: false })}><b>☷</b><span>Lista</span></button>
              <button onClick={() => insertElement("table", { rows: [["Encabezado 1", "Encabezado 2"], ["Contenido", "Contenido"]] })}><b>▦</b><span>Tabla</span></button>
              <button onClick={() => insertElement("divider", { height: 4, style: { background: documentState.settings.accent, borderColor: documentState.settings.accent } })}><b>—</b><span>Línea</span></button>
              <button onClick={() => imageInputRef.current?.click()}><b>▧</b><span>Imagen</span></button>
            </div>
          </section>
          <section className={styles.panelSection}>
            <h3>Figuras</h3>
            <div className={styles.elementGrid}>
              {SHAPES.map((shape) => (
                <button
                  key={shape.kind}
                  onClick={() => insertElement("shape", {
                    shapeKind: shape.kind,
                    text: shape.kind === "arrow" || shape.kind === "triangle" ? "" : shape.label,
                    width: shape.kind === "circle" ? 180 : shape.kind === "arrow" ? 280 : 250,
                    height: shape.kind === "circle" ? 180 : shape.kind === "arrow" ? 90 : 130,
                    style: {
                      background: shape.kind === "triangle" || shape.kind === "arrow" ? documentState.settings.accent : "#dbeafe",
                      borderColor: documentState.settings.accent,
                      borderWidth: shape.kind === "triangle" || shape.kind === "arrow" ? 0 : 2,
                      textAlign: "center",
                      verticalAlign: "middle",
                    },
                  })}
                >
                  <b>{shape.icon}</b><span>{shape.label}</span>
                </button>
              ))}
            </div>
          </section>
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
        </div>
      )
    }

    if (activePanel === "text") {
      return (
        <div className={styles.flyoutContent}>
          {panelHeader("Texto y tipografía", "Edita fuentes, tamaños y formato de los elementos seleccionados.")}
          {!hasTextSelection && <div className={styles.emptyPanel}>Selecciona un texto, título, lista, tabla o figura con texto.</div>}
          <fieldset disabled={!hasTextSelection} className={styles.fieldset}>
            <section className={styles.panelSection}>
              <h3>Fuente de escritura</h3>
              <select className={styles.field} value={primaryElement?.style.fontFamily || documentState.settings.fontFamily} onChange={(event) => updateSelectedStyle({ fontFamily: event.target.value })}>
                {FONT_OPTIONS.map((font) => <option key={font} value={font} style={{ fontFamily: font }}>{font.split(",")[0]}</option>)}
              </select>
            </section>
            <section className={styles.panelSection}>
              <h3>Tamaño</h3>
              <div className={styles.inlineFields}>
                <input className={styles.field} type="number" min={6} max={200} value={primaryElement?.style.fontSize || 16} onChange={(event) => updateSelectedStyle({ fontSize: Number(event.target.value) || 16 })} />
                <span>px</span>
              </div>
              <div className={styles.sizePalette}>
                {FONT_SIZES.map((size) => <button key={size} className={primaryElement?.style.fontSize === size ? styles.activeSize : ""} onClick={() => updateSelectedStyle({ fontSize: size })}>{size}</button>)}
              </div>
            </section>
            <section className={styles.panelSection}>
              <h3>Formato</h3>
              <div className={styles.fourColumns}>
                <button className={primaryElement?.style.fontWeight === 700 ? styles.activeTool : styles.toolButton} onClick={() => updateSelectedStyle({ fontWeight: primaryElement?.style.fontWeight === 700 ? 400 : 700 })}><b>B</b></button>
                <button className={primaryElement?.style.fontStyle === "italic" ? styles.activeTool : styles.toolButton} onClick={() => updateSelectedStyle({ fontStyle: primaryElement?.style.fontStyle === "italic" ? "normal" : "italic" })}><i>I</i></button>
                <button className={primaryElement?.style.textDecoration === "underline" ? styles.activeTool : styles.toolButton} onClick={() => updateSelectedStyle({ textDecoration: primaryElement?.style.textDecoration === "underline" ? "none" : "underline" })}><u>U</u></button>
                <button className={styles.toolButton} onClick={() => updateSelectedStyle({ fontWeight: 400, fontStyle: "normal", textDecoration: "none" })}>Limpiar</button>
              </div>
            </section>
            <section className={styles.panelSection}>
              <h3>Alineación</h3>
              <div className={styles.fourColumns}>
                {(["left", "center", "right", "justify"] as PlanningTextAlign[]).map((alignment) => (
                  <button key={alignment} className={primaryElement?.style.textAlign === alignment ? styles.activeTool : styles.toolButton} onClick={() => updateSelectedStyle({ textAlign: alignment })}>{alignment === "left" ? "≡←" : alignment === "center" ? "≡" : alignment === "right" ? "→≡" : "☰"}</button>
                ))}
              </div>
              <div className={styles.threeColumns}>
                <button className={primaryElement?.style.verticalAlign === "top" ? styles.activeTool : styles.toolButton} onClick={() => updateSelectedStyle({ verticalAlign: "top" })}>Arriba</button>
                <button className={primaryElement?.style.verticalAlign === "middle" ? styles.activeTool : styles.toolButton} onClick={() => updateSelectedStyle({ verticalAlign: "middle" })}>Centro</button>
                <button className={primaryElement?.style.verticalAlign === "bottom" ? styles.activeTool : styles.toolButton} onClick={() => updateSelectedStyle({ verticalAlign: "bottom" })}>Abajo</button>
              </div>
            </section>
            <section className={styles.panelSection}>
              <h3>Espaciado</h3>
              <label className={styles.rangeLabel}>Interlineado <b>{primaryElement?.style.lineHeight.toFixed(2) || "1.45"}</b></label>
              <input type="range" min="0.8" max="3" step="0.05" value={primaryElement?.style.lineHeight || 1.45} onChange={(event) => updateSelectedStyle({ lineHeight: Number(event.target.value) })} />
              <label className={styles.rangeLabel}>Espacio entre letras <b>{primaryElement?.style.letterSpacing || 0}px</b></label>
              <input type="range" min="-2" max="12" step="0.25" value={primaryElement?.style.letterSpacing || 0} onChange={(event) => updateSelectedStyle({ letterSpacing: Number(event.target.value) })} />
            </section>
            <section className={styles.panelSection}>
              <h3>Color del texto</h3>
              {colorPalette(primaryElement?.style.color || "#0f172a", (color) => updateSelectedStyle({ color }))}
              <div className={styles.colorInput}><input type="color" value={primaryElement?.style.color || "#0f172a"} onChange={(event) => updateSelectedStyle({ color: event.target.value })} /><input className={styles.field} value={primaryElement?.style.color || "#0f172a"} onChange={(event) => updateSelectedStyle({ color: event.target.value })} /></div>
            </section>
            {primaryElement?.type === "list" && <section className={styles.panelSection}><h3>Lista</h3><div className={styles.twoColumns}><button className={styles.toolButton} onClick={addListItem}>Agregar elemento</button><button className={styles.toolButton} onClick={() => updateSelected((element) => element.type === "list" ? { ...element, ordered: !element.ordered } : element)}>{primaryElement.ordered ? "Usar viñetas" : "Numerar"}</button></div></section>}
            {primaryElement?.type === "table" && <section className={styles.panelSection}><h3>Tabla</h3><div className={styles.twoColumns}><button className={styles.toolButton} onClick={addTableRow}>Agregar fila</button><button className={styles.toolButton} onClick={addTableColumn}>Agregar columna</button></div></section>}
          </fieldset>
        </div>
      )
    }

    if (activePanel === "style") {
      return (
        <div className={styles.flyoutContent}>
          {panelHeader("Colores y apariencia", "Personaliza relleno, borde, transparencia e imágenes.")}
          {!selectedCount && <div className={styles.emptyPanel}>Selecciona uno o varios elementos.</div>}
          <fieldset disabled={!selectedCount} className={styles.fieldset}>
            <section className={styles.panelSection}>
              <h3>Color de relleno</h3>
              <button className={styles.toolButton} onClick={() => updateSelectedStyle({ background: "#ffffff00" })}>Sin relleno</button>
              {colorPalette(primaryElement?.style.background || "#ffffff", (color) => updateSelectedStyle({ background: color }))}
              <div className={styles.colorInput}><input type="color" value={primaryElement?.style.background === "#ffffff00" ? "#ffffff" : primaryElement?.style.background || "#ffffff"} onChange={(event) => updateSelectedStyle({ background: event.target.value })} /><input className={styles.field} value={primaryElement?.style.background || "#ffffff00"} onChange={(event) => updateSelectedStyle({ background: event.target.value })} /></div>
            </section>
            <section className={styles.panelSection}>
              <h3>Color del borde</h3>
              {colorPalette(primaryElement?.style.borderColor || "#94a3b8", (color) => updateSelectedStyle({ borderColor: color }))}
              <div className={styles.colorInput}><input type="color" value={primaryElement?.style.borderColor || "#94a3b8"} onChange={(event) => updateSelectedStyle({ borderColor: event.target.value })} /><input className={styles.field} value={primaryElement?.style.borderColor || "#94a3b8"} onChange={(event) => updateSelectedStyle({ borderColor: event.target.value })} /></div>
            </section>
            <section className={styles.panelSection}>
              <h3>Borde y esquinas</h3>
              <label className={styles.rangeLabel}>Grosor <b>{primaryElement?.style.borderWidth || 0}px</b></label>
              <input type="range" min="0" max="16" value={primaryElement?.style.borderWidth || 0} onChange={(event) => updateSelectedStyle({ borderWidth: Number(event.target.value) })} />
              <label className={styles.rangeLabel}>Redondeado <b>{primaryElement?.style.borderRadius || 0}px</b></label>
              <input type="range" min="0" max="100" value={primaryElement?.style.borderRadius || 0} onChange={(event) => updateSelectedStyle({ borderRadius: Number(event.target.value) })} />
              <label className={styles.rangeLabel}>Relleno interno <b>{primaryElement?.style.padding || 0}px</b></label>
              <input type="range" min="0" max="60" value={primaryElement?.style.padding || 0} onChange={(event) => updateSelectedStyle({ padding: Number(event.target.value) })} />
            </section>
            <section className={styles.panelSection}>
              <h3>Efectos</h3>
              <label className={styles.rangeLabel}>Opacidad <b>{Math.round((primaryElement?.style.opacity || 1) * 100)}%</b></label>
              <input type="range" min="0.05" max="1" step="0.05" value={primaryElement?.style.opacity || 1} onChange={(event) => updateSelectedStyle({ opacity: Number(event.target.value) })} />
              <button className={primaryElement?.style.shadow ? styles.activeTool : styles.toolButton} onClick={() => updateSelectedStyle({ shadow: !primaryElement?.style.shadow })}>Sombra</button>
            </section>
            {primaryElement?.type === "image" && <section className={styles.panelSection}><h3>Ajuste de imagen</h3><div className={styles.threeColumns}>{(["contain", "cover", "fill"] as PlanningImageFit[]).map((fit) => <button key={fit} className={primaryElement.style.imageFit === fit ? styles.activeTool : styles.toolButton} onClick={() => updateSelectedStyle({ imageFit: fit })}>{fit === "contain" ? "Completa" : fit === "cover" ? "Recortar" : "Estirar"}</button>)}</div></section>}
            {primaryElement?.type === "shape" && <section className={styles.panelSection}><h3>Tipo de figura</h3><select className={styles.field} value={primaryElement.shapeKind || "rectangle"} onChange={(event) => updateSelected((element) => element.type === "shape" ? { ...element, shapeKind: event.target.value as PlanningShapeKind } : element)}>{SHAPES.map((shape) => <option key={shape.kind} value={shape.kind}>{shape.label}</option>)}</select></section>}
          </fieldset>
        </div>
      )
    }

    if (activePanel === "arrange") {
      return (
        <div className={styles.flyoutContent}>
          {panelHeader("Organizar elementos", "Posición, tamaño, capas, alineación, bloqueo y grupos.")}
          {!selectedCount && <div className={styles.emptyPanel}>Selecciona uno o varios elementos.</div>}
          <fieldset disabled={!selectedCount} className={styles.fieldset}>
            <section className={styles.panelSection}>
              <h3>Posición y tamaño</h3>
              <div className={styles.geometryGrid}>
                {(["x", "y", "width", "height", "rotation"] as const).map((property) => (
                  <label key={property}><span>{property === "width" ? "Ancho" : property === "height" ? "Alto" : property === "rotation" ? "Giro" : property.toUpperCase()}</span><input type="number" className={styles.field} value={Math.round(primaryElement?.[property] || 0)} onChange={(event) => { const value = Number(event.target.value) || 0; updateSelected((element) => ({ ...element, [property]: property === "width" || property === "height" ? Math.max(2, value) : value })) }} /></label>
                ))}
              </div>
            </section>
            <section className={styles.panelSection}>
              <h3>Capas</h3>
              <div className={styles.twoColumns}>
                <button className={styles.toolButton} onClick={() => setLayer("front")}>Traer al frente</button>
                <button className={styles.toolButton} onClick={() => setLayer("back")}>Enviar al fondo</button>
                <button className={styles.toolButton} onClick={() => setLayer("forward")}>Subir una capa</button>
                <button className={styles.toolButton} onClick={() => setLayer("backward")}>Bajar una capa</button>
              </div>
            </section>
            <section className={styles.panelSection}>
              <h3>Alinear</h3>
              <div className={styles.threeColumns}>{(["left", "center", "right", "top", "middle", "bottom"] as const).map((alignment) => <button key={alignment} className={styles.toolButton} onClick={() => alignSelection(alignment)}>{alignment === "left" ? "Izq." : alignment === "center" ? "Centro H" : alignment === "right" ? "Der." : alignment === "top" ? "Arriba" : alignment === "middle" ? "Centro V" : "Abajo"}</button>)}</div>
              <div className={styles.twoColumns}><button className={styles.toolButton} disabled={selectedCount < 3} onClick={() => distributeSelection("horizontal")}>Distribuir H</button><button className={styles.toolButton} disabled={selectedCount < 3} onClick={() => distributeSelection("vertical")}>Distribuir V</button></div>
            </section>
            <section className={styles.panelSection}>
              <h3>Agrupar y proteger</h3>
              <div className={styles.twoColumns}>
                <button className={styles.toolButton} disabled={selectedCount < 2} onClick={groupSelection}>Agrupar</button>
                <button className={styles.toolButton} onClick={ungroupSelection}>Desagrupar</button>
                <button className={primaryElement?.locked ? styles.activeTool : styles.toolButton} onClick={() => updateSelected((element) => ({ ...element, locked: !element.locked }))}>{primaryElement?.locked ? "Desbloquear" : "Bloquear"}</button>
                <button className={styles.dangerButton} onClick={deleteSelection}>Eliminar</button>
              </div>
            </section>
          </fieldset>
        </div>
      )
    }

    if (activePanel === "pages") {
      return (
        <div className={styles.flyoutContent}>
          {panelHeader("Páginas y documento", "Administra hojas A4, Carta u Oficio y la vista del lienzo.")}
          <section className={styles.panelSection}>
            <h3>Páginas</h3>
            <div className={styles.pageList}>
              {documentState.pages.map((page, index) => (
                <button key={page.id} className={page.id === activePage.id ? styles.activePageItem : styles.pageItem} onClick={() => selectPage(page.id)}><span>{index + 1}</span><div><b>{page.name}</b><small>{PAPER_DIMENSIONS[page.paper].label} · {page.orientation === "portrait" ? "Vertical" : "Horizontal"}</small></div></button>
              ))}
            </div>
            <div className={styles.twoColumns}><button className={styles.primaryButton} onClick={() => addPage(activePage.paper)}>+ Nueva página</button><button className={styles.toolButton} onClick={duplicatePage}>Duplicar</button><button className={styles.toolButton} onClick={() => movePage(-1)}>Subir</button><button className={styles.toolButton} onClick={() => movePage(1)}>Bajar</button><button className={styles.dangerButton} onClick={deletePage}>Eliminar página</button></div>
          </section>
          <section className={styles.panelSection}>
            <h3>Tamaño de la página</h3>
            <select className={styles.field} value={activePage.paper} onChange={(event) => updatePageFormat({ paper: event.target.value as PlanningPaper })}>
              <option value="a4">A4 · 210 × 297 mm</option>
              <option value="letter">Carta · 216 × 279 mm</option>
              <option value="oficio">Oficio · 216 × 330 mm</option>
            </select>
            <div className={styles.twoColumns}><button className={activePage.orientation === "portrait" ? styles.activeTool : styles.toolButton} onClick={() => updatePageFormat({ orientation: "portrait" })}>Vertical</button><button className={activePage.orientation === "landscape" ? styles.activeTool : styles.toolButton} onClick={() => updatePageFormat({ orientation: "landscape" })}>Horizontal</button></div>
          </section>
          <section className={styles.panelSection}>
            <h3>Fondo de página</h3>
            {colorPalette(activePage.background, (color) => updatePageFormat({ background: color }))}
            <div className={styles.colorInput}><input type="color" value={activePage.background} onChange={(event) => updatePageFormat({ background: event.target.value })} /><input className={styles.field} value={activePage.background} onChange={(event) => updatePageFormat({ background: event.target.value })} /></div>
          </section>
          <section className={styles.panelSection}>
            <h3>Diseño general</h3>
            <div className={styles.twoColumns}>{(Object.keys(THEME_PRESETS) as PlanningTheme[]).map((theme) => <button key={theme} className={documentState.settings.theme === theme ? styles.activeTool : styles.toolButton} onClick={() => applyTheme(theme)}>{THEME_PRESETS[theme].label}</button>)}</div>
          </section>
          <section className={styles.panelSection}>
            <h3>Cuadrícula y ajuste</h3>
            <div className={styles.twoColumns}><button className={documentState.settings.showGrid ? styles.activeTool : styles.toolButton} onClick={() => commit((document) => ({ ...document, settings: { ...document.settings, showGrid: !document.settings.showGrid } }))}>Cuadrícula</button><button className={documentState.settings.snapToGrid ? styles.activeTool : styles.toolButton} onClick={() => commit((document) => ({ ...document, settings: { ...document.settings, snapToGrid: !document.settings.snapToGrid } }))}>Ajustar a cuadrícula</button></div>
            <label className={styles.rangeLabel}>Tamaño de cuadrícula <b>{documentState.settings.gridSize}px</b></label><input type="range" min="2" max="40" step="2" value={documentState.settings.gridSize} onChange={(event) => commit((document) => ({ ...document, settings: { ...document.settings, gridSize: Number(event.target.value) } }))} />
          </section>
          <section className={styles.panelSection}>
            <h3>Zoom</h3>
            <label className={styles.rangeLabel}>Vista <b>{zoom}%</b></label><input type="range" min="25" max="160" step="5" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            <div className={styles.threeColumns}><button className={styles.toolButton} onClick={() => setZoom(50)}>50%</button><button className={styles.toolButton} onClick={() => setZoom(78)}>Ajustar</button><button className={styles.toolButton} onClick={() => setZoom(100)}>100%</button></div>
          </section>
        </div>
      )
    }

    return (
      <div className={styles.flyoutContent}>
        {panelHeader("Guardar y descargar", "Exporta el documento completo o conserva el borrador editable.")}
        <section className={styles.panelSection}>
          <h3>Guardar</h3>
          <button className={styles.primaryButton} onClick={saveDraft}>💾 Guardar borrador editable</button>
          <p className={styles.helpText}>El borrador se guarda automáticamente en este dispositivo.</p>
        </section>
        <section className={styles.panelSection}>
          <h3>Descargar</h3>
          <button className={styles.pdfButton} disabled={exporting} onClick={exportPdf}>{exporting ? "Generando PDF…" : "📄 Descargar PDF"}</button>
          <button className={styles.wordButton} onClick={exportWord}>📝 Descargar Word (.doc)</button>
          <button className={styles.toolButton} onClick={() => window.print()}>🖨️ Imprimir</button>
        </section>
        <section className={styles.panelSection}>
          <h3>Contenido</h3>
          <button className={styles.toolButton} onClick={copyAsText}>Copiar como texto</button>
          <button className={styles.dangerButton} onClick={resetDraft}>Restaurar planificación original</button>
        </section>
      </div>
    )
  }

  if (!ready) {
    return <div className={styles.loading}>Preparando editor visual…</div>
  }

  if (!documentState || !activePage) {
    return (
      <main className={styles.emptyState}>
        <div>
          <span>🗂️</span>
          <h1>No hay una planificación cargada</h1>
          <p>Genera una planificación y presiona el botón Vista previa para abrir el editor.</p>
          <button onClick={() => router.push("/educador")}>Volver al Agente Planificador</button>
        </div>
      </main>
    )
  }

  return (
    <div className={`${styles.shell} ${exporting ? styles.exporting : ""}`}>
      <header className={styles.topbar}>
        <button className={styles.backButton} onClick={() => router.push("/educador")} aria-label="Volver">←</button>
        <div className={styles.titleArea}>
          <div className={styles.appIcon}>✦</div>
          <div>
            <h1>Editor completo de planificación</h1>
            <p>{documentState.title} · {documentState.pages.length} página(s)</p>
          </div>
        </div>
        <div className={styles.topStatus}>{status || "Guardado automático activo"}</div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <nav className={styles.toolRail} aria-label="Herramientas del editor">
            {PANELS.map((panel) => (
              <button
                key={panel.id}
                type="button"
                className={activePanel === panel.id ? styles.activeRailButton : styles.railButton}
                onClick={() => setActivePanel((current) => current === panel.id ? null : panel.id)}
                title={panel.label}
              >
                <b>{panel.icon}</b>
                <span>{panel.label}</span>
              </button>
            ))}
          </nav>
          {activePanel && <section className={styles.toolFlyout}>{renderPanel()}</section>}
        </aside>

        <main
          ref={canvasScrollRef}
          className={`${styles.canvasScroll} ${mode === "hand" || spacePressedRef.current ? styles.handMode : ""}`}
        >
          <div className={styles.pagesStack}>
            {documentState.pages.map((page, pageIndex) => {
              const dimensions = getPlanningPageDimensions(page.paper, page.orientation)
              const scale = zoom / 100
              const active = page.id === activePage.id
              return (
                <section key={page.id} className={styles.pageSection}>
                  <div className={styles.pageCaption}>
                    <span>{page.name}</span>
                    <small>{PAPER_DIMENSIONS[page.paper].label} · {page.orientation === "portrait" ? "Vertical" : "Horizontal"} · {Math.round(dimensions.width)} × {Math.round(dimensions.height)} px</small>
                  </div>
                  <div className={styles.pageStage} style={{ width: dimensions.width * scale, height: dimensions.height * scale }}>
                    <div
                      ref={(node) => {
                        if (node) pageRefs.current.set(page.id, node)
                        else pageRefs.current.delete(page.id)
                      }}
                      className={`${styles.pageCanvas} ${active ? styles.activePageCanvas : ""} ${documentState.settings.showGrid ? styles.gridCanvas : ""}`}
                      style={{
                        width: dimensions.width,
                        height: dimensions.height,
                        background: page.background,
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                        backgroundSize: documentState.settings.showGrid ? `${documentState.settings.gridSize}px ${documentState.settings.gridSize}px` : undefined,
                      }}
                      onPointerDown={(event) => startPageInteraction(event, page)}
                      onClick={() => selectPage(page.id)}
                      data-page-index={pageIndex}
                    >
                      {[...page.elements].sort((a, b) => a.zIndex - b.zIndex).map((element) => renderElement(page, element))}
                      {marquee?.pageId === page.id && (
                        <div
                          data-editor-chrome="true"
                          className={styles.marquee}
                          style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}
                        />
                      )}
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
