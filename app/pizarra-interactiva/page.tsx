"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brush,
  Eraser,
  Expand,
  Minimize2,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import MathRenderer from "@/components/ui/MathRenderer";

type Point = { x: number; y: number };
type Stroke = { id: string; points: Point[] };
type Tool = "pen" | "eraser";
type ChatMessage = { role: "user" | "assistant"; content: string };

const ERASER_RADIUS = 18;

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

export default function PizarraInteractivaPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const recognitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [latex, setLatex] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [feedback, setFeedback] = useState("Escribe una expresión matemática. El resultado LaTeX aparecerá a la derecha.");
  const [expanded, setExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const allStrokes = useMemo(() => (activeStroke ? [...strokes, activeStroke] : strokes), [activeStroke, strokes]);

  const getPoint = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const recognize = useCallback(async (nextStrokes: Stroke[]) => {
    if (nextStrokes.length === 0) {
      setLatex("");
      setFeedback("La pizarra quedó vacía. Puedes escribir una nueva expresión.");
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
      setLatex(data.latex || "");
      setFeedback(data.latex ? "✅ Expresión actualizada correctamente." : "⚠️ Aún no reconozco una expresión completa. Continúa escribiendo o corrige un trazo.");
    } catch (error) {
      setFeedback(error instanceof Error ? `⚠️ ${error.message}` : "⚠️ No fue posible reconocer la expresión.");
    } finally {
      setRecognizing(false);
    }
  }, []);

  const scheduleRecognition = useCallback((nextStrokes: Stroke[]) => {
    if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
    recognitionTimer.current = setTimeout(() => void recognize(nextStrokes), 450);
  }, [recognize]);

  useEffect(() => () => {
    if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
  }, []);

  function commit(nextStrokes: Stroke[]) {
    setStrokes(nextStrokes);
    setRedoStack([]);
    scheduleRecognition(nextStrokes);
  }

  function eraseAt(point: Point) {
    const next = strokes.filter((stroke) => !strokeTouchesPoint(stroke, point));
    if (next.length !== strokes.length) commit(next);
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    if (tool === "eraser") {
      eraseAt(point);
      return;
    }
    setActiveStroke({ id: crypto.randomUUID(), points: [point] });
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const point = getPoint(event);
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
    setStrokes(next);
    scheduleRecognition(next);
  }

  function redo() {
    const previous = redoStack.at(-1);
    if (!previous) return;
    setRedoStack((current) => current.slice(0, -1));
    setStrokes(previous);
    scheduleRecognition(previous);
  }

  function clearBoard() {
    if (strokes.length > 0) setRedoStack((current) => [...current, strokes]);
    setStrokes([]);
    setLatex("");
    setFeedback("La pizarra quedó vacía. Puedes escribir una nueva expresión.");
  }

  async function sendChat() {
    const question = chatInput.trim();
    if (!question || chatLoading) return;

    const context = latex
      ? `${question}\n\nExpresión escrita actualmente en la pizarra: $$${latex}$$`
      : question;

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
              <p className="text-xs text-slate-500">Escribe, borra y convierte tus trazos a LaTeX</p>
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

        <section className={`grid min-h-0 flex-1 gap-4 ${expanded ? "grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]" : "grid-cols-1 lg:grid-cols-2"}`}>
          <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setTool("pen")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${tool === "pen" ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}><Brush size={14} /> Lápiz</button>
                <button onClick={() => setTool("eraser")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${tool === "eraser" ? "bg-rose-500 text-white" : "bg-white text-slate-700"}`}><Eraser size={14} /> Borrador</button>
                <button onClick={undo} disabled={strokes.length === 0} className="rounded-lg bg-white p-2 text-slate-700 disabled:opacity-35" aria-label="Deshacer"><Undo2 size={16} /></button>
                <button onClick={redo} disabled={redoStack.length === 0} className="rounded-lg bg-white p-2 text-slate-700 disabled:opacity-35" aria-label="Rehacer"><Redo2 size={16} /></button>
              </div>
              <button onClick={clearBoard} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-rose-600"><Trash2 size={14} /> Limpiar</button>
            </div>
            <svg ref={svgRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className={`min-h-0 flex-1 touch-none bg-white ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}>
              <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e2e8f0" strokeWidth="0.7" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              {allStrokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}
            </svg>
          </div>

          <aside className="flex min-h-[520px] flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Procedimiento digital</h2>
                <p className="text-xs text-slate-500">El resultado cambia al escribir o borrar trazos.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${recognizing ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{recognizing ? "Reconociendo..." : "Actualizado"}</span>
            </div>
            <div className="min-h-36 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              {latex ? <MathRenderer content={`$$${latex}$$`} /> : <p className="text-sm text-slate-500">Aquí aparecerá la expresión matemática en formato LaTeX.</p>}
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Código LaTeX editable</label>
              <textarea value={latex} onChange={(event) => setLatex(event.target.value)} rows={5} placeholder="El código LaTeX aparecerá aquí..." className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{feedback}</div>
            <div className="mt-auto flex items-center justify-between gap-2 text-xs text-slate-500"><span>{strokes.length} trazos activos</span><button onClick={() => void recognize(strokes)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"><RotateCcw size={14} /> Reconocer ahora</button></div>
          </aside>
        </section>
      </main>
    </div>
  );
}
