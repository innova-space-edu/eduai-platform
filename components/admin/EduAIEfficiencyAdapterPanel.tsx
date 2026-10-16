"use client";

import { useEffect, useMemo, useState } from "react";
import { Cpu, Database, HardDrive, LockKeyhole, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import {
  BONSAI_REFERENCE_MODELS,
  EFFICIENCY_MODELS,
  getAdaptiveWllamaTuning,
  isEfficiencyAdapterEnabled,
  planUniversalEfficiency,
  setEfficiencyAdapterEnabled,
  type EfficiencyEngine,
} from "@/lib/ai/local/eduai-efficiency-adapter";
import {
  probeEduAILocalHardware,
  requestEduAILocalPersistentStorage,
  type EduAILocalHardware,
} from "@/lib/ai/local/eduai-local-runtime";

const BONSAI_DOCS = "https://prismml.com/news/bonsai-2-family";

function sizeMB(n: number | null | undefined) {
  return n == null ? "No verificable" : n >= 1024 ? (n / 1024).toFixed(2) + " GiB aprox." : n.toFixed(0) + " MB";
}

export default function EduAIEfficiencyAdapterPanel() {
  const [hardware, setHardware] = useState<EduAILocalHardware | null>(null);
  const [memoryInput, setMemoryInput] = useState("");
  const [vramInput, setVramInput] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("eduai-local-lfm-350m");
  const [engine, setEngine] = useState<EfficiencyEngine>("browser-wllama");
  const [cachedOnDisk, setCachedOnDisk] = useState(false);
  const [includeVision, setIncludeVision] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      setHardware(await probeEduAILocalHardware());
    } catch {
      setMessage("No se pudo consultar hardware o cuota del navegador.");
    }
  }

  useEffect(() => {
    setTuning(isEfficiencyAdapterEnabled());
    void refresh();
  }, []);

  const chosenModel = EFFICIENCY_MODELS.find((m) => m.id === selectedModelId) ?? EFFICIENCY_MODELS[0];
  const ram = memoryInput.trim() ? Number(memoryInput) : hardware?.memoryGB ?? null;
  const vram = vramInput.trim() ? Number(vramInput) : null;
  const diskFree = hardware?.storageQuotaMB != null && hardware.storageUsageMB != null
    ? Math.max(0, hardware.storageQuotaMB - hardware.storageUsageMB)
    : null;

  const plan = useMemo(() => planUniversalEfficiency({
    model: chosenModel,
    engine,
    hardware: {
      ramGB: ram != null && Number.isFinite(ram) && ram > 0 ? ram : null,
      vramGB: vram != null && Number.isFinite(vram) && vram >= 0 ? vram : null,
      webgpu: hardware?.webgpu ?? false,
      cpuThreads: hardware?.cores ?? 1,
      freeStorageMB: diskFree,
      persistentStorage: hardware?.persistentStorage ?? null,
      online: hardware?.online ?? false,
    },
    cachedOnDisk,
    nativeBackendVerified: false, // Only an actual authenticated native health check may change this.
    serverEndpointVerified: false, // Server is offline: never assume available cloud GPU.
    allowRemoteInference: false, // No unattended transfer of user prompts.
    dataSensitivity: "internal",
    includeVision,
  }), [chosenModel, engine, hardware, ram, vram, diskFree, cachedOnDisk, includeVision]);

  const tuningPreview = getAdaptiveWllamaTuning(ram, chosenModel.maxContext);

  async function protectStorage() {
    setPending(true);
    try {
      const result = await requestEduAILocalPersistentStorage();
      setMessage(!result.supported
        ? "El navegador no admite almacenamiento persistente."
        : result.granted
          ? "Persistencia autorizada. No equivale a capacidad RAM adicional."
          : "El navegador no concedió persistencia; el caché puede borrarse automáticamente.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  function toggleAdaptive() {
    const next = !tuning;
    if (setEfficiencyAdapterEnabled(next)) {
      setTuning(next);
      setMessage(next
        ? "Modo adaptativo habilitado para las PRÓXIMAS cargas de wllama. Descarga y contexto permanecen sujetos a los límites del navegador."
        : "Modo adaptativo desactivado para futuras cargas. No cambia el modelo actualmente cargado.");
    } else {
      setMessage("El navegador bloqueó el guardado de la preferencia.");
    }
  }

  return (
    <section className="rounded-[28px] border border-cyan-400/15 bg-[#091525] p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200"><Zap className="h-4 w-4" /> Universal Efficiency Adapter V1</p>
          <h2 className="mt-2 text-xl font-black">RAM · SSD/caché · GPU · servidor</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-300">Planificador local sin descargas automáticas. Bonsai 2 es referencia de compresión; el runtime ternario nativo sigue pendiente de validación. Almacenar en SSD no equivale a ejecutar con menos RAM.</p>
        </div>
        <span className="rounded-full border border-amber-400/20 bg-amber-950/25 px-3 py-2 text-[10px] font-bold text-amber-200">EXPERIMENTAL · SIN PROMOCIÓN</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3"><Cpu className="h-4 w-4 text-cyan-300" /><p className="mt-1 text-xs">RAM detectada: <strong>{hardware?.memoryGB != null ? hardware.memoryGB + " GB" : "No expuesta"}</strong></p></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3"><HardDrive className="h-4 w-4 text-cyan-300" /><p className="mt-1 text-xs">Cuota libre del sitio: <strong>{sizeMB(diskFree)}</strong></p></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3"><Database className="h-4 w-4 text-cyan-300" /><p className="mt-1 text-xs">WebGPU: <strong>{hardware?.webgpu ? "API presente" : "No confirmada"}</strong> · Persistencia: <strong>{hardware?.persistentStorage ? "Sí" : "No"}</strong></p></div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-300">Modelo a planificar
          <select value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-[#0f1e33] p-2 text-xs text-white">
            <optgroup label="Modelos actuales wllama">{EFFICIENCY_MODELS.filter((m) => m.family === "eduai-gguf").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</optgroup>
            <optgroup label="Bonsai 2 (referencia, no wllama)">{BONSAI_REFERENCE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</optgroup>
          </select>
        </label>
        <label className="text-xs text-slate-300">Backend previsto
          <select value={engine} onChange={(event) => setEngine(event.target.value as EfficiencyEngine)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-[#0f1e33] p-2 text-xs text-white">
            <option value="browser-wllama">Navegador · wllama</option>
            <option value="native-prism">PrismML/llama.cpp nativo · no conectado</option>
            <option value="remote-server">Servidor remoto · no conectado</option>
          </select>
        </label>
        <label className="text-xs text-slate-300">RAM total del equipo (GB, opcional)
          <input inputMode="decimal" type="number" min="1" max="512" step="1" placeholder="Usar detección"
            value={memoryInput} onChange={(e) => setMemoryInput(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-[#0f1e33] p-2 text-xs text-white"/>
        </label>
        <label className="text-xs text-slate-300">VRAM (GB, opcional; no confirma GPU)
          <input inputMode="decimal" type="number" min="0" max="96" step="1" placeholder="No detectada"
            value={vramInput} onChange={(e) => setVramInput(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-[#0f1e33] p-2 text-xs text-white"/>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={cachedOnDisk} onChange={(e) => setCachedOnDisk(e.target.checked)} /> Suponer pesos ya cacheados (simulación)</label>
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={includeVision} onChange={(e) => setIncludeVision(e.target.checked)} disabled={!chosenModel.visionProjectorMB}/> Incluir proyector visual opcional</label>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-400/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">Plan de admisión: {chosenModel.label}</p>
          <span className={"rounded-lg px-2 py-1 text-[10px] font-black " + (plan.status === "ready-to-test" ? "bg-emerald-950/50 text-emerald-200" : plan.status === "blocked" ? "bg-red-950/50 text-red-200" : "bg-amber-950/50 text-amber-200")}>
            {plan.status === "ready-to-test" ? "Listo para prueba" : plan.status === "blocked" ? "Bloqueado" : "Verificación pendiente"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <p>Pesos: <strong>{sizeMB(plan.weightsMB)}</strong></p>
          <p>Margen estimado: <strong>{sizeMB(plan.estimatedRuntimeBudgetMB)}</strong></p>
          <p>Contexto: <strong>{plan.chosenContext} tokens</strong></p>
          <p>Ejecución: <strong>{plan.executionTier}</strong></p>
        </div>
        <p className="mt-3 text-xs text-slate-300">Ubicación de pesos: {plan.storageTier}. No implica que se puedan paginar tensores desde el navegador.</p>
        {plan.reasons.map((value) => <p key={value} className="mt-2 text-xs text-emerald-200">✓ {value}</p>)}
        {plan.warnings.map((value) => <p key={value} className="mt-1 text-xs leading-5 text-amber-200/80">• {value}</p>)}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggleAdaptive}
          className="rounded-xl border border-cyan-400/20 bg-cyan-950/30 px-3 py-2 text-xs font-bold text-cyan-100">
          <Zap className="mr-1 inline h-3.5 w-3.5" /> {tuning ? "Desactivar" : "Activar"} ajuste wllama para próximas cargas
        </button>
        <button type="button" onClick={() => void protectStorage()} disabled={pending}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" /> Solicitar persistencia</button>
        <button type="button" onClick={() => void refresh()} className="rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-200"><RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Recalibrar</button>
      </div>
      <p className="mt-3 text-xs text-slate-400">Ajustes con adaptador activo para el modelo elegido: contexto {tuningPreview.n_ctx}, batch {tuningPreview.n_batch}. Solo se aplicarán a nuevas cargas de GGUF del catálogo con wllama; no aceleran Bonsai 2 ni habilitan conexión con servidor.</p>
      {message ? <p className="mt-2 text-xs text-cyan-200">{message}</p> : null}
      <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500"><ShieldCheck className="h-4 w-4" /> Sin transferencias cloud automáticas; sin promoción ni ejecución de Bonsai 2. <a className="underline" href={BONSAI_DOCS} target="_blank" rel="noopener noreferrer">Ficha oficial PrismML</a>.</p>
    </section>
  );
}
