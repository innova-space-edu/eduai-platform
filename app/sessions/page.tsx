"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Session {
  id: string
  topic: string
  created_at: string
  score?: number
  messages_count?: number
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase
        .from("study_sessions")
        .select("id, topic, created_at, score, messages_count")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (data) setSessions(data)
      setLoading(false)
    }
    init()
  }, [])

  const filtered = sessions.filter(s =>
    s.topic.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })

  const scoreColor = (score?: number) => {
    if (!score) return "text-gray-600"
    if (score >= 80) return "text-green-400"
    if (score >= 50) return "text-yellow-400"
    return "text-red-400"
  }

  // Agrupar por fecha
  const grouped = filtered.reduce((acc, s) => {
    const date = new Date(s.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
    if (!acc[date]) acc[date] = []
    acc[date].push(s)
    return acc
  }, {} as Record<string, Session[]>)

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm">
            ←
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-lg">📚</div>
          <div className="flex-1">
            <h1 className="text-white font-semibold text-sm">Mis Sesiones</h1>
            <p className="text-gray-500 text-xs">{sessions.length} sesiones guardadas</p>
          </div>
          <Link href="/dashboard"
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
            + Nueva sesión
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Búsqueda */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar sesión por tema..."
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-gray-200 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
        />

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{sessions.length}</p>
            <p className="text-gray-600 text-xs mt-0.5">Total sesiones</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">
              {sessions.filter(s => s.score && s.score >= 80).length}
            </p>
            <p className="text-gray-600 text-xs mt-0.5">Quiz excelente</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">
              {sessions.length > 0
                ? Math.round(sessions.filter(s => s.score).reduce((a, s) => a + (s.score || 0), 0) / sessions.filter(s => s.score).length) || 0
                : 0}%
            </p>
            <p className="text-gray-600 text-xs mt-0.5">Promedio quiz</p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && sessions.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📖</p>
            <h2 className="text-white font-semibold mb-2">Sin sesiones aún</h2>
            <p className="text-gray-500 text-sm mb-6">Empieza a estudiar para ver tu historial aquí</p>
            <Link href="/dashboard"
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Iniciar primera sesión →
            </Link>
          </div>
        )}

        {/* Sesiones agrupadas por fecha */}
        {!loading && Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <p className="text-gray-600 text-xs font-medium mb-2 px-1">{date}</p>
            <div className="flex flex-col gap-2">
              {items.map(s => (
                <Link
                  key={s.id}
                  href={`/study/${encodeURIComponent(s.topic)}`}
                  className="flex items-center gap-4 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-all group"
                >
                  {/* Icono carpeta */}
                  <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                    📁
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 font-medium text-sm truncate group-hover:text-white transition-colors">
                      {s.topic}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-600 text-xs">{formatTime(s.created_at)}</span>
                      {s.messages_count && s.messages_count > 0 && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span className="text-gray-600 text-xs">{s.messages_count} mensajes</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Score badge */}
                  <div className="flex-shrink-0 text-right">
                    {s.score !== null && s.score !== undefined ? (
                      <div className={`text-sm font-bold ${scoreColor(s.score)}`}>
                        {s.score}%
                        <p className="text-gray-700 text-xs font-normal">quiz</p>
                      </div>
                    ) : (
                      <span className="text-gray-700 text-xs">Sin quiz</span>
                    )}
                  </div>

                  <span className="text-gray-700 group-hover:text-gray-400 text-sm flex-shrink-0">→</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* No results search */}
        {!loading && sessions.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 text-sm">No se encontraron sesiones con "{search}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
