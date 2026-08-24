import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { PersonalAIProvider } from "@/lib/ai/personal-credentials"

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function updatePersonalSpend(input: {
  userId: string
  provider: PersonalAIProvider
  spendEventId?: string | null
  externalRequestId?: string | null
  status: "submitted" | "processing" | "completed" | "failed" | "cancelled"
  actualCostUsd?: number | null
  metadata?: Record<string, unknown>
}) {
  if (!input.spendEventId && !input.externalRequestId) return null

  const patch: Record<string, unknown> = {
    status: input.status,
    ...(input.actualCostUsd !== undefined ? { actual_cost_usd: input.actualCostUsd } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(["completed", "failed", "cancelled"].includes(input.status)
      ? { completed_at: new Date().toISOString() }
      : {}),
  }

  let query = adminClient()
    .from("user_ai_spend_events")
    .update(patch)
    .eq("user_id", input.userId)
    .eq("provider", input.provider)

  query = input.spendEventId
    ? query.eq("id", input.spendEventId)
    : query.eq("external_request_id", input.externalRequestId!)

  const { data, error } = await query.select("id").maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id || null
}

export async function findPersonalSpendByExternalRequest(input: {
  userId: string
  provider: PersonalAIProvider
  externalRequestId: string
}) {
  const { data, error } = await adminClient()
    .from("user_ai_spend_events")
    .select("id,status,estimated_cost_usd,actual_cost_usd,metadata")
    .eq("user_id", input.userId)
    .eq("provider", input.provider)
    .eq("external_request_id", input.externalRequestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data || null
}
