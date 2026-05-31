"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, FileText, Loader2, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { uploadPdfResumable } from "@/lib/papers/resumable-upload"

type Stage = "idle" | "preparing" | "uploading" | "extracting" | "done" | "error"

type ExtractResponse = {
  title: string
  pageCount: number
  chunkCount: number
  extractionMethod: string
  parserUsed: string
  ocrUsed: boolean
  summary: string
  documentId: string | null
}

const MAX_MB = 50

export default function LargePaperUploadPage() {
  const supabase = useMemo(() => createClient(), [])
  const [stage, setStage] = useState<Stage>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ExtractResponse | null>(null)

  async function readError(response: Response) {
    const text = await response.text()
    try {
      const json = JSON.parse(text)
      return json.error || json.message || text
    } catch {
      return text || `Error ${response.status}`
    }
  }

  async function handleFile(file: File) {
    setError("")
    setResult(null)
    setProgress(0)

    try {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Selecciona un archivo PDF.")
      }
      if (file.size <= 0) throw new Error("El archivo está vacío.")
      if (file.size > MAX_MB * 1024 * 1024) {
        throw new Error(`El PDF supera el límite inicial de ${MAX_MB} MB.`)
      }

      setStage("preparing")
      const signedResponse = await fetch("/api/agents/paper/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/pdf",
          size: file.size,
        }),
      })

      if (!signedResponse.ok) throw new Error(await readError(signedResponse))
      const signed = await signedResponse.json()

      setStage("uploading")
      await uploadPdfResumable({
        supabase,
        bucket: signed.bucket,
        objectName: signed.filePath,
        file,
        onProgress: ({ percentage }) => setProgress(percentage),
      })

      setStage("extracting")
      const extractResponse = await fetch("/api/agents/paper/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: signed.bucket,
          filePath: signed.filePath,
          filename: signed.filename || file.name,
          forceRefresh: false,
        }),
      })

      if (!extractResponse.ok) throw new Error(await readError(extractResponse))
      const extractData = await extractResponse.json()
      setResult(extractData)
      setStage("done")
    } catch (reason) {
      setStage("error")
      setError(reason instanceof Error ? reason.message : "No se pudo procesar el PDF.")
    }
  }

  const stageText = {
    idle: "Selecciona un PDF para probar la carga reanudable.",
    preparing: "Preparando la ruta segura en Supabase…",
    uploading: `Subiendo directamente a Supabase… ${progress}%`,
    extracting: "Analizando el PDF con Hugging Face y generando fragmentos…",
    done: "Documento procesado correctamente.",
    error: "La prueba no pudo completarse.",
  }[stage]

  return (
    <main className="min-h-screen bg-app text-main px-5 py-8">
      <section className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/paper" className="w-9 h-9 rounded-xl border border-soft flex items-center justify-center text-sub hover:text-main">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="font-bold text-lg">Chat Paper · PDF grandes</h1>
            <p className="text-muted2 text-xs">Carga reanudable TUS con progreso real y análisis posterior.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-soft p-6 bg-card-soft-theme">
          <label className="block rounded-2xl border-2 border-dashed border-pink-500/30 p-8 text-center cursor-pointer hover:border-pink-500/60 transition">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={["preparing", "uploading", "extracting"].includes(stage)}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleFile(file)
                event.target.value = ""
              }}
            />
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-pink-500/10 text-pink-400">
              {stage === "done" ? <CheckCircle2 size={28} /> : <Upload size={26} />}
            </div>
            <p className="font-semibold">Seleccionar PDF</p>
            <p className="text-muted2 text-xs mt-1">Límite inicial: {MAX_MB} MB. La carga se reanuda si la conexión se interrumpe.</p>
          </label>

          <div className="mt-5 rounded-2xl border border-soft p-4">
            <div className="flex items-center gap-2 text-sm text-sub">
              {["preparing", "uploading", "extracting"].includes(stage) && <Loader2 size={15} className="animate-spin text-pink-400" />}
              <span>{stageText}</span>
            </div>

            {stage === "uploading" && (
              <div className="mt-3 h-2 rounded-full overflow-hidden bg-black/10">
                <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          {error && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</p>}

          {result && (
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm"><FileText size={15} /> {result.title}</div>
              <p className="text-xs text-sub">Páginas: {result.pageCount} · Fragmentos: {result.chunkCount}</p>
              <p className="text-xs text-sub">Parser: {result.parserUsed || result.extractionMethod} · OCR: {result.ocrUsed ? "Sí" : "No"}</p>
              {result.summary && <p className="text-sm text-sub pt-2 border-t border-soft">{result.summary}</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
