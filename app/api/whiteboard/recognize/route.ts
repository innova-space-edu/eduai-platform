import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    x.push(points.map((point) => Math.round(point.x)));
    y.push(points.map((point) => Math.round(point.y)));
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
      return NextResponse.json({ latex: "", confidence: null });
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

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...readProviderHeaders(),
      },
      body: JSON.stringify({ strokes: { strokes: normalized } }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error || "No fue posible reconocer los trazos." },
        { status: response.status },
      );
    }

    return NextResponse.json({
      latex:
        typeof data?.latex_styled === "string"
          ? data.latex_styled
          : typeof data?.latex === "string"
            ? data.latex
            : "",
      text: typeof data?.text === "string" ? data.text : "",
      confidence: typeof data?.confidence === "number" ? data.confidence : null,
      requestId: typeof data?.request_id === "string" ? data.request_id : null,
    });
  } catch (error) {
    console.error("[whiteboard/recognize]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible procesar la escritura matemática." },
      { status: 500 },
    );
  }
}
