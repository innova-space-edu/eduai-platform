"use client"

import { getCompatibleDesignTemplates, getDefaultDesignTemplateId } from "@/lib/design-templates/registry"

interface TemplatePickerProps {
  format?: string
  value?: string
  onChange: (templateId: string, accentColor?: string) => void
  compact?: boolean
}

export default function TemplatePicker({ format, value, onChange, compact = false }: TemplatePickerProps) {
  const templates = getCompatibleDesignTemplates(format)
  const activeId = value || getDefaultDesignTemplateId(format)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-muted2 text-[11px] font-semibold tracking-widest block">
          PLANTILLA VISUAL EDUAI
        </label>
        <span className="text-[10px] text-muted2 hidden sm:inline">
          Motor propio tipo Presenton/Canva
        </span>
      </div>

      <div className={compact ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"}>
        {templates.map((template) => {
          const selected = activeId === template.id
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange(template.id, template.accentColor)}
              className="group text-left rounded-2xl border p-3 transition-all overflow-hidden relative"
              style={{
                background: selected ? `${template.accentColor}12` : "var(--bg-card-soft)",
                borderColor: selected ? `${template.accentColor}55` : "var(--border-soft)",
                boxShadow: selected ? `0 10px 24px ${template.accentColor}14` : "none",
              }}
            >
              <div
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl pointer-events-none"
                style={{ background: template.accentColor }}
              />

              <div className="relative flex items-start gap-3">
                <div
                  className="h-10 w-10 rounded-xl border flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${template.palette.primary}, ${template.palette.secondary})`,
                    borderColor: `${template.accentColor}50`,
                  }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-main font-bold text-xs truncate">{template.shortName}</p>
                    {selected && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
                        style={{ background: `${template.accentColor}18`, color: template.accentColor }}
                      >
                        Activa
                      </span>
                    )}
                  </div>
                  <p className="text-muted2 text-[11px] leading-relaxed mt-1 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                        style={{ background: `${template.accentColor}10`, color: template.accentColor }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
