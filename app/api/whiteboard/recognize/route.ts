import { NextResponse } from "next/server";
import { latexToReadableText, normalizeLatexSource } from "@/lib/exam/latex-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECOGNITION_TIMEOUT_MS = Number(process.env.WHITEBOARD_RECOGNITION_TIMEOUT_MS || 6500);

type Point = { x: number; y: number };
type Stroke = { points: Point[] };
type RecognizeBody = { strokes?: Stroke[] };

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalize(strokes: Stroke[]) {
  const x: number[][] = [];
  const y: number[][] = [];

  for (const stroke of strokes) {
    if (!stroke || !Array.isArray(stroke.points)) continue;
    const points = stroke.points.filter(
      (point) => point && isNumber(point.x) && isNumber(point.y),
    );
    if (points.length < 2) continue;

    // Reduce puntos casi repetidos para bajar payload/latencia sin perder la forma.
    const simplified = points.filter((point, index) => {
      if (index === 0 || index === points.length - 1) return true;
      const prev = points[index - 1];
      return Math.hypot(point.x - prev.x, point.y - prev.y) >= 1.8;
    });

    x.push(simplified.map((point) => Math.round(point.x)));
    y.push(simplified.map((point) => Math.round(point.y)));
  }

  return { x, y };
}

function readProviderHeaders() {
  const rawHeaders = process.env.WHITEBOARD_RECOGNITION_HEADERS_JSON;
  if (!rawHeaders) return {};

  try {
    return JSON.parse(rawHeaders) as Record<string, string>;
  } catch {
    throw new Error("WHITEBOARD_RECOGNITION_HEADERS_JSON no contiene JSON válido.");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecognizeBody;
    const strokes = Array.isArray(body.strokes) ? body.strokes : [];
    const normalized = normalize(strokes);

    if (normalized.x.length === 0) {
      return NextResponse.json({ latex: "", text: "", confidence: null });
    }

    const endpoint = process.env.WHITEBOARD_RECOGNITION_URL;
    if (!endpoint) {
      return NextResponse.json(
        {
          error: "El proveedor de reconocimiento aún no está configurado.",
          setupRequired: true,
          strokeCount: normalized.x.length,
        },
        { status: 503 },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RECOGNITION_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...readProviderHeaders(),
      },
      body: JSON.stringify({ strokes: { strokes: normalized } }),
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error || "No fue posible reconocer los trazos." },
        { status: response.status },
      );
    }

    const rawLatex =
      typeof data?.latex_styled === "string"
        ? data.latex_styled
        : typeof data?.latex === "string"
          ? data.latex
          : "";
    const latex = normalizeLatexSource(rawLatex);
    const readable = latexToReadableText(latex);
    const providerText = typeof data?.text === "string" ? data.text.trim() : "";

    return NextResponse.json({
      latex,
      text: providerText || readable,
      renderedText: readable,
      confidence: typeof data?.confidence === "number" ? data.confidence : null,
      requestId: typeof data?.request_id === "string" ? data.request_id : null,
      strokeCount: normalized.x.length,
    });
  } catch (error) {
    console.error("[whiteboard/recognize]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible procesar la escritura matemática." },
      { status: 500 },
    );
  }
}
