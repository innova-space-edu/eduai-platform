"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"

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
  const [query, setQuery] = useState("")
  const [capability, setCapability] = useState("all")
  const [enabledOnly, setEnabledOnly] = useState(false)

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

  const capabilities = useMemo(() => {
    return [...new Set(models.flatMap(model => model.capabilities || []))].sort()
  }, [models])

  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return models.filter(model => {
      if (enabledOnly && !model.is_enabled) return false
      if (capability !== "all" && !(model.capabilities || []).includes(capability)) return false
      if (!normalized) return true
      return [model.provider, model.model, model.label || "", ...(model.capabilities || [])]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    })
  }, [models, query, capability, enabledOnly])

  const groups = useMemo(() => {
    const map = new Map<string, ModelRow[]>()
    for (const model of filteredModels) {
      const list = map.get(model.provider) || []
      list.push(model)
      map.set(model.provider, list)
    }
    return [...map.entries()]
  }, [filteredModels])

  const stats = useMemo(() => ({
    providers: new Set(models.map(model => model.provider)).size,
    enabled: models.filter(model => model.is_enabled).length,
    defaults: models.filter(model => model.is_default).length,
    capabilities: capabilities.length,
  }), [models, capabilities])

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
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.88))] p-5 shadow-[0_22px_70px_rgba(2,6,23,0.18)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300"><Settings2 size={17} /><span className="text-xs font-black uppercase tracking-[0.2em]">Registro dinámico</span></div>
          <h2 className="mt-2 text-2xl font-black text-white">Modelos activos de AI Core</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">Filtra por proveedor, capacidad o estado y cambia modelos desde Supabase sin exponer API keys ni editar código.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10" aria-label="Actualizar modelos"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Proveedores", stats.providers],
          ["Modelos activos", stats.enabled],
          ["Principales", stats.defaults],
          ["Capacidades", stats.capabilities],
        ].map(([statLabel, value]) => (
          <div key={statLabel} className="rounded-2xl border border-white/8 bg-slate-950/45 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">{statLabel}</p>
            <p className="mt-1 text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(240px,1fr)_220px_auto]">
        <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5 focus-within:border-cyan-400/30">
          <Search className="h-4 w-4 shrink-0 text-slate-600" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar modelo, proveedor o capacidad…"
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
          />
        </label>
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5">
          <Filter className="h-4 w-4 text-slate-600" />
          <select value={capability} onChange={event => setCapability(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-300 outline-none">
            <option value="all">Todas las capacidades</option>
            {capabilities.map(item => <option key={item} value={item}>{label(item)}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setEnabledOnly(value => !value)}
          className={`rounded-2xl border px-4 py-2.5 text-xs font-black transition ${enabledOnly ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-slate-400"}`}
        >
          {enabledOnly ? "Solo activos" : "Todos los estados"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
        <span>Mostrando <strong className="text-slate-300">{filteredModels.length}</strong> de {models.length} modelos.</span>
        {(query || capability !== "all" || enabledOnly) ? (
          <button type="button" onClick={() => { setQuery(""); setCapability("all"); setEnabledOnly(false) }} className="font-black text-cyan-300 hover:text-cyan-200">Limpiar filtros</button>
        ) : null}
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {message && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">{message}</div>}

      {loading && !models.length ? (
        <div className="flex min-h-32 items-center justify-center"><Loader2 size={24} className="animate-spin text-cyan-300" /></div>
      ) : !groups.length ? (
        <div className="mt-5 rounded-2xl border border-white/8 bg-slate-950/45 p-8 text-center">
          <Search className="mx-auto h-6 w-6 text-slate-700" />
          <p className="mt-3 text-sm font-black text-slate-300">No hay modelos que coincidan</p>
          <p className="mt-1 text-xs text-slate-600">Cambia la búsqueda o limpia los filtros.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {groups.map(([provider, rows]) => (
            <div key={provider} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.65)]" />
                  <h3 className="font-black text-white">{label(provider)}</h3>
                </div>
                <span className="text-xs text-slate-500">{rows.filter(row => row.is_enabled).length}/{rows.length} activos en vista</span>
              </div>
              <div className="divide-y divide-white/5">
                {rows.map((model) => {
                  const disabledByDate = isPast(model.shutdown_at)
                  const enableKey = `${model.provider}:${model.model}:${model.is_enabled ? "disable" : "enable"}`
                  const defaultKey = `${model.provider}:${model.model}:set_default`
                  return (
                    <article key={`${model.provider}:${model.model}`} className="grid gap-3 px-4 py-4 transition hover:bg-white/[0.018] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.5fr)_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-black text-white">{model.label || model.model}</p>
                          {model.is_default && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-200"><CheckCircle2 size={11} /> Principal</span>}
                          {disabledByDate && <span className="rounded-full border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-200">Shutdown</span>}
                        </div>
                        <p className="mt-1 break-all font-mono text-[11px] text-slate-600">{model.model}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Prioridad {model.priority ?? 100}</p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(model.capabilities || []).map((item) => (
                          <span key={item} className="rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-300">{item}</span>
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
