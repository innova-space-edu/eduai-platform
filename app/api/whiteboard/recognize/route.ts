import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { latexToReadableText, normalizeLatexSource } from "@/lib/exam/latex-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const RECOGNITION_TIMEOUT_MS = clampNumber(
  Number(process.env.WHITEBOARD_RECOGNITION_TIMEOUT_MS || 4200),
  1800,
  9000,
);
const CACHE_TTL_MS = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_CACHE_TTL_MS || 12000), 0, 60000);
const MAX_CACHE_ITEMS = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_CACHE_ITEMS || 200), 20, 1000);
const MAX_STROKES = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_MAX_STROKES || 180), 10, 600);
const MAX_POINTS_PER_STROKE = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_MAX_POINTS_PER_STROKE || 90), 12, 400);
const MIN_POINT_DISTANCE = clampNumber(Number(process.env.WHITEBOARD_RECOGNITION_MIN_POINT_DISTANCE || 3.2), 0.5, 12);

type Point = { x: number; y: number };
type Stroke = { points: Point[] };
type RecognizeBody = { strokes?: Stroke[] };
type NormalizedStrokes = { x: number[][]; y: number[][] };
type CacheEntry = { expiresAt: number; payload: Record<string, unknown> };

const recognitionCache = new Map<string, CacheEntry>();

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function compactStrokePoints(points: Point[]) {
  const cleaned: Point[] = [];

  for (const point of points) {
    if (!point || !isNumber(point.x) || !isNumber(point.y)) continue;
    const rounded = { x: Math.round(point.x), y: Math.round(point.y) };
    const previous = cleaned[cleaned.length - 1];
    if (!previous || Math.hypot(rounded.x - previous.x, rounded.y - previous.y) >= MIN_POINT_DISTANCE) {
      cleaned.push(rounded);
    }
  }

  if (cleaned.length <= MAX_POINTS_PER_STROKE) return cleaned;

  const sampled: Point[] = [];
  const step = (cleaned.length - 1) / (MAX_POINTS_PER_STROKE - 1);
  for (let index = 0; index < MAX_POINTS_PER_STROKE; index += 1) {
    sampled.push(cleaned[Math.round(index * step)]);
  }
  return sampled;
}

function normalize(strokes: Stroke[]): NormalizedStrokes {
  const x: number[][] = [];
  const y: number[][] = [];

  for (const stroke of strokes.slice(0, MAX_STROKES)) {
    if (!stroke || !Array.isArray(stroke.points)) continue;
    const points = compactStrokePoints(stroke.points);
    if (points.length < 2) continue;
    x.push(points.map((point) => point.x));
    y.push(points.map((point) => point.y));
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

function buildProviderPayload(strokes: NormalizedStrokes) {
  const mode = String(process.env.WHITEBOARD_RECOGNITION_PAYLOAD_MODE || "mathpix").trim().toLowerCase();
  const formats = String(process.env.WHITEBOARD_RECOGNITION_FORMATS || "latex_styled,text")
    .split(",")
    .map((format) => format.trim())
    .filter(Boolean);

  if (mode === "legacy-nested") {
    return { strokes: { strokes }, ...(formats.length ? { formats } : {}) };
  }

  if (mode === "raw") {
    return strokes;
  }

  return { strokes, ...(formats.length ? { formats } : {}) };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeProviderLatex(data: any) {
  const rawLatex = firstString(
    data?.latex_styled,
    data?.latex,
    data?.result?.latex_styled,
    data?.result?.latex,
    data?.data?.latex_styled,
    data?.data?.latex,
  );
  const latex = normalizeLatexSource(rawLatex);
  const readable = latexToReadableText(latex);
  const providerText = firstString(data?.text, data?.result?.text, data?.data?.text);
  const confidence = firstNumber(
    data?.confidence,
    data?.confidence_rate,
    data?.result?.confidence,
    data?.result?.confidence_rate,
    data?.data?.confidence,
  );

  return {
    latex,
    text: providerText || readable,
    renderedText: readable,
    confidence,
    requestId: firstString(data?.request_id, data?.requestId, data?.result?.request_id) || null,
  };
}

function cacheKeyFor(strokes: NormalizedStrokes) {
  return createHash("sha256").update(JSON.stringify(strokes)).digest("hex");
}

function readCache(key: string) {
  if (!CACHE_TTL_MS) return null;
  const entry = recognitionCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    recognitionCache.delete(key);
    return null;
  }
  return entry.payload;
}

function writeCache(key: string, payload: Record<string, unknown>) {
  if (!CACHE_TTL_MS) return;
  recognitionCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  while (recognitionCache.size > MAX_CACHE_ITEMS) {
    const oldest = recognitionCache.keys().next().value;
    if (!oldest) break;
    recognitionCache.delete(oldest);
  }
}

function pointCount(strokes: NormalizedStrokes) {
  return strokes.x.reduce((sum, points) => sum + points.length, 0);
}

function softFailure(message: string, strokes: NormalizedStrokes, extra: Record<string, unknown> = {}) {
  return {
    latex: "",
    text: "",
    renderedText: "",
    confidence: null,
    strokeCount: strokes.x.length,
    pointCount: pointCount(strokes),
    cacheHit: false,
    recognitionAvailable: false,
    warning: message,
    ...extra,
  };
}

export async function POST(request: Request) {
  let normalizedForCatch: NormalizedStrokes | null = null;
  let keyForCatch = "";

  try {
    const body = (await request.json()) as RecognizeBody;
    const strokes = Array.isArray(body.strokes) ? body.strokes : [];
    const normalized = normalize(strokes);
    normalizedForCatch = normalized;

    if (normalized.x.length === 0) {
      return NextResponse.json({ latex: "", text: "", confidence: null, strokeCount: 0, recognitionAvailable: true });
    }

    const key = cacheKeyFor(normalized);
    keyForCatch = key;
    const cached = readCache(key);
    if (cached) {
      return NextResponse.json({ ...cached, cacheHit: true });
    }

    const endpoint = process.env.WHITEBOARD_RECOGNITION_URL;
    if (!endpoint) {
      return NextResponse.json(softFailure("El reconocimiento automático aún no está configurado. Los trazos se guardaron como evidencia.", normalized, { setupRequired: true }));
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...readProviderHeaders(),
      },
      body: JSON.stringify(buildProviderPayload(normalized)),
      cache: "no-store",
      signal: AbortSignal.timeout(RECOGNITION_TIMEOUT_MS),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = firstString(data?.error, data?.message, data?.result?.error, data?.data?.error) || "No fue posible reconocer los trazos.";
      const payload = softFailure(message, normalized, { providerStatus: response.status });
      writeCache(key, payload);
      return NextResponse.json(payload);
    }

    const normalizedResponse = normalizeProviderLatex(data);
    const payload = {
      ...normalizedResponse,
      strokeCount: normalized.x.length,
      pointCount: pointCount(normalized),
      cacheHit: false,
      recognitionAvailable: true,
    };

    writeCache(key, payload);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[whiteboard/recognize]", error);
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const message = isTimeout
      ? "El reconocimiento tardó demasiado. Los trazos quedaron guardados; intenta Actualizar LaTeX nuevamente."
      : error instanceof Error
        ? error.message
        : "No fue posible procesar la escritura matemática.";

    if (normalizedForCatch) {
      const payload = softFailure(message, normalizedForCatch, { providerTimeout: isTimeout });
      if (keyForCatch) writeCache(keyForCatch, payload);
      return NextResponse.json(payload);
    }

    return NextResponse.json({ error: message }, { status: isTimeout ? 504 : 500 });
  }
}
