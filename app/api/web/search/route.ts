import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 20

type SearchItem = {
  title: string
  url: string
  snippet: string
  source?: string
  score?: number
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const query = String(body?.query ?? "").trim()

    if (!query) {
      return NextResponse.json({ error: "query requerida" }, { status: 400 })
    }

    const serperKey = process.env.SERPER_API_KEY
    console.log("[Search] SERPER key present:", Boolean(serperKey))

    if (serperKey) {
      try {
        const res = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": serperKey,
          },
          body: JSON.stringify({
            q: query,
            num: 8,
            hl: "es",
            gl: "cl",
          }),
          signal: AbortSignal.timeout(10_000),
        })

        if (!res.ok) {
          console.warn("[Search] Serper HTTP error:", res.status)
        } else {
          const data = await res.json()
          console.log("[Search] Serper organic count:", Array.isArray(data.organic) ? data.organic.length : 0)

          const results: SearchItem[] = (data.organic ?? []).slice(0, 8).map((r: any) => ({
            title: r.title,
            url: r.link,
            snippet: String(r.snippet ?? "").slice(0, 320),
            source: "serper",
            score: typeof r.position === "number" ? 1 - (r.position - 1) * 0.08 : undefined,
          }))

          if (results.length > 0) {
            return NextResponse.json({ results, provider: "serper", query })
          }
        }
      } catch (err) {
        console.warn("[Search] Serper failed:", err)
      }
    }

    const tavilyKey = process.env.TAVILY_API_KEY
    if (tavilyKey) {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            max_results: 8,
            search_depth: "basic",
            include_answer: false,
          }),
          signal: AbortSignal.timeout(10_000),
        })

        if (res.ok) {
          const data = await res.json()
          const results: SearchItem[] = (data.results ?? []).slice(0, 8).map((r: any) => ({
            title: r.title,
            url: r.url,
            snippet: String(r.content ?? "").slice(0, 320),
            source: "tavily",
            score: r.score,
          }))
          if (results.length > 0) {
            return NextResponse.json({ results, provider: "tavily", query })
          }
        }
      } catch (err) {
        console.warn("[Search] Tavily failed:", err)
      }
    }

    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`
      const res = await fetch(ddgUrl, {
        headers: { "User-Agent": "EduAI-NotebookBot/1.0" },
        signal: AbortSignal.timeout(8_000),
      })

      if (res.ok) {
        const data = await res.json()
        const results: SearchItem[] = []

        if (data.AbstractURL && data.AbstractText) {
          results.push({
            title: data.Heading || query,
            url: data.AbstractURL,
            snippet: String(data.AbstractText).slice(0, 320),
            source: "duckduckgo",
          })
        }

        ;(data.RelatedTopics ?? []).slice(0, 6).forEach((t: any) => {
          if (t.FirstURL && t.Text && !t.Topics) {
            results.push({
              title: String(t.Text).slice(0, 80),
              url: t.FirstURL,
              snippet: String(t.Text).slice(0, 320),
              source: "duckduckgo",
            })
          }
        })

        if (results.length > 0) {
          return NextResponse.json({ results, provider: "duckduckgo", query })
        }
      }
    } catch (err) {
      console.warn("[Search] DuckDuckGo failed:", err)
    }

    return NextResponse.json({
      results: [],
      provider: null,
      query,
      hint: serperKey
        ? "No se encontraron resultados útiles con los buscadores configurados."
        : "SERPER_API_KEY no configurada. Agrega la variable en Vercel y vuelve a desplegar.",
    })
  } catch (err) {
    console.error("[Search] Fatal:", err)
    return NextResponse.json({ error: "Error interno al buscar en la web" }, { status: 500 })
  }
}
