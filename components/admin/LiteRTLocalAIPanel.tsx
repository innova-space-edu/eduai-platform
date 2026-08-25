"use client"

import { useMemo, useState } from "react"
import { Cpu, Gauge, HardDriveDownload, Laptop, Sparkles } from "lucide-react"
import {
  DEFAULT_LITERT_PROBE_MODEL_ID,
  EDUAI_LITERT_ESM_URL,
  EDUAI_LITERT_VERSION,
  EDUAI_LITERT_WASM_URL,
  LOCAL_AI_MODELS,
} from "@/lib/ai/local/litert-models"

type RuntimeState = {
  webgpu: boolean
  webnn: boolean
  wasm: boolean
  initialized: boolean
  error?: string
}

export default function LiteRTLocalAIPanel() {
  const [runtime, setRuntime] = useState<RuntimeState | null>(null)
  const [testing, setTesting] = useState(false)

  const readyModels = useMemo(() => LOCAL_AI_MODELS.filter(model => model.status === "ready"), [])

  const probeRuntime = async () => {
    setTesting(true)
    try {
      const webgpu = typeof navigator !== "undefined" && "gpu" in navigator
      const webnn = typeof navigator !== "undefined" && "ml" in navigator
      const wasm = typeof WebAssembly !== "undefined"

      const litert = await import(/* webpackIgnore: true */ EDUAI_LITERT_ESM_URL)
      if (typeof litert.loadLiteRt !== "function") {
        throw new Error("El módulo LiteRT.js cargó, pero no expone loadLiteRt().")
      }

      await litert.loadLiteRt(EDUAI_LITERT_WASM_URL)
      setRuntime({ webgpu, webnn, wasm, initialized: true })
    } catch (error) {
      setRuntime({
        webgpu: typeof navigator !== "undefined" && "gpu" in navigator,
        webnn: typeof navigator !== "undefined" && "ml" in navigator,
        wasm: typeof WebAssembly !== "undefined",
        initialized: false,
        error: error instanceof Error ? error.message : "No fue posible iniciar LiteRT.js",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="rounded-[28px] border border-emerald-400/20 bg-emerald-500/[0.06] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Local-first AI</p>
          <h2 className="mt-2 text-xl font-black text-white">LiteRT.js · IA en el navegador</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
            Diagnóstico inicial para ejecutar modelos locales con WebGPU o WASM antes de recurrir al AI Gateway en la nube.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void probeRuntime()}
          disabled={testing}
          className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {testing ? "Probando…" : "Probar este dispositivo"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-emerald-200"><Sparkles className="h-4 w-4" /><span className="font-black">Runtime</span></div>
          <p className="mt-3 text-sm text-slate-300">LiteRT.js {EDUAI_LITERT_VERSION}</p>
          <p className="mt-1 text-xs text-slate-500">Carga bajo demanda; no aumenta el bundle inicial.</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-blue-200"><Gauge className="h-4 w-4" /><span className="font-black">WebGPU</span></div>
          <p className="mt-3 text-sm text-slate-300">{runtime ? (runtime.webgpu ? "Disponible" : "No disponible") : "Sin probar"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-violet-200"><Cpu className="h-4 w-4" /><span className="font-black">WASM / CPU</span></div>
          <p className="mt-3 text-sm text-slate-300">{runtime ? (runtime.wasm ? "Disponible" : "No disponible") : "Sin probar"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-cyan-200"><Laptop className="h-4 w-4" /><span className="font-black">WebNN</span></div>
          <p className="mt-3 text-sm text-slate-300">{runtime ? (runtime.webnn ? "Detectado" : "No detectado") : "Sin probar"}</p>
        </article>
      </div>

      {runtime ? (
        <div className={`mt-4 rounded-2xl border p-4 text-sm ${runtime.initialized ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100" : "border-amber-400/20 bg-amber-500/10 text-amber-100"}`}>
          {runtime.initialized
            ? "LiteRT.js inicializó correctamente en este navegador. El siguiente paso es ejecutar inferencia con el modelo de prueba."
            : `LiteRT.js no pudo inicializar: ${runtime.error || "error desconocido"}`}
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-2 text-sm font-black text-white">
        <HardDriveDownload className="h-4 w-4 text-emerald-300" />
        Catálogo local inicial
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {LOCAL_AI_MODELS.map((model) => (
          <article key={model.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{model.runtime} · {model.format}</p>
                <h3 className="mt-1 font-black text-white">{model.name}</h3>
                <p className="mt-1 text-xs text-slate-400">{model.task} · ~{model.sizeMB} MB</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${model.status === "ready" ? "bg-emerald-500/15 text-emerald-200" : model.status === "candidate" ? "bg-blue-500/15 text-blue-200" : "bg-slate-500/15 text-slate-300"}`}>
                {model.status === "ready" ? "Primera prueba" : model.status === "candidate" ? "Candidato" : "Siguiente fase"}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-300">{model.notes}</p>
            <p className="mt-3 text-[11px] text-slate-500">HF: {model.sourceRepo}</p>
          </article>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Modelo de prueba configurado: {DEFAULT_LITERT_PROBE_MODEL_ID}. Modelos listos para primera validación: {readyModels.length}.
      </p>
    </section>
  )
}
