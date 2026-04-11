"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MessageSquare, Users, UserPlus, Search, Send, Paperclip } from "lucide-react"

// ── Tipos (idénticos al original) ────────────────────────────────────────────
interface Profile      { id: string; name: string; user_code: string; avatar_url?: string; is_online: boolean; last_seen: string }
interface Friendship   { id: string; status: string; requester: Profile; addressee: Profile }
interface Conversation { id: string; user1_id: string; user2_id: string; last_message: string; last_message_at: string; user1: Profile; user2: Profile }
interface ChatMessage  { id: string; conversation_id: string; sender_id: string; content: string; file_url?: string; file_name?: string; file_type?: string; reactions: Record<string, string[]>; read_at?: string; created_at: string }

const REACTIONS = ["❤️","👍","😂","😮","😢","🔥"]

// ── Avatar component ─────────────────────────────────────────────────────────
function Avatar({ profile, size = "md" }: { profile: Profile; size?: "sm"|"md"|"lg" }) {
  const sz = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" }[size]
  const initials = profile?.name?.slice(0, 2).toUpperCase() || "??"
  return (
    <div className="relative flex-shrink-0">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} className={`${sz} rounded-full object-cover`} alt="" />
        : <div className={`${sz} rounded-full flex items-center justify-center font-bold text-main`}
               style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>{initials}</div>
      }
      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card ${profile?.is_online ? "bg-emerald-400" : "bg-slate-300"}`} />
    </div>
  )
}

function formatLastSeen(d: string) {
  if (!d) return ""
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (diff < 1) return "ahora"
  if (diff < 60) return `hace ${diff}m`
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`
  return new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
}
function formatTime(d: string) { return new Date(d).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) }

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const supabase      = createClient()
  const router        = useRouter()
  const [userId,        setUserId]        = useState("")
  const [userProfile,   setUserProfile]   = useState<Profile | null>(null)
  const [friends,       setFriends]       = useState<Profile[]>([])
  const [requests,      setRequests]      = useState<Friendship[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv,    setActiveConv]    = useState<Conversation | null>(null)
  const [messages,      setMessages]      = useState<ChatMessage[]>([])
  const [input,         setInput]         = useState("")
  const [sending,       setSending]       = useState(false)
  const [searchCode,    setSearchCode]    = useState("")
  const [searchResult,  setSearchResult]  = useState<Profile | null | undefined>(undefined)
  const [searching,     setSearching]     = useState(false)
  const [tab,           setTab]           = useState<"chats"|"friends"|"add">("chats")
  const [uploading,     setUploading]     = useState(false)
  const [unreadCount,   setUnreadCount]   = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  // ── Toda la lógica idéntica al original ────────────────────────────────────
  useEffect(() => {
    init()
    loadUnreadCount()
    const notifCh = supabase.channel("rt-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => loadUnreadCount())
      .subscribe()
    const friendsCh = supabase.channel("rt-friendships")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => { loadFriends(); loadRequests() })
      .subscribe()
    const convCh = supabase.channel("rt-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadConversations())
      .subscribe()
    return () => {
      ping(false)
      supabase.removeChannel(notifCh)
      supabase.removeChannel(friendsCh)
      supabase.removeChannel(convCh)
    }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  useEffect(() => {
    if (!activeConv) return
    loadMessages(activeConv.id)
    const ch = supabase.channel(`chat-${activeConv.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${activeConv.id}` },
        p => setMessages(prev => prev.some(m => m.id === p.new.id) ? prev : [...prev, p.new as ChatMessage]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${activeConv.id}` },
        p => setMessages(prev => prev.map(m => m.id === p.new.id ? { ...m, reactions: p.new.reactions } : m)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeConv?.id])

  async function ping(online: boolean) {
    try { await fetch("/api/chat/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ online }) }) } catch {}
  }

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    setUserId(user.id); ping(true)
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    setUserProfile(p)
    loadFriends(user.id); loadRequests(); loadConversations()
    const iv = setInterval(() => ping(true), 30000)
    return () => clearInterval(iv)
  }

  async function loadFriends(uid?: string) {
    const res = await fetch("/api/chat/friends?action=list"); if (!res.ok) return
    const data = await res.json()
    const id = uid || userId
    setFriends(data.map((f: any) => f.requester?.id === id ? f.addressee : f.requester).filter(Boolean))
  }
  async function loadRequests() {
    const res = await fetch("/api/chat/friends?action=requests"); if (res.ok) setRequests(await res.json())
  }
  async function loadConversations() {
    const res = await fetch("/api/chat/messages?action=conversations"); if (res.ok) setConversations(await res.json())
  }
  async function loadUnreadCount() {
    try {
      const res = await fetch("/api/chat/notifications?action=unreadCount", { cache: "no-store" })
      const data = await res.json(); setUnreadCount(data?.count ?? 0)
    } catch {}
  }
  async function loadMessages(convId: string) {
    const res = await fetch(`/api/chat/messages?action=messages&conversationId=${convId}`)
    if (res.ok) setMessages(await res.json())
  }
  async function sendMessage(fileUrl?: string, fileName?: string, fileType?: string) {
    if ((!input.trim() && !fileUrl) || !activeConv) return
    setSending(true)
    const content = input.trim(); setInput("")
    try {
      await fetch("/api/chat/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", conversationId: activeConv.id, content, fileUrl, fileName, fileType }),
      })
    } finally { setSending(false) }
  }
  async function openChat(friend: Profile) {
    const res  = await fetch("/api/chat/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "createOrGet", otherUserId: friend.id }),
    })
    const conv = await res.json()
    setActiveConv(conv); setTab("chats")
  }
  async function searchUser() {
    if (searchCode.length < 4) return
    setSearching(true)
    try {
      const res = await fetch(`/api/chat/friends?action=search&code=${searchCode}`)
      setSearchResult(res.ok ? await res.json() : null)
    } catch { setSearchResult(null) }
    finally { setSearching(false) }
  }
  async function sendFriendRequest(targetId: string) {
    await fetch("/api/chat/friends", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", targetId }),
    })
    setSearchResult(undefined); setSearchCode("")
  }
  async function respondRequest(id: string, accept: boolean) {
    await fetch("/api/chat/friends", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: accept ? "accept" : "reject", friendshipId: id }),
    })
    loadRequests(); if (accept) loadFriends()
  }
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append("file", file)
    try {
      const res = await fetch("/api/chat/upload", { method: "POST", body: fd })
      const { url, name, type } = await res.json()
      await sendMessage(url, name, type)
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = "" }
  }
  async function react(messageId: string, emoji: string) {
    await fetch("/api/chat/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "react", messageId, emoji }),
    })
  }

  function getOther(conv: Conversation): Profile | null {
    return conv.user1_id === userId ? conv.user2 : conv.user1
  }

  function renderFile(msg: ChatMessage) {
    if (!msg.file_url) return null
    if (msg.file_type?.startsWith("image/"))
      return <img src={msg.file_url} className="max-w-[200px] rounded-xl mt-2 cursor-pointer" onClick={() => window.open(msg.file_url)} alt="" />
    return (
      <a href={msg.file_url} target="_blank" rel="noreferrer"
         className="flex items-center gap-2 mt-2 rounded-xl px-3 py-2 transition-all"
         style={{ background: "var(--border-soft)" }}>
        <span>{msg.file_type === "application/pdf" ? "📄" : "📎"}</span>
        <span className="text-xs text-blue-700 truncate max-w-[150px]">{msg.file_name}</span>
      </a>
    )
  }

  const other = activeConv ? getOther(activeConv) : null

  const TABS = [
    { id: "chats",   icon: MessageSquare, label: "Chats"   },
    { id: "friends", icon: Users,         label: "Amigos"  },
    { id: "add",     icon: UserPlus,      label: "Agregar" },
  ] as const

  return (
    <div className="h-screen bg-app text-main flex overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="w-72 border-r border-soft flex flex-col flex-shrink-0"
             style={{ background: "rgba(255,255,255,0.015)" }}>

        {/* Header del sidebar */}
        <div className="p-4 border-b border-soft flex items-center gap-3">
          <Link href="/dashboard"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-card-soft-theme text-sub hover:text-main transition-all flex-shrink-0">
            <ArrowLeft size={13} />
          </Link>
          {userProfile && <Avatar profile={userProfile} size="sm" />}
          <div className="flex-1 min-w-0">
            <p className="text-main text-sm font-semibold truncate">{userProfile?.name}</p>
            <p className="text-muted2 text-[10px] font-mono">#{userProfile?.user_code}</p>
          </div>
          {(requests.length > 0 || unreadCount > 0) && (
            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {requests.length + unreadCount}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-soft flex-shrink-0">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex-1 py-2.5 text-xs font-medium transition-all flex flex-col items-center gap-0.5"
              style={{ color: tab === id ? "#60a5fa" : "#6b7280", borderBottom: tab === id ? "2px solid #3b82f6" : "2px solid transparent" }}>
              <Icon size={14} />
              <span className="text-[9px]">{label}</span>
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto">

          {/* Chats tab */}
          {tab === "chats" && (
            <div>
              {conversations.length === 0 && (
                <p className="text-muted2 text-xs text-center py-10">Sin conversaciones aún</p>
              )}
              {conversations.map(conv => {
                const o = getOther(conv); if (!o) return null
                const isActive = activeConv?.id === conv.id
                return (
                  <button key={conv.id} onClick={() => setActiveConv(conv)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                    style={{
                      background:   isActive ? "rgba(59,130,246,0.08)" : "transparent",
                      borderRight:  isActive ? "2px solid #3b82f6" : "2px solid transparent",
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--bg-card)" }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent" }}>
                    <Avatar profile={o} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-main text-sm font-medium truncate">{o.name}</p>
                        <p className="text-muted2 text-[10px] flex-shrink-0">{formatLastSeen(conv.last_message_at)}</p>
                      </div>
                      <p className="text-muted2 text-xs truncate">{conv.last_message || "Iniciar conversación"}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Friends tab */}
          {tab === "friends" && (
            <div>
              {requests.length > 0 && (
                <div className="p-3 border-b border-soft">
                  <p className="text-[10px] text-muted2 mb-2 font-semibold uppercase tracking-widest">Solicitudes ({requests.length})</p>
                  {requests.map(r => (
                    <div key={r.id} className="flex items-center gap-2 mb-2 rounded-xl p-2"
                         style={{ background: "var(--bg-card)", border: "1px solid var(--border-soft)" }}>
                      <Avatar profile={r.requester} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-main text-xs font-medium truncate">{r.requester?.name}</p>
                        <p className="text-muted2 text-[10px] font-mono">#{r.requester?.user_code}</p>
                      </div>
                      <button onClick={() => respondRequest(r.id, true)}
                        className="text-main text-[10px] px-2 py-1 rounded-lg transition-all"
                        style={{ background: "#2563eb" }}>✓</button>
                      <button onClick={() => respondRequest(r.id, false)}
                        className="text-sub text-[10px] px-2 py-1 rounded-lg transition-all"
                        style={{ background: "var(--bg-card-soft)" }}>✗</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3">
                <p className="text-[10px] text-muted2 mb-2 font-semibold uppercase tracking-widest">Amigos ({friends.length})</p>
                {friends.length === 0 && <p className="text-muted2 text-xs py-4 text-center">Busca amigos por código</p>}
                {friends.map(f => (
                  <button key={f.id} onClick={() => openChat(f)}
                    className="w-full flex items-center gap-3 py-2.5 px-2 rounded-xl transition-all"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-input)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <Avatar profile={f} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-main text-sm truncate">{f.name}</p>
                      <p className={`text-[10px] ${f.is_online ? "text-green-400" : "text-muted2"}`}>
                        {f.is_online ? "🟢 En línea" : `Visto ${formatLastSeen(f.last_seen)}`}
                      </p>
                    </div>
                    <MessageSquare size={13} className="text-muted2 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add tab */}
          {tab === "add" && (
            <div className="p-4 space-y-4">
              <p className="text-sub text-xs">Busca por código de 8 caracteres</p>
              <div className="flex gap-2">
                <input value={searchCode}
                  onChange={e => setSearchCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  onKeyDown={e => e.key === "Enter" && searchUser()}
                  placeholder="A1B2C3D4" maxLength={8}
                  className="flex-1 bg-card-soft-theme border border-soft rounded-xl px-3 py-2 text-main text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500/40 font-mono tracking-widest transition-all" />
                <button onClick={searchUser} disabled={searching || searchCode.length < 4}
                  className="flex items-center justify-center w-10 h-10 rounded-xl text-main disabled:opacity-40 transition-all"
                  style={{ background: "#2563eb" }}>
                  {searching ? <span className="w-4 h-4 rounded-full border-2 border-soft border-t-white animate-spin" /> : <Search size={16} />}
                </button>
              </div>
              {searchResult === null && (
                <p className="text-red-400 text-xs">No se encontró ningún usuario con ese código.</p>
              )}
              {searchResult && (
                <div className="rounded-2xl p-4 border" style={{ background: "var(--bg-card-soft)", borderColor: "var(--bg-card-soft)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar profile={searchResult} size="md" />
                    <div>
                      <p className="text-main font-semibold">{searchResult.name}</p>
                      <p className="text-muted2 text-xs font-mono">#{searchResult.user_code}</p>
                      <p className={`text-xs mt-0.5 ${searchResult.is_online ? "text-green-400" : "text-muted2"}`}>
                        {searchResult.is_online ? "🟢 En línea" : `Visto ${formatLastSeen(searchResult.last_seen)}`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => sendFriendRequest(searchResult!.id)}
                    className="w-full py-2 rounded-xl text-sm font-semibold text-main transition-all"
                    style={{ background: "#2563eb" }}>
                    Enviar solicitud de amistad
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Panel de conversación ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConv || !other ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <MessageSquare size={48} className="text-muted2" />
            <p className="text-sub font-medium">Selecciona una conversación</p>
            <p className="text-muted2 text-sm">o busca amigos por su código en ➕</p>
          </div>
        ) : (
          <>
            {/* Conv header */}
            <div className="border-b border-soft px-6 py-3 flex items-center gap-3 flex-shrink-0"
                 style={{ background: "rgba(255,255,255,0.015)" }}>
              <Avatar profile={other} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-main font-semibold truncate">{other.name}</p>
                <p className={`text-xs ${other.is_online ? "text-green-400" : "text-muted2"}`}>
                  {other.is_online ? "🟢 En línea" : `⚫ Última vez ${formatLastSeen(other.last_seen)}`}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
              {messages.length === 0 && (
                <p className="text-muted2 text-sm text-center py-12">Sé el primero en escribir 👋</p>
              )}
              {messages.map(msg => {
                const isMe = msg.sender_id === userId
                const rxns = Object.entries(msg.reactions || {}).filter(([, u]) => u.length > 0)
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group mb-1`}>
                    <div className="relative max-w-sm">
                      <div className={`rounded-2xl px-4 py-2.5 ${isMe ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                           style={{ background: isMe ? "#2563eb" : "var(--bg-card-soft)", border: isMe ? "none" : "1px solid var(--border-soft)" }}>
                        {msg.content && <p className="text-main text-sm leading-relaxed break-words">{msg.content}</p>}
                        {renderFile(msg)}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <p className="text-muted2 text-[10px]">{formatTime(msg.created_at)}</p>
                          {isMe && <span className="text-muted2 text-[10px]">{msg.read_at ? "✓✓" : "✓"}</span>}
                        </div>
                      </div>
                      {rxns.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          {rxns.map(([e, u]) => (
                            <button key={e} onClick={() => react(msg.id, e)}
                              className="rounded-full px-1.5 py-0.5 text-xs transition-all"
                              style={{ background: "var(--border-soft)", border: "1px solid var(--border-medium)" }}>
                              {e} {u.length}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Reaction picker on hover */}
                      <div className={`absolute ${isMe ? "right-full mr-2" : "left-full ml-2"} top-1 hidden group-hover:flex gap-1 rounded-full px-2 py-1.5 shadow-xl z-10`}
                           style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-medium)" }}>
                        {REACTIONS.map(e => (
                          <button key={e} onClick={() => react(msg.id, e)} className="hover:scale-125 transition-transform text-sm">{e}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-soft px-4 py-3 flex-shrink-0"
                 style={{ background: "rgba(255,255,255,0.01)" }}>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)" }}>
                  {uploading ? <span className="w-4 h-4 rounded-full border-2 border-soft border-t-white animate-spin" /> : <Paperclip size={15} className="text-sub" />}
                </button>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 rounded-2xl px-4 py-2.5 text-main placeholder-gray-400 text-sm focus:outline-none transition-all"
                  style={{ background: "var(--border-soft)", border: "1px solid var(--border-soft)" }} />
                <button onClick={() => sendMessage()} disabled={!input.trim() || sending}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-main disabled:opacity-40 transition-all flex-shrink-0"
                  style={{ background: "#2563eb" }}>
                  {sending ? <span className="w-4 h-4 rounded-full border-2 border-soft border-t-white animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
