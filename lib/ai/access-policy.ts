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

function schemaUnavailable(error: unknown) {
  const value = error as { code?: string; message?: string } | null
  return value?.code === "42P01" || /does not exist|schema cache/i.test(value?.message || "")
}

/**
 * Lee el perfil de autorización. Usuarios preexistentes sin fila en
 * eduai_user_access permanecen operativos como legacy_standard durante la
 * migración progresiva; el panel de administración podrá pedirles completar
 * fecha de nacimiento posteriormente.
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

  if (error) {
    if (!schemaUnavailable(error)) console.warn("[AI Access] profile lookup failed:", error.message)
    return {
      userId,
      ageBand: "unknown",
      accountType: null,
      accessTier: "legacy_standard",
      hasExplicitAgeProfile: false,
    }
  }

  if (!data) {
    return {
      userId,
      ageBand: "unknown",
      accountType: null,
      accessTier: "legacy_standard",
      hasExplicitAgeProfile: false,
    }
  }

  return {
    userId,
    ageBand: data.age_band === "under_18" ? "under_18" : "adult",
    accountType: data.account_type || null,
    accessTier: (data.access_tier || "standard") as EduAIAccessTier,
    hasExplicitAgeProfile: true,
  }
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
