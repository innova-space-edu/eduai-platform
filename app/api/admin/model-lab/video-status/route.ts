import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

const MODEL_ID = "fal-ai/hunyuan-video";

export async function GET(request: Request) {
  const access = await getModelLabAccess();
  if (access.status !== "ok") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId") || "";
  if (!requestId) return NextResponse.json({ error: "requestId requerido" }, { status: 400 });

  if (searchParams.get("result") === "1") {
    const result = await fal.queue.result(MODEL_ID, { requestId });
    return NextResponse.json({ requestId, data: result.data });
  }

  const status = await fal.queue.status(MODEL_ID, { requestId, logs: false });
  return NextResponse.json({ requestId, status });
}
