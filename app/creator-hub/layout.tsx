"use client"

import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react"
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
  PanelLeftClose,
  PanelLeftOpen,
  PanelsTopLeft,
  QrCode,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { CREATOR_HUB_FORMATS, isCreatorHubFormat } from "@/components/creator-hub/catalog"

const PRIMARY_ITEMS = [
  { href: "/creator-hub", icon: Home, label: "Inicio" },
  { href: "/creator-hub/notebook", icon: NotebookTabs, label: "Cuaderno EduAI" },
  { href: "/creator-hub/materials", icon: WandSparkles, label: "Crear materiales" },
  { href: "/creator-hub/labs", icon: FlaskConical, label: "Multimedia" },
  { href: "/creator-hub/projects", icon: FolderOpen, label: "Mis proyectos" },
]

const SECONDARY_ITEMS = [
  { href: "/creator-hub/comics", icon: PanelsTopLeft, label: "Mangas e historietas" },
  { href: "/creator-hub/share", icon: QrCode, label: "Compartir con QR" },
  { href: "/creator-hub/templates", icon: PanelsTopLeft, label: "Plantillas" },
]

type SidebarMode = "expanded" | "compact" | "hidden"

function isActivePath(pathname: string, href: string) {
  if (href === "/creator-hub") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface SidebarContentProps {
  pathname: string
  activeSegment: string
  formatsOpen: boolean
  setFormatsOpen: Dispatch<SetStateAction<boolean>>
  moreOpen: boolean
  setMoreOpen: Dispatch<SetStateAction<boolean>>
  onNavigate: () => void
  compact?: boolean
  onToggleCompact?: () => void
  onHide?: () => void
  showCloseButton?: boolean
}

function SidebarContent({
  pathname,
  activeSegment,
  formatsOpen,
  setFormatsOpen,
  moreOpen,
  setMoreOpen,
  onNavigate,
  compact = false,
  onToggleCompact,
  onHide,
  showCloseButton = false,
}: SidebarContentProps) {
  return (
    <>
      <div className={`flex h-16 flex-shrink-0 items-center border-b border-soft ${compact ? "justify-center px-2" : "gap-3 px-4"}`}>
        {compact ? (
          <Link href="/creator-hub" onClick={onNavigate} className="flex h-10 w-10 items-center justify-center rounded-xl text-violet-600" title="Creator Hub"><Sparkles size={17} /></Link>
        ) : (
          <>
            <Link href="/dashboard" onClick={onNavigate} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted2 transition hover:text-main" title="Volver al dashboard"><ArrowLeft size={15} /></Link>
            <Link href="/creator-hub" onClick={onNavigate} className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-sm font-bold leading-tight text-main"><Sparkles size={14} className="text-violet-500" /> Creator Hub</p><p className="mt-0.5 text-[10px] text-muted2">Centro creativo EduAI</p></Link>
            {showCloseButton && <button onClick={onNavigate} className="text-muted2 hover:text-main" aria-label="Cerrar menú"><X size={18} /></button>}
          </>
        )}
      </div>

      <nav className={`flex-1 overflow-y-auto py-3 ${compact ? "px-2" : "px-3"}`}>
        {!compact && <p className="px-2 pb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-muted2">Principal</p>}
        <div className="space-y-1">
          {PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActivePath(pathname, item.href)
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate} title={compact ? item.label : undefined} className={`flex items-center rounded-xl transition-all ${compact ? "h-11 justify-center" : "gap-3 px-3 py-2.5"}`} style={{ color: active ? "#2563eb" : "var(--text-main)" }}>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"><Icon size={15} className={active ? "text-blue-500" : "text-muted2"} /></span>
                {!compact && <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.label}</span>}
              </Link>
            )
          })}
        </div>

        {!compact && (
          <>
            <div className="my-4 h-px bg-[var(--border-soft)]" />
            <button type="button" onClick={() => setMoreOpen((current) => !current)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-sub transition hover:text-main"><PanelsTopLeft size={14} className="text-pink-500" /><span className="flex-1">Más espacios</span>{moreOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
            {moreOpen && <div className="mt-1 space-y-1 pl-1">{SECONDARY_ITEMS.map((item) => { const Icon = item.icon; const active = isActivePath(pathname, item.href); return <Link key={item.href} href={item.href} onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition" style={{ color: active ? "#db2777" : "var(--text-secondary)" }}><Icon size={14} /><span className="truncate">{item.label}</span></Link> })}</div>}

            <button type="button" onClick={() => setFormatsOpen((current) => !current)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-sub transition hover:text-main"><WandSparkles size={14} className="text-violet-500" /><span className="flex-1">Formatos de creación</span><span className="text-[9px] text-muted2">{CREATOR_HUB_FORMATS.length}</span>{formatsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
            {formatsOpen && <div className="mt-1 grid grid-cols-2 gap-1">{CREATOR_HUB_FORMATS.map((format) => { const active = activeSegment === format.id; return <Link key={format.id} href={`/creator-hub/${format.id}`} onClick={onNavigate} title={format.label} className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 transition"><span className="text-sm">{format.icon}</span><span className="truncate text-[10px] font-semibold" style={{ color: active ? format.color : "var(--text-secondary)" }}>{format.shortLabel || format.label}</span></Link> })}</div>}
          </>
        )}
      </nav>

      <div className={`flex-shrink-0 border-t border-soft p-2 ${compact ? "space-y-1" : ""}`}>
        {compact && <Link href="/dashboard" className="flex h-10 w-full items-center justify-center rounded-lg text-muted2 transition hover:text-main" title="Volver al dashboard"><ArrowLeft size={16} /></Link>}
        {onToggleCompact && <button type="button" onClick={onToggleCompact} className={`flex w-full items-center rounded-lg text-muted2 transition hover:text-main ${compact ? "h-10 justify-center" : "gap-2.5 px-3 py-2.5"}`} title={compact ? "Expandir menú" : "Contraer menú"}>{compact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}{!compact && <span className="text-xs font-semibold">Contraer menú</span>}</button>}
        {onHide && <button type="button" onClick={onHide} className={`flex w-full items-center rounded-lg text-muted2 transition hover:text-main ${compact ? "h-10 justify-center" : "gap-2.5 px-3 py-2.5"}`} title="Ocultar menú"><PanelLeftClose size={16} />{!compact && <span className="text-xs font-semibold">Ocultar menú</span>}</button>}
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
  const [formatsOpen, setFormatsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("expanded")

  const activeSegment = pathname.split("/").filter(Boolean).pop() || ""
  const formatRouteActive = isCreatorHubFormat(activeSegment)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else setReady(true)
    })
  }, [router, supabase])

  useEffect(() => {
    const stored = window.localStorage.getItem("creator-hub-sidebar-mode") as SidebarMode | null
    if (stored === "compact" || stored === "hidden" || stored === "expanded") setSidebarMode(stored)
  }, [])

  useEffect(() => {
    if (formatRouteActive) setFormatsOpen(true)
  }, [formatRouteActive])

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ hidden?: boolean }>
      if (custom.detail?.hidden) setSidebarMode("hidden")
      else setSidebarMode((current) => current === "hidden" ? "compact" : current)
    }
    window.addEventListener("creator-hub:sidebar-mode", handler)
    return () => window.removeEventListener("creator-hub:sidebar-mode", handler)
  }, [])

  const persistMode = (mode: SidebarMode) => {
    setSidebarMode(mode)
    window.localStorage.setItem("creator-hub-sidebar-mode", mode)
  }

  const toggleCompact = () => persistMode(sidebarMode === "compact" ? "expanded" : "compact")

  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-app"><div className="h-10 w-10 animate-spin rounded-full border-2 border-soft border-t-blue-500" /></div>

  const desktopWidth = sidebarMode === "hidden" ? 0 : sidebarMode === "compact" ? 72 : 240
  const sidebarStyle = { "--creator-sidebar-width": `${desktopWidth}px` } as CSSProperties

  return (
    <div className="min-h-screen bg-app">
      <aside className="fixed left-0 top-0 z-30 hidden h-full flex-col overflow-hidden border-r border-soft bg-header-theme backdrop-blur-xl transition-[width,opacity] duration-200 lg:flex" style={{ width: desktopWidth, opacity: sidebarMode === "hidden" ? 0 : 1, pointerEvents: sidebarMode === "hidden" ? "none" : "auto" }}>
        <SidebarContent pathname={pathname} activeSegment={activeSegment} formatsOpen={formatsOpen} setFormatsOpen={setFormatsOpen} moreOpen={moreOpen} setMoreOpen={setMoreOpen} onNavigate={() => undefined} compact={sidebarMode === "compact"} onToggleCompact={toggleCompact} onHide={() => persistMode("hidden")} />
      </aside>

      {sidebarMode === "hidden" && <button type="button" onClick={() => persistMode("compact")} className="fixed left-2 top-3 z-50 hidden h-9 w-9 items-center justify-center rounded-lg text-muted2 transition hover:text-main lg:flex" title="Mostrar menú"><PanelLeftOpen size={17} /></button>}

      {mobileOpen && <div className="fixed inset-0 z-50 flex lg:hidden"><button className="absolute inset-0 bg-black/35" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" /><aside className="relative flex h-full w-[278px] max-w-[88vw] flex-col border-r border-soft bg-header-theme shadow-2xl backdrop-blur-xl"><SidebarContent pathname={pathname} activeSegment={activeSegment} formatsOpen={formatsOpen} setFormatsOpen={setFormatsOpen} moreOpen={moreOpen} setMoreOpen={setMoreOpen} onNavigate={() => setMobileOpen(false)} showCloseButton /></aside></div>}

      <div className="min-h-screen transition-[margin] duration-200 lg:ml-[var(--creator-sidebar-width)]" style={sidebarStyle}>
        <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-soft bg-header-theme px-4 backdrop-blur-xl lg:hidden"><button onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg text-sub" aria-label="Abrir menú"><Menu size={17} /></button><div><p className="text-sm font-bold text-main">Creator Hub</p><p className="text-[10px] text-muted2">{formatRouteActive ? "Editor de materiales" : "Centro creativo EduAI"}</p></div></div>
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
