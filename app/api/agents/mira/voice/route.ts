import { EdgeTTS, Constants } from "@andresaya/edge-tts"
import Groq from "groq-sdk"
import { runAIText } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_AUDIO_BYTES = 12 * 1024 * 1024
const MAX_HISTORY_ITEMS = 10
const MIRA_VOICE = "es-CL-CatalinaNeural"

type HistoryItem = { role: "user" | "assistant"; content: string }

function parseHistory(value: FormDataEntryValue | null): HistoryItem[] {
  if (typeof value !== "string" || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .map((item) => ({
        role: item.role as HistoryItem["role"],
        content: item.content.trim().slice(0, 1200),
      }))
      .filter((item) => item.content)
      .slice(-MAX_HISTORY_ITEMS)
  } catch {
    return []
  }
}

function cleanResponse(text: string) {
  return text
    .trim()
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^(respuesta|response)\s*:\s*/i, "")
    .replace(/^[“\"]|[”\"]$/g, "")
    .trim()
}

const MIRA_VOICE_SYSTEM = `Eres MIRA, la asistente conversacional de EduAI en una llamada de voz en vivo.

Tu personalidad es profesional, serena, cálida, respetuosa y natural. Puedes conversar sobre prácticamente cualquier tema general: vida cotidiana, estudio, trabajo, relaciones, decisiones, creatividad, ciencia, tecnología, cultura, planificación, dudas y conversación informal.

En temas emocionales:
- Escucha con atención y responde a lo que la persona realmente dijo.
- Ayuda a identificar emociones, necesidades, opciones y próximos pasos sin dramatizar ni minimizar.
- Haz preguntas abiertas y breves cuando ayuden a comprender mejor.
- Puedes sugerir estrategias generales de afrontamiento, organización, comunicación y búsqueda de apoyo.
- No diagnostiques trastornos ni afirmes ser psicóloga, terapeuta o profesional clínico.
- No sustituyas atención médica o psicológica profesional cuando el problema requiera evaluación clínica.
- Si la persona expresa intención inmediata de hacerse daño, dañar a otra persona o estar en peligro, prioriza su seguridad: recomienda contactar de inmediato servicios de emergencia locales o una persona de confianza que pueda estar físicamente presente.

Estilo de voz:
- Responde en español de Chile salvo que el usuario cambie de idioma.
- Habla como en una conversación real, sin Markdown, títulos, listas ni acotaciones.
- Normalmente responde en 2 a 5 frases, pero desarrolla más si el tema lo necesita.
- Evita sonar mecánica, moralizante, condescendiente o excesivamente entusiasta.
- No conviertas automáticamente cada conversación en un problema emocional; sigue el tema que proponga el usuario.
- Mantén continuidad usando el contexto reciente.`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: "No autenticado" }, { status: 401 })

  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: "La conversación por voz necesita GROQ_API_KEY en Vercel." }, { status: 503 })
  }

  try {
    await assertAICapabilityAllowed({ supabase, userId: user.id, capability: "text" })

    const formData = await req.formData()
    const audio = formData.get("audio")
    const history = parseHistory(formData.get("history"))

    if (!(audio instanceof File)) return Response.json({ error: "No se recibió audio." }, { status: 400 })
    if (audio.size === 0) return Response.json({ error: "La grabación está vacía." }, { status: 400 })
    if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "La grabación es demasiado grande." }, { status: 413 })

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const transcription = await groq.audio.transcriptions.create({
      file: audio as any,
      model: "whisper-large-v3-turbo",
      language: "es",
      response_format: "verbose_json",
      temperature: 0,
    }) as any

    const original = String(transcription.text || "").trim().slice(0, 1800)
    if (!original) return Response.json({ error: "No pude reconocer lo que dijiste." }, { status: 422 })

    const result = await runAIText({
      messages: [
        { role: "system", content: MIRA_VOICE_SYSTEM },
        ...history,
        { role: "user", content: original },
      ],
      capability: "text",
      maxOutputTokens: 900,
      context: {
        userId: user.id,
        module: "mira-live-voice",
        sourceId: "mira-web",
        reusePolicy: "never",
        visibility: "private",
      },
      supabase,
    })

    const responseText = cleanResponse(String(result.text || result.data || "")).slice(0, 2600)
    if (!responseText) return Response.json({ error: "MIRA no pudo generar una respuesta." }, { status: 500 })

    let audioBase64: string | undefined
    try {
      const tts = new EdgeTTS()
      await tts.synthesize(responseText, MIRA_VOICE, {
        rate: "-4%",
        volume: "100%",
        pitch: "+1Hz",
        outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
      })
      audioBase64 = tts.toBuffer().toString("base64")
    } catch (ttsError) {
      console.error("[MIRA voice TTS fallback]", ttsError)
    }

    return Response.json({
      original,
      responseText,
      audioBase64,
      audioMime: audioBase64 ? "audio/mpeg" : undefined,
      provider: result.provider,
      model: result.model,
    })
  } catch (error) {
    console.error("[MIRA live voice]", error)
    const typed = error as Error & { status?: number; code?: string }
    return Response.json(
      { error: typed.message || "No se pudo procesar la conversación de voz.", code: typed.code },
      { status: typed.status || 500 },
    )
  }
}
