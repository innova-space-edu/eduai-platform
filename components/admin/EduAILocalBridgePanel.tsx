"use client";

import { useEffect, useState } from "react";
import {
  Cable,
  Cpu,
  Loader2,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import {
  evaluateEduAILocalBridgeModel,
  probeEduAILocalBridge,
  recommendEduAILocalBridgeCapacity,
  runEduAILocalBridgeChat,
  type EduAILocalBridgeModel,
} from "@/lib/ai/local/eduai-local-bridge";

const BASE_URL_KEY = "eduai-local-bridge-url-v1";
const MODEL_KEY = "eduai-local-bridge-model-v1";
const HARDWARE_PROFILE_KEY = "eduai-local-hardware-profile-v1";

function ms(value: number | null) {
  if (value === null) return "—";
  return value < 1000 ? Math.round(value) + " ms" : (value / 1000).toFixed(1) + " s";
}

export default function EduAILocalBridgePanel() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234/v1");
  const [token, setToken] = useState("");
  const [models, setModels] = useState<EduAILocalBridgeModel[]>([]);
  const [model, setModel] = useState("");
  const [probeMs, setProbeMs] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "probing" | "ready" | "generating" | "error">("idle");
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("Explica qué archivos de EDUAI deberías revisar para entender el Model Lab.");
  const [answer, setAnswer] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [tokens, setTokens] = useState<number | null>(null);
  const [tps, setTps] = useState<number | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [ramGB, setRamGB] = useState<number | null>(null);
  const [vramGB, setVramGB] = useState<number | null>(null);

  useEffect(() => {
    try {
      const savedUrl = window.localStorage.getItem(BASE_URL_KEY);
      const savedModel = window.localStorage.getItem(MODEL_KEY);
      if (savedUrl) setBaseUrl(savedUrl);
      if (savedModel) setModel(savedModel);
      const savedHardware = window.localStorage.getItem(HARDWARE_PROFILE_KEY);
      if (savedHardware) {
        const parsed = JSON.parse(savedHardware) as { ramGB?: unknown; vramGB?: unknown };
        setRamGB(typeof parsed.ramGB === "number" ? parsed.ramGB : null);
        setVramGB(typeof parsed.vramGB === "number" ? parsed.vramGB : null);
      }
    } catch {
      // Persistencia opcional.
    }
  }, []);

  async function probe() {
    setStatus("probing");
    setError("");
    setModels([]);
    try {
      const result = await probeEduAILocalBridge(baseUrl, token);
      setBaseUrl(result.baseUrl);
      setModels(result.models);
      setProbeMs(result.latencyMs);
      const nextModel =
        result.models.find((item) => item.id === model)?.id ||
        result.models[0]?.id ||
        "";
      setModel(nextModel);
      setStatus("ready");
      try {
        window.localStorage.setItem(BASE_URL_KEY, result.baseUrl);
        if (nextModel) window.localStorage.setItem(MODEL_KEY, nextModel);
      } catch {
        // Persistencia opcional.
      }
    } catch (probeError) {
      setStatus("error");
      setError(probeError instanceof Error ? probeError.message : "No se pudo detectar el servidor local.");
    }
  }

  async function run() {
    if (!model || status === "generating") return;
    setStatus("generating");
    setError("");
    setAnswer("");
    setSources([]);
    try {
      const result = await runEduAILocalBridgeChat({
        baseUrl,
        model,
        prompt,
        token,
        maxTokens: 512,
      });
      setAnswer(result.text);
      setLatencyMs(result.latencyMs);
      setTokens(result.completionTokens || null);
      setTps(result.tokensPerSecond);
      setSources(result.knowledgeSources);
      setStatus("ready");
    } catch (runError) {
      setStatus("error");
      setError(runError instanceof Error ? runError.message : "Falló la inferencia por Local Bridge.");
    }
  }

  const bridgeCapacity = recommendEduAILocalBridgeCapacity({
    memoryGB: ramGB,
    vramGB,
  });

  function saveHardwareProfile(nextRam: number | null, nextVram: number | null) {
    setRamGB(nextRam);
    setVramGB(nextVram);
    try {
      window.localStorage.setItem(
        HARDWARE_PROFILE_KEY,
        JSON.stringify({ ramGB: nextRam, vramGB: nextVram }),
      );
    } catch {
      // Persistencia opcional.
    }
  }

  function chooseModel(value: string) {
    setModel(value);
    try {
      window.localStorage.setItem(MODEL_KEY, value);
    } catch {
      // Persistencia opcional.
    }
  }

  return (
    <section className="overflow-hidden rounded-[30px] border border-blue-400/15 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_30%),linear-gradient(180deg,#07101f,#050814)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-blue-200">
            <Cable className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">EDUAI Local Bridge</p>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Modelos locales grandes desde la misma página</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Ruta opcional para PCs con más RAM/VRAM. EDUAI se conecta únicamente a un servidor OpenAI-compatible en loopback y puede usar modelos mayores que los prácticos dentro del navegador.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-400/10 bg-emerald-950/15 px-3 py-2 text-[10px] text-emerald-200">
          Solo localhost / 127.0.0.1
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              Servidor
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs normal-case tracking-normal text-white"
              />
            </label>
            <label className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              Token local opcional
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="No se guarda"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-white"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["LM Studio", "http://localhost:1234/v1"],
              ["Local :11434", "http://localhost:11434/v1"],
              ["llama.cpp :8080", "http://localhost:8080/v1"],
            ].map(([label, url]) => (
              <button key={url} type="button" onClick={() => setBaseUrl(url)} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-[10px] font-black text-slate-300">
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[0.7fr_0.7fr_1.6fr]">
            <label className="rounded-xl border border-white/8 bg-slate-950/35 p-3 text-[10px] text-slate-500">
              RAM
              <select
                value={ramGB ?? ""}
                onChange={(event) => saveHardwareProfile(event.target.value ? Number(event.target.value) : null, vramGB)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs font-black text-white"
              >
                <option value="">No declarada</option>
                {[8, 12, 16, 24, 32, 48, 64, 96].map((value) => <option key={value} value={value}>{value} GB</option>)}
              </select>
            </label>
            <label className="rounded-xl border border-white/8 bg-slate-950/35 p-3 text-[10px] text-slate-500">
              VRAM
              <select
                value={vramGB ?? ""}
                onChange={(event) => saveHardwareProfile(ramGB, event.target.value ? Number(event.target.value) : null)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs font-black text-white"
              >
                <option value="">No declarada</option>
                {[0, 2, 4, 6, 8, 12, 16, 24, 32, 48].map((value) => <option key={value} value={value}>{value} GB</option>)}
              </select>
            </label>
            <div className="rounded-xl border border-blue-400/10 bg-blue-950/15 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-300">Banda sugerida</p>
              <p className="mt-1 text-sm font-black text-white">{bridgeCapacity.label}</p>
              <p className="mt-1 text-[9px] leading-4 text-slate-500">{bridgeCapacity.detail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void probe()}
            disabled={status === "probing" || status === "generating"}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-950/30 px-4 py-2.5 text-xs font-black text-blue-100 disabled:opacity-40"
          >
            {status === "probing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Detectar modelos locales
          </button>

          {models.length ? (
            <div className="mt-4">
              <label className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                Modelo disponible
                <select
                  value={model}
                  onChange={(event) => chooseModel(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-white"
                >
                  {models.map((item) => {
                    const fit = evaluateEduAILocalBridgeModel(item.id, { memoryGB: ramGB, vramGB });
                    const suffix =
                      fit === "recommended" ? " · recomendado" :
                      fit === "possible" ? " · experimental" :
                      fit === "heavy" ? " · exigente" : "";
                    return <option key={item.id} value={item.id}>{item.id}{suffix}</option>;
                  })}
                </select>
              </label>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                <Server className="h-3.5 w-3.5" /> {models.length} modelo(s) · detección {ms(probeMs)}
              </div>
            </div>
          ) : null}

          {error ? <div className="mt-3 rounded-xl border border-red-400/20 bg-red-950/20 p-3 text-[10px] leading-5 text-red-200">{error}</div> : null}
        </div>

        <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-blue-200"><Cpu className="h-4 w-4" /><p className="text-sm font-black">Prueba Local Bridge</p></div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs leading-5 text-white"
          />
          <button
            type="button"
            onClick={() => void run()}
            disabled={!model || status === "generating"}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-950/30 px-4 py-2.5 text-xs font-black text-blue-100 disabled:opacity-35"
          >
            {status === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Ejecutar local
          </button>

          {answer ? (
            <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-950/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] font-black text-slate-500">
                <span className="text-emerald-300">RESPUESTA LOCAL</span>
                <span>{ms(latencyMs)}{tokens ? ` · ${tokens} tok` : ""}{tps ? ` · ${tps.toFixed(1)} tok/s` : ""}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{answer}</p>
              {sources.length ? <p className="mt-2 font-mono text-[8px] leading-4 text-slate-600">{sources.join(" · ")}</p> : null}
            </div>
          ) : null}

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/10 bg-amber-950/10 p-3 text-[9px] leading-4 text-amber-100/70">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            El token no se persiste. El Bridge rechaza hosts externos; una futura modalidad LAN deberá habilitarse explícitamente.
          </div>
        </div>
      </div>
    </section>
  );
}
