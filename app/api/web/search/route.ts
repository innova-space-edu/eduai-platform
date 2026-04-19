// app/api/web/search/route.ts  v3
// Búsqueda real únicamente — sin fallback de IA inventando resultados
// Orden: Serper.dev → Tavily → DuckDuckGo → vacío

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 20

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { query } = body as { query: string }

  if (!query?.trim()) {
    return NextResponse.json({ error: "query requerida" }, { status: 400 })
  }

  // ─── 1. Serper.dev (Google Search API) ────────────────────────────────────
  // Plan gratuito: https://serper.dev — 2500 queries gratis al registrarse
  // Variable: SERPER_API_KEY
  const serperKey = process.env.SERPER_API_KEY
  if (serperKey) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY":    serperKey,
        },
        body: JSON.stringify({
          q:   query.trim(),
          num: 6,
          hl:  "es",   // idioma de la interfaz
          gl:  "cl",   // país: Chile — cambiar a "ar", "mx", etc. si necesitas
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const data = await res.json()

        const organic = (data.organic ?? []).slice(0, 6).map((r: {
          title: string; link: string; snippet: string; position: number
        }) => ({
          title:   r.title,
          url:     r.link,
          snippet: r.snippet?.slice(0, 350) ?? "",
          score:   1 - (r.position - 1) * 0.1,  // posición → score aproximado
        }))

        if (organic.length > 0) {
          return NextResponse.json({ results: organic, provider: "serper" })
        }
      }
    } catch (err) {
      console.warn("[Search] Serper failed:", err)
    }
  }

  // ─── 2. Tavily ─────────────────────────────────────────────────────────────
  // Plan gratuito: https://tavily.com — 1000 queries/mes
  // Variable: TAVILY_API_KEY
  const tavilyKey = process.env.TAVILY_API_KEY
  if (tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key:         tavilyKey,
          query:           query.trim(),
          max_results:     6,
          search_depth:    "basic",
          include_answer:  false,
          include_domains:  [],
          exclude_domains:  [],
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const data = await res.json()
        const results = (data.results ?? []).map((r: {
          title: string; url: string; content: string; score: number
        }) => ({
          title:   r.title,
          url:     r.url,
          snippet: r.content?.slice(0, 350) ?? "",
          score:   r.score,
        }))
        if (results.length > 0) {
          return NextResponse.json({ results, provider: "tavily" })
        }
      }
    } catch (err) {
      console.warn("[Search] Tavily failed:", err)
    }
  }

  // ─── 3. DuckDuckGo Instant Answer ─────────────────────────────────────────
  // Sin clave — devuelve poco, solo como último recurso antes de vacío
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`
    const res    = await fetch(ddgUrl, {
      headers: { "User-Agent": "EduAI-NotebookBot/1.0" },
      signal:  AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      const data    = await res.json()
      const results: Array<{ title: string; url: string; snippet: string }> = []

      if (data.AbstractURL && data.AbstractText) {
        results.push({
          title:   data.Heading || query,
          url:     data.AbstractURL,
          snippet: data.AbstractText.slice(0, 350),
        })
      }
      ;(data.RelatedTopics ?? []).slice(0, 5).forEach((t: {
        FirstURL?: string; Text?: string; Topics?: unknown[]
      }) => {
        if (t.FirstURL && t.Text && !t.Topics) {
          results.push({
            title:   t.Text.slice(0, 80),
            url:     t.FirstURL,
            snippet: t.Text.slice(0, 350),
          })
        }
      })

      if (results.length > 0) {
        return NextResponse.json({ results, provider: "duckduckgo" })
      }
    }
  } catch (err) {
    console.warn("[Search] DuckDuckGo failed:", err)
  }

  // ─── Sin resultados — nunca inventar con IA ───────────────────────────────
  return NextResponse.json({
    results:  [],
    provider: null,
    hint:     "Agrega SERPER_API_KEY en tus variables de entorno para activar búsqueda web completa. Registro gratuito en serper.dev",
  })
}
