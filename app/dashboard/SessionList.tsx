"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Session {
  id: string
  topic: string
  status: string
  current_level: number
  correct_answers: number
  total_questions: number
}

interface Props {
  sessions: Session[]
}

export default function SessionList({ sessions: initialSessions }: Props) {
  const [sessions, setSessions] = useState(initialSessions)
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()

  async function deleteSession(id: string) {
    setDeleting(id)
    try {
      await fetch("/api/sessions/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: id }),
      })
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(null)
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600">
        <p className="text-5xl mb-4">📖</p>
        <p className="text-lg">Aún no tienes sesiones de estudio</p>
        <p className="text-sm mt-1">Escribe un tema arriba para comenzar</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 flex items-center justify-between transition-colors group"
        >
          <Link href={`/study/${encodeURIComponent(session.topic)}`} className="flex-1">
            <p className="text-white font-medium group-hover:text-blue-400 transition-colors">
              {session.topic}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Nivel {session.current_level} · {session.correct_answers}/{session.total_questions} correctas
            </p>
          </Link>

          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full ${
              session.status === "completed"
                ? "bg-green-500/10 text-green-400"
                : "bg-blue-500/10 text-blue-400"
            }`}>
              {session.status === "completed" ? "Completada" : "En progreso"}
            </span>

            <button
              onClick={() => deleteSession(session.id)}
              disabled={deleting === session.id}
              className="text-gray-700 hover:text-red-400 transition-colors text-lg disabled:opacity-50"
              title="Eliminar sesión"
            >
              {deleting === session.id ? "..." : "×"}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
