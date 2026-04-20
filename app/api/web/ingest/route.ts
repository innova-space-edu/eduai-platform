// app/api/web/ingest/route.ts
// v4
// - acepta title + metadata desde SourcePanel
// - dedupe por URL normalizada
// - scraping robusto con Firecrawl opcional + fetch/cheerio
// - siempre responde JSON
// - deja la fuente lista (status=ready)

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 30

type ScrapeResult = {
  title: string
  text: string
  method: string
}

function normalizeUrl(input: string): string {
  try {
    const u = new URL(input.trim())
    u.hash = ""
    if (u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1)
    }
    return u.toString()
  } catch {
    return input.trim()
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function cleanText(text: string, maxLen = 50000): string {
  return decodeHtmlEntities(text)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen)
}

// ─── Scraping en cascada ───────────────────────────────────────────

async function scrapeWithFirecrawl(url: string): Promise<ScrapeResult | null> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY
  if (!firecrawlKey) return null

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 1000,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) return null

    const data = await res.json()
    const text = cleanText(String(data?.data?.markdown ?? ""), 60000)

    if (text.length < 100) return null

    return {
      title: String(data?.data?.metadata?.title ?? url).slice(0, 200),
      text,
      method: "firecrawl",
    }
  } catch (e) {
    console.warn("[WebIngest] Firecrawl failed:", e)
    return null
  }
}

async function scrapeWithFetch(url: string): Promise<ScrapeResult | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.warn(`[WebIngest] HTTP ${res.status} for ${url}`)
      return null
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase()
    if (
      contentType.includes("application/pdf") ||
      contentType.includes("application/octet-stream")
    ) {
      return null
    }

    const html = await res.text()
    if (!html || html.length < 100) return null

    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
    const pageTitle = cleanText(titleMatch?.[1] ?? url, 200)

    try {
      const cheerio = await import("cheerio")
      const $ = cheerio.load(html)

      $(
        [
          "script",
          "style",
          "nav",
          "footer",
          "header",
          "aside",
          "iframe",
          "noscript",
          "[class*='nav']",
          "[class*='menu']",
          "[class*='sidebar']",
          "[class*='cookie']",
          "[class*='popup']",
          "[class*='modal']",
          "[class*='banner']",
          "[class*='advert']",
          "[class*='ad-']",
          "[id*='cookie']",
          "[id*='modal']",
        ].join(",")
      ).remove()

      const mainSelectors = [
        "article",
        "main",
        "[role='main']",
        ".content",
        "#content",
        ".post-content",
        ".article-body",
        ".entry-content",
        "#main-content",
        ".page-content",
      ]

      let mainEl: ReturnType<typeof $> | null = null
      for (const sel of mainSelectors) {
        if ($(sel).length > 0) {
          mainEl = $(sel).first()
          break
        }
      }

      const rawText = mainEl ? mainEl.text() : $("body").text()
      const text = cleanText(rawText, 50000)

      if (text.length < 80) return null

      return {
        title: pageTitle || url,
        text,
        method: "fetch-cheerio",
      }
    } catch {
      const fallback = cleanText(
        html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " "),
        50000
      )

      if (fallback.length < 80) return null

      return {
        title: pageTitle || url,
        text: fallback,
        method: "fetch-regex",
      }
    }
  } catch (e) {
    console.warn("[WebIngest] fetch failed:", e)
    return null
  }
}

async function scrapeUrl(url: string): Promise<ScrapeResult | null> {
  const fc = await scrapeWithFirecrawl(url)
  if (fc) return fc
  return scrapeWithFetch(url)
}

// ─── Handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      url?: string
      notebookId?: string
      title?: string
      metadata?: Record<string, unknown>
    }

    const rawUrl = body.url?.trim() ?? ""
    const notebookId = body.notebookId?.trim() ?? ""
    const incomingTitle = body.title?.trim() ?? ""
    const incomingMetadata = body.metadata ?? {}

    if (!rawUrl || !notebookId) {
      return NextResponse.json(
        { error: "url y notebookId requeridos" },
        { status: 400 }
      )
    }

    let normalized = ""
    try {
      const u = new URL(rawUrl)
      if (!["http:", "https:"].includes(u.protocol)) {
        throw new Error("invalid_protocol")
      }
      normalized = normalizeUrl(u.toString())
    } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 })
    }

    const { data: notebook, error: nbErr } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", notebookId)
      .eq("user_id", user.id)
      .single()

    if (nbErr || !notebook) {
      return NextResponse.json(
        { error: "Notebook no encontrado" },
        { status: 404 }
      )
    }

    // Dedupe robusto: trae URLs del notebook y compara normalizadas
    const { data: existingSources, error: existingErr } = await supabase
      .from("notebook_sources")
      .select("id,url")
      .eq("notebook_id", notebookId)

    if (existingErr) {
      console.error("[WebIngest] Dedupe query error:", existingErr)
      return NextResponse.json({ error: existingErr.message }, { status: 500 })
    }

    const duplicate = (existingSources ?? []).find((s) => {
      const existingUrl = typeof s.url === "string" ? normalizeUrl(s.url) : ""
      return existingUrl && existingUrl === normalized
    })

    if (duplicate) {
      return NextResponse.json(
        { error: "Esta URL ya está en el cuaderno", sourceId: duplicate.id },
        { status: 409 }
      )
    }

    const scraped = await scrapeUrl(normalized)

    if (!scraped || scraped.text.length < 80) {
      return NextResponse.json(
        {
          error:
            "No se pudo extraer contenido. El sitio puede bloquear bots o requerir JavaScript. Prueba pegando el texto manualmente o configura FIRECRAWL_API_KEY.",
        },
        { status: 422 }
      )
    }

    const finalTitle = (incomingTitle || scraped.title || normalized).slice(0, 200)
    const finalText = cleanText(scraped.text, 60000)

    const metadata = {
      ...incomingMetadata,
      source: "web",
      extractor: scraped.method,
      scraped_at: new Date().toISOString(),
      char_count: finalText.length,
      normalized_url: normalized,
      original_title: scraped.title,
      provided_title: incomingTitle || null,
    }

    const { data: source, error: srcErr } = await supabase
      .from("notebook_sources")
      .insert({
        notebook_id: notebookId,
        type: "url",
        title: finalTitle,
        url: normalized,
        raw_text: finalText,
        extracted_text: finalText,
        metadata,
        status: "ready",
        error_message: null,
      })
      .select()
      .single()

    if (srcErr) {
      console.error("[WebIngest] DB insert:", srcErr)
      return NextResponse.json({ error: srcErr.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        source,
        preview: finalText.slice(0, 500),
        extractor: scraped.method,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("[WebIngest] Unhandled:", err)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
