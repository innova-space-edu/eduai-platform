"use client"

import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react"

type EditorProps = {
  data: any
  onChange: (next: any) => void
}

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}

function Field({ label, value, onChange, placeholder, type = "text" }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none placeholder:text-muted2 focus:border-blue-500/35"
      />
    </label>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: FieldProps & { rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted2">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs leading-5 text-main outline-none placeholder:text-muted2 focus:border-blue-500/35"
      />
    </label>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted2">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2.5 text-xs text-main outline-none focus:border-blue-500/35">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function ItemActions({ index, length, onMove, onDuplicate, onRemove }: { index: number; length: number; onMove: (from: number, to: number) => void; onDuplicate: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} title="Subir" className="rounded-lg border border-soft p-1.5 text-muted2 transition hover:text-main disabled:opacity-25"><ArrowUp size={12} /></button>
      <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === length - 1} title="Bajar" className="rounded-lg border border-soft p-1.5 text-muted2 transition hover:text-main disabled:opacity-25"><ArrowDown size={12} /></button>
      <button type="button" onClick={onDuplicate} title="Duplicar" className="rounded-lg border border-soft p-1.5 text-muted2 transition hover:text-main"><Copy size={12} /></button>
      <button type="button" onClick={onRemove} title="Eliminar" className="rounded-lg border border-red-500/20 p-1.5 text-red-500 transition hover:bg-red-500/5"><Trash2 size={12} /></button>
    </div>
  )
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-500/30 bg-blue-500/5 px-3 py-2.5 text-xs font-bold text-blue-600 transition hover:bg-blue-500/10"><Plus size={13} /> {label}</button>
}

export function PosterContentEditor({ data, onChange }: EditorProps) {
  const points = Array.isArray(data?.mainPoints) ? data.mainPoints : []
  const patch = (changes: Record<string, unknown>) => onChange({ ...data, ...changes })
  const setPoints = (mainPoints: any[]) => patch({ mainPoints })

  return (
    <div className="space-y-4">
      <Field label="Título principal" value={data?.headline || ""} onChange={(headline) => patch({ headline })} />
      <TextArea label="Bajada" value={data?.tagline || ""} onChange={(tagline) => patch({ tagline })} rows={2} />
      <TextArea label="Llamado a la acción" value={data?.callToAction || ""} onChange={(callToAction) => patch({ callToAction })} rows={2} />
      <SelectField label="Estilo cromático" value={data?.colorScheme || "vibrant"} onChange={(colorScheme) => patch({ colorScheme })} options={[
        { value: "vibrant", label: "Vibrante" }, { value: "pastel", label: "Pastel" }, { value: "dark", label: "Oscuro" }, { value: "monochrome", label: "Monocromático" }, { value: "neon", label: "Neón" },
      ]} />

      <div className="border-t border-soft pt-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black text-main">Bloques informativos</h3><span className="text-[10px] font-bold text-muted2">{points.length}</span></div>
        <div className="mt-3 space-y-3">
          {points.map((point: any, index: number) => (
            <section key={`poster-point-${index}`} className="rounded-2xl border border-soft bg-card-soft-theme p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Bloque {index + 1}</span><ItemActions index={index} length={points.length} onMove={(from, to) => setPoints(moveItem(points, from, to))} onDuplicate={() => setPoints([...points.slice(0, index + 1), { ...point }, ...points.slice(index + 1)])} onRemove={() => setPoints(points.filter((_: any, itemIndex: number) => itemIndex !== index))} /></div>
              <div className="grid grid-cols-[80px_1fr] gap-2"><Field label="Ícono" value={point?.icon || ""} onChange={(icon) => setPoints(points.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, icon } : item))} /><Field label="Título" value={point?.title || ""} onChange={(title) => setPoints(points.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, title } : item))} /></div>
              <div className="mt-2"><TextArea label="Descripción" value={point?.description || ""} onChange={(description) => setPoints(points.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, description } : item))} rows={3} /></div>
              <div className="mt-2"><Field label="Cifra o dato destacado" value={point?.stat || ""} onChange={(stat) => setPoints(points.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, stat } : item))} placeholder="Opcional" /></div>
            </section>
          ))}
        </div>
        <AddButton label="Agregar bloque" onClick={() => setPoints([...points, { icon: "✦", title: "Nuevo punto", description: "Describe la idea principal.", stat: "" }])} />
      </div>
    </div>
  )
}

export function CornellContentEditor({ data, onChange }: EditorProps) {
  const notes = Array.isArray(data?.mainNotes) ? data.mainNotes : []
  const keywords = Array.isArray(data?.keywords) ? data.keywords : []
  const patch = (changes: Record<string, unknown>) => onChange({ ...data, ...changes })
  const setNotes = (mainNotes: any[]) => patch({ mainNotes })

  return (
    <div className="space-y-4">
      <Field label="Título" value={data?.title || ""} onChange={(title) => patch({ title })} />
      <div className="grid grid-cols-2 gap-2"><Field label="Asignatura" value={data?.subject || ""} onChange={(subject) => patch({ subject })} /><Field label="Fecha" value={data?.date || ""} onChange={(date) => patch({ date })} /></div>
      <TextArea label="Resumen final" value={data?.summary || ""} onChange={(summary) => patch({ summary })} rows={4} />
      <div>
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted2">Palabras clave</span>
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword: string, index: number) => <div key={`keyword-${index}`} className="flex items-center rounded-full border border-soft bg-card-soft-theme pl-3"><input value={keyword} onChange={(event) => patch({ keywords: keywords.map((item: string, itemIndex: number) => itemIndex === index ? event.target.value : item) })} className="w-24 bg-transparent py-1.5 text-[11px] text-main outline-none" /><button type="button" onClick={() => patch({ keywords: keywords.filter((_: string, itemIndex: number) => itemIndex !== index) })} className="p-1.5 text-red-500"><Trash2 size={11} /></button></div>)}
          <button type="button" onClick={() => patch({ keywords: [...keywords, "Nueva palabra"] })} className="inline-flex items-center gap-1 rounded-full border border-dashed border-blue-500/30 px-3 py-1.5 text-[11px] font-bold text-blue-600"><Plus size={11} /> Agregar</button>
        </div>
      </div>

      <div className="border-t border-soft pt-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black text-main">Apuntes principales</h3><span className="text-[10px] font-bold text-muted2">{notes.length}</span></div>
        <div className="mt-3 space-y-3">
          {notes.map((note: any, index: number) => (
            <section key={`cornell-note-${index}`} className="rounded-2xl border border-soft bg-card-soft-theme p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Nota {index + 1}</span><ItemActions index={index} length={notes.length} onMove={(from, to) => setNotes(moveItem(notes, from, to))} onDuplicate={() => setNotes([...notes.slice(0, index + 1), { ...note }, ...notes.slice(index + 1)])} onRemove={() => setNotes(notes.filter((_: any, itemIndex: number) => itemIndex !== index))} /></div>
              <Field label="Pregunta o tema clave" value={note?.topic || ""} onChange={(topic) => setNotes(notes.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, topic } : item))} />
              <div className="mt-2"><TextArea label="Notas" value={note?.notes || ""} onChange={(noteText) => setNotes(notes.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, notes: noteText } : item))} rows={4} /></div>
            </section>
          ))}
        </div>
        <AddButton label="Agregar nota" onClick={() => setNotes([...notes, { topic: "Nuevo concepto", notes: "Desarrolla aquí las ideas principales." }])} />
      </div>
    </div>
  )
}

export function GlossaryContentEditor({ data, onChange }: EditorProps) {
  const terms = Array.isArray(data?.terms) ? data.terms : []
  const patch = (changes: Record<string, unknown>) => onChange({ ...data, ...changes })
  const setTerms = (nextTerms: any[]) => patch({ terms: nextTerms })

  return (
    <div className="space-y-4">
      <Field label="Título" value={data?.title || ""} onChange={(title) => patch({ title })} />
      <Field label="Asignatura o área" value={data?.subject || ""} onChange={(subject) => patch({ subject })} />
      <div className="border-t border-soft pt-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black text-main">Términos</h3><span className="text-[10px] font-bold text-muted2">{terms.length}</span></div>
        <div className="mt-3 space-y-3">
          {terms.map((term: any, index: number) => (
            <section key={`glossary-term-${index}`} className="rounded-2xl border border-soft bg-card-soft-theme p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Término {index + 1}</span><ItemActions index={index} length={terms.length} onMove={(from, to) => setTerms(moveItem(terms, from, to))} onDuplicate={() => setTerms([...terms.slice(0, index + 1), { ...term }, ...terms.slice(index + 1)])} onRemove={() => setTerms(terms.filter((_: any, itemIndex: number) => itemIndex !== index))} /></div>
              <div className="grid grid-cols-2 gap-2"><Field label="Concepto" value={term?.term || ""} onChange={(value) => setTerms(terms.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, term: value } : item))} /><Field label="Categoría" value={term?.category || ""} onChange={(category) => setTerms(terms.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, category } : item))} placeholder="Opcional" /></div>
              <div className="mt-2"><TextArea label="Definición" value={term?.definition || ""} onChange={(definition) => setTerms(terms.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, definition } : item))} rows={3} /></div>
              <div className="mt-2"><TextArea label="Ejemplo" value={term?.example || ""} onChange={(example) => setTerms(terms.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, example } : item))} rows={2} /></div>
            </section>
          ))}
        </div>
        <AddButton label="Agregar término" onClick={() => setTerms([...terms, { term: "Nuevo concepto", definition: "Escribe una definición clara.", example: "Agrega un ejemplo contextualizado.", category: "" }])} />
      </div>
    </div>
  )
}

export function LessonPlanContentEditor({ data, onChange }: EditorProps) {
  const phases = Array.isArray(data?.phases) ? data.phases : []
  const resources = Array.isArray(data?.resources) ? data.resources : []
  const patch = (changes: Record<string, unknown>) => onChange({ ...data, ...changes })
  const setPhases = (nextPhases: any[]) => patch({ phases: nextPhases })

  return (
    <div className="space-y-4">
      <Field label="Título de la clase" value={data?.title || ""} onChange={(title) => patch({ title })} />
      <div className="grid grid-cols-2 gap-2"><Field label="Asignatura" value={data?.subject || ""} onChange={(subject) => patch({ subject })} /><Field label="Curso" value={data?.grade || ""} onChange={(grade) => patch({ grade })} /></div>
      <div className="grid grid-cols-2 gap-2"><Field label="Duración" value={data?.duration || ""} onChange={(duration) => patch({ duration })} /><Field label="Nivel de Bloom" value={data?.bloom || ""} onChange={(bloom) => patch({ bloom })} /></div>
      <TextArea label="Objetivo de aprendizaje" value={data?.objective || ""} onChange={(objective) => patch({ objective })} rows={4} />
      <TextArea label="Evaluación" value={data?.assessment || ""} onChange={(assessment) => patch({ assessment })} rows={4} />

      <div>
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-muted2">Recursos generales</span>
        <div className="space-y-2">
          {resources.map((resource: string, index: number) => <div key={`resource-${index}`} className="flex gap-2"><input value={resource} onChange={(event) => patch({ resources: resources.map((item: string, itemIndex: number) => itemIndex === index ? event.target.value : item) })} className="min-w-0 flex-1 rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-main outline-none" /><button type="button" onClick={() => patch({ resources: resources.filter((_: string, itemIndex: number) => itemIndex !== index) })} className="rounded-xl border border-red-500/20 px-2.5 text-red-500"><Trash2 size={12} /></button></div>)}
        </div>
        <AddButton label="Agregar recurso" onClick={() => patch({ resources: [...resources, "Nuevo recurso"] })} />
      </div>

      <div className="border-t border-soft pt-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black text-main">Momentos de la clase</h3><span className="text-[10px] font-bold text-muted2">{phases.length}</span></div>
        <div className="mt-3 space-y-3">
          {phases.map((phase: any, index: number) => (
            <section key={`lesson-phase-${index}`} className="rounded-2xl border border-soft bg-card-soft-theme p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Momento {index + 1}</span><ItemActions index={index} length={phases.length} onMove={(from, to) => setPhases(moveItem(phases, from, to))} onDuplicate={() => setPhases([...phases.slice(0, index + 1), { ...phase }, ...phases.slice(index + 1)])} onRemove={() => setPhases(phases.filter((_: any, itemIndex: number) => itemIndex !== index))} /></div>
              <div className="grid grid-cols-2 gap-2"><Field label="Nombre" value={phase?.name || ""} onChange={(name) => setPhases(phases.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, name } : item))} /><Field label="Duración" value={phase?.duration || ""} onChange={(duration) => setPhases(phases.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, duration } : item))} /></div>
              <div className="mt-2"><TextArea label="Actividad" value={phase?.activity || ""} onChange={(activity) => setPhases(phases.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, activity } : item))} rows={4} /></div>
              <div className="mt-2"><TextArea label="Materiales" value={phase?.materials || ""} onChange={(materials) => setPhases(phases.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, materials } : item))} rows={2} /></div>
              <div className="mt-2"><TextArea label="Notas docentes" value={phase?.notes || ""} onChange={(notes) => setPhases(phases.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, notes } : item))} rows={2} /></div>
            </section>
          ))}
        </div>
        <AddButton label="Agregar momento" onClick={() => setPhases([...phases, { name: "Nuevo momento", duration: "10 minutos", activity: "Describe la actividad.", materials: "Materiales necesarios", notes: "Orientaciones para el docente" }])} />
      </div>
    </div>
  )
}
