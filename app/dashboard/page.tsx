"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import MissionsPanel from "./MissionsPanel"

interface UserStats {
  xp: number; level: string; streak: number; sessions: number
  nextLevelXP: number; nextLevelMin: number
}
interface Session {
  id: string; topic: string; created_at: string; score?: number
}

const LEVELS = [
  { name: "Principiante", min: 0,    max: 100   },
  { name: "Aprendiz",     min: 100,  max: 500   },
  { name: "Practicante",  min: 500,  max: 1200  },
  { name: "Avanzado",     min: 1200, max: 2500  },
  { name: "Experto",      min: 2500, max: 5000  },
  { name: "Maestro",      min: 5000, max: 99999 },
]

const AGENTS = [
  { id: "educador",     icon: "🏫", name: "Planificador",  color: "from-emerald-500 to-teal-600",  href: "/educador"     },
  { id: "investigador", icon: "🔬", name: "Investigador",  color: "from-blue-500 to-indigo-600",   href: "/investigador" },
  { id: "redactor",     icon: "✍️",  name: "Redactor",      color: "from-violet-500 to-purple-600", href: "/redactor"     },
  { id: "matematico",   icon: "🧮",  name: "Matemático",    color: "from-orange-500 to-amber-600",  href: "/matematico"   },
  { id: "traductor",    icon: "🌐",  name: "Traductor",     color: "from-cyan-500 to-sky-600",      href: "/traductor"    },
]

const BOTTOM_LINKS = [
  { href: "/ranking", icon: "🏆", label: "Ranking"   },
  { href: "/collab",  icon: "🤝", label: "Colaborar" },
  { href: "/profile", icon: "👤", label: "Perfil"    },
]

export default function Dashboard() {
  const [user, setUser]         = useState<any>(null)
  const [stats, setStats]       = useState<UserStats>({ xp:0, level:"Principiante", streak:0, sessions:0, nextLevelXP:100, nextLevelMin:0 })
  const [sessions, setSessions] = useState<Session[]>([])
  const [topic, setTopic]       = useState("")
  const [expanded, setExpanded] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth/login"); return }
      setUser(user)
      const { data } = await supabase.from("user_progress").select("*").eq("user_id", user.id).single()
      if (data) {
        const lvl = LEVELS.find(l => data.xp >= l.min && data.xp < l.max) || LEVELS[0]
        const nextLvl = LEVELS[LEVELS.indexOf(lvl) + 1]
        setStats({ xp:data.xp, level:lvl.name, streak:data.streak||0, sessions:data.sessions||0,
          nextLevelXP: nextLvl?.min || lvl.max, nextLevelMin: lvl.min })
      }
      const { data: sess } = await supabase
        .from("study_sessions").select("id, topic, created_at, score")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
      if (sess) setSessions(sess)
    }
    init()
  }, [])

  const progress = Math.min(
    ((stats.xp - stats.nextLevelMin) / (stats.nextLevelXP - stats.nextLevelMin)) * 100, 100
  )
  const handleStudy = () => {
    if (topic.trim()) router.push(`/study/${encodeURIComponent(topic.trim())}`)
  }
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-CL", { day:"numeric", month:"short" })

  const sidebarW = expanded ? "w-56" : "w-16"
  const mainML   = expanded ? "ml-56" : "ml-16"

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* ── Sidebar ── */}
      <aside className={`fixed left-0 top-0 h-full ${sidebarW} bg-gray-900 border-r border-gray-800 flex flex-col z-20 transition-all duration-300 overflow-hidden`}>

        {/* Toggle / Logo */}
        <button
          onClick={() => { setExpanded(!expanded); setShowSessions(false) }}
          className="h-14 flex items-center border-b border-gray-800 flex-shrink-0 hover:bg-gray-800 transition-colors px-3 gap-3 w-full"
        >
          <div className="w-10 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-400 font-bold text-lg">{expanded ? "◀" : "▶"}</span>
          </div>
          {expanded && (
            <span className="text-blue-400 font-bold text-sm whitespace-nowrap">
              Edu<span className="text-white">AI</span>
            </span>
          )}
        </button>

        {/* Agentes */}
        <div className="flex-1 py-3 flex flex-col overflow-y-auto overflow-x-hidden">
          {expanded && (
            <p className="text-gray-600 text-[10px] uppercase tracking-widest px-4 mb-2">Agentes</p>
          )}

          {AGENTS.map(agent => (
            <Link
              key={agent.id}
              href={agent.href}
              className="flex items-center gap-3 mx-2 mb-1 px-2 py-2.5 rounded-xl border border-transparent hover:bg-gray-800 hover:border-gray-700 transition-all group"
              title={!expanded ? agent.name : undefined}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-xl flex-shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                {agent.icon}
              </div>
              {expanded && (
                <span className="text-gray-400 group-hover:text-white text-sm font-medium whitespace-nowrap transition-colors">
                  {agent.name}
                </span>
              )}
            </Link>
          ))}

          {/* Sesiones */}
          <div className="mx-3 my-2 border-t border-gray-800" />
          <button
            onClick={() => setShowSessions(!showSessions)}
            className={`flex items-center gap-3 mx-2 mb-1 px-2 py-2.5 rounded-xl border transition-all group w-[calc(100%-16px)]
              ${showSessions ? "bg-gray-800 border-gray-700" : "border-transparent hover:bg-gray-800 hover:border-gray-700"}`}
            title={!expanded ? "Sesiones" : undefined}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-md transition-all
              ${showSessions ? "bg-blue-500/20 border border-blue-500/30" : "bg-gray-800 group-hover:scale-105"}`}>
              📚
            </div>
            {expanded && (
              <span className="text-gray-400 group-hover:text-white text-sm font-medium whitespace-nowrap">
                Sesiones
              </span>
            )}
          </button>
        </div>

        {/* Bottom links */}
        <div className="border-t border-gray-800 py-3">
          {BOTTOM_LINKS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 mx-2 mb-1 px-2 py-2 rounded-xl border border-transparent hover:bg-gray-800 hover:border-gray-700 transition-all group"
              title={!expanded ? item.label : undefined}
            >
              <span className="text-xl w-10 text-center flex-shrink-0">{item.icon}</span>
              {expanded && (
                <span className="text-gray-500 group-hover:text-gray-200 text-sm whitespace-nowrap transition-colors">
                  {item.label}
                </span>
              )}
            </Link>
          ))}
        </div>
      </aside>

      {/* ── Panel de sesiones (slide desde sidebar) ── */}
      {showSessions && (
        <div className={`fixed top-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-10 flex flex-col shadow-2xl transition-all duration-300 ${expanded ? "left-56" : "left-16"}`}>
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
            <div>
              <h2 className="text-white font-semibold text-sm">📚 Sesiones</h2>
              <p className="text-gray-600 text-xs">{sessions.length} sesiones guardadas</p>
            </div>
            <button onClick={() => setShowSessions(false)} className="text-gray-600 hover:text-gray-300 text-lg w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-800">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {sessions.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-4xl mb-2">📖</p>
                <p className="text-gray-600 text-sm">Sin sesiones aún</p>
                <p className="text-gray-700 text-xs mt-1">¡Empieza a estudiar!</p>
              </div>
            ) : (
              sessions.map(s => (
                <Link key={s.id} href={`/study/${encodeURIComponent(s.topic)}`}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-800 transition-colors group mb-1">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-base flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                    📁
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-300 text-xs font-medium truncate group-hover:text-white">{s.topic}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{formatDate(s.created_at)}</p>
                    {s.score != null && (
                      <span className={`text-xs font-medium ${s.score >= 80 ? "text-green-400" : s.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                        {s.score}%
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="border-t border-gray-800 p-3">
            <button onClick={handleStudy}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm py-2.5 rounded-xl transition-colors font-medium">
              + Nueva sesión
            </button>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${mainML} ${showSessions ? "ml-[calc(var(--sidebar-w)+256px)]" : ""}`}
        style={{ marginLeft: showSessions ? `${expanded ? 224+256 : 64+256}px` : expanded ? "224px" : "64px" }}>

        {/* Topbar */}
        <div className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
            <p className="text-gray-500 text-sm">Panel de estudio</p>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">{user?.user_metadata?.name || user?.email?.split("@")[0]}</span>
              <span className="text-blue-400 text-sm font-medium">{stats.level}</span>
              <span className="text-yellow-400 text-sm font-bold">⚡ {stats.xp}</span>
              <button onClick={async () => { await supabase.auth.signOut(); router.push("/") }}
                className="text-gray-600 hover:text-gray-300 text-sm transition-colors">Salir</button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
          {/* Saludo */}
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              Hola, {user?.user_metadata?.name || user?.email?.split("@")[0]} 👋
            </h1>
            <p className="text-gray-500 text-sm">¿Qué quieres aprender hoy?</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Nivel",    value: stats.level,           color: "text-blue-400"   },
              { label: "XP Total", value: `${stats.xp} XP`,      color: "text-yellow-400" },
              { label: "Racha",    value: `${stats.streak} días`, color: "text-orange-400" },
              { label: "Sesiones", value: String(stats.sessions), color: "text-green-400"  },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-gray-600 text-xs mb-1">{s.label}</p>
                <p className={`font-bold text-lg leading-tight ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-3">
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span>Hacia {LEVELS[LEVELS.findIndex(l => l.name === stats.level)+1]?.name || "Maestro"}</span>
              <span>{stats.xp} / {stats.nextLevelXP} XP</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Nueva sesión */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">📖 Nueva sesión de estudio</h2>
            <div className="flex gap-3">
              <input value={topic} onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleStudy()}
                placeholder="Ej: Leyes de Newton, Segunda Guerra Mundial, Integrales..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-sm" />
              <button onClick={handleStudy} disabled={!topic.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-medium transition-colors">
                Estudiar →
              </button>
            </div>
          </div>

          <MissionsPanel />
        </div>
      </main>
    </div>
  )
}
