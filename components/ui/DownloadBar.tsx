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
    { label: "MP3 Audio",  icon: "🔊", action: "mp3" },
    { label: "PDF Guión",  icon: "📄", action: "pdf" },
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
          await downloadAsPDF(data, format, baseName)
          break
        case "pptx":
          await downloadAsPPTX(data, baseName)
          break
        case "mp3":
          await generatePodcastAudio(data, baseName)
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

  if (downloads.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-gray-600 text-xs font-semibold tracking-wide mr-1">DESCARGAR:</span>
      {downloads.map((d) => (
        <button
          key={d.action}
          onClick={() => handleDownload(d.action)}
          disabled={downloading !== null}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
            success === d.action
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
          ) : (
            <span>{d.icon}</span>
          )}
          {downloading === d.action && d.action === "mp3" ? "Generando audio..." : d.label}
        </button>
      ))}
    </div>
  )
}

// ============================================================
// PODCAST TTS — Genera audio MP3 con Web Speech API
// ============================================================

async function generatePodcastAudio(data: any, fileName: string) {
  const segments = data.segments || []
  if (segments.length === 0) throw new Error("No hay segmentos")

  // Verificar soporte
  if (!window.speechSynthesis) {
    throw new Error("Tu navegador no soporta síntesis de voz")
  }

  // Usar MediaRecorder + SpeechSynthesis para grabar audio
  const audioCtx = new AudioContext({ sampleRate: 44100 })
  const dest = audioCtx.createMediaStreamDestination()
  const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" })
  const chunks: Blob[] = []

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  // Obtener voces disponibles
  let voices = speechSynthesis.getVoices()
  if (voices.length === 0) {
    await new Promise<void>((resolve) => {
      speechSynthesis.onvoiceschanged = () => {
        voices = speechSynthesis.getVoices()
        resolve()
      }
      setTimeout(resolve, 1000)
    })
    voices = speechSynthesis.getVoices()
  }

  // Buscar voces en español
  const esVoices = voices.filter(v => v.lang.startsWith("es"))
  const voiceA = esVoices.find(v => v.name.includes("male") || v.name.includes("Male")) || esVoices[0] || voices[0]
  const voiceB = esVoices.find(v => v !== voiceA && (v.name.includes("female") || v.name.includes("Female"))) || esVoices[1] || voices[1] || voiceA

  recorder.start()

  // Hablar cada segmento secuencialmente
  for (const seg of segments) {
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(seg.text)
      utterance.voice = seg.speaker === "A" ? voiceA : voiceB
      utterance.lang = "es-ES"
      utterance.rate = seg.speaker === "A" ? 0.95 : 1.0
      utterance.pitch = seg.speaker === "A" ? 0.9 : 1.1
      utterance.onend = () => {
        // Pausa breve entre segmentos
        setTimeout(resolve, 300)
      }
      utterance.onerror = () => resolve()
      speechSynthesis.speak(utterance)
    })
  }

  // Detener grabación y descargar
  recorder.stop()

  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
    // Timeout de seguridad
    setTimeout(resolve, 2000)
  })

  // Dar tiempo para chunks finales
  await new Promise(r => setTimeout(r, 500))

  if (chunks.length === 0) {
    // Fallback: descargar como texto si no se pudo grabar audio
    const text = segments.map((s: any) => `[${s.speaker === "A" ? "Host A" : "Host B"}]\n${s.text}\n`).join("\n")
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileName}-guion.txt`
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  const blob = new Blob(chunks, { type: "audio/webm" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${fileName}.webm`
  a.click()
  URL.revokeObjectURL(url)
  await audioCtx.close()
}
