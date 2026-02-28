"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

const LEVELS = [
  { name: "Principiante", min: 0,    max: 100   },
  { name: "Aprendiz",     min: 100,  max: 500   },
  { name: "Practicante",  min: 500,  max: 1200  },
  { name: "Avanzado",     min: 1200, max: 2500  },
  { name: "Experto",      min: 2500, max: 5000  },
  { name: "Maestro",      min: 5000, max: 99999 },
]

const AGENTS = [
  { id: "educador",     icon: "🏫", name: "Planificador", color: "from-emerald-500 to-teal-600",  href: "/educador"     },
  { id: "investigador", icon: "🔬", name: "Investigador", color: "from-blue-500 to-indigo-600",   href: "/investigador" },
  { id: "redactor",     icon: "✍️",  name: "Redactor",     color: "from-violet-500 to-purple-600", href: "/redactor"     },
  { id: "matematico",   icon: "🧮",  name: "Matemático",   color: "from-orange-500 to-amber-600",  href: "/matematico"   },
  { id: "traductor",    icon: "🌐",  name: "Traductor",    color: "from-cyan-500 to-sky-600",      href: "/traductor"    },
  { id: "paper",        icon: "📄",  name: "Chat Paper",   color: "from-indigo-500 to-blue-700",   href: "/paper"        },
  { id: "examen",       icon: "📝",  name: "Examen",       color: "from-red-500 to-rose-600",      href: "/examen"       },
]

const BOTTOM_LINKS = [
  { href: "/sessions", icon: "📚", label: "Sesiones"  },
  { href: "/ranking",  icon: "🏆", label: "Ranking"   },
  { href: "/collab",   icon: "🤝", label: "Colaborar" },
  { href: "/profile",  icon: "👤", label: "Perfil"    },
]

export default function Dashboard() {
  const [user, setUser]         = useState<any>(null)
  const [xp, setXp]             = useState(0)
  const [level, setLevel]       = useState("Principiante")
  const [streak, setStreak]     = useState(0)
  const [sessions, setSessions] = useState(0)
  const [topic, setTopic]       = useState("")
  const [expanded, setExpanded] = useState(false)
  const [ready, setReady]       = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth/login"); return }
      setUser(user)
      const { data } = await supabase
        .from("user_progress")
        .select("xp, streak, sessions")
        .eq("user_id", user.id)
        .maybeSingle()
      if (data) {
        setXp(data.xp || 0)
        setStreak(data.streak || 0)
        setSessions(data.sessions || 0)
        const lvl = [...LEVELS].reverse().find(l => (data.xp || 0) >= l.min)
        setLevel(lvl?.name || "Principiante")
      }
    }
    init()
  }, [])

  const nextLevel = LEVELS[LEVELS.findIndex(l => l.name === level) + 1]
  const curLevel  = LEVELS.find(l => l.name === level) || LEVELS[0]
  const progress  = nextLevel
    ? Math.min(((xp - curLevel.min) / (nextLevel.min - curLevel.min)) * 100, 100)
    : 100

  const handleStudy = () => {
    if (topic.trim()) router.push(`/study/${encodeURIComponent(topic.trim())}`)
  }

  const sw = expanded ? "224px" : "64px"

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* Sidebar */}
      <aside
        style={{ width: sw }}
        className="fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-800 flex flex-col z-20 transition-all duration-300 overflow-hidden"
      >
        <button
          onClick={() => setExpanded(!expanded)}
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

        <div className="flex-1 py-3 flex flex-col overflow-y-auto overflow-x-hidden">
          {expanded && (
            <p className="text-gray-600 text-[10px] uppercase tracking-widest px-4 mb-2">Agentes</p>
          )}
          {AGENTS.map(a => (
            <Link
              key={a.id}
              href={a.href}
              title={!expanded ? a.name : undefined}
              className="flex items-center gap-3 mx-2 mb-1 px-2 py-2.5 rounded-xl border border-transparent hover:bg-gray-800 hover:border-gray-700 transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-xl flex-shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                {a.icon}
              </div>
              {expanded && (
                <span className="text-gray-400 group-hover:text-white text-sm font-medium whitespace-nowrap">
                  {a.name}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="border-t border-gray-800 py-3 flex flex-col flex-shrink-0">
          {BOTTOM_LINKS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              title={!expanded ? item.label : undefined}
              className="flex items-center gap-3 mx-2 mb-1 px-2 py-2 rounded-xl border border-transparent hover:bg-gray-800 hover:border-gray-700 transition-all group"
            >
              <span className="text-xl w-10 text-center flex-shrink-0">{item.icon}</span>
              {expanded && (
                <span className="text-gray-500 group-hover:text-gray-200 text-sm whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </Link>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main
        style={{ marginLeft: sw }}
        className="flex-1 flex flex-col min-h-screen transition-all duration-300"
      >
        {/* Topbar */}
        <div className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
            <p className="text-gray-500 text-sm">Panel de estudio</p>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">
                {user?.user_metadata?.name || user?.email?.split("@")[0]}
              </span>
              <span className="text-blue-400 text-sm font-medium">{level}</span>
              <span className="text-yellow-400 text-sm font-bold">⚡ {xp}</span>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.push("/") }}
                className="text-gray-600 hover:text-gray-300 text-sm transition-colors"
              >
                Salir
              </button>
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
              { label: "Nivel",    value: level,           color: "text-blue-400"   },
              { label: "XP Total", value: `${xp} XP`,      color: "text-yellow-400" },
              { label: "Racha",    value: `${streak} días`, color: "text-orange-400" },
              { label: "Sesiones", value: String(sessions), color: "text-green-400"  },
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
              <span>Hacia {nextLevel?.name || "Maestro"}</span>
              <span>{xp} / {nextLevel?.min || curLevel.max} XP</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Nueva sesión */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
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
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-medium transition-colors"
              >
                Estudiar →
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
