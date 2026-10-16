/** Gemini 3.8 speech synthesis for Audio Lab.
 * Generic TTS only: it never loads or imitates a private voice profile.
 * Uses an existing server-side Gemini key; no Hugging Face dependency.
 */
export type NarrationSegment = { speaker: "A" | "B"; text: string }

export function getGeminiNarrationKey() {
  return process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY_IMAGE_2 ||
    ""
}

export type GeneratedNarration = { audio: Buffer; mime: "audio/wav"; provider: string }

const VOICE_MAP: Record<string, string> = {
  "es-ES-AlvaroNeural": "Charon",
  "es-ES-ElviraNeural": "Aoede",
  "es-CL-LorenzoNeural": "Puck",
  "es-CL-CatalinaNeural": "Leda",
  "es-MX-JorgeNeural": "Orus",
  "es-MX-DaliaNeural": "Kore",
  "es-US-AlonsoNeural": "Iapetus",
  "es-US-PalomaNeural": "Laomedeia",
}

function voice(name: string) {
  return VOICE_MAP[name] || "Charon"
}

function accent(voiceId: string) {
  if (voiceId.startsWith("es-CL-")) return "Natural Chilean Spanish accent, articulate and friendly"
  if (voiceId.startsWith("es-MX-")) return "Natural Mexican Spanish accent, clear and warm"
  return "Natural clear Spanish, expressive and conversational"
}

export function buildGeminiTtsRequest(segments: NarrationSegment[], style: "narration" | "dialogue", voiceA: string, voiceB: string) {
  const spoken = segments.filter(s => s.text.trim()).map(s => ({
    text: s.text.trim(),
    speech_metadata: style === "dialogue"
      ? { speaker: s.speaker, style: accent(s.speaker === "B" ? voiceB : voiceA) }
      : { style: accent(voiceA) },
  }))
  return {
    contents: [{ role: "user", parts: spoken }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: style === "dialogue" ? {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: "A", voiceConfig: { prebuiltVoiceConfig: { voiceName: voice(voiceA) } } },
            { speaker: "B", voiceConfig: { prebuiltVoiceConfig: { voiceName: voice(voiceB) } } },
          ],
        },
      } : { voiceConfig: { voice: voice(voiceA) } },
    },
  }
}

export class GeminiTtsError extends Error {
  constructor(message: string, public readonly httpStatus: number) { super(message) }
}

export async function generateGeminiNarration(
  segments: NarrationSegment[],
  style: "narration" | "dialogue",
  voiceA: string,
  voiceB: string,
  apiKey = getGeminiNarrationKey(),
): Promise<GeneratedNarration> {
  if (!apiKey) throw new GeminiTtsError("Falta configurar GEMINI_API_KEY para la generación de audio.", 503)
  const model = process.env.AUDIO_TTS_MODEL === "gemini-3.8-flash-tts"
    ? "gemini-3.8-flash-tts" : "gemini-3.8-flash-lite-tts"
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(buildGeminiTtsRequest(segments, style, voiceA, voiceB)),
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    },
  )

  if (!response.ok) {
    const status = response.status
    // Never return provider payloads, tokens, secret IDs, or arbitrary HTML to users.
    const reason =
      status === 400 ? "El motor Gemini rechazó el formato de la solicitud de audio." :
      status === 401 || status === 403 ? "Gemini no autorizó esta clave para el modelo de voz. Revisa sus permisos y facturación." :
      status === 404 ? "El modelo Gemini TTS solicitado no está habilitado en este proyecto." :
      status === 429 ? "Se agotó la cuota de generación de voz de Gemini. Reintenta más tarde." :
      `Gemini TTS no pudo generar audio (HTTP ${status}).`
    throw new GeminiTtsError(reason, status === 429 ? 429 : 503)
  }

  const body = await response.json().catch(() => ({}))
  const parts = body?.candidates?.[0]?.content?.parts
  const inline = Array.isArray(parts) ? parts.find(
    (part: { inlineData?: { data?: string } }) => typeof part?.inlineData?.data === "string",
  )?.inlineData : null

  if (!inline?.data) throw new GeminiTtsError("Gemini respondió sin audio. Prueba con un texto más corto.", 502)
  const audio = Buffer.from(inline.data, "base64")
  if (audio.length < 80 || audio.toString("ascii", 0, 4) !== "RIFF" ||
      audio.toString("ascii", 8, 12) !== "WAVE") {
    throw new GeminiTtsError("Gemini devolvió audio en un formato inesperado.", 502)
  }
  if (audio.length > 18 * 1024 * 1024) {
    throw new GeminiTtsError("El audio generado es demasiado largo. Divide el texto en dos partes.", 413)
  }
  return { audio, mime: "audio/wav", provider: model }
}
