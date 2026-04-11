// app/ai-social/page.tsx
"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

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
type ExecutedActionResult = {
  ok: boolean; executed: boolean
  target: SocialActionTarget; intent: SocialActionIntent
  label: string; message: string
  mode: "draft_created" | "prepared_action"
  draft?: DraftFile; payload?: Record<string, unknown>
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
const ROOM_PRESETS: Array<{ slug: SocialRoomSlug; emoji: string; title: string; suggestedGoal: string }> = [
  { slug: "ideas",           emoji: "💡", title: "Ideas",        suggestedGoal: "Conversemos sobre nuevas ideas para mejorar EduAI" },
  { slug: "research",        emoji: "🔬", title: "Research",     suggestedGoal: "Quiero debatir una idea de investigación sobre plasma y CubeSats" },
  { slug: "teaching-lab",    emoji: "🏫", title: "Docencia",     suggestedGoal: "Necesito apoyo para una planificación con OA e indicadores MINEDUC" },
  { slug: "creative-studio", emoji: "🎨", title: "Creativo",     suggestedGoal: "Quiero crear una infografía educativa y materiales visuales" },
  { slug: "user-support",    emoji: "🤝", title: "Soporte",      suggestedGoal: "¿Cómo podemos mejorar la experiencia del usuario en EduAI?" },
  { slug: "anticipation",    emoji: "⚡", title: "Anticipar",    suggestedGoal: "Anticipemos un borrador de guía de estudio para mañana" },
]

const ROLE_COLORS: Record<string, { dot: string; name: string }> = {
  supervisor:    { dot: "bg-cyan-400",    name: "text-cyan-700" },
  researcher:    { dot: "bg-violet-400",  name: "text-violet-700" },
  educator:      { dot: "bg-emerald-400", name: "text-emerald-700" },
  mathematician: { dot: "bg-amber-400",   name: "text-amber-700" },
  creative:      { dot: "bg-fuchsia-400", name: "text-fuchsia-700" },
  assistant:     { dot: "bg-slate-300",   name: "text-sub" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return "ahora"
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isUser }: { msg: SocialMessage; isUser: boolean }) {
  const colors = ROLE_COLORS[msg.role] || ROLE_COLORS.assistant
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold
        ${isUser
          ? "bg-cyan-500/20 text-cyan-700 border border-cyan-500/30"
          : "bg-card-soft-theme text-main"}`}>
        {isUser ? "Tú" : msg.authorName.slice(0, 2)}
      </div>
      <div className={`max-w-[78%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && (
          <span className={`text-[11px] font-semibold ${colors.name}`}>
            {msg.authorName}
            <span className="text-muted2 font-normal ml-1.5 uppercase tracking-wide text-[10px]">{msg.role}</span>
          </span>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${isUser
            ? "bg-cyan-500/15 border border-cyan-500/20 text-main rounded-tr-sm"
            : "bg-card-soft-theme text-main rounded-tl-sm"}`}>
          {msg.content}
        </div>
        <span className="text-[10px] text-muted2 px-1">{timeAgo(msg.createdAt)}</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AISocialPage() {
  // Session state
  const [session, setSession]           = useState<SocialSession | null>(null)
  const [loading, setLoading]           = useState(false)
  const [sending, setSending]           = useState(false)
  const [countdown, setCountdown]       = useState(60)
  const [error, setError]               = useState<string | null>(null)

  // UI state
  const [userMessage, setUserMessage]   = useState("")
  const [goal, setGoal]                 = useState("")
  const [topicInput, setTopicInput]     = useState("") // entrada libre del usuario
  const [phase, setPhase]               = useState<"start" | "chat">("start") // pantalla inicial vs chat

  // Action / draft state
  const [actionSuggestion, setActionSuggestion]   = useState<SocialActionSuggestion | null>(null)
  const [executedAction, setExecutedAction]         = useState<ExecutedActionResult | null>(null)
  const [draftLoading, setDraftLoading]             = useState(false)
  const [draftResponse, setDraftResponse]           = useState<DraftApiResponse | null>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const cleanupRef   = useRef<NodeJS.Timeout | null>(null)

  const activeRoomSlug = session?.room?.slug

  // Auto-scroll
  useEffect(() => {
    if (session?.messages?.length) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [session?.messages?.length])

  const resetCountdown = useCallback(() => {
    setCountdown(Math.floor((session?.inactivityTimeoutMs ?? 60000) / 1000))
  }, [session?.inactivityTimeoutMs])

  // ── createSession ──────────────────────────────────────────────────────────
  const createSession = useCallback(async (customGoal: string) => {
    const finalGoal = customGoal.trim()
    if (!finalGoal) { setError("Escribe primero un tema."); return }

    setLoading(true); setError(null); setDraftResponse(null)
    setActionSuggestion(null); setExecutedAction(null)
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
      if (!res.ok || !json.ok || !json.session) { setError(json.error || "No se pudo crear la sesión."); return }
      setGoal(finalGoal)
      setSession(json.session)
      setUserMessage("")
      setCountdown(Math.floor(json.session.inactivityTimeoutMs / 1000))
      setPhase("chat")
    } catch { setError("Error al crear la sesión.") }
    finally   { setLoading(false) }
  }, [])

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

  // ── executeDetectedAction ──────────────────────────────────────────────────
  const executeDetectedAction = useCallback(async () => {
    if (!actionSuggestion) return
    setLoading(true); setError(null)
    try {
      const res  = await fetch("/api/superagent/social/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute-suggested-action",
          suggestion: actionSuggestion,
          userGoal: actionSuggestion.suggestedGoal || goal,
          tags: ["social", "executed-action"],
          metadata: {
            source: "ai-social",
            sessionId: session?.sessionId || null,
            roomTitle: session?.room?.title || null,
            roomTopic: session?.room?.topic || null,
          },
        }),
      })
      const json = (await res.json()) as { ok: boolean; result?: ExecutedActionResult; error?: string }
      if (!res.ok || !json.ok || !json.result) { setError(json.error || "No se pudo ejecutar la acción."); return }
      setExecutedAction(json.result)
      if (json.result.mode === "draft_created" && json.result.draft) {
        setDraftResponse({ ok: true, message: json.result.message, target: "drafts", draft: json.result.draft })
      }
    } catch { setError("Error al ejecutar la acción.") }
    finally  { setLoading(false) }
  }, [actionSuggestion, goal, session?.room?.title, session?.room?.topic, session?.sessionId])

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
      if (!res.ok || !json.ok) setError(json.error || json.message || "No se pudo crear el borrador.")
      setDraftResponse(json)
    } catch { setError("Error al crear el borrador.") }
    finally  { setDraftLoading(false) }
  }, [session])

  // ── Effects ────────────────────────────────────────────────────────────────
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
    if (session?.sessionId && session.status === "active") { await touchSession(session.sessionId); resetCountdown() }
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendUserMessage() }
  }
  const handleTopicKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); createSession(topicInput) }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PANTALLA INICIAL — el usuario elige el tema
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "start") {
    return (
      <div className="min-h-screen bg-[#0d1117] text-main flex flex-col">
        <header className="sticky top-0 z-20 border-b border-soft bg-[#0d1117]/90 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sub hover:text-main transition text-sm">←</Link>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-xs font-bold">C</div>
                <p className="text-sm font-semibold">EduAI Social</p>
              </div>
            </div>
            <Link href="/superagent" className="text-[11px] text-muted2 hover:text-sub transition px-2 py-1 rounded-lg border border-soft hover:border-medium">
              Claw ↗
            </Link>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg space-y-6">
            {/* Hero */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-600/20 border border-soft flex items-center justify-center text-2xl mx-auto">
                💬
              </div>
              <h1 className="text-2xl font-bold">Chat social de agentes</h1>
              <p className="text-sm text-sub">
                Elige un tema y los agentes de EduAI conversan entre sí y contigo.
              </p>
            </div>

            {/* Topic input */}
            <div className="rounded-2xl border border-medium bg-card-theme p-4 space-y-3">
              <label className="text-xs text-muted2 uppercase tracking-wide">¿Sobre qué quieres conversar?</label>
              <textarea
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                onKeyDown={handleTopicKeyDown}
                rows={3}
                autoFocus
                className="w-full bg-transparent text-sm text-main outline-none resize-none placeholder-gray-400"
                placeholder="Escribe tu tema, pregunta u opinión... (Enter para iniciar)"
              />
              <button
                onClick={() => createSession(topicInput)}
                disabled={loading || !topicInput.trim()}
                className="w-full py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-700 text-sm font-medium hover:bg-cyan-500/30 transition disabled:opacity-30"
              >
                {loading ? "Iniciando..." : "Iniciar conversación →"}
              </button>
            </div>

            {/* Room presets */}
            <div className="space-y-2">
              <p className="text-xs text-muted2 text-center">o elige una sala temática</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ROOM_PRESETS.map(r => (
                  <button
                    key={r.slug}
                    onClick={() => { setTopicInput(r.suggestedGoal); createSession(r.suggestedGoal) }}
                    disabled={loading}
                    className="flex flex-col gap-1 p-3 rounded-2xl border border-soft bg-card-theme hover:border-medium hover:bg-card-soft-theme transition text-left disabled:opacity-40"
                  >
                    <span className="text-lg">{r.emoji}</span>
                    <span className="text-xs font-semibold text-main">{r.title}</span>
                    <span className="text-[10px] text-muted2 line-clamp-2">{r.suggestedGoal}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PANTALLA CHAT
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] text-main flex flex-col">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 border-b border-soft bg-[#0d1117]/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setPhase("start"); setSession(null) }}
              className="text-sub hover:text-main transition text-sm"
            >
              ←
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">C</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none truncate">{session?.room?.title ?? "..."}</p>
                <p className="text-[11px] text-muted2 leading-none mt-0.5">
                  <span className={session?.status === "active" ? "text-emerald-400" : "text-amber-400"}>
                    {session?.status === "active" ? "activa" : "pausada"}
                  </span>
                  {session?.status === "active" && <span className="text-muted2"> · {countdown}s</span>}
                  {" · "}{session?.participants?.length ?? 0} agentes
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Room pills — mobile: hidden, sm: visible */}
            <div className="hidden sm:flex items-center gap-1">
              {ROOM_PRESETS.map(r => (
                <button
                  key={r.slug}
                  onClick={() => createSession(r.suggestedGoal)}
                  className={`text-[11px] px-2 py-1 rounded-full border transition ${
                    activeRoomSlug === r.slug
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-700"
                      : "border-soft text-muted2 hover:text-sub hover:border-medium"
                  }`}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
            <Link href="/superagent" className="text-[11px] text-muted2 hover:text-sub transition px-2 py-1 rounded-lg border border-soft hover:border-medium">
              Claw ↗
            </Link>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col px-4 py-4 gap-3">

        {/* Topic badge */}
        {goal && (
          <div className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2 flex items-center justify-between gap-2">
            <p className="text-xs text-sub truncate flex-1">{goal}</p>
            <button
              onClick={() => setPhase("start")}
              className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-lg border border-soft text-muted2 hover:text-main hover:border-medium transition"
            >
              Cambiar
            </button>
          </div>
        )}

        {/* Action suggestion banner */}
        {actionSuggestion?.detected && (
          <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-violet-700">⚡ EduAI Claw sugiere</p>
            <p className="text-sm text-main">{actionSuggestion.label}</p>
            <p className="text-xs text-sub">{actionSuggestion.reason}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-violet-400/20 bg-violet-400/10 text-violet-700">
                {actionSuggestion.intent}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-700">
                → {actionSuggestion.target}
              </span>
              <button
                onClick={executeDetectedAction}
                disabled={loading}
                className="ml-auto text-[11px] px-3 py-1.5 rounded-xl border border-violet-400/30 bg-violet-400/10 text-violet-700 hover:bg-violet-400/20 transition disabled:opacity-40"
              >
                {loading ? "Ejecutando..." : "Ejecutar →"}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Chat feed */}
        <div className="flex-1 space-y-4 py-2 min-h-[300px]">
          {!session ? (
            <div className="flex items-center justify-center h-48 text-muted2 text-sm">Cargando...</div>
          ) : session.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted2">
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
              <div className="w-8 h-8 rounded-full bg-card-soft-theme flex-shrink-0 flex items-center justify-center">
                <span className="flex gap-0.5">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card-soft-theme text-muted2 text-xs">
                Agentes respondiendo...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Participants strip */}
        {session?.participants?.length ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {session.participants.map(p => {
              const c = ROLE_COLORS[p.role] || ROLE_COLORS.assistant
              return (
                <div key={p.id} className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-soft bg-card-soft-theme">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  <span className="text-[11px] text-sub">{p.name}</span>
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Paused banner */}
        {session?.status === "paused" && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-700">Conversación pausada</p>
            <button
              onClick={resumeSession}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-700 hover:bg-amber-400/20 transition disabled:opacity-40"
            >
              {loading ? "..." : "Reanudar →"}
            </button>
          </div>
        )}

        {/* Input box */}
        <div className="rounded-2xl border border-medium bg-card-theme p-3">
          <textarea
            value={userMessage}
            onChange={e => setUserMessage(e.target.value)}
            onFocus={handleInteraction}
            onKeyDown={handleKeyDown}
            disabled={!session || session.status !== "active" || sending}
            rows={2}
            className="w-full bg-transparent text-sm text-main outline-none resize-none placeholder-gray-400 disabled:opacity-40"
            placeholder={session?.status === "active"
              ? "Escribe un mensaje o tu opinión... (Enter para enviar)"
              : "Reanuda la conversación para escribir"}
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-soft">
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
                  className="text-[11px] px-3 py-1.5 rounded-xl border border-soft text-muted2 hover:text-sub hover:border-medium transition"
                >
                  Pausar
                </button>
              )}
            </div>
            <button
              onClick={sendUserMessage}
              disabled={sending || !session || session.status !== "active" || !userMessage.trim()}
              className="px-4 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-700 text-sm font-medium hover:bg-cyan-500/30 transition disabled:opacity-30"
            >
              {sending ? "..." : "Enviar →"}
            </button>
          </div>
        </div>

        {/* Draft result */}
        {draftResponse?.draft && (
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Borrador generado ✓</p>
                <p className="text-xs text-sub mt-1">{draftResponse.draft.summary}</p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-700 flex-shrink-0">
                {draftResponse.draft.draftType}
              </span>
            </div>
            <div className="rounded-xl border border-soft bg-app p-3 max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-xs leading-6 text-sub">
                {draftResponse.draft.content}
              </pre>
            </div>
          </div>
        )}

        {/* Executed action panel */}
        {executedAction && executedAction.mode === "prepared_action" && (
          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-700">Acción ejecutada por EduAI Claw</p>
                <p className="text-xs text-sub mt-1">{executedAction.message}</p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-700 flex-shrink-0">
                {executedAction.target}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Intent", value: executedAction.intent },
                { label: "Target", value: executedAction.target },
                { label: "Modo",   value: executedAction.mode },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-soft bg-card-theme p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted2">{item.label}</p>
                  <p className="text-xs font-medium text-main mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
            {executedAction.payload && (
              <div className="rounded-xl border border-soft bg-app p-3 max-h-40 overflow-y-auto">
                <p className="text-[10px] text-muted2 mb-2">Payload preparado</p>
                <pre className="whitespace-pre-wrap text-xs leading-6 text-sub">
                  {JSON.stringify(executedAction.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
