"use client"

import { useState } from "react"
import Link from "next/link"
import { Clipboard, Download, Printer, QrCode } from "lucide-react"
import DownloadBar from "@/components/ui/DownloadBar"
import CreatorCanvasDownloadBar from "@/components/creator-hub/CreatorCanvasDownloadBar"
import CreatorQualityPanel from "@/components/creator-hub/CreatorQualityPanel"
import CreatorTransformPanel from "@/components/creator-hub/CreatorTransformPanel"

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
  const hasCanvas = Boolean((data as any)?._canvas?.pages?.length)
  const materialTitle = title || readString(data, "title") || readString(data, "headline") || "Material EduAI"
  const actionClass = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-sub transition hover:text-main"

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
      <div className="space-y-2 border-t border-soft pt-2">
        {hasCanvas ? (
          <CreatorCanvasDownloadBar format={format} data={data} title={materialTitle} />
        ) : (
          <DownloadBar format={format} data={data} accentColor={accentColor} designTemplateId={designTemplateId} title={title} />
        )}
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-muted2">Acciones</span>
          <button type="button" onClick={copyJson} className={actionClass}><Clipboard size={13} /> {copied ? "Copiado" : "Copiar JSON"}</button>
          <button type="button" onClick={downloadJson} className={actionClass}><Download size={13} /> Respaldo</button>
          <button type="button" onClick={() => window.print()} className={actionClass}><Printer size={13} /> Imprimir</button>
          <Link href="/qr-studio" className={actionClass}><QrCode size={13} /> QR Studio</Link>
        </div>
      </div>
      <CreatorTransformPanel sourceFormat={format} data={data} accentColor={accentColor} designTemplateId={designTemplateId} />
      <CreatorQualityPanel format={format} data={data} />
    </div>
  )
}
