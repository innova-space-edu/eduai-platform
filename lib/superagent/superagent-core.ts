// lib/superagent/superagent-core.ts
// ─────────────────────────────────────────────────────────────────────────────
// Núcleo del SuperAgent con capacidad de chat + herramientas.
// NO reemplaza engine.ts (que sigue siendo el motor de sugerencias/observación).
// La conversación final pasa por EduAI AI Gateway para compartir permisos,
// reutilización, proveedores y observabilidad con el resto de la plataforma.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAIText, type GatewayMessage } from "@/lib/ai/gateway"
import { detectToolFromMessage, getToolByName, getEnabledTools } from "./tool-registry"
import type { ToolExecutionOptions, ToolName, ToolResult } from "./tool-registry"
import {
  buildStudyHref,
  extractStudyTopicFromMessage,
  findBestEduAIPage,
  isNavigationIntent,
  isStudyIntent,
  searchEduAIPages,
} from "./eduai-map"

export type CoreTaskType = "coding" | "reasoning" | "long_context" | "general"

export interface CoreMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface CoreContext {
  userId?: string
  currentPage?: string
  subject?: string
  examTitle?: string
  studentCourse?: string
  pieMode?: boolean
  pageMode?: string
  availableActions?: string[]
  requestedTool?: string
}

export interface CoreAIRuntime {
  supabase?: SupabaseClient | null
  userId?: string
  module?: string
  workspaceId?: string | null
  latencyMode?: "balanced" | "fast"
}

export interface CoreResponse {
  text: string
  provider: string
  model: string
  task: CoreTaskType
  latencyMs?: number
  toolUsed?: ToolName
  toolResult?: ToolResult
  wasToolCall: boolean
  reused?: boolean
}

export function buildCoreSystemPrompt(context: CoreContext): string {
  const activeContext = [
    context.currentPage ? `Página: ${context.currentPage}` : "",
    context.pageMode ? `Usuario/modo: ${context.pageMode}` : "",
    context.subject ? `Tema/asignatura: ${context.subject}` : "",
    context.examTitle ? `Contexto activo: ${context.examTitle}` : "",
    context.studentCourse ? `Curso/subtema: ${context.studentCourse}` : "",
    context.availableActions?.length
      ? `Herramientas disponibles: ${context.availableActions.slice(0, 8).join(", ")}`
      : "",
    context.pieMode ? "Modo PIE/NEE activo." : "",
  ].filter(Boolean).join("\n")

  return `Eres Claw, el copiloto de EduAI para personas e instituciones educativas. Conversa con naturalidad y crea resultados útiles. No asumas profesión, institución, ciudad ni país si no están en el contexto.

CONTEXTO:
${activeContext || "Sin contexto adicional."}

REGLAS:
- Responde en el idioma del último mensaje.
- Prioriza la respuesta concreta; no repitas el contexto ni presentes capacidades que no se pidieron.
- En conversación cotidiana responde breve (2–6 oraciones). Amplía sólo cuando la tarea lo requiera.
- Si falta un dato imprescindible, pregunta sólo uno.
- Para matemática usa LaTeX.
- Si entregas un producto educativo, hazlo directamente utilizable.
- Si mencionas una ruta interna, usa enlace Markdown exacto.
- No afirmes que ejecutaste una acción si sólo estás explicando.
- Las herramientas son operadas por el router de EduAI antes de llegar a esta conversación; no inventes ejecuciones.
- Mantén formato limpio y evita introducciones largas.`
}
export function detectCoreAITask(message: string): CoreTaskType {
  const m = message.toLowerCase()
  if (/código|code|typescript|react|bug|función|api/.test(m)) return "coding"
  if (/analiza|razona|deduce|compara|demuestra|planifica/.test(m)) return "reasoning"
  if (message.length > 3000) return "long_context"
  return "general"
}

export function coreGatewayCapability(task: CoreTaskType): "text" | "code" | "long_context" {
  if (task === "coding") return "code"
  if (task === "long_context") return "long_context"
  return "text"
}


export function coreTokenBudget(task: CoreTaskType, fast = false) {
  if (!fast) return task === "long_context" ? 4000 : 2200
  if (task === "long_context") return 2600
  if (task === "coding") return 1800
  if (task === "reasoning") return 1400
  return 900
}

function extractToolArgs(toolName: ToolName, message: string): Record<string, unknown> {
  const args: Record<string, unknown> = {}

  switch (toolName) {
    case "generate_exam_questions":
      args.topic = message.replace(/genera(r)?.*preguntas?(.*de|.*sobre)?/i, "").trim() || message
      args.count = 5
      break

    case "adapt_for_pie":
      args.content = message.replace(/adapt(a|ar)?\s*(para|el)?\s*(pie|nee|dislexia|tdah)?/i, "").trim() || message
      args.dyslexia = /dislexia/i.test(message)
      args.adhd = /tdah/i.test(message)
      args.tea = /tea/i.test(message)
      args.tel = /tel\b/i.test(message)
      args.low_vision = /baja\s*visión/i.test(message)
      break

    case "plan_curriculum":
      args.topic = message
      args.sessions = 3
      break

    case "explain_concept":
      args.concept = message.replace(/explic(a|ar)?\s*(el|la|qué\s*es)?/i, "").trim() || message
      break

    case "generate_rubric":
      args.task = message.replace(/rubric(a|)?\s*(de|para)?/i, "").trim() || message
      args.points = 20
      break

    case "summarize_text":
      args.text = message.replace(/resum(e|ir|en)?\s*(este|el|texto)?/i, "").trim() || message
      args.lines = 5
      break

    case "translate_text":
      args.text = message.replace(/traduc(e|ir|ción)?\s*(al?\s*\w+)?/i, "").trim() || message
      args.target = /inglés/i.test(message) ? "Inglés"
        : /francés/i.test(message) ? "Francés"
        : /portugués/i.test(message) ? "Portugués"
        : "Español"
      break

    case "generate_image_prompt":
      args.concept = message.replace(/prompt.*(imagen|ilustrac|visual)/i, "").trim() || message
      break

    default: {
      const definition = getToolByName(toolName)
      const primaryStringParam =
        definition?.params.find((param) => param.required && param.type === "string") ||
        definition?.params.find((param) => param.type === "string")

      if (primaryStringParam) args[primaryStringParam.name] = message
      args.content = message
      break
    }
  }

  return args
}

function markdownPageList(query: string) {
  const matches = searchEduAIPages(query, 5)
  if (matches.length === 0) {
    return "No encontré una herramienta exacta, pero puedes abrir [Creator Hub](/creator-hub) o [Agentes EduAI](/agentes)."
  }

  return matches
    .map((page) => `- ${page.emoji} [${page.label}](${page.href}) — ${page.description}`)
    .join("\n")
}

function buildStudyAction(userText: string, context: CoreContext, t0: number): CoreResponse {
  const topic = extractStudyTopicFromMessage(userText) || context.subject || "tema general"
  const href = buildStudyHref(topic)
  return {
    text: `📚 **Sesión de estudio lista**\n\nPuedes iniciar una sesión autónoma sobre **${topic}** aquí: [Abrir sesión de estudio](${href}).\n\nSugerencia de uso:\n1. Parte por **Teoría** para entender la idea central.\n2. Sigue con **Ejemplos** para ver procedimientos.\n3. Termina con **Ejercicios** o **Sócrates** para practicar sin que te dé la respuesta al tiro.`,
    provider: "EduAI Router",
    model: "Study Navigator",
    task: "general",
    latencyMs: Date.now() - t0,
    wasToolCall: true,
  }
}

function buildNavigationAction(userText: string, t0: number): CoreResponse | null {
  const page = findBestEduAIPage(userText)
  if (!page) return null

  return {
    text: `${page.emoji} **${page.label}**\n\n${page.description}\n\nAbrir ahora: [${page.label}](${page.href}).`,
    provider: "EduAI Router",
    model: "Internal Page Map",
    task: "general",
    latencyMs: Date.now() - t0,
    wasToolCall: true,
  }
}

function buildSearchAction(userText: string, t0: number): CoreResponse {
  return {
    text: `🔎 **Herramientas relacionadas dentro de EduAI**\n\n${markdownPageList(userText)}`,
    provider: "EduAI Router",
    model: "Internal Page Search",
    task: "general",
    latencyMs: Date.now() - t0,
    wasToolCall: true,
  }
}

function trySafeInternalAction(userText: string, context: CoreContext, t0: number): CoreResponse | null {
  const text = userText.toLowerCase()

  if (isStudyIntent(userText)) return buildStudyAction(userText, context, t0)

  if (/buscar\s+(herramienta|pagina|página|en eduai)|que herramientas|qué herramientas|donde esta|dónde está/i.test(userText)) {
    return buildSearchAction(userText, t0)
  }

  if (isNavigationIntent(userText) || /\b(qr studio|creator hub|image studio|audio lab|chat paper|crear examen|mis examenes|mis exámenes)\b/i.test(text)) {
    return buildNavigationAction(userText, t0)
  }

  return null
}


export function canStreamCoreAI(userText: string, context: CoreContext = {}) {
  if (context.requestedTool) return false
  if (trySafeInternalAction(userText, context, Date.now())) return false
  return !detectToolFromMessage(userText)
}

export async function runCoreCycle(
  messages: CoreMessage[],
  context: CoreContext = {},
  baseUrl: string = "",
  options: ToolExecutionOptions = {},
  aiRuntime: CoreAIRuntime = {},
): Promise<CoreResponse> {
  const t0 = Date.now()
  const lastUser = [...messages].reverse().find((message) => message.role === "user")
  const userText = lastUser?.content ?? ""

  const requestedTool = context.requestedTool
    ? getEnabledTools().find((tool) => tool.name === context.requestedTool)?.name
    : undefined

  const safeAction = requestedTool ? null : trySafeInternalAction(userText, context, t0)
  if (safeAction) return safeAction

  const toolName = requestedTool || detectToolFromMessage(userText)

  if (toolName) {
    const tool = getToolByName(toolName)
    if (tool?.enabled) {
      const args = extractToolArgs(toolName, userText)
      const result = await tool.execute(args, baseUrl, options)

      if (result.success) {
        return {
          text: result.output,
          provider: "EduAI Tools",
          model: tool.label,
          task: "general",
          latencyMs: Date.now() - t0,
          toolUsed: toolName,
          toolResult: result,
          wasToolCall: true,
        }
      }

      return {
        text: `${result.output}${result.error ? `\n\nDetalle técnico: ${result.error}` : ""}`,
        provider: "EduAI Tools",
        model: tool.label,
        task: "general",
        latencyMs: Date.now() - t0,
        toolUsed: toolName,
        toolResult: result,
        wasToolCall: true,
      }
    }
  }

  const systemPrompt = buildCoreSystemPrompt(context)
  const task = detectCoreAITask(userText)
  const aiMessages: GatewayMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content } as GatewayMessage)),
  ]

  const effectiveUserId = aiRuntime.userId || context.userId
  const result = await runAIText({
    messages: aiMessages,
    capability: coreGatewayCapability(task),
    maxOutputTokens: coreTokenBudget(task, aiRuntime.latencyMode === "fast"),
    preferredProvider: aiRuntime.latencyMode === "fast" && task === "general" ? "groq" : undefined,
    fallbackToDefault: aiRuntime.latencyMode === "fast",
    lite: aiRuntime.latencyMode === "fast" && task === "general",
    fastPath: aiRuntime.latencyMode === "fast",
    context: effectiveUserId
      ? {
          userId: effectiveUserId,
          workspaceId: aiRuntime.workspaceId || null,
          module: aiRuntime.module || "claw",
          reusePolicy: aiRuntime.latencyMode === "fast" ? "never" : "exact_private",
          visibility: "private",
        }
      : undefined,
    supabase: aiRuntime.supabase || null,
  })

  return {
    text: result.data,
    provider: result.provider,
    model: result.model,
    task,
    latencyMs: result.latencyMs,
    wasToolCall: false,
    reused: result.reused,
  }
}

export function getQuickSuggestions(context: CoreContext): string[] {
  const suggestions: string[] = []
  const subject = context.subject

  if (subject) {
    suggestions.push(`Inicia una sesión de estudio sobre ${subject}`)
    suggestions.push(`Genera 5 preguntas de ${subject} para ${context.studentCourse || "enseñanza media"}`)
    suggestions.push(`Explica el concepto central de ${subject} con ejemplo y práctica`)
    suggestions.push(`Genera una imagen educativa estilo Canva sobre ${subject}`)
  }

  if (context.pieMode) {
    suggestions.push("Adapta este contenido para estudiantes con dislexia")
    suggestions.push("Adapta estas instrucciones para estudiantes con TDAH")
  }

  suggestions.push("Planificación de clase para 3 sesiones")
  suggestions.push("Crea preguntas de desarrollo con rúbrica")
  suggestions.push("Abre Creator Hub")
  suggestions.push("Crea un QR para compartir un recurso")

  return suggestions.slice(0, 8)
}