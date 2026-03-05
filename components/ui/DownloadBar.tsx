// src/components/ui/DownloadBar.tsx
"use client"

import { useState, useRef, type MutableRefObject } from "react"
import { downloadRenderedAsImage, downloadAsPDF, downloadAsPPTX } from "@/lib/creator-downloads"

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
    try {
      speechSynthesis.cancel()
    } catch {}
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

              {isStoppable ? "Detener" : downloading === d.action ? progress || "Generando..." : d.label}
            </button>
          )
        })}
      </div>

      {progress && <p className="text-blue-400 text-[11px] animate-pulse">{progress}</p>}
    </div>
  )
}

// ============================================================
// PODCAST WAV — 1 sola llamada a nuestro endpoint:
// POST /api/agents/podcast-wav  -> devuelve WAV final
// (backend se encarga de 2 voces, calidad tipo podcast, etc.)
// ============================================================

async function generateAndDownloadWAV(
  data: any,
  fileName: string,
  setProgress: (s: string) => void,
  cancelRef: MutableRefObject<boolean>
) {
  const segments = data?.segments || []
  if (!Array.isArray(segments) || segments.length === 0) throw new Error("No hay segmentos")

  setProgress("Generando audio (podcast)...")

  const res = await fetch("/api/agents/podcast-wav", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments }),
  })

  if (cancelRef.current) return

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `Error ${res.status}`)
  }

  const wavBuf = await res.arrayBuffer()
  if (wavBuf.byteLength < 44) throw new Error("Audio devuelto demasiado corto")

  setProgress("Preparando descarga...")

  const blob = new Blob([wavBuf], { type: "audio/wav" })
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = `${fileName}.wav`
  a.click()

  setTimeout(() => URL.revokeObjectURL(url), 1500)
  setProgress("")
}

// ============================================================
// ESCUCHAR — Web Speech API local (sin servidor)
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
        u.rate = seg.speaker === "A" ? 0.95 : 1.0
        u.pitch = seg.speaker === "A" ? 0.9 : 1.1
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

      if (!cancelRef.current) await new Promise((r) => setTimeout(r, 60))
    }

    if (!cancelRef.current && i < segments.length - 1) {
      await new Promise((r) => setTimeout(r, 250))
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
