// lib/superagent/action-executor.ts

import { createSafeDraft } from "./draft-engine"
import type { SuperAgentUserContext } from "./types"
import type {
  SocialActionIntent,
  SocialActionSuggestion,
  SocialActionTarget,
} from "./action-router"

export interface ExecutedActionResult {
  ok: boolean
  executed: boolean
  target: SocialActionTarget
  intent: SocialActionIntent
  label: string
  message: string
  mode: "draft_created" | "prepared_action"
  draft?: {
    id: string
    title: string
    filename: string
    draftType:
      | "study_guide"
      | "lesson_plan"
      | "exam"
      | "research_outline"
      | "prompt_pack"
      | "generic"
    content: string
    summary: string
    createdAt: string
    metadata?: Record<string, unknown>
  }
  payload?: Record<string, unknown>
}

function buildPreparedMessage(
  suggestion: SocialActionSuggestion
): string {
  switch (suggestion.target) {
    case "educador":
      return "EduAI Claw dejó preparada una acción pedagógica para el agente Educador."
    case "examen":
      return "EduAI Claw dejó preparada una acción evaluativa para el agente de Examen."
    case "paper":
      return "EduAI Claw dejó preparada una acción académica para el agente de Paper."
    case "matematico":
      return "EduAI Claw dejó preparada una acción para el agente Matemático."
    case "imagenes":
      return "EduAI Claw dejó preparada una acción visual para el agente de Imágenes."
    default:
      return "EduAI Claw dejó preparada una acción general."
  }
}

export async function executeSuggestedAction(params: {
  suggestion: SocialActionSuggestion
  context: SuperAgentUserContext
}): Promise<ExecutedActionResult> {
  const { suggestion, context } = params

  if (!suggestion.detected) {
    return {
      ok: false,
      executed: false,
      target: suggestion.target,
      intent: suggestion.intent,
      label: suggestion.label,
      message: "No hay una acción detectable para ejecutar.",
      mode: "prepared_action",
    }
  }

  if (suggestion.target === "drafts") {
    const result = await createSafeDraft({
      ...context,
      userGoal: suggestion.suggestedGoal || context.userGoal,
    })

    if (!result.ok || !result.draft) {
      return {
        ok: false,
        executed: false,
        target: suggestion.target,
        intent: suggestion.intent,
        label: suggestion.label,
        message:
          result.message || "No se pudo ejecutar la acción de borrador.",
        mode: "prepared_action",
      }
    }

    return {
      ok: true,
      executed: true,
      target: suggestion.target,
      intent: suggestion.intent,
      label: suggestion.label,
      message: "EduAI Claw ejecutó la acción y creó un borrador seguro.",
      mode: "draft_created",
      draft: result.draft,
    }
  }

  return {
    ok: true,
    executed: true,
    target: suggestion.target,
    intent: suggestion.intent,
    label: suggestion.label,
    message: buildPreparedMessage(suggestion),
    mode: "prepared_action",
    payload: {
      suggestedGoal: suggestion.suggestedGoal,
      suggestedTarget: suggestion.target,
      suggestedIntent: suggestion.intent,
      source: "ai-social",
      currentPage: context.currentPage || "/ai-social",
      tags: context.tags || [],
    },
  }
}
