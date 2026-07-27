"use client"

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Brush,
  CheckCircle2,
  Clipboard,
  Cloud,
  CloudOff,
  Download,
  Edit3,
  Eraser,
  Expand,
  FileText,
  Lightbulb,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Send,
  Sigma,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import MathRenderer from "@/components/ui/MathRenderer"
import {
  combinedLatex,
  mergeRecognitionWithExisting,
  segmentStrokes,
} from "@/lib/whiteboard/geometry"
import type {
  WhiteboardMathBlock,
  WhiteboardNotebook,
  WhiteboardPage,
  WhiteboardPoint,
  WhiteboardSolveMode,
  WhiteboardSolveResult,
  WhiteboardStroke,
} from "@/lib/whiteboard/types"

type Tool = "pen" | "eraser"
type PanelTab = "latex" | "solve" | "verify" | "graph" | "ai"
type ChatMessage = { role: "user" | "assistant"; content: string }
type SavedNotebookSummary = {
  id: string
  title: string
  pageCount: number
  updatedAt: string
  source: "cloud" | "local"
}

const LOCAL_CURRENT_KEY = "eduai-whiteboard-math-current-v2"
const LOCAL_LIBRARY_KEY = "eduai-whiteboard-math-library-v2"
const LEGACY_CURRENT_KEY = "eduai-whiteboard-current-notebook"
const LEGACY_LIBRARY_KEY = "eduai-whiteboard-saved-notebooks"
const DEFAULT_CANVAS_HEIGHT = 1200
const CANVAS_GROWTH_STEP = 650
const CANVAS_BOTTOM_MARGIN = 180
const ERASER_RADIUS = 20
const RECOGNITION_DEBOUNCE_MS = 950
const CLOUD_SAVE_DEBOUNCE_MS = 1400

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function now() {
  return new Date().toISOString()
}

function createPage(index: number): WhiteboardPage {
  const timestamp = now()
  return {
    id: createId(),
    title: `Página ${index + 1}`,
    strokes: [],
    blocks: [],
    activeBlockId: null,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function createNotebook(): WhiteboardNotebook {
  const timestamp = now()
  const page = createPage(0)
  return {
    id: createId(),
    title: "Cuaderno sin título",
    pages: [page],
    activePageId: page.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    cloudSyncedAt: null,
  }
}

function validPoint(value: any): value is WhiteboardPoint {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y)
}

function normalizeStroke(value: any, index: number): WhiteboardStroke | null {
  if (!value || !Array.isArray(value.points)) return null
  const points = value.points.filter(validPoint).map((point: WhiteboardPoint) => ({ x: point.x, y: point.y }))
  if (!points.length) return null
  return {
    id: typeof value.id === "string" ? value.id : `stroke-${index}-${createId()}`,
    points,
    color: typeof value.color === "string" ? value.color : "#0f172a",
    width: Number.isFinite(value.width) ? value.width : 4,
  }
}

function normalizeBlock(value: any): WhiteboardMathBlock | null {
  if (!value || typeof value.id !== "string") return null
  return {
    id: value.id,
    strokeIds: Array.isArray(value.strokeIds) ? value.strokeIds.filter((id: unknown) => typeof id === "string") : [],
    bounds: {
      x: Number.isFinite(value.bounds?.x) ? value.bounds.x : 0,
      y: Number.isFinite(value.bounds?.y) ? value.bounds.y : 0,
      width: Number.isFinite(value.bounds?.width) ? value.bounds.width : 120,
      height: Number.isFinite(value.bounds?.height) ? value.bounds.height : 80,
    },
    latex: typeof value.latex === "string" ? value.latex : "",
    text: typeof value.text === "string" ? value.text : "",
    confidence: typeof value.confidence === "number" ? value.confidence : null,
    type: ["number", "expression", "equation", "system", "function", "geometry", "text", "unknown"].includes(value.type) ? value.type : "unknown",
    status: ["writing", "recognizing", "ready", "review"].includes(value.status) ? value.status : "review",
    source: ["mathpix", "gemini", "manual", "none"].includes(value.source) ? value.source : "none",
    alternatives: Array.isArray(value.alternatives) ? value.alternatives.filter((item: unknown) => typeof item === "string").slice(0, 3) : [],
    editedManually: value.editedManually === true,
    warning: typeof value.warning === "string" ? value.warning : null,
  }
}

function normalizePage(value: any, index: number): WhiteboardPage | null {
  if (!value || typeof value !== "object") return null
  const timestamp = now()
  const strokes = Array.isArray(value.strokes)
    ? value.strokes.map(normalizeStroke).filter((stroke: WhiteboardStroke | null): stroke is WhiteboardStroke => Boolean(stroke))
    : []
  let blocks = Array.isArray(value.blocks)
    ? value.blocks.map(normalizeBlock).filter((block: WhiteboardMathBlock | null): block is WhiteboardMathBlock => Boolean(block))
    : []
  if (!blocks.length && typeof value.latex === "string" && value.latex.trim()) {
    const segmented = segmentStrokes(strokes)
    const first = segmented[0]
    blocks = [{
      id: first?.id || `legacy-${createId()}`,
      strokeIds: first?.strokeIds || strokes.map((stroke) => stroke.id),
      bounds: first?.bounds || { x: 20, y: 20, width: 320, height: 120 },
      latex: value.latex,
      text: value.latex,
      confidence: null,
      type: value.latex.includes("=") ? "equation" : "expression",
      status: "ready",
      source: "manual",
      alternatives: [],
      editedManually: true,
    }]
  }
  return {
    id: typeof value.id === "string" ? value.id : createId(),
    title: typeof value.title === "string" && value.title.trim() ? value.title : `Página ${index + 1}`,
    strokes,
    blocks,
    activeBlockId: typeof value.activeBlockId === "string" && blocks.some((block) => block.id === value.activeBlockId)
      ? value.activeBlockId
      : blocks[0]?.id || null,
    canvasHeight: Number.isFinite(value.canvasHeight) ? Math.max(DEFAULT_CANVAS_HEIGHT, value.canvasHeight) : DEFAULT_CANVAS_HEIGHT,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : timestamp,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : timestamp,
  }
}

function normalizeNotebook(value: any): WhiteboardNotebook | null {
  if (!value || typeof value !== "object") return null
  let pages = Array.isArray(value.pages)
    ? value.pages.map(normalizePage).filter((page: WhiteboardPage | null): page is WhiteboardPage => Boolean(page))
    : []
  if (!pages.length && (Array.isArray(value.strokes) || typeof value.latex === "string")) {
    const legacyPage = normalizePage({
      id: createId(),
      title: "Página 1",
      strokes: value.strokes || [],
      latex: value.latex || "",
      canvasHeight: value.canvasHeight,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    }, 0)
    if (legacyPage) pages = [legacyPage]
  }
  if (!pages.length) return null
  const timestamp = now()
  return {
    id: typeof value.id === "string" ? value.id : createId(),
    title: typeof value.title === "string" && value.title.trim() ? value.title : "Cuaderno sin título",
    pages,
    activePageId: typeof value.activePageId === "string" && pages.some((page) => page.id === value.activePageId)
      ? value.activePageId
      : pages[0].id,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : timestamp,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : timestamp,
    cloudSyncedAt: typeof value.cloudSyncedAt === "string" ? value.cloudSyncedAt : null,
  }
}

function pointToSegmentDistance(point: WhiteboardPoint, start: WhiteboardPoint, end: WhiteboardPoint) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy))
}

function strokeTouchesPoint(stroke: WhiteboardStroke, point: WhiteboardPoint) {
  if (stroke.points.length === 1) return Math.hypot(stroke.points[0].x - point.x, stroke.points[0].y - point.y) <= ERASER_RADIUS
  return stroke.points.some((current, index) => index > 0 && pointToSegmentDistance(point, stroke.points[index - 1], current) <= ERASER_RADIUS)
}

function formatTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("es-CL")
}

function readLocalLibrary(): WhiteboardNotebook[] {
  try {
    const current = localStorage.getItem(LOCAL_LIBRARY_KEY) || localStorage.getItem(LEGACY_LIBRARY_KEY)
    if (!current) return []
    const parsed = JSON.parse(current)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeNotebook).filter((item: WhiteboardNotebook | null): item is WhiteboardNotebook => Boolean(item))
  } catch {
    return []
  }
}

function writeLocalNotebook(notebook: WhiteboardNotebook) {
  localStorage.setItem(LOCAL_CURRENT_KEY, JSON.stringify(notebook))
  const library = [notebook, ...readLocalLibrary().filter((item) => item.id !== notebook.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 60)
  localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(library))
}

async function renderBlockImages(strokes: WhiteboardStroke[]) {
  const blocks = segmentStrokes(strokes)
  const images: Record<string, string> = {}
  for (const block of blocks) {
    const padding = 24
    const width = Math.max(96, Math.ceil(block.bounds.width + padding * 2))
    const height = Math.max(96, Math.ceil(block.bounds.height + padding * 2))
    const canvas = document.createElement("canvas")
    canvas.width = Math.min(1800, width)
    canvas.height = Math.min(1000, height)
    const context = canvas.getContext("2d")
    if (!context) continue
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = "#111827"
    context.lineWidth = 5
    context.lineCap = "round"
    context.lineJoin = "round"
    const scaleX = canvas.width / width
    const scaleY = canvas.height / height
    for (const stroke of block.strokes) {
      if (!stroke.points.length) continue
      context.beginPath()
      stroke.points.forEach((point, index) => {
        const x = (point.x - block.bounds.x + padding) * scaleX
        const y = (point.y - block.bounds.y + padding) * scaleY
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      })
      context.stroke()
    }
    images[block.id] = canvas.toDataURL("image/png", 0.92)
  }
  return images
}

function GraphView({ result }: { result: WhiteboardSolveResult | null }) {
  const graph = result?.graph
  if (!graph?.points?.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Resuelve o selecciona una función compatible para generar su gráfica.</div>
  }
  const width = 640
  const height = 380
  const xScale = (x: number) => ((x - graph.xMin) / (graph.xMax - graph.xMin)) * width
  const yScale = (y: number) => height - ((y - graph.yMin) / Math.max(1e-9, graph.yMax - graph.yMin)) * height
  const path = graph.points.map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.x).toFixed(2)},${yScale(point.y).toFixed(2)}`).join(" ")
  const axisX = graph.yMin <= 0 && graph.yMax >= 0 ? yScale(0) : height
  const axisY = graph.xMin <= 0 && graph.xMax >= 0 ? xScale(0) : 0
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
          <rect width={width} height={height} fill="#ffffff" />
          {Array.from({ length: 11 }, (_, index) => index).map((index) => <line key={`v-${index}`} x1={index * width / 10} y1={0} x2={index * width / 10} y2={height} stroke="#e2e8f0" strokeWidth={1} />)}
          {Array.from({ length: 9 }, (_, index) => index).map((index) => <line key={`h-${index}`} x1={0} y1={index * height / 8} x2={width} y2={index * height / 8} stroke="#e2e8f0" strokeWidth={1} />)}
          <line x1={0} y1={axisX} x2={width} y2={axisX} stroke="#64748b" strokeWidth={1.5} />
          <line x1={axisY} y1={0} x2={axisY} y2={height} stroke="#64748b" strokeWidth={1.5} />
          <path d={path} fill="none" stroke="#2563eb" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800"><MathRenderer content={`$$${graph.expressionLatex}$$`} /></div>
    </div>
  )
}

const buttonBase = "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35"

export default function WhiteboardMathStudio() {
  const router = useRouter()
  const initialNotebook = useMemo(() => createNotebook(), [])
  const svgRef = useRef<SVGSVGElement>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const recognitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedRef = useRef(false)
  const [notebook, setNotebook] = useState<WhiteboardNotebook>(initialNotebook)
  const [tool, setTool] = useState<Tool>("pen")
  const [activeStroke, setActiveStroke] = useState<WhiteboardStroke | null>(null)
  const [redoStack, setRedoStack] = useState<WhiteboardStroke[][]>([])
  const [recognizing, setRecognizing] = useState(false)
  const [recognitionFeedback, setRecognitionFeedback] = useState("Escribe una expresión. Cada bloque se convertirá automáticamente a LaTeX.")
  const [panelTab, setPanelTab] = useState<PanelTab>("latex")
  const [editingLatex, setEditingLatex] = useState(false)
  const [latexDraft, setLatexDraft] = useState("")
  const [solveMode, setSolveMode] = useState<WhiteboardSolveMode>("solve")
  const [solveResult, setSolveResult] = useState<WhiteboardSolveResult | null>(null)
  const [solveLoading, setSolveLoading] = useState(false)
  const [solveError, setSolveError] = useState("")
  const [expanded, setExpanded] = useState(false)
  const [cloudStatus, setCloudStatus] = useState<"idle" | "saving" | "synced" | "local" | "error">("idle")
  const [savedNotebooks, setSavedNotebooks] = useState<SavedNotebookSummary[]>([])
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  const activePage = useMemo(
    () => notebook.pages.find((page) => page.id === notebook.activePageId) || notebook.pages[0],
    [notebook],
  )
  const strokes = activePage.strokes
  const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes
  const activeBlock = activePage.blocks.find((block) => block.id === activePage.activeBlockId) || activePage.blocks[0] || null
  const pageLatex = combinedLatex(activePage.blocks)

  const updatePage = useCallback((pageId: string, updater: (page: WhiteboardPage) => WhiteboardPage) => {
    setNotebook((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === pageId ? updater(page) : page),
      updatedAt: now(),
    }))
  }, [])

  const updateActivePage = useCallback((updater: (page: WhiteboardPage) => WhiteboardPage) => {
    updatePage(notebook.activePageId, updater)
  }, [notebook.activePageId, updatePage])

  const getPoint = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }, [])

  const recognize = useCallback(async (nextStrokes: WhiteboardStroke[], pageId: string) => {
    if (!nextStrokes.length) {
      updatePage(pageId, (page) => ({ ...page, blocks: [], activeBlockId: null, updatedAt: now() }))
      setRecognitionFeedback("La página está vacía.")
      return
    }
    setRecognizing(true)
    setRecognitionFeedback("Reconociendo bloques matemáticos...")
    try {
      const blockImages = await renderBlockImages(nextStrokes)
      const response = await fetch("/api/whiteboard/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strokes: nextStrokes, blockImages }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "No fue posible reconocer la escritura.")
      const incoming = Array.isArray(data?.blocks) ? data.blocks.map(normalizeBlock).filter(Boolean) as WhiteboardMathBlock[] : []
      updatePage(pageId, (page) => {
        const blocks = mergeRecognitionWithExisting(page.blocks, incoming)
        const activeBlockId = blocks.some((block) => block.id === page.activeBlockId) ? page.activeBlockId : blocks[0]?.id || null
        return { ...page, blocks, activeBlockId, updatedAt: now() }
      })
      if (incoming.some((block) => block.latex)) {
        setRecognitionFeedback(incoming.some((block) => block.status === "review")
          ? "LaTeX generado. Revisa los bloques marcados antes de resolver."
          : "LaTeX actualizado correctamente.")
      } else {
        setRecognitionFeedback("No se obtuvo LaTeX automático. Selecciona el bloque y usa Editar LaTeX.")
      }
    } catch (error) {
      setRecognitionFeedback(error instanceof Error ? error.message : "No fue posible reconocer la escritura.")
    } finally {
      setRecognizing(false)
    }
  }, [updatePage])

  const scheduleRecognition = useCallback((nextStrokes: WhiteboardStroke[], pageId: string) => {
    if (recognitionTimer.current) clearTimeout(recognitionTimer.current)
    recognitionTimer.current = setTimeout(() => void recognize(nextStrokes, pageId), RECOGNITION_DEBOUNCE_MS)
  }, [recognize])

  useEffect(() => () => {
    if (recognitionTimer.current) clearTimeout(recognitionTimer.current)
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_CURRENT_KEY) || localStorage.getItem(LEGACY_CURRENT_KEY)
      const restored = raw ? normalizeNotebook(JSON.parse(raw)) : null
      if (restored) setNotebook(restored)
    } catch {
      // El cuaderno inicial permanece disponible.
    } finally {
      hydratedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    const snapshot = { ...notebook, updatedAt: now() }
    writeLocalNotebook(snapshot)
    setCloudStatus((current) => current === "saving" ? current : "local")
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current)
    cloudSaveTimer.current = setTimeout(async () => {
      setCloudStatus("saving")
      try {
        const response = await fetch("/api/whiteboard/notebooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notebook: snapshot }),
        })
        if (!response.ok) throw new Error("Cloud unavailable")
        const payload = await response.json()
        const syncedAt = payload?.notebook?.cloudSyncedAt || now()
        setNotebook((current) => current.id === snapshot.id ? { ...current, cloudSyncedAt: syncedAt } : current)
        setCloudStatus("synced")
      } catch {
        setCloudStatus("local")
      }
    }, CLOUD_SAVE_DEBOUNCE_MS)
  }, [notebook.activePageId, notebook.pages, notebook.title])

  const commit = (nextStrokes: WhiteboardStroke[]) => {
    updateActivePage((page) => ({ ...page, strokes: nextStrokes, updatedAt: now() }))
    setRedoStack([])
    scheduleRecognition(nextStrokes, activePage.id)
  }

  const growCanvasIfNeeded = (point: WhiteboardPoint) => {
    if (point.y > activePage.canvasHeight - CANVAS_BOTTOM_MARGIN) {
      updateActivePage((page) => ({ ...page, canvasHeight: page.canvasHeight + CANVAS_GROWTH_STEP, updatedAt: now() }))
    }
  }

  const eraseAt = (point: WhiteboardPoint) => {
    const next = strokes.filter((stroke) => !strokeTouchesPoint(stroke, point))
    if (next.length !== strokes.length) commit(next)
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = getPoint(event)
    growCanvasIfNeeded(point)
    if (tool === "eraser") {
      eraseAt(point)
      return
    }
    setActiveStroke({ id: createId(), points: [point], color: "#0f172a", width: 4 })
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const point = getPoint(event)
    growCanvasIfNeeded(point)
    if (tool === "eraser") {
      eraseAt(point)
      return
    }
    setActiveStroke((current) => current ? { ...current, points: [...current.points, point] } : current)
  }

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (tool === "pen" && activeStroke && activeStroke.points.length > 1) commit([...strokes, activeStroke])
    setActiveStroke(null)
  }

  const undo = () => {
    if (!strokes.length) return
    setRedoStack((current) => [...current, strokes])
    const next = strokes.slice(0, -1)
    updateActivePage((page) => ({ ...page, strokes: next, updatedAt: now() }))
    scheduleRecognition(next, activePage.id)
  }

  const redo = () => {
    const previous = redoStack.at(-1)
    if (!previous) return
    setRedoStack((current) => current.slice(0, -1))
    updateActivePage((page) => ({ ...page, strokes: previous, updatedAt: now() }))
    scheduleRecognition(previous, activePage.id)
  }

  const clearPage = () => {
    if (strokes.length && !window.confirm("¿Limpiar todos los trazos de esta página?")) return
    updateActivePage((page) => ({ ...page, strokes: [], blocks: [], activeBlockId: null, updatedAt: now() }))
    setRedoStack([])
    setSolveResult(null)
    setRecognitionFeedback("La página quedó vacía.")
  }

  const selectBlock = (block: WhiteboardMathBlock) => {
    updateActivePage((page) => ({ ...page, activeBlockId: block.id }))
    setEditingLatex(false)
    setLatexDraft(block.latex)
    setSolveResult(null)
  }

  const beginLatexEdit = () => {
    if (!activeBlock) return
    setLatexDraft(activeBlock.latex)
    setEditingLatex(true)
  }

  const saveLatexEdit = () => {
    if (!activeBlock) return
    const latex = latexDraft.trim().replace(/^\$\$?|\$\$?$/g, "").trim()
    updateActivePage((page) => ({
      ...page,
      blocks: page.blocks.map((block) => block.id === activeBlock.id
        ? { ...block, latex, text: latex, source: "manual", confidence: 1, status: latex ? "ready" : "review", editedManually: true, warning: null }
        : block),
      updatedAt: now(),
    }))
    setEditingLatex(false)
    setRecognitionFeedback("LaTeX corregido manualmente.")
  }

  const useAlternative = (alternative: string) => {
    if (!activeBlock) return
    setLatexDraft(alternative)
    updateActivePage((page) => ({
      ...page,
      blocks: page.blocks.map((block) => block.id === activeBlock.id
        ? { ...block, latex: alternative, text: alternative, source: "manual", confidence: 1, status: "ready", editedManually: true }
        : block),
      updatedAt: now(),
    }))
  }

  const runMath = async (mode: WhiteboardSolveMode) => {
    const latex = activeBlock?.latex || pageLatex
    if (!latex.trim()) {
      setSolveError("Primero genera o edita el LaTeX del problema.")
      setPanelTab("latex")
      return
    }
    setSolveMode(mode)
    setSolveLoading(true)
    setSolveError("")
    setPanelTab(mode === "verify" ? "verify" : mode === "graph" ? "graph" : "solve")
    try {
      const lines = activeBlock ? [activeBlock.latex] : activePage.blocks.map((block) => block.latex).filter(Boolean)
      const response = await fetch("/api/whiteboard/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex, lines, mode }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No fue posible procesar el ejercicio.")
      setSolveResult(payload.result)
    } catch (error) {
      setSolveError(error instanceof Error ? error.message : "No fue posible procesar el ejercicio.")
    } finally {
      setSolveLoading(false)
    }
  }

  const addPage = () => {
    const page = createPage(notebook.pages.length)
    setNotebook((current) => ({ ...current, pages: [...current.pages, page], activePageId: page.id, updatedAt: now() }))
    setRedoStack([])
    setSolveResult(null)
    requestAnimationFrame(() => boardScrollRef.current?.scrollTo({ top: 0 }))
  }

  const openPage = (pageId: string) => {
    setNotebook((current) => ({ ...current, activePageId: pageId, updatedAt: now() }))
    setRedoStack([])
    setSolveResult(null)
    setEditingLatex(false)
    requestAnimationFrame(() => boardScrollRef.current?.scrollTo({ top: 0 }))
  }

  const createNewNotebook = () => {
    if (notebook.pages.some((page) => page.strokes.length) && !window.confirm("¿Crear un cuaderno nuevo? El actual ya está guardado localmente.")) return
    setNotebook(createNotebook())
    setSolveResult(null)
    setRedoStack([])
    setCloudStatus("idle")
  }

  const loadLibrary = async () => {
    setLibraryLoading(true)
    const local = readLocalLibrary().map((item) => ({ id: item.id, title: item.title, pageCount: item.pages.length, updatedAt: item.updatedAt, source: "local" as const }))
    let cloud: SavedNotebookSummary[] = []
    try {
      const response = await fetch("/api/whiteboard/notebooks", { cache: "no-store" })
      if (response.ok) {
        const payload = await response.json()
        cloud = (payload?.notebooks || []).map((item: any) => ({ ...item, source: "cloud" as const }))
      }
    } catch {
      // La biblioteca local sigue disponible.
    }
    const seen = new Set<string>()
    setSavedNotebooks([...cloud, ...local].filter((item) => {
      const key = `${item.source}:${item.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    setShowLibrary(true)
    setLibraryLoading(false)
  }

  const openSavedNotebook = async (summary: SavedNotebookSummary) => {
    try {
      if (summary.source === "cloud") {
        const response = await fetch(`/api/whiteboard/notebooks/${summary.id}`, { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || "No fue posible abrir el cuaderno.")
        const restored = normalizeNotebook(payload.notebook)
        if (!restored) throw new Error("El cuaderno no tiene un formato válido.")
        setNotebook(restored)
        setCloudStatus("synced")
      } else {
        const restored = readLocalLibrary().find((item) => item.id === summary.id)
        if (!restored) throw new Error("El cuaderno local ya no está disponible.")
        setNotebook(restored)
        setCloudStatus("local")
      }
      setShowLibrary(false)
      setSolveResult(null)
      setRedoStack([])
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible abrir el cuaderno.")
    }
  }

  const deleteSavedNotebook = async (summary: SavedNotebookSummary) => {
    if (!window.confirm(`¿Eliminar “${summary.title}”?`)) return
    if (summary.source === "cloud") {
      await fetch(`/api/whiteboard/notebooks/${summary.id}`, { method: "DELETE" }).catch(() => undefined)
    } else {
      localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(readLocalLibrary().filter((item) => item.id !== summary.id)))
    }
    setSavedNotebooks((current) => current.filter((item) => !(item.id === summary.id && item.source === summary.source)))
  }

  const copyLatex = async () => {
    const latex = activeBlock?.latex || pageLatex
    if (latex) await navigator.clipboard.writeText(latex)
  }

  const downloadLatex = () => {
    if (!pageLatex) return
    const content = `\\documentclass{article}\n\\usepackage{amsmath,amssymb}\n\\begin{document}\n\\[\n${pageLatex}\n\\]\n\\end{document}\n`
    const url = URL.createObjectURL(new Blob([content], { type: "application/x-tex" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${notebook.title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ -]/g, "").replace(/\s+/g, "-") || "pizarra"}.tex`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 800)
  }

  const downloadPageImage = async (format: "png" | "pdf") => {
    const svg = svgRef.current
    if (!svg) return
    const serialized = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([serialized], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = async () => {
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(800, svg.clientWidth * 2)
      canvas.height = Math.min(5000, activePage.canvasHeight * 2)
      const context = canvas.getContext("2d")
      if (!context) return
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      if (format === "png") {
        const anchor = document.createElement("a")
        anchor.href = canvas.toDataURL("image/png")
        anchor.download = `${activePage.title}.png`
        anchor.click()
      } else {
        const { jsPDF } = await import("jspdf")
        const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width / 2, canvas.height / 2] })
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, canvas.width / 2, canvas.height / 2)
        pdf.save(`${activePage.title}.pdf`)
      }
      URL.revokeObjectURL(url)
    }
    image.src = url
  }

  const sendChat = async () => {
    const question = chatInput.trim()
    if (!question || chatLoading) return
    const selectedLatex = activeBlock?.latex || pageLatex
    const context = [
      question,
      selectedLatex ? `Expresión seleccionada: $$${selectedLatex}$$` : "",
      solveResult ? `Resultado del motor matemático: ${JSON.stringify(solveResult)}` : "",
      "No cambies los resultados verificados del motor. Explica con claridad y usa LaTeX.",
    ].filter(Boolean).join("\n\n")
    const history = chatMessages.slice(-8)
    setChatMessages((current) => [...current, { role: "user", content: question }])
    setChatInput("")
    setChatLoading(true)
    try {
      const response = await fetch("/api/agents/matematico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: context, history }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No fue posible consultar al profesor IA.")
      setChatMessages((current) => [...current, { role: "assistant", content: payload.text || "No recibí una respuesta." }])
    } catch (error) {
      setChatMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? `⚠️ ${error.message}` : "⚠️ No fue posible responder." }])
    } finally {
      setChatLoading(false)
    }
  }

  const scrollNotebook = (direction: "up" | "down") => {
    const container = boardScrollRef.current
    if (!container) return
    container.scrollBy({ top: direction === "down" ? container.clientHeight * 0.82 : -container.clientHeight * 0.82, behavior: "smooth" })
  }

  const tabs: { id: PanelTab; label: string }[] = [
    { id: "latex", label: "LaTeX" },
    { id: "solve", label: "Resolver" },
    { id: "verify", label: "Verificar" },
    { id: "graph", label: "Gráfica" },
    { id: "ai", label: "IA" },
  ]

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 ${expanded ? "overflow-hidden" : ""}`}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => router.back()} className={`${buttonBase} border border-slate-200 bg-white text-slate-700`}><ArrowLeft size={15} /> Volver</button>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white">✍️</div>
            <div className="min-w-0"><h1 className="truncate text-sm font-bold">Pizarra matemática</h1><p className="hidden text-xs text-slate-500 sm:block">Trazos → bloques LaTeX → solución y verificación</p></div>
          </div>
          <button onClick={() => setExpanded((value) => !value)} className={`${buttonBase} border border-slate-200 bg-white text-slate-700`}>{expanded ? <Minimize2 size={15} /> : <Expand size={15} />}{expanded ? "Reducir" : "Expandir"}</button>
        </div>
      </header>

      <main className={`mx-auto flex max-w-[1800px] flex-col gap-3 px-3 py-3 sm:px-4 ${expanded ? "h-[calc(100vh-61px)]" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cuaderno</span>
          <input value={notebook.title} onChange={(event) => setNotebook((current) => ({ ...current, title: event.target.value, updatedAt: now() }))} className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${cloudStatus === "synced" ? "bg-emerald-100 text-emerald-700" : cloudStatus === "saving" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
            {cloudStatus === "synced" ? <Cloud size={12} /> : cloudStatus === "saving" ? <LoaderCircle size={12} className="animate-spin" /> : <CloudOff size={12} />}
            {cloudStatus === "synced" ? "Sincronizado" : cloudStatus === "saving" ? "Guardando" : "Guardado local"}
          </span>
          {notebook.cloudSyncedAt && <span className="text-[10px] text-slate-400">{formatTime(notebook.cloudSyncedAt)}</span>}
        </div>

        <section className={`grid min-h-0 flex-1 gap-3 ${expanded ? "lg:grid-cols-[1.25fr_0.75fr]" : "lg:grid-cols-[1.08fr_0.92fr]"}`}>
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
              <button onClick={() => setTool("pen")} className={`${buttonBase} ${tool === "pen" ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-white"}`}><Brush size={14} /> Lápiz</button>
              <button onClick={() => setTool("eraser")} className={`${buttonBase} ${tool === "eraser" ? "bg-rose-500 text-white" : "text-slate-700 hover:bg-white"}`}><Eraser size={14} /> Borrador</button>
              <button onClick={undo} disabled={!strokes.length} className={`${buttonBase} px-2 text-slate-700 hover:bg-white`} title="Deshacer"><Undo2 size={15} /></button>
              <button onClick={redo} disabled={!redoStack.length} className={`${buttonBase} px-2 text-slate-700 hover:bg-white`} title="Rehacer"><Redo2 size={15} /></button>
              <span className="mx-1 h-5 w-px bg-slate-200" />
              <button onClick={createNewNotebook} className={`${buttonBase} text-slate-700 hover:bg-white`}>Nuevo</button>
              <button onClick={() => { writeLocalNotebook({ ...notebook, updatedAt: now() }); setCloudStatus("local") }} className={`${buttonBase} text-emerald-700 hover:bg-white`}><Save size={14} /> Guardar</button>
              <button onClick={() => void loadLibrary()} className={`${buttonBase} text-blue-700 hover:bg-white`}><BookOpen size={14} /> Mis cuadernos</button>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => void downloadPageImage("png")} className={`${buttonBase} px-2 text-slate-600`} title="Descargar PNG"><Download size={14} /> PNG</button>
                <button onClick={() => void downloadPageImage("pdf")} className={`${buttonBase} px-2 text-slate-600`} title="Descargar PDF"><FileText size={14} /> PDF</button>
                <button onClick={clearPage} className={`${buttonBase} px-2 text-rose-600`}><Trash2 size={14} /> Limpiar</button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                {notebook.pages.map((page, index) => <button key={page.id} onClick={() => openPage(page.id)} className={`${buttonBase} shrink-0 ${page.id === activePage.id ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600"}`}>Página {index + 1}</button>)}
                <button onClick={addPage} className={`${buttonBase} shrink-0 bg-emerald-100 text-emerald-700`}><Plus size={14} /> Página</button>
              </div>
              <button onClick={() => scrollNotebook("up")} className={`${buttonBase} px-2 text-slate-600`}><ArrowUp size={15} /></button>
              <button onClick={() => scrollNotebook("down")} className={`${buttonBase} px-2 text-slate-600`}><ArrowDown size={15} /></button>
            </div>

            <div ref={boardScrollRef} className="relative min-h-[500px] flex-1 overflow-y-auto bg-white" style={{ height: expanded ? "calc(100vh - 225px)" : 740, overscrollBehavior: "contain" }}>
              <svg ref={svgRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={{ height: activePage.canvasHeight }} className={`w-full touch-none bg-white ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}>
                <defs><pattern id="math-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e2e8f0" strokeWidth="0.7" /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#math-grid)" />
                {allStrokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={stroke.color || "#0f172a"} strokeWidth={stroke.width || 4} strokeLinecap="round" strokeLinejoin="round" />)}
                {activePage.blocks.map((block, index) => {
                  const active = block.id === activeBlock?.id
                  return <g key={block.id} onPointerDown={(event) => { event.stopPropagation(); selectBlock(block) }} className="cursor-pointer">
                    <rect x={block.bounds.x} y={block.bounds.y} width={block.bounds.width} height={block.bounds.height} rx={10} fill="transparent" stroke={active ? "#2563eb" : block.status === "review" ? "#f59e0b" : "#10b981"} strokeWidth={active ? 2.5 : 1.5} strokeDasharray={block.status === "review" ? "6 4" : undefined} />
                    <rect x={block.bounds.x} y={Math.max(0, block.bounds.y - 22)} width={76} height={20} rx={8} fill={active ? "#2563eb" : block.status === "review" ? "#f59e0b" : "#10b981"} />
                    <text x={block.bounds.x + 8} y={Math.max(14, block.bounds.y - 8)} fill="#ffffff" fontSize={10} fontWeight={800}>Bloque {index + 1}</text>
                  </g>
                })}
              </svg>
            </div>
          </div>

          <aside className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-2">
              {tabs.map((tab) => <button key={tab.id} onClick={() => setPanelTab(tab.id)} className={`${buttonBase} shrink-0 ${panelTab === tab.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>{tab.label}</button>)}
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 px-2 text-[10px] font-semibold text-slate-500">{recognizing ? <LoaderCircle size={12} className="animate-spin" /> : <CheckCircle2 size={12} className="text-emerald-500" />}{recognizing ? "Reconociendo" : `${activePage.blocks.length} bloques`}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {panelTab === "latex" && <div className="space-y-4">
                <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold">LaTeX del bloque</h2><p className="mt-1 text-xs text-slate-500">Selecciona un contorno del lienzo para trabajar solo con esa expresión.</p></div><button onClick={() => void recognize(strokes, activePage.id)} disabled={!strokes.length || recognizing} className={`${buttonBase} text-blue-700`}><RefreshCw size={14} /> Reprocesar</button></div>
                <div className="min-h-36 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  {activeBlock?.latex ? <MathRenderer content={`$$${activeBlock.latex}$$`} /> : pageLatex ? <MathRenderer content={`$$${pageLatex}$$`} /> : <p className="text-sm text-slate-500">Escribe en el lienzo. También puedes corregir manualmente con el botón Editar LaTeX.</p>}
                </div>
                {activeBlock && <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><span className="rounded-full bg-slate-100 px-2 py-1">{activeBlock.type}</span><span className="rounded-full bg-slate-100 px-2 py-1">Motor: {activeBlock.source}</span>{typeof activeBlock.confidence === "number" && <span className="rounded-full bg-slate-100 px-2 py-1">Confianza: {Math.round(activeBlock.confidence * 100)}%</span>}</div>}
                {editingLatex ? <div className="space-y-2 rounded-2xl border border-blue-200 bg-white p-3"><textarea value={latexDraft} onChange={(event) => setLatexDraft(event.target.value)} rows={5} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm outline-none focus:border-blue-400" placeholder="Escribe LaTeX sin delimitadores $...$" /><div className="flex justify-end gap-2"><button onClick={() => setEditingLatex(false)} className={`${buttonBase} text-slate-600`}>Cancelar</button><button onClick={saveLatexEdit} className={`${buttonBase} bg-blue-600 text-white`}>Aplicar corrección</button></div></div> : <button onClick={beginLatexEdit} disabled={!activeBlock} className={`${buttonBase} border border-slate-200 bg-white text-blue-700`}><Edit3 size={14} /> Editar LaTeX</button>}
                {activeBlock?.alternatives?.length ? <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Alternativas</p><div className="mt-2 space-y-2">{activeBlock.alternatives.map((alternative) => <button key={alternative} onClick={() => useAlternative(alternative)} className="block w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-sm hover:bg-blue-50"><MathRenderer content={`$${alternative}$`} /></button>)}</div></div> : null}
                <div className={`rounded-2xl border p-3 text-sm ${activeBlock?.warning ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{activeBlock?.warning || recognitionFeedback}</div>
                <div className="flex flex-wrap gap-2"><button onClick={copyLatex} disabled={!activeBlock?.latex && !pageLatex} className={`${buttonBase} text-slate-700`}><Clipboard size={14} /> Copiar</button><button onClick={downloadLatex} disabled={!pageLatex} className={`${buttonBase} text-slate-700`}><Download size={14} /> Descargar .tex</button></div>
                <div className="grid gap-2 sm:grid-cols-3"><button onClick={() => void runMath("solve")} className={`${buttonBase} bg-blue-600 text-white`}><Sigma size={14} /> Solución</button><button onClick={() => void runMath("verify")} className={`${buttonBase} bg-emerald-600 text-white`}><CheckCircle2 size={14} /> Verificar</button><button onClick={() => void runMath("hint")} className={`${buttonBase} bg-amber-500 text-white`}><Lightbulb size={14} /> Pista</button></div>
              </div>}

              {(panelTab === "solve" || panelTab === "verify") && <div className="space-y-4">
                <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold">{panelTab === "verify" ? "Verificación del procedimiento" : solveMode === "hint" ? "Pista progresiva" : "Solución matemática"}</h2><p className="mt-1 text-xs text-slate-500">SymPy tiene prioridad; el motor local y la IA actúan como respaldo.</p></div>{solveLoading && <LoaderCircle size={18} className="animate-spin text-blue-600" />}</div>
                {solveError && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{solveError}</div>}
                {!solveResult && !solveLoading && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Usa Solución, Verificar o Pista desde la pestaña LaTeX.</div>}
                {solveResult && <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold"><span className="rounded-full bg-white px-2 py-1">{solveResult.classification}</span><span className="rounded-full bg-white px-2 py-1">Motor: {solveResult.engine}</span><span className={`rounded-full px-2 py-1 ${solveResult.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{solveResult.verified ? "Verificado" : "Revisión recomendada"}</span></div><div className="mt-3"><MathRenderer content={`$$${solveResult.normalizedLatex}$$`} /></div></div>
                  {solveResult.steps.length > 0 && <div className="space-y-2">{solveResult.steps.map((step, index) => <article key={`${step.index}-${index}`} className={`rounded-2xl border p-3 ${step.valid === false ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}><p className="text-xs font-bold text-slate-700">Paso {index + 1}</p><p className="mt-1 text-sm text-slate-600">{step.explanation}</p>{step.latex && <div className="mt-2 rounded-xl bg-slate-50 p-2"><MathRenderer content={`$$${step.latex}$$`} /></div>}</article>)}</div>}
                  {solveResult.answerLatex && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Resultado</p><div className="mt-2"><MathRenderer content={`$$${solveResult.answerLatex}$$`} /></div></div>}
                  {solveResult.explanation && <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-slate-700"><MathRenderer content={solveResult.explanation} /></div>}
                  {solveResult.warning && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{solveResult.warning}</div>}
                </>}
              </div>}

              {panelTab === "graph" && <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Gráfica</h2><p className="mt-1 text-xs text-slate-500">Representación calculada desde la expresión seleccionada.</p></div><button onClick={() => void runMath("graph")} className={`${buttonBase} text-blue-700`}><Maximize2 size={14} /> Graficar</button></div><GraphView result={solveResult} /></div>}

              {panelTab === "ai" && <div className="flex min-h-[480px] flex-col"><div><h2 className="text-sm font-bold">Profesor matemático</h2><p className="mt-1 text-xs text-slate-500">Pregunta por una pista o por la explicación de un paso. La IA recibe el resultado del motor cuando existe.</p></div><div className="mt-4 flex-1 space-y-2 overflow-y-auto">{chatMessages.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Selecciona un bloque y pregunta, por ejemplo: “Explícame el paso 2”.</div> : chatMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "ml-auto max-w-[86%] bg-blue-600 text-white" : "mr-auto max-w-[96%] border border-slate-200 bg-white text-slate-700"}`}>{message.role === "assistant" ? <MathRenderer content={message.content} /> : message.content}</div>)}</div><div className="mt-3 flex gap-2"><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendChat() } }} rows={2} placeholder="Pregunta sobre el ejercicio..." className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400" /><button onClick={() => void sendChat()} disabled={!chatInput.trim() || chatLoading} className={`${buttonBase} h-auto bg-blue-600 text-white`}>{chatLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}</button></div></div>}
            </div>
          </aside>
        </section>
      </main>

      {showLibrary && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onClick={() => setShowLibrary(false)}><section className="max-h-[84vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="flex items-center gap-2 text-base font-bold"><BookOpen size={17} className="text-blue-600" /> Mis cuadernos</h2><p className="mt-1 text-xs text-slate-500">La nube se usa cuando la migración está instalada; el navegador funciona como respaldo.</p></div><button onClick={() => setShowLibrary(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header><div className="max-h-[68vh] space-y-3 overflow-y-auto p-4">{libraryLoading ? <div className="flex justify-center p-12"><LoaderCircle size={28} className="animate-spin text-blue-600" /></div> : savedNotebooks.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Aún no hay cuadernos guardados.</div> : savedNotebooks.map((summary) => <article key={`${summary.source}-${summary.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"><div className="min-w-0"><h3 className="truncate text-sm font-bold">{summary.title}</h3><p className="mt-1 text-xs text-slate-500">{summary.pageCount} páginas · {summary.source === "cloud" ? "Nube" : "Navegador"} · {new Date(summary.updatedAt).toLocaleString("es-CL")}</p></div><div className="flex gap-2"><button onClick={() => void openSavedNotebook(summary)} className={`${buttonBase} bg-blue-600 text-white`}>Abrir</button><button onClick={() => void deleteSavedNotebook(summary)} className={`${buttonBase} text-rose-600`}><Trash2 size={14} /> Eliminar</button></div></article>)}</div></section></div>}
    </div>
  )
}
