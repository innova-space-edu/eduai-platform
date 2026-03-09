import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { EdgeTTS, Constants } from "@andresaya/edge-tts"

export const runtime = "nodejs"
export const maxDuration = 60

type Speaker = "A" | "B"

const VOICE_A_DEFAULT = process.env.EDGE_TTS_VOICE_A || "es-ES-AlvaroNeural"
const VOICE_B_DEFAULT = process.env.EDGE_TTS_VOICE_B || "es-ES-ElviraNeural"
const MAX_CHUNK_LENGTH = 1050

const MOTIVATIONAL = [
  "Muy bien, sigamos adelante.",
  "Ánimo, lo estás haciendo genial.",
  "No te preocupes, esto se entiende paso a paso.",
  "Sigue así, vas muy bien.",
  "Cada pregunta te hace más inteligente.",
]

function getMotivational(): string {
  return MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]
}

function sanitizeForSpeech(text: string): string {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\$\$([\s\S]*?)\$\$/g, ". Pausa. Aquí hay una fórmula matemática importante. ")
    .replace(/\$([^$]+)\$/g, ". Pausa. Aquí hay una expresión matemática. ")
    .replace(/---FOLLOWUPS---[\s\S]*/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1")
    .replace(/[>#*_~]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function addPedagogicalPauses(text: string): string {
  return text
    .replace(/:\s+/g, ". Pausa. ")
    .replace(/;\s+/g, ". Pausa. ")
    .replace(/\n\n+/g, ". Pausa larga. ")
    .replace(/\n/g, ". ")
    .replace(/([.!?])\s+/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function splitText(text: string, maxLen = MAX_CHUNK_LENGTH): string[] {
  const clean = addPedagogicalPauses(sanitizeForSpeech(text))

  if (!clean) return []
  if (clean.length <= maxLen) return [clean]

  const pieces = clean.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ""

  for (const piece of pieces) {
    const sentence = piece.trim()
    if (!sentence) continue

    if (sentence.length > maxLen) {
      const words = sentence.split(/\s+/)

      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word

        if (candidate.length > maxLen) {
          if (current) chunks.push(current.trim())
          current = word
        } else {
          current = candidate
        }
      }

      continue
    }

    const candidate = current ? `${current} ${sentence}` : sentence

    if (candidate.length > maxLen) {
      if (current) chunks.push(current.trim())
      current = sentence
    } else {
      current = candidate
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.byteLength, 0)
  const out = new Uint8Array(total)

  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.byteLength
  }

  return out
}

async function synthesizeChunks(texts: string[], speaker: Speaker): Promise<Uint8Array[]> {
  const voice = speaker === "B" ? VOICE_B_DEFAULT : VOICE_A_DEFAULT
  const rate = speaker === "B" ? "+4%" : "-2%"
  const pitch = speaker === "B" ? "+2Hz" : "-1Hz"

  const audioParts: Uint8Array[] = []

  for (const text of texts) {
    const tts = new EdgeTTS()

    await tts.synthesize(text, voice, {
      outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
      rate,
      pitch,
      volume: "100%",
    })

    const buffer = tts.toBuffer()

    if (!buffer || buffer.length < 200) {
      throw new Error("No se pudo generar audio válido con Edge TTS")
    }

    audioParts.push(new Uint8Array(buffer))
  }

  return audioParts
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const { text, addMotivation = false, speaker = "A" } = await req.json()
    const chosenSpeaker: Speaker = speaker === "B" ? "B" : "A"

    const parts = splitText(text)

    if (addMotivation) {
      parts.push(addPedagogicalPauses(getMotivational()))
    }

    if (!parts.length) {
      return NextResponse.json(
        { error: "No hay texto para narrar" },
        { status: 400 }
      )
    }

    const mp3Parts = await synthesizeChunks(parts, chosenSpeaker)
    const finalMp3 = concatUint8Arrays(mp3Parts)

    return new NextResponse(Buffer.from(finalMp3), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-TTS-Voice": chosenSpeaker === "B" ? VOICE_B_DEFAULT : VOICE_A_DEFAULT,
      },
    })
  } catch (error: any) {
    console.error("tts route error:", error?.message || error)

    return NextResponse.json(
      { error: error?.message || "Error generando audio" },
      { status: 500 }
    )
  }
}
