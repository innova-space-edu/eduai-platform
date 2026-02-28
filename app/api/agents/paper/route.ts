import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { message, history = [], paperContent = "", paperTitle = "" } = await req.json()

  const systemPrompt = `Eres APaper, un agente especializado en análisis profundo de documentos académicos y papers científicos.

DOCUMENTO CARGADO:
Título: "${paperTitle}"
Contenido:
---
${paperContent.slice(0, 12000)}
---

TUS CAPACIDADES:
1. Responder preguntas específicas sobre el paper con citas textuales
2. Explicar metodologías, resultados y conclusiones
3. Cuestionar críticamente los argumentos del paper
4. Comparar con literatura existente
5. Identificar limitaciones y sesgos
6. Extraer datos clave, fórmulas y hallazgos
7. Generar resúmenes por sección
8. Debatir las implicaciones de los resultados

ESTILO:
- Cita partes específicas del texto cuando respondas
- Sé crítico y académico — no solo describas, analiza
- Si el usuario pregunta algo que no está en el paper, dilo claramente
- Usa formato estructurado con markdown
- Para fórmulas matemáticas usa LaTeX: $formula$

Responde en español a menos que el usuario pida otro idioma.`

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-12).map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content
    })),
    { role: "user" as const, content: message }
  ]

  try {
    const result = await callAI(messages, { maxTokens: 3000, preferProvider: "groq" })
    return Response.json({ text: result.text, provider: result.provider })
  } catch (e: any) {
    return new Response(e.message, { status: 500 })
  }
}
