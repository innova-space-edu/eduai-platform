/**
 * app/api/agents/transcription/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AGT-Transcripción — EduAI Audio Lab
 *
 * Flujo:
 *   1. Recibe audio en base64 + metadata del cliente
 *   2. Envía a Gemini 2.5 Flash (multimodal audio input)
 *   3. Obtiene transcripción + detección de hablantes + idioma
 *   4. Guarda en tabla audio_transcriptions
 *   5. Devuelve { id, transcript, speakers, language }
 *
 * Body esperado:
 *   {
 *     audioBase64: string,      // base64 del archivo de audio
 *     mimeType: string,         // "audio/mpeg" | "audio/wav" | etc.
 *     fileName: string,
 *     fileSizeBytes?: number,
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime    = "nodejs"
export const maxDuration = 120   // transcripciones largas pueden tardar

const GEMINI_MODEL = "gemini-2.5-flash"

const TRANSCRIPTION_PROMPT = `Transcribe this audio file completely and accurately.

RULES:
1. Transcribe every word spoken — do NOT summarize
2. Preserve the natural flow and speech patterns
3. Detect and label different speakers as [Hablante 1], [Hablante 2], etc.
   - If only one speaker, omit speaker labels
   - Start each speaker change on a new line
4. Add paragraph breaks at natural pauses or topic changes
5. Correct obvious transcription errors (filler words like "um", "eh" are OK to keep if natural)
6. Detect the language and respond in that same language
7. Format timestamps like [00:00] at the start of each speaker turn if detectable

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "transcript": "full transcription text with speaker labels and line breaks",
  "language": "es|en|fr|...",
  "speakerCount": 1,
  "speakers": [
    { "id": "Hablante 1", "estimatedRole": "profesor|estudiante|entrevistador|desconocido" }
  ],
  "durationEstimate": "approximate duration like '5 min' or '1h 20min'",
  "qualityNotes": "any quality issues like background noise, unclear audio, etc."
}`

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── Validar body ──────────────────────────────────────────────────────────
  let body: { audioBase64?: string; mimeType?: string; fileName?: string; fileSizeBytes?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { audioBase64, mimeType, fileName = "audio.mp3", fileSizeBytes } = body

  if (!audioBase64 || !mimeType) {
    return NextResponse.json({ error: "Faltan audioBase64 y mimeType" }, { status: 400 })
  }

  const VALID_MIMES = ["audio/mpeg","audio/mp3","audio/wav","audio/mp4","audio/webm","audio/m4a","video/mp4","video/webm"]
  if (!VALID_MIMES.includes(mimeType)) {
    return NextResponse.json({ error: `mimeType no soportado: ${mimeType}` }, { status: 400 })
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 })
  }

  // ── Crear registro en DB con status "processing" ───────────────────────────
  const { data: record, error: insertError } = await supabase
    .from("audio_transcriptions")
    .insert({
      user_id:        user.id,
      file_name:      fileName,
      file_size_bytes: fileSizeBytes || null,
      audio_format:   mimeType.split("/")[1] || "mp3",
      status:         "processing",
      model_used:     GEMINI_MODEL,
    })
    .select("id")
    .single()

  if (insertError || !record) {
    console.error("audio_transcriptions insert error:", insertError)
    return NextResponse.json({ error: "Error guardando en base de datos" }, { status: 500 })
  }

  const recordId = record.id

  try {
    // ── Llamar a Gemini con audio inline ────────────────────────────────────
    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genai = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genai.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature:     0.1,     // baja temperatura para transcripción precisa
        maxOutputTokens: 16000,   // transcripciones largas
      },
    })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType as any,
          data:     audioBase64,
        },
      },
      { text: TRANSCRIPTION_PROMPT },
    ])

    const raw = result.response.text().trim()

    // ── Parsear respuesta JSON ────────────────────────────────────────────────
    let parsed: any = null
    try {
      // Gemini a veces devuelve ```json ... ``` aunque pedimos que no
      const clean = raw.replace(/```json|```/g, "").trim()
      parsed = JSON.parse(clean)
    } catch {
      // Si no viene como JSON, usar el texto crudo como transcript
      parsed = {
        transcript:       raw,
        language:         "es",
        speakerCount:     1,
        speakers:         [],
        durationEstimate: "desconocida",
        qualityNotes:     "",
      }
    }

    const transcript     = String(parsed?.transcript     || "").trim()
    const language       = String(parsed?.language       || "es")
    const speakers       = Array.isArray(parsed?.speakers) ? parsed.speakers : []
    const durationHint   = String(parsed?.durationEstimate || "")

    if (!transcript) {
      throw new Error("Gemini no devolvió una transcripción válida")
    }

    // ── Actualizar registro en DB ────────────────────────────────────────────
    await supabase
      .from("audio_transcriptions")
      .update({
        transcript_raw:  transcript,
        transcript_clean: transcript,   // limpia = raw inicialmente, el usuario puede editar
        language,
        speakers:        JSON.stringify(speakers),
        duration_hint:   durationHint,
        status:          "done",
        updated_at:      new Date().toISOString(),
      })
      .eq("id", recordId)

    return NextResponse.json({
      success:    true,
      id:         recordId,
      transcript,
      language,
      speakers,
      durationEstimate: durationHint,
      qualityNotes: parsed?.qualityNotes || "",
    })

  } catch (err: any) {
    console.error("transcription error:", err?.message || err)

    // Marcar como error en DB
    await supabase
      .from("audio_transcriptions")
      .update({ status: "error", error_message: err?.message || "Error desconocido" })
      .eq("id", recordId)

    return NextResponse.json(
      { error: err?.message || "Error transcribiendo audio" },
      { status: 500 }
    )
  }
}
