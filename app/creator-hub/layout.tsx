"use client"

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  FolderOpen,
  Home,
  Menu,
  NotebookTabs,
  PanelsTopLeft,
  QrCode,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { CREATOR_HUB_FORMATS, CREATOR_HUB_LABS, isCreatorHubFormat } from "@/components/creator-hub/catalog"

const PRIMARY_ITEMS = [
  { href: "/creator-hub", icon: Home, label: "Inicio", description: "Vista general" },
  { href: "/creator-hub/notebook", icon: NotebookTabs, label: "Cuaderno EduAI", description: "Fuentes y Chat Paper" },
  { href: "/creator-hub/materials", icon: WandSparkles, label: "Crear materiales", description: "Todos los formatos" },
  { href: "/creator-hub/comics", icon: PanelsTopLeft, label: "Mangas e historietas", description: "Storyboard visual" },
  { href: "/creator-hub/labs", icon: FlaskConical, label: "Labs multimedia", description: "Audio, imagen y video" },
  { href: "/creator-hub/share", icon: QrCode, label: "Compartir con QR", description: "QR Studio" },
  { href: "/creator-hub/projects", icon: FolderOpen, label: "Mis proyectos", description: "Creaciones recientes" },
]

function isActivePath(pathname: string, href: string) {
  if (href === "/creator-hub") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface SidebarContentProps {
  pathname: string
  activeSegment: string
  formatsOpen: boolean
  setFormatsOpen: Dispatch<SetStateAction<boolean>>
  labsOpen: boolean
  setLabsOpen: Dispatch<SetStateAction<boolean>>
  onNavigate: () => void
  showCloseButton?: boolean
}

function SidebarContent({
  pathname,
  activeSegment,
  formatsOpen,
  setFormatsOpen,
  labsOpen,
  setLabsOpen,
  onNavigate,
  showCloseButton = false,
}: SidebarContentProps) {
  return (
    <>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-soft flex-shrink-0">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-soft bg-card-theme text-muted2 hover:text-main transition-all flex-shrink-0"
          title="Volver al dashboard"
        >
          <ArrowLeft size={15} />
        </Link>
        <Link href="/creator-hub" onClick={onNavigate} className="min-w-0 flex-1">
          <p className="text-main font-bold text-sm leading-tight flex items-center gap-1.5"><Sparkles size={14} className="text-violet-500" /> Creator Hub</p>
          <p className="text-muted2 text-[10px] mt-0.5">Centro creativo EduAI</p>
        </Link>
        {showCloseButton && (
          <button onClick={onNavigate} className="text-muted2 hover:text-main" aria-label="Cerrar menú">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.15em] text-muted2 uppercase">Espacios principales</p>
        <div className="space-y-0.5">
          {PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActivePath(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all"
                style={{
                  background: active ? "rgba(37,99,235,0.09)" : "transparent",
                  borderColor: active ? "rgba(37,99,235,0.18)" : "transparent",
                }}
              >
                <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: active ? "rgba(37,99,235,0.14)" : "var(--bg-card-soft)" }}>
                  <Icon size={15} className={active ? "text-blue-500" : "text-muted2"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold truncate ${active ? "text-blue-500" : "text-main"}`}>{item.label}</span>
                  <span className="block text-[10px] text-muted2 truncate mt-0.5">{item.description}</span>
                </span>
              </Link>
            )
          })}
        </div>

        <div className="my-4 h-px bg-[var(--border-soft)]" />

        <button
          onClick={() => setFormatsOpen((current) => !current)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-bold text-sub hover:bg-card-soft-theme transition-all"
        >
          <WandSparkles size={14} className="text-violet-500" />
          <span className="flex-1">Crear por formato</span>
          {formatsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {formatsOpen && (
          <div className="mt-1 space-y-0.5">
            {CREATOR_HUB_FORMATS.map((format) => {
              const active = activeSegment === format.id
              return (
                <Link
                  key={format.id}
                  href={`/creator-hub/${format.id}`}
                  onClick={onNavigate}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all"
                  style={{
                    background: active ? `${format.color}12` : "transparent",
                    borderColor: active ? `${format.color}25` : "transparent",
                  }}
                >
                  <span className="text-sm">{format.icon}</span>
                  <span className="text-xs font-medium truncate" style={{ color: active ? format.color : "var(--text-secondary)" }}>{format.label}</span>
                </Link>
              )
            })}
          </div>
        )}

        <div className="my-3 h-px bg-[var(--border-soft)]" />

        <button
          onClick={() => setLabsOpen((current) => !current)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-bold text-sub hover:bg-card-soft-theme transition-all"
        >
          <FlaskConical size={14} className="text-teal-500" />
          <span className="flex-1">Accesos multimedia</span>
          {labsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {labsOpen && (
          <div className="mt-1 space-y-0.5">
            {CREATOR_HUB_LABS.map((tool) => (
              <Link key={tool.id} href={tool.href} onClick={onNavigate} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-sub hover:bg-card-soft-theme transition-all">
                <span>{tool.icon}</span>
                <span className="truncate">{tool.label}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-soft p-3 flex-shrink-0">
        <div className="rounded-2xl border border-soft px-3 py-2.5 bg-card-soft-theme">
          <p className="text-[10px] font-bold tracking-wider text-muted2 uppercase">Creator Hub mejorado</p>
          <p className="text-[11px] text-sub mt-1 leading-relaxed">Todas las funciones siguen disponibles. Ahora están ordenadas por flujo de trabajo.</p>
        </div>
      </div>
    </>
  )
}

export default function CreatorHubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [ready, setReady] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [formatsOpen, setFormatsOpen] = useState(true)
  const [labsOpen, setLabsOpen] = useState(false)

  const activeSegment = pathname.split("/").filter(Boolean).pop() || ""
  const formatRouteActive = isCreatorHubFormat(activeSegment)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else setReady(true)
    })
  }, [router, supabase])

  if (!ready) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-soft border-t-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app">
      <aside className="hidden lg:flex fixed left-0 top-0 z-30 h-full w-[274px] flex-col border-r border-soft bg-header-theme backdrop-blur-xl">
        <SidebarContent
          pathname={pathname}
          activeSegment={activeSegment}
          formatsOpen={formatsOpen}
          setFormatsOpen={setFormatsOpen}
          labsOpen={labsOpen}
          setLabsOpen={setLabsOpen}
          onNavigate={() => undefined}
        />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button className="absolute inset-0 bg-black/35" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />
          <aside className="relative h-full w-[286px] max-w-[88vw] flex flex-col border-r border-soft bg-header-theme backdrop-blur-xl shadow-2xl">
            <SidebarContent
              pathname={pathname}
              activeSegment={activeSegment}
              formatsOpen={formatsOpen}
              setFormatsOpen={setFormatsOpen}
              labsOpen={labsOpen}
              setLabsOpen={setLabsOpen}
              onNavigate={() => setMobileOpen(false)}
              showCloseButton
            />
          </aside>
        </div>
      )}

      <div className="lg:ml-[274px] min-h-screen">
        <div className="lg:hidden sticky top-0 z-40 h-14 border-b border-soft bg-header-theme backdrop-blur-xl flex items-center gap-3 px-4">
          <button onClick={() => setMobileOpen(true)} className="w-9 h-9 rounded-xl border border-soft flex items-center justify-center text-sub" aria-label="Abrir menú">
            <Menu size={17} />
          </button>
          <div>
            <p className="text-main text-sm font-bold">Creator Hub</p>
            <p className="text-muted2 text-[10px]">{formatRouteActive ? "Editor de materiales" : "Centro creativo EduAI"}</p>
          </div>
        </div>
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
