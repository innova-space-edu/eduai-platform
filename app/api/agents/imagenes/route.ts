// app/api/agents/imagenes/route.ts
// v9 — FLUX.2 en Together, cadena de modelos OpenRouter 2026, Gemini via OR

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import {
  HUGGINGFACE_IMAGE_MODELS,
  OPENROUTER_IMAGE_MODELS,
  TOGETHER_IMAGE_MODELS,
  GenerationMode,
  ProviderId,
  ProviderResult,
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
    const b64data = match[2]
    const buf = Buffer.from(b64data, "base64")
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await admin.storage.from("generated-images").upload(fileName, buf, {
      contentType: mime,
      upsert: false,
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

async function optimizePrompt(
  userPrompt: string,
  style: string,
  educationalCtx?: string
): Promise<string> {
  const optimizerKeys = getPromptOptimizerKeys()
  const apiKey = pickFromPool(optimizerKeys, `${userPrompt}:${style}:${educationalCtx || ""}`)

  if (!apiKey) return basicPrompt(userPrompt, style)

  const styleDesc = STYLE_GUIDES[style] || STYLE_GUIDES.realistic

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: `You are an expert prompt engineer for AI image generation (FLUX, Stable Diffusion, Imagen).
Transform user descriptions into highly detailed, vivid English prompts.
RULES:
- Keep the exact subject.
- Add composition, lighting, color, visual fidelity and artistic keywords.
- If the context is educational, preserve scientific/anatomical accuracy.
- Output ONLY the final optimized prompt, with no explanations and no quotes.`,
              },
            ],
          },
          contents: [
            {
              parts: [
                {
                  text: `Request: "${userPrompt}"
Style: ${style} — ${styleDesc}
${educationalCtx ? `Context: "${educationalCtx.slice(0, 500)}"` : ""}
Optimized prompt:`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 500,
          },
        }),
        signal: AbortSignal.timeout(12000),
      }
    )

    if (!res.ok) return basicPrompt(userPrompt, style)

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) return basicPrompt(userPrompt, style)

    return text.replace(/^[\"']|[\"']$/g, "")
  } catch {
    return basicPrompt(userPrompt, style)
  }
}

async function tryGemini(prompt: string): Promise<ProviderResult> {
  const label = "Gemini Imagen"
  const keys = getGeminiImageKeys()
  const apiKey = pickFromPool(keys, prompt)

  if (!apiKey) {
    return { imageBase64: null, label, error: "No hay key de Gemini Image configurada" }
  }

  for (const model of GEMINI_IMAGE_MODELS) {
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
            },
          }),
          signal: AbortSignal.timeout(45000),
        }
      )

      if (!res.ok) {
        const body = await safeText(res)
        console.warn(`[Gemini][${model}] HTTP ${res.status}: ${body.slice(0, 150)}`)
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

  return {
    imageBase64: null,
    label,
    error: "Gemini no generó imagen",
  }
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
  const models = ["flux", "flux-realism", "turbo"]

  for (const model of models) {
    try {
      const seed = Math.floor(Math.random() * 999999)
      const encoded = encodeURIComponent(prompt)
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)",
      }

      let url: string
      if (apiKey) {
        url = `https://gen.pollinations.ai/image/${encoded}?model=${model}&width=${safeW}&height=${safeH}&seed=${seed}&nologo=true&enhance=true`
        headers.Authorization = `Bearer ${apiKey}`
      } else {
        url = `https://image.pollinations.ai/prompt/${encoded}?model=${model}&width=${safeW}&height=${safeH}&seed=${seed}&nologo=true&enhance=true&safe=false`
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(55000),
      })

      if (!res.ok) {
        console.warn(`[Pollinations][${model}] HTTP ${res.status}`)
        continue
      }

      const contentType = res.headers.get("content-type") || ""
      if (!contentType.startsWith("image/")) {
        console.warn(`[Pollinations][${model}] invalid content-type: ${contentType}`)
        continue
      }

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

  return {
    imageBase64: null,
    label,
    error: "Todos los modelos de Pollinations fallaron",
  }
}

async function tryTogether(
  prompt: string,
  width: number,
  height: number
): Promise<ProviderResult> {
  const label = "Together AI"
  const keys = getTogetherKeys()
  const key = pickFromPool(keys, prompt)

  if (!key) {
    return { imageBase64: null, label, error: "No hay key de Together configurada" }
  }

  for (const { id, steps, guidance, useAspectRatio } of TOGETHER_IMAGE_MODELS) {
    try {
      // FLUX.2 usa aspect_ratio; FLUX.1.x usa width/height
      const sizeParams = useAspectRatio
        ? { aspect_ratio: aspectRatio(width, height) }
        : { width: clamp(width, 256, 1440, 1024), height: clamp(height, 256, 1440, 768) }

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
          guidance,
          response_format: "base64",
        }),
        signal: AbortSignal.timeout(55000),
      })

      if (!res.ok) {
        const body = await safeText(res)
        console.warn(`[Together][${id}] HTTP ${res.status}: ${body.slice(0, 150)}`)
        continue
      }

      const data = await res.json()
      const base64 = data?.data?.[0]?.b64_json || data?.data?.[0]?.base64
      if (base64) {
        return {
          imageBase64: `data:image/png;base64,${base64}`,
          label,
          model: id,
        }
      }

      const imageUrl = data?.data?.[0]?.url
      if (imageUrl) {
        const converted = await fetchBase64(imageUrl)
        if (converted) {
          return {
            imageBase64: converted,
            label,
            model: id,
          }
        }
      }
    } catch (e) {
      console.warn(`[Together][${id}]`, errMsg(e))
    }
  }

  return {
    imageBase64: null,
    label,
    error: "Together AI: todos los modelos fallaron",
  }
}

async function tryHuggingFace(
  prompt: string,
  width: number,
  height: number
): Promise<ProviderResult> {
  const label = "Hugging Face"
  const tokens = getHuggingFaceTokens()

  if (!tokens.length) {
    return { imageBase64: null, label, error: "No hay tokens de Hugging Face configurados" }
  }

  for (const { id, steps, guidance } of HUGGINGFACE_IMAGE_MODELS) {
    for (const token of tokens) {
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
              negative_prompt:
                "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, deformed",
              width: clamp(width, 256, 1024, 1024),
              height: clamp(height, 256, 1024, 768),
              num_inference_steps: steps,
              guidance_scale: guidance,
            },
          }),
          signal: AbortSignal.timeout(60000),
        })

        if (!res.ok) {
          const body = await safeText(res)
          console.warn(`[HF][${id}] HTTP ${res.status}: ${body.slice(0, 150)}`)
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

  return {
    imageBase64: null,
    label,
    error: "Hugging Face: todos los intentos fallaron",
  }
}

async function tryOpenRouter(
  prompt: string,
  width: number,
  height: number,
  _mode: GenerationMode
): Promise<ProviderResult> {
  const label = "OpenRouter"
  const keys = getOpenRouterKeys()
  const key = pickFromPool(keys, prompt)

  if (!key) {
    return { imageBase64: null, label, error: "No hay key de OpenRouter configurada" }
  }

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
        const body = await safeText(res)
        console.warn(`[OpenRouter][${id}] HTTP ${res.status}: ${body.slice(0, 150)}`)
        continue
      }

      const data = await res.json()
      const message = data?.choices?.[0]?.message

      // Formato 1: message.images[] (estándar OpenRouter)
      const images = Array.isArray(message?.images) ? message.images : []
      const imgEntry = images[0]
      const dataUrlA: string | null = imgEntry?.image_url?.url || imgEntry?.url || null

      if (dataUrlA) {
        if (dataUrlA.startsWith("data:image/")) return { imageBase64: dataUrlA, label, model: id }
        if (/^https?:\/\//.test(dataUrlA)) {
          const converted = await fetchBase64(dataUrlA)
          if (converted) return { imageBase64: converted, label, model: id }
        }
      }

      // Formato 2: message.content[] con partes tipo image_url (algunos modelos Gemini via OR)
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

      console.warn(`[OpenRouter][${id}] respuesta OK pero sin imagen detectada`)
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
  mode: GenerationMode
): Promise<ProviderResult> {
  switch (id) {
    case "gemini":
      return tryGemini(prompt)
    case "pollinations":
      return tryPollinations(prompt, width, height)
    case "together":
      return tryTogether(prompt, width, height)
    case "huggingface":
      return tryHuggingFace(prompt, width, height)
    case "openrouter":
      return tryOpenRouter(prompt, width, height, mode)
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
  const educationalContext = body?.educationalContext
    ? String(body.educationalContext)
    : undefined

  if (!prompt) return new Response("Prompt requerido", { status: 400 })

  try {
    const optimizedPrompt = customPrompt
      ? customPrompt
      : shouldOptimizePrompt(mode, customPrompt)
        ? await optimizePrompt(prompt, style, educationalContext)
        : basicPrompt(prompt, style)

    const order = providerOrder(provider, mode)
    const errors: string[] = []

    let imageBase64: string | null = null
    let usedProvider = ""
    let usedModel = ""

    for (const p of order) {
      console.log(`[Image] Intentando provider: ${p}`)
      const result = await runProvider(p, optimizedPrompt, width, height, mode)

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
        const publicUrl = await uploadToStorage(imageBase64!, user.id)
        const imageUrlToStore = publicUrl ?? imageBase64!

        const { error } = await supabase.from("generated_images").insert({
          user_id: user.id,
          prompt,
          optimized_prompt: optimizedPrompt,
          image_url: imageUrlToStore,
          provider: usedModel ? `${usedProvider} · ${usedModel}` : usedProvider,
          style,
          width,
          height,
          source,
          topic,
        })

        if (error) {
          console.error("[Image][DB]", error.message)
        }
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
      promptOptimized: shouldOptimizePrompt(mode, customPrompt),
    })
  } catch (e) {
    return new Response(`Error: ${errMsg(e)}`, { status: 500 })
  }
}
