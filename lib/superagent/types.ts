// lib/superagent/types.ts

export type SuperAgentMode =
  | "observe"
  | "observe_route"
  | "observe_social"
  | "observe_anticipate"
  | "observe_social_anticipate"

export type SuperAgentStatus =
  | "idle"
  | "observing"
  | "thinking"
  | "routing"
  | "socializing"
  | "anticipating"
  | "drafting"
  | "paused"
  | "error"

export type SuperAgentTarget =
  | "chat"
  | "educador"
  | "investigador"
  | "matematico"
  | "paper"
  | "imagenes"
  | "audio"
  | "examen"
  | "social"
  | "drafts"
  | "unknown"

export type SuperAgentSkillName =
  | "observe_user_context"
  | "route_to_best_agent"
  | "summarize_goal"
  | "optimize_prompt"
  | "repair_failed_call"
  | "save_memory_snapshot"
  | "suggest_next_step"
  | "agent_health_check"
  | "spawn_agent_discussion"
  | "extract_ideas_from_social_chat"
  | "anticipate_user_next_need"
  | "create_draft_file"

export type SuperAgentPriority = "low" | "medium" | "high" | "critical"

export interface SuperAgentIdentity {
  displayName: string
  engineAlias: string
  internalName: string
  version: string
  inspiration: {
    sandboxStyle: string
    skillsStyle: string
  }
}

export interface SuperAgentFeatureFlags {
  autonomyEnabled: boolean
  socialLayerEnabled: boolean
  anticipationEnabled: boolean
  draftCreationEnabled: boolean
  routingEnabled: boolean
  selfModificationEnabled: boolean
  productionWriteEnabled: boolean
}

export interface SuperAgentLimits {
  maxSuggestionsPerCycle: number
  maxDraftsPerCycle: number
  maxSkillsPerCycle: number
  allowPrivateChatInjection: boolean
  allowProductionOverwrite: boolean
  allowSecretInspection: boolean
}

export interface SuperAgentSkillDefinition {
  name: SuperAgentSkillName
  description: string
  enabled: boolean
  safeByDefault: boolean
  allowedTargets: SuperAgentTarget[]
}

export interface SuperAgentTask {
  id: string
  type: SuperAgentSkillName | "custom"
  title: string
  description?: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  priority: SuperAgentPriority
  target: SuperAgentTarget
  payload?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface SuperAgentRunLog {
  id: string
  action: string
  status: "ok" | "warning" | "blocked" | "error"
  target: SuperAgentTarget
  skillName?: SuperAgentSkillName
  message: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface SuperAgentUserContext {
  userId?: string
  currentPage?: string
  activeAgent?: SuperAgentTarget
  userGoal?: string
  recentMessages?: string[]
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface SuperAgentDecision {
  shouldAct: boolean
  selectedSkill?: SuperAgentSkillName
  selectedTarget?: SuperAgentTarget
  reason: string
  confidence: number
  safeToExecute: boolean
}

export interface SuperAgentConfig {
  identity: SuperAgentIdentity
  mode: SuperAgentMode
  status: SuperAgentStatus
  features: SuperAgentFeatureFlags
  limits: SuperAgentLimits
}
