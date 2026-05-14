// lib/agents/voice-agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// VoiceAgent — narración de preguntas y contenido educativo.
// Envuelve el Edge TTS existente (/api/agents/tts) de forma estructurada.
// Agrega: cola de narración, velocidad configurable, modo examen PIE.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type VoiceSpeed   = "slow" | "normal" | "fast"
export type VoiceGender  = "male" | "female"

export interface VoiceOptions {
  speed?:   VoiceSpeed    // velocidad de lectura
  gender?:  VoiceGender   // voz masculina o femenina
  pieMode?: boolean       // pausas más largas para NEE
}

export interface NarrationRequest {
  text:     string
  options?: VoiceOptions
}

export interface NarrationResult {
  success:    boolean
  audioUrl?:  string   // blob URL creado en el cliente
  error?:     string
  durationMs?: number
}

// ── Mapeo de velocidad a tasa Edge TTS ───────────────────────────────────────
// Edge TTS acepta rate como "+X%" o "-X%"

const SPEED_RATE: Record<VoiceSpeed, string> = {
  slow:   "-25%",   // ideal para PIE/dislexia/TDAH
  normal: "+0%",
  fast:   "+20%",
}

// ── Sanitizar texto para TTS ─────────────────────────────────────────────────

function sanitizeForSpeech(text: string): string {
  return String(text || "")
    .replace(/```[\s\S]*?```/g,    " ")
    .replace(/`[^`]*`/g,           " ")
    .replace(/\$\$([\s\S]*?)\$\$/g, ". Aquí hay una fórmula matemática. ")
    .replace(/\$([^$]+)\$/g,        ". Expresión matemática. ")
    .replace(/\*\*([^*]+)\*\*/g,    "$1")
    .replace(/\*([^*]+)\*/g,        "$1")
    .replace(/^#{1,6}\s+/gm,        "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g," ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g,"$1")
    .replace(/[>#_~]+/g,           " ")
    .replace(/\s{2,}/g,            " ")
    .trim()
}

// ── Llamada al endpoint TTS existente ────────────────────────────────────────

async function callTTS(
  text:    string,
  options: VoiceOptions = {}
): Promise<NarrationResult> {
  const { speed = "normal", gender = "female", pieMode = false } = options

  // En modo PIE usamos velocidad lenta si no se especificó
  const finalSpeed: VoiceSpeed = pieMode && speed === "normal" ? "slow" : speed

  const cleanText = sanitizeForSpeech(text)
  if (!cleanText) {
    return { success: false, error: "Texto vacío para narrar." }
  }

  const t0 = Date.now()

  try {
    const body = {
      text:   cleanText,
      speaker: gender === "male" ? "A" : "B",
      rate:    SPEED_RATE[finalSpeed],
      // Pasar motivational=false para no interrumpir narración de examen
      motivational: false,
    }

    const res = await fetch("/api/agents/tts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => "Error desconocido")
      return { success: false, error: `TTS error ${res.status}: ${err.slice(0, 100)}` }
    }

    // El endpoint devuelve audio/mpeg directamente como blob
    const blob   = await res.blob()
    const audioUrl = URL.createObjectURL(blob)

    return {
      success:    true,
      audioUrl,
      durationMs: Date.now() - t0,
    }
  } catch (err) {
    return {
      success: false,
      error:   err instanceof Error ? err.message : "Error de red al generar audio.",
    }
  }
}

// ── API pública del agente ────────────────────────────────────────────────────

/**
 * narrateQuestion — lee el enunciado de una pregunta de examen.
 * Prepend "Pregunta N:" al texto para dar contexto.
 */
export async function narrateQuestion(
  questionText: string,
  questionNumber: number,
  options?: VoiceOptions
): Promise<NarrationResult> {
  const text = `Pregunta ${questionNumber}. ${questionText}`
  return callTTS(text, options)
}

/**
 * narrateOptions — lee las alternativas de una pregunta.
 */
export async function narrateOptions(
  options: string[],
  voiceOptions?: VoiceOptions
): Promise<NarrationResult> {
  const text = options
    .map((opt, i) => `Alternativa ${["A", "B", "C", "D"][i]}. ${opt}`)
    .join(". ")
  return callTTS(text, voiceOptions)
}

/**
 * narrateText — narra cualquier texto educativo.
 */
export async function narrateText(
  text:    string,
  options?: VoiceOptions
): Promise<NarrationResult> {
  return callTTS(text, options)
}

/**
 * narrateExamIntro — introduce el examen al estudiante.
 */
export async function narrateExamIntro(params: {
  title?:     string
  totalQ:     number
  timeMins?:  number
  pieMode?:   boolean
}): Promise<NarrationResult> {
  const { title, totalQ, timeMins, pieMode } = params

  const intro = [
    title ? `Bienvenido al examen: ${title}.` : "Bienvenido al examen.",
    `Este examen tiene ${totalQ} ${totalQ === 1 ? "pregunta" : "preguntas"}.`,
    timeMins ? `Tienes ${timeMins} minutos para completarlo.` : "",
    pieMode  ? "Recuerda que puedes escuchar cada pregunta usando el botón de audio." : "",
    "Cuando estés listo, comienza con la primera pregunta. ¡Mucho éxito!",
  ].filter(Boolean).join(" ")

  return callTTS(intro, { speed: "slow", pieMode })
}

// ── Hook helpers para React (client-side) ─────────────────────────────────────

/**
 * releaseAudioUrl — libera un blob URL para evitar memory leaks.
 * Llamar cuando el componente se desmonta o cambia la pregunta.
 */
export function releaseAudioUrl(url?: string) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

/**
 * buildQuestionNarrationText — construye el texto completo de narración
 * de una pregunta + sus alternativas (para una sola llamada TTS).
 */
export function buildQuestionNarrationText(
  questionText: string,
  questionNumber: number,
  questionType: string,
  options?: string[]
): string {
  const parts = [`Pregunta ${questionNumber}. ${questionText}`]

  if (questionType === "multiple_choice" && Array.isArray(options) && options.length > 0) {
    parts.push("Las alternativas son:")
    options.forEach((opt, i) => {
      parts.push(`${["A", "B", "C", "D"][i]}. ${opt}`)
    })
  }

  if (questionType === "true_false") {
    parts.push("Indica si es verdadero o falso, y justifica tu respuesta.")
  }

  if (questionType === "development") {
    parts.push("Escribe tu respuesta de desarrollo en el espacio indicado.")
  }

  return parts.join(". ")
}
