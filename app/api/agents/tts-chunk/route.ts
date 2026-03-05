// src/app/api/agents/tts-chunk/route.ts
// Proxy TTS: convierte UN texto corto a audio WAV via Hugging Face (Server-side)
// El cliente llama esto N veces y concatena (PCM) en frontend

import { NextRequest, NextResponse } from "next/server"

const HF_MODEL = "facebook/mms-tts-spa"

// ✅ Nuevo endpoint recomendado por HF (api-inference fue deprecado / 410)
const HF_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Texto vacío" }, { status: 400 })
    }

    // Limitar tamaño por request para evitar colas/timeouts
    const cleanText = text.trim().substring(0, 350)

    // Token (fine-grained) con "Make calls to Inference Providers"
    const hfToken = process.env.HF_API_KEY || process.env.HF_TOKEN || ""

    // ✅ Si quieres obligar token en producción (recomendado), deja esto activo:
    if (!hfToken) {
      return NextResponse.json(
        { error: "Falta HF_API_KEY o HF_TOKEN en variables de entorno (Vercel)." },
        { status: 500 }
      )
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hfToken}`,
    }

    // Llamar a HF desde el SERVIDOR (sin CORS)
    const res = await fetch(HF_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: cleanText }),
      // timeout seguro para serverless
      signal: AbortSignal.timeout(15000),
    })

    // Modelo cargando / cola
    if (res.status === 503) {
      return NextResponse.json(
        { error: "Modelo cargando (HF 503). Reintenta en unos segundos." },
        { status: 503 }
      )
    }

    // Rate limit
    if (res.status === 429) {
      return NextResponse.json(
        { error: "Rate limit (HF 429). Reintenta en unos segundos." },
        { status: 429 }
      )
    }

    // Token inválido / permisos
    if (res.status === 401 || res.status === 403) {
      const errText = await res.text().catch(() => "")
      return NextResponse.json(
        { error: `HF auth error ${res.status}: ${errText || "Token inválido o sin permisos"}` },
        { status: 401 }
      )
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return NextResponse.json(
        { error: `HF error ${res.status}: ${errText}` },
        { status: 502 }
      )
    }

    const audioBuffer = await res.arrayBuffer()

    // Validar WAV mínimo
    const buf = Buffer.from(audioBuffer)
    if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
      // A veces HF devuelve JSON aunque res.ok (casos raros)
      const asText = buf.toString("utf8").slice(0, 400)
      return NextResponse.json(
        { error: `Respuesta no-WAV desde HF. Inicio: ${asText}` },
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
    const msg = err?.message || "Error generando audio"
    console.error("TTS chunk error:", msg)

    // timeout estándar de AbortSignal.timeout
    if (String(msg).toLowerCase().includes("timeout")) {
      return NextResponse.json(
        { error: "Timeout generando audio (serverless). Reintenta o reduce texto por chunk." },
        { status: 504 }
      )
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
