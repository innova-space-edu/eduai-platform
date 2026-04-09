// app/ai-social/page.tsx

"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type SocialRoomSlug =
  | "ideas"
  | "research"
  | "teaching-lab"
  | "creative-studio"
  | "user-support"
  | "anticipation"

type SocialParticipantRole =
  | "supervisor"
  | "researcher"
  | "educator"
  | "mathematician"
  | "creative"
  | "assistant"

type SocialParticipant = {
  id: string
  name: string
  role: SocialParticipantRole
  specialty: string
  tone: string
}

type SocialMessage = {
  id: string
  authorId: string
  authorName: string
  role: SocialParticipantRole
  content: string
  createdAt: string
}

type SocialSession = {
  sessionId: string
  userId?: string
  status: "active" | "paused" | "closed"
  room: {
    id: string
    slug: SocialRoomSlug
    title: string
    topic: string
    createdAt: string
  }
  participants: SocialParticipant[]
  messages: SocialMessage[]
  summary: string
  createdAt: string
  updatedAt: string
  lastUserActivityAt: string
  lastAgentActivityAt: string
  inactivityTimeoutMs: number
}

type SocialSessionResponse = {
  ok: boolean
  name?: string
  alias?: string
  action?: string
  session?: SocialSession
  sessions?: SocialSession[]
  pausedCount?: number
  error?: string
}

type DraftType =
  | "study_guide"
  | "lesson_plan"
  | "exam"
  | "research_outline"
  | "prompt_pack"
  | "generic"

type DraftFile = {
  id: string
  title: string
  filename: string
  draftType: DraftType
  content: string
  summary: string
  createdAt: string
  metadata?: Record<string, unknown>
}

type DraftApiResponse = {
  ok: boolean
  name?: string
  alias?: string
  message?: string
  target?: "drafts"
  draft?: DraftFile
  logs?: Record<string, unknown>[]
  error?: string
}

function RoomCard({
  title,
  description,
  status,
  active = false,
  onClick,
}: {
  title: string
  description: string
  status: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-[1.5rem] border p-4 text-left transition",
        active
          ? "border-cyan-400/30 bg-cyan-400/10"
          : "border-white/10 bg-slate-900/70 hover:border-cyan-400/20 hover:bg-slate-900",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-200">
          {status}
        </span>
      </div>
    </button>
  )
}

function AgentBubble({
  name,
  role,
  message,
  isUser = false,
}: {
  name: string
  role: string
  message: string
  isUser?: boolean
}) {
  const roleStyles: Record<string, string> = {
    supervisor: "border-cyan-400/20 bg-cyan-400/5 text-cyan-200",
    researcher: "border-violet-400/20 bg-violet-400/5 text-violet-200",
    educator: "border-emerald-400/20 bg-emerald-400/5 text-emerald-200",
    mathematician: "border-amber-400/20 bg-amber-400/5 text-amber-200",
    creative: "border-fuchsia-400/20 bg-fuchsia-400/5 text-fuchsia-200",
    assistant: "border-slate-400/20 bg-slate-400/5 text-slate-200",
  }

  return (
    <div
      className={[
        "rounded-[1.5rem] border p-4",
        isUser
          ? "ml-8 border-cyan-400/20 bg-cyan-400/10"
          : "border-white/10 bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            {role}
          </p>
        </div>
        <span
          className={[
            "rounded-full border px-2.5 py-1 text-[11px]",
            isUser
              ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
              : roleStyles[role] ||
                "border-slate-400/20 bg-slate-400/5 text-slate-200",
          ].join(" ")}
        >
          {isUser ? "Usuario" : "IA"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-7 text-slate-300">{message}</p>
    </div>
  )
}

function ParticipantCard({ participant }: { participant: SocialParticipant }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
      <p className="text-sm font-semibold text-white">{participant.name}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
        {participant.role}
      </p>
      <p className="mt-2 text-sm text-slate-300">{participant.specialty}</p>
      <p className="mt-2 text-xs text-slate-500">Tono: {participant.tone}</p>
    </div>
  )
}

const ROOM_PRESETS: Array<{
  slug: SocialRoomSlug
  title: string
  description: string
  suggestedGoal: string
}> = [
  {
    slug: "ideas",
    title: "#ideas",
    description: "Exploración libre de ideas, conceptos y posibles mejoras.",
    suggestedGoal:
      "Quiero que los agentes conversen libremente sobre nuevas ideas para mejorar EduAI",
  },
  {
    slug: "research",
    title: "#research",
    description: "Intercambio entre agentes orientados a investigación y papers.",
    suggestedGoal:
      "Quiero que los agentes conversen sobre una idea de investigación en plasma para CubeSats",
  },
  {
    slug: "teaching-lab",
    title: "#teaching-lab",
    description: "Espacio pedagógico para planificación, clases y actividades.",
    suggestedGoal:
      "Necesito que los agentes conversen sobre una planificación con OA e indicadores",
  },
  {
    slug: "creative-studio",
    title: "#creative-studio",
    description: "Sala para imagen, audio, narrativa y materiales visuales.",
    suggestedGoal:
      "Quiero que los agentes conversen sobre una infografía educativa y un afiche visual",
  },
  {
    slug: "user-support",
    title: "#user-support",
    description: "Sala para debatir cómo acompañar mejor al usuario.",
    suggestedGoal:
      "Necesito que los agentes conversen sobre cómo ayudar mejor al usuario en el chat",
  },
  {
    slug: "anticipation",
    title: "#anticipation",
    description: "Sala especial para propuestas anticipadas y borradores.",
    suggestedGoal:
      "Conversemos sobre cómo anticipar un borrador de guía de estudio",
  },
]

const DEFAULT_GOAL =
  "Quiero que los agentes conversen sobre una idea de investigación en plasma para CubeSats"

export default function AISocialPage() {
  const [goal, setGoal] = useState(DEFAULT_GOAL)
  const [userMessage, setUserMessage] = useState("")
  const [session, setSession] = useState<SocialSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftResponse, setDraftResponse] = useState<DraftApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(60)

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const activeRoomSlug = session?.room?.slug

  const roomStatusMap = useMemo(() => {
    const map = new Map<SocialRoomSlug, string>()
    ROOM_PRESETS.forEach((room) => {
      if (activeRoomSlug === room.slug) {
        map.set(room.slug, session?.status === "paused" ? "Pausada" : "Abierta")
      } else {
        map.set(room.slug, "Lista")
      }
    })
    return map
  }, [activeRoomSlug, session?.status])

  const resetCountdown = useCallback(() => {
    const timeoutMs = session?.inactivityTimeoutMs ?? 60000
    setCountdown(Math.floor(timeoutMs / 1000))
  }, [session?.inactivityTimeoutMs])

  const createSession = useCallback(
    async (customGoal?: string) => {
      const finalGoal = (customGoal ?? goal).trim()
      if (!finalGoal) {
        setError("Escribe primero el tema de conversación.")
        return
      }

      try {
        setLoading(true)
        setError(null)
        setDraftResponse(null)

        const res = await fetch("/api/superagent/social/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            currentPage: "/ai-social",
            activeAgent: "social",
            userGoal: finalGoal,
            tags: ["social", "agents"],
            inactivityTimeoutMs: 60000,
          }),
        })

        const json = (await res.json()) as SocialSessionResponse

        if (!res.ok || !json.ok || !json.session) {
          setError(json.error || "No se pudo crear la sesión social.")
          return
        }

        setGoal(finalGoal)
        setSession(json.session)
        setUserMessage("")
        setCountdown(Math.floor(json.session.inactivityTimeoutMs / 1000))
      } catch {
        setError("Ocurrió un error al crear la sesión social.")
      } finally {
        setLoading(false)
      }
    },
    [goal]
  )

  const touchSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch("/api/superagent/social/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "touch",
          sessionId,
        }),
      })

      const json = (await res.json()) as SocialSessionResponse
      if (res.ok && json.ok && json.session) {
        setSession(json.session)
        setCountdown(Math.floor(json.session.inactivityTimeoutMs / 1000))
      }
    } catch {
      // silencio controlado
    }
  }, [])

  const pauseSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch("/api/superagent/social/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pause",
          sessionId,
        }),
      })

      const json = (await res.json()) as SocialSessionResponse
      if (res.ok && json.ok && json.session) {
        setSession(json.session)
      }
    } catch {
      // silencio controlado
    }
  }, [])

  const resumeSession = useCallback(async () => {
    if (!session?.sessionId) return

    try {
      setLoading(true)
      const res = await fetch("/api/superagent/social/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resume",
          sessionId: session.sessionId,
        }),
      })

      const json = (await res.json()) as SocialSessionResponse
      if (!res.ok || !json.ok || !json.session) {
        setError(json.error || "No se pudo reanudar la sesión.")
        return
      }

      setSession(json.session)
      setCountdown(Math.floor(json.session.inactivityTimeoutMs / 1000))
    } catch {
      setError("Ocurrió un error al reanudar la sesión.")
    } finally {
      setLoading(false)
    }
  }, [session?.sessionId])

  const sendUserMessage = useCallback(async () => {
    if (!session?.sessionId || !userMessage.trim()) return
    const messageToSend = userMessage.trim()
    try {
      setSending(true)
      setError(null)
      const appendRes = await fetch("/api/superagent/social/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "append-message",
          sessionId: session.sessionId,
          authorId: "user",
          authorName: "Usuario",
          role: "assistant",
          content: messageToSend,
          fromUser: true,
        }),
      })
      const appendJson = (await appendRes.json()) as SocialSessionResponse
      if (!appendRes.ok || !appendJson.ok || !appendJson.session) {
        setError(appendJson.error || "No se pudo agregar tu mensaje.")
        return
      }
      setSession(appendJson.session)
      setUserMessage("")
      setCountdown(Math.floor(appendJson.session.inactivityTimeoutMs / 1000))
      const roundRes = await fetch("/api/superagent/social/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "agent-round",
          sessionId: session.sessionId,
          userMessage: messageToSend,
        }),
      })
      const roundJson = (await roundRes.json()) as SocialSessionResponse
      if (roundRes.ok && roundJson.ok && roundJson.session) {
        setSession(roundJson.session)
        setCountdown(Math.floor(roundJson.session.inactivityTimeoutMs / 1000))
      }
    } catch {
      setError("Ocurrió un error al enviar tu mensaje.")
    } finally {
      setSending(false)
    }
  }, [session?.sessionId, userMessage])

  const createDraftFromConversation = useCallback(async () => {
    if (!session) return

    try {
      setDraftLoading(true)
      setError(null)

      const conversationContext = session.messages
        .map((msg) => `${msg.authorName}: ${msg.content}`)
        .join("\n")

      const draftGoal = `${session.room.topic}\n\nResumen social:\n${session.summary}\n\nConversación:\n${conversationContext}`

      const res = await fetch("/api/superagent/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPage: "/ai-social",
          activeAgent: "drafts",
          userGoal: draftGoal,
          tags: [
            "social",
            "draft",
            session.room.slug,
            ...(session.participants.map((p) => p.role) || []),
          ],
          metadata: {
            source: "ai-social",
            sessionId: session.sessionId,
            roomTitle: session.room.title,
            roomTopic: session.room.topic,
            socialSummary: session.summary,
            messageCount: session.messages.length,
          },
        }),
      })

      const json = (await res.json()) as DraftApiResponse

      if (!res.ok || !json.ok) {
        setError(json.error || json.message || "No se pudo crear el borrador.")
        setDraftResponse(json)
        return
      }

      setDraftResponse(json)
    } catch {
      setError("Ocurrió un error al crear el borrador desde la conversación.")
    } finally {
      setDraftLoading(false)
    }
  }, [session])

  useEffect(() => {
    createSession(DEFAULT_GOAL)
  }, [createSession])

  useEffect(() => {
    if (!session || session.status !== "active") {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      return
    }

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (session?.sessionId) {
            pauseSession(session.sessionId)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [session, pauseSession])

  useEffect(() => {
    if (cleanupIntervalRef.current) clearInterval(cleanupIntervalRef.current)

    cleanupIntervalRef.current = setInterval(async () => {
      try {
        await fetch("/api/superagent/social/session?cleanup=true", {
          method: "GET",
          cache: "no-store",
        })
      } catch {
        // silencio
      }
    }, 15000)

    return () => {
      if (cleanupIntervalRef.current) clearInterval(cleanupIntervalRef.current)
    }
  }, [])

  const handleRoomClick = async (suggestedGoal: string) => {
    await createSession(suggestedGoal)
  }

  const handleInteraction = async () => {
    if (session?.sessionId && session.status === "active") {
      await touchSession(session.sessionId)
      resetCountdown()
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.08),_transparent_25%),radial-gradient(circle_at_right,_rgba(168,85,247,0.10),_transparent_20%),linear-gradient(to_bottom,_#020617,_#0f172a)] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
          >
            ← Volver
          </Link>

          <Link
            href="/superagent"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 transition hover:border-violet-400/30 hover:text-white"
          >
            Ver panel de EduAI Claw
          </Link>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 px-6 py-6 sm:px-8">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/90">
              Red social IA
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Chat social de agentes
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              La conversación se activa cuando entras aquí. Si no interactúas
              durante 1 minuto, la sala se pausa automáticamente y guarda el estado.
            </p>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-12">
            <aside className="space-y-4 lg:col-span-3">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Salas
                </h2>

                <div className="mt-4 space-y-3">
                  {ROOM_PRESETS.map((room) => (
                    <RoomCard
                      key={room.slug}
                      title={room.title}
                      description={room.description}
                      status={roomStatusMap.get(room.slug) || "Lista"}
                      active={activeRoomSlug === room.slug}
                      onClick={() => handleRoomClick(room.suggestedGoal)}
                    />
                  ))}
                </div>
              </div>
            </aside>

            <section className="space-y-4 lg:col-span-6">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Sesión social
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {session?.room
                          ? `${session.room.title} · ${session.room.topic}`
                          : "Creando sesión inicial..."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-xs",
                          session?.status === "active"
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                            : "border-amber-400/20 bg-amber-400/10 text-amber-200",
                        ].join(" ")}
                      >
                        {session?.status === "active"
                          ? "Activa"
                          : session?.status === "paused"
                          ? "Pausada"
                          : "Sin sesión"}
                      </span>

                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                        {session?.status === "active"
                          ? `Pausa en ${countdown}s`
                          : "Sin temporizador"}
                      </span>
                    </div>
                  </div>

                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    onFocus={handleInteraction}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
                    placeholder="Tema que quieres discutir entre agentes"
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => createSession()}
                      disabled={loading}
                      className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Creando..." : "Abrir nueva conversación"}
                    </button>

                    <button
                      type="button"
                      onClick={resumeSession}
                      disabled={loading || !session || session.status === "active"}
                      className="rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-sm font-medium text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reanudar conversación
                    </button>

                    <button
                      type="button"
                      onClick={createDraftFromConversation}
                      disabled={
                        draftLoading ||
                        !session ||
                        session.messages.length === 0
                      }
                      className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {draftLoading
                        ? "Creando borrador..."
                        : "Crear borrador desde esta conversación"}
                    </button>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Conversación activa
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {session?.room
                        ? `${session.room.title} · ${session.room.topic}`
                        : "Todavía no hay conversación."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {session?.messages?.length ? (
                    session.messages.map((message) => (
                      <AgentBubble
                        key={message.id}
                        name={message.authorName}
                        role={message.role}
                        message={message.content}
                        isUser={message.authorId === "user"}
                      />
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-slate-900/40 p-6 text-sm leading-7 text-slate-400">
                      Aquí aparecerá la conversación social cuando se cree la sesión.
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="mb-3 text-sm font-medium text-white">
                    Participar en la conversación
                  </p>

                  <textarea
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onFocus={handleInteraction}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
                    placeholder="Escribe una idea, una instrucción o una propuesta para los agentes..."
                  />

                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={sendUserMessage}
                      disabled={
                        sending ||
                        !session ||
                        session.status !== "active" ||
                        !userMessage.trim()
                      }
                      className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? "Enviando..." : "Enviar al chat social"}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!session?.sessionId) return
                        await pauseSession(session.sessionId)
                      }}
                      disabled={!session || session.status !== "active"}
                      className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200 transition hover:border-amber-400/40 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Pausar ahora
                    </button>
                  </div>
                </div>
              </div>

              {draftResponse?.draft && (
                <div className="rounded-[1.75rem] border border-emerald-400/15 bg-emerald-400/5 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Borrador generado desde la conversación
                      </h2>
                      <p className="mt-2 text-sm text-slate-300">
                        {draftResponse.draft.summary}
                      </p>
                    </div>

                    <span className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
                      {draftResponse.draft.filename}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Tipo
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {draftResponse.draft.draftType}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Creado
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {new Date(draftResponse.draft.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Estado
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        Draft seguro
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="mb-3 text-sm font-medium text-slate-200">
                      Contenido del borrador
                    </p>
                    <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-slate-300">
                      {draftResponse.draft.content}
                    </pre>
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-4 lg:col-span-3">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-lg font-semibold text-white">
                  Participantes
                </h2>

                <div className="mt-4 space-y-3">
                  {session?.participants?.length ? (
                    session.participants.map((participant) => (
                      <ParticipantCard
                        key={participant.id}
                        participant={participant}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
                      Los participantes aparecerán cuando se cree la sesión.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-lg font-semibold text-white">
                  Resumen social
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {session?.summary ||
                    "Cuando la sala tenga contenido, EduAI Claw mostrará aquí una síntesis."}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-violet-400/10 bg-violet-400/5 p-4">
                <p className="text-sm font-medium text-violet-200">
                  Estado de persistencia
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  La conversación se guarda en memoria de sesión del servidor. En
                  una fase posterior la conectaremos a Supabase para persistencia real.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
