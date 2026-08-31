import { NextRequest, NextResponse } from "next/server";
import { callAIv5 } from "@/lib/ai-router-v5";
import type { MediaAIPlan, MediaStudioProject } from "@/lib/media-studio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("El agente no devolvió un plan JSON válido");
  return JSON.parse(source.slice(start, end + 1));
}

function sanitizePlan(value: any): MediaAIPlan {
  const allowed = new Set(["add_text","set_volume","mute_clip","change_speed","move_clip","resize_clip","delete_clip","split_clip","set_aspect_ratio","suggest_media"]);
  const commands = Array.isArray(value?.commands) ? value.commands.filter((item: any) => item && allowed.has(item.action)).slice(0, 12) : [];
  return { summary: typeof value?.summary === "string" ? value.summary.slice(0, 600) : "Plan preparado.", commands } as MediaAIPlan;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const instruction = String(body?.instruction || "").trim();
    const project = body?.project as MediaStudioProject | undefined;
    if (!instruction || !project?.tracks) return NextResponse.json({ error: "Instrucción o proyecto inválido" }, { status: 400 });

    const compactTimeline = project.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      kind: track.kind,
      clips: track.clips.map((clip) => ({ id: clip.id, name: clip.name, type: clip.type, start: clip.start, duration: clip.duration, volume: clip.volume, muted: clip.muted, playbackRate: clip.playbackRate, text: clip.text })),
    }));

    const system = `Eres Media AI, agente de edición audiovisual de EDUAI. Convierte la instrucción del usuario en un plan JSON estricto y reversible. No inventes clipId: usa solamente IDs presentes. Acciones permitidas: add_text, set_volume, mute_clip, change_speed, move_clip, resize_clip, delete_clip, split_clip, set_aspect_ratio, suggest_media. Para add_text usa text y opcional at. Para set_volume usa clipId y value entre 0 y 1. Para mute_clip usa clipId y value booleano. Para change_speed usa clipId y value 0.25-4. Para move_clip usa clipId y value como segundo de inicio. Para split_clip usa clipId y at. Para set_aspect_ratio value debe ser 16:9, 9:16, 1:1 o 4:5. Para suggest_media usa query. Devuelve SOLO JSON con {"summary":"...","commands":[...]}. Si una solicitud requiere una función todavía no implementada, explica brevemente en summary y devuelve las acciones posibles sin fingir que se ejecutó lo imposible.`;

    const response = await callAIv5([
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ instruction, selectedClipId: body?.selectedClipId || null, playhead: Number(body?.playhead || 0), project: { aspectRatio: project.aspectRatio, duration: project.duration, tracks: compactTimeline } }) },
    ], { task: "reasoning", maxTokens: 1800 });

    const plan = sanitizePlan(extractJson(response.text));
    return NextResponse.json({ plan, provider: response.provider, model: response.model });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo ejecutar Media AI" }, { status: 500 });
  }
}
