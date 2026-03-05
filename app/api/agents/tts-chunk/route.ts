// src/app/api/agents/tts-chunk/route.ts
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

// NPM: @andresaya/edge-tts
import { EdgeTTS, Constants } from "@andresaya/edge-tts"

type Speaker = "A" | "B"
type SegmentIn = { speaker?: Speaker | string; text?: string }
type Segment = { speaker: Speaker; text: string }

const VOICE_A_DEFAULT = "es-ES-AlvaroNeural" // narrador 1 (masculina)
const VOICE_B_DEFAULT = "es-ES-ElviraNeural" // narrador 2 (femenina)

function cleanText(text: string): string {
  return String(text || "")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s{2,}/g, " ")
    .replace(/[*_`#>-]+/g, "")
    .trim()
}

function normalizeSegments(raw: unknown): Segment[] {
  const segs = Array.isArray(raw) ? (raw as SegmentIn[]) : []
  return segs
    .map((s): Segment => {
      const speaker: Speaker = s?.speaker === "B" ? "B" : "A"
      const text = cleanText(String(s?.text || ""))
      return { speaker, text }
    })
    .filter((s) => s.text.length > 0)
}

function groupBySpeaker(segments: Segment[]): Segment[] {
  // Une segmentos consecutivos del mismo speaker para reducir llamadas
  const out: Segment[] = []
  for (const seg of segments) {
    if (!out.length) out.push({ ...seg })
    else {
      const last = out[out.length - 1]
      if (last.speaker === seg.speaker) last.text = `${last.text}\n\n${seg.text}`.trim()
      else out.push({ ...seg })
    }
  }
  return out
}

function splitText(text: string, maxLen = 900): string[] {
  const t = cleanText(text)
  if (!t) return []
  if (t.length <= maxLen) return [t]

  const chunks: string[] = []
  const sentences = t.split(/(?<=[.!?])\s+/)
  let current = ""

  for (const s of sentences) {
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

    const voiceA = process.env.EDGE_TTS_VOICE_A || VOICE_A_DEFAULT
    const voiceB = process.env.EDGE_TTS_VOICE_B || VOICE_B_DEFAULT

    const tts = new EdgeTTS()
    const grouped = groupBySpeaker(segments)

    // Vamos a devolver MP3 (96kbps) por chunk y lo concatenamos (simple y barato).
    // Nota: concatenar MP3 "a pelo" suele funcionar bien en la práctica para reproducción/descarga.
    // Si quieres un MP3 "perfecto" con headers rearmados, se hace con ffmpeg, pero Vercel no siempre lo permite.
    const mp3Parts: Uint8Array[] = []

    for (const seg of grouped) {
      const voice = seg.speaker === "B" ? voiceB : voiceA
      const chunks = splitText(seg.text, 900)

      for (const chunk of chunks) {
        await tts.synthesize(chunk, voice, {
          outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,

          // Ajustes tipo podcast (strings estilo Edge)
          rate: seg.speaker === "B" ? "+5%" : "0%",
          pitch: seg.speaker === "B" ? "+2Hz" : "-2Hz",
          volume: "100%",
        })

        const buf = tts.toBuffer() // Buffer con el MP3 de este chunk

        // Validación mínima (MP3 no tiene RIFF)
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
      },
    })
  } catch (err: any) {
    console.error("tts-chunk error:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Error generando audio" }, { status: 500 })
  }
}
