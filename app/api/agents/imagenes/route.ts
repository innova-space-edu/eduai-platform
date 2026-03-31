// app/api/agents/imagenes/route.ts
// v7 — Gemini modelo correcto + Supabase Storage para galería + cadena estable

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

const STYLE_GUIDES: Record<string, string> = {
  realistic:      "photorealistic, DSLR photo, 85mm lens, sharp focus, natural lighting, ultra detailed, 8k resolution",
  "digital art":  "digital painting, concept art, artstation trending, vibrant colors, detailed illustration, professional quality",
  "oil painting": "oil on canvas, impressionist brushstrokes, museum quality, rich textures, classical fine art painting",
  anime:          "anime style, Studio Ghibli inspired, detailed linework, vibrant colors, manga illustration, clean lines",
  watercolor:     "watercolor painting, soft edges, transparent washes, artistic, delicate details, paper texture visible",
  "3d render":    "3D render, octane render, cinema4d, ray tracing, photorealistic 3D, subsurface scattering, volumetric light",
  sketch:         "pencil sketch, detailed linework, graphite drawing, cross-hatching, artistic sketch, white background",
  cinematic:      "cinematic photography, movie still, dramatic lighting, anamorphic lens, epic composition, shallow depth of field",
  educational:    "educational diagram, clean illustration, labeled, informative, white background, professional, colorful, pedagogical",
  "flat design":  "flat design illustration, minimal, geometric shapes, bold colors, modern vector art, icon style",
  infographic:    "infographic style, data visualization, clean design, informative, colorful sections, professional design",
}

type ProviderId = "auto" | "gemini" | "pollinations" | "together" | "huggingface" | "openrouter"
type GenerationMode = "fast" | "quality" | "educational"
type ProviderResult = { imageBase64: string | null; label: string; model?: string; error?: string }

function clamp(v: number, min: number, max: number, fb: number) {
  return !Number.isFinite(v) ? fb : Math.max(min, Math.min(max, Math.round(v)))
}
function errMsg(e: unknown) { return e instanceof Error ? e.message : String(e) }
async function safeText(res: Response) { try { return await res.text() } catch { return "" } }
function basicPrompt(p: string, style: string) {
  return `${p}, ${STYLE_GUIDES[style] || STYLE_GUIDES.realistic}, highly detailed, masterpiece, best quality`
}
function aspectRatio(w: number, h: number) {
  const r = w / h
  if (Math.abs(r - 1) < 0.05)      return "1:1"
  if (Math.abs(r - 16/9) < 0.15)   return "16:9"
  if (Math.abs(r - 9/16) < 0.15)   return "9:16"
  if (Math.abs(r - 4/3) < 0.15)    return "4:3"
  if (Math.abs(r - 3/4) < 0.15)    return "3:4"
  if (Math.abs(r - 3/2) < 0.15)    return "3:2"
  if (Math.abs(r - 2/3) < 0.15)    return "2:3"
  return r >= 1 ? "16:9" : "9:16"
}
async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "EduAI/1.0" }, signal: AbortSignal.timeout(35000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    if (!buf.byteLength) return null
    const mime = res.headers.get("content-type") || "image/png"
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`
  } catch { return null }
}

// ── Subir imagen a Supabase Storage ─────────────────────────────────────────
async function uploadToStorage(imageBase64: string, userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  try {
    const admin    = createAdmin(url, key)
    const match    = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) return null
    const mime     = match[1]
    const ext      = mime.split("/")[1] || "png"
    const b64data  = match[2]
    const buf      = Buffer.from(b64data, "base64")
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await admin.storage.from("generated-images").upload(fileName, buf, {
      contentType: mime, upsert: false,
    })

    if (error) {
      console.warn("[Image][Storage] upload error:", error.message)
      return null
    }

    const { data } = admin.storage.from("generated-images").getPublicUrl(fileName)
    return data?.publicUrl || null
  } catch (e) {
    console.error("[Image][Storage]", errMsg(e))
    return null
  }
}

// ── Optimizador de prompt ────────────────────────────────────────────────────
async function optimizePrompt(userPrompt: string, style: string, educationalCtx?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return basicPrompt(userPrompt, style)

  const styleDesc = STYLE_GUIDES[style] || STYLE_GUIDES.realistic
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
RULES: Keep the exact subject. Add lighting, composition, colors, style keywords.
For educational context ensure scientific/anatomical accuracy.
Output ONLY the prompt — no explanations, no quotes.`
          }] },
          contents: [{ parts: [{ text:
            `Request: "${userPrompt}"\nStyle: ${style} — ${styleDesc}\n${educationalCtx ? `Context: "${educationalCtx.slice(0,500)}"` : ""}\nOptimized prompt:`
          }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 500 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return basicPrompt(userPrompt, style)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (text) return text.replace(/^[\"']|[\"']$/g, "")
  } catch {}
  return basicPrompt(userPrompt, style)
}

// ── PROVEEDOR 1: Gemini Imagen (GRATIS) ──────────────────────────────────────
async function tryGemini(prompt: string): Promise<ProviderResult> {
  const label  = "Gemini Imagen"
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { imageBase64: null, label, error: "GEMINI_API_KEY no configurada" }

  // Intentar modelos en orden — el nombre exacto varía según despliegue
  const models = [
    "gemini-2.0-flash-exp-image-generation",
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-exp",
  ]

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
          signal: AbortSignal.timeout(45000),
        }
      )

      if (!res.ok) {
        const body = await safeText(res)
        console.warn(`[Gemini][${model}] HTTP ${res.status}: ${body.slice(0, 120)}`)
        continue
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
      console.warn(`[Gemini][${model}] No image in response`)
    } catch (e) {
      console.warn(`[Gemini][${model}]`, errMsg(e))
    }
  }

  return { imageBase64: null, label, error: "Gemini no generó imagen (todos los modelos fallaron)" }
}

// ── PROVEEDOR 2: Pollinations (con key → autenticado; sin key → free) ─────────
async function tryPollinations(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const label  = "Pollinations"
  const apiKey = process.env.POLLINATIONS_API_KEY
  const safeW  = clamp(width, 256, 1920, 1024)
  const safeH  = clamp(height, 256, 1920, 768)
  const models = ["flux", "flux-realism", "turbo"]

  for (const m of models) {
    try {
      const seed      = Math.floor(Math.random() * 999999)
      const encoded   = encodeURIComponent(prompt)
      const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" }

      let url: string
      if (apiKey) {
        url = `https://gen.pollinations.ai/image/${encoded}?model=${m}&width=${safeW}&height=${safeH}&seed=${seed}&nologo=true&enhance=true`
        headers["Authorization"] = `Bearer ${apiKey}`
      } else {
        url = `https://image.pollinations.ai/prompt/${encoded}?model=${m}&width=${safeW}&height=${safeH}&seed=${seed}&nologo=true&enhance=true&safe=false`
      }

      const res = await fetch(url, { headers, signal: AbortSignal.timeout(55000) })

      if (!res.ok) { console.warn(`[Pollinations][${m}] HTTP ${res.status}`); continue }

      const ct = res.headers.get("content-type") || ""
      if (!ct.startsWith("image/")) { console.warn(`[Pollinations][${m}] content-type: ${ct}`); continue }

      const buf = await res.arrayBuffer()
      if (!buf.byteLength) continue

      return {
        imageBase64: `data:${ct};base64,${Buffer.from(buf).toString("base64")}`,
        label, model: m,
      }
    } catch (e) {
      console.warn(`[Pollinations][${m}]`, errMsg(e))
    }
  }

  return { imageBase64: null, label, error: "Todos los modelos de Pollinations fallaron" }
}

// ── PROVEEDOR 3: Together AI (FLUX) ──────────────────────────────────────────
async function tryTogether(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const key   = process.env.TOGETHER_API_KEY
  const label = "Together AI"
  if (!key) return { imageBase64: null, label, error: "TOGETHER_API_KEY no configurada" }

  const models = [
    { id: "black-forest-labs/FLUX.1-schnell-Free", steps: 4, guidance: 0 },
    { id: "black-forest-labs/FLUX.1-schnell",      steps: 4, guidance: 0 },
    { id: "black-forest-labs/FLUX.1-dev",          steps: 20, guidance: 3.5 },
  ]

  for (const { id, steps, guidance } of models) {
    try {
      const res = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: id,
          prompt,
          width:  clamp(width, 256, 1440, 1024),
          height: clamp(height, 256, 1440, 768),
          steps, n: 1,
          response_format: "base64",
        }),
        signal: AbortSignal.timeout(50000),
      })

      if (!res.ok) { console.warn(`[Together][${id}] HTTP ${res.status}`); continue }

      const data   = await res.json()
      const base64 = data?.data?.[0]?.b64_json || data?.data?.[0]?.base64
      if (base64) return { imageBase64: `data:image/png;base64,${base64}`, label, model: id }

      const imgUrl = data?.data?.[0]?.url
      if (imgUrl) {
        const converted = await fetchBase64(imgUrl)
        if (converted) return { imageBase64: converted, label, model: id }
      }
    } catch (e) {
      console.warn(`[Together][${id}]`, errMsg(e))
    }
  }

  return { imageBase64: null, label, error: "Together AI: todos los modelos fallaron" }
}

// ── PROVEEDOR 4: Hugging Face (FLUX schnell — como último recurso) ────────────
async function tryHuggingFace(prompt: string, width: number, height: number): Promise<ProviderResult> {
  const label  = "Hugging Face"
  const tokens = [process.env.HF_TOKEN_1, process.env.HF_TOKEN_2, process.env.HF_TOKEN_3].filter(Boolean) as string[]
  if (!tokens.length) return { imageBase64: null, label, error: "No hay HF_TOKEN configurados" }

  const models = [
    { id: "black-forest-labs/FLUX.1-schnell", steps: 4, guidance: 0 },
    { id: "stabilityai/stable-diffusion-xl-base-1.0", steps: 25, guidance: 7.5 },
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
              negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, deformed",
              width:  clamp(width, 256, 1024, 1024),
              height: clamp(height, 256, 1024, 768),
              num_inference_steps: steps,
              guidance_scale: guidance,
            },
          }),
          signal: AbortSignal.timeout(60000),
        })
        if (!res.ok) { console.warn(`[HF][${id}] HTTP ${res.status}`); continue }
        const ct = res.headers.get("content-type") || ""
        if (ct.includes("application/json")) continue
        const buf = await res.arrayBuffer()
        if (!buf.byteLength) continue
        return { imageBase64: `data:${ct || "image/png"};base64,${Buffer.from(buf).toString("base64")}`, label, model: id }
      } catch (e) {
        console.warn(`[HF][${id}]`, errMsg(e))
      }
    }
  }
  return { imageBase64: null, label, error: "HF: todos los intentos fallaron" }
}

// ── PROVEEDOR 5: OpenRouter (sólo cuando se pide explícitamente) ───────────────
async function tryOpenRouter(prompt: string, width: number, height: number, mode: GenerationMode): Promise<ProviderResult> {
  const key   = process.env.OPENROUTER_API_KEY
  const label = "OpenRouter"
  // Modelos gratuitos / bajo costo que soportan imagen
  const modelMap: Record<GenerationMode, string> = {
    fast:        process.env.OPENROUTER_IMAGE_MODEL_FAST    || "black-forest-labs/FLUX-1.1-pro",
    quality:     process.env.OPENROUTER_IMAGE_MODEL_QUALITY || "black-forest-labs/FLUX-1.1-pro-ultra",
    educational: process.env.OPENROUTER_IMAGE_MODEL_EDU     || "black-forest-labs/FLUX-1.1-pro",
  }
  const model = modelMap[mode]
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
        image_config: { aspect_ratio: aspectRatio(width, height) },
      }),
      signal: AbortSignal.timeout(55000),
    })

    if (!res.ok) {
      const body = await safeText(res)
      return { imageBase64: null, label, model, error: `HTTP ${res.status}: ${body.slice(0,200)}` }
    }

    const data    = await res.json()
    const message = data?.choices?.[0]?.message
    const images  = Array.isArray(message?.images) ? message.images : []
    const dataUrl = images[0]?.image_url?.url || images[0]?.url || null

    if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/"))
      return { imageBase64: dataUrl, label, model }

    if (typeof dataUrl === "string" && /^https?:\/\//.test(dataUrl)) {
      const conv = await fetchBase64(dataUrl)
      if (conv) return { imageBase64: conv, label, model }
    }

    return { imageBase64: null, label, model, error: "OpenRouter no devolvió imagen" }
  } catch (e) {
    return { imageBase64: null, label, model, error: errMsg(e) }
  }
}

// ── Ejecutor de proveedor ─────────────────────────────────────────────────────
async function runProvider(
  id: Exclude<ProviderId, "auto">,
  prompt: string, width: number, height: number, mode: GenerationMode
): Promise<ProviderResult> {
  switch (id) {
    case "gemini":       return tryGemini(prompt)
    case "pollinations": return tryPollinations(prompt, width, height)
    case "together":     return tryTogether(prompt, width, height)
    case "huggingface":  return tryHuggingFace(prompt, width, height)
    case "openrouter":   return tryOpenRouter(prompt, width, height, mode)
  }
}

// Auto: gratuitos primero — OpenRouter y HF sólo cuando se piden directamente
function providerOrder(provider: ProviderId): Exclude<ProviderId, "auto">[] {
  if (provider !== "auto") return [provider]
  return ["gemini", "pollinations", "together"]
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const body              = await req.json()
  const prompt            = String(body?.prompt || "").trim()
  const style             = String(body?.style || "realistic")
  const width             = clamp(Number(body?.width),  256, 1920, 1024)
  const height            = clamp(Number(body?.height), 256, 1920, 768)
  const provider          = (body?.provider || "auto") as ProviderId
  const mode              = (body?.mode || "fast") as GenerationMode
  const customPrompt      = String(body?.customPrompt || "").trim()
  const source            = String(body?.source || "manual")
  const topic             = body?.topic ?? null
  const eduCtx            = body?.educationalContext ? String(body.educationalContext) : undefined

  if (!prompt) return new Response("Prompt requerido", { status: 400 })

  try {
    const optimizedPrompt = customPrompt || await optimizePrompt(prompt, style, eduCtx)
    const order           = providerOrder(provider)
    const errors: string[]= []
    let imageBase64: string | null = null
    let usedProvider = ""
    let usedModel    = ""

    for (const p of order) {
      console.log(`[Image] Intentando: ${p}`)
      const res = await runProvider(p, optimizedPrompt, width, height, mode)
      if (res.imageBase64) {
        imageBase64  = res.imageBase64
        usedProvider = res.label
        usedModel    = res.model || ""
        break
      }
      errors.push(`${res.label}${res.model ? ` (${res.model})` : ""}: ${res.error || "falló"}`)
    }

    if (!imageBase64) {
      return new Response(
        "No se pudo generar la imagen.\n\n" + errors.map((l, i) => `${i + 1}. ${l}`).join("\n"),
        { status: 503 }
      )
    }

    // ── Guardar imagen: Storage primero, fallback a DB directa ──────────────
    void (async () => {
      try {
        // Intentar subir a Supabase Storage
        const publicUrl = await uploadToStorage(imageBase64!, user.id)
        const urlToStore = publicUrl ?? imageBase64!

        const { error } = await supabase.from("generated_images").insert({
          user_id: user.id,
          prompt,
          optimized_prompt: optimizedPrompt,
          image_url: urlToStore,
          provider: usedModel ? `${usedProvider} · ${usedModel}` : usedProvider,
          style, width, height, source, topic,
        })

        if (error) console.error("[Image][DB]", error.message)
      } catch (e) {
        console.error("[Image][Save]", errMsg(e))
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
  } catch (e) {
    return new Response(`Error: ${errMsg(e)}`, { status: 500 })
  }
}
