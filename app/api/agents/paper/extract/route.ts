import { createClient } from "@/lib/supabase/server"
import {
  STORAGE_BUCKET,
  MAX_RETURN_TEXT_CHARS,
  truncateText,
  ensurePaperProcessed,
} from "@/lib/papers/extraction"
import { updateChunkEmbeddings } from "@/lib/papers/embeddings"

export const runtime = "nodejs"
export const maxDuration = 60

function getString(value: unknown) {
  return typeof value === "string" ? value : ""
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const body = await req.json()

    const bucket = getString(body?.bucket).trim()
    const filePath = getString(body?.filePath).trim()
    const filename = getString(body?.filename).trim()
    const forceRefresh = body?.forceRefresh === true

    if (!bucket || !filePath) {
      return Response.json({ error: "Faltan bucket o filePath." }, { status: 400 })
    }

    if (bucket !== STORAGE_BUCKET) {
      return Response.json({ error: "Bucket no permitido." }, { status: 400 })
    }

    if (!filePath.startsWith(`${user.id}/`)) {
      return Response.json(
        { error: "No tienes permisos para acceder a este archivo." },
        { status: 403 }
      )
    }

    const result = await ensurePaperProcessed({
      supabase,
      userId: user.id,
      bucket,
      filePath,
      filename,
      forceRefresh,
    })

    if (result.error || !result.text?.trim()) {
      return Response.json(
        {
          error:
            result.summary ||
            "No se pudo extraer texto útil del PDF. Prueba con un PDF que contenga texto seleccionable o revisa la configuración OCR.",
          extractionMethod: result.extractionMethod,
          parserUsed: result.parserUsed,
          ocrUsed: result.ocrUsed,
        },
        { status: 422 }
      )
    }

    if (result.documentId) {
      try {
        await updateChunkEmbeddings({
          supabase,
          documentId: result.documentId,
          userId: user.id,
        })
      } catch (embedError) {
        console.error("[Paper][extract][embeddings] error:", embedError)
      }
    }

    const finalText = truncateText(result.text || "", MAX_RETURN_TEXT_CHARS)

    return Response.json({
      title: result.title,
      text: finalText,
      summary: result.summary,
      pageCount: result.pageCount,
      truncated: finalText.length < (result.text || "").length,
      extractionMethod: result.extractionMethod,
      parserUsed: result.parserUsed,
      ocrUsed: result.ocrUsed,
      fromCache: result.fromCache,
      bucket,
      filePath,
      documentId: result.documentId || null,
      chunkCount: result.chunks?.length || 0,
      error: false,
    })
  } catch (error: any) {
    console.error("[Paper][extract] error:", error)

    return Response.json(
      {
        error: error?.message || "No se pudo extraer el texto automáticamente.",
      },
      { status: 500 }
    )
  }
}
