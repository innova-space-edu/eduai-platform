"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, FileAudio, Loader2, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { uploadAudioResumable } from "@/lib/audio/resumable-upload"

type Stage = "idle" | "preparing" | "uploading" | "processing" | "done" | "error"

type Result = {
  transcript: string
  transcriptClean?: string
  language: string
  durationEstimate?: string
  qualityNotes?: string
  provider?: string
  modelUsed?: string
  segments?: Array<{ id: string; start: number; end: number; text: string }>
}

const MAX_MB = 50
const ACCEPTED = ".mp3,.wav,.m4a,.mp4,.webm,.ogg"

export default function AudioLabLargePage() {
  const supabase = useMemo(() => createClient(), [])
  const [stage, setStage] = useState<Stage>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Result | null>(null)

  async function readError(response: Response) {
    const text = await response.text()
    try {
      const json = JSON.parse(text)
      return json.error || json.detail || json.message || text
    } catch {
      return text || `Error ${response.status}`
    }
  }

  async function handleFile(file: File) {
    setError("")
    setResult(null)
    setProgress(0)

    try {
      if (file.size <= 0) throw new Error("El archivo está vacío.")
      if (file.size > MAX_MB * 1024 * 1024) {
        throw new Error(`El audio supera el límite inicial de ${MAX_MB} MB.`)
      }

      setStage("preparing")
      const prepareResponse = await fetch("/api/agents/audio/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }),
      })

      if (!prepareResponse.ok) throw new Error(await readError(prepareResponse))
      const prepared = await prepareResponse.json()

      setStage("uploading")
      await uploadAudioResumable({
        supabase,
        bucket: prepared.bucket,
        objectName: prepared.filePath,
        file,
        onProgress: ({ percentage }) => setProgress(percentage),
      })

      setStage("processing")
      const processResponse = await fetch("/api/agents/audio/process-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: prepared.filePath,
          fileName: prepared.filename || file.name,
          mimeType: prepared.mimeType || file.type || "audio/mpeg",
          fileSizeBytes: file.size,
          options: {
            mode: "pro",
            improveAudio: false,
            preciseSubtitles: true,
            diarize: false,
            detectLanguage: true,
            createSummary: false,
          },
        }),
      })

      if (!processResponse.ok) throw new Error(await readError(processResponse))
      const data = await processResponse.json()
      setResult(data)
      setStage("done")
    } catch (reason) {
      setStage("error")
      setError(reason instanceof Error ? reason.message : "No se pudo procesar el audio.")
    }
  }

  const stageText = {
    idle: "Selecciona un audio para probar la carga reanudable.",
    preparing: "Preparando la ruta privada en Supabase…",
    uploading: `Subiendo directamente a Supabase… ${progress}%`,
    processing: "Procesando el audio con Faster Whisper en Hugging Face…",
    done: "Audio procesado correctamente.",
    error: "La prueba no pudo completarse.",
  }[stage]

  return (
    <main className="min-h-screen bg-app text-main px-5 py-8">
      <section className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/audio-lab" className="w-9 h-9 rounded-xl border border-soft flex items-center justify-center text-sub hover:text-main">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="font-bold text-lg">Audio Lab · archivos grandes</h1>
            <p className="text-muted2 text-xs">Carga TUS reanudable, URL firmada privada y transcripción externa.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-soft p-6 bg-card-soft-theme">
          <label className="block rounded-2xl border-2 border-dashed border-purple-500/30 p-8 text-center cursor-pointer hover:border-purple-500/60 transition">
            <input
              type="file"
              accept={ACCEPTED}
              className="hidden"
              disabled={["preparing", "uploading", "processing"].includes(stage)}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleFile(file)
                event.target.value = ""
              }}
            />
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-purple-500/10 text-purple-500">
              {stage === "done" ? <CheckCircle2 size={28} /> : <Upload size={26} />}
            </div>
            <p className="font-semibold">Seleccionar audio o video</p>
            <p className="text-muted2 text-xs mt-1">MP3, WAV, M4A, MP4, WEBM u OGG. Límite inicial: {MAX_MB} MB.</p>
          </label>

          <div className="mt-5 rounded-2xl border border-soft p-4">
            <div className="flex items-center gap-2 text-sm text-sub">
              {["preparing", "uploading", "processing"].includes(stage) && <Loader2 size={15} className="animate-spin text-purple-500" />}
              <span>{stageText}</span>
            </div>

            {stage === "uploading" && (
              <div className="mt-3 h-2 rounded-full overflow-hidden bg-black/10">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          {error && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</p>}

          {result && (
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm"><FileAudio size={15} /> Transcripción lista</div>
              <p className="text-xs text-sub">Idioma: {result.language} · Duración: {result.durationEstimate || "—"}</p>
              <p className="text-xs text-sub">Motor: {result.provider || "external"} · Modelo: {result.modelUsed || "faster-whisper"}</p>
              {result.qualityNotes && <p className="text-xs text-sub">{result.qualityNotes}</p>}
              <textarea value={result.transcriptClean || result.transcript || ""} readOnly rows={12}
                className="w-full rounded-xl border border-soft bg-transparent px-3 py-2 text-sm text-main outline-none resize-y" />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
