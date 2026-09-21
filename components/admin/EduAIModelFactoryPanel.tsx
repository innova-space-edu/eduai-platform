"use client";

import { useEffect, useState } from "react";
import {
  BrainCircuit,
  Database,
  Download,
  FileCode2,
  Gauge,
  GraduationCap,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { clearEduAILocalCandidates, readEduAILocalCandidates, type EduAILocalCandidate } from "@/lib/ai/local/eduai-local-candidates";
import {
  clearEduAILocalKnowledgePack,
  getEduAILocalKnowledgeState,
  installEduAILocalKnowledgePack,
  type EduAIKnowledgeInstallProgress,
  type EduAIKnowledgeState,
} from "@/lib/ai/local/eduai-local-rag";

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
    knowledgePackBytes?: number;
    knowledgePackShards?: number;
    symbols?: { files?: number; total?: number; records?: number };
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
    evaluationStrategy?: string;
    promotionThresholds?: Record<string, number>;
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
  const [knowledge, setKnowledge] = useState<EduAIKnowledgeState | null>(null);
  const [knowledgeBusy, setKnowledgeBusy] = useState<"index" | "download" | "store" | "clear" | null>(null);
  const [knowledgeProgress, setKnowledgeProgress] = useState<EduAIKnowledgeInstallProgress | null>(null);
  const [candidates, setCandidates] = useState<EduAILocalCandidate[]>([]);
  const [candidateBusy, setCandidateBusy] = useState<string | null>(null);
  const [candidateMessage, setCandidateMessage] = useState("");
  const [sentCandidates, setSentCandidates] = useState<string[]>([]);

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

  function refreshCandidates() {
    setCandidates(readEduAILocalCandidates());
  }

  async function submitLocalCandidate(candidate: EduAILocalCandidate) {
    setCandidateBusy(candidate.modelId);
    setCandidateMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/ai-core/model-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_local_candidate",
          model: candidate.modelId,
          label: candidate.label,
          source: candidate.source,
          qualityScore: candidate.qualityScore,
          qualityThreshold: candidate.qualityThreshold,
          ramGB: candidate.ramGB,
          vramGB: candidate.vramGB,
          webgpu: candidate.webgpu,
          validatedAt: candidate.createdAt,
          promotionGatePassed: candidate.promotionGatePassed,
          criticalFailures: candidate.criticalFailures,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "No se pudo enviar el candidato a Model Candidate Lab.");
      setSentCandidates((current) =>
        current.includes(candidate.modelId) ? current : [...current, candidate.modelId],
      );
      setCandidateMessage(`${candidate.label} quedó registrado como discovered/experimental en Model Candidate Lab.`);
      window.dispatchEvent(new CustomEvent("eduai-model-candidates-changed"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo enviar el candidato.");
    } finally {
      setCandidateBusy(null);
    }
  }

  async function refreshKnowledge() {
    try {
      setKnowledge(await getEduAILocalKnowledgeState());
    } catch {
      setKnowledge(null);
    }
  }

  async function installKnowledge() {
    setError("");
    try {
      const state = await installEduAILocalKnowledgePack((progress) => { setKnowledgeBusy(progress.stage); setKnowledgeProgress(progress); });
      setKnowledge(state);
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : "No se pudo instalar el Knowledge Pack.");
    } finally {
      setKnowledgeBusy(null);
      setKnowledgeProgress(null);
    }
  }

  async function clearKnowledge() {
    setKnowledgeBusy("clear");
    setError("");
    try {
      await clearEduAILocalKnowledgePack();
      await refreshKnowledge();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "No se pudo borrar el Knowledge Pack.");
    } finally {
      setKnowledgeBusy(null);
    }
  }

  useEffect(() => {
    void load();
    void refreshKnowledge();
    refreshCandidates();
    const handler = () => refreshCandidates();
    window.addEventListener("eduai-local-candidates-changed", handler);
    return () => window.removeEventListener("eduai-local-candidates-changed", handler);
  }, []);

  const manifest = payload?.manifest;
  const factory = payload?.factory;
  const knowledgeStale = Boolean(
    knowledge?.installed &&
    knowledge.buildCommit &&
    manifest?.buildCommit &&
    knowledge.buildCommit !== manifest.buildCommit,
  );

  const metrics = [
    { label: "Archivos indexados", value: manifest?.indexedFiles ?? null, detail: "fuentes aceptadas", Icon: FileCode2 },
    { label: "Chunks", value: manifest?.records ?? null, detail: "unidades de conocimiento", Icon: Database },
    { label: "Símbolos", value: manifest?.symbols?.total ?? null, detail: `${manifest?.symbols?.files ?? 0} archivos con índice`, Icon: FileCode2 },
    { label: "Fuente", value: bytes(manifest?.totalSourceBytes), detail: "antes de fragmentar", Icon: Gauge },
    { label: "Corpus", value: bytes(manifest?.corpusBytes), detail: "JSONL saneado", Icon: Database },
    { label: "Knowledge Pack", value: bytes(manifest?.knowledgePackBytes), detail: "RAG local cacheable", Icon: Database },
    { label: "Base", value: factory?.baseModel || "LFM2.5-350M", detail: "modelo estudiante", Icon: BrainCircuit },
    { label: "Entrenamiento", value: factory?.trainingMethod || "LoRA / QLoRA", detail: "fuera del notebook", Icon: GraduationCap },
  ];

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
      {candidateMessage ? <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-950/15 p-3 text-xs text-emerald-100">{candidateMessage}</div> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
        {metrics.map(({ label, value, detail, Icon }) => (
          <article key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3.5">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-fuchsia-300" />
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
            </div>
            <p className="mt-2 truncate text-sm font-black text-white">{value ?? "—"}</p>
            <p className="mt-1 text-[10px] text-slate-600">{detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-[22px] border border-cyan-400/15 bg-cyan-950/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-cyan-200"><Database className="h-4 w-4" /><p className="text-xs font-black">EDUAI Knowledge Pack local</p></div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">Guarda el conocimiento saneado del repositorio en IndexedDB, incluido un índice de símbolos con funciones, clases, exports, handlers de API y objetos SQL. Una vez instalado, el chat local puede recuperar código y documentación aunque la conexión se pierda durante la sesión.</p>
            <p className="mt-2 text-[10px] text-slate-600">
              Estado: {knowledge?.installed ? `${knowledge.records} chunks · ${bytes(knowledge.sizeBytes)} · commit ${knowledge.buildCommit?.slice(0, 8) || "local"}` : "no instalado en este navegador"}.
              {manifest?.knowledgePackShards ? ` Servidor: ${manifest.knowledgePackShards} shards.` : ""}
              {knowledgeStale ? " Hay una versión más nueva disponible." : knowledge?.installed ? " Pack actualizado." : ""}
            </p>
            {knowledgeProgress && knowledgeBusy !== "clear" ? (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[9px] font-black text-slate-500">
                  <span>{knowledgeBusy === "index" ? "Leyendo índice" : knowledgeBusy === "store" ? "Guardando en IndexedDB" : "Descargando shards"}</span>
                  <span>{knowledgeProgress.totalShards ? Math.round((knowledgeProgress.completedShards / knowledgeProgress.totalShards) * 100) + "%" : "…"}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-900">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: knowledgeProgress.totalShards ? Math.max(3, Math.round((knowledgeProgress.completedShards / knowledgeProgress.totalShards) * 100)) + "%" : "3%" }} />
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void installKnowledge()} disabled={Boolean(knowledgeBusy) || !payload?.available} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-950/30 px-4 py-2.5 text-xs font-black text-cyan-100 disabled:opacity-40">
              {knowledgeBusy === "index" || knowledgeBusy === "download" || knowledgeBusy === "store" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {knowledgeBusy === "index" ? "Preparando…" : knowledgeBusy === "download" ? "Descargando…" : knowledgeBusy === "store" ? "Guardando…" : knowledgeStale ? "Actualizar ahora" : knowledge?.installed ? "Reinstalar pack" : "Instalar pack"}
            </button>
            <button type="button" onClick={() => void clearKnowledge()} disabled={!knowledge?.installed || Boolean(knowledgeBusy)} className="inline-flex items-center gap-2 rounded-xl border border-red-400/15 bg-red-950/20 px-3 py-2.5 text-[10px] font-black text-red-200 disabled:opacity-30">
              <Trash2 className="h-3.5 w-3.5" /> Borrar local
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        {[
          ["1 · Corpus", "App, componentes, librerías, scripts, Supabase, datos, workflows y configuración se regeneran en cada build."],
          ["2 · RAG", "El conocimiento del código se actualiza sin volver a entrenar los pesos."],
          ["3 · LoRA", "Entrenamos routing, herramientas, estilo EDUAI y respuestas estructuradas."],
          ["4 · GGUF", "Fusionamos, cuantizamos y validamos el modelo antes de publicarlo en el runtime local."],
        ].map(([title, detail]) => <div key={title} className="rounded-2xl border border-white/8 bg-slate-950/35 p-4"><p className="text-xs font-black text-fuchsia-100">{title}</p><p className="mt-2 text-[10px] leading-5 text-slate-500">{detail}</p></div>)}
      </div>

      <div className="mt-4 rounded-[22px] border border-violet-400/15 bg-violet-950/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black text-violet-200">Quality Gate de EDUAI Local</p>
            <p className="mt-2 text-[10px] leading-5 text-slate-500">
              {factory?.evaluationStrategy || "Suite reproducible con casos críticos y puntuación mínima por perfil."}
              Un candidato no se promueve si falla un caso crítico aunque supere el porcentaje global.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["Nano", factory?.promotionThresholds?.["eduai-nano"] ?? 70],
              ["Lite", factory?.promotionThresholds?.["eduai-lite"] ?? 80],
              ["Performance", factory?.promotionThresholds?.["eduai-performance"] ?? 85],
            ].map(([label, threshold]) => (
              <div key={String(label)} className="rounded-xl border border-violet-400/10 bg-slate-950/45 px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-black text-violet-100">≥ {threshold}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-emerald-400/15 bg-emerald-950/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-emerald-200">Candidatos aprobados en este navegador</p>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">
              Solo aparecen modelos que superaron su Quality Gate sin fallos críticos.
            </p>
          </div>
          {candidates.length ? (
            <button
              type="button"
              onClick={() => {
                clearEduAILocalCandidates();
                refreshCandidates();
              }}
              className="rounded-xl border border-red-400/10 bg-red-950/15 px-3 py-2 text-[9px] font-black text-red-200"
            >
              Limpiar registro
            </button>
          ) : null}
        </div>
        {candidates.length ? (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {candidates.slice(0, 8).map((candidate) => (
              <div key={candidate.modelId} className="rounded-xl border border-white/8 bg-slate-950/45 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="truncate text-[10px] font-black text-white">{candidate.label}</p>
                  <span className="rounded-full border border-emerald-400/15 px-2 py-1 text-[8px] font-black text-emerald-200">{candidate.qualityScore}%</span>
                </div>
                <p className="mt-1 text-[8px] leading-4 text-slate-600">
                  {candidate.source === "custom-gguf" ? "GGUF propio" : "Catálogo"} · umbral {candidate.qualityThreshold}% · RAM {candidate.ramGB ?? "?"} GB · VRAM {candidate.vramGB ?? "?"} GB · {candidate.webgpu ? "WebGPU" : "CPU/WASM"}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[8px] text-slate-700">{new Date(candidate.createdAt).toLocaleString("es-CL")}</p>
                  <button
                    type="button"
                    onClick={() => void submitLocalCandidate(candidate)}
                    disabled={Boolean(candidateBusy) || sentCandidates.includes(candidate.modelId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/15 bg-cyan-950/20 px-2 py-1.5 text-[8px] font-black text-cyan-100 disabled:opacity-40"
                  >
                    {candidateBusy === candidate.modelId ? <Loader2 className="h-3 w-3 animate-spin" /> : <GraduationCap className="h-3 w-3" />}
                    {sentCandidates.includes(candidate.modelId) ? "Enviado a Candidate Lab" : "Enviar a Candidate Lab"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[10px] text-slate-600">Todavía no hay candidatos aprobados. Carga un modelo o GGUF propio y ejecuta el Quality Gate desde la consola local.</p>
        )}
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
