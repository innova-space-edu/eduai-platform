"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Profile {
  id: string
  name: string
  user_code: string
  avatar_url?: string
  is_online: boolean
  last_seen: string
}

interface Friendship {
  id: string
  status: string
  requester: Profile
  addressee: Profile
}

interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  last_message: string
  last_message_at: string
  user1: Profile
  user2: Profile
}

interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  file_url?: string
  file_name?: string
  file_type?: string
  reactions: Record<string, string[]>
  read_at?: string
  created_at: string
}

const REACTIONS = ["❤️","👍","😂","😮","😢","🔥"]

function Avatar({ profile, size = "md" }: { profile: Profile, size?: "sm"|"md"|"lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" }
  const initials = profile.name?.slice(0,2).toUpperCase() || "??"
  return (
    <div className="relative flex-shrink-0">
      {profile.avatar_url ? (
        <img src={profile.avatar_url} className={`${sizes[size]} rounded-full object-cover`} />
      ) : (
        <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white`}>
          {initials}
        </div>
      )}
      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${profile.is_online ? "bg-green-400" : "bg-gray-600"}`} />
    </div>
  )
}

function formatLastSeen(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diff < 1) return "ahora"
  if (diff < 60) return `hace ${diff}m`
  if (diff < 1440) return `hace ${Math.floor(diff/60)}h`
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
}

export default function ChatPage() {
  // ...existing code...
}
