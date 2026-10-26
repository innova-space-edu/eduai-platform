"use client"

import Link from "next/link"
import { AppWindow, BookOpenText, ChevronRight, FileText, FolderKanban, LayoutGrid, MessageCircle, Plus, Sparkles } from "lucide-react"

export type WorkspaceSection = "all" | "notes" | "files" | "tools" | "chat"
type Item = { id: string; title: string; item_type: string }

export const WORKSPACE_APPS = [
  { name: "Creator Hub", detail: "Documentos, infografías y presentaciones", href: "/creator-hub", icon: "🎨" },
  { name: "Cuadernos IA", detail: "Investigación con fuentes", href: "/notebooks", icon: "📚" },
  { name: "Pizarra interactiva", detail: "Ideas y mapas visuales", href: "/pizarra-interactiva", icon: "✏️" },
  { name: "Redactor EDUAI", detail: "Escritura y revisión de textos", href: "/redactor", icon: "📝" },
  { name: "Investigador", detail: "Investigar y organizar información", href: "/investigador", icon: "🔎" },
  { name: "Repositorio", detail: "Recursos educativos organizados", href: "/repositorio", icon: "🗂️" },
  { name: "Image Studio", detail: "Imágenes para tus materiales", href: "/image-studio", icon: "🖼️" },
  { name: "Audio Lab", detail: "Voz y grabaciones", href: "/audio-lab", icon: "🎧" },
]

export function WorkspaceApps() {
  return (
    <section aria-label="Aplicaciones disponibles" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {WORKSPACE_APPS.map(app => (
        <Link key={app.href} href={app.href} className="group flex gap-3 items-center rounded-2xl p-4 border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-800/60 hover:border-teal-300 dark:hover:border-teal-800 transition-all">
          <span className="flex justify-center items-center h-11 w-11 shrink-0 rounded-2xl bg-teal-50 dark:bg-teal-900/30 text-xl">{app.icon}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{app.name}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{app.detail}</span>
          </span>
          <ChevronRight size={14} className="text-slate-400 group-hover:text-teal-600" />
        </Link>
      ))}
      <p className="col-span-full text-[11px] text-slate-500 dark:text-slate-400 mt-1">Las aplicaciones se abren dentro de EDUAI; guarda sus resultados en el proyecto cuando corresponda.</p>
    </section>
  )
}

export default function WorkspaceNavigator({ section, onSection, onNew, onOpenItem, items, icon }: {
  section: WorkspaceSection
  onSection: (section: WorkspaceSection) => void
  onNew: () => void
  onOpenItem: (id: string) => void
  items: Item[]
  icon: string
}) {
  const notes = items.filter(item => ["note", "document"].includes(item.item_type))
  const resources = items.filter(item => !["note", "document"].includes(item.item_type))
  const sections = [
    { id: "all", text: "Vista general", icon: LayoutGrid, count: items.length },
    { id: "notes", text: "Notas y documentos", icon: BookOpenText, count: notes.length },
    { id: "files", text: "Archivos y recursos", icon: FolderKanban, count: resources.length },
    { id: "chat", text: "Conversar con IA", icon: MessageCircle, count: null },
    { id: "tools", text: "Aplicaciones EDUAI", icon: AppWindow, count: null },
  ] as const

  return (
    <aside aria-label="Navegación del proyecto" className="rounded-[24px] border border-teal-900/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/75 backdrop-blur-sm shadow-sm overflow-hidden md:sticky md:top-28">
      <div className="px-4 py-4 bg-gradient-to-br from-teal-50 via-sky-50 to-violet-50 dark:from-teal-900/25 dark:via-slate-900 dark:to-violet-900/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <span className="text-lg">{icon}</span> Mi espacio
          <Sparkles size={14} className="ml-auto text-teal-500" />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Trabaja a tu ritmo, con todo a mano.</p>
      </div>
      <nav className="p-2.5 space-y-1">
        {sections.map(entry => {
          const Icon = entry.icon
          return (
            <button type="button" key={entry.id} onClick={() => onSection(entry.id)}
              className={"w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors " +
                (section === entry.id ? "bg-teal-700 text-white shadow-sm" : "text-slate-600 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-900/20")}>
              <Icon size={15} /><span className="flex-1">{entry.text}</span>
              {entry.count !== null && <span className={"text-[10px] " + (section === entry.id ? "text-teal-100" : "text-slate-400")}>{entry.count}</span>}
            </button>
          )
        })}
      </nav>
      <div className="mx-4 border-t border-teal-900/10 dark:border-white/10" />
      <div className="max-h-[36vh] md:max-h-[50vh] overflow-y-auto px-3 py-3 space-y-4">
        {[
          { title: "NOTAS Y DOCUMENTOS", list: notes, icon: FileText },
          { title: "ARCHIVOS Y RECURSOS", list: resources, icon: FolderKanban },
        ].map(group => {
          const Icon = group.icon
          return (
            <div key={group.title}>
              <p className="px-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-slate-400 dark:text-slate-500 mb-2"><Icon size={12} /> {group.title}</p>
              {group.list.length === 0
                ? <p className="px-2 text-[11px] text-slate-400">Aún no hay elementos</p>
                : group.list.map(item => (
                  <button key={item.id} onClick={() => onOpenItem(item.id)} type="button" title={item.title}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left text-xs text-slate-600 dark:text-slate-300 hover:bg-teal-50/80 dark:hover:bg-teal-900/20 transition-colors">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/80" />
                    <span className="min-w-0 truncate flex-1">{item.title}</span>
                    <ChevronRight size={12} className="shrink-0 text-slate-300" />
                  </button>
                ))}
            </div>
          )
        })}
      </div>
      <div className="p-3 border-t border-teal-900/10 dark:border-white/10">
        <button type="button" onClick={onNew} className="w-full rounded-xl py-2.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-200 text-xs font-semibold flex gap-2 items-center justify-center hover:bg-teal-100 dark:hover:bg-teal-900/40">
          <Plus size={14} /> Crear o subir
        </button>
      </div>
    </aside>
  )
}
