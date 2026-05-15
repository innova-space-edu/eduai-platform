// app/api/agents/claw-chat/route.ts
// Endpoint de compatibilidad para el botón flotante de Claw.
// Ahora usa el mismo núcleo del SuperAgent (/api/superagent/chat) para evitar
// rutas duplicadas y mantener integradas las herramientas nuevas.

import { NextRequest, NextResponse } from "next/server"
import { runCoreCycle } from "@/lib/superagent/superagent-core"
import type { CoreMessage } from "@/lib/superagent/superagent-core"

const AGENT_ROUTES: Record<string, { label: string; href: string; emoji: string }> = {
  study:         { label: "Estudiar un tema",         href: "/study",        emoji: "📚" },
  educador:      { label: "Planificador docente",      href: "/educador",     emoji: "🏫" },
  investigador:  { label: "Investigador académico",    href: "/investigador", emoji: "🔬" },
  redactor:      { label: "Redactor de documentos",    href: "/redactor",     emoji: "✍️" },
  matematico:    { label: "Matemático IA",             href: "/matematico",   emoji: "🧮" },
  traductor:     { label: "Traductor",                 href: "/traductor",    emoji: "🌐" },
  imagenes:      { label: "Image Studio",              href: "/image-studio", emoji: "🎨" },
  galeria:       { label: "Galería de imágenes",       href: "/galeria",      emoji: "🖼️" },
  paper:         { label: "Paper académico",           href: "/paper",        emoji: "📄" },
  audiolab:      { label: "Audio Lab",                 href: "/audio-lab",    emoji: "🎙️" },
  videostudio:   { label: "Video Studio",              href: "/video-studio", emoji: "🎬" },
  examfocus:     { label: "Exam Focus",                href: "/exam-focus",   emoji: "🎵" },
  aisocial:      { label: "Chat social de agentes",    href: "/ai-social",    emoji: "💬" },
  examen:        { label: "Crear examen",              href: "/examen/crear", emoji: "📝" },
  creator:       { label: "Creator Hub",               href: "/creator-hub",  emoji: "🚀" },
  workspace:     { label: "Mis proyectos",             href: "/workspace",    emoji: "📁" },
  collab:        { label: "Estudio colaborativo",      href: "/collab",       emoji: "🤝" },
}

function normalizeHistory(history: unknown, message: string): CoreMessage[] {
  const safeHistory = Array.isArray(history)
    ? history
        .filter((m): m is { role: string; content: string } =>
          m && typeof m.role === "string" && typeof m.content === "string"
        )
        .slice(-10)
        .map((m): CoreMessage => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }))
    : []

  const last = safeHistory[safeHistory.length - 1]
  if (!last || last.role !== "user" || last.content.trim() !== message.trim()) {
    safeHistory.push({ role: "user", content: message })
  }

  return safeHistory
}

function buildSuggestions(reply: string, toolUsed?: string) {
  const suggestions: { label: string; href: string; emoji: string }[] = []

  for (const agent of Object.values(AGENT_ROUTES)) {
    if (reply.includes(agent.href) && !suggestions.find(s => s.href === agent.href)) {
      suggestions.push(agent)
    }
  }

  const toolMap: Record<string, keyof typeof AGENT_ROUTES> = {
    generate_image: "imagenes",
    generate_image_prompt: "imagenes",
    generate_edu_video: "videostudio",
    recommend_focus_music: "examfocus",
    narrate_text: "audiolab",
    generate_exam_questions: "examen",
    generate_rubric: "examen",
    plan_curriculum: "educador",
    generate_code: "creator",
    fix_code_error: "creator",
  }

  const key = toolUsed ? toolMap[toolUsed] : undefined
  if (key) {
    const agent = AGENT_ROUTES[key]
    if (agent && !suggestions.find(s => s.href === agent.href)) suggestions.unshift(agent)
  }

  return suggestions.slice(0, 3)
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], userName } = await req.json()
    const cleanMessage = String(message || "").trim()

    if (!cleanMessage) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })
    }

    const messages = normalizeHistory(history, cleanMessage)
    const result = await runCoreCycle(
      messages,
      {
        currentPage: "floating-claw",
        userId: typeof userName === "string" ? userName : undefined,
      },
      req.nextUrl.origin,
      { headers: req.headers }
    )

    return NextResponse.json({
      reply: result.text,
      suggestions: buildSuggestions(result.text, result.toolUsed),
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      toolUsed: result.toolUsed,
      wasToolCall: result.wasToolCall,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    )
  }
}
