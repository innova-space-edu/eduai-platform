"use client"

import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react"

type PathPart = string | number

type Props = {
  data: any
  onChange: (next: any) => void
  maxDepth?: number
}

const fieldClass = "w-full rounded-xl border border-soft bg-card-theme px-3 py-2.5 text-xs text-main outline-none placeholder:text-muted2 focus:border-blue-500/35 disabled:cursor-not-allowed disabled:opacity-45"

const LONG_TEXT_KEYS = new Set([
  "description",
  "content",
  "notes",
  "summary",
  "conclusion",
  "dialogue",
  "activity",
  "objective",
  "assessment",
  "explanation",
  "definition",
  "example",
  "hint",
  "mnemonic",
  "scene",
  "imagePrompt",
  "callToAction",
  "tagline",
])

const HIDDEN_KEYS = new Set(["_design", "_layers", "id", "hidden", "locked"])

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

function getAtPath(root: any, path: PathPart[]) {
  return path.reduce((current, part) => current?.[part as any], root)
}

function setAtPath(root: any, path: PathPart[], value: any) {
  const next = clone(root)
  if (path.length === 0) return value
  let cursor = next
  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor[path[index] as any]
  }
  cursor[path[path.length - 1] as any] = value
  return next
}

function removeAtPath(root: any, path: PathPart[]) {
  const next = clone(root)
  const parentPath = path.slice(0, -1)
  const key = path[path.length - 1]
  const parent = getAtPath(next, parentPath)
  if (Array.isArray(parent) && typeof key === "number") parent.splice(key, 1)
  else if (isRecord(parent)) delete parent[key as string]
  return next
}

function moveArrayItem(root: any, path: PathPart[], index: number, direction: -1 | 1) {
  const array = getAtPath(root, path)
  if (!Array.isArray(array)) return root
  const target = index + direction
  if (target < 0 || target >= array.length) return root
  const nextArray = [...array]
  const [item] = nextArray.splice(index, 1)
  nextArray.splice(target, 0, item)
  return setAtPath(root, path, nextArray)
}

function emptyLike(value: any): any {
  if (typeof value === "string") return "Nuevo elemento"
  if (typeof value === "number") return 0
  if (typeof value === "boolean") return false
  if (Array.isArray(value)) return []
  if (isRecord(value)) {
    const next: Record<string, any> = {}
    for (const [key, current] of Object.entries(value)) {
      if (key === "id") next[key] = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `layer-${Date.now()}`
      else if (key === "hidden" || key === "locked") next[key] = false
      else if (typeof current === "string") next[key] = LONG_TEXT_KEYS.has(key) ? "Describe el nuevo contenido." : `Nuevo ${humanize(key).toLowerCase()}`
      else next[key] = emptyLike(current)
    }
    return next
  }
  return "Nuevo elemento"
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase())
}

function itemLabel(item: any, index: number) {
  if (typeof item === "string") return item.slice(0, 70) || `Elemento ${index + 1}`
  if (!isRecord(item)) return `Elemento ${index + 1}`
  const keys = ["title", "heading", "name", "term", "label", "topic", "front", "question", "date", "speaker", "type"]
  for (const key of keys) {
    if (typeof item[key] === "string" && item[key].trim()) return item[key].slice(0, 80)
  }
  return `Capa ${index + 1}`
}

function PrimitiveField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: any
  disabled?: boolean
  onChange: (next: any) => void
}) {
  if (typeof value === "boolean") {
    return (
      <label className="flex items-center justify-between gap-3 rounded-xl border border-soft bg-card-theme px-3 py-2.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-muted2">{humanize(label)}</span>
        <input type="checkbox" checked={value} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
      </label>
    )
  }

  if (typeof value === "number") {
    return (
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-muted2">{humanize(label)}</span>
        <input type="number" value={Number.isFinite(value) ? value : 0} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className={fieldClass} />
      </label>
    )
  }

  const text = value == null ? "" : String(value)
  const long = LONG_TEXT_KEYS.has(label) || text.length > 100 || text.includes("\n")
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-muted2">{humanize(label)}</span>
      {long ? (
        <textarea value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} rows={Math.min(8, Math.max(3, Math.ceil(text.length / 100)))} className={`${fieldClass} resize-y leading-5`} />
      ) : (
        <input value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={fieldClass} />
      )}
    </label>
  )
}

function ObjectEditor({
  root,
  path,
  value,
  onChange,
  depth,
  maxDepth,
  inheritedLocked,
}: {
  root: any
  path: PathPart[]
  value: Record<string, any>
  onChange: (next: any) => void
  depth: number
  maxDepth: number
  inheritedLocked?: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const entries = Object.entries(value).filter(([key]) => !HIDDEN_KEYS.has(key))

  if (depth >= maxDepth) {
    return (
      <PrimitiveField
        label={String(path[path.length - 1] || "contenido")}
        value={JSON.stringify(value, null, 2)}
        disabled={inheritedLocked}
        onChange={(text) => {
          try { onChange(setAtPath(root, path, JSON.parse(text))) } catch {}
        }}
      />
    )
  }

  return (
    <section className="rounded-2xl border border-soft bg-card-soft-theme p-3">
      <button type="button" onClick={() => setExpanded((current) => !current)} className="flex w-full items-center gap-2 text-left">
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="text-[10px] font-black uppercase tracking-wider text-muted2">{humanize(String(path[path.length - 1] || "grupo"))}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          {entries.map(([key, child]) => (
            <ValueEditor key={key} root={root} path={[...path, key]} label={key} value={child} onChange={onChange} depth={depth + 1} maxDepth={maxDepth} inheritedLocked={inheritedLocked} />
          ))}
        </div>
      )}
    </section>
  )
}

function ArrayEditor({
  root,
  path,
  label,
  value,
  onChange,
  depth,
  maxDepth,
  inheritedLocked,
}: {
  root: any
  path: PathPart[]
  label: string
  value: any[]
  onChange: (next: any) => void
  depth: number
  maxDepth: number
  inheritedLocked?: boolean
}) {
  const [expanded, setExpanded] = useState(true)

  const addItem = () => {
    const sample = value[value.length - 1]
    const nextItem = sample === undefined ? "Nuevo elemento" : emptyLike(sample)
    onChange(setAtPath(root, path, [...value, nextItem]))
  }

  return (
    <section className="rounded-2xl border border-soft bg-card-soft-theme p-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded((current) => !current)} className="flex min-w-0 items-center gap-2 text-left">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span className="truncate text-[10px] font-black uppercase tracking-wider text-muted2">{humanize(label)} · {value.length} capas</span>
        </button>
        <button type="button" onClick={addItem} disabled={inheritedLocked} className="inline-flex items-center gap-1 rounded-lg border border-blue-500/25 bg-blue-500/5 px-2 py-1 text-[10px] font-bold text-blue-600 disabled:opacity-40"><Plus size={11} /> Agregar</button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {value.length === 0 && <p className="rounded-xl border border-dashed border-soft p-4 text-center text-xs text-muted2">No hay elementos. Agrega una nueva capa.</p>}
          {value.map((item, index) => {
            const objectItem = isRecord(item)
            const hidden = objectItem && item.hidden === true
            const locked = inheritedLocked || (objectItem && item.locked === true)
            return (
              <article key={objectItem && item.id ? item.id : index} className={`rounded-2xl border border-soft bg-card-theme p-3 ${hidden ? "opacity-50" : ""}`}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-600">{index + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-xs font-bold text-main">{itemLabel(item, index)}</p>
                  {objectItem && (
                    <>
                      <button type="button" onClick={() => onChange(setAtPath(root, [...path, index, "hidden"], !hidden))} className="rounded-lg border border-soft p-1.5 text-muted2" title={hidden ? "Mostrar capa" : "Ocultar capa"}>{hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                      <button type="button" onClick={() => onChange(setAtPath(root, [...path, index, "locked"], !item.locked))} className="rounded-lg border border-soft p-1.5 text-muted2" title={locked ? "Desbloquear capa" : "Bloquear capa"}>{locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
                    </>
                  )}
                  <button type="button" onClick={() => onChange(moveArrayItem(root, path, index, -1))} disabled={index === 0} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowUp size={12} /></button>
                  <button type="button" onClick={() => onChange(moveArrayItem(root, path, index, 1))} disabled={index === value.length - 1} className="rounded-lg border border-soft p-1.5 text-muted2 disabled:opacity-25"><ArrowDown size={12} /></button>
                  <button type="button" onClick={() => onChange(setAtPath(root, path, [...value.slice(0, index + 1), clone(item), ...value.slice(index + 1)]))} className="rounded-lg border border-soft p-1.5 text-muted2"><Copy size={12} /></button>
                  <button type="button" onClick={() => onChange(removeAtPath(root, [...path, index]))} className="rounded-lg border border-red-500/20 p-1.5 text-red-500"><Trash2 size={12} /></button>
                </div>

                {objectItem ? (
                  <div className="space-y-3">
                    {Object.entries(item).filter(([key]) => !HIDDEN_KEYS.has(key)).map(([key, child]) => (
                      <ValueEditor key={key} root={root} path={[...path, index, key]} label={key} value={child} onChange={onChange} depth={depth + 1} maxDepth={maxDepth} inheritedLocked={locked} />
                    ))}
                  </div>
                ) : (
                  <PrimitiveField label={`Elemento ${index + 1}`} value={item} disabled={inheritedLocked} onChange={(next) => onChange(setAtPath(root, [...path, index], next))} />
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ValueEditor({
  root,
  path,
  label,
  value,
  onChange,
  depth,
  maxDepth,
  inheritedLocked,
}: {
  root: any
  path: PathPart[]
  label: string
  value: any
  onChange: (next: any) => void
  depth: number
  maxDepth: number
  inheritedLocked?: boolean
}) {
  if (Array.isArray(value)) return <ArrayEditor root={root} path={path} label={label} value={value} onChange={onChange} depth={depth} maxDepth={maxDepth} inheritedLocked={inheritedLocked} />
  if (isRecord(value)) return <ObjectEditor root={root} path={path} value={value} onChange={onChange} depth={depth} maxDepth={maxDepth} inheritedLocked={inheritedLocked} />
  return <PrimitiveField label={label} value={value} disabled={inheritedLocked} onChange={(next) => onChange(setAtPath(root, path, next))} />
}

export function prepareVisibleCreatorData(value: any, isRoot = true): any {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(isRecord(item) && item.hidden === true))
      .map((item) => prepareVisibleCreatorData(item, false))
  }
  if (!isRecord(value)) return value

  const hiddenRootLayers = isRoot && isRecord(value._layers)
    ? new Set(Object.entries(value._layers).filter(([, meta]) => isRecord(meta) && meta.hidden === true).map(([key]) => key))
    : new Set<string>()

  const next: Record<string, any> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === "hidden" || key === "locked" || key === "_layers") continue
    if (hiddenRootLayers.has(key)) continue
    next[key] = prepareVisibleCreatorData(child, false)
  }
  return next
}

export default function UniversalLayerEditor({ data, onChange, maxDepth = 5 }: Props) {
  const rootLayers = isRecord(data?._layers) ? data._layers : {}
  const entries = useMemo(() => Object.entries(data || {}).filter(([key]) => !HIDDEN_KEYS.has(key)), [data])

  const updateRootLayer = (key: string, patch: Record<string, any>) => {
    onChange({
      ...data,
      _layers: {
        ...rootLayers,
        [key]: { ...(rootLayers[key] || {}), ...patch },
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
        <p className="text-xs font-bold text-violet-600">Editor universal por capas</p>
        <p className="mt-1 text-[11px] leading-5 text-muted2">Todos los campos y colecciones del material son editables. Las capas se pueden ocultar, bloquear, duplicar y reordenar sin perder el esquema original.</p>
      </div>

      {entries.map(([key, value]) => {
        const meta = isRecord(rootLayers[key]) ? rootLayers[key] : {}
        const hidden = meta.hidden === true
        const locked = meta.locked === true
        return (
          <section key={key} className={`rounded-3xl border border-soft bg-card-theme p-3.5 ${hidden ? "opacity-50" : ""}`}>
            <div className="mb-3 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-black uppercase tracking-wider text-main">{humanize(key)}</p>
              <button type="button" onClick={() => updateRootLayer(key, { hidden: !hidden })} className="rounded-lg border border-soft p-1.5 text-muted2" title={hidden ? "Mostrar sección" : "Ocultar sección"}>{hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>
              <button type="button" onClick={() => updateRootLayer(key, { locked: !locked })} className="rounded-lg border border-soft p-1.5 text-muted2" title={locked ? "Desbloquear sección" : "Bloquear sección"}>{locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
            </div>
            <ValueEditor root={data} path={[key]} label={key} value={value} onChange={onChange} depth={0} maxDepth={maxDepth} inheritedLocked={locked} />
          </section>
        )
      })}
    </div>
  )
}
