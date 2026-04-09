// app/ai-social/page.tsx

"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

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

type SocialApiResponse = {
  ok: boolean
  name?: string
  alias?: string
  room?: {
    id: string
    slug: SocialRoomSlug
    title: string
    topic: string
    createdAt: string
  }
  participants?: SocialParticipant[]
  messages?: SocialMessage[]
  summary?: string
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
}: {
  name: string
  role: string
  message: string
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
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
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
            roleStyles[role] || "border-slate-400/20 bg-slate-400/5 text-slate-200",
          ].join(" ")}
        >
          IA
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
    suggestedGoal: "Quiero que los agentes conversen libremente sobre nuevas ideas para mejorar EduAI",
  },
  {
    slug: "research",
    title: "#research",
    description: "Intercambio entre agentes orientados a investigación y papers.",
    suggestedGoal: "Quiero que los agentes conversen sobre una idea de investigación en plasma para CubeSats",
  },
  {
    slug: "teaching-lab",
    title: "#teaching-lab",
    description: "Espacio pedagógico para planificación, clases y actividades.",
    suggestedGoal: "Necesito que los agentes conversen sobre una planificación con OA e indicadores",
  },
  {
    slug: "creative-studio",
    title: "#creative-studio",
    description: "Sala para imagen, audio, narrativa y materiales visuales.",
    suggestedGoal: "Quiero que los agentes conversen sobre una infografía educativa y un afiche visual",
  },
  {
    slug: "user-support",
    title: "#user-support",
    description: "Sala para debatir cómo acompañar mejor al usuario.",
    suggestedGoal: "Necesito que los agentes conversen sobre cómo ayudar mejor al usuario en el chat",
  },
  {
    slug: "anticipation",
    title: "#anticipation",
    description: "Sala especial para propuestas anticipadas y borradores.",
    suggestedGoal: "Conversemos sobre cómo anticipar un borrador de guía de estudio",
  },
]

export default function AISocialPage() {
  const [goal, setGoal] = useState(
    "Quiero que los agentes conversen sobre una idea de investigación en plasma para CubeSats"
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<SocialApiResponse | null>(null)

  const activeRoomSlug = response?.room?.slug

  const roomStatusMap = useMemo(() => {
    const map = new Map<SocialRoomSlug, string>()
    ROOM_PRESETS.forEach((room) => {
      map.set(room.slug, activeRoomSlug === room.slug ? "Abierta" : "Lista")
    })
    return map
  }, [activeRoomSlug])

  async function handleStartConversation(customGoal?: string) {
    const finalGoal = (customGoal ?? goal).trim()

    if (!finalGoal) {
      setError("Escribe primero el tema que quieres conversar entre agentes.")
      return
    }

    try {
      setLoading(true)
      setError(null)

      const res = await fetch("/api/superagent/social", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPage: "/ai-social",
          activeAgent: "social",
          userGoal: finalGoal,
          tags: ["social", "agents"],
        }),
      })

      const json = (await res.json()) as SocialApiResponse

      if (!res.ok || !json.ok) {
        setError(json.error || "No se pudo iniciar la conversación social.")
        setResponse(json)
        return
      }

      setGoal(finalGoal)
      setResponse(json)
    } catch {
      setError("Ocurrió un error al conectar con el chat social de agentes.")
    } finally {
      setLoading(false)
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
              Espacio donde los agentes conversan entre ellos, enriquecen ideas,
              debaten rutas de acción y consideran al usuario como un participante
              más dentro de una experiencia separada del chat privado tradicional.
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
                      onClick={() => {
                        setGoal(room.suggestedGoal)
                        handleStartConversation(room.suggestedGoal)
                      }}
                    />
                  ))}
                </div>
              </div>
            </aside>

            <section className="space-y-4 lg:col-span-6">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Iniciar conversación social
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Define el tema y deja que EduAI Claw convoque a los agentes adecuados.
                    </p>
                  </div>

                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
                    placeholder="Ejemplo: Quiero que los agentes conversen sobre una idea de investigación..."
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleStartConversation()}
                      disabled={loading}
                      className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Iniciando..." : "Iniciar conversación"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setResponse(null)
                        setError(null)
                      }}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
                    >
                      Limpiar vista
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
                      {response?.room
                        ? `${response.room.title} · ${response.room.topic}`
                        : "Todavía no hay una conversación iniciada."}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                    {response?.ok ? "Activa" : "Esperando"}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {response?.messages?.length ? (
                    response.messages.map((message) => (
                      <AgentBubble
                        key={message.id}
                        name={message.authorName}
                        role={message.role}
                        message={message.content}
                      />
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-slate-900/40 p-6 text-sm leading-7 text-slate-400">
                      Aquí aparecerá la conversación social real entre agentes cuando inicies una sala.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="space-y-4 lg:col-span-3">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-lg font-semibold text-white">
                  Participantes
                </h2>

                <div className="mt-4 space-y-3">
                  {response?.participants?.length ? (
                    response.participants.map((participant) => (
                      <ParticipantCard
                        key={participant.id}
                        participant={participant}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
                      Los participantes aparecerán al iniciar una conversación.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-lg font-semibold text-white">
                  Resumen social
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {response?.summary ||
                    "Cuando abras una sala, EduAI Claw sintetizará la conversación aquí."}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-violet-400/10 bg-violet-400/5 p-4">
                <p className="text-sm font-medium text-violet-200">
                  Nota de diseño
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Esta página funciona como laboratorio vivo de agentes: ideas,
                  debate, síntesis y futura conexión con drafts y memoria.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
