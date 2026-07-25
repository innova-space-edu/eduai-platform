"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react"

type EditorProps = {
  data: any
  onChange: (next: any) => void
}

const fieldClass = "w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-main outline-none placeholder:text-muted2 focus:border-blue-500/30"
const labelClass = "text-[10px] font-bold uppercase tracking-[0.14em] text-muted2"

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
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
        heading: `Nueva sección ${sections.length + 1}`,
        icon: "📌",
        points: ["Escribe aquí la primera idea clave."],
        stat: { value: "", label: "" },
      },
    ])
  }

  const removeSection = (index: number) => setSections(sections.filter((_: any, sectionIndex: number) => sectionIndex !== index))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
        <p className="text-xs font-bold text-blue-500">Editor de contenido</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted2">Los cambios se reflejan de inmediato en la vista previa y quedan guardados en Mis proyectos.</p>
      </div>

      <div className="grid gap-3">
        <label className="space-y-1.5">
          <span className={labelClass}>Título</span>
          <input value={data?.title || ""} onChange={(event) => patch({ title: event.target.value })} className={fieldClass} />
        </label>
        <label className="space-y-1.5">
          <span className={labelClass}>Subtítulo</span>
          <textarea value={data?.subtitle || ""} onChange={(event) => patch({ subtitle: event.target.value })} rows={2} className={`${fieldClass} resize-y`} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5">
            <span className={labelClass}>Esquema</span>
            <select value={data?.colorScheme || "blue"} onChange={(event) => patch({ colorScheme: event.target.value })} className={fieldClass}>
              <option value="blue">Azul</option>
              <option value="green">Verde</option>
              <option value="purple">Morado</option>
              <option value="orange">Naranjo</option>
              <option value="red">Rojo</option>
              <option value="teal">Turquesa</option>
              <option value="indigo">Índigo</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Tipo visual</span>
            <select value={data?.visualType || "educational"} onChange={(event) => patch({ visualType: event.target.value })} className={fieldClass}>
              <option value="educational">Educativa</option>
              <option value="statistics">Estadística</option>
              <option value="process">Proceso</option>
              <option value="comparison">Comparación</option>
              <option value="timeline">Cronológica</option>
            </select>
          </label>
        </div>
        <label className="space-y-1.5">
          <span className={labelClass}>Dato destacado</span>
          <textarea value={data?.keyFact || ""} onChange={(event) => patch({ keyFact: event.target.value })} rows={2} className={`${fieldClass} resize-y`} />
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-main">Secciones</p>
            <p className="text-[10px] text-muted2">Edita, ordena o amplía los bloques de la infografía.</p>
          </div>
          <button type="button" onClick={addSection} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/5 px-3 py-2 text-xs font-bold text-blue-500">
            <Plus size={13} /> Sección
          </button>
        </div>

        {sections.map((section: any, index: number) => {
          const points = Array.isArray(section.points) ? section.points : []
          return (
            <div key={index} className="rounded-2xl border border-soft bg-card-soft-theme p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted2">Bloque {index + 1}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setSections(moveItem(sections, index, -1))} disabled={index === 0} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button>
                  <button type="button" onClick={() => setSections(moveItem(sections, index, 1))} disabled={index === sections.length - 1} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button>
                  <button type="button" onClick={() => removeSection(index)} disabled={sections.length <= 1} className="rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button>
                </div>
              </div>

              <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-2">
                <label className="space-y-1.5">
                  <span className={labelClass}>Ícono</span>
                  <input value={section.icon || ""} onChange={(event) => updateSection(index, { icon: event.target.value })} maxLength={8} className={`${fieldClass} text-center text-base`} />
                </label>
                <label className="space-y-1.5">
                  <span className={labelClass}>Encabezado</span>
                  <input value={section.heading || ""} onChange={(event) => updateSection(index, { heading: event.target.value })} className={fieldClass} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1.5">
                  <span className={labelClass}>Cifra</span>
                  <input value={section.stat?.value || ""} onChange={(event) => updateSection(index, { stat: { ...(section.stat || {}), value: event.target.value } })} placeholder="Ej: 75 %" className={fieldClass} />
                </label>
                <label className="space-y-1.5">
                  <span className={labelClass}>Etiqueta de cifra</span>
                  <input value={section.stat?.label || ""} onChange={(event) => updateSection(index, { stat: { ...(section.stat || {}), label: event.target.value } })} placeholder="Ej: de los casos" className={fieldClass} />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={labelClass}>Ideas clave</span>
                  <button type="button" onClick={() => updateSection(index, { points: [...points, "Nueva idea"] })} className="text-[10px] font-bold text-blue-500">+ Agregar idea</button>
                </div>
                {points.map((point: string, pointIndex: number) => (
                  <div key={pointIndex} className="flex items-start gap-2">
                    <textarea
                      value={point}
                      onChange={(event) => updateSection(index, { points: points.map((current: string, currentIndex: number) => currentIndex === pointIndex ? event.target.value : current) })}
                      rows={2}
                      className={`${fieldClass} resize-y`}
                    />
                    <button type="button" onClick={() => updateSection(index, { points: points.filter((_: string, currentIndex: number) => currentIndex !== pointIndex) })} disabled={points.length <= 1} className="mt-1 rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>Conclusión</span>
        <textarea value={data?.conclusion || ""} onChange={(event) => patch({ conclusion: event.target.value })} rows={3} className={`${fieldClass} resize-y`} />
      </label>
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

  const updateSlide = (index: number, nextPatch: Record<string, unknown>) => {
    setSlides(slides.map((slide: any, slideIndex: number) => slideIndex === index ? { ...slide, ...nextPatch } : slide))
  }

  const addSlide = () => {
    const next = [
      ...slides,
      {
        type: "content",
        title: `Nueva diapositiva ${slides.length + 1}`,
        subtitle: "",
        bullets: ["Escribe aquí la primera idea."],
        notes: "",
        timingHint: "2 minutos",
        layout: "default",
      },
    ]
    setSlides(next)
    setSelectedIndex(next.length - 1)
  }

  const duplicateSlide = () => {
    if (!selected) return
    const copy = JSON.parse(JSON.stringify(selected))
    const next = [...slides]
    next.splice(selectedIndex + 1, 0, { ...copy, title: `${copy.title || "Diapositiva"} — copia` })
    setSlides(next)
    setSelectedIndex(selectedIndex + 1)
  }

  const removeSlide = () => {
    if (slides.length <= 1) return
    setSlides(slides.filter((_: any, index: number) => index !== selectedIndex))
  }

  const moveSelected = (direction: -1 | 1) => {
    const next = moveItem(slides, selectedIndex, direction)
    if (next === slides) return
    setSlides(next)
    setSelectedIndex(selectedIndex + direction)
  }

  const bulletsText = useMemo(() => Array.isArray(selected?.bullets) ? selected.bullets.join("\n") : "", [selected])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
        <p className="text-xs font-bold text-violet-500">Editor de presentación</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted2">Modifica la estructura y luego exporta el resultado actualizado a PPTX, PDF o PNG.</p>
      </div>

      <div className="grid gap-3">
        <label className="space-y-1.5">
          <span className={labelClass}>Título del proyecto</span>
          <input value={data?.title || ""} onChange={(event) => patch({ title: event.target.value })} className={fieldClass} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5">
            <span className={labelClass}>Autor</span>
            <input value={data?.author || ""} onChange={(event) => patch({ author: event.target.value })} className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Tema</span>
            <select value={data?.theme || "academic"} onChange={(event) => patch({ theme: event.target.value })} className={fieldClass}>
              <option value="academic">Académico</option>
              <option value="minimal">Minimalista</option>
              <option value="corporate">Ejecutivo</option>
              <option value="creative">Creativo</option>
              <option value="dark">Oscuro</option>
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-main">Diapositivas</p>
            <p className="text-[10px] text-muted2">Selecciona una para editarla.</p>
          </div>
          <button type="button" onClick={addSlide} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-xs font-bold text-violet-500"><Plus size={13} /> Diapositiva</button>
        </div>
        <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {slides.map((slide: any, index: number) => (
            <button key={index} type="button" onClick={() => setSelectedIndex(index)} className="w-full rounded-xl border p-2.5 text-left transition" style={{ borderColor: selectedIndex === index ? "rgba(139,92,246,0.35)" : "var(--border-soft)", background: selectedIndex === index ? "rgba(139,92,246,0.08)" : "var(--bg-card-soft)" }}>
              <span className="block text-[10px] font-bold text-violet-500">{index + 1}. {slide.type || "content"}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-sub">{slide.title || "Sin título"}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="rounded-2xl border border-soft bg-card-soft-theme p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted2">Editar diapositiva {selectedIndex + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex === 0} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === slides.length - 1} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button>
              <button type="button" onClick={duplicateSlide} className="rounded-lg border border-soft p-1.5 text-muted2"><Copy size={12} /></button>
              <button type="button" onClick={removeSlide} disabled={slides.length <= 1} className="rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className={labelClass}>Tipo</span>
              <select value={selected.type || "content"} onChange={(event) => updateSlide(selectedIndex, { type: event.target.value })} className={fieldClass}>
                <option value="title">Portada</option>
                <option value="content">Contenido</option>
                <option value="comparison">Comparación</option>
                <option value="quote">Cita</option>
                <option value="summary">Resumen</option>
                <option value="stats">Estadísticas</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Diseño</span>
              <select value={selected.layout || "default"} onChange={(event) => updateSlide(selectedIndex, { layout: event.target.value })} className={fieldClass}>
                <option value="default">Estándar</option>
                <option value="two-column">Dos columnas</option>
                <option value="image-left">Imagen izquierda</option>
                <option value="quote-center">Cita central</option>
                <option value="stats-grid">Cuadrícula de datos</option>
              </select>
            </label>
          </div>

          <label className="space-y-1.5">
            <span className={labelClass}>Título</span>
            <input value={selected.title || ""} onChange={(event) => updateSlide(selectedIndex, { title: event.target.value })} className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Subtítulo</span>
            <textarea value={selected.subtitle || ""} onChange={(event) => updateSlide(selectedIndex, { subtitle: event.target.value })} rows={2} className={`${fieldClass} resize-y`} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Contenido · una idea por línea</span>
            <textarea
              value={bulletsText}
              onChange={(event) => updateSlide(selectedIndex, { bullets: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })}
              rows={6}
              className={`${fieldClass} resize-y`}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Notas del orador</span>
            <textarea value={selected.notes || ""} onChange={(event) => updateSlide(selectedIndex, { notes: event.target.value })} rows={3} className={`${fieldClass} resize-y`} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Tiempo sugerido</span>
            <input value={selected.timingHint || ""} onChange={(event) => updateSlide(selectedIndex, { timingHint: event.target.value })} placeholder="Ej: 3 minutos" className={fieldClass} />
          </label>
        </div>
      )}
    </div>
  )
}
