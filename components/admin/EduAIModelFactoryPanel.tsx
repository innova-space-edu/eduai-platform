"use client";

import { useEffect, useState } from "react";
import {
  BrainCircuit,
  Database,
  FileCode2,
  Gauge,
  GraduationCap,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type FactoryPayload = {
  available: boolean;
  error?: string;
  manifest?: {
    schemaVersion?: number;
    generatedAt?: string;
    buildCommit?: string;
    filesScanned?: number;
    indexedFiles?: number;
    records?: number;
    skipped?: number;
    totalSourceBytes?: number;
    corpusBytes?: number;
    byExtension?: Record<string, number>;
    policy?: {
      repositoryOnly?: boolean;
      includesUserConversations?: boolean;
      includesStudentDataByDefault?: boolean;
      secretLikeLinesRedacted?: boolean;
    };
  };
  factory?: {
    baseModel?: string;
    runtimeArtifact?: string;
    trainingMethod?: string;
    knowledgeStrategy?: string;
    trainingLocation?: string;
    inferenceTarget?: string;
  };
  safeguards?: {
    adminOnly?: boolean;
    productionRouterEnabled?: boolean;
    studentDataIncluded?: boolean;
    conversationsIncluded?: boolean;
  };
};

function bytes(value?: number) {
  if (!value || value < 1) return "—";
  if (value >= 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(value / 1024) + " KB";
}

export default function EduAIModelFactoryPanel() {
  const [payload, setPayload] = useState<FactoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/ai-core/local-factory", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "No se pudo leer EDUAI Model Factory.");
      setPayload(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo leer EDUAI Model Factory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const manifest = payload?.manifest;
  const factory = payload?.factory;

  return (
    <section className="overflow-hidden rounded-[30px] border border-fuchsia-400/15 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.08),transparent_30%),linear-gradient(180deg,#10091c,#060913)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-fuchsia-200"><GraduationCap className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.2em]">EDUAI Model Factory</p></div>
          <h2 className="mt-2 text-2xl font-black text-white">Base reproducible para nuestra propia IA</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Cada build reconstruye un corpus saneado del repositorio. El código cambiante se mantiene como conocimiento RAG; el fine-tuning se reserva para comportamiento, routing, formato y herramientas estables.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-2.5 text-xs font-black text-slate-300 disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Actualizar estado
        </button>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-950/20 p-3 text-xs text-red-200">{error}</div> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Archivos indexados", manifest?.indexedFiles ?? null, "fuentes aceptadas", FileCode2],
          ["Chunks", manifest?.records ?? null, "unidades de conocimiento", Database],
          ["Fuente", bytes(manifest?.totalSourceBytes), "antes de fragmentar", Gauge],
          ["Corpus", bytes(manifest?.corpusBytes), "JSONL saneado", Database],
          ["Base", factory?.baseModel || "LFM2.5-350M", "modelo estudiante", BrainCircuit],
          ["Entrenamiento", factory?.trainingMethod || "LoRA / QLoRA", "fuera del notebook", GraduationCap],
        ].map(([label, value, detail, Icon]) => {
          const IconComponent = Icon as typeof BrainCircuit;
          return <article key={String(label)} className="rounded-2xl border border-white/10 bg-black/20 p-3.5"><div className="flex items-center gap-2"><IconComponent className="h-3.5 w-3.5 text-fuchsia-300" /><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p></div><p className="mt-2 truncate text-sm font-black text-white">{value ?? "—"}</p><p className="mt-1 text-[10px] text-slate-600">{detail}</p></article>;
        })}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        {[
          ["1 · Corpus", "app, components, lib y docs se regeneran en cada build."],
          ["2 · RAG", "El conocimiento del código se actualiza sin volver a entrenar los pesos."],
          ["3 · LoRA", "Entrenamos routing, herramientas, estilo EDUAI y respuestas estructuradas."],
          ["4 · GGUF", "Fusionamos, cuantizamos y validamos el modelo antes de publicarlo en el runtime local."],
        ].map(([title, detail]) => <div key={title} className="rounded-2xl border border-white/8 bg-slate-950/35 p-4"><p className="text-xs font-black text-fuchsia-100">{title}</p><p className="mt-2 text-[10px] leading-5 text-slate-500">{detail}</p></div>)}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-emerald-400/10 bg-emerald-950/15 p-4 text-[11px] leading-5 text-slate-400">
          <p className="font-black text-emerald-200">Estado del corpus</p>
          <p className="mt-1">{payload?.available ? "Disponible en este build" : "No disponible en este runtime"}{manifest?.buildCommit ? " · commit " + manifest.buildCommit.slice(0, 8) : ""}{manifest?.generatedAt ? " · " + new Date(manifest.generatedAt).toLocaleString("es-CL") : ""}.</p>
        </div>
        <div className="rounded-2xl border border-amber-400/10 bg-amber-950/15 p-4 text-[10px] leading-5 text-amber-100/75">
          <div className="flex items-center gap-2 font-black text-amber-200"><ShieldCheck className="h-4 w-4" /> Datos protegidos</div>
          <p className="mt-1">Sin conversaciones ni datos de estudiantes por defecto. Producción sigue bloqueada.</p>
        </div>
      </div>
    </section>
  );
}
