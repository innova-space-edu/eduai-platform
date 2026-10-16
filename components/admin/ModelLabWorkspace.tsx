"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowLeft, AudioWaveform, BrainCircuit, Cpu, Database,
  Gauge, GraduationCap, HardDrive, Layers, LayoutDashboard, Menu,
  PanelLeftClose, PanelLeftOpen, Server, ShieldCheck, Video, X, Zap,
} from "lucide-react";
import {
  MODEL_LAB_GROUPS, MODEL_LAB_SECTIONS, modelLabSectionHash,
  resolveModelLabSection, type ModelLabSectionId,
} from "@/lib/admin/model-lab-sections";
import { ADMIN_ONLY_EXPERIMENTAL_MODELS } from "@/lib/ai/admin-model-policy";
import styles from "@/app/admin/model-lab/model-lab.module.css";

function LoadingPanel() {
  return <div role="status" className="rounded-2xl border border-white/10 bg-[#0b1728] p-6 text-xs text-slate-300">Cargando módulo de Model Lab…</div>;
}

const AICoreHealthPanel = dynamic(() => import("@/components/admin/AICoreHealthPanel"), { ssr: false, loading: LoadingPanel });
const AICoreMetricsPanel = dynamic(() => import("@/components/admin/AICoreMetricsPanel"), { ssr: false, loading: LoadingPanel });
const AIModelRegistryPanel = dynamic(() => import("@/components/admin/AIModelRegistryPanel"), { ssr: false, loading: LoadingPanel });
const BrainAILabPanel = dynamic(() => import("@/components/admin/BrainAILabPanel"), { ssr: false, loading: LoadingPanel });
const BrainAIV6LearningPanel = dynamic(() => import("@/components/admin/BrainAIV6LearningPanel"), { ssr: false, loading: LoadingPanel });
const VoiceLabPanel = dynamic(() => import("@/components/admin/VoiceLabPanel"), { ssr: false, loading: LoadingPanel });
const LiteRTLocalAIPanel = dynamic(() => import("@/components/admin/LiteRTLocalAIPanel"), { ssr: false, loading: LoadingPanel });
const LiteRTCacheAnalyticsPanel = dynamic(() => import("@/components/admin/LiteRTCacheAnalyticsPanel"), { ssr: false, loading: LoadingPanel });
const LiteRTRouterStatusPanel = dynamic(() => import("@/components/admin/LiteRTRouterStatusPanel"), { ssr: false, loading: LoadingPanel });
const LiteRTQuantizationPanelV3 = dynamic(() => import("@/components/admin/LiteRTQuantizationPanelV3"), { ssr: false, loading: LoadingPanel });
const LiteRTBenchmarkPanelV4 = dynamic(() => import("@/components/admin/LiteRTBenchmarkPanelV4"), { ssr: false, loading: LoadingPanel });
const WhisperTinyLocalPanel = dynamic(() => import("@/components/admin/WhisperTinyLocalPanel"), { ssr: false, loading: LoadingPanel });
const LocalAITelemetryPanel = dynamic(() => import("@/components/admin/LocalAITelemetryPanel"), { ssr: false, loading: LoadingPanel });
const LocalAIModelMetricsPanel = dynamic(() => import("@/components/admin/LocalAIModelMetricsPanel"), { ssr: false, loading: LoadingPanel });
const LocalLLMReadinessPanel = dynamic(() => import("@/components/admin/LocalLLMReadinessPanel"), { ssr: false, loading: LoadingPanel });
const EduAILocalRuntimePanel = dynamic(() => import("@/components/admin/EduAILocalRuntimePanel"), { ssr: false, loading: LoadingPanel });
const EduAILocalBridgePanel = dynamic(() => import("@/components/admin/EduAILocalBridgePanel"), { ssr: false, loading: LoadingPanel });
const EduAIEfficiencyAdapterPanel = dynamic(() => import("@/components/admin/EduAIEfficiencyAdapterPanel"), { ssr: false, loading: LoadingPanel });
const EduAIModelFactoryPanel = dynamic(() => import("@/components/admin/EduAIModelFactoryPanel"), { ssr: false, loading: LoadingPanel });
const ModelCandidateLabPanel = dynamic(() => import("@/components/admin/ModelCandidateLabPanel"), { ssr: false, loading: LoadingPanel });
const VideoProviderStatusPanel = dynamic(() => import("@/components/admin/VideoProviderStatusPanel"), { ssr: false, loading: LoadingPanel });

const ICONS = {
  "layout-dashboard": LayoutDashboard, server: Server, cpu: Cpu,
  "audio-waveform": AudioWaveform, zap: Zap, "hard-drive": HardDrive,
  database: Database, "graduation-cap": GraduationCap, layers: Layers,
  gauge: Gauge, "brain-circuit": BrainCircuit, activity: Activity,
  video: Video, "shield-check": ShieldCheck,
} as const;

type NavProps = {
  active: ModelLabSectionId;
  select: (id: ModelLabSectionId) => void;
  collapsed: boolean;
  mobile?: boolean;
};

function SidebarItems({ active, select, collapsed, mobile = false }: NavProps) {
  return (
    <nav aria-label="Secciones de Model Lab" className="space-y-3 p-2">
      {MODEL_LAB_GROUPS.map((group) => {
        const entries = MODEL_LAB_SECTIONS.filter((entry) => entry.group === group.id);
        return (
          <div key={group.id} className="space-y-1">
            {(!collapsed || mobile) && (
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
            )}
            {entries.map((entry) => {
              const Icon = ICONS[entry.icon];
              const chosen = active === entry.id;
              return (
                <button
                  type="button"
                  key={entry.id}
                  title={entry.label}
                  aria-current={chosen ? "page" : undefined}
                  aria-label={entry.label}
                  onClick={() => select(entry.id)}
                  className={"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 " +
                    (chosen ? "border border-cyan-400/30 bg-cyan-950/40 text-cyan-100" : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-white") +
                    (collapsed && !mobile ? " justify-center" : "")}
                >
                  <Icon className={"h-4 w-4 shrink-0 " + (chosen ? "text-cyan-300" : "text-slate-500")} aria-hidden="true" />
                  {(!collapsed || mobile) && <span className="min-w-0 flex-1">{entry.label}</span>}
                  {chosen && (!collapsed || mobile) && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

type SectionProps = {
  active: ModelLabSectionId;
  select: (id: ModelLabSectionId) => void;
};

function Overview({ select }: { select: (id: ModelLabSectionId) => void }) {
  const highlights = [
    { id: "local-runtime", title: "Runtime local", detail: "GGUF, WebGPU, caché y puente local", icon: Cpu },
    { id: "efficiency", title: "Adaptador y Bonsai", detail: "Presupuestos de RAM, SSD y compatibilidad", icon: Zap },
    { id: "artifacts", title: "Artefactos SSD", detail: "Caché SHA-256 y prueba nativa experimental", icon: HardDrive },
    { id: "dataset", title: "Dataset Factory", detail: "54 ejemplos sintéticos, revisión pendiente", icon: Database },
    { id: "training", title: "Model Factory", detail: "Entrenamiento, exportación y checkpoints", icon: GraduationCap },
    { id: "modelos", title: "Candidatos", detail: "Calidad, seguridad y promoción manual", icon: Layers },
  ] as const;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-cyan-400/15 bg-cyan-950/15 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Centro de control</p>
        <h3 className="mt-1 text-lg font-black">Un laboratorio, una sección a la vez</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Los módulos se cargan solo cuando los abres. El adaptador y Bonsai siguen en fase experimental; no se activan modelos ni se inicia entrenamiento automáticamente.
        </p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {highlights.map(({ id, title, detail, icon: Icon }) => (
          <button type="button" key={id} onClick={() => select(id)}
            className="group min-h-32 rounded-2xl border border-white/10 bg-[#0b1728] p-4 text-left transition hover:border-cyan-400/35 hover:bg-[#0e2034] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            <Icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            <div className="mt-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-white">{title}</h3><span className="text-cyan-400 group-hover:translate-x-1">→</span></div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
          </button>
        ))}
      </div>
      <p className="text-xs text-amber-200/80">Production Gate: ningún modelo experimental se publica automáticamente. Para métricas actuales abre AI Core u Observabilidad.</p>
    </div>
  );
}

function Artifacts() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-400/20 bg-[#111a29] p-5">
        <h3 className="text-base font-bold">Almacén SSD / Bonsai 2</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          El gestor Python se encuentra en el repositorio. Se instala y ejecuta en el computador propietario del SSD; el navegador no puede leer ni borrar archivos arbitrarios del sistema.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <p className="rounded-xl bg-white/5 p-3 text-xs text-slate-200">Verificación SHA-256</p>
          <p className="rounded-xl bg-white/5 p-3 text-xs text-slate-200">Pin y limpieza manual</p>
          <p className="rounded-xl bg-white/5 p-3 text-xs text-slate-200">Preflight nativo sin ejecución por defecto</p>
        </div>
        <a href="https://github.com/innova-space-edu/eduai-platform/blob/feat/model-lab-universal-efficiency-bonsai-v1/training/eduai-local/efficiency/README.md"
          target="_blank" rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-xl border border-cyan-400/25 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/30">
          Ver instrucciones de instalación →
        </a>
      </div>
      <p className="text-xs text-slate-400">Sin agente local autenticado no es posible verificar aquí el estado real del SSD nativo, ni ejecutar Bonsai desde el navegador. Los controles de caché del navegador permanecen en Runtime local.</p>
    </div>
  );
}

function Dataset() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1728] p-5">
      <h3 className="text-base font-bold">Dataset Factory — corpus experimental</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">Hay un conjunto de 54 ejemplos sintéticos, distribuido por familias para separar entrenamiento, validación y prueba. Los 54 ejemplos requieren revisión humana. El PR #249 está en borrador y este panel no modifica el corpus ni entrena modelos.</p>
      <a href="https://github.com/innova-space-edu/eduai-platform/pull/249" target="_blank" rel="noopener noreferrer"
        className="mt-4 inline-flex rounded-xl border border-cyan-400/25 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/30">
        Revisar Dataset Factory en GitHub →
      </a>
    </div>
  );
}

function Experimental() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-amber-400/20 bg-[#111723] p-5">
        <h3 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-4 w-4 text-amber-300" /> Política para modelos experimentales</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">Solo administradores, sin exposición pública para estudiantes y con Production Gate. Ningún candidato se promueve de forma automática.</p>
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        {ADMIN_ONLY_EXPERIMENTAL_MODELS.map((model) => (
          <article key={model.id} className="rounded-2xl border border-white/10 bg-[#0b1728] p-5">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{model.label}</h3><span className="text-xs text-red-300">{model.enabledByDefault ? "Activo" : "Apagado"}</span></div>
            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
              <div><h4 className="font-bold text-emerald-300">Permitido</h4><ul className="mt-2 list-disc space-y-1 pl-4 text-slate-300">{model.allowedContexts.map((s) => <li key={s}>{s}</li>)}</ul></div>
              <div><h4 className="font-bold text-red-300">Bloqueado</h4><ul className="mt-2 list-disc space-y-1 pl-4 text-slate-300">{model.blockedContexts.map((s) => <li key={s}>{s}</li>)}</ul></div>
              <div><h4 className="font-bold text-cyan-300">Controles</h4><ul className="mt-2 list-disc space-y-1 pl-4 text-slate-300">{model.requiredControls.map((s) => <li key={s}>{s}</li>)}</ul></div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SectionContent({ active, select }: SectionProps) {
  switch (active) {
    case "resumen": return <Overview select={select} />;
    case "infraestructura": return <AICoreHealthPanel />;
    case "local-runtime": return <div className="space-y-4"><EduAILocalRuntimePanel /><EduAILocalBridgePanel /></div>;
    case "litert": return <div className={"space-y-4 " + styles.litertShell}><LiteRTLocalAIPanel /><LiteRTRouterStatusPanel /><LiteRTCacheAnalyticsPanel /><WhisperTinyLocalPanel /><LiteRTQuantizationPanelV3 /></div>;
    case "efficiency": return <EduAIEfficiencyAdapterPanel />;
    case "artifacts": return <Artifacts />;
    case "dataset": return <Dataset />;
    case "training": return <EduAIModelFactoryPanel />;
    case "modelos": return <div className="space-y-4"><LocalLLMReadinessPanel /><AIModelRegistryPanel /><ModelCandidateLabPanel /></div>;
    case "benchmark": return <LiteRTBenchmarkPanelV4 />;
    case "brain-ai": return <div className="space-y-4"><BrainAILabPanel /><BrainAIV6LearningPanel /><VoiceLabPanel /></div>;
    case "observabilidad": return <div className="space-y-4"><LocalAITelemetryPanel /><LocalAIModelMetricsPanel /><AICoreMetricsPanel /></div>;
    case "video": return <VideoProviderStatusPanel />;
    case "experimental": return <Experimental />;
  }
}

export default function ModelLabWorkspace() {
  const [active, setActive] = useState<ModelLabSectionId>("resumen");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const section = MODEL_LAB_SECTIONS.find((s) => s.id === active) ?? MODEL_LAB_SECTIONS[0];

  useEffect(() => {
    const applyHash = () => {
      setActive(resolveModelLabSection(window.location.hash));
      contentRef.current?.scrollTo({ top: 0 });
      setMobileOpen(false);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("popstate", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("popstate", applyHash);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [mobileOpen]);

  function selectSection(id: ModelLabSectionId) {
    setActive(id);
    setMobileOpen(false);
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
    if (window.location.hash !== modelLabSectionHash(id)) {
      window.history.pushState(null, "", modelLabSectionHash(id));
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[24px] border border-white/10 bg-[#050e1b] shadow-[0_20px_70px_rgba(0,0,0,0.30)]">
      <aside className={"hidden min-h-0 shrink-0 flex-col border-r border-white/10 bg-[#071322] lg:flex " + (collapsed ? "w-[72px]" : "w-[248px]")}>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
          {!collapsed && <span className="truncate text-xs font-black uppercase tracking-wider text-slate-200">Secciones</span>}
          <button type="button" onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir panel lateral" : "Contraer panel lateral"}
            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <SidebarItems active={active} select={selectSection} collapsed={collapsed} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside role="dialog" aria-label="Navegación Model Lab" aria-modal="true"
            className="flex h-full w-[min(85vw,320px)] flex-col border-r border-white/15 bg-[#071322] shadow-2xl"
            onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <span className="font-bold">Model Lab · Secciones</span>
              <button type="button" autoFocus aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-200 hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarItems active={active} select={selectSection} collapsed={false} mobile />
            </div>
          </aside>
        </div>
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-[70px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0a1628] px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir secciones" aria-expanded={mobileOpen}
              className="rounded-lg border border-white/10 p-2 text-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0"><h2 className="truncate text-base font-black text-white">{section.label}</h2><p className="text-xs text-slate-400">{section.description}</p></div>
          </div>
          {active !== "resumen" && (
            <button type="button" onClick={() => selectSection("resumen")}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/10">
              <LayoutDashboard className="mr-1 inline h-3.5 w-3.5" /> Resumen
            </button>
          )}
        </div>
        <div ref={contentRef} id={active} tabIndex={-1}
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 pb-12 sm:p-5 sm:pb-12">
          <SectionContent active={active} select={selectSection} />
        </div>
      </section>
    </div>
  );
}
