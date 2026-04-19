// app/api/notebooks/[id]/sources/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

// GET /api/notebooks/[id]/sources
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  // Verificar ownership
  const { data: nb } = await supabase
    .from("notebooks").select("id").eq("id", id).eq("user_id", user.id).single()
  if (!nb) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { data, error } = await supabase
    .from("notebook_sources")
    .select("id, notebook_id, type, title, url, is_active, status, error_message, created_at, metadata")
    .eq("notebook_id", id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sources: data ?? [] })
}

// POST /api/notebooks/[id]/sources — agregar fuente
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  // Verificar ownership
  const { data: nb } = await supabase
    .from("notebooks").select("id").eq("id", id).eq("user_id", user.id).single()
  if (!nb) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const { type, title, url, raw_text, metadata = {} } = body

  if (!type) return NextResponse.json({ error: "type requerido" }, { status: 400 })

  // Validar según tipo
  if (type === "url" && !url)
    return NextResponse.json({ error: "url requerida para tipo 'url'" }, { status: 400 })
  if ((type === "text" || type === "txt") && !raw_text)
    return NextResponse.json({ error: "raw_text requerido para tipo 'text'" }, { status: 400 })

  const { data, error } = await supabase
    .from("notebook_sources")
    .insert({
      notebook_id: id,
      type,
      title: title ?? null,
      url:   url ?? null,
      raw_text: raw_text ?? null,
      metadata,
      status: "pending",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ source: data }, { status: 201 })
}

// PATCH /api/notebooks/[id]/sources — toggle activo/inactivo o eliminar
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { sourceId, is_active } = body

  if (!sourceId) return NextResponse.json({ error: "sourceId requerido" }, { status: 400 })

  const { data, error } = await supabase
    .from("notebook_sources")
    .update({ is_active })
    .eq("id", sourceId)
    .eq("notebook_id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ source: data })
}

// DELETE /api/notebooks/[id]/sources?sourceId=xxx
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get("sourceId")
  if (!sourceId) return NextResponse.json({ error: "sourceId requerido" }, { status: 400 })

  const { error } = await supabase
    .from("notebook_sources")
    .delete()
    .eq("id", sourceId)
    .eq("notebook_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
