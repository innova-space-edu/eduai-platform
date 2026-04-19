import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 20

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { query } = body as { query?: string }

    if (!query?.trim()) {
      return NextResponse.json({ error: "query requerida" }, { status: 400 })
    }

    const trimmedQuery = query.trim()

    const serperKey = process.env.SERPER_API_KEY?.trim() ?? ""
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
            q: trimmedQuery,
            num: 6,
            hl: "es",
            gl: "cl",
          }),
          signal: AbortSignal.timeout(12_000),
        })

        if (!res.ok) {
          console.warn("[Search] Serper HTTP error:", res.status)
        } else {
          const data = await res.json()
          const organicRaw = Array.isArray(data.organic) ? data.organic : []
          console.log("[Search] Serper organic count:", organicRaw.length)

          const organic = organicRaw.slice(0, 6).map(
            (
              r: { title?: string; link?: string; snippet?: string; position?: number },
              idx: number
            ) => ({
              title: r.title?.trim() || r.link || `Resultado ${idx + 1}`,
              url: r.link?.trim() || "",
              snippet: r.snippet?.slice(0, 350) ?? "",
              score:
                typeof r.position === "number"
                  ? Math.max(0.1, 1 - (r.position - 1) * 0.1)
                  : Math.max(0.1, 1 - idx * 0.1),
            })
          ).filter((r: { url: string }) => /^https?:\/\//i.test(r.url))

          if (organic.length > 0) {
            return NextResponse.json({ results: organic, provider: "serper" })
          }
        }
      } catch (err) {
        console.warn("[Search] Serper failed:", err)
      }
    }

    const tavilyKey = process.env.TAVILY_API_KEY?.trim() ?? ""
    if (tavilyKey) {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: trimmedQuery,
            max_results: 6,
            search_depth: "basic",
            include_answer: false,
            include_domains: [],
            exclude_domains: [],
          }),
          signal: AbortSignal.timeout(12_000),
        })

        if (res.ok) {
          const data = await res.json()
          const results = (Array.isArray(data.results) ? data.results : [])
            .map((r: { title?: string; url?: string; content?: string; score?: number }, idx: number) => ({
              title: r.title?.trim() || r.url || `Resultado ${idx + 1}`,
              url: r.url?.trim() || "",
              snippet: r.content?.slice(0, 350) ?? "",
              score: typeof r.score === "number" ? r.score : Math.max(0.1, 1 - idx * 0.1),
            }))
            .filter((r: { url: string }) => /^https?:\/\//i.test(r.url))

          if (results.length > 0) {
            return NextResponse.json({ results, provider: "tavily" })
          }
        }
      } catch (err) {
        console.warn("[Search] Tavily failed:", err)
      }
    }

    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmedQuery)}&format=json&no_redirect=1&no_html=1`
      const res = await fetch(ddgUrl, {
        headers: { "User-Agent": "EduAI-NotebookBot/1.0" },
        signal: AbortSignal.timeout(8_000),
      })

      if (res.ok) {
        const data = await res.json()
        const results: Array<{ title: string; url: string; snippet: string; score: number }> = []

        if (data.AbstractURL && data.AbstractText) {
          results.push({
            title: data.Heading || trimmedQuery,
            url: data.AbstractURL,
            snippet: data.AbstractText.slice(0, 350),
            score: 0.8,
          })
        }

        ;(Array.isArray(data.RelatedTopics) ? data.RelatedTopics : []).slice(0, 5).forEach(
          (t: { FirstURL?: string; Text?: string; Topics?: unknown[] }, idx: number) => {
            if (t.FirstURL && t.Text && !t.Topics) {
              results.push({
                title: t.Text.slice(0, 80),
                url: t.FirstURL,
                snippet: t.Text.slice(0, 350),
                score: Math.max(0.1, 0.7 - idx * 0.1),
              })
            }
          }
        )

        if (results.length > 0) {
          return NextResponse.json({ results, provider: "duckduckgo" })
        }
      }
    } catch (err) {
      console.warn("[Search] DuckDuckGo failed:", err)
    }

    return NextResponse.json({
      results: [],
      provider: null,
      hint: serperKey
        ? "No se encontraron resultados útiles con los buscadores configurados."
        : "SERPER_API_KEY no configurada. Agrégala en Vercel (Production) y vuelve a desplegar.",
    })
  } catch (err) {
    console.error("[Search] Fatal error:", err)
    return NextResponse.json(
      {
        results: [],
        provider: null,
        error: err instanceof Error ? err.message : "Error interno en búsqueda web",
      },
      { status: 500 }
    )
  }
}
