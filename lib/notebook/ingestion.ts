import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { extractUrlContent } from "@/lib/notebook/extractor"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notebookId = params.id
    const body = await req.json()
    const { sourceId, url } = body

    if (!sourceId || !url) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Marcar como processing
    await supabase
      .from("notebook_sources")
      .update({ status: "processing", error_message: null })
      .eq("id", sourceId)

    try {
      const result = await extractUrlContent(url)

      // Guardar contenido como chunks simples
      const chunks = result.text
        .split("\n\n")
        .filter((c) => c.trim().length > 50)
        .slice(0, 100)

      const chunkRows = chunks.map((text, i) => ({
        notebook_id: notebookId,
        source_id: sourceId,
        content: text,
        position: i,
      }))

      if (chunkRows.length > 0) {
        await supabase.from("notebook_chunks").insert(chunkRows)
      }

      // Marcar como listo
      await supabase
        .from("notebook_sources")
        .update({
          status: "ready",
          title: result.title,
        })
        .eq("id", sourceId)

      return NextResponse.json({ ok: true })
    } catch (err: any) {
      await supabase
        .from("notebook_sources")
        .update({
          status: "error",
          error_message: err.message || "Error al procesar",
        })
        .eq("id", sourceId)

      return NextResponse.json(
        { error: err.message || "Error interno" },
        { status: 500 }
      )
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error general" },
      { status: 500 }
    )
  }
}
