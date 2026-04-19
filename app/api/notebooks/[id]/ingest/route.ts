// app/api/notebooks/[id]/ingest/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ingestNotebookSource } from "@/lib/notebook/ingestion"

export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

// POST /api/notebooks/[id]/ingest — ingestar una fuente
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
  const { sourceId, fileBase64 } = body

  if (!sourceId) return NextResponse.json({ error: "sourceId requerido" }, { status: 400 })

  // Verificar que la fuente pertenece al notebook
  const { data: src } = await supabase
    .from("notebook_sources")
    .select("id, notebook_id")
    .eq("id", sourceId)
    .eq("notebook_id", id)
    .single()

  if (!src) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 })

  const result = await ingestNotebookSource(sourceId, fileBase64)

  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}
