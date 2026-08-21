import type { SupabaseClient } from "@supabase/supabase-js"
import type { AICapability, AIProviderId } from "./capabilities"

type ProviderModelRow = {
  model: string
  label: string | null
  capabilities: string[] | null
  is_enabled: boolean
  is_default: boolean
  priority: number | null
  config: Record<string, unknown> | null
  deprecated_at: string | null
  shutdown_at: string | null
}

export type ResolvedProviderModel = {
  provider: AIProviderId
  capability: AICapability
  model: string
  label?: string | null
  config: Record<string, unknown>
  source: "registry" | "fallback"
}

type CacheEntry = {
  value: ResolvedProviderModel
  expiresAt: number
}

const CACHE_TTL_MS = 60_000
const registryCache = new Map<string, CacheEntry>()

function cacheKey(provider: AIProviderId, capability: AICapability) {
  return `${provider}:${capability}`
}

function activeAt(row: ProviderModelRow, now = Date.now()) {
  if (!row.is_enabled) return false
  if (!row.shutdown_at) return true
  const shutdown = new Date(row.shutdown_at).getTime()
  return !Number.isFinite(shutdown) || shutdown > now
}

function sortRows(a: ProviderModelRow, b: ProviderModelRow) {
  if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
  return (a.priority ?? 100) - (b.priority ?? 100)
}

export async function resolveProviderModel(input: {
  supabase?: SupabaseClient | null
  provider: AIProviderId
  capability: AICapability
  fallbackModel: string
}): Promise<ResolvedProviderModel> {
  const fallback: ResolvedProviderModel = {
    provider: input.provider,
    capability: input.capability,
    model: input.fallbackModel,
    config: {},
    source: "fallback",
  }

  if (!input.supabase) return fallback

  const key = cacheKey(input.provider, input.capability)
  const cached = registryCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  try {
    const { data, error } = await input.supabase
      .from("ai_provider_models")
      .select("model,label,capabilities,is_enabled,is_default,priority,config,deprecated_at,shutdown_at")
      .eq("provider", input.provider)
      .eq("is_enabled", true)
      .contains("capabilities", [input.capability])
      .order("is_default", { ascending: false })
      .order("priority", { ascending: true })
      .limit(12)

    if (error) {
      if (error.code !== "42P01") console.warn("[AI model registry]", error.message)
      return fallback
    }

    const rows = ((data || []) as ProviderModelRow[])
      .filter((row) => activeAt(row))
      .sort(sortRows)

    const selected = rows[0]
    if (!selected?.model) return fallback

    const value: ResolvedProviderModel = {
      provider: input.provider,
      capability: input.capability,
      model: selected.model,
      label: selected.label,
      config: selected.config || {},
      source: "registry",
    }

    registryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
    return value
  } catch (error) {
    console.warn("[AI model registry] fallback", error instanceof Error ? error.message : String(error))
    return fallback
  }
}

export function clearProviderModelCache(provider?: AIProviderId, capability?: AICapability) {
  if (!provider && !capability) {
    registryCache.clear()
    return
  }

  for (const key of registryCache.keys()) {
    const [cachedProvider, cachedCapability] = key.split(":")
    if (provider && cachedProvider !== provider) continue
    if (capability && cachedCapability !== capability) continue
    registryCache.delete(key)
  }
}
