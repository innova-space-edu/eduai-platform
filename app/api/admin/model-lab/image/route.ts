import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getModelLabAccess();
  if (access.status !== "ok") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  const body = await request.json();
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 3 || prompt.length > 3000) return NextResponse.json({ error: "Prompt inválido" }, { status: 400 });

  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: { prompt, image_size: "landscape_4_3", num_images: 1, enable_safety_checker: true },
  });

  return NextResponse.json({ requestId: result.requestId, data: result.data });
}
