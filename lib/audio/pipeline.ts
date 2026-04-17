// lib/audio/pipeline.ts — v3
// Chain: External → Groq Whisper (whisper-large-v3-turbo) → Gemini fallback
// Groq Whisper returns real timestamps; diarization runs as a text-only Gemini pass after.

import { createClient } from "@/lib/supabase/server"
import { getAudioPipelineConfig, hasExternalAudioPipeline } from "./server-config"
import {
  AudioPipelineOptions,
  AudioPipelineRequest,
  AudioSpeaker,
  AudioSegment,
  AudioTranscriptionResponse,
} from "./types"

const GEMINI_MODEL     = "gemini-2.5-flash"
const GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeOptions(options?: AudioPipelineOptions) {
  const cfg = getAudioPipelineConfig()
  return {
    mode:            options?.mode            || cfg.defaultMode,
    improveAudio:    !!options?.improveAudio,
    preciseSubtitles:!!options?.preciseSubtitles,
    diarize:         !!options?.diarize,
    detectLanguage:  options?.detectLanguage !== false,
    speakerLabels:   options?.speakerLabels  || [],
    createSummary:   !!options?.createSummary,
  }
}

function estimateDurationSecs(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(10, Math.round(words / 2.4)) // ~144 wpm
}

function formatDuration(secs: number) {
  if (secs < 60)  return `${secs} seg`
  const m = Math.round(secs / 60)
  return `${m} min`
}

function fallbackSegmentsFromParagraphs(text: string, diarize = false): AudioSegment[] {
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  let cursor = 0
  return blocks.map((block, idx) => {
    const cleaned     = block.replace(/^\[.+?\]\s*/, "")
    const speakerMatch = diarize ? block.match(/^\[(.+?)\]\s*/) : null
    const dur          = Math.max(3, Math.ceil(cleaned.length / 16))
    const segment: AudioSegment = {
      id:      `seg_${idx + 1}`,
      start:   cursor,
      end:     cursor + dur,
      text:    cleaned,
      speaker: speakerMatch?.[1],
    }
    cursor += dur
    return segment
  })
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function saveInitialRecord(args: {
  userId: string; fileName: string; fileSizeBytes?: number; mimeType: string; mode: string
}) {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from("audio_transcriptions")
      .insert({
        user_id:         args.userId,
        file_name:       args.fileName,
        file_size_bytes: args.fileSizeBytes || null,
        audio_format:    args.mimeType.split("/")[1]?.replace("mpeg", "mp3") || "audio",
        status:          "processing",
        model_used:      "groq-whisper-large-v3-turbo",
        processing_mode: args.mode,
      })
      .select("id")
      .single()
    if (error) return null
    return data?.id || null
  } catch { return null }
}

async function updateRecord(id: string | null, payload: Record<string, unknown>) {
  if (!id) return
  const supabase = await createClient()
  try {
    await supabase.from("audio_transcriptions").update(payload).eq("id", id)
  } catch {}
}

// ─── External pipeline ────────────────────────────────────────────────────────

async function runExternalPipeline(
  req: AudioPipelineRequest,
  options: ReturnType<typeof normalizeOptions>
) {
  const cfg = getAudioPipelineConfig()
  const res = await fetch(`${cfg.providerUrl.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.providerToken ? { Authorization: `Bearer ${cfg.providerToken}` } : {}),
    },
    body: JSON.stringify({ ...req, options }),
  })
  if (!res.ok) throw new Error(`Audio pipeline externo respondió ${res.status}`)
  return res.json()
}

// ─── Groq Whisper pipeline ────────────────────────────────────────────────────
// Uses whisper-large-v3-turbo via multipart/form-data (OpenAI-compatible)
// Returns real segment timestamps, language detection, and optionally word-level stamps.

async function runGroqWhisperPipeline(
  req: AudioPipelineRequest,
  options: ReturnType<typeof normalizeOptions>
): Promise<any> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY no configurada")

  // Groq max: 25 MB binary. Base64 size ~ 1.37x binary.
  const estimatedBinaryMB = (req.audioBase64.length * 0.75) / (1024 * 1024)
  if (estimatedBinaryMB > 24) {
    throw new Error(`Archivo demasiado grande para Groq Whisper (~${estimatedBinaryMB.toFixed(0)} MB). Máximo 25 MB.`)
  }

  // Build multipart form
  const audioBuffer = Buffer.from(req.audioBase64, "base64")
  const blob        = new Blob([audioBuffer], { type: req.mimeType })
  const formData    = new FormData()

  // Pick model: pro mode → large-v3 (more accurate), quick → turbo (faster)
  const model = options.mode === "pro" ? "whisper-large-v3" : "whisper-large-v3-turbo"

  const fileName = req.fileName || "audio.mp3"
  formData.append("file",             blob, fileName)
  formData.append("model",            model)
  formData.append("response_format",  "verbose_json")
  formData.append("timestamp_granularities[]", "segment")
  // Add word-level timestamps only in pro mode (larger response)
  if (options.mode === "pro") {
    formData.append("timestamp_granularities[]", "word")
  }
  formData.append("temperature", "0")

  const res = await fetch(GROQ_WHISPER_URL, {
    method:  "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body:    formData,
    signal:  AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`Groq Whisper respondió ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()

  const transcript     = String(data?.text || "").trim()
  const language       = String(data?.language || "es")
  const durationSecs   = Number(data?.duration || estimateDurationSecs(transcript))
  const durationEst    = formatDuration(Math.round(durationSecs))

  // Map Groq segments → our AudioSegment format
  const rawSegments: AudioSegment[] = Array.isArray(data?.segments)
    ? data.segments.map((seg: any, idx: number) => ({
        id:         `seg_${idx + 1}`,
        start:      Number(seg.start ?? 0),
        end:        Number(seg.end ?? 0),
        text:       String(seg.text ?? "").trim(),
        confidence: seg.avg_logprob != null
          ? Math.min(1, Math.max(0, 1 + Number(seg.avg_logprob) / 2))
          : undefined,
        words: Array.isArray(seg.words)
          ? seg.words.map((w: any) => ({
              word:  String(w.word ?? ""),
              start: Number(w.start ?? 0),
              end:   Number(w.end ?? 0),
            }))
          : undefined,
      })).filter((s: AudioSegment) => s.text)
    : fallbackSegmentsFromParagraphs(transcript)

  // Optional: post-process diarization via Gemini text analysis
  let segments    = rawSegments
  let speakers: AudioSpeaker[] = []

  if (options.diarize && transcript.length > 50) {
    try {
      const diarResult = await runTextDiarization(transcript, rawSegments, options.speakerLabels)
      segments = diarResult.segments
      speakers = diarResult.speakers
    } catch (err) {
      console.warn("[Audio][diarize] Text diarization failed, skipping:", err)
      // Keep non-diarized segments
    }
  }

  // Optional: generate summary via Gemini
  let summary = ""
  if (options.createSummary && transcript.length > 100) {
    try {
      summary = await runGeminiSummary(transcript, language)
    } catch { /* non-fatal */ }
  }

  const qualityNotes = [
    `Groq ${model}`,
    options.diarize && speakers.length ? `${speakers.length} hablantes detectados` : null,
    options.createSummary && summary ? "Con resumen" : null,
  ].filter(Boolean).join(" · ")

  return {
    transcript,
    transcriptClean: transcript,
    language,
    durationEstimate: durationEst,
    qualityNotes,
    provider: "groq-whisper",
    mode: options.mode,
    speakers,
    segments,
    summary,
    metadata: {
      model,
      durationSecs,
      segmentCount: segments.length,
      wordLevelTimestamps: options.mode === "pro",
      diarizationApplied: options.diarize && speakers.length > 0,
      summaryGenerated: !!summary,
    },
    modelUsed: model,
  }
}

// ─── Text-based diarization (Gemini on transcript) ───────────────────────────
// Much cheaper than audio diarization — works well for classes and meetings.

async function runTextDiarization(
  transcript: string,
  segments: AudioSegment[],
  speakerLabels: string[]
): Promise<{ segments: AudioSegment[]; speakers: AudioSpeaker[] }> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) throw new Error("No GEMINI_API_KEY for diarization")

  const labelHint = speakerLabels.length
    ? `Los hablantes se llaman: ${speakerLabels.join(", ")}.`
    : "Llama a los hablantes HABLANTE_1, HABLANTE_2, etc. Intenta inferir su rol (Docente, Estudiante, Presentador, etc.)."

  const segmentList = segments.slice(0, 80).map((s, i) =>
    `[${i}] ${s.text}`
  ).join("\n")

  const prompt = `Eres un experto en diarización. Tienes una transcripción dividida en segmentos numerados.
Tu tarea: asignar un hablante a cada segmento basándote en cambios de voz, contexto y vocabulario.

${labelHint}

SEGMENTOS:
${segmentList}

Responde SOLO JSON válido:
{
  "speakers": [{"id":"HABLANTE_1","estimatedRole":"Docente"}],
  "assignments": {"0":"HABLANTE_1","1":"HABLANTE_2"}
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  )

  if (!res.ok) throw new Error(`Gemini diarization respondió ${res.status}`)

  const data   = await res.json()
  const raw    = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
  const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim())

  const assignments: Record<string, string> = parsed?.assignments || {}
  const speakerDefs: AudioSpeaker[]          = Array.isArray(parsed?.speakers)
    ? parsed.speakers.map((sp: any) => ({ id: String(sp.id), estimatedRole: sp.estimatedRole || "Desconocido" }))
    : []

  const diarizedSegments: AudioSegment[] = segments.map((seg, i) => ({
    ...seg,
    speaker: assignments[String(i)] || undefined,
  }))

  return { segments: diarizedSegments, speakers: speakerDefs }
}

// ─── Gemini summary (text-only, cheap) ───────────────────────────────────────

async function runGeminiSummary(transcript: string, language: string): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) return ""

  const prompt = `Resume esta transcripción de audio en 3-5 oraciones claras y concisas.
Idioma de respuesta: ${language === "en" ? "inglés" : "español"}.
Transcripción:
${transcript.slice(0, 8000)}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
      }),
      signal: AbortSignal.timeout(20_000),
    }
  )
  if (!res.ok) return ""
  const data = await res.json()
  return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim()
}

// ─── Gemini audio fallback (last resort) ─────────────────────────────────────

async function runGeminiFallback(
  req: AudioPipelineRequest,
  options: ReturnType<typeof normalizeOptions>
): Promise<any> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no configurada")

  const speakerInstruction = options.diarize
    ? "Etiqueta cambios de hablante como [Hablante 1], [Hablante 2] cuando sea razonable."
    : "Si solo detectas un hablante, no uses etiquetas de hablante."

  const prompt = `Transcribe este audio de forma fiel y estructurada.

OBJETIVO:
- Entregar transcripción completa y exacta
- Detectar idioma automáticamente
- ${speakerInstruction}
- Si hay fragmentos ininteligibles usa [inaudible]
- Organiza el texto con párrafos naturales (doble salto de línea entre bloques)
- Estima timestamps aproximados para cada segmento

DEVUELVE SOLO JSON VÁLIDO:
{
  "transcript": "...",
  "language": "es",
  "qualityNotes": "",
  "summary": "${options.createSummary ? "Resumen de 2-3 oraciones" : ""}",
  "speakers": [{"id":"Hablante 1","estimatedRole":"desconocido"}],
  "segments": [
    {"start":0,"end":6,"speaker":"Hablante 1","text":"..."}
  ]
}`

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: req.mimeType, data: req.audioBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    }
  )

  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`)

  const data   = await res.json()
  const raw    = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
  if (!raw)    throw new Error("Gemini devolvió respuesta vacía")

  let parsed: any
  try { parsed = JSON.parse(raw) }
  catch { parsed = { transcript: raw, language: "es", segments: [] } }

  const transcript = String(parsed?.transcript || "").trim()
  if (!transcript)  throw new Error("No se obtuvo transcripción")

  const segments: AudioSegment[] = Array.isArray(parsed?.segments) && parsed.segments.length > 0
    ? parsed.segments.map((seg: any, idx: number) => ({
        id:      `seg_${idx + 1}`,
        start:   Number(seg?.start ?? 0),
        end:     Number(seg?.end ?? 0),
        text:    String(seg?.text ?? "").trim(),
        speaker: seg?.speaker ? String(seg.speaker) : undefined,
      })).filter((s: AudioSegment) => s.text)
    : fallbackSegmentsFromParagraphs(transcript, options.diarize)

  const speakers: AudioSpeaker[] = Array.isArray(parsed?.speakers)
    ? parsed.speakers.map((sp: any, i: number) => ({
        id:            String(sp?.id || `Hablante ${i + 1}`),
        estimatedRole: sp?.estimatedRole ? String(sp.estimatedRole) : "desconocido",
      }))
    : []

  return {
    transcript,
    transcriptClean:  transcript,
    language:         String(parsed?.language || "es"),
    durationEstimate: formatDuration(estimateDurationSecs(transcript)),
    qualityNotes:     `Gemini ${GEMINI_MODEL} (fallback)`,
    provider:         "gemini-fallback",
    mode:             options.mode,
    speakers,
    segments,
    summary:          options.createSummary ? String(parsed?.summary || "") : "",
    metadata:         { options, enhancementApplied: false, alignmentApplied: false },
    modelUsed:        GEMINI_MODEL,
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runAudioPipeline(args: {
  userId: string
  request: AudioPipelineRequest
}): Promise<AudioTranscriptionResponse> {
  const options  = normalizeOptions(args.request.options)
  const fileName = args.request.fileName || "audio.mp3"

  const recordId = await saveInitialRecord({
    userId:       args.userId,
    fileName,
    fileSizeBytes:args.request.fileSizeBytes,
    mimeType:     args.request.mimeType,
    mode:         options.mode,
  })

  async function attempt(label: string, fn: () => Promise<any>) {
    try {
      const result = await fn()
      return { result, error: null }
    } catch (e: any) {
      console.warn(`[Audio][${label}] failed:`, e?.message || e)
      return { result: null, error: e }
    }
  }

  let final: any = null
  let lastError: any = null

  // 1️⃣ External pipeline (if AUDIO_PIPELINE_URL set)
  if (hasExternalAudioPipeline()) {
    const { result, error } = await attempt("external", () =>
      runExternalPipeline(args.request, options)
    )
    if (result) final = result
    else lastError = error
  }

  // 2️⃣ Groq Whisper (primary cloud provider)
  if (!final && process.env.GROQ_API_KEY) {
    const { result, error } = await attempt("groq-whisper", () =>
      runGroqWhisperPipeline(args.request, options)
    )
    if (result) final = result
    else lastError = error
  }

  // 3️⃣ Gemini fallback (last resort)
  if (!final) {
    const { result, error } = await attempt("gemini", () =>
      runGeminiFallback(args.request, options)
    )
    if (result) final = result
    else lastError = error
  }

  if (!final) {
    await updateRecord(recordId, {
      status:        "error",
      error_message: lastError?.message || "Todos los proveedores fallaron",
      updated_at:    new Date().toISOString(),
    })
    throw lastError || new Error("No se pudo transcribir el audio")
  }

  await updateRecord(recordId, {
    transcript_raw:  final.transcript,
    transcript_clean:final.transcriptClean || final.transcript,
    summary:         final.summary || null,
    language:        final.language,
    speakers:        JSON.stringify(final.speakers || []),
    duration_hint:   final.durationEstimate || null,
    segments_json:   JSON.stringify(final.segments || []),
    quality_notes:   final.qualityNotes || null,
    metadata_json:   JSON.stringify(final.metadata || {}),
    status:          "done",
    model_used:      final.modelUsed,
    updated_at:      new Date().toISOString(),
  })

  return {
    success:          true,
    id:               recordId,
    transcript:       final.transcript,
    transcriptClean:  final.transcriptClean || final.transcript,
    language:         final.language,
    durationEstimate: final.durationEstimate,
    qualityNotes:     final.qualityNotes,
    provider:         final.provider,
    mode:             final.mode,
    speakers:         final.speakers,
    segments:         final.segments,
    summary:          final.summary,
    metadata:         final.metadata,
    modelUsed:        final.modelUsed,
  }
}
