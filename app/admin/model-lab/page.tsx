import Link from "next/link";
import {
  ArrowLeft,
  BrainCircuit,
  Cpu,
  FlaskConical,
  Gauge,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AICoreHealthPanel from "@/components/admin/AICoreHealthPanel";
import AICoreMetricsPanel from "@/components/admin/AICoreMetricsPanel";
import AIModelRegistryPanel from "@/components/admin/AIModelRegistryPanel";
import BrainAILabPanel from "@/components/admin/BrainAILabPanel";
import VoiceLabPanel from "@/components/admin/VoiceLabPanel";
import LiteRTLocalAIPanel from "@/components/admin/LiteRTLocalAIPanel";
import LiteRTCacheAnalyticsPanel from "@/components/admin/LiteRTCacheAnalyticsPanel";
import LiteRTPrewarm from "@/components/admin/LiteRTPrewarm";
import LiteRTRouterStatusPanel from "@/components/admin/LiteRTRouterStatusPanel";
import LiteRTQuantizationPanelV3 from "@/components/admin/LiteRTQuantizationPanelV3";
import LiteRTBenchmarkPanelV4 from "@/components/admin/LiteRTBenchmarkPanelV4";
import WhisperTinyLocalPanel from "@/components/admin/WhisperTinyLocalPanel";
import LocalAITelemetryPanel from "@/components/admin/LocalAITelemetryPanel";
import LocalAIModelMetricsPanel from "@/components/admin/LocalAIModelMetricsPanel";
import LocalLLMReadinessPanel from "@/components/admin/LocalLLMReadinessPanel";
import ModelLabSectionNav from "@/components/admin/ModelLabSectionNav";
import VideoProviderStatusPanel from "@/components/admin/VideoProviderStatusPanel";
import { ADMIN_ONLY_EXPERIMENTAL_MODELS } from "@/lib/ai/admin-model-policy";
import styles from "./model-lab.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LAB_CAPABILITIES = [
  { label: "AI Core", detail: "Proveedores y Supabase", icon: Sparkles, tone: "text-cyan-200 border-cyan-400/15 bg-cyan-950/35" },
  { label: "Brain AI", detail: "Cognitive OS · Shadow Mode", icon: BrainCircuit, tone: "text-fuchsia-200 border-fuchsia-400/15 bg-fuchsia-950/30" },
  { label: "Local AI", detail: "LiteRT · Router V3 · visión · voz", icon: BrainCircuit, tone: "text-emerald-200 border-emerald-400/15 bg-emerald-950/30" },
  { label: "Performance", detail: "Benchmark end-to-end", icon: Gauge, tone: "text-violet-200 border-violet-400/15 bg-violet-950/30" },
  { label: "Control", detail: "Admin only · Production Gate", icon: ShieldCheck, tone: "text-amber-200 border-amber-400/15 bg-amber-950/25" },
] as const;

function getBuildFingerprint() {
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local").slice(0, 8);
  const branch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || "local";
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "local";
  return { commit, branch, environment };
}

export default function AdminModelLabPage() {
  const build = getBuildFingerprint();

  return (
    <main className={`${styles.darkLab} min-h-screen px-3 py-5 text-white sm:px-5 sm:py-7`}>
      <LiteRTPrewarm />
      <div className="mx-auto max-w-[1440px] space-y-5">
        <header className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#081224] p-5 shadow-[0_24px_90px_rgba(2,6,23,0.55)] sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-950/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-950/30 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-950/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200"><FlaskConical className="h-3.5 w-3.5" /> Admin only</span>
                <span className="rounded-full border border-emerald-400/15 bg-emerald-950/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Local-first enabled</span>
                <span className="rounded-full border border-fuchsia-400/15 bg-fuchsia-950/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-200">Brain AI Shadow Mode</span>
                <span className="rounded-full border border-cyan-400/15 bg-cyan-950/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200" title={`Commit ${build.commit} · rama ${build.branch} · entorno ${build.environment}`}>Build {build.commit} · {build.branch} · {build.environment}</span>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">EduAI Model Lab</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-[15px]">Banco de pruebas del futuro sistema multimodal de EduAI: Brain AI, memoria, texto, audio, imagen, video, routing local/cloud, observabilidad y Production Gate antes de promover capacidades hacia docentes o estudiantes.</p>
            </div>
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0c1a2d] px-4 py-2.5 text-sm font-black text-slate-200 transition hover:-translate-y-0.5 hover:bg-[#10223a]"><ArrowLeft className="h-4 w-4" /> Admin</Link>
          </div>

          <div className="relative mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{LAB_CAPABILITIES.map(({ label, detail, icon: Icon, tone }) => <div key={label} className={`rounded-2xl border px-4 py-3 ${tone}`}><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><span className="text-xs font-black">{label}</span></div><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>)}</div>
        </header>

        <ModelLabSectionNav />
        <div id="infraestructura" className="scroll-mt-24"><AICoreHealthPanel /></div>
        <div id="brain-ai" className="scroll-mt-24 space-y-4"><BrainAILabPanel /><VoiceLabPanel /></div>
        <div id="litert" className={`scroll-mt-24 ${styles.litertShell}`}><LiteRTLocalAIPanel /><LiteRTRouterStatusPanel /><LiteRTCacheAnalyticsPanel /><WhisperTinyLocalPanel /><LiteRTQuantizationPanelV3 /></div>
        <div id="benchmark" className="scroll-mt-24"><LiteRTBenchmarkPanelV4 /></div>
        <div id="modelos" className="scroll-mt-24 space-y-4"><LocalLLMReadinessPanel /><AIModelRegistryPanel /></div>
        <div id="video" className="scroll-mt-24"><VideoProviderStatusPanel /></div>
        <div id="observabilidad" className="scroll-mt-24 space-y-4"><LocalAITelemetryPanel /><LocalAIModelMetricsPanel /><AICoreMetricsPanel /></div>

        <div id="experimental" className="scroll-mt-24 space-y-4">
          <section className="overflow-hidden rounded-[28px] border border-amber-400/20 bg-[#111723] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-3xl"><div className="flex items-center gap-2 text-amber-200"><ShieldCheck className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.2em]">Zona aislada</p></div><h2 className="mt-2 text-xl font-black text-white">Política para modelos experimentales</h2><p className="mt-2 text-sm leading-relaxed text-slate-300">Los modelos experimentales permanecen separados por rol, sin endpoint público para estudiantes, con auditoría, filtros de seguridad y apagado por defecto en producción.</p></div><span className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-950/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-red-200"><Cpu className="h-3.5 w-3.5" /> Producción bloqueada</span></div></section>
          <div className="grid gap-4 lg:grid-cols-2">{ADMIN_ONLY_EXPERIMENTAL_MODELS.map((model) => <article key={model.id} className="rounded-[28px] border border-white/10 bg-[#08111f] p-5 transition hover:border-white/15 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{model.access}</p><h3 className="mt-2 text-xl font-black">{model.label}</h3></div><span className="rounded-full border border-red-400/20 bg-red-950/30 px-3 py-1 text-xs font-black text-red-200">{model.enabledByDefault ? "Activo" : "Apagado"}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3"><div className="rounded-2xl border border-emerald-400/15 bg-emerald-950/25 p-3"><p className="text-xs font-black text-emerald-200">Permitido</p><ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-5 text-emerald-100/75">{model.allowedContexts.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="rounded-2xl border border-red-400/15 bg-red-950/25 p-3"><p className="text-xs font-black text-red-200">Bloqueado</p><ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-5 text-red-100/75">{model.blockedContexts.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="rounded-2xl border border-blue-400/15 bg-blue-950/25 p-3"><p className="text-xs font-black text-blue-200">Controles</p><ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-5 text-blue-100/75">{model.requiredControls.map((item) => <li key={item}>{item}</li>)}</ul></div></div></article>)}</div>
        </div>
      </div>
    </main>
  );
}
