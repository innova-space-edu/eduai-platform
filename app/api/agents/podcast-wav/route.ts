import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

import { EdgeTTS, OUTPUT_FORMAT } from "@andresaya/edge-tts"

type Speaker = "A" | "B"
type Segment = { speaker?: Speaker | string; text?: string }

const VOICE_A_DEFAULT = "es-ES-AlvaroNeural"
const VOICE_B_DEFAULT = "es-ES-ElviraNeural"

function cleanText(text: string): string {
  return String(text || "")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s{2,}/g, " ")
    .replace(/[*_`#>-]+/g, "")
    .trim()
}

function normalizeSegments(raw: any): { speaker: Speaker; text: string }[] {
  const segs = Array.isArray(raw) ? raw : []
  return segs
    .map((s) => ({
      speaker: s?.speaker === "B" ? "B" : "A",
      text: cleanText(s?.text || ""),
    }))
    .filter((s) => s.text.length > 0)
}

function groupBySpeaker(segments: { speaker: Speaker; text: string }[]): { speaker: Speaker; text: string }[] {
  const out: { speaker: Speaker; text: string }[] = []

  for (const seg of segments) {
    if (!out.length) {
      out.push({ ...seg })
      continue
    }

    const last = out[out.length - 1]
    if (last.speaker === seg.speaker) {
      last.text = `${last.text} ${seg.text}`.replace(/\s{2,}/g, " ").trim()
    } else {
      out.push({ ...seg })
    }
  }

  return out
}

function splitText(text: string, maxLen = 700): string[] {
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
    } else if (s.length > maxLen) {
      if (current.trim()) {
        chunks.push(current.trim())
        current = ""
      }
      for (let i = 0; i < s.length; i += maxLen) {
        chunks.push(s.slice(i, i + maxLen).trim())
      }
    } else {
      current = candidate
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(Boolean)
}

function toArrayBuffer(audio: unknown): ArrayBuffer {
  if (audio instanceof ArrayBuffer) return audio

  if (audio instanceof Uint8Array) {
    const out = new ArrayBuffer(audio.byteLength)
    new Uint8Array(out).set(audio)
    return out
  }

  const buf = Buffer.from(audio as any)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

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

  return {
    pcm: new Uint8Array(wav, 44),
    sampleRate,
    numChannels,
    bitsPerSample,
  }
}

function buildWav(
  pcmParts: Uint8Array[],
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): Uint8Array {
  const totalPcmLength = pcmParts.reduce((acc, p) => acc + p.byteLength, 0)
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8

  const wav = new Uint8Array(44 + totalPcmLength)
  const view = new DataView(wav.buffer)

  wav.set([0x52, 0x49, 0x46, 0x46], 0)
  view.setUint32(4, 36 + totalPcmLength, true)
  wav.set([0x57, 0x41, 0x56, 0x45], 8)

  wav.set([0x66, 0x6d, 0x74, 0x20], 12)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  wav.set([0x64, 0x61, 0x74, 0x61], 36)
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

    const voiceA = process.env.EDGE_TTS_VOICE_A || VOICE_A_DEFAULT
    const voiceB = process.env.EDGE_TTS_VOICE_B || VOICE_B_DEFAULT

    const grouped = groupBySpeaker(segments)
    const tts = new EdgeTTS({
      outputFormat: OUTPUT_FORMAT.RIFF_24KHZ_16BIT_MONO_PCM,
    })

    const pcmParts: Uint8Array[] = []
    let sampleRate = 24000
    let numChannels = 1
    let bitsPerSample = 16
    let formatDetected = false

    for (const seg of grouped) {
      const voice = seg.speaker === "B" ? voiceB : voiceA
      const chunks = splitText(seg.text, 700)

      for (const chunk of chunks) {
        const audio = await tts.synthesize(chunk, voice, {
          rate: seg.speaker === "B" ? 4 : 0,
          pitch: seg.speaker === "B" ? 1 : -1,
          volume: 100,
        })

        const audioArrayBuffer = toArrayBuffer(audio)
        const buf = Buffer.from(audioArrayBuffer)

        if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
          throw new Error("Edge TTS no devolvió WAV válido")
        }

        const parsed = extractWavPCM(audioArrayBuffer)

        if (!formatDetected && parsed.pcm.byteLength > 0) {
          sampleRate = parsed.sampleRate
          numChannels = parsed.numChannels
          bitsPerSample = parsed.bitsPerSample
          formatDetected = true
        }

        if (parsed.pcm.byteLength > 0) {
          pcmParts.push(parsed.pcm)
        }
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
        "Content-Disposition": 'inline; filename="podcast.wav"',
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (err: any) {
    console.error("podcast-wav error:", err?.message || err)
    return NextResponse.json(
      { error: err?.message || "Error generando audio" },
      { status: 500 }
    )
  }
}
