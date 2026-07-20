"use client"

import { useState } from "react"
import Link from "next/link"
import {
  BookOpenText,
  ChevronLeft,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react"
import type { WorkNotebookSummary } from "@/lib/work/types"

type WorkSidebarProps = {
  open: boolean
  notebooks: WorkNotebookSummary[]
  activeNotebookId: string | null
  loading: boolean
  creating: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onCreate: () => void
}

function sourceCount(notebook: WorkNotebookSummary) {
  return notebook.notebook_sources?.[0]?.count ?? 0
}

export function WorkSidebar({
  open,
  notebooks,
  activeNotebookId,
  loading,
  creating,
  onClose,
  onSelect,
  onCreate,
}: WorkSidebarProps) {
  const [query, setQuery] = useState("")
  if (!open) return null

  const visibleNotebooks = notebooks.filter((notebook) => (
    notebook.title.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))
  ))

  return (
    <aside className="absolute inset-y-0 left-0 z-40 flex w-[292px] shrink-0 flex-col border-r border-soft bg-card-theme shadow-xl lg:relative lg:z-auto lg:shadow-none">
      <div className="flex items-center gap-3 border-b border-soft px-4 py-3">
        <Link href="/dashboard" className="grid h-8 w-8 place-items-center rounded-xl text-muted2 transition hover:bg-card-soft-theme hover:text-main" title="Volver al panel">
          <ChevronLeft size={17} />
        </Link>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-black text-white shadow-sm">W</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-main">Open EDUAI Work</p>
          <p className="text-[10px] text-muted2">Investiga · Crea · Ejecuta</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted2 hover:bg-card-soft-theme lg:hidden" aria-label="Cerrar navegación">
          <X size={16} />
        </button>
      </div>

      <div className="p-3">
        <button type="button" onClick={onCreate} disabled={creating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50">
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Nuevo Work
        </button>
        <div className="relative mt-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted2" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border border-soft bg-card-soft-theme py-2 pl-8 pr-3 text-xs text-main outline-none placeholder:text-muted2 focus:border-blue-500/40" placeholder="Buscar trabajos" aria-label="Buscar trabajos" />
        </div>
      </div>

      <nav className="space-y-1 px-3 pb-3" aria-label="Secciones de Open EDUAI Work">
        <Link href="/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-sub hover:bg-card-soft-theme hover:text-main"><LayoutDashboard size={14} /> Panel principal</Link>
        <Link href="/workspace" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-sub hover:bg-card-soft-theme hover:text-main"><FolderKanban size={14} /> Proyectos EDUAI</Link>
        <Link href="/collab" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-sub hover:bg-card-soft-theme hover:text-main"><Users size={14} /> Trabajo colaborativo</Link>
        <Link href="/notebooks" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-sub hover:bg-card-soft-theme hover:text-main"><BookOpenText size={14} /> Todos los cuadernos</Link>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col border-t border-soft">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2">Trabajos recientes</p>
          <Clock3 size={12} className="text-muted2" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted2"><Loader2 size={14} className="animate-spin" /> Cargando</div>
          )}
          {!loading && notebooks.length === 0 && (
            <div className="mx-2 rounded-2xl border border-dashed border-soft p-4 text-center">
              <p className="text-xs font-semibold text-main">Tu primer espacio está listo para comenzar</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted2">Crea un Work para reunir conversación, fuentes y resultados.</p>
            </div>
          )}
          {!loading && notebooks.length > 0 && visibleNotebooks.length === 0 && <p className="px-3 py-6 text-center text-[10px] text-muted2">No se encontraron trabajos.</p>}
          {visibleNotebooks.map((notebook) => {
            const active = notebook.id === activeNotebookId
            return (
              <button
                key={notebook.id}
                type="button"
                onClick={() => onSelect(notebook.id)}
                className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-blue-500/10 text-blue-600" : "text-sub hover:bg-card-soft-theme hover:text-main"}`}
              >
                <span className="block truncate text-xs font-semibold">{notebook.title}</span>
                <span className="mt-1 flex items-center gap-1.5 text-[9px] text-muted2">
                  <BookOpenText size={10} /> {sourceCount(notebook)} fuentes
                  <span>·</span>
                  {new Date(notebook.updated_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
