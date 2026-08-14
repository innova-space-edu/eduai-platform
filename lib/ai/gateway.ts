import type { SupabaseClient } from "@supabase/supabase-js"
import { callAI as callLegacyAI } from "@/lib/ai-router-v4"
import {
  envNameForCapability,
  providerOrderFor,
  type AICapability,
  type AIProviderId,
  type AIRequestContext,
} from "./capabilities"
import { generationFingerprint } from "./fingerprint"
import {
  findReusableGeneration,
  finishGenerationRequest,
  recordGenerationStart,
  saveReusableGeneration,
} from "./reuse"
import {
  generateGoogleImage,
  generateGoogleStructured,
  generateGoogleText,
  hasGoogleAI,
  streamGoogleText,
  type GatewayMessage,
} from "./providers/google"

export type { GatewayMessage }

export type GatewayResult<T = string> = {
  data: T
  text?: string
  provider: string
  model: string
  capability: AICapability
  fingerprint: string
  reused: boolean
  cacheId?: string | null
  latencyMs: number
}

function legacyPreference(provider: AIProviderId): "groq" | "openrouter" | undefined {
  if (provider === "groq") return "groq"
  if (provider === "openrouter") return "openrouter"
  return undefined
}

function providerOrder(capability: AICapability, preferred?: AIProviderId | null): AIProviderId[] {
  if (preferred) return [preferred]
  const envName = envNameForCapability(capability)
  return providerOrderFor(capability, process.env[envName])
}

async function lookupReuse(input: {
  supabase?: SupabaseClient | null
  context?: AIRequestContext
  capability: AICapability
  fingerprint: string
}) {
  if (!input.supabase || !input.context?.userId) return null
  return findReusableGeneration({
    supabase: input.supabase,
    userId: input.context.userId,
    fingerprint: input.fingerprint,
    capability: input.capability,
    reusePolicy: input.context.reusePolicy,
  })
}

export async function runAIText(input: {
  messages: GatewayMessage[]
  capability?: Extract<AICapability, "text" | "code" | "vision" | "long_context" | "research">
  maxOutputTokens?: number
  preferredProvider?: AIProviderId | null
  lite?: boolean
  context?: AIRequestContext
  supabase?: SupabaseClient | null
}): Promise<GatewayResult<string>> {
  const startedAt = Date.now()
  const capability = input.capability || "text"
  const fingerprint = generationFingerprint({
    capability,
    payload: {
      messages: input.messages,
      maxOutputTokens: input.maxOutputTokens ?? null,
      lite: Boolean(input.lite),
      preferredProvider: input.preferredProvider ?? null,
    },
    scopeKey: input.context?.workspaceId || input.context?.userId || null,
  })

  const reusable = await lookupReuse({
    supabase: input.supabase,
    context: input.context,
    capability,
    fingerprint,
  })

  if (reusable && typeof reusable.result.text === "string") {
    const requestId = input.supabase && input.context?.userId
      ? await recordGenerationStart({
          supabase: input.supabase,
          userId: input.context.userId,
          capability,
          fingerprint,
          module: input.context.module,
          provider: reusable.provider,
          model: reusable.model,
          reusePolicy: input.context.reusePolicy,
          workspaceId: input.context.workspaceId,
          requestJson: { reusedCacheId: reusable.id },
        })
      : null

    if (input.supabase) {
      await finishGenerationRequest({
        supabase: input.supabase,
        requestId,
        status: "reused",
        provider: reusable.provider,
        model: reusable.model,
        assetId: reusable.assetId,
        latencyMs: Date.now() - startedAt,
        metadata: { cacheId: reusable.id, generationAvoided: true },
      })
    }

    return {
      data: reusable.result.text,
      text: reusable.result.text,
      provider: reusable.provider || "cache",
      model: reusable.model || "cached",
      capability,
      fingerprint,
      reused: true,
      cacheId: reusable.id,
      latencyMs: Date.now() - startedAt,
    }
  }

  let requestId: string | null = null
  if (input.supabase && input.context?.userId) {
    requestId = await recordGenerationStart({
      supabase: input.supabase,
      userId: input.context.userId,
      capability,
      fingerprint,
      module: input.context.module,
      reusePolicy: input.context.reusePolicy,
      workspaceId: input.context.workspaceId,
      requestJson: { messages: input.messages, maxOutputTokens: input.maxOutputTokens ?? null },
    })
  }

  const errors: string[] = []
  for (const provider of providerOrder(capability, input.preferredProvider)) {
    try {
      let result: { text: string; provider: string; model: string }

      if (provider === "google" && hasGoogleAI("text")) {
        result = await generateGoogleText({
          messages: input.messages,
          maxOutputTokens: input.maxOutputTokens,
          lite: input.lite,
        })
      } else if (provider === "groq" || provider === "openrouter") {
        result = await callLegacyAI(input.messages, {
          maxTokens: input.maxOutputTokens,
          preferProvider: legacyPreference(provider),
        })
      } else {
        continue
      }

      if (input.supabase && input.context?.userId) {
        await saveReusableGeneration({
          supabase: input.supabase,
          userId: input.context.userId,
          capability,
          fingerprint,
          provider: result.provider,
          model: result.model,
          result: { text: result.text },
          reusePolicy: input.context.reusePolicy,
          visibility: input.context.visibility,
          workspaceId: input.context.workspaceId,
        })
        await finishGenerationRequest({
          supabase: input.supabase,
          requestId,
          status: "completed",
          provider: result.provider,
          model: result.model,
          latencyMs: Date.now() - startedAt,
        })
      }

      return {
        data: result.text,
        text: result.text,
        provider: result.provider,
        model: result.model,
        capability,
        fingerprint,
        reused: false,
        latencyMs: Date.now() - startedAt,
      }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (input.supabase) {
    await finishGenerationRequest({
      supabase: input.supabase,
      requestId,
      status: "failed",
      error: errors.join(" | ").slice(0, 2000),
      latencyMs: Date.now() - startedAt,
    })
  }

  throw new Error(`EduAI AI Gateway: todos los proveedores fallaron. ${errors.join(" | ")}`)
}

export async function runAIStructured<T = Record<string, unknown>>(input: {
  messages: GatewayMessage[]
  schema: Record<string, unknown>
  maxOutputTokens?: number
  preferredProvider?: AIProviderId | null
  lite?: boolean
  context?: AIRequestContext
  supabase?: SupabaseClient | null
}): Promise<GatewayResult<T>> {
  const startedAt = Date.now()
  const capability: AICapability = "structured"
  const fingerprint = generationFingerprint({
    capability,
    payload: {
      messages: input.messages,
      schema: input.schema,
      maxOutputTokens: input.maxOutputTokens ?? null,
      lite: Boolean(input.lite),
      preferredProvider: input.preferredProvider ?? null,
    },
    scopeKey: input.context?.workspaceId || input.context?.userId || null,
  })

  const reusable = await lookupReuse({
    supabase: input.supabase,
    context: input.context,
    capability,
    fingerprint,
  })

  if (reusable?.result.data !== undefined) {
    return {
      data: reusable.result.data as T,
      text: typeof reusable.result.text === "string" ? reusable.result.text : undefined,
      provider: reusable.provider || "cache",
      model: reusable.model || "cached",
      capability,
      fingerprint,
      reused: true,
      cacheId: reusable.id,
      latencyMs: Date.now() - startedAt,
    }
  }

  const order = providerOrder(capability, input.preferredProvider)
  const errors: string[] = []

  for (const provider of order) {
    try {
      let result: { text: string; data: T; provider: string; model: string }

      if (provider === "google" && hasGoogleAI("text")) {
        result = await generateGoogleStructured<T>({
          messages: input.messages,
          schema: input.schema,
          maxOutputTokens: input.maxOutputTokens,
          lite: input.lite,
        })
      } else if (provider === "groq" || provider === "openrouter") {
        const fallback = await callLegacyAI(input.messages, {
          maxTokens: input.maxOutputTokens,
          preferProvider: legacyPreference(provider),
        })
        const cleaned = fallback.text.replace(/```json|```/g, "").trim()
        result = {
          text: cleaned,
          data: JSON.parse(cleaned) as T,
          provider: fallback.provider,
          model: fallback.model,
        }
      } else {
        continue
      }

      if (input.supabase && input.context?.userId) {
        await saveReusableGeneration({
          supabase: input.supabase,
          userId: input.context.userId,
          capability,
          fingerprint,
          provider: result.provider,
          model: result.model,
          result: { text: result.text, data: result.data as unknown as Record<string, unknown> },
          reusePolicy: input.context.reusePolicy,
          visibility: input.context.visibility,
          workspaceId: input.context.workspaceId,
        })
      }

      return {
        data: result.data,
        text: result.text,
        provider: result.provider,
        model: result.model,
        capability,
        fingerprint,
        reused: false,
        latencyMs: Date.now() - startedAt,
      }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(`EduAI Structured Gateway: todos los proveedores fallaron. ${errors.join(" | ")}`)
}

export async function streamAIText(input: {
  messages: GatewayMessage[]
  maxOutputTokens?: number
  lite?: boolean
  preferredProvider?: AIProviderId | null
}): Promise<ReadableStream<Uint8Array>> {
  const first = providerOrder("text", input.preferredProvider)[0]
  if (first === "google" && hasGoogleAI("text")) {
    return streamGoogleText({
      messages: input.messages,
      maxOutputTokens: input.maxOutputTokens,
      lite: input.lite,
    })
  }

  const fallback = await callLegacyAI(input.messages, {
    maxTokens: input.maxOutputTokens,
    preferProvider: legacyPreference(first),
  })
  const encoded = new TextEncoder().encode(fallback.text)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
  })
}

export async function runGoogleImage(input: {
  prompt: string
  aspectRatio?: string
  imageSize?: "0.5K" | "1K" | "2K" | "4K"
  previousInteractionId?: string | null
}) {
  return generateGoogleImage(input)
}
