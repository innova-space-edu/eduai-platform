// src/app/api/agents/tts-chunk/route.ts
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

// NPM: @andresaya/edge-tts
import { EdgeTTS, Constants } from "@andresaya/edge-tts"

type Segment = { speaker?: "A" | "B" | string; text?: string }

const VOICE_A_DEFAULT = "es-ES-AlvaroNeural" // narrador 1 (masculina)
const VOICE_B_DEFAULT = "es-ES-ElviraNeural" // narrador 2 (femenina)

function normalizeSegments(raw: any): Segment[] {
  const segs = Array.isArray(raw) ? raw : []
  return segs
    .map((s) => ({ speaker: s?.speaker || "A", text: s?.text || "" }))
    .map((s) => ({
      speaker: s.speaker === "B" ? "B" : "A",
      text: String(s.text || "").trim(),
    }))
    .filter((s) => s.text && s.text.length > 0)
}

function groupBySpeaker(segments: Segment[]): Segment[] {
  // Une segmentos consecutivos del mismo speaker para reducir llamadas.
  const out: Segment[] = []
  for (const seg of segments) {
    if (!out.length) out.push({ ...seg })
    else {
      const last = out[out.length - 1]
      if (last.speaker === seg.speaker) last.text = `${last.text}\n\n${seg.text}`
      else out.push({ ...seg })
    }
  }
  return out
}

function splitText(text: string, maxLen = 900): string[] {
  const t = (text || "").trim()
  if (!t) return []
  if (t.length <= maxLen) return [t]

  const chunks: string[] = []
  const sentences = t.split(/(?<=[.!?])\s+/)
  let current = ""

  for (const s of sentences) {
    const candidate = current ? current + " " + s : s
    if (candidate.length > maxLen && current) {
      chunks.push(current.trim())
      current = s
    } else current = candidate
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length ? chunks : [t.slice(0, maxLen)]
}

// Extraer PCM desde WAV RIFF
function extractWavPCM(wav: ArrayBuffer): {
  pcm: Uint8Array
  sampleRate: number
  numChannels: number
  bitsPerSample: number
} {
  const view = new DataView(wav)
  if (wav.byteLength < 44) throw new Error("WAV demasiado corto")

  let sampleRate = 24000
  let numChannels = 1
  let bitsPerSample = 16

  // Buscar "fmt "
  for (let i = 0; i < wav.byteLength - 24; i++) {
    if (
      view.getUint8(i) === 0x66 &&
      view.getUint8(i + 1) === 0x6d &&
      view.getUint8(i + 2) === 0x74 &&
      view.getUint8(i + 3) === 0x20
    ) {
      numChannels = view.getUint16(i + 10, true)
      sampleRate = view.getUint32(i + 12, true)
      bitsPerSample = view.getUint16(i + 22, true)
      break
    }
  }

  // Buscar "data"
  for (let i = 0; i < wav.byteLength - 8; i++) {
    if (
      view.getUint8(i) === 0x64 &&
      view.getUint8(i + 1) === 0x61 &&
      view.getUint8(i + 2) === 0x74 &&
      view.getUint8(i + 3) === 0x61
    ) {
      const dataSize = view.getUint32(i + 4, true)
      const dataStart = i + 8
      const pcm = new Uint8Array(wav, dataStart, Math.min(dataSize, wav.byteLength - dataStart))
      return { pcm, sampleRate, numChannels, bitsPerSample }
    }
  }

  return { pcm: new Uint8Array(wav, 44), sampleRate, numChannels, bitsPerSample }
}

function buildWav(pcmParts: Uint8Array[], sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
  const totalPcmLength = pcmParts.reduce((acc, p) => acc + p.byteLength, 0)
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8

  const wav = new Uint8Array(44 + totalPcmLength)
  const view = new DataView(wav.buffer)

  wav.set([0x52, 0x49, 0x46, 0x46], 0) // RIFF
  view.setUint32(4, 36 + totalPcmLength, true)
  wav.set([0x57, 0x41, 0x56, 0x45], 8) // WAVE

  wav.set([0x66, 0x6d, 0x74, 0x20], 12) // fmt
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  wav.set([0x64, 0x61, 0x74, 0x61], 36) // data
  view.setUint32(40, totalPcmLength, true)

  let offset = 44
  for (const part of pcmParts) {
    wav.set(part, offset)
    offset += part.byteLength
  }
  return wav
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const segments = normalizeSegments(body?.segments)
    if (segments.length === 0) {
      return NextResponse.json({ error: "No hay segmentos" }, { status: 400 })
    }

    // Puedes sobreescribir en Vercel con env vars si quieres
    const voiceA = process.env.EDGE_TTS_VOICE_A || VOICE_A_DEFAULT
    const voiceB = process.env.EDGE_TTS_VOICE_B || VOICE_B_DEFAULT

    const tts = new EdgeTTS()

    const grouped = groupBySpeaker(segments)
    const pcmParts: Uint8Array[] = []

    let sampleRate = 24000
    let numChannels = 1
    let bitsPerSample = 16
    let formatDetected = false

    for (const seg of grouped) {
      const voice = seg.speaker === "B" ? voiceB : voiceA
      const chunks = splitText(seg.text || "", 900)

      for (const chunk of chunks) {
        // IMPORTANTE: outputFormat va en las opciones de synthesize()
        await tts.synthesize(chunk, voice, {
          // WAV lossless (recomendado para luego concatenar PCM)
          outputFormat: Constants.OUTPUT_FORMAT.RIFF_24KHZ_16BIT_MONO_PCM,

          // Ajustes suaves tipo podcast (el lib acepta strings tipo Edge: '+10Hz', '-10%', '90%')
          rate: seg.speaker === "B" ? "+5%" : "0%",
          pitch: seg.speaker === "B" ? "+2Hz" : "-2Hz",
          volume: "100%",
        })

        const buf = tts.toBuffer() // Buffer con el WAV completo de este chunk
        if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
          throw new Error("Edge TTS no devolvió WAV válido")
        }

        // Extraer PCM para concatenar
        const parsed = extractWavPCM(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

        if (!formatDetected && parsed.pcm.byteLength > 0) {
          sampleRate = parsed.sampleRate
          numChannels = parsed.numChannels
          bitsPerSample = parsed.bitsPerSample
          formatDetected = true
        }

        if (parsed.pcm.byteLength > 0) pcmParts.push(parsed.pcm)
      }
    }

    if (pcmParts.length === 0) {
      return NextResponse.json({ error: "No se generó audio" }, { status: 502 })
    }

    const finalWav = buildWav(pcmParts, sampleRate, numChannels, bitsPerSample)

    return new NextResponse(Buffer.from(finalWav), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    console.error("podcast-wav error:", err?.message)
    return NextResponse.json({ error: err?.message || "Error generando audio" }, { status: 500 })
  }
}
