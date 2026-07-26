"use client"

import { useState } from "react"
import { FileText, Image as ImageIcon, LoaderCircle } from "lucide-react"
import { downloadRenderedAsImage } from "@/lib/creator-downloads"

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 70) || "eduai-documento"
}

async function downloadElementAsPDF(elementId: string, fileName: string) {
  const { toPng } = await import("html-to-image")
  const { jsPDF } = await import("jspdf")
  const element = document.getElementById(elementId)
  if (!element) throw new Error("No se encontró el documento")

  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
  })

  const image = new Image()
  image.src = dataUrl
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("No fue posible preparar el PDF"))
  })

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 8
  const printableWidth = pageWidth - margin * 2
  const scaledHeight = (image.height * printableWidth) / image.width
  const printableHeight = pageHeight - margin * 2
  let offset = 0
  let page = 0

  while (offset < scaledHeight) {
    if (page > 0) pdf.addPage()
    pdf.addImage(dataUrl, "PNG", margin, margin - offset, printableWidth, scaledHeight)
    offset += printableHeight
    page += 1
  }

  pdf.save(`${fileName}.pdf`)
}

export default function EducationalDocumentDownloadBar({ title }: { title: string }) {
  const [downloading, setDownloading] = useState<"png" | "pdf" | null>(null)
  const [error, setError] = useState("")
  const fileName = safeFileName(title)

  const run = async (kind: "png" | "pdf") => {
    setDownloading(kind)
    setError("")
    try {
      if (kind === "png") await downloadRenderedAsImage("creator-result-container", fileName, "png")
      else await downloadElementAsPDF("creator-result-container", fileName)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible exportar el documento")
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="rounded-2xl border border-soft bg-card-theme p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-muted2">↓ Exportar documento</span>
        <button type="button" onClick={() => run("png")} disabled={downloading !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-1.5 text-xs font-semibold text-violet-600 disabled:opacity-40">{downloading === "png" ? <LoaderCircle size={13} className="animate-spin" /> : <ImageIcon size={13} />} PNG</button>
        <button type="button" onClick={() => run("pdf")} disabled={downloading !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40">{downloading === "pdf" ? <LoaderCircle size={13} className="animate-spin" /> : <FileText size={13} />} PDF</button>
      </div>
      {error && <p className="mt-2 text-[10px] text-red-500">{error}</p>}
    </div>
  )
}
