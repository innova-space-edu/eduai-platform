// src/components/ui/DownloadBar.tsx
"use client"

import { useState, useRef } from "react"
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
    { label: "PNG",  icon: "🖼️", action: "png" },
    { label: "JPG",  icon: "📷", action: "jpg" },
    { label: "PDF",  icon: "📄", action: "pdf" },
  ],
  ppt: [
    { label: "PPTX", icon: "📑", action: "pptx" },
    { label: "PDF",  icon: "📄", action: "pdf" },
    { label: "PNG",  icon: "🖼️", action: "png" },
  ],
  poster: [
    { label: "PNG",  icon: "🖼️", action: "png" },
    { label: "JPG",  icon: "📷", action: "jpg" },
    { label: "PDF",  icon: "📄", action: "pdf" },
  ],
  podcast: [
    { label: "Audio WAV",   icon: "🎵", action: "wav" },
    { label: "Escuchar",    icon: "🔊", action: "play" },
    { label: "PDF Guión",   icon: "📄", action: "pdf" },
    { label: "TXT Guión",   icon: "📝", action: "txt" },
  ],
  mindmap: [
    { label: "PNG",  icon: "🖼️", action: "png" },
    { label: "PDF",  icon: "📄", action: "pdf" },
  ],
  flashcards: [
    { label: "PDF",  icon: "📄", action: "pdf" },
    { label: "PNG",  icon: "🖼️", action: "png" },
  ],
  quiz: [
    { label: "PDF",  icon: "📄", action: "pdf" },
  ],
  timeline: [
    { label: "PNG",  icon: "🖼️", action: "png" },
    { label: "PDF",  icon: "📄", action: "pdf" },
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
          cancelRef.current = false
          await generateAudioClientSide(data, baseName, setProgress, cancelRef)
          break
        case "play":
          cancelRef.current = false
          await playPodcastLocally(data, setPlaying, setProgress, cancelRef)
          break
        case "txt":
          downloadPodcastScript(data, baseName)
          break
      }
      if (!cancelRef.current) {
        setSuccess(action)
        setTimeout(() => setSuccess(null), 2000)
      }
    } catch (err: any) {
      console.error("Error:", err)
      setProgress(`Error: ${err.message}`)
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
              onClick={() => isStoppable ? handleStop() : handleDownload(d.action)}
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
              {isStoppable
                ? "Detener"
                : downloading === d.action
                ? (progress || "Generando...")
                : d.label}
            </button>
          )
        })}
      </div>
      {progress && (
        <p className="text-blue-400 text-[11px] animate-pulse">{progress}</p>
      )}
    </div>
  )
}

// ============================================================
// AUDIO WAV — Generado 100% en el cliente (sin servidor)
// Usa Hugging Face Inference API directamente desde el browser
// ============================================================

const HF_MODEL = "facebook/mms-tts-spa"

async function callHfTTS(text: string): Promise<ArrayBuffer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: text }),
      }
    )

    if (res.status === 503) {
      // Modelo cargando
      await new Promise(r => setTimeout(r, 5000))
      continue
    }

    if (!res.ok) throw new Error(`HF error ${res.status}`)

    return await res.arrayBuffer()
  }
  throw new Error("HF API no respondió después de 3 intentos")
}

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
  if (chunks.length === 0) chunks.push(text.substring(0, maxLen))
  return chunks
}

function extractPCM(buf: ArrayBuffer): { pcm: ArrayBuffer; rate: number } {
  const v = new DataView(buf)
  const magic = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))
  if (magic === "RIFF") {
    const rate = v.getUint32(24, true)
    let off = 12
    while (off < buf.byteLength - 8) {
      const id = String.fromCharCode(v.getUint8(off), v.getUint8(off+1), v.getUint8(off+2), v.getUint8(off+3))
      const sz = v.getUint32(off + 4, true)
      if (id === "data") return { pcm: buf.slice(off + 8, off + 8 + sz), rate }
      off += 8 + sz
    }
    return { pcm: buf.slice(44), rate }
  }
  return { pcm: buf, rate: 16000 }
}

function makeSilence(ms: number, rate: number): ArrayBuffer {
  return new ArrayBuffer(Math.floor((rate * ms) / 1000) * 2)
}

function makeWavHeader(dataLen: number, rate: number): ArrayBuffer {
  const h = new ArrayBuffer(44)
  const v = new DataView(h)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, "RIFF"); v.setUint32(4, 36 + dataLen, true); w(8, "WAVE")
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, 1, true); v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, "data"); v.setUint32(40, dataLen, true)
  return h
}

async function generateAudioClientSide(
  data: any,
  fileName: string,
  setProgress: (s: string) => void,
  cancelRef: React.MutableRefObject<boolean>
) {
  const segments = data.segments || []
  if (segments.length === 0) throw new Error("No hay segmentos")

  const pcmParts: ArrayBuffer[] = []
  let sampleRate = 16000
  let totalChunks = 0

  // Contar total de chunks para progreso
  for (const seg of segments) {
    const text = (seg.text || "").trim()
    if (text) totalChunks += splitText(text).length
  }

  let processed = 0

  for (let i = 0; i < segments.length; i++) {
    if (cancelRef.current) return

    const seg = segments[i]
    const text = (seg.text || "").trim()
    if (!text) continue

    const textChunks = splitText(text)

    for (let j = 0; j < textChunks.length; j++) {
      if (cancelRef.current) return

      processed++
      setProgress(`Generando audio... ${processed}/${totalChunks} partes (${Math.round((processed/totalChunks)*100)}%)`)

      try {
        const audioBuf = await callHfTTS(textChunks[j])
        const { pcm, rate } = extractPCM(audioBuf)
        if (pcm.byteLength > 0) {
          sampleRate = rate
          pcmParts.push(pcm)
        }
      } catch (err: any) {
        console.warn(`Chunk ${processed} falló:`, err.message)
        pcmParts.push(makeSilence(500, sampleRate))
      }

      // Pausa entre chunks del mismo segmento
      if (j < textChunks.length - 1) {
        pcmParts.push(makeSilence(100, sampleRate))
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200))
    }

    // Pausa entre segmentos
    if (i < segments.length - 1) {
      pcmParts.push(makeSilence(500, sampleRate))
    }
  }

  if (cancelRef.current) return

  if (pcmParts.length === 0) {
    throw new Error("No se generó audio. Intenta de nuevo.")
  }

  setProgress("Construyendo archivo WAV...")

  // Concatenar
  const totalLen = pcmParts.reduce((a, b) => a + b.byteLength, 0)
  const header = makeWavHeader(totalLen, sampleRate)
  const wav = new Uint8Array(44 + totalLen)
  wav.set(new Uint8Array(header), 0)
  let off = 44
  for (const part of pcmParts) {
    wav.set(new Uint8Array(part), off)
    off += part.byteLength
  }

  // Descargar
  const blob = new Blob([wav.buffer], { type: "audio/wav" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${fileName}.wav`
  a.click()
  URL.revokeObjectURL(url)

  setProgress("")
}

// ============================================================
// PODCAST — Reproducir con Web Speech API (todos los segmentos)
// ============================================================

async function playPodcastLocally(
  data: any,
  setPlaying: (v: boolean) => void,
  setProgress: (s: string) => void,
  cancelRef: React.MutableRefObject<boolean>
) {
  const segments = data.segments || []
  if (segments.length === 0) throw new Error("No hay segmentos")
  if (!window.speechSynthesis) throw new Error("Tu navegador no soporta síntesis de voz")

  speechSynthesis.cancel()
  await new Promise(r => setTimeout(r, 200))

  let voices = speechSynthesis.getVoices()
  if (voices.length === 0) {
    await new Promise<void>((resolve) => {
      speechSynthesis.onvoiceschanged = () => { voices = speechSynthesis.getVoices(); resolve() }
      setTimeout(resolve, 2000)
    })
    voices = speechSynthesis.getVoices()
  }

  const esVoices = voices.filter(v => v.lang.startsWith("es"))
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

    // Dividir en oraciones cortas
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
        const finish = () => { if (!done) { done = true; resolve() } }
        u.onend = finish
        u.onerror = finish
        setTimeout(finish, 30000)

        speechSynthesis.speak(u)
      })

      if (!cancelRef.current) await new Promise(r => setTimeout(r, 80))
    }

    // Pausa entre segmentos
    if (!cancelRef.current && i < segments.length - 1) {
      await new Promise(r => setTimeout(r, 400))
    }
  }

  setPlaying(false)
  setProgress("")
}

// ============================================================
// PODCAST — Descargar guión como TXT
// ============================================================

function downloadPodcastScript(data: any, fileName: string) {
  const segments = data.segments || []
  const lines: string[] = [
    `══════════════════════════════════════`,
    `  ${data.title || "Podcast EduAI"}`,
    `  Duración estimada: ${data.duration || "5 min"}`,
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
