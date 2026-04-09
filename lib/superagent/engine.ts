// lib/superagent/engine.ts

import { SUPERAGENT_CONFIG } from "./config"
import { validateDecision } from "./guardrails"
import {
  logSuperAgentBlocked,
  logSuperAgentError,
  logSuperAgentInfo,
  serializeSuperAgentLog,
} from "./logger"
import { getSkillByName, isSkillEnabled } from "./registry"
import {
  buildSuperAgentSuggestion,
  decideSuperAgentAction,
} from "./router"
import type {
  SuperAgentDecision,
  SuperAgentRunLog,
  SuperAgentSkillDefinition,
  SuperAgentUserContext,
} from "./types"

export interface SuperAgentExecutionResult {
  ok: boolean
  identity: {
    displayName: string
    engineAlias: string
    internalName: string
    version: string
  }
  mode: string
  status: string
  decision: SuperAgentDecision
  suggestion: string
  selectedSkill?: SuperAgentSkillDefinition
  logs: Record<string, unknown>[]
  output: {
    shouldAct: boolean
    target?: string
    skill?: string
    confidence: number
    reason: string
    safeToExecute: boolean
  }
}

function createBaseLogMessage(context: SuperAgentUserContext): string {
  const page = context.currentPage || "unknown"
  const goal = context.userGoal || "sin objetivo explícito"
  return `EduAI Claw observó el contexto actual. Página: "${page}". Objetivo: "${goal}".`
}

function createBlockedExecutionResult(params: {
  context: SuperAgentUserContext
  decision: SuperAgentDecision
  logs: SuperAgentRunLog[]
  suggestion: string
}): SuperAgentExecutionResult {
  return {
    ok: false,
    identity: {
      displayName: SUPERAGENT_CONFIG.identity.displayName,
      engineAlias: SUPERAGENT_CONFIG.identity.engineAlias,
      internalName: SUPERAGENT_CONFIG.identity.internalName,
      version: SUPERAGENT_CONFIG.identity.version,
    },
    mode: SUPERAGENT_CONFIG.mode,
    status: "paused",
    decision: params.decision,
    suggestion: params.suggestion,
    logs: params.logs.map(serializeSuperAgentLog),
    output: {
      shouldAct: params.decision.shouldAct,
      target: params.decision.selectedTarget,
      skill: params.decision.selectedSkill,
      confidence: params.decision.confidence,
      reason: params.decision.reason,
      safeToExecute: params.decision.safeToExecute,
    },
  }
}

export async function runSuperAgentCycle(
  context: SuperAgentUserContext
): Promise<SuperAgentExecutionResult> {
  const logs: SuperAgentRunLog[] = []

  try {
    logs.push(
      logSuperAgentInfo({
        action: "observe_context",
        target: context.activeAgent || "unknown",
        message: createBaseLogMessage(context),
        metadata: {
          currentPage: context.currentPage || null,
          userGoal: context.userGoal || null,
          activeAgent: context.activeAgent || null,
          tags: context.tags || [],
        },
      })
    )

    const rawDecision = decideSuperAgentAction(context)
    const decision = validateDecision(rawDecision)
    const suggestion = buildSuperAgentSuggestion(context)

    logs.push(
      logSuperAgentInfo({
        action: "decision_created",
        target: decision.selectedTarget || "unknown",
        skillName: decision.selectedSkill,
        message: decision.reason,
        metadata: {
          confidence: decision.confidence,
          safeToExecute: decision.safeToExecute,
        },
      })
    )

    if (!decision.shouldAct || !decision.safeToExecute) {
      logs.push(
        logSuperAgentBlocked({
          action: "execution_blocked",
          target: decision.selectedTarget || "unknown",
          skillName: decision.selectedSkill,
          message:
            "La ejecución fue bloqueada por falta de contexto o por guardrails.",
          metadata: {
            reason: decision.reason,
          },
        })
      )

      return createBlockedExecutionResult({
        context,
        decision,
        logs,
        suggestion,
      })
    }

    if (!decision.selectedSkill) {
      logs.push(
        logSuperAgentBlocked({
          action: "missing_skill",
          target: decision.selectedTarget || "unknown",
          message: "No se encontró una skill seleccionada para ejecutar.",
        })
      )

      return createBlockedExecutionResult({
        context,
        decision: {
          ...decision,
          shouldAct: false,
          safeToExecute: false,
          reason: "No hay skill seleccionada.",
        },
        logs,
        suggestion,
      })
    }

    if (!isSkillEnabled(decision.selectedSkill)) {
      logs.push(
        logSuperAgentBlocked({
          action: "skill_disabled",
          target: decision.selectedTarget || "unknown",
          skillName: decision.selectedSkill,
          message: `La skill "${decision.selectedSkill}" está deshabilitada.`,
        })
      )

      return createBlockedExecutionResult({
        context,
        decision: {
          ...decision,
          shouldAct: false,
          safeToExecute: false,
          reason: `La skill "${decision.selectedSkill}" no está habilitada.`,
        },
        logs,
        suggestion,
      })
    }

    const selectedSkill = getSkillByName(decision.selectedSkill)

    logs.push(
      logSuperAgentInfo({
        action: "skill_ready",
        target: decision.selectedTarget || "unknown",
        skillName: decision.selectedSkill,
        message: `La skill "${decision.selectedSkill}" quedó lista para su ejecución lógica.`,
        metadata: {
          allowedTargets: selectedSkill?.allowedTargets || [],
          safeByDefault: selectedSkill?.safeByDefault ?? false,
        },
      })
    )

    logs.push(
      logSuperAgentInfo({
        action: "cycle_completed",
        target: decision.selectedTarget || "unknown",
        skillName: decision.selectedSkill,
        message: "EduAI Claw completó el ciclo base de observación, decisión y validación.",
      })
    )

    return {
      ok: true,
      identity: {
        displayName: SUPERAGENT_CONFIG.identity.displayName,
        engineAlias: SUPERAGENT_CONFIG.identity.engineAlias,
        internalName: SUPERAGENT_CONFIG.identity.internalName,
        version: SUPERAGENT_CONFIG.identity.version,
      },
      mode: SUPERAGENT_CONFIG.mode,
      status: "observing",
      decision,
      suggestion,
      selectedSkill,
      logs: logs.map(serializeSuperAgentLog),
      output: {
        shouldAct: decision.shouldAct,
        target: decision.selectedTarget,
        skill: decision.selectedSkill,
        confidence: decision.confidence,
        reason: decision.reason,
        safeToExecute: decision.safeToExecute,
      },
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Ocurrió un error desconocido en EduAI Claw."

    logs.push(
      logSuperAgentError({
        action: "cycle_failed",
        target: "unknown",
        message,
      })
    )

    return {
      ok: false,
      identity: {
        displayName: SUPERAGENT_CONFIG.identity.displayName,
        engineAlias: SUPERAGENT_CONFIG.identity.engineAlias,
        internalName: SUPERAGENT_CONFIG.identity.internalName,
        version: SUPERAGENT_CONFIG.identity.version,
      },
      mode: SUPERAGENT_CONFIG.mode,
      status: "error",
      decision: {
        shouldAct: false,
        reason: message,
        confidence: 0,
        safeToExecute: false,
      },
      suggestion: "EduAI Claw encontró un error y no pudo completar el ciclo.",
      logs: logs.map(serializeSuperAgentLog),
      output: {
        shouldAct: false,
        confidence: 0,
        reason: message,
        safeToExecute: false,
      },
    }
  }
}
