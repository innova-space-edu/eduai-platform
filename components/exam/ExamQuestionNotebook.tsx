"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Brush,
  Eraser,
  Expand,
  Minimize2,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import MathRenderer from "@/components/ui/MathRenderer";

type Point = { x: number; y: number };
type Stroke = { id: string; points: Point[] };
type Tool = "pen" | "eraser";

export type ExamNotebookPage = {
  id: string;
  title: string;
  strokes: Stroke[];
  latex: string;
  ocrText: string;
  ocrConfidence: number | null;
  canvasHeight: number;
  updatedAt: string;
};

export type ExamNotebookArtifact = {
  artifactId: string;
  questionIndex: number;
  questionId?: string;
  pages: ExamNotebookPage[];
  latex: string;
  ocrText: string;
  ocrConfidence: number | null;
  previewPngDataUrl?: string;
  updatedAt: string;
};

export type ExamQuestionNotebookHandle = {
  finalizeArtifact: () => Promise<ExamNotebookArtifact>;
  getArtifact: () => ExamNotebookArtifact;
};

type Props = {
  examId: string;
  attemptId: string;
  questionIndex: number;
  questionId?: string;
  onArtifactChange?: (artifact: ExamNotebookArtifact) => void;
};

const DEFAULT_CANVAS_HEIGHT = 1050;
const CANVAS_GROWTH_STEP = 520;
const CANVAS_BOTTOM_MARGIN = 160;
const ERASER_RADIUS = 18;

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPage(index: number): ExamNotebookPage {
  return {
    id: createId(),
    title: `Página ${index + 1}`,
    strokes: [],
    latex: "",
    ocrText: "",
    ocrConfidence: null,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    updatedAt: new Date().toISOString(),
  };
}

function pointToSegmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  const projected = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function strokeTouchesPoint(stroke: Stroke, point: Point) {
  if (stroke.points.length === 1) {
    return (
      Math.hypot(stroke.points[0].x - point.x, stroke.points[0].y - point.y) <=
      ERASER_RADIUS
    );
  }
  return stroke.points.some((current, index) => {
    if (index === 0) return false;
    return (
      pointToSegmentDistance(point, stroke.points[index - 1], current) <=
      ERASER_RADIUS
    );
  });
}

function combineLatex(pages: ExamNotebookPage[]) {
  return pages
    .map((page) => page.latex.trim())
    .filter(Boolean)
    .join("\\\\\n");
}

function combineOcrText(pages: ExamNotebookPage[]) {
  return pages
    .map((page) => page.ocrText.trim())
    .filter(Boolean)
    .join("\n");
}

function averageConfidence(pages: ExamNotebookPage[]) {
  const values = pages
    .map((page) => page.ocrConfidence)
    .filter((value): value is number => typeof value === "number");
  if (!values.length) return null;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10000,
    ) / 10000
  );
}

const ExamQuestionNotebook = forwardRef<ExamQuestionNotebookHandle, Props>(
  function ExamQuestionNotebook(
    { examId, attemptId, questionIndex, questionId, onArtifactChange },
    ref,
  ) {
    const storageKey = useMemo(
      () => `eduai-exam-notebook:${examId}:${attemptId}:${questionIndex}`,
      [attemptId, examId, questionIndex],
    );
    const artifactIdRef = useRef(createId());
    const svgRef = useRef<SVGSVGElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hydratedRef = useRef(false);

    const [pages, setPages] = useState<ExamNotebookPage[]>([createPage(0)]);
    const [activePageId, setActivePageId] = useState("");
    const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
    const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
    const [tool, setTool] = useState<Tool>("pen");
    const [recognizing, setRecognizing] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [feedback, setFeedback] = useState(
      "Escribe tu desarrollo. El LaTeX se actualizará automáticamente.",
    );

    useEffect(() => {
      setActivePageId((current) => current || pages[0]?.id || "");
    }, [pages]);

    const activePage = useMemo(
      () => pages.find((page) => page.id === activePageId) || pages[0],
      [activePageId, pages],
    );

    const updatePage = useCallback(
      (
        pageId: string,
        updater: (page: ExamNotebookPage) => ExamNotebookPage,
      ) => {
        setPages((current) =>
          current.map((page) => (page.id === pageId ? updater(page) : page)),
        );
      },
      [],
    );

    const getArtifact = useCallback(
      (): ExamNotebookArtifact => ({
        artifactId: artifactIdRef.current,
        questionIndex,
        questionId,
        pages,
        latex: combineLatex(pages),
        ocrText: combineOcrText(pages),
        ocrConfidence: averageConfidence(pages),
        updatedAt: new Date().toISOString(),
      }),
      [pages, questionId, questionIndex],
    );

    useEffect(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<ExamNotebookArtifact>;
          if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
            setPages(parsed.pages as ExamNotebookPage[]);
            setActivePageId((parsed.pages[0] as ExamNotebookPage).id);
          }
          if (typeof parsed.artifactId === "string" && parsed.artifactId)
            artifactIdRef.current = parsed.artifactId;
        }
      } catch (error) {
        console.error("[exam-question-notebook/hydrate]", error);
      } finally {
        hydratedRef.current = true;
      }
    }, [storageKey]);

    useEffect(() => {
      if (!hydratedRef.current) return;
      const artifact = getArtifact();
      localStorage.setItem(storageKey, JSON.stringify(artifact));
      onArtifactChange?.(artifact);
    }, [getArtifact, onArtifactChange, storageKey]);

    const recognize = useCallback(
      async (nextStrokes: Stroke[], pageId: string) => {
        if (!nextStrokes.length) {
          updatePage(pageId, (page) => ({
            ...page,
            latex: "",
            ocrText: "",
            ocrConfidence: null,
            updatedAt: new Date().toISOString(),
          }));
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
          if (!response.ok)
            throw new Error(
              data?.error || "No fue posible reconocer el desarrollo.",
            );
          updatePage(pageId, (page) => ({
            ...page,
            latex: typeof data?.latex === "string" ? data.latex : "",
            ocrText: typeof data?.text === "string" ? data.text : "",
            ocrConfidence:
              typeof data?.confidence === "number" ? data.confidence : null,
            updatedAt: new Date().toISOString(),
          }));
          setFeedback("✅ Desarrollo actualizado y guardado localmente.");
        } catch (error) {
          setFeedback(
            error instanceof Error
              ? `⚠️ ${error.message}`
              : "⚠️ No fue posible reconocer el desarrollo.",
          );
        } finally {
          setRecognizing(false);
        }
      },
      [updatePage],
    );

    const scheduleRecognition = useCallback(
      (nextStrokes: Stroke[], pageId: string) => {
        if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
        recognitionTimer.current = setTimeout(
          () => void recognize(nextStrokes, pageId),
          380,
        );
      },
      [recognize],
    );

    useEffect(
      () => () => {
        if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
      },
      [],
    );

    useEffect(() => {
      if (!expanded) return;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }, [expanded]);

    const commit = useCallback(
      (nextStrokes: Stroke[]) => {
        if (!activePage) return;
        updatePage(activePage.id, (page) => ({
          ...page,
          strokes: nextStrokes,
          updatedAt: new Date().toISOString(),
        }));
        setRedoStack([]);
        scheduleRecognition(nextStrokes, activePage.id);
      },
      [activePage, scheduleRecognition, updatePage],
    );

    const getPoint = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }, []);

    function growCanvasIfNeeded(point: Point) {
      if (
        !activePage ||
        point.y <= activePage.canvasHeight - CANVAS_BOTTOM_MARGIN
      )
        return;
      updatePage(activePage.id, (page) => ({
        ...page,
        canvasHeight: page.canvasHeight + CANVAS_GROWTH_STEP,
        updatedAt: new Date().toISOString(),
      }));
    }

    function eraseAt(point: Point) {
      if (!activePage) return;
      const next = activePage.strokes.filter(
        (stroke) => !strokeTouchesPoint(stroke, point),
      );
      if (next.length !== activePage.strokes.length) commit(next);
    }

    function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
      if (!activePage) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = getPoint(event);
      growCanvasIfNeeded(point);
      if (tool === "eraser") return eraseAt(point);
      setActiveStroke({ id: createId(), points: [point] });
    }

    function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const point = getPoint(event);
      growCanvasIfNeeded(point);
      if (tool === "eraser") return eraseAt(point);
      setActiveStroke((current) =>
        current ? { ...current, points: [...current.points, point] } : current,
      );
    }

    function onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      if (
        tool === "pen" &&
        activeStroke &&
        activeStroke.points.length > 1 &&
        activePage
      )
        commit([...activePage.strokes, activeStroke]);
      setActiveStroke(null);
    }

    function undo() {
      if (!activePage?.strokes.length) return;
      setRedoStack((current) => [...current, activePage.strokes]);
      const next = activePage.strokes.slice(0, -1);
      updatePage(activePage.id, (page) => ({
        ...page,
        strokes: next,
        updatedAt: new Date().toISOString(),
      }));
      scheduleRecognition(next, activePage.id);
    }

    function redo() {
      if (!activePage) return;
      const previous = redoStack.at(-1);
      if (!previous) return;
      setRedoStack((current) => current.slice(0, -1));
      updatePage(activePage.id, (page) => ({
        ...page,
        strokes: previous,
        updatedAt: new Date().toISOString(),
      }));
      scheduleRecognition(previous, activePage.id);
    }

    function clearPage() {
      if (!activePage) return;
      updatePage(activePage.id, (page) => ({
        ...page,
        strokes: [],
        latex: "",
        ocrText: "",
        ocrConfidence: null,
        updatedAt: new Date().toISOString(),
      }));
      setRedoStack([]);
      setActiveStroke(null);
    }

    function addPage() {
      const page = createPage(pages.length);
      setPages((current) => [...current, page]);
      setActivePageId(page.id);
      setRedoStack([]);
      setTimeout(
        () => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
        0,
      );
    }

    async function exportPng() {
      const svg = svgRef.current;
      if (!svg || !activePage) return undefined;
      const serialized = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([serialized], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () =>
            reject(new Error("No fue posible generar la vista previa PNG."));
          image.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(900, svg.clientWidth || 900);
        canvas.height = Math.min(Math.max(activePage.canvasHeight, 900), 2400);
        const context = canvas.getContext("2d");
        if (!context) return undefined;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/png", 0.9);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        getArtifact,
        async finalizeArtifact() {
          return { ...getArtifact(), previewPngDataUrl: await exportPng() };
        },
      }),
      [getArtifact],
    );

    if (!activePage) return null;
    const allStrokes = activeStroke
      ? [...activePage.strokes, activeStroke]
      : activePage.strokes;

    return (
      <section
        className={`flex min-h-0 flex-col overflow-hidden rounded-[24px] border shadow-sm ${
          expanded ? "fixed inset-3 z-[9998] shadow-2xl" : ""
        }`}
        style={{
          borderColor: "var(--exam-border)",
          backgroundColor: "var(--exam-surface)",
        }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-3"
          style={{
            borderColor: "var(--exam-border)",
            backgroundColor: "var(--exam-soft-bg)",
          }}
        >
          <div>
            <p
              className="text-sm font-black"
              style={{ color: "var(--exam-text)" }}
            >
              ✍️ Cuaderno de desarrollo
            </p>
            <p className="text-xs" style={{ color: "var(--exam-text-sub)" }}>
              Siempre visible. Se guarda al instante y registra el LaTeX oficial
              al avanzar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${recognizing ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
            >
              {recognizing ? "Reconociendo..." : "Guardado automático"}
            </span>
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold shadow-sm"
              style={{
                backgroundColor: "var(--exam-surface)",
                color: "var(--exam-accent)",
              }}
            >
              {expanded ? <Minimize2 size={14} /> : <Expand size={14} />}
              {expanded ? "Reducir" : "Ampliar"}
            </button>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
          style={{
            borderColor: "var(--exam-border)",
            backgroundColor: "var(--exam-soft-bg)",
          }}
        >
          <button
            type="button"
            onClick={() => setTool("pen")}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold ${tool === "pen" ? "bg-[var(--exam-accent)] text-white" : "bg-[var(--exam-surface)] text-[var(--exam-text-sub)]"}`}
          >
            <Brush size={14} /> Lápiz
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold ${tool === "eraser" ? "bg-rose-500 text-white" : "bg-[var(--exam-surface)] text-[var(--exam-text-sub)]"}`}
          >
            <Eraser size={14} /> Borrador
          </button>
          <button
            type="button"
            onClick={undo}
            className="rounded-lg bg-[var(--exam-surface)] p-2 text-[var(--exam-text-sub)]"
            aria-label="Deshacer"
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            onClick={redo}
            className="rounded-lg bg-[var(--exam-surface)] p-2 text-[var(--exam-text-sub)]"
            aria-label="Rehacer"
          >
            <Redo2 size={15} />
          </button>
          <button
            type="button"
            onClick={addPage}
            className="flex items-center gap-1 rounded-lg bg-[var(--exam-surface)] px-3 py-2 text-xs font-bold text-[var(--exam-accent)]"
          >
            <Plus size={14} /> Página
          </button>
          <button
            type="button"
            onClick={() =>
              scrollRef.current?.scrollBy({ top: -420, behavior: "smooth" })
            }
            className="rounded-lg bg-[var(--exam-surface)] p-2 text-[var(--exam-text-sub)]"
            aria-label="Subir"
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            onClick={() =>
              scrollRef.current?.scrollBy({ top: 420, behavior: "smooth" })
            }
            className="rounded-lg bg-[var(--exam-surface)] p-2 text-[var(--exam-text-sub)]"
            aria-label="Bajar"
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            onClick={clearPage}
            className="ml-auto flex items-center gap-1 rounded-lg bg-[var(--exam-surface)] px-3 py-2 text-xs font-bold text-rose-600"
          >
            <Trash2 size={14} /> Limpiar página
          </button>
        </div>

        <div
          className="flex flex-wrap gap-2 border-b px-3 py-2"
          style={{
            borderColor: "var(--exam-border)",
            backgroundColor: "var(--exam-surface)",
          }}
        >
          {pages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              onClick={() => setActivePageId(page.id)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${page.id === activePage.id ? "bg-[var(--exam-accent)] text-white" : "bg-[var(--exam-soft-bg)] text-[var(--exam-text-sub)]"}`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <div
          className={`grid min-h-0 flex-1 ${expanded ? "lg:grid-cols-[minmax(0,1fr)_300px]" : "grid-rows-[auto_1fr]"}`}
        >
          <aside
            className={`space-y-2 p-3 ${expanded ? "lg:order-2 lg:border-l" : "border-b"}`}
            style={{
              backgroundColor: "var(--exam-surface)",
              borderColor: "var(--exam-border)",
            }}
          >
            <div
              className="rounded-2xl border p-3"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--exam-accent) 24%, transparent)",
                backgroundColor: "var(--exam-accent-soft)",
              }}
            >
              <p
                className="mb-2 text-xs font-black uppercase tracking-[0.12em]"
                style={{ color: "var(--exam-accent)" }}
              >
                LaTeX reconocido
              </p>
              {activePage.latex ? (
                <MathRenderer content={`$$${activePage.latex}$$`} />
              ) : (
                <p className="text-sm" style={{ color: "var(--exam-muted)" }}>
                  Escribe en la hoja para generar el desarrollo digital.
                </p>
              )}
            </div>
            <p
              className="rounded-2xl p-3 text-xs"
              style={{
                backgroundColor: "var(--exam-soft-bg)",
                color: "var(--exam-text-sub)",
              }}
            >
              {feedback}
            </p>
            <p className="text-[11px]" style={{ color: "var(--exam-muted)" }}>
              Página {pages.findIndex((page) => page.id === activePage.id) + 1}{" "}
              de {pages.length}. Se evaluará el LaTeX renderizado; los trazos
              quedan solo como evidencia.
            </p>
          </aside>

          <div
            ref={scrollRef}
            className={`${expanded ? "lg:order-1 h-full" : "h-[560px] xl:h-[calc(100vh-300px)] xl:min-h-[520px] xl:max-h-[720px]"} overflow-y-scroll`}
            style={{ backgroundColor: "var(--exam-surface)" }}
          >
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ height: activePage.canvasHeight }}
              className={`w-full touch-none bg-white ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
            >
              <defs>
                <pattern
                  id={`exam-grid-${questionIndex}`}
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 24 0 L 0 0 0 24"
                    fill="none"
                    stroke="var(--exam-border)"
                    strokeWidth="0.7"
                  />
                </pattern>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill={`url(#exam-grid-${questionIndex})`}
              />
              {allStrokes.map((stroke) => (
                <polyline
                  key={stroke.id}
                  points={stroke.points
                    .map((point) => `${point.x},${point.y}`)
                    .join(" ")}
                  fill="none"
                  stroke="var(--exam-text)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </div>
        </div>
      </section>
    );
  },
);

export default ExamQuestionNotebook;
