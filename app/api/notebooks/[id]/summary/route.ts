// app/api/notebooks/[id]/summary/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateNotebookSummary } from "@/lib/notebook/summarizer"

export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

// GET /api/notebooks/[id]/summary — obtener resumen existente
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  // Verificar ownership
  const { data: nb } = await supabase
    .from("notebooks").select("id, specialist_role").eq("id", id).eq("user_id", user.id).single()
  if (!nb) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { data } = await supabase
    .from("notebook_summaries")
    .select("*")
    .eq("notebook_id", id)
    .single()

  if (!data) return NextResponse.json({ summary: null })

  return NextResponse.json({
    summary: {
      ...data,
      key_points:    typeof data.key_points === "string"   ? JSON.parse(data.key_points)   : data.key_points   ?? [],
      glossary_json: typeof data.glossary_json === "string" ? JSON.parse(data.glossary_json) : data.glossary_json ?? [],
      topics:        typeof data.topics === "string"        ? JSON.parse(data.topics)        : data.topics        ?? [],
    },
  })
}

// POST /api/notebooks/[id]/summary — regenerar resumen
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data: nb } = await supabase
    .from("notebooks").select("id, specialist_role").eq("id", id).eq("user_id", user.id).single()
  if (!nb) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const summary = await generateNotebookSummary(id, nb.specialist_role)

  if (!summary) {
    return NextResponse.json(
      { error: "No hay fuentes activas para generar resumen" },
      { status: 422 }
    )
  }

  return NextResponse.json({ summary })
}
