import Groq from "groq-sdk"
import { runAIText } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_AUDIO_BYTES = 12 * 1024 * 1024
const MAX_HISTORY_ITEMS = 8

type VoiceMode = "translate" | "conversation" | "transcribe"
type LanguageCode = "es" | "en"
type LanguagePreference = LanguageCode | "auto"
type HistoryItem = { role: "user" | "assistant"; content: string }

const LANGUAGE: Record<LanguageCode, { label: string }> = {
  es: { label: "Español" },
  en: { label: "English" },
}

function oppositeLanguage(language: LanguageCode): LanguageCode {
  return language === "es" ? "en" : "es"
}

function normalizeMode(value: FormDataEntryValue | null): VoiceMode {
  if (value === "conversation") return "conversation"
  if (value === "transcribe") return "transcribe"
  return "translate"
}

function normalizeLanguage(value: FormDataEntryValue | null): LanguagePreference {
  if (value === "en") return "en"
  if (value === "es") return "es"
  return "auto"
}

function detectLanguage(rawLanguage: unknown, text: string): LanguageCode {
  const normalized = String(rawLanguage || "").trim().toLowerCase()
  if (normalized === "en" || normalized.includes("english")) return "en"
  if (normalized === "es" || normalized.includes("spanish") || normalized.includes("español")) return "es"
  return /[¿¡ñáéíóúü]/i.test(text) ? "es" : "en"
}

function cleanResponse(text: string) {
  return text
    .trim()
    .replace(/^\`\`\`(?:text)?\s*/i, "")
    .replace(/\`\`\`$/i, "")
    .replace(/^(traducción|translation|respuesta|response)\s*:\s*/i, "")
    .replace(/^[“"]|[”"]$/g, "")
    .trim()
}

function parseHistory(value: FormDataEntryValue | null): HistoryItem[] {
  if (typeof value !== "string" || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .map((item) => ({
        role: item.role as HistoryItem["role"],
        content: item.content.trim().slice(0, 900),
      }))
      .filter((item) => item.content)
      .slice(-MAX_HISTORY_ITEMS)
  } catch {
    return []
  }
}

function conversationPrompt(language: LanguageCode) {
  if (language === "en") {
    return `You are MIRA, EduAI's live voice conversation assistant.
Reply only in natural English and continue the recent conversation.
Answer the user's actual request directly. Keep ordinary voice answers concise (usually 1-4 sentences), but give enough detail when the question requires it.
Use recent context so you do not repeat questions or lose the thread.
If the user asks for an explanation, recommendation, calculation, teaching help, writing help or another general task, answer it instead of turning every turn into small talk.
Do not use Markdown, headings, bullet lists, stage directions or quotation marks unless the user explicitly asks for formatted content.`
  }

  return `Eres MIRA, la asistente de conversación por voz en vivo de EduAI.
Responde únicamente en español natural y continúa la conversación reciente.
Responde directamente a la solicitud real del usuario. En voz, mantén las respuestas normales concisas (usualmente 1 a 4 oraciones), pero entrega suficiente detalle cuando la pregunta lo requiera.
Usa el contexto reciente para no repetir preguntas ni perder el hilo.
Si el usuario pide una explicación, recomendación, cálculo, apoyo docente, redacción u otra tarea general, resuélvela en vez de convertir todo en charla casual.
No uses Markdown, títulos, listas, acotaciones ni comillas salvo que el usuario pida contenido con formato.`
}

export async function POST(req: Request) {
  const requestStartedAt = Date.now()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: "El modo voz necesita GROQ_API_KEY en Vercel." }, { status: 503 })
  }

  try {
    const formData = await req.formData()
    const audio = formData.get("audio")
    const mode = normalizeMode(formData.get("mode"))
    const languagePreference = normalizeLanguage(formData.get("language"))
    const history = parseHistory(formData.get("history"))

    if (!(audio instanceof File)) return Response.json({ error: "No se recibió audio." }, { status: 400 })
    if (audio.size === 0) return Response.json({ error: "La grabación está vacía." }, { status: 400 })
    if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "La grabación es demasiado grande." }, { status: 413 })

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const transcriptionInput: any = {
      file: audio as any,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      temperature: 0,
    }
    if (languagePreference !== "auto") transcriptionInput.language = languagePreference

    const transcription = await groq.audio.transcriptions.create(transcriptionInput) as any
    const original = String(transcription.text || "").trim().slice(0, 1800)
    if (!original) return Response.json({ error: "No pude reconocer lo que dijiste." }, { status: 422 })

    const sourceCode: LanguageCode = languagePreference === "auto"
      ? detectLanguage(transcription.language, original)
      : languagePreference
    const sourceLanguage = LANGUAGE[sourceCode].label

    if (mode === "transcribe") {
      return Response.json({
        mode,
        original,
        transcript: original,
        sourceCode,
        sourceLanguage: `Tú · ${sourceLanguage}`,
        detectedLanguage: transcription.language || sourceCode,
        latencyMs: Date.now() - requestStartedAt,
      })
    }

    const targetCode = mode === "translate" ? oppositeLanguage(sourceCode) : sourceCode
    const targetLanguage = mode === "conversation"
      ? `MIRA · ${LANGUAGE[targetCode].label}`
      : LANGUAGE[targetCode].label

    const messages = mode === "conversation"
      ? [
          { role: "system" as const, content: conversationPrompt(sourceCode) },
          ...history,
          { role: "user" as const, content: original },
        ]
      : [
          {
            role: "system" as const,
            content: `Eres MIRA, intérprete simultánea profesional. Traduce del ${LANGUAGE[sourceCode].label} al ${LANGUAGE[targetCode].label}. Devuelve únicamente una traducción natural, precisa y fluida, sin títulos, comillas, explicaciones ni Markdown. Conserva intención, registro, nombres propios y términos técnicos.`,
          },
          { role: "user" as const, content: original },
        ]

    // La voz usa Groq como ruta preferente: Whisper ya está en Groq y evitamos
    // recorrer proveedores más lentos antes de generar una respuesta corta.
    const result = await runAIText({
      messages,
      capability: "text",
      preferredProvider: "groq",
      lite: true,
      maxOutputTokens: mode === "conversation" ? 320 : 500,
      context: {
        userId: user.id,
        module: mode === "conversation" ? "mira-live-conversation" : "mira-live-translate",
        reusePolicy: mode === "translate" ? "exact_private" : "never",
        visibility: "private",
      },
      supabase,
    })

    const responseText = cleanResponse(result.data).slice(0, 2200)
    if (!responseText) {
      return Response.json({
        error: mode === "conversation" ? "No se pudo generar la respuesta de MIRA." : "No se pudo generar la traducción.",
      }, { status: 500 })
    }

    return Response.json({
      mode,
      original,
      responseText,
      translated: responseText,
      reply: responseText,
      sourceCode,
      targetCode,
      sourceLanguage: mode === "conversation" ? `Tú · ${sourceLanguage}` : sourceLanguage,
      targetLanguage,
      detectedLanguage: transcription.language || sourceCode,
      provider: result.provider,
      model: result.model,
      reused: result.reused,
      aiLatencyMs: result.latencyMs,
      latencyMs: Date.now() - requestStartedAt,
    })
  } catch (error) {
    console.error("MIRA live voice error:", error)
    const typed = error as Error & { status?: number; code?: string }
    return Response.json({
      error: typed.message || "No se pudo procesar la conversación de voz.",
      code: typed.code,
    }, { status: typed.status || 500 })
  }
}
