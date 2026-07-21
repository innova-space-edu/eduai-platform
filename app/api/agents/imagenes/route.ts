// app/api/agents/imagenes/route.ts
// Motor multiproveedor con límites por proveedor y fallback total acotado.

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import {
  HUGGINGFACE_IMAGE_MODELS,
  OPENROUTER_IMAGE_MODELS,
  POLLINATIONS_IMAGE_MODELS,
  TOGETHER_IMAGE_MODELS,
  type GenerationMode,
  type ProviderId,
  type ProviderResult,
  STYLE_GUIDES,
  aspectRatio,
  basicPrompt,
  clamp,
  errMsg,
  GEMINI_IMAGE_MODELS,
  getGeminiImageKeys,
  getHuggingFaceTokens,
  getOpenRouterKeys,
  getPromptOptimizerKeys,
  getTogetherKeys,
  pickFromPool,
  providerOrder,
  safeText,
  shouldOptimizePrompt,
} from "@/lib/image-config"

export const runtime = "nodejs"
export const maxDuration = 55

type ConcreteProviderId = Exclude<ProviderId, "auto">

type HuggingFaceModel = {
  id: string
  steps: number
  guidance: number
  supportsNegative?: boolean
}

type ProviderAttempt = {
  provider: ConcreteProviderId
  label: string
  model?: string
  error: string
  elapsedMs: number
}

const DEFAULT_TOTAL_TIMEOUT_MS = 48_000
const DEFAULT_PROVIDER_TIMEOUT_MS: Record<ConcreteProviderId, number> = {
  pollinations: 9_000,
  openrouter: 11_000,
  gemini: 10_000,
  together: 10_000,
  huggingface: 10_000,
}

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name])
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function totalTimeoutMs(): number {
  return envNumber("IMAGE_TOTAL_TIMEOUT_MS", DEFAULT_TOTAL_TIMEOUT_MS, 20_000, 52_000)
}

function providerTimeoutMs(provider: ConcreteProviderId): number {
  const envName = `IMAGE_PROVIDER_TIMEOUT_${provider.toUpperCase()}_MS`
  return envNumber(envName, DEFAULT_PROVIDER_TIMEOUT_MS[provider], 4_000, 20_000)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || /aborted|timeout/i.test(error.message))
}

function getNegativePrompt(style: string): string {
  const common = [
    "blurry",
    "low quality",
    "worst quality",
    "pixelated",
    "deformed",
    "distorted",
    "extra fingers",
    "bad anatomy",
    "cropped",
    "watermark",
    "text",
    "signature",
  ]

  if (style === "educational" || style === "infographic" || style === "flat design") {
    return [...common, "photorealistic skin", "dark background", "messy layout", "illegible labels"].join(", ")
  }

  if (style === "realistic" || style === "cinematic") {
    return [...common, "cgi", "3d render", "plastic skin", "oversaturated", "cartoon"].join(", ")
  }

  return common.join(", ")
}

async function responseError(res: Response): Promise<string> {
  const body = (await safeText(res)).replace(/\s+/g, " ").trim().slice(0, 180)
  const retryAfter = res.headers.get("retry-after")
  const suffix = retryAfter ? `; reintentar en ${retryAfter}s` : ""
  return `HTTP ${res.status}${body ? `: ${body}` : ""}${suffix}`
}

async function fetchBase64(url: string, signal: AbortSignal): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "EduAI/1.0" },
    signal,
  })
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  if (!buf.byteLength) return null
  const mime = res.headers.get("content-type") || "image/png"
  return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`
}

async function uploadToStorage(imageBase64: string, userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  try {
    const admin = createAdmin(url, key)
    const match = imageBase64.match(/^data:(image\/[\w.+-]+);base64,(.+)$/)
    if (!match) return null

    const mime = match[1]
    const ext = mime.split("/")[1] || "png"
    const buf = Buffer.from(match[2], "base64")
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await admin.storage
      .from("generated-images")
      .upload(fileName, buf, { contentType: mime, upsert: false })

    if (error) {
      console.warn("[Image][Storage]", error.message)
      return null
    }

    const { data } = admin.storage.from("generated-images").getPublicUrl(fileName)
    return data?.publicUrl || null
  } catch (error) {
    console.error("[Image][Storage]", errMsg(error))
    return null
  }
}

function detectComposition(prompt: string): string | null {
  const p = prompt.toLowerCase()
  if (/full.?body|cuerpo.?completo|de.?cuerpo.?entero|figura.?completa|full.?length/.test(p)) {
    return "full body, full figure visible from head to toe"
  }
  if (/half.?body|medio.?cuerpo|waist.?up|hasta.?cintura/.test(p)) {
    return "half body shot, waist up"
  }
  if (/bust|torso|chest.?up|pecho|busto/.test(p)) {
    return "bust shot, chest and shoulders"
  }
  if (/close.?up|primer.?plano|rostro|cara\b/.test(p)) {
    return "close-up portrait, tight face framing"
  }
  if (/wide.?shot|toma.?amplia|paisaje\b|ambiente\b|escena\b/.test(p)) {
    return "wide shot, environment visible"
  }
  return null
}

async function optimizePrompt(
  userPrompt: string,
  style: string,
  educationalCtx?: string
): Promise<string> {
  const apiKey = pickFromPool(getPromptOptimizerKeys(), `${userPrompt}:${style}`)
  if (!apiKey) return basicPrompt(userPrompt, style)

  const styleDesc = STYLE_GUIDES[style] || STYLE_GUIDES.realistic
  const isPortrait = style === "realistic" || style === "portrait"
  const userComposition = detectComposition(userPrompt)
  const compositionNote = userComposition
    ? `IMPORTANT — The user explicitly requested this framing: "${userComposition}". Respect it.`
    : isPortrait
      ? "Default to close-up portrait framing unless the user specified otherwise."
      : "Include a composition note matching the content."

  const systemInstruction = isPortrait
    ? `You are an expert image prompt engineer specializing in photorealistic photography.
Transform the user description into a detailed English prompt.
Include subject, camera/lens, lighting, composition and quality.
${compositionNote}
Do not add NSFW content. Output only the prompt.`
    : `You are an expert image prompt engineer.
Transform the user description into a detailed English prompt.
Style: ${styleDesc}.
Add visual details, palette, lighting, mood and composition.
${compositionNote}
Output only the prompt.`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{
            parts: [{
              text: `User request: "${userPrompt}"\nStyle: ${style}\n${
                educationalCtx ? `Context: "${educationalCtx.slice(0, 400)}"` : ""
              }\nOptimized prompt:`,
            }],
          }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 600 },
        }),
        signal: controller.signal,
      }
    )

    if (!res.ok) return basicPrompt(userPrompt, style)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) return basicPrompt(userPrompt, style)
    return text.replace(/^["']|["']$/g, "")
  } catch {
    return basicPrompt(userPrompt, style)
  } finally {
    clearTimeout(timer)
  }
}

async function tryGemini(
  prompt: string,
  width: number,
  height: number,
  signal: AbortSignal
): Promise<ProviderResult> {
  const label = "Gemini Imagen"
  const keys = getGeminiImageKeys()
  if (!keys.length) return { imageBase64: null, label, error: "No hay clave Gemini configurada" }

  let lastError = "Gemini no devolvió una imagen"

  for (const model of GEMINI_IMAGE_MODELS) {
    for (const apiKey of keys) {
      if (signal.aborted) return { imageBase64: null, label, model, error: lastError }
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseModalities: ["IMAGE"],
                responseFormat: {
                  image: { aspectRatio: aspectRatio(width, height) },
                },
              },
            }),
            signal,
          }
        )

        if (!res.ok) {
          lastError = await responseError(res)
          console.warn(`[Gemini][${model}] ${lastError}`)
          continue
        }

        const data = await res.json()
        const parts = data?.candidates?.[0]?.content?.parts || []
        for (const part of parts) {
          if (part?.inlineData?.data && part?.inlineData?.mimeType?.startsWith("image/")) {
            return {
              imageBase64: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              label,
              model,
            }
          }
        }
        lastError = "Respuesta válida, pero sin datos de imagen"
      } catch (error) {
        if (signal.aborted || isAbortError(error)) break
        lastError = errMsg(error)
        console.warn(`[Gemini][${model}]`, lastError)
      }
    }
  }

  return { imageBase64: null, label, error: lastError }
}

async function tryPollinations(
  prompt: string,
  width: number,
  height: number,
  signal: AbortSignal
): Promise<ProviderResult> {
  const label = "Pollinations"
  const apiKey = process.env.POLLINATIONS_API_KEY
  const safeW = clamp(width, 256, 1920, 1024)
  const safeH = clamp(height, 256, 1920, 768)
  let lastError = "Pollinations no devolvió una imagen"

  for (const model of POLLINATIONS_IMAGE_MODELS) {
    if (signal.aborted) break
    try {
      if (apiKey) {
        const res = await fetch("https://gen.pollinations.ai/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            prompt,
            n: 1,
            size: `${safeW}x${safeH}`,
            quality: "medium",
            response_format: "b64_json",
            safe: true,
          }),
          signal,
        })

        if (!res.ok) {
          lastError = await responseError(res)
          console.warn(`[Pollinations][${model}] ${lastError}`)
          continue
        }

        const data = await res.json()
        const item = data?.data?.[0]
        if (item?.b64_json) {
          return { imageBase64: `data:image/png;base64,${item.b64_json}`, label, model }
        }
        if (item?.url) {
          const converted = await fetchBase64(String(item.url), signal)
          if (converted) return { imageBase64: converted, label, model }
        }
        lastError = "Respuesta válida, pero sin imagen"
        continue
      }

      const seed = Math.floor(Math.random() * 2_147_483_647)
      const encoded = encodeURIComponent(prompt)
      const url = `https://gen.pollinations.ai/image/${encoded}?model=${encodeURIComponent(model)}&width=${safeW}&height=${safeH}&seed=${seed}&enhance=true&safe=true`
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" },
        signal,
      })

      if (!res.ok) {
        lastError = await responseError(res)
        console.warn(`[Pollinations][${model}] ${lastError}`)
        continue
      }

      const contentType = res.headers.get("content-type") || ""
      if (!contentType.startsWith("image/")) {
        lastError = `Tipo de contenido inesperado: ${contentType || "vacío"}`
        continue
      }

      const buf = await res.arrayBuffer()
      if (!buf.byteLength) {
        lastError = "Imagen vacía"
        continue
      }

      return {
        imageBase64: `data:${contentType};base64,${Buffer.from(buf).toString("base64")}`,
        label,
        model,
      }
    } catch (error) {
      if (signal.aborted || isAbortError(error)) break
      lastError = errMsg(error)
      console.warn(`[Pollinations][${model}]`, lastError)
    }
  }

  return { imageBase64: null, label, error: lastError }
}

async function tryTogether(
  prompt: string,
  width: number,
  height: number,
  signal: AbortSignal
): Promise<ProviderResult> {
  const label = "Together AI"
  const keys = getTogetherKeys()
  if (!keys.length) return { imageBase64: null, label, error: "No hay clave Together configurada" }

  let lastError = "Together no devolvió una imagen"

  for (const { id, steps, guidance, useAspectRatio } of TOGETHER_IMAGE_MODELS) {
    for (const key of keys) {
      if (signal.aborted) return { imageBase64: null, label, model: id, error: lastError }
      try {
        const sizeParams = useAspectRatio
          ? { aspect_ratio: aspectRatio(width, height) }
          : {
              width: clamp(width, 256, 1440, 1024),
              height: clamp(height, 256, 1440, 768),
            }

        const res = await fetch("https://api.together.xyz/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: id,
            prompt,
            ...sizeParams,
            steps,
            n: 1,
            guidance_scale: guidance,
            response_format: "base64",
            output_format: "png",
          }),
          signal,
        })

        if (!res.ok) {
          lastError = await responseError(res)
          console.warn(`[Together][${id}] ${lastError}`)
          continue
        }

        const data = await res.json()
        const base64 = data?.data?.[0]?.b64_json || data?.data?.[0]?.base64
        if (base64) return { imageBase64: `data:image/png;base64,${base64}`, label, model: id }

        const imageUrl = data?.data?.[0]?.url
        if (imageUrl) {
          const converted = await fetchBase64(String(imageUrl), signal)
          if (converted) return { imageBase64: converted, label, model: id }
        }
        lastError = "Respuesta válida, pero sin imagen"
      } catch (error) {
        if (signal.aborted || isAbortError(error)) break
        lastError = errMsg(error)
        console.warn(`[Together][${id}]`, lastError)
      }
    }
  }

  return { imageBase64: null, label, error: lastError }
}

async function tryHuggingFace(
  prompt: string,
  width: number,
  height: number,
  style: string,
  signal: AbortSignal
): Promise<ProviderResult> {
  const label = "Hugging Face"
  const tokens = getHuggingFaceTokens()
  if (!tokens.length) return { imageBase64: null, label, error: "No hay token Hugging Face configurado" }

  const negativePrompt = getNegativePrompt(style)
  let lastError = "Hugging Face no devolvió una imagen"

  for (const hfModel of HUGGINGFACE_IMAGE_MODELS as HuggingFaceModel[]) {
    const { id, steps, guidance, supportsNegative } = hfModel
    for (const token of tokens) {
      if (signal.aborted) return { imageBase64: null, label, model: id, error: lastError }
      try {
        const res = await fetch(`https://router.huggingface.co/hf-inference/models/${id}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              negative_prompt: supportsNegative ? negativePrompt : undefined,
              width: clamp(width, 256, 1024, 1024),
              height: clamp(height, 256, 1024, 768),
              num_inference_steps: steps,
              guidance_scale: guidance,
            },
          }),
          signal,
        })

        if (!res.ok) {
          lastError = await responseError(res)
          console.warn(`[HF][${id}] ${lastError}`)
          continue
        }

        const contentType = res.headers.get("content-type") || ""
        if (contentType.includes("application/json")) {
          lastError = "El proveedor devolvió JSON en vez de una imagen"
          continue
        }

        const buf = await res.arrayBuffer()
        if (!buf.byteLength) {
          lastError = "Imagen vacía"
          continue
        }

        return {
          imageBase64: `data:${contentType || "image/png"};base64,${Buffer.from(buf).toString("base64")}`,
          label,
          model: id,
        }
      } catch (error) {
        if (signal.aborted || isAbortError(error)) break
        lastError = errMsg(error)
        console.warn(`[HF][${id}]`, lastError)
      }
    }
  }

  return { imageBase64: null, label, error: lastError }
}

async function tryOpenRouter(
  prompt: string,
  width: number,
  height: number,
  signal: AbortSignal
): Promise<ProviderResult> {
  const label = "OpenRouter"
  const keys = getOpenRouterKeys()
  if (!keys.length) return { imageBase64: null, label, error: "No hay clave OpenRouter configurada" }

  let lastError = "OpenRouter no devolvió una imagen"

  for (const { id } of OPENROUTER_IMAGE_MODELS) {
    for (const key of keys) {
      if (signal.aborted) return { imageBase64: null, label, model: id, error: lastError }
      try {
        const res = await fetch("https://openrouter.ai/api/v1/images", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://eduaiplatformclon.vercel.app",
            "X-Title": process.env.OPENROUTER_APP_TITLE || "EduAI Image Studio",
          },
          body: JSON.stringify({
            model: id,
            prompt,
            n: 1,
            resolution: "1K",
            aspect_ratio: aspectRatio(width, height),
            output_format: "png",
          }),
          signal,
        })

        if (!res.ok) {
          lastError = await responseError(res)
          console.warn(`[OpenRouter][${id}] ${lastError}`)
          continue
        }

        const data = await res.json()
        const item = data?.data?.[0]
        if (item?.b64_json) {
          const mediaType = item.media_type || "image/png"
          return { imageBase64: `data:${mediaType};base64,${item.b64_json}`, label, model: id }
        }
        if (item?.url) {
          const converted = await fetchBase64(String(item.url), signal)
          if (converted) return { imageBase64: converted, label, model: id }
        }
        lastError = "Respuesta válida, pero sin imagen"
      } catch (error) {
        if (signal.aborted || isAbortError(error)) break
        lastError = errMsg(error)
        console.warn(`[OpenRouter][${id}]`, lastError)
      }
    }
  }

  return { imageBase64: null, label, error: lastError }
}

async function runProvider(
  id: ConcreteProviderId,
  prompt: string,
  width: number,
  height: number,
  style: string,
  signal: AbortSignal
): Promise<ProviderResult> {
  switch (id) {
    case "gemini":
      return tryGemini(prompt, width, height, signal)
    case "pollinations":
      return tryPollinations(prompt, width, height, signal)
    case "together":
      return tryTogether(prompt, width, height, signal)
    case "huggingface":
      return tryHuggingFace(prompt, width, height, style, signal)
    case "openrouter":
      return tryOpenRouter(prompt, width, height, signal)
  }
}

async function runProviderWithTimeout(
  id: ConcreteProviderId,
  prompt: string,
  width: number,
  height: number,
  style: string,
  timeoutMs: number
): Promise<{ result: ProviderResult; elapsedMs: number }> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const result = await runProvider(id, prompt, width, height, style, controller.signal)
    if (!result.imageBase64 && controller.signal.aborted) {
      return {
        result: {
          ...result,
          error: `Tiempo máximo agotado (${Math.round(timeoutMs / 1000)}s)`,
        },
        elapsedMs: Date.now() - startedAt,
      }
    }
    return { result, elapsedMs: Date.now() - startedAt }
  } catch (error) {
    return {
      result: {
        imageBase64: null,
        label: id,
        error: controller.signal.aborted
          ? `Tiempo máximo agotado (${Math.round(timeoutMs / 1000)}s)`
          : errMsg(error),
      },
      elapsedMs: Date.now() - startedAt,
    }
  } finally {
    clearTimeout(timer)
  }
}

function formatAttempt(attempt: ProviderAttempt): string {
  const model = attempt.model ? `/${attempt.model}` : ""
  return `${attempt.label}${model}: ${attempt.error}`
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  const deadline = startedAt + totalTimeoutMs()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ success: false, error: "No autorizado" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ success: false, error: "Solicitud JSON inválida" }, { status: 400 })
  }

  const prompt = String(body?.prompt || "").trim()
  const style = String(body?.style || "realistic")
  const width = clamp(Number(body?.width), 256, 1920, 1024)
  const height = clamp(Number(body?.height), 256, 1920, 768)
  const provider = (body?.provider || "auto") as ProviderId
  const mode = (body?.mode || "fast") as GenerationMode
  const customPrompt = String(body?.customPrompt || "").trim()
  const source = String(body?.source || "manual")
  const topic = body?.topic ?? null
  const educationalContext = body?.educationalContext
    ? String(body.educationalContext)
    : undefined

  if (!prompt) {
    return Response.json({ success: false, error: "Prompt requerido" }, { status: 400 })
  }

  try {
    const promptWasOptimized = !customPrompt && shouldOptimizePrompt(mode, customPrompt)
    const optimizedPrompt = customPrompt
      ? customPrompt
      : promptWasOptimized
        ? await optimizePrompt(prompt, style, educationalContext)
        : basicPrompt(prompt, style)

    const order = providerOrder(provider, mode)
    const attempts: ProviderAttempt[] = []
    let imageBase64: string | null = null
    let usedProvider = ""
    let usedModel = ""

    for (let index = 0; index < order.length; index += 1) {
      const currentProvider = order[index]
      const remainingMs = deadline - Date.now()
      if (remainingMs < 1_500) {
        attempts.push({
          provider: currentProvider,
          label: currentProvider,
          error: "Presupuesto total agotado antes del intento",
          elapsedMs: 0,
        })
        break
      }

      const providersLeft = order.length - index
      const fairShareMs = Math.max(4_000, Math.floor(remainingMs / providersLeft))
      const timeoutMs = Math.min(providerTimeoutMs(currentProvider), fairShareMs, remainingMs - 500)

      console.log(`[Image] Intentando ${currentProvider} con límite ${timeoutMs}ms`)
      const { result, elapsedMs } = await runProviderWithTimeout(
        currentProvider,
        optimizedPrompt,
        width,
        height,
        style,
        timeoutMs
      )

      if (result.imageBase64) {
        imageBase64 = result.imageBase64
        usedProvider = result.label
        usedModel = result.model || ""
        break
      }

      attempts.push({
        provider: currentProvider,
        label: result.label,
        model: result.model,
        error: result.error || "Falló sin detalle",
        elapsedMs,
      })
    }

    if (!imageBase64) {
      const details = attempts.map(formatAttempt)
      const compactDetails = details.join(" | ").slice(0, 1_600)
      return Response.json(
        {
          success: false,
          code: "IMAGE_PROVIDERS_FAILED",
          error: `No se pudo generar la imagen. ${compactDetails || "Ningún proveedor quedó disponible."}`,
          attempts,
          providerOrder: order,
          elapsedMs: Date.now() - startedAt,
        },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        }
      )
    }

    void (async () => {
      try {
        const publicUrl = await uploadToStorage(imageBase64, user.id)
        const { error } = await supabase.from("generated_images").insert({
          user_id: user.id,
          prompt,
          optimized_prompt: optimizedPrompt,
          image_url: publicUrl ?? imageBase64,
          provider: usedModel ? `${usedProvider} · ${usedModel}` : usedProvider,
          style,
          width,
          height,
          source,
          topic,
        })
        if (error) console.error("[Image][DB]", error.message)
      } catch (error) {
        console.error("[Image][Save]", errMsg(error))
      }
    })()

    return Response.json(
      {
        success: true,
        imageUrl: imageBase64,
        optimizedPrompt,
        provider: usedProvider,
        model: usedModel,
        mode,
        type: "base64",
        providerOrder: order,
        attempts,
        promptOptimized: promptWasOptimized,
        elapsedMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("[Image][POST]", error)
    return Response.json(
      {
        success: false,
        code: "IMAGE_INTERNAL_ERROR",
        error: `Error interno de generación: ${errMsg(error)}`,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
