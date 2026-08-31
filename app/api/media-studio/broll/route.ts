import { NextRequest, NextResponse } from "next/server";
import { callAIv5 } from "@/lib/ai-router-v5";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cue = { start: number; end: number; text: string };

type Suggestion = {
  at: number;
  duration: number;
  query: string;
  reason: string;
};

function parseJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La IA no devolvió JSON válido");
  return JSON.parse(fenced.slice(start, end + 1));
}

function sanitize(value: any, maxTime: number): Suggestion[] {
  const raw = Array.isArray(value?.suggestions) ? value.suggestions : [];
  return raw
    .map((item: any) => ({
      at: Math.max(0, Math.min(maxTime, Number(item?.at) || 0)),
      duration: Math.max(1.5, Math.min(8, Number(item?.duration) || 4)),
      query: String(item?.query || "").trim().slice(0, 100),
      reason: String(item?.reason || "Apoyo visual").trim().slice(0, 180),
    }))
    .filter((item: Suggestion) => item.query)
    .slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cues = (Array.isArray(body?.cues) ? body.cues : []) as Cue[];
    if (!cues.length) return NextResponse.json({ error: "No hay transcripción para analizar" }, { status: 400 });

    const compact = cues.slice(0, 80).map((cue) => ({
      start: Math.max(0, Number(cue.start) || 0),
      end: Math.max(0, Number(cue.end) || 0),
      text: String(cue.text || "").slice(0, 300),
    }));
    const maxTime = Math.max(...compact.map((cue) => cue.end), 0);

    const system = `Eres el director de B-roll de EDUAI. Recibes una transcripción con tiempos y propones imágenes o videos de apoyo que sean concretos, educativos y fáciles de encontrar en bancos de stock. Evita nombres de personas privadas, marcas innecesarias y consultas abstractas. Devuelve SOLO JSON {"suggestions":[{"at":segundos,"duration":segundos,"query":"consulta breve en inglés o español","reason":"por qué ayuda"}]}. Máximo 10 sugerencias. Separa sugerencias al menos 3 segundos y prioriza conceptos visuales importantes.`;

    const response = await callAIv5([
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ language: body?.language || "es", cues: compact }) },
    ], { task: "reasoning", maxTokens: 1800 });

    return NextResponse.json({ suggestions: sanitize(parseJson(response.text), maxTime), provider: response.provider, model: response.model });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo generar B-roll" }, { status: 500 });
  }
}
