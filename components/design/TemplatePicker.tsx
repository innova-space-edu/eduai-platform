"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { FilePlus2, LoaderCircle, Plus } from "lucide-react"
import { getCompatibleDesignTemplates } from "@/lib/design-templates/registry"

export type TemplatePickerSelection = {
  id: string
  name: string
  kind: "blank" | "custom" | "builtin"
  formats?: string[]
  accentColor?: string
  secondaryColor?: string
  instructions?: string | null
  imageUrl?: string | null
  fileUrl?: string | null
  fileKind?: string | null
  fileName?: string | null
}

interface TemplatePickerProps {
  format?: string
  value?: string
  onChange: (templateId: string, accentColor?: string, template?: TemplatePickerSelection) => void
  compact?: boolean
  showBuiltIn?: boolean
}

type CustomTemplate = {
  id: string
  name: string
  formats?: string[]
  accentColor?: string
  secondaryColor?: string
  instructions?: string | null
  imageUrl?: string | null
  fileUrl?: string | null
  fileKind?: string | null
  fileName?: string | null
  isCreatorTemplate?: boolean
  hasVisualPreview?: boolean
}

const blankTemplate: TemplatePickerSelection = {
  id: "blank",
  name: "Lienzo en blanco",
  kind: "blank",
  accentColor: "#334155",
  secondaryColor: "#94a3b8",
}

export default function TemplatePicker({ format, value, onChange, compact = false, showBuiltIn = false }: TemplatePickerProps) {
  const builtInTemplates = showBuiltIn ? getCompatibleDesignTemplates(format) : []
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const normalizedValueRef = useRef<string | null>(null)
  const activeId = value?.startsWith("custom:") || (showBuiltIn && value) ? value : "blank"

  useEffect(() => {
    if (showBuiltIn || !value || value === "blank" || value.startsWith("custom:")) {
      normalizedValueRef.current = null
      return
    }
    if (normalizedValueRef.current === value) return
    normalizedValueRef.current = value
    onChange("blank", blankTemplate.accentColor, blankTemplate)
  }, [onChange, showBuiltIn, value])

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch("/api/creative-templates", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || "No fue posible cargar plantillas")
        return payload
      })
      .then((payload) => {
        if (!active) return
        setCustomTemplates((payload?.templates || []).filter((template: CustomTemplate) => {
          if (!template.isCreatorTemplate) return false
          if (!format) return true
          const formats = Array.isArray(template.formats) ? template.formats : []
          return formats.length === 0 || formats.includes(format)
        }))
      })
      .catch(() => {
        if (active) setCustomTemplates([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [format])

  const gridClass = compact ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
  const custom = useMemo(() => customTemplates.map((template) => ({ ...template, pickerId: `custom:${template.id}` })), [customTemplates])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-[11px] font-semibold tracking-widest text-muted2">PLANTILLA BASE</label>
        <Link href="/creator-hub/templates" className="inline-flex items-center gap-1 text-[10px] font-bold text-sub hover:text-main"><Plus size={11} /> Subir plantilla</Link>
      </div>

      <div className={gridClass}>
        <button type="button" onClick={() => onChange("blank", blankTemplate.accentColor, blankTemplate)} className="group rounded-2xl border p-3 text-left transition-all" style={{ borderColor: activeId === "blank" ? "rgba(37,99,235,.42)" : "var(--border-soft)", background: "var(--bg-card-soft)" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-soft bg-white text-slate-500"><FilePlus2 size={18} /></div>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-bold text-main">Lienzo en blanco</p>{activeId === "blank" && <span className="rounded-full border border-blue-500/25 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-blue-600">Activa</span>}</div><p className="mt-1 text-[11px] leading-relaxed text-muted2">Empieza sin fondo y construye el diseño directamente en el lienzo.</p></div>
          </div>
        </button>

        {custom.map((template) => {
          const selected = activeId === template.pickerId
          const accent = template.accentColor || "#334155"
          const secondary = template.secondaryColor || "#94a3b8"
          const selection: TemplatePickerSelection = {
            id: template.pickerId,
            name: template.name,
            kind: "custom",
            formats: template.formats,
            accentColor: accent,
            secondaryColor: secondary,
            instructions: template.instructions,
            imageUrl: template.imageUrl,
            fileUrl: template.fileUrl,
            fileKind: template.fileKind,
            fileName: template.fileName,
          }
          return (
            <button key={template.pickerId} type="button" onClick={() => onChange(template.pickerId, accent, selection)} className="group relative overflow-hidden rounded-2xl border p-3 text-left transition-all" style={{ borderColor: selected ? `${accent}66` : "var(--border-soft)", boxShadow: selected ? `0 8px 22px ${accent}14` : "none", background: "var(--bg-card-soft)" }}>
              <div className="relative flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-soft bg-white">{template.imageUrl ? <img src={template.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-base" style={{ color: accent }}>✦</span>}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="truncate text-xs font-bold text-main">{template.name}</p>{selected && <span className="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ borderColor: `${accent}45`, color: accent }}>Activa</span>}</div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted2">{template.instructions || template.fileName || "Plantilla personalizada"}</p>
                  <div className="mt-2 flex flex-wrap gap-1"><span className="rounded-full border border-soft px-2 py-0.5 text-[9px] font-semibold text-muted2">{template.fileKind || "archivo"}</span><span className="rounded-full border border-soft px-2 py-0.5 text-[9px] font-semibold" style={{ color: template.imageUrl ? "#059669" : secondary }}>{template.imageUrl ? "fondo listo" : "referencia"}</span></div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {loading && <div className="flex items-center gap-2 text-[10px] text-muted2"><LoaderCircle size={12} className="animate-spin" /> Cargando plantillas...</div>}

      {showBuiltIn && builtInTemplates.length > 0 && (
        <details className="rounded-2xl border border-soft p-3">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-muted2">Diseños básicos</summary>
          <div className={`${gridClass} mt-3`}>
            {builtInTemplates.map((template) => {
              const selected = activeId === template.id
              const selection: TemplatePickerSelection = { id: template.id, name: template.shortName, kind: "builtin", accentColor: template.accentColor, secondaryColor: template.palette.secondary }
              return <button key={template.id} type="button" onClick={() => onChange(template.id, template.accentColor, selection)} className="rounded-xl border p-3 text-left" style={{ borderColor: selected ? `${template.accentColor}55` : "var(--border-soft)" }}><p className="text-xs font-bold text-main">{template.shortName}</p><p className="mt-1 line-clamp-2 text-[10px] text-muted2">{template.description}</p></button>
            })}
          </div>
        </details>
      )}
    </div>
  )
}
