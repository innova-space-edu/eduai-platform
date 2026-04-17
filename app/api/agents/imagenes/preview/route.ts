// app/api/agents/imagenes/preview/route.ts — v3

import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

const STYLE_GUIDES: Record<string, string> = {
  realistic:
    "RAW photo, photorealistic, shot on Sony A7R V 85mm f/1.4, natural skin texture with visible pores, catchlights in eyes, natural lighting, ultra-sharp focus, 8K resolution, professional photography",
  portrait:
    "professional photography, Sony A7IV 85mm f/1.8, natural skin texture, sharp eyes with catchlights, warm golden hour window light, soft bokeh background, perfect facial anatomy, detailed hair strands",
  "3d animation":
    "Pixar/Disney 3D animated style, subsurface scattering skin, cinema4d octane render, volumetric lighting, expressive character design, vibrant color palette, depth of field",
  "comic book":
    "classic American comic book 1970s-1980s style, bold ink outlines, halftone dot patterns, strong shadows, dynamic composition, vintage color palette, cross-hatching, graphic novel quality",
  "digital art":
    "digital painting, concept art, artstation trending 2025, vibrant dramatic colors, highly detailed, professional illustration, masterpiece quality",
  anime:
    "high-quality anime illustration, KyoAni style, clean linework, expressive detailed eyes with light reflections, vibrant colors, soft cel shading, professional anime key visual",
  watercolor:
    "watercolor painting, loose expressive brushwork, transparent washes, soft dreamy edges, paper texture, harmonious color palette, award-winning illustration",
  "3d render":
    "photorealistic 3D render, octane render Blender cycles, ray-traced reflections, subsurface scattering, volumetric atmosphere, PBR materials, studio HDR lighting, 4K",
  sketch:
    "detailed pencil sketch, graphite on white paper, precise technical linework, cross-hatching for shadows, concept art quality, clean white background",
  cinematic:
    "anamorphic cinema lens, movie still, Kodak 35mm film look, golden hour lighting, epic widescreen composition, shallow depth of field, cinematic color grade, blockbuster quality",
  "neon cyberpunk":
    "neon-lit cyberpunk aesthetic, rain-slicked streets reflection, volumetric neon glow, deep contrast darkness, cyan and magenta lights, futuristic urban environment, blade runner inspired",
  fantasy:
    "epic fantasy digital painting, highly detailed, dramatic magical lighting, intricate costume design, rich jewel-tone color palette, bokeh light particles, cinematic composition",
  architectural:
    "architectural photography, 24mm tilt-shift lens, blue hour lighting, perfect vertical lines, HDR detail, award-winning architectural digest quality, dramatic sky",
  "oil painting":
    "oil on canvas, classical fine art portrait, museum quality, rich impasto textures, Rembrandt chiaroscuro lighting, warm amber tones, detailed brushwork, renaissance composition",
  educational:
    "clean educational diagram, professional scientific illustration, white background, clear labeled elements, high contrast, pedagogical design, colorful, precise accuracy",
  "flat design":
    "minimal flat design vector illustration, geometric bold shapes, harmonious color palette, modern icon style, clean negative space, professional graphic design, Dribbble quality",
}

// Detecta si el usuario especificó un encuadre/composición
function detectComposition(prompt: string): string | null {
  const p = prompt.toLowerCase()
  if (/full.?body|cuerpo.?completo|de.?cuerpo.?entero|figura.?completa|full.?length/.test(p)) return "full body, full figure visible from head to toe"
  if (/half.?body|medio.?cuerpo|waist.?up|hasta.?cintura/.test(p))                            return "half body shot, waist up"
  if (/bust|torso|chest.?up|pecho|busto/.test(p))                                             return "bust shot, chest and shoulders"
  if (/close.?up|primer.?plano|rostro|cara\b/.test(p))                                        return "close-up portrait, tight face framing"
  if (/wide.?shot|toma.?amplia|paisaje\b|ambiente\b|escena\b/.test(p))                        return "wide shot, environment visible"
  return null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { prompt, style = "realistic" } = await req.json()
  if (!prompt?.trim()) return Response.json({ optimizedPrompt: prompt || "" })

  const styleDesc      = STYLE_GUIDES[style] || STYLE_GUIDES.realistic
  const isPortrait     = style === "realistic" || style === "portrait"
  const userComposition = detectComposition(prompt)
  const compositionNote = userComposition
    ? `IMPORTANT — User requested framing: "${userComposition}". RESPECT IT. Do NOT override with close-up or face framing.`
    : isPortrait
      ? `Default to close-up portrait framing.`
      : `Add a composition note matching the content.`

  const systemPrompt = isPortrait
    ? `You are an expert FLUX.2 prompt engineer for photorealistic photography.
Transform user descriptions into structured English prompts.
FORMAT: [Detailed subject description] + [Camera: model + lens + aperture] + [Lighting type] + [Composition/Framing] + [Quality tags]
Always include: "sharp detailed eyes with natural catchlights", "natural skin pores and texture", "detailed hair strands", "photorealistic, 8K, masterpiece"
${compositionNote}.
Output ONLY the optimized prompt, no explanations, no quotes.`
    : `You are an expert FLUX.2 prompt engineer for AI image generation.
Transform user descriptions into highly detailed structured English prompts.
FORMAT: [Vivid subject description] + [${styleDesc}] + [Lighting and atmosphere] + [Composition] + [Quality keywords]
${compositionNote}
Output ONLY the optimized English prompt, no explanations, no quotes.`

  const messages = [
    { role: "system" as const, content: systemPrompt },
    {
      role: "user" as const,
      content: `Request: "${prompt}"\nStyle: ${style}\nOptimized prompt:`,
    },
  ]

  try {
    const result  = await callAI(messages, { maxTokens: 500, preferProvider: "gemini" })
    const cleaned = (result.text || "").trim().replace(/^["']|["']$/g, "")
    return Response.json({ optimizedPrompt: cleaned || prompt })
  } catch {
    return Response.json({
      optimizedPrompt: `${prompt}, ${styleDesc}, highly detailed, masterpiece, best quality`,
    })
  }
}
