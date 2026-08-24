"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, CircleDollarSign, ExternalLink, KeyRound, Loader2, RefreshCw, ShieldCheck, Sparkles, Trash2, X } from "lucide-react"

type ProviderId = "fal" | "huggingface" | "replicate"
type VideoMode = "text_to_video" | "image_to_video"

type Credential = {
  id: string
  provider: ProviderId
  label: string | null
  last4: string | null
  enabled: boolean
  maxRequestUsd: number | null
  dailyBudgetUsd: number | null
  testStatus: "untested" | "healthy" | "invalid" | "error" | null
  testMessage: string | null
  testedAt: string | null
}

type ProviderDescriptor = {
  id: ProviderId
  label: string
  shortLabel: string
  description: string
  recommended?: boolean
  beta?: boolean
  signupUrl: string
  keyUrl: string
  billingUrl: string
  docsUrl: string
  capabilities: string[]
  connected: boolean
  credential: Credential | null
}

type MarketplaceModel = {
  provider: ProviderId
  id: string
  label: string
  description?: string | null
  category?: string | null
  thumbnailUrl?: string | null
  modelUrl?: string | null
  pricing?: {
    unitPrice: number
    unit: string
    currency: string
    estimatedCostUsd?: number | null
  } | null
  compatible: boolean
  compatibilityNote?: string | null
}

type PersonalJob = {
  jobId: string
  status: string
  provider?: string | null
  model?: string | null
  estimatedCostUsd?: number | null
  videoUrl?: string | null
  errorMessage?: string | null
  progress?: number
  reused?: boolean
  generationAvoided?: boolean
}

type Props = {
  prompt: string
  style: string
  duration: number
  withAudio: boolean
  mode: VideoMode
  imageUrl: string | null
}

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `US$${value.toFixed(value < 0.1 ? 3 : 2)}` : null
}

function statusLabel(value: string | null | undefined) {
  if (value === "healthy") return "Conexión verificada"
  if (value === "invalid") return "API key inválida"
  if (value === "error") return "Error de conexión"
  return "Sin verificar"
}

export default function PersonalAIMarketplace(props: Props) {
  const [open, setOpen] = useState(false)
  const [providers, setProviders] = useState<ProviderDescriptor[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("fal")
  const [models, setModels] = useState<MarketplaceModel[]>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [secret, setSecret] = useState("")
  const [maxRequest, setMaxRequest] = useState<string>("0.75")
  const [dailyBudget, setDailyBudget] = useState<string>("3.00")
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<PersonalJob | null>(null)

  const provider = providers.find(item => item.id === selectedProvider) || null
  const credential = provider?.credential || null
  const selected = models.find(item => item.id === selectedModel) || null

  const filteredModels = useMemo(() => {
    if (props.mode === "text_to_video") {
      return models.filter(item => !/image-to-video/i.test(item.category || ""))
    }
    const imageModels = models.filter(item => /image-to-video|video/i.test(item.category || ""))
    return imageModels.length ? imageModels : models
  }, [models, props.mode])

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true)
    setError(null)
    try {
      const response = await fetch("/api/account/ai-marketplace", { cache: "no-store" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "No fue posible cargar los proveedores")
      setProviders(body.providers || [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar los proveedores")
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadProviders()
  }, [open, loadProviders])

  useEffect(() => {
    const current = providers.find(item => item.id === selectedProvider)?.credential
    setMaxRequest(current?.maxRequestUsd != null ? String(current.maxRequestUsd) : "0.75")
    setDailyBudget(current?.dailyBudgetUsd != null ? String(current.dailyBudgetUsd) : "3.00")
  }, [providers, selectedProvider])

  const loadModels = useCallback(async () => {
    setLoadingModels(true)
    setModels([])
    setSelectedModel("")
    setError(null)
    try {
      const response = await fetch(`/api/account/ai-marketplace?provider=${encodeURIComponent(selectedProvider)}&duration=${props.duration}`, { cache: "no-store" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "No fue posible cargar los modelos")
      const next = (body.models || []) as MarketplaceModel[]
      setModels(next)
      const compatible = next.find(item => item.compatible)
      if (compatible) setSelectedModel(compatible.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar los modelos")
    } finally {
      setLoadingModels(false)
    }
  }, [props.duration, selectedProvider])

  useEffect(() => {
    if (!open) return
    if (selectedProvider === "huggingface" || credential?.enabled) void loadModels()
  }, [open, selectedProvider, credential?.enabled, loadModels])

  const saveCredential = async () => {
    if (!secret.trim()) {
      setError("Pega tu API key antes de guardar.")
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/account/ai-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          secret: secret.trim(),
          maxRequestUsd: maxRequest ? Number(maxRequest) : null,
          dailyBudgetUsd: dailyBudget ? Number(dailyBudget) : null,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "No fue posible guardar la API key")
      setSecret("")
      setMessage("API guardada cifrada en EduAI. La clave completa no volverá a mostrarse.")
      await loadProviders()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar la API key")
    } finally {
      setSaving(false)
    }
  }

  const saveBudgets = async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/account/ai-credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          maxRequestUsd: maxRequest ? Number(maxRequest) : null,
          dailyBudgetUsd: dailyBudget ? Number(dailyBudget) : null,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "No fue posible guardar los límites")
      setMessage("Límites personales actualizados.")
      await loadProviders()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar los límites")
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/account/ai-credentials/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || body?.message || "La prueba falló")
      setMessage(body?.message || "Conexión correcta")
      await loadProviders()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La prueba falló")
      await loadProviders()
    } finally {
      setTesting(false)
    }
  }

  const deleteCredential = async () => {
    if (!window.confirm(`¿Eliminar la conexión personal con ${provider?.label || selectedProvider}?`)) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/account/ai-credentials?provider=${encodeURIComponent(selectedProvider)}`, { method: "DELETE" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "No fue posible eliminar la conexión")
      setModels([])
      setSelectedModel("")
      setMessage("Conexión eliminada.")
      await loadProviders()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible eliminar la conexión")
    } finally {
      setSaving(false)
    }
  }

  const poll = async (jobId: string) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 3500))
      const response = await fetch(`/api/agents/video/personal/status/${encodeURIComponent(jobId)}`, { cache: "no-store" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "No fue posible consultar el video")
      setJob(body)
      if (body.status === "completed") {
        setMessage(body.reusable ? "Video completado y guardado en Recursos IA." : "Video completado.")
        return
      }
      if (body.status === "failed") throw new Error(body.errorMessage || "El proveedor no pudo generar el video")
    }
    throw new Error("El video sigue procesándose. Puedes cerrar esta ventana y volver a consultar el job después.")
  }

  const generatePersonal = async () => {
    if (props.prompt.trim().length < 8) {
      setError("Escribe el prompt principal en Video Studio antes de usar Premium Personal.")
      return
    }
    if (props.mode === "image_to_video" && !props.imageUrl) {
      setError("Selecciona o sube una imagen base antes de generar Imagen → Video.")
      return
    }
    if (!credential?.enabled) {
      setError("Primero conecta tu cuenta del proveedor.")
      return
    }
    if (!selected?.compatible) {
      setError("Este modelo todavía no está habilitado para generación directa en EduAI.")
      return
    }

    const estimate = selected.pricing?.estimatedCostUsd ?? null
    const label = estimate != null ? `Costo estimado: ${money(estimate)}. ` : "El proveedor calculará el costo final. "
    if (!window.confirm(`${label}El cargo se realizará en tu cuenta de ${provider?.label || selectedProvider}, no en EduAI. ¿Continuar?`)) return

    setGenerating(true)
    setError(null)
    setMessage(null)
    setJob(null)
    try {
      const response = await fetch("/api/agents/video/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          prompt: props.prompt,
          style: props.style,
          duration: props.duration,
          withAudio: props.withAudio,
          mode: props.mode,
          imageUrl: props.imageUrl,
          aspectRatio: "16:9",
          resolution: "720p",
          expectedCostUsd: estimate,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.jobId) throw new Error(body?.error || "No fue posible iniciar el video personal")
      setJob(body)
      if (body.reused && body.videoUrl) {
        setMessage("Se reutilizó un video existente. Costo nuevo: US$0.")
        return
      }
      if (body.status === "completed") {
        setMessage("Video completado y guardado en Recursos IA.")
        return
      }
      setMessage("Solicitud aceptada por tu proveedor. EduAI está consultando el progreso.")
      await poll(body.jobId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible generar el video")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-400/20 dark:text-amber-200"
      >
        <CircleDollarSign className="h-4 w-4" />
        Premium personal · paga con tu cuenta
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300"><Sparkles className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-[0.18em]">Premium personal</span></div>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Elige proveedor, modelo y cuánto quieres gastar</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">EduAI no paga estas generaciones. El cargo se hace directamente en tu cuenta del proveedor. Los videos terminados se guardan en Recursos IA para reutilizarlos sin volver a pagar.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-600 dark:border-white/10 dark:text-slate-300"><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto p-5">
              {loadingProviders ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando proveedores…</div> : null}

              <div className="grid gap-3 md:grid-cols-3">
                {providers.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setSelectedProvider(item.id); setMessage(null); setError(null); setJob(null) }}
                    className={`rounded-2xl border p-4 text-left transition ${selectedProvider === item.id ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-slate-900 dark:text-white">{item.label}</span>
                      <div className="flex gap-1">
                        {item.recommended ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Recomendado</span> : null}
                        {item.beta ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Beta</span> : null}
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                      {item.connected ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600">Conectado ••••{item.credential?.last4}</span></> : <><KeyRound className="h-4 w-4 text-slate-400" /><span className="text-slate-500">Sin conectar</span></>}
                    </div>
                  </button>
                ))}
              </div>

              {provider ? (
                <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                  <section className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-500" /><h3 className="font-black text-slate-900 dark:text-white">Conectar mi cuenta</h3></div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <a href={provider.signupUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 font-semibold dark:border-white/10">Crear cuenta <ExternalLink className="h-3 w-3" /></a>
                      <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 font-semibold dark:border-white/10">Obtener API key <ExternalLink className="h-3 w-3" /></a>
                      <a href={provider.billingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 font-semibold dark:border-white/10">Facturación <ExternalLink className="h-3 w-3" /></a>
                      <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 font-semibold dark:border-white/10">Ayuda <ExternalLink className="h-3 w-3" /></a>
                    </div>

                    {!credential ? (
                      <div className="mt-4 space-y-3">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Pega tu API key una sola vez</label>
                        <input type="password" autoComplete="off" value={secret} onChange={event => setSecret(event.target.value)} placeholder="La clave se cifra en el servidor" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" />
                        <button type="button" onClick={() => void saveCredential()} disabled={saving} className="w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar conexión cifrada"}</button>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/5">
                          <p className="font-bold text-slate-800 dark:text-slate-100">API guardada ••••{credential.last4}</p>
                          <p className="mt-1 text-slate-500">{statusLabel(credential.testStatus)}{credential.testMessage ? ` · ${credential.testMessage}` : ""}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => void testConnection()} disabled={testing} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/10">{testing ? "Probando…" : "Probar conexión"}</button>
                          <button type="button" onClick={() => void deleteCredential()} disabled={saving} className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600"><Trash2 className="h-3 w-3" />Eliminar</button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Mis límites</h4>
                      <p className="mt-1 text-xs text-slate-500">EduAI bloquea una solicitud antes de enviarla si la estimación conocida supera estos límites.</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Máx. por video (USD)<input type="number" min="0" step="0.05" value={maxRequest} onChange={event => setMaxRequest(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" /></label>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Máx. diario (USD)<input type="number" min="0" step="0.25" value={dailyBudget} onChange={event => setDailyBudget(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5" /></label>
                      </div>
                      {credential ? <button type="button" onClick={() => void saveBudgets()} disabled={saving} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/10">Guardar límites</button> : null}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <div><h3 className="font-black text-slate-900 dark:text-white">Modelos de video</h3><p className="mt-1 text-xs text-slate-500">Duración actual: {props.duration} s · {props.mode === "image_to_video" ? "Imagen → Video" : "Texto → Video"}</p></div>
                      <button type="button" onClick={() => void loadModels()} disabled={loadingModels} className="rounded-xl border border-slate-200 p-2 dark:border-white/10"><RefreshCw className={`h-4 w-4 ${loadingModels ? "animate-spin" : ""}`} /></button>
                    </div>

                    {!credential?.enabled && selectedProvider !== "huggingface" ? <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Conecta tu cuenta para ver modelos y precios de este proveedor.</div> : null}
                    {loadingModels ? <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Consultando catálogo…</div> : null}

                    <div className="mt-4 grid max-h-[330px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {filteredModels.map(item => {
                        const estimate = money(item.pricing?.estimatedCostUsd)
                        return (
                          <button key={item.id} type="button" disabled={!item.compatible} onClick={() => setSelectedModel(item.id)} className={`rounded-xl border p-3 text-left ${selectedModel === item.id ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-slate-200 dark:border-white/10"} disabled:opacity-50`}>
                            <div className="flex items-start justify-between gap-2"><span className="line-clamp-1 text-sm font-black text-slate-900 dark:text-white">{item.label}</span>{estimate ? <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">≈ {estimate}</span> : null}</div>
                            <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{item.description || item.id}</p>
                            <p className="mt-2 text-[10px] font-semibold text-slate-400">{item.pricing ? `${item.pricing.currency} ${item.pricing.unitPrice}/${item.pricing.unit}` : item.compatibilityNote || "Precio administrado por el proveedor"}</p>
                          </button>
                        )
                      })}
                    </div>

                    {selected ? (
                      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-400/20 dark:bg-blue-500/10">
                        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-blue-950 dark:text-blue-100">{selected.label}</p><p className="mt-1 text-xs text-blue-700 dark:text-blue-200">{selected.pricing?.estimatedCostUsd != null ? `Costo estimado ${money(selected.pricing.estimatedCostUsd)}. El importe final lo determina ${provider.label}.` : `El costo final se verá en tu cuenta de ${provider.label}.`}</p></div><CircleDollarSign className="h-5 w-5 text-blue-600" /></div>
                        <button type="button" onClick={() => void generatePersonal()} disabled={generating || !credential?.enabled || !selected.compatible} className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{generating ? "Generando con tu cuenta…" : `Generar con ${provider.shortLabel}`}</button>
                      </div>
                    ) : null}

                    {job ? (
                      <div className="mt-4 rounded-xl border border-slate-200 p-3 text-xs dark:border-white/10">
                        <div className="flex items-center justify-between"><span className="font-black">Job personal</span><span>{job.status}</span></div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full bg-blue-500 transition-all" style={{ width: `${job.progress ?? (job.status === "completed" || job.status === "failed" ? 100 : 60)}%` }} /></div>
                        <p className="mt-2 text-slate-500">{job.provider} · {job.model}</p>
                        {job.videoUrl ? <video src={job.videoUrl} controls className="mt-3 w-full rounded-xl bg-black" /> : null}
                      </div>
                    ) : null}
                  </section>
                </div>
              ) : null}

              {message ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
              {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
