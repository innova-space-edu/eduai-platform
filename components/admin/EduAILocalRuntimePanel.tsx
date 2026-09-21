"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrainCircuit,
  Cpu,
  Database,
  Download,
  Gauge,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  EDUAI_LOCAL_MODELS,
  DEFAULT_EDUAI_LOCAL_MODEL_ID,
  evaluateEduAILocalModel,
  getEduAILocalModel,
  recommendEduAILocalModel,
  type EduAIHardwareProfile,
  type EduAILocalRuntimeMode,
} from "@/lib/ai/local/eduai-local-models";
import {
  clearEduAILocalModelCache,
  loadEduAILocalModel,
  probeEduAILocalHardware,
  runEduAILocalChat,
  unloadEduAILocalModel,
  type EduAILocalHardware,
} from "@/lib/ai/local/eduai-local-runtime";

function mb(value: number | null) {
  if (value === null) return "—";
  if (value >= 1024) return (value / 1024).toFixed(1) + " GB";
  return Math.round(value) + " MB";
}

function ms(value: number | null) {
  if (value === null) return "—";
  return value < 1000 ? Math.round(value) + " ms" : (value / 1000).toFixed(1) + " s";
}

export default function EduAILocalRuntimePanel() {
  const [hardware, setHardware] = useState<EduAILocalHardware | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_EDUAI_LOCAL_MODEL_ID);
  const [mode, setMode] = useState<EduAILocalRuntimeMode>("auto");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "generating" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [multithread, setMultithread] = useState(false);
  const [prompt, setPrompt] = useState("Explica brevemente qué puede hacer EDUAI Local cuando no hay Internet.");
  const [answer, setAnswer] = useState("");
  const [answerMs, setAnswerMs] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [manualRamGB, setManualRamGB] = useState<number | null>(null);
  const [manualVramGB, setManualVramGB] = useState<number | null>(null);
  const mountedRef = useRef(true);

  async function calibrate(applyRecommendation = false) {
    setError("");
    try {
      const next = await probeEduAILocalHardware();
      if (!mountedRef.current) return;
      setHardware(next);
      if (applyRecommendation) setSelectedModelId(recommendEduAILocalModel({ memoryGB: next.memoryGB, vramGB: manualVramGB, webgpu: next.webgpu, cores: next.cores }));
    } catch (probeError) {
      setError(probeError instanceof Error ? probeError.message : "No se pudo medir el hardware.");
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void calibrate(true);
    const onlineHandler = () => void calibrate(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", onlineHandler);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", onlineHandler);
      void unloadEduAILocalModel();
    };
  }, []);

  const effectiveProfile = useMemo<EduAIHardwareProfile>(() => ({
    memoryGB: manualRamGB ?? hardware?.memoryGB ?? null,
    vramGB: manualVramGB,
    webgpu: hardware?.webgpu ?? false,
    cores: hardware?.cores ?? 1,
  }), [hardware, manualRamGB, manualVramGB]);
  const recommendedModelId = useMemo(() => recommendEduAILocalModel(effectiveProfile), [effectiveProfile]);
  const selected = useMemo(() => getEduAILocalModel(selectedModelId), [selectedModelId]);
  const recommended = getEduAILocalModel(recommendedModelId);
  const isReady = status === "ready" && loadedModelId === selectedModelId;

  function applyHardwareProfile(ramGB: number | null, vramGB: number | null) {
    setManualRamGB(ramGB);
    setManualVramGB(vramGB);
    const profile: EduAIHardwareProfile = {
      memoryGB: ramGB ?? hardware?.memoryGB ?? null,
      vramGB,
      webgpu: hardware?.webgpu ?? false,
      cores: hardware?.cores ?? 1,
    };
    setSelectedModelId(recommendEduAILocalModel(profile));
  }

  async function loadModel() {
    setStatus("loading");
    setProgress(0);
    setError("");
    setAnswer("");
    setAnswerMs(null);
    try {
      const result = await loadEduAILocalModel(selectedModelId, mode, setProgress);
      if (!mountedRef.current) return;
      setLoadedModelId(result.modelId);
      setLoadMs(result.loadMs);
      setMultithread(result.multithread);
      setStatus("ready");
      await calibrate();
    } catch (loadError) {
      if (!mountedRef.current) return;
      setLoadedModelId(null);
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el modelo.");
    }
  }

  async function runPrompt() {
    if (!isReady) return;
    setStatus("generating");
    setError("");
    try {
      const result = await runEduAILocalChat(prompt);
      if (!mountedRef.current) return;
      setAnswer(result.text);
      setAnswerMs(result.latencyMs);
      setStatus("ready");
    } catch (chatError) {
      if (!mountedRef.current) return;
      setStatus("ready");
      setError(chatError instanceof Error ? chatError.message : "La inferencia local falló.");
    }
  }

  async function releaseMemory() {
    await unloadEduAILocalModel();
    setLoadedModelId(null);
    setLoadMs(null);
    setAnswer("");
    setAnswerMs(null);
    setStatus("idle");
  }

  async function clearCache() {
    setError("");
    try {
      await clearEduAILocalModelCache();
      setLoadedModelId(null);
      setLoadMs(null);
      setAnswer("");
      setAnswerMs(null);
      setStatus("idle");
      await calibrate();
    } catch (cacheError) {
      setError(cacheError instanceof Error ? cacheError.message : "No se pudo borrar la caché.");
    }
  }

  const hardwareCards = [
    {
      label: "CPU",
      value: hardware ? hardware.cores + " threads" : "Midiendo…",
      detail: hardware?.multithreadReady ? "WASM multihilo disponible" : "WASM compatible; multihilo limitado",
      icon: Cpu,
    },
    {
      label: "RAM expuesta",
      value: hardware?.memoryGB ? "~" + hardware.memoryGB + " GB" : hardware ? "No expuesta" : "Midiendo…",
      detail: hardware ? "Tier " + hardware.tier : "Calibrando navegador",
      icon: Gauge,
    },
    {
      label: "Aceleración",
      value: hardware?.webgpu ? "WebGPU disponible" : hardware ? "CPU / WASM" : "Midiendo…",
      detail: mode === "cpu" ? "CPU forzada por el laboratorio" : "Auto: usa la mejor ruta disponible",
      icon: Sparkles,
    },
    {
      label: "Aislamiento",
      value: hardware?.crossOriginIsolated ? "COOP/COEP listo" : hardware ? "Sin aislamiento" : "Midiendo…",
      detail: hardware?.crossOriginIsolated ? "SharedArrayBuffer habilitable" : "Funcionará en single-thread cuando sea necesario",
      icon: ShieldCheck,
    },
    {
      label: "Caché navegador",
      value: hardware ? mb(hardware.storageUsageMB) : "Midiendo…",
      detail: hardware ? "Cuota estimada " + mb(hardware.storageQuotaMB) : "Storage API",
      icon: HardDrive,
    },
    {
      label: "Red",
      value: hardware?.online ? "Online" : hardware ? "Offline" : "Midiendo…",
      detail: hardware?.online ? "Puede descargar modelos faltantes" : "Solo modelos ya cacheados",
      icon: hardware?.online ? Wifi : WifiOff,
    },
  ];

  return (
    <section className="overflow-hidden rounded-[30px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_28%),linear-gradient(180deg,#07111f,#030914)] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.38)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-cyan-200">
            <BrainCircuit className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">EDUAI Local Runtime · wllama</p>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">IA ejecutándose dentro del notebook</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Laboratorio admin para descargar un GGUF, conservarlo en caché y ejecutar inferencia en el navegador.
            El modo Auto aprovecha WebGPU cuando existe y mantiene CPU/WASM como ruta de compatibilidad.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void calibrate()}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-xs font-black text-slate-300"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recalibrar
        </button>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {hardwareCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-white/10 bg-black/20 p-3.5">
              <div className="flex items-center gap-2 text-cyan-300">
                <Icon className="h-3.5 w-3.5" />
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
              </div>
              <p className="mt-2 text-sm font-black text-white">{card.value}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-600">{card.detail}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 rounded-[22px] border border-cyan-400/15 bg-cyan-950/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-cyan-100">Perfil de hardware</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">WebGPU se detecta automáticamente. La VRAM no puede medirse de forma fiable desde el navegador, por eso puedes declararla manualmente.</p>
          </div>
          <button type="button" onClick={() => applyHardwareProfile(null, null)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[10px] font-black text-slate-400">Auto</button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "8 GB · CPU", ram: 8, vram: 0 },
            { label: "8 GB · 2 GB VRAM", ram: 8, vram: 2 },
            { label: "8 GB · 4 GB VRAM", ram: 8, vram: 4 },
            { label: "16 GB · 6 GB VRAM", ram: 16, vram: 6 },
            { label: "16 GB · 8 GB VRAM", ram: 16, vram: 8 },
          ].map((profile) => (
            <button
              key={profile.label}
              type="button"
              onClick={() => applyHardwareProfile(profile.ram, profile.vram)}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[10px] font-black text-slate-300 hover:border-cyan-400/20"
            >
              {profile.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="rounded-xl border border-white/8 bg-black/20 p-3 text-[10px] text-slate-500">
            RAM real
            <select value={manualRamGB ?? ""} onChange={(event) => applyHardwareProfile(event.target.value ? Number(event.target.value) : null, manualVramGB)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs font-black text-white">
              <option value="">Auto (~{hardware?.memoryGB ?? "?"} GB)</option>
              {[4, 8, 12, 16, 24, 32, 64].map((value) => <option key={value} value={value}>{value} GB</option>)}
            </select>
          </label>
          <label className="rounded-xl border border-white/8 bg-black/20 p-3 text-[10px] text-slate-500">
            VRAM dedicada
            <select value={manualVramGB ?? ""} onChange={(event) => applyHardwareProfile(manualRamGB, event.target.value ? Number(event.target.value) : null)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs font-black text-white">
              <option value="">No declarada</option>
              {[0, 2, 4, 6, 8, 12, 16, 24].map((value) => <option key={value} value={value}>{value} GB</option>)}
            </select>
          </label>
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-950/15 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">Recomendación</p>
            <p className="mt-1.5 text-xs font-black text-white">{recommended.label}</p>
            <p className="mt-1 text-[9px] text-slate-500">RAM {effectiveProfile.memoryGB ?? "?"} GB · VRAM {effectiveProfile.vramGB ?? "?"} GB · {effectiveProfile.webgpu ? "WebGPU" : "CPU/WASM"}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-100">
        <strong>Selección sugerida:</strong> {recommended.label}. Puedes escoger un modelo más pesado; el laboratorio lo marcará como compatible, exigente o no recomendado para el perfil declarado.
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">Catálogo local</p>
              <p className="mt-1 text-[10px] text-slate-600">La descarga es manual y queda aislada al Model Lab.</p>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-slate-950/70 p-1 text-[10px] font-black">
              {(["auto", "cpu"] as EduAILocalRuntimeMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  disabled={status === "loading" || status === "generating"}
                  className={"rounded-lg px-3 py-1.5 " + (mode === item ? "bg-cyan-950/70 text-cyan-100" : "text-slate-500")}
                >
                  {item === "auto" ? "AUTO" : "CPU"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {EDUAI_LOCAL_MODELS.map((model) => {
              const selectedNow = selectedModelId === model.id;
              const fit = evaluateEduAILocalModel(model, effectiveProfile);
              const fitLabel = fit === "recommended" ? "Recomendado" : fit === "compatible" ? "Compatible" : fit === "heavy" ? "Exigente" : "No recomendado";
              const fitClass = fit === "recommended" ? "border-emerald-400/20 text-emerald-200 bg-emerald-950/25" : fit === "compatible" ? "border-cyan-400/15 text-cyan-200 bg-cyan-950/20" : fit === "heavy" ? "border-amber-400/15 text-amber-200 bg-amber-950/20" : "border-red-400/15 text-red-200 bg-red-950/20";
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModelId(model.id)}
                  disabled={status === "loading" || status === "generating"}
                  className={"w-full rounded-2xl border p-3 text-left transition " + (selectedNow ? "border-cyan-400/30 bg-cyan-950/25" : "border-white/8 bg-slate-950/40 hover:border-white/15")}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-black text-white">{model.label}</p>
                      <p className="mt-1 font-mono text-[9px] text-slate-600">{model.repo} · {model.file}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={"rounded-full border px-2 py-1 text-[9px] font-black " + fitClass}>{fitLabel}</span>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black text-slate-400">~{model.sizeMB} MB</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-slate-500">{model.description}</p>
                  <p className="mt-1 text-[9px] text-slate-600">Tier {model.tier} · RAM mín. {model.minimumMemoryGB} GB · recomendado {model.recommendedMemoryGB} GB{model.recommendedVramGB ? " · VRAM " + model.recommendedVramGB + " GB" : ""}</p>
                </button>
              );
            })}
          </div>

          {status === "loading" ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-black text-slate-400">
                <span>Descargando / cargando {selected.label}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: Math.round(progress * 100) + "%" }} />
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadModel()}
              disabled={status === "loading" || status === "generating"}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-950/35 px-4 py-2.5 text-xs font-black text-cyan-100 disabled:opacity-40"
            >
              {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {loadedModelId === selectedModelId ? "Recargar modelo" : "Descargar y cargar"}
            </button>
            <button
              type="button"
              onClick={() => void releaseMemory()}
              disabled={!loadedModelId}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-[10px] font-black text-slate-400 disabled:opacity-30"
            >
              Liberar RAM
            </button>
            <button
              type="button"
              onClick={() => void clearCache()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/15 bg-red-950/20 px-3 py-2.5 text-[10px] font-black text-red-200"
            >
              <Trash2 className="h-3.5 w-3.5" /> Borrar caché
            </button>
          </div>

          {loadedModelId ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-slate-950/45 p-2.5"><p className="text-[9px] text-slate-600">Carga</p><p className="mt-1 text-xs font-black text-white">{ms(loadMs)}</p></div>
              <div className="rounded-xl border border-white/5 bg-slate-950/45 p-2.5"><p className="text-[9px] text-slate-600">Modo</p><p className="mt-1 text-xs font-black text-white">{mode.toUpperCase()}</p></div>
              <div className="rounded-xl border border-white/5 bg-slate-950/45 p-2.5"><p className="text-[9px] text-slate-600">WASM threads</p><p className="mt-1 text-xs font-black text-white">{multithread ? "Multihilo" : "Single"}</p></div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <article className="rounded-[24px] border border-violet-400/15 bg-violet-950/10 p-4">
            <div className="flex items-center gap-2 text-violet-200"><Play className="h-4 w-4" /><p className="text-sm font-black">Consola local</p></div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/65 p-3 text-xs leading-5 text-slate-200 outline-none focus:border-violet-400/30"
            />
            <button
              type="button"
              onClick={() => void runPrompt()}
              disabled={!isReady}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-950/30 px-4 py-2.5 text-xs font-black text-violet-100 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {status === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Ejecutar solo en este notebook
            </button>
            {answer ? (
              <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-950/15 p-3">
                <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase text-emerald-300">Respuesta local</p><span className="text-[9px] font-black text-slate-500">{ms(answerMs)}</span></div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{answer}</p>
              </div>
            ) : null}
          </article>

          <article className="rounded-[24px] border border-fuchsia-400/15 bg-fuchsia-950/10 p-4">
            <div className="flex items-center gap-2 text-fuchsia-200"><Database className="h-4 w-4" /><p className="text-sm font-black">EDUAI Model Factory</p></div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              La IA propia se construirá con ajuste fino para comportamiento estable y un índice RAG del repositorio para conocer el EDUAI actual sin reentrenar por cada cambio.
            </p>
            <div className="mt-3 space-y-2">
              {[
                ["1", "Corpus EDUAI", "Script reproducible para extraer y fragmentar app, components, lib y documentación."],
                ["2", "Dataset de instrucciones", "Casos de routing, herramientas, estructura de páginas, errores y tareas de desarrollo."],
                ["3", "Fine-tuning", "LoRA/QLoRA fuera del notebook; el navegador se reserva para inferencia."],
                ["4", "GGUF + evaluación", "Cuantización Q4, benchmark en Model Lab y Production Gate antes de uso real."],
              ].map(([step, title, detail]) => (
                <div key={step} className="grid grid-cols-[28px_1fr] gap-2 rounded-xl border border-white/5 bg-black/20 p-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-fuchsia-950/40 text-[10px] font-black text-fuchsia-200">{step}</span>
                  <div><p className="text-[10px] font-black text-white">{title}</p><p className="mt-0.5 text-[9px] leading-4 text-slate-600">{detail}</p></div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/10 bg-amber-950/15 p-3 text-[9px] leading-4 text-amber-100/75">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              El corpus excluye secretos y no incorpora conversaciones, estudiantes ni datos personales por defecto.
            </div>
          </article>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-950/20 p-3 text-xs text-red-200">{error}</div> : null}
    </section>
  );
}
