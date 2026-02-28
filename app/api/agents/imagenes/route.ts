
import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

async function optimizePrompt(userPrompt: string, style: string): Promise<string> {
  const messages = [
    {
      role: "system" as const,
      content: `You are an expert prompt engineer for AI image generation. Transform user descriptions into optimized English prompts for FLUX and Stable Diffusion. Reply ONLY with the optimized prompt, no explanations.`
    },
    {
      role: "user" as const,
      content: `User description: "${userPrompt}"
Style: ${style}

Create an optimized English prompt including: detailed visual description, ${style} style, masterpiece, highly detailed, 8k quality, professional lighting and composition. Reply ONLY with the prompt.`
    }
  ]
  const result = await callAI(messages, { maxTokens: 250, preferProvider: "groq" })
  return result.text.trim()
}

async function fetchImageAsBase64(url: string, token?: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; EduAI/1.0)",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(28000),
    })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    const mime = res.headers.get("content-type") || "image/jpeg"
    return `data:${mime};base64,${base64}`
  } catch {
    return null
  }
}

async function tryTogether(prompt: string, width: number, height: number): Promise<string | null> {
  const key = process.env.TOGETHER_API_KEY
  if (!key) return null
  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
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
    // Fetch the image server-side to avoid CORS
    return await fetchImageAsBase64(imageUrl)
  } catch {
    return null
  }
}

async function tryHuggingFace(prompt: string, width: number, height: number, negative: string): Promise<string | null> {
  const tokens = [
    process.env.HF_TOKEN_1,
    process.env.HF_TOKEN_2,
    process.env.HF_TOKEN_3,
  ].filter(Boolean) as string[]

  const models = [
    "stabilityai/stable-diffusion-xl-base-1.0",
    "runwayml/stable-diffusion-v1-5",
    "CompVis/stable-diffusion-v1-4",
  ]

  for (const model of models) {
    for (const token of tokens) {
      try {
        const res = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                negative_prompt: negative,
                width: Math.min(width, 768),
                height: Math.min(height, 768),
                num_inference_steps: 25,
              },
            }),
            signal: AbortSignal.timeout(28000),
          }
        )
        if (!res.ok) continue
        const blob = await res.blob()
        if (!blob.size) continue
        const buffer = await blob.arrayBuffer()
        const base64 = Buffer.from(buffer).toString("base64")
        const mime = blob.type || "image/jpeg"
        return `data:${mime};base64,${base64}`
      } catch {
        continue
      }
    }
  }
  return null
}

async function tryPicsum(width: number, height: number): Promise<string | null> {
  // Lorem Picsum como placeholder visual cuando todo falla
  try {
    const seed = Math.floor(Math.random() * 1000)
    const url = `https://picsum.photos/seed/${seed}/${width}/${height}`
    return await fetchImageAsBase64(url)
  } catch {
    return null
  }
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
  } = await req.json()

  if (!prompt?.trim()) {
    return new Response("Prompt requerido", { status: 400 })
  }

  try {
    const optimizedPrompt = await optimizePrompt(prompt, style)
    const negative = "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, nsfw"

    let imageBase64: string | null = null
    let usedProvider = ""

    if (provider === "together" || provider === "auto") {
      imageBase64 = await tryTogether(optimizedPrompt, width, height)
      if (imageBase64) usedProvider = "Together AI (FLUX Schnell)"
    }

    if (!imageBase64 && (provider === "huggingface" || provider === "auto")) {
      imageBase64 = await tryHuggingFace(optimizedPrompt, width, height, negative)
      if (imageBase64) usedProvider = "Hugging Face (Stable Diffusion)"
    }

    // Si no hay Together ni HF, usar Picsum como placeholder
    if (!imageBase64) {
      imageBase64 = await tryPicsum(width, height)
      usedProvider = "Placeholder (APIs no disponibles)"
    }

    if (!imageBase64) {
      return new Response("No se pudo generar la imagen. Verifica las API keys.", { status: 503 })
    }

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
