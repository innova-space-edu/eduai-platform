"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type VideoMode = "text_to_video" | "image_to_video"
type Resolution = "720p" | "1080p" | "4k"
type AspectRatio = "16:9" | "9:16"
type JobStatus = "queued" | "processing" | "completed" | "failed" | "blocked" | "canceled"

type Wallet = {
  balanceCredits: number
  reservedCredits: number
  availableCredits: number
  lifetimePurchasedCredits: number
  lifetimeSpentCredits: number
}

type VideoModel = {
  key: string
  name: string
  provider: "auto" | "google" | "fal"
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

type ModelsResponse = {
  ok: boolean
  wallet?: Wallet
  payments?: { enabled: boolean; configured: boolean }
  models?: VideoModel[]
  error?: string
}

type QuoteResponse = {
  ok: boolean
  modelKey?: string
  provider?: string
  billing?: string
  billingLabel?: string
  estimatedUsd?: number | null
  estimatedCredits?: number
  availableCredits?: number
  enoughCredits?: boolean
  error?: string
}

type CreateJobResponse = {
  ok: boolean
  jobId?: string
  status?: JobStatus
  deduplicated?: boolean
  reused?: boolean
  generationAvoided?: boolean
  plan?: string
  remainingToday?: number | null
  videoUrl?: string | null
  thumbnailUrl?: string | null
  provider?: string | null
  model?: string | null
  estimatedCredits?: number
  availableCredits?: number | null
  error?: string
  code?: string
}

type StatusResponse = {
  ok: boolean
  jobId: string
  status: JobStatus
  statusLabel?: string
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
  createdAt: string
}

type CreditOrder = {
  ok: boolean
  orderId: string
  amountClp: number
  credits: number
  netAmountClp: number
  vatAmountClp: number
  vatRate: number
  preferenceId?: string | null
  publicKey: string
  error?: string
}

type PaymentResult = {
  ok: boolean
  status?: string
  statusDetail?: string | null
  paymentId?: string
  wallet?: Wallet
  error?: string
}

type MercadoPagoBrick = { unmount?: () => Promise<void> | void }
type MercadoPagoConstructor = new (key: string, options?: Record<string, unknown>) => {
  bricks: () => {
    create: (type: string, containerId: string, settings: Record<string, unknown>) => Promise<MercadoPagoBrick>
  }
}

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor
  }
}

const MAX_PROMPT_LENGTH = 2000
const RECHARGE_AMOUNTS = [5000, 10000, 20000, 50000]

function formatCredits(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CL").format(Math.max(0, Math.round(Number(value || 0))))
}

function formatClp(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatUsd(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return `US$${value.toFixed(2)}`
}

function rechargeCreditsWithVat(amountClp: number) {
  return Math.round(amountClp / 1.19)
}

function paymentRejectionMessage(statusDetail?: string | null) {
  const code = (statusDetail || "").trim()
  const messages: Record<string, string> = {
    cc_rejected_other_reason: "Pago rechazado por Mercado Pago. En modo TEST usa una tarjeta de prueba, titular APRO y documento Otro 123456789.",
    cc_rejected_high_risk: "Pago rechazado por validación de riesgo de Mercado Pago.",
    cc_rejected_bad_filled_card_number: "Revisa el número de la tarjeta.",
    cc_rejected_bad_filled_date: "Revisa la fecha de vencimiento.",
    cc_rejected_bad_filled_security_code: "Revisa el código de seguridad.",
    cc_rejected_insufficient_amount: "La tarjeta no tiene saldo o cupo suficiente.",
    cc_rejected_duplicated_payment: "Mercado Pago detectó un pago duplicado. Espera antes de intentar otra vez.",
  }
  return messages[code] || (code ? `Pago rechazado por Mercado Pago (${code}).` : "El pago fue rechazado por Mercado Pago.")
}

function statusText(status: JobStatus | null) {
  const labels: Record<JobStatus, string> = {
    queued: "En cola",
    processing: "Procesando",
    completed: "Completado",
    failed: "Falló",
    blocked: "Bloqueado",
    canceled: "Cancelado",
  }
  return status ? labels[status] : "Sin estado"
}

function statusClass(status: JobStatus | null) {
  if (status === "completed") return "bg-emerald-500"
  if (status === "processing") return "bg-sky-500"
  if (status === "queued") return "bg-amber-500"
  if (status) return "bg-rose-500"
  return "bg-slate-300"
}

function loadMercadoPagoSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("Mercado Pago requiere navegador."))
  if (window.MercadoPago) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
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

function ModelCard({ model, selected, onSelect }: { model: VideoModel; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      disabled={!model.available}
      onClick={onSelect}
      className={`rounded-xl border p-3 text-left transition ${selected ? "border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/20" : "border-medium bg-card-theme hover:border-violet-300"} ${!model.available ? "cursor-not-allowed opacity-55" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-main">{model.name}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-sub">{model.description}</p>
        </div>
        {selected && <span className="shrink-0 rounded-full bg-violet-600 px-2 py-1 text-[9px] font-bold text-white">SELECCIONADO</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {model.badges.slice(0, 3).map((badge) => <span key={badge} className="rounded-full bg-card-soft-theme px-2 py-0.5 text-[9px] text-sub">{badge}</span>)}
        <span className="rounded-full bg-card-soft-theme px-2 py-0.5 text-[9px] text-sub">{model.durations.join("/")} s</span>
        <span className="rounded-full bg-card-soft-theme px-2 py-0.5 text-[9px] text-sub">{model.resolutions.map((item) => item.toUpperCase()).join("/")}</span>
      </div>
      {!model.available && model.unavailableReason && <p className="mt-2 line-clamp-2 text-[10px] font-medium text-rose-600">{model.unavailableReason}</p>}
    </button>
  )
}

function ModelGroup({
  badge,
  badgeClass,
  title,
  description,
  models,
  selectedModelKey,
  onSelect,
  defaultOpen = false,
}: {
  badge: string
  badgeClass: string
  title: string
  description?: string
  models: VideoModel[]
  selectedModelKey: string
  onSelect: (model: VideoModel) => void
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-medium bg-app px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${badgeClass}`}>{badge}</span>
            <h3 className="text-sm font-semibold text-main">{title}</h3>
            <span className="rounded-full bg-card-soft-theme px-2 py-0.5 text-[10px] text-sub">{models.length} {models.length === 1 ? "modelo" : "modelos"}</span>
          </div>
          {description && <p className="mt-1 line-clamp-1 text-[11px] text-sub">{description}</p>}
        </div>
        <span className="shrink-0 rounded-xl border border-medium bg-card-theme px-3 py-1.5 text-[11px] font-semibold text-violet-700 group-open:hidden">Ver modelos</span>
        <span className="hidden shrink-0 rounded-xl border border-medium bg-card-theme px-3 py-1.5 text-[11px] font-semibold text-violet-700 group-open:inline">Ocultar</span>
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {models.map((item) => <ModelCard key={item.key} model={item} selected={selectedModelKey === item.key} onSelect={() => onSelect(item)} />)}
      </div>
    </details>
  )
}

export default function VideoStudioClient() {
  const [models, setModels] = useState<VideoModel[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [paymentsConfigured, setPaymentsConfigured] = useState(false)
  const [loadingStudio, setLoadingStudio] = useState(true)

  const [selectedModelKey, setSelectedModelKey] = useState("free-auto")
  const [prompt, setPrompt] = useState("")
  const [style, setStyle] = useState("")
  const [mode, setMode] = useState<VideoMode>("text_to_video")
  const [duration, setDuration] = useState(6)
  const [resolution, setResolution] = useState<Resolution>("720p")
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9")
  const [withAudio, setWithAudio] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [progress, setProgress] = useState(0)
  const [provider, setProvider] = useState<string | null>(null)
  const [providerModel, setProviderModel] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [activeOrder, setActiveOrder] = useState<CreditOrder | null>(null)
  const [creatingOrder, setCreatingOrder] = useState<number | null>(null)
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const brickRef = useRef<MercadoPagoBrick | null>(null)
  const pollRef = useRef<number | null>(null)

  const selectedModel = useMemo(() => models.find((item) => item.key === selectedModelKey) || models[0] || null, [models, selectedModelKey])
  const freeModels = useMemo(() => models.filter((item) => item.provider === "auto"), [models])
  const googleModels = useMemo(() => models.filter((item) => item.provider === "google"), [models])
  const falModels = useMemo(() => models.filter((item) => item.provider === "fal"), [models])
  const paidSelected = selectedModel?.provider === "google" || selectedModel?.provider === "fal"

  const refreshStudio = useCallback(async () => {
    setLoadingStudio(true)
    try {
      const response = await fetch("/api/video/models", { cache: "no-store" })
      const body = await response.json().catch(() => null) as ModelsResponse | null
      if (!response.ok || !body?.ok) throw new Error(body?.error || "No se pudo cargar Video Studio.")
      setModels(body.models || [])
      setWallet(body.wallet || null)
      setPaymentsConfigured(Boolean(body.payments?.enabled && body.payments?.configured))
      if (!body.models?.some((item) => item.key === selectedModelKey)) setSelectedModelKey("free-auto")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar Video Studio.")
    } finally {
      setLoadingStudio(false)
    }
  }, [selectedModelKey])

  useEffect(() => { void refreshStudio() }, [refreshStudio])

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  useEffect(() => {
    if (!selectedModel) return
    if (!selectedModel.modes.includes(mode)) setMode(selectedModel.modes[0] || "text_to_video")
    if (!selectedModel.durations.includes(duration)) setDuration(selectedModel.durations[0] || 6)
    if (!selectedModel.resolutions.includes(resolution)) setResolution(selectedModel.resolutions[0] || "720p")
    if (selectedModel.audio === "included") setWithAudio(true)
  }, [selectedModel, mode, duration, resolution])

  useEffect(() => {
    if (!selectedModel?.available) {
      setQuote(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setQuoting(true)
      try {
        const response = await fetch("/api/video/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelKey: selectedModel.key, mode, duration, resolution, withAudio }),
        })
        const body = await response.json().catch(() => null) as QuoteResponse | null
        if (!cancelled) setQuote(body || { ok: false, error: "No se pudo calcular el costo." })
      } catch (error) {
        if (!cancelled) setQuote({ ok: false, error: error instanceof Error ? error.message : "No se pudo calcular el costo." })
      } finally {
        if (!cancelled) setQuoting(false)
      }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [selectedModel, mode, duration, resolution, withAudio])

  const selectModel = (model: VideoModel) => {
    setSelectedModelKey(model.key)
    setDuration(model.durations[0] || 6)
    setResolution(model.resolutions[0] || "720p")
    setWithAudio(model.audio === "included")
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const handleImageChange = async (file: File | null) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImageUrl(null)
    setImagePreview(file ? URL.createObjectURL(file) : null)
    if (!file) return

    setUploadingImage(true)
    setErrorMessage(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/uploads/video-image", { method: "POST", body: form })
      const body = await response.json().catch(() => null) as UploadResponse | null
      if (!response.ok || !body?.ok || !body.url) throw new Error(body?.error || "No se pudo subir la imagen.")
      setImageUrl(body.url)
      setSuccessMessage("Imagen base lista para generar.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo subir la imagen.")
    } finally {
      setUploadingImage(false)
    }
  }

  const stopPolling = () => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = null
  }

  const pollStatus = useCallback(async (targetJobId: string) => {
    const response = await fetch(`/api/agents/video/status/${encodeURIComponent(targetJobId)}`, { cache: "no-store" })
    const body = await response.json().catch(() => null) as StatusResponse | null
    if (!response.ok || !body?.ok) throw new Error(body?.error || "No se pudo consultar el video.")

    setJobStatus(body.status)
    setProgress(body.progress || 0)
    setProvider(body.provider || null)
    setProviderModel(body.model || null)
    setVideoUrl(body.videoUrl || null)
    if (body.errorMessage) setErrorMessage(body.errorMessage)
    setRecentJobs((previous) => [{ id: body.jobId, prompt: body.prompt || prompt, status: body.status, videoUrl: body.videoUrl, createdAt: body.createdAt || new Date().toISOString() }, ...previous.filter((job) => job.id !== body.jobId)].slice(0, 8))

    if (["completed", "failed", "blocked", "canceled"].includes(body.status)) {
      stopPolling()
      if (body.status === "completed") {
        setSuccessMessage("Tu video está listo y guardado en EduAI.")
        await refreshStudio()
      }
    }
  }, [prompt, refreshStudio])

  const startPolling = async (targetJobId: string) => {
    stopPolling()
    await pollStatus(targetJobId)
    pollRef.current = window.setInterval(() => { void pollStatus(targetJobId).catch((error) => { stopPolling(); setErrorMessage(error instanceof Error ? error.message : "Error consultando el video.") }) }, 4000)
  }

  const handleCreateJob = async () => {
    if (!selectedModel?.available) return
    const cleanPrompt = prompt.trim()
    if (cleanPrompt.length < 8) return setErrorMessage("El prompt debe tener al menos 8 caracteres.")
    if (cleanPrompt.length > MAX_PROMPT_LENGTH) return setErrorMessage("El prompt es demasiado largo.")
    if (mode === "image_to_video" && !imageUrl) return setErrorMessage("Debes subir una imagen para Imagen → Video.")
    if (paidSelected && quote?.ok && quote.enoughCredits === false) {
      setPaymentOpen(true)
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    setVideoUrl(null)
    setProgress(0)
    try {
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
      const body = await response.json().catch(() => null) as CreateJobResponse | null
      if (!response.ok || !body?.ok || !body.jobId) throw new Error(body?.error || "No se pudo iniciar el video.")
      setJobId(body.jobId)
      setJobStatus(body.status || "queued")
      setProvider(body.provider || null)
      if (body.videoUrl) setVideoUrl(body.videoUrl)
      if (body.deduplicated && body.status === "completed") {
        setSuccessMessage("Se reutilizó un video existente. No se generó ni cobró nuevamente.")
        await refreshStudio()
        return
      }
      setSuccessMessage(body.deduplicated ? "Se reutilizó un job en curso." : paidSelected ? `Generación iniciada. Reserva: ${formatCredits(body.estimatedCredits)} créditos.` : "Video enviado a generación gratuita.")
      await startPolling(body.jobId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el video.")
    } finally {
      setSubmitting(false)
    }
  }

  const createRecharge = async (amountClp: number) => {
    setCreatingOrder(amountClp)
    setPaymentError(null)
    setPaymentMessage(null)
    setActiveOrder(null)
    try {
      const response = await fetch("/api/credits/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountClp }),
      })
      const body = await response.json().catch(() => null) as CreditOrder | null
      if (!response.ok || !body?.ok || !body.orderId) throw new Error(body?.error || "No se pudo crear la recarga.")
      setActiveOrder(body)
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "No se pudo crear la recarga.")
    } finally {
      setCreatingOrder(null)
    }
  }

  const submitMercadoPagoPayment = useCallback(async (order: CreditOrder, formData: Record<string, unknown>) => {
    const response = await fetch("/api/credits/mercadopago/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.orderId, formData }),
    })
    const body = await response.json().catch(() => null) as PaymentResult | null
    if (!response.ok || !body?.ok) throw new Error(body?.error || "No se pudo procesar el pago.")
    if (body.status === "rejected") throw new Error(paymentRejectionMessage(body.statusDetail))
    if (body.status === "approved") {
      setPaymentMessage("Pago aprobado. Tus Créditos IA ya fueron acreditados.")
      if (body.wallet) setWallet(body.wallet)
      await refreshStudio()
      return
    }
    setPaymentMessage(`Pago recibido con estado ${body.status || "pendiente"}. EduAI lo conciliará cuando Mercado Pago lo confirme.`)
  }, [refreshStudio])

  useEffect(() => {
    if (!paymentOpen || !activeOrder) return
    let cancelled = false

    const mountBrick = async () => {
      try {
        await loadMercadoPagoSdk()
        if (cancelled || !window.MercadoPago) return
        await brickRef.current?.unmount?.()
        const mp = new window.MercadoPago(activeOrder.publicKey, { locale: "es-CL" })
        const builder = mp.bricks()
        const testMode = activeOrder.publicKey.startsWith("TEST-")
        brickRef.current = await builder.create("payment", "eduai-payment-brick", {
          initialization: {
            amount: activeOrder.amountClp,
            ...(activeOrder.preferenceId ? { preferenceId: activeOrder.preferenceId } : {}),
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              ...(activeOrder.preferenceId && !testMode ? { mercadoPago: "wallet_purchase" } : {}),
            },
          },
          callbacks: {
            onReady: () => undefined,
            onSubmit: async (payload: { formData?: Record<string, unknown> }) => {
              setPaymentError(null)
              setPaymentMessage("Procesando pago…")
              try { await submitMercadoPagoPayment(activeOrder, payload?.formData || {}) }
              catch (error) { setPaymentMessage(null); setPaymentError(error instanceof Error ? error.message : "No se pudo procesar el pago.") }
            },
            onError: (error: unknown) => setPaymentError(error instanceof Error ? error.message : "Mercado Pago informó un error."),
          },
        })
      } catch (error) {
        setPaymentError(error instanceof Error ? error.message : "No se pudo cargar Mercado Pago.")
      }
    }

    void mountBrick()
    return () => {
      cancelled = true
      void brickRef.current?.unmount?.()
      brickRef.current = null
    }
  }, [paymentOpen, activeOrder, submitMercadoPagoPayment])

  const resetForm = () => {
    stopPolling()
    setPrompt("")
    setStyle("")
    setMode("text_to_video")
    setSelectedModelKey("free-auto")
    setDuration(6)
    setResolution("720p")
    setAspectRatio("16:9")
    setWithAudio(false)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImageUrl(null)
    setImagePreview(null)
    setJobId(null)
    setJobStatus(null)
    setProgress(0)
    setProvider(null)
    setProviderModel(null)
    setVideoUrl(null)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  if (loadingStudio && !models.length) {
    return <div className="rounded-3xl border border-medium bg-card-theme p-8 text-sm text-sub">Cargando Video Studio…</div>
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-soft bg-card-theme p-5 shadow-xl md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">EduAI Video Studio</p>
            <h1 className="mt-1 text-2xl font-black text-main md:text-3xl">Crear videos con IA</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-sub">Reutilización primero. La ruta gratuita nunca salta a modelos de pago. Google Veo directo y fal.ai usan Créditos IA solo cuando los eliges explícitamente.</p>
          </div>
          <div className="min-w-[240px] rounded-2xl border border-violet-300/30 bg-violet-500/5 p-4">
            <div className="flex items-center justify-between gap-4"><span className="text-sm text-sub">Créditos disponibles</span><strong className="text-xl text-main">{formatCredits(wallet?.availableCredits)}</strong></div>
            {wallet && wallet.reservedCredits > 0 && <p className="mt-1 text-xs text-amber-600">{formatCredits(wallet.reservedCredits)} reservados en generaciones</p>}
            {wallet && <p className="mt-1 text-xs text-sub">Comprados: {formatCredits(wallet.lifetimePurchasedCredits)} · Gastados: {formatCredits(wallet.lifetimeSpentCredits)}</p>}
            <button type="button" onClick={() => setPaymentOpen(true)} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Agregar Créditos IA</button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-soft bg-card-theme p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-main">1. Elige cómo generar</h2>
            <p className="mt-1 text-xs text-sub">Abre solo el grupo que quieras ver. Los modelos quedan ocultos para reducir el scroll.</p>
          </div>
          {selectedModel && <div className="rounded-xl border border-violet-300/30 bg-violet-500/5 px-3 py-2 text-xs text-sub"><span className="font-semibold text-main">Seleccionado:</span> {selectedModel.name}</div>}
        </div>

        <div className="mt-4 space-y-2">
          <ModelGroup badge="GRATIS" badgeClass="bg-emerald-500/15 text-emerald-700" title="EduAI Auto" description="Reutilización primero y proveedores gratuitos/configurados. Nunca salta automáticamente a modelos de pago." models={freeModels} selectedModelKey={selectedModelKey} onSelect={selectModel} defaultOpen />
          <ModelGroup badge="GOOGLE · PAGO" badgeClass="bg-blue-500/15 text-blue-700" title="Veo 3.1 directo" description="Conexión directa con Google. Se cobra con Créditos IA y no pasa por fal.ai." models={googleModels} selectedModelKey={selectedModelKey} onSelect={selectModel} />
          <ModelGroup badge="FAL.AI · PAGO" badgeClass="bg-violet-500/15 text-violet-700" title="Modelos premium" description="Kling, Wan, LTX, Veo y Seedance mediante fal.ai." models={falModels} selectedModelKey={selectedModelKey} onSelect={selectModel} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-soft bg-card-theme p-5 md:p-7">
          <h2 className="text-lg font-bold text-main">2. Configura el video</h2>
          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-main">Prompt</label>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} maxLength={MAX_PROMPT_LENGTH} placeholder="Describe la escena, acción, cámara, iluminación, ambiente y resultado que quieres…" className="w-full rounded-2xl border border-medium bg-header-theme px-4 py-3 text-sm text-main outline-none focus:border-violet-500" />
              <div className="mt-1 flex justify-between text-xs text-sub"><span>Mínimo 8 caracteres</span><span>{prompt.length}/{MAX_PROMPT_LENGTH}</span></div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-main">Estilo opcional</label>
              <input value={style} onChange={(event) => setStyle(event.target.value)} placeholder="cinematográfico, documental, educativo, realista…" className="w-full rounded-2xl border border-medium bg-header-theme px-4 py-3 text-sm text-main outline-none focus:border-violet-500" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="mb-2 block text-xs font-medium text-sub">Modo</label><select value={mode} onChange={(event) => setMode(event.target.value as VideoMode)} className="w-full rounded-xl border border-medium bg-header-theme px-3 py-2.5 text-sm text-main"><option value="text_to_video">Texto → Video</option><option value="image_to_video">Imagen → Video</option></select></div>
              <div><label className="mb-2 block text-xs font-medium text-sub">Duración</label><select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="w-full rounded-xl border border-medium bg-header-theme px-3 py-2.5 text-sm text-main">{(selectedModel?.durations || [6]).map((seconds) => <option key={seconds} value={seconds}>{seconds} s</option>)}</select></div>
              <div><label className="mb-2 block text-xs font-medium text-sub">Resolución</label><select value={resolution} onChange={(event) => setResolution(event.target.value as Resolution)} className="w-full rounded-xl border border-medium bg-header-theme px-3 py-2.5 text-sm text-main">{(selectedModel?.resolutions || ["720p"]).map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></div>
              <div><label className="mb-2 block text-xs font-medium text-sub">Formato</label><select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)} className="w-full rounded-xl border border-medium bg-header-theme px-3 py-2.5 text-sm text-main"><option value="16:9">16:9 horizontal</option><option value="9:16">9:16 vertical</option></select></div>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-medium bg-app px-4 py-3 text-sm text-main"><input type="checkbox" checked={withAudio} disabled={selectedModel?.audio === "included"} onChange={(event) => setWithAudio(event.target.checked)} />{selectedModel?.audio === "included" ? "Audio nativo incluido por el modelo" : selectedModel?.audio === "auto" ? "Audio gestionado automáticamente por el modelo" : "Incluir audio cuando el modelo lo permita"}</label>

            {mode === "image_to_video" && (
              <div className="rounded-2xl border border-medium bg-app p-4">
                <label className="mb-2 block text-sm font-medium text-main">Imagen base</label>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleImageChange(event.target.files?.[0] || null)} className="block w-full text-sm text-sub" />
                <p className="mt-2 text-xs text-sub">{uploadingImage ? "Subiendo imagen…" : imageUrl ? "Imagen lista y protegida en Video Studio." : imageFile ? "Imagen pendiente." : "JPG, PNG o WEBP; máximo 10 MB."}</p>
                {imagePreview && <img src={imagePreview} alt="Vista previa" className="mt-3 max-h-72 w-full rounded-2xl object-contain" />}
              </div>
            )}

            <div className="rounded-2xl border border-medium bg-app p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-main">{selectedModel?.name || "Modelo"}</p>
                  {quoting ? <p className="mt-1 text-xs text-sub">Calculando costo…</p> : quote?.ok ? paidSelected ? <p className="mt-1 text-xs text-sub">Costo estimado proveedor: {formatUsd(quote.estimatedUsd)} · <strong className="text-main">{formatCredits(quote.estimatedCredits)} Créditos IA</strong></p> : <p className="mt-1 text-xs font-medium text-emerald-700">Ruta gratuita · 0 Créditos IA</p> : <p className="mt-1 text-xs text-rose-600">{quote?.error || "Costo no disponible."}</p>}
                </div>
                {paidSelected && quote?.ok && <span className={`rounded-full px-3 py-1 text-xs font-bold ${quote.enoughCredits ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{quote.enoughCredits ? "Saldo suficiente" : "Faltan créditos"}</span>}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {paidSelected && quote?.ok && quote.enoughCredits === false ? (
                <button type="button" onClick={() => setPaymentOpen(true)} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500">Agregar créditos para generar</button>
              ) : (
                <button type="button" disabled={submitting || uploadingImage || !selectedModel?.available} onClick={() => void handleCreateJob()} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Preparando generación…" : paidSelected ? "Generar con Créditos IA" : "Generar gratis"}</button>
              )}
              <button type="button" onClick={resetForm} className="rounded-2xl border border-medium px-5 py-3 text-sm font-medium text-main hover:bg-card-soft-theme">Limpiar</button>
            </div>

            {errorMessage && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}
            {successMessage && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-soft bg-card-theme p-5">
            <h2 className="font-bold text-main">Estado</h2>
            <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-sub">Job</span><span className="max-w-[240px] truncate text-main">{jobId || "—"}</span></div><div className="flex justify-between"><span className="text-sub">Estado</span><span className="inline-flex items-center gap-2 text-main"><span className={`h-2.5 w-2.5 rounded-full ${statusClass(jobStatus)}`} />{statusText(jobStatus)}</span></div><div className="flex justify-between"><span className="text-sub">Proveedor</span><span className="text-main">{provider || "—"}</span></div><div className="flex justify-between gap-3"><span className="text-sub">Modelo</span><span className="max-w-[240px] truncate text-main">{providerModel || "—"}</span></div></div>
            <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-sub"><span>Progreso</span><span>{progress}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-card-soft-theme"><div className={`h-full transition-all ${statusClass(jobStatus)}`} style={{ width: `${progress}%` }} /></div></div>
          </div>

          <div className="rounded-3xl border border-soft bg-card-theme p-5">
            <h2 className="font-bold text-main">Resultado</h2>
            {videoUrl ? <div className="mt-4 space-y-3"><video src={videoUrl} controls className="w-full rounded-2xl bg-black" /><a href={videoUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Abrir video</a></div> : <div className="mt-4 rounded-2xl border border-dashed border-medium px-4 py-10 text-center text-sm text-sub">Aquí aparecerá el video terminado.</div>}
          </div>

          <div className="rounded-3xl border border-soft bg-card-theme p-5">
            <div className="flex justify-between"><h2 className="font-bold text-main">Jobs recientes</h2><span className="text-xs text-sub">{recentJobs.length}</span></div>
            <div className="mt-3 space-y-2">{recentJobs.length ? recentJobs.map((job) => <button key={job.id} type="button" onClick={() => { setJobId(job.id); void startPolling(job.id) }} className="w-full rounded-2xl border border-medium p-3 text-left"><div className="flex justify-between gap-3"><p className="line-clamp-2 text-sm text-main">{job.prompt}</p><span className="whitespace-nowrap text-xs text-sub">{statusText(job.status)}</span></div></button>) : <p className="text-sm text-sub">Sin jobs en esta sesión.</p>}</div>
          </div>
        </div>
      </section>

      {paymentOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl md:p-7">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-slate-950">Agregar Créditos IA</h2><p className="mt-1 text-sm text-slate-600">Los montos incluyen IVA 19%. Los créditos se acreditan sobre el valor neto.</p></div><button type="button" onClick={() => { setPaymentOpen(false); setActiveOrder(null); setPaymentError(null); setPaymentMessage(null) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Cerrar</button></div>

            {!activeOrder ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {RECHARGE_AMOUNTS.map((amount) => <button key={amount} type="button" disabled={creatingOrder !== null || !paymentsConfigured} onClick={() => void createRecharge(amount)} className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-left transition hover:border-violet-400 disabled:opacity-50"><p className="text-xl font-black text-slate-950">{formatClp(amount)}</p><p className="mt-1 text-sm font-semibold text-violet-700">{formatCredits(rechargeCreditsWithVat(amount))} créditos</p><p className="mt-1 text-xs text-slate-500">IVA 19% incluido</p>{creatingOrder === amount && <p className="mt-2 text-xs text-violet-600">Preparando pago…</p>}</button>)}
              </div>
            ) : (
              <div className="mt-5">
                <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><div className="flex justify-between"><span>Total a pagar</span><strong>{formatClp(activeOrder.amountClp)}</strong></div><div className="mt-1 flex justify-between"><span>Valor neto</span><strong>{formatClp(activeOrder.netAmountClp)}</strong></div><div className="mt-1 flex justify-between"><span>IVA 19%</span><strong>{formatClp(activeOrder.vatAmountClp)}</strong></div><div className="mt-2 flex justify-between border-t border-slate-200 pt-2"><span>Créditos acreditados</span><strong>{formatCredits(activeOrder.credits)}</strong></div></div>
                {activeOrder.publicKey?.startsWith("TEST-") && <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-900"><strong>Modo TEST.</strong> No uses una tarjeta real. Aprobada: Visa 4168 8188 4444 7115 o Mastercard 5416 7526 0258 2580, vencimiento 11/30, CVV 123, titular APRO, documento Otro 123456789.</div>}
                <div id="eduai-payment-brick" />
              </div>
            )}

            {!paymentsConfigured && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Mercado Pago todavía no está completamente configurado en este entorno.</div>}
            {paymentMessage && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{paymentMessage}</div>}
            {paymentError && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{paymentError}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
