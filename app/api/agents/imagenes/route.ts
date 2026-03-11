// src/app/api/agents/imagenes/route.ts
// v3 — Gemini 2.5 Flash-Lite para optimizar prompts + Pollinations como nuevo fallback gratuito

import { createClient } from "@/lib/supabase/server"

// ── ESTILOS ──────────────────────────────────────────────
const STYLE_GUIDES: Record<string, string> = {
  "realistic":    "photorealistic, DSLR photo, 85mm lens, sharp focus, natural lighting, ultra detailed, 8k",
  "digital art":  "digital painting, concept art, artstation trending, vibrant colors, detailed illustration, professional",
  "oil painting": "oil on canvas, impressionist brushstrokes, museum quality, rich textures, classical painting",
  "anime":        "anime style, Studio Ghibli inspired, detailed linework, vibrant colors, manga illustration, clean",
  "watercolor":   "watercolor painting, soft edges, transparent washes, artistic, delicate details, paper texture",
  "3d render":    "3D render, octane render, cinema4d, ray tracing, photorealistic 3D, subsurface scattering",
  "sketch":       "pencil sketch, detailed linework, graphite drawing, cross-hatching, artistic sketch, white background",
  "cinematic":    "cinematic photography, movie still, dramatic lighting, anamorphic lens, epic composition, bokeh",
  "educational":  "educational diagram, clean illustration, labeled, informative, white background, professional, colorful",
  "flat design":  "flat design illustration, minimal, geometric shapes, bold colors, modern, icon style",
  "infographic":  "infographic style, data visualization, clean, informative, colorful sections, professional design",
}

// ── OPTIMIZAR PROMPT con Gemini 2.5 Flash-Lite ──────────
async function optimizePromptWithGemini(
  userPrompt: string,
  style: string,
  educationalContext?: string
): Promise<string> {
  const styleDesc = STYLE_GUIDES[style] || STYLE_GUIDES["realistic"]
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

    if (res.ok) {
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (text) return text.replace(/^["']|["']$/g, "")
    }
  } catch (e: any) {
    console.warn("[ImageOptimizer] Gemini 2.5 Flash-Lite falló:", e.message)
  }

  // Fallback: construir prompt básico
  return buildBasicPrompt(userPrompt, styleDesc)
}

function buildBasicPrompt(userPrompt: string, styleDesc: string): string {
  return `${userPrompt}, ${styleDesc}, highly detailed, masterpiece, best quality`
}

// ── PROVIDERS DE GENERACIÓN ───────────────────────────────

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    const mime = res.headers.get("content-type") || "image/jpeg"
    return `data:${mime};base64,${base64}`
  } catch { return null }
}

// Provider 1: Together AI — FLUX Schnell (gratis con API key)
async function tryTogether(prompt: string, width: number, height: number): Promise<string | null> {
  const key = process.env.TOGETHER_API_KEY
  if (!key) return null
  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt,
        width: Math.min(width, 1024),
        height: Math.min(height, 1024),
        steps: 4,
        n: 1,
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const imageUrl = data.data?.[0]?.url
    if (!imageUrl) return null
    return await fetchAsBase64(imageUrl)
  } catch (e: any) {
    console.warn("[Together] falló:", e.message)
    return null
  }
}

// Provider 2: Pollinations AI — FLUX gratuito, sin API key
async function tryPollinations(prompt: string, width: number, height: number): Promise<string | null> {
  try {
    const encodedPrompt = encodeURIComponent(prompt)
    const seed = Math.floor(Math.random() * 999999)
    // Pollinations soporta FLUX con parámetros de resolución
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${Math.min(width, 1024)}&height=${Math.min(height, 1024)}&seed=${seed}&nologo=true&enhance=true`

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" },
      signal: AbortSignal.timeout(35000),
    })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    if (!buffer.byteLength) return null
    const base64 = Buffer.from(buffer).toString("base64")
    const mime = res.headers.get("content-type") || "image/jpeg"
    return `data:${mime};base64,${base64}`
  } catch (e: any) {
    console.warn("[Pollinations] falló:", e.message)
    return null
  }
}

// Provider 3: HuggingFace — SDXL (con token HF)
async function tryHuggingFace(prompt: string, width: number, height: number): Promise<string | null> {
  const tokens = [process.env.HF_TOKEN_1, process.env.HF_TOKEN_2, process.env.HF_TOKEN_3].filter(Boolean) as string[]
  if (!tokens.length) return null

  const models = [
    "stabilityai/stable-diffusion-xl-base-1.0",
    "runwayml/stable-diffusion-v1-5",
  ]
  const negative = "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, nsfw, wrong subject, deformed"

  for (const model of models) {
    for (const token of tokens) {
      try {
        const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              negative_prompt: negative,
              width: Math.min(width, 768),
              height: Math.min(height, 768),
              num_inference_steps: 30,
              guidance_scale: 7.5,
            },
          }),
          signal: AbortSignal.timeout(30000),
        })
        if (!res.ok) continue
        const arrayBuffer = await res.arrayBuffer()
        if (!arrayBuffer.byteLength) continue
        const base64 = Buffer.from(arrayBuffer).toString("base64")
        const mime = res.headers.get("content-type") || "image/jpeg"
        return `data:${mime};base64,${base64}`
      } catch { continue }
    }
  }
  return null
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const {
    prompt,
    style = "realistic",
    width = 1024,
    height = 768,
    provider = "auto",
    customPrompt,
    source = "manual",
    topic = null,
    educationalContext,   // nuevo: contexto educativo para mejorar la precisión
  } = await req.json()

  if (!prompt?.trim()) return new Response("Prompt requerido", { status: 400 })

  try {
    // Optimizar prompt con Gemini 2.5 Flash-Lite
    const optimizedPrompt = customPrompt?.trim()
      ? customPrompt.trim()
      : await optimizePromptWithGemini(prompt, style, educationalContext)

    console.log("[Image] Prompt optimizado:", optimizedPrompt.substring(0, 100))

    let imageBase64: string | null = null
    let usedProvider = ""

    // Orden de prioridad: Together → Pollinations → HuggingFace
    if (provider === "together" || provider === "auto") {
      imageBase64 = await tryTogether(optimizedPrompt, width, height)
      if (imageBase64) usedProvider = "Together AI (FLUX Schnell)"
    }

    if (!imageBase64 && (provider === "pollinations" || provider === "auto")) {
      console.log("[Image] Intentando Pollinations...")
      imageBase64 = await tryPollinations(optimizedPrompt, width, height)
      if (imageBase64) usedProvider = "Pollinations (FLUX)"
    }

    if (!imageBase64 && (provider === "huggingface" || provider === "auto")) {
      console.log("[Image] Intentando HuggingFace...")
      imageBase64 = await tryHuggingFace(optimizedPrompt, width, height)
      if (imageBase64) usedProvider = "Hugging Face (Stable Diffusion XL)"
    }

    if (!imageBase64) {
      return new Response(
        "No se pudo generar la imagen. Intenta con otro estilo o verifica las API keys.",
        { status: 503 }
      )
    }

    // Guardar en galería (async, no bloquea la respuesta)
    void (async () => {
      try {
        await supabase.from("generated_images").insert({
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
      } catch {}
    })()

    return Response.json({
      imageUrl: imageBase64,
      optimizedPrompt,
      provider: usedProvider,
      type: "base64",
    })
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 })
  }
}
