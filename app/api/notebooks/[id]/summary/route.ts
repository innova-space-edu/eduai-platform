// app/api/notebooks/[id]/summary/route.ts  v3
// Fix: try-catch global — nunca devuelve HTML, siempre JSON
// Fix: maneja tabla inexistente gracefully

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

// ─── Helper: parsear campo JSONB que puede venir como string o como objeto ────
function parseJsonbField<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value))   return value as T
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  if (value && typeof value === "object") return value as T
  return fallback
}

// GET — obtener resumen existente
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    // Verificar ownership
    const { data: nb, error: nbErr } = await supabase
      .from("notebooks")
      .select("id, specialist_role")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (nbErr || !nb) {
      return NextResponse.json({ error: "Notebook no encontrado" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("notebook_summaries")
      .select("*")
      .eq("notebook_id", id)
      .single()

    // Si no hay resumen (o la tabla no existe aún), devolver null sin crash
    if (error || !data) {
      // PGRST116 = "no rows" — es normal cuando aún no hay resumen
      if (error?.code !== "PGRST116") {
        console.error("[Summary GET] DB error:", error)
      }
      return NextResponse.json({ summary: null })
    }

    return NextResponse.json({
      summary: {
        id:               data.id,
        notebook_id:      data.notebook_id,
        summary_markdown: data.summary_markdown ?? "",
        key_points:       parseJsonbField<string[]>(data.key_points, []),
        glossary_json:    parseJsonbField<Array<{ term: string; definition: string }>>(data.glossary_json, []),
        topics:           parseJsonbField<string[]>(data.topics, []),
        updated_at:       data.updated_at,
      },
    })
  } catch (err) {
    console.error("[Summary GET]", err)
    return NextResponse.json({ summary: null, error: "Error interno" }, { status: 500 })
  }
}

// POST — regenerar resumen desde fuentes activas
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: nb, error: nbErr } = await supabase
      .from("notebooks")
      .select("id, specialist_role")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (nbErr || !nb) {
      return NextResponse.json({ error: "Notebook no encontrado" }, { status: 404 })
    }

    // Verificar que hay fuentes listas antes de importar el summarizer
    const { data: sources } = await supabase
      .from("notebook_sources")
      .select("id")
      .eq("notebook_id", id)
      .eq("is_active", true)
      .eq("status", "ready")
      .limit(1)

    if (!sources || sources.length === 0) {
      return NextResponse.json(
        { error: "No hay fuentes activas y procesadas para generar el resumen" },
        { status: 422 }
      )
    }

    const { generateNotebookSummary } = await import("@/lib/notebook/summarizer")
    const summary = await generateNotebookSummary(id, nb.specialist_role)

    if (!summary) {
      return NextResponse.json(
        { error: "No se pudo generar el resumen" },
        { status: 422 }
      )
    }

    return NextResponse.json({ summary })
  } catch (err) {
    console.error("[Summary POST]", err)
    return NextResponse.json({ error: "Error interno al generar resumen" }, { status: 500 })
  }
}
