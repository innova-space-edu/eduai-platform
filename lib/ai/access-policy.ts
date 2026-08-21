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

const ACCESS_TIERS = new Set<EduAIAccessTier>([
  "restricted",
  "standard",
  "teacher",
  "researcher",
  "admin",
  "legacy_standard",
])

function schemaUnavailable(error: unknown) {
  const value = error as { code?: string; message?: string } | null
  return value?.code === "42P01" || /does not exist|schema cache/i.test(value?.message || "")
}

function parseBirthDate(value: unknown, now = new Date()): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null
  if (parsed.getUTCFullYear() < 1900 || parsed.getTime() > now.getTime()) return null
  return parsed
}

function isUnder18(birthDate: Date, now = new Date()) {
  const threshold = new Date(Date.UTC(
    now.getUTCFullYear() - 18,
    now.getUTCMonth(),
    now.getUTCDate(),
  ))
  return birthDate.getTime() > threshold.getTime()
}

export function deriveEffectiveStoredAccessProfile(input: {
  userId: string
  birthDate: unknown
  ageBand: unknown
  accountType: unknown
  accessTier: unknown
  now?: Date
}): EduAIAccessProfile {
  const now = input.now || new Date()
  const birthDate = parseBirthDate(input.birthDate, now)
  const storedAgeBand = input.ageBand === "under_18" ? "under_18" : "adult"
  const storedTier = typeof input.accessTier === "string" && ACCESS_TIERS.has(input.accessTier as EduAIAccessTier)
    ? input.accessTier as EduAIAccessTier
    : "standard"
  const accountType = typeof input.accountType === "string" ? input.accountType : null

  if (!birthDate) {
    return {
      userId: input.userId,
      ageBand: storedAgeBand,
      accountType,
      accessTier: storedAgeBand === "under_18" ? "restricted" : storedTier,
      hasExplicitAgeProfile: true,
    }
  }

  const restrictedByCurrentAge = isUnder18(birthDate, now)
  if (restrictedByCurrentAge) {
    return {
      userId: input.userId,
      ageBand: "under_18",
      accountType,
      accessTier: "restricted",
      hasExplicitAgeProfile: true,
    }
  }

  // El paso del tiempo no dispara triggers en Postgres. Si la cuenta fue
  // guardada como menor/restricted y ya cumplió 18, promovemos el acceso
  // efectivo a standard en el request. No elevamos roles privilegiados y no
  // anulamos una restricción adulta futura que tenga age_band='adult'.
  const agedOutOfMinorRestriction = storedAgeBand === "under_18" && storedTier === "restricted"

  return {
    userId: input.userId,
    ageBand: "adult",
    accountType,
    accessTier: agedOutOfMinorRestriction ? "standard" : storedTier,
    hasExplicitAgeProfile: true,
  }
}

/**
 * Normaliza metadata declarada por el usuario para flujos de provisión/UI.
 * No debe usarse como fuente de autorización: user_metadata es editable por
 * el usuario. Las decisiones de acceso leen exclusivamente eduai_user_access.
 */
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

export function unresolvedAccessProfile(userId: string): EduAIAccessProfile {
  return {
    userId,
    ageBand: "unknown",
    accountType: null,
    accessTier: "restricted",
    hasExplicitAgeProfile: false,
  }
}

/**
 * Lee el perfil de autorización exclusivamente desde eduai_user_access.
 *
 * Si la fila todavía no existe, la decisión falla cerrada: la cuenta queda en
 * tramo unknown/restricted hasta que el trigger de Auth o el onboarding cree
 * su perfil. No se autoriza desde user_metadata porque es editable por el
 * cliente. Esto también impide que una llamada directa a la API evite el
 * onboarding de cuentas legacy.
 *
 * La edad efectiva se recalcula desde birth_date en cada lectura para que una
 * cuenta no permanezca restricted después de cumplir 18 solo porque Postgres
 * no recibió un UPDATE el día de su cumpleaños.
 */
export async function getEduAIAccessProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<EduAIAccessProfile> {
  const { data, error } = await supabase
    .from("eduai_user_access")
    .select("user_id,birth_date,age_band,account_type,access_tier")
    .eq("user_id", userId)
    .maybeSingle()

  if (!error && data) {
    return deriveEffectiveStoredAccessProfile({
      userId,
      birthDate: data.birth_date,
      ageBand: data.age_band,
      accountType: data.account_type,
      accessTier: data.access_tier,
    })
  }

  if (error && !schemaUnavailable(error)) {
    console.warn("[AI Access] profile lookup failed:", error.message)
  }

  return unresolvedAccessProfile(userId)
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
      profile.hasExplicitAgeProfile
        ? "Esta cuenta tiene acceso restringido. Las capacidades generativas en la nube están deshabilitadas para este perfil."
        : "Completa tu perfil de acceso y edad para habilitar las capacidades de IA disponibles.",
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
