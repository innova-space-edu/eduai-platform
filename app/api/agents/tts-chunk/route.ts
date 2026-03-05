// src/app/api/agents/tts-chunk/route.ts
// Proxy TTS: convierte UN texto corto a audio WAV via Hugging Face (server-side)
// El cliente llama esto N veces y concatena los resultados

import { NextRequest, NextResponse } from "next/server"

const HF_MODEL = "facebook/mms-tts-spa"

// ✅ Nuevo endpoint recomendado por Hugging Face (api-inference -> router)
const HF_BASE = "https://router.huggingface.co/hf-inference"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Texto vacío" }, { status: 400 })
    }

    const cleanText = text.trim().substring(0, 300)
    const hfToken = process.env.HF_API_KEY || process.env.HF_TOKEN || ""

    // Importante: en Vercel SI o SI debe estar seteado
    if (!hfToken) {
      return NextResponse.json(
        { error: "Falta HF_TOKEN/HF_API_KEY en variables de entorno (Vercel)" },
        { status: 500 }
      )
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${hfToken}`,
      // Pedimos audio WAV explícitamente
      "Accept": "audio/wav",
      // suele ayudar a que espere el modelo en vez de responder 503
      "x-wait-for-model": "true",
    }

    const url = `${HF_BASE}/models/${HF_MODEL}`

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: cleanText }),
      // TTS puede tardar más que 9s en serverless
      signal: AbortSignal.timeout(30000),
    })

    if (res.status === 503) {
      return NextResponse.json(
        { error: "Modelo cargando (503). Reintenta en unos segundos." },
        { status: 503 }
      )
    }

    if (!res.ok) {
      const ct = res.headers.get("content-type") || ""
      const errText = ct.includes("application/json")
        ? JSON.stringify(await res.json().catch(() => ({})))
        : await res.text()

      return NextResponse.json(
        { error: `HF error ${res.status}: ${errText}` },
        { status: 502 }
      )
    }

    const audioBuffer = await res.arrayBuffer()

    // Validar WAV (RIFF). Si HF devolvió JSON, esto lo detecta.
    const buf = Buffer.from(audioBuffer)
    if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
      const ct = res.headers.get("content-type") || ""
      let tail = ""
      try {
        if (ct.includes("application/json")) {
          const j = JSON.parse(buf.toString("utf-8"))
          tail = JSON.stringify(j)
        } else {
          tail = buf.toString("utf-8").slice(0, 500)
        }
      } catch {
        tail = buf.toString("utf-8").slice(0, 500)
      }

      return NextResponse.json(
        { error: `Respuesta de HF no es WAV válido. content-type=${ct}. body=${tail}` },
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
    console.error("TTS chunk error:", err)
    return NextResponse.json(
      { error: err?.message || "Error generando audio" },
      { status: 500 }
    )
  }
}
