import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export type PersonalAIProvider = "fal" | "huggingface" | "replicate"

export type PersonalCredentialMetadata = {
  id: string
  provider: PersonalAIProvider
  label: string | null
  last4: string | null
  enabled: boolean
  maxRequestUsd: number | null
  dailyBudgetUsd: number | null
  currency: string
  testStatus: "untested" | "healthy" | "invalid" | "error" | null
  testMessage: string | null
  testedAt: string | null
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function masterKeyMaterial() {
  const dedicated = process.env.EDUAI_CREDENTIALS_MASTER_KEY?.trim()
  if (dedicated) return { value: dedicated, source: "dedicated" as const }

  // Temporary rollout fallback so BYOK can work before a dedicated secret is added.
  // SUPABASE_SERVICE_ROLE_KEY is server-only and high entropy, but a separate
  // EDUAI_CREDENTIALS_MASTER_KEY remains strongly recommended for rotation isolation.
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (fallback) return { value: fallback, source: "service-role-fallback" as const }

  throw new Error("No hay material de cifrado configurado para credenciales personales")
}

function encryptionKey() {
  return createHash("sha256").update(masterKeyMaterial().value, "utf8").digest()
}

export function credentialEncryptionSource() {
  try {
    return masterKeyMaterial().source
  } catch {
    return "missing" as const
  }
}

export function encryptPersonalSecret(secret: string) {
  const clean = secret.trim()
  if (clean.length < 8) throw new Error("La API key parece demasiado corta")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    encryptedSecret: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    last4: clean.slice(-4),
  }
}

export function decryptPersonalSecret(row: {
  encrypted_secret: string
  encryption_iv: string
  encryption_tag: string
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(row.encryption_iv, "base64"),
  )
  decipher.setAuthTag(Buffer.from(row.encryption_tag, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_secret, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function metadata(row: any): PersonalCredentialMetadata {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label ?? null,
    last4: row.secret_last4 ?? null,
    enabled: Boolean(row.enabled),
    maxRequestUsd: asNumber(row.max_request_usd),
    dailyBudgetUsd: asNumber(row.daily_budget_usd),
    currency: row.currency || "USD",
    testStatus: row.test_status ?? null,
    testMessage: row.test_message ?? null,
    testedAt: row.tested_at ?? null,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listPersonalCredentials(userId: string) {
  const { data, error } = await adminClient()
    .from("user_ai_credentials")
    .select("id,provider,label,secret_last4,enabled,max_request_usd,daily_budget_usd,currency,test_status,test_message,tested_at,last_used_at,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map(metadata)
}

export async function savePersonalCredential(input: {
  userId: string
  provider: PersonalAIProvider
  secret: string
  label?: string | null
  enabled?: boolean
  maxRequestUsd?: number | null
  dailyBudgetUsd?: number | null
}) {
  const encrypted = encryptPersonalSecret(input.secret)
  const now = new Date().toISOString()
  const { data, error } = await adminClient()
    .from("user_ai_credentials")
    .upsert({
      user_id: input.userId,
      provider: input.provider,
      label: input.label?.trim() || null,
      encrypted_secret: encrypted.encryptedSecret,
      encryption_iv: encrypted.iv,
      encryption_tag: encrypted.tag,
      secret_last4: encrypted.last4,
      enabled: input.enabled ?? true,
      max_request_usd: input.maxRequestUsd ?? null,
      daily_budget_usd: input.dailyBudgetUsd ?? null,
      currency: "USD",
      test_status: "untested",
      test_message: null,
      tested_at: null,
      updated_at: now,
    }, { onConflict: "user_id,provider" })
    .select("id,provider,label,secret_last4,enabled,max_request_usd,daily_budget_usd,currency,test_status,test_message,tested_at,last_used_at,created_at,updated_at")
    .single()
  if (error) throw new Error(error.message)
  return metadata(data)
}

export async function updatePersonalCredentialSettings(input: {
  userId: string
  provider: PersonalAIProvider
  enabled?: boolean
  maxRequestUsd?: number | null
  dailyBudgetUsd?: number | null
  label?: string | null
}) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof input.enabled === "boolean") patch.enabled = input.enabled
  if ("maxRequestUsd" in input) patch.max_request_usd = input.maxRequestUsd ?? null
  if ("dailyBudgetUsd" in input) patch.daily_budget_usd = input.dailyBudgetUsd ?? null
  if ("label" in input) patch.label = input.label?.trim() || null

  const { data, error } = await adminClient()
    .from("user_ai_credentials")
    .update(patch)
    .eq("user_id", input.userId)
    .eq("provider", input.provider)
    .select("id,provider,label,secret_last4,enabled,max_request_usd,daily_budget_usd,currency,test_status,test_message,tested_at,last_used_at,created_at,updated_at")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? metadata(data) : null
}

export async function deletePersonalCredential(userId: string, provider: PersonalAIProvider) {
  const { error } = await adminClient()
    .from("user_ai_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider)
  if (error) throw new Error(error.message)
}

export async function getPersonalCredentialSecret(userId: string, provider: PersonalAIProvider) {
  const { data, error } = await adminClient()
    .from("user_ai_credentials")
    .select("id,provider,encrypted_secret,encryption_iv,encryption_tag,enabled,max_request_usd,daily_budget_usd")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || !data.enabled) return null
  return {
    id: data.id as string,
    provider: data.provider as PersonalAIProvider,
    secret: decryptPersonalSecret(data),
    maxRequestUsd: asNumber(data.max_request_usd),
    dailyBudgetUsd: asNumber(data.daily_budget_usd),
  }
}

export async function markCredentialTest(input: {
  userId: string
  provider: PersonalAIProvider
  status: "healthy" | "invalid" | "error"
  message?: string | null
}) {
  const { error } = await adminClient()
    .from("user_ai_credentials")
    .update({
      test_status: input.status,
      test_message: input.message?.slice(0, 300) || null,
      tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId)
    .eq("provider", input.provider)
  if (error) throw new Error(error.message)
}

export async function markCredentialUsed(userId: string, provider: PersonalAIProvider) {
  await adminClient()
    .from("user_ai_credentials")
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider)
}

export async function personalSpendToday(userId: string, provider?: PersonalAIProvider) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  let query = adminClient()
    .from("user_ai_spend_events")
    .select("estimated_cost_usd,actual_cost_usd,status")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .in("status", ["submitted", "processing", "completed"])
  if (provider) query = query.eq("provider", provider)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []).reduce((sum, row) => {
    const value = row.actual_cost_usd ?? row.estimated_cost_usd ?? 0
    return sum + Number(value || 0)
  }, 0)
}

export async function assertPersonalBudget(input: {
  userId: string
  provider: PersonalAIProvider
  estimatedCostUsd: number | null
  maxRequestUsd?: number | null
  dailyBudgetUsd?: number | null
}) {
  const estimate = input.estimatedCostUsd
  if (estimate !== null && input.maxRequestUsd !== null && input.maxRequestUsd !== undefined && estimate > input.maxRequestUsd) {
    throw new Error(`El costo estimado US$${estimate.toFixed(2)} supera tu límite por generación de US$${input.maxRequestUsd.toFixed(2)}.`)
  }
  if (input.dailyBudgetUsd !== null && input.dailyBudgetUsd !== undefined) {
    const used = await personalSpendToday(input.userId, input.provider)
    if (estimate !== null && used + estimate > input.dailyBudgetUsd) {
      throw new Error(`Esta generación superaría tu presupuesto diario de US$${input.dailyBudgetUsd.toFixed(2)}.`)
    }
  }
}

export async function recordPersonalSpend(input: {
  userId: string
  credentialId?: string | null
  provider: PersonalAIProvider
  capability: string
  model?: string | null
  externalRequestId?: string | null
  status: "estimated" | "submitted" | "processing" | "completed" | "failed" | "cancelled"
  estimatedCostUsd?: number | null
  actualCostUsd?: number | null
  metadata?: Record<string, unknown>
}) {
  const now = new Date().toISOString()
  const { data, error } = await adminClient()
    .from("user_ai_spend_events")
    .insert({
      user_id: input.userId,
      credential_id: input.credentialId || null,
      provider: input.provider,
      capability: input.capability,
      model: input.model || null,
      external_request_id: input.externalRequestId || null,
      status: input.status,
      estimated_cost_usd: input.estimatedCostUsd ?? null,
      actual_cost_usd: input.actualCostUsd ?? null,
      metadata: input.metadata || {},
      completed_at: ["completed", "failed", "cancelled"].includes(input.status) ? now : null,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}
