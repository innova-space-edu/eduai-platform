import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const { message, history = [] } = await req.json()

  const messages = [
    { role: "system" as const, content: `Eres un investigador académico experto. Analizas temas en profundidad, buscas información relevante y presentas hallazgos con rigor académico. Citas fuentes cuando es posible, distingues entre hechos verificados y especulación, y estructura tus respuestas con claridad. Usas encabezados, listas y tablas cuando ayudan a la comprensión. Respondes en español a menos que se pida otro idioma.` },
    ...history.map((m: any) => ({ role: m.role as "user"|"assistant", content: m.content })),
    { role: "user" as const, content: message }
  ]
  try {
    const result = await callAI(messages, { maxTokens: 2500 })
    return Response.json({ text: result.text, provider: result.provider })
  } catch (e: any) { return new Response(e.message, { status: 500 }) }
}
