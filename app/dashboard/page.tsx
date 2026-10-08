"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ClawStudyConsole from "@/components/dashboard/ClawStudyConsole"
import {
  BookOpen,
  Bot,
  FolderKanban,
  LibraryBig,
  LogOut,
  MessageCircle,
  MessageSquareWarning,
  Music2,
  QrCode,
  ShieldCheck,
  UserCircle2,
  Users,
  Zap,
} from "lucide-react"

const NAV_LINKS = [
  { href: "/agentes", icon: Bot, label: "Agentes", color: "#2563eb" },
  { href: "/sessions", icon: BookOpen, label: "Sesiones", color: "#7c3aed" },
  { href: "/chat", icon: MessageCircle, label: "Chat", color: "#059669" },
  { href: "/music", icon: Music2, label: "Música", color: "#10b981" },
  { href: "/collab", icon: Users, label: "Colaborar", color: "#0d9488" },
  { href: "/workspace", icon: FolderKanban, label: "Workspace", color: "#4338ca" },
  { href: "/qr-studio", icon: QrCode, label: "QR Studio", color: "#0891b2" },
  { href: "/profile", icon: UserCircle2, label: "Perfil", color: "var(--text-muted)" },
]

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [expanded, setExpanded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setUser(user)

      const { data: adminData } = await supabase
        .from("admin_emails")
        .select("email")
        .eq("email", user.email)
        .maybeSingle()
      setIsAdmin(Boolean(adminData))

    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuario"

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-app [--sidebar-closed:56px] [--sidebar-open:184px] lg:[--sidebar-closed:68px] lg:[--sidebar-open:220px] min-[2048px]:[--sidebar-closed:84px] min-[2048px]:[--sidebar-open:280px]">
      <aside
        style={{ width: expanded ? "var(--sidebar-open)" : "var(--sidebar-closed)" }}
        className="fixed left-0 top-0 z-20 flex h-[100dvh] flex-col overflow-hidden transition-[width] duration-300"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div
          className="absolute inset-0 border-r backdrop-blur-xl"
          style={{
            background: "var(--bg-sidebar)",
            borderColor: "var(--border-soft)",
            boxShadow: "var(--shadow-sm)",
          }}
        />

        <div className="relative flex h-full flex-col">
          <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b px-2.5 lg:h-14 lg:gap-3 lg:px-4 min-[2048px]:h-16 min-[2048px]:px-5" style={{ borderColor: "var(--border-soft)" }}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 lg:h-9 lg:w-9 lg:rounded-2xl min-[2048px]:h-11 min-[2048px]:w-11">
              <Zap size={18} className="text-main min-[2048px]:h-5 min-[2048px]:w-5" />
            </div>
            {expanded && (
              <span className="animate-fade-in whitespace-nowrap text-sm font-bold text-main lg:text-base min-[2048px]:text-lg">
                Edu<span className="text-blue-600">AI</span>
              </span>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1.5 py-2 lg:px-2 lg:py-3 min-[2048px]:gap-1 min-[2048px]:px-3 min-[2048px]:py-4">
            {NAV_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!expanded ? item.label : undefined}
                  className="group flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-2 transition-all lg:gap-3 lg:rounded-2xl lg:px-2.5 lg:py-2.5 min-[2048px]:py-3"
                  onMouseEnter={(event) => (event.currentTarget.style.background = `${item.color}0d`)}
                  onMouseLeave={(event) => (event.currentTarget.style.background = "")}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all group-hover:scale-105 lg:h-9 lg:w-9 lg:rounded-xl min-[2048px]:h-11 min-[2048px]:w-11"
                    style={{ background: `${item.color}15`, border: `1px solid ${item.color}28` }}
                  >
                    <Icon size={17} style={{ color: item.color }} />
                  </div>
                  {expanded && (
                    <span className="whitespace-nowrap text-xs font-medium text-sub transition-colors group-hover:text-main lg:text-sm min-[2048px]:text-[15px]">
                      {item.label}
                    </span>
                  )}
                </Link>
              )
            })}

            {isAdmin && (
              <Link
                href="/admin"
                title={!expanded ? "Administración" : undefined}
                className="group mt-1 flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-2 transition-all lg:gap-3 lg:rounded-2xl lg:px-2.5 lg:py-2.5 min-[2048px]:py-3"
                onMouseEnter={(event) => (event.currentTarget.style.background = "rgba(124,58,237,0.07)")}
                onMouseLeave={(event) => (event.currentTarget.style.background = "")}
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all group-hover:scale-105 lg:h-9 lg:w-9 lg:rounded-xl min-[2048px]:h-11 min-[2048px]:w-11"
                  style={{
                    background: "rgba(124,58,237,0.12)",
                    border: "1px solid rgba(124,58,237,0.25)",
                  }}
                >
                  <ShieldCheck size={17} style={{ color: "#7c3aed" }} />
                </div>
                {expanded && (
                  <span className="whitespace-nowrap text-xs font-medium text-purple-600 transition-colors group-hover:text-purple-700 lg:text-sm min-[2048px]:text-[15px]">
                    Administración
                  </span>
                )}
              </Link>
            )}
          </nav>

          <div className="flex-shrink-0 border-t px-1.5 py-2 lg:px-2 lg:py-3 min-[2048px]:px-3" style={{ borderColor: "var(--border-soft)" }}>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push("/login")
              }}
              className="group flex w-full items-center gap-2 rounded-xl border border-transparent px-1.5 py-2 transition-all hover:border-red-100 hover:bg-red-50 lg:gap-3 lg:rounded-2xl lg:px-2.5 lg:py-2.5 min-[2048px]:py-3"
              title={!expanded ? "Salir" : undefined}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg lg:h-9 lg:w-9 lg:rounded-xl min-[2048px]:h-11 min-[2048px]:w-11"
                style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)" }}
              >
                <LogOut size={16} className="text-muted2 transition-colors group-hover:text-red-500" />
              </div>
              {expanded && (
                <span className="whitespace-nowrap text-xs text-muted2 transition-colors group-hover:text-red-500 lg:text-sm min-[2048px]:text-[15px]">
                  Cerrar sesión
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      <main
        style={{ marginLeft: expanded ? "var(--sidebar-open)" : "var(--sidebar-closed)" }}
        className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300"
      >
        <div
          className="z-10 shrink-0 border-b backdrop-blur-xl"
          style={{ background: "var(--bg-header)", borderColor: "var(--border-soft)" }}
        >
          <div className="mx-auto flex h-12 w-full max-w-[1480px] items-center justify-between px-3 lg:h-14 lg:px-6 min-[2048px]:h-16 min-[2048px]:max-w-[1960px] min-[2048px]:px-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted2 lg:text-xs min-[2048px]:text-[13px]">EduAI</p>
              <p className="hidden text-xs text-sub lg:block min-[2048px]:text-sm">Claw es tu espacio principal de trabajo en EduAI</p>
            </div>
            <div className="flex items-center gap-2 lg:gap-2.5 min-[2048px]:gap-3">
              <Link
                href="/biblioteca"
                className="group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 lg:rounded-xl lg:px-3 lg:text-xs min-[2048px]:px-4 min-[2048px]:py-2 min-[2048px]:text-sm"
                style={{
                  background: "rgba(124,58,237,0.08)",
                  borderColor: "rgba(124,58,237,0.18)",
                  color: "#6d28d9",
                }}
              >
                <LibraryBig size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden lg:inline">Biblioteca</span>
              </Link>
              <Link
                href="/music"
                data-eduai-header-action="music"
                className="group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 lg:rounded-xl lg:px-3 lg:text-xs min-[2048px]:px-4 min-[2048px]:py-2 min-[2048px]:text-sm"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  borderColor: "rgba(16,185,129,0.20)",
                  color: "#047857",
                }}
                title="Abrir EduAI Music"
              >
                <Music2 size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden lg:inline">Música</span>
              </Link>
              <Link
                href="/soporte"
                data-eduai-header-action="report"
                className="group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 lg:rounded-xl lg:px-3 lg:text-xs min-[2048px]:px-4 min-[2048px]:py-2 min-[2048px]:text-sm"
                style={{
                  background: "rgba(37,99,235,0.07)",
                  borderColor: "rgba(37,99,235,0.18)",
                  color: "#2563eb",
                }}
                title="Reportar una falla"
              >
                <MessageSquareWarning size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden xl:inline">Reportar una falla</span>
                <span className="hidden lg:inline xl:hidden">Reporte</span>
              </Link>
              <span className="hidden text-sm text-sub lg:inline min-[2048px]:text-[15px]">{displayName}</span>
            </div>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 gap-3 overflow-hidden px-2 py-2 lg:gap-5 lg:px-5 lg:py-4 min-[2048px]:max-w-[1960px] min-[2048px]:gap-8 min-[2048px]:px-10 min-[2048px]:py-6">
          <div className="h-full min-h-0 min-w-0 flex-1">
            <ClawStudyConsole displayName={displayName} isAdmin={isAdmin} />
          </div>


        </div>
      </main>
    </div>
  )
}
