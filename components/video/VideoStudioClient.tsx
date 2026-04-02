"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type VideoMode = "text-to-video" | "image-to-video"
type VideoDuration = 6 | 10

type VideoJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "canceled"

type CreateVideoResponse = {
  ok: boolean
  jobId?: string
  cached?: boolean
  status?: VideoJobStatus
  message?: string
  error?: string
}

type VideoStatusResponse = {
  ok: boolean
  job?: {
    id: string
    status: VideoJobStatus
    prompt: string
    mode: VideoMode
    duration_seconds: number
    include_audio: boolean
    image_url?: string | null
    output_url?: string | null
    error_message?: string | null
    created_at?: string
    updated_at?: string
  }
  error?: string
}

type RecentJob = {
  id: string
  prompt: string
  status: VideoJobStatus
  output_url?: string | null
  created_at?: string
}

const PROMPT_EXAMPLES = [
  "Un profesor robot explicando matemáticas en una sala futurista, movimiento suave de cámara, estilo educativo cinematográfico.",
  "Un estudiante observando el sistema solar holográfico en una sala espacial, iluminación azul y morada, estilo moderno.",
  "Una molécula girando en un laboratorio futurista con pantallas científicas alrededor y cámara lenta.",
]

export default function VideoStudioClient() {
  const [mode, setMode] = useState<VideoMode>("text-to-video")
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState<VideoDuration>(6)
  const [includeAudio, setIncludeAudio] = useState(false)
  const [audioPrompt, setAudioPrompt] = useState("")
  const [style, setStyle] = useState("educational cinematic")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [currentStatus, setCurrentStatus] = useState<VideoJobStatus | null>(null)
  const [currentOutputUrl, setCurrentOutputUrl] = useState<string | null>(null)
  const [currentError, setCurrentError] = useState<string | null>(null)

  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const canSubmit = useMemo(() => {
    if (!prompt.trim()) return false
    if (mode === "image-to-video" && !uploadedImageUrl && !selectedFile) return false
    if (includeAudio && !audioPrompt.trim()) return false
    return true
  }, [prompt, mode, uploadedImageUrl, selectedFile, includeAudio, audioPrompt])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  async function startPolling(jobId: string) {
    stopPolling()

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/agents/video/status/${jobId}`, {
          method: "GET",
          cache: "no-store",
        })

        const data: VideoStatusResponse = await res.json()

        if (!data.ok || !data.job) {
          setCurrentError(data.error || "No se pudo consultar el estado del video.")
          return
        }

        const job = data.job
        setCurrentStatus(job.status)
        setCurrentOutputUrl(job.output_url ?? null)
        setCurrentError(job.error_message ?? null)

        setRecentJobs((prev) => {
          const next = [...prev]
          const idx = next.findIndex((j) => j.id === job.id)

          const item: RecentJob = {
            id: job.id,
            prompt: job.prompt,
            status: job.status,
            output_url: job.output_url ?? null,
            created_at: job.created_at,
          }

          if (idx >= 0) next[idx] = item
          else next.unshift(item)

          return next.slice(0, 8)
        })

        if (
          job.status === "completed" ||
          job.status === "failed" ||
          job.status === "canceled"
        ) {
          stopPolling()
        }
      } catch (error) {
        console.error(error)
        setCurrentError("Error al consultar el estado del video.")
      }
    }

    await fetchStatus()
    pollingRef.current = setInterval(fetchStatus, 4000)
  }

  function applyExample(text: string) {
    setPrompt(text)
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    setUploadedImageUrl(null)

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }

    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    setImagePreview(objectUrl)
  }

  async function uploadImageIfNeeded(): Promise<string | null> {
    if (mode !== "image-to-video") return null
    if (uploadedImageUrl) return uploadedImageUrl
    if (!selectedFile) return null

    setIsUploadingImage(true)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const res = await fetch("/api/uploads/video-image", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.")
      }

      setUploadedImageUrl(data.url)
      return data.url
    } catch (error) {
      console.error(error)
      setCurrentError("No se pudo subir la imagen base.")
      return null
    } finally {
      setIsUploadingImage(false)
    }
  }

  async function handleGenerate() {
    setCurrentError(null)
    setCurrentOutputUrl(null)
    setCurrentStatus(null)

    if (!canSubmit) return

    setIsSubmitting(true)

    try {
      let imageUrl: string | null = null

      if (mode === "image-to-video") {
        imageUrl = await uploadImageIfNeeded()
        if (!imageUrl) {
          setIsSubmitting(false)
          return
        }
      }

      const body = {
        mode,
        prompt: prompt.trim(),
        durationSeconds: duration,
        includeAudio,
        audioPrompt: includeAudio ? audioPrompt.trim() : "",
        style: style.trim(),
        imageUrl,
      }

      const res = await fetch("/api/agents/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const data: CreateVideoResponse = await res.json()

      if (!res.ok || !data.ok || !data.jobId) {
        setCurrentError(data.error || data.message || "No se pudo crear el video.")
        return
      }

      setCurrentJobId(data.jobId)
      setCurrentStatus(data.status || "queued")

      setRecentJobs((prev) =>
        [
          {
            id: data.jobId!,
            prompt: prompt.trim(),
            status: data.status || "queued",
            output_url: null,
          },
          ...prev,
        ].slice(0, 8)
      )

      await startPolling(data.jobId)
    } catch (error) {
      console.error(error)
      setCurrentError("Ocurrió un error al enviar el video a la cola.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setPrompt("")
    setDuration(6)
    setIncludeAudio(false)
    setAudioPrompt("")
    setStyle("educational cinematic")
    setSelectedFile(null)
    setUploadedImageUrl(null)
    setCurrentError(null)

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }
  }

  function getStatusColor(status: VideoJobStatus | null) {
    switch (status) {
      case "queued":
        return "bg-amber-500/15 text-amber-300 border-amber-400/30"
      case "processing":
        return "bg-blue-500/15 text-blue-300 border-blue-400/30"
      case "completed":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
      case "failed":
        return "bg-red-500/15 text-red-300 border-red-400/30"
      case "canceled":
        return "bg-slate-500/15 text-slate-300 border-slate-400/30"
      default:
        return "bg-slate-500/15 text-slate-300 border-slate-400/30"
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl md:p-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Configurar video</h2>
            <p className="mt-1 text-sm text-slate-300">
              Elige el tipo de generación, duración y audio.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("text-to-video")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                mode === "text-to-video"
                  ? "bg-cyan-500 text-slate-950"
                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Texto → Video
            </button>

            <button
              type="button"
              onClick={() => setMode("image-to-video")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                mode === "image-to-video"
                  ? "bg-cyan-500 text-slate-950"
                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Imagen → Video
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Prompt del video
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="Describe el video que quieres generar..."
              className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-400/50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Estilo visual
            </label>
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Ej: cinematic educational, futuristic, realistic"
              className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-400/50"
            />
          </div>

          {mode === "image-to-video" && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
              <label className="mb-3 block text-sm font-medium text-slate-200">
                Imagen base
              </label>

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-950 hover:file:bg-cyan-400"
              />

              {imagePreview && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                  <img
                    src={imagePreview}
                    alt="Vista previa"
                    className="max-h-72 w-full object-cover"
                  />
                </div>
              )}

              <p className="mt-3 text-xs text-slate-400">
                Usa una imagen clara. Idealmente un personaje, objeto o escena
                bien definida para obtener mejor animación.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
              <label className="mb-3 block text-sm font-medium text-slate-200">
                Duración
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDuration(6)}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    duration === 6
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  6 segundos
                </button>

                <button
                  type="button"
                  onClick={() => setDuration(10)}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    duration === 10
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  10 segundos
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Recomendado usar 6 s por defecto para ahorrar costo y mantener
                estabilidad.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
              <label className="mb-3 block text-sm font-medium text-slate-200">
                Audio
              </label>

              <button
                type="button"
                onClick={() => setIncludeAudio((v) => !v)}
                className={`w-full rounded-xl px-4 py-2 text-sm font-medium transition ${
                  includeAudio
                    ? "bg-fuchsia-500 text-slate-950"
                    : "bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {includeAudio ? "Audio activado" : "Activar audio"}
              </button>

              <p className="mt-3 text-xs text-slate-400">
                Por ahora puedes dejarlo desactivado mientras validamos el flujo
                principal del video.
              </p>
            </div>
          </div>

          {includeAudio && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Texto o idea del audio
              </label>
              <textarea
                value={audioPrompt}
                onChange={(e) => setAudioPrompt(e.target.value)}
                rows={3}
                placeholder="Ej: una narración breve o ambiente educativo."
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-400/50"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canSubmit || isSubmitting || isUploadingImage}
              className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Enviando a la cola..."
                : isUploadingImage
                ? "Subiendo imagen..."
                : "Generar video"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Limpiar
            </button>
          </div>

          {currentError && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {currentError}
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl md:p-5">
          <h3 className="text-lg font-semibold">Estado actual</h3>

          <div className="mt-4 space-y-3">
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-400">
                Job ID
              </span>
              <div className="mt-1 break-all rounded-xl bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
                {currentJobId || "Sin generación activa"}
              </div>
            </div>

            <div>
              <span className="text-xs uppercase tracking-wide text-slate-400">
                Estado
              </span>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(
                    currentStatus
                  )}`}
                >
                  {currentStatus || "Sin estado"}
                </span>
              </div>
            </div>

            {currentOutputUrl && (
              <div className="pt-2">
                <video
                  src={currentOutputUrl}
                  controls
                  className="w-full rounded-2xl border border-white/10 bg-black"
                />
                <a
                  href={currentOutputUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Abrir video
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl md:p-5">
          <h3 className="text-lg font-semibold">Ejemplos rápidos</h3>
          <div className="mt-4 space-y-3">
            {PROMPT_EXAMPLES.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => applyExample(example)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/50 p-3 text-left text-sm text-slate-200 transition hover:bg-slate-800/70"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl md:p-5">
          <h3 className="text-lg font-semibold">Historial reciente</h3>

          <div className="mt-4 space-y-3">
            {recentJobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                Aún no hay videos generados en esta sesión.
              </div>
            ) : (
              recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-3 text-sm text-slate-200">
                      {job.prompt}
                    </p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${getStatusColor(
                        job.status
                      )}`}
                    >
                      {job.status}
                    </span>
                  </div>

                  {job.output_url && (
                    <a
                      href={job.output_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      Ver resultado
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
