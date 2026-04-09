// app/ai-social/page.tsx
"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────
type SocialRoomSlug = "ideas" | "research" | "teaching-lab" | "creative-studio" | "user-support" | "anticipation"
type SocialParticipantRole = "supervisor" | "researcher" | "educator" | "mathematician" | "creative" | "assistant"

type SocialParticipant = {
  id: string; name: string; role: SocialParticipantRole; specialty: string; tone: string
}

type SocialMessage = {
  id: string; authorId: string; authorName: string
  role: SocialParticipantRole; content: string; createdAt: string
}

type SocialSession = {
  sessionId: string; userId?: string; status: "active" | "paused" | "closed"
  room: { id: string; slug: SocialRoomSlug; title: string; topic: string; createdAt: string }
  participants: SocialParticipant[]; messages: SocialMessage[]
  summary: string; createdAt: string; updatedAt: string
  lastUserActivityAt: string; lastAgentActivityAt: string; inactivityTimeoutMs: number
}

type SocialActionTarget = "drafts" | "educador" | "examen" | "paper" | "matematico" | "imagenes" | "unknown"
type SocialActionIntent =
  | "create_lesson_plan" | "create_study_guide" | "create_exam"
  | "create_research_outline" | "create_math_support" | "create_visual_material" | "unknown"

type SocialActionSuggestion = {
  detected: boolean; intent: SocialActionIntent; target: SocialActionTarget
  label: string; reason: string; suggestedGoal: string
}

type SocialSessionResponse = {
  ok: boolean; name?: string; alias?: string; action?: string
  session?: SocialSession; sessions?: SocialSession[]; pausedCount?: number
  actionSuggestion?: SocialActionSuggestion; error?: string
}

type DraftType = "study_guide" | "lesson_plan" | "exam" | "research_outline" | "prompt_pack" | "generic"

type DraftFile = {
  id: string; title: string; filename: string; draftType: DraftType
  content: string; summary: string; createdAt: string; metadata?: Record<string, unknown>
}

type DraftApiResponse = {
  ok: boolean; name?: string; alias?: string; message?: string; target?: "drafts"
  draft?: DraftFile; logs?: Record<string, unknown>[]; error?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROOM_PRESETS: Array<{
  slug: SocialRoomSlug; emoji: string; title: string; suggestedGoal: string
}> = [
  { slug: "ideas",          emoji: "💡", title: "Ideas",        suggestedGoal: "Quiero que los agentes conversen libremente sobre nuevas ideas para mejorar EduAI" },
  { slug: "research",       emoji: "🔬", title: "Research",     suggestedGoal: "Quiero que los agentes conversen sobre una idea de investigación en plasma para CubeSats" },
  { slug: "teaching-lab",   emoji: "🏫", title: "Teaching Lab", suggestedGoal: "Necesito que los agentes conversen sobre una planificación con OA e indicadores" },
  { slug: "creative-studio",emoji: "🎨", title: "Creative",     suggestedGoal: "Quiero que los agentes conversen sobre una infografía educativa y un afiche visual" },
  { slug: "user-support",   emoji: "🤝", title: "Soporte",      suggestedGoal: "Necesito que los agentes conversen sobre cómo ayudar mejor al usuario en el chat" },
  { slug: "anticipation",   emoji: "⚡", title: "Anticipar",    suggestedGoal: "Conversemos sobre cómo anticipar un borrador de guía de estudio" },
]

const ROLE_COLORS: Record<string, { dot: string; name: string }> = {
  supervisor:   { dot: "bg-cyan-400",    name: "text-cyan-300" },
  researcher:   { dot: "bg-violet-400",  name: "text-violet-300" },
  educator:     { dot: "bg-emerald-400", name: "text-emerald-300" },
  mathematician:{ dot: "bg-amber-400",   name: "text-amber-300" },
  creative:     { dot: "bg-fuchsia-400", name: "text-fuchsia-300" },
  assistant:    { dot: "bg-slate-400",   name: "text-slate-300" },
}

const DEFAULT_GOAL = "Quiero que los agentes conversen sobre una idea de investigación en plasma para CubeSats"

// ─── Small helpers ────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)  return "ahora"
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

// ─── Message bubble (Twitter-style) ──────────────────────────────────────────
function MessageBubble({ msg, isUser }: { msg: SocialMessage; isUser: boolean }) {
  const colors = ROLE_COLORS[msg.role] || ROLE_COLORS.assistant
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
        ${isUser ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "bg-slate-800 border border-white/10 text-white"}`}>
        {isUser ? "Tú" : msg.authorName.slice(0, 2)}
      </div>

      {/* Bubble */}
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isUser && (
          <span className={`text-[11px] font-semibold ${colors.name}`}>
            {msg.authorName}
            <span className="text-slate-600 font-normal ml-1.5 uppercase tracking-wide text-[10px]">
              {msg.role}
            </span>
          </span>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${isUser
            ? "bg-cyan-500/15 border border-cyan-500/20 text-white rounded-tr-sm"
            : "bg-slate-800/80 border border-white/[0.07] text-slate-200 rounded-tl-sm"}`}>
          {msg.content}
        </div>
        <span className="text-[10px] text-slate-600 px-1">
          {timeAgo(msg.createdAt)}
        </span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AISocialPage() {
  const [goal, setGoal]                   = useState(DEFAULT_GOAL)
  const [userMessage, setUserMessage]     = useState("")
  const [session, setSession]             = useState<SocialSession | null>(null)
  const [loading, setLoading]             = useState(false)
  const [sending, setSending]             = useState(false)
  const [draftLoading, setDraftLoading]   = useState(false)
  const [draftResponse, setDraftResponse] = useState<DraftApiResponse | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [countdown, setCountdown]         = useState(60)
  const [actionSuggestion, setActionSuggestion] = useState<SocialActionSuggestion | null>(null)
  const [showNewTopic, setShowNewTopic]   = useState(false)

  const bottomRef          = useRef<HTMLDivElement>(null)
  const countdownRef       = useRef<NodeJS.Timeout | null>(null)
  const cleanupRef         = useRef<NodeJS.Timeout | null>(null)
  const activeRoomSlug     = session?.room?.slug

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (session?.messages?.length) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [session?.messages?.length])

  const resetCountdown = useCallback(() => {
    setCountdown(Math.floor((session?.inactivityTimeoutMs ?? 60000) / 1000))
  }, [session?.inactivityTimeoutMs])

  // ── createSession ──────────────────────────────────────────────────────────
  const createSession = useCallback(async (customGoal?: string) => {
    const finalGoal = (customGoal ?? goal).trim()
    if (!finalGoal) { setError("Escribe primero el tema."); return }

    setLoading(true); setError(null); setDraftResponse(null); setActionSuggestion(null)
    try {
      const res  = await fetch("/api/superagent/social/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", currentPage: "/ai-social", activeAgent: "social",
          userGoal: finalGoal, tags: ["social", "agents"], inactivityTimeoutMs: 60000,
        }),
      })
      const json = (await res.json()) as SocialSessionResponse
      if (!res.ok || !json.ok || !json.session) {
        setError(json.error || "No se pudo crear la sesión."); return
      }
      setGoal(finalGoal); setSession(json.session); setUserMessage("")
      setCountdown(Math.floor(json.session.inactivityTimeoutMs / 1000))
      setShowNewTopic(false)
    } catch { setError("Error al crear la sesión.") }
    finally   { setLoading(false) }
  }, [goal])

  // ── touchSession ───────────────────────────────────────────────────────────
  const touchSession = useCallback(async (sessionId: string) => {
    try {
      const res  = await fetch("/api/superagent/social/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "touch", sessionId }),
      })
      const json = (await res.json()) as SocialSessionResponse
      if (res.ok && json.ok && json.session) {
        setSession(json.session)
        setCountdown(Math.floor(json.session.inactivityTimeoutMs / 1000))
      }
    } catch {}
  }, [])

  // ── pauseSession ───────────────────────────────────────────────────────────
  const pauseSession = useCallback(async (sessionId: string) => {
    try {
      const res  = await fetch("/api/superagent/social/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", sessionId }),
      })
      const json = (await res.json()) as SocialSessionResponse
      if (res.ok && json.ok && json.session) setSession(json.session)
    } catch {}
  }, [])

  // ── resumeSession ──────────────────────────────────────────────────────────
  const resumeSession = useCallback(async () => {
    if (!session?.sessionId) return
    setLoading(true)
    try {
      const res  = await fetch("/api/superagent/social/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", sessionId: session.sessionId }),
      })
      const json = (await res.json()) as SocialSessionResponse
      if (!res.ok || !json.ok || !json.session) { setError(json.error || "No se pudo reanudar."); return }
      setSession(json.session)
      setCountdown(Math.floor(json.session.inactivityTimeoutMs / 1000))
    } catch { setError("Error al reanudar.") }
    finally  { setLoading(false) }
  }, [session?.sessionId])

  // ── sendUserMessage ────────────────────────────────────────────────────────
  const sendUserMessage = useCallback(async () => {
    if (!session?.sessionId || !userMessage.trim()) return
    const messageToSend = userMessage.trim()
    try {
      setSending(true); setError(null)

      const appendRes  = await fetch("/api/superagent/social/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "append-message", sessionId: session.sessionId,
          authorId: "user", authorName: "Usuario", role: "assistant",
          content: messageToSend, fromUser: true,
        }),
      })
      const appendJson = (await appendRes.json()) as SocialSessionResponse
      if (!appendRes.ok || !appendJson.ok || !appendJson.session) {
        setError(appendJson.error || "No se pudo enviar."); return
      }
      setSession(appendJson.session); setUserMessage("")
      setCountdown(Math.floor(appendJson.session.inactivityTimeoutMs / 1000))

      const roundRes  = await fetch("/api/superagent/social/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "agent-round", sessionId: session.sessionId, userMessage: messageToSend }),
      })
      const roundJson = (await roundRes.json()) as SocialSessionResponse
      if (roundRes.ok && roundJson.ok && roundJson.session) {
        setSession(roundJson.session)
        setCountdown(Math.floor(roundJson.session.inactivityTimeoutMs / 1000))
        setActionSuggestion(roundJson.actionSuggestion || null)
      }
    } catch { setError("Error al enviar tu mensaje.") }
    finally  { setSending(false) }
  }, [session?.sessionId, userMessage])

  // ── createDraft ────────────────────────────────────────────────────────────
  const createDraft = useCallback(async () => {
    if (!session) return
    setDraftLoading(true); setError(null)
    try {
      const ctx = session.messages.map(m => `${m.authorName}: ${m.content}`).join("\n")
      const res = await fetch("/api/superagent/drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPage: "/ai-social", activeAgent: "drafts",
          userGoal: `${session.room.topic}\n\nResumen:\n${session.summary}\n\nConversación:\n${ctx}`,
          tags: ["social", "draft", session.room.slug, ...session.participants.map(p => p.role)],
          metadata: {
            source: "ai-social", sessionId: session.sessionId,
            roomTitle: session.room.title, roomTopic: session.room.topic,
            socialSummary: session.summary, messageCount: session.messages.length,
          },
        }),
      })
      const json = (await res.json()) as DraftApiResponse
      if (!res.ok || !json.ok) { setError(json.error || json.message || "No se pudo crear el borrador.") }
      setDraftResponse(json)
    } catch { setError("Error al crear el borrador.") }
    finally  { setDraftLoading(false) }
  }, [session])

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { createSession(DEFAULT_GOAL) }, [createSession])

  useEffect(() => {
    if (!session || session.status !== "active") {
      if (countdownRef.current) clearInterval(countdownRef.current); return
    }
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { if (session?.sessionId) pauseSession(session.sessionId); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [session, pauseSession])

  useEffect(() => {
    if (cleanupRef.current) clearInterval(cleanupRef.current)
    cleanupRef.current = setInterval(async () => {
      try { await fetch("/api/superagent/social/session?cleanup=true", { method: "GET", cache: "no-store" }) } catch {}
    }, 15000)
    return () => { if (cleanupRef.current) clearInterval(cleanupRef.current) }
  }, [])

  const handleInteraction = async () => {
    if (session?.sessionId && session.status === "active") {
      await touchSession(session.sessionId); resetCountdown()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendUserMessage() }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0d1117]/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white transition text-sm">←</Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-xs font-bold">C</div>
              <div>
                <p className="text-sm font-semibold leading-none">EduAI Social</p>
                <p className="text-[11px] text-slate-500 leading-none mt-0.5">
                  {session?.room?.title ?? "Cargando..."} ·{" "}
                  <span className={session?.status === "active" ? "text-emerald-400" : "text-amber-400"}>
                    {session?.status === "active" ? "activa" : session?.status === "paused" ? "pausada" : "—"}
                  </span>
                  {session?.status === "active" && <span className="text-slate-600"> · {countdown}s</span>}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Room pills */}
            <div className="hidden sm:flex items-center gap-1">
              {ROOM_PRESETS.map(r => (
                <button
                  key={r.slug}
                  onClick={() => createSession(r.suggestedGoal)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                    activeRoomSlug === r.slug
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20"
                  }`}
                >
                  {r.emoji} {r.title}
                </button>
              ))}
            </div>
            <Link href="/superagent" className="text-[11px] text-slate-500 hover:text-slate-300 transition px-2 py-1 rounded-lg border border-white/10 hover:border-white/20">
              Claw ↗
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main two-column layout ── */}
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col px-4 py-4 gap-3">

        {/* ── Topic bar ── */}
        {session?.room && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">Tema actual</p>
              <p className="text-sm text-slate-200 mt-0.5 line-clamp-1">{session.room.topic}</p>
            </div>
            <button
              onClick={() => setShowNewTopic(t => !t)}
              className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition"
            >
              Cambiar
            </button>
          </div>
        )}

        {/* ── New topic panel (collapsible) ── */}
        {showNewTopic && (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 space-y-3">
            <p className="text-xs text-slate-400">Escribe el nuevo tema o elige una sala:</p>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40 resize-none"
              placeholder="Nuevo tema de conversación..."
            />
            <div className="flex flex-wrap gap-2">
              {ROOM_PRESETS.map(r => (
                <button
                  key={r.slug}
                  onClick={() => createSession(r.suggestedGoal)}
                  disabled={loading}
                  className="text-[11px] px-3 py-1.5 rounded-xl border border-white/10 text-slate-300 hover:border-cyan-400/30 hover:text-cyan-300 transition disabled:opacity-40"
                >
                  {r.emoji} {r.title}
                </button>
              ))}
              <button
                onClick={() => createSession()}
                disabled={loading}
                className="text-[11px] px-3 py-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 transition disabled:opacity-40 ml-auto"
              >
                {loading ? "Abriendo..." : "Abrir →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Action suggestion banner ── */}
        {actionSuggestion?.detected && (
          <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-3">
            <p className="text-xs font-semibold text-violet-300">⚡ EduAI Claw sugiere</p>
            <p className="text-sm text-slate-200 mt-1">{actionSuggestion.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{actionSuggestion.reason}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-violet-400/20 bg-violet-400/10 text-violet-300">
                {actionSuggestion.intent}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                → {actionSuggestion.target}
              </span>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* ── Chat feed ── */}
        <div className="flex-1 space-y-4 py-2 min-h-[300px]">
          {!session ? (
            <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
              Iniciando sesión...
            </div>
          ) : session.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-600">
              <div className="text-3xl">💬</div>
              <p className="text-sm">La conversación aparecerá aquí</p>
            </div>
          ) : (
            session.messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} isUser={msg.authorId === "user"} />
            ))
          )}

          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex-shrink-0 flex items-center justify-center">
                <span className="flex gap-0.5">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-slate-800/80 border border-white/[0.07] text-slate-500 text-xs">
                Agentes respondiendo...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Participants strip ── */}
        {session?.participants?.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {session.participants.map(p => {
              const colors = ROLE_COLORS[p.role] || ROLE_COLORS.assistant
              return (
                <div key={p.id} className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                  <span className="text-[11px] text-slate-300">{p.name}</span>
                </div>
              )
            })}
          </div>
        ) : null}

        {/* ── Paused banner ── */}
        {session?.status === "paused" && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-300">Conversación pausada</p>
            <button
              onClick={resumeSession}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 transition disabled:opacity-40"
            >
              {loading ? "Reanudando..." : "Reanudar →"}
            </button>
          </div>
        )}

        {/* ── Input box ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-slate-900/80 p-3">
          <textarea
            value={userMessage}
            onChange={e => setUserMessage(e.target.value)}
            onFocus={handleInteraction}
            onKeyDown={handleKeyDown}
            disabled={!session || session.status !== "active" || sending}
            rows={2}
            className="w-full bg-transparent text-sm text-white outline-none resize-none placeholder-slate-600 disabled:opacity-40"
            placeholder={session?.status === "active" ? "Escribe un mensaje... (Enter para enviar)" : "Reanuda la conversación para escribir"}
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <button
                onClick={createDraft}
                disabled={draftLoading || !session || session.messages.length === 0 ||
                  !!(actionSuggestion && actionSuggestion.target !== "drafts" && actionSuggestion.target !== "unknown")}
                className="text-[11px] px-3 py-1.5 rounded-xl border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/10 transition disabled:opacity-30"
              >
                {draftLoading ? "Creando..." : "📄 Borrador"}
              </button>
              {session?.status === "active" && (
                <button
                  onClick={() => session?.sessionId && pauseSession(session.sessionId)}
                  className="text-[11px] px-3 py-1.5 rounded-xl border border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 transition"
                >
                  Pausar
                </button>
              )}
            </div>
            <button
              onClick={sendUserMessage}
              disabled={sending || !session || session.status !== "active" || !userMessage.trim()}
              className="px-4 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/30 transition disabled:opacity-30"
            >
              {sending ? "..." : "Enviar →"}
            </button>
          </div>
        </div>

        {/* ── Draft result ── */}
        {draftResponse?.draft && (
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-300">Borrador generado ✓</p>
                <p className="text-xs text-slate-400 mt-1">{draftResponse.draft.summary}</p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 flex-shrink-0">
                {draftResponse.draft.draftType}
              </span>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-slate-950/60 p-3 max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-xs leading-6 text-slate-300">
                {draftResponse.draft.content}
              </pre>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
