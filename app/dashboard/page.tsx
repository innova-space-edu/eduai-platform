import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { signOut } from "@/app/(auth)/actions"
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

  // XP para siguiente nivel
  const xpThresholds = [0, 100, 250, 500, 1000, 2000, 5000]
  const currentXP = profile?.xp || 0
  const nextLevelXP = xpThresholds[Math.min(level + 1, 6)]
  const prevLevelXP = xpThresholds[level - 1] || 0
  const xpProgress = nextLevelXP
    ? Math.round(((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100)
    : 100

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-400">EduAI</h1>
          <div className="flex items-center gap-4">
            <Link href="/profile" className="text-gray-400 hover:text-white text-sm transition-colors">{profile?.name || user.email}</Link>
            <span className={`text-sm font-medium ${levelColors[level]}`}>
              {levelNames[level]}
            </span>
            <form action={signOut}>
              <button className="text-gray-500 hover:text-white text-sm transition-colors">Salir</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">

        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white mb-1">
            Hola, {profile?.name?.split(" ")[0] || "estudiante"} 👋
          </h2>
          <p className="text-gray-400">¿Qué quieres aprender hoy?</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Nivel", value: levelNames[level], color: levelColors[level] },
            { label: "XP Total", value: `${currentXP} XP`, color: "text-amber-400" },
            { label: "Racha", value: `${profile?.streak_days || 0} días`, color: "text-orange-400" },
            { label: "Sesiones", value: recentSessions?.length || 0, color: "text-green-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Barra de progreso XP */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-8">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-500">Progreso hacia {levelNames[Math.min(level + 1, 6)]}</span>
            <span className="text-amber-400">{currentXP} / {nextLevelXP} XP</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="h-2 bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(xpProgress, 100)}%` }}
            />
          </div>
        </div>

        <ReviewSection />

        {/* Input tema */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-10">
          <h3 className="text-lg font-semibold text-white mb-4">🎓 Comenzar nueva sesión</h3>
          <TopicInput />
        </div>

        {/* Sesiones recientes */}
        {recentSessions && recentSessions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">📚 Sesiones recientes</h3>
            <SessionList sessions={recentSessions} />
          </div>
        )}

        {(!recentSessions || recentSessions.length === 0) && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-5xl mb-4">📖</p>
            <p className="text-lg">Aún no tienes sesiones de estudio</p>
            <p className="text-sm mt-1">Escribe un tema arriba para comenzar</p>
          </div>
        )}

      </div>
    </main>
  )
}
