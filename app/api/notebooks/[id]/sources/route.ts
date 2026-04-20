// app/api/notebooks/[id]/sources/route.ts  v2
// Bug fix: PATCH y DELETE ahora verifican ownership del notebook

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

async function verifyOwnership(notebookId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("notebooks")
    .select("id")
    .eq("id", notebookId)
    .eq("user_id", userId)
    .single()
  return !!data
}

function normalizeUrl(input?: string | null): string | null {
  if (!input?.trim()) return null
  try {
    const url = new URL(input.trim())
    url.hash = ""
    return url.toString()
  } catch {
    return input.trim()
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  if (!(await verifyOwnership(id, user.id))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("notebook_sources")
    .select("id, notebook_id, type, title, url, raw_text, extracted_text, is_active, status, error_message, created_at, metadata")
    .eq("notebook_id", id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sources: data ?? [] })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  if (!(await verifyOwnership(id, user.id))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { type, title, url, raw_text, metadata = {} } = body as {
    type?: string
    title?: string
    url?: string
    raw_text?: string
    metadata?: Record<string, unknown>
  }

  if (!type) {
    return NextResponse.json({ error: "type requerido" }, { status: 400 })
  }

  if ((type === "url" || type === "search_result") && !url?.trim()) {
    return NextResponse.json({ error: "url requerida para tipo URL" }, { status: 400 })
  }

  if ((type === "text" || type === "txt") && !raw_text?.trim()) {
    return NextResponse.json({ error: "raw_text requerido para tipo texto" }, { status: 400 })
  }

  const normalizedUrl = normalizeUrl(url)

  if ((type === "url" || type === "search_result") && normalizedUrl) {
    const { data: existing } = await supabase
      .from("notebook_sources")
      .select("id, notebook_id, type, title, url, raw_text, extracted_text, is_active, status, error_message, created_at, metadata")
      .eq("notebook_id", id)
      .eq("url", normalizedUrl)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          code: "SOURCE_ALREADY_EXISTS",
          message: "Esta fuente ya está agregada al cuaderno",
          source: existing,
        },
        { status: 409 }
      )
    }
  }

  const payload = {
    notebook_id: id,
    type,
    title: title?.trim() || null,
    url: normalizedUrl,
    raw_text: raw_text?.trim() || null,
    metadata,
    status: "pending",
    is_active: true,
    error_message: null,
  }

  const { data, error } = await supabase
    .from("notebook_sources")
    .insert(payload)
    .select("id, notebook_id, type, title, url, raw_text, extracted_text, is_active, status, error_message, created_at, metadata")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, source: data }, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  if (!(await verifyOwnership(id, user.id))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { sourceId, is_active } = body as { sourceId?: string; is_active?: boolean }

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId requerido" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("notebook_sources")
    .update({ is_active })
    .eq("id", sourceId)
    .eq("notebook_id", id)
    .select("id, notebook_id, type, title, url, raw_text, extracted_text, is_active, status, error_message, created_at, metadata")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ source: data })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  if (!(await verifyOwnership(id, user.id))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get("sourceId")

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId requerido" }, { status: 400 })
  }

  const { error } = await supabase
    .from("notebook_sources")
    .delete()
    .eq("id", sourceId)
    .eq("notebook_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
