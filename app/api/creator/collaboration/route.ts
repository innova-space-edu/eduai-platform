import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEADERS = { "Cache-Control": "no-store, max-age=0" }

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const projectId = request.nextUrl.searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400, headers: HEADERS })

  const { data: access } = await supabase.rpc("creator_hub_can_access_project", {
    p_project_id: projectId,
    p_required_permission: "view",
  })
  if (!access) return NextResponse.json({ error: "No tienes acceso a este proyecto o falta aplicar la migración de colaboración." }, { status: 403, headers: HEADERS })

  const [collaboratorsResult, commentsResult, linksResult] = await Promise.all([
    supabase
      .from("creator_hub_project_collaborators")
      .select("id, collaborator_id, permission, invited_email, created_at, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("creator_hub_project_comments")
      .select("id, user_id, parent_id, block_path, body, resolved, created_at, updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(300),
    supabase
      .from("creator_hub_project_share_links")
      .select("id, token, permission, expires_at, is_active, created_at, updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ])

  const firstError = collaboratorsResult.error || commentsResult.error || linksResult.error
  if (firstError) {
    return NextResponse.json({
      error: firstError.code === "42P01" || firstError.code === "42883"
        ? "Falta aplicar la migración 202607260002_creator_hub_collaboration.sql en Supabase."
        : firstError.message,
    }, { status: 500, headers: HEADERS })
  }

  return NextResponse.json({
    collaborators: collaboratorsResult.data || [],
    comments: commentsResult.data || [],
    shareLinks: linksResult.data || [],
  }, { headers: HEADERS })
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const body = await request.json().catch(() => null)
  const action = clean(body?.action, 40)
  const projectId = clean(body?.projectId, 80)
  if (!projectId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400, headers: HEADERS })

  try {
    if (action === "invite") {
      const email = clean(body?.email, 320).toLowerCase()
      const permission = ["view", "comment", "edit"].includes(body?.permission) ? body.permission : "view"
      if (!email || !email.includes("@")) return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400, headers: HEADERS })
      const { data, error } = await supabase.rpc("creator_hub_invite_collaborator", {
        p_project_id: projectId,
        p_email: email,
        p_permission: permission,
      })
      if (error) throw error
      return NextResponse.json({ collaborator: data }, { status: 201, headers: HEADERS })
    }

    if (action === "comment") {
      const bodyText = clean(body?.body, 4000)
      const blockPath = clean(body?.blockPath, 500) || null
      const parentId = clean(body?.parentId, 80) || null
      if (!bodyText) return NextResponse.json({ error: "El comentario está vacío." }, { status: 400, headers: HEADERS })
      const { data, error } = await supabase
        .from("creator_hub_project_comments")
        .insert({
          project_id: projectId,
          user_id: user.id,
          parent_id: parentId,
          block_path: blockPath,
          body: bodyText,
        })
        .select("id, user_id, parent_id, block_path, body, resolved, created_at, updated_at")
        .single()
      if (error) throw error
      return NextResponse.json({ comment: data }, { status: 201, headers: HEADERS })
    }

    if (action === "share-link") {
      const permission = ["view", "comment"].includes(body?.permission) ? body.permission : "view"
      const expiresInDays = Number(body?.expiresInDays)
      const expiresAt = Number.isFinite(expiresInDays) && expiresInDays > 0
        ? new Date(Date.now() + Math.min(365, expiresInDays) * 86_400_000).toISOString()
        : null
      const { data: project, error: projectError } = await supabase
        .from("creator_hub_projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (projectError) throw projectError
      if (!project) return NextResponse.json({ error: "Solo el propietario puede crear enlaces." }, { status: 403, headers: HEADERS })
      const { data, error } = await supabase
        .from("creator_hub_project_share_links")
        .insert({ project_id: projectId, owner_id: user.id, permission, expires_at: expiresAt })
        .select("id, token, permission, expires_at, is_active, created_at, updated_at")
        .single()
      if (error) throw error
      return NextResponse.json({ shareLink: data }, { status: 201, headers: HEADERS })
    }

    return NextResponse.json({ error: "Acción no compatible." }, { status: 400, headers: HEADERS })
  } catch (error: any) {
    const message = error?.code === "42P01" || error?.code === "42883"
      ? "Falta aplicar la migración 202607260002_creator_hub_collaboration.sql en Supabase."
      : String(error?.message || "No fue posible completar la acción.").slice(0, 300)
    return NextResponse.json({ error: message }, { status: 500, headers: HEADERS })
  }
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const body = await request.json().catch(() => null)
  const action = clean(body?.action, 40)
  const id = clean(body?.id, 80)
  if (!id) return NextResponse.json({ error: "Falta el identificador." }, { status: 400, headers: HEADERS })

  if (action === "resolve-comment") {
    const { data, error } = await supabase
      .from("creator_hub_project_comments")
      .update({ resolved: body?.resolved !== false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, resolved, updated_at")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: HEADERS })
    return NextResponse.json({ comment: data }, { headers: HEADERS })
  }

  if (action === "permission") {
    const permission = ["view", "comment", "edit"].includes(body?.permission) ? body.permission : "view"
    const { data, error } = await supabase
      .from("creator_hub_project_collaborators")
      .update({ permission, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id, permission, updated_at")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: HEADERS })
    return NextResponse.json({ collaborator: data }, { headers: HEADERS })
  }

  if (action === "share-link") {
    const { data, error } = await supabase
      .from("creator_hub_project_share_links")
      .update({ is_active: body?.isActive !== false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id, token, permission, expires_at, is_active, updated_at")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: HEADERS })
    return NextResponse.json({ shareLink: data }, { headers: HEADERS })
  }

  return NextResponse.json({ error: "Acción no compatible." }, { status: 400, headers: HEADERS })
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: HEADERS })

  const type = request.nextUrl.searchParams.get("type")
  const id = request.nextUrl.searchParams.get("id")
  if (!id || !type) return NextResponse.json({ error: "Falta el identificador o tipo." }, { status: 400, headers: HEADERS })

  const table = type === "collaborator"
    ? "creator_hub_project_collaborators"
    : type === "comment"
      ? "creator_hub_project_comments"
      : type === "share-link"
        ? "creator_hub_project_share_links"
        : null
  if (!table) return NextResponse.json({ error: "Tipo no compatible." }, { status: 400, headers: HEADERS })

  let query = supabase.from(table).delete().eq("id", id)
  if (type === "collaborator" || type === "share-link") query = query.eq("owner_id", user.id)
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: HEADERS })
  return NextResponse.json({ ok: true }, { headers: HEADERS })
}
