import { EdgeTTS, Constants } from "@andresaya/edge-tts"
import Groq from "groq-sdk"
import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_AUDIO_BYTES = 12 * 1024 * 1024
const MAX_HISTORY_ITEMS = 8

type VoiceMode = "translate" | "conversation"
type LanguageCode = "es" | "en"
type HistoryItem = { role: "user" | "assistant"; content: string }

const LANGUAGE: Record<LanguageCode, { label: string; voice: string }> = {
  es: { label: "Español", voice: "es-CL-CatalinaNeural" },
  en: { label: "English", voice: "en-US-AriaNeural" },
}

function oppositeLanguage(language: LanguageCode): LanguageCode {
  return language === "es" ? "en" : "es"
}

function normalizeMode(value: FormDataEntryValue | null): VoiceMode {
  return value === "conversation" ? "conversation" : "translate"
}

function normalizeLanguage(value: FormDataEntryValue | null): LanguageCode {
  return value === "en" ? "en" : "es"
}

function cleanResponse(text: string) {
  return text
    .trim()
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^(traducción|translation|respuesta|response)\s*:\s*/i, "")
    .replace(/^[“\"]|[”\"]$/g, "")
    .trim()
}

function parseHistory(value: FormDataEntryValue | null): HistoryItem[] {
  if (typeof value !== "string" || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .map(item => ({
        role: item.role as HistoryItem["role"],
        content: item.content.trim().slice(0, 900),
      }))
      .filter(item => item.content)
      .slice(-MAX_HISTORY_ITEMS)
  } catch {
    return []
  }
}

function conversationPrompt(language: LanguageCode) {
  if (language === "en") {
    return `You are MIRA, a warm and natural English conversation partner in a live voice call.
Reply only in English. Continue the conversation using the recent context.
Keep each answer concise and easy to hear: usually 1 to 3 sentences.
Ask a natural follow-up question when appropriate. If the learner makes a mistake, correct it gently only when useful.
Do not translate, do not use Markdown, titles, bullet points, stage directions or quotation marks.`
  }

  return `Eres MIRA, una compañera de conversación cálida y natural en una llamada de voz en vivo.
Responde únicamente en español de Chile y continúa la conversación usando el contexto reciente.
Mantén cada respuesta breve y fácil de escuchar: normalmente entre 1 y 3 oraciones.
Haz una pregunta de seguimiento natural cuando corresponda. Si la persona comete un error, corrígelo con suavidad solo cuando sea útil.
No traduzcas ni uses Markdown, títulos, listas, acotaciones o comillas.`
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
    const mode = normalizeMode(formData.get("mode"))
    const selectedLanguage = normalizeLanguage(formData.get("language"))
    const history = parseHistory(formData.get("history"))

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
      language: selectedLanguage,
      response_format: "verbose_json",
      temperature: 0,
    }) as any

    const original = String(transcription.text || "").trim().slice(0, 1200)
    if (!original) {
      return Response.json({ error: "No pude reconocer lo que dijiste." }, { status: 422 })
    }

    const sourceCode = selectedLanguage
    const targetCode = mode === "translate" ? oppositeLanguage(sourceCode) : sourceCode
    const sourceLanguage = mode === "conversation"
      ? `Tú · ${LANGUAGE[sourceCode].label}`
      : LANGUAGE[sourceCode].label
    const targetLanguage = mode === "conversation"
      ? `MIRA · ${LANGUAGE[targetCode].label}`
      : LANGUAGE[targetCode].label

    const messages = mode === "conversation"
      ? [
          { role: "system" as const, content: conversationPrompt(selectedLanguage) },
          ...history,
          { role: "user" as const, content: original },
        ]
      : [
          {
            role: "system" as const,
            content: `Eres MIRA, una intérprete simultánea profesional. Traduce del ${LANGUAGE[sourceCode].label} al ${LANGUAGE[targetCode].label}. Devuelve únicamente la traducción natural de la frase hablada, sin títulos, comillas, explicaciones, notas ni formato Markdown. Conserva el tono, la intención y los nombres propios.`,
          },
          { role: "user" as const, content: original },
        ]

    const result = await callAI(messages, { maxTokens: mode === "conversation" ? 650 : 500 })
    const responseText = cleanResponse(result.text).slice(0, 1800)

    if (!responseText) {
      return Response.json({
        error: mode === "conversation"
          ? "No se pudo generar la respuesta de MIRA."
          : "No se pudo generar la traducción.",
      }, { status: 500 })
    }

    let audioBase64: string | undefined
    try {
      const tts = new EdgeTTS()
      await tts.synthesize(responseText, LANGUAGE[targetCode].voice, {
        rate: mode === "conversation" ? "-2%" : "-4%",
        volume: "100%",
        pitch: "+0Hz",
        outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
      })
      audioBase64 = tts.toBuffer().toString("base64")
    } catch (ttsError) {
      console.error("MIRA voice TTS fallback:", ttsError)
    }

    return Response.json({
      mode,
      original,
      responseText,
      translated: responseText,
      reply: responseText,
      sourceCode,
      targetCode,
      sourceLanguage,
      targetLanguage,
      detectedLanguage: transcription.language || sourceCode,
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
