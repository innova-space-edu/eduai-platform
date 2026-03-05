// src/components/ui/DownloadBar.tsx
"use client"

import { useState, useRef, type MutableRefObject } from "react"
import {
  downloadRenderedAsImage,
  downloadAsPDF,
  downloadAsPPTX,
} from "@/lib/creator-downloads"

interface DownloadBarProps {
  format: string
  data: any
  title?: string
  accentColor?: string
}

const FORMAT_DOWNLOADS: Record<string, { label: string; icon: string; action: string }[]> = {
  infographic: [
    { label: "PNG", icon: "🖼️", action: "png" },
    { label: "JPG", icon: "📷", action: "jpg" },
    { label: "PDF", icon: "📄", action: "pdf" },
  ],
  ppt: [
    { label: "PPTX", icon: "📑", action: "pptx" },
    { label: "PDF", icon: "📄", action: "pdf" },
    { label: "PNG", icon: "🖼️", action: "png" },
  ],
  poster: [
    { label: "PNG", icon: "🖼️", action: "png" },
    { label: "JPG", icon: "📷", action: "jpg" },
    { label: "PDF", icon: "📄", action: "pdf" },
  ],
  podcast: [
    { label: "Audio WAV", icon: "🎵", action: "wav" },
    { label: "Escuchar", icon: "🔊", action: "play" },
    { label: "PDF Guión", icon: "📄", action: "pdf" },
    { label: "TXT Guión", icon: "📝", action: "txt" },
  ],
  mindmap: [
    { label: "PNG", icon: "🖼️", action: "png" },
    { label: "PDF", icon: "📄", action: "pdf" },
  ],
  flashcards: [
    { label: "PDF", icon: "📄", action: "pdf" },
    { label: "PNG", icon: "🖼️", action: "png" },
  ],
  quiz: [{ label: "PDF", icon: "📄", action: "pdf" }],
  timeline: [
    { label: "PNG", icon: "🖼️", action: "png" },
    { label: "PDF", icon: "📄", action: "pdf" },
  ],
}

export default function DownloadBar({ format, data, title, accentColor = "#3b82f6" }: DownloadBarProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState("")
  const cancelRef = useRef(false)

  const downloads = FORMAT_DOWNLOADS[format] || []
  const baseName = (title || data?.title || data?.deckTitle || data?.headline || "eduai-export")
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 50)

  const handleDownload = async (action: string) => {
    setDownloading(action)
    setSuccess(null)
    setProgress("")
    cancelRef.current = false

    try {
      switch (action) {
        case "png":
          await downloadRenderedAsImage("creator-result-container", baseName, "png")
          break
        case "jpg":
          await downloadRenderedAsImage("creator-result-container", baseName, "jpeg")
          break
        case "pdf":
          await downloadAsPDF(data, format, baseName, accentColor)
          break
        case "pptx":
          await downloadAsPPTX(data, baseName, accentColor)
          break
        case "wav":
          await generateAndDownloadWAV(data, baseName, setProgress, cancelRef)
          break
        case "play":
          await playWithSpeechAPI(data, setPlaying, setProgress, cancelRef)
          break
        case "txt":
          downloadScript(data, baseName)
          break
      }

      if (!cancelRef.current) {
        setSuccess(action)
        setTimeout(() => setSuccess(null), 2000)
      }
    } catch (err: any) {
      console.error("Error:", err)
      setProgress(`Error: ${err?.message || "Error desconocido"}`)
      setTimeout(() => setProgress(""), 4000)
    } finally {
      setDownloading(null)
    }
  }

  const handleStop = () => {
    cancelRef.current = true
    speechSynthesis.cancel()
    setPlaying(false)
    setProgress("")
    setDownloading(null)
  }

  if (downloads.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-600 text-xs font-semibold tracking-wide mr-1">DESCARGAR:</span>
        {downloads.map((d) => {
          const isStoppable = (d.action === "play" && playing) || (d.action === "wav" && downloading === "wav")
          return (
            <button
              key={d.action}
              onClick={() => (isStoppable ? handleStop() : handleDownload(d.action))}
              disabled={downloading !== null && downloading !== d.action && !isStoppable}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isStoppable
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : success === d.action
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : downloading === d.action
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  : "bg-white/[0.04] border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-white hover:border-white/15"
              } disabled:opacity-40`}
            >
              {downloading === d.action && !isStoppable ? (
                <span className="w-3 h-3 rounded-full border border-gray-500 border-t-blue-400 animate-spin" />
              ) : success === d.action ? (
                <span>✅</span>
              ) : isStoppable ? (
                <span>⏹️</span>
              ) : (
                <span>{d.icon}</span>
              )}
              {isStoppable ? "Detener" : downloading === d.action ? (progress || "Generando...") : d.label}
            </button>
          )
        })}
      </div>
      {progress && <p className="text-blue-400 text-[11px] animate-pulse">{progress}</p>}
    </div>
  )
}

// ============================================================
// WAV AUDIO — Llama a /api/agents/tts-chunk (NUESTRO servidor)
// NUNCA llama a HF directamente desde el navegador
// ============================================================

function splitText(text: string, maxLen = 200): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let current = ""
  for (const s of sentences) {
    if ((current + " " + s).length > maxLen && current) {
      chunks.push(current.trim())
      current = s
    } else {
      current = current ? current + " " + s : s
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length > 0 ? chunks : [text.substring(0, maxLen)]
}

// Extraer PCM data de un WAV ArrayBuffer
function extractWavPCM(
  wav: ArrayBuffer
): { pcm: Uint8Array; sampleRate: number; numChannels: number; bitsPerSample: number } {
  const view = new DataView(wav)

  if (wav.byteLength < 44) throw new Error("WAV demasiado corto")

  let sampleRate = 16000
  let numChannels = 1
  let bitsPerSample = 16

  // Buscar "fmt "
  for (let i = 0; i < wav.byteLength - 4; i++) {
    if (
      view.getUint8(i) === 0x66 &&
      view.getUint8(i + 1) === 0x6d &&
      view.getUint8(i + 2) === 0x74 &&
      view.getUint8(i + 3) === 0x20
    ) {
      numChannels = view.getUint16(i + 10, true)
      sampleRate = view.getUint32(i + 12, true)
      bitsPerSample = view.getUint16(i + 22, true)
      break
    }
  }

  // Buscar "data" chunk
  for (let i = 0; i < wav.byteLength - 8; i++) {
    if (
      view.getUint8(i) === 0x64 &&
      view.getUint8(i + 1) === 0x61 &&
      view.getUint8(i + 2) === 0x74 &&
      view.getUint8(i + 3) === 0x61
    ) {
      const dataSize = view.getUint32(i + 4, true)
      const dataStart = i + 8
      const pcm = new Uint8Array(wav, dataStart, Math.min(dataSize, wav.byteLength - dataStart))
      return { pcm, sampleRate, numChannels, bitsPerSample }
    }
  }

  // Fallback: asumir header de 44 bytes
  return { pcm: new Uint8Array(wav, 44), sampleRate, numChannels, bitsPerSample }
}

// Construir un WAV válido desde PCM concatenado
function buildWav(pcmParts: Uint8Array[], sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
  const totalPcmLength = pcmParts.reduce((acc, p) => acc + p.byteLength, 0)
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8

  const wav = new Uint8Array(44 + totalPcmLength)
  const view = new DataView(wav.buffer)

  // RIFF header
  wav.set([0x52, 0x49, 0x46, 0x46], 0) // "RIFF"
  view.setUint32(4, 36 + totalPcmLength, true)
  wav.set([0x57, 0x41, 0x56, 0x45], 8) // "WAVE"

  // fmt chunk
  wav.set([0x66, 0x6d, 0x74, 0x20], 12) // "fmt "
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  wav.set([0x64, 0x61, 0x74, 0x61], 36) // "data"
  view.setUint32(40, totalPcmLength, true)

  // Copiar PCM
  let offset = 44
  for (const part of pcmParts) {
    wav.set(part, offset)
    offset += part.byteLength
  }

  return wav
}

// Generar silencio PCM
function makeSilence(ms: number, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
  const bytesPerSample = (bitsPerSample / 8) * numChannels
  const numSamples = Math.floor((sampleRate * ms) / 1000)
  return new Uint8Array(numSamples * bytesPerSample)
}

// Llamar a NUESTRO proxy (no a HF directo)
async function fetchAudioChunk(text: string): Promise<ArrayBuffer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("/api/agents/tts-chunk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })

    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 5000))
      continue
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error || `Error ${res.status}`)
    }

    return await res.arrayBuffer()
  }
  throw new Error("API no respondió después de 3 intentos")
}

async function generateAndDownloadWAV(
  data: any,
  fileName: string,
  setProgress: (s: string) => void,
  cancelRef: MutableRefObject<boolean>
) {
  const segments = data.segments || []
  if (segments.length === 0) throw new Error("No hay segmentos")

  const allChunks: string[] = []
  const segmentBoundaries: number[] = []

  for (let i = 0; i < segments.length; i++) {
    const text = (segments[i].text || "").trim()
    if (!text) continue
    allChunks.push(...splitText(text, 250))
    segmentBoundaries.push(allChunks.length)
  }

  if (allChunks.length === 0) throw new Error("No hay texto para convertir")

  const pcmParts: Uint8Array[] = []
  let sampleRate = 16000
  let numChannels = 1
  let bitsPerSample = 16
  let formatDetected = false

  for (let i = 0; i < allChunks.length; i++) {
    if (cancelRef.current) return

    const pct = Math.round(((i + 1) / allChunks.length) * 100)
    setProgress(`Generando audio... ${i + 1}/${allChunks.length} (${pct}%)`)

    try {
      const wavBuf = await fetchAudioChunk(allChunks[i])
      const parsed = extractWavPCM(wavBuf)

      if (!formatDetected && parsed.pcm.byteLength > 0) {
        sampleRate = parsed.sampleRate
        numChannels = parsed.numChannels
        bitsPerSample = parsed.bitsPerSample
        formatDetected = true
      }

      if (parsed.pcm.byteLength > 0) {
        pcmParts.push(parsed.pcm)
      }
    } catch (err: any) {
      console.warn(`Chunk ${i + 1} falló:`, err?.message || err)
      pcmParts.push(makeSilence(300, sampleRate, numChannels, bitsPerSample))
    }

    const isSegmentEnd = segmentBoundaries.includes(i + 1)
    if (i < allChunks.length - 1) {
      const silenceMs = isSegmentEnd ? 500 : 100
      pcmParts.push(makeSilence(silenceMs, sampleRate, numChannels, bitsPerSample))
    }
  }

  if (cancelRef.current) return
  if (pcmParts.length === 0) throw new Error("No se generó audio. Verifica HF_API_KEY/HF_TOKEN en Vercel.")

  setProgress("Construyendo archivo WAV...")

  const finalWav = buildWav(pcmParts, sampleRate, numChannels, bitsPerSample)

  // ✅ Blob 100% compatible: forzar ArrayBuffer REAL (no SharedArrayBuffer)
  const wavBytes = finalWav as Uint8Array
  const arrayBuffer = new ArrayBuffer(wavBytes.byteLength)
  new Uint8Array(arrayBuffer).set(wavBytes)

  const blob = new Blob([arrayBuffer], { type: "audio/wav" })
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = `${fileName}.wav`
  a.click()

  // delay mínimo para evitar cortar descarga en algunos navegadores
  setTimeout(() => URL.revokeObjectURL(url), 1500)

  setProgress("")
}

// ============================================================
// ESCUCHAR — Web Speech API local (sin servidor)
// ============================================================

async function playWithSpeechAPI(
  data: any,
  setPlaying: (v: boolean) => void,
  setProgress: (s: string) => void,
  cancelRef: MutableRefObject<boolean>
) {
  const segments = data.segments || []
  if (segments.length === 0) throw new Error("No hay segmentos")
  if (!window.speechSynthesis) throw new Error("Navegador no soporta síntesis de voz")

  speechSynthesis.cancel()
  await new Promise((r) => setTimeout(r, 200))

  let voices = speechSynthesis.getVoices()
  if (voices.length === 0) {
    await new Promise<void>((resolve) => {
      speechSynthesis.onvoiceschanged = () => {
        voices = speechSynthesis.getVoices()
        resolve()
      }
      setTimeout(resolve, 2000)
    })
    voices = speechSynthesis.getVoices()
  }

  const esVoices = voices.filter((v) => v.lang.startsWith("es"))
  const pool = esVoices.length >= 2 ? esVoices : voices
  const voiceA = pool[0]
  const voiceB = pool.length > 1 ? pool[1] : pool[0]

  setPlaying(true)

  for (let i = 0; i < segments.length; i++) {
    if (cancelRef.current) break

    const seg = segments[i]
    const text = (seg.text || "").trim()
    if (!text) continue

    setProgress(`Reproduciendo ${i + 1} de ${segments.length}...`)
    const parts = splitText(text, 180)

    for (const part of parts) {
      if (cancelRef.current) break

      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(part)
        u.voice = seg.speaker === "A" ? voiceA : voiceB
        u.lang = "es-ES"
        u.rate = seg.speaker === "A" ? 0.9 : 1.0
        u.pitch = seg.speaker === "A" ? 0.8 : 1.2
        u.volume = 1.0

        let done = false
        const finish = () => {
          if (!done) {
            done = true
            resolve()
          }
        }
        u.onend = finish
        u.onerror = finish
        setTimeout(finish, 30000)

        speechSynthesis.speak(u)
      })

      if (!cancelRef.current) await new Promise((r) => setTimeout(r, 80))
    }

    if (!cancelRef.current && i < segments.length - 1) {
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  setPlaying(false)
  setProgress("")
}

// ============================================================
// TXT — Descargar guión
// ============================================================

function downloadScript(data: any, fileName: string) {
  const segments = data.segments || []
  const lines = [
    `══════════════════════════════════════`,
    `  ${data.title || "Podcast EduAI"}`,
    `  Duración: ${data.duration || "5 min"}`,
    `══════════════════════════════════════`,
    ``,
  ]

  for (const seg of segments) {
    lines.push(`[${seg.speaker === "A" ? "HOST A (Profesor)" : "HOST B (Estudiante)"}]`)
    lines.push(seg.text)
    lines.push(``)
  }

  lines.push(`──────────────────────────────────────`)
  lines.push(`Generado por EduAI Creator Studio`)

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${fileName}-guion.txt`
  a.click()
  URL.revokeObjectURL(url)
}
