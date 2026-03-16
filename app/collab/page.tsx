"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users, Plus, LogIn, Loader2, AlertCircle } from "lucide-react"

export default function CollabPage() {
  const [topic,   setTopic]   = useState("")
  const [code,    setCode]    = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const router = useRouter()

  async function createRoom() {
    if (!topic.trim()) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: topic.trim() }) })
      if (!res.ok) throw new Error(await res.text())
      const room = await res.json()
      router.push(`/collab/${room.code}`)
    } catch (e: any) { setError(e.message); setLoading(false) }
  }

  async function joinRoom() {
    if (!code.trim()) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/rooms", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }) })
      if (!res.ok) throw new Error(await res.text())
      const room = await res.json()
      router.push(`/collab/${room.code}`)
    } catch (e: any) { setError(e.message); setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-xl px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white transition-all">
            <ArrowLeft size={15} />
          </Link>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md"
               style={{ background: "linear-gradient(135deg, #0d9488, #14b8a6)", boxShadow: "0 4px 12px rgba(13,148,136,0.3)" }}>
            <Users size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm">Estudio Colaborativo</h1>
            <p className="text-gray-600 text-[11px]">Estudia en tiempo real con otro estudiante</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md flex flex-col gap-4">

          {/* Crear sala */}
          <div className="rounded-2xl p-5 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(13,148,136,0.15)", border: "1px solid rgba(13,148,136,0.25)" }}>
                <Plus size={14} className="text-teal-400" />
              </div>
              <h3 className="text-white font-semibold text-sm">Crear nueva sala</h3>
            </div>
            <input type="text" value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && createRoom()}
              placeholder="Tema a estudiar juntos..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-teal-500/40 focus:bg-white/[0.06] transition-all mb-3" />
            <button onClick={createRoom} disabled={loading || !topic.trim()}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #0d9488, #14b8a6)", boxShadow: topic.trim() ? "0 4px 16px rgba(13,148,136,0.3)" : "none" }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Crear sala
            </button>
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            <span className="text-gray-600 text-xs">o</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Unirse */}
          <div className="rounded-2xl p-5 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}>
                <LogIn size={14} className="text-blue-400" />
              </div>
              <h3 className="text-white font-semibold text-sm">Unirse a sala existente</h3>
            </div>
            <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && joinRoom()}
              placeholder="CÓDIGO (ej: AB12CD)" maxLength={6}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06] transition-all mb-3 tracking-[0.3em] text-center font-bold uppercase" />
            <button onClick={joinRoom} disabled={loading || code.length < 6}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: code.length >= 6 ? "linear-gradient(135deg, #1d4ed8, #3b82f6)" : "rgba(255,255,255,0.06)", boxShadow: code.length >= 6 ? "0 4px 16px rgba(59,130,246,0.25)" : "none" }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Unirse
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-500/20" style={{ background: "rgba(239,68,68,0.08)" }}>
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
