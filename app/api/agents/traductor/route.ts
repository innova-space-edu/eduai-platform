import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const { message, history = [], idiomaTarget = "Inglés" } = await req.json()

  const messages = [
    { role: "system" as const, content: `Eres un traductor e intérprete profesional experto en lingüística. Cuando traduces: 1) Das la traducción principal, 2) Explicas matices o expresiones idiomáticas, 3) Señalas diferencias culturales si son relevantes, 4) Ofreces alternativas cuando hay varias opciones válidas. Idioma objetivo actual: ${idiomaTarget}. Si el usuario pide otro idioma, te adaptas. También explicas gramática cuando se solicita. Usas español para las explicaciones y el idioma solicitado para las traducciones.` },
    ...history.map((m: any) => ({ role: m.role as "user"|"assistant", content: m.content })),
    { role: "user" as const, content: message }
  ]
  try {
    const result = await callAI(messages, { maxTokens: 2000 })
    return Response.json({ text: result.text, provider: result.provider })
  } catch (e: any) { return new Response(e.message, { status: 500 }) }
}
