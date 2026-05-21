import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { EdgeTTS, Constants } from "@andresaya/edge-tts"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

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

  if (style === "narration") {
    return [{ speaker: "A", text: clean }]
  }

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

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean)
  return sentences.map((text, index) => ({ speaker: index % 2 === 0 ? "A" : "B", text }))
}

function groupBySpeaker(segments: Segment[]): Segment[] {
  const out: Segment[] = []
  for (const seg of segments) {
    if (!seg.text.trim()) continue
    const last = out[out.length - 1]
    if (last && last.speaker === seg.speaker) {
      last.text = `${last.text} Pausa larga. ${seg.text}`.trim()
    } else {
      out.push({ ...seg })
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
    ? `Eres un guionista de audio educativo. Crea un guion breve en español para dos voces. Usa SOLO líneas con formato A: texto y B: texto. Sin markdown. Duración objetivo: 45 a 90 segundos. Voz A guía, Voz B pregunta o complementa. Texto natural, claro, amable y listo para narrar.`
    : `Eres un guionista de audio educativo. Crea un guion breve en español para una sola voz. Sin markdown, sin listas técnicas, sin acotaciones. Duración objetivo: 45 a 90 segundos. Texto natural, claro, amable y listo para narrar.`

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

  for (const seg of grouped) {
    const voice = seg.speaker === "B" ? voiceB : voiceA
    const chunks = splitText(seg.text)

    for (const chunk of chunks) {
      const tts = new EdgeTTS()
      await tts.synthesize(chunk, voice, {
        outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
        rate: seg.speaker === "B" ? "+4%" : "-2%",
        pitch: seg.speaker === "B" ? "+2Hz" : "-1Hz",
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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
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

    const mp3 = await synthesize(segments, voiceA, voiceB)

    return NextResponse.json({
      ok: true,
      mime: "audio/mpeg",
      audioBase64: Buffer.from(mp3).toString("base64"),
      script,
      segments,
      style,
      inputMode,
      voices: { A: voiceA, B: style === "dialogue" ? voiceB : null },
      provider: process.env.GROQ_API_KEY && inputMode === "prompt" ? "groq-script + edge-tts" : "edge-tts",
    })
  } catch (error: any) {
    console.error("audio/generate error:", error?.message || error)
    return NextResponse.json({ ok: false, error: error?.message || "Error generando audio" }, { status: 500 })
  }
}
