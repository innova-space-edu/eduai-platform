"use client"

import { useEffect, useState } from "react"
import { Flame, Gauge, RefreshCw, ShieldAlert, Trash2 } from "lucide-react"
import { clearLiteRTRouteProfile, readAllLiteRTRouteProfiles, type LiteRTRouteProfile } from "@/lib/ai/local/litert-router"
import { clearLiteRTNegativeCapability, getAllLiteRTNegativeCapabilities, type LiteRTNegativeCapability } from "@/lib/ai/local/litert-negative-cache"
import { getLiteRTModelPrewarmStatus, type LiteRTModelPrewarmStatus } from "@/lib/ai/local/litert-model-prewarm"

function formatMs(value: number) { return value < 100 ? `${value.toFixed(1)} ms` : `${Math.round(value)} ms` }

export default function LiteRTRouterStatusPanel() {
  const [profiles, setProfiles] = useState<LiteRTRouteProfile[]>([])
  const [blocked, setBlocked] = useState<LiteRTNegativeCapability[]>([])
  const [prewarm, setPrewarm] = useState<LiteRTModelPrewarmStatus>(() => getLiteRTModelPrewarmStatus())

  function refresh() {
    setProfiles(readAllLiteRTRouteProfiles())
    setBlocked(getAllLiteRTNegativeCapabilities())
    setPrewarm(getLiteRTModelPrewarmStatus())
  }

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("eduai:litert-route-profile", handler)
    window.addEventListener("eduai:litert-negative-capability", handler)
    window.addEventListener("eduai:litert-model-prewarm", handler)
    return () => {
      window.removeEventListener("eduai:litert-route-profile", handler)
      window.removeEventListener("eduai:litert-negative-capability", handler)
      window.removeEventListener("eduai:litert-model-prewarm", handler)
    }
  }, [])

  return (
    <section className="rounded-[24px] border border-violet-400/15 bg-violet-950/15 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2 text-violet-200"><Gauge className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.18em]">Device Router V3</p></div><h3 className="mt-2 text-lg font-black text-white">Perfiles persistentes por modelo</h3><p className="mt-1 text-xs text-slate-500">Cada modelo conserva su backend ganador E2E. El perfil se invalida si cambia navegador, hardware detectable o versión de LiteRT.</p></div>
        <div className="flex gap-2"><button type="button" onClick={refresh} className="rounded-xl border border-white/10 bg-slate-950/55 p-2 text-slate-300"><RefreshCw className="h-4 w-4" /></button>{profiles.length ? <button type="button" onClick={() => { clearLiteRTRouteProfile(); setProfiles([]) }} className="rounded-xl border border-red-400/15 bg-red-950/20 p-2 text-red-200"><Trash2 className="h-4 w-4" /></button> : null}</div>
      </div>

      {profiles.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{profiles.map(profile => <article key={profile.modelId} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="truncate text-sm font-black text-white">{profile.modelId}</p><span className="rounded-full border border-emerald-400/15 bg-emerald-950/25 px-2.5 py-1 text-[10px] font-black text-emerald-200">{profile.backend.toUpperCase()}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-black/20 p-3"><p className="text-[9px] uppercase text-slate-600">E2E mediana</p><p className="mt-1 text-sm font-black text-white">{formatMs(profile.medianEndToEndMs)}</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-[9px] uppercase text-slate-600">E2E P95</p><p className="mt-1 text-sm font-black text-white">{formatMs(profile.p95EndToEndMs)}</p></div></div><button type="button" onClick={() => { clearLiteRTRouteProfile(profile.modelId); refresh() }} className="mt-3 text-[10px] font-black text-red-200/80 hover:text-red-100">Borrar perfil de este modelo</button></article>)}</div> : <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3 text-xs text-slate-500">Sin perfiles todavía. Benchmark V4 calibra MobileNet FP32; Quantization Lab V3 añadirá perfiles para las variantes que pruebe.</div>}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-emerald-400/10 bg-emerald-950/10 p-4">
          <div className="flex items-center gap-2 text-emerald-200"><Flame className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.16em]">Model prewarm</p></div>
          <p className="mt-2 text-sm font-black text-white">{prewarm.running ? "Precalentando modelos…" : prewarm.completedAt ? `${prewarm.warmed.length} modelo(s) preparados` : "Pendiente de idle"}</p>
          <p className="mt-1 text-xs text-slate-500">El navegador compila en segundo plano los backends ganadores para que la primera inferencia pueda llegar con POOL HIT.</p>
          {prewarm.warmed.length ? <div className="mt-3 space-y-2">{prewarm.warmed.map(item => <div key={`${item.modelId}-${item.backend}`} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-[10px]"><span className="truncate text-slate-300">{item.modelId} · {item.backend.toUpperCase()}</span><span className="font-black text-emerald-200">{item.reused ? "POOL HIT" : formatMs(item.acquireMs)}</span></div>)}</div> : null}
          {prewarm.error ? <p className="mt-2 text-[10px] text-amber-200">{prewarm.error}</p> : null}
        </article>

        <article className="rounded-2xl border border-amber-400/10 bg-amber-950/10 p-4">
          <div className="flex items-center gap-2 text-amber-200"><ShieldAlert className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.16em]">Compatibilidad recordada</p></div>
          <p className="mt-2 text-sm font-black text-white">{blocked.length ? `${blocked.length} combinación(es) evitadas` : "Sin incompatibilidades registradas"}</p>
          <p className="mt-1 text-xs text-slate-500">Las fallas determinísticas se recuerdan temporalmente para no recompilar una combinación modelo/backend que ya sabemos que no funciona.</p>
          {blocked.length ? <div className="mt-3 space-y-2">{blocked.map(item => <div key={`${item.modelId}-${item.backend}`} className="rounded-xl bg-black/20 p-3"><div className="flex items-center justify-between gap-3"><span className="truncate text-[10px] font-black text-white">{item.modelId}</span><span className="text-[10px] font-black text-amber-200">{item.backend.toUpperCase()}</span></div><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{item.reason}</p><button type="button" onClick={() => { clearLiteRTNegativeCapability(item.modelId, item.backend); refresh() }} className="mt-2 text-[10px] font-black text-red-200/80">Reintentar esta combinación</button></div>)}</div> : null}
        </article>
      </div>
    </section>
  )
}
