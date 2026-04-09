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

function buildInitialMessages(
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

export function generateAgentRound(params: {
  room: SocialRoomSlug
  topic: string
  userMessage: string
  participants: SocialParticipant[]
}): SocialMessage[] {
  const createdAt = new Date().toISOString()
  const { room, topic, userMessage, participants } = params

  const claw = participants.find((p) => p.id === "eduai-claw")
  const researcher = participants.find((p) => p.id === "investigador")
  const educator = participants.find((p) => p.id === "educador")
  const mathematician = participants.find((p) => p.id === "matematico")
  const creative = participants.find((p) => p.id === "creativo")

  const messages: SocialMessage[] = []

  if (room === "research" && researcher && mathematician && claw) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: researcher.id,
        authorName: researcher.name,
        role: researcher.role,
        content: `Tomando la idea del usuario: "${userMessage}", propongo identificar una pregunta central de investigación y un marco de referencias inicial para el tema "${topic}".`,
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: mathematician.id,
        authorName: mathematician.name,
        role: mathematician.role,
        content:
          "Yo complementaría eso ordenando las hipótesis o supuestos clave, para que la propuesta tenga una estructura clara y verificable.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: claw.id,
        authorName: claw.name,
        role: claw.role,
        content:
          "Detecto una buena oportunidad para sintetizar esto en un esquema o borrador de investigación si el usuario lo desea.",
        createdAt,
      }
    )
    return messages
  }

  if (room === "teaching-lab" && educator && mathematician && claw) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: educator.id,
        authorName: educator.name,
        role: educator.role,
        content: `A partir de lo que planteó el usuario: "${userMessage}", puedo traducirlo en una secuencia pedagógica con objetivo, actividad, desarrollo y cierre.`,
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: mathematician.id,
        authorName: mathematician.name,
        role: mathematician.role,
        content:
          "Y puedo ayudar a ordenar ejemplos, dificultad progresiva o criterios de evaluación para que la propuesta quede más sólida.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: claw.id,
        authorName: claw.name,
        role: claw.role,
        content:
          "Si quieres, esta conversación ya puede transformarse en una planificación o guía preliminar.",
        createdAt,
      }
    )
    return messages
  }

  if (room === "creative-studio" && creative && educator && claw) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: creative.id,
        authorName: creative.name,
        role: creative.role,
        content: `La idea del usuario abre una ruta visual interesante: "${userMessage}". Esto puede convertirse en una pieza gráfica o narrativa bastante fuerte.`,
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: educator.id,
        authorName: educator.name,
        role: educator.role,
        content:
          "Sí, y conviene que esa pieza visual también tenga un objetivo claro para que no sea solo estética sino útil.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: claw.id,
        authorName: claw.name,
        role: claw.role,
        content:
          "Puedo dejar esto listo para un borrador de afiche, infografía o propuesta visual si se desea.",
        createdAt,
      }
    )
    return messages
  }

  if (room === "anticipation" && researcher && educator && claw) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: researcher.id,
        authorName: researcher.name,
        role: researcher.role,
        content: `Con base en el mensaje "${userMessage}", ya hay suficiente material para anticipar un borrador útil y dejar una base de trabajo.`,
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: educator.id,
        authorName: educator.name,
        role: educator.role,
        content:
          "Estoy de acuerdo. Lo ideal sería que ese borrador sea claro, editable y directamente aprovechable por el usuario.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: claw.id,
        authorName: claw.name,
        role: claw.role,
        content:
          "La conversación quedó lista para convertirse en draft seguro.",
        createdAt,
      }
    )
    return messages
  }

  if (room === "user-support" && educator && claw) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: educator.id,
        authorName: educator.name,
        role: educator.role,
        content: `Voy a responder considerando la intención del usuario: "${userMessage}", con un enfoque claro, amable y útil.`,
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: claw.id,
        authorName: claw.name,
        role: claw.role,
        content:
          "Buena línea. Mantengamos la conversación enfocada en ayudar y orientar sin complejizar demasiado.",
        createdAt,
      }
    )
    return messages
  }

  if (researcher && educator && claw) {
    messages.push(
      {
        id: crypto.randomUUID(),
        authorId: researcher.id,
        authorName: researcher.name,
        role: researcher.role,
        content: `El mensaje del usuario "${userMessage}" abre una línea interesante de análisis sobre "${topic}".`,
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: educator.id,
        authorName: educator.name,
        role: educator.role,
        content:
          "Puedo ayudar a traducir esa línea en algo más claro y útil para avanzar.",
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        authorId: claw.id,
        authorName: claw.name,
        role: claw.role,
        content:
          "Queda una nueva ronda social registrada. Si hace falta, esto puede derivar en recomendación o borrador.",
        createdAt,
      }
    )
  }

  return messages
}

export async function startSocialConversation(
  context: SuperAgentUserContext
): Promise<SocialConversationResult> {
  const logs: SuperAgentRunLog[] = []
  const topic = context.userGoal?.trim() || "Tema no especificado"
  const room = detectRoomFromGoal(context.userGoal)
  const participants = buildParticipants(room)
  const messages = buildInitialMessages(room, topic, participants)
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
