"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Loader2, RefreshCw, Settings2, ToggleLeft, ToggleRight } from "lucide-react"

type ModelRow = {
  provider: string
  model: string
  label: string | null
  capabilities: string[] | null
  is_enabled: boolean
  is_default: boolean
  priority: number | null
  config: Record<string, unknown> | null
  deprecated_at: string | null
  shutdown_at: string | null
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase())
}

function isPast(date: string | null) {
  if (!date) return false
  const value = new Date(date).getTime()
  return Number.isFinite(value) && value <= Date.now()
}

export default function AIModelRegistryPanel() {
  const [models, setModels] = useState<ModelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/ai-core/models", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudo leer el registro de modelos.")
      setModels(Array.isArray(payload?.models) ? payload.models : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo leer el registro de modelos.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, ModelRow[]>()
    for (const model of models) {
      const list = map.get(model.provider) || []
      list.push(model)
      map.set(model.provider, list)
    }
    return [...map.entries()]
  }, [models])

  async function mutate(model: ModelRow, action: "enable" | "disable" | "set_default") {
    if (action === "disable" && !window.confirm(`¿Desactivar ${model.model}?`)) return
    if (action === "set_default" && !window.confirm(`¿Usar ${model.model} como modelo principal para sus capacidades?`)) return

    const key = `${model.provider}:${model.model}:${action}`
    setSaving(key)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ai-core/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: model.provider, model: model.model, action }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || "No se pudo actualizar el modelo.")
      setMessage(`${model.model} actualizado. AI Core reflejará el cambio como máximo en 60 segundos en instancias ya activas.`)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el modelo.")
    } finally {
      setSaving("")
    }
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300"><Settings2 size={17} /><span className="text-xs font-black uppercase tracking-[0.2em]">Registro dinámico</span></div>
          <h2 className="mt-2 text-xl font-black text-white">Modelos activos de AI Core</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Elige modelos desde Supabase sin exponer API keys ni editar código. Si el registro no está disponible, EduAI conserva la configuración de Vercel como fallback.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 hover:bg-white/10" aria-label="Actualizar modelos"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {message && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">{message}</div>}

      {loading && !models.length ? (
        <div className="flex min-h-32 items-center justify-center"><Loader2 size={24} className="animate-spin text-cyan-300" /></div>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map(([provider, rows]) => (
            <div key={provider} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="font-black text-white">{label(provider)}</h3>
                <span className="text-xs text-slate-500">{rows.filter(row => row.is_enabled).length}/{rows.length} activos</span>
              </div>
              <div className="divide-y divide-white/5">
                {rows.map((model) => {
                  const disabledByDate = isPast(model.shutdown_at)
                  const enableKey = `${model.provider}:${model.model}:${model.is_enabled ? "disable" : "enable"}`
                  const defaultKey = `${model.provider}:${model.model}:set_default`
                  return (
                    <article key={`${model.provider}:${model.model}`} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-all text-sm font-black text-white">{model.label || model.model}</p>
                          {model.is_default && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-200"><CheckCircle2 size={11} /> Principal</span>}
                          {disabledByDate && <span className="rounded-full border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-200">Shutdown</span>}
                        </div>
                        <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{model.model}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Prioridad {model.priority ?? 100}</p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(model.capabilities || []).map((capability) => (
                          <span key={capability} className="rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-300">{capability}</span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <button
                          type="button"
                          disabled={Boolean(saving) || disabledByDate || model.is_default}
                          onClick={() => void mutate(model, model.is_enabled ? "disable" : "enable")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {saving === enableKey ? <Loader2 size={14} className="animate-spin" /> : model.is_enabled ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                          {model.is_enabled ? "Activo" : "Activar"}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(saving) || disabledByDate || model.is_default}
                          onClick={() => void mutate(model, "set_default")}
                          className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {saving === defaultKey ? "Guardando..." : model.is_default ? "Principal" : "Hacer principal"}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-5 text-slate-500">Cambiar el principal afecta todas las capacidades declaradas por ese modelo. Las instancias serverless calientes conservan la selección por hasta 60 segundos; las nuevas la leen inmediatamente.</p>
    </section>
  )
}