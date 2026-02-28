"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import MissionsPanel from "./MissionsPanel"

interface UserStats {
  xp: number
  level: string
  streak: number
  sessions: number
  nextLevelXP: number
}

const LEVELS = [
  { name: "Principiante", min: 0,    max: 100  },
  { name: "Aprendiz",     min: 100,  max: 500  },
  { name: "Practicante",  min: 500,  max: 1200 },
  { name: "Avanzado",     min: 1200, max: 2500 },
  { name: "Experto",      min: 2500, max: 5000 },
  { name: "Maestro",      min: 5000, max: 99999 },
]

// Agentes especializados (NO son para estudiar)
const AGENTS = [
  {
    id: "educador",
    icon: "🏫",
    name: "Planificador",
    desc: "Planificaciones y actividades MINEDUC para docentes y educadoras",
    color: "from-emerald-500 to-teal-600",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    href: "/educador",
    badge: "MINEDUC",
  },
  {
    id: "investigador",
    icon: "🔬",
    name: "Investigador",
    desc: "Busca en la web, resume papers y fuentes académicas",
    color: "from-blue-500 to-indigo-600",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    href: "/investigador",
    badge: "Web Search",
  },
  {
    id: "redactor",
    icon: "✍️",
    name: "Redactor",
    desc: "Ensayos, informes, cartas, resúmenes y documentos",
    color: "from-violet-500 to-purple-600",
    border: "border-violet-500/30",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    href: "/redactor",
    badge: "Documentos",
  },
  {
    id: "matematico",
    icon: "🧮",
    name: "Matemático",
    desc: "Resuelve problemas paso a paso con explicación visual",
    color: "from-orange-500 to-amber-600",
    border: "border-orange-500/30",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    href: "/matematico",
    badge: "Paso a paso",
  },
  {
    id: "traductor",
    icon: "🌐",
    name: "Traductor",
    desc: "Traducción y explicación en múltiples idiomas",
    color: "from-cyan-500 to-sky-600",
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    href: "/traductor",
    badge: "Multiidioma",
  },
]

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<UserStats>({ xp: 0, level: "Principiante", streak: 0, sessions: 0, nextLevelXP: 100 })
  const [topic, setTopic] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth/login"); return }
      setUser(user)
      loadStats(user.id)
    }
    getUser()
  }, [])

  const loadStats = async (userId: string) => {
    const { data } = await supabase.from("user_progress").select("*").eq("user_id", userId).single()
    if (data) {
      const lvl = LEVELS.find(l => data.xp >= l.min && data.xp < l.max) || LEVELS[0]
      setStats({ xp: data.xp, level: lvl.name, streak: data.streak || 0, sessions: data.sessions || 0, nextLevelXP: lvl.max })
    }
  }

  const handleStudy = () => {
    if (topic.trim()) router.push(`/study/${encodeURIComponent(topic.trim())}`)
  }

  const progress = ((stats.xp - (LEVELS.find(l => l.name === stats.level)?.min || 0)) /
    ((LEVELS.find(l => l.name === stats.level)?.max || 100) - (LEVELS.find(l => l.name === stats.level)?.min || 0))) * 100

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* ── Sidebar de Agentes ── */}
      <aside className={`fixed left-0 top-0 h-full z-20 flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 ${sidebarOpen ? "w-64" : "w-16"}`}>
        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-16 flex items-center justify-center text-gray-500 hover:text-white border-b border-gray-800 transition-colors flex-shrink-0"
        >
          <span className="text-lg">{sidebarOpen ? "◀" : "▶"}</span>
        </button>

        {/* Agentes */}
        <div className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          {sidebarOpen && (
            <p className="text-gray-600 text-xs px-4 mb-2 uppercase tracking-wider">Agentes</p>
          )}
          {AGENTS.map(agent => (
            <Link
              key={agent.id}
              href={agent.href}
              className={`flex items-center gap-3 mx-2 mb-1 rounded-xl p-2.5 border transition-all group
                ${sidebarOpen ? "border-transparent hover:border-gray-700 hover:bg-gray-800" : "border-transparent hover:bg-gray-800"}
              `}
              title={!sidebarOpen ? agent.name : undefined}
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-lg flex-shrink-0 shadow-lg`}>
                {agent.icon}
              </div>
              {sidebarOpen && (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-200 text-sm font-medium">{agent.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${agent.bg} ${agent.text} border ${agent.border} leading-none`}>{agent.badge}</span>
                  </div>
                  <p className="text-gray-600 text-xs mt-0.5 truncate">{agent.desc}</p>
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Bottom links */}
        <div className="border-t border-gray-800 py-3">
          {[
            { href: "/ranking",  icon: "🏆", label: "Ranking" },
            { href: "/collab",   icon: "🤝", label: "Colaborar" },
            { href: "/profile",  icon: "👤", label: "Perfil" },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 mx-2 mb-1 p-2.5 rounded-xl hover:bg-gray-800 transition-colors"
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="text-lg w-9 text-center flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-gray-400 text-sm">{item.label}</span>}
            </Link>
          ))}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-16"}`}>
        {/* Topbar */}
        <div className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
            <span className="text-blue-400 font-bold text-lg">EduAI</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">{user?.user_metadata?.name || user?.email?.split("@")[0]}</span>
              <span className="text-blue-400 text-sm font-medium">{stats.level}</span>
              <span className="text-yellow-400 text-sm font-bold">⚡ {stats.xp}</span>
              <button onClick={async () => { await supabase.auth.signOut(); router.push("/") }} className="text-gray-600 hover:text-gray-300 text-sm transition-colors">Salir</button>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Saludo */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-1">
              Hola, {user?.user_metadata?.name || user?.email?.split("@")[0]} 👋
            </h1>
            <p className="text-gray-500">¿Qué quieres aprender hoy?</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Nivel", value: stats.level, color: "text-blue-400" },
              { label: "XP Total", value: `${stats.xp} XP`, color: "text-yellow-400" },
              { label: "Racha", value: `${stats.streak} días`, color: "text-orange-400" },
              { label: "Sesiones", value: stats.sessions, color: "text-green-400" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-gray-600 text-xs mb-1">{s.label}</p>
                <p className={`font-bold text-lg ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 mb-6">
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span>Hacia {LEVELS[LEVELS.findIndex(l => l.name === stats.level) + 1]?.name || "Maestro"}</span>
              <span>{stats.xp} / {stats.nextLevelXP} XP</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </div>

          {/* Nueva sesión */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">📖 Nueva sesión de estudio</h2>
            <div className="flex gap-3">
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleStudy()}
                placeholder="Ej: Leyes de Newton, Segunda Guerra Mundial, Integrales..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 text-sm"
              />
              <button
                onClick={handleStudy}
                disabled={!topic.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                Estudiar →
              </button>
            </div>
          </div>

          {/* Agentes destacados (preview en dashboard) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">🤖 Agentes especializados</h2>
              <button onClick={() => setSidebarOpen(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Ver todos →</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {AGENTS.map(agent => (
                <Link
                  key={agent.id}
                  href={agent.href}
                  className={`bg-gray-900 border border-gray-800 hover:${agent.border} rounded-2xl p-4 transition-all group hover:bg-gray-800/80`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-xl mb-3`}>
                    {agent.icon}
                  </div>
                  <p className="text-white text-sm font-medium mb-1">{agent.name}</p>
                  <p className="text-gray-600 text-xs leading-relaxed">{agent.desc.slice(0, 50)}...</p>
                  <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full ${agent.bg} ${agent.text} border ${agent.border}`}>{agent.badge}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Misiones */}
          <MissionsPanel />
        </div>
      </main>
    </div>
  )
}
