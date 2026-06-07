"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Brush,
  Eraser,
  Expand,
  FileText,
  Minimize2,
  Plus,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import MathRenderer from "@/components/ui/MathRenderer";

type Point = { x: number; y: number };
type Stroke = { id: string; points: Point[] };
type Tool = "pen" | "eraser";
type ChatMessage = { role: "user" | "assistant"; content: string };

type NotebookPage = {
  id: string;
  title: string;
  strokes: Stroke[];
  latex: string;
  canvasHeight: number;
  createdAt: string;
  updatedAt: string;
};

type NotebookSession = {
  id: string;
  title: string;
  pages: NotebookPage[];
  activePageId: string;
  updatedAt: string;
  createdAt: string;
};

type LegacyNotebookSession = {
  id?: string;
  title?: string;
  strokes?: Stroke[];
  latex?: string;
  canvasHeight?: number;
  updatedAt?: string;
  createdAt?: string;
};

const ERASER_RADIUS = 18;
const NOTEBOOK_STORAGE_KEY = "eduai-whiteboard-current-notebook";
const NOTEBOOKS_STORAGE_KEY = "eduai-whiteboard-saved-notebooks";
const DEFAULT_CANVAS_HEIGHT = 1200;
const CANVAS_GROWTH_STEP = 700;
const CANVAS_BOTTOM_MARGIN = 220;

function pointToSegmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projected = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function strokeTouchesPoint(stroke: Stroke, point: Point) {
  if (stroke.points.length === 1) {
    return Math.hypot(stroke.points[0].x - point.x, stroke.points[0].y - point.y) <= ERASER_RADIUS;
  }
  return stroke.points.some((current, index) => {
    if (index === 0) return false;
    return pointToSegmentDistance(point, stroke.points[index - 1], current) <= ERASER_RADIUS;
  });
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function createNotebookPage(pageNumber: number): NotebookPage {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: `Página ${pageNumber}`,
    strokes: [],
    latex: "",
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    createdAt: now,
    updatedAt: now,
  };
}

function createEmptyNotebook(): NotebookSession {
  const now = new Date().toISOString();
  const firstPage = createNotebookPage(1);
  return {
    id: createId(),
    title: "Cuaderno sin título",
    pages: [firstPage],
    activePageId: firstPage.id,
    createdAt: now,
    updatedAt: now,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStroke(value: unknown): Stroke | null {
  if (!isRecord(value) || !Array.isArray(value.points)) return null;
  const points = value.points.filter(
    (point): point is Point => isRecord(point) && typeof point.x === "number" && Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y),
  );
  if (points.length === 0) return null;
  return {
    id: typeof value.id === "string" ? value.id : createId(),
    points,
  };
}

function normalizePage(value: unknown, index: number): NotebookPage | null {
  if (!isRecord(value)) return null;
  const now = new Date().toISOString();
  const strokes = Array.isArray(value.strokes)
    ? value.strokes.map(normalizeStroke).filter((stroke): stroke is Stroke => stroke !== null)
    : [];
  return {
    id: typeof value.id === "string" ? value.id : createId(),
    title: typeof value.title === "string" && value.title.trim() ? value.title : `Página ${index + 1}`,
    strokes,
    latex: typeof value.latex === "string" ? value.latex : "",
    canvasHeight: typeof value.canvasHeight === "number" ? Math.max(value.canvasHeight, DEFAULT_CANVAS_HEIGHT) : DEFAULT_CANVAS_HEIGHT,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

function normalizeNotebook(value: unknown): NotebookSession | null {
  if (!isRecord(value)) return null;
  const now = new Date().toISOString();
  const rawPages = Array.isArray(value.pages) ? value.pages : [];
  let pages = rawPages.map(normalizePage).filter((page): page is NotebookPage => page !== null);

  if (pages.length === 0) {
    const legacy = value as LegacyNotebookSession;
    const migratedPage = createNotebookPage(1);
    migratedPage.strokes = Array.isArray(legacy.strokes)
      ? legacy.strokes.map(normalizeStroke).filter((stroke): stroke is Stroke => stroke !== null)
      : [];
    migratedPage.latex = typeof legacy.latex === "string" ? legacy.latex : "";
    migratedPage.canvasHeight = typeof legacy.canvasHeight === "number" ? Math.max(legacy.canvasHeight, DEFAULT_CANVAS_HEIGHT) : DEFAULT_CANVAS_HEIGHT;
    migratedPage.createdAt = typeof legacy.createdAt === "string" ? legacy.createdAt : now;
    migratedPage.updatedAt = typeof legacy.updatedAt === "string" ? legacy.updatedAt : now;
    pages = [migratedPage];
  }

  const activePageId = typeof value.activePageId === "string" && pages.some((page) => page.id === value.activePageId)
    ? value.activePageId
    : pages[0].id;

  return {
    id: typeof value.id === "string" ? value.id : createId(),
    title: typeof value.title === "string" && value.title.trim() ? value.title : "Cuaderno sin título",
    pages,
    activePageId,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

function formatSavedTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString();
}

export default function PizarraInteractivaPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const recognitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  const initialNotebook = useMemo(() => createEmptyNotebook(), []);
  const [tool, setTool] = useState<Tool>("pen");
  const [notebookId, setNotebookId] = useState(initialNotebook.id);
  const [notebookTitle, setNotebookTitle] = useState(initialNotebook.title);
  const [notebookCreatedAt, setNotebookCreatedAt] = useState(initialNotebook.createdAt);
  const [pages, setPages] = useState<NotebookPage[]>(initialNotebook.pages);
  const [activePageId, setActivePageId] = useState(initialNotebook.activePageId);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("Sin guardar");
  const [savedNotebooks, setSavedNotebooks] = useState<NotebookSession[]>([]);
  const [showSavedNotebooks, setShowSavedNotebooks] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [feedback, setFeedback] = useState("Escribe una expresión matemática. El resultado LaTeX aparecerá a la derecha.");
  const [expanded, setExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) || pages[0],
    [activePageId, pages],
  );
  const strokes = activePage.strokes;
  const latex = activePage.latex;
  const canvasHeight = activePage.canvasHeight;
  const allStrokes = useMemo(() => (activeStroke ? [...strokes, activeStroke] : strokes), [activeStroke, strokes]);

  const updatePage = useCallback((pageId: string, updater: (page: NotebookPage) => NotebookPage) => {
    setPages((current) => current.map((page) => (page.id === pageId ? updater(page) : page)));
  }, []);

  const updateActivePage = useCallback((updater: (page: NotebookPage) => NotebookPage) => {
    updatePage(activePageId, updater);
  }, [activePageId, updatePage]);

  const getPoint = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const recognize = useCallback(async (nextStrokes: Stroke[], pageId = activePageId) => {
    if (nextStrokes.length === 0) {
      updatePage(pageId, (page) => ({ ...page, latex: "", updatedAt: new Date().toISOString() }));
      setFeedback("La página quedó vacía. Puedes escribir una nueva expresión.");
      return;
    }
    setRecognizing(true);
    try {
      const response = await fetch("/api/whiteboard/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strokes: nextStrokes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible reconocer la expresión.");
      const nextLatex = typeof data.latex === "string" ? data.latex : "";
      updatePage(pageId, (page) => ({ ...page, latex: nextLatex, updatedAt: new Date().toISOString() }));
      setFeedback(nextLatex ? "✅ Expresión actualizada correctamente." : "⚠️ Aún no reconozco una expresión completa. Continúa escribiendo o corrige un trazo.");
    } catch (error) {
      setFeedback(error instanceof Error ? `⚠️ ${error.message}` : "⚠️ No fue posible reconocer la expresión.");
    } finally {
      setRecognizing(false);
    }
  }, [activePageId, updatePage]);

  const scheduleRecognition = useCallback((nextStrokes: Stroke[], pageId = activePageId) => {
    if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
    recognitionTimer.current = setTimeout(() => void recognize(nextStrokes, pageId), 450);
  }, [activePageId, recognize]);

  useEffect(() => () => {
    if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
  }, []);

  function buildNotebookSession(): NotebookSession {
    return {
      id: notebookId,
      title: notebookTitle.trim() || "Cuaderno sin título",
      pages,
      activePageId,
      createdAt: notebookCreatedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  function readSavedNotebooks() {
    try {
      const raw = localStorage.getItem(NOTEBOOKS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normalizeNotebook)
        .filter((notebook): notebook is NotebookSession => notebook !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch (error) {
      console.error("[whiteboard/read-notebooks]", error);
      return [];
    }
  }

  function persistNotebook(session: NotebookSession, status = "Guardado automáticamente") {
    try {
      const currentSaved = readSavedNotebooks();
      const nextSaved = [session, ...currentSaved.filter((notebook) => notebook.id !== session.id)]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      localStorage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem(NOTEBOOKS_STORAGE_KEY, JSON.stringify(nextSaved));
      setSavedNotebooks(nextSaved);
      setLastSavedAt(session.updatedAt);
      setSaveStatus(status);
    } catch (error) {
      console.error("[whiteboard/save]", error);
      setSaveStatus("No se pudo guardar");
    }
  }

  function saveNotebookToLocalStorage(status = "Cuaderno guardado") {
    persistNotebook(buildNotebookSession(), status);
  }

  function applyNotebookSession(session: NotebookSession) {
    setNotebookId(session.id);
    setNotebookTitle(session.title);
    setNotebookCreatedAt(session.createdAt);
    setPages(session.pages);
    setActivePageId(session.activePageId);
    setRedoStack([]);
    setActiveStroke(null);
    setLastSavedAt(session.updatedAt);
    setSaveStatus("Cuaderno abierto");
    setFeedback("Cuaderno abierto. Puedes continuar escribiendo.");
    window.setTimeout(() => boardScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function loadNotebookFromLocalStorage() {
    try {
      const saved = localStorage.getItem(NOTEBOOK_STORAGE_KEY);
      if (!saved) {
        setSaveStatus("No hay un cuaderno reciente en este navegador");
        return;
      }
      const parsed = normalizeNotebook(JSON.parse(saved));
      if (!parsed) throw new Error("El cuaderno guardado no tiene un formato válido.");
      applyNotebookSession(parsed);
    } catch (error) {
      console.error("[whiteboard/load]", error);
      setSaveStatus("No se pudo recuperar el cuaderno");
    }
  }

  function createNewNotebook() {
    const hasContent = pages.some((page) => page.strokes.length > 0 || page.latex.trim());
    const confirmed = !hasContent || window.confirm("¿Crear un cuaderno nuevo? El cuaderno actual ya está guardado localmente.");
    if (!confirmed) return;
    const session = createEmptyNotebook();
    applyNotebookSession(session);
    persistNotebook(session, "Nuevo cuaderno creado");
  }

  function addNewPage() {
    const nextPage = createNotebookPage(pages.length + 1);
    setPages((current) => [...current, nextPage]);
    setActivePageId(nextPage.id);
    setRedoStack([]);
    setActiveStroke(null);
    setFeedback(`${nextPage.title} agregada. Puedes continuar escribiendo.`);
    window.setTimeout(() => boardScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function openPage(pageId: string) {
    setActivePageId(pageId);
    setRedoStack([]);
    setActiveStroke(null);
    window.setTimeout(() => boardScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function openSavedNotebook(session: NotebookSession) {
    applyNotebookSession(session);
    persistNotebook(session, "Cuaderno abierto");
    setShowSavedNotebooks(false);
  }

  function deleteSavedNotebook(sessionId: string) {
    const confirmed = window.confirm("¿Eliminar este cuaderno guardado de este navegador?");
    if (!confirmed) return;
    const nextSaved = readSavedNotebooks().filter((notebook) => notebook.id !== sessionId);
    localStorage.setItem(NOTEBOOKS_STORAGE_KEY, JSON.stringify(nextSaved));
    setSavedNotebooks(nextSaved);
    if (sessionId === notebookId) {
      const session = createEmptyNotebook();
      applyNotebookSession(session);
      persistNotebook(session, "Nuevo cuaderno creado");
    }
  }

  function growCanvasIfNeeded(point: Point) {
    if (point.y > canvasHeight - CANVAS_BOTTOM_MARGIN) {
      updateActivePage((page) => ({ ...page, canvasHeight: page.canvasHeight + CANVAS_GROWTH_STEP, updatedAt: new Date().toISOString() }));
    }
  }

  function scrollNotebook(direction: "up" | "down") {
    const container = boardScrollRef.current;
    if (!container) return;
    const distance = Math.max(container.clientHeight * 0.82, 320);
    container.scrollBy({ top: direction === "down" ? distance : -distance, behavior: "smooth" });
  }

  useEffect(() => {
    try {
      const recentRaw = localStorage.getItem(NOTEBOOK_STORAGE_KEY);
      const recent = recentRaw ? normalizeNotebook(JSON.parse(recentRaw)) : null;
      const storedNotebooks = readSavedNotebooks();
      setSavedNotebooks(storedNotebooks);
      if (recent) applyNotebookSession(recent);
      else if (storedNotebooks[0]) applyNotebookSession(storedNotebooks[0]);
    } catch (error) {
      console.error("[whiteboard/initial-load]", error);
      setSaveStatus("No se pudo recuperar el último cuaderno");
    } finally {
      hydratedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveNotebookToLocalStorage("Guardado automáticamente");
    // Guardado inmediato: no usa temporizador de espera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId, notebookTitle, pages]);

  function commit(nextStrokes: Stroke[]) {
    updateActivePage((page) => ({ ...page, strokes: nextStrokes, updatedAt: new Date().toISOString() }));
    setRedoStack([]);
    scheduleRecognition(nextStrokes, activePageId);
  }

  function eraseAt(point: Point) {
    const next = strokes.filter((stroke) => !strokeTouchesPoint(stroke, point));
    if (next.length !== strokes.length) commit(next);
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    growCanvasIfNeeded(point);
    if (tool === "eraser") {
      eraseAt(point);
      return;
    }
    setActiveStroke({ id: createId(), points: [point] });
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const point = getPoint(event);
    growCanvasIfNeeded(point);
    if (tool === "eraser") {
      eraseAt(point);
      return;
    }
    setActiveStroke((current) => current ? { ...current, points: [...current.points, point] } : current);
  }

  function onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (tool === "pen" && activeStroke && activeStroke.points.length > 1) commit([...strokes, activeStroke]);
    setActiveStroke(null);
  }

  function undo() {
    if (strokes.length === 0) return;
    setRedoStack((current) => [...current, strokes]);
    const next = strokes.slice(0, -1);
    updateActivePage((page) => ({ ...page, strokes: next, updatedAt: new Date().toISOString() }));
    scheduleRecognition(next, activePageId);
  }

  function redo() {
    const previous = redoStack.at(-1);
    if (!previous) return;
    setRedoStack((current) => current.slice(0, -1));
    updateActivePage((page) => ({ ...page, strokes: previous, updatedAt: new Date().toISOString() }));
    scheduleRecognition(previous, activePageId);
  }

  function clearBoard() {
    if (strokes.length > 0) setRedoStack((current) => [...current, strokes]);
    updateActivePage((page) => ({ ...page, strokes: [], latex: "", updatedAt: new Date().toISOString() }));
    setFeedback("La página quedó vacía. Puedes escribir una nueva expresión.");
  }

  async function sendChat() {
    const question = chatInput.trim();
    if (!question || chatLoading) return;
    const context = latex ? `${question}\n\nExpresión escrita actualmente en la pizarra: $$${latex}$$` : question;
    const history = chatMessages.slice(-6);
    setChatMessages((current) => [...current, { role: "user", content: question }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const response = await fetch("/api/agents/matematico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: context, history }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No fue posible consultar al agente matemático.");
      setChatMessages((current) => [...current, { role: "assistant", content: data.text || "No recibí una respuesta." }]);
    } catch (error) {
      setChatMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? `⚠️ ${error.message}` : "⚠️ No fue posible consultar al agente matemático." }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className={`min-h-screen bg-white text-slate-900 ${expanded ? "overflow-hidden" : ""}`}>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} aria-label="Volver" className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
              <ArrowLeft size={16} /> Volver
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-xl shadow-sm">✍️</div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">Pizarra interactiva</h1>
              <p className="text-xs text-slate-500">Cuaderno matemático con OCR y páginas guardadas</p>
            </div>
          </div>
          <button onClick={() => setExpanded((value) => !value)} className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
            {expanded ? <Minimize2 size={16} /> : <Expand size={16} />}
            {expanded ? "Reducir" : "Expandir"}
          </button>
        </div>
      </header>

      <main className={`mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 ${expanded ? "h-[calc(100vh-65px)]" : ""}`}>
        {!expanded && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Sparkles size={16} className="text-blue-600" /> Chat con IA</div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void sendChat()} placeholder="Pregunta algo sobre el ejercicio o solicita una pista..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white" />
              <button onClick={() => void sendChat()} disabled={!chatInput.trim() || chatLoading} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40">{chatLoading ? "Consultando..." : "Enviar"}</button>
            </div>
            {chatMessages.length > 0 && (
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                {chatMessages.slice(-4).map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`rounded-xl px-3 py-2 text-sm ${message.role === "user" ? "ml-auto max-w-[85%] bg-blue-600 text-white" : "mr-auto max-w-[95%] border border-slate-200 bg-white text-slate-700"}`}>
                    {message.role === "assistant" ? <MathRenderer content={message.content} /> : message.content}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cuaderno</span>
          <input value={notebookTitle} onChange={(event) => setNotebookTitle(event.target.value)} className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white" placeholder="Nombre del cuaderno" />
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">💾 {saveStatus}</span>
          {lastSavedAt && <span className="text-xs text-slate-500">Último guardado: {new Date(lastSavedAt).toLocaleTimeString()}</span>}
        </div>

        <section className={`grid min-h-0 flex-1 gap-4 ${expanded ? "grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]" : "grid-cols-1 lg:grid-cols-2"}`}>
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setTool("pen")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${tool === "pen" ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}><Brush size={14} /> Lápiz</button>
                <button onClick={() => setTool("eraser")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${tool === "eraser" ? "bg-rose-500 text-white" : "bg-white text-slate-700"}`}><Eraser size={14} /> Borrador</button>
                <button onClick={undo} disabled={strokes.length === 0} className="rounded-lg bg-white p-2 text-slate-700 disabled:opacity-35" aria-label="Deshacer"><Undo2 size={16} /></button>
                <button onClick={redo} disabled={redoStack.length === 0} className="rounded-lg bg-white p-2 text-slate-700 disabled:opacity-35" aria-label="Rehacer"><Redo2 size={16} /></button>
                <button onClick={createNewNotebook} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700">Nuevo cuaderno</button>
                <button onClick={() => saveNotebookToLocalStorage("Cuaderno guardado")} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-700">Guardar cuaderno</button>
                <button onClick={loadNotebookFromLocalStorage} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700">Recuperar</button>
                <button onClick={() => { setSavedNotebooks(readSavedNotebooks()); setShowSavedNotebooks(true); }} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"><BookOpen size={14} /> Mis cuadernos</button>
              </div>
              <button onClick={clearBoard} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-rose-600"><Trash2 size={14} /> Limpiar página</button>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
                {pages.map((page, index) => (
                  <button key={page.id} onClick={() => openPage(page.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${page.id === activePageId ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    Página {index + 1}
                  </button>
                ))}
                <button onClick={addNewPage} aria-label="Agregar nueva página" title="Agregar nueva página" className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-200">
                  <Plus size={15} /> Página
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-2">
                <button onClick={() => scrollNotebook("up")} aria-label="Subir en el cuaderno" title="Subir" className="rounded-lg bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200"><ArrowUp size={16} /></button>
                <button onClick={() => scrollNotebook("down")} aria-label="Bajar en el cuaderno" title="Bajar" className="rounded-lg bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200"><ArrowDown size={16} /></button>
              </div>
            </div>

            <div ref={boardScrollRef} className="relative min-h-[420px] overflow-y-scroll bg-white" style={{ height: expanded ? "calc(100vh - 285px)" : "720px", scrollbarGutter: "stable", overscrollBehavior: "contain" }}>
              <svg ref={svgRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={{ height: canvasHeight }} className={`w-full touch-none bg-white ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}>
                <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e2e8f0" strokeWidth="0.7" /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                {allStrokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}
              </svg>
            </div>
          </div>

          <aside className="flex min-h-[520px] flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Procedimiento digital · {activePage.title}</h2>
                <p className="text-xs text-slate-500">El resultado cambia al escribir o borrar trazos.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${recognizing ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{recognizing ? "Reconociendo..." : "Actualizado"}</span>
            </div>
            <div className="min-h-36 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              {latex ? <MathRenderer content={`$$${latex}$$`} /> : <p className="text-sm text-slate-500">Escribe en esta página para generar LaTeX automáticamente.</p>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{feedback}</div>
            <button onClick={() => void recognize(strokes, activePageId)} disabled={strokes.length === 0 || recognizing} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"><RotateCcw size={16} /> Reprocesar OCR</button>
          </aside>
        </section>
      </main>

      {showSavedNotebooks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowSavedNotebooks(false)}>
          <section className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><BookOpen size={18} className="text-blue-600" /> Mis cuadernos guardados</h2>
                <p className="mt-1 text-xs text-slate-500">Se guardan automáticamente en este navegador.</p>
              </div>
              <button onClick={() => setShowSavedNotebooks(false)} aria-label="Cerrar" className="rounded-xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
              {savedNotebooks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Aún no hay cuadernos guardados.</div>
              ) : savedNotebooks.map((session) => (
                <article key={session.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${session.id === notebookId ? "border-blue-300 bg-blue-50/70" : "border-slate-200 bg-white"}`}>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900"><FileText size={15} className="text-blue-600" /> {session.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{session.pages.length} {session.pages.length === 1 ? "página" : "páginas"} · Guardado: {formatSavedTime(session.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openSavedNotebook(session)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500">Abrir</button>
                    <button onClick={() => deleteSavedNotebook(session.id)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100">Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
