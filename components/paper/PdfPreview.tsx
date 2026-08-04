"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type PdfPreviewProps = {
  bucket: string
  filePath: string
  title?: string
}

export default function PdfPreview({ bucket, filePath, title = "Documento PDF" }: PdfPreviewProps) {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")

  async function ensurePreviewUrl() {
    if (url) return url

    setLoading(true)
    setError("")

    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60)

      if (signedUrlError || !data?.signedUrl) {
        throw new Error(
          signedUrlError?.message || "No se pudo crear la vista previa segura."
        )
      }

      setUrl(data.signedUrl)
      return data.signedUrl
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudo abrir la vista previa."
      setError(message)
      return ""
    } finally {
      setLoading(false)
    }
  }

  async function togglePreview() {
    if (open) {
      setOpen(false)
      return
    }

    const previewUrl = await ensurePreviewUrl()
    if (previewUrl) setOpen(true)
  }

  return (
    <div className="mt-3 rounded-2xl border border-soft bg-card-soft-theme overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={togglePreview}
          disabled={loading}
          className="flex items-center gap-2 text-xs font-medium text-sub hover:text-main disabled:opacity-50 transition"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : open ? (
            <EyeOff size={13} />
          ) : (
            <Eye size={13} />
          )}
          {open ? "Ocultar vista previa" : "Abrir vista previa liviana"}
        </button>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-muted2 hover:text-main transition"
          >
            Nueva pestaña <ExternalLink size={10} />
          </a>
        )}
      </div>

      {error && (
        <p className="border-t border-soft px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {open && url && (
        <div className="border-t border-soft bg-black/5">
          <iframe
            title={`Vista previa de ${title}`}
            src={`${url}#toolbar=1&navpanes=0&view=FitH`}
            loading="lazy"
            className="w-full h-[68vh] min-h-[520px] bg-white"
          />
        </div>
      )}
    </div>
  )
}
