// app/api/agents/imagenes/route.ts — fixed for current lib/image-config.ts

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import {
  HUGGINGFACE_IMAGE_MODELS,
  OPENROUTER_IMAGE_MODELS,
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

type HuggingFaceModel = {
  id: string
  steps: number
  guidance: number
  supportsNegative?: boolean
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

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EduAI/1.0" },
      signal: AbortSignal.timeout(35000),
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    if (!buf.byteLength) return null
    const mime = res.headers.get("content-type") || "image/png"
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`
  } catch {
    return null
  }
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
  } catch (e) {
    console.error("[Image][Storage]", errMsg(e))
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
    ? `IMPORTANT — The user explicitly requested this framing: "${userComposition}". RESPECT IT. Do NOT override with close-up or face framing.`
    : isPortrait
      ? "Default to close-up portrait framing unless the user specified otherwise."
      : "Include a composition note matching the content (rule of thirds, centered, wide shot, etc.)."

  const systemInstruction = isPortrait
    ? `You are an expert FLUX.2 prompt engineer specializing in photorealistic photography.
Transform the user description into a highly detailed structured English prompt.
STRUCTURE: [Subject with detailed physical description] + [Camera: specific model + lens + aperture] + [Lighting: specific type and direction] + [Composition/Framing] + [Quality keywords]

RULES:
- Always specify: exact camera model (Sony A7R V, Canon R5, etc.), lens mm, aperture
- Specify lighting: "Rembrandt lighting", "soft diffused window light", "golden hour side light", "studio three-point lighting"
- Add skin/detail quality: "natural skin texture with visible pores", "sharp detailed eyes with natural catchlights", "detailed hair strands"
- ${compositionNote}
- End with: "photorealistic, 8K, masterpiece, best quality, highly detailed"
- DO NOT add any NSFW content
- Output ONLY the optimized English prompt, no explanations, no quotes`
    : `You are an expert FLUX.2 prompt engineer for AI image generation.
Transform the user description into a highly detailed structured English prompt.
STRUCTURE: [Main subject with vivid details] + [Style: ${styleDesc}] + [Lighting and atmosphere] + [Composition] + [Quality]

RULES:
- Keep the exact subject intent
- Add specific visual details, color palette, lighting, mood
- ${compositionNote}
- End with quality keywords matching the style
- Output ONLY the optimized English prompt, no explanations, no quotes`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        signal: AbortSignal.timeout(12000),
      }
    )

    if (!res.ok) return basicPrompt(userPrompt, style)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) return basicPrompt(userPrompt, style)
    return text.replace(/^["']|["']$/g, "")
  } catch {
    return basicPrompt(userPrompt, style)
  }
}

async function tryGemini(prompt: string): Promise<ProviderResult> {
  const label = "Gemini Imagen"
  const apiKey = pickFromPool(getGeminiImageKeys(), prompt)
  if (!apiKey) return { imageBase64: null, label, error: "No Gemini key" }

  for (const model of GEMINI_IMAGE_MODELS) {
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
        console.warn(`[Gemini][${model}] ${res.status}`)
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
    } catch (e) {
      console.warn(`[Gemini][${model}]`, errMsg(e))
    }
  }

  return { imageBase64: null, label, error: "Gemini no generó imagen" }
}

async function tryPollinations(
  prompt: string,
  width: number,
  height: number
): Promise<ProviderResult> {
  const label = "Pollinations"
  const apiKey = process.env.POLLINATIONS_API_KEY
  const safeW = clamp(width, 256, 1920, 1024)
  const safeH = clamp(height, 256, 1920, 768)

  for (const model of ["flux", "flux-realism", "turbo"]) {
    try {
      const seed = Math.floor(Math.random() * 999999)
      const encoded = encodeURIComponent(prompt)
      const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" }
      let url: string

      if (apiKey) {
        url = `https://gen.pollinations.ai/image/${encoded}?model=${model}&width=${safeW}&height=${safeH}&seed=${seed}&nologo=true&enhance=true`
        headers.Authorization = `Bearer ${apiKey}`
      } else {
        url = `https://image.pollinations.ai/prompt/${encoded}?model=${model}&width=${safeW}&height=${safeH}&seed=${seed}&nologo=true&enhance=true&safe=false`
      }

      const res = await fetch(url, { headers, signal: AbortSignal.timeout(55000) })
      if (!res.ok) {
        console.warn(`[Pollinations][${model}] ${res.status}`)
        continue
      }

      const contentType = res.headers.get("content-type") || ""
      if (!contentType.startsWith("image/")) continue

      const buf = await res.arrayBuffer()
      if (!buf.byteLength) continue

      return {
        imageBase64: `data:${contentType};base64,${Buffer.from(buf).toString("base64")}`,
        label,
        model,
      }
    } catch (e) {
      console.warn(`[Pollinations][${model}]`, errMsg(e))
    }
  }

  return { imageBase64: null, label, error: "Pollinations: todos los modelos fallaron" }
}

async function tryTogether(
  prompt: string,
  width: number,
  height: number
): Promise<ProviderResult> {
  const label = "Together AI"
  const key = pickFromPool(getTogetherKeys(), prompt)
  if (!key) return { imageBase64: null, label, error: "No Together key" }

  for (const { id, steps, guidance, useAspectRatio } of TOGETHER_IMAGE_MODELS) {
    try {
      const sizeParams = useAspectRatio
        ? { aspect_ratio: aspectRatio(width, height) }
        : { width: clamp(width, 256, 1440, 1024), height: clamp(height, 256, 1440, 768) }

      const res = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: id,
          prompt,
          ...sizeParams,
          steps,
          n: 1,
          guidance,
          response_format: "base64",
        }),
        signal: AbortSignal.timeout(55000),
      })

      if (!res.ok) {
        console.warn(`[Together][${id}] ${res.status}: ${(await safeText(res)).slice(0, 120)}`)
        continue
      }

      const data = await res.json()
      const base64 = data?.data?.[0]?.b64_json || data?.data?.[0]?.base64
      if (base64) {
        return { imageBase64: `data:image/png;base64,${base64}`, label, model: id }
      }

      const imageUrl = data?.data?.[0]?.url
      if (imageUrl) {
        const converted = await fetchBase64(imageUrl)
        if (converted) return { imageBase64: converted, label, model: id }
      }
    } catch (e) {
      console.warn(`[Together][${id}]`, errMsg(e))
    }
  }

  return { imageBase64: null, label, error: "Together: todos los modelos fallaron" }
}

async function tryHuggingFace(
  prompt: string,
  width: number,
  height: number,
  style: string
): Promise<ProviderResult> {
  const label = "Hugging Face"
  const tokens = getHuggingFaceTokens()
  if (!tokens.length) return { imageBase64: null, label, error: "No HF tokens" }

  const negativePrompt = getNegativePrompt(style)

  for (const hfModel of HUGGINGFACE_IMAGE_MODELS as HuggingFaceModel[]) {
    const { id, steps, guidance, supportsNegative } = hfModel
    for (const token of tokens) {
      try {
        const params = {
          negative_prompt: supportsNegative ? negativePrompt : undefined,
          width: clamp(width, 256, 1024, 1024),
          height: clamp(height, 256, 1024, 768),
          num_inference_steps: steps,
          guidance_scale: guidance,
        }

        const res = await fetch(`https://router.huggingface.co/hf-inference/models/${id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: prompt, parameters: params }),
          signal: AbortSignal.timeout(60000),
        })

        if (!res.ok) {
          console.warn(`[HF][${id}] ${res.status}`)
          continue
        }

        const contentType = res.headers.get("content-type") || ""
        if (contentType.includes("application/json")) continue

        const buf = await res.arrayBuffer()
        if (!buf.byteLength) continue

        return {
          imageBase64: `data:${contentType || "image/png"};base64,${Buffer.from(buf).toString("base64")}`,
          label,
          model: id,
        }
      } catch (e) {
        console.warn(`[HF][${id}]`, errMsg(e))
      }
    }
  }

  return { imageBase64: null, label, error: "HF: todos los intentos fallaron" }
}

async function tryOpenRouter(
  prompt: string,
  width: number,
  height: number
): Promise<ProviderResult> {
  const label = "OpenRouter"
  const key = pickFromPool(getOpenRouterKeys(), prompt)
  if (!key) return { imageBase64: null, label, error: "No OpenRouter key" }

  const ar = aspectRatio(width, height)

  for (const { id, modalities } of OPENROUTER_IMAGE_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://eduai.local",
          "X-Title": process.env.OPENROUTER_APP_TITLE || "EduAI Image Studio",
        },
        body: JSON.stringify({
          model: id,
          messages: [{ role: "user", content: prompt }],
          modalities,
          stream: false,
          image_config: { aspect_ratio: ar },
        }),
        signal: AbortSignal.timeout(65000),
      })

      if (!res.ok) {
        console.warn(`[OpenRouter][${id}] ${res.status}`)
        continue
      }

      const data = await res.json()
      const message = data?.choices?.[0]?.message

      const images = Array.isArray(message?.images) ? message.images : []
      const imgEntry = images[0]
      const urlA: string | null = imgEntry?.image_url?.url || imgEntry?.url || null
      if (urlA) {
        if (urlA.startsWith("data:image/")) return { imageBase64: urlA, label, model: id }
        if (/^https?:\/\//.test(urlA)) {
          const converted = await fetchBase64(urlA)
          if (converted) return { imageBase64: converted, label, model: id }
        }
      }

      const parts: unknown[] = Array.isArray(message?.content) ? message.content : []
      for (const part of parts) {
        const p = part as Record<string, unknown>
        if (p?.type === "image_url") {
          const u = (p?.image_url as Record<string, string> | undefined)?.url
          if (u?.startsWith("data:image/")) return { imageBase64: u, label, model: id }
          if (u && /^https?:\/\//.test(u)) {
            const converted = await fetchBase64(u)
            if (converted) return { imageBase64: converted, label, model: id }
          }
        }
      }

      console.warn(`[OpenRouter][${id}] respuesta OK sin imagen`)
    } catch (e) {
      console.warn(`[OpenRouter][${id}]`, errMsg(e))
    }
  }

  return { imageBase64: null, label, error: "OpenRouter: todos los modelos fallaron" }
}

async function runProvider(
  id: Exclude<ProviderId, "auto">,
  prompt: string,
  width: number,
  height: number,
  style: string
): Promise<ProviderResult> {
  switch (id) {
    case "gemini":
      return tryGemini(prompt)
    case "pollinations":
      return tryPollinations(prompt, width, height)
    case "together":
      return tryTogether(prompt, width, height)
    case "huggingface":
      return tryHuggingFace(prompt, width, height, style)
    case "openrouter":
      return tryOpenRouter(prompt, width, height)
  }
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
  const width = clamp(Number(body?.width), 256, 1920, 1024)
  const height = clamp(Number(body?.height), 256, 1920, 768)
  const provider = (body?.provider || "auto") as ProviderId
  const mode = (body?.mode || "fast") as GenerationMode
  const customPrompt = String(body?.customPrompt || "").trim()
  const source = String(body?.source || "manual")
  const topic = body?.topic ?? null
  const educationalContext = body?.educationalContext ? String(body.educationalContext) : undefined

  if (!prompt) return new Response("Prompt requerido", { status: 400 })

  try {
    const promptWasOptimized = !customPrompt && shouldOptimizePrompt(mode, customPrompt)
    const optimizedPrompt = customPrompt
      ? customPrompt
      : promptWasOptimized
        ? await optimizePrompt(prompt, style, educationalContext)
        : basicPrompt(prompt, style)

    const order = providerOrder(provider, mode)
    const errors: string[] = []
    let imageBase64: string | null = null
    let usedProvider = ""
    let usedModel = ""

    for (const p of order) {
      console.log(`[Image] Intentando: ${p}`)
      const result = await runProvider(p, optimizedPrompt, width, height, style)
      if (result.imageBase64) {
        imageBase64 = result.imageBase64
        usedProvider = result.label
        usedModel = result.model || ""
        break
      }
      errors.push(`${result.label}${result.model ? ` (${result.model})` : ""}: ${result.error || "falló"}`)
    }

    if (!imageBase64) {
      return new Response(
        "No se pudo generar la imagen.\n\n" + errors.map((line, index) => `${index + 1}. ${line}`).join("\n"),
        { status: 503 }
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
      providerOrder: order,
      promptOptimized: promptWasOptimized,
    })
  } catch (e) {
    return new Response(`Error: ${errMsg(e)}`, { status: 500 })
  }
}
