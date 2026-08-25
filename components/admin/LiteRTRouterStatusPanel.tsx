"use client"

import { useEffect, useState } from "react"
import { Gauge, RefreshCw, Trash2 } from "lucide-react"
import { clearLiteRTRouteProfile, readAllLiteRTRouteProfiles, type LiteRTRouteProfile } from "@/lib/ai/local/litert-router"

function formatMs(value: number) { return value < 100 ? `${value.toFixed(1)} ms` : `${Math.round(value)} ms` }

export default function LiteRTRouterStatusPanel() {
  const [profiles, setProfiles] = useState<LiteRTRouteProfile[]>([])
  function refresh() { setProfiles(readAllLiteRTRouteProfiles()) }
  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("eduai:litert-route-profile", handler)
    return () => window.removeEventListener("eduai:litert-route-profile", handler)
  }, [])

  return (
    <section className="rounded-[24px] border border-violet-400/15 bg-violet-950/15 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2 text-violet-200"><Gauge className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.18em]">Device Router V3</p></div><h3 className="mt-2 text-lg font-black text-white">Perfiles persistentes por modelo</h3><p className="mt-1 text-xs text-slate-500">Cada modelo conserva su backend ganador E2E. El perfil se invalida si cambia navegador, hardware detectable o versión de LiteRT.</p></div>
        <div className="flex gap-2"><button type="button" onClick={refresh} className="rounded-xl border border-white/10 bg-slate-950/55 p-2 text-slate-300"><RefreshCw className="h-4 w-4" /></button>{profiles.length ? <button type="button" onClick={() => { clearLiteRTRouteProfile(); setProfiles([]) }} className="rounded-xl border border-red-400/15 bg-red-950/20 p-2 text-red-200"><Trash2 className="h-4 w-4" /></button> : null}</div>
      </div>
      {profiles.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{profiles.map(profile => <article key={profile.modelId} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="truncate text-sm font-black text-white">{profile.modelId}</p><span className="rounded-full border border-emerald-400/15 bg-emerald-950/25 px-2.5 py-1 text-[10px] font-black text-emerald-200">{profile.backend.toUpperCase()}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-black/20 p-3"><p className="text-[9px] uppercase text-slate-600">E2E mediana</p><p className="mt-1 text-sm font-black text-white">{formatMs(profile.medianEndToEndMs)}</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-[9px] uppercase text-slate-600">E2E P95</p><p className="mt-1 text-sm font-black text-white">{formatMs(profile.p95EndToEndMs)}</p></div></div><button type="button" onClick={() => { clearLiteRTRouteProfile(profile.modelId); refresh() }} className="mt-3 text-[10px] font-black text-red-200/80 hover:text-red-100">Borrar perfil de este modelo</button></article>)}</div> : <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3 text-xs text-slate-500">Sin perfiles todavía. Benchmark V4 calibra MobileNet FP32; Quantization Lab V3 añadirá perfiles para las variantes que pruebe.</div>}
    </section>
  )
}
