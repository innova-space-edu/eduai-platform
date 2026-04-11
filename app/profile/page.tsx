import { createClient } from "@/lib/supabase/server"
import MemoryMap from "./MemoryMap"
import { redirect } from "next/navigation"
import { signOut } from "@/app/(auth)/actions"
import Link from "next/link"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { data: sessions } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const levelNames = ["", "Explorador", "Aprendiz", "Practicante", "Analista", "Experto", "Maestro"]
  const levelColors = ["", "text-sub", "text-blue-400", "text-green-400", "text-purple-400", "text-amber-400", "text-red-400"]
  const levelBg = ["", "bg-blue-400", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-red-500"]
  const xpThresholds = [0, 100, 250, 500, 1000, 2000, 5000]

  const level = profile?.level || 1
  const currentXP = profile?.xp || 0
  const nextLevelXP = xpThresholds[Math.min(level + 1, 6)]
  const prevLevelXP = xpThresholds[level - 1] || 0
  const xpProgress = nextLevelXP
    ? Math.round(((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100)
    : 100

  // Stats calculadas
  const completedSessions = sessions?.filter(s => s.status === "completed") || []
  const totalCorrect = completedSessions.reduce((sum, s) => sum + (s.correct_answers || 0), 0)
  const totalQuestions = completedSessions.reduce((sum, s) => sum + (s.total_questions || 0), 0)
  const avgScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

  // Temas únicos estudiados
  const uniqueTopics = [...new Set(sessions?.map(s => s.topic) || [])]

  // Logros
  const achievements = [
    {
      id: "first_session",
      title: "Primera sesión",
      description: "Completaste tu primera sesión de estudio",
      emoji: "🎯",
      unlocked: completedSessions.length >= 1,
    },
    {
      id: "five_sessions",
      title: "Estudiante dedicado",
      description: "Completaste 5 sesiones",
      emoji: "📚",
      unlocked: completedSessions.length >= 5,
    },
    {
      id: "perfect_score",
      title: "Perfección",
      description: "Obtuviste 100% en un quiz",
      emoji: "⭐",
      unlocked: completedSessions.some(s => s.score === 100),
    },
    {
      id: "streak_3",
      title: "En racha",
      description: "3 días consecutivos estudiando",
      emoji: "🔥",
      unlocked: (profile?.streak_days || 0) >= 3,
    },
    {
      id: "five_topics",
      title: "Explorador curioso",
      description: "Estudiaste 5 temas diferentes",
      emoji: "🗺️",
      unlocked: uniqueTopics.length >= 5,
    },
    {
      id: "level_2",
      title: "Aprendiz",
      description: "Alcanzaste el nivel Aprendiz",
      emoji: "🏅",
      unlocked: level >= 2,
    },
    {
      id: "level_3",
      title: "Practicante",
      description: "Alcanzaste el nivel Practicante",
      emoji: "🥈",
      unlocked: level >= 3,
    },
    {
      id: "100_xp",
      title: "Centenario",
      description: "Acumulaste 100 XP",
      emoji: "💯",
      unlocked: currentXP >= 100,
    },
  ]

  return (
    <main className="min-h-screen bg-app text-main">
      {/* Navbar */}
      <nav className="border-b border-soft bg-card-theme backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-muted2 hover:text-main text-sm transition-colors">
              ← Dashboard
            </Link>
            <span className="text-muted2">|</span>
            <h1 className="text-main font-semibold">Mi Perfil</h1>
          </div>
          <form action={signOut}>
            <button className="text-muted2 hover:text-main text-sm transition-colors">Salir</button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Header del perfil */}
        <div className="bg-card-theme border border-soft rounded-2xl p-8">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 ${levelBg[level]} rounded-full flex items-center justify-center text-3xl font-bold text-main`}>
              {profile?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-main">{profile?.name || "Estudiante"}</h2>
                  <Link href="/profile/settings" className="flex items-center gap-2 bg-card-soft-theme hover:bg-card-soft-theme border border-soft hover:border-medium text-sub text-sm px-3 py-2 rounded-xl transition-all">
                    ⚙️ <span>Configurar</span>
                  </Link>
                </div>
              <p className="text-muted2 text-sm">{user.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`font-semibold ${levelColors[level]}`}>{levelNames[level]}</span>
                <span className="text-muted2">·</span>
                <span className="text-amber-400 text-sm">⚡ {currentXP} XP</span>
                <span className="text-muted2">·</span>
                <span className="text-orange-400 text-sm">🔥 {profile?.streak_days || 0} días</span>
              </div>
            </div>
          </div>

          {/* Barra de XP */}
          <div className="mt-6">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted2">Progreso hacia {levelNames[Math.min(level + 1, 6)]}</span>
              <span className="text-amber-400">{currentXP} / {nextLevelXP || "MAX"} XP</span>
            </div>
            <div className="w-full bg-card-soft-theme rounded-full h-3">
              <div
                className="h-3 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(xpProgress, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div>
          <h3 className="text-lg font-semibold text-main mb-4">📊 Estadísticas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Sesiones completadas", value: completedSessions.length, color: "text-green-400", emoji: "✅" },
              { label: "Preguntas respondidas", value: totalQuestions, color: "text-blue-400", emoji: "❓" },
              { label: "Precisión promedio", value: `${avgScore}%`, color: "text-purple-400", emoji: "🎯" },
              { label: "Temas explorados", value: uniqueTopics.length, color: "text-amber-400", emoji: "🗺️" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card-theme border border-soft rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">{stat.emoji}</div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-muted2 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Logros */}
        <div>
          <h3 className="text-lg font-semibold text-main mb-4">🏆 Logros</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {achievements.map((a) => (
              <div
                key={a.id}
                className={`border rounded-xl p-4 text-center transition-all ${
                  a.unlocked
                    ? "bg-card-theme border-medium"
                    : "bg-app border-soft opacity-40"
                }`}
              >
                <div className={`text-3xl mb-2 ${!a.unlocked && "grayscale"}`}>{a.emoji}</div>
                <p className={`text-sm font-semibold ${a.unlocked ? "text-main" : "text-muted2"}`}>
                  {a.title}
                </p>
                <p className="text-muted2 text-xs mt-1">{a.description}</p>
              </div>
            ))}
          </div>
        </div>

        <MemoryMap />

        {/* Mapa de temas */}
        {uniqueTopics.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-main mb-4">🗺️ Temas estudiados</h3>
            <div className="flex flex-wrap gap-3">
              {uniqueTopics.map((topic) => {
                const topicSessions = sessions?.filter(s => s.topic === topic) || []
                const completed = topicSessions.filter(s => s.status === "completed").length
                const bestScore = Math.max(...topicSessions.map(s => s.score || 0))
                return (
                  <Link
                    key={topic}
                    href={`/study/${encodeURIComponent(topic)}`}
                    className="bg-card-theme border border-soft hover:border-blue-500 rounded-xl px-4 py-3 transition-all group"
                  >
                    <p className="text-main font-medium group-hover:text-blue-400 transition-colors capitalize">
                      {topic}
                    </p>
                    <p className="text-muted2 text-xs mt-1">
                      {completed} sesión{completed !== 1 ? "es" : ""} · mejor: {bestScore}%
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
