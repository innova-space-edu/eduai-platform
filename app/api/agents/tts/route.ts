import { createClient } from "@/lib/supabase/server"

const MOTIVATIONAL = [
  "Muy bien, sigamos adelante.",
  "Ánimo, lo estás haciendo genial.",
  "No te preocupes, esto se entiende paso a paso.",
  "Sigue así, vas muy bien.",
  "Cada pregunta te hace más inteligente.",
]

function getMotivational() {
  return MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]
}

function getTokens(): string[] {
  const tokens = [
    process.env.HF_TOKEN_1,
    process.env.HF_TOKEN_2,
    process.env.HF_TOKEN_3,
    process.env.HF_TOKEN,
  ].filter(Boolean) as string[]
  return tokens
}

async function synthesizeWithRotation(text: string): Promise<ArrayBuffer | null> {
  const tokens = getTokens()
  if (tokens.length === 0) return null

  for (const token of tokens) {
    try {
      const res = await fetch(
        "https://api-inference.huggingface.co/models/facebook/mms-tts-spa",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: text }),
        }
      )

      if (res.status === 429 || res.status === 503) {
        // Rate limit o modelo cargando — intenta siguiente token
        console.log(`Token rate limited, trying next...`)
        continue
      }

      if (!res.ok) {
        const err = await res.text()
        console.error("HF TTS error:", res.status, err)
        continue
      }

      return await res.arrayBuffer()
    } catch (e) {
      console.error("HF TTS exception:", e)
      continue
    }
  }

  return null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { text, addMotivation = false } = await req.json()

  const clean = text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\$\$[^$]*\$\$/g, "fórmula matemática")
    .replace(/\$[^$]*\$/g, "fórmula")
    .replace(/---FOLLOWUPS---[\s\S]*/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\n+/g, " ")
    .trim()

  // Dividir en chunks de 400 chars
  const chunks: string[] = []
  const words = clean.split(" ")
  let current = ""

  for (const word of words) {
    if ((current + " " + word).length > 400) {
      if (current) chunks.push(current.trim())
      current = word
    } else {
      current += " " + word
    }
  }
  if (current.trim()) chunks.push(current.trim())
  if (addMotivation) chunks.push(getMotivational())

  // Sintetizar con rotación de tokens
  const buffers: ArrayBuffer[] = []
  for (const chunk of chunks) {
    const buf = await synthesizeWithRotation(chunk)
    if (buf) buffers.push(buf)
  }

  if (buffers.length === 0) {
    return new Response("TTS failed", { status: 500 })
  }

  // Concatenar buffers
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const buf of buffers) {
    combined.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }

  return new Response(combined.buffer, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-cache",
    },
  })
}
