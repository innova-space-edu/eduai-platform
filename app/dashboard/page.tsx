import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { signOut } from "@/app/(auth)/actions"
import Link from "next/link"
import TopicInput from "./TopicInput"
import SessionList from "./SessionList"
import ReviewSection from "./ReviewSection"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { data: recentSessions } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  const levelNames = ["", "Explorador", "Aprendiz", "Practicante", "Analista", "Experto", "Maestro"]
  const levelColors = ["", "text-gray-400", "text-blue-400", "text-green-400", "text-purple-400", "text-amber-400", "text-red-400"]
  const level = profile?.level || 1

  const xpThresholds = [0, 100, 250, 500, 1000, 2000, 5000]
  const currentXP = profile?.xp || 0
  const nextLevelXP = xpThresholds[Math.min(level + 1, 6)]
  const prevLevelXP = xpThresholds[level - 1] || 0
  const xpProgress = nextLevelXP
    ? Math.round(((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100)
    : 100

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-4 sm:px-6 py-3 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-blue-400">EduAI</h1>
            <Link href="/ranking" className="text-gray-500 hover:text-white text-xs transition-colors hidden sm:block">🏆 Ranking</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/profile" className="text-gray-400 hover:text-white text-sm transition-colors truncate max-w-[80px] sm:max-w-none">
              {profile?.name || user.email}
            </Link>
            <span className={`text-xs sm:text-sm font-medium hidden sm:block ${levelColors[level]}`}>
              {levelNames[level]}
            </span>
            <span className="text-amber-400 text-xs font-medium">⚡{currentXP}</span>
            <form action={signOut}>
              <button className="text-gray-500 hover:text-white text-sm transition-colors">Salir</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* Saludo */}
        <div className="mb-6 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            Hola, {profile?.name?.split(" ")[0] || "estudiante"} 👋
          </h2>
          <p className="text-gray-400 text-sm">¿Qué quieres aprender hoy?</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
          {[
            { label: "Nivel", value: levelNames[level], color: levelColors[level] },
            { label: "XP Total", value: `${currentXP} XP`, color: "text-amber-400" },
            { label: "Racha", value: `${profile?.streak_days || 0} días`, color: "text-orange-400" },
            { label: "Sesiones", value: recentSessions?.length || 0, color: "text-green-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
              <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
              <p className={`text-lg sm:text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Barra XP */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 sm:mb-8">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-500">Hacia {levelNames[Math.min(level + 1, 6)]}</span>
            <span className="text-amber-400">{currentXP} / {nextLevelXP} XP</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="h-2 bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(xpProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Repasos pendientes */}
        <ReviewSection />

        {/* Input tema */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-10">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">🎓 Nueva sesión</h3>
          <TopicInput />
        </div>

        {/* Sesiones recientes */}
        {recentSessions && recentSessions.length > 0 && (
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">📚 Sesiones recientes</h3>
            <SessionList sessions={recentSessions} />
          </div>
        )}

        {(!recentSessions || recentSessions.length === 0) && (
          <div className="text-center py-12 text-gray-600">
            <p className="text-4xl mb-3">📖</p>
            <p>Aún no tienes sesiones de estudio</p>
            <p className="text-sm mt-1">Escribe un tema arriba para comenzar</p>
          </div>
        )}
      </div>
    </main>
  )
}