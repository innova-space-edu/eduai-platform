// lib/exam-security/scoring.ts

import type {
  SecurityActionDecision,
  SecurityEventType,
  SecurityRiskLevel,
  SecuritySeverity,
  SecuritySessionRecord,
} from "./types"
import type { SecurityPolicy } from "./types"

const EVENT_SCORE_MAP: Record<SecurityEventType, number> = {
  security_session_start: 0,
  security_session_end: 0,

  fullscreen_exit: 15,
  fullscreen_reenter: 0,

  window_blur: 8,
  window_focus_return: 0,

  tab_hidden: 10,
  visibility_return: 0,

  copy_attempt: 18,
  paste_attempt: 15,
  cut_attempt: 15,

  contextmenu_attempt: 10,
  blocked_shortcut: 12,
  print_attempt: 20,
  reload_attempt: 18,
  drag_attempt: 8,

  heartbeat_missed: 12,
  reconnect_attempt: 10,
  network_offline: 4,
  network_online: 0,

  exam_submit: 0,
}

const EVENT_SEVERITY_MAP: Record<SecurityEventType, SecuritySeverity> = {
  security_session_start: "low",
  security_session_end: "low",

  fullscreen_exit: "high",
  fullscreen_reenter: "low",

  window_blur: "low",
  window_focus_return: "low",

  tab_hidden: "medium",
  visibility_return: "low",

  copy_attempt: "high",
  paste_attempt: "high",
  cut_attempt: "high",

  contextmenu_attempt: "medium",
  blocked_shortcut: "medium",
  print_attempt: "critical",
  reload_attempt: "high",
  drag_attempt: "low",

  heartbeat_missed: "medium",
  reconnect_attempt: "medium",
  network_offline: "low",
  network_online: "low",

  exam_submit: "low",
}

export function getEventScore(eventType: SecurityEventType): number {
  return EVENT_SCORE_MAP[eventType] ?? 0
}

export function getEventSeverity(
  eventType: SecurityEventType
): SecuritySeverity {
  return EVENT_SEVERITY_MAP[eventType] ?? "low"
}

export function getRiskLevel(score: number): SecurityRiskLevel {
  if (score >= 70) return "high"
  if (score >= 40) return "medium"
  if (score >= 20) return "low"
  return "clean"
}

export function getEventGroup(eventType: SecurityEventType): string {
  if (eventType.includes("fullscreen")) return "fullscreen"
  if (eventType.includes("blur") || eventType.includes("focus")) return "focus"
  if (eventType.includes("hidden") || eventType.includes("visibility")) {
    return "visibility"
  }
  if (
    eventType.includes("copy") ||
    eventType.includes("paste") ||
    eventType.includes("cut") ||
    eventType.includes("shortcut") ||
    eventType.includes("contextmenu") ||
    eventType.includes("drag") ||
    eventType.includes("print")
  ) {
    return "interaction"
  }
  if (
    eventType.includes("heartbeat") ||
    eventType.includes("network") ||
    eventType.includes("reconnect")
  ) {
    return "connectivity"
  }
  return "general"
}

export function computeEscalationAction(params: {
  nextRiskScore: number
  nextRiskLevel: SecurityRiskLevel
  eventType: SecurityEventType
  session: Pick<
    SecuritySessionRecord,
    "warning_count" | "freeze_count" | "block_count" | "status"
  >
  policy: SecurityPolicy
}): SecurityActionDecision {
  const { nextRiskScore, nextRiskLevel, eventType, session, policy } = params

  const warningCount = session.warning_count ?? 0
  const freezeCount = session.freeze_count ?? 0

  const isCriticalEvent =
    eventType === "print_attempt" ||
    eventType === "reload_attempt" ||
    eventType === "copy_attempt"

  const isMediumOrHigher =
    nextRiskLevel === "medium" || nextRiskLevel === "high"

  const isHighRisk = nextRiskScore >= policy.highRiskThreshold

  if (policy.terminateOnHighRisk && isHighRisk) {
    return {
      type: "terminate_attempt",
      message: "Tu intento fue finalizado por política de seguridad.",
      reason: "High risk threshold reached",
    }
  }

  if (isHighRisk) {
    return {
      type: "flag_review",
      message:
        "Tu sesión fue marcada para revisión obligatoria por seguridad.",
      reason: "High risk session flagged",
    }
  }

  if (isCriticalEvent && freezeCount >= policy.maxFreezes) {
    return {
      type: "block",
      message:
        "Tu sesión fue bloqueada temporalmente por reiteración de incidentes.",
      reason: "Repeated critical event after max freezes",
    }
  }

  if (isMediumOrHigher || isCriticalEvent) {
    const durationSeconds =
      freezeCount === 0
        ? policy.freezeSecondsFirst
        : policy.freezeSecondsRepeat

    return {
      type: "freeze",
      durationSeconds,
      message: `Examen bloqueado temporalmente por ${durationSeconds} segundos.`,
      reason: "Escalated temporary freeze",
    }
  }

  if (warningCount < policy.maxWarnings) {
    return {
      type: "warn",
      message:
        "Advertencia: se detectó una acción no permitida y fue registrada.",
      reason: "Initial warning",
    }
  }

  return {
    type: "freeze",
    durationSeconds: policy.freezeSecondsFirst,
    message: `Examen bloqueado temporalmente por ${policy.freezeSecondsFirst} segundos.`,
    reason: "Warnings exceeded",
  }
}
