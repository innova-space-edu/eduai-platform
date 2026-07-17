import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ingestNotebookSource } from "@/lib/notebook/ingestion-v2"

export const runtime = "nodejs"
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: notebook } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (!notebook) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const sourceId = String(body?.sourceId || "")
    const fileBase64 = typeof body?.fileBase64 === "string" ? body.fileBase64 : undefined
    if (!sourceId) return NextResponse.json({ error: "sourceId requerido" }, { status: 400 })

    const { data: source } = await supabase
      .from("notebook_sources")
      .select("id")
      .eq("id", sourceId)
      .eq("notebook_id", id)
      .single()
    if (!source) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 })

    const result = await ingestNotebookSource(sourceId, fileBase64)
    return NextResponse.json(result, { status: result.ok ? 200 : 422 })
  } catch (error) {
    console.error("[Ingest POST]", error)
    return NextResponse.json(
      { ok: false, chunkCount: 0, error: "Error interno al procesar la fuente" },
      { status: 500 },
    )
  }
}
