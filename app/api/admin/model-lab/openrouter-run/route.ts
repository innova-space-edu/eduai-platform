import { NextResponse } from "next/server";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type OpenRouterPayload = {
  id?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: Record<string, unknown>;
  error?: { code?: number | string; message?: string };
};

function getProviderDetail(payload: OpenRouterPayload, status: number) {
  const message = typeof payload.error?.message === "string" ? payload.error.message.slice(0, 500) : "Error no especificado";
  const code = payload.error?.code ? String(payload.error.code).slice(0, 80) : String(status);
  return `OpenRouter ${code}: ${message}`;
}

export async function POST(request: Request) {
  const access = await getModelLabAccess();
  if (access.status !== "ok" || !access.user) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenRouter no configurado" }, { status: 503 });

  let selectedModel = "";

  try {
    const body = await request.json();
    const model = typeof body.model === "string" ? body.model.trim() : "";
    selectedModel = model;
    const rawMessages: unknown[] = Array.isArray(body.messages) ? body.messages : [];
    const temperature = typeof body.temperature === "number" && body.temperature >= 0 && body.temperature <= 2 ? body.temperature : 0.7;

    const messages: ChatMessage[] = rawMessages
      .filter((item: unknown): item is ChatMessage => {
        if (!item || typeof item !== "object") return false;
        const value = item as Record<string, unknown>;
        return ["user", "assistant"].includes(String(value.role)) && typeof value.content === "string";
      })
      .slice(-12)
      .map((item: ChatMessage) => ({ role: item.role, content: item.content.trim().slice(0, 6000) }));

    if (!model || model.length > 300) return NextResponse.json({ error: "Modelo inválido" }, { status: 400 });
    if (!messages.length || !messages[messages.length - 1]?.content) return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://eduai.cl",
        "X-OpenRouter-Title": "EduAI Model Lab",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 1200,
        messages: [
          { role: "system", content: "Laboratorio privado de evaluación EduAI. Sigue las políticas mínimas de seguridad de la plataforma y responde con claridad." },
          ...messages,
        ],
      }),
      cache: "no-store",
    });

    const payload = await response.json() as OpenRouterPayload;
    if (!response.ok) {
      const detail = getProviderDetail(payload, response.status);
      await access.supabase.from("model_lab_audit_logs").insert({
        user_id: access.user.id,
        action: "chat_completion",
        provider: "openrouter",
        model_id: model,
        decision: "failed",
        metadata: { status: response.status, detail },
      });
      return NextResponse.json({ error: "OpenRouter rechazó la solicitud", detail }, { status: 502 });
    }

    const answer = payload.choices?.[0]?.message?.content || "";
    const prompt = messages[messages.length - 1]?.content || "";

    const { data: job } = await access.supabase
      .from("model_lab_jobs")
      .insert({
        user_id: access.user.id,
        job_type: "chat",
        provider: "openrouter",
        model_id: model,
        prompt,
        status: "completed",
        external_job_id: payload.id || null,
        completed_at: new Date().toISOString(),
        metadata: { usage: payload.usage || null, temperature },
      })
      .select("id")
      .single();

    await access.supabase.from("model_lab_audit_logs").insert({
      user_id: access.user.id,
      action: "chat_completion",
      provider: "openrouter",
      model_id: model,
      decision: "allowed",
      metadata: { request_id: payload.id || null, job_id: job?.id || null },
    });

    return NextResponse.json({ answer, model, requestId: payload.id || null, usage: payload.usage || null });
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 500) : "Error desconocido";
    await access.supabase.from("model_lab_audit_logs").insert({
      user_id: access.user.id,
      action: "chat_completion",
      provider: "openrouter",
      model_id: selectedModel || null,
      decision: "failed",
      metadata: { detail },
    });
    return NextResponse.json({ error: "No fue posible completar el chat", detail }, { status: 502 });
  }
}
