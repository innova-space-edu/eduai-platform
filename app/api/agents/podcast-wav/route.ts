// app/api/agents/podcast-wav/route.ts
// ✅ Genera audio tipo "podcast" con 2 narradores usando @andresaya/edge-tts
// ✅ Formato: MP3 24kHz 96kbps mono (compatible, liviano, estilo Spotify/NotebookLM)
// ✅ Reduce llamadas: agrupa segmentos consecutivos por speaker y corta en chunks grandes
// ⚠️ IMPORTANTE: Ya NO es WAV. Se elimina TODO lo de RIFF/PCM/buildWav.
//
// Body esperado:
// { segments: [{ speaker: "A"|"B", text: "..." }, ...] }
//
// Respuesta: audio/mpeg (podcast.mp3)

import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

import { EdgeTTS, Constants } from "@andresaya/edge-tts"

type Speaker = "A" | "B"
type NormalizedSegment = { speaker: Speaker; text: string }

const VOICE_A_DEFAULT = "es-ES-AlvaroNeural"
const VOICE_B_DEFAULT = "es-ES-ElviraNeural"

// -------------------- helpers --------------------

function cleanText(text: string): string {
  return String(text || "")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    // quitar markdown/ruido básico
    .replace(/[*_`#>-]+/g, "")
    .trim()
}

function normalizeSegments(raw: unknown): NormalizedSegment[] {
  const segs = Array.isArray(raw) ? raw : []
  return segs
    .map((s): NormalizedSegment => {
      const obj = (s ?? {}) as { speaker?: unknown; text?: unknown }
      const speaker: Speaker = obj.speaker === "B" ? "B" : "A"
      const text = cleanText(String(obj.text || ""))
      return { speaker, text }
    })
    .filter((s) => s.text.length > 0)
}

function groupBySpeaker(segments: NormalizedSegment[]): NormalizedSegment[] {
  // Une segmentos consecutivos del mismo speaker para reducir llamadas
  const out: NormalizedSegment[] = []
  for (const seg of segments) {
    if (!out.length) {
      out.push({ ...seg })
      continue
    }
    const last = out[out.length - 1]
    if (last.speaker === seg.speaker) {
      last.text = `${last.text}\n\n${seg.text}`.replace(/\s{2,}/g, " ").trim()
    } else {
      out.push({ ...seg })
    }
  }
  return out
}

function splitText(text: string, maxLen = 1100): string[] {
  // chunks grandes para menos llamadas, con cortes suaves por frases
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

function asBuffer(audio: unknown): Buffer {
  if (Buffer.isBuffer(audio)) return audio
  if (audio instanceof Uint8Array) return Buffer.from(audio)
  if (audio instanceof ArrayBuffer) return Buffer.from(new Uint8Array(audio))
  return Buffer.from(audio as any)
}

// -------------------- route --------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const segments = normalizeSegments((body as { segments?: unknown })?.segments)

    if (segments.length === 0) {
      return NextResponse.json({ error: "No hay segmentos" }, { status: 400 })
    }

    // Env vars opcionales en Vercel
    const voiceA = process.env.EDGE_TTS_VOICE_A || VOICE_A_DEFAULT
    const voiceB = process.env.EDGE_TTS_VOICE_B || VOICE_B_DEFAULT

    // Menos llamadas: agrupar por speaker
    const grouped = groupBySpeaker(segments)

    const tts = new EdgeTTS()

    // ✅ MP3 final = concatenación de buffers MP3 por chunk
    // Nota: este enfoque funciona bien para reproducción/descarga en la práctica (players tolerantes).
    // Si quieres 100% "container-perfect", ahí ya toca remux (ffmpeg), que es más pesado.
    const mp3Parts: Buffer[] = []

    for (const seg of grouped) {
      const voice = seg.speaker === "B" ? voiceB : voiceA
      const chunks = splitText(seg.text, 1100)

      for (const chunk of chunks) {
        // @andresaya/edge-tts: el outputFormat válido NO incluye RIFF/WAV
        await tts.synthesize(chunk, voice, {
          outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
          rate: seg.speaker === "B" ? "+4%" : "0%",
          pitch: seg.speaker === "B" ? "+1Hz" : "-1Hz",
          volume: "100%",
        })

        // La lib acumula el output; tts.toBuffer() devuelve el audio del último synth (según esta lib)
        const part = asBuffer(tts.toBuffer())

        // Validación suave: MP3 suele empezar con "ID3" o frame sync 0xFF 0xFB/0xF3/0xF2
        if (
          part.length < 4 ||
          !(
            (part[0] === 0x49 && part[1] === 0x44 && part[2] === 0x33) || // "ID3"
            part[0] === 0xff // frame sync
          )
        ) {
          // No reventamos por header, pero dejamos una pista clara
          throw new Error("Edge TTS no devolvió MP3 válido (buffer inesperado)")
        }

        mp3Parts.push(part)
      }
    }

    if (mp3Parts.length === 0) {
      return NextResponse.json({ error: "No se generó audio" }, { status: 502 })
    }

    const finalMp3 = Buffer.concat(mp3Parts)

    return new NextResponse(finalMp3, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'inline; filename="podcast.mp3"',
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (err: any) {
    console.error("podcast-mp3 error:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Error generando audio" }, { status: 500 })
  }
}
