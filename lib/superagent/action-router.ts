// lib/superagent/action-router.ts

export type SocialActionTarget =
  | "drafts"
  | "educador"
  | "examen"
  | "paper"
  | "matematico"
  | "imagenes"
  | "unknown"

export type SocialActionIntent =
  | "create_lesson_plan"
  | "create_study_guide"
  | "create_exam"
  | "create_research_outline"
  | "create_math_support"
  | "create_visual_material"
  | "unknown"

export interface SocialActionSuggestion {
  detected: boolean
  intent: SocialActionIntent
  target: SocialActionTarget
  label: string
  reason: string
  suggestedGoal: string
}

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase()
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

export function detectActionFromUserMessage(
  userMessage?: string
): SocialActionSuggestion {
  const text = normalizeText(userMessage)

  if (!text) {
    return {
      detected: false,
      intent: "unknown",
      target: "unknown",
      label: "Sin acción detectada",
      reason: "No hay texto suficiente para detectar una acción.",
      suggestedGoal: "",
    }
  }

  if (
    includesAny(text, [
      "planificación",
      "planificacion",
      "planifica",
      "oa",
      "indicadores",
      "clase",
      "secuencia",
    ])
  ) {
    return {
      detected: true,
      intent: "create_lesson_plan",
      target: "educador",
      label: "Crear planificación",
      reason: "El mensaje sugiere una necesidad pedagógica o de planificación.",
      suggestedGoal: userMessage || "",
    }
  }

  if (
    includesAny(text, [
      "guía",
      "guia",
      "estudio",
      "explicación",
      "explicacion",
      "resumen para estudiar",
    ])
  ) {
    return {
      detected: true,
      intent: "create_study_guide",
      target: "drafts",
      label: "Crear guía de estudio",
      reason: "El mensaje sugiere una guía, apoyo o material de estudio.",
      suggestedGoal: userMessage || "",
    }
  }

  if (
    includesAny(text, [
      "prueba",
      "examen",
      "evaluación",
      "evaluacion",
      "ítem",
      "item",
      "verdadero y falso",
      "alternativas",
    ])
  ) {
    return {
      detected: true,
      intent: "create_exam",
      target: "examen",
      label: "Crear evaluación",
      reason: "El mensaje sugiere generar una prueba o evaluación.",
      suggestedGoal: userMessage || "",
    }
  }

  if (
    includesAny(text, [
      "investigación",
      "investigacion",
      "paper",
      "marco teórico",
      "marco teorico",
      "estado del arte",
      "referencias",
    ])
  ) {
    return {
      detected: true,
      intent: "create_research_outline",
      target: "paper",
      label: "Crear esquema de investigación",
      reason: "El mensaje sugiere una acción académica o de investigación.",
      suggestedGoal: userMessage || "",
    }
  }

  if (
    includesAny(text, [
      "matemática",
      "matematica",
      "ejercicios",
      "algebra",
      "álgebra",
      "función",
      "funcion",
      "estadística",
      "estadistica",
    ])
  ) {
    return {
      detected: true,
      intent: "create_math_support",
      target: "matematico",
      label: "Crear apoyo matemático",
      reason: "El mensaje apunta a contenido o ejercicios matemáticos.",
      suggestedGoal: userMessage || "",
    }
  }

  if (
    includesAny(text, [
      "afiche",
      "poster",
      "imagen",
      "infografía",
      "infografia",
      "visual",
      "ilustración",
      "ilustracion",
    ])
  ) {
    return {
      detected: true,
      intent: "create_visual_material",
      target: "imagenes",
      label: "Crear material visual",
      reason: "El mensaje sugiere un recurso visual o gráfico.",
      suggestedGoal: userMessage || "",
    }
  }

  return {
    detected: false,
    intent: "unknown",
    target: "unknown",
    label: "Sin acción detectada",
    reason: "No se detectó una intención accionable clara.",
    suggestedGoal: userMessage || "",
  }
}
