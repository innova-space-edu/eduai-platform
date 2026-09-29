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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  EDUAI_VISUAL_PROVIDER_OPTIONS,
  compileForEduAI,
  deterministicPreview,
  planEduAIVisual,
  type EduAIVisualProvider,
} from "@/lib/visual-design/eduai-adapter";

const FORMATS = [
  { id: "16:9", label: "Horizontal 16:9", width: 1024, height: 576 },
  { id: "1:1", label: "Cuadrado 1:1", width: 1024, height: 1024 },
  { id: "9:16", label: "Vertical 9:16", width: 576, height: 1024 },
];

const EXAMPLES = [
  "Infografía educativa del sistema solar para 1° medio, con jerarquía clara y poco texto",
  "Selfie nocturna realista, perspectiva de smartphone, luz urbana natural",
  "Afiche vertical con el texto exacto “FERIA CIENTÍFICA 2026” y temática espacial",
  "Diagrama de homotecia de un triángulo con k=-2 y líneas de proyección",
  "Logo vectorial limpio para un laboratorio educativo llamado “Innova Lab”",
];

type ImageResult = {
  imageUrl: string;
  optimizedPrompt?: string;
  provider?: string;
  model?: string;
  reused?: boolean;
  providerOrder?: string[];
  elapsedMs?: number;
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
  }, [router, supabase]);

  function createPlan() {
    const next = planEduAIVisual(prompt.trim(), {
      audience: "Comunidad EDUAI",
      width: format.width,
      height: format.height,
      context: { locale: "es-CL", proMode: true },
    });
    setPlanState(next);
    setResult(null);
    setError("");
    return next;
  }

  async function generate() {
    if (!prompt.trim() || generating) return;
    const current = planState || createPlan();
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const customPrompt = compileForEduAI(current.plan, provider);
      const response = await fetch("/api/agents/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          customPrompt,
          style: current.style,
          width: format.width,
          height: format.height,
          provider,
          mode: current.mode,
          source: "image-studio-pro",
          topic: current.plan.routing.primary_skill,
          educationalContext: JSON.stringify({
            selectedSkills: current.plan.routing.selected_skills,
            renderStrategy: current.plan.visual_brief.render_strategy,
            constraints: current.plan.visual_brief.constraints,
          }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || `Error ${response.status}`);
      }
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible generar la imagen");
    } finally {
      setGenerating(false);
    }
  }

  const plan = planState?.plan || null;
  const svgPreview = plan ? deterministicPreview(plan) : null;
  const confidence = plan ? Math.round((plan.routing.confidence || 0) * 100) : 0;
  const constraints = plan && Array.isArray(plan.visual_brief.constraints)
    ? plan.visual_brief.constraints.map((value: unknown) => String(value))
    : [];

  function download(url: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "eduai-visual-design.png";
    anchor.click();
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
              }}
              className="mt-5 min-h-36 w-full resize-y rounded-2xl border border-soft bg-input-theme px-4 py-3 text-sm outline-none transition focus:border-violet-400/40"
              placeholder="Ej.: crea una infografía educativa..."
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example, index) => (
                <button key={example} onClick={() => { setPrompt(example); setPlanState(null); }} className="rounded-full border border-soft bg-app px-3 py-1.5 text-[11px] font-semibold text-muted2 transition hover:border-violet-400/30 hover:text-main">
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

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={createPlan} disabled={!prompt.trim()} className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-sm font-black text-violet-600 disabled:opacity-40">
                <Route className="h-4 w-4" /> Analizar con Diseño Pro · $0 IA
              </button>
              <button onClick={generate} disabled={!prompt.trim() || generating} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-500/15 disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Generando…" : "Generar con modelos EDUAI"}
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
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700">
                  Esta solicitud contiene estructura que conviene mantener determinística. La vista SVG conserva esa intención; “Generar con EDUAI” sirve para probar el acabado raster con los modelos actuales.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="overflow-hidden rounded-[28px] border border-soft bg-card-soft-theme">
            <div className="flex items-center justify-between gap-3 border-b border-soft px-5 py-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-500">Diseño Pro</p><h2 className="mt-1 font-black">Resultado visual</h2></div>
              {result?.imageUrl && <button onClick={() => download(result.imageUrl)} className="inline-flex items-center gap-2 rounded-xl border border-soft bg-app px-3 py-2 text-xs font-bold"><Download className="h-3.5 w-3.5" /> Descargar</button>}
            </div>

            <div className="grid min-h-[520px] place-items-center bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.10),_transparent_45%)] p-5">
              {generating ? (
                <div className="text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-500" /><p className="mt-4 text-sm font-black">Diseño Pro está generando</p><p className="mt-1 text-xs text-muted2">Se conserva el fallback y los límites de Image Studio.</p></div>
              ) : result?.imageUrl ? (
                <img src={result.imageUrl} alt="Resultado generado por EDUAI" className="max-h-[660px] max-w-full rounded-2xl object-contain shadow-2xl" />
              ) : svgPreview?.data_url ? (
                <div className="w-full"><img src={svgPreview.data_url} alt="Vista determinística SVG" className="mx-auto max-h-[620px] max-w-full rounded-2xl object-contain" /><p className="mt-3 text-center text-[11px] text-muted2">Vista técnica local · sin llamada a modelo de imagen</p></div>
              ) : (
                <div className="max-w-sm text-center"><FlaskConical className="mx-auto h-10 w-10 text-violet-400" /><p className="mt-4 text-sm font-black">Primero analiza una solicitud</p><p className="mt-2 text-xs leading-5 text-muted2">Verás las skills seleccionadas, estrategia, constraints y luego podrás probar los modelos actuales de EDUAI.</p></div>
              )}
            </div>

            {result && (
              <div className="border-t border-soft p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-600">{result.reused ? "Reutilizada" : "Generada"}</span>
                  <span className="rounded-full bg-app px-2.5 py-1 text-muted2">{result.provider || "EDUAI"}</span>
                  {result.model && <span className="rounded-full bg-app px-2.5 py-1 text-muted2">{result.model}</span>}
                  {typeof result.elapsedMs === "number" && <span className="rounded-full bg-app px-2.5 py-1 text-muted2">{(result.elapsedMs / 1000).toFixed(1)}s</span>}
                </div>
                {result.optimizedPrompt && <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-muted2">Prompt compilado usado</summary><p className="mt-2 rounded-xl bg-app p-3 text-xs leading-5 text-muted2">{result.optimizedPrompt}</p></details>}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-soft bg-card-soft-theme p-5">
            <h3 className="text-sm font-black">Cómo trabaja Diseño Pro</h3>
            <div className="mt-4 space-y-2">
              {[
                "Clasifica la solicitud y detecta el tipo de diseño.",
                "Construye VisualBrief, skills y restricciones sin gastar tokens.",
                "Compila instrucciones específicas para el tipo de pieza visual.",
                "Image Studio ejecuta con sus modelos/proveedores actuales y su fallback.",
                "El resultado sigue usando la galería, storage y reutilización normal de EDUAI.",
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
