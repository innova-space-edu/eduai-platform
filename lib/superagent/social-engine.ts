// lib/superagent/social-engine.ts

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

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase()
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
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
      return "Sala Research"
    case "teaching-lab":
      return "Teaching Lab"
    case "creative-studio":
      return "Creative Studio"
    case "user-support":
      return "User Support"
    case "anticipation":
      return "Anticipation"
    default:
      return "Ideas"
  }
}

export function buildParticipants(room: SocialRoomSlug): SocialParticipant[] {
  const claw: SocialParticipant = {
    id: "eduai-claw",
    name: "EduAI Claw",
    role: "supervisor",
    specialty: "supervisión autónoma",
    tone: "estratégico",
  }

  const researcher: SocialParticipant = {
    id: "investigador",
    name: "Investigador",
    role: "researcher",
    specialty: "análisis académico y papers",
    tone: "analítico",
  }

  const educator: SocialParticipant = {
    id: "educador",
    name: "Educador",
    role: "educator",
    specialty: "diseño pedagógico",
    tone: "claro",
  }

  const mathematician: SocialParticipant = {
    id: "matematico",
    name: "Matemático",
    role: "mathematician",
    specialty: "rigor lógico y estructura",
    tone: "riguroso",
  }

  const creative: SocialParticipant = {
    id: "creativo",
    name: "Visual IA",
    role: "creative",
    specialty: "creatividad visual y narrativa",
    tone: "creativo",
  }

  switch (room) {
    case "research":
      return [claw, researcher, mathematician]
    case "teaching-lab":
      return [claw, educator, mathematician]
    case "creative-studio":
      return [claw, creative, educator]
    case "user-support":
      return [claw, educator]
    case "anticipation":
      return [claw, researcher, educator]
    default:
      return [claw, researcher, educator, creative]
  }
}

function createMessage(
  participant: SocialParticipant,
  content: string,
  createdAt: string
): SocialMessage {
  return {
    id: crypto.randomUUID(),
    authorId: participant.id,
    authorName: participant.name,
    role: participant.role,
    content,
    createdAt,
  }
}

function buildMessages(
  room: SocialRoomSlug,
  topic: string,
  participants: SocialParticipant[]
): SocialMessage[] {
  const createdAt = new Date().toISOString()

  const claw = participants.find((p) => p.id === "eduai-claw")
  const researcher = participants.find((p) => p.id === "investigador")
  const educator = participants.find((p) => p.id === "educador")
  const mathematician = participants.find((p) => p.id === "matematico")
  const creative = participants.find((p) => p.id === "creativo")

  const messages: SocialMessage[] = []

  if (claw) {
    messages.push(
      createMessage(
        claw,
        `He abierto esta conversación en la sala "${getRoomTitle(
          room
        )}" para analizar el tema: "${topic}". Quiero que construyamos una visión útil para ayudar al usuario.`,
        createdAt
      )
    )
  }

  if (room === "research" && researcher && mathematician) {
    messages.push(
      createMessage(
        researcher,
        "Veo una oportunidad de estructurar el tema como un problema de investigación, con antecedentes, referencias y una ruta de profundización.",
        createdAt
      ),
      createMessage(
        mathematician,
        "También conviene ordenar el razonamiento en pasos claros. Si el tema requiere precisión, podemos separar definiciones, supuestos y desarrollo lógico.",
        createdAt
      )
    )
  } else if (room === "teaching-lab" && educator && mathematician) {
    messages.push(
      createMessage(
        educator,
        "Desde lo pedagógico, esto podría transformarse en una secuencia de aprendizaje clara, con objetivo, desarrollo, actividad y cierre.",
        createdAt
      ),
      createMessage(
        mathematician,
        "Y si el contenido necesita estructura, puedo apoyar ordenando ejemplos, ejercicios o criterios de progresión.",
        createdAt
      )
    )
  } else if (room === "creative-studio" && creative && educator) {
    messages.push(
      createMessage(
        creative,
        "Este tema puede beneficiarse de una salida visual o narrativa. Podríamos preparar un afiche, infografía o apoyo multimedia.",
        createdAt
      ),
      createMessage(
        educator,
        "Si lo hacemos, conviene que el material no solo sea bonito, sino también útil para enseñar o comunicar mejor.",
        createdAt
      )
    )
  } else if (room === "anticipation" && researcher && educator) {
    messages.push(
      createMessage(
        researcher,
        "Creo que ya hay suficiente contexto para anticipar un borrador útil. Podemos preparar una base para que el usuario avance más rápido.",
        createdAt
      ),
      createMessage(
        educator,
        "Estoy de acuerdo. Conviene que ese borrador sea claro, editable y seguro, sin tocar directamente archivos productivos.",
        createdAt
      )
    )
  } else if (room === "user-support" && educator) {
    messages.push(
      createMessage(
        educator,
        "Este caso sugiere acompañamiento claro y amable. Lo importante es que la experiencia siga siendo útil, comprensible y centrada en ayudar.",
        createdAt
      )
    )
  } else if (researcher && educator) {
    messages.push(
      createMessage(
        researcher,
        "Veo posibilidades interesantes en este tema. Podemos explorarlo desde distintas perspectivas antes de decidir una acción.",
        createdAt
      ),
      createMessage(
        educator,
        "Sí. Y después conviene traducir esas ideas en algo que el usuario pueda aprovechar directamente.",
        createdAt
      )
    )
  }

  if (claw) {
    messages.push(
      createMessage(
        claw,
        "Conclusión preliminar: esta conversación puede transformarse en una recomendación, borrador o ruta de acción dentro de EduAI.",
        createdAt
      )
    )
  }

  return messages
}

function buildSummary(room: SocialRoomSlug, topic: string): string {
  switch (room) {
    case "research":
      return `La conversación social detectó que el tema "${topic}" se beneficia de un enfoque de investigación, estructura lógica y posible profundización académica.`
    case "teaching-lab":
      return `La conversación social detectó que el tema "${topic}" se adapta bien a una secuencia pedagógica organizada y útil para enseñanza.`
    case "creative-studio":
      return `La conversación social detectó que el tema "${topic}" puede fortalecerse con una salida visual, narrativa o multimedia.`
    case "anticipation":
      return `La conversación social detectó que el tema "${topic}" es buen candidato para generar un borrador anticipado seguro.`
    case "user-support":
      return `La conversación social detectó que el tema "${topic}" requiere apoyo claro, amable y orientado al usuario.`
    default:
      return `La conversación social abrió una exploración colaborativa sobre "${topic}" y generó una primera síntesis útil.`
  }
}

export function buildAgentFollowUpRound(params: {
  room: SocialRoomSlug
  topic: string
  userMessage: string
  participants: SocialParticipant[]
}): SocialMessage[] {
  const { room, topic, userMessage, participants } = params
  const createdAt = new Date().toISOString()

  const claw = participants.find((p) => p.id === "eduai-claw")
  const researcher = participants.find((p) => p.id === "investigador")
  const educator = participants.find((p) => p.id === "educador")
  const mathematician = participants.find((p) => p.id === "matematico")
  const creative = participants.find((p) => p.id === "creativo")

  const lowerUserMessage = normalizeText(userMessage)
  const messages: SocialMessage[] = []

  if (claw) {
    messages.push(
      createMessage(
        claw,
        `He detectado una nueva intervención del usuario sobre "${topic}". Tomaré esta entrada para coordinar una nueva ronda breve entre agentes.`,
        createdAt
      )
    )
  }

  if (room === "research" && researcher && mathematician) {
    messages.push(
      createMessage(
        researcher,
        includesAny(lowerUserMessage, ["referencia", "paper", "artículo", "articulo"])
          ? "A partir de lo que indica el usuario, conviene priorizar antecedentes y referencias clave para fortalecer la línea de investigación."
          : "La nueva idea del usuario abre una vía interesante. Podríamos traducirla en una hipótesis, una pregunta central o una ruta de análisis.",
        createdAt
      ),
      createMessage(
        mathematician,
        includesAny(lowerUserMessage, ["modelo", "ecuación", "ecuacion", "simulación", "simulacion"])
          ? "También sería útil estructurar esa propuesta mediante variables, supuestos y una formulación más rigurosa."
          : "Desde mi lado, sugiero convertir la idea en una estructura ordenada para que pueda desarrollarse con claridad.",
        createdAt
      )
    )
  } else if (room === "teaching-lab" && educator && mathematician) {
    messages.push(
      createMessage(
        educator,
        "Lo que plantea el usuario puede transformarse en una actividad, una planificación o una secuencia con propósito pedagógico claro.",
        createdAt
      ),
      createMessage(
        mathematician,
        "Puedo apoyar organizando el contenido en pasos, ejercicios, niveles de dificultad o criterios de evaluación.",
        createdAt
      )
    )
  } else if (room === "creative-studio" && creative && educator) {
    messages.push(
      createMessage(
        creative,
        "La nueva intervención del usuario sugiere una salida creativa concreta. Podemos pensar en formato visual, narrativa o estructura expresiva.",
        createdAt
      ),
      createMessage(
        educator,
        "Y conviene que esa creatividad siga siendo útil para enseñar, explicar o comunicar mejor el objetivo central.",
        createdAt
      )
    )
  } else if (room === "anticipation" && researcher && educator) {
    messages.push(
      createMessage(
        researcher,
        "Con esta nueva entrada del usuario ya hay suficiente contexto para generar un borrador más afinado y con mejor dirección.",
        createdAt
      ),
      createMessage(
        educator,
        "De acuerdo. La salida ideal sería un borrador claro, editable y listo para que el usuario lo refine.",
        createdAt
      )
    )
  } else if (room === "user-support" && educator) {
    messages.push(
      createMessage(
        educator,
        "Tomando lo que dijo el usuario, la respuesta debería ser clara, acompañada y orientada a resolver su necesidad de forma concreta.",
        createdAt
      )
    )
  } else {
    if (researcher) {
      messages.push(
        createMessage(
          researcher,
          "La intervención del usuario aporta una dirección nueva. Conviene convertirla en una idea accionable o en una pregunta más específica.",
          createdAt
        )
      )
    }

    if (educator) {
      messages.push(
        createMessage(
          educator,
          "Sí, y después deberíamos traducir esa idea a una salida comprensible y útil para el usuario.",
          createdAt
        )
      )
    }

    if (creative && includesAny(lowerUserMessage, ["imagen", "visual", "afiche", "infografía", "infografia"])) {
      messages.push(
        createMessage(
          creative,
          "Además, esta idea podría enriquecerse con una representación visual o una estructura más atractiva.",
          createdAt
        )
      )
    }
  }

  if (claw) {
    messages.push(
      createMessage(
        claw,
        "Síntesis de la ronda: la nueva intervención del usuario ya fue integrada y puede usarse para seguir la conversación o generar un borrador.",
        createdAt
      )
    )
  }

  return messages
}

export function buildFollowUpSummary(params: {
  room: SocialRoomSlug
  topic: string
  userMessage: string
}): string {
  const { room, topic, userMessage } = params

  switch (room) {
    case "research":
      return `Tras la intervención del usuario ("${userMessage}"), la sala de investigación reforzó el tema "${topic}" con una propuesta de análisis, estructura y profundización.`
    case "teaching-lab":
      return `Tras la intervención del usuario ("${userMessage}"), la sala pedagógica propuso convertir el tema "${topic}" en una secuencia o planificación más clara.`
    case "creative-studio":
      return `Tras la intervención del usuario ("${userMessage}"), la sala creativa propuso enriquecer el tema "${topic}" con una salida visual o comunicativa.`
    case "anticipation":
      return `Tras la intervención del usuario ("${userMessage}"), la sala de anticipación concluyó que el tema "${topic}" ya está en condiciones de generar un borrador más útil.`
    case "user-support":
      return `Tras la intervención del usuario ("${userMessage}"), la sala de apoyo enfatizó una respuesta clara y centrada en ayudar mejor.`
    default:
      return `La conversación sobre "${topic}" integró la nueva idea del usuario ("${userMessage}") y generó una nueva ronda de síntesis.`
  }
}

export async function startSocialConversation(
  context: SuperAgentUserContext
): Promise<SocialConversationResult> {
  const logs: SuperAgentRunLog[] = []
  const topic = context.userGoal?.trim() || "Tema no especificado"
  const room = detectRoomFromGoal(context.userGoal)
  const participants = buildParticipants(room)
  const messages = buildMessages(room, topic, participants)
  const summary = buildSummary(room, topic)
  const createdAt = new Date().toISOString()

  logs.push(
    logSuperAgentInfo({
      action: "social_room_created",
      target: "social",
      skillName: "spawn_agent_discussion",
      message: `EduAI Claw inició una conversación social en la sala "${room}".`,
      metadata: {
        topic,
        participants: participants.map((p) => p.name),
        engineAlias: SUPERAGENT_CONFIG.identity.engineAlias,
      },
    })
  )

  logs.push(
    logSuperAgentInfo({
      action: "social_summary_created",
      target: "social",
      skillName: "extract_ideas_from_social_chat",
      message: "EduAI Claw generó un resumen preliminar de la conversación social.",
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
