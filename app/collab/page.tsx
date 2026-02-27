"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function CollabPage() {
  const [topic, setTopic] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function createRoom() {
    if (!topic.trim()) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const room = await res.json()
      router.push(`/collab/${room.code}`)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  async function joinRoom() {
    if (!code.trim()) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const room = await res.json()
      router.push(`/collab/${room.code}`)
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">🤝</p>
          <h1 className="text-2xl font-bold text-white">Estudio Colaborativo</h1>
          <p className="text-gray-500 text-sm mt-1">Estudia en tiempo real con otro estudiante</p>
        </div>

        <div className="space-y-4">
          {/* Crear sala */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">✨ Crear nueva sala</h3>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createRoom()}
              placeholder="Tema a estudiar..."
              className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors text-sm mb-3"
            />
            <button
              onClick={createRoom}
              disabled={loading || !topic.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {loading ? "Creando..." : "Crear sala"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-gray-600 text-xs">o</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Unirse a sala */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">🔗 Unirse a sala existente</h3>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && joinRoom()}
              placeholder="Código de sala (ej: AB12CD)"
              maxLength={6}
              className="w-full bg-gray-800 border border-gray-700 focus:border-green-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors text-sm mb-3 tracking-widest text-center font-bold"
            />
            <button
              onClick={joinRoom}
              disabled={loading || code.length < 6}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {loading ? "Entrando..." : "Unirse"}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-400 text-sm transition-colors">
            ← Volver al dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
