"use client"

function safeArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function paletteColor(data: any, fallback: string) {
  return typeof data?._design?.palette?.primary === "string" ? data._design.palette.primary : fallback
}

const POSTER_SCHEMES: Record<string, { background: string; surface: string; text: string; muted: string }> = {
  vibrant: { background: "linear-gradient(155deg,#fff7ed,#fdf2f8 48%,#eef2ff)", surface: "rgba(255,255,255,0.82)", text: "#172033", muted: "#526176" },
  pastel: { background: "linear-gradient(155deg,#fdf4ff,#f0fdfa 50%,#eff6ff)", surface: "rgba(255,255,255,0.84)", text: "#243047", muted: "#64748b" },
  dark: { background: "linear-gradient(155deg,#07111f,#111827 52%,#1e1b4b)", surface: "rgba(255,255,255,0.075)", text: "#f8fafc", muted: "#cbd5e1" },
  monochrome: { background: "linear-gradient(155deg,#fafafa,#e5e7eb)", surface: "rgba(255,255,255,0.86)", text: "#18181b", muted: "#52525b" },
  neon: { background: "linear-gradient(155deg,#020617,#111827 50%,#172554)", surface: "rgba(15,23,42,0.74)", text: "#f8fafc", muted: "#bfdbfe" },
}

export function EditablePosterPreview({ data, accentColor }: { data: any; accentColor?: string }) {
  const points = safeArray(data?.mainPoints)
  const accent = accentColor || paletteColor(data, "#f97316")
  const scheme = POSTER_SCHEMES[data?.colorScheme] || POSTER_SCHEMES.vibrant

  return (
    <article className="mx-auto min-h-[920px] w-full max-w-[720px] overflow-hidden rounded-[28px] border border-black/10 shadow-sm" style={{ background: scheme.background, color: scheme.text }}>
      <header className="relative overflow-hidden px-8 pb-9 pt-12 text-center sm:px-12">
        <div className="absolute -right-20 -top-24 h-60 w-60 rounded-full opacity-20" style={{ background: accent }} />
        <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full opacity-10" style={{ background: accent }} />
        <div className="relative z-10">
          <span className="inline-flex rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em]" style={{ borderColor: `${accent}55`, background: `${accent}16`, color: accent }}>Afiche educativo</span>
          <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-black leading-[1.05] sm:text-5xl">{data?.headline || "Título del afiche"}</h1>
          {data?.tagline && <p className="mx-auto mt-5 max-w-xl text-base font-medium leading-7" style={{ color: scheme.muted }}>{data.tagline}</p>}
        </div>
      </header>

      <div className="grid gap-4 px-6 pb-7 sm:grid-cols-2 sm:px-9">
        {points.map((point: any, index: number) => (
          <section key={`poster-preview-${index}`} className="rounded-3xl border p-5" style={{ background: scheme.surface, borderColor: `${accent}24`, boxShadow: "0 14px 34px rgba(15,23,42,0.07)" }}>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}>{point?.icon || "✦"}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Punto {String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-1 text-lg font-black leading-tight">{point?.title || "Idea principal"}</h2>
              </div>
            </div>
            {point?.description && <p className="mt-4 text-sm leading-6" style={{ color: scheme.muted }}>{point.description}</p>}
            {point?.stat && <div className="mt-4 rounded-2xl px-4 py-3 text-center" style={{ background: `${accent}13`, border: `1px solid ${accent}24` }}><p className="text-xl font-black" style={{ color: accent }}>{point.stat}</p></div>}
          </section>
        ))}
      </div>

      {data?.callToAction && <div className="mx-6 mb-8 rounded-3xl px-7 py-5 text-center text-lg font-black text-white sm:mx-9" style={{ background: `linear-gradient(135deg,${accent},${accent}cc)`, boxShadow: `0 16px 32px ${accent}2e` }}>{data.callToAction}</div>}
      <footer className="flex items-center justify-between border-t border-black/10 px-9 py-4 text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: scheme.muted }}><span>EduAI Creator Studio</span><span>Material editable</span></footer>
    </article>
  )
}

export function EditableCornellPreview({ data, accentColor }: { data: any; accentColor?: string }) {
  const notes = safeArray(data?.mainNotes)
  const keywords = safeArray(data?.keywords)
  const accent = accentColor || paletteColor(data, "#0ea5e9")

  return (
    <article className="mx-auto min-h-[900px] w-full max-w-[820px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <header className="border-b-2 px-7 py-6" style={{ borderColor: accent }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>Método Cornell</p><h1 className="mt-2 text-3xl font-black leading-tight">{data?.title || "Apuntes Cornell"}</h1></div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500"><span><strong className="text-slate-700">Asignatura:</strong> {data?.subject || "—"}</span><span><strong className="text-slate-700">Fecha:</strong> {data?.date || "—"}</span></div>
        </div>
        {keywords.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{keywords.map((keyword: string, index: number) => <span key={`cornell-keyword-${index}`} className="rounded-full px-3 py-1 text-[10px] font-bold" style={{ background: `${accent}12`, color: accent }}>{keyword}</span>)}</div>}
      </header>

      <div className="grid min-h-[590px] grid-cols-[32%_68%]">
        <div className="border-r border-slate-300 bg-slate-50 px-5 py-5"><p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Preguntas y conceptos clave</p>{notes.map((note: any, index: number) => <div key={`cornell-topic-${index}`} className="mb-5 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold leading-5 text-slate-700"><span className="mr-1" style={{ color: accent }}>{index + 1}.</span>{note?.topic || "Concepto"}</div>)}</div>
        <div className="px-6 py-5"><p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Notas principales</p>{notes.map((note: any, index: number) => <section key={`cornell-note-preview-${index}`} className="mb-5 border-b border-dashed border-slate-200 pb-5"><h2 className="text-sm font-black" style={{ color: accent }}>{note?.topic || `Nota ${index + 1}`}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{note?.notes || "Sin contenido"}</p></section>)}</div>
      </div>

      <section className="border-t-2 px-7 py-6" style={{ borderColor: accent, background: `${accent}08` }}><p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Resumen</p><p className="mt-2 whitespace-pre-line text-sm font-medium leading-6 text-slate-700">{data?.summary || "Escribe aquí una síntesis del contenido."}</p></section>
      <footer className="flex items-center justify-between border-t border-slate-200 px-7 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400"><span>EduAI Creator Studio</span><span>Apuntes editables</span></footer>
    </article>
  )
}

export function EditableGlossaryPreview({ data, accentColor }: { data: any; accentColor?: string }) {
  const terms = safeArray(data?.terms)
  const accent = accentColor || paletteColor(data, "#8b5cf6")

  return (
    <article className="mx-auto min-h-[860px] w-full max-w-[880px] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 text-slate-900 shadow-sm">
      <header className="relative overflow-hidden bg-white px-8 py-8 sm:px-10">
        <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full opacity-10" style={{ background: accent }} />
        <div className="relative"><p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: accent }}>Glosario educativo</p><h1 className="mt-2 text-4xl font-black leading-tight">{data?.title || "Glosario"}</h1><p className="mt-2 text-sm font-semibold text-slate-500">{data?.subject || "Área de estudio"} · {terms.length} términos</p></div>
      </header>

      <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
        {terms.map((term: any, index: number) => (
          <section key={`glossary-preview-${index}`} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="absolute left-0 top-0 h-full w-1.5" style={{ background: accent }} />
            <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{String(index + 1).padStart(2, "0")}</p><h2 className="mt-1 text-xl font-black" style={{ color: accent }}>{term?.term || "Concepto"}</h2></div>{term?.category && <span className="rounded-full px-2.5 py-1 text-[9px] font-bold" style={{ background: `${accent}12`, color: accent }}>{term.category}</span>}</div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{term?.definition || "Definición pendiente."}</p>
            {term?.example && <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Ejemplo</p><p className="mt-1 text-xs italic leading-5 text-slate-600">{term.example}</p></div>}
          </section>
        ))}
      </div>
      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400"><span>EduAI Creator Studio</span><span>Glosario editable</span></footer>
    </article>
  )
}

export function EditableLessonPlanPreview({ data, accentColor }: { data: any; accentColor?: string }) {
  const phases = safeArray(data?.phases)
  const resources = safeArray(data?.resources)
  const accent = accentColor || paletteColor(data, "#2563eb")

  return (
    <article className="mx-auto min-h-[920px] w-full max-w-[900px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <header className="px-8 py-7 text-white sm:px-10" style={{ background: `linear-gradient(135deg,${accent},${accent}c7)` }}>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/75">Planificación de clase</p>
        <h1 className="mt-2 text-3xl font-black leading-tight">{data?.title || "Plan de clase"}</h1>
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><p className="text-white/65">Asignatura</p><p className="mt-1 font-bold">{data?.subject || "—"}</p></div><div><p className="text-white/65">Curso</p><p className="mt-1 font-bold">{data?.grade || "—"}</p></div><div><p className="text-white/65">Duración</p><p className="mt-1 font-bold">{data?.duration || "—"}</p></div><div><p className="text-white/65">Bloom</p><p className="mt-1 font-bold">{data?.bloom || "—"}</p></div></div>
      </header>

      <section className="grid gap-4 border-b border-slate-200 bg-slate-50 px-7 py-6 sm:grid-cols-2 sm:px-9">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Objetivo de aprendizaje</p><p className="mt-2 text-sm font-medium leading-6 text-slate-700">{data?.objective || "Objetivo pendiente."}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Evaluación</p><p className="mt-2 text-sm leading-6 text-slate-600">{data?.assessment || "Estrategia de evaluación pendiente."}</p></div>
      </section>

      <section className="px-7 py-7 sm:px-9">
        <div className="flex items-center justify-between"><h2 className="text-lg font-black">Secuencia de aprendizaje</h2><span className="rounded-full px-3 py-1 text-[10px] font-bold" style={{ background: `${accent}12`, color: accent }}>{phases.length} momentos</span></div>
        <div className="mt-5 space-y-4">
          {phases.map((phase: any, index: number) => (
            <div key={`lesson-preview-${index}`} className="grid gap-4 rounded-3xl border border-slate-200 p-5 sm:grid-cols-[76px_1fr]">
              <div className="flex sm:block"><div className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black text-white" style={{ background: accent }}>{index + 1}</div><div className="ml-3 sm:ml-0 sm:mt-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Duración</p><p className="mt-1 text-xs font-bold text-slate-700">{phase?.duration || "—"}</p></div></div>
              <div><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-black" style={{ color: accent }}>{phase?.name || `Momento ${index + 1}`}</h3>{phase?.materials && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-500">{phase.materials}</span>}</div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{phase?.activity || "Actividad pendiente."}</p>{phase?.notes && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"><strong>Nota docente:</strong> {phase.notes}</div>}</div>
            </div>
          ))}
        </div>
      </section>

      {resources.length > 0 && <section className="border-t border-slate-200 bg-slate-50 px-7 py-6 sm:px-9"><p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Recursos</p><div className="mt-3 flex flex-wrap gap-2">{resources.map((resource: string, index: number) => <span key={`lesson-resource-${index}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600">{resource}</span>)}</div></section>}
      <footer className="flex items-center justify-between border-t border-slate-200 px-8 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400"><span>EduAI Creator Studio</span><span>Plan editable</span></footer>
    </article>
  )
}
