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
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600"><Sparkles size={14} /> Crear materiales</div>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><h1 className="text-xl font-bold text-main sm:text-2xl">Formatos de creación</h1><p className="mt-1 text-sm text-muted2">Elige un formato y trabaja desde tema, texto, URL, PDF o DOCX.</p></div>
            <div className="relative w-full lg:w-[360px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar formato o utilidad..." className="w-full rounded-xl border border-soft bg-card-theme py-2.5 pl-9 pr-9 text-sm text-main outline-none focus:border-blue-500/30" />{query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2 hover:text-main"><X size={14} /></button>}</div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-7 sm:py-9">
        <div className="mb-7 flex flex-wrap gap-2">
          <button onClick={() => setCategory("all")} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors" style={{ borderColor: category === "all" ? "rgba(37,99,235,.35)" : "var(--border-soft)", color: category === "all" ? "#2563eb" : "var(--text-muted)" }}>Todos ({CREATOR_HUB_FORMATS.length})</button>
          {CREATOR_HUB_CATEGORIES.map((item) => {
            const count = CREATOR_HUB_FORMATS.filter((format) => format.category === item.id).length
            return <button key={item.id} onClick={() => setCategory(item.id)} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors" style={{ borderColor: category === item.id ? "rgba(51,65,85,.38)" : "var(--border-soft)", color: category === item.id ? "#334155" : "var(--text-muted)" }}>{item.icon} {item.label} ({count})</button>
          })}
        </div>

        {formats.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-soft bg-card-theme p-10 text-center"><p className="font-bold text-main">No encontramos coincidencias</p><p className="mt-1 text-sm text-muted2">Prueba con otra palabra o restablece el filtro.</p></div>
        ) : (
          <div className="space-y-9">
            {CREATOR_HUB_CATEGORIES.map((item) => {
              const group = formats.filter((format) => format.category === item.id)
              if (group.length === 0) return null
              return (
                <section id={item.id} key={item.id} className="scroll-mt-24">
                  <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">{item.icon} {item.label}</p><h2 className="mt-1 text-lg font-bold text-main">{item.description}</h2></div><span className="text-xs text-muted2">{group.length} formato{group.length === 1 ? "" : "s"}</span></div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.map((format) => (
                      <Link key={format.id} href={`/creator-hub/${format.id}`} className="group rounded-3xl border border-soft bg-card-theme p-5 transition-all hover:bg-card-soft-theme">
                        <div className="flex items-start gap-4"><div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ border: `1px solid ${format.color}24` }}>{format.icon}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-main">{format.label}</h3><ArrowRight size={15} style={{ color: format.color }} className="transition-transform group-hover:translate-x-1" /></div><p className="mt-1.5 text-xs leading-relaxed text-muted2">{format.description}</p></div></div>
                        <div className="mt-4 flex flex-wrap gap-1.5">{format.highlights.map((feature) => <span key={feature} className="rounded-full border border-soft px-2 py-0.5 text-[10px] text-muted2">{feature}</span>)}</div>
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
