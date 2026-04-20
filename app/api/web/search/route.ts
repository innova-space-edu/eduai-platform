// app/api/web/search/route.ts  v4
// Orden: Serper → Tavily → Investigador (Google Search grounding) → DuckDuckGo → vacío
// El agente Investigador como penúltimo recurso devuelve resultados con Google grounding real

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 25

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { query } = body as { query: string }

  if (!query?.trim()) {
    return NextResponse.json({ error: "query requerida" }, { status: 400 })
  }

  // ─── 1. Serper.dev (Google Search) ─────────────────────────────────────────
  const serperKey = process.env.SERPER_API_KEY
  if (serperKey) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": serperKey },
        body:    JSON.stringify({ q: query.trim(), num: 6, hl: "es", gl: "cl" }),
        signal:  AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const data = await res.json()
        const results = (data.organic ?? []).slice(0, 6).map((r: {
          title: string; link: string; snippet: string; position: number
        }) => ({
          title:   r.title,
          url:     r.link,
          snippet: r.snippet?.slice(0, 350) ?? "",
          score:   1 - (r.position - 1) * 0.1,
        }))
        if (results.length > 0) return NextResponse.json({ results, provider: "serper" })
      }
    } catch (err) { console.warn("[Search] Serper failed:", err) }
  }

  // ─── 2. Tavily ──────────────────────────────────────────────────────────────
  const tavilyKey = process.env.TAVILY_API_KEY
  if (tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ api_key: tavilyKey, query: query.trim(), max_results: 6, search_depth: "basic" }),
        signal:  AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const data = await res.json()
        const results = (data.results ?? []).map((r: {
          title: string; url: string; content: string; score: number
        }) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 350) ?? "", score: r.score }))
        if (results.length > 0) return NextResponse.json({ results, provider: "tavily" })
      }
    } catch (err) { console.warn("[Search] Tavily failed:", err) }
  }

  // ─── 3. Agente Investigador (Gemini + Google Search grounding) ─────────────
  // Aprovecha el agente existente de EduAI para obtener fuentes reales
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    try {
      const GEMINI_MODEL = process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash"
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: `Encuentra 6 páginas web confiables sobre: "${query}". 
Para cada una da: título, URL exacta, y una descripción de 2-3 oraciones.
Solo devuelve páginas reales que existan. Responde en JSON:
{"results":[{"title":"...","url":"https://...","snippet":"..."}]}` }]
            }],
            tools: [{ google_search: {} }],
            generationConfig: { maxOutputTokens: 1000, temperature: 0.1 },
          }),
          signal: AbortSignal.timeout(15_000),
        }
      )
      if (res.ok) {
        const data = await res.json()

        // Extraer fuentes del grounding metadata (URLs reales verificadas)
        const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
        if (groundingChunks.length > 0) {
          const results = groundingChunks
            .filter((c: { web?: { uri: string; title?: string } }) => c.web?.uri)
            .slice(0, 6)
            .map((c: { web: { uri: string; title?: string } }) => ({
              title:   c.web.title ?? c.web.uri,
              url:     c.web.uri,
              snippet: "",
              score:   0.7,
            }))
          if (results.length > 0) return NextResponse.json({ results, provider: "investigador" })
        }

        // Fallback: parsear JSON del texto si el grounding no retornó chunks
        const text = data.candidates?.[0]?.content?.parts
          ?.filter((p: { text?: string }) => p.text)
          .map((p: { text: string }) => p.text).join("")
        if (text) {
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (Array.isArray(parsed.results) && parsed.results.length > 0) {
              return NextResponse.json({ results: parsed.results, provider: "investigador" })
            }
          }
        }
      }
    } catch (err) { console.warn("[Search] Investigador/Gemini failed:", err) }
  }

  // ─── 4. DuckDuckGo Instant Answer (último recurso) ─────────────────────────
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
        results.push({ title: data.Heading || query, url: data.AbstractURL, snippet: data.AbstractText.slice(0, 350) })
      }
      ;(data.RelatedTopics ?? []).slice(0, 5).forEach((t: { FirstURL?: string; Text?: string; Topics?: unknown[] }) => {
        if (t.FirstURL && t.Text && !t.Topics) {
          results.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text.slice(0, 350) })
        }
      })
      if (results.length > 0) return NextResponse.json({ results, provider: "duckduckgo" })
    }
  } catch (err) { console.warn("[Search] DuckDuckGo failed:", err) }

  return NextResponse.json({
    results:  [],
    provider: null,
    hint:     "Configura SERPER_API_KEY en las variables de entorno para activar búsqueda web completa.",
  })
}
