// app/api/notebooks/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET /api/notebooks — listar notebooks del usuario
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await supabase
    .from("notebooks")
    .select(`
      id, title, specialist_role, description, created_at, updated_at,
      notebook_sources(count),
      notebook_messages(count)
    `)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ notebooks: data ?? [] })
}

// POST /api/notebooks — crear notebook
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { title = "Nuevo cuaderno", specialist_role = "Especialista general", description } = body

  const { data, error } = await supabase
    .from("notebooks")
    .insert({ user_id: user.id, title, specialist_role, description })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ notebook: data }, { status: 201 })
}
