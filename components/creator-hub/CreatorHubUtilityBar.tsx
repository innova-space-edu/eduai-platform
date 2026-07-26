"use client"

import { useState } from "react"
import Link from "next/link"
import { Clipboard, Download, Printer, QrCode } from "lucide-react"
import DownloadBar from "@/components/ui/DownloadBar"
import CreatorQualityPanel from "@/components/creator-hub/CreatorQualityPanel"

interface CreatorHubUtilityBarProps {
  format: string
  data: unknown
  accentColor: string
  designTemplateId?: string
  title?: string
}

function safeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60) || "eduai-material"
}

function readString(data: unknown, key: string) {
  if (typeof data !== "object" || data === null) return undefined
  const value = (data as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

export default function CreatorHubUtilityBar({ format, data, accentColor, designTemplateId, title }: CreatorHubUtilityBarProps) {
  const [copied, setCopied] = useState(false)
  const fileName = safeFileName(title || readString(data, "title") || readString(data, "headline") || readString(data, "deckTitle") || readString(data, "centralTopic") || "eduai-material")

  const copyJson = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${fileName}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 800)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-soft bg-card-theme p-3.5">
        <DownloadBar format={format} data={data} accentColor={accentColor} designTemplateId={designTemplateId} title={title} />
        <div className="flex flex-wrap gap-2 border-t border-soft pt-3">
          <span className="mr-1 self-center text-[11px] font-semibold uppercase tracking-widest text-muted2">Acciones</span>
          <button type="button" onClick={copyJson} className="flex items-center gap-1.5 rounded-xl border border-soft px-3 py-1.5 text-xs font-semibold text-muted2 transition-all hover:bg-card-soft-theme hover:text-main">
            <Clipboard size={13} /> {copied ? "Copiado" : "Copiar JSON"}
          </button>
          <button type="button" onClick={downloadJson} className="flex items-center gap-1.5 rounded-xl border border-soft px-3 py-1.5 text-xs font-semibold text-muted2 transition-all hover:bg-card-soft-theme hover:text-main">
            <Download size={13} /> Respaldo JSON
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl border border-soft px-3 py-1.5 text-xs font-semibold text-muted2 transition-all hover:bg-card-soft-theme hover:text-main">
            <Printer size={13} /> Imprimir vista
          </button>
          <Link href="/qr-studio" className="flex items-center gap-1.5 rounded-xl border border-soft px-3 py-1.5 text-xs font-semibold text-muted2 transition-all hover:bg-card-soft-theme hover:text-main">
            <QrCode size={13} /> Abrir QR Studio
          </Link>
        </div>
      </div>
      <CreatorQualityPanel format={format} data={data} />
    </div>
  )
}
