// lib/superagent/social-engine.ts

import { runAIText } from "@/lib/ai/gateway"
import type { AIProviderId } from "@/lib/ai/capabilities"
import type { SupabaseClient } from "@supabase/supabase-js"
import { SUPERAGENT_CONFIG } from "./config"
import { logSuperAgentInfo, serializeSuperAgentLog } from "./logger"
import type { SuperAgentRunLog, SuperAgentUserContext } from "./types"

export type SocialRoomSlug =
  | "ideas"
  | "research"
  | "teaching-lab"
  | "creative-studio"
  | "user-support"
  | "anticipation"

export type SocialParticipantRole =
  | "supervisor"
  | "researcher"
  | "educator"
  | "engineer"
  | "mathematician"
  | "creative"
  | "assistant"

export interface SocialParticipant {
  id: string
  name: string
  role: SocialParticipantRole
  specialty: string
  tone: string
}

export interface SocialMessage {
  id: string
  authorId: string
  authorName: string
  role: SocialParticipantRole
  content: string
  createdAt: string
  provider?: string
  model?: string
}

export interface SocialConversationResult {
  ok: boolean
  room: {
    id: string
    slug: SocialRoomSlug
    title: string
    topic: string
    createdAt: string
  }
  participants: SocialParticipant[]
  messages: SocialMessage[]
  summary: string
  logs: Record<string, unknown>[]
}

const PROVIDERS = new Set<AIProviderId>([
  "google",
  "groq",
  "openrouter",
  "together",
  "cerebras",
])

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase()
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

function includesWholeTerm(text: string, keywords: string[]): boolean {
  const normalizedText = ` ${normalizeText(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword)
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()

    return normalizedKeyword
      ? normalizedText.includes(` ${normalizedKeyword} `)
      : false
  })
}

function safeProvider(value?: string | null): AIProviderId | null {
  const normalized = value?.trim().toLowerCase() as AIProviderId | undefined
  return normalized && PROVIDERS.has(normalized) ? normalized : null
}

function envKeyForParticipant(participant: SocialParticipant): string {
  return `EDUAI_SOCIAL_PROVIDER_${participant.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`
}

function preferredProviderFor(participant: SocialParticipant): AIProviderId | null {
  return safeProvider(process.env[envKeyForParticipant(participant)])
}

function selectorProvider(): AIProviderId | null {
  return safeProvider(process.env.EDUAI_SOCIAL_SELECTOR_PROVIDER)
}

export function detectRoomFromGoal(goal?: string): SocialRoomSlug {
  const text = normalizeText(goal)

  if (
    includesAny(text, [
      "paper",
      "investigación",
      "investigacion",
      "referencia",
      "marco teórico",
      "marco teorico",
      "estado del arte",
      "latex",
      "cube",
      "sat",
      "plasma",
    ])
  ) {
    return "research"
  }

  if (
    includesAny(text, [
      "planificación",
      "planificacion",
      "oa",
      "indicador",
      "clase",
      "actividad",
      "evaluación",
      "evaluacion",
      "docente",
    ])
  ) {
    return "teaching-lab"
  }

  if (
    includesAny(text, [
      "imagen",
      "afiche",
      "poster",
      "infografía",
      "infografia",
      "video",
      "audio",
      "podcast",
      "diseño",
      "diseno",
      "creativo",
    ])
  ) {
    return "creative-studio"
  }

  if (
    includesAny(text, [
      "anticipa",
      "anticipar",
      "borrador",
      "draft",
      "adelanta",
      "prepara archivo",
      "predicción",
      "prediccion",
    ])
  ) {
    return "anticipation"
  }

  if (
    includesAny(text, [
      "ayuda",
      "usuario",
      "soporte",
      "acompañar",
      "acompanar",
      "explicar mejor",
    ])
  ) {
    return "user-support"
  }

  return "ideas"
}

function getRoomTitle(slug: SocialRoomSlug): string {
  switch (slug) {
    case "research":
      return "Research"
    case "teaching-lab":
      return "Docencia"
    case "creative-studio":
      return "Creativo"
    case "user-support":
      return "Soporte"
    case "anticipation":
      return "Anticipar"
    default:
      return "Ideas"
  }
}

export function buildParticipants(room: SocialRoomSlug): SocialParticipant[] {
  const claw: SocialParticipant = {
    id: "eduai-claw",
    name: "EduAI Claw",
    role: "supervisor",
    specialty: "coordinar la reunión, detectar bloqueos y devolver la palabra al usuario",
    tone: "breve y estratégico",
  }

  const researcher: SocialParticipant = {
    id: "investigador",
    name: "Investigador",
    role: "researcher",
    specialty: "investigación, contraste de hipótesis, evidencia, fuentes y análisis",
    tone: "analítico y crítico",
  }

  const educator: SocialParticipant = {
    id: "educador",
    name: "Educador",
    role: "educator",
    specialty: "pedagogía, comunicación clara, aprendizaje y aplicación práctica",
    tone: "claro y concreto",
  }

  const engineer: SocialParticipant = {
    id: "ingeniero",
    name: "Ingeniero",
    role: "engineer",
    specialty: "infraestructura TI, servidores, cloud, redes, backend, bases de datos, hardware y arquitectura de software",
    tone: "técnico, práctico y orientado a decisiones",
  }

  const mathematician: SocialParticipant = {
    id: "matematico",
    name: "Matemático",
    role: "mathematician",
    specialty: "razonamiento lógico, cuantificación, estructura, supuestos y validación",
    tone: "riguroso y preciso",
  }

  const creative: SocialParticipant = {
    id: "creativo",
    name: "Visual IA",
    role: "creative",
    specialty: "diseño, comunicación visual, narrativas y alternativas creativas",
    tone: "creativo pero práctico",
  }

  switch (room) {
    case "research":
      return [claw, researcher, engineer, mathematician, educator]
    case "teaching-lab":
      return [claw, educator, researcher, mathematician, engineer, creative]
    case "creative-studio":
      return [claw, creative, educator, researcher, engineer]
    case "user-support":
      return [claw, engineer, educator, researcher, creative]
    case "anticipation":
      return [claw, engineer, researcher, educator, mathematician]
    default:
      return [claw, engineer, researcher, educator, mathematician, creative]
  }
}

function formatTranscript(messages: SocialMessage[], limit = 10): string {
  const recent = messages.slice(-limit)
  if (!recent.length) return "(sin mensajes previos)"
  return recent
    .map((message) => `${message.authorName}: ${message.content}`)
    .join("\n")
}

function detectMention(
  userMessage: string,
  participants: SocialParticipant[]
): SocialParticipant | null {
  const normalized = normalizeText(userMessage)
  return (
    participants.find((participant) => {
      const id = normalizeText(participant.id)
      const name = normalizeText(participant.name)
      return normalized.includes(`@${id}`) || normalized.includes(`@${name}`)
    }) || null
  )
}

function fallbackSpeakers(
  room: SocialRoomSlug,
  userMessage: string,
  participants: SocialParticipant[],
  maxSpeakers: number
): SocialParticipant[] {
  const text = normalizeText(userMessage)
  const byId = (id: string) => participants.find((participant) => participant.id === id)
  const selected: Array<SocialParticipant | undefined> = []

  if (includesWholeTerm(text, [
    "servidor", "servidores", "server", "servers", "vps", "cloud", "nube", "hosting", "host",
    "red", "redes", "router", "switch", "api", "backend", "base de datos",
    "database", "software", "hardware", "gpu", "cpu", "ram", "ssd",
    "almacenamiento", "docker", "linux", "windows server", "virtualización",
    "virtualizacion", "infraestructura",
  ])) {
    selected.push(byId("ingeniero"))
  }
  if (includesAny(text, ["ecuación", "ecuacion", "cálculo", "calculo", "número", "numero", "estadística", "estadistica", "medir", "comparar"])) {
    selected.push(byId("matematico"))
  }
  if (includesAny(text, ["paper", "fuente", "evidencia", "investiga", "buscar", "referencia", "estudio"])) {
    selected.push(byId("investigador"))
  }
  if (includesAny(text, ["clase", "estudiante", "oa", "planificación", "planificacion", "enseñar", "ensenar"])) {
    selected.push(byId("educador"))
  }
  if (includesAny(text, ["imagen", "diseño", "diseno", "visual", "infografía", "infografia", "creativo"])) {
    selected.push(byId("creativo"))
  }

  if (!selected.length) {
    const defaults: Record<SocialRoomSlug, string[]> = {
      ideas: ["investigador", "educador"],
      research: ["investigador", "matematico"],
      "teaching-lab": ["educador", "investigador"],
      "creative-studio": ["creativo", "educador"],
      "user-support": ["educador", "investigador"],
      anticipation: ["investigador", "educador"],
    }
    selected.push(...defaults[room].map(byId))
  }

  return Array.from(new Map(
    selected
      .filter((participant): participant is SocialParticipant => Boolean(participant))
      .map((participant) => [participant.id, participant])
  ).values()).slice(0, maxSpeakers)
}

function parseSpeakerIds(raw: string): string[] {
  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim()
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start < 0 || end < start) return []
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { speakers?: unknown }
    if (!Array.isArray(parsed.speakers)) return []
    return parsed.speakers.filter((value): value is string => typeof value === "string")
  } catch {
    return []
  }
}

async function selectSpeakers(params: {
  room: SocialRoomSlug
  topic: string
  userMessage: string
  participants: SocialParticipant[]
  history: SocialMessage[]
  maxSpeakers: number
  userId?: string | null
  supabase?: SupabaseClient | null
}): Promise<SocialParticipant[]> {
  const mentioned = detectMention(params.userMessage, params.participants)
  if (mentioned) return [mentioned]

  const candidates = params.participants
    .map((participant) => `- ${participant.id}: ${participant.name} — ${participant.specialty}`)
    .join("\n")

  try {
    const result = await runAIText({
      messages: [
        {
          role: "system",
          content:
            "Eres el moderador invisible de una reunión multiagente. No contestes el tema. Decide quién aporta valor en el siguiente turno. Selecciona entre 1 y 2 agentes y prioriza la especialidad que realmente coincide con la pregunta. Para servidores, cloud, redes, backend, bases de datos, hardware o arquitectura de software prioriza al Ingeniero. Elige al Educador solo cuando exista un componente pedagógico, de enseñanza, aprendizaje o comunicación educativa. Usa al supervisor solo si hay que coordinar, resumir una decisión o devolver la palabra. No elijas agentes por rutina y evita repetir al último hablante si otro puede aportar algo nuevo. Devuelve SOLO JSON válido con esta forma: {\"speakers\":[\"id\"]}.",
        },
        {
          role: "user",
          content: `Sala: ${params.room}
Tema: ${params.topic}

Participantes disponibles:
${candidates}

Conversación reciente:
${formatTranscript(params.history, 8)}

Última intervención del usuario:
${params.userMessage}

Elige como máximo ${params.maxSpeakers} participantes.`,
        },
      ],
      capability: "text",
      maxOutputTokens: 120,
      lite: true,
      preferredProvider: selectorProvider(),
      context: {
        userId: params.userId,
        module: "ai-social-selector",
        reusePolicy: "never",
        visibility: "private",
      },
      supabase: params.supabase,
    })

    const ids = parseSpeakerIds(result.data)
    const selected = ids
      .map((id) => params.participants.find((participant) => participant.id === id))
      .filter((participant): participant is SocialParticipant => Boolean(participant))

    if (selected.length) {
      return Array.from(new Map(selected.map((participant) => [participant.id, participant])).values())
        .slice(0, params.maxSpeakers)
    }
  } catch {
    // El selector es una optimización. Si falla un proveedor, la reunión sigue
    // con una selección local y las respuestas todavía pasan por el Gateway.
  }

  return fallbackSpeakers(
    params.room,
    params.userMessage,
    params.participants,
    params.maxSpeakers
  )
}

function isSimpleGreeting(text: string): boolean {
  const normalized = normalizeText(text).replace(/[¡!¿?.,]/g, " ").replace(/\s+/g, " ").trim()
  return /^(hola|buenas|buenos días|buenos dias|buenas tardes|buenas noches|hey|hello|gracias|ok|vale)$/.test(normalized)
}

function endsAbruptly(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return true
  if (/[,:;\-–—]$/.test(normalized)) return true
  return /\b(de|del|la|el|los|las|un|una|unos|unas|su|sus|para|por|con|sin|según|segun|como|que|en|a|y|o)$/i.test(normalized)
}

function needsQualityRetry(content: string, userMessage: string): boolean {
  if (!content.trim()) return true
  if (isSimpleGreeting(userMessage)) return endsAbruptly(content)

  const words = content.trim().split(/\s+/).filter(Boolean).length
  return words < 80 || endsAbruptly(content)
}

async function generateParticipantMessage(params: {
  participant: SocialParticipant
  room: SocialRoomSlug
  topic: string
  userMessage: string
  history: SocialMessage[]
  roundPosition: number
  userId?: string | null
  supabase?: SupabaseClient | null
}): Promise<SocialMessage | null> {
  const { participant } = params
  const otherAgents = params.history
    .filter((message) => message.authorId !== "user")
    .slice(-4)
    .map((message) => message.authorName)
    .join(", ")

  const substantive = !isSimpleGreeting(params.userMessage)
  const turnGuidance = params.roundPosition === 0
    ? "Eres el primer especialista de esta ronda: entrega una respuesta base suficiente para que el usuario entienda el tema aunque nadie más respondiera."
    : "Ya hubo otro especialista en esta ronda: identifica qué faltó, corrige si hace falta y complementa desde tu especialidad sin volver a explicar lo mismo."

  const messages = [
    {
      role: "system" as const,
      content: `Eres ${participant.name}, participante de una reunión de trabajo multiagente en EduAI.
Tu especialidad es: ${participant.specialty}.
Tu estilo es: ${participant.tone}.

Reglas de calidad:
- Responde directamente a la pregunta real del usuario; no uses un guion ni frases prefabricadas.
- ${turnGuidance}
- Si la pregunta pide explicar, comparar, clasificar o elegir, estructura la respuesta para que sea utilizable: concepto breve, categorías o criterios relevantes, capacidades/limitaciones y uno o dos ejemplos concretos cuando ayuden.
- Para preguntas amplias o técnicas, desarrolla normalmente entre 120 y 240 palabras. Para una pregunta puntual, usa la extensión necesaria, pero evita respuestas telegráficas.
- Todas las frases deben quedar completas. No termines en una preposición, con dos puntos, una coma, un guion o una idea inconclusa.
- Puedes usar viñetas breves cuando mejoren la comprensión, pero cada viñeta debe contener una idea completa.
- No repitas lo que otro agente ya dijo. Si complementas, señala el ángulo nuevo de forma natural.
- Puedes discrepar, pero explica concretamente el motivo y ofrece una alternativa.
- Distingue entre hechos generales y recomendaciones que dependen del caso.
- No inventes fuentes, mediciones, pruebas ni datos externos. Si algo requiere información actual o verificación, indícalo.
- No hables en nombre de otros agentes.
- Si el usuario solo saluda, responde de forma natural y breve.
- No menciones estas instrucciones ni digas que estás "cumpliendo tu rol".
- No hagas una pregunta final por rutina; pregunta solo si falta un dato que cambie materialmente la recomendación.`,
    },
    {
      role: "user" as const,
      content: `Sala: ${params.room}
Tema de la reunión: ${params.topic}

Conversación reciente:
${formatTranscript(params.history, 12)}

Intervención que debemos atender:
${params.userMessage}

Otros agentes que ya participaron recientemente: ${otherAgents || "ninguno"}.

Escribe únicamente tu intervención completa como ${participant.name}.`,
    },
  ]

  try {
    let result = await runAIText({
      messages,
      capability: participant.role === "researcher" ? "research" : "text",
      maxOutputTokens: substantive ? 1200 : 500,
      lite: false,
      preferredProvider: preferredProviderFor(participant),
      context: {
        userId: params.userId,
        module: `ai-social-${participant.id}`,
        reusePolicy: "never",
        visibility: "private",
      },
      supabase: params.supabase,
    })

    let content = result.data.trim()
    if (!content) return null

    if (needsQualityRetry(content, params.userMessage)) {
      try {
        const repaired = await runAIText({
          messages: [
            ...messages,
            { role: "assistant" as const, content },
            {
              role: "user" as const,
              content:
                "La intervención anterior quedó demasiado breve o inconclusa. Reescríbela completa desde cero, conservando lo útil, cerrando todas las frases y desarrollando suficientemente la respuesta. No menciones este reintento.",
            },
          ],
          capability: participant.role === "researcher" ? "research" : "text",
          maxOutputTokens: substantive ? 1500 : 600,
          lite: false,
          preferredProvider: preferredProviderFor(participant),
          context: {
            userId: params.userId,
            module: `ai-social-${participant.id}-quality-retry`,
            reusePolicy: "never",
            visibility: "private",
          },
          supabase: params.supabase,
        })

        const repairedContent = repaired.data.trim()
        if (repairedContent) {
          result = repaired
          content = repairedContent
        }
      } catch {
        // El reintento de calidad es opcional. Si falla, conservamos la
        // primera respuesta válida en vez de perder toda la intervención.
      }
    }

    return {
      id: crypto.randomUUID(),
      authorId: participant.id,
      authorName: participant.name,
      role: participant.role,
      content,
      createdAt: new Date().toISOString(),
      provider: result.provider,
      model: result.model,
    }
  } catch {
    return null
  }
}

export function summarizeConversation(
  topic: string,
  messages: SocialMessage[]
): string {
  const useful = messages
    .filter((message) => message.authorId !== "user")
    .slice(-4)
    .map((message) => `${message.authorName}: ${message.content.replace(/\s+/g, " ").slice(0, 220)}`)

  if (!useful.length) {
    return `Reunión abierta sobre "${topic}". Aún no hay aportes de agentes.`
  }

  return `Tema: ${topic}. Aportes recientes: ${useful.join(" | ")}`
}

export async function generateAgentRound(params: {
  room: SocialRoomSlug
  topic: string
  userMessage: string
  participants: SocialParticipant[]
  history?: SocialMessage[]
  maxSpeakers?: number
  userId?: string | null
  supabase?: SupabaseClient | null
}): Promise<SocialMessage[]> {
  const history = params.history || []
  const maxSpeakers = Math.max(1, Math.min(params.maxSpeakers || 2, 3))

  const speakers = await selectSpeakers({
    room: params.room,
    topic: params.topic,
    userMessage: params.userMessage,
    participants: params.participants,
    history,
    maxSpeakers,
    userId: params.userId,
    supabase: params.supabase,
  })

  const generated: SocialMessage[] = []
  for (const [roundPosition, participant] of speakers.entries()) {
    const message = await generateParticipantMessage({
      participant,
      room: params.room,
      topic: params.topic,
      userMessage: params.userMessage,
      history: [...history, ...generated],
      roundPosition,
      userId: params.userId,
      supabase: params.supabase,
    })
    if (message) generated.push(message)
  }

  return generated
}

export async function startSocialConversation(
  context: SuperAgentUserContext,
  supabase?: SupabaseClient | null
): Promise<SocialConversationResult> {
  const logs: SuperAgentRunLog[] = []
  const topic = context.userGoal?.trim() || "Tema no especificado"
  const room = detectRoomFromGoal(context.userGoal)
  const participants = buildParticipants(room)
  const createdAt = new Date().toISOString()

  const userSeed: SocialMessage = {
    id: crypto.randomUUID(),
    authorId: "user",
    authorName: "Usuario",
    role: "assistant",
    content: topic,
    createdAt,
  }

  const agentMessages = await generateAgentRound({
    room,
    topic,
    userMessage: topic,
    participants,
    history: [userSeed],
    maxSpeakers: 2,
    userId: context.userId,
    supabase,
  })

  const messages = [userSeed, ...agentMessages]
  const summary = summarizeConversation(topic, messages)

  logs.push(
    logSuperAgentInfo({
      action: "social_room_created",
      target: "social",
      skillName: "spawn_agent_discussion",
      message: `EduAI Claw inició una reunión dinámica en la sala "${room}".`,
      metadata: {
        topic,
        participants: participants.map((participant) => participant.name),
        selectedSpeakers: agentMessages.map((message) => message.authorName),
        engineAlias: SUPERAGENT_CONFIG.identity.engineAlias,
      },
    })
  )

  logs.push(
    logSuperAgentInfo({
      action: "social_summary_created",
      target: "social",
      skillName: "extract_ideas_from_social_chat",
      message: "EduAI Social actualizó el resumen de la reunión.",
      metadata: {
        room,
        messageCount: messages.length,
      },
    })
  )

  return {
    ok: true,
    room: {
      id: crypto.randomUUID(),
      slug: room,
      title: getRoomTitle(room),
      topic,
      createdAt,
    },
    participants,
    messages,
    summary,
    logs: logs.map(serializeSuperAgentLog),
  }
}
