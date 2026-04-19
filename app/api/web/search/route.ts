// app/api/web/search/route.ts  v2
// FIX: eliminado fallback de IA inventando resultados
// Solo búsqueda real: Tavily → Brave → DuckDuckGo → vacío

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

  // ─── 1. Tavily ─────────────────────────────────────────────────────────────
  // Plan gratuito: https://tavily.com — 1000 queries/mes
  const tavilyKey = process.env.TAVILY_API_KEY
  if (tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          api_key:        tavilyKey,
          query:          query.trim(),
          max_results:    6,
          search_depth:   "basic",
          include_answer: false,
          include_domains: [],
          exclude_domains: [],
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
          snippet: r.content?.slice(0, 350),
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

  // ─── 2. Brave Search API ───────────────────────────────────────────────────
  // Plan gratuito: https://api.search.brave.com — 2000 queries/mes
  const braveKey = process.env.BRAVE_SEARCH_API_KEY
  if (braveKey) {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&search_lang=es`
      const res = await fetch(url, {
        headers: {
          "Accept":              "application/json",
          "Accept-Encoding":     "gzip",
          "X-Subscription-Token": braveKey,
        },
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const data = await res.json()
        const results = (data.web?.results ?? []).slice(0, 6).map((r: {
          title: string; url: string; description: string
        }) => ({
          title:   r.title,
          url:     r.url,
          snippet: r.description?.slice(0, 350) ?? "",
        }))
        if (results.length > 0) {
          return NextResponse.json({ results, provider: "brave" })
        }
      }
    } catch (err) {
      console.warn("[Search] Brave failed:", err)
    }
  }

  // ─── 3. DuckDuckGo Instant Answer ─────────────────────────────────────────
  // Sin clave requerida, pero devuelve muy poco (no es búsqueda completa)
  // Solo se usa como última opción antes de devolver vacío
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`
    const res = await fetch(url, {
      headers: { "User-Agent": "EduAI-NotebookBot/1.0" },
      signal:  AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      const data = await res.json()
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

  // ─── Sin resultados reales — devuelve vacío ────────────────────────────────
  // FIX: NO inventar resultados con IA. El usuario debe agregar sus propias fuentes.
  return NextResponse.json({
    results:  [],
    provider: null,
    hint:     "No se encontraron resultados. Configura TAVILY_API_KEY o BRAVE_SEARCH_API_KEY para búsqueda completa.",
  })
}
