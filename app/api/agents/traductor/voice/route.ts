import { EdgeTTS, Constants } from "@andresaya/edge-tts"
import Groq from "groq-sdk"
import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_AUDIO_BYTES = 12 * 1024 * 1024

function languagePair(rawLanguage: unknown, text: string) {
  const normalized = String(rawLanguage || "").trim().toLowerCase()
  const looksSpanish = normalized === "es"
    || normalized.includes("spanish")
    || normalized.includes("español")
    || /[¿¡ñáéíóúü]/i.test(text)

  if (looksSpanish) {
    return {
      sourceCode: "es" as const,
      targetCode: "en" as const,
      sourceLanguage: "Español",
      targetLanguage: "English",
      targetVoice: "en-US-AriaNeural",
    }
  }

  return {
    sourceCode: "en" as const,
    targetCode: "es" as const,
    sourceLanguage: "English",
    targetLanguage: "Español",
    targetVoice: "es-CL-CatalinaNeural",
  }
}

function cleanTranslation(text: string) {
  return text
    .trim()
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^(traducción|translation)\s*:\s*/i, "")
    .replace(/^[“\"]|[”\"]$/g, "")
    .trim()
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: "El modo voz necesita GROQ_API_KEY en Vercel." }, { status: 503 })
  }

  try {
    const formData = await req.formData()
    const audio = formData.get("audio")

    if (!(audio instanceof File)) {
      return Response.json({ error: "No se recibió audio." }, { status: 400 })
    }
    if (audio.size === 0) {
      return Response.json({ error: "La grabación está vacía." }, { status: 400 })
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "La grabación es demasiado grande." }, { status: 413 })
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const transcription = await groq.audio.transcriptions.create({
      file: audio as any,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      temperature: 0,
    }) as any

    const original = String(transcription.text || "").trim().slice(0, 1200)
    if (!original) {
      return Response.json({ error: "No pude reconocer lo que dijiste." }, { status: 422 })
    }

    const pair = languagePair(transcription.language, original)
    const direction = pair.sourceCode === "es" ? "del español al inglés" : "del inglés al español de Chile"
    const result = await callAI([
      {
        role: "system",
        content: `Eres MIRA, una intérprete simultánea profesional. Traduce ${direction}. Devuelve únicamente la traducción natural de la frase hablada, sin títulos, comillas, explicaciones, notas ni formato Markdown. Conserva el tono, la intención y los nombres propios.`,
      },
      { role: "user", content: original },
    ], { maxTokens: 500 })

    const translated = cleanTranslation(result.text).slice(0, 1600)
    if (!translated) {
      return Response.json({ error: "No se pudo generar la traducción." }, { status: 500 })
    }

    let audioBase64: string | undefined
    try {
      const tts = new EdgeTTS()
      await tts.synthesize(translated, pair.targetVoice, {
        rate: "-4%",
        volume: "100%",
        pitch: "+0Hz",
        outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
      })
      audioBase64 = tts.toBuffer().toString("base64")
    } catch (ttsError) {
      console.error("MIRA voice TTS fallback:", ttsError)
    }

    return Response.json({
      original,
      translated,
      sourceCode: pair.sourceCode,
      targetCode: pair.targetCode,
      sourceLanguage: pair.sourceLanguage,
      targetLanguage: pair.targetLanguage,
      detectedLanguage: transcription.language || pair.sourceCode,
      audioBase64,
      audioMime: audioBase64 ? "audio/mpeg" : undefined,
      provider: result.provider,
    })
  } catch (error) {
    console.error("MIRA live voice error:", error)
    return Response.json({
      error: error instanceof Error ? error.message : "No se pudo procesar la conversación de voz.",
    }, { status: 500 })
  }
}
