// app/api/agents/claw-chat/route.ts
import { NextRequest, NextResponse } from "next/server"

const AGENT_ROUTES: Record<string, { label: string; href: string; emoji: string }> = {
  study:         { label: "Estudiar un tema",         href: "/study",        emoji: "📚" },
  educador:      { label: "Planificador docente",      href: "/educador",     emoji: "🏫" },
  investigador:  { label: "Investigador académico",    href: "/investigador", emoji: "🔬" },
  redactor:      { label: "Redactor de documentos",    href: "/redactor",     emoji: "✍️" },
  matematico:    { label: "Matemático IA",             href: "/matematico",   emoji: "🧮" },
  traductor:     { label: "Traductor",                 href: "/traductor",    emoji: "🌐" },
  imagenes:      { label: "Generador de imágenes",     href: "/imagenes",     emoji: "🎨" },
  paper:         { label: "Paper académico",           href: "/paper",        emoji: "📄" },
  audiolab:      { label: "Audio Lab",                 href: "/audio-lab",    emoji: "🎙️" },
  videostudio:   { label: "Video Studio",              href: "/video-studio", emoji: "🎬" },
  aisocial:      { label: "Chat social de agentes",    href: "/ai-social",    emoji: "💬" },
  examen:        { label: "Crear examen",              href: "/examen/crear", emoji: "📝" },
  creator:       { label: "Creator Hub",               href: "/creator-hub",  emoji: "🚀" },
  workspace:     { label: "Mis proyectos",             href: "/workspace",    emoji: "📁" },
  collab:        { label: "Estudio colaborativo",      href: "/collab",       emoji: "🤝" },
}

async function callAI(system: string, msgs: { role: string; content: string }[]): Promise<string> {
  // Try Gemini first
  const gKey = process.env.GEMINI_API_KEY
  if (gKey) {
    try {
      const contents = msgs.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }))
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { temperature: 0.85, maxOutputTokens: 1200 },
          }),
          signal: AbortSignal.timeout(18000),
        }
      )
      if (res.ok) {
        const d = await res.json()
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) return text
      }
    } catch {}
  }

  // Fallback: Groq
  const gqKey = process.env.GROQ_API_KEY
  if (!gqKey) throw new Error("Sin API key disponible")
  const Groq = (await import("groq-sdk")).default
  const groq = new Groq({ apiKey: gqKey })
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.85,
    max_tokens: 1200,
    messages: [
      { role: "system", content: system },
      ...msgs.map(m => ({
        role: m.role === "assistant" ? "assistant" as const : "user" as const,
        content: m.content,
      })),
    ],
  })
  return res.choices[0]?.message?.content || ""
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], userName } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })

    const agentList = Object.values(AGENT_ROUTES)
      .map(a => `- ${a.emoji} ${a.label}: ${a.href}`)
      .join("\n")

    const system = `Eres Claw, el asistente personal y amigo de EduAI. Eres cálido, cercano y genuinamente útil — como ese amigo inteligente con el que puedes hablar de cualquier cosa.

Tu forma de ser:
- Natural y cercano, nunca corporativo ni frío
- Escuchas de verdad y empatizas antes de dar consejos
- Puedes hablar de cualquier tema: vida cotidiana, trabajo, relaciones, proyectos, dudas, ideas, lo que sea
- Usas humor ligero cuando es apropiado
- Eres honesto: si no sabes algo, lo dices sin rodeos
- Cuando el usuario necesita hacer algo en EduAI, le recomiendas el agente ideal con el link directo
- Puedes ayudar tú mismo con: explicar conceptos, dar ideas, hacer brainstorming, redactar algo rápido, aconsejar, etc.

Agentes disponibles en EduAI (mencionarlos solo cuando sean útiles):
${agentList}

Formato de links: [Nombre](href) — ejemplo: [Matemático IA](/matematico)

Reglas importantes:
- Responde siempre en español
- Máximo 3-4 párrafos cortos — nada de paredes de texto
- No empieces con "¡Hola!" si ya hay historial
- El nombre del usuario es: ${userName || "amigo/a"}
- Sé tú mismo: cálido, directo, útil`

    const msgs = [
      ...(history as { role: string; content: string }[]).slice(-10),
      { role: "user", content: message },
    ]

    const reply = await callAI(system, msgs)

    // Detect agent suggestions from reply
    const suggestions: { label: string; href: string; emoji: string }[] = []
    for (const agent of Object.values(AGENT_ROUTES)) {
      if (reply.includes(agent.href)) {
        if (!suggestions.find(s => s.href === agent.href)) suggestions.push(agent)
      }
    }

    return NextResponse.json({ reply, suggestions: suggestions.slice(0, 3) })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 })
  }
}
