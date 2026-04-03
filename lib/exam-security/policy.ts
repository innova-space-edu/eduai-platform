// lib/exam-security/policy.ts

import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { SecurityPolicy } from "./types"

type SecurityPolicyRow = {
  exam_id: string
  enabled: boolean | null
  require_fullscreen: boolean | null
  block_copy_paste: boolean | null
  block_context_menu: boolean | null
  block_shortcuts: boolean | null
  prevent_text_selection: boolean | null
  heartbeat_interval_sec: number | null
  offline_tolerance_sec: number | null
  max_warnings: number | null
  max_freezes: number | null
  freeze_seconds_first: number | null
  freeze_seconds_repeat: number | null
  terminate_on_high_risk: boolean | null
  high_risk_threshold: number | null
  strict_mode: boolean | null
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada")
  }

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  }

  return createAdminClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  enabled: true,
  requireFullscreen: true,
  blockCopyPaste: true,
  blockContextMenu: true,
  blockShortcuts: true,
  preventTextSelection: true,
  heartbeatIntervalSec: 10,
  offlineToleranceSec: 25,
  maxWarnings: 2,
  maxFreezes: 2,
  freezeSecondsFirst: 10,
  freezeSecondsRepeat: 20,
  terminateOnHighRisk: false,
  highRiskThreshold: 70,
  strictMode: false,
}

export function normalizeSecurityPolicy(
  row?: Partial<SecurityPolicyRow> | null
): SecurityPolicy {
  return {
    enabled: row?.enabled ?? DEFAULT_SECURITY_POLICY.enabled,
    requireFullscreen:
      row?.require_fullscreen ?? DEFAULT_SECURITY_POLICY.requireFullscreen,
    blockCopyPaste:
      row?.block_copy_paste ?? DEFAULT_SECURITY_POLICY.blockCopyPaste,
    blockContextMenu:
      row?.block_context_menu ?? DEFAULT_SECURITY_POLICY.blockContextMenu,
    blockShortcuts:
      row?.block_shortcuts ?? DEFAULT_SECURITY_POLICY.blockShortcuts,
    preventTextSelection:
      row?.prevent_text_selection ??
      DEFAULT_SECURITY_POLICY.preventTextSelection,
    heartbeatIntervalSec:
      row?.heartbeat_interval_sec ??
      DEFAULT_SECURITY_POLICY.heartbeatIntervalSec,
    offlineToleranceSec:
      row?.offline_tolerance_sec ??
      DEFAULT_SECURITY_POLICY.offlineToleranceSec,
    maxWarnings: row?.max_warnings ?? DEFAULT_SECURITY_POLICY.maxWarnings,
    maxFreezes: row?.max_freezes ?? DEFAULT_SECURITY_POLICY.maxFreezes,
    freezeSecondsFirst:
      row?.freeze_seconds_first ?? DEFAULT_SECURITY_POLICY.freezeSecondsFirst,
    freezeSecondsRepeat:
      row?.freeze_seconds_repeat ?? DEFAULT_SECURITY_POLICY.freezeSecondsRepeat,
    terminateOnHighRisk:
      row?.terminate_on_high_risk ??
      DEFAULT_SECURITY_POLICY.terminateOnHighRisk,
    highRiskThreshold:
      row?.high_risk_threshold ?? DEFAULT_SECURITY_POLICY.highRiskThreshold,
    strictMode: row?.strict_mode ?? DEFAULT_SECURITY_POLICY.strictMode,
  }
}

export async function getSecurityPolicyByExamId(
  examId: string
): Promise<SecurityPolicy> {
  if (!examId?.trim()) {
    return DEFAULT_SECURITY_POLICY
  }

  const admin = getAdmin()

  const { data, error } = await admin
    .from("exam_security_policies")
    .select(
      `
        exam_id,
        enabled,
        require_fullscreen,
        block_copy_paste,
        block_context_menu,
        block_shortcuts,
        prevent_text_selection,
        heartbeat_interval_sec,
        offline_tolerance_sec,
        max_warnings,
        max_freezes,
        freeze_seconds_first,
        freeze_seconds_repeat,
        terminate_on_high_risk,
        high_risk_threshold,
        strict_mode
      `
    )
    .eq("exam_id", examId)
    .maybeSingle<SecurityPolicyRow>()

  if (error) {
    console.error("[exam-security/policy:getSecurityPolicyByExamId]", error.message)
    return DEFAULT_SECURITY_POLICY
  }

  return normalizeSecurityPolicy(data)
}

export async function ensureSecurityPolicyForExam(
  examId: string
): Promise<SecurityPolicy> {
  const admin = getAdmin()

  const existing = await getSecurityPolicyByExamId(examId)

  const { error } = await admin.from("exam_security_policies").upsert(
    {
      exam_id: examId,
      enabled: existing.enabled,
      require_fullscreen: existing.requireFullscreen,
      block_copy_paste: existing.blockCopyPaste,
      block_context_menu: existing.blockContextMenu,
      block_shortcuts: existing.blockShortcuts,
      prevent_text_selection: existing.preventTextSelection,
      heartbeat_interval_sec: existing.heartbeatIntervalSec,
      offline_tolerance_sec: existing.offlineToleranceSec,
      max_warnings: existing.maxWarnings,
      max_freezes: existing.maxFreezes,
      freeze_seconds_first: existing.freezeSecondsFirst,
      freeze_seconds_repeat: existing.freezeSecondsRepeat,
      terminate_on_high_risk: existing.terminateOnHighRisk,
      high_risk_threshold: existing.highRiskThreshold,
      strict_mode: existing.strictMode,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "exam_id",
      ignoreDuplicates: false,
    }
  )

  if (error) {
    console.error("[exam-security/policy:ensureSecurityPolicyForExam]", error.message)
  }

  return existing
}

export function applyStrictMode(policy: SecurityPolicy): SecurityPolicy {
  if (!policy.strictMode) return policy

  return {
    ...policy,
    maxWarnings: 1,
    maxFreezes: 1,
    freezeSecondsFirst: Math.max(policy.freezeSecondsFirst, 15),
    freezeSecondsRepeat: Math.max(policy.freezeSecondsRepeat, 30),
    terminateOnHighRisk: true,
    highRiskThreshold: Math.min(policy.highRiskThreshold, 60),
    heartbeatIntervalSec: Math.min(policy.heartbeatIntervalSec, 8),
    offlineToleranceSec: Math.min(policy.offlineToleranceSec, 20),
  }
}

export async function getResolvedSecurityPolicy(
  examId: string
): Promise<SecurityPolicy> {
  const basePolicy = await ensureSecurityPolicyForExam(examId)
  return applyStrictMode(basePolicy)
}
