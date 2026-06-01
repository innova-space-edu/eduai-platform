import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  const access = await getModelLabAccess();
  if (access.status !== "ok" || !access.user) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const imageSize = IMAGE_SIZES.has(body.imageSize) ? body.imageSize : "landscape_4_3";

    if (prompt.length < 3 || prompt.length > 3000) {
      return NextResponse.json({ error: "Prompt inválido" }, { status: 400 });
    }

    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt,
        image_size: imageSize,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "jpeg",
      },
    }) as FluxResult;

    await access.supabase.from("model_lab_audit_logs").insert({
      user_id: access.user.id,
      action: "image_generation",
      provider: "fal",
      model_id: "fal-ai/flux/schnell",
      decision: "allowed",
      metadata: { request_id: result.requestId, image_size: imageSize },
    });

    return NextResponse.json({
      requestId: result.requestId,
      model: "fal-ai/flux/schnell",
      data: result.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";

    await access.supabase.from("model_lab_audit_logs").insert({
      user_id: access.user.id,
      action: "image_generation",
      provider: "fal",
      model_id: "fal-ai/flux/schnell",
      decision: "failed",
      metadata: { message },
    });

    return NextResponse.json({ error: "No fue posible generar la imagen", detail: message }, { status: 502 });
  }
}
