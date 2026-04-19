// app/api/web/ingest/route.ts  v2
// Usa extractor en cascada: Firecrawl → Playwright → fetch
// Guarda snapshot estable del contenido (no re-fetcha después)

import { NextRequest, NextResponse } from "next/server"
import { createClient }      from "@/lib/supabase/server"
import { extractUrlContent } from "@/lib/notebook/extractor"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { url, notebookId } = body as { url: string; notebookId: string }

  if (!url || !notebookId) {
    return NextResponse.json({ error: "url y notebookId requeridos" }, { status: 400 })
  }

  // Validar URL
  try { new URL(url) } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 })
  }

  // Verificar ownership
  const { data: nb } = await supabase
    .from("notebooks").select("id").eq("id", notebookId).eq("user_id", user.id).single()
  if (!nb) return NextResponse.json({ error: "Notebook no encontrado" }, { status: 404 })

  // Verificar que no esté ya agregada (dedupe)
  const { data: existing } = await supabase
    .from("notebook_sources")
    .select("id")
    .eq("notebook_id", notebookId)
    .eq("url", url)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: "Esta URL ya está en el cuaderno", sourceId: existing.id },
      { status: 409 }
    )
  }

  // Extraer contenido con cascada Firecrawl → Playwright → fetch
  const extracted = await extractUrlContent(url)

  if (!extracted.text || extracted.text.length < 50) {
    return NextResponse.json({ error: "No se pudo extraer contenido de la URL" }, { status: 422 })
  }

  // Guardar fuente con snapshot del contenido (raw_text = snapshot estable)
  // La ingestión posterior usará raw_text en vez de re-fetchear
  const { data: source, error: srcErr } = await supabase
    .from("notebook_sources")
    .insert({
      notebook_id: notebookId,
      type:        "url",
      title:       extracted.title.slice(0, 200),
      url,
      raw_text:    extracted.text,     // ← snapshot estable del contenido
      metadata:    {
        images:     extracted.images,
        extractor:  extracted.source,
        scraped_at: new Date().toISOString(),
      },
      status: "pending",
    })
    .select()
    .single()

  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 })

  return NextResponse.json({
    source,
    preview:   extracted.text.slice(0, 500),
    extractor: extracted.source,
  }, { status: 201 })
}
