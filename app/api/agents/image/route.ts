import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, context } = await req.json()

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres AIm. Analizas texto educativo y decides qué visual complementa mejor la explicación.
Responde ÚNICAMENTE con JSON válido.`
        },
        {
          role: "user",
          content: `Analiza este texto educativo y genera el visual más apropiado:

"${context?.slice(0, 600) || ""}"

REGLAS DE DECISIÓN:
- Si el texto menciona valores, datos, comparaciones, estadísticas → "chart"
- Si el texto explica un proceso, pasos, relaciones causa-efecto → "mermaid"  
- Si el texto compara conceptos, características, propiedades → "table"
- Si el texto explica un concepto físico, geométrico, abstracto → "image"
- Si el texto es solo conversacional o saludo → "none"

Para "image": prompt en inglés descriptivo para Stable Diffusion, 15-25 palabras, estilo educativo
Ejemplo: "diagram showing electromagnetic waves with electric and magnetic field components, educational physics illustration, colorful, labeled, white background"

Para "mermaid": SOLO esta sintaxis:
flowchart TD
    A[Texto corto] --> B[Texto corto]
    B --> C[Texto corto]
Máximo 7 nodos. SIN punto y coma en labels. Texto en nodos máximo 3 palabras.

Para "chart": JSON con esta estructura EXACTA (sin markdown, sin bloques de código):
{"type":"bar","data":{"labels":["Label1","Label2","Label3"],"datasets":[{"label":"Nombre","data":[10,20,30],"backgroundColor":["#3b82f6","#8b5cf6","#06b6d4"]}]}}
Tipos válidos: bar, line, pie, doughnut

Para "table": tabla markdown con máximo 4 columnas y 6 filas

Responde con JSON:
{
  "type": "image|mermaid|chart|table|none",
  "title": "título descriptivo corto",
  "imagePrompt": "solo si type=image: prompt en inglés",
  "content": "código mermaid, JSON chart, o tabla markdown. vacío si type=image o none",
  "caption": "explicación breve de qué muestra el visual"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 600,
    })

    const text = completion.choices[0]?.message?.content || ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON")

    const visual = JSON.parse(jsonMatch[0])

    if (visual.type === "none") {
      return Response.json({ type: "none" })
    }

    if (visual.type === "mermaid") {
      visual.content = visual.content
        .replace(/graph\s+(LR|TD|RL|BT);?/g, "flowchart $1")
        .replace(/;(?!\s*$)/g, "")
        .trim()
    }

    if (visual.type === "chart") {
      try {
        const raw = typeof visual.content === "string" ? visual.content : JSON.stringify(visual.content)
        const clean = raw.replace(/```json|```/g, "").trim()
        visual.chartData = JSON.parse(clean)
      } catch {
        visual.type = "none"
      }
    }

    return Response.json(visual)

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}