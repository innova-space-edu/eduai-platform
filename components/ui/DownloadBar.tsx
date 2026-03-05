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

  const downloads = FORMAT_DOWNLOADS[format] || []
  const baseName = (title || data?.title || data?.deckTitle || data?.headline || "eduai-export")
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 50)

  const handleDownload = async (action: string) => {
    setDownloading(action)
    setSuccess(null)
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
        case "play":
          await playPodcastAudio(data, setPlaying)
          break
        case "txt":
          downloadPodcastScript(data, baseName)
          break
      }
      setSuccess(action)
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      console.error("Error descargando:", err)
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
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-gray-600 text-xs font-semibold tracking-wide mr-1">DESCARGAR:</span>
      {downloads.map((d) => {
        const isPlayBtn = d.action === "play"
        return (
          <button
            key={d.action}
            onClick={() => isPlayBtn && playing ? handleStop() : handleDownload(d.action)}
            disabled={downloading !== null && downloading !== d.action}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isPlayBtn && playing
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : success === d.action
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : downloading === d.action
                ? "bg-white/[0.03] border-white/[0.06] text-gray-600"
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
            {isPlayBtn && playing ? "Detener" : d.label}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// PODCAST — Reproducir con Web Speech API
// ============================================================

async function playPodcastAudio(
  data: any,
  setPlaying: (v: boolean) => void
) {
  const segments = data.segments || []
  if (segments.length === 0) throw new Error("No hay segmentos")

  if (!window.speechSynthesis) {
    throw new Error("Tu navegador no soporta síntesis de voz")
  }

  // Cancelar cualquier reproducción previa
  speechSynthesis.cancel()

  // Cargar voces
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

  // Buscar voces en español
  const esVoices = voices.filter(v => v.lang.startsWith("es"))

  // Intentar encontrar voces distintas
  const maleKeywords = ["male", "Male", "Jorge", "Pablo", "Carlos", "Diego", "Andrés"]
  const femaleKeywords = ["female", "Female", "Paulina", "María", "Carmen", "Laura", "Elena"]

  const voiceA =
    esVoices.find(v => maleKeywords.some(k => v.name.includes(k))) ||
    esVoices[0] ||
    voices[0]

  const voiceB =
    esVoices.find(v => v !== voiceA && femaleKeywords.some(k => v.name.includes(k))) ||
    esVoices.find(v => v !== voiceA) ||
    esVoices[1] ||
    voices[1] ||
    voiceA

  setPlaying(true)

  // Reproducir segmentos uno por uno
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    // Verificar si se canceló
    if (!speechSynthesis.speaking && i > 0) {
      // Fue cancelado por el usuario
      break
    }

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(seg.text)
      utterance.voice = seg.speaker === "A" ? voiceA : voiceB
      utterance.lang = "es-ES"
      utterance.rate = seg.speaker === "A" ? 0.92 : 1.0
      utterance.pitch = seg.speaker === "A" ? 0.85 : 1.15
      utterance.volume = 1.0

      utterance.onend = () => setTimeout(resolve, 400)
      utterance.onerror = () => setTimeout(resolve, 100)

      speechSynthesis.speak(utterance)
    })

    // Verificar cancelación entre segmentos
    if (speechSynthesis.pending === false && speechSynthesis.speaking === false) {
      break
    }
  }

  setPlaying(false)
}

// ============================================================
// PODCAST — Descargar guión como TXT
// ============================================================

function downloadPodcastScript(data: any, fileName: string) {
  const segments = data.segments || []
  const lines: string[] = [
    `═══════════════════════════════════════`,
    `  ${data.title || "Podcast EduAI"}`,
    `  Duración estimada: ${data.duration || "5 min"}`,
    `═══════════════════════════════════════`,
    ``,
  ]

  for (const seg of segments) {
    const speaker = seg.speaker === "A" ? "HOST A (Profesor)" : "HOST B (Estudiante)"
    lines.push(`[${speaker}]`)
    lines.push(seg.text)
    lines.push(``)
  }

  lines.push(`───────────────────────────────────────`)
  lines.push(`Generado por EduAI Creator Studio`)

  const text = lines.join("\n")
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${fileName}-guion.txt`
  a.click()
  URL.revokeObjectURL(url)
}
