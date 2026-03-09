// src/app/api/agents/tts-chunk/route.ts
import { NextRequest, NextResponse } from "next/server"
import { EdgeTTS, Constants } from "@andresaya/edge-tts"

export const runtime = "nodejs"
export const maxDuration = 60

type Speaker = "A" | "B"
type SegmentIn = { speaker?: Speaker | string; text?: string }
type Segment = { speaker: Speaker; text: string }

const VOICE_A_DEFAULT = process.env.EDGE_TTS_VOICE_A || "es-ES-AlvaroNeural"
const VOICE_B_DEFAULT = process.env.EDGE_TTS_VOICE_B || "es-ES-ElviraNeural"
const MAX_CHUNK_LENGTH = 1050

function sanitizeForSpeech(text: string): string {
  return String(text || "")
    .replace(/\r/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\$\$([\s\S]*?)\$\$/g, ". Pausa. Aquí hay una fórmula matemática importante. ")
    .replace(/\$([^$]+)\$/g, ". Pausa. Aquí hay una expresión matemática. ")
    .replace(/---FOLLOWUPS---[\s\S]*/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "$1")
    .replace(/[>#*_~]+/g, " ")
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

function normalizeSegments(raw: unknown): Segment[] {
  const segs = Array.isArray(raw) ? (raw as SegmentIn[]) : []
  return segs
    .map((s): Segment => {
      const speaker: Speaker = s?.speaker === "B" ? "B" : "A"
      const text = addPedagogicalPauses(sanitizeForSpeech(String(s?.text || "")))
      return { speaker, text }
    })
    .filter((s) => s.text.length > 0)
}

function groupBySpeaker(segments: Segment[]): Segment[] {
  const out: Segment[] = []
  for (const seg of segments) {
    if (!out.length) out.push({ ...seg })
    else {
      const last = out[out.length - 1]
      if (last.speaker === seg.speaker) last.text = `${last.text} Pausa larga. ${seg.text}`.trim()
      else out.push({ ...seg })
    }
  }
  return out
}

function splitText(text: string, maxLen = MAX_CHUNK_LENGTH): string[] {
  const t = addPedagogicalPauses(sanitizeForSpeech(text))
  if (!t) return []
  if (t.length <= maxLen) return [t]

  const chunks: string[] = []
  const sentences = t.split(/(?<=[.!?])\s+/)
  let current = ""

  for (const sentence of sentences) {
    const s = sentence.trim()
    if (!s) continue

    if (s.length > maxLen) {
      const words = s.split(/\s+/)
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

    const candidate = current ? `${current} ${s}` : s
    if (candidate.length > maxLen && current) {
      chunks.push(current.trim())
      current = s
    } else {
      current = candidate
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.length ? chunks : [t.slice(0, maxLen)]
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { segments?: unknown }
    const segments = normalizeSegments(body?.segments)

    if (segments.length === 0) {
      return NextResponse.json({ error: "No hay segmentos" }, { status: 400 })
    }

    const voiceA = VOICE_A_DEFAULT
    const voiceB = VOICE_B_DEFAULT

    const tts = new EdgeTTS()
    const grouped = groupBySpeaker(segments)
    const mp3Parts: Uint8Array[] = []

    for (const seg of grouped) {
      const voice = seg.speaker === "B" ? voiceB : voiceA
      const chunks = splitText(seg.text, MAX_CHUNK_LENGTH)

      for (const chunk of chunks) {
        await tts.synthesize(chunk, voice, {
          outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
          rate: seg.speaker === "B" ? "+4%" : "-2%",
          pitch: seg.speaker === "B" ? "+2Hz" : "-1Hz",
          volume: "100%",
        })

        const buf = tts.toBuffer()
        if (!buf || buf.length < 200) {
          throw new Error("Edge TTS no devolvió MP3 válido")
        }

        mp3Parts.push(new Uint8Array(buf))
      }
    }

    if (mp3Parts.length === 0) {
      return NextResponse.json({ error: "No se generó audio" }, { status: 502 })
    }

    const finalMp3 = concatUint8Arrays(mp3Parts)

    return new NextResponse(Buffer.from(finalMp3), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-TTS-Voice-A": voiceA,
        "X-TTS-Voice-B": voiceB,
      },
    })
  } catch (err: any) {
    console.error("tts-chunk error:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Error generando audio" }, { status: 500 })
  }
}
