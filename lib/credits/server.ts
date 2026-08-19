import "server-only"

import { createClient as createAdminClient } from "@supabase/supabase-js"

export type BillingSettings = {
  creditsPerClp: number
  usdToClp: number
  markupMultiplier: number
  minGenerationCredits: number
  paymentsEnabled: boolean
  premiumVideoEnabled: boolean
}

export type WalletSnapshot = {
  balanceCredits: number
  reservedCredits: number
  availableCredits: number
  lifetimePurchasedCredits: number
  lifetimeSpentCredits: number
}

export function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas.")
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getBillingSettings(): Promise<BillingSettings> {
  const admin = getAdminSupabase()
  const { data, error } = await admin
    .from("ai_billing_settings")
    .select("credits_per_clp,usd_to_clp,markup_multiplier,min_generation_credits,payments_enabled,premium_video_enabled")
    .eq("id", 1)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer la configuración de créditos: ${error.message}`)

  return {
    creditsPerClp: Number(data?.credits_per_clp ?? 1),
    usdToClp: Number(data?.usd_to_clp ?? 1000),
    markupMultiplier: Number(data?.markup_multiplier ?? 1.3),
    minGenerationCredits: Number(data?.min_generation_credits ?? 100),
    paymentsEnabled: data?.payments_enabled !== false,
    premiumVideoEnabled: data?.premium_video_enabled !== false,
  }
}

export async function ensureWallet(userId: string): Promise<WalletSnapshot> {
  const admin = getAdminSupabase()
  const { error: insertError } = await admin
    .from("ai_wallets")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
  if (insertError) throw new Error(`No se pudo inicializar la billetera: ${insertError.message}`)

  const { data, error } = await admin
    .from("ai_wallets")
    .select("balance_credits,reserved_credits,lifetime_purchased_credits,lifetime_spent_credits")
    .eq("user_id", userId)
    .single()
  if (error) throw new Error(`No se pudo leer la billetera: ${error.message}`)

  const balanceCredits = Number(data.balance_credits ?? 0)
  const reservedCredits = Number(data.reserved_credits ?? 0)
  return {
    balanceCredits,
    reservedCredits,
    availableCredits: balanceCredits - reservedCredits,
    lifetimePurchasedCredits: Number(data.lifetime_purchased_credits ?? 0),
    lifetimeSpentCredits: Number(data.lifetime_spent_credits ?? 0),
  }
}

export async function usdToEduaiCredits(usd: number): Promise<number> {
  const settings = await getBillingSettings()
  const raw = usd * settings.usdToClp * settings.markupMultiplier * settings.creditsPerClp
  return Math.max(settings.minGenerationCredits, Math.ceil(raw))
}

function mercadoPagoAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado.")
  return token
}

export async function mercadoPagoRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT"
    body?: unknown
    idempotencyKey?: string
  } = {}
): Promise<T> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken()}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.message || payload?.error || `Mercado Pago respondió HTTP ${response.status}`
    const error = new Error(String(message)) as Error & { status?: number; payload?: unknown }
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload as T
}

export async function captureVideoCredits(jobId: string) {
  const admin = getAdminSupabase()
  const { data, error } = await admin.rpc("eduai_capture_generation_credits", {
    p_job_id: jobId,
    p_final_credits: null,
  })
  if (error) throw new Error(`No se pudo confirmar el consumo de créditos: ${error.message}`)
  return Number(data ?? 0)
}

export async function releaseVideoCredits(jobId: string, reason: string) {
  const admin = getAdminSupabase()
  const { data, error } = await admin.rpc("eduai_release_generation_credits", {
    p_job_id: jobId,
    p_reason: reason,
  })
  if (error) throw new Error(`No se pudo liberar la reserva de créditos: ${error.message}`)
  return Number(data ?? 0)
}
