// src/components/ui/DownloadBar.tsx
"use client"

import { useState } from "react"
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
          await downloadPodcastAudio(data, baseName, setProgress)
          break
        case "play":
          await playPodcastLocally(data, setPlaying)
          break
        case "txt":
          downloadPodcastScript(data, baseName)
          break
      }
      setSuccess(action)
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      console.error("Error:", err)
      setProgress(`Error: ${err.message}`)
      setTimeout(() => setProgress(""), 3000)
    } finally {
      setDownloading(null)
    }
  }

  const handleStop = () => {
    speechSynthesis.cancel()
    setPlaying(false)
  }

  if (downloads.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-600 text-xs font-semibold tracking-wide mr-1">DESCARGAR:</span>
        {downloads.map((d) => {
          const isPlayBtn = d.action === "play"
          return (
            <button
              key={d.action}
              onClick={() => isPlayBtn && playing ? handleStop() : handleDownload(d.action)}
              disabled={downloading !== null && downloading !== d.action && !isPlayBtn}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isPlayBtn && playing
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : success === d.action
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : downloading === d.action
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  : "bg-white/[0.04] border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-white hover:border-white/15"
              } disabled:opacity-40`}
            >
              {downloading === d.action ? (
                <span className="w-3 h-3 rounded-full border border-gray-500 border-t-blue-400 animate-spin" />
              ) : success === d.action ? (
                <span>✅</span>
              ) : isPlayBtn && playing ? (
                <span>⏹️</span>
              ) : (
                <span>{d.icon}</span>
              )}
              {downloading === d.action
                ? (progress || "Generando...")
                : isPlayBtn && playing
                ? "Detener"
                : d.label}
            </button>
          )
        })}
      </div>
      {progress && downloading && (
        <p className="text-blue-400 text-[11px] animate-pulse">{progress}</p>
      )}
    </div>
  )
}

// ============================================================
// PODCAST — Descargar audio real via API server-side
// ============================================================

async function downloadPodcastAudio(
  data: any,
  fileName: string,
  setProgress: (s: string) => void
) {
  const segments = data.segments || []
  if (segments.length === 0) throw new Error("No hay segmentos")

  setProgress(`Generando audio de ${segments.length} segmentos...`)

  const res = await fetch("/api/agents/tts-podcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      segments,
      title: fileName,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error desconocido" }))
    throw new Error(err.error || `Error ${res.status}`)
  }

  setProgress("Descargando archivo de audio...")

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${fileName}.wav`
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================
// PODCAST — Reproducir localmente con Web Speech API
// ============================================================

async function playPodcastLocally(
  data: any,
  setPlaying: (v: boolean) => void
) {
  const segments = data.segments || []
  if (segments.length === 0) throw new Error("No hay segmentos")

  if (!window.speechSynthesis) {
    throw new Error("Tu navegador no soporta síntesis de voz")
  }

  speechSynthesis.cancel()

  let voices = speechSynthesis.getVoices()
  if (voices.length === 0) {
    await new Promise<void>((resolve) => {
      speechSynthesis.onvoiceschanged = () => {
        voices = speechSynthesis.getVoices()
        resolve()
      }
      setTimeout(resolve, 1500)
    })
    voices = speechSynthesis.getVoices()
  }

  const esVoices = voices.filter(v => v.lang.startsWith("es"))
  const voiceA = esVoices[0] || voices[0]
  const voiceB = esVoices.find(v => v !== voiceA) || esVoices[1] || voices[1] || voiceA

  setPlaying(true)

  for (const seg of segments) {
    if (!speechSynthesis.speaking && segments.indexOf(seg) > 0) break

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(seg.text)
      utterance.voice = seg.speaker === "A" ? voiceA : voiceB
      utterance.lang = "es-ES"
      utterance.rate = seg.speaker === "A" ? 0.92 : 1.0
      utterance.pitch = seg.speaker === "A" ? 0.85 : 1.15
      utterance.onend = () => setTimeout(resolve, 400)
      utterance.onerror = () => setTimeout(resolve, 100)
      speechSynthesis.speak(utterance)
    })
  }

  setPlaying(false)
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
    const speaker = seg.speaker === "A" ? "HOST A (Profesor)" : "HOST B (Estudiante)"
    lines.push(`[${speaker}]`)
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
