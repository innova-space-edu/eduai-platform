import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const { message, history = [] } = await req.json()

  const messages = [
    { role: "system" as const, content: `Eres un redactor profesional experto en escritura académica, periodística y corporativa. Produces textos bien estructurados, con vocabulario apropiado al contexto, buena sintaxis y coherencia. Adaptas el tono según el tipo de documento (formal, académico, informativo, narrativo). Cuando redactas documentos completos, los estructuras con encabezados, introducción, desarrollo y conclusión. Respondes en español a menos que se pida otro idioma.` },
    ...history.map((m: any) => ({ role: m.role as "user"|"assistant", content: m.content })),
    { role: "user" as const, content: message }
  ]
  try {
    const result = await callAI(messages, { maxTokens: 3000 })
    return Response.json({ text: result.text, provider: result.provider })
  } catch (e: any) { return new Response(e.message, { status: 500 }) }
}
