import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

const MODEL_ID = "fal-ai/hunyuan-video";

export async function POST(request: Request) {
  const access = await getModelLabAccess();
  if (access.status !== "ok") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  const body = await request.json();
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 3 || prompt.length > 3000) return NextResponse.json({ error: "Prompt inválido" }, { status: 400 });

  const result = await fal.queue.submit(MODEL_ID, {
    input: {
      prompt,
      aspect_ratio: body.aspectRatio === "9:16" ? "9:16" : "16:9",
      resolution: ["480p", "580p", "720p"].includes(body.resolution) ? body.resolution : "720p",
      num_frames: 85,
      enable_safety_checker: true,
    },
  });

  return NextResponse.json({ requestId: result.request_id, model: MODEL_ID });
}
