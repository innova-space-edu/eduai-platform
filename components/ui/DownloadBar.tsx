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
    { label: "PDF Guión",  icon: "📄", action: "pdf" },
  ],
  mindmap: [
    { label: "PNG",  icon: "🖼️", action: "png" },
    { label: "PDF",  icon: "📄", action: "pdf" },
  ],
  flashcards: [
    { label: "PDF",  icon: "📄", action: "pdf" },
  ],
  quiz: [
    { label: "PDF",  icon: "📄", action: "pdf" },
  ],
  timeline: [
    { label: "PNG",  icon: "🖼️", action: "png" },
    { label: "PDF",  icon: "📄", action: "pdf" },
  ],
}

export default function DownloadBar({ format, data, title }: DownloadBarProps) {
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
              ? "bg-white/[0.03] border-white/[0.06] text-gray-600 animate-pulse"
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
          {d.label}
        </button>
      ))}
    </div>
  )
}
