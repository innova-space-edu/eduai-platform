import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { signOut } from "@/app/(auth)/actions"
import Link from "next/link"

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
    .limit(5)

  const levelNames = ["", "Explorador", "Aprendiz", "Practicante", "Analista", "Experto", "Maestro"]
  const levelColors = ["", "text-gray-400", "text-blue-400", "text-green-400", "text-purple-400", "text-amber-400", "text-red-400"]

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-400">EduAI</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {profile?.name || user.email}
            </span>
            <span className={`text-sm font-medium ${levelColors[profile?.level || 1]}`}>
              {levelNames[profile?.level || 1]}
            </span>
            <form action={signOut}>
              <button className="text-gray-500 hover:text-white text-sm transition-colors">
                Salir
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Bienvenida */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white mb-1">
            Hola, {profile?.name?.split(" ")[0] || "estudiante"} 👋
          </h2>
          <p className="text-gray-400">¿Qué quieres aprender hoy?</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Nivel", value: levelNames[profile?.level || 1], color: levelColors[profile?.level || 1] },
            { label: "XP Total", value: `${profile?.xp || 0} XP`, color: "text-blue-400" },
            { label: "Racha", value: `${profile?.streak_days || 0} días`, color: "text-amber-400" },
            { label: "Sesiones", value: recentSessions?.length || 0, color: "text-green-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Input de tema */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-10">
          <h3 className="text-lg font-semibold text-white mb-4">
            🎓 Comenzar nueva sesión
          </h3>
          <TopicInput />
        </div>

        {/* Sesiones recientes */}
        {recentSessions && recentSessions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              📚 Sesiones recientes
            </h3>
            <div className="grid gap-3">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/study/${encodeURIComponent(session.topic)}`}
                  className="bg-gray-900 border border-gray-800 hover:border-blue-500/50 rounded-xl px-5 py-4 flex items-center justify-between transition-colors group"
                >
                  <div>
                    <p className="text-white font-medium group-hover:text-blue-400 transition-colors">
                      {session.topic}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Nivel {session.current_level} · {session.correct_answers}/{session.total_questions} correctas
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    session.status === "completed"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-blue-500/10 text-blue-400"
                  }`}>
                    {session.status === "completed" ? "Completada" : "En progreso"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
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

// Componente cliente para el input del tema
function TopicInput() {
  return (
    <form action="/study" method="GET" className="flex gap-3">
      <input
        name="topic"
        type="text"
        placeholder="Ej: Leyes de Newton, Segunda Guerra Mundial, Integrales..."
        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
      />
      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
      >
        Estudiar →
      </button>
    </form>
  )
}
