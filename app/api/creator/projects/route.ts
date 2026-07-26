import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
}

function cleanText(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function normalizeProject(row: any) {
  return {
    id: row.id,
    format: row.format,
    title: row.title,
    data: row.data,
    accentColor: row.accent_color || undefined,
    designTemplateId: row.design_template_id || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    status: row.status,
    currentVersion: row.current_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function databaseUnavailable(error: any) {
  return error?.code === "42P01" || /creator_hub_projects/i.test(String(error?.message || ""))
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_CACHE_HEADERS })

  const projectId = request.nextUrl.searchParams.get("projectId")
  const includeVersions = request.nextUrl.searchParams.get("versions") === "1"

  if (projectId) {
    const { data, error } = await supabase
      .from("creator_hub_projects")
      .select("id, format, title, data, accent_color, design_template_id, thumbnail_url, status, current_version, created_at, updated_at")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      const status = databaseUnavailable(error) ? 503 : 500
      return NextResponse.json({ error: databaseUnavailable(error) ? "La sincronización de Creator Hub aún no está instalada en Supabase." : error.message }, { status, headers: NO_CACHE_HEADERS })
    }
    if (!data) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404, headers: NO_CACHE_HEADERS })

    let versions: any[] = []
    if (includeVersions) {
      const response = await supabase
        .from("creator_hub_project_versions")
        .select("id, version_no, title, note, created_at")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .order("version_no", { ascending: false })
        .limit(50)
      if (!response.error) versions = response.data || []
    }

    return NextResponse.json({ project: normalizeProject(data), versions }, { headers: NO_CACHE_HEADERS })
  }

  const { data, error } = await supabase
    .from("creator_hub_projects")
    .select("id, format, title, data, accent_color, design_template_id, thumbnail_url, status, current_version, created_at, updated_at")
    .eq("user_id", user.id)
    .neq("status", "trashed")
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) {
    const status = databaseUnavailable(error) ? 503 : 500
    return NextResponse.json({ projects: [], error: databaseUnavailable(error) ? "La sincronización de Creator Hub aún no está instalada en Supabase." : error.message }, { status, headers: NO_CACHE_HEADERS })
  }

  return NextResponse.json({ projects: (data || []).map(normalizeProject) }, { headers: NO_CACHE_HEADERS })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_CACHE_HEADERS })

  const body = await request.json().catch(() => null)
  const id = cleanText(body?.id, 80)
  const format = cleanText(body?.format, 80)
  const title = cleanText(body?.title) || "Material sin título"
  if (!id || !format || !body?.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "Proyecto inválido" }, { status: 400, headers: NO_CACHE_HEADERS })
  }

  const payload = {
    id,
    user_id: user.id,
    format,
    title,
    data: body.data,
    accent_color: cleanText(body?.accentColor, 32) || null,
    design_template_id: cleanText(body?.designTemplateId, 160) || null,
    status: "draft",
    current_version: 1,
  }

  const { data, error } = await supabase
    .from("creator_hub_projects")
    .upsert(payload, { onConflict: "id" })
    .select("id, format, title, data, accent_color, design_template_id, thumbnail_url, status, current_version, created_at, updated_at")
    .single()

  if (error) {
    const status = databaseUnavailable(error) ? 503 : 500
    return NextResponse.json({ error: databaseUnavailable(error) ? "La sincronización de Creator Hub aún no está instalada en Supabase." : error.message }, { status, headers: NO_CACHE_HEADERS })
  }

  await supabase.from("creator_hub_project_versions").upsert({
    project_id: id,
    user_id: user.id,
    version_no: 1,
    title,
    data: body.data,
    accent_color: payload.accent_color,
    design_template_id: payload.design_template_id,
    note: "Generación inicial",
  }, { onConflict: "project_id,version_no" })

  return NextResponse.json({ project: normalizeProject(data) }, { status: 201, headers: NO_CACHE_HEADERS })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_CACHE_HEADERS })

  const body = await request.json().catch(() => null)
  const id = cleanText(body?.id, 80)
  if (!id) return NextResponse.json({ error: "Falta el proyecto" }, { status: 400, headers: NO_CACHE_HEADERS })

  const update: Record<string, unknown> = {}
  if (typeof body?.title === "string") update.title = cleanText(body.title) || "Material sin título"
  if (body?.data && typeof body.data === "object") update.data = body.data
  if (typeof body?.accentColor === "string") update.accent_color = cleanText(body.accentColor, 32) || null
  if (typeof body?.designTemplateId === "string") update.design_template_id = cleanText(body.designTemplateId, 160) || null
  if (["draft", "final", "archived", "trashed"].includes(body?.status)) update.status = body.status

  const { data: current, error: currentError } = await supabase
    .from("creator_hub_projects")
    .select("id, current_version, title, data, accent_color, design_template_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (currentError || !current) {
    const unavailable = databaseUnavailable(currentError)
    return NextResponse.json({ error: unavailable ? "La sincronización de Creator Hub aún no está instalada en Supabase." : currentError?.message || "Proyecto no encontrado" }, { status: unavailable ? 503 : 404, headers: NO_CACHE_HEADERS })
  }

  let nextVersion = current.current_version
  if (body?.createVersion === true) {
    nextVersion += 1
    update.current_version = nextVersion
  }

  const { data, error } = await supabase
    .from("creator_hub_projects")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, format, title, data, accent_color, design_template_id, thumbnail_url, status, current_version, created_at, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })

  if (body?.createVersion === true) {
    await supabase.from("creator_hub_project_versions").insert({
      project_id: id,
      user_id: user.id,
      version_no: nextVersion,
      title: data.title,
      data: data.data,
      accent_color: data.accent_color,
      design_template_id: data.design_template_id,
      note: cleanText(body?.note, 240) || `Versión ${nextVersion}`,
    })
  }

  return NextResponse.json({ project: normalizeProject(data) }, { headers: NO_CACHE_HEADERS })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_CACHE_HEADERS })
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Falta el proyecto" }, { status: 400, headers: NO_CACHE_HEADERS })

  const { error } = await supabase.from("creator_hub_projects").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })
  return NextResponse.json({ ok: true }, { headers: NO_CACHE_HEADERS })
}
