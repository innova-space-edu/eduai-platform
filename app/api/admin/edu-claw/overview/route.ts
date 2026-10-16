import { NextRequest, NextResponse } from "next/server";
import { requireIncidentAdmin, getEduClawSnapshot } from "@/lib/admin/edu-claw-incidents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "private, no-store" };

export async function GET() {
  const gate = await requireIncidentAdmin();
  if (!gate.ok || !gate.client) {
    return NextResponse.json({ error: gate.status === 401 ? "No autenticado" : "Sin acceso administrativo" },
      { status: gate.status, headers: HEADERS });
  }
  try {
    return NextResponse.json(await getEduClawSnapshot(gate.client), { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Supervisión temporalmente no disponible. Comprueba la migración de Supabase." },
      { status: 503, headers: HEADERS });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireIncidentAdmin();
  if (!gate.ok || !gate.client) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: gate.status, headers: HEADERS });
  }
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" && /^[a-f0-9-]{36}$/i.test(body.id) ? body.id : null;
  const status = body?.status;
  const resource = body?.resource;
  if (!id || (resource !== "incident" && resource !== "task")) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400, headers: HEADERS });
  }
  const now = new Date().toISOString();
  if (resource === "incident") {
    if (!["open", "acknowledged", "resolved"].includes(status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400, headers: HEADERS });
    }
    const { data, error } = await gate.client.from("eduai_admin_incidents")
      .update({
        status, updated_at: now,
        acknowledged_at: status === "acknowledged" ? now : null,
        resolved_at: status === "resolved" ? now : null,
      }).eq("id", id).select("id,status").maybeSingle();
    if (error) return NextResponse.json({ error: "No fue posible actualizar el incidente" }, { status: 500, headers: HEADERS });
    if (!data) return NextResponse.json({ error: "Incidente no encontrado" }, { status: 404, headers: HEADERS });
    return NextResponse.json({ ok: true, data }, { headers: HEADERS });
  }
  if (!["pending", "in_progress", "completed", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400, headers: HEADERS });
  }
  const { data, error } = await gate.client.from("eduai_admin_tasks")
    .update({ status, updated_at: now, completed_at: status === "completed" ? now : null })
    .eq("id", id).select("id,status").maybeSingle();
  if (error) return NextResponse.json({ error: "No fue posible actualizar la tarea" }, { status: 500, headers: HEADERS });
  if (!data) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404, headers: HEADERS });
  return NextResponse.json({ ok: true, data }, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  const gate = await requireIncidentAdmin();
  if (!gate.ok || !gate.client) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: gate.status, headers: HEADERS });
  }
  const body = await request.json().catch(() => null);
  const key = typeof body?.task_key === "string" ? body.task_key.trim().slice(0, 80) : "";
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 160) : "";
  const module = typeof body?.module === "string" ? body.module.trim().slice(0, 80) : "";
  const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 500) : "";
  const priority = ["low","medium","high","critical"].includes(body?.priority) ? body.priority : "medium";
  if (!/^[a-z0-9][a-z0-9:_-]{4,79}$/.test(key) || !title || !module) {
    return NextResponse.json({ error: "Tarea inválida" }, { status: 400, headers: HEADERS });
  }
  const { data, error } = await gate.client.from("eduai_admin_tasks").upsert({
    task_key: key, title, module, detail, priority, status: "pending", updated_at: new Date().toISOString(),
  }, { onConflict: "task_key" }).select("id,status").maybeSingle();
  if (error) return NextResponse.json({ error: "No fue posible guardar la tarea" }, { status: 500, headers: HEADERS });
  return NextResponse.json({ ok: true, data }, { headers: HEADERS });
}
