import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const IMAGE_MODELS = [
  "stabilityai/stable-diffusion-xl-base-1.0",
  "runwayml/stable-diffusion-v1-5",
  "CompVis/stable-diffusion-v1-4",
]

function getTokens(): string[] {
  return [
    process.env.HF_TOKEN_1,
    process.env.HF_TOKEN_2,
    process.env.HF_TOKEN_3,
    process.env.HF_TOKEN,
  ].filter(Boolean) as string[]
}

async function generateImageHF(prompt: string): Promise<string | null> {
  const tokens = getTokens()
  const negativePrompt = "blurry, low quality, text, watermark, signature, ugly, deformed"

  for (const model of IMAGE_MODELS) {
    for (const token of tokens) {
      try {
        const res = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "X-Wait-For-Model": "true",
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                negative_prompt: negativePrompt,
                num_inference_steps: 25,
                guidance_scale: 7.5,
                width: 768,
                height: 512,
              },
            }),
          }
        )

        if (res.status === 429 || res.status === 503) {
          console.log(`Model ${model} unavailable, trying next...`)
          continue
        }

        if (!res.ok) {
          const err = await res.text()
          console.error(`HF image error (${model}):`, err)
          continue
        }

        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString("base64")
        return `data:image/jpeg;base64,${base64}`

      } catch (e) {
        console.error(`HF image exception (${model}):`, e)
        continue
      }
    }
  }
  return null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { topic, context, type = "auto" } = await req.json()

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres AIm, el Agente de Imágenes. Generas visuales educativos.
Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.`
        },
        {
          role: "user",
          content: `Tema: "${topic}"
Contexto: "${context?.slice(0, 300) || ""}"
Tipo solicitado: ${type}

Genera el visual más útil para aprender este concepto.

REGLAS para cada tipo:

Para "image": prompt en inglés descriptivo, estilo "educational diagram of [concepto], clean illustration, colorful, infographic style, white background, detailed, high quality"

Para "mermaid": usa SOLO esta sintaxis:
flowchart TD
    A[Nodo] --> B[Nodo2]
    B --> C[Nodo3]
SIN caracteres especiales ni punto y coma en labels. Máximo 8 nodos.

Para "chart": JSON exacto:
{"type":"bar","data":{"labels":["A","B","C"],"datasets":[{"label":"Serie","data":[1,2,3],"backgroundColor":["#3b82f6","#8b5cf6","#06b6d4"]}]}}

Para "table": tabla markdown con encabezados y separador |---|

Responde:
{
  "type": "image|mermaid|chart|table",
  "title": "título corto",
  "content": "prompt, código mermaid, JSON chart, o tabla markdown",
  "caption": "qué muestra este visual"
}`
        }
      ],
      temperature: 0.4,
      max_tokens: 600,
    })

    const text = completion.choices[0]?.message?.content || ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON found")

    const visual = JSON.parse(jsonMatch[0])

    // Limpiar mermaid
    if (visual.type === "mermaid") {
      visual.content = visual.content
        .replace(/graph\s+(LR|TD|RL|BT);?/g, "flowchart $1")
        .replace(/;/g, "")
        .trim()
    }

    // Generar imagen con HF SD
    if (visual.type === "image") {
      const imgPrompt = `Educational illustration: ${visual.content}, clean, colorful, modern infographic style, white background, high quality`
      const imageData = await generateImageHF(imgPrompt)
      if (imageData) {
        visual.imageData = imageData
      } else {
        // Fallback a Pollinations si HF falla
        const encoded = encodeURIComponent(imgPrompt)
        visual.imageData = null
        visual.url = `https://image.pollinations.ai/prompt/${encoded}?width=800&height=500&model=flux&nologo=true&seed=${Date.now()}`
      }
    }

    // Parsear chart
    if (visual.type === "chart") {
      try {
        visual.chartData = typeof visual.content === "string"
          ? JSON.parse(visual.content)
          : visual.content
      } catch {
        visual.type = "table"
        visual.content = `| Concepto | Descripción |\n|---|---|\n| ${topic} | Ver explicación arriba |`
      }
    }

    return Response.json(visual)

  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
