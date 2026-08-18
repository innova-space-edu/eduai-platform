import type { AICapability, AIProviderId } from "../capabilities"
import type { GatewayMessage } from "./google"

export type CompatibleProvider = Extract<AIProviderId, "groq" | "openrouter" | "together" | "cerebras">

export type CompatibleTextResult = {
  text: string
  provider: CompatibleProvider
  model: string
}

const ENDPOINTS: Record<CompatibleProvider, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  together: "https://api.together.xyz/v1/chat/completions",
  cerebras: "https://api.cerebras.ai/v1/chat/completions",
}

function apiKey(provider: CompatibleProvider): string | null {
  switch (provider) {
    case "groq":
      return process.env.GROQ_API_KEY || null
    case "openrouter":
      return process.env.OPENROUTER_API_KEY || null
    case "together":
      return process.env.TOGETHER_API_KEY || null
    case "cerebras":
      return process.env.CEREBRAS_API_KEY || null
  }
}

export function isCompatibleProviderId(provider: AIProviderId): provider is CompatibleProvider {
  return provider === "groq" || provider === "openrouter" || provider === "together" || provider === "cerebras"
}

export function hasCompatibleProvider(provider: AIProviderId): provider is CompatibleProvider {
  return isCompatibleProviderId(provider) && Boolean(apiKey(provider))
}

export function compatibleFallbackModel(
  provider: CompatibleProvider,
  capability: AICapability,
): string {
  switch (provider) {
    case "groq":
      if (capability === "research") {
        return process.env.GROQ_RESEARCH_MODEL || "groq/compound"
      }
      return process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile"
    case "openrouter":
      if (capability === "structured") {
        return process.env.OPENROUTER_STRUCTURED_MODEL || process.env.OPENROUTER_TEXT_MODEL || "openrouter/auto"
      }
      return process.env.OPENROUTER_TEXT_MODEL || "openrouter/auto"
    case "together":
      return process.env.TOGETHER_TEXT_MODEL || "Qwen/Qwen3.5-9B"
    case "cerebras":
      return process.env.CEREBRAS_TEXT_MODEL || "gpt-oss-120b"
  }
}

function openRouterProviderConfig() {
  const sort = process.env.OPENROUTER_PROVIDER_SORT?.trim() || "price"
  const allowDataCollection = process.env.OPENROUTER_ALLOW_DATA_COLLECTION === "true"
  const zdrOnly = process.env.OPENROUTER_ZDR_ONLY === "true"

  return {
    sort,
    data_collection: allowDataCollection ? "allow" : "deny",
    ...(zdrOnly ? { zdr: true } : {}),
  }
}

function headers(provider: CompatibleProvider, key: string): Record<string, string> {
  const common = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  }

  if (provider !== "openrouter") return common

  return {
    ...common,
    "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://eduaiplatformclon.vercel.app",
    "X-Title": process.env.OPENROUTER_APP_TITLE || "EduAI Platform",
  }
}

export async function generateCompatibleText(input: {
  provider: CompatibleProvider
  model: string
  messages: GatewayMessage[]
  maxOutputTokens?: number
  structuredSchema?: Record<string, unknown>
}): Promise<CompatibleTextResult> {
  const key = apiKey(input.provider)
  if (!key) throw new Error(`No hay API key configurada para ${input.provider}`)

  const messages = input.structuredSchema
    ? [
        {
          role: "system" as const,
          content:
            "Devuelve exclusivamente JSON válido, sin markdown ni texto adicional. " +
            `El resultado debe respetar este JSON Schema: ${JSON.stringify(input.structuredSchema)}`,
        },
        ...input.messages,
      ]
    : input.messages

  const body: Record<string, unknown> = {
    model: input.model,
    messages,
    max_tokens: input.maxOutputTokens ?? 4000,
  }

  if (input.provider === "openrouter") {
    body.provider = openRouterProviderConfig()
  }

  const timeoutMs = Number(process.env.EDUAI_AI_PROVIDER_TIMEOUT_MS || 60_000)
  const response = await fetch(ENDPOINTS[input.provider], {
    method: "POST",
    headers: headers(input.provider, key),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `${input.provider} error ${response.status}: ${detail.slice(0, 500) || response.statusText}`,
    )
  }

  const data = (await response.json()) as {
    model?: string
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const text = data.choices?.[0]?.message?.content?.trim() || ""
  if (!text) throw new Error(`${input.provider}: respuesta vacía`)

  return {
    text,
    provider: input.provider,
    model: data.model || input.model,
  }
}

export function parseStructuredJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/gi, "").trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const objectStart = cleaned.indexOf("{")
    const arrayStart = cleaned.indexOf("[")
    const startCandidates = [objectStart, arrayStart].filter((value) => value >= 0)
    const start = startCandidates.length ? Math.min(...startCandidates) : -1
    if (start < 0) throw new Error("El proveedor no devolvió JSON válido")

    const objectEnd = cleaned.lastIndexOf("}")
    const arrayEnd = cleaned.lastIndexOf("]")
    const end = Math.max(objectEnd, arrayEnd)
    if (end <= start) throw new Error("El proveedor no devolvió JSON válido")

    return JSON.parse(cleaned.slice(start, end + 1)) as T
  }
}
