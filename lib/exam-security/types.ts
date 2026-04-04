// lib/exam-security/types.ts

export type SecurityEventType =
  | "security_session_start"
  | "security_session_end"
  | "fullscreen_exit"
  | "fullscreen_reenter"
  | "visibility_hidden"
  | "visibility_return"
  | "window_blur"
  | "window_focus"
  | "copy_attempt"
  | "paste_attempt"
  | "cut_attempt"
  | "context_menu"
  | "blocked_shortcut"
  | "print_attempt"
  | "before_unload"
  | "drag_attempt"
  | "heartbeat_missed"
  | "reconnect_attempt"
  | "offline"
  | "online"
  | "exam_submit"

export type SecuritySeverity = "low" | "medium" | "high" | "critical"

export type SecurityRiskLevel = "clean" | "low" | "medium" | "high"

export type SecuritySessionStatus =
  | "active"
  | "warned"
  | "frozen"
  | "blocked"
  | "flagged"
  | "finished"
  | "terminated"
  | "offline_grace"

export type SecurityActionType =
  | "none"
  | "warn"
  | "freeze"
  | "block"
  | "flag_review"
  | "terminate_attempt"
  | "teacher_override"
  | "clear_state"

export interface SecurityClientMetadata {
  userAgent?: string
  language?: string
  timezone?: string
  platform?: string
  windowWidth?: number
  windowHeight?: number
  screenWidth?: number
  screenHeight?: number
  [key: string]: unknown
}

export interface SecurityEventPayload {
  visibilityState?: string
  fullscreen?: boolean
  key?: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  online?: boolean
  reason?: string
  windowWidth?: number
  windowHeight?: number
  detail?: string
  dw?: number
  dh?: number
  phase?: string
  [key: string]: unknown
}

export interface SecurityEventInput {
  sessionId: string
  examId: string
  submissionId?: string | null
  eventType: SecurityEventType
  questionIndex?: number | null
  clientTimeLeft?: number | null
  payload?: SecurityEventPayload
}

export interface SecurityEventRecord {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  event_type: SecurityEventType
  event_group: string | null
  severity: SecuritySeverity
  score_delta: number
  question_index: number | null
  client_time_left: number | null
  visibility_state: string | null
  fullscreen: boolean | null
  window_width: number | null
  window_height: number | null
  user_agent: string | null
  incident_number: number | null
  payload: SecurityEventPayload
  created_at: string
}

export interface SecurityActionDecision {
  type: SecurityActionType
  message?: string
  durationSeconds?: number
  reason?: string
}

export interface SecurityActionRecord {
  id: string
  session_id: string
  exam_id: string
  submission_id: string | null
  action_type: SecurityActionType
  reason: string | null
  duration_seconds: number | null
  applied_by: string
  payload: Record<string, unknown>
  created_at: string
}

export interface SecurityPolicy {
  enabled: boolean
  requireFullscreen: boolean
  blockCopyPaste: boolean
  blockContextMenu: boolean
  blockShortcuts: boolean
  preventTextSelection: boolean
  heartbeatIntervalSec: number
  offlineToleranceSec: number
  maxWarnings: number
  maxFreezes: number
  freezeSecondsFirst: number
  freezeSecondsRepeat: number
  terminateOnHighRisk: boolean
  highRiskThreshold: number
  strictMode: boolean
}

export interface SecuritySessionRecord {
  id: string
  exam_id: string
  submission_id: string | null
  teacher_id: string | null
  student_name: string | null
  student_course: string | null
  student_rut: string | null
  status: SecuritySessionStatus
  risk_score: number
  risk_level: SecurityRiskLevel
  warning_count: number
  freeze_count: number
  block_count: number
  last_event_at: string | null
  last_heartbeat_at: string | null
  started_at: string
  ended_at: string | null
  client_metadata: SecurityClientMetadata
  created_at: string
  updated_at: string
}

export interface SecurityEvaluationResult {
  success: boolean
  riskScore: number
  riskLevel: SecurityRiskLevel
  severity: SecuritySeverity
  scoreDelta: number
  action: SecurityActionDecision
}

export interface SecuritySessionStartInput {
  examId: string
  submissionId?: string | null
  studentName?: string | null
  studentCourse?: string | null
  studentRut?: string | null
  clientMetadata?: SecurityClientMetadata
}

export interface SecuritySessionStartResponse {
  success: boolean
  sessionId: string
  policy: SecurityPolicy
  session: SecuritySessionRecord
}

export interface SecurityHeartbeatInput {
  sessionId: string
  examId: string
  submissionId?: string | null
  payload?: Record<string, unknown>
}

export interface SecurityApiResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}
