import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const { message, history = [] } = await req.json()

  const messages = [
    { role: "system" as const, content: `Eres un profesor de matemáticas experto. Resuelves problemas paso a paso con explicaciones claras. Para cada problema: 1) Identificas qué tipo de problema es, 2) Explicas el concepto subyacente, 3) Resuelves paso a paso numerando cada paso, 4) Verificas el resultado, 5) Ofreces variaciones o problemas similares. Usas notación matemática clara (con LaTeX cuando es apropiado). Respondes siempre en español.` },
    ...history.map((m: any) => ({ role: m.role as "user"|"assistant", content: m.content })),
    { role: "user" as const, content: message }
  ]
  try {
    const result = await callAI(messages, { maxTokens: 2500 })
    return Response.json({ text: result.text, provider: result.provider })
  } catch (e: any) { return new Response(e.message, { status: 500 }) }
}
