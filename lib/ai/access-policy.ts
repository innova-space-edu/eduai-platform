import type { SupabaseClient } from "@supabase/supabase-js"
import type { AICapability, AIProviderId } from "./capabilities"

export type EduAIAccessTier = "restricted" | "standard" | "teacher" | "researcher" | "admin" | "legacy_standard"

export type EduAIAccessProfile = {
  userId: string
  ageBand: "under_18" | "adult" | "unknown"
  accountType: string | null
  accessTier: EduAIAccessTier
  hasExplicitAgeProfile: boolean
}

export type CapabilityDecision = {
  allowed: boolean
  cloudAllowed: boolean
  localAllowed: boolean
  reason?: string
}

const LOCAL_SAFE_CAPABILITIES = new Set<AICapability>([
  "text",
  "structured",
  "embeddings",
  "code",
])

const ACCOUNT_TYPES = new Set([
  "teacher",
  "university_student",
  "researcher",
  "professional",
  "other",
])

function schemaUnavailable(error: unknown) {
  const value = error as { code?: string; message?: string } | null
  return value?.code === "42P01" || /does not exist|schema cache/i.test(value?.message || "")
}

function parseBirthDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null
  if (parsed.getUTCFullYear() < 1900 || parsed.getTime() > Date.now()) return null
  return parsed
}

function isUnder18(birthDate: Date) {
  const now = new Date()
  const threshold = new Date(Date.UTC(
    now.getUTCFullYear() - 18,
    now.getUTCMonth(),
    now.getUTCDate(),
  ))
  return birthDate.getTime() > threshold.getTime()
}

export function deriveAccessProfileFromMetadata(input: {
  userId: string
  metadata?: Record<string, unknown> | null
}): EduAIAccessProfile | null {
  const birthDate = parseBirthDate(input.metadata?.birth_date)
  if (!birthDate) return null

  const rawAccountType = typeof input.metadata?.account_type === "string"
    ? input.metadata.account_type
    : "other"
  const accountType = ACCOUNT_TYPES.has(rawAccountType) ? rawAccountType : "other"
  const restricted = isUnder18(birthDate)

  return {
    userId: input.userId,
    ageBand: restricted ? "under_18" : "adult",
    accountType,
    // Los roles privilegiados nunca se elevan desde metadata controlada por el cliente.
    accessTier: restricted ? "restricted" : "standard",
    hasExplicitAgeProfile: true,
  }
}

async function deriveCurrentAuthProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ profile: EduAIAccessProfile; metadata: Record<string, unknown> } | null> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user || data.user.id !== userId) return null
    const metadata = (data.user.user_metadata || {}) as Record<string, unknown>
    const profile = deriveAccessProfileFromMetadata({ userId, metadata })
    return profile ? { profile, metadata } : null
  } catch {
    return null
  }
}

async function persistDerivedProfile(input: {
  supabase: SupabaseClient
  profile: EduAIAccessProfile
  metadata: Record<string, unknown>
}) {
  const birthDate = typeof input.metadata.birth_date === "string" ? input.metadata.birth_date : null
  if (!birthDate) return

  const acceptedTerms = input.metadata.terms_accepted === true || input.metadata.terms_accepted === "true"
  const acceptedPrivacy = input.metadata.privacy_accepted === true || input.metadata.privacy_accepted === "true"
  const now = new Date().toISOString()

  const { error } = await input.supabase.from("eduai_user_access").insert({
    user_id: input.profile.userId,
    birth_date: birthDate,
    age_band: input.profile.ageBand,
    account_type: input.profile.accountType || "other",
    access_tier: input.profile.accessTier,
    country_code: typeof input.metadata.country_code === "string" ? input.metadata.country_code : null,
    age_self_declared: true,
    terms_version: typeof input.metadata.terms_version === "string" ? input.metadata.terms_version : null,
    terms_accepted_at: acceptedTerms ? now : null,
    privacy_version: typeof input.metadata.privacy_version === "string" ? input.metadata.privacy_version : null,
    privacy_accepted_at: acceptedPrivacy ? now : null,
  })

  if (error && error.code !== "23505") {
    console.warn("[AI Access] derived profile persistence failed:", error.message)
  }
}

function legacyProfile(userId: string): EduAIAccessProfile {
  return {
    userId,
    ageBand: "unknown",
    accountType: null,
    accessTier: "legacy_standard",
    hasExplicitAgeProfile: false,
  }
}

/**
 * Lee el perfil de autorización desde eduai_user_access.
 *
 * Defensa en profundidad: si la fila todavía no existe (por ejemplo, una
 * confirmación de email posterior al signUp), deriva el tramo desde metadata
 * de la sesión Auth en el mismo request. Así una cuenta under_18 nunca se
 * convierte temporalmente en legacy_standard por una carrera de provisión.
 * Las cuentas históricas sin birth_date conservan legacy_standard durante la
 * migración progresiva.
 */
export async function getEduAIAccessProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<EduAIAccessProfile> {
  const { data, error } = await supabase
    .from("eduai_user_access")
    .select("user_id,age_band,account_type,access_tier")
    .eq("user_id", userId)
    .maybeSingle()

  if (!error && data) {
    return {
      userId,
      ageBand: data.age_band === "under_18" ? "under_18" : "adult",
      accountType: data.account_type || null,
      accessTier: (data.access_tier || "standard") as EduAIAccessTier,
      hasExplicitAgeProfile: true,
    }
  }

  if (error && !schemaUnavailable(error)) {
    console.warn("[AI Access] profile lookup failed:", error.message)
  }

  const derived = await deriveCurrentAuthProfile(supabase, userId)
  if (derived) {
    // Persistencia best-effort. La decisión de seguridad de este request no
    // depende de que el INSERT termine correctamente.
    if (!error) await persistDerivedProfile({ supabase, ...derived })
    return derived.profile
  }

  return legacyProfile(userId)
}

export function decideCapability(
  profile: EduAIAccessProfile,
  capability: AICapability,
  provider?: AIProviderId | null
): CapabilityDecision {
  if (profile.accessTier !== "restricted" && profile.ageBand !== "under_18") {
    return { allowed: true, cloudAllowed: true, localAllowed: true }
  }

  const localAllowed = LOCAL_SAFE_CAPABILITIES.has(capability)
  const providerIsLocal = provider === "local"

  if (providerIsLocal && localAllowed) {
    return { allowed: true, cloudAllowed: false, localAllowed: true }
  }

  return {
    allowed: false,
    cloudAllowed: false,
    localAllowed,
    reason:
      "Esta cuenta tiene acceso restringido. Las capacidades generativas en la nube están deshabilitadas para este perfil.",
  }
}

export async function assertAICapabilityAllowed(input: {
  supabase: SupabaseClient
  userId: string
  capability: AICapability
  provider?: AIProviderId | null
}): Promise<EduAIAccessProfile> {
  const profile = await getEduAIAccessProfile(input.supabase, input.userId)
  const decision = decideCapability(profile, input.capability, input.provider)

  if (!decision.allowed) {
    const error = new Error(decision.reason || "Capacidad de IA no autorizada") as Error & { code?: string; status?: number }
    error.code = "EDUAI_ACCESS_RESTRICTED"
    error.status = 403
    throw error
  }

  return profile
}
