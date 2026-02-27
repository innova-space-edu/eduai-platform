import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, context, type = "auto" } = await req.json()

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres AIm, el Agente de Imágenes. Generas visuales educativos.
Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.`
        },
        {
          role: "user",
          content: `Tema: "${topic}"
Contexto: "${context?.slice(0, 300) || ""}"
Tipo solicitado: ${type}

Para "image": genera un prompt en inglés para Stable Diffusion. Ejemplo:
"physics concept diagram showing Newton third law action reaction forces, educational infographic, colorful arrows, labeled diagram, clean white background"

Para "mermaid": SOLO esta sintaxis válida:
flowchart TD
    A[Concepto] --> B[Parte 1]
    A --> C[Parte 2]
    B --> D[Resultado]
SIN punto y coma en labels. Máximo 8 nodos. Texto corto en nodos.

Para "chart": JSON exacto:
{"type":"bar","data":{"labels":["A","B","C"],"datasets":[{"label":"Serie","data":[10,20,30],"backgroundColor":["#3b82f6","#8b5cf6","#06b6d4"]}]}}

Para "table": tabla markdown con | col | col | y separador |---|---|

Responde con JSON:
{
  "type": "image|mermaid|chart|table",
  "title": "título corto",
  "imagePrompt": "solo si type es image: prompt en inglés para SD",
  "content": "código mermaid, JSON chart, o tabla markdown según tipo",
  "caption": "descripción breve"
}`
        }
      ],
      temperature: 0.4,
      max_tokens: 500,
    })

    const text = completion.choices[0]?.message?.content || ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")

    const visual = JSON.parse(jsonMatch[0])

    if (visual.type === "mermaid") {
      visual.content = visual.content
        .replace(/graph\s+(LR|TD|RL|BT);?/g, "flowchart $1")
        .replace(/;/g, "")
        .trim()
    }

    if (visual.type === "chart") {
      try {
        visual.chartData = typeof visual.content === "string"
          ? JSON.parse(visual.content)
          : visual.content
      } catch {
        visual.type = "table"
        visual.content = `| Concepto | Descripción |\n|---|---|\n| ${topic} | Ver explicación arriba |`
      }
    }

    return Response.json(visual)

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
