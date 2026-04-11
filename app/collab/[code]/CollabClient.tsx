"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import MathRenderer from "@/components/ui/MathRenderer"

interface Room    { id: string; code: string; topic: string; host_id: string; guest_id: string | null; status: string }
interface Message { id: string; room_id?: string; user_id: string; user_name: string; content: string; type: string; created_at: string }
interface Props   { room: Room; userId: string; userName: string }

// Colores para avatares por nombre
const AVATAR_COLORS = [
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-green-500 to-emerald-500",
  "from-amber-500 to-orange-500",
  "from-red-500 to-rose-500",
  "from-indigo-500 to-violet-500",
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const color = getAvatarColor(name)
  const cls   = size === "md" ? "w-8 h-8 text-sm" : "w-6 h-6 text-xs"
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-main font-bold flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Presencia en tiempo real ───────────────────────────────────────────────────
interface PresenceUser {
  userId: string
  userName: string
  isTyping: boolean
  joinedAt: number
}

export default function CollabClient({ room, userId, userName }: Props) {
  const [messages, setMessages]      = useState<Message[]>([])
  const [input, setInput]            = useState("")
  const [roomStatus, setRoomStatus]  = useState(room.status)
  const [acoThinking, setAcoThinking]= useState(false)
  const [sending, setSending]        = useState(false)
  const [realtimeOk, setRealtimeOk]  = useState(false)

  // ── Presencia
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([])
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef      = useRef(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase  = useRef(createClient()).current
  const acoRef    = useRef(false)
  const isHost    = room.host_id === userId
  const tabId     = useRef(`${userId.slice(0, 8)}-${Date.now()}`).current

  // Canal de presencia compartido por sala
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Helpers de presencia ─────────────────────────────────────────────────────
  function broadcastPresence(isTyping: boolean) {
    presenceChannelRef.current?.track({
      userId,
      userName,
      isTyping,
      joinedAt: Date.now(),
    })
  }

  function handleInputChange(val: string) {
    setInput(val)

    // Typing indicator
    if (val.trim() && !isTypingRef.current) {
      isTypingRef.current = true
      broadcastPresence(true)
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false
      broadcastPresence(false)
    }, 2000)
  }

  // ── Inicialización ───────────────────────────────────────────────────────────
  useEffect(() => {
    joinRoom()
    loadMessages()
    setupPresenceChannel()
    setupMessageChannel()
    setupRoomChannel()

    if (room.status === "active" && isHost) {
      setTimeout(() => triggerACo(true), 2000)
    }

    // Heartbeat cada 20s para mantener presencia activa
    const heartbeat = setInterval(() => {
      broadcastPresence(isTypingRef.current)
    }, 20_000)

    return () => {
      clearInterval(heartbeat)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      presenceChannelRef.current?.untrack()
      supabase.removeAllChannels()
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, acoThinking])

  // ── Canal de presencia (Supabase Realtime Presence) ──────────────────────────
  function setupPresenceChannel() {
    const ch = supabase.channel(`presence:${room.id}`, {
      config: { presence: { key: userId } },
    })

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<PresenceUser>()
      const users = Object.values(state).flat().map(u => ({
        userId:   u.userId,
        userName: u.userName,
        isTyping: u.isTyping,
        joinedAt: u.joinedAt,
      }))
      setPresentUsers(users)
    })

    ch.on("presence", { event: "join" }, ({ newPresences }) => {
      const joined = newPresences.map((p: any) => p.userName).filter((n: string) => n !== userName)
      if (joined.length > 0) {
        setMessages(prev => [
          ...prev,
          {
            id: `presence-join-${Date.now()}`,
            user_id: "system",
            user_name: "Sistema",
            content: `${joined.join(", ")} se conectó`,
            type: "system",
            created_at: new Date().toISOString(),
          },
        ])
      }
    })

    ch.on("presence", { event: "leave" }, ({ leftPresences }) => {
      const left = leftPresences.map((p: any) => p.userName).filter((n: string) => n !== userName)
      if (left.length > 0) {
        setMessages(prev => [
          ...prev,
          {
            id: `presence-leave-${Date.now()}`,
            user_id: "system",
            user_name: "Sistema",
            content: `${left.join(", ")} se desconectó`,
            type: "system",
            created_at: new Date().toISOString(),
          },
        ])
      }
    })

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setRealtimeOk(true)
        // Broadcast presencia inicial
        await ch.track({ userId, userName, isTyping: false, joinedAt: Date.now() })
      }
    })

    presenceChannelRef.current = ch
  }

  // ── Canal de mensajes ─────────────────────────────────────────────────────────
  function setupMessageChannel() {
    supabase
      .channel(`rm-${tabId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "room_messages",
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const msg = payload.new as Message
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        if (
          msg.type === "chat" &&
          msg.user_id !== "system" &&
          msg.user_id !== "00000000-0000-0000-0000-000000000000" &&
          msg.user_id !== userId
        ) {
          if (looksLikeQuestion(msg.content)) {
            setTimeout(() => triggerACo(false), 600)
          }
        }
      })
      .subscribe()
  }

  // ── Canal de sala ─────────────────────────────────────────────────────────────
  function setupRoomChannel() {
    supabase
      .channel(`rs-${tabId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "study_rooms",
        filter: `id=eq.${room.id}`,
      }, (payload) => {
        const s = (payload.new as any)?.status
        setRoomStatus(s)
        if (s === "active" && isHost) setTimeout(() => triggerACo(true), 1500)
      })
      .subscribe()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function looksLikeQuestion(text: string) {
    const t = text.toLowerCase()
    return t.includes("?") || t.includes("¿") || t.includes("no entiendo") ||
      t.includes("explica") || t.includes("cómo") || t.includes("como ") ||
      t.includes("por qué") || t.includes("porque") || t.includes("ayuda") ||
      t.includes("ejemplo") || t.includes("duda")
  }

  async function joinRoom() {
    await supabase.from("room_members").upsert({
      room_id: room.id, user_id: userId, user_name: userName,
      role: isHost ? "host" : "member", is_online: true,
      last_seen: new Date().toISOString(),
    }, { onConflict: "room_id,user_id" })

    await supabase.from("room_messages").insert({
      room_id: room.id, user_id: userId,
      user_name: "Sistema",
      content: `${userName} se unió a la sesión`,
      type: "system",
    })

    const { count } = await supabase.from("room_members")
      .select("id", { count: "exact", head: true }).eq("room_id", room.id)

    if ((count || 0) >= 2) {
      await supabase.from("study_rooms").update({ status: "active" }).eq("id", room.id)
      setRoomStatus("active")
    }
  }

  async function loadMessages() {
    const { data } = await supabase.from("room_messages").select("*")
      .eq("room_id", room.id).order("created_at", { ascending: true })
    setMessages((data as Message[]) || [])
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)

    // Limpiar typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    isTypingRef.current = false
    broadcastPresence(false)

    try {
      const { error } = await supabase.from("room_messages").insert({
        room_id: room.id, user_id: userId, user_name: userName, content, type: "chat",
      })
      if (error) { console.error(error); setInput(content) }
    } finally {
      setSending(false)
    }
  }

  async function triggerACo(isWelcome = false) {
    if (acoRef.current) return
    acoRef.current = true
    setAcoThinking(true)
    try {
      if (!isWelcome) {
        const { data: locked } = await supabase.rpc("claim_tutor_lock", {
          p_room_id: room.id, p_owner: userId, p_seconds: 15,
        })
        if (!locked) { setAcoThinking(false); acoRef.current = false; return }
      }
      const { data: recent } = await supabase.from("room_messages").select("*")
        .eq("room_id", room.id).order("created_at", { ascending: false }).limit(8)
      const res = await fetch("/api/agents/collab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: room.topic, messages: (recent || []).reverse(), isWelcome }),
      })
      if (!res.ok) return
      const data = await res.json()
      await supabase.from("room_messages").insert({
        room_id: room.id, user_id: userId,
        user_name: "ACo", content: data.message, type: "agent",
      })
    } catch (e) { console.error("ACo:", e) }
    finally { setAcoThinking(false); setTimeout(() => { acoRef.current = false }, 3000) }
  }

  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
  }

  // ── Usuarios en línea (excluye al propio usuario de la lista visible) ─────────
  const otherUsers    = presentUsers.filter(u => u.userId !== userId)
  const typingUsers   = otherUsers.filter(u => u.isTyping)
  const onlineCount   = presentUsers.length
  const typingNames   = typingUsers.map(u => u.userName)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-app text-main flex flex-col">

      {/* Nav */}
      <nav className="border-b border-soft bg-card-theme backdrop-blur px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-muted2 hover:text-main text-sm transition-colors">← Salir</Link>
            <span className="text-muted2">|</span>
            <span className="text-main font-semibold text-sm">{room.topic}</span>
            <span className="text-muted2 text-xs">#{room.code}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Avatares de presencia en tiempo real */}
            <div className="flex items-center gap-1.5">
              {/* Avatares de otros usuarios */}
              <div className="flex -space-x-2">
                {/* Propio avatar */}
                <div className="relative" title={`${userName} (tú)`}>
                  <Avatar name={userName} size="md" />
                  {isHost && (
                    <span className="absolute -top-1 -right-1 text-[8px]">👑</span>
                  )}
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border border-soft" />
                </div>

                {/* Avatares de otros */}
                {otherUsers.map(u => (
                  <div key={u.userId} className="relative" title={u.userName}>
                    <Avatar name={u.userName} size="md" />
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border border-soft" />
                  </div>
                ))}
              </div>

              {/* Contador y estado */}
              <div className="flex items-center gap-1.5 ml-1">
                <div className={`w-1.5 h-1.5 rounded-full ${roomStatus === "active" ? "bg-green-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
                <span className="text-xs text-sub">
                  {roomStatus === "active" ? `${onlineCount} en línea` : "Esperando..."}
                </span>
              </div>
            </div>

            {/* Indicador realtime */}
            <div
              className={`w-1.5 h-1.5 rounded-full ${realtimeOk ? "bg-emerald-400" : "bg-red-300"}`}
              title={realtimeOk ? "Realtime activo" : "Conectando..."}
            />
          </div>
        </div>
      </nav>

      {/* Waiting */}
      {roomStatus === "waiting" && isHost && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="text-5xl animate-bounce">⏳</div>
          <h2 className="text-xl font-bold">Sala creada</h2>
          <div className="bg-card-theme border border-blue-500/30 rounded-2xl px-10 py-6 text-center">
            <p className="text-5xl font-bold text-blue-400 tracking-widest">{room.code}</p>
            <p className="text-muted2 text-xs mt-3">Tema: {room.topic}</p>
          </div>
          <p className="text-muted2 text-xs">Esperando que se una alguien...</p>
          <div className="flex items-center gap-2 text-muted2 text-xs">
            <div className={`w-2 h-2 rounded-full ${realtimeOk ? "bg-green-400 animate-pulse" : "bg-card-soft-theme"}`} />
            {realtimeOk ? "Presencia activa — te notificaremos al instante" : "Conectando..."}
          </div>
        </div>
      )}

      {/* Chat activo */}
      {(roomStatus === "active" || !isHost) && (
        <>
          {/* Lista de mensajes */}
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">🤝</p>
                <p className="text-sub font-medium">¡Sesión colaborativa iniciada!</p>
                <p className="text-muted2 text-sm mt-1">Tema: <span className="text-blue-400">{room.topic}</span></p>
                <p className="text-muted2 text-xs mt-2">El Profesor ACo llegará pronto...</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe     = msg.user_id === userId
              const isAgent  = msg.type === "agent"
              const isSystem = msg.type === "system"

              if (isSystem) return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-muted2 text-xs bg-card-theme border border-soft px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              )

              if (isAgent) return (
                <div key={msg.id} className="flex justify-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm flex-shrink-0 mt-1">
                    🎓
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-400 text-xs font-semibold">Profesor ACo</span>
                      <span className="text-muted2 text-[10px]">{formatTime(msg.created_at)}</span>
                    </div>
                    <MathRenderer content={msg.content} />
                  </div>
                </div>
              )

              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                  {!isMe && <Avatar name={msg.user_name} />}
                  <div className={`rounded-2xl px-4 py-3 max-w-sm ${isMe ? "bg-blue-600/20 border border-blue-500/30 rounded-tr-sm" : "bg-card-theme border border-soft rounded-tl-sm"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${isMe ? "text-blue-700" : "text-amber-400"}`}>
                        {isMe ? "Tú" : msg.user_name}
                      </span>
                      <span className="text-muted2 text-[10px]">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-main text-sm leading-relaxed">{msg.content}</p>
                  </div>
                  {isMe && <Avatar name={userName} />}
                </div>
              )
            })}

            {/* ACo thinking */}
            {acoThinking && (
              <div className="flex justify-start gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm flex-shrink-0">
                  🎓
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-purple-400 text-xs font-semibold">Profesor ACo está escribiendo...</span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Typing indicators de otros usuarios */}
            {typingNames.length > 0 && (
              <div className="flex justify-start gap-2 items-center">
                <div className="flex -space-x-1">
                  {typingUsers.map(u => <Avatar key={u.userId} name={u.userName} />)}
                </div>
                <div className="bg-card-soft-theme border border-soft rounded-2xl px-3 py-2 flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  <span className="text-muted2 text-xs">
                    {typingNames.length === 1
                      ? `${typingNames[0]} está escribiendo`
                      : `${typingNames.join(", ")} están escribiendo`}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Barra inferior — acciones */}
          <div className="max-w-2xl mx-auto w-full px-4 pb-2 flex items-center gap-4">
            <button
              onClick={() => triggerACo(false)}
              disabled={acoThinking}
              className="text-xs text-purple-500 hover:text-purple-700 disabled:opacity-40 transition-colors"
            >
              🎓 Pedir explicación
            </button>

            {/* Panel de presencia expandido */}
            {otherUsers.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[10px] text-muted2">
                  {otherUsers.map(u => u.userName).join(", ")} en línea
                </span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-soft bg-card-theme backdrop-blur px-4 py-3">
            <div className="max-w-2xl mx-auto flex gap-3">
              <input
                type="text"
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !sending && sendMessage()}
                placeholder="Escribe tu respuesta o pregunta..."
                className="flex-1 bg-card-soft-theme focus:border-blue-500/40 rounded-2xl px-4 py-2.5 text-main placeholder-gray-400 focus:outline-none text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-card-soft-theme disabled:text-muted2 text-main px-5 py-2.5 rounded-2xl text-sm font-medium transition-colors"
              >
                {sending ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
