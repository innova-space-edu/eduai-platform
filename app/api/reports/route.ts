// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// ── GET — leer reportes propios ──────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await supabase
    .from("admin_reports")
    .select("id, subject, category, status, priority, admin_reply, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data || [] })
}

// ── POST — crear nuevo reporte ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json()
  const { subject, description, category = "problema", priority = "normal" } = body

  if (!subject?.trim() || !description?.trim()) {
    return NextResponse.json({ error: "Asunto y descripción son requeridos" }, { status: 400 })
  }

  // Obtener nombre del perfil
  const { data: profile } = await supabase.from("profiles").select("name, email").eq("id", user.id).single()

  const { data, error } = await supabase.from("admin_reports").insert({
    user_id:     user.id,
    user_name:   profile?.name || user.email?.split("@")[0] || "Usuario",
    user_email:  user.email,
    subject:     subject.trim(),
    description: description.trim(),
    category,
    priority,
    status:      "abierto",
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, report: data })
}
