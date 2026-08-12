"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ClawStudyConsole from "@/components/dashboard/ClawStudyConsole"
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Bot,
  Flame,
  FolderKanban,
  LibraryBig,
  LogOut,
  MessageCircle,
  Music2,
  QrCode,
  ShieldCheck,
  UserCircle2,
  Users,
  Zap,
} from "lucide-react"

const LEVELS = [
  { name: "Principiante", min: 0, max: 100 },
  { name: "Aprendiz", min: 100, max: 500 },
  { name: "Practicante", min: 500, max: 1200 },
  { name: "Avanzado", min: 1200, max: 2500 },
  { name: "Experto", min: 2500, max: 5000 },
  { name: "Maestro", min: 5000, max: 99999 },
]

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

const LEVEL_COLORS = [
  { text: "text-muted2", glow: "rgba(100,116,139,0.25)" },
  { text: "text-blue-600", glow: "rgba(37,99,235,0.22)" },
  { text: "text-emerald-600", glow: "rgba(5,150,105,0.22)" },
  { text: "text-purple-600", glow: "rgba(124,58,237,0.22)" },
  { text: "text-amber-600", glow: "rgba(217,119,6,0.22)" },
  { text: "text-red-600", glow: "rgba(220,38,38,0.22)" },
]

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState("Principiante")
  const [streak, setStreak] = useState(0)
  const [sessions, setSessions] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("xp, streak_days")
        .eq("id", user.id)
        .maybeSingle()

      const { count } = await supabase
        .from("study_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
      setSessions(count || 0)

      if (profileData) {
        const currentXp = profileData.xp || 0
        const currentStreak = profileData.streak_days || 0
        setXp(currentXp)
        setStreak(currentStreak)
        const nextLevel = [...LEVELS].reverse().find((item) => currentXp >= item.min)
        setLevel(nextLevel?.name || "Principiante")
      }

      setLoaded(true)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const levelIdx = LEVELS.findIndex((item) => item.name === level)
  const currentLevel = LEVELS[levelIdx] || LEVELS[0]
  const nextLevel = LEVELS[levelIdx + 1]
  const progress = nextLevel
    ? Math.min(((xp - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100, 100)
    : 100
  const levelColor = LEVEL_COLORS[levelIdx] || LEVEL_COLORS[0]
  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Estudiante"

  const stats = [
    { label: "Nivel", value: level, icon: BarChart3, color: "#2563eb" },
    { label: "XP Total", value: `${xp}`, icon: Zap, color: "#d97706" },
    { label: "Racha", value: `${streak}d`, icon: Flame, color: "#ea580c" },
    { label: "Sesiones", value: String(sessions), icon: BookMarked, color: "#059669" },
  ]

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-app [--sidebar-closed:56px] [--sidebar-open:196px] lg:[--sidebar-closed:68px] lg:[--sidebar-open:220px] min-[1920px]:[--sidebar-closed:80px] min-[1920px]:[--sidebar-open:260px]">
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
          <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b px-2.5 sm:h-14 sm:gap-3 sm:px-4 min-[1920px]:h-16 min-[1920px]:px-5" style={{ borderColor: "var(--border-soft)" }}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 sm:h-9 sm:w-9 sm:rounded-2xl min-[1920px]:h-10 min-[1920px]:w-10">
              <Zap size={18} className="text-main" />
            </div>
            {expanded && (
              <span className="animate-fade-in whitespace-nowrap text-sm font-bold text-main sm:text-base min-[1920px]:text-lg">
                Edu<span className="text-blue-600">AI</span>
              </span>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1.5 py-2 sm:px-2 sm:py-3 min-[1920px]:gap-1 min-[1920px]:px-3 min-[1920px]:py-4">
            {NAV_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!expanded ? item.label : undefined}
                  className="group flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-2 transition-all sm:gap-3 sm:rounded-2xl sm:px-2.5 sm:py-2.5 min-[1920px]:py-3"
                  onMouseEnter={(event) => (event.currentTarget.style.background = `${item.color}0d`)}
                  onMouseLeave={(event) => (event.currentTarget.style.background = "")}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all group-hover:scale-105 sm:h-9 sm:w-9 sm:rounded-xl min-[1920px]:h-10 min-[1920px]:w-10"
                    style={{ background: `${item.color}15`, border: `1px solid ${item.color}28` }}
                  >
                    <Icon size={17} style={{ color: item.color }} />
                  </div>
                  {expanded && (
                    <span className="whitespace-nowrap text-xs font-medium text-sub transition-colors group-hover:text-main sm:text-sm min-[1920px]:text-[15px]">
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
                className="group mt-1 flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-2 transition-all sm:gap-3 sm:rounded-2xl sm:px-2.5 sm:py-2.5 min-[1920px]:py-3"
                onMouseEnter={(event) => (event.currentTarget.style.background = "rgba(124,58,237,0.07)")}
                onMouseLeave={(event) => (event.currentTarget.style.background = "")}
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all group-hover:scale-105 sm:h-9 sm:w-9 sm:rounded-xl min-[1920px]:h-10 min-[1920px]:w-10"
                  style={{
                    background: "rgba(124,58,237,0.12)",
                    border: "1px solid rgba(124,58,237,0.25)",
                  }}
                >
                  <ShieldCheck size={17} style={{ color: "#7c3aed" }} />
                </div>
                {expanded && (
                  <span className="whitespace-nowrap text-xs font-medium text-purple-600 transition-colors group-hover:text-purple-700 sm:text-sm min-[1920px]:text-[15px]">
                    Administración
                  </span>
                )}
              </Link>
            )}
          </nav>

          <div className="flex-shrink-0 border-t px-1.5 py-2 sm:px-2 sm:py-3 min-[1920px]:px-3" style={{ borderColor: "var(--border-soft)" }}>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push("/login")
              }}
              className="group flex w-full items-center gap-2 rounded-xl border border-transparent px-1.5 py-2 transition-all hover:border-red-100 hover:bg-red-50 sm:gap-3 sm:rounded-2xl sm:px-2.5 sm:py-2.5"
              title={!expanded ? "Salir" : undefined}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl min-[1920px]:h-10 min-[1920px]:w-10"
                style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)" }}
              >
                <LogOut size={16} className="text-muted2 transition-colors group-hover:text-red-500" />
              </div>
              {expanded && (
                <span className="whitespace-nowrap text-xs text-muted2 transition-colors group-hover:text-red-500 sm:text-sm min-[1920px]:text-[15px]">
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
          <div className="mx-auto flex h-12 w-full max-w-[1480px] items-center justify-between px-3 sm:h-14 sm:px-5 lg:px-6 min-[1920px]:h-16 min-[1920px]:max-w-[1840px] min-[1920px]:px-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted2 sm:text-xs min-[1920px]:text-[13px]">EduAI</p>
              <p className="hidden text-xs text-sub sm:block min-[1920px]:text-sm">Claw es tu espacio principal de trabajo</p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 min-[1920px]:gap-4">
              <Link
                href="/biblioteca"
                className="group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 sm:rounded-xl sm:px-3 sm:text-xs min-[1920px]:px-4 min-[1920px]:py-2 min-[1920px]:text-sm"
                style={{
                  background: "rgba(124,58,237,0.08)",
                  borderColor: "rgba(124,58,237,0.18)",
                  color: "#6d28d9",
                }}
              >
                <LibraryBig size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">Biblioteca</span>
              </Link>
              <span className="hidden text-sm text-sub md:inline min-[1920px]:text-[15px]">{displayName}</span>
              <div
                className="rounded-lg border px-2 py-1 text-[10px] font-semibold lg:hidden sm:rounded-xl sm:px-2.5 sm:text-xs"
                style={{ background: `${levelColor.glow}`, borderColor: "var(--border-soft)" }}
              >
                <span className={levelColor.text}>{level}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 gap-3 overflow-hidden px-2 py-2 sm:gap-4 sm:px-3 sm:py-3 lg:gap-4 lg:px-4 lg:py-4 xl:gap-5 xl:px-5 min-[1920px]:max-w-[1840px] min-[1920px]:gap-8 min-[1920px]:px-8 min-[1920px]:py-6">
          <div className="h-full min-h-0 min-w-0 flex-1">
            <ClawStudyConsole displayName={displayName} isAdmin={isAdmin} />
          </div>

          <aside className="hidden h-full w-[238px] shrink-0 overflow-y-auto overscroll-contain pb-2 lg:block xl:w-[260px] min-[1920px]:w-[320px]">
            <div className="space-y-2.5 xl:space-y-3 min-[1920px]:space-y-4">
              <div className="px-1 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted2 xl:text-[11px] min-[1920px]:text-xs">Tu progreso</p>
              </div>

              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md xl:rounded-2xl xl:p-4 min-[1920px]:p-5"
                    style={{ background: `${stat.color}0c`, borderColor: `${stat.color}20` }}
                  >
                    <div className="mb-1.5 flex items-center gap-2 xl:mb-2 min-[1920px]:gap-3">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg xl:h-8 xl:w-8 xl:rounded-xl min-[1920px]:h-10 min-[1920px]:w-10"
                        style={{ background: `${stat.color}12`, border: `1px solid ${stat.color}24` }}
                      >
                        <Icon size={15} style={{ color: stat.color }} />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted2 xl:text-[11px] min-[1920px]:text-xs">{stat.label}</p>
                    </div>
                    <p className="text-xl font-bold leading-tight text-main xl:text-2xl min-[1920px]:text-3xl">{stat.value}</p>
                  </div>
                )
              })}

              <div
                className="rounded-xl border p-3 xl:rounded-2xl xl:p-4 min-[1920px]:p-5"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-sm)" }}
              >
                <div className="mb-2.5 xl:mb-3 min-[1920px]:mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted2 xl:text-[11px] min-[1920px]:text-xs">Siguiente nivel</p>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <span className="text-xs font-bold text-main xl:text-sm min-[1920px]:text-base">{nextLevel?.name || "Maestro"}</span>
                    <span className="text-[10px] tabular-nums text-muted2 xl:text-[11px] min-[1920px]:text-xs">
                      {xp}/{nextLevel?.min || currentLevel.max} XP
                    </span>
                  </div>
                </div>
                <div className="xp-bar-track">
                  <div className="xp-bar-fill" style={{ width: loaded ? `${progress}%` : "0%" }} />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
