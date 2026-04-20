// app/api/notebooks/[id]/embeddings/route.ts
// Genera embeddings en background DESPUÉS de que la fuente ya está ready
// El frontend llama esto de forma fire-and-forget tras recibir ok:true del ingest

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateEmbeddingsForSource } from "@/lib/notebook/ingestion"

export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: nb } = await supabase
      .from("notebooks").select("id").eq("id", id).eq("user_id", user.id).single()
    if (!nb) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const { sourceId } = body as { sourceId: string }
    if (!sourceId) return NextResponse.json({ error: "sourceId requerido" }, { status: 400 })

    // Verificar que la fuente pertenece al notebook
    const { data: src } = await supabase
      .from("notebook_sources").select("id").eq("id", sourceId).eq("notebook_id", id).single()
    if (!src) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 })

    const result = await generateEmbeddingsForSource(sourceId)
    return NextResponse.json(result)

  } catch (err) {
    console.error("[Embeddings]", err)
    return NextResponse.json({ ok: false, embedded: 0 }, { status: 500 })
  }
}
