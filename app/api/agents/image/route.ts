import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, context, type = "auto" } = await req.json()

  try {
    // AIm decide qué tipo de visual generar y el prompt
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres AIm, el Agente de Imágenes. Decides qué tipo de visual es más útil para explicar un concepto y generas los datos necesarios.
Responde ÚNICAMENTE con JSON válido, sin texto adicional.`
        },
        {
          role: "user",
          content: `Tema: "${topic}"
Contexto: "${context?.slice(0, 300) || ""}"
Tipo solicitado: ${type}

Decide el mejor tipo de visual y genera los datos.
Opciones de tipo: "image" | "mermaid" | "chart" | "table"

Para "image": genera un prompt en inglés detallado para FLUX (ilustración educativa)
Para "mermaid": genera el código mermaid del diagrama
Para "chart": genera datos JSON para Chart.js
Para "table": genera una tabla markdown

Devuelve este JSON:
{
  "type": "image|mermaid|chart|table",
  "title": "título descriptivo del visual",
  "reasoning": "por qué este tipo de visual es el mejor para este tema",
  "content": "el prompt, código mermaid, JSON de chart, o tabla markdown según el tipo",
  "caption": "descripción breve para el estudiante"
}`
        }
      ],
      temperature: 0.7,
      max_tokens: 800,
    })

    const text = completion.choices[0]?.message?.content || ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")

    const visual = JSON.parse(jsonMatch[0])

    // Si es imagen, generar URL de Pollinations
    if (visual.type === "image") {
      const encodedPrompt = encodeURIComponent(
        `Educational illustration: ${visual.content}, clean, colorful, modern infographic style, white background, high quality`
      )
      visual.url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=500&model=flux&nologo=true&seed=${Math.floor(Math.random() * 9999)}`
    }

    // Si es chart, parsear el contenido
    if (visual.type === "chart") {
      try {
        visual.chartData = typeof visual.content === "string"
          ? JSON.parse(visual.content)
          : visual.content
      } catch {
        visual.type = "table"
      }
    }

    return Response.json(visual)

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
