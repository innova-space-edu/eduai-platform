import {
  MODEL_LAB_CHAT_MODELS,
  MODEL_LAB_IMAGE_MODELS,
  MODEL_LAB_VIDEO_MODELS,
  type ModelLabCatalogItem,
} from "@/lib/ai/model-lab-catalog";

const phaseLabels = {
  phase_1: "Fase 1",
  phase_2: "Fase 2",
  phase_3: "Fase 3",
};

function ModelCard({ model }: { model: ModelLabCatalogItem }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{model.providerLabel}</p>
          <h3 className="mt-2 text-lg font-black">{model.label}</h3>
        </div>
        <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-200">
          {phaseLabels[model.stage]}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-300">{model.notes}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {model.capabilities.map((item) => (
          <span key={item} className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-100">
            {item}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>Licencia: {model.license}</span>
        {model.hubUrl && (
          <a href={model.hubUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-300 hover:text-blue-200">
            Repositorio HF ↗
          </a>
        )}
      </div>
    </article>
  );
}

function Section({ title, description, models }: { title: string; description: string; models: ModelLabCatalogItem[] }) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4">
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {models.map((model) => <ModelCard key={model.id} model={model} />)}
      </div>
    </section>
  );
}

export default function ModelCatalog() {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.02] p-5">
      <details>
        <summary className="cursor-pointer text-lg font-black text-slate-200">Ver catálogo técnico y modelos planificados</summary>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Esta sección reúne modelos evaluados o considerados para próximas fases. Se mantiene plegada para no sobrecargar la operación diaria.
        </p>
        <div className="mt-5 space-y-5">
          <Section title="Chat experimental" description="Modelos online para comparar respuestas y preparar prompts visuales." models={MODEL_LAB_CHAT_MODELS} />
          <Section title="Creación y edición de imágenes" description="Afiches, texto dentro de imágenes, edición guiada, múltiples referencias y capas editables." models={MODEL_LAB_IMAGE_MODELS} />
          <Section title="Creación y transformación de videos" description="Texto a video, imagen a video, video a video, audio sincronizado y animación avanzada." models={MODEL_LAB_VIDEO_MODELS} />
        </div>
      </details>
    </section>
  );
}
