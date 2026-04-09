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

function detectRoomFromGoal(goal?: string): SocialRoomSlug {
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

function buildParticipants(room: SocialRoomSlug): SocialParticipant[] {
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
    messages.push({
      id: crypto.randomUUID(),
      authorId: claw.id,
      authorName: claw.name,
      role: claw.role,
      content: `He abierto esta conversación en la sala "${getRoomTitle(
        room
      )}" para analizar el tema: "${topic}". Quiero que construyamos una visión útil para ayudar al usuario.`,
      createdAt,
    })
  }

  if (room === "research" && researcher && mathematician) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: researcher.id,
        authorName: researcher.name,
        role: researcher.role,
        content:
          "Veo una oportunidad de estructurar el tema como un problema de investigación, con antecedentes, referencias y una ruta de profundización.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: mathematician.id,
        authorName: mathematician.name,
        role: mathematician.role,
        content:
          "También conviene ordenar el razonamiento en pasos claros. Si el tema requiere precisión, podemos separar definiciones, supuestos y desarrollo lógico.",
        createdAt,
      }
    )
  } else if (room === "teaching-lab" && educator && mathematician) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: educator.id,
        authorName: educator.name,
        role: educator.role,
        content:
          "Desde lo pedagógico, esto podría transformarse en una secuencia de aprendizaje clara, con objetivo, desarrollo, actividad y cierre.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: mathematician.id,
        authorName: mathematician.name,
        role: mathematician.role,
        content:
          "Y si el contenido necesita estructura, puedo apoyar ordenando ejemplos, ejercicios o criterios de progresión.",
        createdAt,
      }
    )
  } else if (room === "creative-studio" && creative && educator) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: creative.id,
        authorName: creative.name,
        role: creative.role,
        content:
          "Este tema puede beneficiarse de una salida visual o narrativa. Podríamos preparar un afiche, infografía o apoyo multimedia.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: educator.id,
        authorName: educator.name,
        role: educator.role,
        content:
          "Si lo hacemos, conviene que el material no solo sea bonito, sino también útil para enseñar o comunicar mejor.",
        createdAt,
      }
    )
  } else if (room === "anticipation" && researcher && educator) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: researcher.id,
        authorName: researcher.name,
        role: researcher.role,
        content:
          "Creo que ya hay suficiente contexto para anticipar un borrador útil. Podemos preparar una base para que el usuario avance más rápido.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: educator.id,
        authorName: educator.name,
        role: educator.role,
        content:
          "Estoy de acuerdo. Conviene que ese borrador sea claro, editable y seguro, sin tocar directamente archivos productivos.",
        createdAt,
      }
    )
  } else if (room === "user-support" && educator) {
    messages.push({
      id: crypto.randomUUID(),
      authorId: educator.id,
      authorName: educator.name,
      role: educator.role,
      content:
        "Este caso sugiere acompañamiento claro y amable. Lo importante es que la experiencia siga siendo útil, comprensible y centrada en ayudar.",
      createdAt,
    })
  } else if (researcher && educator) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: researcher.id,
        authorName: researcher.name,
        role: researcher.role,
        content:
          "Veo posibilidades interesantes en este tema. Podemos explorarlo desde distintas perspectivas antes de decidir una acción.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: educator.id,
        authorName: educator.name,
        role: educator.role,
        content:
          "Sí. Y después conviene traducir esas ideas en algo que el usuario pueda aprovechar directamente.",
        createdAt,
      }
    )
  }

  if (claw) {
    messages.push({
      id: crypto.randomUUID(),
      authorId: claw.id,
      authorName: claw.name,
      role: claw.role,
      content:
        "Conclusión preliminar: esta conversación puede transformarse en una recomendación, borrador o ruta de acción dentro de EduAI.",
      createdAt,
    })
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
