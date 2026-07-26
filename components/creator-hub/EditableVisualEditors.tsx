"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Lock, Plus, Trash2, Unlock } from "lucide-react"

type EditorProps = {
  data: any
  onChange: (next: any) => void
}

const fieldClass = "w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-main outline-none placeholder:text-muted2 focus:border-blue-500/30 disabled:cursor-not-allowed disabled:opacity-45"
const labelClass = "text-[10px] font-bold uppercase tracking-[0.14em] text-muted2"

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

function LayerButtons({
  hidden,
  locked,
  onToggleHidden,
  onToggleLocked,
}: {
  hidden?: boolean
  locked?: boolean
  onToggleHidden: () => void
  onToggleLocked: () => void
}) {
  return (
    <>
      <button type="button" onClick={onToggleHidden} className="rounded-lg border border-soft p-1.5 text-muted2" title={hidden ? "Mostrar capa" : "Ocultar capa"}>
        {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      <button type="button" onClick={onToggleLocked} className="rounded-lg border border-soft p-1.5 text-muted2" title={locked ? "Desbloquear capa" : "Bloquear capa"}>
        {locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
    </>
  )
}

export function InfographicContentEditor({ data, onChange }: EditorProps) {
  const sections = Array.isArray(data?.sections) ? data.sections : []
  const patch = (next: Record<string, unknown>) => onChange({ ...data, ...next })
  const setSections = (next: any[]) => patch({ sections: next })
  const updateSection = (index: number, nextPatch: Record<string, unknown>) => {
    setSections(sections.map((section: any, sectionIndex: number) => sectionIndex === index ? { ...section, ...nextPatch } : section))
  }

  const addSection = () => {
    setSections([
      ...sections,
      {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `layer-${Date.now()}`,
        heading: `Nueva capa ${sections.length + 1}`,
        icon: "📌",
        points: ["Escribe aquí la primera idea clave."],
        stat: { value: "", label: "" },
        hidden: false,
        locked: false,
      },
    ])
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
        <p className="text-xs font-bold text-blue-500">Editor por capas</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted2">Cada sección funciona como una capa independiente: puedes editarla, ocultarla, bloquearla y cambiar su orden.</p>
      </div>

      <div className="grid gap-3">
        <label className="space-y-1.5"><span className={labelClass}>Título</span><input value={data?.title || ""} onChange={(event) => patch({ title: event.target.value })} className={fieldClass} /></label>
        <label className="space-y-1.5"><span className={labelClass}>Subtítulo</span><textarea value={data?.subtitle || ""} onChange={(event) => patch({ subtitle: event.target.value })} rows={2} className={`${fieldClass} resize-y`} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5"><span className={labelClass}>Esquema</span><select value={data?.colorScheme || "blue"} onChange={(event) => patch({ colorScheme: event.target.value })} className={fieldClass}><option value="blue">Azul</option><option value="green">Verde</option><option value="purple">Morado</option><option value="orange">Naranjo</option><option value="red">Rojo</option><option value="teal">Turquesa</option><option value="indigo">Índigo</option></select></label>
          <label className="space-y-1.5"><span className={labelClass}>Tipo visual</span><select value={data?.visualType || "educational"} onChange={(event) => patch({ visualType: event.target.value })} className={fieldClass}><option value="educational">Educativa</option><option value="statistics">Estadística</option><option value="process">Proceso</option><option value="comparison">Comparación</option><option value="timeline">Cronológica</option></select></label>
        </div>
        <label className="space-y-1.5"><span className={labelClass}>Dato destacado</span><textarea value={data?.keyFact || ""} onChange={(event) => patch({ keyFact: event.target.value })} rows={2} className={`${fieldClass} resize-y`} /></label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-xs font-bold text-main">Capas de la infografía</p><p className="text-[10px] text-muted2">La capa superior aparece primero.</p></div>
          <button type="button" onClick={addSection} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/5 px-3 py-2 text-xs font-bold text-blue-500"><Plus size={13} /> Capa</button>
        </div>

        {sections.map((section: any, index: number) => {
          const points = Array.isArray(section.points) ? section.points : []
          const locked = section.locked === true
          return (
            <div key={section.id || index} className={`space-y-3 rounded-2xl border border-soft bg-card-soft-theme p-3.5 ${section.hidden ? "opacity-55" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted2">Capa {index + 1}{locked ? " · bloqueada" : ""}</span>
                <div className="flex items-center gap-1">
                  <LayerButtons hidden={section.hidden} locked={locked} onToggleHidden={() => updateSection(index, { hidden: !section.hidden })} onToggleLocked={() => updateSection(index, { locked: !locked })} />
                  <button type="button" onClick={() => setSections(moveItem(sections, index, -1))} disabled={index === 0} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button>
                  <button type="button" onClick={() => setSections(moveItem(sections, index, 1))} disabled={index === sections.length - 1} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button>
                  <button type="button" onClick={() => setSections([...sections.slice(0, index + 1), structuredClone(section), ...sections.slice(index + 1)])} className="rounded-lg border border-soft p-1.5 text-muted2"><Copy size={12} /></button>
                  <button type="button" onClick={() => setSections(sections.filter((_: any, sectionIndex: number) => sectionIndex !== index))} disabled={sections.length <= 1} className="rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button>
                </div>
              </div>

              <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-2">
                <label className="space-y-1.5"><span className={labelClass}>Ícono</span><input disabled={locked} value={section.icon || ""} onChange={(event) => updateSection(index, { icon: event.target.value })} maxLength={8} className={`${fieldClass} text-center text-base`} /></label>
                <label className="space-y-1.5"><span className={labelClass}>Encabezado</span><input disabled={locked} value={section.heading || ""} onChange={(event) => updateSection(index, { heading: event.target.value })} className={fieldClass} /></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1.5"><span className={labelClass}>Cifra</span><input disabled={locked} value={section.stat?.value || ""} onChange={(event) => updateSection(index, { stat: { ...(section.stat || {}), value: event.target.value } })} placeholder="Ej: 75 %" className={fieldClass} /></label>
                <label className="space-y-1.5"><span className={labelClass}>Etiqueta</span><input disabled={locked} value={section.stat?.label || ""} onChange={(event) => updateSection(index, { stat: { ...(section.stat || {}), label: event.target.value } })} placeholder="Ej: de los casos" className={fieldClass} /></label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><span className={labelClass}>Ideas clave</span><button type="button" disabled={locked} onClick={() => updateSection(index, { points: [...points, "Nueva idea"] })} className="text-[10px] font-bold text-blue-500 disabled:opacity-40">+ Agregar idea</button></div>
                {points.map((point: string, pointIndex: number) => (
                  <div key={pointIndex} className="flex items-start gap-2">
                    <textarea disabled={locked} value={point} onChange={(event) => updateSection(index, { points: points.map((current: string, currentIndex: number) => currentIndex === pointIndex ? event.target.value : current) })} rows={2} className={`${fieldClass} resize-y`} />
                    <button type="button" disabled={locked || points.length <= 1} onClick={() => updateSection(index, { points: points.filter((_: string, currentIndex: number) => currentIndex !== pointIndex) })} className="mt-1 rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <label className="block space-y-1.5"><span className={labelClass}>Conclusión</span><textarea value={data?.conclusion || ""} onChange={(event) => patch({ conclusion: event.target.value })} rows={3} className={`${fieldClass} resize-y`} /></label>
    </div>
  )
}

export function PresentationContentEditor({ data, onChange }: EditorProps) {
  const slides = Array.isArray(data?.slides) ? data.slides : []
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (selectedIndex >= slides.length) setSelectedIndex(Math.max(0, slides.length - 1))
  }, [selectedIndex, slides.length])

  const selected = slides[selectedIndex]
  const patch = (next: Record<string, unknown>) => onChange({ ...data, ...next })
  const setSlides = (next: any[]) => patch({ slides: next })
  const updateSlide = (index: number, nextPatch: Record<string, unknown>) => setSlides(slides.map((slide: any, slideIndex: number) => slideIndex === index ? { ...slide, ...nextPatch } : slide))

  const addSlide = () => {
    const next = [...slides, { id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `slide-${Date.now()}`, type: "content", title: `Nueva diapositiva ${slides.length + 1}`, subtitle: "", bullets: ["Escribe aquí la primera idea."], notes: "", timingHint: "2 minutos", layout: "default", hidden: false, locked: false }]
    setSlides(next)
    setSelectedIndex(next.length - 1)
  }

  const duplicateSlide = () => {
    if (!selected) return
    const copy = structuredClone(selected)
    const next = [...slides]
    next.splice(selectedIndex + 1, 0, { ...copy, id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `slide-${Date.now()}`, title: `${copy.title || "Diapositiva"} — copia` })
    setSlides(next)
    setSelectedIndex(selectedIndex + 1)
  }

  const moveSelected = (direction: -1 | 1) => {
    const next = moveItem(slides, selectedIndex, direction)
    if (next === slides) return
    setSlides(next)
    setSelectedIndex(selectedIndex + direction)
  }

  const bulletsText = useMemo(() => Array.isArray(selected?.bullets) ? selected.bullets.join("\n") : "", [selected])
  const locked = selected?.locked === true

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
        <p className="text-xs font-bold text-violet-500">Editor por capas y diapositivas</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted2">Cada diapositiva es una capa principal. Puedes bloquearla, ocultarla, duplicarla y reordenarla.</p>
      </div>

      <div className="grid gap-3">
        <label className="space-y-1.5"><span className={labelClass}>Título del proyecto</span><input value={data?.title || ""} onChange={(event) => patch({ title: event.target.value })} className={fieldClass} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5"><span className={labelClass}>Autor</span><input value={data?.author || ""} onChange={(event) => patch({ author: event.target.value })} className={fieldClass} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Tema</span><select value={data?.theme || "academic"} onChange={(event) => patch({ theme: event.target.value })} className={fieldClass}><option value="academic">Académico</option><option value="minimal">Minimalista</option><option value="corporate">Ejecutivo</option><option value="creative">Creativo</option><option value="dark">Oscuro</option></select></label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold text-main">Capas / diapositivas</p><p className="text-[10px] text-muted2">Selecciona una para editarla.</p></div><button type="button" onClick={addSlide} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-xs font-bold text-violet-500"><Plus size={13} /> Diapositiva</button></div>
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {slides.map((slide: any, index: number) => (
            <div key={slide.id || index} className="flex items-center gap-1.5">
              <button type="button" onClick={() => setSelectedIndex(index)} className={`min-w-0 flex-1 rounded-xl border p-2.5 text-left transition ${slide.hidden ? "opacity-50" : ""}`} style={{ borderColor: selectedIndex === index ? "rgba(139,92,246,0.35)" : "var(--border-soft)", background: selectedIndex === index ? "rgba(139,92,246,0.08)" : "var(--bg-card-soft)" }}>
                <span className="block text-[10px] font-bold text-violet-500">{index + 1}. {slide.type || "content"}{slide.locked ? " · 🔒" : ""}</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-sub">{slide.title || "Sin título"}</span>
              </button>
              <button type="button" onClick={() => updateSlide(index, { hidden: !slide.hidden })} className="rounded-lg border border-soft p-2 text-muted2">{slide.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>
              <button type="button" onClick={() => updateSlide(index, { locked: !slide.locked })} className="rounded-lg border border-soft p-2 text-muted2">{slide.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 rounded-2xl border border-soft bg-card-soft-theme p-3.5">
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-muted2">Editar diapositiva {selectedIndex + 1}{locked ? " · bloqueada" : ""}</span><div className="flex items-center gap-1"><button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex === 0} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button><button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === slides.length - 1} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button><button type="button" onClick={duplicateSlide} className="rounded-lg border border-soft p-1.5 text-muted2"><Copy size={12} /></button><button type="button" onClick={() => setSlides(slides.filter((_: any, index: number) => index !== selectedIndex))} disabled={slides.length <= 1} className="rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button></div></div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5"><span className={labelClass}>Tipo</span><select disabled={locked} value={selected.type || "content"} onChange={(event) => updateSlide(selectedIndex, { type: event.target.value })} className={fieldClass}><option value="title">Portada</option><option value="content">Contenido</option><option value="comparison">Comparación</option><option value="quote">Cita</option><option value="summary">Resumen</option><option value="stats">Estadísticas</option></select></label>
            <label className="space-y-1.5"><span className={labelClass}>Diseño</span><select disabled={locked} value={selected.layout || "default"} onChange={(event) => updateSlide(selectedIndex, { layout: event.target.value })} className={fieldClass}><option value="default">Estándar</option><option value="two-column">Dos columnas</option><option value="image-left">Imagen izquierda</option><option value="quote-center">Cita central</option><option value="stats-grid">Cuadrícula de datos</option></select></label>
          </div>
          <label className="space-y-1.5"><span className={labelClass}>Título</span><input disabled={locked} value={selected.title || ""} onChange={(event) => updateSlide(selectedIndex, { title: event.target.value })} className={fieldClass} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Subtítulo</span><textarea disabled={locked} value={selected.subtitle || ""} onChange={(event) => updateSlide(selectedIndex, { subtitle: event.target.value })} rows={2} className={`${fieldClass} resize-y`} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Contenido · una idea por línea</span><textarea disabled={locked} value={bulletsText} onChange={(event) => updateSlide(selectedIndex, { bullets: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} rows={6} className={`${fieldClass} resize-y`} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Notas del orador</span><textarea disabled={locked} value={selected.notes || ""} onChange={(event) => updateSlide(selectedIndex, { notes: event.target.value })} rows={3} className={`${fieldClass} resize-y`} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Tiempo sugerido</span><input disabled={locked} value={selected.timingHint || ""} onChange={(event) => updateSlide(selectedIndex, { timingHint: event.target.value })} placeholder="Ej: 3 minutos" className={fieldClass} /></label>
        </div>
      )}
    </div>
  )
}
