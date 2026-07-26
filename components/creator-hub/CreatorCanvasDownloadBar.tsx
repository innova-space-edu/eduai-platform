"use client"

import { useState } from "react"
import { FileDown, FileText, Image as ImageIcon, LoaderCircle, Presentation } from "lucide-react"
import { downloadRenderedAsImage } from "@/lib/creator-downloads"
import { downloadCreatorCanvasAsPDF, downloadCreatorCanvasAsPPTX } from "@/lib/creator-canvas-downloads"

function safeName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60) || "eduai-lienzo"
}

const buttonClass = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-sub transition hover:text-main disabled:opacity-35"

export default function CreatorCanvasDownloadBar({ format, data, title }: { format: string; data: any; title: string }) {
  const [busy, setBusy] = useState<string | null>(null)
  const fileName = safeName(title)

  const run = async (type: "png" | "jpg" | "pdf" | "pptx") => {
    setBusy(type)
    try {
      if (type === "png") await downloadRenderedAsImage("creator-result-container", fileName, "png")
      else if (type === "jpg") await downloadRenderedAsImage("creator-result-container", fileName, "jpeg")
      else if (type === "pdf") await downloadCreatorCanvasAsPDF(data, title)
      else await downloadCreatorCanvasAsPPTX(data, title)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-muted2">Exportar</span>
      <button type="button" onClick={() => run("png")} disabled={busy !== null} className={buttonClass}>{busy === "png" ? <LoaderCircle size={13} className="animate-spin" /> : <ImageIcon size={13} />} PNG</button>
      <button type="button" onClick={() => run("jpg")} disabled={busy !== null} className={buttonClass}>{busy === "jpg" ? <LoaderCircle size={13} className="animate-spin" /> : <ImageIcon size={13} />} JPG</button>
      <button type="button" onClick={() => run("pdf")} disabled={busy !== null} className={buttonClass}>{busy === "pdf" ? <LoaderCircle size={13} className="animate-spin" /> : <FileText size={13} />} PDF</button>
      {format === "ppt" && <button type="button" onClick={() => run("pptx")} disabled={busy !== null} className={buttonClass}>{busy === "pptx" ? <LoaderCircle size={13} className="animate-spin" /> : <Presentation size={13} />} PPTX</button>}
      {busy && <span className="text-[10px] text-muted2"><FileDown size={11} className="mr-1 inline" />Preparando archivo...</span>}
    </div>
  )
}
