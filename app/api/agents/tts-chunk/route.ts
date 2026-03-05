// src/app/api/agents/tts-chunk/route.ts
// Proxy TTS: convierte UN texto corto a audio WAV via Hugging Face
// El cliente llama esto N veces y concatena los resultados

import { NextRequest, NextResponse } from "next/server"

const HF_MODEL = "facebook/mms-tts-spa"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Texto vacío" }, { status: 400 })
    }

    const cleanText = text.trim().substring(0, 300)
    const hfToken = process.env.HF_API_KEY || process.env.HF_TOKEN || ""

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (hfToken) {
      headers["Authorization"] = `Bearer ${hfToken}`
    }

    // Llamar a HF desde el SERVIDOR (sin CORS)
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ inputs: cleanText }),
        signal: AbortSignal.timeout(9000),
      }
    )

    if (res.status === 503) {
      return NextResponse.json(
        { error: "Modelo cargando, reintenta en unos segundos" },
        { status: 503 }
      )
    }

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: `HF error ${res.status}: ${errText}` },
        { status: 502 }
      )
    }

    const audioBuffer = await res.arrayBuffer()

    // Validar que es un WAV válido
    const buf = Buffer.from(audioBuffer)
    if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
      return NextResponse.json(
        { error: "Respuesta de HF no es audio WAV válido" },
        { status: 502 }
      )
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    console.error("TTS chunk error:", err.message)
    return NextResponse.json(
      { error: err.message || "Error generando audio" },
      { status: 500 }
    )
  }
}
