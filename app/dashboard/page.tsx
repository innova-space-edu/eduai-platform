"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import MissionsPanel from "./MissionsPanel"
import {
  Bot, BookOpen, MessageCircle, Users,
  Sparkles, UserCircle2, LogOut,
  Flame, Zap, BookMarked, BarChart3, Search, FolderKanban, ShieldCheck
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
  { href: "/collab", icon: Users, label: "Colaborar", color: "#0d9488" },
  { href: "/workspace", icon: FolderKanban, label: "Workspace", color: "#4338ca" },
  { href: "/profile", icon: UserCircle2, label: "Perfil", color: "var(--text-muted)" },
]

const LEVEL_COLORS = [
  { text: "text-muted2", glow: "rgba(100,116,139,0.25)" },
  { text: "text-blue-600",  glow: "rgba(37,99,235,0.22)" },
  { text: "text-emerald-600", glow: "rgba(5,150,105,0.22)" },
  { text: "text-purple-600", glow: "rgba(124,58,237,0.22)" },
  { text: "text-amber-600",  glow: "rgba(217,119,6,0.22)" },
  { text: "text-red-600",   glow: "rgba(220,38,38,0.22)" },
]

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState("Principiante")
  const [streak, setStreak] = useState(0)
  const [sessions, setSessions] = useState(0)
  const [topic, setTopic] = useState("")
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      setUser(user)

      const { data: adminData } = await supabase
        .from("admin_emails").select("email").eq("email", user.email).maybeSingle()
      setIsAdmin(!!adminData)

      const { data: profileData } = await supabase
        .from("profiles").select("xp, streak_days").eq("id", user.id).maybeSingle()

      const { count } = await supabase
        .from("study_sessions").select("*", { count: "exact", head: true }).eq("user_id", user.id)
      setSessions(count || 0)

      if (profileData) {
        const currentXp = profileData.xp || 0
        const currentStreak = profileData.streak_days || 0
        setXp(currentXp)
        setStreak(currentStreak)
        const lvl = [...LEVELS].reverse().find((l) => currentXp >= l.min)
        setLevel(lvl?.name || "Principiante")
      }
      setLoaded(true)
    }
    init()
  }, [router, supabase])

  const levelIdx = LEVELS.findIndex((l) => l.name === level)
  const nextLevel = LEVELS[levelIdx + 1]
  const curLevel = LEVELS[levelIdx] || LEVELS[0]
  const progress = nextLevel
    ? Math.min(((xp - curLevel.min) / (nextLevel.min - curLevel.min)) * 100, 100)
    : 100
  const levelColor = LEVEL_COLORS[levelIdx] || LEVEL_COLORS[0]

  const handleStudy = () => {
    if (topic.trim()) router.push(`/study/${encodeURIComponent(topic.trim())}`)
  }

  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Estudiante"

  return (
    <div className="min-h-screen bg-app flex">
      {/* ── Sidebar ── */}
      <aside
        style={{ width: expanded ? "220px" : "68px" }}
        className="fixed left-0 top-0 h-full z-20 flex flex-col transition-all duration-300 overflow-hidden"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div
          className="absolute inset-0 backdrop-blur-xl border-r"
          style={{ background: "var(--bg-sidebar)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-sm)" }}
        />

        <div className="relative flex flex-col h-full">
          {/* Logo */}
          <div
            className="h-14 flex items-center border-b px-4 gap-3 flex-shrink-0"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
              <Zap size={18} className="text-main" />
            </div>
            {expanded && (
              <span className="font-bold text-main text-base whitespace-nowrap animate-fade-in">
                Edu<span className="text-blue-600">AI</span>
              </span>
            )}
          </div>

          {/* Nav links */}
          <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto overflow-x-hidden">
            {NAV_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!expanded ? item.label : undefined}
                  className="flex items-center gap-3 px-2.5 py-2.5 rounded-2xl border border-transparent transition-all group"
                  style={{ ["--hover-bg" as string]: `${item.color}10` }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${item.color}0d`)}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
                    style={{ background: `${item.color}15`, border: `1px solid ${item.color}28` }}
                  >
                    <Icon size={17} style={{ color: item.color }} />
                  </div>
                  {expanded && (
                    <span className="text-sub group-hover:text-main text-sm font-medium whitespace-nowrap transition-colors">
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
                className="flex items-center gap-3 px-2.5 py-2.5 rounded-2xl border border-transparent transition-all group mt-1"
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,58,237,0.07)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
                  style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)" }}>
                  <ShieldCheck size={17} style={{ color: "#7c3aed" }} />
                </div>
                {expanded && (
                  <span className="text-purple-600 group-hover:text-purple-700 text-sm font-medium whitespace-nowrap transition-colors">
                    Administración
                  </span>
                )}
              </Link>
            )}
          </nav>

          {/* Logout */}
          <div className="border-t py-3 px-2 flex-shrink-0" style={{ borderColor: "var(--border-soft)" }}>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push("/login") }}
              className="flex items-center gap-3 px-2.5 py-2.5 rounded-2xl border border-transparent hover:bg-red-50 hover:border-red-100 transition-all group w-full"
              title={!expanded ? "Salir" : undefined}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)" }}>
                <LogOut size={16} className="text-muted2 group-hover:text-red-500 transition-colors" />
              </div>
              {expanded && (
                <span className="text-muted2 group-hover:text-red-500 text-sm whitespace-nowrap transition-colors">
                  Cerrar sesión
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        style={{ marginLeft: expanded ? "220px" : "68px" }}
        className="flex-1 flex flex-col min-h-screen transition-all duration-300"
      >
        {/* Header */}
        <div
          className="backdrop-blur-xl sticky top-0 z-10 border-b"
          style={{ background: "var(--bg-header)", borderColor: "var(--border-soft)" }}
        >
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
            <p className="text-muted2 text-xs font-semibold uppercase tracking-widest">Panel</p>
            <div className="flex items-center gap-3">
              <span className="text-sub text-sm">{displayName}</span>
              <div
                className="px-2.5 py-1 rounded-xl text-xs font-semibold border"
                style={{ background: `${levelColor.glow}`, borderColor: "var(--border-soft)" }}
              >
                <span className={levelColor.text}>{level}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-xl border"
                style={{ background: "rgba(217,119,6,0.08)", borderColor: "rgba(217,119,6,0.18)" }}>
                <Zap size={11} style={{ color: "var(--accent-amber)" }} />
                <span className="text-xs font-bold tabular-nums" style={{ color: "var(--accent-amber)" }}>{xp}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
          {/* Greeting */}
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-main mb-1">Hola, {displayName} 👋</h1>
            <p className="text-muted2 text-sm">¿Qué quieres aprender hoy?</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 stagger">
            {[
              { label: "Nivel", value: level, icon: BarChart3, color: "#2563eb" },
              { label: "XP Total", value: `${xp}`, icon: Zap, color: "#d97706" },
              { label: "Racha", value: `${streak}d`, icon: Flame, color: "#ea580c" },
              { label: "Sesiones", value: String(sessions), icon: BookMarked, color: "#059669" },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div
                  key={s.label}
                  className="rounded-2xl p-4 border transition-all hover:scale-[1.02] hover:shadow-md animate-fade-in"
                  style={{ background: `${s.color}0c`, borderColor: `${s.color}20` }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={12} style={{ color: s.color }} />
                    <p className="text-muted2 text-[11px] font-medium uppercase tracking-wide">{s.label}</p>
                  </div>
                  <p className="font-bold text-xl leading-tight text-main">{s.value}</p>
                </div>
              )
            })}
          </div>

          {/* XP Progress */}
          <div
            className="rounded-2xl px-5 py-4 border animate-fade-in"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex justify-between text-xs mb-2.5" style={{ color: "var(--text-muted)" }}>
              <span>
                Progreso hacia{" "}
                <span style={{ color: "var(--text-secondary)" }}>{nextLevel?.name || "Maestro"}</span>
              </span>
              <span className="tabular-nums">{xp} / {nextLevel?.min || curLevel.max} XP</span>
            </div>
            <div className="xp-bar-track">
              <div className="xp-bar-fill" style={{ width: loaded ? `${progress}%` : "0%" }} />
            </div>
          </div>

          {/* Study input */}
          <div
            className="rounded-2xl p-5 border animate-fade-in"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(37,99,235,0.10)", border: "1px solid rgba(37,99,235,0.20)" }}>
                <BookOpen size={14} style={{ color: "var(--accent-blue)" }} />
              </div>
              <h2 className="text-main font-semibold text-sm">Nueva sesión de estudio</h2>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStudy()}
                  placeholder="Ej: Leyes de Newton, Integrales, Segunda Guerra..."
                  className="w-full rounded-xl pl-9 pr-4 py-3 text-sm transition-all focus:outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-medium)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(37,99,235,0.45)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")}
                />
              </div>
              <button
                onClick={handleStudy}
                disabled={!topic.trim()}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40"
                style={{
                  background: topic.trim()
                    ? "linear-gradient(135deg, #1d4ed8, #2563eb)"
                    : "var(--border-medium)",
                  boxShadow: topic.trim() ? "0 4px 16px rgba(37,99,235,0.28)" : "none",
                  color: topic.trim() ? "white" : "var(--text-muted)",
                }}
              >
                <span>Estudiar</span>
              </button>
            </div>
          </div>

          <MissionsPanel />
        </div>
      </main>
    </div>
  )
}
