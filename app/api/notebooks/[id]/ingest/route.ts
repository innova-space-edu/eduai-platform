import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ingestNotebookSource } from "@/lib/notebook/ingestion-v2"
import { analyzeYouTubeForNotebook, parseYouTubeUrl } from "@/lib/notebook/youtube-analysis"

export const runtime = "nodejs"
export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

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
      .select("id, url, title, metadata")
      .eq("id", sourceId)
      .eq("notebook_id", id)
      .single()
    if (!source) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 })

    if (source.url && parseYouTubeUrl(source.url)) {
      try {
        await supabase
          .from("notebook_sources")
          .update({ status: "processing", error_message: null })
          .eq("id", sourceId)

        const extraction = await analyzeYouTubeForNotebook({
          url: source.url,
          sourceTitle: source.title,
          sourceMetadata: objectMetadata(source.metadata),
        })

        const { error: youtubeUpdateError } = await supabase
          .from("notebook_sources")
          .update({
            title: extraction.title,
            raw_text: extraction.text,
            metadata: {
              ...objectMetadata(source.metadata),
              ...extraction.metadata,
            },
            status: "processing",
            error_message: null,
          })
          .eq("id", sourceId)

        if (youtubeUpdateError) throw new Error(youtubeUpdateError.message)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error("[Ingest YouTube]", message)
        await supabase
          .from("notebook_sources")
          .update({ status: "error", error_message: message })
          .eq("id", sourceId)

        return NextResponse.json(
          { ok: false, chunkCount: 0, error: message },
          { status: 422 },
        )
      }
    }

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
