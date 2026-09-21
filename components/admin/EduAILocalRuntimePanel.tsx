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
import { validateEduAIGgufFiles } from "@/lib/ai/local/eduai-local-gguf";
import { EDUAI_BROWSER_QUALITY_CASES, runEduAILocalQualityGate, type EduAILocalQualityReport } from "@/lib/ai/local/eduai-local-quality";
import { saveEduAILocalCandidate } from "@/lib/ai/local/eduai-local-candidates";
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
  listEduAILocalCachedModels,
  loadEduAILocalGgufFiles,
  loadEduAILocalModel,
  probeEduAILocalHardware,
  removeEduAILocalCachedModel,
  requestEduAILocalPersistentStorage,
  runEduAILocalChat,
  unloadEduAILocalModel,
  type EduAILocalCachedModel,
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

const HARDWARE_PROFILE_KEY = "eduai-local-hardware-profile-v1";
const SELECTED_MODEL_KEY = "eduai-local-selected-model-v1";

export type EduAILocalRuntimePanelProps = {
  standalone?: boolean;
};

export default function EduAILocalRuntimePanel({ standalone = false }: EduAILocalRuntimePanelProps = {}) {
  const [hardware, setHardware] = useState<EduAILocalHardware | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_EDUAI_LOCAL_MODEL_ID);
  const [mode, setMode] = useState<EduAILocalRuntimeMode>("auto");
  const [useKnowledge, setUseKnowledge] = useState(!standalone);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "generating" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [multithread, setMultithread] = useState(false);
  const [prompt, setPrompt] = useState("Explica brevemente qué puede hacer EDUAI Local cuando no hay Internet.");
  const [answer, setAnswer] = useState("");
  const [answerMs, setAnswerMs] = useState<number | null>(null);
  const [answerTokens, setAnswerTokens] = useState<number | null>(null);
  const [answerTps, setAnswerTps] = useState<number | null>(null);
  const [benchmarking, setBenchmarking] = useState(false);
  const [qualityRunning, setQualityRunning] = useState(false);
  const [qualityProgress, setQualityProgress] = useState({ completed: 0, total: 0 });
  const [qualityReport, setQualityReport] = useState<EduAILocalQualityReport | null>(null);
  const [persistingStorage, setPersistingStorage] = useState(false);
  const [cachedModels, setCachedModels] = useState<EduAILocalCachedModel[]>([]);
  const [cacheBusyUrl, setCacheBusyUrl] = useState<string | null>(null);
  const [customFiles, setCustomFiles] = useState<File[]>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customInfo, setCustomInfo] = useState<{ totalBytes: number; shardCount: number; label: string } | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState<{ avgLatencyMs: number; avgTps: number | null; totalTokens: number } | null>(null);
  const [knowledgeSources, setKnowledgeSources] = useState<string[]>([]);
  const [fallbackModelId, setFallbackModelId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [manualRamGB, setManualRamGB] = useState<number | null>(null);
  const [manualVramGB, setManualVramGB] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const savedProfileLoadedRef = useRef(false);

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
    void refreshCachedModels();
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

  useEffect(() => {
    if (!hardware || savedProfileLoadedRef.current) return;
    savedProfileLoadedRef.current = true;

    let savedRam: number | null = null;
    let savedVram: number | null = null;
    try {
      const raw = window.localStorage.getItem(HARDWARE_PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { ramGB?: unknown; vramGB?: unknown };
        savedRam = typeof parsed.ramGB === "number" ? parsed.ramGB : null;
        savedVram = typeof parsed.vramGB === "number" ? parsed.vramGB : null;
      }
    } catch {
      savedRam = null;
      savedVram = null;
    }

    setManualRamGB(savedRam);
    setManualVramGB(savedVram);
    const profile: EduAIHardwareProfile = {
      memoryGB: savedRam ?? hardware.memoryGB,
      vramGB: savedVram,
      webgpu: hardware.webgpu,
      cores: hardware.cores,
    };
    const fallback = recommendEduAILocalModel(profile);

    try {
      const savedModelId = window.localStorage.getItem(SELECTED_MODEL_KEY);
      const savedModel = savedModelId ? getEduAILocalModel(savedModelId) : null;
      if (savedModel && savedModel.id === savedModelId && evaluateEduAILocalModel(savedModel, profile) !== "avoid") {
        setSelectedModelId(savedModelId);
      } else {
        setSelectedModelId(fallback);
      }
    } catch {
      setSelectedModelId(fallback);
    }
  }, [hardware]);

  const effectiveProfile = useMemo<EduAIHardwareProfile>(() => ({
    memoryGB: manualRamGB ?? hardware?.memoryGB ?? null,
    vramGB: manualVramGB,
    webgpu: hardware?.webgpu ?? false,
    cores: hardware?.cores ?? 1,
  }), [hardware, manualRamGB, manualVramGB]);
  const recommendedModelId = useMemo(() => recommendEduAILocalModel(effectiveProfile), [effectiveProfile]);
  const selected = useMemo(() => getEduAILocalModel(selectedModelId), [selectedModelId]);
  const recommended = getEduAILocalModel(recommendedModelId);
  const selectedCached = cachedModels.some(
    (item) => item.catalogModelId === selectedModelId && item.status === "valid",
  );
  const isReady = status === "ready" && Boolean(loadedModelId);

  function selectModel(modelId: string) {
    setSelectedModelId(modelId);
    try {
      window.localStorage.setItem(SELECTED_MODEL_KEY, modelId);
    } catch {
      // Persistencia opcional.
    }
  }

  function applyHardwareProfile(ramGB: number | null, vramGB: number | null) {
    setManualRamGB(ramGB);
    setManualVramGB(vramGB);
    try {
      if (ramGB === null && vramGB === null) {
        window.localStorage.removeItem(HARDWARE_PROFILE_KEY);
      } else {
        window.localStorage.setItem(HARDWARE_PROFILE_KEY, JSON.stringify({ ramGB, vramGB }));
      }
    } catch {
      // Persistencia opcional.
    }
    const profile: EduAIHardwareProfile = {
      memoryGB: ramGB ?? hardware?.memoryGB ?? null,
      vramGB,
      webgpu: hardware?.webgpu ?? false,
      cores: hardware?.cores ?? 1,
    };
    const modelId = recommendEduAILocalModel(profile);
    setSelectedModelId(modelId);
    try {
      window.localStorage.setItem(SELECTED_MODEL_KEY, modelId);
    } catch {
      // Persistencia opcional.
    }
  }

  async function refreshCachedModels() {
    try {
      setCachedModels(await listEduAILocalCachedModels());
    } catch {
      setCachedModels([]);
    }
  }

  async function removeCachedModel(url: string) {
    setCacheBusyUrl(url);
    setError("");
    try {
      await removeEduAILocalCachedModel(url);
      setLoadedModelId(null);
      setStatus("idle");
      await refreshCachedModels();
      await calibrate(false);
    } catch (cacheError) {
      setError(cacheError instanceof Error ? cacheError.message : "No se pudo borrar el modelo cacheado.");
    } finally {
      setCacheBusyUrl(null);
    }
  }

  async function protectLocalStorage() {
    setPersistingStorage(true);
    setError("");
    try {
      const result = await requestEduAILocalPersistentStorage();
      if (!result.supported) {
        setError("Este navegador no permite solicitar almacenamiento persistente.");
      } else if (!result.granted) {
        setError("El navegador no concedió almacenamiento persistente. EDUAI Local seguirá funcionando, pero la caché puede ser desalojada.");
      }
      await calibrate(false);
    } catch (storageError) {
      setError(storageError instanceof Error ? storageError.message : "No se pudo proteger la caché local.");
    } finally {
      setPersistingStorage(false);
    }
  }

  async function loadModel() {
    setStatus("loading");
    setLoadingLabel(selected.label);
    setProgress(0);
    setError("");
    setAnswer("");
    setAnswerMs(null);
    setAnswerTokens(null);
    setAnswerTps(null);
    setKnowledgeSources([]);
    setFallbackModelId(null);
    try {
      const result = await loadEduAILocalModel(selectedModelId, mode, setProgress);
      if (!mountedRef.current) return;
      setLoadedModelId(result.modelId);
      setLoadMs(result.loadMs);
      setMultithread(result.multithread);
      setStatus("ready");
      setLoadingLabel(null);
      await refreshCachedModels();
      await calibrate();
    } catch (loadError) {
      if (!mountedRef.current) return;
      setLoadedModelId(null);
      setLoadingLabel(null);
      setStatus("error");
      const fallback = [...EDUAI_LOCAL_MODELS]
        .filter((model) => model.role !== "router" && model.sizeMB < selected.sizeMB)
        .filter((model) => evaluateEduAILocalModel(model, effectiveProfile) !== "avoid")
        .sort((a, b) => b.sizeMB - a.sizeMB)[0];
      setFallbackModelId(fallback?.id || null);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el modelo.");
    }
  }

  function chooseCustomGguf(files: File[]) {
    setError("");
    if (!files.length) {
      setCustomFiles([]);
      setCustomInfo(null);
      return;
    }
    try {
      const selection = validateEduAIGgufFiles(files);
      setCustomFiles(selection.files);
      setCustomInfo({
        totalBytes: selection.totalBytes,
        shardCount: selection.shardCount,
        label: selection.label,
      });
      setCustomLabel((current) => current.trim() ? current : selection.label);
    } catch (selectionError) {
      setCustomFiles([]);
      setCustomInfo(null);
      setError(selectionError instanceof Error ? selectionError.message : "Selección GGUF inválida.");
    }
  }

  async function loadCustomCandidate() {
    if (!customFiles.length || !customInfo) return;
    setStatus("loading");
    setLoadingLabel(customLabel.trim() || customInfo.label);
    setProgress(0);
    setError("");
    setAnswer("");
    setKnowledgeSources([]);
    try {
      const result = await loadEduAILocalGgufFiles(
        customFiles,
        mode,
        customLabel.trim() || customInfo.label,
        setProgress,
      );
      if (!mountedRef.current) return;
      setLoadedModelId(result.modelId);
      setLoadMs(result.loadMs);
      setMultithread(result.multithread);
      setStatus("ready");
      setLoadingLabel(null);
    } catch (loadError) {
      if (!mountedRef.current) return;
      setLoadedModelId(null);
      setStatus("error");
      setLoadingLabel(null);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el GGUF local.");
    }
  }

  async function runPrompt() {
    if (!isReady) return;
    setStatus("generating");
    setError("");
    try {
      const result = await runEduAILocalChat(prompt, 256, { useKnowledge });
      if (!mountedRef.current) return;
      setAnswer(result.text);
      setAnswerMs(result.latencyMs);
      setAnswerTokens(result.completionTokens || null);
      setAnswerTps(result.tokensPerSecond);
      setKnowledgeSources(result.knowledgeSources);
      setStatus("ready");
    } catch (chatError) {
      if (!mountedRef.current) return;
      setStatus("ready");
      setError(chatError instanceof Error ? chatError.message : "La inferencia local falló.");
    }
  }

  function qualityThreshold() {
    if (!loadedModelId) return 80;
    if (loadedModelId.startsWith("custom:")) return 80;
    const model = getEduAILocalModel(loadedModelId);
    if (model.role === "nano") return 70;
    if (model.tier === "performance" || model.tier === "max-browser") return 85;
    return 80;
  }

  async function runQualityGate() {
    if (!loadedModelId || qualityRunning || status !== "ready") return;
    const activeId = loadedModelId;
    const threshold = qualityThreshold();
    setQualityRunning(true);
    setQualityProgress({ completed: 0, total: EDUAI_BROWSER_QUALITY_CASES.length });
    setQualityReport(null);
    setStatus("generating");
    setError("");
    try {
      const report = await runEduAILocalQualityGate(
        (qualityPrompt, maxTokens) => runEduAILocalChat(qualityPrompt, maxTokens, { useKnowledge: false }),
        threshold,
        (completed, total) => setQualityProgress({ completed, total }),
      );
      if (!mountedRef.current) return;
      setQualityReport(report);
      if (report.promotionGatePassed) {
        const custom = activeId.startsWith("custom:");
        const label = custom
          ? activeId.slice("custom:".length)
          : getEduAILocalModel(activeId).label;
        saveEduAILocalCandidate({
          modelId: activeId,
          label,
          source: custom ? "custom-gguf" : "catalog",
          qualityScore: report.score,
          qualityThreshold: report.threshold,
          criticalFailures: report.criticalFailures,
          promotionGatePassed: true,
          ramGB: effectiveProfile.memoryGB,
          vramGB: effectiveProfile.vramGB,
          webgpu: effectiveProfile.webgpu,
          createdAt: new Date().toISOString(),
        });
      }
      try {
        window.localStorage.setItem(
          `eduai-local-quality:${activeId}`,
          JSON.stringify({
            ...report,
            modelId: activeId,
            ramGB: effectiveProfile.memoryGB,
            vramGB: effectiveProfile.vramGB,
            webgpu: effectiveProfile.webgpu,
            createdAt: new Date().toISOString(),
          }),
        );
      } catch {
        // Persistencia opcional.
      }
    } catch (qualityError) {
      if (!mountedRef.current) return;
      setError(qualityError instanceof Error ? qualityError.message : "El Quality Gate local falló.");
    } finally {
      if (mountedRef.current) {
        setQualityRunning(false);
        setStatus("ready");
      }
    }
  }

  async function runBenchmark() {
    if (!isReady || benchmarking) return;
    setBenchmarking(true);
    setStatus("generating");
    setError("");
    try {
      const prompts = [
        "Resume en tres puntos qué debe hacer una IA local de EDUAI cuando no tiene Internet.",
        "Devuelve un JSON breve con las claves herramienta, accion y requiere_internet para una consulta que pide crear una evaluación.",
        "Explica en cuatro frases la diferencia entre fine-tuning y RAG en EDUAI.",
      ];
      const results = [];
      for (const benchmarkPrompt of prompts) {
        results.push(await runEduAILocalChat(benchmarkPrompt, 96, { useKnowledge: false }));
      }
      const totalTokens = results.reduce((sum, item) => sum + item.completionTokens, 0);
      const avgLatencyMs = results.reduce((sum, item) => sum + item.latencyMs, 0) / results.length;
      const tpsValues = results
        .map((item) => item.tokensPerSecond)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const avgTps = tpsValues.length
        ? tpsValues.reduce((sum, value) => sum + value, 0) / tpsValues.length
        : null;
      const nextBenchmark = { avgLatencyMs, avgTps, totalTokens };
      setBenchmark(nextBenchmark);
      try {
        window.localStorage.setItem(
          `eduai-local-benchmark:${loadedModelId || selectedModelId}`,
          JSON.stringify({
            ...nextBenchmark,
            modelId: loadedModelId || selectedModelId,
            ramGB: effectiveProfile.memoryGB,
            vramGB: effectiveProfile.vramGB,
            webgpu: effectiveProfile.webgpu,
            createdAt: new Date().toISOString(),
          }),
        );
      } catch {
        // Persistencia opcional.
      }
    } catch (benchmarkError) {
      setError(benchmarkError instanceof Error ? benchmarkError.message : "El benchmark local falló.");
    } finally {
      setBenchmarking(false);
      if (mountedRef.current) setStatus("ready");
    }
  }

  async function releaseMemory() {
    await unloadEduAILocalModel();
    setLoadedModelId(null);
    setLoadMs(null);
    setAnswer("");
    setAnswerMs(null);
    setAnswerTokens(null);
    setAnswerTps(null);
    setBenchmark(null);
    setQualityReport(null);
    setQualityProgress({ completed: 0, total: 0 });
    setKnowledgeSources([]);
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
      setAnswerTokens(null);
      setAnswerTps(null);
      setBenchmark(null);
      setKnowledgeSources([]);
      setStatus("idle");
      await refreshCachedModels();
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
      label: "GPU / aceleración",
      value: hardware?.webgpu ? "WebGPU disponible" : hardware ? "CPU / WASM" : "Midiendo…",
      detail: mode === "cpu" ? "CPU forzada por el laboratorio" : hardware?.gpuLabel || "Auto: usa la mejor ruta disponible",
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
      value: hardware?.persistentStorage
        ? "Persistente"
        : hardware
          ? mb(hardware.storageUsageMB)
          : "Midiendo…",
      detail: hardware
        ? hardware.persistentStorage
          ? "El navegador protegerá mejor modelos y Knowledge Pack"
          : "Uso " + mb(hardware.storageUsageMB) + " · cuota " + mb(hardware.storageQuotaMB)
        : "Storage API",
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
        <div>
          <p className="text-xs font-black text-white">Persistencia offline</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            {hardware?.persistentStorage
              ? "Concedida. El navegador intentará conservar modelos y Knowledge Pack incluso bajo presión de almacenamiento."
              : "Opcional: solicita al navegador que la caché local de EDUAI sea menos susceptible a eliminación automática."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void protectLocalStorage()}
          disabled={persistingStorage || Boolean(hardware?.persistentStorage)}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-950/20 px-3 py-2.5 text-[10px] font-black text-emerald-100 disabled:opacity-40"
        >
          {persistingStorage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
          {hardware?.persistentStorage ? "Caché protegida" : "Proteger caché local"}
        </button>
      </div>

      <div className="mt-4 rounded-[22px] border border-cyan-400/15 bg-cyan-950/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-cyan-100">Perfil de hardware</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">WebGPU se detecta automáticamente. La VRAM no puede medirse de forma fiable desde el navegador, por eso puedes declararla manualmente.</p>
          </div>
          <button type="button" onClick={() => applyHardwareProfile(null, null)} disabled={status === "generating" || benchmarking} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[10px] font-black text-slate-400">Auto</button>
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
              disabled={status === "generating" || benchmarking}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[10px] font-black text-slate-300 hover:border-cyan-400/20"
            >
              {profile.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="rounded-xl border border-white/8 bg-black/20 p-3 text-[10px] text-slate-500">
            RAM real
            <select value={manualRamGB ?? ""} disabled={status === "generating" || benchmarking} onChange={(event) => applyHardwareProfile(event.target.value ? Number(event.target.value) : null, manualVramGB)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs font-black text-white">
              <option value="">Auto (~{hardware?.memoryGB ?? "?"} GB)</option>
              {[4, 8, 12, 16, 24, 32, 64].map((value) => <option key={value} value={value}>{value} GB</option>)}
            </select>
          </label>
          <label className="rounded-xl border border-white/8 bg-black/20 p-3 text-[10px] text-slate-500">
            VRAM dedicada
            <select value={manualVramGB ?? ""} disabled={status === "generating" || benchmarking} onChange={(event) => applyHardwareProfile(manualRamGB, event.target.value ? Number(event.target.value) : null)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs font-black text-white">
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
            <div className="flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                onClick={() => setUseKnowledge((value) => !value)}
                disabled={status === "loading" || status === "generating"}
                className={"rounded-xl border px-3 py-2 text-[9px] font-black " + (useKnowledge ? "border-fuchsia-400/20 bg-fuchsia-950/25 text-fuchsia-100" : "border-white/10 bg-slate-950/55 text-slate-500")}
                title={standalone ? "El modo offline abre con RAG apagado. Actívalo solo si quieres usar el Knowledge Pack técnico guardado en este navegador." : "Activa o desactiva el Knowledge Pack durante el chat normal."}
              >
                RAG {useKnowledge ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {EDUAI_LOCAL_MODELS.map((model) => {
              const selectedNow = selectedModelId === model.id;
              const fit = evaluateEduAILocalModel(model, effectiveProfile);
              const fitLabel = fit === "recommended" ? "Recomendado" : fit === "compatible" ? "Compatible" : fit === "heavy" ? "Exigente" : "No recomendado";
              const fitClass = fit === "recommended" ? "border-emerald-400/20 text-emerald-200 bg-emerald-950/25" : fit === "compatible" ? "border-cyan-400/15 text-cyan-200 bg-cyan-950/20" : fit === "heavy" ? "border-amber-400/15 text-amber-200 bg-amber-950/20" : "border-red-400/15 text-red-200 bg-red-950/20";
              const cached = cachedModels.some(
                (item) => item.catalogModelId === model.id && item.status === "valid",
              );
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => selectModel(model.id)}
                  disabled={status === "loading" || status === "generating"}
                  className={"w-full rounded-2xl border p-3 text-left transition " + (selectedNow ? "border-cyan-400/30 bg-cyan-950/25" : "border-white/8 bg-slate-950/40 hover:border-white/15")}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-black text-white">{model.label}</p>
                      <p className="mt-1 font-mono text-[9px] text-slate-600">{model.repo} · {model.file}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {cached ? <span className="rounded-full border border-emerald-400/15 bg-emerald-950/20 px-2 py-1 text-[9px] font-black text-emerald-200">Offline</span> : null}
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

          <div className="mt-4 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-950/10 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-200">Probar GGUF propio</p>
                <p className="mt-1 text-[9px] leading-4 text-slate-500">Abre un GGUF exportado de EDUAI directamente desde este PC. Si está fragmentado, selecciona todos los shards a la vez.</p>
              </div>
              {customInfo ? <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black text-slate-400">{customInfo.shardCount} archivo(s) · {(customInfo.totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB</span> : null}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_0.8fr_auto]">
              <input
                type="file"
                accept=".gguf"
                multiple
                onChange={(event) => chooseCustomGguf(Array.from(event.target.files || []))}
                disabled={status === "loading" || status === "generating"}
                className="block w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-[10px] text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-950/50 file:px-2 file:py-1 file:text-[9px] file:font-black file:text-fuchsia-100"
              />
              <input
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Nombre del candidato"
                disabled={status === "loading" || status === "generating"}
                className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-[10px] text-white outline-none focus:border-fuchsia-400/25"
              />
              <button
                type="button"
                onClick={() => void loadCustomCandidate()}
                disabled={!customFiles.length || status === "loading" || status === "generating"}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-950/30 px-3 py-2 text-[10px] font-black text-fuchsia-100 disabled:opacity-35"
              >
                <Play className="h-3.5 w-3.5" /> Cargar candidato
              </button>
            </div>
          </div>

          {status === "loading" ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-black text-slate-400">
                <span>Cargando {loadingLabel || selected.label}</span>
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
              disabled={status === "loading" || status === "generating" || (hardware?.online === false && !selectedCached)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-950/35 px-4 py-2.5 text-xs font-black text-cyan-100 disabled:opacity-40"
            >
              {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {hardware?.online === false && !selectedCached
                ? "No cacheado para offline"
                : loadedModelId === selectedModelId
                  ? "Recargar modelo"
                  : selectedCached
                    ? "Cargar desde caché"
                    : "Descargar y cargar"}
            </button>
            <button
              type="button"
              onClick={() => void releaseMemory()}
              disabled={!loadedModelId || status === "generating" || benchmarking}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-[10px] font-black text-slate-400 disabled:opacity-30"
            >
              Liberar RAM
            </button>
            <button
              type="button"
              onClick={() => void clearCache()}
              disabled={status === "generating" || benchmarking}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/15 bg-red-950/20 px-3 py-2.5 text-[10px] font-black text-red-200"
            >
              <Trash2 className="h-3.5 w-3.5" /> Borrar caché
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/35 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Modelos cacheados</p>
                <p className="mt-1 text-[9px] text-slate-600">
                  {cachedModels.length
                    ? `${cachedModels.length} modelo(s) · ${(cachedModels.reduce((sum, item) => sum + item.sizeMB, 0) / 1024).toFixed(2)} GB`
                    : "Todavía no hay modelos GGUF guardados en este navegador."}
                </p>
              </div>
              <button type="button" onClick={() => void refreshCachedModels()} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] font-black text-slate-400">
                Actualizar
              </button>
            </div>
            {cachedModels.length ? (
              <div className="mt-2 space-y-1.5">
                {cachedModels.map((cached) => (
                  <div key={cached.url} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-black text-slate-200">{cached.label}</p>
                      <p className="mt-0.5 text-[8px] text-slate-600">
                        {(cached.sizeMB / 1024).toFixed(2)} GB · {cached.status}{cached.catalogModelId ? " · catálogo EDUAI" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeCachedModel(cached.url)}
                      disabled={Boolean(cacheBusyUrl) || status === "generating" || benchmarking}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-400/10 bg-red-950/15 px-2 py-1.5 text-[8px] font-black text-red-200 disabled:opacity-35"
                    >
                      {cacheBusyUrl === cached.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Borrar
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {loadedModelId ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-white/5 bg-slate-950/45 p-2.5"><p className="text-[9px] text-slate-600">Activo</p><p className="mt-1 truncate text-[10px] font-black text-white">{loadedModelId}</p></div>
              <div className="rounded-xl border border-white/5 bg-slate-950/45 p-2.5"><p className="text-[9px] text-slate-600">Carga</p><p className="mt-1 text-xs font-black text-white">{ms(loadMs)}</p></div>
              <div className="rounded-xl border border-white/5 bg-slate-950/45 p-2.5"><p className="text-[9px] text-slate-600">Ruta solicitada</p><p className="mt-1 text-xs font-black text-white">{mode === "cpu" ? "CPU/WASM" : hardware?.webgpu ? "WebGPU Auto" : "CPU/WASM"}</p></div>
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
            <button
              type="button"
              onClick={() => void runBenchmark()}
              disabled={!isReady || benchmarking}
              className="ml-2 mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-950/25 px-4 py-2.5 text-xs font-black text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {benchmarking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
              Benchmark rápido
            </button>
            {benchmark ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/5 bg-slate-950/45 p-2.5"><p className="text-[9px] text-slate-600">Promedio</p><p className="mt-1 text-xs font-black text-white">{ms(benchmark.avgLatencyMs)}</p></div>
                <div className="rounded-xl border border-white/5 bg-slate-950/45 p-2.5"><p className="text-[9px] text-slate-600">Velocidad</p><p className="mt-1 text-xs font-black text-white">{benchmark.avgTps ? benchmark.avgTps.toFixed(1) + " tok/s" : "—"}</p></div>
                <div className="rounded-xl border border-white/5 bg-slate-950/45 p-2.5"><p className="text-[9px] text-slate-600">Tokens</p><p className="mt-1 text-xs font-black text-white">{benchmark.totalTokens}</p></div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void runQualityGate()}
              disabled={!isReady || qualityRunning || benchmarking}
              className="ml-2 mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-950/25 px-4 py-2.5 text-xs font-black text-emerald-100 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {qualityRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {qualityRunning
                ? `Quality Gate ${qualityProgress.completed}/${qualityProgress.total || EDUAI_BROWSER_QUALITY_CASES.length}`
                : "Ejecutar Quality Gate"}
            </button>
            {qualityReport ? (
              <div className={"mt-3 rounded-2xl border p-3 " + (qualityReport.promotionGatePassed ? "border-emerald-400/20 bg-emerald-950/15" : "border-amber-400/20 bg-amber-950/15")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Quality Gate</p>
                    <p className="mt-1 text-lg font-black text-white">{qualityReport.score}% · {qualityReport.passed}/{qualityReport.total}</p>
                  </div>
                  <span className={"rounded-full border px-3 py-1 text-[9px] font-black " + (qualityReport.promotionGatePassed ? "border-emerald-400/20 text-emerald-200" : "border-amber-400/20 text-amber-200")}>
                    {qualityReport.promotionGatePassed ? "Aprobado · registrado" : "No promocionar"}
                  </span>
                </div>
                <p className="mt-2 text-[9px] leading-4 text-slate-500">
                  Umbral {qualityReport.threshold}% · fallos críticos: {qualityReport.criticalFailures.length ? qualityReport.criticalFailures.join(", ") : "ninguno"}.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {qualityReport.results.map((item) => (
                    <span key={item.id} className={"rounded-lg border px-2 py-1 text-[8px] font-black " + (item.passed ? "border-emerald-400/10 text-emerald-300" : "border-red-400/15 text-red-300")}>
                      {item.passed ? "✓" : "×"} {item.id}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {answer ? (
              <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-950/15 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase text-emerald-300">Respuesta local</p>
                  <div className="flex items-center gap-2 text-[9px] font-black text-slate-500">
                    <span>{ms(answerMs)}</span>
                    {answerTokens ? <span>{answerTokens} tok</span> : null}
                    {answerTps ? <span>{answerTps.toFixed(1)} tok/s</span> : null}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{answer}</p>
                {knowledgeSources.length ? (
                  <div className="mt-3 border-t border-emerald-400/10 pt-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">Contexto local usado</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {knowledgeSources.map((source) => (
                        <span key={source} className="rounded-lg border border-white/8 bg-black/20 px-2 py-1 font-mono text-[8px] text-slate-500">{source}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
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

      {error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-950/20 p-3 text-xs text-red-200">
          <span>{error}</span>
          {fallbackModelId ? (
            <button type="button" onClick={() => { selectModel(fallbackModelId); setError(""); setStatus("idle"); }} className="rounded-xl border border-amber-300/20 bg-amber-950/30 px-3 py-2 text-[10px] font-black text-amber-100">
              Probar fallback: {getEduAILocalModel(fallbackModelId).label}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
