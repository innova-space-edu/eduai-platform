["use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import MathRenderer from "@/components/ui/MathRenderer"

interface Room {
  id: string
  code: string
  topic: string
  host_id: string
  guest_id: string | null
  status: string
}

interface Message {
  id: string
  user_id: string
  user_name: string
  content: string
  type: string
  created_at: string
}

interface Props {
  room: Room
  userId: string
  userName: string
}

export default function CollabClient({ room, userId, userName }: Props) {
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState("")
  const [roomStatus, setRoomStatus]     = useState(room.status)
  const [acoThinking, setAcoThinking]   = useState(false)
  const [sending, setSending]           = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const supabase    = createClient()
  const msgCountRef = useRef(0)
  const isHost      = room.host_id === userId

  useEffect(() => {
    joinRoom()
    loadMessages()
    subscribeToRoom()
    subscribeToMessages()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, acoThinking])

  async function joinRoom() {
    if (!isHost) {
      await supabase
        .from("study_rooms")
        .update({ guest_id: userId, status: "active" })
        .eq("id", room.id)
      setRoomStatus("active")
      await supabase.from("room_messages").insert({
        room_id: room.id,
        user_id: "system",
        user_name: "Sistema",
        content: `${userName} se unió a la sesión`,
        type: "system",
      })
    } else if (room.status === "active") {
      setRoomStatus("active")
    }
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("room_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
    setMessages(data || [])
    msgCountRef.current = data?.length || 0
  }

  function subscribeToRoom() {
    supabase
      .channel(`room-status-${room.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "study_rooms",
        filter: `id=eq.${room.id}`,
      }, (payload) => {
        setRoomStatus(payload.new.status)
        if (payload.new.status === "active") {
          setTimeout(() => triggerACo(true), 1200)
        }
      })
      .subscribe()
  }

  function subscribeToMessages() {
    supabase
      .channel(`messages-${room.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "room_messages",
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        if (newMsg.type === "chat") {
          msgCountRef.current += 1
          if (msgCountRef.current % 3 === 0) triggerACo(false)
        }
      })
      .subscribe()
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)
    try {
      const { error } = await supabase.from("room_messages").insert({
        room_id: room.id,
        user_id: userId,
        user_name: userName,
        content,
        type: "chat",
      })
      if (error) setInput(content)
    } finally {
      setSending(false)
    }
  }

  async function triggerACo(isWelcome = false) {
    if (acoThinking) return
    setAcoThinking(true)
    try {
      const { data: recentMsgs } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false })
        .limit(8)

      const res = await fetch("/api/agents/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: room.topic,
          messages: recentMsgs?.reverse() || [],
          isWelcome,
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      await supabase.from("room_messages").insert({
        room_id: room.id,
        user_id: "00000000-0000-0000-0000-000000000000",
        user_name: "ACo",
        content: data.message,
        type: "agent",
      })
    } catch (e) {
      console.error("ACo error:", e)
    } finally {
      setAcoThinking(false)
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-gray-900/80 backdrop-blur px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm transition-colors">
              ← Salir
            </Link>
            <span className="text-gray-700">|</span>
            <span className="text-white font-semibold text-sm">{room.topic}</span>
            <span className="text-gray-500 text-xs">#{room.code}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${roomStatus === "active" ? "bg-green-400" : "bg-amber-400 animate-pulse"}`} />
              <span className="text-xs text-gray-400">
                {roomStatus === "active" ? "2 conectados" : "Esperando compañero..."}
              </span>
            </div>
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-1">
              <span className="text-blue-300 text-xs font-medium">{isHost ? "👑 " : ""}{userName}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Sala en espera */}
      {roomStatus === "waiting" && isHost && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="text-5xl animate-bounce">⏳</div>
          <h2 className="text-xl font-bold">Sala creada</h2>
          <p className="text-gray-400 text-sm text-center">Comparte este código con tu compañero:</p>
          <div className="bg-gray-900 border border-blue-500/30 rounded-3xl px-10 py-6 text-center">
            <p className="text-5xl font-bold text-blue-400 tracking-widest">{room.code}</p>
            <p className="text-gray-500 text-xs mt-3">Tema: {room.topic}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <p className="text-gray-500 text-xs">Esperando que se una alguien...</p>
          </div>
        </div>
      )}

      {/* Chat activo */}
      {(roomStatus === "active" || !isHost) && (
        <>
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">🤝</p>
                <p className="text-gray-300 font-medium">¡Sesión colaborativa iniciada!</p>
                <p className="text-gray-600 text-sm mt-1">
                  Tema: <span className="text-blue-400">{room.topic}</span>
                </p>
                <p className="text-gray-700 text-xs mt-3">
                  ACo intervendrá automáticamente para ayudarlos
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe     = msg.user_id === userId
              const isAgent  = msg.type === "agent"
              const isSystem = msg.type === "system"

              if (isSystem) return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-gray-700 text-xs bg-gray-900 border border-gray-800 px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              )

              if (isAgent) return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-400 text-xs font-semibold">🤖 ACo</span>
                      <span className="text-gray-700 text-[10px]">{formatTime(msg.created_at)}</span>
                    </div>
                    <MathRenderer content={msg.content} />
                  </div>
                </div>
              )

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-2xl px-4 py-3 max-w-sm ${
                    isMe
                      ? "bg-blue-600/20 border border-blue-500/30 rounded-tr-sm"
                      : "bg-gray-900 border border-white/5 rounded-tl-sm"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${isMe ? "text-blue-300" : "text-amber-400"}`}>
                        {isMe ? "Tú" : msg.user_name}
                      </span>
                      <span className="text-gray-700 text-[10px]">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )
            })}

            {acoThinking && (
              <div className="flex justify-start">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-purple-400 text-xs font-semibold mb-2">🤖 ACo está pensando...</p>
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Botón ACo manual */}
          <div className="max-w-2xl mx-auto w-full px-4 pb-2">
            <button
              onClick={() => triggerACo(false)}
              disabled={acoThinking}
              className="text-xs text-purple-500 hover:text-purple-300 disabled:opacity-40 transition-colors"
            >
              🤖 Pedir ayuda a ACo
            </button>
          </div>

          {/* Input */}
          <div className="border-t border-white/5 bg-gray-900/60 backdrop-blur px-4 py-3">
            <div className="max-w-2xl mx-auto flex gap-3">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !sending && sendMessage()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-white/5 border border-white/8 focus:border-blue-500/40 rounded-2xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-2.5 rounded-2xl transition-colors text-sm font-medium"
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
"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import MathRenderer from "@/components/ui/MathRenderer"

interface Room {
  id: string
  code: string
  topic: string
  host_id: string
  guest_id: string | null
  status: string
}

interface Message {
  id: string
  user_id: string
  user_name: string
  content: string
  type: string
  created_at: string
}

interface Props {
  room: Room
  userId: string
  userName: string
}

export default function CollabClient({ room, userId, userName }: Props) {
"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import MathRenderer from "@/components/ui/MathRenderer"

interface Room {
  id: string
  code: string
  topic: string
  host_id: string
  guest_id: string | null
  status: string
}

interface Message {
  id: string
  user_id: string
  user_name: string
  content: string
  type: string
  created_at: string
}

interface Props {
  room: Room
  userId: string
  userName: string
}

export default function CollabClient({ room, userId, userName }: Props) {
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState("")
  const [roomStatus, setRoomStatus] = useState(room.status)
  const [acoThinking, setAcoThinking] = useState(false)
  const [sending, setSending]       = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const supabase    = createClient()
  const msgCountRef = useRef(0)
  const isHost      = room.host_id === userId

  useEffect(() => {
    joinRoom()
    loadMessages()
    subscribeToRoom()
    subscribeToMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, acoThinking])

  async function joinRoom() {
    if (!isHost) {
      await supabase
        .from("study_rooms")
        .update({ guest_id: userId, status: "active" })
        .eq("id", room.id)
      setRoomStatus("active")
      await supabase.from("room_messages").insert({
        room_id: room.id,
        user_id: "system",
        user_name: "Sistema",
        content: `${userName} se unió a la sesión`,
        type: "system",
      })
    } else if (room.status === "active") {
      setRoomStatus("active")
    }
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("room_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
    setMessages(data || [])
    msgCountRef.current = data?.length || 0
  }

  function subscribeToRoom() {
    supabase
      .channel(`room-status-${room.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "study_rooms",
        filter: `id=eq.${room.id}`,
      }, (payload) => {
        setRoomStatus(payload.new.status)
        if (payload.new.status === "active") {
          setTimeout(() => triggerACo(true), 1000)
        }
      })
      .subscribe()
  }

  function subscribeToMessages() {
    supabase
      .channel(`messages-${room.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "room_messages",
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        if (newMsg.type === "chat") {
          msgCountRef.current += 1
          if (msgCountRef.current % 3 === 0) {
            triggerACo(false)
          }
        }
      })
      .subscribe()
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)
    try {
      const { error } = await supabase.from("room_messages").insert({
        room_id: room.id,
        user_id: userId,
        user_name: userName,
        content,
        type: "chat",
      })
      if (error) {
        console.error("Send error:", error)
        setInput(content)
      }
    } finally {
      setSending(false)
    }
  }

  async function triggerACo(isWelcome = false) {
    if (acoThinking) return
    setAcoThinking(true)
    try {
      const { data: recentMsgs } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false })
        .limit(8)

      const res = await fetch("/api/agents/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: room.topic,
          messages: recentMsgs?.reverse() || [],
          isWelcome,
        }),
      })

      if (!res.ok) return
      const data = await res.json()

      await supabase.from("room_messages").insert({
        room_id: room.id,
        user_id: "00000000-0000-0000-0000-000000000000",
        user_name: "ACo",
        content: data.message,
        type: "agent",
      })
    } catch (e) {
      console.error("ACo error:", e)
    } finally {
      setAcoThinking(false)
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-gray-900/80 backdrop-blur px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm transition-colors">← Salir</Link>
            <span className="text-gray-700">|</span>
            <div>
              <span className="text-white font-semibold text-sm">{room.topic}</span>
              <span className="text-gray-500 text-xs ml-2">#{room.code}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${roomStatus === "active" ? "bg-green-400" : "bg-amber-400 animate-pulse"}`} />
              <span className="text-xs text-gray-400">
                {roomStatus === "active" ? "2 conectados" : "Esperando compañero..."}
              </span>
            </div>
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-1">
              <span className="text-blue-300 text-xs font-medium">{isHost ? "👑 " : ""}{userName}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Sala en espera */}
      {roomStatus === "waiting" && isHost && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="text-5xl animate-bounce">⏳</div>
          <h2 className="text-xl font-bold text-white">Sala creada</h2>
          <p className="text-gray-400 text-sm text-center">Comparte este código con tu compañero:</p>
          <div className="bg-gray-900 border border-blue-500/30 rounded-3xl px-10 py-6 text-center">
            <p className="text-5xl font-bold text-blue-400 tracking-widest">{room.code}</p>
            <p className="text-gray-500 text-xs mt-3">Tema: {room.topic}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <p className="text-gray-500 text-xs">Esperando que se una alguien...</p>
          </div>
        </div>
      )}

      {/* Chat activo */}
      {(roomStatus === "active" || !isHost) && (
        <>
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-5xl mb-3">🤝</p>
                <p className="text-gray-300 font-medium">¡Sesión colaborativa iniciada!</p>
                <p className="text-gray-600 text-sm mt-1">Tema: <span className="text-blue-400">{room.topic}</span></p>
                <p className="text-gray-700 text-xs mt-3">ACo (IA) intervendrá automáticamente cada pocos mensajes</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe     = msg.user_id === userId
              const isAgent  = msg.type === "agent"
              const isSystem = msg.type === "system"

              if (isSystem) return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-gray-700 text-xs bg-gray-900 border border-gray-800 px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              )

              if (isAgent) return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-400 text-xs font-semibold">🤖 ACo — Asistente colaborativo</span>
                      <span className="text-gray-700 text-[10px]">{formatTime(msg.created_at)}</span>
                    </div>
                    <MathRenderer content={msg.content} />
                  </div>
                </div>
              )

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-2xl px-4 py-3 max-w-sm ${
                    isMe
                      ? "bg-blue-600/20 border border-blue-500/30 rounded-tr-sm"
                      : "bg-gray-900 border border-white/5 rounded-tl-sm"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${isMe ? "text-blue-300" : "text-amber-400"}`}>
                        {isMe ? "Tú" : msg.user_name}
                      </span>
                      <span className="text-gray-700 text-[10px]">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )
            })}

            {acoThinking && (
              <div className="flex justify-start">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-purple-400 text-xs font-semibold mb-2">🤖 ACo está pensando...</p>
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Botón pedir ACo manualmente */}
          <div className="max-w-2xl mx-auto w-full px-4 pb-1">
            <button
              onClick={() => triggerACo(false)}
              disabled={acoThinking}
              className="text-xs text-purple-500 hover:text-purple-300 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              🤖 Pedir ayuda a ACo
            </button>
          </div>

          {/* Input */}
          <div className="border-t border-white/5 bg-gray-900/60 backdrop-blur px-4 py-3">
            <div className="max-w-2xl mx-auto flex gap-3">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !sending && sendMessage()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-white/5 border border-white/8 focus:border-blue-500/40 rounded-2xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-2.5 rounded-2xl transition-colors text-sm font-medium"
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
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-purple-400 text-xs font-semibold mb-2">🤖 ACo está pensando...</p>
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Botón pedir ACo manualmente */}
          <div className="max-w-2xl mx-auto w-full px-4 pb-1">
            <button
              onClick={() => triggerACo(false)}
              disabled={acoThinking}
              className="text-xs text-purple-500 hover:text-purple-300 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              🤖 Pedir ayuda a ACo
            </button>
          </div>

          {/* Input */}
          <div className="border-t border-white/5 bg-gray-900/60 backdrop-blur px-4 py-3">
            <div className="max-w-2xl mx-auto flex gap-3">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !sending && sendMessage()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-white/5 border border-white/8 focus:border-blue-500/40 rounded-2xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none transition-all text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-2.5 rounded-2xl transition-colors text-sm font-medium"
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
      .order("created_at", { ascending: true })
    setMessages(data || [])
    messageCountRef.current = data?.length || 0
  }

  function subscribeToRoom() {
    supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "study_rooms",
        filter: `id=eq.${room.id}`,
      }, (payload) => {
        setRoomStatus(payload.new.status)
      })
      .subscribe()
  }

  function subscribeToMessages() {
    supabase
      .channel(`messages-${room.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "room_messages",
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => [...prev, newMsg])
        messageCountRef.current += 1

        // ACo interviene cada 4 mensajes de usuarios
        if (messageCountRef.current % 4 === 0 && newMsg.type === "chat") {
          triggerACo()
        }
      })
      .subscribe()
  }

  async function checkRoomStatus() {
    const { data } = await supabase
      .from("study_rooms")
      .select("status, guest_id")
      .eq("id", room.id)
      .single()
    if (data?.status === "active") {
      setRoomStatus("active")
    }
  }

  async function sendMessage() {
    if (!input.trim()) return
    const content = input.trim()
    setInput("")

    await supabase.from("room_messages").insert({
      room_id: room.id,
      user_id: userId,
      user_name: userName,
      content,
      type: "chat",
    })
  }

  async function triggerACo() {
    setAcoThinking(true)
    try {
      const { data: recentMsgs } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false })
        .limit(6)

      const res = await fetch("/api/agents/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: room.topic,
          messages: recentMsgs?.reverse() || [],
        }),
      })

      if (!res.ok) return
      const data = await res.json()

      await supabase.from("room_messages").insert({
        room_id: room.id,
        user_id: "00000000-0000-0000-0000-000000000000",
        user_name: "ACo",
        content: data.message,
        type: "agent",
      })
    } catch (e) {
      console.error(e)
    } finally {
      setAcoThinking(false)
    }
  }

  const isHost = room.host_id === userId

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-500 hover:text-white text-sm transition-colors">
              ← Salir
            </Link>
            <span className="text-gray-700">|</span>
            <div>
              <span className="text-white font-semibold text-sm">{room.topic}</span>
              <span className="text-gray-500 text-xs ml-2">#{room.code}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${roomStatus === "active" ? "bg-green-400" : "bg-amber-400 animate-pulse"}`} />
            <span className="text-xs text-gray-500">
              {roomStatus === "active" ? "2 conectados" : "Esperando..."}
            </span>
          </div>
        </div>
      </nav>

      {/* Sala en espera */}
      {roomStatus === "waiting" && isHost && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="text-5xl animate-bounce">⏳</div>
          <h2 className="text-xl font-bold text-white">Sala creada</h2>
          <p className="text-gray-400 text-sm">Comparte este código con tu compañero:</p>
          <div className="bg-gray-900 border border-blue-500/30 rounded-2xl px-8 py-4 text-center">
            <p className="text-4xl font-bold text-blue-400 tracking-widest">{room.code}</p>
            <p className="text-gray-500 text-xs mt-2">Tema: {room.topic}</p>
          </div>
          <p className="text-gray-600 text-xs">Esperando que se una alguien...</p>
        </div>
      )}

      {/* Chat activo */}
      {(roomStatus === "active" || !isHost) && (
        <>
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">🤝</p>
                <p className="text-gray-400">¡Sesión colaborativa iniciada!</p>
                <p className="text-gray-600 text-sm">Tema: {room.topic}</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.user_id === userId
              const isAgent = msg.type === "agent"

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  {isAgent ? (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3 max-w-sm">
                      <p className="text-purple-400 text-xs font-medium mb-1">🤖 ACo</p>
                      <p className="text-gray-300 text-sm">{msg.content}</p>
                    </div>
                  ) : (
                    <div className={`rounded-2xl px-4 py-3 max-w-sm ${
                      isMe
                        ? "bg-blue-600/20 border border-blue-600/30 rounded-tr-sm"
                        : "bg-gray-900 border border-gray-700 rounded-tl-sm"
                    }`}>
                      {!isMe && (
                        <p className="text-amber-400 text-xs font-medium mb-1">{msg.user_name}</p>
                      )}
                      <p className="text-gray-200 text-sm">{msg.content}</p>
                    </div>
                  )}
                </div>
              )
            })}

            {acoThinking && (
              <div className="flex justify-start">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium mb-1">🤖 ACo</p>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-75" />
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-800 bg-gray-900/50 px-4 py-3">
            <div className="max-w-2xl mx-auto flex gap-3">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none transition-colors text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-medium"
              >
                Enviar
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
