import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { base64, filename } = await req.json()

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
      {
        text: `Extract ALL text from this document preserving structure, titles, sections and formulas.
Then generate a 3-4 sentence executive summary of the most important points.

IMPORTANT: Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation:
{"title":"document title","text":"full extracted text","summary":"executive summary 3-4 sentences"}

Rules:
- Keep the original language of the document (Spanish, English, etc.)
- Preserve mathematical formulas as LaTeX when possible
- Include ALL sections: abstract, introduction, methodology, results, conclusions
- The summary must be in the same language as the document`
      }
    ])

    const raw = result.response.text().trim()

    // Parser robusto — múltiples estrategias
    let data: any = null

    // Estrategia 1: JSON directo
    try { data = JSON.parse(raw); } catch {}

    // Estrategia 2: extraer bloque JSON
    if (!data) {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try { data = JSON.parse(match[0]); } catch {}
      }
    }

    // Estrategia 3: JSON dentro de código markdown
    if (!data) {
      const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (mdMatch) {
        try { data = JSON.parse(mdMatch[1].trim()); } catch {}
      }
    }

    // Estrategia 4: construir manualmente si Gemini respondió en texto libre
    if (!data) {
      data = {
        title: filename?.replace(/\.pdf$/i, "") || "Documento",
        text: raw.length > 100 ? raw : "",
        summary: raw.length > 100 ? raw.slice(0, 400) : "No se pudo extraer el texto automáticamente.",
        error: raw.length <= 100,
      }
    }

    // Asegurar campos mínimos
    data.title = data.title || filename?.replace(/\.pdf$/i, "") || "Documento"
    data.text  = data.text  || ""
    data.summary = data.summary || ""

    return Response.json(data)

  } catch (e: any) {
    console.error("PDF extraction error:", e.message)
    return Response.json({
      title: filename?.replace(/\.pdf$/i, "") || "Documento",
      text: "",
      summary: "No se pudo extraer el texto automáticamente.",
      error: true,
    })
  }
}
