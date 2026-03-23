/**
 * app/api/agents/transcription/route.ts
 * AGT-Transcripción — EduAI Audio Lab
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime     = "nodejs"
export const maxDuration = 120

// gemini-2.0-flash-exp soporta audio multimodal y es más rápido/estable
const GEMINI_MODEL = "gemini-2.0-flash-exp"

const TRANSCRIPTION_PROMPT = `Transcribe este archivo de audio completa y fielmente.

REGLAS:
1. Transcribe CADA palabra pronunciada — NO resumir
2. Detecta y etiqueta hablantes como [Hablante 1], [Hablante 2], etc.
   - Si hay un solo hablante, omite las etiquetas
   - Cada cambio de hablante en nueva línea
3. Agrega saltos de párrafo en pausas naturales o cambios de tema
4. Detecta el idioma y responde en ese mismo idioma
5. Si el audio es ininteligible en algún fragmento, escribe [inaudible]

Responde SOLO con JSON válido, sin markdown, sin backticks:
{
  "transcript": "texto completo de la transcripción",
  "language": "es",
  "speakerCount": 1,
  "speakers": [
    { "id": "Hablante 1", "estimatedRole": "profesor" }
  ],
  "durationEstimate": "5 min",
  "qualityNotes": ""
}`

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  // ── Validar body ──────────────────────────────────────────────────────────
  let body: { audioBase64?: string; mimeType?: string; fileName?: string; fileSizeBytes?: number }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { audioBase64, mimeType, fileName = "audio.mp3", fileSizeBytes } = body

  if (!audioBase64 || !mimeType) {
    return NextResponse.json({ error: "Faltan audioBase64 y mimeType" }, { status: 400 })
  }

  const VALID_MIMES = [
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/mp4",
    "audio/webm", "audio/m4a", "audio/ogg",
    "video/mp4",  "video/webm",
  ]
  if (!VALID_MIMES.includes(mimeType)) {
    return NextResponse.json({ error: `Formato no soportado: ${mimeType}` }, { status: 400 })
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY no configurada en el servidor" }, { status: 500 })
  }

  // ── Intentar guardar en DB (silencioso si la tabla no existe) ────────────
  let recordId: string | null = null
  try {
    const { data: record, error: insertError } = await supabase
      .from("audio_transcriptions")
      .insert({
        user_id:         user.id,
        file_name:       fileName,
        file_size_bytes: fileSizeBytes || null,
        audio_format:    mimeType.split("/")[1]?.replace("mpeg", "mp3") || "mp3",
        status:          "processing",
        model_used:      GEMINI_MODEL,
      })
      .select("id")
      .single()

    if (!insertError && record) recordId = record.id
  } catch { /* tabla puede no existir aún */ }

  // ── Llamar a Gemini API REST directamente (más estable que el SDK) ────────
  try {
    const geminiBody = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data:      audioBase64,
            },
          },
          { text: TRANSCRIPTION_PROMPT },
        ],
      }],
      generationConfig: {
        temperature:     0.1,
        maxOutputTokens: 8192,
      },
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(geminiBody),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      throw new Error(`Gemini API error ${geminiRes.status}: ${errText.slice(0, 200)}`)
    }

    const geminiData = await geminiRes.json()
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

    if (!raw) throw new Error("Gemini no devolvió texto")

    // ── Parsear JSON ───────────────────────────────────────────────────────
    let parsed: any = {}
    try {
      const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
      parsed = JSON.parse(clean)
    } catch {
      // Si no viene como JSON válido, usar el texto crudo
      parsed = {
        transcript:       raw,
        language:         "es",
        speakerCount:     1,
        speakers:         [],
        durationEstimate: "",
        qualityNotes:     "Respuesta en texto plano (sin estructura JSON)",
      }
    }

    const transcript   = String(parsed?.transcript     || "").trim()
    const language     = String(parsed?.language       || "es")
    const speakers     = Array.isArray(parsed?.speakers) ? parsed.speakers : []
    const durationHint = String(parsed?.durationEstimate || "")

    if (!transcript) throw new Error("La transcripción resultó vacía")

    // ── Actualizar DB ──────────────────────────────────────────────────────
    if (recordId) {
      await supabase
        .from("audio_transcriptions")
        .update({
          transcript_raw:   transcript,
          transcript_clean: transcript,
          language,
          speakers:         JSON.stringify(speakers),
          duration_hint:    durationHint,
          status:           "done",
          updated_at:       new Date().toISOString(),
        })
        .eq("id", recordId)
    }

    return NextResponse.json({
      success:         true,
      id:              recordId,
      transcript,
      language,
      speakers,
      durationEstimate: durationHint,
      qualityNotes:    parsed?.qualityNotes || "",
    })

  } catch (err: any) {
    console.error("transcription error:", err?.message || err)

    if (recordId) {
      await supabase
        .from("audio_transcriptions")
        .update({ status: "error", error_message: err?.message || "Error desconocido" })
        .eq("id", recordId)
    }

    return NextResponse.json(
      { error: err?.message || "Error transcribiendo el audio" },
      { status: 500 }
    )
  }
}
