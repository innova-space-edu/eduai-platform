"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import MathRenderer from "@/components/ui/MathRenderer"
import { BarChart3, Flame, Zap } from "lucide-react"

interface Session {
  id: string
  topic: string
  created_at: string
  score?: number
  status?: string
  study_mode?: string
  correct_answers?: number
  total_questions?: number
  messages?: ChatMessage[]
}

interface ChatMessage {
  role: "ai" | "user"
  content: string
}

const LEVELS = [
  { name: "Principiante", min: 0, max: 100 },
  { name: "Aprendiz", min: 100, max: 500 },
  { name: "Practicante", min: 500, max: 1200 },
  { name: "Avanzado", min: 1200, max: 2500 },
  { name: "Experto", min: 2500, max: 5000 },
  { name: "Maestro", min: 5000, max: 99999 },
]

// ── Modal de conversación ──────────────────────────────────────────────────────
function ConversationModal({
  session,
  onClose,
}: {
  session: Session
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(session.messages || [])
  const [loading, setLoading]   = useState(!session.messages?.length)

  useEffect(() => {
    if (session.messages?.length) return
    // Intentar cargar mensajes si están guardados
    fetch(`/api/sessions/${session.id}/messages`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMessages(data || []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [session.id])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })

  const scoreColor = (score?: number) => {
    if (!score) return "text-muted2"
    if (score >= 80) return "text-green-400"
    if (score >= 50) return "text-amber-400"
    return "text-red-400"
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app">
      {/* Header */}
      <div className="border-b border-soft bg-header-theme backdrop-blur px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-card-soft-theme hover:bg-card-soft-theme text-sub hover:text-main transition-all text-sm"
        >
          ←
        </button>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-lg flex-shrink-0">
          📖
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-main font-semibold text-sm truncate">{session.topic}</h2>
          <p className="text-muted2 text-xs">{formatDate(session.created_at)}</p>
        </div>
        {session.score !== undefined && session.score !== null && (
          <div className={`text-right flex-shrink-0 ${scoreColor(session.score)}`}>
            <p className="text-lg font-bold">{session.score}%</p>
            <p className="text-xs text-muted2">quiz</p>
          </div>
        )}
      </div>

      {/* Stats rápidas */}
      <div className="flex gap-3 px-4 py-3 border-b border-soft bg-card-theme overflow-x-auto">
        {[
          { label: "Modo", value: session.study_mode || "normal" },
          { label: "Mensajes", value: loading ? "…" : String(messages.length) },
          { label: "Correctas", value: session.correct_answers !== undefined ? `${session.correct_answers}/${session.total_questions}` : "—" },
          { label: "Estado", value: session.status === "completed" ? "✓ Completada" : "En progreso" },
        ].map(stat => (
          <div key={stat.label} className="flex-shrink-0 bg-card-soft-theme rounded-xl px-3 py-2 text-center min-w-[80px]">
            <p className="text-main text-sm font-semibold">{stat.value}</p>
            <p className="text-muted2 text-[10px] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Contenido mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-3xl mx-auto w-full">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-muted2 text-sm">Cargando conversación...</p>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💬</p>
            <h3 className="text-main font-semibold mb-1">Conversación no guardada</h3>
            <p className="text-muted2 text-sm mb-6">
              Esta sesión fue creada antes de que el guardado de mensajes estuviera activo.
            </p>
            <Link
              href={`/study/${encodeURIComponent(session.topic)}`}
              className="bg-blue-600 hover:bg-blue-500 text-main px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Estudiar de nuevo →
            </Link>
          </div>
        )}

        {!loading && messages.length > 0 && (
          <div className="space-y-5">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "ai" ? (
                  <div>
                    <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 mb-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      <span className="text-blue-400 text-xs font-medium">AGT</span>
                    </div>
                    <MathRenderer content={msg.content} />
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <div className="bg-blue-600/20 border border-blue-600/30 rounded-2xl rounded-tr-sm px-4 py-3 max-w-lg">
                      <p className="text-main text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="pt-4 border-t border-soft text-center">
              <p className="text-muted2 text-xs mb-3">— Fin de la sesión —</p>
              <Link
                href={`/study/${encodeURIComponent(session.topic)}`}
                className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-700 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                🔄 Continuar estudiando este tema
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function SessionsPage() {
  const [sessions, setSessions]     = useState<Session[]>([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [syncError, setSyncError]   = useState("")
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ total: number; completed: number; avgScore: number | null }>({
    total: 0,
    completed: 0,
    avgScore: null,
  })
  const [progressSummary, setProgressSummary] = useState<{ xp: number; streakDays: number }>({
    xp: 0,
    streakDays: 0,
  })
  const [search, setSearch]         = useState("")
  const [activeSession, setActive]  = useState<Session | null>(null)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  const loadSessions = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setSyncing(true)
    setSyncError("")

    try {
      const response = await fetch("/api/sessions", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || "No se pudieron cargar las sesiones.")

      const nextSessions = Array.isArray(payload.sessions) ? payload.sessions : []
      setSessions(nextSessions)
      setSummary({
        total: Number(payload.summary?.total ?? nextSessions.length),
        completed: Number(payload.summary?.completed ?? 0),
        avgScore: typeof payload.summary?.avgScore === "number" ? payload.summary.avgScore : null,
      })
      setProgressSummary({
        xp: Number(payload.progress?.xp ?? 0),
        streakDays: Number(payload.progress?.streakDays ?? 0),
      })
      setLastSyncedAt(typeof payload.syncedAt === "string" ? payload.syncedAt : new Date().toISOString())
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudieron sincronizar las sesiones.")
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [router])

  useEffect(() => {
    const supabase = supabaseRef.current
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      await loadSessions(true)
      if (cancelled) return

      channel = supabase
        .channel(`study-sessions:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "study_sessions",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void loadSessions(false)
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          () => {
            void loadSessions(false)
          },
        )
        .subscribe()
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadSessions(false)
    }

    const refreshOnFocus = () => {
      void loadSessions(false)
    }

    void init()
    document.addEventListener("visibilitychange", refreshWhenVisible)
    window.addEventListener("focus", refreshOnFocus)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", refreshWhenVisible)
      window.removeEventListener("focus", refreshOnFocus)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [loadSessions, router])

  const filtered = sessions.filter(s =>
    s.topic.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })

  const scoreColor = (score?: number) => {
    if (!score) return "text-muted2"
    if (score >= 80) return "text-green-400"
    if (score >= 50) return "text-amber-400"
    return "text-red-400"
  }

  const grouped = filtered.reduce((acc, s) => {
    const date = formatDate(s.created_at)
    if (!acc[date]) acc[date] = []
    acc[date].push(s)
    return acc
  }, {} as Record<string, Session[]>)

  const totalCompleted = summary.completed
  const avgScore = summary.avgScore
  const xp = progressSummary.xp
  const streak = progressSummary.streakDays
  const currentLevel = [...LEVELS].reverse().find((item) => xp >= item.min) || LEVELS[0]
  const currentLevelIndex = LEVELS.findIndex((item) => item.name === currentLevel.name)
  const nextLevel = LEVELS[currentLevelIndex + 1]
  const levelProgress = nextLevel
    ? Math.min(((xp - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100, 100)
    : 100

  return (
    <>
      {/* Modal de conversación */}
      {activeSession && (
        <ConversationModal
          session={activeSession}
          onClose={() => setActive(null)}
        />
      )}

      <div className="min-h-screen bg-app flex flex-col">
        {/* Header */}
        <div className="border-b border-soft bg-header-theme sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-card-soft-theme hover:bg-card-soft-theme text-sub hover:text-main transition-all text-sm"
            >
              ←
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-lg">
              📚
            </div>
            <div className="flex-1">
              <h1 className="text-main font-semibold text-sm">Mis Sesiones</h1>
              <p className="text-muted2 text-xs">
                {summary.total} sesiones guardadas
                <span className="ml-1">
                  {syncing ? "· sincronizando…" : lastSyncedAt ? "· sincronizado" : ""}
                </span>
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-xs bg-blue-600 hover:bg-blue-500 text-main px-3 py-1.5 rounded-lg transition-colors"
            >
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
            className="w-full bg-card-theme border border-soft rounded-xl px-4 py-2.5 text-main text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500/50"
          />

          {syncError && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <span>{syncError}</span>
              <button
                type="button"
                onClick={() => void loadSessions(false)}
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold hover:bg-amber-100"
              >
                Reintentar
              </button>
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted2">Tu progreso</p>
                <p className="mt-1 text-xs text-muted2">Nivel, XP y racha asociados a tus sesiones.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Nivel", value: currentLevel.name, icon: BarChart3, color: "#2563eb" },
                { label: "XP Total", value: String(xp), icon: Zap, color: "#d97706" },
                { label: "Racha", value: `${streak}d`, icon: Flame, color: "#ea580c" },
              ].map((stat) => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="rounded-2xl border p-4"
                    style={{ background: `${stat.color}0c`, borderColor: `${stat.color}20` }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{ background: `${stat.color}12`, border: `1px solid ${stat.color}24` }}
                      >
                        <Icon size={15} style={{ color: stat.color }} />
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted2">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-bold leading-tight text-main">{stat.value}</p>
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl border border-soft bg-card-theme p-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted2">Siguiente nivel</p>
                  <p className="mt-1 text-sm font-bold text-main">{nextLevel?.name || "Maestro"}</p>
                </div>
                <span className="text-[11px] tabular-nums text-muted2">
                  {xp}/{nextLevel?.min || currentLevel.max} XP
                </span>
              </div>
              <div className="xp-bar-track">
                <div className="xp-bar-fill" style={{ width: `${levelProgress}%` }} />
              </div>
            </div>
          </section>

          {/* Estadísticas de sesiones */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card-theme border border-soft rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{summary.total}</p>
              <p className="text-muted2 text-xs mt-0.5">Total sesiones</p>
            </div>
            <div className="bg-card-theme border border-soft rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{totalCompleted}</p>
              <p className="text-muted2 text-xs mt-0.5">Completadas</p>
            </div>
            <div className="bg-card-theme border border-soft rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${avgScore ? scoreColor(avgScore) : "text-muted2"}`}>
                {avgScore ? `${avgScore}%` : "—"}
              </p>
              <p className="text-muted2 text-xs mt-0.5">Promedio quiz</p>
            </div>
          </div>

          {/* Loader */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Empty */}
          {!loading && sessions.length === 0 && (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">📖</p>
              <h2 className="text-main font-semibold mb-2">Sin sesiones aún</h2>
              <p className="text-muted2 text-sm mb-6">Empieza a estudiar para ver tu historial aquí</p>
              <Link
                href="/dashboard"
                className="bg-blue-600 hover:bg-blue-500 text-main px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Iniciar primera sesión →
              </Link>
            </div>
          )}

          {/* Sesiones agrupadas por fecha */}
          {!loading && Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <p className="text-muted2 text-xs font-medium mb-2 px-1">{date}</p>
              <div className="flex flex-col gap-2">
                {items.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center gap-4 bg-card-theme border border-soft hover:border-medium rounded-2xl p-4 transition-all group"
                  >
                    {/* Icono */}
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                      {s.status === "completed" ? "✅" : "📁"}
                    </div>

                    {/* Info — al hacer click abre el modal */}
                    <button
                      onClick={() => setActive(s)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-main font-medium text-sm truncate group-hover:text-main transition-colors">
                        {s.topic}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-muted2 text-xs">{formatTime(s.created_at)}</span>
                        {s.study_mode && s.study_mode !== "normal" && (
                          <>
                            <span className="text-muted2">·</span>
                            <span className="text-muted2 text-xs capitalize">{s.study_mode}</span>
                          </>
                        )}
                      </div>
                    </button>

                    {/* Score + acciones */}
                    <div className="flex-shrink-0 flex items-center gap-3">
                      {s.score !== null && s.score !== undefined ? (
                        <div className={`text-sm font-bold ${scoreColor(s.score)} text-right`}>
                          {s.score}%
                          <p className="text-muted2 text-xs font-normal">quiz</p>
                        </div>
                      ) : (
                        <span className="text-muted2 text-xs">Sin quiz</span>
                      )}

                      {/* Botón ver conversación */}
                      <button
                        onClick={() => setActive(s)}
                        className="text-[10px] text-muted2 hover:text-blue-400 border border-soft hover:border-blue-500/40 rounded-lg px-2 py-1.5 transition-all"
                        title="Ver conversación"
                      >
                        👁 Ver
                      </button>

                      {/* Botón continuar */}
                      <Link
                        href={`/study/${encodeURIComponent(s.topic)}`}
                        className="text-[10px] text-muted2 hover:text-sub border border-soft hover:border-medium rounded-lg px-2 py-1.5 transition-all"
                        title="Continuar estudiando"
                      >
                        →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* No results */}
          {!loading && sessions.length > 0 && filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-muted2 text-sm">No se encontraron sesiones con "{search}"</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
