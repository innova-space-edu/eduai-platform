import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

const MODEL_ID = "fal-ai/hunyuan-video";

type QueueStatus = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  request_id?: string;
  queue_position?: number;
  error?: string;
  error_type?: string;
};

type VideoResult = {
  data: {
    video?: { url?: string };
    seed?: number;
  };
};

export async function GET(request: Request) {
  const access = await getModelLabAccess();
  if (access.status !== "ok") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId") || "";
    if (!requestId) return NextResponse.json({ error: "requestId requerido" }, { status: 400 });

    if (searchParams.get("result") === "1") {
      const result = await fal.queue.result(MODEL_ID, { requestId }) as VideoResult;
      return NextResponse.json({ requestId, data: result.data });
    }

    const status = await fal.queue.status(MODEL_ID, { requestId, logs: false }) as QueueStatus;
    if (status.status === "COMPLETED" && status.error) {
      return NextResponse.json({ error: status.error, errorType: status.error_type || "provider_error" }, { status: 502 });
    }

    return NextResponse.json({ requestId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: "No fue posible consultar el video", detail: message }, { status: 502 });
  }
}
