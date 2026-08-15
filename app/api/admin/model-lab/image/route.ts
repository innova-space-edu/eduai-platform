import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

export const runtime = "nodejs";

const MODEL_ID = "fal-ai/flux/schnell";

const IMAGE_SIZES = new Set([
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9",
]);

type FluxImage = {
  url?: string;
  width?: number;
  height?: number;
  content_type?: string;
};

type FluxResult = {
  requestId: string;
  data: {
    images?: FluxImage[];
    seed?: number;
    prompt?: string;
  };
};

type FalSubscribeClient = {
  subscribe: (modelId: string, args: { input: Record<string, unknown> }) => Promise<unknown>;
};

const falClient = fal as unknown as FalSubscribeClient;

export async function POST(request: Request) {
  const access = await getModelLabAccess();
  if (access.status !== "ok" || !access.user) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  let jobId: string | null = null;

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const imageSize = IMAGE_SIZES.has(body.imageSize) ? body.imageSize : "landscape_4_3";

    if (prompt.length < 3 || prompt.length > 3000) {
      return NextResponse.json({ error: "Prompt inválido" }, { status: 400 });
    }

    const { data: job } = await access.supabase
      .from("model_lab_jobs")
      .insert({
        user_id: access.user.id,
        job_type: "image",
        provider: "fal",
        model_id: MODEL_ID,
        prompt,
        status: "running",
        metadata: { image_size: imageSize },
      })
      .select("id")
      .single();

    jobId = typeof job?.id === "string" ? job.id : null;

    const result = await falClient.subscribe(MODEL_ID, {
      input: {
        prompt,
        image_size: imageSize,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "jpeg",
      },
    }) as FluxResult;

    const outputUrl = result.data.images?.[0]?.url || null;

    if (jobId) {
      await access.supabase
        .from("model_lab_jobs")
        .update({
          status: "completed",
          external_job_id: result.requestId,
          output_path: outputUrl,
          completed_at: new Date().toISOString(),
          metadata: { image_size: imageSize, seed: result.data.seed || null },
        })
        .eq("id", jobId);
    }

    await access.supabase.from("model_lab_audit_logs").insert({
      user_id: access.user.id,
      action: "image_generation",
      provider: "fal",
      model_id: MODEL_ID,
      decision: "allowed",
      metadata: { request_id: result.requestId, image_size: imageSize, job_id: jobId },
    });

    return NextResponse.json({
      requestId: result.requestId,
      jobId,
      model: MODEL_ID,
      data: result.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";

    if (jobId) {
      await access.supabase
        .from("model_lab_jobs")
        .update({ status: "failed", completed_at: new Date().toISOString(), metadata: { message } })
        .eq("id", jobId);
    }

    await access.supabase.from("model_lab_audit_logs").insert({
      user_id: access.user.id,
      action: "image_generation",
      provider: "fal",
      model_id: MODEL_ID,
      decision: "failed",
      metadata: { message, job_id: jobId },
    });

    return NextResponse.json({ error: "No fue posible generar la imagen", detail: message }, { status: 502 });
  }
}
