"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface Memory {
  topic: string
  summary: string
  last_score: number
  study_count: number
  strong_points: string[]
  weak_points: string[]
  updated_at: string
}

export default function MemoryMap() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/memory")
      .then(r => r.json())
      .then(data => setMemories(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading || memories.length === 0) return null

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">🧠 Memoria de aprendizaje</h3>
      <div className="grid gap-3">
        {memories.map((m) => (
          <div
            key={m.topic}
            className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === m.topic ? null : m.topic)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  m.last_score >= 80 ? "bg-green-400" :
                  m.last_score >= 60 ? "bg-amber-400" : "bg-red-400"
                }`} />
                <div>
                  <p className="text-white font-medium capitalize">{m.topic}</p>
                  <p className="text-gray-500 text-xs">{m.study_count} sesión{m.study_count !== 1 ? "es" : ""} · {m.last_score}%</p>
                </div>
              </div>
              <span className="text-gray-600 text-sm">{expanded === m.topic ? "▲" : "▼"}</span>
            </button>

            {expanded === m.topic && (
              <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
                {m.summary && (
                  <p className="text-gray-400 text-sm italic">"{m.summary}"</p>
                )}

                {m.strong_points?.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 font-medium mb-1">✅ Puntos fuertes</p>
                    <ul className="space-y-1">
                      {m.strong_points.map((p, i) => (
                        <li key={i} className="text-gray-400 text-xs flex items-start gap-1">
                          <span className="text-green-500 mt-0.5">·</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.weak_points?.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 font-medium mb-1">⚠️ Puntos débiles</p>
                    <ul className="space-y-1">
                      {m.weak_points.map((p, i) => (
                        <li key={i} className="text-gray-400 text-xs flex items-start gap-1">
                          <span className="text-red-500 mt-0.5">·</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Link
                  href={`/study/${encodeURIComponent(m.topic)}`}
                  className="inline-block text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Estudiar de nuevo →
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
