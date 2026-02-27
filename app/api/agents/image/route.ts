import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function getTokens(): string[] {
  return [
    process.env.HF_TOKEN_1,
    process.env.HF_TOKEN_2,
    process.env.HF_TOKEN_3,
    process.env.HF_TOKEN,
  ].filter(Boolean) as string[]
}

const IMAGE_MODELS = [
  "stabilityai/stable-diffusion-xl-base-1.0",
  "runwayml/stable-diffusion-v1-5",
  "CompVis/stable-diffusion-v1-4",
]

async function generateImageHF(prompt: string): Promise<string | null> {
  const tokens = getTokens()
  for (const model of IMAGE_MODELS) {
    for (const token of tokens) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 25000)

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
                negative_prompt: "blurry, low quality, text, watermark, ugly",
                num_inference_steps: 20,
                guidance_scale: 7.5,
                width: 768,
                height: 512,
              },
            }),
            signal: controller.signal,
          }
        )

        clearTimeout(timeout)

        if (!res.ok) continue

        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString("base64")
        return `data:image/jpeg;base64,${base64}`

      } catch (e) {
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

  const { topic, context, type = "auto", useHF = false } = await req.json()

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

Para "image": prompt en inglés descriptivo para Stable Diffusion. Ejemplo: "educational diagram showing Newton laws of motion, colorful infographic, white background, clean illustration, detailed labels"

Para "mermaid": SOLO esta sintaxis:
flowchart TD
    A[Nodo] --> B[Nodo2]
    B --> C[Nodo3]
SIN punto y coma en labels. Máximo 8 nodos.

Para "chart": JSON exacto:
{"type":"bar","data":{"labels":["A","B","C"],"datasets":[{"label":"Serie","data":[1,2,3],"backgroundColor":["#3b82f6","#8b5cf6","#06b6d4"]}]}}

Para "table": tabla markdown con encabezados y separador |---|

Responde:
{
  "type": "image|mermaid|chart|table",
  "title": "título corto",
  "content": "prompt SD, código mermaid, JSON chart, o tabla markdown",
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

    if (visual.type === "mermaid") {
      visual.content = visual.content
        .replace(/graph\s+(LR|TD|RL|BT);?/g, "flowchart $1")
        .replace(/;/g, "")
        .trim()
    }

    if (visual.type === "image") {
      const imgPrompt = `Educational illustration: ${visual.content}`
      const encodedPrompt = encodeURIComponent(imgPrompt)

      if (useHF) {
        // Modo HF: intenta SD con timeout
        const imageData = await generateImageHF(imgPrompt)
        visual.imageData = imageData
        if (!imageData) {
          visual.url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=500&model=flux&nologo=true&seed=${Date.now()}`
        }
      } else {
        // Modo rápido: Pollinations directo
        visual.url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=500&model=flux&nologo=true&seed=${Date.now()}`
      }
    }

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
