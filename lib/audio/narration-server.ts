import Groq from "groq-sdk"
import { NextResponse } from "next/server"
import { EdgeTTS, Constants } from "@andresaya/edge-tts"
import { generateGeminiNarration, getGeminiNarrationKey, type GeneratedNarration } from "@/lib/audio/gemini-narration"

type AudioStyle = "narration" | "dialogue"
type InputMode = "prompt" | "text"
type Speaker = "A" | "B"
type Segment = { speaker: Speaker; text: string }

const VOICE_A_DEFAULT = process.env.EDGE_TTS_VOICE_A || "es-ES-AlvaroNeural"
const VOICE_B_DEFAULT = process.env.EDGE_TTS_VOICE_B || "es-ES-ElviraNeural"
const MAX_INPUT_LENGTH = 4000
const MAX_SCRIPT_LENGTH = 3600
const MAX_CHUNK_LENGTH = 1050

const ALLOWED_VOICES = new Set([
  "es-ES-AlvaroNeural",
  "es-ES-ElviraNeural",
  "es-CL-LorenzoNeural",
  "es-CL-CatalinaNeural",
  "es-MX-JorgeNeural",
  "es-MX-DaliaNeural",
  "es-US-AlonsoNeural",
  "es-US-PalomaNeural",
])

function safeVoice(value: unknown, fallback: string) {
  const voice = String(value || "").trim()
  return ALLOWED_VOICES.has(voice) ? voice : fallback
}

function sanitizeForSpeech(text: string): string {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\$\$([\s\S]*?)\$\$/g, ". Pausa. Aquí hay una fórmula matemática importante. ")
    .replace(/\$([^$]+)\$/g, ". Pausa. Aquí hay una expresión matemática. ")
    .replace(/---FOLLOWUPS---[\s\S]*/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1")
    .replace(/[>#*_~]+/g, " ")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function addPauses(text: string): string {
  return sanitizeForSpeech(text)
    .replace(/:\s+/g, ". Pausa. ")
    .replace(/;\s+/g, ". Pausa. ")
    .replace(/\n\n+/g, ". Pausa larga. ")
    .replace(/\n/g, ". ")
    .replace(/([.!?])\s+/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function splitText(text: string, maxLen = MAX_CHUNK_LENGTH): string[] {
  const clean = addPauses(text)
  if (!clean) return []
  if (clean.length <= maxLen) return [clean]

  const chunks: string[] = []
  const sentences = clean.split(/(?<=[.!?])\s+/)
  let current = ""

  for (const sentence of sentences) {
    const s = sentence.trim()
    if (!s) continue

    if (s.length > maxLen) {
      const words = s.split(/\s+/)
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word
        if (candidate.length > maxLen) {
          if (current) chunks.push(current.trim())
          current = word
        } else {
          current = candidate
        }
      }
      continue
    }

    const candidate = current ? `${current} ${s}` : s
    if (candidate.length > maxLen && current) {
      chunks.push(current.trim())
      current = s
    } else {
      current = candidate
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.length ? chunks : [clean.slice(0, maxLen)]
}

function normalizeScript(script: string) {
  return String(script || "")
    .replace(/^```(?:txt|text|markdown)?/i, "")
    .replace(/```$/i, "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, MAX_SCRIPT_LENGTH)
}

function parseDialogue(script: string, style: AudioStyle): Segment[] {
  const clean = normalizeScript(script)
  if (!clean) return []
  if (style === "narration") return [{ speaker: "A", text: clean }]

  const lines = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const segments: Segment[] = []
  let currentSpeaker: Speaker = "A"
  let currentText = ""

  const flush = () => {
    if (currentText.trim()) segments.push({ speaker: currentSpeaker, text: currentText.trim() })
    currentText = ""
  }

  for (const line of lines) {
    const match = line.match(/^(?:voz\s*)?([AB])\s*[:\-–]\s*(.+)$/i)
    if (match) {
      flush()
      currentSpeaker = match[1].toUpperCase() === "B" ? "B" : "A"
      currentText = match[2]
    } else {
      currentText = currentText ? `${currentText} ${line}` : line
    }
  }
  flush()

  if (segments.length > 0) return segments
  return clean.split(/(?<=[.!?])\s+/).filter(Boolean).map((value, index) => ({
    speaker: index % 2 === 0 ? "A" : "B",
    text: value,
  }))
}

function groupBySpeaker(segments: Segment[]): Segment[] {
  const out: Segment[] = []
  for (const segment of segments) {
    if (!segment.text.trim()) continue
    const last = out[out.length - 1]
    if (last && last.speaker === segment.speaker) {
      last.text = `${last.text} Pausa larga. ${segment.text}`.trim()
    } else {
      out.push({ ...segment })
    }
  }
  return out
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}

async function createScriptFromPrompt(prompt: string, style: AudioStyle) {
  const groqKey = process.env.GROQ_API_KEY
  const cleanPrompt = prompt.trim().slice(0, MAX_INPUT_LENGTH)
  if (!groqKey) return cleanPrompt

  const groq = new Groq({ apiKey: groqKey })
  const system = style === "dialogue"
    ? "Eres un guionista de audio educativo. Crea un guion breve en español para dos voces. Usa SOLO líneas con formato A: texto y B: texto. Sin markdown. Duración objetivo: 45 a 90 segundos. Voz A guía, Voz B pregunta o complementa. Texto natural, claro, amable y listo para narrar."
    : "Eres un guionista de audio educativo. Crea un guion breve en español para una sola voz. Sin markdown, sin listas técnicas, sin acotaciones. Duración objetivo: 45 a 90 segundos. Texto natural, claro, amable y listo para narrar."

  const completion = await groq.chat.completions.create({
    model: process.env.AUDIO_SCRIPT_MODEL || "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: system },
      { role: "user", content: cleanPrompt },
    ],
    temperature: 0.65,
    max_tokens: 850,
  })

  return normalizeScript(completion.choices[0]?.message?.content || cleanPrompt)
}

async function synthesize(segments: Segment[], voiceA: string, voiceB: string) {
  const grouped = groupBySpeaker(segments)
  const parts: Uint8Array[] = []

  for (const segment of grouped) {
    const voice = segment.speaker === "B" ? voiceB : voiceA
    for (const chunk of splitText(segment.text)) {
      const tts = new EdgeTTS()
      await tts.synthesize(chunk, voice, {
        outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
        rate: segment.speaker === "B" ? "+4%" : "-2%",
        pitch: segment.speaker === "B" ? "+2Hz" : "-1Hz",
        volume: "100%",
      })
      const buffer = tts.toBuffer()
      if (!buffer || buffer.length < 200) throw new Error("Edge TTS no devolvió MP3 válido")
      parts.push(new Uint8Array(buffer))
    }
  }

  if (!parts.length) throw new Error("No se generó audio")
  return concat(parts)
}

type AudioResult = { audio: Buffer; mime: "audio/mpeg" | "audio/wav"; provider: string }

async function renderSpeech(segments: Segment[], style: AudioStyle, voiceA: string, voiceB: string): Promise<AudioResult> {
  let geminiError: unknown = null
  if (getGeminiNarrationKey()) {
    try {
      const result: GeneratedNarration = await generateGeminiNarration(segments, style, voiceA, voiceB)
      return result
    } catch (err) {
      geminiError = err
      console.warn("[audio/narration] Gemini TTS fallback requested:", err instanceof Error ? err.message : "unknown")
    }
  }
  try {
    const mp3 = await synthesize(segments, voiceA, voiceB)
    return { audio: Buffer.from(mp3), mime: "audio/mpeg", provider: "edge-tts" }
  } catch (edgeError) {
    console.error("[audio/narration] Edge TTS failed:", edgeError instanceof Error ? edgeError.message : "unknown")
    const upstream = edgeError instanceof Error ? edgeError.message : ""
    const isBlocked = /403|401|HANDSHAKE|forbidden|unauthorized/i.test(upstream)
    const help = getGeminiNarrationKey()
      ? (geminiError instanceof Error ? geminiError.message : "Google TTS también falló.")
      : "Configura GEMINI_API_KEY en Vercel para activar el respaldo Google Gemini TTS."
    const message = isBlocked
      ? `Microsoft Edge TTS rechazó la conexión (403). ${help}`
      : `El servicio de voz no respondió. ${help}`
    throw new Error(message)
  }
}

/** Legacy JSON output is kept for callers other than Audio Lab. The binary
 * response lets Audio Lab download WAV of any supported duration without
 * Vercel's base64 JSON body limit.
 */
export async function createNarration(body: any, binaryResponse = false) {
  try {
    const prompt = String(body.prompt || body.text || "").trim().slice(0, MAX_INPUT_LENGTH)
    const inputMode: InputMode = body.inputMode === "text" ? "text" : "prompt"
    const style: AudioStyle = body.style === "dialogue" ? "dialogue" : "narration"
    const voiceA = safeVoice(body.voiceA, VOICE_A_DEFAULT)
    const voiceB = safeVoice(body.voiceB, VOICE_B_DEFAULT)

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "Debes escribir un prompt o texto para generar audio." }, { status: 400 })
    }

    const script = inputMode === "text" ? normalizeScript(prompt) : await createScriptFromPrompt(prompt, style)
    const segments = parseDialogue(script, style)
    if (!segments.length) {
      return NextResponse.json({ ok: false, error: "No se pudo crear un guion narrable." }, { status: 400 })
    }

    const result = await renderSpeech(segments, style, voiceA, voiceB)
    if (binaryResponse) {
      const bytes = Buffer.byteLength(script, "utf8")
      const encodedScript = bytes <= 2400 ? Buffer.from(script, "utf8").toString("base64") : ""
      return new Response(new Uint8Array(result.audio), {
        status: 200,
        headers: {
          "Content-Type": result.mime,
          "Content-Disposition": `attachment; filename="eduai-audio.${result.mime === "audio/wav" ? "wav" : "mp3"}"`,
          "Cache-Control": "private, no-store",
          "X-Audio-Provider": result.provider,
          ...(encodedScript ? { "X-Audio-Script": encodedScript } : {}),
        },
      })
    }
    // Backward compatibility with clients that still expect JSON.
    if (result.audio.byteLength > 2.5 * 1024 * 1024) {
      return NextResponse.json({
        ok: false,
        error: "Audio demasiado grande para respuesta JSON. Actualiza Audio Lab para recibir audio binario.",
      }, { status: 413 })
    }
    return NextResponse.json({
      ok: true,
      mime: result.mime,
      audioBase64: result.audio.toString("base64"),
      script, segments, style, inputMode,
      voices: { A: voiceA, B: style === "dialogue" ? voiceB : null },
      provider: result.provider,
    })
  } catch (error: any) {
    console.error("audio/narration error:", error instanceof Error ? error.message : "Unknown error")
    const providerDown = /Edge TTS|servicio de voz|Gemini TTS|Gemini no autorizó|clave|cuota/i.test(String(error?.message || ""))
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error generando audio" },
      { status: providerDown ? 503 : 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
