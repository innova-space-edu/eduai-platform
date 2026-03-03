"use client"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Profile {
  id: string; name: string; user_code: string; avatar_url?: string; is_online: boolean; last_seen: string
}
interface Friendship { id: string; status: string; requester: Profile; addressee: Profile }
interface Conversation { id: string; user1_id: string; user2_id: string; last_message: string; last_message_at: string; user1: Profile; user2: Profile }
interface ChatMessage { id: string; conversation_id: string; sender_id: string; content: string; file_url?: string; file_name?: string; file_type?: string; reactions: Record<string, string[]>; read_at?: string; created_at: string }

const REACTIONS = ["❤️","👍","😂","😮","😢","🔥"]

function Avatar({ profile, size="md" }: { profile: Profile, size?: "sm"|"md"|"lg" }) {
  const sizes = { sm:"w-8 h-8 text-xs", md:"w-10 h-10 text-sm", lg:"w-14 h-14 text-lg" }
  const initials = profile?.name?.slice(0,2).toUpperCase() || "??"
  return (
    <div className="relative flex-shrink-0">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} className={`${sizes[size]} rounded-full object-cover`} alt="" />
        : <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white`}>{initials}</div>
      }
      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${profile?.is_online ? "bg-green-400" : "bg-gray-600"}`} />
    </div>
  )
}

function formatLastSeen(d: string) {
  if (!d) return ""
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (diff < 1) return "ahora"
  if (diff < 60) return `hace ${diff}m`
  if (diff < 1440) return `hace ${Math.floor(diff/60)}h`
  return new Date(d).toLocaleDateString("es-CL", { day:"numeric", month:"short" })
}
function formatTime(d: string) { return new Date(d).toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" }) }

export default function ChatPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState("")
  const [userProfile, setUserProfile] = useState<Profile|null>(null)
  const [friends, setFriends] = useState<Profile[]>([])
  const [requests, setRequests] = useState<Friendship[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation|null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [searchCode, setSearchCode] = useState("")
  const [searchResult, setSearchResult] = useState<Profile|null|undefined>(undefined)
  const [searching, setSearching] = useState(false)
  const [tab, setTab] = useState<"chats"|"friends"|"add">("chats")
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    init()
    return () => { ping(false) }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }) }, [messages])

  useEffect(() => {
    if (!activeConv) return
    loadMessages(activeConv.id)
    const ch = supabase.channel(`chat-${activeConv.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages", filter:`conversation_id=eq.${activeConv.id}` },
        (p) => setMessages(prev => prev.some(m => m.id === p.new.id) ? prev : [...prev, p.new as ChatMessage]))
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"chat_messages", filter:`conversation_id=eq.${activeConv.id}` },
        (p) => setMessages(prev => prev.map(m => m.id === p.new.id ? {...m, reactions: p.new.reactions} : m)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeConv?.id])

  async function ping(online: boolean) {
    try { await fetch("/api/chat/presence", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ online }) }) } catch {}
  }

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    setUserId(user.id)
    ping(true)
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    setUserProfile(p)
    loadFriends(user.id)
    loadRequests()
    loadConversations()
    const iv = setInterval(() => ping(true), 30000)
    return () => clearInterval(iv)
  }

  async function loadFriends(uid?: string) {
    const res = await fetch("/api/chat/friends?action=list")
    if (!res.ok) return
    const data = await res.json()
    const id = uid || userId
    setFriends(data.map((f: any) => f.requester?.id === id ? f.addressee : f.requester).filter(Boolean))
  }

  async function loadRequests() {
    const res = await fetch("/api/chat/friends?action=requests")
    if (res.ok) setRequests(await res.json())
  }

  async function loadConversations() {
    const res = await fetch("/api/chat/messages?action=conversations")
    if (res.ok) setConversations(await res.json())
  }

  async function loadMessages(id: string) {
    const res = await fetch(`/api/chat/messages?conversationId=${id}`)
    if (res.ok) setMessages(await res.json())
  }

  async function searchUser() {
    if (searchCode.length < 4) return
    setSearching(true); setSearchResult(undefined)
    try {
      const res = await fetch(`/api/chat/friends?code=${searchCode.trim()}`)
      setSearchResult(await res.json())
    } finally { setSearching(false) }
  }

  async function sendFriendRequest(id: string) {
    const res = await fetch("/api/chat/friends", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"send", addresseeId: id }) })
    const data = await res.json()
    console.log("Friend request result:", data)
    if (data.ok) {
      setSearchResult(undefined)
      setSearchCode("")
      alert("✅ Solicitud enviada correctamente")
    } else {
      alert("❌ Error: " + (data.error || "desconocido"))
    }
  }

  async function respondRequest(id: string, accept: boolean) {
    await fetch("/api/chat/friends", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action: accept ? "accept" : "reject", friendshipId: id }) })
    loadRequests(); loadFriends()
  }

  async function openChat(friend: Profile) {
    const res = await fetch("/api/chat/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"getOrCreateConversation", friendId: friend.id }) })
    const conv = await res.json()
    setActiveConv({ ...conv, user1: userProfile, user2: friend })
    loadConversations(); setTab("chats")
  }

  async function sendMessage(fileUrl?: string, fileName?: string, fileType?: string) {
    if ((!input.trim() && !fileUrl) || sending || !activeConv) return
    const content = input.trim(); setInput(""); setSending(true)
    try {
      await fetch("/api/chat/messages", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"send", conversationId: activeConv.id, content, fileUrl, fileName, fileType }) })
      loadConversations()
    } finally { setSending(false) }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append("file", file)
    try {
      const res = await fetch("/api/chat/upload", { method:"POST", body: fd })
      const { url, name, type } = await res.json()
      await sendMessage(url, name, type)
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = "" }
  }

  async function react(messageId: string, emoji: string) {
    await fetch("/api/chat/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"react", messageId, emoji }) })
  }

  function getOther(conv: Conversation): Profile | null {
    return conv.user1_id === userId ? conv.user2 : conv.user1
  }

  function renderFile(msg: ChatMessage) {
    if (!msg.file_url) return null
    if (msg.file_type?.startsWith("image/"))
      return <img src={msg.file_url} className="max-w-[200px] rounded-xl mt-2 cursor-pointer" onClick={() => window.open(msg.file_url)} alt="" />
    return (
      <a href={msg.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 mt-2 bg-white/10 rounded-xl px-3 py-2 hover:bg-white/20">
        <span>{msg.file_type === "application/pdf" ? "📄" : "📎"}</span>
        <span className="text-xs text-blue-300 truncate max-w-[150px]">{msg.file_name}</span>
      </a>
    )
  }

  const other = activeConv ? getOther(activeConv) : null

  return (
    <div className="h-screen bg-gray-950 text-white flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/5 bg-gray-900/60 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-gray-500 hover:text-white text-sm">←</button>
          {userProfile && <Avatar profile={userProfile} size="sm" />}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{userProfile?.name}</p>
            <p className="text-gray-500 text-[10px] font-mono">#{userProfile?.user_code}</p>
          </div>
          {requests.length > 0 && <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold">{requests.length}</div>}
        </div>

        <div className="flex border-b border-white/5 flex-shrink-0">
          {([ ["chats","💬","Chats"],["friends","👥","Amigos"],["add","➕","Agregar"] ] as const).map(([t,icon,label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors flex flex-col items-center gap-0.5 ${tab===t?"text-blue-400 border-b-2 border-blue-400":"text-gray-500 hover:text-gray-300"}`}>
              <span>{icon}</span><span className="text-[9px]">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "chats" && (
            <div>
              {conversations.length === 0 && <p className="text-gray-600 text-xs text-center py-10">Sin conversaciones aún</p>}
              {conversations.map(conv => {
                const o = getOther(conv); if (!o) return null
                return (
                  <button key={conv.id} onClick={() => setActiveConv(conv)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition-colors ${activeConv?.id===conv.id?"bg-white/5 border-r-2 border-blue-500":""}`}>
                    <Avatar profile={o} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-white text-sm font-medium truncate">{o.name}</p>
                        <p className="text-gray-600 text-[10px] flex-shrink-0">{formatLastSeen(conv.last_message_at)}</p>
                      </div>
                      <p className="text-gray-500 text-xs truncate">{conv.last_message || "Iniciar conversación"}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {tab === "friends" && (
            <div>
              {requests.length > 0 && (
                <div className="p-3 border-b border-white/5">
                  <p className="text-[10px] text-gray-500 mb-2 font-medium uppercase tracking-wider">Solicitudes</p>
                  {requests.map(r => (
                    <div key={r.id} className="flex items-center gap-2 mb-2 bg-white/5 rounded-xl p-2">
                      <Avatar profile={r.requester} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{r.requester?.name}</p>
                        <p className="text-gray-600 text-[10px] font-mono">#{r.requester?.user_code}</p>
                      </div>
                      <button onClick={() => respondRequest(r.id, true)} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-2 py-1 rounded-lg">✓</button>
                      <button onClick={() => respondRequest(r.id, false)} className="bg-gray-800 text-gray-400 text-[10px] px-2 py-1 rounded-lg">✗</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3">
                <p className="text-[10px] text-gray-500 mb-2 font-medium uppercase tracking-wider">Amigos ({friends.length})</p>
                {friends.length === 0 && <p className="text-gray-600 text-xs py-4 text-center">Busca amigos por código</p>}
                {friends.map(f => (
                  <button key={f.id} onClick={() => openChat(f)}
                    className="w-full flex items-center gap-3 py-2.5 px-2 hover:bg-white/5 rounded-xl transition-colors">
                    <Avatar profile={f} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white text-sm truncate">{f.name}</p>
                      <p className={`text-[10px] ${f.is_online?"text-green-400":"text-gray-600"}`}>
                        {f.is_online ? "🟢 En línea" : `Visto ${formatLastSeen(f.last_seen)}`}
                      </p>
                    </div>
                    <span className="text-gray-600 text-xs">💬</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "add" && (
            <div className="p-4 space-y-4">
              <p className="text-gray-400 text-xs">Busca por código de 8 caracteres</p>
              <div className="flex gap-2">
                <input value={searchCode}
                  onChange={e => setSearchCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))}
                  onKeyDown={e => e.key==="Enter" && searchUser()}
                  placeholder="A1B2C3D4" maxLength={8}
                  className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/40 font-mono tracking-widest" />
                <button onClick={searchUser} disabled={searching || searchCode.length < 4}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-sm">
                  {searching ? "⏳" : "🔍"}
                </button>
              </div>

              {searchResult && (
                <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar profile={searchResult} size="md" />
                    <div>
                      <p className="text-white font-semibold">{searchResult.name}</p>
                      <p className="text-gray-500 text-xs font-mono">#{searchResult.user_code}</p>
                      <p className={`text-xs mt-0.5 ${searchResult.is_online?"text-green-400":"text-gray-500"}`}>
                        {searchResult.is_online ? "🟢 En línea" : `⚫ Visto ${formatLastSeen(searchResult.last_seen)}`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => sendFriendRequest(searchResult!.id)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 rounded-xl font-medium">
                    Enviar solicitud de amistad
                  </button>
                </div>
              )}
              {searchResult === null && <p className="text-gray-600 text-xs text-center">No se encontró usuario</p>}

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
                <p className="text-gray-500 text-xs mb-2">Tu código</p>
                <p className="text-blue-400 font-bold text-3xl tracking-widest font-mono">{userProfile?.user_code || "——"}</p>
                <p className="text-gray-600 text-xs mt-1">Compártelo para que te agreguen</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConv || !other ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-6xl">💬</p>
            <p className="text-gray-400 font-medium">Selecciona una conversación</p>
            <p className="text-gray-600 text-sm">o busca amigos por su código en ➕</p>
          </div>
        ) : (
          <>
            <div className="border-b border-white/5 bg-gray-900/60 px-6 py-3 flex items-center gap-3 flex-shrink-0">
              <Avatar profile={other} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{other.name}</p>
                <p className={`text-xs ${other.is_online?"text-green-400":"text-gray-500"}`}>
                  {other.is_online ? "🟢 En línea" : `⚫ Última vez ${formatLastSeen(other.last_seen)}`}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
              {messages.length === 0 && <p className="text-gray-600 text-sm text-center py-12">Sé el primero en escribir 👋</p>}
              {messages.map(msg => {
                const isMe = msg.sender_id === userId
                const rxns = Object.entries(msg.reactions || {}).filter(([,u]) => u.length > 0)
                return (
                  <div key={msg.id} className={`flex ${isMe?"justify-end":"justify-start"} group mb-1`}>
                    <div className="relative max-w-sm">
                      <div className={`rounded-2xl px-4 py-2.5 ${isMe?"bg-blue-600 rounded-tr-sm":"bg-gray-800 rounded-tl-sm"}`}>
                        {msg.content && <p className="text-white text-sm leading-relaxed break-words">{msg.content}</p>}
                        {renderFile(msg)}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <p className="text-white/40 text-[10px]">{formatTime(msg.created_at)}</p>
                          {isMe && <span className="text-white/40 text-[10px]">{msg.read_at ? "✓✓" : "✓"}</span>}
                        </div>
                      </div>
                      {rxns.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe?"justify-end":"justify-start"}`}>
                          {rxns.map(([e,u]) => (
                            <button key={e} onClick={() => react(msg.id, e)}
                              className="bg-gray-800 border border-white/5 rounded-full px-1.5 py-0.5 text-xs hover:bg-gray-700">
                              {e} {u.length}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className={`absolute ${isMe?"right-full mr-2":"left-full ml-2"} top-1 hidden group-hover:flex gap-1 bg-gray-800 border border-white/10 rounded-full px-2 py-1.5 shadow-xl z-10`}>
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

            <div className="border-t border-white/5 bg-gray-900/40 px-4 py-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-40 flex-shrink-0">
                  {uploading ? "⏳" : "📎"}
                </button>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 bg-white/5 border border-white/8 rounded-2xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/30 text-sm" />
                <button onClick={() => sendMessage()} disabled={!input.trim() || sending}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors flex-shrink-0">
                  {sending ? "⏳" : "➤"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
