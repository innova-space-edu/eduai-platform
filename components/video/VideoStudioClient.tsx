"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type VideoMode = "text_to_video" | "image_to_video"
type Resolution = "720p" | "1080p" | "4k"
type AspectRatio = "16:9" | "9:16"
type JobStatus = "queued" | "processing" | "completed" | "failed" | "blocked" | "canceled"

type StudioModel = {
  key: string
  name: string
  provider: "auto" | "fal"
  tier: "free" | "economy" | "balanced" | "premium"
  description: string
  badges: string[]
  modes: VideoMode[]
  durations: number[]
  resolutions: Resolution[]
  audio: "optional" | "included" | "auto"
  recommended?: boolean
  available: boolean
  unavailableReason?: string | null
}

type Wallet = {
  balanceCredits: number
  reservedCredits: number
  availableCredits: number
  lifetimePurchasedCredits: number
  lifetimeSpentCredits: number
}

type ModelsResponse = {
  ok: boolean
  wallet?: Wallet
  payments?: { enabled: boolean; configured: boolean }
  models?: StudioModel[]
  error?: string
}

type QuoteResponse = {
  ok: boolean
  billing?: "free" | "credits"
  estimatedUsd?: number
  estimatedCredits?: number
  availableCredits?: number
  enoughCredits?: boolean
  estimateOnly?: boolean
  error?: string
}

type CreateJobResponse = {
  ok: boolean
  jobId?: string
  status?: JobStatus
  deduplicated?: boolean
  plan?: string
  remainingToday?: number | null
  videoUrl?: string | null
  thumbnailUrl?: string | null
  error?: string
  code?: string
  limit?: number
  used?: number
  estimatedCredits?: number
  availableCredits?: number | null
  requiredCredits?: number
}

type StatusResponse = {
  ok: boolean
  jobId: string
  status: JobStatus
  progress?: number
  plan?: string
  prompt?: string
  provider?: string | null
  model?: string | null
  videoUrl?: string | null
  thumbnailUrl?: string | null
  errorMessage?: string | null
  createdAt?: string | null
  error?: string
}

type UploadResponse = { ok: boolean; url?: string; error?: string }

type RecentJob = {
  id: string
  prompt: string
  status: JobStatus
  videoUrl?: string | null
  thumbnailUrl?: string | null
  createdAt: string
}

type CreditOrderResponse = {
  ok: boolean
  orderId?: string
  amountClp?: number
  credits?: number
  preferenceId?: string | null
  publicKey?: string
  error?: string
}

type PaymentResponse = {
  ok: boolean
  status?: string
  statusDetail?: string | null
  paymentId?: string
  wallet?: Wallet
  error?: string
}

type BrickController = { unmount: () => void | Promise<void> }
type BrickSubmitPayload = {
  selectedPaymentMethod?: string
  formData?: Record<string, unknown>
}
type BricksBuilder = {
  create: (
    type: "payment",
    containerId: string,
    settings: Record<string, unknown>
  ) => Promise<BrickController>
}
type MercadoPagoInstance = { bricks: () => BricksBuilder }
type MercadoPagoConstructor = new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor
  }
}

const DEFAULT_DURATION = 6
const MAX_PROMPT_LENGTH = 2000
const CREDIT_PACKS = [5000, 10000, 20000, 50000]

function formatCredits(value: number | null | undefined) {
  return Math.max(0, Math.round(Number(value || 0))).toLocaleString("es-CL")
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

function statusColor(status: JobStatus | null) {
  if (status === "queued") return "bg-amber-500"
  if (status === "processing") return "bg-sky-500"
  if (status === "completed") return "bg-emerald-500"
  if (["failed", "blocked", "canceled"].includes(status || "")) return "bg-rose-500"
  return "bg-slate-300"
}

function statusText(status: JobStatus | null) {
  const labels: Partial<Record<JobStatus, string>> = {
    queued: "En cola",
    processing: "Procesando",
    completed: "Completado",
    failed: "Falló",
    blocked: "Bloqueado",
    canceled: "Cancelado",
  }
  return status ? labels[status] || status : "Sin estado"
}

function tierLabel(tier: StudioModel["tier"]) {
  if (tier === "free") return "Gratis"
  if (tier === "economy") return "Económico"
  if (tier === "balanced") return "Equilibrado"
  return "Premium"
}

function loadMercadoPagoSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) {
      resolve()
      return
    }
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://sdk.mercadopago.com/js/v2"]')
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Mercado Pago.")), { once: true })
      return
    }
    const script = document.createElement("script")
    script.src = "https://sdk.mercadopago.com/js/v2"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("No se pudo cargar Mercado Pago."))
    document.head.appendChild(script)
  })
}

export default function VideoStudioClient() {
  const [prompt, setPrompt] = useState("")
  const [style, setStyle] = useState("")
  const [mode, setMode] = useState<VideoMode>("text_to_video")
  const [duration, setDuration] = useState(DEFAULT_DURATION)
  const [withAudio, setWithAudio] = useState(false)
  const [resolution, setResolution] = useState<Resolution>("720p")
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9")
  const [modelKey, setModelKey] = useState("free-auto")

  const [models, setModels] = useState<StudioModel[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [payments, setPayments] = useState({ enabled: false, configured: false })
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPolling, setIsPolling] = useState(false)

  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [progress, setProgress] = useState(0)
  const [plan, setPlan] = useState("free")
  const [remainingToday, setRemainingToday] = useState<number | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [selectedPack, setSelectedPack] = useState(10000)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<CreditOrderResponse | null>(null)

  const pollingRef = useRef<number | null>(null)
  const brickControllerRef = useRef<BrickController | null>(null)

  const selectedModel = useMemo(
    () => models.find((item) => item.key === modelKey) || models[0] || null,
    [models, modelKey]
  )
  const premiumSelected = selectedModel?.provider === "fal"
  const promptLength = prompt.length

  const clearMessages = useCallback(() => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [])

  const refreshCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/video/models", { cache: "no-store" })
      const data = (await response.json()) as ModelsResponse
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo cargar Video Studio.")
      setModels(data.models || [])
      setWallet(data.wallet || null)
      setPayments(data.payments || { enabled: false, configured: false })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar Video Studio.")
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshCatalog()
  }, [refreshCatalog])

  useEffect(() => {
    if (!selectedModel) return
    if (!selectedModel.modes.includes(mode)) setMode(selectedModel.modes[0] || "text_to_video")
    if (!selectedModel.durations.includes(duration)) setDuration(selectedModel.durations[0] || DEFAULT_DURATION)
    if (!selectedModel.resolutions.includes(resolution)) setResolution(selectedModel.resolutions[0] || "720p")
    if (selectedModel.audio === "included") setWithAudio(true)
  }, [selectedModel, mode, duration, resolution])

  useEffect(() => {
    if (!selectedModel) return
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setQuoteLoading(true)
      try {
        const response = await fetch("/api/video/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelKey: selectedModel.key, mode, duration, resolution, withAudio }),
          signal: controller.signal,
        })
        const data = (await response.json()) as QuoteResponse
        if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo calcular el costo.")
        setQuote(data)
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          setQuote({ ok: false, error: error instanceof Error ? error.message : "No se pudo calcular el costo." })
        }
      } finally {
        setQuoteLoading(false)
      }
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [selectedModel, mode, duration, resolution, withAudio])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setIsPolling(false)
  }, [])

  useEffect(() => {
    return () => {
      stopPolling()
      if (imagePreview) URL.revokeObjectURL(imagePreview)
      const controller = brickControllerRef.current
      if (controller) void controller.unmount()
    }
  }, [imagePreview, stopPolling])

  const updateRecentJob = useCallback((job: RecentJob) => {
    setRecentJobs((previous) => [job, ...previous.filter((item) => item.id !== job.id)].slice(0, 8))
  }, [])

  const handleImageChange = async (file: File | null) => {
    clearMessages()
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImageUrl(null)
    setImagePreview(file ? URL.createObjectURL(file) : null)
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)
    try {
      setIsUploadingImage(true)
      const response = await fetch("/api/uploads/video-image", { method: "POST", body: formData })
      const data = (await response.json()) as UploadResponse
      if (!response.ok || !data.ok || !data.url) throw new Error(data.error || "No se pudo subir la imagen.")
      setImageUrl(data.url)
      setSuccessMessage("Imagen lista para animar.")
    } catch (error) {
      setImageUrl(null)
      setErrorMessage(error instanceof Error ? error.message : "Error al subir la imagen.")
    } finally {
      setIsUploadingImage(false)
    }
  }

  const pollJobStatus = useCallback(async (targetJobId: string) => {
    try {
      const response = await fetch(`/api/agents/video/status/${targetJobId}`, { cache: "no-store" })
      const data = (await response.json()) as StatusResponse
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo consultar el video.")

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

      if (["completed", "failed", "blocked", "canceled"].includes(data.status)) {
        stopPolling()
        await refreshCatalog()
        if (data.status === "completed") setSuccessMessage("Tu video ya está listo y guardado en Recursos IA.")
        else if (data.errorMessage) setErrorMessage(data.errorMessage)
      }
    } catch (error) {
      stopPolling()
      setErrorMessage(error instanceof Error ? error.message : "Error al consultar el estado.")
    }
  }, [refreshCatalog, stopPolling, updateRecentJob])

  const startPolling = useCallback(async (targetJobId: string) => {
    stopPolling()
    setIsPolling(true)
    await pollJobStatus(targetJobId)
    pollingRef.current = window.setInterval(() => void pollJobStatus(targetJobId), 4000)
  }, [pollJobStatus, stopPolling])

  const canSubmit = useMemo(() => {
    if (!selectedModel?.available || isSubmitting || isUploadingImage || prompt.trim().length < 8) return false
    if (mode === "image_to_video" && !imageUrl) return false
    if (premiumSelected && quote?.ok && quote.enoughCredits === false) return false
    if (premiumSelected && (!quote?.ok || quoteLoading)) return false
    return true
  }, [selectedModel, isSubmitting, isUploadingImage, prompt, mode, imageUrl, premiumSelected, quote, quoteLoading])

  const handleCreateJob = async () => {
    clearMessages()
    if (!selectedModel) return
    const cleanPrompt = prompt.trim()
    if (cleanPrompt.length < 8 || cleanPrompt.length > MAX_PROMPT_LENGTH) {
      setErrorMessage("El prompt debe tener entre 8 y 2.000 caracteres.")
      return
    }
    if (mode === "image_to_video" && !imageUrl) {
      setErrorMessage("Debes subir una imagen antes de generar.")
      return
    }

    try {
      setIsSubmitting(true)
      setJobId(null)
      setJobStatus(null)
      setProgress(0)
      setVideoUrl(null)
      setThumbnailUrl(null)

      const response = await fetch("/api/agents/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelKey: selectedModel.key,
          prompt: cleanPrompt,
          style: style.trim(),
          duration,
          withAudio,
          mode,
          imageUrl,
          aspectRatio,
          resolution,
        }),
      })
      const data = (await response.json()) as CreateJobResponse
      if (!response.ok || !data.ok || !data.jobId) {
        if (data.code === "INSUFFICIENT_CREDITS") setPaymentOpen(true)
        throw new Error(data.error || "No se pudo iniciar el video.")
      }

      setJobId(data.jobId)
      setJobStatus(data.status ?? "queued")
      setPlan(data.plan ?? "free")
      setRemainingToday(typeof data.remainingToday === "number" ? data.remainingToday : null)
      if (typeof data.availableCredits === "number" && wallet) {
        setWallet({ ...wallet, availableCredits: data.availableCredits })
      }
      setProgress(data.status === "completed" ? 100 : data.status === "processing" ? 60 : 10)
      updateRecentJob({ id: data.jobId, prompt: cleanPrompt, status: data.status ?? "queued", videoUrl: data.videoUrl, thumbnailUrl: data.thumbnailUrl, createdAt: new Date().toISOString() })

      if (data.deduplicated && data.status === "completed" && data.videoUrl) {
        setVideoUrl(data.videoUrl)
        setThumbnailUrl(data.thumbnailUrl ?? null)
        setSuccessMessage("Reutilizamos un video equivalente ya generado: no consumiste créditos nuevamente.")
        await refreshCatalog()
        return
      }

      setSuccessMessage(data.deduplicated ? "Retomamos una generación equivalente." : "Generación enviada a la cola.")
      await startPolling(data.jobId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el video.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const destroyBrick = useCallback(async () => {
    if (brickControllerRef.current) {
      try { await brickControllerRef.current.unmount() } catch { /* noop */ }
      brickControllerRef.current = null
    }
  }, [])

  const closePayment = useCallback(async () => {
    await destroyBrick()
    setPaymentOpen(false)
    setActiveOrder(null)
    setPaymentMessage(null)
  }, [destroyBrick])

  const handleBrickPayment = useCallback(async (order: CreditOrderResponse, payload: BrickSubmitPayload) => {
    const selected = payload.selectedPaymentMethod || ""
    if (selected.toLowerCase().includes("mercadopago")) {
      setPaymentMessage("Continúa con tu Cuenta Mercado Pago en la ventana segura.")
      return
    }

    const response = await fetch("/api/credits/mercadopago/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.orderId, formData: payload.formData || {} }),
    })
    const data = (await response.json()) as PaymentResponse
    if (!response.ok || !data.ok) throw new Error(data.error || "Mercado Pago rechazó la operación.")

    if (data.status === "approved") {
      setPaymentMessage("Pago aprobado. Tus créditos ya están disponibles.")
      if (data.wallet) setWallet(data.wallet)
      await refreshCatalog()
      window.setTimeout(() => void closePayment(), 900)
      return
    }
    if (data.status === "rejected") throw new Error(data.statusDetail || "El pago fue rechazado.")
    setPaymentMessage("Pago recibido. Estamos esperando la confirmación de Mercado Pago.")
  }, [closePayment, refreshCatalog])

  const createCreditOrder = async () => {
    await destroyBrick()
    setPaymentLoading(true)
    setPaymentMessage(null)
    try {
      const response = await fetch("/api/credits/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountClp: selectedPack }),
      })
      const order = (await response.json()) as CreditOrderResponse
      if (!response.ok || !order.ok || !order.orderId || !order.publicKey) throw new Error(order.error || "No se pudo iniciar la recarga.")
      setActiveOrder(order)

      await loadMercadoPagoSdk()
      if (!window.MercadoPago) throw new Error("El SDK de Mercado Pago no está disponible.")
      const mp = new window.MercadoPago(order.publicKey, { locale: "es-CL" })
      const builder = mp.bricks()
      const settings: Record<string, unknown> = {
        initialization: {
          amount: order.amountClp,
          ...(order.preferenceId ? { preferenceId: order.preferenceId } : {}),
        },
        customization: {
          visual: { style: { theme: "default" } },
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
            prepaidCard: "all",
            ...(order.preferenceId ? { mercadoPago: "all" } : {}),
            maxInstallments: 1,
          },
        },
        callbacks: {
          onReady: () => setPaymentMessage(null),
          onSubmit: (payload: BrickSubmitPayload) => new Promise<void>((resolve, reject) => {
            void handleBrickPayment(order, payload).then(resolve).catch((error) => {
              setPaymentMessage(error instanceof Error ? error.message : "No se pudo procesar el pago.")
              reject(error)
            })
          }),
          onError: (error: unknown) => setPaymentMessage(error instanceof Error ? error.message : "Mercado Pago informó un error."),
        },
      }
      brickControllerRef.current = await builder.create("payment", "paymentBrick_container", settings)
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : "No se pudo preparar Mercado Pago.")
    } finally {
      setPaymentLoading(false)
    }
  }

  const resetForm = () => {
    clearMessages()
    stopPolling()
    setPrompt("")
    setStyle("")
    setMode("text_to_video")
    setDuration(DEFAULT_DURATION)
    setWithAudio(false)
    setResolution("720p")
    setAspectRatio("16:9")
    setModelKey("free-auto")
    setJobId(null)
    setJobStatus(null)
    setProgress(0)
    setProvider(null)
    setModel(null)
    setVideoUrl(null)
    setThumbnailUrl(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImageUrl(null)
    setImagePreview(null)
  }

  return (
    <div className="w-full space-y-6">
      <section className="overflow-hidden rounded-3xl border border-soft bg-card-theme shadow-2xl backdrop-blur">
        <div className="border-b border-soft p-5 sm:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600">VIDEO STUDIO</span>
                <span className="rounded-full border border-soft px-3 py-1 text-xs text-sub">Reutilización inteligente</span>
              </div>
              <h1 className="text-2xl font-bold text-main sm:text-3xl">Crea videos con el modelo que prefieras</h1>
              <p className="mt-2 max-w-3xl text-sm text-sub">Usa EduAI Auto sin costo adicional o modelos premium con Créditos IA. Las claves de los proveedores permanecen protegidas en el servidor.</p>
            </div>

            <div className="min-w-[280px] rounded-2xl border border-medium bg-app p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-sub">Saldo disponible</p>
                  <p className="mt-1 text-2xl font-bold text-main">{catalogLoading ? "…" : formatCredits(wallet?.availableCredits)} <span className="text-sm font-medium text-sub">créditos</span></p>
                  {wallet && wallet.reservedCredits > 0 && <p className="mt-1 text-xs text-amber-600">{formatCredits(wallet.reservedCredits)} reservados en generaciones</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentOpen(true)}
                  disabled={!payments.enabled || !payments.configured}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Agregar créditos
                </button>
              </div>
              {!payments.configured && !catalogLoading && <p className="mt-2 text-xs text-amber-600">Mercado Pago está pendiente de configuración en este entorno.</p>}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="mb-6">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-main">1. Elige un modelo</h2>
                <p className="text-sm text-sub">Las opciones no disponibles permanecen visibles para que puedas conocer el catálogo.</p>
              </div>
              {quoteLoading && <span className="text-xs text-sub">Actualizando costo…</span>}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {models.map((item) => {
                const selected = item.key === modelKey
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => item.available && setModelKey(item.key)}
                    disabled={!item.available}
                    className={`relative rounded-2xl border p-4 text-left transition ${selected ? "border-violet-500 bg-violet-500/5 ring-1 ring-violet-500/20" : "border-medium bg-app hover:border-violet-400/60"} disabled:cursor-not-allowed disabled:opacity-55`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-main">{item.name}</p>
                        <p className="mt-1 text-xs font-medium text-violet-600">{tierLabel(item.tier)}</p>
                      </div>
                      {item.recommended && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700">Recomendado</span>}
                    </div>
                    <p className="min-h-10 text-xs leading-5 text-sub">{item.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.badges.map((badge) => <span key={badge} className="rounded-lg border border-soft px-2 py-1 text-[11px] text-sub">{badge}</span>)}
                    </div>
                    {!item.available && item.unavailableReason && <p className="mt-3 text-xs text-amber-600">{item.unavailableReason}</p>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold text-main">2. Describe tu video</label>
                  <span className="text-xs text-sub">{promptLength}/{MAX_PROMPT_LENGTH}</span>
                </div>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={7}
                  maxLength={MAX_PROMPT_LENGTH}
                  placeholder="Ejemplo: Un laboratorio espacial futurista, cámara cinematográfica avanzando lentamente, luces volumétricas, científicos observando un plasma luminoso…"
                  className="w-full rounded-2xl border border-medium bg-header-theme px-4 py-3 text-sm text-main outline-none transition focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-main">Estilo visual opcional</label>
                <input
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                  placeholder="cinematográfico, documental, educativo, realista…"
                  className="w-full rounded-2xl border border-medium bg-header-theme px-4 py-3 text-sm text-main outline-none transition focus:border-violet-500"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-2 text-sm text-main">
                  <span className="font-medium">Modo</span>
                  <select value={mode} onChange={(event) => setMode(event.target.value as VideoMode)} className="w-full rounded-xl border border-medium bg-header-theme px-3 py-2.5">
                    {(selectedModel?.modes || ["text_to_video", "image_to_video"]).map((value) => <option key={value} value={value}>{value === "text_to_video" ? "Texto → video" : "Imagen → video"}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-main">
                  <span className="font-medium">Duración</span>
                  <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="w-full rounded-xl border border-medium bg-header-theme px-3 py-2.5">
                    {(selectedModel?.durations || [2, 4, 6, 8, 10]).map((value) => <option key={value} value={value}>{value} s</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-main">
                  <span className="font-medium">Resolución</span>
                  <select value={resolution} onChange={(event) => setResolution(event.target.value as Resolution)} className="w-full rounded-xl border border-medium bg-header-theme px-3 py-2.5">
                    {(selectedModel?.resolutions || ["720p"]).map((value) => <option key={value} value={value}>{value === "4k" ? "4K" : value}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-main">
                  <span className="font-medium">Formato</span>
                  <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)} className="w-full rounded-xl border border-medium bg-header-theme px-3 py-2.5">
                    <option value="16:9">16:9 Horizontal</option>
                    <option value="9:16">9:16 Vertical</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-medium bg-app px-4 py-3 text-sm text-main">
                <input
                  type="checkbox"
                  checked={withAudio}
                  disabled={selectedModel?.audio === "included"}
                  onChange={(event) => setWithAudio(event.target.checked)}
                  className="h-4 w-4"
                />
                <span><strong>Audio</strong> · {selectedModel?.audio === "included" ? "incluido por el modelo" : selectedModel?.audio === "auto" ? "el modelo puede generar música automáticamente" : "activar cuando el modelo lo permita"}</span>
              </label>

              {mode === "image_to_video" && (
                <div className="rounded-2xl border border-medium bg-app p-4">
                  <label className="mb-3 block text-sm font-semibold text-main">Imagen base</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleImageChange(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-sub file:mr-4 file:rounded-xl file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-white"
                  />
                  <p className="mt-2 text-xs text-sub">{isUploadingImage ? "Subiendo imagen…" : imageUrl ? "Imagen preparada." : "PNG, JPG o WebP."}</p>
                  {imagePreview && <img src={imagePreview} alt="Vista previa" className="mt-4 max-h-80 w-full rounded-2xl border border-medium object-contain" />}
                </div>
              )}

              {errorMessage && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}
              {successMessage && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>}

              <div className="flex flex-wrap gap-3">
                {premiumSelected && quote?.ok && quote.enoughCredits === false ? (
                  <button type="button" onClick={() => setPaymentOpen(true)} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500">Agregar créditos para generar</button>
                ) : (
                  <button type="button" onClick={() => void handleCreateJob()} disabled={!canSubmit} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSubmitting ? "Preparando generación…" : premiumSelected ? "Generar con Créditos IA" : "Generar video"}
                  </button>
                )}
                <button type="button" onClick={resetForm} className="rounded-2xl border border-medium px-5 py-3 text-sm font-medium text-main hover:bg-card-soft-theme">Limpiar</button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-medium bg-app p-5">
                <h3 className="font-semibold text-main">Resumen antes de generar</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-sub">Modelo</span><span className="text-right font-medium text-main">{selectedModel?.name || "—"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-sub">Configuración</span><span className="text-right text-main">{duration}s · {resolution === "4k" ? "4K" : resolution} · {aspectRatio}</span></div>
                  <div className="border-t border-soft pt-3">
                    {quoteLoading ? <p className="text-sub">Calculando costo…</p> : quote?.ok && quote.billing === "credits" ? (
                      <>
                        <div className="flex justify-between gap-3"><span className="text-sub">Costo estimado</span><span className="text-lg font-bold text-violet-600">{formatCredits(quote.estimatedCredits)} créditos</span></div>
                        <div className="mt-2 flex justify-between gap-3 text-xs"><span className="text-sub">Saldo disponible</span><span className="text-main">{formatCredits(quote.availableCredits)}</span></div>
                        <div className="mt-1 flex justify-between gap-3 text-xs"><span className="text-sub">Saldo estimado después</span><span className="text-main">{formatCredits(Math.max(0, Number(quote.availableCredits || 0) - Number(quote.estimatedCredits || 0)))}</span></div>
                        <p className="mt-3 text-[11px] leading-4 text-sub">Estimación previa. EduAI reserva el monto antes de enviar la generación y libera la reserva si la generación falla antes de consumirse.</p>
                      </>
                    ) : quote?.ok ? (
                      <div className="flex justify-between"><span className="text-sub">Costo</span><span className="font-semibold text-emerald-700">Sin Créditos IA</span></div>
                    ) : <p className="text-xs text-amber-600">{quote?.error || "Selecciona una configuración válida."}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-medium bg-app p-5">
                <div className="flex items-center justify-between"><h3 className="font-semibold text-main">Estado de generación</h3><span className="text-xs text-sub">{plan === "credits" ? "Créditos IA" : `Plan ${plan}`}</span></div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-sub">Estado</span><span className="inline-flex items-center gap-2 text-main"><span className={`h-2.5 w-2.5 rounded-full ${statusColor(jobStatus)}`} />{statusText(jobStatus)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-sub">Job</span><span className="max-w-[220px] truncate text-main">{jobId || "—"}</span></div>
                  {provider && <div className="flex justify-between gap-3"><span className="text-sub">Motor</span><span className="text-main">{provider === "fal" ? "EduAI Premium" : "EduAI Auto"}</span></div>}
                  {model && <div className="flex justify-between gap-3"><span className="text-sub">Modelo ejecutado</span><span className="max-w-[220px] truncate text-main">{selectedModel?.name || model}</span></div>}
                  {remainingToday !== null && plan !== "credits" && <div className="flex justify-between gap-3"><span className="text-sub">Disponibles hoy</span><span className="text-main">{remainingToday}</span></div>}
                </div>
                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-xs text-sub"><span>Progreso</span><span>{progress}%</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-card-soft-theme"><div className={`h-full transition-all duration-500 ${statusColor(jobStatus)}`} style={{ width: `${progress}%` }} /></div>
                </div>
              </div>

              <div className="rounded-2xl border border-medium bg-app p-5">
                <h3 className="mb-4 font-semibold text-main">Resultado</h3>
                {!videoUrl ? <div className="rounded-2xl border border-dashed border-medium px-4 py-10 text-center text-sm text-sub">Tu video aparecerá aquí y quedará guardado en Recursos IA.</div> : (
                  <div className="space-y-3">
                    {thumbnailUrl && <img src={thumbnailUrl} alt="Miniatura" className="w-full rounded-xl border border-medium" />}
                    <video src={videoUrl} controls className="w-full rounded-xl border border-medium bg-black" />
                    <a href={videoUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Abrir video</a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {recentJobs.length > 0 && (
            <div className="mt-7 border-t border-soft pt-6">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-main">Generaciones recientes de esta sesión</h2><span className="text-xs text-sub">{recentJobs.length}</span></div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {recentJobs.map((job) => (
                  <button key={job.id} type="button" onClick={() => void startPolling(job.id)} className="rounded-2xl border border-medium bg-app p-3 text-left hover:border-violet-400/60">
                    <div className="mb-2 flex items-center justify-between gap-2"><span className="line-clamp-1 text-sm font-medium text-main">{job.prompt || "Video EduAI"}</span><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor(job.status)}`} /></div>
                    <p className="truncate text-xs text-sub">{statusText(job.status)} · {job.id}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {paymentOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Agregar Créditos IA">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Créditos IA EduAI</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">Agregar créditos</h2>
                <p className="mt-1 text-sm text-slate-600">Paga de forma segura con Mercado Pago. EduAI no almacena los datos de tu tarjeta.</p>
              </div>
              <button type="button" onClick={() => void closePayment()} className="rounded-full border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50" aria-label="Cerrar">✕</button>
            </div>

            {!activeOrder && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {CREDIT_PACKS.map((amount) => (
                    <button key={amount} type="button" onClick={() => setSelectedPack(amount)} className={`rounded-2xl border p-4 text-left ${selectedPack === amount ? "border-violet-600 bg-violet-50 ring-1 ring-violet-600" : "border-slate-200"}`}>
                      <p className="text-xs text-slate-500">Recarga</p>
                      <p className="mt-1 font-bold text-slate-950">{formatClp(amount)}</p>
                      <p className="mt-1 text-xs text-violet-700">≈ {formatCredits(amount)} créditos</p>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => void createCreditOrder()} disabled={paymentLoading || !payments.configured} className="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
                  {paymentLoading ? "Preparando pago seguro…" : `Continuar con ${formatClp(selectedPack)}`}
                </button>
              </>
            )}

            {activeOrder && (
              <div>
                <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex justify-between"><span>Recarga</span><strong>{formatClp(Number(activeOrder.amountClp || 0))}</strong></div>
                  <div className="mt-1 flex justify-between"><span>Créditos IA</span><strong>{formatCredits(activeOrder.credits)}</strong></div>
                </div>
                <div id="paymentBrick_container" className="min-h-56" />
                <button type="button" onClick={() => { void destroyBrick().then(() => setActiveOrder(null)) }} className="mt-3 text-sm font-medium text-violet-700">← Elegir otro monto</button>
              </div>
            )}

            {paymentMessage && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{paymentMessage}</div>}
            <p className="mt-5 text-xs leading-5 text-slate-500">Los Créditos IA son unidades de consumo dentro de EduAI. No son dinero retirable ni transferible. El saldo se acredita únicamente después de verificar el pago con Mercado Pago.</p>
          </div>
        </div>
      )}
    </div>
  )
}
