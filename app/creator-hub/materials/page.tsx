"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Search, Sparkles, X } from "lucide-react"
import { CREATOR_HUB_CATEGORIES, CREATOR_HUB_FORMATS, type CreatorHubFormatCategory } from "@/components/creator-hub/catalog"

export default function CreatorHubMaterialsPage() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<CreatorHubFormatCategory | "all">("all")

  const formats = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return CREATOR_HUB_FORMATS.filter((format) => {
      const categoryMatches = category === "all" || format.category === category
      if (!categoryMatches) return false
      if (!normalized) return true
      return [format.label, format.description, ...format.highlights].join(" ").toLowerCase().includes(normalized)
    })
  }, [category, query])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-7 py-4">
          <div className="flex items-center gap-2 text-violet-500 text-xs font-bold tracking-widest uppercase"><Sparkles size={14} /> Crear materiales</div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mt-2">
            <div>
              <h1 className="text-main text-xl sm:text-2xl font-bold">Todos los formatos, bien organizados</h1>
              <p className="text-muted2 text-sm mt-1">No se eliminó ninguna función. Elige un formato y trabaja desde tema, texto, URL, PDF o DOCX.</p>
            </div>
            <div className="relative w-full lg:w-[360px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar formato o utilidad..." className="w-full rounded-xl border border-soft bg-card-theme pl-9 pr-9 py-2.5 text-sm text-main outline-none focus:border-blue-500/30" />
              {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2 hover:text-main"><X size={14} /></button>}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-7 py-7 sm:py-9">
        <div className="flex flex-wrap gap-2 mb-7">
          <button onClick={() => setCategory("all")} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-all" style={{ background: category === "all" ? "rgba(37,99,235,0.10)" : "var(--bg-card)", borderColor: category === "all" ? "rgba(37,99,235,0.24)" : "var(--border-soft)", color: category === "all" ? "#2563eb" : "var(--text-muted)" }}>Todos ({CREATOR_HUB_FORMATS.length})</button>
          {CREATOR_HUB_CATEGORIES.map((item) => {
            const count = CREATOR_HUB_FORMATS.filter((format) => format.category === item.id).length
            return <button key={item.id} onClick={() => setCategory(item.id)} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-all" style={{ background: category === item.id ? "rgba(124,58,237,0.10)" : "var(--bg-card)", borderColor: category === item.id ? "rgba(124,58,237,0.24)" : "var(--border-soft)", color: category === item.id ? "#7c3aed" : "var(--text-muted)" }}>{item.icon} {item.label} ({count})</button>
          })}
        </div>

        {formats.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-soft bg-card-theme p-10 text-center">
            <p className="text-main font-bold">No encontramos coincidencias</p>
            <p className="text-muted2 text-sm mt-1">Prueba con otra palabra o restablece el filtro.</p>
          </div>
        ) : (
          <div className="space-y-9">
            {CREATOR_HUB_CATEGORIES.map((item) => {
              const group = formats.filter((format) => format.category === item.id)
              if (group.length === 0) return null
              return (
                <section id={item.id} key={item.id} className="scroll-mt-24">
                  <div className="flex items-end justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted2">{item.icon} {item.label}</p>
                      <h2 className="text-main text-lg font-bold mt-1">{item.description}</h2>
                    </div>
                    <span className="text-muted2 text-xs">{group.length} formato{group.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.map((format) => (
                      <Link key={format.id} href={`/creator-hub/${format.id}`} className="group rounded-3xl border border-soft bg-card-theme hover:bg-card-soft-theme transition-all p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${format.color}14`, border: `1px solid ${format.color}24` }}>{format.icon}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-main text-sm font-bold">{format.label}</h3>
                              <ArrowRight size={15} style={{ color: format.color }} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                            <p className="text-muted2 text-xs leading-relaxed mt-1.5">{format.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-4">
                          {format.highlights.map((feature) => <span key={feature} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: `${format.color}0d`, color: format.color }}>{feature}</span>)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
