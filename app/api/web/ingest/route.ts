// app/api/web/ingest/route.ts
// Extrae contenido de una URL y lo prepara para el notebook
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cleanHtml } from "@/lib/notebook/chunking"

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

  // Verificar ownership del notebook
  const { data: nb } = await supabase
    .from("notebooks").select("id").eq("id", notebookId).eq("user_id", user.id).single()
  if (!nb) return NextResponse.json({ error: "Notebook no encontrado" }, { status: 404 })

  // Extraer contenido
  let extractedText = ""
  let title         = url

  try {
    // Intentar Firecrawl si está disponible
    const firecrawlKey = process.env.FIRECRAWL_API_KEY
    if (firecrawlKey) {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${firecrawlKey}` },
        body:    JSON.stringify({ url, formats: ["markdown"] }),
        signal:  AbortSignal.timeout(20_000),
      })
      const data = await res.json()
      if (data.success && data.data?.markdown) {
        extractedText = data.data.markdown.slice(0, 50_000)
        title         = data.data.metadata?.title ?? url
      }
    }

    // Fallback: fetch directo
    if (!extractedText) {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; EduAI-NotebookBot/1.0)" },
        signal:  AbortSignal.timeout(15_000),
      })
      const html  = await res.text()
      extractedText = cleanHtml(html).slice(0, 50_000)

      // Extraer título del HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch?.[1]) title = titleMatch[1].trim().slice(0, 120)
    }
  } catch (err) {
    console.error("[WebIngest] Fetch failed:", err)
    return NextResponse.json({ error: "No se pudo acceder a la URL" }, { status: 422 })
  }

  if (!extractedText || extractedText.length < 50) {
    return NextResponse.json({ error: "Contenido insuficiente extraído" }, { status: 422 })
  }

  // Crear fuente en el notebook
  const { data: source, error: srcErr } = await supabase
    .from("notebook_sources")
    .insert({
      notebook_id: notebookId,
      type:        "url",
      title,
      url,
      raw_text:    extractedText,
      status:      "pending",
    })
    .select()
    .single()

  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 })

  return NextResponse.json({
    source,
    preview: extractedText.slice(0, 500),
  }, { status: 201 })
}
