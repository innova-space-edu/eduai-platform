"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface ReviewItem {
  id: string
  topic: string
  next_review: string
  last_score: number
  interval: number
  repetitions: number
}

export default function ReviewSection() {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/spaced-repetition")
      .then(r => r.json())
      .then(data => setReviews(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function markAsReviewed(item: ReviewItem) {
    setMarkingId(item.id)
    try {
      const res = await fetch("/api/spaced-repetition", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: item.topic }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setReviews(prev => prev.filter(r => r.id !== item.id))
    } catch (error) {
      console.error(error)
    } finally {
      setMarkingId(null)
    }
  }

  if (loading || reviews.length === 0) return null

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🔔</span>
        <h3 className="text-lg font-semibold text-white">Repasos pendientes</h3>
        <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
          {reviews.length}
        </span>
      </div>
      <div className="grid gap-2">
        {reviews.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 bg-gray-900 border border-gray-800 hover:border-amber-500/50 rounded-xl px-4 py-3 transition-all"
          >
            <button
              onClick={() => router.push(`/study/${encodeURIComponent(item.topic)}`)}
              className="flex-1 text-left group"
            >
              <p className="text-white font-medium group-hover:text-amber-400 transition-colors capitalize">
                {item.topic}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                Último puntaje: {item.last_score}% · Repaso #{item.repetitions + 1}
              </p>
            </button>

            <div className="text-right flex items-center gap-3">
              <div>
                <p className="text-amber-400 text-xs font-medium">Repasar hoy</p>
                <p className="text-gray-600 text-xs">próximo en {item.interval}d</p>
              </div>
              <button
                onClick={() => markAsReviewed(item)}
                disabled={markingId === item.id}
                className="text-xs font-medium text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingId === item.id ? "Guardando..." : "Marcar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}