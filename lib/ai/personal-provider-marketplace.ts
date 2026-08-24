import type { PersonalAIProvider } from "@/lib/ai/personal-credentials"

export type PersonalProviderDescriptor = {
  id: PersonalAIProvider
  label: string
  shortLabel: string
  description: string
  recommended?: boolean
  beta?: boolean
  signupUrl: string
  keyUrl: string
  billingUrl: string
  docsUrl: string
  capabilities: Array<"text_to_video" | "image_to_video" | "image">
  billingOwner: "user"
}

export type MarketplaceModel = {
  provider: PersonalAIProvider
  id: string
  label: string
  description?: string | null
  category?: string | null
  thumbnailUrl?: string | null
  modelUrl?: string | null
  pricing?: {
    unitPrice: number
    unit: string
    currency: string
    estimatedCostUsd?: number | null
  } | null
  compatible: boolean
  compatibilityNote?: string | null
}

export const PERSONAL_AI_PROVIDERS: PersonalProviderDescriptor[] = [
  {
    id: "fal",
    label: "fal.ai",
    shortLabel: "fal",
    description: "Recomendado para video: gran catálogo, cola asíncrona y precios consultables antes de generar.",
    recommended: true,
    signupUrl: "https://fal.ai/",
    keyUrl: "https://fal.ai/dashboard/keys",
    billingUrl: "https://fal.ai/dashboard/billing",
    docsUrl: "https://fal.ai/docs/model-api-reference",
    capabilities: ["text_to_video", "image_to_video", "image"],
    billingOwner: "user",
  },
  {
    id: "huggingface",
    label: "Hugging Face Inference Providers",
    shortLabel: "Hugging Face",
    description: "Una cuenta puede rutear modelos hacia varios proveedores. Útil para comparar y centralizar consumo.",
    beta: true,
    signupUrl: "https://huggingface.co/join",
    keyUrl: "https://huggingface.co/settings/tokens",
    billingUrl: "https://huggingface.co/settings/billing",
    docsUrl: "https://huggingface.co/docs/inference-providers/en/tasks/text-to-video",
    capabilities: ["text_to_video", "image"],
    billingOwner: "user",
  },
  {
    id: "replicate",
    label: "Replicate",
    shortLabel: "Replicate",
    description: "Catálogo amplio de modelos oficiales con API estable y cobro directo en la cuenta del usuario.",
    signupUrl: "https://replicate.com/signin",
    keyUrl: "https://replicate.com/account/api-tokens",
    billingUrl: "https://replicate.com/account/billing",
    docsUrl: "https://replicate.com/docs/reference/http",
    capabilities: ["text_to_video", "image_to_video", "image"],
    billingOwner: "user",
  },
]

function compactError(value: unknown) {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim().slice(0, 260)
  if (value && typeof value === "object") {
    const anyValue = value as any
    return String(anyValue?.detail || anyValue?.message || anyValue?.error?.message || JSON.stringify(value)).replace(/\s+/g, " ").slice(0, 260)
  }
  return "Error desconocido"
}

export async function testPersonalProvider(provider: PersonalAIProvider, secret: string) {
  const startedAt = Date.now()
  if (provider === "fal") {
    const response = await fetch("https://api.fal.ai/v1/models?limit=1", {
      headers: { Authorization: `Key ${secret}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    })
    const payload = await response.json().catch(() => null)
    return {
      ok: response.ok,
      status: response.ok ? "healthy" as const : response.status === 401 || response.status === 403 ? "invalid" as const : "error" as const,
      message: response.ok ? "Conexión con fal.ai correcta" : compactError(payload) || `HTTP ${response.status}`,
      latencyMs: Date.now() - startedAt,
    }
  }

  if (provider === "huggingface") {
    const response = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    })
    const payload = await response.json().catch(() => null)
    return {
      ok: response.ok,
      status: response.ok ? "healthy" as const : response.status === 401 || response.status === 403 ? "invalid" as const : "error" as const,
      message: response.ok ? `Conexión Hugging Face correcta${payload?.name ? ` · ${payload.name}` : ""}` : compactError(payload) || `HTTP ${response.status}`,
      latencyMs: Date.now() - startedAt,
    }
  }

  const response = await fetch("https://api.replicate.com/v1/account", {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null)
  return {
    ok: response.ok,
    status: response.ok ? "healthy" as const : response.status === 401 || response.status === 403 ? "invalid" as const : "error" as const,
    message: response.ok ? `Conexión Replicate correcta${payload?.username ? ` · ${payload.username}` : ""}` : compactError(payload) || `HTTP ${response.status}`,
    latencyMs: Date.now() - startedAt,
  }
}

async function falPricing(secret: string, endpointIds: string[]) {
  if (!endpointIds.length) return new Map<string, { unitPrice: number; unit: string; currency: string }>()
  const params = new URLSearchParams()
  endpointIds.slice(0, 50).forEach(id => params.append("endpoint_id", id))
  const response = await fetch(`https://api.fal.ai/v1/models/pricing?${params.toString()}`, {
    headers: { Authorization: `Key ${secret}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null) as any
  const map = new Map<string, { unitPrice: number; unit: string; currency: string }>()
  if (!response.ok) return map
  for (const item of payload?.prices || []) {
    if (!item?.endpoint_id || !Number.isFinite(Number(item?.unit_price))) continue
    map.set(String(item.endpoint_id), {
      unitPrice: Number(item.unit_price),
      unit: String(item.unit || "unit"),
      currency: String(item.currency || "USD"),
    })
  }
  return map
}

function estimateFromUnit(unitPrice: number, unit: string, durationSeconds: number) {
  const normalized = unit.toLowerCase()
  if (/second|sec|video_second/.test(normalized)) return unitPrice * durationSeconds
  if (/video|generation|request|output/.test(normalized)) return unitPrice
  return null
}

export async function estimateFalVideoCost(secret: string, endpointId: string, durationSeconds: number) {
  const pricing = await falPricing(secret, [endpointId])
  const price = pricing.get(endpointId)
  if (!price) return null
  return {
    ...price,
    estimatedCostUsd: estimateFromUnit(price.unitPrice, price.unit, durationSeconds),
  }
}

async function listFalCategory(secret: string, category: string, limit: number) {
  const params = new URLSearchParams({ category, status: "active", limit: String(limit) })
  const response = await fetch(`https://api.fal.ai/v1/models?${params.toString()}`, {
    headers: { Authorization: `Key ${secret}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null) as any
  if (!response.ok) throw new Error(compactError(payload) || `fal HTTP ${response.status}`)
  return Array.isArray(payload?.models) ? payload.models : []
}

export async function getFalModelSchema(secret: string, endpointId: string) {
  const params = new URLSearchParams()
  params.append("endpoint_id", endpointId)
  params.set("expand", "openapi-3.0")
  const response = await fetch(`https://api.fal.ai/v1/models?${params.toString()}`, {
    headers: { Authorization: `Key ${secret}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null) as any
  if (!response.ok) throw new Error(compactError(payload) || `fal HTTP ${response.status}`)
  return Array.isArray(payload?.models) ? payload.models[0] || null : null
}

export async function listFalVideoModels(secret: string, durationSeconds = 5, limit = 18): Promise<MarketplaceModel[]> {
  const [textModels, imageModels] = await Promise.all([
    listFalCategory(secret, "text-to-video", limit),
    listFalCategory(secret, "image-to-video", limit),
  ])
  const unique = new Map<string, any>()
  for (const item of [...textModels, ...imageModels]) {
    if (item?.endpoint_id) unique.set(String(item.endpoint_id), item)
  }
  const models = Array.from(unique.values()).slice(0, Math.max(limit, 20))
  const pricing = await falPricing(secret, models.map(item => String(item.endpoint_id)))
  return models.map(item => {
    const endpointId = String(item.endpoint_id)
    const price = pricing.get(endpointId)
    return {
      provider: "fal" as const,
      id: endpointId,
      label: item?.metadata?.display_name || endpointId,
      description: item?.metadata?.description || null,
      category: item?.metadata?.category || null,
      thumbnailUrl: item?.metadata?.thumbnail_url || null,
      modelUrl: item?.metadata?.model_url || `https://fal.ai/models/${endpointId}`,
      pricing: price ? {
        ...price,
        estimatedCostUsd: estimateFromUnit(price.unitPrice, price.unit, durationSeconds),
      } : null,
      compatible: true,
      compatibilityNote: "EduAI usa la cola asíncrona de fal y conserva el MP4 en Recursos IA.",
    }
  })
}

export async function listHuggingFaceVideoModels(limit = 24): Promise<MarketplaceModel[]> {
  const url = new URL("https://huggingface.co/api/models")
  url.searchParams.set("inference_provider", "all")
  url.searchParams.set("pipeline_tag", "text-to-video")
  url.searchParams.set("sort", "trending_score")
  url.searchParams.set("limit", String(limit))
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: "no-store" })
  const payload = await response.json().catch(() => null) as any
  if (!response.ok || !Array.isArray(payload)) throw new Error(compactError(payload) || `HF HTTP ${response.status}`)
  return payload.map(item => ({
    provider: "huggingface" as const,
    id: String(item.id),
    label: String(item.id).split("/").pop() || String(item.id),
    description: item?.cardData?.model_name || item?.pipeline_tag || null,
    category: "text-to-video",
    thumbnailUrl: null,
    modelUrl: `https://huggingface.co/${item.id}`,
    pricing: null,
    compatible: false,
    compatibilityNote: "Catálogo disponible. Generación directa queda en beta hasta validar un flujo asíncrono confiable para Vercel.",
  }))
}

export async function getReplicateModel(secret: string, modelId: string) {
  const [owner, name] = modelId.split("/")
  if (!owner || !name) throw new Error("Modelo Replicate inválido")
  const response = await fetch(`https://api.replicate.com/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null) as any
  if (!response.ok) throw new Error(compactError(payload) || `Replicate HTTP ${response.status}`)
  return payload
}

export async function listReplicateVideoModels(secret: string, limit = 20): Promise<MarketplaceModel[]> {
  const url = new URL("https://api.replicate.com/v1/search")
  url.searchParams.set("query", "video generation text to video image to video")
  url.searchParams.set("limit", String(Math.min(50, limit)))
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null) as any
  if (!response.ok) throw new Error(compactError(payload) || `Replicate HTTP ${response.status}`)
  const rows = Array.isArray(payload?.results) ? payload.results : []
  return rows
    .filter((item: any) => item?.owner && item?.name)
    .slice(0, limit)
    .map((item: any) => ({
      provider: "replicate" as const,
      id: `${item.owner}/${item.name}`,
      label: item?.name || `${item.owner}/${item.name}`,
      description: item?.description || item?.metadata?.generated_description || null,
      category: "video",
      thumbnailUrl: item?.cover_image_url || null,
      modelUrl: item?.url || `https://replicate.com/${item.owner}/${item.name}`,
      pricing: null,
      compatible: true,
      compatibilityNote: "EduAI usa la API asíncrona de predicciones; el precio final lo cobra Replicate a tu cuenta.",
    }))
}
