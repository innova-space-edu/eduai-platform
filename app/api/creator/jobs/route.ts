import { after, NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const HEADERS = { "Cache-Control": "no-store, max-age=0" }
const MAX_REQUEST_BYTES = 24 * 1024 * 1024

const ENDPOINTS: Record<string, string> = {
  "generate-material": "/api/process-content",
  "educational-document": "/api/creator/educational-document",
  "source-studio": "/api/creator/source-studio",
  transform: "/api/creator/transform",
  "quality-review": "/api/creator/quality-review",
  "comic-storyboard": "/api/creator/comics/storyboard",
}

const STAGES: Record<string, string[]> = {
  "generate-material": ["Analizando la fuente", "Estructurando el contenido", "Preparando el material"],
  "educational-document": ["Leyendo la fuente", "Alineando objetivos y actividades", "Construyendo el documento"],
  "source-studio": ["Leyendo las fuentes", "Comparando evidencia", "Preparando citas y bibliografía"],
  transform: ["Analizando el material", "Adaptando la estructura", "Creando el nuevo formato"],
  "quality-review": ["Revisando contenido", "Evaluando pedagogía", "Preparando recomendaciones"],
  "comic-storyboard": ["Diseñando personajes", "Organizando la trama", "Preparando las viñetas"],
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

async function executeJob({
  jobId,
  userId,
  type,
  requestPayload,
  origin,
  cookie,
}: {
  jobId: string
  userId: string
  type: string
  requestPayload: unknown
  origin: string
  cookie: string
}) {
  const supabase = await createClient()
  const stages = STAGES[type] || ["Procesando"]

  const update = async (patch: Record<string, unknown>) => {
    await supabase
      .from("creator_hub_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("user_id", userId)
  }

  try {
    await update({ status: "running", progress: 10, stage: stages[0], started_at: new Date().toISOString(), attempts: 1 })
    const endpoint = ENDPOINTS[type]
    if (!endpoint) throw new Error("Tipo de trabajo no compatible")

    const stageTimers = stages.slice(1).map((stage, index) => setTimeout(() => {
      void update({ progress: Math.min(85, 35 + index * 25), stage })
    }, 8_000 + index * 12_000))

    const response = await fetch(`${origin}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-Creator-Job-Id": jobId,
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(270_000),
    })
    stageTimers.forEach(clearTimeout)

    const raw = await response.text()
    let payload: any
    try { payload = JSON.parse(raw) } catch { payload = { error: raw.slice(0, 1000) } }

    const { data: current } = await supabase
      .from("creator_hub_jobs")
      .select("status")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle()
    if (current?.status === "cancelled") return

    if (!response.ok) throw new Error(payload?.error || payload?.message || `La tarea respondió HTTP ${response.status}`)

    await update({
      status: "completed",
      progress: 100,
      stage: "Completado",
      result: payload,
      error: null,
      completed_at: new Date().toISOString(),
    })
  } catch (error) {
    await update({
      status: "failed",
      stage: "Falló",
      error: error instanceof Error ? error.message.slice(0, 2000) : "Error inesperado",
      completed_at: new Date().toISOString(),
    })
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const id = request.nextUrl.searchParams.get("id")
  const query = supabase
    .from("creator_hub_jobs")
    .select("id, type, title, status, progress, stage, result, error, project_id, attempts, started_at, completed_at, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const { data, error } = id ? await query.eq("id", id).maybeSingle() : await query.limit(100)
  if (error) {
    const message = error.code === "42P01"
      ? "Falta aplicar la migración 202607260003_creator_hub_jobs.sql en Supabase."
      : error.message
    return NextResponse.json({ error: message }, { status: 500, headers: HEADERS })
  }
  return NextResponse.json(id ? { job: data } : { jobs: data || [] }, { headers: HEADERS })
}

export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") || 0)
  if (declared > MAX_REQUEST_BYTES) return NextResponse.json({ error: "La tarea supera el límite de 24 MB." }, { status: 413, headers: HEADERS })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const body = await request.json().catch(() => null)
  const type = clean(body?.type, 80)
  const title = clean(body?.title, 240) || "Trabajo de Creator Hub"
  const requestPayload = body?.request
  if (!ENDPOINTS[type]) return NextResponse.json({ error: "Tipo de trabajo no compatible." }, { status: 400, headers: HEADERS })
  if (!requestPayload || typeof requestPayload !== "object") return NextResponse.json({ error: "Falta la solicitud de la tarea." }, { status: 400, headers: HEADERS })

  const { data, error } = await supabase
    .from("creator_hub_jobs")
    .insert({ user_id: user.id, type, title, request: requestPayload, status: "queued", progress: 0, stage: "En cola" })
    .select("id, type, title, status, progress, stage, created_at")
    .single()

  if (error) {
    const message = error.code === "42P01"
      ? "Falta aplicar la migración 202607260003_creator_hub_jobs.sql en Supabase."
      : error.message
    return NextResponse.json({ error: message }, { status: 500, headers: HEADERS })
  }

  const origin = request.nextUrl.origin
  const cookie = request.headers.get("cookie") || ""
  after(() => executeJob({ jobId: data.id, userId: user.id, type, requestPayload, origin, cookie }))

  return NextResponse.json({ job: data }, { status: 202, headers: HEADERS })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const body = await request.json().catch(() => null)
  const id = clean(body?.id, 80)
  const action = clean(body?.action, 40)
  if (!id) return NextResponse.json({ error: "Falta el trabajo." }, { status: 400, headers: HEADERS })

  if (action === "cancel") {
    const { data, error } = await supabase
      .from("creator_hub_jobs")
      .update({ status: "cancelled", stage: "Cancelado", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .in("status", ["queued", "running"])
      .select("id, status, stage")
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: HEADERS })
    return NextResponse.json({ job: data }, { headers: HEADERS })
  }

  return NextResponse.json({ error: "Acción no compatible." }, { status: 400, headers: HEADERS })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Falta el trabajo." }, { status: 400, headers: HEADERS })
  const { error } = await supabase.from("creator_hub_jobs").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: HEADERS })
  return NextResponse.json({ ok: true }, { headers: HEADERS })
}
