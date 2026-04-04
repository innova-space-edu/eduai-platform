// lib/exam-security/scoring.ts

import type {
  SecurityActionDecision,
  SecurityEventType,
  SecurityPolicy,
  SecurityRiskLevel,
  SecuritySessionStatus,
  SecuritySeverity,
} from "@/lib/exam-security/types"

type EscalationInput = {
  nextRiskScore: number
  nextRiskLevel: SecurityRiskLevel
  eventType: SecurityEventType
  session: {
    warning_count: number
    freeze_count: number
    block_count: number
    status: SecuritySessionStatus
  }
  policy: SecurityPolicy
}

const EVENT_SCORES: Record<SecurityEventType, number> = {
  security_session_start: 0,
  security_session_end: 0,

  fullscreen_exit: 15,
  fullscreen_reenter: 0,

  visibility_hidden: 10,
  visibility_return: 0,

  window_blur: 8,
  window_focus: 0,

  copy_attempt: 12,
  paste_attempt: 14,
  cut_attempt: 10,
  context_menu: 6,
  blocked_shortcut: 12,
  print_attempt: 18,
  before_unload: 16,
  drag_attempt: 6,

  heartbeat_missed: 14,
  reconnect_attempt: 4,
  offline: 8,
  online: 0,

  exam_submit: 0,
}

const EVENT_SEVERITIES: Record<SecurityEventType, SecuritySeverity> = {
  security_session_start: "low",
  security_session_end: "low",

  fullscreen_exit: "high",
  fullscreen_reenter: "low",

  visibility_hidden: "high",
  visibility_return: "low",

  window_blur: "medium",
  window_focus: "low",

  copy_attempt: "high",
  paste_attempt: "high",
  cut_attempt: "medium",
  context_menu: "low",
  blocked_shortcut: "high",
  print_attempt: "critical",
  before_unload: "critical",
  drag_attempt: "low",

  heartbeat_missed: "high",
  reconnect_attempt: "low",
  offline: "medium",
  online: "low",

  exam_submit: "low",
}

const EVENT_GROUPS: Record<SecurityEventType, string> = {
  security_session_start: "session",
  security_session_end: "session",

  fullscreen_exit: "fullscreen",
  fullscreen_reenter: "fullscreen",

  visibility_hidden: "visibility",
  visibility_return: "visibility",

  window_blur: "window",
  window_focus: "window",

  copy_attempt: "clipboard",
  paste_attempt: "clipboard",
  cut_attempt: "clipboard",

  context_menu: "interaction",
  blocked_shortcut: "shortcut",
  print_attempt: "print",
  before_unload: "navigation",
  drag_attempt: "interaction",

  heartbeat_missed: "heartbeat",
  reconnect_attempt: "network",
  offline: "network",
  online: "network",

  exam_submit: "exam",
}

export function getEventScore(eventType: SecurityEventType): number {
  return EVENT_SCORES[eventType] ?? 0
}

export function getEventSeverity(eventType: SecurityEventType): SecuritySeverity {
  return EVENT_SEVERITIES[eventType] ?? "low"
}

export function getEventGroup(eventType: SecurityEventType): string {
  return EVENT_GROUPS[eventType] ?? "general"
}

export function getRiskLevel(score: number): SecurityRiskLevel {
  if (score >= 70) return "high"
  if (score >= 40) return "medium"
  if (score >= 15) return "low"
  return "clean"
}

export function computeEscalationAction({
  nextRiskScore,
  nextRiskLevel,
  eventType,
  session,
  policy,
}: EscalationInput): SecurityActionDecision {
  if (!policy.enabled) {
    return { type: "none" }
  }

  // Terminación directa por política de alto riesgo
  if (
    policy.terminateOnHighRisk &&
    nextRiskScore >= policy.highRiskThreshold
  ) {
    return {
      type: "terminate_attempt",
      reason: "high_risk_threshold",
      message:
        "Tu intento fue finalizado porque superó el umbral de riesgo permitido.",
    }
  }

  // Eventos críticos que ameritan corte inmediato
  if (eventType === "before_unload" || eventType === "print_attempt") {
    if (policy.strictMode) {
      return {
        type: "terminate_attempt",
        reason: eventType,
        message:
          "Tu intento fue finalizado por una acción crítica no permitida.",
      }
    }

    return {
      type: "flag_review",
      reason: eventType,
      message:
        "Tu intento fue marcado para revisión por una acción crítica detectada.",
    }
  }

  // Atajos peligrosos / fullscreen / visibilidad
  if (
    eventType === "blocked_shortcut" ||
    eventType === "fullscreen_exit" ||
    eventType === "visibility_hidden"
  ) {
    if (session.warning_count < policy.maxWarnings) {
      return {
        type: "warn",
        reason: eventType,
        message:
          "Se detectó una acción no permitida. Esta advertencia quedó registrada.",
      }
    }

    if (session.freeze_count < policy.maxFreezes) {
      const isFirstFreeze = session.freeze_count === 0
      return {
        type: "freeze",
        reason: eventType,
        durationSeconds: isFirstFreeze
          ? policy.freezeSecondsFirst
          : policy.freezeSecondsRepeat,
        message:
          "Tu examen fue congelado temporalmente por reiteración de incidentes.",
      }
    }

    return {
      type: "block",
      reason: eventType,
      message:
        "Tu sesión fue bloqueada por reiteración de incidentes de seguridad.",
    }
  }

  // Clipboard
  if (
    eventType === "copy_attempt" ||
    eventType === "paste_attempt" ||
    eventType === "cut_attempt"
  ) {
    if (policy.strictMode && nextRiskLevel === "high") {
      return {
        type: "terminate_attempt",
        reason: eventType,
        message:
          "Tu intento fue finalizado por una infracción reiterada de seguridad.",
      }
    }

    if (nextRiskLevel === "high") {
      return {
        type: "flag_review",
        reason: eventType,
        message:
          "Tu intento fue marcado para revisión por actividad sospechosa.",
      }
    }

    return {
      type: "warn",
      reason: eventType,
      message:
        "Se detectó uso de funciones no permitidas durante el examen.",
    }
  }

  // Heartbeat / conectividad
  if (
    eventType === "heartbeat_missed" ||
    eventType === "offline" ||
    eventType === "reconnect_attempt"
  ) {
    if (nextRiskLevel === "high") {
      return {
        type: "flag_review",
        reason: eventType,
        message:
          "Tu intento fue marcado para revisión por inestabilidad o desconexiones reiteradas.",
      }
    }

    return {
      type: "none",
    }
  }

  // Contexto general
  if (nextRiskLevel === "high") {
    return {
      type: "flag_review",
      reason: eventType,
      message:
        "Tu intento fue marcado para revisión por acumulación de riesgo.",
    }
  }

  return {
    type: "none",
  }
}
