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
  { href: "/agentes", icon: Bot, label: "Agentes", color: "#3b82f6" },
  { href: "/sessions", icon: BookOpen, label: "Sesiones", color: "#8b5cf6" },
  { href: "/chat", icon: MessageCircle, label: "Chat", color: "#10b981" },
  { href: "/collab", icon: Users, label: "Colaborar", color: "#14b8a6" },
  { href: "/creator-hub", icon: Sparkles, label: "Creator Hub", color: "#6366f1" },
  { href: "/workspace", icon: FolderKanban, label: "Workspace", color: "#4338ca" },
  { href: "/profile", icon: UserCircle2, label: "Perfil", color: "#94a3b8" },
]

const LEVEL_COLORS = [
  { text: "text-gray-400", glow: "rgba(148,163,184,0.3)" },
  { text: "text-blue-400", glow: "rgba(96,165,250,0.3)" },
  { text: "text-green-400", glow: "rgba(52,211,153,0.3)" },
  { text: "text-purple-400", glow: "rgba(167,139,250,0.3)" },
  { text: "text-amber-400", glow: "rgba(251,191,36,0.3)" },
  { text: "text-red-400", glow: "rgba(248,113,113,0.3)" },
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
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setUser(user)

      // Verificar si es admin
      const { data: adminData } = await supabase
        .from("admin_emails")
        .select("email")
        .eq("email", user.email)
        .maybeSingle()

      setIsAdmin(!!adminData)

      // Cargar perfil
      const { data: profileData } = await supabase
        .from("profiles")
        .select("xp, streak_days")
        .eq("id", user.id)
        .maybeSingle()

      // Contar sesiones
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
    if (topic.trim()) {
      router.push(`/study/${encodeURIComponent(topic.trim())}`)
    }
  }

  const displayName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Estudiante"

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <aside
        style={{ width: expanded ? "220px" : "68px" }}
        className="fixed left-0 top-0 h-full z-20 flex flex-col transition-all duration-300 overflow-hidden"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="absolute inset-0 bg-gray-950/95 backdrop-blur-xl border-r border-white/[0.06]" />

        <div className="relative flex flex-col h-full">
          <div className="h-14 flex items-center border-b border-white/[0.06] px-4 gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
              <Zap size={18} className="text-white" />
            </div>
            {expanded && (
              <span className="font-bold text-white text-base whitespace-nowrap animate-fade-in">
                Edu<span className="text-blue-400">AI</span>
              </span>
            )}
          </div>

          <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto overflow-x-hidden">
            {NAV_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!expanded ? item.label : undefined}
                  className="flex items-center gap-3 px-2.5 py-2.5 rounded-2xl border border-transparent hover:bg-white/[0.05] hover:border-white/[0.07] transition-all group"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
                    style={{
                      background: `${item.color}18`,
                      border: `1px solid ${item.color}30`,
                    }}
                  >
                    <Icon size={17} style={{ color: item.color }} />
                  </div>
                  {expanded && (
                    <span className="text-gray-400 group-hover:text-white text-sm font-medium whitespace-nowrap transition-colors">
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
                className="flex items-center gap-3 px-2.5 py-2.5 rounded-2xl border border-transparent hover:bg-purple-500/[0.08] hover:border-purple-500/20 transition-all group mt-1"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
                  style={{
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.3)",
                  }}
                >
                  <ShieldCheck size={17} style={{ color: "#a78bfa" }} />
                </div>
                {expanded && (
                  <span className="text-purple-400 group-hover:text-purple-300 text-sm font-medium whitespace-nowrap transition-colors">
                    Administración
                  </span>
                )}
              </Link>
            )}
          </nav>

          <div className="border-t border-white/[0.06] py-3 px-2 flex-shrink-0">
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push("/login")
              }}
              className="flex items-center gap-3 px-2.5 py-2.5 rounded-2xl border border-transparent hover:bg-red-500/8 hover:border-red-500/15 transition-all group w-full"
              title={!expanded ? "Salir" : undefined}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/[0.03] border border-white/[0.06]">
                <LogOut
                  size={16}
                  className="text-gray-500 group-hover:text-red-400 transition-colors"
                />
              </div>
              {expanded && (
                <span className="text-gray-500 group-hover:text-red-400 text-sm whitespace-nowrap transition-colors">
                  Cerrar sesión
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      <main
        style={{ marginLeft: expanded ? "220px" : "68px" }}
        className="flex-1 flex flex-col min-h-screen transition-all duration-300"
      >
        <div className="border-b border-white/[0.06] bg-gray-950/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
            <p className="text-gray-600 text-xs font-medium uppercase tracking-widest">
              Panel
            </p>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm">{displayName}</span>
              <div
                className="px-2.5 py-1 rounded-xl text-xs font-semibold"
                style={{
                  background: `${levelColor.glow}20`,
                  color:
                    levelColor.text.replace("text-", "") === "gray-400"
                      ? "#94a3b8"
                      : undefined,
                }}
              >
                <span className={levelColor.text}>{level}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/8 border border-amber-500/15">
                <Zap size={11} className="text-amber-400" />
                <span className="text-amber-400 text-xs font-bold tabular-nums">
                  {xp}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-1">
              Hola, {displayName} 👋
            </h1>
            <p className="text-gray-500 text-sm">¿Qué quieres aprender hoy?</p>
          </div>

          <div className="grid grid-cols-4 gap-3 stagger">
            {[
              { label: "Nivel", value: level, icon: BarChart3, color: "#3b82f6" },
              { label: "XP Total", value: `${xp}`, icon: Zap, color: "#f59e0b" },
              { label: "Racha", value: `${streak}d`, icon: Flame, color: "#f97316" },
              {
                label: "Sesiones",
                value: String(sessions),
                icon: BookMarked,
                color: "#10b981",
              },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div
                  key={s.label}
                  className="rounded-2xl p-4 border transition-all hover:scale-[1.02] animate-fade-in"
                  style={{
                    background: `${s.color}0c`,
                    borderColor: `${s.color}20`,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={12} style={{ color: s.color }} />
                    <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide">
                      {s.label}
                    </p>
                  </div>
                  <p className="font-bold text-xl leading-tight text-white">{s.value}</p>
                </div>
              )
            })}
          </div>

          <div
            className="rounded-2xl px-5 py-4 border animate-fade-in"
            style={{
              background: "rgba(255,255,255,0.02)",
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex justify-between text-xs text-gray-500 mb-2.5">
              <span>
                Progreso hacia{" "}
                <span className="text-gray-400">{nextLevel?.name || "Maestro"}</span>
              </span>
              <span className="tabular-nums">
                {xp} / {nextLevel?.min || curLevel.max} XP
              </span>
            </div>
            <div className="xp-bar-track">
              <div
                className="xp-bar-fill"
                style={{ width: loaded ? `${progress}%` : "0%" }}
              />
            </div>
          </div>

          <div
            className="rounded-2xl p-5 border animate-fade-in"
            style={{
              background: "rgba(255,255,255,0.02)",
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                <BookOpen size={14} className="text-blue-400" />
              </div>
              <h2 className="text-white font-semibold text-sm">
                Nueva sesión de estudio
              </h2>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600"
                />
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStudy()}
                  placeholder="Ej: Leyes de Newton, Integrales, Segunda Guerra..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06] text-sm transition-all"
                />
              </div>
              <button
                onClick={handleStudy}
                disabled={!topic.trim()}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40"
                style={{
                  background: topic.trim()
                    ? "linear-gradient(135deg, #2563eb, #3b82f6)"
                    : "rgba(255,255,255,0.05)",
                  boxShadow: topic.trim()
                    ? "0 4px 16px rgba(59,130,246,0.25)"
                    : "none",
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
