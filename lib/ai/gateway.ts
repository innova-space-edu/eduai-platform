import type { SupabaseClient } from "@supabase/supabase-js"
import {
  envNameForCapability,
  providerOrderFor,
  type AICapability,
  type AIProviderId,
  type AIRequestContext,
} from "./capabilities"
import { assertAICapabilityAllowed } from "./access-policy"
import { generationFingerprint } from "./fingerprint"
import { resolveProviderModel } from "./model-registry"
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
  googleModel,
  hasGoogleAI,
  streamGoogleText,
  type GatewayMessage,
} from "./providers/google"
import {
  compatibleFallbackModel,
  generateCompatibleText,
  hasCompatibleProvider,
  isCompatibleProviderId,
  parseStructuredJson,
} from "./providers/openai-compatible"

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

function providerOrder(capability: AICapability, preferred?: AIProviderId | null): AIProviderId[] {
  if (preferred) return [preferred]
  const envName = envNameForCapability(capability)
  return providerOrderFor(capability, process.env[envName])
}

async function assertAccess(input: {
  supabase?: SupabaseClient | null
  context?: AIRequestContext
  capability: AICapability
  provider?: AIProviderId | null
}) {
  if (!input.supabase || !input.context?.userId) return
  await assertAICapabilityAllowed({
    supabase: input.supabase,
    userId: input.context.userId,
    capability: input.capability,
    provider: input.provider,
  })
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

async function providerRuntimeModel(input: {
  supabase?: SupabaseClient | null
  provider: AIProviderId
  capability: AICapability
  lite?: boolean
  kind?: "text" | "image"
}) {
  let fallbackModel: string | null = null

  if (input.provider === "google") {
    fallbackModel = input.kind === "image"
      ? googleModel("image")
      : googleModel(input.lite ? "lite" : "text")
  } else if (isCompatibleProviderId(input.provider)) {
    fallbackModel = compatibleFallbackModel(input.provider, input.capability)
  }

  if (!fallbackModel) return null

  return resolveProviderModel({
    supabase: input.supabase,
    provider: input.provider,
    capability: input.capability,
    fallbackModel,
  })
}

async function executeTextProvider(input: {
  provider: AIProviderId
  capability: AICapability
  messages: GatewayMessage[]
  maxOutputTokens?: number
  lite?: boolean
  supabase?: SupabaseClient | null
}): Promise<{ text: string; provider: string; model: string } | null> {
  if (input.provider === "google") {
    if (!hasGoogleAI("text")) return null
    const selected = await providerRuntimeModel({
      supabase: input.supabase,
      provider: "google",
      capability: input.capability,
      lite: input.lite,
    })
    if (!selected) return null
    return generateGoogleText({
      messages: input.messages,
      maxOutputTokens: input.maxOutputTokens,
      lite: input.lite,
      model: selected.model,
    })
  }

  if (hasCompatibleProvider(input.provider)) {
    const selected = await providerRuntimeModel({
      supabase: input.supabase,
      provider: input.provider,
      capability: input.capability,
    })
    if (!selected) return null
    return generateCompatibleText({
      provider: input.provider,
      model: selected.model,
      messages: input.messages,
      maxOutputTokens: input.maxOutputTokens,
    })
  }

  return null
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

  await assertAccess({
    supabase: input.supabase,
    context: input.context,
    capability,
    provider: input.preferredProvider,
  })

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
      await assertAccess({
        supabase: input.supabase,
        context: input.context,
        capability,
        provider,
      })

      const result = await executeTextProvider({
        provider,
        capability,
        messages: input.messages,
        maxOutputTokens: input.maxOutputTokens,
        lite: input.lite,
        supabase: input.supabase,
      })

      if (!result) {
        errors.push(`${provider}: no configurado para esta capacidad`)
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
      const typed = error as Error & { code?: string }
      if (typed.code === "EDUAI_ACCESS_RESTRICTED") throw error
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

  await assertAccess({
    supabase: input.supabase,
    context: input.context,
    capability,
    provider: input.preferredProvider,
  })

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
          requestJson: { reusedCacheId: reusable.id, structured: true },
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
        metadata: { cacheId: reusable.id, generationAvoided: true, structured: true },
      })
    }

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
      requestJson: {
        messages: input.messages,
        maxOutputTokens: input.maxOutputTokens ?? null,
        structured: true,
      },
    })
  }

  const order = providerOrder(capability, input.preferredProvider)
  const errors: string[] = []

  for (const provider of order) {
    try {
      await assertAccess({
        supabase: input.supabase,
        context: input.context,
        capability,
        provider,
      })

      let result: { text: string; data: T; provider: string; model: string } | null = null

      if (provider === "google" && hasGoogleAI("text")) {
        const selected = await providerRuntimeModel({
          supabase: input.supabase,
          provider: "google",
          capability,
          lite: input.lite,
        })
        if (selected) {
          result = await generateGoogleStructured<T>({
            messages: input.messages,
            schema: input.schema,
            maxOutputTokens: input.maxOutputTokens,
            lite: input.lite,
            model: selected.model,
          })
        }
      } else if (hasCompatibleProvider(provider)) {
        const selected = await providerRuntimeModel({
          supabase: input.supabase,
          provider,
          capability,
        })
        if (selected) {
          const response = await generateCompatibleText({
            provider,
            model: selected.model,
            messages: input.messages,
            maxOutputTokens: input.maxOutputTokens,
            structuredSchema: input.schema,
          })
          result = {
            text: response.text,
            data: parseStructuredJson<T>(response.text),
            provider: response.provider,
            model: response.model,
          }
        }
      }

      if (!result) {
        errors.push(`${provider}: no configurado para salida estructurada`)
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
        await finishGenerationRequest({
          supabase: input.supabase,
          requestId,
          status: "completed",
          provider: result.provider,
          model: result.model,
          latencyMs: Date.now() - startedAt,
          metadata: { structured: true },
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
      const typed = error as Error & { code?: string }
      if (typed.code === "EDUAI_ACCESS_RESTRICTED") throw error
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
      metadata: { structured: true },
    })
  }

  throw new Error(`EduAI Structured Gateway: todos los proveedores fallaron. ${errors.join(" | ")}`)
}

export async function streamAIText(input: {
  messages: GatewayMessage[]
  maxOutputTokens?: number
  lite?: boolean
  preferredProvider?: AIProviderId | null
  context?: AIRequestContext
  supabase?: SupabaseClient | null
}): Promise<ReadableStream<Uint8Array>> {
  const errors: string[] = []

  for (const provider of providerOrder("text", input.preferredProvider)) {
    try {
      await assertAccess({
        supabase: input.supabase,
        context: input.context,
        capability: "text",
        provider,
      })

      if (provider === "google" && hasGoogleAI("text")) {
        const selected = await providerRuntimeModel({
          supabase: input.supabase,
          provider: "google",
          capability: "text",
          lite: input.lite,
        })
        if (!selected) continue
        return streamGoogleText({
          messages: input.messages,
          maxOutputTokens: input.maxOutputTokens,
          lite: input.lite,
          model: selected.model,
        })
      }

      if (hasCompatibleProvider(provider)) {
        const selected = await providerRuntimeModel({
          supabase: input.supabase,
          provider,
          capability: "text",
        })
        if (!selected) continue
        const result = await generateCompatibleText({
          provider,
          model: selected.model,
          messages: input.messages,
          maxOutputTokens: input.maxOutputTokens,
        })
        const encoded = new TextEncoder().encode(result.text)
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoded)
            controller.close()
          },
        })
      }

      errors.push(`${provider}: no configurado para streaming`)
    } catch (error) {
      const typed = error as Error & { code?: string }
      if (typed.code === "EDUAI_ACCESS_RESTRICTED") throw error
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(`EduAI Stream Gateway: todos los proveedores fallaron. ${errors.join(" | ")}`)
}

export async function runGoogleImage(input: {
  prompt: string
  aspectRatio?: string
  imageSize?: "0.5K" | "1K" | "2K" | "4K"
  previousInteractionId?: string | null
  context?: AIRequestContext
  supabase?: SupabaseClient | null
}) {
  await assertAccess({
    supabase: input.supabase,
    context: input.context,
    capability: "image",
    provider: "google",
  })

  const selected = await providerRuntimeModel({
    supabase: input.supabase,
    provider: "google",
    capability: "image",
    kind: "image",
  })
  if (!selected) throw new Error("Google Image no tiene un modelo configurado")

  return generateGoogleImage({ ...input, model: selected.model })
}
