// lib/superagent/logger.ts

import type {
  SuperAgentRunLog,
  SuperAgentSkillName,
  SuperAgentTarget,
} from "./types"

type LogStatus = "ok" | "warning" | "blocked" | "error"

export function createSuperAgentLog(params: {
  action: string
  status: LogStatus
  target: SuperAgentTarget
  message: string
  skillName?: SuperAgentSkillName
  metadata?: Record<string, unknown>
}): SuperAgentRunLog {
  return {
    id: crypto.randomUUID(),
    action: params.action,
    status: params.status,
    target: params.target,
    skillName: params.skillName,
    message: params.message,
    metadata: params.metadata,
    createdAt: new Date().toISOString(),
  }
}

export function logSuperAgentInfo(params: {
  action: string
  target: SuperAgentTarget
  message: string
  skillName?: SuperAgentSkillName
  metadata?: Record<string, unknown>
}): SuperAgentRunLog {
  return createSuperAgentLog({
    ...params,
    status: "ok",
  })
}

export function logSuperAgentWarning(params: {
  action: string
  target: SuperAgentTarget
  message: string
  skillName?: SuperAgentSkillName
  metadata?: Record<string, unknown>
}): SuperAgentRunLog {
  return createSuperAgentLog({
    ...params,
    status: "warning",
  })
}

export function logSuperAgentBlocked(params: {
  action: string
  target: SuperAgentTarget
  message: string
  skillName?: SuperAgentSkillName
  metadata?: Record<string, unknown>
}): SuperAgentRunLog {
  return createSuperAgentLog({
    ...params,
    status: "blocked",
  })
}

export function logSuperAgentError(params: {
  action: string
  target: SuperAgentTarget
  message: string
  skillName?: SuperAgentSkillName
  metadata?: Record<string, unknown>
}): SuperAgentRunLog {
  return createSuperAgentLog({
    ...params,
    status: "error",
  })
}

export function serializeSuperAgentLog(
  log: SuperAgentRunLog
): Record<string, unknown> {
  return {
    id: log.id,
    action: log.action,
    status: log.status,
    target: log.target,
    skillName: log.skillName ?? null,
    message: log.message,
    metadata: log.metadata ?? {},
    createdAt: log.createdAt,
  }
}
