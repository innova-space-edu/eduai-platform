// lib/superagent/router.ts

import type {
  SuperAgentDecision,
  SuperAgentSkillName,
  SuperAgentTarget,
  SuperAgentUserContext,
} from "./types"

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase()
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

function detectTargetFromGoal(goal?: string): SuperAgentTarget {
  const text = normalizeText(goal)

  if (!text) return "unknown"

  if (
    includesAny(text, [
      "planificación",
      "planificacion",
      "oa",
      "objetivo",
      "docente",
      "clase",
      "unidad",
      "indicador",
      "curriculum",
      "currículo",
      "mineduc",
    ])
  ) {
    return "educador"
  }

  if (
    includesAny(text, [
      "investigación",
      "investigacion",
      "paper",
      "artículo",
      "articulo",
      "referencia",
      "estado del arte",
      "latex",
      "cita",
      "bibliografía",
      "bibliografia",
    ])
  ) {
    return "paper"
  }

  if (
    includesAny(text, [
      "matemática",
      "matematica",
      "función",
      "funcion",
      "ecuación",
      "ecuacion",
      "álgebra",
      "algebra",
      "estadística",
      "estadistica",
      "geometría",
      "geometria",
      "cálculo",
      "calculo",
    ])
  ) {
    return "matematico"
  }

  if (
    includesAny(text, [
      "imagen",
      "ilustración",
      "ilustracion",
      "poster",
      "afiche",
      "portada",
      "dibujo",
      "visual",
      "generar imagen",
      "crear imagen",
    ])
  ) {
    return "imagenes"
  }

  if (
    includesAny(text, [
      "audio",
      "voz",
      "podcast",
      "narración",
      "narracion",
      "tts",
      "locución",
      "locucion",
    ])
  ) {
    return "audio"
  }

  if (
    includesAny(text, [
      "prueba",
      "examen",
      "evaluación",
      "evaluacion",
      "rúbrica",
      "rubrica",
      "ítem",
      "item",
      "verdadero y falso",
      "alternativa",
    ])
  ) {
    return "examen"
  }

  if (
    includesAny(text, [
      "agentes",
      "chat social",
      "conversación entre ias",
      "conversacion entre ias",
      "red social",
      "sala",
      "room",
      "social",
    ])
  ) {
    return "social"
  }

  if (
    includesAny(text, [
      "borrador",
      "draft",
      "adelantar",
      "anticipar",
      "preparar archivo",
      "crear archivo",
      "propuesta",
    ])
  ) {
    return "drafts"
  }

  return "chat"
}

function detectSkillForTarget(
  target: SuperAgentTarget,
  context: SuperAgentUserContext
): SuperAgentSkillName {
  const goal = normalizeText(context.userGoal)
  const page = normalizeText(context.currentPage)

  if (target === "social") {
    return "spawn_agent_discussion"
  }

  if (target === "drafts") {
    if (
      includesAny(goal, [
        "anticipar",
        "adelantar",
        "preparar",
        "borrador",
        "crear archivo",
      ])
    ) {
      return "create_draft_file"
    }

    return "anticipate_user_next_need"
  }

  if (
    includesAny(goal, [
      "mejora",
      "optimiza",
      "optimizar",
      "mejor prompt",
      "reformula",
      "hazlo mejor",
    ])
  ) {
    return "optimize_prompt"
  }

  if (
    includesAny(goal, [
      "falló",
      "fallo",
      "error",
      "no funciona",
      "reintenta",
      "corrige",
      "arregla",
    ])
  ) {
    return "repair_failed_call"
  }

  if (
    includesAny(page, [
      "/ai-social",
      "/social",
    ])
  ) {
    return "extract_ideas_from_social_chat"
  }

  return "route_to_best_agent"
}

export function decideSuperAgentAction(
  context: SuperAgentUserContext
): SuperAgentDecision {
  const target = detectTargetFromGoal(context.userGoal)
  const skill = detectSkillForTarget(target, context)

  const hasContext =
    Boolean(context.userGoal && context.userGoal.trim().length > 0) ||
    Boolean(context.currentPage && context.currentPage.trim().length > 0)

  if (!hasContext) {
    return {
      shouldAct: false,
      reason: "No hay suficiente contexto para actuar.",
      confidence: 0.15,
      safeToExecute: false,
    }
  }

  return {
    shouldAct: true,
    selectedSkill: skill,
    selectedTarget: target,
    reason: `EduAI Claw detectó que el mejor target actual es "${target}" usando la skill "${skill}".`,
    confidence: target === "unknown" ? 0.45 : 0.85,
    safeToExecute: true,
  }
}

export function buildSuperAgentSuggestion(
  context: SuperAgentUserContext
): string {
  const decision = decideSuperAgentAction(context)

  if (!decision.shouldAct) {
    return "Aún no tengo suficiente contexto para sugerir una acción útil."
  }

  switch (decision.selectedTarget) {
    case "educador":
      return "Detecté un enfoque pedagógico. Conviene apoyar con planificación, OA, indicadores o actividades."
    case "paper":
      return "Detecté una necesidad de investigación. Conviene activar apoyo de papers, referencias o redacción académica."
    case "matematico":
      return "Detecté trabajo matemático. Conviene usar explicaciones paso a paso, ejercicios o evaluación matemática."
    case "imagenes":
      return "Detecté una necesidad visual. Conviene preparar un prompt optimizado para generación de imágenes."
    case "audio":
      return "Detecté una necesidad de voz o audio. Conviene activar una preparación de narración o podcast."
    case "examen":
      return "Detecté una tarea evaluativa. Conviene preparar una prueba, rúbrica o retroalimentación."
    case "social":
      return "Detecté una intención social entre agentes. Conviene abrir o enriquecer una conversación interna de IAs."
    case "drafts":
      return "Detecté una oportunidad anticipatoria. Conviene crear un borrador seguro antes de que el usuario lo pida."
    case "chat":
      return "Conviene mantener apoyo conversacional general y observar si surge una especialización más clara."
    default:
      return "La intención aún es ambigua. Conviene observar un poco más antes de decidir."
  }
}
