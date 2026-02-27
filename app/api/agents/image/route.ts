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

Genera el visual más útil para aprender este concepto.

REGLAS CRÍTICAS para cada tipo:

Para "image": prompt en inglés simple, máximo 20 palabras, estilo educativo

Para "mermaid": usa SOLO esta sintaxis válida:
- flowchart TD (no graph, no LR con punto y coma)
- nodos: A[texto] B(texto) C{texto}
- flechas: A --> B o A -->|label| B
- SIN caracteres especiales: paréntesis, llaves, puntos y coma en labels
- máximo 8 nodos
- ejemplo válido:
flowchart TD
    A[Concepto] --> B[Parte 1]
    A --> C[Parte 2]
    B --> D[Resultado]

Para "chart": JSON con esta estructura exacta:
{"type":"bar","data":{"labels":["A","B","C"],"datasets":[{"label":"Serie","data":[1,2,3],"backgroundColor":["#3b82f6","#8b5cf6","#06b6d4"]}]}}

Para "table": tabla markdown con | col1 | col2 | col3 | y separador |---|---|---|

Responde con este JSON:
{
  "type": "image|mermaid|chart|table",
  "title": "título corto",
  "content": "el prompt, código mermaid, JSON de chart, o tabla markdown",
  "caption": "qué muestra este visual en una oración"
}`
        }
      ],
      temperature: 0.4,
      max_tokens: 600,
    })

    const text = completion.choices[0]?.message?.content || ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")

    const visual = JSON.parse(jsonMatch[0])

    // Limpiar mermaid de caracteres problemáticos
    if (visual.type === "mermaid") {
      visual.content = visual.content
        .replace(/graph\s+(LR|TD|RL|BT);?/g, "flowchart $1")
        .replace(/-->|>/g, "-->")
        .replace(/\(/g, "[").replace(/\)/g, "]")
        .replace(/;/g, "")
        .trim()
    }

    // Generar URL de imagen con Pollinations
    if (visual.type === "image") {
      const prompt = `Educational diagram about ${visual.content}, clean infographic, colorful, white background, modern flat design, no text`
      visual.url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}&width=800&height=450&model=flux&nologo=true&seed=${Date.now()}`
    }

    // Parsear chart
    if (visual.type === "chart") {
      try {
        visual.chartData = typeof visual.content === "string"
          ? JSON.parse(visual.content)
          : visual.content
      } catch {
        // fallback a tabla si el JSON del chart falla
        visual.type = "table"
        visual.content = "| Concepto | Descripción |\n|---|---|\n| " + topic + " | Ver explicación arriba |"
      }
    }

    return Response.json(visual)

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
