// app/api/web/search/route.ts
// Búsqueda web para agregar fuentes al notebook
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callAI } from "@/lib/ai-router-v4"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { query } = body as { query: string }

  if (!query?.trim()) {
    return NextResponse.json({ error: "query requerida" }, { status: 400 })
  }

  // Usar Tavily si está disponible
  const tavilyKey = process.env.TAVILY_API_KEY
  if (tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key:        tavilyKey,
          query,
          max_results:    6,
          search_depth:   "basic",
          include_answer: false,
        }),
      })
      const data = await res.json()
      const results = (data.results ?? []).map((r: {
        title: string; url: string; content: string; score: number
      }) => ({
        title:   r.title,
        url:     r.url,
        snippet: r.content?.slice(0, 300),
        score:   r.score,
      }))
      return NextResponse.json({ results })
    } catch (err) {
      console.warn("[WebSearch] Tavily failed:", err)
    }
  }

  // Fallback: DuckDuckGo Instant Answer API
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()

    const results: Array<{ title: string; url: string; snippet: string }> = []

    if (data.AbstractURL) {
      results.push({
        title:   data.Heading || query,
        url:     data.AbstractURL,
        snippet: data.AbstractText?.slice(0, 300) ?? "",
      })
    }

    const relTopics = (data.RelatedTopics ?? []).slice(0, 5)
    for (const topic of relTopics) {
      if (topic.FirstURL && topic.Text) {
        results.push({
          title:   topic.Text.slice(0, 80),
          url:     topic.FirstURL,
          snippet: topic.Text.slice(0, 300),
        })
      }
    }

    if (results.length > 0) return NextResponse.json({ results })
  } catch (err) {
    console.warn("[WebSearch] DuckDuckGo failed:", err)
  }

  // Último fallback: usar AI para sugerir URLs
  try {
    const response = await callAI(
      [{
        role: "user",
        content: `Genera 5 resultados de búsqueda web simulados para la consulta: "${query}"
Responde SOLO en JSON:
{"results": [{"title": "...", "url": "https://...", "snippet": "..."}]}
Usa URLs reales y conocidas. Sé específico y educativo.`,
      }],
      { maxTokens: 800, preferProvider: "gemini-lite" }
    )
    const raw     = response.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed  = JSON.parse(raw)
    return NextResponse.json({ results: parsed.results ?? [], simulated: true })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
