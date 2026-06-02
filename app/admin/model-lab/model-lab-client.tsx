"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Loader2,
  Lock,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ExperimentalModelPolicy } from "@/lib/ai/admin-model-policy";

type GenerateResponse = {
  imageUrl: string;
  modelId: string;
  modelLabel: string;
  providerModelId: string;
  requestId: string;
  seed: number | null;
  durationMs: number;
  width: number | null;
  height: number | null;
  safetyChecker: boolean;
};

type Props = {
  models: ExperimentalModelPolicy[];
};

const SIZE_OPTIONS = [
  { id: "square_hd", label: "Cuadrada HD" },
  { id: "landscape_4_3", label: "Horizontal 4:3" },
  { id: "landscape_16_9", label: "Horizontal 16:9" },
  { id: "portrait_4_3", label: "Vertical 4:3" },
  { id: "portrait_16_9", label: "Vertical 16:9" },
];

export default function ModelLabClient({ models }: Props) {
  const runnableModels = useMemo(() => models.filter((model) => model.executable && model.status === "ready"), [models]);
  const [modelId, setModelId] = useState(runnableModels[0]?.id || "");
  const [prompt, setPrompt] = useState("");
  const [imageSize, setImageSize] = useState("landscape_4_3");
  const [seed, setSeed] = useState("");
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);

  async function generateImage() {
    setError("");
    setResult(null);

    if (!modelId) {
      setError("No hay modelos ejecutables configurados.");
      return;
    }

    if (!prompt.trim()) {
      setError("Escribe un prompt antes de generar.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/model-lab/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          prompt,
          imageSize,
          seed: seed.trim() ? Number(seed) : undefined,
          enablePromptExpansion,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo generar la imagen.");
      setResult(data as GenerateResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setPrompt("");
    setSeed("");
    setError("");
    setResult(null);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-200">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black">Generación experimental</h2>
              <p className="text-sm text-slate-400">Ejecución privada con adaptadores permitidos y safety checker obligatorio.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-bold text-slate-200">
              Motor
              <select
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-violet-400/50"
              >
                {runnableModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-bold text-slate-200">
              Formato
              <select
                value={imageSize}
                onChange={(event) => setImageSize(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-violet-400/50"
              >
                {SIZE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block space-y-2 text-sm font-bold text-slate-200">
            Prompt de prueba
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={2500}
              rows={7}
              placeholder="Describe una imagen educativa, un afiche, una escena o una ilustración para comparar modelos..."
              className="w-full resize-y rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
            />
          </label>

          <div className="mt-4 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
            <label className="space-y-2 text-sm font-bold text-slate-200">
              Semilla opcional
              <input
                value={seed}
                onChange={(event) => setSeed(event.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="Aleatoria"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
              />
            </label>

            <label className="flex items-center gap-3 self-end rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={enablePromptExpansion}
                onChange={(event) => setEnablePromptExpansion(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-slate-900"
              />
              Expandir prompt cuando el motor lo admita
            </label>
          </div>

          {error && (
            <div className="mt-4 flex gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <p>{error}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generateImage}
              disabled={loading || !runnableModels.length}
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-500 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={17} /> : <Play size={17} />}
              {loading ? "Generando..." : "Generar imagen"}
            </button>
            <button
              type="button"
              onClick={clearForm}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
            >
              <RotateCcw size={16} /> Limpiar
            </button>
          </div>
        </div>

        <aside className="rounded-[28px] border border-emerald-400/20 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-3 text-emerald-100">
            <ShieldCheck size={22} />
            <h2 className="text-lg font-black">Controles activos</h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-emerald-50/80">
            <li>✓ Acceso validado contra <code>admin_emails</code>.</li>
            <li>✓ Clave <code>FAL_KEY</code> solo en backend.</li>
            <li>✓ Whitelist estricta de adapters ejecutables.</li>
            <li>✓ Safety checker forzado desde servidor.</li>
            <li>✓ Auditoría en Supabase con fallback a logs.</li>
            <li>✓ Interruptor global <code>ADMIN_MODEL_LAB_ENABLED</code>.</li>
          </ul>
        </aside>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <ImageIcon size={20} className="text-sky-300" />
          <h2 className="text-xl font-black">Resultado</h2>
        </div>

        {!result ? (
          <div className="mt-4 grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-center text-sm text-slate-500">
            La imagen aparecerá aquí después de ejecutar una prueba autorizada.
          </div>
        ) : (
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.imageUrl} alt="Resultado generado en Model Lab" className="h-auto w-full object-contain" />
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              <p><strong className="text-white">Modelo:</strong> {result.modelLabel}</p>
              <p><strong className="text-white">Adapter:</strong> {result.providerModelId}</p>
              <p><strong className="text-white">Duración:</strong> {(result.durationMs / 1000).toFixed(2)} s</p>
              <p><strong className="text-white">Semilla:</strong> {result.seed ?? "—"}</p>
              <p><strong className="text-white">Resolución:</strong> {result.width && result.height ? `${result.width} × ${result.height}` : "—"}</p>
              <p><strong className="text-white">Safety checker:</strong> {result.safetyChecker ? "Activo" : "—"}</p>
              <a
                href={result.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-2 font-black text-sky-100 hover:bg-sky-500/20"
              >
                <Download size={15} /> Abrir imagen
              </a>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Beaker size={20} className="text-amber-300" />
          <h2 className="text-xl font-black">Catálogo del laboratorio</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {models.map((model) => (
            <article key={model.id} className="rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{model.access}</p>
                  <h3 className="mt-2 text-lg font-black text-white">{model.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{model.description}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${
                  model.status === "ready"
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    : model.status === "blocked"
                      ? "border-red-400/20 bg-red-500/10 text-red-200"
                      : "border-amber-400/20 bg-amber-500/10 text-amber-200"
                }`}>
                  {model.status === "ready" ? "Ejecutable" : model.status === "blocked" ? "Bloqueado" : "Planificado"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {model.capabilities.map((capability) => (
                  <span key={capability} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{capability}</span>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3 text-xs leading-relaxed text-slate-400">
                {model.executable ? <CheckCircle2 className="mr-2 inline text-emerald-300" size={14} /> : <Lock className="mr-2 inline text-red-300" size={14} />}
                {model.notes}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
