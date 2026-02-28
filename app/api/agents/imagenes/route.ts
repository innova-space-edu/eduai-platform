import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

// Optimizar prompt con IA
async function optimizePrompt(userPrompt: string, style: string, language: string): Promise<string> {
  const messages = [
    {
      role: "system" as const,
      content: `Eres un experto en prompt engineering para generación de imágenes con IA.
Tu tarea es transformar descripciones simples en prompts optimizados para modelos como FLUX y Stable Diffusion.
Responde SOLO con el prompt optimizado en inglés, sin explicaciones ni comillas.`
    },
    {
      role: "user" as const,
      content: `Descripción del usuario (en ${language}): "${userPrompt}"
Estilo deseado: ${style}

Genera un prompt optimizado en inglés que incluya:
- Descripción visual detallada
- Estilo artístico (${style})
- Calidad: masterpiece, highly detailed, 8k, professional
- Iluminación y composición apropiadas
- Términos técnicos de fotografía/arte si aplica

Responde SOLO con el prompt optimizado, sin texto adicional.`
    }
  ]
  const result = await callAI(messages, { maxTokens: 300, preferProvider: "groq" })
  return result.text.trim()
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { prompt, style = "realistic", width = 1024, height = 768, provider = "auto" } = await req.json()

  try {
    // 1. Optimizar prompt con IA
    const optimizedPrompt = await optimizePrompt(prompt, style, "español")
    const encodedPrompt = encodeURIComponent(optimizedPrompt)
    const negativePrompt = "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, nsfw"

    // 2. Intentar providers en orden
    const providers = provider === "auto"
      ? ["pollinations", "together", "huggingface"]
      : [provider, "pollinations"]

    for (const p of providers) {
      try {
        if (p === "pollinations") {
          const seed = Math.floor(Math.random() * 999999)
          const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}&negative=${encodeURIComponent(negativePrompt)}`
          try {
            const imgRes = await fetch(url, {
              headers: { "User-Agent": "Mozilla/5.0" },
              signal: AbortSignal.timeout(30000)
            })
            if (imgRes.ok) {
              const buffer = await imgRes.arrayBuffer()
              const base64 = Buffer.from(buffer).toString("base64")
              const mime = imgRes.headers.get("content-type") || "image/jpeg"
              return Response.json({
                imageUrl: `data:${mime};base64,${base64}`,
                optimizedPrompt,
                provider: "Pollinations (FLUX)",
                type: "base64"
              })
            }
          } catch { /* continuar al siguiente provider */ }
        }

        if (p === "together") {
          const togetherKey = process.env.TOGETHER_API_KEY
          if (!togetherKey) continue
          const res = await fetch("https://api.together.xyz/v1/images/generations", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${togetherKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "black-forest-labs/FLUX.1-schnell-Free",
              prompt: optimizedPrompt,
              width, height,
              steps: 4,
              n: 1
            })
          })
          if (res.ok) {
            const data = await res.json()
            const imageUrl = data.data?.[0]?.url
            if (imageUrl) {
              return Response.json({
                imageUrl,
                optimizedPrompt,
                provider: "Together AI (FLUX Schnell)",
                type: "url"
              })
            }
          }
        }

        if (p === "huggingface") {
          const tokens = [
            process.env.HF_TOKEN_1,
            process.env.HF_TOKEN_2,
            process.env.HF_TOKEN_3
          ].filter(Boolean)

          const models = [
            "black-forest-labs/FLUX.1-schnell",
            "stabilityai/stable-diffusion-xl-base-1.0",
            "runwayml/stable-diffusion-v1-5"
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
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                      inputs: optimizedPrompt,
                      parameters: { negative_prompt: negativePrompt, width, height }
                    }),
                    signal: AbortSignal.timeout(25000)
                  }
                )
                if (res.ok) {
                  const blob = await res.blob()
                  const buffer = await blob.arrayBuffer()
                  const base64 = Buffer.from(buffer).toString("base64")
                  const mimeType = blob.type || "image/jpeg"
                  return Response.json({
                    imageUrl: `data:${mimeType};base64,${base64}`,
                    optimizedPrompt,
                    provider: `HuggingFace (${model.split("/")[1]})`,
                    type: "base64"
                  })
                }
              } catch { continue }
            }
          }
        }
      } catch { continue }
    }

    // Fallback: fetch server-side
    try {
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&model=flux`
      const imgRes = await fetch(fallbackUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(30000)
      })
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString("base64")
        const mime = imgRes.headers.get("content-type") || "image/jpeg"
        return Response.json({
          imageUrl: `data:${mime};base64,${base64}`,
          optimizedPrompt,
          provider: "Pollinations (FLUX)",
          type: "base64"
        })
      }
    } catch {}
    return new Response("No se pudo generar la imagen", { status: 503 })

  } catch (e: any) {
    return new Response(e.message, { status: 500 })
  }
}
