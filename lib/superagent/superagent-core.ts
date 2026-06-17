// lib/superagent/superagent-core.ts
// ─────────────────────────────────────────────────────────────────────────────
// Núcleo del SuperAgent con capacidad de chat + herramientas.
// NO reemplaza engine.ts (que sigue siendo el motor de sugerencias/observación).
// Este archivo agrega la capa de conversación inteligente con tool-use.
// ─────────────────────────────────────────────────────────────────────────────

import { callAIv5 } from "@/lib/ai-router-v5"
import type { Message, AITaskType } from "@/lib/ai-router-v5"
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
}

export interface CoreResponse {
  text: string
  provider: string
  model: string
  task: AITaskType
  latencyMs?: number
  toolUsed?: ToolName
  toolResult?: ToolResult
  wasToolCall: boolean
}

function buildSystemPrompt(context: CoreContext): string {
  const tools = getEnabledTools()
    .map((tool) => `• ${tool.icon} **${tool.label}** (\`${tool.name}\`): ${tool.description}`)
    .join("\n")

  const activeContext = [
    context.currentPage ? `Página actual: ${context.currentPage}` : "",
    context.pageMode ? `Modo de página/usuario: ${context.pageMode}` : "",
    context.subject ? `Tema o asignatura activa: ${context.subject}` : "",
    context.examTitle ? `Contexto/título activo: ${context.examTitle}` : "",
    context.studentCourse ? `Subtema/curso activo: ${context.studentCourse}` : "",
    context.availableActions?.length ? `Acciones internas disponibles: ${context.availableActions.join(", ")}` : "",
    context.pieMode ? "Modo PIE activo: adapta respuestas para estudiantes NEE." : "",
  ].filter(Boolean).join("\n")

  return `Eres **EduAI Claw** 🦅, el superagente educativo de EduAI Platform para el Colegio Providencia, Chile.

Tienes dos misiones:
1. Ayudar como tutor educativo claro, interactivo y motivador.
2. Operar como agente de navegación y herramientas internas de EduAI.

CONTEXTO ACTIVO:
${activeContext || "No hay contexto específico de página."}

HERRAMIENTAS DISPONIBLES:
${tools}

CAPACIDADES DE EDUAI QUE DEBES CONOCER:
- Dashboard /dashboard: inicio, sesiones de estudio y consola Claw.
- Study /study/[tema]: aprendizaje autónomo con teoría, ejemplos, ejercicios, resumen y Sócrates.
- Crear examen /examen/crear: evaluaciones, rúbricas, preguntas de alternativas y desarrollo.
- Resultados /examen/docente y /examen/resultados: revisión de notas y respuestas.
- Creator Hub /creator-hub: materiales, generación, notebooks, media.
- QR Studio /qr-studio: crear, descargar y administrar QR.
- Image Studio /image-studio: crear imágenes educativas.
- Audio Lab /audio-lab: narración, transcripción y audio.
- Paper /paper: lectura y trabajo con documentos/papers.

REGLAS DE RESPUESTA:
- Responde siempre en español chileno, claro y directo.
- Si el usuario pide abrir, ir, navegar o acceder a una herramienta, entrega un enlace interno Markdown exacto.
- Si pide estudiar, sugiere o inicia ruta /study/[tema] con link exacto.
- Si pide crear algo educativo, estructura la respuesta como producto usable: objetivo, pasos, ejemplo y siguiente acción.
- Para Matemática usa LaTeX: $formula$ inline, $$formula$$ en bloque.
- Para estudio autónomo usa andamiaje: diagnóstico breve, explicación, ejemplo, práctica guiada y pregunta final.
- Para imágenes educativas, pide o genera prompt con objetivo de aprendizaje, etiquetas, estilo Canva educativo y restricciones científicas.
- No inventes que ya hiciste cambios dentro de la app si solo estás dando instrucciones; diferencia entre enlace, sugerencia y acción ejecutada.
- Mantén respuestas compactas, con botones/enlaces útiles cuando corresponda.`
}

function detectAITask(message: string): AITaskType {
  const m = message.toLowerCase()
  if (/código|code|typescript|react|bug|función|api/.test(m)) return "coding"
  if (/analiza|razona|deduce|compara|demuestra|planifica/.test(m)) return "reasoning"
  if (message.length > 3000) return "long_context"
  return "general"
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

    default:
      args.content = message
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

export async function runCoreCycle(
  messages: CoreMessage[],
  context: CoreContext = {},
  baseUrl: string = "",
  options: ToolExecutionOptions = {},
): Promise<CoreResponse> {
  const t0 = Date.now()
  const lastUser = [...messages].reverse().find((message) => message.role === "user")
  const userText = lastUser?.content ?? ""

  const safeAction = trySafeInternalAction(userText, context, t0)
  if (safeAction) return safeAction

  const toolName = detectToolFromMessage(userText)

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
    }
  }

  const systemPrompt = buildSystemPrompt(context)
  const task = detectAITask(userText)
  const aiMessages: Message[] = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }))

  const result = await callAIv5(aiMessages, {
    task,
    maxTokens: task === "long_context" ? 4000 : 2200,
    systemPrompt,
  })

  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    task,
    latencyMs: Date.now() - t0,
    wasToolCall: false,
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
