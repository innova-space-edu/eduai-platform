import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

const VISUAL_TOPICS = [
  "anatomía", "biología", "célula", "órgano", "cuerpo humano",
  "geografía", "mapa", "continente", "país", "ciudad", "río", "montaña",
  "física", "fuerza", "movimiento", "óptica", "circuito", "onda",
  "química", "molécula", "átomo", "reacción", "elemento", "tabla periódica",
  "astronomía", "planeta", "estrella", "galaxia", "sistema solar", "universo",
  "arquitectura", "construcción", "estructura", "edificio",
  "historia", "batalla", "guerra", "civilización", "artefacto",
  "matemáticas", "geometría", "función", "gráfico", "diagrama",
  "animales", "especie", "ecosistema", "habitat",
  "tecnología", "máquina", "motor", "dispositivo", "circuito",
]

function quickCheck(topic: string, context: string): boolean {
  const text = (topic + " " + context).toLowerCase()
  return VISUAL_TOPICS.some(kw => text.includes(kw))
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, context } = await req.json()

  // Quick check primero — evitar llamada a IA si no es necesario
  if (!quickCheck(topic, context)) {
    return Response.json({ shouldGenerate: false })
  }

  // Confirmación con IA para reducir falsos positivos
  const messages = [
    {
      role: "system" as const,
      content: `You analyze educational content and decide if a visual image would help understanding.
Answer ONLY with a JSON object: {"shouldGenerate": true/false, "imagePrompt": "..."}
- shouldGenerate: true only if an image would SIGNIFICANTLY help understand the concept
- imagePrompt: a specific English image prompt if shouldGenerate is true, otherwise ""
Keep imagePrompt under 50 words, focused on the core visual concept.`
    },
    {
      role: "user" as const,
      content: `Topic: "${topic}"
Content summary (first 300 chars): "${context.substring(0, 300)}"

Would a visual image help understand this content? If yes, what specific image?`
    }
  ]

  try {
    const result = await callAI(messages, { maxTokens: 150, preferProvider: "groq" })
    const text = result.text.trim()
    const jsonMatch = text.match(/\{[^}]+\}/)
    if (!jsonMatch) return Response.json({ shouldGenerate: false })
    const parsed = JSON.parse(jsonMatch[0])
    return Response.json({
      shouldGenerate: !!parsed.shouldGenerate,
      imagePrompt: parsed.imagePrompt || ""
    })
  } catch {
    return Response.json({ shouldGenerate: false })
  }
}
