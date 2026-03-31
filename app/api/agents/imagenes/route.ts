// app/api/agents/imagenes/route.ts
// v6 — Gemini Imagen + Pollinations FREE (no key) + FLUX HF + OpenRouter fallback
// Cadena auto: Gemini → Pollinations → Together → HuggingFace → OpenRouter

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const STYLE_GUIDES: Record<string, string> = {
  realistic:     "photorealistic, DSLR photo, 85mm lens, sharp focus, natural lighting, ultra detailed, 8k resolution",
  "digital art": "digital painting, concept art, artstation trending, vibrant colors, detailed illustration, professional quality",
  "oil painting":"oil on canvas, impressionist brushstrokes, museum quality, rich textures, classical fine art painting",
  anime:         "anime style, Studio Ghibli inspired, detailed linework, vibrant colors, manga illustration, clean lines",
  watercolor:    "watercolor painting, soft edges, transparent washes, artistic, delicate details, paper texture visible",
  "3d render":   "3D render, octane render, cinema4d, ray tracing, photorealistic 3D, subsurface scattering, volumetric light",
  sketch:        "pencil sketch, detailed linework, graphite drawing, cross-hatching, artistic sketch, white background",
  cinematic:     "cinematic photography, movie still, dramatic lighting, anamorphic lens, epic composition, shallow depth of field",
  educational:   "educational diagram, clean illustration, labeled diagram, informative, white background, professional, colorful, pedagogical",
  "flat design": "flat design illustration, minimal, geometric shapes, bold colors, modern vector art, icon style",
  infographic:   "infographic style, data visualization, clean design, informative, colorful sections, professional design, readable",
}

type ProviderId = "auto" | "gemini" | "pollinations" | "together" | "huggingface" | "openrouter"
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
  try { return await res.text() } catch { return "" }
}

function buildBasicPrompt(userPrompt: string, styleDesc: string) {
  return `${userPrompt}, ${styleDesc}, highly detailed, masterpiece, best quality`
}

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height
  if (Math.abs(ratio - 1) < 0.05)        return "1:1"
  if (Math.abs(ratio - 16/9) < 0.15)     return "16:9"
  if (Math.abs(ratio - 9/16) < 0.15)     return "9:16"
  if (Math.abs(ratio - 4/3) < 0.15)      return "4:3"
  if (Math.abs(ratio - 3/4) < 0.15)      return "3:4"
  if (Math.abs(ratio - 3/2) < 0.15)      return "3:2"
  if (Math.abs(ratio - 2/3) < 0.15)      return "2:3"
  return ratio >= 1 ? "16:9" : "9:16"
}

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" },
      signal: AbortSignal.timeout(35000),
    })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    if (!buffer.byteLength) return null
    const mime = res.headers.get("content-type") || "image/png"
    return `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`
  } catch (error) {
    console.error("[Image][fetchAsBase64]", getErrorMessage(error))
    return null
  }
}

// ── Optimizador de prompts con Gemini Flash Lite ──────────────────────────────
async function optimizePromptWithGemini(
  userPrompt: string,
  style: string,
  educationalContext?: string
): Promise<string> {
  const styleDesc = STYLE_GUIDES[style] || STYLE_GUIDES.realistic
  const apiKey    = process.env.GEMINI_API_KEY
  if (!apiKey) return buildBasicPrompt(userPrompt, styleDesc)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text:
            `You are an expert prompt engineer for AI image generation (FLUX, Stable Diffusion, Imagen).
Transform user descriptions into highly detailed, vivid English prompts.
CRITICAL RULES:
- Keep the user's EXACT subject — never change what they asked for
- Add lighting, composition, color palette, textures, and style keywords
- If educational context is provided, ensure anatomical/scientific accuracy
- Output ONLY the optimized prompt — no explanations, no quotes, no preamble`
          }] },
          contents: [{ parts: [{ text:
            `User request: "${userPrompt}"
Style: ${style} — Keywords: ${styleDesc}
${educationalContext ? `Educational context: "${educationalContext.slice(0, 600)}"` : ""}
Write the optimized generation prompt:`
          }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 500 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return buildBasicPrompt(userPrompt, styleDesc)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (text) return text.replace(/^[\"']|[\"']$/g, "")
  } catch {}

  return buildBasicPrompt(userPrompt, styleDesc)
}

// ── PROVEEDOR 1: Gemini Imagen (GRATIS con API key) ───────────────────────────
async function tryGemini(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const label  = "Gemini Imagen"
  const model  = "gemini-2.0-flash-preview-image-generation"
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return { imageBase64: null, label, model, error: "GEMINI_API_KEY no configurada" }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            numberOfImages: 1,
          },
        }),
        signal: AbortSignal.timeout(45000),
      }
    )

    if (!res.ok) {
      const err = await readResponseTextSafe(res)
      return { imageBase64: null, label, model, error: `HTTP ${res.status}: ${err}` }
    }

    const data  = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts || []

    for (const part of parts) {
      if (part?.inlineData?.data && part?.inlineData?.mimeType?.startsWith("image/")) {
        return {
          imageBase64: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          label, model,
        }
      }
    }

    return { imageBase64: null, label, model, error: "Gemini no devolvió imagen en la respuesta" }
  } catch (error) {
    return { imageBase64: null, label, model, error: getErrorMessage(error) }
  }
}

// ── PROVEEDOR 2: Pollinations (con key → autenticado; sin key → free) ──────────
async function tryPollinations(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const label  = "Pollinations"
  const apiKey = process.env.POLLINATIONS_API_KEY
  const safeW  = clampDimension(width, 256, 1920, 1024)
  const safeH  = clampDimension(height, 256, 1920, 768)
  const models = ["flux", "flux-realism", "flux-pro"]

  for (const m of models) {
    try {
      const seed       = Math.floor(Math.random() * 999999)
      const encodedPr  = encodeURIComponent(prompt)

      // Si hay API key → gen.pollinations.ai (autenticado, sin rate-limit duro)
      // Sin key       → image.pollinations.ai (gratuito, abierto)
      const url = apiKey
        ? `https://gen.pollinations.ai/image/${encodedPr}?model=${m}&width=${safeW}&height=${safeH}&seed=${seed}&nologo=true&enhance=true`
        : `https://image.pollinations.ai/prompt/${encodedPr}?model=${m}&width=${safeW}&height=${safeH}&seed=${seed}&nologo=true&enhance=true&safe=false`

      const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" }
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`

      const res = await fetch(url, { headers, signal: AbortSignal.timeout(50000) })

      if (!res.ok) {
        console.warn(`[Pollinations][${m}] HTTP ${res.status}`)
        continue
      }

      const contentType = res.headers.get("content-type") || ""
      if (!contentType.startsWith("image/")) {
        console.warn(`[Pollinations][${m}] Content-Type inesperado: ${contentType}`)
        continue
      }

      const buffer = await res.arrayBuffer()
      if (!buffer.byteLength) continue

      return {
        imageBase64: `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`,
        label,
        model: m,
      }
    } catch (error) {
      console.warn(`[Pollinations][${m}]`, getErrorMessage(error))
    }
  }

  return { imageBase64: null, label, error: "Todos los modelos de Pollinations fallaron" }
}

// ── PROVEEDOR 3: Together AI (FLUX Schnell) ───────────────────────────────────
async function tryTogether(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const key   = process.env.TOGETHER_API_KEY
  const label = "Together AI"
  const models = [
    "black-forest-labs/FLUX.1-schnell",
    "black-forest-labs/FLUX.1-dev",
  ]

  if (!key) return { imageBase64: null, label, error: "TOGETHER_API_KEY no configurada" }

  for (const model of models) {
    try {
      const res = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          width:  clampDimension(width, 256, 1440, 1024),
          height: clampDimension(height, 256, 1440, 768),
          steps:  model.includes("schnell") ? 4 : 20,
          n: 1,
          response_format: "base64",
        }),
        signal: AbortSignal.timeout(45000),
      })

      if (!res.ok) {
        const body = await readResponseTextSafe(res)
        console.warn(`[Together][${model}] HTTP ${res.status}: ${body}`)
        continue
      }

      const data   = await res.json()
      const base64 = data?.data?.[0]?.b64_json || data?.data?.[0]?.base64
      if (base64) return { imageBase64: `data:image/png;base64,${base64}`, label, model }

      const imgUrl = data?.data?.[0]?.url
      if (imgUrl) {
        const converted = await fetchAsBase64(imgUrl)
        if (converted) return { imageBase64: converted, label, model }
      }
    } catch (error) {
      console.warn(`[Together][${model}]`, getErrorMessage(error))
    }
  }

  return { imageBase64: null, label, error: "Together AI: todos los modelos fallaron" }
}

// ── PROVEEDOR 4: Hugging Face (FLUX + SDXL) ───────────────────────────────────
async function tryHuggingFace(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const label  = "Hugging Face"
  const tokens = [
    process.env.HF_TOKEN_1,
    process.env.HF_TOKEN_2,
    process.env.HF_TOKEN_3,
  ].filter(Boolean) as string[]

  if (!tokens.length) return { imageBase64: null, label, error: "No hay HF_TOKEN configurados" }

  const models = [
    { id: "black-forest-labs/FLUX.1-schnell", steps: 4, guidance: 0 },
    { id: "stabilityai/stable-diffusion-xl-base-1.0", steps: 30, guidance: 7.5 },
    { id: "runwayml/stable-diffusion-v1-5", steps: 25, guidance: 7 },
  ]

  for (const { id, steps, guidance } of models) {
    for (const token of tokens) {
      try {
        const res = await fetch(`https://router.huggingface.co/hf-inference/models/${id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, deformed, nsfw",
              width:  clampDimension(width, 256, 1024, 1024),
              height: clampDimension(height, 256, 1024, 768),
              num_inference_steps: steps,
              guidance_scale: guidance,
            },
          }),
          signal: AbortSignal.timeout(55000),
        })

        if (!res.ok) { console.warn(`[HF][${id}] HTTP ${res.status}`); continue }

        const ct = res.headers.get("content-type") || ""
        if (ct.includes("application/json")) { console.warn(`[HF][${id}] JSON inesperado`); continue }

        const buffer = await res.arrayBuffer()
        if (!buffer.byteLength) continue

        return {
          imageBase64: `data:${ct || "image/png"};base64,${Buffer.from(buffer).toString("base64")}`,
          label,
          model: id,
        }
      } catch (error) {
        console.warn(`[HF][${id}]`, getErrorMessage(error))
      }
    }
  }

  return { imageBase64: null, label, error: "Todos los intentos con Hugging Face fallaron" }
}

// ── PROVEEDOR 5: OpenRouter (fallback de pago) ─────────────────────────────────
function getOpenRouterModel(mode: GenerationMode): string {
  switch (mode) {
    case "quality":     return process.env.OPENROUTER_IMAGE_MODEL_QUALITY || "openai/gpt-4o-image"
    case "educational": return process.env.OPENROUTER_IMAGE_MODEL_EDU    || "google/gemini-2.0-flash-exp:free"
    default:            return process.env.OPENROUTER_IMAGE_MODEL_FAST   || "openai/gpt-4o-mini"
  }
}

async function tryOpenRouter(prompt: string, width: number, height: number, mode: GenerationMode): Promise<ProviderResult> {
  const key   = process.env.OPENROUTER_API_KEY
  const model = getOpenRouterModel(mode)
  const label = "OpenRouter"

  if (!key) return { imageBase64: null, label, model, error: "OPENROUTER_API_KEY no configurada" }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eduai.local",
        "X-Title": "EduAI Image Studio",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
        stream: false,
        image_config: { aspect_ratio: getAspectRatio(width, height) },
      }),
      signal: AbortSignal.timeout(50000),
    })

    if (!res.ok) {
      const body = await readResponseTextSafe(res)
      return { imageBase64: null, label, model, error: `HTTP ${res.status}: ${body}` }
    }

    const data    = await res.json()
    const message = data?.choices?.[0]?.message
    const images  = Array.isArray(message?.images) ? message.images : []
    const dataUrl = images[0]?.image_url?.url || images[0]?.url || null

    if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
      return { imageBase64: dataUrl, label, model }
    }
    if (typeof dataUrl === "string" && /^https?:\/\//.test(dataUrl)) {
      const converted = await fetchAsBase64(dataUrl)
      if (converted) return { imageBase64: converted, label, model }
    }

    return { imageBase64: null, label, model, error: "OpenRouter no devolvió imagen" }
  } catch (error) {
    return { imageBase64: null, label, model, error: getErrorMessage(error) }
  }
}

// ── Router de proveedores ──────────────────────────────────────────────────────
async function runProvider(
  providerId: Exclude<ProviderId, "auto">,
  prompt: string,
  width: number,
  height: number,
  mode: GenerationMode
): Promise<ProviderResult> {
  switch (providerId) {
    case "gemini":      return tryGemini(prompt, width, height)
    case "pollinations":return tryPollinations(prompt, width, height)
    case "together":    return tryTogether(prompt, width, height)
    case "huggingface": return tryHuggingFace(prompt, width, height)
    case "openrouter":  return tryOpenRouter(prompt, width, height, mode)
  }
}

function getProviderOrder(provider: ProviderId): Exclude<ProviderId, "auto">[] {
  if (provider !== "auto") return [provider]
  // Auto: empieza con los gratuitos más confiables
  // Gemini y Pollinations primero (gratuitos y confiables); HF al final (sin cuota)
  return ["gemini", "pollinations", "together", "openrouter", "huggingface"]
}

// ── Handler principal ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const body = await req.json()
  const prompt            = String(body?.prompt || "").trim()
  const style             = String(body?.style || "realistic")
  const width             = clampDimension(Number(body?.width), 256, 1920, 1024)
  const height            = clampDimension(Number(body?.height), 256, 1920, 768)
  const provider          = (body?.provider || "auto") as ProviderId
  const mode              = (body?.mode || "fast") as GenerationMode
  const customPrompt      = String(body?.customPrompt || "").trim()
  const source            = String(body?.source || "manual")
  const topic             = body?.topic ?? null
  const educationalContext = body?.educationalContext ? String(body.educationalContext) : undefined

  if (!prompt) return new Response("Prompt requerido", { status: 400 })

  try {
    const optimizedPrompt = customPrompt || (await optimizePromptWithGemini(prompt, style, educationalContext))
    const providerOrder   = getProviderOrder(provider)
    const providerErrors: string[] = []
    let imageBase64: string | null = null
    let usedProvider = ""
    let usedModel    = ""

    for (const currentProvider of providerOrder) {
      console.log(`[Image] Intentando: ${currentProvider}`)
      const result = await runProvider(currentProvider, optimizedPrompt, width, height, mode)

      if (result.imageBase64) {
        imageBase64  = result.imageBase64
        usedProvider = result.label
        usedModel    = result.model || ""
        break
      }

      providerErrors.push(`${result.label}${result.model ? ` (${result.model})` : ""}: ${result.error || "falló"}`)
    }

    if (!imageBase64) {
      return new Response(
        "No se pudo generar la imagen.\n\n" + providerErrors.map((l, i) => `${i + 1}. ${l}`).join("\n"),
        { status: 503 }
      )
    }

    // Guardar en DB (no-await para no bloquear respuesta)
    void supabase.from("generated_images").insert({
      user_id: user.id,
      prompt,
      optimized_prompt: optimizedPrompt,
      image_url: imageBase64,
      provider: usedModel ? `${usedProvider} · ${usedModel}` : usedProvider,
      style, width, height, source, topic,
    })

    return Response.json({
      imageUrl: imageBase64,
      optimizedPrompt,
      provider: usedProvider,
      model:    usedModel,
      mode,
      type:     "base64",
    })
  } catch (error) {
    return new Response(`Error: ${getErrorMessage(error)}`, { status: 500 })
  }
}
