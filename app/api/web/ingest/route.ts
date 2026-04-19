// app/api/web/ingest/route.ts  v3
// Fix: try-catch global — siempre devuelve JSON
// Fix: extracción más robusta sin Firecrawl
// Fix: mejor limpieza de HTML con cheerio

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 30

// ─── Scraping en cascada ──────────────────────────────────────────────────────

async function scrapeUrl(url: string): Promise<{ title: string; text: string; method: string } | null> {

  // Capa 1: Firecrawl
  const firecrawlKey = process.env.FIRECRAWL_API_KEY
  if (firecrawlKey) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url,
          formats:         ["markdown"],
          onlyMainContent: true,
          waitFor:         1000,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) {
        const data = await res.json()
        const text = (data.data?.markdown ?? "").trim()
        if (text.length > 100) {
          return {
            title:  data.data?.metadata?.title ?? url,
            text:   text.slice(0, 60_000),
            method: "firecrawl",
          }
        }
      }
    } catch (e) {
      console.warn("[WebIngest] Firecrawl failed:", e)
    }
  }

  // Capa 2: fetch + cheerio
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
        "Cache-Control":   "no-cache",
      },
      redirect: "follow",
      signal:   AbortSignal.timeout(15_000),
    })

    if (!res.ok) { console.warn(`[WebIngest] HTTP ${res.status}`); return null }

    const contentType = res.headers.get("content-type") ?? ""
    if (contentType.includes("pdf")) return null

    const html = await res.text()
    if (!html || html.length < 100) return null

    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
    const title      = titleMatch?.[1]?.trim().replace(/\s+/g, " ") ?? url

    let text = ""
    try {
      const cheerio = await import("cheerio")
      const $       = cheerio.load(html)

      $("script,style,nav,footer,header,aside,iframe,noscript,[class*='nav'],[class*='menu'],[class*='sidebar'],[class*='ad'],[id*='ad'],[class*='cookie'],[class*='popup'],[class*='modal']").remove()

      const mainSelectors = ["article","main","[role='main']",".content","#content",".post-content",".article-body",".entry-content","#main-content",".page-content"]
      let mainEl = null
      for (const sel of mainSelectors) {
        if ($(sel).length > 0) { mainEl = $(sel).first(); break }
      }

      text = (mainEl ? mainEl.text() : $("body").text())
        .replace(/\s{3,}/g, "\n\n").replace(/\t/g, " ").trim().slice(0, 50_000)

    } catch {
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\s{3,}/g, "\n\n").trim().slice(0, 50_000)
    }

    if (text.length < 80) return null
    return { title: title.slice(0, 200), text, method: "fetch" }

  } catch (e) {
    console.warn("[WebIngest] fetch failed:", e)
    return null
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { url, notebookId } = body as { url: string; notebookId: string }

    if (!url || !notebookId) {
      return NextResponse.json({ error: "url y notebookId requeridos" }, { status: 400 })
    }

    try { const u = new URL(url); if (!["http:","https:"].includes(u.protocol)) throw new Error() }
    catch { return NextResponse.json({ error: "URL inválida" }, { status: 400 }) }

    const { data: nb } = await supabase
      .from("notebooks").select("id").eq("id", notebookId).eq("user_id", user.id).single()
    if (!nb) return NextResponse.json({ error: "Notebook no encontrado" }, { status: 404 })

    // Dedupe
    const { data: existing } = await supabase
      .from("notebook_sources").select("id").eq("notebook_id", notebookId).eq("url", url).maybeSingle()
    if (existing) {
      return NextResponse.json({ error: "Esta URL ya está en el cuaderno", sourceId: existing.id }, { status: 409 })
    }

    const scraped = await scrapeUrl(url)

    if (!scraped || scraped.text.length < 80) {
      return NextResponse.json(
        { error: "No se pudo extraer contenido. El sitio puede bloquear bots o requerir JavaScript. Prueba pegando el texto manualmente o configura FIRECRAWL_API_KEY." },
        { status: 422 }
      )
    }

    const { data: source, error: srcErr } = await supabase
      .from("notebook_sources")
      .insert({
        notebook_id: notebookId,
        type:        "url",
        title:       scraped.title,
        url,
        raw_text:    scraped.text,
        metadata:    { extractor: scraped.method, scraped_at: new Date().toISOString(), char_count: scraped.text.length },
        status:      "pending",
      })
      .select().single()

    if (srcErr) {
      console.error("[WebIngest] DB insert:", srcErr)
      return NextResponse.json({ error: srcErr.message }, { status: 500 })
    }

    return NextResponse.json({ source, preview: scraped.text.slice(0, 500), extractor: scraped.method }, { status: 201 })

  } catch (err) {
    console.error("[WebIngest] Unhandled:", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
