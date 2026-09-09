"use client"

import {
  BookCopy,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  Bot,
  ChevronRight,
  Cloud,
  FolderOpen,
  Globe2,
  GraduationCap,
  Heart,
  Home,
  LibraryBig,
  Menu,
  School,
  Search,
  X,
} from "lucide-react"
import type { LibraryCollection } from "@/lib/library/catalog"

export type LibraryWorkspaceView =
  | "home"
  | "fulltext"
  | "mineduc"
  | "bdescolar"
  | "openlibrary"
  | "openstax"
  | "open-textbook-library"
  | "wikibooks"
  | "wikisource"
  | "scielo"
  | "google-books"
  | "bpdigital"
  | "gutenberg"
  | "booknet"
  | "librototal"
  | "casadellibro"
  | "drive-1"
  | "terabox-1"
  | "instagram"
  | "drive-2"
  | "drive-3"
  | "terabox-2"
  | "drive-4"
  | "lectulandia"

export const WORKSPACE_VIEW_LABELS: Record<LibraryWorkspaceView, string> = {
  home: "Inicio",
  fulltext: "Texto completo",
  mineduc: "Textos MINEDUC",
  bdescolar: "BDEscolar",
  openlibrary: "Open Library",
  openstax: "OpenStax",
  "open-textbook-library": "Open Textbook Library",
  wikibooks: "Wikibooks",
  wikisource: "Wikisource",
  scielo: "SciELO Books",
  "google-books": "Google Books",
  bpdigital: "BPDigital Chile",
  gutenberg: "Project Gutenberg",
  booknet: "Booknet",
  librototal: "El Libro Total",
  casadellibro: "Casa del Libro",
  "drive-1": "Biblioteca Drive 1",
  "terabox-1": "Biblioteca TeraBox 1",
  instagram: "Canal de libros",
  "drive-2": "Biblioteca Drive 2",
  "drive-3": "Biblioteca Drive 3",
  "terabox-2": "Biblioteca TeraBox 2",
  "drive-4": "Biblioteca Drive 4",
  lectulandia: "Lectulandia",
}

type Props = {
  activeView: LibraryWorkspaceView
  activeCollectionId: string
  collections: LibraryCollection[]
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  onSelect: (view: LibraryWorkspaceView) => void
  onCollection: (collectionId: string) => void
}

type NavItem = {
  id: LibraryWorkspaceView
  label: string
  icon: typeof Home
  badge?: string
}

const MAIN_ITEMS: NavItem[] = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "fulltext", label: "Todos los textos completos", icon: BookOpenCheck, badge: "Prioridad" },
  { id: "mineduc", label: "Textos MINEDUC", icon: School },
  { id: "bdescolar", label: "BDEscolar", icon: GraduationCap },
  { id: "openlibrary", label: "Open Library", icon: LibraryBig },
]

const OPEN_TEXT_ITEMS: NavItem[] = [
  { id: "openstax", label: "OpenStax", icon: BookOpenCheck },
  { id: "open-textbook-library", label: "Open Textbook Library", icon: BookOpen },
  { id: "wikibooks", label: "Wikibooks", icon: BookCopy },
  { id: "wikisource", label: "Wikisource", icon: BookCopy },
  { id: "scielo", label: "SciELO Books", icon: Globe2 },
  { id: "google-books", label: "Google Books", icon: Search },
]

const OTHER_LIBRARY_ITEMS: NavItem[] = [
  { id: "bpdigital", label: "BPDigital Chile", icon: LibraryBig },
  { id: "gutenberg", label: "Project Gutenberg", icon: BookOpen },
  { id: "librototal", label: "El Libro Total", icon: BookOpen },
  { id: "booknet", label: "Booknet", icon: BookCopy },
  { id: "casadellibro", label: "Casa del Libro", icon: BookCopy },
]

const CLOUD_ITEMS: NavItem[] = [
  { id: "drive-1", label: "Biblioteca Drive 1", icon: FolderOpen },
  { id: "terabox-1", label: "Biblioteca TeraBox 1", icon: Cloud },
  { id: "instagram", label: "Canal de libros", icon: Cloud },
  { id: "drive-2", label: "Biblioteca Drive 2", icon: FolderOpen },
  { id: "drive-3", label: "Biblioteca Drive 3", icon: FolderOpen },
  { id: "terabox-2", label: "Biblioteca TeraBox 2", icon: Cloud },
  { id: "drive-4", label: "Biblioteca Drive 4", icon: FolderOpen },
  { id: "lectulandia", label: "Lectulandia", icon: Cloud },
]

function CollectionIcon({ id }: { id: string }) {
  if (id === "favorites") return <Heart size={15} />
  if (id === "reading") return <Bookmark size={15} />
  return <BookOpen size={15} />
}

function WorkspaceButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
        active ? "bg-blue-50 font-bold text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      }`}
    >
      <Icon size={15} className={active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-700"} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge && <span className="rounded-full border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-700">{item.badge}</span>}
      {active && <ChevronRight size={14} />}
    </button>
  )
}

function SidebarContent({ activeView, activeCollectionId, collections, onSelect, onCollection, closeMobile }: Omit<Props, "mobileOpen" | "onMobileOpenChange"> & { closeMobile?: () => void }) {
  const selectView = (view: LibraryWorkspaceView) => {
    onSelect(view)
    closeMobile?.()
  }
  const selectCollection = (id: string) => {
    onCollection(id)
    closeMobile?.()
  }

  const group = (title: string, items: NavItem[]) => (
    <div className="border-b border-slate-100 px-3 py-4 last:border-b-0">
      <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.17em] text-slate-400">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => <WorkspaceButton key={item.id} item={item} active={activeView === item.id} onClick={() => selectView(item.id)} />)}
      </div>
    </div>
  )

  return (
    <>
      <div className="border-b border-slate-100 p-4">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white"><Bot size={17} /></div>
            <div className="min-w-0"><p className="text-sm font-bold text-slate-900">Biblioteca EDUAI</p><p className="text-[11px] text-slate-500">Selecciona una fuente</p></div>
          </div>
        </div>
      </div>
      {group("Principal", MAIN_ITEMS)}
      {group("Texto completo", OPEN_TEXT_ITEMS)}
      {group("Otras bibliotecas", OTHER_LIBRARY_ITEMS)}
      <div className="border-b border-slate-100 px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.17em] text-slate-400">Colecciones personales</p>
        <div className="space-y-0.5">
          {collections.map((collection) => (
            <button key={collection.id} onClick={() => selectCollection(collection.id)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${activeView === "openlibrary" && activeCollectionId === collection.id ? "bg-violet-50 font-bold text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
              <CollectionIcon id={collection.id} /><span className="min-w-0 flex-1 truncate">{collection.label}</span>{activeView === "openlibrary" && activeCollectionId === collection.id && <ChevronRight size={14} />}
            </button>
          ))}
        </div>
      </div>
      {group("Nubes y repositorios", CLOUD_ITEMS)}
      <div className="p-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
          <p className="font-bold text-slate-700">Acceso centralizado</p>
          <p className="mt-1">Las fuentes abiertas se leen dentro de EDUAI cuando técnicamente es posible. Los servicios externos conservan sus permisos y licencias.</p>
        </div>
      </div>
    </>
  )
}

export default function LibraryWorkspaceSidebar(props: Props) {
  return (
    <>
      <aside className="hidden border-r border-slate-200 bg-white lg:block lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:sticky lg:top-16">
        <SidebarContent {...props} />
      </aside>

      <button onClick={() => props.onMobileOpenChange(true)} className="fixed bottom-5 left-4 z-30 flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-xl lg:hidden">
        <Menu size={16} /> Bibliotecas
      </button>

      {props.mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Cerrar menú" className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={() => props.onMobileOpenChange(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(88vw,340px)] overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur"><p className="text-sm font-bold">Bibliotecas y nubes</p><button onClick={() => props.onMobileOpenChange(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500"><X size={16} /></button></div>
            <SidebarContent {...props} closeMobile={() => props.onMobileOpenChange(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
