"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import MathRenderer from "@/components/ui/MathRenderer"

interface Room { id: string; code: string; topic: string; host_id: string; guest_id: string | null; status: string }
interface Message { id: string; room_id?: string; user_id: string; user_name: string; content: string; type: string; created_at: string }
interface Props { room: Room; userId: string; userName: string }

export default function CollabClient({ room, userId, userName }: Props) {
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState("")
  const [roomStatus, setRoomStatus]   = useState(room.status)
  const [acoThinking, setAcoThinking] = useState(false)
  const [sending, setSending]         = useState(false)
  const [realtimeOk, setRealtimeOk]   = useState(false)
  const [memberCount, setMemberCount]  = useState(1)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const supabase    = useRef(createClient()).current
  const msgCountRef = useRef(0)
  const acoRef      = useRef(false)
  const isHost      = room.host_id === userId
  // ID único por pestaña para evitar colisión de canales
  const tabId       = useRef(`${userId.slice(0,8)}-${Date.now()}`).current

  useEffect(() => {
    joinRoom()
    loadMessages()

    const ch1 = supabase.channel(`rs-${tabId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "study_rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          const s = (payload.new as any)?.status
          setRoomStatus(s)
          if (s === "active" && isHost) setTimeout(() => triggerACo(true), 1500)
        })
      .subscribe((status) => { if (status === "SUBSCRIBED") setRealtimeOk(true) })

    const ch2 = supabase.channel(`rm-${tabId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          if (msg.type === "chat" && msg.user_id !== userId) {
            msgCountRef.current += 1
            // Solo el host llama ACo para evitar que ambos lo hagan
            if (isHost && msgCountRef.current % 2 === 0) {
              setTimeout(() => triggerACo(false), 800)
            }
          }
        })
      .subscribe()

    if (room.status === "active" && isHost) {
      setTimeout(() => triggerACo(true), 2000)
    }

    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
    loadMembersCount()
  }, [])
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, acoThinking])

  async function joinRoom() {
    if (!isHost) {
      await supabase.from("study_rooms").update({ guest_id: userId, status: "active" }).eq("id", room.id)
      setRoomStatus("active")
      await supabase.from("room_messages").insert({
        room_id: room.id, user_id: "system", user_name: "Sistema",
        content: `${userName} se unió a la sesión`, type: "system",
      })
    } else if (room.status === "active") {
      setRoomStatus("active")
    }
    await supabase.from("room_members").upsert({
      room_id: room.id, user_id: userId, user_name: userName,
      role: isHost ? "host" : "member", is_online: true,
      last_seen: new Date().toISOString(),
    }, { onConflict: "room_id,user_id" })
    
    const { count } = await supabase.from("room_members")
      .select("id", { count: "exact", head: true }).eq("room_id", room.id)
    
    if ((count || 0) >= 2) {
      await supabase.from("study_rooms").update({ status: "active" }).eq("id", room.id)
      setRoomStatus("active")
    }
  }
  async function loadMembersCount() {
    const { count } = await supabase.from("room_members")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id).eq("is_online", true)
    setMemberCount(count || 1)
  }

  async function loadMessages() {
    const { data } = await supabase.from("room_messages").select("*")
      .eq("room_id", room.id).order("created_at", { ascending: true })
    setMessages((data as Message[]) || [])
    msgCountRef.current = data?.length || 0
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)
    try {
      const { error } = await supabase.from("room_messages").insert({
        room_id: room.id, user_id: userId, user_name: userName, content, type: "chat",
      })
      if (error) { console.error(error); setInput(content) }
      else if (isHost) {
        msgCountRef.current += 1
        if (msgCountRef.current % 2 === 0) setTimeout(() => triggerACo(false), 800)
      }
    } finally { setSending(false) }
  }

  async function triggerACo(isWelcome = false) {
    if (acoRef.current) return
    acoRef.current = true
    setAcoThinking(true)
    try {
      const { data: recent } = await supabase.from("room_messages").select("*")
        .eq("room_id", room.id).order("created_at", { ascending: false }).limit(8)
      const res = await fetch("/api/agents/collab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: room.topic, messages: (recent || []).reverse(), isWelcome }),
      })
      if (!res.ok) return
      const data = await res.json()
      await supabase.from("room_messages").insert({
        room_id: room.id, user_id: "00000000-0000-0000-0000-000000000000",
        user_name: "ACo", content: data.message, type: "agent",
      })
    } catch (e) { console.error("ACo:", e) }
    finally { setAcoThinking(false); setTimeout(() => { acoRef.current = false }, 3000) }
  }

  function formatTime(d: string) { return new Date(d).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      <nav className="border-b border-white/5 bg-gray-900/80 backdrop-blur px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm">← Salir</Link>
            <span className="text-gray-700">|</span>
            <span className="text-white font-semibold text-sm">{room.topic}</span>
            <span className="text-gray-500 text-xs">#{room.code}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${roomStatus === "active" ? "bg-green-400" : "bg-amber-400 animate-pulse"}`} />
              <span className="text-xs text-gray-400">{roomStatus === "active" ? "2 conectados" : "Esperando..."}</span>
            </div>
            <div className={`w-1.5 h-1.5 rounded-full ${realtimeOk ? "bg-blue-400" : "bg-gray-600"}`} title={realtimeOk ? "Realtime activo" : "Conectando..."} />
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-1">
              <span className="text-blue-300 text-xs font-medium">{isHost ? "👑 " : ""}{userName}</span>
            </div>
          </div>
        </div>
      </nav>

      {roomStatus === "waiting" && isHost && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="text-5xl animate-bounce">⏳</div>
          <h2 className="text-xl font-bold">Sala creada</h2>
          <div className="bg-gray-900 border border-blue-500/30 rounded-3xl px-10 py-6 text-center">
            <p className="text-5xl font-bold text-blue-400 tracking-widest">{room.code}</p>
            <p className="text-gray-500 text-xs mt-3">Tema: {room.topic}</p>
          </div>
          <p className="text-gray-500 text-xs">Esperando que se una alguien...</p>
        </div>
      )}

      {(roomStatus === "active" || !isHost) && (
        <>
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">🤝</p>
                <p className="text-gray-300 font-medium">¡Sesión colaborativa iniciada!</p>
                <p className="text-gray-600 text-sm mt-1">Tema: <span className="text-blue-400">{room.topic}</span></p>
                <p className="text-gray-700 text-xs mt-2">El Profesor ACo llegará pronto...</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe     = msg.user_id === userId
              const isAgent  = msg.type === "agent"
              const isSystem = msg.type === "system"

              if (isSystem) return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-gray-700 text-xs bg-gray-900 border border-gray-800 px-3 py-1 rounded-full">{msg.content}</span>
                </div>
              )
              if (isAgent) return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs">🎓</div>
                      <span className="text-purple-400 text-xs font-semibold">Profesor ACo</span>
                      <span className="text-gray-700 text-[10px]">{formatTime(msg.created_at)}</span>
                    </div>
                    <MathRenderer content={msg.content} />
                  </div>
                </div>
              )
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-2xl px-4 py-3 max-w-sm ${isMe ? "bg-blue-600/20 border border-blue-500/30 rounded-tr-sm" : "bg-gray-900 border border-white/5 rounded-tl-sm"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${isMe ? "text-blue-300" : "text-amber-400"}`}>{isMe ? "Tú" : msg.user_name}</span>
                      <span className="text-gray-700 text-[10px]">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
                function looksLikeQuestion(text: string) {
                  const t = text.toLowerCase()
                  return t.includes("?") || t.includes("¿") || t.includes("no entiendo") ||
                    t.includes("explica") || t.includes("cómo") || t.includes("como ") ||
                    t.includes("por qué") || t.includes("porque") || t.includes("ayuda") ||
                    t.includes("ejemplo") || t.includes("duda")
                }
              )
            })}

            {acoThinking && (
              <div className="flex justify-start">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🎓</span>
                    <span className="text-purple-400 text-xs font-semibold">Profesor ACo está escribiendo...</span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay:`${d}ms` }} />)}
                  </div>
                </div>
                            <span className="text-xs text-gray-400">{roomStatus === "active" ? `${memberCount} conectados` : "Esperando..."}</span>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="max-w-2xl mx-auto w-full px-4 pb-2 flex items-center gap-4">
            <button onClick={() => triggerACo(false)} disabled={acoThinking}
              className="text-xs text-purple-500 hover:text-purple-300 disabled:opacity-40 transition-colors">
              🎓 Pedir explicación al Profesor
            </button>
            <button onClick={loadMessages} className="text-xs text-gray-600 hover:text-gray-400 transition-colors ml-auto">
              ↻ Actualizar
            </button>
          </div>

          <div className="border-t border-white/5 bg-gray-900/60 backdrop-blur px-4 py-3">
            <div className="max-w-2xl mx-auto flex gap-3">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !sending && sendMessage()}
                placeholder="Escribe tu respuesta o pregunta..."
                className="flex-1 bg-white/5 border border-white/8 focus:border-blue-500/40 rounded-2xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none text-sm" />
              <button onClick={sendMessage} disabled={!input.trim() || sending}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-2.5 rounded-2xl text-sm font-medium">
                {sending ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
