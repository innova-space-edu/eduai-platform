// src/app/api/agents/tts-podcast/route.ts
// Genera audio de podcast usando Hugging Face Inference API (gratis)
// Divide segmentos largos en chunks para evitar truncamiento

import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 120 // 2 minutos máximo para Vercel

const HF_MODEL = "facebook/mms-tts-spa" // Meta's Spanish TTS - gratis

async function generateSpeech(text: string): Promise<ArrayBuffer> {
  const hfToken = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY || ""

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (hfToken) {
    headers["Authorization"] = `Bearer ${hfToken}`
  }

  // Reintentar hasta 3 veces
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${HF_MODEL}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ inputs: text }),
          signal: AbortSignal.timeout(30000),
        }
      )

      if (res.status === 503) {
        // Modelo cargando, esperar y reintentar
        console.log(`Modelo cargando, intento ${attempt + 1}/3...`)
        await new Promise(r => setTimeout(r, 5000))
        continue
      }

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`HF TTS error ${res.status}: ${errText}`)
      }

      return await res.arrayBuffer()
    } catch (err: any) {
      if (attempt === 2) throw err
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  throw new Error("No se pudo generar audio después de 3 intentos")
}

// Dividir texto largo en chunks que la API pueda manejar (~300 chars max)
function splitText(text: string, maxLen = 250): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let current = ""

  for (const sentence of sentences) {
    if ((current + " " + sentence).length > maxLen && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current = current ? current + " " + sentence : sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  // Si algún chunk sigue largo, dividir por comas
  const final: string[] = []
  for (const chunk of chunks) {
    if (chunk.length > maxLen) {
      const parts = chunk.split(/,\s*/)
      let sub = ""
      for (const part of parts) {
        if ((sub + ", " + part).length > maxLen && sub.length > 0) {
          final.push(sub.trim())
          sub = part
        } else {
          sub = sub ? sub + ", " + part : part
        }
      }
      if (sub.trim()) final.push(sub.trim())
    } else {
      final.push(chunk)
    }
  }

  return final.length > 0 ? final : [text.substring(0, maxLen)]
}

// Extraer datos PCM de un WAV/FLAC buffer
function extractPCMData(audioBuffer: ArrayBuffer): { pcm: ArrayBuffer; sampleRate: number } {
  const view = new DataView(audioBuffer)

  // Verificar si es WAV (RIFF header)
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))

  if (magic === "RIFF") {
    // Es WAV - buscar chunk "data" y leer sample rate
    const sampleRate = view.getUint32(24, true)
    let offset = 12
    while (offset < audioBuffer.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3)
      )
      const chunkSize = view.getUint32(offset + 4, true)
      if (chunkId === "data") {
        return {
          pcm: audioBuffer.slice(offset + 8, offset + 8 + chunkSize),
          sampleRate,
        }
      }
      offset += 8 + chunkSize
    }
    // Fallback
    return { pcm: audioBuffer.slice(44), sampleRate }
  }

  // No es WAV, asumir raw PCM a 16kHz
  return { pcm: audioBuffer, sampleRate: 16000 }
}

// Generar silencio PCM
function generateSilence(durationMs: number, sampleRate: number): ArrayBuffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000)
  return new ArrayBuffer(numSamples * 2) // 16-bit = 2 bytes per sample
}

// Crear WAV header
function createWavHeader(dataLength: number, sampleRate: number): ArrayBuffer {
  const header = new ArrayBuffer(44)
  const v = new DataView(header)
  const write = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }

  write(0, "RIFF")
  v.setUint32(4, 36 + dataLength, true)
  write(8, "WAVE")
  write(12, "fmt ")
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true) // byte rate
  v.setUint16(32, 2, true) // block align
  v.setUint16(34, 16, true) // bits per sample
  write(36, "data")
  v.setUint32(40, dataLength, true)

  return header
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

    const pcmChunks: ArrayBuffer[] = []
    let detectedSampleRate = 16000

    // Procesar cada segmento
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const text = (seg.text || "").trim()
      if (!text) continue

      // Dividir texto largo en chunks manejables
      const textChunks = splitText(text)

      for (let j = 0; j < textChunks.length; j++) {
        try {
          const audioBuffer = await generateSpeech(textChunks[j])
          const { pcm, sampleRate } = extractPCMData(audioBuffer)

          if (pcm.byteLength > 0) {
            detectedSampleRate = sampleRate
            pcmChunks.push(pcm)
          }

          // Pausa corta entre chunks del mismo segmento
          if (j < textChunks.length - 1) {
            pcmChunks.push(generateSilence(150, detectedSampleRate))
          }

          // Rate limit entre requests
          await new Promise(r => setTimeout(r, 150))
        } catch (chunkErr: any) {
          console.error(`Error en segmento ${i}, chunk ${j}:`, chunkErr.message)
          // Agregar silencio en lugar del chunk fallido
          pcmChunks.push(generateSilence(500, detectedSampleRate))
        }
      }

      // Pausa entre segmentos (cambio de speaker)
      if (i < segments.length - 1) {
        pcmChunks.push(generateSilence(600, detectedSampleRate))
      }
    }

    if (pcmChunks.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se pudo generar audio. Verifica tu HF_API_KEY." },
        { status: 422 }
      )
    }

    // Concatenar todo el PCM
    const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0)
    const wavHeader = createWavHeader(totalLength, detectedSampleRate)
    const finalBuffer = new Uint8Array(44 + totalLength)
    finalBuffer.set(new Uint8Array(wavHeader), 0)

    let offset = 44
    for (const chunk of pcmChunks) {
      finalBuffer.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

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
