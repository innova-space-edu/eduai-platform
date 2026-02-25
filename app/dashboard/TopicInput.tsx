"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function TopicInput() {
  const [topic, setTopic] = useState("")
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    router.push(`/study/${encodeURIComponent(topic.trim())}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
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
