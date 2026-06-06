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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecognizeBody;
    const strokes = Array.isArray(body.strokes) ? body.strokes : [];
    const normalized = normalize(strokes);

    if (normalized.x.length === 0) {
      return NextResponse.json({ latex: "", confidence: null });
    }

    return NextResponse.json(
      {
        error: "El proveedor de reconocimiento aún no está configurado.",
        setupRequired: true,
        strokeCount: normalized.x.length,
      },
      { status: 503 },
    );
  } catch (error) {
    console.error("[whiteboard/recognize]", error);
    return NextResponse.json(
      { error: "No fue posible procesar la escritura matemática." },
      { status: 500 },
    );
  }
}
