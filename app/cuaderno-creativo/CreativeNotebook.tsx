"use client"

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from "react"
import { useRouter } from "next/navigation"
import { jsPDF } from "jspdf"
import {
  ArrowLeft,
  Brush,
  Circle,
  Download,
  Eraser,
  FileDown,
  Grid3X3,
  Highlighter,
  ImageIcon,
  Library,
  Loader2,
  Minus,
  PaintBucket,
  Palette,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
} from "lucide-react"

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 1200
const STORAGE_KEY = "eduai-creative-notebook-v1"
const EMPTY_DRAWING = ""

const COLORS = [
  "#0f172a",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#92400e",
]

type Point = { x: number; y: number }
type Tool =
  | "pencil"
  | "brush"
  | "marker"
  | "eraser"
  | "fill"
  | "line"
  | "rectangle"
  | "ellipse"
  | "text"

type TemplateSource = "generated" | "uploaded" | "pattern" | "other"

type CreativePage = {
  id: string
  title: string
  backgroundImage: string | null
  drawingImage: string
  templateOpacity: number
}

type CreativeNotebook = {
  id: string
  title: string
  pages: CreativePage[]
  activePageId: string
  updatedAt: string
}

type CreativeTemplate = {
  id: string
  name: string
  source: TemplateSource
  prompt: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

type HistoryState = {
  entries: string[]
  index: number
}

type ToolDefinition = {
  id: Tool
  label: string
  icon: typeof Pencil
}

const TOOLS: ToolDefinition[] = [
  { id: "pencil", label: "Lápiz", icon: Pencil },
  { id: "brush", label: "Pincel", icon: Brush },
  { id: "marker", label: "Marcador", icon: Highlighter },
  { id: "eraser", label: "Borrador", icon: Eraser },
  { id: "fill", label: "Relleno", icon: PaintBucket },
  { id: "line", label: "Línea", icon: Minus },
  { id: "rectangle", label: "Rectángulo", icon: Square },
  { id: "ellipse", label: "Círculo", icon: Circle },
  { id: "text", label: "Texto", icon: Type },
]

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createPage(pageNumber: number): CreativePage {
  return {
    id: createId(),
    title: `Página ${pageNumber}`,
    backgroundImage: null,
    drawingImage: EMPTY_DRAWING,
    templateOpacity: 1,
  }
}

function createNotebook(): CreativeNotebook {
  const firstPage = createPage(1)
  return {
    id: createId(),
    title: "Mi cuaderno creativo",
    pages: [firstPage],
    activePageId: firstPage.id,
    updatedAt: new Date().toISOString(),
  }
}

function sanitizeFileName(value: string) {
  return (value.trim() || "cuaderno-creativo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function templateNameFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim().slice(0, 120) || "Plantilla subida"
}

function parseHexColor(hex: string) {
  const normalized = hex.replace("#", "")
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character + character)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6)
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    a: 255,
  }
}

function imageFromSource(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    if (/^https?:\/\//i.test(source)) image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("No fue posible cargar la imagen."))
    image.src = source
  })
}

function drawImageContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  opacity = 1,
) {
  const scale = Math.min(
    CANVAS_WIDTH / image.naturalWidth,
    CANVAS_HEIGHT / image.naturalHeight,
  )
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const x = (CANVAS_WIDTH - width) / 2
  const y = (CANVAS_HEIGHT - height) / 2
  context.save()
  context.globalAlpha = opacity
  context.drawImage(image, x, y, width, height)
  context.restore()
}

async function prepareTemplate(source: string) {
  const image = await imageFromSource(source)
  const canvas = document.createElement("canvas")
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const context = canvas.getContext("2d")
  if (!context) throw new Error("El navegador no permite preparar la plantilla.")
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  drawImageContained(context, image)
  return canvas.toDataURL("image/webp", 0.9)
}

function createPatternTemplate(kind: "grid" | "dots") {
  const canvas = document.createElement("canvas")
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const context = canvas.getContext("2d")
  if (!context) return null

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.strokeStyle = "#cbd5e1"
  context.fillStyle = "#cbd5e1"
  context.lineWidth = 1

  if (kind === "grid") {
    for (let x = 40; x < CANVAS_WIDTH; x += 40) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, CANVAS_HEIGHT)
      context.stroke()
    }
    for (let y = 40; y < CANVAS_HEIGHT; y += 40) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(CANVAS_WIDTH, y)
      context.stroke()
    }
  } else {
    for (let x = 30; x < CANVAS_WIDTH; x += 35) {
      for (let y = 30; y < CANVAS_HEIGHT; y += 35) {
        context.beginPath()
        context.arc(x, y, 1.7, 0, Math.PI * 2)
        context.fill()
      }
    }
  }

  return canvas.toDataURL("image/png")
}

function normalizeNotebook(value: unknown): CreativeNotebook | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<CreativeNotebook>
  if (!Array.isArray(candidate.pages) || candidate.pages.length === 0) return null

  const pages = candidate.pages.map((page, index) => ({
    id: typeof page.id === "string" ? page.id : createId(),
    title:
      typeof page.title === "string" && page.title.trim()
        ? page.title
        : `Página ${index + 1}`,
    backgroundImage:
      typeof page.backgroundImage === "string" ? page.backgroundImage : null,
    drawingImage:
      typeof page.drawingImage === "string" ? page.drawingImage : EMPTY_DRAWING,
    templateOpacity:
      typeof page.templateOpacity === "number"
        ? Math.min(1, Math.max(0.15, page.templateOpacity))
        : 1,
  }))

  const activePageId =
    typeof candidate.activePageId === "string" &&
    pages.some((page) => page.id === candidate.activePageId)
      ? candidate.activePageId
      : pages[0].id

  return {
    id: typeof candidate.id === "string" ? candidate.id : createId(),
    title:
      typeof candidate.title === "string" && candidate.title.trim()
        ? candidate.title
        : "Mi cuaderno creativo",
    pages,
    activePageId,
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : new Date().toISOString(),
  }
}

function formatTemplateDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value))
  } catch {
    return ""
  }
}

async function responseJson(response: Response) {
  const raw = await response.text()
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { error: raw.trim() || "Respuesta inválida del servidor." }
  }
}

export default function CreativeNotebook() {
  const router = useRouter()
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const drawingRef = useRef(false)
  const startPointRef = useRef<Point | null>(null)
  const lastPointRef = useRef<Point | null>(null)
  const previewImageRef = useRef<ImageData | null>(null)
  const historyRef = useRef<Record<string, HistoryState>>({})
  const hydratedRef = useRef(false)

  const [notebook, setNotebook] = useState<CreativeNotebook>(() => createNotebook())
  const [tool, setTool] = useState<Tool>("pencil")
  const [color, setColor] = useState("#0f172a")
  const [size, setSize] = useState(10)
  const [aiPrompt, setAiPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [saveStatus, setSaveStatus] = useState("Preparando cuaderno...")
  const [exporting, setExporting] = useState(false)
  const [templates, setTemplates] = useState<CreativeTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateQuery, setTemplateQuery] = useState("")
  const [libraryMessage, setLibraryMessage] = useState("Cargando biblioteca...")

  const activePage = useMemo(
    () =>
      notebook.pages.find((page) => page.id === notebook.activePageId) ||
      notebook.pages[0],
    [notebook.activePageId, notebook.pages],
  )

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLocaleLowerCase("es")
    if (!query) return templates
    return templates.filter((template) =>
      `${template.name} ${template.prompt ?? ""}`.toLocaleLowerCase("es").includes(query),
    )
  }, [templateQuery, templates])

  const updateActivePage = useCallback(
    (updater: (page: CreativePage) => CreativePage) => {
      setNotebook((current) => ({
        ...current,
        pages: current.pages.map((page) =>
          page.id === current.activePageId ? updater(page) : page,
        ),
        updatedAt: new Date().toISOString(),
      }))
    },
    [],
  )

  const drawBackground = useCallback(async (page: CreativePage) => {
    const canvas = backgroundCanvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    if (!page.backgroundImage) return
    try {
      const image = await imageFromSource(page.backgroundImage)
      drawImageContained(context, image, page.templateOpacity)
    } catch (error) {
      console.error("[creative-notebook/background]", error)
    }
  }, [])

  const drawForeground = useCallback(async (page: CreativePage) => {
    const canvas = drawingCanvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    if (!page.drawingImage) return
    try {
      const image = await imageFromSource(page.drawingImage)
      context.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    } catch (error) {
      console.error("[creative-notebook/foreground]", error)
    }
  }, [])

  const initializeHistory = useCallback((page: CreativePage) => {
    if (historyRef.current[page.id]) return
    historyRef.current[page.id] = {
      entries: [page.drawingImage || EMPTY_DRAWING],
      index: 0,
    }
  }, [])

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const response = await fetch("/api/creative-templates", { cache: "no-store" })
      const data = await responseJson(response)
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo cargar la biblioteca.",
        )
      }
      const items = Array.isArray(data.templates)
        ? (data.templates as CreativeTemplate[])
        : []
      setTemplates(items)
      setLibraryMessage(
        items.length
          ? `${items.length} plantilla${items.length === 1 ? "" : "s"} guardada${items.length === 1 ? "" : "s"}`
          : "Aún no tienes plantillas guardadas",
      )
    } catch (error) {
      setLibraryMessage(
        error instanceof Error ? error.message : "No se pudo cargar la biblioteca.",
      )
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = normalizeNotebook(JSON.parse(raw))
        if (saved) setNotebook(saved)
      }
    } catch (error) {
      console.error("[creative-notebook/load]", error)
      setSaveStatus("No se pudo recuperar el último cuaderno")
    } finally {
      hydratedRef.current = true
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    initializeHistory(activePage)
    void drawBackground(activePage)
    void drawForeground(activePage)
  }, [activePage.id, drawBackground, drawForeground, initializeHistory])

  useEffect(() => {
    void drawBackground(activePage)
  }, [
    activePage.backgroundImage,
    activePage.templateOpacity,
    activePage.id,
    drawBackground,
  ])

  useEffect(() => {
    if (!hydratedRef.current) return
    setSaveStatus("Guardando...")
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook))
        setSaveStatus("Guardado automáticamente")
      } catch (error) {
        console.error("[creative-notebook/save]", error)
        setSaveStatus("Sin espacio local: descarga el cuaderno")
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [notebook])

  function getPoint(event: PointerEvent<HTMLCanvasElement>): Point {
    const canvas = drawingCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    }
  }

  function toolWidth(selectedTool: Tool) {
    if (selectedTool === "pencil") return Math.max(2, size * 0.55)
    if (selectedTool === "brush") return size * 1.35
    if (selectedTool === "marker") return size * 2.4
    if (selectedTool === "eraser") return size * 2.4
    return Math.max(2, size * 0.65)
  }

  function configureContext(
    context: CanvasRenderingContext2D,
    selectedTool: Tool,
  ) {
    context.lineCap = "round"
    context.lineJoin = "round"
    context.lineWidth = toolWidth(selectedTool)
    context.strokeStyle = color
    context.fillStyle = color
    context.globalAlpha = selectedTool === "marker" ? 0.28 : 1
    context.globalCompositeOperation =
      selectedTool === "eraser" ? "destination-out" : "source-over"
  }

  function commitDrawing(pushHistory = true) {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const drawingImage = canvas.toDataURL("image/png")
    updateActivePage((page) => ({ ...page, drawingImage }))

    if (pushHistory) {
      const current = historyRef.current[activePage.id] || {
        entries: [EMPTY_DRAWING],
        index: 0,
      }
      const entries = current.entries.slice(0, current.index + 1)
      entries.push(drawingImage)
      const limited = entries.slice(-25)
      historyRef.current[activePage.id] = {
        entries: limited,
        index: limited.length - 1,
      }
    }
  }

  async function applyHistoryImage(source: string) {
    const canvas = drawingCanvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    if (source) {
      const image = await imageFromSource(source)
      context.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }
    updateActivePage((page) => ({ ...page, drawingImage: source }))
  }

  function undo() {
    const history = historyRef.current[activePage.id]
    if (!history || history.index <= 0) return
    history.index -= 1
    void applyHistoryImage(history.entries[history.index])
  }

  function redo() {
    const history = historyRef.current[activePage.id]
    if (!history || history.index >= history.entries.length - 1) return
    history.index += 1
    void applyHistoryImage(history.entries[history.index])
  }

  function clearDrawing() {
    const canvas = drawingCanvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    if (!window.confirm("¿Borrar todos los trazos y colores de esta página?")) return
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    commitDrawing()
  }

  function drawShape(
    context: CanvasRenderingContext2D,
    selectedTool: "line" | "rectangle" | "ellipse",
    start: Point,
    end: Point,
  ) {
    configureContext(context, selectedTool)
    context.beginPath()
    if (selectedTool === "line") {
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
    } else if (selectedTool === "rectangle") {
      context.rect(start.x, start.y, end.x - start.x, end.y - start.y)
    } else {
      const centerX = (start.x + end.x) / 2
      const centerY = (start.y + end.y) / 2
      context.ellipse(
        centerX,
        centerY,
        Math.abs(end.x - start.x) / 2,
        Math.abs(end.y - start.y) / 2,
        0,
        0,
        Math.PI * 2,
      )
    }
    context.stroke()
    context.globalAlpha = 1
    context.globalCompositeOperation = "source-over"
  }

  function matchesColor(
    data: Uint8ClampedArray,
    index: number,
    target: { r: number; g: number; b: number; a: number },
    tolerance: number,
  ) {
    return (
      Math.abs(data[index] - target.r) <= tolerance &&
      Math.abs(data[index + 1] - target.g) <= tolerance &&
      Math.abs(data[index + 2] - target.b) <= tolerance &&
      Math.abs(data[index + 3] - target.a) <= tolerance
    )
  }

  function floodFill(point: Point) {
    const backgroundCanvas = backgroundCanvasRef.current
    const drawingCanvas = drawingCanvasRef.current
    const drawingContext = drawingCanvas?.getContext("2d", {
      willReadFrequently: true,
    })
    if (!backgroundCanvas || !drawingCanvas || !drawingContext) return

    const composedCanvas = document.createElement("canvas")
    composedCanvas.width = CANVAS_WIDTH
    composedCanvas.height = CANVAS_HEIGHT
    const composedContext = composedCanvas.getContext("2d", {
      willReadFrequently: true,
    })
    if (!composedContext) return
    composedContext.drawImage(backgroundCanvas, 0, 0)
    composedContext.drawImage(drawingCanvas, 0, 0)

    const composed = composedContext.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    const foreground = drawingContext.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    const x = Math.max(0, Math.min(CANVAS_WIDTH - 1, Math.floor(point.x)))
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - 1, Math.floor(point.y)))
    const startIndex = (y * CANVAS_WIDTH + x) * 4
    const target = {
      r: composed.data[startIndex],
      g: composed.data[startIndex + 1],
      b: composed.data[startIndex + 2],
      a: composed.data[startIndex + 3],
    }
    const fill = parseHexColor(color)
    if (
      Math.abs(target.r - fill.r) < 6 &&
      Math.abs(target.g - fill.g) < 6 &&
      Math.abs(target.b - fill.b) < 6
    ) {
      return
    }

    const visited = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT)
    const stack: number[] = [x, y]
    const tolerance = 34
    let painted = 0

    while (stack.length) {
      const currentY = stack.pop()
      const currentX = stack.pop()
      if (currentX === undefined || currentY === undefined) break
      if (
        currentX < 0 ||
        currentX >= CANVAS_WIDTH ||
        currentY < 0 ||
        currentY >= CANVAS_HEIGHT
      ) {
        continue
      }

      let scanY = currentY
      while (scanY >= 0) {
        const pixel = scanY * CANVAS_WIDTH + currentX
        if (
          visited[pixel] ||
          !matchesColor(composed.data, pixel * 4, target, tolerance)
        ) {
          break
        }
        scanY -= 1
      }
      scanY += 1

      let reachesLeft = false
      let reachesRight = false
      for (; scanY < CANVAS_HEIGHT; scanY += 1) {
        const pixel = scanY * CANVAS_WIDTH + currentX
        const dataIndex = pixel * 4
        if (
          visited[pixel] ||
          !matchesColor(composed.data, dataIndex, target, tolerance)
        ) {
          break
        }

        visited[pixel] = 1
        foreground.data[dataIndex] = fill.r
        foreground.data[dataIndex + 1] = fill.g
        foreground.data[dataIndex + 2] = fill.b
        foreground.data[dataIndex + 3] = fill.a
        painted += 1

        if (currentX > 0) {
          const leftPixel = scanY * CANVAS_WIDTH + currentX - 1
          const matchesLeft =
            !visited[leftPixel] &&
            matchesColor(composed.data, leftPixel * 4, target, tolerance)
          if (matchesLeft && !reachesLeft) {
            stack.push(currentX - 1, scanY)
            reachesLeft = true
          } else if (!matchesLeft) {
            reachesLeft = false
          }
        }

        if (currentX < CANVAS_WIDTH - 1) {
          const rightPixel = scanY * CANVAS_WIDTH + currentX + 1
          const matchesRight =
            !visited[rightPixel] &&
            matchesColor(composed.data, rightPixel * 4, target, tolerance)
          if (matchesRight && !reachesRight) {
            stack.push(currentX + 1, scanY)
            reachesRight = true
          } else if (!matchesRight) {
            reachesRight = false
          }
        }
      }
    }

    if (painted > 0) {
      drawingContext.putImageData(foreground, 0, 0)
      commitDrawing()
    }
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault()
    const canvas = drawingCanvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    const point = getPoint(event)
    canvas.setPointerCapture(event.pointerId)

    if (tool === "fill") {
      floodFill(point)
      return
    }

    if (tool === "text") {
      const text = window.prompt("Escribe el texto que quieres agregar:")
      if (!text?.trim()) return
      configureContext(context, "text")
      context.font = `${Math.max(20, size * 3)}px Arial, sans-serif`
      context.textBaseline = "top"
      context.fillText(text.trim(), point.x, point.y)
      context.globalAlpha = 1
      commitDrawing()
      return
    }

    drawingRef.current = true
    startPointRef.current = point
    lastPointRef.current = point

    if (tool === "line" || tool === "rectangle" || tool === "ellipse") {
      previewImageRef.current = context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      return
    }

    configureContext(context, tool)
    context.beginPath()
    context.moveTo(point.x, point.y)
    context.lineTo(point.x + 0.01, point.y + 0.01)
    context.stroke()
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    event.preventDefault()
    const canvas = drawingCanvasRef.current
    const context = canvas?.getContext("2d")
    const start = startPointRef.current
    const last = lastPointRef.current
    if (!canvas || !context || !start || !last) return
    const point = getPoint(event)

    if (tool === "line" || tool === "rectangle" || tool === "ellipse") {
      if (previewImageRef.current) context.putImageData(previewImageRef.current, 0, 0)
      drawShape(context, tool, start, point)
      return
    }

    configureContext(context, tool)
    context.beginPath()
    context.moveTo(last.x, last.y)
    context.lineTo(point.x, point.y)
    context.stroke()
    lastPointRef.current = point
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = drawingCanvasRef.current
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
    if (!drawingRef.current) return
    drawingRef.current = false
    startPointRef.current = null
    lastPointRef.current = null
    previewImageRef.current = null
    const context = canvas?.getContext("2d")
    if (context) {
      context.globalAlpha = 1
      context.globalCompositeOperation = "source-over"
    }
    commitDrawing()
  }

  function setTemplate(source: string | null, message: string) {
    updateActivePage((page) => ({
      ...page,
      backgroundImage: source,
      templateOpacity: 1,
    }))
    setSaveStatus(message)
  }

  async function saveTemplateToLibrary(
    imageData: string,
    name: string,
    source: TemplateSource,
    prompt?: string,
  ) {
    setTemplateSaving(true)
    setLibraryMessage("Guardando plantilla...")
    try {
      const response = await fetch("/api/creative-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, name, source, prompt }),
      })
      const data = await responseJson(response)
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo guardar la plantilla.",
        )
      }
      const template = data.template as CreativeTemplate
      setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)])
      setLibraryMessage("Plantilla guardada en tu biblioteca")
      return true
    } catch (error) {
      setLibraryMessage(
        error instanceof Error ? error.message : "No se pudo guardar la plantilla.",
      )
      return false
    } finally {
      setTemplateSaving(false)
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setSaveStatus("Selecciona un archivo de imagen")
      return
    }

    setSaveStatus("Preparando plantilla...")
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("No fue posible leer el archivo."))
        reader.readAsDataURL(file)
      })
      const prepared = await prepareTemplate(source)
      setTemplate(prepared, "Plantilla cargada")
      const saved = await saveTemplateToLibrary(
        prepared,
        templateNameFromFile(file.name),
        "uploaded",
      )
      setSaveStatus(saved ? "Plantilla cargada y guardada" : "Plantilla cargada")
    } catch (error) {
      setSaveStatus(
        error instanceof Error ? error.message : "No fue posible cargar la plantilla",
      )
    }
  }

  async function generateTemplate() {
    const subject = aiPrompt.trim()
    if (!subject || generating) return
    setGenerating(true)
    setSaveStatus("Creando plantilla con IA...")
    const prompt = [
      `Printable black-and-white coloring book page about ${subject}.`,
      "Clean bold black outlines, pure white background, no color, no gray, no shading, no gradients.",
      "Simple closed shapes that are easy to color, centered portrait composition, educational and child-friendly.",
      "No text, no letters, no watermark, no border, full page illustration.",
    ].join(" ")

    try {
      const response = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: "flat design",
          width: 768,
          height: 1024,
          provider: "auto",
          mode: "fast",
          source: "creative-notebook",
          topic: subject,
        }),
      })
      const data = await responseJson(response)
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "No fue posible generar la plantilla.",
        )
      }
      const imageUrl = data.imageUrl
      if (typeof imageUrl !== "string") throw new Error("La IA no devolvió una imagen.")

      const prepared = await prepareTemplate(imageUrl)
      setTemplate(prepared, "Plantilla IA lista para colorear")
      const saved = await saveTemplateToLibrary(
        prepared,
        subject.slice(0, 120),
        "generated",
        subject,
      )
      setSaveStatus(saved ? "Plantilla IA creada y guardada" : "Plantilla IA lista")
    } catch (error) {
      setSaveStatus(
        error instanceof Error ? error.message : "No fue posible generar la plantilla",
      )
    } finally {
      setGenerating(false)
    }
  }

  async function saveCurrentTemplate() {
    if (!activePage.backgroundImage || templateSaving) return
    const name = window.prompt("Nombre para guardar esta plantilla:", activePage.title)
    if (!name?.trim()) return
    const saved = await saveTemplateToLibrary(
      activePage.backgroundImage,
      name.trim(),
      "other",
    )
    if (saved) setSaveStatus("Plantilla actual guardada")
  }

  async function applyLibraryTemplate(template: CreativeTemplate) {
    if (!template.imageUrl) {
      setLibraryMessage("La vista previa expiró. Actualiza la biblioteca.")
      return
    }
    setSaveStatus("Abriendo plantilla guardada...")
    try {
      const prepared = await prepareTemplate(template.imageUrl)
      setTemplate(prepared, `Plantilla “${template.name}” aplicada`)
    } catch (error) {
      setSaveStatus(
        error instanceof Error ? error.message : "No se pudo abrir la plantilla.",
      )
    }
  }

  async function deleteLibraryTemplate(template: CreativeTemplate) {
    if (!window.confirm(`¿Eliminar “${template.name}” de tu biblioteca?`)) return
    try {
      const response = await fetch(
        `/api/creative-templates?id=${encodeURIComponent(template.id)}`,
        { method: "DELETE" },
      )
      const data = await responseJson(response)
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo eliminar la plantilla.",
        )
      }
      setTemplates((current) => current.filter((item) => item.id !== template.id))
      setLibraryMessage("Plantilla eliminada")
    } catch (error) {
      setLibraryMessage(
        error instanceof Error ? error.message : "No se pudo eliminar la plantilla.",
      )
    }
  }

  function addPage() {
    const page = createPage(notebook.pages.length + 1)
    historyRef.current[page.id] = { entries: [EMPTY_DRAWING], index: 0 }
    setNotebook((current) => ({
      ...current,
      pages: [...current.pages, page],
      activePageId: page.id,
      updatedAt: new Date().toISOString(),
    }))
  }

  function removePage() {
    if (notebook.pages.length === 1) {
      setSaveStatus("El cuaderno debe conservar al menos una página")
      return
    }
    if (!window.confirm(`¿Eliminar ${activePage.title}?`)) return
    setNotebook((current) => {
      const index = current.pages.findIndex((page) => page.id === current.activePageId)
      const pages = current.pages.filter((page) => page.id !== current.activePageId)
      const nextActive = pages[Math.max(0, index - 1)] || pages[0]
      return {
        ...current,
        pages,
        activePageId: nextActive.id,
        updatedAt: new Date().toISOString(),
      }
    })
    delete historyRef.current[activePage.id]
  }

  function newNotebook() {
    const confirmed = window.confirm(
      "¿Crear un cuaderno nuevo? Descarga el actual si deseas conservar una copia.",
    )
    if (!confirmed) return
    historyRef.current = {}
    setNotebook(createNotebook())
    setAiPrompt("")
    setSaveStatus("Nuevo cuaderno creado")
  }

  async function composePage(page: CreativePage) {
    const canvas = document.createElement("canvas")
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    const context = canvas.getContext("2d")
    if (!context) throw new Error("No fue posible preparar la descarga.")
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    if (page.backgroundImage) {
      const background = await imageFromSource(page.backgroundImage)
      drawImageContained(context, background, page.templateOpacity)
    }
    if (page.drawingImage) {
      const drawing = await imageFromSource(page.drawingImage)
      context.drawImage(drawing, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }
    return canvas
  }

  async function downloadCurrentPage() {
    setExporting(true)
    try {
      const canvas = await composePage(activePage)
      const link = document.createElement("a")
      link.download = `${sanitizeFileName(notebook.title)}-${sanitizeFileName(activePage.title)}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      setSaveStatus("Página descargada en PNG")
    } catch (error) {
      setSaveStatus(
        error instanceof Error ? error.message : "No fue posible descargar la página",
      )
    } finally {
      setExporting(false)
    }
  }

  async function downloadNotebookPdf() {
    setExporting(true)
    setSaveStatus("Preparando PDF...")
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [CANVAS_WIDTH, CANVAS_HEIGHT],
        hotfixes: ["px_scaling"],
      })
      for (let index = 0; index < notebook.pages.length; index += 1) {
        if (index > 0) pdf.addPage([CANVAS_WIDTH, CANVAS_HEIGHT], "portrait")
        const pageCanvas = await composePage(notebook.pages[index])
        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.94),
          "JPEG",
          0,
          0,
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
        )
      }
      pdf.save(`${sanitizeFileName(notebook.title)}.pdf`)
      setSaveStatus("Cuaderno descargado en PDF")
    } catch (error) {
      setSaveStatus(
        error instanceof Error ? error.message : "No fue posible crear el PDF",
      )
    } finally {
      setExporting(false)
    }
  }

  const history = historyRef.current[activePage.id]
  const canUndo = Boolean(history && history.index > 0)
  const canRedo = Boolean(history && history.index < history.entries.length - 1)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1900px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft size={17} /> Volver
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-2xl shadow-lg shadow-pink-500/20">
              🖍️
            </div>
            <div>
              <h1 className="text-base font-bold">Cuaderno creativo</h1>
              <p className="text-xs text-slate-500">
                Dibuja, pinta y reutiliza tus plantillas en una biblioteca privada
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {saveStatus}
            </span>
            <button
              type="button"
              onClick={() => void downloadCurrentPage()}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Download size={15} /> PNG
            </button>
            <button
              type="button"
              onClick={() => void downloadNotebookPdf()}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl bg-fuchsia-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-fuchsia-500 disabled:opacity-50"
            >
              <FileDown size={15} /> Descargar PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1900px] gap-4 p-4 xl:grid-cols-[270px_minmax(0,1fr)_330px]">
        <aside className="self-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-[78px] xl:max-h-[calc(100vh-94px)] xl:overflow-y-auto">
          <div className="border-b border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Palette size={17} className="text-fuchsia-600" /> Herramientas
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TOOLS.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTool(item.id)}
                    title={item.label}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-[11px] font-bold transition ${
                      tool === item.id
                        ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={19} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-b border-slate-200 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              Colores
            </p>
            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setColor(item)}
                  aria-label={`Seleccionar color ${item}`}
                  className={`h-8 rounded-xl border-2 shadow-sm transition ${
                    color.toLowerCase() === item.toLowerCase()
                      ? "scale-110 border-fuchsia-500 ring-2 ring-fuchsia-200"
                      : "border-white"
                  }`}
                  style={{ backgroundColor: item }}
                />
              ))}
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Color personalizado
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-8 w-11 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-600">
              Grosor: {size}px
              <input
                type="range"
                min="2"
                max="42"
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="mt-2 w-full accent-fuchsia-600"
              />
            </label>
          </div>

          <div className="border-b border-slate-200 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              Acciones
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-35"
              >
                <Undo2 size={15} /> Deshacer
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-35"
              >
                <Redo2 size={15} /> Rehacer
              </button>
              <button
                type="button"
                onClick={clearDrawing}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600"
              >
                <Trash2 size={15} /> Limpiar dibujos
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <ImageIcon size={17} className="text-blue-600" /> Plantilla
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={templateSaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              <Upload size={15} /> Subir y guardar imagen
            </button>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTemplate(null, "Hoja en blanco")}
                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-600"
              >
                Blanca
              </button>
              <button
                type="button"
                onClick={() => {
                  const template = createPatternTemplate("grid")
                  if (template) setTemplate(template, "Cuadrícula aplicada")
                }}
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-600"
              >
                <Grid3X3 size={13} /> Cuadrícula
              </button>
              <button
                type="button"
                onClick={() => {
                  const template = createPatternTemplate("dots")
                  if (template) setTemplate(template, "Hoja punteada aplicada")
                }}
                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-600"
              >
                Puntos
              </button>
            </div>
            {activePage.backgroundImage && (
              <>
                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Intensidad: {Math.round(activePage.templateOpacity * 100)}%
                  <input
                    type="range"
                    min="15"
                    max="100"
                    value={Math.round(activePage.templateOpacity * 100)}
                    onChange={(event) => {
                      const opacity = Number(event.target.value) / 100
                      updateActivePage((page) => ({ ...page, templateOpacity: opacity }))
                    }}
                    className="mt-2 w-full accent-blue-600"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveCurrentTemplate()}
                  disabled={templateSaving}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50"
                >
                  {templateSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar plantilla actual
                </button>
              </>
            )}
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Sparkles size={17} className="text-violet-600" /> Crear con IA
            </div>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              La plantilla generada se guardará automáticamente en tu biblioteca.
            </p>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              rows={4}
              placeholder="Ej.: sistema solar con planetas grandes y un astronauta"
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs outline-none transition focus:border-violet-400 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => void generateTemplate()}
              disabled={!aiPrompt.trim() || generating || templateSaving}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {generating ? "Generando..." : "Crear y guardar"}
            </button>
          </div>
        </aside>

        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
            <input
              value={notebook.title}
              onChange={(event) =>
                setNotebook((current) => ({
                  ...current,
                  title: event.target.value,
                  updatedAt: new Date().toISOString(),
                }))
              }
              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-fuchsia-400 focus:bg-white"
              aria-label="Nombre del cuaderno"
            />
            <button
              type="button"
              onClick={newNotebook}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw size={14} /> Nuevo cuaderno
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-3">
            {notebook.pages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                onClick={() =>
                  setNotebook((current) => ({ ...current, activePageId: page.id }))
                }
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  page.id === activePage.id
                    ? "bg-fuchsia-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Página {index + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={addPage}
              className="flex shrink-0 items-center gap-1 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-200"
            >
              <Plus size={14} /> Página
            </button>
            <button
              type="button"
              onClick={removePage}
              className="flex shrink-0 items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>

          <div className="flex min-h-[650px] items-start justify-center overflow-auto bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0)] p-4 sm:p-8">
            <div className="relative aspect-[3/4] w-full max-w-[760px] overflow-hidden rounded-[22px] border border-slate-300 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.22)]">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 border-r border-red-100 bg-gradient-to-r from-slate-100/80 to-transparent" />
              <div className="pointer-events-none absolute left-2 top-8 z-20 flex h-[calc(100%-64px)] flex-col justify-around">
                {Array.from({ length: 11 }).map((_, index) => (
                  <span
                    key={index}
                    className="h-3 w-3 rounded-full border border-slate-300 bg-slate-100 shadow-inner"
                  />
                ))}
              </div>
              <canvas
                ref={backgroundCanvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              />
              <canvas
                ref={drawingCanvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={`absolute inset-0 h-full w-full touch-none ${
                  tool === "fill"
                    ? "cursor-cell"
                    : tool === "text"
                      ? "cursor-text"
                      : "cursor-crosshair"
                }`}
                aria-label="Lienzo de dibujo"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
            <span>
              <strong className="text-slate-700">{activePage.title}</strong> · Herramienta:{" "}
              {TOOLS.find((item) => item.id === tool)?.label}
            </span>
            <span>Compatible con mouse, pantalla táctil y lápiz digital</span>
          </div>
        </section>

        <aside className="self-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-[78px] xl:max-h-[calc(100vh-94px)]">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Library size={18} className="text-emerald-600" /> Mis plantillas
                </div>
                <p className="mt-1 text-xs text-slate-500">{libraryMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadTemplates()}
                disabled={templatesLoading}
                title="Actualizar biblioteca"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={15} className={templatesLoading ? "animate-spin" : ""} />
              </button>
            </div>
            <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search size={15} className="text-slate-400" />
              <input
                value={templateQuery}
                onChange={(event) => setTemplateQuery(event.target.value)}
                placeholder="Buscar plantilla..."
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </label>
          </div>

          <div className="max-h-[calc(100vh-205px)] overflow-y-auto p-3">
            {templatesLoading ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-xs text-slate-500">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
                Cargando tus plantillas
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                <Library size={28} className="mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-600">
                  {templateQuery ? "Sin resultados" : "Biblioteca vacía"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Las imágenes subidas y las plantillas creadas con IA aparecerán aquí automáticamente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredTemplates.map((template) => (
                  <article
                    key={template.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => void applyLibraryTemplate(template)}
                      disabled={!template.imageUrl}
                      className="block aspect-[3/4] w-full overflow-hidden bg-slate-100 disabled:cursor-not-allowed"
                    >
                      {template.imageUrl ? (
                        <img
                          src={template.imageUrl}
                          alt={template.name}
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                          Vista no disponible
                        </div>
                      )}
                    </button>
                    <div className="p-2.5">
                      <p className="line-clamp-2 text-xs font-bold text-slate-700">
                        {template.name}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {template.source === "generated" ? "IA" : template.source === "uploaded" ? "Subida" : "Guardada"} · {formatTemplateDate(template.updatedAt)}
                      </p>
                      <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
                        <button
                          type="button"
                          onClick={() => void applyLibraryTemplate(template)}
                          disabled={!template.imageUrl}
                          className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                        >
                          Usar
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteLibraryTemplate(template)}
                          title="Eliminar plantilla"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
