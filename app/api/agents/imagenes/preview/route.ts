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

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { prompt, style = "realistic" } = await req.json()
  const styleDesc = STYLE_GUIDES[style] || STYLE_GUIDES["realistic"]

  const messages = [
    {
      role: "system" as const,
      content: "You are an expert prompt engineer for AI image generation. Output ONLY the optimized prompt, nothing else."
    },
    {
      role: "user" as const,
      content: `Request: "${prompt}" | Style: ${style} | Keywords: ${styleDesc}\nOutput ONLY the optimized English prompt keeping the exact subject:`
    }
  ]

  const result = await callAI(messages, { maxTokens: 350, preferProvider: "groq" })
  return Response.json({ optimizedPrompt: result.text.trim().replace(/^[["']|["']]$/g, "") })
}
