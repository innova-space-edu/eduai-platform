import type { SupabaseClient } from "@supabase/supabase-js"
import type { AICapability, AIReusePolicy, AIVisibility } from "./capabilities"

export type ReusableGeneration = {
  id: string
  fingerprint: string
  capability: AICapability
  provider: string | null
  model: string | null
  result: Record<string, unknown>
  assetId: string | null
  hitCount: number
}

export type EduAIAssetInput = {
  ownerId: string
  assetType: string
  title?: string | null
  mimeType?: string | null
  storageBucket?: string | null
  storagePath?: string | null
  externalUrl?: string | null
  textContent?: string | null
  contentJson?: Record<string, unknown> | unknown[] | null
  sourceModule?: string | null
  sourceId?: string | null
  generationRequestId?: string | null
  fingerprint?: string | null
  visibility?: AIVisibility
  metadata?: Record<string, unknown>
  parentAssetId?: string | null
  rootAssetId?: string | null
  version?: number
  retentionUntil?: string | null
  workspaceId?: string | null
  dataClassification?: "standard" | "personal" | "sensitive" | "confidential"
  processingPurpose?: string | null
  containsPersonalData?: boolean
}

function isSchemaUnavailable(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null
  return value?.code === "42P01" || /does not exist|schema cache/i.test(value?.message || "")
}

export async function findReusableGeneration(input: {
  supabase: SupabaseClient
  userId: string
  fingerprint: string
  capability: AICapability
  reusePolicy?: AIReusePolicy
}): Promise<ReusableGeneration | null> {
  if (!input.reusePolicy || input.reusePolicy === "never") return null

  const { data, error } = await input.supabase
    .from("ai_generation_cache")
    .select("id,fingerprint,capability,provider,model,result_json,asset_id,hit_count,expires_at,invalidated_at")
    .eq("owner_id", input.userId)
    .eq("fingerprint", input.fingerprint)
    .eq("capability", input.capability)
    .is("invalidated_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (!isSchemaUnavailable(error)) console.warn("[AI Reuse] cache lookup failed:", error.message)
    return null
  }

  if (!data) return null
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null

  void input.supabase
    .from("ai_generation_cache")
    .update({ hit_count: Number(data.hit_count || 0) + 1, last_hit_at: new Date().toISOString() })
    .eq("id", data.id)

  return {
    id: data.id,
    fingerprint: data.fingerprint,
    capability: data.capability as AICapability,
    provider: data.provider,
    model: data.model,
    result: (data.result_json || {}) as Record<string, unknown>,
    assetId: data.asset_id,
    hitCount: Number(data.hit_count || 0) + 1,
  }
}

export async function recordGenerationStart(input: {
  supabase: SupabaseClient
  userId: string
  capability: AICapability
  fingerprint: string
  module?: string | null
  provider?: string | null
  model?: string | null
  requestJson?: Record<string, unknown>
  reusePolicy?: AIReusePolicy
  workspaceId?: string | null
}): Promise<string | null> {
  const { data, error } = await input.supabase
    .from("ai_generation_requests")
    .insert({
      owner_id: input.userId,
      capability: input.capability,
      fingerprint: input.fingerprint,
      source_module: input.module || null,
      provider: input.provider || null,
      model: input.model || null,
      request_json: input.requestJson || {},
      reuse_policy: input.reusePolicy || "never",
      workspace_id: input.workspaceId || null,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle()

  if (error) {
    if (!isSchemaUnavailable(error)) console.warn("[AI Reuse] request log failed:", error.message)
    return null
  }
  return data?.id || null
}

export async function finishGenerationRequest(input: {
  supabase: SupabaseClient
  requestId: string | null
  status: "completed" | "failed" | "reused"
  provider?: string | null
  model?: string | null
  assetId?: string | null
  error?: string | null
  latencyMs?: number | null
  estimatedCostUsd?: number | null
  metadata?: Record<string, unknown>
}) {
  if (!input.requestId) return

  const { error } = await input.supabase
    .from("ai_generation_requests")
    .update({
      status: input.status,
      provider: input.provider || null,
      model: input.model || null,
      asset_id: input.assetId || null,
      error_message: input.error || null,
      latency_ms: input.latencyMs ?? null,
      estimated_cost_usd: input.estimatedCostUsd ?? null,
      response_metadata: input.metadata || {},
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)

  if (error && !isSchemaUnavailable(error)) {
    console.warn("[AI Reuse] request finish failed:", error.message)
  }
}

export async function createEduAIAsset(
  supabase: SupabaseClient,
  input: EduAIAssetInput
): Promise<string | null> {
  const rootAssetId = input.rootAssetId || null
  const hasPayload = Boolean(
    input.storagePath || input.externalUrl || input.textContent || input.contentJson
  )
  if (!hasPayload) {
    console.warn("[AI Assets] se omitió un asset sin contenido persistente")
    return null
  }

  const { data, error } = await supabase
    .from("eduai_assets")
    .insert({
      owner_id: input.ownerId,
      asset_type: input.assetType,
      title: input.title || null,
      mime_type: input.mimeType || null,
      storage_bucket: input.storageBucket || null,
      storage_path: input.storagePath || null,
      external_url: input.externalUrl || null,
      text_content: input.textContent || null,
      content_json: input.contentJson || null,
      source_module: input.sourceModule || null,
      source_id: input.sourceId || null,
      generation_request_id: input.generationRequestId || null,
      fingerprint: input.fingerprint || null,
      visibility: input.visibility || "private",
      workspace_id: input.workspaceId || null,
      metadata: input.metadata || {},
      parent_asset_id: input.parentAssetId || null,
      root_asset_id: rootAssetId,
      version: input.version || 1,
      retention_until: input.retentionUntil || null,
      data_classification: input.dataClassification || "standard",
      processing_purpose: input.processingPurpose || null,
      contains_personal_data: Boolean(input.containsPersonalData),
    })
    .select("id")
    .maybeSingle()

  if (error) {
    if (!isSchemaUnavailable(error)) console.warn("[AI Assets] insert failed:", error.message)
    return null
  }

  if (data?.id && !rootAssetId) {
    await supabase.from("eduai_assets").update({ root_asset_id: data.id }).eq("id", data.id)
  }

  return data?.id || null
}

export async function saveReusableGeneration(input: {
  supabase: SupabaseClient
  userId: string
  capability: AICapability
  fingerprint: string
  result: Record<string, unknown>
  provider?: string | null
  model?: string | null
  assetId?: string | null
  reusePolicy?: AIReusePolicy
  visibility?: AIVisibility
  workspaceId?: string | null
  expiresAt?: string | null
}): Promise<void> {
  if (!input.reusePolicy || input.reusePolicy === "never") return

  const { error } = await input.supabase.from("ai_generation_cache").upsert(
    {
      owner_id: input.userId,
      capability: input.capability,
      fingerprint: input.fingerprint,
      provider: input.provider || null,
      model: input.model || null,
      result_json: input.result,
      asset_id: input.assetId || null,
      reuse_policy: input.reusePolicy,
      visibility: input.visibility || "private",
      workspace_id: input.workspaceId || null,
      expires_at: input.expiresAt || null,
      invalidated_at: null,
      last_hit_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,capability,fingerprint" }
  )

  if (error && !isSchemaUnavailable(error)) {
    console.warn("[AI Reuse] cache save failed:", error.message)
  }
}

export async function attachAssetToGeneration(input: {
  supabase: SupabaseClient
  userId: string
  capability: AICapability
  fingerprint: string
  assetId: string
}): Promise<void> {
  const { error } = await input.supabase
    .from("ai_generation_cache")
    .update({ asset_id: input.assetId })
    .eq("owner_id", input.userId)
    .eq("capability", input.capability)
    .eq("fingerprint", input.fingerprint)

  if (error && !isSchemaUnavailable(error)) {
    console.warn("[AI Reuse] cache asset attach failed:", error.message)
  }
}

export async function linkAsset(input: {
  supabase: SupabaseClient
  ownerId: string
  assetId: string
  targetType: string
  targetId: string
  relation?: string
}): Promise<void> {
  const { error } = await input.supabase.from("eduai_asset_links").upsert(
    {
      owner_id: input.ownerId,
      asset_id: input.assetId,
      target_type: input.targetType,
      target_id: input.targetId,
      relation: input.relation || "uses",
    },
    { onConflict: "asset_id,target_type,target_id,relation" }
  )

  if (error && !isSchemaUnavailable(error)) {
    console.warn("[AI Assets] link failed:", error.message)
  }
}
