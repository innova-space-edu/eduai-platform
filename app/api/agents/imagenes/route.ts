// src/app/api/agents/imagenes/route.ts
// v5 — OpenRouter principal + Pollinations + Together + Hugging Face fallback

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const STYLE_GUIDES: Record<string, string> = {
  realistic: "photorealistic, DSLR photo, 85mm lens, sharp focus, natural lighting, ultra detailed, 8k",
  "digital art": "digital painting, concept art, artstation trending, vibrant colors, detailed illustration, professional",
  "oil painting": "oil on canvas, impressionist brushstrokes, museum quality, rich textures, classical painting",
  anime: "anime style, Studio Ghibli inspired, detailed linework, vibrant colors, manga illustration, clean",
  watercolor: "watercolor painting, soft edges, transparent washes, artistic, delicate details, paper texture",
  "3d render": "3D render, octane render, cinema4d, ray tracing, photorealistic 3D, subsurface scattering",
  sketch: "pencil sketch, detailed linework, graphite drawing, cross-hatching, artistic sketch, white background",
  cinematic: "cinematic photography, movie still, dramatic lighting, anamorphic lens, epic composition, bokeh",
  educational: "educational diagram, clean illustration, labeled, informative, white background, professional, colorful",
  "flat design": "flat design illustration, minimal, geometric shapes, bold colors, modern, icon style",
  infographic: "infographic style, data visualization, clean, informative, colorful sections, professional design",
}

type ProviderId = "auto" | "openrouter" | "pollinations" | "together" | "huggingface"
type GenerationMode = "fast" | "quality" | "educational"

type ProviderResult = {
  imageBase64: string | null
  label: string
  model?: string
  error?: string
}

function clampDimension(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

async function readResponseTextSafe(res: Response) {
  try {
    return await res.text()
  } catch {
    return ""
  }
}

function buildBasicPrompt(userPrompt: string, styleDesc: string) {
  return `${userPrompt}, ${styleDesc}, highly detailed, masterpiece, best quality`
}

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height

  if (Math.abs(ratio - 1) < 0.05) return "1:1"
  if (Math.abs(ratio - 16 / 9) < 0.15) return "16:9"
  if (Math.abs(ratio - 9 / 16) < 0.15) return "9:16"
  if (Math.abs(ratio - 4 / 3) < 0.15) return "4:3"
  if (Math.abs(ratio - 3 / 4) < 0.15) return "3:4"
  if (Math.abs(ratio - 3 / 2) < 0.15) return "3:2"
  if (Math.abs(ratio - 2 / 3) < 0.15) return "2:3"
  if (Math.abs(ratio - 4 / 5) < 0.15) return "4:5"
  if (Math.abs(ratio - 5 / 4) < 0.15) return "5:4"

  return ratio >= 1 ? "16:9" : "9:16"
}

function getOpenRouterModel(mode: GenerationMode): string {
  const fast = process.env.OPENROUTER_IMAGE_MODEL_FAST || "openai/gpt-5-image-mini"
  const quality = process.env.OPENROUTER_IMAGE_MODEL_QUALITY || "openai/gpt-5-image"
  const educational =
    process.env.OPENROUTER_IMAGE_MODEL_EDU || "google/gemini-2.5-flash-image-preview"

  switch (mode) {
    case "quality":
      return quality
    case "educational":
      return educational
    case "fast":
    default:
      return fast
  }
}

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      console.error("[Image][fetchAsBase64]", res.status, await readResponseTextSafe(res))
      return null
    }

    const buffer = await res.arrayBuffer()
    if (!buffer.byteLength) return null

    const mime = res.headers.get("content-type") || "image/png"
    return `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`
  } catch (error) {
    console.error("[Image][fetchAsBase64] error:", getErrorMessage(error))
    return null
  }
}

async function optimizePromptWithGemini(
  userPrompt: string,
  style: string,
  educationalContext?: string
): Promise<string> {
  const styleDesc = STYLE_GUIDES[style] || STYLE_GUIDES.realistic
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return buildBasicPrompt(userPrompt, styleDesc)

  const systemPrompt = `You are an expert prompt engineer for AI image generation.
Transform user descriptions into highly detailed, vivid English prompts.
Rules:
- Keep the user's exact subject
- Add useful visual details, lighting, framing, textures and color cues
- Respect the requested style
- If educational context exists, make the image pedagogically accurate
- Output only the final prompt`

  const userMsg = `User request: "${userPrompt}"
Style: ${style} — Visual keywords: ${styleDesc}
${educationalContext ? `Educational context: "${educationalContext.slice(0, 600)}"` : ""}

Write the optimized generation prompt:`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMsg }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 500 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!res.ok) {
      console.warn("[ImageOptimizer][Gemini]", res.status, await readResponseTextSafe(res))
      return buildBasicPrompt(userPrompt, styleDesc)
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (text) return text.replace(/^["']|["']$/g, "")
  } catch (error) {
    console.warn("[ImageOptimizer][Gemini] error:", getErrorMessage(error))
  }

  return buildBasicPrompt(userPrompt, styleDesc)
}

async function tryOpenRouter(
  prompt: string,
  width: number,
  height: number,
  mode: GenerationMode
): Promise<ProviderResult> {
  const key = process.env.OPENROUTER_API_KEY
  const model = getOpenRouterModel(mode)
  const label = "OpenRouter"

  if (!key) {
    return { imageBase64: null, label, model, error: "OPENROUTER_API_KEY no configurada" }
  }

  const payload = {
    model,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
    stream: false,
    image_config: {
      aspect_ratio: getAspectRatio(width, height),
      image_size: "1K",
    },
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eduai.local",
        "X-Title": "EduAI Image Studio",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    })

    if (!res.ok) {
      const body = await readResponseTextSafe(res)
      console.error("[OpenRouter]", res.status, body)
      return {
        imageBase64: null,
        label,
        model,
        error: `HTTP ${res.status}: ${body || "sin detalle"}`,
      }
    }

    const data = await res.json()
    const message = data?.choices?.[0]?.message

    const images = Array.isArray(message?.images) ? message.images : []
    const firstImage = images[0]

    const dataUrl =
      firstImage?.image_url?.url ||
      firstImage?.imageUrl?.url ||
      firstImage?.url ||
      null

    if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
      return { imageBase64: dataUrl, label, model }
    }

    if (typeof dataUrl === "string" && /^https?:\/\//.test(dataUrl)) {
      const converted = await fetchAsBase64(dataUrl)
      if (converted) return { imageBase64: converted, label, model }
    }

    return {
      imageBase64: null,
      label,
      model,
      error: "La respuesta no trajo message.images con una imagen válida",
    }
  } catch (error) {
    const msg = getErrorMessage(error)
    console.error("[OpenRouter] error:", msg)
    return { imageBase64: null, label, model, error: msg }
  }
}

async function tryPollinations(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const key = process.env.POLLINATIONS_API_KEY
  const label = "Pollinations"
  const model = "flux"

  if (!key) {
    return { imageBase64: null, label, model, error: "POLLINATIONS_API_KEY no configurada" }
  }

  try {
    const encodedPrompt = encodeURIComponent(prompt)
    const seed = Math.floor(Math.random() * 999999)
    const safeWidth = clampDimension(width, 256, 1024, 1024)
    const safeHeight = clampDimension(height, 256, 1024, 1024, 768)
    const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=${safeWidth}&height=${safeHeight}&seed=${seed}&nologo=true&enhance=true`

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)",
      },
      signal: AbortSignal.timeout(40000),
    })

    if (!res.ok) {
      const body = await readResponseTextSafe(res)
      console.error("[Pollinations]", res.status, body)
      return {
        imageBase64: null,
        label,
        model,
        error: `HTTP ${res.status}: ${body || "sin detalle"}`,
      }
    }

    const buffer = await res.arrayBuffer()
    if (!buffer.byteLength) {
      return { imageBase64: null, label, model, error: "La respuesta llegó vacía" }
    }

    const mime = res.headers.get("content-type") || "image/png"
    return {
      imageBase64: `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`,
      label,
      model,
    }
  } catch (error) {
    const msg = getErrorMessage(error)
    console.error("[Pollinations] error:", msg)
    return { imageBase64: null, label, model, error: msg }
  }
}

async function tryTogether(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const key = process.env.TOGETHER_API_KEY
  const label = "Together AI"
  const model = "black-forest-labs/FLUX.1-schnell"

  if (!key) {
    return { imageBase64: null, label, model, error: "TOGETHER_API_KEY no configurada" }
  }

  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        width: clampDimension(width, 256, 1024, 1024),
        height: clampDimension(height, 256, 1024, 1024, 768),
        steps: 4,
        n: 1,
        response_format: "base64",
      }),
      signal: AbortSignal.timeout(35000),
    })

    if (!res.ok) {
      const body = await readResponseTextSafe(res)
      console.error("[Together]", res.status, body)
      return {
        imageBase64: null,
        label,
        model,
        error: `HTTP ${res.status}: ${body || "sin detalle"}`,
      }
    }

    const data = await res.json()

    const base64 =
      data?.data?.[0]?.b64_json ||
      data?.data?.[0]?.base64 ||
      data?.output?.[0]?.b64_json ||
      data?.output?.[0]?.base64

    if (base64) {
      return {
        imageBase64: `data:image/png;base64,${base64}`,
        label,
        model,
      }
    }

    const imageUrl = data?.data?.[0]?.url || data?.output?.[0]?.url
    if (imageUrl) {
      const converted = await fetchAsBase64(imageUrl)
      if (converted) {
        return {
          imageBase64: converted,
          label,
          model,
        }
      }
    }

    return {
      imageBase64: null,
      label,
      model,
      error: "La API respondió, pero no devolvió base64 ni URL válida",
    }
  } catch (error) {
    const msg = getErrorMessage(error)
    console.error("[Together] error:", msg)
    return { imageBase64: null, label, model, error: msg }
  }
}

async function tryHuggingFace(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const label = "Hugging Face"
  const tokens = [process.env.HF_TOKEN_1, process.env.HF_TOKEN_2, process.env.HF_TOKEN_3].filter(Boolean) as string[]

  if (!tokens.length) {
    return { imageBase64: null, label, error: "No hay HF_TOKEN_1 / HF_TOKEN_2 / HF_TOKEN_3 configurados" }
  }

  const models = [
    "stabilityai/stable-diffusion-xl-base-1.0",
    "runwayml/stable-diffusion-v1-5",
  ]

  const attempts: string[] = []

  for (const model of models) {
    for (let i = 0; i < tokens.length; i++) {
      try {
        const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens[i]}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, deformed",
              width: clampDimension(width, 256, 768, 768),
              height: clampDimension(height, 256, 768, 768),
              num_inference_steps: 28,
              guidance_scale: 7.5,
            },
          }),
          signal: AbortSignal.timeout(45000),
        })

        if (!res.ok) {
          const body = await readResponseTextSafe(res)
          const detail = `[HF][${model}][token ${i + 1}] HTTP ${res.status}: ${body || "sin detalle"}`
          console.error(detail)
          attempts.push(detail)
          continue
        }

        const contentType = res.headers.get("content-type") || ""
        if (contentType.includes("application/json")) {
          const body = await readResponseTextSafe(res)
          const detail = `[HF][${model}][token ${i + 1}] Respuesta JSON inesperada: ${body || "vacía"}`
          console.error(detail)
          attempts.push(detail)
          continue
        }

        const buffer = await res.arrayBuffer()
        if (!buffer.byteLength) {
          const detail = `[HF][${model}][token ${i + 1}] Imagen vacía`
          console.error(detail)
          attempts.push(detail)
          continue
        }

        return {
          imageBase64: `data:${contentType || "image/png"};base64,${Buffer.from(buffer).toString("base64")}`,
          label,
          model,
        }
      } catch (error) {
        const detail = `[HF][${model}][token ${i + 1}] ${getErrorMessage(error)}`
        console.error(detail)
        attempts.push(detail)
      }
    }
  }

  return {
    imageBase64: null,
    label,
    error: attempts.slice(0, 3).join(" | ") || "Todos los intentos con Hugging Face fallaron",
  }
}

async function runProvider(
  providerId: Exclude<ProviderId, "auto">,
  prompt: string,
  width: number,
  height: number,
  mode: GenerationMode
): Promise<ProviderResult> {
  switch (providerId) {
    case "openrouter":
      return tryOpenRouter(prompt, width, height, mode)
    case "pollinations":
      return tryPollinations(prompt, width, height)
    case "together":
      return tryTogether(prompt, width, height)
    case "huggingface":
      return tryHuggingFace(prompt, width, height)
  }
}

function getProviderOrder(provider: ProviderId): Exclude<ProviderId, "auto">[] {
  if (provider === "auto") {
    return ["openrouter", "pollinations", "together", "huggingface"]
  }

  return [provider]
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Response("Unauthorized", { status: 401 })

  const body = await req.json()

  const prompt = String(body?.prompt || "").trim()
  const style = String(body?.style || "realistic")
  const width = clampDimension(Number(body?.width), 256, 1024, 1024)
  const height = clampDimension(Number(body?.height), 256, 1024, 768)
  const provider = (body?.provider || "auto") as ProviderId
  const mode = (body?.mode || "fast") as GenerationMode
  const customPrompt = String(body?.customPrompt || "").trim()
  const source = String(body?.source || "manual")
  const topic = body?.topic ?? null
  const educationalContext = body?.educationalContext ? String(body.educationalContext) : undefined

  if (!prompt) return new Response("Prompt requerido", { status: 400 })

  try {
    const optimizedPrompt =
      customPrompt || (await optimizePromptWithGemini(prompt, style, educationalContext))

    const providerOrder = getProviderOrder(provider)
    const providerErrors: string[] = []

    let imageBase64: string | null = null
    let usedProvider = ""
    let usedModel = ""

    for (const currentProvider of providerOrder) {
      console.log(`[Image] Intentando provider: ${currentProvider}`)

      const result = await runProvider(currentProvider, optimizedPrompt, width, height, mode)

      if (result.imageBase64) {
        imageBase64 = result.imageBase64
        usedProvider = result.label
        usedModel = result.model || ""
        break
      }

      providerErrors.push(
        `${result.label}${result.model ? ` (${result.model})` : ""}: ${result.error || "falló sin detalle"}`
      )
    }

    if (!imageBase64) {
      const message =
        "No se pudo generar la imagen.\n\n" +
        providerErrors.map((line, index) => `${index + 1}. ${line}`).join("\n")

      return new Response(message, { status: 503 })
    }

    void (async () => {
      try {
        const { error } = await supabase.from("generated_images").insert({
          user_id: user.id,
          prompt,
          optimized_prompt: optimizedPrompt,
          image_url: imageBase64,
          provider: usedModel ? `${usedProvider} · ${usedModel}` : usedProvider,
          style,
          width,
          height,
          source,
          topic,
        })

        if (error) {
          console.error("[Image] Error guardando generated_images:", error.message)
        }
      } catch (error) {
        console.error("[Image] Error inesperado guardando imagen:", getErrorMessage(error))
      }
    })()

    return Response.json({
      imageUrl: imageBase64,
      optimizedPrompt,
      provider: usedProvider,
      model: usedModel,
      mode,
      type: "base64",
    })
  } catch (error) {
    const message = getErrorMessage(error)
    console.error("[Image] Error general:", message)
    return new Response(`Error: ${message}`, { status: 500 })
  }
}
