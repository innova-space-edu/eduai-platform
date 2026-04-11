"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type VideoMode = "text_to_video" | "image_to_video"
type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "blocked"
  | "canceled"

type CreateJobResponse = {
  ok: boolean
  jobId?: string
  status?: JobStatus
  deduplicated?: boolean
  plan?: string
  remainingToday?: number
  videoUrl?: string | null
  thumbnailUrl?: string | null
  error?: string
  code?: string
  limit?: number
  used?: number
}

type StatusResponse = {
  ok: boolean
  jobId: string
  status: JobStatus
  statusLabel?: string
  progress?: number
  plan?: string
  mode?: VideoMode
  prompt?: string
  style?: string
  duration?: number
  includeAudio?: boolean
  imageUrl?: string | null
  provider?: string | null
  model?: string | null
  videoUrl?: string | null
  thumbnailUrl?: string | null
  errorMessage?: string | null
  retryCount?: number
  startedAt?: string | null
  completedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  requestPayload?: Record<string, unknown> | null
  responsePayload?: Record<string, unknown> | null
  moderationPayload?: Record<string, unknown> | null
  error?: string
  code?: string
}

type UploadResponse = {
  ok: boolean
  url?: string
  error?: string
}

type RecentJob = {
  id: string
  prompt: string
  status: JobStatus
  videoUrl?: string | null
  thumbnailUrl?: string | null
  createdAt: string
}

const DEFAULT_DURATION = 6
const MAX_PROMPT_LENGTH = 2000

function statusColor(status: JobStatus | null) {
  switch (status) {
    case "queued":
      return "bg-amber-500"
    case "processing":
      return "bg-sky-500"
    case "completed":
      return "bg-emerald-500"
    case "failed":
    case "blocked":
    case "canceled":
      return "bg-rose-500"
    default:
      return "bg-slate-300"
  }
}

function statusText(status: JobStatus | null) {
  switch (status) {
    case "queued":
      return "En cola"
    case "processing":
      return "Procesando"
    case "completed":
      return "Completado"
    case "failed":
      return "Falló"
    case "blocked":
      return "Bloqueado"
    case "canceled":
      return "Cancelado"
    default:
      return "Sin estado"
  }
}

function normalizeDuration(value: number) {
  if (value < 2) return 2
  if (value > 10) return 10
  return Math.round(value)
}

export default function VideoStudioClient() {
  const [prompt, setPrompt] = useState("")
  const [style, setStyle] = useState("")
  const [mode, setMode] = useState<VideoMode>("text_to_video")
  const [duration, setDuration] = useState(DEFAULT_DURATION)
  const [withAudio, setWithAudio] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPolling, setIsPolling] = useState(false)

  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [progress, setProgress] = useState(0)
  const [plan, setPlan] = useState<string>("free")
  const [remainingToday, setRemainingToday] = useState<number | null>(null)

  const [provider, setProvider] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])

  const pollingRef = useRef<number | null>(null)
  const lastPolledJobIdRef = useRef<string | null>(null)

  const promptLength = prompt.length
  const canUseImageMode = mode === "image_to_video"

  const canSubmit = useMemo(() => {
    if (isSubmitting || isUploadingImage) return false
    if (prompt.trim().length < 8) return false
    if (canUseImageMode && !imageUrl) return false
    return true
  }, [isSubmitting, isUploadingImage, prompt, canUseImageMode, imageUrl])

  const clearMessages = useCallback(() => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [])

  const resetResultOnly = useCallback(() => {
    setJobId(null)
    setJobStatus(null)
    setProgress(0)
    setProvider(null)
    setModel(null)
    setVideoUrl(null)
    setThumbnailUrl(null)
  }, [])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setIsPolling(false)
  }, [])

  const updateRecentJob = useCallback((job: RecentJob) => {
    setRecentJobs((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== job.id)
      return [job, ...withoutCurrent].slice(0, 8)
    })
  }, [])

  useEffect(() => {
    return () => {
      stopPolling()
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview, stopPolling])

  const handleImageChange = async (file: File | null) => {
    clearMessages()

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setImageFile(file)
    setImageUrl(null)
    setImagePreview(file ? URL.createObjectURL(file) : null)

    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    try {
      setIsUploadingImage(true)

      const res = await fetch("/api/uploads/video-image", {
        method: "POST",
        body: formData,
      })

      const data = (await res.json()) as UploadResponse

      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error || "No se pudo subir la imagen.")
      }

      setImageUrl(data.url)
      setSuccessMessage("Imagen subida correctamente.")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Error al subir la imagen."
      setErrorMessage(message)
      setImageUrl(null)
    } finally {
      setIsUploadingImage(false)
    }
  }

  const pollJobStatus = useCallback(
    async (targetJobId: string) => {
      try {
        const res = await fetch(`/api/agents/video/status/${targetJobId}`, {
          method: "GET",
          cache: "no-store",
        })

        const data = (await res.json()) as StatusResponse

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "No se pudo consultar el estado del video.")
        }

        setJobId(data.jobId)
        setJobStatus(data.status)
        setProgress(data.progress ?? 0)
        setPlan(data.plan ?? "free")
        setProvider(data.provider ?? null)
        setModel(data.model ?? null)
        setVideoUrl(data.videoUrl ?? null)
        setThumbnailUrl(data.thumbnailUrl ?? null)
        setErrorMessage(data.errorMessage ?? null)

        updateRecentJob({
          id: data.jobId,
          prompt: data.prompt ?? "",
          status: data.status,
          videoUrl: data.videoUrl ?? null,
          thumbnailUrl: data.thumbnailUrl ?? null,
          createdAt: data.createdAt ?? new Date().toISOString(),
        })

        if (
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "blocked" ||
          data.status === "canceled"
        ) {
          stopPolling()

          if (data.status === "completed") {
            setSuccessMessage("Tu video ya está listo.")
          } else if (data.errorMessage) {
            setErrorMessage(data.errorMessage)
          }
        }
      } catch (error: unknown) {
        stopPolling()
        const message =
          error instanceof Error ? error.message : "Error al consultar el estado."
        setErrorMessage(message)
      }
    },
    [stopPolling, updateRecentJob]
  )

  const startPolling = useCallback(
    async (targetJobId: string) => {
      stopPolling()
      lastPolledJobIdRef.current = targetJobId
      setIsPolling(true)

      await pollJobStatus(targetJobId)

      pollingRef.current = window.setInterval(() => {
        void pollJobStatus(targetJobId)
      }, 3500)
    },
    [pollJobStatus, stopPolling]
  )

  const handleCreateJob = async () => {
    clearMessages()
    resetResultOnly()

    const cleanPrompt = prompt.trim()
    const cleanStyle = style.trim()

    if (cleanPrompt.length < 8) {
      setErrorMessage("El prompt debe tener al menos 8 caracteres.")
      return
    }

    if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
      setErrorMessage("El prompt es demasiado largo.")
      return
    }

    if (mode === "image_to_video" && !imageUrl) {
      setErrorMessage("Debes subir una imagen para usar imagen a video.")
      return
    }

    try {
      setIsSubmitting(true)

      const res = await fetch("/api/agents/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: cleanPrompt,
          style: cleanStyle,
          duration: normalizeDuration(duration),
          withAudio,
          mode,
          imageUrl,
        }),
      })

      const data = (await res.json()) as CreateJobResponse

      if (!res.ok || !data.ok || !data.jobId) {
        throw new Error(data.error || "No se pudo crear el job de video.")
      }

      setJobId(data.jobId)
      setJobStatus(data.status ?? "queued")
      setPlan(data.plan ?? "free")
      setRemainingToday(
        typeof data.remainingToday === "number" ? data.remainingToday : null
      )
      setProgress(data.status === "completed" ? 100 : data.status === "processing" ? 60 : 10)

      updateRecentJob({
        id: data.jobId,
        prompt: cleanPrompt,
        status: data.status ?? "queued",
        videoUrl: data.videoUrl ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        createdAt: new Date().toISOString(),
      })

      if (data.deduplicated && data.status === "completed" && data.videoUrl) {
        setVideoUrl(data.videoUrl)
        setThumbnailUrl(data.thumbnailUrl ?? null)
        setSuccessMessage("Se reutilizó un video reciente ya generado.")
        return
      }

      setSuccessMessage(
        data.deduplicated
          ? "Se reutilizó un job reciente. Consultando estado..."
          : "Video enviado a la cola correctamente."
      )

      await startPolling(data.jobId)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "No se pudo crear el video."
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReuseJob = async (selectedJobId: string) => {
    clearMessages()
    resetResultOnly()
    setJobId(selectedJobId)
    await startPolling(selectedJobId)
  }

  const handleResetForm = () => {
    clearMessages()
    stopPolling()
    resetResultOnly()

    setPrompt("")
    setStyle("")
    setMode("text_to_video")
    setDuration(DEFAULT_DURATION)
    setWithAudio(false)

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setImageFile(null)
    setImageUrl(null)
    setImagePreview(null)
  }

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-soft bg-card-theme p-6 shadow-2xl backdrop-blur">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-main">Video Studio</h2>
          <p className="text-sm text-sub">
            Genera videos con cola de trabajos. Modo actual: texto a video e imagen a video.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-main">
                Prompt principal
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ejemplo: Un laboratorio futurista en el espacio, con pantallas holográficas, cámara cinematográfica, luz azul suave..."
                rows={7}
                className="w-full rounded-2xl border border-medium bg-header-theme px-4 py-3 text-sm text-main outline-none transition focus:border-sky-500"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-sub">
                <span>Mínimo recomendado: 8 caracteres</span>
                <span>
                  {promptLength}/{MAX_PROMPT_LENGTH}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-main">
                Estilo opcional
              </label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="cinematográfico, educativo, futurista, realista..."
                className="w-full rounded-2xl border border-medium bg-header-theme px-4 py-3 text-sm text-main outline-none transition focus:border-sky-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-main">
                  Modo
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as VideoMode)}
                  className="w-full rounded-2xl border border-medium bg-header-theme px-4 py-3 text-sm text-main outline-none transition focus:border-sky-500"
                >
                  <option value="text_to_video">Texto a video</option>
                  <option value="image_to_video">Imagen a video</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-main">
                  Duración
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-2xl border border-medium bg-header-theme px-4 py-3 text-sm text-main outline-none transition focus:border-sky-500"
                >
                  {[2, 4, 6, 8, 10].map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} s
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex w-full items-center gap-3 rounded-2xl border border-medium bg-header-theme px-4 py-3 text-sm text-main">
                  <input
                    type="checkbox"
                    checked={withAudio}
                    onChange={(e) => setWithAudio(e.target.checked)}
                    className="h-4 w-4 rounded border-soft"
                  />
                  Incluir audio
                </label>
              </div>
            </div>

            {mode === "image_to_video" && (
              <div className="rounded-2xl border border-medium bg-app p-4">
                <label className="mb-3 block text-sm font-medium text-main">
                  Imagen base
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    void handleImageChange(file)
                  }}
                  className="block w-full text-sm text-sub file:mr-4 file:rounded-xl file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-main hover:file:bg-sky-500"
                />

                <div className="mt-3 space-y-2 text-xs text-sub">
                  <p>
                    Estado imagen:{" "}
                    {isUploadingImage
                      ? "subiendo..."
                      : imageUrl
                      ? "lista"
                      : imageFile
                      ? "pendiente"
                      : "sin imagen"}
                  </p>
                  {imageUrl && <p className="break-all">URL: {imageUrl}</p>}
                </div>

                {imagePreview && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-medium">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-72 w-full object-cover"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCreateJob}
                disabled={!canSubmit}
                className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-medium text-main transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Enviando..." : "Generar video"}
              </button>

              <button
                type="button"
                onClick={handleResetForm}
                className="rounded-2xl border border-medium px-5 py-3 text-sm font-medium text-main transition hover:bg-card-soft-theme"
              >
                Limpiar
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-medium bg-app p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-main">Estado del job</h3>
                <span className="text-xs text-sub">Plan: {plan}</span>
              </div>

              <div className="space-y-3 text-sm text-sub">
                <div className="flex items-center justify-between">
                  <span>Job ID</span>
                  <span className="max-w-[210px] truncate text-right text-main">
                    {jobId ?? "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Estado</span>
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusColor(jobStatus)}`} />
                    <span className="text-main">{statusText(jobStatus)}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Polling</span>
                  <span className="text-main">{isPolling ? "activo" : "inactivo"}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Proveedor</span>
                  <span className="text-main">{provider ?? "—"}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Modelo</span>
                  <span className="text-main">{model ?? "—"}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Disponibles hoy</span>
                  <span className="text-main">
                    {remainingToday !== null ? remainingToday : "—"}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs text-sub">
                  <span>Progreso</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-card-soft-theme">
                  <div
                    className={`h-full transition-all duration-500 ${statusColor(jobStatus)}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-medium bg-app p-4">
              <h3 className="mb-4 text-sm font-semibold text-main">Resultado</h3>

              {!videoUrl ? (
                <div className="rounded-2xl border border-dashed border-medium px-4 py-8 text-center text-sm text-sub">
                  Aún no hay video generado.
                </div>
              ) : (
                <div className="space-y-4">
                  {thumbnailUrl && (
                    <img
                      src={thumbnailUrl}
                      alt="Miniatura del video"
                      className="w-full rounded-2xl border border-medium object-cover"
                    />
                  )}

                  <video
                    src={videoUrl}
                    controls
                    className="w-full rounded-2xl border border-medium bg-black"
                  />

                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-main hover:bg-emerald-500"
                  >
                    Abrir video
                  </a>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-medium bg-app p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-main">Jobs recientes</h3>
                <span className="text-xs text-sub">{recentJobs.length} items</span>
              </div>

              {recentJobs.length === 0 ? (
                <p className="text-sm text-sub">Todavía no hay jobs en esta sesión.</p>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-medium bg-card-theme p-3"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-sm text-main">{job.prompt}</p>
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-sub">
                          <span className={`h-2.5 w-2.5 rounded-full ${statusColor(job.status)}`} />
                          {statusText(job.status)}
                        </span>
                      </div>

                      <div className="mb-3 text-xs text-sub">{job.id}</div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleReuseJob(job.id)}
                          className="rounded-xl border border-medium px-3 py-2 text-xs text-main hover:bg-card-soft-theme"
                        >
                          Ver estado
                        </button>

                        {job.videoUrl && (
                          <a
                            href={job.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-card-soft-theme px-3 py-2 text-xs text-main hover:bg-card-soft-theme"
                          >
                            Abrir video
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
