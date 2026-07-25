"use client"

import { useState } from "react"
import { FileText, Image as ImageIcon, LoaderCircle } from "lucide-react"
import { downloadRenderedAsImage } from "@/lib/creator-downloads"
import { downloadEditableDocumentAsPDF } from "@/lib/editable-document-downloads"

type ExportableDocumentFormat = "cornell" | "glossary" | "lessonplan"

function makeSafeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60) || "eduai-documento"
}

export default function EditableDocumentDownloadBar({
  format,
  data,
  title,
  accentColor,
}: {
  format: ExportableDocumentFormat
  data: any
  title: string
  accentColor: string
}) {
  const [downloading, setDownloading] = useState<"png" | "pdf" | null>(null)
  const fileName = makeSafeFileName(title)

  const runExport = async (kind: "png" | "pdf") => {
    setDownloading(kind)
    try {
      if (kind === "png") {
        await downloadRenderedAsImage("creator-result-container", fileName, "png")
      } else {
        await downloadEditableDocumentAsPDF(data, format, fileName, accentColor)
      }
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="rounded-2xl border border-soft bg-card-theme p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-muted2">↓ Exportar</span>
        <button
          type="button"
          onClick={() => runExport("png")}
          disabled={downloading !== null}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-1.5 text-xs font-semibold text-violet-600 disabled:opacity-40"
        >
          {downloading === "png" ? <LoaderCircle size={13} className="animate-spin" /> : <ImageIcon size={13} />}
          {downloading === "png" ? "Generando..." : "PNG"}
        </button>
        <button
          type="button"
          onClick={() => runExport("pdf")}
          disabled={downloading !== null}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40"
        >
          {downloading === "pdf" ? <LoaderCircle size={13} className="animate-spin" /> : <FileText size={13} />}
          {downloading === "pdf" ? "Generando..." : "PDF"}
        </button>
      </div>
    </div>
  )
}
