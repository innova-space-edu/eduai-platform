"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react"

type EditorProps = {
  data: any
  onChange: (next: any) => void
}

const fieldClass = "w-full rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-main outline-none placeholder:text-muted2 focus:border-blue-500/30"
const labelClass = "text-[10px] font-bold uppercase tracking-[0.14em] text-muted2"

const NODE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"]

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

function makeId(prefix: string, existing: string[]) {
  let index = existing.length + 1
  let value = `${prefix}-${index}`
  while (existing.includes(value)) {
    index += 1
    value = `${prefix}-${index}`
  }
  return value
}

function splitComma(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

export function MindmapContentEditor({ data, onChange }: EditorProps) {
  const nodes = Array.isArray(data?.nodes) ? data.nodes : []
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (selectedIndex >= nodes.length) setSelectedIndex(Math.max(0, nodes.length - 1))
  }, [nodes.length, selectedIndex])

  const selected = nodes[selectedIndex]
  const patch = (next: Record<string, unknown>) => onChange({ ...data, ...next })
  const setNodes = (next: any[]) => patch({ nodes: next })

  const updateNode = (index: number, nodePatch: Record<string, unknown>) => {
    setNodes(nodes.map((node: any, nodeIndex: number) => nodeIndex === index ? { ...node, ...nodePatch } : node))
  }

  const addNode = () => {
    const ids = nodes.map((node: any) => String(node.id || ""))
    const id = makeId("node", ids)
    const main = nodes.find((node: any) => node.category === "main")
    const next = [
      ...nodes,
      {
        id,
        label: "Nuevo concepto",
        description: "Describe aquí la relación de este concepto con el tema central.",
        category: main ? "sub" : "main",
        color: NODE_COLORS[nodes.length % NODE_COLORS.length],
        importance: main ? 2 : 3,
        connections: main ? [main.id] : [],
        edgeLabels: main ? ["se relaciona con"] : [],
      },
    ]
    setNodes(next)
    setSelectedIndex(next.length - 1)
  }

  const duplicateNode = () => {
    if (!selected) return
    const ids = nodes.map((node: any) => String(node.id || ""))
    const copy = {
      ...JSON.parse(JSON.stringify(selected)),
      id: makeId("node", ids),
      label: `${selected.label || "Concepto"} — copia`,
    }
    const next = [...nodes]
    next.splice(selectedIndex + 1, 0, copy)
    setNodes(next)
    setSelectedIndex(selectedIndex + 1)
  }

  const removeNode = () => {
    if (!selected || nodes.length <= 1) return
    const removedId = String(selected.id || "")
    const next = nodes
      .filter((_: any, index: number) => index !== selectedIndex)
      .map((node: any) => {
        const connections = Array.isArray(node.connections) ? node.connections : []
        const edgeLabels = Array.isArray(node.edgeLabels) ? node.edgeLabels : []
        const keptConnections: string[] = []
        const keptLabels: string[] = []
        connections.forEach((connection: string, connectionIndex: number) => {
          if (connection === removedId) return
          keptConnections.push(connection)
          if (edgeLabels[connectionIndex]) keptLabels.push(edgeLabels[connectionIndex])
        })
        return { ...node, connections: keptConnections, edgeLabels: keptLabels }
      })
    setNodes(next)
  }

  const moveSelected = (direction: -1 | 1) => {
    const next = moveItem(nodes, selectedIndex, direction)
    if (next === nodes) return
    setNodes(next)
    setSelectedIndex(selectedIndex + direction)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <p className="text-xs font-bold text-emerald-600">Editor de mapa mental</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted2">Ajusta conceptos, niveles, conexiones y relaciones sin volver a generar el mapa completo.</p>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>Tema central</span>
        <textarea value={data?.centralTopic || ""} onChange={(event) => patch({ centralTopic: event.target.value })} rows={2} className={`${fieldClass} resize-y`} />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-main">Conceptos</p>
            <p className="text-[10px] text-muted2">Cada identificador se utiliza para crear las conexiones.</p>
          </div>
          <button type="button" onClick={addNode} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs font-bold text-emerald-600"><Plus size={13} /> Concepto</button>
        </div>

        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {nodes.map((node: any, index: number) => (
            <button key={node.id || index} type="button" onClick={() => setSelectedIndex(index)} className="w-full rounded-xl border p-2.5 text-left transition" style={{ borderColor: selectedIndex === index ? `${node.color || "#10b981"}66` : "var(--border-soft)", background: selectedIndex === index ? `${node.color || "#10b981"}12` : "var(--bg-card-soft)" }}>
              <span className="block text-[10px] font-black" style={{ color: node.color || "#10b981" }}>{node.id || `node-${index + 1}`} · {node.category || "sub"}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-sub">{node.label || "Sin concepto"}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 rounded-2xl border border-soft bg-card-soft-theme p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted2">Editar {selected.id}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex === 0} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === nodes.length - 1} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button>
              <button type="button" onClick={duplicateNode} className="rounded-lg border border-soft p-1.5 text-muted2"><Copy size={12} /></button>
              <button type="button" onClick={removeNode} disabled={nodes.length <= 1} className="rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button>
            </div>
          </div>

          <label className="space-y-1.5">
            <span className={labelClass}>Concepto</span>
            <input value={selected.label || ""} onChange={(event) => updateNode(selectedIndex, { label: event.target.value })} className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Descripción</span>
            <textarea value={selected.description || ""} onChange={(event) => updateNode(selectedIndex, { description: event.target.value })} rows={4} className={`${fieldClass} resize-y`} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className={labelClass}>Nivel</span>
              <select value={selected.category || "sub"} onChange={(event) => updateNode(selectedIndex, { category: event.target.value })} className={fieldClass}>
                <option value="main">Principal</option>
                <option value="sub">Subconcepto</option>
                <option value="detail">Detalle</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Importancia</span>
              <select value={selected.importance || 1} onChange={(event) => updateNode(selectedIndex, { importance: Number(event.target.value) })} className={fieldClass}>
                <option value={1}>1 · Complementario</option>
                <option value={2}>2 · Importante</option>
                <option value={3}>3 · Central</option>
              </select>
            </label>
          </div>

          <label className="space-y-1.5">
            <span className={labelClass}>Color</span>
            <div className="flex gap-2">
              <input type="color" value={selected.color || "#10b981"} onChange={(event) => updateNode(selectedIndex, { color: event.target.value })} className="h-9 w-12 rounded-lg border border-soft bg-card-theme p-1" />
              <input value={selected.color || ""} onChange={(event) => updateNode(selectedIndex, { color: event.target.value })} className={fieldClass} />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className={labelClass}>Conexiones · IDs separados por coma</span>
            <input value={Array.isArray(selected.connections) ? selected.connections.join(", ") : ""} onChange={(event) => updateNode(selectedIndex, { connections: splitComma(event.target.value) })} placeholder="node-1, node-2" className={fieldClass} />
            <span className="block text-[9px] leading-relaxed text-muted2">Disponibles: {nodes.filter((_: any, index: number) => index !== selectedIndex).map((node: any) => node.id).join(", ") || "ninguno"}</span>
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>Etiquetas de relación · mismo orden</span>
            <input value={Array.isArray(selected.edgeLabels) ? selected.edgeLabels.join(", ") : ""} onChange={(event) => updateNode(selectedIndex, { edgeLabels: splitComma(event.target.value) })} placeholder="causa de, parte de" className={fieldClass} />
          </label>
        </div>
      )}
    </div>
  )
}

export function TimelineContentEditor({ data, onChange }: EditorProps) {
  const events = Array.isArray(data?.events) ? data.events : []
  const links = Array.isArray(data?.causalLinks) ? data.causalLinks : []
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (selectedIndex >= events.length) setSelectedIndex(Math.max(0, events.length - 1))
  }, [events.length, selectedIndex])

  const selected = events[selectedIndex]
  const patch = (next: Record<string, unknown>) => onChange({ ...data, ...next })
  const setEvents = (next: any[]) => patch({ events: next })
  const setLinks = (next: any[]) => patch({ causalLinks: next })

  const updateEvent = (index: number, eventPatch: Record<string, unknown>) => {
    const oldTitle = String(events[index]?.title || "")
    const nextEvents = events.map((event: any, eventIndex: number) => eventIndex === index ? { ...event, ...eventPatch } : event)
    if (typeof eventPatch.title === "string" && eventPatch.title !== oldTitle) {
      const nextLinks = links.map((link: any) => ({
        ...link,
        from: link.from === oldTitle ? eventPatch.title : link.from,
        to: link.to === oldTitle ? eventPatch.title : link.to,
      }))
      onChange({ ...data, events: nextEvents, causalLinks: nextLinks })
      return
    }
    setEvents(nextEvents)
  }

  const addEvent = () => {
    const next = [
      ...events,
      {
        date: "Nueva fecha",
        title: `Nuevo hito ${events.length + 1}`,
        description: "Describe aquí qué ocurrió, su contexto y sus consecuencias.",
        impact: "Impacto principal",
        importance: "medium",
        icon: "📌",
      },
    ]
    setEvents(next)
    setSelectedIndex(next.length - 1)
  }

  const duplicateEvent = () => {
    if (!selected) return
    const copy = { ...JSON.parse(JSON.stringify(selected)), title: `${selected.title || "Hito"} — copia` }
    const next = [...events]
    next.splice(selectedIndex + 1, 0, copy)
    setEvents(next)
    setSelectedIndex(selectedIndex + 1)
  }

  const removeEvent = () => {
    if (!selected || events.length <= 1) return
    const removedTitle = selected.title
    const nextEvents = events.filter((_: any, index: number) => index !== selectedIndex)
    const nextLinks = links.filter((link: any) => link.from !== removedTitle && link.to !== removedTitle)
    onChange({ ...data, events: nextEvents, causalLinks: nextLinks })
  }

  const moveSelected = (direction: -1 | 1) => {
    const next = moveItem(events, selectedIndex, direction)
    if (next === events) return
    setEvents(next)
    setSelectedIndex(selectedIndex + direction)
  }

  const addLink = () => {
    if (events.length < 2) return
    setLinks([...links, { from: events[0]?.title || "", to: events[1]?.title || "", label: "causó" }])
  }

  const updateLink = (index: number, linkPatch: Record<string, unknown>) => {
    setLinks(links.map((link: any, linkIndex: number) => linkIndex === index ? { ...link, ...linkPatch } : link))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
        <p className="text-xs font-bold text-orange-600">Editor de línea de tiempo</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted2">Corrige fechas, reorganiza hitos y registra relaciones causales entre acontecimientos.</p>
      </div>

      <div className="grid gap-3">
        <label className="space-y-1.5">
          <span className={labelClass}>Título</span>
          <input value={data?.title || ""} onChange={(event) => patch({ title: event.target.value })} className={fieldClass} />
        </label>
        <label className="space-y-1.5">
          <span className={labelClass}>Periodo</span>
          <input value={data?.period || ""} onChange={(event) => patch({ period: event.target.value })} placeholder="Ej: 1810–1823" className={fieldClass} />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-xs font-bold text-main">Hitos</p><p className="text-[10px] text-muted2">El orden de la lista define el orden visual.</p></div>
          <button type="button" onClick={addEvent} className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/25 bg-orange-500/5 px-3 py-2 text-xs font-bold text-orange-600"><Plus size={13} /> Hito</button>
        </div>
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {events.map((event: any, index: number) => (
            <button key={`${event.title}-${index}`} type="button" onClick={() => setSelectedIndex(index)} className="w-full rounded-xl border p-2.5 text-left transition" style={{ borderColor: selectedIndex === index ? "rgba(249,115,22,0.40)" : "var(--border-soft)", background: selectedIndex === index ? "rgba(249,115,22,0.08)" : "var(--bg-card-soft)" }}>
              <span className="block text-[10px] font-black text-orange-600">{event.date || "Sin fecha"} · {event.importance || "medium"}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-sub">{event.icon || "📌"} {event.title || "Sin título"}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 rounded-2xl border border-soft bg-card-soft-theme p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted2">Editar hito {selectedIndex + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex === 0} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex === events.length - 1} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button>
              <button type="button" onClick={duplicateEvent} className="rounded-lg border border-soft p-1.5 text-muted2"><Copy size={12} /></button>
              <button type="button" onClick={removeEvent} disabled={events.length <= 1} className="rounded-lg border border-red-500/20 p-1.5 text-red-500 disabled:opacity-25"><Trash2 size={12} /></button>
            </div>
          </div>

          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
            <label className="space-y-1.5"><span className={labelClass}>Ícono</span><input value={selected.icon || ""} onChange={(event) => updateEvent(selectedIndex, { icon: event.target.value })} maxLength={8} className={`${fieldClass} text-center text-base`} /></label>
            <label className="space-y-1.5"><span className={labelClass}>Fecha</span><input value={selected.date || ""} onChange={(event) => updateEvent(selectedIndex, { date: event.target.value })} className={fieldClass} /></label>
          </div>
          <label className="space-y-1.5"><span className={labelClass}>Título</span><input value={selected.title || ""} onChange={(event) => updateEvent(selectedIndex, { title: event.target.value })} className={fieldClass} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Descripción</span><textarea value={selected.description || ""} onChange={(event) => updateEvent(selectedIndex, { description: event.target.value })} rows={5} className={`${fieldClass} resize-y`} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Impacto</span><textarea value={selected.impact || ""} onChange={(event) => updateEvent(selectedIndex, { impact: event.target.value })} rows={2} className={`${fieldClass} resize-y`} /></label>
          <label className="space-y-1.5"><span className={labelClass}>Importancia</span><select value={selected.importance || "medium"} onChange={(event) => updateEvent(selectedIndex, { importance: event.target.value })} className={fieldClass}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Complementaria</option></select></label>
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-soft bg-card-soft-theme p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-xs font-bold text-main">Relaciones causales</p><p className="text-[10px] text-muted2">Conecta hitos usando sus títulos actuales.</p></div>
          <button type="button" onClick={addLink} disabled={events.length < 2} className="inline-flex items-center gap-1 rounded-xl border border-orange-500/20 px-2.5 py-1.5 text-[10px] font-bold text-orange-600 disabled:opacity-30"><Plus size={11} /> Relación</button>
        </div>
        {links.length === 0 && <p className="rounded-xl border border-dashed border-soft p-3 text-center text-[10px] text-muted2">No hay relaciones causales registradas.</p>}
        {links.map((link: any, index: number) => (
          <div key={index} className="space-y-2 rounded-xl border border-soft bg-card-theme p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <select value={link.from || ""} onChange={(event) => updateLink(index, { from: event.target.value })} className={fieldClass}>{events.map((event: any, eventIndex: number) => <option key={eventIndex} value={event.title}>{event.title}</option>)}</select>
              <select value={link.to || ""} onChange={(event) => updateLink(index, { to: event.target.value })} className={fieldClass}>{events.map((event: any, eventIndex: number) => <option key={eventIndex} value={event.title}>{event.title}</option>)}</select>
            </div>
            <div className="flex gap-2"><input value={link.label || ""} onChange={(event) => updateLink(index, { label: event.target.value })} placeholder="causó / permitió / aceleró" className={fieldClass} /><button type="button" onClick={() => setLinks(links.filter((_: any, linkIndex: number) => linkIndex !== index))} className="rounded-lg border border-red-500/20 p-2 text-red-500"><Trash2 size={12} /></button></div>
          </div>
        ))}
      </div>
    </div>
  )
}
