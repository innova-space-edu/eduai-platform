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
  provider?: string
  videoUrl?: string
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
  const [currentProvider, setCurrentProvider] = useState<string | null>(null)

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
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

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
    if
