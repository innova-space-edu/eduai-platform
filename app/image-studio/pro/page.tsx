"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Download,
  FlaskConical,
  ImageIcon,
  Loader2,
  Route,
  Sparkles,
  WandSparkles,
  Zap,
  RefreshCcw,
  Save,
  Share2,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DESIGN_REFERENCES, buildVisualSkillPrompt, resolveDesignReference } from "@/lib/visual-design/design-references";
import {
  EDUAI_VISUAL_PROVIDER_OPTIONS,
  compileForEduAI,
  planEduAIVisual,
  requiresAccurateVisualText,
  type EduAIVisualProvider,
} from "@/lib/visual-design/eduai-adapter";

const FORMATS = [
  { id: "16:9", label: "Horizontal 16:9", width: 1024, height: 576 },
  { id: "1:1", label: "Cuadrado 1:1", width: 1024, height: 1024 },
  { id: "9:16", label: "Vertical 9:16", width: 576, height: 1024 },
  { id: "4:5", label: "Social 4:5", width: 832, height: 1040 },
  { id: "A4", label: "Lámina A4 vertical", width: 848, height: 1200 },
];

const EXAMPLES = [
  "Infografía educativa del sistema solar para 1° medio, con jerarquía clara y poco texto",
  "Selfie nocturna realista, perspectiva de smartphone, luz urbana natural",
  "Afiche vertical con el texto exacto “FERIA CIENTÍFICA 2026” y temática espacial",
  "Diagrama de homotecia de un triángulo con k=-2 y líneas de proyección",
  "Logo vectorial limpio para un laboratorio educativo llamado “Innova Lab”",
];

type OptimizationLevel = "light" | "recommended" | "advanced";

type OptimizationResult = {
  originalPrompt: string;
  optimizedPrompt: string;
  level: OptimizationLevel;
  changes: string[];
  selectedSkills?: string[];
  primarySkill?: string;
  brief?: {
    objective?: string;
    composition?: string;
    style?: string;
    visibleText?: { title?: string; labels?: string[] };
    mustInclude?: string[];
    avoid?: string[];
  } | null;
  provider?: string;
  model?: string;
  reused?: boolean;
};

type ImageResult = {
  imageUrl: string;
  optimizedPrompt?: string;
  provider?: string;
  model?: string;
  reused?: boolean;
  providerOrder?: string[];
  attempts?: Array<{ provider: string }>;
  elapsedMs?: number;
  persistentUrl?: string | null;
  storagePath?: string | null;
  assetId?: string | null;
};

export default function ImageStudioProPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [format, setFormat] = useState(FORMATS[0]);
  const [provider, setProvider] = useState<EduAIVisualProvider>("auto");
  const [planState, setPlanState] = useState<ReturnType<typeof planEduAIVisual> | null>(null);
  const [result, setResult] = useState<ImageResult | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);
  const [optimizerInfo, setOptimizerInfo] = useState<{ provider?: string; model?: string; reused?: boolean } | null>(null);
  const [optimizationLevel, setOptimizationLevel] = useState<OptimizationLevel>("recommended");
  const [referenceId, setReferenceId] = useState("auto");
  const [designType, setDesignType] = useState("auto");
  const [activeResultTab, setActiveResultTab] = useState<"result" | "brief" | "provider" | "incidents" | "suggestions">("result");
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [allowFallback, setAllowFallback] = useState(true);
  const [optimizationPhase, setOptimizationPhase] = useState("");
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [resultAction, setResultAction] = useState<"saving" | "saved" | "sharing" | "copied" | "downloading" | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
  }, [router, supabase]);

  function createPlan() {
    const generationPrompt = prompt.trim();
    const routingPrompt = generationPrompt;
    const next = planEduAIVisual(routingPrompt, {
      audience: "Comunidad EDUAI",
      width: format.width,
      height: format.height,
      generationPrompt,
      context: {
        locale: "es-CL",
        proMode: true,
        optimized: Boolean(optimizationResult),
      },
    });
    setPlanState(next);
    setResult(null);
    setError("");
    return next;
  }

  async function optimizePrompt() {
    const currentPrompt = prompt.trim();
    if (!currentPrompt || optimizing) return;
    setOptimizing(true);
    setError("");
    try {
      const localPlan = planEduAIVisual(currentPrompt, {
        audience: "Comunidad EDUAI",
        width: format.width,
        height: format.height,
        context: { locale: "es-CL", proMode: true },
      });
      const response = await fetch("/api/image-studio/pro/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: currentPrompt,
          format: format.id,
          selectedSkills: localPlan.plan.routing.selected_skills,
          primarySkill: localPlan.plan.routing.primary_skill,
          textCritical: requiresAccurateVisualText(localPlan.plan),
          level: optimizationLevel,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.optimizedPrompt) {
        throw new Error(data.error || `Error ${response.status}`);
      }
      setOriginalPrompt(currentPrompt);
      setOptimizerInfo({ provider: data.provider, model: data.model, reused: data.reused });
      setOptimizationResult({
        originalPrompt: currentPrompt,
        optimizedPrompt: String(data.optimizedPrompt).trim(),
        level: data.level || optimizationLevel,
        changes: Array.isArray(data.changes) ? data.changes : [],
        brief: data.brief || null,
        provider: data.provider,
        model: data.model,
        reused: data.reused,
        selectedSkills: Array.isArray(data.selectedSkills) ? data.selectedSkills : undefined,
        primarySkill: typeof data.primarySkill === "string" ? data.primarySkill : undefined,
      });
      setPlanState(null);
      setResult(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible optimizar la solicitud");
    } finally {
      setOptimizing(false);
    }
  }

  function undoOptimization() {
    if (!originalPrompt) return;
    setOriginalPrompt(null);
    setOptimizerInfo(null);
    setOptimizationResult(null);
    setPlanState(null);
    setResult(null);
  }

  async function generate() {
    const typedPrompt = prompt.trim();
    if (!typedPrompt || generating) return;
    setGenerating(true);
    setError("");
    setResult(null);
    setOptimizationPhase("");
    try {
      const originalRequest = typedPrompt;
      const localRouting = planEduAIVisual(originalRequest, {
        audience: "Comunidad EDUAI", width: format.width, height: format.height,
        context: { locale: "es-CL", proMode: true },
      });
      const matchingOptimization = optimizationResult?.originalPrompt === typedPrompt ? optimizationResult : null;
      const local = buildVisualSkillPrompt({
        originalPrompt: matchingOptimization?.optimizedPrompt || typedPrompt,
        format: format.id,
        selectedSkills: localRouting.plan.routing.selected_skills,
        primarySkill: localRouting.plan.routing.primary_skill,
        textCritical: requiresAccurateVisualText(localRouting.plan),
        referenceId, designType, level: optimizationLevel,
      });
      let enhancedPrompt = local.enhanced;
      if (autoOptimize && !matchingOptimization) {
        setOptimizationPhase("Aplicando las skills y optimizando automáticamente…");
        try {
          const optimizationResponse = await fetch("/api/image-studio/pro/optimize", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: originalRequest,
              format: format.id,
              selectedSkills: localRouting.plan.routing.selected_skills,
              primarySkill: localRouting.plan.routing.primary_skill,
              textCritical: requiresAccurateVisualText(localRouting.plan),
              level: optimizationLevel,
            }),
          });
          const optimizationData = await optimizationResponse.json().catch(() => ({}));
          if (optimizationResponse.ok && typeof optimizationData.optimizedPrompt === "string" && optimizationData.optimizedPrompt.trim()) {
            enhancedPrompt = [
              optimizationData.optimizedPrompt.trim(),
              local.reference.cue ? `DIRECCIÓN ARTÍSTICA SUBORDINADA: ${local.reference.cue}` : "",
              local.reference.composition ? `COMPOSICIÓN SUBORDINADA: ${local.reference.composition}` : "",
            ].filter(Boolean).join("\n\n");
            setOptimizationResult({
              originalPrompt: originalRequest, optimizedPrompt: enhancedPrompt,
              level: optimizationLevel, changes: Array.isArray(optimizationData.changes) ? optimizationData.changes : [],
              brief: optimizationData.brief || null,
              provider: optimizationData.provider, model: optimizationData.model, reused: optimizationData.reused,
            });
            setOptimizerInfo({ provider: optimizationData.provider, model: optimizationData.model, reused: optimizationData.reused });
          } else {
            setOptimizationPhase("Optimizador IA no disponible; continuamos con las skills locales.");
          }
        } catch {
          setOptimizationPhase("Optimizador IA no disponible; continuamos con las skills locales.");
        }
      }
      const current = planEduAIVisual(originalRequest, {
        audience: "Comunidad EDUAI", width: format.width, height: format.height,
        generationPrompt: enhancedPrompt,
        context: { locale: "es-CL", proMode: true, optimized: autoOptimize },
      });
      setPlanState(current);
      const customPrompt = compileForEduAI(current.plan, provider);
      const response = await fetch("/api/agents/imagenes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: originalRequest,
          customPrompt,
          style: local.reference.engineStyle || current.style,
          width: format.width, height: format.height, provider,
          allowProviderFallback: allowFallback,
          mode: current.mode, source: "image-studio-pro",
          topic: current.plan.routing.primary_skill,
          educationalContext: JSON.stringify({
            selectedSkills: current.plan.routing.selected_skills,
            designReference: local.reference.id,
            renderStrategy: current.plan.visual_brief.render_strategy,
            constraints: current.plan.visual_brief.constraints,
            language: "es-CL",
          }),
          textPriority: requiresAccurateVisualText(current.plan),
          requireStorage: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.error || ("Error " + response.status));
      setResult({ ...data, imageUrl: data.persistentUrl || data.imageUrl });
      setActiveResultTab("result");
      setResultAction(data.persistentUrl || data.assetId ? "saved" : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible generar la imagen");
    } finally {
      setGenerating(false);
      setOptimizationPhase("");
    }
  }

  const plan = planState?.plan || null;
  const confidence = plan ? Math.round((plan.routing.confidence || 0) * 100) : 0;
  const constraints = plan && Array.isArray(plan.visual_brief.constraints)
    ? plan.visual_brief.constraints.map((value: unknown) => String(value))
    : [];

  async function saveImage() {
    if (!result?.imageUrl || resultAction === "saving") return;
    setResultAction("saving");
    try {
      if (result.assetId || result.persistentUrl || result.storagePath) {
        setResultAction("saved");
        return;
      }
      if (!/^https?:\/\//i.test(result.imageUrl)) {
        throw new Error("La imagen no tiene una URL persistente para guardar.");
      }
      const response = await fetch("/api/assets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.imageUrl,
          asset_type: "image",
          title: (optimizationResult?.originalPrompt || prompt).slice(0, 180),
          source_module: "image-studio-pro",
          source_id: plan?.routing.primary_skill || "visual-design",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || "No se pudo guardar la imagen");
      setResult((current) => current ? { ...current, assetId: data.assetId || current.assetId } : current);
      setResultAction("saved");
    } catch (cause) {
      setResultAction(null);
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la imagen");
    }
  }

  async function downloadImage(url: string) {
    if (resultAction === "downloading") return;
    setResultAction("downloading");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("No se pudo descargar la imagen");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `eduai-diseno-pro-${Date.now()}.${blob.type.includes("jpeg") ? "jpg" : blob.type.includes("webp") ? "webp" : "png"}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `eduai-diseno-pro-${Date.now()}.png`;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    } finally {
      setResultAction(result?.persistentUrl || result?.assetId ? "saved" : null);
    }
  }

  async function shareImage() {
    if (!result?.imageUrl || resultAction === "sharing") return;
    setResultAction("sharing");
    const shareUrl = result.persistentUrl || result.imageUrl;
    const title = "Imagen creada con EDUAI · Diseño Pro";
    try {
      if (navigator.share) {
        try {
          const response = await fetch(shareUrl);
          const blob = await response.blob();
          const ext = blob.type.includes("jpeg") ? "jpg" : blob.type.includes("webp") ? "webp" : "png";
          const file = new File([blob], `eduai-diseno-pro.${ext}`, { type: blob.type || "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ title, text: optimizationResult?.originalPrompt || prompt, files: [file] });
            setResultAction(result.persistentUrl || result.assetId ? "saved" : null);
            return;
          }
        } catch {
          // Fall through to URL sharing.
        }
        if (/^https?:\/\//i.test(shareUrl)) {
          await navigator.share({ title, text: optimizationResult?.originalPrompt || prompt, url: shareUrl });
          setResultAction(result.persistentUrl || result.assetId ? "saved" : null);
          return;
        }
      }

      if (/^https?:\/\//i.test(shareUrl) && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setResultAction("copied");
        window.setTimeout(() => setResultAction(result.persistentUrl || result.assetId ? "saved" : null), 1800);
        return;
      }

      throw new Error("Este navegador no permite compartir esta imagen.");
    } catch (cause) {
      if ((cause as Error)?.name !== "AbortError") {
        setError(cause instanceof Error ? cause.message : "No se pudo compartir la imagen");
      }
      setResultAction(result.persistentUrl || result.assetId ? "saved" : null);
    }
  }

  return (
    <main className="min-h-screen bg-app text-main">
      <header className="sticky top-0 z-20 border-b border-soft bg-app/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Link href="/image-studio" className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft bg-card-soft-theme text-sub hover:text-main" aria-label="Volver a Image Studio">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black">Image Studio · Diseño Pro</h1>
                <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-violet-500">Pro · Beta</span>
              </div>
              <p className="text-xs text-muted2">Skills visuales avanzadas + modelos existentes de EDUAI</p>
            </div>
          </div>
          <Link href="/image-studio" className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs font-bold text-muted2 transition hover:text-main">
            Volver al modo rápido
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="space-y-4">
          <div className="rounded-[28px] border border-soft bg-card-soft-theme p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/15">
                <WandSparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-black">Describe lo que quieres diseñar</h2>
                <p className="mt-1 text-xs leading-5 text-muted2">El modo Pro analiza el tipo de diseño, crea un VisualBrief y selecciona skills especializadas antes de usar el mismo motor multiproveedor de Image Studio.</p>
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setPlanState(null);
                setOriginalPrompt(null);
                setOptimizerInfo(null);
                setOptimizationResult(null);
              }}
              className="mt-5 min-h-36 w-full resize-y rounded-2xl border border-soft bg-input-theme px-4 py-3 text-sm outline-none transition focus:border-violet-400/40"
              placeholder="Ej.: crea una infografía educativa..."
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example, index) => (
                <button key={example} onClick={() => { setPrompt(example); setPlanState(null); setOriginalPrompt(null); setOptimizerInfo(null); setOptimizationResult(null); }} className="rounded-full border border-soft bg-app px-3 py-1.5 text-[11px] font-semibold text-muted2 transition hover:border-violet-400/30 hover:text-main">
                  Ejemplo {index + 1}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-bold">
                <span>Formato</span>
                <select value={format.id} onChange={(event) => { const selected = FORMATS.find((item) => item.id === event.target.value) || FORMATS[0]; setFormat(selected); setPlanState(null); }} className="w-full rounded-xl border border-soft bg-input-theme px-3 py-2.5 text-sm">
                  {FORMATS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-bold">
                <span>Modelos EDUAI</span>
                <select value={provider} onChange={(event) => setProvider(event.target.value as EduAIVisualProvider)} className="w-full rounded-xl border border-soft bg-input-theme px-3 py-2.5 text-sm">
                  {EDUAI_VISUAL_PROVIDER_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/[0.04] p-3">
              <p className="text-xs font-black text-main">Biblioteca de referencias visuales</p>
              <p className="mt-1 text-[11px] text-muted2">Elige un diseño o deja que la skill lo detecte. Incluye estilos de videojuegos voxel, cómic, arte retro e infografías.</p>
              <div className="mt-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {DESIGN_REFERENCES.map((item) => (
                  <button key={item.id} type="button" onClick={() => {
                    if (originalPrompt && optimizationResult) setPrompt(originalPrompt);
                    setReferenceId(item.id); setPlanState(null); setOriginalPrompt(null); setOptimizationResult(null); setOptimizerInfo(null);
                  }}
                    aria-pressed={referenceId === item.id}
                    className={"rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition " +
                      (referenceId === item.id ? "border-violet-500 bg-violet-500/15 text-violet-700" : "border-soft bg-app text-muted2 hover:text-main")}>
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted2">Estilo detectado: <strong>{resolveDesignReference(referenceId, prompt).label}</strong></p>
              <label className="mt-3 block text-xs font-semibold">Tipo de pieza
                <select value={designType} onChange={(event) => {setDesignType(event.target.value);setPlanState(null);}} className="mt-1 w-full rounded-xl border border-soft bg-input-theme px-3 py-2 text-xs">
                  <option value="auto">Automático según la solicitud</option>
                  <option value="illustration">Ilustración</option>
                  <option value="educational">Recurso educativo</option>
                  <option value="game">Escena de videojuego</option>
                  <option value="graphic">Póster / diseño gráfico</option>
                  <option value="photography">Fotografía</option>
                </select>
              </label>
              <div className="mt-3 space-y-2 text-xs text-main">
                <label className="flex items-center gap-2"><input type="checkbox" checked={autoOptimize} onChange={(event) => setAutoOptimize(event.target.checked)} /> Optimizar automáticamente al generar (puede consumir créditos IA)</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={allowFallback} onChange={(event) => setAllowFallback(event.target.checked)} /> Permitir proveedor alternativo si el elegido falla (puede cambiar el costo)</label>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted2">Nivel de optimización</p>
              <div className="inline-flex flex-wrap gap-1 rounded-xl border border-soft bg-app p-1">
                {([
                  ["light", "Ligera"],
                  ["recommended", "Recomendada"],
                  ["advanced", "Avanzada"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOptimizationLevel(value)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${optimizationLevel === value ? "bg-cyan-500/15 text-cyan-700" : "text-muted2 hover:text-main"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={optimizePrompt} disabled={!prompt.trim() || optimizing} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-700 disabled:opacity-40">
                {optimizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                {optimizing ? "Optimizando…" : "Optimizar solicitud"}
              </button>
              {originalPrompt && (
                <button onClick={undoOptimization} className="inline-flex items-center gap-1.5 rounded-xl border border-soft bg-app px-3 py-2.5 text-xs font-bold text-muted2">
                  <RefreshCcw className="h-3.5 w-3.5" /> Deshacer
                </button>
              )}
              {optimizerInfo && (
                <span className="text-[10px] text-muted2">
                  Optimizada con {optimizerInfo.provider || "EDUAI"}{optimizerInfo.model ? ` · ${optimizerInfo.model}` : ""}{optimizerInfo.reused ? " · reutilizada" : ""}
                </span>
              )}
            </div>

            {optimizationResult && (
              <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black text-main">Antes vs. optimizado</p>
                  <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold text-cyan-700">
                    {optimizationResult.level === "light" ? "Ligera" : optimizationResult.level === "advanced" ? "Avanzada" : "Recomendada"}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl bg-app p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted2">Original</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted2">{optimizationResult.originalPrompt}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-400/15 bg-white/60 p-3 dark:bg-black/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-700">Optimizado</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-main">{optimizationResult.optimizedPrompt}</p>
                  </div>
                </div>
                {optimizationResult.changes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted2">Mejoras aplicadas</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {optimizationResult.changes.map((change) => (
                        <span key={change} className="rounded-full border border-cyan-400/15 bg-app px-2.5 py-1 text-[10px] font-semibold text-muted2">{change}</span>
                      ))}
                    </div>
                  </div>
                )}
                {optimizationResult.brief && (
                  <details className="mt-3 rounded-xl bg-app p-3">
                    <summary className="cursor-pointer text-xs font-bold text-muted2">Ver brief visual generado</summary>
                    <div className="mt-3 space-y-2 text-xs text-muted2">
                      {optimizationResult.brief.objective && <p><strong className="text-main">Objetivo:</strong> {optimizationResult.brief.objective}</p>}
                      {optimizationResult.brief.composition && <p><strong className="text-main">Composición:</strong> {optimizationResult.brief.composition}</p>}
                      {optimizationResult.brief.style && <p><strong className="text-main">Estilo:</strong> {optimizationResult.brief.style}</p>}
                      {!!optimizationResult.brief.visibleText?.title && <p><strong className="text-main">Título:</strong> {optimizationResult.brief.visibleText.title}</p>}
                      {!!optimizationResult.brief.visibleText?.labels?.length && <p><strong className="text-main">Etiquetas:</strong> {optimizationResult.brief.visibleText.labels.join(", ")}</p>}
                    </div>
                  </details>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={createPlan} disabled={!prompt.trim()} className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-sm font-black text-violet-600 disabled:opacity-40">
                <Route className="h-4 w-4" /> Analizar con Diseño Pro · $0 IA
              </button>

            </div>

            {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs leading-5 text-red-600">{error}</div>}
          </div>

          {plan && (
            <div className="rounded-[28px] border border-soft bg-card-soft-theme p-5">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-500">Plan de diseño Pro</p><h3 className="mt-1 font-black">{plan.routing.primary_skill}</h3></div>
                <div className="rounded-2xl bg-app px-3 py-2 text-right"><p className="text-lg font-black">{confidence}%</p><p className="text-[10px] text-muted2">confianza local</p></div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Metric icon={Zap} value={String(plan.cost.planning_external_calls)} label="llamadas IA al plan" />
                <Metric icon={BrainCircuit} value={plan.visual_brief.render_strategy} label="estrategia" />
                <Metric icon={ImageIcon} value={planState?.style || "—"} label="estilo EDUAI" />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {plan.routing.selected_skills.map((skill) => <span key={skill} className="rounded-full border border-soft bg-app px-2.5 py-1 text-[10px] font-bold text-muted2">{skill}</span>)}
              </div>

              <div className="mt-4 space-y-2">
                {constraints.slice(0, 5).map((constraint: string) => (
                  <div key={String(constraint)} className="flex items-start gap-2 text-xs text-muted2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /><span>{String(constraint)}</span></div>
                ))}
              </div>

              {plan.visual_brief.render_strategy !== "generative" && (
                <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3 text-xs leading-5 text-violet-700">
                  Diseño Pro detectó que esta solicitud necesita mayor precisión estructural. Esa información se incorporará al prompt compilado que recibe la IA de Image Studio.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="overflow-hidden rounded-[28px] border border-soft bg-card-soft-theme">
            <div className="flex items-center justify-between gap-3 border-b border-soft px-5 py-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-500">Diseño Pro</p><h2 className="mt-1 font-black">Resultado visual</h2></div>
              {result?.imageUrl && (
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    onClick={saveImage}
                    disabled={resultAction === "saving"}
                    className="inline-flex items-center gap-2 rounded-xl border border-soft bg-app px-3 py-2 text-xs font-bold transition hover:border-emerald-400/30 disabled:opacity-50"
                  >
                    {resultAction === "saved" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Save className="h-3.5 w-3.5" />}
                    {resultAction === "saving" ? "Guardando…" : resultAction === "saved" ? "Guardada" : "Guardar"}
                  </button>
                  <button
                    onClick={() => downloadImage(result.imageUrl)}
                    disabled={resultAction === "downloading"}
                    className="inline-flex items-center gap-2 rounded-xl border border-soft bg-app px-3 py-2 text-xs font-bold transition hover:border-blue-400/30 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {resultAction === "downloading" ? "Descargando…" : "Descargar"}
                  </button>
                  <button
                    onClick={shareImage}
                    disabled={resultAction === "sharing"}
                    className="inline-flex items-center gap-2 rounded-xl border border-soft bg-app px-3 py-2 text-xs font-bold transition hover:border-violet-400/30 disabled:opacity-50"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {resultAction === "sharing" ? "Compartiendo…" : resultAction === "copied" ? "Enlace copiado" : "Compartir"}
                  </button>
                </div>
              )}
            </div>

            <div role="tablist" aria-label="Paneles de Diseño Pro" className="flex gap-1 overflow-x-auto border-b border-soft bg-app/50 px-3 py-2">
              {([
                ["result", "Resultado"], ["brief", "Brief"], ["provider", "Proveedor"],
                ["incidents", "Incidencias"], ["suggestions", "Sugerencias"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={activeResultTab === id}
                  onClick={() => setActiveResultTab(id)}
                  className={"whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold " +
                    (activeResultTab === id ? "bg-violet-600 text-white" : "text-muted2 hover:bg-violet-500/10")}>{label}</button>
              ))}
            </div>
            {activeResultTab === "result" && (
              <>
            <div className="grid min-h-[520px] place-items-center bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.10),_transparent_45%)] p-5">
              {generating ? (
                <div className="text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-500" /><p className="mt-4 text-sm font-black">Diseño Pro está generando</p><p className="mt-1 text-xs text-muted2">Se conserva el fallback y los límites de Image Studio.</p></div>
              ) : result?.imageUrl ? (
                <img src={result.imageUrl} alt="Resultado generado por EDUAI" className="max-h-[660px] max-w-full rounded-2xl object-contain shadow-2xl" />
              ) : (
                <div className="max-w-sm text-center"><FlaskConical className="mx-auto h-10 w-10 text-violet-400" /><p className="mt-4 text-sm font-black">Analiza y genera con Diseño Pro</p><p className="mt-2 text-xs leading-5 text-muted2">Primero se seleccionan las skills y restricciones del diseño; después la imagen se genera directamente con los modelos actuales de EDUAI.</p></div>
              )}
            </div>

            {result && (
              <div className="border-t border-soft p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-600">{result.reused ? "Reutilizada" : "Generada"}</span>
                  <span className="rounded-full bg-app px-2.5 py-1 text-muted2">{result.provider || "EDUAI"}</span>
                  {result.model && <span className="rounded-full bg-app px-2.5 py-1 text-muted2">{result.model}</span>}
                  {typeof result.elapsedMs === "number" && <span className="rounded-full bg-app px-2.5 py-1 text-muted2">{(result.elapsedMs / 1000).toFixed(1)}s</span>}
                  {result.persistentUrl && <span className="rounded-full bg-blue-500/10 px-2.5 py-1 font-bold text-blue-600">Guardada</span>}
                </div>
                {!!result.attempts?.length && <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-700">El proveedor principal no completó la solicitud; EDUAI utilizó un proveedor alternativo compatible. EDUAI envió el evento al registro administrativo, sujeto a disponibilidad de telemetría.</p>}
                {result.optimizedPrompt && <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-muted2">Prompt compilado usado</summary><p className="mt-2 rounded-xl bg-app p-3 text-xs leading-5 text-muted2">{result.optimizedPrompt}</p></details>}
              </div>
            )}
            </>)}
            {activeResultTab === "brief" && (
              <div role="tabpanel" className="min-h-80 space-y-3 p-5 text-xs text-main">
                <h3 className="text-sm font-black">Brief visual y dirección artística</h3>
                <p><strong>Solicitud original:</strong> {optimizationResult?.originalPrompt || originalPrompt || prompt}</p>
                <p><strong>Estilo:</strong> {resolveDesignReference(referenceId, prompt).label}</p>
                <p><strong>Tipo:</strong> {designType === "auto" ? resolveDesignReference(referenceId, prompt).type : designType}</p>
                <p><strong>Formato:</strong> {format.label}</p>
                {optimizationResult?.optimizedPrompt && <p className="whitespace-pre-wrap rounded-xl bg-app p-3"><strong>Prompt optimizado:</strong> {optimizationResult.optimizedPrompt}</p>}
                {!optimizationResult?.optimizedPrompt && <p>El brief final se completa automáticamente al generar. Pulsa «Analizar con Diseño Pro» para conocer las skills seleccionadas.</p>}
                {planState && <p><strong>Skills activas:</strong> {planState.plan.routing.selected_skills.join(", ")}</p>}
              </div>
            )}
            {activeResultTab === "provider" && (
              <div role="tabpanel" className="min-h-80 space-y-3 p-5 text-xs text-main">
                <h3 className="text-sm font-black">Enrutamiento de proveedores</h3>
                <p>Preferencia: <strong>{provider === "auto" ? "Selección automática" : provider}</strong></p>
                <p>Fallback: <strong>{allowFallback ? "Autorizado para Diseño Pro" : "Desactivado"}</strong>. Puede cambiar los costos, el modelo y la calidad.</p>
                <p>Proveedor utilizado: <strong>{result?.provider || "Aún no generado"}</strong></p>
                <p>Modelo: <strong>{result?.model || "Sin datos"}</strong></p>
                {result?.providerOrder?.length ? <p>Orden considerado: {result.providerOrder.join(" → ")}</p> : null}
                <p>Los errores y cuotas se supervisan mediante el registro administrativo, no se muestran credenciales ni respuestas privadas aquí.</p>
              </div>
            )}
            {activeResultTab === "incidents" && (
              <div role="tabpanel" className="min-h-80 p-5 text-xs text-main">
                <h3 className="text-sm font-black">Incidencias de generación</h3>
                <p className="mt-3 leading-6">{error || "No hay fallos visibles en esta sesión. El historial de incidencias y la antigüedad están disponibles únicamente en la campana de administración Edu Claw."}</p>
                <p className="mt-3 text-muted2">Cuando un proveedor falla y está permitido, EDUAI intenta otro compatible y registra la incidencia sin duplicarla.</p>
              </div>
            )}
            {activeResultTab === "suggestions" && (
              <div role="tabpanel" className="min-h-80 space-y-3 p-5 text-xs text-main">
                <h3 className="text-sm font-black">Sugerencias para el diseño</h3>
                <p>Incluye el personaje u objeto principal, qué acción realiza, escenario, estilo artístico, iluminación y destino de uso.</p>
                <p>Para un videojuego de bloques, menciona perspectiva, acción, texturas voxel y fondo de aventura.</p>
                <p>Para material educativo, proporciona curso y contenidos exactos; revisa fórmulas y rótulos antes de publicar.</p>
                <p>El motor puede interpretar estilos, pero no garantiza texto o geometría exactos sin revisión.</p>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-violet-400/20 bg-card-soft-theme p-4">
            <button type="button" onClick={generate} disabled={!prompt.trim() || generating || optimizing} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-500/15 disabled:opacity-50">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? (optimizationPhase || "Generando…") : "Generar con modelos EDUAI"}
            </button>
            <p className="mt-2 text-center text-xs text-muted2">Se conserva tu solicitud original; las skills y mejoras son complementarias.</p>
          </div>

          <div className="rounded-[28px] border border-soft bg-card-soft-theme p-5">
            <h3 className="text-sm font-black">Cómo trabaja Diseño Pro</h3>
            <div className="mt-4 space-y-2">
              {[
                "Detecta estilos y optimiza automáticamente con las skills visuales, y opcionalmente con IA.",
                "Clasifica la solicitud y carga solo las skills visuales relevantes.",
                "Construye VisualBrief y restricciones específicas para la pieza.",
                "Compila un prompt coherente para el modelo elegido, con reglas estrictas de texto cuando corresponde.",
                "La IA de Image Studio genera la imagen y la guarda en la carpeta y galería del usuario.",
              ].map((item, index) => <div key={item} className="flex gap-3 rounded-2xl bg-app p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[11px] font-black text-violet-600">{index + 1}</span><p className="text-xs leading-5 text-muted2">{item}</p></div>)}
            </div>
            <Link href="/image-studio" className="mt-4 inline-flex items-center gap-1 text-xs font-black text-blue-500">Volver al modo rápido de Image Studio <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof Zap; value: string; label: string }) {
  return <div className="rounded-2xl bg-app p-3"><Icon className="h-4 w-4 text-violet-500" /><p className="mt-2 truncate text-sm font-black">{value}</p><p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted2">{label}</p></div>;
}
