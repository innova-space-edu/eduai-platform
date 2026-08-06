import { NextResponse } from "next/server";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

export async function GET() {
  const access = await getModelLabAccess();
  if (access.status !== "ok") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenRouter no configurado" }, { status: 503 });

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!response.ok) return NextResponse.json({ error: "No fue posible consultar modelos" }, { status: 502 });

  const payload = await response.json();
  const models = Array.isArray(payload.data)
    ? payload.data.map((model: Record<string, unknown>) => ({
        id: model.id,
        name: model.name || model.id,
        context_length: model.context_length || null,
        pricing: model.pricing || null,
      }))
    : [];

  return NextResponse.json({ models });
}
