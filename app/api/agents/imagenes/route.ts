// src/app/api/agents/imagenes/route.ts
// v4 — Together + Hugging Face + Pollinations con logs reales, fallback robusto y error detallado

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

// ── ESTILOS ──────────────────────────────────────────────
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

type ProviderId = "auto" | "together" | "huggingface" | "pollinations"

type ProviderResult = {
  imageBase64: string | null
  label: string
  error?: string
}

function clampDimension(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function buildBasicPrompt(userPrompt: string, styleDesc: string): string {
  return `${userPrompt}, ${styleDesc}, highly detailed, masterpiece, best quality`
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

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" },
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      console.error("[Image][fetchAsBase64]", res.status, await readResponseTextSafe(res))
      return null
    }

    const buffer = await res.arrayBuffer()
    if (!buffer.byteLength) return null

    const base64 = Buffer.from(buffer).toString("base64")
    const mime = res.headers.get("content-type") || "image/png"
    return `data:${mime};base64,${base64}`
  } catch (error) {
    console.error("[Image][fetchAsBase64] error:", getErrorMessage(error))
    return null
  }
}

// ── OPTIMIZAR PROMPT con Gemini 2.5 Flash-Lite ──────────
async function optimizePromptWithGemini(
  userPrompt: string,
  style: string,
  educationalContext?: string
): Promise<string> {
  const styleDesc = STYLE_GUIDES[style] || STYLE_GUIDES.realistic
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return buildBasicPrompt(userPrompt, styleDesc)

  const systemPrompt = `You are an expert prompt engineer for AI image generation (FLUX, Stable Diffusion, DALL-E).
Transform user descriptions into highly detailed, vivid English generation prompts.
CRITICAL RULES:
- Keep the user's EXACT subject — never change what they asked for
- Add specific visual details: lighting, composition, perspective, textures, colors
- Add technical quality keywords appropriate to the style
- If educational context is provided, make the image pedagogically useful and accurate
- Output ONLY the final optimized prompt — no explanations, no quotes, no preamble`

  const userMsg = `User request: "${userPrompt}"
Style: ${style} — Visual keywords: ${styleDesc}
${educationalContext ? `Educational context (use to make image accurate): "${educationalContext.slice(0, 600)}"` : ""}

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
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (text) return text.replace(/^["']|["']$/g, "")
  } catch (error) {
    console.warn("[ImageOptimizer] Gemini 2.5 Flash-Lite falló:", getErrorMessage(error))
  }

  return buildBasicPrompt(userPrompt, styleDesc)
}

// ── PROVIDERS DE GENERACIÓN ───────────────────────────────

// Provider 1: Together AI — FLUX Schnell
async function tryTogether(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const key = process.env.TOGETHER_API_KEY
  const label = "Together AI (FLUX Schnell)"

  if (!key) {
    return { imageBase64: null, label, error: "TOGETHER_API_KEY no configurada" }
  }

  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt,
        width: clampDimension(width, 256, 1024, 1024),
        height: clampDimension(height, 256, 1024, 768),
        steps: 4,
        n: 1,
        response_format: "base64",
      }),
      signal: AbortSignal.timeout(35000),
    })

    if (!res.ok) {
      const body = await readResponseTextSafe(res)
      console.error("[Together]", res.status, body)
      return { imageBase64: null, label, error: `HTTP ${res.status}: ${body || "sin detalle"}` }
    }

    const data = await res.json()

    const base64 =
      data?.data?.[0]?.b64_json ||
      data?.data?.[0]?.base64 ||
      data?.output?.[0]?.b64_json ||
      data?.output?.[0]?.base64

    if (base64) {
      return { imageBase64: `data:image/png;base64,${base64}`, label }
    }

    const imageUrl = data?.data?.[0]?.url || data?.output?.[0]?.url
    if (imageUrl) {
      const imageBase64 = await fetchAsBase64(imageUrl)
      if (imageBase64) return { imageBase64, label }
    }

    return { imageBase64: null, label, error: "La API respondió, pero no devolvió imagen en base64 ni URL válida" }
  } catch (error) {
    const msg = getErrorMessage(error)
    console.error("[Together] error:", msg)
    return { imageBase64: null, label, error: msg }
  }
}

// Provider 2: Hugging Face
async function tryHuggingFace(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const label = "Hugging Face (Stable Diffusion XL)"
  const tokens = [process.env.HF_TOKEN_1, process.env.HF_TOKEN_2, process.env.HF_TOKEN_3].filter(Boolean) as string[]

  if (!tokens.length) {
    return { imageBase64: null, label, error: "No hay HF_TOKEN_1 / HF_TOKEN_2 / HF_TOKEN_3 configurados" }
  }

  const models = [
    "stabilityai/stable-diffusion-xl-base-1.0",
    "black-forest-labs/FLUX.1-schnell",
    "runwayml/stable-diffusion-v1-5",
  ]

  const negative =
    "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, nsfw, wrong subject, deformed"

  const attempts: string[] = []

  for (const model of models) {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      try {
        const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              negative_prompt: negative,
              width: clampDimension(width, 256, 1024, 768),
              height: clampDimension(height, 256, 1024, 768),
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
          const text = await readResponseTextSafe(res)
          const detail = `[HF][${model}][token ${i + 1}] Respuesta JSON inesperada: ${text || "vacía"}`
          console.error(detail)
          attempts.push(detail)
          continue
        }

        const arrayBuffer = await res.arrayBuffer()
        if (!arrayBuffer.byteLength) {
          const detail = `[HF][${model}][token ${i + 1}] Imagen vacía`
          console.error(detail)
          attempts.push(detail)
          continue
        }

        const base64 = Buffer.from(arrayBuffer).toString("base64")
        const mime = contentType || "image/png"
        return {
          imageBase64: `data:${mime};base64,${base64}`,
          label,
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

// Provider 3: Pollinations
async function tryPollinations(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const key = process.env.POLLINATIONS_API_KEY
  const label = "Pollinations"

  if (!key) {
    return { imageBase64: null, label, error: "POLLINATIONS_API_KEY no configurada" }
  }

  try {
    const encodedPrompt = encodeURIComponent(prompt)
    const seed = Math.floor(Math.random() * 999999)
    const safeWidth = clampDimension(width, 256, 1024, 1024)
    const safeHeight = clampDimension(height, 256, 1024, 768)

    const url = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${safeWidth}&height=${safeHeight}&seed=${seed}&nologo=true&enhance=true`

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
      return { imageBase64: null, label, error: `HTTP ${res.status}: ${body || "sin detalle"}` }
    }

    const buffer = await res.arrayBuffer()
    if (!buffer.byteLength) {
      return { imageBase64: null, label, error: "La respuesta llegó vacía" }
    }

    const mime = res.headers.get("content-type") || "image/png"
    const base64 = Buffer.from(buffer).toString("base64")
    return {
      imageBase64: `data:${mime};base64,${base64}`,
      label,
    }
  } catch (error) {
    const msg = getErrorMessage(error)
    console.error("[Pollinations] error:", msg)
    return { imageBase64: null, label, error: msg }
  }
}

async function runProvider(
  providerId: Exclude<ProviderId, "auto">,
  prompt: string,
  width: number,
  height: number
): Promise<ProviderResult> {
  switch (providerId) {
    case "together":
      return tryTogether(prompt, width, height)
    case "huggingface":
      return tryHuggingFace(prompt, width, height)
    case "pollinations":
      return tryPollinations(prompt, width, height)
  }
}

function getProviderOrder(provider: ProviderId): Exclude<ProviderId, "auto">[] {
  if (provider === "auto") {
    return ["together", "huggingface", "pollinations"]
  }

  return [provider]
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────
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
  const customPrompt = String(body?.customPrompt || "").trim()
  const source = String(body?.source || "manual")
  const topic = body?.topic ?? null
  const educationalContext = body?.educationalContext ? String(body.educationalContext) : undefined

  if (!prompt) return new Response("Prompt requerido", { status: 400 })

  try {
    const optimizedPrompt = customPrompt || (await optimizePromptWithGemini(prompt, style, educationalContext))
    console.log("[Image] Prompt optimizado:", optimizedPrompt.slice(0, 150))

    const providerOrder = getProviderOrder(provider)
    const providerErrors: string[] = []

    let imageBase64: string | null = null
    let usedProvider = ""

    for (const currentProvider of providerOrder) {
      console.log(`[Image] Intentando provider: ${currentProvider}`)

      const result = await runProvider(currentProvider, optimizedPrompt, width, height)

      if (result.imageBase64) {
        imageBase64 = result.imageBase64
        usedProvider = result.label
        break
      }

      providerErrors.push(`${result.label}: ${result.error || "falló sin detalle"}`)
    }

    if (!imageBase64) {
      const message =
        "No se pudo generar la imagen.\n\n" +
        providerErrors.map((line, index) => `${index + 1}. ${line}`).join("\n")

      return new Response(message, { status: 503 })
    }

    // Guardar en galería (async, no bloquea la respuesta)
    void (async () => {
      try {
        const { error } = await supabase.from("generated_images").insert({
          user_id: user.id,
          prompt,
          optimized_prompt: optimizedPrompt,
          image_url: imageBase64,
          provider: usedProvider,
          style,
          width,
          height,
          source,
          topic,
        })

        if (error) {
          console.error("[Image] Error guardando en generated_images:", error.message)
        }
      } catch (error) {
        console.error("[Image] Error inesperado guardando imagen:", getErrorMessage(error))
      }
    })()

    return Response.json({
      imageUrl: imageBase64,
      optimizedPrompt,
      provider: usedProvider,
      type: "base64",
    })
  } catch (error) {
    const message = getErrorMessage(error)
    console.error("[Image] Error general:", message)
    return new Response(`Error: ${message}`, { status: 500 })
  }
}
