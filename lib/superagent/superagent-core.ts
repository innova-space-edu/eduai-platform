// lib/superagent/superagent-core.ts
// ─────────────────────────────────────────────────────────────────────────────
// Núcleo del SuperAgent con capacidad de chat + herramientas.
// NO reemplaza engine.ts (que sigue siendo el motor de sugerencias/observación).
// Este archivo agrega la capa de conversación inteligente con tool-use.
// ─────────────────────────────────────────────────────────────────────────────

import { callAIv5 } from "@/lib/ai-router-v5"
import type { Message, AITaskType } from "@/lib/ai-router-v5"
import {
  detectToolFromMessage,
  getToolByName,
  getEnabledTools,
} from "./tool-registry"
import type { ToolExecutionOptions, ToolName, ToolResult } from "./tool-registry"

// ── Tipos de respuesta del core ───────────────────────────────────────────────

export interface CoreMessage {
  role:    "user" | "assistant" | "system"
  content: string
}

export interface CoreContext {
  userId?:        string
  currentPage?:   string
  subject?:       string
  examTitle?:     string
  studentCourse?: string
  pieMode?:       boolean
}

export interface CoreResponse {
  text:        string
  provider:    string
  model:       string
  task:        AITaskType
  latencyMs?:  number
  toolUsed?:   ToolName
  toolResult?: ToolResult
  wasToolCall: boolean
}

// ── System prompt del superagente ────────────────────────────────────────────

function buildSystemPrompt(context: CoreContext): string {
  const tools = getEnabledTools()
    .map(t => `• ${t.icon} **${t.label}** (\`${t.name}\`): ${t.description}`)
    .join("\n")

  let base = `Eres **EduAI Claw** 🦅, el superagente educativo de EduAI Platform para el Colegio Providencia, Chile.

Tienes acceso a las siguientes herramientas especializadas:
${tools}

INSTRUCCIONES:
- Responde siempre en español chileno, de forma directa y útil.
- Si el usuario pide algo que corresponde a una herramienta, úsala.
- Para Matemática usa LaTeX: $formula$ para inline, $$formula$$ para bloques.
- Sé concreto: evita respuestas genéricas, da ejemplos reales del contexto escolar chileno.
- Si el usuario comparte texto para adaptar o resumir, procésalo directamente.`

  if (context.subject)       base += `\nAsignatura activa: ${context.subject}`
  if (context.currentPage)   base += `\nPágina actual: ${context.currentPage}`
  if (context.examTitle)     base += `\nExamen en edición: "${context.examTitle}"`
  if (context.studentCourse) base += `\nCurso: ${context.studentCourse}`
  if (context.pieMode)       base += `\nModo PIE activo: adapta respuestas para estudiantes NEE.`

  return base
}

// ── Detectar tarea IA según mensaje ──────────────────────────────────────────

function detectAITask(message: string): AITaskType {
  const m = message.toLowerCase()
  if (/código|code|typescript|react|bug|función|api/.test(m))  return "coding"
  if (/analiza|razona|deduce|compara|demuestra/.test(m))        return "reasoning"
  if (message.length > 3000)                                    return "long_context"
  return "general"
}

// ── Extraer argumentos de herramienta desde el mensaje ───────────────────────
// Extracción simple — si se necesita más precisión, la IA decide los args.

function extractToolArgs(
  toolName: ToolName,
  message:  string
): Record<string, unknown> {
  // Para la mayoría de tools, el contenido principal es el mensaje mismo.
  // La IA puede refinar esto, pero como base funciona bien.
  const args: Record<string, unknown> = {}

  switch (toolName) {
    case "generate_exam_questions":
      args.topic = message.replace(/genera(r)?.*preguntas?(.*de|.*sobre)?/i, "").trim() || message
      args.count = 5
      break

    case "adapt_for_pie":
      args.content  = message.replace(/adapt(a|ar)?\s*(para|el)?\s*(pie|nee|dislexia|tdah)?/i, "").trim() || message
      args.dyslexia = /dislexia/i.test(message)
      args.adhd     = /tdah/i.test(message)
      args.tea      = /tea/i.test(message)
      args.tel      = /tel\b/i.test(message)
      args.low_vision = /baja\s*visión/i.test(message)
      break

    case "plan_curriculum":
      args.topic    = message
      args.sessions = 3
      break

    case "explain_concept":
      args.concept = message.replace(/explic(a|ar)?\s*(el|la|qué\s*es)?/i, "").trim() || message
      break

    case "generate_rubric":
      args.task   = message.replace(/rubric(a|)?\s*(de|para)?/i, "").trim() || message
      args.points = 20
      break

    case "summarize_text":
      args.text  = message.replace(/resum(e|ir|en)?\s*(este|el|texto)?/i, "").trim() || message
      args.lines = 5
      break

    case "translate_text":
      args.text   = message.replace(/traduc(e|ir|ción)?\s*(al?\s*\w+)?/i, "").trim() || message
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

// ── Función principal del core ────────────────────────────────────────────────

/**
 * runCoreCycle — procesa un mensaje del chat con el superagente.
 *
 * Flujo:
 * 1. Detectar si el mensaje activa una herramienta
 * 2. Si hay tool → ejecutarla y devolver el resultado
 * 3. Si no hay tool → responder con IA directamente
 *
 * @param messages  Historial de mensajes del chat
 * @param context   Contexto de la sesión (página, asignatura, etc.)
 * @param baseUrl   URL base de la app (para llamadas internas de tools)
 */
export async function runCoreCycle(
  messages:  CoreMessage[],
  context:   CoreContext = {},
  baseUrl:   string = "",
  options:   ToolExecutionOptions = {}
): Promise<CoreResponse> {
  const t0 = Date.now()

  // Último mensaje del usuario
  const lastUser = [...messages].reverse().find(m => m.role === "user")
  const userText = lastUser?.content ?? ""

  // ── Intentar detectar herramienta ────────────────────────────────────────
  const toolName = detectToolFromMessage(userText)

  if (toolName) {
    const tool = getToolByName(toolName)

    if (tool?.enabled) {
      const args   = extractToolArgs(toolName, userText)
      const result = await tool.execute(args, baseUrl, options)

      if (result.success) {
        return {
          text:        result.output,
          provider:    "EduAI Tools",
          model:       tool.label,
          task:        "general",
          latencyMs:   Date.now() - t0,
          toolUsed:    toolName,
          toolResult:  result,
          wasToolCall: true,
        }
      }
      // Si la tool falla, caer al flujo normal de IA
    }
  }

  // ── Respuesta directa con IA ─────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(context)
  const task         = detectAITask(userText)

  // Preparar mensajes (sin duplicar system prompt)
  const aiMessages: Message[] = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role, content: m.content }))

  const result = await callAIv5(aiMessages, {
    task,
    maxTokens:    task === "long_context" ? 4000 : 2000,
    systemPrompt,
  })

  return {
    text:        result.text,
    provider:    result.provider,
    model:       result.model,
    task,
    latencyMs:   Date.now() - t0,
    wasToolCall: false,
  }
}

// ── Función para obtener sugerencias rápidas según contexto ──────────────────

export function getQuickSuggestions(context: CoreContext): string[] {
  const suggestions: string[] = []
  const subject = context.subject

  if (subject) {
    suggestions.push(`Genera 5 preguntas de ${subject} para ${context.studentCourse || "enseñanza media"}`)
    suggestions.push(`Explica el concepto central de la unidad de ${subject}`)
    suggestions.push(`Crea una rúbrica para evaluar un trabajo de ${subject}`)
  }

  if (context.pieMode) {
    suggestions.push("Adapta este contenido para estudiantes con dislexia")
    suggestions.push("Adapta estas instrucciones para estudiantes con TDAH")
  }

  suggestions.push("Planificación de clase para 3 sesiones")
  suggestions.push("Crea preguntas de desarrollo con rúbrica")
  suggestions.push("Genera una imagen educativa sobre el tema")
  suggestions.push("Genera un video educativo corto sobre el tema")
  suggestions.push("Resume este texto en 5 puntos clave")

  return suggestions.slice(0, 8)
}
