// lib/superagent/guardrails.ts

import { SUPERAGENT_CONFIG } from "./config"
import type {
  SuperAgentDecision,
  SuperAgentRunLog,
  SuperAgentSkillName,
  SuperAgentTarget,
} from "./types"

const SECRET_PATTERNS = [
  ".env",
  "api_key",
  "apikey",
  "secret",
  "token",
  "private_key",
  "service_role",
  "authorization",
]

const PROTECTED_TARGETS: SuperAgentTarget[] = ["chat"]

export function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

export function containsSecretPattern(text: string): boolean {
  const normalized = normalizeText(text)
  return SECRET_PATTERNS.some((pattern) => normalized.includes(pattern))
}

export function canInspectResource(resourceName: string): boolean {
  if (SUPERAGENT_CONFIG.limits.allowSecretInspection) {
    return true
  }

  return !containsSecretPattern(resourceName)
}

export function canWriteToTarget(target: SuperAgentTarget): boolean {
  if (target === "chat" && !SUPERAGENT_CONFIG.limits.allowPrivateChatInjection) {
    return false
  }

  if (
    target !== "drafts" &&
    !SUPERAGENT_CONFIG.features.productionWriteEnabled
  ) {
    return false
  }

  return true
}

export function canOverwriteProduction(): boolean {
  return SUPERAGENT_CONFIG.limits.allowProductionOverwrite
}

export function isProtectedTarget(target: SuperAgentTarget): boolean {
  return PROTECTED_TARGETS.includes(target)
}

export function isSkillAllowed(skill: SuperAgentSkillName): boolean {
  const blockedWhenSelfModificationDisabled: SuperAgentSkillName[] = []

  if (!SUPERAGENT_CONFIG.features.selfModificationEnabled) {
    return !blockedWhenSelfModificationDisabled.includes(skill)
  }

  return true
}

export function validateDecision(
  decision: SuperAgentDecision
): SuperAgentDecision {
  if (!decision.shouldAct) {
    return {
      ...decision,
      safeToExecute: false,
      reason: decision.reason || "La decisión fue marcada como inactiva.",
    }
  }

  if (!decision.selectedTarget) {
    return {
      ...decision,
      shouldAct: false,
      safeToExecute: false,
      reason: "No se definió un target válido.",
    }
  }

  if (!decision.selectedSkill) {
    return {
      ...decision,
      shouldAct: false,
      safeToExecute: false,
      reason: "No se definió una skill válida.",
    }
  }

  if (!isSkillAllowed(decision.selectedSkill)) {
    return {
      ...decision,
      shouldAct: false,
      safeToExecute: false,
      reason: `La skill ${decision.selectedSkill} no está permitida actualmente.`,
    }
  }

  if (isProtectedTarget(decision.selectedTarget)) {
    return {
      ...decision,
      shouldAct: false,
      safeToExecute: false,
      reason:
        "El target solicitado está protegido. EduAI Claw no puede escribir ni intervenir directamente en el chat privado del usuario.",
    }
  }

  return {
    ...decision,
    safeToExecute: true,
  }
}

export function createBlockedLog(params: {
  target: SuperAgentTarget
  message: string
  skillName?: SuperAgentSkillName
  metadata?: Record<string, unknown>
}): SuperAgentRunLog {
  return {
    id: crypto.randomUUID(),
    action: "guardrail_blocked",
    status: "blocked",
    target: params.target,
    skillName: params.skillName,
    message: params.message,
    metadata: params.metadata,
    createdAt: new Date().toISOString(),
  }
}

export function createOkLog(params: {
  action: string
  target: SuperAgentTarget
  message: string
  skillName?: SuperAgentSkillName
  metadata?: Record<string, unknown>
}): SuperAgentRunLog {
  return {
    id: crypto.randomUUID(),
    action: params.action,
    status: "ok",
    target: params.target,
    skillName: params.skillName,
    message: params.message,
    metadata: params.metadata,
    createdAt: new Date().toISOString(),
  }
}
