import { createClient } from "@/lib/supabase/server"
import { getAudioPipelineConfig, hasExternalAudioPipeline } from "./server-config"
import {
  AudioPipelineOptions,
  AudioPipelineRequest,
  AudioSpeaker,
  AudioSegment,
  AudioTranscriptionResponse,
} from "./types"

const GEMINI_MODEL = "gemini-2.5-flash"

function normalizeOptions(options?: AudioPipelineOptions) {
  const cfg = getAudioPipelineConfig()
  return {
    mode: options?.mode || cfg.defaultMode,
    improveAudio: !!options?.improveAudio,
    preciseSubtitles: !!options?.preciseSubtitles,
    diarize: !!options?.diarize,
    detectLanguage: options?.detectLanguage !== false,
    speakerLabels: options?.speakerLabels || [],
    createSummary: !!options?.createSummary,
  }
}

function estimateDurationFromWords(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.round(words / 145))
  return `${minutes} min`
}

function fallbackSegmentsFromParagraphs(text: string, diarize = false): AudioSegment[] {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  let cursor = 0
  return blocks.map((block, idx) => {
    const cleaned = block.replace(/^\[(.+?)\]\s*/, "")
    const speakerMatch = diarize ? block.match(/^\[(.+?)\]\s*/) : null
    const dur = Math.max(3, Math.ceil(cleaned.length / 16))
    const segment: AudioSegment = {
      id: `seg_${idx + 1}`,
      start: cursor,
      end: cursor + dur,
      text: cleaned,
      speaker: speakerMatch?.[1],
    }
    cursor += dur
    return segment
  })
}

async function saveInitialRecord(args: {
  userId: string
  fileName: string
  fileSizeBytes?: number
  mimeType: string
  mode: string
}) {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from("audio_transcriptions")
      .insert({
        user_id: args.userId,
        file_name: args.fileName,
        file_size_bytes: args.fileSizeBytes || null,
        audio_format: args.mimeType.split("/")[1]?.replace("mpeg", "mp3") || "audio",
        status: "processing",
        model_used: GEMINI_MODEL,
        processing_mode: args.mode,
      })
      .select("id")
      .single()
    if (error) return null
    return data?.id || null
  } catch {
    return null
  }
}

async function updateRecord(id: string | null, payload: Record<string, unknown>) {
  if (!id) return
  const supabase = await createClient()
  try {
    await supabase.from("audio_transcriptions").update(payload).eq("id", id)
  } catch {
    // tabla puede no estar migrada todavía
  }
}

async function runExternalPipeline(req: AudioPipelineRequest, options: ReturnType<typeof normalizeOptions>) {
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

async function runGeminiFallback(req: AudioPipelineRequest, options: ReturnType<typeof normalizeOptions>) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no configurada")

  const speakerInstruction = options.diarize
    ? "Etiqueta cambios de hablante como [Hablante 1], [Hablante 2] cuando sea razonable."
    : "Si solo detectas un hablante, no uses etiquetas."

  const prompt = `Transcribe este audio de forma fiel y estructurada.

OBJETIVO:
- Entregar transcripción completa
- Detectar idioma
- ${speakerInstruction}
- Si hay fragmentos ininteligibles usa [inaudible]
- Organiza con párrafos naturales

DEVUELVE SOLO JSON VÁLIDO:
{
  "transcript": "...",
  "language": "es",
  "qualityNotes": "",
  "summary": "",
  "speakers": [{"id":"Hablante 1","estimatedRole":"desconocido"}],
  "segments": [
    {"start":0,"end":6,"speaker":"Hablante 1","text":"..."}
  ]
}
`

  const body = {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: req.mimeType,
            data: req.audioBase64,
          },
        },
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
    }
  )

  if (!res.ok) throw new Error(`Gemini fallback respondió ${res.status}`)
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
  if (!raw) throw new Error("Gemini devolvió respuesta vacía")

  let parsed: any = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = { transcript: raw, language: "es", segments: [] }
  }

  const transcript = String(parsed?.transcript || "").trim()
  if (!transcript) throw new Error("No se obtuvo transcripción")

  const segments = Array.isArray(parsed?.segments) && parsed.segments.length > 0
    ? parsed.segments.map((seg: any, idx: number) => ({
        id: `seg_${idx + 1}`,
        start: Number(seg?.start || 0),
        end: Number(seg?.end || 0),
        text: String(seg?.text || "").trim(),
        speaker: seg?.speaker ? String(seg.speaker) : undefined,
      })).filter((seg: AudioSegment) => seg.text)
    : fallbackSegmentsFromParagraphs(transcript, options.diarize)

  const speakers: AudioSpeaker[] = Array.isArray(parsed?.speakers)
    ? parsed.speakers.map((sp: any, idx: number) => ({
        id: String(sp?.id || `Hablante ${idx + 1}`),
        estimatedRole: sp?.estimatedRole ? String(sp.estimatedRole) : "desconocido",
      }))
    : []

  return {
    transcript,
    transcriptClean: transcript,
    language: String(parsed?.language || "es"),
    durationEstimate: String(parsed?.durationEstimate || estimateDurationFromWords(transcript)),
    qualityNotes: String(parsed?.qualityNotes || (options.improveAudio ? "Modo robusto activado sin enhancement externo" : "")),
    provider: "gemini-fallback",
    mode: options.mode,
    speakers,
    segments,
    summary: options.createSummary ? String(parsed?.summary || "") : "",
    metadata: {
      options,
      enhancementApplied: false,
      alignmentApplied: false,
      diarizationApplied: options.diarize,
    },
    modelUsed: GEMINI_MODEL,
  }
}

export async function runAudioPipeline(args: { userId: string; request: AudioPipelineRequest }): Promise<AudioTranscriptionResponse> {
  const options = normalizeOptions(args.request.options)
  const fileName = args.request.fileName || "audio.mp3"
  const recordId = await saveInitialRecord({
    userId: args.userId,
    fileName,
    fileSizeBytes: args.request.fileSizeBytes,
    mimeType: args.request.mimeType,
    mode: options.mode,
  })

  try {
    const result = hasExternalAudioPipeline()
      ? await runExternalPipeline(args.request, options)
      : await runGeminiFallback(args.request, options)

    await updateRecord(recordId, {
      transcript_raw: result.transcript,
      transcript_clean: result.transcriptClean || result.transcript,
      summary: result.summary || null,
      language: result.language,
      speakers: JSON.stringify(result.speakers || []),
      duration_hint: result.durationEstimate || null,
      segments_json: JSON.stringify(result.segments || []),
      quality_notes: result.qualityNotes || null,
      metadata_json: JSON.stringify(result.metadata || {}),
      status: "done",
      model_used: result.modelUsed,
      updated_at: new Date().toISOString(),
    })

    return {
      success: true,
      id: recordId,
      transcript: result.transcript,
      transcriptClean: result.transcriptClean || result.transcript,
      language: result.language,
      durationEstimate: result.durationEstimate,
      qualityNotes: result.qualityNotes,
      provider: result.provider,
      mode: result.mode,
      speakers: result.speakers,
      segments: result.segments,
      summary: result.summary,
      metadata: result.metadata,
      modelUsed: result.modelUsed,
    }
  } catch (error: any) {
    await updateRecord(recordId, {
      status: "error",
      error_message: error?.message || "Audio pipeline error",
      updated_at: new Date().toISOString(),
    })
    throw error
  }
}
