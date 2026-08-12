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
    <div className="flex h-screen overflow-hidden bg-app">
      <aside
        style={{ width: expanded ? "220px" : "68px" }}
        className="fixed left-0 top-0 z-20 flex h-full flex-col overflow-hidden transition-all duration-300"
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
          <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b px-4" style={{ borderColor: "var(--border-soft)" }}>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
              <Zap size={18} className="text-main" />
            </div>
            {expanded && (
              <span className="animate-fade-in whitespace-nowrap text-base font-bold text-main">
                Edu<span className="text-blue-600">AI</span>
              </span>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 py-3">
            {NAV_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!expanded ? item.label : undefined}
                  className="group flex items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2.5 transition-all"
                  onMouseEnter={(event) => (event.currentTarget.style.background = `${item.color}0d`)}
                  onMouseLeave={(event) => (event.currentTarget.style.background = "")}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all group-hover:scale-105"
                    style={{ background: `${item.color}15`, border: `1px solid ${item.color}28` }}
                  >
                    <Icon size={17} style={{ color: item.color }} />
                  </div>
                  {expanded && (
                    <span className="whitespace-nowrap text-sm font-medium text-sub transition-colors group-hover:text-main">
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
                className="group mt-1 flex items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2.5 transition-all"
                onMouseEnter={(event) => (event.currentTarget.style.background = "rgba(124,58,237,0.07)")}
                onMouseLeave={(event) => (event.currentTarget.style.background = "")}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all group-hover:scale-105"
                  style={{
                    background: "rgba(124,58,237,0.12)",
                    border: "1px solid rgba(124,58,237,0.25)",
                  }}
                >
                  <ShieldCheck size={17} style={{ color: "#7c3aed" }} />
                </div>
                {expanded && (
                  <span className="whitespace-nowrap text-sm font-medium text-purple-600 transition-colors group-hover:text-purple-700">
                    Administración
                  </span>
                )}
              </Link>
            )}
          </nav>

          <div className="flex-shrink-0 border-t px-2 py-3" style={{ borderColor: "var(--border-soft)" }}>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push("/login")
              }}
              className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2.5 transition-all hover:border-red-100 hover:bg-red-50"
              title={!expanded ? "Salir" : undefined}
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)" }}
              >
                <LogOut size={16} className="text-muted2 transition-colors group-hover:text-red-500" />
              </div>
              {expanded && (
                <span className="whitespace-nowrap text-sm text-muted2 transition-colors group-hover:text-red-500">
                  Cerrar sesión
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      <main
        style={{ marginLeft: expanded ? "220px" : "68px" }}
        className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300"
      >
        <div
          className="z-10 shrink-0 border-b backdrop-blur-xl"
          style={{ background: "var(--bg-header)", borderColor: "var(--border-soft)" }}
        >
          <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-4 py-3 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted2">EduAI</p>
              <p className="hidden text-xs text-sub sm:block">Claw es tu espacio principal de trabajo</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/biblioteca"
                className="group flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  background: "rgba(124,58,237,0.08)",
                  borderColor: "rgba(124,58,237,0.18)",
                  color: "#6d28d9",
                }}
              >
                <LibraryBig size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">Biblioteca</span>
              </Link>
              <span className="hidden text-sm text-sub md:inline">{displayName}</span>
              <div
                className="rounded-xl border px-2.5 py-1 text-xs font-semibold lg:hidden"
                style={{ background: `${levelColor.glow}`, borderColor: "var(--border-soft)" }}
              >
                <span className={levelColor.text}>{level}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 gap-5 overflow-hidden px-3 py-3 sm:px-5 sm:py-4 xl:px-6">
          <div className="h-full min-h-0 min-w-0 flex-1">
            <ClawStudyConsole displayName={displayName} isAdmin={isAdmin} />
          </div>

          <aside className="hidden h-full w-[260px] shrink-0 overflow-y-auto overscroll-contain pb-2 lg:block">
            <div className="space-y-3">
              <div className="px-1 pb-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">Tu progreso</p>
              </div>

              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ background: `${stat.color}0c`, borderColor: `${stat.color}20` }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{ background: `${stat.color}12`, border: `1px solid ${stat.color}24` }}
                      >
                        <Icon size={15} style={{ color: stat.color }} />
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted2">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-bold leading-tight text-main">{stat.value}</p>
                  </div>
                )
              })}

              <div
                className="rounded-2xl border p-4"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-sm)" }}
              >
                <div className="mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted2">Siguiente nivel</p>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <span className="text-sm font-bold text-main">{nextLevel?.name || "Maestro"}</span>
                    <span className="text-[11px] tabular-nums text-muted2">
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
