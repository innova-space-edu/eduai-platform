export const OPENROUTER_FREE_MODEL = "openrouter/free"

export function paidTextFallbacksEnabled() {
  return process.env.EDUAI_AI_ALLOW_PAID_TEXT_FALLBACKS === "true"
}

export function isOpenRouterFreeModel(model: string) {
  return model === OPENROUTER_FREE_MODEL || model.endsWith(":free")
}

export function resolveOpenRouterTextModel(selected?: string | null) {
  const model = selected?.trim()
  return model && (paidTextFallbacksEnabled() || isOpenRouterFreeModel(model))
    ? model : OPENROUTER_FREE_MODEL
}

export function openRouterTextProviderOptions() {
  return {
    sort: process.env.OPENROUTER_PROVIDER_SORT?.trim() || "price",
    data_collection: process.env.OPENROUTER_ALLOW_DATA_COLLECTION === "true" ? "allow" : "deny",
    ...(process.env.OPENROUTER_ZDR_ONLY === "true" ? { zdr: true } : {}),
    ...(!paidTextFallbacksEnabled() ? { max_price: { prompt: 0, completion: 0 } } : {}),
  }
}

export function allowAutomaticTextProvider(provider: string) {
  return paidTextFallbacksEnabled() || !["together", "cerebras", "sambanova"].includes(provider)
}
