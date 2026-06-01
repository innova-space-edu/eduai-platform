import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

const MODEL_ID = "fal-ai/hunyuan-video";
type SubmitResult = { request_id: string };

type FalQueueSubmitClient = {
  queue: {
    submit: (modelId: string, args: { input: Record<string, unknown> }) => Promise<unknown>;
  };
};

const falClient = fal as unknown as FalQueueSubmitClient;

export async function POST(request: Request) {
  const access = await getModelLabAccess();
  if (access.status !== "ok" || !access.user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";
    const resolution = ["480p", "580p", "720p"].includes(body.resolution) ? body.resolution : "720p";
    if (prompt.length < 3 || prompt.length > 3000) return NextResponse.json({ error: "Prompt inválido" }, { status: 400 });

    const result = await falClient.queue.submit(MODEL_ID, {
      input: { prompt, aspect_ratio: aspectRatio, resolution, num_frames: 85, enable_safety_checker: true },
    }) as SubmitResult;

    await access.supabase.from("model_lab_audit_logs").insert({
      user_id: access.user.id,
      action: "video_generation_submit",
      provider: "fal",
      model_id: MODEL_ID,
      decision: "allowed",
      metadata: { request_id: result.request_id, aspect_ratio: aspectRatio, resolution, num_frames: 85 },
    });

    return NextResponse.json({ requestId: result.request_id, model: MODEL_ID });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await access.supabase.from("model_lab_audit_logs").insert({
      user_id: access.user.id,
      action: "video_generation_submit",
      provider: "fal",
      model_id: MODEL_ID,
      decision: "failed",
      metadata: { message },
    });
    return NextResponse.json({ error: "No fue posible iniciar el video", detail: message }, { status: 502 });
  }
}
