"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { LoaderCircle, Plus } from "lucide-react"
import { getCompatibleDesignTemplates, getDefaultDesignTemplateId } from "@/lib/design-templates/registry"

interface TemplatePickerProps {
  format?: string
  value?: string
  onChange: (templateId: string, accentColor?: string) => void
  compact?: boolean
}

type CustomTemplate = {
  id: string
  name: string
  formats?: string[]
  accentColor?: string
  secondaryColor?: string
  instructions?: string | null
  imageUrl?: string | null
  fileKind?: string | null
  fileName?: string | null
  isCreatorTemplate?: boolean
}

export default function TemplatePicker({ format, value, onChange, compact = false }: TemplatePickerProps) {
  const templates = getCompatibleDesignTemplates(format)
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const activeId = value || getDefaultDesignTemplateId(format)

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
        <label className="block text-[11px] font-semibold tracking-widest text-muted2">PLANTILLA VISUAL</label>
        <Link href="/creator-hub/templates" className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-500"><Plus size={11} /> Subir plantilla</Link>
      </div>

      {custom.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Mis plantillas sincronizadas</span><span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold text-violet-600">{custom.length}</span></div>
          <div className={gridClass}>
            {custom.map((template) => {
              const selected = activeId === template.pickerId
              const accent = template.accentColor || "#7c3aed"
              const secondary = template.secondaryColor || "#06b6d4"
              return (
                <button
                  key={template.pickerId}
                  type="button"
                  onClick={() => onChange(template.pickerId, accent)}
                  className="group relative overflow-hidden rounded-2xl border p-3 text-left transition-all"
                  style={{
                    background: selected ? `${accent}12` : "var(--bg-card-soft)",
                    borderColor: selected ? `${accent}55` : "var(--border-soft)",
                    boxShadow: selected ? `0 10px 24px ${accent}14` : "none",
                  }}
                >
                  <div className="relative flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border" style={{ background: `linear-gradient(135deg,${accent},${secondary})`, borderColor: `${accent}50` }}>
                      {template.imageUrl ? <img src={template.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-base text-white">✦</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="truncate text-xs font-bold text-main">{template.name}</p>{selected && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: `${accent}18`, color: accent }}>Activa</span>}</div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted2">{template.instructions || template.fileName || "Plantilla personalizada"}</p>
                      <div className="mt-2 flex flex-wrap gap-1"><span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: `${accent}10`, color: accent }}>{template.fileKind || "archivo"}</span><span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: `${secondary}10`, color: secondary }}>sincronizada</span></div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-muted2">Plantillas EduAI</span>{loading && <LoaderCircle size={12} className="animate-spin text-muted2" />}</div>
        <div className={gridClass}>
          {templates.map((template) => {
            const selected = activeId === template.id
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onChange(template.id, template.accentColor)}
                className="group relative overflow-hidden rounded-2xl border p-3 text-left transition-all"
                style={{
                  background: selected ? `${template.accentColor}12` : "var(--bg-card-soft)",
                  borderColor: selected ? `${template.accentColor}55` : "var(--border-soft)",
                  boxShadow: selected ? `0 10px 24px ${template.accentColor}14` : "none",
                }}
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: template.accentColor }} />
                <div className="relative flex items-start gap-3">
                  <div className="h-10 w-10 flex-shrink-0 rounded-xl border" style={{ background: `linear-gradient(135deg, ${template.palette.primary}, ${template.palette.secondary})`, borderColor: `${template.accentColor}50` }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-xs font-bold text-main">{template.shortName}</p>{selected && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ background: `${template.accentColor}18`, color: template.accentColor }}>Activa</span>}</div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted2">{template.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{template.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: `${template.accentColor}10`, color: template.accentColor }}>{tag}</span>)}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
