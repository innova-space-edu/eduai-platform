import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { base64, filename } = await req.json()

  try {
    // Usar Gemini para extraer texto del PDF (soporta documentos nativamente)
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
      {
        text: `Extrae TODO el texto de este documento de forma estructurada. 
Mantén los títulos, secciones, fórmulas y estructura original.
Luego genera un resumen ejecutivo de 3-4 oraciones de los puntos más importantes.

Responde en este formato JSON exacto:
{
  "title": "título del documento",
  "text": "texto completo extraído",
  "summary": "resumen ejecutivo en 3-4 oraciones"
}`
      }
    ])

    const raw = result.response.text()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No se pudo extraer el texto")

    const data = JSON.parse(jsonMatch[0])
    return Response.json(data)

  } catch (e: any) {
    // Fallback: si Gemini falla, intentar con texto del nombre del archivo
    console.error("PDF extraction error:", e.message)

    // Retornar estructura vacía para que el usuario pueda pegar el texto manualmente
    return Response.json({
      title: filename?.replace(".pdf", "") || "Documento",
      text: "",
      summary: "No se pudo extraer el texto automáticamente.",
      error: true,
    })
  }
}
