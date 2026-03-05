// src/app/api/agents/tts-podcast/route.ts
// Genera audio de podcast usando Hugging Face Inference API (gratis)

import { NextRequest, NextResponse } from "next/server"

const HF_MODEL = "facebook/mms-tts-spa" // Meta's Spanish TTS - gratis

async function generateSpeech(text: string, speakerId?: string): Promise<ArrayBuffer> {
  const hfToken = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY || ""

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (hfToken) {
    headers["Authorization"] = `Bearer ${hfToken}`
  }

  const res = await fetch(
    `https://api-inference.huggingface.co/models/${HF_MODEL}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: text }),
      signal: AbortSignal.timeout(30000),
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`HF TTS error ${res.status}: ${errText}`)
  }

  return await res.arrayBuffer()
}

// Crear un WAV header para concatenar audio chunks
function createWavHeader(dataLength: number, sampleRate = 16000, channels = 1, bitsPerSample = 16): ArrayBuffer {
  const header = new ArrayBuffer(44)
  const view = new DataView(header)

  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)

  // RIFF header
  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, "WAVE")

  // fmt chunk
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  writeString(view, 36, "data")
  view.setUint32(40, dataLength, true)

  return header
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

// Extraer datos PCM de un WAV buffer (skip header)
function extractPCMData(wavBuffer: ArrayBuffer): ArrayBuffer {
  const view = new DataView(wavBuffer)

  // Buscar el chunk "data"
  let offset = 12 // después de RIFF header
  while (offset < wavBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    )
    const chunkSize = view.getUint32(offset + 4, true)

    if (chunkId === "data") {
      return wavBuffer.slice(offset + 8, offset + 8 + chunkSize)
    }
    offset += 8 + chunkSize
  }

  // Fallback: asumir header estándar de 44 bytes
  return wavBuffer.slice(44)
}

// Generar silencio (pausa entre segmentos)
function generateSilence(durationMs: number, sampleRate = 16000, bitsPerSample = 16): ArrayBuffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000)
  const bytesPerSample = bitsPerSample / 8
  return new ArrayBuffer(numSamples * bytesPerSample)
}

export async function POST(request: NextRequest) {
  try {
    const { segments, title } = await request.json()

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay segmentos de podcast" },
        { status: 400 }
      )
    }

    // Limitar a 30 segmentos para no exceder rate limits
    const limitedSegments = segments.slice(0, 30)

    const pcmChunks: ArrayBuffer[] = []
    const silencePause = generateSilence(500) // 500ms entre segmentos

    for (let i = 0; i < limitedSegments.length; i++) {
      const seg = limitedSegments[i]
      const text = (seg.text || "").trim()
      if (!text) continue

      try {
        // Generar audio para este segmento
        const audioBuffer = await generateSpeech(text)

        // Extraer PCM data
        const pcm = extractPCMData(audioBuffer)
        pcmChunks.push(pcm)

        // Agregar pausa entre segmentos
        if (i < limitedSegments.length - 1) {
          pcmChunks.push(silencePause)
        }

        // Rate limiting: esperar un poco entre requests
        if (i < limitedSegments.length - 1) {
          await new Promise(r => setTimeout(r, 200))
        }
      } catch (segErr: any) {
        console.error(`Error en segmento ${i}:`, segErr.message)
        // Continuar con los demás segmentos
        pcmChunks.push(silencePause)
      }
    }

    if (pcmChunks.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se pudo generar audio para ningún segmento" },
        { status: 422 }
      )
    }

    // Calcular tamaño total
    const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0)

    // Crear WAV final
    const wavHeader = createWavHeader(totalLength)
    const finalBuffer = new Uint8Array(44 + totalLength)
    finalBuffer.set(new Uint8Array(wavHeader), 0)

    let offset = 44
    for (const chunk of pcmChunks) {
      finalBuffer.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    // Retornar como WAV
    return new NextResponse(finalBuffer.buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(title || "podcast-eduai")}.wav"`,
        "Content-Length": String(finalBuffer.byteLength),
      },
    })
  } catch (err: any) {
    console.error("Error generando podcast audio:", err)
    return NextResponse.json(
      { success: false, error: `Error: ${err.message}` },
      { status: 500 }
    )
  }
}
