import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

const STYLE_GUIDES: Record<string, string> = {
  "realistic":    "photorealistic, DSLR photo, 85mm lens, sharp focus, natural lighting, ultra detailed",
  "digital art":  "digital painting, concept art, artstation trending, vibrant colors, detailed illustration",
  "oil painting": "oil on canvas, impressionist brushstrokes, museum quality, rich textures, classical painting",
  "anime":        "anime style, Studio Ghibli, detailed linework, vibrant colors, manga illustration",
  "watercolor":   "watercolor painting, soft edges, transparent washes, artistic, delicate details",
  "3d render":    "3D render, octane render, cinema4d, ray tracing, photorealistic 3D",
  "sketch":       "pencil sketch, detailed linework, graphite drawing, hatching, artistic sketch",
  "cinematic":    "cinematic photography, movie still, dramatic lighting, anamorphic lens, epic composition",
}

async function optimizePrompt(userPrompt: string, style: string): Promise<string> {
  const styleDesc = STYLE_GUIDES[style] || STYLE_GUIDES["realistic"]
  const messages = [
    {
      role: "system" as const,
      content: `You are an expert prompt engineer for AI image generation (FLUX, Stable Diffusion).
Transform user descriptions into highly detailed English prompts.
CRITICAL RULE: Keep the user's EXACT subject — never change what they asked for.
Output ONLY the optimized prompt, no explanations, no quotes, no preamble.`
    },
    {
      role: "user" as const,
      content: `User request: "${userPrompt}"
Style: ${style} — keywords: ${styleDesc}

Example of correct transformation:
- User: "astronaut in deep space with Earth behind him"
- Output: "An astronaut in a white NASA spacesuit floating in deep space, the blue planet Earth visible behind him, stars and cosmos surrounding, dramatic sunlight, photorealistic, highly detailed, 8k, cinematic composition, masterpiece"

Now transform the user request. Output ONLY the prompt:`
    }
  ]
  const result = await callAI(messages, { maxTokens: 350, preferProvider: "groq" })
  return result.text.trim().replace(/^["']|["']$/g, "")
}

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)" },
      signal: AbortSignal.timeout(28000),
    })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    const mime = res.headers.get("content-type") || "image/jpeg"
    return `data:${mime};base64,${base64}`
  } catch { return null }
}

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
    const responseText = await res.text()
    console.log("Together status:", res.status, "body:", responseText.substring(0, 200))
    if (!res.ok) return null
    const data = JSON.parse(responseText)
    const imageUrl = data.data?.[0]?.url
    if (!imageUrl) return null
    return await fetchAsBase64(imageUrl)
  } catch (e: any) { console.log("Together exception:", e.message); return null }
}

async function tryHuggingFace(prompt: string, width: number, height: number): Promise<string | null> {
  const tokens = [process.env.HF_TOKEN_1, process.env.HF_TOKEN_2, process.env.HF_TOKEN_3].filter(Boolean) as string[]
  const models = ["stabilityai/stable-diffusion-xl-base-1.0", "runwayml/stable-diffusion-v1-5"]
  const negative = "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, nsfw, wrong subject"

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
          signal: AbortSignal.timeout(28000),
        })
        if (!res.ok) continue
        const arrayBuffer = await res.arrayBuffer()
        if (!arrayBuffer.byteLength) continue
        const base64 = Buffer.from(arrayBuffer).toString("base64")
        const mime = res.headers.get("content-type") || "image/jpeg"
        return `data:${mime};base64,${base64}`
      } catch (e: any) { continue }
    }
  }
  return null
}

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
  } = await req.json()
  if (!prompt?.trim()) return new Response("Prompt requerido", { status: 400 })

  try {
    const optimizedPrompt = customPrompt?.trim() ? customPrompt.trim() : await optimizePrompt(prompt, style)

    let imageBase64: string | null = null
    let usedProvider = ""

    console.log("TOGETHER_API_KEY exists:", !!process.env.TOGETHER_API_KEY)
    console.log("HF_TOKEN_1 exists:", !!process.env.HF_TOKEN_1)
    console.log("Optimized prompt:", optimizedPrompt.substring(0, 80))

    if (provider === "together" || provider === "auto") {
      console.log("Trying Together AI...")
      imageBase64 = await tryTogether(optimizedPrompt, width, height)
      if (imageBase64) usedProvider = "Together AI (FLUX Schnell)"
      else console.log("Together AI failed")
    }

    if (!imageBase64 && (provider === "huggingface" || provider === "auto")) {
      console.log("Trying HuggingFace...")
      imageBase64 = await tryHuggingFace(optimizedPrompt, width, height)
      if (imageBase64) usedProvider = "Hugging Face (Stable Diffusion XL)"
      else console.log("HuggingFace failed")
    }

    if (!imageBase64) return new Response("No se pudo generar la imagen. Verifica las API keys.", { status: 503 })

    void supabase
      .from("generated_images")
      .insert({
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
      .then(() => {})
      .catch(() => {})

    return Response.json({ imageUrl: imageBase64, optimizedPrompt, provider: usedProvider, type: "base64" })
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 })
  }
}
