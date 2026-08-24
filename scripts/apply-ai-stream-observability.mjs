import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const gatewayPath = path.join(root, "lib", "ai", "gateway.ts")
if (!fs.existsSync(gatewayPath)) throw new Error(`No se encontró ${gatewayPath}`)

let source = fs.readFileSync(gatewayPath, "utf8")

if (source.includes("[AI_STREAM_OBSERVABILITY_V1]")) {
  console.log("[ai-stream] observabilidad y reuse de streaming ya aplicados")
  process.exit(0)
}

const start = source.indexOf("export async function streamAIText(")
const end = source.indexOf("export async function runGoogleImage(", start)
if (start < 0 || end <= start) throw new Error("[ai-stream] No se encontró el bloque streamAIText")

const replacement = `export async function streamAIText(input: {
  messages: GatewayMessage[]
  maxOutputTokens?: number
  lite?: boolean
  preferredProvider?: AIProviderId | null
  context?: AIRequestContext
  supabase?: SupabaseClient | null
}): Promise<ReadableStream<Uint8Array>> {
  // [AI_STREAM_OBSERVABILITY_V1]
  const startedAt = Date.now()
  const capability: AICapability = "text"
  const first = providerOrder(capability, input.preferredProvider)[0]

  await assertAccess({
    supabase: input.supabase,
    context: input.context,
    capability,
    provider: first,
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

  if (input.context?.reusePolicy !== "never") {
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
            requestJson: { reusedCacheId: reusable.id, streaming: true },
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
          metadata: { cacheId: reusable.id, generationAvoided: true, streaming: true },
        })
      }

      const encoded = new TextEncoder().encode(reusable.result.text)
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoded)
          controller.close()
        },
      })
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
      requestJson: { messages: input.messages, maxOutputTokens: input.maxOutputTokens ?? null, streaming: true },
    })
  }

  try {
    if (first === "google" && hasGoogleAI("text")) {
      const selected = await googleRuntimeModel({
        supabase: input.supabase,
        capability,
        lite: input.lite,
      })
      const upstream = await streamGoogleText({
        messages: input.messages,
        maxOutputTokens: input.maxOutputTokens,
        lite: input.lite,
        model: selected.model,
      })
      const reader = upstream.getReader()
      const decoder = new TextDecoder()

      return new ReadableStream<Uint8Array>({
        async start(controller) {
          let fullText = ""
          try {
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              if (value) {
                fullText += decoder.decode(value, { stream: true })
                controller.enqueue(value)
              }
            }
            fullText += decoder.decode()

            if (input.supabase && input.context?.userId && input.context.reusePolicy !== "never" && fullText) {
              await saveReusableGeneration({
                supabase: input.supabase,
                userId: input.context.userId,
                capability,
                fingerprint,
                provider: "google",
                model: selected.model,
                result: { text: fullText },
                reusePolicy: input.context.reusePolicy,
                visibility: input.context.visibility,
                workspaceId: input.context.workspaceId,
              })
            }

            if (input.supabase) {
              await finishGenerationRequest({
                supabase: input.supabase,
                requestId,
                status: "completed",
                provider: "google",
                model: selected.model,
                latencyMs: Date.now() - startedAt,
                metadata: { streaming: true },
              })
            }
            controller.close()
          } catch (error) {
            if (input.supabase) {
              await finishGenerationRequest({
                supabase: input.supabase,
                requestId,
                status: "failed",
                provider: "google",
                model: selected.model,
                error: error instanceof Error ? error.message : String(error),
                latencyMs: Date.now() - startedAt,
                metadata: { streaming: true },
              })
            }
            controller.error(error)
          } finally {
            reader.releaseLock()
          }
        },
        async cancel(reason) {
          await reader.cancel(reason)
        },
      })
    }

    const fallback = await callLegacyAI(input.messages, {
      maxTokens: input.maxOutputTokens,
      preferProvider: legacyPreference(first),
    })

    if (input.supabase && input.context?.userId && input.context.reusePolicy !== "never") {
      await saveReusableGeneration({
        supabase: input.supabase,
        userId: input.context.userId,
        capability,
        fingerprint,
        provider: fallback.provider,
        model: fallback.model,
        result: { text: fallback.text },
        reusePolicy: input.context.reusePolicy,
        visibility: input.context.visibility,
        workspaceId: input.context.workspaceId,
      })
    }

    if (input.supabase) {
      await finishGenerationRequest({
        supabase: input.supabase,
        requestId,
        status: "completed",
        provider: fallback.provider,
        model: fallback.model,
        latencyMs: Date.now() - startedAt,
        metadata: { streaming: true, bufferedFallback: true },
      })
    }

    const encoded = new TextEncoder().encode(fallback.text)
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded)
        controller.close()
      },
    })
  } catch (error) {
    if (input.supabase) {
      await finishGenerationRequest({
        supabase: input.supabase,
        requestId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
        metadata: { streaming: true },
      })
    }
    throw error
  }
}

`

source = source.slice(0, start) + replacement + source.slice(end)
fs.writeFileSync(gatewayPath, source)
console.log("[ai-stream] streaming conectado a observabilidad y reuse persistente")
